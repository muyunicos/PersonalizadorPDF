=== Personalizador PDF ===
Contributors: personalizador-pdf
Tags: pdf, corel, placeholder, credenciales, certificados, textmuy, texto, estilos
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 4.6.17
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reemplaza placeholders (rectangulos 100% transparentes) en PDFs exportados desde CorelDRAW con imagenes reales por grupo de color, e integra el sistema TextMuy de estilos de texto. Motor 100% PHP, sin Python.

== Description ==

Personalizador PDF (antes "Extractor Corel") automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. El plugin los detecta, los agrupa por color, deja cargar una imagen real por grupo y la inserta en cada placeholder del PDF, entregando un PDF editado optimizado listo para descargar.

La administracion funciona como consola de trabajo con 6 pestanas:

1. **PDFs y procesamiento**: se detectan los placeholders, se agrupan por color y se generan `analisis.json` + `config.json` del PDF; se carga una imagen por grupo (computadora o galeria de medios) y se procesa el PDF final.
2. **Campos**: catalogo reutilizable de campos (`campos.json`) para la tienda (spec 004 / plan 008).
3. **Estilos de Texto**: editor integrado del sistema TextMuy (100% en el navegador, estilo TextStudio) para disenar estilos de texto y guardarlos como presets `.txm` en el servidor (disponibles en todos los navegadores y en el selector de estilo de cada grupo del PDF). Las imagenes para rellenos y fondos se suben a `uploads/pmu/img/` y se reutilizan entre presets.
4. **Pedidos**: lista de pedidos completados con sus PDFs; permite revisar y **Regenerar PDF** por linea (entrega en `orders/{order_id}/{item_key}/`).
5. **Test**: smoke test en vivo del sitio (entorno, permisos, catalogos, motor sobre los PDFs subidos, hooks, TextMuy, WooCommerce y render de la consola) con tabla OK/FALLA; avisa si la version instalada cambio desde la ultima corrida.
6. **Ayuda**: documentacion interna (resumen; canonico en `AGENTS.md` §5).

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
4. Accede al menu "Personalizador PDF" en el panel de administracion (pestanas "PDFs y procesamiento", "Campos", "Estilos de Texto", "Test" y "Ayuda").

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

