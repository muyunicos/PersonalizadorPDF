# Implementation Plan: Carga multiple + modelo de recetas (objetivo + configuracion)

**Branch**: `047-carga-multiple` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-carga-multiple/spec.md`

## Summary

El lote de N fotos ya esta implementado (v4.37.0). Queda el **modelo de recetas**
(FR-007..FR-014): la receta se guarda en el catalogo por identidad con un
**objetivo canonico** `{aspecto}-{familia}-{area}` (aspecto decimal con 4 decimales,
familia `0`=rect/`1`=redonda, area en px2 del `w×h` resuelto) y una
**configuracion delta** del default (`{modo:'cubrir'}`). La receta v2 completa viaja
al servidor **derivada** (delta + objetivo + `iw/ih` + `gid`/`phsize`), y el hash lo
sigue calculando el servidor. Las recetas viejas (`{gid}-{w}x{h}-{phsize}`) se
**ignoran** (sin migracion).

## Technical Context

**Language/Version**: PHP 8.x en servidor (min. 7.4) + JavaScript sin build (ES5+).

**Primary Dependencies**: ninguno nuevo. GD + WebP (servidor, spec 026/035),
Canvas 2D (cliente), WordPress + WooCommerce.

**Storage**: `uploads/pmu/{tmp/sesion-{sid}|orders/{uid}}/uploads/uploads.json`
(catalogo por identidad: items + `recetas` + `ajustes`), `manifest.json` por item
(receta congelada), `config.json` por PDF. JSON con `flock` + `.tmp`+`rename`.

**Testing**: PHP CLI (`php tests/texto_puente.php receta|fotos|biblioteca`),
Node (`node tests/cargador-lote.test.js`, `receta-contrato`, `biblioteca-contrato`),
navegador (`node tests/ficha-pedido.browser.js`).

**Target Platform**: Hostinger Business (PHP 7.4+/8.x, GD+WebP), navegadores modernos.

**Project Type**: plugin WordPress (web).

**Performance Goals**: catalogo O(1) (una lectura); `listar` de 10 fotos ≤60 KB;
0 solicitudes de contenido con hoja/mockup certificados.

**Constraints**: solo PHP en servidor (sin `exec`/Composer/Node); escrituras atomicas;
datos en `uploads/pmu/`; sin migraciones (§V).

**Scale/Scope**: N fotos por identidad (spec 040), 10 miniaturas por lista; el lote
respeta el `max` de la ranura.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluacion |
|---|---|
| I. WooCommerce | **PASS** — no toca el checkout ni el ciclo carrito/pedido. |
| II. Arquitectura modular | **PASS** — `PMU_Sesion` sigue dueno del catalogo/manifest; `PMU_Uploads` de rutas; `Metadata` del dataset. |
| III. Render cliente + composicion servidor | **PASS** — la receta sigue siendo **declarativa**; el servidor compone con `Compositor`. |
| IV. Estructura de datos | **PASS** — `uploads.json` por identidad; sin carpetas nuevas; `ajustes` es un campo del catalogo existente. |
| V. Sin compatibilidad hacia atras | **PASS** — las recetas viejas se ignoran (sin migracion), decision del usuario. |
| Constraints tecnicos | **PASS** — sin dependencias nuevas; JSON + GD; PHP 7.4+. |

**Resultado**: **PASS** (sin violaciones, sin `Complexity Tracking`).

## Project Structure

### Documentation (this feature)

```text
specs/047-carga-multiple/
├── plan.md              # este archivo
├── research.md          # decisiones e informe
├── data-model.md        # catalogo, objetivo, configuracion, item
├── contracts/
│   └── recetas.md       # contrato del catalogo/listar/subida
├── quickstart.md        # validacion E1-E5
└── tasks.md             # T001-T022
```

### Source Code (repository root)

```text
inc/class-pmu-sesion.php     # clave_receta (objetivo), receta_de/validar, guardar_subida, catalogo
inc/class-pmu-lectura.php    # listar: recetas por objetivo + ajustes
assets/cargador-pmu.js       # _recetaDeContexto (aspecto->familia->area), _recetaLote, _subir(params)
assets/selector-pmu.js       # _params() delta, _recetaDeFoto(objetivo)
assets/tienda.js             # subirFoto -> params (delta) + objetivo
personalizador-pdf.php       # puente/listar (urls, nonces)
tests/cargador-lote.test.js  # receta por defecto + tope
tests/receta-contrato.test.js# claves v2 + paridad
tests/texto_puente.php       # fase receta/fotos
```

**Structure Decision**: plugin unico (WordPress), sin proyectos separados; se reutiliza
`inc/class-pmu-sesion.php` como dueno del catalogo y `assets/*` como cliente.

## Complexity Tracking

Sin violaciones: no aplica.