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
        sus datos, imagenes y resultados se guardan en <code>wp-content/uploads/extractor-corel/</code>
        (carpetas <code>pdfs</code>, <code>datos</code>, <code>imagenes</code>, <code>placeholders</code> y
        <code>salidas</code>).</p>
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