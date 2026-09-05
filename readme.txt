=== Extractor Corel ===
Contributors: extractor-corel
Tags: pdf, corel, placeholder, credenciales, certificados
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 2.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color. Motor 100% PHP, sin Python.

== Description ==

Extractor Corel automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. Este plugin los detecta, los agrupa por color, deja cargar una imagen real por grupo y la inserta en cada placeholder del PDF, entregando un PDF editado optimizado listo para descargar.

La administracion funciona como consola de trabajo:

1. **Subir PDF**: se detectan los placeholders, se agrupan por color y se generan los datos (dataset) del PDF.
2. **Imagenes por grupo**: el administrador carga una imagen por grupo (grupo A, B, C...), desde la computadora o desde la galeria de medios de WordPress. Cada grupo ofrece ademas su placeholder en PNG transparente descargable, con el tamano exacto.
3. **Procesar**: el motor inserta la imagen de cada grupo en todas sus instancias, encajada en el placeholder (sin deformar ni recortar), y genera el PDF final optimizado.

A diferencia de la version original (Flask + Python), esta version es **100% PHP puro** y se ejecuta directamente en WordPress, por lo que funciona en alojamientos compartidos (Hostinger, etc.) sin necesidad de Python, Node ni procesos persistentes.

**Requisitos del servidor:**

* PHP 7.4 o superior
* Extension zlib (casi siempre disponible)
* La extension GD es opcional: sin GD el motor procesa imagenes PNG (8 bits, sin entrelazar) con su decodificador propio; para JPEG/GIF/WebP se necesita GD (o un JPEG cuyo tamano coincida exactamente con el del grupo)

**Datos guardados** en `wp-content/uploads/extractor-corel/`: `pdfs/` (PDFs subidos), `datos/` (dataset por PDF), `imagenes/` (imagen de cada grupo), `placeholders/` (marcos PNG transparentes descargables) y `salidas/` (PDFs procesados).

== Installation ==

1. Copia el contenido del repositorio a `/wp-content/plugins/extractor-corel/` (la carpeta del plugin es la raiz: `extractor-corel.php`, `admin/`, `assets/`, `engine/`).
2. Activa el plugin en "Plugins" de WordPress.
3. Accede al menu "Extractor Corel" en el panel de administracion.

== Frequently Asked Questions ==

= ¿Necesita Python? =
No. Todo el motor esta escrito en PHP puro (parser de PDF, detector, generador PNG, overlay).

= ¿Funciona en hosting compartido? =
Si, siempre que tenga PHP 7.4+ y zlib. No requiere SSH, Composer ni procesos en segundo plano.

= ¿Que pasa si subo un PDF con un nombre que ya existe? =
El plugin pregunta si renombrarlo automaticamente o sobrescribirlo. Sobrescribir borra los datos, imagenes y resultado anteriores de ese PDF y regenera el analisis.

= ¿Que pasa con los archivos subidos? =
Todo queda en `wp-content/uploads/extractor-corel/`. Puedes borrar cada PDF (con sus datos) desde la propia pantalla del plugin.

== Changelog ==

= 2.0.0 =
* Nueva administracion: consola de PDFs subidos con dataset, imagenes por grupo (subida o galeria de medios), placeholders descargables y boton Procesar.
* Motor principal (Motor.php): PDF + dataset + imagenes -> PDF editado, con validacion de datos y resumen por grupo.
* Imagenes reales con encajado (contain): sin deformar ni recortar, margenes transparentes.
* Soporte de imagenes sin GD: decodificador PNG propio; JPEG exacto incrustado directo (DCTDecode).
* Corregido: los segundos y siguientes draws en una misma pagina heredaban el CTM acumulado (cm) y se dibujaban mal; ahora cada draw va en su propio par q...Q.

= 1.0.0 =
* Version inicial: motor PHP completo (deteccion, marcos, overlay) y plugin WordPress.