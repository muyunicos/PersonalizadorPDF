# Tasks: Personalización de Productos PDF para WooCommerce

**Input**: Design documents from `specs/004-woocommerce-pdf-personalization/` (norma 2026-09-17)

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/ (campos, mockups, sesion-item, selector-pmu), research.md

**Tests**: fases nuevas del arnes `tests/texto_puente.php` (`sesion`, `conciliacion`, `campos`) + puertas existentes (`php -l`, `motor_smoke`, `parity`, `node --check` + 10 suites si se toca el modulo) + recorrido manual de `quickstart.md`.

**Organization**: Tasks grouped by user story (US1..US5), independent test per story.

## Format: `[ID] [P?] [Story] Description` — con ruta de archivo exacta.

## Path Conventions

- Plugin en la raiz del repo: `personalizador-pdf.php`, `admin/`, `engine/`, `inc/`, `assets/`, `tests/`.
- Datos de usuario: `uploads/pmu/` (raiz unica; nunca dentro del plugin).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Linea base verde y de datos antes de tocar nada.

- [X] T001 Verificar la linea base: `php -l personalizador-pdf.php`, `php -l admin/*.php`, `php -l engine/*.php`, `php -l inc/*.php`, `php tests/motor_smoke.php` (SMOKE OK), `php tests/parity.php` (PARIDAD OK).
- [X] T001b Verificar que FR-1 preimplementado (subir/detectar/activar/desactivar/borrar PDF, consola vigente) se condice con la norma (`spec.md` FR-1.1..FR-1.4). Cubierto por fases del arnes `tests/texto_puente.php`: `desactivar` (config ajena intacta), `reanalizar` (analisis+config y layout exacto `PDF + analisis.json + config.json`), `borrado` (borrado quirurgico con testigos en `orders/`, `tmp/orders/`, `tmp/sesion-*/`, `pdfs/otro/`, `tmp/muestras/otro/` intactos). Verificacion con stubs: no sustituye la prueba manual en panel WP real (T030).
- [X] T002 Inventariar `uploads/pmu/` (arbol + archivos) para comparar antes/despues y detectar escrituras accidentales (sin modificar datos). Script nuevo `tests/inventario_pmu.php` (manifiesto ruta+sha256+tamano por archivo; `--resumen|--guardar|--comparar`) + baseline versionado `tests/baseline_pmu_manifest.txt`. Linea base: 159 archivos (~25.6 MB) — fonts 16, img 131, pdfs 8, tm-presets 2, tmp 2. Hallazgos: `pdfs/circulo6cm/` es DATO LEGADO (`metadata.json` con letra/color, `textos.json`, PNGs sueltos, salida vieja) y `pdfs.json` (0 bytes, ilegible: lectura tolerante lo maneja); `tmp/circulo6cm/` legado; no existe `campos.json` ni carpetas `mockups/`; `orders/` vacio. El dato legado NO se toca (Const. V: el admin lo regenera al re-subir/re-analizar).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sesion del comprador (sid/item/pool/manifest), catalogo de campos y accesos de rutas. Bloquea US1–US5.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Checkpoint**: Fundacion lista; las historias pueden arrancar.

