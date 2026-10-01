# Implementation Plan: galerias-sprite-unificado

**Branch**: `main` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-galerias-sprite-unificado/spec.md`

## Summary

Las tres galerías del editor (imágenes, tipografías, estilos guardados) comparten un único mecanismo: leer el inventario del ámbito + la hoja de miniaturas certificada (`thumbs.webp` validada por `thumbs.sprite_firma`) y derivar cada celda del identificador. Hoy la certificación solo existe para imágenes: `PMU_Uploads::sprite()` valida firma y dimensiones dentro de `if ($ambito === 'img')`, por lo que las hojas de `fonts` y `tm-presets` se persisten sin certificar y la lectura canónica las rechaza siempre (la galería de tipografías vuelve a etiquetas en cada F5). El plan generaliza esa certificación a los tres ámbitos en el motor, reemplaza el botón "Generar miniaturas" por generación automática de huecos en dos fases (pre-dibujado en memoria → exactamente una persistencia por ámbito y apertura, nunca parcial), define el enfoque de Google Fonts (una familia por petición, un solo peso, sin `text=`), y fija la geometría de celdas derivada de `thumbs` con contrato medible de alto. Despliegue conjunto plugin + módulo: el payload de `op=sprite` no cambia (el parámetro `firma` ya viaja); solo se amplía su validación y certificación a los tres ámbitos.

## Technical Context

**Language/Version**: PHP 7.4+ mínimo (objetivo Hostinger PHP 8.5.4) para el plugin; JavaScript ES2017+ vanilla de navegador (módulo `modules/textmuy/`, sin build ni bundler).

**Primary Dependencies**: WordPress + WooCommerce (sin cambios de integración); motor único `admin_post_pmu_uploads` con `op=`; Google Fonts CSS API v2 (`fonts.googleapis.com/css2`) como dependencia externa para previews; navegador admin moderno (FontFace, `document.fonts`, `aspect-ratio`).

**Storage**: archivos planos en `uploads/pmu/{fonts,img,tm-presets}/` (inventario JSON con escritura atómica `.tmp` + `rename`, hoja `thumbs.webp` por ámbito); sin base de datos.

**Testing**: `php -l`, `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php` (una fase por proceso); en el módulo `node --check` por archivo + las 16 suites de `modules/textmuy/tests/` (AGENTS.md §9 y constitution §Validation, sincronizados el 2026-10-01) + `tests/galerias.browser.js` con Chrome/Playwright real (variable `TEXTMUY_CHROME`).

**Target Platform**: servidor WordPress compartido (PHP puro) + panel de administración en navegador de escritorio.

**Project Type**: WordPress plugin con módulo frontend integrado (dos capas en el mismo repositorio: `inc/` + `assets/` del plugin, `modules/textmuy/` del módulo).

**Performance Goals**: apertura con hoja certificada = 0 descargas de contenido; generación completa de la galería de tipografías (72 celdas: 57 Google + 15 físicas) una sola vez con máximo aceptable 5 MB y 60 s; exactamente 1 escritura `op=sprite` por ámbito y apertura; concurrencia limitada a 4 peticiones para Google.

**Constraints**: sin dependencias PHP nativas (solo funciones core como `getimagesize`); Node solo para testing; payload del puente y del motor sin campos nuevos; sin escritura directa de archivos desde el módulo (solo `op=`); sin `localStorage` ni fallbacks client-side (constitución del módulo III/VII).

**Scale/Scope**: 3 ámbitos de galería, 3 galerías de UI, catálogo de referencia 72 fuentes / 128 imágenes / 1 preset; ~1-2 archivos PHP (`inc/class-pmu-uploads.php` principal; `inc/class-pmu-galeria.php` sin cambios esperados) + ~6 archivos JS/CSS del módulo + tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución: `.specify/memory/constitution.md` v2.0.0 (jerarquía `constitution` > `AGENTS.md` > resto).

| Principio | Puerta de esta feature | Estado |
|---|---|---|
| I. WooCommerce (NON-NEGOTIABLE) | No se toca el vínculo PDF↔producto, el mockup ni el ciclo de compra; la galería de miniaturas es insumo del editor que consume el catálogo `img/` ya existente | ✅ Pasa |
| II. Modular Architecture | Cambios solo en el dueño único de `uploads/pmu/` (`PMU_Uploads`) y en el módulo TextMuy; `PMU_Galeria` se mantiene como ayudante puro (sin rutas ni catálogos); sin nuevo dispatcher ni módulo nuevo | ✅ Pasa |
| III. Render en navegador + inyección server-side | El render de previews de tipografías ocurre en el navegador (como hoy); el motor solo persiste `thumbs.webp` ya rasterizado; PHP nunca evalúa JS | ✅ Pasa |
| IV. Directory Structure (PMU) | Las hojas permanecen en `uploads/pmu/{ambito}/thumbs.webp` junto a su inventario; inventarios con escritura atómica `.tmp` + `rename` (ya vigente en `escribir_json`); sin nuevas raíces ni nombres de inventario alternativos | ✅ Pasa |
| V. No Backward Compatibility | Las hojas sin certificar se tratan como no usables y se regeneran; sin migración ni fallback de hojas previas (decisión registrada en Assumptions del spec) | ✅ Pasa |
| Server Environment (PHP puro, sin dependencias nativas) | Solo funciones core: `getimagesize`, JSON, I/O de archivo; `es_webp` por firma binaria ya existe | ✅ Pasa |
| Data Storage (JSON en `uploads/pmu/`, escritura atómica) | La certificación `thumbs.sprite_firma` escribe en el inventario existente con `escribir_json` (atómico); la hoja se valida con `getimagesize` y tope `SPRITE_MAX_BYTES` de 4 MB (la hoja de tipografías de 720×540 px queda muy por debajo) | ✅ Pasa |
| Validation (puertas de prueba) | Se agregan casos a las suites vigentes y a `motor_smoke`/`parity`; `php -l`, `node --check` + suites y bump `?v=RCn` al tocar JS/CSS del módulo (ver `quickstart.md` §1) | ✅ Pasa |
| Communication (contrato plugin↔TextMuy) | Payload sin cambios: `op=sprite` ya envía `firma`; solo se amplía la validación/certificación server-side a `fonts`/`tm-presets`. Puente `textmuy-bridge` intacto. El cambio queda documentado aquí y en `contracts/motor-sprite.md` (constitución: "documentar cambios en la arquitectura antes de implementarlos") | ✅ Pasa |

**Resultado pre-Phase 0**: SIN VIOLACIONES. No se requiere sección Complexity Tracking por justificación de principios.
**Resultado post-Phase 1 (re-evaluación con el diseño en `research.md`, `data-model.md`, `contracts/` y `quickstart.md`)**: SIN VIOLACIONES — sin cambios respecto del chequeo previo.

- II (Modular): el diseño confirma dueños existentes (`PMU_Uploads` valida/certifica; `PMU_Galeria` sigue puro; el cliente solo consume `op=`); no se agregan módulos ni dispatchers.
- III (Render en navegador): `contracts/galeria-sprite.md` F1 dibuja cada celda en el navegador; el servidor solo persiste bytes.
- IV (Directory Structure / atomicidad): la firma se escribe con `escribir_json` (atómico) en el inventario del ámbito y la hoja respeta `SPRITE_MAX_BYTES` (4 MB); `data-model.md` fija dimensiones exactas por retícula.
- V (No backward compatibility): `data-model.md` define la hoja no certificada como no usable y regenerable; sin migración.
- Communication: `contracts/motor-sprite.md` documenta el alcance ampliado de `op=sprite` **sin campos nuevos** (constitución: documentar antes de implementar).
- Validation: `quickstart.md` §1 lista las puertas exactas (`php -l`, `motor_smoke`, `parity`, `texto_puente`, `node --check` + suites + navegador) y §4 mapea cada SC a su evidencia.




## Project Structure

### Documentation (this feature)

```text
specs/009-galerias-sprite-unificado/
├── plan.md              # Este archivo (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── motor-sprite.md
│   └── galeria-sprite.md
├── checklists/
│   └── requirements.md  # Validado 16/16 en /speckit-specify+clarify
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
inc/
├── class-pmu-uploads.php      # MOTOR: certificación de hoja generalizada a 3 ámbitos
│                              #   (sprite() valida firma+dimensiones y certifica;
│                              #    guardar_catalogo invalida firma en los 3)
└── class-pmu-galeria.php      # Ayudante puro (sin cambios esperados)

