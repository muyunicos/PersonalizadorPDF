# Tasks — spec 027 (politica de transparencia por campo)

## US1 — La politica la declara el campo

- [X] **T001** `assets/selector-pmu.js`: la config acepta `transp` (`'si'|'no'|''`).
- [X] **T002** `assets/cargador-pmu.js`: `normalizarRanuras()` conserva `transp`
      (normalizado a `'si'|'no'|''`; cualquier otro valor = `''`).
- [X] **T003** `assets/cargador-pmu.js`: `_abrir()` pasa `transp: r.transp` al `SelectorPMU`.
- [X] **T004** `personalizador-pdf.php` (`plantilla_campo`, caso `imagen`): la
      plantilla declara `transp` en `RANURAS` (con comentario de uso).

## US2 — `transp: 'no'`: nunca hay fondo transparente

- [X] **T005** `assets/selector-pmu.js`: con `transp:'no'`, el boton "damero"
      (`spmu-fondo-transp`) se **oculta** y nunca se puede activar.
- [X] **T006** `assets/selector-pmu.js`: con `transp:'no'`, el "auto" que resuelve a
      "transparente" cae a **blanco puro** (`#ffffff`); si la deteccion propone un
      color **solido**, ese color se usa.
- [X] **T007** `assets/selector-pmu.js`: con `transp:'no'`, aunque el estado interno
      quedara en `transparent`, el fondo final se fuerza a opaco (barrera final).

## US3 — `transp: 'si'`: la cadena de condiciones

- [X] **T008** `assets/selector-pmu.js`: deteccion de **alfa real** en toda la
      imagen (muestreada, max 64 px): hay alfa si algun pixel tiene `a < 250`.
- [X] **T009** `assets/selector-pmu.js`: con `transp:'si'`, el "auto" resuelve a
      `transparent` **solo si** hay alfa real (si no, color solido).
- [X] **T010** `assets/selector-pmu.js`: el fondo final manda (D5): si el cliente
      elige un color a mano, la imagen se sube **opaca** (ya asi por D5).

## US4 — Puertas

- [X] **T011** `tests/selector-contrato.test.js`: checks nuevos (politica `no`
      oculta el damero y fuerza blanco; `si` respeta el alfa real; ausente = actual).
      **6 checks** (F2d) + se exporta `resolverFondo`/`colorSolidoDeBordes` en
      `SelectorPMU.puro` (puras, sin DOM).
- [X] **T012** `tests/campos-contrato.test.js`: check de que la ranura conserva
      `transp` y de que la plantilla lo declara. **3 checks**.
- [X] **T013** Regresion: `node tests/selector-contrato.test.js` (OK),
      `node tests/campos-contrato.test.js` (OK), `node tests/conciliacion.js` (OK),
      `php tests/motor_smoke.php` (SMOKE OK), `php tests/campos_migracion.php`
      (CAMPOS V3 OK), `php tests/parity.php` (PARIDAD OK), arnes `texto_puente.php`
      fases `campos`/`ficha`/`pool`/`sesion` (OK).

## US5 — Docs

- [X] **T014** `AGENTS.md` §5 (contrato de la ranura) y §7 (spec 027).
- [X] **T015** `readme.txt` (changelog 4.17.0) + `specs/INDICE.md`.

## Notas

- **Sin migracion** (D8): ningun campo existente se toca. El `campo.js` declara
  `transp` cuando quiere la politica; ausente = comportamiento actual.
- **El servidor no se toca** (spec 020 D4): el cargador ya no se valida en PHP
  (constitution §III: el servidor nunca evalua JS). La politica vive en el
  `campo.js` -> `PMU_API.montarCargador` -> `CargadorPMU` -> `SelectorPMU`.
- **Ortogonal a la 026** (`imagenes-webp`): el alfa viaja igual en PNG y en WebP
  (verificado con GD: `alfa_esq=127`, `alfa_centro=40`).
