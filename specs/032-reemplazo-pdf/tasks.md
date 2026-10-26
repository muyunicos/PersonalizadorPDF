# Tasks: Reemplazar el PDF sin perder la personalizacion

**Feature**: 032-reemplazo-pdf · **Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md)
**Estado**: pendiente (borrador 2026-10-26)

## Convenciones

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1..US5 (del spec); Setup, Puertas y Cierre no llevan etiqueta
- Cada tarea nombra su archivo y su FR/decision

## Path Conventions

Proyecto unico (plugin de WordPress): `personalizador-pdf.php`, `admin/`, `assets/`, `engine/`, `inc/`, `tests/`, `specs/`.

---

## Phase 1 (F0): Setup

- [ ] T001 [P] Puertas base en verde antes de tocar nada: `php -l personalizador-pdf.php`, `node tests/mockup-contrato.test.js` (147), `node tests/mockup-geometria.test.js` (135), `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php reanalizar borrado subir_conflicto`
- [ ] T002 [P] Auditoria de anclas: que indexan las fases `reanalizar` (399/3263), `subir_conflicto` (823/4007), `borrado` (1011/3546) del arnes y los checks del contrato sobre `sobrescribir`, `limpiar_datos_de` y `personalizacion_perdida` → lista de lo que se rompe **a proposito**

## Phase 2 (F1): Mapa puro (US2)

**Goal**: el score del mapa, aislado y testeable · **Independent Test**: casos construidos en la fase del arnes

- [ ] T003 [US2] `engine/Metadata.php`: `mapaDeReemplazo($previos, $nuevos)` **puro** — ids iguales, IoU de `dev_bbox` normalizadas por `box` de pagina, distancia de color euclidea (R2), `score` 0,6/0,4, umbrales IoU>=0,5 y d<=0,15, asignacion 1:1, `perdidos`/`nuevos`/`avisos` (FR-004, R1/R2/R3, INV-1..3)
- [ ] T004 [US2] `tests/texto_puente.php`: casos del mapa — mismo bbox/color distinto (sugerencia), desplazado (IoU bajo), color igual/geometria distinta, sin candidato (perdido), dos candidatos parecidos (1:1: el mejor), fallback sin `dev_bbox` (FR-004)

## Phase 3 (F2): Remapeo compartido (US4)

**Goal**: reemplazo **y** Re-analizar usan el mismo remapeo · **Independent Test**: fase `reanalizar` + casos nuevos

- [ ] T005 [US4] `engine/Metadata.php`: `remapearConfig($config, $mapa, $analisisNuevo, $envolturasNuevas)` **puro** — `placeholders{id}`, `envolturas{gid:{forma:k}}` con revalidacion de `k` (fuera de rango -> 0) y `mockups[].capas[].ref` (`{gid}`, `{gid}#n` con `#n` fuera de rango -> instancia 1; sin destino -> se conserva y se reporta) (FR-007/012, D7/D8, R7)
- [ ] T006 [US4] `personalizador-pdf.php`: `analizar_y_guardar()` **extrae** el remapeo y lo comparte; `handle_reanalizar()` pasa a usarlo (hoy solo poda placeholders) y su respuesta suma los avisos del remapeo (FR-011)
- [ ] T007 [US4] `tests/texto_puente.php` fase `reanalizar`: `envolturas{gid}` fuera de rango -> 0 + aviso; `ref` huerfano reportado y capa conservada; `#n` fuera de rango -> instancia 1 (FR-011/012)

## Phase 4 (F3): Preparar (US2/US5)

**Goal**: analizar en staging y devolver el mapa, **sin tocar** el producto · **Independent Test**: R1/R2/R6

