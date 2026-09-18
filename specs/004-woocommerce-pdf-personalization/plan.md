# Implementation Plan: Personalización de Productos PDF para WooCommerce

**Branch**: `004-woocommerce-pdf-personalization` | **Created**: 2026-09-13 | **Reescrito**: 2026-09-17

**Spec**: [spec.md](spec.md) | **Norma**: `constitution` §I+§IV (decisiones 2026-09-17)

## Summary

Cerrar el ciclo comprador del plugin: mockups del admin (editor embebido 300x300 con capas
y filtros), "Vista previa" del cliente que rellena la sesion del item (pool PNG dedicado +
webp congelados), `add-to-cart` como visto bueno, promocion por `rename()` al pago y
descarga por lista Woo nativa con render cliente + Motor. Todo el estado vive en
`uploads/pmu/` y se mueve dentro de un unico directorio por item
(`tmp/sesion-{sid}/{item_key}/` -> `tmp/orders/{order_id}/{item_key}/` -> `orders/...`).

## Technical Context

**Language/Version**: PHP 8.5.4 (servidor, sin dependencias nativas) + JavaScript
client-side en el navegador (Canvas 2D + WebGL, modulos del repo, sin bundler).

**Primary Dependencies**: WordPress + WooCommerce (hooks `woocommerce_*`, `postmeta`,
`wp_upload_dir`, nonces); clases propias `Personalizador_PDF_Plugin`, `PMU_Uploads`,
`PMU_Galeria`; motores `engine/*`; modulo `modules/textmuy/` (integrado, control total).

**Storage**: archivos bajo `uploads/pmu/` (raiz unica, sin tablas custom):
`pdfs/{nombre}/{nombre}.pdf` + `analisis.json` (inmutable) + `config.json` (editable:
`activo`/`productos`/`campos_ids`/`preview_omisible`/`mockups[]`/`placeholders[id]`) +
`pdfs/{nombre}/mockups/` (fotos del admin) + `campos.json` (catalogo global) +
`tmp/muestras/{pdf}/` (panel) + `tmp/sesion-{sid}/{item_key}/` (`manifest.json` +
pool `img/{pdf}-{id}-{n}.png` + `mockup-{id}.webp`) + `tmp/orders/{order_id}/{item_key}/`
(staging) + `orders/{order_id}/{item_key}/` (entregable).

**Testing**: PHP CLI: `php -l` (plugin, admin, engine, inc) + `php tests/motor_smoke.php`
(SMOKE OK) + `php tests/parity.php` (PARIDAD OK) + `php tests/texto_puente.php` fases
(una por proceso) + fase nueva `conciliacion`. Node (solo si se toca el modulo):
`node --check js/*.js` + 10 suites. Manual: panel WP real (mockups, ficha, pago, Descargas).

**Target Platform**: Hostinger Business (PHP 8.5.4) + navegador moderno del cliente.

**Project Type**: Plugin WordPress (backend PHP + consola admin + modulo frontend en iframe
same-origin `modules/textmuy/`).

**Performance Goals**: vista previa lista <5 s tras pulsar (render paralelo de N mockups
300x300); PDF final <10 s tras pagar (pool ya generado, sin re-render); consola sin 500.

**Constraints**: PHP puro sin procesos externos; PHP nunca evalua JS; escrituras atomicas
(`.tmp` + `rename`); mensajes/variables/interfaz en español sin tildes en codigo; ningun
dato generado dentro de la carpeta del plugin; zero-backward-compat (Const. V) salvo la
migracion ex-008 pendiente.

**Scale/Scope**: decenas de PDFs; hasta decenas de grupos por PDF; N mockups/capas sin
limite (los administra el admin); imagenes sin limite de peso (se guarda la version
recortada al tamaño indicado por campo/PDF). Modelo de relaciones: un PDF puede asociarse a
multiples productos; un producto puede tener multiples PDFs; un PDF puede tener multiples
mockups y multiples campos; los campos se comparten entre PDFs de un mismo producto (un
campo produce resultados distintos por PDF y los mockups reflejan esas diferencias). El
comprador agrega 1 item por personalizacion (cantidad fija 1); ese item abarca 1..N PDFs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I (WooCommerce)**: el plan implementa mockup obligatorio/omisible, PDF final solo tras
  el pago, lista de descargas nativa, registro admin "completados" y vínculo por
  `postmeta _pmu_pdf_slug`. Sin violaciones.
- **II (Arquitectura modular)**: no se crean clases nuevas de almacenamiento: rutas y
  operaciones siguen en `PMU_Uploads` (`inc/class-pmu-uploads.php`); el render de mockup
  vive en el modulo `modules/textmuy/`. Sin violaciones.
