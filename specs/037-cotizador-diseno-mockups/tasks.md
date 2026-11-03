# Tasks: Cotizador — diseno, mockup y favoritos (037)

**Input**: `specs/037-cotizador-diseno-mockups/` (spec, plan, research, data-model, contracts, quickstart)

**Prerequisites**: `plan.md` (fases F0-F6), `spec.md` (D1-D10 + 35 FR + 8 SC), `research.md`
(R1-R13), `data-model.md`, `contracts/puente-cotizador.md` (C0-C4),
`contracts/customs.md` (C1-C7), `quickstart.md` (E0-E10)

**Tests**: **obligatorios**. El repo no tiene tests opcionales: cada fase cierra con
`php -l`/`node --check` y la puerta de su area (`AGENTS.md` §9). Se incluyen como tareas propias.
Del lado del consumidor (repo `calculadora`), la puerta es `npm run typecheck` + `npm test` +
`npm run build`.

**Organization**: la spec tiene **4 user stories** con prioridad. Se implementan en orden
P1 → P1 → P2 → P3, y **US1+US2 juntas son el MVP** (una sin la otra no entrega valor: el mockup
sin quien lo defina no se ve, y el editor sin mockup no muestra nada).

| Historia | Valor | Fase del plan |
|---|---|---|
| **US1** (P1) | El admin define el mockup (fondo + hueco) y ve la vista previa | F5 (admin) |
| **US2** (P1) | El comprador sube su arte, lo encuadra y ve el mockup del producto | F1+F2+F5 |
| **US3** (P2) | El diseno viaja con el pedido y el taller lo recupera | F4 |
| **US4** (P3) | Ideas, custom y historial en una sola tira, con estrella | F3+F5 |
| Foundational | Contexto `cotizador`, fachada, receta/lienzo y rutas `customs/` | F0-F2 |
| Polish | Docs, indice, version y evidencia del lab | F6 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencia de tareas incompletas)
- **[Story]**: US1/US2/US3/US4 (solo en fases de historia)
- **T000**: gobernanza. Mantiene el ID que ya usan `spec.md`, `plan.md` e `INDICE.md` para que la
  trazabilidad no se rompa; va **antes** de cualquier codigo.
