# AGENTS.md — Contexto obligatorio del proyecto (LEER ANTES DE CUALQUIER CONSULTA)

> ⚠️ **PARA CUALQUIER IA**: este archivo debe leerse COMPLETO antes de editar, buscar o
> responder sobre el repositorio. Contiene el objetivo, la arquitectura, las reglas
> técnicas críticas, las decisiones de diseño ya tomadas y las dificultades del entorno.
> Si algo no está aquí, **preguntá al usuario**; no lo inventes.

---

## 0. Resumen en una frase

El plugin **Personalizador PDF** (antes "Extractor Corel") detecta "huecos" (rectángulos 100%
transparentes) en un PDF exportado desde **CorelDRAW**, los agrupa por **color**, permite
cargar **una imagen real por grupo** y **reemplaza cada hueco por su imagen** (encajada, sin
deformar ni recortar), devolviendo un **PDF editado** optimizado. Motor 100% PHP, sin Python.
Desde la **v3.0.0** integra el sistema **TextMuy** (editor de estilos de texto client-side)
en la pestaña **"Estilos de Texto"** del admin.

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
- **TextMuy (v3.0.0+)**: módulo autocontenido en `modules/textmuy/`, servido en un iframe
  same-origin dentro de la pestaña "Estilos de Texto". Es un editor de estilos de texto
  (TextStudio-like) 100% client-side (Canvas 2D + WebGL). Diseño aprobado: en v3.1 los grupos
  del PDF podrán llevar "texto + estilo" y TextMuy renderizará la imagen del grupo al pulsar
  Procesar (el render ocurre en el navegador del admin; ver sección 7).
- **100% PHP**: el servidor funciona en hosting compartido (Hostinger, etc.) sin Python ni
  Node. El código que corre en el servidor es PHP; el JS de TextMuy corre solo en el navegador.

## 2. Arquitectura y mapa de archivos (v4.1: proyecto de 3 carpetas)

La RAIZ DEL PROYECTO (sin git) agrupa tres carpetas hermanas:

```
personalizador-pdf/              <- RAIZ DEL PROYECTO (sin git)
├── personalizador-pdf/          <- PLUGIN (repo git, el arbol de abajo; en WP vive en
│                                   wp-content/plugins/personalizador-pdf/)
├── textmuy/                     <- MODULO TextMuy (git propio): se importa a mano a
│                                   modules/textmuy/ tras cada actualizacion (LEEME.md)
└── uploads/personalizador-pdf/  <- DATOS DE USUARIO (sin git): espejo de
                                    wp-content/uploads/personalizador-pdf/ (pdfs, datos,
                                    imagenes, placeholders, salidas y textmuy/{presets,
                                    imagenes} desde 4.1). Se despliega COMPLETO al servidor.
```

