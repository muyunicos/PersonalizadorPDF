=== Personalizador PDF ===
Contributors: personalizador-pdf
Tags: pdf, corel, placeholder, credenciales, certificados, textmuy, texto, estilos
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 4.1.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color, e integra el sistema TextMuy de estilos de texto. Motor 100% PHP, sin Python.

== Description ==

Personalizador PDF (antes "Extractor Corel") automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. El plugin los detecta, los agrupa por color, deja cargar una imagen real por grupo y la inserta en cada placeholder del PDF, entregando un PDF editado optimizado listo para descargar.

La administracion funciona como consola de trabajo con 4 pestanas:

1. **PDFs y procesamiento**: se detectan los placeholders, se agrupan por color y se generan `analisis.json` + `config.json` del PDF; se carga una imagen por grupo (computadora o galeria de medios) y se procesa el PDF final.
2. **Campos**: catalogo reutilizable de campos (`campos.json`) para la tienda (spec 004 / plan 008).
3. **Estilos de Texto**: editor integrado del sistema TextMuy (100% en el navegador, estilo TextStudio) para disenar estilos de texto y guardarlos como presets `.txm` en el servidor (disponibles en todos los navegadores y en el selector de estilo de cada grupo del PDF). Las imagenes para rellenos y fondos se suben a `uploads/pmu/img/` y se reutilizan entre presets.
4. **Ayuda**: documentacion interna (resumen; canonico en `AGENTS.md` §5).

A diferencia de la version original (Flask + Python), esta es **100% PHP puro** en el servidor y se ejecuta directamente en WordPress, por lo que funciona en alojamientos compartidos (Hostinger, etc.) sin Python, Node ni procesos persistentes. El modulo TextMuy corre en el navegador del administrador (Canvas + WebGL); no agrega carga al servidor.

**Requisitos del servidor:**

* PHP 7.4 o superior
* Extension zlib (casi siempre disponible)
* La extension GD es opcional: sin GD el motor procesa imagenes PNG (8 bits, sin entrelazar) con su decodificador propio; para JPEG/GIF/WebP se necesita GD (o un JPEG cuyo tamano coincida exactamente con el del grupo)

**Datos guardados** (detalle canonico en `AGENTS.md` §5): cada PDF vive en `wp-content/uploads/pmu/pdfs/{nombre}/` (`{nombre}.pdf` + `analisis.json` inmutable + `config.json` editable con `activo`/`productos`/`campos_ids`/`placeholders[id]`); las pruebas del panel (imagenes aplicadas, salida de muestra) van a `wp-content/uploads/pmu/tmp/muestras/{nombre}/` (se sobrescriben en cada Procesar); ciclo comprador en `tmp/cart/{linea}/` (legacy) + `tmp/sesion-{sid}/{item_key}/` (vigente plan 008, preview obligatoria), staging en `tmp/orders/{order_id}/` y resultados confirmados en `orders/{order_id}/{pdf}/`; datos TextMuy en `wp-content/uploads/pmu/{fonts,img,tm-presets}/` (catalogos `fonts.json`/`img.json`/`presets.json` + fisicos + `.txm` + `thumbs.webp` por ambito). La carpeta del plugin queda 100% de solo lectura.

**Modulo TextMuy (integrado desde 4.2)**: el editor de estilos de texto ya viene incluido en `wp-content/plugins/personalizador-pdf/modules/textmuy/` (detalle en `modules/LEEME.md`; canonico tecnico en `AGENTS.md` §2.1). Sin el modulo, el resto del plugin funciona con normalidad.

== Installation ==

Instalacion desde cero (recomendada):

1. En WordPress: "Plugins → Anadir nuevo → Subir plugin" y selecciona `personalizador-pdf.zip`. El ZIP ya contiene la carpeta `personalizador-pdf/` con `personalizador-pdf.php`, `admin/`, `assets/`, `engine/`, `inc/`, `modules/` y `readme.txt`. Pulsa "Instalar ahora" y luego "Activar plugin".
2. Instalacion manual (FTP): copia la carpeta `personalizador-pdf/` completa del repositorio a `/wp-content/plugins/personalizador-pdf/` y activa "Personalizador PDF" en "Plugins". El modulo TextMuy ya viene incluido en `modules/textmuy/` (nada que importar).

Despues de activar:

3. Subi `uploads/pmu/` COMPLETA a `wp-content/uploads/` (incluye `{fonts,img,tm-presets}` con sus catalogos: son los datos del administrador; ver `AGENTS.md` §5).
4. Accede al menu "Personalizador PDF" en el panel de administracion (pestanas "PDFs y procesamiento", "Campos", "Estilos de Texto" y "Ayuda").

Nota: los PDFs de muestra (`muestra.pdf`, `muestra2.pdf`), la carpeta `tests/` y `AGENTS.md` son archivos de desarrollo del repositorio; no se incluyen en el ZIP de instalacion.

== Frequently Asked Questions ==

