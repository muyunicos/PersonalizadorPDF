<?php
/** Verifica el estado del espejo uploads/pmu contra lo que el motor declara.
 *  NO modifica nada: solo lee e informa (uso: php tests/estado_pmu.php).
 */
$fase = isset($argv[1]) ? $argv[1] : 'estado';
if ($fase === 'estado') {
    $base = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pmu';
    $esperados = [
        'catálogo de fuentes' => 'fonts/fonts.json',
        'catálogo de imágenes' => 'img/img.json',
        'catálogo de mockups' => 'mockups/mockups.json',
        'catálogo de estilos'  => 'tm-presets/presets.json',
        'catálogo de campos'  => 'campos.json',
    ];
    $fallos = 0;
    echo "== Archivos iniciales obligatorios ==\n";
    foreach ($esperados as $nombre => $rel) {
        $ruta = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rel);
        if (!is_file($ruta)) {
            echo "  FALTA   $nombre  ($rel)\n";
            $fallos++;
            continue;
        }
        $d = json_decode((string)@file_get_contents($ruta), true);
        if (!is_array($d)) {
            echo "  MAL     $nombre  ($rel): JSON invalido\n";
            $fallos++;
            continue;
        }
        $n = isset($d['items']) && is_array($d['items']) ? count($d['items']) : 0;
        $firma = !empty($d['thumbs']['sprite_firma']) ? ' [hoja certificada]' : '';
        echo "  OK      $nombre  ($rel): $n items$firma\n";
    }

    echo "\n== Resolubles por dominio ==\n";
    $pdfs = $base . DIRECTORY_SEPARATOR . 'pdfs';
    if (is_dir($pdfs)) {
        foreach (scandir($pdfs) as $e) {
            if ($e === '.' || $e === '..' || !is_dir($pdfs . DIRECTORY_SEPARATOR . $e)) {
                continue;
            }
            $d = $pdfs . DIRECTORY_SEPARATOR . $e;
            $orig = is_file($d . DIRECTORY_SEPARATOR . $e . '.pdf');
            $an = is_file($d . DIRECTORY_SEPARATOR . 'analisis.json');
            $cfg = is_file($d . DIRECTORY_SEPARATOR . 'config.json');
            $estado = $an ? 'listo' : ($orig ? 'SIN analizar (falta analisis.json)' : 'sin PDF');
            echo "  pdfs/$e: $estado | config.json=" . ($cfg ? 'si' : 'no') . "\n";
        }
    }
    echo "\n" . ($fallos ? "$fallos archivo(s) inicial(es) ausente(s)\n" : "Estado inicial completo\n");
    exit($fallos ? 1 : 0);
}
echo "Fase desconocida\n";
exit(2);