# Feature Specification: fix-problematic-file-reporting

**Feature Branch**: `main-fix-problematic-file-reporting`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "problemas actuales (hay multiples archivos que vs reporta como problematicos)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reducir reportes falsos de archivos problematicos (Priority: P1)

El administrador ve el panel de control y necesita identificar archivos con problemas reales. Actualmente, el sistema reporta múltiples archivos como problematicos incluso cuando no tienen errores críticos, lo que genera confusión y hace perder tiempo revisando archivos sanos.

**Why this priority**: Esto impacta directamente la experiencia del usuario y la confianza en el sistema. La reducción de falsos positivos es el objetivo principal.

**Independent Test**: El administrador puede ver el listado de archivos problematicos y verificar que cada archivo reportado tiene un problema real y verificable.

**Acceptance Scenarios**:

1. **Given** hay archivos con problemas reales y archivos sanos en el sistema, **When** se genera el reporte de archivos problematicos, **Then** solo los archivos con problemas reales aparecen en el listado
2. **Given** un archivo sin problemas detectados, **When** se revisa su estado individual, **Then** aparece marcado como "correcto" o "sin problemas"

---

### User Story 2 - Clarificar la razon de cada reporte (Priority: P2)

Cuando un archivo se marca como problematico, el administrador necesita entender por qué. El sistema debe mostrar información clara sobre el tipo de problema encontrado.

**Why this priority**: Sin claridad en los reportes, el administrador no puede tomar decisiones informadas sobre qué archivos corregir.

**Independent Test**: Cada archivo problematico en el listado muestra una descripción legible del problema detectado.

**Acceptance Scenarios**:

1. **Given** un archivo con errores detectados, **When** se ve en el listado de problematicos, **Then** se muestra una descripción del tipo de error (ej: "estructura dañada", "metadatos corruptos", "formato inválido")
2. **Given** un archivo con múltiples problemas, **When** se inspecciona, **Then** cada problema se lista por separado con su descripción

---

### User Story 3 - Priorizar problemas por severidad (Priority: P3)

No todos los problemas son igual de graves. El sistema debe clasificarlos para que el administrador sepa cuáles corregir primero.

**Why this priority**: Ayuda a la toma de decisiones pero no es crítico si los reportes ya son precisos.

**Independent Test**: Los archivos problematicos muestran una etiqueta de severidad (crítico, importante, advertencia).

**Acceptance Scenarios**:

1. **Given** un archivo con errores críticos, **When** se ve en el listado, **Then** tiene una etiqueta de severidad "crítico"
2. **Given** un archivo con problemas menores, **When** se ve en el listado, **Then** tiene una etiqueta de severidad "advertencia"

---

### Edge Cases

- ¿Qué pasa cuando un archivo tiene problemas ambiguos o difíciles de clasificar?
- ¿Cómo se maneja el caso donde un archivo es correcto en sí mismo pero incompleto respecto a expectativas del sistema?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE verificar cada archivo antes de marcarlo como problematico
- **FR-002**: El sistema DEBE registrar la razón específica cuando marca un archivo como problematico
- **FR-003**: El sistema DEBE mostrar solo archivos con problemas reales en el listado de problematicos
- **FR-004**: El sistema DEBE permitir al administrador ver detalles del problema por archivo
- **FR-005**: El sistema DEBE clasificar problemas por severidad

### Key Entities

- **Archivo**: Unidad de almacenamiento que puede estar sano o problematico
- **Reporte de problema**: Registro que documenta por qué un archivo se marca como problematico

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Reducción del 80% en archivos reportados como problematicos que no tienen errores reales
- **SC-002**: 100% de los archivos reportados como problematicos deben tener un problema verificable
- **SC-003**: Tiempo promedio de revisión por archivo reduce de 5 minutos a 2 minutos
- **SC-004**: La satisfacción del usuario con la claridad de los reportes mejora al 90%

## Assumptions

- Los archivos problematicos existentes son correctos y no requieren acción adicional
- El sistema de verificación puede detectar problemas de manera objetiva
- La clasificación de severidad puede determinarse por tipo de problema

## Clarifications

### Session 2026-09-14

- Q: ¿Qué tipo de archivos se están reportando como problemáticos? → A: personalizador-pdf.php (9 problemas) y varios PDFs del proyecto
- Q: ¿Qué tipo de problemas muestra VS Code en rojo? → A: Avisos de herramientas/linguists (PHPStan, PSR) o problemas de análisis estático