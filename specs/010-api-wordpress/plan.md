# Implementation Plan: api-wordpress

**Branch**: `main` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-api-wordpress/spec.md`

## Summary

Hoy el plugin solo personaliza PDFs por dos caminos internos: la consola de administración
(`handle_procesar`, sesión admin + nonce) y el ciclo del comprador en WooCommerce (render del
cliente → pool de PNG → `Motor::procesar_pedido()`). Ninguno sirve a un sistema externo, que es el
uso principal declarado del producto. Este plan agrega un **tercer camino**: un endpoint HTTP único
`admin_post_pmu_api` con dispatcher `op=` que recibe el nombre de un PDF ya subido y un archivo
rasterizado por cada grupo de color, y devuelve la URL del PDF editado. La decisión que define el
diseño es que **el servidor no renderiza texto**: si el consumidor necesita texto estilizado, lo
rasteriza en su navegador y lo envía como la imagen del grupo, de modo que la API respeta la
constitución §III sin enmendarla y no requiere Node ni un TextMuy headless en el hosting. La API
reusa `Motor::procesar()` **con** dataset (validación estricta de ids: un grupo inexistente es un
error, no un hueco silencioso), resuelve toda ruta con `PMU_Uploads` como dueño único de
`uploads/pmu/`, y entrega en un ámbito nuevo `uploads/pmu/api/{job_id}/` con manifiesto, purga por
TTL (7 días por defecto) e idempotencia por `job_id`. Autenticación por Application Passwords del
núcleo + `manage_options` + HTTPS. Respuesta síncrona. Sin rutas REST y sin un segundo camino de
escritura sobre los catálogos del editor.

## Technical Context

**Language/Version**: PHP 7.4+ mínimo (objetivo Hostinger PHP 8.5.4). Sin JavaScript nuevo: la
API es exclusivamente server-side.

**Primary Dependencies**: WordPress **≥ 5.6** (por Application Passwords; hoy `readme.txt` declara
5.0) + WooCommerce (presente, pero la API **no** lo usa ni lo requiere). Piezas internas:
`engine/Motor.php` (`procesar()`), `engine/Imagen.php` (`normalizar()`), `inc/class-pmu-uploads.php`
(dueño único de `uploads/pmu/`).

**Storage**: archivos planos en `uploads/pmu/api/{job_id}/` = `manifest.json` (escritura atómica
`.tmp` + `rename` vía `escribir_json`) + pool `img/` + `{pdf}_procesado.pdf`. Sin tablas en base de
datos (constitución §IV).

**Testing**: `php -l` (plugin, `admin/`, `engine/`, `inc/`), `php tests/motor_smoke.php`,
`php tests/parity.php`, `php tests/texto_puente.php` con **fases nuevas** para la API (una por
proceso), y `smoke_checks()` en el sitio real. Sin `node --check` ni suites del módulo: la API no
toca `modules/textmuy/` ni la constitución del módulo.

**Target Platform**: hosting compartido con **HTTPS obligatorio** + WordPress; el consumidor es un
backend propio (ERP, intranet o tienda), no un navegador.

**Project Type**: plugin para WordPress "Personalizador PDF" con un endpoint HTTP propio
(`admin_post.php?action=pmu_api&op=`) y autenticación por Application Password.

**Performance Goals**: PDF de referencia (`circulo6cm.pdf`, 2 grupos) en **< 10 s** (objetivo
heredado de la spec 004); las validaciones 1–8 de `contracts/api.md` (todas anteriores a la
escritura) en < 200 ms; barrido de purga acotado y oportunista, no una tarea pesada por petición.

**Constraints**: sin dependencias nativas más allá de las actuales (el motor ya normaliza con GD o
con su decodificador propio); sin Node/Python en el servidor; **sin construir rutas fuera de
`PMU_Uploads`**; sin tablas; sin render de texto ni evaluación de JS; sin rutas REST; sin tocar
WooCommerce (productos, carrito, pedidos) ni cobrar.

**Scale/Scope**: 1 archivo PHP nuevo (`inc/class-pmu-api.php`) + helpers del ámbito `api` en
`inc/class-pmu-uploads.php` + enganche de los hooks en `personalizador-pdf.php` + `readme.txt`
(mínimo de WP) + fases de prueba. `engine/` **sin cambios**: `Motor::procesar()` y
`Imagen::normalizar()` ya resuelven el procesamiento y el encajado.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución del plugin: `.specify/memory/constitution.md` **v2.0.1** (jerarquía `constitution` >
`AGENTS.md` > resto). La constitución del módulo TextMuy **no aplica**: la API no toca
`modules/textmuy/`.

| Principio | Puerta de esta feature | Estado |
|---|---|---|
| I. WooCommerce Integration (NON-NEGOTIABLE) | No se toca el vínculo PDF↔producto, el mockup, la ficha ni el ciclo de compra. La API no lee ni escribe productos, carrito ni pedidos: consume el dataset de un PDF ya subido y escribe solo en su propio ámbito | ✅ Pasa |
| II. Modular Architecture | La lógica de la API vive en un módulo nuevo `PMU_Api` (espejo de `PMU_Sesion`, que ya posee el ciclo del comprador); **toda ruta y todo archivo** se resuelven con `PMU_Uploads` (dueño único), que gana los helpers del ámbito `api`. `PMU_Galeria` y `engine/` no se tocan | ✅ Pasa |
| III. Render en navegador + inyección server-side | **Es la puerta que define el diseño.** La API **no** renderiza texto ni ejecuta JS: recibe rasters ya listos (el texto con estilo lo rasteriza el consumidor) y el Motor solo los inyecta. PHP nunca evalúa JS, no se añade TextMuy headless ni Node al servidor | ✅ Pasa |
| IV. Directory Structure (PMU) | Raíz única `uploads/pmu/` respetada: se agrega el ámbito `api/{job_id}/` (manifiesto atómico + pool + entregable). Sin raíces alternativas, sin nombres paralelos y sin tablas | ✅ Pasa (nuevo ámbito, extensión de la raíz) |
| V. No Backward Compatibility | La API es una capacidad **nueva y aditiva**: no hay datos existentes que migrar, ni formato previo que leer ni fallback que conservar. Los ámbitos actuales quedan intactos | ✅ Pasa |
| Server Environment (PHP puro, sin dependencias nativas) | Cero dependencias nuevas: reutiliza `Motor::procesar()` + `Imagen::normalizar()` (que ya funcionan con GD o con su decodificador PNG propio). Solo core: JSON, `getimagesize`, I/O, `wp_cron` | ✅ Pasa |
| Data Storage (JSON, escritura atómica) | El `manifest.json` del trabajo se escribe con `escribir_json()` (`.tmp` + `rename`), igual que el resto de catálogos. La idempotencia y la purga leen ese manifiesto | ✅ Pasa |
| Validation (puertas de prueba) | Fases propias en `tests/texto_puente.php` (una por proceso, con stubs WP como las existentes) + verificación en el sitio real vía `smoke_checks()`; `php -l`, `motor_smoke` y `parity` siguen obligatorias | ✅ Pasa |
| Communication (documentar antes de implementar) | El contrato ya está escrito en `contracts/api.md` (petición, 9 pasos de validación en orden, respuestas, tabla de causas) y las decisiones D1–D5 en `spec.md` §Clarifications | ✅ Cumple |
| **"Punto único" de escritura /Communication ("endpoint único `pmu_uploads`")** | La API introduce un **segundo camino de escritura** en `uploads/pmu/`, autenticado de forma distinta (Application Password) y restringido a su ámbito `api/`. No comparte credencial, no toca catálogos del editor y no habilita `op=` del módulo, pero **amplía literalmente el principio** | ⚠️ **Pasa con enmienda planificada** (v2.0.1 → v2.1.0, MINOR: es una capacidad nueva; declarada y ejecutada como Sync Impact Report, no silenciosa) |

**Resultado pre-Phase 0**: SIN VIOLACIONES en los principios de la constitución del plugin.
**1 enmienda planificada**: declarar en la constitución que el principio de "punto único" se
refiere a los **catálogos y recursos del editor** (presets, imágenes, fuentes), y que el ámbito
`api/` constituye un segundo camino de escritura, autenticado, con su propia operación e inaccesible
al módulo TextMuy. La enmienda es una **declaración de alcance**, no un debilitamiento: se mantiene
la prohibición de que TextMuy escriba fuera de `op=` y la prohibición de escrituras directas desde el
cliente. No se requiere sección Complexity Tracking por justificación de principios; la tabla de
complejidad registra la enmienda declarada.

## Project Structure

### Documentation (this feature)

```text
specs/010-api-wordpress/
├── spec.md              # Especificación (decisiones D1–D5 cerradas)
├── plan.md              # Este archivo (/speckit-plan command output)
├── contracts/
│   └── api.md           # Contrato del endpoint: request, validación en orden,
│                        #   respuestas y tabla de causas (Phase 1)
├── research.md          # Phase 0 output (/speckit-plan) — pendiente
├── data-model.md        # Phase 1 output — pendiente (manifest.json del trabajo)
├── quickstart.md        # Phase 1 output — pendiente (puertas §1 + mapa SC→evidencia §4)
└── tasks.md             # Phase 2 output (/speckit-tasks) — pendiente
```

### Source Code (repository root)

```text
inc/
├── class-pmu-api.php        # NUEVO: dueño del endpoint. Dispatcher op=,
│                            #   autenticación (Application Password + capability +
│                            #   HTTPS), validaciones 1–8, idempotencia por job_id,
│                            #   escritura del entregable y purga por TTL. Espejo de
│                            #   PMU_Sesion: posee su ciclo, no las rutas.
└── class-pmu-uploads.php    # + helpers del ámbito `api` (dir_api, ruta_api,
                             #   manifest_api, escritura atómica): ÚNICO lugar donde
                             #   se construyen rutas hacia uploads/pmu/api/

