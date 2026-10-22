# Research — Spec 030 (biblioteca de imagenes del comprador)

> Fase 0 de `/speckit-plan`. Resuelve los NEEDS CLARIFICATION del Technical Context y fija el **como**
> de cada decision de la spec. Todo se apoya en codigo existente (ver §Hallazgos).

## R1 — Identidad sin estado nuevo (D2/D3)

**Decision**: invitado = cookie `pmu_sid` + los pedidos cuyo `manifest.json.sid` coincide; registrado =
`wc_get_orders(['customer_id' => $uid])` + los `_pmu_sid` de sus line items + la user meta `_pmu_sids`
como lista de sesiones ligadas. El ligado lo escribe el hook `woocommerce_guest_session_to_user_id`
(Woo 8.8+) y, con Woo mas viejo, `wp_login` + cookie vigente.

**Rationale**: los datos ya existen (el `manifest.json` de cada item guarda `sid`; el line item `_pmu_sid`;
el pedido `customer_id`) y Woo da el gancho exacto para la transicion anonimo -> cuenta: cero archivos,
cero tablas, cero migracion.

**Alternativas**: `uploads/pmu/vinculos/{sid}.json` (descartado por el usuario); tabla custom (viola §IV);
confiar solo en la cookie (un registrado desde otro dispositivo no veria sus fotos); consultar `sid -> uid`
en una request deslogueada (fuga en dispositivos compartidos: descartado por D3).

## R2 — Quien calcula la `receta` (D7/D8)

**Decision**: la **recomputa el servidor** con un `sha1` canonico de
`w|h|forma|modo|escala|dx|dy|fondo|transp|iw|ih`, igual que hoy `hash_pool()` recomputa el hash del pool
desde los campos del POST.

**Rationale**: de esa comparacion depende **referenciar (0 bytes) o escribir un archivo**: no puede salir
de un dato que el cliente elige. El patron ya existe y esta probado.

**Alternativas**: aceptar la `receta` del cliente (no confiable); comparar bytes (imposible: el encoder del
canvas no es determinista, D7); comparar solo dimensiones (ignora modo/escala/desplazamiento/fondo y
referenciaria una composicion distinta = PDF equivocado).

## R3 — Escritura de manifests **fuera** de la sesion (D11)

**Decision**: extraer el patron de `mutar_manifest($sid, $item_key, $cb)` a `mutar_manifest_dir($dir, $cb)`
(lock `flock` + `manifest.json.tmp` + `rename`) y usarlo en la consolidacion, que escribe items ya movidos
a `tmp/orders/{order}/` y `orders/{order}/`.

**Rationale**: `guardar_manifest()` / `mutar_manifest()` resuelven la ruta por `sid`+`item_key`
(`dir_sesion_item`), y en la consolidacion el item ya no vive bajo la sesion. El lock es obligatorio: el
arnes `pool_concurrente` ya evidencio la carrera del manifest.

**Alternativas**: reusar `mutar_manifest` (imposible: resuelve por sid); escribir sin lock (carrera ya
conocida); devolver el item a la sesion (rompe la promocion por `rename`).

## R4 — `resolver_ref` (D10/D13)

**Decision**: `ref` es **relativo a `uploads/pmu/`** (el arnes demostro que la profundidad del item difiere entre `tmp` y `orders/`: 3 vs 2 niveles), se resuelve con `realpath()` y se verifica que quede dentro del
`basedir` de `uploads/pmu/`; si no resuelve: `motor:descarga:ref:ausente` y hueco transparente. El cliente
**nunca** manda rutas: manda `madre` (la familia) de su propio listado.

**Rationale**: el item esta a la **misma profundidad** en `tmp/sesion-{sid}/` y en `orders/{order}/`, asi que
el mismo texto relativo vale antes y despues de promover (cero reescritura) y `realpath` corta cualquier
traversal.

**Alternativas**: rutas absolutas guardadas (se rompen al promover y filtran el `basedir`); `basename()`
(imposible: el `ref` cruza carpetas).
## R5 — `revision` de la galeria (D23)

