# Spec 030 — Biblioteca de imagenes del comprador

> Estado: **especificada, sin implementar** (2026-10-21). Release prevista: 4.22.0.
> Construye sobre la 012 (subidas del item), la 014 (identidad por cookie), la 021 (visor),
> la 026/027/028 (formato, transparencia, lienzo) y la 029 (la foto se referencia).
> **El Motor no se toca** y el formato del pedido no cambia.

## Clarifications

### Session 2026-10-21

- Q: Donde vive el estado de ocultar una foto si la misma foto existe como varias copias en distintos items y pedidos? → A: No hay ocultar: la galeria lista una entrada por familia (sin mostrar las versiones) y sus botones son Elegir y Borrar; Borrar avisa y, confirmado, elimina la original y todas sus versiones. Sin registros ni JSON extra.
- Q: Como se arma la lista de fotos en cada apertura para que siga siendo rapido en hosting compartido? → A: Al vuelo, sin indice en el servidor, con **cache en el navegador** revalidada por `revision` (`sin_cambios`) y **tope de 10 contenedores**; el cache es unico por cliente y compartido entre campos (D23).
- Q: Si el comprador vuelve a subir desde su equipo la misma foto, el sistema la reconoce o crea una entrada nueva? → A: La reconoce: **dedupe por `sha`** al subir contra las bases conocidas del cliente (mismo alcance que la galeria) y reusa esa familia (D24).
- Q: El comprador debe poder borrar todas sus fotos de una sola vez, y hasta donde alcanza ese borrado? → A: No hay borrado masivo: se borra **foto por foto** y el boton Borrar existe **solo en el visor** (`cpmu-visor`), no en la tira de la ranura (D25).
- Q: Debe vencer alguna vez la foto de un carrito que el comprador abandona? → A: Si: los **items de carrito abandonados vencen a los 30 dias** con sus fotos, igual que la cookie `pmu_sid` (D26).

### Session 2026-10-21 (segunda pasada post-plan)

- Q: Que fotos debe mostrar la tira al abrir la biblioteca desde un hueco: todas las guardadas o solo las que encajan en ese hueco? → A: Todas, ordenadas por fecha (las mas nuevas primero) y sin filtrar por compatibilidad (D27).
- Q: Desde donde se puede abrir la biblioteca: solo en la ventana de recorte o tambien desde el campo (ranura) en la ficha? → A: Solo en el modal de recorte: la tira vive ahi y la ranura del campo queda como hoy (D28).
- Q: La pagina Mis imagenes (dentro de Mi cuenta, para ver el historial completo y borrar sin pasar por un producto) entra en esta entrega o queda para despues? → A: Queda **fuera de la 030** (spec aparte): el modal de la ficha ya cubre ver, elegir y borrar.
### Session 2026-10-21 (tercera pasada: visor unificado)

- Q: El visor de la ranura (`cpmu-visor`) tarda segundos al pasar de foto: se puede reutilizar y mejorar tambien para las galerias de los campos? → A: Si: **un solo visor** (`assets/visor-pmu.js`, `PMUVisor`) compartido por la ranura y la biblioteca, con las **URLs ya resueltas** (`PMU_FICHA.urls` + mapa `id -> url`) para que navegar no haga ni un POST (D14/D23/D28).

## 1. Problema

Todo lo que el comprador sube queda **encerrado en el item** de esa compra:
`tmp/sesion-{sid}/{item_key}/subidas/{id}.{ext}`. Consecuencias:

1. **No hay historico**: al cerrar la ficha, el comprador no tiene ninguna via de volver a ver
   (ni de reusar) las fotos que ya subio. La unica forma es volver a subirlas desde su equipo.
2. **El acceso temporal muere sin aviso**: `limpiar_ttl()` **no tiene ningun llamador en
   produccion** (solo lo usan los tests), asi que hoy los drafts no vencen nunca; y cuando se
   implemente la limpieza, la imagen se va con la sesion sin que nadie lo haya decidido.
3. **No se aprovecha lo comprado**: `orders/{order_id}/{item_key}/subidas/` ya guarda la foto de
   cada compra, y cada line item ya guarda `_pmu_sid` y el pedido su `customer_id`. El dato existe;
   lo que falta es **leerlo como biblioteca**.
