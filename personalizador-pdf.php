<?php
/**
 * Plugin Name: Personalizador PDF
 * Description: Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color. Motor 100% PHP, sin Python. Integra el sistema TextMuy (editor de estilos de texto) en la pestana "Estilos de Texto".
 * Version: 4.1.1
 * Author: Personalizador PDF
 * License: GPL-2.0+
 * Text Domain: personalizador-pdf
 *
 * @package PersonalizadorPDF
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PERSONALIZADOR_PDF_VERSION', '4.1.1');
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
        return [
            (int)$id,
            $corta($titulo, 200),
            $tipo,
            array_values(array_unique($etiquetas)),
            $corta($ayuda, 500),
            empty($fuente['visible']) ? false : true,
            $contenido,
            isset($fuente['css']) ? (string)$fuente['css'] : '',
            isset($fuente['script']) ? (string)$fuente['script'] : '',
        ];
    }

    /** Lista de campos activos: id => tupla (tombstones fuera). */
    private function campos_activos()
    {
        $res = $this->pmu_uploads()->campos_catalogo('listar');
        $out = [];
        foreach ($res['cat']['items'] as $t) {
            if (count($t) < 9 || $t[1] === '' || $t[2] === '') {
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
            'placeholders' => $placeholders,
        ];
        if (!$this->pmu_uploads()->guardar_config($nombre, $config)) {
            $fallo('No se pudo guardar la configuracion.');
        }
        if ($ajax) {
            wp_send_json_success(['archivo' => $archivo]);
        }
        $this->redirigir(['ec_config' => 1, 'ec_pdf' => $archivo]);
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
        ]);
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