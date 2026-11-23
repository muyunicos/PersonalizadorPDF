# Tasks — Carga multiple de imagenes

**Spec**: [spec.md](./spec.md)

## Phase 1 — Setup

- [X] T001 Crear `tests/cargador-lote.test.js` con los casos: receta por defecto,
  tope `max`, y `_subir` con params explicito.

## Phase 2 — Receta por defecto

- [X] T002 `assets/cargador-pmu.js`: `_recetaLote(r, w, h)` con `modo: 'cubrir'`,
  `escala: 1`, `ox/oy: 0.5`, `rot: 0`, `fondo` por `transp`, `gid/phsize/w/h`.
- [X] T003 `_subir(indice, blob, posicion, params)`: usar `params` si llega.

## Phase 3 — Lote

- [X] T004 `_subirArchivo(indice, archivo)`: dimensiones (acotadas a 2000 px) +
  `_subir` con la receta por defecto.
- [X] T005 `_subirLote(indice, archivos)`: respeta `max`, avisa si sobran, serial.
- [X] T006 `subirLote` en la config del selector + `max`.

## Phase 4 — UI

- [X] T007 `selector-pmu.js`: `multiple` cuando `max > 1`; el `change` y el drop del
    modal abren el editor con 1 archivo y delegan el lote con N.
- [X] T008 `cargador-pmu.js`: el drop de la zona acepta N archivos.

## Phase 5 — Polish

- [X] T009 Puertas: `cargador-lote` 20, `selector-contrato`, `campos-contrato`,
  `biblioteca-contrato` 81, `cargador-estado` 25.
- [X] T010 Validacion manual en el lab (campo `max: 3` temporal): 3 archivos ->
  3 miniaturas, 0 fallos, modal cerrado.
- [X] T011 Bump 4.37.0 + changelog.
- [X] T012 Commit + push.