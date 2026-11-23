# Tasks — Editor de imagen y biblioteca del comprador

**Feature**: `043-editor-imagen-biblioteca` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

**Orden**: Fase 1 (setup) -> Fase 2 (fundacional) -> US1 -> US2 -> US3 -> US4 -> US5 -> Polish.

## Phase 1 — Setup

- [X] T001 Confirmar el baseline de puertas en verde (`php -l`, `node --check` de los 5 assets, `tests/selector-contrato.test.js`, `tests/biblioteca-contrato.test.js`, `tests/campos-contrato.test.js`, `php tests/media_lectura.php`) y anotar el conteo en el commit.
  - **Hecho 2026-11-22** (Act): baseline en verde — `php -l` de `personalizador-pdf.php`,
    `media.php`, `admin/`, `engine/` e `inc/`; `node --check` de los 5 assets;
    `selector-contrato` (F0-F5), `biblioteca-contrato` **81**, `campos-contrato` y
    `media_lectura` **75** (total v4.36.0).
- [ ] T002 Agregar a `tests/selector-contrato.test.js` los helpers de prueba para una receta por contexto (`{gid}-{w}x{h}-{phsize}`) y un doble de `declararReceta`.
- [ ] T003 Agregar a `tests/biblioteca-contrato.test.js` el fixture de una biblioteca con 1, 3 y 12 fotos para probar el chip "Ver todas (N)".
- [X] T004 Documentar en `specs/043-editor-imagen-biblioteca/contracts/editor-imagen.md` cualquier ajuste de firma que surja al implementar (mantener el contrato como fuente de verdad).

## Phase 2 — Foundational (bloquea todas las historias)

- [X] T005 [P] Declarar la opcion `declararReceta` en el contrato del selector y usarla en `assets/selector-pmu.js` (`_aceptar`) sin cambiar el comportamiento cuando no existe.
- [X] T006 Cablear `declararReceta` en la config del selector en `assets/cargador-pmu.js` (junto a `usarExistente`), delegando en la receta del cargador.
- [X] T007 Asegurar en `assets/cargador-pmu.js` (`_usarExistente`) que la receta queda en `recetas[id]` y que `onRecorte` publica `(id, url, params)`.
- [X] T008 Verificar en `assets/tienda.js` que `registrarFotos` envia `{id, receta}` por instancia (fase `fotos`) y que no sube bytes cuando el id ya existe.
- [X] T009 Verificar en `inc/class-pmu-sesion.php` (`registrar_fotos`) la idempotencia por receta: dos registros de la misma receta no acumulan filas.
- [X] T010 Verificar en `inc/class-pmu-lectura.php` (`listar`) y `personalizador-pdf.php` (`handle_biblioteca`) que `recetas` por contexto viaja en la lista rapida y en el respaldo.
- [X] T011 Agregar a la fase `fotos` de `tests/texto_puente.php`: misma foto, dos recetas distintas -> dos filas con el mismo `orig.id`.
- [X] T012 Agregar a la fase `fotos` de `tests/texto_puente.php`: guardar una receta nueva no crea ningun archivo nuevo en la carpeta de originales (FR-004).
- [X] T013 [P] Agregar a `tests/media_lectura.php` la comprobacion de que `listar` devuelve `recetas` por contexto (o `[]`), para que el editor pueda precargar.

## Phase 3 — US1: Editar el recorte sin volver a subir (P1)

**Goal**: guardar una receta nueva sobre una foto existente = **0 bytes**.
**Independent test**: `php tests/texto_puente.php receta_sin_bytes` + `node tests/selector-contrato.test.js`.

- [X] T014 [P] [US1] Test en `tests/selector-contrato.test.js`: (a) existente con receta distinta -> `declararReceta` llamado y `subirAsync` **no** llamado; (b) existente **sin cambios** -> ninguna de las tres funciones (`subirAsync`, `usarExistente`, `declararReceta`) y sin POST `fotos` (FR-005).
- [X] T015 [US1] En `assets/selector-pmu.js` (`_aceptar`), unificar la condicion: con `_bib.id` y `puedeDeclarar`, usar `usarExistente` + `declararReceta` (nunca caer al upload si falta solo una).
- [X] T016 [US1] En `assets/cargador-pmu.js`, `declararReceta` guarda `recetas[id] = params` y dispara `onRecorte(id, url, params)`.
- [X] T017 [US1] En `assets/cargador-pmu.js`, crear `_recetaDeContexto(id, ranura)` (memoria -> lista -> defaults) y usarla al abrir desde la biblioteca; pasar el resultado como `params`.
- [X] T018 [US1] Gate: `node tests/selector-contrato.test.js` y `php tests/texto_puente.php receta` + `fotos` (las aserciones de FR-004/FR-005 viven en la fase `fotos`) en verde.

