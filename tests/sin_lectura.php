<?php
// Test CLI: nunca ejecutable por HTTP (tests/ viaja con el plugin al hosting).
if (PHP_SAPI !== 'cli') {
    exit;
}
/**
 * RC47: LEER no escribe (spec de galerias, correccion del motor).
 *
 * `PMU_Uploads::catalogo()` sembraba el inventario vacio en disco cuando no lo
 * encontraba. Como el puente TextMuy se construye en el FRENTE
 * (`assets_ficha_condicional()` -> `puente_textmuy()` -> `listar_todo()` ->
 * `catalogo()`, con la unica guarda `is_product()`), eso ocurria en CADA visita
 * a una pagina de producto, incluidas las de un bot: `uploads/pmu` se resucitaba
 * solo con 3 catalogos vacios y no habia forma de "empezar de cero".
 *
 * Ahora leer devuelve el catalogo vacio + aviso SIN tocar disco, y la siembra
 * queda en los caminos de escritura (alta/baja/editar).
 *
 * Uso: php tests/sin_lectura.php
 */

$base = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pd_sinlectura_' . getmypid();
$limpiar = function ($dir) {
    if (!is_dir($dir)) {
        return;
    }
    foreach (new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    ) as $x) {
        $x->isDir() ? @rmdir($x->getPathname()) : @unlink($x->getPathname());
    }
    @rmdir($dir);
};
$limpiar($base);
@mkdir($base . '/uploads', 0777, true);

$fallos = 0;
function check($nombre, $cond, $detalle = '')
{
    global $fallos;
    echo ($cond ? '  OK   ' : '  FAIL') . ' ' . $nombre . ($detalle !== '' ? '  [' . $detalle . ']' : '') . "\n";
    if (!$cond) {
        $fallos++;
    }
}

// ====== Stubs minimos de WordPress (los que toca PMU_Uploads) ======
define('ABSPATH', __DIR__ . '/');
function wp_upload_dir() { global $base; return ['basedir' => $base . '/uploads', 'baseurl' => 'http://test/uploads']; }
function wp_json_encode($d = null, $f = 0) { return json_encode($d, $f); }
function wp_is_writable($d) { return is_writable($d); }
function wp_mkdir_p($d) { return @mkdir($d, 0777, true); }
function trailingslashit($s) { return rtrim($s, '/\\') . '/'; }
function sanitize_key($k) { return strtolower(preg_replace('/[^a-z0-9_\-]/', '', (string)$k)); }

require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
require dirname(__DIR__) . '/inc/class-pmu-uploads.php';

$pmu = $base . '/uploads/pmu';
function archivos_de($dir)
{
    if (!is_dir($dir)) {
        return [];
    }
    $out = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if ($f->isFile()) {
            $out[] = $f->getPathname();
        }
    }
    sort($out);
    return $out;
}

echo "== 1. Estado inicial ==\n";
check('uploads/pmu no existe', !is_dir($pmu));
$antes = count(archivos_de($pmu));

echo "\n== 2. Consumo como en una visita al frente (no debe escribir) ==\n";
$motor = new PMU_Uploads();
$inv = $motor->listar_todo();
check('listar_todo responde', is_array($inv));
check('presets vacios', ($inv['presets'] ?? null) === []);
check('imagenes vacias', ($inv['imagenes'] ?? null) === []);
check('fuentes vacias', ($inv['fuentes'] ?? null) === []);
check('NO se creo uploads/pmu', !is_dir($pmu));
foreach (['fonts', 'img', 'tm-presets', 'mockups'] as $ambito) {
    $motor->listar($ambito);
    check('listar(' . $ambito . ') no escribe', count(archivos_de($pmu)) === $antes,
        count(archivos_de($pmu)) . ' archivos');
}
check('el aviso de catalogo ausente se sigue dando',
    strpos((string)$motor->catalogo('fonts', 'test')['aviso'], 'catalogo:ausente') !== false);

echo "\n== 3. La escritura SI crea el catalogo (sin regresion) ==\n";
$png = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pd_sl_' . getmypid() . '.png';
file_put_contents($png, base64_decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
));
$res = $motor->alta('mockups', 'Alta de prueba', 'varios', [
    'name' => 'prueba.png', 'type' => 'image/png', 'tmp_name' => $png,
    'error' => UPLOAD_ERR_OK, 'size' => (int)@filesize($png),
], '');
@unlink($png);
$id = isset($res['id']) ? (int)$res['id'] : 0;
check('alta() devolvio id', $id >= 1, 'id=' . $id);
check('se creo mockups/mockups.json', is_file($pmu . '/mockups/mockups.json'));
check('el catalogo tiene el item', count($motor->listar('mockups')['items']) === 1);

echo "\n== 4. Limpieza ==\n";
$motor->baja('mockups', $id, $res['nombre']);
check('baja deja el catalogo sin items', count($motor->listar('mockups')['items']) === 0);

$limpiar($base);
echo "\n";
if ($fallos) {
    echo "SIN_LECTURA: $fallos fallo(s)\n";
    exit(1);
}
echo "SIN_LECTURA OK\n";