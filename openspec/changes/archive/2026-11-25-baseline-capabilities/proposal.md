# Proposal

## Why

El plugin convive hoy con dos sistemas de specs: Spec Kit (`specs/`, 43 carpetas
historicas) y OpenSpec (`openspec/`, vacio). Falta una **verdad actual** unica y
consultable que describa el sistema ya implementado, sin depender de leer 43 specs
legacy y sus enmiendas cruzadas.

## What Changes

- Se destila el sistema **ya implementado** en **8 capability specs** bajo
  `openspec/specs/` (baseline), una por capacidad cohesiva.
- Cada capacidad se introduce como delta `ADDED` en un change `baseline-capabilities`
  y, tras validar, se **archiva** para que OpenSpec genere el formato de spec correcto.
- No cambia ningun codigo de produccion ni el archivo legacy `specs/` (queda como
  historia congelada, referenciada desde un README).
- No se migran 1:1 las 43 carpetas legacy: decision tomada, se conservan solo como
  referencia historica.

## Capabilities

### New Capabilities

- `pdf-motor` — Deteccion/agrupacion de huecos, dataset `analisis.json`/`config.json`,
  overlay z-order + `/ECOp1`, encajado contain, Compositor y Motor.
- `mockups-editor` — Editor visual del admin: capas, grupos, envolturas, perspectiva,
  importar pagina, aplanado fondo/frente.
- `campos-consola` — Campos reutilizables v3, consola, CSS/JS global, preview, ranura
  adaptativa, tipo/overrides.
- `cargador-imagenes` — Selector/cargador/visor, recorte, receta v2, modos de encaje,
  transparencia, carga multiple.
- `biblioteca-imagenes` — Biblioteca del comprador, catalogo `uploads.json`, miniaturas,
  lectura liviana `media.php`, TTL/retencion.
- `ficha-comprador` — Ficha Woo, panel, galeria auto-montada, ciclo carrito->pedido,
  invitado, validez, descargas.
- `texto-textmuy` — Integracion TextMuy, RenderCore, presets `.txm`, galerias sprite,
  cache-bust `RCn`.
- `cotizador` — Cotizador de stickers: diseno del cliente, mockup 300x300, favoritos,
  customs.

### Modified Capabilities

<!-- Ninguna: baseline nuevo, no hay specs OpenSpec previas que modificar. -->

## Impact

- Solo documentacion bajo `openspec/` (specs y changes).
- `specs/` legacy intacto; `AGENTS.md` y `constitution` sin cambios.
- Cero cambios en `engine/`, `inc/`, `assets/`, `admin/`, `modules/`, `tests/`, `uploads/`.