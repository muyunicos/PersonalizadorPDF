<?php
/**
 * Catalogo de uploads del comprador (spec 040): carpetas por identidad, mutacion
 * serializada (A-4), upsert/merge de recetas, miniatura 80x80 cover (A-2) y
 * reconstruccion desde archivos (F-006).
 *
 * Corre FUERA de WordPress: stubbea las funciones de WP que usa PMU_Uploads y
 * trabaja en %TEMP% (permisos de Windows). Uso: php tests/catalogo_uploads.php
 */

if (PHP_SAPI !== 'cli') {
    exit;   // nunca por HTTP (AGENTS §9)
}

define('ABSPATH', __DIR__ . '/');
$BASE = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'pmu-cat-' . getmypid();

function wp_upload_dir() {
    global $BASE;
    return ['basedir' => $BASE, 'baseurl' => 'http://example.test/wp-content/uploads'];
}
function wp_mkdir_p($d) { return @mkdir($d, 0777, true) || is_dir($d); }
function wp_json_encode($d, $o = 0) { return json_encode($d, $o); }
function wp_is_writable($d) { return is_writable($d); }
function trailingslashit($s) { return rtrim($s, '/\\') . '/'; }

require __DIR__ . '/../inc/class-pmu-uploads.php';

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

@mkdir($BASE, 0777, true);

try {
    $u = new PMU_Uploads();

    /* A-1: una carpeta por identidad. */
    $dirCli = $u->dir_uploads_identidad(['uid' => 7, 'sid' => 'abc123']);
    check('cliente -> orders/{uid}/uploads',
        strpos($dirCli, 'orders' . DIRECTORY_SEPARATOR . '7' . DIRECTORY_SEPARATOR . 'uploads') !== false, $dirCli);
    $dirInv = $u->dir_uploads_identidad(['uid' => 0, 'sid' => 'abc123']);
    check('invitado -> tmp/sesion-{sid}/uploads',
        strpos($dirInv, 'sesion-abc123' . DIRECTORY_SEPARATOR . 'uploads') !== false, $dirInv);

    /* A-4: catalogo vacio y escritura serializada. */
    check('catalogo ausente = null', $u->catalogo_leer($dirCli) === null);
    $id = 'abcdef123456';
    $u->catalogo_upsert($dirCli, $id, [
        'ext' => 'webp', 'bytes' => 10, 'w' => 100, 'h' => 50, 'creado' => 1, 'ultimo_uso' => 2,
    ]);
    $c = $u->catalogo_leer($dirCli);
    check('upsert -> entrada legible', is_array($c) && isset($c['items'][$id]));
    check('la entrada trae id y medidas', is_array($c) && (int)($c['items'][$id]['w'] ?? 0) === 100);

    /* Merge profundo de recetas: no pisa el resto de la entrada. */
    $u->catalogo_upsert($dirCli, $id, [
        'recetas' => ['FF0000-100x50-1' => ['gid' => 'FF0000', 'params' => ['v' => 2]]],
    ]);
    $c = $u->catalogo_leer($dirCli);
    check('receta mergeada (no pisa el resto)',
        is_array($c)
        && isset($c['items'][$id]['recetas']['FF0000-100x50-1'])
        && (int)($c['items'][$id]['w'] ?? 0) === 100);

    /* A-2: miniatura 80x80 cover. */
    check('ruta de miniatura = {id}-80x80.webp',
        $u->miniatura_ruta('/tmp/' . $id . '.webp') === '/tmp/' . $id . '-80x80.webp');
    $src = @imagecreatetruecolor(300, 200);
    if ($src) {
        imagefilledrectangle($src, 0, 0, 299, 199, imagecolorallocate($src, 200, 30, 40));
        $ruta = $dirCli . DIRECTORY_SEPARATOR . $id . '.webp';
        @imagewebp($src, $ruta, 90);
        $bytes = $u->miniatura_generar($ruta, 80);
        check('miniatura genera bytes', is_string($bytes) && $bytes !== '');
        check('la miniatura queda en disco', is_file($u->miniatura_ruta($ruta, 80)));
        $dim = @getimagesizefromstring($bytes);
        check('la miniatura es 80x80', is_array($dim) && (int)$dim[0] === 80 && (int)$dim[1] === 80);
    } else {
        check('GD disponible para la miniatura', false, 'sin GD');
    }

    /* F-006: reconstruccion solo desde archivos, sin recetas. */
    $u->catalogo_reconstruir($dirCli);
    $c = $u->catalogo_leer($dirCli);
    check('reconstruccion encuentra la imagen', is_array($c) && isset($c['items'][$id]));
    check('reconstruccion NO recupera recetas', is_array($c) && empty($c['items'][$id]['recetas'] ?? ['x']));

    /* Baja idempotente. */
    $u->catalogo_borrar($dirCli, $id);
    $c = $u->catalogo_leer($dirCli);
    check('borrar quita la entrada', is_array($c) && !isset($c['items'][$id]));
    check('borrar es idempotente', $u->catalogo_borrar($dirCli, $id) === true);

    /* A-4: 10 escrituras seguidas no pierden ninguna. */
    for ($i = 0; $i < 10; $i++) {
        $u->catalogo_upsert($dirCli, str_pad(dechex($i + 1), 12, '0'), ['w' => 1, 'h' => 1]);
    }
    $c = $u->catalogo_leer($dirCli);
    check('10 upserts -> 10 entradas', is_array($c) && count($c['items']) === 10,
        'items=' . (is_array($c) ? count($c['items']) : -1));
} catch (\Throwable $e) {
    $mal++;
    echo '  FAIL excepcion: ' . $e->getMessage() . "\n";
} finally {
    // Higiene: el arnes no deja basura en %TEMP%.
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
    echo 'CATALOGO UPLOADS OK (' . $ok . " checks)\n";
    exit(0);
}
echo 'CATALOGO UPLOADS FALLA (' . $mal . " de " . ($ok + $mal) . ")\n";
exit(1);