# Tasks: align-textmuy-motor

**Input**: Design documents from `specs/006-align-textmuy-motor/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No se crean suites nuevas (la fase `nonce` de `texto_puente.php` extiende la herramienta existente). La verificación usa las puertas existentes (`php -l`, `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php nonce [cap]`, `node --check` + 10 suites Node del módulo) y el recorrido manual de `quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Plugin (repo actual)**: `personalizador-pdf.php`, `inc/`, `admin/`, `assets/`, `engine/`, `tests/`, `AGENTS.md`, `readme.txt` en la raíz del repo
- **Módulo editor (integrado, control total)**: `modules/textmuy/js/`, `modules/textmuy/index.html`, `modules/textmuy/render-core.html`, `modules/textmuy/tests/` (se edita directo en este repo + bump `?v=RCn`)
- **Datos (no versionados, solo verificación)**: `uploads/pmu/{fonts,img,tm-presets}/`
- **Contratos**: `specs/006-align-textmuy-motor/contracts/motor-resources.md`, `contracts/bridge-editor.md`, `contracts/catalog-schema.md`; entidades en `data-model.md`; decisiones en `research.md`; recorrido en `quickstart.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Línea base objetiva antes de tocar código: inventario de archivos, puertas en verde/rojo registrado y respaldo del estado de datos.

- [X] T001 Registrar línea base de archivos y datos al pie de T001–T003 en este mismo archivo, NO en `quickstart.md` (listar `inc/class-pmu-uploads.php`, `inc/class-pmu-galeria.php`, `admin/estilos-texto.php`, `assets/miniaturas.js`, `assets/admin.js`, `personalizador-pdf.php`, `modules/textmuy/js/{preset-manager,catalog,api,fonts,galeria,fuentes-galeria}.js`, `modules/textmuy/index.html`, `modules/textmuy/render-core.html`, `modules/textmuy/tests/preset-load.test.js` y el contenido real de `uploads/pmu/{fonts,img,tm-presets}/` sin modificar datos)
- [X] T002 [P] Ejecutar puertas base del plugin y registrar resultado al pie de T001–T003 en este mismo archivo (comandos `php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php && php -l inc/*.php`, `php tests/motor_smoke.php`, `php tests/parity.php` desde la raíz del repo)
- [X] T003 [P] Ejecutar puertas base del editor y registrar resultado al pie de T001–T003 en este mismo archivo (comandos `node --check js/*.js` y las 10 suites `node tests/*.test.js` desde `modules/textmuy/`, anotando el fallo esperado de `modules/textmuy/tests/preset-load.test.js` por ruta heredada)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Un solo motor de recursos con raíz única, nombres explícitos y errores con causa. Sin esta fase ninguna historia puede implementarse.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Consolidar la verdad unica de almacenamiento en `inc/class-pmu-uploads.php` (toda lectura/escritura/listado de ámbitos `fonts`, `img`, `tm-presets` —más `pdfs`, `orders`, `tmp` del motor, estos sin catálogo ni sprite— pasa por esta clase; unico `handle_request()`; `PMU_Galeria` queda solo como ayudante de miniaturas llamado desde aca; verificar en servidor capacidad `manage_options` en `handle_pmu_uploads()` y nonce de la acción `pmu_uploads` al inicio de `handle_request()`, antes de cualquier `op`, con causas `motor:capacidad:invalida` / `motor:nonce:invalido`, segun R1 de `research.md` y el contrato `contracts/motor-resources.md`)
- [X] T005 Fijar raíz única y mapa explícito de catálogos en `inc/class-pmu-uploads.php` (raíz `uploads/pmu/`, `fonts/` → `fonts.json`, `img/` → `img.json`, `tm-presets/` → `presets.json` sin derivar `{ambito}.json`; prohibir rutas a `uploads/tm/` y a `uploads/pmu/tm/` salvo la vigente `uploads/pmu/tm-presets/`, según R2 y `contracts/catalog-schema.md`)
- [X] T006 Unificar operaciones y errores con causa en `inc/class-pmu-uploads.php` (orden de rechazo: capacidad → nonce → `op` → ámbito → payload; whitelist `op` = `listar`, `alta`, `baja`, `editar`, `sprite`, `miniatura`; causa `motor:<op>:<motivo>` más `motor:capacidad:invalida` / `motor:nonce:invalido`; params canónicos `scope` (alias `ambito`), `title` (alias `titulo`), `file` (alias `archivo`) normalizados en un punto —`sprite` usa `scope`, `miniatura` usa `nombre`—; alta reutiliza hueco más bajo sino `maxId+1`, baja vacía sin reindexar y borra físico, edición renombra físico si cambió; catálogo ausente ⇒ semilla vacía + aviso no bloqueante `motor:listar:catalogo:ausente`, catálogo inválido ⇒ rechazo `motor:<op>:catalogo:invalido` sin sustituciones; `listar` excluye físicos ausentes con contador `ausentes` y la purga se hace por `baja`, según `contracts/motor-resources.md` y `data-model.md` secciones 2, 4 y 9)
- [X] T007 Sanear la frontera en `inc/class-pmu-galeria.php` (conservarla como ayudante puro de miniaturas: calculo de celdas, composicion del `thumbs.webp`, validacion de `webp`, saneo de nombres; quitar su raiz propia, su criterio de nombres, sus catalogos y su dispatcher; todo dato lo recibe por parametros desde `inc/class-pmu-uploads.php`, segun R1 de `research.md`)
- [X] T008 Purgar registro y ayudantes heredados en `personalizador-pdf.php` (eliminar los 8 handlers ya no registrados, los ayudantes privados hacia la carpeta anterior y el armado de listados desde esa carpeta, según R8 de `research.md`; verificar con `php -l personalizador-pdf.php` y `php -l inc/*.php`)

**Checkpoint**: Foundation ready - `inc/class-pmu-uploads.php` es el unico dueno del almacenamiento (con `inc/class-pmu-galeria.php` como ayudante de miniaturas) y user story implementation can now begin.

---

## Phase 3: User Story 1 - Galerías visibles y persistentes (Priority: P1) 🎯 MVP

**Goal**: El circuito subir imagen/tipografía → guardar estilo → asignar a grupo → procesar funciona al primer intento y persiste tras recargar, con miniaturas visibles y sin elementos de relleno.

**Independent Test**: Subir una imagen, una tipografía y guardar un estilo desde la pestaña del editor; recargar la página; los tres siguen listados con su miniatura y se pueden asignar a un grupo del PDF, que se procesa sin errores (recorrido §4 de `quickstart.md`).

- [X] T009 [US1] Reconstruir el puente desde el motor único en `admin/estilos-texto.php` (emitir `postMessage` con `urls` + `nonces` + inventarios en los 3 momentos —carga del iframe, aviso `textmuy-ready`, envío inmediato— con las cinco bases apuntando a `uploads/pmu/` según `contracts/bridge-editor.md`; prohibido claves por operación o bases de otra raíz)
- [X] T010 [US1] Alinear el cliente de miniaturas en `assets/miniaturas.js` (toda persistencia de sprite y de miniatura de grupo va por `POST` a `urls.motor` con `op=sprite` / `op=miniatura`; regenerar y persistir el sprite al abrir la galería si falta, según R6 de `research.md` y `contracts/motor-resources.md`)
- [X] T011 [US1] Migrar el cliente del editor al contrato único en `modules/textmuy/js/preset-manager.js` (edición directa, módulo integrado; toda escritura por `POST` a `urls.motor` con `op` —`listar`, `alta`, `baja`, `editar`— y `scope` vigente `fonts`/`img`/`tm-presets` mapeando el ámbito interno de estilos a `tm-presets`; eliminar claves por operación `guardarPreset`/`borrarPreset`/`subirImagen`/`borrarImagen`/`guardarSprite`/`cambiarImagen`/`subirFuente`/`borrarFuente`/`cambiarFuente`/`guardarMiniatura` según `contracts/bridge-editor.md` y R7 de `research.md`)
- [X] T012 [US1] Purgar respaldos y lecturas fuera del puente en `modules/textmuy/js/catalog.js`, `modules/textmuy/js/api.js`, `modules/textmuy/js/fonts.js`, `modules/textmuy/js/galeria.js` y `modules/textmuy/js/fuentes-galeria.js` (edición directa, módulo integrado; eliminar bases de respaldo, descarga sin puente, migración local, carga embebida y data-URL; sin puente el editor muestra error accionable y hace cero peticiones locales; incluir avisos visibles de galería: catálogo ausente/inválido con causa, entrada inválida saltada con contador; según `contracts/bridge-editor.md` §Purga)
- [X] T013 [US1] Endurecer el parser de catálogo al formato único en `modules/textmuy/js/catalog.js` (aceptar solo tuplas de 4 `[id,title,cats,file]`; clasificar `ok`/`free`/`invalid`, saltar `invalid` con aviso y contador; `cats` vacío ⇒ `custom`; referencias por nombre se rechazan pidiendo volver a guardar, según `contracts/catalog-schema.md`)
- [X] T014 [US1] Corregir la suite de carga a la raíz vigente en `modules/textmuy/tests/preset-load.test.js` (edición directa, módulo integrado; reemplazar la ruta heredada por la raíz única `uploads/pmu/tm-presets/presets.json`; verificar con `node tests/preset-load.test.js` desde `modules/textmuy/`)

**Checkpoint**: US1 independently functional — recorrido §4 de `quickstart.md` completo al primer intento y persistente tras recargar; `node tests/preset-load.test.js` en verde.

---

## Phase 4: User Story 2 - Raíz única de datos (Priority: P2)

**Goal**: Existe exactamente un catálogo y un sprite por ámbito junto a sus físicos, sin carpetas residuales; copiar `uploads/pmu/` reproduce el estado en otra instalación.

**Independent Test**: Con el sistema en uso, inspeccionar la carpeta de datos: hay exactamente un inventario y una hoja de miniaturas por ámbito, los archivos físicos junto a su inventario, y ninguna carpeta residual con copias. Copiar esa única carpeta de datos a otro entorno reproduce el mismo estado.

- [X] T015 [US2] Garantizar co-ubicación y limpieza de recursos en `inc/class-pmu-uploads.php` (sprite `thumbs.webp` junto a su catálogo con disposición `col=(id-1)%c`, `fila=floor((id-1)/c)`; miniaturas de grupo `{pdf}-{letra}.webp` dentro de `img/`; al borrar un PDF el PHP (`handle_borrar`) elimina datos, imágenes y miniaturas de grupo vía el motor sin residuos; `op=baja` acepta `file` además de `id` para este caso, según `data-model.md` secciones 5 y 8)
- [X] T016 [US2] Consumir solo recursos vigentes en `assets/admin.js` (el procesado usa las bases del puente; el borrado de miniaturas de grupo lo hace el PHP al borrar el PDF, no el JS; verificar que no queden referencias a la carpeta anterior ni al ayudante heredado de URLs de imágenes en `assets/admin.js`; depende de T009 puente)
- [ ] T017 [PENDIENTE-MANUAL] [US2] Verificar raíz única y ausencia de residuos según `specs/006-align-textmuy-motor/quickstart.md` secciones 2 y 3 (ejecutar la secuencia de 20 operaciones —7 altas, 6 renombres, 7 bajas— e inspeccionar `uploads/pmu/`: un catálogo y un sprite por ámbito, 0 duplicados, 0 entradas a archivos ausentes, sin `uploads/tm/` ni `uploads/pmu/tm/` salvo la vigente `uploads/pmu/tm-presets/`; requiere panel WP del administrador con datos reales — las puertas grep §2 de quickstart ya están en verde)

**Checkpoint**: US2 independently functional — respaldo = una copia de `uploads/pmu/` y restauración < 2 min (SC-006).

---

## Phase 5: User Story 3 - Fallos visibles y accionables (Priority: P2)

**Goal**: Todo fallo (catálogo ausente/inválido, recurso ausente, sin permisos, formato anterior, operación rechazada) informa operación, ámbito y motivo; el render con referencias ausentes se rechaza sin resultados parciales.

**Independent Test**: Quitar o dañar un inventario y, por separado, un recurso referenciado por un estilo; en ambos casos el sistema informa el motivo y no continúa como si nada (matriz §5 de `quickstart.md`).

- [X] T018 [US3] Propagar causas del motor sin sustituciones en `inc/class-pmu-uploads.php` (todo rechazo devuelve `motor:<op>:<motivo>` con operación+ámbito+causa; catálogo inválido y recurso ausente se rechazan sin datos sustitutos ni estados a medias, según `contracts/motor-resources.md` §Errores)
- [X] T019 [US3] Mostrar causa visible del puente en `admin/estilos-texto.php` (fallo de inventarios iniciales o de credencial del puente informa operación+ámbito+causa; la UI de galería vive en el editor y se cubre en T012; sin puente el editor no opera, según `contracts/bridge-editor.md` y §5 de `quickstart.md`)
- [X] T020 [US3] Rechazar renders con referencias ausentes en `modules/textmuy/js/editor.js` (el render headless vía `render-core.html` rechaza el lote ante el primer estilo con `id` ausente/hueco/inválido, sin resultados parciales; estilo con referencias por nombre se rechaza pidiendo volver a guardarlo, según `data-model.md` secciones 6 y 9)
- [X] T021 [US3] Detener el procesado con causa en `assets/admin.js` (si el motor o el render informa recurso faltante, el procesado del grupo se detiene e informa el recurso; restaurar el estado original tras cada escenario de `quickstart.md` §5)


---

## Phase 6: User Story 4 - Docs y despliegue coherentes (Priority: P3)

**Goal**: Toda la documentación vigente indica un único valor por dato y la guía de despliegue se completa sin archivos inexistentes.

**Independent Test**: Seguir la guía de despliegue desde cero en una instalación limpia y comprobar que cada archivo y ruta mencionados existen y que el editor queda operativo con los recursos copiados.

- [X] T022 [P] [US4] Corregir los puntos contradictorios en `AGENTS.md` (raíz `uploads/pmu/` con ámbitos `fonts`/`img`/`tm-presets` y catálogos `fonts.json`/`img.json`/`presets.json`; endpoint único `pmu_uploads` con `op`; versión de caché real RC28 en ambos HTML; módulo integrado bajo control total; lista Node de 10 suites según §1 de `quickstart.md`; sin referencias a `uploads/tm/`, `uploads/pmu/tm/` —salvo la vigente `tm-presets`— ni al flujo de importación manual, según R9 de `research.md`) —verificando además que la documentación del módulo integrado no contradiga—
- [X] T023 [P] [US4] Unificar ayuda interna y metadatos en `admin/ayuda.php` y `readme.txt` (mismos valores que `AGENTS.md`: raíz, ámbitos, catálogos, endpoint con `op`, guía de despliegue verificable paso a paso, según §7 de `quickstart.md`)
- [X] T024 [US4] Resolver la guía del módulo en `modules/LEEME.md` (opción recomendada: eliminar el flujo de importación manual —el módulo ya viene integrado— y reescribir `LEEME.md` como ficha del módulo integrado + despliegue de `uploads/pmu/`; alternativa: eliminar el archivo y todas sus referencias en `AGENTS.md`, `admin/ayuda.php` y `readme.txt`, según R8 de `research.md`)
- [X] T025 [US4] Fijar la versión de caché real en `modules/textmuy/index.html` y `modules/textmuy/render-core.html` (edición directa, módulo integrado; mismo `?v=RCn` en ambos HTML al tocar cualquier JS del módulo —bump RC27→RC28 por los cambios de esta entrega— según `contracts/bridge-editor.md`; documentar el valor vigente donde `AGENTS.md` lo declare)

**Checkpoint**: US4 independently functional — §6 y §7 de `quickstart.md` en verde, 0 referencias rotas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Puertas finales objetivas y limpieza de residuos en código, datos y documentación.

- [X] T026 [P] Búsqueda de control de cero legado en código y docs desde la raíz del repo (`grep -rn "uploads/tm/"` excluyendo `uploads/pmu/tm-presets`, `grep -rn "pmu/tm/" --include=*.php --include=*.js --include=*.md --include=*.txt . | grep -v "pmu/tm-presets"` —ambas excluyendo además `specs/` y `modules/textmuy/here/` (artefactos/historial documental) y `readme.txt` (el `== Changelog ==` es historial; filtro `grep -v "^./readme.txt"`)— y búsqueda de claves de puente por operación (`nonces.guardar*`/`urls.guardar*` etc.) en `modules/textmuy/js` deben dar 0 coincidencias; objetivo SC-003, §2 de `quickstart.md`)
- [X] T027 [P] Puertas PHP del plugin desde la raíz del repo (`php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php && php -l inc/*.php`, `php tests/motor_smoke.php` → SMOKE OK, `php tests/parity.php` → PARIDAD OK, `php tests/texto_puente.php nonce` → rechazo `motor:nonce:invalido` y `php tests/texto_puente.php nonce cap` → rechazo `motor:capacidad:invalida`, según §1 de `quickstart.md`; la fase `nonce` extiende la herramienta existente con stubs conmutables por variable de entorno, sin cambiar las fases actuales)
- [X] T028 [P] Puertas Node del módulo desde `modules/textmuy/` (`node --check js/*.js` y las 10 suites `node tests/*.test.js` en verde, según §1 de `quickstart.md`)
- [ ] T029 [PENDIENTE-MANUAL] Recorrido final integrado y limpieza de datos según `quickstart.md` (§3: 20 operaciones sin duplicados ni residuos en `uploads/pmu/`; §4: circuito completo al primer intento; §5: matriz de fallos; §6: respaldo/restauración < 2 min) y borrado de cualquier carpeta de datos anterior verificando que el sistema sigue operativo; requiere panel WP del administrador y `uploads/pmu/pdfs/muestra.pdf` (dato de usuario ausente en este checkout: las puertas automáticas que lo leen quedan documentadas en el baseline)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Primera tras Foundational (fija el puente en T009; T016 depende de él)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Reuses el puente de US1 para verificar persistencia, but independently testable por inspección de `uploads/pmu/`
- **User Story 3 (P2)**: Tras US1 (reusa motor y puente), independently testable por matriz de fallos
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Documenta el estado final; se cierra tras US1–US3 para no documentar valores intermedios

### Within Each User Story

- Motor antes que puente; puente antes que clientes; clientes antes que verificación integrada
- Story complete before moving to next priority (recomendado P1 → P2 → P3 por dependencias de verificación)
- T013 (parser) antes que T014 (suite de carga) dentro de US1

### Parallel Opportunities

- T002 y T003 (puertas base plugin vs editor) en paralelo
- T022 y T023 (docs del plugin en archivos distintos) en paralelo
- T026, T027 y T028 (búsquedas, puertas PHP, puertas Node) en paralelo
- Tras Foundational, US2/US3/US4 pueden avanzar en paralelo por distintos responsables si US1 ya fijó el puente

---

## Parallel Example: User Story 4

```bash
# Launch documentation tasks for User Story 4 together (different files, no dependencies):
Task: "Corregir los dos puntos contradictorios en AGENTS.md"
Task: "Unificar ayuda interna y metadatos en admin/ayuda.php y readme.txt"
```

## Parallel Example: Polish

```bash
# Launch final gates together (read-only verifications, no shared writes):
Task: "Búsqueda de control de cero legado en código y docs"
Task: "Puertas PHP del plugin desde la raíz del repo"
Task: "Puertas Node del módulo desde modules/textmuy/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003, línea base registrada)
2. Complete Phase 2: Foundational (T004–T008, motor único con raíz y errores)
3. Complete Phase 3: User Story 1 (T009–T014, puente + clientes + parser + suite)
4. **STOP and VALIDATE**: Recorrido §4 de `quickstart.md` + `node tests/preset-load.test.js` en verde
5. Deploy/demo if ready (galerías persistentes = valor entregado)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (una sola verdad en `inc/class-pmu-uploads.php`)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: circuito principal persistente)
3. Add User Story 2 → Test independently → Deploy/Demo (respaldo de una carpeta, 0 residuos)
4. Add User Story 3 → Test independently → Deploy/Demo (0 fallos silenciosos)
5. Add User Story 4 → Test independently → Deploy/Demo (despliegue sin sorpresas)
6. Each story adds value without breaking previous stories (cada checkpoint de historia es verde antes de seguir)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001–T008 en orden, mismo motor)
2. Once Foundational is done:
   - Developer A: User Story 1 (puente + clientes, T009–T014)
   - Developer B: User Story 2 (co-ubicación y limpieza, T015–T017)
   - Developer C: User Story 4 docs base (T022–T023, cierre final tras US1)
3. US3 (T018–T021) integra motor + puente + render: se beneficia de que A haya cerrado US1
4. Stories complete and integrate independently (cada una con su Independent Test del spec)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability (US1 = galerías persistentes, US2 = raíz única, US3 = fallos visibles, US4 = docs coherentes)
- Each user story should be independently completable and testable (criterio en su cabecera, copiado del spec)
- Trazabilidad FR: US1 ← FR-002/003/004/007/008/010/016; US2 ← FR-001/005/006/007/008/014/016; US3 ← FR-009/010; US4 ← FR-011/012/013; puertas ← FR-015
- `engine/` (Motor PDF) SIN CAMBIOS en esta feature: si `motor_smoke` o `parity` fallan, es regresión a revertir, no ajuste a consentir
- No crear piezas nuevas de arquitectura (la fase `nonce` de `tests/texto_puente.php` extiende herramienta existente): reutilizar `inc/class-pmu-uploads.php` y el puente existente (mandato de no duplicar)
- Cero legado: sin migraciones ni compatibilidad; lo heredado se elimina en la misma entrega (T007, T008, T012, T024); sin piezas nuevas de arquitectura, sí purga del legado listado
- Commit after each task or logical group; Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence


**Checkpoint**: US3 independently functional — 100% de fallos con motivo accionable, 0 silenciosos (SC-004).




---

## Linea base (T001-T003, registrada al iniciar la implementacion 2026-09-14)

**Archivos inventariados** (sin modificar): `inc/class-pmu-uploads.php` (263 lineas, catalogo
derivado `{ambito}.json` — defecto), `inc/class-pmu-galeria.php` (742 lineas, segundo motor
con raiz propia `uploads/pmu/tm/` + dispatcher muerto), `personalizador-pdf.php` (1610 lineas,
8 handlers `handle_textmuy_*` sin registrar + `handle_guardar_miniatura` + `handle_guardar_sprite`
+ ayudantes privados hacia `uploads/tm/`), `admin/estilos-texto.php` (puente con claves viejas),
`assets/admin.js` / `assets/miniaturas.js` (ThumbEngine configurable: compatible), `modules/textmuy/`
(migrado y versionado). Datos reales: `uploads/pmu/tm-presets/` (presets.json + 10 .txm),
`uploads/pmu/img/` (img.json + fisicos), `uploads/pmu/fonts/` (fonts.json + 15 MUY-*.ttf).

**Puertas PHP al inicio**:
- `php -l` (plugin, admin/, engine/, inc/): 0 errores.
- `php tests/motor_smoke.php`: FALLA — `muestra.pdf` ausente en el espejo de datos
  (`uploads/pmu/pdfs/` contiene solo `circulo6cm/` y `pdfs.json`); ademas el test apuntaba a la
  raiz heredada `uploads/personalizador-pdf/pdfs/` (ruta corregida a `uploads/pmu/pdfs/` en T002).
- `php tests/parity.php`: FALLA por la misma causa (dato de usuario no versionado).
- `php tests/texto_puente.php nonce|nonce cap`: rojas al inicio (sin verificacion de nonce),
  verdes al cierre de T004/T006.

**Puertas Node al inicio** (desde `modules/textmuy/`):
- `node --check js/*.js`: 0 errores.
- 9/10 suites en verde; `preset-load.test.js` FALLA por ruta heredada
  `uploads/tm/presets` (corregida a `uploads/pmu/tm-presets` en T014; 10/10 verdes al cierre).

**Puertas Node al cierre**: 10/10 suites OK; bump `?v=RC27` -> `?v=RC28` en ambos HTML.

**Estado final de puertas**: grep de control (quickstart §2) 0 coincidencias; `php -l` 0 errores;
`texto_puente.php nonce` y `nonce cap` OK; suites Node 10/10 OK. Pendientes manuales: T017 y T029
(recorrido en panel WP con datos reales) y `motor_smoke`/`parity` en cuanto exista
`uploads/pmu/pdfs/muestra.pdf` (dato del administrador).
