# Tasks: 023 — `escala: 'sin-ampliar'`

- [X] **T001** Normalizacion: `normalizarRanuras()` (cargador) y `PURO.normalizarRanura()`
  (tienda) aceptan `escala: 'ampliar'|'sin-ampliar'` (default `'ampliar'`).
- [X] **T002** `assets/selector-pmu.js`: funcion pura `escalaBase(modo, iw, ih, W, H, sinAmpliar)`
  (cap a 1) exportada en `SelectorPMU.puro`; `_cajaImagenModo()` la usa.
- [X] **T003** UI del modal con `sin-ampliar`: modos y Girar ocultos, slider capado a 1x, badge
  `sin ampliar`.
- [X] **T004** Puertas: `escalaBase` (300x300 en 1000x500 -> 300x300; foto grande reduce igual) +
  normalizacion + UI. Regresion completa (el Motor **no** se toca).
- [X] **T005** Docs: contrato de ranura v6 (`contracts/campos.md`), `AGENTS.md` §7, `specs/019`
  (D7 cerrado), `INDICE.md`, `readme.txt` (4.14.0).
