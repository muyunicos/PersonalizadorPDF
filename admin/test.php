<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

$ultimo = $this->smoke_ultimo();
$pendiente = $this->smoke_pendiente();
$config_ia = get_option('personalizador_pdf_ia_config', []);
$config_ia = is_array($config_ia) ? $config_ia : [];
$url_ia = (string)($config_ia['url'] ?? 'https://ai.loc.ar');
$token_ia_configurado = trim((string)($config_ia['token'] ?? '')) !== '';
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
    <h2>Servicio IA oficial</h2>
    <p class="description">
        Configura el endpoint de la PC y el token compartido que autentica las llamadas
        desde WordPress. El token se guarda en la configuracion de WordPress, no se
        incluye en el navegador y nunca se vuelve a mostrar (la base de datos de WordPress
        no cifra este valor). La URL solo admite el host
        oficial o un Quick Tunnel de Cloudflare.
    </p>
    <p>
        <label for="ec-ia-url">URL HTTPS del servicio</label><br>
        <input type="url" class="regular-text" id="ec-ia-url"
               value="<?php echo esc_attr($url_ia); ?>" autocomplete="url">
    </p>
    <p>
        <label for="ec-ia-token">Token secreto del servicio</label><br>
        <input type="password" class="regular-text" id="ec-ia-token"
               autocomplete="new-password" spellcheck="false"
               placeholder="<?php echo $token_ia_configurado ? 'Guardado; dejalo vacio para conservarlo' : 'Pega el mismo token que configurarás en la PC'; ?>">
        <span class="description ec-ia-token-estado">
            <?php echo $token_ia_configurado ? 'Hay un token guardado.' : 'Aun no hay token guardado.'; ?>
        </span>
    </p>
    <p>
        <label>
            <input type="checkbox" id="ec-ia-borrar-token">
            Borrar el token guardado
        </label>
    </p>
    <p>
        <button type="button" class="button button-primary ec-ia-config-guardar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_ia_config')); ?>">
            Guardar configuracion IA
        </button>
        <span class="ec-ia-config-estado" aria-live="polite"></span>
    </p>
</div>

<div class="card">
    <h2>Conexion con la PC (prueba)</h2>
    <p class="description">
        Comprueba el endpoint configurado con su token, sin enviar imagenes.
        Hostnames oficiales admitidos: <code>https://ai.loc.ar</code> y
        <code>https://ai.muyunicos.com</code>.
    </p>
    <p>
        <button type="button" class="button ec-conexion-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_conexion_pc')); ?>">
            Probar conexion con la PC
        </button>
        <span class="ec-conexion-pc-estado" aria-live="polite"></span>
    </p>
    <hr>
    <h3>Mejorar una imagen con IA en la PC</h3>
    <p class="description">La PC aplica superresolucion y devuelve un PNG transparente de exactamente W × H px. La imagen se centra y contiene, sin deformarse ni recortarse; el aumento con IA se limita a x4.</p>
    <p class="description">La imagen se envia por WordPress al servicio autenticado. La primera prueba de cada modo carga el modelo y puede tardar mas. Usa solo imagenes de prueba no sensibles.</p>
    <p>
        <input type="file" id="ec-redimensionar-pc-imagen" accept="image/png,image/jpeg,image/gif,image/webp">
    </p>
    <p>
        <label>
            <input type="checkbox" id="ec-redimensionar-pc-modo-foto" checked>
            Modo Foto real
        </label>
        <span class="description">Activado: realesr-general-x4v3. Desactivado: RealESRGAN_x4plus_anime_6B (anime/ilustracion).</span>
    </p>
    <p>
        <label>Ancho <input type="number" id="ec-redimensionar-pc-ancho" min="1" max="3000" value="500"> px</label>
        <label>Alto <input type="number" id="ec-redimensionar-pc-alto" min="1" max="3000" value="500"> px</label>
    </p>
    <p>
        <button type="button" class="button ec-redimensionar-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_redimensionar_pc')); ?>">
            Probar superresolucion en la PC
        </button>
        <span class="ec-redimensionar-pc-estado" aria-live="polite"></span>
    </p>
    <p class="ec-redimensionar-pc-descarga" hidden></p>
</div>
