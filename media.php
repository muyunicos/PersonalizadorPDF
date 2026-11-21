<?php
/**
 * media.php - endpoint de lectura de la biblioteca del comprador (spec 042).
 *
 * No incluye wp-load: lee el catalogo y los archivos, resuelve la identidad por
 * cookies y responde JSON o bytes. Es SOLO lectura; las escrituras siguen en
 * admin-post.php con nonce/capacidad.
 */
define('PMU_MEDIA', true);

require __DIR__ . '/inc/class-pmu-lectura.php';

/** Config (base + secreto) buscando `.media/config.json` en candidatos conocidos. */
function pmu_media_config()
{
    $candidatos = [];
    $script = (string)($_SERVER['SCRIPT_FILENAME'] ?? '');
    if ($script !== '') {
        $wpContent = dirname(dirname(dirname($script)));
        $candidatos[] = $wpContent . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pmu'
            . DIRECTORY_SEPARATOR . '.media' . DIRECTORY_SEPARATOR . 'config.json';
    }
    $candidatos[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '..'
        . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pmu' . DIRECTORY_SEPARATOR . '.media'
        . DIRECTORY_SEPARATOR . 'config.json';
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $candidatos[] = rtrim((string)$_SERVER['DOCUMENT_ROOT'], '/\\') . DIRECTORY_SEPARATOR . 'wp-content'
            . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pmu' . DIRECTORY_SEPARATOR . '.media'
            . DIRECTORY_SEPARATOR . 'config.json';
    }
    $env = getenv('PMU_MEDIA_CONFIG');
    if ($env) {
        $candidatos[] = (string)$env;
    }
    foreach ($candidatos as $ruta) {
        if (!is_file($ruta) || !is_readable($ruta)) {
            continue;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        if (!is_array($datos) || (int)($datos['version'] ?? 0) !== 1) {
            continue;
        }
        $base = (string)($datos['base'] ?? '');
        $secret = (string)($datos['secret'] ?? '');
        if ($base === '' || !is_dir($base) || preg_match('/^[a-f0-9]{64}$/', $secret) !== 1) {
            continue;
        }
        $real = realpath($base);
        if ($real === false || !is_dir($real)) {
            continue;
        }
        return ['base' => $real, 'secret' => $secret];
    }
    return null;
}

/**
 * Identidad de lectura:
 *   uid > 0 -> cliente; sid != '' -> invitado; ambos vacios -> invitado nuevo.
 * Devuelve ['error'=>'identidad'] si hay una credencial presente pero invalida.
 */
function pmu_media_identidad($secret)
{
    $uid = 0;
    $sid = '';
    $uidCookie = isset($_COOKIE['pmu_uid']) ? (string)$_COOKIE['pmu_uid'] : '';
    $sidCookie = isset($_COOKIE['pmu_sid']) ? (string)$_COOKIE['pmu_sid'] : '';
    if ($uidCookie !== '') {
        $uid = (int)PMU_Lectura::uid_de_cookie($uidCookie, $secret);
        if ($uid <= 0) {
            return ['error' => 'identidad'];
        }
    }
    if ($uid <= 0 && $sidCookie !== '') {
        $sid = PMU_Lectura::sid_de_cookie($sidCookie);
        if ($sid === '') {
            return ['error' => 'identidad'];
        }
    }
    return [
        'uid' => $uid,
        'sid' => $sid,
        'identidad' => PMU_Lectura::identidad($uid, $sid),
    ];
}

/** Emite `pmu_sid` para un invitado nuevo. */
function pmu_media_set_sid($sid)
{
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    if (!headers_sent()) {
        setcookie('pmu_sid', $sid, [
            'expires' => time() + 30 * 86400,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => $secure,
        ]);
    }
    $_COOKIE['pmu_sid'] = $sid;
}

/** Respuesta JSON (listar/ping/errores de lista). */
function pmu_media_json($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    header('Content-Length: ' . strlen((string)$json));
    echo $json;
    exit;
}

function pmu_media_error($status, $code, $fallback = false)
{
    pmu_media_json(['success' => false, 'data' => $code, 'fallback' => $fallback], $status);
}

/** Error de imagen: solo status, sin cuerpo JSON (no romper el <img>). */
function pmu_media_error_imagen($status)
{
    http_response_code($status);
    exit;
}

/** Sirve un archivo con cache/ETag/304. */
function pmu_media_servir($ruta)
{
    $mtime = (int)@filemtime($ruta);
    $size = (int)@filesize($ruta);
    $etag = '"' . sha1($mtime . '-' . $size) . '"';
    header('Cache-Control: private, max-age=604800');
    header('ETag: ' . $etag);
    header('Vary: Cookie');
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: ' . PMU_Lectura::mime_de($ruta));
    header('Content-Length: ' . $size);
    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim((string)$_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
        http_response_code(304);
        exit;
    }
    readfile($ruta);
    exit;
}

/** Sirve bytes (miniatura generada) con cache/ETag/304. */
function pmu_media_servir_bytes($bytes, $mime)
{
    $etag = '"' . sha1($bytes) . '"';
    header('Cache-Control: private, max-age=604800');
    header('ETag: ' . $etag);
    header('Vary: Cookie');
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($bytes));
    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim((string)$_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
        http_response_code(304);
        exit;
    }
    echo $bytes;
    exit;
}

