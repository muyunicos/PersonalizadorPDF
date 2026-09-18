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
- [X] T005 Siembra + CRUD de campos (extendido a norma 2026-09-17): `campos.json` `{items[]}` sin thumbs (los campos se reconocen por `id` numeral), CRUD existente (`campo_alta` hueco mas bajo/max+1, `campo_editar`, `campo_baja` tombstone, escritura atomica, lectura tolerante `motor:listar:catalogo:invalido:campos`) + **tupla de 10 slots** con flag `array` (indice 9) + **sandbox de `script`** `validar_script_campo()` (prohibidos `document.getElementById/querySelector`, `DOMContentLoaded`, `id=`; aplica en `campo_desde_post` y en `campo_alta/campo_editar` del motor con causa `motor:campos:script:invalido`). UI `admin/campos.php` con checkbox Array. Tests: fase `campos` ampliada (10 slots, array flag, rechazo de script prohibido) y `tienda` ajustada a 10 slots.
- [X] T005b Adaptar el componente cliente `selector-pmu`: `assets/selector-pmu.js` reescrito (era un stub con `console.log`) — constructor `(elemento, config)` con `finalW`/`finalH` obligatorios (los define el campo/PDF; `maxW`/`maxH` eliminados), `mode` `crop|fit`, `aspectRatio`, `category`; `open()` con dialogo real (file input con allowlist `.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg`, canvas del tamano final, zoom, arrastre para encuadrar, Escape), `onSelect(url, meta)`, `onError(msg, err)`, `on(evento, cb)` (`progress`/`success`/`error`), `obtenerBlob()`, `close()`, `destroy()`; sin dependencias ni limite de peso; estilos inyectados por el propio componente; el llamador sube el blob al pool del item. Contrato actualizado (fuera `SIZE_EXCEEDED`). `node --check` OK.
- [X] T006 Nueva pestaña "Campos" en `admin/page.php` + `admin/campos.php` (depende de T005): ya existia el catalogo global (tab en `page.php`, listado/alta/edicion/baja + modal de alta rapida en `assets/admin.js`); completado en esta pasada el checkbox **Array** (flag `array`, indice 9 de la tupla) y la validacion de sandbox del `script` al guardar. Sin `[P]`: depende de T005.

---

## Phase 3: User Story 1 - Admin configura producto (P1) 🎯 MVP

**Goal**: El admin compone mockups, mapea grupos a campos y asocia el PDF a un producto Woo.

**Independent Test**: Subir un PDF con 2 grupos, crear 2 mockups (fondo + placeholders), mapear `value="[campo1]"`, asociar a un producto; verificar `config.json` y que `analisis.json` no cambia.

### Implementation for User Story 1

- [ ] T007 [US1] Seccion "Mockups" en `admin/pdfs.php`: listar mockups del PDF (render al vuelo, sin miniaturas), crear/duplicar/eliminar, elegir `preview_omisible` (checkbox visible solo si hay >= 1 mockup) y subir fotos a `pdfs/{nombre}/mockups/` (ambito nuevo, sin catalogo). **Parcial hecho**: acordeon con listado vigente + explicacion de la norma + checkbox `preview_omisible` (disabled sin mockups; persiste via `guardar_config` con regla del motor: sin mockups queda `false`), handlers `personalizador_pdf_mockup_subir/borrar` registrados pero SIN implementar (proxima pasada).
- [ ] T008 [US1] Editor embebido de mockups: iframe del modulo `modules/textmuy/` en modo reducido (`?modo=mockup&pdf={nombre}`) con canvas 300x300, capas `img`/`placeholder` ordenables (z-order), propiedades por capa (x, y, w, h, rot, sesgo, filtros 0..200%) y guardado en `config.json:mockups[]` via `PMU_Uploads::guardar_config()`; bump `?v=RCn` en `modules/textmuy/index.html` y `render-core.html`.
- [X] T009 [US1] Mapeo de grupos a campos en `admin/pdfs.php`: por grupo elegir `tipo` (texto/imagen), `preset` (selector de `presets.json`), `value` y `settings` (plantillas `[campoN]` con autocompletado de `campos.json`) y checkbox `[v] Repetir por placeholder` (por campo/código: si el resultado es array, un valor por instancia; si no, el mismo valor en todas); guardar en `config.json:placeholders[id]` (con `repetir`) sin pisar `analisis.json`. Persistido en `handle_config_guardar` y normalizado en `PMU_Uploads::config_placeholders` (validado por fase `mockups`).
- [X] T010 [US1] Asociacion PDF ↔ producto Woo (parcial backend): metodos `producto_pdf_slug/vincular/desvincular` en `personalizador-pdf.php` — canonico `postmeta _pmu_pdf_slug` (exige Woo; causa `motor:vinculo:sin_woo` en stubs) + espejo `config.json:productos[]` (espejo con dedupe); UI de la consola aclara que el vinculo canonico vive en la meta del producto (el listado actual es espejo). PENDIENTE (UI duradera): form de asociacion en ficha de producto Woo + forzar cantidad fija 1 (parte frontend de T010, requiere Woo real; se cierra con T012/T030).
- [X] T011 [US1] Test de la historia: fase `mockups` en `tests/texto_puente.php` (guardar mockups + mapeo con `repetir` no pisa `analisis.json`; `preview_omisible` solo persiste con mockups — sin mockups queda `false` forzado; capas invalidas/refs con ruta descartadas; clamp filtros/rot/sesgo; asignacion postmeta/espejo pendiente de T010).


