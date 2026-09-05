<?php
/**
 * Smoke test CLI del motor (herramienta de desarrollo).
 * Ejercita Imagen (GD y PHP puro), Motor, Overlay y la validacion de dataset
 * sobre muestra.pdf, y escribe salida_motor.pdf en %TEMP% para validar con PyMuPDF.
 *
 * Uso: php tests/motor_smoke.php
 *      (requiere tests/fixtures/ con las imagenes de prueba versionadas)
 */

require __DIR__ . '/../engine/Pdf.php';
require __DIR__ . '/../engine/Detector.php';
require __DIR__ . '/../engine/PngWriter.php';
require __DIR__ . '/../engine/Metadata.php';
require __DIR__ . '/../engine/Imagen.php';
require __DIR__ . '/../engine/Overlay.php';
require __DIR__ . '/../engine/Motor.php';

use ExtractCorel\Engine\Detector;
use ExtractCorel\Engine\Imagen;
use ExtractCorel\Engine\Metadata;
use ExtractCorel\Engine\Motor;
use ExtractCorel\Engine\Pdf;

$fallos = 0;
function check($nombre, $cond, $detalle = '')
{
    global $fallos;
    echo ($cond ? '  OK   ' : '  FAIL') . ' ' . $nombre . ($detalle !== '' ? '  [' . $detalle . ']' : '') . "\n";
    if (!$cond) {
        $fallos++;
    }
}

$base = dirname(__DIR__);
$pdfRuta = $base . DIRECTORY_SEPARATOR . 'muestra.pdf';
$fixtures = __DIR__ . DIRECTORY_SEPARATOR . 'fixtures';
$salida = __DIR__ . DIRECTORY_SEPARATOR . 'salida_motor.pdf';

echo 'GD disponible: ' . (Imagen::gd() ? 'si' : 'no') . "\n";

// Dataset real de muestra.pdf (simula analizar_y_guardar).
$pdf = new Pdf((string)file_get_contents($pdfRuta));
$pdf->load();
$grupos = (new Detector($pdf))->analizarPdf()['grupos'];
$datos = Metadata::generar('muestra', $grupos);
echo 'Dataset: ' . count($grupos) . " grupos\n";
foreach ($grupos as $g) {
    echo "  [{$g['letra']}] {$g['color']} {$g['ancho_px']}x{$g['alto_px']} px, {$g['num_instancias']} inst\n";
}

// ===== A: geometria del encajado =====
list($fw, $fh, $ox, $oy) = Imagen::encajado(800, 600, 1532, 1145);
check('encajado 800x600 -> 1532x1145', $fw === 1527 && $fh === 1145 && $oy === 0 && abs($ox - 3) <= 1,
    "fw=$fw fh=$fh ox=$ox oy=$oy");

// ===== B: normalizar PNG RGB (camino activo) =====
Imagen::$sinGD = false;
$spec = Imagen::normalizar($fixtures . '/foto_a.png', 1532, 1145);
$centro = (int)(1145 / 2) * 1532 + (int)(1532 / 2);
check('foto_a -> raster 1532x1145', $spec['tipo'] === 'raster' && $spec['w'] === 1532 && $spec['h'] === 1145);
check('centro opaco', ord($spec['alpha'][$centro]) === 255);
check('margen sup-izq transparente', ord($spec['alpha'][0]) === 0);
check('franja blanca arriba', ord($spec['rgb'][300]) === 255 && ord($spec['rgb'][301]) === 255);
// ===== C: decodificador PHP puro (forzado) =====
Imagen::$sinGD = true;
$spec2 = Imagen::normalizar($fixtures . '/foto_a.png', 1532, 1145);
check('puro: foto_a dims correctas', $spec2['tipo'] === 'raster' && $spec2['w'] === 1532 && $spec2['h'] === 1145);
check('puro: centro opaco', ord($spec2['alpha'][$centro]) === 255);
check('puro: margen transparente', ord($spec2['alpha'][0]) === 0);

$specP = Imagen::normalizar($fixtures . '/paleta_b.png', 522, 522);
check('puro: paleta -> raster 522x522', $specP['tipo'] === 'raster' && $specP['w'] === 522 && $specP['h'] === 522);
check('puro: paleta margen transparente', ord($specP['alpha'][0]) === 0);
check('puro: paleta centro opaco', ord($specP['alpha'][(int)(522 / 2) * 522 + (int)(522 / 2)]) === 255);

