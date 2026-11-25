# Specs OpenSpec — Personalizador PDF

`openspec/specs/` es la **verdad actual** del sistema ya implementado. Cada capacidad
tiene su `spec.md` con Purpose + Requirements + Scenarios.

## Capacidades (baseline)

| Capacidad | Alcance |
|---|---|
| `pdf-motor` | Deteccion/agrupacion de huecos, dataset `analisis.json`/`config.json`, overlay z-order + `/ECOp1`, encajado contain, Compositor, Motor. |
| `mockups-editor` | Editor visual admin: capas, grupos, envolturas, perspectiva, importar pagina, aplanado fondo/frente. |
| `campos-consola` | Campos reutilizables v3, consola, CSS/JS global, preview, ranura adaptativa, tipo/overrides. |
| `cargador-imagenes` | Selector/cargador/visor, recorte, receta v2, modos de encaje, transparencia, carga multiple. |
| `biblioteca-imagenes` | Biblioteca del comprador, catalogo `uploads.json`, miniaturas, lectura liviana `media.php`, TTL/retencion. |
| `ficha-comprador` | Ficha Woo, panel, galeria auto-montada, ciclo carrito->pedido, invitado, validez, descargas. |
| `texto-textmuy` | Integracion TextMuy, RenderCore, presets `.txm`, galerias sprite, cache-bust `RCn`. |
| `cotizador` | Cotizador de stickers: diseno del cliente, mockup 300x300, favoritos, customs. |

## Trabajo en curso (changes activos)

- `add-api-wordpress` — API sincrona para compras (spec 010 legacy). Sin marcar.
- `deuda-testing-conductual` — migracion de asserts por regex a conducta (spec 048 legacy). Sin marcar.

## Referencia historica

El archivo legacy `specs/` (Spec Kit, 43 carpetas) queda **congelado** como historia y
fuente de matiz. Su indice y estado por spec viven en [`specs/INDICE.md`](../../specs/INDICE.md).
No se migro 1:1: este baseline destila el estado vigente y `specs/` se conserva como
referencia.