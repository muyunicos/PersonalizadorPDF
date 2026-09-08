<?php
/**
 * Test CLI del puente TextMuy (herramienta de desarrollo).
 * Ejercita, con un entorno WordPress minimo (stubs), las partes del plugin
 * que conectan con el modulo TextMuy:
 *   - handle_guardar_texto: estado datos/{pdf}/textos.json (modo AJAX y fallback)
 *   - handle_procesar con el puente: texto_{letra}/estilo_{letra} + imagen_{letra}
 *     sobre muestra.pdf, verificando que los PNG llegan al motor como imagenes.
 *
 * Los handlers terminan en exit (wp_redirect/wp_send_json), por lo que cada
 * fase se corre como proceso independiente y verifica en shutdown:
 *   php tests/texto_puente.php setup | guardar_ajax | guardar_vacio | procesar | rechazo
 */

$fase = isset($argv[1]) ? $argv[1] : 'setup';
$plugin = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'personalizador-pdf.php';

// ====== Entorno aislado en %TEMP% ======
$testBase = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pd_puente_' . getmypid();
if (is_dir($testBase)) {
    foreach (new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($testBase, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    ) as $x) {
        $x->isDir() ? @rmdir($x->getPathname()) : @unlink($x->getPathname());
    }
    @rmdir($testBase);
}

// ====== Stubs minimos de WordPress ======
define('ABSPATH', __DIR__ . '/');
define('HOUR_IN_SECONDS', 3600);
function wp_upload_dir() { global $testBase; return ['basedir' => $testBase . '/uploads', 'baseurl' => 'http://test/uploads']; }
function plugin_dir_path($f) { return dirname($f) . DIRECTORY_SEPARATOR; }
function plugin_dir_url($f) { return 'http://test/wp-content/plugins/personalizador-pdf/'; }
function add_action(...$a) { return true; }
function add_menu_page(...$a) { return true; }
function wp_enqueue_style(...$a) { return true; }
function wp_enqueue_script(...$a) { return true; }
function wp_enqueue_media() { return true; }
function wp_localize_script(...$a) { return true; }
function wp_create_nonce($a) { return 'nonce'; }
function wp_verify_nonce($n = '', $a = '') { return true; }
function current_user_can($a) { return true; }
function wp_mkdir_p($d) { return @mkdir($d, 0777, true); }
function trailingslashit($s) { return rtrim($s, '/\\') . '/'; }
function sanitize_key($k) { return strtolower(preg_replace('/[^a-z0-9_\-]/', '', (string)$k)); }
function sanitize_file_name($n) { return preg_replace('/[^A-Za-z0-9_\-\.]/', '_', (string)$n); }
function sanitize_text_field($t) { return trim(strip_tags((string)$t)); }
function wp_unslash($v) { return $v; }
function wp_die($m = '') { throw new Exception('wp_die: ' . $m); }
function admin_url($p = '') { return 'http://test/wp-admin/' . $p; }
function wp_redirect($u) { $GLOBALS['test_redirect'] = $u; }
function wp_send_json_success($d) { $GLOBALS['test_json'] = ['success' => true, 'data' => $d]; exit; }
function wp_send_json_error($d) { $GLOBALS['test_json'] = ['success' => false, 'data' => $d]; exit; }
function set_transient($k, $v, $e = 0) { $GLOBALS['test_transients'][$k] = $v; return true; }
function get_transient($k) { return isset($GLOBALS['test_transients'][$k]) ? $GLOBALS['test_transients'][$k] : false; }
function register_activation_hook($f, $cb) { return true; }

require $plugin;
$p = Personalizador_PDF_Plugin::instance();

$fallos = [];
function check($nombre, $cond)
{
    global $fallos;
    echo ($cond ? '  OK   ' : '  FAIL') . ' ' . $nombre . "\n";
    if (!$cond) {
        $fallos[] = $nombre;
    }
}

// Verificacion en shutdown: los handlers terminan con exit (redirect/JSON).
register_shutdown_function(function () use ($fase, $testBase, $plugin) {
    global $fallos;
    $uploads = $testBase . '/uploads/personalizador-pdf';
    $redirect = isset($GLOBALS['test_redirect']) ? $GLOBALS['test_redirect'] : '';
    $json = isset($GLOBALS['test_json']) ? $GLOBALS['test_json'] : null;

    switch ($fase) {
        case 'setup':
            check('PDF copiado a uploads', is_file($uploads . '/pdfs/muestra.pdf'));
            check('dataset metadata.json', is_file($uploads . '/datos/muestra/metadata.json'));
            check('PNG del puente generado', !empty($GLOBALS['test_png']) && is_file($GLOBALS['test_png']));
            break;
        case 'guardar_ajax':
            $textos = json_decode((string)@file_get_contents($uploads . '/datos/muestra/textos.json'), true);
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            check('textos.json con grupo a activo', is_array($textos) && isset($textos['a']['activo']) && $textos['a']['activo'] === true);
            check('texto saneado', isset($textos['a']['texto']) && $textos['a']['texto'] === 'Juan Perez');
            check('estilo saneado', isset($textos['a']['estilo']) && $textos['a']['estilo'] === 'neon-glow');
            break;
        case 'guardar_vacio':
            $textos = json_decode((string)@file_get_contents($uploads . '/datos/muestra/textos.json'), true);
            check('activo sin texto rechazado (JSON error)', is_array($json) && $json['success'] === false);
            check('textos.json sigue vacio (sin grupo a)', !isset($textos['a']));
            break;
        case 'procesar':
            $textos = json_decode((string)@file_get_contents($uploads . '/datos/muestra/textos.json'), true);
            check('textos.json persistido por handle_procesar', is_array($textos) && isset($textos['a']['estilo']) && $textos['a']['estilo'] === 'clean-modern');
            check('PNG del puente guardado como imagen del grupo a', is_file($uploads . '/imagenes/muestra/a.png'));
            $firma = (string)@file_get_contents($uploads . '/imagenes/muestra/a.png', false, null, 0, 8);
            check('la imagen del grupo es PNG valido', $firma === "\x89PNG\r\n\x1a\n");
            check('salida del motor generada', is_file($uploads . '/salidas/muestra_procesado.pdf'));
            $resumen = isset($GLOBALS['test_transients']['personalizador_pdf_proceso']) ? $GLOBALS['test_transients']['personalizador_pdf_proceso'] : [];
            check('resumen: grupo a aplicado', in_array('a', (array)($resumen['grupos_aplicados'] ?? []), true));
            check('resumen: grupo b sin imagen', in_array('b', (array)($resumen['grupos_sin_imagen'] ?? []), true));
            check('redirect final a la consola', strpos($redirect, 'ec_procesado=1') !== false);
            break;
        case 'rechazo':
            check('letra inexistente (x) no se guarda', !is_file($uploads . '/imagenes/muestra/x.png'));
            check('archivo no-PNG no se guarda', !is_file($uploads . '/imagenes/muestra/b.png'));
            check('redirect con error de PNG invalido', strpos($redirect, 'ec_error=') !== false);
            break;
        default:
            check('fase desconocida', false);
    }

    if ($fallos) {
        echo "FASE {$fase}: " . count($fallos) . " fallo(s)\n";
        exit(1);
    }
    echo "FASE {$fase} OK\n";
});

