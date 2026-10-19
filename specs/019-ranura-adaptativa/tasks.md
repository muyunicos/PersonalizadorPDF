# Tareas — 019 Ranura adaptativa (`phsize` + aviso de ampliacion)

> Regla: **no marcar `[X]` por aproximacion**. Estado: **implementada** (2026-10-19), 15/16.
> Pendiente: **T016** (release 4.10.0 + recorrido WP real).

## Fase 1 — Servidor: el tamano del grupo viaja al navegador

- [X] **T001** `campos_panel()` publica `grupo_w`/`grupo_h`/`grupo_gid` por campo cuando hay
  envoltura asociada; sin asociacion las tres claves van `null` (FR-001).
- [X] **T002** `panel_ficha()` resuelve el tamano del grupo base desde `analisis.json` —
  donde `grupos` es una **lista**, se busca por `id` — y lo deja en la fila del campo;
  `panel_producto()` lo arrastra al unir campos de varios PDFs (FR-003).
- [X] **T003** `validar_cargador()` conserva `phsize` normalizado a 0..2 (D9/FR-007).
- [X] **T004** `php tests/texto_puente.php` fase `ficha`: `grupo_w`/`grupo_h`/`grupo_gid`
  publicados (comparados contra el analisis real del PDF de prueba) y `null` sin asociacion;
  fase `campos`: `phsize` sobrevive y se acota.

## Fase 2 — Cliente: resolver la ranura (`assets/tienda.js`)

- [X] **T005** Funcion pura `PURO.normalizarRanura(ranura, defCampo)` (sin DOM): aplica
  `phsize` 0/1/2, cap `PH_MAX = 3000`, respeta `circle`/`square`/`fit` y devuelve `aviso`
  cuando degrada o acota (FR-002/004/005).
- [X] **T006** `montarCargador()` la usa antes de instanciar `CargadorPMU`; `console.warn`
  accionable si `phsize > 0` sin `grupo_w`/`grupo_h` (FR-003).
- [X] **T007** `node tests/campos-contrato.test.js`: la funcion pura se **ejecuta** en un
  sandbox (0/1/2, cap, degradacion, `circle`, `fit`, `min`/`max`) — 12 checks nuevos.
- [X] **T017** **La guia se deduce sola** (post-implementacion, 2026-10-19): el paso manual
  "Envoltura del cargador" **se elimino** (era redundante). `campos_envoltura_deducida($nombre)`
  la saca del **cableado del hueco** (`[campoN]` en `value`/`settings` de un grupo con envoltura) y,
  si el PDF tiene un solo grupo con envoltura y el campo declara tipo `imagen`, de ese.
  `config.json:campos_envoltura` deja de usarse (se **limpia** al guardar la config; se borra del
  formato en la spec 020) y la consola muestra "automatica: #gid (del cableado del hueco)".
  Cubierto por la fase `ficha`.

## Fase 3 — Aviso de ampliacion (`selector-pmu.js`, `cargador-pmu.js`)

- [X] **T008** `selector-pmu.js`: `_factorAmpliacion()` + badge `· se amplia Nx` (una decimal,
  tolerancia 1.05); informativo, no deshabilita "Aceptar" (FR-006).
- [X] **T009** `cargador-pmu.js`: la tira muestra el **aviso de la ranura** (`r.aviso`, con
  `.cpmu-aviso`): phsize degradado o tamano acotado. Sin aviso no se agrega DOM.
- [X] **T010** `node tests/campos-contrato.test.js`: el aviso del selector existe y no
  bloquea; la tira pinta `cpmu-aviso`.

## Fase 4 — Regresion

- [X] **T011** `node tests/mockup-contrato.test.js` (108 checks), `node tests/conciliacion.js`,
  `node tests/selector-contrato.test.js`, `php tests/campos_migracion.php` (CAMPOS V3 OK).
- [X] **T012** `php tests/motor_smoke.php` (SMOKE OK) + `php tests/parity.php` (PARIDAD OK):
  el Motor **no** se toco.
- [X] **T013** Fases `campos`, `admin`, `ficha`, `campo_subida`, `vista_previa`, `pedido`,
  `tienda` y `certificacion_hoja`/`sin_lectura`: verde.

## Fase 5 — Docs y cierre

- [X] **T014** `specs/012.../contracts/campos.md`: tabla de ranura con `phsize` (+ nota de
  convivencia con `w`/`h`) y `specs/016.../contracts/selector-visual.md`: el aviso de
  ampliacion como aditivo.
- [X] **T015** `AGENTS.md` §5 (contrato de ranura + publicacion de `grupo_*`) y §11 (fila
  "la ranura quedo del tamano viejo"), `specs/INDICE.md`.
- [ ] **T016** `readme.txt` (changelog 4.10.0) + bump de `* Version:` (fuente unica) y
  recorrido WP real con `phsize: 1` (tamano del PNG en el pool + resultado en el PDF).
  **Release hecho 2026-10-19** (cabecera `4.10.0` + `Stable tag` + changelog);
  **pendiente solo el recorrido** (§6d de `MANUAL-PENDIENTE-WP-REAL.md`).

## Nota

Sin migracion: `phsize` es **opt-in** y no se escribe solo. Un campo sin `phsize` (o un
`cargador` legacy) se comporta igual que hoy.
