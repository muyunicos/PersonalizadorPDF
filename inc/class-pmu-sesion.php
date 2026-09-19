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
 * Pool dedicado por item (sin deduplicacion global): img/{pdf}-{id}-{n}.png
 * con fila en manifest.archivos[] {pdf, grupo_id, indice, file, hash}.
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

    /** Siguiente numero disponible para el pool del grupo: {pdf}-{id}-{n}.png. */
    private function siguiente_n($imgDir, $pdf, $grupo)
    {
        // Mismo casing con el que se escribe el archivo (pdf saneado + grupo hex).
        $prefijo = $pdf . '-' . $grupo . '-';
        $n = 1;
        foreach ((array)glob($imgDir . DIRECTORY_SEPARATOR . $prefijo . '*.png') as $ruta) {
            $base = basename($ruta);
            if (preg_match('/\-' . preg_quote($grupo, '/') . '\-(\d+)\.png$/i', $base, $m)) {
                $n = max($n, (int)$m[1] + 1);
            }
        }
        return $n;
    }

    /**
     * Guarda un PNG en el pool del item y anota la fila en manifest.archivos[].
     * $hash opcional: sha1(valor + preset + settings + WxH) que calcula el
     * llamador para la regeneracion parcial (fallback: sha1 de los bytes).
     * Devuelve {indice, file, hash}.
     */
    public function guardar_png($sid, $item_key, $pdf, $grupo, $bytes, $hash = null)
    {
        $pdf = $this->motor->nombre_seguro($pdf, 'sesion:guardar_png');
        $grupo = strtoupper((string)$grupo);
        if (!preg_match('/^[0-9A-F]{6}$/', $grupo)) {
            throw new Exception('motor:sesion:grupo:invalido');
        }
        if ($bytes === null || $bytes === '') {
            throw new Exception('motor:sesion:png:vacio');
        }
        $imgDir = $this->motor->dir_sesion_item_img($sid, $item_key, true);
        $n = $this->siguiente_n($imgDir, $pdf, $grupo);
        $file = 'img/' . $pdf . '-' . $grupo . '-' . $n . '.png';
        if (@file_put_contents($imgDir . DIRECTORY_SEPARATOR . basename($file), $bytes) === false) {
            throw new Exception('motor:sesion:directorio:no_escribible');
        }
        $manifest = $this->leer_manifest($sid, $item_key);
        if (!is_array($manifest)) {
            throw new Exception('motor:sesion:item:ausente');
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
        $this->guardar_manifest($sid, $item_key, $manifest);
        return ['indice' => $fila['indice'], 'file' => $file, 'hash' => $fila['hash']];
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
        $imgDir = $this->motor->dir_sesion_item_img($sid, $item_key, false);
        if (is_dir($imgDir)) {
            foreach ((array)glob($imgDir . DIRECTORY_SEPARATOR . $pdf . '-' . $grupo . '-*.png') as $ruta) {
                @unlink($ruta);
            }
        }
        $manifest = $this->leer_manifest($sid, $item_key);
        if (!is_array($manifest)) {
            throw new Exception('motor:sesion:item:ausente');
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
        $this->guardar_manifest($sid, $item_key, $manifest);
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
        $manifest = $this->leer_manifest($sid, $item_key);
        if (is_array($manifest)) {
            $vistas = isset($manifest['mockup_vistas']) && is_array($manifest['mockup_vistas']) ? $manifest['mockup_vistas'] : [];
            if (!in_array($mockup_id, $vistas, true)) {
                $vistas[] = $mockup_id;
            }
            $manifest['mockup_vistas'] = array_values($vistas);
            $manifest['mockup_visto'] = $mockup_id;
            $this->guardar_manifest($sid, $item_key, $manifest);
        }
        return $dir . DIRECTORY_SEPARATOR . 'mockup-' . $mockup_id . '.webp';
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
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*') as $f) {
            if (is_dir($f)) {
                $this->borrar_arbol($f);
                continue;
            }
            @unlink($f);
        }
        @rmdir($dir);
    }
}
