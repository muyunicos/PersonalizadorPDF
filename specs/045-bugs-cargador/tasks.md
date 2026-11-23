# Tasks — Bugs del cargador (estado entre aperturas)

**Spec**: [spec.md](./spec.md) | **Auditoria**: `docs/auditoria-cargador.md`

**Orden**: test primero (rojo) -> fix -> verde -> puertas -> browser.

## Phase 1 - Setup

- [X] T001 Crear `tests/cargador-estado.test.js` con el arnes (sin DOM) y los casos
  A1 (reemplazo 0 bytes) y A2 (`_resetEstado`).
- [X] T002 Correrlo y confirmar que **falla** (rojo documentado: 14 de 22).

## Phase 2 - US1: editar no pisa la siguiente

- [X] T003 [US1] `assets/cargador-pmu.js`: `_usarExistente` pone el id en la
  posicion de `_reemplazo` y lo limpia; si `desdeVisor`, reabre el visor.
- [X] T004 [US1] Test A1 verde (reemplazo en posicion, sin duplicar, `_reemplazo`
  limpio; sin `_reemplazo` sigue empujando al final).

## Phase 3 - US2: reabrir sin estado viejo

- [X] T005 [US2] `assets/selector-pmu.js`: agregar `_resetEstado()` y llamarlo en
  `open()` (despues del `if (this.raiz) return;`).
- [X] T006 [US2] `_prepararNuevaCarga()` reusa `_resetEstado()` (revocando el
  objectURL antes).
- [X] T007 [US2] Test A2 verde.

## Phase 4 - Polish

- [X] T008 Corregir el comentario 039 D6 de `selector-pmu.js` (ahora conviven con
  040 A6 / 043 US1).
- [X] T009 Puertas: `node tests/cargador-estado.test.js` (22), `selector-contrato`,
  `campos-contrato`, `biblioteca-contrato` (81), `receta-contrato` (21),
  `media_lectura` (75) + `php -l` + `node --check`.
- [X] T010 Browser: `node tests/ficha-pedido.browser.js` en el lab (IPv4).
- [X] T011 Bump de version (4.36.1) + changelog en `readme.txt`.
- [X] T012 Commit `fix(043): ...` con las puertas en verde.

## Phase 5 - B1/B2/B3 (sintomas del comprador)

- [X] T013 [B1] `_abrirVisorCompartido` usa `_urls[id]` antes del pool y memoiza.
- [X] T014 [B3] `_editar` cae al catalogo de la biblioteca y memoiza la URL.
- [X] T015 [B2] `cargarDesdeBiblioteca` prioriza `foto.url`; `thumb` ultimo recurso.
- [X] T016 Puertas: `cargador-estado` 25 + selector/campos/biblioteca/receta + browser.