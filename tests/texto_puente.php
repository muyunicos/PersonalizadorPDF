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
define('DAY_IN_SECONDS', 86400);
function wp_upload_dir() { global $testBase; return ['basedir' => $testBase . '/uploads', 'baseurl' => 'http://test/uploads']; }
function plugin_dir_path($f) { return dirname($f) . DIRECTORY_SEPARATOR; }
function plugin_dir_url($f) { return 'http://test/wp-content/plugins/personalizador-pdf/'; }
function add_shortcode(...$a) { return true; }
function add_action(...$a) { return true; }
function add_filter(...$a) { return true; }
function add_menu_page(...$a) { return true; }
function wp_enqueue_style(...$a) { return true; }
function wp_enqueue_script(...$a) { return true; }
function wp_enqueue_media() { return true; }
function wp_localize_script(...$a) { $GLOBALS['test_localizados'][($a[0] ?? '') . '#' . ($a[1] ?? '')] = $a[2] ?? null; return true; }
function wp_create_nonce($a) { return 'nonce'; }
function wp_nonce_url($u, $a = '') { return $u; }
function wp_nonce_field($a = '') { return ''; }
function size_format($n) { return (string)$n . ' B'; }
function wp_max_upload_size() { return 10485760; }
function add_query_arg($k, $v = '', $u = '') {
    if (is_array($k)) {
        $out = (string)$v;
        foreach ($k as $a => $b) { $out .= (strpos($out, '?') === false ? '?' : '&') . urlencode((string)$a) . '=' . urlencode((string)$b); }
        return $out;
    }
    return (string)$u . '?' . urlencode((string)$k) . '=' . urlencode((string)$v);
}
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
function wp_kses($t, $allowed = []) { $tags = ''; foreach ((array)$allowed as $tag => $attrs) { $tags .= '<' . $tag . '>'; } return strip_tags((string)$t, $tags ?: '<p><b><i><strong><em><br><ul><li>'); }
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

