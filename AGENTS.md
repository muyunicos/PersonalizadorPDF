# AGENTS.md — Contexto obligatorio del proyecto (LEER ANTES DE CUALQUIER CONSULTA)

> ⚠️ **PARA CUALQUIER IA**: este archivo debe leerse COMPLETO antes de editar, buscar o
> responder sobre el repositorio. Contiene el objetivo, la arquitectura, las reglas
> técnicas críticas, las decisiones de diseño ya tomadas y las dificultades del entorno.
> Si algo no está aquí, **preguntá al usuario**; no lo inventes.

---

## Índice

- [0. Resumen en una frase](#0-resumen-en-una-frase)
- [1. Objetivo y visión del sistema](#1-objetivo-y-vision-del-sistema)
- [2. Arquitectura y mapa de archivos](#2-arquitectura-y-mapa-de-archivos)
- [3. Flujo de trabajo](#3-flujo-de-trabajo)
- [4. Reglas técnicas críticas](#4-reglas-tecnicas-criticas)
- [5. Formatos y convenciones de nombres](#5-formatos-y-convenciones-de-nombres)
- [6. Motor PHP (engine/): responsabilidades](#6-motor-php-engine-responsabilidades)
- [7. Decisiones de diseño ya tomadas](#7-decisiones-de-diseno-ya-tomadas)
- [8. Dificultades del entorno](#8-dificultades-del-entorno)
- [9. Cómo probar](#9-como-probar)
- [10. Reglas para la IA al editar](#10-reglas-para-la-ia-al-editar)
- [11. Tabla de errores comunes](#11-tabla-de-errores-comunes)

---

## 0. Resumen en una frase

El plugin **Personalizador PDF** detecta "huecos" (rectángulos 100% transparentes) en un PDF
(comúnmente exportado desde **CorelDRAW**), los agrupa por **color**, permite cargar **una
imagen por grupo** y **reemplaza cada hueco por su imagen** (encajada, sin deformar ni
recortar), devolviendo un **PDF editado** optimizado. Motor 100% PHP.
Integra el sistema **TextMuy** (editor de estilos de texto client-side) en la pestaña
**"Estilos de Texto"** del admin.

## 1. Objetivo y visión del sistema

- **Universalidad**: debe procesar **cualquier PDF**. El usuario sube el PDF que quiera y el
  sistema lo procesa tal cual.
- **Placeholders**: en Corel se dibujan rectángulos vectoriales con transparencia total
  (fill_opacity = 0) donde irán fotos/nombres (credenciales, certificados, diplomas).
- **Grupos por color**: cada rectángulo transparente se asigna a un grupo según su color de
  relleno. El rectángulo **más grande** del grupo define el **tamaño base**.
- **Imágenes**: el admin carga una imagen por grupo (bitmap: PNG/JPG/WebP/GIF; material
  vectorial puede llegar rasterizado por el render de TextMuy en el navegador) o activa un
  módulo que la genere (hoy: TextMuy). El motor la inserta en **todas** las instancias del
  grupo.
- **Encajado (contain)**: la imagen **nunca** se deforma ni se recorta; se escala para caber
  entera dentro del placeholder y se centra; los márgenes sobrantes quedan transparentes.
- **TextMuy**: módulo autocontenido servido en un iframe same-origin. Los grupos del PDF
  pueden llevar "texto + estilo" y TextMuy renderiza la imagen del grupo al pulsar
  Procesar, 100% client-side (Canvas 2D + WebGL).
- **100% PHP**: el servidor funciona en hosting compartido sin Python ni Node. El código en
  servidor es PHP; el JS de TextMuy corre solo en el navegador.
- **API (uso principal a futuro)**: el principal uso del sistema es procesar compras de
  PDFs editados mediante una API con WordPress: el sistema recibe el nombre del PDF base y
  un conjunto de imágenes, y devuelve la URL al archivo procesado.

## 2. Arquitectura y mapa de archivos (v4.4: modulo integrado + norma ex-008 preservada)

Layout historico de despliegue (logico, sin git): la RAIZ DEL PROYECTO agrupaba
tres carpetas hermanas `personalizador-pdf/` (plugin) + `textmuy/` + `uploads/pmu/`.
Desde v4.2 ese `textmuy/` hermano es HISTORICO: el modulo vive integrado en
`modules/textmuy/` de este repo (ver LEEME.md). En este checkout el layout real es:

```
personalizador-pdf/              <- REPO GIT (en WP vive en
                                    wp-content/plugins/personalizador-pdf/)
├── personalizador-pdf.php
├── admin/ engine/ inc/ assets/ specs/ tests/
├── modules/textmuy/            <- Motor frontend TextMuy (integrado, control total)
└── uploads/pmu/                <- DATOS DE USUARIO (sin git): espejo de
                                    wp-content/uploads/pmu/. Se despliega
                                    COMPLETO al servidor.
```

Árbol del repo del plugin (la carpeta `personalizador-pdf/` de arriba):
```
personalizador-pdf/          (carpeta de instalación en WP: wp-content/plugins/personalizador-pdf/)
├── AGENTS.md                ← ESTE archivo (contexto obligatorio)
├── personalizador-pdf.php   ← Plugin WP (clase principal, menús, handlers PDFs/campos/config,
│                                   ciclo carrito→pedido, puente TextMuy; sin migraciones)
├── admin/
│   ├── page.php             ← Página admin con pestañas ("PDFs" | "Campos" | "Estilos de Texto" | "Ayuda")
│   ├── pdfs.php             ← Consola: subir PDF, grupos, mockups, imágenes, Procesar, completados
│   ├── campos.php           ← Catálogo global de campos reutilizables (campos.json)
│   ├── estilos-texto.php    ← Iframe del módulo TextMuy (aviso si no está integrado)
│   └── ayuda.php            ← Documentación interna
├── assets/
│   ├── admin.css            ← Estilos de consola + editor de mockups + iframe
│   ├── admin.js             ← Interfaz, validaciones y puente RenderCore
│   ├── tienda.js            ← Ficha Woo: campos, "Vista previa", galería, add-to-cart
│   └── mockups.js           ← Editor de capas 300x300 (delegado al módulo TextMuy)
├── engine/                  ← MOTOR PHP PURO
│   ├── Pdf.php              ← Parser (lectura de streams y objetos)
│   ├── Detector.php         ← Detección y agrupación de placeholders
│   ├── Metadata.php         ← Dataset JSON (`analisis.json` inmutable + `config.json` via motor)
│   ├── PngWriter.php        ← Generador PNG puro
│   ├── Imagen.php           ← Normalización y encajado RGBA
│   ├── Overlay.php          ← Inyector de objetos al PDF (splice)
│   └── Motor.php            ← Orquestador principal
├── inc/                     ← DUEÑO UNICO DE DATOS
│   ├── class-pmu-uploads.php ← PMU_Uploads: rutas, catálogos, ops, handle_request
│   ├── class-pmu-galeria.php ← PMU_Galeria: ayudante puro de miniaturas
│   └── class-pmu-sesion.php  ← PMU_Sesion: ciclo del comprador (sid/item/pool/manifest;
│                                   planeado en spec 004; T003)
├── modules/
│   ├── LEEME.md             ← Ficha del módulo integrado TextMuy + despliegue de datos
│   └── textmuy/             ← Motor frontend TextMuy (integrado, versionado, control total)
├── tests/
│   ├── motor_smoke.php      ← Test crítico del motor (CORRER SIEMPRE TRAS CAMBIOS)
│   ├── parity.php           ← Oráculo de detección (vs expected_muestra.json)
│   ├── texto_puente.php     ← Puente TextMuy con stubs WP (fases separadas)
│   ├── expected_muestra.json
│   └── fixtures/            ← Imágenes de prueba
└── readme.txt               ← Metadatos WP (README del plugin)
```

**Despliegue (v4.2)**: (1) subir la carpeta del plugin a `wp-content/plugins/`
(el módulo TextMuy ya viene integrado en `modules/textmuy/`); (2) subir
`uploads/pmu/` COMPLETA a `wp-content/uploads/` (incluye
`{fonts,img,tm-presets}` con sus catálogos: son los datos del administrador).

**Despliegue automático (webhooks Hostinger — implementaciones al hosting)**:
- Plugin (este repo): `https://webhooks.hostinger.com/deploy/1f050c10cad12026236eb07cf9fc7c11`
- Módulo TextMuy: `https://webhooks.hostinger.com/deploy/4df90409198182acd0a39f9fe786a033`

**Regla de oro: no crear duplicados.** Antes de agregar algo, revisá el árbol y reutilizá
lo existente. El módulo `modules/textmuy/` se versiona en este repositorio.

### 2.1 Contrato RenderCore (comunicación plugin ↔ módulo TextMuy)

El plugin NO conoce los internos de TextMuy. Consume un contrato público:

1. **Editor completo**: `modules/textmuy/index.html` en iframe same-origin. Si no está
   importado, el plugin muestra un aviso pero sigue funcionando en modo clásico.
2. **Motor de render headless**: `modules/textmuy/render-core.html` cargado on-demand en
   iframe off-screen. Expone `window.TextMuyAPI.renderBatch(items, {onProgress})`:
   renderiza lote por lote y rechaza ante el primer fallo (nunca un lote parcial), con
   `ensureFontReady` garantizando la fuente antes de renderizar.
3. **Catálogo y recursos**: presets, miniaturas e imágenes de usuario se leen desde
   `uploads/pmu/{fonts,img,tm-presets}` (ver §5) vía `urls.*Base` +
   `PresetManager.presetUrlBase()`. NO hay presets de fábrica. En los `.txm`
   las imágenes se guardan SOLO por id numérico del catálogo `img.json`
   (la URL se resuelve al renderizar vía `prepareImgRefs`).
4. **Puente de recursos**: el plugin pasa al iframe por postMessage
   `{type:'textmuy-bridge', bridge:{urls:{motor, miniaturas, presetsBase, fuentesBase,
   imagenesBase}, nonces:{motor}, presets, imagenes, fuentes}}` (fuente unica:
   `Personalizador_PDF_Plugin::puente_textmuy()`). El módulo interactúa SOLO con el endpoint
   `admin_post_pmu_uploads` (una credencial `nonces.motor` + capability; operaciones
   `op=` de presets/imágenes/fuentes). Sin puente el editor NO opera: muestra un
   error accionable y hace cero peticiones locales (no hay modo standalone).
5. **Versionado de estáticos (cache-bust)**: `render-core.html` e `index.html` referencian
   sus scripts internos con `?v=RCn` (**RC36 hoy**): al cambiar cualquier JS del módulo,
   subir el número en ambos HTML.
6. **Galería**: manejada internamente por el módulo (`js/galeria.js`), con preview en vivo.

## 3. Flujo de trabajo (cómo lo usa el admin de WordPress para pruebas)

1. **PDFs y procesamiento** (`admin/pdfs.php`):
   - **Subir PDF** → genera metadatos y extrae placeholders (grupos por color).
   - **Grupos** → el admin asigna una imagen (Media Library o PC) o activa **"Usar texto"**
     (texto + preset de TextMuy) u otras opciones según los módulos que se vayan
     incorporando al sistema.
   - **Procesar PDF** → si hay textos activos, `admin.js` renderiza PNGs vía RenderCore en
     el navegador (tamaño exacto del hueco) y envía UN POST único a `handle_procesar` con
     imágenes y textos (los mapeos persisten en `config.json` por grupo, `placeholders[id]`;
     la geometría vive en `analisis.json` y nunca se edita desde la UI; la consola muestra
     la fusión de ambos en `vista_grupos()`). El Motor orquesta
     y entrega el PDF editado (encajado, sin deformar ni recortar).
2. **Estilos de Texto** (`admin/estilos-texto.php`): laboratorio frontend TextMuy. Guardar
   un estilo crea un `.txm` + miniatura `.webp` en el servidor (uploads).
3. **Manejo de estados**:
   - Sobrescribir un PDF borra sus datos, imágenes y salida previas.
   - Grupos sin imagen asignada mantienen su transparencia original (el resumen avisa).
   - **Re-analizar** regenera el dataset si el PDF cambió manteniendo el nombre.
4. **Ciclo del comprador (spec 004, ficha → pedido)**:
   - La ficha Woo pinta el panel del comprador (`woocommerce_before_add_to_cart_form`,
     `panel_ficha_html()` + `PMU_FICHA`) si el producto lleva `_pmu_pdf_slug` y el PDF está
     activo con grupos; también existe el shortcode `[pmu_personalizar pdf="slug"]`.
   - "Vista previa" → `handle_vista_previa` crea/reusa el item (`tmp/sesion-{sid}/`,
     cookie `pmu_sid`), renderiza con RenderCore (`tienda.js`, paralelo), sube los PNG al
     pool por `handle_pool_png` (hash `sha1(valor|preset|settings|WxH)`; `limpiar=1`
     reemplaza el grupo) y compone los mockups 300x300 en la galería. Re-edición desde
     el carrito (`?pmu_item_key=`) reusa el item y regenera SOLO los hashes cambiados.
   - `add-to-cart` → `carrito_validar` (exige draft ok/omisible; con `preview_omisible`
     crea el item en el servidor) + `carrito_promover` (rename a `{cart_item_key}`,
     congela `mockup-{id}.webp` y marca `preview_estado=ok`). Cantidad fija 1;
     quitar del carrito borra el item. "Editar" vuelve a la ficha con el item cargado.
   - Pedido → `pedido_item_crear` copia la meta al item Woo y hace staging
     (`tmp/orders/{id}/`); al pagarse `pedido_promover` lo renombra a `orders/{id}/{item}/`.
     El comprador descarga en `mi-cuenta/descargas/` (`item_generar_pdf`, idempotente,
     arma el PDF desde el índice del pool con `Motor::procesar_pedido`). La consola lista
     los completados (sección 4) con "Regenerar PDF".

## 4. Reglas técnicas críticas (¡NO MODIFICAR sin entenderlas!)

1. **Detección de placeholders**:
   - Tipo `re` transformado o 4 líneas rectas cerradas (incluso rectángulos **rotados**:
     lados opuestos paralelos e iguales; la instancia lleva `dev_quad`).
   - `fill_opacity` ≤ 0.001 (transparencia total).
   - Tamaño mínimo: 10×5 pt (anti-artefactos).
2. **Agrupación**: clave = color RGB (3 decimales), orden determinista; cada grupo se
   identifica por `id` = color hex `RRGGBB` sin `#` (ej. `0000FF`) en datasets, archivos,
   formularios, URLs y puente. Se toma la figura de mayor área como base. Medidas SIEMPRE
   en px (base 200 ppp: `px = pt * 200/72` redondeado arriba).
3. **Encajado (contain)**: escala adaptativa `min(W/iw, H/ih)`, jamás estirar ni recortar.
4. **Overlay y CTM (`q ... Q`)**: cada "draw" debe ir aislado en su propio bloque `q ... Q`
   para no heredar la escala de iteraciones previas en la misma página (bug corregido).
5. **Z-Order (splice)**: cada imagen se inserta EN EL CONTENT STREAM ORIGINAL justo ANTES
   de su operador de relleno (`f`). Esto preserva los clips y ornamentos superpuestos.
6. **Fix de transparencia (`/ECOp1`)**: las imágenes insertadas heredan la opacidad 0 del
   placeholder. Solución obligatoria: ExtGState `/ECOp1` (`ca 1 /CA 1`) en la página y
   anteponer `q /ECOp1 gs ... Q` a cada draw.
7. **Sin dependencias nativas**: motor puramente PHP. Sin GD → decodificador PNG propio +
   JPEG exacto incrustado (DCTDecode); con GD, todo.

## 5. Formatos y convenciones de nombres (NO CAMBIAR)

Todo archivo dinámico o de usuario **VIVE EN UPLOADS**, no en el directorio del plugin:

- Raíz de datos: `uploads/pmu/`
- Ámbitos del editor: `fonts/` (catálogo `fonts.json`), `img/` (catálogo `img.json`) y
  `tm-presets/` (catálogo `presets.json`); un sprite `thumbs.webp` por ámbito, junto a su
  catálogo. El sprite está **certificado** por su catálogo (`thumbs.{w,h,c}` +
  `thumbs.sprite_firma` = `[w,h,c,items]`; `op=sprite` rechaza con causa
  `motor:sprite:catalogo:desactualizado` si la firma no coincide con el catálogo
  vigente). `pdfs/`, `orders/` y `tmp/` son ámbitos de datos del motor, sin catálogo ni sprite.
- Datasets PDF: `pdfs/{nombre}/analisis.json` (geometría inmutable del Detector: grupos
  `id`/`w`/`h`/`cont`/`pgs`) + `pdfs/{nombre}/config.json` (editable: `activo`, `productos`,
  `campos_ids`, `preview_omisible` (bool, default `false` = mockup obligatorio en ficha),
  `mockups[]` (plantillas de vista previa: `capas[]` con `tipo`/`ref`/`x`/`y`/`w`/`h`/
  `rot`/`sesgo`/`filtros`; canvas 300x300), `placeholders[id]` con
  `tipo`/`preset`/`value`/`settings`).
  Sin `textos.json` y sin `metadata.json`
  (norma ex-008 + decision preview 2026-09-17; la migración `.migrado-007` ya no se ejecuta).
- Fotos de mockups del admin: `pdfs/{nombre}/mockups/` (datos de usuario, sin catálogo);
  las reutilizables viven en el catálogo `img/`.
- Catálogo global de campos: `campos.json` en la raíz de `uploads/pmu/` (items con
  `id` auto no reutilizable, `titulo_cliente`, `tipo`, `array`, valor dual
  `valor`(sistema)/`cliente`(etiqueta); detalle en `specs/004.../contracts/campos.md`).
- Imágenes aplicadas (muestras del panel): `tmp/muestras/{nombre}/{id}.{ext}` (un archivo
  por grupo, se sobrescribe en cada Procesar)
- Placeholders: sin archivos en disco; marco dibujado en la consola + descarga generada
  al vuelo (`PngWriter::bytes(w, h)`)
- Salida de muestra: `tmp/muestras/{nombre}/{nombre}_procesado.pdf` (se sobrescribe)
- Comprador (ciclo carrito → pedido; el cableado a hooks Woo vive en spec 004):
  borradores legacy en `tmp/cart/{linea}/` (`manifest.json` con `pdf`, personalizacion
  canonica, `pmu_hash`, cantidad, `creado`, motor) + unidad vigente ex-008 en
  `tmp/sesion-{sid}/{item_key}/` por ITEM (`manifest.json` + pool `img/` DEDICADO
  (`img/{pdf}-{id}-{n}.png`, numerados si hay varios por `id`; sin deduplicacion global
  entre items) + `mockup-{id}.webp` congelados 300x300; `draft-{uuid}` →
  `cart_item_key`; mockup obligatorio en ficha antes del add-to-cart, salvo
  `config.json:preview_omisible=true`); `preview_estado` en meta (`ok`|`sin_vista`|`omisible`);
  canonico comprador = meta del item Woo + espejo `tmp/sesion-{sid}/{item_key}/` para el Motor; staging en
  `tmp/orders/{order_id}/`, entregable por linea en `orders/{order_id}/{item_key}/`
  (promocion por `rename()` solo al confirmarse el pago); PDF final solo tras el pago
  (boton "Descargar" en `mi-cuenta/descargas/`: render cliente + Motor, reintentable;
  registro admin de pedidos "completados" para revisar/regenerar)
- Migracion historica `.migrado-007` (`uploads/personalizador-pdf/` o `extractor-corel/`
  → `pdfs/{nombre}/`): ya retirada del codigo (fase `migracion` del arnes lo verifica:
  sin metodo `migrar_datos_heredados`). Migracion ex-008 pendiente (partir ex-`metadata.json`
  en `analisis.json`+`config.json`, mover `tmp/cart/{linea}/` bajo `tmp/sesion-{sid}/{item_key}/`;
  norma preservada en `constitution` §IV).
- **Archivos TextMuy (datos de usuario, formato unico v5.0)** — ubicacion unica
  y definitiva `uploads/pmu/tm-presets/`:
  - Presets: `tm-presets/{nombre}.txm` (delta `textmuy-project` v1 con referencias numericas)
  - Miniaturas: `thumbs.webp` unico por ambito (derivado del catalogo)
  - Endpoint unico (nonce `pmu_uploads` + capability): `admin_post_pmu_uploads` con `op=`
  - Catalogo: `tm-presets/presets.json` con estructura `{thumbs:{w,h,c}, items:[[id,title,cats,file],...]}`

## 6. Motor PHP (engine/): responsabilidades

- **`Pdf.php`**: parser base (lectura pura de objetos/streams/xref).
- **`Detector.php`**: análisis del PDF, detección y agrupación de cajas transparentes.
- **`Metadata.php`**: dataset del producto (`analisis.json` inmutable via
  `Metadata::generarAnalisis/guardar/cargar` + `config.json` editable via
  `PMU_Uploads::leer_config/guardar_config`; constantes `ARCHIVO_ANALISIS`/`ARCHIVO_CONFIG`).
- **`PngWriter.php`**: generador de PNG transparente sin dependencias.
- **`Imagen.php`**: normalizador de imágenes a RGBA / encajado (contain).
- **`Overlay.php`**: empaquetado final (modificación e inyección de bytes en el PDF).
- **`Motor.php`**: orquestador principal del flujo (PDF + dataset + imágenes → PDF editado).

## 7. Decisiones de diseño ya tomadas

- ❌ **Sin Python**: backend estrictamente en PHP (la v1 fue Flask + Python; migrada).
- ✅ **Único panel UI para presets**: la galería inferior expandible de TextMuy es el único
  punto para buscar/guardar/borrar presets. No recrear los antiguos menús.
- ✅ **Formato único para presets**: todo preset es `.txm` (delta de settings) + celda
  en el sprite unico `tm-presets/thumbs.webp` (200x100, sin `.webp` suelto por preset).
  Ya no se usa `localStorage` ni `.json` para guardar.
- ✅ **Separación estricta de datos (v4.0.0)**: todo dato o recurso aportado por el
  administrador reside en `uploads/pmu/` (ámbitos `fonts`, `img`, `tm-presets`; ver §5). La carpeta del plugin y la
  del módulo son reemplazables/actualizables sin perder información. Sin contenido de
  fábrica: el admin crea sus presets y sube sus imágenes.
- ✅ **Módulo integrado (v4.2)**: TextMuy vive en `modules/textmuy/` de este repositorio,
  bajo control total; se edita directamente, se corren sus tests Node y se hace bump
  `?v=RCn` en ambos HTML al tocar su JS.
- ✅ **Layout de PDFs (norma ex-008 vigente, ex-007)**: cada producto vive en
  `uploads/pmu/pdfs/{nombre}/` (`{nombre}.pdf` + `analisis.json` inmutable del Detector +
  `config.json` editable con `activo`/`productos`/`campos_ids`/`preview_omisible`/`placeholders[id]`, clave
  `id` = color hex; sin `textos.json` ni `metadata.json`);
  muestras idempotentes en `tmp/muestras/{nombre}/`; ciclo comprador en `tmp/cart/`
  (legacy) + `tmp/sesion-{sid}/{item_key}/` (vigente, mockup obligatorio en ficha
  `draft-{uuid}` → `cart_item_key` salvo `preview_omisible=true`; canonico = meta item Woo +
  espejo sesion), staging en `tmp/orders/` y entregable en
  `orders/{order_id}/{item_key}/` (PDF final solo tras el pago, boton "Descargar" en
  Descargas + registro admin "completados"); migracion `.migrado-007` ya retirada. La consola nunca muestra la pagina de error critico por fallos
  de recursos del motor (aviso con causa, HTTP 200).
- ✅ **Conciliacion ex-008 (normativa, preservada en `constitution` §IV)**: el antiguo
  `specs/008-sesion-cart-preview/spec.md` NO era feature implementable: normaba 004 vs 007
  (`analisis.json`+`config.json`, `tmp/sesion-{sid}/{item_key}/`, preview obligatoria
  `draft-{uuid}` → `cart_item_key`). Fue eliminado tras preservarse su §0+§6 en la
  constitucion; lo nuevo se alinea a esa norma.
- ✅ **Specs historicos**: 003 obsoleto (superado por 006); 004 tasks 100% pero diseño
  historico (normativo = constitucion §IV, ex-008); 006/007 casi cerrados salvo verificaciones manuales
  en panel WP real (ver sus `tasks.md`).
- ✅ **Hooks legacy**: `seguridad()` acepta nonce historico `extractor_corel_*` (<= 2.0.0)
  ademas del vigente `personalizador_pdf_*` (se considera codigo legacy).
- ✅ **Jerarquia documental**: `constitution` > este AGENTS.md > resto (`readme.txt`,
  `admin/ayuda.php`, `modules/LEEME.md` solo resumen y apuntan aqui). El `== Changelog ==`
  de `readme.txt` es historial, no normativa.

## 8. Dificultades del entorno (IMPORTANTE AL TRABAJAR AQUÍ)

- ⚠️ **Rutas con espacios**: al ejecutar comandos, envolvé las rutas entre comillas.
- ⚠️ **PowerShell/cmd con escaping problemático**: preferí comandos simples de `cmd /c`;
  no encadenes con `&&` (falla en esta versión de PowerShell) ni anides comillas.
  `findstr` con patrones de paréntesis o pipes no matchea en este entorno.
- ⚠️ **Búsquedas de código**: `search_codebase` no indexa bien los `.php`; si un patrón no
  aparece, leé el archivo directamente.
- ⚠️ **Permisos Windows**: si un script PHP de testing falla al escribir en Documents,
  escribí los temporales en `%TEMP%` (`sys_get_temp_dir()`). En WP real usar siempre
  `wp_upload_dir()`.
- ⚠️ **Rutas web**: no intentes fetch a URLs de `wp-admin` (requiere auth → 404); asumí la
  lógica según `admin/*.php`.

## 9. Cómo probar

### Entorno PHP (plugin) — desde la carpeta del plugin, tras tocar `engine/` o `admin/`
```bash
php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php && php -l inc/*.php
php tests/motor_smoke.php     # Smoke del motor (debe decir "SMOKE OK")
php tests/parity.php          # Oráculo del detector (debe decir "PARIDAD OK")
php tests/texto_puente.php    # Arnes con stubs WP, una fase por proceso:
                              # setup | guardar_ajax | guardar_vacio | procesar |
                              # rechazo | contenido | placeholder | admin |
                              # linea | campos | config | tienda | pedido |
                              # migracion | nonce [cap]
```
Los tests leen `muestra.pdf` desde `uploads/pmu/pdfs/` (datos del
usuario, NO versionados). `parity.php` acepta la ruta como argumento opcional.
`texto_puente.php` crea su entorno aislado en `%TEMP%` (`preparar_entorno()`:
`pdfs/muestra/` + `analisis.json` + `config.json` + preset `neon-glow`).

### Entorno Node (módulo TextMuy) — si se modifica `modules/textmuy/`
```bash
cd modules/textmuy
node tests/catalog-unified.test.js && node tests/fonts-catalog.test.js && node tests/img-refs.test.js
node tests/preset-cache.test.js && node tests/preset-delta.test.js && node tests/preset-load.test.js
node tests/distort-engine.test.js && node tests/flag-wave.test.js && node tests/pattern-block-box.test.js
node tests/controls-init.test.js
```
(Node NO corre en el servidor productivo de WP: es solo testing del módulo.)

## 10. Reglas para la IA al editar

- ✅ OBLIGATORIO: leer este AGENTS.md completo antes de proponer cambios arquitectónicos.
- ✅ OBLIGATORIO: ejecutar `php tests/motor_smoke.php` y `php -l` tras cambiar `engine/`.
- ✅ OBLIGATORIO: mantener mensajes, variables e interfaz estrictamente en español (sin
  tildes en código puro para evitar problemas de encoding).
- ❌ NO DEBES: crear nuevos archivos, páginas o motores sin confirmar con el usuario si ya
  existe código que resuelva el problema.
- ❌ NO DEBES: reintroducir Python.
- ✅ El módulo `modules/textmuy/` es parte de este repositorio y está bajo control total:
  se edita directamente, se corren sus tests Node (`node --check` + 10 suites) y se hace
  bump `?v=RCn` en ambos HTML al tocar su JS.
- ❌ NO DEBES: guardar datos generados por el admin dentro de la carpeta del plugin
  (siempre usar `uploads/` según §5).
- ❌ NO DEBES: leer `form.action` del DOM con el patrón admin-post: usar
  `form.getAttribute('action')` (ver tabla §11).

## 11. Tabla de errores comunes (resolver antes de preguntar)

| Error | Causa | Solución |
|---|---|---|
| "Los datos guardados no coinciden con el PDF" | Dataset desactualizado | Re-analizar el PDF en el admin |
| "No se detectaron placeholders" | Cajas incorrectas | Transparencia total + mínimo 10x5 pt |
| Draws fuera de lugar / escala al cuadrado | CTM no aislado | Cada draw de Overlay en su propio `q ... Q` |
| Imagen dibujada 100% transparente | Falta ExtGState | Anteponer `q /ECOp1 gs` al inyectar imagen |
| Iframe de "Estilos" no carga el editor | Módulo ausente | Verificar importación de `textmuy/` a `modules/` (LEEME.md) |
| "El modulo TextMuy en cache esta desactualizado" | JS viejo del módulo en cache | Ctrl+F5; bump `?v=RCn` al cambiar JS del módulo |
| Error guardando preset o subiendo imagen | Permisos de escritura | Asegurar permisos en la carpeta respectiva de `uploads/` |
| "No se pudo recibir el texto renderizado del grupo X" | PNG supera límites del servidor | Subir `upload_max_filesize`/`post_max_size` o usar estilos más livianos |
| El texto renderizado sale con otra fuente | Google Fonts sin internet o TTF local ausente | `ensureFontReady` fuerza la carga; verificar conexión |
| Un preset guardado no aparece en otro navegador | — | Resuelto: presets `.txm` en `uploads/pmu/tm-presets/` |
| Un preset recién guardado no aparece en el selector de un grupo | Página "PDFs" abierta antes de guardar | Recargar: el listado se genera con glob en cada carga |
| Navegación a `wp-admin/[object HTMLInputElement]` al Procesar | Colisión de atributos del `<form>` | Usar `form.getAttribute('action')`, NUNCA `form.action`, al interceptar |
| Error del puente tras tener el admin mucho tiempo abierto | Nonce expirado (~12-24 h) | Recargar la página y reintentar |
