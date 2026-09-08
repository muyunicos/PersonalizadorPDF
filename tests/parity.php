<?php
/**
 * Test de paridad: compara la deteccion PHP contra expected_muestra.json
 * (generado por el analizador Python) para muestra.pdf.
 *
 * Uso: php PersonalizadorPDF/tests/parity.php [ruta_muestra.pdf]
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require __DIR__ . '/../engine/Pdf.php';
require __DIR__ . '/../engine/Detector.php';

use ExtractCorel\Engine\Pdf;
use ExtractCorel\Engine\Detector;

$base = dirname(__DIR__);
// muestra.pdf ya no se versiona: vive en la carpeta de datos del proyecto (uploads/).
$pdfPath = isset($argv[1]) ? $argv[1] : dirname($base) . '/uploads/personalizador-pdf/pdfs/muestra.pdf';
$expectedPath = __DIR__ . '/expected_muestra.json';

$exit = 0;

function cmpVal($key, $a, $b, $tol)
{
    if (is_string($a) && is_string($b)) {
        return $a === $b;
    }
    if (is_int($a) || is_int($b)) {
        return (int)$a === (int)$b;
    }
    if (is_array($a) && is_array($b)) {
        if (count($a) !== count($b)) {
            return false;
        }
        $ka = array_keys($a);
        $kb = array_keys($b);
        sort($ka);
        sort($kb);
        if ($ka !== $kb) {
            return false;
        }
        foreach ($ka as $k) {
            if (!cmpVal($key, $a[$k], $b[$k], $tol)) {
                return false;
            }
        }
        return true;
    }
    if (is_bool($a) && is_bool($b)) {
        return $a === $b;
    }
    return abs((float)$a - (float)$b) <= $tol;
}

echo "Leyendo $pdfPath ...\n";
$data = file_get_contents($pdfPath);
if ($data === false) {
    fwrite(STDERR, "No se pudo leer $pdfPath\n");
    exit(2);
}

try {
    $pdf = new Pdf($data);
    $pdf->load();
    $detector = new Detector($pdf);
    $resultado = $detector->analizarPdf();
} catch (\Throwable $e) {
    fwrite(STDERR, 'ERROR: ' . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n");
    exit(2);
}

$esperado = json_decode(file_get_contents($expectedPath), true);

fwrite(STDOUT, 'PHP:    ' . json_encode($resultado, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
fwrite(STDOUT, "Esperado de Python:\n" . json_encode($esperado, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

// Comparacion estructural
$errores = [];

$tolBbox = 0.001; // micro-diferencias de punto flotante entre PyMuPDF y PHP
$tolNum = 1e-6;

$rpg = $resultado['total_paginas'] ?? null;
$epg = $esperado['total_paginas'] ?? null;
if ((int)$rpg !== (int)$epg) {
    $errores[] = "total_paginas: PHP=$rpg esperado=$epg";
}

$rg = $resultado['grupos'] ?? [];
$eg = $esperado['grupos'] ?? [];
if (count($rg) !== count($eg)) {
    $errores[] = 'num grupos: PHP=' . count($rg) . ' esperado=' . count($eg);
}

foreach ($eg as $i => $gEsp) {
    if (!isset($rg[$i])) {
        $errores[] = "grupo[$i]: falta en PHP";
        continue;
    }
    $gPhp = $rg[$i];
    foreach (['letra', 'color'] as $k) {
        if (($gPhp[$k] ?? null) !== ($gEsp[$k] ?? null)) {
            $errores[] = "grupo[$i].$k: PHP=" . json_encode($gPhp[$k] ?? null) . ' esperado=' . json_encode($gEsp[$k] ?? null);
        }
    }
    foreach (['ancho_px', 'alto_px', 'num_instancias'] as $k) {
        if ((int)($gPhp[$k] ?? -1) !== (int)($gEsp[$k] ?? -2)) {
            $errores[] = "grupo[$i].$k: PHP={$gPhp[$k]} esperado={$gEsp[$k]}";
        }
    }
    foreach (['ancho_pt', 'alto_pt'] as $k) {
        if (abs((float)($gPhp[$k] ?? -99) - (float)($gEsp[$k] ?? -98)) > $tolNum) {
            $errores[] = "grupo[$i].$k: PHP={$gPhp[$k]} esperado={$gEsp[$k]}";
        }
    }
    foreach (['color_rgb', 'paginas'] as $k) {
        if (!cmpVal($k, $gPhp[$k] ?? null, $gEsp[$k] ?? null, $tolNum)) {
            $errores[] = "grupo[$i].$k: PHP=" . json_encode($gPhp[$k]) . ' esperado=' . json_encode($gEsp[$k]);
        }
    }
    $ip = $gPhp['instancias'] ?? [];
    $ie = $gEsp['instancias'] ?? [];
    if (count($ip) !== count($ie)) {
        $errores[] = "grupo[$i].instancias: PHP=" . count($ip) . ' esperado=' . count($ie);
    }
    foreach ($ie as $j => $instEsp) {
        if (!isset($ip[$j])) {
            $errores[] = "grupo[$i].instancia[$j]: falta en PHP";
            continue;
        }
        if ((int)$ip[$j]['page'] !== (int)$instEsp['page']) {
            $errores[] = "grupo[$i].instancia[$j].page: PHP={$ip[$j]['page']} esperado={$instEsp['page']}";
        }
        foreach (['w', 'h'] as $k) {
            if (abs((float)($ip[$j][$k] ?? -1) - (float)($instEsp[$k] ?? -2)) > $tolNum) {
                $errores[] = "grupo[$i].instancia[$j].$k: PHP={$ip[$j][$k]} esperado={$instEsp[$k]}";
            }
        }
        $bp = $ip[$j]['bbox'] ?? [];
        $be = $instEsp['bbox'] ?? [];
        foreach (range(0, 3) as $c) {
            if (abs((float)($bp[$c] ?? -9) - (float)($be[$c] ?? -8)) > $tolBbox) {
                $errores[] = "grupo[$i].instancia[$j].bbox[$c]: PHP={$bp[$c]} esperado={$be[$c]}";
            }
        }
    }
}

if (empty($errores)) {
    echo "\nPARIDAD OK: la deteccion PHP coincide con el analizador Python.\n";
    $exit = 0;
} else {
    echo "\nPARIDAD FALLIDA (" . count($errores) . " diferencias):\n";
    foreach ($errores as $e) {
        echo "  - $e\n";
    }
    $exit = 1;
}
exit($exit);