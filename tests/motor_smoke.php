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
use ExtractCorel\Engine\Overlay;
use ExtractCorel\Engine\Pdf;
use ExtractCorel\Engine\PngWriter;

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

// Opacidad: cada draw de imagen debe ir precedido de /ECOp1 gs (ca=1) para no
// heredar la opacidad 0 del ExtGState del placeholder (si no, el SMask se
// multiplica por ca=0 y la imagen se ve 100% transparente).
check('todos los draws usan /ECOp1 gs antes del cm',
    $draws0 + $draws1 === substr_count($cs0, 'q /ECOp1 gs') + substr_count($cs1, 'q /ECOp1 gs'),
    'draws=' . ($draws0 + $draws1));
$resOut0 = ($outPdf->pageKey($outPages[0], 'Resources'));
$egOut0 = (is_array($resOut0) && isset($resOut0['ExtGState'])) ? $outPdf->deref($resOut0['ExtGState']) : [];
$ecop = (is_array($egOut0) && isset($egOut0['ECOp1'])) ? $egOut0['ECOp1'] : null;
check('Resources define ECOp1 con ca=1 y CA=1',
    is_array($ecop) && (float)($ecop['ca'] ?? 0) === 1.0 && (float)($ecop['CA'] ?? 0) === 1.0,
    json_encode($ecop));

// ===== I: Placeholder ROTADO (caso muestra2.pdf) =====
// PDF sintetico de 1 pagina con 2 rectangulos 100% transparentes rotados
// (100x50 pt, dibujados como 4 lineas cerradas + h f*, como los exporta Corel):
//  - grupo a (azul): inclinado -30 grados, path en sentido HORARIO empezando en
//    la esquina superior: es la orientacion real de muestra2.pdf, que antes
//    producia la imagen ESPEJADA verticalmente (la base salia con un reflejo,
//    no una rotacion).
//  - grupo b (rojo): inclinado +30 grados, path ANTIHORARIO (regresion).
function ecCp2($p)
{
    return sprintf('%.4f %.4f', $p[0], $p[1]);
}
$qAa = [250.0, 400.0];
$qAb = [$qAa[0] + 86.6025, $qAa[1] - 50.0];
$qAc = [$qAb[0] - 25.0, $qAb[1] - 43.3013];
$qAd = [$qAa[0] - 25.0, $qAa[1] - 43.3013];
$qBa = [400.0, 200.0];
$qBb = [$qBa[0] + 86.6025, $qBa[1] + 50.0];
$qBc = [$qBb[0] - 25.0, $qBb[1] + 43.3013];
$qBd = [$qBa[0] - 25.0, $qBa[1] + 43.3013];
$rotStream = '/GS1 gs' . "\n"
    . '0 0 1 rg' . "\n"
    . ecCp2($qAa) . ' m' . "\n"
    . ecCp2($qAb) . ' l' . "\n"
    . ecCp2($qAc) . ' l' . "\n"
    . ecCp2($qAd) . ' l' . "\n"
    . 'h f*' . "\n"
    . '1 0 0 rg' . "\n"
    . ecCp2($qBa) . ' m' . "\n"
    . ecCp2($qBb) . ' l' . "\n"
    . ecCp2($qBc) . ' l' . "\n"
    . ecCp2($qBd) . ' l' . "\n"
    . 'h f*' . "\n";
$rotObjs = [];
$rotObjs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
$rotObjs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
$rotObjs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] '
    . '/Resources << /ExtGState << /GS1 << /Type /ExtGState /ca 0 /CA 0 >> >> >> '
    . '/Contents 4 0 R >>';
$rotObjs[4] = '<< /Length ' . strlen($rotStream) . " >>\nstream\n" . $rotStream . "\nendstream";
$rotPdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
$rotOff = [];
foreach ($rotObjs as $num => $txt) {
    $rotOff[$num] = strlen($rotPdf);
    $rotPdf .= $num . ' 0 obj' . "\n" . $txt . "\n" . 'endobj' . "\n";
}
$rotXref = strlen($rotPdf);
$rotPdf .= "xref\n0 5\n0000000000 65535 f \n";
for ($i = 1; $i <= 4; $i++) {
    $rotPdf .= sprintf('%010d 00000 n ', $rotOff[$i]) . "\n";
}
$rotPdf .= "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n$rotXref\n%%EOF\n";

$pdfRot = new Pdf($rotPdf);
$pdfRot->load();
$gRot = (new Detector($pdfRot))->analizarPdf()['grupos'];
check('rotado: se detectan 2 grupos', count($gRot) === 2, 'grupos=' . count($gRot));
$gA = null;
$gB = null;
foreach ($gRot as $g) {
    if ($g['color'] === '#0000FF') {
        $gA = $g;
    }
    if ($g['color'] === '#FF0000') {
        $gB = $g;
    }
}
check('rotado: grupo a azul', $gA !== null && $gA['letra'] === 'a'
    && $gA['color'] === '#0000FF');
check('rotado: grupo b rojo', $gB !== null && $gB['letra'] === 'b'
    && $gB['color'] === '#FF0000');
