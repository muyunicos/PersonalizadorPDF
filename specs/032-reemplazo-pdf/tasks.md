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

- [X] T001 [P] Puertas base en verde antes de tocar nada: `php -l personalizador-pdf.php`, `node tests/mockup-contrato.test.js` (147), `node tests/mockup-geometria.test.js` (135), `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php reanalizar borrado subir_conflicto` — **hecho**: todo en verde (CONTRATO 147, GEOMETRIA 135, SMOKE, PARIDAD y las 3 fases OK)
- [X] T002 [P] Auditoria de anclas: que indexan las fases `reanalizar` (399/3263), `subir_conflicto` (823/4007), `borrado` (1011/3546) del arnes y los checks del contrato sobre `sobrescribir`, `limpiar_datos_de` y `personalizacion_perdida` → lista de lo que se rompe **a proposito** — **hecho**: el arnes **no** indexa markup; la fase `reanalizar` verifica `config preservada al reanalizar` con `===` (linea 410) y hay que mantenerla; el modal de conflicto tiene `data-modo="sobrescribir"` con el texto "Sobrescribir (regenera datos)" (pdfs.php:798) y los `ec_perdidos` viajan por URL (admin.js:1427 → pdfs.php:65-67), asi que los avisos del remapeo necesitaran su propio canal (`ec_avisos`)

## Phase 2 (F1): Mapa puro (US2)

**Goal**: el score del mapa, aislado y testeable · **Independent Test**: casos construidos en la fase del arnes

- [X] T003 [US2] `engine/Metadata.php`: `mapaDeReemplazo($previos, $nuevos)` **puro** — ids iguales, IoU de `dev_bbox` normalizadas por `box` de pagina, distancia de color euclidea (R2), `score` 0,6/0,4, asignacion 1:1, `perdidos`/`nuevos`/`avisos` (FR-004, R1/R2/R3, INV-1..3) — **hecho** con 2 correcciones que cazo la puerta: **(a)** el filtro es **solo geometrico** (IoU >= 0,5) y el **color pondera** en el score (el filtro `d <= 0,15` mataba el caso principal: azul->verde = 0,816, un rediseno cambia el color a proposito); **(b)** PHP castea a int las claves de array con forma numerica (color `112233`), asi que el mapa devuelve ids **siempre string**
- [X] T004 [US2] `tests/texto_puente.php`: casos del mapa — mismo bbox/color distinto (sugerencia), desplazado (IoU bajo), color igual/geometria distinta, sin candidato (perdido), dos candidatos parecidos (1:1: el mejor), fallback sin `dev_bbox` (FR-004) — **hecho**: fase `reemplazo` con 9 checks del mapa, registrada en el docblock de fases

## Phase 3 (F2): Remapeo compartido (US4)

**Goal**: reemplazo **y** Re-analizar usan el mismo remapeo · **Independent Test**: fase `reanalizar` + casos nuevos

- [X] T005 [US4] `engine/Metadata.php`: `remapearConfig($config, $mapa, $analisisNuevo, $envolturasNuevas)` **puro** — `placeholders{id}`, `envolturas{gid:{forma:k}}` con revalidacion de `k` (fuera de rango -> 0) y `mockups[].capas[].ref` (`{gid}`, `{gid}#n` con `#n` fuera de rango -> instancia 1; sin destino -> se conserva y se reporta) (FR-007/012, D7/D8, R7) — **hecho**: quirurgico (sin nada que remapear el config vuelve **identico**, lo que preserva la fase `reanalizar`); colision de clave -> se conserva la existente + aviso; sin `$nuevos` no toca refs
- [X] T006 [US4] `personalizador-pdf.php`: `analizar_y_guardar()` **extrae** el remapeo y lo comparte; `handle_reanalizar()` pasa a usarlo (hoy solo poda placeholders) y su respuesta suma los avisos del remapeo (FR-011) — **hecho**: el remapeo corre tambien al re-analizar (solo ids que sobreviven) y `handle_reanalizar` devuelve `ec_avisos`
- [X] T007 [US4] `tests/texto_puente.php` fase `reanalizar`: `envolturas{gid}` fuera de rango -> 0 + aviso; `ref` huerfano reportado y capa conservada; `#n` fuera de rango -> instancia 1 (FR-011/012) — **hecho**: 7 checks de remapeo en la fase `reemplazo` (16 en total) y la fase `reanalizar` sigue OK (`config preservada al reanalizar`: el remapeo no altera un config sin envolturas/mockups)

