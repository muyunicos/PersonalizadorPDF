=== Personalizador PDF ===
Contributors: personalizador-pdf
Tags: pdf, corel, placeholder, credenciales, certificados, textmuy, texto, estilos
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 3.1.2
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color, e integra el sistema TextMuy de estilos de texto. Motor 100% PHP, sin Python.

== Description ==

Personalizador PDF (antes "Extractor Corel") automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. El plugin los detecta, los agrupa por color, deja cargar una imagen real por grupo y la inserta en cada placeholder del PDF, entregando un PDF editado optimizado listo para descargar.

La administracion funciona como consola de trabajo con 3 pestanas:

1. **PDFs y procesamiento**: se detectan los placeholders, se agrupan por color y se generan los datos (dataset) del PDF; se carga una imagen por grupo (computadora o galeria de medios) y se procesa el PDF final.
2. **Estilos de Texto**: editor integrado del sistema TextMuy (100% en el navegador, estilo TextStudio) para disenar estilos de texto y guardarlos como presets. En la proxima version, esos estilos se podran asignar a los grupos del PDF para renderizar el texto estilizado al procesar.
3. **Ayuda**: documentacion interna.

A diferencia de la version original (Flask + Python), esta es **100% PHP puro** en el servidor y se ejecuta directamente en WordPress, por lo que funciona en alojamientos compartidos (Hostinger, etc.) sin Python, Node ni procesos persistentes. El modulo TextMuy corre en el navegador del administrador (Canvas + WebGL); no agrega carga al servidor.

**Requisitos del servidor:**

* PHP 7.4 o superior
* Extension zlib (casi siempre disponible)
* La extension GD es opcional: sin GD el motor procesa imagenes PNG (8 bits, sin entrelazar) con su decodificador propio; para JPEG/GIF/WebP se necesita GD (o un JPEG cuyo tamano coincida exactamente con el del grupo)

**Datos guardados** en `wp-content/uploads/personalizador-pdf/`: `pdfs/` (PDFs subidos), `datos/` (dataset por PDF), `imagenes/` (imagen de cada grupo), `placeholders/` (marcos PNG transparentes descargables) y `salidas/` (PDFs procesados). Al activar, los datos de la version 2.0.0 (`uploads/extractor-corel/`) se migran automaticamente.

== Installation ==

Instalacion desde cero (recomendada):

1. En WordPress: "Plugins → Anadir nuevo → Subir plugin" y selecciona `personalizador-pdf.zip`. El ZIP ya contiene la carpeta `personalizador-pdf/` con `personalizador-pdf.php`, `admin/`, `assets/`, `engine/`, `modules/` y `readme.txt`. Pulsa "Instalar ahora" y luego "Activar plugin".
2. Instalacion manual (FTP): copia la carpeta `personalizador-pdf/` completa del repositorio a `/wp-content/plugins/personalizador-pdf/` y activa "Personalizador PDF" en "Plugins".

Despues de activar:

3. Si venias de la version 2.0.0 (Extractor Corel): desactiva el plugin viejo `extractor-corel` (si estaba instalado); los datos de `wp-content/uploads/extractor-corel/` se migran automaticamente a `wp-content/uploads/personalizador-pdf/`.
4. Accede al menu "Personalizador PDF" en el panel de administracion (pestanas "PDFs y procesamiento", "Estilos de Texto" y "Ayuda").

Nota: los PDFs de muestra (`muestra.pdf`, `muestra2.pdf`), la carpeta `tests/` y `AGENTS.md` son archivos de desarrollo del repositorio; no se incluyen en el ZIP de instalacion.

== Frequently Asked Questions ==

= ¿Necesita Python? =
No. Todo el motor esta escrito en PHP puro (parser de PDF, detector, generador PNG, overlay). TextMuy, el editor de estilos, es un modulo client-side que se ejecuta en el navegador.

= ¿Funciona en hosting compartido? =
Si, siempre que tenga PHP 7.4+ y zlib. No requiere SSH, Composer ni procesos en segundo plano.

