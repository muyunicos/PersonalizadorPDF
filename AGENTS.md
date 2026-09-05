# AGENTS.md — Contexto obligatorio del proyecto (LEER ANTES DE CUALQUIER CONSULTA)

> ⚠️ **PARA CUALQUIER IA**: este archivo debe leerse COMPLETO antes de editar, buscar o
> responder sobre el repositorio. Contiene el objetivo, la arquitectura, las reglas
> técnicas críticas, las decisiones de diseño ya tomadas y las dificultades del entorno.
> Si algo no está aquí, **preguntá al usuario**; no lo inventes.

---

## 0. Resumen en una frase

El plugin **Extractor Corel** detecta "huecos" (rectángulos 100% transparentes) en un PDF
exportado desde **CorelDRAW**, los agrupa por **color**, permite cargar **una imagen real
por grupo** y **reemplaza cada hueco por su imagen** (encajada, sin deformar ni recortar),
devolviendo un **PDF editado** optimizado, listo para descargar. Motor 100% PHP, sin Python.

## 1. Objetivo y visión del sistema

- **Universalidad**: debe procesar **cualquier PDF** (no solo `muestra.pdf`). El usuario
  sube el PDF que quiera y el sistema lo procesa tal cual.
- **Placeholders**: en Corel se dibujan rectángulos vectoriales con transparencia total
  (fill_opacity = 0) donde irán fotos/nombres (credenciales, certificados, diplomas).
- **Grupos por color**: cada rectángulo transparente se asigna a un grupo según su color de
  relleno. El rectángulo **más grande** del grupo define el **tamaño base**.
- **Imágenes reales**: el admin carga una imagen por grupo (desde su PC o la galería de
  WordPress). El motor la inserta en **todas** las instancias del grupo.
- **Encajado (contain)**: la imagen **nunca** se deforma ni se recorta; se escala para
  caber entera dentro del placeholder y se centra; los márgenes sobrantes quedan
  transparentes.
- **100% PHP**: funciona en hosting compartido (Hostinger, etc.) sin Python, Node ni SSH.

## 2. Arquitectura y mapa de archivos (raíz del repo = carpeta del plugin)

```
PersonalizadorPDF/
├── AGENTS.md                ← ESTE archivo (contesto obligatorio)
├── extractor-corel.php      ← Plugin principal WP: menú, assets, handlers (admin_post_*)
├── admin/
│   ├── page.php             ← Página admin: pestañas "PDFs" | "Ayuda"
│   ├── pdfs.php             ← Consola: subir PDF, listado, grupos, imágenes, Procesar
│   └── ayuda.php            ← Documentación interna del plugin
├── assets/
│   ├── admin.css            ← Estilos de la consola
│   └── admin.js             ← Modal renombrar/sobrescribir + galería wp.media
├── engine/                  ← MOTOR PHP puro (sin dependencias externas)
│   ├── Pdf.php              ← Parser de PDF (lexer, objetos, xref, streams, árbol de páginas)
│   ├── Detector.php         ← Detección de placeholders y agrupación por color (== análisis Python)
│   ├── Metadata.php         ← Dataset JSON por PDF (id, letra, color, medidas, instancias)
│   ├── PngWriter.php        ← Genera PNG transparentes (placeholders descargables)
│   ├── Imagen.php           ← Normaliza imágenes reales a RGBA (GD o PHP puro) + encajado
│   ├── Overlay.php          ← Inyecta XObjects/imagenes en el PDF (reescribe objetos)
│   └── Motor.php            ← ORQUESTADOR: PDF + dataset + imágenes → PDF editado
├── tests/
│   ├── motor_smoke.php      ← Smoke test del motor (21 checks) — CORRERLO SIEMPRE
│   ├── parity.php           ← Paridad del detector PHP vs expected_muestra.json (oráculo)
│   ├── expected_muestra.json ← Oráculo de detección PARA muestra.pdf
│   └── fixtures/            ← Imágenes de prueba (foto_a.png, paleta_b.png, exacto_b.jpg)
├── readme.txt               ← Metadatos WP (README del plugin)
├── muestra.pdf              ← PDF de prueba real (2.7 MB) con placeholders
├── .gitignore
└── .gitattributes
```

**Regla de oro: no crear duplicados.** Antes de agregar algo nuevo (página, motor, clase,
script), consultá `AGENTS.md` y el árbol; reutilizá lo existente.
## 3. Flujo de trabajo (cómo lo usa el admin de WordPress)

La página admin del plugin es una **consola de trabajo** con 2 pestañas:

