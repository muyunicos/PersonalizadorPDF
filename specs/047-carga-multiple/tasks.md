# Tasks — Carga multiple + modelo de recetas

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md) | **Contract**: [contracts/recetas.md](./contracts/recetas.md)

**Organization**: por historia de usuario (US1-US3) + el modelo de recetas (transversal, P1).

## Phase 1 — Setup

- [X] T001 Crear `tests/cargador-estado.test.js` y `tests/cargador-lote.test.js`
  (estado entre aperturas + receta por defecto/tope).
- [X] T002 Confirmar el baseline de puertas en verde (`php -l`, `node --check`,
  `selector-contrato`, `biblioteca-contrato`, `campos-contrato`, `media_lectura`).

## Phase 2 — Foundational (modelo de recetas)

- [X] T003 `inc/class-pmu-sesion.php`: `clave_receta()` pasa a **objetivo**
  (`{aspecto 4 dec}-{familia 0|1}-{area}`) y deja de exigir `gid`.
- [X] T004 `inc/class-pmu-sesion.php`: `receta_de()`/`receta_validar()` aceptan
  **objetivo + configuracion delta** y derivan la v2 (w/h, `iw/ih`, `gid`/`phsize`).
- [X] T005 `inc/class-pmu-sesion.php`: `guardar_subida()` guarda la fila con
  `receta`/`params` v2 y actualiza `items[id].recetas[objetivo]` + `items[id].ajustes`.

## Phase 3 — US1: Carga multiple (P1) ✅ implementado

- [X] T006 [US1] `assets/cargador-pmu.js`: `_recetaLote(r, w, h)` (`cubrir`, escala 1,
  centro, rot 0, `gid`/`phsize`/`w`/`h`).
- [X] T007 [US1] `_subir(indice, blob, posicion, params)`: usar `params` si llega.
- [X] T008 [US1] `_subirArchivo(indice, archivo)`: original acotado + `_subir`.
- [X] T009 [US1] `_subirLote(indice, archivos)`: respeta `max`, avisa si sobran, serial.
- [X] T010 [US1] `subirLote`/`max` en la config del selector.

## Phase 4 — US2: Edicion predeterminada (P1) ✅ implementado

- [X] T011 [US2] `assets/selector-pmu.js`: `multiple` si `max > 1`; `change`/drop del
  modal -> editor con 1 archivo, lote con N.
- [X] T012 [US2] `assets/cargador-pmu.js`: el drop de la zona acepta N archivos.
- [X] T013 [US2] `_editar` abre con la receta vigente (`_recetaDeContexto`).

## Phase 5 — US3: Errores y limites (P2)

- [X] T014 [US3] Archivo ilegible: aviso por archivo, el lote sigue.
- [X] T015 [US3] Tope `max`: aviso "Solo entran N imagen(es)".
- [ ] T016 [US3] **Duplicados en el lote** (mismo archivo dos veces): dedupe por
  contenido o aviso (pendiente de decidir).
- [ ] T017 [US3] **BMP/SVG**: el `accept` los ofrece y el servidor no los valida;
  sacarlos o avisar por archivo.

## Phase 6 — Modelo de recetas (P1, transversal) — pendiente v4.38.0

- [X] T018 `assets/cargador-pmu.js`: `_recetaDeContexto` resuelve por **aspecto mas
  cercano (sin umbral) -> familia -> area**; "ajustes del cliente" = ultima receta.
- [X] T019 [P] `assets/selector-pmu.js`: `_params()` sigue dando la **v2** (wire) y
  `_aplicarParamsIniciales` acepta **v2 o delta**; `_recetaDeFoto` lee objetivo/ajustes.
- [X] T020 `inc/class-pmu-lectura.php`: `listar` expone `recetas` (objetivo) y
  `ajustes` por foto.
- [X] T021 `personalizador-pdf.php`: no requiere cambios (usa `PMU_Lectura::listar`).
- [X] T022 Puertas: `cargador-lote` 30, `receta-contrato` 21, `biblioteca-contrato` 81,
  `texto_puente.php receta|fotos|biblioteca`, `media_lectura` 77, `ficha-pedido` 54/54.
- [X] T023 Bump 4.38.0 + changelog.
- [X] T024 Commit + push.

## Phase 7 — Polish

- [ ] T025 [P] Actualizar `AGENTS.md` §5 (catalogo: `recetas`/`ajustes`) y
  `docs/errores.md` si aparece un caso nuevo.
- [ ] T026 Recorrido `quickstart.md` E1-E5 en el lab.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: hecho.
- **Foundational (Phase 2)**: bloquea el modelo de recetas (Phase 6) y la lectura.
- **US1/US2 (Phases 3-4)**: hechos y desplegados (v4.37.0).
- **US3 (Phase 5)**: T014/T015 hechos; T016/T017 deferred.
- **Modelo de recetas (Phase 6)**: depende de Phase 2; **es el trabajo pendiente**.
- **Polish (Phase 7)**: despues de Phase 6.

### Parallel opportunities

- T016 y T017 son independientes (archivos distintos: `cargador-pmu.js` / `selector-pmu.js`).
- T018-T021 tocan archivos distintos (`cargador-pmu.js`, `selector-pmu.js`,
  `class-pmu-lectura.php`, `personalizador-pdf.php`): pueden ir en paralelo.
- T022 es la puerta que los junta: va al final.

### MVP

- **MVP = US1 + US2** (ya entregado en v4.37.0): el lote y la edicion predeterminada.
- **Siguiente incremento = Phase 6** (modelo de recetas, v4.38.0): reutilizacion por
  objetivo + delta.