// ====== Fases (cada una es un proceso propio; el handler cierra con exit) ======
$base = dirname($plugin);

function preparar_entorno($testBase, $base)
{
    // muestra.pdf ya no se versiona: vive en la carpeta de datos del proyecto (uploads/).
    $muestra = dirname($base) . '/uploads/personalizador-pdf/pdfs/muestra.pdf';
    if (!is_file($muestra)) {
        fwrite(STDERR, "No se encontro muestra.pdf en {$muestra}\n");
        exit(1);
    }
    wp_mkdir_p($testBase . '/uploads/personalizador-pdf/pdfs');
    copy($muestra, $testBase . '/uploads/personalizador-pdf/pdfs/muestra.pdf');
    $pdf = new \ExtractCorel\Engine\Pdf((string)file_get_contents($muestra));
    $pdf->load();
    $grupos = (new \ExtractCorel\Engine\Detector($pdf))->analizarPdf()['grupos'];
    $datos = \ExtractCorel\Engine\Metadata::generar('muestra', $grupos);
    \ExtractCorel\Engine\Metadata::guardar($datos, $testBase . '/uploads/personalizador-pdf/datos/muestra/metadata.json');
}

switch ($fase) {
    case 'setup':
        preparar_entorno($testBase, $base);
        // PNG del puente (lo que el navegador subira como imagen_{letra}).
        $png = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($png, 300, 200);
        $GLOBALS['test_png'] = $png;
        break;

    case 'guardar_ajax':
        preparar_entorno($testBase, $base);
        $_POST = [
            'action' => 'personalizador_pdf_guardar_texto',
            'archivo' => 'muestra.pdf',
            'letra' => 'a',
            'activo' => '1',
            'texto' => 'Juan Perez',
            'estilo' => 'neon-glow',
            'ajax' => '1',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_guardar_texto(); // exit en wp_send_json_success
        break;

    case 'guardar_vacio':
        preparar_entorno($testBase, $base);
        $_POST = [
            'action' => 'personalizador_pdf_guardar_texto',
            'archivo' => 'muestra.pdf',
            'letra' => 'a',
            'activo' => '1',
            'texto' => '',
            'estilo' => 'neon-glow',
            'ajax' => '1',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_guardar_texto(); // exit en wp_send_json_error
        break;

    case 'procesar':
        preparar_entorno($testBase, $base);
        // Monta $_FILES/$_POST exactamente como los envia el puente JS del navegador.
        $pngTemp = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($pngTemp, 300, 200);
        $_FILES = [
            'imagen_a' => [
                'name' => 'a.png', 'type' => 'image/png',
                'tmp_name' => $pngTemp, 'error' => UPLOAD_ERR_OK, 'size' => filesize($pngTemp),
            ],
        ];
        $_POST = [
            'action' => 'personalizador_pdf_procesar',
            'archivo' => 'muestra.pdf',
            'texto_a' => 'Juan <b>Perez</b>', // sanitize_text_field debe limpiarlo
            'estilo_a' => 'clean-modern',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_procesar(); // exit en redirigir(ec_procesado)
        break;

    case 'rechazo':
        preparar_entorno($testBase, $base);
        $pngTemp = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($pngTemp, 300, 200);
        $falso = sys_get_temp_dir() . '/pd_puente_falso_' . getmypid() . '.bin';
        file_put_contents($falso, 'NO ES UN PNG');
        $_FILES = [
            'imagen_x' => [ // letra inexistente en el dataset: debe ignorarse
                'name' => 'x.png', 'type' => 'image/png',
                'tmp_name' => $pngTemp, 'error' => UPLOAD_ERR_OK, 'size' => filesize($pngTemp),
            ],
            'imagen_b' => [ // grupo valido pero contenido no-PNG: debe rechazarse
                'name' => 'b.png', 'type' => 'image/png',
                'tmp_name' => $falso, 'error' => UPLOAD_ERR_OK, 'size' => filesize($falso),
            ],
        ];
        $_POST = [
            'action' => 'personalizador_pdf_procesar',
            'archivo' => 'muestra.pdf',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_procesar(); // exit en redirigir(ec_error)
        break;
}