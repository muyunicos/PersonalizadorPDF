# Specification: Galería Engine (PMU Uploads)

**Fecha**: 2026-09-13 | **Feature**: 003-galeria-engine | **Branch**: 002-galeria-engine

## Overview

El motor **Galería Engine** (también llamado PMU Uploads) es la clase única responsable de CRUD sobre `uploads/pmu/`. Centraliza el manejo de todos los ámbitos (fonts, img, pdfs, orders, tmp, tm-presets) eliminando handlers dispersos.

## Clarifications

### Session 2026-09-13

- Q: Ubicación de presets → A: `tm-presets/` (no `tm/presets/`)
- Q: Migración de datos existentes → A: Manual (script externo)
- Q: Handlers viejos → A: Eliminar inmediatamente (sin deprecated)

## Functional Requirements

### FR-1: CRUD Operaciones

| Operación | Descripción |
|---|---|
| `leer_ambito($ambito)` | Devolver items activos del ámbito |
| `alta_ambito($ambito, $datos)` | Crear nuevo item con ID auto-generado |
| `baja_ambito($ambito, $id)` | Marcar como tombstone `[id, "", ""]` |
| `editar_ambito($ambito, $id, $datos)` | Actualizar item existente |

### FR-2: Gestión de Físicos

| Operación | Descripción |
|---|---|
| `validar_firma_imagen($file)` | Validar PNG/JPG/WebP/GIF |
| `validar_firma_fuente($file)` | Validar TTF/OTF |
| `guardar_fisico($ambito, $nombre, $file)` | Mover archivo a ubicación final |
| `borrar_fisico($ambito, $nombre)` | Eliminar archivo físico |
| `generar_miniatura($ambito, $nombre, $file)` | Crear .webp con GD |

### FR-3: Sprite Generation

| Operación | Descripción |
|---|---|
| `regenerar_sprite($ambito)` | Compilar thumbs.webp de todos los items activos |
| `obtener_url_sprite($ambito)` | Devolver ruta pública del sprite |
| `obtener_url_miniatura($ambito, $nombre)` | Devolver URL de thumbnail individual |

### FR-4: Integración WordPress

| Operación | Descripción |
|---|---|
| `obtener_url($ambito, $nombre)` | Resolver URL web |
| Handlers WP | admin_post con nonce (único endpoint: `pmu_uploads`) |

## Data Model

### Ámbitos Soportados

| Ámbito | Descripción | Carpeta |
|---|---|---|
| `fonts` | Tipografías (Google + locales) | `uploads/pmu/fonts/` |
| `img` | Recursos reusables | `uploads/pmu/img/` |
| `pdfs` | Productos PDF | `uploads/pmu/pdfs/` |
| `orders` | Resultados pedidos WooCommerce | `uploads/pmu/orders/` |
| `tmp` | Temporales | `uploads/pmu/tmp/` |
| `tm-presets` | Presets TextMuy | `uploads/pmu/tm-presets/` |

### Catálogo v5.0

```json
{
  "thumbs": {"w": 100, "h": 100, "c": 8},
  "items": [
    [1, "Foto fondo", "fondos", "foto001.webp"],
    [2, "Icono check", "iconos", "check.webp"]
  ]
}
```

- `id`: numérico entero ≥1 (auto-generado)
- `title`: string
- `cats`: string (una categoría) o array (múltiples)
- `file`: string (nombre físico sin ruta)

### Tombstone

```json
[id, "", ""]
```

Mantiene el ID reservado sin eliminarlo del catálogo.

## Technical Constraints

- **PHP puro**: Sin dependencias nativas
- **GD**: Para generar miniaturas .webp
- **ID auto-generado**: Usa `tupla_alta` (hueco más bajo o max+1)
- **Migración**: Manual (sin scripts automáticos)

## Open Questions

- [ ] Soporte para listar múltiples ámbitos en una operación?
- [ ] Caché de catálogo en memoria para reducir lecturas de disco?

## Implementation Notes

### Handlers a Eliminar (sin deprecated)

```php
// REMOVER COMPLETAMENTE
add_action('admin_post_personalizador_pdf_textmuy_subir_imagen', ...);
add_action('admin_post_personalizador_pdf_textmuy_guardar_preset', ...);
add_action('admin_post_personalizador_pdf_guardar_sprite', ...);
add_action('admin_post_personalizador_pdf_guardar_miniatura', ...);
```

### Nuevo Handler Único

```php
add_action('admin_post_pmu_uploads', [$this, 'handle_pmu_uploads']);
```