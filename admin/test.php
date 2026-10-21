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
        Hostname oficial admitido: <code>https://ai.loc.ar</code>.
    </p>
    <p>
        <button type="button" class="button ec-conexion-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_conexion_pc')); ?>">
            Probar conexion con la PC
        </button>
        <span class="ec-conexion-pc-estado" aria-live="polite"></span>
    </p>
    <hr>
    <h3>Procesar una cadena de tareas en la PC</h3>
    <p class="description">El JSON es la fuente de verdad al ejecutar. Los controles lo actualizan; puedes editarlo o pegarlo y las opciones omitidas usan los predeterminados del servicio local. Automatico detecta y usa mejora general; Foto e Ilustracion eligen la mejora por defecto.</p>
    <p class="description">La primera prueba de cada modelo puede tardar mas al cargarlo. Usa solo imagenes de prueba no sensibles.</p>
    <p class="description">Si una tarea declara opciones propias, esas opciones prevalecen sobre las globales.</p>
    <p>
        <input type="file" id="ec-redimensionar-pc-imagen" accept="image/png,image/jpeg,image/gif,image/webp">
    </p>
    <p>
        <label for="ec-redimensionar-pc-modo">Modo de procesamiento</label>
        <select id="ec-redimensionar-pc-modo">
            <option value="automatico" selected>Automatico</option>
            <option value="foto">Foto</option>
            <option value="ilustracion">Ilustracion</option>
        </select>
    </p>
    <p>
        <label for="ec-redimensionar-pc-alfa" title="Se aplica a las tareas mejorar cuando la imagen tiene transparencia y se amplia.">
            Ampliacion del canal alfa
        </label>
        <select id="ec-redimensionar-pc-alfa">
            <option value="lanczos" selected>Lanczos (rapido; mascara original)</option>
            <option value="anime">Real-ESRGAN Anime (mejora la mascara)</option>
        </select>
    </p>
    <p>
        <label for="ec-redimensionar-pc-motor-fondo" title="BiRefNet usa la GPU PyTorch. rembg usa GPU solo si ONNX Runtime dispone de CUDA; de lo contrario funciona en CPU.">
            Motor para quitar el fondo
        </label>
        <select id="ec-redimensionar-pc-motor-fondo">
            <option value="birefnet" selected>BiRefNet Lite-2K (GPU)</option>
            <option value="rembg">rembg (ONNX Runtime)</option>
        </select>
    </p>
    <p class="ec-redimensionar-pc-modelo-fondo-birefnet">
        <label for="ec-redimensionar-pc-birefnet-modelo">Modelo BiRefNet</label>
        <select id="ec-redimensionar-pc-birefnet-modelo">
            <option value="birefnet-lite-2k" selected>BiRefNet Lite-2K (GPU)</option>
        </select>
    </p>
    <p class="ec-redimensionar-pc-modelo-fondo-rembg" hidden>
        <label for="ec-redimensionar-pc-rembg-modelo" title="El modelo seleccionado se descarga la primera vez que se utiliza.">
            Modelo rembg
        </label>
        <select id="ec-redimensionar-pc-rembg-modelo">
            <option value="isnet-general-use" selected>IS-Net General (actual)</option>
            <option value="birefnet-general">BiRefNet General</option>
            <option value="birefnet-general-lite">BiRefNet General Lite</option>
            <option value="birefnet-portrait">BiRefNet Portrait</option>
            <option value="isnet-anime">IS-Net Anime</option>
            <option value="u2net">U2-Net</option>
            <option value="u2netp">U2-Net pequeno</option>
            <option value="silueta">Silueta</option>
        </select>
    </p>
    <p class="ec-redimensionar-pc-rembg-opciones" hidden>
        <label title="Limpia ruido con operaciones morfologicas, pero puede endurecer o quitar detalles finos.">
            <input type="checkbox" id="ec-redimensionar-pc-rembg-postproceso"> Postprocesar mascara ⓘ
        </label>
        <label title="Refina bordes y semitransparencias; puede tardar mas. Se combina con postproceso si ambos estan activados.">
            <input type="checkbox" id="ec-redimensionar-pc-rembg-matting"> Alpha matting ⓘ
        </label>
        <span class="ec-redimensionar-pc-umbrales">
            <label>Umbral primer plano <input type="number" id="ec-redimensionar-pc-rembg-foreground" min="1" max="255" value="240"></label>
            <label>Umbral fondo <input type="number" id="ec-redimensionar-pc-rembg-background" min="0" max="254" value="10"></label>
            <label>Erosion <input type="number" id="ec-redimensionar-pc-rembg-erode" min="1" max="100" value="10"></label>
        </span>
    </p>
    <p>
        <label>Ancho <input type="number" id="ec-redimensionar-pc-ancho" min="1" max="3000" value="500"> px</label>
        <label>Alto <input type="number" id="ec-redimensionar-pc-alto" min="1" max="3000" value="500"> px</label>
    </p>
    <p>
        <label for="ec-redimensionar-pc-json">Tareas en orden (JSON)</label><br>
        <textarea id="ec-redimensionar-pc-json" class="large-text code" rows="15">{
  "modo": "automatico",
  "ancho": 500,
  "alto": 500,
  "alfa": "lanczos",
  "quitar_fondo": {
    "motor": "birefnet",
    "modelo": "birefnet-lite-2k",
    "post_process_mask": false,
    "alpha_matting": false,
    "alpha_matting_foreground_threshold": 240,
    "alpha_matting_background_threshold": 10,
    "alpha_matting_erode_size": 10
  },
  "tareas": [
    {"tipo": "quitar_fondo"},
    {"tipo": "mejorar"}
  ]
}</textarea>
        <span class="description">Cada tarea requiere "tipo". Las opciones de la tarea prevalecen sobre las globales; las opciones globales omitidas usan los predeterminados del servicio. Tipos: detectar, quitar_fondo y mejorar.</span>
    </p>
    <p>
        <button type="button" class="button ec-redimensionar-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_redimensionar_pc')); ?>">
            Ejecutar cadena en la PC
        </button>
        <span class="ec-redimensionar-pc-estado" aria-live="polite"></span>
    </p>
    <p class="description ec-redimensionar-pc-preferencias" aria-live="polite">El JSON se guarda en este navegador y las opciones globales quedan como predeterminados del servicio al ejecutar. La imagen no se guarda.</p>
    <p class="ec-redimensionar-pc-descarga" hidden></p>
</div>
