<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */
$modulo_url = PERSONALIZADOR_PDF_URL . 'modules/textmuy/index.html';
?>
<div class="card">
    <h2>Sistema TextMuy integrado</h2>
    <p>
        Este editor permite disenar <strong>estilos de texto</strong> (fuente, relleno, contorno,
        sombras, efectos y presets) al estilo TextStudio y guardarlos como <em>presets</em>.
        Es el modulo integrado de estilos de texto del plugin.
    </p>
    <p class="description">
        Los presets que guardes aca quedan en el navegador de este equipo (localStorage).
        Los <strong>presets base</strong> de <code>modules/textmuy/presets/</code> estan disponibles
        en todos los navegadores. En la proxima version estos estilos se podran asignar a los grupos
        de un PDF para que el texto se renderice con el estilo elegido al procesar.
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