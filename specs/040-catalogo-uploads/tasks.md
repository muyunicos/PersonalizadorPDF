# Tasks: Catalogo de uploads y biblioteca por carpetas

**Input**: Design documents from `/specs/040-catalogo-uploads/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/uploads-catalogo.md

**Organization**: tareas agrupadas por historia de usuario (US1..US4). Las puertas del repo
(`AGENTS.md` §9) son obligatorias, por eso cada fase incluye la actualizacion de su suite.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1..US4 (solo en las fases de historia)
- Rutas exactas en cada descripcion.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: nombres y helpers compartidos del ambito `uploads/`

- [X] T001 Agregar en `inc/class-pmu-uploads.php` las constantes del formato (`CATALOGO_UPLOADS = 'uploads.json'`, sufijo `-80x80.webp`) y un helper `dir_uploads_identidad($identidad)` que devuelve **la carpeta de originales de la identidad** (`tmp/sesion-{sid}/uploads/` para invitado; `orders/{uid}/uploads/` para cliente).
- [X] T002 [P] Documentar en el docblock de `inc/class-pmu-uploads.php` que el catalogo es dato DERIVADO y reconstruible (FR-006) y que no se sirve por ruta propia (FR-013).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: catalogo, miniaturas y escritura desde el ciclo. Bloquea las 4 historias.
**CRITICAL**: ninguna historia empieza hasta cerrar esta fase.

- [X] T003 Implementar en `inc/class-pmu-uploads.php`: `catalogo_leer($dir)` (tolerante: ausente/ilegible/`version` desconocida = `null`), `catalogo_mutar($dir, callable $fn)` que **serializa** la mutacion con `flock` sobre `uploads.json.lock` (mismo patron que `mutar_manifest_dir` en `inc/class-pmu-sesion.php`), lee DENTRO del lock, aplica `$fn(&$datos)` y escribe atomico (`.tmp` + `rename`), y los envoltorios `catalogo_upsert($dir, $id, array $datos)` / `catalogo_borrar($dir, $id)`. **Toda** escritura del catalogo pasa por `catalogo_mutar()` (FR-004/FR-005); el listado lee sin lock.
- [X] T004 [P] Implementar `PMU_Uploads::miniatura_generar($rutaOriginal, $lado = 80)` (GD, **cover al centro**, WebP q82) y `PMU_Uploads::miniatura_ruta($rutaOriginal)` -> `{id}-80x80.webp`, con degradacion a '' si falta GD o la imagen es ilegible, en `inc/class-pmu-uploads.php`.
- [X] T005 [P] Implementar `PMU_Uploads::catalogo_reconstruir($dir)` que arma el catalogo **solo desde los archivos** (`id`, `ext`, `bytes`, `w`, `h`, `creado`), **sin recetas** (aclaracion 2026-11-19), omitiendo `uploads.json` y las miniaturas, en `inc/class-pmu-uploads.php`.
- [ ] T006 Actualizar `PMU_Sesion::guardar_subida()` en `inc/class-pmu-sesion.php` para escribir en **la carpeta de la identidad** (cliente -> `orders/{uid}/uploads/`; invitado -> `tmp/sesion-{sid}/uploads/`) y **delegar** en `PMU_Uploads::catalogo_upsert()` (dueno unico del catalogo) el alta/refresh de la entrada (`ext`, `bytes`, `w`, `h` con `w/h >= 1`, `creado`, `ultimo_uso`) y generar `{id}-80x80.webp`; re-subir el mismo contenido refresca la entrada sin duplicar. Toda escritura pasa por `catalogo_upsert()` (que serializa con `catalogo_mutar`).
- [ ] T007 Actualizar el camino de declaracion de receta (spec 035 D9, `registrar_fotos`) en `inc/class-pmu-sesion.php` para **delegar** en `PMU_Uploads::catalogo_upsert()` el upsert de `recetas["{gid}-{w}x{h}-{phsize}"]` con `params` validados y `ts`, descartando `params` invalidos. La receta entra por `catalogo_upsert()` (serializado).
- [X] T008 Arnes propio `tests/catalogo_uploads.php` (15 checks, corre fuera de WP con stubs en %TEMP%): carpetas por identidad, mutacion serializada, upsert/merge de recetas, miniatura 80x80 cover y reconstruccion **sin** recetas (`php tests/catalogo_uploads.php` -> `CATALOGO UPLOADS OK`).

- [ ] T029 Ciclo de vida (FR-016): al promover el item a pedido **no se mueven originales** (ya estan en la carpeta de la cuenta); ajustar `trasladar_originales()` en `inc/class-pmu-sesion.php` para que sea no-op/idempotente y mueva solo el manifiesto, dejando el catalogo del cliente intacto.
- [ ] T030 Ciclo de vida (FR-017): extender la poda en `inc/class-pmu-sesion.php` para usar el **ultimo uso** del catalogo, **nunca** eliminar imagenes con pedido y limpiar entradas/miniaturas huerfanas.
- [ ] T031 Ciclo de vida (FR-018): **fusionar** la migracion con el vinculo que ya existe: extender `vinculo_sid_usuario()` en `personalizador-pdf.php` (el unico punto que corre en `wp_login` y en el alta del checkout) para que, ademas de vincular el `sid`, **migre** `tmp/sesion-{sid}/uploads/` -> `orders/{uid}/uploads/` (originales + miniaturas + fusion del catalogo, idempotente), delegando en `PMU_Sesion::migrar_uploads_a_cliente($sid, $uid)` en `inc/class-pmu-sesion.php`.

> **Orden de ejecucion**: T029, T030 y T031 cierran la Fase 2 aunque sus IDs sean altos (se agregaron despues, por el analisis). Sin ellas, el catalogo queda sin mantenimiento (promover, podar) y el cliente no ve sus fotos de invitado.

**Checkpoint**: catalogo y miniaturas listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Bibliotecas instantaneas (Priority: P1) 🎯 MVP

**Goal**: el listado sale de las carpetas de originales y la lectura por `id` es O(1).

**Independent Test**: con 10 imagenes propias y pedidos de otros clientes, `op=listar` responde rapido,
no incluye imagenes ajenas y una apertura del modal produce **una** solicitud.

- [ ] T009 [US1] Reescribir la rama `op=listar` de `handle_biblioteca()` en `personalizador-pdf.php` para armar las fotos desde **la carpeta de la identidad** (`dir_uploads_identidad()`) + `catalogo_leer()`, sin leer manifiestos ni consultar pedidos ajenos (FR-001..FR-003).
- [ ] T010 [P] [US1] Cambiar `biblioteca_ruta_imagen()` en `personalizador-pdf.php` para resolver por `PMU_Sesion::resolver_original($id, $clave, $sid)` **segun identidad** (cliente -> `orders/{clave}/uploads/`; invitado -> `tmp/sesion-{sid}/uploads/`), eliminando el recorrido de contenedores (FR-008).
- [ ] T011 [US1] Ajustar `assets/biblioteca-pmu.js` al payload nuevo (`id`, `url`, `thumb`, `bytes`, `w`, `h`, `recetas`) manteniendo el dedupe en vuelo de `pedir()` y el calentado con copia fresca (SC-002).
- [ ] T012 [US1] Actualizar `tests/biblioteca-contrato.test.js` (payload, dedupe, sin `contenedores`/`madre`, y **sin ruta publica del catalogo**: ninguna rama sirve `uploads.json`, FR-013) y los checks que hoy esperan `op=imagen` con `item_key`; correr `node tests/biblioteca-contrato.test.js`.

**Checkpoint**: US1 entregable (listado rapido) sin depender de las demas historias.

---
## Phase 4: User Story 2 - Encuadre recordado sin subir bytes (Priority: P1)

**Goal**: al elegir una imagen ya usada se recupera su receta **del contexto actual** y, si no se
retoca, no viaja ningun byte.

**Independent Test**: subir y encuadrar; reabrir; elegir la misma imagen -> vuelve el encuadre y el
primario ofrece usarla sin cambios; con otra forma/tamano -> encuadre por defecto.

- [ ] T013 [US2] En `assets/selector-pmu.js`, al cargar una imagen de la biblioteca tomar la receta por clave `"{gid}-{w}x{h}-{phsize}"` desde `foto.recetas` y re-aplicarla (escala, `ox/oy`, `rot`, `modo`, `fondo`) **solo si la clave coincide** con el contexto del campo (FR-009, US2 esc. 2).
- [ ] T014 [P] [US2] En `assets/cargador-pmu.js`, pasar el contexto y las recetas de la foto al selector; mantener el primario `Usar` con **0 bytes** cuando la receta no cambia y el resguardo que sube si el comprador reencuadra (FR-015, SC-003).
- [ ] T015 [US2] Actualizar `node tests/selector-contrato.test.js` y `node tests/biblioteca-contrato.test.js` para la receta por clave (no por `params` plano) y correr ambas suites.

**Checkpoint**: US2 entregable sobre US1; sigue siendo testeable por separado.

---

## Phase 5: User Story 3 - Miniaturas en la tira (Priority: P2)

**Goal**: la tira pide miniaturas (80x80 cover) y nunca la foto completa.

**Independent Test**: con originales de 2000 px, cada miniatura servida pesa <20 KB y la tira se pinta
sin descargar el original.

- [ ] T016 [US3] **Adaptar** el `op=miniatura` existente en `personalizador-pdf.php` (hoy cachea en `tmp/miniaturas/`): servir `{id}-80x80.webp` junto al original (generarla si falta), `Content-Type: image/webp`, `ETag` y degradacion al original si no hay GD; retirar el cache viejo (FR-007, SC-004).
- [ ] T017 [P] [US3] En `assets/biblioteca-pmu.js`, usar `thumb` para la tira y reservar `url` para la vista grande/recorte; verificar que el visor sigue navegando con URLs ya resueltas.
- [ ] T018 [US3] Ampliar `node tests/fotos-contrato.test.js` y la fase `biblioteca` con la miniatura: existe tras subir, mide 80x80 y se regenera si se borra el archivo (`php tests/texto_puente.php biblioteca`).

**Checkpoint**: US3 entregable; SC-004 medible en Network.

---
## Phase 6: User Story 4 - Quitar del campo no es borrar (Priority: P2)

**Goal**: separar "quitar la referencia de un campo" de "borrar la imagen desde la galeria", con
confirmacion solo cuando la imagen esta en carrito o en un pedido.

**Independent Test**: quitar una foto de un campo la deja en la galeria; borrarla desde la galeria sin
referencias la elimina directo; con una referencia en carrito pide confirmacion y, al aceptar, elimina.

- [ ] T019 [US4] En `assets/cargador-pmu.js`, `_quitar()` deja de llamar `PMU_API.borrarFoto`: solo quita la referencia de la ranura (sin tocar archivo, miniatura ni catalogo). **Revierte la 039 D3** (FR-011).
- [ ] T020 [P] [US4] En `personalizador-pdf.php`, **reemplazar** el `op=borrar` de un paso (039 D3) por el de dos pasos: sin `confirmar`, si hay referencias en carrito/pedidos responder `requiere_confirmacion` + `referencias: {carrito, pedidos}` (separadas, para que la UI distinga el aviso de FR-019); con `confirmar=1` (o sin referencias) borrar y responder `borrado` (FR-012, FR-014, FR-015).
- [ ] T021 [US4] En `inc/class-pmu-sesion.php`, `referencias_en_carrito_o_pedidos($id)` (devuelve `{carrito, pedidos}`; los borradores NO cuentan) y `borrar_imagen_galeria($id)` que elimina original, miniatura y entrada del catalogo cuando corresponde (**delegando** la baja en `PMU_Uploads::catalogo_borrar()`, que serializa via `catalogo_mutar`); si `pedidos > 0`, la UI pide confirmacion y advierte que ese pedido deja de poder regenerarse (FR-019).
- [ ] T022 [P] [US4] En `assets/biblioteca-pmu.js` (tira/acciones) y `assets/visor-pmu.js`, agregar la accion **Borrar** de la galeria usando el mini-dialogo de confirmacion existente; si `referencias.pedidos > 0`, el dialogo **advierte que ese pedido deja de poder regenerarse** (FR-019).
- [ ] T023 [US4] Actualizar la fase `biblioteca` de `tests/texto_puente.php` (quitar no borra; borrar sin referencias; borrar con referencia pide confirmacion) y `node tests/biblioteca-contrato.test.js`.

**Checkpoint**: US4 entregable; el flujo de cargas queda coherente con la spec.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Retirar `biblioteca_contenedores()` de la ruta de lectura de `personalizador-pdf.php` (y el remanente de F2), dejando solo lo que el borrado necesite.
- [ ] T025 [P] Corregir las 41 referencias "spec 041" -> "spec 040" en `assets/selector-pmu.js`, `assets/cargador-pmu.js`, `assets/biblioteca-pmu.js`, `assets/tienda.js`, `inc/class-pmu-sesion.php`, `personalizador-pdf.php`, `tests/texto_puente.php`, `tests/campos-contrato.test.js`, `tests/biblioteca-contrato.test.js`.
- [ ] T026 [P] Documentar: `AGENTS.md` §5 (formato `uploads.json` + `{id}-80x80.webp`), `docs/decisiones.md` (supersede 039 D3 + catalogo), `specs/INDICE.md` (fila 040) y `readme.txt` (changelog + version).
- [ ] T027 Correr la bateria de `specs/040-catalogo-uploads/quickstart.md`: `php -l` (plugin, `admin/`, `engine/`, `inc/`), `node --check` de los JS tocados, suites JS (`tests/biblioteca-contrato.test.js`, `tests/fotos-contrato.test.js`, `tests/selector-contrato.test.js`, `tests/campos-contrato.test.js`, `tests/cola-subida.test.js`), fase `biblioteca` de `tests/texto_puente.php`, `tests/sin_lectura.php`, `tests/motor_smoke.php`, `tests/parity.php` y PHPStan sobre `engine/`.
- [ ] T028 Verificar en navegador siguiendo `specs/040-catalogo-uploads/quickstart.md` §5: **una** solicitud `op=listar`, miniaturas de pocos KB, un click para abrir el recorte, encuadre recordado y, al borrar, confirmacion segun FR-014 (con pedido, aviso de FR-019).
---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende del Setup y **BLOQUEA** las 4 historias (T003..T008).
- **US1 (P1)**: depende de la Fase 2. Es el MVP.
- **US2 (P1)**: depende de US1 (necesita el payload con `recetas`).
- **US3 (P2)**: depende de la Fase 2; puede ir en paralelo con US1/US2 salvo T017 (usa `thumb` del payload).
- **US4 (P2)**: depende de la Fase 2; toca el visor compartido, conviene despues de US3 para no chocar.
- **Polish (Fase 7)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1**: independiente.
- **US2**: requiere US1 (recetas en el listado).
- **US3**: independiente (endpoint + tira), salvo el campo `thumb` que nace en US1.
- **US4**: independiente del listado; comparte el mini-dialogo con US3.

### Within Each Story

- El contrato se implementa antes que el cliente que lo consume.
- Cada fase cierra con su suite en verde (`AGENTS.md` §9), no al final.
- Un commit por paso verificado.

### Parallel Opportunities

- T002 con T003 (docblock vs codigo).
- T004 y T005 entre si (miniatura vs reconstruccion).
- T010 (resolver O(1)) en paralelo con T011 (cliente) una vez fijado el payload.
- T013 y T014 (selector vs cargador) si se acuerda antes la forma de `recetas`.
- T017 (thumb en la tira) con T020 (borrado en dos pasos).
- T022 (UI del borrado) con T021 (servidor del borrado), si el contrato C5 ya esta.
- T024, T025 y T026 (limpieza, renumeracion y docs) son independientes entre si.

---

## Parallel Example: User Story 1

```text
T010 resolver imagen/miniatura por resolver_original()   -> personalizador-pdf.php
T011 ajustar el cliente al payload nuevo                 -> assets/biblioteca-pmu.js
```

## Parallel Example: User Story 4

```text
T020 op=borrar en dos pasos                              -> personalizador-pdf.php
T021 referencias_en_carrito_o_pedidos + borrar galeria   -> inc/class-pmu-sesion.php
T022 accion Borrar + confirmacion en la galeria          -> assets/biblioteca-pmu.js, assets/visor-pmu.js
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Cerrar Fase 1 + Fase 2 (catalogo y miniaturas).
2. Implementar US1 (listado por carpetas + lectura O(1)).
3. **PARAR y VALIDAR**: SC-001 (apertura <300 ms) y SC-002 (una solicitud) con 10 imagenes y pedidos
   ajenos en el sitio.
4. Desplegar si el laboratorio da verde.

### Incremental Delivery

1. US1 -> velocidad (MVP).
2. US2 -> encuadre recordado y 0 bytes al reutilizar.
3. US3 -> miniaturas (<20 KB por imagen).
4. US4 -> quitar != borrar, con confirmacion cuando corresponde.
5. Cada historia se valida sola y no rompe las anteriores.

### Notes

- T019 **revierte** la 039 D3: el commit debe decirlo y `docs/decisiones.md` registrar la supersesion.
- Los catalogos son dato derivado: cualquier fallo se resuelve reconstruyendo (T005), nunca borrando
  datos del comprador.
- No se toca `engine/` en ninguna tarea.
- Las 41 referencias `spec 041` -> `040` (T025) son comentarios: no cambian comportamiento, pero deben
  quedar antes de cerrar la feature.