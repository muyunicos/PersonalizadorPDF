# Selector-PMU Component Contract

**Date**: 2026-09-13 | **Component**: Image selector/crop utility

## Overview

`selector-pmu` es un componente frontend que gestiona la subida, recorte y guardado de imágenes para campos de personalización.

## Interface

### Constructor

```javascript
new SelectorPMU(element, config)
```

**Config**:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `finalW` | number | — | Ancho final en px (definido por el campo/PDF) |
| `finalH` | number | — | Alto final en px (definido por el campo/PDF) |
| `aspectRatio` | number? | null | Fixed ratio (w/h) |
| `mode` | 'crop' \| 'fit' | 'crop' | Default behavior |
| `category` | string | '' | Image category filter |

> El **tamaño final en px lo define el campo/PDF**: no hay límite de peso. El cliente carga
> la imagen para editarla y al aceptar el ajuste al marco se guarda en el servidor la
> versión recortada al tamaño indicado (`finalW`x`finalH`).

### Methods

#### `open()`

Opens the selector dialog with upload/crop UI (canvas = `finalW` x `finalH`; arrastre para encuadrar y zoom; modo `crop`/`fit`).

#### `onSelect(callback)`

Sets callback: `callback(imageUrl, metadata)` — `imageUrl` es un objectURL del PNG recortado y `metadata` incluye `{width, height, fileSize, type, mode, original}`.

#### `onError(callback)`

Sets callback: `callback(message, error)` con `error = {code, message}`.

#### `on(evento, callback)`

Eventos `progress` (`{percentage}`), `success` (`{url, width, height, fileSize}`) y `error` (`{code, message}`).

#### `obtenerBlob()`

Devuelve el ultimo PNG recortado (el llamador lo sube al pool del item).

#### `close()`

Cierra el dialogo sin destruir el componente (permite reabrirlo).

#### `destroy()`

Cleans up event listeners and resources.

### Upload Specs

| Parameter | Description |
|-----------|-------------|
| Accepted types | PNG, JPG, GIF, WebP (BMP solo como original client-side, se normaliza en el navegador) |
| Peso | sin limite (el cliente recorta/ajusta y solo se guarda la version final al tamaño indicado) |
| Tamaño final | `finalW`x`finalH` definido por el campo/PDF |
| Recorte/ajuste | en el navegador (Canvas) antes de subir |
| Destino | pool del item: `tmp/sesion-{sid}/{item_key}/img/{pdf}-{id}-{n}.png` |
| Formato guardado | PNG (soporta transparencia; el Motor lo inyecta tal cual) |
| webp | solo para los mockups congelados 300x300 (`mockup-{id}.webp`), no para el pool |

### Crop Options

| Option | Description |
|--------|-------------|
| `mode: 'crop'` | User selects region |
| `mode: 'fit'` | Auto-center, scale-to-fit |
| `aspectRatio` | Lock ratio (e.g., 1 for square) |

### Events

| Event | Data |
|-------|------|
| `progress` | `{percentage: 0-100}` |
| `success` | `{url, width, height, fileSize}` |
| `error` | `{code, message}` |

### Error Codes

| Code | Message |
|------|---------|
| `INVALID_TYPE` | "Formato no permitido" |
| `CROP_ABORTED` | "Cancelado por el usuario" |
| `UPLOAD_FAILED` | "Error al subir la imagen" |

> No hay `SIZE_EXCEEDED`: el tamaño final lo define `finalW`x`finalH` y el cliente
> entrega el recorte ya ajustado (sin límite de peso del origen).

## Usage Example

```javascript
const selector = new SelectorPMU('#campo33', {
  finalW: 500,
  finalH: 500,
  aspectRatio: 1,
  mode: 'crop'
});

selector.onSelect((url, meta) => {
  console.log('Selected:', url, meta);
});

selector.onError((msg) => {
  alert(msg);
});
```

### Upload Workflow

- **Pre-carrito (draft)**: las imagenes se guardan en el pool del borrador
  `tmp/sesion-{sid}/draft-{uuid}/img/...` y quedan anotadas en `manifest.archivos[]`.
- **add-to-cart**: el borrador se renombra a `tmp/sesion-{sid}/{cart_item_key}/` (mismo sid,
  mismos archivos; no se vuelve a subir nada).
- **Pedido confirmado**: la carpeta se promueve a `uploads/pmu/orders/{order_id}/{item_key}/`.
- **Item quitado del carrito**: borrado quirurgico de su carpeta.
- **Sin preview (`preview_omisible=true`)**: la imagen se guarda en el borrador al agregar;
  si no hay navegador compatible, el item queda `sin_vista` y el admin lo regenera.