4. **Reutilizar cuesta lo mismo que subir**: elegir una foto vieja hoy significa bajarla del
   celular otra vez, recortarla otra vez y subirla otra vez, por cada producto.

No hace falta un almacen nuevo: hace falta una **vista de lectura** sobre las sesiones y las
compras, con reglas claras de reuso, de consolidacion y de borrado.

## 2. Decisiones

| # | Decision |
|---|----------|
| **D1** | **Sin catalogo nuevo**: la galeria es una **vista** sobre `tmp/sesion-{sid}/*/subidas/` + `orders/{order_id}/{item_key}/`, filtrada por identidad. No se crean ambitos, tablas ni indices obligatorios. |
| **D2** | **Identidad**: invitado = cookie `pmu_sid` (spec 014); registrado = la cuenta. El indice de compras es **Woo**: `customer_id` en el pedido y `_pmu_sid` en cada line item (ya guardados, nada nuevo). |
| **D3** | **Vinculo al loguearse**: hook **`woocommerce_guest_session_to_user_id`** (Woo 8.8.0+; el propio Woo lo documenta como *connect the old session id to the customer id if the key is being used externally*) → `update_user_meta($uid, '_pmu_sids', [...])`, el mismo almacen que Woo usa para su carrito (`_woocommerce_load_saved_cart_after_login`). Fallback si el Woo es viejo: `wp_login` + cookie vigente. **Nunca al reves**: una request **deslogueada** no consulta el vinculo (en un dispositivo compartido, las fotos de la cuenta no se muestran). |
| **D4** | **No se cambia el layout**: `orders/{order_id}/{item_key}/` y `tmp/sesion-{sid}/{item_key}/` siguen igual. El `cliente_id` **no** entra en el nombre de la carpeta: Woo ya lo indexa, un invitado (o un cambio de cliente) dejaria nombres que mienten, y renombrar `orders/` en produccion seria una migracion. |
| **D5** | **Familias**: el primer archivo de una foto define el nombre de la familia (`{madre}.{ext}`); cada recomposicion es una **version** `{madre}-2.{ext}`, `{madre}-3.{ext}`... El sufijo lo pone **siempre el servidor** (el cliente nunca propone nombre). **Sin migracion**: los archivos actuales (`e05f6c8302c0.png`) se leen como familias sin versiones. |
| **D6** | **`base` es un flag, nunca un `rename`**: la composicion de mayor resolucion se marca `base: 1` en su fila y el rol **puede moverse** entre filas sin tocar el disco. Renombrar romperia las referencias de pedidos anteriores. |
| **D7** | **`receta` = identidad de la composicion**: hash de `w,h,forma,modo,escala,desplazamiento,fondo,transp` + medidas del origen. El `sha` de los bytes **no** sirve para deduplicar recomposiciones: el compuesto sale de `canvas.toBlob()` y no es determinista entre navegadores/versiones. |
| **D8** | **Elegir vs Subir**: al abrir el modal **desde la biblioteca**, si la receta **coincide** el boton dice **Elegir** y **no se compone ni se sube nada** (se registra una referencia); si **difiere**, dice **Subir** y la composicion entra como **version**. El caso *el contenedor tiene otra relacion de aspecto* cae solo: al abrir con otro marco el modal recalcula el 5% (spec 028) y eso **ya es otra receta**. |
| **D9** | **De `tmp` se copia; de `orders` se referencia**: `tmp` es volatil (TTL + borrado quirurgico del item) y `orders` es el entregable permanente del cliente. **Nunca existe una referencia a `tmp`**: no hay referencia rota por vencimiento. |
| **D10** | **Fila `origen: ref`**: `ref` es **relativo a `uploads/pmu/`** (**corregido por el arnes**: en `tmp` el item esta a 3 niveles y en `orders/` a 2, asi que un `../..` fijo **no** sobrevive a la promocion) y se valida con `realpath` que quede dentro de `uploads/pmu/`. Un `ref` como `orders/{A}/_comun/{madre}-{n}.webp` **vale antes y despues de promover**: cero reescritura de rutas. |
| **D11** | **Consolidacion por pedido (`_comun`)**: al consolidar (staging, e **idempotente** en la promocion) los items del pedido se agrupan por **`(madre, receta)`**; queda **UNA** copia en `orders/{order_id}/_comun/{madre}-{n}.{ext}` y **todos** los items (incluido el primero) apuntan con `ref: ../_comun/...`. **Nadie es dueno del archivo**: quitar un producto del carrito o borrar un item no rompe a sus hermanos. Los duplicados de la sesion se van con su TTL. |
| **D12** | **Referencia cruzada entre pedidos**: si la fuente vive en `orders/`, se referencia **en el acto** (el caso *la misma foto en 20 pedidos = 1 archivo*). **Invariante nuevo y documentado**: no se purga un pedido referenciado. Hoy nada purga `orders/` (el TTL solo mira `draft-*`), asi que no hay codigo nuevo por esto. |
| **D13** | **Resolucion unica**: un solo `PMU_Sesion::resolver_ref()` (relativo al item, dentro de `uploads/pmu/`), usado por `item_generar_pdfs`, `handle_item_regenerar` y la galeria. **El Motor no se toca** (`Motor::procesar_pedido` recibe rutas absolutas). Un `ref` que no resuelve da causa explicita (`motor:descarga:ref:ausente`) y **hueco transparente**: nunca un PDF roto. |
| **D14** | **Lectura por el endpoint protegido**: **no hay miniaturas derivadas** — la tira y el visor muestran **la imagen de la familia** (su `base`: el `.webp` que ya existe), servida por `op=imagen` con nonce (`personalizador_pdf_vista_previa`) e identidad por cookie, y con `Cache-Control: private` + `ETag` para que **el navegador la cachee**. **Nunca** URLs crudas de `uploads/`. El cliente manda **`madre` (la familia), nunca rutas**; el servidor la re-resuelve contra su propio escaneo (`api:biblioteca:foto:ajena` si no es de esa identidad). **Una sola politica de acceso**: `op=imagen` sirve tambien los ids de la **ranura** (`item_key` + `id`), asi que la tira y el visor del campo dejan la URL cruda de `handle_subida_url`. |
| **D15** | **Una sola entrada visible por foto**: la galeria agrupa por familia (`madre`) y muestra la **`base`** como portada, con `N versiones` y `usada en N pedidos`. Las versiones **no** se listan ni se borran por separado: se manejan con la familia (D16). |
| **D16** | **Sin ocultar**: la galeria muestra **una entrada por familia** (la `base` como portada; las versiones **no** se listan) y sus acciones son **Elegir** y **Borrar**. No hay estado de ocultamiento: no se agrega ningun registro ni JSON extra. |