= ¿Necesita Python? =
No. Todo el motor esta escrito en PHP puro (parser de PDF, detector, generador PNG, overlay). TextMuy, el editor de estilos, es un modulo client-side que se ejecuta en el navegador.

= ¿Funciona en hosting compartido? =
Si, siempre que tenga PHP 7.4+ y zlib. No requiere SSH, Composer ni procesos en segundo plano.

= ¿Que pasa si subo un PDF con un nombre que ya existe? =
El plugin pregunta si renombrarlo automaticamente o sobrescribirlo. Sobrescribir borra los datos, imagenes y resultado anteriores de ese PDF y regenera el analisis.

= ¿Que pasa con los archivos subidos? =
Todo queda en `wp-content/uploads/pmu/`: cada PDF en `pdfs/{nombre}/` (`{nombre}.pdf` + `analisis.json` + `config.json`) y las pruebas del panel en `tmp/muestras/{nombre}/`. Puedes borrar cada PDF (con sus datos y muestras) desde la propia pantalla del plugin; los pedidos confirmados en `orders/` nunca se tocan desde la consola. Detalle en `AGENTS.md` §5.

== Changelog ==

= 4.1.0 =
* **Consola redisenada (tarjeta "3. Personalizacion")**: cabecera en una linea (grupos, instancias, badge de cobertura, Descargar JSON y Re-analizar con botones chicos); "Configuracion tienda" y "Placeholders" en acordeones, con switch Activo en la cabecera del acordeon; "Mockups" como seccion reservada.
* **Placeholders con pestanas por grupo**: un panel visible a la vez, en 2 columnas (marco con galeria al clic + Descargar placeholder, a la izquierda; asignacion a la derecha). La asignacion unifica el mapeo: modo codigo (codigo libre con `[campoN]` + tipo texto/imagen) o selector de campo; el estilo TextMuy se elige solo para tipo texto (primer preset por defecto). Boton "Probar" renderiza la vista previa con el texto de muestra (los `[campoN]` se resuelven con el titulo del campo). El estado canonico vive en hidden inputs `placeholders[id]` (mismo `config.json` de siempre) y se sincroniza con JS.
* **Guardar unificado**: la tarjeta guarda activo, productos, campos y mapeos en un POST AJAX (`ajax=1` del handler existente) sin recargar, con estado en pantalla y actualizacion del badge de cobertura. "Procesar PDF" guarda la configuracion primero y luego envia un solo POST con los PNG `imagen_{id}` renderizados (ya no envia `texto_`/`estilo_`, asi la plantilla de `config.json` no se pisa con la muestra). El endpoint `personalizador_pdf_guardar_texto` se conserva (lo ejercita `tests/texto_puente.php`); su formulario literal sale de la UI.
* **Imagenes sin recargar**: subida por AJAX (`ajax=1` en `personalizador_pdf_subir_imagen`), arrastrar y soltar sobre el marco, galeria wp.media sin recarga (descarga el adjunto y lo sube por AJAX) y "Quitar imagen" AJAX (`ajax=1` en `personalizador_pdf_quitar_imagen`). `guardar_imagen` ahora lanza excepcion (llamadores envueltos) para que los errores lleguen como JSON. Cabecera de la tarjeta como `div` (wpautop no la parte).
* **Productos con buscador**: chips con autocompletado via nuevo endpoint `wp_ajax_personalizador_pdf_buscar_productos` (`wc_get_products`, nonce dedicado); alta manual con Enter + ID numerico como fallback sin Woo; los chips envian `productos[]` (el handler ya lo normalizaba). **Alta rapida de campos**: boton "Nuevo campo" abre un modal que reusa `personalizador_pdf_campo` con `ajax=1` y agrega la opcion al multi-select y a los selectores de placeholder al instante.

= 4.0.1 =
* **Layout de PDFs (una carpeta por producto, plan 008)**: cada PDF vive en `uploads/pmu/pdfs/{nombre}/` (`{nombre}.pdf` + `analisis.json` inmutable + `config.json` editable con `activo`/`productos`/`campos_ids`/`placeholders[id]`, clave `id` = color hex sin `#`); sin `textos.json` ni `metadata.json`. (Historial 4.0.1: `metadata.json` como fuente unica.)
* **Placeholders sin archivos**: la consola dibuja un marco al tamano real y la descarga se genera al vuelo (PNG transparente `w`x`h`); ya no se guardan PNGs de placeholder en disco.
* **Muestras idempotentes**: imagenes aplicadas y salida del panel en `uploads/pmu/tmp/muestras/{pdf}/` (se sobrescriben en cada Procesar; un archivo por grupo).
* **Ciclo comprador (rutas listas, sin cableado Woo aun)**: borradores legacy por linea en `tmp/cart/{linea}/` (+ `manifest.json`) junto a la unidad vigente plan 008 `tmp/sesion-{sid}/{item_key}/` (preview obligatoria `draft-{uuid}` → `cart_item_key`), staging en `tmp/orders/{order_id}/` y entregable por linea en `orders/{order_id}/{pdf}/` (promocion por `rename()` solo al confirmarse el pago).
* **Migracion historica `.migrado-007` retirada**: (nota 4.0.1: copiaba `uploads/personalizador-pdf/`/`extractor-corel/` al layout nuevo una sola vez). La fase `migracion` del arnes verifica que ya no existe `migrar_datos_heredados`.
* **Consola robusta**: ningun fallo de recursos del motor (catalogos, rutas, permisos) muestra la pagina de error critico: la pestana responde 200 con el aviso y su causa.
* Escritura atomica de catalogos (`.tmp` + `rename`) y lectura tolerante (catalogo ilegible = aviso, no fatal).