**Decision**: `revision` = `sha1` de la lista ordenada `{contenedor}|{item_key}|{mtime}|{size}` de los
manifests escaneados (el mismo escaneo que arma la vista). `listar` con `desde == revision` responde
`{sin_cambios:true}` **sin lista**.

**Rationale**: cuesta dos datos por manifiesto que ya se esta leyendo y detecta altas, bajas y ediciones
(incluido el borrado hecho en otra pestaña) sin indice, sin tabla y sin JSON.

**Alternativas**: TTL a ciegas (mostraria algo ya borrado); indice persistido (descartado por el usuario);
`revision` = cantidad de archivos (no detecta reemplazos ni ediciones).

## R6 — `usos` para el aviso de borrado (D17)

**Decision**: `usos` sale del **mismo escaneo**: `carrito` = items de las sesiones del sid que contienen la
familia; `pedidos` = pedidos de la identidad que la contienen. El aviso los muestra tal cual
(`en tu carrito`, `pedido #N`).

**Rationale**: cero consultas extra (los manifests ya se leen para armar la vista) y, al no haber bloqueo
(D17), el aviso es informativo y no una validacion.

**Alternativas**: `meta_query` por `_pmu_sid` (no es consultable en line items sin recorrer los pedidos);
indice de uso persistido (JSON extra).

## R7 — Como se sirven las imagenes (D14)

**Decision**: por el endpoint protegido (nonce + identidad) con `Cache-Control: private, max-age` y `ETag`
por `mtime`; el cliente guarda **solo metadatos**.

**Rationale**: `uploads/` es publico y enumerable (una URL cruda expone fotos de personas) y el cache HTTP
del navegador ya evita volver a bajarlas.

**Alternativas**: URLs crudas de `uploads/` (privacidad); blobs en `localStorage` (tope ~5 MB y fotos
personales en el disco del navegador); sprite de miniaturas (inventario y certificacion nuevos: descartado).

## R8 — Cache del cliente (D23)

**Decision**: **una** cache por pagina en `assets/biblioteca-pmu.js` (identificador `pmu_bib_v1`, valor
`{revision, fotos, ts}`) **compartida por todos los campos/ranuras**; invalidacion tras `usar` / `borrar` /
subida (**re-consulta** al servidor) mas revalidacion por `revision`.

**Rationale**: es lo pedido (*por campo con cache y rapido*): abrir el modal en el segundo campo no sale a
la red, y el costo del servidor queda acotado por el tope de 10 contenedores.

**Alternativas**: una cache por `CargadorPMU` (N peticiones por pagina); sin cache (latencia en cada
apertura); `localStorage` como unica fuente (queda viejo si se borra en otra pestaña).

## R9 — Dedupe por contenido (D24)

**Decision**: `sha` = `sha1` de los bytes **recibidos**, calculado **antes** de `convertir_webp()` (esa
conversion cambia los bytes y romperia la comparacion), guardado en la fila al subir. Al subir se compara
contra el `sha` de las **bases** del listado vigente: si coincide, se reusa esa familia.

**Rationale**: el `sha` viaja en la fila (no se lee ningun archivo para comparar) y el alcance coincide con
lo que el cliente ve en la tira (*lo que ves es lo que dedupea*).

**Alternativas**: dedupe global (obligaria a hashear todo el historico en cada subida); dedupe por nombre de
archivo (el nombre no es identidad); no deduplicar (contradice el objetivo original).
## R10 — TTL y cron (D18/D26)

**Decision**: `wp_schedule_event` **diario** -> barrido de **drafts (24 h)**, **sesiones sin items** e
**items de carrito abandonados (30 dias)**; siempre **por item completo** (§IV: nunca archivos sueltos) y
**nunca** lo que una fila o un `valores` referencia. `orders/` no se toca.

**Rationale**: hoy `limpiar_ttl()` no tiene ningun llamador (los drafts viven para siempre) y el disco en
hosting compartido no es infinito; lo comprado ya vive en `orders/`.

