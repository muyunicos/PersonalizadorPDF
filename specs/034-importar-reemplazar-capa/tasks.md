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
- [X] T007 [US1] `assets/mockups.js`: si el destino está `bloqueada`, avisar y no reemplazar (FR-001, R5) — **hecho**: el helper `aplicarReemplazo()` devuelve `null` con aviso en `.ec-mk-alertas` y `importarPagina()` lo publica en `.ec-mk-importar-estado` (ese contenedor no lo pisa el render). Lab **R8 OK**: `ref` intacto (`mock:3` → `mock:3`) + aviso "La capa destino esta bloqueada; desbloqueala para reemplazarla."
- [X] T008 [US2] `assets/mockups.js`: verificar que el reemplazo con imagen del catálogo usa `ref: 'mock:<id>'` y `tipo: 'img'` (FR-007, R7) — **hecho**: `c.ref = 'mock:' + imagen.id`, `c.tipo = 'img'`, `c.envoltura = false`
- [X] T009 [US1] Verificación de geometría: `tests/mockup-contrato.test.js` (la rama de reemplazo no reasigna `x/y/w/h/rot`) + **recorrido en el lab 6/6** (`C:\wp-lab\probe-034-reemplazo.cjs`): R1 geometría intacta (127/29/39/39/0 → igual), capas 16→16, `ref` pasa a `mock:3`, aviso "Pagina reemplazada en la capa seleccionada"; R3 sin selección agrega (16→32); config del lab restaurado

## Phase 4 (F3): Perspectiva por capa individual (US3)

**Goal**: la UI expone los 4 puntos también para una capa sola · **Independent Test**: fase `mockup_capas`

- [X] T010 [US3] `assets/mockups.js`: mostrar los controles de perspectiva cuando hay **una** capa seleccionada — **hecho**: nueva `puedePerspectiva(indices)` (1 capa o grupo persistido) usada en los **3** sitios (tiradores del lienzo, hit-test y panel Ajustes); `reset-perspectiva` acepta `>= 1`. En `assets/mockup-render.js` la clave pasa a `g:{gid}` / `i:{indice}` y se admite `items.length >= 1`, así una capa sin `grupo` se deforma igual (FR-005, R3). Lab **R4/R5 OK**
- [X] T011 [US3] Verificación de persistencia/lectura — **hecho**: `php tests/texto_puente.php mockup_capas` en verde + lab **R4** (una capa sin `grupo` con `perspectiva` se dibuja: 25.171 px opacos, sin `pageerror`) y **R5** (panel con "Restablecer perspectiva" y texto "esta capa"). No se agregó fase PHP nueva: la perspectiva es 100% cliente
- [X] T012 [US3] `node tests/mockup-contrato.test.js`: check del cableado individual — **hecho**: `T010: la perspectiva tambien se aplica a una capa sin grupo` (+ el check histórico de los 4 controles ahora verifica `puedePerspectiva(seleccion)`) → **CONTRATO OK (157 checks)**

## Phase 5 (F4): Puertas

- [X] T013 Puerta de la 034 registrada: los 6 checks viven en `tests/mockup-contrato.test.js` (el arnés PHP no ejecuta JS del cliente) — **hecho** (153 checks). No se agregó fase a `texto_puente.php` porque no hay nada server-side nuevo
- [X] T014 Puertas en verde: `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js` (153), `node tests/mockup-geometria.test.js` (135), `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php mockups mockup_capas mockup_pagina` — **hecho**: todo en verde

## Phase 6 (F5): Lab y cierre

- [X] T015 Recorrido en `C:\wp-lab` — **R1/R3 6/6** (`probe-034-reemplazo.cjs`) y **R4/R5/R8 7/7** (`probe-034b.cjs`): geometría intacta (127/29/39/39/0), capas 16→16, `ref` a `mock:3`, sin selección agrega (16→32), perspectiva individual dibujada (25.171 px) y ofrecida en Ajustes, capa bloqueada intacta con aviso. Config restaurado desde `.bak-034`/`.bak-034b`. **R2 (grupo) y R7 (varias sin grupo)** quedan cubiertos por el contrato Node (`esGrupo`/primera como destino), no por lab
- [X] T016 [P] `AGENTS.md` §5 (perspectiva del grupo **o de una capa individual**) + `admin/ayuda.php` (reemplazo de capa, capa bloqueada y perspectiva) — **hecho**
- [X] T017 `specs/INDICE.md` al día, `tasks.md` al día y bump — **hecho** (versión **4.26.0**). **Pendiente: el push** (requiere visto bueno; dispara deploy)

---

## Dependencies & Execution Order

- **F0** (T001-T002): primero.
- **F1** (T003-T004): bloquea a F2.
- **F2** (T005-T009): depende de F1.
- **F3** (T010-T012): independiente de F2 en código, pero comparte `mockups.js` → secuencial.
- **F4/F5**: puertas, lab y cierre.
- **Regla de oro**: el contrato se actualiza en el mismo commit que la fase; nunca se borra cobertura sin reemplazo.