---

## Phase 4: User Story 2 - Cliente personaliza con mockup (P1)

**Goal**: Ficha con campos, "Vista previa" (galeria paralela), add-to-cart como visto bueno y sesion completa.

**Independent Test**: En la ficha de prueba, completar campos, pulsar "Vista previa", ver las vistas generadas en paralelo, agregar al carrito y verificar `tmp/sesion-{sid}/{cart_item_key}/` con pool + webp + `preview_estado=ok`.

### Implementation for User Story 2

- [ ] T012 [US2] Crear `assets/tienda.js` + encolado en ficha de producto con PDF activo: renderiza `campos.json` (contenido/css/script con sandbox `ctx`/`root`), recolecta el valor dual `{valor, cliente}` y expone el estado para el carrito; oculta el panel si el PDF esta inactivo o sin grupos.
- [ ] T013 [US2] Handler AJAX `personalizador_pdf_vista_previa` en `personalizador-pdf.php` (nonce + cookie `pmu_sid`): crea/actualiza el draft (`PMU_Sesion::crear_draft()`), valida valores (sanitizados y limitados) y devuelve `{sid, item_key, pdfs, mockups[]}` al navegador.
- [ ] T014 [US2] Render de vistas en `assets/tienda.js`: al pulsar "Vista previa" oculta el boton (leyenda "verifica tu personalizacion antes de continuar con la compra"), muestra la galeria 300x300 con flechas (mockups de todos los PDFs del producto concatenados), placeholder "Generando vista previa" por vista y render PARALELO via `TextMuyAPI.renderBatch` del RenderCore; sube cada PNG al pool (`PMU_Sesion::guardar_png()`).
- [ ] T014b [US2] Resolucion de arrays en `assets/tienda.js`: si el campo/codigo resulta array (o `repetir` esta activo), un PNG por instancia (`img/{pdf}-{id}-{n}.png` con `-{n}` numerado y fila en `manifest.archivos[]`); si `N != M` (valores vs instancias), avisar y **bloquear la generacion de ese PDF** antes de renderizar (nunca PDF a medias); los mockups reflejan la misma resolucion.
- [ ] T015 [US2] Habilitacion del carrito: el boton `add_to_cart` permanece deshabilitado hasta que todas las vistas de los PDFs no-omisibles esten listas; al agregar, interceptar el submit (`form.getAttribute('action')`, NUNCA `form.action`), enviar `cart_item_data` con `pmu_sid`/`pmu_item_key`/`unique_key=uuid` y promover el draft (`PMU_Sesion::promover()`); hooks `woocommerce_add_cart_item_data` + `woocommerce_get_item_data` para etiquetas `cliente` y meta canonica del item; congelar `mockup-{id}.webp` al agregar (`PMU_Sesion::congelar_webp()`).
- [ ] T016 [US2] Re-edicion: link "Editar" en el carrito vuelve a la ficha con `item_key` cargado (valores + galeria ya generada); al re-pulsar "Vista previa" solo se regeneran los campos cuyo `hash` cambio; borrar item del carrito (`woocommerce_remove_cart_item`) dispara `PMU_Sesion::borrar_item()`.
- [X] T017 [US2] Test de la historia: fase `sesion` en `tests/texto_puente.php` (draft -> promover con mismo sid; pool dedicado numerado con `-{n}`; manifest con indice `archivos[]`; webp congelados; TTL de drafts; array con `repetir` y bloqueo N≠M pendiente de la fase `conciliacion`/T024).

**Checkpoint**: US2 independently functional — ficha completa sin mockup roto y carrito con sesion coherente.

---

## Phase 5: User Story 3 - Cliente omisible sin mockup (P2)

**Goal**: PDFs con `preview_omisible=true` permiten comprar sin vista previa.

**Independent Test**: Con el flag activo, agregar sin pulsar "Vista previa" y verificar `preview_estado=omisible` en meta/manifest y generacion posterior del PDF.

