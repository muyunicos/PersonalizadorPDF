# Tasks — Pruebas conductuales

**Feature**: `048-pruebas-conductuales` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: `spec.md`, `plan.md`.

**Orden**: Setup -> Fundacional -> US1 (selector) -> US2 (biblioteca) -> US3 (mockup) -> US4 (guia) -> Polish.

## Phase 1 — Setup

- [X] T001 Medir la linea base por suite (checks totales vs asserts por regex).
  - **Hecho 2026-11-22**: 850 checks / 435 regex. Concentracion: `selector-contrato` 201,
    `biblioteca-contrato` 138, `mockup-contrato` 71 (94% del total).
- [X] T002 Crear `tests/_util/dom-stub.js`: `document`, nodos, `classList`, `dataset`, `innerHTML`.

## Phase 2 — Fundacional (bloquea las historias)

- [X] T003 Auto-prueba del helper (`tests/dom-stub.test.js`): crear/pintar/consultar nodos.

## Phase 3 — US1: Selector (P1)

- [X] T004 [P] [US1] `conducta-selector`: `_cargar` con `URL.createObjectURL`/`Image` stub -> `imagen`, `archivoOrigen` y `_params()` con `iw/ih`.
- [X] T005 [US1] `conducta-selector`: `_cancelar` emite `CROP_ABORTED` y no llama `subirAsync`/`usarExistente`/`declararReceta`.
- [X] T006 [US1] `conducta-selector`: `_aceptar` de una existente sin POST y con `usarExistente`+`declararReceta`.
- [X] T007 [US1] `selector-contrato`: marcar cada regex restante como **wiring** (comentario) y quitar los que ya tengan equivalente conductual.
- [X] T008 [US1] Gate: `node tests/selector-contrato.test.js && node tests/conducta-selector.test.js`.

## Phase 4 — US2: Biblioteca (P1)

- [X] T009 [P] [US2] `biblioteca-contrato` (runtime): `tira(el, {onElegir})` con 1/3/12 fotos -> N minis + chip `Ver todas (N)`.
- [X] T010 [P] [US2] Click en una miniatura -> `onElegir` recibe ESA foto (con `id` y `recetas`).
- [X] T011 [US2] Visor con `PMUVisor` stub: `verTodas(0)` abre con todas; `Elegir` llama `onElegir`.
- [X] T012 [US2] Borrado en dos pasos: `op=borrar` con `referencias` -> dialogo y `confirmar=1`.
- [X] T013 [US2] Gate: `node tests/biblioteca-contrato.test.js`.

## Phase 5 — US3: Mockup (P2)

- [X] T014 [P] [US3] Canvas stub en `mockup-contrato` (ctx 2D: drawImage, save/restore, clip, globalCompositeOperation).
- [X] T015 [US3] `componer` con 2 capas -> orden de dibujo y estado del ctx.
- [X] T016 [US3] Capa fuera del lienzo -> recorte sin romper.
- [X] T017 [US3] Gate: `node tests/mockup-contrato.test.js && node tests/mockup-geometria.test.js`.

## Phase 6 — US4: Guia

- [X] T018 [P] [US4] `docs/testing.md`: como escribir una suite conductual + plantilla.
- [X] T019 [US4] `AGENTS.md §9`: politica "regex = wiring; el comportamiento se ejecuta".

## Phase 7 — Polish

- [X] T020 Correr todas las puertas CLI + `ficha-pedido.browser.js`.
- [X] T021 Commit por suite (una por commit) + push.

## Dependencies

```text
Fase 1 (T001-T002)
   └─> Fase 2 (T003)
         ├─> US1 (T004-T008)
         ├─> US2 (T009-T013)   (independiente de US1)
         └─> US3 (T014-T017)   (independiente)
               └─> US4 (T018-T019) -> Polish (T020-T021)
```

## Parallel execution

- **Setup**: T002 en paralelo con nada (es el unico).
- **US1**: T004, T005, T006 en paralelo (mismo archivo, asserts distintos).
- **US2**: T009 y T010 en paralelo; T011/T012 despues (dependen del stub del visor).

## Implementation strategy

1. **MVP = US1** (selector): es la suite con mas regex y la que mas bugs escondia.
2. **Segundo incremento = US2** (biblioteca): tira + visor.
3. **Cierre = US3 + US4**: mockup + guia.

## Format validation

- IDs unicos y secuenciales (T001-T021).
- Tareas de US con `[USn]`; setup/fundacional/polish sin etiqueta.
- Sin placeholders.