## 3. Contrato

### 3.1 Filas (`manifest.subidas[]`)

```json
// base (primera composicion de la familia)
{ "id": "9f2c41ab0d7e", "file": "subidas/9f2c41ab0d7e.webp", "mime": "image/webp",
  "bytes": 118402, "creado": 1792600000, "madre": "9f2c41ab0d7e", "base": 1,
  "receta": "a1b2c3d4", "sha": "6f1c8e" }

// version (recomposicion)
{ "id": "9f2c41ab0d7e-2", "file": "subidas/9f2c41ab0d7e-2.webp", "madre": "9f2c41ab0d7e",
  "receta": "77e0aa19", "origen": "subida" }

// referencia (solo en orders/)
{ "id": "9f2c41ab0d7e-2", "origen": "ref", "ref": "../_comun/9f2c41ab0d7e-2.webp",
  "madre": "9f2c41ab0d7e", "receta": "77e0aa19" }
```

- `madre` = nombre de la familia (inmutable); `base` = flag de calidad (movible); `receta` =
  identidad de la composicion (D7). `ref` es relativo al item (D10).
- Fila de `archivos[]`: se conserva tal cual su forma (`origen: subida | texto | ref`); con `ref`
  el `file` se reemplaza por `ref` y el Motor no cambia.
