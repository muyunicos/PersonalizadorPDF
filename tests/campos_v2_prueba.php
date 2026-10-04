<?php
/**
 * Banco de pruebas aislado de la migracion v1 -> v2 de campos (spec 012, T001).
 * Corre en %TEMP%; NUNCA toca uploads/pmu/ real.
 */
define('ABSPATH', 'pmu-test');
define('PERSONALIZADOR_PDF_PATH', dirname(__DIR__) . DIRECTORY_SEPARATOR);

$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pmu-campos-' . getmypid();
@mkdir($TMP . DIRECTORY_SEPARATOR . 'pmu', 0777, true);

$GLOBALS['pmu_basedir'] = $TMP;
function wp_upload_dir() {
    return ['basedir' => $GLOBALS['pmu_basedir'], 'baseurl' => 'http://x'];
}
function trailingslashit($s) { return rtrim($s, '/\\') . '/'; }
function wp_mkdir_p($d) { return is_dir($d) || mkdir($d, 0777, true) || is_dir($d); }
function wp_is_writable($d) { return is_writable($d); }
function wp_json_encode($d, $f = 0) { return json_encode($d, $f); }
function sanitize_key($k) { return strtolower(preg_replace('/[^a-z0-9_\-]/i', '', (string)$k)); }
function wp_unslash($v) { return is_string($v) ? stripslashes($v) : $v; }

require_once PERSONALIZADOR_PDF_PATH . 'inc' . DIRECTORY_SEPARATOR . 'class-pmu-uploads.php';

$fallos = 0;
function check($n, $ok) { global $fallos; if (!$ok) { $fallos++; } echo ($ok ? '  OK   ' : '  FALLA ') . $n . "\n"; }
function lanza($fn) {
    try { $fn(); return false; } catch (Exception $e) { return $e->getMessage(); }
}

$m = new PMU_Uploads();
$ruta = $m->ruta_campos();

// --- Sin catalogo: no hace nada ---
$r = $m->migrar_campos_v2();
check('sin catalogo -> hecho sin cambios', $r['hecho'] === true && $r['motivo'] === 'sin catalogo');

// --- Siembra v1: 2 campos vivos + 1 tombstone ---
$v1 = ['items' => [
    [1, 'Nombre', 'text', ['datos'], 'Escribi tu nombre', 1, '<input data-rol="valor">', '.a{color:red}', 'function(ctx,root){ctx.set(1,{valor:"x",cliente:"X"});}', false],
    [2, 'Fotos', 'img', ['navidad', 'foto'], 'Subi tus fotos', 1, '<button>Fotos</button>', '', '', true],
    [3, '', '', [], '', 0, '', '', '', false],
]];
file_put_contents($ruta, json_encode($v1, JSON_PRETTY_PRINT));

$r = $m->migrar_campos_v2();
check('migracion hecha', $r['hecho'] === true);
check('2 campos migrados', $r['campos'] === 2);
check('1 baja migrada', $r['bajas'] === 1);

// --- Indice v2 ---
$idx = json_decode(file_get_contents($ruta), true);
check('version = 2', isset($idx['version']) && $idx['version'] === 2);
check('3 items en el indice', count($idx['items']) === 3);
check('campo 3 dado de baja', $idx['items'][2]['baja'] === true);
check('categorias del campo 2', $idx['meta']['2']['categorias'] === ['navidad', 'foto']);
check('meta con creado+modificado', !empty($idx['meta']['1']['creado']) && !empty($idx['meta']['1']['modificado']));

// --- Archivos por campo ---
check('carpeta del campo 1 existe', is_dir($m->dir_campo(1)));
check('campo.htm del campo 1', trim(file_get_contents($m->ruta_campo(1, 'campo.htm'))) === '<input data-rol="valor">');
check('campo.css del campo 1', trim(file_get_contents($m->ruta_campo(1, 'campo.css'))) === '.a{color:red}');
check('campo.js del campo 1', strpos(file_get_contents($m->ruta_campo(1, 'campo.js')), 'function(ctx,root)') === 0);
check('NO hay carpeta para el tombstone', !is_dir($m->dir_campo(3)));

$d = json_decode(file_get_contents($m->ruta_campo(1, 'datos.json')), true);
check('datos.json: nombre', $d['nombre'] === 'Nombre');
check('datos.json: titulo_cliente', $d['titulo_cliente'] === 'Nombre');
check('datos.json: texto_ayuda', $d['texto_ayuda'] === 'Escribi tu nombre');
check('datos.json: array=false', $d['array'] === false);
check('datos.json: protegido=false', $d['protegido'] === false);
$d2 = json_decode(file_get_contents($m->ruta_campo(2, 'datos.json')), true);
check('datos.json: array=true (campo 2)', $d2['array'] === true);

