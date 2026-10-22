# Tasks: Biblioteca de imagenes del comprador (spec 030)

**Input**: Design documents from `/specs/030-biblioteca-imagenes/`

**Prerequisites**: plan.md (tech + gates), spec.md (28 decisiones + 9 clarificaciones), research.md (R1-R12),
data-model.md (familia/version/ref/receta), contracts/biblioteca.md + contracts/cliente-biblioteca.md,
quickstart.md (E1-E7)

**Tests**: SI — el proyecto los exige como puertas (spec §4 y Constitution Check G7): fase `biblioteca` del
arnes + `node tests/selector-contrato.test.js`.

**Organization**: las historias (US1-US5) se derivan del §1 Problema de la spec (las consecuencias que la
feature elimina) mas el vinculo de identidad; cada una se implementa y se prueba sola.

| Historia | Prioridad | Valor | Prueba independiente |
|---|---|---|---|
| US1 — Ver y reusar mis fotos desde la ficha | **P1 (MVP)** | el comprador ve su historial en el modal y reusa una foto sin recomponer (0 bytes) | E2 + E3 |
| US2 — Una sola vez, con versiones | P2 | la misma foto no se duplica y crece sin perder calidad (`{madre}-{n}`, `base` por flag, dedupe por `sha`) | E4 + E6.1 |
| US3 — El pedido no duplica archivos | P3 | los pedidos se **referencian** entre si: la misma foto en N compras = **1** archivo (sin `_comun`, D11) | E5 |
| US4 — Control del cliente: borrar y vencer | P4 | borra su familia completa con aviso; lo temporal vence (drafts 24 h, carrito abandonado 30 dias) | E6 |
| US5 — Mi historial completo al iniciar sesion | P5 | el invitado que se registra recupera sus sesiones (`sid` -> cuenta, via Woo) | E2 + E3 con cuenta |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1..US5; Setup, Foundational y Polish no llevan etiqueta
- Rutas exactas en cada tarea

## Path Conventions

Proyecto unico (plugin de WordPress): `personalizador-pdf.php`, `inc/`, `assets/`, `tests/`, `specs/`.

---

## Phase 1: Setup

**Purpose**: dejar el terreno listo sin tocar comportamiento

- [X] T001 [P] Verificar las puertas base en verde antes de tocar nada: `php -l personalizador-pdf.php`, `php -l inc/class-pmu-sesion.php`, `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php fotos`, `node tests/selector-contrato.test.js`
- [X] T002 [P] Crear el esqueleto de la fase `biblioteca` en `tests/texto_puente.php` (case + `preparar_entorno()` con 2 sesiones, 1 pedido pagado y 1 preset) para poder correr la fase vacia
- [~] T003 Crear el accesor `dir_comun_order($order_id, $crear = false)` en `inc/class-pmu-uploads.php` (unica fuente de rutas, constitution §II)

---

## Phase 2: Foundational (bloquea TODAS las historias)

**Purpose**: piezas comunes que ninguna historia puede dar por hechas

**CRITICAL**: ninguna historia empieza hasta cerrar esta fase

- [X] T004 [P] `inc/class-pmu-sesion.php`: `mutar_manifest_dir($dir, $cb)`, `guardar_manifest_dir($dir, $manifest)` y `leer_manifest_dir($dir)` (lock `flock` + `manifest.json.tmp` + `rename`), extraidos del patron de `mutar_manifest()` (R3)
- [X] T005 [P] `inc/class-pmu-sesion.php`: `fila_subida($id, $file, $madre, $receta, $sha, $mime, $bytes, $creado)` + `fila_ref($id, $ref, $madre, $receta, $creado)` — unicos lugares de la forma de la fila (`base` no se persiste: `familias()` lo deriva por area); `fila_archivo()` se conserva para el pool
- [X] T006 [P] `inc/class-pmu-sesion.php`: `resolver_ref($dir_item, $ref)` con `realpath()` validado dentro de `uploads/pmu/` y causa `motor:descarga:ref:ausente` (R4)
- [X] T007 [P] `personalizador-pdf.php`: `biblioteca_identidad()` (cookie `pmu_sid` + cuenta) y `biblioteca_version(array $contenedores)` (hash de `{contenedor}|{item_key}|{mtime}|{size}`, R5)
- [X] T008 `personalizador-pdf.php`: `biblioteca_contenedores($identidad)` — escaneo por identidad con **tope de 10 contenedores** y `usos` por familia (D23/R1/R6)

