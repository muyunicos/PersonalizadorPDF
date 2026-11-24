# Implementation Plan: Pruebas conductuales

**Branch**: `048-pruebas-conductuales` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/048-pruebas-conductuales/spec.md`

## Summary

Migrar los asserts por regex a **comportamiento** en las tres suites que concentran
el 94% de la deuda (`selector-contrato` 201, `biblioteca-contrato` 138,
`mockup-contrato` 71), con un helper de DOM propio y sin dependencias nuevas.
La migracion es **incremental**: una suite por commit, con puertas por suite.

## Technical Context

**Language/Version**: Node 22 (CLI), sin build.

**Primary Dependencies**: ninguna nueva. `playwright` sigue fuera del repo (solo
navegador). El DOM stub es propio (`tests/_util/dom-stub.js`).

**Storage**: no aplica (tests).

**Testing**: `node tests/<suite>.test.js` (CLI), `node --check`, y las de navegador
como regresion final (`ficha-pedido.browser.js`).

**Target Platform**: desarrollo (Windows + pwsh 7).

**Project Type**: plugin WordPress con assets de cliente; sin build.

**Performance Goals**: cada suite debe correr en <2 s (sin DOM real, sin red).

**Constraints**: sin dependencias nuevas; sin tocar `assets/` salvo que la suite
descubra un bug; sinjt no.

**Scale/Scope**: 3 suites, ~410 asserts a revisar.

## Constitution Check

| Principio | Como lo cumple | Resultado |
|---|---|---|
| I. WooCommerce Integration | No toca el flujo de compra; solo tests. | PASS |
| II. Modular Architecture | Un helper compartido (`tests/_util/`), no un motor nuevo. | PASS |
| III. Render en navegador | No se agrega render; los tests no son runtime del plugin. | PASS |
| IV. Directory Structure | `tests/` es area de desarrollo; sin datos en `uploads/`. | PASS |
| V. No Backward Compatibility | No hay migracion de datos. | PASS |
| Validation | Las puertas siguen siendo `node tests/*.test.js` + `AGENTS.md §9`. | PASS |

Sin violaciones. No se agregan dependencias ni se toca produccion.

## Project Structure

```text
specs/048-pruebas-conductuales/
├── spec.md
├── plan.md
├── tasks.md
tests/
├── _util/
│   └── dom-stub.js            <- helper de DOM minimo (document, createElement, appendChild, classList)
├── conducta-selector.test.js  <- YA EXISTE (25 checks): referencia de estilo
├── selector-contrato.test.js  <- migrar: wiring se queda, comportamiento va a conducta-selector
├── biblioteca-contrato.test.js<- migrar: tira/elegir/visor con DOM stub
└── mockup-contrato.test.js    <- migrar: componer con canvas stub
```

**Archivos que NO se tocan**: `assets/`, `engine/`, `inc/`, `modules/textmuy/`.

## Phases

### Phase 0 — Investigacion (hecho)
Medicion de la linea base: **850 checks / 435 regex**; concentracion en 3 suites.

### Phase 1 — Helper de DOM (`tests/_util/dom-stub.js`)
`document` minimo: `createElement`, `createTextNode`, `getElementById`, `head`,
`body`, `addEventListener`; nodos con `appendChild`, `classList`, `dataset`,
`style`, `setAttribute`, `addEventListener`, `innerHTML` (set/get), `children`.

### Phase 2 — Selector (P1)
- `conducta-selector.test.js` ya cubre `_params`, `open`, `_aplicarParamsIniciales`,
  `_recetaDeFoto` (25).
- Falta: `_cargar` (con `URL`/`Image` stub), `_cancelar` (CROP_ABORTED), `_aceptar`
  de una existente (sin POST). Sumar al mismo archivo.
- `selector-contrato`: marcar los regex restantes como **wiring** (comentario) y
    reducir los que ya tengan equivalente conductual.

### Phase 3 — Biblioteca (P1)
- Tira: `tira(el, {onElegir})` con N fotos → N minis + chip; click → `onElegir(foto)`.
- Visor: `PMUVisor` stub → `verTodas(0)` abre con todas; Elegir/Borrar llaman.
- Borrado en dos pasos (referencias → diálogo).

### Phase 4 — Mockup (P2)
- `componer` con canvas stub (ctx 2D: `drawImage`, `save/restore`, `clip`, `globalCompositeOperation`).
- Orden de capas y recorte dentro del lienzo.

### Phase 5 — Guia y cierre
- `AGENTS.md §9`: politica "regex = wiring; el comportamiento se ejecuta".
- `docs/testing.md` (nuevo): como escribir una suite conductual + plantilla.

## Complexity Tracking

Sin desvios. La complejidad nueva es **un helper de DOM** (~120 lineas) y tests.