- `sha` = hash del contenido escrito **al subir** por el servidor: es lo que habilita el **dedupe por contenido** (D24).
| **D17** | **Borrar** elimina la **familia completa** (la original y todas sus versiones) y **avisa antes**, diciendo donde se esta usando (`carrito`, `pedido #N`). Toda baja pasa por `PMU_Sesion` (manifiesto + archivo), **nunca** un `unlink` crudo. |
| **D18** | **TTL explicito**: `limpiar_ttl()` **no tiene llamador en produccion**; la spec lo agenda (cron diario) y barre **drafts (24 h), sesiones sin items e items de carrito abandonados (D26)**, jamas un archivo en uso. La imagen temporal vence con su sesion; lo comprado vive en `orders/`. |
| **D19** | **Un endpoint con `op=`**: `admin_post_personalizador_pdf_biblioteca` (+ `nopriv`), coherente con la spec 010 (sin rutas REST ni un segundo camino de escritura). Ops: `listar`, `usar`, `borrar`. |
| **D20** | **Sin cuota dura en v1**: tope por archivo (el vigente) + contadores por identidad para medir. La cuota/purga por peso se decide con datos reales (seccion 6). |
| **D21** | **La spec 029 no se toca**: en `tmp` la fila sigue siendo `origen: subida`, `resolver_subidas` y `podar_subidas` siguen igual, y `ref` aparece **solo en `orders/`**. |
| **D22** | **Super-resolucion (futuro)**: la `base` es *la mejor **producida** hasta ahora* (el PNG mide el lienzo acotado a la foto, spec 028 D11), no *la mejor posible*. Un archivo super-resuelto entra como un archivo mas de la familia y pasa a `base` **por flag**. |
| **D23** | **Sin indice en el servidor y con cache en el navegador**: `listar` arma la vista al vuelo (Woo para logueados; para invitados, glob de `orders/` filtrando por `manifest.sid`). El cliente **guarda el resultado** (solo metadatos, **nunca bytes**) y revalida con la **`revision`** que devuelve el servidor (su composicion: R5): si no cambio, responde `sin_cambios` y no viaja la lista. **Tope: los 10 contenedores mas recientes** (asi el historial queda acotado y el costo tambien). Criterio medible: primera apertura **<= 1,5 s con 300 pedidos**; las siguientes **0 requests** salvo la revalidacion. **Tras subir o borrar una imagen el cliente vuelve a pedir la lista** (no parchea el cache en memoria). La cache es **unica por cliente** y **compartida por todos los campos/ranuras** de la pagina, asi que abrir el modal en cualquier campo **no genera peticiones de red** (nunca una por campo). La ficha publica las URLs ya resueltas (`PMU_FICHA.urls`) y el cliente guarda un mapa **id -> url** por pagina: la miniatura y la vista grande usan la **misma** URL, y el visor navega **sin pedir nada** (0 POST por paso). |
| **D24** | **Dedupe por contenido al subir**: si el `sha` del archivo que se sube coincide con una **base** ya conocida del cliente (mismo alcance que la galeria: los 10 contenedores), se **reusa esa familia** en vez de crear una nueva: la subida entra como version o referencia de la existente. El `sha` se escribe en la fila **al subir** (nunca se lee un archivo para comparar). |
| **D25** | **Sin borrado masivo y el Borrar solo en el visor**: el cliente borra **foto por foto**; el boton **Borrar** vive en el **visor compartido** (`PMUVisor`, el mismo que abren la ranura y la biblioteca) y **no** en la tira de la ranura (`cpmu-ranura`), que queda con sus miniaturas y su boton de cargar. No hay accion de borrar todo (v1). |
| **D26** | **TTL de items de carrito abandonados = 30 dias** contados desde `manifest.creado` (ancla por ITEM, constitution §IV; la cookie `pmu_sid` vive lo mismo): el barrido borra el item **con sus fotos** y la galeria deja de mostrarlas. Los **drafts** mantienen su TTL corto (24 h, D18) y lo **comprado** vive en `orders/` (no vence). Efecto aceptado y documentado: un carrito de Woo mas viejo que 30 dias puede fallar con causa clara (`motor:descarga:item:ausente`) en lugar de guardar archivos para siempre. |
| **D27** | **La tira muestra TODAS las familias, ordenadas por fecha (las mas nuevas primero)**: no filtra por compatibilidad con el hueco. El boton sigue dependiendo de la receta (D8): las que no encajan se recomponen al elegirlas. |
| **D28** | **Un solo visor, dos entradas**: el visor fullscreen se extrae a `assets/visor-pmu.js` (`PMUVisor`) y lo comparten la **ranura** (tocar una `cpmu-mini` de `cpmu-tiras`) y la **biblioteca** (boton **Elegir ya subida** en `spmu-modal`). Con ambas fuentes hay un segmento **En este campo / Mis imagenes**; las acciones las declara cada contexto (`Reemplazar`/`Eliminar` en la ranura; `Elegir`/`Borrar` en la biblioteca). La ranura **deja de duplicar** el visor y las dos entradas usan las **URLs ya resueltas** (D23). |

