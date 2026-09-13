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
| `maxW` | number | 2000 | Maximum width (px) |
| `maxH` | number | 2000 | Maximum height (px) |
| `aspectRatio` | number? | null | Fixed ratio (w/h) |
| `mode` | 'crop' \| 'fit' | 'crop' | Default behavior |
| `category` | string | '' | Image category filter |

### Methods

#### `open()`

Opens the selector dialog with upload/crop UI.

#### `onSelect(callback)`

Sets callback: `callback(imageUrl, metadata)`

#### `onError(callback)`

Sets callback: `callback(message)`

#### `destroy()`

Cleans up event listeners and resources.

### Upload Specs

| Parameter | Description |
|-----------|-------------|
| `image/bmp` | Original (client-side) |
| `image/webp` | Processed (server) |
| Max size | 10MB |
| Accepted types | PNG, JPG, GIF, WebP |

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
| `SIZE_EXCEEDED` | "La imagen excede el tamaño máximo" |
| `INVALID_TYPE` | "Formato no permitido" |
| `CROP_ABORTED` | "Cancelado por el usuario" |
| `UPLOAD_FAILED` | "Error al subir la imagen" |

## Usage Example

```javascript
const selector = new SelectorPMU('#campo33', {
  maxW: 500,
  maxH: 500,
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

- **Pending order**: Images saved to `uploads/pmu/tmp/{order_id}/`
- **Order complete**: Move to `uploads/pmu/orders/{order_id}/`
- **Order cancelled**: Delete from tmp