- [X] T003 Crear `inc/class-pmu-sesion.php` segun `contracts/sesion-item.md`: `sid_actual()` (cookie `pmu_sid` UUID v4, 30 dias, httponly, sameSite=Lax, sobrevive al login), `dir_item()`, `crear_draft()` (`draft-{uuid}` + `manifest.json` inicial con `preview_estado=sin_vista`), `promover()` (rename a `{cart_item_key}` con el MISMO sid y `item_key` actualizado), `leer_manifest()`/`guardar_manifest()` (`.tmp` + `rename`), `guardar_png()` (`img/{pdf}-{id}-{n}.png` numerado, anota `archivos[]` con `indice`/`file`/`hash` del llamador), `congelar_webp()` (`mockup-{id}.webp` + `mockup_vistas`/`mockup_visto`), `estado_preview()`, `borrar_item()` (quirurgico e idempotente), `staging_order()` (copia idempotente a `tmp/orders/{order_id}/{item_key}/`), `promover_order()` (rename a `orders/...`, flag `.promocionando` y causa `motor:sesion:promocion:pendiente`), `limpiar_ttl()` (drafts por `manifest.creado`). Rutas SIEMPRE de `PMU_Uploads` (Const. II); causas `motor:sesion:<causa>`. Test: fase nueva `sesion` en `tests/texto_puente.php` (13 asserts). Bug propio detectado por el test y corregido: `siguiente_n()` numeraba sobre el nombre sin extension y sobrescribia el PNG anterior.
- [X] T004 Agregar a `inc/class-pmu-uploads.php` los accesos que faltan. Ya existian (herencia del ciclo carrito): `dir_sesion/dir_sesion_item/dir_sesion_item_img/manifest_sesion_item` + saneo `sesion_segura()`/`item_segura()`. Agregados nuevos: `dir_mockups($pdf,$crear)` (`pdfs/{nombre}/mockups/`, ambito de datos sin catalogo), `ruta_mockup($pdf,$archivo)` (basename, sin subrutas) y wrappers `dir_campos()`/`ruta_campos()` (`uploads/pmu/campos.json`); `campos_catalogo()`/`guardar_campos()` ahora pasan por `ruta_campos()` (verdad unica de la ruta).
- [X] T005 Siembra + CRUD de campos (extendido a norma 2026-09-17): `campos.json` `{items[]}` sin thumbs (los campos se reconocen por `id` numeral), CRUD existente (`campo_alta` hueco mas bajo/max+1, `campo_editar`, `campo_baja` tombstone, escritura atomica, lectura tolerante `motor:listar:catalogo:invalido:campos`) + **tupla de 10 slots** con flag `array` (indice 9) + **sandbox de `script`** `validar_script_campo()` (prohibidos `document.getElementById/querySelector`, `DOMContentLoaded`, `id=`; aplica en `campo_desde_post` y en `campo_alta/campo_editar` del motor con causa `motor:campos:script:invalido`). UI `admin/campos.php` con checkbox Array. Tests: fase `campos` ampliada (10 slots, array flag, rechazo de script prohibido) y `tienda` ajustada a 10 slots. Repaso 2026-09-18: rutas de sesion alineadas a la norma (constitution IV / contract sesion-item): `dir_sesion()` y `manifest_sesion_item()` ya NO agregan el nivel intermedio `tmp/sesion/` (creaban `tmp/sesion/sesion-{sid}/...`); ahora es `tmp/sesion-{sid}/{item_key}/...` como norman los docs. `sesion` sale de `$SUBAMBITOS_TMP` (queda {muestras, cart, orders}) y `PMU_Sesion::limpiar_ttl()` barre `tmp/sesion-*` directamente. Globs del arnes actualizados; la fase `vista_previa_mal` ("sin drafts creados") pasa a ser un check real (antes miraba una ruta inexistente).
- [X] T005b Adaptar el componente cliente `selector-pmu`: `assets/selector-pmu.js` reescrito (era un stub con `console.log`) — constructor `(elemento, config)` con `finalW`/`finalH` obligatorios (los define el campo/PDF; `maxW`/`maxH` eliminados), `mode` `crop|fit`, `aspectRatio`, `category`; `open()` con dialogo real (file input con allowlist `.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg`, canvas del tamano final, zoom, arrastre para encuadrar, Escape), `onSelect(url, meta)`, `onError(msg, err)`, `on(evento, cb)` (`progress`/`success`/`error`), `obtenerBlob()`, `close()`, `destroy()`; sin dependencias ni limite de peso; estilos inyectados por el propio componente; el llamador sube el blob al pool del item. Contrato actualizado (fuera `SIZE_EXCEEDED`). `node --check` OK.
- [X] T006 Nueva pestaña "Campos" en `admin/page.php` + `admin/campos.php` (depende de T005): ya existia el catalogo global (tab en `page.php`, listado/alta/edicion/baja + modal de alta rapida en `assets/admin.js`); completado en esta pasada el checkbox **Array** (flag `array`, indice 9 de la tupla) y la validacion de sandbox del `script` al guardar. Sin `[P]`: depende de T005.

---

## Phase 3: User Story 1 - Admin configura producto (P1) 🎯 MVP

**Goal**: El admin compone mockups, mapea grupos a campos y asocia el PDF a un producto Woo.

**Independent Test**: Subir un PDF con 2 grupos, crear 2 mockups (fondo + placeholders), mapear `value="[campo1]"`, asociar a un producto; verificar `config.json` y que `analisis.json` no cambia.

### Implementation for User Story 1

