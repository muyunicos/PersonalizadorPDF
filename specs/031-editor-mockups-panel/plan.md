# Implementation Plan: Rediseno del panel del editor de mockups (spec 031)

**Branch**: `031-editor-mockups-panel` | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-editor-mockups-panel/spec.md`

## Summary

El admin edita mockups con el **lienzo siempre visible** (panel izquierdo de minimo 300 px, zoom inicial
100 %), la **transformacion de la seleccion** (x/y/ancho/alto/rot + alinear + distribuir) **debajo del
lienzo**, y el panel derecho reducido a **5 acordeones cerrados por defecto**. La lista de capas **agrupa
visualmente por grupo** en acordeones propios; las acciones de ciclo de vida de la capa (Duplicar/Quitar/
Agrupar/Desagrupar/Ocultar/Bloquear) viven en un **menu contextual de clic derecho** con atajos y boton
`...` de fallback; el importador de pagina + PH se muda a Placeholders. Todo es **UI del editor del
admin**: sin tocar `engine/`, `modules/textmuy/`, la ficha, el Motor ni el formato de `config.json`
(constitucion §IV; FR-017).

## Technical Context

**Language/Version**: JavaScript de navegador ES5 (sin build) + CSS en `assets/admin.css`; PHP solo para
el bump de version (cache-bust). Sin dependencias nuevas.

**Primary Dependencies**: jQuery (delegacion de eventos, vigente); geometria pura
`assets/mockup-geometria.js` (`G.extremoVisible`, `G.puntoMarco`, `marcoOrientadoSeleccion`,
`G.posicionTirador` — **sin cambios**); render compartido `assets/mockup-render.js` (**sin cambios**);
PDF.js local (solo para importar pagina — sin cambios); `PersonalizadorPDF.pmuPost` (vigente).

**Storage**: N/A — **ningun dato nuevo**. `config.json:mockups[]` conserva su formato vigente (FR-017);
el estado de acordeones y zoom es de sesion (transitorio).

**Testing**: `node tests/mockup-contrato.test.js` (checks de estructura **actualizados** a la nueva
superficie), `node tests/mockup-geometria.test.js` (sin cambios — puerta), `node --check`, `php -l`,
`php tests/texto_puente.php mockups mockup_capas mockup_pagina mockup_preview` (auditoria de anclas de
markup, R5); lab `C:\wp-lab` + Playwright con probe de tinta para el tirador de capa (SC-006).

**Target Platform**: consola del admin de WordPress (herramienta de escritorio; degradado a una columna
< 1100 px vigente, FR-005 de la 011).

**Project Type**: plugin de WordPress (PHP puro en servidor + JS de cliente sin build).

**Performance Goals**: cero requests nuevos (el autoguardado y la carga de recursos son los vigentes);
`pintarCapas` agrupada O(n) sobre la lista vigente; menu contextual con un unico nodo reutilizado (sin
recrear DOM por apertura); misma fluidez de gestos vigente (60 fps).

**Constraints**: ES5 (sin optional chaining ni metodos modernos); selectores delegados estables
(contrato `contracts/editor-panel.md`); **no** sumarse al handler de confirm de navegacion
(`$(document).on('click', ..., '.ec-acordeon > summary')`, mockups.js:2460) → clase propia
`.ec-mk-acordeon` (R2); el editor ya vive dentro de `.ec-acordeon-mockups .ec-acordeon-cuerpo`
(mockups.js:27).

**Scale/Scope**: 19 FR / 8 US; archivos tocados: `assets/mockups.js`, `assets/admin.css`,
`admin/ayuda.php`, `tests/mockup-contrato.test.js`, `personalizador-pdf.php` (version 4.23.0);
auditoria de fases del arnes; sin archivos nuevos de codigo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio, sesion por item, `_pmu_pdf_slugs`, snapshot `manifest.pdfs[]` | **PASS** — el rediseno es UI de la consola del admin (la herramienta que CREA los mockups); no toca la ficha, el carrito, la validacion, el snapshot ni la promocion a pedido (FR-018/019) |
| G2 | §II Arquitectura modular: un dueno por dato y por ruta | **PASS** — sin modulo nuevo; la UI del editor sigue en `assets/` (cliente); `PMU_Uploads` sigue unica duena de `uploads/pmu/` (sin endpoints nuevos, sin escritura nueva); `PMU_Sesion` no se toca |
| G3 | §III Render en navegador + inyeccion server-side; PHP nunca evalua JS | **PASS** — el cambio es 100 % cliente (DOM/canvas); el unico PHP tocado es la cabecera de version (cache-bust); el render de texto sigue siendo TextMuy en el navegador |
| G4 | §IV Estructura PMU: `uploads/pmu/`, JSON solo ahi, sin tablas, escritura atomica | **PASS** — cero archivos de datos nuevos, cero ambitos nuevos; `config.json` mismo formato (FR-017); nada nuevo bajo `uploads/pmu/` |
| G5 | §V No backward compatibility (desarrollo controlado, sin migraciones) | **PASS** — sin migraciones (coherente con §V); los mockups vigentes abren igual porque el formato no cambia |

**Sin violaciones** → `Complexity Tracking` vacio. Re-check post-design (tras research/data-model/
contratos): **PASS** — el data-model confirma cero entidades de almacenamiento nuevas y el contrato de
UI solo documenta la superficie de selectores prometida a los tests.

## Project Structure

### Documentation (this feature)

```text
specs/031-editor-mockups-panel/
├── spec.md                 # 8 US + FR-001..019 + SC-001..007 + D1-D8
├── plan.md                 # este archivo (/speckit-plan)
├── research.md             # Fase 0 (R1-R8)
├── data-model.md           # Fase 1 (entidades de UI; sin datos nuevos)
├── quickstart.md           # Fase 1 (validacion end-to-end en el lab)
├── contracts/
│   └── editor-panel.md     # Fase 1: superficie de UI prometida (selectores/markup)
├── checklists/
│   └── requirements.md     # de /speckit-specify
└── tasks.md                # Fase 2 (/speckit-tasks - NO creado aqui)
```

### Source Code (repository root)

```text
personalizador-pdf.php
└── cabecera Version: 4.22.6 -> 4.23.0 (cache-bust del editor; unica fuente de version)

