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
    <h2>Test (smoke en vivo)</h2>
    <p>La pestana <strong>Test</strong> verifica la instalacion real (WordPress y WooCommerce activos)
        sin ejecutar procesos externos: version de PHP y extensiones, permisos de escritura en
        <code>uploads/pmu/</code>, catalogos de recursos, deteccion y dataset vigente sobre cada PDF
        subido, hooks de la consola, modulo TextMuy integrado, WooCommerce (consulta de productos y
        asociaciones PDF-producto) y render del panel. Devuelve una tabla OK/FALLA con el detalle.</p>
    <p>Guarda la marca de la ultima corrida y avisa cuando la version instalada cambio desde
        entonces: despues de cada despliegue, corre el smoke para confirmar el sitio.</p>
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
    <h2>Campos reutilizables</h2>
    <p>La pestana <strong>Campos</strong> guarda los formularios que se repiten en varios PDFs. El mismo
        <code>id</code> se usa en cuantos PDFs quieras: lo editas una vez y cambia en todos. Cada campo
        trae su propio HTML, CSS y JavaScript.</p>
    <ul>
        <li><strong>Nombre vs titulo para el comprador:</strong> el <em>nombre</em> es para vos (por
            ejemplo "Fotos polaroid x6"); el <em>titulo para el comprador</em> es la etiqueta que se ve en
            la ficha y en el pedido.</li>
        <li><strong>Dos valores:</strong> <code>valor</code> es lo que se imprime en el PDF y
            <code>cliente</code> es lo que lee el comprador. El sistema <strong>no traduce nada</strong>
            por si solo: si querés convertir un codigo en texto, lo escribis en el <em>Script global</em>.</li>
        <li><strong>Probar:</strong> el boton "Probar" muestra el campo tal cual lo vera el comprador,
            con el CSS del tema y los estilos globales. Si el campo monta un cargador (su
            <code>campo.js</code>), dibuja las ranuras sin subir nada.</li>
        <li><strong>Ranuras del cargador (tamano):</strong> cada foto se declara en el <code>RANURAS</code>
            del <code>campo.js</code>. Con <code>phsize: 1</code> la ranura toma el <strong>tamano del hueco</strong>
            del PDF (y <code>2</code> el doble, acotado a 3000 px); con <code>phsize: 0</code> usa los
            <code>w</code>/<code>h</code> escritos a mano. <strong>Conviene <code>phsize: 1</code></strong>: si el
            PDF se re-analiza o el campo se reutiliza en otro PDF, el tamano sigue al hueco solo. La
            plantilla "Imagen (cargador)" ya viene asi.</li>
        <li><strong>El cargador nunca agranda la foto:</strong> el PNG que sube el comprador se guarda con la
            <strong>resolucion real</strong> de la foto, acotada por el hueco (si la foto es mas chica se guarda
            tal cual, y el resto del marco queda con el color de fondo que elija). La unica ampliacion, si
            hace falta, la hace el servidor al insertarla en el PDF.</li>
        <li><strong>Fondo transparente (spec 027):</strong> la ranura puede declarar <code>transp</code>:
            <code>'no'</code> = el fondo <strong>nunca</strong> es transparente (se oculta el boton de fondo
            transparente y, si la foto lo tiene, se usa <strong>blanco puro</strong> o el color solido de sus
            bordes); <code>'si'</code> = se respeta la transparencia <strong>real</strong> de la foto (se
            detecta en toda la imagen, no solo en el borde). <strong>Sin <code>transp</code></strong> el
            comprador decide (comportamiento actual). La plantilla "Imagen (cargador)" viene con
            <code>transp: 'no'</code>.</li>
        <li><strong>Tipo:</strong> el tipo (Texto, Opciones o Imagenes) solo deja el formulario preparado
            y declara para que sirve el <code>valor</code>; despues editas el HTML a tu medida. Se
            puede <strong>corregir en el editor</strong> y el boton <strong>"Cargar la plantilla de este
            tipo"</strong> rellena HTML/CSS/JS con la plantilla vigente. Un campo existente se puede
            duplicar.</li>
        <li><strong>Estilos globales / Script global:</strong> un unico par de archivos para todo el
            plugin (<code>uploads/pmu/campos/global.css</code> y <code>global.js</code>). Se cargan solo
            en las fichas que tienen al menos un campo. El CSS se inyecta limitado al panel, asi que
            no puede romper el tema; el script corre antes de montar los campos.</li>
        <li><strong>Bajar de baja y restaurar:</strong> la baja no borra los archivos: el campo queda
            dado de baja y se puede restaurar desde el panel de abajo.</li>
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
            <code>orders/{order_id}/{item_key}/</code>. La pestana
            <strong>Pedidos</strong> de la consola lista cada item con
            PDFs aceptados, PDFs descartados, estado, etiquetas del cliente y vistas
            congeladas. <strong>"Regenerar PDF"</strong> rearma todos los PDFs aceptados
            desde el pool; en Descargas hay una fila por PDF del snapshot.</li>
    </ol>
    <h2>Bonus: biblioteca compartida</h2>
    <ol>
        <li><strong>Que es</strong>: cada PDF puede entregar, ademas de su PDF final,
            <strong>0..N archivos bonus</strong> (guia, plantilla, ZIP, etc.). Los archivos
            viven en una <strong>biblioteca global</strong>
            (<code>uploads/pmu/bonus/</code>): <em>un mismo archivo puede usarse en
            varios PDFs</em> y <strong>reemplazarlo</strong> (mismo nombre, contenido nuevo)
            actualiza a todos de una. Tambien se acepta una URL externa por fila.</li>
        <li><strong>Acordeon "Bonus"</strong> (consola de PDFs): cada fila lleva
            <em>titulo</em> y una seleccion. El boton <strong>"Elegir…"</strong> abre el
            <strong>modal de la biblioteca</strong>: lista los archivos, permite
            <em>subir</em> nuevos, editar el <strong>titulo por defecto</strong> de cada uno
            (se guarda al escribir), <strong>Elegir</strong> para una fila,
            <strong>Reemplazar</strong> (mismo nombre, contenido nuevo: las referencias de
            todos los PDFs quedan apuntando al archivo reemplazado) y
            <strong>Borrar</strong> — que <em>avisa si esta en uso</em> ("lo usan N PDFs:
            a, b") y, al confirmar, borra el archivo y quita su referencia de esos
            PDFs (los pedidos ya entregados no cambian).</li>
        <li><strong>Titulo por defecto (dinamico)</strong>: si el titulo de una fila queda
            vacio, se usa el titulo del catalogo (<code>uploads/pmu/bonus/bonus.json</code>)
            y, si no tiene, el nombre del archivo sin extension. Cambiar el titulo en la
            biblioteca lo heredan todos los PDFs que lo usen con titulo vacio, hasta el
            momento de la compra (el pedido <em>congela</em> lo que vio el comprador).</li>
        <li><strong>Entrega</strong>: al pagarse el pedido, los bonus de sus PDFs se
            congelan en el line item (<code>_pmu_bonus</code>, titulo resuelto + URL) y se
            listan en el email, la pagina de gracias y <code>mi-cuenta/descargas/</code>
            junto al PDF final, con la misma regla de entrega (con el tema Muy Únicos
            activo los entrega el tema).</li>
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