= 4.6.17 =
* **Fix: el pedido seguia sin email ni descarga (y a veces sin Pedidos) aunque el formulario estuviera completo** (causa real diagnosticada con `uploads/pmu/pmu-pedidos.log` + disco del item, caso #29081). El checkout de Woo reporta un **`cart_item_key` RECALCULADO** (el hash del item cambia al restaurar el carrito en el request de checkout: los custom cart data no sobreviven) que **NO coincidia con el nombre real de la carpeta** que dejo `carrito_promover` al agregar al carrito. `pedido_item_crear()` buscaba el manifest por ese nombre, fallaba (`item_crear:sin_item`) y volvia en un `return` temprano silencioso: sin metadata `_pmu_sid`/`_pmu_item_key` en el line item, `pedido_promover()` no tenia nada que promover, `orders/` quedaba vacio, y en consecuencia tampoco se publicaba `_urls_files` para que el tema entregue el **email de completado** y `mi-cuenta/descargas/`. Ahora: `PMU_Sesion::resolver_item_checkout()` resuelve el item por **sid + manifest existente** (candidatos directos y, si ninguno coincide, scan de la sesion tomando el item real por su `manifest.json`), sin depender de la estabilidad del hash de Woo. `pedido_promover()` tiene la misma red de seguridad: si el `_pmu_item_key` guardado no resuelve, se re-resuelve por scan antes de promover (recupera pedidos historicos como el #29081 al re-guardar el estado). Test: la fase `carrito` siembra el caso exacto del #29081 (item bajo su nombre real + checkout con hash recalculado distinto) y exige que la metadata quede con el **nombre real** y que la promocion vaya a `orders/{id}/{nombre_real}/` (5 checks nuevos; 20/20 en verde).

= 4.6.16 =
* **Fix: el pedido no llegaba a `orders/` ni aparecia en la pestaña Pedidos** (causa real, diagnosticada con `uploads/pmu/pmu-pedidos.log`). Dos bugs: (1) el staging se creaba en `woocommerce_checkout_create_order_line_item`, donde el pedido **todavia no tiene ID** (`get_id()` = 0), y `dir_tmp_order(0)` lanzaba `motor:dir_tmp_order:pedido:invalido` -> el staging nunca se creaba; (2) al fallar, `_pmu_items` del pedido quedaba con una **clave fantasma `0`**. Ahora: el staging se crea en el hook **`woocommerce_checkout_order_processed`** (`pedido_staging_crear()`, con el ID real) y `pedido_promover()` **ya no depende de `_pmu_items`**: itera los line items del pedido y usa su metadata `_pmu_sid`/`_pmu_item_key` (que si persiste), creando el staging al vuelo si falta e **ignorando la clave fantasma `0`**. Esto recupera pedidos anteriores (ej. #29079): al re-guardar el estado o con "Regenerar" se promueven solos. Test: la fase `carrito` ahora siembra `_pmu_items` corrupto (claves `0` + real) y exige que solo el item real llegue a `orders/`.

= 4.6.15 =
* **Entrega por el tema Muy Únicos (spec 017, D1-D6)**: cuando el tema `muyunicos` (`generatepress-child`) esta activo, el plugin deja de duplicar la capa de entrega y **publica el PDF en la meta `_urls_files` del order item**. A partir de ahi el **tema** (que ya funciona en produccion) se encarga de: mostrar el descargable en `mi-cuenta/descargas/` con su propia tabla e **incluir el link en el email de "pedido completado"** (hoy el cliente NO recibe el link por email). Deteccion por **capacidad** (`function_exists('mu_update_item_files')`), URL **protegida** por el endpoint propio (`personalizador_pdf_item_descargar` con `order_key`, NO una ruta cruda de `uploads/`), escritura **idempotente** (no duplica ni pisa archivos que el admin subio a mano) y **sin doble fila**: con el tema activo `descargas_cliente` ya no inyecta su fila propia. Ademas se define la clase `MuyUnicos_PDF_Generator::generate()` que el boton "Generar PDF" de la pantalla del pedido ya invocaba (hoy respondia "Generador PDF no activo"). Portable: sin el tema, el comportamiento propio queda intacto. Tests: fases nuevas `entrega_tema` (5 checks) y `entrega_sin_tema`.

= 4.6.14 =
* **Fix: al completar la compra el pedido seguia sin llegar a la pestaña Pedidos ni a las descargas** (segunda causa, tras el fix 4.6.13 del `item_key` en el carrito). En el checkout (otro request HTTP donde Woo restaura el carrito de su sesion) los **custom cart data `pmu_sid`/`pmu_item_key` no sobreviven**, y `pedido_item_crear()` los usaba para identificar el item: con `$values` vacio entraba en un `return` temprano silencioso, no se creaba el staging (`tmp/orders/`) ni `_pmu_items`, y el pedido nunca se promovia a `orders/`. Ahora la identidad sale de la **cookie `pmu_sid`** (`sid_actual()`, norma spec 014) y el `item_key` se resuelve probando el **`cart_item_key` real de Woo** (`$clave`, que coincide con el nombre de la carpeta tras promover) y luego el de los datos; gana el primero cuyo manifest exista bajo ese sid. Ademas, log de diagnostico `uploads/pmu/pmu-pedidos.log` (bajo volumen, fail-safe) en los caminos de fallo de `pedido_item_crear`/`pedido_promover`. Test: la fase `carrito` ahora ejercita el ciclo con **`$values` vacio** (custom data perdidos) y exige staging + `_pmu_items` + promocion a `orders/`.

= 4.6.13 =
* **Fix: al completar la compra el pedido nunca llegaba a la pestaña Pedidos** (`orders/` y `tmp/orders/` quedaban vacios). `carrito_promover()` renombraba en disco la carpeta del item de `draft-{uuid}` al `cart_item_key` real de Woo, pero **no actualizaba** `pmu_item_key` en los datos del carrito: seguia apuntando al draft, que ya no existia. En el checkout, `pedido_item_crear()` leia ese draft huerfano, `staging_order()` fallaba con `motor:sesion:item:ausente` y el fail-safe se lo tragaba en silencio; al pagar, `pedido_promover()` no encontraba staging y no promovia nada. Ahora, tras promover, el carrito se actualiza al `item_key` real (`WC()->cart->cart_contents[$item_key]['pmu_item_key']`), y `pedido_item_crear()` tiene ademas una defensa: si el item_key de los datos no resuelve pero el `cart_item_key` (2.º parametro del hook) si, usa el real. Cubre checkout, staging, promocion, re-edicion y etiquetas. Test: la fase `carrito` ahora encadena el ciclo real (agregar -> promover -> checkout -> staging -> pago -> `orders/`) con checks nuevos.

= 4.6.12 =
* **Fix: la foto subida por el comprador no se veia en la vista previa (hueco transparente / gris), con error `motor:subida:archivo:ausente` en `personalizador_pdf_subida_url`**. `PMU_Sesion::resolver_subidas()` reconstruia la ruta del archivo con `dir_item()` + `basename()`, o sea que le arrancaba la carpeta `subidas/` y la buscaba en la **raiz del item**, donde el archivo no existe (`handle_subida_url` respondia `motor:subida:archivo:ausente`, el cliente recibia null y la instancia de imagen nunca entraba al mockup). Ahora resuelve contra `dir_subidas()`. El texto no se veia afectado porque no usa esta ruta. Test: assert nuevo en la fase `campo_subida` que exige que la ruta devuelta por `resolver_subidas()` apunte a un archivo REAL (antes solo se comprobaba la ruta cruda del manifest, por eso el bug paso desapercibido).

= 4.6.11 =
* **Campos: el indice `campos.json` vive junto al codigo de los campos** (`uploads/pmu/campos/campos.json`, antes en la raiz de `pmu/`) con migracion one-shot automatica, idempotente y tolerante (si el `rename` falla, la lectura sigue sobre la ruta legada y ningun dato se pierde; la escritura siempre va a la nueva). Ademas: **cola del pool por grupo** en la ficha (`PURO.enCola`, serializa `limpiar`+subidas de un mismo grupo entre instancias y entre vistas) y **la vista del cliente ya no muestra la caja neutra gris** de un hueco sin recurso (`PMUMockup.componer` acepta `huecosTransparentes: true`; solo la usa la ficha).

= 4.6.10 =
* **Fix: `motor:sesion:manifest:invalido` y capa de imagen gris en la vista previa con varios grupos**. La rafaga de POSTs del pool (texto + fotos por instancia, en paralelo) chocaba en la escritura del manifest: `manifest.json.tmp` de nombre fijo + rename sin lock, y read-modify-write concurrente que perdia filas. Una instancia fallida dejaba la capa placeholder sin recurso (caja gris) y la vista se marcaba rota. Ahora TODAS las mutaciones del manifest del item (`guardar_png`, `limpiar_grupo`, `guardar_subida`, `congelar_webp`, `pool_filtrar_pdfs`) pasan por un lock `flock` por item (`.manifest.lock`, que no viaja al pedido). Test: fase nueva `pool_concurrente` que lanza 8 procesos hijos escribiendo el pool en paralelo y exige las 8 filas sin fallos ni `.tmp` colgando.

= 4.6.9 =
* **La vista previa omisible se muestra igual**: `preview_omisible=true` ya no oculta el boton "Vista previa" ni la galeria. El comprador puede pedir la vista cuando quiera; el flag solo deja de **bloquear el boton de comprar** mientras las vistas no estan listas. Si no pide vistas, el item omisible se sigue creando en el servidor al agregar.

= 4.6.8 =
* **Fix: al re-editar un item guardado con la 4.6.6, la foto seguia sin verse en la vista previa**. El manifest viejo guardaba el valor del campo imagen como literal `"Array"`; al precargar (`?pmu_item_key=`), el cargador restauraba ese id fantasma, que ocupaba la primera instancia del grupo y dejaba la capa placeholder sin recurso (caja gris). Triple correccion: la ficha **repara el legado al precargar** (campo con cargador y valor no-array -> lista vacia), el **saneo descarta ids que no son hex de 12** (el formato real del id del servidor) y el cliente **filtra el literal "Array"** en `idsDe()`. Los items viejos se auto-reparan al re-editar y generar la vista previa de nuevo.

= 4.6.7 =
* **Fix: las fotos del comprador no se veian en la vista previa**. En `assets/tienda.js` los grupos de imagen (cargador de la spec 012) subian sus PNG al pool del item pero **nunca entraban a `pngsPorGrupo`**, el mapa que usa `componerMockup()`: la capa placeholder no resolvia y se dibujaba la caja neutra gris en vez de la foto. Ahora `subirFotos()` devuelve el blob junto al grupo/instancia y se incorpora al mapa antes de componer. Ademas, un PDF de solo-imagen ya no carga el motor TextMuy (el iframe de render era dependencia innecesaria que, si no cargaba, marcaba la vista rota y aparecia "no hay vista previa").
* **Fix: el valor de un campo tipo imagen se guardaba como "Array"**. `valores_sanitizados()` hacia `(string)` de la lista de ids que publica el cargador, y el manifest quedaba con el literal `"Array"`: al re-editar (`?pmu_item_key=`) la imagen no resolvia. Ahora la lista se preserva como array (ids saneados y acotados) y `idsDe()` la re-lee tal cual.
* **Fix: el primer "Agregar al carrito" fallaba siempre**. `carrito_validar()` exigia `preview_estado=ok`, pero ese estado solo se marca en `carrito_promover()`, que corre en `woocommerce_add_to_cart` (DESPUES de la validacion de `woocommerce_add_to_cart_validation`). Resultado: la validacion rechazaba con "Tu personalizacion ya no es valida" y Woo recargaba la ficha con los campos en blanco. El visto bueno es agregar al carrito: la validacion acepta el draft del producto sin exigir `ok`, y el estado queda como registro para el admin. Arnés: la fase `conciliacion` ahora verifica el orden real (draft en `sin_vista` habilita carrito) y `vista_previa` verifica el array preservado.

= 4.6.6 =
* **Fix: los tiradores de redimension del editor de mockups estaban desalineados**. En `dibujarSeleccion()` los cuadraditos se dibujaban con la posicion **global** dentro de un contexto del canvas que ya tenia `translate(centro) + rotate + transform(sesgo)`: la transformacion se aplicaba DOS veces y cada tirador salia corrido por el centro de la capa (muchas veces fuera del marco), lejos de donde el hit-test buscaba el clic. La posicion del tirador pasa a la geometria pura (`PMUGeometria.posicionTirador`), testeable, con dos modos: `{local: true}` para DIBUJAR (offset respecto al centro, el contexto ya transforma) y global para el hit-test. Se elimino la copia duplicada que vivia en `mockups.js`. Test: 18 checks nuevos en `mockup-geometria.test.js` + 4 en `mockup-contrato.test.js`.
* **Mejora: el giro de una capa ahora es preciso**. El tirador de rotacion redondeaba a 15 grados por defecto (la convencion estaba invertida): sin Shift saltaba de 15 en 15 y con Shift pasaba a 1. Ahora **sin Shift gira grado a grado** y con Shift ajusta a la rejilla de 15 grados (0, 15, 30...), igual que en los editores estandar. Test: assert en `mockup-contrato.test.js`.

= 4.6.5 =
* **Fix: los placeholders no aparecian en el editor de mockups**. En `pintarGrupos()` (`assets/mockups.js`) se construia el `<li>` de cada placeholder (grupo, instancias, etiqueta PH-...) pero **nunca se insertaba en el `<ul>`**, asi que el panel "Placeholders" quedaba vacio con el aviso "Este PDF no tiene grupos" oculto (porque `grupos.length > 0`). Una linea: `$ul.append($li)` dentro del `forEach`. Test: assert nuevo en `mockup-contrato.test.js` que exige el append (70 checks).

= 4.6.4 =
* **Fix: el panel de personalizacion no aparecia en la ficha del producto** (bug en produccion, reportado en `muyunicos.com`). La ficha resuelve el PDF por el **postmeta canonico** `_pmu_pdf_slugs` del producto (constitution §I), NO por el espejo `config.json:productos[]`; pero la consola solo escribia el espejo, asi que asociar un producto nunca encendia el panel aunque `config.json` se veia correcto. `handle_config_guardar()` ahora sincroniza el postmeta canonico de cada producto (reutiliza `producto_pdf_vincular/desvincular`, idempotente) al guardar; un vinculo que falla es un **aviso visible**, no un error que tumbe el guardado. Repara los PDFs ya asociados con solo volver a pulsar "Guardar". Arnés: 2 asserts nuevos en la fase `tienda`.

= 4.6.3 =
* **Retiro de la migracion v1 de campos**: el formato v1 del catalogo (`campos.json` sin `version`, con tuplas de 10 slots) nunca se publico en una version distribuida, asi que no hay datos v1 que migrar en ningun sitio real. Se retira `PMU_Uploads::migrar_campos()`, el aviso `motor:campos:migrar:pendiente`, el boton "Migrar ahora" y la fase `campo_migrar` del arnes. El aviso de la pestana Campos queda reservado a los catalogos ilegibles (que si son un problema real de datos). Un indice sin `version` con items vacios se lee como catalogo vacio: sin aviso.
* **Mockups: distribuir (cierra T034 de la spec 011)**: junto a los 6 botones de alinear hay ahora "Distribuir H" y "Distribuir V", que reparten las capas seleccionadas con el mismo hueco de borde a borde del lienzo via `PMUGeometria.distribuir` (con menos de 3 seleccionadas no hace nada), con el mismo ciclo de autoguardado y deshacer que el resto de la edicion.

= 4.6.2 =
* **Migracion de campos v1 con boton**: la pestana Campos muestra "Migrar ahora" cuando el catalogo sigue en el formato v1 (aviso `motor:campos:migrar:pendiente`). El boton dispara la migracion one-shot al formato vigente (indice v3 + carpeta por campo), con copia `campos.json.bak` previa, idempotente y reversible. Mapeo de tipos v1: `select` -> `opciones`, `img` -> `imagen`, el resto -> `texto`; las categorias v1 no se migran (fuera del formato). El metodo viejo `migrar_campos_v2` (que dejaba el indice a medias) se retira.
* **Preview fiel del cargador**: "Ver como lo vera el comprador" monta el cargador TAL CUAL lo ve el comprador (boton "Agregar imagen", drop zone, Listo), con subida SIMULADA en memoria: abre el selector real, recorta y ve la miniatura al instante, sin endpoint ni item. Ademas el aviso de migracion solo aparece cuando el catalogo v1 tiene campos reales (un indice vacio de desarrollo ya no avisa).

= 4.6.1 =
* **Correccion (plantilla "Imagen (cargador)")**: la plantilla traia un boton placeholder que decia "El cargador todavia no esta disponible" al tocarlo (referenciaba un PMUCargador que nunca existio; el cargador real lo monta el sistema). La plantilla queda limpia y el comprador ve directamente las ranuras del cargador. Los campos creados antes con esa plantilla se corrigen vaciando su HTML/script desde la pestana Campos (o recreandolos).

= 4.6.0 =
* **Editor visual de fotos (spec 016)**: el modal de ajuste del comprador pasa de un canvas con slider a un editor visual completo. En modo recorte usa **Cropper.js 1.6.2 vendoreado** (sin CDN, hash de integridad documentado en `assets/vendor/cropper/ORIGEN.md`): pan, pinch-zoom 1x-8x, doble tap para alternar encuadre, rotacion de 90 grados por boton y por gesto de dos dedos, guia de tercios, zona fuera atenuada y un badge en vivo con el tamano de salida y el zoom. En movil el modal es full-screen (camara, soltar el archivo sobre el modal, botones grandes, safe-area); en escritorio un dialogo amplio. Sin Cropper cargado (o navegador viejo) degrada al editor anterior sin romper la ficha.
* **Salida exacta**: el recorte se genera con `getCroppedCanvas` al tamano exacto del hueco y con la rotacion aplicada; el modo "encajar completo" conserva el canvas original (contain, sin deformar).
* **Tira visual del cargador**: las miniaturas muestran la foto real (con la mascara de la forma de la ranura) en vez de un numero; tocar una foto la marca para quitar (segunda tocada) o **cambiar** (reabre el editor y reemplaza sin sumar). Al re-editar desde el carrito, las fotos ya cargadas se restauran resolviendo los ids contra el manifest.
* Interno: `assets/vendor/cropper/` (Cropper.js 1.6.2 + LICENSE + ORIGEN.md), encolado `personalizador-pdf-cropper` como dependencia del selector, puerta `tests/selector-contrato.test.js` y spec completa en `specs/016-editor-visual-fotos/`. Sin cambios de servidor, de formato de datos ni en `modules/textmuy/`.

= 4.5.0 =
* **Tipo de campo (spec 015)**: cada campo del catalogo declara ahora un **tipo** (`texto`, `imagen` u `opciones`) que se elige solo al crear y se muestra en la fila y en el editor (solo lectura; en edicion manda el del indice). La columna **Categorias** y la estrella de "plantilla reutilizable" desaparecen: la tabla queda en 6 columnas (id, nombre, tipo, uso, acciones) y el buscador va por texto. El tipo declara la intencion, no enruta: si un campo `opciones` esta colgado en `value` (o al reves), la consola avisa antes de procesar.
* **Overrides del estilo que llegan al PDF**: el campo "Avanzado (settings / overrides)" de cada grupo pasa a ser **solo una lista de referencias** `[campoN]` a campos tipo `opciones`. Cada referencia aporta su JSON de overrides y se fusionan **en orden** (el ultimo pisa) hacia `items[].overrides` del render de TextMuy. Un JSON invalido o un texto literal se descartan **con aviso** sin frenar la compra, y el hash del pool ahora incluye los overrides resueltos: cada comprador recibe su propio estilo en la regeneracion parcial. Verificado con pixeles en el lab: el PDF final lleva exactamente el PNG renderizado en la vista previa.
* **Correccion**: editar un campo con cargador de imagenes fallaba siempre (`motor:campos:cargador:invalido`) porque el JSON del cargador llegaba escapado de WordPress; ahora se sanea con `wp_unslash` (afectaba solo a la edicion, no al alta).
* Sin migracion: se arranca limpio con el formato v3 (`version:3`, `items[].tipo`); un indice v2 legado se lee tolerante y sus campos quedan sin tipo declarado.

= 4.4.0 =
* **Campos reutilizables (pestana "Campos")**: los formularios que se repiten en varios PDFs dejan de ser un "tipo" del hueco y pasan a ser entidades con identidad propia. Cada campo es una carpeta `uploads/pmu/campos/{id}/` (`datos.json` + `campo.htm|css|js`) y `campos.json` es solo el indice; el mismo `id` se usa en cuantos PDFs quieras. La migracion desde el formato anterior es automatica, conserva los ids y deja copia de seguridad.
* **Editor en linea**: "Editar" abre el formulario dentro de la fila (sin cambiar de pagina) y todo se guarda por AJAX. Alta, edicion, baja y restauracion sin recargar; la baja nunca borra los archivos.
* **Probar**: el boton abre un iframe de 350 px que monta el campo con el **mismo** modulo que la ficha, con el CSS del tema, el CSS global y el propio, y muestra a la vez los dos valores (`valor` = lo que se imprime, `cliente` = lo que ve el comprador).
* **Buscar, filtrar y ordenar**: buscador, chips de categoria, orden por id/fecha/nombre y una columna de uso con cuantos PDFs y cuantos `[campoN]` lo usan.
* **Plantillas**: tres bases para empezar (Texto, Opciones, Imagenes), mas marcar cualquier campo existente como plantilla reutilizable y duplicarlo.
* **Estilos globales / Script global**: un unico par de archivos para todo el plugin, editables desde la tarjeta de arriba de la pestana. Se cargan solo en las fichas que tienen al menos un campo; el CSS queda limitado al panel (no puede romper el tema) y el script corre antes de montar los campos. El sistema **no traduce nada** por si solo: la conversion de un codigo a texto se escribe en ese script global.
* **Cargador de imagenes**: un campo con cargador muestra sus ranuras (medida, forma y cuantos exige) y el comprador sube sus fotos con el mismo editor de recorte que ya usaba el admin. "Listo" permanece deshabilitado hasta que se cumple el minimo de cada ranura. Las fotos se guardan en el item del comprador con un id del servidor.
* **Una foto por hueco**: el motor acepta N imagenes por grupo, una por instancia (retrocompatible: un solo archivo se sigue replicando en todas). Un hueco sin completar **ya no frena la compra**: con "repetir" las fotos se reparten entre los huecos y sin el los sobrantes quedan vacios y transparentes, con un simple aviso informativo.
* **Comprueba tu servidor**: el smoke test de la pestana "Test" ahora avisa tambien si el GD puede leer y escribir WebP, que es lo que necesita el cargador.
* **Consola de Campos mas comoda**: la pestana se reordena por frecuencia de uso — la lista de campos arriba, "Nuevo campo" pasa a ser un boton y los estilos globales quedan al pie, plegados. El editor de un campo se abre en un panel lateral en vez de dentro de la tabla (los campos de HTML, CSS y JS ya no van apretados en una celda) y el mismo panel sirve para crear y editar. Trae atajos (`Esc` cierra, `Ctrl+Enter` guarda) y aviso al cerrar con cambios sin guardar.
* **"Probar" en una ventana aparte**: la vista previa se abre en un modal con el ancho real del panel del comprador (el de una ficha de producto, no el del editor), y se puede llamar **directamente desde la lista**, sin entrar a editar.
* **Acciones con iconos**: editar, probar, plantilla, duplicar y baja son botones de icono; el texto queda como descripción emergente para el que pasa el mouse y para lectores de pantalla.
* **Compras sin cuenta**: el comprador no necesita tener sesion iniciada. Puede ver la vista previa, subir sus fotos y completar el pedido igual que si estuviera logueado.
* Exportar/importar el catalogo de campos no se incluye: el backup es una copia de `uploads/pmu/`.
* Interno: `assets/campo-montar.js` (montaje compartido), `assets/cargador-pmu.js` (cargador), endpoints `personalizador_pdf_subida` y `_subida_url`, soporte en `Motor`/`Overlay` de N imagenes por instancia, formato de datos v2 con migracion, y las puertas `tests/campos_migracion.php`, `tests/campos-contrato.test.js`, `tests/conciliacion.js` y las fases `campo_global`, `campo_subida` y `motor_multi` del arnes. Spec 013 en `specs/013-consola-campos-ux/`.

= 4.3.0 =
* **Editor de mockups visual (escritorio)**: la seccion "Mockups" pasa de un formulario de numeros a un editor de capas en dos columnas (lienzo de trabajo a la izquierda, recursos/capas/propiedades a la derecha). El lienzo es ampliable (100-300 %) con nitidez en pantallas de alta densidad y la salida sigue siendo 300x300. Se puede colocar, redimensionar y rotar arrastrando con el raton, con imanes a centros y bordes, guias, tiradores de esquinas y lados, tirador de rotacion y la medida en pixeles siempre a la vista; los campos numericos siguen disponibles y se sincronizan en ambos sentidos.
* **Ver el resultado real antes de guardar**: las capas de hueco muestran en el lienzo el texto renderizado con su estilo al tamano exacto del hueco, reutilizando el preview que genera el boton "Probar" (con cache por hash: no se vuelve a renderizar lo mismo). El editor NO tiene motor de render propio.
* **Una sola funcion de render (criterio de la 004 cumplido)**: `assets/mockup-render.js` compone el mockup para el editor y para la ficha. El hueco ahora se **encaja sin deformar** (antes se estiraba a la caja y deformaba la imagen) y el editor avisa si la proporcion de la capa difiere de la del recurso.
* **Recursos sin escribir nombres**: arrastrar una imagen desde el escritorio al lienzo la sube y la anade como capa; galeria con miniaturas de las fotos del PDF y del catalogo de imagenes; lista de huecos con id, tamano real e instancias. Fin de los dos `window.prompt` y del listado de mockups duplicado.
* **Capas y ajustes**: renombrar, duplicar, ocultar, bloquear, reordenar y alinear (6 posiciones); ajustes como sliders con vista en vivo (brillo, contraste, saturacion, **gama** —que antes se guardaba y no se aplicaba—, opacidad, desenfoque, tono y modo de fusion "multiplicar").
* **No se pierde el trabajo**: autoguardado con retardo, deshacer/rehacer, estado visible ("Sin guardar"/"Guardando"/"Guardado"), aviso al salir con cambios pendientes y atajos de teclado para todo el editor.
* **Robustez**: una capa sin recurso (foto borrada o grupo que ya no existe) queda marcada y avisada en vez de desaparecer en silencio; la geometria fuera de rango se normaliza al abrir.
* **Contrato de capa ampliado (retrocompatible)**: `capas[].ref` con namespace `pdf:{archivo}` / `img:{id}` (el ref plano previo se lee como `pdf:`), y campos opcionales `modo`/`nombre`/`oculta`/`bloqueada`. Sin migracion.
* Interno: `assets/mockup-render.js` + `assets/mockup-geometria.js` (geometria pura con test Node `tests/mockup-geometria.test.js`), reescritura de `assets/mockups.js`, store de previews en `assets/admin.js`, `PMU_Uploads::config_mockups` ampliado, handler de guardado con el saneo unico del motor, ficha migrada al nucleo compartido, estilos `.ec-mk-*` en `assets/admin.css`, fases `mockup_capas` y `mockup_preview` del arnes y check de despliegue en el smoke test.

= 4.2.2 =
* **Pestana "Test" con smoke test en vivo**: quinta pestana de la consola con un boton que verifica el sitio REAL (WordPress y WooCommerce activos) sin `exec()` ni procesos externos: entorno PHP (version, zlib, GD), permisos de escritura de `uploads/pmu/{pdfs,img,tm-presets,tmp,orders}`, catalogos legibles, motor (deteccion + `validarDataset` sobre cada PDF subido), hooks `admin_post` registrados, TextMuy integrado, Woo (`wc_get_products` + asociaciones PDF-producto validas) y render de la consola sin fatal. Devuelve tabla OK/FALLA con el detalle de cada check.
* **Aviso de version nueva**: la pestana guarda `personalizador_pdf_smoke_ultimo` (version + fecha + fallas) y muestra un aviso destacado cuando la version instalada cambio desde la ultima corrida; asi, despues de cada deploy se ve si el smoke quedo pendiente.
* **Seguridad de los arneses CLI**: `tests/{motor_smoke,parity,texto_puente}.php` salen de inmediato si no corren por CLI (`PHP_SAPI !== 'cli'`), porque la carpeta `tests/` viaja con el plugin al hosting y era alcanzable por HTTP.
* Interno: `handle_smoke_test` + `smoke_checks()` (endpoint `personalizador_pdf_smoke`, nonce + `manage_options`), fase de test `smoke` y actualizacion de AGENTS/ayuda.

= 4.2.1 =
* **Consola sin recargas (pmu-core)**: nuevo nucleo `pmuPost()` en `assets/admin.js` (POST unico a admin-post). Todo el admin lo usa: guardar configuracion, campos (alta/edicion/baja), subir/quitar imagen, re-analizar, borrar, regenerar pedido, procesar y subir PDF. Los errores se pintan inline (aviso rojo) en vez de pagina en blanco, y las acciones que cambian el contenido (Subir/Re-analizar/Borrar) recargan solo en exito.
* **Unica via JSON**: `responder()` ya no redirige; los handlers contestan JSON y la consola pinta los resultados. Si JavaScript esta desactivado, la consola muestra un `<noscript>` explicandolo (antes existia un segundo camino con notices en la URL que no operaba de verdad). Las claves `ec_*` del JSON se reemplazaron por datos reales (`grupos`, `instancias`, `descarga`, `fotos`, `ec_perdidos`).
* **Seguridad sin paginas blancas**: `seguridad()` siempre responde JSON accionable (nonce vencido o capacidad faltante).
* **Galeria sin doble transferencia**: elegir una imagen de la Biblioteca de Medios manda el `attachment_id` y el servidor la copia desde disco (`handle_subir_imagen`); desaparecen la descarga del blob, la re-subida y el alias de accion `personalizador_pdf_imagen_galeria`.
* **Subir desde PC recuperado**: boton visible por grupo que dispara el input del pool oculto (ademas del arrastrar-y-soltar y la galeria); fuera el boton submit oculto que podia provocar un envio sin JS.
* **Procesar sin salir de la consola**: `handle_procesar` responde JSON con resumen (grupos/instancias) y URL de descarga firmada; el resultado se baja por iframe oculto. El envio unico con los PNG de RenderCore conserva su timeout de 90 s.
* **Fotos de mockups utilizables**: el acordeon "Mockups" ahora tiene subida y borrado de fotos (`handle_mockup_subir/borrar`, JSON con la lista `fotos` refrescada) y el editor las lee al momento del clic, de modo que la capa "Foto" por fin puede elegirse.
* **Conflicto de nombre**: si el PDF ya existe, el JS abre su modal (`nombre_existente:`) y decide renombrar o sobrescribir (un solo camino, sin avisos HTML paralelos).
* **Endpoint `personalizador_pdf_guardar_texto` eliminado**: su logica (texto/estilo vigente -> `config.json`) vive en `handle_procesar`, que es la via que usa la consola; las fases de test ahora ejercitan ese camino real.
* **Limpieza**: fuera los hooks/nonce legacy `extractor_corel_*`, la rama muerta del endpoint de galeria, el `ec_tab`, `redirigir()`/`conflicto_nombre()`, las claves `ec_*` que nadie leia, el alias duplicado de config en el JS y los campos sin consumidor; los estados de subir/procesar/campo ahora tienen color en el CSS.
* **Tests**: guard `PHP_SAPI !== 'cli'` en los 3 arneses (hoy el plugin viaja con `tests/` al hosting); fases nuevas `imagen_adjunto [mal]`, `subir_conflicto [ajax]` y `mockup_foto_ajax`; la fase `contenido` se fusiono en `guardar_ajax` y las verificaciones de redirect pasaron a JSON. AGENTS.md actualizado (hooks legacy retirados, fases del arnes y flujo de consola).

= 4.2.0 =
* **Ciclo completo del comprador (spec 004)**: panel del comprador en la ficha Woo (`woocommerce_before_add_to_cart_form` + shortcode `[pmu_personalizar]`) con los campos del catalogo; "Vista previa" genera mockups 300x300 en paralelo (RenderCore) y sube los PNG al pool de la sesion (`tmp/sesion-{sid}/{item_key}/img/`, cookie `pmu_sid`); el carrito exige vistas listas (salvo `preview_omisible`), congela las vistas aprobadas (`mockup-{id}.webp`) y promueve el item con cantidad fija 1 y `unique_key`; re-edicion desde el carrito reusa el item y regenera solo lo cambiado (hash `sha1(valor|preset|settings|WxH)`).
* **Pedido y descarga**: staging al crearse el pedido (`tmp/orders/{id}/`), promocion a `orders/{id}/{item_key}/` al pagarse, descargas en `mi-cuenta` (PDF final generado al vuelo desde el indice del pool con `Motor::procesar_pedido`, idempotente) y pestana "Pedidos" en la consola con "Regenerar PDF".
* **Conciliacion ex-008**: rutas de sesion alineadas a la norma (`tmp/sesion-{sid}/{item_key}/`, sin el nivel intermedio `tmp/sesion/`) y unico armador de datos de render (`datos_pdf_render`).

= 4.1.1 =
* **Corregido: puente faltante en el render-core**: la consola "PDFs" (Probar y Procesar) nunca enviaba el puente textmuy-bridge al iframe render-core.html, asi que todo render con preset TextMuy fallaba con presets:sin_puente. Ahora assets/admin.js envia el puente (urls + nonces + inventarios, construidos por el nuevo metodo unico puente_textmuy()) en los 3 momentos del contrato (AGENTS 2.1).
* **Corregido: guardado de presets (motor:alta:contenido:invalido)**: WordPress aplica magic quotes a $_POST y el JSON del .txm llegaba escapado a PMU_Uploads::alta(); ahora se aplica wp_unslash() antes de json_decode. Esto tambien habilita el remedio de los presets legacy (por ejemplo simple-gradient, con font.src string): re-guardarlos desde el editor.
* Cache-bust de assets/admin.js (4.1.0 -> 4.1.1).

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
* Version inicial: motor PHP completo (deteccion, marcos, overlay) y el plugin para WordPress "Personalizador PDF".