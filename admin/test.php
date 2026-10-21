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
    <h3>Procesamiento de tareas en PC</h3>
    <p class="description">La PC procesa siempre en este orden: quitar fondo y despues escalar. Las opciones que omitas en el JSON se completan con los valores predeterminados del servicio.</p>
    <p class="description">La primera prueba de cada modelo puede tardar mas al cargarlo. Usa solo imagenes de prueba no sensibles.</p>
    <div class="ec-pc-pestanas" role="tablist" aria-label="Opciones de procesamiento">
        <button type="button" class="button ec-pc-pestana ec-pc-pestana-activa" role="tab"
                id="ec-pc-tab-escalado" aria-selected="true" aria-controls="ec-pc-panel-escalado"
                data-pestana="escalado">Escalado</button>
        <button type="button" class="button ec-pc-pestana" role="tab"
                id="ec-pc-tab-quitar-fondo" aria-selected="false" aria-controls="ec-pc-panel-quitar-fondo"
                data-pestana="quitar_fondo" tabindex="-1">Quitar Fondo</button>
    </div>
    <section class="ec-pc-panel" role="tabpanel" id="ec-pc-panel-escalado"
             aria-labelledby="ec-pc-tab-escalado" data-panel="escalado">
        <p>
            <label for="ec-redimensionar-pc-modo">Modo de procesamiento</label>
            <select id="ec-redimensionar-pc-modo">
                <option value="automatico" selected>Automatico</option>
                <option value="foto">Foto</option>
                <option value="ilustracion">Ilustracion</option>
            </select>
        </p>
        <p>
            <label for="ec-redimensionar-pc-alfa" title="Se aplica cuando la imagen tiene transparencia y se amplia.">
                Ampliacion del canal alfa
            </label>
            <select id="ec-redimensionar-pc-alfa">
                <option value="lanczos" selected>Lanczos (rapido; mascara original)</option>
                <option value="anime">Real-ESRGAN Anime (mejora la mascara)</option>
            </select>
        </p>
        <p>
            <label>Ancho <input type="number" id="ec-redimensionar-pc-ancho" min="1" max="3000" value="500"> px</label>
            <label>Alto <input type="number" id="ec-redimensionar-pc-alto" min="1" max="3000" value="500"> px</label>
        </p>
        <p>
            <button type="button" class="button ec-redimensionar-pc-guardar"
                    data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_guardar_predeterminados_pc')); ?>">
                Guardar por defecto
            </button>
            <span class="ec-redimensionar-pc-preferencias description" aria-live="polite"></span>
        </p>
    </section>
    <section class="ec-pc-panel" role="tabpanel" id="ec-pc-panel-quitar-fondo"
             aria-labelledby="ec-pc-tab-quitar-fondo" data-panel="quitar_fondo" hidden>
        <p>
            <label for="ec-redimensionar-pc-motor-fondo" title="BiRefNet usa GPU PyTorch. rembg usa GPU solo si ONNX Runtime dispone de CUDA; de lo contrario funciona en CPU.">
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
        <div class="ec-redimensionar-pc-rembg-opciones" hidden>
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
        </div>
        <p>
            <button type="button" class="button ec-redimensionar-pc-guardar"
                    data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_guardar_predeterminados_pc')); ?>">
                Guardar por defecto
            </button>
            <span class="ec-redimensionar-pc-preferencias description" aria-live="polite"></span>
        </p>
    </section>
    <p>
        <label for="ec-redimensionar-pc-json">Opciones de procesamiento (JSON)</label><br>
        <textarea id="ec-redimensionar-pc-json" class="large-text code" rows="15">{
  "escalado": {
    "modo": "automatico",
    "ancho": 500,
    "alto": 500,
    "alfa": "lanczos"
  },
  "quitar_fondo": {
    "motor": "birefnet",
    "modelo": "birefnet-lite-2k",
    "post_process_mask": false,
    "alpha_matting": false,
    "alpha_matting_foreground_threshold": 240,
    "alpha_matting_background_threshold": 10,
    "alpha_matting_erode_size": 10
  }
}</textarea>
        <span class="description">El orden es fijo: primero quitar fondo y luego escalar. Si eliminas una opcion, se usa su valor predeterminado guardado en la PC.</span>
    </p>
    <p>
        <label for="ec-redimensionar-pc-imagen">Seleccionar archivo de imagen</label><br>
        <input type="file" id="ec-redimensionar-pc-imagen" accept="image/png,image/jpeg,image/gif,image/webp">
    </p>
    <p>
        <button type="button" class="button button-primary ec-redimensionar-pc-probar"
                data-nonce="<?php echo esc_attr(wp_create_nonce('personalizador_pdf_redimensionar_pc')); ?>">
            Procesar imagen en la PC
        </button>
        <span class="ec-redimensionar-pc-estado" aria-live="polite"></span>
    </p>
    <div class="ec-pc-vistas" aria-live="polite">
        <figure class="ec-pc-vista">
            <figcaption>Original</figcaption>
            <div class="ec-pc-vista-marco"><img class="ec-pc-imagen-original" alt="Imagen original seleccionada" hidden></div>
        </figure>
        <figure class="ec-pc-vista">
            <figcaption>Resultado — clic para descargar</figcaption>
            <div class="ec-pc-vista-marco ec-pc-vista-resultado">
                <a class="ec-redimensionar-pc-descarga" hidden>
                    <img class="ec-pc-imagen-resultado" alt="Resultado procesado; clic para descargar">
                </a>
            </div>
        </figure>
    </div>
</div>