- **III (Render navegador + inyeccion server-side)**: mockup y texto se renderizan en el
  navegador; el Motor solo inyecta PNGs ya renderizados. Sin violaciones.
- **IV (Directory Structure)**: todas las rutas del plan coinciden con §IV (`analisis.json`
  + `config.json`, `tmp/sesion-{sid}/{item_key}/`, `orders/{order_id}/{item_key}/`).
  Sin violaciones.
- **V (No backward compatibility)**: unica excepcion admitida, la migracion ex-008 ya
  normada (partir ex-`metadata.json`, mover legacy `tmp/cart/`). Sin violaciones nuevas.

`Complexity Tracking`: sin filas (no hay violaciones que justificar).

## Project Structure

### Documentation (this feature)

```text
specs/004-woocommerce-pdf-personalization/
├── plan.md              # Este archivo
├── research.md          # Decisiones y alternativas
├── data-model.md        # Entidades, layout y manifest
├── quickstart.md        # Recorrido de validacion (US1..US5)
├── contracts/           # selector-pmu.md, sesion-item.md, mockups.md
├── checklists/requirements.md
├── _archivo-tasks-2026-09-13.md   # Tasks historicas (diseño derogado)
└── tasks.md             # Tareas por historia (norma 2026-09-17)
```

### Source Code (repository root)

```text
personalizador-pdf/                  # Plugin (repo actual)
├── personalizador-pdf.php           # Hooks Woo, handlers, puente TextMuy
├── admin/
│   ├── page.php                     # Pestanas: PDFs | Campos | Estilos | Ayuda
│   ├── pdfs.php                     # Consola: PDF, grupos, mockups, Procesar, completados
│   ├── campos.php                   # Catalogo global de campos (nuevo)
│   ├── estilos-texto.php            # Iframe del modulo TextMuy
│   └── ayuda.php                    # Documentacion interna
├── assets/
│   ├── admin.css                    # Consola + editor de mockups
│   ├── admin.js                     # Validaciones y puente RenderCore
│   ├── tienda.js                    # Ficha: campos, Vista previa, galeria, carrito
│   └── mockups.js                   # Editor de capas 300x300 (delegado al modulo)
├── engine/                          # Motor PDF: sin cambios de algoritmo
├── inc/
│   ├── class-pmu-uploads.php        # Dueno unico de rutas/catalogos/ops
│   ├── class-pmu-galeria.php        # Ayudante puro de miniaturas
│   └── class-pmu-sesion.php         # (NUEVO) sesion del comprador: sid/item/pool/manifest
├── modules/textmuy/                 # Modulo integrado: render texto + modo mockup (?v=RCn)
├── tests/                           # motor_smoke, parity, texto_puente (+ conciliacion)
└── uploads/pmu/                     # Datos (no versionados)
```

**Structure Decision**: se conserva la estructura de plugin unico. La unica pieza nueva de
codigo es `inc/class-pmu-sesion.php` (ciclo del comprador: `sid`, item, pool y manifest),
porque `PMU_Uploads` es el dueno de rutas/catalogos (Const. II) pero la sesion del
comprador es un ciclo de vida con reglas propias (mover, congelar, TTL). El resto extiende
piezas existentes (`personalizador-pdf.php` hooks Woo, `admin/pdfs.php` seccion mockups,
`assets/tienda.js`, `modules/textmuy/` modo mockup).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

Sin violaciones del Constitution Check. Nota de arquitectura (no es violacion): se agrega
`inc/class-pmu-sesion.php` como modulo de ciclo de vida del comprador; `PMU_Uploads`
conserva la propiedad de rutas y delega en el. Alternativa rechazada: meter toda la logica
de sesion en `PMU_Uploads` (mezclaria el almacenamiento de recursos del admin con el ciclo
transitorio del carrito, hoy responsabilidades separadas).

## Phase 0 / Phase 1 (artefactos de esta reescritura)

- **Fase 0** ([research.md](./research.md)): decisiones sobre mockups (capas, filtros,
  subset de placeholders, editor embebido), flujo de vista previa (boton + paralelo +
  regeneracion parcial), sesion unica que se mueve (`sid` cookie 30 dias), pool dedicado
  numerado, `preview_estado` y tolerancia a fallos, descargas por lista Woo nativa,
  cantidad fija 1 y `unique_key`.
- **Fase 1**: [data-model.md](./data-model.md) (entidades PDF/Grupo/Campo/Mockup/Item/
  Pedido + layout y manifest), [contracts/](./contracts/) (`selector-pmu.md`,
  `sesion-item.md`, `mockups.md`) y [quickstart.md](./quickstart.md) (recorrido US1..US5 +
  matriz de fallos).
- **Fase 2** ([tasks.md](./tasks.md)): tareas por historia (US1..US5) con rutas exactas.
