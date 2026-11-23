<?php
/**
 * media_lectura - puerta CLI del lector puro de la biblioteca (spec 042).
 *
 * Corre FUERA de WordPress: verifica catalogo, revision, miniaturas, listado,
 * identidad y credenciales, y el contrato HTTP de `media.php` (estado, cache,
 * 304, 403/404 y 503) con un servidor embebido. Uso: php tests/media_lectura.php
 */

if (PHP_SAPI !== 'cli') {
    exit;   // nunca por HTTP (AGENTS §9)
}

require __DIR__ . '/../inc/class-pmu-lectura.php';

$BASE = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'pmu-lectura-' . getmypid() . '-' . mt_rand(1000, 9999);
$ok = 0;
$mal = 0;

function check($nombre, $cond, $extra = '')
{
    global $ok, $mal;
    if ($cond) {
        $ok++;
        echo "  OK   $nombre\n";
    } else {
        $mal++;
        echo "  FAIL $nombre" . ($extra !== '' ? "  [$extra]" : '') . "\n";
    }
}

function imagen_valida($ruta, $w = 300, $h = 200, $formato = 'webp')
{
    $im = @imagecreatetruecolor($w, $h);
    if (!$im) {
        return false;
    }
    imagefilledrectangle($im, 0, 0, $w - 1, $h - 1, imagecolorallocate($im, 20, 120, 220));
    if ($formato === 'png') {
        return @imagepng($im, $ruta);
    }
    return @imagewebp($im, $ruta, 80);
}
/** Peticion HTTP GET del arnes: devuelve status, cabeceras y cuerpo (sin excepciones). */
function pmu_http_get($url, array $cookies = [], array $extra = [])
{
    $lineas = [];
    foreach ($extra as $clave => $valor) {
        $lineas[] = $clave . ': ' . $valor;
    }
    if (!empty($cookies)) {
        $pares = [];
        foreach ($cookies as $clave => $valor) {
            $pares[] = $clave . '=' . $valor;
        }
        $lineas[] = 'Cookie: ' . implode('; ', $pares);
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'GET',
        'header' => implode("\r\n", $lineas),
        'ignore_errors' => true,
        'timeout' => 10,
    ]]);
    $http_response_header = [];
    $cuerpo = @file_get_contents($url, false, $ctx);
    $estado = 0;
    $cabeceras = [];
    foreach ($http_response_header as $linea) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string)$linea, $m) === 1) {
            $estado = (int)$m[1];
            continue;
        }
        $pos = strpos((string)$linea, ':');
        if ($pos !== false) {
            $cabeceras[strtolower(trim(substr((string)$linea, 0, $pos)))] = trim(substr((string)$linea, $pos + 1));
        }
    }
    return [
        'status' => $estado,
        'headers' => $cabeceras,
        'body' => $cuerpo === false ? '' : $cuerpo,
        'json' => $cuerpo === false ? null : json_decode($cuerpo, true),
    ];
}

/**
 * Arranca `php -S` con un router minimo que sirve el `media.php` real (sin WordPress).
 * $script_filename en null usa el endpoint real; una ruta apunta SCRIPT_FILENAME a otro
 * lado (para probar el 503 de config ausente).
 */
