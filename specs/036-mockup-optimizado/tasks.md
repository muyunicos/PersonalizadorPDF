# Tasks: Ficha optimizada (036)

**Input**: `specs/036-mockup-optimizado/` (spec, plan, research, data-model, contracts, quickstart)

**Prerequisites**: `plan.md` (fases F0-F5), `spec.md` (D1-D11 + §3 contrato + §7 pendientes), `research.md` (R1-R10), `data-model.md`, `contracts/ficha-red.md` (C1-C5), `quickstart.md` (E1-E4)

**Tests**: **obligatorios**. El repo no tiene tests opcionales: cada fase cierra con `php -l`/`node --check` y la puerta de su area (`AGENTS.md` §9). Se incluyen como tareas propias.

**Organization**: la spec **no usa user stories formales** (esta organizada por decisiones D1-D11 y fases F0-F5 del plan). Para implementar y validar por incrementos se derivan **4 historias de valor**:

| Historia | Valor | Fase del plan |
|---|---|---|
| **US1** (P1) | El comprador abre la ficha y **no descarga de mas** | F1 (D7) |
| **US2** (P1) | El mockup del cliente **se ve igual** que el del admin, pero se sirve **aplanado** | F2 (D10) |
| **US3** (P1) | Se compra sabiendo que **TODO subio** (cola + gate) | F3 (D9/D8) |
| **US4** (P2) | La galeria **se monta sola** (sin boton) y se **repinta** | F4 (D3/D4) |
| Foundational | Enmienda de `constitution` §I + predicado unico "completo" | F0 |
| Polish | Docs, indice y version | F5 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencia de tareas incompletas)
- **[Story]**: US1/US2/US3/US4 (solo en fases de historia)
- Rutas relativas a la raiz del repo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: verificar la base y dejar los esqueletos de las puertas nuevas

