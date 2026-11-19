# Spec 039 — Motor de cargas: friccion del pipeline del comprador

> Estado: **borrador** (2026-11-19).
> Release prevista: **4.30.0**.
> **Alcance**: (A) el pipeline de cargas tal como lo usa el comprador en la ficha. **NO** agrega
> edicion de imagen (filtros, recorte libre, texto sobre la foto): eso sigue en el gancho
> `ajustes: []` de `assets/selector-pmu.js`, sin tocar.
> **No toca**: `engine/` (el Motor no se toca), `modules/textmuy/` (sin bump `?v=RCn`), el tema
> `muyunicos` (los motores `MU.visor`/`MU.coleccion` quedan como estan).
> **Enmienda** a las specs 016 (D1/D8/D9), 021 (D9), 024, 028 (D6/D8), 030 (D5/D8/D24/D25/D28) y
> 035 (C2/C5/C7); la 030 queda **superada en su modelo de "familias"** por la D5 de esta spec.

## 1. El problema (verificado en el codigo)

El pipeline de cargas funciona y esta cubierto por puertas (specs 016/019/021/024/026/027/028/030/035/036).
La friccion no esta en el diseno: esta en **casos que ninguna spec cablea** y en **codigo que quedo
vivo de un modelo conceptual que ya se abandono** (las "familias" de la 030, que la 035 reemplazo
por "una imagen + recetas"). Cada hallazgo se cita con archivo y linea.

| # | Hallazgo | Evidencia |
|---|---|---|
| **H1** | La rama de **reuso** (`op=usar`) marca `_yaElegido = true` **antes** de saber si el servidor reutilizo. Si `usar` falla o responde `coincide:false`, el `catch` reintenta pero la condicion de entrada ya no se cumple: **sube el archivo como nuevo** (bytes duplicados, familia nueva). Ademas el boton queda mudo en `"Eligiendo..."` sin causa visible. | `assets/selector-pmu.js:1637-1657` (`this._yaElegido = true` en `:1640`; `catch` en `:1652-1655`); `_actualizarPrimario` `:1293-1300`; `biblioteca-pmu.js:352-375` (`usar`); `tienda.js:2002-2013` (`api.usarBiblioteca`); `personalizador-pdf.php:2457-2483` (`op=usar`) |
| **H2** | Al **Eliminar** una foto desde el visor **no hay confirmacion**: un toque la borra. Y despues el visor **se reabre** con la posicion ya corrida, asi que el comprador ve la foto siguiente sin entender que paso. La 016 FR-016 pedia "confirmacion visual"; nunca se implemento. | `assets/cargador-pmu.js:628-630` (`onAccion` de `Eliminar` -> `_quitar` + `_abrirVisorCompartido`); `_quitar` `:650-653` (splice directo); `assets/visor-pmu.js` no tiene `confirm` |
| **H3** | Un **fallo de subida** deja el modal sin salida: el `catch` limpia el estado y llama `_fallo('UPLOAD_FAILED', ...)`; el cargador solo pinta `cpmu-error`. **No hay "Reintentar"** y el recorte que el comprador acaba de componer se pierde (hay que cargar la foto de cero). | `assets/selector-pmu.js:1714-1720` (rechazo sin reintento); `assets/cargador-pmu.js:436-446` (`onError` -> `_error`); `assets/cargador-pmu.js:660-674` (`cpmu-error` sin accion) |
| **H4** | Al **quitar** una foto se borra del estado local, pero la fila del `manifest.subidas[]` y el archivo `uploads/{id}.{ext}` **siguen en el servidor** hasta que el TTL del item vence (30 dias). Las "familias" y sus versiones quedan en la tira aunque el comprador ya las descarto. | `assets/cargador-pmu.js:650-653` (`_quitar` solo hace `splice`); `inc/class-pmu-sesion.php:1515` (`limpiar_ttl`); `personalizador-pdf.php:261-264` (`handle_limpieza_ttl`) |
| **H5** | La **cola de subida** expone `vaciar()` y `pendientes()` pero no **que** queda en vuelo. Si una subida se traba, el comprador ve "Estamos recibiendo tus archivos" sin fin y sin pista. | `assets/tienda.js:1956-1959` (`api.subidas`); `assets/tienda.js:664-675` (`subidasPendientes`); `assets/fotos-pmu.js:182-332` (`crearCola`) |
| **H6** | **Codigo muerto del modelo "familias"**. La 035 ya establecio que "la familia es el propio `id`" (`inc/class-pmu-sesion.php:857-858`), pero quedaron vivos: (a) `PMUBiblioteca` agrupa por `madre` y muestra badge `"N versiones"`; (b) el boton **Borrar** de la biblioteca borra "la original y sus versiones" con `op=usos`+`op=borrar`; (c) `usarBiblioteca` + `op=usar` + `_bibMadre` + `_yaElegido`; (d) `PMU_Sesion::familias()` / `familia_de()` / `ruta_familia()` / `borrar_familia_dir()`. | `assets/biblioteca-pmu.js:118-165` (visor con `Elegir`/`Borrar`), `:171-224` (badge `N versiones`), `:352-375` (`usar`); `inc/class-pmu-sesion.php:1267-1418` (`familias`), `:1955-2109` (`usar_de_biblioteca`, `borrar_familia_dir`); `personalizador-pdf.php:2340-2364` (`biblioteca_familias`) |