### Implementation for User Story 3

- [ ] T018 [US3] Logica en `assets/tienda.js` + handler de ficha: si todos los PDFs del producto tienen `preview_omisible=true`, ocultar "Vista previa" y habilitar el carrito desde el inicio; al agregar, `preview_estado=omisible` y pool vacio (se generara despues).
- [ ] T019 [US3] Manejo mixto (producto con PDF omisible + PDF obligatorio): el carrito se habilita solo cuando los obligatorios tienen sus vistas; el omisible no bloquea.
- [ ] T020 [US3] Test de la historia: extender fase `sesion` (omisible: draft sin vistas + `preview_estado=omisible`; obligatorio sigue bloqueando).

**Checkpoint**: US3 independently functional.

---

## Phase 6: User Story 4 - Fallo tolerado + pedido y descarga (P2)

**Goal**: Los fallos de render no pierden la venta; el pedido se promueve al pago y se descarga por lista Woo.

**Independent Test**: Provocar fallo de render (preset invalido), agregar con `sin_vista`, pagar y descargar con reintento silencioso.

### Implementation for User Story 4

- [ ] T021 [US4] Tolerancia en `assets/tienda.js`: vista con error se oculta (fotografia final, sin marcos de editor); si no queda ninguna, galeria oculta + mensaje "no hay vista previa" + carrito habilitado; `preview_estado=sin_vista` persistido en manifest/meta.
- [ ] T022 [US4] Hooks Woo en `personalizador-pdf.php`: al crearse el pedido, `PMU_Sesion::staging_order()` (copia del item a `tmp/orders/{order_id}/`); al confirmarse el pago, `promover_order()` (rename a `orders/{order_id}/{item_key}/` con flag `.promocionando` y reintento en la siguiente accion); registrar `preview_estado` y valores en la meta del pedido.
- [ ] T023 [US4] Descarga en `mi-cuenta/descargas/`: exponer cada `{pdf}_procesado.pdf` del item como fila de descarga Woo; el boton "Descargar" dispara render cliente (regenera el pool si falta algo) + `Motor.php` server-side (inyeccion por `manifest.archivos[]`), reintentable e idempotente; con `sin_vista`, reintento silencioso antes del Motor.
- [ ] T024 [US4] Test de la historia: fase `conciliacion` en `tests/texto_puente.php` (sin vistas -> carrito habilitado; staging -> promote; descarga idempotente; analisis intacto tras todo el ciclo).

**Checkpoint**: US4 independently functional — venta concretada aun con fallo de render.

---

## Phase 7: User Story 5 - Admin revisa "completados" (P2)

**Goal**: Registro admin de pedidos completados con filtro por estado y regeneracion.

**Independent Test**: Crear un pedido con `sin_vista`, abrir "completados" (aparece primero con el filtro), ver webp + valores y regenerar el PDF.

### Implementation for User Story 5

- [ ] T025 [US5] Seccion "Completados" en `admin/pdfs.php`: listado de pedidos completados con items (`orders/{order_id}/{item_key}/`), filtro por `preview_estado` (`sin_vista` primero), vista de webp congelados + valores del cliente (solo lectura) y causa si falta un archivo del indice.
- [ ] T026 [US5] Accion "Regenerar" por item (admin): re-render del pool via RenderCore en el navegador del admin + Motor; actualiza manifest/meta y deja el PDF listo para el cliente (idempotente).
- [ ] T027 [US5] Test de la historia: extender fase `conciliacion` (listado con filtro; regeneracion actualiza pool + PDF sin duplicar).

**Checkpoint**: US5 independently functional — el admin puede recuperar cualquier caso.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentacion, arnes completo y verificacion final.

- [ ] T028 [P] Actualizar `AGENTS.md` (§3 flujo comprador, §5 convenciones: `campos.json`, `pdfs/{nombre}/mockups/`, `tmp/sesion-{sid}/`, `preview_estado`) y `admin/ayuda.php` (flujo mockups/vista previa/descargas).
- [ ] T029 [P] Actualizar `readme.txt` (Descripcion, FAQ y changelog) con el ciclo del comprador vigente.
- [ ] T030 Correr `quickstart.md` completo (secciones 1-8) en panel WP real y limpiar los datos de prueba generados: solo `tmp/sesion-*`, `tmp/muestras/*` y `tmp/orders/*` creados en el recorrido; **nunca** `orders/` (entregables), ni `pdfs/`, ni catalogos del editor.
- [ ] T031 Verificacion completa: `php -l` (todo), `motor_smoke` (SMOKE OK), `parity` (PARIDAD OK), `texto_puente` en todas las fases; `node --check` + 10 suites si se toco `modules/textmuy/` (bump `?v=RCn` aplicado).

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