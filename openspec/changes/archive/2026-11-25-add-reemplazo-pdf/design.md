# Design — add-reemplazo-pdf

## Context

La spec legacy `specs/032-reemplazo-pdf` (header desactualizado "sin implementar") describe
el reemplazo del PDF de un producto conservando la personalizacion. El codigo ya lo
implementa: `handle_reemplazo` en `personalizador-pdf.php`, helpers `dir_reemplazos`/
`dir_reemplazo` en `PMU_Uploads`, `Metadata::remapearConfig`, y la fase `reemplazo` del arnes.
Faltaba documentarlo en el baseline.

## Goals / Non-Goals

### Goals

- Que `openspec/specs/pdf-motor` refleje el reemplazo de PDF ya implementado.
- Documentar el remapeo compartido reemplazo/re-analisis y el respaldo/recuperacion.

### Non-Goals

- No tocar codigo (solo documentacion).
- No cambiar el comportamiento: se documenta lo existente.

## Decisions

- **Fusionar al baseline (archive)**: como la funcion esta implementada, el delta se archiva y
  pasa a `openspec/specs/pdf-motor` (verdad actual), no queda como change futuro.
- **ADDED, no MODIFIED**: agrega comportamiento nuevo sin alterar los requisitos existentes de
  `pdf-motor` (regla OpenSpec: nuevas concerns sin cambio de comportamiento previo -> ADDED).
- **D1-D10 de la 032 se conservan**: swap por archivo, staging, dos pasos, mapa 1:1 con umbrales
  (IoU + Delta-E), funcion unica de remapeo, respaldo unico en `tmp/reemplazos/`, `ref` sin
  destino se conserva y reporta, pedidos pagados sin aviso.

## Risks / Trade-offs

- **Perdida de matiz** -> `specs/032-reemplazo-pdf` queda como referencia; el delta conserva
  los requisitos y edge cases clave.
- **Header legacy desactualizado** -> no se edita `specs/` (congelado); el baseline manda.

## Migration Plan

1. Crear change con delta ADDED a `pdf-motor`.
2. Validar `--strict`.
3. Archivar (fusiona a `openspec/specs/pdf-motor`).
4. Verificar que `pdf-motor` incluye los requisitos de reemplazo.

## Open Questions

- Ninguna.