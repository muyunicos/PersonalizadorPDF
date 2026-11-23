# Tasks — Limpieza y orden del pipeline de carga

**Spec**: [spec.md](./spec.md)

## Phase 1 — Helpers compartidos (US1)

- [X] T001 Crear `assets/receta-objetivo.js` con `objetivoDe`, `parseObjetivo`,
  `mejorReceta` (puro, exporta en Node y en `global.PMURecetaObjetivo`).
- [X] T002 `assets/cargador-pmu.js`: usar `global.PMURecetaObjetivo` (fallback minimo).
- [X] T003 `assets/selector-pmu.js`: usar `global.PMURecetaObjetivo` (fallback minimo).
- [X] T004 Encolar `receta-objetivo.js` **antes** de `cargador-pmu.js` y
  `selector-pmu.js` (admin + ficha) en `personalizador-pdf.php`.
- [X] T005 `tests/receta-objetivo.test.js`: helpers compartidos (objetivo, parse, mejor).
- [X] T006 Puertas: `receta-objetivo`, `cargador-lote`, `selector-contrato`, `campos-contrato`.

## Phase 2 — Normalizador único (US2)

- [X] T007 Unificar `PURO.normalizarRanura` y `CargadorPMU.normalizarRanuras` (una sola
  implementación; el cargador usa la de la ficha o viceversa).
- [X] T008 Puerta anti-divergencia (`campos-contrato`) + `ficha-pedido`.

## Phase 3 — Estado y código muerto (US3)

- [X] T009 `assets/biblioteca-pmu.js`: `modo` vuelve a `auto` tras un éxito.
- [X] T010 `assets/biblioteca-pmu.js`: `config()` se invalida por identidad/revision.
- [X] T011 Retirar `f.base` de `delegarTira`/`pintarTira` (no existe en el payload).
- [X] T012 Puertas: `biblioteca-contrato` + `ficha-pedido`.

## Phase 4 — Polish

- [X] T013 Correr todas las puertas (CLI + browser) y comparar con la linea base.
- [X] T014 Bump + changelog.
- [X] T015 Commit por bloque + push.
- [X] T016 Borrar los bloques `if (false)` con los helpers locales (40 + 38 lineas).