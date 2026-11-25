# Proposal

## Why

La spec legacy `specs/032-reemplazo-pdf` describe una funcion **ya implementada** (reemplazar
el PDF de un producto conservando su personalizacion) que no quedo representada en el
baseline OpenSpec. Sin este delta, `openspec/specs/pdf-motor` no refleja la verdad actual del
sistema.

## What Changes

- Se agrega a `pdf-motor` el comportamiento de **reemplazo de PDF** (swap por archivo, staging
  con analisis previo, mapa viejo->nuevo en modal, respaldo y recuperacion, remapeo de
  `placeholders`/`envolturas`/`mockups[].capas[].ref`).
- Se agrega el **mismo remapeo** para Re-analizar (misma funcion compartida).
- No cambia codigo: es documentacion de comportamiento ya existente.

## Capabilities

### New Capabilities

<!-- Ninguna: se amplГ­a una capacidad existente. -->

### Modified Capabilities

- `pdf-motor` — se agregan requisitos (ADDED) de reemplazo de PDF y remapeo compartido.

## Impact

- Solo `openspec/` (delta + spec fusionada al archivar).
- Cero cambios en codigo, `specs/` legacy ni datos de `uploads/`.