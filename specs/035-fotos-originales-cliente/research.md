# Research: Fotos originales y carpeta del cliente

**Feature**: 035-fotos-originales-cliente · **Fecha**: 2026-10-27

> Phase 0 de `/speckit-plan`. Cada R resuelve una decision de implementacion que la spec dejo a
> nivel de contrato. No hay `NEEDS CLARIFICATION` abiertos: las D1-D14 y P1-P8 estan cerradas.

---

## R1 — Como se detecta que el cliente "vio" la vista

**Hallazgo**: la galeria ya tiene estado (`prepararGaleria`, `assets/tienda.js:740`) con
`{vistas, idx}`, flechas y `pintar()`. El bloqueo vive en `bloqueos.vistas` (`:445`) y se aplica en
`bloquearCarrito()` (`:838`).

**Decision**: la marca se pone en el **pintado** de la vista: `pintar()` (y el arranque de la
galeria, que pinta la primera) marcan `vistas[idx].visto = true`. No hay boton ni evento nuevo.

**Rationale**: el comprador ya "vio" lo que la galeria le muestra; pedir un boton extra contradice
la constitucion §I ("no hay boton de aprobar: el visto bueno ES agregar al carrito"). El pintado es
el unico punto por donde pasa toda vista.

**Alternativas**: (a) marcar al abrir el modal — no distingue vistas no navegadas; (b) marcar en
`onSelect` — depende de un gesto que no existe. Se descartan.

## R2 — Donde vive la marca y como sobrevive la recarga

**Decision**: `localStorage['pmu_vistas_v1'][item_key] = {mockup_id: 1, ...}`, con `item_key` vacio
resuelto a `'draft'` (la galeria puede abrirse antes del add-to-cart). Se lee al montar y se
**reconcilia** al pintar.

**Rationale**: el servidor no puede recibir un POST por cada flecha (seria una peticion por
navegacion, justo lo que la 035 elimina). `localStorage` alcanza: la marca es por dispositivo y su
perdida solo obliga a volver a navegar. Al add-to-cart se persiste de verdad en el manifest
(`congelar_webp` ya escribe `mockup_vistas`).

**Alternativas**: (a) `sessionStorage` — se pierde al cerrar la pestana; (b) persistir en el
servidor al navegar — N requests; (c) cookie — 4 KB y viaja en cada request. Se descartan.

**Invalidacion**: si el item cambia de `item_key` (promocion del draft), la clave se migra al
promover; si el mockup se borra del admin, su entrada se ignora (no bloquea).

## R3 — Como se mueve el original al pagar (orden e idempotencia)

**Hallazgo**: `promover_order($order_id, $item_key)` hoy hace un solo `rename` de
`tmp/orders/{order_id}/{item}` a `orders/{order_id}/{item}` (`class-pmu-sesion.php:1211`). Con la
035 el origen es `tmp/sesion-{sid}/{item}` y hay originales en `tmp/sesion-{sid}/uploads/`.

**Decision**: `promover_order($order_id, $cliente, $sid, $item_key)` ejecuta, en este orden:
1. `rename(tmp/sesion-{sid}/{item}, orders/{cliente}/{order_id}/{item})` (el arbol del item).
2. Para cada fila `origen: sesion` del manifest: `copy(tmp/sesion-{sid}/uploads/{id}.webp,
   orders/{cliente}/uploads/{id}.webp)` **si no existe** (dedupe por sha), y `unlink` del origen.
3. Reescribir esas filas a `origen: cliente` + `clave` **y** `manifest.cliente`, en una sola
   escritura atomica (`mutar_manifest_dir`).

**Rationale**: el `rename` es atomico y barato; los originales se **copian** (no se mueven) porque
otro item de la misma sesion puede usarlos. El dedupe por sha evita duplicar una foto comprada
antes. La reescritura del manifest va **despues** de los archivos: si el proceso muere en el medio,
las filas siguen apuntando a `tmp/` (que existe) y el reintento es idempotente.

**Alternativas**: (a) mover primero los originales — si falla el `rename` del item quedan filas
`cliente` sin item; (b) `rename` de los originales — rompe el otro item de la sesion. Se descartan.

## R4 — Como se resuelve un original desde una fila

**Decision**: `origen: 'cliente'` usa `id` + `clave`; el servidor arma
`orders/{clave}/uploads/{id}.webp` con `clave` validada por `/^\d{1,12}$/` e `id` por
`/^[a-f0-9]{12}$/` + `is_file()`. **No** se usa `ref` relativo para fotos del cliente.

**Rationale**: con `ref` la ruta depende de la profundidad del item (`../../`), y la 030 lo eligio
para que el mismo texto valiera antes y despues de promover. Con el nivel de cliente eso ya no se
cumple, y `id` + `clave` no admite traversal (no hay ruta del cliente en juego).

**Compatibilidad**: las filas `origen: 'ref'` de la 030 (entre pedidos) **se conservan** y siguen
resolviendose con `resolver_ref()` (`realpath` dentro de `uploads/pmu/`).