- [ ] T008 [US2] `inc/class-pmu-uploads.php`: `dir_reemplazo($nombre, $ts = '', $crear = false)` (dueno unico de rutas) + `ultimo_reemplazo()`/`marcar_ultimo_reemplazo()` sobre `tmp/reemplazos/{nombre}/ultimo.json` (R4)
- [ ] T009 [US2] `personalizador-pdf.php`: `handle_reemplazar_preparar()` — sube el PDF a `{ts}/nuevo/`, analiza **el nuevo y el viejo** (Detector + `box` de pagina, patron de `op=mockup_pagina`), calcula el mapa y responde `{ts, mapa}` (FR-003/004, R1/R8, C-3)
- [ ] T010 [US5] Preparar **no toca** `pdfs/{nombre}/` (solo lectura: C-1) y **borra** los staging previos del producto (C-2/R8); un fallo de analisis responde con causa y deja **cero cambios** (FR-003, SC-006)
- [ ] T011 [US2] `tests/texto_puente.php` fase `reemplazo` (parte 1): preparar con ids iguales, preparar con un color cambiado, hashes del producto intactos tras preparar, staging previo borrado, fallo de analisis sin cambios

## Phase 5 (F4): Confirmar (US1)

**Goal**: respaldo + swap por archivo + config remapeado · **Independent Test**: R4

- [ ] T012 [US1] `personalizador-pdf.php`: `handle_reemplazar_confirmar()` — **respalda primero** (`{ts}/anterior/` con los 4 archivos); si el respaldo no se puede escribir, **aborta** (C-5)
- [ ] T013 [US1] Swap **por archivo**: `Metadata::guardar()` para `analisis.json`/`envolturas.json`, `PMU_Uploads::guardar_config()` para el config remapeado, `rename` para el PDF; **jamas** se borra la carpeta del producto (FR-002/006, C-6, R5)
- [ ] T014 [US1] Validacion de `pares` del cliente contra el analisis del servidor (INV-1/C-7): un par invalido se ignora y se reporta; `migrar:false`/ausente = cancelar sin efectos (C-8, FR-005)
- [ ] T015 [US2] `tests/texto_puente.php` fase `reemplazo` (parte 2): migrar conserva `productos`/`campos_ids`/`tienda`/`bonus`/`mockups` y remapea `placeholders`; cancelar deja hashes identicos (SC-001/004)

## Phase 6 (F5): Recuperar y retencion (US3)

**Goal**: volver a la version anterior y no acumular respaldos · **Independent Test**: R5

- [ ] T016 [US3] `personalizador-pdf.php`: `handle_reemplazar_recuperar()` — restaura los 4 archivos de `anterior/` **byte a byte** y **conserva** el respaldo (C-10/C-11); sin respaldo -> error con causa (C-12)
- [ ] T017 [US3] Retencion: al confirmar un `{ts}` nuevo se **borra** el `{ts}` anterior (INV-5/C-9); cancelar **no** toca `anterior/` (INV-8)
- [ ] T018 [US3] `inc/class-pmu-uploads.php`: **excluir** `tmp/reemplazos/` del barrido de `limpiar_ttl` (spec 030) para que el respaldo no desaparezca a las 24 h (FR-010, INV-6)
- [ ] T019 [US3] `personalizador-pdf.php::handle_borrar()` / `limpiar_datos_de()`: borrar el producto limpia tambien `tmp/reemplazos/{nombre}/` (INV-7); la fase `borrado` del arnes lo verifica
- [ ] T020 [US3] `tests/texto_puente.php` fase `reemplazo` (parte 3): recuperar deja hashes del estado previo (SC-005), dos recuperaciones dan lo mismo, sin respaldo informa la causa

## Phase 7 (F6): UI de la consola (US1/US2/US3)

**Goal**: boton, modal del mapa y recuperacion · **Independent Test**: R1-R5 a mano en el lab