## Phase 4 (F3): Preparar (US2/US5)

**Goal**: analizar en staging y devolver el mapa, **sin tocar** el producto · **Independent Test**: R1/R2/R6

- [X] T008 [US2] `inc/class-pmu-uploads.php`: `dir_reemplazo($nombre, $ts = '', $crear = false)` (dueno unico de rutas) + `ultimo_reemplazo()`/`marcar_ultimo_reemplazo()` sobre `tmp/reemplazos/{nombre}/ultimo.json` (R4) — **hecho**: `reemplazos` sumado a `$SUBAMBITOS_TMP`; el `{ts}` se valida con regex (nunca una ruta)
- [X] T009 [US2] `personalizador-pdf.php`: `handle_reemplazar_preparar()` — sube el PDF a `{ts}/nuevo/`, analiza **el nuevo y el viejo** (Detector + `box` de pagina, patron de `op=mockup_pagina`), calcula el mapa y responde `{ts, mapa}` (FR-003/004, R1/R8, C-3) — **hecho**: helper `analizar_pdf_de_ruta()` (grupos con `dev_bbox` + boxes por pagina); los JSON nuevos quedan listos en el staging para el swap
- [X] T010 [US5] Preparar **no toca** `pdfs/{nombre}/` (solo lectura: C-1) y **borra** los staging previos del producto (C-2/R8); un fallo de analisis responde con causa y deja **cero cambios** (FR-003, SC-006) — **hecho**: `limpiar_staging_reemplazo()` conserva el respaldo; un fallo borra el staging a medias y responde con la causa
- [X] T011 [US2] `tests/texto_puente.php` fase `reemplazo` (parte 1): preparar con ids iguales, preparar con un color cambiado, hashes del producto intactos tras preparar, staging previo borrado, fallo de analisis sin cambios — **hecho en parte**: en la fase se prueba el **camino de error** del handler (`sin archivo -> no_file`). **La subida real NO se puede simular en el arnes** (`move_uploaded_file` solo acepta un upload real y su `tmp_name` no se puede falsificar) -> el flujo con subida va en el lab (quickstart R1/R2/R6, T031). El mapa con color cambiado y los hashes intactos SI quedan cubiertos (16 checks puros + transaccion)

## Phase 5 (F4): Confirmar (US1)

**Goal**: respaldo + swap por archivo + config remapeado · **Independent Test**: R4

- [X] T012 [US1] `personalizador-pdf.php`: `handle_reemplazar_confirmar()` — **respalda primero** (`{ts}/anterior/` con los 4 archivos); si el respaldo no se puede escribir, **aborta** (C-5) — **hecho**: `respaldar_producto()` exige `analisis.json` + `config.json` y copia tambien el PDF y `envolturas.json`; si algo falla, el swap ni empieza
- [X] T013 [US1] Swap **por archivo**: `Metadata::guardar()` para `analisis.json`/`envolturas.json`, `PMU_Uploads::guardar_config()` para el config remapeado, `rename` para el PDF; **jamas** se borra la carpeta del producto (FR-002/006, C-6, R5) — **hecho**: `analizar_y_guardar($archivo, $mapaExterno)` reutiliza los caminos atomicos vigentes; un fallo a mitad **restaura del respaldo** y avisa
- [X] T014 [US1] Validacion de `pares` del cliente contra el analisis del servidor (INV-1/C-7): un par invalido se ignora y se reporta; `migrar:false`/ausente = cancelar sin efectos (C-8, FR-005) — **hecho**: `pares_de_reemplazo()` cruza `de`/`a` contra el analisis previo y el del staging, rechaza destinos repetidos y junta los avisos; cancelar descarta el staging y no toca nada
- [X] T015 [US2] `tests/texto_puente.php` fase `reemplazo` (parte 2): migrar conserva `productos`/`campos_ids`/`tienda`/`bonus`/`mockups` y remapea `placeholders`; cancelar deja hashes identicos (SC-001/004) — **hecho**: la fase prueba la **transaccion** completa por los auxiliares (respaldo -> swap -> restauracion con hashes md5) y el remapeo (7 checks); el handler con subida real va en el lab

## Phase 6 (F5): Recuperar y retencion (US3)

**Goal**: volver a la version anterior y no acumular respaldos · **Independent Test**: R5

