# Data Model

**Date**: 2026-09-13 | **Feature**: WooCommerce PDF Personalization

## Entities

### PDF

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| id | int (auto) | Unique identifier | Primary key |
| filename | string | Original filename | Required, max 255 chars |
| filepath | string | Absolute path in uploads/pmu/pdfs/ | Required |
| status | enum | active/inactive | Default: inactive |
| product_ids | int[] | WooCommerce product IDs | Optional, max 100 |
| mockups | object | Mockup config (mckp.json) | Optional |
| placeholders | array | Detected placeholder metadata | Auto-generated |

**Relationships**:
- ↔ Many WooCommerce Products (many-to-many)
- ↔ Many Placeholder Groups (one-to-many)

**State transitions**:
```
inactive → active (after placeholder detection)
active → inactive (manual deactivation)
```

### Campo

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| id | int (auto) | Unique identifier | Primary key |
| title | string | Admin-facing name | Required |
| type | enum | text/img/color/font | Required |
| content | string | HTML for client UI | Required |
| script | string | Transformation function | Optional |
| titulo_cliente | string | Client-facing label | Optional |
| valor_cliente | string | Normalizer function | Optional |
| help_text | string | Tooltip text | Optional |
| tags | string[] | Categorization | Optional |

**Relationships**:
- ↔ Many Placeholders (used in mapping)

### Placeholder

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| id | string | Within-PDF ID | Unique per PDF |
| pdf_id | int | Parent PDF | Required, FK |
| group_key | string | Color-based group | Required |
| rect | object | {x, y, w, h} in pts | Required |
| field_ids | int[] | Mapped fields | Required |
| transform_script | string | Value transformation | Optional |
| preset_id | string | TextMuy preset | Optional |
| overrides | object | Field overrides | Optional |

**Relationships**:
- ↩ One PDF
- ↔ Many Campos (via field_ids)

### Sesión (Order Session)

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| order_id | int | WooCommerce order | Required, FK |
| pdf_id | int | Selected PDF | Required, FK |
| field_data | object | Field values per product | Required |
| images | object[] | Uploaded images (webp) | Optional |
| preview_url | string | Generated preview | Optional |
| output_url | string | Final PDF URL | Optional |
| status | enum | pending/completed/failed | Required |

**Validation Rules**
- File uploads: max 10MB, allowed types (png, jpg, webp, gif)
- Text fields: max 2000 chars (configurable per campo)
- Image aspect ratio: enforced when configured

## Contracts

### API: `handle_procesar` (admin_post)

**Request**:
```json
POST /wp-admin/admin-ajax.php?action=personalizador_pdf_procesar
{
  "pdf_id": 42,
  "order_id": 1523,
  "field_data": {
    "56": "Sal, pimienta, orégano",
    "33": null  // Optional image
  },
  "images": {
    "33": "uploads/pmu/tmp/1523/campo33.webp  # temporary → orders/ after completion"
  }
}
```

**Response**:
```json
{
  "success": true,
  "output_url": "https://site.com/uploads/pmu/outputs/1523.pdf",
  "preview_url": "https://site.com/uploads/pmu/previews/1523.webp"
}
```

### API: `selector-pmu` (client-side component)

**Event**: `selector-pmu(id, maxW, maxH, aspectRatio, mode, category)`

**Callbacks**:
- `onSelect(imageUrl, metadata)`
- `onError(message)`

### Event Hooks (WordPress)

| Hook | Type | Parameters |
|------|------|------------|
| `personalizador_pdf_before_generate` | action | `$order_id, $pdf_id, $field_data` |
| `personalizador_pdf_after_generate` | action | `$order_id, $pdf_id, $output_url` |
| `personalizador_pdf_error` | action | `$order_id, $pdf_id, $error` |

## Quickstart Guide

See `quickstart.md` for validation scenarios.