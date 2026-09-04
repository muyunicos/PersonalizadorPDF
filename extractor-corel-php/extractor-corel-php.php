<?php
/**
 * Plugin Name: Extractor Corel
 * Description: Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW. Motor 100% PHP, sin Python.
 * Version: 1.0.0
 * Author: Extractor Corel
 * License: GPL-2.0+
 * Text Domain: extractor-corel
 *
 * @package ExtractCorel
 */

if (!defined('ABSPATH')) {
    exit;
}

define('EXTRACTOR_COREL_VERSION', '1.0.0');
define('EXTRACTOR_COREL_PATH', plugin_dir_path(__FILE__));
define('EXTRACTOR_COREL_URL', plugin_dir_url(__FILE__));

require_once EXTRACTOR_COREL_PATH . 'engine/Pdf.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Detector.php';
require_once EXTRACTOR_COREL_PATH . 'engine/PngWriter.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Metadata.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Overlay.php';
require_once EXTRACTOR_COREL_PATH . 'engine/Workflow.php';

use ExtractCorel\Engine\Workflow;
use ExtractCorel\Engine\Metadata;

class Extractor_Corel_Plugin
{
    private static $instance = null;
    private $workflow = null;

    public static function instance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        $upload_dir = wp_upload_dir();
        $base = trailingslashit($upload_dir['basedir']) . 'extractor-corel';
        $this->workflow = new Workflow($base . '/marcos');
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('admin_post_extractor_corel_upload', [$this, 'handle_upload']);
        add_action('admin_post_extractor_corel_download', [$this, 'handle_download']);
        add_action('admin_post_nopriv_extractor_corel_download', [$this, 'handle_download']);
    }

    public function handle_download()
    {
        if (!current_user_can('manage_options') || !wp_verify_nonce($_REQUEST['_wpnonce'] ?? '', 'extractor_corel_download')) {
            wp_die('Permiso denegado');
        }
        $last = get_transient('extractor_corel_last');
        if (!$last || !is_file($last['file'])) {
            wp_die('El archivo ya no esta disponible. Procesa el PDF de nuevo.');
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $last['name'] . '"');
        header('Content-Length: ' . filesize($last['file']));
        readfile($last['file']);
        exit;
    }

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
        wp_enqueue_script(
            'extractor-corel',
            EXTRACTOR_COREL_URL . 'assets/admin.js',
            ['jquery'],
            EXTRACTOR_COREL_VERSION,
            true
        );
        wp_localize_script('extractor-corel', 'ExtractorCorel', [
            'ajaxurl' => admin_url('admin-ajax.php'),
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

    /** Procesa la subida via POST tradicional (compatibilidad maxima en hosting compartido). */
    public function handle_upload()
    {
        if (!current_user_can('manage_options') || !wp_verify_nonce($_REQUEST['_wpnonce'] ?? '', 'extractor_corel_upload')) {
            wp_die('Permiso denegado');
        }
        if (empty($_FILES['pdf'])) {
            wp_redirect(admin_url('admin.php?page=extractor-corel&ec_error=no_file'));
            exit;
        }
        $file = $_FILES['pdf'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            wp_redirect(admin_url('admin.php?page=extractor-corel&ec_error=upload'));
            exit;
        }
        if (strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) !== 'pdf') {
            wp_redirect(admin_url('admin.php?page=extractor-corel&ec_error=tipo'));
            exit;
        }
        $this->ensure_dirs();
        $tmp = $this->temp_path($file['name']);
        if (!move_uploaded_file($file['tmp_name'], $tmp)) {
            wp_redirect(admin_url('admin.php?page=extractor-corel&ec_error=move'));
            exit;
        }
        try {
            $out = $this->workflow->getDirMarcos() . DIRECTORY_SEPARATOR . 'out.pdf';
            $res = $this->workflow->proceso($tmp, $out);
            $proc_name = sanitize_file_name(Metadata::nombreDesdeArchivo($file['name']) . '_procesado.pdf');
            set_transient('extractor_corel_last', [
                'file' => $res['archivo'],
                'name' => $proc_name,
                'resumen' => $res['resumen'],
            ], HOUR_IN_SECONDS);
            wp_redirect(admin_url('admin.php?page=extractor-corel&ec_ok=1'));
            exit;
        } catch (\Throwable $e) {
            wp_redirect(admin_url('admin.php?page=extractor-corel&ec_error=' . urlencode($e->getMessage())));
            exit;
        }
    }

    private function ensure_dirs()
    {
        $dirs = [$this->workflow->getDirMarcos()];
        foreach ($dirs as $d) {
            if (!is_dir($d)) {
                wp_mkdir_p($d);
            }
        }
    }

    private function temp_path($name)
    {
        $upload_dir = wp_upload_dir();
        $base = trailingslashit($upload_dir['basedir']) . 'extractor-corel';
        if (!is_dir($base)) {
            wp_mkdir_p($base);
        }
        return $base . DIRECTORY_SEPARATOR . 'in_' . sanitize_file_name($name);
    }
}

Extractor_Corel_Plugin::instance();