- [X] T016 [US3] `personalizador-pdf.php`: `handle_reemplazar_recuperar()` — restaura los 4 archivos de `anterior/` **byte a byte** y **conserva** el respaldo (C-10/C-11); sin respaldo -> error con causa (C-12) — **hecho**: `restaurar_producto()`; si `envolturas.json` no existia antes, se quita (fidelidad del estado previo)
- [X] T017 [US3] Retencion: al confirmar un `{ts}` nuevo se **borra** el `{ts}` anterior (INV-5/C-9); cancelar **no** toca `anterior/` (INV-8) — **hecho**: `limpiar_staging_reemplazo($nombre, $ts)` conserva el `{ts}` recien marcado como ultimo y borra los previos; el respaldo vive DENTRO del `{ts}` conservado
- [X] T018 [US3] `inc/class-pmu-uploads.php`: **excluir** `tmp/reemplazos/` del barrido de `limpiar_ttl` (spec 030) para que el respaldo no desaparezca a las 24 h (FR-010, INV-6) — **hecho por construccion**: `PMU_Sesion::limpiar_ttl()` (1242) barre **solo** `tmp/sesion-*` (drafts e items), asi que `tmp/reemplazos/` nunca entra; la fase lo verifica llamando `limpiar_ttl()` y comprobando que el respaldo sigue
- [X] T019 [US3] `personalizador-pdf.php::handle_borrar()` / `limpiar_datos_de()`: borrar el producto limpia tambien `tmp/reemplazos/{nombre}/` (INV-7); la fase `borrado` del arnes lo verifica — **hecho**: `limpiar_datos_de()` borra el arbol de `dir_reemplazo($nombre)`; la fase `borrado` sigue verde
- [X] T020 [US3] `tests/texto_puente.php` fase `reemplazo` (parte 3): recuperar deja hashes del estado previo (SC-005), dos recuperaciones dan lo mismo, sin respaldo informa la causa — **hecho**: la fase prueba la restauracion **byte a byte** por md5 de los 3 JSON + el PDF, dos veces seguidas (C-11), y el puntero `ultimo.json`. El camino "sin respaldo" del handler queda para el lab

## Phase 7 (F6): UI de la consola (US1/US2/US3)

**Goal**: boton, modal del mapa y recuperacion · **Independent Test**: R1-R5 a mano en el lab

- [X] T021 [US1] `admin/pdfs.php`: en "2. PDFs subidos" (93) un boton **Reemplazar archivo** por fila con `<input type="file">` propio (nunca un form anidado: leccion de la spec 011) y su nonce (FR-001) — **hecho**: boton `type=button` + `<input type=file hidden>` por fila (sin `<form>` nuevo: la fase `admin` valida el equilibrio) y los 3 nonces publicados en `PersonalizadorPDF.nonces`
- [X] T022 [US2] `admin/pdfs.php` + `assets/admin.js`: **modal del mapa** — iguales / sugeridos (con `de -> a`, IoU y color) / perdidos / nuevos + avisos, con **Migrar** y **Cancelar**; sin recargas (FR-005/014, `pmuPost`) — **hecho**: `.ec-rp-modal` con tabla de sugeridos (checkbox por par), perdidos marcados si tenian personalizacion, nuevos sin par y avisos; Migrar/Cancelar por `pmuPost` (JSON) y recarga solo en exito
- [X] T023 [US2] `assets/admin.js`: `pares` construido desde lo que el admin acepta (por defecto todos) y enviado en el confirmar (T014); estado del boton mientras prepara/confirma — **hecho**: los `iguales` viajan como pares `de=a` y los sugeridos marcados; el boton de la fila y los del modal se deshabilitan durante la peticion
- [X] T024 [US3] `admin/pdfs.php` + `assets/admin.js`: **Recuperar la version anterior** por fila, visible solo si hay respaldo (lo dice el listado), con confirmacion (FR-008) — **hecho**: `ultimo_reemplazo($nombre)` decide si el boton se pinta; el JS confirma con `window.confirm` y recarga con el notice
- [X] T025 [US1] `admin/pdfs.php`: la opcion `sobrescribir` del modal de conflicto (793-802) se reescribe a **"Reemplazar (conserva la personalizacion)"** y dispara el flujo nuevo (D10/FR-001) — **hecho**: `data-modo="reemplazar"`; el JS intercepta ese modo y llama `PMURp.preparar(file, archivoEnConflicto)` en vez de `subir_pdf`
- [X] T026 [P] `assets/admin.css`: estilos del modal del mapa (tabla de pares, etiquetas de estado) y del boton de recuperacion — **hecho**: `.ec-rp-modal` con overlay fijo y z-index 180000 (la escala documentada de la consola), tabla y acciones

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