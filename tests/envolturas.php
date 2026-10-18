<?php
/**
 * tests/envolturas.php - Envolturas (PowerClip) del Detector -> envolturas.json.
 *
 * El Detector captura el clip vectorial activo (W/W* + q/Q, tambien dentro de
 * Form XObjects) y Metadata lo normaliza al marco del rect de cada instancia
 * en el archivo DERIVADO `pdfs/{nombre}/envolturas.json`
 * (`grupos[gid][n] = {par, subs}`); analisis.json vuelve a su formato
 * original (sin envs) y la geo viaja bajo demanda (op=envoltura).
 *
 * Corre en CLI contra PDFs sinteticos (sin datos del usuario).
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Solo CLI\n");
    exit(1);
}

require dirname(__DIR__) . '/engine/Pdf.php';
require dirname(__DIR__) . '/engine/Detector.php';
require dirname(__DIR__) . '/engine/Metadata.php';

use ExtractCorel\Engine\Detector;
use ExtractCorel\Engine\Metadata;
use ExtractCorel\Engine\Pdf;

$fallas = 0;

function check($nombre, $cond, $det = '')
{
    global $fallas;
    if ($cond) {
        echo '  OK    ' . $nombre . ($det !== '' ? '  [' . $det . ']' : '') . "\n";
    } else {
        $fallas++;
        echo '  FALLA ' . $nombre . ($det !== '' ? '  [' . $det . ']' : '') . "\n";
    }
}

/** PDF de una pagina con ExtGState ca=0 (placeholder transparente valido). */
function pdfBytes($contenido, $form = null)
{
    $objs = [
        1 => '<< /Type /Catalog /Pages 2 0 R >>',
        2 => '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        3 => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /ExtGState << /GS1 5 0 R >>'
            . ($form !== null ? ' /XObject << /Fm1 6 0 R >>' : '')
            . ' >> /Contents 4 0 R >>',
        4 => "<< /Length " . strlen($contenido) . " >>\nstream\n" . $contenido . "\nendstream",
        5 => '<< /Type /ExtGState /ca 0 /CA 1 >>',
    ];
    if ($form !== null) {
        $objs[6] = '<< /Type /XObject /Subtype /Form /BBox [0 0 595 842] /Resources << >> /Length '
            . strlen($form) . " >>\nstream\n" . $form . "\nendstream";
    }
    $out = "%PDF-1.4\n";
    $offs = [];
    foreach ($objs as $n => $cuerpo) {
        $offs[$n] = strlen($out);
        $out .= $n . " 0 obj\n" . $cuerpo . "\nendobj\n";
    }
    $xref = strlen($out);
    $out .= "xref\n0 " . (count($objs) + 1) . "\n0000000000 65535 f \n";
    foreach ($offs as $off) {
        $out .= sprintf("%010d 00000 n \n", $off);
    }
    $out .= "trailer\n<< /Size " . (count($objs) + 1) . " /Root 1 0 R >>\nstartxref\n" . $xref . "\n%%EOF";
    return $out;
}

function analizar($contenido, $form = null)
{
    $pdf = new Pdf(pdfBytes($contenido, $form));
    $pdf->load();
    $grupos = (new Detector($pdf))->analizarPdf()['grupos'];
    return [
        'analisis' => Metadata::generarAnalisis('envoltura', $grupos, 200),
        'envolturas' => Metadata::generarEnvolturas('envoltura', $grupos),
    ];
}

echo "Envolturas (PowerClip)\n";

/* 1) Clip W (non-zero) con curvas Bézier alrededor del placeholder. */
$a1 = analizar(
    "/GS1 gs\n"
    . "q\n"
    . "200 300 m 400 300 400 500 200 500 c h W n\n"
    . "1 0 0 rg\n"
    . "250 350 100 120 re f\n"
    . "Q\n"
    . "1 0 0 rg\n"
    . "50 50 60 40 re f\n"
);
$g1 = $a1['analisis']['grupos'][0] ?? null;
check('W: grupo FF0000 con 2 instancias', $g1 && $g1['id'] === 'FF0000' && (int)$g1['cont'] === 2);
check('analisis sin envs (formato original)', $g1 && !isset($g1['envs']));
check('envolturas: version 2 y pdf', ($a1['envolturas']['version'] ?? 0) === 2
    && ($a1['envolturas']['pdf'] ?? '') === 'envoltura');
