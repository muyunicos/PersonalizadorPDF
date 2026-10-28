# Data Model — Spec 035 (fotos originales y carpeta del cliente)

> Phase 1 de `/speckit-plan`. Todo son **archivos y manifests existentes** mas campos **aditivos**.
> El unico artefacto nuevo es la carpeta del cliente (`orders/{cliente}/`), que sigue siendo un
> ambito de datos de `PMU_Uploads` (no hay entidad de almacenamiento nueva).

---

## 1. Original (la foto tal como la subio el comprador)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string | `substr(sha1(bytes_crudos), 0, 12)`; **deriva del contenido**, no se propone desde el cliente |
| `w`, `h` | int | dimensiones del WebP guardado; `max(w,h) <= 2000` (cap revalidado en servidor) |
| `bytes` | int | peso del WebP (q0.85) |
| `mime` | string | `image/webp` (o el real si no hay GD) |
| `sha` | string | `sha1` de los bytes **crudos** (antes de convertir): clave de dedupe |
| `nombre` | string | nombre original del archivo, **solo** en `datos.json` (nunca en el filesystem) |
| `creado` | int | `time()` |
| `favorito` | 0/1 | reservado (la UI va en otra spec) |
| `ultimo_uso` | int | reservado (la UI va en otra spec) |

Ubicacion: `tmp/sesion-{sid}/uploads/{id}.webp` mientras la sesion vive;
`orders/{cliente}/uploads/{id}.webp` despues del pago (**rename**, sin copia ni duplicado).

## 2. Fila de `manifest.subidas[]`

| Campo | Tipo | Reglas |
|---|---|---|
| `origen` | enum | `original` (la foto del comprador) · `compuesta` (el bitmap que imprime el Motor) · `ref` (archivo de otro pedido, 030) |
| `id` | string | `{sha12}` del original (estable entre items y pedidos) |
| `file` | string | solo `origen: compuesta`: `img/foto-{pdf}-{gid}-{n}.webp` (relativo al item) |
| `ref` | string | solo `origen: ref`: relativo al item, validado con `realpath` dentro de `uploads/pmu/` |
| `madre` | string | familia = el `id` del original; **inmutable** |
| `receta` | string | hash de la composicion (v2) |
| `sha` | string | `sha1` de los bytes crudos |
| `mime`, `bytes`, `creado` | string/int/int | igual que hoy |

**Invariantes**: la fila `original` lleva **solo `id`** (sin `file`, `ref` ni `clave`); `file` solo
existe con `origen: compuesta`; `ref` solo con `origen: ref`; al promover las filas **no se
reescriben** (el `id` no cambia) y el servidor resuelve la ubicacion por cadena.

## 3. Fila de `manifest.archivos[]` (lo que imprime el Motor)

| Campo | Tipo | Reglas |
|---|---|---|
| `pdf`, `grupo_id`, `indice` | string/string/int | sin cambios (029 D3: `indice` = posicion de instancia) |
| `origen` | enum | `compuesta` (composicion) · `texto` (pool) · `ref` (030) |
| `file` / `ref` | string | `img/foto-…` / `img/txt-…` o la referencia de la 030 |
| `hash` | string | receta de la composicion (v2) |

El Motor no cambia: sigue recibiendo rutas ya resueltas (`$dir . '/' . file`).

## 4. Receta v2

```json
{ "v": 2, "w": 463, "h": 463, "forma": "cuadrado", "modo": "cubrir",
  "escala": 1.25, "dx": -0.031, "dy": 0.014, "fondo": "transparent",
  "transp": "no", "rot": 90, "iw": 1600, "ih": 1200, "phsize": 1, "gid": "0000FF" }
```

