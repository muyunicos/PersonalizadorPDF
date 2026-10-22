# Data Model — Spec 030 (biblioteca de imagenes del comprador)

> Fase 1 de `/speckit-plan`. Todo son **archivos y manifests existentes** mas campos **aditivos**: no hay
> entidad de almacenamiento nueva (D1). Los nombres son los del manifest (`snake_case`).

## 1. Contenedor (unidad del escaneo)

| Campo | Tipo | Reglas |
|---|---|---|
| `tipo` | `sesion` o `pedido` | `sesion` = `tmp/sesion-{sid}/{item_key}/`; `pedido` = `orders/{order_id}/{item_key}/` |
| `id_contenedor` | string | `s:{sid}` o `p:{order_id}`; **interna, no viaja al cliente** |
| `items[]` | lista | carpetas con `manifest.json` legible (lectura tolerante: un item roto se ignora con aviso) |
| `mtime`, `size` | int | del `manifest.json`: alimentan la `revision` (R5) |

Se agrupan por identidad (R1): invitado = cookie `pmu_sid`; registrado = cuenta + `_pmu_sid` de sus line
items. **Tope: 10 contenedores** por consulta (los mas recientes, D23).

## 2. Item

| Campo | Tipo | Reglas |
|---|---|---|
| `item_key` | string | `[a-z0-9-]{8,32}` (`item_seguro`) |
| `sid` | string | uuid de la sesion; **tambien presente en los pedidos** (R1) |
| `pdfs[]` | lista | snapshot de PDFs del item |
| `valores{cid}` | mapa | `{valor, cliente}`; `valor` puede ser lista de ids de `subidas[]` |
| `subidas[]` | lista | filas de archivo de familia (§4) |
| `archivos[]` | lista | filas del pool: `origen` = `subida`, `texto` o `ref` |
| `preview_estado` | string | `ok`, `sin_vista` u `omisible` |

## 3. Familia (la foto, tal como la ve el cliente)

Entidad **derivada** (no se guarda en ningun catalogo): se agrupa por `madre`.

| Campo | Tipo | Reglas |
|---|---|---|
| `madre` | string | id del **primer** archivo de la familia (`[a-z0-9]{12}`): define el nombre; **inmutable** (D5) |
| `base` | string | id del archivo de **mayor resolucion** (area `w*h`); portada de la galeria; **es un flag** (D6) |
| `versiones` | int | cantidad de archivos de la familia (badge `N versiones`) |
| `sha` | string | `sha1` del contenido **subido** (R9): habilita el dedupe (D24) |
| `w`, `h` | int | medidas del archivo `base` |
| `url` | string | enlace del endpoint protegido (`op=imagen&madre=...&_wpnonce=...`): lo que la tira y el visor pintan |
| `usos` | mapa | `{carrito: [item_key], pedidos: [order_id]}` (R6): alimenta el aviso de borrado |
| `creado` | ISO 8601 | el mas reciente de la familia |

Una familia **no** tiene estado de ocultamiento (D16) y no se borra por partes (D25).

## 4. Fila de archivo de familia (`manifest.subidas[]`)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string | `{madre}` en la primera, `{madre}-{n}` (n>=2) en las versiones; **lo pone el servidor** (R11) |
| `file` | string | `subidas/{id}.{ext}`, **relativo al item** (ausente cuando la fila es `ref`) |
| `origen` | `subida` o `ref` | `ref` = el archivo vive fuera del item (D10) |
| `ref` | string | solo con `origen: ref`: relativo a `uploads/pmu/` (`orders/{A}/_comun/...`), validado con `realpath` (R4, corregido por el arnes) |
| `madre` | string | familia a la que pertenece (D5) |
| `base` | 0 o 1 | flag de calidad de la familia (D6) |
| `receta` | string | `sha1` de la composicion, **recomputado por el servidor** (R2) |
| `sha` | string | `sha1` del contenido al subir (R9) |
| `mime`, `bytes`, `creado` | string, int, int | igual que hoy |

Invariantes: `file` y `ref` son mutuamente excluyentes; una fila `ref` **no** protege ningun archivo local
(la poda de la spec 029 no cambia).

## 5. Receta (identidad de la composicion)

`receta = sha1(w|h|forma|modo|escala|dx|dy|fondo|transp|iw|ih)`

- `w`, `h`: lienzo del hueco (specs 019/028); `forma`: `rectangulo`, `circulo`, `cuadrado`, `ovalo`, `auto`.
- `modo`: `cubrir`, `encajar`, `estirar`; `escala`: 0.25-4; `dx`, `dy`: desplazamiento; `fondo`: color o
  `transparente`; `transp`: politica del campo (spec 027).
- `iw`, `ih`: medidas del origen que se cargo en el selector (lo que permite comparar peras con peras).

**Igualdad de receta -> referencia (0 bytes). Diferencia -> version** (D8). El servidor es el unico que
calcula el hash (R2).

## 6. Estados y transiciones

```
subida   -> familia nueva (o reuso por sha: D24)
         -> uso: receta igual     -> fila {origen: ref}                  (0 bytes)
                 receta distinta  -> archivo {madre}-{n} + promocion de base (version)
carrito  -> consolidacion (staging + promocion, idempotente, R3)
         -> orders/{order}/_comun/{madre}-{n} y TODOS los items en {origen: ref}
pago     -> orders/ (permanente: no vence)
abandono -> TTL 30 dias -> se borra el item con sus fotos (D26)
borrado  -> familia completa (original + versiones) y sus filas, con el aviso de usos (D17/D25)
```

## 7. Reglas de validacion

1. **Ningun** dato que manda el cliente (`madre`) arma una ruta: se re-resuelve contra el escaneo propio (D14).
2. `receta` y `sha` los calcula el **servidor** (R2/R9); el cliente solo declara parametros.
3. `ref` pasa por `realpath` dentro de `uploads/pmu/` (R4); si no resuelve, el hueco queda transparente.
4. Tope de **10 contenedores** por consulta; sin paginacion en v1 (P4 cubre el *ver mas*).
5. Escritura de manifests **atomica + lock** (R3); lectura **tolerante** (item roto = aviso, no error global).
6. El TTL y el barrido trabajan **por item completo** (§IV): nunca archivos sueltos.