**Checkpoint**: base lista — las historias pueden empezar (US3 y US5 incluso en paralelo)

---

## Phase 3: User Story 1 - Ver y reusar mis fotos desde la ficha (P1) MVP

**Goal**: el comprador ve su historial dentro del modal de recorte y reusa una foto; si la receta coincide se **referencia** (0 bytes)

**Independent Test**: quickstart **E2 + E3** (invitado con 1 foto en el carrito: la ve en la tira y la reusa)

### Tests for User Story 1

- [X] T009 [P] [US1] Fase `biblioteca` en `tests/texto_puente.php`: el invitado ve solo lo suyo; `madre` ajena -> `api:biblioteca:foto:ajena`; `listar` con `desde` responde `sin_cambios`; `op=usar` con receta igual escribe fila `origen: ref` y **0 bytes** (D14/R2)
- [ ] T010 [P] [US1] `tests/selector-contrato.test.js`: la tira lista **todas** las familias por fecha (D27), se monta dentro del modal (D28), `Elegir` vs `Subir` por receta y la cache `pmu_bib_v1` no repite peticion con la misma `revision` (D8/R8)

### Implementation for User Story 1

- [X] T011 [P] [US1] `assets/biblioteca-pmu.js` (NUEVO): `PMUBiblioteca.abrir/cache/invalidar/visor` + cache unica por pagina compartida por campos, invalidada por **re-consulta** tras subir o borrar (D23/R8)
- [X] T012 [P] [US1] `assets/biblioteca-pmu.js`: tira `pmu-bib-tira` (**una imagen por familia** desde `op=imagen`, hasta 10 fotos, orden por fecha, badge `N versiones`, `usos`) y visor `pmu-bib-visor` con **Elegir**
- [X] T013 [US1] `assets/selector-pmu.js`: montar la tira en `spmu-modal` (boton **Elegir ya subida**) y abrir el recorte con la fuente elegida (`onElegir` -> `open({archivo})`); el visor que usa es el **compartido** (T043)
- [ ] T014 [US1] `assets/cargador-pmu.js`: pasar a la biblioteca la `receta` del hueco (`w,h,forma,modo,escala,dx,dy,fondo,transp,iw,ih`) y el `onElegir`
- [ ] T015 [US1] `assets/tienda.js`: `api.biblioteca` + `PMU_FICHA.biblioteca = {endpoint, nonce}` (identidad por cookie, D14)
- [X] T016 [US1] `personalizador-pdf.php`: `handle_biblioteca()` con `op=listar|imagen|usos|usar`, nonce `personalizador_pdf_vista_previa`, `admin_post_*` + `nopriv` (D19) y encolar `assets/biblioteca-pmu.js` en `assets_ficha()`
- [X] T017 [US1] `inc/class-pmu-sesion.php`: `usar_de_biblioteca($sid, $item, $pdf, $grupo, $madre, $indice, $params)` — receta **recomputada en el servidor** (R2): copia desde `tmp`, referencia desde `orders` y versiona si difiere (D8/D9/D10)

**Checkpoint**: US1 probable sola (E2 + E3) = MVP entregable

---
## Phase 4: User Story 2 - Una sola vez, con versiones (P2)

**Goal**: la misma foto aparece **una sola vez** en la galeria y crece sin perder calidad (`base` por flag)

**Independent Test**: **E4** (reusar en otra proporcion) + **E6.1** (resubir la misma foto)