Arbol del repo del plugin (la carpeta `personalizador-pdf/` de arriba):
```
personalizador-pdf/          (carpeta de instalación en WP: wp-content/plugins/personalizador-pdf/)
├── AGENTS.md                ← ESTE archivo (contesto obligatorio)
├── personalizador-pdf.php   ← Plugin principal WP (antes extractor-corel.php): clase
│                               Personalizador_PDF_Plugin, menú, assets, handlers
│                               admin_post_personalizador_pdf_*, migración de datos y
│                               compat legacy extractor_corel_* (un ciclo, se elimina en 3.1)
├── admin/
│   ├── page.php             ← Página admin: pestañas "PDFs" | "Estilos de Texto" | "Ayuda"
│   ├── pdfs.php             ← Consola: subir PDF, listado, grupos, imágenes, Procesar
│   ├── estilos-texto.php    ← NUEVO v3.0: iframe del módulo TextMuy (modules/textmuy)
│   └── ayuda.php            ← Documentación interna del plugin
├── assets/
│   ├── admin.css            ← Estilos de la consola + iframe de TextMuy
│   └── admin.js             ← Modal renombrar/sobrescribir + galería wp.media (obj PersonalizadorPDF)
├── engine/                  ← MOTOR PHP puro (sin dependencias externas)
│   ├── Pdf.php              ← Parser de PDF (lexer, objetos, xref, streams, árbol de páginas)
│   ├── Detector.php         ← Detección de placeholders y agrupación por color (== análisis Python)
│   ├── Metadata.php         ← Dataset JSON por PDF (id, letra, color, medidas, instancias)
│   ├── PngWriter.php        ← Genera PNG transparentes (placeholders descargables)
│   ├── Imagen.php           ← Normaliza imágenes reales a RGBA (GD o PHP puro) + encajado
│   ├── Overlay.php          ← Inyecta XObjects/imagenes en el PDF (reescribe objetos)
│   └── Motor.php            ← ORQUESTADOR: PDF + dataset + imágenes → PDF editado
├── modules/                 ← Módulos autocontenidos del plugin (NO versionados desde v4.0.0)
│   ├── LEEME.md             ← Instrucciones para importar los módulos a mano
│   └── textmuy/             ← (se importa a mano) Proyecto TextMuy: index.html,
│                               render-core.html (motor headless), css/, js/ (effects/,
│                               utils/), fonts/, tests/, ROADMAP.md. Vive en su propia
│                               carpeta/repositorio "textmuy" (git propio) y se copia aqui
│                               tras cada actualizacion del modulo. Desde 4.0.0 NO trae
│                               datos del admin: presets e imagenes viven en
│                               uploads/personalizador-pdf/textmuy/ (ver §5 y §7).
├── tests/
│   ├── motor_smoke.php      ← Smoke test del motor (26 checks) — CORRERLO SIEMPRE
│   ├── parity.php           ← Paridad del detector PHP vs expected_muestra.json (oráculo)
│   ├── expected_muestra.json ← Oráculo de detección PARA muestra.pdf
│   └── fixtures/            ← Imágenes de prueba (foto_a.png, paleta_b.png, exacto_b.jpg)
├── readme.txt               ← Metadatos WP (README del plugin)
├── .gitignore               ← (muestra.pdf/muestra2.pdf NO se versionan: viven en
│                               ../uploads/personalizador-pdf/pdfs/, datos del usuario)
└── .gitattributes
```

**Regla de oro: no crear duplicados.** Antes de agregar algo nuevo (página, motor, clase,
script), consultá `AGENTS.md` y el árbol; reutilizá lo existente.

> **Módulos**: `modules/` aloja sistemas completos que el plugin embebe sin mezclar código.
> NO se versionan (gitignored desde 4.0.0): el usuario los importa a mano tras cada
> actualización del módulo (ver `modules/LEEME.md`); sin módulo importado el plugin funciona
> (la pestaña "Estilos de Texto" muestra un aviso y "PDFs" oculta la sección de texto
> estilizado). TextMuy se sirve tal cual (rutas relativas) desde su URL estática
> (`PERSONALIZADOR_PDF_URL . 'modules/textmuy/index.html'`). No copiar sus JS/CSS a `assets/`
> ni reescribir el módulo desde el plugin.

### 2.1 Contrato RenderCore (comunicación plugin ↔ módulo TextMuy, v3.1/v3.2/v3.3)

El plugin NO conoce los internos de TextMuy: solo consume este contrato público
(cualquier cambio del módulo debe mantenerlo para no romper el puente):

1. **Editor completo** (pestaña "Estilos de Texto"): `modules/textmuy/index.html` en iframe
   same-origin (localStorage, fetch de presets, WebGL). El módulo NO viene con el plugin:
   se importa a mano (`modules/LEEME.md`); si falta, la pestaña muestra un aviso claro.
2. **Motor de render headless**: `modules/textmuy/render-core.html` (~220 KB sin UI: fonts +
   effects + editor + export + api). Se carga en un iframe off-screen SOLO cuando se usa
   texto (carga perezosa). Expone `window.RenderCore = {version, ready}` y
   `window.TextMuyAPI.renderBatch(items, {onProgress}) -> [{id, blob}]` (progreso por item;
   rechaza ante el primer fallo — nunca lote parcial) y garantiza la fuente cargada antes de
   renderizar (`ensureFontReady`). Los presets se resuelven con caché (1 fetch por preset)
   vía `PresetManager.presetUrlBase()`: con puente es `bridge.urls.presetsBase` (uploads,
   desde 4.0.0); standalone, `presets/` relativo al módulo. El archivo es `{nombre}.txm`
   (delta textmuy-project, formato ÚNICO desde 3.2.0; fallback legacy `.json` TextStudio
   crudo). El render-core carga también `js/preset-manager.js`
   (expone `settingsFromDelta` y `presetUrlBase` para resolver los .txm).