**Causa raiz de H6**: la 030 (D5, "familias" con sufijo `{madre}-n` y `base` por area) fue
**superada** por la 035 (el `id` = sha1 del contenido es la identidad; el original no se
versiona, se referencia; la receta viaja con la fila). Pero la 030 nunca se marca como superada
en su modelo de datos: el codigo de "familias" sigue vivo y **arrastra** H1 (la rama de reuso es
lo unico que lo consumia) y H4 (la tira muestra familias/versiones que el comprador descarto).

## 2. Decisiones

| # | Decision |
|---|---|
| **D1** | **Mini-dialogo propio de confirmacion** para `Eliminar` (no `confirm()` del navegador). Vive en el **visor compartido** (`assets/visor-pmu.js`), asi lo usan **las dos** entradas (ranura y "Mis imagenes") sin duplicar: al pulsar `Eliminar` se muestra **sobre el visor** un panel con la pregunta `"Borrar esta imagen?"`, el detalle de uso si lo hay (carrito/pedido, lo que ya devolvia `op=usos`) y dos botones **Cancelar** / **Borrar**. **Escape = cancelar**, foco atrapado dentro del panel, y al borrar el visor **NO se reabre**: se vuelve a la tira (o se cierra si era la ultima). |
| **D2** | **Reintentar** el recorte. Al **tocar una miniatura** de la tira del campo: si la foto **fallo** al subirse, el toque **reintenta** la subida con el blob que quedo en memoria (el `ultimoBlob` que el selector ya guarda); si no fallo, el toque abre el visor como hoy. La miniatura fallida se distingue con `title` y una marca (`data-pmu-fallo="1"`). Tras recargar la pagina no hay blob en memoria: el toque abre el visor y la miniatura queda sin marca. |
| **D3** | **Borrar en el acto, pero solo desde "Mis imagenes" o el visor del campo.** Al borrar: (a) se quita la fila de `manifest.subidas[]` del item; (b) se borra el archivo `uploads/{id}.{ext}` **solo si ningun otro item de la sesion lo referencia** (el original es compartido por la sesion, C3 de la 035); (c) se invalida la copia local de la biblioteca. **Nunca** toca `orders/` (lo comprado vive ahi; C5 de la 035). Si el borrado no se puede (sesion sin items, archivo ya no existe) responde **idempotente**: `borrado: true` con `no_hacia_nada: true`. |
| **D4** | **Tira "Mis imagenes" (baldon de la 030 D25/D27)**: una entrada por **imagen** (no por familia), con miniatura; al **tocar** carga la imagen directo en el modal de recorte (ya no abre un visor de biblioteca). Si la imagen esta en **IndexedDB** (`PMUFotos`) se usa esa (0 red); si no, se baja del servidor (`op=imagen`). **Sin** boton "Borrar" en la tira: borrar se hace desde el visor del campo (D1/D3). El badge `N versiones` **desaparece**. |
| **D5** | **Modelo de datos: una imagen + N recetas.** El `id` (sha1 del contenido) es la identidad. Se **retira** `op=usar` (y con el la rama de reuso del selector y `usarBiblioteca`), `op=usos` y **todos** los helpers de "familias" del servidor: `PMU_Sesion::familias()`, `familia_por_sha()`, `familia_de()`, `ruta_familia()`, `usar_de_biblioteca()`, `borrar_familia_dir()`, `fila_ref()`, y los privados `biblioteca_familias()`, `biblioteca_familia_de()`, `biblioteca_ruta_familia()`, `url_biblioteca_imagen_madre()`, `biblioteca_madre_por_subida()`, `biblioteca_madre_por_contenido()`. La vista del cliente lista **imagenes** (`PMU_Sesion::imagenes()`) y la URL se arma por `id` (`url_biblioteca_imagen_id()`). La subida deja de mandar `madre_origen`: el dedupe por `sha` (D24) ya cubre "la misma foto no se duplica" porque el `id` **es** el sha12. |
| **D6** | **La rama de reuso `Elegir` (0 bytes) se retira**, no se arregla. `Elegir` era la unica consumidora de `_bibMadre`/`op=usar` y **es el origen de H1**; sin ella, el boton del modal siempre dice `Subir` y siempre viajan bytes. Consecuencia aceptada: elegir una foto de "Mis imagenes" y no retocarla **sube el original otra vez**, pero el servidor **deduplica por `sha`** (D24): no hay archivo duplicado ni entrada nueva en la tira, solo una fila que apunta al mismo `id`. Es el precio de eliminar la rama mas fragil del pipeline. |
| **D7** | **Sin migracion de datos.** Las filas `origen: original|compuesta|ref` de la 035 **no cambian** salvo que **ya no llevan `madre`** (`fila_subida()`/`fila_ref()` la omiten). Las filas viejas que la tengan se **ignorean al leer** (no se migran ni se borran): el `id` manda. Los `manifest.subidas[]` viejos se leen igual. |
| **D8** | **El Motor no se toca.** `engine/` intacto; la composicion bajo demanda (`Compositor`) sigue igual. El borrado en el acto (D3) solo afecta al **item en edicion** (todavia en `tmp/`): lo comprado en `orders/` no se toca (C5). |

