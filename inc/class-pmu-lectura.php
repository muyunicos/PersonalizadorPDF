<?php
/**
 * PMU_Lectura - ayudante puro de lectura de originales del comprador (spec 042).
 *
 * Sin WordPress: lo usan PMU_Uploads (con WP) y media.php (sin WP). No escribe
 * catalogos: la escritura vive en PMU_Uploads (spec 040).
 */
class PMU_Lectura
{
    const VERSION_CATALOGO = 1;
    const EXTENSIONES = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
    const MINIATURA_LADO = 80;
    const THUMB_MAX_BYTES = 20480;
    const THUMB_TOPE = 10;
    const THUMB_PRESUPUESTO = 55 * 1024;

    /** Ruta del catalogo de una carpeta de originales. */
    public static function ruta_catalogo($dir)
    {
        $dir = rtrim((string)$dir, '/\\');
        return ($dir === '') ? '' : $dir . DIRECTORY_SEPARATOR . 'uploads.json';
    }

    /**
     * Lee el catalogo v1 de una carpeta. Tolerante: ausente, ilegible o version
     * desconocida devuelve null. Normaliza `recetas` a array.
     */
    public static function catalogo_leer($dir)
    {
        $ruta = self::ruta_catalogo($dir);
        if ($ruta === '' || !is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        if (!is_array($datos)
            || (int)($datos['version'] ?? 0) !== self::VERSION_CATALOGO
            || !is_array($datos['items'] ?? null)) {
            return null;
        }
        foreach ($datos['items'] as $k => $v) {
            if (is_array($v) && isset($v['recetas']) && !is_array($v['recetas'])) {
                $datos['items'][$k]['recetas'] = (array)$v['recetas'];
            }
        }
        return $datos;
    }

    /** Revision de la lista: mtime del catalogo + ids (misma formula que PMU_Uploads). */
    public static function revision($rutaCatalogo, array $items)
    {
        return substr(sha1((string)@filemtime($rutaCatalogo) . '|' . implode(',', array_keys($items))), 0, 12);
    }

    /**
     * Resuelve `{id}.{ext}` dentro de una carpeta de identidad.
     * Devuelve la ruta real o ''. Rechaza id/ext invalidos, symlinks y escapes.
     */
    public static function archivo($dir, $id, $ext = '')
    {
        $dir = rtrim((string)$dir, '/\\');
        $id = strtolower(trim((string)$id));
        if ($dir === '' || preg_match('/^[a-f0-9]{12}$/', $id) !== 1) {
            return '';
        }
        $baseReal = realpath($dir);
        if ($baseReal === false || !is_dir($baseReal)) {
            return '';
        }
        $base = $dir . DIRECTORY_SEPARATOR . $id;
        $candidatos = [];
        $ext = strtolower(preg_replace('/[^a-z0-9]/', '', (string)$ext));
        if ($ext !== '') {
            if (!in_array($ext, self::EXTENSIONES, true)) {
                return '';
            }
            $candidatos[] = $base . '.' . $ext;
        }
        foreach (self::EXTENSIONES as $e) {
            $candidatos[] = $base . '.' . $e;
        }
        foreach ($candidatos as $c) {
            if (!is_file($c) || is_link($c)) {
                continue;
            }
            $real = realpath($c);
            if ($real === false) {
                continue;
            }
            if (strncmp($real, $baseReal . DIRECTORY_SEPARATOR, strlen($baseReal) + 1) !== 0) {
                continue;
            }
            return $real;
        }
        return '';
    }

    /** Ruta de la miniatura cuadrada: `{id}-80x80.webp`. */
    public static function miniatura_ruta($rutaOriginal, $lado = 80)
    {
        $lado = max(32, min(512, (int)$lado));
        $base = (string)$rutaOriginal;
        $ext = strtolower((string)pathinfo($base, PATHINFO_EXTENSION));
        if ($ext !== '') {
            $base = substr($base, 0, -(strlen($ext) + 1));
        }
        return $base . '-' . $lado . 'x' . $lado . '.webp';
    }

    /**
     * Genera (y devuelve) la miniatura cuadrada cover. Devuelve '' si no se puede
     * (sin GD, original ilegible): el llamador degrada al original.
     */
    public static function miniatura_generar($rutaOriginal, $lado = 80)
    {
        $lado = max(32, min(512, (int)$lado));
        if (!extension_loaded('gd') || !function_exists('imagewebp') || !is_file($rutaOriginal)) {
            return '';
        }
        $destino = self::miniatura_ruta($rutaOriginal, $lado);
        if (is_file($destino)) {
            $hit = (string)@file_get_contents($destino);
            if ($hit !== '') {
                return $hit;
            }
        }
        $src = null;
        set_error_handler(static function () {
            return true;
        });
        try {
            $src = @imagecreatefromstring((string)@file_get_contents($rutaOriginal));
        } finally {
            restore_error_handler();
        }
        if (!$src) {
            return '';
        }
        $w0 = imagesx($src);
        $h0 = imagesy($src);
        if ($w0 < 1 || $h0 < 1) {
            return '';
        }
        // cover: el lado MENOR pasa a $lado; el sobrante se recorta al centro.
        $k = (float)$lado / max(1, min($w0, $h0));
        $sw = max($lado, (int)round($w0 * $k));
        $sh = max($lado, (int)round($h0 * $k));
        $tmp = imagecreatetruecolor($sw, $sh);
        imagealphablending($tmp, false);
        imagesavealpha($tmp, true);
        imagefill($tmp, 0, 0, imagecolorallocatealpha($tmp, 0, 0, 0, 127));
        imagealphablending($tmp, true);
        imagecopyresampled($tmp, $src, 0, 0, 0, 0, $sw, $sh, $w0, $h0);
        $dst = imagecreatetruecolor($lado, $lado);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
        imagealphablending($dst, true);
        imagecopyresampled($dst, $tmp, 0, 0, (int)(($sw - $lado) / 2), (int)(($sh - $lado) / 2), $lado, $lado, $lado, $lado);
        ob_start();
        $ok = @imagewebp($dst, null, 82);
        $out = ob_get_clean();
        if (PHP_VERSION_ID < 80000) {
            @imagedestroy($src);
            @imagedestroy($tmp);
            @imagedestroy($dst);
        }
        if (!$ok || $out === false || $out === '') {
            return '';
        }
        @file_put_contents($destino, $out);
        return $out;
    }

    /** Data URI WebP de la miniatura, o '' si no se puede o supera 20 KB. */
    public static function thumb_data($rutaOriginal, $lado = 80)
    {
        $bytes = self::miniatura_generar($rutaOriginal, $lado);
        if ($bytes === '' || strlen($bytes) > self::THUMB_MAX_BYTES) {
            return '';
        }
        return 'data:image/webp;base64,' . base64_encode($bytes);
    }

    /** Mime por extension (para servir bytes sin WordPress). */
    public static function mime_de($ruta)
    {
        $ext = strtolower((string)pathinfo((string)$ruta, PATHINFO_EXTENSION));
        $tipos = [
            'webp' => 'image/webp',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
        ];
        return $tipos[$ext] ?? 'application/octet-stream';
    }

    /**
     * Lista la biblioteca de una carpeta de identidad.
     * $opts: desde, identidad, url (callback id/op), thumb_data (bool).
     * Devuelve ['revision','sin_cambios','identidad','fotos','totales'] o ['error'=>'catalogo'].
     */
    public static function listar($dir, array $opts = [])
    {
        $rutaCat = self::ruta_catalogo($dir);
        $cat = self::catalogo_leer($dir);
        if (!is_array($cat) || !isset($cat['items']) || !is_array($cat['items'])) {
            return ['error' => 'catalogo'];
        }
        $items = $cat['items'];
        $revision = self::revision($rutaCat, $items);
        $identidad = (string)($opts['identidad'] ?? '');
        $desde = (string)($opts['desde'] ?? '');
        if ($desde !== '' && hash_equals($revision, $desde)) {
            return [
                'revision' => $revision,
                'sin_cambios' => true,
                'identidad' => $identidad,
                'fotos' => [],
                'totales' => ['fotos' => 0, 'bytes' => 0],
            ];
        }
        $url = isset($opts['url']) && is_callable($opts['url']) ? $opts['url'] : null;
        $fotos = [];
        $bytes = 0;
        foreach ($items as $id => $it) {
            if (!is_array($it)) {
                continue;
            }
            $id = (string)$id;
            // Spec 050 (2): no se anuncia una foto cuyo original ya no existe
            // (catalogo desactualizado tras una poda). Auto-sana en lectura, sin
            // escribir el catalogo (respeta `sin_lectura.php`).
            if (self::archivo($dir, $id, (string)($it['ext'] ?? '')) === '') {
                continue;
            }
            $peso = (int)($it['bytes'] ?? 0);
            $fotos[] = [
                'id' => $id,
                'url' => $url ? (string)$url($id, 'imagen') : '',
                'thumb' => $url ? (string)$url($id, 'miniatura') : '',
                'bytes' => $peso,
                'w' => (int)($it['w'] ?? 0),
                'h' => (int)($it['h'] ?? 0),
                'recetas' => (isset($it['recetas']) && is_array($it['recetas'])) ? $it['recetas'] : [],
                // Spec 045: ultima receta aceptada (objetivo + delta).
                'ajustes' => (isset($it['ajustes']) && is_array($it['ajustes'])) ? $it['ajustes'] : null,
                'creado' => (int)($it['creado'] ?? 0),
            ];
            $bytes += $peso;
        }
        usort($fotos, static function ($a, $b) {
            return (int)$b['creado'] - (int)$a['creado'];
        });
        if (!empty($opts['thumb_data'])) {
            $usado = 0;
            foreach ($fotos as $i => $foto) {
                if ($i >= self::THUMB_TOPE) {
                    break;
                }
                $it = $items[$foto['id']] ?? null;
                if (!is_array($it)) {
                    continue;
                }
                $ruta = self::archivo($dir, $foto['id'], (string)($it['ext'] ?? ''));
                if ($ruta === '') {
                    continue;
                }
                $data = self::thumb_data($ruta, self::MINIATURA_LADO);
                if ($data === '' || ($usado + strlen($data)) > self::THUMB_PRESUPUESTO) {
                    continue;
                }
                $fotos[$i]['thumb_data'] = $data;
                $usado += strlen($data);
            }
        }
        return [
            'revision' => $revision,
            'sin_cambios' => false,
            'identidad' => $identidad,
            'fotos' => $fotos,
            'totales' => ['fotos' => count($fotos), 'bytes' => $bytes],
        ];
    }

    /** Identidad publica de cache: `u{uid}` o `s{sha8(sid)}`. */
    public static function identidad($uid, $sid)
    {
        $uid = (int)$uid;
        if ($uid > 0) {
            return 'u' . $uid;
        }
        $sid = strtolower(trim((string)$sid));
        return $sid !== '' ? 's' . substr(sha1($sid), 0, 8) : '';
    }

    /** Firma de la credencial de cliente: `v1.<uid>.<exp>.<HMAC>`. */
    public static function firmar_uid($uid, $exp, $secret)
    {
        $uid = (int)$uid;
        $exp = (int)$exp;
        $firma = hash_hmac('sha256', 'v1|' . $uid . '|' . $exp, (string)$secret);
        return 'v1.' . $uid . '.' . $exp . '.' . $firma;
    }

    /** Valida la credencial `pmu_uid` sin WordPress. Devuelve 0 si no vale. */
    public static function uid_de_cookie($cookie, $secret)
    {
        $partes = explode('.', (string)$cookie);
        if (count($partes) !== 4 || $partes[0] !== 'v1') {
            return 0;
        }
        if (!ctype_digit($partes[1]) || !ctype_digit($partes[2])) {
            return 0;
        }
        $uid = (int)$partes[1];
        $exp = (int)$partes[2];
        if ($uid <= 0 || $exp <= time()) {
            return 0;
        }
        $esperada = hash_hmac('sha256', 'v1|' . $uid . '|' . $exp, (string)$secret);
        return hash_equals($partes[3], $esperada) ? $uid : 0;
    }

    /** Valida el formato de `pmu_sid` (UUID v4 o similar). Devuelve '' si no vale. */
    public static function sid_de_cookie($cookie)
    {
        $sid = strtolower(trim((string)$cookie));
        if ($sid === '' || strlen($sid) > 64 || preg_match('/^[a-z0-9][a-z0-9_-]{7,63}$/', $sid) !== 1) {
            return '';
        }
        return $sid;
    }

    /** UUID v4 (mismo formato que PMU_Sesion::uuid4). */
    public static function nuevo_sid()
    {
        $datos = random_bytes(16);
        $datos[6] = chr((ord($datos[6]) & 0x0f) | 0x40);
        $datos[8] = chr((ord($datos[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($datos), 4));
    }

    /**
     * Directorio de uploads de la identidad bajo `base`:
     * `orders/{uid}/uploads` (cliente) o `tmp/sesion-{sid}/uploads` (invitado).
     * Devuelve la ruta construida (aunque no exista) o '' si la identidad no vale.
     */
    public static function directorio_identidad($base, $uid, $sid)
    {
        $base = rtrim((string)$base, '/\\');
        $baseReal = realpath($base);
        if ($base === '' || $baseReal === false || !is_dir($baseReal)) {
            return '';
        }
        $uid = (int)$uid;
        if ($uid > 0) {
            $rel = 'orders' . DIRECTORY_SEPARATOR . $uid . DIRECTORY_SEPARATOR . 'uploads';
        } else {
            $sid = self::sid_de_cookie($sid);
            if ($sid === '') {
                return '';
            }
            $rel = 'tmp' . DIRECTORY_SEPARATOR . 'sesion-' . $sid . DIRECTORY_SEPARATOR . 'uploads';
        }
        return $baseReal . DIRECTORY_SEPARATOR . $rel;
    }
}