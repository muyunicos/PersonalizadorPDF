<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Extractor_Corel_Plugin $this */
$get = wp_unslash($_GET);
$ok = isset($get['ec_ok']);
$error = $get['ec_error'] ?? '';
$last = get_transient('extractor_corel_last');
?>
<div class="wrap extractor-corel">
    <h1>Extractor Corel — Reemplazo de placeholders</h1>

    <?php if ($ok && $last) : ?>
        <div class="notice notice-success">
            <p><strong>Proceso completado.</strong></p>
            <p>Grupos: <strong><?php echo esc_html(implode(', ', $last['resumen']['grupos_aplicados'])); ?></strong> —
                Marcos insertados: <strong><?php echo (int) $last['resumen']['marcos_insertados']; ?></strong></p>
            <p><a class="button button-primary" href="<?php echo esc_url(admin_url('admin-post.php?action=extractor_corel_download&_wpnonce=' . wp_create_nonce('extractor_corel_download'))); ?>">Descargar PDF procesado</a></p>
            <p class="description">Archivo: <?php echo esc_html($last['name']); ?></p>
        </div>
    <?php elseif ($error) : ?>
        <div class="notice notice-error">
            <p><strong>Error:</strong> <?php echo esc_html(urldecode($error)); ?></p>
        </div>
    <?php endif; ?>

    <div class="card">
        <h2>1. Subir PDF</h2>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data">
            <input type="hidden" name="action" value="extractor_corel_upload">
            <?php wp_nonce_field('extractor_corel_upload'); ?>
            <p>
                <input type="file" name="pdf" accept="application/pdf" required>
            </p>
            <p class="description">Selecciona un archivo PDF exportado desde Corel (rectangulos 100% transparentes en las posiciones de los nombres). Maximo <?php echo esc_html(size_format(wp_max_upload_size())); ?>.</p>
            <?php submit_button('Procesar PDF', 'primary', 'submit', false); ?>
        </form>
    </div>

    <div class="card">
        <h2>2. Estado del sistema</h2>
        <ul>
            <li>PHP: <strong><?php echo esc_html(PHP_VERSION); ?></strong></li>
            <li>zlib: <strong><?php echo extension_loaded('zlib') ? 'disponible' : 'NO disponible'; ?></strong></li>
            <li>GD: <strong><?php echo extension_loaded('gd') ? 'disponible (opcional)' : 'no disponible (el motor usa PNG puro, no lo necesita)'; ?></strong></li>
            <li>Directorio de marcos: <code><?php echo esc_html($this->workflow->getDirMarcos()); ?></code>
                — <?php echo is_dir($this->workflow->getDirMarcos()) ? 'escribible' : 'se creara al procesar'; ?></li>
            <li>Limite de subida: <strong><?php echo esc_html(size_format(wp_max_upload_size())); ?></strong></li>
        </ul>
    </div>
</div>