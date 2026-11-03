# Data model (037) — Customs, diseno del pedido y contexto

> Fase 1 de [plan.md](./plan.md). Los contratos normativos estan en
> [contracts/puente-cotizador.md](./contracts/puente-cotizador.md) y
> [contracts/customs.md](./contracts/customs.md).

## Entidades

### Custom (idea del comprador) — `customs/{idea_id}/idea.json`

| Campo | Regla |
|---|---|
| `version` | `1` (para poder evolucionar sin migrar) |
| `id` | `^idea-\d{10}-[a-z0-9]{4}$`; unico dentro de la identidad |
| `creado` | epoch (segundos) |
| `favorito` | bool; la estrella lo pone en `true` y ordena al inicio |
| `orden` | int `0..999`; desempate manual (0 = sin ordenar) |
| `titulo` | string `<= 80`; lo propone el sistema y el comprador puede cambiarlo |
| `descripcion` | string `<= 240`; **generada** con material, forma, tamano, formato y planchas |
| `order` | codigo v1 del cotizador; se valida con el codec del cotizador (**no** se parsea aca) |
| `precio` | `{final, perUnit, total, sheets, stickers, savingsPct, ts}`; **foto** del momento |
| `diseno` | `{id, itemKey, sid, w, h, receta}`: el original y su encuadre |
| `mockup` | `{id, w, h, mockupId}`: el WebP del snapshot (300x300) y el mockup usado |

- `diseno.id` y `mockup.id` son `^[a-f0-9]{12}$` (12 hex del sha1, regla de la 035).
- `diseno.w/h` son los pixeles del sticker (`1..3000`); `diseno.receta` es `^[a-f0-9]{12}$`.
- Topes operativos: **60 ideas por identidad**; al superarlo se rechaza la nueva con causa.

### Plantilla del cotizador — `datos_config.json:plantillas[]`

| Campo | Regla |
|---|---|
| `id` | string estable (el admin puede duplicar) |
| `titulo` | `<= 60`; **se muestra al cliente** |
| `categoria` | `Circulares` \| `Rectangulares` \| `Formas` ("A Medida" comparte Formas) |
| `pdf` | slug de un PDF **importado** en el plugin (opcional); si falta, el item no entrega PDF |
| `rango` | opcional `{minX,maxX,minY,maxY}` en cm: aplica **solo** si el PH cae dentro (los tamanos intermedios se resuelven solos) |
| `visible` | bool (default `true`) |
| `orden` | int; define el orden en el admin y en la tira |

- El **mockup** (capas + envolturas) NO vive aca: es el del PDF (`pdfs/{slug}/config.json:mockups[]` +
  `pdfs/{slug}/mockups/*.webp`), editado con el **Editor de mockups** del plugin y servido por `op=mockups`.
- La **forma del hueco es automatica** (envoltura del placeholder): no se configura.
- Sin `pdf` no hay plantilla de impresion: el item nace `pdfs = []` y `preview_estado = omisible` (FR-037).
### Diseno del pedido — `manifest.contexto` + metas del line item

| Elemento | Regla |
|---|---|
| `manifest.contexto` | `'cotizador'` en el item creado por el cotizador |
| `manifest.pdfs` | `[]` (el cotizador no tiene PDF) |
| `manifest.preview_estado` | `'omisible'` (no hay vistas obligatorias; el mockup es informativo) |
| `manifest.subidas[]` | fila `origen: 'original'` con `id`, `madre`, `sha`, `receta`, `mime`, `bytes`, `creado` |
| `_pmu_sid` / `_pmu_item_key` | metas del line item: lo que ya lee `pedido_promover()` |
| `_mu_diseno_id` | `id` del original (para la descarga del admin) |
| `_mu_origen` | `'cotizador'` (para no confundirlo con un PDF) |

### Favorito

No es una entidad nueva: es el flag `favorito` de **cualquier** tarjeta de la tira. Las de la
tienda y el historial no se escriben: el favorito de una idea de la tienda se guarda como una
**preferencia de la identidad** (`favoritos.json` con `{tipo, ref}`); el de un custom, en su
`idea.json`.

### Entrada de historial

Derivada de los pedidos del comprador (`wc_get_orders` por `customer_id` + `_calculator_order_code`
+ `_mu_diseno_id`). No se persiste una copia: se arma al listar.

### Identidad

Reusa `biblioteca_identidad()`: cookie `pmu_sid` (30 dias) + `uid` (si hay sesion) + sus pedidos.
El invitado tiene identidad temporal; al comprar, `customer_id` pasa a ser la identidad fuerte.

## JSON de referencia

`orders/{cliente}/customs/idea-1761000000-a1b2/idea.json`:

```json
{
  "version": 1,
  "id": "idea-1761000000-a1b2",
  "creado": 1761000000,
  "favorito": true,
  "orden": 0,
  "titulo": "Circulos 6 cm - Vinilo",
  "descripcion": "Vinilo Adhesivo Blanco | Circulares 6,0 cm | Plancha Medio Corte | 15 planchas (~225 u)",
  "order": "v1.m11.s60.q15.f1.d0",
  "precio": {"final": 193500, "perUnit": 860, "total": 193500, "sheets": 15,
             "stickers": 225, "savingsPct": 12, "ts": 1761000000},
  "diseno": {"id": "9f2c41ab0d7e", "itemKey": "cot-2f7c9a1b", "sid": "b0f8225e",
             "w": 709, "h": 709, "receta": "a1b2c3d4e5f6"},
  "mockup": {"id": "5c1d77e0a9b3", "w": 300, "h": 300, "mockupId": "mk-circulares"}
}
```