= 4.0.0 =
* **Datos de usuario fuera del plugin (v5.0)**: los presets TextMuy (`.txm`), catalogos, fisicos y sprites se guardan en la ubicacion unica `wp-content/uploads/pmu/tm/` (catalogo `img.json` unificado con los fisicos, sin `imagenes/`); los `.txm` guardan las imagenes SOLO por id numerico (resuelto a URL al renderizar). El plugin queda de solo lectura: se actualiza sin preservar archivos. Sin migradores: los datos se crean desde cero.
* **Sin contenido de fabrica**: no hay presets base ni catalogo de imagenes versionados; el administrador crea sus presets y sube sus imagenes desde el editor.
* **Modulo TextMuy separado del repositorio del plugin**: `modules/textmuy/` no se versiona; se importa a mano tras cada actualizacion del modulo (ver `modules/LEEME.md`). Sin el modulo importado, la pestana "Estilos de Texto" muestra un aviso, la seccion "Texto estilizado" por grupo se oculta y el Procesar clasico funciona con normalidad.
* **Contrato**: nueva entrada `urls.presetsBase` en el puente y `PresetManager.presetUrlBase()` en el modulo para leer presets/imagenes desde uploads (retro-compatible; standalone sigue con ruta relativa). Cache-busting `?v=RC9`.
* Corregido: al renombrar/mover una imagen en la galeria, `catalogo.json` registraba un nombre vacio.

= 3.3.0 =
* **Galeria de imagenes unificada** (componente `js/galeria.js`): un solo boton "Select" en los importadores de imagen (rellenos, fondos, texturas, iconos) abre un panel con tabs (fondos/iconos/varios), buscador, subida (boton + arrastrar y soltar + pegar) y footer (nombre, categoria, Save, Delete, Select).
* **Preview en vivo**: en Fill layers (Pattern) y en BACKGROUND, la galeria oculta temporalmente la interfaz, aplica la imagen al instante al hacer click y replica los controles (Fit/Scale/Origin/Repeat o Opacity/Repeat). "Aplicar" persiste; cerrar sin Aplicar revierte al estilo anterior.
* **Locacion unica uploads/pmu/tm**: imagenes planas + catalogo `img.json` en `wp-content/uploads/pmu/tm/img/` (sin `imagenes/`); la categoria de cada archivo se guarda en la tupla `[id,title,cats,file]`. El CRUD (subir/borrar/renombrar) actualiza el JSON y la tupla.
* Cache-busting `?v=RC7` en render-core e index; render-core incorpora `js/preset-manager.js` para presets `.txm`.

= 3.2.0 =
* **Normalizacion de presets del modulo TextMuy**: el formato unico es `.txm` (delta de settings) junto a su miniatura `.webp`, guardados en `modules/textmuy/presets/` del servidor; disponibles en todos los navegadores y en el selector de estilo de cada grupo de un PDF. Los 9 presets base migraron de `.json` (formato TextStudio crudo) a `.txm`.
* **Un solo panel de presets**: la galeria inferior expandible es la unica UI de presets (guardar, borrar, buscar y migrar). Se eliminan el panel "Presets" y el panel "Local projects (.txm)" de la pestana DOWNLOAD. Boton de migracion unica que sube los presets viejos de localStorage al servidor.
* **Directorio de imagenes subidas**: las imagenes de rellenos/fondos/texturas se guardan en `wp-content/uploads/pmu/tm/img/` (unificado con el catalogo) via un puente PHP (nonce, capability, validacion de firma y limites de tamano) y quedan reutilizables entre presets con el picker "Mis imagenes".
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
* Estado por grupo en el dataset (`default`/`value`/`preset` en `metadata.json`); se borra con el PDF.
* El motor PHP (engine/) sigue sin cambios: recibe imagenes por grupo como siempre.

= 3.0.0 =
* El plugin pasa a llamarse **Personalizador PDF** (antes "Extractor Corel"): archivo principal `personalizador-pdf.php`, clase `Personalizador_PDF_Plugin`, slug `personalizador-pdf` y handlers `admin_post_personalizador_pdf_*`.
* Nueva pestana **Estilos de Texto**: integra el sistema TextMuy como modulo autocontenido en `modules/textmuy/` (editor de estilos de texto client-side en iframe same-origin).
* Migracion automatica al activar: `uploads/extractor-corel/` -> `uploads/pmu/` sin perder PDFs, datos, imagenes ni salidas.
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