# Tasks: Fotos originales y carpeta del cliente (035)

**Input**: `specs/035-fotos-originales-cliente/` (spec, plan, research, data-model, contracts, quickstart)

**Prerequisites**: `plan.md` (fases F0-F5), `spec.md` (D1-D14, §3 contrato, §5 inventario), `research.md` (R1-R12), `data-model.md`, `contracts/fotos-originales.md`

**Tests**: **obligatorios**. El repo no tiene tests opcionales: cada fase cierra con `php -l` y la puerta de su area (AGENTS §9). Se incluyen como tareas propias.

**Organization**: la spec **no usa user stories formales** (esta organizada por decisiones D1-D14 y fases F0-F5 del plan). Para implementar y validar por incrementos se derivan **3 historias de valor**:

| Historia | Valor | Fase del plan |
|---|---|---|
| **US1** (P1) | El comprador elige una foto, se sube sola en segundo plano y se reusa en varios items | F1 + F2 |
| **US2** (P1) | Al pagar, la foto queda en la carpeta del cliente y el pedido se descarga/regenera igual | F3 |
| **US3** (P2) | La galeria marca la vista al mostrarse y habilita la compra | F4 |
| Foundational | Receta v2 (identidad de la composicion) | F0 |
| Polish | Docs, enmienda §IV de la constitucion, version | F5 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencia de tareas incompletas)
- **[Story]**: US1/US2/US3 (solo en fases de historia)
- Rutas relativas a la raiz del repo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: verificar la base y dejar los esqueletos de las puertas nuevas

- [ ] T001 Correr las puertas base y confirmar verde: `php -l personalizador-pdf.php`, `Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }`, `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php fotos`, `node tests/selector-contrato.test.js`
- [ ] T002 Crear los `case` vacios de las fases nuevas en `tests/texto_puente.php`: `receta`, `carpeta_cliente`, `traslado`, `rutas` (deben correr sin error antes de implementar)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: receta v2. Sin esto, ninguna historia puede registrar ni reconocer una composicion.

**CRITICAL**: ninguna historia empieza hasta que esta fase cierre.

- [ ] T003 [P] Reescribir `receta_de()` v2 en `inc/class-pmu-sesion.php`: claves `v,w,h,forma,modo,escala,dx,dy,fondo,transp,rot,iw,ih,phsize,gid`, hash `sha1(implode('|', valores))[:12]`, y validacion que **rechaza** `v !== 2`, `modo` fuera de `{cubrir,encajar,estirar}`, `escala` fuera de [0.25,4], `rot` fuera de `{0,90,180,270}`, `phsize` fuera de `{0,1,2}`, `gid` fuera de `^[0-9A-F]{6}$`, `dx/dy` fuera de [-1,1]
- [ ] T004 [P] Extender `_params()` en `assets/selector-pmu.js`: agregar `v:2`, `rot` (valor actual), `phsize` y `gid` de la ranura, y normalizar `dx/dy` a fraccion del lienzo (`dx = px / w`)
- [ ] T005 [P] Crear `tests/receta-contrato.test.js`: receta completa, `rot` 90 != 270, misma composicion por dos caminos = mismo hash, y cada rango invalido rechazado
- [ ] T006 Fase `receta` en `tests/texto_puente.php`: `receta_de()` acepta la receta del cliente y rechaza con causa los valores fuera de contrato (no corrige en silencio)
- [ ] T007 Ajustar los consumidores que hoy mandan `w/h` en px: `handle_subida()` (`personalizador-pdf.php:1841`) y `handle_biblioteca()` `op=usar` (`:2248`), para que guarden la receta v2 tal como llega

**Checkpoint**: `node tests/receta-contrato.test.js` y `php tests/texto_puente.php receta` en verde.

---

## Phase 3: User Story 1 - La foto se sube sola y se reusa (Priority: P1) 🎯 MVP

**Goal**: el comprador elige una foto; se acota a 2000 px, se guarda en IndexedDB y **se sube en segundo plano** a la carpeta de la sesion, donde los items la comparten por sha.

