<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * PMU_Sesion - Ciclo de vida del comprador (spec 004, contract sesion-item.md).
 *
 * Dueno del ciclo: draft -> item del carrito -> staging -> entregable, TODO
 * dentro de tmp/sesion-{sid}/{item_key}/ (directorio unico que se mueve; el
 * sid no cambia). Las rutas las entrega PMU_Uploads (Const. II): esta clase
 * no arma rutas por su cuenta.
 *
 * Pool dedicado por item (sin deduplicacion global): img/{pdf}-{id}-{n}.{ext}
 * (la extension sale de la firma: spec 026) con fila en
 * manifest.archivos[] {pdf, grupo_id, indice, file, hash}.
 * Mockups congelados: mockup-{id}.webp (300x300, al agregar).
 * Errores con causa motor:sesion:<causa>.
 */
class PMU_Sesion
{
    const COOKIE = 'pmu_sid';
    const COOKIE_DIAS = 30;
    const ESTADO_OK = 'ok';
    const ESTADO_SIN_VISTA = 'sin_vista';
    const ESTADO_OMISIBLE = 'omisible';

    /** @var PMU_Uploads */
    private $motor;

    public function __construct(PMU_Uploads $motor)
    {
        $this->motor = $motor;
    }

    /* ==================== Sid (identidad del visitante) ==================== */

