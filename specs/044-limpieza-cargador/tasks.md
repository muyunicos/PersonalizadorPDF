# Tasks — Limpieza y orden del pipeline de carga

**Spec**: [spec.md](./spec.md)

## Phase 1 — Helpers compartidos (US1)

- [ ] T001 Crear `assets/receta-objetivo.js` con `objetivoDe`, `parseObjetivo`,
  `mejorReceta` (puro, exporta en Node y en `global.PMURecetaObjetivo`).
- [ ] T002 `assets/cargador-pmu.js`: usar `global.PMURecetaObjetivo` (fallback minimo).
- [ ] T003 `assets/selector-pmu.js`: usar `global.PMURecetaObjetivo` (fallback minimo).
- [ ] T004 Encolar `receta-objetivo.js` **antes** de `cargador-pmu.js` y
  `selector-pmu.js` (admin + ficha) en `personalizador-pdf.php`.
- [ ] T005 `tests/receta-objetivo.test.js`: helpers compartidos (objetivo, parse, mejor).
- [ ] T006 Puertas: `receta-objetivo`, `cargador-lote`, `selector-contrato`, `campos-contrato`.

## Phase 2 — Normalizador único (US2)

- [X] T007 Unificar `PURO.normalizarRanura` y `CargadorPMU.normalizarRanuras` (una sola
  implementación; el cargador usa la de la ficha o viceversa).
- [X] T008 Puerta anti-divergencia (`campos-contrato`) + `ficha-pedido`.

## Phase 3 — Estado y código muerto (US3)

- [ ] T009 `assets/biblioteca-pmu.js`: `modo` vuelve a `auto` tras un éxito.
- [ ] T010 `assets/biblioteca-pmu.js`: `config()` se invalida por identidad/revision.
- [ ] T011 Retirar `f.base` de `delegarTira`/`pintarTira` (no existe en el payload).
- [ ] T012 Puertas: `biblioteca-contrato` + `ficha-pedido`.

## Phase 4 — Polish

- [ ] T013 Correr todas las puertas (CLI + browser) y comparar con la linea base.
- [ ] T014 Bump + changelog.
- [ ] T015 Commit por bloque + push.