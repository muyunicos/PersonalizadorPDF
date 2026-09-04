<?php
/** Depuracion interna del parser: estructura del PDF. */
error_reporting(E_ALL);
ini_set('display_errors', '1');
require __DIR__ . '/../engine/Pdf.php';
require_once __DIR__ . '/../engine/Detector.php';

use ExtractCorel\Engine\Pdf;
use ExtractCorel\Engine\Lexer;
use ExtractCorel\Engine\Detector;

$data = file_get_contents(dirname(__DIR__, 2) . '/muestra.pdf');
$pdf = new Pdf($data);
$pdf->load();

echo "== obj 2 (pages node) ==\n";
$o2 = $pdf->object(2);
echo 'keys:', is_array($o2) ? implode(',', array_keys($o2)) : gettype($o2), "\n";
echo 'Kids:', json_encode($o2['value']['Kids'] ?? null), "\n";
echo 'Count:', json_encode($o2['value']['Count'] ?? null), "\n";

echo "\n== obj 30 (pagina 1) ==\n";
$o30 = $pdf->object(30);
echo 'MediaBox:', json_encode($o30['value']['MediaBox'] ?? null), "\n";
echo 'Contents:', json_encode($o30['value']['Contents'] ?? null), "\n";
echo 'Raw: ', substr($pdf->data, $pdf->offsetOf(30), 160), "\n";

echo "\n== obj 5 (content page 0) fechado ==\n";
echo 'Raw inicio: ', substr($pdf->data, $pdf->offsetOf(5), 120), "\n";

// Tambien ver si el primer kid de Pages es directo o indirecto
echo "\nKids raw del objeto Pages (substring):\n";
$off2 = $pdf->offsetOf(2);
echo substr($pdf->data, $off2, 160), "\n";

echo "\n== PRUEBAS AISLADAS parseValue ==\n";
$t1 = new Lexer('[4 0 R 30 0 R]', 0);
echo 'Kids aislado: ', json_encode($pdf->parseValue($t1)), "\n";
$t2 = new Lexer('[-0.0000 -0.0000 595.2756 841.8898]', 0);
echo 'MediaBox aislado: ', json_encode($pdf->parseValue($t2)), "\n";
$t3 = new Lexer('<< /Key 7 0 R /Otro 3.5 >>', 0);
echo 'Dict aislado: ', json_encode($pdf->parseValue($t3)), "\n";

echo "\n== TOKENS de '[4 0 R 30 0 R]' ==\n";
$tl = new Lexer('[4 0 R 30 0 R]', 0);
for ($i = 0; $i < 8; $i++) {
    $tok = $tl->token();
    echo $i, ': ', $tok[0], ' = ', var_export($tok[1], true), ' pos=', $tok[2], "\n";
    if ($tok[0] === Lexer::EOF || $tok[1] === ']') {
        break;
    }
}

echo "\n== parseValue aislado de referencia ==\n";
$t4 = new Lexer('4 0 R', 0);
echo 'ref aislada: ', json_encode($pdf->parseValue($t4)), "\n";
$t5 = new Lexer('0', 0);
echo 'num aislado: ', json_encode($pdf->parseValue($t5)), "\n";
$t6 = new Lexer('[30 0 R]', 0);
echo 'array ref aislado: ', json_encode($pdf->parseValue($t6)), "\n";
$t7 = new Lexer('[4 0 R]', 0);
echo 'array un ref: ', json_encode($pdf->parseValue($t7)), "\n";
$t8 = new Lexer('[4 0 R 30 0 R]', 0);
echo 'array dos refs: ', json_encode($pdf->parseValue($t8)), "\n";

echo "\n== DICTS ANIDADOS (con debug) ==\n";
$pdf->dbg = true;
$t9 = new Lexer('<< /Group << /CS 15 0 R /S /Transparency >> /Resources << /ProcSet [/PDF] /X 1 >> >>', 0);
echo 'anidado: ', json_encode($pdf->parseValue($t9)), "\n";
$pdf->dbg = false;

echo "\n== OBJETO PAGINA 4 ==\n";
$o4 = $pdf->object(4);
echo 'raw: ', substr($pdf->data, $pdf->offsetOf(4), 300), "\n";
echo 'value keys: ', is_array($o4['value'] ?? null) ? implode(',', array_keys($o4['value'])) : 'NO-DICT', "\n";
echo 'json value: ', json_encode($o4['value'] ?? null), "\n";
echo 'pageKey Resources: ', json_encode($pdf->pageKey($o4['value'] ?? [], 'Resources')), "\n";

echo "\n== DATOS PARA DETECTOR ==\n";
$pages = $pdf->getPages();
echo 'pages=', count($pages), "\n";
foreach ($pages as $i => $page) {
    $box = $pdf->pageBox($page);
    echo "  pagina $i box=", json_encode($box), " h=", $box[3] - $box[1], "\n";
    $res = $pdf->pageKey($page, 'Resources');
    echo "  Resources es array?", var_export(is_array($res), true), "\n";
    if (is_array($res)) {
        echo "  ResourceKeys=", implode(',', array_keys($res)), "\n";
    }
    $cont = $pdf->pageContents($page);
    echo "  contents count=", count($cont), " longitudes=", implode(',', array_map('strlen', $cont)), "\n";
    foreach ($cont as $j => $c) {
        echo "   contenido[$j] (primeros 100): ", substr(str_replace("\r", ' ', $c), 0, 100), "\n";
    }
    // Estrutura del detector sobre contenido
    $det = new Detector($pdf);
    $inst = new \ExtractCorel\Engine\ContentParser($pdf, $i, $box[3] - $box[1], $res, $det->extGStateMap($res));
    foreach ($cont as $j => $c) {
        $inst->run($c);
    }
    echo "  instancias detectadas en pagina $i: ", count($inst->getInstancias()), "\n";
    foreach ($inst->getInstancias() as $ii) {
        echo '    ', json_encode($ii), "\n";
    }
}
echo "\nResultado total: ", json_encode($det->analizarPdf()), "\n";