## 3. Lo que cambia por archivo

| Archivo | Cambio |
|---|---|
| `assets/visor-pmu.js` | **D1**: panel de confirmacion propio (`pmu-visor-confirmar`) sobre el visor, con foco atrapado y Escape. `abrir({acciones})` ya recibe `acciones` por contexto: la ranura pasa `Eliminar`/`Reemplazar` con la confirmacion de D1. |
| `assets/cargador-pmu.js` | **D2**: marca `data-pmu-fallo="1"` en la miniatura cuando la subida falla; `_miniTocar` reintenta si hay blob (nuevo `_reintentar(indice, posicion)`). **D1**: `Eliminar` pide confirmacion; tras borrar **no** reabre el visor. **D3**: al quitar llama a la baja en el servidor (`PMU_API.borrarFoto`). |
| `assets/selector-pmu.js` | **D6**: se retira `_bibMadre`, `config.usar`, `_yaElegido`, `_paramsBase` y `_actualizarPrimario` (el primario siempre dice `Subir`). Se conserva `_params()` (la receta viaja con la subida). |
| `assets/tienda.js` | **D3**: `api.borrarFoto(id)` -> POST a la baja, con `vaciar()` de la cola antes. **D5/D6**: se retira `api.usarBiblioteca`. **D4**: la tira de "Mis imagenes" carga directo (usa `PMUFotos` si existe). |
| `assets/biblioteca-pmu.js` | **D4/D5**: lista **imagenes** (no familias); tira sin badge de versiones; `onElegir` = cargar directo; se retira `usar()` y el visor con `Elegir`/`Borrar`. |
| `personalizador-pdf.php` | **D3**: nueva `op=borrar` (o `op=imagen_borrar`) en `handle_biblioteca` que borra la fila del item y el archivo compartido si nadie lo referencia. **D5**: se retira `op=usar` y `op=usos`. |
| `inc/class-pmu-sesion.php` | **D5**: se retira `usar_de_biblioteca()`, `familias()`, `familia_de()`, `familia_por_sha()`, `ruta_familia()`, `borrar_familia_dir()`; se agrega `borrar_original_item($sid, $item_key, $id)`. **D3**: idempotente, respeta `orders/`. |

