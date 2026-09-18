<?php
/**
 * Inventario de datos de usuario (uploads/pmu/) — T002 de spec 004.
 *
 * Genera un manifiesto (ruta relativa + sha256 + tamano de cada archivo) para
 * comparar antes/despues de una implementacion y detectar escrituras
 * accidentales. NO modifica datos: solo lectura.
 *
 * Uso:
 *   php tests/inventario_pmu.php                       -> imprime el manifiesto
 *   php tests/inventario_pmu.php --guardar <ruta>      -> guarda el manifiesto
 *   php tests/inventario_pmu.php --comparar <ruta>     -> compara; exit 1 si difiere
 *   php tests/inventario_pmu.php --resumen             -> solo conteo por ambito
 *
 * NOTA: el baseline versionado (tests/baseline_pmu_manifest.txt) es un punto
 * de comparacion, no un contrato: datos reales cambiados por el admin
 * (re-analizar, migrar) exigen regenerarlo (--guardar) de forma consciente.
 */

error_reporting(E_ALL);

$base = dirname(__DIR__);
$raiz = $base . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pmu';

function pmu_manifestar($raiz)
{
    $filas = [];
    if (!is_dir($raiz)) {
        fwrite(STDERR, "No existe la raiz de datos: $raiz\n");
        exit(2);
    }
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($raiz, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($it as $archivo) {
        if (!$archivo->isFile()) {
            continue;
        }
        $ruta = $archivo->getPathname();
        $rel = str_replace('\\', '/', substr($ruta, strlen($raiz) + 1));
        $filas[] = $rel . "\t" . $archivo->getSize() . "\t" . hash_file('sha256', $ruta);
    }
    sort($filas, SORT_STRING);
    return $filas;
}

function pmu_resumen(array $filas)
{
    $porAmbito = [];
    $peso = 0;
    foreach ($filas as $f) {
        $partes = explode("\t", $f);
        $ambito = explode('/', $partes[0])[0];
        $porAmbito[$ambito] = ($porAmbito[$ambito] ?? 0) + 1;
        $peso += (int)$partes[1];
    }
    ksort($porAmbito);
    return [$porAmbito, $peso];
}

$modo = 'imprimir';
$param = null;
foreach (array_slice($GLOBALS['argv'], 1) as $arg) {
    if ($arg === '--guardar' || $arg === '--comparar' || $arg === '--resumen') {
        $modo = substr($arg, 2);
    } elseif ($param === null && $modo !== 'imprimir' && $modo !== 'resumen') {
        $param = $arg;
    }
}

$filas = pmu_manifestar($raiz);

if ($modo === 'resumen') {
    list($porAmbito, $peso) = pmu_resumen($filas);
    foreach ($porAmbito as $ambito => $n) {
        echo $ambito . ': ' . $n . " archivo(s)\n";
    }
    echo 'TOTAL: ' . count($filas) . " archivo(s), {$peso} bytes\n";
    exit(0);
}

$contenido = implode("\n", $filas) . "\n";

if ($modo === 'guardar') {
    if (!$param) {
        fwrite(STDERR, "Uso: --guardar <ruta>\n");
        exit(2);
    }
    file_put_contents($param, $contenido);
    echo 'Manifiesto guardado: ' . $param . ' (' . count($filas) . " archivos)\n";
    exit(0);
}

if ($modo === 'comparar') {
    if (!$param || !is_file($param)) {
        fwrite(STDERR, "Uso: --comparar <ruta-baseline>\n");
        exit(2);
    }
    $baseline = explode("\n", rtrim((string)file_get_contents($param), "\n"));
    $falta = array_diff($baseline, $filas);
    $nueva = array_diff($filas, $baseline);
    if (!$falta && !$nueva) {
        echo 'INVENTARIO SIN CAMBIOS (' . count($filas) . " archivos, identicos)\n";
        exit(0);
    }
    foreach ($falta as $f) {
        echo "FALTA/CAMBIO  " . $f . "\n";
    }
    foreach ($nueva as $f) {
        echo "NUEVO/CAMBIO  " . $f . "\n";
    }
    echo "Diferencias: " . count($falta) . " vs baseline, " . count($nueva) . " actuales\n";
    exit(1);
}

echo $contenido;
