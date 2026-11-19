# Implementation Plan: Catalogo de uploads y biblioteca por carpetas

**Branch**: `040-catalogo-uploads` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/040-catalogo-uploads/spec.md`

## Summary

La biblioteca del comprador deja de construirse leyendo manifiestos de items y recorriendo el arbol de
pedidos. Pasa a listarse desde **una carpeta por identidad** (`tmp/sesion-{sid}/uploads/` para el
invitado; `orders/{uid}/uploads/` para el cliente, adonde se **migra** la sesion anonima en el login),
con un **catalogo por carpeta** (`uploads.json`: ids, medidas, fecha, ultimo uso y recetas por contexto)
y **miniaturas 80x80 cover** pre-renderizadas al subir. La lectura de una imagen o su miniatura se
resuelve por `id` en tiempo constante. El borrado se separa en dos acciones: **quitar del campo** (solo
quita la referencia) y **borrar desde la galeria** (consulta referencias en carrito/pedidos, pide
confirmacion si las hay y elimina archivo + miniatura + entrada).

## Technical Context

**Language/Version**: PHP 7.4+ (runtime 8.x en Hostinger) + JavaScript ES5 (assets del plugin).

**Primary Dependencies**: WordPress + WooCommerce; GD con WebP (requisito); zlib. Sin Composer ni Node
en runtime.

**Storage**: JSON en `uploads/pmu/` (constitucion, Data Storage): `uploads/uploads.json` por ambito y
`uploads/{id}-80x80.webp`. Escritura atomica (`.tmp` + `rename`), lectura tolerante.

**Testing**: `php tests/texto_puente.php biblioteca`, `node tests/biblioteca-contrato.test.js`,
`node tests/fotos-contrato.test.js`, `php tests/sin_lectura.php`, `php tests/motor_smoke.php`,
`php tests/parity.php`, PHPStan nivel 4 sobre `engine/`.

**Target Platform**: Hostinger Business (hosting compartido, solo PHP). El bundle del cotizador
(`calculadora` -> tema) no cambia con esta feature.

**Project Type**: plugin de WordPress con assets JS propios (single project).

**Performance Goals**: abrir la biblioteca con 10 imagenes en <300 ms (SC-001), independiente del
historial de terceros; una sola solicitud de listado por apertura (SC-002).

**Constraints**: el listado no puede leer manifiestos ni pedidos ajenos (FR-002); no se publican rutas
crudas (FR-013); el catalogo es dato derivado y reconstruible (FR-006); miniaturas <20 KB (SC-004).

**Scale/Scope**: hasta 10 miniaturas visibles por tira; catalogos del tamano de las fotos del comprador
(decenas), no del sitio. Sin cambios en el Motor (`engine/` intacto).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (constitucion) | Estado |
|---|---|
| Hostinger: PHP puro, sin Python/Node/`exec()` en runtime | **PASS** — solo PHP + JS de navegador |
| Datos JSON unicamente en `uploads/pmu/` | **PASS** — `uploads.json` y miniaturas viven ahi |
| Catalogos: escritura atomica (`.tmp` + rename), lectura tolerante | **PASS** — se aplica al catalogo |
| Un dato, un dueno | **PASS** — `PMU_Uploads` escribe/lee el catalogo; `PMU_Sesion` lo invoca |
| El Motor no renderiza texto / no se toca `engine/` | **PASS** — sin cambios en `engine/` |
| Jerarquia documental | **PASS** — se enmienda `AGENTS.md` §5 y `docs/decisiones.md` |
| GD + WebP requisito | **PASS** — miniaturas con GD (degradacion al original) |

Sin violaciones: no se requiere justificacion en Complexity Tracking.

**Re-check post-design (Fase 1)**: **PASS** — el modelo de datos y el contrato mantienen el JSON en
`uploads/pmu/`, la escritura atomica y ninguna dependencia nueva; no aparece ninguna ruta publica del
catalogo.

## Project Structure

### Documentation (this feature)

```text
specs/040-catalogo-uploads/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/uploads-catalogo.md
├── spec.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
personalizador-pdf.php          # listar/imagen/miniatura/borrar + rutas protegidas
inc/class-pmu-uploads.php       # catalogo (leer/guardar/reconstruir) + miniatura 80x80
inc/class-pmu-sesion.php        # invoca el catalogo (dueno: PMU_Uploads) desde el ciclo: subida, receta, migracion y borrado
assets/biblioteca-pmu.js        # pide el listado (dedupe en vuelo) y pinta la tira
assets/cargador-pmu.js          # quitar del campo = solo local; borrar desde la galeria
assets/selector-pmu.js          # params desde el catalogo
tests/texto_puente.php          # fase biblioteca (+ nuevas aserciones)
tests/biblioteca-contrato.test.js
tests/fotos-contrato.test.js
```

**Structure Decision**: se mantiene la estructura actual del plugin; no se agregan capas ni archivos de
motor. El unico formato nuevo es el catalogo dentro de los ambitos de `uploads/`.

## Complexity Tracking

Sin violaciones de la constitucion. Nota de alcance: esta feature **supersede** la 039 D3 (borrado en el
acto desde el visor del campo) y retira el escaneo de contenedores de la ruta de lectura.