<?php
/**
 * Test end-to-end del pipeline PHP: ejecuta Workflow::proceso sobre muestra.pdf
 * y valida el PDF resultante con PyMuPDF (cuenta imagenes y su tamano en bytes).
 *
 * Uso: php extractor-corel-php/tests/proceso.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require __DIR__ . '/../engine/Pdf.php';
require __DIR__ . '/../engine/Detector.php';
require __DIR__ . '/../engine/PngWriter.php';
require __DIR__ . '/../engine/Metadata.php';
require __DIR__ . '/../engine/Overlay.php';
require __DIR__ . '/../engine/Workflow.php';

use ExtractCorel\Engine\Workflow;
use ExtractCorel\Engine\Metadata;

$base = dirname(__DIR__, 2);
$pdfPath = $base . DIRECTORY_SEPARATOR . 'muestra.pdf';
$dirMarcos = __DIR__ . DIRECTORY_SEPARATOR . 'marcos_test';
$salida = __DIR__ . DIRECTORY_SEPARATOR . 'salida_test.pdf';

@mkdir($dirMarcos, 0775, true);
if (is_file($salida)) {
    unlink($salida);
}

echo "Ejecutando proceso sobre $pdfPath...\n";
$wf = new Workflow($dirMarcos);
$resultado = $wf->proceso($pdfPath, $salida);

echo "Resultado:\n";
echo '  archivo: ' . $resultado['archivo'] . "\n";
echo '  bytes: ' . $resultado['bytes'] . "\n";
echo '  grupos_aplicados: ' . implode(',', $resultado['resumen']['grupos_aplicados']) . "\n";
echo '  grupos_totales: ' . $resultado['resumen']['grupos_totales'] . "\n";
echo '  marcos_insertados: ' . $resultado['resumen']['marcos_insertados'] . "\n";

// Marcos generados
echo "\nMarcos generados:\n";
foreach (glob($dirMarcos . DIRECTORY_SEPARATOR . '*') as $dir) {
    if (is_dir($dir)) {
        foreach (glob($dir . DIRECTORY_SEPARATOR . '*.png') as $png) {
            echo '  ' . basename($png) . ' (' . filesize($png) . " bytes)\n";
        }
    }
}

echo "\nMetadatos:\n";
$meta = Metadata::cargar(Metadata::rutaMetadata($resultado['nombre_pdf'] ?? Metadata::nombreDesdeArchivo($pdfPath), $dirMarcos));
echo '  pdf: ' . $meta['pdf'] . "\n";
echo '  total_grupos: ' . $meta['total_grupos'] . "\n";
foreach ($meta['grupos'] as $g) {
    echo '  grupo ' . $g['letra'] . ': ' . $g['id'] . ' color=' . $g['color'] . ' tamano=' . $g['ancho_px'] . 'x' . $g['alto_px'] . "\n";
}

echo "\nValidando con PyMuPDF...\n";
$py = <<<'PY'
import sys, json
import pymupdf
doc = pymupdf.open(sys.argv[1])
out = {"pages": len(doc), "images": []}
for i, page in enumerate(doc):
    imgs = page.get_images(full=True)
    out["images"].append({"page": i, "count": len(imgs)})
print(json.dumps(out))
PY;
$tmpPy = tempnam(sys_get_temp_dir(), 'val') . '.py';
file_put_contents($tmpPy, $py);
$cmd = 'py ' . escapeshellarg($tmpPy) . ' ' . escapeshellarg($salida) . ' 2>&1';
$out = shell_exec($cmd);
@unlink($tmpPy);
$valid = json_decode($out, true);
echo "  PyMuPDF: " . $out . "\n";

if ($valid && ($valid['pages'] ?? 0) >= 2) {
    $totalImgs = 0;
    foreach ($valid['images'] as $im) {
        $totalImgs += $im['count'];
    }
    echo "\nVALIDACION OK: el PDF generado tiene {$valid['pages']} paginas y $totalImgs imagenes.\n";
    exit(0);
}
echo "\nVALIDACION FALLIDA.\n";
exit(1);