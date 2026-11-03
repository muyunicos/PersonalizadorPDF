# Contrato — Customs (ideas y favoritos del comprador)

> Normativo. Dueno de la escritura: `PMU_Sesion` (delegado por `PMU_Cotizador`). Rutas:
> `PMU_Uploads` (`dir_sesion_customs()`, `dir_order_customs()`).
> Contexto: [data-model.md](../data-model.md) y [research.md](../research.md) R3/R4/R11/R12.

## C1 — Rutas y forma

| Ruta | Contenido | `manifest.json` |
|---|---|---|
| `tmp/sesion-{sid}/customs/{idea_id}/idea.json` | metadatos del invitado | **NO** |
| `tmp/sesion-{sid}/customs/{idea_id}/mockup.webp` | snapshot 300x300 | **NO** |
| `orders/{cliente}/customs/{idea_id}/idea.json` | metadatos del cliente | **NO** |
| `orders/{cliente}/customs/{idea_id}/mockup.webp` | snapshot 300x300 | **NO** |
| `orders/{cliente}/customs/favoritos.json` | favoritos de items de la tienda/historial | **NO** |

- **Nunca** `manifest.json` en `customs/`: los escaneos de pedidos
  (`pedidos_completados()`) y de la biblioteca (`biblioteca_contenedores()`) ya exigen nivel
  numerico y leen `manifest.json`; sin ese archivo, `customs/` es invisible para ellos.
- `{idea_id}` = `^idea-\d{10}-[a-z0-9]{4}$`. El nombre lo propone el servidor (nunca uno crudo del
  cliente).
- `{cliente}` y `{order_id}` son numericos (`ctype_digit`), como en la 035.

## C2 — `idea.json`

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

| Campo | Obligatorio | Regla | Si falta/rompe |
|---|---|---|---|
| `version` | si | `1` | se descarta la idea |
| `id` | si | regex + igual al de la carpeta | se descarta |
| `creado` | si | epoch | `0` |
| `favorito` | si | bool | `false` |
| `orden` | no | `0..999` | `0` |
| `titulo` | no | `<= 80`, sin HTML | se usa uno derivado de `order` |
| `descripcion` | no | `<= 240`, sin HTML | se genera del pedido |
| `order` | si | codec del cotizador | se descarta la idea |
| `precio` | no | numeros `>= 0`, `ts` | tarjeta sin precio (no rompe) |
| `diseno.id` | si | `^[a-f0-9]{12}$` | se descarta la idea |
| `diseno.itemKey` | si | `^cot-[a-z0-9]{8}$` | se descarta |
| `diseno.sid` | si | `^[a-z0-9-]{6,64}$` | se descarta |
| `diseno.w/h` | si | int `1..3000` | se descarta |
| `diseno.receta` | si | `^[a-f0-9]{12}$` | se descarta |
| `mockup.id` | si | `^[a-f0-9]{12}$` + archivo existente | idea **visible sin mockup** + causa `cotizador:mockup:ausente` |
| `mockup.mockupId` | no | string `<= 40` | vacio |

- El JSON se escribe **atomico** (`.tmp` + `rename`) y se lee **tolerante**: una idea invalida se
  saltea con aviso, no rompe el listado.
- `favoritos.json` = `{version:1, items:[{tipo, ref, creado}]}` con `tipo` en
  `tienda` \| `historial` y `ref` = `id` del item de la tienda o `order_id` del pedido.

## C3 — Listado (`listar_ideas`)

1. Identidad: cookie `pmu_sid` + `uid`.
2. Orden de fuentes:
   - invitado: `tmp/sesion-{sid}/customs/*`;
   - cliente: `orders/{cliente}/customs/*` **+** `tmp/sesion-{sid}/customs/*` (compra a medias).
3. Dedupe por `id` (si esta en los dos lados gana el de `orders/`).
4. Orden final: `favorito` desc, `orden` asc, `creado` desc.
5. Tope de lectura: **60 ideas**; de respuesta: las **30** mas nuevas al cliente + contador.

## C4 — Guardado (`guardar_idea`)

1. Valida `activo()`, nonce e identidad.
2. Valida la idea completa (C2). Si `diseno.itemKey` no resuelve a un manifest de la identidad →
   `cotizador:idea:ajena` (nunca se confia en la ruta que manda el cliente).
3. Sube el snapshot con el mismo camino que un original: dedupe por sha, cap 2000 px, WebP
   (`PMU_Sesion::guardar_subida`); el `id` resultante va a `mockup.id`.
4. Escribe `idea.json` (atomico). Re-guardar la misma `idea_id` **reemplaza**.
5. Si `favorito = true`, no se toca el original compartido ni los otros customs.

## C5 — Borrado (`borrar_idea`)

- Borra `idea.json` **y** `mockup.webp` de esa idea. Devuelve `{borrado:true, archivos:1|2}`.
- **No** borra `diseno`/original si otro custom o un pedido lo referencia (misma regla que
  `podar_subidas` de la 035).
- Borrar una idea ajena → `cotizador:idea:ajena` (no se toca disco).

## C6 — Retencion

| Ubicacion | TTL | Lo limpia |
|---|---|---|
| `tmp/sesion-{sid}/customs/` | el vigente de drafts/carrito (24 h / 30 d) | `limpiar_ttl()` |
| `orders/{cliente}/customs/` | **sin TTL automatico** (FR-032) | el admin (manual o plazo, como `orders/`) |
| `orders/{cliente}/uploads/{id}.webp` | igual que `orders/` | el admin |

- `limpiar_ttl()` **no** debe tocar `orders/`: solo recorre `tmp/`. La adopcion al comprar mueve
  (no copia) cuando el origen y el destino estan en el mismo disco, y es idempotente.

## C7 — Incompatibilidades prohibidas

- **No** crear un ambito `uploads/pmu/customs/` global (seria un catalogo nuevo, 030 D1).
- **No** guardar customs dentro de `datos.json` (mezcla biblioteca de fotos con ideas).
- **No** reusar `subidas[].origen` para marcar el contexto (vocabulario de la 035).
- **No** devolver rutas absolutas al cliente: se devuelve `id` y el endpoint `op=imagen` sirve los
  bytes con `Cache-Control: private`.