- [X] T007 [US1] Seccion "Mockups" en `admin/pdfs.php`: listado de mockups vigentes (`config.json:mockups[]`), checkbox `preview_omisible` (disabled sin mockups; persiste via `guardar_config` con regla del motor: sin mockups queda `false`), **subida/borrado de fotos** con handlers `personalizador_pdf_mockup_subir/borrar` (destino `pdfs/{nombre}/mockups/` via `dir_mockups/ruta_mockup`; allowlist png/jpg/jpeg/gif/webp; nombre saneado con sufijo `-2`, `-3` ante colision; borrado quirurgico dentro de la carpeta; `file_get_contents` del tmp para ser CLI-testeable). Tests: fases `mockup_foto`/`mockup_foto_baja`. PENDIENTE (T008): crear/duplicar/eliminar mockups y editor de capas embebido en el modulo TextMuy.
- [X] T008 [US1] Editor de mockups (assets/mockups.js + endpoint propio; sin tocar el modulo ni bump RCn): panel dentro del acordeon "Mockups" con lienzo 300x300 (Canvas 2D), selector de mockups (nuevo/duplicar/eliminar) + titulo de la vista; capas `img` (fotos del admin) y `placeholder` (`{grupo}` o `{grupo}#{indice}`) con orden z (subir/bajar/borrar); propiedades por capa (x, y, w, h, rot, sesgo) + filtros por capa (brillo/contraste/saturacion, solo mockup); encuadre inicial automatico del hueco (40%, centrado); render en vivo (imagenes reales; placeholder como caja neutra de encuadre) y guardado via `action=personalizador_pdf_mockups` (`handle_mockups_guardar`: solo `mockups` + `preview_omisible`, nunca pisa activo/productos/campos/mapeos). Datos servidos por `PMU_Uploads`/plugin (`mockups_para_editor()`: pdf, grupos, fotos con URL, mockups vigentes). Test: fase `mockups_guardar`. NO se creo modo `?modo=mockup` en el modulo TextMuy: el admin define geometria (Canvas) y el render con texto del cliente reusa RenderCore en la ficha (T014), evitando duplicar el motor de render. Pendiente: encuadre con drag del mouse (hoy inputs numericos) y el render del texto real dentro del lienzo admin.
- [X] T009 [US1] Mapeo de grupos a campos en `admin/pdfs.php`: por grupo elegir `tipo` (texto/imagen), `preset` (selector de `presets.json`), `value` y `settings` (plantillas `[campoN]` con autocompletado de `campos.json`) y checkbox `[v] Repetir por placeholder` (por campo/código: si el resultado es array, un valor por instancia; si no, el mismo valor en todas); guardar en `config.json:placeholders[id]` (con `repetir`) sin pisar `analisis.json`. Persistido en `handle_config_guardar` y normalizado en `PMU_Uploads::config_placeholders` (validado por fase `mockups`).
- [X] T010 [US1] Asociacion PDF ↔ producto Woo (backend + ficha): metodos
  `producto_pdf_slugs/producto_pdf_slug/producto_pdf_vincular/producto_pdf_desvincular`
  en `personalizador-pdf.php` — canonico `postmeta _pmu_pdf_slugs` (lista), con
  respaldo tolerante `_pmu_pdf_slug`, deduplicacion y espejo `config.json:productos[]`;
  la ficha usa la lista y la consola muestra su espejo. Test: fases `validez`,
  `ficha_pdfs` y `ficha_pdfs_previa`.
- [X] T011 [US1] Test de la historia: fase `mockups` en `tests/texto_puente.php` (guardar mockups + mapeo con `repetir` no pisa `analisis.json`; `preview_omisible` solo persiste con mockups — sin mockups queda `false` forzado; capas invalidas/refs con ruta descartadas; clamp filtros/rot/sesgo; asignacion postmeta/espejo pendiente de T010).


---

## Phase 4: User Story 2 - Cliente personaliza con mockup (P1)

**Goal**: Ficha con campos, "Vista previa" (galeria paralela), add-to-cart como visto bueno y sesion completa.

**Independent Test**: En la ficha de prueba, completar campos, pulsar "Vista previa", ver las vistas generadas en paralelo, agregar al carrito y verificar `tmp/sesion-{sid}/{cart_item_key}/` con pool + webp + `preview_estado=ok`.

### Implementation for User Story 2