    /** UUID v4 (sin dependencias). */
    private function uuid4()
    {
        $datos = function_exists('random_bytes') ? random_bytes(16) : openssl_random_pseudo_bytes(16);
        $datos[6] = chr((ord($datos[6]) & 0x0f) | 0x40); // version 4
        $datos[8] = chr((ord($datos[8]) & 0x3f) | 0x80); // variante RFC 4122
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($datos), 4));
    }

    /**
     * Sid vigente: lee/emite la cookie pmu_sid (UUID, 30 dias, httponly,
     * path /). Independiente de la sesion PHP y de Woo. Devuelve el sid saneado.
     */
    public function sid_actual()
    {
        $sid = isset($_COOKIE[self::COOKIE]) ? (string)$_COOKIE[self::COOKIE] : '';
        try {
            $sid = $this->motor->sesion_segura($sid, 'sesion:sid_actual');
        } catch (\Throwable $e) {
            $sid = '';
        }
        if ($sid === '') {
            $sid = strtolower($this->motor->nombre_seguro($this->uuid4(), 'sesion:sid_actual'));
            if (!headers_sent()) {
                setcookie(self::COOKIE, $sid, [
                    'expires' => time() + self::COOKIE_DIAS * DAY_IN_SECONDS,
                    'path' => '/',
                    'httponly' => true,
                    'samesite' => 'Lax',
                ]);
            }
            $_COOKIE[self::COOKIE] = $sid; // disponible en el mismo request
        }
        return $sid;
    }

    /* ============ Manifests por DIRECTORIO (spec 030, R3) ============ */

    /**
     * Lee el manifest de un item por DIRECTORIO (spec 030, R3).
     *
     * La consolidacion del pedido trabaja con items que ya no viven bajo la
     * sesion (`orders/{cliente}/{order_id}/{item}/`), asi que las variantes
     * por `sid` + `item_key` no sirven: estas tres funciones son el mismo patron
     * (lectura tolerante, escritura atomica y lock `flock`) sobre un `$dir`.
     */
    public function leer_manifest_dir($dir)
    {
        $ruta = rtrim((string)$dir, '/\\') . DIRECTORY_SEPARATOR . 'manifest.json';
        if (!is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        return is_array($datos) ? $datos : null;
    }

    /** Guarda el manifest de un item por DIRECTORIO (.tmp + rename, spec 030 R3). */
    public function guardar_manifest_dir($dir, array $manifest)
    {
        $dir = rtrim((string)$dir, '/\\');
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:sesion:directorio:no_escribible');
        }
        $tmp = $dir . DIRECTORY_SEPARATOR . 'manifest.json.tmp';
        $json = wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || @file_put_contents($tmp, $json) === false) {
            throw new Exception('motor:sesion:manifest:invalido');
        }
        if (!@rename($tmp, $dir . DIRECTORY_SEPARATOR . 'manifest.json')) {
            @unlink($tmp);
            throw new Exception('motor:sesion:manifest:invalido');
        }
        return $dir . DIRECTORY_SEPARATOR . 'manifest.json';
    }

    /**
     * Mutacion serializada del manifest por DIRECTORIO (spec 030, R3): el mismo
     * lock por item que `mutar_manifest()`. El callable recibe el manifest POR
     * REFERENCIA (`function (&$m) {...}`).
     */
    public function mutar_manifest_dir($dir, callable $fn)
    {
        $dir = rtrim((string)$dir, '/\\');
        if (!is_dir($dir)) {
            throw new Exception('motor:sesion:item:ausente');
        }
        $lock = @fopen($dir . DIRECTORY_SEPARATOR . '.manifest.lock', 'c');
        if ($lock === false) {
            throw new Exception('motor:sesion:manifest:invalido');
        }
        if (!@flock($lock, LOCK_EX)) {
            @fclose($lock);
            throw new Exception('motor:sesion:manifest:invalido');
        }
        try {
            $manifest = $this->leer_manifest_dir($dir);
            if (!is_array($manifest)) {
                throw new Exception('motor:sesion:item:ausente');
            }
            $fn($manifest);
            $this->guardar_manifest_dir($dir, $manifest);
        } finally {
            @flock($lock, LOCK_UN);
            @fclose($lock);
        }
        return $manifest;
    }

    /* ==================== Item y manifest ==================== */

    /** Carpeta del item (sin crear). */
    public function dir_item($sid, $item_key)
    {
        return $this->motor->dir_sesion_item($sid, $item_key);
    }

    /**
     * Crea un borrador draft-{uuid} con manifest inicial. Devuelve el item_key.
     *
     * `$contexto` (spec 037, T004/R1): el cotizador de stickers NO tiene PDF. Su
     * item nace con `contexto = 'cotizador'`, `pdfs = []` y `preview_estado =
     * 'omisible'` (el mockup informa; el visto bueno es el add-to-cart). El
     * contexto viaja como CLAVE PROPIA del manifest: `subidas[].origen` es
     * vocabulario cerrado de la 035 y agregarle un valor rompe sus `switch`.
     */
    public function crear_draft($sid, array $pdfs, $contexto = '')
    {
        $contexto = strtolower(trim((string)$contexto));
        if (!$pdfs && $contexto !== 'cotizador') {
            throw new Exception('motor:sesion:pdfs:vacio');
        }
        $limpios = [];
        foreach ($pdfs as $pdf) {
            $limpios[] = $this->motor->nombre_seguro($pdf, 'sesion:crear_draft');
        }
        $item = ($contexto === 'cotizador' ? 'cot-' : 'draft-')
            . substr(str_replace('-', '', $this->uuid4()), 0, $contexto === 'cotizador' ? 8 : 12);
        $this->motor->dir_sesion_item_img($sid, $item, true); // crea item + img/
        $manifest = [
            'item_key' => $item,
            'sid' => $this->motor->sesion_segura($sid, 'sesion:crear_draft'),
            'pdfs' => $limpios,
            'valores' => new \stdClass(),
            'archivos' => [],
            'mockup_vistas' => [],
            'mockup_visto' => null,
            // Spec 035 (§3.5): las vistas que el comprador MIRO (distinto de las
            // que llego a renderizar). Sobrevive el cambio de clave del item.
            'vistos' => [],
            'preview_estado' => self::ESTADO_SIN_VISTA,
            'creado' => gmdate('Y-m-d\TH:i:s\Z'),
            'motor' => defined('PERSONALIZADOR_PDF_VERSION') ? PERSONALIZADOR_PDF_VERSION : 'dev',
        ];
        if ($contexto !== '') {
            // Spec 037 Enmienda v2 (FR-037): con PLANTILLA importada el item es un
            // PDF como cualquier otro (`pdfs = [slug]`, entrega normal del Motor);
            // sin plantilla no hay PDF: solo la imagen procesada (`omisible`).
            $manifest['contexto'] = $contexto;
            $manifest['pdfs'] = $limpios;
            $manifest['preview_estado'] = $limpios ? self::ESTADO_OK : self::ESTADO_OMISIBLE;
        }
        $this->guardar_manifest($sid, $item, $manifest);
        return $item;
    }

    /** Lee el manifest (tolerante): array o null si ausente/ilegible. */
    public function leer_manifest($sid, $item_key)
    {
        $ruta = $this->motor->manifest_sesion_item($sid, $item_key);
        if (!is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        return is_array($datos) ? $datos : null;
    }

    /**
     * RC4.6.17: resuelve el item_key REAL de una compra en el checkout sin
     * depender del cart_item_key de Woo. Woo recalcula el hash del item del
     * carrito en el request del checkout (los custom cart data pmu_sid /
     * pmu_item_key no siempre sobreviven), asi que el cart_item_key que reporta
     * el checkout NO coincide con el nombre de la carpeta que dejo
     * carrito_promover al agregar al carrito. Confiar en ese nombre dejaba
     * pedido_item_crear en un return temprano silencioso (item_crear:sin_item):
     * sin metadata PMU en el line item -> pedido_promover no promovia nada ->
     * orders/ vacio -> sin email ni descarga (el #29081 quedo asi).
     *
     * Estrategia determinista:
     *   1) Prueba los candidatos directos (cart_item_key del checkout y el
     *      pmu_item_key de los datos): gana el primero cuyo manifest exista.
     *   2) Si ninguno resuelve, escanea tmp/sesion-{sid}/ y toma los item con
     *      manifest.json. En la practica hay UN item por compra/sesion, asi que
     *      es univoco; si hubiera mas de uno (re-edicion), devuelve el mas
     *      reciente por manifest.creado y ademas la lista completa por si el
     *      llamador quiere distinguir.
     *
     * @return array{item:string,candidatos:string[],multiples:string[]}
     *         'item' es el nombre real de la carpeta ('' si no hay ninguno).
     */
    public function resolver_item_checkout($sid, array $candidatos = [])
    {
        $sid = $this->motor->sesion_segura((string)$sid, 'resolver_item_checkout');
        $candidatos = array_values(array_unique(array_filter(
            array_map('strval', $candidatos),
            static function ($c) { return $c !== '' && $c !== '0'; }
        )));

        // 1) Candidatos directos: el primero cuyo manifest exista gana.
        foreach ($candidatos as $cand) {
            if (is_array($this->leer_manifest($sid, $cand))) {
                return ['item' => $cand, 'candidatos' => $candidatos, 'multiples' => []];
            }
        }

        // 2) Scan de la sesion: carpetas con manifest.json real.
        $dir = $this->motor->dir_sesion($sid, false);
        if (!is_dir($dir)) {
            return ['item' => '', 'candidatos' => $candidatos, 'multiples' => []];
        }
        $encontrados = [];
        $it = new FilesystemIterator($dir, FilesystemIterator::SKIP_DOTS);
        foreach ($it as $entrada) {
            if (!$entrada->isDir()) {
                continue;
            }
            $nombre = $entrada->getFilename();
            // Un item valido tiene manifest.json (draft-* o cart_item_key).
            if (!is_file($entrada->getPathname() . DIRECTORY_SEPARATOR . 'manifest.json')) {
                continue;
            }
            $m = $this->leer_manifest($sid, $nombre);
            if (!is_array($m)) {
                continue;
            }
            $encontrados[$nombre] = strtotime((string)($m['creado'] ?? '0')) ?: 0;
        }
        if (!$encontrados) {
            return ['item' => '', 'candidatos' => $candidatos, 'multiples' => []];
        }
        // Mas reciente primero.
        arsort($encontrados);
        $nombres = array_keys($encontrados);
        return [
            'item' => (string)$nombres[0],
            'candidatos' => $candidatos,
            'multiples' => $nombres, // >1 = hay re-edicion; el llamador decide
        ];
    }


    /**
     * Mutacion serializada del manifest de un item (spec 004, T003): TODAS las
     * operaciones de leer-modificar-escribir del manifest pasan por aca bajo un
     * lock `flock` por item. Sin esto, la rafaga de POSTs del pool (texto + fotos
     * por instancia, en paralelo) chocaba en el `manifest.json.tmp` de nombre
     * fijo y lanzaba `motor:sesion:manifest:invalido` (rename a medias), ademas
     * de perder filas por el read-modify-write concurrente (la capa de imagen
     * salia gris porque la instancia sin fila no resolvia).
     *
     * El callable recibe el manifest POR REFERENCIA: `function (&$m) {...}`.
     */
    private function mutar_manifest($sid, $item_key, callable $fn)
    {
        $dir = $this->motor->dir_sesion_item($sid, $item_key, true);
        $lock = @fopen($dir . DIRECTORY_SEPARATOR . '.manifest.lock', 'c');
        if ($lock === false) {
            throw new Exception('motor:sesion:manifest:invalido');
        }
        if (!@flock($lock, LOCK_EX)) {
            @fclose($lock);
            throw new Exception('motor:sesion:manifest:invalido');
        }
        try {
            $manifest = $this->leer_manifest($sid, $item_key);
            if (!is_array($manifest)) {
                throw new Exception('motor:sesion:item:ausente');
            }
            $fn($manifest);
            $this->guardar_manifest($sid, $item_key, $manifest);
        } finally {
            @flock($lock, LOCK_UN);
            @fclose($lock);
        }
        return $manifest;
    }

    /** Guarda el manifest con escritura atomica (.tmp + rename). */
    public function guardar_manifest($sid, $item_key, array $manifest)
    {
        $dir = $this->motor->dir_sesion_item($sid, $item_key, true);
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:sesion:directorio:no_escribible');
        }
        $tmp = $dir . DIRECTORY_SEPARATOR . 'manifest.json.tmp';
        $json = wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || @file_put_contents($tmp, $json) === false) {
            throw new Exception('motor:sesion:manifest:invalido');
        }
        if (!@rename($tmp, $dir . DIRECTORY_SEPARATOR . 'manifest.json')) {
            @unlink($tmp);
            throw new Exception('motor:sesion:manifest:invalido');
        }
        return $dir . DIRECTORY_SEPARATOR . 'manifest.json';
    }

    /**
     * Promueve el draft a linea del carrito: rename a {cart_item_key} DENTRO
     * de la misma sesion (el sid no cambia) y actualiza manifest.item_key.
     */
    public function promover($sid, $draft, $cart_item_key)
    {
        $origen = $this->motor->dir_sesion_item($sid, $draft);
        if (!is_dir($origen)) {
            throw new Exception('motor:sesion:item:ausente');
        }
        $destino = $this->motor->dir_sesion_item($sid, $cart_item_key);
        if (is_dir($destino)) {
            throw new Exception('motor:sesion:promocion:existente');
        }
        if (!@rename($origen, $destino)) {
            throw new Exception('motor:sesion:directorio:no_escribible');
        }
        $manifest = $this->leer_manifest($sid, $cart_item_key);
        if (is_array($manifest)) {
            $manifest['item_key'] = $cart_item_key;
            $this->guardar_manifest($sid, $cart_item_key, $manifest);
        }
        return $destino;
    }

    /* ==================== Pool e imagenes congeladas ==================== */

    /**
     * Siguiente numero disponible para el pool del grupo: {pdf}-{id}-{n}.{ext}.
     *
     * Spec 026 (D9): cuenta **todos** los formatos (png/webp/jpg/gif). Si solo
     * mirara los `.png`, un WebP y un PNG del mismo grupo se pisarian (el `n`
     * volveria a 1).
     */
    private function siguiente_n($imgDir, $pdf, $grupo)
    {
        // Mismo casing con el que se escribe el archivo (pdf saneado + grupo hex).
        $prefijo = $pdf . '-' . $grupo . '-';
        $n = 1;
        foreach ((array)glob($imgDir . DIRECTORY_SEPARATOR . $prefijo . '*') as $ruta) {
            $base = basename($ruta);
            if (preg_match('/\-' . preg_quote($grupo, '/') . '\-(\d+)\.[a-z0-9]+$/i', $base, $m)) {
                $n = max($n, (int)$m[1] + 1);
            }
        }
        return $n;
    }

    /**
     * Guarda una imagen en el pool del item y anota la fila en manifest.archivos[].
     * $hash opcional: sha1(valor + preset + settings + WxH) que calcula el
     * llamador para la regeneracion parcial (fallback: sha1 de los bytes).
     *
     * Spec 026 (D6/D9): la **extension sale de la FIRMA** de los bytes (no del
     * nombre): `{pdf}-{id}-{n}.{ext}`. Los items viejos (PNG) se siguen leyendo
     * igual: el Motor acepta ambos formatos.
     *
     * Spec 029 (D3): el pool guarda **solo lo que se genera** (el texto). `$hash`
     * es la clave del render parcial y `$indice` la POSICION de la instancia
     * (0-based) que usa el Motor; sin `$indice` se conserva el numero de archivo
     * como indice.
     * Devuelve {indice, file, hash}.
     */
    public function guardar_imagen($sid, $item_key, $pdf, $grupo, $bytes, $hash = null, $indice = null)
    {
        $pdf = $this->motor->nombre_seguro($pdf, 'sesion:guardar_imagen');
        $grupo = strtoupper((string)$grupo);
        if (!preg_match('/^[0-9A-F]{6}$/', $grupo)) {
            throw new Exception('motor:sesion:grupo:invalido');
        }
        if ($bytes === null || $bytes === '') {
            throw new Exception('motor:sesion:png:vacio');
        }
        $firma = self::firma_imagen((string)$bytes);
        if ($firma === null) {
            throw new Exception('motor:sesion:png:invalido');
        }
        // Spec 026 (D3): el servidor convierte a WebP si puede. El pool lleva
        // el texto renderizado: calidad 0.92 (D4, los bordes con antialias no
        // deben degradarse).
        $img = self::convertir_webp((string)$bytes, 92);
        $bytes = $img['bytes'];
        $ext = $img['ext'];
        $fila = null;
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($sid, $item_key, $pdf, $grupo, $bytes, $ext, $hash, $indice, &$fila) {
            $imgDir = $this->motor->dir_sesion_item_img($sid, $item_key, true);
            $n = $this->siguiente_n($imgDir, $pdf, $grupo);
            $file = 'img/' . $pdf . '-' . $grupo . '-' . $n . '.' . $ext;
            if (@file_put_contents($imgDir . DIRECTORY_SEPARATOR . basename($file), $bytes) === false) {
                throw new Exception('motor:sesion:directorio:no_escribible');
            }
            if (!isset($manifest['archivos']) || !is_array($manifest['archivos'])) {
                $manifest['archivos'] = [];
            }
            $fila = $this->fila_archivo(
                $pdf,
                $grupo,
                ($indice === null) ? ($n - 1) : (int)$indice,
                $file,
                'texto',
                (string)($hash !== null ? $hash : sha1($bytes))
            );
            $manifest['archivos'][] = $fila;
        });
        return ['indice' => $fila['indice'], 'file' => $fila['file'], 'hash' => $fila['hash']];
    }

    /**
     * Una fila de `manifest.archivos[]` (un solo lugar para su forma).
     *
     * `origen` (spec 029 D4) distingue lo que el sistema **genero** (`texto`,
     * vive en el pool `img/`) de lo que el comprador **subio** (`subida`,
     * referenciada desde `subidas/`: se registra, no se copia).
     */
    /**
     * Forma de una fila de `subidas[]`. El `id` es la identidad (sha12 del contenido,
     * spec 039 D7) y `sha` es el contenido **crudo** (antes de convertir a WebP, D24).
     * Ya NO lleva `madre`: el modelo "familias" murio (una imagen + N recetas).
     */
    private function fila_subida($id, $file, $receta, $sha, $mime, $bytes, $creado, $origen = 'subida', $params = [])
    {
        $fila = [
            'id' => (string)$id,
            'file' => (string)$file,
            'mime' => (string)$mime,
            'bytes' => max(0, (int)$bytes),
            'creado' => max(0, (int)$creado),
            'receta' => (string)$receta,
            'sha' => (string)$sha,
            'origen' => (string)$origen,
        ];
        // Spec 035 (T024): los PARAMS v2 crudos del recorte, solo en los originales.
        // `receta` es un hash IRREVERSIBLE: sin los params no se puede recomponer la
        // composicion al generar el PDF, y la foto del comprador se perderia.
        if ((string)$origen === 'original' && is_array($params) && $params) {
            $fila['params'] = $params;
        }
        return $fila;
    }

    // (spec 039 D5: `fila_ref()` RETIRADO: no hay referencias entre pedidos desde el
    // modelo "familias". La fila `ref` historica sigue LEYENDOSE igual, pero ya no se
    // escribe: la galeria lista imagenes del escaneo, no familias referenciadas.)

    private function fila_archivo($pdf, $grupo, $indice, $file, $origen, $hash = '', $orig = [])
    {
        $fila = [
            'pdf' => (string)$pdf,
            'grupo_id' => (string)$grupo,
            'indice' => max(0, (int)$indice),
            'file' => (string)$file,
            'hash' => (string)$hash,
            'origen' => (string)$origen,
        ];
        // Spec 035 (T024): de que ORIGINAL y con que receta se materializa esta
        // composicion. El `file` es determinista, asi que el nombre hace de cache;
        // esto es lo que permite CREARLO cuando falta (Compositor, bajo demanda).
        if ((string)$origen === 'compuesta' && is_array($orig) && !empty($orig['id'])) {
            $fila['orig'] = [
                'id' => strtolower((string)$orig['id']),
                'params' => (array)($orig['params'] ?? []),
            ];
        }
        return $fila;
    }

    /**
     * Spec 029 (D1): registra las FOTOS del comprador de un grupo **sin
     * copiarlas**. La fila apunta al archivo que ya subio (`subidas/{id}.{ext}`):
     * esa foto **es** la imagen compuesta (el selector la rasteriza al lienzo,
     * spec 028 D11), asi que copiarla al pool solo gastaba red, disco y una
     * recompresion WebP→WebP.
     *
     * Los ids se validan contra `manifest.subidas[]` (nunca se arma una ruta con
     * lo que manda el cliente): un id desconocido se **omite** y esa instancia
     * queda transparente (no se inventa nada).
     *
     * **Una fila cuando alcanza**: si TODAS las instancias usan la misma foto se
     * escribe UNA fila con `indice` 0 (el Motor la replica a todo el grupo:
     * `item_generar_pdfs` pasa un escalar). Si difieren, una fila por instancia
     * con `indice` = indice de instancia (0-based), que es la posicion que lee el
     * Motor. Antes el indice era el **numero de archivo** y, como las instancias
     * suben en paralelo, el orden podia no coincidir con el de las instancias.
     *
     * Reemplaza las filas del grupo (idempotente): re-registrar no acumula.
     *
     * @param array $entradas entradas POR INSTANCIA: `{id, receta}` o el `id` suelto
     *                        ('' = instancia sin valor)
     * @return array filas escritas
     */
    public function registrar_fotos($sid, $item_key, $pdf, $grupo, array $entradas)
    {
        $pdf = $this->motor->nombre_seguro($pdf, 'sesion:registrar_fotos');
        $grupo = strtoupper((string)$grupo);
        if (!preg_match('/^[0-9A-F]{6}$/', $grupo)) {
            throw new Exception('motor:sesion:grupo:invalido');
        }
        // Spec 035 (D9): el cliente manda `{id, receta}` por INSTANCIA; tambien se
        // acepta solo el `id` (formato de la 029): en ese caso la receta se resuelve
        // de la fila `original`, que la guardo al aceptar el recorte. El `file` es
        // DETERMINISTA por receta, asi que el nombre hace de cache y el archivo lo
        // materializa `Compositor` al generar el PDF (si falta).
        $manifest = $this->leer_manifest($sid, $item_key);
        // Spec 035 (T024): de cada ORIGINAL hacen falta la RECETA (hash) y los PARAMS
        // v2. El hash es IRREVERSIBLE: sin los params no hay forma de recomponer la
        // composicion al generar el PDF.
        $originales = [];
        foreach ((array)(is_array($manifest) ? ($manifest['subidas'] ?? []) : []) as $filaS) {
            if (!is_array($filaS) || (string)($filaS['origen'] ?? '') !== 'original') {
                continue;
            }
            $idF = strtolower((string)($filaS['id'] ?? ''));
            $originales[$idF] = [
                'receta' => strtolower((string)($filaS['receta'] ?? '')),
                'params' => (array)($filaS['params'] ?? []),
            ];
        }
        $porInstancia = [];
        foreach (array_values($entradas) as $i => $e) {
            $params = [];
            if (is_array($e)) {
                $id = strtolower(trim((string)($e['id'] ?? '')));
                // Spec 035 (D9): la receta puede llegar como PARAMS crudos (v2): el HASH
                // lo recomputa SIEMPRE el servidor (`receta_de`), nunca lo propone el
                // cliente. Si ya viene como hash 12-hex, se usa tal cual.
                $receta = $e['receta'] ?? '';
                if (is_array($receta)) {
                    $cruda = $receta;
                    $receta = self::receta_de($cruda);
                    if ($receta !== '') {
                        try {
                            $params = self::receta_validar($cruda);
                        } catch (Exception $e2) {
                            $params = [];
                        }
                    }
                }
                $receta = strtolower(trim((string)$receta));
            } else {
                $id = strtolower(trim((string)$e));
                $receta = isset($originales[$id]) ? $originales[$id]['receta'] : '';
            }
            if (!preg_match('/^[a-f0-9]{12}$/', $id) || !preg_match('/^[a-f0-9]{12}$/', $receta)) {
                continue;   // instancia sin valor (o foto sin receta conocida)
            }
            if (!$params && isset($originales[$id])) {
                $params = $originales[$id]['params'];
            }
            $porInstancia[(int)$i] = [
                'file' => 'img/foto-' . $pdf . '-' . $grupo . '-' . $receta . '.webp',
                'orig' => ['id' => $id, 'params' => $params],
            ];
        }
        // Spec 040 (T007): cada receta aceptada entra al catalogo por contexto.
        // Es best-effort: la receta ya vive en la fila del manifest, asi que un
        // fallo del catalogo no debe tumbar el registro del grupo.
        $clave = (function_exists('get_current_user_id') ? (int) get_current_user_id() : 0);
        foreach ($porInstancia as $p) {
            $orig = (array)($p['orig'] ?? []);
            $idF = strtolower((string)($orig['id'] ?? ''));
            $paramsRec = (array)($orig['params'] ?? []);
            if (!preg_match('/^[a-f0-9]{12}$/', $idF) || !$paramsRec) {
                continue;
            }
            $claveReceta = self::clave_receta($paramsRec);
            if ($claveReceta === '') {
                continue;
            }
            $rutaOrig = $this->resolver_original($idF, (string)$clave, $sid);
            if ($rutaOrig === '') {
                continue;
            }
            try {
                $this->motor->catalogo_upsert(dirname($rutaOrig), $idF, [
                    'ultimo_uso' => time(),
                    'recetas' => [$claveReceta => $paramsRec],
                ]);
            } catch (\Throwable $e) {
                // La receta ya quedo en la fila del manifest (spec 035 D9).
            }
        }
        $out = [];
        if ($porInstancia) {
            ksort($porInstancia);
            $archivos = [];
            foreach ($porInstancia as $p) {
                $archivos[$p['file']] = true;
            }
            if (count($archivos) === 1) {
                // Una sola composicion cubre el grupo: UNA fila con `indice` 0 y el
                // Motor la replica (misma semantica de la 029, ahora con `orig`).
                $primero = reset($porInstancia);
                $out[] = $this->fila_archivo($pdf, $grupo, 0, $primero['file'], 'compuesta', '', $primero['orig']);
            } else {
                foreach ($porInstancia as $i => $p) {
                    $out[] = $this->fila_archivo($pdf, $grupo, (int)$i, $p['file'], 'compuesta', '', $p['orig']);
                }
            }
        }
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($pdf, $grupo, $out) {
            $resto = [];
            foreach ((array)($manifest['archivos'] ?? []) as $fila) {
                if (is_array($fila)
                    && (string)($fila['pdf'] ?? '') === $pdf
                    && strtoupper((string)($fila['grupo_id'] ?? '')) === $grupo) {
                    continue;   // el contenido del grupo se reemplaza entero
                }
                $resto[] = $fila;
            }
            $manifest['archivos'] = array_merge($resto, $out);
        });
        return $out;
    }

    /**
     * Escribe una imagen en el pool del item. `guardar_imagen()` es el nombre
     * vigente (spec 026 D6); este alias conserva el nombre viejo para los
     * llamadores que aun lo usan.
     */
    public function guardar_png($sid, $item_key, $pdf, $grupo, $bytes, $hash = null)
    {
        return $this->guardar_imagen($sid, $item_key, $pdf, $grupo, $bytes, $hash);
    }

    /**
     * Reemplazo idempotente (T014): quita los PNG previos del grupo en el pool
     * del item y sus filas del manifest; la regeneracion renumera desde 1.
     */
    public function limpiar_grupo($sid, $item_key, $pdf, $grupo)
    {
        $pdf = $this->motor->nombre_seguro($pdf, 'sesion:limpiar_grupo');
        $grupo = strtoupper((string)$grupo);
        if (!preg_match('/^[0-9A-F]{6}$/', $grupo)) {
            throw new Exception('motor:sesion:grupo:invalido');
        }
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($sid, $item_key, $pdf, $grupo) {
            $imgDir = $this->motor->dir_sesion_item_img($sid, $item_key, false);
            if (is_dir($imgDir)) {
                // Spec 026 (D9): se borran TODAS las variantes del grupo
                // (png/webp/jpg/gif), no solo los `.png`.
                foreach ((array)glob($imgDir . DIRECTORY_SEPARATOR . $pdf . '-' . $grupo . '-*') as $ruta) {
                    if (is_file($ruta)) {
                        @unlink($ruta);
                    }
                }
            }
            $resto = [];
            foreach ((array)($manifest['archivos'] ?? []) as $fila) {
                if (is_array($fila)
                    && isset($fila['pdf'], $fila['grupo_id'])
                    && (string)$fila['pdf'] === $pdf
                    && strtoupper((string)$fila['grupo_id']) === $grupo) {
                    continue;
                }
                $resto[] = $fila;
            }
            $manifest['archivos'] = $resto;
        });
    }

    /* ==================== Subidas del comprador (spec 012, T021) ============ */

    /**
     * Carpeta de las fotos del comprador: {item}/subidas/ (D14). Viaja sola con
     * el item cuando se promueve (draft -> carrito -> pedido), porque las tres
     * mudanzas mueven el arbol entero del item, no el `img/` solamente (FR-035).
     */
    public function dir_subidas($sid, $item_key, $crear = false)
    {
        $dir = $this->dir_item($sid, $item_key) . DIRECTORY_SEPARATOR . 'subidas';
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:sesion:subidas:no_escribible');
        }
        return $dir;
    }

    /**
     * Techo alto por archivo. Es **defensa**, no limite de producto (D15): el
     * volumen real lo acota el diseno (`size`/`max` por ranura).
     */
    const TOPE_SUBIDA_BYTES = 20971520; // 20 MB

    /**
     * Formato real de unos bytes de imagen, por firma. WebP es el que espera el
     * sistema (D14), pero PNG/JPEG/GIF tambien los decodifica GD, asi que se
     * aceptan igual: si el navegador del comprador no sabe codificar WebP, el
     * `canvas.toBlob('image/webp')` cae a PNG **en silencio** y con un rechazo
     * estricto el comprador no podria comprar. Nunca se inventa el formato:
     * sale de los bytes, no del nombre que manda el cliente.
     * @return array{ext:string,mime:string}|null
     */
    public static function firma_imagen($bytes)
    {
        $b = (string)$bytes;
        $n = strlen($b);
        if ($n < 12) {
            return null;
        }
        if (substr($b, 0, 4) === 'RIFF' && substr($b, 8, 4) === 'WEBP') {
            return ['ext' => 'webp', 'mime' => 'image/webp'];
        }
        if (substr($b, 0, 8) === "\x89PNG\r\n\x1a\n") {
            return ['ext' => 'png', 'mime' => 'image/png'];
        }
        if (substr($b, 0, 3) === "\xFF\xD8\xFF") {
            return ['ext' => 'jpg', 'mime' => 'image/jpeg'];
        }
        if (substr($b, 0, 6) === 'GIF87a' || substr($b, 0, 6) === 'GIF89a') {
            return ['ext' => 'gif', 'mime' => 'image/gif'];
        }
        return null;
    }

    /**
     * Spec 026 (D3): puede el servidor **leer** WebP? El Motor (`Imagen::normalizar`)
     * solo decodifica WebP si hay GD con `imagecreatefromwebp`; sin GD, un WebP
     * seria un PDF ilegible. Es el mismo requisito que ya exige el smoke test
     * ("GD + WebP (cargador de imagenes)").
     *
     * @return bool
     */
    public static function servidor_lee_webp()
    {
        return extension_loaded('gd')
            && function_exists('imagecreatefromwebp')
            && function_exists('imagewebp');
    }

    /**
     * Spec 026 (D3): convierte los bytes de una imagen a **WebP** si el
     * servidor puede (GD con `imagewebp`). Es la **red de seguridad** para el
     * cliente que no sabe codificar WebP (`toBlob` cae a PNG en silencio).
     *
     * - Si los bytes **ya son** WebP -> se devuelven tal cual (D2: nunca se
     *   recomprime lo que ya viene comprimido).
     * - Si no hay GD o no hay `imagewebp` -> se devuelve el **original**
     *   (fail-safe: el flujo nunca se rompe).
     * - El **alfa se preserva** (`imagesavealpha` + `imagepalettetotruecolor`):
     *   verificado con GD (alfa 127 y 40 sobreviven la conversion).
     *
     * @param string $bytes
     * @param int $q calidad (0..100)
     * @return array{bytes:string,mime:string,ext:string,convertido:bool}
     */
    public static function convertir_webp($bytes, $q = 92)
    {
        $bytes = (string)$bytes;
        $firma = self::firma_imagen($bytes);
        if ($firma === null) {
            throw new Exception('motor:subida:formato:invalido');
        }
        $salida = [
            'bytes' => $bytes,
            'mime' => $firma['mime'],
            'ext' => $firma['ext'],
            'convertido' => false,
        ];
        if ($firma['ext'] === 'webp') {
            // Ya es WebP... pero si el servidor NO sabe leerlo, el Motor no
            // podria decodificarlo y el PDF saldria ILEGIBLE (D3, defensa en
            // profundidad). Mejor rechazar con una causa clara que guardar
            // roto. El cliente solo envia WebP si el servidor lo soporta
            // (`webp_soportado` en PMU_FICHA), asi que este caso es raro.
            if (!self::servidor_lee_webp()) {
                throw new Exception('motor:imagen:webp:no_soportado');
            }
            return $salida;
        }
        // Sin GD (o sin WebP): se guarda el original (D3, fail-safe).
        if (!self::servidor_lee_webp() || !function_exists('imagecreatefromstring')) {
            return $salida;
        }
        // El JPEG no tiene alfa: convertirlo a WebP perderia la transparencia
        // (D5). Se deja como esta.
        if ($firma['ext'] === 'jpg') {
            return $salida;
        }
        $img = @imagecreatefromstring($bytes);
        if (!$img) {
            return $salida;
        }
        if (function_exists('imagepalettetotruecolor') && !imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }
        // El alfa DEBE sobrevivir: sin esto el SMask del PDF se pierde.
        imagesavealpha($img, true);
        $tmp = tempnam(sys_get_temp_dir(), 'pmu_webp_');
        if ($tmp === false) {
            return $salida;
        }
        $ok = @imagewebp($img, $tmp, (int)max(1, min(100, (int)$q)));
        if ($ok) {
            $nuevo = @file_get_contents($tmp);
            if (is_string($nuevo) && $nuevo !== '') {
                $salida['bytes'] = $nuevo;
                $salida['mime'] = 'image/webp';
                $salida['ext'] = 'webp';
                $salida['convertido'] = true;
            }
        }
        @unlink($tmp);
        return $salida;
    }

    /**
     * Guarda una foto del comprador en `{item}/subidas/{id}.{ext}` y agrega su
     * fila a `manifest.subidas[]` (spec 012, T021, D14).
     *
     * El `id` lo genera el **servidor** (uuid corto): el cliente jamas propone
     * uno, asi que no puede elegir nombre ni salir de la carpeta. El formato sale
     * de la firma de los bytes (webp es el esperado; png/jpg/gif tambien valen,
     * ver `firma_imagen()`) y se convierte a WebP si el servidor puede (spec 026
     * D3). Devuelve ['id','file','mime','bytes'].
     */
    /**
     * Guarda el ORIGINAL del comprador (spec 035, D2/D3).
     *
     * Nace en `tmp/sesion-{sid}/uploads/{id}.{ext}`, COMPARTIDO por los items de la
     * sesion y deduplicado por `id` = 12 hex del sha1 de los bytes CRUDOS: una foto
     * usada en 3 items se guarda una vez y probar encuadres no reenvia nada.
     *
     * `$item_key` se conserva porque la fila `origen: original` vive en el manifest
     * del item que la usa (varios items de la sesion la comparten por `id`).
     * `$params` son los PARAMS v2 de la receta (spec 035 D9): el servidor deriva el
     * hash y lo estampa en la fila. Es lo unico con lo que `Compositor` recompone.
     *
     * @return array fila de `manifest.subidas[]` + `w`/`h` del original guardado
     */
    /**
     * Spec 040 (T006): alta/refresco de la entrada en el catalogo de la carpeta y
     * miniatura 80x80. La receta se guarda por contexto si corresponde.
     *
     * El catalogo es la fuente de la biblioteca: si su escritura falla, la foto
     * quedaria invisible, asi que la excepcion se propaga con causa.
     */
    private function catalogo_de_subida($dir, $id, $ext, $ruta, $med, $paramsV2, $receta)
    {
        $ahora = time();
        $entrada = [
            'ext' => (string)$ext,
            'bytes' => (int)@filesize($ruta),
            'w' => is_array($med) ? (int)$med[0] : 0,
            'h' => is_array($med) ? (int)$med[1] : 0,
            'creado' => $ahora,
            'ultimo_uso' => $ahora,
        ];
        // Spec 045: el catalogo guarda objetivo -> delta (no la v2 completa) y la
        // ultima receta aceptada (`ajustes` = {objetivo, configuracion}).
        if (is_array($paramsV2) && $paramsV2) {
            $objetivo = self::clave_receta($paramsV2);
            if ($objetivo !== '') {
                $delta = self::receta_delta($paramsV2);
                $entrada['recetas'] = array($objetivo => $delta);
                $entrada['ajustes'] = array('objetivo' => $objetivo, 'configuracion' => $delta);
            }
        }
        $this->motor->catalogo_upsert($dir, $id, $entrada);
        // Best-effort: si la miniatura no se puede generar, la tira usara el original.
        $this->motor->miniatura_generar($ruta, 80);
    }

    /**
     * Clave de contexto de una receta: `"{gid}-{w}x{h}-{phsize}"` (spec 040 D5).
     * `''` si no alcanza para identificar el lienzo.
     */
    private static function clave_receta(array $params)
    {
        $w = (int)($params['w'] ?? 0);
        $h = (int)($params['h'] ?? 0);
        if ($w < 1 || $h < 1) {
            return '';
        }
        // Spec 045: `{aspecto 4 dec}-{familia 0|1}-{area}`. El `gid` ya no entra:
        // la receta se reutiliza entre campos (el grupo es contexto de PDF).
        $aspecto = number_format($w / $h, 4, '.', '');
        $forma = strtolower((string)($params['forma'] ?? ''));
        $familia = in_array($forma, array('circulo', 'ovalo'), true) ? 1 : 0;
        return $aspecto . '-' . $familia . '-' . ($w * $h);
    }

    /**
     * Spec 045 (T004): delta de la configuracion respecto del default
     * (`modo: cubrir`, escala 1, centro 0.5/0.5, rot 0, fondo auto, sin transp).
     * Solo incluye lo que cambia: es lo que se guarda en el catalogo.
     */
    public static function receta_delta(array $params)
    {
        $delta = array('modo' => (string)($params['modo'] ?? 'cubrir'));
        $escala = (float)($params['escala'] ?? 1);
        if (abs($escala - 1.0) > 0.0001) { $delta['zoom'] = $escala; }
        $rot = ((int)($params['rot'] ?? 0)) % 360;
        if ($rot !== 0) { $delta['rot'] = $rot; }
        $ox = (float)($params['ox'] ?? 0.5);
        if (abs($ox - 0.5) > 0.0001) { $delta['ox'] = $ox; }
        $oy = (float)($params['oy'] ?? 0.5);
        if (abs($oy - 0.5) > 0.0001) { $delta['oy'] = $oy; }
        $fondo = strtolower((string)($params['fondo'] ?? ''));
        if ($fondo !== '' && $fondo !== 'auto' && $fondo !== 'transparent') {
            $delta['fondo'] = (string)($params['fondo'] ?? '');
        }
        $transp = strtolower((string)($params['transp'] ?? ''));
        if ($transp === 'si' || $transp === 'no') { $delta['transp'] = $transp; }
        return $delta;
    }

    public function guardar_subida($sid, $item_key, $bytes, $params = [])
    {
        $bytes = (string)$bytes;
        if ($bytes === '' || strlen($bytes) > self::TOPE_SUBIDA_BYTES) {
            throw new Exception('motor:subida:vacia');
        }
        if (self::firma_imagen($bytes) === null) {
            throw new Exception('motor:subida:formato:invalido');
        }
        // Spec 030 (D24): el `sha` es del contenido CRUDO, ANTES de convertir ni
        // reescalar (ninguna de las dos es determinista entre versiones).
        $sha = sha1($bytes);
        $id = substr($sha, 0, 12);
        // Spec 035 (D9/T024): la RECETA del recorte viaja con la subida (`params`) y se
        // guarda en la fila con sus PARAMS v2 canonizados. Es lo que permite declarar
        // la composicion por `id` (`registrar_fotos`) sin que el cliente la repita por
        // instancia, y lo unico con lo que `Compositor` puede recomponer (el hash es
        // irreversible).
        $receta = '';
        $paramsV2 = [];
        if (is_array($params) && $params) {
            $receta = self::receta_de($params);
            if ($receta !== '') {
                try {
                    $paramsV2 = self::receta_validar($params);
                } catch (Exception $e) {
                    $receta = '';
                    $paramsV2 = [];
                }
            }
        }
        // Spec 035 (D2): el cap de 2000 px se REVALIDA en el servidor.
        $bytes = self::acotar_original($bytes);
        // Spec 026 (D3): el servidor convierte a WebP si puede (q0.85: la foto del
        // comprador es unseen y el ahorro es ~10x).
        $img = self::convertir_webp($bytes, 85);
        $clave = (function_exists('get_current_user_id') ? (int) get_current_user_id() : 0);
        // Spec 040 (T006): la subida va a la carpeta de la IDENTIDAD (cliente -> orders/{uid};
        // invitado -> tmp/sesion-{sid}), no siempre a la sesion.
        $dir = $this->motor->dir_uploads_identidad(['uid' => $clave, 'sid' => $sid]);
        $ruta = $dir . DIRECTORY_SEPARATOR . $id . '.' . $img['ext'];
        if (!is_file($ruta) && @file_put_contents($ruta, $img['bytes']) === false) {
            throw new Exception('motor:dir_sesion_uploads:directorio:no_escribible');
        }
        $med = @getimagesize($ruta);
        // Spec 040 (T006): alta/refresh en el catalogo de la identidad + miniatura.
        $this->catalogo_de_subida($dir, $id, $img['ext'], $ruta, $med, $paramsV2, $receta);
        $fila = null;
        $this->mutar_manifest($sid, $item_key,
            function (&$manifest) use ($item_key, $id, $sha, $img, $ruta, $receta, $paramsV2, $med, &$fila) {
                if ((string)($manifest['item_key'] ?? '') !== (string)$item_key) {
                    throw new Exception('motor:sesion:item:ausente');
                }
                $filas = isset($manifest['subidas']) && is_array($manifest['subidas'])
                    ? array_values($manifest['subidas']) : [];
                // Dedupe: la misma foto N veces en el item deja UNA fila.
                foreach ($filas as $i => $s) {
                    if (is_array($s) && (string)($s['id'] ?? '') === $id) {
                        $filas[$i]['mime'] = $img['mime'];
                        $filas[$i]['bytes'] = (int)@filesize($ruta);
                        $filas[$i]['sha'] = $sha;
                        // Spec 040 (F4): w/h en la FILA (no solo en el retorno): asi
                        // `imagenes()` no abre cada archivo con `getimagesize` en cada
                        // listado de la biblioteca.
                        $filas[$i]['w'] = is_array($med) ? (int)$med[0] : 0;
                        $filas[$i]['h'] = is_array($med) ? (int)$med[1] : 0;
                        // La receta vigente es la ULTIMA que se acepto: es la que el
                        // comprador ve al agregar al carrito.
                        if ($receta !== '') {
                            $filas[$i]['receta'] = $receta;
                            $filas[$i]['params'] = $paramsV2;
                        }
                        $manifest['subidas'] = $filas;
                        $fila = $filas[$i];
                        return;
                    }
                }
                $nueva = $this->fila_subida($id, '', $receta, $sha, $img['mime'],
                    (int)@filesize($ruta), time(), 'original', $paramsV2);
                // Spec 040 (F4): las medidas se PERSISTEN con la fila.
                $nueva['w'] = is_array($med) ? (int)$med[0] : 0;
                $nueva['h'] = is_array($med) ? (int)$med[1] : 0;
                $filas[] = $nueva;
                $manifest['subidas'] = $filas;
                $fila = $nueva;
            });
        $fila['w'] = is_array($med) ? (int)$med[0] : 0;
        $fila['h'] = is_array($med) ? (int)$med[1] : 0;
        return $fila;
    }

    /** Lado maximo del original (espejo del cap del cliente, spec 035 D2). */
    const LADO_MAX = 2000;

    /**
     * Revalida el cap de 2000 px del original (spec 035, D2).
     *
     * El cliente ya acota, pero puede mentir. Con GD se reescala con factor
     * UNIFORME (nunca deforma); sin GD no se puede reescalar y se rechaza con causa:
     * guardar una foto gigante "porque el cliente dijo que estaba bien" no es una
     * opcion.
     */
    private static function acotar_original($bytes)
    {
        $med = @getimagesizefromstring($bytes);
        if (!is_array($med) || (int)$med[0] < 1 || (int)$med[1] < 1) {
            return $bytes;
        }
        $w0 = (int)$med[0];
        $h0 = (int)$med[1];
        if ($w0 <= self::LADO_MAX && $h0 <= self::LADO_MAX) {
            return $bytes;
        }
        if (!extension_loaded('gd') || !function_exists('imagewebp')) {
            throw new Exception('motor:subida:tamano');
        }
        $src = @imagecreatefromstring($bytes);
        if ($src === false) {
            throw new Exception('motor:subida:formato:invalido');
        }
        $k = self::LADO_MAX / max($w0, $h0);
        $w = max(1, (int)round($w0 * $k));
        $h = max(1, (int)round($h0 * $k));
        $dst = imagecreatetruecolor($w, $h);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagefilledrectangle($dst, 0, 0, $w - 1, $h - 1,
            imagecolorallocatealpha($dst, 0, 0, 0, 127));
        imagealphablending($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, $w0, $h0);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        ob_start();
        $ok = imagewebp($dst, null, 85);
        $out = ob_get_clean();
        if (!$ok || $out === false || $out === '') {
            throw new Exception('motor:subida:tamano');
        }
        return $out;
    }

    /**
     * Resuelve ids de subida contra `manifest.subidas[]` (spec 012, T027).
     * Un id que no este en el manifest NO se resuelve: devuelve null y el
     * llamador avisa. Nunca se construye una ruta a partir del id del cliente.
     * @return array<string,string> id => ruta absoluta
     */
    public function resolver_subidas($sid, $item_key, array $ids)
    {
        $manifest = $this->leer_manifest($sid, $item_key);
        if (!is_array($manifest)) {
            return [];
        }
        $porId = [];
        foreach ((array)($manifest['subidas'] ?? []) as $fila) {
            if (!is_array($fila) || !isset($fila['id'])) {
                continue;
            }
            if (isset($fila['ref']) && (string)$fila['ref'] !== '') {
                $porId[(string)$fila['id']] = ['ref' => (string)$fila['ref']];
            } elseif ((string)($fila['origen'] ?? '') === 'original') {
                // Spec 035: la fila lleva SOLO `id`; la ubicacion la resuelve el servidor.
                $porId[(string)$fila['id']] = ['original' => true];
            } elseif (isset($fila['file']) && (string)$fila['file'] !== '') {
                $porId[(string)$fila['id']] = ['file' => (string)$fila['file']];
            }
        }
        // `subidas/` solo existe en items LEGADOS: los nuevos guardan el original en
        // `tmp/sesion-{sid}/uploads/` (compartido) y la composicion en `img/`.
        $dirSub = $this->dir_subidas($sid, $item_key, false);
        $out = [];
        foreach ($ids as $id) {
            $id = (string)$id;
            if ($id === '' || !isset($porId[$id])) {
                continue;
            }
            // Spec 030 (D13): una fila `ref` vive FUERA del item (`orders/`): se resuelve
            // contra `uploads/pmu/` en vez de `subidas/`.
            if (isset($porId[$id]['ref'])) {
                $rutaRef = $this->resolver_ref($this->dir_item($sid, $item_key), $porId[$id]['ref']);
                if ($rutaRef !== '') {
                    $out[$id] = $rutaRef;
                }
                continue;
            }
            if (isset($porId[$id]['original'])) {
                $ruta = $this->resolver_original($id, (string)($manifest['cliente'] ?? ''), $sid);
                if ($ruta !== '') {
                    $out[$id] = $ruta;
                }
                continue;
            }
            $out[$id] = $dirSub . DIRECTORY_SEPARATOR . basename($porId[$id]['file']);
        }
        return $out;
    }

    /**
     * Resuelve un ORIGINAL por `id` en la CADENA de ubicaciones (spec 035, D4).
     *
     * `orders/{clave}/uploads/{id}.*` (fija: ya pagado) -> `tmp/sesion-{sid}/uploads/{id}.*`
     * (temporal). La fila lleva SOLO `id`: la ubicacion la decide el servidor, asi
     * promover no reescribe ninguna fila.
     *
     * Devuelve cadena vacia si no esta en ninguna: el llamador deja el hueco
     * transparente con `motor:original:ausente`, nunca un PDF roto.
     */
    public function resolver_original($id, $clave = '', $sid = '')
    {
        $id = strtolower(trim((string)$id));
        if (!preg_match('/^[a-f0-9]{12}$/', $id)) {
            return '';
        }
        // Spec 035 (D4/T027): la clave valida es el helper UNICO (`clave_valida`):
        // el arbol es `orders/{clave}/uploads/` y `0` (invitado) no tiene carpeta.
        $clave = trim((string)$clave);
        if (PMU_Uploads::clave_valida($clave)) {
            $ruta = $this->archivo_con_extension(
                $this->motor->dir_order_uploads($clave) . DIRECTORY_SEPARATOR . $id
            );
            if ($ruta !== '') {
                return $ruta;
            }
        }
        if ((string)$sid !== '') {
            try {
                $dir = $this->motor->dir_sesion_uploads($sid, false);
            } catch (Exception $e) {
                return '';
            }
            $ruta = $this->archivo_con_extension($dir . DIRECTORY_SEPARATOR . $id);
            if ($ruta !== '') {
                return $ruta;
            }
        }
        return '';
    }

    /**
     * Spec 039 (D3): borra la fila de `manifest.subidas[]` de un item y, si NINGUN
     * otro item de la sesion referencia ese `id`, borra el archivo compartido
     * `tmp/sesion-{sid}/uploads/{id}.{ext}`.
     *
     * Reglas (contrato `specs/039-cargas-friccion/spec.md` D3):
     *  - **Idempotente**: si el id no esta en el item, responde `no_hacia_nada: true`.
     *  - **Compartido**: el original lo pueden usar varios items de la sesion; solo se
     *    borra el archivo cuando el `id` ya no aparece en NINGUN manifest de la sesion.
     *  - **`orders/` intacto**: nunca toca lo comprado (C5 de la 035). Si el original ya
     *    se movio a `orders/`, aca no hay archivo que borrar (y no se busca ahi).
     *  - **Sin `orders/`**: `resolver_original` cubre la cadena orders -> tmp; aca solo
     *    borramos la copia de `tmp/` (la de `orders/` es del pedido, no del draft).
     *
     * @return array{borrado: bool, no_hacia_nada: bool, filas: int, archivo: bool}
     */
    public function borrar_original_item($sid, $item_key, $id)
    {
        $sid = trim((string)$sid);
        $item_key = trim((string)$item_key);
        $id = strtolower(trim((string)$id));
        $salida = ['borrado' => false, 'no_hacia_nada' => true, 'filas' => 0, 'archivo' => false];
        if ($sid === '' || $item_key === '' || !preg_match('/^[a-f0-9]{12}$/', $id)) {
            return $salida;
        }

        // 1) Quita la fila del item (idempotente: si no estaba, no hay nada que hacer).
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($id, &$salida) {
            $filas = isset($manifest['subidas']) && is_array($manifest['subidas'])
                ? array_values($manifest['subidas']) : [];
            $quedan = [];
            $quitadas = 0;
            foreach ($filas as $fila) {
                if (is_array($fila) && (string)($fila['id'] ?? '') === $id) {
                    $quitadas++;
                    continue;
                }
                $quedan[] = $fila;
            }
            if ($quitadas > 0) {
                $manifest['subidas'] = $quedan;
                $salida['filas'] = $quitadas;
                $salida['no_hacia_nada'] = false;
                $salida['borrado'] = true;
            }
        });

        if ($salida['no_hacia_nada']) {
            return $salida;
        }

        // 2) ¿Algún OTRO item de la sesion sigue referenciando el id? Si si, el
        //    archivo compartido se conserva (C3 de la 035).
        $referencias = $this->referencias_subidas_sesion($sid, $id);
        if (!empty($referencias['otros'])) {
            return $salida;   // compartido: se borro la fila, el archivo queda
        }

        // 3) Borra el archivo de `tmp/sesion-{sid}/uploads/{id}.{ext}` (si existe).
        try {
            $dir = $this->motor->dir_sesion_uploads($sid, false);
            $ruta = $this->archivo_con_extension($dir . DIRECTORY_SEPARATOR . $id);
            if ($ruta !== '' && is_file($ruta)) {
                if (@unlink($ruta)) {
                    $salida['archivo'] = true;
                }
            }
        } catch (Exception $e) {
            // Sin carpeta: no hay archivo que borrar (ya se borro o nunca existio).
        }
        return $salida;
    }

    /**
     * Spec 040 (T021): referencias de una imagen en items de CARRITO y en PEDIDOS.
     *
     * "Carrito" = items de la sesion que NO son borradores (`draft-*`): un borrador
     * todavia no esta en el carrito, asi que no cuenta (Decision 2026-11-19).
     * "Pedidos" = items del arbol del cliente (`orders/{uid}/{order_id}/{item}`).
     *
     * @return array{carrito:int, pedidos:int}
     */
    public function referencias_en_carrito_o_pedidos($sid, $id, $clave = '')
    {
        $fuera = ['carrito' => 0, 'pedidos' => 0];
        $id = strtolower(trim((string)$id));
        if (preg_match('/^[a-f0-9]{12}$/', $id) !== 1) {
            return $fuera;
        }
        // Carrito: items de la sesion (sin borradores) que referencian el id.
        // Sin `sid` (poda del arbol del cliente) no hay sesion que mirar.
        if ((string)$sid !== '') {
            $raiz = $this->motor->dir_sesion($sid, false);
            foreach ((array)glob($raiz . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $itemDir) {
                if (strpos(basename($itemDir), 'draft-') === 0) {
                    continue;   // borrador: todavia no es carrito
                }
                $man = $this->leer_manifest_dir($itemDir);
                if ($this->filaReferenciaId($man, $id)) {
                    $fuera['carrito']++;
                }
            }
        }
        // Pedidos: items del arbol del cliente.
        $clave = trim((string)$clave);
        if (PMU_Uploads::clave_valida($clave)) {
            $raizPed = $this->motor->dir_ambito('orders') . DIRECTORY_SEPARATOR . (int)$clave;
            foreach ((array)glob($raizPed . DIRECTORY_SEPARATOR . '*' . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $itemDir) {
                if (!is_dir($itemDir) || !is_file($itemDir . DIRECTORY_SEPARATOR . 'manifest.json')) {
                    continue;
                }
                $man = $this->leer_manifest_dir($itemDir);
                if ($this->filaReferenciaId($man, $id)) {
                    $fuera['pedidos']++;
                }
            }
        }
        return $fuera;
    }

    /** ¿El manifest tiene una fila `subidas[]` con este `id`? */
    private function filaReferenciaId($manifest, $id)
    {
        foreach ((array)(is_array($manifest) ? ($manifest['subidas'] ?? []) : []) as $fila) {
            if (is_array($fila) && (string)($fila['id'] ?? '') === $id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Spec 040 (T021): borra una imagen de la GALERIA (original + miniatura +
     * entrada de catalogo). Es el borrado que pide confirmacion cuando la imagen
     * esta en carrito o en un pedido; la decision la toma el llamador.
     *
     * @return array{borrado:bool, archivo:bool, catalogo:bool}
     */
    public function borrar_imagen_galeria($sid, $id, $clave = '')
    {
        $salida = ['borrado' => false, 'archivo' => false, 'catalogo' => false];
        $id = strtolower(trim((string)$id));
        if (preg_match('/^[a-f0-9]{12}$/', $id) !== 1) {
            return $salida;
        }
        $ruta = $this->resolver_original($id, trim((string)$clave), $sid);
        if ($ruta === '' || !is_file($ruta)) {
            return $salida;
        }
        $dir = dirname($ruta);
        $ext = strtolower((string)pathinfo($ruta, PATHINFO_EXTENSION));
        $base = ($ext !== '') ? substr($ruta, 0, -(strlen($ext) + 1)) : $ruta;
        $mini = $base . '-80x80.webp';
        $salida['archivo'] = @unlink($ruta);
        if (is_file($mini)) {
            @unlink($mini);
        }
        try {
            $this->motor->catalogo_borrar($dir, $id);
            $salida['catalogo'] = true;
        } catch (\Throwable $e) {
            // El catalogo se reconstruye desde los archivos: no bloquea el borrado.
        }
        $salida['borrado'] = true;
        return $salida;
    }

    /**
     * Spec 040 (T018/T031): migra los originales de la sesion anonima a la carpeta del
     * cliente al iniciar sesion. Idempotente: lo que ya esta en destino se descarta.
     *
     * Fusiona el catalogo (el destino gana en conflicto) y mueve originales y
     * miniaturas; al final retira el catalogo de la sesion, que ya quedo fusionado.
     *
     * @return int archivos movidos
     */
    public function migrar_uploads_a_cliente($sid, $uid)
    {
        $uid = (int)$uid;
        if (!PMU_Uploads::clave_valida((string)$uid)) {
            return 0;
        }
        $src = $this->motor->dir_sesion_uploads($sid, false);
        if (!is_dir($src)) {
            return 0;
        }
        $dst = $this->motor->dir_order_uploads($uid, true);
        // 1) Catalogos: merge entry por entry (el destino gana).
        $catSrc = $this->motor->catalogo_leer($src);
        if (is_array($catSrc)) {
            foreach ((array)($catSrc['items'] ?? []) as $id => $it) {
                if (!is_array($it)) {
                    continue;
                }
                try {
                    $this->motor->catalogo_upsert($dst, (string)$id, $it);
                } catch (\Throwable $e) {
                    // Best-effort: el catalogo se reconstruye desde los archivos.
                }
            }
        }
        // 2) Archivos: originales + miniaturas (`{id}.ext` y `{id}-80x80.webp`).
        $movidos = 0;
        foreach ((array)glob($src . DIRECTORY_SEPARATOR . '*') as $archivo) {
            if (!is_file($archivo)) {
                continue;
            }
            $nombre = basename($archivo);
            if ($nombre === PMU_Uploads::CATALOGO_UPLOADS || $nombre === PMU_Uploads::LOCK_UPLOADS) {
                continue;
            }
            $destino = $dst . DIRECTORY_SEPARATOR . $nombre;
            if (is_file($destino)) {
                @unlink($archivo);   // mismo id = mismo contenido
                continue;
            }
            if (@rename($archivo, $destino)) {
                $movidos++;
            } else {
                @copy($archivo, $destino);
                @unlink($archivo);
                $movidos++;
            }
        }
        // 3) El catalogo de la sesion ya se fusiono: se retira.
        if (is_array($catSrc)) {
            @unlink($this->motor->ruta_catalogo_uploads($src));
        }
        return $movidos;
    }

    /**
     * Spec 039 (D5): envoltorio PUBLICO de `ruta_fila_subida()` (privado) para que el
     * handler resuelva una fila del `listar` por `id` sin duplicar la logica de rutas.
     *
     * @param array $contenedor entrada del escaneo (con `dir`/`manifest`)
     * @param array $fila       fila de `subidas[]`
     * @return string ruta absoluta o '' si no existe
     */
    public function ruta_fila_subida_public(array $contenedor, array $fila)
    {
        return $this->ruta_fila_subida($contenedor, $fila);
    }

    /**
     * Spec 039 (D3): cuenta en cuantos items de la sesion aparece un `id` de subida.
     *
     * Devuelve `['total' => N, 'otros' => M]` donde `otros` excluye el item que se
     * esta editando (`$item_key_excluido`). Recorre los `manifest.json` de los items
     * de `tmp/sesion-{sid}/`.
     */
    private function referencias_subidas_sesion($sid, $id, $item_key_excluido = '')
    {
        $sid = trim((string)$sid);
        $id = strtolower(trim((string)$id));
        $excluido = trim((string)$item_key_excluido);
        $total = 0;
        $otros = 0;
        if ($sid === '' || $id === '') {
            return ['total' => 0, 'otros' => 0];
        }
        try {
            $dirSesion = $this->motor->dir_sesion($sid, false);
        } catch (Exception $e) {
            return ['total' => 0, 'otros' => 0];
        }
        foreach ((array)glob($dirSesion . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $dirItem) {
            $item = basename($dirItem);
            if ($item === 'uploads' || $item === 'customs') {
                continue;   // no son items
            }
            if ($excluido !== '' && $item === $excluido) {
                continue;   // el que estamos editando: su fila ya la sacamos
            }
            $manifest = $this->leer_manifest($sid, $item);
            if (!is_array($manifest)) {
                continue;
            }
            foreach ((array)($manifest['subidas'] ?? []) as $fila) {
                if (is_array($fila) && (string)($fila['id'] ?? '') === $id) {
                    $total++;
                    $otros++;
                    break;   // una fila por item alcanza para contar la referencia
                }
            }
        }
        return ['total' => $total, 'otros' => $otros];
    }

    /**
     * Spec 035 (T024): materializa en el pool las composiciones que FALTAN.
     *
     * El nombre (`img/foto-{pdf}-{grupo}-{receta}.webp`) es DETERMINISTA por
     * receta, asi que **el nombre es el cache**: si el archivo esta, no se
     * recompone, y dos items con el mismo encuadre comparten los mismos bytes.
     *
     * Los bytes los produce `Compositor` desde el ORIGINAL y los params v2 que la
     * fila guardo al aceptar el recorte. Sin original (o sin params) la instancia
     * se OMITE y se cuenta: el hueco queda transparente, nunca un PDF roto.
     *
     * @return array{creadas: int, faltantes: int}
     */
    public function materializar_composiciones($clave, $sid, $dirItem, array $manifest, $pdf)
    {
        $creadas = 0;
        $faltantes = 0;
        foreach ((array)($manifest['archivos'] ?? []) as $fila) {
            if (!is_array($fila) || (string)($fila['pdf'] ?? '') !== (string)$pdf) {
                continue;
            }
            if ((string)($fila['origen'] ?? '') !== 'compuesta') {
                continue;   // el texto ya vive en el pool: no se compone
            }
            $rel = (string)($fila['file'] ?? '');
            if ($rel === '') {
                continue;
            }
            $destino = $dirItem . DIRECTORY_SEPARATOR
                . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $rel);
            if (is_file($destino)) {
                continue;   // el nombre es el cache
            }
            $orig = (array)($fila['orig'] ?? []);
            $id = strtolower((string)($orig['id'] ?? ''));
            $params = (array)($orig['params'] ?? []);
            if ($id === '' || !$params) {
                $faltantes++;
                continue;
            }
            $rutaOrig = $this->resolver_original($id, $clave, $sid);
            if ($rutaOrig === '') {
                $faltantes++;
                continue;
            }
            try {
                $bytes = \ExtractCorel\Engine\Compositor::componer($rutaOrig, self::receta_validar($params));
            } catch (\Throwable $e) {
                $faltantes++;
                continue;
            }
            $carpeta = dirname($destino);
            if (!is_dir($carpeta)) {
                wp_mkdir_p($carpeta);
            }
            if (@file_put_contents($destino, $bytes) === false) {
                $faltantes++;
                continue;
            }
            $creadas++;
        }
        return ['creadas' => $creadas, 'faltantes' => $faltantes];
    }

    /** Primer `{base}.{ext}` que exista (el `id` no lleva extension). */
    private function archivo_con_extension($baseSinExt)
    {
        foreach ((array)glob($baseSinExt . '.*') as $ruta) {
            if (is_file($ruta)) {
                return $ruta;
            }
        }
        return '';
    }

    /**
     * Spec 035 (§3.5): guarda las vistas que el comprador REALMENTE vio.
     *
     * Es DISTINTO de `mockup_vistas`, que son las que se CONGELARON (todas las que
     * el cliente alcanzo a renderizar, las haya mirado o no). Solo esta lista sirve
     * para no volver a exigir lo ya revisado cuando el item cambia de clave.
     *
     * @return array la lista normalizada (vacia si no habia nada usable)
     */
    public function anotar_vistos($sid, $item_key, array $ids)
    {
        $limpios = [];
        foreach ($ids as $id) {
            $id = trim((string)$id);
            // Forma ESTRICTA de un id de mockup. OJO: `item_seguro()` no sirve aca
            // porque NO lanza con una ruta: la SANEA (`../../etc/passwd` ->
            // `etc-passwd`) y guardaria basura como si fuera una vista. La marca vive
            // en el cliente (no es una frontera de seguridad), pero el manifest no
            // tiene por que ensuciarse.
            if ($id === '' || preg_match('/^[A-Za-z0-9_-]{1,40}$/', $id) !== 1) {
                continue;
            }
            if (!in_array($id, $limpios, true)) {
                $limpios[] = $id;
            }
        }
        if (!$limpios) {
            return [];
        }
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($limpios) {
            $previos = isset($manifest['vistos']) && is_array($manifest['vistos']) ? $manifest['vistos'] : [];
            $manifest['vistos'] = array_values(array_unique(array_merge($previos, $limpios)));
        });
        return $limpios;
    }

    /** Congela la vista aprobada: mockup-{id}.webp (300x300) en el item. */
    public function congelar_webp($sid, $item_key, $mockup_id, $bytes)
    {
        $mockup_id = $this->motor->item_seguro($mockup_id, 'sesion:congelar_webp');
        if ($bytes === null || $bytes === '') {
            throw new Exception('motor:sesion:webp:vacio');
        }
        $dir = $this->motor->dir_sesion_item($sid, $item_key, true);
        if (@file_put_contents($dir . DIRECTORY_SEPARATOR . 'mockup-' . $mockup_id . '.webp', $bytes) === false) {
            throw new Exception('motor:sesion:directorio:no_escribible');
        }
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($mockup_id) {
            $vistas = isset($manifest['mockup_vistas']) && is_array($manifest['mockup_vistas']) ? $manifest['mockup_vistas'] : [];
            if (!in_array($mockup_id, $vistas, true)) {
                $vistas[] = $mockup_id;
            }
            $manifest['mockup_vistas'] = array_values($vistas);
            $manifest['mockup_visto'] = $mockup_id;
        });
        return $dir . DIRECTORY_SEPARATOR . 'mockup-' . $mockup_id . '.webp';
    }

    /**
     * Recorta el pool al snapshot vigente (spec 005/T009). Las filas de PDFs
     * excluidos salen de `archivos[]` y sus PNG se borran; las filas aceptadas
     * se conservan para que la regeneracion parcial siga reutilizandolas.
     */
    public function pool_filtrar_pdfs($sid, $item_key, array $pdfs)
    {
        $aceptados = [];
        foreach ($pdfs as $pdf) {
            $aceptados[(string)$this->motor->nombre_seguro($pdf, 'sesion:pool_filtrar_pdfs')] = true;
        }
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($sid, $item_key, $aceptados) {
            $imgDir = $this->dir_item($sid, $item_key) . DIRECTORY_SEPARATOR . 'img';
            $resto = [];
            foreach ((array)($manifest['archivos'] ?? []) as $fila) {
                $pdf = is_array($fila) ? (string)($fila['pdf'] ?? '') : '';
                if ($pdf !== '' && !isset($aceptados[$pdf])) {
                    if (!empty($fila['file']) && is_dir($imgDir)) {
                        @unlink($imgDir . DIRECTORY_SEPARATOR . basename((string)$fila['file']));
                    }
                    continue;
                }
                $resto[] = $fila;
            }
            $manifest['archivos'] = $resto;
        });
    }

    /** Estado de preview del item: ok | sin_vista | omisible. */
    public function estado_preview($sid, $item_key)
    {
        $manifest = $this->leer_manifest($sid, $item_key);
        $estado = is_array($manifest) ? (string)($manifest['preview_estado'] ?? '') : '';
        if ($estado !== self::ESTADO_OK && $estado !== self::ESTADO_SIN_VISTA && $estado !== self::ESTADO_OMISIBLE) {
            return self::ESTADO_SIN_VISTA;
        }
        return $estado;
    }

    /* ==================== Biblioteca de imagenes (spec 030, D1) ==================== */

    /* (spec 039 D5: `familias()` RETIRADO. El modelo "familias" murio: la identidad
     *  es el `id` (sha12 del contenido) y la vista del cliente lista **imagenes**
     *  con `imagenes()`, no familias.) */

    /**
     * Spec 039 (D5): **imagenes** del comprador a partir de los CONTENEDORES del escaneo
     * (sesiones + pedidos): **una entrada por imagen** (`id`), no por familia.
     *
     * Reemplaza a `familias()` en la vista del cliente: el modelo "familias" murio con
     * la 030 (la identidad es el `id` = sha1 del contenido, D24 de la 035). Cada fila
     * trae `id`, `url`, `thumb`, `recetas[]`, `params`, `bytes`, `w`, `h` y `creado`.
     * `params` son los v2 de la ULTIMA receta (spec 040 A3) para recordar el encuadre;
     * `thumb` es una miniatura real (spec 040 A2), distinta de la imagen completa.
     *
     * @param array $contenedores escaneo (cada uno con `manifest` y `dir`)
     * @param callable|null $url    inyecta la URL protegida por `id` (politica del plugin)
     * @param callable|null $thumb  inyecta la URL de la MINIATURA (cae a `$url` si falta)
     * @return array lista por fecha descendente (mas nuevas primero)
     */
    public function imagenes(array $contenedores, ?callable $url = null, ?callable $thumb = null)
    {
        $vistas = [];
        foreach ($contenedores as $c) {
            foreach ((array)($c['manifest']['subidas'] ?? []) as $fila) {
                if (!is_array($fila) || !isset($fila['id'])) {
                    continue;
                }
                $id = (string)$fila['id'];
                $ruta = $this->ruta_fila_subida($c, $fila);
                if ($ruta === '') {
                    continue;
                }
                $w = (int)($fila['w'] ?? 0);
                $h = (int)($fila['h'] ?? 0);
                if ($w < 1 || $h < 1) {
                    $dim = @getimagesize($ruta);
                    $w = is_array($dim) ? (int)$dim[0] : 0;
                    $h = is_array($dim) ? (int)$dim[1] : 0;
                }
                // La MISMA imagen puede estar en varios contenedores (carrito + pedido):
                // se muestra UNA vez (la vista mas reciente gana) y se suman los usos.
                $receta = (string)($fila['receta'] ?? '');
                $creado = (int)($fila['creado'] ?? 0);
                $paramsFila = (isset($fila['params']) && is_array($fila['params']) && $fila['params']) ? $fila['params'] : null;
                if (!isset($vistas[$id])) {
                    $vistas[$id] = [
                        'id' => $id,
                        'url' => ($url ? (string)$url($id) : ''),
                        // Spec 040 (A2): `thumb` es una MINIATURA real (endpoint propio) y
                        // NO la imagen completa: la tira bajaba N fotos enteras y tardaba.
                        'thumb' => ($thumb ? (string)$thumb($id) : ($url ? (string)$url($id) : '')),
                        'recetas' => [],
                        // Spec 040 (A3): params v2 de la ULTIMA receta de esta imagen, para
                        // recordar el encuadre al re-elegirla (el hash de `recetas` no sirve:
                        // es irreversible).
                        'params' => $paramsFila,
                        'params_creado' => ($paramsFila !== null) ? $creado : -1,
                        'bytes' => (int)@filesize($ruta),
                        'w' => $w,
                        'h' => $h,
                        'creado' => $creado,
                    ];
                } else {
                    $vistas[$id]['bytes'] = max((int)$vistas[$id]['bytes'], (int)@filesize($ruta));
                    if ($creado > (int)$vistas[$id]['creado']) {
                        $vistas[$id]['creado'] = $creado;
                    }
                }
                if ($receta !== '' && !in_array($receta, (array)$vistas[$id]['recetas'], true)) {
                    $vistas[$id]['recetas'][] = $receta;
                }
                if ($paramsFila !== null && $creado >= (int)$vistas[$id]['params_creado']) {
                    $vistas[$id]['params'] = $paramsFila;
                    $vistas[$id]['params_creado'] = $creado;
                }
            }
        }
        $out = array_values($vistas);
        foreach ($out as $i => $v) {
            unset($out[$i]['params_creado']);
        }
        usort($out, function ($a, $b) {
            return (int)$b['creado'] - (int)$a['creado'];
        });
        return $out;
    }

    /* (spec 039 D5: `familia_por_sha()`, `familia_de()` y `ruta_familia()` RETIRADOS.
     *  El dedupe por contenido ya no pasa por la familia: el `id` = sha12 es la
     *  identidad y `guardar_subida()` reusa la fila por `id` (C7 de la 035).) */

    /* ==================== Borrado y ciclo de pedido ==================== */

    /** Borrado quirurgico del item (al quitarlo del carrito). Idempotente. */
    public function borrar_item($sid, $item_key)
    {
        $dir = $this->motor->dir_sesion_item($sid, $item_key);
        if (!is_dir($dir)) {
            return;
        }
        $this->borrar_arbol($dir);
    }

    /**
     * Traslada los ORIGINALES que el item referencia a `orders/{clave}/uploads/`
     * (spec 035, D5). Idempotente: si el archivo ya esta en la carpeta del cliente
     * (otro pedido suyo lo subio antes) se descarta el de la sesion SIN copiar; la
     * dedupe por `id` es la que hace que la misma foto viva una sola vez.
     *
     * Una vez movido, `resolver_original()` lo encuentra por la rama `orders/`: el
     * `id` es el mismo, asi que ninguna fila cambia de contenido.
     */
    private function mover_originales($sid, $clave, $item)
    {
        $ids = self::ids_originales($this->leer_manifest($sid, $item));
        if (!$ids) {
            return 0;
        }
        $origenDir = $this->motor->dir_sesion_uploads($sid);
        $destinoDir = $this->motor->dir_order_uploads($clave, true);
        $movidos = 0;
        foreach (array_keys($ids) as $id) {
            foreach ((array)glob($origenDir . DIRECTORY_SEPARATOR . $id . '.*') as $ruta) {
                if (!is_file($ruta)) {
                    continue;
                }
                $destino = $destinoDir . DIRECTORY_SEPARATOR . basename($ruta);
                if (is_file($destino)) {
                    @unlink($ruta);      // ya esta en la carpeta del cliente
                    continue;
                }
                if (@rename($ruta, $destino)) {
                    $movidos++;
                }
            }
        }
        return $movidos;
    }

    /**
     * Promueve el item al entregable (spec 035, D5/D6): el arbol
     * `tmp/sesion-{sid}/{item_key}/` se MUEVE a
     * `orders/{clave}/{order_id}/{item_key}/` por `rename`, y los originales que
     * referencia pasan a `orders/{clave}/uploads/`.
     *
     * Se llama al CONFIRMARSE el pago. Ya no hay staging: el item esta completo en
     * la sesion desde la vista previa, asi que mover es todo. Idempotente ante
     * reintentos (si el destino existe, ya estaba promovido).
     *
     * `manifest.cliente` se escribe ANTES del rename, sobre el manifest de la
     * sesion: el manifiesto VIAJA con el arbol, asi que es una sola escritura y el
     * destino nace con la clave puesta.
     */
    public function promover_order($order_id, $clave, $sid, $item)
    {
        $item = $this->motor->item_seguro($item, 'sesion:promover_order');
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            throw new Exception('motor:sesion:promocion:pedido:invalido');
        }
        if (!$this->motor->clave_valida($clave)) {
            // Spec 035 (D5): sin cliente (invitado) no hay carpeta. Causa VISIBLE:
            // el pedido queda sin promover y se reintenta si el cliente se registra.
            throw new Exception('motor:sesion:promocion:sin:cliente');
        }
        $destino = $this->motor->dir_order($clave, $order_id, true) . DIRECTORY_SEPARATOR . $item;
        // El DESTINO primero: si ya esta promovido, la sesion ya no tiene el item
        // (el rename se lo llevo) y mirar el origen primero romperia el reintento.
        if (is_dir($destino)) {
            return $destino;   // ya promovido (idempotente)
        }
        $origen = $this->motor->dir_sesion_item($sid, $item);
        if (!is_dir($origen)) {
            throw new Exception('motor:sesion:item:ausente');
        }
        $this->mutar_manifest($sid, $item, function (&$manifest) use ($clave) {
            $manifest['cliente'] = (string)(int)$clave;
        });
        $this->mover_originales($sid, $clave, $item);
        if (!@rename($origen, $destino)) {
            throw new Exception('motor:sesion:promocion:falla');
        }
        return $destino;
    }

    /**
     * Limpieza TTL: borra drafts vencidos (manifest.creado mas viejo que
     * $horas). Devuelve la cantidad de drafts eliminados. Nunca toca items de
     * carrito ni orders/.
     */
    public function limpiar_ttl($horas = 24, $horas_carrito = 720)
    {
        $raiz = $this->motor->dir_ambito('tmp');
        if (!is_dir($raiz)) {
            return 0;
        }
        $eliminados = 0;
        $horizonte = time() - max(1, (int)$horas) * HOUR_IN_SECONDS;
        foreach ((array)glob($raiz . DIRECTORY_SEPARATOR . 'sesion-*', GLOB_ONLYDIR) as $sesion) {
            foreach ((array)glob($sesion . DIRECTORY_SEPARATOR . 'draft-*', GLOB_ONLYDIR) as $draft) {
                $manifest = json_decode((string)@file_get_contents($draft . DIRECTORY_SEPARATOR . 'manifest.json'), true);
                $creado = is_array($manifest) && isset($manifest['creado']) ? strtotime((string)$manifest['creado']) : 0;
                $fallback = @filemtime($draft) ?: 0;
                if (($creado ?: $fallback) < $horizonte) {
                    $this->borrar_arbol($draft);
                    $eliminados++;
                }
            }
        }
        // Spec 030 (T032/D18/D26): ademas de los drafts vencen los ITEMS de carrito
        // abandonados (30 dias por defecto) y las sesiones sin items, siempre por ITEM completo.
        $horizonteCarrito = time() - max(1, (int)$horas_carrito) * HOUR_IN_SECONDS;
        foreach ((array)glob($raiz . DIRECTORY_SEPARATOR . 'sesion-*', GLOB_ONLYDIR) as $dirSesion) {
            $vivos = 0;
            // Spec 035 (D13): `uploads/` es la carpeta COMPARTIDA de originales, no un
            // item: no cuenta como vivo y su poda es POR SESION (¿algun item la
            // referencia?), nunca por item.
            $referencias = [];
            foreach ((array)glob($dirSesion . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $item) {
                $nombre = basename($item);
                if (strpos($nombre, 'draft-') === 0) {
                    $vivos++;
                    continue;
                }
                if ($nombre === 'uploads') {
                    continue;
                }
                if ($nombre === 'customs') {
                    // Spec 037 (T036/C6): las ideas del INVITADO vencen como un item
                    // de carrito (30 d) y se podan POR IDEA (su `idea.json`), no como
                    // un arbol entero. `orders/{cliente}/customs/` no entra aca: este
                    // barrido solo recorre `tmp/`, asi la retencion del cliente es
                    // manual del admin (FR-032).
                    if ($this->limpiar_customs_dir($item, $horizonteCarrito) > 0) {
                        $vivos++;
                    }
                    continue;
                }
                $man = json_decode((string)@file_get_contents($item . DIRECTORY_SEPARATOR . 'manifest.json'), true);
                $creado = is_array($man) && isset($man['creado']) ? strtotime((string)$man['creado']) : 0;
                $fallback = @filemtime($item) ?: 0;
                if (($creado ?: $fallback) < $horizonteCarrito) {
                    $this->borrar_arbol($item);
                    $eliminados++;
                    continue;
                }
                $vivos++;
                // Spec 035 (D13): la lista de originales que el item referencia
                // sale del helper unico (el mismo que usa el traslado al pagar).
                $referencias = array_merge($referencias, self::ids_originales($man));
            }
            $this->podar_uploads_sesion($dirSesion, $referencias, $horizonteCarrito);
            if ($vivos === 0) {
                $this->borrar_arbol($dirSesion);
            }
        }
        // Spec 040 (T030): poda por ULTIMO USO en las carpetas de los CLIENTES. Nunca se
        // borra una imagen referenciada por un pedido (romperia su regeneracion).
        $raizOrders = $this->motor->dir_ambito('orders');
        foreach ((array)glob($raizOrders . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $dirCli) {
            $uidCli = basename($dirCli);
            if (!PMU_Uploads::clave_valida($uidCli)) {
                continue;   // `uploads/`, `customs/` y demas no son clientes
            }
            $dirUp = $dirCli . DIRECTORY_SEPARATOR . 'uploads';
            $cat = $this->motor->catalogo_leer($dirUp);
            if (!is_array($cat)) {
                continue;
            }
            foreach ((array)($cat['items'] ?? []) as $id => $it) {
                if (!is_array($it) || (int)($it['ultimo_uso'] ?? 0) >= $horizonteCarrito) {
                    continue;
                }
                $refs = $this->referencias_en_carrito_o_pedidos('', (string)$id, $uidCli);
                if ((int)$refs['pedidos'] > 0) {
                    continue;
                }
                $baja = $this->borrar_imagen_galeria('', (string)$id, $uidCli);
                if (!empty($baja['borrado'])) {
                    $eliminados++;
                }
            }
        }
        return $eliminados;
    }

    /**
     * Ids de los ORIGINALES que un manifest referencia (spec 035, D3).
     *
     * Un `id` se comparte entre items de la sesion y entre pedidos del cliente,
     * asi que el manifest es la UNICA lista de lo que el item necesita: la usan
     * la poda por sesion, el traslado al pagar y la materializacion.
     *
     * @return array id => true
     */
    public static function ids_originales($manifest)
    {
        $out = [];
        foreach ((array)(is_array($manifest) ? ($manifest['subidas'] ?? []) : []) as $fila) {
            if (!is_array($fila) || (string)($fila['origen'] ?? '') !== 'original') {
                continue;
            }
            $id = strtolower((string)($fila['id'] ?? ''));
            if (preg_match('/^[a-f0-9]{12}$/', $id)) {
                $out[$id] = true;
            }
        }
        return $out;
    }

    /**
     * Spec 035 (D13): borra los originales de la sesion que ningun item referencia.
     *
     * La carpeta es COMPARTIDA: una foto puede usarla otro item, asi que la poda es
     * por sesion, nunca por item. **Sin referencias no borra nada**: una subida
     * recien hecha puede no estar todavia en ningun manifest, y perderla seria peor
     * que dejar un archivo de mas.
     *
     * @return array ids borrados
     */
    /**
     * Poda las ideas del INVITADO (`tmp/sesion-{sid}/customs/`), spec 037 (T036).
     *
     * Vencen como un item de carrito (`$horizonte` = epoch de corte) y se borran
     * POR IDEA: `idea.json` + su `mockup.webp` + la carpeta. **Nunca** se llama
     * sobre `orders/` (C6: los customs del cliente no tienen TTL automatico).
     *
     * @return int ideas que quedan vivas
     */
    private function limpiar_customs_dir($dir, $horizonte)
    {
        $quedan = 0;
        foreach ((array)glob(rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'idea-*', GLOB_ONLYDIR) as $ideaDir) {
            $json = $ideaDir . DIRECTORY_SEPARATOR . 'idea.json';
            $datos = json_decode((string)@file_get_contents($json), true);
            $creado = is_array($datos) && isset($datos['creado']) ? (int)$datos['creado'] : 0;
            $fallback = @filemtime($json) ?: (@filemtime($ideaDir) ?: 0);
            $vence = $creado ?: $fallback;
            if ($vence > 0 && $vence < (int)$horizonte) {
                @unlink($json);
                @unlink($ideaDir . DIRECTORY_SEPARATOR . 'mockup.webp');
                @rmdir($ideaDir);
                continue;
            }
            $quedan++;
        }
        return $quedan;
    }

    private function podar_uploads_sesion($dirSesion, array $referencias, $horizonte = 0)
    {
        $dir = $dirSesion . DIRECTORY_SEPARATOR . 'uploads';
        if (!is_dir($dir) || !$referencias) {
            return [];
        }
        $borrados = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*') as $ruta) {
            if (!is_file($ruta)) {
                continue;
            }
            $id = pathinfo($ruta, PATHINFO_FILENAME);
            if (isset($referencias[$id])) {
                continue;
            }
            // Spec 050 (retencion atada a la cookie, 30 d): un original que ningun
            // item vivo referencia NO se poda de inmediato; se conserva hasta vencer
            // la retencion (misma ventana que `pmu_sid` / carrito abandonado). Solo
            // se elimina si supero el horizonte. `$horizonte <= 0` = sin retencion.
            if ($horizonte > 0 && (@filemtime($ruta) ?: 0) >= $horizonte) {
                continue;
            }
            $nombre = basename($ruta);
            // Spec 040 (T006): el catalogo y su lock NO son fotos: la poda por
            // referencias los borraria como huerfanos.
            if ($nombre === PMU_Uploads::CATALOGO_UPLOADS || $nombre === PMU_Uploads::LOCK_UPLOADS) {
                continue;
            }
            // Las miniaturas (`{id}-80x80.webp`) son derivadas del original: si el
            // original se va, se van con el; mientras exista, no se tocan.
            if (preg_match('/-\\d{2,3}x\\d{2,3}\\.webp$/i', $nombre) === 1) {
                continue;
            }
            @unlink($ruta);
            // La miniatura derivada se va con su original (sino queda huerfana).
            $mini = PMU_Lectura::miniatura_ruta($ruta, PMU_Lectura::MINIATURA_LADO);
            if ($mini !== '' && is_file($mini)) { @unlink($mini); }
            $borrados[] = $id;
        }
        // Spec 050 (1): el catalogo no queda con entradas muertas. Se reescribe bajo
        // lock (atomico); si falla, `PMU_Lectura::listar` ya omite lo que no existe.
        if ($borrados) {
            try {
                $this->motor->catalogo_mutar($dir, static function (&$c) use ($borrados) {
                    foreach ($borrados as $id) {
                        unset($c['items'][$id]);
                    }
                });
            } catch (\Throwable $e) {
                // Best-effort: la poda del catalogo nunca tumba el barrido.
            }
        }
        return $borrados;
    }

    /**
     * Ruta FISICA del archivo de una fila de `subidas[]`.
     *
     * Spec 035: una fila `origen: 'original'` NO lleva `file` (la ubicacion la
     * resuelve el servidor por `id`), asi que se busca por la CADENA
     * `orders/{clave}/uploads/` -> `tmp/sesion-{sid}/uploads/`. Las filas viejas
     * (con `file` relativo al contenedor) siguen resolviendose igual.
     *
     * Devuelve '' si no existe: el llamador OMITE la foto, nunca inventa una ruta.
     * Sin esto, `familias()` y `ruta_familia()` salteaban TODA fila 035 y la
     * biblioteca quedaba vacia (lo cazo el laboratorio, no el arnes).
     */
    private function ruta_fila_subida(array $contenedor, array $fila)
    {
        $file = (string)($fila['file'] ?? '');
        if ($file !== '') {
            $ruta = (string)$contenedor['dir'] . DIRECTORY_SEPARATOR
                . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $file);
            return is_file($ruta) ? $ruta : '';
        }
        $id = strtolower((string)($fila['id'] ?? ''));
        if ($id === '') {
            return '';
        }
        // `clave` viaja en el manifest desde la 035; `sid` lo trae el contenedor.
        $clave = (string)($contenedor['manifest']['cliente'] ?? '');
        $ruta = $this->resolver_original($id, $clave, (string)($contenedor['sid'] ?? ''));
        return ($ruta !== '' && is_file($ruta)) ? $ruta : '';
    }

    /**
     * Resuelve una fila `origen: ref` (spec 030, D10/D13).
     *
     * El `ref` es **relativo al item** y se valida que quede DENTRO de
     * `uploads/pmu/`: el item esta a la misma profundidad en
     * `tmp/sesion-{sid}/{item_key}/` y en `orders/{order_id}/{item_key}/`, asi
     * que el mismo texto vale antes y despues de promover (cero reescritura).
     * Devuelve cadena vacia si no resuelve: el llamador deja el hueco
     * transparente, nunca un PDF roto.
     */
    public function resolver_ref($dir_item, $ref)
    {
        $ref = trim((string)$ref);
        if ($ref === '' || strpos($ref, "\0") !== false) {
            return '';
        }
        // El `ref` es relativo a `uploads/pmu/` (D10 revisado: en `tmp` el item esta a 3
        // niveles y en `orders/` a 2, asi que un `../..` fijo NO sobrevive a la
        // promocion). `$dir_item` se conserva en la firma como pista del llamador.
        $raiz = @realpath($this->motor->dir_pmu());
        $ruta = @realpath($this->motor->dir_pmu() . DIRECTORY_SEPARATOR
            . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $ref));
        if ($raiz === false || $ruta === false || !is_file($ruta)) {
            return '';
        }
        // Anti-traversal: la ruta real tiene que quedar dentro de uploads/pmu/.
        $prefijo = rtrim(str_replace('\\', '/', $raiz), '/') . '/';
        if (strpos(str_replace('\\', '/', $ruta), $prefijo) !== 0) {
            return '';
        }
        return $ruta;
    }

    /** Lienzo maximo de un hueco (px). Espejo de `PH_MAX` en `assets/tienda.js`. */
    const PH_MAX = 3000;

    /** Claves de la receta v2, en el ORDEN que fija el hash (spec 035, D1). */
    const RECETA_V2_CLAVES = [
        'v', 'w', 'h', 'forma', 'modo', 'escala', 'ox', 'oy',
        'fondo', 'transp', 'rot', 'iw', 'ih', 'phsize', 'gid',
    ];

    /**
     * Receta canonica de una composicion (spec 030, D7/R2; v2 en la 035, D1).
     *
     * La recomputa el SERVIDOR: el cliente no puede proponer el hash. Devuelve
     * cadena vacia si la receta no es v2 valida (no lanza: los llamadores
     * historicos guardan el hash tal cual).
     */
    public static function receta_de(array $params)
    {
        try {
            $p = self::receta_validar($params);
        } catch (Exception $e) {
            return '';
        }
        $partes = [];
        foreach (self::RECETA_V2_CLAVES as $k) {
            $partes[] = (string)$p[$k];
        }
        return substr(sha1(implode('|', $partes)), 0, 12);
    }

    /**
     * Pixeles de un tamano del cotizador (spec 037, R6): cm -> px a 300 ppp.
     *
     * Acepta el formato del catalogo del cotizador (`2,5 cm`, `8 cm`, `6,0 cm`) y
     * el de una medida rectangular (`5x2,5 cm`, `10x200`). La coma es DECIMAL; la
     * `x`, el separador de lados. Si el lado mayor pasa de `PH_MAX` se escala
     * proporcionalmente (un banderin de 200 cm no puede pedir 23.622 px).
     *
     * Devuelve `[0, 0]` si no hay ningun numero: el llamador decide la causa.
     * La MISMA regla vive en `calculadora/src/core/mockups.ts` (`sizeToPx`); si
     * divergen, el `gid` y el encuadre dejan de coincidir (assert de paridad).
     *
     * @return array{0:int,1:int}
     */
    public static function px_cotizador($size)
    {
        $texto = strtolower(str_replace(',', '.', (string)$size));
        $partes = preg_split('/[^0-9.]+/', trim($texto), -1, PREG_SPLIT_NO_EMPTY);
        $nums = [];
        foreach ((array)$partes as $parte) {
            $n = (float)$parte;
            if ($n > 0) {
                $nums[] = $n;
            }
        }
        if (!$nums) {
            return [0, 0];
        }
        $cmW = $nums[0];
        $cmH = isset($nums[1]) ? $nums[1] : $nums[0];
        return self::px_acotar((int)round($cmW / 2.54 * 300), (int)round($cmH / 2.54 * 300));
    }

    /** Acota el lienzo a `PH_MAX` conservando el ASPECTO (lado mayor = PH_MAX). */
    private static function px_acotar($w, $h)
    {
        $w = max(1, (int)$w);
        $h = max(1, (int)$h);
        $mayor = max($w, $h);
        if ($mayor <= self::PH_MAX) {
            return [$w, $h];
        }
        $k = self::PH_MAX / $mayor;
        return [max(1, (int)round($w * $k)), max(1, (int)round($h * $k))];
    }

    /**
     * Receta SINTETICA del cotizador (spec 037, R6): el arte que se imprime.
     *
     * El cotizador no tiene PDF, asi que no hay `analisis.json` del que derivar
     * el lienzo: el lienzo es EXPLICITO (`w/h` = px del sticker) y el `gid` se
     * deriva de categoria + tamano NORMALIZADO a px (asi `3,0 cm` y `3 cm` dan el
     * mismo id y el nombre del compuesto cachea bien). `phsize = 0` (sin
     * placeholder), `fondo` blanco y `transp = 'no'`: el arte nunca sale
     * transparente. La salida pasa por `receta_validar()`: si no valida, la causa
     * es `params:invalidos` (nunca una receta a medias).
     *
     * @param string $categoria clave del catalogo (`Circulares`, `Formas`, ...)
     * @param string $size      tamano tal como lo muestra el cotizador
     * @param array  $diseno    encuadre del selector: forma, modo, escala, ox, oy,
     *                          rot, iw, ih (px del original)
     * @return array receta v2 canonizada
     * @throws Exception `params:invalidos`
     */
    public static function receta_cotizador($categoria, $size, array $diseno = [])
    {
        $cat = strtolower((string)preg_replace('/[^A-Za-z0-9_-]/', '', (string)$categoria));
        list($w, $h) = self::px_cotizador($size);
        if ($w < 1 || $h < 1) {
            throw new Exception('params:invalidos');
        }
        $gid = strtoupper(substr(sha1($cat . '|' . $w . 'x' . $h), 0, 6));
        $iw = (int)($diseno['iw'] ?? 0);
        $ih = (int)($diseno['ih'] ?? 0);
        if ($iw < 1 || $ih < 1) {
            $iw = $w;
            $ih = $h;
        }
        $params = [
            'v' => 2,
            'w' => $w,
            'h' => $h,
            'forma' => (string)($diseno['forma'] ?? 'rectangulo'),
            'modo' => (string)($diseno['modo'] ?? 'cubrir'),
            'escala' => isset($diseno['escala']) ? $diseno['escala'] : 1,
            'ox' => isset($diseno['ox']) ? $diseno['ox'] : 0.5,
            'oy' => isset($diseno['oy']) ? $diseno['oy'] : 0.5,
            'fondo' => '#ffffff',
            'transp' => 'no',
            'rot' => (int)($diseno['rot'] ?? 0),
            'iw' => $iw,
            'ih' => $ih,
            'phsize' => 0,
            'gid' => $gid,
        ];
        try {
            return self::receta_validar($params);
        } catch (Exception $e) {
            throw new Exception('params:invalidos');
        }
    }

    /**
     * Valida la receta v2 y devuelve los valores CANONIZADOS (spec 035, D1).
     *
     * Rechaza con causa en vez de corregir en silencio: un encuadre distinto al
     * que vio el comprador es peor que un error visible. `ox/oy` es el centro de
     * dibujo normalizado (0.5 = centro del lienzo): ya incluye el centro de la
     * forma y el desplazamiento escalado por la Escala, asi el compositor no
     * necesita la geometria de la envoltura (que solo existe en JS).
     *
     * @throws Exception `motor:receta:<clave>`
     */
    public static function receta_validar(array $params)
    {
        if ((int)($params['v'] ?? 0) !== 2) {
            throw new Exception('motor:receta:v');
        }
        $modo = strtolower(trim((string)($params['modo'] ?? '')));
        if (!in_array($modo, ['cubrir', 'encajar', 'estirar'], true)) {
            throw new Exception('motor:receta:modo');
        }
        $escala = (float)($params['escala'] ?? 0);
        if ($escala < 0.25 || $escala > 4) {
            throw new Exception('motor:receta:escala');
        }
        $rot = (int)($params['rot'] ?? -1);
        if (!in_array($rot, [0, 90, 180, 270], true)) {
            throw new Exception('motor:receta:rot');
        }
        $phsize = (int)($params['phsize'] ?? -1);
        if (!in_array($phsize, [0, 1, 2], true)) {
            throw new Exception('motor:receta:phsize');
        }
        $gid = strtoupper(trim((string)($params['gid'] ?? '')));
        if (!preg_match('/^[0-9A-F]{6}$/', $gid)) {
            throw new Exception('motor:receta:gid');
        }
        $w = (int)($params['w'] ?? 0);
        $h = (int)($params['h'] ?? 0);
        if ($w < 1 || $h < 1 || $w > self::PH_MAX || $h > self::PH_MAX) {
            throw new Exception('motor:receta:lienzo');
        }
        $iw = (int)($params['iw'] ?? 0);
        $ih = (int)($params['ih'] ?? 0);
        if ($iw < 1 || $ih < 1) {
            throw new Exception('motor:receta:origen');
        }
        $ox = (float)($params['ox'] ?? 0.5);
        $oy = (float)($params['oy'] ?? 0.5);
        // El centro puede salir de [0,1] si el comprador arrastra la foto (la
        // composicion se recorta). Se valida en un rango holgado: atajarlo seria
        // mover la imagen y romper "la vista previa es el PDF".
        if ($ox < -4 || $ox > 5 || $oy < -4 || $oy > 5) {
            throw new Exception('motor:receta:centro');
        }
        $fondo = strtolower(trim((string)($params['fondo'] ?? 'auto')));
        if ($fondo !== 'auto' && $fondo !== 'transparent'
            && !preg_match('/^#[0-9a-f]{6}$/', $fondo)) {
            throw new Exception('motor:receta:fondo');
        }
        $transp = strtolower(trim((string)($params['transp'] ?? '')));
        if (!in_array($transp, ['', 'si', 'no'], true)) {
            throw new Exception('motor:receta:transp');
        }
        $forma = strtolower(trim((string)($params['forma'] ?? 'auto')));
        if (!preg_match('/^[a-z]{3,24}$/', $forma)) {
            throw new Exception('motor:receta:forma');
        }
        return [
            'v' => 2, 'w' => $w, 'h' => $h, 'forma' => $forma, 'modo' => $modo,
            'escala' => self::receta_num($escala), 'ox' => self::receta_num($ox),
            'oy' => self::receta_num($oy), 'fondo' => $fondo, 'transp' => $transp,
            'rot' => $rot, 'iw' => $iw, 'ih' => $ih, 'phsize' => $phsize, 'gid' => $gid,
        ];
    }

    /** Numero canonico de la receta: 3 decimales sin ceros de cola (hash estable). */
    private static function receta_num($v)
    {
        $s = number_format((float)$v, 3, '.', '');
        return rtrim(rtrim($s, '0'), '.');
    }

    /* (spec 039 D5: `usar_de_biblioteca()` y `borrar_familia_dir()` RETIRADOS: el
     *  modelo "familias" murio. El original se referencia por `id`; borrar en el acto
     *  lo hace `borrar_original_item()`.)

    /* ==================== Ayudantes de arbol ==================== */

    private function borrar_arbol($dir)
    {
        if (!$dir || !is_dir($dir)) {
            return;
        }
        // FilesystemIterator (no glob): lista TAMBIEN los dotfiles como el
        // .manifest.lock del mutar_manifest; con glob('*') el lock quedaba y
        // el rmdir fallaba en silencio (borrado "quirurgico" incompleto).
        $it = new FilesystemIterator($dir, FilesystemIterator::SKIP_DOTS);
        foreach ($it as $f) {
            if ($f->isDir()) {
                $this->borrar_arbol($f->getPathname());
                continue;
            }
            @unlink($f->getPathname());
        }
        @rmdir($dir);
    }
}
