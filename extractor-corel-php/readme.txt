=== Extractor Corel ===
Contributors: extractor-corel
Tags: pdf, corel, placeholder, credenciales, certificados
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW. Motor 100% PHP, sin Python.

== Description ==

Extractor Corel automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. Este plugin los detecta, los agrupa por color, genera un PNG transparente por grupo con las dimensiones exactas y los superpone sobre el PDF original, entregando un PDF optimizado listo para descargar.

A diferencia de la version original (Flask + Python), esta version es **100% PHP puro** y se ejecuta directamente en WordPress, por lo que funciona en alojamientos compartidos (Hostinger, etc.) sin necesidad de Python, Node ni procesos persistentes.

**Requisitos del servidor:**

* PHP 7.4 o superior
* Extension zlib (casi siempre disponible)
* La extension GD es opcional: el motor genera PNGs transparentes sin GD

**Flujo:**

1. Subir un PDF exportado desde Corel.
2. El motor detecta los placeholders agrupados por color.
3. Genera los marcos PNG transparentes.
4. Superpone los marcos y descarga el PDF resultante.

== Installation ==

1. Sube la carpeta `extractor-corel-php` a `/wp-content/plugins/`.
2. Activa el plugin en "Plugins" de WordPress.
3. Accede al menu "Extractor Corel" en el panel de administracion.

== Frequently Asked Questions ==

= ¿Necesita Python? =
No. Todo el motor esta escrito en PHP puro (parser de PDF, detector, generador PNG, overlay).

= ¿Funciona en hosting compartido? =
Si, siempre que tenga PHP 7.4+ y zlib. No requiere SSH, Composer ni procesos en segundo plano.

= ¿Que pasa con los archivos subidos? =
Los PDFs procesados se guardan temporalmente en `wp-content/uploads/extractor-corel` y los marcos en `wp-content/uploads/extractor-corel/marcos`. Puedes borrarlos manualmente cuando quieras.

== Changelog ==

= 1.0.0 =
* Version inicial: motor PHP completo (deteccion, marcos, overlay) y plugin WordPress.