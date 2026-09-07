<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */
$modulo_url = PERSONALIZADOR_PDF_URL . 'modules/textmuy/index.html';
// Config del puente plugin <-> modulo: endpoints + nonces + listado actual de
// presets (.txm) e imagenes subidas. El iframe la recibe via postMessage
// same-origin al cargar (el modulo standalone, sin esta config, oculta las
// funciones de servidor y sigue 100% client-side).
$recursos = $this->recursos_textmuy();
$puente = [
    'urls' => [
        'guardarPreset' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_guardar_preset'),
        'borrarPreset' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_borrar_preset'),
        'subirImagen' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_subir_imagen'),
    ],
    'nonces' => [
        'guardarPreset' => wp_create_nonce('personalizador_pdf_textmuy_guardar_preset'),
        'borrarPreset' => wp_create_nonce('personalizador_pdf_textmuy_borrar_preset'),
        'subirImagen' => wp_create_nonce('personalizador_pdf_textmuy_subir_imagen'),
    ],
    'presets' => $recursos['presets'],
    'imagenes' => $recursos['imagenes'],
];
?>
<div class="card">
    <h2>Sistema TextMuy integrado</h2>
    <p>
        Este editor permite disenar <strong>estilos de texto</strong> (fuente, relleno, contorno,
        sombras, efectos y presets) al estilo TextStudio y guardarlos como <em>presets</em>.
        Es el modulo integrado de estilos de texto del plugin.
    </p>
    <p class="description">
        Los presets se guardan como <code>.txm</code> (mas su miniatura <code>.webp</code>) en
        <code>modules/textmuy/presets/</code> del servidor: estan disponibles en
        <strong>todos los navegadores</strong> y en el selector de estilo de cada grupo de un PDF.
        Las imagenes que subas para rellenos y fondos quedan en
        <code>modules/textmuy/imagenes/</code> y se reutilizan entre presets.
    </p>
</div>

<div class="ec-textmuy-frame-wrap">
    <iframe
        id="ec-textmuy-frame"
        src="<?php echo esc_url($modulo_url); ?>"
        title="Editor de estilos de texto TextMuy"
        loading="lazy"
        allowfullscreen></iframe>
</div>

<script>
(function () {
    'use strict';
    var frame = document.getElementById('ec-textmuy-frame');
    if (!frame) { return; }
    var puente = <?php echo wp_json_encode($puente); ?>;
    function enviar() {
        try {
            frame.contentWindow.postMessage({ type: 'textmuy-bridge', bridge: puente }, window.location.origin);
        } catch (e) { /* el iframe puede no estar listo aun */ }
    }
    // Tres momentos de envio: carga del iframe, aviso del modulo y ya-mismo
    // (por si el iframe termino de cargar antes que este script).
    frame.addEventListener('load', enviar);
    window.addEventListener('message', function (ev) {
        if (ev.source === frame.contentWindow && ev.data && ev.data.type === 'textmuy-ready') {
            enviar();
        }
    });
    enviar();
})();
</script>