// ===== D: JPEG sin GD =====
$specJ = Imagen::normalizar($fixtures . '/exacto_b.jpg', 522, 522);
check('JPEG 522x522 sin GD -> dct', $specJ['tipo'] === 'dct');
try {
    Imagen::normalizar($fixtures . '/exacto_b.jpg', 100, 100);
    check('JPEG no exacto sin GD rechazado', false);
} catch (\Throwable $e) {
    check('JPEG no exacto sin GD rechazado', true, $e->getMessage());
}
Imagen::$sinGD = false;

// ===== E: Motor end-to-end =====
// Nota: en Windows local la carpeta Documentos puede estar protegida por
// "Acceso controlado a carpetas" y bloquear la escritura de php.exe; se
// escribe el resultado en %TEMP% para poder validarlo con PyMuPDF.
$salida = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'salida_motor.pdf';
$mapa = ['a' => $fixtures . '/foto_a.png', 'b' => $fixtures . '/exacto_b.jpg'];
$r = Motor::procesar($pdfRuta, $datos, $mapa);
$escritos = file_put_contents($salida, $r['bytes']);
check('grupos_aplicados = a,b', $r['resumen']['grupos_aplicados'] === ['a', 'b'],
    implode(',', $r['resumen']['grupos_aplicados']));
check('imagenes_insertadas = 4', $r['resumen']['imagenes_insertadas'] === 4);
check('grupos_sin_imagen vacio', $r['resumen']['grupos_sin_imagen'] === []);
check('PDF escrito (' . strlen($r['bytes']) . " bytes)", $escritos === strlen($r['bytes']), $salida);

// ===== F: Motor con un grupo sin imagen =====
$r2 = Motor::procesar($pdfRuta, $datos, ['a' => $fixtures . '/foto_a.png']);
check('sin imagen: grupos_sin_imagen = b', $r2['resumen']['grupos_sin_imagen'] === ['b']);
check('sin imagen: insertadas = 3', $r2['resumen']['imagenes_insertadas'] === 3);

// ===== H: z-order / enmarcado preservado (splice en el stream original) =====
$outPdf = new Pdf($r['bytes']);
$outPdf->load();
$outPages = $outPdf->getPages();
$cs0 = implode("\n", $outPdf->pageContents($outPages[0]));
$cs1 = implode("\n", $outPdf->pageContents($outPages[1]));
$draws0 = substr_count($cs0, ' cm /ECIm');
$draws1 = substr_count($cs1, ' cm /ECIm');
check('pagina 1: 3 draws ECIm y 0 fallback superpuesto', $draws0 === 3, 'draws=' . $draws0);
check('pagina 2: 1 draw ECIm (splice)', $draws1 === 1, 'draws=' . $draws1);

// Blue superior: la imagen se inserta antes de su relleno y el anillo se dibuja DESPUES.
$posGS28 = strpos($cs0, '/GS28 gs');
$posDoTop = $posGS28 === false ? false : strpos($cs0, ' cm /ECIm', $posGS28);
$posRingTop = strpos($cs0, '346.8101 629.7945 m');
check('anillo del blue superior queda por encima de su imagen',
    $posGS28 !== false && $posRingTop !== false && $posDoTop !== false
    && $posDoTop > $posGS28 && $posDoTop < $posRingTop);

// Blue del medio: la imagen se dibuja DENTRO del clip del circulo (W* ... Do ... f*).
$posC2 = strpos($cs0, '456.1112 230.4519 m');
$posWcirc = $posC2 === false ? false : strpos($cs0, 'W*', $posC2);
$posGS29 = strpos($cs0, '/GS29 gs');
$posDoMid = $posGS29 === false ? false : strpos($cs0, ' cm /ECIm', $posGS29);
$posFMid = $posDoMid === false ? false : strpos($cs0, 'f*', $posDoMid);
check('blue del medio recortado al circulo (Do entre W* y el relleno)',
    $posC2 !== false && $posWcirc !== false && $posWcirc > $posC2
    && $posGS29 !== false && $posDoMid !== false && $posDoMid > $posWcirc
    && $posFMid !== false && $posDoMid < $posFMid);

// ===== G: dataset desactualizado detectado =====
$datosMalos = $datos;
$datosMalos['grupos'][0]['ancho_px'] = 999;
try {
    Motor::procesar($pdfRuta, $datosMalos, $mapa);
    check('dataset invalido rechazado', false);
} catch (\Throwable $e) {
    check('dataset invalido rechazado', strpos($e->getMessage(), 'Re-analiza') !== false, $e->getMessage());
}

echo $fallos === 0 ? "\nSMOKE OK\n" : "\nSMOKE CON $fallos FALLOS\n";
exit($fallos === 0 ? 0 : 1);