function pmu_http_servidor($base, $raiz, array $env_extra, $nombre = 'router-media.php', $script_filename = null)
{
    $router = $base . DIRECTORY_SEPARATOR . $nombre;
    $destino = $script_filename === null
        ? $raiz . DIRECTORY_SEPARATOR . 'media.php'
        : $script_filename;
    $codigo = "<?php\n"
        . '$_SERVER[\'SCRIPT_NAME\'] = \'/media.php\';' . "\n"
        . '$_SERVER[\'SCRIPT_FILENAME\'] = ' . var_export($destino, true) . ';' . "\n"
        . 'require ' . var_export($raiz . DIRECTORY_SEPARATOR . 'media.php', true) . ';' . "\n";
    if (@file_put_contents($router, $codigo) === false) {
        return ['ok' => false, 'error' => 'no se pudo escribir el router'];
    }
    $sock = @stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
    if (!$sock) {
        return ['ok' => false, 'error' => 'sin puerto libre: ' . $errstr];
    }
    $nombreSock = (string)@stream_socket_get_name($sock, false);
    fclose($sock);
    $partes = explode(':', $nombreSock);
    $puerto = (int)end($partes);
    if ($puerto <= 0) {
        return ['ok' => false, 'error' => 'puerto libre no detectado (' . $nombreSock . ')'];
    }
    $log = $base . DIRECTORY_SEPARATOR . $nombre . '.log';
    $env = [
        'PATH' => (string)getenv('PATH'),
        'SystemRoot' => (string)getenv('SystemRoot'),
        'windir' => (string)getenv('windir'),
        'TEMP' => (string)getenv('TEMP'),
        'TMP' => (string)getenv('TMP'),
        'PMU_ARNES_RAIZ' => $raiz,
    ];
    foreach ($env_extra as $clave => $valor) {
        $env[$clave] = $valor;
    }
    $cmd = [PHP_BINARY, '-S', '127.0.0.1:' . $puerto, $router];
    $descrs = [1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']];
    $proc = @proc_open($cmd, $descrs, $pipes, $base, $env);
    if (!is_resource($proc)) {
        return ['ok' => false, 'error' => 'proc_open fallo (¿PHP disponible?)'];
    }
    return [
        'ok' => true,
        'proc' => $proc,
        'url' => 'http://127.0.0.1:' . $puerto . '/media.php',
        'log' => $log,
    ];
}

/** Espera a que el servidor responda `op=ping`. Devuelve '' si arranco, o la causa. */
function pmu_http_esperar($srv, $intentos = 120)
{
    for ($i = 0; $i < $intentos; $i++) {
        $r = pmu_http_get($srv['url'] . '?op=ping');
        if ($r['status'] === 200) {
            return '';
        }
        usleep(100000);
    }
    $cola = '';
    if (!empty($srv['log']) && is_file($srv['log'])) {
        $cola = str_replace(["\r", "\n"], ' | ', (string)@file_get_contents($srv['log']));
        $cola = substr(trim($cola), -400);
    }
    return 'no respondio (log: ' . ($cola !== '' ? $cola : 'vacio') . ')';
}

/** Corta el servidor de prueba. */
function pmu_http_parar($srv)
{
    if (empty($srv['proc']) || !is_resource($srv['proc'])) {
        return;
    }
    $estado = @proc_get_status($srv['proc']);
    $pid = is_array($estado) && !empty($estado['pid']) ? (int)$estado['pid'] : 0;
    if ($pid > 0 && DIRECTORY_SEPARATOR === '\\') {
        // En Windows `php -S` deja un proceso hijo sirviendo: se corta el arbol.
        $salida = !empty($srv['log']) ? $srv['log'] : 'nul';
        $kill = @proc_open(['taskkill', '/F', '/T', '/PID', (string)$pid], [1 => ['file', $salida, 'a'], 2 => ['file', $salida, 'a']], $kp);
        if (is_resource($kill)) {
            @proc_close($kill);
        }
    }
    @proc_terminate($srv['proc']);
    @proc_close($srv['proc']);
}

@mkdir($BASE, 0777, true);
$dir = $BASE . DIRECTORY_SEPARATOR . 'uploads';
@mkdir($dir, 0777, true);

try {
    /* ---- Catalogo v1 tolerante y revision ---- */
    check('catalogo ausente = null', PMU_Lectura::catalogo_leer($BASE . DIRECTORY_SEPARATOR . 'no-existe') === null);

    $id1 = 'aabbccddeeff';
    $id2 = '112233445566';
    $cat = ['version' => 1, 'items' => [
        $id1 => ['id' => $id1, 'ext' => 'webp', 'bytes' => 100, 'w' => 10, 'h' => 20, 'creado' => 100, 'ultimo_uso' => 100, 'recetas' => ['X' => ['a' => 1]], 'ajustes' => ['objetivo' => '1.5000-0-60000', 'configuracion' => ['modo' => 'cubrir']]],
        $id2 => ['id' => $id2, 'ext' => 'png', 'bytes' => 200, 'w' => 30, 'h' => 40, 'creado' => 200, 'ultimo_uso' => 200, 'recetas' => []],
    ]];
    $rutaCat = $dir . DIRECTORY_SEPARATOR . 'uploads.json';
    file_put_contents($rutaCat, json_encode($cat));
    $c = PMU_Lectura::catalogo_leer($dir);
    check('catalogo v1 legible', is_array($c) && count($c['items']) === 2);
    check('recetas normalizadas a array', is_array($c['items'][$id1]['recetas'] ?? null));

    $rev1 = PMU_Lectura::revision($rutaCat, $c['items']);
    check('revision de 12 hex', strlen($rev1) === 12 && ctype_xdigit($rev1));
    touch($rutaCat, time() + 10);
    clearstatcache();
    $rev2 = PMU_Lectura::revision($rutaCat, $c['items']);
    check('revision cambia con el mtime', $rev2 !== $rev1);

    /* ---- Resolucion de archivos y guardrails ---- */
    $ruta1 = $dir . DIRECTORY_SEPARATOR . $id1 . '.webp';
    $ruta2 = $dir . DIRECTORY_SEPARATOR . $id2 . '.png';
    imagen_valida($ruta1, 300, 200, 'webp');
    imagen_valida($ruta2, 200, 300, 'png');
    check('archivo resuelve por id y extension', PMU_Lectura::archivo($dir, $id1, 'webp') === realpath($ruta1));
    check('archivo resuelve sin extension', PMU_Lectura::archivo($dir, $id2) === realpath($ruta2));
    check('archivo rechaza id invalido', PMU_Lectura::archivo($dir, 'ZZZ', '') === '');
    check('archivo rechaza extension no permitida', PMU_Lectura::archivo($dir, $id1, 'exe') === '');
    check('archivo rechaza traversal', PMU_Lectura::archivo($dir, '../x', '') === '');
    $link = $dir . DIRECTORY_SEPARATOR . 'ffffffffffff.webp';
    if (@symlink($ruta1, $link)) {
        check('archivo rechaza symlink', PMU_Lectura::archivo($dir, 'ffffffffffff', 'webp') === '');
        @unlink($link);
    } else {
        check('symlink no disponible (se omite)', true);
    }

    /* ---- Miniatura 80x80 cover y miniatura embebida ---- */
    $rutaMini = PMU_Lectura::miniatura_ruta($ruta1, 80);
    check('ruta de miniatura = {id}-80x80.webp', $rutaMini === $dir . DIRECTORY_SEPARATOR . $id1 . '-80x80.webp');
    $mini = PMU_Lectura::miniatura_generar($ruta1, 80);
    check('miniatura genera bytes', is_string($mini) && $mini !== '');
    check('la miniatura queda en disco', is_file($rutaMini));
    $dim = @getimagesizefromstring($mini);
    check('la miniatura es 80x80', is_array($dim) && (int)$dim[0] === 80 && (int)$dim[1] === 80);
    @unlink($rutaMini);
    $otra = PMU_Lectura::miniatura_generar($ruta1, 80);
    check('la miniatura se regenera al borrarla', is_string($otra) && $otra !== '' && is_file($rutaMini));
    $data = PMU_Lectura::thumb_data($ruta1, 80);
    check('thumb_data es data URI webp', strpos((string)$data, 'data:image/webp;base64,') === 0);
    check('thumb_data pesa <= 20 KB', strlen((string)$data) <= 20480, 'bytes=' . strlen((string)$data));
    check('mime de webp', PMU_Lectura::mime_de($ruta1) === 'image/webp');

    /* ---- listar: orden, urls, sin_cambios y miniaturas ---- */
    $res = PMU_Lectura::listar($dir, [
        'identidad' => 'u7',
        'url' => static function ($id, $op) {
            return 'media.php?op=' . $op . '&id=' . $id;
        },
        'thumb_data' => true,
    ]);
    check('listar trae las 2 fotos', isset($res['fotos']) && count($res['fotos']) === 2);
    check('listar ordena por creado desc', ($res['fotos'][0]['id'] ?? '') === $id2, (string)($res['fotos'][0]['id'] ?? ''));
    check('listar trae url y thumb', strpos((string)($res['fotos'][0]['url'] ?? ''), 'op=imagen') !== false
        && strpos((string)($res['fotos'][0]['thumb'] ?? ''), 'op=miniatura') !== false);
    check('listar publica las recetas por contexto',
        isset($res['fotos'][1]['recetas']['X']),
        json_encode($res['fotos'][1]['recetas'] ?? null));
    check('listar publica los ajustes del cliente',
        isset($res['fotos'][1]['ajustes']['objetivo'])
        && ($res['fotos'][1]['ajustes']['objetivo'] ?? '') === '1.5000-0-60000',
        json_encode($res['fotos'][1]['ajustes'] ?? null));
    $conThumb = 0;
    foreach ($res['fotos'] as $f) {
        if (isset($f['thumb_data'])) {
            $conThumb++;
        }
    }
    check('listar embebe miniaturas', $conThumb >= 1, 'conThumb=' . $conThumb);
    $sin = PMU_Lectura::listar($dir, ['identidad' => 'u7', 'desde' => $res['revision']]);
    check('sin_cambios con la misma revision', !empty($sin['sin_cambios']) && $sin['fotos'] === []);
    check('revision estable entre llamadas', $sin['revision'] === $res['revision']);

    /* ---- Identidad y credenciales ---- */
    check('identidad de cliente', PMU_Lectura::identidad(7, 'abc12345') === 'u7');
    check('identidad de invitado', PMU_Lectura::identidad(0, 'abc12345') === 's' . substr(sha1('abc12345'), 0, 8));
    check('identidad vacia', PMU_Lectura::identidad(0, '') === '');
    $secret = str_repeat('a', 64);
    $exp = time() + 100;
    $cookie = PMU_Lectura::firmar_uid(7, $exp, $secret);
    check('credencial valida', PMU_Lectura::uid_de_cookie($cookie, $secret) === 7);
    check('credencial con otro secreto no vale', PMU_Lectura::uid_de_cookie($cookie, str_repeat('b', 64)) === 0);
    check('credencial vencida no vale', PMU_Lectura::uid_de_cookie(PMU_Lectura::firmar_uid(7, time() - 1, $secret), $secret) === 0);
    check('credencial manipulada no vale', PMU_Lectura::uid_de_cookie('v1.7.' . $exp . '.deadbeef', $secret) === 0);
    check('sid valido', PMU_Lectura::sid_de_cookie('abc12345') === 'abc12345');
    check('sid invalido', PMU_Lectura::sid_de_cookie('../x') === '');
    check('nuevo sid UUID v4', preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', PMU_Lectura::nuevo_sid()) === 1);
    check('directorio cliente', PMU_Lectura::directorio_identidad($BASE, 7, '') === realpath($BASE) . DIRECTORY_SEPARATOR . 'orders' . DIRECTORY_SEPARATOR . '7' . DIRECTORY_SEPARATOR . 'uploads');
    check('directorio invitado', PMU_Lectura::directorio_identidad($BASE, 0, 'abc12345') === realpath($BASE) . DIRECTORY_SEPARATOR . 'tmp' . DIRECTORY_SEPARATOR . 'sesion-abc12345' . DIRECTORY_SEPARATOR . 'uploads');
    check('directorio con sid invalido', PMU_Lectura::directorio_identidad($BASE, 0, '../x') === '');
    /* ---- Contrato HTTP de media.php (servidor embebido, sin WordPress) ---- */
    $raizPlugin = dirname(__DIR__);
    $carpetaHttp = $BASE . DIRECTORY_SEPARATOR . 'tmp' . DIRECTORY_SEPARATOR . 'sesion-abc12345' . DIRECTORY_SEPARATOR . 'uploads';
    @mkdir($carpetaHttp, 0777, true);
    $hid1 = 'aabbccddeeff';
    $hid2 = '112233445566';
    $hruta1 = $carpetaHttp . DIRECTORY_SEPARATOR . $hid1 . '.webp';
    $hruta2 = $carpetaHttp . DIRECTORY_SEPARATOR . $hid2 . '.png';
    copy($ruta1, $hruta1);
    copy($ruta2, $hruta2);
    file_put_contents($carpetaHttp . DIRECTORY_SEPARATOR . 'uploads.json', json_encode([
        'version' => 1,
        'items' => [
            $hid1 => ['id' => $hid1, 'ext' => 'webp', 'bytes' => filesize($hruta1), 'w' => 300, 'h' => 200, 'creado' => 100, 'ultimo_uso' => 100, 'recetas' => [], 'ajustes' => ['objetivo' => '1.5000-0-60000', 'configuracion' => ['modo' => 'cubrir']]],
            $hid2 => ['id' => $hid2, 'ext' => 'png', 'bytes' => filesize($hruta2), 'w' => 200, 'h' => 300, 'creado' => 200, 'ultimo_uso' => 200, 'recetas' => []],
        ],
    ]));
    $carpetaCli = $BASE . DIRECTORY_SEPARATOR . 'orders' . DIRECTORY_SEPARATOR . '7' . DIRECTORY_SEPARATOR . 'uploads';
    @mkdir($carpetaCli, 0777, true);
    $cid = '0123456789ab';
    $cruta = $carpetaCli . DIRECTORY_SEPARATOR . $cid . '.png';
    copy($ruta2, $cruta);
    file_put_contents($carpetaCli . DIRECTORY_SEPARATOR . 'uploads.json', json_encode([
        'version' => 1,
        'items' => [
            $cid => ['id' => $cid, 'ext' => 'png', 'bytes' => filesize($cruta), 'w' => 200, 'h' => 300, 'creado' => 50, 'ultimo_uso' => 50, 'recetas' => []],
        ],
    ]));
    $mediaDir = $BASE . DIRECTORY_SEPARATOR . '.media';
    @mkdir($mediaDir, 0777, true);
    $secreto = str_repeat('a', 64);
    file_put_contents($mediaDir . DIRECTORY_SEPARATOR . 'config.json', json_encode([
        'version' => 1,
        'base' => realpath($BASE),
        'secret' => $secreto,
        'creado' => time(),
    ]));
    $srv = pmu_http_servidor($BASE, $raizPlugin, ['PMU_MEDIA_CONFIG' => $mediaDir . DIRECTORY_SEPARATOR . 'config.json']);
    if (empty($srv['ok'])) {
        check('servidor de prueba de media.php arranca', false, (string)($srv['error'] ?? ''));
    } else {
        $falloArranque = pmu_http_esperar($srv);
        check('servidor de prueba de media.php arranca', $falloArranque === '', $falloArranque);
        if ($falloArranque === '') {
            $url = $srv['url'];
            $ro = pmu_http_get($url . '?op=ping');
            check('HTTP ping = 200', $ro['status'] === 200, 'status=' . $ro['status']);
            check('HTTP ping responde ok', is_array($ro['json']) && !empty($ro['json']['data']['ok']));

            $ro = pmu_http_get($url . '?op=listar');
            check('HTTP listar sin identidad = 200', $ro['status'] === 200, 'status=' . $ro['status']);
            check('HTTP listar sin identidad emite pmu_sid', strpos((string)($ro['headers']['set-cookie'] ?? ''), 'pmu_sid=') !== false, (string)($ro['headers']['set-cookie'] ?? 'sin cookie'));
            check('HTTP listar sin identidad = lista vacia', is_array($ro['json']) && isset($ro['json']['data']['fotos']) && count((array)$ro['json']['data']['fotos']) === 0);

            $ro = pmu_http_get($url . '?op=listar', ['pmu_sid' => 'abc12345']);
            check('HTTP listar del invitado = 200', $ro['status'] === 200, 'status=' . $ro['status']);
            $fotos = is_array($ro['json']) ? (array)($ro['json']['data']['fotos'] ?? []) : [];
            check('HTTP listar del invitado trae sus 2 fotos', count($fotos) === 2, 'n=' . count($fotos));
            $revision = (string)($ro['json']['data']['revision'] ?? '');
            check('HTTP listar publica revision de 12 hex', strlen($revision) === 12 && ctype_xdigit($revision), $revision !== '' ? $revision : 'vacia');
            check('HTTP listar es JSON y no cachea', strpos((string)($ro['headers']['content-type'] ?? ''), 'application/json') !== false && strtolower((string)($ro['headers']['cache-control'] ?? '')) === 'no-store', (string)($ro['headers']['cache-control'] ?? ''));
            $conThumb = 0;
            foreach ($fotos as $foto) {
                if (strpos((string)($foto['thumb_data'] ?? ''), 'data:image/webp;base64,') === 0) {
                    $conThumb++;
                }
            }
            check('HTTP listar embebe miniaturas', $conThumb >= 1, 'conThumb=' . $conThumb);
            check('HTTP listar trae las recetas por contexto', count($fotos) === 2 && array_key_exists('recetas', $fotos[0]) && array_key_exists('recetas', $fotos[1]));
    check('HTTP listar trae los ajustes del cliente',
        isset($fotos[1]['ajustes']['objetivo']) && ($fotos[1]['ajustes']['objetivo'] ?? '') === '1.5000-0-60000',
        json_encode($fotos[1]['ajustes'] ?? null));

            $ro = pmu_http_get($url . '?op=listar&desde=' . rawurlencode($revision), ['pmu_sid' => 'abc12345']);
            check('HTTP listar con desde = sin_cambios', is_array($ro['json']) && !empty($ro['json']['data']['sin_cambios']) && count((array)($ro['json']['data']['fotos'] ?? [])) === 0, 'status=' . $ro['status']);
            $bytes1 = (string)file_get_contents($hruta1);
            $ro = pmu_http_get($url . '?op=imagen&id=' . $hid1, ['pmu_sid' => 'abc12345']);
            check('HTTP imagen = 200', $ro['status'] === 200, 'status=' . $ro['status']);
            check('HTTP imagen sirve los bytes del original', $ro['body'] === $bytes1, 'bytes=' . strlen($ro['body']));
            check('HTTP imagen es image/webp', strpos((string)($ro['headers']['content-type'] ?? ''), 'image/webp') !== false, (string)($ro['headers']['content-type'] ?? ''));
            check('HTTP imagen cachea 7 dias', strpos((string)($ro['headers']['cache-control'] ?? ''), 'max-age=604800') !== false, (string)($ro['headers']['cache-control'] ?? ''));
            check('HTTP imagen varia por cookie', strpos((string)($ro['headers']['vary'] ?? ''), 'Cookie') !== false, (string)($ro['headers']['vary'] ?? ''));
            check('HTTP imagen manda nosniff', (string)($ro['headers']['x-content-type-options'] ?? '') === 'nosniff');
            $etag1 = '"' . sha1((string)@filemtime($hruta1) . '-' . (string)@filesize($hruta1)) . '"';
            $ro = pmu_http_get($url . '?op=imagen&id=' . $hid1, ['pmu_sid' => 'abc12345'], ['If-None-Match' => $etag1]);
            check('HTTP imagen con If-None-Match = 304', $ro['status'] === 304, 'status=' . $ro['status'] . ' etag=' . $etag1);

            $ro = pmu_http_get($url . '?op=miniatura&id=' . $hid1, ['pmu_sid' => 'abc12345']);
            check('HTTP miniatura = 200', $ro['status'] === 200, 'status=' . $ro['status']);
            check('HTTP miniatura es image/webp', strpos((string)($ro['headers']['content-type'] ?? ''), 'image/webp') !== false, (string)($ro['headers']['content-type'] ?? ''));
            $dimMini = @getimagesizefromstring($ro['body']);
            check('HTTP miniatura mide 80x80', is_array($dimMini) && (int)$dimMini[0] === 80 && (int)$dimMini[1] === 80);
            $etagMini = '"' . sha1($ro['body']) . '"';
            $ro = pmu_http_get($url . '?op=miniatura&id=' . $hid1, ['pmu_sid' => 'abc12345'], ['If-None-Match' => $etagMini]);
            check('HTTP miniatura con If-None-Match = 304', $ro['status'] === 304, 'status=' . $ro['status']);

            $ro = pmu_http_get($url . '?op=imagen&id=' . $hid2, ['pmu_sid' => 'abc12345']);
            check('HTTP imagen png = 200 image/png', $ro['status'] === 200 && strpos((string)($ro['headers']['content-type'] ?? ''), 'image/png') !== false, 'status=' . $ro['status'] . ' ct=' . (string)($ro['headers']['content-type'] ?? ''));

            $ro = pmu_http_get($url . '?op=listar', ['pmu_uid' => PMU_Lectura::firmar_uid(7, time() + 3600, $secreto)]);
            $fotosCli = is_array($ro['json']) ? (array)($ro['json']['data']['fotos'] ?? []) : [];
            check('HTTP listar del cliente = 200 y su foto', $ro['status'] === 200 && count($fotosCli) === 1 && (string)($fotosCli[0]['id'] ?? '') === $cid, 'status=' . $ro['status'] . ' n=' . count($fotosCli));

            $ro = pmu_http_get($url . '?op=imagen&id=ZZZ', ['pmu_sid' => 'abc12345']);
            check('HTTP imagen con id invalido = 400', $ro['status'] === 400, 'status=' . $ro['status']);
            $ro = pmu_http_get($url . '?op=imagen&id=ffffffffffff', ['pmu_sid' => 'abc12345']);
            check('HTTP imagen inexistente = 404', $ro['status'] === 404, 'status=' . $ro['status']);
            $ro = pmu_http_get($url . '?op=otra', ['pmu_sid' => 'abc12345']);
            check('HTTP op desconocida = 400 media:op', $ro['status'] === 400 && (string)($ro['json']['data'] ?? '') === 'media:op', 'status=' . $ro['status']);

            $mala = ['pmu_uid' => 'v1.7.' . (time() + 3600) . '.deadbeef'];
            $ro = pmu_http_get($url . '?op=listar', $mala);
            check('HTTP credencial alterada = 403 media:identidad', $ro['status'] === 403 && (string)($ro['json']['data'] ?? '') === 'media:identidad' && !empty($ro['json']['fallback']), 'status=' . $ro['status']);
            $ro = pmu_http_get($url . '?op=listar', ['pmu_sid' => '../x']);
            check('HTTP sid invalido = 403', $ro['status'] === 403, 'status=' . $ro['status']);
            $ro = pmu_http_get($url . '?op=imagen&id=' . $hid1, $mala);
            check('HTTP imagen con credencial alterada = 403', $ro['status'] === 403, 'status=' . $ro['status']);
        }
        pmu_http_parar($srv);
    }
    $candidato = dirname(dirname($raizPlugin)) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pmu' . DIRECTORY_SEPARATOR . '.media' . DIRECTORY_SEPARATOR . 'config.json';
    if (is_file($candidato)) {
        check('HTTP sin config = 503 (omitido: existe ' . $candidato . ')', true);
    } else {
        $srv503 = pmu_http_servidor($BASE, $raizPlugin, [], 'router-media-503.php', $BASE . DIRECTORY_SEPARATOR . 'no-existe' . DIRECTORY_SEPARATOR . 'media.php');
        if (empty($srv503['ok'])) {
            check('servidor de prueba sin config arranca', false, (string)($srv503['error'] ?? ''));
        } else {
            $fallo503 = pmu_http_esperar($srv503);
            check('servidor de prueba sin config arranca', $fallo503 === '', $fallo503);
            if ($fallo503 === '') {
                $ro = pmu_http_get($srv503['url'] . '?op=ping');
                check('HTTP ping sin config = 200', $ro['status'] === 200, 'status=' . $ro['status']);
                $ro = pmu_http_get($srv503['url'] . '?op=listar');
                check('HTTP listar sin config = 503 media:config', $ro['status'] === 503 && (string)($ro['json']['data'] ?? '') === 'media:config', 'status=' . $ro['status'] . ' data=' . (string)($ro['json']['data'] ?? ''));
                check('HTTP listar sin config pide respaldo', !empty($ro['json']['fallback']));
            }
            pmu_http_parar($srv503);
        }
    }
} catch (\Throwable $e) {
    $mal++;
    echo '  FAIL excepcion: ' . $e->getMessage() . "\n";
} finally {
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($BASE, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $f) {
        $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
    }
    @rmdir($BASE);
}

echo "\n";
if ($mal === 0) {
    echo 'MEDIA LECTURA OK (' . $ok . " checks)\n";
    exit(0);
}
echo 'MEDIA LECTURA FALLA (' . $mal . ' de ' . ($ok + $mal) . ")\n";
exit(1);