1. **PDFs y procesamiento** (`admin/pdfs.php`):
   1. **Subir PDF** → se guarda en `uploads/extractor-corel/pdfs/{archivo}.pdf`, se detectan
      los placeholders, se genera el **dataset** (`datos/{pdf}/metadata.json`) y los
      **placeholders** PNG transparentes descargables (`placeholders/{pdf}/{letra}-{WxH}.png`).
   2. **Listado de PDFs** (tabla) con grupos/instancias y acciones:
      Seleccionar · Descargar · Borrar (borra PDF + dataset + imágenes + salida).
   3. **Grupos e imágenes por PDF**: se ve cada grupo (color, medidas px/pt, instancias y
      páginas), preview de la imagen cargada y del placeholder, y se puede **cargar imagen**
      por grupo (desde la PC o desde la **galería de medios** wp.media).
   4. **Procesar PDF** → `Motor::procesar(pdf, dataset, imágenes)` → PDF editado optimizado →
      **Descargar PDF procesado**.
2. **Ayuda** (`admin/ayuda.php`): documento interno del plugin.

**Conflicto de nombre al subir**: si ya existe un PDF con el mismo nombre, se muestra un
modal con **Renombrar automáticamente** (nombre-2.pdf) o **Sobrescribir** (borra datos,
imágenes y salida anteriores y regenera el análisis).

**Grupos sin imagen**: si al procesar algún grupo no tiene imagen, se procesan los que sí
y el resumen avisa cuáles quedaron como estaban.

**Re-analizar**: si el PDF cambió pero mantiene el nombre, se regenera el dataset.

## 4. Reglas técnicas críticas (¡NO MODIFICAR sin entenderlas!)

1. **Detección de placeholders** (criterio idéntico entre Python y PHP):
   - El path debe tener relleno definido (`fill`; tipos `f`/`fs` de PyMuPDF).
   - `fill_opacity` ≤ `TOL_OPACIDAD` (0.001) → transparencia total.
   - Forma rectangular: ítems tipo `re`, o 4 líneas rectas cerradas que forman el bbox.
   - Tamaño mínimo anti-artefactos: **10 pt** de ancho y **5 pt** de alto.
2. **Agrupación por color**: la clave de grupo es el color RGB redondeado a 3 decimales.
   Los grupos se ordenan por tupla RGB (determinista) y reciben letras `a, b, c... z, aa, ab...`.
   La medida representativa es la figura **más grande por área**.
3. **Medidas SIEMPRE en px (base 200 ppp)**: `px = pt * 200/72` con redondeo medio arriba
   (`(int)($pt * 200/72 + 0.5)`).
4. **Encajado (contain)** en `Imagen::encajado()`:
   `escala = min(W/iw, H/ih)`, centrado, márgenes transparentes. Nunca estirar ni recortar.
5. **⚠️ Overlay: cada draw en su propio par `q ... Q`** (bug real corregido). El operador
   `cm` CONCATENA el CTM: sin `q/Q` intermedio, el 2º y siguientes draws de una página
   heredan la escala acumulada del anterior y se dibujan fuera de lugar.
6. **Dataset validado contra el PDF** antes de procesar (`Motor::validarDataset`): si no
   coincide (mismo nº de grupos, letras, tamaños e instancias) → error "Re-analiza el PDF".
7. **Sin GD** (opcional): el decodificador PNG propio soporta 8 bits sin entrelazar
   (gris, RGB, paleta, gris+alfa, RGBA). JPEG solo se incrusta directo (DCTDecode) si sus
   dimensiones coinciden exactamente con las del grupo. Con GD se remuestrea cualquier formato.
8. **Optimización del PDF**: el PDF resultante se reconstruye completo con deduplicación de
   objetos; los streams de imagen van comprimidos (FlateDecode / DCTDecode).
9. **⚠️ Z-order fiel al diseño (splice)**: cada imagen se inserta EN EL CONTENT STREAM
   ORIGINAL justo ANTES del operador de relleno (`f`/`f*`) de su placeholder, NO al final
   de la página. Con esto la imagen respeta los **clips activos** (`W*`, p. ej. placeholders
   enmarcados dentro de círculos) y cualquier ornamento que se dibuje DESPUÉS (anillos,
   bordes) queda **por encima** de la foto. `Detector` guarda por instancia `stream`,
   `offset`, `op`, `ctm` y `dev_bbox`; `Overlay::splicearStreams()` re-emite el stream
   original (FlateDecode) en su MISMO número de objeto. Cada draw va en su propio `q...Q`
   con `cm = inv(CTM) * rect_dev` Y con `q /ECOp1 gs ... Q`: el `/ECOp1` es un ExtGState
   (`ca 1 /CA 1`) que se agrega al `/ExtGState` de la página, necesario porque el splice
   hereda el ExtGState del placeholder (`ca 0`) que de otra forma multiplica el SMask por
   cero y **la imagen se dibuja 100% transparente**. Instancias sin offset (dentro de Form
   XObjects) usan el content stream nuevo al final (fallback, con el mismo `q /ECOp1 gs`).