modules/textmuy/
├── css/style.css              # Geometría de celdas (.tt-galpanel-* + data-ambito)
├── js/
│   ├── api.js                 # Lectura certificada + generación por hueco (dos fases,
│   │                          #   reentrancia por ámbito, causas visibles)
│   ├── catalog.js             # geometriaTiles() (ratio normalizado) + firma
│   ├── fonts.js               # renderFontPreview() + carga Google de preview (1 familia)
│   ├── galeria.js             # Galería de imágenes/presets: auto-generación de huecos
│   ├── fuentes-galeria.js     # Galería de tipografías: sin botón, progreso, reintento
│   └── controls.js            # Galería inferior de presets (misma ruta canónica)
├── index.html / render-core.html   # bump ?v=RCn al tocar JS/CSS
└── tests/
    ├── *.test.js              # Suites Node (16 vigentes + nuevas)
    └── galerias.browser.js    # Validación DOM con navegador real

assets/
└── miniaturas.js              # ThumbEngine (solo lectura en este spec; sin cambios)

tests/                         # Pruebas del plugin (motor_smoke, parity, texto_puente)
uploads/pmu/{fonts,img,tm-presets}/   # Dato del admin (no versionado): inventarios + thumbs.webp
```

**Structure Decision**: estructura única por repo (plugin WordPress con módulo integrado), sin nuevas carpetas ni proyectos. La lógica nueva se reparte entre el dueño del almacenamiento (`inc/class-pmu-uploads.php`, validación/certificación de `op=sprite`) y el cliente de galerías (`modules/textmuy/js/api.js` como núcleo compartido por `galeria.js`, `fuentes-galeria.js` y `controls.js`). `contracts/` documenta el contrato de motor (extendido) y el de lectura/generación del cliente; los artefactos de este feature viven en `specs/009-galerias-sprite-unificado/`.

## Complexity Tracking

Sin violaciones de constitución: no se justifican excepciones (la tabla queda vacía a propósito; ver Constitution Check).


