=== Personalizador PDF ===
Contributors: personalizador-pdf
Tags: pdf, corel, placeholder, credenciales, certificados, textmuy, texto, estilos
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 4.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color, e integra el sistema TextMuy de estilos de texto. Motor 100% PHP, sin Python.

== Description ==

Personalizador PDF (antes "Extractor Corel") automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. El plugin los detecta, los agrupa por color, deja cargar una imagen real por grupo y la inserta en cada placeholder del PDF, entregando un PDF editado optimizado listo para descargar.

La administracion funciona como consola de trabajo con 3 pestanas:

1. **PDFs y procesamiento**: se detectan los placeholders, se agrupan por color y se generan los datos (dataset) del PDF; se carga una imagen por grupo (computadora o galeria de medios) y se procesa el PDF final.
2. **Estilos de Texto**: editor integrado del sistema TextMuy (100% en el navegador, estilo TextStudio) para disenar estilos de texto y guardarlos como presets `.txm` en el servidor (disponibles en todos los navegadores y en el selector de estilo de cada grupo del PDF). Las imagenes para rellenos y fondos se suben a un directorio propio del modulo y se reutilizan entre presets.
3. **Ayuda**: documentacion interna.

A diferencia de la version original (Flask + Python), esta es **100% PHP puro** en el servidor y se ejecuta directamente en WordPress, por lo que funciona en alojamientos compartidos (Hostinger, etc.) sin Python, Node ni procesos persistentes. El modulo TextMuy corre en el navegador del administrador (Canvas + WebGL); no agrega carga al servidor.

**Requisitos del servidor:**

* PHP 7.4 o superior
* Extension zlib (casi siempre disponible)
* La extension GD es opcional: sin GD el motor procesa imagenes PNG (8 bits, sin entrelazar) con su decodificador propio; para JPEG/GIF/WebP se necesita GD (o un JPEG cuyo tamano coincida exactamente con el del grupo)

**Datos guardados** en `wp-content/uploads/personalizador-pdf/`: `pdfs/` (PDFs subidos), `datos/` (dataset por PDF), `imagenes/` (imagen de cada grupo), `placeholders/` (marcos PNG transparentes descargables), `salidas/` (PDFs procesados) y, desde 4.0.0, `textmuy/presets/` + `textmuy/imagenes/` (presets `.txm`/`.webp` e imagenes del editor de estilos). Al activar, los datos de versiones anteriores (incluidos los que vivian dentro de `modules/textmuy/` hasta 3.3.0) se migran automaticamente; la carpeta del plugin queda 100% de solo lectura.

**Modulo TextMuy (opcional)**: desde 4.0.0 el editor de estilos de texto NO viene empaquetado con el plugin. Se importa a mano copiando el proyecto `textmuy` a `wp-content/plugins/personalizador-pdf/modules/textmuy/` (instrucciones en `modules/LEEME.md`). Sin el modulo, el resto del plugin funciona con normalidad.

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

= 4.0.0 =
* **Datos de usuario fuera del plugin**: los presets del editor TextMuy (`.txm` + miniatura `.webp`) y las imagenes subidas se guardan ahora en `wp-content/uploads/personalizador-pdf/textmuy/{presets,imagenes}` (con `catalogo.json` generado en runtime). El plugin queda de solo lectura: se actualiza (ZIP o git) sin preservar archivos. Migracion automatica desde `modules/textmuy/{presets,imagenes}` (<= 3.3.0), reescribiendo las URLs de imagen dentro de los `.txm`.
* **Sin contenido de fabrica**: no hay presets base ni catalogo de imagenes versionados; el administrador crea sus presets y sube sus imagenes desde el editor.
* **Modulo TextMuy separado del repositorio del plugin**: `modules/textmuy/` no se versiona; se importa a mano tras cada actualizacion del modulo (ver `modules/LEEME.md`). Sin el modulo importado, la pestana "Estilos de Texto" muestra un aviso, la seccion "Texto estilizado" por grupo se oculta y el Procesar clasico funciona con normalidad.
* **Contrato**: nueva entrada `urls.presetsBase` en el puente y `PresetManager.presetUrlBase()` en el modulo para leer presets/imagenes desde uploads (retro-compatible; standalone sigue con ruta relativa). Cache-busting `?v=RC9`.
* Corregido: al renombrar/mover una imagen en la galeria, `catalogo.json` registraba un nombre vacio.

= 3.3.0 =
* **Galeria de imagenes unificada** (componente `js/galeria.js`): un solo boton "Select" en los importadores de imagen (rellenos, fondos, texturas, iconos) abre un panel con tabs (fondos/iconos/varios), buscador, subida (boton + arrastrar y soltar + pegar) y footer (nombre, categoria, Save, Delete, Select).
* **Preview en vivo**: en Fill layers (Pattern) y en BACKGROUND, la galeria oculta temporalmente la interfaz, aplica la imagen al instante al hacer click y replica los controles (Fit/Scale/Origin/Repeat o Opacity/Repeat). "Aplicar" persiste; cerrar sin Aplicar revierte al estilo anterior.
* **Imagenes planas + catalogo unico**: `modules/textmuy/imagenes/` sin subcarpetas; la categoria de cada archivo se guarda en `imagenes/catalogo.json`. El CRUD (subir/borrar/renombrar) actualiza el JSON. Los 128 SVGs base del catalogo (45 iconos + 83 fondos) viven en el mismo directorio, versionados.
* Cache-busting `?v=RC7` en render-core e index; render-core incorpora `js/preset-manager.js` para presets `.txm`.

= 3.2.0 =
* **Normalizacion de presets del modulo TextMuy**: el formato unico es `.txm` (delta de settings) junto a su miniatura `.webp`, guardados en `modules/textmuy/presets/` del servidor; disponibles en todos los navegadores y en el selector de estilo de cada grupo de un PDF. Los 9 presets base migraron de `.json` (formato TextStudio crudo) a `.txm`.
* **Un solo panel de presets**: la galeria inferior expandible es la unica UI de presets (guardar, borrar, buscar y migrar). Se eliminan el panel "Presets" y el panel "Local projects (.txm)" de la pestana DOWNLOAD. Boton de migracion unica que sube los presets viejos de localStorage al servidor.
* **Directorio de imagenes subidas**: las imagenes de rellenos/fondos/texturas se guardan en `modules/textmuy/imagenes/` via un puente PHP (nonce, capability, validacion de firma y limites de tamano) y quedan reutilizables entre presets con el picker "Mis imagenes".
* Puente plugin-modulo por postMessage same-origin (handlers `admin_post_personalizador_pdf_textmuy_guardar_preset|borrar_preset|subir_imagen`). El modulo standalone sigue 100% client-side: sin puente, guardar descarga el `.txm` y las imagenes se embeben.
* Cache-busting de los estaticos del modulo: `?v=RC2` (render-core e index). El render-core incorpora `js/preset-manager.js` para resolver presets `.txm`.

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