- [X] T012 [US2] Panel del comprador en ficha: `panel_ficha($pdf)` (oculta el panel si el PDF esta inactivo/sin analisis/sin grupos; devuelve `{pdf, campos elegidos, placeholders, mockups, preview_omisible}`), `shortcode_panel()` (`[pmu_personalizar pdf="slug"]`, mismo panel para manuales/tests), `assets_ficha()` (`tienda.js` + `selector-pmu.js` + puente RenderCore + `PMU_TIENDA` con `nonceVistaPrevia`) y `assets/tienda.js` (monta los campos del catalogo con HTML/CSS con scope y `script(ctx, root)` en sandbox del campo; recolecta valor dual `{valor, cliente}` en `window.PMU_API`). La ficha Woo real se activa por `woocommerce_before_add_to_cart_form` con la lista `_pmu_pdf_slugs` y mantiene el shortcode como API de datos/manuales. Test: fases `ficha` y `ficha_pdfs`.
- [X] T013 [US2] Handler `handle_vista_previa` (`wp_ajax(_nopriv)_personalizador_pdf_vista_previa`, anonimo permitido): capacidad `read` + nonce propio, PDF validado contra `panel_ficha` (activo + grupos), valores duales saneados con `valores_sanitizados()` (solo ids del panel, `cliente` como texto plano, `valor` crudo acotado) y draft creado con `PMU_Sesion::crear_draft()` (manifest `valores`). Devuelve `{sid, item_key, pdfs, mockups[]}`. Test: fases `vista_previa` (draft + valores duales + descarte de campo desconocido) y `vista_previa_mal` (nonce invalido, sin drafts).
- [X] T014 [US2] Render de vistas: `datos_pdf_render()` (grupos con plantilla `[campoN]`/preset/settings/repetir/cont + fotos + mockups del PDF; sirve a `handle_vista_previa`), endpoint `handle_pool_png` (`wp_ajax(_nopriv)_personalizador_pdf_pool`, nonce de vista previa; acepta multipart `png` o `png_data` dataURL, valida firma PNG + tamano 8 MB + grupo del analisis + item del manifest, calcula el hash `sha1(valor|preset|settings|WxH)` server-side y con `limpiar=1` reemplaza el grupo via `PMU_Sesion::limpiar_grupo()` — regeneracion idempotente sin duplicados) y `assets/tienda.js` (boton "Vista previa" + leyenda; galeria 300x300 con flechas e indice, placeholder "Generando vista previa" por vista; render PARALELO via `TextMuyAPI.renderBatch` del RenderCore con el puente; composicion de mockups con capas `img`/`placeholder` — misma geometria que el editor, filtros solo en el mockup; placeholder sin render = caja neutra, nunca vista rota). Test: fases `pool` y `pool_reem` (fila, hash, reemplazo). PENDIENTE: congelado `mockup-{id}.webp` al agregar (T015 cliente) y estados de fallo (T021).
- [X] T014b [US2] Resolucion de arrays en `assets/tienda.js` (modulo puro testeable: `resolverPlantilla`/`camposDe`/`conciliarGrupo`/`hashRender`, export CommonJS sin DOM): si el campo resulta array (o `repetir` activo), un PNG por instancia (`img/{pdf}-{id}-{n}.png` con fila en `manifest.archivos[]`); si `N != M` (valores vs `cont` del grupo), aviso visible y **bloqueo de la generacion de ESE PDF** antes de renderizar (el resto de PDFs del producto sigue); los mockups componen con los mismos PNG numerados (`{grupo}#{indice}`). Test Node: `tests/conciliacion.js` (8 casos; `node tests/conciliacion.js` debe decir "CONCILIACION OK").
- [X] T015 [US2] Habilitacion del carrito (server + cliente): `carrito_validar` (`woocommerce_add_to_cart_validation`: draft vigente del mismo PDF con `preview_estado` ok/omisible, aviso Woo si falta), `carrito_agregar` (`woocommerce_add_cart_item_data`: meta `pmu_sid`/`pmu_item_key`/`unique_key` UUID v4, evita fusion de lineas), `carrito_promover` (`woocommerce_add_to_cart`: `PMU_Sesion::promover()` al `cart_item_key` real + **congelado de vistas**: decodifica `pmu_mockups={id: webp dataURL}` (`dataurl_bytes` + firma RIFF/WEBP) y llama `congelar_webp()`; con vistas validas marca `preview_estado=ok`, sin ellas queda `sin_vista`; fail-safe total), `carrito_mostrar` (`woocommerce_get_item_data`: etiquetas `cliente` con titulo del campo), `carrito_quitar` (`woocommerce_remove_cart_item`: `borrar_item()`) y `cantidad_fija` (min/max = 1 en productos vinculados). Cliente: el boton `.single_add_to_cart_button` queda deshabilitado hasta que las vistas terminan (o si el PDF es omisible), y el submit del `form.cart` se intercepta con inputs ocultos `pmu_sid`/`pmu_item_key`/`pmu_mockups` (submit NATIVO, nunca `form.action`: norma §11). Test: fase `carrito` (8 asserts, incluye webp congelado + estado ok).
- [X] T016 [US2] Re-edicion: link "Editar" en el carrito (`carrito_enlace_edicion` sobre `woocommerce_cart_item_name`, `?pmu_item_key=` en la ficha) vuelve con `item_key` cargado (`panel_ficha_html` precarga valores en `PMU_FICHA.valores`/`PMU_FICHA.sesion`); `handle_vista_previa` con `item_key` vigente REUSA el item (mismo item_key/pool, estado vuelve a `sin_vista`) y la respuesta ahora trae `archivos[]` + `pool_url` (`PMU_Uploads::url_sesion_item`) para el render PARCIAL del cliente: `tienda.js` calcula `hashRender` por instancia y salta render/subida de lo que ya esta en el pool (reuso por URL en la composicion de mockups); borrar item del carrito ya dispara `borrar_item()` (T015). FICHA REAL: hook `woocommerce_before_add_to_cart_form` (`ficha_panel_render`) + shortcode `[pmu_personalizar]` -> `shortcode_panel_render`; HTML del panel en `panel_ficha_html()` (`[data-pmu-panel]`, una sola vez por request) + `PMU_FICHA` (`campos_panel()` serializa la tupla de 10 slots); enqueue condicionado (`assets_ficha_condicional` con `is_product`; antes cargaba en TODO el front). Test: fase `ficha` ampliada (HTML + PMU_FICHA) y fase nueva `ficha_edicion` (reuso + flag edicion).
- [X] T017 [US2] Test de la historia: fases `sesion` y `conciliacion` en `tests/texto_puente.php` (draft -> promover con mismo sid; pool dedicado numerado con `-{n}`; manifest con indice `archivos[]`; webp congelados; TTL de drafts; analisis/config intactos; array con `repetir` y bloqueo N≠M), más `node tests/conciliacion.js` (`CONCILIACION OK`).