engine/                       # SIN CAMBIOS: Motor::procesar() (con dataset) y
                              #   Imagen::normalizar() ya hacen el trabajo y el encajado
personalizador-pdf.php        # + hooks admin_post_pmu_api / admin_post_nopriv_pmu_api
                              #   y el cableado de pmucron para la purga
readme.txt                    # Requires at least: 5.0 -> 5.6 (Application Passwords)
tests/
├── texto_puente.php          # + fases api_auth | api_procesar | api_idem |
│                            #   api_limite | api_limpieza (una por proceso)
├── motor_smoke.php           # sin cambios (el motor no se toca)
└── fixtures/                 # imágenes de prueba para las fases nuevas
AGENTS.md                     # §1, §2 (mapa), §5 (ámbito api/), §7
.specify/memory/constitution.md  # Sync Impact Report v2.0.1 -> v2.1.0 (local)
```

**Structure Decision**: estructura existente, sin proyectos ni carpetas nuevas. La lógica se
reparte respetando los dueños actuales: `PMU_Uploads` sigue siendo el **único** que construye rutas
hacia `uploads/pmu/` y gana los helpers del ámbito nuevo; el nuevo `PMU_Api` posee únicamente el
ciclo del endpoint (autenticación → validación → idempotencia → escritura → purga), siguiendo el
precedente de `PMU_Sesion`, que ya posee el ciclo del comprador sin tocar rutas. `engine/` no se
modifica: la decisión D1 (raster por grupo, sin render de texto en el servidor) es justamente la que
permite reutilizar `Motor::procesar()` tal cual. El único archivo de datos nuevo es
`uploads/pmu/api/{job_id}/`, bajo la raíz única.

## Complexity Tracking

Sin violaciones que justificar. La tabla registra la **única enmienda planificada**, declarada de
forma explícita y no silenciosa:

| Enmienda | Alcance | Riesgo | Mitigación |
|---|---|---|---|
| Constitución del plugin v2.0.1 → **v2.1.0** (MINOR) | Aclarar que el "punto único de escritura" protege los **catálogos y recursos del editor** (`op=` de `pmu_uploads`), y que el ámbito `api/` es un segundo camino **autenticado por credencial distinta** y **inaccesible al módulo TextMuy** | Un segundo camino de escritura podría borrar la garantía de que el editor tiene un solo responsable de sus catálogos | Se mantiene la prohibición de escrituras directas desde el cliente y de que TextMuy escriba fuera de `op=`; la API solo escribe en `uploads/pmu/api/{job_id}/` y valida cada id contra `analisis.json` antes de escribir (0 escrituras en un rechazo) |
| `readme.txt`: `Requires at least` 5.0 → **5.6** | Application Passwords existen desde WP 5.6 | Un sitio en 5.0–5.5 perdería la API (no la instalación del plugin) | Cambio declarado en `spec.md` (FR-019) y Assumption; si el sitio corre por debajo, el endpoint responde `api:autenticacion:no_disponible` en vez de fallar en silencio |

**Nota de Phase 1**: `data-model.md` debe fijar el `manifest.json` del trabajo (campos exactos,
cálculo de `expira`, y cómo se calcula el hash que detecta el conflicto de idempotencia), y
`quickstart.md` las puertas exactas y el mapa SC→evidencia. Ambos son pendientes.