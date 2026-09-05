<?php
/**
 * Plugin Name: Extractor Corel
 * Description: Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color. Motor 100% PHP, sin Python.
 * Version: 2.0.0
 * Author: Extractor Corel
 * License: GPL-2.0+
 * Text Domain: extractor-corel
 *
 * @package ExtractCorel
 */

if (!defined('ABSPATH')) {
    exit;
}

define('EXTRACTOR_COREL_VERSION', '2.0.0');
define('EXTRACTOR_COREL_PATH', plugin_dir_path(__FILE__));
define('EXTRACTOR_COREL_URL', plugin_dir_url(__FILE__));

require_once EXTRACTOR_COREL_PATH . 'engine/Pdf.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Detector.php';
require_once EXTRACTOR_COREL_PATH . 'engine/PngWriter.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Metadata.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Imagen.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Overlay.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Motor.php';

use ExtractCorel\Engine\Detector;
use ExtractCorel\Engine\Metadata;
use ExtractCorel\Engine\Motor;
use ExtractCorel\Engine\PngWriter;

class Extractor_Corel_Plugin
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
        $base = trailingslashit($upload_dir['basedir']) . 'extractor-corel';
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
            'Extractor Corel',
            'Extractor Corel',
            'manage_options',
            'extractor-corel',
            [$this, 'render_page'],
            'dashicons-media-document',
            30
        );
    }

    public function enqueue_assets($hook)
    {
        if ($hook !== 'toplevel_page_extractor-corel') {
            return;
        }
        wp_enqueue_style(
            'extractor-corel',
            EXTRACTOR_COREL_URL . 'assets/admin.css',
            [],
            EXTRACTOR_COREL_VERSION
        );
        wp_enqueue_media();
        wp_enqueue_script(
            'extractor-corel',
            EXTRACTOR_COREL_URL . 'assets/admin.js',
            ['jquery'],
            EXTRACTOR_COREL_VERSION,
            true
        );
        wp_localize_script('extractor-corel', 'ExtractorCorel', [
            'existentes' => $this->pdfs_subidos(),
            'nonce' => wp_create_nonce('extractor_corel_nonce'),
        ]);
    }

    public function render_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        include EXTRACTOR_COREL_PATH . 'admin/page.php';
    }

    /* ==================== Utilidades comunes ==================== */

    /** Verifica permisos y nonce de una accion; wp_die si falla. */
    private function seguridad($accion)
    {
        if (!current_user_can('manage_options')
            || !wp_verify_nonce($_REQUEST['_wpnonce'] ?? '', $accion)) {
            wp_die('Permiso denegado');
        }
    }

    /** Redirige a la pagina del plugin con parametros extra. */
    private function redirigir(array $args = [])
    {
        $args['page'] = 'extractor-corel';
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
        $this->seguridad('extractor_corel_subir_imagen');
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
        $this->seguridad('extractor_corel_imagen_galeria');
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
        $this->seguridad('extractor_corel_quitar_imagen');
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

    /* ==================== Handlers: PDFs ==================== */

    /** Sube un PDF, resuelve conflictos de nombre y genera el dataset. */
    public function handle_subir_pdf()
    {
        $this->seguridad('extractor_corel_subir_pdf');
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
        $this->seguridad('extractor_corel_reanalizar');
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
        $this->seguridad('extractor_corel_borrar');
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
        $this->seguridad('extractor_corel_procesar');
        $archivo = isset($_POST['archivo']) ? sanitize_file_name($_POST['archivo']) : '';
        if (!$archivo || !is_file($this->ruta_pdf($archivo))) {
            $this->redirigir(['ec_error' => 'pdf_inexistente']);
        }
        $nombre = $this->nombre_de($archivo);
        $datos = $this->dataset_de($nombre);
        if (!$datos) {
            $this->redirigir(['ec_error' => 'Este PDF no tiene datos analizados. Usa "Re-analizar".', 'ec_pdf' => $archivo]);
        }
        $rutas = $this->imagenes_de($nombre);
        try {
            $resultado = Motor::procesar($this->ruta_pdf($archivo), $datos, $rutas);
            $salida = $this->ruta_salida($nombre);
            file_put_contents($salida, $resultado['bytes']);
        } catch (\Throwable $e) {
            $this->redirigir(['ec_error' => $e->getMessage(), 'ec_pdf' => $archivo]);
        }
        set_transient(
            'extractor_corel_proceso',
            $resultado['resumen'] + ['archivo' => $archivo],
            HOUR_IN_SECONDS
        );
        $this->redirigir(['ec_procesado' => 1, 'ec_pdf' => $archivo]);
    }

    /** Descarga archivos: pdf | datos | placeholder | salida. */
    public function handle_descargar()
    {
        $this->seguridad('extractor_corel_descargar');
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
        $this->seguridad('extractor_corel_ver');
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

Extractor_Corel_Plugin::instance();