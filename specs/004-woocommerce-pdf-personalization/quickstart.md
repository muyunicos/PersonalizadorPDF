# Quickstart & Validation Guide

**Date**: 2026-09-13 | **Feature**: WooCommerce PDF Personalization

## Prerequisites

- WordPress 6.x with WooCommerce 8.x
- PHP 8.5.4
- Access to `/wp-admin`
- Test PDF with placeholders (e.g., `muestra.pdf`)

## Setup Commands

### 1. Plugin Installation

```bash
# From WordPress root
wp plugin install ./personalizador-pdf --activate
```

### 2. Import TextMuy Module

```bash
# From plugin root
cp -r ../textmuy modules/textmuy/
```

### 3. Upload Test PDF

1. Navigate to `/wp-admin/admin.php?page=personalizador-pdf`
2. Go to "PDFs" tab
3. Upload `muestra.pdf`
4. Verify placeholder detection (should show 2 groups)

## Validation Scenarios

### Scenario 1: Admin Configuration

**Objective**: Verify PDF upload and field mapping

**Steps**:
1. Upload PDF → Verify metadata.json created
2. Assign field "Condimentos" to group 2
3. Assign field "Logo" to group 1
4. Link to WooCommerce product "Etiquetas condimentos"

**Expected**:
- `datos/muestra/metadata.json` exists
- Group assignments saved in admin UI
- Product page shows personalization panel

### Scenario 2: Client Personalization

**Objective**: Verify end-user flow

**Steps**:
1. As client, visit product page
2. Enter text: "Sal, pimienta, orégano"
3. Click "Personalizar Logo" (optional)
4. Click "Generar vista previa"
5. Review preview on mockup

**Expected**:
- Text renders with assigned preset
- Preview shows without page reload
- Image placeholder centers without distortion

### Scenario 3: PDF Generation

**Objective**: Verify final output

**Steps**:
1. Complete checkout (test mode)
2. Navigate to order confirmation
3. Download personalized PDF

**Expected**:
- PDF downloads successfully (<5s)
- Text overlay correct (no font substitution)
- Image properly inserted (contain, no distortion)
- File path: `uploads/pmu/outputs/ORDER_ID.pdf`

### Scenario 4: Error Handling

**Objective**: Verify graceful degradation

**Steps**:
1. Upload oversized image (>10MB)
2. Submit invalid script in campo
3. Process without preview

**Expected**:
- Clear error messages to client/admin
- Order status: "failed"
- Error logged to WordPress debug log

## Test Matrix

| Scenario | Backend | Frontend | Full Stack |
|----------|---------|----------|------------|
| PDF upload | ✅ | ⏪ | ✅ |
| Field mapping | ✅ | ✅ | ✅ |
| Preview gen | ✅ | ✅ | ✅ |
| PDF output | ✅ | ⏪ | ✅ |
| Error cases | ✅ | ✅ | ✅ |

*✅ = Automated tests exist | ⏪ = Manual testing required*

## Next Steps

1. Run `/speckit-tasks` to generate implementation tasks
2. Begin Phase 2: Backend implementation
3. Schedule peer review for contracts