### 3.2 Galeria (respuesta de `op=listar`)

```json
{ "ok": true, "revision": "b3d7f1", "sin_cambios": false, "fotos": [
  { "madre": "9f2c41ab0d7e", "url": "...op=imagen&madre=9f2c41ab0d7e&_wpnonce=...",
    "w": 1000, "h": 1000, "base": "orders/29088/_comun/9f2c41ab0d7e.webp",
    "versiones": 2, "creado": "2026-10-13T04:43:15Z",
    "usos": { "carrito": ["156e"], "pedidos": [29088, 29091] } } ],
  "totales": { "fotos": 12, "bytes": 4194304, "contenedores": 3 } }
```

- `madre` es la llave de la familia (el nombre del `.webp` base sin extension) y `url` es el enlace del endpoint protegido para verla o cargarla en el recorte. El cliente **nunca** manda rutas.
- Identidad: invitado -> sesiones de la cookie + pedidos cuyo `manifest.sid` coincide; registrado
  -> `wc_get_orders(customer_id)` + los `_pmu_sid` de esos pedidos (user meta `_pmu_sids`) + la
  sesion vigente.
- La respuesta lleva **`revision`** (hash de contenedores + manifiestos, R5): el cliente manda `desde=<revision>` y, si nada
  cambio, recibe `sin_cambios` **sin la lista**. El cache guarda metadatos, **no bytes**; las imagenes se sirven
  por `op=imagen` con `Cache-Control: private` (**sin miniaturas derivadas**).
- **Tope: 10 contenedores** (sesiones y pedidos con fotos, los mas recientes) y **la tira pinta hasta 10 fotos** (el visor muestra todas las que devolvio la respuesta). Orden: **por fecha de creacion, descendente** (el *ultimo uso* queda como mejora opcional, P5), **sin filtrar** por el hueco actual (D27).

### 3.3 Ops del endpoint

| op | Entrada | Efecto |
|---|---|---|
| `listar` | `desde` (opcional) | la vista de 3.2, o `{sin_cambios:true}` si `desde` == `revision` |
| `imagen` | `madre` | los bytes del `.webp` **base** de la familia (`Cache-Control: private` + `ETag`): sirve para la tira, el visor y el recorte |
| `usos` | `madre` | la situacion **en vivo** de la familia (versiones, bytes, en carrito, en pedidos) para armar el dialogo de borrado |
| `usar` | `item_key`, `pdf`, `grupo`, `madre`, `indice`, `params` | receta igual -> fila `origen: ref` (0 bytes); distinta -> version `{madre}-{n}` (con bytes) |
| `borrar` | `madre` | borra la **familia completa** (`{madre}` + `{madre}-{n}`) con sus filas, por `PMU_Sesion` (avisa antes, D17) |

Causas: `api:biblioteca:<motivo>` (`foto:ajena`, `madre:invalida`, `params:invalidos`) y
`motor:descarga:ref:ausente` en el PDF. El **aviso** de borrado informa los `usos` (`en_carrito`, `en_pedido`).
### 3.4 Consolidacion (D11)

```
por pedido (staging + promocion, idempotente):
  agrupar los items del pedido por (madre, receta)
  por grupo: ganar el archivo de mayor resolucion -> orders/{order}/_comun/{madre}-{n}.{ext}
             borrar los duplicados del staging y reescribir TODAS las filas del grupo a
             { origen: ref, ref: ../_comun/{madre}-{n}.{ext} }   (incluido el primer item)
  si la familia ya existe en el _comun de un pedido anterior del mismo cliente -> referenciar ese
```

