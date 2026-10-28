<?php
/**
 * Compositor (spec 035, T007c): la foto se compone en el SERVIDOR desde el
 * original + la receta v2. GD con WebP es requisito.
 *
 * Las imagenes de prueba se generan en runtime (`%TEMP%`): no se versionan
 * binarios (los fixtures de `tests/fixtures/` son del Motor y no se tocan).
 *
 * Uso: php tests/compositor.php
 */

require dirname(__DIR__) . '/engine/Compositor.php';

use ExtractCorel\Engine\Compositor;

// Modo paridad (T007d): imprime la matriz de `caja`/`salida` y sale. Lo consume
// `tests/compositor-paridad.test.js`, que compara contra `escalaBase`/`escalaSalida`
// del selector (la referencia). Una sola fuente de verdad: la matematica.
if (isset($argv[1]) && $argv[1] === '--json') {
    $casos = [];
    foreach (['cubrir', 'encajar', 'estirar'] as $modo) {
        foreach ([[1600, 1200], [400, 300], [100, 100], [2000, 500]] as $foto) {
            foreach ([[463, 463], [1000, 500], [300, 300]] as $lienzo) {
                foreach ([1, 0.25, 1.25, 2, 4] as $zoom) {
                    $casos[] = [
                        'modo' => $modo, 'iw' => $foto[0], 'ih' => $foto[1],
                        'W' => $lienzo[0], 'H' => $lienzo[1], 'escala' => $zoom,
                        'caja' => Compositor::caja($modo, $foto[0], $foto[1], $lienzo[0], $lienzo[1]),
                        'salida' => Compositor::salida($modo, $foto[0], $foto[1],
                            $lienzo[0], $lienzo[1], $zoom),
                    ];
                }
            }
        }
    }
    echo json_encode($casos);
    exit(0);
}

$checks = 0;
$fallos = 0;

function check($nombre, $cond, $detalle = '')
{
    global $checks, $fallos;
    $checks++;
    if (!$cond) {
        $fallos++;
    }
    echo ($cond ? '  OK   ' : '  FAIL ') . $nombre
        . ((!$cond && $detalle !== '') ? '  [' . $detalle . ']' : '') . "\n";
}

function grupo($nombre)
{
    echo "\n== " . $nombre . " ==\n";
}

/** Receta v2 completa (los valores por defecto son los del caso centrado). */
function receta(array $cambios = [])
{
    return array_merge([
        'v' => 2, 'w' => 100, 'h' => 100, 'forma' => 'rectangulo', 'modo' => 'cubrir',
        'escala' => 1, 'ox' => 0.5, 'oy' => 0.5, 'fondo' => 'transparent', 'transp' => '',
        'rot' => 0, 'iw' => 100, 'ih' => 100, 'phsize' => 0, 'gid' => '0000FF',
    ], $cambios);
}

/** PNG temporal con dos mitades verticales: izquierda `$izq`, derecha `$der`. */
function pngMitades($w, $h, array $izq, array $der)
{
    $im = imagecreatetruecolor($w, $h);
    imagesavealpha($im, true);
    $a = imagecolorallocatealpha($im, $izq[0], $izq[1], $izq[2], $izq[3]);
    $b = imagecolorallocatealpha($im, $der[0], $der[1], $der[2], $der[3]);
    imagefilledrectangle($im, 0, 0, (int)($w / 2) - 1, $h - 1, $a);
    imagefilledrectangle($im, (int)($w / 2), 0, $w - 1, $h - 1, $b);
    $ruta = tempnam(sys_get_temp_dir(), 'pmucomp') . '.png';
    imagepng($im, $ruta);
    return $ruta;
}

/** PNG temporal de un color plano. */
function pngPlano($w, $h, array $rgba)
{
    $im = imagecreatetruecolor($w, $h);
    imagesavealpha($im, true);
    $c = imagecolorallocatealpha($im, $rgba[0], $rgba[1], $rgba[2], $rgba[3]);
    imagefilledrectangle($im, 0, 0, $w - 1, $h - 1, $c);
    $ruta = tempnam(sys_get_temp_dir(), 'pmucomp') . '.png';
    imagepng($im, $ruta);
    return $ruta;
}

function desdeBytes($bytes)
{
    return imagecreatefromstring($bytes);
}