$op = (string)($_GET['op'] ?? ($_POST['op'] ?? ''));
if ($op === 'ping') {
    pmu_media_json(['success' => true, 'data' => ['ok' => true]]);
}
if ($op !== 'listar' && $op !== 'imagen' && $op !== 'miniatura') {
    pmu_media_error(400, 'media:op', true);
}
$config = pmu_media_config();
if ($config === null) {
    pmu_media_error(503, 'media:config', true);
}
$identidad = pmu_media_identidad($config['secret']);
if (isset($identidad['error'])) {
    pmu_media_error(403, 'media:identidad', true);
}
$uid = (int)$identidad['uid'];
$sid = (string)$identidad['sid'];
if ($uid <= 0 && $sid === '' && $op === 'listar') {
    $sid = PMU_Lectura::nuevo_sid();
    pmu_media_set_sid($sid);
    $identidad['sid'] = $sid;
    $identidad['identidad'] = PMU_Lectura::identidad(0, $sid);
}
$dir = PMU_Lectura::directorio_identidad($config['base'], $uid, $sid);
if ($dir === '') {
    pmu_media_error(403, 'media:identidad', $op === 'listar');
}
$self = (string)($_SERVER['SCRIPT_NAME'] ?? 'media.php');
if ($self === '') {
    $self = 'media.php';
}
if ($op === 'listar') {
    $desde = (string)($_GET['desde'] ?? '');
    $res = PMU_Lectura::listar($dir, [
        'desde' => $desde,
        'identidad' => (string)$identidad['identidad'],
        'url' => static function ($id, $operacion) use ($self, $identidad) {
            return $self . '?op=' . rawurlencode($operacion)
                . '&u=' . rawurlencode((string)$identidad['identidad'])
                . '&id=' . rawurlencode((string)$id);
        },
        'thumb_data' => true,
    ]);
    if (isset($res['error'])) {
        if (!is_dir($dir)) {
            pmu_media_json(['success' => true, 'data' => [
                'revision' => '',
                'sin_cambios' => false,
                'identidad' => (string)$identidad['identidad'],
                'fotos' => [],
                'totales' => ['fotos' => 0, 'bytes' => 0],
            ]]);
        }
        pmu_media_error(200, 'media:catalogo', true);
    }
    pmu_media_json(['success' => true, 'data' => $res]);
}
$id = (string)($_GET['id'] ?? '');
if (preg_match('/^[a-f0-9]{12}$/', $id) !== 1) {
    pmu_media_error_imagen(400);
}
if (!is_dir($dir)) {
    pmu_media_error_imagen(404);
}
$cat = PMU_Lectura::catalogo_leer($dir);
$ext = is_array($cat) && isset($cat['items'][$id]['ext']) ? (string)$cat['items'][$id]['ext'] : '';
$ruta = PMU_Lectura::archivo($dir, $id, $ext);
if ($ruta === '') {
    pmu_media_error_imagen(404);
}
if ($op === 'miniatura') {
    $destino = PMU_Lectura::miniatura_ruta($ruta, 80);
    $bytes = is_file($destino) ? (string)@file_get_contents($destino) : '';
    if ($bytes === '') {
        $bytes = PMU_Lectura::miniatura_generar($ruta, 80);
    }
    if ($bytes === '') {
        pmu_media_servir($ruta);
    }
    pmu_media_servir_bytes($bytes, 'image/webp');
}
pmu_media_servir($ruta);