**Independent Test**: `php tests/texto_puente.php carpeta_cliente` + `node tests/fotos-contrato.test.js`: dos subidas de los mismos bytes dejan **un** archivo y **una** fila `origen: sesion`; dos items de la sesion referencian el mismo `id`; `limpiar_ttl()` no borra la carpeta compartida con items vivos.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Agregar `dir_sesion_uploads($sid, $crear = false)` en `inc/class-pmu-uploads.php` (`uploads/pmu/tmp/sesion-{sid}/uploads/`, `wp_mkdir_p` + validacion de escritura)
- [ ] T009 [P] [US1] Crear `assets/fotos-pmu.js` (`PMUFotos`): store `pmu_fotos` en IndexedDB con `{sha, blob, w, h, nombre}`, `guardar(archivo)` con cap 2000 px (canvas + WebP q0.85), `obtener(sha)`, `listar()`, `borrar(sha)`, `navigator.storage.persist()` y manejo de cuota
- [ ] T010 [US1] Revalidar el cap en `guardar_subida()` (`inc/class-pmu-sesion.php:843`): `getimagesize()` y, si `max(w,h) > 2000`, reescalar con GD; sin GD, `motor:subida:tamano`
- [ ] T011 [US1] Escribir el original en `dir_sesion_uploads($sid)` con `{id} = substr(sha1(bytes_crudos), 0, 12)`, dedupe por existencia y fila `origen: 'sesion'` (sin `file`)
- [ ] T012 [US1] Ajustar `handle_subida()` (`personalizador-pdf.php:1784`) para devolver `{id, sha, w, h, url}` del original y crear el draft si no hay item
- [ ] T013 [US1] Cola de subida en segundo plano en `assets/tienda.js`: FIFO de a 2, clave `sha` (no reenvia), 2 reintentos con backoff, promesa exportada para el add-to-cart
- [ ] T014 [US1] Disparar la subida al elegir la foto (selector/cargador) y guardar la promesa en `PMU_FICHA.subidas`
- [ ] T015 [US1] En `limpiar_ttl()` (`inc/class-pmu-sesion.php:1242`) excluir `uploads/` del conteo por item (patron `draft-`) y podar los originales que ningun item de la sesion referencia
- [ ] T016 [US1] Ajustar `podar_subidas()` (`:582`) para que una fila `origen: sesion` no borre el archivo compartido mientras otro item lo use
- [ ] T017 [US1] Fase `carpeta_cliente` en `tests/texto_puente.php`: dedupe por sha, 2 items = 1 archivo, poda por sesion, TTL con items vivos, cap 2000 (con y sin GD)
- [ ] T018 [US1] Crear `node tests/fotos-contrato.test.js`: cap 2000, dedupe, cuota/desalojo, recuperacion cuando el blob no esta

**Checkpoint**: US1 validable sola, todavia sin el arbol nuevo de `orders/`.

---

## Phase 4: User Story 2 - La foto queda en la carpeta del cliente (Priority: P1)

**Goal**: al pagarse el pedido, el item se mueve a `orders/{cliente}/{order_id}/{item_key}/` y los originales a `orders/{cliente}/uploads/`; la descarga y la regeneracion siguen funcionando.

**Independent Test**: `php tests/texto_puente.php traslado` + `php tests/texto_puente.php rutas` + `node tests/ficha-pedido.browser.js`: el pedido queda en el arbol nuevo, `manifest.cliente` escrito, filas `origen: cliente`, `tmp/orders/` no existe, el PDF se descarga con el original borrado y Pedidos lista el item.

### Implementation for User Story 2