## Phase 4 — US2: La miniatura del campo abre el editor (P1)

**Goal**: el toque abre el editor con la imagen y su receta vigente.
**Independent test**: `node tests/selector-contrato.test.js` (apertura con `params`) + E2 del quickstart.

- [X] T019 [P] [US2] Test en `tests/selector-contrato.test.js`: `_miniTocar` abre el editor con `id` y `params` (doble de `_abrir`).
- [X] T020 [US2] En `assets/cargador-pmu.js`, `_miniTocar` conserva el reintento de fallos (039 D2) y, si no fallo, abre el editor en vez del visor.
- [X] T021 [US2] En `assets/cargador-pmu.js`, reusar `_recetaDeContexto(id, ranura)` (T017) al abrir desde la miniatura y pasar el resultado como `paramsIniciales`; no duplicar la resolucion.
- [X] T022 [US2] En `assets/selector-pmu.js` (`open`), aceptar `params` y aplicarlos; si no aplican a la geometria, abrir con defaults y avisar sin bloquear.
- [X] T023 [US2] En `assets/cargador-pmu.js`, dejar el visor como accion secundaria (`_abrirVisorCompartido`) accesible desde el editor.

## Phase 5 — US3: Guardar y Cancelar (P1)

**Goal**: Guardar sube solo si es nueva; Cancelar no escribe nada.
**Independent test**: `node tests/selector-contrato.test.js` + E3 del quickstart.

- [X] T024 [P] [US3] Test en `tests/selector-contrato.test.js`: Cancelar no llama `subirAsync`, `usarExistente` ni `declararReceta`.
- [X] T025 [US3] En `assets/selector-pmu.js`, el primario dice **"Guardar"** en ambos modos y "Cancelar" cierra sin escrituras (`CROP_ABORTED`).
- [X] T026 [US3] En `assets/cargador-pmu.js`, tras guardar una existente, repintar la mini y no volver a subir.
- [X] T027 [US3] Gate: `node tests/campos-contrato.test.js` y `php tests/texto_puente.php fotos` en verde.

## Phase 6 — US4: "Ver todas (N)" y visor de la biblioteca (P2)

**Goal**: el chip abre el visor completo; elegir carga, borrar gestiona.
**Independent test**: `node tests/biblioteca-contrato.test.js` + E4/E5 del quickstart.

- [X] T028 [P] [US4] Test en `tests/biblioteca-contrato.test.js`: el chip "Ver todas (N)" se pinta siempre con el total real (1, 3 y 12 fotos).
- [X] T029 [US4] En `assets/biblioteca-pmu.js`, mover el `onChip` a `onVerTodas` y dejar de usarlo para seleccionar. Verificar que la fila del modal conserva **"Cargar imagen"** a la izquierda de la tira y que el chip queda al final (FR-009).
- [X] T030 [US4] En `assets/biblioteca-pmu.js`, implementar `verTodas({indice})` con `PMUVisor.abrir` (items = todas las fotos, acciones Elegir/Eliminar).
- [X] T031 [US4] En `assets/biblioteca-pmu.js`, borrado en dos pasos (`PMU_API.borrarFoto` sin `confirmar`; dialogo y reintento con `confirmar=1`).
- [X] T032 [US4] En `assets/biblioteca-pmu.js`, repintar la tira y recalcular N tras borrar o subir (revision del camino rapido).
- [X] T033 [US4] Gate: `node tests/biblioteca-contrato.test.js` y `php tests/texto_puente.php biblioteca` en verde.

## Phase 7 — US5: Eliminar desde el editor (P2)

