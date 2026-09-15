<?php
/**
 * Test CLI del puente TextMuy (herramienta de desarrollo).
 * Ejercita, con un entorno WordPress minimo (stubs), las partes del plugin
 * que conectan con el modulo TextMuy:
 *   - handle_guardar_texto: mapeo en config.json placeholders[id] (modo AJAX y fallback)
 *   - handle_procesar con el puente: texto_{id}/estilo_{id} + imagen_{id}
 *     sobre muestra.pdf, verificando que los PNG llegan al motor como imagenes.
 *
 * Los handlers terminan en exit (wp_redirect/wp_send_json), por lo que cada
 * fase se corre como proceso independiente y verifica en shutdown:
 *   php tests/texto_puente.php setup | guardar_ajax | guardar_vacio | procesar | rechazo
 *   php tests/texto_puente.php nonce [cap]   (seguridad del motor: nonce y capacidad)
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
function wp_nonce_url($u, $a = '') { return $u; }
function wp_nonce_field($a = '') { return ''; }
function size_format($n) { return (string)$n . ' B'; }
function wp_max_upload_size() { return 10485760; }
function add_query_arg($k, $v, $u = '') { return (string)$u . '?' . urlencode((string)$k) . '=' . urlencode((string)$v); }
function esc_html($t) { return htmlspecialchars((string)$t, ENT_QUOTES, 'UTF-8'); }
function esc_attr($t) { return htmlspecialchars((string)$t, ENT_QUOTES, 'UTF-8'); }
function esc_url($u) { return (string)$u; }
function selected($a, $b) { echo ((string)$a === (string)$b) ? ' selected="selected"' : ''; }
// Stubs conmutables por variable de entorno para la fase de seguridad (nonce|cap).
function wp_verify_nonce($n = '', $a = '') { return getenv('PD_PUENTE_SIN_NONCE') ? false : true; }
function current_user_can($a) { return getenv('PD_PUENTE_SIN_CAP') ? false : true; }
function wp_json_encode($d = null, $f = 0) { return json_encode($d, $f); }
function wp_is_writable($d) { return is_writable($d); }
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
function submit_button($t = '', $c = '', $n = '', $w = true) { echo '<button class="button">' . htmlspecialchars((string)$t) . '</button>'; }
function esc_textarea($t) { return htmlspecialchars((string)$t, ENT_QUOTES, 'UTF-8'); }
function checked($a, $b = true) { echo ((string)$a === (string)$b || ($b === true && !empty($a))) ? ' checked="checked"' : ''; }
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
$base_admin = dirname($plugin);
register_shutdown_function(function () use ($fase, $testBase, $plugin, $base_admin, $p) {
    $base = $base_admin;
    global $fallos;
    $uploads = $testBase . '/uploads/pmu';
    $redirect = isset($GLOBALS['test_redirect']) ? $GLOBALS['test_redirect'] : '';
    $json = isset($GLOBALS['test_json']) ? $GLOBALS['test_json'] : null;

    $admin_html = '';
    $admin_error = '';
    if ($fase === 'admin') {
        preparar_entorno($testBase, $base);
        // Catalogo sembrado por el motor y luego corrompido (0 bytes, quickstart 007 §6).
        $m_admin = $p->motor_para_tests();
        $m_admin->catalogo('tm-presets');
        $ruta_cat = $testBase . '/uploads/pmu/tm-presets/presets.json';
        file_put_contents($ruta_cat, ''); // catalogo corrupto de 0 bytes
        $_GET = ['ec_pdf' => 'muestra.pdf'];
        try {
            ob_start();
            // La consola espera $this = la instancia del plugin (render_page la incluye en contexto).
            $render_admin = function () use ($base) {
                include $base . '/admin/pdfs.php';
            };
            $render_admin = $render_admin->bindTo($p, get_class($p));
            $render_admin();
            $admin_html = (string)ob_get_clean();
        } catch (\Throwable $e) {
            $admin_error = $e->getMessage();
            while (ob_get_level() > 0) { @ob_end_clean(); }
        }
    }

    $switch_fase = $fase;
    switch ($switch_fase) {
        case 'admin':
            check('render sin fatal ni excepcion', $admin_error === '');
            check('aviso con la causa del motor', strpos($admin_html, 'motor:listar:') !== false);
            check('el selector de estilos sigue presente', strpos($admin_html, 'ec-select-estilo') !== false);
            break;
        case 'setup':
            check('PDF en pdfs/muestra/muestra.pdf', is_file($uploads . '/pdfs/muestra/muestra.pdf'));
            check('analisis.json junto al PDF (plan 008)', is_file($uploads . '/pdfs/muestra/analisis.json'));
            // Plan 008: carpeta con PDF + analisis (+ config si se creo); sin raiz heredada.
            $archivos = array_values(array_filter((array)@scandir($uploads . '/pdfs/muestra'), function ($x) {
                return $x !== '.' && $x !== '..';
            }));
            check('carpeta del producto con PDF + analisis', in_array('muestra.pdf', $archivos, true) && in_array('analisis.json', $archivos, true));
            check('sin raiz heredada uploads/personalizador-pdf', !is_dir($testBase . '/uploads/personalizador-pdf'));
            check('PNG del puente generado', !empty($GLOBALS['test_png']) && is_file($GLOBALS['test_png']));
            break;
        case 'guardar_ajax':
            // Plan 008: mapeo en config.json (el analisis no se toca).
            $cfg_ga = $p->motor_para_tests()->leer_config('muestra');
            $mapa_ga = isset($cfg_ga['placeholders']['0000FF']) ? $cfg_ga['placeholders']['0000FF'] : null;
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            check('config tipo=texto', $mapa_ga !== null && $mapa_ga['tipo'] === 'texto');
            check('config value saneado', $mapa_ga !== null && $mapa_ga['value'] === 'Juan Perez');
            check('config preset', $mapa_ga !== null && $mapa_ga['preset'] === 'neon-glow');
            check('analisis intacto', (function () use ($uploads) {
                $a = json_decode((string)@file_get_contents($uploads . '/pdfs/muestra/analisis.json'), true);
                foreach ((array)($a['grupos'] ?? []) as $g) {
                    if (isset($g['id']) && $g['id'] === '0000FF') {
                        return !isset($g['value']) && !isset($g['preset']);
                    }
                }
                return false;
            })());
            check('sin textos.json (SC-004)', !is_file($uploads . '/tmp/muestras/muestra/textos.json'));
            break;
        case 'guardar_vacio':
            check('activo sin texto rechazado (JSON error)', is_array($json) && $json['success'] === false);
            check('sin mapeo 0000FF en config', (function () use ($p) {
                $c = $p->motor_para_tests()->leer_config('muestra');
                return !isset($c['placeholders']['0000FF']);
            })());
            check('sin textos.json (SC-004)', !is_file($uploads . '/tmp/muestras/muestra/textos.json'));
            break;
        case 'procesar':
            $cfg_p = $p->motor_para_tests()->leer_config('muestra');
            $estilo_p = isset($cfg_p['placeholders']['0000FF']['preset']) ? $cfg_p['placeholders']['0000FF']['preset'] : null;
            check('PNG del puente guardado como imagen del grupo 0000FF', is_file($uploads . '/tmp/muestras/muestra/0000FF.png'));
            $firma = (string)@file_get_contents($uploads . '/tmp/muestras/muestra/0000FF.png', false, null, 0, 8);
            check('la imagen del grupo es PNG valido', $firma === "\x89PNG\r\n\x1a\n");
            check('salida del motor generada', is_file($uploads . '/tmp/muestras/muestra/muestra_procesado.pdf'));
            $resumen = isset($GLOBALS['test_transients']['personalizador_pdf_proceso']) ? $GLOBALS['test_transients']['personalizador_pdf_proceso'] : [];
            check('resumen: grupo 0000FF aplicado', in_array('0000FF', (array)($resumen['grupos_aplicados'] ?? []), true));
            check('resumen: grupo FF0000 sin imagen', in_array('FF0000', (array)($resumen['grupos_sin_imagen'] ?? []), true));
            check('redirect final a la consola', strpos($redirect, 'ec_procesado=1') !== false);
            // T030: muestras idempotentes: los aplicados usan un archivo por id
            // (ruta_aplicado) y la salida se sobrescribe (ruta_salida_tmp).
            $archivos_m = array_values(array_filter((array)@scandir($uploads . '/tmp/muestras/muestra'), function ($x) {
                return $x !== '.' && $x !== '..';
            }));
            sort($archivos_m);
            $ids_vistos = [];
            $duplicados = false;
            foreach ($archivos_m as $a) {
                $base_a = preg_replace('/[.][^.]+$/', '', $a);
                if (isset($ids_vistos[$base_a]) && $base_a !== 'textos') {
                    $duplicados = true;
                }
                $ids_vistos[$base_a] = true;
            }
            check('un archivo por grupo (sin duplicados)', !$duplicados && in_array('0000FF.png', $archivos_m, true));
            check('salida de muestra unica', in_array('muestra_procesado.pdf', $archivos_m, true));
            break;
        case 'borrado':
            // T030: borra el producto y verifica que no queden residuos de
            // pdfs/{pdf}/ ni tmp/muestras/{pdf}/, sin tocar tmp/cart/ (FR-019).
            // handle_borrar() ya corrio (exit en redirigir): verificar el disco.
            check('redirect a ec_borrado', strpos($redirect, 'ec_borrado=1') !== false);
            check('pdfs/{pdf}/ eliminado', !is_dir($testBase . '/uploads/pmu/pdfs/muestra'));
            check('tmp/muestras/{pdf}/ eliminado', !is_dir($testBase . '/uploads/pmu/tmp/muestras/muestra'));
            check('orders/ intacto', !is_dir($testBase . '/uploads/pmu/orders'));
            check('tmp/cart/ ajeno intacto', is_file($testBase . '/uploads/pmu/tmp/cart/linea-ajena/manifest.json'));
            break;
        case 'rechazo':
            check('id inexistente (FFFFFF) no se guarda', !is_file($uploads . '/tmp/muestras/muestra/FFFFFF.png'));
            check('archivo no-PNG no se guarda', !is_file($uploads . '/tmp/muestras/muestra/FF0000.png'));
            check('redirect con error de PNG invalido', strpos($redirect, 'ec_error=') !== false);
            break;
        case 'contenido':
            // Plan 008: la personalizacion del grupo vive en config.json
            // placeholders[id] (el analisis nunca se edita desde la UI).
            $cfg_c = $p->motor_para_tests()->leer_config('muestra');
            $mapa_c = isset($cfg_c['placeholders']['0000FF']) ? $cfg_c['placeholders']['0000FF'] : null;
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            check('tipo=texto', $mapa_c !== null && $mapa_c['tipo'] === 'texto');
            check('value=Hola Mundo', $mapa_c !== null && $mapa_c['value'] === 'Hola Mundo');
            check('preset=neon-glow', $mapa_c !== null && $mapa_c['preset'] === 'neon-glow');
            check('analisis intacto (SC-001)', (function () use ($uploads) {
                $a = json_decode((string)@file_get_contents($uploads . '/pdfs/muestra/analisis.json'), true);
                foreach ((array)($a['grupos'] ?? []) as $g) {
                    if (isset($g['id']) && $g['id'] === '0000FF') {
                        return !isset($g['value']) && !isset($g['preset']);
                    }
                }
                return false;
            })());
            check('sin textos.json (SC-004)', !is_file($uploads . '/tmp/muestras/muestra/textos.json'));
            break;
        case 'placeholder':
            // T026: placeholder al vuelo por id (sin archivos) + rechazo con id ausente.
            // $argv no llega al shutdown: el submodo viaja por $GLOBALS (fase placeholder [mal]).
            $sub = isset($GLOBALS['test_placeholder_sub']) ? (string)$GLOBALS['test_placeholder_sub'] : '';
            $cuerpo = isset($GLOBALS['test_descarga']) ? (string)$GLOBALS['test_descarga'] : '';
            if ($sub === 'mal') {
                $err = isset($GLOBALS['test_descarga_error']) ? (string)$GLOBALS['test_descarga_error'] : '';
                check('id inexistente rechazado', strpos($err, 'Placeholder no disponible') !== false);
                check('sin bytes ante rechazo', $cuerpo === '');
            } else {
                check('bytes PNG validos', substr($cuerpo, 0, 8) === "\x89PNG\r\n\x1a\n");
                $info = $cuerpo !== '' ? @getimagesizefromstring($cuerpo) : false;
                check('dimensiones w x h del grupo', is_array($info) && $info[0] === 1532 && $info[1] === 1145);
                check('0 archivos nuevos en el entorno', (int)($GLOBALS['test_descarga_nuevos'] ?? -1) === 0);
            }
            break;
        case 'linea':
            // T031b: alta de linea + manifest canonico con pmu_hash.
            $man = isset($GLOBALS['test_linea_man']) ? $GLOBALS['test_linea_man'] : null;
            $leido = isset($GLOBALS['test_linea_leido']) ? $GLOBALS['test_linea_leido'] : null;
            $err_l = isset($GLOBALS['test_linea_error']) ? (string)$GLOBALS['test_linea_error'] : '';
            check('alta sin error', $err_l === '' && is_array($man));
            check('pdf=muestra', is_array($man) && $man['pdf'] === 'muestra');
            check('cantidad=2', is_array($man) && $man['cantidad'] === 2);
            check('pmu_hash estable (sha1 del canon)', is_array($man) && $man['pmu_hash'] === sha1(wp_json_encode($man['personalizacion'])));
            check('id invalido descartado', is_array($man) && !isset($man['personalizacion']['ZZZ']));
            check('manifest releido igual al alta', $leido === $man);
            check('creado + motor presentes', is_array($man) && isset($man['creado'], $man['motor']));
            break;
        case 'campos':
            // 004/Fase A: CRUD del catalogo global con el motor (alta/edicion/baja).
            $ver = isset($GLOBALS['test_campos']) ? $GLOBALS['test_campos'] : null;
            $err_c = isset($GLOBALS['test_campos_error']) ? (string)$GLOBALS['test_campos_error'] : '';
            check('alta/edicion/baja sin error', $err_c === '' && is_array($ver));
            check('ids 1 y 2 asignados', is_array($ver) && $ver['id1'] === 1 && $ver['id2'] === 2);
            check('titulo editado persiste', is_array($ver) && $ver['tit1'] === 'Nombre editado');
            check('id 1 activo en catalogo', is_array($ver) && in_array(1, $ver['ids'], true));
            check('id 2 dado de baja (tombstone)', is_array($ver) && !in_array(2, $ver['ids'], true));
            check('sin aviso de catalogo', is_array($ver) && $ver['aviso'] === null);
            break;
        case 'config':
            // 004/Fase A: config.json por PDF (activo/productos/campos/placeholders).
            $cfg = isset($GLOBALS['test_config']) ? $GLOBALS['test_config'] : null;
            $ok_g = !empty($GLOBALS['test_config_ok']);
            check('guardar_config ok', $ok_g === true && is_array($cfg));
            check('activo=true', is_array($cfg) && $cfg['activo'] === true);
            check('productos saneados', is_array($cfg) && $cfg['productos'] === [123]);
            check('campos_ids saneados', is_array($cfg) && $cfg['campos_ids'] === [56, 2]);
            check('placeholder valido persiste', is_array($cfg) && isset($cfg['placeholders']['0000FF']) && $cfg['placeholders']['0000FF']['value'] === '[campo2]');
            check('ids invalidos descartados', is_array($cfg) && !isset($cfg['placeholders']['ZZZZZZ']) && !isset($cfg['placeholders']['FF0000']));
            check('defaults sin config', $GLOBALS['test_config_defaults'] === true);
            break;
        case 'tienda':
            // 004/Fase B: handler personalizador_pdf_config con POST clasico.
            $cfg_t = $p->motor_para_tests()->leer_config('muestra');
            check('redirect a ec_config', strpos($redirect, 'ec_config=1') !== false);
            check('activo=true', $cfg_t['activo'] === true);
            check('productos vacios sin Woo', $cfg_t['productos'] === []);
            check('campos 2,1 (999 descartado)', $cfg_t['campos_ids'] === [2, 1]);
            check('mapeo 0000FF persiste', isset($cfg_t['placeholders']['0000FF']) && $cfg_t['placeholders']['0000FF']['value'] === '[campo2]' && $cfg_t['placeholders']['0000FF']['settings'] === '[campo1]');
            check('FFFFFF ausente del dataset', !isset($cfg_t['placeholders']['FFFFFF']));
            check('tipo foto descartado', !isset($cfg_t['placeholders']['FF0000']));
            break;
        case 'pedido':
            // T031b: staging promovido a entregable por rename.
            $err_o = isset($GLOBALS['test_pedido_error']) ? (string)$GLOBALS['test_pedido_error'] : '';
            check('promocion sin error', $err_o === '' && !empty($GLOBALS['test_pedido_ok']));
            check('nota.txt en orders/4242/', !empty($GLOBALS['test_pedido_ok']));
            check('doble promocion rechazada', strpos((string)($GLOBALS['test_pedido_doble'] ?? ''), '4242') !== false);
            break;
        case 'migracion':
            // Fase eliminada: sin legado no hay migracion (plan 008 corte).
            check('fase migracion eliminada (sin legado)', !method_exists($p, 'migrar_datos_heredados'));
            break;
        case 'nonce':
            $sub = isset($GLOBALS['test_nonce_sub']) ? $GLOBALS['test_nonce_sub'] : 'nonce';
            check('respuesta JSON error (seguridad)', is_array($json) && $json['success'] === false);
            $causa = is_array($json) ? (string)$json['data'] : '';
            if ($sub === 'cap') {
                check('causa motor:capacidad:invalida', strpos($causa, 'motor:capacidad:invalida') !== false);
            } else {
                check('causa motor:nonce:invalido', strpos($causa, 'motor:nonce:invalido') !== false);
            }
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
    $muestra = $base . '/uploads/pmu/pdfs/muestra.pdf';
    if (!is_file($muestra)) {
        fwrite(STDERR, "No se encontro muestra.pdf en {$muestra}\n");
        exit(1);
    }
    // Layout vigente (plan 008): pdfs/{nombre}/{nombre}.pdf + analisis.json
    // (inmutable) + config.json (editable).
    $dirPdf = $testBase . '/uploads/pmu/pdfs/muestra';
    wp_mkdir_p($dirPdf);
    copy($muestra, $dirPdf . '/muestra.pdf');
    $pdf = new \ExtractCorel\Engine\Pdf((string)file_get_contents($muestra));
    $pdf->load();
    $grupos = (new \ExtractCorel\Engine\Detector($pdf))->analizarPdf()['grupos'];
    $analisis = \ExtractCorel\Engine\Metadata::generarAnalisis('muestra', $grupos);
    \ExtractCorel\Engine\Metadata::guardar($analisis, $dirPdf . '/analisis.json');
    // Presets del entorno aislado: el catalogo + el fisico .txm que usa guardar_ajax.
    $dirPre = $testBase . '/uploads/pmu/tm-presets';
    wp_mkdir_p($dirPre);
    copy($base . '/uploads/pmu/tm-presets/neon-glow.txm', $dirPre . '/neon-glow.txm');
    if (!class_exists('PMU_Uploads')) {
        require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
        require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
    }
    $motor = new PMU_Uploads();
    $cat = $motor->catalogo('tm-presets');
    $items = $cat['cat']['items'];
    $items[] = [1, 'Neon Glow', 'test', 'neon-glow.txm'];
    $motor->guardar_catalogo('tm-presets', ['thumbs' => $cat['cat']['thumbs'], 'items' => $items]);
}

switch ($fase) {
    case 'admin':
        // El render se verifica en shutdown; aqui basta con salir limpio.
        break;

    case 'setup':
        preparar_entorno($testBase, $base);
        // PNG del puente (lo que el navegador subira como imagen_{id}).
        $png = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($png, 300, 200);
        $GLOBALS['test_png'] = $png;
        break;

    case 'tienda':
        // 004/Fase B: dispara handle_config_guardar (hace exit en redirigir).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_t = new PMU_Uploads();
        $motor_t->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '']);
        $motor_t->campo_alta([0, 'Color', 'override', [], '', true, '<div></div>', '', '']);
        $_POST = [
            'action' => 'personalizador_pdf_config',
            'archivo' => 'muestra.pdf',
            'activo' => '1',
            'productos_txt' => "123\n456",
            'campos_ids' => ['2', '1', '2', '999'],
            'placeholders' => [
                '0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo2]', 'settings' => '[campo1]'],
                'FFFFFF' => ['tipo' => 'texto'],
                'FF0000' => ['tipo' => 'foto'],
            ],
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_config_guardar(); // exit en redirigir(ec_config)
        break;

    case 'guardar_ajax':
        preparar_entorno($testBase, $base);
        $_POST = [
            'action' => 'personalizador_pdf_guardar_texto',
            'archivo' => 'muestra.pdf',
            'id' => '0000FF',
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
            'id' => '0000FF',
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
        // El puente exige preset vigente: se siembra clean-modern como en guardar_ajax.
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_pr = new PMU_Uploads();
        $cat_pr = $motor_pr->catalogo('tm-presets');
        $items_pr = $cat_pr['cat']['items'];
        $items_pr[] = [2, 'Clean Modern', 'test', 'clean-modern.txm'];
        $motor_pr->guardar_catalogo('tm-presets', ['thumbs' => $cat_pr['cat']['thumbs'], 'items' => $items_pr]);
        // Monta $_FILES/$_POST exactamente como los envia el puente JS del navegador.
        $pngTemp = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($pngTemp, 300, 200);
        $_FILES = [
            'imagen_0000FF' => [
                'name' => 'a.png', 'type' => 'image/png',
                'tmp_name' => $pngTemp, 'error' => UPLOAD_ERR_OK, 'size' => filesize($pngTemp),
            ],
        ];
        $_POST = [
            'action' => 'personalizador_pdf_procesar',
            'archivo' => 'muestra.pdf',
            'texto_0000FF' => 'Juan <b>Perez</b>', // sanitize_text_field debe limpiarlo
            'estilo_0000FF' => 'clean-modern',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_procesar(); // exit en redirigir(ec_procesado)
        break;

    case 'borrado':
        // T030: borra el producto y verifica que no queden residuos de
        // pdfs/{pdf}/ ni tmp/muestras/{pdf}/, sin tocar tmp/cart/ (FR-019).
        // handle_borrar() termina en exit (redirigir): el borrado real se
        // ejecuta aqui y el shutdown solo verifica el estado en disco.
        preparar_entorno($testBase, $base);
        $motor_b = $p->motor_para_tests();
        // Linea de carrito ajena que debe sobrevivir al borrado.
        $motor_b->dir_tmp_cart('linea-ajena', true);
        file_put_contents($motor_b->manifest_cart('linea-ajena'), '{}');
        $_POST = [
            'action' => 'personalizador_pdf_borrar',
            'archivo' => 'muestra.pdf',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_borrar(); // exit en redirigir(ec_borrado)
        break;

    case 'contenido':
        // Guardar mapeo en config.json placeholders[0000FF].
        preparar_entorno($testBase, $base);
        $_POST = [
            'action' => 'personalizador_pdf_guardar_texto',
            'archivo' => 'muestra.pdf',
            'id' => '0000FF',
            'activo' => '1',
            'texto' => 'Hola Mundo',
            'estilo' => 'neon-glow',
            'ajax' => '1',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_guardar_texto(); // exit en wp_send_json_success
        break;

    case 'placeholder':
        // T026: placeholder al vuelo por id (sin archivos) + rechazo con id ausente.
        preparar_entorno($testBase, $base);
        $antes = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($testBase . '/uploads/pmu', FilesystemIterator::SKIP_DOTS)
        );
        $n_antes = iterator_count($antes);
        $gid_ph = (isset($argv[2]) && $argv[2] === 'mal') ? 'FFFFFF' : '0000FF';
        $GLOBALS['test_placeholder_sub'] = isset($argv[2]) ? (string)$argv[2] : '';
        $GLOBALS['test_descarga_error'] = '';
        try {
            $GLOBALS['test_descarga'] = $p->placeholder_bytes('muestra.pdf', $gid_ph);
        } catch (\Throwable $e) {
            $GLOBALS['test_descarga'] = '';
            $GLOBALS['test_descarga_error'] = $e->getMessage();
        }
        $despues = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($testBase . '/uploads/pmu', FilesystemIterator::SKIP_DOTS)
        );
        $GLOBALS['test_descarga_nuevos'] = iterator_count($despues) - $n_antes;
        break;

    case 'rechazo':
        preparar_entorno($testBase, $base);
        $pngTemp = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($pngTemp, 300, 200);
        $falso = sys_get_temp_dir() . '/pd_puente_falso_' . getmypid() . '.bin';
        file_put_contents($falso, 'NO ES UN PNG');
        $_FILES = [
            'imagen_FFFFFF' => [ // id valido de formato pero ausente del dataset: debe ignorarse
                'name' => 'x.png', 'type' => 'image/png',
                'tmp_name' => $pngTemp, 'error' => UPLOAD_ERR_OK, 'size' => filesize($pngTemp),
            ],
            'imagen_FF0000' => [ // grupo valido pero contenido no-PNG: debe rechazarse
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

    case 'nonce':
        // La verificacion de seguridad ocurre antes de tocar datos: no requiere muestra.pdf.
        $sub = isset($argv[2]) ? (string)$argv[2] : 'nonce';
        $GLOBALS['test_nonce_sub'] = $sub;
        if ($sub === 'cap') {
            putenv('PD_PUENTE_SIN_CAP=1'); // capacidad denegada: debe frenar antes que nada
        } else {
            putenv('PD_PUENTE_SIN_NONCE=1'); // nonce invalido: debe frenar antes de la op
        }
        $_POST = [
            'action' => 'pmu_uploads',
            'op' => 'listar',
            'scope' => 'img',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_pmu_uploads(); // exit en wp_send_json_error
        break;

    case 'linea':
        // T031b: alta de linea del comprador + manifest canonico con pmu_hash.
        preparar_entorno($testBase, $base);
        try {
            $man = $p->manifest_cart_alta('linea-test-1', 'muestra', [
                '0000FF' => ['default' => 'texto', 'value' => 'Hola', 'preset' => 'neon-glow', 'config' => null],
                'FFFFFF' => ['default' => 'x'], // id valido de formato: se guarda (canon puro)
                'zzz' => ['default' => 'texto'], // id invalido: se descarta
            ], 2);
            $GLOBALS['test_linea_man'] = $man;
            $GLOBALS['test_linea_leido'] = $p->manifest_cart_leer('linea-test-1');
        } catch (\Throwable $e) {
            $GLOBALS['test_linea_error'] = $e->getMessage();
        }
        break;

    case 'campos':
        // 004/Fase A: CRUD del catalogo global con el motor (alta/edicion/baja).
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        try {
            $motor_c = new PMU_Uploads();
            $id1 = $motor_c->campo_alta([0, 'Nombre', 'text', ['nombres'], 'Escribi tu nombre', true, '<div class="pmu-campo-x"><input name="nombre"></div>', '.x{}', 'function(ctx,root){return {valor:"",cliente:""};}']);
            $id2 = $motor_c->campo_alta([0, 'Color', 'override', [], '', true, '<div class="c"></div>', '', '']);
            $motor_c->campo_editar($id1, [$id1, 'Nombre editado', 'text', [], '', true, '<div></div>', '', '']);
            $motor_c->campo_baja($id2);
            $res_c = $motor_c->campos_catalogo('listar');
            $ids_c = [];
            $tit1 = null;
            foreach ($res_c['cat']['items'] as $t) {
                if (count($t) < 3 || $t[1] === '' || $t[2] === '') {
                    continue; // tombstone fuera
                }
                $ids_c[] = (int)$t[0];
                if ((int)$t[0] === $id1) {
                    $tit1 = $t[1];
                }
            }
            $GLOBALS['test_campos'] = ['id1' => $id1, 'id2' => $id2, 'ids' => $ids_c, 'tit1' => $tit1, 'aviso' => $res_c['aviso']];
        } catch (\Throwable $e) {
            $GLOBALS['test_campos_error'] = $e->getMessage();
        }
        break;

    case 'config':
        // 004/Fase A: config.json por PDF (activo/productos/campos/placeholders).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        try {
            $motor_g = new PMU_Uploads();
            $GLOBALS['test_config_ok'] = $motor_g->guardar_config('muestra', [
                'activo' => true,
                'productos' => [123, 0, -5, 123],
                'campos_ids' => [56, 2, 2, 0],
                'placeholders' => [
                    '0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo2]', 'settings' => '[campo56]'],
                    'ZZZZZZ' => ['tipo' => 'texto'],
                    'FF0000' => ['tipo' => 'foto'],
                ],
            ]);
            $GLOBALS['test_config'] = $motor_g->leer_config('muestra');
            $GLOBALS['test_config_defaults'] = ($motor_g->leer_config('inexistente') === ['activo' => false, 'productos' => [], 'campos_ids' => [], 'placeholders' => []]);
        } catch (\Throwable $e) {
            $GLOBALS['test_config_error'] = $e->getMessage();
        }
        break;

    case 'pedido':
        // T031b: staging tmp/orders/{id}/ promovido a orders/{id}/ por rename.
        preparar_entorno($testBase, $base);
        $motor_o = $p->motor_para_tests();
        try {
            $staging = $motor_o->dir_tmp_order(4242, true);
            file_put_contents($staging . DIRECTORY_SEPARATOR . 'nota.txt', 'staging');
            $GLOBALS['test_pedido_destino'] = $p->orden_promover(4242);
            $GLOBALS['test_pedido_ok'] = is_file($motor_o->dir_ambito('orders') . DIRECTORY_SEPARATOR . '4242' . DIRECTORY_SEPARATOR . 'nota.txt')
                && !is_dir($staging);
        } catch (\Throwable $e) {
            $GLOBALS['test_pedido_error'] = $e->getMessage();
        }
        // Promover dos veces debe fallar (sin staging / destino existente).
        try {
            $p->orden_promover(4242);
            $GLOBALS['test_pedido_doble'] = 'no-lanzo';
        } catch (\Throwable $e) {
            $GLOBALS['test_pedido_doble'] = $e->getMessage();
        }
        break;

}