3. **Catálogo de estilos e imágenes (datos de usuario, v4.0.0)**: presets del admin en
   `uploads/personalizador-pdf/textmuy/presets/{nombre}.txm` + `{nombre}.webp` (miniatura
   200x100, auto-generada al primer uso), listados por PHP con glob. NO hay presets de
   fábrica: el admin crea los suyos desde el editor (los que traiga la carpeta del módulo
   solo valen en standalone). Imágenes subidas en
   `uploads/personalizador-pdf/textmuy/imagenes/` (plano) + `catalogo.json` único
   (`{nombre, categoria, titulo}`), generado en runtime. Al actualizar el plugin (ZIP o git)
   NO hay nada que preservar.
4. **Puente de recursos (v3.2.0/v3.3.0/v4.0.0)**: el módulo es client-side y NO puede escribir en el
   servidor solo. `admin/estilos-texto.php` le pasa al iframe por postMessage same-origin
   `{urls, nonces, presets, imagenes}` (en 3 momentos: load del iframe, aviso
   `textmuy-ready` del módulo, e inmediato); `urls.presetsBase` (v4.0.0) es la URL de
   uploads para LEER los .txm/.webp. El módulo expone
   `PresetManager.{listPresets, listImages, savePreset, deletePreset, uploadImage,
   presetUrlBase, bridgeAvailable, migrateLegacyPresets}` que POSTean a los handlers
   `admin_post_personalizador_pdf_textmuy_{guardar_preset,borrar_preset,subir_imagen,
   borrar_imagen,cambiar_imagen}`
   (nonce + capability + nombre sanitizado `[a-z0-9_-]` + validación de firma .webp/imagen +
   límites: 2 MB .txm, 1 MB .webp, 4 MB imagen). Las imágenes se organizan por categoría en
   `catalogo.json` (campo `categoria`); el CRUD actualiza el JSON. URLs con cache-bust
   `?v=mtime`; el listado marca `enUso` escaneando los `.txm`. Sin puente (uso standalone
   del módulo) esas funciones se degradan: guardar descarga el `.txm` y las imágenes se
   embeben como data-URL.
5. **Versionado de estáticos del módulo** (cache-busting): los JS se sirven sin versión
   automática. `render-core.html` e `index.html` referencian sus scripts con `?v=RCn`
   (RC9 hoy): **al cambiar cualquier JS del módulo, subir el número** en ambos HTML. Además,
   el plugin cache-bustea la URL del iframe con su propia versión y valida el contrato
   (si la cache sirve un módulo viejo sin `renderBatch`, avisa recarga Ctrl+F5).
6. **Galería de imágenes y catálogo base (v3.3.0)**: componente único en `js/galeria.js`
   (`window.TextMuyGaleria.abrir(fuente, aplicar, seccion?, opciones?)`), panel acoplado
   con search, tabs (fondos/iconos/varios + catálogo), lista 50x50 y footer (name + Save +
   Delete + Select/Aplicar). Modo **preview en vivo**: si se pasan `opciones.preview` +
   `opciones.controls` (Pattern/BACKGROUND), la galería oculta `tt-main-container`,
   aplica la imagen al instante y replica los controles (Fit/Scale/Origin/Repeat o
   Opacity/Repeat); "Aplicar" persiste, "✕" restaura el backup. Miniaturas de presets
   200x100 auto-guardadas al primer uso. Desde 4.0.0 no hay catalogo base versionado: las
   imagenes del admin viven en `uploads/personalizador-pdf/textmuy/imagenes/` +
   `catalogo.json` (generado en runtime).

## 3. Flujo de trabajo (cómo lo usa el admin de WordPress)

La página admin del plugin es una **consola de trabajo** con 3 pestañas:

