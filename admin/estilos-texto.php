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
// Config del puente plugin <-> modulo: motor unico de galerias (Const. VII)
// oculto en el iframe via postMessage same-origin al cargar. El modulo NO
// conoce handlers sueltos: solo motorUrl + op=... (contracts/motor-contract.md)
// + bases de lectura + listados iniciales generados por el motor.
// Los datos TextMuy viven en la ubicacion unica wp-content/uploads/pmu/tm-presets/.
$pmu_galeria = $this->pmu_galeria();
$recursos = $pmu_galeria->listar();
$puente = [
    'urls' => [
        'motor' => admin_url('admin-post.php?action=pmu_uploads'),
        // Script del motor de miniaturas y sprites para inyectar en el iframe
        'miniaturas' => PERSONALIZADOR_PDF_URL . 'assets/miniaturas.js',
        // Lectura de presets (.txm), imagenes y fuentes: bases de uploads.
        'presetsBase' => $pmu_galeria->url_ambito('presets'),
        'fuentesBase' => $pmu_galeria->url_ambito('fonts'),
        'imagenesBase' => $pmu_galeria->url_ambito('img'),
    ],
    'nonces' => [
        'motor' => wp_create_nonce('pmu_uploads'),
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
