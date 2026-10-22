# Implementation Plan: Biblioteca de imagenes del comprador (spec 030)

**Branch**: `030-biblioteca-imagenes` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-biblioteca-imagenes/spec.md`

## Summary

El comprador puede **ver y reusar** todas las fotos que ya subio (sesiones vigentes + compras) **sin
crear un almacen nuevo**: la galeria es una **vista** sobre `tmp/sesion-{sid}/*/subidas/` y
`orders/{order}/{item}/`, filtrada por identidad (cookie `pmu_sid` para invitados; cuenta +
`_pmu_sid` de los line items para registrados, con el vinculo que ya da Woo).

El reuso es por **receta**: si la composicion no cambia la fila **referencia** el archivo
(`origen: ref`, 0 bytes); si cambia, se guarda una **version** `{madre}-{n}`. **Sin consolidacion (D11)**:
cada item guarda su copia y la fila `ref` apunta al **archivo de origen** del item donde se subio:
el ahorro es **entre pedidos** (N compras con la misma foto = **1** archivo); si ese origen desaparece, el hueco sale **transparente** con causa `motor:descarga:ref:ausente` (nunca un PDF roto). **El Motor no se toca.**

## Technical Context

**Language/Version**: PHP 7.4+ (objetivo Hostinger Business, PHP 8.5.4) + JavaScript de navegador (sin build)

**Primary Dependencies**: WordPress + WooCommerce — hook `woocommerce_guest_session_to_user_id` (8.8.0+,
con fallback `wp_login`); sin librerias nuevas; sin tocar `modules/textmuy/`

**Storage**: archivos en `uploads/pmu/` (sin tablas custom y sin ambito nuevo). El `revision` de la
respuesta y la `receta` se **calculan** (no se guarda ningun indice). Cache del cliente en
`sessionStorage`/`localStorage` con **metadatos, nunca bytes**

**Testing**: `php tests/texto_puente.php biblioteca` (fase nueva) + `node tests/selector-contrato.test.js`
+ `php -l`, `motor_smoke.php`, `parity.php`, `sin_lectura.php`

**Target Platform**: WordPress — frente (ficha de producto, cuenta) y consola del plugin

**Project Type**: plugin de WordPress (PHP puro en servidor) + componentes JS de cliente

**Performance Goals**: primera apertura de la biblioteca **<= 1,5 s con 300 pedidos**; aperturas
siguientes **0 requests** (revalidacion por `revision` -> `sin_cambios`)

**Constraints**: sin `exec` ni Node en produccion; escritura **atomica** de manifests; el servidor
**nunca** evalua JS, **nunca** confia en rutas del cliente y **recomputa** los hashes que decide
(mismo patron que `hash_pool()`)

**Scale/Scope**: 2 PHP tocados (plugin + `PMU_Sesion`) + 5 JS (biblioteca, visor, selector, cargador, tienda) + 1 fase de arnes + 1 suite Node; **tope de 10 contenedores** por consulta

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio, sesion por item, `_pmu_pdf_slugs`, snapshot `manifest.pdfs[]` | **PASS** — la 030 **solo lee** de Woo (`wc_get_orders`, `customer_id`, `_pmu_sid`): no toca la ficha, la validacion del carrito, el mockup ni el snapshot |
| G2 | §II Arquitectura modular: un dueno por dato y por ruta | **PASS** — rutas por `PMU_Uploads`; logica de item/familia en `PMU_Sesion`; endpoint en la clase del plugin; **sin modulo nuevo** |
| G3 | §III Render en navegador + inyeccion server-side; PHP nunca evalua JS | **PASS** — no hay render nuevo; el servidor **recomputa** la `receta` desde los parametros declarados (igual que `hash_pool()`) y no evalua codigo del cliente |
| G4 | §IV Estructura PMU: `uploads/pmu/`, JSON solo ahi, sin tablas, escritura atomica, limpieza por ITEM | **PASS con enmienda planificada** — se agrega las filas `origen: ref` que apuntan al archivo de origen, las familias `{madre}-{n}` en `subidas/` y las filas `origen: ref`. El TTL sigue siendo **por ITEM**, nunca por archivo suelto |
| G5 | §V Sin retrocompatibilidad ni migraciones | **PASS** — sin migracion: los archivos actuales se leen como familias sin versiones (D5) |
| G6 | Technical Constraints: PHP puro, sin dependencias nativas, Node solo para testing | **PASS** — solo PHP + JS de navegador |
| G7 | Development Workflow / Validation: puertas del repo | **PASS** — fase `biblioteca` del arnes + checks en `selector-contrato`; `php -l`, smoke y parity en verde |

Sin violaciones que justificar (ver `Complexity Tracking`). **Enmienda a §IV a registrar** al implementar
(Sync Impact Report de `constitution`): las convenciones de `subidas/` (familias `{madre}-{n}`) y `origen: ref`, sin cambio estructural.

**Re-check post-Fase 1 (2026-10-21)**: PASS — el diseno de Fase 1 (`research.md`, `data-model.md`, los dos
contratos y `quickstart.md`) no agrega modulos, ambitos, tablas ni dependencias, y mantiene la unica
enmienda planificada de §IV (familias `{madre}-{n}` + `origen: ref`, sin cambio estructural).

## Project Structure

### Documentation (this feature)

```text
specs/030-biblioteca-imagenes/
├── spec.md                        # 28 decisiones + 9 clarificaciones
├── plan.md                        # este archivo
├── research.md                    # Fase 0 (R1-R12)
├── data-model.md                  # Fase 1
├── contracts/
│   ├── biblioteca.md              # contrato del endpoint (ops, filas, consolidacion, errores)
│   └── cliente-biblioteca.md      # contrato del cliente (cache, tira, visor, Elegir/Subir)
├── quickstart.md                  # Fase 1 (validacion end-to-end)
└── tasks.md                       # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
personalizador-pdf.php
├── handle_biblioteca()            # NUEVO: endpoint unico con op= (listar|imagen|usos|usar|borrar)
├── biblioteca_identidad()         # NUEVO: cookie + cuenta (+ vinculo)
├── vinculo_sid_usuario()          # NUEVO: hook woocommerce_guest_session_to_user_id + fallback
└── item_generar_pdfs()            # resolver origen: ref (hoy `!is_file` saltea en silencio, linea 2621)

inc/class-pmu-sesion.php
├── fila_subida() / guardar_subida()      # madre, base, receta, sha (bytes ANTES de convertir a WebP)
├── resolver_ref($dir_item, $ref)         # NUEVO: relativo al item, dentro de uploads/pmu/
├── usar_de_biblioteca()                  # NUEVO: copia desde tmp / referencia desde orders / versiona

├── borrar_familia_dir($dir, $madre)   # NUEVO: original + versiones, con el aviso de usos
├── mutar_manifest_dir($dir, $cb)         # NUEVO: variante por DIRECTORIO (orders/ no resuelve por sid)
└── limpiar_ttl()                         # drafts 24 h + sesiones sin items + carrito abandonado 30 dias

inc/class-pmu-uploads.php


assets/
├── visor-pmu.js                   # NUEVO: visor fullscreen COMPARTIDO (PMUVisor), extraido de cargador-pmu.js (D28)
├── biblioteca-pmu.js              # NUEVO: copia por cliente en localStorage, revalidada por revision (el TTL es del nonce de las URLs) + tira (las que caben en el ancho; tope 10)
├── selector-pmu.js                # contenedor de la tira en el modal + "Elegir" (fuente elegida) vs "Subir"
├── cargador-pmu.js                # ranura: receta del hueco + usa PMUVisor (deja de duplicar el visor)
└── tienda.js                      # op=usar (params de composicion) + PMU_FICHA.biblioteca

tests/
├── texto_puente.php               # fase `biblioteca`
└── selector-contrato.test.js      # tira, visor, Elegir/Subir por receta, cache
```

**Structure Decision**: se conserva la estructura del repo (plugin + `inc/` + `assets/` + `tests/`): la 030
no crea modulos, ambitos ni catalogos. No hay lugar nuevo en disco: las familias
viven dentro del ambito `orders` ya existente.

El unico archivo cliente nuevo es `assets/biblioteca-pmu.js` y se justifica: **la cache debe ser unica por
pagina y compartida por todos los campos** (D23, tu pedido de "por campo con cache y rapido"), y la tira +
el visor de biblioteca tienen una fuente de datos distinta de la del visor de la ranura (`cpmu-visor`, que
muestra lo cargado en ese hueco y permite reemplazar). Con la decision revisada (D28) el visor **si** se extrae: `assets/visor-pmu.js` (`PMUVisor`) lo comparten
la ranura y la biblioteca, y las URLs se resuelven **una sola vez** (`PMU_FICHA.urls`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sin violaciones constitucionales: la 030 no agrega modulos, ambitos, tablas ni dependencias; extiende el
las convenciones de `subidas/` (familia/version/`ref`) en la enmienda de §IV.