1. **PDFs y procesamiento** (`admin/pdfs.php`, `?tab=pdfs`):
   1. **Subir PDF** → se guarda en `uploads/personalizador-pdf/pdfs/{archivo}.pdf`, se detectan
      los placeholders, se genera el **dataset** (`datos/{pdf}/metadata.json`) y los
      **placeholders** PNG transparentes descargables (`placeholders/{pdf}/{letra}-{WxH}.png`).
   2. **Listado de PDFs** (tabla) con grupos/instancias y acciones:
      Seleccionar · Descargar · Borrar (borra PDF + dataset + imágenes + salida).
   3. **Grupos e imágenes por PDF**: se ve cada grupo (color, medidas px/pt, instancias y
      páginas), preview de la imagen cargada y del placeholder, y se puede **cargar imagen**
      por grupo (desde la PC o desde la **galería de medios** wp.media).
      Además, cada grupo puede llevar **texto estilizado** (v3.1): activar "Usar texto",
      escribir el contenido (máx. 300 chars) y elegir el estilo; autoguardado AJAX en
      `datos/{pdf}/textos.json`, vista previa al tamaño del hueco (vía RenderCore).
   4. **Procesar PDF** → si hay grupos con texto activo, `admin.js` intercepta el submit,
      renderiza cada grupo con `TextMuyAPI.renderBatch` (tamaño exacto `ancho_px × alto_px`,
      PNG transparente RGBA no entrelazado) y envía UN POST con todo: `texto_{letra}`,
      `estilo_{letra}` (persistidos en textos.json) y `imagen_{letra}` (PNG) →
      `handle_procesar` guarda los PNG con `guardar_imagen()` y llama
      `Motor::procesar(pdf, dataset, imágenes)` SIN cambios → PDF editado optimizado →
      **Descargar PDF procesado**. Sin textos activos el submit es el clásico. El botón
      **Procesar** se habilita con imagen manual o texto activo en al menos un grupo.
2. **Estilos de Texto** (`admin/estilos-texto.php`, `?tab=textos`, v3.0; presets en el
   servidor desde v3.2.0): monta un iframe same-origin con `modules/textmuy/index.html` y le
   pasa por postMessage el puente de recursos (endpoints + nonces + listado de
   presets/imágenes). El ÚNICO panel de presets es la galería inferior expandible (buscar,
   guardar como preset, borrar y migrar los legacy de localStorage); guardar escribe
   `{nombre}.txm` + `{nombre}.webp` en `uploads/personalizador-pdf/textmuy/presets/` (visible en todos los
   navegadores y en el selector de estilo por grupo de `admin/pdfs.php`). Las imágenes de
   rellenos/fondos se suben a `uploads/personalizador-pdf/textmuy/imagenes/` (picker "Mis imágenes" junto a
   cada "Import image"). NO existe una API PHP para renderizar texto: el render de TextMuy
   corre en el navegador (ver §7).
3. **Ayuda** (`admin/ayuda.php`, `?tab=ayuda`): documento interno del plugin.

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
   - Forma rectangular: ítems tipo `re` (con las **4 esquinas** transformadas por
     el CTM) o 4 líneas rectas cerradas que forman un cuadrilátero. Además del
     rectángulo alineado a ejes se aceptan **rectángulos rotados** (aristas
     opuestas paralelas e iguales, adyacentes perpendiculares, con tolerancia
     relativa); en ese caso las medidas representativas son los **lados** (no el
     bbox) y la instancia lleva `dev_quad`.
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

- Carpeta por PDF: `uploads/personalizador-pdf/{pdfs,datos,imagenes,placeholders,salidas}/...`
  (en v3.0.0; la v2.0.0 usaba `uploads/extractor-corel/`, que se migra al activar y/o en el
  primer uso del plugin sin perder datos)
