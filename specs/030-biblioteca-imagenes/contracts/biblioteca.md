# Contract — Biblioteca de imagenes (spec 030)

Endpoint unico: `admin_post_personalizador_pdf_biblioteca` (+ `nopriv`).
Nonce: `personalizador_pdf_vista_previa`. Identidad: **cookie `pmu_sid`** (spec 014), nunca el `sid`
del POST. Respuesta JSON. Causas: `api:biblioteca:<motivo>`.

## Ops

| op | args | ok | errores |
|---|---|---|---|
| `listar` | `desde` (opcional) | `{revision, fotos:[...], totales:{...}}` o `{sin_cambios:true}` | — (lista vacia no es error) |
| `imagen` | `madre` (biblioteca) **o** `item_key` + `id` (ranura) | bytes del `.webp` (`image/webp`, `Cache-Control: private`, `ETag`): **una sola politica de acceso** (D14) | `foto:ajena` |
| `usos` | `madre` | `{versiones, bytes, carrito:[], pedidos:[]}` **en vivo** para el dialogo de borrado | `foto:ajena` |
| `usar` | `item_key`, `pdf`, `grupo`, `madre`, `indice`, `params` | `{fila:{...}}` | `foto:ajena`, `madre:invalida`, `params:invalidos` |
| `borrar` | `madre` | `{madre, borrado:true, versiones:N}` | `foto:ajena` (y **aviso** si esta en carrito o en un pedido) |

- `fotos[]` viene **por fecha de creacion descendente** y **sin filtrar** por el hueco (D27); topes: **10 contenedores** en el escaneo y **10 fotos** en la tira (el visor muestra todas).
- `handle_subida` devuelve ademas `url` (la fila ya sabe su archivo): el cliente **no** resuelve URLs por POST.

## Reglas de `usar`

1. `madre` se **re-resuelve** contra el escaneo propio del servidor (nunca una ruta del cliente): se busca `{madre}.webp` y su familia `{madre}-?.webp`.
2. Fuente en `tmp/` -> **copia** al item (`subidas/{madre}-{n}.{ext}`), fila `origen: subida`.
3. Fuente en `orders/` y `receta` igual -> fila `origen: ref` (`../_comun/...` o
   `orders/{A}/_comun/...`): **sin bytes**.
4. Fuente en `orders/` y `receta` distinta -> se sube la composicion: **version** `{madre}-{n}` en
   el item (y candidata a `base` si es la mayor).

## Filas

```json
{ "id":"9f2c41ab0d7e-2", "file":"subidas/9f2c41ab0d7e-2.webp", "madre":"9f2c41ab0d7e",
  "receta":"77e0aa19", "base":0 }
{ "id":"9f2c41ab0d7e-2", "origen":"ref", "ref":"orders/29088/_comun/9f2c41ab0d7e-2.webp",
  "madre":"9f2c41ab0d7e", "receta":"77e0aa19" }
```

- `receta` = `sha1(w,h,forma,modo,escala,desplazamiento,fondo,transp,iw,ih)`.
- `base` = flag (1 = composicion de mayor resolucion de la familia). **Nunca** implica `rename`.
- `ref` es **relativo a `uploads/pmu/`** (D10 revisado por el arnes) y el resolutor valida con `realpath` que quede dentro.
- La galeria agrupa por `madre`: **una entrada por familia** (la `base` como portada); las
  versiones no se listan ni se borran por separado.
- `sha` = hash del contenido, escrito por el servidor **al subir**: si coincide con una base conocida del cliente
  (mismo alcance que la galeria), la subida **reusa la familia** (D24).

## Consolidacion (`_comun`)

```
staging_order(order, item, sid) -> copiar el item y despues:
consolidar_order(order)     // idempotente; tambien se llama en pedido_promover
  1. por cada item staged: leer manifest.subidas[] y manifest.archivos[]
  2. agrupar por (madre, receta); gana el de mayor resolucion
  3. mover el ganador a tmp/orders/{order}/_comun/{madre}-{n}.{ext}
  4. borrar los duplicados de los items y reescribir TODAS las filas del grupo a
     { origen: ref, ref: orders/{order}/_comun/{madre}-{n}.{ext} }
  5. si la familia ya existe en el _comun de un pedido anterior del mismo cliente: referenciar ese
```

Promocion: `rename` de cada item + `rename` de `_comun` (mismo nivel) -> las rutas relativas **no se
reescriben**.

## Cache del cliente (D23)

- El cliente guarda la ultima respuesta (**metadatos, no bytes**) y en la proxima apertura manda `desde=<revision>`.
- Los bytes de las fotos **no** se guardan: los cachea el navegador via `op=imagen` (`Cache-Control: private`).
- `revision` = hash de contenedores + manifiestos (R5); si `desde` coincide, el servidor responde `sin_cambios` y no envia la lista.
- Invalidacion: **tras subir o borrar una imagen el cliente vuelve a pedir la lista** al servidor (no parchea el cache en memoria).
- Topes: **10 contenedores** (los mas recientes) y **10 fotos** en la tira. Las imagenes van por `op=imagen` con `Cache-Control: private`.

## Errores en el PDF

| causa | cuando | resultado |
|---|---|---|
| `motor:descarga:ref:ausente` | el `ref` ya no existe (pedido purgado a mano) | el hueco queda **transparente**; el PDF se entrega igual |