// --- Backup existe ---
check('campos.json.bak guardado', is_file($ruta . '.bak'));
check('el .bak es la v1', strpos(file_get_contents($ruta . '.bak'), '"Nombre"') !== false);

// --- Idempotente ---
$r2 = $m->migrar_campos_v2();
check('segunda pasada = ya migrado', $r2['hecho'] === true && $r2['motivo'] === 'ya migrado');

// --- Lectura completa ---
// --- Backup + idempotencia (antes de leer: la migracion ya corrio una vez) ---
check('campos.json.bak guardado', is_file($ruta . '.bak'));
check('el .bak conserva la v1', strpos(file_get_contents($ruta . '.bak'), '"Nombre"') !== false);
$r2 = $m->migrar_campos_v2();
check('segunda pasada = ya migrado', $r2['hecho'] === true && $r2['motivo'] === 'ya migrado');

// --- Lectura completa ---
$c = $m->leer_campo(1);
check('leer_campo devuelve datos+codigo', $c['id'] === 1 && strpos($c['htm'], 'data-rol') !== false && $c['datos']['nombre'] === 'Nombre');
check('leer_campo de id inexistente = null', $m->leer_campo(99) === null);

// --- Rutas: el indice sigue en la RAIZ, el codigo en campos/ ---
check('ruta_campos en la raiz', basename(dirname($ruta)) === 'pmu' && basename($ruta) === 'campos.json');
check('dir_campos = pmu/campos/', basename($m->dir_campos()) === 'campos');
check('ruta_global_css', basename($m->ruta_global_css()) === 'global.css');
check('ruta_global_js', basename($m->ruta_global_js()) === 'global.js');
check('ruta_campo_global rechaza otro nombre', lanza(function () use ($m) { $m->ruta_campo_global('otro.css'); }) !== false);
$rp = $m->ruta_campo(1, '../x');
check('ruta_campo SANEA el traversal (basename)', strpos($rp, '..') === false);
check('ruta_campo rechaza nombre vacio', lanza(function () use ($m) { $m->ruta_campo(1, ''); }) !== false);
check('campo_id_seguro rechaza 0', lanza(function () use ($m) { $m->campo_id_seguro(0); }) !== false);

// --- Cargador: los 3 atajos del admin ---
$c1 = $m->validar_cargador('canvas:circle size:1000');
check('atajo 1 ranura', count($c1) === 1 && $c1[0]['w'] === 1000 && $c1[0]['h'] === 1000 && $c1[0]['forma'] === 'circle');
$c2 = $m->validar_cargador('size:2000 max:6');
check('atajo size+max', count($c2) === 1 && $c2[0]['w'] === 2000 && $c2[0]['max'] === 6);
$c3 = $m->validar_cargador('1_size:1000 1_canvas:circle 2_size:1024x768 2_min:2 2_max:2');
check('atajo 2 ranuras', count($c3) === 2);
check('atajo ranura 1 circular', $c3[0]['w'] === 1000 && $c3[0]['forma'] === 'circle');
check('atajo ranura 2 rectangular exacta', $c3[1]['w'] === 1024 && $c3[1]['h'] === 768 && $c3[1]['min'] === 2 && $c3[1]['max'] === 2);
check('sin cargador = null', $m->validar_cargador(null) === null && $m->validar_cargador('') === null);
$e = lanza(function () use ($m) { $m->validar_cargador('w'); });
check('cargador basura rechazada', $e !== false && strpos($e, 'cargador:invalido') !== false);

// --- Validaciones de escritura ---
$e = lanza(function () use ($m) { $m->escribir_campo(1, ['nombre' => 'x'], '<script>a</script>'); });
check('HTML con script rechazado', $e !== false && strpos($e, 'contenido:prohibido') !== false);
$e = lanza(function () use ($m) { $m->escribir_campo(1, ['nombre' => 'x'], '<div id="a">'); });
check('HTML con id="" rechazado', $e !== false && strpos($e, 'contenido:sin_id') !== false);
$e = lanza(function () use ($m) { $m->escribir_campo(1, ['nombre' => 'x'], '', '', 'function(){} document.getElementById("a")'); });
check('JS prohibido rechazado', $e !== false && strpos($e, 'script:invalido') !== false);
$e = lanza(function () use ($m) { $m->escribir_campo(1, ['nombre' => 'x'], str_repeat('a', 20001)); });
check('HTML > 20 000 rechazado', $e !== false && strpos($e, 'campo.htm:tamano') !== false);

// --- El campo 1 quedo intacto tras los rechazos ---
check('el campo 1 NO se toco con las escrituras rechazadas', trim(file_get_contents($m->ruta_campo(1, 'campo.htm'))) === '<input data-rol="valor">');

echo $fallos === 0 ? "\nCAMPOS V2 OK\n" : "\nCAMPOS V2 FALLA: $fallos\n";
exit($fallos === 0 ? 0 : 1);