# Implementation Plan: Lectura rapida de la biblioteca del comprador

**Branch**: `042-biblioteca-lectura-rapida` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-biblioteca-lectura-rapida/spec.md`

## Summary

La biblioteca del comprador deja de pagar el arranque completo de WordPress en cada lectura. El listado,
las miniaturas y las fotos (incluidas las ranuras de la re-edicion) se sirven por un **camino liviano sin
WordPress** (`media.php` + `inc/class-pmu-lectura.php`) que solo lee `uploads/pmu/` y resuelve la identidad
con las cookies que el navegador ya tiene: `pmu_sid` (invitado) y `pmu_uid` (cliente, firmada). El listado
incluye hasta 10 miniaturas embebidas y una `revision` + `identidad`; con la misma revision la reapertura
no hace ninguna solicitud dentro de la ventana de frescura de 5 min. Las escrituras siguen en `admin-post.php` con nonce/capacidad. Si el camino
liviano falta, falla o la identidad no coincide, el cliente usa el endpoint actual como respaldo. Se
supersede la D19 de la 030 (heredada por la 040) **solo para lecturas**; el endpoint actual se conserva.

## Technical Context

**Language/Version**: PHP 7.4+ (runtime 8.x en Hostinger) + JavaScript ES5 de los assets. Sin transpilador, sin Node ni Composer en runtime.

**Primary Dependencies**: WordPress + WooCommerce; GD con WebP (requisito vigente); `PMU_Uploads`/`PMU_Sesion` existentes. Sin librerias nuevas ni servicios externos.

**Storage**: archivos en `uploads/pmu/` (`uploads.json` por identidad, `{id}.{ext}` y `{id}-80x80.webp`). Nuevo `uploads/pmu/.media/config.json` (runtime, privado: base + secreto) y `.media/.htaccess`. El navegador guarda solo metadatos y miniaturas en `localStorage` (`pmu_bib_v3`). Las lecturas no abren la base de datos.

**Testing**: `php tests/media_lectura.php` (nuevo, CLI sin WP), `php tests/catalogo_uploads.php` (paridad del lector), `php tests/sin_lectura.php`, `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php` en todas las fases de `AGENTS.md` §9 (una por proceso), `node tests/biblioteca-contrato.test.js`, `node tests/ficha-pedido.browser.js` (lab, Playwright), `php -l` (plugin, `admin/`, `engine/`, `inc/`) y `node --check`.

**Target Platform**: Hostinger Business (LiteSpeed/Apache con `.htaccess`), PHP 8.x, HTTPS, navegadores modernos con almacenamiento local.

**Project Type**: plugin de WordPress con assets JS propios (single project).

**Performance Goals**: primera apertura con 10 fotos en <1 s (p95); reapertura sin cambios dentro de la ventana de frescura (5 min) con **0 solicitudes** y <100 ms; 0 arranques de la aplicacion administrativa por lectura; lista ≤60 KB; miniaturas ≤20 KB; item con 6 fotos de ranura <1 s (p95).

**Constraints**: las lecturas no arrancan WordPress; identidad por cookie (`pmu_sid`/`pmu_uid` firmada); alcance limitado a la carpeta de fotos del comprador; el camino actual queda como respaldo; sin dependencias nativas; sin formato de datos nuevo; escrituras con nonce/capacidad intactas; `.htaccess` respetado.

**Scale/Scope**: hasta 10 fotos visibles por tira, N fotos por identidad y 6 fotos por item de re-edicion; sitio con cualquier volumen de pedidos/clientes; sin recorridos globales.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (constitucion / proyecto) | Estado |
|---|---|
| I. WooCommerce Integration (NON-NEGOTIABLE) | **PASS** — no cambia el ciclo del pedido ni la entrega; solo se acelera la lectura de fotos. |
| II. Modular Architecture | **PASS** — `PMU_Lectura` es un **ayudante puro interno** de `PMU_Uploads` (mismo patron que `PMU_Galeria`, §II): sin rutas, sin catalogo propio, sin dispatcher y sin escritura; `PMU_Uploads` sigue siendo el **dueno unico** de `uploads/pmu/` (rutas, catalogos, altas/bajas) y delega en el ayudante la lectura/miniatura. `PMU_Media` es el modulo de config/cookies/URLs. |
| III. Render en navegador + inyeccion server-side | **PASS** — no se toca el render de texto, la receta ni el Motor. |
| IV. Directory Structure (PMU) | **PASS** — `.media/` es un directorio de configuracion privado y regenerable dentro de `uploads/pmu/`; no es un ambito con catalogo; las fotos siguen en `tmp/`/`orders/`. |
| V. No Backward Compatibility Requirement | **PASS** — no hay migracion; el camino actual se conserva como respaldo. |
| Server Environment (PHP puro, Hostinger) | **PASS** — PHP + GD WebP; `media.php` no arranca WordPress; sin dependencias nativas. |
| Data Storage (JSON en `uploads/pmu/`, escritura atomica) | **PASS** — el config se escribe atomico; las lecturas no escriben. |
| Un dato, un dueno | **PASS** — `uploads/pmu/`: `PMU_Uploads` (con `PMU_Lectura` como ayudante interno de lectura); config/cookies: `PMU_Media`. `media.php` solo consume el ayudante en modo lectura y no escribe. |
| Jerarquia documental | **PASS** — este plan, `research.md`, `data-model.md`, contratos y quickstart; se actualiza `AGENTS.md` en la implementacion. |
| Validation | **PASS** — las puertas se listan en `quickstart.md`. |

**Propiedad del catalogo**: `PMU_Lectura` NO es un segundo dueno ni un modulo con dispatcher: es un
**ayudante puro de lectura** de `PMU_Uploads` (mismo patron que `PMU_Galeria` en la constitucion §II:
sin rutas, sin catalogo propio, sin escritura). `PMU_Uploads` conserva la propiedad de
rutas/catalogos/altas/bajas y delega en el ayudante; `media.php` lo consume solo-lectura porque no
puede arrancar WordPress. No hay un segundo escritor.

**Nota de governance**: la feature **supersede** la D19 de la 030 (heredada por la 040; endpoint unico `admin_post` para
lecturas) y la D14 de la 030 en cuanto a nonce por lectura. El endpoint actual **se mantiene** como respaldo y para
todas las escrituras; el trade-off de seguridad esta documentado en la spec. No es una violacion de la
constitucion (que no fija el mecanismo de autorizacion de lecturas), pero si un desvio de una decision
cerrada de 040: queda registrado en Complexity Tracking.

**Re-check post-design (Fase 1)**: **PASS** — el contrato de `media.php` no sirve entregables, manifiestos,
ideas ni PDFs; el catalogo sigue siendo el de la 040; el endpoint no escribe; el fallback reproduce la
lista actual; no se agregan dependencias ni se toca `engine/`.

## Project Structure

### Documentation (this feature)

```text
specs/042-biblioteca-lectura-rapida/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones, mediciones y alternativas
├── data-model.md        # Fase 1: entidades, validaciones y transiciones
├── quickstart.md        # Fase 1: guia de validacion end-to-end
├── contracts/
│   ├── media.md         # Contrato del endpoint liviano de lectura
│   └── cliente-biblioteca-rapida.md  # Contrato del cliente (cache, revision, fallback)
├── spec.md
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
personalizador-pdf.php             # hooks: pmu_uid, ficha (rapido/revision/identidad), fallback
media.php                          # entrypoint de lectura sin WP: ping/listar/imagen/miniatura
inc/
├── class-pmu-lectura.php          # ayudante puro de lectura de PMU_Uploads: catalogo, revision, miniaturas, guards
├── class-pmu-media.php            # config/secreto, cookies y URLs (WP)
├── class-pmu-uploads.php          # delega catalogo/miniaturas a PMU_Lectura
└── class-pmu-sesion.php           # sin cambios de escritura
assets/
├── biblioteca-pmu.js              # fast path + fallback + cache v3 + revision + thumb_data
├── tienda.js                      # urls de ranura fast + invalidar tras subir
├── cargador-pmu.js                # fallback de imagen si aplica
└── selector-pmu.js                # sin cambios salvo el fallback de imagen
uploads/pmu/.media/                # config.json + .htaccess (runtime; NO versionado)
tests/
├── media_lectura.php              # nuevo, CLI sin WP
├── catalogo_uploads.php           # paridad del lector
├── texto_puente.php               # fases biblioteca/ficha/red_carga
├── biblioteca-contrato.test.js
└── ficha-pedido.browser.js
```

**Structure Decision**: se mantiene la estructura del plugin. Se agrega un unico entrypoint de lectura
(`media.php`) y dos clases: `PMU_Lectura` (ayudante puro interno de `PMU_Uploads`, compartido con `media.php` solo-lectura) y `PMU_Media`
(configuracion, cookies y URLs en WordPress). No se agregan capas al Motor ni se mueve ningun dato: las
fotos siguen en `uploads/pmu/tmp|orders`.

## Complexity Tracking

> **Nota**: no hay violaciones de la constitucion; se registran los desvios de decisiones cerradas de la 040.

| Desvio | Por que se necesita | Alternativa mas simple rechazada |
|-----------|------------|-------------------------------------|
| Entrypoint `media.php` fuera de `admin-post` (supersede D19/D14 de la 030, heredadas por la 040) | El bootstrap de WordPress cuesta ~0,9-1,1 s en caliente y hasta ~4 s en frio; con 8 fotos la apertura hace 9 arranques | `plugins_loaded`, `admin-ajax` o una ruta front-end siguen cargando WordPress (~0,9 s); un archivo estatico publico viola la privacidad |
| Lecturas por cookie bearer, sin nonce | El nonce exige WordPress y la credencial de identidad ya esta en el navegador | Mantener el nonce es el camino actual (queda como fallback); firmar cada URL suma secretos en la URL y no evita el arranque |
| `uploads/pmu/.media/config.json` con base + secreto | El endpoint sin WordPress necesita la ruta y el secreto sin abrir la base de datos | Guardarlo en la carpeta del plugin (untracked/deploy) o en la base (`SHORTINIT`, mas lento); `wp-config` exige intervencion manual |
| Miniaturas embebidas (hasta 10) | Evita una solicitud por miniatura | Un endpoint batch agrega una solicitud; un sprite es mas complejo; archivos publicos violan la privacidad |

Sin violaciones de la constitucion. Las filas anteriores son desvios deliberados de decisiones cerradas
de la 040, justificados por la medicion y aceptados en la spec.
