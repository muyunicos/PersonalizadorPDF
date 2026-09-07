<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="card">
    <h2>Como funciona</h2>
    <ol>
        <li><strong>Subi un PDF</strong> exportado desde Corel con rectangulos 100% transparentes donde iran las
            imagenes. El plugin los detecta, los agrupa por color y genera los <em>datos</em> (dataset) del PDF:
            grupos, colores, tamanos e instancias.</li>
        <li><strong>Carga una imagen real por grupo</strong> (grupo A, B, C...). Podes subirla desde tu computadora
            o elegirla de la galeria de medios de WordPress. El placeholder de cada grupo es descargable en PNG
            transparente con el tamano exacto, por si queres preparar la imagen aparte.</li>
        <li><strong>Pulsa Procesar PDF.</strong> El motor inserta la imagen de cada grupo en todas sus instancias,
            encajada dentro del placeholder (sin deformar, sin recortar) y devuelve el PDF editado optimizado.</li>
    </ol>
    <p>El tamano base de cada grupo es el del rectangulo <strong>mas grande</strong> del grupo. Los PDFs subidos,
        sus datos, imagenes y resultados se guardan en <code>wp-content/uploads/personalizador-pdf/</code>
        (carpetas <code>pdfs</code>, <code>datos</code>, <code>imagenes</code>, <code>placeholders</code> y
        <code>salidas</code>).</p>
</div>

<div class="card">
    <h2>Estilos de Texto (modulo TextMuy)</h2>
    <p>La pestana <strong>Estilos de Texto</strong> embebe el editor de textos estilizados TextMuy (client-side,
        estilo TextStudio). Se disenan estilos (fuente, relleno, contorno, sombras, efectos) y se guardan como
        <em>presets</em>.</p>
    <ul>
        <li><strong>Presets base:</strong> los de <code>modules/textmuy/presets/</code> estan disponibles siempre,
            en todos los navegadores.</li>
        <li><strong>Presets guardados:</strong> viven en el navegador del equipo (localStorage). No se comparten entre
            navegadores.</li>
        <li><strong>Integracion proxima:</strong> el plan aprobado permite asignar "texto + estilo" a cada grupo del
            PDF y generar la imagen del texto al pulsar <em>Procesar</em>, sin tocar el motor PHP.</li>
    </ul>
</div>

<div class="card">
    <h2>Texto estilizado por grupo (modulo TextMuy)</h2>
    <p>Ademas de una imagen, cada grupo puede llevar un <strong>texto estilizado</strong>. En la consola
        de cada PDF, en la tarjeta del grupo, activa <em>Usar texto</em>, escribe el contenido y elige el
        <em>estilo</em> (preset de TextMuy; los que guardes en la pestana "Estilos de Texto" aparecen como
        <em>custom</em> de este navegador).</p>
    <ul>
        <li><strong>Autoguardado:</strong> al escribir o cambiar el estilo, el texto se guarda solo
            (indicador <em>Guardado</em>). El boton <em>Guardar</em> tambien funciona.</li>
        <li><strong>Vista previa:</strong> muestra el texto renderizado al tamano exacto del hueco del grupo.</li>
        <li><strong>Al procesar:</strong> el navegador renderiza cada grupo con texto activo a su tamano
            (ancho x alto en px, base 200 ppp) y el PNG se incorpora como imagen del grupo en el mismo envio.
            El texto reemplaza la imagen cargada manualmente de ese grupo.</li>
        <li><strong>Sin el motor en el servidor:</strong> el render ocurre en tu navegador (Canvas + WebGL
            del modulo TextMuy); el servidor PHP solo recibe PNGs y los inserta como siempre.</li>
        <li>Si un estilo <em>custom</em> no existe en el navegador donde procesas, el proceso se cancela con un
            aviso (nunca se genera un PDF a medias).</li>
    </ul>
</div>

<div class="card">
    <h2>Reglas y casos especiales</h2>
    <ul>
        <li><strong>Nombre repetido:</strong> al subir un PDF con un nombre existente se pregunta si renombrar
            automaticamente o sobrescribir. Sobrescribir borra datos, imagenes y resultado anterior del PDF.</li>
        <li><strong>Imagen que no coincide con el tamano del grupo:</strong> no se estira ni se recorta: se encaja
            (escala maxima sin perder proporcion) y se centra; los margenes quedan transparentes.</li>
        <li><strong>Grupos sin imagen:</strong> quedan intactos en el PDF; el resumen del proceso los informa.</li>
        <li><strong>Datos desactualizados:</strong> si modificaste el PDF con el mismo nombre, usa
            <em>Re-analizar</em>. El motor valida los datos contra el PDF antes de procesar.</li>
    </ul>
</div>

<div class="card">
    <h2>Requisitos del servidor</h2>
    <ul>
        <li>PHP 7.4 o superior y extension zlib.</li>
        <li>GD es opcional: sin GD el motor procesa imagenes <strong>PNG</strong> (8 bits, sin entrelazar) con su
            decodificador propio. Para JPEG/GIF/WebP se necesita GD; un JPEG solo se acepta sin GD si sus
            dimensiones coinciden exactamente con las del grupo.</li>
        <li>Motor 100% PHP: no requiere Python ni procesos en segundo plano.</li>
    </ul>
</div>