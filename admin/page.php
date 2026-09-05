<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Extractor_Corel_Plugin $this */
$get = wp_unslash($_GET);
$tab = isset($get['tab']) && $get['tab'] === 'ayuda' ? 'ayuda' : 'pdfs';
$url_base = admin_url('admin.php?page=extractor-corel');
?>
<div class="wrap extractor-corel">
    <h1>Extractor Corel — Placeholders e imagenes</h1>

    <nav class="nav-tab-wrapper ec-tabs">
        <a href="<?php echo esc_url($url_base . '&tab=pdfs'); ?>"
           class="nav-tab <?php echo $tab === 'pdfs' ? 'nav-tab-active' : ''; ?>">PDFs y procesamiento</a>
        <a href="<?php echo esc_url($url_base . '&tab=ayuda'); ?>"
           class="nav-tab <?php echo $tab === 'ayuda' ? 'nav-tab-active' : ''; ?>">Ayuda</a>
    </nav>

    <?php
    if ($tab === 'ayuda') {
        include EXTRACTOR_COREL_PATH . 'admin/ayuda.php';
    } else {
        include EXTRACTOR_COREL_PATH . 'admin/pdfs.php';
    }
    ?>
</div>