**Goal**: un solo lugar para editar y eliminar una imagen del campo.
**Independent test**: `node tests/selector-contrato.test.js` + E5 del quickstart.

- [X] T034 [P] [US5] Test en `tests/selector-contrato.test.js`: la accion Eliminar delega en el cargador y cierra el editor sin guardar.
- [X] T035 [US5] En `assets/selector-pmu.js` y `assets/cargador-pmu.js`, mostrar la accion Eliminar solo en modo editar y delegar en `_quitar(indice, posicion)`.
- [X] T036 [US5] En `assets/cargador-pmu.js`, si el borrado falla la foto NO se saca del campo y se muestra la causa.
- [X] T037 [US5] Gate: `node tests/selector-contrato.test.js` y fase `biblioteca` de `php tests/texto_puente.php` en verde.

## Phase 8 — Polish y cierre

- [X] T038 [P] Actualizar `AGENTS.md` §2/§5/§9: retirar `Elegir`/`familias` de la descripcion de `biblioteca-pmu.js` y documentar el editor y "Ver todas (N)".
- [X] T039 [P] Actualizar `docs/decisiones.md` y `specs/INDICE.md` con la 043 (decisiones D1-D7 y estado).
- [X] T040 [P] Revisar `readme.txt` y `admin/ayuda.php` por menciones a `Elegir` (corregir o quitar).
- [X] T041 Subir la version en la cabecera de `personalizador-pdf.php` (4.36.0) y el `Stable tag` de `readme.txt` (fuente unica: cabecera).
- [X] T042 Ejecutar todas las puertas: `php -l`, `tests/catalogo_uploads.php`, `tests/media_lectura.php`, `tests/sin_lectura.php`, fases de `tests/texto_puente.php`, `tests/motor_smoke.php`, `tests/parity.php`, `node --check` + suites de contrato. Verificar ademas FR-016: `Select-String -Path assets/*.js -Pattern 'global\.indexedDB'` debe dar **0**.
- [X] T043 Correr `node tests/ficha-pedido.browser.js` en el laboratorio y verificar E1-E6 del quickstart.
- [X] T044 Commit con el lint gateado en el mismo comando (sin push).

## Dependencies

```text
Fase 1 (T001-T004)
   └─> Fase 2 (T005-T013)  [bloquea todo]
         ├─> US1 (T014-T018)
         │     └─> US2 (T019-T023)
         ├─> US3 (T024-T027)   (depende de US1)
         ├─> US4 (T028-T033)   (independiente de US1-US3)
         └─> US5 (T034-T037)   (depende de US1 para el borrado sin re-subida)
               └─> Polish (T038-T044)
```

- **US1** es la base: sin `declararReceta`, US2 y US3 no pueden cumplir "0 bytes".
- **US4** es independiente (tira y visor) y se puede hacer en paralelo con US1/US2.
- **US5** reutiliza el borrado de US4; conviene después.

## Parallel execution

- **Setup**: T002 y T003 en paralelo (archivos distintos).
- **Fundacional**: T005, T008 y T013 en paralelo (`selector-pmu.js`, `tienda.js`, `media_lectura.php`).
- **US1**: T014 (test) en paralelo con T015 (implementacion) si el test usa dobles.
- **US4**: T028 (test) en paralelo con T029/T030 (implementacion de `biblioteca-pmu.js`) una vez fijado el contrato.
- **Polish**: T038, T039 y T040 en paralelo (archivos distintos).

## Implementation strategy

1. **MVP = US1 + US2 + US3**: es lo que elimina la re-subida y da la puerta de entrada al editor.
   Con eso el comprador edita su encuadre sin gastar disco.
2. **Segundo incremento = US4 + US5**: la biblioteca completa y el borrado desde el editor.
3. **Cierre = Polish**: documentacion, version y puertas completas.

Ninguna historia toca `engine/` ni `modules/textmuy/`; si un cambio los requiere, es senal de que el
diseno se desvio del plan.

## Format validation

- Todas las tareas siguen `- [ ] TNNN [P?] [US?] descripcion con ruta`.
- IDs unicos y secuenciales (T001-T044).
- Tareas de US con etiqueta `[USn]`; setup, fundacional y polish sin etiqueta.
- Sin marcadores pendientes ni placeholders.