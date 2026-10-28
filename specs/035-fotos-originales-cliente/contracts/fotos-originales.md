# Contrato — Fotos originales y carpeta del cliente (035)

> Normativo. Si el codigo y este archivo discrepan, gana este contrato (y se corrige el codigo).

## C1 — Receta v2 (identidad de la composicion)

```json
{ "v": 2, "w": 463, "h": 463, "forma": "cuadrado", "modo": "cubrir",
  "escala": 1.25, "dx": -0.031, "dy": 0.014, "fondo": "transparent",
  "transp": "no", "rot": 90, "iw": 1600, "ih": 1200, "phsize": 1, "gid": "0000FF" }
```

- **Claves y orden** (los fija `receta_de`): `v,w,h,forma,modo,escala,dx,dy,fondo,transp,rot,iw,ih,phsize,gid`.
- `receta_de()` = `substr(sha1(implode('|', valores)), 0, 12)`. **Solo el servidor** lo calcula.
- `rot` es **obligatorio**: sin el, 90 y 270 colisionan (bug que esta spec cierra).
- `dx/dy` en **fraccion del lienzo** (-1..1), no en px.
- Validacion (rechaza con causa, no corrige en silencio): `v === 2`, `modo` en
  `{cubrir,encajar,estirar}`, `escala` en [0.25, 4], `rot` en `{0,90,180,270}`, `phsize` en
  `{0,1,2}`, `gid` `^[0-9A-F]{6}$`, `dx/dy` en [-1,1].
- El lienzo que **vale** es el que deriva el servidor (`analisis.json` + `phsize`); `w/h` de la
  receta es solo el snapshot con el que se compuso.

## C2 — Fila de `manifest.subidas[]`

```json
{ "origen": "cliente", "id": "9f2c41ab0d7e", "clave": "45", "madre": "9f2c41ab0d7e",
  "receta": "a1b2c3d4e5f6", "sha": "…", "mime": "image/webp", "bytes": 412000, "creado": 1761000000 }
```

| `origen` | Campos obligatorios | Prohibidos |
|---|---|---|
| `subida` (composicion) | `id`, `file` = `subidas/{id}.webp` | `clave`, `ref` |
| `sesion` (original en la sesion) | `id` | `file`, `ref`, `clave` |
| `cliente` (original comprado) | `id`, `clave` (`^\d{1,12}$`) | `file`, `ref` |
| `ref` (030, entre pedidos) | `id`, `ref` | `file`, `clave` |

- `id` = `^[a-f0-9]{12}$`; **deriva del contenido**, nunca lo propone el cliente.
- `madre` = familia; **inmutable** (no se renombra).
- **Terminologia**: `clave` es el **campo** de la fila y de `manifest.cliente`; `{cliente}` es el
  nombre de la carpeta en las rutas. Son el **mismo valor** (el `uid` del pedido).
- El servidor **nunca** arma una ruta con texto del cliente: `id`/`clave` se validan por regex y el
  archivo se verifica con `is_file()`.

## C3 — Rutas

| Ruta | Dueno | Regla |
|---|---|---|
| `tmp/sesion-{sid}/uploads/{id}.webp` | `PMU_Uploads::dir_sesion_uploads()` | originales de la sesion (1 por `id`, compartidos por items) |
| `tmp/sesion-{sid}/{item_key}/subidas/{id}.webp` | idem | composiciones (una por receta) |
| `tmp/sesion-{sid}/{item_key}/` | idem | `manifest.json`, `img/` (pool), `mockup-*.webp` |
| `orders/{cliente}/{order_id}/{item_key}/` | idem | entregable (misma estructura interna que hoy) |
| `orders/{cliente}/uploads/{id}.webp` | idem | originales comprados (dedupe por `id`) |
| `orders/{cliente}/datos.json` | idem | catalogo del cliente |

- `{cliente}` y `{order_id}` son **numericos** (`ctype_digit`); `orders/{cliente}/uploads/` **no** es
  un pedido y ningun escaneo lo lista como tal.
- `tmp/orders/` **no existe** (sin staging).
- **Sin cuota por identidad en esta entrega**: solo medicion (smoke/`estado_pmu`); el cap de
  2000 px acota el peso por archivo.
- El original se sube **en segundo plano** desde que se elige la foto (dedupe por sha); el
  add-to-cart espera solo lo pendiente y, en el caso normal, no muestra espera.
- **Sin compatibilidad con el arbol viejo**: `orders/{order_id}/` (sin nivel de cliente) **no** se
  lee; no hay pedidos previos (D12). Los 4 puntos de lectura usan solo `orders/{cliente}/{order_id}/`.
- Ninguna purga futura de `orders/` puede tocar `orders/{cliente}/uploads/` sin materializar antes
  las composiciones de los pedidos que lo referencian.

## C4 — `manifest.cliente`

- Lo escribe `promover_order()` **una vez** (`/^\d{1,12}$/`).
- Lo leen `manifest_item()`, `item_generar_pdfs()` e `item_regenerar()` para armar la ruta sin Woo.
- Si un pedido llega con `customer_id = 0`: **no se promueve** y queda causa visible en Pedidos.

## C5 — `datos.json`

- `{version:1, items:[{id,nombre,w,h,bytes,mime,sha,creado,ultimo_uso,favorito}], opciones:{}}`.
- `nombre` es el nombre original del archivo (PII): **nunca** se usa como nombre en disco.
- Escritura con `mutar_manifest_dir()`; lectura tolerante (item invalido = aviso, no error global).

## C6 — Marca de "visto"

- Una vista queda `visto` cuando la galeria la **pinta** (incluye la inicial).
- Orden: `preview_omisible` ascendente (las obligatorias primero).
- Aviso mientras falte una obligatoria: "Revisa la vista previa".
- `bloqueos.vistas` pasa a `false` recien al ver la **ultima obligatoria**.
- Persistencia: `localStorage['pmu_vistas_v1'][item_key]` (cliente) y `manifest.mockup_vistas` (al
  congelar). **Cero** peticiones durante la navegacion.
- Una vista `fallida` no cuenta como obligatoria.

## C7 — Invariantes

1. **La vista previa es el PDF**: el PDF se arma con la composicion que subio el navegador; no hay
   compositor PHP.
2. **Idempotencia**: re-subir el mismo original no duplica (`id` = sha); re-promover no repite
   (`rename` con destino existente = no-op); re-registrar un grupo reemplaza sus filas.
3. **Sin traversal**: ninguna ruta se arma con texto del cliente sin regex + `is_file`/`realpath`.
4. **Sin migracion** (filas ni rutas): las filas viejas (`subida`/`ref`/`texto`) se leen igual, pero
   el arbol `orders/{order_id}/` no (no hay pedidos previos).
5. **Borrar un original no rompe pedidos**: la composicion vive en el pedido.