function rgba($im, $x, $y)
{
    $c = imagecolorat($im, $x, $y);
    return [
        ($c >> 16) & 0xFF,
        ($c >> 8) & 0xFF,
        $c & 0xFF,
        127 - (($c >> 24) & 0x7F),
    ];
}

$tmp = [];

// ---------------------------------------------------------------------------
grupo('F1: caja y salida (paridad con escalaBase/escalaSalida)');
// ---------------------------------------------------------------------------

$c = Compositor::caja('cubrir', 400, 300, 1000, 1000);
check('cubrir: la caja tapa el marco (el mayor de los dos factores)',
    abs($c['dw'] - 1333.333) < 0.01 && abs($c['dh'] - 1000.0) < 0.01,
    $c['dw'] . 'x' . $c['dh']);
$c = Compositor::caja('encajar', 400, 300, 1000, 1000);
check('encajar: la foto entra entera', abs($c['dw'] - 1000.0) < 0.01 && abs($c['dh'] - 750.0) < 0.01,
    $c['dw'] . 'x' . $c['dh']);
$c = Compositor::caja('estirar', 400, 300, 1000, 500);
check('estirar: la caja es el marco exacto', $c['dw'] == 1000 && $c['dh'] == 500,
    $c['dw'] . 'x' . $c['dh']);

$s = Compositor::salida('cubrir', 400, 300, 1000, 1000, 1);
check('salida: el PNG se acota a la resolucion de la foto (400x300 en 1000x1000 -> 300x300)',
    $s['w'] === 300 && $s['h'] === 300, $s['w'] . 'x' . $s['h']);
$s = Compositor::salida('cubrir', 4000, 3000, 1000, 1000, 1);
check('salida: foto grande -> k=1 y el PNG mide el lienzo (el caso tipico no cambia)',
    $s['k'] == 1.0 && $s['w'] === 1000 && $s['h'] === 1000, $s['w'] . 'x' . $s['h']);
$s = Compositor::salida('cubrir', 400, 300, 1000, 1000, 4);
check('salida: la Escala acota el PNG (no inventa pixeles)',
    $s['w'] === 75 && $s['h'] === 75, $s['w'] . 'x' . $s['h']);

// ---------------------------------------------------------------------------
grupo('F2: rotacion horaria (el sentido de ctx.rotate)');
// ---------------------------------------------------------------------------

// WebP es lossy: en un bloque diminuto mezcla los colores. La prueba usa 64x32
// y lee el CENTRO de cada mitad, lejos de la frontera de compresion.
// Original 64x32: izquierda ROJA, derecha AZUL. Al girar 90 horario, la mitad
// izquierda queda ARRIBA.
$dos = pngMitades(64, 32, [255, 0, 0, 0], [0, 0, 255, 0]);
$tmp[] = $dos;

$r90 = receta(['w' => 64, 'h' => 64, 'modo' => 'estirar', 'iw' => 32, 'ih' => 64, 'rot' => 90]);
$im = desdeBytes(Compositor::componer($dos, $r90));
$arriba = rgba($im, 32, 8);
$abajo = rgba($im, 32, 56);
check('rot 90: la mitad IZQUIERDA queda ARRIBA (rojo)',
    $arriba[0] > 200 && $arriba[2] < 60, implode(',', $arriba));
check('rot 90: la mitad derecha queda ABAJO (azul)',
    $abajo[2] > 200 && $abajo[0] < 60, implode(',', $abajo));

$r270 = receta(['w' => 64, 'h' => 64, 'modo' => 'estirar', 'iw' => 32, 'ih' => 64, 'rot' => 270]);
$im2 = desdeBytes(Compositor::componer($dos, $r270));
$arriba270 = rgba($im2, 32, 8);
$abajo270 = rgba($im2, 32, 56);
check('rot 270: el rojo queda ABAJO (90 y 270 NO son lo mismo)',
    $abajo270[0] > 200 && $arriba270[2] > 200,
    implode(',', $arriba270) . ' / ' . implode(',', $abajo270));

$r180 = receta(['w' => 64, 'h' => 32, 'modo' => 'estirar', 'iw' => 64, 'ih' => 32, 'rot' => 180]);
$im3 = desdeBytes(Compositor::componer($dos, $r180));
$izq180 = rgba($im3, 8, 16);
$der180 = rgba($im3, 56, 16);
check('rot 180: la imagen se invierte (el rojo pasa a la derecha)',
    $izq180[2] > 200 && $der180[0] > 200,
    implode(',', $izq180) . ' / ' . implode(',', $der180));