- Imagen de grupo: `imagenes/{pdf}/{letra}.{ext}` (una sola letra a, b, c...)
- Dataset: `datos/{pdf}/metadata.json`
- Placeholder PNG: `placeholders/{pdf}/{letra}-{ancho_px}x{alto_px}.png`
- Salida: `salidas/{pdf}_procesado.pdf`
- Módulo TextMuy (v4.0.0): TODOS los datos del administrador viven en
  `uploads/personalizador-pdf/textmuy/`: presets en `presets/{nombre}.txm` + miniatura
  `{nombre}.webp` (100x200); imágenes subidas en `imagenes/{nombre}.{ext}` con
  `imagenes/catalogo.json` (único, `{nombre, categoria, titulo}`, generado en runtime).
  Sin contenido de fábrica. Migración automática (activación/primer uso) desde las rutas
  de <= 3.3.0 (`modules/textmuy/{presets,imagenes}`), reescribiendo las URLs de imagen
  dentro de los .txm.
- Módulo TextMuy (v3.3.0, historico): componente de galería en `js/galeria.js` del módulo.
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
- **Rectángulos rotados (fix: muestra2.pdf)**: Corel exporta algunos placeholders como
  rectángulos INCLINADOS (4 líneas + `h f*`). El detector PHP ahora los acepta (antes exigía
  aristas exactamente horizontales/verticales → "No se detectaron placeholders"). El Overlay
  dibuja la imagen sobre el cuadrilátero rotado (`instancias[].dev_quad`) con un `cm` general
  `M = inv(CTM) * D` (origen + 2 vectores de arista) — el cálculo anterior de `cm` mezclaba
  términos cruzados y solo era correcto con CTM identidad/diagonal. El `re` también se
  transforma por sus 4 esquinas. Todo preserva el splice `q /ECOp1 gs ... Q` y la tolerancia
  angular es relativa (TOL_GEO), porque los números del stream vienen redondeados.
- **Orientación de la imagen en rectángulos rotados (fix: no espejar)**: Corel recorre los
  paths en sentido HORARIO empezando en la esquina superior; anclar la imagen en la 1ra
  esquina con `v = q3-q0` (2da arista) producía un REFLEJO vertical (la foto salía de cabeza).
  `Overlay::baseDesdeQuad()` prueba las **4 esquinas del quad como origen** (sin deformar:
  `u` siempre paralelo a la 1ra arista 0-1 = "ancho" del detector y `v` a la 2da 1-2 = "alto",
  de modo que el paralelogramo cubre SIEMPRE el placeholder) y elige la que cumpla
  **`det(u,v) > 0`** (rotación pura, nunca espejo) y **`v_y > 0`** (el "arriba" de la imagen
  apunta hacia arriba en la página), con desempates `u_x > 0` y luego `u_y > 0`
  (inclinaciones ≈ ±90°). El caso clásico axis-aligned sale idéntico al viejo
  (origen = esquina inferior-izquierda del bbox, v = (0,h)). Splice y fallback usan la
  MISMA base (fuente única: `rectBase()`).
- **Fusión modular con TextMuy (v3.0.0, aprobada)**: el plugin pasa a llamarse
  **"Personalizador PDF"** (archivo `personalizador-pdf.php`, clase
  `Personalizador_PDF_Plugin`, slug `personalizador-pdf`, handlers
  `admin_post_personalizador_pdf_*`). El sistema TextMuy se integra como **módulo
  autocontenido** en `modules/textmuy/` servido por un **iframe same-origin** en la pestaña
  "Estilos de Texto" (`admin/estilos-texto.php`). Motivos: aislamiento total del CSS/JS de
  TextMuy (tiene estilos globales de app que romperían wp-admin si se mezclan en el DOM),
  rutas relativas sin cambios, y upgrades triviales (reemplazar la carpeta). NO usar
  `sandbox` en el iframe (el módulo necesita `localStorage`, `fetch` de presets y WebGL).
  Los presets guardados en el editor viven en `localStorage` del navegador del admin; los
  presets base (`presets/*.json`) son globales. Se mantiene compat temporal (ciclo 3.0.x)
  con las acciones y nonces legacy `extractor_corel_*` (alias en `__construct()` y en
  `seguridad()`); se elimina en 3.1.