### Tests for User Story 2

- [~] T018 [P] [US2] Fase `biblioteca` en `tests/texto_puente.php`: subir dos veces la misma foto reusa la familia (1 entrada); recomponer crea `{madre}-2`; el `base` se promueve por area (D5/D6/D24)

### Implementation for User Story 2

- [X] T019 [US2] `inc/class-pmu-sesion.php`: `guardar_subida()` calcula `madre`, `receta` y `sha` (sha de los bytes **antes** de `convertir_webp()`, R9) y numera `{madre}-{n}` (primer `n >= 2` libre del item, R11)
- [ ] T020 [US2] `inc/class-pmu-sesion.php`: `promover_base($familia)` — el flag `base` se mueve comparando area `w*h`, **nunca** con `rename` (D6/R11): **no hace falta** — `PMU_Sesion::familias()` DERIVA la base por area (una sola verdad, sin flag persistido)
- [ ] T021 [US2] `personalizador-pdf.php`: `handle_subida()` — dedupe por `sha` contra las **bases** del listado vigente (mismo alcance que la galeria, D24/R9)

**Checkpoint**: US2 probable sola (E4 + E6.1)

---

## Phase 5: User Story 3 - El pedido no duplica archivos (P3)

**Goal**: los pedidos se **referencian** entre si (la fila `origen: ref` apunta al archivo de origen; sin `_comun`)

**Independent Test**: **E5** (2 items con la misma foto, ya comprados)

### Tests for User Story 3

- [~] T022 [P] [US3] **OBSOLETA** con D11 revisado: los checks de `ref` (valido, roto y `resolver_subidas`) ya estan en la fase `biblioteca` (T009)

### Implementation for User Story 3

- [~] T023 [US3] **OBSOLETA** con D11 revisado: no hay `consolidar_order()` ni `_comun` (la referencia apunta al archivo de origen) `inc/class-pmu-sesion.php`: `consolidar_order($order_id)` — agrupa por `(madre, receta)`, gana el de mayor resolucion, arma `tmp/orders/{order}/_comun/`, borra los duplicados y reescribe **todas** las filas a `ref` (idempotente, D11/R3/R12)
- [~] T024 [US3] **OBSOLETA** con D11 revisado: no hay `_comun` que mover en la promocion
- [X] T025 [US3] `personalizador-pdf.php`: `item_generar_pdfs()` resuelve `origen: ref` con `resolver_ref()` (hoy `!is_file` saltea en silencio en la linea 2621) (D13)
- [X] T026 [US3] `inc/class-pmu-sesion.php`: `resolver_subidas()` contempla las filas `origen: ref` (miniaturas de la ficha) (D13)
- [X] T027 [US3] `inc/class-pmu-sesion.php`: `podar_subidas()` — una fila `ref` no cuenta como archivo local en uso (D13)

**Checkpoint**: US3 probable sola (E5)

---

## Phase 6: User Story 4 - Control del cliente: borrar y vencer (P4)

**Goal**: el cliente borra **foto por foto** (familia completa, con aviso) y lo temporal vence

**Independent Test**: **E6** (borrado con aviso + TTL)

### Tests for User Story 4

- [X] T028 [P] [US4] Fase `biblioteca` en `tests/texto_puente.php`: el borrado elimina la original y sus versiones con sus filas; el aviso lleva los `usos`; el barrido respeta drafts 24 h / carrito abandonado 30 dias y **no** toca lo referenciado (D17/D25/D26)

### Implementation for User Story 4

