# 0. Research - Galería Engine
**Fecha**: 2026-09-13 | **Feature**: 003-galeria-engine

## Decisiones

### Ruta única de datos
**Decisión**:  es la ubicación única y definitiva para todos los datos del plugin.
**Rationale**: Evitar duplicidad con TextMuy legacy (uploads/tm/). Centralizar todos los ámbitos (fonts, img, pdfs, orders, etc.) en una sola carpeta.
**Alternativos considerados**: Mantener uploads/tm/ separado → rechaza por duplicidad y confusión en rutas.

### Estructura de catálogo
**Decisión**: Tupla canónica  con id numérico entero ≥1.
**Rationale**: Compatible con parser actual de TextMuy.  como string (no array) permite edición manual.
**Alternativos considerados**:  array → más verboso, obliga a reescribir parser/tests, rechazado.

### Tombstone para bajas
**Decisión**: Eliminar físicas no borra la entrada; marca como  en el JSON.
**Rationale**: Reserva atómica de ID. Evita deriva entre lista de items y lista de slots libres.
**Alternativos considerados**:  separado → dos estructuras sincronizadas a mano, riesgo de desfase.

### Sprite único por ámbito
**Decisión**: Un  por ámbito (ej. ).
**Rationale**: 1 petición por ámbito. Posición del tile derivada (no guardada).
**Alternativos considerados**:  + tiles sueltos → más archivos, más peticiones, descartado.

### Implementación en engine/
**Decisión**: Clase  en  es la única responsabilidad de CRUD sobre uploads/pmu.
**Rationale**: Centralización. Todos los módulos y el plugin usan un mismo contrato. Testing aislado.
**Alternativos considerados**: Helpers dispersos en varios archivos → duplicación, inconsistencia, rechazo.

## Open questions

- ¿El ámbito  debe renombrarse a  para consistencia? (actualmente en uploads/pmu/tm-presets/)
- ¿Se necesita soporte para múltiples ámbitos en una sola operación? (ej. listar fonts + img juntos)