- [ ] T019 [P] [US2] Cambiar `dir_order($cliente, $order_id, $crear)` en `inc/class-pmu-uploads.php` (`orders/{cliente}/{order_id}`) y **eliminar** `dir_tmp_order()` (`:1056`) y `ruta_order_pdf()` (`:1091`, codigo muerto)
- [ ] T020 [P] [US2] **Eliminar** `staging_order()` en `inc/class-pmu-sesion.php:1191`
- [ ] T021 [US2] Reescribir `promover_order($order_id, $cliente, $sid, $item)` (`:1211`): `rename` del item, `copy` + dedupe por `id` de los originales, filas `sesion -> cliente` con `clave`, `manifest.cliente`, todo idempotente y en una escritura atomica
- [ ] T022 [US2] Eliminar `pedido_staging_crear()` (`personalizador-pdf.php:2928`) y su hook `woocommerce_checkout_order_processed`
- [ ] T023 [US2] `pedido_promover()` (`:2965`) pasa `$order->get_customer_id()`; si es `0`, **no** promueve y deja causa visible
- [ ] T024 [US2] `manifest_item()` (`:3050`), `item_generar_pdfs()` (`:3185`) e `item_regenerar()` (`:3347`) usan `dir_order` + `manifest.cliente`; sin fallback `tmp/orders` ni `orders/{order_id}`
- [ ] T025 [US2] `pedidos_completados()` (`:3291`): escaneo de 3 niveles con `ctype_digit`, `cliente` en cada fila y `orders/{cliente}/uploads/` **excluido**
- [ ] T026 [US2] `biblioteca_contenedores()` (`:2047`) y `biblioteca_peso_identidades()` (`:1951`): escaneo de 3 niveles con `ctype_digit`
- [ ] T027 [US2] Resolver filas `origen: cliente` por `id` + `clave` (`/^\d{1,12}$/` y `/^[a-f0-9]{12}$/` + `is_file`) en `item_generar_pdfs()`; `clave_valida()` como helper unico
- [ ] T028 [US2] `admin/pedidos.php`: mostrar la columna de cliente que devuelve `pedidos_completados()`
- [ ] T029 [US2] Fases `traslado` y `rutas` en `tests/texto_puente.php`: arbol nuevo, `manifest.cliente`, `customer_id = 0` no promueve, descarga sin original, Pedidos no lista `uploads/`
- [ ] T030 [US2] Actualizar `tests/ficha-pedido.browser.js:568` (ruta del PDF) y los escaneos de `tests/estado_pmu.php`, `tests/inventario_pmu.php` y `tests/sin_lectura.php`
- [ ] T031 [US2] Verificar `php tests/motor_smoke.php` + `php tests/parity.php` en verde: **el Motor no cambia**

**Checkpoint**: US2 validable con un pedido de prueba en el lab (`orders/{cliente}/{order_id}/`).

---

## Phase 5: User Story 3 - La vista se marca al mostrarse (Priority: P2)

**Goal**: la galeria pone primero las vistas no omisibles, las marca al **pintarlas** y habilita el add-to-cart recien al ver la ultima obligatoria.

**Independent Test**: `node tests/ficha-pedido.browser.js`: con 5 vistas (3 obligatorias), el boton esta deshabilitado hasta navegar las 3; recargar conserva la marca; una vista fallida no bloquea; con la cola de subidas vacia no aparece "Estamos recibiendo tus archivos".

### Implementation for User Story 3

- [ ] T032 [P] [US3] `prepararGaleria()` (`assets/tienda.js:740`): ordenar `vistas` por `preview_omisible` ascendente y mostrar la leyenda "Revisa la vista previa" mientras falte una obligatoria
- [ ] T033 [US3] Marcar `visto` en el `pintar()` de la galeria (incluye la inicial) y persistir en `localStorage['pmu_vistas_v1'][item_key]`; leer y reconciliar al montar; migrar la clave cuando el draft se promueve
- [ ] T034 [US3] `bloqueos.vistas` (`:445`) pasa a `false` solo cuando no queda ninguna obligatoria sin ver; `bloquearCarrito()` (`:838`) consulta `faltanVistas()`
- [ ] T035 [US3] Una vista podada por error (`fallida`) **no** cuenta como obligatoria
- [ ] T036 [US3] Ampliar `tests/ficha-pedido.browser.js`: orden, marca por navegacion, habilitacion en la ultima obligatoria (y **no** antes), recarga, vista fallida y el aviso de subidas pendientes