- [X] T001 Correr las puertas base y confirmar verde: `php -l personalizador-pdf.php`, `Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }`, `node --check assets/tienda.js`, `node --check assets/fotos-pmu.js`, `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js`, `node tests/mockup-geometria.test.js`, `node tests/vistas-contrato.test.js`, `php tests/motor_smoke.php`, `php tests/parity.php`
- [X] T002 [P] Crear los `case` vacios de las fases nuevas en `tests/texto_puente.php`: `red_carga`, `aplanado`, `cola_subida` (deben correr sin error antes de implementar)
- [X] T003 [P] Crear el esqueleto de `tests/cola-subida.test.js` (debe correr y decir `COLA SUBIDA OK (0 checks)`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la enmienda de gobernanza y el predicado unico. **Sin esto, ninguna historia cierra.**

**⚠️ CRITICAL**: ninguna historia empieza hasta que esta fase cierre.

- [X] T004 Enmendar `constitution` §I: reemplazar el flujo "boton Vista previa + leyenda; al pulsarlo se oculta el boton; **sin live re-render**" por el **auto-montaje** y el **repintado al editar**; agregar el bloque **Sync Impact Report** y subir la version a **4.0.0** (MAJOR)
- [X] T005 Registrar la enmienda y la decision del negocio (Clarification Q1) en `docs/decisiones.md` (entrada 2026-11-02, spec 036)
- [X] T006 Definir el **predicado unico "completo"** en `assets/tienda.js`: `minimos` satisfechos (`assets/tienda.js:1837`) **y** `PMU_FICHA.subidas.pendientes() == 0` (`:1702`) **y** validez OK; lo consumen el auto-montaje (US4) y el gate del boton (US3)

**Checkpoint**: gobernanza alineada y predicado listo.

---

## Phase 3: User Story 1 - Red al cargar la ficha (Priority: P1, D7) 🎯 MVP

**Goal**: al abrir la ficha solo se descarga lo que se va a usar.

**Independent Test**: E1 de `quickstart.md` (0 peticiones de imagenes del cliente y 0 carga de `render-core.html` sin interaccion).

- [~] T007 ~~Volver condicional el encolado en `personalizador-pdf.php` (`assets_ficha_condicional()`, ~`:814`): `assets/biblioteca-pmu.js`/`assets/visor-pmu.js` **no** se encolan si el PDF no tiene campos de imagen~~ — **NO se hace** (ver nota): el requerimiento del negocio es de **DATOS** (0 descargas de imagenes del comprador) y se cubre en **T008**; volver condicionales/lazy esos scripts rompe el grafo de dependencias de WP (`cargador`/`tienda` dependen de `visor`) y la decision SINCRONICA del modal (spec 030 4a, `selector-pmu.js:775`) sin beneficio medido (una ficha con campos los carga igual).
- [X] T008 [US1] Quitar/condicionar el "calentado" de la biblioteca para que las **imagenes del cliente** se pidan **solo** al abrir el modal (`assets/tienda.js` + `assets/biblioteca-pmu.js`)
- [X] T009 [US1] Condicionar la carga del motor minimo de texto en `assets/tienda.js` (`renderCore()`, `:778`): **no** instanciar `modules/textmuy/render-core.html` si el PDF no tiene ningun campo de tipo `texto` — **YA cumplido** (lazy desde la 011): `renderCore()` solo corre bajo `nuevos.length` (`assets/tienda.js:1547-1551`). T010 lo fija con una puerta.
- [X] T010 [US1] Fase `red_carga` en `tests/texto_puente.php`: el panel no encola la biblioteca sin campos de imagen y no arranca el motor de texto sin campo `texto`
- [X] T011 [US1] Extender `tests/ficha-pedido.browser.js` con E1 (0 red al cargar; las miniaturas del comprador aparecen al abrir el modal)
- [X] T012 [US1] Gate: `php -l personalizador-pdf.php` + `node --check assets/tienda.js` + `node tests/ficha-pedido.browser.js` en verde

**Checkpoint**: US1 entregable sola (menos red al abrir).

## Phase 4: User Story 2 - Mockup del cliente aplanado (Priority: P1, D10)

**Goal**: el mockup del cliente se ve igual que el del admin, pero se sirve como **1 bitmap** + placeholders.

**Independent Test**: E2 de `quickstart.md` (aparece `pdfs/{nombre}/mockups/{mockup_id}.webp`; la ficha hace **1** descarga por mockup; al editar capas se regenera).

- [X] T013 [US2] Aplanar en el editor: en `assets/mockups.js`, al guardar, exportar a **WebP** la composicion de las capas `tipo: img` **visibles** (filtros/efectos/deformaciones incluidos) y subirla con el guardado (usa el Canvas ya existente; sin render nuevo)
- [X] T014 [US2] Servidor: en `personalizador-pdf.php` (handler de mockups, ~`:5393-5430`) guardar el aplanado en `pdfs/{nombre}/mockups/{mockup_id}.webp` con el **id saneado** (`nombre_seguro`); no romper si falta
- [X] T015 [US2] Ficha: en `assets/tienda.js` `componerMockup()` (`:907`) pasar a `PMUMockup.componer` **1** capa `img` (el aplanado) + los `placeholder`; degradar con **causa visible** si el bitmap falta — **hecho con FALLBACK**: sin aplanado (mockup aun sin regenerar) se conserva la composicion por capas, asi que ningun mockup existente se rompe; el servidor publica `aplanado: null` y el bitmap se regenera al guardar. Nota: el servidor **excluye** el `{id}.webp` de la lista de fotos del admin (`mockup_fotos_lista`) para que el artefacto no figure ni se pueda borrar como foto.
- [X] T016 [US2] Regeneracion: el aplanado se **reescribe** en cada guardado de capas (cubre mover/cambiar una capa y guardar)
- [X] T017 [US2] Fase `aplanado` en `tests/texto_puente.php`: la ruta es `pdfs/{nombre}/mockups/{mockup_id}.webp`; un id invalido se rechaza; ausente no rompe
- [X] T018 [US2] Gate: `node --check assets/mockups.js` + `node tests/mockup-contrato.test.js` + `php tests/texto_puente.php aplanado` en verde

**Checkpoint**: US2 entregable sola (mockup servido aplanado).

---

## Phase 5: User Story 3 - Cola de subida y gate del boton (Priority: P1, D9/D8)

**Goal**: se sube todo en segundo plano y el boton se habilita recien al vaciarse la cola.

**Independent Test**: E3 de `quickstart.md` (con varias imagenes y textos el boton esta **deshabilitado** mientras hay pendientes; cambiar un texto **reemplaza** la version anterior).

- [ ] T019 [US3] Cola en `assets/fotos-pmu.js` (`PMUFotos.crearCola`): concurrencia **acotada**, orden **FIFO**, **dedupe** por `sha` y **reintentos** con backoff
- [ ] T020 [US3] "Ultima version manda": **serializar** las subidas de una misma creacion (`pdf`-`gid`-`indice`) y **reemplazar** la anterior (en `assets/tienda.js` `subirPool` `:864` + `assets/fotos-pmu.js`)
- [ ] T021 [US3] Subir las creaciones de TextMuy en **WebP** y al **cap maximo predefinido** (P7: mismo criterio que las fotos) en `assets/tienda.js` (`tipoDeBlob`/`subirPool`)
- [ ] T022 [US3] Gate del boton: agregar `subidas` a `bloqueos` y usarlo en `refrescarCarrito()` (`assets/tienda.js:615`/`:1092`) con `api.subidas.pendientes()`; habilitar **al vaciarse**
- [ ] T023 [US3] Puerta Node nueva `tests/cola-subida.test.js`: N archivos (concurrencia acotada, orden FIFO, dedupe, ultima version reemplaza)
- [ ] T024 [US3] Gate: `node tests/cola-subida.test.js` + `node tests/ficha-pedido.browser.js` (gate + ultima version) en verde

**Checkpoint**: US3 entregable sola (compra asegurada tras subir todo).

---

## Phase 6: User Story 4 - Galeria auto-montada y repintado (Priority: P2, D3/D4)

**Goal**: **no** hay boton "Vista previa"; la galeria se monta sola al completar los campos y se **repinta** al editar.

**Independent Test**: E4 de `quickstart.md` (al completar los `min` la galeria aparece **sin pulsar nada**; al editar un campo se repinta **en el lugar**).

- [ ] T025 [US4] Auto-montaje: en `assets/tienda.js` montar la galeria cuando el predicado "completo" (T006) pase, usando `generarVista()` (`:1607`); **quitar** el boton "Vista previa" (`:1865-1883`)
- [ ] T026 [US4] Repintado: con la galeria visible, **repintar** al cambiar un campo (no ocultar la galeria ni volver un boton); reusa el pintado progresivo (D1)
- [ ] T027 [US4] Tolerancia (D5): si el montaje falla, habilitar el carrito con el aviso actual ("podes comprar igual...")
- [ ] T028 [US4] Gate: `node tests/vistas-contrato.test.js` + `node tests/ficha-pedido.browser.js` (auto-montaje + repintado) en verde

**Checkpoint**: US4 entregable sola (ficha sin boton).

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: documentacion, indice y version (F5)

- [ ] T029 [P] Actualizar `AGENTS.md` §5 (mockup aplanado en `pdfs/{nombre}/mockups/{mockup_id}.webp`; red al cargar de la ficha) y §9 (puertas nuevas)
- [ ] T030 [P] Actualizar `specs/INDICE.md` con la 036 (estado + artefactos normativos)
- [ ] T031 Bump de version en la **cabecera** de `personalizador-pdf.php` (unica fuente, §10.bis) y en el `Stable tag` de `readme.txt`
- [ ] T032 Cierre: correr TODAS las puertas de `AGENTS.md` §9 + el recorrido del lab (`node tests/ficha-pedido.browser.js`) y registrar la evidencia en `quickstart.md` §5

---

## Fuera de estas tareas

- **P1 (plano de 2 caras)**: **no** entra; queda gateado a una medicion previa (`plan.md`, Fases).
- **P3 (alcance del auto-montaje)**: se cierra al implementar T025.
- **P7** (cap de tamano de las creaciones de TextMuy) y **P8** (convivencia del gate de "visto" con el de la cola): **supuestos** a confirmar en T021/T022.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **BLOQUEA** todas las historias (la enmienda de `constitution` §I es **previa** a implementar el auto-montaje).
- **Historias (Phases 3-6)**: dependen de Foundational. **US1, US2 y US3 son independientes entre si**; **US4** depende de US3 (el gate) y de US2 (el aplanado) para verse completa, aunque su montaje (T025) se puede hacer sobre la galeria ya existente.
- **Polish (Phase 7)**: depende de todas las historias deseadas.

### Within Each User Story

- Implementacion -> fase del arnes -> puerta del area (**nunca** el lint al final).

### Parallel Opportunities

- **Setup**: T002 y T003 (archivos distintos).
- **Polish**: T029 y T030 (docs distintos).
- **Con equipo**: US1, US2 y US3 pueden ir en paralelo despues de Foundational.

---

## Parallel Example: User Story 1

```powershell
# Esqueletos (Setup, ya hechos en T002/T003):
Task: "case vacios red_carga/aplanado/cola_subida en tests/texto_puente.php"
Task: "esqueleto COLA SUBIDA OK en tests/cola-subida.test.js"

# US1: encolado condicional y motor de texto (archivos distintos):
Task: "encolado condicional en personalizador-pdf.php (assets_ficha_condicional)"
Task: "carga condicional del motor de texto en assets/tienda.js (renderCore)"
```

---

## Implementation Strategy

### MVP First (Foundational + User Story 1)

1. Phase 1 (Setup) + Phase 2 (Foundational, **incluye la enmienda de `constitution`**).
2. Phase 3 (US1: red al cargar) -> **VALIDAR** con E1 -> deploy/demo.

### Incremental Delivery

1. Foundation (gobernanza + predicado unico).
2. US1 -> demo (**0 red** al abrir).
3. US2 -> demo (mockup **aplanado**).
4. US3 -> demo (**gate** de la cola).
5. US4 -> demo (**sin boton**, galeria auto-montada).
6. Polish -> docs + version.

---

## Notes

- **[P]** = archivos distintos, sin dependencia de tareas incompletas.
- **Un tema por commit**; commitear **solo** con el lint en verde y gateado
  (`if ($LASTEXITCODE -eq 0) { ... git commit ... }`).
- **Nunca** commitear con el lint en rojo; **no** hacer `push` sin aprobacion (dispara deploy).
- El **Motor no se toca**: `php tests/motor_smoke.php` + `php tests/parity.php` deben seguir verdes.
- Los datos de prueba se limpian al cerrar (`tmp/sesion-*`, `tmp/muestras/*`); **nunca** `orders/` ni `pdfs/`.