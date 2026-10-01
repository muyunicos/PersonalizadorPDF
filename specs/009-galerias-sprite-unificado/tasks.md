# Tasks: galerias-sprite-unificado

**Input**: Design documents from `/specs/009-galerias-sprite-unificado/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (motor-sprite.md, galeria-sprite.md), quickstart.md

**Tests**: Incluidos — el spec los exige (FR-014, SC-008: las verificaciones automáticas DEBEN cubrir apertura certificada, generación y causa visible). No es TDD estricto: cada tarea de test indica su escenario de quickstart.

**Organization**: Tareas agrupadas por historia de usuario para implementar y validar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: US1 · US2 · US3 · US4 (mapa directo al spec)
- Rutas exactas en cada descripción

## Path Conventions

Plugin WordPress con módulo integrado (plan.md §Project Structure): `inc/` (motor PHP), `modules/textmuy/` (cliente JS/CSS + `tests/`), `assets/` (ThumbEngine, sin cambios), `uploads/pmu/{fonts,img,tm-presets}/` (dato del admin), `tests/` (suites del plugin).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: línea base verificable antes de tocar el motor y el cliente.

- [ ] T001 Respaldar los inventarios del espejo y preparar el estado de prueba de E1 (copia de `uploads/pmu/fonts/fonts.json`, `uploads/pmu/img/img.json`, `uploads/pmu/tm-presets/presets.json`; anotar si existen `thumbs.webp` y `thumbs.sprite_firma`)
- [ ] T002 [P] Registrar la línea base de puertas en verde antes de empezar: `php -l` (inc/admin/engine), `php tests/motor_smoke.php`, `php tests/parity.php`, `node --check` + suites en `modules/textmuy/tests/` (guardar salida como evidencia)
- [ ] T003 [P] Medir el estado actual de geometría (evidencia "antes" de SC-006): en `modules/textmuy/tests/galerias.browser.js`, abrir la galería de fuentes con hoja simulada y anotar `tile.clientWidth/Height` y `getComputedStyle(tile).aspectRatio` (se usará en T031)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: certificación de hoja para los TRES ámbitos en el motor. Sin esto, US1–US4 no son verificables (la lectura canónica rechaza toda hoja de `fonts`/`tm-presets`).

**⚠️ CRITICAL**: ninguna historia puede cerrarse hasta completar esta fase.

- [ ] T004 Generalizar `PMU_Uploads::sprite()` en `inc/class-pmu-uploads.php` (líneas ~1339-1377): mover fuera del `if ($ambito === 'img')` la validación de firma (`json_decode($firma) === [thumbs.w, thumbs.h, thumbs.c, items]` del inventario en disco), la validación de dimensiones (`getimagesize`: ancho === `c × w`; alto === `ceil(max(1, maxId) / c) × h`) y la escritura final de `thumbs.sprite_firma`, para todo ámbito de `AMBITOS_GALERIA`; conservar el orden: invalidar (`guardar_catalogo`) → mover archivo → releer y comparar `items` → escribir firma; conservar los mensajes exactos (`motor:sprite:catalogo:desactualizado`, `motor:sprite:dimensiones:invalidas`, `motor:sprite:archivo:*`, `motor:sprite:directorio:no_escribible`)
- [ ] T005 Invalidar la certificación en los tres ámbitos: en `inc/class-pmu-uploads.php::guardar_catalogo()` (líneas ~463-470) el `unset($cat['thumbs']['sprite_firma'])` debe aplicar a `fonts`, `img` y `tm-presets` (hoy solo `img`), manteniendo la escritura atómica `.tmp` + `rename`
- [ ] T006 [P] Extender `tests/motor_smoke.php` con los casos del contrato `contracts/motor-sprite.md`: (a) `op=sprite` con firma válida certifica `fonts` (escribe `thumbs.sprite_firma` y responde `spriteUrl` con `?v=filemtime`); (b) firma rancia ⇒ `motor:sprite:catalogo:desactualizado`; (c) dimensiones que no calzan ⇒ `motor:sprite:dimensiones:invalidas`; (d) archivo > 4 MB (`SPRITE_MAX_BYTES`) ⇒ `motor:sprite:archivo:tamano`; (e) no-WEBP ⇒ `motor:sprite:archivo:formato`
- [ ] T007 [P] Extender `tests/motor_smoke.php` con el caso de invalidación: tras un `alta`/`baja`/`editar` en cada ámbito, el inventario queda sin `thumbs.sprite_firma` y la lectura canónica posterior debe regenerar (deja de estar certificada)

**Checkpoint**: `php -l` + `motor_smoke` en verde; un `POST op=sprite` de prueba con firma correcta deja `fonts.json` certificado.

---

## Phase 3: User Story 1 - Lectura certificada en las tres galerías (Priority: P1) 🎯

**Goal**: con hoja certificada, las tres galerías muestran miniaturas leyendo inventario + `thumbs.webp` y **cero descargas de contenido** (SC-001).

**Independent Test**: en `modules/textmuy/tests/galerias.browser.js` (y manualmente en WP): abrir fuentes/imágenes/presets con hoja certificada ⇒ solo `*.json` + `thumbs.webp`; `fontFace === 0`, `link[data-textmuy-font] === 0`, `canvas` por celda en las tres.

- [ ] T008 [US1] Verificar y ajustar `ensureSpriteCanonico`/`drawTileCanonico` en `modules/textmuy/js/api.js` (líneas ~293-443): acepta hoja solo si `spriteFirma === firma(inventario)` y dimensiones `c × w` por `ceil(maxId/c) × h`; devuelve `null` con causa registrada cuando no certifica (base para el estado `listando` de US2)
- [ ] T009 [P] [US1] `modules/textmuy/js/fuentes-galeria.js`: con hoja no certificada, pintar **placeholder de nombre** en toda celda (cero `renderFontPreview` por tile al abrir) y declarar estado `listando`; con hoja certificada, dibujar desde `drawTileCanonico('fonts', id)` (celda = `id-1`; excluir tombstones y `id > maxId`)
- [ ] T010 [P] [US1] `modules/textmuy/js/galeria.js`: reemplazar la reconstrucción silenciosa de `asegurarSpriteImg()` por lectura canónica con placeholder cuando no certifica (imágenes y pestaña de presets ya usan `drawTileCanonico`; quitar el `<img>` de originales como fallback del camino de apertura)
- [ ] T011 [P] [US1] `modules/textmuy/js/controls.js`: la galería inferior de presets usa solo lectura canónica al abrir (sin `ensureThumbnail` por tile ni `ensureSprite` en el camino de apertura)
- [ ] T012 [US1] Extender `modules/textmuy/tests/galerias.browser.js`: escenario "hoja certificada" para `fonts` e `img` (y `tm-presets` si el harness lo permite) con asserts SC-001: `hojas === 1`, `fontFace === 0`, `linksGoogle === 0`, `canvases === N`, `ambito` correcto
- [ ] T013 [US1] Validación manual E2 en WordPress (`quickstart.md` §2): F5 + reapertura de las tres galerías con Network abierto ⇒ 0 `.ttf/.woff2`, 0 originales, miniaturas completas; registrar evidencia de SC-001

**Checkpoint**: US1 verificable de punta a punta con una hoja existente (la de `img` ya puede certificarse hoy; `fonts`/`tm-presets` quedan completas tras US2).



---

## Phase 4: User Story 2 - Generación automática de huecos (Priority: P2)

**Goal**: sin hoja certificada (o con celdas faltantes), la galería genera sola lo que falta y persiste **una sola vez** por ámbito y apertura; nunca parcial; causa visible + Reintentar en error (SC-002, SC-003, SC-004, SC-007, SC-009).

**Independent Test**: borrar `thumbs.webp` + `thumbs.sprite_firma` de `fonts`: abrir ⇒ progreso `N/M` ⇒ **1** `POST op=sprite` ⇒ `thumbs.webp` `720×540` + firma escrita ⇒ F5 ⇒ 0 descargas.

### Implementación

- [ ] T014 [US2] Núcleo de dos fases en `modules/textmuy/js/api.js`: `asegurarHojaCompleta(ambito, {renderTile, onProgress})` — F1: por cada celda pendiente producir canvas en memoria (contador `dibujados`/`fallos`); F2: solo si `fallos === 0`, `ThumbEngine.ensureSprite({scope, items del inventario, ancho/alto/columnas del inventario, firma, render: devuelve los canvases ya hechos})`; `false` si hubo fallos (sin POST)
- [ ] T015 [US2] Reentrancia y causas en `modules/textmuy/js/api.js`: mapa `generando[ambito]` (la segunda llamada espera a la primera; se limpia en `finally`) y clasificación de error según R6 — `catalogo:desactualizado` ⇒ reléer inventario y reintentar **una vez**; `dimensiones:invalidas` / `archivo:*` / `directorio:no_escribible` ⇒ sin reintento; red ⇒ pendiente para la próxima apertura
- [ ] T016 [P] [US2] `modules/textmuy/js/fonts.js`: carga de preview para Google por **nombre de familia** (sin `wght@`, sin `text=`), concurrencia ≤ 4, espera 3 s, 1 reintento, y mapa de estado de preview **aislado** de `loadedFonts`/`loadingPromises` del render; preview de físicas con `FontFace` de su archivo (una por celda)
- [ ] T017 [P] [US2] Enganche de apertura en `modules/textmuy/js/galeria.js`, `modules/textmuy/js/fuentes-galeria.js` y `modules/textmuy/js/controls.js`: llamar `asegurarHojaCompleta` cuando la lectura canónica devuelva `null` o falten celdas, con progreso `Completando miniaturas: N/M…` y repintado al terminar
- [ ] T018 [US2] Retirar el botón "Generar miniaturas": quitar markup en `index.html`, listener en `modules/textmuy/js/fuentes-galeria.js` y regla `.tt-galpanel-gensprite` en `modules/textmuy/css/style.css`
- [ ] T019 [US2] Retirar el botón "Miniaturas": quitar markup en `index.html`, `generarMiniaturasPresets`/listener en `modules/textmuy/js/controls.js` (la generación queda en el flujo automático)
- [ ] T020 [US2] Estado de error con causa en las tres galerías (`modules/textmuy/js/galeria.js`, `fuentes-galeria.js`, `controls.js`): mostrar operación + ámbito + motivo exacto y botón **Reintentar** (solo en error); eliminar el mensaje genérico "No se pudo generar la hoja (sin puente o sin catalogo)"

### Tests

- [ ] T021 [P] [US2] Nueva suite `modules/textmuy/tests/hoja-generacion.test.js` (Node, stubs de `fetch`/`ThumbEngine`): (a) `fallos > 0` ⇒ **0** POST; (b) éxito ⇒ **1** POST con `firma` = inventario; (c) reentrancia: 2 llamadas ⇒ 1 POST; (d) `catalogo:desactualizado` ⇒ relée y 1 reintento; (e) causa propagada sin mensajes genéricos
- [ ] T022 [US2] Extender `modules/textmuy/tests/galerias.browser.js`: sin hoja ⇒ genera ⇒ **1** `POST op=sprite` ⇒ segunda apertura con 0 descargas de contenido (asserts de SC-002/SC-004)

### Validación manual

- [ ] T023 [US2] Validación manual E1/E3/E5/E7.1 en WordPress con evidencia registrada en `specs/009-galerias-sprite-unificado/quickstart.md` §2: E1 (generación + firma + dimensiones de hoja), E3 (alta ⇒ 1 celda ⇒ 1 escritura), E5 (causa exacta + Reintentar), E7.1 (dos pestañas ⇒ 1 escritura por ámbito); registrar SC-003 (≤ 5 MB / ≤ 60 s)

**Checkpoint**: el circuito completo (abrir sin hoja ⇒ generar ⇒ certificar ⇒ F5 sin descargas) funciona en las tres galerías.



---

## Phase 5: User Story 3 - Preview real de la tipografía elegida (Priority: P2)

**Goal**: al seleccionar una celda de tipografías, la celda se redibuja con su tipo real (1 archivo físico o 1 familia Google) y esa miniatura queda en la hoja (SC-005).

**Independent Test**: clic en una celda Google pendiente ⇒ 1 request `css2?family=…` (sin `wght@`, sin `text=`) ⇒ celda con tipo real ⇒ F5 la conserva sin descargas.

- [ ] T024 [US3] `modules/textmuy/js/fuentes-galeria.js::previewSeleccionada`: al seleccionar, si la celda está pendiente, esperar la carga (física: su archivo; Google: familia por nombre vía T016) y redibujar solo esa celda; estado intermedio visible en `status` sin romper la selección
- [ ] T025 [US3] `modules/textmuy/js/fonts.js`: exponer la carga de preview por nombre de familia y garantizar el aislamiento del mapa de preview vs el mapa del render (un preview `ok` NO debe hacer que `loadFont(spec)` omita su carga con el spec completo del inventario)
- [ ] T026 [US3] `modules/textmuy/js/api.js` + `modules/textmuy/js/fuentes-galeria.js`: cuando la familia elegida quede dibujada, agregar ese canvas a `dibujados` y, si no quedan pendientes, disparar F2 (una escritura) para que la celda quede persistida en la hoja
- [ ] T027 [P] [US3] Extender `modules/textmuy/tests/galerias.browser.js`: clic en celda Google ⇒ asserts de 1 request `css2` sin `wght@`/`text=`, celda con canvas real y persistencia posterior (1 `POST`) cuando no quedan pendientes
- [ ] T028 [US3] Validación manual E4 en WordPress con evidencia en `specs/009-galerias-sprite-unificado/quickstart.md` §2: clic en celda Google ⇒ tipo real; F5 ⇒ conservado sin descargas; con Google bloqueado ⇒ celda conserva el nombre con causa (SC-007)

**Checkpoint**: las tipografías Google dejan de verse todas iguales y su miniatura se conserva.

---

## Phase 6: User Story 4 - Celdas completas, proporcionales y legibles (Priority: P3)

**Goal**: geometría derivada de `thumbs`, 2 columnas en tipografías, celdas sin cortes (SC-006).

**Independent Test**: medir en navegador ⇒ 2 columnas de ~175 px y `height ≈ round(width × h/w) ± 2` tanto con miniatura como con nombre; 0 celdas cortadas.

- [ ] T029 [P] [US4] `modules/textmuy/js/catalog.js::geometriaTiles`: devolver el ratio **simplificado con MCD** (p. ej. `180/30 → 6 / 1`) manteniendo `w`, `h` y `col`; actualizar `modules/textmuy/tests/tile-geometria.test.js` (incluye el caso `180/30` y `200/100`)
- [ ] T030 [P] [US4] `modules/textmuy/css/style.css` (bloque `.tt-galpanel-*`): garantizar el alto completo del tile — `aspect-ratio: var(--tt-gal-ratio)` + defaults por `data-ambito` (fonts 6/1 · img 1/1 · presets 2/1) y, según la medición de T003/T032, corregir la causa del recorte (canvas con caja completa; borde de 1 px en tiras de tipografías)
- [ ] T031 [US4] Extender `modules/textmuy/tests/galerias.browser.js` con el contrato medible: `clientHeight ≈ round(clientWidth × h/w) ± 2`, 2 columnas en fuentes, misma geometría con placeholder y con canvas, y `100/100` / `200/100` en las otras dos galerías
- [ ] T032 [US4] Registrar la medición "antes" (T003) vs "después" (T031) en `quickstart.md` §2 E6 (evidencia de SC-006) e identificar/documentar la causa raíz hallada del recorte a mitad de alto

**Checkpoint**: la galería de tipografías se ve legible y sin celdas cortadas en el panel real.



---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: documentación, caché y cierre de puertas (SC-008, SC-010).

- [ ] T033 [P] Actualizar `modules/textmuy/AGENTS.md`: invariante "abrir = 0 descargas" acotado a "con hoja certificada"; generación automática de huecos; retiro de los botones de generación; geometría con ratio simplificado; Google por familia única
- [ ] T034 [P] Sync Impact Report en `.specify/memory/constitution.md` (PATCH: aclaración de lectura/generación de hojas para los 3 ámbitos y regla de "una escritura por apertura"), sin cambio de contrato del puente
- [ ] T035 Bump `?v=RCn` en `modules/textmuy/index.html` y `modules/textmuy/render-core.html` (+ `css/style.css?v=`) y actualizar la versión vigente en `modules/textmuy/AGENTS.md` §4.6 (Ctrl+F5 al probar)
- [ ] T036 Correr `quickstart.md` §1 completo y §4 (mapeo SC→evidencia); actualizar `specs/INDICE.md` (mover 009 de "En especificación" a "Activos" con su pendiente manual WP real, si el recorrido queda completo)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sin dependencias.
- **Phase 2 (Foundational)**: depende de Setup — **bloquea US1–US4** (sin certificación de `fonts`/`tm-presets` no hay lectura posible).
- **Phase 3 (US1)**: depende de Phase 2; habilita el estado "listo" y los placeholders base.
- **Phase 4 (US2)**: depende de US1 (necesita la lectura canónica y el estado `listando`).
- **Phase 5 (US3)**: depende de US2 (usa el núcleo de dos fases y el mapa de preview de T016).
- **Phase 6 (US4)**: independiente de US2/US3 (solo CSS + `catalog.js`), puede hacerse en paralelo tras US1.
- **Phase 7 (Polish)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: base del comportamiento; ningún requisito propio más allá de Phase 2.
- **US2 (P2)**: requiere US1; entrega el circuito completo de corrección.
- **US3 (P2)**: requiere US2 (F1/F2 + T016); sin US2 el preview no persiste.
- **US4 (P3)**: independiente (CSS/geometría); puede ir en paralelo a US2/US3.

### Within Each User Story

- Núcleo (`api.js`) → enganches de galería → retiros de UI → tests → validación manual.
- No cerrar una historia sin su validación manual de `quickstart.md`.

### Parallel Opportunities

- T002/T003 (Setup) en paralelo.
- T006/T007 (motor de pruebas) en paralelo tras T004/T005.
- T009/T010/T011 (galerías distintas) en paralelo.
- T016 (fonts.js) en paralelo con T014/T015 mientras se diseñan los enganches.
- T029/T030 en paralelo (catalog.js y style.css son archivos distintos).
- T033/T034/T035 en paralelo (documentación y bumps).


---

## Parallel Example: User Story 1

```bash
# Tras Phase 2, las tres galerías se ajustan en paralelo (archivos distintos):
Task: "fuentes-galeria.js: placeholders + drawTileCanonico"      # T009
Task: "galeria.js: lectura canónica sin reconstrucción"          # T010
Task: "controls.js: presets solo lectura"                        # T011
```

## Parallel Example: User Story 2

```bash
# Núcleo y carga de preview en paralelo (archivos distintos):
Task: "api.js: asegurarHojaCompleta (dos fases + reentrancia)"   # T014+T015
Task: "fonts.js: preview Google por nombre, concurrencia 4"      # T016
```

## Implementation Strategy

### MVP (circuito de la corrección)

1. Phase 1 (Setup) + Phase 2 (Foundational): el motor certifica hojas para los 3 ámbitos.
2. Phase 3 (US1) + Phase 4 (US2): lectura canónica + generación automática ⇒ **abrir sin hoja ⇒ generar ⇒ F5 sin descargas** en las tres galerías.
3. **STOP y VALIDAR** con `quickstart.md` E1/E2/E3/E5/E7 (SC-001…004, SC-007, SC-009).

> Nota: US1 sola no produce hojas nuevas (solo lee las certificadas); el valor de usuario completo de esta corrección llega con US2. Por eso el MVP sugerido es US1+US2 (Phase 2→4).

### Incremental

1. US4 (geometría) puede entregarse en paralelo al MVP — es CSS/`catalog.js`, sin dependencias de US2.
2. US3 (preview Google persistido) cierra la última queja funcional (tipografías indistinguibles) y reutiliza lo de US2.
3. Phase 7: documentación + bumps + corrida completa de puertas.

### Validación final (SC-008/SC-010)

`php -l` + `motor_smoke` + `parity` + `texto_puente`; `node --check` + suites del módulo (16 vigentes + `hoja-generacion.new` + extensiones de navegador); recorrido manual de `quickstart.md` §2; AGENTS/constitución/INDICE coherentes.

## Notes

- [P] = archivos distintos, sin dependencias entre sí.
- Cada historia se valida con su sección de `quickstart.md` antes de pasar a la siguiente.
- No hay tareas de "escribir el test antes": los tests amplían suites existentes y se ejecutan al cerrar cada historia.
- El contrato del puente NO cambia (payload de `op=sprite` intacto): el despliegue es conjunto plugin+módulo por el alcance de la validación server-side, no por cambios de forma.
- Al tocar JS/CSS del módulo: bump `?v=RCn` en ambos HTML (T035) y Ctrl+F5 para probar.