**Checkpoint**: US2 independently functional — ficha completa sin mockup roto y carrito con sesion coherente. **Dependencia 005**: el multivinculo `_pmu_pdf_slugs` (spec 005 T001) extiende el singular `_pmu_pdf_slug` usado en T012/T016; la validez por asociacion (`tienda{pid}`) vive en spec 005.

---

## Phase 5: User Story 3 - Cliente omisible sin mockup (P2)

**Goal**: PDFs con `preview_omisible=true` permiten comprar sin vista previa.

**Independent Test**: Con el flag activo, agregar sin pulsar "Vista previa" y verificar `preview_estado=omisible` en meta/manifest y generacion posterior del PDF.

### Implementation for User Story 3

- [X] T018 [US3] Logica en `assets/tienda.js` + handler de ficha: con `preview_omisible=true` NO se monta el boton "Vista previa" ni se bloquea el carrito (`iniciar()` vuelve temprano); al agregar, `tienda.js` inyecta `pmu_valores` y el SERVIDOR crea el item (`carrito_validar` rama omisible: `crear_draft()` + valores saneados + `preview_estado=omisible`, y deja la meta lista para `carrito_agregar`). Ficha: `panel_ficha`/`datos_pdf_render` exponen el flag. Test: fase `ficha_omisible`.
- [X] T019 [US3] Manejo mixto (producto con PDF omisible + PDF obligatorio): el bloqueo depende del flag del PDF vinculado (`panel_ficha` por producto); el omisible no bloquea el boton ni exige draft (se crea al agregar) y el obligatorio sigue exigiendo vistas (`preview_estado` ok). Test: fase `ficha_omisible` (acepta sin draft) + fase `carrito` (obligatorio con draft ok).
- [X] T020 [US3] Test de la historia: fase `ficha_omisible` en `tests/texto_puente.php` (panel con flag, validacion acepta sin draft previo, meta con sid/item/unique_key, manifest `preview_estado=omisible` + valores duales del cliente). Stub nuevo del arnes: `wc_get_product`/`get_post_meta` (antes el guard de Woo cortaba en vacio).

