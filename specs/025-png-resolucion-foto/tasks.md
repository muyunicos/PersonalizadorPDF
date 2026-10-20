# Tasks: 025 — PNG a resolución de la foto (el cargador nunca amplía)

- [X] **T001** `escalaBase(modo, iw, ih, W, H)` sin flag: **Rellenar** = recorte al aspecto sin
  ampliar (D3), **Ajustar** = contain capado (D4), **Estirar** = lado mayor (D2).
- [X] **T002** `_generarLienzoSalida`: canvas de `min(caja, lienzo)` por eje con
  `ctx.setTransform(k)`; `_pintarImagenEnContexto` sigue dibujando en coordenadas del lienzo.
- [X] **T003** Quitar `escala`/`sinAmpliar`: config, normalizadores (`tienda`, `cargador`), `_setZoom`
  (max 1 siempre), `_actualizarControlesModo`, `_cargar`, `_badge`.
- [X] **T004** `assets/tienda.js`: `rasterizar()` capada a 1 (el pool no re-amplía).
- [X] **T005** Puertas: E1–E6 + "ningun modo amplia" + normalizacion. Regresion completa.
- [X] **T006** Docs: contrato v7, `AGENTS.md` §7, `specs/023` (superada), `readme.txt` (4.16.0).