| Campo | Regla |
|---|---|
| `v` | `2` obligatorio; un `v` ausente o `1` se recomputa (no se acepta como identidad) |
| `w`,`h` | lienzo con el que se compuso (snapshot; el servidor deriva el lienzo real de `analisis.json` + `phsize`) |
| `forma` | `rectangulo`/`circulo`/`cuadrado`/`ovalo`/`auto` |
| `modo` | `cubrir`/`encajar`/`estirar` (los alias viejos se canonizan) |
| `escala` | 0.25 - 4 |
| `dx`,`dy` | fraccion del lienzo (-1..1) |
| `fondo` | `auto`/`transparent`/`#rrggbb` |
| `transp` | `si`/`no`/vacio |
| `rot` | `0`/`90`/`180`/`270` |
| `iw`,`ih` | dimensiones del origen cargado (post-cap) |
| `phsize` | `0`/`1`/`2` |
| `gid` | grupo del hueco (`^[0-9A-F]{6}$`) |

`receta_de()` (servidor) es el **unico** que calcula el hash: `sha1(implode('|', claves_v2))[:12]`.

## 5. `manifest.cliente` (congelado al promover)

| Campo | Tipo | Reglas |
|---|---|---|
| `cliente` | string | `uid` del pedido; `/^\d{1,12}$/`; escrito **una vez** en `promover_order()` |

Lo leen `manifest_item()`, `item_generar_pdfs()` e `item_regenerar()` para armar
`orders/{cliente}/{order_id}/{item_key}` **sin** consultar Woo.

## 6. `datos.json` del cliente

```
orders/{cliente}/datos.json
{ "version": 1,
  "items": [ { "id": "9f2c41ab0d7e", "nombre": "foto playa.jpg", "w": 2000, "h": 1500,
               "bytes": 412000, "mime": "image/webp", "sha": "...", "creado": 1761000000,
               "ultimo_uso": 0, "favorito": 0 } ],
  "opciones": {} }
```

Escritura con `mutar_manifest_dir()` (flock + `.tmp` + `rename`). Lectura **tolerante**: un item sin
`id` o con `id` invalido se ignora con aviso (no rompe la galeria).

## 7. Vista (marca de "visto")

| Campo | Tipo | Reglas |
|---|---|---|
| `mockup_id` | string | id del mockup (`config.json:mockups[].id`) |
| `pdf` | string | PDF al que pertenece la vista |
| `obligatoria` | bool | `!preview_omisible` del PDF |
| `visto` | bool | se pone al **pintar** la vista (cliente); se persiste en `manifest.mockup_vistas` al congelar |
| `fallida` | bool | una vista podada por error no cuenta como obligatoria |

## 8. Estados y transiciones

```
elige foto     -> IndexedDB (cap 2000)                          [cliente]
guarda corte   -> composicion en canvas (0 red)                 [cliente]
add-to-cart    -> original a tmp/sesion-{sid}/uploads/{id}       [origen: original]
                  composicion y textos a {item}/img/             [origen: compuesta/texto]
                  marca de visto -> manifest.mockup_vistas
pago           -> rename del item a orders/{cliente}/{order_id}/{item}
                  rename de cada original a orders/{cliente}/uploads (idempotente)
                  manifest.cliente (las filas no cambian)
descarga       -> Motor con las filas archivos[] (no usa el original)
borrar foto    -> no rompe pedidos (la composicion vive en el pedido)
TTL 30 dias    -> el item y sus originales de sesion vencen (P6 = B)
```

## 9. Reglas de validacion

1. **Ningun** dato del cliente arma una ruta: `id`, `clave` (contexto) y `gid` se validan por regex
   y se resuelven contra `uploads/pmu/`.
2. `receta` y `sha` los calcula el **servidor**; el cliente solo declara parametros.
3. `max(w,h) <= 2000` se revalida en el servidor (`getimagesize`/GD).
4. Escritura de manifests **atomica + lock**; lectura **tolerante**.
5. `orders/{cliente}` y `orders/{order_id}` son **numericos**; los escaneos exigen `ctype_digit` en
   los dos niveles y nunca listan `uploads/` como pedido.
6. Sin migracion: las filas viejas (`subida`/`ref`/`texto`) se siguen leyendo.
