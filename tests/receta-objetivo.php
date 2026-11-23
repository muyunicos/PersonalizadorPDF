<?php
/**
 * receta-objetivo - puerta del objetivo canonico y del delta (spec 045, T003/T004).
 *
 * Verifica la clave `{aspecto 4 dec}-{familia 0|1}-{area}` (sin `gid`) y el delta
 * de la configuracion. Corre por CLI (define ABSPATH para el guard de la clase).
 *
 * Uso: php tests/receta-objetivo.php
 */

if (PHP_SAPI !== 'cli') {
    exit;
}

define('ABSPATH', __DIR__ . '/');
require __DIR__ . '/../inc/class-pmu-sesion.php';

$ok = 0;
$mal = 0;
function check($nombre, $cond, $extra = '')
{
    global $ok, $mal;
    if ($cond) { $ok++; echo "  OK   $nombre\n"; }
    else { $mal++; echo '  FAIL ' . $nombre . ($extra !== '' ? "  [$extra]" : '') . "\n"; }
}

$ref = new ReflectionMethod('PMU_Sesion', 'clave_receta');
$clave = function ($params) use ($ref) { return $ref->invoke(null, $params); };

echo "== Objetivo (clave de receta) ==\n";
$casos = array(
    array(array('w' => 300, 'h' => 200, 'forma' => 'rectangulo'), '1.5000-0-60000', '300x200 rect'),
    array(array('w' => 200, 'h' => 200, 'forma' => 'circulo'), '1.0000-1-40000', '200x200 circulo'),
    array(array('w' => 300, 'h' => 200, 'forma' => 'ovalo'), '1.5000-1-60000', '300x200 ovalo'),
    array(array('w' => 300, 'h' => 200, 'forma' => 'cuadrado'), '1.5000-0-60000', '300x200 cuadrado (aspecto != 1)'),
    array(array('w' => 200, 'h' => 200, 'forma' => 'cuadrado'), '1.0000-0-40000', '200x200 cuadrado'),
    array(array('w' => 120, 'h' => 80, 'forma' => 'auto'), '1.5000-0-9600', '120x80 auto (familia 0)'),
    array(array('w' => 0, 'h' => 0, 'forma' => 'auto'), '', 'sin medidas'),
);
foreach ($casos as $c) {
    $got = $clave($c[0]);
    check('objetivo ' . $c[2], $got === $c[1], 'got=' . $got . ' esperado=' . $c[1]);
}

echo "\n== Delta (configuracion) ==\n";
$base = array('modo' => 'cubrir', 'escala' => 1, 'ox' => 0.5, 'oy' => 0.5, 'rot' => 0, 'fondo' => 'auto', 'transp' => '');
$d = PMU_Sesion::receta_delta($base);
check('default = solo modo', $d === array('modo' => 'cubrir'), json_encode($d));

$d = PMU_Sesion::receta_delta(array_merge($base, array('escala' => 1.25)));
check('zoom 1.25 se persiste', isset($d['zoom']) && abs($d['zoom'] - 1.25) < 0.0001, json_encode($d));

$d = PMU_Sesion::receta_delta(array_merge($base, array('modo' => 'encajar', 'ox' => 0.1, 'oy' => -0.05)));
check('encajar + desplazamiento', $d['modo'] === 'encajar' && isset($d['ox'], $d['oy']), json_encode($d));

$d = PMU_Sesion::receta_delta(array_merge($base, array('rot' => 90)));
check('rot 90 se persiste', isset($d['rot']) && $d['rot'] === 90, json_encode($d));

$d = PMU_Sesion::receta_delta(array_merge($base, array('fondo' => '#ff0000')));
check('fondo elegido se persiste', ($d['fondo'] ?? '') === '#ff0000', json_encode($d));

$d = PMU_Sesion::receta_delta(array_merge($base, array('fondo' => 'transparent')));
check('fondo transparente no se persiste', !isset($d['fondo']), json_encode($d));

$d = PMU_Sesion::receta_delta(array_merge($base, array('transp' => 'no')));
check('transp se persiste', ($d['transp'] ?? '') === 'no', json_encode($d));

echo "\n";
if ($mal === 0) {
    echo 'RECETA OBJETIVO OK (' . $ok . " checks)\n";
    exit(0);
}
echo 'RECETA OBJETIVO FALLA (' . $mal . ' de ' . ($ok + $mal) . ")\n";
exit(1);