- **Render de texto estilizado hacia el PDF (IMPLEMENTADO v3.1)**: cada grupo puede llevar
  "texto + estilo" (estado en `datos/{pdf}/textos.json`, se borra con el PDF). El render NO
  ocurre en el servidor (TextMuy es 100% JS y el plugin es 100% PHP): al pulsar **Procesar
  PDF**, `admin.js` intercepta el submit, carga perezosamente el **RenderCore**
  (`modules/textmuy/render-core.html`, iframe off-screen) y llama `TextMuyAPI.renderBatch()`
  por los grupos activos (PNG transparente RGBA no entrelazado, tamaño exacto del grupo →
  encaje 1:1). Un solo POST con `texto_{letra}`/`estilo_{letra}` (persistidos en textos.json)
  + `imagen_{letra}` (PNG, firma verificada) → `handle_procesar` los guarda con
  `guardar_imagen()` → `Motor::procesar()` SIN cambios. Si un preset no existe en el
  navegador → abort con mensaje claro (nunca parcial). UI: la pestaña "Estilos de Texto" es
  el laboratorio; el texto+estilo por grupo se elige en "PDFs y procesamiento" (autoguardado
  AJAX con debounce, vista previa, badge "Texto activo"; el texto reemplaza la imagen manual
  del grupo al procesar). El módulo cambió SOLO en su API pública: `render-core.html`,
  caché de presets y `renderBatch` en `js/api.js` (retro-compatible), documentado en el
  ROADMAP.md del módulo (§10) y espejado en el proyecto fuente `sistema/textmuy`.
- **Normalización de presets e imágenes de TextMuy (v3.2.0, aprobada)**: el guardado de
  presets estaba "fuera de control" con 5 mecanismos (`.json` base embebidos, CRUD por
  `localStorage` invisible, imports TextStudio por `localStorage`, miniaturas en
  `localStorage`, proyectos `.txm`/`.webp` en una carpeta LOCAL del PC vía File System
  Access) y 3 paneles de UI. Normalización decidida con el usuario: (1) **un solo panel** —
  la galería inferior expandible es la única UI de presets (se eliminan el fieldset
  "Presets" y el fieldset "Local projects (.txm)" de la pestaña DOWNLOAD; el botón de
  guardar se muda a la galería); (2) **formato único `.txm`** — todo preset es
  `presets/{nombre}.txm` (delta textmuy-project, el mismo payload que ya usaban los
  proyectos) + `{nombre}.webp`; los 9 base migraron de `.json` con
  `scripts/migrate-presets-to-txm.js` (Node, con round-trip de sanidad) y los `.json` se
  borraron; las miniaturas se sirven de `presets/{nombre}.webp` con render lazy de fallback;
  el CRUD por `localStorage` se ELIMINÓ (las claves viejas `textmuy_presets` /
  `textstudio_presets` son solo lectura y la galería ofrece migrarlas al servidor una única
  vez); (3) **directorio de imágenes subidas** — `modules/textmuy/imagenes/` vía el puente
  PHP (§2.1.4): los settings guardan la URL del servidor en vez de data-URLs embebidas, y un
  picker "Mis imágenes" (modal) permite reutilizarlas entre presets. El usuario eligió
  guardar TODO dentro del módulo (`modules/textmuy/presets/` e `imagenes/`) conociendo los
  riesgos: al actualizar el módulo HAY que preservar los `.txm`/`.webp` del admin y
  `imagenes/` (regla en §10), y el hosting debe permitir escritura en la carpeta del plugin
  (el handler responde con error claro si no). El render-core incorpora
  `js/preset-manager.js` para resolver `.txm`; `?v=RC1`→`RC2` en ambos HTML. Etapa futura
  anotada: si algún día se deploya por git pull, separar los presets del usuario en
  `presets/usuario/` para poder gitignorarlos. [RESUELTA en v4.0.0: los datos del
   usuario viven en uploads y el modulo tiene repositorio propio (ver decision siguiente).]