## 4. Historias de usuario

### US1 — Borrar una foto con la confirmacion correcta (P1)

El comprador toca una miniatura del campo, se abre el visor, pulsa **Eliminar** y aparece
**"Borrar esta imagen?"** con **Cancelar** / **Borrar**. Si cancela (o Escape), no pasa nada.
Si borra, la foto desaparece del campo **y del servidor**, y el visor no se reabre: vuelve a la tira.

**Por que P1**: es el hallazgo de UX mas visible (H2) y habilita D3 (borrado real).

**Criterios**:
1. **Dado** una ranura con 2 fotos, **cuando** abro el visor y pulso Eliminar, **entonces** veo el panel con la pregunta y **ninguna** foto se borro todavia.
2. **Dado** el panel abierto, **cuando** pulso Cancelar o Escape, **entonces** el visor sigue con la foto y la tira no cambio.
3. **Dado** el panel abierto, **cuando** confirmo, **entonces** la foto sale de la tira, se borra su fila del manifest y su archivo (si nadie mas lo usa), y el visor **no** se reabre.
4. **Dado** el borrado en el servidor, **cuando** el archivo lo usa **otro item de la sesion**, **entonces** el archivo se conserva (el original es compartido, C3) y solo se quita la fila del item.

### US2 — Reintentar una subida que fallo, sin perder el recorte (P1)

**Dado** una foto recien recortada, **cuando** la subida falla, **entonces** la miniatura queda
marcada y **tocarla reintenta** la subida con el mismo recorte (sin volver a elegir el archivo).

**Por que P1**: hoy un fallo de red obliga a recomponer la foto desde cero (H3).

**Criterios**:
1. **Dado** un fallo de subida, **cuando** toco la miniatura marcada, **entonces** se reintenta con el blob en memoria y no se abre el visor.
2. **Dado** el reintento exitoso, **cuando** termina, **entonces** la miniatura pierde la marca y muestra la foto.
3. **Dado** que recargue la pagina despues del fallo, **cuando** toco la miniatura, **entonces** no hay blob y el toque abre el visor (comportamiento normal).

### US3 — "Mis imagenes" carga directo (P2)

**Dado** el modal de recorte, **cuando** toco una miniatura de "Mis imagenes", **entonces** la
imagen entra directo en el recorte: del navegador si ya la tengo (IndexedDB), del servidor si no.

**Por que P2**: simplifica el flujo y elimina el ultimo consumidor del modelo "familias" (H6).

**Criterios**:
1. **Dado** una foto que ya tuve en el navegador, **cuando** la elijo, **entonces** no hay peticion de red (sale de IndexedDB).
2. **Dado** una foto que no esta en el navegador, **cuando** la elijo, **entonces** se baja por `op=imagen` y entra al modal.
3. **Dado** la tira, **cuando** la miro, **entonces** hay **una entrada por imagen** (no por familia) y **no** hay badge `N versiones`.
4. **Dado** la tira, **cuando** quiero borrar, **entonces** no hay boton: se borra desde el visor del campo (US1).
### US4 — La cola de subida dice que queda en vuelo (P2)

**Dado** una o varias subidas en curso, **cuando** el comprador mira el estado, **entonces** puede
ver **que** queda (cuantas y de que campo) y el aviso "Estamos recibiendo tus archivos" no queda
colgado sin explicacion.

**Por que P2**: baja la ansiedad del comprador y da diagnostico (H5).

**Criterios**:
1. **Dado** `PMU_FICHA.subidas`, **cuando** llamo `detalle()`, **entonces** devuelve `{total, campos:{campoId: n}}`.
2. **Dado** una subida trabada, **cuando** pasan los reintentos (1 s y 3 s), **entonces** el comprador ve la causa y puede reintentar (US2).

### US5 — Limpieza del modelo "familias" (P2)

