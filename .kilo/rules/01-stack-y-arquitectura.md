# 01 — Stack y arquitectura

Plugin **Personalizador PDF** para WordPress (motor 100% PHP) + módulo frontend **TextMuy**
integrado. Tema sibling `muyunicos` (otro repo) y datos de usuario en `uploads/pmu/`.

## Lenguajes y runtime
- **PHP >= 7.4** (hosting compartido Hostinger Business: SOLO PHP, sin Node/Python/exec/Composer en runtime).
  En desarrollo: PHP 8.5.x, Node 22 (solo tests), Composer/PHPStan (dev).
- **JavaScript de navegador** (Canvas 2D + WebGL, PDF.js local) en `assets/` y `modules/textmuy/`.
- **PowerShell 7 (`pwsh`)** es el shell canónico. No usar sintaxis bash/cmd.

## Estructura de carpetas (repo = carpeta del plugin)
- `personalizador-pdf.php` — clase principal WP, menús, handlers, ciclo carrito→pedido, puente TextMuy.
- `media.php` — lectura sin WordPress (spec 042).
- `admin/` — consola WP (pdfs, campos, estilos-texto, pedidos, test, ayuda).
- `engine/` — MOTOR PHP PURO: `Pdf`, `Detector`, `Metadata`, `PngWriter`, `Imagen`, `Overlay`, `Motor`, `Compositor`.
- `inc/` — dueño único de datos: `PMU_Uploads`, `PMU_Lectura`, `PMU_Media`, `PMU_Galeria`, `PMU_Sesion`.
- `assets/` — JS/CSS del plugin; núcleo compartido `mockup-render.js`, `campo-montar.js`, `selector-pmu.js`.
- `modules/textmuy/` — repo git propio (`muyunicos/textmuy`); se edita aquí pero commitea/pushea ALLÍ; bump `?v=RCn` al tocar su JS.
- `tests/` — arneses CLI PHP (`php tests/*.php`) y suites Node (`node tests/*.test.js`) + browser (Playwright).
- `specs/` — specs y contratos; `docs/` — docs internas; `scripts/` — utilidades (verificar-deploy.ps1).

## Patrones clave
- **Datos fuera del plugin**: todo lo del admin/comprador vive en `uploads/pmu/` (gitignored). Sin contenido de fábrica.
- **Un dueño por dato**: `PMU_Uploads` (rutas/catálogos), `PMU_Sesion` (ciclo comprador), `Metadata` (dataset).
- **Sin duplicados**: un solo render de mockup (`mockup-render.js`) y una sola lógica de montaje de campos (`campo-montar.js`).
- **El Motor NO renderiza texto**: el navegador rasteriza; la vista previa es el PDF final.
- **Jerarquía documental**: `constitution` > `AGENTS.md` > resto. Leer `AGENTS.md` completo antes de cambios arquitectónicos.