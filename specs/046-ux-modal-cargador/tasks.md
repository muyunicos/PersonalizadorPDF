# Tasks — UX del modal de recorte y avisos del comprador

**Spec**: [spec.md](./spec.md) | **Sintomas**: `docs/sintomas-comprador.md`

## Phase 1 — Setup

- [X] T001 Actualizar `tests/selector-contrato.test.js` con las marcas de la 046
  (titulo, etiquetas, sin "Ver en grande", "Quitar").
- [X] T002 Actualizar `tests/biblioteca-contrato.test.js` (cargarDesdeBiblioteca con
  origen, Quitar, subida en segundo plano).
- [X] T003 Actualizar `tests/ficha-pedido.browser.js` (sin avisos al cargar, aviso al
    comprar, `aria-disabled`, `.spmu-ok` en vez del texto "Guardar").

## Phase 2 — US1: avisos al comprar

- [X] T004 `cargador-pmu.js`: `_avisos` arranca false; `_pintar` solo escribe el texto
    del aviso si esta activo; `mostrarAvisos()`.
- [X] T005 `tienda.js`: `avisosActivos` + `api.activarAvisos()` + registro de cargadores.
- [X] T006 `tienda.js`: `refrescarCarrito` deja el boton clicable (`aria-disabled` +
    ayudas visuales) y `engancharCarrito` agrega el guard de click/submit.

## Phase 3 — US2: modal con contexto

- [X] T007 `cargador-pmu.js`: `titulo: 'Imagen #X'`, `esReemplazo` separado del titulo.
- [X] T008 `selector-pmu.js`: `open()` usa `opciones.titulo`/`opciones.esReemplazo`;
    `_actualizarPrimario` rota `Subir`/`Aceptar`/`Guardar`/`Cambiar` (con `firmaParams`).
- [X] T009 `selector-pmu.js`: `Cambiar imagen` si hay imagen; `cargarDesdeBiblioteca`
    guarda el origen (`editar`/`tira`).

## Phase 4 — US3: Quitar y sin Ver en grande

- [X] T010 Retirar el boton y el handler de "Ver en grande" (selector + cargador).
- [X] T011 Renombrar "Eliminar" -> "Quitar" (solo con ranura poblada).

## Phase 5 — US4: carga en segundo plano

- [X] T012 `selector-pmu.js`: al aceptar dispara `subirAsync` y cierra el modal.
- [X] T013 `cargador-pmu.js`: `_pendientes` + placeholder `cpmu-mini-cargando` (spinner)
    y `_quitarPendiente`; el boton cuenta los pendientes.

## Phase 6 — US5 (tema)

- [X] T014 `muyunicos/js/galeria.js`: `chipSiempre` + "Todas (N)" con el total;
    `biblioteca-pmu.js` pasa `chipSiempre: true`.
- [X] T015 Tema: bump de version (`style.css`) para cache-bust.

## Phase 7 — Polish

- [X] T016 Puertas CLI verdes (`selector-contrato`, `biblioteca-contrato` 81,
    `campos-contrato`, `cargador-estado` 25, `media_lectura`, `php -l`, `node --check`).
- [X] T017 Puerta de navegador `ficha-pedido.browser.js` **54/54** en el lab.
- [X] T018 Bump 4.36.2 + changelog.
- [X] T019 Commit + push (plugin y tema).