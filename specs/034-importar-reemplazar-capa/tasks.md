# Tasks: Importar página/capa y reemplazar capa/grupo manteniendo transformación

**Feature**: 034-importar-reemplazar-capa · **Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md)
**Estado**: en curso (2026-10-26)

## Convenciones

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1..US4 (del spec); Setup, Puertas y Cierre no llevan etiqueta
- Cada tarea nombra su archivo y su FR/decisión

## Path Conventions

Proyecto único (plugin de WordPress): `personalizador-pdf.php`, `admin/`, `assets/`, `engine/`, `inc/`, `tests/`, `specs/`.

---

## Phase 1 (F0): Setup

- [X] T001 [P] Puertas base en verde antes de tocar nada: `php -l personalizador-pdf.php`, `php -l assets/mockups.js`, `php -l assets/mockup-render.js`, `node tests/mockup-contrato.test.js` (147), `node tests/mockup-geometria.test.js` (135), `php tests/motor_smoke.php`, `php tests/parity.php` — **hecho**: todo en verde
- [X] T002 [P] Auditoría de anclas: qué indexan las fases `mockups`/`mockup_capas`/`mockup_pagina` sobre `importarPagina`, `seleccionarCapa`, `puntosTiradoresPerspectiva`, `asignarPerspectiva`, `puntosPerspectiva` — **hecho**: el arnés no indexa el markup del importador; las fases cubren guardado, capas y geometría de página, así que la fase nueva es aditiva

## Phase 2 (F1): Decisión pura (US1)

**Goal**: `debeReemplazar()` aislada y testeable · **Independent Test**: casos construidos

- [X] T003 [US1] `assets/mockups.js`: función pura `debeReemplazar()` → `{reemplazar, destino, esGrupo}` con las 4 reglas (sin selección / una capa / grupo / varias sin grupo) (FR-001/003/004, R2, INV-1..3) — **hecho**
- [X] T004 [US1] Puerta de la decisión: 6 checks nuevos en `tests/mockup-contrato.test.js` (debeReemplazar existe y usa `indicesSeleccionados`; `importarPagina` la llama; la rama de reemplazo no reasigna geometría; la rama de alta sigue existiendo; el grupo se itera por `c.grupo === gid`) → **CONTRATO OK (153 checks)**. **Nota**: el arnés PHP no puede ejecutar JS del cliente, así que la puerta canónica es el contrato Node (no se crea fase en `texto_puente.php`)

## Phase 3 (F2): Importar con reemplazo (US1/US2)

**Goal**: `importarPagina()` reusa la geometría del destino · **Independent Test**: geometría intacta tras reemplazar

- [X] T005 [US1] `assets/mockups.js`: `importarPagina()` llama a `debeReemplazar()` y, si `reemplazar`, sustituye la(s) capa(s) destino conservando `x/y/w/h/rot/sesgo/filtros/modo/nombre/oculta/bloqueada/grupo/grupo_rot/perspectiva` y cambiando solo `ref` (+ `tipo: img`, `envoltura: false`) (FR-002, D1, R1) — **hecho**
- [X] T006 [US1] `assets/mockups.js`: si el destino es un **grupo**, iterar todos los miembros con el mismo `grupo` (FR-002, R3) — **hecho** (rama `esGrupo` con `indicesAReemplazar`)
- [ ] T007 [US1] `assets/mockups.js`: si el destino está `bloqueada`, avisar y no reemplazar (FR-001, R5) — **PENDIENTE**: hoy el importador no verifica `bloqueada` (el editor sí lo respeta al mover/redimensionar)
- [X] T008 [US2] `assets/mockups.js`: verificar que el reemplazo con imagen del catálogo usa `ref: 'mock:<id>'` y `tipo: 'img'` (FR-007, R7) — **hecho**: `c.ref = 'mock:' + imagen.id`, `c.tipo = 'img'`, `c.envoltura = false`
- [X] T009 [US1] Verificación de geometría: `tests/mockup-contrato.test.js` (la rama de reemplazo no reasigna `x/y/w/h/rot`) + **recorrido en el lab 6/6** (`C:\wp-lab\probe-034-reemplazo.cjs`): R1 geometría intacta (127/29/39/39/0 → igual), capas 16→16, `ref` pasa a `mock:3`, aviso "Pagina reemplazada en la capa seleccionada"; R3 sin selección agrega (16→32); config del lab restaurado

## Phase 4 (F3): Perspectiva por capa individual (US3)

**Goal**: la UI expone los 4 puntos también para una capa sola · **Independent Test**: fase `mockup_capas`

- [ ] T010 [US3] `assets/mockups.js`: mostrar los controles de perspectiva cuando hay **una** capa seleccionada (hoy `esGrupoPersistido()` exige ≥2 y mismo `grupo`) (FR-005, R3)
- [ ] T011 [US3] `tests/texto_puente.php` fase `mockup_capas`: perspectiva por capa individual persiste y se lee
- [ ] T012 [US3] `node tests/mockup-contrato.test.js`: check de que el editor cablea la rama individual (sin romper la de grupo)

## Phase 5 (F4): Puertas

- [X] T013 Puerta de la 034 registrada: los 6 checks viven en `tests/mockup-contrato.test.js` (el arnés PHP no ejecuta JS del cliente) — **hecho** (153 checks). No se agregó fase a `texto_puente.php` porque no hay nada server-side nuevo
- [X] T014 Puertas en verde: `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js` (153), `node tests/mockup-geometria.test.js` (135), `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php mockups mockup_capas mockup_pagina` — **hecho**: todo en verde

## Phase 6 (F5): Lab y cierre

- [X] T015 Recorrido **R1/R3** en `C:\wp-lab` (`probe-034-reemplazo.cjs`, **6/6**): reemplazo de capa individual con geometría intacta y `ref` cambiado; sin selección agrega; config restaurado. **Pendientes del recorrido**: R2 (grupo), R4/R5 (perspectiva), R7 (varias sin grupo), R8 (bloqueada) — dependen de T007/T010
- [X] T016 [P] `AGENTS.md` §7 (entrada de la spec 034) + `admin/ayuda.php` (documentar el reemplazo de capa y la perspectiva por capa) — **hecho**: §7 con la entrada y el card de ayuda
- [~] T017 `specs/INDICE.md` al día, `tasks.md` al día, bump de versión y **push previo visto bueno** — **hecho**: INDICE y tasks al día + bump a **4.25.0**; **pendiente: el push** (requiere visto bueno) y las tareas T007/T010-T012 (bloqueada + perspectiva por capa)

---

## Dependencies & Execution Order

- **F0** (T001-T002): primero.
- **F1** (T003-T004): bloquea a F2.
- **F2** (T005-T009): depende de F1.
- **F3** (T010-T012): independiente de F2 en código, pero comparte `mockups.js` → secuencial.
- **F4/F5**: puertas, lab y cierre.
- **Regla de oro**: el contrato se actualiza en el mismo commit que la fase; nunca se borra cobertura sin reemplazo.