- Rutas relativas a la raiz de cada repo: `personalizador-pdf/` (plugin) y `calculadora/`
  (consumidor). Cuando una tarea es del consumidor se indica con el prefijo `calculadora/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirmar la base en verde y dejar los esqueletos de las puertas nuevas.

- [X] T001 Correr las puertas base y confirmar verde: `php -l personalizador-pdf.php`,
      `Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }`,
      `node --check assets/selector-pmu.js`, `node --check assets/mockup-render.js`,
      `node tests/receta-contrato.test.js`, `node tests/fotos-contrato.test.js`,
      `node tests/biblioteca-contrato.test.js`, `php tests/motor_smoke.php`,
      `php tests/parity.php`, `php tests/sin_lectura.php`, `php tests/estado_pmu.php`
- [X] T002 [P] Crear el esqueleto de `tests/cotizador-contrato.test.js` con los casos `--contexto`,
      `--ideas` y `--paridad`: debe correr y decir `CONTEXTO OK (0 checks)` (contrato:
      `contracts/puente-cotizador.md` C0/C1). `--paridad` (I1) compara
      `PMU_Sesion::receta_cotizador` (PHP) con `calculadora/src/core/mockups.ts`: mismas entradas
      -> mismo `gid` y mismas medidas (`size -> px`)
- [X] T003 [P] Agregar el `case` vacio `cotizador` a `tests/texto_puente.php`: debe correr sin
      error y decir `FASE cotizador OK (0 checks)` (contrato: `contracts/customs.md` C4-C6)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: gobernanza, contexto, fachada, receta/lienzo y rutas. **Sin esto ninguna historia
cierra.**

**⚠️ CRITICAL**: US1 no puede empezar (ni US2/US3/US4) hasta que esta fase termine.

- [X] T000 **T000 — Gobernanza (MINOR)**: `constitution` **ya** enmendada a **4.1.0** (2026-11-03:
      §I acota el alcance del cotizador y §IV suma `customs/`, con su Sync Impact Report). Resta:
      agregar la linea de `customs/` en `AGENTS.md` §5 y registrar la decision en
      `docs/decisiones.md` (entrada 2026-11-03, spec 037). **No** cambia principios.
- [X] T004 Contexto en los datos: en `inc/class-pmu-sesion.php` (`crear_draft()`,
      `guardar_subida()`) escribir `manifest.contexto = 'cotizador'` cuando el origen lo pida,
      con `manifest.pdfs = []` y `manifest.preview_estado = 'omisible'`. **No** tocar
      `subidas[].origen` (`data-model.md` "Diseno del pedido")
- [X] T005 Fachada `inc/class-pmu-cotizador.php`: `activo()` (filtro `pmu_cotizador_activo`),
      `contexto()` y `assets()` (encola **solo** `mockup-render`, `selector`, `visor`,
      `biblioteca`, `cargador`, `fotos`; **nunca** `tienda.js` ni `campo-montar.js`); incluirla en
      `personalizador-pdf.php` (contrato C1)
- [X] T006 [P] Rutas: `PMU_Uploads::dir_sesion_customs($sid, $crear)` y
      `dir_order_customs($clave, $crear)` en `inc/class-pmu-uploads.php` (mismas guardas que
      `dir_order_uploads()`; `customs/` **sin** `manifest.json`) (`contracts/customs.md` C1)
- [X] T007 Receta sintetica en `inc/class-pmu-sesion.php`: `receta_cotizador($categoria, $size,
      $diseno)` con `gid` = 6 hex de `sha1(categoria|size)` (mayusculas), `phsize = 0`, `w/h`
      = px a 300 ppp (`1..3000`), `fondo = '#ffffff'`, `transp = 'no'`; validar con
      `receta_validar()` (research R6). Va **despues** de T004 (mismo archivo). El `gid` y
      `size -> px` deben coincidir con `calculadora/src/core/mockups.ts` (assert de paridad en T002)
- [X] T008 `engine/Compositor.php`: aceptar **lienzo explicito** cuando `contexto = 'cotizador'`
      (no hay `analisis.json`); `personalizador-pdf.php` (`handle_subida`/`handle_vista_previa`)
      pasa el lienzo validado (`1..3000`). Sin lienzo, comportamiento actual intacto (research R5)
- [X] T009 [P] `calculadora/src/hooks/usePmuAssets.ts`: loader diferido de los 6 modulos
      (`<script>` on-demand + `preload` al abrir el paso), inyeccion de
      `window.PMU_TIENDA = {...contexto:'cotizador'}` y del contenedor
      `<div data-pmu-panel data-pmu-contexto="cotizador">`. Cero descargas al cargar (D10/R9).
      Tambien lo carga al abrir la pestaña **Mockups** del admin (el preview de T013 usa
      `PMUMockup`)

**Checkpoint**: contexto, fachada, receta/lienzo, rutas y loader listos. Las historias pueden
empezar (US1 y US2 en serie; US3/US4 dependen de US2).

---

## Phase 3: User Story 1 - El admin define el mockup del producto (Priority: P1) 🎯 MVP (parte 1)

**Goal**: el admin elige la foto de escena y ubica el hueco (forma + proporcion reales) por
categoria, con override por tamano, y ve una vista previa fiel antes de publicar.

**Independent Test**: `plan` US1 — armar fondo + hueco, guardar, recargar y ver que la vista
previa coincide. Del lado del consumidor: `npm run typecheck` + `npm test`.

- [X] T010 [P] [US1] `calculadora/src/types/index.ts`: `MockupDef` (`id`, `titulo`, `categoria`,
      `size?`, `fondo`, `hueco{x,y,w,h,rot}`, `forma`, `visible`) + `AppData.mockups?:
      MockupDef[]` (`data-model.md` "Mockup del cotizador")
- [X] T011 [P] [US1] `calculadora/src/core/mockups.ts` (puro): `sizeToPx(size)` (cm → px a 300 ppp),
      `gidPara(categoria, size)` (6 hex, **igual formula que T007**), `formaForCategoria()`
      (`rectangulo` en v1 para "Formas") y `resolveMockupFor(order, mockups)` (override por
      tamano > categoria > null). Agregar 8 asserts en `calculadora/tests/core.test.js`
- [X] T012 [P] [US1] `calculadora/src/core/validation.ts`: `sanitizeMockups()` — `hueco.x/y` en
      `0..300`, `hueco.w/h` en `1..300`, ids unicos, descarta sin `fondo` o con `visible:false`,
      y **warning** por cada descarte (mismo criterio "repara y avisa")
- [X] T013 [US1] `calculadora/src/components/AdminMockupsPanel.tsx`: lienzo 300x300, fondo con
      `window.wp.media` (patron de `AdminGalleryPanel.tsx:30-54`), hueco arrastrable/redimensionable
      y vista previa con `window.PMUMockup.componer` usando la imagen de muestra. Avisa cuando el
      hueco esta fuera del lienzo (FR-035)
- [X] T014 [US1] `calculadora/src/components/AdminTabs.tsx` + `App.tsx`: pestana **Mockups** y
      handlers (`updateMockup`, `addMockup`, `removeMockup`); `assets/guardar_datos.php`: seccion
      `mockups` con las validaciones de T012 (lista, ids unicos, topes)
- [X] T015 [US1] `calculadora/assets/datos_config.json`: agregar `mockups: []`; verificar que
      `scripts/generar-reglas.js` sigue corriendo sin cambios
- [X] T016 [US1] Gate: `cd calculadora; npm run typecheck; npm test; npm run build` + guardar en
      Admin, recargar y confirmar que el mockup sobrevive (sin warnings nuevos)

---

## Phase 4: User Story 2 - Subir el arte y verlo en el producto (Priority: P1) 🎯 MVP (parte 2)

**Goal**: el comprador sube su arte (o elige de su biblioteca), lo encuadra contra la forma real y
ve el mockup del producto; el boton de compra espera a la cola.

**Independent Test**: `quickstart` E3 — subir una imagen, ver el mockup 300x300, cambiar de
forma/tamano y ver que el hueco se re-resuelve sin volver a subir.

- [X] T017 [US2] `calculadora/src/components/DesignFields.tsx`: wrapper React de `CargadorPMU` +
      `SelectorPMU` sobre un `ref` (1 ranura: `w/h` del sticker, `forma` de la categoria,
      `min: 0`, `max: 1`), `subir` → endpoint `personalizador_pdf_subida` con `_wpnonce`,
      `item_key` (`cot-*`) y `params` (receta de T007/T011). El reuso de una imagen ya subida sale
      del `CargadorPMU` + `PMUBiblioteca` (FR-009)
- [X] T018 [US2] `calculadora/src/components/DesignStep.tsx`: Paso 4 "Tu diseno" en `App.tsx`
      (se habilita con forma + tamano), miniatura con **Cambiar / Quitar**, aviso de subida en
      curso y estado vacio. **Sin** aviso de resolucion (D8)
- [X] T019 [US2] `calculadora/src/components/MockupPreview.tsx`: estado vacio **por CSS** (fondo
      `<img>` + hueco) y, con arte, `window.PMUMockup.componer` (300x300, `huecosTransparentes:
      true`); ampliar con `ImageLightbox`
- [X] T020 [US2] `calculadora/src/App.tsx`: `diseno` en el estado del pedido (`{id, itemKey, sid,
      w, h, receta}`); al cambiar forma/tamano/material se recalcula `w/h`, `gid` y receta y el
      mockup se repinta **sin** volver a subir (FR-005/FR-007)
- [X] T021 [US2] `calculadora/src/components/OrderSummary.tsx` + `MobileSummaryBar.tsx`: el boton
      COMPRAR se deshabilita solo con `pendientes() > 0` (texto "Subiendo tu diseno...") y se
      habilita al vaciarse la cola; el resumen muestra "Diseno cargado" con la miniatura (FR-014)
- [X] T022 [US2] `calculadora/src/components/DesignStep.tsx`: degradacion (D9) — si
      `PMU_TIENDA`/la fachada no responden, el Paso 4 se oculta (o avisa) y el cotizador sigue
      cotizando y comprando; ofrecer el canal alternativo
- [ ] T023 [US2] Gate navegador (lab): `specs/037-cotizador-diseno-mockups/quickstart.md` E3 —
      subir JPG grande, PNG transparente y recargar; verificar `0` POST de mas al re-encuadrar,
      `pendientes()` en 0 al comprar, el mockup en < 2 s y "Elegir ya subida" (FR-009)

---

## Phase 5: User Story 3 - El diseno llega con el pedido (Priority: P2)

**Goal**: al confirmarse la compra, el arte queda asociado al pedido y el taller lo recupera;
re-guardar el estado no duplica nada.

**Independent Test**: `quickstart` E7/E8 — pedido con diseno en el lab, archivo recuperable desde
el pedido sin abrir el cotizador.

- [X] T024 [P] [US3] `inc/class-pmu-cotizador.php`: `promover_linea($order_id, $item_key)` que
      reusa `mover_originales()` + `rename` de `PMU_Sesion` y **no** llama a `entregar_por_tema()`
      ni `congelar_bonus_item()` (contrato C3, research R7)
- [X] T025 [US3] `personalizador-pdf.php`: en los hooks `woocommerce_order_status_processing` /
      `_completed`, derivar a `promover_linea()` los line items con `_mu_origen = 'cotizador'` y
      **saltear** `pedido_promover()` para esos items; adoptar los customs del invitado a
      `orders/{cliente}/customs/` (idempotente)
- [X] T026 [P] [US3] `calculadora/woocommerce-plugin/plugin-calculadora-cart-integration.php`:
      aceptar `diseno` en `calculator_data` y guardar `_pmu_sid`, `_pmu_item_key`,
      `_mu_diseno_id` y `_mu_origen = 'cotizador'` en el cart item y en
      `woocommerce_checkout_create_order_line_item`
- [X] T027 [US3] Bloque "Diseno" en el pedido: `display_order_item_meta()` (admin y cliente) con
      original + mockup aprobado y enlace de descarga; sin exponer rutas absolutas
- [X] T028 [US3] Fase `cotizador` de `tests/texto_puente.php` (T003): alta de custom, promocion,
      idempotencia al re-promover, `customer_id = 0` sin promocion, adopcion invitado->cliente y
      borrado sin huerfanos (`contracts/customs.md` C4-C6)
- [X] T029 [US3] Gate: `php tests/texto_puente.php cotizador` + `php tests/sin_lectura.php` +
      `php tests/estado_pmu.php` (los escaneos ignoran `customs/`) + `php -l` del plugin

---

## Phase 6: User Story 4 - Ideas, favoritos e historial en una sola tira (Priority: P3)

**Goal**: una sola tira con items de la tienda, customs del comprador e historial; estrella sobre
cualquier item; borrado de los propios; precio recalculado al cargar.

**Independent Test**: `quickstart` E4/E5/E6 — guardar un custom, recargar, marcarlo, borrarlo.

- [X] T030 [P] [US4] `inc/class-pmu-cotizador.php`: `guardar_idea()`, `listar_ideas()`,
      `favorito()`, `borrar_idea()` + endpoint `admin_post_pmu_cotizador` (+`nopriv`) con
      `op=listar|guardar|favorito|borrar|historial`; nonce `personalizador_pdf_vista_previa`,
      identidad por cookie (contrato C2, `customs.md` C2-C5). `historial` lee Woo (`wc_get_orders`
      por `customer_id` + `_calculator_order_code`/`_mu_diseno_id`) y **no** persiste copia
      (FR-023). `favorito` escribe `idea.json` (custom) o `orders/{cliente}/customs/favoritos.json`
      (tienda/historial). Escritura atomica de `idea.json`; tope de 60 ideas
- [X] T031 [P] [US4] `calculadora/src/hooks/useClientIdeas.ts`: `listar/guardar/favorito/borrar`
      contra el endpoint + cache de metadatos en `localStorage` (patron `PMUBiblioteca`) y
      invalidacion tras guardar/borrar
- [X] T032 [US4] `calculadora/src/components/MiniGallery.tsx`: tira unificada (tienda + customs +
      historial) con la misma tarjeta; estrella en cualquier item y comparador **puro** (favorito,
      orden, fecha) con 5 asserts en `tests/core.test.js`; nombre configurable (Anexo C de la spec).
      Al reusar un custom se restaura tambien su `diseno` (id/itemKey/sid, FR-022) y se genera la
      `descripcion` automatica con material/forma/tamano/formato/planchas (FR-026)
- [X] T033 [US4] `calculadora/src/components/MiniGallery.tsx`: borrado de customs propios con
      confirmacion, invalidacion de cache y sin huerfanos (FR-025); el historial no se borra
- [X] T034 [US4] `calculadora/src/components/MiniGallery.tsx` + `App.tsx`: precio recalculado al
      cargar con `galleryPricing` contra el catalogo vigente; badge "actualizado" cuando difiere
      del guardado (D7/FR-027)
- [ ] T035 [US4] Gate: `node tests/cotizador-contrato.test.js --ideas` + navegador (guardar,
      recargar, marcar, borrar) + `npm run typecheck`
- [X] T036 [US4] Retencion (FR-032): fijar el TTL de `tmp/sesion-{sid}/customs/` (el vigente de
      drafts/carrito) y garantizar que `limpiar_ttl()` **no** toca `orders/{cliente}/customs/`; en
      `inc/class-pmu-sesion.php` + assert en la fase `cotizador` de `tests/texto_puente.php`
      (`contracts/customs.md` C6)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: documentacion, evidencia del lab y cierre.

- [X] T037 [P] Docs: `AGENTS.md` §5 (ruta `customs/`) y §9 (puertas nuevas), `specs/INDICE.md`
      (estado real de la 037) y version **4.29.0** en la cabecera del plugin
- [ ] T038 [P] `tests/cotizador-pedido.browser.js` (lab, Playwright): recorrido E1-E10 de
      `quickstart.md` punta a punta; completar la tabla de evidencia del quickstart con el
      resultado real
- [ ] T039 Gate final: bloque "Puertas completas" de `quickstart.md` entero en verde +
      `git status` limpio + `npm run build` del consumidor

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar ya.
- **Foundational (Phase 2)**: depende de Setup; **bloquea las 4 historias**. Arranca con **T000**
  (gobernanza) antes de escribir codigo.
- **US1 (Phase 3)**: depende de Foundational (necesita `T009` para el preview con `PMUMockup` y
  `T007` para que el `gid` del admin coincida con el del servidor).
- **US2 (Phase 4)**: depende de US1 (sin mockup definido no hay que previsualizar) y de
  `T004`/`T005`/`T008`.
- **US3 (Phase 5)**: depende de US2 (necesita un `diseno` real en el pedido).
- **US4 (Phase 6)**: depende de US2 (un custom es "un diseno guardado") y de `T030` (endpoint).
- **Polish (Phase 7)**: depende de todas.

### User Story Dependencies

| Historia | Puede empezar cuando | Depende de |
|---|---|---|
| US1 | Foundational completo | T000, T007, T009 |
| US2 | US1 completo | T004, T005, T008 + US1 |
| US3 | US2 completo | T024-T026 + un pedido con diseno |
| US4 | US2 completo | T030/T031 + el `diseno` del pedido |

### Within Each User Story

- Modelos/tipos antes que componentes (T010-T012 antes de T013).
- Componentes antes que el wiring de `App.tsx` (T017-T019 antes de T020-T021).
- La puerta de la historia **cierra** la fase: no se pasa a la siguiente sin verde.

### Parallel Opportunities

- **Setup**: T002 y T003 en paralelo (archivos distintos).
- **Foundational**: T006 y T009 en paralelo; T004 → T007 van en serie (mismo archivo,
  `inc/class-pmu-sesion.php`), y T005 → T008 tambien (mismo `personalizador-pdf.php`).
- **US1**: T010, T011 y T012 en paralelo (tipos / core puro / saneador).
- **US3**: T024 (plugin) y T026 (plugin del carrito) en paralelo.
- **US4**: T030 (plugin) y T031 (hook del consumidor) en paralelo.
- **Polish**: T037 y T038 en paralelo.

### Parallel Example: US1

```text
Task: "T010 MockupDef + AppData.mockups en calculadora/src/types/index.ts"
Task: "T011 src/core/mockups.ts puro + 8 asserts en tests/core.test.js"
Task: "T012 sanitizeMockups() en src/core/validation.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Setup (T001-T003).
2. Phase 2: Foundational (T000, T004-T009) — **crítico**, bloquea todo.
3. Phase 3: US1 (T010-T016) → el admin ya puede definir mockups.
4. Phase 4: US2 (T017-T023) → **STOP and VALIDATE** con el quickstart E3.
5. Deploy/demo: el comprador ya sube su arte y ve el mockup (valor visible).

