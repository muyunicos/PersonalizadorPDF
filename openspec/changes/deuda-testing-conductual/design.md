# Design — deuda-testing-conductual

## Context

Las suites Node del plugin verifican mucho por **regex sobre el fuente** (wiring) y poco por
**ejecucion** (comportamiento). 850 asserts / 435 regex; `selector-contrato` 201 regex,
`biblioteca-contrato` 138, `mockup-contrato` 71. Un assert de texto detecta que una pieza se
conecto, no que se comporte. La spec legacy `specs/048-pruebas-conductuales/` (borrador)
define la deuda y la politica.

## Goals / Non-Goals

### Goals

- Que cada comportamiento importante se **ejecute** (no que el regex desaparezca).
- Helper de DOM propio, sin dependencias, reutilizado por >=2 suites.
- Guia en `AGENTS.md §9`: cuando usar regex (wiring) y cuando ejecutar.
- Migracion incremental, suite por suite, con puertas por suite.

### Non-Goals

- Migrar los tests PHP (ya son conductuales).
- Tests de navegador (Playwright) — se quedan como estan.
- Cambiar la cobertura de `modules/textmuy` (otro repo).
- Agregar dependencias (jest/jsdom/npm i en el repo).

## Decisions

- **skip_specs: true**: la deuda de asserts no cambia comportamiento observable del producto;
  las specs describen comportamiento, asi que no se crean deltas (regla OpenSpec: `skip_specs`
  solo cuando no cambia comportamiento observable).
- **Regex = wiring**: se conservan los asserts de wiring (contrato publico, no regresiones),
  cada uno justificado; no se borran para maquillar el numero.
- **DOM stub propio**: `tests/_util/dom-stub.js` cubre lo que las suites necesitan; si falta
  algo, se agrega al helper (no a un navegador).
- **Sin dependencias**: Playwright queda fuera del repo, como hoy.

## Risks / Trade-offs

- **Perder cobertura al migrar** -> cada regex eliminado tiene equivalente conductual o se
  justifica su baja (FR-003); gate `node tests/*` en verde.
- **Deuda que vuelve a crecer** -> guia en `AGENTS.md §9` y politica explicita.
- **DOM stub insuficiente** -> se amplГ­a el helper, no se introduce jsdom.
- **Marcar rojo sin querer** -> SC-003: 0 puertas pasan de verde a rojo (47 suites + navegador).

## Migration Plan

1. `conducta-selector` (>=35 checks) para el comportamiento del selector.
2. Seccion de runtime en `biblioteca-contrato` (>=20 checks: tira, elegir, visor).
3. `mockup-contrato` ejecuta `componer` con canvas stub (>=3 casos).
4. Helper `tests/_util/dom-stub.js` reutilizado por >=2 suites.
5. Documentar politica en `AGENTS.md §9` y correr `node tests/*` por suite.

## Open Questions

- Ninguna cerrada; el detalle por suite se resuelve al aplicar el change.