`tmp/sesion-{sid}/cot-2f7c9a1b/manifest.json` (extracto):

```json
{
  "item_key": "cot-2f7c9a1b",
  "sid": "b0f8225e",
  "contexto": "cotizador",
  "pdfs": [],
  "preview_estado": "omisible",
  "creado": "2026-11-03T12:00:00Z",
  "valores": {},
  "subidas": [
    {"origen": "original", "id": "9f2c41ab0d7e", "madre": "9f2c41ab0d7e",
     "receta": "a1b2c3d4e5f6", "sha": "9f2c41ab0d7e...", "mime": "image/webp",
     "bytes": 412000, "creado": 1761000000}
  ]
}
```

Receta (`params`) que el cotizador manda con la subida:

```json
{"v": 2, "w": 709, "h": 709, "forma": "circulo", "modo": "cubrir", "escala": 1,
 "ox": 0.5, "oy": 0.5, "fondo": "#ffffff", "transp": "no", "rot": 0,
 "iw": 1600, "ih": 1200, "phsize": 0, "gid": "A1B2C3"}
```

## Reglas de validacion (resumen)

| Dato | Validacion | Causa si falla |
|---|---|---|
| `idea.id` | regex + unico | `cotizador:idea:id` |
| `idea.order` | codec del cotizador | `cotizador:idea:order` |
| `idea.descripcion` | `<= 240`, sin HTML | se recorta (no falla) |
| `idea.precio` | numeros `>= 0`, `ts` epoch | se descarta el bloque (tarjeta sin precio) |
| `diseno.w/h` | int `1..3000` | `cotizador:diseno:medidas` |
| `diseno.receta` | `^[a-f0-9]{12}$` | `cotizador:diseno:receta` |
| `diseno.itemKey` | `^cot-[a-z0-9]{8}$` | `cotizador:diseno:item` |
| `mockup.id` | `^[a-f0-9]{12}$` e `is_file` resuelto | `cotizador:mockup:ausente` |
| receta (params) | `receta_validar()` de la 035 + `lienzo` explicitado | `params:invalidos` |
| tope de ideas | `< 60` por identidad | `cotizador:ideas:tope` |

## Transiciones

```text
INVITADO
  tmp/sesion-{sid}/customs/idea-*/        idea.json + mockup.webp
  navegador (IndexedDB/localStorage)      metadata + blob del original
        |
        | primera compra (customer_id > 0)
        v
CLIENTE
  orders/{cliente}/customs/idea-*/        idea.json + mockup.webp   (ADOPTADAS)
  tmp/.../cot-*/  --pago-->  orders/{cliente}/{order_id}/{item_key}/  (item + originales)

CUSTOM
  favorito=false --estrella--> favorito=true --estrella--> false
  existe --borrar--> no existe (JSON + snapshot; el original compartido NO se borra)
```

- La adopcion es **idempotente**: si el destino existe, no se copia dos veces (misma regla que
  `promover_order()`).
- Un custom puede existir **sin** pedido (es un favorito); el pedido solo referencia el diseno
  elegido (D1: un diseno por pedido).

## Rutas

| Ruta | Dueno | Regla |
|---|---|---|
| `tmp/sesion-{sid}/customs/` | `PMU_Uploads::dir_sesion_customs()` | ideas del invitado; **sin** `manifest.json` |
| `tmp/sesion-{sid}/cot-{uuid}/` | `PMU_Uploads::dir_sesion_item()` (existente) | item del cotizador con `manifest.contexto` |
| `orders/{cliente}/customs/` | `PMU_Uploads::dir_order_customs()` | ideas del cliente; **sin** `manifest.json` |
| `orders/{cliente}/uploads/{id}.webp` | existente (035) | originales comprados |
| `orders/{cliente}/{order_id}/{item_key}/` | existente (035) | item promovido (manifest + `img/`) |

## Invariantes

1. **Un diseno por pedido** (D1): el pedido referencia **un** `diseno`; los customs son tarjetas,
   no lineas del carrito.
2. **`customs/` nunca tiene `manifest.json`**: es lo que lo mantiene fuera de los escaneos de
   pedidos y de items de sesion.
3. **Un favorito no se borra por TTL de borradores**: `limpiar_ttl()` solo mira `tmp/`.
4. **Ninguna ruta se arma con texto del cliente**: `idea_id`, `id` y `item_key` se validan por
   regex y el archivo se verifica con `is_file()` (§III).
5. **Escritura atomica** de `idea.json` (`.tmp` + `rename`), como el resto de los catalogos.
6. **El arte no viaja compuesto**: la composicion la produce el servidor con el original + receta.
7. **El contexto no habilita capacidades**: `cotizador` solo decide ciclo de vida y entrega.

## Fuera del modelo (no entra)

- **Vista de plancha A4 y PDF de produccion**: fase posterior.
- **Varios disenos por pedido**: descartado por D1.
- **Aprobacion explicita del mockup** (boton "visto bueno"): el mockup informa; el visto bueno es
  el add-to-cart (constitution §I).
- **Firma del mockup / invalidacion del visto**: no existe en el cotizador (`preview_estado:
  'omisible'`).