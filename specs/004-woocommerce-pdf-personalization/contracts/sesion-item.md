# Contract: Sesion e item del comprador (`PMU_Sesion`)

**Feature**: 004-woocommerce-pdf-personalization | **Version**: 1 (norma 2026-09-17)

Duenno del ciclo de vida del comprador. `PMU_Uploads` sigue siendo el dueno de las rutas
(Const. II): `PMU_Sesion` opera SOLO con las rutas que este le entrega.

## Ciclo de vida (un directorio que se mueve)

```text
tmp/sesion-{sid}/draft-{uuid}/        <- "Vista previa" genera el borrador
tmp/sesion-{sid}/{cart_item_key}/     <- add-to-cart: rename del MISMO arbol (sid estable)
tmp/orders/{order_id}/{item_key}/     <- copia al crearse el pedido (staging)
orders/{order_id}/{item_key}/         <- rename al confirmarse el pago (entregable)
```

- El `sid` es un UUID propio (`cookie pmu_sid`, 30 dias, `httponly`), independiente de la
  sesion PHP y de Woo: sobrevive al login y al carrito vacio.
- El item NUNCA se copia ni se duplica: se mueve. Mismo PDF en 2 productos iguales con
  distinta personalizacion = 2 items hermanos (distinto `item_key`).
- Cada item es un diseño unico: cantidad fija 1; todo `add-to-cart` lleva
  `cart_item_data.unique_key = uuid` para que Woo no fusione lineas.

## API (metodos publicos)

| Metodo | Devuelve | Notas |
|--------|----------|-------|
| `sid_actual()` | string | lee/emite la cookie `pmu_sid` (UUID v4, 30 dias) |
| `dir_item($sid, $item_key, $crear = false)` | string | `tmp/sesion-{sid}/{item_key}/` |
| `crear_draft($sid, $pdfs)` | string | `draft-{uuid}` nuevo con `manifest.json` inicial |
| `promover($sid, $draft, $cart_item_key)` | string | `rename()` a `{cart_item_key}` (mismo sid) |
| `leer_manifest($sid, $item_key)` | array | lectura tolerante (aviso + estado vacio) |
| `guardar_manifest($sid, $item_key, array $m)` | string | `.tmp` + `rename` |
| `guardar_png($sid, $item_key, $pdf, $grupo, $bytes)` | array | devuelve `{indice, file, hash}` y anota en `archivos[]` |
| `congelar_webp($sid, $item_key, $mockup_id, $bytes)` | string | `mockup-{id}.webp` (300x300) |
| `estado_preview($sid, $item_key)` | string | `ok` / `sin_vista` / `omisible` |
| `borrar_item($sid, $item_key)` | void | borrado quirurgico (al quitar del carrito) |
| `staging_order($order_id, $item_key, $sid)` | string | copia a `tmp/orders/{order_id}/...` |
| `promover_order($order_id, $item_key)` | string | rename a `orders/...` (flag `.promocionando`) |
| `limpiar_ttl($horas_drafts = 24)` | int | borra drafts vencidos por `manifest.creado` |

## Nomenclatura del pool

`img/{pdf}-{id}-{n}.png`:
- `{pdf}` nombre saneado del PDF; `{id}` grupo (hex sin `#`); `{n}` 1..N (numerado cuando el
  grupo necesita varios PNGs).
- Pool DEDICADO al item: sin deduplicacion entre items (evita colisiones y borrados ajenos).
- `hash = sha1(valor + preset + settings + WxH)` se guarda por fila para la regeneracion
  parcial (solo se re-renderiza lo cambiado).

## `manifest.json` (contrato)

```json
{
  "item_key": "draft-3c91",
  "sid": "8f2a",
  "pdfs": ["dia-madre-1"],
  "valores": {"1": {"valor": "Abuela Ana", "cliente": "Abuela Ana"}},
  "archivos": [
    {"pdf": "dia-madre-1", "grupo_id": "0000FF", "indice": 0,
     "file": "img/dia-madre-1-0000FF-1.png", "hash": "3f9c2a1b"}
  ],
  "mockup_vistas": ["fiesta"],
  "mockup_visto": "fiesta",
  "preview_estado": "ok",
  "creado": "2026-09-17T14:02:11Z",
  "motor": "4.1.0"
}
```

Reglas:
- `archivos[]` es el indice que lee el Motor: nunca adivina por nombre.
- `preview_estado`: `ok` (vistas + pool completos), `sin_vista` (fallo de render, venta
  habilitada), `omisible` (decision del admin).
- `valores` siempre dual: `valor` (sistema) + `cliente` (etiqueta).

## Errores (formato `motor:<op>:<causa>`)

| Causa | Cuando |
|-------|--------|
| `motor:sesion:sid:invalido` | cookie corrupta o manipulada |
| `motor:sesion:item:ausente` | el `item_key` no existe bajo el sid |
| `motor:sesion:manifest:invalido` | JSON ilegible (aviso + estado vacio) |
| `motor:sesion:pool:parcial` | falta un archivo del indice (⇒ `sin_vista`) |
| `motor:sesion:directorio:no_escribible` | permisos |
| `motor:sesion:promocion:pendiente` | flag `.promocionando` activo (reintentar) |

## Criterios de aceptacion

- Ningun archivo de sesion se crea fuera de estos metodos.
- El `sid` no cambia entre draft, item y pedido.
- Dos items con el mismo PDF/grupo/placeholder no comparten archivos.
- Quitar un item del carrito borra su carpeta; `orders/` nunca se toca desde la limpieza.