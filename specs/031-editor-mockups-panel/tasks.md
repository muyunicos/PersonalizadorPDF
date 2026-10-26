# Tasks: Rediseno del panel del editor de mockups (spec 031)

**Input**: Design documents from `/specs/031-editor-mockups-panel/`

**Prerequisites**: plan.md (Technical Context + Constitution Check), spec.md (US1-US8, FR-001..019,
SC-001..007, D1-D8), research.md (R1-R8), data-model.md (INV-1..5), contracts/editor-panel.md
(C-1..C-7), quickstart.md (E1-E7)

**Tests**: SI — el proyecto los exige como puertas: `node tests/mockup-contrato.test.js` (checks
actualizados a la nueva superficie), `node tests/mockup-geometria.test.js` (intacto), fases del arnes
`mockups*` / `mockup_capas` / `mockup_pagina` / `mockup_preview` de `tests/texto_puente.php`, y el
quickstart E1-E7 en el lab (`C:\wp-lab`).

**Organization**: las historias se derivan de la spec; cada una se implementa y se prueba sola
(quickstart E#).

| Historia | Prioridad | Valor | Prueba independiente |
|---|---|---|---|
| US1 — El lienzo siempre cabe | **P1 (MVP)** | el admin compone sin cortarse el lienzo ni arrancar en 200 % | E1 |
| US2 — Transformacion bajo el lienzo | P1 | los ajustes de la seleccion estan donde se mira el lienzo | E2 |
| US3 — 5 acordeones cerrados | P1 | el panel derecho no compite con el lienzo por espacio | E3 |
| US4 — Capas agrupadas por grupo | P2 | la estructura del mockup se ve (grupos, no filas sueltas) | E4 |
| US5 — Menu contextual + atajos | P2 | acciones de ciclo de vida sin llenar la barra; operable sin raton | E5 |
| US6 — Placeholders con importador | P2 | el importador vive donde tiene sentido; grupos plegados | E3 + E4 |
| US7 — Imagenes en su acordeon | P3 | galeria del catalogo reubicada, nada se pierde | E3 |
| US8 — Clip de capa + docs | P3 | paridad de tiradores y ayuda al dia | E6 + E7 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1..US8; Setup, Foundational, Puertas y Lab no llevan etiqueta
- Rutas exactas en cada tarea

## Path Conventions

Proyecto unico (plugin de WordPress): `personalizador-pdf.php`, `admin/`, `assets/`, `tests/`, `specs/`.

---

## Phase 1: Setup

**Purpose**: dejar el terreno listo sin tocar comportamiento

- [X] T001 [P] Verificar las puertas base en verde antes de tocar nada: `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js` (130 checks), `node tests/mockup-geometria.test.js` (135), `php -l personalizador-pdf.php`, `php tests/texto_puente.php mockups mockup_capas mockup_pagina mockup_preview` — **hecho**: CONTRATO 130 + GEOMETRIA 135 + las 4 fases OK
- [X] T002 [P] Auditoria de anclas (R5): `Select-String` de `ec-mk-`, `data-mk`, `data-acc` sobre `tests/mockup-contrato.test.js` y `tests/texto_puente.php` → lista exacta de anclas que indexan markup que se elimina/muda (`data-mk="agrupar"`, `add-catalogo`, `add-placeholder`, `subir`, `bajar`, `.ec-mk-panel-props` como panel derecho) — **hecho**: el arnes NO indexa markup (cero anclas); en el contrato se rompen a proposito `data-mk="agrupar|desagrupar"` + `data-mk="add-catalogo">+ Imagen` + el `<h4>Placeholders</h4>`, y ademas aparecio un tercero no previsto: el titulo del panel Placeholders
- [X] T003 [P] Preparar el lab: backup de `C:\wp-lab\...\pdfs\circulo6cm\config.json`; adaptar `probe-tirador-dibujo.cjs` para medir tinta del tirador de **capa** en el borde (E6); confirmar env Playwright (`NODE_PATH`, `TEXTMUY_CHROME`) — **hecho**: `config.json.bak-031` creado; probes `probe-031-e1/e2/e3/e4.cjs` escritos; env Node 22 + Chrome OK

---

## Phase 2: Foundational (bloquea TODAS las historias)

**Purpose**: CSS base, zoom y los dos nodos nuevos (acordeon propio + menu contextual)

**CRITICAL**: ninguna historia empieza hasta cerrar esta fase

- [X] T004 [US1] `assets/admin.css`: `.ec-mk-izq { min-width: 300px }` (contenido) con regla de padding horizontal 0 por debajo de 325 px de ancho util; conservar el degradado a una columna < 1100 px vigente (FR-001/002, R7) — **hecho** (`@media (max-width: 325px)`)
- [X] T005 [US1] `assets/mockups.js`: `estado.zoom = 1` (era 2, linea 49); `pintarZooms` ya marca el seleccionado (FR-001) — **hecho**
- [X] T006 [US3] `assets/admin.css`: estilos de `.ec-mk-acordeon` (`details`/`summary`, basado en `.ec-acordeon` de admin.css 59-84 pero **clase propia** para no disparar el confirm de mockups.js:2460) (FR-004, C-4) — **hecho** (mas `.ec-mk-acordeon-cuerpo`)
- [X] T007 [US5] `assets/mockups.js` + `assets/admin.css`: nodo unico `.ec-mk-menu-ctx` (`role="menu"`, items `[data-ctx]`, `aria-disabled`), posicionamiento clamped al panel derecho, cierre por fuera/Esc/scroll (FR-008/014, R2) — **hecho en parte**: nodo + estilos con z-index 185000; los items y el cierre llegan en la Fase 7

**Checkpoint**: grid con min-width, zoom 100 %, acordeon y menu base listos; el editor sigue funcionando (el re-layout de markup viene por fase)

---

## Phase 3: User Story 1 - El lienzo siempre cabe (P1) MVP

**Goal**: el lienzo de 300 px se ve entero a zoom inicial 100 %, en dos columnas y en el degradado

**Independent Test**: quickstart **E1** (medir ancho del panel izq, del canvas y del select de zoom en 1280/1366 px y en < 1100 px)

- [X] T008 [US1] Correr E1 en el lab y registrar medidas (lienzo entero, zoom 100 %, padding 0 < 325 px); ajustar T004 si el grid sigue aplastando (FR-001/002) — **hecho**: E1 10/10 (canvas 300 css y backing 300 en 1280/1366/900; panel izq 562/744)

---

## Phase 4: User Story 3 - 5 acordeones cerrados (P1)

**Goal**: el panel derecho son 5 acordeones independientes, cerrados por defecto, con el contenido vigente reubicado

**Independent Test**: quickstart **E3** (5 cerrados al abrir; dos abiertos a la vez; contenido vigente)

- [X] T009 [US3] `assets/mockups.js` `plantilla()`: convertir los 5 paneles en `details.ec-mk-acordeon` cerrados, orden fijo (vistas-del-pdf, capas, ajustes, imagenes, placeholders); migrar el contenido de `.ec-mk-panel` (FR-004) — **hecho**
- [X] T010 [US3] Vistas del PDF: titulo (`.ec-mk-titulo`) arriba, galeria `.ec-mk-mockups` en el medio, acciones al pie (`data-mk="nuevo|duplicar|eliminar-mockup"` + `.ec-mk-omisible`) (FR-005) — **hecho**
- [X] T011 [US3] Acordeon Ajustes: filtros por capa (AJUSTES), encuadre, perspectiva 4 puntos + restablecer — contenido numerico/filtros del panel Propiedades vigente; el bloque numerico de transformacion **baja** en la Phase 5 (FR-011, D1) — **hecho**: nodo `.ec-mk-ajustes` + `.ec-mk-props-aj` + vacio propio; la particion (numericos bajo el lienzo / ajustes en el acordeon) se cerro en la Fase 5
- [X] T012 [US3] quickstart E3 en el lab; verificar que plegar un acordeon **no** dispara el confirm de cambios sin guardar (C-4) — **hecho**: E3 12/12; la clase propia `.ec-mk-acordeon` no es atrapada por el handler de `.ec-acordeon > summary`

---

## Phase 5: User Story 2 - Transformacion bajo el lienzo (P1)

**Goal**: x/y/ancho/alto/rot + alinear (6) + distribuir (2) viven bajo el lienzo, visibles solo con seleccion

**Independent Test**: quickstart **E2**

- [X] T013 [US2] `plantilla()`: `.ec-mk-panel-props` + los bloques `.ec-mk-alin` (6 botones `data-pos`) y `.ec-mk-dist` (2 botones `data-eje`) se mudan de `.ec-mk-der`/panel Capas a `.ec-mk-izq`, justo despues de `.ec-mk-lienzo` y antes de `.ec-mk-ayuda` (FR-003, R8) — **hecho** (en `.ec-mk-transformar`, con el bloque oculto hasta que hay seleccion)
- [X] T014 [US2] Verificar `pintarProps()` (toggle `hidden` + fill, mockups.js 1276-1283) y los handlers delegados (`data-pos`, `data-eje`, inputs `.ec-mk-props`) intactos — traslado markup-only; quitar los bloques mudados del panel Capas (FR-003/004, C-5) — **hecho**: handlers intactos; `pintarProps()` partido en geometria + `pintarAjustes()` (nuevo nodo), `refrescar()` llama a ambas. **Hallazgo**: alinear opera sobre la capa ACTIVA (`[estado.seleccion]`), semantica vigente de la spec 011 que T014 manda no tocar (va como posible ajuste aparte)
- [X] T015 [US2] quickstart E2: el bloque aparece con seleccion y se oculta sin ella; cambiar un numero redibuja; Centro H y Distribuir H con 3 capas dan la geometria esperada — **hecho**: E2 13/13 (Alt+clic individual, grupo de 16 por clic simple, Centro H deja la capa activa en 150, Distribuir H mueve las 16 capas al config autoguardado)

---

## Phase 6: User Story 4 - Capas agrupadas por grupo (P2)

**Goal**: la lista de capas agrupa visualmente por `capa.grupo` (acordeon por grupo + seccion Sin grupo) y pierde los botones sobrantes

**Independent Test**: quickstart **E4**

- [X] T016 [US4] `pintarCapas()`: agrupacion visual — seccion `.ec-mk-sueltas` arriba (capas sin `grupo`) + `details.ec-mk-grupo-capas` por grupo (summary = marca + "N capas", zona de seleccion del grupo; cuerpo = filas miembro con ▲▼◻🔒); el array, el orden z y `moverCapa` **no cambian** (FR-006, R1, INV-1) — **hecho**: fila extraida a `filaCapa()` (una sola definicion); la cabecera selecciona el grupo entero y NO pliega (el plegado tiene chevron propio, con estado transitorio que sobrevive al repintado)
- [X] T017 [US4] Eliminar `+ Imagen` (`data-mk="add-catalogo"`) y `+ Placeholder` (`data-mk="add-placeholder"`) del panel Capas (FR-007, D6) — **hecho** (markup + ramas del dispatcher; agregar es por clic en el item del catalogo / en la instancia del PH)
- [X] T018 [US4] Eliminar la barra duplicada de Capas (`data-mk="subir|bajar|duplicar-capa|borrar-capa|agrupar|desagrupar"`); los ▲▼ de fila (`data-acc`) quedan (FR-007/008/010, R5) — **hecho**: fuera del markup y del dispatcher; las funciones (`duplicarCapa`, `borrarCapa`, `agruparSeleccion`, `desagruparSeleccion`) quedan y se invocaran desde el menu contextual (Fase 7)
- [X] T019 [US4] quickstart E4: grupo importado = acordeon con miembros; clic en cabecera selecciona el grupo; Alt+clic selecciona miembro; ▲▼ reordena en z global; agregar desde Imagenes/Placeholders con un clic — **hecho**: E4 11/11 (incluye el plegado/desplegado del chevron). **Hallazgo de UI**: el boton `×` del item del catalogo intercepta el clic central del item (se apunta al texto para agregar); reportado para la galeria de la Fase 9

---

## Phase 7: User Story 5 - Menu contextual y atajos (P2)

**Goal**: Duplicar/Quitar/Agrupar/Desagrupar/Ocultar/Bloquear por clic derecho (y boton `...`), con atajos vigentes

**Independent Test**: quickstart **E5**

- [ ] T020 [US5] Apertura: `contextmenu` en `.ec-mk-capa` (fila) y en la cabecera del acordeon de grupo; el menu se construye sobre `.ec-mk-menu-ctx` con items `[data-ctx]` y estado (`aria-disabled` cuando no aplica: Agrupar con < 2 seleccionables, Desagrupar sin grupo) (FR-008, R2/R3)
- [ ] T021 [US5] Acciones: cada item llama a la funcion vigente (`duplicarCapa`, `borrarCapa`, `agruparSeleccion`, `desagruparSeleccion`, toggles ocultar/bloquear) — cero logica nueva (INV-2); acciones de grupo en cabecera: Desagrupar / Ocultar grupo / Quitar grupo sobre todas las miembros (FR-008)
- [ ] T022 [US5] Cierre: `pointerdown` fuera, Escape, scroll del panel y repintado de la lista; retirar/unificar el `contextmenu` preventivo de mockups.js:2014 (FR-014, C-3)
- [ ] T023 [US5] Boton `...` (`.ec-mk-capa-ias`) en cada fila abre el mismo menu (fallback sin clic derecho); verificar atajos T044 (Delete, Ctrl+D, [, ], flechas) sobre la capa seleccionada (FR-009)
- [ ] T024 [US5] quickstart E5: menu por clic derecho en fila y cabecera; Delete/Ctrl+D; `...`; cierre por fuera/Esc/scroll; Agrupar deshabilitado con 1 capa

---

## Phase 8: User Story 6 - Placeholders con importador (P2)

**Goal**: el importador de pagina + PH y los grupos de placeholders (con instancias) viven en su acordeon

**Independent Test**: quickstart **E4** (parte placeholders)

- [ ] T025 [US6] `plantilla()`: el importador (`.ec-mk-importar` + `.ec-mk-num-pagina` + `data-mk="importar-pagina"` + ayuda + estado) se muda del panel Capas al acordeon Placeholders; handler intacto (FR-012, D6, C-5)
- [ ] T026 [US6] `pintarGrupos()`: `details.ec-mk-acordeon` por grupo — summary con swatch + etiqueta + conteo + boton Agregar (`.ec-mk-grupo[data-grupo]`, vigente); cuerpo con `.ec-mk-instancias` y `.ec-mk-instancia[data-grupo][data-instancia]` (vigente) (FR-012, R4)
- [ ] T027 [US6] quickstart: importar pagina 1 desde Placeholders crea el grupo en el lienzo; las instancias quedan dentro del acordeon; los errores de importacion informan igual

---

## Phase 9: User Story 7 - Imagenes en su acordeon (P3)

**Goal**: la galeria del catalogo con buscador vive en su acordeon, sin perder funciones

**Independent Test**: quickstart **E3** (abrir Imagenes, buscar, agregar, borrar)

- [ ] T028 [US7] Acordeon Imagenes: buscador `.ec-mk-buscar-catalogo` + galeria `.ec-mk-catalogo` + borrar (x) (contenido vigente reubicado); verificar que arrastrar un archivo sobre el lienzo sigue funcionando (FR-013)

---

## Phase 10: User Story 8 - Clip de capa y documentacion (P3)

**Goal**: paridad del tirador de rotacion de capa con el grupal + ayuda al dia

**Independent Test**: quickstart **E6** (tinta en el borde) + **E7** (ayuda)

- [ ] T029 [P] [US8] `assets/mockups.js`: nueva `puntoRotacionCapa(c)` con `G.extremoVisible({x:cx,y:cy},{x:hx,y:hy},LIENZO,7)`; `dibujarSeleccion` rama capa (688-706) y `tiradorEn` (759-763) la usan — dibujo y hit-test comparten el punto (FR-015, R6, C-1)
- [ ] T030 [P] [US8] `admin/ayuda.php` (31-57): documentar menu contextual, atajos, acordeones y el recorte de grupos grandes (FR-016)
- [ ] T031 [P] [US8] `AGENTS.md`: §2 descripcion del editor actualizada (layout de 5 acordeones + menu contextual) + §11 filas nuevas si aplica (menu no descubrible sin el boton `...`)
- [ ] T032 [US8] quickstart E6: tinta del tirador de capa en el borde del lienzo (clip radial), paridad con el grupal; hit-test en el mismo punto

---

## Phase 11: Puertas (SC-004/005)

**Purpose**: el contrato Node y el arnes indexan la nueva superficie; cero regresiones

- [ ] T033 `tests/mockup-contrato.test.js`: actualizar a la nueva superficie (agrupar/desagrupar en `data-ctx` del menu; `add-catalogo`/`add-placeholder`/`subir`/`bajar` eliminados reescritos a la intencion; transformacion bajo el lienzo; 5 acordeones cerrados; menu contextual; clip de capa; zoom 100 %) + checks nuevos del contrato de UI (R5, C-1..C-7)
- [ ] T034 `tests/texto_puente.php`: aplicar la auditoria de T002 — si alguna fase indexa markup eliminado, reescribir a la intencion; correr `mockups`, `mockup_capas`, `mockup_pagina`, `mockup_preview`
- [ ] T035 Puertas en verde: `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js`, `node tests/mockup-geometria.test.js`, `php -l personalizador-pdf.php`

---

## Phase 12: Lab y release (SC-001/006/007)

**Purpose**: verificacion end-to-end en WP real + version

- [ ] T036 quickstart E1-E7 completos en `C:\wp-lab` (backup/restore del config; cero requests nuevos; dataset intacto en E7)
- [ ] T037 Regresion: smoke de la consola (pestaña Test) + `node tests/ficha-pedido.browser.js` (el editor no se toca desde la ficha, pero el config se guarda igual)
- [ ] T038 Bump a **4.23.0** (cabecera unica de `personalizador-pdf.php`) + commits por fase verificada (norma §10.ter) + push por webhook

---

## Dependencies & Execution Order

- **Phase 1** (T001-T003): paralelo, sin dependencias
- **Phase 2** (T004-T007): bloquea todo; T004/T006/T007 comparten `admin.css` (secuenciales en la practica); T005 es [P] (solo `mockups.js`)
- **Phase 3-5** (US1/US3/US2): el re-layout es transversal — secuencial (T009-T014 tocan `plantilla()`)
- **Phase 6-8** (US4/US5/US6): secuencial por `pintarCapas`/`plantilla`/`pintarGrupos`; **T029 (clip) es [P]** — funcion y rama distintas, puede correr en paralelo a las fases de markup
- **Phase 9-10**: T028 reubicacion; T030/T031 [P] (docs, archivos distintos)
- **Phase 11-12**: puertas y lab al final; el contrato se actualiza en el mismo commit del markup que indexa (R5)

## Notes

- Los checks del contrato se reescriben a la **intencion** en el mismo commit del cambio de markup (precedente 013 T010); nunca se borra cobertura.
- [P] = archivos distintos y sin dependencias; el limite real es `plantilla()` (un solo archivo: las tareas de markup van secuenciales).
- El menu contextual no introduce logica de negocio (INV-2): si una accion falla, falla igual que la via vigente.
- Sin migraciones ni retrocompatibilidad (constitucion §V): los mockups vigentes abren igual porque el formato no cambia (FR-017).