$r0 = receta(['w' => 64, 'h' => 32, 'modo' => 'estirar', 'iw' => 64, 'ih' => 32, 'rot' => 0]);
$im4 = desdeBytes(Compositor::componer($dos, $r0));
$izq0 = rgba($im4, 8, 16);
check('rot 0: no toca la imagen (rojo a la izquierda)', $izq0[0] > 200, implode(',', $izq0));

// ---------------------------------------------------------------------------
grupo('F3: fondo y transparencia (spec 027)');
// ---------------------------------------------------------------------------

// `encajar` de 64x32 en 64x64 deja franjas de 16 px arriba y abajo.
$enc = ['w' => 64, 'h' => 64, 'modo' => 'encajar', 'iw' => 64, 'ih' => 32];

$t = desdeBytes(Compositor::componer($dos, receta($enc)));
$franja = rgba($t, 32, 2);
$centro = rgba($t, 32, 32);
check('sin fondo: la franja queda TRANSPARENTE', $franja[3] === 0, implode(',', $franja));
check('sin fondo: el centro sigue opaco (la foto esta ahi)', $centro[3] > 120, implode(',', $centro));

$rojo = desdeBytes(Compositor::componer($dos, receta(array_merge($enc, ['fondo' => '#ff0000']))));
$franja = rgba($rojo, 32, 2);
check('con fondo #ff0000: la franja sale roja y opaca',
    $franja[0] > 200 && $franja[1] < 60 && $franja[3] > 120, implode(',', $franja));

// Spec 027: `transp:'no'` NUNCA deja el fondo transparente (barrera final).
$barrera = desdeBytes(Compositor::componer($dos,
    receta(array_merge($enc, ['fondo' => 'transparent', 'transp' => 'no']))));
$franja = rgba($barrera, 32, 2);
check('transp:no + fondo transparente -> blanco puro opaco',
    $franja[0] > 245 && $franja[1] > 245 && $franja[2] > 245 && $franja[3] > 120,
    implode(',', $franja));

// ---------------------------------------------------------------------------
grupo('F4: errores con causa (nunca un archivo a medias)');
// ---------------------------------------------------------------------------

$causa = '';
try {
    Compositor::componer($tmp[0] . '.no-existe', receta());
} catch (\Throwable $e) {
    $causa = $e->getMessage();
}
check('un original ausente da motor:original:ausente', $causa === 'motor:original:ausente', $causa);

$basura = tempnam(sys_get_temp_dir(), 'pmucomp') . '.webp';
file_put_contents($basura, 'no soy una imagen');
$tmp[] = $basura;
$causa = '';
try {
    Compositor::componer($basura, receta());
} catch (\Throwable $e) {
    $causa = $e->getMessage();
}
check('bytes ilegibles dan motor:compositor:origen', $causa === 'motor:compositor:origen', $causa);

// ---------------------------------------------------------------------------
grupo('F5: ox/oy mueven la foto dentro del lienzo (centro de la FORMA)');
// ---------------------------------------------------------------------------

$centrado = desdeBytes(Compositor::componer($dos,
    receta(array_merge($enc, ['oy' => 0.5]))));
$alto = desdeBytes(Compositor::componer($dos,
    receta(array_merge($enc, ['oy' => 0.25]))));
// Con `oy=0.5` la foto (32 px de alto) cubre y=16..48; con `oy=0.25`, y=0..32.
$bajoCentrado = rgba($centrado, 32, 44);
$bajoAlto = rgba($alto, 32, 44);
check('con oy=0.5 la foto llega abajo (opaco)', $bajoCentrado[3] > 120,
    implode(',', $bajoCentrado));
check('con oy=0.25 la foto se sube y abajo queda el fondo (transparente)',
    $bajoAlto[3] === 0, implode(',', $bajoAlto));

// ---------------------------------------------------------------------------
if ($fallos) {
    foreach ($tmp as $f) {
        @unlink($f);
    }
    echo "\nCOMPOSITOR: " . $fallos . " fallo(s) de " . $checks . "\n";
    exit(1);
}
echo "\nCOMPOSITOR OK (" . $checks . " checks)\n";
foreach ($tmp as $f) {
    @unlink($f);
}