## 5. Formatos y convenciones de nombres (NO CAMBIAR)

- Carpeta por PDF: `uploads/extractor-corel/{pdfs,datos,imagenes,placeholders,salidas}/...`
- Imagen de grupo: `imagenes/{pdf}/{letra}.{ext}` (una sola letra a, b, c...)
- Dataset: `datos/{pdf}/metadata.json`
- Placeholder PNG: `placeholders/{pdf}/{letra}-{ancho_px}x{alto_px}.png`
- Salida: `salidas/{pdf}_procesado.pdf`
- `metadata.json` (por grupo):
  `id: {pdf}-{letra}-{ancho_px}x{alto_px}` · `letra` · `color (#RRGGBB)` ·
  `color_rgb` · `ancho_px/alto_px` · `ancho_pt/alto_pt` · `num_instancias` ·
  `paginas` (base 0) · `ruta_marco`.

## 6. Motor PHP (engine/): responsabilidades

- **`Pdf.php`**: parser mínimo de PDF (lexer, objetos, xref clásica y xref stream, ObjStm,
  streams FlateDecode con predictor, árbol de páginas con herencia de `/Resources`). Solo lectura.
- **`Detector.php`**: `analizarPdf()` → `['total_paginas', 'grupos']`. Contiene `Round`
  (half-even, pt→px, rgb→hex) y `ContentParser` (parser del content stream con estado gráfico).
- **`Metadata.php`**: `nombreDesdeArchivo`, `idGrupo`, `rutaMetadata`, `generar`, `guardar`, `cargar`.
- **`PngWriter.php`**: PNG transparente WxH en PHP puro (zlib), sin GD.
- **`Imagen.php`**: `normalizar(ruta, W, H)` → `['tipo'=>'raster'|'dct', ...]`. GD si está;
  si no, PNG puro o JPEG exacto. `encajado()`, decodificador PNG.
- **`Overlay.php`**: `build(grupos, imagenes?)` → bytes del PDF editado. Si `imagenes` es null
  dibuja marcos transparentes (compatibilidad); si se pasa, omite grupos sin imagen.
- **`Motor.php`**: orquesta. `procesar(rutaPdf, datos, rutasImagenes)` →
  `['bytes', 'grupos', 'resumen']`. Llama a Pdf+Detector (validar dataset), Imagen (normalizar),
  Overlay (build). Es lo que usa `handle_procesar`.

## 7. Decisiones de diseño ya tomadas (historia — respetarlas)

- ~~Versión Flask + Python~~: **eliminada**. El servicio es el plugin WP 100% PHP (no debe
  ejecutarse Python en el servidor, ni siquiera para tests).
- ~~"Menú de 8 tests en el admin"~~ (detección, metadatos, marcos, reemplazo, guardado,
  pipeline, paridad, inspector): **descartado como suite separada**. En su lugar, el flujo real
  de la consola cubre detección/metadatos/marcos/reemplazo/guardado, y la validación se hace
  con `tests/motor_smoke.php` (PHP) y `tests/parity.php` (paridad del detector contra oráculo
  JSON generado en desarrollo). No volver a crear una pestaña "Tests".
- El `Overlay` original (marcos transparentes automáticos) se mantiene por compatibilidad
  (`Motor` pasa `imagenes`), pero el producto inserta **imágenes reales**.
- Los PDFs subidos, datasets, imágenes y salidas se guardan en `uploads/` (runtime, no se
  versionan). `tests/fixtures/` SÍ se versiona (necesario para `motor_smoke.php`).
- **Preservación del enmarcado (z-order)**: el `Overlay` dibujaba las imágenes en un content
  stream nuevo AL FINAL (encima de todo), tapando ornamentos (anillos/círculos) y rompiendo
  clips (`W*`). Ahora cada imagen se inserta con **splice justo antes del relleno** de su
  placeholder en el stream original: conserva el recorte circular y los elementos pintados
  después (enmarcado). El detector expone `stream/offset/ctm/dev_bbox` por instancia; la
  entrada del offset se degrada a fallback (final de página) si falta.
