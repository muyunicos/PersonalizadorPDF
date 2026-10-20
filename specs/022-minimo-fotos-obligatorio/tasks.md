# Tasks: 022 — Minimo de fotos obligatorio (el `min` frena la compra)

- [X] **T001** `assets/cargador-pmu.js`: `estadoActual()` publica `minTotal` (suma de los `min` de
  las ranuras). Puro y testeable.
- [X] **T002** `assets/tienda.js`: `refrescarMinimos()` (bloqueo + aviso unico en la ficha) y
  `pmu_minimos = {cid: min_total}` en el submit del carrito.
- [X] **T003** `personalizador-pdf.php`: `minimos_declarados()` (saneo acotado),
  `minimos_faltantes()` (conteo REAL de `manifest.subidas[]`) y el rechazo en `carrito_validar()`.
- [X] **T004** Puertas: `minTotal` en `campos-contrato`; fase `carrito` con el rechazo real
  (declarar mas de lo subido -> bloquea; con las fotos -> pasa); regresion completa.
- [X] **T005** Docs: `contracts/campos.md` (el `min` bloquea), `AGENTS.md` §7, `readme.txt`.