assets/
├── mockups.js                # el unico JS tocado (editor autocontenido)
│   ├── estado.zoom: 2 -> 1                                 (R7)
│   ├── plantilla(): layout nuevo (transformacion bajo el
│   │   lienzo; 5 acordeones a la derecha)                  (R8)
│   ├── pintarCapas(): agrupacion visual por capa.grupo +
│   │   seccion "Sin grupo" (el orden z de datos no cambia) (R1)
│   ├── pintarGrupos(): acordeon por grupo de placeholder +
│   │   instancias dentro; importador se muda aca           (R4)
│   ├── pintarProps(): logica intacta; el contenedor
│   │   .ec-mk-panel-props se muda al panel izq             (R8)
│   ├── modulo de menu contextual (nodo unico .ec-mk-menu-ctx,
│   │   role=menu, cierre por fuera/Esc/scroll)             (R2)
│   ├── puntoRotacionCapa(): clip radial compartido dibujo +
│   │   hit-test (paridad con el grupal)                    (R6)
│   └── dibujarSeleccion()/tiradorEn(): usan puntoRotacionCapa
├── admin.css                 # grid con min-width del izq, .ec-mk-acordeon,
│                             # .ec-mk-menu-ctx, bloque de transformacion
└── (admin.js, mockup-render.js, mockup-geometria.js, tienda.js: SIN cambios)

admin/
├── ayuda.php                 # seccion "Editor de mockups" (31-57): menu
│                             # contextual, atajos, acordeones, recorte de
│                             # grupos grandes (FR-016)
└── pdfs.php                  # SIN cambios (el acordeon que hospeda el editor ya existe)

tests/
├── mockup-contrato.test.js   # checks de estructura actualizados a la nueva
│                             # superficie (R5); los de geometria intactos se quedan
├── mockup-geometria.test.js  # SIN cambios (geometria pura intacta)
└── texto_puente.php          # fases mockups*/mockup_capas/mockup_pagina/
                              # mockup_preview: auditoria de anclas (R5); sin
                              # cambio de logica esperado

specs/031-editor-mockups-panel/
└── (artifacts de este plan)
```

**Structure Decision**: se conserva la estructura vigente del repo: el editor sigue siendo **un solo
archivo cliente** (`assets/mockups.js`, ~2500 lineas, markup en `plantilla()` + delegacion de handlers),
la geometria pura en `mockup-geometria.js` (sin tocar) y el render compartido en `mockup-render.js`
(sin tocar). **No se crea archivo de codigo nuevo**: el menu contextual y los acordeones son funciones
dentro de `mockups.js` + reglas en `admin.css`. Justificacion: extraer el menu contextual a otro JS
obligaria a un segundo `<script>` con su orden de carga y cache-bust, sin ganancia de testing (el
contrato Node indexa el unico archivo); el repo ya consolida todo el editor en uno. Los acordeones
usan clase propia `.ec-mk-acordeon` (estilo compartido con `.ec-acordeon` de la consola) para **no**
disparar el confirm de navegacion con cambios sin guardar (mockups.js:2460 atrapa
`.ec-acordeon > summary`).

## Complexity Tracking

> **Sin violaciones**: el Constitution Check paso G1-G5 antes de Phase 0 y se mantiene PASS tras el
> diseno (research/data-model/contratos). Esta tabla queda vacia intencionalmente.
