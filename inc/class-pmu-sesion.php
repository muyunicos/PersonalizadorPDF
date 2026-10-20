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

    /* ==================== Item y manifest ==================== */

    /** Carpeta del item (sin crear). */
    public function dir_item($sid, $item_key)
    {
        return $this->motor->dir_sesion_item($sid, $item_key);
    }

    /** Crea un borrador draft-{uuid} con manifest inicial. Devuelve el item_key. */
    public function crear_draft($sid, array $pdfs)
    {
        if (!$pdfs) {
            throw new Exception('motor:sesion:pdfs:vacio');
        }
        $limpios = [];
        foreach ($pdfs as $pdf) {
            $limpios[] = $this->motor->nombre_seguro($pdf, 'sesion:crear_draft');
        }
        $item = 'draft-' . substr(str_replace('-', '', $this->uuid4()), 0, 12);
        $this->motor->dir_sesion_item_img($sid, $item, true); // crea item + img/
        $this->guardar_manifest($sid, $item, [
            'item_key' => $item,
            'sid' => $this->motor->sesion_segura($sid, 'sesion:crear_draft'),
            'pdfs' => $limpios,
            'valores' => new \stdClass(),
            'archivos' => [],
            'mockup_vistas' => [],
            'mockup_visto' => null,
            'preview_estado' => self::ESTADO_SIN_VISTA,
            'creado' => gmdate('Y-m-d\TH:i:s\Z'),
            'motor' => defined('PERSONALIZADOR_PDF_VERSION') ? PERSONALIZADOR_PDF_VERSION : 'dev',
        ]);
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
     * Devuelve {indice, file, hash}.
     */
    public function guardar_imagen($sid, $item_key, $pdf, $grupo, $bytes, $hash = null)
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
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($sid, $item_key, $pdf, $grupo, $bytes, $ext, $hash, &$fila) {
            $imgDir = $this->motor->dir_sesion_item_img($sid, $item_key, true);
            $n = $this->siguiente_n($imgDir, $pdf, $grupo);
            $file = 'img/' . $pdf . '-' . $grupo . '-' . $n . '.' . $ext;
            if (@file_put_contents($imgDir . DIRECTORY_SEPARATOR . basename($file), $bytes) === false) {
                throw new Exception('motor:sesion:directorio:no_escribible');
            }
            if (!isset($manifest['archivos']) || !is_array($manifest['archivos'])) {
                $manifest['archivos'] = [];
            }
            $fila = [
                'pdf' => $pdf,
                'grupo_id' => $grupo,
                'indice' => $n - 1,
                'file' => $file,
                'hash' => (string)($hash !== null ? $hash : sha1($bytes)),
            ];
            $manifest['archivos'][] = $fila;
        });
        return ['indice' => $fila['indice'], 'file' => $fila['file'], 'hash' => $fila['hash']];
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
    public function guardar_subida($sid, $item_key, $bytes)
    {
        $bytes = (string)$bytes;
        if ($bytes === '' || strlen($bytes) > self::TOPE_SUBIDA_BYTES) {
            throw new Exception('motor:subida:vacia');
        }
        $firma = self::firma_imagen($bytes);
        if ($firma === null) {
            throw new Exception('motor:subida:formato:invalido');
        }
        // Spec 026 (D3): el servidor convierte a WebP si puede. La foto del
        // comprador es unseen: calidad 0.85 (D4).
        $img = self::convertir_webp($bytes, 85);
        $bytes = $img['bytes'];
        $firma = ['ext' => $img['ext'], 'mime' => $img['mime']];
        $salida = null;
        $this->mutar_manifest($sid, $item_key, function (&$manifest) use ($sid, $item_key, $bytes, $firma, &$salida) {
            if ((string)($manifest['item_key'] ?? '') !== (string)$item_key) {
                throw new Exception('motor:sesion:item:ausente');
            }
            $dir = $this->dir_subidas($sid, $item_key, true);
            $id = substr(str_replace('-', '', $this->uuid4()), 0, 12);
            $file = 'subidas/' . $id . '.' . $firma['ext'];
            if (@file_put_contents($dir . DIRECTORY_SEPARATOR . $id . '.' . $firma['ext'], $bytes) === false) {
                throw new Exception('motor:sesion:subidas:no_escribible');
            }
            $filas = isset($manifest['subidas']) && is_array($manifest['subidas'])
                ? array_values($manifest['subidas']) : [];
            $filas[] = [
                'id' => $id,
                'file' => $file,
                'mime' => $firma['mime'],
                'bytes' => strlen($bytes),
                'creado' => time(),
            ];
            $manifest['subidas'] = $filas;
            $salida = ['id' => $id, 'file' => $file, 'mime' => $firma['mime'], 'bytes' => strlen($bytes)];
        });
        return $salida;
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
            if (is_array($fila) && isset($fila['id'], $fila['file'])) {
                $porId[(string)$fila['id']] = (string)$fila['file'];
            }
        }
        // La foto vive en `{item}/subidas/` (D14), NO en la raiz del item.
        // Antes se usaba `dir_item()` + `basename()`, que le arrancaba la
        // carpeta `subidas/` y buscaba el archivo en la raiz (donde no esta):
        // `handle_subida_url` respondia `motor:subida:archivo:ausente`, el
        // cliente recibia null y la vista previa NUNCA mostraba la foto del
        // comprador (el hueco quedaba transparente). `basename()` se conserva
        // como defensa anti-traversal por si el manifest fuera editado a mano.
        $dirSub = $this->dir_subidas($sid, $item_key, false);
        $out = [];
        foreach ($ids as $id) {
            $id = (string)$id;
            if ($id !== '' && isset($porId[$id])) {
                $out[$id] = $dirSub . DIRECTORY_SEPARATOR . basename($porId[$id]);
            }
        }
        return $out;
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
     * Copia el item a staging: tmp/orders/{order_id}/{item_key}/ (al crearse
     * el pedido). Idempotente: si el staging ya existe, lo devuelve.
     */
    public function staging_order($order_id, $item_key, $sid)
    {
        $origen = $this->motor->dir_sesion_item($sid, $item_key);
        if (!is_dir($origen)) {
            throw new Exception('motor:sesion:item:ausente');
        }
        $staging = $this->motor->dir_tmp_order($order_id, true) . DIRECTORY_SEPARATOR
            . $this->motor->item_seguro($item_key, 'sesion:staging_order');
        if (is_dir($staging)) {
            return $staging;
        }
        $this->copiar_arbol($origen, $staging);
        return $staging;
    }

    /**
     * Promueve el staging a entregable: tmp/orders/{order_id}/{item_key}/ ->
     * orders/{order_id}/{item_key}/ por rename (solo al confirmarse el pago).
     * Flag .promocionando en el staging ante reintentos (rename a medias).
     */
    public function promover_order($order_id, $item_key)
    {
        $item_key = $this->motor->item_seguro($item_key, 'sesion:promover_order');
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            throw new Exception('motor:sesion:promocion:pendiente');
        }
        $origen = $this->motor->dir_tmp_order($order_id) . DIRECTORY_SEPARATOR . $item_key;
        if (!is_dir($origen)) {
            throw new Exception('motor:sesion:item:ausente');
        }
        if (is_file($origen . DIRECTORY_SEPARATOR . '.promocionando')) {
            throw new Exception('motor:sesion:promocion:pendiente');
        }
        $destino = $this->motor->dir_order($order_id, true) . DIRECTORY_SEPARATOR . $item_key;
        if (is_dir($destino)) {
            return $destino; // ya promovido (idempotente)
        }
        @file_put_contents($origen . DIRECTORY_SEPARATOR . '.promocionando', '1');
        if (!@rename($origen, $destino)) {
            throw new Exception('motor:sesion:promocion:pendiente');
        }
        @unlink($destino . DIRECTORY_SEPARATOR . '.promocionando');
        return $destino;
    }

    /**
     * Limpieza TTL: borra drafts vencidos (manifest.creado mas viejo que
     * $horas). Devuelve la cantidad de drafts eliminados. Nunca toca items de
     * carrito ni orders/.
     */
    public function limpiar_ttl($horas = 24)
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
        return $eliminados;
    }

    /* ==================== Ayudantes de arbol ==================== */

    private function copiar_arbol($origen, $destino)
    {
        if (!is_dir($origen) || !wp_mkdir_p($destino)) {
            throw new Exception('motor:sesion:directorio:no_escribible');
        }
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($origen, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $item) {
            $dest = $destino . DIRECTORY_SEPARATOR . $it->getSubPathName();
            if ($item->isDir()) {
                if (!is_dir($dest) && !@mkdir($dest, 0775, true)) {
                    throw new Exception('motor:sesion:directorio:no_escribible');
                }
            } elseif (basename((string)$item->getPathname()) === '.manifest.lock') {
                continue; // lock de escritura del manifest: no viaja al pedido
            } elseif (!@copy($item->getPathname(), $dest)) {
                throw new Exception('motor:sesion:directorio:no_escribible');
            }
        }
    }

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
