# Proposal

## Why

La auditoria de mantenibilidad (2026-11-22) detecto que de 850 asserts de las suites Node,
435 son `regex.test(source)`: verifican que el codigo **contiene** un texto, no que **se
comporte** bien. El bug de las allowlists (`onRecorte`/`paramsDe`/`gid`/`phsize`
descartados en silencio) paso las puertas porque el texto estaba; hacia falta ejecutar el
codigo.

## What Changes

- Migrar las suites criticas (`selector-contrato`, `biblioteca-contrato`,
  `mockup-contrato`) a asserts **conductuales** que ejecutan el codigo (sin leer el archivo
  como texto) en al menos el 60% de sus asserts.
- Conservar los asserts por regex solo para **wiring** (nombres, encolados, rutas), cada uno
  justificado.
- Anadir un helper de DOM propio sin dependencias en `tests/_util/dom-stub.js`, reutilizado
  por >=2 suites.
- Documentar la politica (regex = wiring) en `AGENTS.md §9`.
- Sin perder cobertura: cada regex eliminado tiene equivalente conductual o se justifica.

## Capabilities

### New Capabilities

<!-- Ninguna: cambio de tooling/testing, sin comportamiento observable nuevo. -->

### Modified Capabilities

<!-- Ninguna: specs describen comportamiento; la deuda de asserts no cambia comportamiento
     observable. Por eso el change declara skip_specs: true. -->

## Impact

- Solo `tests/` (suites Node) y `AGENTS.md §9` (documentacion de la politica).
- Cero cambios en codigo de produccion (`engine/`, `inc/`, `assets/`, `admin/`, `modules/`).
- `skip_specs: true`: no se crean specs porque no cambia comportamiento observable.