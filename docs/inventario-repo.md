# Inventario de codigo del repositorio

> **GENERADO automaticamente** por `php tests/inventario_repo.php` — NO editar a mano.
> La semantica (responsabilidad de cada archivo) vive en `AGENTS.md` seccion 2 y en
> `modules/LEEME.md`; este reporte aporta los NUMEROS: peso, LOC, dependencias
> cruzadas y candidatos a codigo muerto. Generado: 2026-10-09 21:54.

## 1. Resumen por tipo

| Tipo | Archivos | KB |
|---|---:|---:|
| CSS | 2 | 75,7 |
| HTML | 2 | 132,2 |
| JS assets | 9 | 275,2 |
| JS modulo textmuy | 14 | 634,7 |
| JS test | 5 | 54,8 |
| JS test modulo | 39 | 240,7 |
| PHP admin | 7 | 71,6 |
| PHP entry (plugin WP) | 1 | 198,4 |
| PHP inc | 3 | 122,7 |
| PHP motor | 7 | 118,2 |
| PHP test CLI | 10 | 246,6 |
| config | 6 | 10,8 |
| doc | 114 | 1.129,2 |
| otro | 13 | 12,7 |
| **TOTAL** | **232** | **3.323,3** |

Codigo fuente (php/js/css/html): **99 archivos, 2.170,6 KB**. Docs (md/txt): 114. Config: 6.

## 2. Archivos de codigo mas pesados (top 15)

| # | KB | Ruta | Tipo |
|---|---:|---|---|
| 1 | 238,8 | `modules/textmuy/js/editor.js` | JS modulo textmuy |
| 2 | 198,4 | `personalizador-pdf.php` | PHP entry (plugin WP) |
| 3 | 168,3 | `tests/texto_puente.php` | PHP test CLI |
| 4 | 134,9 | `modules/textmuy/js/controls.js` | JS modulo textmuy |
| 5 | 130,0 | `modules/textmuy/index.html` | HTML |
| 6 | 95,3 | `inc/class-pmu-uploads.php` | PHP inc |
| 7 | 80,3 | `assets/admin.js` | JS assets |
| 8 | 63,8 | `assets/mockups.js` | JS assets |
| 9 | 57,4 | `modules/textmuy/js/fonts.js` | JS modulo textmuy |
| 10 | 52,6 | `assets/tienda.js` | JS assets |
| 11 | 48,1 | `modules/textmuy/css/style.css` | CSS |
| 12 | 39,0 | `admin/pdfs.php` | PHP admin |
| 13 | 36,4 | `modules/textmuy/js/api.js` | JS modulo textmuy |
| 14 | 31,4 | `modules/textmuy/js/preset-manager.js` | JS modulo textmuy |
| 15 | 30,0 | `engine/Pdf.php` | PHP motor |

## 3. Codigo fuente: archivo -> que requiere / quien lo requiere

Columnas: **Incluye** = `require`/`include` que emite (PHP). **Incl. por** = quien
lo carga. **Refs** = cuantos otros archivos mencionan su nombre base (rutas de
enqueue, `<script src>`, etc.).