- [X] T029 [US4] `inc/class-pmu-sesion.php`: `borrar_familia_dir($dir, $madre)` por `PMU_Sesion` (manifiesto + archivo) devolviendo los `usos` para el aviso (D17/D25)
- [X] T030 [US4] `personalizador-pdf.php`: `op=borrar` en `handle_biblioteca()` — re-resuelve la `madre` contra el escaneo propio y **no** bloquea (solo avisa) (D17/D19)
- [X] T031 [US4] `assets/biblioteca-pmu.js`: **Borrar** en el visor: pide `op=usos` (situacion en vivo), confirma con ese aviso y **vuelve a pedir la lista** despues (D25/R8)
- [X] T032 [US4] `inc/class-pmu-sesion.php`: `limpiar_ttl()` — drafts 24 h, sesiones sin items e items de carrito abandonados 30 dias **desde `manifest.creado`**, siempre **por item completo** (D18/D26/R10)
- [X] T033 [US4] `personalizador-pdf.php`: agendar el barrido con `wp_schedule_event` diario (hoy `limpiar_ttl()` no tiene ningun llamador) (D18/R10)

**Checkpoint**: US4 probable sola (E6)

---

## Phase 7: User Story 5 - Mi historial completo al iniciar sesion (P5)

**Goal**: lo que el invitado subio se une a su cuenta y lo ve desde cualquier dispositivo

**Independent Test**: **E2 + E3** con cuenta (loguearse despues de subir)

### Tests for User Story 5

- [ ] T034 [P] [US5] Fase `biblioteca` en `tests/texto_puente.php`: el logueado ve `wc_get_orders(customer_id)` + las sesiones de sus `_pmu_sids`; una request **deslogueada** no consulta el vinculo (D3/R1)

### Implementation for User Story 5

- [ ] T035 [US5] `personalizador-pdf.php`: `vinculo_sid_usuario()` en `woocommerce_guest_session_to_user_id` (y fallback `wp_login` con `version_compare(WC()->version, '8.8', '>=')` para Woo viejo) -> `update_user_meta($uid, '_pmu_sids', ...)` con dedup y cap 20 (D3/R1)
- [ ] T036 [US5] `personalizador-pdf.php`: `biblioteca_identidad()` suma los `_pmu_sids` del usuario a la lista de sesiones (D3)

**Checkpoint**: US5 probable sola

---

## Phase 8: Polish & Cross-Cutting Concerns

> T043-T046 son de **US1** (quedaron listadas aca por el orden en que se agregaron; su codigo es el visor compartido).

**Purpose**: docs, constitucion, release y recorrido real