- **Separacion plugin / modulo / datos de usuario (v4.0.0, aprobada)**: reorganizacion en
  3 capas decidida con el usuario. (1) **Datos de usuario en uploads**: presets
  (`.txm`+`.webp`) e imagenes del editor TextMuy pasan de `modules/textmuy/{presets,imagenes}`
  a `uploads/personalizador-pdf/textmuy/{presets,imagenes}` con migracion automatica
  (activacion/primer uso) que reescribe las URLs de imagen dentro de los `.txm`; el plugin
  queda 100% de solo lectura y se actualiza (ZIP o git pull) sin preservar archivos. SIN
  contenido de fabrica (no hay presets base ni catalogo SVG versionados): el admin crea sus
  presets y sube sus imagenes, y los JSON (`catalogo.json`) se generan en runtime. (2)
  **Modulo fuera del repo del plugin**: `modules/textmuy/` se quita del versionado
  (gitignored) y el proyecto TextMuy vive en su propia carpeta/repositorio `textmuy`
  (git propio, lo crea el usuario); se importa a mano a `modules/textmuy/` tras cada
  actualizacion (`modules/LEEME.md`). Sin modulo importado el plugin funciona: la pestana
  "Estilos de Texto" muestra un aviso y "PDFs" oculta la seccion de texto estilizado; el
  Procesar clasico (imagen por grupo) no cambia. (3) **Contrato**: nueva entrada
  `urls.presetsBase` en el puente + `PresetManager.presetUrlBase()` y su uso en
  `js/api.js` (retro-compatible, standalone sigue con ruta relativa); bump `RC9`.
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
php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php
php tests/motor_smoke.php    # smoke del motor: debe decir "SMOKE OK" (26 checks)
# Los tests leen muestra.pdf desde ../uploads/personalizador-pdf/pdfs/ (datos del usuario,
# NO versionados). Si falta, copiarlo desde el servidor o la carpeta de datos.
php tests/parity.php         # paridad del detector vs expected_muestra.json → "PARIDAD OK"
php tests/texto_puente.php    # puente TextMuy: guardar_texto + handle_procesar con PNGs (stubs WP)
# Tests del módulo TextMuy (requieren Node; el módulo vive en su carpeta/repositorio
# propio "textmuy", hermana del repo del plugin, o donde este importado):
cd ../textmuy && node tests/preset-cache.test.js && node tests/preset-delta.test.js
cd ../textmuy && node tests/preset-load.test.js && node tests/distort-engine.test.js
cd ../textmuy && node tests/flag-wave.test.js && node tests/pattern-block-box.test.js
node --check assets/admin.js  # sintaxis del puente JS
```

- Para probar el flujo completo en WordPress: subir `muestra.pdf`, cargar imagen en cada
  grupo y pulsar **Procesar PDF**.
- Para probar la pestaña "Estilos de Texto": abrirla en el admin y verificar que el iframe
  carga el editor de TextMuy (presets, canvas, exportación PNG).
- Requisitos del servidor: PHP 7.4+, zlib. GD opcional (sin GD: PNG puro + JPEG exacto).
  Node solo para los tests del módulo TextMuy (no corre en el servidor).

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
- El módulo TextMuy NO vive en este repo (gitignored desde 4.0.0): los cambios de TextMuy se
  hacen en su carpeta/repositorio propio (`../textmuy` o el proyecto fuente `sistema/textmuy`)
  y se importan a mano a `modules/textmuy/` tras cada actualización (`modules/LEEME.md`).
  Si modificás el módulo, corré sus tests Node y subí `?v=RCn` en ambos HTML.
- ⚠️ Al ACTUALIZAR el módulo `modules/textmuy/` (reemplazo de carpeta): NO hay nada que
  preservar desde 4.0.0 — los presets e imagenes del administrador viven en
  `uploads/personalizador-pdf/textmuy/` y el plugin los migra/lee desde ahi. Si la
  instalacion es anterior a 4.0.0 y aun no se abrio el admin, dejar que la migracion
  automatica haga el traslado ANTES de borrar la carpeta vieja.
- Cualquier cambio en `personalizador-pdf.php`, `admin/*` o `assets/*` debe mantener la
  compatibilidad legacy documentada (hooks/nonces `extractor_corel_*`, carpeta de uploads).
- Despliegue (v4.1): (1) subir la carpeta del plugin a `wp-content/plugins/personalizador-pdf/`;
  (2) importar el modulo: copiar `../textmuy` a `modules/textmuy/`; (3) subir la carpeta
  `uploads/personalizador-pdf/` COMPLETA a `wp-content/uploads/` (incluye
  `textmuy/{presets,imagenes}` con catalogo.json: son los datos del administrador). La
  migracion automatica del plugin (`migrar_textmuy()`) solo mueve a uploads lo que falte
  (nunca pisa datos existentes), asi que se puede desplegar antes o despues de activar.

## 11. Tabla de errores comunes (resolver antes de preguntar)

| Error | Causa | Solución |
|---|---|---|
| "Los datos guardados no coinciden con el PDF" | Dataset desactualizado | Re-analizar el PDF en el admin |
| "No se detectaron placeholders" | PDF sin rectángulos 100% transparentes | Exportar desde Corel con transparencia total; verificar tamaño mín 10x5 pt |
| "La extension GD no esta disponible y el JPEG no coincide..." | Se intentó JPEG sin GD con tamaño distinto | Activar GD o usar PNG |
| "PNG entrelazado no soportado sin GD" | PNG interlaced | Guardar la imagen sin entrelazar |
| Draws fuera de lugar / escala al cuadrado | Falta `q...Q` por draw en Overlay | Cada draw DEBE ir en su propio `q...Q` (sección 4.5) |
| `fopen(...): Failed to open stream` en Documents | Acceso controlado a carpetas de Windows | Escribir en `%TEMP%` (dev); en WP usar `wp_upload_dir()` |
| La pestaña "Estilos de Texto" no carga el editor | El iframe no sirvió `modules/textmuy/index.html` | Verificar que el módulo esté importado en `modules/textmuy/` (no viene con el plugin desde v4.0.0: ver `modules/LEEME.md`) y que el hosting sirva estáticos; mirar la consola del navegador |
| Un preset guardado en el editor no aparece en otro navegador | — | Resuelto v3.2.0/v4.0.0: los presets viven como `.txm` en el servidor (`uploads/personalizador-pdf/textmuy/presets/`), visibles en todos los navegadores |
| "El motor de render TextMuy no termino de cargar" al procesar | El iframe del render-core no cargó (estáticos bloqueados o red caída) | Reintentar; verificar `modules/textmuy/render-core.html` accesible; consola del navegador |
| "No se pudo recibir el texto renderizado del grupo X" | El PNG supera `upload_max_filesize`/`post_max_size` del servidor | Aumentar los limites de subida del hosting o usar estilos mas livianos |
| El texto renderizado sale con otra fuente | La familia Google Fonts no cargó (sin internet) o TTF local ausente | `ensureFontReady` fuerza la carga; verificar conexion; las TTF de `fonts/` caen a fallback |
| "El modulo TextMuy en cache esta desactualizado" (Vista previa/Procesar) | Cache del navegador con `js/api.js` de una version anterior | Recargar con Ctrl+F5; los estaticos del modulo ya se versionan con `?v=RCn` |
| "El directorio de presets/imagenes no es escribible" al guardar un preset o subir una imagen | El hosting bloquea escrituras en `uploads/` | Dar permisos de escritura a `wp-content/uploads/personalizador-pdf/textmuy/{presets,imagenes}` (desde v4.0.0 los datos del admin viven en uploads, no en la carpeta del plugin) |
| Un preset recién guardado no aparece en el selector de estilo de un grupo | La página "PDFs" estaba abierta antes de guardar el preset | Recargar la página: el listado se genera con glob en cada carga |
| Error del puente al guardar/borrar un preset tras tener el admin mucho tiempo abierto | Nonce de WP expirado (~12-24 h) | Recargar la página y reintentar |
| Al procesar con texto, navega a `wp-admin/[object HTMLInputElement]` | Colision de named properties del `<form>`: el `<input name="action">` pisa `form.action` del DOM | Corregido v3.1.2: el puente usa `form.getAttribute('action')`. Regla: con el patron admin-post NUNCA leer `form.action` en JS; usar el atributo |

---

*Este archivo consolida e integra el contenido de la antigua `FUNCIONALIDAD.md` y
`INFORME_DIFICULTADES.md`, que fueron eliminadas para tener una única fuente de verdad.*