check('rotado: lados a ~100x50 pt', $gA !== null
    && abs((float)$gA['ancho_pt'] - 100) < 0.5 && abs((float)$gA['alto_pt'] - 50) < 0.5,
    $gA !== null ? ('w=' . $gA['ancho_pt'] . ' h=' . $gA['alto_pt']) : '-');
check('rotado: lados b ~100x50 pt', $gB !== null
    && abs((float)$gB['ancho_pt'] - 100) < 0.5 && abs((float)$gB['alto_pt'] - 50) < 0.5,
    $gB !== null ? ('w=' . $gB['ancho_pt'] . ' h=' . $gB['alto_pt']) : '-');
check('rotado: px 278x139', $gA !== null && $gA['ancho_px'] === 278 && $gA['alto_px'] === 139);
$iA = ($gA !== null && isset($gA['instancias'][0])) ? $gA['instancias'][0] : null;
$iB = ($gB !== null && isset($gB['instancias'][0])) ? $gB['instancias'][0] : null;
check('rotado: instancias con dev_quad', $iA !== null && count($iA['dev_quad']) === 4
    && $iB !== null && count($iB['dev_quad']) === 4);

    if ($gA !== null && $gB !== null) {
    // Overlay: inserta las imagenes rotadas en el stream original (splice).
    $ovR = new Overlay($rotPdf);
    $specR = [
        'a' => [
            'tipo' => 'raster',
            'w' => $gA['ancho_px'],
            'h' => $gA['alto_px'],
            'rgb' => str_repeat("\x80", $gA['ancho_px'] * $gA['alto_px'] * 3),
            'alpha' => str_repeat("\xFF", $gA['ancho_px'] * $gA['alto_px']),
        ],
        'b' => [
            'tipo' => 'raster',
            'w' => $gB['ancho_px'],
            'h' => $gB['alto_px'],
            'rgb' => str_repeat("\x90", $gB['ancho_px'] * $gB['alto_px'] * 3),
            'alpha' => str_repeat("\xFF", $gB['ancho_px'] * $gB['alto_px']),
        ],
    ];
    $outR = $ovR->build($gRot, $specR);
    $pdfOutR = new Pdf($outR);
    $pdfOutR->load();
    $csR = implode("\n", $pdfOutR->pageContents($pdfOutR->getPages()[0]));
    check('rotado: 2 draws splice con q /ECOp1 gs',
        substr_count($csR, ' cm /ECIm') === 2 && substr_count($csR, 'q /ECOp1 gs') === 2,
        'draws=' . substr_count($csR, ' cm /ECIm'));
    // Grupo a (path horario como Corel): antes la base salia ESPEJADA
    // (cm = 86.6025 -50 -25 -43.3013 ...). Ahora debe ser rotacion pura con
    // v hacia arriba y origen en la esquina q3 del quad: u=(86.6,-50),
    // v=(25,43.3), o=(225, 356.6987). Siempre cubre el quad.
    check('rotado: cm del grupo a sin espejo (v_y>0)',
        strpos($csR, '86.6025 -50 25 43.3013 225 356.6987 cm /ECIm') !== false,
        'no se hallo el cm corregido');
    check('rotado: cm espejado del grupo a AUSENTE',
        strpos($csR, '86.6025 -50 -25 -43.3013') === false,
        'todavia hay reflejo vertical');
    check('rotado: cm del grupo b conservado',
        strpos($csR, '86.6025 50 -25 43.3013 400 200 cm /ECIm') !== false);
    $mDet = preg_match('/86.6025 -50 25 (43.3013) /', $csR, $mmDet);
    check('rotado: det(cm a) > 0 => rotacion pura',
        $mDet && (86.6025 * (float)$mmDet[1] - (-50.0) * 25.0) > 0
            && (float)$mmDet[1] > 0,
        $mDet ? ('det=' . (86.6025 * (float)$mmDet[1] + 1250.0)) : 'sin cm');

    // Motor end-to-end con un PNG por grupo (RGBA 8 bits sin entrelazar: sin GD).
    $rutaRotPdf = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'ec_rotado.pdf';
    $rutaRotPngA = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'ec_rotado_a.png';
    $rutaRotPngB = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'ec_rotado_b.png';
    file_put_contents($rutaRotPdf, $rotPdf);
    PngWriter::write($rutaRotPngA, $gA['ancho_px'], $gA['alto_px'],
        str_repeat("\x80\x80\x80\xFF", $gA['ancho_px'] * $gA['alto_px']));
    PngWriter::write($rutaRotPngB, $gB['ancho_px'], $gB['alto_px'],
        str_repeat("\x40\x80\xC0\xFF", $gB['ancho_px'] * $gB['alto_px']));
    try {
        $rR = Motor::procesar($rutaRotPdf, Metadata::generar('sintetico_rotado', $gRot),
            ['a' => $rutaRotPngA, 'b' => $rutaRotPngB]);
        check('rotado: motor end-to-end', isset($rR['bytes'])
            && $rR['resumen']['grupos_aplicados'] === ['a', 'b']
            && (int)$rR['resumen']['imagenes_insertadas'] === 2,
            json_encode($rR['resumen']));
    } catch (\Throwable $e) {
        check('rotado: motor end-to-end', false, $e->getMessage());
    }
    @unlink($rutaRotPdf);
    @unlink($rutaRotPngA);
    @unlink($rutaRotPngB);
}

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