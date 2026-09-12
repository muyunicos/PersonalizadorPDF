<?php
/**
 * Plugin Name: Personalizador PDF
 * Description: Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color. Motor 100% PHP, sin Python. Integra el sistema TextMuy (editor de estilos de texto) en la pestana "Estilos de Texto".
 * Version: 4.0.0
 * Author: Personalizador PDF
 * License: GPL-2.0+
 * Text Domain: personalizador-pdf
 *
 * @package PersonalizadorPDF
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PERSONALIZADOR_PDF_VERSION', '4.0.0');
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
        add_action('admin_post_personalizador_pdf_descargar', [$this, 'handle_descargar']);
        add_action('admin_post_personalizador_pdf_ver', [$this, 'handle_ver']);
        add_action('admin_post_personalizador_pdf_borrar', [$this, 'handle_borrar']);

        // Puente con el modulo TextMuy (pestana "Estilos de Texto"): el iframe
        // guarda/borra presets (.txm + .webp) y sube imagenes al modulo via fetch.
        // Solo en WP (con nonce); el modulo standalone sigue 100% client-side.
        add_action('admin_post_personalizador_pdf_textmuy_guardar_preset', [$this, 'handle_textmuy_guardar_preset']);
        add_action('admin_post_personalizador_pdf_textmuy_borrar_preset', [$this, 'handle_textmuy_borrar_preset']);
        add_action('admin_post_personalizador_pdf_textmuy_subir_imagen', [$this, 'handle_textmuy_subir_imagen']);
        add_action('admin_post_personalizador_pdf_textmuy_borrar_imagen', [$this, 'handle_textmuy_borrar_imagen']);
        add_action('admin_post_personalizador_pdf_textmuy_cambiar_imagen', [$this, 'handle_textmuy_cambiar_imagen']);
        add_action('admin_post_personalizador_pdf_textmuy_subir_fuente', [$this, 'handle_textmuy_subir_fuente']);
        add_action('admin_post_personalizador_pdf_textmuy_borrar_fuente', [$this, 'handle_textmuy_borrar_fuente']);
        add_action('admin_post_personalizador_pdf_textmuy_cambiar_fuente', [$this, 'handle_textmuy_cambiar_fuente']);
        add_action('admin_post_personalizador_pdf_guardar_miniatura', [$this, 'handle_guardar_miniatura']);
        add_action('admin_post_personalizador_pdf_guardar_sprite', [$this, 'handle_guardar_sprite']);

        // Compatibilidad temporal (ciclo 3.0.x): los hooks legacy "extractor_corel_*"
        // siguen respondiendo para no romper bookmarks o pestanas abiertas de <= 2.0.0.
        // Se eliminan en la version 3.1.
        add_action('admin_post_extractor_corel_subir_pdf', [$this, 'handle_subir_pdf']);
        add_action('admin_post_extractor_corel_reanalizar', [$this, 'handle_reanalizar']);
        add_action('admin_post_extractor_corel_subir_imagen', [$this, 'handle_subir_imagen']);
        add_action('admin_post_extractor_corel_imagen_galeria', [$this, 'handle_imagen_galeria']);
        add_action('admin_post_extractor_corel_quitar_imagen', [$this, 'handle_quitar_imagen']);
        add_action('admin_post_extractor_corel_procesar', [$this, 'handle_procesar']);
        add_action('admin_post_extractor_corel_descargar', [$this, 'handle_descargar']);
        add_action('admin_post_extractor_corel_ver', [$this, 'handle_ver']);
        add_action('admin_post_extractor_corel_borrar', [$this, 'handle_borrar']);
    }

    /* ==================== Rutas y carpetas de datos ==================== */

    private function base()
    {
        $upload_dir = wp_upload_dir();
        $base = trailingslashit($upload_dir['basedir']) . 'personalizador-pdf';
        if (!is_dir($base)) {
            // Migracion desde la carpeta historica "extractor-corel" (<= 2.0.0).
            // Preserva PDFs, datasets, imagenes, placeholders y salidas.
            $viejo = trailingslashit($upload_dir['basedir']) . 'extractor-corel';
            if (is_dir($viejo)) {
                if (@rename($viejo, $base)) {
                    // Migrado en el primer uso del plugin.
                } else {
                    return $viejo; // Sin permiso de rename: seguir usando la carpeta historica.
                }
            }
        }
        if (!is_dir($base)) {
            wp_mkdir_p($base);
        }
        return $base;
    }

    private function subdir($rel)
    {
        $dir = $this->base() . DIRECTORY_SEPARATOR . $rel;
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    private function ruta_pdf($archivo)
    {
        return $this->subdir('pdfs') . DIRECTORY_SEPARATOR . $archivo;
    }

    private function nombre_de($archivo)
    {
        return Metadata::nombreDesdeArchivo($archivo);
    }

    private function ruta_dataset($nombre)
    {
        return $this->subdir('datos') . DIRECTORY_SEPARATOR . $nombre . DIRECTORY_SEPARATOR . 'metadata.json';
    }

    private function dir_imagenes($nombre)
    {
        return $this->subdir('imagenes' . DIRECTORY_SEPARATOR . $nombre);
    }

    private function dir_placeholders($nombre)
    {
        return $this->subdir('placeholders' . DIRECTORY_SEPARATOR . $nombre);
    }

    private function ruta_salida($nombre)
    {
        return $this->subdir('salidas') . DIRECTORY_SEPARATOR . $nombre . '_procesado.pdf';
    }

    /** Lista de PDFs subidos (nombres de archivo, ordenados). */
    private function pdfs_subidos()
    {
        $dir = $this->subdir('pdfs');
        $out = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.pdf') as $ruta) {
            $out[] = basename($ruta);
        }
        sort($out, SORT_NATURAL | SORT_FLAG_CASE);
        return $out;
    }

    /** Imagenes cargadas de un PDF: letra => ruta. */
    private function imagenes_de($nombre)
    {
        $dir = $this->dir_imagenes($nombre);
        $out = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.*') as $ruta) {
            $letra = strtolower(pathinfo($ruta, PATHINFO_FILENAME));
            if (preg_match('/^[a-z]+$/', $letra)) {
                $out[$letra] = $ruta;
            }
        }
        ksort($out);
        return $out;
    }

    /** Dataset (o null si no existe). */
    private function dataset_de($nombre)
    {
        $ruta = $this->ruta_dataset($nombre);
        if (!is_file($ruta)) {
            return null;
        }
        try {
            return Metadata::cargar($ruta);
        } catch (\Throwable $e) {
            return null;
        }
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
        // Pestana activa: pdfs (default) | textos | ayuda (misma whitelist que page.php).
        $tab = isset($_GET['tab']) ? sanitize_key((string)$_GET['tab']) : 'pdfs';
        if (!in_array($tab, ['pdfs', 'textos', 'ayuda'], true)) {
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
            'guardarMiniaturaUrl' => admin_url('admin-post.php?action=personalizador_pdf_guardar_miniatura'),
            'guardarMiniaturaNonce' => wp_create_nonce('personalizador_pdf_guardar_miniatura'),
            'imagenesBase' => $this->url_base_textmuy_imagenes(),
        ]);
    }

    public function render_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        include PERSONALIZADOR_PDF_PATH . 'admin/page.php';
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
     * Analiza un PDF ya guardado, guarda el dataset y genera los placeholders
     * PNG descargables por grupo. Devuelve el resumen.
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
        $datos = Metadata::generar($nombre, $grupos);
        Metadata::guardar($datos, $this->ruta_dataset($nombre));
        $dir = $this->dir_placeholders($nombre);
        foreach ($grupos as $g) {
            $png = $dir . DIRECTORY_SEPARATOR . $g['letra'] . '-' . $g['ancho_px'] . 'x' . $g['alto_px'] . '.png';
            PngWriter::write($png, $g['ancho_px'], $g['alto_px']);
        }
        return [
            'nombre_pdf' => $nombre,
            'archivo' => $archivo,
            'total_paginas' => (int)$resultado['total_paginas'],
            'total_grupos' => count($grupos),
            'total_instancias' => array_sum(array_map(function ($g) {
                return (int)$g['num_instancias'];
            }, $grupos)),
        ];
    }
    /* ==================== Handlers: imagenes por grupo ==================== */

    /** Letra de grupo valida (una o mas letras minusculas). */
    private function letra_valida($letra)
    {
        return is_string($letra) && preg_match('/^[a-z]{1,3}$/', $letra);
    }

    /** Extension de imagen permitida (o null). */
    private function extension_imagen($nombre_archivo)
    {
        $ext = strtolower(pathinfo($nombre_archivo, PATHINFO_EXTENSION));
        return in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true) ? $ext : null;
    }

    /** Sube una imagen real para un grupo (a, b, c...) de un PDF. */
    public function handle_subir_imagen()
    {
        $this->seguridad('personalizador_pdf_subir_imagen');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $letra = isset($_POST['letra']) ? strtolower((string)$_POST['letra']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || !$this->letra_valida($letra)) {
            $this->redirigir(['ec_error' => 'datos_invalidos', 'ec_pdf' => $archivo]);
        }
        if (empty($_FILES['imagen']) || ($_FILES['imagen']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            $this->redirigir(['ec_error' => 'upload', 'ec_pdf' => $archivo]);
        }
        $ext = $this->extension_imagen($_FILES['imagen']['name']);
        if (!$ext) {
            $this->redirigir(['ec_error' => 'Formato de imagen no permitido (usa PNG, JPG, GIF o WebP).', 'ec_pdf' => $archivo]);
        }
        $this->guardar_imagen($archivo, $letra, $_FILES['imagen']['tmp_name'], $ext);
        $this->redirigir(['ec_imagen' => 1, 'ec_pdf' => $archivo]);
    }

    /** Toma una imagen de la galeria de medios para un grupo. */
    public function handle_imagen_galeria()
    {
        $this->seguridad('personalizador_pdf_imagen_galeria');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $letra = isset($_POST['letra']) ? strtolower((string)$_POST['letra']) : '';
        $attachment_id = isset($_POST['attachment_id']) ? (int)$_POST['attachment_id'] : 0;
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || !$this->letra_valida($letra) || $attachment_id <= 0) {
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
        $this->guardar_imagen($archivo, $letra, $ruta, $ext);
        $this->redirigir(['ec_imagen' => 1, 'ec_pdf' => $archivo]);
    }

    /** Quita la imagen asignada a un grupo. */
    public function handle_quitar_imagen()
    {
        $this->seguridad('personalizador_pdf_quitar_imagen');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $letra = isset($_POST['letra']) ? strtolower((string)$_POST['letra']) : '';
        if (!$archivo || !$this->letra_valida($letra)) {
            $this->redirigir(['ec_error' => 'datos_invalidos', 'ec_pdf' => $archivo]);
        }
        $this->quitar_imagen($archivo, $letra);
        $this->redirigir(['ec_imagen_quitada' => 1, 'ec_pdf' => $archivo]);
    }

    /** Guarda la imagen del grupo con extension normalizada (unico archivo por letra). */
    private function guardar_imagen($archivo, $letra, $origen, $ext)
    {
        $nombre = $this->nombre_de($archivo);
        $dir = $this->dir_imagenes($nombre);
        // Un solo archivo por letra: quitar variantes con otras extensiones.
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . $letra . '.*') as $vieja) {
            @unlink($vieja);
        }
        @unlink($dir . DIRECTORY_SEPARATOR . 'thumbs' . DIRECTORY_SEPARATOR . $letra . '.webp');
        if (!@copy($origen, $dir . DIRECTORY_SEPARATOR . $letra . '.' . $ext)) {
            $this->redirigir(['ec_error' => 'No se pudo guardar la imagen.', 'ec_pdf' => $archivo]);
        }
    }

    /** Elimina la imagen del grupo si existe. */
    private function quitar_imagen($archivo, $letra)
    {
        $dir = $this->dir_imagenes($this->nombre_de($archivo));
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . $letra . '.*') as $vieja) {
            @unlink($vieja);
        }
        @unlink($dir . DIRECTORY_SEPARATOR . 'thumbs' . DIRECTORY_SEPARATOR . $letra . '.webp');
    }

    /* ==================== Textos estilizados por grupo (puente TextMuy) ==================== */

    /** Ruta del estado de textos por grupo de un PDF (datos/{pdf}/textos.json). */
    private function ruta_textos($nombre)
    {
        return $this->subdir('datos') . DIRECTORY_SEPARATOR . $nombre . DIRECTORY_SEPARATOR . 'textos.json';
    }

    /** Textos guardados: letra => ['activo' => bool, 'texto' => string, 'estilo' => string]. */
    private function textos_de($nombre)
    {
        $ruta = $this->ruta_textos($nombre);
        if (!is_file($ruta)) {
            return [];
        }
        $datos = json_decode((string)file_get_contents($ruta), true);
        return is_array($datos) ? $datos : [];
    }

    /** Persiste el estado de textos (sin textos -> sin archivo). */
    private function guardar_textos($nombre, array $textos)
    {
        $ruta = $this->ruta_textos($nombre);
        if (!$textos) {
            @unlink($ruta);
            return;
        }
        @file_put_contents($ruta, json_encode($textos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Nombres de los presets del administrador (uploads/.../textmuy/presets/*.txm).
     * Desde 4.0.0 NO hay presets base versionados: todo preset vive en uploads
     * (creado desde el editor "Estilos de Texto" o migrado desde <= 3.3.0).
     */
    private function presets_base()
    {
        $dir = $this->dir_textmuy_presets();
        $out = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.txm') as $ruta) {
            $nombre = basename($ruta, '.txm');
            // Solo nombres que el propio sanitizador dejaría iguales (sin sorpresas al usarlos).
            if ($this->nombre_textmuy_seguro($nombre) === $nombre) {
                $out[] = $nombre;
            }
        }
        sort($out, SORT_NATURAL | SORT_FLAG_CASE);
        return $out;
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
     * Con $_POST['ajax']=1 responde JSON (autoguardado sin recarga); si no,
     * redirige como el resto de los handlers (compatible sin JS).
     */
    public function handle_guardar_texto()
    {
        $this->seguridad('personalizador_pdf_guardar_texto');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        $letra = isset($_POST['letra']) ? strtolower((string)$_POST['letra']) : '';
        $ajax = !empty($_POST['ajax']);
        if (!$archivo || !is_file($this->ruta_pdf($archivo)) || !$this->letra_valida($letra)) {
            if ($ajax) {
                wp_send_json_error('datos_invalidos');
            }
            $this->redirigir(['ec_error' => 'datos_invalidos', 'ec_pdf' => $archivo]);
        }
        $activo = !empty($_POST['activo']);
        $texto = isset($_POST['texto']) ? $this->limitar_texto(sanitize_text_field(wp_unslash($_POST['texto']))) : '';
        $estilo = isset($_POST['estilo']) ? sanitize_key((string)wp_unslash($_POST['estilo'])) : '';
        if ($activo && ($texto === '' || $estilo === '')) {
            if ($ajax) {
                wp_send_json_error('Escribe un texto y elige un estilo para activar el grupo.');
            }
            $this->redirigir(['ec_error' => 'texto_incompleto', 'ec_pdf' => $archivo]);
        }
        $nombre = $this->nombre_de($archivo);
        $textos = $this->textos_de($nombre);
        if ($activo) {
            $textos[$letra] = ['activo' => true, 'texto' => $texto, 'estilo' => $estilo];
        } else {
            unset($textos[$letra]);
        }
        $this->guardar_textos($nombre, $textos);
        if ($ajax) {
            wp_send_json_success(['letra' => $letra, 'activo' => $activo]);
        }
        $this->redirigir($activo
            ? ['ec_texto' => 1, 'ec_pdf' => $archivo]
            : ['ec_texto_quitado' => 1, 'ec_pdf' => $archivo]);
    }

    /* ==================== Recursos TextMuy (presets .txm + imagenes) ==================== */

    /* Desde 4.0.0 TODO el contenido del administrador vive en
     * uploads/personalizador-pdf/textmuy/{presets,imagenes}: el plugin queda de
     * solo lectura y se actualiza (ZIP o git pull) sin preservar archivos. El
     * modulo importado en modules/textmuy (opcional, se copia a mano) solo
     * aporta el codigo del editor; presets e imagenes son datos de usuario. */

    /** Indica si el modulo TextMuy esta importado en modules/textmuy (con index.html). */
    public function modulo_textmuy_disponible()
    {
        return is_file(PERSONALIZADOR_PDF_PATH . 'modules' . DIRECTORY_SEPARATOR . 'textmuy' . DIRECTORY_SEPARATOR . 'index.html');
    }

    /** Directorio de presets del administrador (uploads/personalizador-pdf/textmuy/presets). */
    private function dir_textmuy_presets()
    {
        return $this->subdir('textmuy' . DIRECTORY_SEPARATOR . 'presets');
    }

    /** Categorias de imagenes del administrador. */
    private function categorias_textmuy()
    {
        return ['fondos', 'iconos', 'varios'];
    }

    /** Directorio de imagenes del administrador (uploads/personalizador-pdf/textmuy/imagenes). */
    private function dir_textmuy_imagenes($crear = false)
    {
        return $this->subdir('textmuy' . DIRECTORY_SEPARATOR . 'imagenes');
    }

    /** URL publica de los presets (uploads/.../textmuy/presets/, con barra final). */
    private function url_base_textmuy_presets()
    {
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . 'personalizador-pdf/textmuy/presets/';
    }

    /** URL publica de las imagenes (uploads/.../textmuy/imagenes/, con barra final). */
    private function url_base_textmuy_imagenes()
    {
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . 'personalizador-pdf/textmuy/imagenes/';
    }

    /** Directorio de fuentes del administrador (uploads/personalizador-pdf/textmuy/fonts). */
    private function dir_textmuy_fonts($crear = false)
    {
        return $this->subdir('textmuy' . DIRECTORY_SEPARATOR . 'fonts');
    }

    /** URL publica de las fuentes (uploads/.../textmuy/fonts/, con barra final). */
    private function url_base_textmuy_fonts()
    {
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . 'personalizador-pdf/textmuy/fonts/';
    }

    /* ==================== Catalogos v5.0 (tuplas [id,title,cats,file]) ==================== */

    /** Ruta del catalogo unico v5.0 de un ambito (fonts.json / img.json / presets.json). */
    private function ruta_catalogo_textmuy_ambito($ambito)
    {
        if ($ambito === 'fonts') {
            return $this->dir_textmuy_fonts() . DIRECTORY_SEPARATOR . 'fonts.json';
        }
        if ($ambito === 'img') {
            // El JSON del ambito vive en textmuy/img/ (canonico del modulo:
            // presetsBase + '../img/img.json'); los archivos fisicos siguen en
            // textmuy/imagenes/ (imagenesBase y las URLs guardadas en los .txm).
            return $this->subdir('textmuy' . DIRECTORY_SEPARATOR . 'img') . DIRECTORY_SEPARATOR . 'img.json';
        }
        if ($ambito === 'presets') {
            return $this->dir_textmuy_presets() . DIRECTORY_SEPARATOR . 'presets.json';
        }
        return '';
    }

    /** Grilla del sprite por ambito (thumbs del catalogo; filas derivables). */
    private function thumbs_textmuy_ambito($ambito)
    {
        if ($ambito === 'fonts') {
            return ['w' => 180, 'h' => 30, 'c' => 4];
        }
        if ($ambito === 'img') {
            return ['w' => 100, 'h' => 100, 'c' => 8];
        }
        return ['w' => 200, 'h' => 100, 'c' => 4]; // presets
    }

    /** Lee el catalogo v5.0 de un ambito. Sin migradores: si falta o esta en
     * otro formato, devuelve el catalogo canonico vacio (los datos del admin
     * se crean desde cero). */
    private function catalogo_textmuy($ambito)
    {
        $cat = ['thumbs' => $this->thumbs_textmuy_ambito($ambito), 'items' => []];
        $ruta = $this->ruta_catalogo_textmuy_ambito($ambito);
        if ($ruta === '' || !is_file($ruta)) {
            return $cat;
        }
        $datos = json_decode((string)file_get_contents($ruta), true);
        if (is_array($datos) && isset($datos['thumbs'], $datos['items']) && is_array($datos['items'])) {
            $cat['thumbs'] = $datos['thumbs'];
            $cat['items'] = array_values(array_filter($datos['items'], 'is_array'));
        }
        return $cat;
    }

    /** Escribe el catalogo v5.0 de un ambito. */
    private function guardar_catalogo_textmuy($ambito, $cat)
    {
        $ruta = $this->ruta_catalogo_textmuy_ambito($ambito);
        if ($ruta === '') {
            return false;
        }
        return @file_put_contents($ruta, wp_json_encode($cat, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false;
    }

    /** Id de la tupla cuyo file coincide. 0 si no esta. */
    private function tupla_textmuy_id_de_file($items, $file)
    {
        foreach ((array)$items as $t) {
            if (is_array($t) && count($t) >= 4 && (string)$t[3] === (string)$file) {
                return (int)$t[0];
            }
        }
        return 0;
    }

    /** Alta v5.0: reutiliza el tombstone mas bajo o anexa max(id)+1. Devuelve el id. */
    private function tupla_textmuy_alta(&$items, $title, $cats, $file)
    {
        $maxId = 0;
        $hueco = 0;
        foreach ((array)$items as $t) {
            if (!is_array($t) || count($t) < 4) continue;
            $id = (int)$t[0];
            if ($id > $maxId) $maxId = $id;
            if ((string)$t[1] === '' && (string)$t[2] === '' && (string)$t[3] === ''
                && ($hueco === 0 || $id < $hueco)) {
                $hueco = $id;
            }
        }
        if ($hueco > 0) {
            foreach ($items as $i => $t) {
                if (is_array($t) && (int)$t[0] === $hueco) {
                    $items[$i] = [$hueco, $title, $cats, $file];
                    return $hueco;
                }
            }
        }
        $items[] = [$maxId + 1, $title, $cats, $file];
        return $maxId + 1;
    }

    /** Baja v5.0: escribe tombstone [id,"","",""] sin reindexar. */
    private function tupla_textmuy_baja(&$items, $id)
    {
        foreach ($items as $i => $t) {
            if (is_array($t) && (int)$t[0] === (int)$id) {
                $items[$i] = [(int)$id, '', '', ''];
                return true;
            }
        }
        return false;
    }
    /** Valida firma binaria (magic bytes) de fuentes TTF/OTF/WOFF/WOFF2. */
    private function firma_fuente_valida($ruta, $ext)
    {
        $f = @fopen($ruta, 'rb');
        if (!$f) {
            return false;
        }
        $bytes = (string)@fread($f, 4);
        @fclose($f);
        if (strlen($bytes) < 4) {
            return false;
        }
        switch ($ext) {
            case 'ttf':
                return $bytes === "   " || $bytes === 'true';
            case 'otf':
                return $bytes === 'OTTO';
            case 'woff':
                return $bytes === 'wOFF';
            case 'woff2':
                return $bytes === 'wOF2';
        }
        return false;
    }

    /** Resuelve la ruta de una imagen en imagenes/ flat. */
    private function ruta_textmuy_imagen($nombre, $categoria = '')
    {
        $ruta = $this->dir_textmuy_imagenes() . DIRECTORY_SEPARATOR . $nombre;
        return is_file($ruta) ? $ruta : '';
    }

    /** Nombre de preset/imagen seguro: minusculas, [a-z0-9_-], sin puntos ni barras. */
    private function nombre_textmuy_seguro($nombre)
    {
        $limpio = strtolower((string)$nombre);
        $limpio = preg_replace('/[^a-z0-9_-]+/', '-', $limpio);
        $limpio = preg_replace('/^-+|-+$/', '', (string)$limpio);
        return substr($limpio, 0, 64);
    }

    /** Verifica la firma (magic bytes) de una imagen segun su extension. */
    private function firma_imagen_valida($ruta, $ext)
    {
        $firma = (string)@file_get_contents($ruta, false, null, 0, 12);
        if ($ext === 'png') {
            return $firma === "\x89PNG\r\n\x1a\n";
        }
        if ($ext === 'jpg' || $ext === 'jpeg') {
            return substr($firma, 0, 3) === "\xFF\xD8\xFF";
        }
        if ($ext === 'webp') {
            return strlen($firma) >= 12 && substr($firma, 0, 4) === 'RIFF' && substr($firma, 8, 4) === 'WEBP';
        }
        if ($ext === 'svg') {
            return strpos($firma, '<') !== false || substr($firma, 0, 5) === '<?xml';
        }
        return false;
    }

    /**
     * Listado de recursos TextMuy para el iframe de "Estilos de Texto":
     * presets (*.txm) e imagenes subidas con categoria, indicador "en uso"
     * (cuantos presets .txm referencian su URL) y cache-bust por mtime.
     * Todo desde uploads/personalizador-pdf/textmuy/ (v4.0.0).
     */
    private function recursos_textmuy()
    {
        $presets = [];
        $contenidosPresets = '';
        foreach ((array)glob($this->dir_textmuy_presets() . DIRECTORY_SEPARATOR . '*.txm') as $ruta) {
            $nombre = basename($ruta, '.txm');
            if ($this->nombre_textmuy_seguro($nombre) === $nombre) {
                $presets[] = $nombre;
                $contenidosPresets .= (string)@file_get_contents($ruta);
            }
        }
        sort($presets, SORT_NATURAL | SORT_FLAG_CASE);

        $urlBase = $this->url_base_textmuy_imagenes();
        $imagenes = [];
        // Catalogo unico v5.0 (img/img.json): tuplas [id,title,cats,file].
        foreach ($this->catalogo_textmuy('img')['items'] as $t) {
            if (!is_array($t) || count($t) < 4 || (string)$t[3] === '') continue; // tombstone/rota: fuera
            $archivo = (string)$t[3];
            $ruta = $this->ruta_textmuy_imagen($archivo);
            if ($ruta === '') continue; // fisico ausente: cero 404
            $urlLimpia = $urlBase . rawurlencode($archivo);
            $enUso = ($contenidosPresets !== '' && strpos($contenidosPresets, $urlLimpia) !== false) ? 1 : 0;
            $cats = $t[2];
            if (is_array($cats)) {
                $categoria = (string)($cats[0] ?? 'varios');
            } else {
                $categoria = trim((string)$cats);
                if ($categoria === '') $categoria = 'varios';
            }
            $imagenes[] = [
                'nombre' => $archivo,
                'categoria' => $categoria,
                'titulo' => ((string)$t[1] !== '' ? (string)$t[1] : $archivo),
                'url' => $urlLimpia . '?v=' . (int)@filemtime($ruta),
                // Miniatura via sprite ThumbEngine (guardarSprite): sin thumbs/ por item.
                'thumb' => '',
                'enUso' => $enUso,
            ];
        }
        usort($imagenes, function ($a, $b) {
            return strcmp($a['categoria'], $b['categoria']) ?: strcasecmp($a['nombre'], $b['nombre']);
        });

        $urlFonts = $this->url_base_textmuy_fonts();
        $fuentes = [];
        $dirFonts = $this->dir_textmuy_fonts();
        // Catalogo unico v5.0 (fonts/fonts.json): tuplas [id,title,cats,file].
        foreach ($this->catalogo_textmuy('fonts')['items'] as $t) {
            if (!is_array($t) || count($t) < 4) continue;
            $archivo = (string)$t[3];
            // SOLO fuentes fisicas reales (archivo existente + extension de
            // fuente): las Google (file sin extension) NO van a bridge.fuentes
            // porque el iframe intentaria FontFace contra una URL inexistente.
            // El modulo lee las Google por su cuenta (loadCatalogo('fonts')).
            if ($archivo === '' || !preg_match('/\.(ttf|otf|woff|woff2)$/i', $archivo)) continue;
            if (!is_file($dirFonts . DIRECTORY_SEPARATOR . $archivo)) continue;
            $fuentes[] = [
                'nombre' => $archivo,
                'titulo' => ((string)$t[1] !== '' ? (string)$t[1] : pathinfo($archivo, PATHINFO_FILENAME)),
                'ext' => pathinfo($archivo, PATHINFO_EXTENSION),
                'url' => $urlFonts . rawurlencode($archivo) . '?v=' . (int)@filemtime($dirFonts . DIRECTORY_SEPARATOR . $archivo),
            ];
        }
        return ['presets' => $presets, 'imagenes' => $imagenes, 'fuentes' => $fuentes];
    }

    /**
     * Guarda un preset del editor TextMuy como par {nombre}.txm + {nombre}.webp en
     * uploads/personalizador-pdf/textmuy/presets. Siempre responde JSON (lo consume fetch desde el
     * iframe, nunca un redirect de consola).
     */
    public function handle_textmuy_guardar_preset()
    {
        $this->seguridad('personalizador_pdf_textmuy_guardar_preset');
        $nombre = $this->nombre_textmuy_seguro(isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '');
        if ($nombre === '') {
            wp_send_json_error('Nombre de preset no valido.');
        }
        if (empty($_FILES['txm']) || !is_array($_FILES['txm']) || ($_FILES['txm']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            wp_send_json_error('No se recibio el archivo .txm del preset.');
        }
        $txm = $_FILES['txm'];
        if ($txm['size'] > 2 * 1024 * 1024) {
            wp_send_json_error('El preset supera el tamano maximo (2 MB el .txm).');
        }
        // El .txm debe ser JSON valido del formato textmuy-project (delta de settings).
        $payload = json_decode((string)file_get_contents($txm['tmp_name']), true);
        if (!is_array($payload)
            || (isset($payload['format']) ? $payload['format'] : '') !== 'textmuy-project'
            || !is_array($payload['settings'] ?? null)
        ) {
            wp_send_json_error('El archivo .txm no tiene el formato textmuy-project esperado.');
        }
        $dir = $this->dir_textmuy_presets();
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            wp_send_json_error(
                'El directorio de presets no es escribible en este hosting. '
                . 'Verifica los permisos de wp-content/uploads/personalizador-pdf/textmuy/presets.'
            );
        }
        @unlink($dir . DIRECTORY_SEPARATOR . $nombre . '.webp'); // resto deprecado de miniaturas por item
        $rutaTxm = $dir . DIRECTORY_SEPARATOR . $nombre . '.txm';
        if (!@move_uploaded_file($txm['tmp_name'], $rutaTxm)) {
            wp_send_json_error('No se pudo escribir el preset en el directorio de datos.');
        }
        // Catalogo v5.0: upsert de la tupla [id,nombre,'custom',nombre.txm].
        $cat = $this->catalogo_textmuy('presets');
        $id = $this->tupla_textmuy_id_de_file($cat['items'], $nombre . '.txm');
        if ($id > 0) {
            foreach ($cat['items'] as $i => $t) {
                if ((int)$t[0] === $id) {
                    $cat['items'][$i] = [$id, $nombre, 'custom', $nombre . '.txm'];
                    break;
                }
            }
        } else {
            $id = $this->tupla_textmuy_alta($cat['items'], $nombre, 'custom', $nombre . '.txm');
        }
        $this->guardar_catalogo_textmuy('presets', $cat);
        wp_send_json_success(['nombre' => $nombre, 'id' => $id]);
    }

    /** Borra el par {nombre}.txm + {nombre}.webp de uploads/.../textmuy/presets. */
    public function handle_textmuy_borrar_preset()
    {
        $this->seguridad('personalizador_pdf_textmuy_borrar_preset');
        $nombre = $this->nombre_textmuy_seguro(isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '');
        if ($nombre === '') {
            wp_send_json_error('Nombre de preset no valido.');
        }
        $dir = $this->dir_textmuy_presets();
        @unlink($dir . DIRECTORY_SEPARATOR . $nombre . '.txm');
        @unlink($dir . DIRECTORY_SEPARATOR . $nombre . '.webp');
        // Catalogo v5.0: baja = tombstone [id,"","",""] (sin reindexar).
        $cat = $this->catalogo_textmuy('presets');
        $id = $this->tupla_textmuy_id_de_file($cat['items'], $nombre . '.txm');
        if ($id > 0) {
            $this->tupla_textmuy_baja($cat['items'], $id);
            $this->guardar_catalogo_textmuy('presets', $cat);
        }
        wp_send_json_success(['nombre' => $nombre, 'id' => $id]);
    }

    /**
     * Sube una imagen para rellenos/fondos/texturas/iconos del editor TextMuy a
     * uploads/personalizador-pdf/textmuy/imagenes y devuelve su URL publica (misma
     * origen que el iframe: el canvas puede usarla sin CORS).
     * POST: imagen (archivo), categoria (fondos|iconos|varios), nombre
     * (opcional, para guardar una edicion), sobrescribir (1 => pisar el archivo
     * destino en vez de generar -2, -3...).
     */
    public function handle_textmuy_subir_imagen()
    {
        $this->seguridad('personalizador_pdf_textmuy_subir_imagen');
        if (empty($_FILES['imagen']) || !is_array($_FILES['imagen']) || ($_FILES['imagen']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            wp_send_json_error('No se recibio la imagen.');
        }
        $file = $_FILES['imagen'];
        if ($file['size'] > 4 * 1024 * 1024) {
            wp_send_json_error('La imagen supera el tamano maximo (4 MB).');
        }
        $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'svg'], true)) {
            wp_send_json_error('Formato no permitido (usa PNG, JPG, WebP o SVG).');
        }
        if (!$this->firma_imagen_valida($file['tmp_name'], $ext)) {
            wp_send_json_error('El archivo no es una imagen valida.');
        }
        $categoria = $this->nombre_textmuy_seguro(isset($_POST['categoria']) ? wp_unslash($_POST['categoria']) : 'varios');
        if (!in_array($categoria, $this->categorias_textmuy(), true)) {
            $categoria = 'varios';
        }
        $sobrescribir = !empty($_POST['sobrescribir']);
        $dir = $this->dir_textmuy_imagenes(true);
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            wp_send_json_error(
                'El directorio de imagenes no es escribible en este hosting. '
                . 'Verifica los permisos de wp-content/uploads/personalizador-pdf/textmuy/imagenes.'
            );
        }
        $nombreSugerido = isset($_POST['nombre']) ? $this->nombre_textmuy_seguro(wp_unslash($_POST['nombre'])) : '';
        $base = $nombreSugerido !== '' ? $nombreSugerido : $this->nombre_textmuy_seguro(pathinfo((string)$file['name'], PATHINFO_FILENAME));
        if ($base === '') {
            $base = 'imagen';
        }
        $destino = $base . '.' . $ext;
        if (!$sobrescribir) {
            $i = 2;
            while (is_file($dir . DIRECTORY_SEPARATOR . $destino)) {
                $destino = $base . '-' . $i . '.' . $ext;
                $i++;
            }
        }
        if (!@move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $destino)) {
            wp_send_json_error('No se pudo guardar la imagen.');
        }
        // Catalogo v5.0: alta de tupla [id,titulo,cats,file] (id = hueco mas
        // bajo o max+1; el tile del sprite deriva de id-1).
        $cat = $this->catalogo_textmuy('img');
        $id = $this->tupla_textmuy_alta(
            $cat['items'],
            pathinfo($destino, PATHINFO_FILENAME),
            ($categoria !== '' ? $categoria : 'varios'),
            $destino
        );
        $this->guardar_catalogo_textmuy('img', $cat);
        $rutaDestino = $dir . DIRECTORY_SEPARATOR . $destino;
        wp_send_json_success([
            'nombre' => $destino,
            'categoria' => $categoria,
            'id' => $id,
            'url' => $this->url_base_textmuy_imagenes() . rawurlencode($destino)
                . '?v=' . (int)@filemtime($rutaDestino),
        ]);
    }

    /** Borra una imagen del modulo. POST: nombre + categoria. */
    public function handle_textmuy_borrar_imagen()
    {
        $this->seguridad('personalizador_pdf_textmuy_borrar_imagen');
        $nombre = $this->nombre_textmuy_seguro(isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '');
        $categoria = $this->nombre_textmuy_seguro(isset($_POST['categoria']) ? wp_unslash($_POST['categoria']) : '');
        if ($nombre === '' || !preg_match('/[.](png|jpe?g|webp|svg)$/i', $nombre)) {
            wp_send_json_error('Nombre de imagen no valido.');
        }
        $ruta = $this->ruta_textmuy_imagen($nombre, $categoria);
        if ($ruta === '') {
            wp_send_json_error('La imagen no existe.');
        }
        if (!@unlink($ruta)) {
            wp_send_json_error('No se pudo borrar la imagen (permisos del directorio).');
        }
        // Catalogo v5.0: baja = tombstone (sin reindexar). Sin thumbs/ por item.
        $cat = $this->catalogo_textmuy('img');
        $id = $this->tupla_textmuy_id_de_file($cat['items'], $nombre);
        if ($id > 0) {
            $this->tupla_textmuy_baja($cat['items'], $id);
            $this->guardar_catalogo_textmuy('img', $cat);
        }
        wp_send_json_success(['nombre' => $nombre, 'id' => $id]);
    }

    /**
     * Renombra y/o mueve de categoria una imagen del modulo.
     * POST: nombre, categoria, nombreNuevo, categoriaNueva.
     */
    public function handle_textmuy_cambiar_imagen()
    {
        $this->seguridad('personalizador_pdf_textmuy_cambiar_imagen');
        $nombre = $this->nombre_textmuy_seguro(isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '');
        $categoria = $this->nombre_textmuy_seguro(isset($_POST['categoria']) ? wp_unslash($_POST['categoria']) : '');
        $nombreNuevo = $this->nombre_textmuy_seguro(isset($_POST['nombreNuevo']) ? wp_unslash($_POST['nombreNuevo']) : '');
        $categoriaNueva = $this->nombre_textmuy_seguro(isset($_POST['categoriaNueva']) ? wp_unslash($_POST['categoriaNueva']) : 'varios');
        if ($nombre === '' || $nombreNuevo === '' || !in_array($categoriaNueva, $this->categorias_textmuy(), true)) {
            wp_send_json_error('Datos no validos para renombrar la imagen.');
        }
        $origen = $this->ruta_textmuy_imagen($nombre, $categoria);
        if ($origen === '') {
            wp_send_json_error('La imagen no existe.');
        }
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        $dirDestino = $this->dir_textmuy_imagenes(true);
        if (!is_dir($dirDestino) || !wp_is_writable($dirDestino)) {
            wp_send_json_error('El directorio de imagenes del modulo no es escribible.');
        }
        $destino = $dirDestino . DIRECTORY_SEPARATOR . $nombreNuevo . '.' . $ext;
        if ($destino !== $origen) {
            $i = 2;
            while (is_file($destino)) {
                $destino = $dirDestino . DIRECTORY_SEPARATOR . $nombreNuevo . '-' . $i . '.' . $ext;
                $i++;
            }
            if (!@rename($origen, $destino)) {
                wp_send_json_error('No se pudo renombrar/mover la imagen.');
            }
        }
        $nombreFinal = basename($destino);
        // Catalogo v5.0: actualizar la tupla (file nuevo + categoria); si el
        // archivo no estaba en el catalogo, dar de alta.
        $cat = $this->catalogo_textmuy('img');
        $id = $this->tupla_textmuy_id_de_file($cat['items'], $nombre);
        if ($id > 0) {
            foreach ($cat['items'] as $i => $t) {
                if ((int)$t[0] === $id) {
                    $cat['items'][$i] = [$id, ((string)$t[1] !== '' ? $t[1] : pathinfo($nombreFinal, PATHINFO_FILENAME)), ($categoriaNueva !== '' ? $categoriaNueva : $t[2]), $nombreFinal];
                    break;
                }
            }
        } else {
            $id = $this->tupla_textmuy_alta($cat['items'], pathinfo($nombreFinal, PATHINFO_FILENAME), ($categoriaNueva !== '' ? $categoriaNueva : 'varios'), $nombreFinal);
        }
        $this->guardar_catalogo_textmuy('img', $cat);
        wp_send_json_success([
            'nombre' => $nombreFinal,
            'categoria' => $categoriaNueva,
            'url' => $this->url_base_textmuy_imagenes() . rawurlencode($nombreFinal)
                . '?v=' . (int)@filemtime($destino),
        ]);
    }

    /** Sube una fuente (TTF/OTF/WOFF/WOFF2) al servidor. POST: fuente, titulo opcional. */
    public function handle_textmuy_subir_fuente()
    {
        $this->seguridad('personalizador_pdf_textmuy_subir_fuente');
        if (empty($_FILES['fuente']) || !is_array($_FILES['fuente']) || ($_FILES['fuente']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            wp_send_json_error('No se recibio el archivo de fuente.');
        }
        $file = $_FILES['fuente'];
        if ($file['size'] > 10 * 1024 * 1024) { // max 10 MB
            wp_send_json_error('La fuente supera el tamano maximo (10 MB).');
        }
        $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['ttf', 'otf', 'woff', 'woff2'], true)) {
            wp_send_json_error('Formato no permitido (usa TTF, OTF, WOFF o WOFF2).');
        }
        if (!$this->firma_fuente_valida($file['tmp_name'], $ext)) {
            wp_send_json_error('El archivo no parece ser una fuente valida.');
        }
        $dir = $this->dir_textmuy_fonts(true);
        if (!is_dir($dir) && !wp_mkdir_p($dir)) {
            wp_send_json_error('No se pudo crear el directorio de fuentes.');
        }
        $base = $this->nombre_textmuy_seguro(pathinfo((string)$file['name'], PATHINFO_FILENAME));
        if ($base === '') {
            $base = 'fuente';
        }
        $destino = $base . '.' . $ext;
        $i = 2;
        while (is_file($dir . DIRECTORY_SEPARATOR . $destino)) {
            $destino = $base . '-' . $i . '.' . $ext;
            $i++;
        }
        if (!@move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $destino)) {
            wp_send_json_error('No se pudo guardar la fuente en el servidor.');
        }

        $titulo = isset($_POST['titulo']) ? sanitize_text_field(wp_unslash($_POST['titulo'])) : '';
        if ($titulo === '') {
            $titulo = $base;
        }

        // Catalogo v5.0: alta de tupla [id,titulo,cats,file] (id = hueco mas
        // bajo o max+1). Google = file sin extension; aqui siempre fisica.
        $cat = $this->catalogo_textmuy('fonts');
        $id = $this->tupla_textmuy_alta($cat['items'], $titulo, 'custom', $destino);
        $this->guardar_catalogo_textmuy('fonts', $cat);

        $url = $this->url_base_textmuy_fonts() . rawurlencode($destino) . '?v=' . (int)@filemtime($dir . DIRECTORY_SEPARATOR . $destino);
        wp_send_json_success([
            'nombre' => $destino,
            'titulo' => $titulo,
            'ext' => $ext,
            'url' => $url,
        ]);
    }

    /** Borra una fuente del servidor. POST: nombre */
    public function handle_textmuy_borrar_fuente()
    {
        $this->seguridad('personalizador_pdf_textmuy_borrar_fuente');
        $nombre = $this->nombre_textmuy_seguro(isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '');
        if ($nombre === '' || !preg_match('/[.](ttf|otf|woff|woff2)$/i', $nombre)) {
            wp_send_json_error('Nombre de fuente no valido.');
        }
        $dir = $this->dir_textmuy_fonts();
        $ruta = $dir . DIRECTORY_SEPARATOR . $nombre;
        if (is_file($ruta) && !@unlink($ruta)) {
            wp_send_json_error('No se pudo borrar el archivo de fuente.');
        }
        // Catalogo v5.0: baja = tombstone por file (sin reindexar).
        $cat = $this->catalogo_textmuy('fonts');
        $id = $this->tupla_textmuy_id_de_file($cat['items'], $nombre);
        if ($id > 0) {
            $this->tupla_textmuy_baja($cat['items'], $id);
            $this->guardar_catalogo_textmuy('fonts', $cat);
        }

        wp_send_json_success(['nombre' => $nombre, 'id' => $id]);
    }

    /** Renombra y/o cambia la categoria de una fuente fisica (tupla v5.0).
     * POST: nombre, nombreNuevo, categoriaNueva. */
    public function handle_textmuy_cambiar_fuente()
    {
        $this->seguridad('personalizador_pdf_textmuy_cambiar_fuente');
        $nombre = $this->nombre_textmuy_seguro(isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '');
        $nombreNuevo = $this->nombre_textmuy_seguro(isset($_POST['nombreNuevo']) ? wp_unslash($_POST['nombreNuevo']) : '');
        $categoriaNueva = $this->nombre_textmuy_seguro(isset($_POST['categoriaNueva']) ? wp_unslash($_POST['categoriaNueva']) : '');
        if ($nombre === '' || $nombreNuevo === '' || !preg_match('/[.](ttf|otf|woff|woff2)$/i', $nombre)) {
            wp_send_json_error('Datos de fuente no validos.');
        }
        $dir = $this->dir_textmuy_fonts();
        $origen = $dir . DIRECTORY_SEPARATOR . $nombre;
        if (!is_file($origen)) {
            wp_send_json_error('La fuente no existe.');
        }
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        $destino = $dir . DIRECTORY_SEPARATOR . $nombreNuevo . '.' . $ext;
        if ($destino !== $origen) {
            $i = 2;
            while (is_file($destino)) {
                $destino = $dir . DIRECTORY_SEPARATOR . $nombreNuevo . '-' . $i . '.' . $ext;
                $i++;
            }
            if (!@rename($origen, $destino)) {
                wp_send_json_error('No se pudo renombrar la fuente.');
            }
        }
        $archivoFinal = basename($destino);
        // Catalogo v5.0: actualizar la tupla (file nuevo + categoria; title se conserva).
        $cat = $this->catalogo_textmuy('fonts');
        $id = $this->tupla_textmuy_id_de_file($cat['items'], $nombre);
        $titulo = $nombreNuevo;
        if ($id > 0) {
            foreach ($cat['items'] as $i => $t) {
                if ((int)$t[0] === $id) {
                    if ((string)$t[1] !== '') $titulo = (string)$t[1];
                    $cat['items'][$i] = [$id, $titulo, ($categoriaNueva !== '' ? $categoriaNueva : $t[2]), $archivoFinal];
                    break;
                }
            }
        } else {
            $id = $this->tupla_textmuy_alta($cat['items'], $titulo, ($categoriaNueva !== '' ? $categoriaNueva : 'custom'), $archivoFinal);
        }
        $this->guardar_catalogo_textmuy('fonts', $cat);
        wp_send_json_success([
            'nombre' => $archivoFinal,
            'titulo' => $titulo,
            'ext' => $ext,
            'url' => $this->url_base_textmuy_fonts() . rawurlencode($archivoFinal) . '?v=' . (int)@filemtime($destino),
        ]);
    }
    /**
     * Guarda miniatura individual .webp (grupos de PDF y fallback).
     * POST: webp (archivo), nombre (string ej. 'diploma-a' o nombre-imagen)
     */
    public function handle_guardar_miniatura()
    {
        $this->seguridad('personalizador_pdf_guardar_miniatura');
        if (empty($_FILES['webp']) || !is_array($_FILES['webp']) || ($_FILES['webp']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            wp_send_json_error('No se recibio la miniatura.');
        }
        $file = $_FILES['webp'];
        if ($file['size'] > 500 * 1024) { // max 500 KB
            wp_send_json_error('La miniatura supera el tamano maximo (500 KB).');
        }
        if (!$this->firma_imagen_valida($file['tmp_name'], 'webp')) {
            wp_send_json_error('El archivo no es una imagen WebP valida.');
        }

        $nombreRaw = isset($_POST['nombre']) ? wp_unslash($_POST['nombre']) : '';
        $nombre = $this->nombre_textmuy_seguro($nombreRaw);
        if ($nombre === '') {
            $nombre = uniqid('thumb_', true);
        }

        $thumbDir = $this->dir_textmuy_imagenes() . DIRECTORY_SEPARATOR . 'thumbs';
        if (!is_dir($thumbDir) && !wp_mkdir_p($thumbDir)) {
            wp_send_json_error('No se pudo crear el directorio de miniaturas.');
        }

        $destino = $thumbDir . DIRECTORY_SEPARATOR . $nombre . '.webp';
        if (!@move_uploaded_file($file['tmp_name'], $destino)) {
            wp_send_json_error('No se pudo guardar la miniatura.');
        }

        $url = $this->url_base_textmuy_imagenes() . 'thumbs/' . rawurlencode($nombre) . '.webp?v=' . (int)@filemtime($destino);
        wp_send_json_success(['url' => $url, 'nombre' => $nombre]);
    }

    /**
     * Guarda sprite global .webp + manifiesto .json.
     * POST: sprite (archivo), manifest (JSON string), scope ('imagenes'|'fuentes'|'presets')
     */
    public function handle_guardar_sprite()
    {
        $this->seguridad('personalizador_pdf_guardar_sprite');
        if (empty($_FILES['sprite']) || !is_array($_FILES['sprite']) || ($_FILES['sprite']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            wp_send_json_error('No se recibio el archivo sprite.');
        }
        $file = $_FILES['sprite'];
        if ($file['size'] > 4 * 1024 * 1024) { // max 4 MB
            wp_send_json_error('El sprite supera el tamano maximo (4 MB).');
        }
        if (empty($_POST['manifest']) || empty($_POST['scope'])) {
            wp_send_json_error('Faltan datos de scope o manifiesto.');
        }
        $scope = $this->nombre_textmuy_seguro(wp_unslash($_POST['scope']));
        $manifestRaw = wp_unslash($_POST['manifest']);
        $manifest = json_decode($manifestRaw, true);
        if (!is_array($manifest)) {
            wp_send_json_error('El manifiesto no es un JSON valido.');
        }

        // Directorio y base URL segun scope
        $thumbDir = '';
        $baseUrl = '';
        if ($scope === 'imagenes') {
            $thumbDir = $this->dir_textmuy_imagenes(true) . DIRECTORY_SEPARATOR . 'thumbs';
            $baseUrl = $this->url_base_textmuy_imagenes() . 'thumbs/';
        } elseif ($scope === 'fuentes') {
            $thumbDir = $this->dir_textmuy_fonts(true) . DIRECTORY_SEPARATOR . 'thumbs';
            $baseUrl = $this->url_base_textmuy_fonts() . 'thumbs/';
        } elseif ($scope === 'presets') {
            $thumbDir = $this->dir_textmuy_presets(true) . DIRECTORY_SEPARATOR . 'thumbs';
            $baseUrl = $this->url_base_textmuy_presets() . 'thumbs/';
        } else {
            wp_send_json_error('Scope no valido (usa imagenes, fuentes o presets).');
        }

        if (!is_dir($thumbDir) && !wp_mkdir_p($thumbDir)) {
            wp_send_json_error('No se pudo crear el directorio de miniaturas.');
        }

        $destinoSprite = $thumbDir . DIRECTORY_SEPARATOR . $scope . '.webp';
        $destinoManifest = $thumbDir . DIRECTORY_SEPARATOR . $scope . '.json';

        if (!@move_uploaded_file($file['tmp_name'], $destinoSprite)) {
            wp_send_json_error('No se pudo guardar el sprite en el servidor.');
        }

        if (@file_put_contents($destinoManifest, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            @unlink($destinoSprite);
            wp_send_json_error('No se pudo guardar el manifiesto.');
        }

        $mtime = (int)@filemtime($destinoSprite);
        $urlSprite = $baseUrl . rawurlencode($scope) . '.webp?v=' . $mtime;
        $urlManifest = $baseUrl . rawurlencode($scope) . '.json?v=' . $mtime;

        wp_send_json_success([
            'spriteUrl' => $urlSprite,
            'manifestUrl' => $urlManifest,
            'scope' => $scope,
        ]);
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
        if (!@move_uploaded_file($file['tmp_name'], $this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'move']);
        }
        if ($existe && $modo === 'sobrescribir') {
            $this->limpiar_datos_de($this->nombre_de($archivo));
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

    /** Re-analiza un PDF ya subido y regenera su dataset + placeholders. */
    public function handle_reanalizar()
    {
        $this->seguridad('personalizador_pdf_reanalizar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'pdf_inexistente']);
        }
        try {
            $this->analizar_y_guardar($archivo);
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        $this->redirigir(['ec_reanalizado' => 1, 'ec_pdf' => $archivo]);
    }

    /** Borra un PDF subido con todo su dataset, imagenes y salida. */
    public function handle_borrar()
    {
        $this->seguridad('personalizador_pdf_borrar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'pdf_inexistente']);
        }
        $nombre = $this->nombre_de($archivo);
        @unlink($this->ruta_pdf($archivo));
        $this->limpiar_datos_de($nombre);
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

    /** Borra dataset, imagenes, placeholders y salida de un nombre de PDF. */
    private function limpiar_datos_de($nombre)
    {
        foreach ([
            $this->subdir('datos') . DIRECTORY_SEPARATOR . $nombre,
            $this->dir_imagenes($nombre),
            $this->dir_placeholders($nombre),
        ] as $dir) {
            if (is_dir($dir)) {
                foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*') as $f) {
                    @unlink($f);
                }
                @rmdir($dir);
            }
        }
        @unlink($this->ruta_salida($nombre));
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
        $datos = $this->dataset_de($nombre);
        if (!$datos) {
            $this->redirigir(['ec_error' => 'Este PDF no tiene datos analizados. Usa "Re-analizar".', 'ec_pdf' => $archivo]);
        }

        /* === Puente TextMuy (v3.1): texto + estilo por grupo, 1 click === */

        $letras_dataset = [];
        foreach (($datos['grupos'] ?? []) as $g) {
            $letras_dataset[$g['letra']] = true;
        }

        // 1) Persistir texto/estilo por grupo (mismo POST => estado coherente con lo procesado).
        $textos = $this->textos_de($nombre);
        foreach ($_POST as $campo => $valor) {
            if (!is_string($campo) || !preg_match('/^texto_([a-z]{1,3})$/', $campo, $m)) {
                continue;
            }
            $letra = $m[1];
            if (!isset($letras_dataset[$letra])) {
                continue; // Letra que ya no existe en el dataset actual.
            }
            $estilo = isset($_POST['estilo_' . $letra]) ? sanitize_key((string)wp_unslash($_POST['estilo_' . $letra])) : '';
            $texto = $this->limitar_texto(sanitize_text_field(wp_unslash($valor)));
            if ($texto !== '' && $estilo !== '') {
                $textos[$letra] = ['activo' => true, 'texto' => $texto, 'estilo' => $estilo];
            } else {
                unset($textos[$letra]);
            }
        }
        $this->guardar_textos($nombre, $textos);

        // 2) PNGs renderizados por el navegador (imagen_{letra}) -> imagen del grupo.
        foreach ($_FILES as $campo => $file) {
            if (!is_string($campo) || !preg_match('/^imagen_([a-z]{1,3})$/', $campo, $m)) {
                continue;
            }
            $letra = $m[1];
            if (!isset($letras_dataset[$letra])) {
                continue; // Nunca guardar archivos de letras inexistentes.
            }
            if (!is_array($file) || ($file['error'] ?? 1) !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
                $this->redirigir([
                    'ec_error' => 'No se pudo recibir el texto renderizado del grupo ' . strtoupper($letra)
                        . ' (revisa el tamano maximo de subida del servidor).',
                    'ec_pdf' => $archivo,
                ]);
            }
            // Firma PNG: evitar guardar como imagen algo que no sea un PNG del render.
            $firma = (string)@file_get_contents($file['tmp_name'], false, null, 0, 8);
            if ($firma !== "\x89PNG\r\n\x1a\n") {
                $this->redirigir([
                    'ec_error' => 'El archivo del grupo ' . strtoupper($letra) . ' no es un PNG valido.',
                    'ec_pdf' => $archivo,
                ]);
            }
            $this->guardar_imagen($archivo, $letra, $file['tmp_name'], 'png');
        }

        /* === Fin puente: el motor sigue recibiendo imagenes por letra, sin cambios === */

        $rutas = $this->imagenes_de($nombre);
        try {
            $resultado = Motor::procesar($this->ruta_pdf($archivo), $datos, $rutas);
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
        $nombre = $archivo ? $this->nombre_de($archivo) : '';
        $ruta = '';
        $descargar_como = '';
        switch ($tipo) {
            case 'pdf':
                $ruta = $this->ruta_pdf($archivo);
                $descargar_como = $archivo;
                break;
            case 'datos':
                $ruta = $this->ruta_dataset($nombre);
                $descargar_como = $nombre . '-metadata.json';
                break;
            case 'placeholder':
                $nombreArchivo = isset($_GET['png']) ? basename($_GET['png']) : '';
                $ruta = $this->dir_placeholders($nombre) . DIRECTORY_SEPARATOR . $nombreArchivo;
                $descargar_como = $nombreArchivo;
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

    /** Sirve imagenes y placeholders en linea (previews <img>). */
    public function handle_ver()
    {
        $this->seguridad('personalizador_pdf_ver');
        $tipo = isset($_GET['tipo']) ? (string)$_GET['tipo'] : '';
        $archivo = isset($_GET['archivo']) ? sanitize_file_name($_GET['archivo']) : '';
        $nombre = $archivo ? $this->nombre_de($archivo) : '';
        $ruta = '';
        if ($tipo === 'imagen') {
            $letra = isset($_GET['letra']) ? strtolower((string)$_GET['letra']) : '';
            if (!$this->letra_valida($letra)) {
                wp_die('Letra no valida');
            }
            $coincidencias = (array)glob($this->dir_imagenes($nombre) . DIRECTORY_SEPARATOR . $letra . '.*');
            $ruta = $coincidencias ? $coincidencias[0] : '';
        } elseif ($tipo === 'placeholder') {
            $png = isset($_GET['png']) ? basename($_GET['png']) : '';
            if (!preg_match('/^[a-z]+-[0-9]+x[0-9]+[.]png$/', $png)) {
                wp_die('Nombre de placeholder no valido');
            }
            $ruta = $this->dir_placeholders($nombre) . DIRECTORY_SEPARATOR . $png;
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
 * Migra los datos al activar el plugin:
 *  - si existe la carpeta historica "extractor-corel" (<= 2.0.0) y no la nueva,
 *    la renombra para no perder PDFs, datasets, imagenes, placeholders ni salidas;
 */
register_activation_hook(__FILE__, function () {
    $upload_dir = wp_upload_dir();
    $viejo = trailingslashit($upload_dir['basedir']) . 'extractor-corel';
    $nuevo = trailingslashit($upload_dir['basedir']) . 'personalizador-pdf';
    if (is_dir($viejo) && !is_dir($nuevo)) {
        @rename($viejo, $nuevo);
    }
});