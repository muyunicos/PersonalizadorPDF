<?php
/**
 * Plugin Name: Personalizador PDF
 * Description: Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color. Motor 100% PHP, sin Python. Integra el sistema TextMuy (editor de estilos de texto) en la pestana "Estilos de Texto".
 * Version: 3.1.2
 * Author: Personalizador PDF
 * License: GPL-2.0+
 * Text Domain: personalizador-pdf
 *
 * @package PersonalizadorPDF
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PERSONALIZADOR_PDF_VERSION', '3.1.2');
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
            'personalizador-pdf',
            PERSONALIZADOR_PDF_URL . 'assets/admin.js',
            ['jquery'],
            PERSONALIZADOR_PDF_VERSION,
            true
        );
        wp_localize_script('personalizador-pdf', 'PersonalizadorPDF', [
            'existentes' => $this->pdfs_subidos(),
            'nonce' => wp_create_nonce('personalizador_pdf_nonce'),
            'version' => PERSONALIZADOR_PDF_VERSION,
            'renderCoreUrl' => PERSONALIZADOR_PDF_URL . 'modules/textmuy/render-core.html',
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

    /** Nombres de los presets base del modulo TextMuy (modules/textmuy/presets/*.json). */
    private function presets_base()
    {
        $dir = PERSONALIZADOR_PDF_PATH . 'modules' . DIRECTORY_SEPARATOR . 'textmuy' . DIRECTORY_SEPARATOR . 'presets';
        $out = [];
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.json') as $ruta) {
            $out[] = basename($ruta, '.json');
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
 * Migra los datos de uploads al activar el plugin: si existe la carpeta
 * historica "extractor-corel" (<= 2.0.0) y no la nueva, la renombra para
 * no perder PDFs, datasets, imagenes, placeholders ni salidas.
 */
register_activation_hook(__FILE__, function () {
    $upload_dir = wp_upload_dir();
    $viejo = trailingslashit($upload_dir['basedir']) . 'extractor-corel';
    $nuevo = trailingslashit($upload_dir['basedir']) . 'personalizador-pdf';
    if (is_dir($viejo) && !is_dir($nuevo)) {
        @rename($viejo, $nuevo);
    }
});