**Checkpoint**: US3 independently functional.

---

## Phase 6: User Story 4 - Fallo tolerado + pedido y descarga (P2)

**Goal**: Los fallos de render no pierden la venta; el pedido se promueve al pago y se descarga por lista Woo.

**Independent Test**: Provocar fallo de render (preset invalido), agregar con `sin_vista`, pagar y descargar con reintento silencioso.

### Implementation for User Story 4

- [X] T021 [US4] Tolerancia en `assets/tienda.js`: vista fallida -> `vista.fallida` + ocultada (fotografia final, sin marcos de editor) y `podar()` la quita de la galeria (flechas recalculadas); si NO queda ninguna, la galeria se oculta y aparece el aviso "No hay vista previa disponible: podes comprar igual..." con el carrito HABILITADO (regla V-7: la venta nunca se bloquea); `preview_estado=sin_vista` ya queda persistido por `crear_draft()`/`carrito_promover` (solo pasa a `ok` si se congelo algun webp). El pool se recorta al snapshot de PDFs aceptados. Fallo del flujo completo (draft/pool) -> aviso accionable + carrito habilitado. Test: fases T014/T021 y `conciliacion`.
- [X] T022 [US4] Hooks Woo en `personalizador-pdf.php`: `pedido_item_crear` (`woocommerce_checkout_create_order_line_item`): copia la meta del item (`_pmu_sid`/`_pmu_item_key`/`_pmu_preview_estado`/`_pmu_valores`/`_pmu_pdfs`), registra el item en la meta del pedido (`_pmu_items`) y hace `PMU_Sesion::staging_order()` -> `tmp/orders/{order_id}/{item_key}/`; `pedido_promover` (`woocommerce_order_status_processing` + `_completed`): `promover_order()` (rename a `orders/{order_id}/{item_key}/`), marca `entregado` y reintenta los pendientes en cada cambio de estado (idempotente). Fail-safe: nunca tumba el checkout. PENDIENTE: flag `.promocionando` con reintento explicito en consola (hoy el reintento es por cambio de estado + regeneracion).
- [X] T023 [US4] Descarga del PDF final: `item_generar_pdfs($order_id,$item_key)`
  procesa todos los PDFs del snapshot desde las filas indexadas de `manifest.archivos[]`
  con `Motor::procesar_pedido()`; `item_generar_pdf(..., $pdf)` sirve uno concreto.
  Es idempotente, funciona desde staging y `descargas_cliente` expone una fila por
  PDF aceptado; `handle_item_descargar` autoriza dueno, `order_key` o admin y
  rechaza `item_key` ajenos al pedido. PENDIENTE: re-render cliente desde Descargas
  si falta el pool (hoy el reintento server-side usa el pool existente, con causa visible).
- [X] T024 [US4] Test de la historia: fases `carrito` (draft ok -> webp congelado -> estado ok) + `completados` (item en `orders/`, listado, `item_generar_pdf` con firma `%PDF`, generacion idempotente por mtime, regeneracion admin por redirect) + `ficha_omisible` (sin vistas -> item omisible, carrito libre). Analisis intacto tras todo el ciclo: verificado por inventario de datos (159 archivos identicos) y por las fases `contenido`/`desactivar`/`reanalizar`.

**Checkpoint**: US4 independently functional — venta concretada aun con fallo de render.

---

## Phase 7: User Story 5 - Admin revisa "completados" (P2)

**Goal**: Registro admin de pedidos completados con filtro por estado y regeneracion.

**Independent Test**: Crear un pedido con `sin_vista`, abrir "completados" (aparece primero con el filtro), ver webp + valores y regenerar el PDF.

### Implementation for User Story 5

- [X] T025 [US5] Seccion "4. Pedidos completados" en `admin/pdfs.php`: `pedidos_completados()` recorre `orders/{order_id}/{item_key}/` y lista estado (`sin_vista` primero), pool (`archivos[]`), vistas congeladas (`mockup-*.webp`), etiquetas del cliente (titulo del campo + `cliente`, solo lectura), salida (`*_procesado.pdf`) y causa si el manifest es ilegible; acciones "Regenerar PDF" y "Descargar" (el admin queda autorizado tambien en `handle_item_descargar`).
- [X] T026 [US5] Accion "Regenerar" por item (admin): `handle_item_regenerar`
  (`admin_post_personalizador_pdf_item_regenerar`, `seguridad()` + nonce): borra
  las salidas previas y rearma todos los PDFs del snapshot con
  `item_generar_pdfs()` (idempotente, sin duplicar archivos); errores con causa via
  redirect. PENDIENTE (mejora): re-render del pool en el navegador del admin
  (RenderCore) cuando falten PNG; hoy regenera solo con el pool existente.