### Incremental Delivery

1. US1 + US2 → MVP (mockup + subida).
2. US3 → el diseno deja de perderse (valor de negocio).
3. US4 → favoritos e historial (fidelización).
4. Polish → docs, evidencia y versión.

### Regla de oro del proyecto

Cada tarea se cierra con **su** puerta y **un commit**; nada se declara hecho sin la salida real
pegada en la conversación o en el quickstart. Si una puerta falla, la causa va en el mensaje
(`cotizador:*` / `motor:*`): no se inventa un fallback silencioso.

---

## Notes

- `[P]` = archivos distintos, sin dependencia de tareas incompletas.
- `[Story]` mapea la tarea a US1-US4 para trazabilidad con `spec.md`.
- **T000** es el **ID de gobernanza** que ya usan `spec.md`, `plan.md` e `INDICE.md`; abre la
  Fase 2, por eso no es secuencial con T001-T003 (que son el Setup).
- El consumidor (`calculadora`) y el plugin se tocan en **repos distintos**: los commits de cada
  lado van separados y la trazabilidad se cruza por el número de tarea.
- Verificar que las puertas nuevas **fallen** antes de implementarlas (T002/T003 nacen en 0 checks).
- Evitar: tareas vagas, dos tareas sobre el mismo archivo en paralelo, dependencias cruzadas que
  rompan la independencia de las historias.
