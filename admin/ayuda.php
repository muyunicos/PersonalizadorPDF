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
        <li><strong>Carga una imagen real por grupo</strong> (identificados por su color,
            p. ej. <code>0000FF</code>). Podes subirla desde tu computadora
            o elegirla de la galeria de medios de WordPress. El placeholder de cada grupo se
            previsualiza como marco al tamano real y es descargable en PNG
            transparente (generado al vuelo), por si queres preparar la imagen aparte.</li>
        <li><strong>Pulsa Procesar PDF.</strong> El motor inserta la imagen de cada grupo en todas sus instancias,
            encajada dentro del placeholder (sin deformar, sin recortar) y devuelve el PDF editado optimizado.</li>
    </ol>
    <p>El tamano base de cada grupo es el del rectangulo <strong>mas grande</strong> del grupo. Cada PDF
        vive en su carpeta <code>wp-content/uploads/pmu/pdfs/{nombre}/</code>
        (<code>{nombre}.pdf</code> + <code>analisis.json</code> inmutable del Detector +
        <code>config.json</code> editable con <code>activo</code>/<code>productos</code>/
        <code>campos_ids</code>/<code>placeholders[id]</code>); las pruebas del panel
        (imagenes aplicadas, salida de muestra) van a
        <code>wp-content/uploads/pmu/tmp/muestras/{nombre}/</code> y se sobrescriben
        en cada Procesar. Detalle canonico en <code>AGENTS.md</code> §5.</p>
</div>

<div class="card">
    <h2>Estilos de Texto (modulo TextMuy)</h2>
    <p>La pestana <strong>Estilos de Texto</strong> embebe el editor de textos estilizados TextMuy (client-side,
        estilo TextStudio). Se disenan estilos (fuente, relleno, contorno, sombras, efectos) y se guardan como
        <em>presets</em>.</p>
    <ul>
        <li><strong>Presets:</strong> viven en la ubicacion unica <code>uploads/pmu/tm-presets/</code>
            (catalogo <code>presets.json</code> + <code>.txm</code>), compartidos por todos los
            navegadores del equipo.</li>
        <li><strong>Integracion:</strong> cada grupo del PDF puede llevar "texto + estilo";
            al pulsar <em>Procesar</em> se genera la imagen del texto, sin tocar el motor PHP.</li>
    </ul>
</div>

<div class="card">
    <h2>Texto estilizado por grupo (modulo TextMuy)</h2>
    <p>Ademas de una imagen, cada grupo puede llevar un <strong>texto estilizado</strong>. En la consola
        de cada PDF, en la tarjeta del grupo, activa <em>Usar texto</em>, escribe el contenido y elige el
        <em>estilo</em> (preset de TextMuy guardado en el servidor en
        <code>uploads/pmu/tm-presets/</code>; aparece en el selector del grupo).</p>
    <ul>
        <li><strong>Autoguardado:</strong> al escribir o cambiar el estilo, el texto se guarda solo
            (indicador <em>Guardado</em>). El boton <em>Guardar</em> tambien funciona.</li>
        <li><strong>Vista previa:</strong> muestra el texto renderizado al tamano exacto del hueco del grupo.</li>
        <li><strong>Al procesar:</strong> el navegador renderiza cada grupo con texto activo a su tamano
            (ancho x alto en px, base 200 ppp) y el PNG se incorpora como imagen del grupo en el mismo envio.
            El texto reemplaza la imagen cargada manualmente de ese grupo.</li>
        <li><strong>Sin el motor en el servidor:</strong> el render ocurre en tu navegador (Canvas + WebGL
            del modulo TextMuy); el servidor PHP solo recibe PNGs y los inserta como siempre.</li>
        <li>Si el estilo elegido ya no existe en el servidor al procesar, el proceso se cancela con un
            aviso (nunca se genera un PDF a medias).</li>
    </ul>
</div>

<div class="card">
    <h2>Tienda: vista previa y descargas del comprador</h2>
    <ol>
        <li><strong>Asocia uno o varios PDFs a un producto</strong> (canonico: postmeta
            <code>_pmu_pdf_slugs</code> del producto; el singular
            <code>_pmu_pdf_slug</code> se conserva como respaldo de productos antigos;
            el listado de la consola es su espejo). En la ficha del producto aparece el
            panel del comprador con los campos del catalogo elegidos en
            "Configuracion tienda".</li>
        <li><strong>"Vista previa"</strong>: el cliente completa los campos y genera la vista
            previa: mockups 300x300 con su personalizacion (render cliente TextMuy + pool en
            <code>uploads/pmu/tmp/sesion-{sid}/{item_key}/img/</code>). El boton
            "Agregar al carrito" queda bloqueado hasta que las vistas terminan
            (salvo <code>preview_omisible=true</code>).</li>
        <li><strong>Validez y snapshot</strong>: en la consola, "Configuracion tienda"
            permite activar cada asociacion y escribir una expresion JS opcional
            (<code>campo1 === 'libelulas' &amp;&amp; campo2 === 'a4'</code>), un mensaje
            HTML y si un fallo debe bloquear el carrito. La expresion se evalua solo en
            el navegador. Al agregar, el servidor conserva en
            <code>manifest.pdfs[]</code> solo los PDFs aceptados y registra los descartados
            en <code>pdfs_descartados[]</code>; un snapshot vacio rechaza la compra.</li>
        <li><strong>Carrito y pedido</strong>: al agregar se congela lo aprobado
            (<code>mockup-{id}.webp</code>) y el item se promueve a su
            <code>cart_item_key</code>; al pagarse pasa a
            <code>orders/{order_id}/{item_key}/</code>. La seccion
            <strong>"4. Pedidos completados"</strong> de la consola lista cada item con
            PDFs aceptados, PDFs descartados, estado, etiquetas del cliente y vistas
            congeladas. <strong>"Regenerar PDF"</strong> rearma todos los PDFs aceptados
            desde el pool; en Descargas hay una fila por PDF del snapshot.</li>
    </ol>
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