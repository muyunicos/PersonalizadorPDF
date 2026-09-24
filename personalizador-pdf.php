<?php
/**
 * Plugin Name: Personalizador PDF
 * Description: Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color. Motor 100% PHP, sin Python. Integra el sistema TextMuy (editor de estilos de texto) en la pestana "Estilos de Texto".
 * Version: 4.2.0
 * Author: Personalizador PDF
 * License: GPL-2.0+
 * Text Domain: personalizador-pdf
 *
 * @package PersonalizadorPDF
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PERSONALIZADOR_PDF_VERSION', '4.2.0');
define('PERSONALIZADOR_PDF_PATH', plugin_dir_path(__FILE__));
define('PERSONALIZADOR_PDF_URL', plugin_dir_url(__FILE__));

require_once PERSONALIZADOR_PDF_PATH . 'engine/Pdf.php';
require_once PERSONALIZADOR_PDF_PATH . 'engine/Detector.php';
require_once PERSONALIZADOR_PDF_PATH . 'engine/PngWriter.php';
require_once PERSONALIZADOR_PDF_PATH . 'engine/Metadata.php';
require_once PERSONALIZADOR_PDF_PATH . 'engine/Imagen.php';
require_once PERSONALIZADOR_PDF_PATH . 'engine/Overlay.php';
require_once PERSONALIZADOR_PDF_PATH . 'engine/Motor.php';

use ExtractCorel\Engine\Detector;
use ExtractCorel\Engine\Metadata;
use ExtractCorel\Engine\Motor;
use ExtractCorel\Engine\PngWriter;

class Personalizador_PDF_Plugin
{
    private static $instance = null;

    public static function instance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('admin_post_personalizador_pdf_subir_pdf', [$this, 'handle_subir_pdf']);
        add_action('admin_post_personalizador_pdf_reanalizar', [$this, 'handle_reanalizar']);
        add_action('admin_post_personalizador_pdf_subir_imagen', [$this, 'handle_subir_imagen']);
        add_action('admin_post_personalizador_pdf_imagen_galeria', [$this, 'handle_imagen_galeria']);
        add_action('admin_post_personalizador_pdf_quitar_imagen', [$this, 'handle_quitar_imagen']);
        add_action('admin_post_personalizador_pdf_guardar_texto', [$this, 'handle_guardar_texto']);
        add_action('admin_post_personalizador_pdf_procesar', [$this, 'handle_procesar']);
        add_action('admin_post_personalizador_pdf_campo', [$this, 'handle_campo_guardar']);
        add_action('admin_post_personalizador_pdf_campo_baja', [$this, 'handle_campo_baja']);
        add_action('admin_post_personalizador_pdf_config', [$this, 'handle_config_guardar']);
        add_action('admin_post_personalizador_pdf_descargar', [$this, 'handle_descargar']);
        add_action('admin_post_personalizador_pdf_ver', [$this, 'handle_ver']);
        add_action('admin_post_personalizador_pdf_borrar', [$this, 'handle_borrar']);
        // Spec 004 (T007): fotos de mockup del admin (subida/borrado).
        add_action('admin_post_personalizador_pdf_mockup_subir', [$this, 'handle_mockup_subir']);
        add_action('admin_post_personalizador_pdf_mockup_borrar', [$this, 'handle_mockup_borrar']);
        // Spec 004 (T008): guardado del editor de mockups (solo mockups + omisible).
        add_action('admin_post_personalizador_pdf_mockups', [$this, 'handle_mockups_guardar']);

        // Spec 004 (T012): panel del comprador en la ficha del producto.
        // El shortcode expone el mismo panel fuera de Woo (manuales/test).
        add_shortcode('pmu_personalizar', [$this, 'shortcode_panel_render']);
        add_action('wp_enqueue_scripts', [$this, 'assets_ficha_condicional']);
        // Spec 004 (T016): panel del comprador en la ficha real del producto.
        add_action('woocommerce_before_add_to_cart_form', [$this, 'ficha_panel_render']);

        // Spec 004 (T013): vista previa del comprador (AJAX; anonimo permitido).
        add_action('wp_ajax_personalizador_pdf_vista_previa', [$this, 'handle_vista_previa']);
        add_action('wp_ajax_nopriv_personalizador_pdf_vista_previa', [$this, 'handle_vista_previa']);

        // Spec 004 (T014): pool del comprador (PNG del render cliente).
        add_action('wp_ajax_personalizador_pdf_pool', [$this, 'handle_pool_png']);
        add_action('wp_ajax_nopriv_personalizador_pdf_pool', [$this, 'handle_pool_png']);

        // Spec 004 (T015): ciclo del carrito (validar, promover el draft, etiquetas
        // cliente, cantidad fija 1 y borrado quirurgico al quitar la linea).
        add_filter('woocommerce_add_to_cart_validation', [$this, 'carrito_validar'], 10, 4);
        add_action('woocommerce_add_cart_item_data', [$this, 'carrito_agregar'], 10, 4);
        add_action('woocommerce_add_to_cart', [$this, 'carrito_promover'], 10, 5);
        add_action('woocommerce_get_item_data', [$this, 'carrito_mostrar'], 10, 2);
        add_filter('woocommerce_cart_item_name', [$this, 'carrito_enlace_edicion'], 10, 2);

        // Spec 004 (T022/T023): ciclo del pedido y descarga del PDF final.
        add_action('woocommerce_checkout_create_order_line_item', [$this, 'pedido_item_crear'], 10, 4);
        add_action('woocommerce_order_status_processing', [$this, 'pedido_promover'], 10, 1);
        add_action('woocommerce_order_status_completed', [$this, 'pedido_promover'], 10, 1);
        add_filter('woocommerce_customer_get_downloadable_products', [$this, 'descargas_cliente'], 10, 1);
        add_action('admin_post_personalizador_pdf_item_descargar', [$this, 'handle_item_descargar']);
        add_action('admin_post_nopriv_personalizador_pdf_item_descargar', [$this, 'handle_item_descargar']);
        add_action('admin_post_personalizador_pdf_item_regenerar', [$this, 'handle_item_regenerar']);
        add_action('woocommerce_remove_cart_item', [$this, 'carrito_quitar']);
        add_filter('woocommerce_quantity_input_min', [$this, 'cantidad_fija'], 10, 2);
        add_filter('woocommerce_quantity_input_max', [$this, 'cantidad_fija'], 10, 2);

        // Buscador de productos Woo para Configuracion tienda (autocompletado AJAX).
        add_action('wp_ajax_personalizador_pdf_buscar_productos', [$this, 'handle_buscar_productos']);

        // Motor de galerias TextMuy (Const. VII): UNICO endpoint
        // action=pmu_uploads con op=listar|alta|baja|editar|sprite|miniatura.
        // Handlers sueltos purgados (Const. VIII).
        // Endpoint PMU Uploads (motor unificado de recursos): Const. VII
        add_action("admin_post_pmu_uploads", [$this, "handle_pmu_uploads"]);
    }

    /* ==================== Rutas y carpetas de datos ==================== */

    /**
     * TODAS las rutas las resuelve el motor PMU_Uploads (Const. II y contrato
     * rutas-pmu.md): el plugin no arma rutas propias ni usa la raiz heredada
     * uploads/personalizador-pdf (la migracion de datos previos vive en US6).
     */

    /* ==================== Motor de galerias (Const. VII) ==================== */

    /** Instancia unica del motor de recursos (clase PMU_Uploads, inc/class-pmu-uploads.php). */
    private function pmu_uploads()
    {
        static $motor = null;
        if ($motor === null) {
            if (!class_exists("PMU_Uploads")) {
                require_once PERSONALIZADOR_PDF_PATH . "inc" . DIRECTORY_SEPARATOR . "class-pmu-uploads.php";
            }
            $motor = new PMU_Uploads();
        }
        return $motor;
    }

    /**
     * Expone el motor al arnes de tests (tests/texto_puente.php, fase admin).
     * Solo para CLI de desarrollo; en produccion el motor sigue siendo interno.
     */
    public function motor_para_tests()
    {
        return $this->pmu_uploads();
    }

    /** Sesion del comprador (PMU_Sesion, inc/class-pmu-sesion.php) sobre el motor unico. */
    private function sesion()
    {
        if (!class_exists('PMU_Sesion')) {
            require_once PERSONALIZADOR_PDF_PATH . 'inc' . DIRECTORY_SEPARATOR . 'class-pmu-sesion.php';
        }
        return new PMU_Sesion($this->pmu_uploads());
    }

    public function handle_pmu_uploads()
    {
        if (!current_user_can("manage_options")) {
            wp_send_json_error("motor:capacidad:invalida");
        }
        if (!isset($_POST["op"])) {
            wp_send_json_error("motor:op:falta");
        }
        $this->pmu_uploads()->handle_request();
    }

    /** Nombre del producto: saneado (minusculas) para carpeta, PDF y dataset. */
    private function nombre_de($archivo)
    {
        return $this->pmu_uploads()->nombre_seguro(Metadata::nombreDesdeArchivo($archivo), 'nombre');
    }

    /** Archivo del producto: uploads/pmu/pdfs/{nombre}/{nombre}.pdf */
    private function ruta_pdf($archivo)
    {
        return $this->pmu_uploads()->ruta_pdf($this->nombre_de($archivo));
    }

    /** Carpeta del producto (creada si falta; exige ser escribible). */
    private function dir_producto($nombre)
    {
        return $this->pmu_uploads()->dir_pdf($nombre, true);
    }


    /** Imagenes aplicadas del panel: uploads/pmu/tmp/muestras/{pdf}/ (crea si falta). */
    private function dir_imagenes($nombre)
    {
        return $this->pmu_uploads()->dir_tmp_muestras($nombre, true);
    }

    /** Carpeta de muestras del panel (alias de dir_imagenes). */
    private function dir_muestras($nombre)
    {
        return $this->dir_imagenes($nombre);
    }

    /** Salida de muestra: uploads/pmu/tmp/muestras/{pdf}/{pdf}_procesado.pdf */
    private function ruta_salida($nombre)
    {
        return $this->pmu_uploads()->ruta_salida_tmp($nombre);
    }

    /** Grupo del dataset por id (o null si no existe). */
    private function grupo_de($nombre, $id)
    {
        $vista = $this->vista_grupos($nombre);
        if (!$vista) {
            return null;
        }
        foreach ((array)($vista['grupos'] ?? []) as $g) {
            if (isset($g['id']) && $g['id'] === $id) {
                return $g;
            }
        }
        return null;
    }

    /**
     * Persiste la personalizacion de un grupo (plan 008: escribe el mapeo en
     * config.json placeholders[id], nunca el analisis). -- T017 (migrado 008)
     * Modo 'texto': value = texto saneado, preset = slug, tipo = 'texto'.
     * Modo 'limpiar': quita el mapeo del grupo.
     */
    private function guardar_personalizacion($nombre, $id, $modo, $value = null, $preset = null)
    {
        $analisis = $this->analisis_de($nombre);
        if (!$analisis) {
            throw new \RuntimeException('Este PDF no tiene datos analizados. Usa "Re-analizar".');
        }
        $encontrado = false;
        foreach ((array)($analisis['grupos'] ?? []) as $g) {
            if (isset($g['id']) && $g['id'] === $id) {
                $encontrado = true;
                break;
            }
        }
        if (!$encontrado) {
            throw new \RuntimeException('Grupo inexistente en el analisis actual. Re-analiza el PDF.');
        }
        $config = $this->config_de($nombre);
        $mapa = isset($config['placeholders']) && is_array($config['placeholders'])
            ? $config['placeholders'] : [];
        if ($modo === 'texto') {
            $mapa[$id] = [
                'tipo' => 'texto',
                'preset' => (string)$preset,
                'value' => $this->limitar_texto((string)$value),
                'settings' => isset($mapa[$id]['settings']) ? (string)$mapa[$id]['settings'] : '',
            ];
        } else {
            unset($mapa[$id]);
        }
        $config['placeholders'] = $mapa;
        if (!$this->pmu_uploads()->guardar_config($nombre, $config)) {
            throw new \RuntimeException('No se pudo guardar la configuracion del grupo.');
        }
    }

    /**
     * PDFs subidos: carpetas pdfs/{nombre}/{nombre}.pdf. Los .pdf sueltos
     * (fixture muestra.pdf) no son productos y se omiten (research D9).
     */
    private function pdfs_subidos()
    {
        $dir = $this->pmu_uploads()->dir_ambito('pdfs');
        $out = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $carpeta) {
            $nombre = basename($carpeta);
            if (is_file($carpeta . DIRECTORY_SEPARATOR . $nombre . '.pdf')) {
                $out[] = $nombre . '.pdf';
            }
        }
        sort($out, SORT_NATURAL | SORT_FLAG_CASE);
        return $out;
    }

    /** Imagenes cargadas de un PDF: id (color hex sin '#') => ruta. */
    private function imagenes_de($nombre)
    {
        $dir = $this->dir_imagenes($nombre);
        $out = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.*') as $ruta) {
            $id = strtoupper(pathinfo($ruta, PATHINFO_FILENAME));
            if (preg_match('/^[0-9A-F]{6}$/', $id)) {
                $out[$id] = $ruta;
            }
        }
        ksort($out);
        return $out;
    }

    /**
     * Fotos de mockup del PDF: archivo => URL publica
     * (uploads/pmu/pdfs/{nombre}/mockups/). Sin catalogo: datos del producto.
     */
    public function mockup_fotos_lista($nombre)
    {
        $motor = $this->pmu_uploads();
        $out = [];
        try {
            $dir = $motor->dir_mockups($nombre);
        } catch (\Throwable $e) {
            return $out;
        }
        if (!is_dir($dir)) {
            return $out;
        }
        $base = $motor->url_ambito('pdfs') . rawurlencode($motor->nombre_seguro($nombre, 'mockup_fotos')) . '/mockups/';
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.*') as $ruta) {
            $ext = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));
            if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
                continue;
            }
            $file = basename($ruta);
            $out[$file] = $base . rawurlencode($file);
        }
        ksort($out);
        return $out;
    }

    /* ==================== Woo: asociacion producto <-> PDF (spec 004, T010) ==================== */

    /**
     * Panel del comprador en la ficha (spec 004, T012/T016). Wrappers:
     * - Shortcode `[pmu_personalizar pdf="slug"]` -> `shortcode_panel_render()`
     *   (HTML real; tambien sirve fuera de Woo en manuales).
     * - Ficha Woo: `ficha_panel_render()` en `woocommerce_before_add_to_cart_form`
     *   con el PDF vinculado por `_pmu_pdf_slug` (canonico).
     * `shortcode_panel()` queda como API de DATOS (tests/manuales).
     */
    public function shortcode_panel($atributos = [])
    {
        $pdf = isset($atributos['pdf']) ? $this->pmu_uploads()->nombre_seguro((string)$atributos['pdf'], 'panel') : '';
        return $this->panel_ficha($pdf);
    }

    /** HTML del panel de ficha (datos o '' si el PDF no es ofrecible). */
    public function shortcode_panel_render($atributos = [])
    {
        $pdf = isset($atributos['pdf']) ? $this->pmu_uploads()->nombre_seguro((string)$atributos['pdf'], 'panel') : '';
        return $this->panel_ficha_html($pdf);
    }

    /** Hook Woo: panel en la ficha del producto (nada si no hay PDF vinculado). */
    public function ficha_panel_render()
    {
        $producto = function_exists('wc_get_product') ? wc_get_product(get_the_ID()) : null;
        $pid = $producto && method_exists($producto, 'get_id') ? (int)$producto->get_id() : 0;
        echo $this->panel_ficha_html('', $pid);
    }

    /**
     * Declarados por el navegador (spec 005, T009).
     * null = no llegó el campo; [] = el navegador declaró una lista vacía.
     * La distinción es necesaria para que una lista vacía no vuelva al modo 004.
     */
    private function pdfs_declarados()
    {
        if (!array_key_exists('pmu_pdfs', $_POST)) {
            return null;
        }
        $crudo = $_POST['pmu_pdfs'];
        if (is_string($crudo)) {
            $dec = json_decode(wp_unslash($crudo), true);
        } elseif (is_array($crudo)) {
            $dec = $crudo;
        } else {
            $dec = [];
        }
        return is_array($dec) ? array_values($dec) : [];
    }

    /**
     * Datos de los campos elegidos para el JS de la ficha: dict por campo
     * (tupla de 10 slots -> claves nombradas; el JS monta el HTML/CSS/script).
     */
    public function campos_panel(array $elegidos)
    {
        $out = [];
        foreach ($elegidos as $cid => $c) {
            $out[] = [
                'id' => (int)$cid,
                'titulo_cliente' => (string)$c[1],
                'tipo' => (string)$c[2],
                'texto_ayuda' => (string)$c[4],
                'contenido' => (string)$c[6],
                'css' => (string)$c[7],
                'script' => (string)$c[8],
                'array' => !empty($c[9]),
            ];
        }
        return $out;
    }

    /**
     * HTML del panel + `PMU_FICHA` para `assets/tienda.js` (T016 + spec 005). Sin
     * PDF ofrecible devuelve ''. Con `$product_id` usa la LISTA de asociaciones
     * del producto (con su validez/mensaje/bloqueo); sin el, el PDF unico del
     * shortcode. Imprime una sola vez por request (hook + shortcode). En edicion
     * (`?pmu_item_key=`) precarga los valores del manifest vigente.
     */
    public function panel_ficha_html($pdf = '', $product_id = 0)
    {
        static $impreso = false;
        $product_id = (int)$product_id;
        $panel = $product_id > 0 ? $this->panel_producto($product_id) : false;
        if (!$panel) {
            $uno = $this->panel_ficha($pdf);
            if (!$uno) {
                return '';
            }
            $panel = [
                'pdfs' => [[
                    'pdf' => $uno['pdf'],
                    'validez' => '',
                    'mensaje_html' => '',
                    'bloquear' => false,
                    'campos_ids' => array_map('intval', array_keys($uno['campos'])),
                    'preview_omisible' => !empty($uno['preview_omisible']),
                ]],
                'campos' => $uno['campos'],
                'preview_omisible' => !empty($uno['preview_omisible']),
            ];
        }
        if ($impreso) {
            return '';
        }
        $impreso = true;
        $this->assets_ficha();
        $slugs = [];
        foreach ($panel['pdfs'] as $asoc) {
            $slugs[] = (string)$asoc['pdf'];
        }
        $valores = [];
        $itemEdicion = '';
        $sid = '';
        try {
            $sesion = $this->sesion();
            $sid = $sesion->sid_actual();
            $pedido = isset($_GET['pmu_item_key']) ? sanitize_text_field(wp_unslash((string)$_GET['pmu_item_key'])) : '';
            $manifest = $pedido !== '' ? $sesion->leer_manifest($sid, $pedido) : null;
            if (is_array($manifest)
                && array_intersect($slugs, array_map('strval', (array)($manifest['pdfs'] ?? [])))) {
                $itemEdicion = $pedido;
                $valores = (array)($manifest['valores'] ?? []);
            }
        } catch (\Throwable $e) {
            $itemEdicion = '';
        }
        wp_localize_script('personalizador-pdf-tienda', 'PMU_FICHA', [
            'pdf' => $slugs[0],
            'pdfs' => $panel['pdfs'],
            'producto' => $product_id,
            'admin' => function_exists('current_user_can') ? current_user_can('manage_options') : false,
            'campos' => $this->campos_panel($panel['campos']),
            'preview_omisible' => !empty($panel['preview_omisible']),
            'valores' => $valores,
            'sesion' => $itemEdicion !== '' ? ['sid' => $sid, 'item_key' => $itemEdicion] : null,
        ]);
        $html = '<div class="pmu-panel" data-pmu-panel data-pdf="' . esc_attr($slugs[0]) . '">';
        $html .= '<p class="pmu-panel-titulo"><strong>Personaliza tu diseno</strong></p>';
        $html .= '<p class="pmu-panel-ayuda">Completa los campos y pulsa "Vista previa" para ver el resultado antes de comprar.</p>';
        if ($itemEdicion !== '') {
            $html .= '<p class="pmu-panel-edicion">Estas editando tu personalizacion guardada: la vista previa se regenerara solo donde cambiaste algo.</p>';
        }
        $html .= '</div>';
        return $html;
    }

    /** Datos del panel de ficha para un PDF (false si el PDF no es ofrecible). */
    public function panel_ficha($pdf)
    {
        try {
            $nombre = $this->pmu_uploads()->nombre_seguro($pdf, 'panel');
        } catch (\Throwable $e) {
            return false;
        }
        $config = $this->config_de($nombre);
        if (empty($config['activo'])) {
            return false;
        }
        $analisis = $this->analisis_de($nombre);
        if (!$analisis || empty($analisis['grupos'])) {
            return false;
        }
        list($campos, ) = $this->campos_activos();
        $elegidos = [];
        foreach ((array)($config['campos_ids'] ?? []) as $cid) {
            if (isset($campos[(int)$cid])) {
                $elegidos[(int)$cid] = $campos[(int)$cid];
            }
        }
        return [
            'pdf' => $nombre,
            'campos' => $elegidos,
            'placeholders' => isset($config['placeholders']) ? (array)$config['placeholders'] : [],
            'mockups' => isset($config['mockups']) ? (array)$config['mockups'] : [],
            'preview_omisible' => !empty($config['preview_omisible']),
        ];
    }

    /**
     * Configuracion tienda de una asociacion PDF x producto (spec 005): los
     * cuatro campos del contrato con los defaults del data-model (sin entrada
     * en `tienda{pid}` = `{activo: true}`).
     */
    private function tienda_de($pdf, $product_id)
    {
        $base = ['activo' => true, 'validez' => '', 'mensaje_html' => '', 'bloquear' => false];
        $config = $this->config_de($pdf);
        if (!is_array($config) || !isset($config['tienda']) || !is_array($config['tienda'])) {
            return $base;
        }
        $clave = (string)(int)$product_id;
        if (!isset($config['tienda'][$clave]) || !is_array($config['tienda'][$clave])) {
            return $base;
        }
        $t = $config['tienda'][$clave];
        return [
            'activo' => !array_key_exists('activo', $t) ? true : !empty($t['activo']),
            'validez' => isset($t['validez']) ? (string)$t['validez'] : '',
            'mensaje_html' => isset($t['mensaje_html']) ? (string)$t['mensaje_html'] : '',
            'bloquear' => !empty($t['bloquear']),
        ];
    }

    /**
     * Panel de ficha del PRODUCTO (spec 005, FR-1.3): resuelve la LISTA de PDFs
     * asociados (orden alfabetico, el mismo de la consola) con su validez/
     * mensaje/bloqueo y la union deduplicada de campos (research D4: los campos
     * de PDFs inelegibles siguen visibles). `false` si no queda ningun PDF
     * ofrecible. `preview_omisible` = true solo si TODOS lo son (T019).
     */
    public function panel_producto($product_id)
    {
        $product_id = (int)$product_id;
        if ($product_id < 1) {
            return false;
        }
        $slugs = $this->producto_pdf_slugs($product_id);
        sort($slugs, SORT_NATURAL | SORT_FLAG_CASE);
        $pdfs = [];
        $campos = [];
        $omisible = true;
        foreach ($slugs as $nombre) {
            $panel = $this->panel_ficha($nombre);
            if (!$panel) {
                continue;
            }
            $tie = $this->tienda_de($nombre, $product_id);
            if (empty($tie['activo'])) {
                continue; // inactivo para este producto: no existe en la ficha
            }
            $pdfs[] = [
                'pdf' => $nombre,
                'validez' => $tie['validez'],
                'mensaje_html' => $tie['mensaje_html'],
                'bloquear' => $tie['bloquear'],
                'campos_ids' => array_map('intval', array_keys($panel['campos'])),
                'preview_omisible' => !empty($panel['preview_omisible']),
            ];
            if (empty($panel['preview_omisible'])) {
                $omisible = false;
            }
            foreach ($panel['campos'] as $cid => $c) {
                $campos[(int)$cid] = $c;
            }
        }
        if (!$pdfs) {
            return false;
        }
        return ['pdfs' => $pdfs, 'campos' => $campos, 'preview_omisible' => $omisible];
    }

    /**
     * Enqueue condicional (T016, riesgo 7): los assets del comprador solo
     * cargan en la ficha de producto (o cuando el shortcode los pide). Antes
     * se encolaban en TODO el front.
     */
    public function assets_ficha_condicional()
    {
        if (function_exists('is_product') && is_product()) {
            $this->assets_ficha();
        }
    }

    /** Assets de la ficha (spec 004, T012): tienda.js + selector-pmu + puente. */
    public function assets_ficha()
    {
        static $listo = false;
        if ($listo) {
            return;
        }
        $listo = true;
        wp_enqueue_script(
            'personalizador-pdf-selector',
            PERSONALIZADOR_PDF_URL . 'assets/selector-pmu.js',
            [],
            PERSONALIZADOR_PDF_VERSION,
            true
        );
        wp_enqueue_script(
            'personalizador-pdf-tienda',
            PERSONALIZADOR_PDF_URL . 'assets/tienda.js',
            ['personalizador-pdf-selector'],
            PERSONALIZADOR_PDF_VERSION,
            true
        );
        wp_localize_script('personalizador-pdf-tienda', 'PMU_TIENDA', [
            'version' => PERSONALIZADOR_PDF_VERSION,
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'postUrl' => admin_url('admin-post.php'),
            'nonceVistaPrevia' => wp_create_nonce('personalizador_pdf_vista_previa'),
            'renderCoreUrl' => PERSONALIZADOR_PDF_URL . 'modules/textmuy/render-core.html',
            'puente' => $this->puente_textmuy()['puente'],
        ]);
    }

    /**
     * Lee los slugs de PDFs vinculados a un producto Woo (canonico: postmeta
     * lista `_pmu_pdf_slugs`; spec 005 T001). Migracion tolerante: si la lista
     * no existe, se lee el singular `_pmu_pdf_slug` como respaldo de 1 (se
     * conserva, no se migra a la fuerza). Un elemento que no sanea se descarta
     * solo a el (nunca invalida la lista completa). Devuelve string[] saneados
     * y unicos. Requiere WP real: en tests sin Woo devuelve [] (sin espejo).
     */
    public function producto_pdf_slugs($product_id)
    {
        $product_id = (int)$product_id;
        if ($product_id < 1 || !function_exists('get_post_meta')) {
            return [];
        }
        $lista = get_post_meta($product_id, '_pmu_pdf_slugs', true);
        if (is_array($lista) && $lista) {
            $out = [];
            foreach ($lista as $s) {
                try {
                    $out[] = $this->pmu_uploads()->nombre_seguro((string)$s, 'vinculo');
                } catch (\Throwable $e) {
                    continue; // elemento invalido: se descarta solo ese
                }
            }
            return array_values(array_unique($out));
        }
        $uno = trim((string)get_post_meta($product_id, '_pmu_pdf_slug', true));
        if ($uno === '') {
            return [];
        }
        try {
            return [$this->pmu_uploads()->nombre_seguro($uno, 'vinculo')];
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * Lee el slug del PDF vinculado a un producto Woo (canonico: postmeta).
     * Compat: primer elemento de producto_pdf_slugs() (spec 005 T001).
     * Requiere WP real: en tests sin Woo devuelve '' (espejo no disponible).
     */
    public function producto_pdf_slug($product_id)
    {
        $todos = $this->producto_pdf_slugs($product_id);
        return $todos ? $todos[0] : '';
    }

    /**
     * Vincula un producto Woo a un PDF: postmeta _pmu_pdf_slugs (lista, canonico;
     * spec 005 T001: agrega sin duplicar; el singular queda como respaldo) +
     * espejo config.json:productos[] (solo lectura informativa).
     */
    public function producto_pdf_vincular($product_id, $pdf)
    {
        $product_id = (int)$product_id;
        if ($product_id < 1 || !function_exists('update_post_meta') || !function_exists('get_post_meta')) {
            throw new \RuntimeException('motor:vinculo:sin_woo');
        }
        $motor = $this->pmu_uploads();
        $nombre = $motor->nombre_seguro($pdf, 'vinculo');
        if (!is_file($motor->ruta_pdf($nombre))) {
            throw new \RuntimeException('motor:vinculo:pdf:inexistente');
        }
        $actual = $this->producto_pdf_slugs($product_id);
        if (!in_array($nombre, $actual, true)) {
            $actual[] = $nombre;
        }
        update_post_meta($product_id, '_pmu_pdf_slugs', $actual);
        $config = $motor->leer_config($nombre);
        $productos = isset($config['productos']) ? (array)$config['productos'] : [];
        $productos[] = $product_id;
        $motor->guardar_config($nombre, ['productos' => $productos]);
        return $nombre;
    }

    /** Desvincula un producto Woo de un PDF (lista postmeta + espejo). */
    public function producto_pdf_desvincular($product_id, $pdf)
    {
        $product_id = (int)$product_id;
        if ($product_id < 1 || !function_exists('delete_post_meta') || !function_exists('update_post_meta')) {
            throw new \RuntimeException('motor:vinculo:sin_woo');
        }
        $motor = $this->pmu_uploads();
        $nombre = $motor->nombre_seguro($pdf, 'vinculo');
        $restantes = [];
        foreach ($this->producto_pdf_slugs($product_id) as $s) {
            if ($s !== $nombre) {
                $restantes[] = $s;
            }
        }
        update_post_meta($product_id, '_pmu_pdf_slugs', $restantes);
        delete_post_meta($product_id, '_pmu_pdf_slug');
        $config = $motor->leer_config($nombre);
        $productos = [];
        foreach ((array)($config['productos'] ?? []) as $pid) {
            if ((int)$pid !== $product_id) {
                $productos[] = (int)$pid;
            }
        }
        $motor->guardar_config($nombre, ['productos' => $productos]);
    }

    /* ==================== Comprador: vista previa y carrito (spec 004, T013/T015) ==================== */

    /** Draft vigente detectado por carrito_validar() (sid + item_key). */
    private $item_draft_valido = [];

    /** Tupla de campo por id desde el catalogo (null si no existe). */
    public function campo_por_id($id)
    {
        list($campos, ) = $this->campos_activos();
        $id = (int)$id;
        return isset($campos[$id]) ? $campos[$id] : null;
    }

    /**
     * Sanitiza los valores del panel (POST `valores` = {campo_id: {valor, cliente}}).
     * `cliente` queda como texto plano (etiqueta) y `valor` crudo con longitud
     * acotada; solo acepta ids presentes en el panel (campos elegidos).
     */
    public function valores_sanitizados($crudos, array $camposPanel)
    {
        $limpios = [];
        foreach ((array)$crudos as $cid => $par) {
            $cid = (int)$cid;
            if ($cid < 1 || !isset($camposPanel[$cid]) || !is_array($par)) {
                continue;
            }
            $limpios[$cid] = [
                'valor' => substr((string)($par['valor'] ?? ''), 0, 2000),
                'cliente' => sanitize_text_field((string)($par['cliente'] ?? '')),
            ];
        }
        return $limpios;
    }

    /**
     * Datos de render por PDF para la ficha (spec 004, T013/T014): grupos
     * fusionados con plantillas [campoN] (value/preset/settings/repetir),
     * fotos del admin para capas img y mockups vigentes. Nunca lanza.
     */
    public function datos_pdf_render($nombre)
    {
        $vacio = ['pdf' => '', 'grupos' => [], 'fotos' => [], 'mockups' => [], 'preview_omisible' => false];
        try {
            $nombre = $this->pmu_uploads()->nombre_seguro($nombre, 'ficha_render');
            $vista = $this->vista_grupos($nombre);
            if (!$vista) {
                return $vacio;
            }
            $config = $this->config_de($nombre);
            $repetir = [];
            foreach ((array)($config['placeholders'] ?? []) as $gid => $m) {
                if (is_array($m) && !empty($m['repetir'])) {
                    $repetir[(string)$gid] = true;
                }
            }
            $grupos = [];
            foreach ((array)($vista['grupos'] ?? []) as $g) {
                $grupos[] = [
                    'id' => (string)$g['id'],
                    'w' => (int)$g['w'],
                    'h' => (int)$g['h'],
                    'cont' => isset($g['cont']) ? (int)$g['cont'] : 1,
                    'tipo' => isset($g['default']) && $g['default'] !== '' ? (string)$g['default'] : 'texto',
                    'value' => isset($g['value']) ? (string)$g['value'] : '',
                    'preset' => isset($g['preset']) ? (string)$g['preset'] : '',
                    'settings' => isset($g['config']) ? (string)$g['config'] : '',
                    'repetir' => !empty($repetir[(string)$g['id']]),
                ];
            }
            return [
                'pdf' => $nombre,
                'grupos' => $grupos,
                'fotos' => $this->mockup_fotos_lista($nombre),
                'mockups' => isset($config['mockups']) ? array_values((array)$config['mockups']) : [],
                'preview_omisible' => !empty($config['preview_omisible']),
            ];
        } catch (\Throwable $e) {
            return $vacio;
        }
    }

    /**
     * T013: crea el draft de sesion con los valores del panel y devuelve
     * {sid, item_key, pdfs, mockups[]} al navegador. Anonimo permitido (cookie
     * pmu_sid); el nonce frena CSRF y la capacidad se evalua explicitamente.
     */
    public function handle_vista_previa()
    {
        if (!current_user_can('read')) {
            wp_send_json_error('motor:capacidad:invalida');
        }
        $nonce = (string)($_REQUEST['_wpnonce'] ?? '');
        if (!wp_verify_nonce($nonce, 'personalizador_pdf_vista_previa')) {
            wp_send_json_error('motor:nonce:invalido');
        }
        // Spec 005 (FR-1.3): la ficha resuelve la LISTA de PDFs del producto y el
        // navegador declara los elegibles; el servidor los sanea (T003) sin
        // evaluar la validez (Const. III).
        $producto = isset($_POST['producto']) ? (int)$_POST['producto'] : 0;
        $pdf = isset($_POST['pdf']) ? sanitize_file_name(wp_unslash((string)$_POST['pdf'])) : '';
        $declarados = null;
        $descartados = [];
        if ($producto > 0) {
            $panel = $this->panel_producto($producto);
            if (!$panel) {
                wp_send_json_error('motor:panel:no_disponible');
            }
            $declarados = $this->pdfs_declarados();
            $descartados = [];
            if ($declarados === null) {
                // Sin declaración (cliente antiguo o shortcode): comportamiento 004.
                $pdfs = [];
                foreach ($panel['pdfs'] as $asoc) {
                    $pdfs[] = (string)$asoc['pdf'];
                }
            } else {
                // Con declaración—even vacía— el servidor decide el snapshot.
                $snapshot = $this->sanear_pdfs_declarados($producto, $declarados);
                $pdfs = $snapshot['pdfs'];
                $descartados = $snapshot['descartados'];
                if (!$pdfs) {
                    wp_send_json_error('motor:sesion:snapshot:vacio');
                }
            }
            $camposPanel = $panel['campos'];
        } else {
            $panel = $this->panel_ficha($pdf);
            if (!$panel) {
                wp_send_json_error('motor:panel:no_disponible');
            }
            $pdfs = [$panel['pdf']];
            $camposPanel = $panel['campos'];
        }
        $crudos = isset($_POST['valores']) ? $_POST['valores'] : [];
        if (is_string($crudos)) {
            $crudos = json_decode(wp_unslash($crudos), true);
        }
        $valores = $this->valores_sanitizados($crudos, $camposPanel);
        $edicion = false;
        try {
            $sesion = $this->sesion();
            $sid = $sesion->sid_actual();
            // T016 (re-edicion): con `item_key` vigente se REUSA el item (mismo
            // item_key, mismos PNG del pool) y solo se refrescan los valores; sin
            // el, se crea el borrador habitual.
            $previo = isset($_POST['item_key']) ? sanitize_text_field(wp_unslash((string)$_POST['item_key'])) : '';
            $manifest = $previo !== '' ? $sesion->leer_manifest($sid, $previo) : null;
            $enItem = is_array($manifest) ? array_map('strval', (array)($manifest['pdfs'] ?? [])) : [];
            $panelPdf = [];
            if ($producto > 0) {
                foreach ((array)($panel['pdfs'] ?? []) as $asocPdf) {
                    $panelPdf[] = (string)($asocPdf['pdf'] ?? '');
                }
                $reutilizable = (bool)array_intersect($enItem, $panelPdf);
            } else {
                $pdfUno = $this->pmu_uploads()->nombre_seguro($pdf, 'panel');
                $reutilizable = in_array($pdfUno, $enItem, true);
            }
            if (is_array($manifest) && $enItem && $reutilizable) {
                $item = (string)$manifest['item_key'];
                $manifest['valores'] = $valores ? $valores : new \stdClass();
                // Spec 005 (D7): el snapshot del item se REEMPLAZA (nunca se
                // fusiona con el anterior) por los elegibles de esta edicion.
                $manifest['pdfs'] = array_values($pdfs);
                $manifest['pdfs_descartados'] = array_values($descartados);
                // Re-editar invalida el visto bueno anterior: el estado vuelve a
                // sin_vista hasta que se regenere el pool (o queda omisible).
                $manifest['preview_estado'] = $manifest['preview_estado'] === PMU_Sesion::ESTADO_OMISIBLE
                    ? PMU_Sesion::ESTADO_OMISIBLE : PMU_Sesion::ESTADO_SIN_VISTA;
                $sesion->guardar_manifest($sid, $item, $manifest);
                // El snapshot sustituye al anterior también para el pool: no
                // quedan PNG de un PDF que ya no aplica en este item.
                $sesion->pool_filtrar_pdfs($sid, $item, $pdfs);
                $edicion = true;
            } else {
                $item = $sesion->crear_draft($sid, $pdfs);
                $manifest = $sesion->leer_manifest($sid, $item);
                if (is_array($manifest)) {
                    $manifest['valores'] = $valores ? $valores : new \stdClass();
                    $manifest['pdfs_descartados'] = array_values($descartados);
                    $sesion->guardar_manifest($sid, $item, $manifest);
                }
            }
            $manifest = $sesion->leer_manifest($sid, $item);
        } catch (\Throwable $e) {
            wp_send_json_error($e->getMessage());
        }
        $render = [];
        foreach ($pdfs as $uno) {
            $render[] = $this->datos_pdf_render($uno);
        }
        wp_send_json_success([
            'sid' => $sid,
            'item_key' => $item,
            'edicion' => $edicion,
            'elegibles' => array_values($pdfs),
            'descartados' => array_values($descartados),
            'pdfs' => $render,
            // Render parcial (T016): hashes ya generados + URL del pool para
            // recomponer los mockups sin volver a subir lo que no cambio.
            'archivos' => is_array($manifest) ? array_values((array)($manifest['archivos'] ?? [])) : [],
            'pool_url' => $this->pmu_uploads()->url_sesion_item($sid, $item),
        ]);
    }

    /**
     * Snapshot del item (spec 005, T009/D7): sanea lo declarado por el navegador
     * (asociado + activo, sin duplicados) y, sin declaracion, usa los PDFs
     * activos del producto (comportamiento 004 intacto). Devuelve
     * ['pdfs' => aceptados, 'descartados' => auditoria].
     */
    private function snapshot_item($product_id, array $panel)
    {
        $declarados = $this->pdfs_declarados();
        if ($declarados !== null) {
            return $this->sanear_pdfs_declarados($product_id, $declarados);
        }
        $pdfs = [];
        foreach ($panel['pdfs'] as $asoc) {
            $pdfs[] = (string)$asoc['pdf'];
        }
        return ['pdfs' => $pdfs, 'descartados' => []];
    }

    /**
     * Sanea los PDFs declarados por el navegador (spec 005 T003): intersecta
     * con la asociacion al producto (`_pmu_pdf_slugs` + espejo) y con
     * `tienda{pid}.activo !== false`; sin duplicados en ninguno de los dos
     * conjuntos (un aceptado NUNCA aparece en descartados; un declarado no
     * saneable se audita crudo y acotado). PHP nunca evalua la expresion
     * `validez` (Const. III): solo pertenencia. Devuelve
     * ['pdfs' => aceptados, 'descartados' => resto] para el snapshot.
     */
    public function sanear_pdfs_declarados($product_id, array $declarados)
    {
        $product_id = (int)$product_id;
        $asociados = $this->producto_pdf_slugs($product_id);
        $pdfs = [];
        $descartados = [];
        $anota = function ($n) use (&$descartados) {
            if (!in_array($n, $descartados, true)) {
                $descartados[] = $n;
            }
        };
        foreach ($declarados as $d) {
            try {
                $nombre = $this->pmu_uploads()->nombre_seguro((string)$d, 'snapshot');
            } catch (\Throwable $e) {
                // Declarado no saneable: se audita crudo (acotado), nunca se acepta.
                $crudo = substr(trim((string)$d), 0, 64);
                if ($crudo !== '') {
                    $anota($crudo);
                }
                continue;
            }
            if (!in_array($nombre, $asociados, true)) {
                $anota($nombre);
                continue;
            }
            if (in_array($nombre, $pdfs, true)) {
                continue; // duplicado de un elegible: ya congelado, no se audita
            }
            $tienda = $this->config_de($nombre);
            $conf = isset($tienda['tienda'][(string)$product_id]) && is_array($tienda['tienda'][(string)$product_id])
                ? $tienda['tienda'][(string)$product_id] : ['activo' => true];
            if (array_key_exists('activo', $conf) && empty($conf['activo'])) {
                $anota($nombre);
                continue;
            }
            $pdfs[] = $nombre;
        }
        return ['pdfs' => $pdfs, 'descartados' => $descartados];
    }

    /** El PDF admite compra sin vistas (`preview_omisible`, US3). */
    private static function omisible_ok($config)
    {
        return !empty($config['preview_omisible']);
    }

    /**
     * T014: recibe los PNG del pool renderizados en el navegador (RenderCore)
     * y los guarda con PMU_Sesion::guardar_png() (pool dedicado del item).
     * Anonimo permitido; nonce de la vista previa. Con `limpiar=1` reemplaza
     * los PNG previos del grupo (regeneracion idempotente, nunca duplicados).
     */
    public function handle_pool_png()
    {
        if (!current_user_can('read')) {
            wp_send_json_error('motor:capacidad:invalida');
        }
        $nonce = (string)($_REQUEST['_wpnonce'] ?? '');
        if (!wp_verify_nonce($nonce, 'personalizador_pdf_vista_previa')) {
            wp_send_json_error('motor:nonce:invalido');
        }
        try {
            $sesion = $this->sesion();
            $motor = $this->pmu_uploads();
            $sid = sanitize_text_field(wp_unslash((string)($_POST['sid'] ?? '')));
            $item = sanitize_text_field(wp_unslash((string)($_POST['item_key'] ?? '')));
            $pdf = sanitize_file_name(wp_unslash((string)($_POST['pdf'] ?? '')));
            $grupo = strtoupper(sanitize_text_field(wp_unslash((string)($_POST['grupo'] ?? ''))));
            $manifest = $sesion->leer_manifest($sid, $item);
            if (!is_array($manifest)
                || ($manifest['item_key'] ?? '') !== $item
                || !in_array($motor->nombre_seguro($pdf, 'pool'), array_map('strval', (array)($manifest['pdfs'] ?? [])), true)) {
                throw new \RuntimeException('motor:sesion:item:ausente');
            }
            $pdf = $motor->nombre_seguro($pdf, 'pool');
            $valido = false;
            foreach ((array)($this->analisis_de($pdf)['grupos'] ?? []) as $g) {
                if (isset($g['id']) && strtoupper((string)$g['id']) === $grupo) {
                    $valido = true;
                    break;
                }
            }
            if (!$valido || !preg_match('/^[0-9A-F]{6}$/', $grupo)) {
                throw new \RuntimeException('motor:pool:grupo:invalido');
            }
            $bytes = '';
            if (isset($_FILES['png']) && is_array($_FILES['png']) && !empty($_FILES['png']['tmp_name'])) {
                if ((int)$_FILES['png']['size'] > 8388608) {
                    throw new \RuntimeException('motor:pool:png:tamano');
                }
                $bytes = (string)@file_get_contents((string)$_FILES['png']['tmp_name']);
            } elseif (isset($_POST['png_data'])) {
                $dataurl = (string)wp_unslash($_POST['png_data']);
                $coma = strpos($dataurl, ',');
                if ($coma !== false) {
                    $bin = base64_decode(substr($dataurl, $coma + 1), true);
                    $bytes = is_string($bin) ? $bin : '';
                }
            }
            if (substr($bytes, 0, 8) !== "\x89PNG\r\n\x1a\n") {
                throw new \RuntimeException('motor:pool:png:invalido');
            }
            if (!empty($_POST['limpiar'])) {
                $sesion->limpiar_grupo($sid, $item, $pdf, $grupo);
            }
            $hash = sha1((string)($_POST['valor'] ?? '') . '|' . (string)($_POST['preset'] ?? '') . '|' . (string)($_POST['settings'] ?? '') . '|' . (int)($_POST['w'] ?? 0) . 'x' . (int)($_POST['h'] ?? 0));
            $fila = $sesion->guardar_png($sid, $item, $pdf, $grupo, $bytes, $hash);
        } catch (\Throwable $e) {
            wp_send_json_error($e->getMessage());
        }
        wp_send_json_success($fila);
    }

    /**
     * T015: valida el add-to-cart de un producto vinculado: exige draft vigente
     * (pmu_sid + pmu_item_key con manifest del mismo PDF y previews ok/omisible).
     * Sin Woo o sin vinculacion no interviene (devuelve $valido sin tocar nada).
     */
    public function carrito_validar($valido, $product_id, $cantidad, $variacion = 0)
    {
        if (!$valido || !function_exists('wc_get_product')) {
            return $valido;
        }
        // Spec 005 (FR-1.3): el producto tiene LISTA de PDFs; sin ninguno
        // ofrecible el handler no interviene (004 intacto).
        $panelProducto = $this->panel_producto($product_id);
        if (!$panelProducto) {
            return $valido;
        }
        $pdf = (string)$panelProducto['pdfs'][0]['pdf'];
        $sid = isset($_POST['pmu_sid']) ? sanitize_text_field(wp_unslash((string)$_POST['pmu_sid'])) : '';
        $item = isset($_POST['pmu_item_key']) ? sanitize_text_field(wp_unslash((string)$_POST['pmu_item_key'])) : '';
        if ($sid === '' || $item === '') {
            // US3 (T018/T019): sin draft previo y TODOS los PDFs son omisibles,
            // se crea el item con estado omisible y los valores del panel.
            if (!empty($panelProducto['preview_omisible'])) {
                try {
                    $sesion = $this->sesion();
                    $sid = $sesion->sid_actual();
                    // Spec 005 (T009): snapshot saneado desde el POST (o los PDFs
                    // activos del producto cuando el navegador no declara nada).
                    $snapshot = $this->snapshot_item($product_id, $panelProducto);
                    if (!$snapshot['pdfs']) {
                        throw new \RuntimeException('motor:sesion:snapshot:vacio');
                    }
                    $item = $sesion->crear_draft($sid, $snapshot['pdfs']);
                    $manifest = $sesion->leer_manifest($sid, $item);
                    if (is_array($manifest)) {
                        $crudos = isset($_POST['pmu_valores']) ? json_decode(wp_unslash((string)$_POST['pmu_valores']), true) : [];
                        $manifest['valores'] = $this->valores_sanitizados($crudos, $panelProducto['campos'])
                            ?: new \stdClass();
                        $manifest['preview_estado'] = PMU_Sesion::ESTADO_OMISIBLE;
                        $manifest['pdfs_descartados'] = $snapshot['descartados'];
                        $sesion->guardar_manifest($sid, $item, $manifest);
                    }
                    $_POST['pmu_sid'] = $sid;
                    $_POST['pmu_item_key'] = $item;
                    $this->item_draft_valido = ['sid' => $sid, 'item_key' => $item];
                    return true;
                } catch (\Throwable $e) {
                    // cae al aviso habitual (nunca bloquea por error de datos)
                }
            }
            if (function_exists('wc_add_notice')) {
                wc_add_notice('Completa tu personalizacion y genera la vista previa antes de agregar al carrito.', 'error');
            }
            return false;
        }
        try {
            $sesion = $this->sesion();
            $manifest = $sesion->leer_manifest($sid, $item);
            $delProducto = [];
            foreach ($panelProducto['pdfs'] as $asoc) {
                $delProducto[] = (string)$asoc['pdf'];
            }
            $enItem = is_array($manifest) ? array_map('strval', (array)($manifest['pdfs'] ?? [])) : [];
            if (empty($enItem) || !array_intersect($enItem, $delProducto)) {
                throw new \RuntimeException('motor:sesion:item:ausente');
            }
            $estado = $sesion->estado_preview($sid, $item);
            if ($estado !== PMU_Sesion::ESTADO_OK && $estado !== PMU_Sesion::ESTADO_OMISIBLE) {
                throw new \RuntimeException('motor:sesion:preview:' . $estado);
            }
            // Spec 005 (T009/D7): con declaracion del navegador el snapshot se
            // REEMPLAZA (nunca se fusiona con el anterior).
            $declarados = $this->pdfs_declarados();
            if ($declarados !== null) {
                $snapshot = $this->sanear_pdfs_declarados($product_id, $declarados);
                if (!$snapshot['pdfs']) {
                    throw new \RuntimeException('motor:sesion:snapshot:vacio');
                }
                $manifest['pdfs'] = $snapshot['pdfs'];
                $manifest['pdfs_descartados'] = $snapshot['descartados'];
                $sesion->guardar_manifest($sid, $item, $manifest);
                $sesion->pool_filtrar_pdfs($sid, $item, $snapshot['pdfs']);
            }
            $this->item_draft_valido = ['sid' => $sid, 'item_key' => $item];
        } catch (\Throwable $e) {
            if (function_exists('wc_add_notice') && strpos($e->getMessage(), 'motor:sesion:item:ausente') === false) {
                wc_add_notice('Tu personalizacion ya no es valida: genera la vista previa nuevamente.', 'error');
            }
            return false;
        }
        return true;
    }

    /**
     * T015: meta canonica del item (solo si la validacion encontro el draft
     * vigente): sid/item_key/unique_key (uuid, evita fusion de lineas Woo).
     */
    public function carrito_agregar($datos, $product_id, $variacion, $cantidad)
    {
        // Con Woo, la validacion detecta el draft; sin Woo (shortcode/manuales),
        // el draft viaja por el POST (mismo contrato).
        $sid = (string)(!empty($this->item_draft_valido['sid']) ? $this->item_draft_valido['sid'] : (isset($_POST['pmu_sid']) ? sanitize_text_field(wp_unslash((string)$_POST['pmu_sid'])) : ''));
        $item = (string)(!empty($this->item_draft_valido['item_key']) ? $this->item_draft_valido['item_key'] : (isset($_POST['pmu_item_key']) ? sanitize_text_field(wp_unslash((string)$_POST['pmu_item_key'])) : ''));
        if ($sid === '' || $item === '' || !is_array($datos)) {
            return $datos;
        }
        $datos['pmu_sid'] = $sid;
        $datos['pmu_item_key'] = $item;
        $datos['unique_key'] = $this->sesion_uuid_publico();
        return $datos;
    }

    /* ==================== Pedido y descarga (spec 004, T022/T023) ==================== */

    /**
     * T022: al crearse el pedido se copia la meta del item y se hace el staging
     * (`tmp/orders/{order_id}/{item_key}/`). Fail-safe: nunca tumba el checkout.
     */
    public function pedido_item_crear($item, $clave, $values, $order = null)
    {
        if (empty($values['pmu_sid']) || empty($values['pmu_item_key']) || !is_object($item)) {
            return;
        }
        $sid = (string)$values['pmu_sid'];
        $itemKey = (string)$values['pmu_item_key'];
        $item->add_meta_data('_pmu_sid', $sid);
        $item->add_meta_data('_pmu_item_key', $itemKey);
        try {
            $sesion = $this->sesion();
            $manifest = $sesion->leer_manifest($sid, $itemKey);
            $estado = $sesion->estado_preview($sid, $itemKey);
            $item->add_meta_data('_pmu_preview_estado', $estado);
            $item->add_meta_data('_pmu_valores', wp_json_encode((array)($manifest['valores'] ?? [])));
            $item->add_meta_data('_pmu_pdfs', wp_json_encode(array_values((array)($manifest['pdfs'] ?? []))));
            // Spec 005 (T009/T022): auditoria de lo declarado y no aceptado.
            $item->add_meta_data('_pmu_pdfs_descartados', wp_json_encode(array_values((array)($manifest['pdfs_descartados'] ?? []))));
            if ($order && method_exists($order, 'get_id')) {
                $pendientes = (array)$order->get_meta('_pmu_items');
                $pendientes[$itemKey] = $estado === PMU_Sesion::ESTADO_OK ? 'ok' : 'pendiente';
                $order->update_meta_data('_pmu_items', $pendientes);
                $sesion->staging_order((int)$order->get_id(), $itemKey, $sid);
            }
        } catch (\Throwable $e) {
            // Sin staging/estado el item se regenera al descargar (T023).
        }
    }

    /**
     * T022: al confirmarse el pago, los items del pedido pasan de staging a
     * entregable (`orders/{order_id}/{item_key}/` por rename). Idempotente y
     * reintentable en cada cambio de estado.
     */
    public function pedido_promover($order_id)
    {
        if (!function_exists('wc_get_order')) {
            return;
        }
        $order = wc_get_order($order_id);
        if (!$order || !method_exists($order, 'get_meta')) {
            return;
        }
        $items = (array)$order->get_meta('_pmu_items');
        if (!$items) {
            return;
        }
        $sesion = $this->sesion();
        $cambios = false;
        foreach ($items as $itemKey => $estado) {
            if ($estado === 'entregado') {
                continue;
            }
            try {
                $sesion->promover_order((int)$order_id, (string)$itemKey);
                $items[$itemKey] = 'entregado';
                $cambios = true;
            } catch (\Throwable $e) {
                // Queda pendiente: se reintenta en el proximo cambio de estado.
            }
        }
        if ($cambios) {
            $order->update_meta_data('_pmu_items', $items);
            if (method_exists($order, 'save')) {
                $order->save();
            }
        }
    }

    /** Manifest canonico de un item entregado o aun en staging. */
    private function manifest_item($order_id, $item_key)
    {
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            return null;
        }
        $motor = $this->pmu_uploads();
        $item_key = $motor->item_seguro($item_key, 'item_manifest');
        $dir = $motor->dir_ambito('orders') . DIRECTORY_SEPARATOR . $order_id . DIRECTORY_SEPARATOR . $item_key;
        if (!is_dir($dir)) {
            $dir = $motor->dir_tmp_order($order_id) . DIRECTORY_SEPARATOR . $item_key;
        }
        if (!is_dir($dir)) {
            return null;
        }
        $manifest = json_decode((string)@file_get_contents($dir . DIRECTORY_SEPARATOR . 'manifest.json'), true);
        return is_array($manifest) ? $manifest : null;
    }


    /**
     * T023: cada item personalizado aparece como fila de descarga en
     * `mi-cuenta/descargas/` (PDF final; se genera al pedirlo si falta).
     */
    public function descargas_cliente($productos)
    {
        if (!is_array($productos) || !$productos || !function_exists('wc_get_order')) {
            return $productos;
        }
        $agregadas = [];
        $vistos = [];
        foreach ($productos as $fila) {
            $oid = isset($fila['order_id']) ? (int)$fila['order_id'] : 0;
            if ($oid < 1 || isset($vistos[$oid])) {
                continue;
            }
            $vistos[$oid] = true;
            $order = wc_get_order($oid);
            if (!$order || !method_exists($order, 'get_meta')) {
                continue;
            }
            $itemsPedido = (array)$order->get_meta('_pmu_items');
            foreach ($itemsPedido as $itemKey => $estado) {
                try {
                    $manifest = $this->manifest_item($oid, (string)$itemKey);
                    $pdfs = is_array($manifest) ? array_values((array)($manifest['pdfs'] ?? [])) : [];
                } catch (\Throwable $e) {
                    continue;
                }
                foreach ($pdfs as $pdf) {
                    $pdf = $this->pmu_uploads()->nombre_seguro((string)$pdf, 'descarga');
                    $agregadas[] = [
                        'download_url' => add_query_arg([
                            'action' => 'personalizador_pdf_item_descargar',
                            'order_id' => $oid,
                            'item_key' => (string)$itemKey,
                            'pdf' => $pdf,
                            'clave' => method_exists($order, 'get_order_key') ? (string)$order->get_order_key() : '',
                        ], admin_url('admin-post.php')),
                        'download_id' => 'pmu-' . $oid . '-' . $itemKey . '-' . $pdf,
                        'product_id' => isset($fila['product_id']) ? (int)$fila['product_id'] : 0,
                        'product_name' => isset($fila['product_name']) ? (string)$fila['product_name'] : 'Personalizado',
                        'download_name' => 'Diseno personalizado - ' . $pdf . '.pdf',
                        'order_id' => $oid,
                        'order_key' => isset($fila['order_key']) ? (string)$fila['order_key'] : '',
                        'downloads_remaining' => '',
                        'access_expires' => null,
                        'file' => '',
                    ];
                }
            }
        }
        return array_merge($productos, $agregadas);
    }

    /**
     * T023: entrega el PDF final del item (idempotente): si ya existe lo sirve;
     * si falta, lo genera con `Motor::procesar_pedido()` desde el pool del item.
     * Autorizado por dueno del pedido o por `order_key` (invitado).
     */
    public function handle_item_descargar()
    {
        if (!function_exists('wc_get_order')) {
            wp_die('WooCommerce no esta activo.');
        }
        $order_id = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
        $itemKey = isset($_GET['item_key']) ? sanitize_text_field(wp_unslash((string)$_GET['item_key'])) : '';
        $pdfSolicitado = isset($_GET['pdf']) ? sanitize_text_field(wp_unslash((string)$_GET['pdf'])) : '';
        $clave = isset($_GET['clave']) ? sanitize_text_field(wp_unslash((string)$_GET['clave'])) : '';
        $order = $order_id > 0 ? wc_get_order($order_id) : null;
        if (!$order || $itemKey === '') {
            wp_die('Descarga no disponible.');
        }
        $itemsPedido = method_exists($order, 'get_meta') ? (array)$order->get_meta('_pmu_items') : [];
        if (!array_key_exists($itemKey, $itemsPedido)) {
            wp_die('Descarga no disponible.');
        }
        $uid = function_exists('get_current_user_id') ? (int)get_current_user_id() : 0;
        $dueno = $uid > 0 && method_exists($order, 'get_customer_id') && (int)$order->get_customer_id() === $uid;
        $porClave = $clave !== '' && method_exists($order, 'get_order_key')
            && hash_equals((string)$order->get_order_key(), $clave);
        // T025: el admin de la consola tambien puede descargar el entregable.
        $esAdmin = function_exists('current_user_can') && current_user_can('manage_options');
        if (!$dueno && !$porClave && !$esAdmin) {
            wp_die('Permiso denegado');
        }
        try {
            $ruta = $this->item_generar_pdf($order_id, $itemKey, $pdfSolicitado);
        } catch (\Throwable $e) {
            wp_die('No se pudo preparar la descarga: ' . esc_html($e->getMessage()));
        }
        nocache_headers();
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . basename($ruta) . '"');
        header('Content-Length: ' . (string)filesize($ruta));
        readfile($ruta);
        exit;
    }

    /**
     * Genera (o reusa) todos los PDFs finales del item desde `manifest.pdfs[]`.
     * `manifest.archivos[]` es el indice explicito y cada PDF usa únicamente sus
     * propias filas; nunca se aceptan filas de un PDF descartado.
     *
     * @return array<string,string> mapa pdf => ruta final
     */
    public function item_generar_pdfs($order_id, $item_key)
    {
        $order_id = (int)$order_id;
        $motor = $this->pmu_uploads();
        $item_key = $motor->item_seguro($item_key, 'item_descarga');
        $dir = $motor->dir_ambito('orders') . DIRECTORY_SEPARATOR . $order_id . DIRECTORY_SEPARATOR . $item_key;
        if (!is_dir($dir)) {
            $dir = $motor->dir_tmp_order($order_id) . DIRECTORY_SEPARATOR . $item_key;
        }
        if (!is_dir($dir)) {
            throw new \RuntimeException('motor:descarga:item:ausente');
        }
        $manifest = json_decode((string)@file_get_contents($dir . DIRECTORY_SEPARATOR . 'manifest.json'), true);
        if (!is_array($manifest) || empty($manifest['pdfs']) || !is_array($manifest['pdfs'])) {
            throw new \RuntimeException('motor:descarga:manifest:invalido');
        }
        $rutas = [];
        foreach (array_values($manifest['pdfs']) as $pdf) {
            $pdf = $motor->nombre_seguro((string)$pdf, 'item_descarga');
            $salida = $dir . DIRECTORY_SEPARATOR . $pdf . '_procesado.pdf';
            if (!is_file($salida)) {
                $mapa = [];
                foreach ((array)($manifest['archivos'] ?? []) as $fila) {
                    if (!is_array($fila) || (string)($fila['pdf'] ?? '') !== $pdf || empty($fila['file'])) {
                        continue;
                    }
                    $gid = strtoupper((string)($fila['grupo_id'] ?? ''));
                    $ruta = $dir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string)$fila['file']);
                    if ($gid === '' || isset($mapa[$gid]) || !is_file($ruta)) {
                        continue;
                    }
                    $mapa[$gid] = $ruta;
                }
                if (!$mapa) {
                    throw new \RuntimeException('motor:descarga:pool:vacio:' . $pdf);
                }
                $resultado = Motor::procesar_pedido($motor->ruta_pdf($pdf), $mapa);
                if (@file_put_contents($salida, $resultado['bytes']) === false) {
                    throw new \RuntimeException('motor:descarga:pdf:no_escribible:' . $pdf);
                }
            }
            $rutas[$pdf] = $salida;
        }
        return $rutas;
    }

    /** Genera/reusa un PDF concreto; si no se indica, conserva el primer PDF. */
    public function item_generar_pdf($order_id, $item_key, $pdf = '')
    {
        $rutas = $this->item_generar_pdfs($order_id, $item_key);
        if ($pdf !== '') {
            $pdf = $this->pmu_uploads()->nombre_seguro((string)$pdf, 'item_descarga');
            if (!isset($rutas[$pdf])) {
                throw new \RuntimeException('motor:descarga:pdf:fuera-snapshot:' . $pdf);
            }
            return $rutas[$pdf];
        }
        $primera = reset($rutas);
        if (!is_string($primera) || $primera === '') {
            throw new \RuntimeException('motor:descarga:manifest:invalido');
        }
        return $primera;
    }

    /**
     * T025: inventario de pedidos completados (`orders/{order_id}/{item_key}/`)
     * para la consola: estado, etiquetas cliente (solo lectura), webps y salida.
     * Lectura tolerante: un item roto se lista con su causa, sin tumbar la seccion.
     */
    public function pedidos_completados()
    {
        $out = [];
        try {
            $raiz = $this->pmu_uploads()->dir_ambito('orders');
        } catch (\Throwable $e) {
            return $out;
        }
        foreach ((array)glob($raiz . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $dirOrder) {
            $order_id = (int)basename($dirOrder);
            if ($order_id < 1) {
                continue;
            }
            foreach ((array)glob($dirOrder . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $dirItem) {
                $item = basename($dirItem);
                $manifest = json_decode((string)@file_get_contents($dirItem . DIRECTORY_SEPARATOR . 'manifest.json'), true);
                $valores = [];
                foreach ((array)($manifest['valores'] ?? []) as $cid => $par) {
                    $campo = $this->campo_por_id((int)$cid);
                    $valores[] = [
                        'titulo' => is_array($campo) && $campo[1] !== '' ? $campo[1] : ('Campo ' . (int)$cid),
                        'cliente' => (string)($par['cliente'] ?? ''),
                    ];
                }
                $salida = '';
                foreach ((array)glob($dirItem . DIRECTORY_SEPARATOR . '*_procesado.pdf') as $pdfOut) {
                    $salida = basename($pdfOut);
                }
                $out[] = [
                    'order_id' => $order_id,
                    'item_key' => $item,
                    'estado' => is_array($manifest) ? (string)($manifest['preview_estado'] ?? 'sin_vista') : 'motor:descarga:manifest:invalido',
                    'pdfs' => is_array($manifest) ? array_values((array)($manifest['pdfs'] ?? [])) : [],
                    // Spec 005 (T010): auditoria de lo declarado y no aceptado.
                    'descartados' => is_array($manifest) ? array_values((array)($manifest['pdfs_descartados'] ?? [])) : [],
                    'archivos' => is_array($manifest) ? count((array)($manifest['archivos'] ?? [])) : 0,
                    'webps' => count((array)glob($dirItem . DIRECTORY_SEPARATOR . 'mockup-*.webp')),
                    'valores' => $valores,
                    'salida' => $salida,
                ];
            }
        }
        usort($out, function ($a, $b) {
            $peso = function ($r) { return ($r['estado'] ?? '') === 'sin_vista' ? 0 : 1; };
            return [$peso($b), $b['order_id']] <=> [$peso($a), $a['order_id']];
        });
        return $out;
    }

    /**
     * T026: regenera el PDF final del item desde el pool vigente (idempotente:
     * borra la salida previa y la rearma con `item_generar_pdf`). Solo admin.
     */
    public function handle_item_regenerar()
    {
        $this->seguridad('personalizador_pdf_item_regenerar');
        $order_id = isset($_POST['order_id']) ? (int)$_POST['order_id'] : 0;
        $item = isset($_POST['item_key']) ? $this->pmu_uploads()->item_seguro((string)$_POST['item_key'], 'item_regenerar') : '';
        try {
            $motor = $this->pmu_uploads();
            $dir = $motor->dir_ambito('orders') . DIRECTORY_SEPARATOR . $order_id . DIRECTORY_SEPARATOR . $item;
            if ($order_id < 1 || $item === '' || !is_dir($dir)) {
                throw new \RuntimeException('motor:regenerar:item:ausente');
            }
            foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*_procesado.pdf') as $previo) {
                @unlink($previo);
            }
            $this->item_generar_pdfs($order_id, $item);
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_tab' => 'pdfs']);
        }
        $this->redirigir(['ec_regenerado' => 1, 'ec_tab' => 'pdfs']);
    }

    /** UUID v4 para unique_key (sin depender del uuid privado de PMU_Sesion). */
    private function sesion_uuid_publico()
    {
        $datos = function_exists('random_bytes') ? random_bytes(16) : openssl_random_pseudo_bytes(16);
        $datos[6] = chr((ord($datos[6]) & 0x0f) | 0x40);
        $datos[8] = chr((ord($datos[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($datos), 4));
    }

    /**
     * T015: promocion del draft a linea del carrito (rename a {cart_item_key},
     * mismo sid) + congelado de las vistas aprobadas (mockup-{id}.webp 300x300,
     * webp que envia el cliente al agregar). Fail-safe: nunca tumba la compra.
     */
    public function carrito_promover($item_key, $product_id, $cantidad, $variacion = 0, $variacion2 = null)
    {
        $sid = isset($_POST['pmu_sid']) ? sanitize_text_field(wp_unslash((string)$_POST['pmu_sid'])) : '';
        $draft = isset($_POST['pmu_item_key']) ? sanitize_text_field(wp_unslash((string)$_POST['pmu_item_key'])) : '';
        if ($sid === '' || $draft === '') {
            return;
        }
        try {
            $sesion = $this->sesion();
            $sesion->promover($sid, $draft, $item_key);
            // Congelar vistas aprobadas: el cliente envia {mockup_id: webp dataURL}
            // (lo que vio y aprobo en la galeria). Sin vistas validas el estado
            // queda sin_vista (venta habilitada, reintento al descargar).
            $mockups = isset($_POST['pmu_mockups']) ? json_decode(wp_unslash((string)$_POST['pmu_mockups']), true) : [];
            $congelados = 0;
            foreach ((array)$mockups as $mid => $dataurl) {
                $bytes = $this->dataurl_bytes((string)$dataurl);
                if ($bytes === '' || substr($bytes, 0, 4) !== 'RIFF' || strpos($bytes, 'WEBP') !== 8) {
                    continue; // solo webp real (contrato congelar_webp)
                }
                try {
                    $sesion->congelar_webp($sid, $item_key, (string)$mid, $bytes);
                    $congelados++;
                } catch (\Throwable $e) {
                    continue;
                }
            }
            if ($congelados > 0) {
                $manifest = $sesion->leer_manifest($sid, $item_key);
                if (is_array($manifest)) {
                    $manifest['preview_estado'] = PMU_Sesion::ESTADO_OK;
                    $sesion->guardar_manifest($sid, $item_key, $manifest);
                }
            }
        } catch (\Throwable $e) {
            // La linea queda con meta; estado_preview() del manifest manda al descargar.
        }
    }

    /** Decodifica un dataURL a bytes crudos ('' si no es data: valido). */
    private function dataurl_bytes($dataurl)
    {
        if (strpos((string)$dataurl, 'data:image/') !== 0) {
            return '';
        }
        $coma = strpos((string)$dataurl, ',');
        if ($coma === false) {
            return '';
        }
        $bin = base64_decode(substr((string)$dataurl, $coma + 1), true);
        return is_string($bin) ? $bin : '';
    }

    /**
     * T016 (re-edicion): link "Editar" en el carrito que vuelve a la ficha con
     * el `item_key` cargado (misma carpeta; el pool se reusa).
     */
    public function carrito_enlace_edicion($nombre, $item, $clave = '')
    {
        if (empty($item['pmu_item_key']) || empty($item['pmu_sid']) || !function_exists('get_permalink')) {
            return $nombre;
        }
        $pid = isset($item['product_id']) ? (int)$item['product_id'] : 0;
        if ($pid < 1 || $this->producto_pdf_slug($pid) === '') {
            return $nombre;
        }
        $url = add_query_arg(['pmu_item_key' => (string)$item['pmu_item_key']], get_permalink($pid));
        return $nombre . ' <a class="pmu-editar" href="' . esc_url($url) . '">Editar</a>';
    }

    /** T015: etiquetas `cliente` visibles en carrito/checkout (item Woo + espejo). */
    public function carrito_mostrar($datosVisibles, $datosCarrito)
    {
        if (empty($datosCarrito['pmu_item_key']) || empty($datosCarrito['pmu_sid'])) {
            return $datosVisibles;
        }
        $etiquetas = [];
        try {
            $sesion = $this->sesion();
            $manifest = $sesion->leer_manifest((string)$datosCarrito['pmu_sid'], (string)$datosCarrito['pmu_item_key']);
            foreach ((array)($manifest['valores'] ?? []) as $cid => $par) {
                $campo = $this->campo_por_id((int)$cid);
                $titulo = is_array($campo) && $campo[1] !== '' ? $campo[1] : ('Campo ' . (int)$cid);
                $etiquetas[] = ['name' => $titulo, 'value' => sanitize_text_field((string)($par['cliente'] ?? ''))];
            }
        } catch (\Throwable $e) {
            return $datosVisibles;
        }
        return array_merge((array)$datosVisibles, $etiquetas);
    }

    /** T015: al quitar la linea, borrado quirurgico del item de sesion (ex-008). */
    public function carrito_quitar($item_key)
    {
        $cart = function_exists('WC') && WC() ? WC()->cart : null;
        if (!$cart || !method_exists($cart, 'get_cart_item')) {
            return;
        }
        $item = $cart->get_cart_item($item_key);
        if (empty($item['pmu_sid']) || empty($item['pmu_item_key'])) {
            return;
        }
        try {
            $this->sesion()->borrar_item((string)$item['pmu_sid'], (string)$item['pmu_item_key']);
        } catch (\Throwable $e) {
            // Fail-safe: el borrado de datos nunca tumba el flujo del carrito.
        }
    }

    /** T015: cantidad fija 1 en productos vinculados (cada item es un diseno unico). */
    public function cantidad_fija($cantidad, $producto = null)
    {
        if ($producto && function_exists('wc_get_product')) {
            $pid = method_exists($producto, 'get_id') ? (int)$producto->get_id() : 0;
            if ($pid > 0 && $this->producto_pdf_slug($pid) !== '') {
                return 1;
            }
        }
        return $cantidad;
    }

    /**
     * Manifiesto de linea del comprador (T031b): alta/lectura/promocion del
     * ciclo carrito -> pedido. El cableado a hooks Woo vive en spec 004.
     *
     * Estructura: tmp/cart/{linea}/manifest.json con pdf, personalizacion
     * canonica, pmu_hash, cantidad, creado y motor (version).
     */
    public function manifest_cart_leer($linea)
    {
        $ruta = $this->pmu_uploads()->manifest_cart($linea);
        if (!is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        return is_array($datos) ? $datos : null;
    }

    /** Alta de linea: crea tmp/cart/{linea}/ + manifest.json (escritura atomica). */
    public function manifest_cart_alta($linea, $pdf, array $personalizacion, $cantidad = 1)
    {
        $motor = $this->pmu_uploads();
        $dir = $motor->dir_tmp_cart($linea, true);
        $canonica = $this->personalizacion_canonica($personalizacion);
        $manifest = [
            'pdf' => $motor->nombre_seguro($pdf, 'manifest_cart_alta'),
            'personalizacion' => $canonica,
            'pmu_hash' => sha1(wp_json_encode($canonica)),
            'cantidad' => max(1, (int)$cantidad),
            'creado' => gmdate('Y-m-d\\TH:i:s\\Z'),
            'motor' => PERSONALIZADOR_PDF_VERSION,
        ];
        $tmp = $dir . DIRECTORY_SEPARATOR . 'manifest.json.tmp';
        file_put_contents($tmp, wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        rename($tmp, $motor->manifest_cart($linea));
        return $manifest;
    }

    /** Forma canonica de la personalizacion: orden estable para pmu_hash. */
    private function personalizacion_canonica(array $personalizacion)
    {
        $canonica = [];
        foreach ($personalizacion as $id => $entrada) {
            $id = strtoupper((string)$id);
            if (!preg_match('/^[0-9A-F]{6}$/', $id) || !is_array($entrada)) {
                continue;
            }
            $canonica[$id] = [
                'default' => isset($entrada['default']) ? (string)$entrada['default'] : null,
                'value' => isset($entrada['value']) ? (string)$entrada['value'] : null,
                'preset' => isset($entrada['preset']) ? (string)$entrada['preset'] : null,
                'config' => isset($entrada['config']) ? (string)$entrada['config'] : null,
            ];
        }
        ksort($canonica);
        return $canonica;
    }

    /**
     * Promocion de staging a entregable (T031b): tmp/orders/{order_id}/ pasa a
     * orders/{order_id}/ por rename() atomico. Solo al confirmarse el pago
     * (el cableado al hook vive en spec 004).
     */
    public function orden_promover($order_id)
    {
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            throw new \RuntimeException('Pedido invalido para promover.');
        }
        $motor = $this->pmu_uploads();
        $origen = $motor->dir_tmp_order($order_id);
        if (!is_dir($origen)) {
            throw new \RuntimeException('Sin staging para el pedido ' . $order_id . '.');
        }
        $destino = $motor->dir_ambito('orders', true) . DIRECTORY_SEPARATOR . $order_id;
        if (is_dir($destino) || is_file($destino)) {
            throw new \RuntimeException('El pedido ' . $order_id . ' ya tiene entregable.');
        }
        if (!@rename($origen, $destino)) {
            throw new \RuntimeException('No se pudo promover el pedido ' . $order_id . '.');
        }
        return $destino;
    }

    /** Lee el analisis inmutable de un PDF (plan 008): analisis.json. Devuelve null si no hay geometria valida. */
    private function analisis_de($nombre)
    {
        $motor = $this->pmu_uploads();
        $ruta = $motor->ruta_analisis($nombre);
        $datos = null;
        if (is_file($ruta)) {
            try {
                $datos = Metadata::cargar($ruta);
            } catch (\Throwable $e) {
                $datos = null;
            }
        }
        if (!is_array($datos) || !isset($datos['grupos']) || !is_array($datos['grupos'])) {
            return null;
        }
        foreach ((array)($datos['grupos'] ?? []) as $g) {
            if (!is_array($g) || !Metadata::idValido(isset($g['id']) ? $g['id'] : null)) {
                return null;
            }
        }
        return $datos;
    }

    /** Config editable del PDF (plan 008): config.json via motor (con defaults). */
    private function config_de($nombre)
    {
        try {
            return $this->pmu_uploads()->leer_config($nombre);
        } catch (\Throwable $e) {
            return ['activo' => false, 'productos' => [], 'campos_ids' => [], 'placeholders' => []];
        }
    }

    /**
     * Fusiona analisis (geometria) + config (mapeos) en la vista que usa la
     * consola y el puente: grupos del analisis con default/value/preset/config
     * derivados del mapeo placeholders[id] (tipo/preset/value/settings).
     * Devuelve ['analisis'=>..., 'config'=>..., 'grupos'=>...] o null sin analisis.
     */
    private function vista_grupos($nombre)
    {
        $analisis = $this->analisis_de($nombre);
        if (!$analisis) {
            return null;
        }
        $config = $this->config_de($nombre);
        $mapa = isset($config['placeholders']) && is_array($config['placeholders'])
            ? $config['placeholders'] : [];
        $grupos = [];
        foreach ((array)($analisis['grupos'] ?? []) as $g) {
            $gid = isset($g['id']) ? $g['id'] : '';
            $m = isset($mapa[$gid]) && is_array($mapa[$gid]) ? $mapa[$gid] : null;
            $value = $m !== null && isset($m['value']) ? (string)$m['value'] : null;
            $preset = $m !== null && isset($m['preset']) && $m['preset'] !== '' ? (string)$m['preset'] : null;
            $settings = $m !== null && isset($m['settings']) ? (string)$m['settings'] : null;
            $tipo = $m !== null && isset($m['tipo']) ? (string)$m['tipo'] : null;
            $g['default'] = ($value !== null && $value !== '') || ($preset !== null && $preset !== '') ? ($tipo !== null && $tipo !== '' ? $tipo : 'texto') : null;
            $g['value'] = ($value !== null && $value !== '') ? $value : null;
            $g['preset'] = $preset;
            $g['config'] = ($settings !== null && $settings !== '') ? $settings : null;
            $grupos[] = $g;
        }
        $analisis['grupos'] = $grupos;
        return ['analisis' => $analisis, 'config' => $config, 'grupos' => $grupos];
    }

    /* ==================== Campos reutilizables (spec 004) ==================== */

    /**
     * Normaliza una tupla de campo desde POST: [id, titulo_cliente, tipo,
     * etiquetas[], texto_ayuda, visible, contenido, css, script].
     * Lanza motor:campos:... ante tipo o contenido invalidos.
     */
    private function campo_desde_post(array $fuente, $id = 0)
    {
        $tipos = ['text', 'textarea', 'select', 'img', 'override'];
        $tipo = isset($fuente['tipo']) ? (string)$fuente['tipo'] : '';
        if (!in_array($tipo, $tipos, true)) {
            throw new \RuntimeException('motor:campos:tipo:invalido');
        }
        $titulo = isset($fuente['titulo_cliente']) ? trim(strip_tags((string)$fuente['titulo_cliente'])) : '';
        $ayuda = isset($fuente['texto_ayuda']) ? trim(strip_tags((string)$fuente['texto_ayuda'])) : '';
        $etiquetas = [];
        $crudas = isset($fuente['etiquetas'])
            ? (is_array($fuente['etiquetas']) ? $fuente['etiquetas'] : explode(',', (string)$fuente['etiquetas']))
            : [];
        foreach ($crudas as $e) {
            $e = strtolower(trim(preg_replace('/[^a-z0-9_\-]+/i', '-', (string)$e), '-'));
            if ($e !== '') {
                $etiquetas[] = substr($e, 0, 32);
            }
        }
        $contenido = isset($fuente['contenido']) ? (string)$fuente['contenido'] : '';
        if (preg_match('/<\s*(script|iframe|object|embed|form)\b/i', $contenido)) {
            throw new \RuntimeException('motor:campos:contenido:prohibido');
        }
        if (preg_match('/\bid\s*=\s*["\']/', $contenido)) {
            throw new \RuntimeException('motor:campos:contenido:sin_id');
        }
        foreach (['contenido' => $contenido,
            'css' => isset($fuente['css']) ? (string)$fuente['css'] : '',
            'script' => isset($fuente['script']) ? (string)$fuente['script'] : ''] as $k => $v) {
            if (strlen($v) > 20000) {
                throw new \RuntimeException('motor:campos:' . $k . ':tamano');
            }
        }
        $corta = function ($t, $n) {
            return function_exists('mb_substr') ? mb_substr($t, 0, $n, 'UTF-8') : substr($t, 0, $n);
        };
        $script = isset($fuente['script']) ? (string)$fuente['script'] : '';
        // Sandbox del script (contract campos.md): funcion pura con ctx/root;
        // prohibidos document.getElementById/querySelector, DOMContentLoaded e id=.
        $this->pmu_uploads()->validar_script_campo($script);
        // Tupla de 10 slots: [id, titulo_cliente, tipo, etiquetas[], texto_ayuda,
        // visible, contenido, css, script, array] (spec 004 contract campos.md).
        return [
            (int)$id,
            $corta($titulo, 200),
            $tipo,
            array_values(array_unique($etiquetas)),
            $corta($ayuda, 500),
            empty($fuente['visible']) ? false : true,
            $contenido,
            isset($fuente['css']) ? (string)$fuente['css'] : '',
            $script,
            !empty($fuente['array']) ? true : false,
        ];
    }

    /** Lista de campos activos: id => tupla de 10 slots (tombstones fuera). */
    private function campos_activos()
    {
        $res = $this->pmu_uploads()->campos_catalogo('listar');
        $out = [];
        foreach ($res['cat']['items'] as $t) {
            if (count($t) < 10 || $t[1] === '' || $t[2] === '') {
                continue;
            }
            $out[(int)$t[0]] = $t;
        }
        ksort($out);
        return [$out, $res['aviso']];
    }

    /** Guarda un campo (alta o edicion). Responde JSON o redirige. */
    public function handle_campo_guardar()
    {
        $this->seguridad('personalizador_pdf_campo');
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $ajax = !empty($_POST['ajax']);
        $fallo = function ($mensaje) use ($ajax) {
            if ($ajax) {
                wp_send_json_error($mensaje);
            }
            $this->redirigir(['ec_error' => $mensaje, 'ec_tab' => 'campos']);
        };
        try {
            $tupla = $this->campo_desde_post($_POST, $id);
        } catch (\Throwable $e) {
            $fallo($e->getMessage());
        }
        try {
            if ($id > 0) {
                $this->pmu_uploads()->campo_editar($id, $tupla);
            } else {
                $id = $this->pmu_uploads()->campo_alta($tupla);
            }
        } catch (\Throwable $e) {
            $fallo($e->getMessage());
        }
        if ($ajax) {
            wp_send_json_success(['id' => $id]);
        }
        $this->redirigir(['ec_campo' => $id, 'ec_tab' => 'campos']);
    }

    /** Da de baja un campo (tombstone). Responde JSON o redirige. */
    public function handle_campo_baja()
    {
        $this->seguridad('personalizador_pdf_campo');
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $ajax = !empty($_POST['ajax']);
        try {
            $this->pmu_uploads()->campo_baja($id);
        } catch (\Throwable $e) {
            if ($ajax) {
                wp_send_json_error($e->getMessage());
            }
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_tab' => 'campos']);
        }
        if ($ajax) {
            wp_send_json_success(['id' => $id]);
        }
        $this->redirigir(['ec_campo_baja' => $id, 'ec_tab' => 'campos']);
    }

    /* ==================== Mockups: fotos del admin (spec 004, T007) ==================== */

    /**
     * Sube una foto de mockup del admin: pdfs/{nombre}/mockups/{archivo}.
     * Ambito de datos del producto (sin catalogo). Allowlist de extensiones.
     */
    public function handle_mockup_subir()
    {
        $this->seguridad('personalizador_pdf_mockup_subir');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $fallo = function ($mensaje) use ($archivo) {
            $this->redirigir(['ec_error' => $mensaje, 'ec_pdf' => $archivo]);
        };
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $fallo('pdf_inexistente');
        }
        if (empty($_FILES['foto']) || !is_array($_FILES['foto'])
            || ($_FILES['foto']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $fallo('no_file');
        }
        $file = $_FILES['foto'];
        $nombre = sanitize_file_name((string)$file['name']);
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
            $fallo('formato');
        }
        $dir = $this->pmu_uploads()->dir_mockups($this->nombre_de($archivo), true);
        $base = $this->pmu_uploads()->nombre_seguro(
            pathinfo($nombre, PATHINFO_FILENAME),
            'mockup_subir'
        );
        $destino = $dir . DIRECTORY_SEPARATOR . $base . '.' . $ext;
        $k = 2;
        while (is_file($destino)) {
            $destino = $dir . DIRECTORY_SEPARATOR . $base . '-' . $k++ . '.' . $ext;
        }
        // file_get_contents en vez de move_uploaded_file: el tmp de la subida
        // es legible en CLI (tests) y en WP; evita el chequeo is_uploaded_file.
        $bytes = @file_get_contents((string)$file['tmp_name']);
        if ($bytes === false || $bytes === '' || @file_put_contents($destino, $bytes) === false) {
            $fallo('move');
        }
        $this->redirigir(['ec_mockup_subida' => 1, 'ec_pdf' => $archivo, 'foto' => basename($destino)]);
    }

    /** Borra una foto de mockup del admin (dentro de pdfs/{nombre}/mockups/). */
    public function handle_mockup_borrar()
    {
        $this->seguridad('personalizador_pdf_mockup_borrar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $foto = isset($_POST['foto']) ? basename((string)$_POST['foto']) : '';
        $fallo = function ($mensaje) use ($archivo) {
            $this->redirigir(['ec_error' => $mensaje, 'ec_pdf' => $archivo]);
        };
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || $foto === '') {
            $fallo('datos_invalidos');
        }
        $ruta = $this->pmu_uploads()->ruta_mockup($this->nombre_de($archivo), $foto);
        if (!is_file($ruta) || !@unlink($ruta)) {
            $fallo('foto_inexistente');
        }
        $this->redirigir(['ec_mockup_baja' => 1, 'ec_pdf' => $archivo, 'foto' => $foto]);
    }

    /**
     * Guarda SOLO los mockups (y preview_omisible) del PDF: endpoint propio del
     * editor (action=personalizador_pdf_mockups). Nunca toca activo, productos,
     * campos ni mapeos: guardar_config parte del config vigente y solo pisa las
     * claves que recibe.
     */
    public function handle_mockups_guardar()
    {
        $this->seguridad('personalizador_pdf_mockups');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $ajax = !empty($_POST['ajax']);
        $fallo = function ($mensaje) use ($ajax, $archivo) {
            if ($ajax) {
                wp_send_json_error($mensaje);
            }
            $this->redirigir(['ec_error' => $mensaje, 'ec_pdf' => $archivo]);
        };
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $fallo('datos_invalidos');
        }
        $nombre = $this->nombre_de($archivo);
        if (!$this->analisis_de($nombre)) {
            $fallo('Este PDF no tiene datos analizados. Usa "Re-analizar".');
        }
        $crudo = isset($_POST['mockups']) ? (string)$_POST['mockups'] : '';
        $decodificado = $crudo === '' ? [] : json_decode($crudo, true);
        if (!is_array($decodificado)) {
            $fallo('mockups_invalidos');
        }
        // Solo capas bien formadas; el motor normaliza rangos y refs.
        $mockups = [];
        foreach ($decodificado as $mk) {
            if (!is_array($mk)) {
                continue;
            }
            $capas = [];
            foreach ((array)($mk['capas'] ?? []) as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $tipo = isset($c['tipo']) ? (string)$c['tipo'] : '';
                if ($tipo !== 'img' && $tipo !== 'placeholder') {
                    continue;
                }
                $capas[] = [
                    'tipo' => $tipo,
                    'ref' => isset($c['ref']) ? substr(trim((string)$c['ref']), 0, 128) : '',
                    'x' => (int)($c['x'] ?? 0),
                    'y' => (int)($c['y'] ?? 0),
                    'w' => (int)($c['w'] ?? 0),
                    'h' => (int)($c['h'] ?? 0),
                    'rot' => (float)($c['rot'] ?? 0),
                    'sesgo' => (float)($c['sesgo'] ?? 0),
                    'filtros' => isset($c['filtros']) && is_array($c['filtros']) ? $c['filtros'] : [],
                ];
            }
            $mockups[] = [
                'id' => isset($mk['id']) ? sanitize_key((string)$mk['id']) : '',
                'titulo' => isset($mk['titulo']) ? substr(trim((string)$mk['titulo']), 0, 200) : '',
                'creado' => isset($mk['creado']) && $mk['creado'] !== '' ? substr((string)$mk['creado'], 0, 32) : gmdate('Y-m-d\TH:i:s\Z'),
                'capas' => $capas,
            ];
        }
        $ok = $this->pmu_uploads()->guardar_config($nombre, [
            'mockups' => $mockups,
            'preview_omisible' => !empty($_POST['preview_omisible']),
        ]);
        if (!$ok) {
            $fallo('No se pudieron guardar los mockups.');
        }
        if ($ajax) {
            wp_send_json_success(['archivo' => $archivo, 'mockups' => count($mockups)]);
        }
        $this->redirigir(['ec_config' => 1, 'ec_pdf' => $archivo]);
    }

    /** Guarda el config.json de un PDF (activo, productos, campos, mapeos). */
    public function handle_config_guardar()
    {
        $this->seguridad('personalizador_pdf_config');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $ajax = !empty($_POST['ajax']);
        $fallo = function ($mensaje) use ($ajax, $archivo) {
            if ($ajax) {
                wp_send_json_error($mensaje);
            }
            $this->redirigir(['ec_error' => $mensaje, 'ec_pdf' => $archivo]);
        };
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $fallo('datos_invalidos');
        }
        $nombre = $this->nombre_de($archivo);
        $analisis = $this->analisis_de($nombre);
        if (!$analisis) {
            $fallo('Este PDF no tiene datos analizados. Usa "Re-analizar".');
        }
        $ids_dataset = [];
        foreach (($analisis['grupos'] ?? []) as $g) {
            $ids_dataset[$g['id']] = true;
        }
        $placeholders = [];
        $tipos = isset($_POST['placeholders']) && is_array($_POST['placeholders']) ? $_POST['placeholders'] : [];
        foreach ($tipos as $gid => $m) {
            $gid = strtoupper((string)$gid);
            if (!isset($ids_dataset[$gid]) || !is_array($m)) {
                continue;
            }
            $tipo = isset($m['tipo']) ? (string)$m['tipo'] : 'texto';
            if ($tipo !== 'texto' && $tipo !== 'imagen') {
                continue;
            }
            $placeholders[$gid] = [
                'tipo' => $tipo,
                'preset' => isset($m['preset']) ? sanitize_key((string)$m['preset']) : null,
                'value' => isset($m['value']) ? substr(trim((string)$m['value']), 0, 2000) : '',
                'settings' => isset($m['settings']) ? substr(trim((string)$m['settings']), 0, 4000) : '',
                'repetir' => !empty($m['repetir']),
            ];
        }
        $campos_ids = [];
        foreach ((array)($_POST['campos_ids'] ?? []) as $c) {
            $c = (int)$c;
            if ($c > 0) {
                $campos_ids[] = $c;
            }
        }
        list($activos, ) = $this->campos_activos();
        $campos_ids = array_values(array_filter(array_unique($campos_ids), function ($c) use ($activos) {
            return isset($activos[$c]);
        }));
        $productos = [];
        $crudos = isset($_POST['productos']) ? $_POST['productos'] : (isset($_POST['productos_txt']) ? preg_split('/[\s,;]+/', (string)$_POST['productos_txt']) : []);
        if (function_exists('wc_get_product')) {
            foreach ((array)$crudos as $p) {
                $p = (int)$p;
                if ($p > 0 && wc_get_product($p)) {
                    $productos[] = $p;
                }
            }
            $productos = array_values(array_slice(array_unique($productos), 0, 100));
        }
        $config = [
            'activo' => !empty($_POST['activo']),
            'productos' => $productos,
            'campos_ids' => $campos_ids,
            'preview_omisible' => !empty($_POST['preview_omisible']),
            'placeholders' => $placeholders,
        ];
        // Spec 005 (T004): "Configuracion tienda" por asociacion PDFxproducto.
        // Solo se toca `tienda` si la seccion viajo en el POST (marcador
        // `tienda_presente`) y siempre acotada a los productos vigentes (poda
        // de huerfanos). La validez NO se evalua aca (Const. III): el motor
        // valida su sintaxis al guardar y rechaza con causa.
        if (!empty($_POST['tienda_presente'])) {
            $config['tienda'] = $this->tienda_desde_post($productos);
        }
        $ok = false;
        try {
            $ok = $this->pmu_uploads()->guardar_config($nombre, $config);
        } catch (\Throwable $e) {
            $causa = $e->getMessage();
            $fallo($causa === 'motor:campos:script:invalido'
                ? 'Validez invalida: la expresion no puede usar document, el DOM ni DOMContentLoaded. No se guardo nada.'
                : 'No se pudo guardar la configuracion: ' . $causa);
        }
        if (!$ok) {
            $fallo('No se pudo guardar la configuracion.');
        }
        if ($ajax) {
            wp_send_json_success(['archivo' => $archivo]);
        }
        $this->redirigir(['ec_config' => 1, 'ec_pdf' => $archivo]);
    }

    /**
     * Arma la seccion `tienda{pid}` desde el POST (spec 005, T004): una entrada
     * por producto vigente del PDF (poda de huerfanos) y sin claves ajenas al
     * contrato. Los valores crudos los normaliza el motor (`config_tienda`).
     */
    private function tienda_desde_post(array $productos)
    {
        $crudos = isset($_POST['tienda']) && is_array($_POST['tienda']) ? $_POST['tienda'] : [];
        $tienda = [];
        foreach ($productos as $pid) {
            $pid = (int)$pid;
            $entrada = [];
            if (isset($crudos[(string)$pid]) && is_array($crudos[(string)$pid])) {
                $entrada = $crudos[(string)$pid];
            } elseif (isset($crudos[$pid]) && is_array($crudos[$pid])) {
                $entrada = $crudos[$pid];
            }
            $tienda[(string)$pid] = [
                'activo' => array_key_exists('activo', $entrada) ? $entrada['activo'] : true,
                'validez' => isset($entrada['validez']) && is_scalar($entrada['validez']) ? (string)$entrada['validez'] : '',
                'mensaje_html' => isset($entrada['mensaje_html']) && is_scalar($entrada['mensaje_html']) ? (string)$entrada['mensaje_html'] : '',
                'bloquear' => array_key_exists('bloquear', $entrada) ? $entrada['bloquear'] : false,
            ];
        }
        return $tienda;
    }

    /** Busca productos Woo para el autocompletado de Configuracion tienda (AJAX JSON). */
    public function handle_buscar_productos()
    {
        $this->seguridad('personalizador_pdf_buscar_productos');
        $term = isset($_REQUEST['q']) ? sanitize_text_field(wp_unslash($_REQUEST['q'])) : '';
        if (!function_exists('wc_get_products')) {
            wp_send_json_error('woocommerce_inactivo');
        }
        $args = [
            'status' => 'publish',
            'limit' => 20,
            'orderby' => 'title',
            'order' => 'ASC',
        ];
        if ($term !== '') {
            $args['s'] = $term;
        }
        $items = [];
        foreach ((array)wc_get_products($args) as $producto) {
            $items[] = [
                'id' => (int)$producto->get_id(),
                'titulo' => (string)$producto->get_name(),
            ];
        }
        wp_send_json_success($items);
    }

    /* ==================== Menu y assets ==================== */

    public function add_menu()
    {
        add_menu_page(
            'Personalizador PDF',
            'Personalizador PDF',
            'manage_options',
            'personalizador-pdf',
            [$this, 'render_page'],
            'dashicons-media-document',
            30
        );
    }

    public function enqueue_assets($hook)
    {
        if ($hook !== 'toplevel_page_personalizador-pdf') {
            return;
        }
        // Pestana activa: pdfs (default) | campos | textos | ayuda (misma whitelist que page.php).
        $tab = isset($_GET['tab']) ? sanitize_key((string)$_GET['tab']) : 'pdfs';
        if (!in_array($tab, ['pdfs', 'campos', 'textos', 'ayuda'], true)) {
            $tab = 'pdfs';
        }
        wp_enqueue_style(
            'personalizador-pdf',
            PERSONALIZADOR_PDF_URL . 'assets/admin.css',
            [],
            PERSONALIZADOR_PDF_VERSION
        );
        // El JS de la consola (modal, galeria wp.media) y wp.media solo se usan en "PDFs".
        if ($tab !== 'pdfs') {
            return;
        }
        wp_enqueue_media();
        wp_enqueue_script(
            'miniaturas',
            PERSONALIZADOR_PDF_URL . 'assets/miniaturas.js',
            [],
            PERSONALIZADOR_PDF_VERSION,
            true
        );
        wp_enqueue_script(
            'personalizador-pdf',
            PERSONALIZADOR_PDF_URL . 'assets/admin.js',
            ['jquery', 'miniaturas'],
            PERSONALIZADOR_PDF_VERSION,
            true
        );
        wp_enqueue_script(
            'personalizador-pdf-mockups',
            PERSONALIZADOR_PDF_URL . 'assets/mockups.js',
            ['jquery', 'personalizador-pdf'],
            PERSONALIZADOR_PDF_VERSION,
            true
        );
        wp_localize_script('personalizador-pdf', 'PersonalizadorPDF', [
            'existentes' => $this->pdfs_subidos(),
            'nonce' => wp_create_nonce('personalizador_pdf_nonce'),
            'version' => PERSONALIZADOR_PDF_VERSION,
            'renderCoreUrl' => PERSONALIZADOR_PDF_URL . 'modules/textmuy/render-core.html',
            'motorUrl' => admin_url('admin-post.php?action=pmu_uploads'),
            'motorNonce' => wp_create_nonce('pmu_uploads'),
            'imagenesBase' => $this->base_imagenes_segura(),
            // Puente TextMuy completo (urls + nonces + inventarios): lo envia
            // assets/admin.js al iframe render-core.html (contrato AGENTS 2.1).
            'puente' => $this->puente_textmuy()['puente'],
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'postUrl' => admin_url('admin-post.php'),
            'nonceBuscar' => wp_create_nonce('personalizador_pdf_buscar_productos'),
            'nonceCampo' => wp_create_nonce('personalizador_pdf_campo'),
            'nonceConfig' => wp_create_nonce('personalizador_pdf_config'),
            'nonceMockups' => wp_create_nonce('personalizador_pdf_mockups'),
            // Editor de mockups (spec 004, T008): datos del PDF seleccionado.
            'mockups' => $this->mockups_para_editor(),
        ]);
    }

    /**
     * Datos para el editor de mockups (spec 004, T008): PDF seleccionado por
     * `?ec_pdf=` (o el primero) y sus datos de render. FUENTE UNICA: delega en
     * `datos_pdf_render()` (evita duplicar el armado de grupos/fotos/mockups).
     * Solo lectura; nunca tumba el enqueue.
     */
    public function mockups_para_editor()
    {
        $vacio = ['pdf' => '', 'grupos' => [], 'fotos' => [], 'mockups' => [], 'preview_omisible' => false];
        try {
            $get = isset($_GET['ec_pdf']) ? sanitize_file_name(wp_unslash((string)$_GET['ec_pdf'])) : '';
            $pdfs = $this->pdfs_subidos();
            if ($get !== '' && in_array($get, $pdfs, true)) {
                $archivo = $get;
            } elseif ($pdfs) {
                $archivo = (string)reset($pdfs);
            } else {
                return $vacio;
            }
            $datos = $this->datos_pdf_render($this->nombre_de($archivo));
            if (empty($datos['pdf'])) {
                return $vacio;
            }
            // Compatibilidad del editor: `default` = tipo mapeado ('' sin mapeo).
            foreach ($datos['grupos'] as $i => $g) {
                $datos['grupos'][$i]['default'] = $g['value'] !== '' || $g['preset'] !== '' ? $g['tipo'] : '';
            }
            return $datos;
        } catch (\Throwable $e) {
            return $vacio;
        }
    }

    /** URL base de imagenes del editor (vacia si el motor falla; nunca tumba el enqueue). */
    private function base_imagenes_segura()
    {
        try {
            return $this->pmu_uploads()->url_ambito('img');
        } catch (\Throwable $e) {
            return '';
        }
    }


    /**
     * Puente plugin <-> TextMuy (contrato textmuy-bridge, AGENTS 2.1): urls +
     * nonces + inventarios construidos desde el motor unico PMU_Uploads. UNICA
     * fuente de verdad: la consume la pestana "Estilos de Texto" (editor
     * completo) y el render-core off-screen (assets/admin.js). Nunca lanza:
     * si listar_todo() falla, el puente sale con inventarios vacios y el
     * aviso con la causa.
     */
    public function puente_textmuy()
    {
        $recursos = ['presets' => [], 'imagenes' => [], 'fuentes' => []];
        $aviso = '';
        try {
            $recursos = $this->pmu_uploads()->listar_todo();
        } catch (\Throwable $e) {
            // Fallo del inventario inicial (catalogo invalido, permisos, etc.):
            // causa visible en la pestana; el editor se recibe vacio y se niega a operar.
            $aviso = $e->getMessage();
        }
        $pmu_uploads = $this->pmu_uploads();
        return [
            'puente' => [
                'urls' => [
                    'motor' => admin_url('admin-post.php?action=pmu_uploads'),
                    // Script del motor de miniaturas y sprites para inyectar en el iframe
                    'miniaturas' => PERSONALIZADOR_PDF_URL . 'assets/miniaturas.js',
                    // Lectura de presets (.txm), imagenes y fuentes: bases de uploads.
                    'presetsBase' => $pmu_uploads->url_ambito('tm-presets'),
                    'fuentesBase' => $pmu_uploads->url_ambito('fonts'),
                    'imagenesBase' => $pmu_uploads->url_ambito('img'),
                ],
                'nonces' => [
                    'motor' => wp_create_nonce('pmu_uploads'),
                ],
                'presets' => is_array($recursos['presets'] ?? null) ? $recursos['presets'] : [],
                'imagenes' => is_array($recursos['imagenes'] ?? null) ? $recursos['imagenes'] : [],
                'fuentes' => is_array($recursos['fuentes'] ?? null) ? $recursos['fuentes'] : [],
            ],
            'aviso' => $aviso,
        ];
    }
    public function render_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        // US1: la consola nunca puede mostrar la pagina de error critico:
        // cualquier fallo del motor se muestra como aviso con su causa (FR-003).
        try {
            include PERSONALIZADOR_PDF_PATH . 'admin/page.php';
        } catch (\Throwable $e) {
            echo '<div class="wrap"><div class="notice notice-error"><p>'
                . '<strong>Personalizador PDF:</strong> '
                . esc_html($e->getMessage())
                . '</p></div></div>';
        }
    }

    /* ==================== Utilidades comunes ==================== */

    /** Verifica permisos y nonce de una accion; wp_die si falla. */
    private function seguridad($accion)
    {
        if (!current_user_can('manage_options')) {
            wp_die('Permiso denegado');
        }
        $nonce = (string)($_REQUEST['_wpnonce'] ?? '');
        if (wp_verify_nonce($nonce, $accion)) {
            return;
        }
        // Compatibilidad temporal: acepta el nonce del prefijo historico
        // "extractor_corel_*" generado por formularios o bookmarks de <= 2.0.0.
        $legacy = str_replace('personalizador_pdf_', 'extractor_corel_', $accion);
        if ($legacy !== $accion && wp_verify_nonce($nonce, $legacy)) {
            return;
        }
        wp_die('Permiso denegado');
    }

    /** Redirige a la pagina del plugin con parametros extra. */
    private function redirigir(array $args = [])
    {
        $args['page'] = 'personalizador-pdf';
        wp_redirect(admin_url('admin.php?' . http_build_query($args)));
        exit;
    }

    /**
     * Analiza un PDF ya guardado y guarda el dataset. Devuelve el resumen.
     * Sin PNGs de placeholder: se generan al vuelo (FR-009, research D3).
     * Preserva la personalizacion (default/value/preset/config) de los grupos
     * cuyo id sigue existiendo (research D8, T019) e informa en el resumen
     * los grupos que la perdieron por desaparecer del analisis.
     */
    private function analizar_y_guardar($archivo)
    {
        $ruta = $this->ruta_pdf($archivo);
        $nombre = $this->nombre_de($archivo);
        $pdf = new \ExtractCorel\Engine\Pdf((string)file_get_contents($ruta));
        $pdf->load();
        $detector = new Detector($pdf);
        $resultado = $detector->analizarPdf();
        $grupos = $resultado['grupos'];
        if (!$grupos) {
            throw new \RuntimeException(
                'No se detectaron placeholders. Asegurate de exportar desde Corel con rectangulos 100% transparentes.'
            );
        }
        // Plan 008: el analisis (geometria) va a analisis.json (inmutable);
        // la config editable se preserva por id y nunca se pisa.
        $motor = $this->pmu_uploads();
        $analisis_previo = $this->analisis_de($nombre);
        $ids_previos = [];
        foreach ((array)($analisis_previo['grupos'] ?? []) as $pg) {
            if (isset($pg['id'])) {
                $ids_previos[$pg['id']] = true;
            }
        }
        $config_previa = $this->config_de($nombre);
        $analisis = Metadata::generarAnalisis($nombre, $grupos, 200);
        Metadata::guardar($analisis, $motor->ruta_analisis($nombre));
        // Poda de mapeos huerfanos: placeholders de ids que ya no existen.
        $ids_nuevos = [];
        foreach ($grupos as $g) {
            $ids_nuevos[$g['id']] = true;
        }
        $mapa = isset($config_previa['placeholders']) && is_array($config_previa['placeholders'])
            ? $config_previa['placeholders'] : [];
        $perdidos = [];
        foreach ($mapa as $id => $m) {
            $tiene = isset($m['value']) && (string)$m['value'] !== ''
                || isset($m['preset']) && (string)$m['preset'] !== ''
                || isset($m['settings']) && (string)$m['settings'] !== '';
            if ($tiene && !isset($ids_nuevos[$id])) {
                $perdidos[] = $id;
                unset($mapa[$id]);
            }
        }
        $config_previa['placeholders'] = $mapa;
        $motor->guardar_config($nombre, $config_previa);
        // Personalizacion preservada vs perdida: comparar ids previo/nuevo
        // (el analisis ya se regenero; la config con mapeos vigentes se guardo).
        $resumen = [
            'nombre_pdf' => $nombre,
            'archivo' => $archivo,
            'total_paginas' => (int)$resultado['total_paginas'],
            'total_grupos' => count($grupos),
            'total_instancias' => array_sum(array_map(function ($g) {
                return (int)$g['cont'];
            }, $grupos)),
        ];
        if ($perdidos) {
            $resumen['personalizacion_perdida'] = $perdidos;
        }
        return $resumen;
    }
    /* ==================== Handlers: imagenes por grupo ==================== */

    /** id de grupo valido: color hex de 6 sin '#' (plan 008: analisis/config). */
    private function id_valido($id)
    {
        return is_string($id) && preg_match('/^[0-9A-F]{6}$/', $id) === 1;
    }

    /** Normaliza el id recibido (POST/GET): mayusculas y valido, o ''. */
    private function id_recibido($fuente, $clave = 'id')
    {
        $v = isset($fuente[$clave]) ? strtoupper(trim((string)$fuente[$clave])) : '';
        return $this->id_valido($v) ? $v : '';
    }

    /** Extension de imagen permitida (o null). */
    private function extension_imagen($nombre_archivo)
    {
        $ext = strtolower(pathinfo($nombre_archivo, PATHINFO_EXTENSION));
        return in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true) ? $ext : null;
    }

    /** Sube una imagen real para un grupo (color hex) de un PDF. */
    public function handle_subir_imagen()
    {
        $this->seguridad('personalizador_pdf_subir_imagen');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $gid = $this->id_recibido($_POST);
        $ajax = !empty($_POST['ajax']);
        $fallo = function ($mensaje) use ($ajax, $archivo) {
            if ($ajax) {
                wp_send_json_error($mensaje);
            }
            $this->redirigir(['ec_error' => $mensaje, 'ec_pdf' => $archivo]);
        };
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || $gid === '') {
            $fallo('datos_invalidos');
        }
        if (empty($_FILES['imagen']) || ($_FILES['imagen']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            $fallo('No se recibio ninguna imagen (o el servidor rechazo la subida).');
        }
        $ext = $this->extension_imagen($_FILES['imagen']['name']);
        if (!$ext) {
            $fallo('Formato de imagen no permitido (usa PNG, JPG, GIF o WebP).');
        }
        try {
            $this->guardar_imagen($archivo, $gid, $_FILES['imagen']['tmp_name'], $ext);
        } catch (\Throwable $e) {
            $fallo($e->getMessage());
        }
        if ($ajax) {
            wp_send_json_success(['id' => $gid, 'ext' => $ext]);
        }
        $this->redirigir(['ec_imagen' => 1, 'ec_pdf' => $archivo]);
    }

    /** Toma una imagen de la galeria de medios para un grupo. */
    public function handle_imagen_galeria()
    {
        $this->seguridad('personalizador_pdf_imagen_galeria');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $gid = $this->id_recibido($_POST);
        $attachment_id = isset($_POST['attachment_id']) ? (int)$_POST['attachment_id'] : 0;
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || $gid === '' || $attachment_id <= 0) {
            $this->redirigir(['ec_error' => 'datos_invalidos', 'ec_pdf' => $archivo]);
        }
        $ruta = get_attached_file($attachment_id);
        if (!$ruta || !is_file($ruta)) {
            $this->redirigir(['ec_error' => 'La imagen de la galeria no esta disponible.', 'ec_pdf' => $archivo]);
        }
        $ext = $this->extension_imagen($ruta);
        if (!$ext) {
            $this->redirigir(['ec_error' => 'El adjunto de la galeria no es una imagen permitida.', 'ec_pdf' => $archivo]);
        }
        try {
            $this->guardar_imagen($archivo, $gid, $ruta, $ext);
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        $this->redirigir(['ec_imagen' => 1, 'ec_pdf' => $archivo]);
    }

    /** Quita la imagen asignada a un grupo. */
    public function handle_quitar_imagen()
    {
        $this->seguridad('personalizador_pdf_quitar_imagen');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $gid = $this->id_recibido($_POST);
        $ajax = !empty($_POST['ajax']);
        if (!$archivo || $gid === '') {
            if ($ajax) {
                wp_send_json_error('datos_invalidos');
            }
            $this->redirigir(['ec_error' => 'datos_invalidos', 'ec_pdf' => $archivo]);
        }
        $this->quitar_imagen($archivo, $gid);
        if ($ajax) {
            wp_send_json_success(['id' => $gid]);
        }
        $this->redirigir(['ec_imagen_quitada' => 1, 'ec_pdf' => $archivo]);
    }

    /** Guarda la imagen del grupo con extension normalizada (unico archivo por id). */
    private function guardar_imagen($archivo, $gid, $origen, $ext)
    {
        $nombre = $this->nombre_de($archivo);
        $dir = $this->dir_muestras($nombre);
        // Un solo archivo por id: quitar variantes con otras extensiones.
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . $gid . '.*') as $vieja) {
            @unlink($vieja);
        }
        @unlink($dir . DIRECTORY_SEPARATOR . 'thumbs' . DIRECTORY_SEPARATOR . $gid . '.webp'); // miniatura legada
        $this->miniatura_grupo_textmuy_unlink($nombre, $gid); // nueva miniatura ThumbEngine (pmu/img/)
        if (!@copy($origen, $dir . DIRECTORY_SEPARATOR . $gid . '.' . $ext)) {
            throw new \RuntimeException('No se pudo guardar la imagen (permisos de ' . $dir . ').');
        }
    }

    /** Elimina la imagen del grupo si existe. */
    private function quitar_imagen($archivo, $gid)
    {
        $dir = $this->dir_muestras($this->nombre_de($archivo));
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . $gid . '.*') as $vieja) {
            @unlink($vieja);
        }
        @unlink($dir . DIRECTORY_SEPARATOR . 'thumbs' . DIRECTORY_SEPARATOR . $gid . '.webp'); // miniatura legada
        $this->miniatura_grupo_textmuy_unlink($this->nombre_de($archivo), $gid);
    }

    /** Borra la miniatura ThumbEngine de un grupo de PDF (pmu/img/{pdf}-{id}.webp). */
    private function miniatura_grupo_textmuy_unlink($pdf, $gid)
    {
        $dir = $this->pmu_uploads()->dir_ambito('img');
        @unlink($dir . DIRECTORY_SEPARATOR . strtolower($pdf . '-' . $gid) . '.webp');
    }

    /* ==================== Textos estilizados por grupo (puente TextMuy) ==================== */

    /**
     * Nombres de los presets del administrador (uploads/pmu/tm-presets/*.txm
     * vigentes segun el catalogo). Desde 4.0.0 NO hay presets base versionados:
     * todo preset vive en uploads (creado desde el editor "Estilos de Texto").
     */
    private function presets_base()
    {
        return $this->pmu_uploads()->presets_nombres();
    }

    /** Limita el texto a N caracteres sin depender de la extension mbstring. */
    private function limitar_texto($texto, $max = 300)
    {
        if (function_exists('mb_substr')) {
            return mb_substr($texto, 0, $max);
        }
        if (strlen($texto) <= $max) {
            return $texto;
        }
        // Fallback sin mbstring: recorte por bytes evitando partir una
        // secuencia UTF-8 por la mitad.
        $cortado = substr($texto, 0, $max);
        $cortado = preg_replace('/[\x80-\xBF]{1,3}$/', '', $cortado);
        if ($cortado !== '' && (ord(substr($cortado, -1)) & 0xC0) === 0xC0) {
            $cortado = substr($cortado, 0, -1);
        }
        return $cortado;
    }

    /**
     * Guarda/quita el texto estilizado de un grupo (puente TextMuy).
     * Escribe el mapeo en config.json placeholders[id] (nunca el analisis).
     * Con $_POST['ajax']=1 responde JSON (autoguardado sin recarga); si no,
     * redirige como el resto de los handlers (compatible sin JS).
     */
    public function handle_guardar_texto()
    {
        $this->seguridad('personalizador_pdf_guardar_texto');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $gid = $this->id_recibido($_POST);
        $ajax = !empty($_POST['ajax']);
        $fallo = function ($mensaje) use ($ajax, $archivo) {
            if ($ajax) {
                wp_send_json_error($mensaje);
            }
            $this->redirigir(['ec_error' => $mensaje, 'ec_pdf' => $archivo]);
        };
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || $gid === '') {
            $fallo('datos_invalidos');
        }
        $activo = !empty($_POST['activo']);
        $texto = isset($_POST['texto']) ? $this->limitar_texto(sanitize_text_field(wp_unslash($_POST['texto']))) : '';
        $estilo = isset($_POST['estilo']) ? sanitize_key((string)wp_unslash($_POST['estilo'])) : '';
        if ($activo && ($texto === '' || $estilo === '')) {
            $fallo('Escribe un texto y elige un estilo para activar el grupo.');
        }
        if ($activo && $estilo !== '') {
            $presets = [];
            try {
                $presets = $this->presets_base();
            } catch (\Throwable $e) {
                $presets = [];
            }
            if (!in_array($estilo, $presets, true)) {
                $fallo('El estilo elegido ya no existe. Elegi otro de la lista.');
            }
        }
        $nombre = $this->nombre_de($archivo);
        try {
            $this->guardar_personalizacion($nombre, $gid, $activo ? 'texto' : 'limpiar', $texto, $estilo);
        } catch (\Throwable $e) {
            $fallo($e->getMessage());
        }
        if ($ajax) {
            wp_send_json_success(['id' => $gid, 'activo' => $activo]);
        }
        $this->redirigir($activo
            ? ['ec_texto' => 1, 'ec_pdf' => $archivo]
            : ['ec_texto_quitado' => 1, 'ec_pdf' => $archivo]);
    }

    /* ==================== Recursos TextMuy (presets .txm + imagenes) ==================== */

    /* Ubicacion unica y definitiva de los recursos del editor:
     * wp-content/uploads/pmu/{fonts,img,tm-presets}/ (ver AGENTS.md seccion 5).
     * El plugin queda de solo lectura y se actualiza (ZIP o git pull) sin
     * preservar archivos; presets, imagenes y fuentes son datos de usuario. */

    /** Indica si el modulo integrado TextMuy esta presente (modules/textmuy/index.html). */
    public function modulo_textmuy_disponible()
    {
        return is_file(PERSONALIZADOR_PDF_PATH . 'modules' . DIRECTORY_SEPARATOR . 'textmuy' . DIRECTORY_SEPARATOR . 'index.html');
    }

    /* ==================== Handlers: PDFs ==================== */

    /** Sube un PDF, resuelve conflictos de nombre y genera el dataset. */
    public function handle_subir_pdf()
    {
        $this->seguridad('personalizador_pdf_subir_pdf');
        if (empty($_FILES['pdf']) || !is_array($_FILES['pdf'])) {
            $this->redirigir(['ec_error' => 'no_file']);
        }
        $file = $_FILES['pdf'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $this->redirigir(['ec_error' => 'upload']);
        }
        $archivo = sanitize_file_name($file['name']);
        if (strtolower(pathinfo($archivo, PATHINFO_EXTENSION)) !== 'pdf') {
            $this->redirigir(['ec_error' => 'tipo']);
        }
        $modo = isset($_POST['modo']) ? $_POST['modo'] : '';
        $existe = is_file($this->ruta_pdf($archivo));
        if ($existe && $modo !== 'sobrescribir') {
            if ($modo === 'renombrar' || !$existe) {
                $archivo = $this->nombre_disponible($archivo);
            } else {
                // Sin decision: volver a preguntar (el form con JS ya la pide).
                $this->redirigir(['ec_pregunta' => 'nombre', 'nombre' => $archivo]);
            }
        }
        // Sobrescribir: limpiar los datos previos ANTES de mover (la limpieza
        // borra la carpeta del producto, que se vuelve a crear aqui).
        if ($existe && $modo === 'sobrescribir') {
            $this->limpiar_datos_de($this->nombre_de($archivo));
        }
        try {
            $this->dir_producto($this->nombre_de($archivo));
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        if (!@move_uploaded_file($file['tmp_name'], $this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'move']);
        }
        try {
            $resumen = $this->analizar_y_guardar($archivo);
        } catch (\Throwable $e) {
            @unlink($this->ruta_pdf($archivo));
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        $this->redirigir([
            'ec_subido' => 1,
            'ec_pdf' => $archivo,
            'grupos' => $resumen['total_grupos'],
            'instancias' => $resumen['total_instancias'],
        ]);
    }

    /** Re-analiza un PDF ya subido y regenera su dataset (T019). */
    public function handle_reanalizar()
    {
        $this->seguridad('personalizador_pdf_reanalizar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'pdf_inexistente']);
        }
        try {
            $resumen = $this->analizar_y_guardar($archivo);
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        $args = ['ec_reanalizado' => 1, 'ec_pdf' => $archivo];
        if (!empty($resumen['personalizacion_perdida'])) {
            // Grupos con personalizacion que desaparecieron del analisis (T019).
            $args['ec_perdidos'] = implode(',', $resumen['personalizacion_perdida']);
        }
        $this->redirigir($args);
    }

    /** Borra un PDF subido con todo su dataset, imagenes y salida. */
    public function handle_borrar()
    {
        $this->seguridad('personalizador_pdf_borrar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'pdf_inexistente']);
        }
        $this->limpiar_datos_de($this->nombre_de($archivo));
        $this->redirigir(['ec_borrado' => 1]);
    }

    /** Primer nombre libre: nombre.pdf, nombre-2.pdf, nombre-3.pdf... */
    private function nombre_disponible($archivo)
    {
        $base = substr($archivo, 0, -4); // sin .pdf
        for ($i = 2; ; $i++) {
            $candidato = $base . '-' . $i . '.pdf';
            if (!is_file($this->ruta_pdf($candidato))) {
                return $candidato;
            }
        }
    }

    /**
     * Borra el producto completo: pdfs/{nombre}/ (PDF + dataset) y
     * tmp/muestras/{nombre}/ (imagenes aplicadas, textos y salida de muestra).
     * Nunca toca orders/, ni lineas del carrito, ni otros productos (V-6).
     * Ademas limpia tmp/muestras/ huerfano (sin PDF correspondiente, D10/FR-014).
     */
    private function limpiar_datos_de($nombre)
    {
        $motor = $this->pmu_uploads();
        $dirs = [];
        try {
            $dirs[] = $motor->dir_pdf($nombre); // solo si existe (si no, lanza)
        } catch (\Throwable $e) {
            // Sin carpeta de producto: nada que borrar ahi.
        }
        $dirs[] = $motor->dir_tmp_muestras($nombre); // ruta sin crear ni validar
        foreach ($dirs as $dir) {
            $this->borrar_arbol($dir);
        }
        $this->limpiar_muestras_huerfanas();
    }

    /** Borra carpetas de tmp/muestras/ sin PDF correspondiente (D10, FR-014). */
    private function limpiar_muestras_huerfanas()
    {
        try {
            $motor = $this->pmu_uploads();
            $raiz = $motor->dir_ambito('tmp') . DIRECTORY_SEPARATOR . 'muestras';
        } catch (\Throwable $e) {
            return;
        }
        if (!is_dir($raiz)) {
            return;
        }
        foreach ((array)glob($raiz . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $carpeta) {
            $pdf = basename($carpeta);
            try {
                $esperado = $motor->ruta_pdf($pdf);
            } catch (\Throwable $e) {
                continue; // Nombre no saneable: no es nuestro, no tocar.
            }
            if (!is_file($esperado)) {
                $this->borrar_arbol($carpeta);
            }
        }
    }

    /** Borrado recursivo de un directorio (archivos y subcarpetas). */
    private function borrar_arbol($dir)
    {
        if (!$dir || !is_dir($dir)) {
            return;
        }
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*') as $f) {
            if (is_dir($f)) {
                $this->borrar_arbol($f);
                continue;
            }
            @unlink($f);
        }
        @rmdir($dir);
    }
    /* ==================== Handlers: procesar y descargar ==================== */

    /** Ejecuta el motor: PDF + dataset + imagenes -> PDF editado. */
    public function handle_procesar()
    {
        $this->seguridad('personalizador_pdf_procesar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'pdf_inexistente']);
        }
        $nombre = $this->nombre_de($archivo);
        $vista = $this->vista_grupos($nombre);
        if (!$vista || (!$vista['analisis'] && !$vista['config']['placeholders'])) {
            $this->redirigir(['ec_error' => 'Este PDF no tiene datos analizados. Usa "Re-analizar".', 'ec_pdf' => $archivo]);
        }
        $datos = $vista['analisis'];

        /* === Puente TextMuy (v3.1): texto + estilo por grupo, 1 click === */

        $ids_dataset = [];
        foreach (($datos['grupos'] ?? []) as $g) {
            $ids_dataset[$g['id']] = true;
        }

        // 1) Persistir texto/estilo por grupo (mismo POST => estado coherente con lo procesado).
        // Plan 008: el puente manda texto_/estilo_ y el mapeo se guarda en
        // config.json placeholders[id] (nunca el analisis).
        foreach ($_POST as $campo => $valor) {
            if (!is_string($campo) || !preg_match('/^texto_([0-9A-Fa-f]{6})$/', $campo, $m)) {
                continue;
            }
            $gid = strtoupper($m[1]);
            if (!isset($ids_dataset[$gid])) {
                continue; // Grupo que ya no existe en el dataset actual.
            }
            $estilo = isset($_POST['estilo_' . $gid]) ? sanitize_key((string)wp_unslash($_POST['estilo_' . $gid])) : '';
            $texto = $this->limitar_texto(sanitize_text_field(wp_unslash($valor)));
            // Reflejo inmediato en config.json (el puente persiste por POST, no por AJAX suelto).
            try {
                $this->guardar_personalizacion($nombre, $gid, ($texto !== '' && $estilo !== '') ? 'texto' : 'limpiar', $texto, $estilo);
            } catch (\Throwable $e) {
                // El error del dataset se informa al final del procesado; el puente sigue.
            }
            $vista = $this->vista_grupos($nombre); // releer tras el reflejo (ids vigentes)
            $datos = $vista ? $vista['analisis'] : $datos;
            $ids_dataset = [];
            foreach (($datos['grupos'] ?? []) as $g) {
                $ids_dataset[$g['id']] = true;
            }
        }

        // 2) PNGs renderizados por el navegador (imagen_{id}) -> imagen del grupo.
        foreach ($_FILES as $campo => $file) {
            if (!is_string($campo) || !preg_match('/^imagen_([0-9A-Fa-f]{6})$/', $campo, $m)) {
                continue;
            }
            $gid = strtoupper($m[1]);
            if (!isset($ids_dataset[$gid])) {
                continue; // Nunca guardar archivos de ids inexistentes.
            }
            if (!is_array($file) || ($file['error'] ?? 1) !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
                $this->redirigir([
                    'ec_error' => 'No se pudo recibir el texto renderizado del grupo ' . strtoupper($gid)
                        . ' (revisa el tamano maximo de subida del servidor).',
                    'ec_pdf' => $archivo,
                ]);
            }
            // Firma PNG: evitar guardar como imagen algo que no sea un PNG del render.
            $firma = (string)@file_get_contents($file['tmp_name'], false, null, 0, 8);
            if ($firma !== "\x89PNG\r\n\x1a\n") {
                $this->redirigir([
                    'ec_error' => 'El archivo del grupo ' . strtoupper($gid) . ' no es un PNG valido.',
                    'ec_pdf' => $archivo,
                ]);
            }
            try {
                $this->guardar_imagen($archivo, $gid, $file['tmp_name'], 'png');
            } catch (\Throwable $e) {
                $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
            }
        }

        /* === Fin puente: el motor recibe imagenes por id de grupo, sin cambios === */

        $rutas = $this->imagenes_de($nombre);
        try {
            $resultado = Motor::procesar($this->ruta_pdf($archivo), $datos, $rutas);
            $this->dir_muestras($nombre); // tmp/muestras/{pdf}/ (sobrescritura idempotente)
            $salida = $this->ruta_salida($nombre);
            file_put_contents($salida, $resultado['bytes']);
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        set_transient(
            'personalizador_pdf_proceso',
            $resultado['resumen'] + ['archivo' => $archivo],
            HOUR_IN_SECONDS
        );
        $this->redirigir(['ec_procesado' => 1, 'ec_pdf' => $archivo]);
    }

    /** Descarga archivos: pdf | datos | placeholder | salida. */
    public function handle_descargar()
    {
        $this->seguridad('personalizador_pdf_descargar');
        $tipo = isset($_GET['tipo']) ? (string)$_GET['tipo'] : '';
        $archivo = isset($_GET['archivo']) ? sanitize_file_name($_GET['archivo']) : '';
        if ($tipo === 'placeholder') {
            // Generado al vuelo: no hay PNG de placeholder en disco (FR-009).
            $this->descargar_placeholder($archivo);
        }
        $nombre = $archivo ? $this->nombre_de($archivo) : '';
        $ruta = '';
        $descargar_como = '';
        switch ($tipo) {
            case 'pdf':
                $ruta = $this->ruta_pdf($archivo);
                $descargar_como = $archivo;
                break;
            case 'datos':
                $ruta = $this->pmu_uploads()->ruta_analisis($nombre);
                $descargar_como = $nombre . '-analisis.json';
                break;
            case 'salida':
                $ruta = $this->ruta_salida($nombre);
                $descargar_como = $nombre . '_procesado.pdf';
                break;
            default:
                wp_die('Tipo de descarga desconocido');
        }
        if (!$ruta || !is_file($ruta)) {
            wp_die('El archivo no esta disponible.');
        }
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . rawurlencode($descargar_como) . '"');
        header('Content-Length: ' . filesize($ruta));
        readfile($ruta);
        exit;
    }

    /**
     * Sirve el placeholder de un grupo como PNG generado al vuelo (T024).
     * Separable para tests: devuelve los bytes (o lanza) en vez de imprimirlos.
     */
    public function placeholder_bytes($archivo, $gid)
    {
        $nombre = $archivo ? $this->nombre_de($archivo) : '';
        $grupo = ($nombre !== '' && $gid !== '') ? $this->grupo_de($nombre, $gid) : null;
        if (!$grupo) {
            throw new \RuntimeException('Placeholder no disponible. Re-analiza el PDF.');
        }
        return PngWriter::bytes((int)$grupo['w'], (int)$grupo['h']);
    }

    /** Descarga HTTP del placeholder (wrapper fino sobre placeholder_bytes). */
    private function descargar_placeholder($archivo)
    {
        $gid = $this->id_recibido($_GET);
        try {
            $bytes = $this->placeholder_bytes($archivo, $gid);
        } catch (\Throwable $e) {
            wp_die($e->getMessage());
        }
        $grupo = $this->grupo_de($this->nombre_de($archivo), $gid);
        header('Content-Type: image/png');
        header('Content-Disposition: attachment; filename="' . $gid . '-' . (int)$grupo['w'] . 'x' . (int)$grupo['h'] . '.png"');
        header('Content-Length: ' . strlen($bytes));
        echo $bytes;
        exit;
    }

    /** Sirve en linea las imagenes aplicadas de un grupo (previews <img>). */
    public function handle_ver()
    {
        $this->seguridad('personalizador_pdf_ver');
        $tipo = isset($_GET['tipo']) ? (string)$_GET['tipo'] : '';
        $archivo = isset($_GET['archivo']) ? sanitize_file_name($_GET['archivo']) : '';
        $nombre = $archivo ? $this->nombre_de($archivo) : '';
        $ruta = '';
        if ($tipo === 'imagen') {
            $gid = $this->id_recibido($_GET);
            if ($gid === '') {
                wp_die('Id de grupo no valido');
            }
            $coincidencias = (array)glob($this->dir_imagenes($nombre) . DIRECTORY_SEPARATOR . $gid . '.*');
            $ruta = $coincidencias ? $coincidencias[0] : '';
        } elseif ($tipo === 'placeholder') {
            wp_die('El placeholder se genera al vuelo: usa la descarga con el id del grupo.');
        } else {
            wp_die('Tipo desconocido');
        }
        if (!$ruta || !is_file($ruta)) {
            wp_die('Archivo no disponible');
        }
        $mime = function_exists('mime_content_type') ? mime_content_type($ruta) : false;
        header('Content-Type: ' . ($mime ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($ruta));
        readfile($ruta);
        exit;
    }
}

Personalizador_PDF_Plugin::instance();

/**
 * Activacion del plugin.
 *
 * Sin migracion aqui: los datos viven en uploads/pmu/ (Const. IV) y la
 * migracion unica de la raiz heredada uploads/personalizador-pdf se implementa
 * en la feature 007 (US6, T031/T032). El codigo vigente nunca lee esa raiz.
 */