= ¿Que pasa si subo un PDF con un nombre que ya existe? =
El plugin pregunta si renombrarlo automaticamente o sobrescribirlo. Sobrescribir borra los datos, imagenes y resultado anteriores de ese PDF y regenera el analisis.

= ¿Que pasa con los archivos subidos? =
Todo queda en `wp-content/uploads/personalizador-pdf/`. Puedes borrar cada PDF (con sus datos) desde la propia pantalla del plugin.

== Changelog ==

= 3.1.2 =
* **Corregido**: al procesar con texto estilizado, el envio apuntaba a una URL rota (`[object HTMLInputElement]`) por la colision del `<input name="action">` con la propiedad `form.action` del DOM; ahora se usa siempre el atributo `action` del formulario. Los PDF con texto estilizado procesan y descargan correctamente.
* Robustez del puente: timeout de 90 s en el envio final (AbortController), overlay cerrado antes de navegar al resultado y log de errores con prefijo `[PersonalizadorPDF]` en la consola para diagnostico.

= 3.1.1 =
* El boton **Procesar** se habilita con imagen manual o texto estilizado activo en al menos un grupo (antes solo con imagen).
* Cache-busting de los estaticos del modulo TextMuy (`?v=RCn` en render-core/index) y validacion del contrato del render-core: si el navegador tenia en cache un modulo desactualizado, avisa con recarga Ctrl+F5 en lugar de fallar.

= 3.1.0 =
* **Texto estilizado por grupo (puente TextMuy)**: en "PDFs y procesamiento" cada grupo puede llevar un texto y un estilo (preset TextMuy); al pulsar **Procesar**, el navegador renderiza el texto al tamano exacto del grupo (PNG transparente) y se incorpora como imagen del grupo en el mismo envio. Un solo click.
* Nueva seccion "Texto estilizado" en cada grupo: activar/desactivar, texto (max 300 caracteres), selector de estilo (presets base + los guardados en "Estilos de Texto"), vista previa al tamano del hueco y autoguardado.
* **Render Core** (`modules/textmuy/render-core.html`): motor de render headless del modulo TextMuy (~220 KB sin UI) con API por lotes (`renderBatch`) y cache de presets; el plugin solo consume ese contrato publico.
* Estado por PDF en `datos/{pdf}/textos.json` (texto + estilo por grupo); se borra con el PDF.
* El motor PHP (engine/) sigue sin cambios: recibe imagenes por grupo como siempre.

= 3.0.0 =
* El plugin pasa a llamarse **Personalizador PDF** (antes "Extractor Corel"): archivo principal `personalizador-pdf.php`, clase `Personalizador_PDF_Plugin`, slug `personalizador-pdf` y handlers `admin_post_personalizador_pdf_*`.
* Nueva pestana **Estilos de Texto**: integra el sistema TextMuy como modulo autocontenido en `modules/textmuy/` (editor de estilos de texto client-side en iframe same-origin).
* Migracion automatica al activar: `uploads/extractor-corel/` -> `uploads/personalizador-pdf/` sin perder PDFs, datos, imagenes ni salidas.
* Compatibilidad temporal con hooks y nonces legacy de la 2.0.0 (se eliminan en 3.1).
* El motor PHP (engine/) no se modifica.

= 2.0.0 =
* Nueva administracion: consola de PDFs subidos con dataset, imagenes por grupo (subida o galeria de medios), placeholders descargables y boton Procesar.
* Motor principal (Motor.php): PDF + dataset + imagenes -> PDF editado, con validacion de datos y resumen por grupo.
* Imagenes reales con encajado (contain): sin deformar ni recortar, margenes transparentes.
* Soporte de imagenes sin GD: decodificador PNG propio; JPEG exacto incrustado directo (DCTDecode).
* Corregido: los segundos y siguientes draws en una misma pagina heredaban el CTM acumulado (cm) y se dibujaban mal; ahora cada draw va en su propio par q...Q.

= 1.0.0 =
* Version inicial: motor PHP completo (deteccion, marcos, overlay) y plugin WordPress.