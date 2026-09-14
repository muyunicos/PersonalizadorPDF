# Quickstart: Galería Engine (PMU Uploads)

**Fecha**: 2026-09-13 | **Feature**: 003-galeria-engine

## Prerequisites

- WordPress + plugin Personalizador PDF activo
- PHP 8.0+ con GD extension
- Carpeta `uploads/pmu/` con permisos de escritura

## Validation Scenarios

### Scenario 1: CRUD básico de imágenes

1. **Setup**: Verificar que `uploads/pmu/img/` existe
2. **Alta**: POST `action=pmu_uploads&op=alta&ambito=img` con archivo imagen
3. **Listar**: GET `action=pmu_uploads&op=listar&ambito=img`
4. **Baja**: POST `action=pmu_uploads&op=baja&ambito=img&nombre=<id>`
5. **Expected**: Catálogo actualizado sin archivo físico

### Scenario 2: Sprite generation

1. **Setup**: Subir 3-5 imágenes a `img/`
2. **Sprite**: POST `action=pmu_uploads&op=sprite&scope=img` con thumbnails
3. **Expected**: `uploads/pmu/img/thumbs.webp` creado

### Scenario 3: Handler unificado

1. **Setup**: Eliminar handlers viejos de `personalizador-pdf.php`
2. **Register**: Agregar `add_action('admin_post_pmu_uploads', ...)`
3. **Test**: Cualquier operación de galería vía único endpoint
4. **Expected**: Sin errores 404 en admin

## Commands

```bash
# Tests PHP
php -l engine/PMU_Uploads.php
php tests/motor_smoke.php
```

## Success Criteria

| Criterio | Verificación |
|---|---|
| CRUD funciona | Alta/baja/editar/listar retornan expected |
| Solo endpoint | `pmu_uploads` responde, viejos 404 |
| Catálogo válido | JSON parseable, estructura {thumbs, items} |
| Físicos correctos | Archivos en ruta correcta, sin duplicados |
