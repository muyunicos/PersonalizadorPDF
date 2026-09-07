<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */
$get = wp_unslash($_GET);
$tab = isset($get['tab']) && in_array($get['tab'], ['textos', 'ayuda'], true) ? $get['tab'] : 'pdfs';
$url_base = admin_url('admin.php?page=personalizador-pdf');
?>
<div class="wrap personalizador-pdf">
    <h1>Personalizador PDF — Placeholders, imagenes y textos</h1>

    <nav class="nav-tab-wrapper ec-tabs">
        <a href="<?php echo esc_url($url_base . '&tab=pdfs'); ?>"
           class="nav-tab <?php echo $tab === 'pdfs' ? 'nav-tab-active' : ''; ?>">PDFs y procesamiento</a>
        <a href="<?php echo esc_url($url_base . '&tab=textos'); ?>"
           class="nav-tab <?php echo $tab === 'textos' ? 'nav-tab-active' : ''; ?>">Estilos de Texto</a>
        <a href="<?php echo esc_url($url_base . '&tab=ayuda'); ?>"
           class="nav-tab <?php echo $tab === 'ayuda' ? 'nav-tab-active' : ''; ?>">Ayuda</a>
    </nav>

    <?php
    if ($tab === 'textos') {
        include PERSONALIZADOR_PDF_PATH . 'admin/estilos-texto.php';
    } elseif ($tab === 'ayuda') {
        include PERSONALIZADOR_PDF_PATH . 'admin/ayuda.php';
    } else {
        include PERSONALIZADOR_PDF_PATH . 'admin/pdfs.php';
    }
    ?>
</div>