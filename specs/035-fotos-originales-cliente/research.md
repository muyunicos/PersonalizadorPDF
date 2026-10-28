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
2. Para cada fila `origen: original` del manifest: `rename(tmp/sesion-{sid}/uploads/{id}.webp,
   orders/{cliente}/uploads/{id}.webp)`; si el destino ya existe (la foto se compro antes), se
   descarta el temporal.
3. Escribir `manifest.cliente` en una sola escritura atomica. **Las filas no se tocan**: el `id` no
   cambia y la resolucion es por cadena.

**Rationale**: el original **no lo necesita ningun item para imprimir** (lo que imprime es la
composicion del pool), asi que moverlo no rompe a otro item de la sesion. Es un `rename` en el mismo
filesystem: barato y atomico. La cadena de resolucion (`orders` -> `tmp`) hace que el orden no
importe: si el proceso muere a la mitad, la fila sigue resolviendo desde `tmp/` y el reintento
completa el movimiento.

**Alternativas**: (a) copiar y borrar — duplica bytes y agrega un estado intermedio; (b) mover los
originales antes del item — si falla el `rename` del item, el pedido queda sin item. Se descartan.

## R4 — Como se resuelve un original desde una fila

**Decision**: la fila es `origen: 'original'` con **solo `id`**. El servidor resuelve por cadena:
`orders/{clave}/uploads/{id}.webp` (fija) -> `tmp/sesion-{sid}/uploads/{id}.webp` (temporal), con
`id` validado por `/^[a-f0-9]{12}$/` y `is_file()`; si no esta en ninguna, `motor:original:ausente`.
**No** se usa `ref` relativo para fotos del cliente.

**Rationale**: la fila no necesita saber donde esta el archivo: la ubicacion es un detalle del
servidor y cambia sola al pagar (rename). Eso elimina `clave` de la fila, el `ref` relativo para
fotos y cualquier reescritura de filas al promover.

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
`origen: 'original'` y el mismo `id`. El `id` es `substr(sha, 0, 12)`.

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

## R10 — Como se mantiene "la vista previa es el PDF" (enmendado 2026-10-28)

**Decision**: el add-to-cart manda `{id, receta}` (no el bitmap). El servidor compone la foto **bajo
demanda** al generar el PDF (`engine/Compositor.php`) y el Motor no cambia. La garantia pasa a ser
**mismo encuadre**: el compositor usa la MISMA receta y la MISMA matematica (`escalaBase`,
`escalaSalida`) que el selector, con paridad verificada por `tests/compositor-paridad.test.js`.

**Rationale**: subir el bitmap compuesto cuesta un PNG por grupo y por prueba de encuadre; con el
original ya en el servidor y la receta como dato declarativo, el bitmap es **derivado** y el nombre
por receta lo cachea. GD con WebP esta verificado en el hosting (2026-10-28), asi que el camino es
viable en produccion.

**Alternativas**: (a) seguir subiendo el bitmap — descartada: era el estado anterior y no ahorra
nada ahora que el original viaja igual; (b) recomponer en el navegador al descargar — la descarga es
un GET sin navegador.

## R13 — Compositor: por que `ox/oy` y no `dx/dy`

**Decision**: la receta lleva `ox/oy` (centro de dibujo **normalizado**) en lugar de `dx/dy`. El
cliente lo calcula con `origenDibujo()` (que ya conoce `geo.principal` y `geo.margenX/Y`); el
servidor dibuja en `(ox*w, oy*h)`.

**Rationale**: `assets/selector-pmu.js` exporta `geometriaEscena`, `escalaBase`, `escalaSalida` y
`origenDibujo`, pero **PHP no tiene ninguna** de las cuatro. Portar `geometriaEscena` (geometria de
envoltura) duplicaria logica delicada y divergiria con el tiempo. `ox/oy` traslada al cliente la
unica parte que depende de la forma y deja en el servidor aritmetica plana, verificable por paridad.

**Alternativas**: (a) portar `geometriaEscena` a PHP — duplica y divergge; (b) mandar `dx/dy` y el
centro de la forma por separado — mas claves y el servidor tendria que combinarlas igual. Se
descartan.

## R11 — Como se sube el original en segundo plano

**Decision**: la subida del original arranca **al elegir la foto** (no al aceptar el corte ni en el
add-to-cart): se acota a 2000 px, se guarda en IndexedDB y se encola un POST a `handle_subida`
(cola FIFO de a 2 en paralelo, con `sha` como clave de dedupe). El add-to-cart hace
`Promise.all` de la cola y muestra el aviso solo si queda algo pendiente.

**Rationale**: maximiza el tiempo de subida mientras el comprador elige opciones y ajusta el
recorte; con dedupe por sha, probar 5 encuadres de la misma foto **no reenvia** nada. El aviso es la
red de seguridad para redes lentas o muchas fotos, no el camino normal.

**Alternativas**: (a) subir al aceptar el corte — menos basura, menos tiempo de subida; (b) subir en
el add-to-cart — el navegador queda como unico origen y es el escenario que esta clarificacion
elimina; (c) subir al pagar — el peor momento. Se descartan.

**Fallo de subida**: 2 reintentos con backoff de **1 s y 3 s**; si sigue fallando, el add-to-cart
**bloquea** con causa accionable (no se vende un PDF sin la foto que el comprador vio). Una foto
descartada deja un draft que el TTL borra a las 24 h.

## R12 — Cuota por cliente

**Decision**: **no hay cuota** en esta entrega. Solo se mide: el smoke ya informa el peso por
identidad (030 P2) y `estado_pmu` da el estado del espejo. El cap de 2000 px acota el peso por
archivo (un WebP q0.85 ronda 250-500 KB).

**Rationale**: inventar un limite sin datos rechaza compras legitimas o rompe el flujo con un mensaje
que nadie probo. La medicion existe y es barata; con 2-3 semanas de uso real el numero sale solo.

**Alternativas**: (a) cuota dura por identidad — necesita un valor y una UX de rechazo que no se
pueden validar todavia; (b) cuota blanda con aviso — agrega UI sin resolver el disco; (c) solo
limite por archivo — es lo que ya hay (cap 2000). Se descartan por ahora.