**Alternativas**: limpiar al vuelo en cada request (costo y sorpresa); TTL por archivo (rompe §IV); purgar
`orders/` por antiguedad (rompe referencias: D12 + P3).

## R11 — Numeracion `{madre}-{n}` y promocion de `base` (D5/D6)

**Decision**: el sufijo lo calcula el **servidor** dentro de la mutacion con lock: primer `n >= 2` libre
**en el item destino**. El `base` se reevalua comparando area (`w*h`) entre las versiones de la familia
y se mueve **por flag**, nunca por `rename`.

**Rationale**: el archivo vive en el item, asi que dos items pueden tener `{madre}-2` sin colisionar; el
lock evita que dos pestañas del mismo item elijan el mismo sufijo; renombrar romperia referencias de
pedidos anteriores.

**Alternativas**: `n` global (exigiria un contador persistido = JSON extra); `n` = timestamp (ilegible y
mas largo); renombrar el archivo mayor a `{madre}` (rompe referencias: descartado).

## R12 — La referencia apunta al ORIGEN (D10/D11)

**Decision**: no hay carpeta compartida ni consolidacion: las filas `origen: ref` guardan la ruta
**relativa a `uploads/pmu/`** del archivo de la familia en el pedido donde se subio (p. ej.
`orders/{oid}/{item}/subidas/{madre}.webp`). El ahorro es **entre pedidos**.

**Rationale**: N compras con la misma foto = 1 archivo, sin paso de consolidacion ni carpeta de dueno
ambiguo; y el arnes demostro que un `../..` fijo no sobrevive a la promocion (de ahi la base `uploads/pmu/`).

**Alternativas**: `_comun` + consolidacion (mas pasos e invariantes); punteros `.url` (segundo dueno del
mismo dato); catalogo JSON aparte (un catalogo nuevo, D1).

## Hallazgos del codigo (verificados, no supuestos)

| Punto | Que dice | Impacto en la 030 |
|---|---|---|
| `personalizador-pdf.php:2621-2622` | `item_generar_pdfs()` arma `$dir + file` y **saltea en silencio** si no existe | unico punto a cambiar para que el `ref` llegue al Motor (y para la causa explicita) |
| `inc/class-pmu-sesion.php:779-807` | `resolver_subidas()` resuelve como `dirSub + basename(file)` | hay que contemplar `origen: ref` para las miniaturas de la ficha |
| `inc/class-pmu-sesion.php:471-527` | `podar_subidas()` conserva lo que usan las filas `origen: subida` o algun `valores` | una fila `ref` no protege ningun archivo local (se hace explicito) |
| `inc/class-pmu-sesion.php:230-247` | `guardar_manifest()` resuelve por `sid` + `item_key` | motivo de R3 (`mutar_manifest_dir`) |
| `inc/class-pmu-sesion.php:363-373` | `fila_archivo()` es el **unico** lugar de la forma de la fila | ahi entran `madre`, `receta`, `base` y `sha` |
| `personalizador-pdf.php` (`hash_pool`) | el servidor **recomputa** el hash desde los campos del POST | precedente exacto de R2 |
| `inc/class-pmu-sesion.php:937-957` | `limpiar_ttl()` sin llamador en produccion | motivo de R10 (cron diario) |
| `personalizador-pdf.php:1676-1736` | `handle_subida()` crea el draft si todavia no hay item | la subida no cambia de flujo; suma el `sha` (R9) |
| `personalizador-pdf.php:1612-1618` | `handle_pool_png()` ya tiene la rama `fotos` (spec 029, solo ids, sin bytes) | precedente del `op=usar` |
| `uploads/pmu/orders/29088/...` | pedido real con `sid`, `subidas/e05f6c8302c0.png` y `valores` | confirma R1 y que el pedido ya guarda su propia copia |

## NEEDS CLARIFICATION

**Ninguno.** Los siete puntos abiertos del Technical Context quedaron resueltos en R1-R12, y los cuatro
pendientes de producto (P1-P4 de la spec §6) son decisiones de negocio declaradas, no incognitas tecnicas.
