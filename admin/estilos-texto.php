<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

// El modulo TextMuy NO se distribuye con el plugin (v4.0.0): se importa a mano
// en modules/textmuy/ (ver modules/LEEME.md). Sin el modulo, la pestana muestra
// el aviso y el resto del plugin funciona con normalidad.
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
// Config del puente plugin <-> modulo: endpoints + nonces + listado actual de
// presets (.txm) e imagenes subidas + URLs base de lectura. El iframe la recibe
// via postMessage same-origin al cargar (el modulo standalone, sin esta config,
// oculta las funciones de servidor y sigue 100% client-side).
// Desde 4.0.0 los presets e imagenes del administrador viven en
// uploads/personalizador-pdf/textmuy/{presets,imagenes} (fuera del plugin).
$recursos = $this->recursos_textmuy();
$puente = [
    'urls' => [
        'guardarPreset' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_guardar_preset'),
        'borrarPreset' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_borrar_preset'),
        'subirImagen' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_subir_imagen'),
        'borrarImagen' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_borrar_imagen'),
        'cambiarImagen' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_cambiar_imagen'),
        'subirFuente' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_subir_fuente'),
        'borrarFuente' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_borrar_fuente'),
        'cambiarFuente' => admin_url('admin-post.php?action=personalizador_pdf_textmuy_cambiar_fuente'),
        'guardarMiniatura' => admin_url('admin-post.php?action=personalizador_pdf_guardar_miniatura'),
        'guardarSprite' => admin_url('admin-post.php?action=personalizador_pdf_guardar_sprite'),
        // Script del motor de miniaturas y sprites para inyectar en el iframe
        'miniaturas' => PERSONALIZADOR_PDF_URL . 'assets/miniaturas.js',
        // Lectura de presets (.txm), imagenes y fuentes: bases de uploads.
        // imagenesBase sirve para reutilizar el spritesheet thumbs/imagenes.* sin regenerar.
        'presetsBase' => $this->url_base_textmuy_presets(),
        'fuentesBase' => $this->url_base_textmuy_fonts(),
        'imagenesBase' => $this->url_base_textmuy_imagenes(),
    ],
    'nonces' => [
        'guardarPreset' => wp_create_nonce('personalizador_pdf_textmuy_guardar_preset'),
        'borrarPreset' => wp_create_nonce('personalizador_pdf_textmuy_borrar_preset'),
        'subirImagen' => wp_create_nonce('personalizador_pdf_textmuy_subir_imagen'),
        'borrarImagen' => wp_create_nonce('personalizador_pdf_textmuy_borrar_imagen'),
        'cambiarImagen' => wp_create_nonce('personalizador_pdf_textmuy_cambiar_imagen'),
        'subirFuente' => wp_create_nonce('personalizador_pdf_textmuy_subir_fuente'),
        'borrarFuente' => wp_create_nonce('personalizador_pdf_textmuy_borrar_fuente'),
        'cambiarFuente' => wp_create_nonce('personalizador_pdf_textmuy_cambiar_fuente'),
        'guardarMiniatura' => wp_create_nonce('personalizador_pdf_guardar_miniatura'),
        'guardarSprite' => wp_create_nonce('personalizador_pdf_guardar_sprite'),
    ],
    'presets' => $recursos['presets'],
    'imagenes' => $recursos['imagenes'],
    'fuentes' => $recursos['fuentes'],
];
?>
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