- [ ] T037 [P] `AGENTS.md`: mapa (§2), convenciones (§5: familias `{madre}-{n}` y `origen: ref`), decisiones (§7), pruebas (§9: fase `biblioteca`) y errores (§11: `api:biblioteca:*`, `motor:descarga:ref:ausente`, y el invariante "no se purga un pedido referenciado" de D12)
- [ ] T038 [P] `specs/004-woocommerce-pdf-personalization/contracts/sesion-item.md`: firmas nuevas (`fila_subida`, `usar_de_biblioteca`, `borrar_familia_dir`, `mutar_manifest_dir`, `resolver_ref`, `familias`, `familia_de`, `ruta_familia`; y `biblioteca_ruta_imagen`/`biblioteca_mime_de` en el plugin)
- [ ] T039 [P] `.specify/memory/constitution.md`: enmienda §IV (familias `{madre}-{n}` y `origen: ref`: convenciones de `subidas/`, sin cambio estructural) + Sync Impact Report MINOR, sin tocar principios (y nota del cache de cliente: metadatos, nunca bytes)
- [ ] T040 [P] `specs/INDICE.md` + `readme.txt` (changelog) + bump de version **solo en la cabecera** de `personalizador-pdf.php` -> 4.22.0
- [ ] T041 `php tests/inventario_repo.php`, `php tests/sin_lectura.php` y `php tests/estado_pmu.php` en verde (leer la galeria no escribe catalogos)
- [X] T043 [P] [US1] `assets/visor-pmu.js` (NUEVO, **extraido** de `cargador-pmu.js`): `PMUVisor.abrir({items, indice, acciones, fuente, titulo, tecnico})` con navegacion sin `await`, `<img>` reusado, precarga de vecinos y `decoding="async"` (D28)
- [X] T044 [US1] `assets/cargador-pmu.js`: usar `PMUVisor` (eliminar `_abrirVisor`), mandar los `items` con `url` ya resuelta y el segmento **En este campo / Mis imagenes** (D28/D23)
- [X] T045 [US1] `personalizador-pdf.php` + `assets/tienda.js`: `handle_subida` devuelve `url`; `PMU_FICHA.urls` publica las URLs de lo cargado; `op=imagen` sirve tambien `item_key`+`id` (D14/D23)
- [ ] T046 [US1] Puertas del visor: **0 POST por paso** al navegar 5 fotos (la URL sale del mapa `id -> url`), checks en `tests/selector-contrato.test.js` y `tests/campos-contrato.test.js`
- [ ] T042 Recorrido manual en WP real (quickstart **E1-E8**, incluida la medicion de volumen de E8): 2 productos con la misma foto, compra, la fila ref al archivo de origen (sin `_comun`), borrado con aviso y vencimiento de sesiones

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001-T003)**: sin dependencias
- **Foundational (T004-T008)**: depende de Setup y **bloquea** todas las historias
- **US1 (T009-T017)**: depende de Foundational; es la MVP
- **US2 (T018-T021)**: depende de Foundational; comparte archivo con US1 (`inc/class-pmu-sesion.php`) -> conviene despues de US1
- **US3 (T022-T027)**: depende de Foundational; toca otros archivos -> puede ir en paralelo con US2
- **US4 (T028-T033)**: depende de Foundational y de US2 (borra la familia completa, con sus versiones)
- **US5 (T034-T036)**: depende de Foundational; independiente -> puede ir en paralelo con US2/US3
- **Polish (T037-T042)**: al final; T039 necesita el layout ya implementado

### Within Each User Story

- Los tests primero y deben **fallar** antes de implementar; luego filas/modelos, despues servicios, despues el endpoint y al final el cliente

### Parallel Opportunities

- Setup: T001 y T002 [P]
- Foundational: T004, T005, T006 y T007 [P] (funciones y archivos distintos)
- US1: T009 y T010 [P] (arnes vs suite Node) y T011 + T012 [P] (modulo nuevo, dos bloques)
- Entre historias: US3 y US5 pueden ir en paralelo con US2
- Polish: T037-T040 [P] (documentos distintos)

---

## Parallel Example: User Story 1

```powershell
php tests/texto_puente.php biblioteca        # T009 (debe fallar al principio)
node tests/selector-contrato.test.js         # T010
node --check assets/biblioteca-pmu.js        # T011 + T012 (modulo nuevo)
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Setup (T001-T003) -> 2. Foundational (T004-T008) -> 3. US1 (T009-T017)
4. **PARAR y VALIDAR** con el quickstart **E2 + E3**: el invitado ve su foto y la reusa con **0 bytes**
5. Recien despues: US2 -> US3 -> US4 -> US5 -> Polish

### Incremental Delivery

1. **US1** = valor inmediato (ver y reusar) — desplegable
2. **US2** = una entrada por foto (`sha` + versiones) — desplegable
3. **US3** = ahorro real de disco entre pedidos (la referencia `ref` al archivo de origen) — desplegable
4. **US4** = control del cliente + limpieza (el cron se despliega con el TTL ya probado)
5. **US5** = historial por cuenta (invitado -> registrado)

---

## Notes

- `[P]` = archivos distintos; `[USn]` = historia (trazabilidad); cada historia se valida sola con el quickstart
- La fase `biblioteca` del arnes es la puerta principal: no cerrar una historia con sus checks en rojo
- **No** se toca `engine/*` (el Motor no cambia) ni `modules/textmuy/`
- Toda ruta nueva sale de `PMU_Uploads` (constitution §II) y todo dato vive en `uploads/pmu/` (§IV)
- Referencias de decision: `spec.md` (D1-D28) y `research.md` (R1-R12)