- **Imágenes transparentes tras el splice (fix)**: al splicear justo antes del `f*` la imagen
  heredaba el ExtGState del placeholder (`ca 0`) y, como la opacidad ca del estado gráfico se
  multiplica por el SMask, la imagen salía 100% transparente. Se resolvió agregando un
  **ExtGState `/ECOp1` (`ca 1 /CA 1`)** al `/ExtGState` de la página y anteponiendo
  `q /ECOp1 gs ... Q` a cada draw (splice y fallback). Todo draw de imagen nuevo DEBE llevar
  `q /ECOp1 gs`.
## 8. Dificultades del entorno (IMPORTANTE AL TRABAJAR AQUÍ)

1. **Paths con espacios**: evitá `dir`/`ls`/`findstr` con paths largos. Usá `read_files` y
   `search_codebase`. Los comandos de shell que requieran rutas → ponelos entre comillas y
   usá `&&` para encadenar.
2. **PowerShell/cmd con escaping problemático**: preferí comandos simples de `cmd /c`; no
   anides comillas ni backslashes en `-Command`. `findstr` con patrones de paréntesis o pipes
   falla (no matchea en este entorno).
3. **`search_codebase` tiene límites**: no indexa bien los `.php` (en INFORME se documentó que
   "los archivos PHP no están en los primeros 20"); si no encontrás un patrón, leé directamente.
4. **Páginas wp-admin**: no intentes fetch a `muyunicos.com/wp-admin/...` (requiere auth →
   404). Asumí según `admin/*.php`.
5. **Windows: "Acceso controlado a carpetas"** puede bloquear escrituras de `php.exe` en
   `Documents/...`. Al correr `motor_smoke.php`, escribe en `%TEMP%` (`sys_get_temp_dir()`).
   En el servidor WP esto NO aplica.
6. **No hay Python local garantizado**: los scripts `.py` de dev se eliminaron. Los tests son PHP.

## 9. Cómo probar (siempre después de tocar engine/ o admin/)

```bash
php -l extractor-corel.php && php -l admin/*.php && php -l engine/*.php
php tests/motor_smoke.php    # smoke del motor: debe decir "SMOKE OK" (26 checks)
php tests/parity.php         # paridad del detector vs expected_muestra.json → "PARIDAD OK"
```

- Para probar el flujo completo en WordPress: subir `muestra.pdf`, cargar imagen en cada
  grupo y pulsar **Procesar PDF**.
- Requisitos: PHP 7.4+, zlib. GD opcional (sin GD: PNG puro + JPEG exacto).

## 10. Reglas para la IA al editar

- Leé `AGENTS.md` completo antes de cualquier cambio.
- No dupliques: reutilizá `engine/*` y `admin/*` existentes; no crees páginas/motores nuevos
  sin confirmarlo con el usuario.
- Mantené la estructura de archivos liviana (raíz). No reintroduzcas Python.
- Si cambias `engine/*`, corré `tests/motor_smoke.php` y `php -l`.
- Si una decisión de diseño es relevante, REGISTRALA en la sección 7 (este archivo es la
  única fuente de verdad junto con el código).
- Mensajes de la interfaz y del código en español (pragmático, sin tildes para evitar
  problemas de encoding si hace falta).

## 11. Tabla de errores comunes (resolver antes de preguntar)

| Error | Causa | Solución |
|---|---|---|
| "Los datos guardados no coinciden con el PDF" | Dataset desactualizado | Re-analizar el PDF en el admin |
| "No se detectaron placeholders" | PDF sin rectángulos 100% transparentes | Exportar desde Corel con transparencia total; verificar tamaño mín 10x5 pt |
| "La extension GD no esta disponible y el JPEG no coincide..." | Se intentó JPEG sin GD con tamaño distinto | Activar GD o usar PNG |
| "PNG entrelazado no soportado sin GD" | PNG interlaced | Guardar la imagen sin entrelazar |
| Draws fuera de lugar / escala al cuadrado | Falta `q...Q` por draw en Overlay | Cada draw DEBE ir en su propio `q...Q` (sección 4.5) |
| `fopen(...): Failed to open stream` en Documents | Acceso controlado a carpetas de Windows | Escribir en `%TEMP%` (dev); en WP usar `wp_upload_dir()` |

---

*Este archivo consolida e integra el contenido de la antigua `FUNCIONALIDAD.md` y
`INFORME_DIFICULTADES.md`, que fueron eliminadas para tener una única fuente de verdad.*