- [ ] T021 [US1] `admin/pdfs.php`: en "2. PDFs subidos" (93) un boton **Reemplazar archivo** por fila con `<input type="file">` propio (nunca un form anidado: leccion de la spec 011) y su nonce (FR-001)
- [ ] T022 [US2] `admin/pdfs.php` + `assets/admin.js`: **modal del mapa** — iguales / sugeridos (con `de -> a`, IoU y color) / perdidos / nuevos + avisos, con **Migrar** y **Cancelar**; sin recargas (FR-005/014, `pmuPost`)
- [ ] T023 [US2] `assets/admin.js`: `pares` construido desde lo que el admin acepta (por defecto todos) y enviado en el confirmar (T014); estado del boton mientras prepara/confirma
- [ ] T024 [US3] `admin/pdfs.php` + `assets/admin.js`: **Recuperar la version anterior** por fila, visible solo si hay respaldo (lo dice el listado), con confirmacion (FR-008)
- [ ] T025 [US1] `admin/pdfs.php`: la opcion `sobrescribir` del modal de conflicto (793-802) se reescribe a **"Reemplazar (conserva la personalizacion)"** y dispara el flujo nuevo (D10/FR-001)
- [ ] T026 [P] `assets/admin.css`: estilos del modal del mapa (tabla de pares, etiquetas de estado) y del boton de recuperacion

## Phase 8 (F7): Legado

- [ ] T027 `personalizador-pdf.php`: el modo `sobrescribir` de `handle_subir_pdf` **deja de borrar** (`limpiar_datos_de` sale del camino de reemplazo) y delega en preparar+confirmar (FR-002, F7 del plan)
- [ ] T028 `personalizador-pdf.php`: eliminar el camino muerto que quedaba (si el flujo nuevo lo deja sin uso) y verificar que **Borrar** sigue borrando todo lo suyo (fase `borrado`)

## Phase 9 (F8): Puertas

- [ ] T029 Fase `reemplazo` completa en `tests/texto_puente.php` (T011/T015/T020) y **registrada** en la lista de fases de AGENTS §9
- [ ] T030 Puertas en verde: `php -l personalizador-pdf.php` + todos los PHP, `node tests/mockup-contrato.test.js`, `node tests/mockup-geometria.test.js`, `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php reanalizar borrado subir_conflicto reemplazo`, `php tests/sin_lectura.php`, `php tests/campos_migracion.php`, `php tests/certificacion_hoja.php`
- [ ] T031 Recorrido **R1-R8** en `C:\wp-lab` (quickstart) con hashes de antes/despues y `config.json` comparado contra `.bak-032`; restaurar el producto al terminar

## Phase 10 (F9): Cierre

- [ ] T032 [P] `AGENTS.md`: §5 (ambito `tmp/reemplazos/` + retencion de un respaldo + exclusion del TTL) y §7 (decision: reemplazo sin perdida, swap por archivo, mapa 1:1 con modal y respaldo)
- [ ] T033 [P] `admin/ayuda.php`: documentar "Reemplazar archivo", el modal del mapa (iguales/sugeridos/perdidos) y "Recuperar la version anterior"
- [ ] T034 `specs/INDICE.md` con el estado real de la 032 y `tasks.md` al dia; bump de version; commit por fase verificada (norma §10.ter) y **push previo visto bueno** (el push despliega)

---

## Dependencies & Execution Order

- **F0** (T001-T002): primero, sin dependencias.
- **F1** (T003-T004): bloquea a F3/F4 (el mapa es el corazon).
- **F2** (T005-T007): independiente de F1 en codigo, pero **comparte** `Metadata` -> secuencial con T003.
- **F3** (T008-T011): depende de F1/F2.
- **F4** (T012-T015): depende de F3.
- **F5** (T016-T020): depende de F4.
- **F6** (T021-T026): depende de F3/F4 (necesita las ops); T026 [P] (CSS).
- **F7** (T027-T028): al final del codigo (toca el camino viejo).
- **F8/F9**: puertas y docs; T031 requiere todo lo anterior.
- **Regla de oro**: el contrato de la fase se actualiza **en el mismo commit** que la toca; nunca se borra cobertura sin reemplazo (R5 del plan).