// Stub Woo minimo (T015): el carrito solo existe si el test lo instala.
class TestWC_Cart
{
    public $cart_contents = [];
    public function get_cart_item($k) { return isset($this->cart_contents[$k]) ? $this->cart_contents[$k] : []; }
}
class TestWC
{
    public $cart;
    public function __construct() { $this->cart = new TestWC_Cart(); }
}
function WC() { return isset($GLOBALS['test_wc']) ? $GLOBALS['test_wc'] : null; }
// Vinculo producto<->PDF (canonico postmeta lista): el arnes sabe de UN producto (4242).
function get_post_meta($id, $key = '', $single = false) {
    if ((int)$id !== 4242) { return ($single || $key === '_pmu_pdf_slugs') ? '' : []; }
    if ($key === '_pmu_pdf_slugs') {
        return isset($GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'])
            ? $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs']
            : (isset($GLOBALS['test_postmeta'][4242]['_pmu_pdf_slug']) ? '' : '');
    }
    if ($key === '_pmu_pdf_slug' && $single) {
        if (isset($GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'])) { return ''; }
        return isset($GLOBALS['test_postmeta'][4242]['_pmu_pdf_slug'])
            ? $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slug'] : 'muestra';
    }
    if ($key === '') { return isset($GLOBALS['test_postmeta'][4242]) ? $GLOBALS['test_postmeta'][4242] : []; }
    return $single ? '' : [];
}
function update_post_meta($id, $key = '', $value = '') { $GLOBALS['test_postmeta'][(int)$id][$key] = $value; return true; }
function delete_post_meta($id, $key = '') { unset($GLOBALS['test_postmeta'][(int)$id][$key]); return true; }
function get_permalink($id = 0) { return 'http://test/?p=' . (int)$id; }
function get_the_ID() { return 4242; }
class TestWC_Product { private $id = 0; public function __construct($id = 0) { $this->id = (int)$id; } public function get_id() { return $this->id; } public function get_name() { return 'Producto ' . $this->id; } }
class TestPMUOrder {
    private $id;
    private $meta = [];
    public function __construct($id = 0, array $meta = []) { $this->id = (int)$id; $this->meta = $meta; }
    public function get_id() { return $this->id; }
    public function get_meta($key = '', $single = false) { return $this->meta[$key] ?? ''; }
    public function get_order_key() { return 'test-order-key'; }
    public function get_customer_id() { return 1; }
}
function wc_get_order($id = 0) { return $GLOBALS['test_order'] ?? null; }
function get_current_user_id() { return (int)($GLOBALS['test_user_id'] ?? 1); }
function wc_get_product($p = null) { return $p instanceof TestWC_Product ? $p : new TestWC_Product((int)$p); }

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
        case 'desactivar':
            $cfg_d = $p->motor_para_tests()->leer_config('muestra');
            check('redirect de configuracion', strpos($redirect, 'ec_config=1') !== false);
            check('PDF desactivado', $cfg_d['activo'] === false);
            check('analisis intacto al desactivar', file_get_contents($uploads . '/pdfs/muestra/analisis.json') === $GLOBALS['test_analisis_previo']);
            check('mapeos conservados al desactivar', $cfg_d['placeholders'] === $GLOBALS['test_config_previa']['placeholders']);
            break;
        case 'reanalizar':
            check('redirect de reanalisis', strpos($redirect, 'ec_reanalizado=1') !== false);
            $analisis_r = json_decode(file_get_contents($uploads . '/pdfs/muestra/analisis.json'), true);
            check('grupos hex detectados', array_column($analisis_r['grupos'], 'id') === ['0000FF', 'FF0000']);
            check('config preservada al reanalizar', $p->motor_para_tests()->leer_config('muestra') === $GLOBALS['test_config_previa']);
            $archivos_r = array_values(array_diff(scandir($uploads . '/pdfs/muestra'), ['.', '..']));
            sort($archivos_r);
            check('solo PDF, analisis y config', $archivos_r === ['analisis.json', 'config.json', 'muestra.pdf']);
            break;
        case 'mockups_guardar':
            // T008: guardado parcial del editor de mockups.
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            $cfg_g = $p->motor_para_tests()->leer_config('muestra');
            $previo = isset($GLOBALS['test_cfg_previo']) ? $GLOBALS['test_cfg_previo'] : [];
            check('mockup guardado con 2 capas validas', count((array)$cfg_g['mockups']) === 1 && count($cfg_g['mockups'][0]['capas']) === 2);
            check('filtros por capa persistidos', $cfg_g['mockups'][0]['capas'][0]['filtros'] === ['brillo' => 90]);
            check('omisible=true con mockups', $cfg_g['preview_omisible'] === true);
            check('activo intacto', $cfg_g['activo'] === $previo['activo']);
            check('productos intactos', $cfg_g['productos'] === $previo['productos']);
            check('campos intactos', $cfg_g['campos_ids'] === $previo['campos_ids']);
            check('mapeos intactos', $cfg_g['placeholders'] === $previo['placeholders']);
            break;
        case 'mockup_foto':
            // T007: la foto queda en pdfs/{nombre}/mockups/ con nombre saneado.
            check('redirect de subida', strpos($redirect, 'ec_mockup_subida=1') !== false);
            $dirF = $uploads . '/pdfs/muestra/mockups';
            check('carpeta mockups creada', is_dir($dirF));
            check('foto guardada con nombre saneado', is_file($dirF . '/fiesta.png'));
            check('foto valida PNG', substr((string)@file_get_contents($dirF . '/fiesta.png', false, null, 0, 8), 0, 4) === "\x89PNG");
            break;
        case 'mockup_foto_baja':
            // T007: borrado quirurgico dentro de mockups/, sin tocar vecinos.
            check('redirect de baja', strpos($redirect, 'ec_mockup_baja=1') !== false);
            check('foto eliminada', !is_file($uploads . '/pdfs/muestra/mockups/fiesta.png'));
            check('vecina intacta', is_file($uploads . '/pdfs/muestra/mockups/otra.png'));
            break;
        case 'sesion':
            // T003/T017: ciclo de vida completo del item.
            $s = isset($GLOBALS['test_sesion']) ? $GLOBALS['test_sesion'] : null;
            $err_s = isset($GLOBALS['test_sesion_error']) ? (string)$GLOBALS['test_sesion_error'] : '';
            if ($err_s !== '') {
                echo '  ERROR ' . $err_s . "\n";
            }
            check('ciclo sin error', $err_s === '' && is_array($s));
            check('pool numerado -1/-2', is_array($s) && preg_match('/-1\.png$/', (string)$s['f1']['file']) === 1 && preg_match('/-2\.png$/', (string)$s['f2']['file']) === 1);
            check('hash del llamador anotado', is_array($s) && $s['f1']['hash'] === sha1('Ana|neon-glow||300x200'));
            check('archivos fisicos en img/', is_array($s) && is_file($s['dir_item'] . '/img/' . basename($s['f1']['file'])) && is_file($s['dir_item'] . '/img/' . basename($s['f2']['file'])));
            check('webp congelado en el item', is_array($s) && is_file($s['dir_item'] . '/mockup-fiesta.webp'));
            check('promover renombra sin cambiar sid', is_array($s) && is_dir($s['dir_item']) && !is_dir($s['dir_draft']));
            check('manifest promovido con item_key nuevo', is_array($s) && is_array($s['man_item']) && $s['man_item']['item_key'] === 'abc123def456' && $s['man_item']['sid'] === $s['sid']);
            check('archivos[] = 2 filas con indice y file', is_array($s) && is_array($s['man_item']['archivos']) && count($s['man_item']['archivos']) === 2 && $s['man_item']['archivos'][0]['file'] === 'img/muestra-0000FF-1.png' && $s['man_item']['archivos'][0]['indice'] === 0);
            check('estado ok', is_array($s) && $s['estado'] === 'ok');
            check('staging consumido por la promocion', is_array($s) && !is_dir($s['staging']) && is_dir($s['entregable']));
            check('entregable promovido por rename', is_array($s) && is_dir($s['entregable']) && !is_dir($s['staging']) && is_file($s['entregable'] . '/mockup-fiesta.webp'));
            check('borrado quirurgico de otro item', is_array($s) && isset($s['dir_otro']) && !is_dir($s['dir_otro']));
            check('ttl elimino solo el draft vencido', is_array($s) && $s['ttl_eliminados'] === 1 && is_dir($s['dir_item']));
            break;
        case 'conciliacion':
            // 004/T024: el analisis sigue inmutable y un draft sin pool no habilita carrito.
            $c = isset($GLOBALS['test_conciliacion']) ? (array)$GLOBALS['test_conciliacion'] : [];
            check('analisis intacto tras guardar config', ($c['analisis_antes'] ?? '') === ($c['analisis_despues'] ?? ''));
            check('config editable conserva preview obligatoria', ($c['preview_omisible'] ?? true) === false && ($c['repetir'] ?? false) === true);
            check('draft sin pool no habilita carrito', ($c['carrito_ok'] ?? true) === false);
            check('no hay salida parcial', count((array)glob($uploads . '/tmp/muestras/muestra/*_procesado.pdf')) === 0);
            break;

        case 'admin':
            check('render sin fatal ni excepcion', $admin_error === '');
            check('aviso con la causa del motor', strpos($admin_html, 'motor:listar:') !== false);
            check('el selector de estilos sigue presente', strpos($admin_html, 'ec-select-estilo') !== false);
            // T025: la consola incluye la seccion de pedidos completados (render real).
            check('seccion 4. Pedidos completados', strpos($admin_html, '4. Pedidos completados') !== false
                && strpos($admin_html, 'personalizador_pdf_item_regenerar') !== false);
            // Spec 005 (T004): "Configuracion tienda" por asociacion (render real).
            check('tienda: bloque por producto asociado', strpos($admin_html, 'class="ec-tienda-producto" data-id="4242"') !== false
                && strpos($admin_html, 'class="ec-tienda-producto" data-id="4243"') !== false
                && strpos($admin_html, 'name="tienda_presente"') !== false);
            check('tienda: validez y mensaje precargados', strpos($admin_html, 'libelulas') !== false
                && strpos($admin_html, '&lt;b&gt;Sin stock&lt;/b&gt;') !== false);
            check('tienda: activo con hidden + checkbox', substr_count($admin_html, 'name="tienda[4242][activo]"') === 2
                && substr_count($admin_html, 'name="tienda[4242][validez]"') === 1);
            check('tienda: bloquear visible solo con validez', substr_count($admin_html, 'class="ec-tienda-bloquear"') === 2
                && substr_count($admin_html, 'class="ec-tienda-bloquear" hidden') === 1);
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
            foreach ($GLOBALS['test_borrado_testigos'] as $ruta => $contenido) {
                check('archivo ajeno intacto: ' . $ruta, @file_get_contents($uploads . '/' . $ruta) === $contenido);
            }
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
        case 'ficha':
            // T012: panel del comprador (oculto si el PDF no es ofrecible).
            $ficha = isset($GLOBALS['test_ficha']) ? $GLOBALS['test_ficha'] : null;
            $sc = isset($GLOBALS['test_ficha_shortcode']) ? $GLOBALS['test_ficha_shortcode'] : null;
            check('panel con pdf/campos/mapeos', is_array($ficha) && $ficha['pdf'] === 'muestra'
                && isset($ficha['campos'][1]) && isset($ficha['placeholders']['0000FF']));
            check('omisible por defecto false', is_array($ficha) && $ficha['preview_omisible'] === false);
            check('shortcode devuelve el mismo panel', is_array($sc) && $sc == $ficha);
            check('PDF inactivo/sin analisis se oculta', $GLOBALS['test_ficha_oculta'] === false);
            // T016: HTML real del panel (hook Woo y shortcode pintan esto).
            // T016: HTML real del panel (hook Woo y shortcode pintan esto).
            $html = isset($GLOBALS['test_ficha_html1']) ? (string)$GLOBALS['test_ficha_html1'] : '';
            check('HTML con data-pmu-panel + pdf', strpos($html, 'data-pmu-panel') !== false && strpos($html, 'data-pdf="muestra"') !== false);
            check('HTML una sola vez por request', ($GLOBALS['test_ficha_html2'] ?? 'x') === '');
            $pf = isset($GLOBALS['test_ficha_localizados']['personalizador-pdf-tienda#PMU_FICHA'])
                ? $GLOBALS['test_ficha_localizados']['personalizador-pdf-tienda#PMU_FICHA'] : null;
            check('PMU_FICHA con campos serializados', is_array($pf) && $pf['pdf'] === 'muestra'
                && isset($pf['campos'][0]['id']) && (int)$pf['campos'][0]['id'] === 1
                && !array_key_exists('etiquetas', $pf['campos'][0]));
            break;
        case 'vista_previa':
            // T013/T014: draft de sesion con valores duales saneados + datos de render.
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            $sid_v = is_array($json) ? (string)($json['data']['sid'] ?? '') : '';
            $item_v = is_array($json) ? (string)($json['data']['item_key'] ?? '') : '';
            check('sid devuelto', $sid_v !== '');
            check('item_key draft', strpos($item_v, 'draft-') === 0);
            $pdfD_v = is_array($json) ? (array)($json['data']['pdfs'][0] ?? []) : [];
            check('pdf con datos de render', ($pdfD_v['pdf'] ?? '') === 'muestra');
            $gid_v = null;
            foreach ((array)($pdfD_v['grupos'] ?? []) as $gv) {
                if (($gv['id'] ?? '') === '0000FF') { $gid_v = $gv; }
            }
            check('grupo con plantilla y preset', is_array($gid_v)
                && $gid_v['preset'] === 'neon-glow' && $gid_v['value'] === '[campo1]'
                && $gid_v['tipo'] === 'texto' && (int)$gid_v['w'] > 0 && (int)$gid_v['cont'] >= 1);
            check('fotos y mockups del PDF', isset($pdfD_v['fotos']) && isset($pdfD_v['mockups']) && $pdfD_v['preview_omisible'] === false);
            $rutaMan = glob($testBase . '/uploads/pmu/tmp/sesion-' . $sid_v . '/' . $item_v . '/manifest.json');
            $man_v = $rutaMan ? json_decode((string)@file_get_contents($rutaMan[0]), true) : null;
            $cid_v = isset($GLOBALS['test_previa_cid']) ? (int)$GLOBALS['test_previa_cid'] : 1;
            check('manifest con valor dual', is_array($man_v) && isset($man_v['valores'][$cid_v]) && $man_v['valores'][$cid_v]['cliente'] === 'Ana');
            check('valor crudo acotado (sin strip)', is_array($man_v) && $man_v['valores'][$cid_v]['valor'] === '<b>Ana</b>');
            check('campo desconocido descartado', is_array($man_v) && !isset($man_v['valores'][999]));
            // T016 (render parcial): hashes vigentes + URL del pool en la respuesta.
            check('archivos[] + pool_url normativos', is_array($json) && is_array($json['data']['archivos'] ?? null)
                && (bool)preg_match('#uploads/pmu/tmp/sesion-[a-z0-9_-]+/draft-[a-z0-9_-]+/$#', (string)($json['data']['pool_url'] ?? '')));
            break;
        case 'completados':
            // T025/T026: listado + PDF final + regeneracion idempotente.
            $comp = isset($GLOBALS['test_completados']) ? (array)$GLOBALS['test_completados'] : [];
            check('listado con 1 item completado', count($comp) === 1 && (int)$comp[0]['order_id'] === 4242 && $comp[0]['item_key'] === 'item-abc');
            check('estado + etiquetas cliente en el listado', ($comp[0]['estado'] ?? '') === 'ok' && ($comp[0]['valores'][0]['titulo'] ?? '') === 'Nombre' && ($comp[0]['valores'][0]['cliente'] ?? '') === 'Ana');
            check('PDF final con firma %PDF', ($GLOBALS['test_completados_pdf'] ?? '') === '%PDF');
            check('generacion idempotente', ($GLOBALS['test_completados_idem'] ?? false) === true);
            check('redirect de regeneracion', strpos($redirect, 'ec_regenerado=1') !== false);
            $rutasK = (array)($GLOBALS['test_completados_rutas'] ?? []);
            check('dos PDFs aceptados regenerados', count($rutasK) === 2
                && isset($rutasK['muestra'], $rutasK['otro'])
                && is_file($rutasK['muestra']) && is_file($rutasK['otro']));
            $descargasK = (array)($GLOBALS['test_descargas'] ?? []);
            check('descargas: una fila por PDF aceptado', count($descargasK) === 3
                && strpos((string)($descargasK[1]['download_url'] ?? ''), 'pdf=muestra') !== false
                && strpos((string)($descargasK[2]['download_url'] ?? ''), 'pdf=otro') !== false);
            $salidaK = (array)glob(($GLOBALS['test_completados_dir'] ?? '') . DIRECTORY_SEPARATOR . '*_procesado.pdf');
            check('salida rearmada solo para aceptados', count($salidaK) === 2
                && is_file(($GLOBALS['test_completados_dir'] ?? '') . DIRECTORY_SEPARATOR . 'muestra_procesado.pdf')
                && is_file(($GLOBALS['test_completados_dir'] ?? '') . DIRECTORY_SEPARATOR . 'otro_procesado.pdf')
                && !is_file(($GLOBALS['test_completados_dir'] ?? '') . DIRECTORY_SEPARATOR . 'x_procesado.pdf'));
            break;
        case 'ficha_edicion':
            // T016: re-edicion: HTML con leyenda de edicion + PMU_FICHA precargada;
            // la re-vista previa REUSA el item (sin duplicados) y refresca valores.
            $html_e = isset($GLOBALS['test_edicion_html']) ? (string)$GLOBALS['test_edicion_html'] : '';
            check('HTML anuncia edicion guardada', strpos($html_e, 'pmu-panel-edicion') !== false);
            $pf_e = isset($GLOBALS['test_localizados']['personalizador-pdf-tienda#PMU_FICHA'])
                ? $GLOBALS['test_localizados']['personalizador-pdf-tienda#PMU_FICHA'] : null;
            check('PMU_FICHA precarga valores + sesion', is_array($pf_e) && ($pf_e['valores'][1]['cliente'] ?? '') === 'Ana'
                && is_array($pf_e['sesion'] ?? null) && strpos((string)($pf_e['sesion']['item_key'] ?? ''), 'draft-') === 0);
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            check('item_key REUSADO (sin draft nuevo)', is_array($json) && ($json['data']['item_key'] ?? '') === ($GLOBALS['test_edicion_draft'] ?? ''));
            check('flag edicion=true', is_array($json) && ($json['data']['edicion'] ?? false) === true);
            break;
        case 'ficha_omisible':
            // T018/T019: omisible = panel activo, flag true, item creado con
            // estado omisible + valores duales, sin bloquear la venta.
            check('panel omisible vigente', is_array($GLOBALS['test_omisible_panel'] ?? null) && $GLOBALS['test_omisible_panel']['preview_omisible'] === true);
            check('validacion acepta sin draft previo', ($GLOBALS['test_omisible_valido'] ?? false) === true);
            $meta_o = is_array($GLOBALS['test_omisible_meta'] ?? null) ? $GLOBALS['test_omisible_meta'] : [];
            check('meta con sid/item/unique_key', !empty($meta_o['pmu_sid']) && strpos((string)($meta_o['pmu_item_key'] ?? ''), 'draft-') === 0 && !empty($meta_o['unique_key']));
            $man_o = isset($meta_o['pmu_item_key'], $meta_o['pmu_sid']) ? json_decode((string)@file_get_contents($testBase . '/uploads/pmu/tmp/sesion-' . $meta_o['pmu_sid'] . '/' . $meta_o['pmu_item_key'] . '/manifest.json'), true) : null;
            $cid_o = (int)($GLOBALS['test_omisible_cid'] ?? 1);
            check('item omisible con valores duales', is_array($man_o) && ($man_o['preview_estado'] ?? '') === 'omisible' && ($man_o['valores'][$cid_o]['cliente'] ?? '') === 'Luz');
            break;
        case 'vista_previa_mal':
            check('respuesta JSON error (seguridad)', is_array($json) && $json['success'] === false);
            check('causa motor:nonce:invalido', is_array($json) && $json['data'] === 'motor:nonce:invalido');
            check('sin drafts creados', (function () use ($testBase) {
                foreach ((array)glob($testBase . '/uploads/pmu/tmp/sesion-*/draft-*', GLOB_ONLYDIR) as $d) {
                    return false;
                }
                return true;
            })());
            break;
        case 'carrito':
            // T015: meta canonica + promocion + etiquetas + borrado quirurgico.
            $c = isset($GLOBALS['test_carrito']) ? $GLOBALS['test_carrito'] : [];
            $meta = isset($c['meta']) && is_array($c['meta']) ? $c['meta'] : [];
            check('meta pmu_sid/pmu_item_key', isset($meta['pmu_sid']) && $meta['pmu_sid'] === 'test-8f2a' && preg_match('/^draft-/', (string)($meta['pmu_item_key'] ?? '')) === 1);
            check('unique_key UUID v4', preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', (string)($meta['unique_key'] ?? '')) === 1);
            check('promover renombra a item_key real', ($c['dir_draft'] ?? '') !== '' && ($c['dir_item'] ?? '') !== '' && $c['dir_item'] !== $c['dir_draft'] && !is_dir($c['dir_draft']));
            check('manifest promovido', is_array($c['man_item'] ?? null) && $c['man_item']['item_key'] === 'abc123def456');
            check('webp aprobado congelado al agregar', !empty($c['webp_ok']));
            check('estado ok tras congelar', ($c['estado'] ?? '') === 'ok');
            $etiquetas = is_array($c['etiquetas'] ?? null) ? $c['etiquetas'] : [];
            check('etiqueta cliente con titulo del campo', count($etiquetas) === 1 && $etiquetas[0]['name'] === 'Nombre' && $etiquetas[0]['value'] === 'Ana');
            check('borrado quirurgico al quitar', isset($c['dir_item']) && !is_dir($c['dir_item']));
            break;
        case 'pool':
        case 'pool_reem':
            // T014: pool del comprador con fila de indice y hash de regeneracion.
            check('respuesta JSON success', is_array($json) && $json['success'] === true);
            $fila_p = is_array($json) ? (array)$json['data'] : [];
            if ($fase === 'pool') {
                check('fila del pool con n=1', ($fila_p['file'] ?? '') === 'img/muestra-0000FF-1.png' && (int)($fila_p['indice'] ?? -1) === 0);
            } else {
                // Reemplazo: los 2 PNG viejos desaparecen y la numeracion reinicia.
                check('reemplazo reinicia numeracion', ($fila_p['file'] ?? '') === 'img/muestra-0000FF-1.png' && (int)($fila_p['indice'] ?? -1) === 0);
            }
            check('hash de regeneracion anotado', ($fila_p['hash'] ?? '') === sha1('Ana|neon-glow||300x200'));
            $dirSes_p = $testBase . '/uploads/pmu/tmp/sesion-test-8f2a/' . $GLOBALS['test_pool_item'];
            $man_p = isset($GLOBALS['test_pool_item']) ? json_decode((string)@file_get_contents($dirSes_p . '/manifest.json'), true) : null;
            $filas_p = is_array($man_p) ? (array)($man_p['archivos'] ?? []) : [];
            $delGrupo_p = 0;
            foreach ($filas_p as $fp) {
                if (($fp['grupo_id'] ?? '') === '0000FF') { $delGrupo_p++; }
            }
            if ($fase === 'pool') {
                check('archivos[] con 1 fila del grupo', $delGrupo_p === 1);
            } else {
                check('reemplazo deja solo 1 fila del grupo', $delGrupo_p === 1);
                $imgDir_p = $dirSes_p . '/img';
                check('PNG viejos eliminados del pool', (array)glob($imgDir_p . '/muestra-0000FF-*.png') !== [] && count(glob($imgDir_p . '/muestra-0000FF-*.png')) === 1);
            }
            check('PNG fisico con firma valida', isset($GLOBALS['test_pool_item']) && substr((string)@file_get_contents($dirSes_p . '/img/' . basename((string)($fila_p['file'] ?? 'x'))), 0, 8) === "\x89PNG\r\n\x1a\n");
            break;
        case 'validez':
            // Spec 005 (T001-T003/T005): multivinculo + tienda{} + saneado.
            $val = isset($GLOBALS['test_validez']) ? $GLOBALS['test_validez'] : null;
            $err_v = isset($GLOBALS['test_validez_error']) ? (string)$GLOBALS['test_validez_error'] : '';
            if ($err_v !== '') {
                echo '  ERROR ' . $err_v . "\n";
            }
            check('ciclo sin error', $err_v === '' && is_array($val));
            check('lista canonica con 1 slug', is_array($val) && $val['lista'] === ['muestra']);
            check('compat singular = primero', is_array($val) && $val['primero'] === 'muestra');
            check('re-vincular no duplica', is_array($val) && $val['lista2'] === ['muestra']);
            check('lista multiple: dedupe + compat', is_array($val)
                && $val['dedupe'] === ['muestra', 'otro'] && $val['compat2'] === 'muestra');
            check('baja parcial conserva el otro', is_array($val) && $val['baja_parcial'] === ['otro']);
            check('elemento invalido se descarta solo', is_array($val) && $val['tolerante'] === ['muestra', 'otro']);
            check('respaldo singular sin lista', is_array($val) && $val['respaldo'] === ['muestra']);
            check('desvincular vacia la lista', is_array($val) && $val['tras_baja'] === []);
            check('tienda guarda ok', is_array($val) && !empty($val['ok_tienda']));
            $tie_v = is_array($val) && is_array($val['tienda']) ? $val['tienda'] : [];
            check('tienda normalizada (bool+pid)', isset($tie_v['4242'])
                && $tie_v['4242']['activo'] === true && $tie_v['4242']['bloquear'] === false
                && $tie_v['4242']['validez'] === "campo1 === 'libelulas' && campo2 === 'a4'"
                && !isset($tie_v['no-numerico']));
            check('mensaje saneado sin script', isset($tie_v['4242'])
                && strpos($tie_v['4242']['mensaje_html'], '<script') === false
                && strpos($tie_v['4242']['mensaje_html'], '<b>') !== false);
            check('activo false persiste', isset($tie_v['4243']) && $tie_v['4243']['activo'] === false);
            check('bloquear sin validez se ignora', isset($tie_v['4243']) && $tie_v['4243']['bloquear'] === false);
            check('bloquear con validez persiste', isset($tie_v['4244']) && $tie_v['4244']['bloquear'] === true);
            check('recorte a 2000 (validez+mensaje)', isset($tie_v['4244'])
                && strlen((string)$tie_v['4244']['validez']) === 2000
                && strlen((string)$tie_v['4244']['mensaje_html']) === 2000);
            check('validez prohibida rechazada', is_array($val) && $val['err_mala'] === 'motor:campos:script:invalido');
            check('rechazo deja el config intacto', is_array($val) && !empty($val['tienda_intacta']));
            check('guardar tienda no pisa el resto', is_array($val) && !empty($val['resto_intacto']));
            check('validez vieja: lectura tolerante', is_array($val) && !empty($val['legacy_leida']));
            check('validez vieja: re-guardable sin cambios', is_array($val) && !empty($val['legacy_guardable']));
            $fx_v = is_array($val) && isset($val['fixture']) ? (array)$val['fixture'] : [];
            $fx_acepta = count($fx_v) > 0;
            $fx_recorta = count($fx_v) > 0;
            foreach ($fx_v as $fila_fx) {
                if ($fila_fx['aceptado'] !== $fila_fx['esperado']) { $fx_acepta = false; }
                if (empty($fila_fx['coincide'])) { $fx_recorta = false; }
            }
            check('fixture compartida: saneo PHP coincide', $fx_acepta);
            check('fixture compartida: recorte exacto', $fx_recorta);
            check('sanea activo: aceptado sin duplicar', is_array($val)
                && $val['sanea_ok'] === ['pdfs' => ['muestra'], 'descartados' => ['otro']]);
            check('sanea inactivo: cae a descartados', is_array($val)
                && $val['sanea_inactivo'] === ['pdfs' => [], 'descartados' => ['muestra', 'otro']]);
            check('declarado no saneable: auditado crudo', is_array($val)
                && $val['sanea_invalido'] === ['pdfs' => [], 'descartados' => ['///']]);
            check('sanea vacio: nada de nada', is_array($val)
                && $val['sanea_vacio'] === ['pdfs' => [], 'descartados' => []]);
            break;
        case 'validez_admin':
        case 'validez_admin_mal':
            // Spec 005 (T004/T005): handler de config con "Configuracion tienda".
            $json_va = isset($GLOBALS['test_json']) ? $GLOBALS['test_json'] : null;
            $cfg_va = null;
            $tie_va = [];
            try {
                $cfg_va = (new \PMU_Uploads())->leer_config('muestra');
                $tie_va = is_array($cfg_va) && isset($cfg_va['tienda']) && is_array($cfg_va['tienda']) ? $cfg_va['tienda'] : [];
            } catch (\Throwable $e_va) {
                $cfg_va = null;
            }
            if ($fase === 'validez_admin_mal') {
                check('validez invalida: JSON con causa', is_array($json_va) && empty($json_va['success'])
                    && strpos((string)$json_va['data'], 'Validez invalida') !== false);
                check('validez invalida: tienda sin escribir', is_array($cfg_va) && $tie_va === []);
            } else {
                check('guardado JSON ok', is_array($json_va) && !empty($json_va['success']));
                check('tienda del form (hidden+checkbox)', isset($tie_va['4242'])
                    && $tie_va['4242']['activo'] === true && $tie_va['4242']['bloquear'] === true
                    && $tie_va['4242']['validez'] === "campo1 === 'libelulas' && campo2 === 'a4'"
                    && strpos($tie_va['4242']['mensaje_html'], '<script') === false);
                check('activo desmarcado + bloquear sin validez', isset($tie_va['4243'])
                    && $tie_va['4243']['activo'] === false && $tie_va['4243']['bloquear'] === false);
                check('huerfano podado', !isset($tie_va['9999']));
                check('productos espejo del POST', is_array($cfg_va) && $cfg_va['productos'] === [4242, 4243]);
            }
            break;
        case 'ficha_pdfs':
            // Spec 005 (US2): panel del producto con N PDFs + tienda{}.
            $fp = isset($GLOBALS['test_fp']) ? $GLOBALS['test_fp'] : [];
            $pn = isset($fp['panel']) ? $fp['panel'] : null;
            check('panel_producto con 2 PDFs (alfabetico)', is_array($pn) && count($pn['pdfs']) === 2
                && $pn['pdfs'][0]['pdf'] === 'muestra' && $pn['pdfs'][1]['pdf'] === 'otro');
            check('validez/mensaje/bloquear por asociacion', is_array($pn)
                && $pn['pdfs'][0]['validez'] === "campo1 === 'libelulas'"
                && $pn['pdfs'][0]['bloquear'] === true
                && strpos((string)$pn['pdfs'][0]['mensaje_html'], '<b>') !== false);
            check('bloquear sin validez se ignora (ficha)', is_array($pn) && $pn['pdfs'][1]['bloquear'] === false);
            check('union de campos (D4)', is_array($pn) && array_keys($pn['campos']) === (array)$fp['campos']);
            check('omisible solo si TODOS lo son', is_array($pn) && $pn['preview_omisible'] === false);
            $fic = isset($fp['ficha']) ? $fp['ficha'] : null;
            check('PMU_FICHA con pdfs/producto/admin', is_array($fic) && count((array)$fic['pdfs']) === 2
                && $fic['producto'] === 4242 && $fic['admin'] === true && $fic['pdf'] === 'muestra');
            check('inactivo fuera de la ficha', isset($fp['panel_uno']) && is_array($fp['panel_uno'])
                && count($fp['panel_uno']['pdfs']) === 1 && $fp['panel_uno']['pdfs'][0]['pdf'] === 'muestra');
            break;
        case 'ficha_pdfs_previa':
            // Spec 005 (T009): snapshot saneado del draft declarado por la ficha.
            $json_fp = isset($GLOBALS['test_json']) ? $GLOBALS['test_json'] : null;
            check('previa JSON ok', is_array($json_fp) && !empty($json_fp['success']));
            $pdfs_fp = is_array($json_fp) ? (array)($json_fp['data']['pdfs'] ?? []) : [];
            check('render de los 2 elegibles', count($pdfs_fp) === 2
                && $pdfs_fp[0]['pdf'] === 'muestra' && $pdfs_fp[1]['pdf'] === 'otro');
            check('elegibles declarados saneados', is_array($json_fp)
                && $json_fp['data']['elegibles'] === ['muestra', 'otro']);
            $man_fp = null;
            foreach ((array)glob($uploads . '/tmp/sesion-*/*/manifest.json') as $m_fp) {
                $man_fp = json_decode((string)@file_get_contents($m_fp), true);
            }
            check('draft con snapshot congelado', is_array($man_fp) && $man_fp['pdfs'] === ['muestra', 'otro']);
            check('previa audita descartados', is_array($json_fp)
                && $json_fp['data']['descartados'] === ['x']
                && is_array($man_fp) && $man_fp['pdfs_descartados'] === ['x']);
            break;
        case 'ficha_pdfs_vacio':
            // T009: una declaración explícitamente vacía no vuelve al modo 004.
            check('previa vacía rechazada', is_array($json) && empty($json['success'])
                && ($json['data'] ?? '') === 'motor:sesion:snapshot:vacio');
            check('previa vacía no crea draft', (function () use ($testBase) {
                foreach ((array)glob($testBase . '/uploads/pmu/tmp/sesion-*/*/manifest.json') as $manifest) {
                    if (is_file($manifest)) {
                        return false;
                    }
                }
                return true;
            })());
            break;
        case 'ficha_pdfs_carrito':
            // Spec 005 (US4/T009): la rama omisible crea el item con snapshot.
            $fp = isset($GLOBALS['test_fp']) ? $GLOBALS['test_fp'] : [];
            check('carrito_validar omisible ok', !empty($fp['carrito_ok']));
            $man_c = isset($fp['manifiesto']) ? $fp['manifiesto'] : null;
            check('snapshot saneado del declarado', is_array($man_c) && $man_c['pdfs'] === ['muestra', 'otro']);
            check('descartados auditados', is_array($man_c) && $man_c['pdfs_descartados'] === ['x']);
            check('estado omisible', is_array($man_c) && $man_c['preview_estado'] === 'omisible');
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
            // 004/Fase A: CRUD del catalogo global con el motor (alta/edicion/baja)
            // + sandbox del script + flag array (tupla de 10 slots).
            $ver = isset($GLOBALS['test_campos']) ? $GLOBALS['test_campos'] : null;
            $err_c = isset($GLOBALS['test_campos_error']) ? (string)$GLOBALS['test_campos_error'] : '';
            check('alta/edicion/baja sin error', $err_c === '' && is_array($ver));
            check('ids 1 y 2 asignados', is_array($ver) && $ver['id1'] === 1 && $ver['id2'] === 2);
            check('titulo editado persiste', is_array($ver) && $ver['tit1'] === 'Nombre editado');
            check('id 1 activo en catalogo', is_array($ver) && in_array(1, $ver['ids'], true));
            check('id 2 dado de baja (tombstone)', is_array($ver) && !in_array(2, $ver['ids'], true));
            check('sin aviso de catalogo', is_array($ver) && $ver['aviso'] === null);
            check('tupla de 10 slots con array', is_array($ver) && $ver['t1'] !== null && count($ver['t1']) === 10 && $ver['t1'][9] === true);
            check('alta con script prohibido rechazada', (string)($ver['err_nueva'] ?? '') === '');
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
            // T016: el arnes trae stub de wc_get_product, asi que el filtro de
            // productos Woo ya filtra de verdad (antes los descartaba sin Woo).
            check('productos validados por Woo (stub)', $cfg_t['productos'] === [123, 456]);
            check('campos 2,1 (999 descartado)', $cfg_t['campos_ids'] === [2, 1]);
            check('mapeo 0000FF persiste', isset($cfg_t['placeholders']['0000FF']) && $cfg_t['placeholders']['0000FF']['value'] === '[campo2]' && $cfg_t['placeholders']['0000FF']['settings'] === '[campo1]');
            check('FFFFFF ausente del dataset', !isset($cfg_t['placeholders']['FFFFFF']));
            check('tipo foto descartado', !isset($cfg_t['placeholders']['FF0000']));
            break;
        case 'mockups':
            // T011: mockups + mapeo con repetir + omisible con regla de mockups.
            $mm = isset($GLOBALS['test_mockups']) ? $GLOBALS['test_mockups'] : null;
            $err_m = isset($GLOBALS['test_mockups_error']) ? (string)$GLOBALS['test_mockups_error'] : '';
            check('sin error', $err_m === '' && is_array($mm) && $mm['ok'] === true);
            check('analisis intacto', ($GLOBALS['test_analisis_antes'] ?? null) === ($GLOBALS['test_analisis_despues'] ?? ''));
            check('1 mockup valido', is_array($mm) && count($mm['cfg']['mockups']) === 1 && $mm['cfg']['mockups'][0]['id'] === 'fiesta');
            check('capas 1,2,5 (limpieza)', is_array($mm) && count($mm['cfg']['mockups'][0]['capas']) === 3);
            check('clamp de filtros/rot/sesgo', is_array($mm) && $mm['cfg']['mockups'][0]['capas'][2] === ['tipo' => 'img', 'ref' => 'marco', 'x' => 90, 'y' => 54, 'w' => 122, 'h' => 192, 'rot' => 360.0, 'sesgo' => 1.0, 'filtros' => ['brillo' => 200]]);
            check('omisible persiste con mockups', is_array($mm) && $mm['cfg']['preview_omisible'] === true);
            check('repetir=true en mapeo', is_array($mm) && $mm['cfg']['placeholders']['0000FF']['repetir'] === true);
            check('omisible sin mockups queda false', isset($GLOBALS['test_mockups_sin']) && $GLOBALS['test_mockups_sin']['preview_omisible'] === false && $GLOBALS['test_mockups_sin']['mockups'] === []);
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
putenv('PD_PUENTE_SIN_NONCE');
putenv('PD_PUENTE_SIN_CAP');
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
    case 'ficha':
        // T012: panel del comprador (oculto si el PDF no es ofrecible).
        // El entorno del arnes necesita config activa + campo catalogado.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_f = new PMU_Uploads();
        $cid_f = $motor_f->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_f->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [$cid_f],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => false]],
        ]);
        $GLOBALS['test_ficha'] = $p->panel_ficha('muestra');
        $GLOBALS['test_ficha_shortcode'] = $p->shortcode_panel(['pdf' => 'muestra']);
        $GLOBALS['test_ficha_oculta'] = $p->panel_ficha('inexistente');
        // T016: HTML del panel (shortcode render): una sola vez, con PMU_FICHA.
        $GLOBALS['test_ficha_html1'] = $p->shortcode_panel_render(['pdf' => 'muestra']);
        $GLOBALS['test_ficha_html2'] = $p->shortcode_panel_render(['pdf' => 'muestra']);
        $GLOBALS['test_ficha_localizados'] = isset($GLOBALS['test_localizados']) ? $GLOBALS['test_localizados'] : [];
        break;

    case 'vista_previa':
    case 'vista_previa_mal':
        // T013: draft de sesion desde el panel (camino feliz + nonce invalido).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_f = new PMU_Uploads();
        $cid_f = $motor_f->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_f->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [$cid_f],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => false]],
        ]);
        $GLOBALS['test_previa_cid'] = $cid_f;
        if ($fase === 'vista_previa_mal') {
            putenv('PD_PUENTE_SIN_NONCE=1');
        }
        $_POST = [
            'action' => 'personalizador_pdf_vista_previa',
            'pdf' => 'muestra.pdf',
            'valores' => json_encode([$cid_f => ['valor' => '<b>Ana</b>', 'cliente' => 'Ana'], 999 => ['valor' => 'intruso', 'cliente' => 'intruso']]),
            'ajax' => '1',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_vista_previa(); // exit en wp_send_json_*
        break;

    case 'completados':
        // T025/T026: entregable en orders/ + listado + regeneracion idempotente.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $motor_k = $p->motor_para_tests();
        $cid_k = $motor_k->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_k->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [$cid_k],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => false]],
        ]);
        $dirK = $motor_k->dir_ambito('orders', true) . DIRECTORY_SEPARATOR . '4242' . DIRECTORY_SEPARATOR . 'item-abc';
        wp_mkdir_p($dirK . DIRECTORY_SEPARATOR . 'img');
        $dirOtroK = $motor_k->dir_ambito('pdfs', true) . DIRECTORY_SEPARATOR . 'otro';
        wp_mkdir_p($dirOtroK);
        copy($testBase . '/uploads/pmu/pdfs/muestra/muestra.pdf', $dirOtroK . DIRECTORY_SEPARATOR . 'otro.pdf');
        $pngK = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '_c.png';
        \ExtractCorel\Engine\PngWriter::write($pngK, 300, 200);
        copy($pngK, $dirK . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'muestra-0000FF-1.png');
        copy($pngK, $dirK . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'otro-0000FF-1.png');
        file_put_contents($dirK . DIRECTORY_SEPARATOR . 'manifest.json', json_encode([
            'item_key' => 'item-abc',
            'sid' => 'test-8f2a',
            'pdfs' => ['muestra', 'otro'],
            'pdfs_descartados' => ['x'],
            'valores' => [$cid_k => ['valor' => 'Ana', 'cliente' => 'Ana']],
            'archivos' => [
                ['pdf' => 'muestra', 'grupo_id' => '0000FF', 'indice' => 0, 'file' => 'img/muestra-0000FF-1.png', 'hash' => 'h1'],
                ['pdf' => 'otro', 'grupo_id' => '0000FF', 'indice' => 0, 'file' => 'img/otro-0000FF-1.png', 'hash' => 'h2'],
            ],
            'preview_estado' => 'ok',
        ]));
        $GLOBALS['test_completados'] = $p->pedidos_completados();
        $GLOBALS['test_completados_rutas'] = $p->item_generar_pdfs(4242, 'item-abc');
        $rutaK = $p->item_generar_pdf(4242, 'item-abc');
        $GLOBALS['test_completados_pdf'] = is_file($rutaK) ? (string)file_get_contents($rutaK, false, null, 0, 4) : '';
        $GLOBALS['test_order'] = new TestPMUOrder(4242, ['_pmu_items' => ['item-abc' => 'entregado']]);
        $GLOBALS['test_descargas'] = $p->descargas_cliente([
            ['order_id' => 4242, 'product_id' => 123, 'product_name' => 'Producto', 'order_key' => 'test-order-key'],
        ]);
        $GLOBALS['test_completados_pdf'] = is_file($rutaK) ? (string)file_get_contents($rutaK, false, null, 0, 4) : '';
        clearstatcache();
        $mK = filemtime($rutaK);
        $rutaK2 = $p->item_generar_pdf(4242, 'item-abc');
        $GLOBALS['test_completados_idem'] = ($rutaK2 === $rutaK && filemtime($rutaK2) === $mK);
        $_POST = [
            'action' => 'personalizador_pdf_item_regenerar',
            'order_id' => '4242',
            'item_key' => 'item-abc',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $GLOBALS['test_completados_dir'] = $dirK;
        $p->handle_item_regenerar(); // exit en redirigir(ec_regenerado)
        break;

    case 'ficha_edicion':
        // T016: re-edicion (item_key vigente): se REUSA el item, no se duplica.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $motor_e = new PMU_Uploads();
        $cid_e = $motor_e->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_e->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [$cid_e],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => false]],
        ]);
        $sesion_e = new PMU_Sesion($motor_e);
        $sid_e = 'test-edit-1';
        $draft_e = $sesion_e->crear_draft($sid_e, ['muestra']);
        $man_e = $sesion_e->leer_manifest($sid_e, $draft_e);
        $man_e['valores'] = [$cid_e => ['valor' => 'Ana', 'cliente' => 'Ana']];
        $man_e['preview_estado'] = 'ok';
        $man_e['archivos'] = [['pdf' => 'muestra', 'grupo_id' => '0000FF', 'indice' => 0, 'file' => 'img/muestra-0000FF-1.png', 'hash' => sha1('Ana|neon-glow||1532x1145')]];
        $sesion_e->guardar_manifest($sid_e, $draft_e, $man_e);
        // Editar con ?pmu_item_key= en el panel + re-vista previa sobre el item.
        $_GET = ['pmu_item_key' => $draft_e];
        $_COOKIE[PMU_Sesion::COOKIE] = $sid_e;
        $GLOBALS['test_edicion_html'] = $p->panel_ficha_html('muestra');
        $_GET = [];
        $_POST = [
            'action' => 'personalizador_pdf_vista_previa',
            'pdf' => 'muestra.pdf',
            'item_key' => $draft_e,
            'valores' => json_encode([$cid_e => ['valor' => 'Beto', 'cliente' => 'Beto']]),
            'ajax' => '1',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $GLOBALS['test_edicion_draft'] = $draft_e;
        $p->handle_vista_previa(); // exit en wp_send_json_*
        break;

    case 'ficha_omisible':
        // T018/T019: compra omisible sin vistas: panel omisible + HTML sin boton
        // (el JS no monta vistas); el carrito crea el item con estado omisible.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $motor_o = new PMU_Uploads();
        $cid_o = $motor_o->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_o->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [$cid_o],
            'preview_omisible' => true,
            'mockups' => [['id' => 'm1', 'titulo' => 'Vista', 'capas' => [['tipo' => 'placeholder', 'ref' => '0000FF', 'x' => 0, 'y' => 0, 'w' => 300, 'h' => 300, 'rot' => 0, 'sesgo' => 0, 'filtros' => []]]]],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => false]],
        ]);
        $panel_o = $p->panel_ficha('muestra');
        $GLOBALS['test_omisible_html'] = $p->panel_ficha_html('muestra');
        $GLOBALS['test_omisible_ficha'] = isset($GLOBALS['test_localizados']['personalizador-pdf-tienda#PMU_FICHA'])
            ? $GLOBALS['test_localizados']['personalizador-pdf-tienda#PMU_FICHA'] : null;
        // Add-to-cart SIN draft previo: valores via POST, sin sid/item_key.
        $_POST = [
            'pmu_valores' => json_encode([$cid_o => ['valor' => 'Luz', 'cliente' => 'Luz']]),
        ];
        $_REQUEST = $_POST;
        $GLOBALS['test_omisible_valido'] = $p->carrito_validar(true, 4242, 1, 0);
        $GLOBALS['test_omisible_panel'] = $panel_o;
        $GLOBALS['test_omisible_cid'] = $cid_o;
        $GLOBALS['test_omisible_meta'] = $p->carrito_agregar([], 4242, 0, 1);
        break;

    case 'carrito':
        // T015: ciclo carrito (meta canonica, promover, etiquetas, borrado).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $motor_c = $p->motor_para_tests();
        $cid_c = $motor_c->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_c->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [$cid_c],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => false]],
        ]);
        $sesion_c = new PMU_Sesion($motor_c);
        $sid_c = 'test-8f2a';
        $draft_c = $sesion_c->crear_draft($sid_c, ['muestra']);
        $man_c = $sesion_c->leer_manifest($sid_c, $draft_c);
        $man_c['valores'] = [$cid_c => ['valor' => 'Ana', 'cliente' => 'Ana']];
        $sesion_c->guardar_manifest($sid_c, $draft_c, $man_c);
        $_POST = [
            'pmu_sid' => $sid_c,
            'pmu_item_key' => $draft_c,
            // T015: vistas aprobadas (webp 300x300 que el cliente congela al agregar).
            'pmu_mockups' => json_encode(['m1' => 'data:image/webp;base64,' . base64_encode('RIFF0000WEBPVP8 ' . str_repeat('x', 24))]),
        ];
        $GLOBALS['test_carrito'] = [
            'dir_draft' => $sesion_c->dir_item($sid_c, $draft_c),
        ];
        $GLOBALS['test_carrito']['meta'] = $p->carrito_agregar([], 42, 0, 1);
        $p->carrito_promover('abc123def456', 42, 1, 0, null);
        $GLOBALS['test_carrito']['dir_item'] = $motor_c->dir_sesion_item($sid_c, 'abc123def456');
        $GLOBALS['test_carrito']['man_item'] = $sesion_c->leer_manifest($sid_c, 'abc123def456');
        $GLOBALS['test_carrito']['estado'] = $sesion_c->estado_preview($sid_c, 'abc123def456');
        // Evidencia del congelado ANTES de borrar el item (el check corre en shutdown).
        $rutaWebp = $GLOBALS['test_carrito']['dir_item'] . '/mockup-m1.webp';
        $GLOBALS['test_carrito']['webp_ok'] = is_file($rutaWebp)
            && strpos((string)@file_get_contents($rutaWebp, false, null, 0, 12), 'WEBP') !== false;
        $GLOBALS['test_carrito']['etiquetas'] = $p->carrito_mostrar([], ['pmu_sid' => $sid_c, 'pmu_item_key' => 'abc123def456']);
        $GLOBALS['test_wc'] = new TestWC();
        $GLOBALS['test_wc']->cart->cart_contents['abc123def456'] = ['pmu_sid' => $sid_c, 'pmu_item_key' => 'abc123def456'];
        $p->carrito_quitar('abc123def456');
        break;

    case 'pool':
    case 'pool_reem':
        // T014: pool del comprador (alta; en pool_reem, reemplazo idempotente).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $sesion_p = new PMU_Sesion($p->motor_para_tests());
        $sid_p = 'test-8f2a';
        $draft_p = $sesion_p->crear_draft($sid_p, ['muestra']);
        if ($fase === 'pool_reem') {
            // Estado previo: 2 PNG del grupo (regeneracion debe reemplazar, no acumular).
            $pngP = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '_a.png';
            \ExtractCorel\Engine\PngWriter::write($pngP, 300, 200);
            $bytesP = (string)file_get_contents($pngP);
            $sesion_p->guardar_png($sid_p, $draft_p, 'muestra', '0000FF', $bytesP, 'viejo1');
            $sesion_p->guardar_png($sid_p, $draft_p, 'muestra', '0000FF', $bytesP, 'viejo2');
        }
        $pngQ = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '_b.png';
        \ExtractCorel\Engine\PngWriter::write($pngQ, 300, 200);
        $_POST = [
            'action' => 'personalizador_pdf_pool',
            'sid' => $sid_p,
            'item_key' => $draft_p,
            'pdf' => 'muestra',
            'grupo' => '0000FF',
            'valor' => 'Ana',
            'preset' => 'neon-glow',
            'settings' => '',
            'w' => '300',
            'h' => '200',
            'limpiar' => $fase === 'pool_reem' ? '1' : '',
            'png_data' => 'data:image/png;base64,' . base64_encode((string)file_get_contents($pngQ)),
            'ajax' => '1',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $GLOBALS['test_pool_item'] = $draft_p;
        $p->handle_pool_png(); // exit en wp_send_json_*
        break;

    case 'validez':
        // Spec 005 (T001-T003/T005): multivinculo + tienda{} + saneado del snapshot.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        try {
            $motor_v = new PMU_Uploads();
            // T001: lista canonica + respaldo singular + sin duplicados.
            $p->producto_pdf_vincular(4242, 'muestra.pdf');
            $lista_v = $p->producto_pdf_slugs(4242);
            $primero_v = $p->producto_pdf_slug(4242);
            $p->producto_pdf_vincular(4242, 'muestra.pdf'); // re-vincular: no duplica
            $lista2_v = $p->producto_pdf_slugs(4242);
            // Lista multiple (multi-PDF): duplicado dentro de la lista + baja parcial.
            $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra', 'otro', 'muestra'];
            $dedupe_v = $p->producto_pdf_slugs(4242);
            $compat2_v = $p->producto_pdf_slug(4242);
            $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra', 'otro'];
            $p->producto_pdf_desvincular(4242, 'muestra.pdf');
            $baja_parcial_v = $p->producto_pdf_slugs(4242);
            // Elemento invalido entre validos: se descarta solo el invalido.
            $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra', '///', 'otro'];
            $tolerante_v = $p->producto_pdf_slugs(4242);
            unset($GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs']);
            $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slug'] = 'muestra';
            $respaldo_v = $p->producto_pdf_slugs(4242);
            $p->producto_pdf_desvincular(4242, 'muestra.pdf');
            $tras_baja_v = $p->producto_pdf_slugs(4242);
            $GLOBALS['test_validez'] = [
                'lista' => $lista_v, 'primero' => $primero_v, 'lista2' => $lista2_v,
                'dedupe' => $dedupe_v, 'compat2' => $compat2_v, 'baja_parcial' => $baja_parcial_v,
                'tolerante' => $tolerante_v, 'respaldo' => $respaldo_v, 'tras_baja' => $tras_baja_v,
            ];
            // T002: tienda{} normalizada (bool, recorte, allowlist, claves pid,
            // bloquear solo con validez) sin pisar el resto del config.
            $motor_v->guardar_config('muestra', [
                'activo' => true,
                'productos' => [4242],
                'campos_ids' => [7],
                'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => 'Ana', 'settings' => '', 'repetir' => false]],
            ]);
            $ok_t = $motor_v->guardar_config('muestra', [
                'tienda' => [
                    '4242' => [
                        'activo' => '1',
                        'validez' => "campo1 === 'libelulas' && campo2 === 'a4'",
                        'mensaje_html' => '<b>Ese diseno no viene en ese tamano.</b><script>alert(1)</script>',
                        'bloquear' => '',
                    ],
                    '4243' => [
                        'activo' => false,
                        'validez' => '',
                        'bloquear' => '1', // sin validez: se ignora
                    ],
                    '4244' => [
                        'validez' => str_repeat('a', 2100),
                        'mensaje_html' => str_repeat('b', 2100),
                        'bloquear' => '1',
                    ],
                    'no-numerico' => ['activo' => true],
                ],
            ]);
            $cfg_v = $motor_v->leer_config('muestra');
            $GLOBALS['test_validez']['ok_tienda'] = $ok_t;
            $GLOBALS['test_validez']['tienda'] = isset($cfg_v['tienda']) ? $cfg_v['tienda'] : null;
            $GLOBALS['test_validez']['resto_intacto'] = (!empty($cfg_v['activo'])
                && $cfg_v['productos'] === [4242] && $cfg_v['campos_ids'] === [7]
                && isset($cfg_v['placeholders']['0000FF']) && $cfg_v['placeholders']['0000FF']['value'] === 'Ana');
            // Validez con sintaxis prohibida: rechazo con causa de campos, sin
            // dejar el config a medias (el motor escribe al final).
            try {
                $motor_v->guardar_config('muestra', ['tienda' => ['4242' => ['validez' => 'document.getElementById("x")']]]);
                $GLOBALS['test_validez']['err_mala'] = 'sin-rechazo';
            } catch (\Throwable $e_mala) {
                $GLOBALS['test_validez']['err_mala'] = $e_mala->getMessage();
            }
            $tras_mala_v = $motor_v->leer_config('muestra');
            $GLOBALS['test_validez']['tienda_intacta'] = (isset($tras_mala_v['tienda']['4242']['validez'])
                && $tras_mala_v['tienda']['4242']['validez'] === "campo1 === 'libelulas' && campo2 === 'a4'");
            // Borde del spec (005): una validez vieja que hoy no compila se lee y
            // se re-guarda sin cambios (nunca bloquea el resto de la consola).
            file_put_contents($motor_v->ruta_config('muestra'), wp_json_encode([
                'activo' => true,
                'tienda' => ['4242' => ['validez' => 'document.getElementById("legacy")']],
            ]));
            $legacy_v = $motor_v->leer_config('muestra');
            $GLOBALS['test_validez']['legacy_leida'] = (isset($legacy_v['tienda']['4242']['validez'])
                && $legacy_v['tienda']['4242']['validez'] === 'document.getElementById("legacy")');
            $GLOBALS['test_validez']['legacy_guardable'] = true;
            try {
                $motor_v->guardar_config('muestra', ['tienda' => $legacy_v['tienda']]);
            } catch (\Throwable $e_leg) {
                $GLOBALS['test_validez']['legacy_guardable'] = false;
            }
            // T011: la MISMA fixture que tests/validez.js — el servidor verifica
            // el SANEO (no evalua la expresion: Const. III) y el navegador la
            // evaluacion; ambas puertas deben coincidir en que aceptan/rechazan.
            $fixture_v = json_decode((string)@file_get_contents(dirname(__DIR__) . '/tests/validez-fixture.json'), true);
            $fixture_res = [];
            foreach ((array)($fixture_v['casos'] ?? []) as $caso_v) {
                $aceptado = true;
                try {
                    $motor_v->guardar_config('muestra', ['tienda' => ['4242' => ['validez' => (string)$caso_v['validez']]]]);
                } catch (\Throwable $e_fx) {
                    $aceptado = false;
                }
                $leido_fx = $motor_v->leer_config('muestra');
                $guardado_fx = isset($leido_fx['tienda']['4242']['validez'])
                    ? (string)$leido_fx['tienda']['4242']['validez'] : null;
                $fixture_res[] = [
                    'nombre' => (string)$caso_v['nombre'],
                    'aceptado' => $aceptado,
                    'esperado' => !empty($caso_v['saneo_php']),
                    'coincide' => !$aceptado || $guardado_fx === trim((string)$caso_v['validez']),
                ];
            }
            $GLOBALS['test_validez']['fixture'] = $fixture_res;
            // T003: saneado del snapshot (asociado + activo; inactivo descartado).
            $p->producto_pdf_vincular(4242, 'muestra.pdf'); // re-asociar tras la baja de T001
            $motor_v->guardar_config('muestra', ['tienda' => ['4242' => ['activo' => true]]]);
            $GLOBALS['test_validez']['sanea_ok'] = $p->sanear_pdfs_declarados(4242, ['muestra', 'otro', 'muestra']);
            $motor_v->guardar_config('muestra', ['tienda' => ['4242' => ['activo' => false]]]);
            $GLOBALS['test_validez']['sanea_inactivo'] = $p->sanear_pdfs_declarados(4242, ['muestra', 'otro', 'muestra']);
            $GLOBALS['test_validez']['sanea_invalido'] = $p->sanear_pdfs_declarados(4242, ['///', '']);
            $GLOBALS['test_validez']['sanea_vacio'] = $p->sanear_pdfs_declarados(4242, []);
        } catch (\Throwable $e_v) {
            $GLOBALS['test_validez_error'] = $e_v->getMessage();
        }
        break;

    case 'validez_admin':
    case 'validez_admin_mal':
        // Spec 005 (T004/T005): "Configuracion tienda" por asociacion — el
        // handler arma `tienda{pid}` desde el POST (poda huerfanos) y rechaza
        // la validez invalida con causa, sin escribir nada.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_va = new PMU_Uploads();
        $cid_va = $motor_va->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_va->guardar_config('muestra', ['activo' => true, 'productos' => [4242], 'campos_ids' => [$cid_va]]);
        $_POST = [
            'action' => 'personalizador_pdf_config',
            'ajax' => '1',
            'archivo' => 'muestra.pdf',
            'activo' => '1',
            'productos' => ['4242', '4243'],
            'campos_ids' => [(string)$cid_va],
            'placeholders' => [],
            'tienda_presente' => '1',
            'tienda' => [
                '4242' => [
                    'activo' => ['0', '1'], // hidden(0) + checkbox(1)
                    'validez' => "campo1 === 'libelulas' && campo2 === 'a4'",
                    'mensaje_html' => '<b>Ese diseno no viene en ese tamanio.</b><script>alert(1)</script>',
                    'bloquear' => '1',
                ],
                '4243' => [
                    'activo' => ['0'], // checkbox desmarcado
                    'validez' => '',
                    'mensaje_html' => '',
                    'bloquear' => '1', // sin validez: se ignora
                ],
                '9999' => [ // producto no asociado: se poda
                    'activo' => ['0', '1'],
                    'validez' => '',
                    'mensaje_html' => '',
                    'bloquear' => '',
                ],
            ],
        ];
        if ($fase === 'validez_admin_mal') {
            $_POST['tienda']['4242']['validez'] = 'document.getElementById("x")';
        }
        $_REQUEST = $_POST;
        $p->handle_config_guardar(); // exit (JSON)
        break;

    case 'ficha_pdfs':
        // Spec 005 (US2, T006-T008): ficha del producto con N PDFs y tienda{}.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_fp = new PMU_Uploads();
        // Segundo PDF del producto: mismo fixture, otra carpeta (otro id).
        $dirOtro = $testBase . '/uploads/pmu/pdfs/otro';
        wp_mkdir_p($dirOtro);
        copy($testBase . '/uploads/pmu/pdfs/muestra/muestra.pdf', $dirOtro . '/otro.pdf');
        $anal_fp = \ExtractCorel\Engine\Metadata::cargar($testBase . '/uploads/pmu/pdfs/muestra/analisis.json');
        \ExtractCorel\Engine\Metadata::guardar(
            \ExtractCorel\Engine\Metadata::generarAnalisis('otro', $anal_fp['grupos']),
            $dirOtro . '/analisis.json'
        );
        $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra', 'otro'];
        $c1_fp = $motor_fp->campo_alta([0, 'Diseno', 'select', [], '', true, '<select></select>', '', '', false]);
        $c2_fp = $motor_fp->campo_alta([0, 'Tamanio', 'select', [], '', true, '<select></select>', '', '', false]);
        $motor_fp->guardar_config('muestra', [
            'activo' => true,
            'productos' => [4242],
            'campos_ids' => [$c1_fp],
            'tienda' => ['4242' => [
                'validez' => "campo1 === 'libelulas'",
                'mensaje_html' => '<b>Ese diseno no viene en ese tamanio.</b>',
                'bloquear' => true,
            ]],
        ]);
        $motor_fp->guardar_config('otro', [
            'activo' => true,
            'productos' => [4242],
            'campos_ids' => [$c1_fp, $c2_fp],
            'tienda' => ['4242' => ['validez' => '', 'bloquear' => true]], // sin validez: se ignora
        ]);
        $GLOBALS['test_fp']['campos'] = [$c1_fp, $c2_fp];
        $GLOBALS['test_fp']['panel'] = $p->panel_producto(4242);
        $p->panel_ficha_html('', 4242);
        $GLOBALS['test_fp']['ficha'] = isset($GLOBALS['test_localizados']['personalizador-pdf-tienda#PMU_FICHA'])
            ? $GLOBALS['test_localizados']['personalizador-pdf-tienda#PMU_FICHA'] : null;
        // Inactivo para el producto: no existe en la ficha (FR-1.1/FR-3.1).
        $motor_fp->guardar_config('otro', ['tienda' => ['4242' => ['activo' => false]]]);
        $GLOBALS['test_fp']['panel_uno'] = $p->panel_producto(4242);
        break;

    case 'ficha_pdfs_previa':
        // Spec 005 (US2/US4, T009): el navegador declara elegibles; el servidor
        // los sanea y congela el snapshot del draft (sin evaluar la validez).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_fp = new PMU_Uploads();
        $dirOtro = $testBase . '/uploads/pmu/pdfs/otro';
        wp_mkdir_p($dirOtro);
        copy($testBase . '/uploads/pmu/pdfs/muestra/muestra.pdf', $dirOtro . '/otro.pdf');
        $anal_fp = \ExtractCorel\Engine\Metadata::cargar($testBase . '/uploads/pmu/pdfs/muestra/analisis.json');
        \ExtractCorel\Engine\Metadata::guardar(
            \ExtractCorel\Engine\Metadata::generarAnalisis('otro', $anal_fp['grupos']),
            $dirOtro . '/analisis.json'
        );
        $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra', 'otro'];
        $c1_fp = $motor_fp->campo_alta([0, 'Diseno', 'select', [], '', true, '<select></select>', '', '', false]);
        foreach (['muestra', 'otro'] as $nom_fp) {
            $motor_fp->guardar_config($nom_fp, [
                'activo' => true,
                'productos' => [4242],
                'campos_ids' => [$c1_fp],
                'mockups' => [['id' => 'vista1', 'titulo' => 'Vista', 'creado' => '', 'capas' => [
                    ['tipo' => 'img', 'ref' => 'foto.png', 'x' => 0, 'y' => 0, 'w' => 100, 'h' => 100],
                ]]],
            ]);
        }
        $_POST = [
            'action' => 'personalizador_pdf_vista_previa',
            'ajax' => '1',
            'producto' => '4242',
            'pdf' => 'muestra.pdf',
            'pmu_pdfs' => json_encode(['muestra', 'otro', 'x']),
            'valores' => json_encode(['1' => ['valor' => 'libelulas', 'cliente' => 'Libelulas']]),
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_vista_previa(); // exit (JSON)
        break;

    case 'ficha_pdfs_vacio':
        // T009: una lista pmu_pdfs vacía se rechaza y no crea draft.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_vacio = new PMU_Uploads();
        $motor_vacio->guardar_config('muestra', ['activo' => true, 'productos' => [4242]]);
        $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra'];
        $_POST = [
            'action' => 'personalizador_pdf_vista_previa',
            'ajax' => '1',
            'producto' => '4242',
            'pdf' => 'muestra.pdf',
            'pmu_pdfs' => '[]',
            'valores' => json_encode([]),
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_vista_previa(); // exit (JSON)
        break;


    case 'ficha_pdfs_carrito':
        // con el snapshot saneado + `pdfs_descartados` (auditoria).
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        $motor_fp = new PMU_Uploads();
        $dirOtro = $testBase . '/uploads/pmu/pdfs/otro';
        wp_mkdir_p($dirOtro);
        copy($testBase . '/uploads/pmu/pdfs/muestra/muestra.pdf', $dirOtro . '/otro.pdf');
        $anal_fp = \ExtractCorel\Engine\Metadata::cargar($testBase . '/uploads/pmu/pdfs/muestra/analisis.json');
        \ExtractCorel\Engine\Metadata::guardar(
            \ExtractCorel\Engine\Metadata::generarAnalisis('otro', $anal_fp['grupos']),
            $dirOtro . '/analisis.json'
        );
        $GLOBALS['test_postmeta'][4242]['_pmu_pdf_slugs'] = ['muestra', 'otro'];
        // omisible: exige mockups en la config (T011/T018); una capa valida
        // (config_mockups descarta mockups sin capas).
        $motor_fp->guardar_config('muestra', [
            'activo' => true,
            'productos' => [4242],
            'mockups' => [['id' => 'vista1', 'titulo' => 'Vista', 'creado' => '', 'capas' => [
                ['tipo' => 'img', 'ref' => 'foto.png', 'x' => 0, 'y' => 0, 'w' => 100, 'h' => 100],
            ]]],
            'preview_omisible' => true,
        ]);
        $motor_fp->guardar_config('otro', [
            'activo' => true,
            'productos' => [4242],
            'mockups' => [['id' => 'vista1', 'titulo' => 'Vista', 'creado' => '', 'capas' => [
                ['tipo' => 'img', 'ref' => 'foto.png', 'x' => 0, 'y' => 0, 'w' => 100, 'h' => 100],
            ]]],
            'preview_omisible' => true,
        ]);
        $_POST = [
            'action' => 'woocommerce_add_to_cart',
            'pmu_pdfs' => json_encode(['muestra', 'otro', 'x']),
            'pmu_valores' => json_encode([]),
        ];
        $_REQUEST = $_POST;
        $GLOBALS['test_fp']['carrito_ok'] = $p->carrito_validar(true, 4242, 1);
        foreach ((array)glob($testBase . '/uploads/pmu/tmp/sesion-*/*/manifest.json') as $man_fp) {
            $GLOBALS['test_fp']['manifiesto'] = json_decode((string)@file_get_contents($man_fp), true);
        }
        break;

    case 'conciliacion':
        // 004/T024: config editable, analisis inmutable y draft sin pool bloqueado.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $motor_c = $p->motor_para_tests();
        $analisis_c = (string)file_get_contents($motor_c->ruta_analisis('muestra'));
        $motor_c->guardar_config('muestra', [
            'activo' => true,
            'campos_ids' => [],
            'placeholders' => [
                '0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => 'Ana', 'repetir' => true],
            ],
            'preview_omisible' => false,
        ]);
        $sesion_c = new PMU_Sesion($motor_c);
        $draft_c = $sesion_c->crear_draft('test-conc', ['muestra']);
        $_POST = ['pmu_sid' => 'test-conc', 'pmu_item_key' => $draft_c];
        $_REQUEST = $_POST;
        $GLOBALS['test_conciliacion'] = [
            'analisis_antes' => $analisis_c,
            'analisis_despues' => (string)file_get_contents($motor_c->ruta_analisis('muestra')),
            'preview_omisible' => $motor_c->leer_config('muestra')['preview_omisible'],
            'repetir' => !empty($motor_c->leer_config('muestra')['placeholders']['0000FF']['repetir']),
            'carrito_ok' => $p->carrito_validar(true, 4242, 1),
        ];
        break;

    case 'desactivar':
    case 'reanalizar':
        preparar_entorno($testBase, $base);
        $motor_fr = $p->motor_para_tests();
        $motor_fr->guardar_config('muestra', [
            'activo' => true,
            'productos' => [],
            'campos_ids' => [],
            'placeholders' => [
                '0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => 'Ana', 'settings' => ''],
            ],
        ]);
        $GLOBALS['test_config_previa'] = $motor_fr->leer_config('muestra');
        $GLOBALS['test_analisis_previo'] = file_get_contents($motor_fr->ruta_analisis('muestra'));
        $_POST = [
            'action' => $fase === 'desactivar' ? 'personalizador_pdf_config' : 'personalizador_pdf_reanalizar',
            'archivo' => 'muestra.pdf',
            'placeholders' => $GLOBALS['test_config_previa']['placeholders'],
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        if ($fase === 'desactivar') {
            $p->handle_config_guardar();
        } else {
            $p->handle_reanalizar();
        }
        break;
    case 'sesion':
        // T003/T017: ciclo completo del item (draft -> pool -> webp -> promover
        // -> staging -> promover_order) + TTL, borrado quirurgico y estados.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $motor_s = $p->motor_para_tests();
        $sesion = new PMU_Sesion($motor_s);
        try {
            $sid = 'test-8f2a';
            $pngTemp = sys_get_temp_dir() . '/pd_puente_png_' . getmypid() . '.png';
            \ExtractCorel\Engine\PngWriter::write($pngTemp, 300, 200);
            $bytesPng = (string)file_get_contents($pngTemp);
            $hashEsperado = sha1('Ana|neon-glow||300x200'); // hash de regeneracion del llamador
            $draft = $sesion->crear_draft($sid, ['muestra']);
            $f1 = $sesion->guardar_png($sid, $draft, 'muestra', '0000FF', $bytesPng, $hashEsperado);
            $f2 = $sesion->guardar_png($sid, $draft, 'muestra', '0000FF', $bytesPng, $hashEsperado);
            $GLOBALS['test_sesion'] = [
                'sid' => $sid,
                'draft' => $draft,
                'f1' => $f1,
                'f2' => $f2,
                'dir_draft' => $sesion->dir_item($sid, $draft),
                'man_draft' => $sesion->leer_manifest($sid, $draft),
            ];
            $sesion->congelar_webp($sid, $draft, 'fiesta', 'RIFF....WEBPVP8 ');
            // Todas las vistas listas: el llamador marca ok (T015).
            $manOk = $sesion->leer_manifest($sid, $draft);
            $manOk['preview_estado'] = 'ok';
            $sesion->guardar_manifest($sid, $draft, $manOk);
            $sesion->promover($sid, $draft, 'abc123def456');
            $GLOBALS['test_sesion']['dir_item'] = $sesion->dir_item($sid, 'abc123def456');
            $GLOBALS['test_sesion']['man_item'] = $sesion->leer_manifest($sid, 'abc123def456');
            $GLOBALS['test_sesion']['estado'] = $sesion->estado_preview($sid, 'abc123def456');
            $sesion->staging_order(4242, 'abc123def456', $sid);
            $GLOBALS['test_sesion']['staging'] = $sesion->staging_order(4242, 'abc123def456', $sid);
            $GLOBALS['test_sesion']['entregable'] = $sesion->promover_order(4242, 'abc123def456');
            // Borrado quirurgico de OTRO item: se crea, se borra y no debe quedar.
            $otro = $sesion->crear_draft($sid, ['muestra']);
            $dirOtro = $sesion->dir_item($sid, $otro);
            $sesion->borrar_item($sid, $otro);
            $GLOBALS['test_sesion']['dir_otro'] = $dirOtro;
            $GLOBALS['test_sesion']['otro'] = $otro;
            // TTL: draft creado ahora no vence en 24h; uno con manifest.creado
            // viejo si (el TTL es por manifest.creado, no por mtime).
            $viejo = $sesion->crear_draft($sid, ['muestra']);
            $manViejo = $sesion->leer_manifest($sid, $viejo);
            $manViejo['creado'] = gmdate('Y-m-d\TH:i:s\Z', time() - 48 * 3600);
            $sesion->guardar_manifest($sid, $viejo, $manViejo);
            $GLOBALS['test_sesion']['ttl_eliminados'] = $sesion->limpiar_ttl(24);
            $GLOBALS['test_sesion']['viejo'] = $viejo;
        } catch (\Throwable $e) {
            $GLOBALS['test_sesion_error'] = $e->getMessage();
        }
        break;

    case 'admin':
        // El render se verifica en shutdown; aqui basta con salir limpio.
        // T025: se siembra un entregable para que la consola renderice la tabla
        // de completados (con el form de "Regenerar PDF") y no solo el vacio.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Sesion')) {
            require dirname(__DIR__) . '/inc/class-pmu-sesion.php';
        }
        $dirAd = $p->motor_para_tests()->dir_ambito('orders', true) . DIRECTORY_SEPARATOR . '4242' . DIRECTORY_SEPARATOR . 'item-abc';
        wp_mkdir_p($dirAd);
        file_put_contents($dirAd . DIRECTORY_SEPARATOR . 'manifest.json', json_encode([
            'item_key' => 'item-abc',
            'pdfs' => ['muestra'],
            'valores' => [],
            'archivos' => [],
            'preview_estado' => 'sin_vista',
        ]));
        // Spec 005 (T004): asociaciones + tienda{} para el render real de la
        // consola ("Configuracion tienda" por producto).
        $p->motor_para_tests()->guardar_config('muestra', [
            'activo' => true,
            'productos' => [4242, 4243],
            'tienda' => [
                '4242' => ['activo' => true, 'validez' => "campo1 === 'libelulas' && campo2 === 'a4'", 'mensaje_html' => '<b>Sin stock</b>', 'bloquear' => true],
                '4243' => ['activo' => false],
            ],
        ]);
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
        $motor_t->campo_alta([0, 'Nombre', 'text', [], '', true, '<div></div>', '', '', false]);
        $motor_t->campo_alta([0, 'Color', 'override', [], '', true, '<div></div>', '', '', false]);
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
        $GLOBALS['test_borrado_testigos'] = [
            'orders/4242/item-ajeno/resultado.pdf' => 'entregable a conservar',
            'tmp/orders/4243/item-ajeno/manifest.json' => '{"estado":"staging"}',
            'tmp/sesion-prueba/item-ajeno/manifest.json' => '{"estado":"carrito"}',
            'pdfs/otro/otro.pdf' => 'otro producto',
            'tmp/muestras/otro/0000FF.png' => 'muestra de otro producto',
        ];
        foreach ($GLOBALS['test_borrado_testigos'] as $ruta => $contenido) {
            $destino = $testBase . '/uploads/pmu/' . $ruta;
            wp_mkdir_p(dirname($destino));
            file_put_contents($destino, $contenido);
        }
        $muestras_b = $motor_b->dir_tmp_muestras('muestra', true);
        file_put_contents($muestras_b . '/0000FF.png', 'muestra a eliminar');
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

    case 'mockups':
        // T011: mockups + mapeo con repetir en config.json; analisis intacto;
        // preview_omisible solo persiste con mockups; mapeos invalidos fuera.
        preparar_entorno($testBase, $base);
        if (!class_exists('PMU_Uploads')) {
            require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
            require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
        }
        try {
            $motor_m = new PMU_Uploads();
            $analisis_antes = file_get_contents($motor_m->ruta_analisis('muestra'));
            $ok_m = $motor_m->guardar_config('muestra', [
                'mockups' => [
                    [
                        'id' => 'fiesta',
                        'titulo' => 'Fiesta',
                        'creado' => '2026-09-17T14:00:00Z',
                        'capas' => [
                            ['tipo' => 'img', 'ref' => 'fondo', 'x' => 0, 'y' => 0, 'w' => 300, 'h' => 300, 'rot' => 0, 'sesgo' => 0, 'filtros' => ['brillo' => 95, 'contraste' => 110]],
                            ['tipo' => 'placeholder', 'ref' => '0000FF#0', 'x' => 96, 'y' => 60, 'w' => 110, 'h' => 180, 'rot' => -3, 'sesgo' => 0.05, 'filtros' => []],
                            ['tipo' => 'foto', 'ref' => 'x', 'x' => 0, 'y' => 0, 'w' => 1, 'h' => 1], // tipo invalido: fuera
                            ['tipo' => 'img', 'ref' => '../fuera', 'x' => 0, 'y' => 0, 'w' => 1, 'h' => 1], // ref con ruta: fuera
                            ['tipo' => 'img', 'ref' => 'marco', 'x' => 90, 'y' => 54, 'w' => 122, 'h' => 192, 'rot' => 400, 'sesgo' => 9, 'filtros' => ['brillo' => 999, 'xxx' => 1]],
                        ],
                    ],
                    ['id' => 'vacio', 'capas' => []], // sin capas: fuera
                    ['capas' => [['tipo' => 'img', 'ref' => 'f', 'x' => 0, 'y' => 0, 'w' => 1, 'h' => 1]]], // sin id: fuera
                ],
                'preview_omisible' => true,
                'placeholders' => [
                    '0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => '[campo1]', 'settings' => '', 'repetir' => '1'],
                    'FF0000' => ['tipo' => 'imagen', 'value' => '[campo33]'],
                ],
            ]);
            $cfg_m = $motor_m->leer_config('muestra');
            $GLOBALS['test_mockups'] = ['ok' => $ok_m, 'cfg' => $cfg_m];
            $GLOBALS['test_analisis_antes'] = $analisis_antes;
            $GLOBALS['test_analisis_despues'] = file_get_contents($motor_m->ruta_analisis('muestra'));
            // Sin mockups: preview_omisible NO persiste (queda false).
            $motor_m->guardar_config('muestra', ['mockups' => [], 'preview_omisible' => true]);
            $GLOBALS['test_mockups_sin'] = $motor_m->leer_config('muestra');
        } catch (\Throwable $e) {
            $GLOBALS['test_mockups_error'] = $e->getMessage();
        }
        break;

    case 'mockup_foto':
        // T007: subir foto de mockup del admin -> pdfs/{nombre}/mockups/.
        preparar_entorno($testBase, $base);
        $fotoTmp = sys_get_temp_dir() . '/pd_puente_foto_' . getmypid() . '.png';
        \ExtractCorel\Engine\PngWriter::write($fotoTmp, 120, 90);
        $_FILES = [
            'foto' => [
                'name' => 'fiesta.png', 'type' => 'image/png',
                'tmp_name' => $fotoTmp, 'error' => UPLOAD_ERR_OK, 'size' => filesize($fotoTmp),
            ],
        ];
        $_POST = [
            'action' => 'personalizador_pdf_mockup_subir',
            'archivo' => 'muestra.pdf',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_mockup_subir(); // exit en redirigir(ec_mockup_subida)
        break;

    case 'mockup_foto_baja':
        // T007: borrar una foto de mockup (ruta ya saneada por el motor).
        preparar_entorno($testBase, $base);
        $motor_mf = $p->motor_para_tests();
        $dirFoto = $motor_mf->dir_mockups('muestra', true);
        file_put_contents($dirFoto . DIRECTORY_SEPARATOR . 'fiesta.png', 'png falso');
        // Testigo ajeno que debe sobrevivir.
        file_put_contents($dirFoto . DIRECTORY_SEPARATOR . 'otra.png', 'otra');
        $_POST = [
            'action' => 'personalizador_pdf_mockup_borrar',
            'archivo' => 'muestra.pdf',
            'foto' => 'fiesta.png',
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_mockup_borrar(); // exit en redirigir(ec_mockup_baja)
        break;

    case 'mockups_guardar':
        // T008: el editor guarda SOLO mockups + preview_omisible; el resto del
        // config (activo/productos/campos/mapeos) queda intacto.
        preparar_entorno($testBase, $base);
        $motor_mg = $p->motor_para_tests();
        $motor_mg->guardar_config('muestra', [
            'activo' => true,
            'productos' => [7],
            'campos_ids' => [1],
            'placeholders' => ['0000FF' => ['tipo' => 'texto', 'preset' => 'neon-glow', 'value' => 'Ana', 'settings' => '', 'repetir' => true]],
        ]);
        $GLOBALS['test_cfg_previo'] = $motor_mg->leer_config('muestra');
        $_POST = [
            'action' => 'personalizador_pdf_mockups',
            'archivo' => 'muestra.pdf',
            'ajax' => '1',
            'preview_omisible' => '1',
            'mockups' => json_encode([[
                'id' => 'fiesta',
                'titulo' => 'Fiesta',
                'capas' => [
                    ['tipo' => 'img', 'ref' => 'fondo.png', 'x' => 0, 'y' => 0, 'w' => 300, 'h' => 300, 'rot' => 0, 'sesgo' => 0, 'filtros' => ['brillo' => 90]],
                    ['tipo' => 'placeholder', 'ref' => '0000FF#0', 'x' => 96, 'y' => 60, 'w' => 110, 'h' => 180, 'rot' => -3, 'sesgo' => 0.05, 'filtros' => []],
                    ['tipo' => 'otro', 'ref' => 'x', 'x' => 0, 'y' => 0, 'w' => 1, 'h' => 1],
                ],
            ]]),
            '_wpnonce' => 'nonce',
        ];
        $_REQUEST = $_POST;
        $p->handle_mockups_guardar(); // exit en wp_send_json_success
        break;

    case 'nonce':
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
            $id1 = $motor_c->campo_alta([0, 'Nombre', 'text', ['nombres'], 'Escribi tu nombre', true, '<div class="pmu-campo-x"><input name="nombre"></div>', '.x{}', 'function(ctx,root){return {valor:"",cliente:""};}', true]);
            $id2 = $motor_c->campo_alta([0, 'Color', 'override', [], '', true, '<div class="c"></div>', '', '', false]);
            $motor_c->campo_editar($id1, [$id1, 'Nombre editado', 'text', [], '', true, '<div></div>', '', '', true]);
            $motor_c->campo_baja($id2);
            // Sandbox: alta con script prohibido debe rechazar (motor:campos:script:invalido).
            $err_nueva = '';
            try {
                $motor_c->campo_alta([0, 'Malo', 'text', [], '', true, '<div></div>', '', 'function(ctx,root){document.getElementById("x");}', false]);
            } catch (\Throwable $e) {
                $err_nueva = $e->getMessage();
            }
            $res_c = $motor_c->campos_catalogo('listar');
            $ids_c = [];
            $tit1 = null;
            $t1 = null;
            foreach ($res_c['cat']['items'] as $t) {
                if (count($t) < 3 || $t[1] === '' || $t[2] === '') {
                    continue; // tombstone fuera
                }
                $ids_c[] = (int)$t[0];
                if ((int)$t[0] === $id1) {
                    $tit1 = $t[1];
                    $t1 = $t;
                }
            }
            $GLOBALS['test_campos'] = ['id1' => $id1, 'id2' => $id2, 'ids' => $ids_c, 'tit1' => $tit1, 'aviso' => $res_c['aviso'], 't1' => $t1, 'err_nueva' => ($err_nueva === 'motor:campos:script:invalido' ? '' : ($err_nueva !== '' ? $err_nueva : 'no-rechazo'))];
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
            $GLOBALS['test_config_defaults'] = ($motor_g->leer_config('inexistente') === ['activo' => false, 'productos' => [], 'campos_ids' => [], 'preview_omisible' => false, 'mockups' => [], 'placeholders' => [], 'tienda' => []]);
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