$e1g = $a1['envolturas']['grupos']['FF0000'] ?? null;
check('W: 1 forma distinta con mapa COMPLETO', is_array($e1g) && count($e1g['formas']) === 1
    && ($e1g['mapa']['1'] ?? null) === 1 && ($e1g['mapa']['2'] ?? null) === 0);
check('W: defecto = la unica forma y usos = 1', is_array($e1g)
    && (int)$e1g['defecto'] === 1 && (int)$e1g['formas'][0]['usos'] === 1);
$e1 = is_array($e1g) ? ($e1g['formas'][0] ?? null) : null;
check('W: par = 0 (non-zero)', $e1 && (int)$e1['par'] === 0);
check('W: una subruta con curva y cierre', $e1 && count($e1['subs']) === 1
    && count($e1['subs'][0]['s']) === 1 && $e1['subs'][0]['s'][0][0] === 'c'
    && !empty($e1['subs'][0]['c']));
// Rect 250,350 100x120; clip m(200,300) -> u=-0.5, v=1-(-50/120)=1.4167.
$m1 = $e1['subs'][0]['m'] ?? [99, 99];
check('W: m normalizado (-0.5, 1.4167)', abs($m1[0] + 0.5) < 1e-3 && abs($m1[1] - 1.4167) < 1e-3, json_encode($m1));
// Curva: c(400,300)(400,500)(200,500) -> final u=-0.5, v=1-(150/120)=-0.25.
$s1 = $e1['subs'][0]['s'][0] ?? [];
check('W: curva con 3 puntos (controles + final)', count($s1) === 7
    && abs($s1[1] - 1.5) < 1e-3 && abs($s1[2] - 1.4167) < 1e-3
    && abs($s1[5] + 0.5) < 1e-3 && abs($s1[6] + 0.25) < 1e-3, json_encode($s1));

/* 2) Clip W* (even-odd) con un rectangulo de recorte. */
$a2 = analizar(
    "/GS1 gs\nq\n100 100 200 200 re W* n\n1 0 0 rg\n150 150 60 60 re f\nQ\n"
);
$e2 = $a2['envolturas']['grupos']['FF0000']['formas'][0] ?? null;
check('W*: par = 1 (even-odd)', $e2 && (int)$e2['par'] === 1);
check('W*: subruta cerrada de lineas', $e2 && count($e2['subs'][0]['s']) === 3
    && $e2['subs'][0]['s'][0][0] === 'l' && !empty($e2['subs'][0]['c']));
// Rect clip 100,100; placeholder 150,150 60x60 -> m u=-0.8333, v=1.8333.
$m2 = $e2['subs'][0]['m'] ?? [99, 99];
check('W*: m normalizado (-0.8333, 1.8333)', abs($m2[0] + 0.8333) < 1e-3 && abs($m2[1] - 1.8333) < 1e-3, json_encode($m2));

/* 3) Clip abandonado por Q antes del relleno: sin envoltura (pero detectado). */
$a3 = analizar(
    "/GS1 gs\nq\n10 10 500 500 re W n\nQ\n1 0 0 rg\n100 200 80 60 re f\n"
);
$g3 = $a3['analisis']['grupos'][0] ?? null;
check('Q antes del relleno: sin envs en envolturas.json', ($a3['envolturas']['grupos'] ?? []) === []);
check('Q antes del relleno: la instancia se detecta igual', $g3 && (int)$g3['cont'] === 1);

