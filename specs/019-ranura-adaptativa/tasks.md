# Tareas — 019 Ranura adaptativa (`phsize` + aviso de ampliacion)

> Regla: **no marcar `[X]` por aproximacion**. Estado: **en especificacion** (0/16).
> Version objetivo: 4.10.0.

## Fase 1 — Servidor: el tamano del grupo viaja al navegador

- [ ] **T001** `campos_panel()` acepta el mapa de grupos (`gid => {w,h}`) y publica
  `grupo_w`/`grupo_h`/`grupo_gid` por campo cuando hay envoltura asociada (FR-001).
- [ ] **T002** `panel_ficha()` pasa el mapa (ya resuelve `envoltura_defecto()` y el `$gid`)
  sin leer el PDF dos veces; sin asociacion -> `null` (FR-003).
- [ ] **T003** `validar_cargador()` conserva `phsize` en las ranuras normalizadas (D9/FR-007).
- [ ] **T004** `php tests/texto_puente.php` fase `ficha`: `grupo_w`/`grupo_h`/`grupo_gid`
  publicados con asociacion y `null` sin ella; fase `campos`: `phsize` sobrevive al guardado.

## Fase 2 — Cliente: resolver la ranura (`assets/tienda.js`)

- [ ] **T005** Funcion pura `normalizarRanura(ranura, defCampo)` (sin DOM): aplica `phsize`
  0/1/2, cap `PH_MAX`, deriva la forma y devuelve el aviso cuando degrada (FR-002/004/005).
- [ ] **T006** `montarCargador()` la usa antes de instanciar `CargadorPMU`; `console.warn`
  accionable si `phsize > 0` sin `grupo_w/h` (FR-003).
- [ ] **T007** `node tests/campos-contrato.test.js`: 0/1/2, cap, degradacion y precedencia
  de `forma` (checks nuevos).

## Fase 3 — Aviso de ampliacion (`selector-pmu.js`, `cargador-pmu.js`)

- [ ] **T008** `selector-pmu.js`: badge `se amplia Nx` (una decimal) cuando el recorte
  amplia; informativo, no deshabilita "Aceptar" (FR-006).
- [ ] **T009** `cargador-pmu.js`: el mismo aviso en la tira de la ranura, junto al badge de
  medidas; sin imagen no hay aviso.
- [ ] **T010** `node tests/selector-contrato.test.js`: el aviso existe y no bloquea.

## Fase 4 — Regresion

- [ ] **T011** `node tests/mockup-contrato.test.js`, `node tests/conciliacion.js`,
  `php tests/campos_migracion.php` (verde).
- [ ] **T012** `php tests/motor_smoke.php` + `php tests/parity.php`: el Motor **no** se toca
  (regresion obligatoria).
- [ ] **T013** Fases `campo_subida`, `vista_previa`, `pedido`, `admin`: verde.

## Fase 5 — Docs y cierre

- [ ] **T014** `specs/012.../contracts/campos.md` (tabla v5 con `phsize`) y
  `specs/016.../contracts/selector-visual.md` (aviso de ampliacion).
- [ ] **T015** `AGENTS.md` §5 + §11 (fila "la ranura quedo del tamano viejo"), `specs/INDICE.md`.
- [ ] **T016** `readme.txt` (changelog 4.10.0) + bump de `* Version:` (fuente unica) y
  recorrido WP real con `phsize: 1` (tamano del PNG en el pool + resultado en el PDF).

## Nota

Sin migracion: `phsize` es **opt-in** y no se escribe solo. Un campo sin `phsize` (o un
`cargador` legacy) se comporta igual que hoy.