- Fuera de alcance (no generar tareas): vista de plancha A4 y PDF de producción (fase posterior).
---

## Estado de implementacion (2026-11-03)

**36 de 40 tareas cerradas** con sus puertas en verde. Lo que quedo abierto es, **todo**, el
recorrido de navegador del laboratorio (`C:\wp-lab` + Playwright), que necesita un WordPress con el
cotizador desplegado y un pedido real:

| Tarea | Estado | Causa / que falta |
|---|---|---|
| **T023** (US2) | parcial | Gate de navegador de E3 (subir JPG grande / PNG transparente / recargar / `pendientes()` / "Elegir ya subida"): `tests/cotizador-pedido.browser.js` ya cubre E10 + el payload, pero el E3 completo no se corrio. |
| **T035** (US4) | parcial | `--ideas` y `npm run typecheck` en verde; el recorrido de navegador (guardar, recargar, marcar, borrar) no se corrio. |
| **T038** (Polish) | parcial | `tests/cotizador-pedido.browser.js` esta escrito y **sale 0 en modo pendiente** sin `PMU_COTIZADOR_URL`; falta correrlo contra el laboratorio y completar la tabla de evidencia con el resultado real. |
| **T039** (Polish) | parcial | El bloque "Puertas completas" de `quickstart.md` corre entero y en verde (la puerta de navegador se auto-declara pendiente); falta el recorrido real. |

