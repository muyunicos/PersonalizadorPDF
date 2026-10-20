<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

$ultimo = $this->smoke_ultimo();
$pendiente = $this->smoke_pendiente();
?>
<h2>Test de instalacion (smoke)</h2>

<?php if ($pendiente) : ?>
    <div class="notice notice-warning">
        <p><strong>Version nueva detectada (<?php echo esc_html(PERSONALIZADOR_PDF_VERSION); ?>).</strong>
        <?php if ($ultimo === null) : ?>
            Todavia no corriste el smoke test en este sitio.
        <?php else : ?>
            La ultima corrida fue con <?php echo esc_html((string)($ultimo['version'] ?? '?')); ?>
            el <?php echo esc_html((string)($ultimo['fecha'] ?? '?')); ?>.
        <?php endif; ?>
        Ejecutalo para verificar el entorno, el motor y WooCommerce.</p>
    </div>
<?php elseif ($ultimo !== null) : ?>
    <div class="notice notice-info">
        <p>Ultima corrida: <strong><?php echo esc_html((string)$ultimo['fecha']); ?></strong>
        (v<?php echo esc_html((string)$ultimo['version']); ?>) —
        <?php echo (int)$ultimo['total']; ?> checks,
        <?php echo (int)$ultimo['fallas'] === 0 ? 'todo OK' : (int)$ultimo['fallas'] . ' falla(s)'; ?>.</p>
    </div>
<?php endif; ?>

<div class="card">
    <p class="description">
        Verifica el sitio REAL (WordPress y WooCommerce activos, uploads con permisos, motor sobre
        tus PDFs subidos, hooks y render de la consola). No ejecuta procesos externos ni modifica datos:
        solo lee y escribe la marca de la ultima corrida.
    </p>
    <p>
        <button type="button" class="button button-primary ec-smoke-correr"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_smoke')); ?>">
            <?php echo $pendiente ? 'Ejecutar smoke test' : 'Volver a ejecutar'; ?>
        </button>
        <span class="ec-smoke-status" aria-live="polite"></span>
    </p>
    <div class="ec-smoke-resultado" hidden>
        <table class="widefat striped">
            <thead><tr><th>Estado</th><th>Check</th><th>Detalle</th></tr></thead>
            <tbody class="ec-smoke-filas"></tbody>
        </table>
    </div>
</div>

<div class="card">
    <h2>Conexion con la PC (prueba)</h2>
    <p class="description">
        Comprueba el recorrido Hostinger → Cloudflare Tunnel → esta PC. No procesa ni envia
        imagenes, no guarda la URL y no modifica ningun dato.
    </p>
    <p>
        <label for="ec-conexion-pc-url">URL temporal de Cloudflare</label><br>
        <input type="url" class="regular-text" id="ec-conexion-pc-url"
               placeholder="https://ejemplo.trycloudflare.com" autocomplete="off">
    </p>
    <p>
        <button type="button" class="button ec-conexion-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_conexion_pc')); ?>">
            Testear conexion con PC
        </button>
        <span class="ec-conexion-pc-estado" aria-live="polite"></span>
    </p>
    <hr>
    <h3>Redimensionar una imagen en la PC</h3>
    <p class="description">La PC devuelve un PNG transparente de exactamente W × H px. La imagen se centra y contiene, sin deformarse ni recortarse.</p>
    <p>
        <input type="file" id="ec-redimensionar-pc-imagen" accept="image/png,image/jpeg,image/gif,image/webp">
    </p>
    <p>
        <label>Ancho <input type="number" id="ec-redimensionar-pc-ancho" min="1" max="3000" value="500"> px</label>
        <label>Alto <input type="number" id="ec-redimensionar-pc-alto" min="1" max="3000" value="500"> px</label>
    </p>
    <p>
        <button type="button" class="button ec-redimensionar-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_redimensionar_pc')); ?>">
            Probar redimensionado en la PC
        </button>
        <span class="ec-redimensionar-pc-estado" aria-live="polite"></span>
    </p>
    <p class="ec-redimensionar-pc-descarga" hidden></p>
</div>