| Ruta | Tipo | KB | LOC | Funcs | Incluye | Incl. por | Refs | Estado |
|---|---|---:|---:|---:|---|---|---:|---|
| `admin/ayuda.php` | PHP admin | 10,2 | 151 | - | - | <br>admin/page.php | 1 | OK |
| `admin/campos.php` | PHP admin | 11,4 | 183 | - | - | <br>admin/page.php | 2 | OK |
| `admin/estilos-texto.php` | PHP admin | 2,8 | 59 | 1 | - | <br>admin/page.php | 1 | OK |
| `admin/page.php` | PHP admin | 2,0 | 40 | - | <br>admin/campos.php<br>admin/estilos-texto.php<br>admin/pedidos.php<br>admin/test.php<br>admin/ayuda.php<br>admin/pdfs.php | <br>personalizador-pdf.php | 1 | OK |
| `admin/pdfs.php` | PHP admin | 39,0 | 578 | - | - | <br>admin/page.php<br>personalizador-pdf.php<br>tests/texto_puente.php | 3 | OK |
| `admin/pedidos.php` | PHP admin | 4,0 | 68 | - | - | <br>admin/page.php<br>personalizador-pdf.php<br>tests/texto_puente.php | 3 | OK |
| `admin/test.php` | PHP admin | 2,1 | 47 | - | - | <br>admin/page.php | 1 | OK |
| `assets/admin.css` | CSS | 27,5 | 804 | - | - | - | 1 | OK |
| `assets/admin.js` | JS assets | 80,3 | 1334 | - | - | - | 4 | OK |
| `assets/campo-montar.js` | JS assets | 6,7 | 115 | - | - | - | 4 | OK |
| `assets/cargador-pmu.js` | JS assets | 16,1 | 319 | - | - | - | 2 | OK |
| `assets/miniaturas.js` | JS assets | 16,1 | 320 | - | - | - | 1 | OK |
| `assets/mockup-geometria.js` | JS assets | 13,7 | 260 | - | - | - | 4 | OK |
| `assets/mockup-render.js` | JS assets | 12,9 | 230 | - | - | - | 3 | OK |
| `assets/mockups.js` | JS assets | 63,8 | 1264 | - | - | - | 7 | OK |
| `assets/selector-pmu.js` | JS assets | 13,1 | 250 | - | - | - | 2 | OK |
| `assets/tienda.js` | JS assets | 52,6 | 838 | - | - | - | 5 | OK |
| `engine/Detector.php` | PHP motor | 29,9 | 818 | 34 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php<br>tests/parity.php | 3 | OK |
| `engine/Imagen.php` | PHP motor | 15,0 | 325 | 12 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php | 2 | OK |
| `engine/Metadata.php` | PHP motor | 3,1 | 64 | 5 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php | 2 | OK |
| `engine/Motor.php` | PHP motor | 8,9 | 148 | 3 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php | 2 | OK |
| `engine/Overlay.php` | PHP motor | 29,7 | 584 | 20 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php | 2 | OK |
| `engine/Pdf.php` | PHP motor | 30,0 | 842 | 32 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php<br>tests/parity.php | 3 | OK |
| `engine/PngWriter.php` | PHP motor | 1,5 | 36 | 3 | - | <br>personalizador-pdf.php<br>tests/motor_smoke.php | 2 | OK |
| `inc/class-pmu-galeria.php` | PHP inc | 3,8 | 69 | 4 | - | <br>inc/class-pmu-uploads.php<br>tests/certificacion_hoja.php<br>tests/sin_lectura.php<br>tests/texto_puente.php | 4 | OK |
| `inc/class-pmu-sesion.php` | PHP inc | 23,5 | 443 | 24 | - | <br>personalizador-pdf.php<br>tests/texto_puente.php | 2 | OK |
| `inc/class-pmu-uploads.php` | PHP inc | 95,3 | 1791 | 98 | <br>inc/class-pmu-galeria.php | <br>personalizador-pdf.php<br>tests/campos_migracion.php<br>tests/certificacion_hoja.php<br>tests/sin_lectura.php<br>tests/texto_puente.php | 6 | OK |
| `modules/textmuy/css/style.css` | CSS | 48,1 | 1682 | - | - | - | 10 | OK |
| `modules/textmuy/index.html` | HTML | 130,0 | 1354 | - | - | - | 5 | ENTRADA editor iframe |
| `modules/textmuy/js/api.js` | JS modulo textmuy | 36,4 | 549 | - | - | - | 12 | OK |
| `modules/textmuy/js/catalog.js` | JS modulo textmuy | 17,4 | 295 | - | - | - | 19 | OK |
| `modules/textmuy/js/controls.js` | JS modulo textmuy | 134,9 | 1177 | - | - | - | 4 | OK |
| `modules/textmuy/js/editor.js` | JS modulo textmuy | 238,8 | 3590 | - | - | - | 22 | OK |
| `modules/textmuy/js/effects/bevel-webgl.js` | JS modulo textmuy | 14,0 | 249 | - | - | - | 2 | OK |
| `modules/textmuy/js/effects/distort-engine.js` | JS modulo textmuy | 15,5 | 263 | - | - | - | 6 | OK |
| `modules/textmuy/js/effects/specular-webgl.js` | JS modulo textmuy | 15,9 | 278 | - | - | - | 2 | OK |
| `modules/textmuy/js/export.js` | JS modulo textmuy | 3,9 | 69 | - | - | - | 4 | OK |
| `modules/textmuy/js/fonts.js` | JS modulo textmuy | 57,4 | 849 | - | - | - | 21 | OK |
| `modules/textmuy/js/fuentes-galeria.js` | JS modulo textmuy | 25,1 | 420 | - | - | - | 7 | OK |
| `modules/textmuy/js/galeria.js` | JS modulo textmuy | 26,3 | 473 | - | - | - | 7 | OK |
| `modules/textmuy/js/gradient-picker.js` | JS modulo textmuy | 11,1 | 205 | - | - | - | 1 | OK |
| `modules/textmuy/js/main.js` | JS modulo textmuy | 6,5 | 109 | - | - | - | 2 | OK |
| `modules/textmuy/js/preset-manager.js` | JS modulo textmuy | 31,4 | 544 | - | - | - | 16 | OK |
| `modules/textmuy/render-core.html` | HTML | 2,1 | 35 | - | - | - | 4 | OK |
| `modules/textmuy/tests/area-util.test.js` | JS test modulo | 4,5 | 48 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/avance-lineas.test.js` | JS test modulo | 10,9 | 147 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/barra-line-target.test.js` | JS test modulo | 6,8 | 111 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/catalog-unified.test.js` | JS test modulo | 5,5 | 70 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/controls-init.test.js` | JS test modulo | 4,1 | 87 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/curva-sin-webgl.test.js` | JS test modulo | 7,3 | 108 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/curva-snapshot.test.js` | JS test modulo | 7,7 | 136 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/distort-engine.test.js` | JS test modulo | 1,0 | 22 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/encaje-final.test.js` | JS test modulo | 10,9 | 165 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/entorno.test.js` | JS test modulo | 5,6 | 62 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/estilo-tema.test.js` | JS test modulo | 7,6 | 128 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/flag-wave.test.js` | JS test modulo | 5,0 | 69 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/fonts-catalog.test.js` | JS test modulo | 12,5 | 185 | - | - | - | 1 | ENTRADA CLI test |
| `modules/textmuy/tests/fuente-carga-estados.test.js` | JS test modulo | 5,8 | 88 | - | - | - | 1 | ENTRADA CLI test |
| `modules/textmuy/tests/fuente-compuesta.test.js` | JS test modulo | 5,3 | 77 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/fuente-por-linea.test.js` | JS test modulo | 8,2 | 143 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/fuente-selector.test.js` | JS test modulo | 11,3 | 135 | - | - | - | 1 | ENTRADA CLI test |
| `modules/textmuy/tests/fuentes-filtros-footer.test.js` | JS test modulo | 3,4 | 33 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/fuentes-preview-us3.test.js` | JS test modulo | 4,4 | 37 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/galeria-items.test.js` | JS test modulo | 1,7 | 31 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/galerias.browser.js` | JS test modulo | 12,3 | 162 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/hoja-generacion.test.js` | JS test modulo | 15,2 | 211 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/img-refs.test.js` | JS test modulo | 7,1 | 102 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/integridad-archivos.test.js` | JS test modulo | 1,8 | 36 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/invalidacion.test.js` | JS test modulo | 2,2 | 49 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/lineas-ciclos.test.js` | JS test modulo | 6,2 | 93 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/lineas-formato.test.js` | JS test modulo | 4,9 | 75 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/lineas-resolucion.test.js` | JS test modulo | 13,1 | 204 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/lineas-tamano.test.js` | JS test modulo | 6,1 | 98 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/pattern-block-box.test.js` | JS test modulo | 3,3 | 46 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/preset-ambito.test.js` | JS test modulo | 3,3 | 41 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/preset-cache.test.js` | JS test modulo | 5,2 | 88 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/preset-delta.test.js` | JS test modulo | 2,2 | 48 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/preset-load.test.js` | JS test modulo | 6,6 | 79 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/preset-roundtrip.test.js` | JS test modulo | 10,8 | 158 | - | - | - | 1 | ENTRADA CLI test |
| `modules/textmuy/tests/rc-bump.test.js` | JS test modulo | 0,9 | 15 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/render-dependencias.test.js` | JS test modulo | 3,5 | 57 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/sprite-canonico.test.js` | JS test modulo | 3,6 | 65 | - | - | - | 0 | ENTRADA CLI test |
| `modules/textmuy/tests/tile-geometria.test.js` | JS test modulo | 2,8 | 28 | - | - | - | 0 | ENTRADA CLI test |
| `personalizador-pdf.php` | PHP entry (plugin WP) | 198,4 | 3405 | 142 | <br>engine/Pdf.php<br>engine/Detector.php<br>engine/PngWriter.php<br>engine/Metadata.php<br>engine/Imagen.php<br>engine/Overlay.php<br>engine/Motor.php<br>inc/class-pmu-uploads.php<br>inc/class-pmu-sesion.php<br>admin/pdfs.php<br>admin/pedidos.php<br>admin/page.php | - | 4 | ENTRADA plugin WP |
| `tests/campos-contrato.test.js` | JS test | 12,9 | 206 | - | - | - | 0 | ENTRADA CLI test |
| `tests/campos_migracion.php` | PHP test CLI | 13,3 | 163 | 10 | <br>inc/class-pmu-uploads.php | - | 0 | ENTRADA CLI test |
| `tests/certificacion_hoja.php` | PHP test CLI | 13,6 | 219 | 16 | <br>inc/class-pmu-galeria.php<br>inc/class-pmu-uploads.php | - | 0 | ENTRADA CLI test |
| `tests/conciliacion.js` | JS test | 6,9 | 98 | - | - | - | 0 | ENTRADA CLI test |
| `tests/estado_pmu.php` | PHP test CLI | 2,3 | 50 | - | - | - | 0 | ENTRADA CLI test |
| `tests/inventario_pmu.php` | PHP test CLI | 3,7 | 88 | 2 | - | - | 0 | ENTRADA CLI test |
| `tests/inventario_repo.php` | PHP test CLI | 19,7 | 482 | 8 | - | - | 0 | ENTRADA CLI test |
| `tests/mockup-contrato.test.js` | JS test | 23,2 | 317 | - | - | - | 0 | ENTRADA CLI test |
| `tests/mockup-geometria.test.js` | JS test | 9,3 | 148 | - | - | - | 0 | ENTRADA CLI test |
| `tests/motor_smoke.php` | PHP test CLI | 14,6 | 255 | 2 | <br>engine/Pdf.php<br>engine/Detector.php<br>engine/PngWriter.php<br>engine/Metadata.php<br>engine/Imagen.php<br>engine/Overlay.php<br>engine/Motor.php | - | 0 | ENTRADA CLI test |
| `tests/parity.php` | PHP test CLI | 5,7 | 141 | 1 | <br>engine/Pdf.php<br>engine/Detector.php | - | 0 | ENTRADA CLI test |
| `tests/phpstan/simbolos.php` | PHP test CLI | 0,8 | 9 | - | - | - | 0 | ENTRADA CLI test |
| `tests/sin_lectura.php` | PHP test CLI | 4,5 | 95 | 8 | <br>inc/class-pmu-galeria.php<br>inc/class-pmu-uploads.php | - | 0 | ENTRADA CLI test |
| `tests/texto_puente.php` | PHP test CLI | 168,3 | 2316 | 72 | <br>admin/pdfs.php<br>admin/pedidos.php<br>inc/class-pmu-galeria.php<br>inc/class-pmu-uploads.php<br>inc/class-pmu-sesion.php | - | 0 | ENTRADA CLI test |
| `tests/validez.js` | JS test | 2,5 | 30 | - | - | - | 0 | ENTRADA CLI test |

## 4. Archivos de codigo SIN referencia (candidatos a revisar/borrar)

_Ninguno: todo el codigo de alguna forma se referencia._

## 5. Funciones PHP declaradas y nunca referenciadas

Buscadas en todo el codigo PHP sin comentarios (los hooks WP por string cuentan
como uso). **Revisar a mano**: mismo nombre repetido en dos clases enmascara el
conteo y los magicos (`__*`) estan excluidos.

| Funcion | Definida en | Linea | Defs |
|---|---|---:|---:|
| `campos_catalogo()` | `inc/class-pmu-uploads.php` | 660 | 1 |
| `get_transient()` | `tests/texto_puente.php` | 145 | 1 |
| `register_activation_hook()` | `tests/texto_puente.php` | 149 | 1 |

## 6. require/include cuyo destino no se pudo resolver

Fragmentos `.php` en sentencias de carga que no casaron con ningun archivo del
repo (variables, rutas dinamicas o archivos ausentes):

_Ninguno._

## 7. Documentacion y configuracion (fuera de la tabla de codigo)

- Docs (md/txt): **114** archivos, 1.129,2 KB.
- Config: **6** archivos (json/neon/lock).
- Otros (13): .gitattributes, .gitignore, modules/.gitignore, modules/.gitkeep, modules/textmuy/.editorconfig, modules/textmuy/.gitattributes, modules/textmuy/.gitignore, modules/textmuy/diag-maxfont.cjs, modules/textmuy/generar-presets.cjs, modules/textmuy/visible-editor.cjs, tests/fixtures/exacto_b.jpg, tests/fixtures/foto_a.png, tests/fixtures/paleta_b.png

## 8. Limitaciones y como regenerar

- Regenerar: `php tests/inventario_repo.php` (o `--consola` para no escribir).
- Excluidos por diseño: `uploads/` (datos de usuario), `.specify/`, `.clinerules/`,
  `node_modules/`, `vendor/`, `.git/`, `.vscode/`.
- Los comentarios, specs y docs NO cuentan como uso de una funcion o archivo:
  eso es deliberado (queremos uso real, no menciones).
- Antes de borrar cualquier candidato: verificar en el sitio real (smoke test).
