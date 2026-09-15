# Implementation Plan: Layout PMU de PDFs y contenido por grupo en metadata

**Branch**: `007-pmu-pdf-layout` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-pmu-pdf-layout/spec.md`

## Summary

Unificar los datos del PDF en la estructura que ya define la Constitucion (IV) y el motor `PMU_Uploads`: cada producto PDF vive en `uploads/pmu/pdfs/{nombre}/` con **solo** `{nombre}.pdf` + `metadata.json`, donde `metadata.json` pasa a ser la unica fuente de la personalizacion por grupo (campos planos `default`/`value`/`preset`/`config` con clave `id` = color hex). Desaparecen los estados derivados: `textos.json` (se funde en la personalizacion), los PNGs de placeholder (se representan como marco y se generan al vuelo al descargar) y las carpetas `imagenes/` + `salidas/` del panel (las muestras van a `uploads/pmu/tmp/muestras/{pdf}/` con sobrescritura; los borradores y lineas del carrito a `tmp/cart/{linea}/`; el staging a `tmp/orders/{order_id}/` y los resultados confirmados por linea a `uploads/pmu/orders/{order_id}/{pdf}/`). Se elimina la raiz heredada `uploads/personalizador-pdf/` del codigo (con una migracion unica, no destructiva y explicitamente justificada por FR-015) y se blinda la consola del admin para que ningun fallo de recursos del motor (catalogos, rutas, permisos, concurrencia) derive en un `500`: causa visible en pantalla y operacion que continua.

## Technical Context

**Language/Version**: PHP 8.5.4 (hosting Hostinger Business, Constitucion) en el servidor; JavaScript sin bundler en el modulo TextMuy (solo si se toca, fuera de alcance aqui).

**Primary Dependencies**: WordPress (hooks `admin_post_*`, nonces, `wp_upload_dir()`, `wp_mkdir_p`, `wp_json_encode`), clases propias `Personalizador_PDF_Plugin`, `PMU_Uploads`, `PMU_Galeria` y motores `engine/*`. Sin dependencias nativas obligatorias (GD opcional); sin Node ni Python en el servidor.

**Storage**: Archivos en `uploads/pmu/` (JSON + binarios), sin base de datos adicional: `pdfs/{nombre}/{nombre}.pdf` + `metadata.json` (producto), `tmp/muestras/{pdf}/` (muestras del panel, idempotentes), `tmp/cart/{linea}/` + `manifest.json` (borradores y lineas), `tmp/orders/{order_id}/` (staging), `orders/{order_id}/{pdf}/` (resultado por linea confirmada), `{fonts,img,tm-presets}/` (recursos del editor, sin cambios).

**Testing**: PHP CLI: `php -l` (plugin, `admin/`, `engine/`, `inc/`), `php tests/motor_smoke.php`, `php tests/parity.php`, `php tests/texto_puente.php` (fases, cada una en su proceso). Los fixtures viven en `uploads/pmu/pdfs/` (dato del administrador).

**Target Platform**: Plugin WordPress self-hosted (Hostinger Business, PHP 8.5.4) con panel de administracion; navegador moderno solo para el editor de estilos.

**Project Type**: Plugin WordPress: backend PHP puro + consola de administracion + modulo frontend aislado en iframe (`modules/textmuy/`).

**Performance Goals**: subir y analizar un PDF sin escribir PNGs de placeholder (menos I/O y menos archivos); render de la consola sin recorrer arboles grandes (listar carpetas de `pdfs/`); placeholder servido en 1 request generado al vuelo (sin estado en disco); catalogos leidos/escritos sin bloqueos cruzados.

**Constraints**: PHP puro y sin procesos externos; escrituras de catalogo atomicas; nada de fallbacks de compatibilidad salvo la migracion unica de FR-015; mensajes, variables e interfaz en español sin tildes en codigo; nada de datos generados dentro de la carpeta del plugin.

**Scale/Scope**: Decenas de PDFs por instalacion; hasta decenas de grupos por PDF (clave `id` hex); imagenes por grupo <= 10 MB; consola con 1 PDF seleccionado a la vez.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. WooCommerce Integration (NON-NEGOTIABLE)**: PASA. Los resultados de pedidos reales se escriben en `uploads/pmu/orders/{order_id}/` (FR-012) y el PDF base queda vinculable por carpeta (`pdfs/{nombre}/`, con espacio para `mckp.json` de la spec 004).
- **II. Modular Architecture**: PASA. Todas las rutas se resuelven por el motor unico `PMU_Uploads` (FR-013); `PMU_Galeria` no cambia (ayudante puro sin rutas propias); los motores `engine/*` conservan su responsabilidad y solo `Metadata`/plugin ajustan nomenclatura.
- **III. Server-Side Processing Priority**: PASA. La generacion del PDF sigue 100% en servidor; el unico trabajo de cliente es el render de texto del modulo TextMuy, ya previsto en el contrato del puente (el PNG viaja al servidor como imagen del grupo).
- **IV. Directory Structure (PMU)**: PASA y es el objeto de la feature. `pdfs/` con un producto por carpeta y sus datos; `orders/` para resultados; `tmp/` para pruebas y muestras; `fonts/`, `img/`, `tm-presets/` intactos.
- **V. No Backward Compatibility Requirement**: PASA con una excepcion explicita y justificada: la migracion unica de datos de la raiz heredada `uploads/personalizador-pdf/` -> `pdfs/{nombre}/` (FR-015). Razon: en produccion hay PDFs subidos y analizados por el administrador; moverlos evita perdida de trabajo. No se agrega ningun fallback de codigo: el codigo nuevo solo conoce el layout vigente y la migracion corre una sola vez, sin sobreescribir destinos.

**Resultado del gate**: sin violaciones. `Complexity Tracking` queda sin filas; la excepcion de V se documenta con su alternativa rechazada en `research.md`.

## Project Structure

### Documentation (this feature)

```text
specs/007-pmu-pdf-layout/
├── plan.md              # Este archivo (/speckit-plan)
├── spec.md              # Especificacion de la feature
├── research.md          # Fase 0: decisiones y alternativas
├── data-model.md        # Fase 1: entidades y reglas
├── quickstart.md        # Fase 1: recorrido de validacion
├── contracts/           # Fase 1: contratos de datos y de UI/endpoints
│   ├── metadata-pdf.md
│   ├── contenido-grupo.md
│   ├── admin-pdfs.md
│   └── rutas-pmu.md
└── tasks.md             # Fase 2 (/speckit-tasks, NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
personalizador-pdf.php          # Clase principal: rutas (via PMU_Uploads), handlers,
                                #   personalizacion por grupo en metadata, placeholder al vuelo,
                                #   migracion unica, guards de render
admin/
├── page.php                    # Pestanas (sin cambios)
├── pdfs.php                    # Consola: grupos desde metadata, marco en vez de <img>,
│                               #   avisos de recursos, formularios de contenido
├── estilos-texto.php           # Sin cambios (ya captura excepciones del motor)
└── ayuda.php                   # Texto actualizado al layout vigente
assets/
├── admin.css                   # Marco (div) del placeholder
└── admin.js                    # Envio de contenido por grupo / preview
engine/
├── Metadata.php                # generar() con `contenido`, nomenclatura de rutas relativas
├── PngWriter.php               # Reutilizado para la descarga al vuelo (sin persistir)
├── Detector.php                # Sin cambios de comportamiento
├── Overlay.php                 # Sin cambios de comportamiento
├── Pdf.php                     # Sin cambios
├── Imagen.php                  # Sin cambios
└── Motor.php                   # Sin cambios (recibe rutas resueltas)
inc/
├── class-pmu-uploads.php       # Rutas del motor (pdfs/{nombre}, tmp/{muestras,cart,orders}, orders/{order_id}/{pdf}),
│                               #   escritura atomica y lectura tolerante de catalogos
└── class-pmu-galeria.php       # Sin cambios
tests/
├── motor_smoke.php             # Sin cambios (fixture muestra.pdf)
├── parity.php                  # Sin cambios (oraculo de deteccion)
└── texto_puente.php            # Rutas del entorno aislado al layout nuevo + fases
                                #   de contenido en metadata, placeholder al vuelo y 500
uploads/pmu/                    # DATOS DE USUARIO (sin git)
├── pdfs/{nombre}/{nombre}.pdf + metadata.json (+ mckp.json de la spec 004)
├── pdfs/muestra.pdf            # Fixture de tests, ignorado por el selector
├── tmp/muestras/{pdf}/         # Muestras del panel (se sobrescriben)
├── tmp/cart/{linea}/           # Borradores y lineas activas del carrito (+ manifest.json, TTL)
├── tmp/orders/{order_id}/      # Staging de pedidos en preparacion
├── orders/{order_id}/{pdf}/    # Resultado final por linea confirmada
├── orders/{order_id}/          # Resultados de pedidos completados
└── {fonts,img,tm-presets}/     # Recursos del editor (sin cambios)
```

**Structure Decision**: Se conserva la estructura de plugin unico del repositorio (backend PHP + consola admin + modulo en iframe). La feature **no crea carpetas nuevas en el codigo ni en el plugin**: reescribe el mapa de rutas de la clase principal para que delegue en `PMU_Uploads` (Const. II) y alinea los datos de usuario al arbol que ya declara la Constitucion (IV), reutilizando `uploads/pmu/{pdfs,tmp,orders}`. `engine/` mantiene responsabilidades; solo `Metadata.php` (nomenclatura del dataset y campos de
personalizacion plano) y `PngWriter.php` (uso al vuelo) se tocan, sin cambiar el algoritmo de
deteccion ni de inyeccion.

## Constitution Check (post-diseño)

Re-evaluado tras Fase 1 con los artefactos generados (data-model, contratos, quickstart): siguen
pasando los cinco principios, sin violaciones nuevas.

- **I**: los resultados de pedidos quedan en `uploads/pmu/orders/{order_id}/` (data-model, Resultado de pedido).
- **II**: `PMU_Uploads` es el unico dueno de rutas (contrato `rutas-pmu.md`) y no se crea ningun modulo ni clase nueva.
- **III**: el PDF se genera siempre en servidor; el unico cliente que participa es el render de texto ya previsto.
- **IV**: el arbol de datos del data-model coincide con lo declarado en la Constitucion (`pdfs/{nombre}/` con sus datos, `orders/`, `tmp/`, recursos del editor intactos).
- **V**: la unica compatibilidad agregada es la migracion unica de FR-015, documentada en `research.md` (D7) con alternativa rechazada.

`Complexity Tracking` sigue sin filas: no hay violaciones que justificar.

## Complexity Tracking

> Sin violaciones del Constitution Check: la tabla queda vacia.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

Excepcion documentada de la Constitucion V (no es violacion de arquitectura): la migracion unica `uploads/personalizador-pdf/` -> `uploads/pmu/pdfs/{nombre}/` (FR-015). **Alternativa rechazada**: exigir la re-subida manual de cada PDF y descartar el analisis existente; se descarta porque en produccion ya hay un PDF analizado (2 grupos, 15 instancias) y el administrador perderia ese trabajo sin beneficio tecnico. **Alcance**: una sola pasada, sin sobreescribir destinos, dejando la raiz heredada intacta como respaldo; el codigo nuevo no lee nunca mas esa raiz.

## Phase 0 / Phase 1

- **Fase 0** ([research.md](./research.md)): decisiones sobre el esquema del grupo (id = color hex sin `#`, campos planos `default`/`value`/`preset`/`config`); destinos de trabajo (muestras `tmp/muestras/{pdf}/` idempotentes, lineas `tmp/cart/{linea}/` con `manifest.json` y `pmu_hash`, staging `tmp/orders/{order_id}/`, entregable `orders/{order_id}/{pdf}/` por rename); promocion solo por pago confirmado (spec 004); alcance y disparo de la migracion; nuevos accesos de rutas en `PMU_Uploads`; escritura atomica y lectura tolerante de catalogos; generacion de PNG al vuelo sin GD; limpieza (muestras al borrar PDF, lineas al quitarlas, TTL en cart/staging); preservacion de la personalizacion al re-analizar; documentacion con un solo valor por dato.
- **Fase 1** ([data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)): entidades PDF, Grupo, Personalizacion, Aplicados y Resultado con reglas y transiciones; contratos de `metadata.json`, de la personalizacion del grupo (`default`/`value`/`preset`/`config`), de la consola `admin/pdfs.php` y del mapa de rutas del motor; recorrido de validacion ejecutable de punta a punta.
- **Fase 2** (`/speckit-tasks`): `tasks.md` ordenado por historia (no lo genera este comando).