**Checkpoint**: US3 validable sola (es ortogonal a US1/US2; se puede adelantar).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: documentacion normativa, enmienda de la constitucion y cierre

- [ ] T037 [P] Enmendar `.specify/memory/constitution.md` §IV: `orders/{cliente}/{order_id}/{item_key}`, `orders/{cliente}/uploads/`, sin `tmp/orders/`; agregar Sync Impact Report (MINOR: estructura de datos; sin cambio de principios)
- [ ] T038 [P] `AGENTS.md` §2 (mapa), §5 (formatos: carpeta del cliente, `origen: sesion/cliente`) y §7 (decisiones: receta v2, sin staging, sin cuota)
- [ ] T039 [P] `specs/030-biblioteca-imagenes/spec.md` + `contracts/`: nota de supersesion (la profundidad del `ref` y las fotos del cliente por `id` + `clave`)
- [ ] T040 `specs/INDICE.md` (fila 035 -> implementada), `readme.txt` (changelog) y version **solo en la cabecera** de `personalizador-pdf.php` -> 4.27.0
- [ ] T041 `php tests/inventario_repo.php`, `php tests/estado_pmu.php` y `php tests/sin_lectura.php` en verde
- [ ] T042 Recorrido completo del `quickstart.md` (E1-E9) en `C:\wp-lab` con evidencia
- [ ] T043 Cerrar `tasks.md` con el estado real de cada tarea y actualizar `specs/INDICE.md`
- [ ] T044 Revision de `php composer.phar run analisis` y `npx --yes jscpd@4 --config .jscpd.json .`: sin hallazgos nuevos en el codigo tocado (los previos se dejan)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — **bloquea** US1/US2
- **US1 (Phase 3)**: depende de Foundational
- **US2 (Phase 4)**: depende de **US1** (necesita originales en la sesion para trasladar)
- **US3 (Phase 5)**: **independiente** — puede correr en paralelo desde Setup
- **Polish (Phase 6)**: depende de US1 + US2 + US3

### Within US2 (el orden importa)

```
T019/T020 (P, firmas) -> T021 (promover_order) -> T022/T023 (hook + customer_id)
   -> T024-T027 (lecturas + resolucion) -> T028 (admin) -> T029-T031 (puertas)
```

### Parallel Opportunities

- **T003/T004/T005** (receta v2: PHP, JS y test Node) en paralelo
- **T008/T009** (ruta PHP + modulo IndexedDB) en paralelo
- **T019/T020** (dos archivos distintos) en paralelo
- **US3 completa (T032-T036)** en paralelo con US1/US2
- **T037/T038/T039** (tres documentos distintos) en paralelo en Polish

---

## Implementation Strategy

### MVP (solo US1)

1. Fase 1 + Fase 2
2. Fase 3 (US1)
3. **Validar**: `php tests/texto_puente.php carpeta_cliente` + `node tests/fotos-contrato.test.js`
4. **Ojo**: US1 sola **no** se despliega a produccion: el original queda en `tmp/` y muere con el TTL. Es un MVP de laboratorio.

### Incremento desplegable

1. Fase 1 + 2 + **US1 + US2** -> el original queda en `orders/{cliente}/uploads/` y los pedidos se descargan. **Este es el primer punto desplegable.**
2. **US3** (se puede adelantar en cualquier momento; es UI)
3. Polish + `quickstart` completo -> release 4.27.0

### Notas

- Cada fase cierra con `php -l` + su puerta; **no** se acumula lint para el final.
- Un commit por paso verificado (AGENTS §10.ter); el refactor de rutas (US2) va en **commit propio**.
- No se toca `engine/` ni `modules/textmuy/`; si se toca el modulo, bump `?v=RCn` (no aplica aca).
- El mockup optimizado **no** esta en estas tareas: va a la spec 036.