**Dado** el codigo, **cuando** cierra esta spec, **entonces** no queda ningun consumidor del
modelo "familias" (`op=usar`, `op=usos`, `usarBiblioteca`, `familias()`, `borrar_familia_dir()`)
ni la rama de reuso del selector (`_bibMadre`, `_yaElegido`).

**Por que P2**: es codigo muerto que arrastra H1 y H4; sin limpiarlo, la spec no cierra.

**Criterios**:
1. **Dado** el repo, **cuando** busco `op=usar`/`usarBiblioteca`/`_yaElegido`/`familias(`, **entonces** no aparece ningun consumidor activo.
2. **Dado** una subida normal, **cuando** elijo una foto de "Mis imagenes" sin retocarla, **entonces** se sube el original y el servidor deduplica por `sha` (no hay archivo duplicado).
3. **Dado** los tests, **cuando** corren las puertas, **entonces** `biblioteca-contrato` y `selector-contrato` se actualizan a la nueva superficie (sin `Elegir`).

## 5. Criterios de exito

- **SC-001**: al borrar una foto, la fila del manifest y el archivo desaparecen **en el momento** (verificable con `php tests/texto_puente.php biblioteca` y el inventario de `tmp/`).
- **SC-002**: un fallo de subida se reintenta **sin** volver a elegir el archivo (1 toque).
- **SC-003**: al elegir una foto de "Mis imagenes", **0 POST** si ya esta en IndexedDB; **1** si no.
- **SC-004**: no queda ningun consumidor de `op=usar`/`usarBiblioteca`/`familias(` en `assets/` ni en `personalizador-pdf.php` (salvo el codigo de compatibilidad de lectura que la D7 conserva).
- **SC-005**: el Motor no se toca (`php tests/motor_smoke.php` sigue en verde) y la 030/035 no pierden cobertura: sus puertas se actualizan, no se borran.

## 6. Fuera de alcance

- **Edicion de imagen** (filtros, recorte libre, texto/stickers sobre la foto): sigue en el gancho `ajustes: []` de `assets/selector-pmu.js:569`, sin tocar. No es esta spec.
- **El tema `muyunicos`** (`MU.visor`/`MU.coleccion`): queda como esta; el mini-dialogo viaja en la accion del plugin, no en el tema.
- **El Motor** (`engine/`): intacto.
- **Migracion** de datos: no (D7).
- **La 010 (API WordPress)**: no la toca.
- **Multi-seleccion** de archivos o reordenar la tira arrastrando: fuera.

## 7. Riesgos

| Riesgo | Mitigacion |
|---|---|
| Retirar `op=usar` deja sin "Elegir" a quien lo use | **Nadie lo usa despues de D6**: la tira carga directo. La puerta `biblioteca-contrato` se actualiza. |
| `madre` sigue en las filas viejas y alguien lo lee como "familia" | D7: `madre` se conserva **solo** por compatibilidad de lectura; el `id` manda. Se documenta en el contrato. |
| Borrar el archivo compartido rompe otro item de la sesion | D3: se borra **solo si** ningun otro item lo referencia (C3 de la 035); idempotente. |
| Un `id` que ya se borro y vuelve a subirse | El `sha` lo trae de vuelta: `guardar_subida` recrea el archivo (`:899-902`, "solo si no existe"). |

## 8. Supuestos

- **El comprador tiene sesion** (`pmu_sid`): el pipeline ya la usa para el item y la galeria. Sin sesion no hay donde borrar (el borrado responde idempotente).
- **IndexedDB disponible**: si el navegador no la soporta, "Mis imagenes" baja del servidor (1 POST, nunca rompe).
- **El `id` es estable**: `sha1` de los bytes CRUDOS (D24 de la 035); dos navegadores con la misma foto producen el mismo `id`.
- **El tema puede faltar**: `MU.visor`/`MU.coleccion` son dependencia **blanda** (D11 de la 019); sin tema, el visor y la tira propios del plugin siguen funcionando.
- **El radio de la 030**: el escaneo de la biblioteca se mantiene (10 contenedores mas recientes, D23); lo que cambia es la **forma** de la lista (imagenes, no familias).