/* 4) Clip dentro de un Form XObject (placeholder embebido en el form). */
$a4 = analizar(
    "/GS1 gs\n/Fm1 Do\n",
    "q\n300 300 m 400 300 l 400 400 l 300 400 l h W n\n1 0 0 rg\n310 310 80 80 re f\nQ\n"
);
$g4 = $a4['analisis']['grupos'][0]['id'] ?? '';
$e4 = $a4['envolturas']['grupos'][$g4]['formas'][0] ?? null;
check('Form XObject: placeholder con envoltura', $e4 !== null);
// Rect 310,310 80x80; clip m(300,300) -> u=-0.125, v=1.125.
$m4 = $e4['subs'][0]['m'] ?? [99, 99];
check('Form XObject: m normalizado (-0.125, 1.125)', abs($m4[0] + 0.125) < 1e-3 && abs($m4[1] - 1.125) < 1e-3, json_encode($m4));

/* 5) Forma patologicamente densa (> Metadata::ENV_SEG_MAX): sin envoltura. */
$lineas = '';
for ($i = 0; $i < 5101; $i++) {
    $lineas .= (20 + ($i % 100)) . ' ' . (20 + ($i % 80)) . ' l ';
}
$a5 = analizar(
    "/GS1 gs\nq\n100 100 m " . $lineas . "W n\n1 0 0 rg\n150 150 60 60 re f\nQ\n"
);
$g5 = $a5['analisis']['grupos'][0] ?? null;
check('densa: la instancia se detecta igual', $g5 && (int)$g5['cont'] === 1);
check('densa: sin envoltura por tope de segmentos',
    ($a5['envolturas']['grupos'][$g5['id'] ?? ''] ?? null) === null);

/* 6) EL CASO REPORTADO: N instancias, cada una con SU marco identico
   (relativo a su rect) -> UNA sola forma. Antes se guardaba una copia por
   instancia y el tope de 100 truncaba el resto. */
$repes = '';
for ($i = 0; $i < 60; $i++) {
    $dx = 1 + ($i % 10);
    $dy = 1 + intdiv($i, 10);
    $repes .= "q\n1 0 0 1 $dx $dy cm\n"
        . "200 300 m 400 300 400 500 200 500 c h W n\n"
        . "1 0 0 rg\n250 350 100 120 re f\nQ\n";
}
$a6 = analizar("/GS1 gs\n" . $repes);
$g6 = $a6['analisis']['grupos'][0] ?? null;
$e6 = $a6['envolturas']['grupos']['FF0000'] ?? null;
check('60 iguales: las 60 instancias se detectan', $g6 && (int)$g6['cont'] === 60);
check('60 iguales: UNA sola forma con usos = 60', is_array($e6)
    && count($e6['formas']) === 1 && (int)$e6['formas'][0]['usos'] === 60);
check('60 iguales: mapa completo (60 entradas, todas la forma 1)', is_array($e6)
    && count($e6['mapa']) === 60 && count(array_unique($e6['mapa'])) === 1
    && (int)$e6['mapa']['60'] === 1);
check('60 iguales: archivo chico (sin copias del marco)',
    strlen(json_encode($a6['envolturas'])) < 4000,
    strlen(json_encode($a6['envolturas'])) . ' bytes');

/* 7) Dos instancias con marcos DISTINTOS -> dos formas y excepcion real. */
$a7 = analizar(
    "/GS1 gs\nq\n200 300 m 400 300 400 500 200 500 c h W n\n1 0 0 rg\n250 350 100 120 re f\nQ\n"
    . "q\n300 300 m 500 300 500 500 300 500 c h W n\n1 0 0 rg\n320 350 100 120 re f\nQ\n"
);
$e7 = $a7['envolturas']['grupos']['FF0000'] ?? null;
check('distintos: 2 formas y defecto = la primera', is_array($e7)
    && count($e7['formas']) === 2 && (int)$e7['defecto'] === 1);
check('distintos: mapa por instancia (1->1, 2->2)', is_array($e7)
    && (int)$e7['mapa']['1'] === 1 && (int)$e7['mapa']['2'] === 2);

if ($fallas > 0) {
    echo "ENVOLTURAS FALLA: $fallas checks.\n";
    exit(1);
}
echo "ENVOLTURAS OK\n";