- [X] T027 [US5] Test de la historia: fase `completados` (listado con 1 item + estado/etiquetas, PDF final `%PDF`, idempotencia por mtime, redirect `ec_regenerado=1`, salida rearmada y unica tras regenerar).

**Checkpoint**: US5 independently functional — el admin puede recuperar cualquier caso.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentacion, arnes completo y verificacion final.

- [X] T028 [P] Actualizar `AGENTS.md` (§3 paso 4 "Ciclo del comprador": panel en ficha, vista previa/pool/galeria, add-to-cart/congelado, pedido/descarga y consola de completados; §5 ya documentaba `campos.json`, `pdfs/{nombre}/mockups/`, `tmp/sesion-{sid}/`, `preview_estado`) y `admin/ayuda.php` (nueva seccion "Tienda: vista previa y descargas del comprador").
- [X] T029 [P] Actualizar `readme.txt`: changelog `= 4.2.0 =` con el ciclo del comprador (ficha, vista previa, pool, carrito, pedido, descargas, completados) + bump de version a 4.2.0 (plugin header, constante y `Stable tag`; sirve de cache-bust de `tienda.js`).
- [ ] T030 Correr `quickstart.md` completo (secciones 1-8) en panel WP real y limpiar los datos de prueba generados: solo `tmp/sesion-*`, `tmp/muestras/*` y `tmp/orders/*` creados en el recorrido; **nunca** `orders/` (entregables), ni `pdfs/`, ni catalogos del editor.
- [X] T031 Verificacion completa: `php -l` (todo), `motor_smoke` (SMOKE OK), `parity` (PARIDAD OK), `texto_puente` en todas las fases (incluida `conciliacion`), `node --check` + las 14 suites Node del módulo; se mantiene `?v=RC36`. Pendiente solo el recorrido manual T030 en WP real.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: sin dependencias.
- **Foundational (2)**: bloquea todas las historias (sesion + campos + rutas).
- **US1 (3)**: depende de Foundational (usa `guardar_config` y ambito mockups).
- **US2 (4)**: depende de Foundational y de US1 (necesita mockups/mapeos existentes).
- **US3 (5)**: depende de US2 (mismo circuito de ficha, flag distinto).
- **US4 (6)**: depende de US2/US3 (tolerancia + ciclo pedido/descarga).
- **US5 (7)**: depende de US4 (lee pedidos promovidos).
- **Polish (8)**: al cierre.

### Parallel Opportunities

- T003/T004/T005/T006: archivos distintos ([P] donde corresponda).
- T007/T009/T010 (US1) pueden avanzar en paralelo una vez existe T008 para probar.
- US3 y la tolerancia de US4 comparten `assets/tienda.js` con US2: coordinar commits.

## Implementation Strategy

### MVP First (US1 + US2)

1. Setup + Foundational -> fundacion verde.
2. US1 (mockups + mapeo + asociacion) -> validar en consola.
3. US2 (ficha + vista previa + carrito) -> validar en tienda de prueba.
4. STOP y VALIDAR el checkpoint de cada historia.

### Incremental Delivery

1. US3 (omisible) -> 2. US4 (tolerancia + pedido/descarga) -> 3. US5 (completados) -> 4. Polish.
Cada historia agrega valor sin romper la anterior; detenerse en cada checkpoint.

## Notes

- `engine/` (Motor PDF) sin cambios de algoritmo: solo consume `manifest.archivos[]`.
- No crear arneses nuevos: extender `tests/texto_puente.php` (fases `sesion`, `conciliacion`, `campos`).
- Tocar `modules/textmuy/` exige `node --check` + 10 suites + bump `?v=RCn` en ambos HTML.
- La consola nunca muestra la pagina de error critico (aviso con causa, HTTP 200).
- Evitar tareas vagas y mismos archivos en paralelo (los [P] respetan archivos distintos).
**Checkpoint**: US1 independently functional — consola crea mockups/mapeos sin tocar el analisis.