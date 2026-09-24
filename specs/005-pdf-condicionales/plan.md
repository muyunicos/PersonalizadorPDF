# Implementation Plan: 005-pdf-condicionales

**Branch**: `005-pdf-condicionales` | **Created**: 2026-09-19

**Spec**: [spec.md](spec.md) | **Norma**: `constitution` §I+§IV + `research.md` D1–D9

## Summary

Multivínculo `_pmu_pdf_slugs` + configuración `tienda{pid}` por asociación
(`activo`/`validez`/`mensaje_html`/`bloquear`); la ficha evalúa las valideces al
instante (filtra PDFs/mockups, primer mensaje, bloqueo); el servidor sanea y
congela el snapshot (`manifest.pdfs[]` + metas) que gobierna pool, Motor,
Descargas y "Completados". Sin parser JS en servidor (D3).

## Technical Context

**Language/Version**: PHP 8.5.4 (servidor, sin dependencias) + JavaScript en
navegador (evaluador + ficha, sin bundler). Mismo stack que 004.

**Primary Dependencies**: WordPress + WooCommerce (`postmeta`, hooks `woocommerce_*`
de 004); `PMU_Uploads` (dueño de rutas/config), `PMU_Sesion` (manifest);
`assets/tienda.js` (evaluación + filtrado); `admin/pdfs.php` (Configuración tienda).

**Storage**: `config.json:tienda{pid}` por PDF; postmeta `_pmu_pdf_slugs` (lista)
+ espejo intacto; `manifest.pdfs[]`/`pdfs_descartados[]` + metas `_pmu_pdfs[...]`.

**Testing**: `php -l` + `SMOKE OK` + `PARIDAD OK` + fases del arnés
(`tests/texto_puente.php validez` + `tests/validez.js` con fixture compartida:
misma expresión, mismos valores, mismo resultado) + recorrido `quickstart.md`.

**Target Platform**: Hostinger Business (PHP 8.5.4) + navegador del cliente.

**Project Type**: Extensión de 004 (mismos archivos, sin piezas nuevas salvo el
evaluador JS en `tienda.js` y la fase `validez` del arnés).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I (WooCommerce)**: multivínculo extiende FR-2 de 004 sin romper mockup
  obligatorio/omisible, PDF tras el pago ni lista nativa. `bloquear`/0-elegibles
  endurecen el `add-to-cart`, nunca lo habilitan sin vistas (regla V-7 intacta).
- **II (datos)**: `tienda{}` vive en `config.json` (dueño `PMU_Uploads`); `pdfs[]`
  en manifest/meta (dueño `PMU_Sesion` + espejo Woo). Sin rutas propias nuevas.
- **III (JS/PHP)**: `validez` se evalúa SOLO en el navegador con el sandbox de
  campos; PHP valida sintaxis al guardar y sanea pertenencia al agregar
  (nunca evalúa la expresión).
- **IV (layout/persistencia)**: sin cambios de layout; `pdfs_descartados[]` es
  auditoría, no persistencia funcional. Migración `_pmu_pdf_slug`→`_pmu_pdf_slugs`
  tolerante (lee el singular, conserva respaldo; Const. V lo permite por ser
  explícitamente necesario).
- **V (compatibilidad)**: la migración del postmeta es la excepción declarada;
  sin ella, productos de 1 PDF siguen funcionando (lista de 1 = singular).

## Project Structure

Sin piezas nuevas: `personalizador-pdf.php` (multivínculo, saneado, snapshot,
metas), `admin/pdfs.php` (Configuración tienda por asociación),
`assets/tienda.js` (evaluador + filtrado + primer mensaje + bloqueo + diagnóstico
admin), `inc/class-pmu-uploads.php` (`config_tienda` + saneado),
`tests/texto_puente.php` (fase `validez`) + `tests/validez.js` + `tests/validez-fixture.json`
(fixture compartida PHP/JS).

**Structure Decision**: no hay módulo de validez en servidor (D3: sin parser);
el evaluador JS vive en `tienda.js` porque solo la ficha lo necesita.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (ninguna) | — | — |

## Phase 0 / Phase 1

- **Fase 0** ([research.md](./research.md)): D1–D9 (multivínculo, expresión JS,
  autoridad del navegador, unión de campos, primer mensaje, bloquear, snapshot,
  diagnóstico, alcance vs 004).
- **Fase 1**: [data-model.md](./data-model.md) (asociación + snapshot),
  [contracts/validez.md](./contracts/validez.md) (sintaxis, contexto, ejemplos),
  [quickstart.md](./quickstart.md) (recorrido 4 PDFs + matriz de fallos).
- **Fase 2** ([tasks.md](./tasks.md)): Setup (multivínculo) · Foundational
  (`tienda{}` + saneado) · US1 (admin) · US2 (ficha) · US3 (bloqueo) · US4
  (snapshot/auditoría) · Polish (tests + docs + manual).