## R5 — Como se revalida el cap de 2000 px en el servidor

**Decision**: el cliente acota al ingerir (canvas + WebP q0.85) y el servidor **revalida** con
`getimagesize()` (o GD) en `guardar_subida()`: si `max(w,h) > 2000`, se reescala con GD antes de
guardar; sin GD, se rechaza con `motor:subida:tamano` (fail-safe explicito, nunca un archivo fuera
de contrato).

**Rationale**: el cap no es solo un limite de peso: define el techo de resolucion de todo lo que
saldra en el PDF. Confiar en el cliente permitiria subir 8000x8000 y romper la promesa de "el
original nunca supera 2000".

**Alternativas**: (a) confiar en el cliente — trivial pero inseguro; (b) rechazar sin reescalar —
rompe la compra por una foto grande. Se descartan.

## R6 — Como se sube una sola vez por sha dentro de la sesion

**Decision**: `guardar_subida()` calcula `sha1` de los bytes **crudos** (antes de convertir) y, si
`tmp/sesion-{sid}/uploads/{sha12}.webp` ya existe, **no escribe**: devuelve la fila con
`origen: 'sesion'` y el mismo `id`. El `id` es `substr(sha, 0, 12)`.

**Rationale**: el `id` deriva del contenido, asi que dos items de la misma sesion que usen la misma
foto comparten archivo y fila por construccion (no hay que buscar "familias"). El sha crudo es
estable entre navegadores para el mismo archivo original; el WebP convertido no lo es.

**Alternativas**: (a) `uuid` por subida + busqueda por sha en el manifest — mas estado y mas
codigo; (b) dedupe por el WebP resultante — no es determinista entre navegadores. Se descartan.

## R7 — Como se poda la carpeta de sesion sin romper el TTL

**Hallazgo**: `limpiar_ttl()` (`:1264-1285`) hace `glob(tmp/sesion-*/*)` y trata **cada** carpeta
como un item; `vivos === 0` borra la sesion entera.

**Decision**: `uploads/` se **excluye** del conteo por item (mismo patron que `draft-`), y la poda
de originales corre al final del barrido de cada sesion: se borra un `{id}.webp` que **ningun**
`manifest.subidas[]` de esa sesion referencia. Si la sesion queda sin items, se borra entera (y se
lleva los originales).

**Rationale**: sin la exclusion, `uploads/` cae al `filemtime` y a los 30 dias se borra aunque haya
items vivos. La poda por sesion es O(items x filas) y ya se recorre la sesion.

**Alternativas**: (a) TTL propio para `uploads/` — otro reloj y otra politica; (b) no podar — la
basura se queda hasta que muera la sesion. Se descartan.

## R8 — Quien lee `manifest.cliente`

**Decision**: lo escribe `promover_order()` (una vez) y lo leen `manifest_item()`,
`item_generar_pdfs()` e `item_regenerar()` para armar la ruta **sin consultar Woo**.

**Rationale**: `customer_id` es mutable (Woo permite reasignar un pedido). Si la ruta se derivara
en cada lectura, una reasignacion mudaria el entregable y romperia las descargas. Congelado en el
manifest, la ruta es estable y los tests CLI no necesitan stubs de Woo.

**Alternativas**: (a) `wc_get_order($id)->get_customer_id()` en cada lectura — acopla y es mutable;
(b) derivarlo del `sid` — no aplica a pedidos. Se descartan.

## R9 — Como se ordenan las vistas no omisibles primero

**Decision**: `prepararGaleria()` ordena `vistas` con `preview_omisible` ascendente (las
`false` —las que bloquean— primero), conservando el orden de PDFs dentro de cada grupo. El aviso
"Revisa la vista previa" se muestra mientras quede una obligatoria sin `visto`.

**Rationale**: el dato ya viaja por PDF (`panel_ficha()` publica `preview_omisible` por asociacion,
`personalizador-pdf.php:501`); ordenar en el cliente no requiere cambios de contrato.

**Alternativas**: (a) ordenar en el servidor — obliga a tocar `datos_pdf_render` y el orden de la
galeria del admin; (b) no ordenar — el comprador puede comprar sin haber visto la importante. Se
descartan.

## R10 — Como se mantiene "la vista previa es el PDF"

**Decision**: el add-to-cart sigue subiendo la **composicion** (bitmap ya compuesto) por receta; el
original se sube aparte y **no** se usa para imprimir. El Motor no cambia.

**Rationale**: es la unica forma de que el PDF sea byte a byte lo que el comprador vio (028 D6), sin
un compositor PHP (D9) y sin paridad Canvas/GD.

**Alternativas**: (a) componer en PHP desde la receta — rompe el invariante y agrega GD al camino
critico; (b) recomponer en el navegador al descargar — hoy la descarga es un GET sin navegador.
Se descartan (la (a) queda como candidata para la API 010).
