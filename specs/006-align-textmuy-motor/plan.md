# Implementation Plan: align-textmuy-motor

**Branch**: `main` (sin rama de feature: no hay hook `before_plan` registrado) | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-align-textmuy-motor/spec.md`

---

## Summary

Alinear el cliente del editor (repositorio `textmuy`) y el plugin con el contrato unico ya documentado: un solo responsable de la verdad de almacenamiento en `PMU_Uploads` (rutas, catalogos, altas/bajas/ediciones, unico `handle_request()`), con `PMU_Galeria` conservada como ayudante puro de miniaturas (celdas, composicion del `thumbs.webp`, validacion de `webp`, saneo; sin rutas propias ni catalogos ni dispatcher), raiz unica `uploads/pmu/` con ambitos `fonts` / `img` / `tm-presets` (catalogos `fonts.json` / `img.json` / `presets.json`), puente `textmuy-bridge` (`urls` + `nonces` + inventarios) como unico acceso del editor, operaciones de escritura por `POST` al endpoint unico con `op` (`listar`, `alta`, `baja`, `editar`, `sprite`, `miniatura`), purga total del codigo y las rutas heredadas, y documentacion con un solo valor por dato. Decisiones y alternativas en [research.md](./research.md); entidades en [data-model.md](./data-model.md); contratos en [contracts/](./contracts/); recorrido de validacion en [quickstart.md](./quickstart.md).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: PHP 8.5.4 (plugin, sin dependencias nativas: PHP puro) + JavaScript client-side del editor (Canvas 2D/WebGL, sin build en el servidor).

**Primary Dependencies**: WordPress + WooCommerce (ultimas versiones); endpoints `admin-post.php`; el modulo del editor se consume via iframe same-origin (`modules/textmuy/index.html` para edicion, `render-core.html` para render headless).

**Storage**: Archivos en `uploads/pmu/` (datos del administrador, no versionados): catalogos JSON por ambito + archivos fisicos + un sprite `thumbs.webp` por ambito. Sin bases de datos adicionales. Raiz unica: `uploads/pmu/`; ambitos del editor: `fonts/` (`fonts.json`), `img/` (`img.json`), `tm-presets/` (`presets.json` + `{nombre}.txm`).

**Testing**: Plugin: `php -l` (todos los PHP), `php tests/motor_smoke.php` (SMOKE OK), `php tests/parity.php` (PARIDAD OK). Modulo: `node --check js/*.js` + las 10 suites Node (`catalog-unified`, `fonts-catalog`, `img-refs`, `preset-cache`, `preset-delta`, `preset-load`, `distort-engine`, `flag-wave`, `pattern-block-box`, `controls-init`).

**Target Platform**: Hosting compartido del servidor del sitio (procesamiento server-side en PHP) + navegador del administrador (editor client-side).

**Project Type**: Plugin WordPress (PHP) + modulo frontend autocontenido (repo hermano `textmuy`, con `AGENTS.md` y constitucion propios v3.1.0).

**Performance Goals**: Restauracion completa de los recursos del editor en instalacion limpia en menos de 2 minutos con una sola copia de carpeta (SC-006); recorrido principal (subir imagen + guardar estilo + procesar un grupo) sin errores al primer intento (SC-008).

**Constraints**: Sin dependencias nativas; las escrituras solo ocurren por el endpoint unico con credencial por operacion; el editor se niega a operar sin puente (sin modos alternativos ni datos locales de respaldo); cero legado: sin migraciones ni compatibilidad con datos o codigo anteriores.

**Scale/Scope**: 3 ambitos del editor (`fonts`, `img`, `tm-presets`) con inventarios de 11+ estilos y recursos vigentes; 20 operaciones consecutivas sin duplicados ni residuos (SC-002); 16 requisitos funcionales, 8 criterios de exito, 7 entidades.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitucion del plugin v1.0.0 (`.specify/memory/constitution.md`) + constitucion del modulo v3.1.0 (repo `textmuy`, ya alineada a este plan):

| Principio | Veredicto | Justificacion |
|---|---|---|
| I. Integracion WooCommerce (NON-NEGOTIABLE) | Pasa | No se toca el flujo de pedidos: el procesado de grupos con texto estilizado sigue consumiendo el motor PDF existente (`engine/`), que no cambia en esta feature. |
| II. Arquitectura modular (verdad unica + delegacion) | Pasa | La feature es exactamente esto: `PMU_Uploads` como unico dueno del almacenamiento, con `PMU_Galeria` conservada como ayudante puro de miniaturas (sin rutas propias). La duplicacion de verdad desaparece (R1). |
| III. Prioridad server-side | Pasa | La generacion final del PDF sigue server-side (PHP); el editor solo renderiza PNGs de grupo en el navegador, como hoy. Sin cambios de reparto. |
| IV. Estructura de directorios (PMU) | Pasa | Raiz unica `uploads/pmu/` con `fonts/`, `img/`, `tm-presets/` y los catalogos vigentes `fonts.json` / `img.json` / `presets.json` (R2). Se purga la carpeta duplicada y la raiz anterior (R8). |
| V. Sin retrocompatibilidad | Pasa | Sin migraciones ni fallbacks: entradas heredadas se rechazan con causa accionable (R7); las carpetas anteriores se borran (spec, Assumptions). |
| Restricciones: sin nativas, JSON en `uploads/pmu/`, sin BD extra | Pasa | Todo sigue en JSON versionado junto a los archivos fisicos; sin dependencias nuevas. |
| Workflow: tests tras cambios, contratos claros | Pasa | Puertas obligatorias al cierre (R10): `php -l`, smoke, parity, `node --check` + 10 suites, busqueda de control y recorrido integrado del quickstart. |
| Governance (documentar primero) | Pasa | Este plan + research + contratos documentan el cambio antes de implementarlo; `/speckit-tasks` generara las tareas despues. |

**Re-check post-diseno (Fase 1)**: los contratos (`motor-resources.md`, `bridge-editor.md`, `catalog-schema.md`) y el modelo de datos respetan todos los principios: responsabilidad unica (II), raiz unica (IV), cero legado (V) y seguridad por capacidad + credencial por operacion. Sin violaciones que justificar: **Complexity Tracking no aplica**.

## Project Structure

### Documentation (this feature)

```text
specs/006-align-textmuy-motor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── motor-resources.md   # Endpoint unico, whitelist, operaciones, errores
│   ├── bridge-editor.md     # Puente postMessage sistema ↔ editor
│   └── catalog-schema.md    # Esquema de catalogo y sprite por ambito
├── checklists/
│   └── requirements.md  # Validacion del spec (16/16, previa a este plan)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
```text
personalizador-pdf/              # Plugin (repo actual)
├── personalizador-pdf.php       # Registro: endpoint unico, purga de handlers/ayudantes heredados
├── inc/
│   ├── class-pmu-uploads.php    # Dueno unico del almacenamiento (rutas/catalogos/ops/handle_request)
│   └── class-pmu-galeria.php    # Ayudante puro de miniaturas (celdas/sprite/webp/saneo; sin rutas)
├── admin/
│   ├── estilos-texto.php        # Puente: desde el motor unico, 3 momentos
│   └── ayuda.php                # Documentacion interna coherente (un valor por dato)
├── assets/
│   ├── miniaturas.js            # Cliente de miniaturas: solo op=sprite/miniatura del motor
│   ├── admin.js                 # Procesado: consume recursos vigentes
│   └── admin.css                # (sin cambios previstos)
├── engine/                      # Motor PDF: SIN CAMBIOS en esta feature
├── modules/
│   └── textmuy/                 # Modulo (repo hermano): cliente al contrato unico, purga de respaldo
├── tests/                       # Puertas: motor_smoke.php, parity.php
├── AGENTS.md                    # Correccion de los 2 puntos contradictorios
├── readme.txt                   # Coherencia con el contrato vigente
└── uploads/pmu/                 # Datos (no versionados): fonts/ img/ tm-presets/ pdfs/ orders/ tmp/

modules/textmuy/                 # Repo hermano textmuy (constitucion v3.1.0, plan propio T006-T019)
└── js/                          # preset-manager.js, catalog.js, api.js, fonts.js, galeria.js...
```

**Structure Decision**: estructura existente en ambos repos, sin piezas nuevas y sin eliminar piezas. El plan modifica el plugin (verdad unica en `PMU_Uploads` + `PMU_Galeria` como ayudante de miniaturas + puente + purga + docs) y dirige el cliente del editor hacia su propio plan de trabajo ya desglosado (T006-T019 en `here/specs/002-galeria-engine/tasks.md`), fijando aca el resultado esperado via contratos.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica: sin violaciones (ver Constitution Check y su re-check post-diseno).