Promocion: `rename` de cada item + `rename` de `_comun` (mismo nivel) -> **las rutas relativas no
se reescriben**.

### 3.5 Efecto

| caso | Antes | Ahora |
|---|---|---|
| 10 items del mismo pedido con la misma foto | 10 archivos | **1** (`_comun`) + 10 filas `ref` |
| la misma foto en 20 pedidos | 20 copias (~25 MB) | **1** archivo + 19 referencias |
| reusar sin cambios dentro del carrito | no existe (habia que volver a subir) | **0 bytes** (referencia) |

## 4. Puertas

- Arnes `texto_puente.php`, fase nueva **`biblioteca`**: invitado ve solo lo suyo; familia ajena (`madre`) ->
  `api:biblioteca:foto:ajena`; elegir sin cambios -> fila `ref` y **0 bytes**; elegir con cambios ->
  version `{madre}-2`; consolidacion de 3 items del mismo pedido -> **1** archivo en `_comun` +
  3 `ref` + idempotencia; `item_generar_pdfs` con `ref` arma el PDF; `ref` roto -> causa explicita y
  PDF con hueco (no rompe); galeria con **una** entrada por familia; `borrar` elimina la familia completa (original + versiones) y sus filas;
  el **aviso** de borrado informa donde se usa (D17); TTL no borra lo referenciado; y la vista respeta el **tope de 10 contenedores** con `revision`/`sin_cambios`; subir **la misma** foto de nuevo **reusa la familia** en vez de crear una segunda entrada; y la galeria se pide **una sola vez por cliente** (cache compartida entre campos); el barrido respeta el **TTL de 30 dias** de los items abandonados (D26).
- `node tests/selector-contrato.test.js`: tira **Cargas anteriores** + visor en modo biblioteca
  (`Elegir` / `Eliminar`) y **Elegir vs Subir segun receta** (el cliente no compone si coincide).
  Ademas: **cache del navegador** (2a apertura con `desde` = 0 requests y `sin_cambios`) e invalidacion tras
  `usar`/`borrar`. La tira lista **todas** las familias, ordenadas por fecha (D27).
- `php tests/motor_smoke.php`, `php tests/parity.php` y `php tests/sin_lectura.php` en verde: el
  Motor no cambia y un listado no escribe.

## 5. Fuera de alcance

- **Pagina Mis imagenes** (Mi cuenta / `[pmu_biblioteca]`): **fuera de la 030** (spec aparte): el modal de la
  ficha ya cubre ver, elegir y borrar (D28).
- **Super-resolucion**: la spec solo garantiza que encaja sin cambios (D22).
- **Guardar el archivo crudo**: hoy el selector lo descarta (la `base` es la composicion mayor).
- **`_comun` por sesion** (cero copias en `tmp`): se descarta por D9 (el item es dueno de lo suyo y
  `carrito_quitar` borra su carpeta al instante).
- **Cuota por identidad**: se define con datos (seccion 6).
- **La politica de acceso de la ranura** (que hoy sirve la subida con URL cruda via `handle_subida_url`) **no** cambia en la 030: la biblioteca usa el endpoint protegido; unificar ambas politicas es spec aparte.

## 6. Pendientes (a confirmar antes de implementar)

| # | Pendiente | Propuesta |
|---|---|---|
Cerrado: **P1** (pagina Mis imagenes) -> fuera de la 030, spec aparte (D28).

| P2 | Cuota/peso por identidad | medir con `op=listar` y decidir |
| P3 | Purga de `orders/` con referencias | documentar el invariante; materializar antes de purgar (cuando exista la purga) |
| P4 | Que pasa si el **tope de 10 contenedores** deja una foto vieja fuera de la tira | agregar **ver mas** (pide la pagina siguiente) si aparece el caso |
| P5 | Orden por **ultimo uso** en lugar de por fecha de creacion | anotar el uso al elegir una foto (campo aditivo) si resulta barato |
