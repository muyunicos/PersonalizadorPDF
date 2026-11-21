<?php
/**
 * media_lectura - puerta CLI del lector puro de la biblioteca (spec 042).
 *
 * Corre FUERA de WordPress: verifica catalogo, revision, miniaturas, listado,
 * identidad y credenciales. Uso: php tests/media_lectura.php
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

@mkdir($BASE, 0777, true);
$dir = $BASE . DIRECTORY_SEPARATOR . 'uploads';
@mkdir($dir, 0777, true);

try {
    /* ---- Catalogo v1 tolerante y revision ---- */
    check('catalogo ausente = null', PMU_Lectura::catalogo_leer($BASE . DIRECTORY_SEPARATOR . 'no-existe') === null);

    $id1 = 'aabbccddeeff';
    $id2 = '112233445566';
    $cat = ['version' => 1, 'items' => [
        $id1 => ['id' => $id1, 'ext' => 'webp', 'bytes' => 100, 'w' => 10, 'h' => 20, 'creado' => 100, 'ultimo_uso' => 100, 'recetas' => ['X' => ['a' => 1]]],
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