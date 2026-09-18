# Specification Quality Checklist: WooCommerce PDF Personalization

**Purpose**: Validar que la especificacion (spec.md) cumple el estandar de calidad antes de
planificar.
**Created**: 2026-09-13 | **Revisado**: 2026-09-17 (reescritura completa a norma vigente)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details innecesarios (desvio deliberado: nombres de artefactos del
      producto — ver nota 1)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (con nota 1)
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification (ver nota 1)

## Notas de la revision 2026-09-17

- El spec pasa a tener **dos bloques**: el normativo (arriba, normas 2026-09-17) y el
  historico (abajo, diseño 2026-09-13 derogado, conservado como trazabilidad).
- Requisitos funcionales normativos: 8 grupos (FR-1..FR-8) con 33 sub-requisitos
  (FR-1:4, FR-2:4, FR-3:4, FR-4:4, FR-5:3, FR-6:5, FR-7:4, FR-8:5).
- Criterios de exito: 7 (SC-1..SC-7), medibles.
- Escenarios: 5 (admin configura, cliente con mockup, omisible, fallo tolerado, admin
  revisa "completados").
- Casos borde: 7 (incluye N≠M de arrays, fallo de render y re-edicion de item).
- Decisiones nuevas integradas: mockups por capas (canvas 300x300), editor embebido
  reutilizando TextMuy, sesion unica que se mueve (`sid` cookie 30 dias, pool dedicado),
  flujo "Vista previa" (paralelo, regeneracion parcial, sin boton aprobar),
  `preview_estado` (fallo no bloquea la venta), descargas por lista nativa Woo y cantidad
  fija 1 con `unique_key`.
- Nota 1 (desvio aceptado, intencional): el spec nombra artefactos y rutas concretas
  (`analisis.json`, `config.json`, `tmp/sesion-{sid}/{item_key}/`, `mockup-*.webp`,
  `_pmu_pdf_slug`, `selector-pmu`, TextMuy). Es deliberado: en este proyecto esos formatos y
  rutas son el contrato del producto (precedente: spec 007 checklist y AGENTS.md §5). Los
  criterios de exito quedan libres de tecnologia.