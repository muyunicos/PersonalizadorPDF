# Implementation Plan: Editor de Mockups — vista previa integrada y ayuda contextual

**Branch**: `049-editor-mockups-preview` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/049-editor-mockups-preview/spec.md`

## Summary

Mejoras en la consola de administración (pestaña PDFs) del plugin Personalizador PDF, sin tocar el flujo del comprador ni TextMuy. Tres bloques: (A) el editor de mockups pasa a ser un acordeón propio "Editor de mockups" con la descripción movida a un icono de ayuda "?" en la cabecera; (B) el recuadro de vista previa del acordeón Placeholders monta el motor de carga/recorte real (CargadorPMU + SelectorPMU) adaptado al grupo, con contenido distinto por instancia, flechas ‹ › para alternar, y previsualización unificada por tipo (imagen/texto/futuro); (C) el interruptor "Ver texto real" se renombra "Alternar PH" y refleja el contenido de la vista previa del grupo. El recorte/receta por instancia alimenta el "Procesar PDF" de PRUEBA del admin (salida de muestra), que NO se entrega al comprador. Enfoque: reutilizar infraestructura existente (`apiPreview`/`montarCargador` en `assets/admin.js`, `CargadorPMU`, `SelectorPMU`, `PMUMockup`, store `cfg.previews`); el recorte por instancia se compone en el navegador y el Motor solo inyecta PNGs (PHP no evalúa JS).

## Technical Context

**Language/Version**: PHP 7.4+ (hosting PHP 8.x) + JavaScript de navegador (ES5, jQuery) para el admin.

**Primary Dependencies**: WordPress + WooCommerce; `assets/cargador-pmu.js`, `selector-pmu.js`, `visor-pmu.js`, `mockup-render.js`, `mockup-geometria.js`, `campo-montar.js`; `engine/` (PHP puro, GD+WebP).

**Storage**: `uploads/pmu/pdfs/{nombre}/` (`analisis.json` inmutable + `config.json` editable); muestra idempotente en `uploads/pmu/tmp/muestras/{nombre}/`. Sin tablas custom.

**Testing**: `node --check`, `node tests/mockup-contrato.test.js`, `mockup-geometria.test.js`, `campos-contrato.test.js`, `selector-contrato.test.js`, `php -l`, `php tests/motor_smoke.php`, `php tests/texto_puente.php <fase>`, lab `node tests/aplanado.browser.js`.

**Target Platform**: Consola admin de WordPress (escritorio), hosting compartido; JS en el navegador del admin.

**Project Type**: Plugin WordPress (frontend admin JS + backend PHP puro).

**Performance Goals**: No bloquear la edición; alternar instancias y repintar sin recargar; 0 POST al navegar instancias ya cargadas.

**Constraints**: Sin Python/Node en runtime; PHP no evalúa JS; un dato un dueño; no alterar datos del comprador ni `modules/textmuy/`; EOL mixto (anclas de una línea).

**Scale/Scope**: Consola de un PDF con N grupos y M instancias; sin impacto en el flujo de compra.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I (WooCommerce, no negocable)**: PASS. No toca ficha/carrito/pedido; el "Procesar PDF" de muestra ya existe y no genera entregable del cliente.
- **II (Arquitectura modular)**: PASS. Reutiliza `PMU_Uploads`/`Metadata` como dueños; sin módulos nuevos.
- **III (Render navegador + inyección server-side)**: PASS. El recorte por instancia se compone en el navegador; el Motor solo inyecta PNGs; PHP nunca evalúa JS.
- **IV (Estructura de datos)**: PASS. `analisis.json` inmutable; `config.json` editable; muestra idempotente en `tmp/muestras/`.
- **V (Sin compatibilidad retro)**: PASS. Sin migraciones.
- **Server/Storage**: PASS. PHP puro + GD/WebP; JSON en `uploads/pmu/`.

Sin violaciones; no requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/049-editor-mockups-preview/
├── plan.md              # Este archivo
├── research.md          # Phase 0 (decisiones)
├── data-model.md        # Phase 1 (entidades)
├── quickstart.md        # Phase 1 (validación)
├── contracts/
│   └── preview-placeholder.md   # Contrato de la vista previa por grupo
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
admin/
└── pdfs.php                 # Acordeón "Editor de mockups" + icono "?"; data-cont/data-campo en .ec-panel-grupo
assets/
├── admin.js                 # Monta CargadorPMU por grupo, flechas ‹›, unificación por tipo, onRecorte -> preview
├── mockups.js               # "Alternar PH"; resolverCapa usa la fuente del preview; repintado
├── admin.css                # .ec-ayuda-icon; estilos de flechas y vista previa
└── (reutiliza) cargador-pmu.js, selector-pmu.js, visor-pmu.js, mockup-render.js
personalizador-pdf.php       # Bump de versión (cache-bust de estáticos)
tests/
├── mockup-contrato.test.js  # Actualizar asserts de texto a intención
├── campos-contrato.test.js  # Verificar contrato de montaje
└── aplanado.browser.js      # Usa .ec-acordeon-mockups (se conserva)
```

**Structure Decision**: Se mantiene la estructura vigente (consola en `admin/pdfs.php` + JS en `assets/`), sin archivos de código nuevos: las piezas son funciones dentro de `admin.js`/`mockups.js` y reglas en `admin.css`. Reutiliza `CargadorPMU`/`SelectorPMU`/`PMUMockup` y el store `cfg.previews` existentes.

## Complexity Tracking

Sin violaciones de Constitución; no aplica.
