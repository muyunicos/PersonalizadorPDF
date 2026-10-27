# Plan de implementación: Importar página/capa y reemplazar capa/grupo manteniendo transformación

**Rama**: (sin rama: el repo despliega desde `main`)
**Spec**: [spec.md](./spec.md)
**Estado**: plan (borrador), sin implementar
**Creada**: 2026-10-26

## Summary

Convertir "Importar página + PH" en un flujo que, cuando hay una capa o grupo seleccionado, pregunte al admin si reemplazar la selección y, al aceptar, reutilice la geometría (x/y/w/h/rot/sesgo) y la perspectiva de la capa destino, aplicando solo el nuevo recurso (página PDF o imagen del catálogo). Se habilita además la perspectiva por capa individual (hoy solo por grupo).

**Se conserva por construcción**: `config.json` completo (productos, campos, tienda, `preview_omisible`, `mockups[]`, `bonus`) porque no se borra la carpeta del producto.

## Technical Context

- **Lenguaje/stack**: PHP 8 (plugin WP, hosting compartido, sin dependencias nativas ni Composer en runtime) + JS ES5/jQuery en el admin. Motor PHP puro (`engine/`).
- **Almacenamiento**: archivos en `uploads/pmu/` (`PMU_Uploads` como dueño único): `pdfs/{nombre}/` (producto). Sin tablas propias.
- **Endpoints**: handlers `admin_post` de la consola con `seguridad('personalizador_pdf_*')` y respuesta **JSON** por `responder()` (patrón vigente; sin recargas, errores inline).
- **Testing**: puertas del repo (`php -l`, `node tests/mockup-contrato.test.js`, `node tests/mockup-geometria.test.js`, `php tests/motor_smoke.php`, `php tests/parity.php`) + recorrido en `C:\wp-lab`.
- **Sin nuevas dependencias**. Sin cambios en el comprador (`panel_ficha`, `tienda.js`, `PMU_Sesion`).
- **Formatos**: `config.json` **no cambia de forma** (ya soporta `perspectiva`, `grupo`, `grupo_rot`, `envoltura` por capa).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio, sesión por item, `_pmu_pdf_slugs`, snapshot `manifest.pdfs[]` | **PASS** — el cambio es UI del editor del admin: no toca la ficha, el carrito, la validación, el snapshot ni la promoción a pedido |
| G2 | §II Arquitectura modular: un dueño por dato y por ruta | **PASS** — el reuso de geometría vive en `assets/mockups.js` (cliente); `PMU_Uploads` sigue dueño único de `uploads/pmu/` (sin endpoints nuevos, sin escritura nueva); `PMU_Sesion` no se toca |
| G3 | §III Render en navegador + inyección server-side; PHP nunca evalúa JS | **PASS** — el cambio es 100 % cliente (DOM/canvas); la decisión de reemplazo es JS puro; el servidor no renderiza texto ni geometría del diseño |
| G4 | §IV Estructura PMU: `uploads/pmu/`, JSON solo ahí, sin tablas, escritura atómica | **PASS** — cero archivos de datos nuevos, cero ámbitos nuevos; `config.json` mismo formato; `mockups[].capas[]` sigue igual |
| G5 | §V No backward compatibility (desarrollo, sin migraciones) | **PASS** — sin migraciones; el formato no cambia y los mockups existentes abren igual |

**Sin violaciones** → `Complexity Tracking` vacío.

## Project Structure

### Documentación (esta spec)

```
specs/034-importar-reemplazar-capa/
├── spec.md        (US1-US4, FR-001..009, SC-001..005, D1-D4)
├── plan.md        (este archivo)
├── research.md    (R1-R8)
├── data-model.md  (entidades de presentación + invariantes)
├── contracts/
│   └── capa-importar.md   (superficie de UI + reglas R1-R7)
├── quickstart.md  (R1-R8 en el laboratorio)
└── tasks.md       (T001-T017)
```

### Código (qué se toca y qué no)

```
assets/mockups.js
├─ debeReemplazar()      NUEVO   decide si hay selección y cuál es el destino
├─ importarPagina()      1628    MODIFICADO: usa debeReemplazar() y reusa geometría
└─ (resto del editor: sin cambios)
assets/mockup-render.js  (sin cambios: dibujarItem ya aplica perspectiva por capa)
assets/admin.js, assets/admin.css  (sin cambios: no hay endpoints nuevos)
admin/pdfs.php           (sin cambios)
engine/, inc/            (sin cambios)
tests/texto_puente.php   fase `importar-reemplazar` (casos puros de la decisión)
```

**No se toca**: `engine/*`, `inc/*`, `personalizador-pdf.php`, `admin/*`, `assets/tienda.js`, `assets/campo-montar.js`, `modules/textmuy/`.

### Structure Decision

Un solo archivo de código cliente (`assets/mockups.js`) con una función pura nueva (`debeReemplazar`) y la modificación de `importarPagina()`. Sin archivos nuevos, sin endpoints, sin cambios de formato.

## Complexity Tracking

> **Sin violaciones** al Constitution Check (G1-G5 PASS).

Complejidad **intrínseca** que el diseño asume a propósito:

- **Reemplazo de grupo**: cada capa miembro mantiene su geometría relativa y el grupo su `grupo_rot`; no se reordena ni se recrea el grupo.
- **Capa individual con perspectiva**: el renderer ya la aplica (`dibujarItem`), pero la UI solo la exponía para grupos; se agrega la rama individual sin tocar la de grupo.

## Fases

- **F0 Setup**: puertas base en verde (`php -l`, CONTRATO 147, GEOMETRIA 135, `motor_smoke`, `parity`) y auditoría de anclas en las fases `mockups`/`mockup_capas`/`mockup_pagina`.
- **F1 Decisión pura**: `debeReemplazar()` (sin selección / una capa / grupo / varias sin grupo) + casos en la fase `importar-reemplazar`.
- **F2 Importar con reemplazo**: `importarPagina()` reusa la geometría del destino y solo cambia `ref` (+ `tipo: img`, `envoltura: false`, `nombre`).
- **F3 Puertas**: lint, contrato, geometría, `motor_smoke`, `parity`, fases `importar-reemplazar`/`mockups`/`mockup_capas`/`mockup_pagina`.
- **F4 Lab**: recorrido R1-R8 en `C:\wp-lab` con hashes y comparación de geometría.
- **F5 Cierre**: AGENTS §7 + `admin/ayuda.php` + `tasks.md` + bump + push (previo visto bueno).

## Dependencies & Execution Order

- **F0** (T001-T002): primero, sin dependencias.
- **F1** (T003-T004): bloquea a F2.
- **F2** (T007-T009): depende de F1.
- **F3/F4/F5**: puertas, lab y cierre; requieren todo lo anterior.
- **Regla de oro**: el contrato de la fase se actualiza **en el mismo commit** que la toca; nunca se borra cobertura sin reemplazo.

