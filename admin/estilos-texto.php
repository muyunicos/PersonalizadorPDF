<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

// Fallback defensivo (v4.2: TextMuy viene integrado en modules/textmuy/):
// si el modulo falta en esta instalacion, la pestana muestra el aviso
// y el resto del plugin funciona con normalidad.
if (!$this->modulo_textmuy_disponible()) {
    ?>
    <div class="card">
        <h2>Estilos de Texto (TextMuy)</h2>
        <p><strong>El modulo TextMuy no esta importado en esta instalacion.</strong></p>
        <p class="description">
            Para habilitar el editor, copia el proyecto <code>textmuy</code> dentro de la carpeta del
            plugin de modo que exista <code>wp-content/plugins/personalizador-pdf/modules/textmuy/index.html</code>
            (instrucciones completas en <code>modules/LEEME.md</code>). El resto del plugin
            (PDFs, grupos, imagenes y Procesar) funciona con normalidad sin el modulo.
        </p>
    </div>
    <?php
    return;
}

$modulo_url = PERSONALIZADOR_PDF_URL . 'modules/textmuy/index.html';
// Config del puente plugin <-> modulo (contrato textmuy-bridge): UNICA fuente
// de verdad en Personalizador_PDF_Plugin::puente_textmuy() (tambien la consume
// el render-core off-screen desde assets/admin.js). Sin inventario disponible
// el editor se recibe vacio y se niega a operar, con la causa visible arriba.
$puente_data = $this->puente_textmuy();
$puente = $puente_data['puente'];
$aviso_puente = $puente_data['aviso'];
?>
<?php if ($aviso_puente !== ''): ?>
<div class="notice notice-error"><p>
    <strong>Estilos de Texto:</strong> no se pudo preparar el inventario de recursos
    (<code><?php echo esc_html($aviso_puente); ?></code>). El editor se abrira sin recursos;
    corrija la causa y recargue la pagina.
</p></div>
<?php endif; ?>
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