**Desvios de implementacion (documentados):**

- **T032**: la tira unificada vive en `calculadora/src/components/TiraIdeas.tsx` (componente nuevo)
  en vez de reescribir `MiniGallery.tsx`. Motivo: `MiniGallery` conserva su lightbox de la tienda y
  se usa como **degradacion** cuando el puente no esta disponible (D9). El comportamiento es el de
  la spec: una tarjeta, tres origenes, estrella en todos, precio recalculado.
- **T008**: no hizo falta tocar `engine/Compositor.php`: el lienzo del cotizador viaja **explicito**
  en la receta (`w/h`), que es justo lo que `componer()` ya lee. La receta la sintetiza
  `PMU_Sesion::receta_cotizador()` y la valida `receta_validar()`.
- **T030**: el endpoint agrega `op=imagen` (sirve `mockup.webp` y, con `order_id`+`item_key`,
  el original de un pedido autorizado) porque la tira necesita bytes sin rutas absolutas (C7).
- **T036**: el TTL del invitado se poda **por idea** (`limpiar_customs_dir`), no como un item
  entero, y `orders/{cliente}/customs/` no entra nunca en el barrido (solo recorre `tmp/`).
- **T017**: `DesignFields.tsx` envuelve el `CargadorPMU` del plugin (que abre el `SelectorPMU`), con
  `subir`/`urlDe`/`onChange` como contrato; si los modulos no cargan, degrada a un input nativo.