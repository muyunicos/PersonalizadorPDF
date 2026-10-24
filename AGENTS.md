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
- **IA opcional (solo pruebas de admin)**: la pestaña Test puede enviar imágenes a un
  servicio Real-ESRGAN separado que corre en la PC, pasando por WordPress y HTTPS. El token
  compartido se guarda en las opciones de WordPress (no cifrado por el plugin) y se manda
  solo servidor a servidor; la URL oficial prevista es `https://ai.loc.ar` y la prueba no
  se usa en la ficha del comprador.
- **Encajado (contain)**: la imagen **nunca** se deforma ni se recorta; se escala para caber
  entera dentro del placeholder y se centra; los márgenes sobrantes quedan transparentes.
- **TextMuy**: módulo autocontenido servido en un iframe same-origin. Los grupos del PDF
  pueden llevar "texto + estilo" y TextMuy renderiza la imagen del grupo al pulsar
  Procesar, 100% client-side (Canvas 2D + WebGL).
- **Motor PHP**: el plugin procesa PDFs en hosting compartido sin Python ni Node. El servicio
  IA opcional de la PC es independiente del motor y solo se usa desde Test; el JS de TextMuy
  corre en el navegador.
- **API (objetivo de negocio, uso principal a futuro)**: procesar compras de PDFs editados
  mediante una API con WordPress: el sistema recibe el nombre del PDF base y un conjunto de
  imágenes, y devuelve la URL al archivo procesado. **Especificada, sin implementar**:
  [spec 010](./specs/010-api-wordpress/spec.md) + contrato
  [contracts/api.md](./specs/010-api-wordpress/contracts/api.md). Decisiones cerradas 2026-10-01:
  raster por grupo (el texto con estilo llega ya rasterizado desde el consumidor; el servidor
  nunca renderiza texto, constitution §III), validación estricta de ids contra `analisis.json`,
  autenticación por Application Passwords + `manage_options` + HTTPS, entregable en
  `uploads/pmu/api/{job_id}/` con TTL de 7 días e idempotencia por `job_id`, respuesta síncrona, y
  **un único endpoint** `admin_post_pmu_api` con `op=` (sin rutas REST).

## 2. Arquitectura y mapa de archivos (v4.2.2: modulo integrado + norma ex-008 preservada)

Layout historico de despliegue (logico, sin git): la RAIZ DEL PROYECTO agrupaba
tres carpetas hermanas `personalizador-pdf/` (plugin) + `textmuy/` + `uploads/pmu/`.
Desde v4.2 ese `textmuy/` hermano es HISTORICO: el modulo vive en
`modules/textmuy/`, que es su **repositorio propio** (`muyunicos/textmuy`, el original;
no un clon) dentro del arbol del plugin (ver LEEME.md). Se edita aqui, pero sus commits
y push van EN ESE repo. En este checkout el layout real es:

```
personalizador-pdf/              <- REPO GIT (en WP vive en
                                    wp-content/plugins/personalizador-pdf/)
├── personalizador-pdf.php
├── admin/ engine/ inc/ assets/ specs/ tests/
├── modules/textmuy/            <- Motor frontend TextMuy (repo propio: muyunicos/textmuy)
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
│   ├── page.php             ← Página admin con pestañas ("PDFs" | "Campos" | "Estilos de Texto" | "Pedidos" | "Test" | "Ayuda")
│   ├── pdfs.php             ← Consola: subir PDF, grupos, mockups, imágenes, Procesar
│   ├── campos.php           ← Campos reutilizables (spec 012) + UX de consola (spec 013:
│                              lista primero, alta como boton, drawer para editar, estilos
│                              globales al pie y plegados; el <tbody> tiene SOLO filas y
│                              los formularios viven dormidos en #ec-campo-forms)
│   ├── estilos-texto.php    ← Iframe del módulo TextMuy (aviso si no está integrado)
│   ├── pedidos.php          ← Pestaña Pedidos: items entregados (orders/), Regenerar PDF / Descargar
│   ├── test.php             ← Pestaña Test: botón del smoke test en vivo (tabla OK/FALLA)
│   └── ayuda.php            ← Documentación interna
├── assets/
│   ├── admin.css            ← Estilos de consola + editor de mockups + iframe
│   ├── admin.js             ← Interfaz, validaciones y puente RenderCore
│   ├── tienda.js            ← Ficha Woo: campos, "Vista previa", galería, add-to-cart
│   ├── mockups.js           ← Editor de mockups del admin (2 columnas, lienzo
│   │                             ampliable, manipulacion directa; DELEGA el render
│   │                             en `mockup-render.js` y la geometria en
│   │                             `mockup-geometria.js`; spec 011)
│   ├── mockup-render.js      ← NUCLEO de composicion del mockup (Canvas 2D):
│   │                             `PMUMockup.componer/contener/filtroCss/esValida`.
│   │                             UNICA funcion de render del sistema: la usan el
│   │                             editor y la ficha (spec 011, R1)
│   ├── mockup-geometria.js   ← Geometria PURA del editor (acotar, imanes, tiradores,
│   │                             rotacion, acertar, alinear, distribuir). Sin DOM;
│   │                             testeada con `node tests/mockup-geometria.test.js`
│   │                             y `node tests/mockup-contrato.test.js` (cableado)
│   ├── campo-montar.js      ← Montaje COMPARTIDO de campos (spec 012): lo usan la ficha del
│   │                          comprador y el preview del admin (una sola lógica, DRY)
│   ├── cargador-pmu.js      ← Cargador de imágenes del comprador (spec 012): N ranuras
│   │                          sobre SelectorPMU; valida `min` y sube la foto al item
│   ├── selector-pmu.js      ← Cliente de subida/recorte de imágenes de campos (spec 004,
│   │                          contrato `specs/004.../contracts/selector-pmu.md`; editor visual
│   │                          spec 016; spec 021: motor propio Canvas 2D sin dependencias)
│   ├── visor-pmu.js         ← Visor fullscreen COMPARTIDO (PMUVisor: ranura + biblioteca; spec 030 D28)
│   ├── biblioteca-pmu.js    ← Biblioteca del comprador (spec 030): copia local v2 (metadatos), tira
│   │                          adaptativa, visor (Elegir/Borrar) y usar (0 bytes); se calienta en la ficha
│   └── miniaturas.js        ← ThumbEngine: miniaturas `.webp` y sprites por ámbito; único
│                              cliente de `op=sprite`/`op=miniatura` (envía `firma`; nunca
│                              escribe catálogos). Se encola en admin y su URL viaja al iframe
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
│   ├── envolturas.php       ← Envolturas PowerClip -> envolturas.json (PDF sintéticos CLI)
│   ├── texto_puente.php     ← Puente TextMuy con stubs WP (fases separadas)
│   ├── campos_migracion.php ← CRUD de campos v3 (specs 012 + 015, corre en %TEMP%)
│   ├── certificacion_hoja.php ← Certificación de `thumbs.sprite_firma` (ThumbEngine)
│   ├── inventario_repo.php  ← Inventario de CODIGO del repo (genera docs/inventario-repo.md)
│   ├── inventario_pmu.php   ← Inventario de DATOS de usuario (manifiesto uploads/pmu/)
│   ├── estado_pmu.php       ← Estado del espejo uploads/pmu (solo lectura)
│   ├── sin_lectura.php      ← LEER no escribe catalogos (RC47)
│   ├── campos-contrato.test.js ← Contrato del montaje de campos + cargador (spec 012)
│   ├── conciliacion.js      ← `PURO.conciliarGrupo` (spec 012, D17-D19)
│   ├── expected_muestra.json
│   └── fixtures/            ← Imágenes de prueba
├── .vscode/
│   └── settings.json        ← Terminal integrada en PowerShell (pwsh si está instalado)
├── docs/
│   └── entorno-desarrollo.md ← Entorno canónico: Windows + PowerShell 7, Spec Kit + Cline
├── README.md                ← Presentación del repo + resumen del entorno
└── readme.txt               ← Metadatos WP (README del plugin)
```

Herramientas locales de desarrollo (en `.gitignore`, no versionadas): `.specify/` (estado
del flujo Spec Kit y scripts `powershell/`) y `.clinerules/` (workflows `/speckit-*` de la
integración `cline`). El entorno (Windows + PowerShell 7, Spec Kit/Cline, verificaciones y
diagnóstico) está documentado en `docs/entorno-desarrollo.md` y resumido en §8.

**Despliegue (v4.2)**: (1) subir la carpeta del plugin a `wp-content/plugins/`
(el módulo TextMuy ya viene integrado en `modules/textmuy/`); (2) subir
`uploads/pmu/` COMPLETA a `wp-content/uploads/` (incluye
`{fonts,img,tm-presets}` con sus catálogos: son los datos del administrador).

**Despliegue automático (webhooks Hostinger — implementaciones al hosting)**:
- Plugin (este repo): `https://webhooks.hostinger.com/deploy/1f050c10cad12026236eb07cf9fc7c11`
- Módulo TextMuy: `https://webhooks.hostinger.com/deploy/4df90409198182acd0a39f9fe786a033`

**Deploy: el usuario despliega con el boton Implementar de Hostinger**, sobre 3 repos:

| Repositorio | Rama | Ruta en el servidor |
|---|---|---|
| `muyunicos/muyunicos` | `main` | `/wp-content/themes/generatepress-child` |
| `muyunicos/PersonalizadorPDF` (este) | `main` | `/wp-content/plugins/personalizador-pdf` |
| `muyunicos/textmuy` | `main` | `/wp-content/plugins/personalizador-pdf/modules/textmuy` |

Cuando haya que levar cambios al servidor: **commitear y pushear** y decirle solo
"implementa y hace Ctrl+F5". **No pedirle que suba ficheros a mano.** Si se toco
`modules/textmuy/`, ademas hay que commitear y pushear alli (su repo propio:
`muyunicos/textmuy`).
**Regla de oro: no crear duplicados.** Antes de agregar algo, revisá el árbol y reutilizá
lo existente. El módulo `modules/textmuy/` es un repositorio git propio dentro de este
checkout: se edita aquí, pero sus commits y push van EN ESE repo (este repo solo registra
el commit del módulo).

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
   sus scripts internos con `?v=RCn` (**RC74 hoy**): al cambiar cualquier JS del módulo,
   subir el número en ambos HTML.
6. **Galería**: manejada internamente por el módulo (`js/galeria.js`), con preview en vivo.
   La lectura es **canónica y certificada** en los **tres** ámbitos (`fonts`, `img`, `tm-presets`):
   `drawTileCanonico(ambito, id)`, con la celda derivada del identificador (`id-1`) y la
   vigencia atestiguada por `thumbs.sprite_firma` del catálogo. Con hoja certificada la apertura
   es **0 descargas de contenido**; si no certifica (o faltan celdas) se
   pinta el placeholder y **genera sola los huecos** (F1 dibuja en memoria; F2 persiste UNA vez
   por ámbito y apertura con `op=sprite` + `firma`); si algo falla, muestra la causa exacta
   con un botón **Reintentar** (en las tres galerías desde RC74). El único cliente que escribe
   es `assets/miniaturas.js` (ThumbEngine) vía `op=sprite`/`op=miniatura`; los botones "Generar
   miniaturas" y "Miniaturas" ya no existen. La lectura certificada cubre los tres ámbitos y
   el ámbito `mockups` (con catálogo) **no certifica**: ver §5.

## 3. Flujo de trabajo (cómo lo usa el admin de WordPress para pruebas)

1. **PDFs y procesamiento** (`admin/pdfs.php`):
   - **Subir PDF** → genera metadatos y extrae placeholders (grupos por color).
   - **Grupos** → el admin asigna una imagen (Media Library o PC) o activa **"Usar texto"**
     (texto + preset de TextMuy) u otras opciones según los módulos que se vayan
     incorporando al sistema.
   - **Acciones sin recarga**: todo POST de la consola pasa por `pmuPost()` (`pmu-core`
     en `assets/admin.js`) y **la unica via de respuesta es JSON** (`responder()` nunca
     redirige; sin JS la consola muestra un `<noscript>` de aviso). Los errores se
     pintan inline en vez de pagina en blanco. Solo recargan en exito: **Subir PDF**
     (lista de grupos nueva), **Re-analizar** y **Borrar**; esas recargas llevan
     `ec_subido`/`ec_reanalizado`/`ec_borrado` en la URL para pintar el notice. Un
     nombre ya usado abre el modal del JS (`nombre_existente:`).
   - **Mockups** (acordeon): las fotos de referencia se suben/borran desde la consola
     (`handle_mockup_subir/borrar`, respuesta JSON con la lista `fotos` refrescada) y
     quedan en `pdfs/{nombre}/mockups/`; el editor (`mockups.js`) las lee de
     `PersonalizadorPDF.mockups.fotos` al momento de listar/renderizar, por lo que
     **la capa "Foto" recien es utilizable**.
   - **Procesar PDF** → si hay textos activos, `admin.js` renderiza PNGs vía RenderCore en
     el navegador (tamaño exacto del hueco) y envía UN POST único a `handle_procesar` con
     imágenes y textos (los mapeos persisten en `config.json` por grupo, `placeholders[id]`;
     la geometría vive en `analisis.json` y nunca se edita desde la UI; la consola muestra
     la fusión de ambos en `vista_grupos()`). El Motor orquesta
     y entrega el PDF editado (encajado, sin deformar ni recortar).
   - **Configuración tienda → "Validez por producto"** (spec 005): por cada producto
     asociado (chips) se declaran `activo` (hidden+checkbox), `validez` (expresión JS que
     evalúa el navegador; el servidor solo valida su sintaxis al guardar), `mensaje_html`
     (allowlist) y `bloquear` (visible solo si hay `validez`). El handler guarda con
     `tienda_presente=1` (nunca toca `tienda` si la sección no viajó) y poda asociaciones
     huérfanas; un valor viejo que hoy no compila se conserva (lectura tolerante) y solo se
     rechaza lo nuevo/alterado con causa visible.
2. **Estilos de Texto** (`admin/estilos-texto.php`): laboratorio frontend TextMuy. Guardar
   un estilo crea un `.txm` + miniatura `.webp` en el servidor (uploads).
3. **Test** (`admin/test.php`): botón **Ejecutar smoke test** → `handle_smoke_test`
   (`admin_post_personalizador_pdf_smoke`) corre `smoke_checks()` contra el sitio real
   (entorno, permisos, catálogos, motor sobre los PDFs subidos, hooks, TextMuy, Woo y
   render de la consola) y devuelve la tabla OK/FALLA. Guarda
   `personalizador_pdf_smoke_ultimo` (option) y avisa si la versión instalada cambió
   desde la última corrida: sirve como control post-deploy (el webhook de Hostinger solo
   sube archivos, no ejecuta nada). No usa `exec()` ni modifica datos.
4. **Manejo de estados**:
  - Sobrescribir un PDF borra sus datos, imágenes y salida previas.
  - Grupos sin imagen asignada mantienen su transparencia original (el resumen avisa).
  - **Re-analizar** regenera el dataset si el PDF cambió manteniendo el nombre.
5. **Ciclo del comprador (spec 004, ficha → pedido)**:
   - La ficha Woo pinta el panel del comprador (`woocommerce_before_add_to_cart_form`,
     `panel_ficha_html()` + `PMU_FICHA`) si el producto lleva `_pmu_pdf_slugs` (lista;
   spec 005, con respaldo tolerante del singular `_pmu_pdf_slug`) y el PDF está
     activo con grupos; también existe el shortcode `[pmu_personalizar pdf="slug"]`.
   - "Vista previa" → `handle_vista_previa` crea/reusa el item (`tmp/sesion-{sid}/`,
     cookie `pmu_sid`), renderiza con RenderCore (`tienda.js`, paralelo), sube los PNG al
     pool por `handle_pool_png` (hash `sha1(valor|preset|settings|WxH)`; `limpiar=1`
     reemplaza el grupo) y compone los mockups 300x300 en la galería. Re-edición desde
     el carrito (`?pmu_item_key=`) reusa el item y regenera SOLO los hashes cambiados.
   - `add-to-cart` → `carrito_validar` (acepta el draft del producto sin exigir estado previo: el visto bueno es agregar al carrito; con `preview_omisible` y sin sesion crea el item en el servidor)
     + `carrito_promover` (rename a `{cart_item_key}`,
     congela `mockup-{id}.webp` y marca `preview_estado=ok`). Cantidad fija 1;
     quitar del carrito borra el item. "Editar" vuelve a la ficha con el item cargado.
     `preview_omisible` NO oculta la vista previa: el comprador puede pedirla igual;
     solo deja de bloquear el boton de comprar mientras las vistas no estan listas.
   - Pedido → `pedido_item_crear` copia la meta al item Woo y hace staging
     (`tmp/orders/{id}/`); al pagarse `pedido_promover` lo renombra a `orders/{id}/{item}/`.
     El comprador descarga en `mi-cuenta/descargas/` (una fila por cada PDF aceptado
     del snapshot; `item_generar_pdfs`, idempotente, arma cada PDF desde las filas
     indexadas de `manifest.archivos[]` con `Motor::procesar_pedido`). La pestaña
     **Pedidos** (`admin/pedidos.php`) lista los completados con "Regenerar PDF"
     y muestra `pdfs[]` + `pdfs_descartados[]`; la regeneración nunca usa un PDF
     descartado.

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
  catálogo. La **certificación** de la hoja es `thumbs.sprite_firma` = `[w,h,c,items]`
  (derivada de `thumbs.{w,h,c}` + `items` del catálogo).
  ⚠️ **Certifica todo ámbito con catálogo que mande `firma` no vacía** (spec 009, RC46): en `PMU_Uploads::sprite()` toda la
  cadena (firma → dimensiones → invalidar → mover → releer `items` → escribir firma) corre para
  `fonts`, `img` y `tm-presets`, con causas `motor:sprite:catalogo:desactualizado`,
  `motor:sprite:dimensiones:invalidas`, `motor:sprite:catalogo:no_escribible` y `motor:sprite:archivo:*`;
  `guardar_catalogo()` invalida la firma en **todos** los ámbitos catalogados. `mockups` tiene
  catálogo pero **no certifica**: su cliente no manda `firma` (nadie usa la ruta canónica ahí),
  así que persiste la hoja por la rama simple. La condición real **no** es `AMBITOS_GALERIA`
  (esa era la ambigüedad del tasks original de la 009). Puerta: `php tests/certificacion_hoja.php`.
  `pdfs/`, `orders/` y `tmp/` son ámbitos de datos del motor, sin catálogo ni sprite.
- Datasets PDF: `pdfs/{nombre}/analisis.json` (geometría inmutable del Detector: grupos
  `id`/`w`/`h`/`cont`/`pgs`; **sin envolturas**: su formato original nunca cambia)
  + `pdfs/{nombre}/envolturas.json` (archivo DERIVADO, formas DEDUPLICADAS: `formas[]`
  distintas con `usos`, `defecto` (la más usada = representativa) y `mapa` `{n: k}` completo
  (0 = instancia sin envoltura); se regenera en Subir/Re-analizar, se lee bajo demanda via
  `op=envoltura` y `datos_pdf_render` emite la forma por defecto UNA vez por grupo +
  las excepciones usadas; `grupos` vacios = analizado sin envolturas; archivo ausente **o con grupos
  no utilizables** = Re-analizar (el sistema lo informa como no disponible y la consola lo indica: no
  se inventa geometria)) + `pdfs/{nombre}/config.json` (editable: `activo`, `productos`,
  `campos_ids`, `preview_omisible` (bool, default `false` = mockup obligatorio en ficha),
  `mockups[]` (plantillas de vista previa: `capas[]` con `tipo`/`ref`/`x`/`y`/`w`/`h`/
  `rot`/`sesgo`/`filtros`/`modo`/`nombre`/`oculta`/`bloqueada`; canvas 300x300),
  `tienda{product_id}` (spec 005: Configuracion
  tienda por asociacion PDFxproducto: `activo`/`validez`/`mensaje_html`/`bloquear`;
  la expresion `validez` se evalua SOLO en el navegador, PHP nunca evalua JS),
  `envolturas{gid:{forma:k}}` (contrato v4: forma representativa del grupo dentro de
  `envolturas.json`; 0/ausente = la mas usada; el campo sale en la cabecera del grupo),
  `placeholders[id]` con
  `tipo`/`preset`/`value`/`settings` (la guia de envoltura del cargador **se deduce** del
  cableado: spec 019 F2; `campos_envoltura` dejo de usarse), `bonus[]` (4.7.0: archivos extra 0..N
  de la **biblioteca global compartida** `uploads/pmu/bonus/` con catalogo
  `bonus.json`; filas `{archivo, titulo}` (biblioteca; `titulo` vacio =
  titulo por defecto DINAMICO del catalogo, o nombre sin extension) o
  `{url, titulo}` (externa); el archivo se elige por modal, se puede
  reemplazar (conserva referencias) y borrar con escaneo de uso; al comprar
  se congelan en la meta `_pmu_bonus` del line item con el titulo resuelto.
  **Spec 020 (B5): sin migracion** del layout viejo `pdfs/{nombre}/bonus/`; una `url`
  relativa en `config.json` se descarta (la biblioteca se referencia con `archivo`).
  **Spec 011 (contrato de capa)**: `capas[].ref` lleva **namespace obligatorio** — `pdf:{archivo}`
  (foto del PDF) o `mock:{id}` (id numerico del catalogo); un `ref` plano ya **no** se
  acepta en el cliente (el servidor lo normaliza al leer, una sola vez). `capas[].filtros` admite
  `brillo`/`gama`/`contraste`/`saturacion` 0..200, `opacidad` 0..100, `desenfoque` 0..20 y
  `tono` -180..180; el valor igual al default **no se persiste**. `capas[].modo` es
  `normal`|`multiply`. Todo es opcional: ausente = comportamiento actual.
  Contrato completo: `specs/011-editor-mockups-visual/contracts/mockup-capas.md`.
  Sin `textos.json` y sin `metadata.json`
  (norma ex-008 + decision preview 2026-09-17; la migración `.migrado-007` ya no se ejecuta).
- Fotos de mockups del admin: `pdfs/{nombre}/mockups/` (datos de usuario, sin catálogo);
  las reutilizables viven en el catálogo `img/`.
- Archivos bonus del admin (4.7.0): biblioteca global `uploads/pmu/bonus/`
  (compartida por todos los PDFs) + catalogo `bonus/bonus.json`
  (`{version, items:[{archivo, titulo}]}`, titulos por defecto dinamicos);
  la lista vive en `config.json:bonus[]` como `{archivo, titulo}` o
  `{url, titulo}` (externa) y se congela por pedido en `_pmu_bonus`.
- **Campos reutilizables (specs 012 + 015, formato v3)**: `uploads/pmu/campos/campos.json` es
  **solo el indice** (vive junto al codigo de los campos, dentro de `uploads/pmu/campos/`;
  **spec 020 B5: sin migracion** desde el layout viejo en la raiz de `pmu/`)
  (`{version:3, items:[{id,tipo,baja}], meta:{id:{creado,modificado}}}`) y cada campo es una carpeta
  `uploads/pmu/campos/{id}/` con `datos.json` + `campo.htm` + `campo.css` + `campo.js`. El `id` se
  reutiliza en N PDFs y **nunca se recicla**: una baja deja `baja:true` (tombstone) y conserva los
  archivos. `datos.json` lleva `nombre`, `descripcion`, `titulo_cliente` (etiqueta del comprador) y
  `tipo` (espejo del indice). El **`tipo`** (`texto|imagen|opciones`) se elige al crear, se puede
  **corregir en edicion** (spec 018 D4) y **declara la intencion, no enruta** (spec 015 D11): la salida
  la decide el placeholder y el tipo sirve para avisar cuando el cableado no coincide. **Categorias
  fuera** del formato y de la UI (D9). La pareja `valor`/`cliente` la publica el `campo.js`
  (`function(ctx, root)`) y, si no hay JS, se lee de los `[data-rol]` del HTML; `cliente` **nunca**
  cae a `valor` (el sistema no traduce nada). Contratos: `specs/012.../contracts/campos.md`.
  **Spec 020 (B1-B3, implementado 2026-10-19)**: eliminadas `texto_ayuda`, `array`, `protegido`
  (feature completa), el **cargador legacy** (`datos.json:cargador` + `validar_cargador()` +
  `cargador_desde_texto()` + regla `cargador && !campo.js`) y el write-through (`datos_con_legacy`).
  El cargador vive **solo** en el `campo.js` (spec 018). **Sin migracion.**
- **CSS/JS global del plugin (spec 012)**: `uploads/pmu/campos/global.css` y `global.js`, **uno solo
  para todo el plugin**, editables desde la tarjeta de arriba de la pestana Campos. Se cargan **solo
  en fichas con >=1 campo**; el CSS se inyecta prefijado con `[data-pmu-panel]` y el JS con
  `wp_add_inline_script(..., 'before')` sobre `campo-montar` (unico orden prometido). En el preview de
  la consola viaja como portador `<script type="text/css" id="pmu-campo-global-css">`.
- **Transparencia del recorte (spec 027)**: la ranura puede declarar `transp: 'si'|'no'`
  (ausente = actual). `transp:'no'` -> el fondo **nunca** es transparente (boton "damero"
  oculto; el "auto" cae a blanco puro o al color solido de los bordes). `transp:'si'` -> se
  respeta la transparencia **real** de la foto (alfa en toda la imagen, no solo en el perimetro).
  El color elegido a mano por el comprador siempre gana (sale opaca). Contrato:
  `specs/027-transparencia-campo/contracts/transparencia.md`.
  **Spec 028 (fix)**: `PURO.normalizarRanura()` (`assets/tienda.js`, el normalizador de la
  **ficha**) debe devolver `transp`: sin eso `CargadorPMU` la recibia vacia y la politica se
  perdia **en la ficha**. Ojo: hay **dos** normalizadores de la misma ranura (el de la ficha
  y el del cargador en `cargador-pmu.js`); una clave nueva va en **los dos**.
- **Modos de encaje y lienzo (spec 028)**: los 3 modos son los `object-fit` del CSS con nombres
  inequivocos (**Cubrir**=`cover`, **Encajar**=`contain`, **Estirar**=`fill`); los ids viejos
  (`rellenar`/`ajustar`) son alias en `modoCanonico()`. Lo que separa Cubrir de Encajar **no es
  "deformar"** (ninguno deforma) sino **que hace con el sobrante**. **El PNG mide el LIENZO**
  (`W x H` = el hueco que resuelve `phsize`) **acotado a la resolucion de la foto** (D11: `k =
  min(1, max(iw,ih)/max(caja))`, factor **uniforme**), asi que el encaje del Motor
  (`Imagen::encajado`, contain+centrado) es **1:1** —o una escala uniforme `1/k`, con el **mismo
  encuadre**— y **la vista previa es el PDF**. La base la fija el modo y la **Escala** (0.25x-4x)
  es del comprador; con el aspecto ya encajado (<=5%)
  queda un unico boton **"Ajustar al marco"**, que **re-encuadra** (modo + Escala 1x + sin
  desplazamiento). Contrato: `specs/028-modos-lienzo/contracts/modos.md`.
- **Guia de envoltura en el cargador (contrato v4 de la 011 + spec 016 F6)**: **Spec 019 (F2)** la guia
  se **DEDUCE** del **cableado del hueco** (`[campoN]` en `value`/`settings` del grupo con envoltura;
  `campos_envoltura_deducida()`) y, si el PDF tiene **un solo** grupo con envoltura y el campo declara
  tipo `imagen`, de ese. **No hay `<select>`**: `config.json:campos_envoltura` dejo de usarse (se
  **limpia** al guardar la config y se borra del formato en la spec 020). La consola solo informa
  "automatica: #gid (del cableado del hueco)". `panel_ficha` resuelve la forma por defecto del grupo y
  publica en el campo (`envoltura` + `envoltura_gid`) y **`grupo_w`/`grupo_h`/`grupo_gid`** (el tamaño
  del grupo base; `analisis.json:grupos` es una **lista**, se busca por `id`) para que la ranura
  pueda adaptarse con **`phsize: 0|1|2`** (0 = default = los `w`/`h` declarados; 1 = el grupo;
  2 = x2, acotado por `PH_MAX=3000`), resuelto por `PMU_API.montarCargador`
  (`PURO.normalizarRanura`, pura y testeada) y no por el `campo.js`. Sin guia deducible las claves van
  `null` y `phsize>0` degrada con aviso. El selector avisa `se amplia Nx` cuando el
  recorte amplia (informativo, nunca bloquea). `cargador-pmu.js` dibuja una guia por ranura
  (`_guia`) y el **modal
  `selector-pmu.js`** la superpone en un canvas **separado** (`pointer-events:none`,
  `aria-hidden`): oscurece fuera de la forma y dibuja el contorno, reusando
  `PMUMockup.comandosEnvoltura`. **NUNCA** premascara el PNG (el clip lo aplica el PDF); el
  recorte sigue rectangular. Sin `envoltura` no se agrega DOM; sin `PMUMockup` degrada.
- **Fotos del comprador (spec 012)**: `tmp/sesion-{sid}/{item_key}/subidas/{id}.{ext}` con fila en
  `manifest.subidas[]` (`id`, `file`, `mime`, `bytes`). El `{id}` lo genera el **servidor** y el
  formato sale de la **firma de los bytes** (webp/png/jpg/gif), nunca del nombre que manda el
  cliente. **Spec 026 (D3)**: si llega un PNG y hay GD, `convertir_webp()` lo convierte a WebP
  (**q0.85**: la foto del comprador es unseen, el ahorro es ~10x) y **el alfa se preserva**;
  sin GD se guarda el original tal cual. La carpeta viaja sola al pedido porque las tres mudanzas
  mueven el arbol entero del item.
  **Spec 029 (D1)**: la foto **no se copia** al pool: la fila de `archivos[]` la **referencia**
  (`subidas/{id}.{ext}`, `origen: 'subida'`), asi que el cliente no la descarga, no la rasteriza
  y no la vuelve a subir (un POST por grupo, solo ids).
  **Spec 029 (D7)**: `podar_subidas()` borra las **huerfanas** (ni fila ni `valores`): se llama al
  registrar fotos y en la vista previa, asi reemplazar o quitar una foto borra la vieja en la misma
  corrida y la basura no viaja al pedido. Sin filas ni valores **no borra nada**.
- Catálogo global de campos (formato v1, ya migrado a v3): ver la entrada de arriba.
  `id` auto no reutilizable, `titulo_cliente`, `tipo`, `array`, valor dual
  `valor`(sistema)/`cliente`(etiqueta); detalle en `specs/004.../contracts/campos.md`).
- Imágenes aplicadas (muestras del panel): `tmp/muestras/{nombre}/{id}.{ext}` (un archivo
  por grupo, se sobrescribe en cada Procesar)
- Placeholders: sin archivos en disco; marco dibujado en la consola + descarga generada
  al vuelo (`PngWriter::bytes(w, h)`)
- **Retencion de `orders/` con referencias (spec 030, §6 P3)**: una fila `origen: ref` puede apuntar a
  **otro pedido** (`orders/{order_id}/...`), asi que **no se purga un pedido referenciado**: antes de
  cualquier purga hay que **materializar** esas filas (copiar el archivo al pedido que lo referencia).
  Hoy nada purga `orders/` (el TTL solo mira `tmp/`), asi que el invariante es documental.
- Salida de muestra: `tmp/muestras/{nombre}/{nombre}_procesado.pdf` (se sobrescribe)
- Trabajos de la API (spec 010, **aún no implementado**): `api/{job_id}/` = `manifest.json`
  (`pdf`, grupos + hash de contenido, `expira`, `creado`) + pool `img/` + `{pdf}_procesado.pdf`.
  El `job_id` es la clave de idempotencia que elige el consumidor, siempre saneado con
  `nombre_seguro`; retención por TTL (7 días por defecto, configurable) con purga de la carpeta
  completa. Es un ámbito **de la API**: no lo tocan la consola, la ficha ni Woo.
- Comprador (ciclo carrito → pedido; el cableado a hooks Woo vive en spec 004):
  borradores legacy en `tmp/cart/{linea}/` (`manifest.json` con `pdf`, personalizacion
  canonica, `pmu_hash`, cantidad, `creado`, motor) + unidad vigente ex-008 en
  `tmp/sesion-{sid}/{item_key}/` por ITEM (`manifest.json` + pool `img/` DEDICADO
  (`img/{pdf}-{id}-{n}.{ext}`, numerados si hay varios por `id`; la extension sale de
  la FIRMA de los bytes — **spec 026**: `webp` tras la conversion del servidor, `png`
  si no hay GD; los items viejos conservan sus `.png` y se siguen leyendo; sin deduplicacion global
  entre items; **spec 029 (D2)**: el pool guarda **solo lo que se genera** —el texto— y **una
  fila por grupo** cuando el contenido es uniforme, con `indice` = **posicion de instancia**, D3)
  + `mockup-{id}.webp` congelados 300x300; `draft-{uuid}` →
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
- ✅ **Conciliacion ex-008 (normativa, preservada en `constitution` §IV)** + **spec 005
  (PDF condicionales por producto)**: validez por asociacion PDFxproducto
  (`config.json:tienda{product_id}` con `activo`/`validez`/`mensaje_html`/`bloquear`;
  JS solo en navegador; servidor sanea e intersecta asociacion+activo y congela
  `manifest.pdfs[]` + `pdfs_descartados[]` para auditoria). El antiguo
  `specs/008-sesion-cart-preview/spec.md` NO era feature implementable: normaba 004 vs 007
  (`analisis.json`+`config.json`, `tmp/sesion-{sid}/{item_key}/`, preview obligatoria
  `draft-{uuid}` → `cart_item_key`). Fue eliminado tras preservarse su §0+§6 en la
  constitucion; lo nuevo se alinea a esa norma.
- ✅ **Pool del item con cola por grupo (RC4.6.11)**: las subidas del pool (`personalizador_pdf_pool`)
  de un mismo grupo van **serializadas** (clave `pdf|gid`): el `limpiar` (regeneracion
  idempotente) va PRIMERO y se espera, luego las instancias suben en paralelo. Antes el
  limpiar viajaba en una subida mas de la rafaga y podia ejecutarse DESPUES de subidas
  del mismo grupo, borrandolas: el pool quedaba sin filas (8 textos -> 5, 7 fotos -> 0)
  y la capa del mockup salia gris. La cola serializa tambien entre vistas (dos mockups
  generan en paralelo) y sobrevive a fallos. El `limpiar` se manda solo cuando la corrida
  regenera el grupo COMPLETO (sin render parcial T016), para no borrar las filas
  reusadas. Logica testeable: `PURO.enCola` (`tests/conciliacion.js`).
- ✅ **Vista del cliente sin cajas neutras (RC4.6.11)**: `PMUMockup.componer` acepta
  `huecosTransparentes: true`; con ella un placeholder sin recurso NO dibuja la caja
  gris con el ref (queda transparente). La usa **solo** la ficha (`tienda.js`): al
  cliente nunca se le muestra el marco gris ("FF0000"); la imagen que subio se dibuja
  igual. El editor de mockups del admin conserva el marco (es su pista de diseno).
- ✅ **"Repetir por placeholder" en la vista fusionada (RC4.6.11)**: `vista_grupos()` fusiona
  `repetir` en cada grupo (igual que `datos_pdf_render`); `admin/pdfs.php` pinta el
  checkbox desde `$gm['repetir']`. Antes leia `$m` (variable sin definir) y el checkbox
  SIEMPRE salia desmarcado al recargar (el guardado funcionaba).
- ✅ **Specs historicos**: 003 archivado (`specs/_archivo/003-galeria-engine/`, superado
  por 006); 004/005/006 con codigo completo 2026-09-28 (004: 33/34, 005: T001–T011,
  006: 27/29; puertas automaticas en verde) y pendiente solo el recorrido manual
  unificado en WP real (`specs/MANUAL-PENDIENTE-WP-REAL.md`, cubre T030+T012+T017+T029
  en una sesion; indice en `specs/INDICE.md`); diseno historico 004-2026-09-13 en
  `specs/004-.../_archivo/`; norma vigente = `constitution` §IV (ex-008); auditoria
  de galeria RC34–RC36 archivada (`specs/_archivo/auditoria-galeria-RC34-RC36.md`,
  sin backlog propio; canonico `modules/textmuy/AGENTS.md`).
- ✅ **Spec 009 `galerias-sprite-unificado` (implementada RC46–RC74; reconciliada el 2026-10-24)**: unifica
  las tres galerías del editor (imágenes, tipografías, estilos guardados) sobre un único
  mecanismo de lectura certificada (`thumbs.webp` + `thumbs.sprite_firma`) en los tres
  ámbitos (ver §5). Entrega: (a) certificación de hoja en los **tres** ámbitos en el
  motor + invalidación de la firma al mutar cualquiera de ellos; (b) generación automática
  de **solo los huecos**, con **una única escritura por apertura** (pre-dibujado en memoria y
  un solo `POST op=sprite`; nunca un lote parcial); (c) retiro de los botones "Generar
  miniaturas"/"Miniaturas"; (d) Google Fonts por familia única (sin `text=` ni `wght@`,
  concurrencia acotada, la familia se descarga al elegirla); (e) geometría de celda con
  ratio simplificado y alto completo (fin del recorte de las tiras de tipografías).
  Artefactos en `specs/009-galerias-sprite-unificado/` (checklist 16/16, `plan.md`, `tasks.md`
  T001–T039 con su estado real (`[X]` hecho / `[~]` con desviación o a medias / `[ ]` pendiente); T037–T039 son los huecos de esa revisión). Índice y estado en `specs/INDICE.md`. Al tocarla: enumerar
  primero el Phase 2 del `tasks.md` (certificación en el motor), ya cerrada. Puertas: `php tests/certificacion_hoja.php` (checks A–G), la suite `hoja-generacion` y la puerta de navegador `galerias.browser.js` (Chrome + Playwright). Recorrido E1–E7 **corrido en el laboratorio local con WP real** (`C:\wp-lab`) el 2026-10-24: los siete escenarios en verde, con un **hallazgo** que se corrigio en RC75 (la galeria de fuentes se comia el error: ver `modules/textmuy/AGENTS.md` §7.31 y §11). Pendiente declarado: el cliente no propaga el motivo exacto del motor cuando este **rechaza** la escritura. Falta solo confirmar en el hosting real.
- ✅ **Spec 010 `api-wordpress` (especificada, SIN implementar)**: es el objetivo de negocio
  declarado en §1. Endpoint **único** `admin_post_pmu_api` (+ `nopriv`) con dispatcher `op=`
  (`procesar`/`estado`/`limpiar`); **no** se introducen rutas REST ni un segundo camino de
  escritura. Recibe un raster por grupo (PNG/JPG/WebP/GIF; el texto con estilo llega ya
  rasterizado desde el consumidor: el servidor nunca renderiza texto, constitution §III), valida
  los ids contra `analisis.json` y procesa con `Motor::procesar()` **con** dataset. Autenticación
  por **Application Passwords** del núcleo + `manage_options` + HTTPS (no usa `seguridad()`).
  Entregable en el ámbito `api/{job_id}/` (ver §5) con TTL de 7 días, idempotencia por `job_id` y
  respuesta síncrona. Errores con la convención `api:<op>:<motivo>`. Artefactos en
  `specs/010-api-wordpress/` (`spec.md`, `contracts/api.md`); pendiente `plan.md` + `tasks.md`.
  Al implementarla: amendá la constitución (Sync Impact Report), subí `Requires at least` de
  `readme.txt` a **5.6** (Application Passwords) y agregá las fases al arnés `texto_puente.php`.
- ✅ **Spec 018 `campos-consola-v4` (implementada 2026-10-19)**: el cargador se declara en el campo
  (contenedor `[data-pmu-cargador]` + `campo.js` que monta `CargadorPMU` con `PMU_API`), con
  `PMU_API.subirFoto` / `urlDeSubida` / `montarCargador` como contrato público y `PMU_API` creado
  **antes** de montar los campos. El editor expone el `tipo` como `<select>` (el tipo declara, no
  enruta; 015 D11) y pierde `array`, `protegido` y `texto_ayuda`; los títulos del drawer/modal usan
  `.ec-c-nombre-txt`. **Sin migración**: un campo con `cargador` y sin `campo.js` sigue montándose por
  el sistema (`cargador && !campo.js`); al pegarle la plantilla nueva entra solo. Sostiene **N campos
  de imagen por producto/PDF**. Artefactos en `specs/018-campos-consola-v4/` (T001-T023 cerradas;
  pendiente T024: changelog + bump a 4.9.0 y recorrido WP real).
- ✅ **Spec 019 `ranura-adaptativa` (implementada 2026-10-19)**: la ranura del cargador puede
  **tomar el tamaño del hueco** con `phsize: 0|1|2` (0 = default, el comportamiento actual;
  1 = tamaño del grupo; 2 = x2, acotado por `PH_MAX=3000`), resuelto por `PMU_API.montarCargador`
  (`PURO.normalizarRanura`, pura y testeada) y no por el `campo.js`, y el selector **avisa**
  `se amplia Nx` cuando el recorte amplía (informativo, nunca bloquea). `panel_ficha` publica
  `grupo_w`/`grupo_h`/`grupo_gid` en `PMU_FICHA.campos[]` (buscando el grupo por `id` en la lista
  de `analisis.json`) y `validar_cargador()` conserva `phsize`. **`escala: 'sin-ampliar'` sigue
  fuera** (no ampliar la foto exige tocar `engine/Imagen.php` + `tienda.js:rasterizar`, o el Motor
  re-amplía): va como spec aparte. Artefactos en `specs/019-ranura-adaptativa/` (D1-D9,
  FR-001..009, T001-T015 cerradas; pendiente T016: release 4.10.0 + recorrido WP real).
- ✅ **Spec 020 `limpieza-legacy` (implementada 2026-10-19, v4.11.0)**: regla del
  negocio — **en desarrollo no hay migraciones ni retrocompatibilidad** (el admin borra los campos
  viejos y regenera los PDFs). Se eliminaron: `protegido` (feature completa, D1), `array` del
  almacén (D2), `texto_ayuda` (D3), el **cargador legacy** (D4), `datos_con_legacy` (D5), los
  puentes de **tupla v1** (D6) y los formatos muertos: filtro `'Array'`, `envolturas.json` v1,
  `ref` plano de mockups, migración de `bonus` y migración del índice de campos (D7). **NO** toca la
  norma ex-008 ni las features (D8). Artefactos en `specs/020-limpieza-legacy/` (D1-D10,
  T001-T022).
- ✅ **Spec 021 `cargador-visor-cliente` (implementada 2026-10-19, v4.12.0)**: experiencia móvil y PC
  del cargador de imágenes (`assets/selector-pmu.js`, `assets/cargador-pmu.js`, `assets/tienda.js`):
  apertura directa del selector de archivos, `spmu-escena` hasta `1000x1000 px` con relación de
  aspecto fija y **10% de margen interno** (`1.2W x 1.2H`), doble guía (**recorte secundario** =
  placeholder `W x H` donde se corta el PNG; **recorte principal** = forma `'rectangulo'|'circulo'|'cuadrado'|'ovalo'|'auto'`
  o envoltura posicionada con `size`, `ox`, `oy`), **3 modos** (`Rellenar`/`Ajustar`/`Estirar`) con
  **regla del 5%** (<=5% muestra solo `Estirar` y oculta `Girar`; >5% muestra los 3 modos y `Girar`
  si la ranura declara `{ r: 1 }`), control **Reducir / Ampliar** con reset al centro (`0`), color
  de fondo autodetectado por los bordes de la imagen (o transparente si hay transparencia), botón
  **Subir** con aviso `"Subiendo imagen..."` y pregunta `"¿Querés subir otra imagen?"` si quedan
  espacios, y **mini galería fullscreen (`cpmu-visor`)** al tocar las miniaturas subidas (flechas,
  Eliminar y Reemplazar con retorno al visor si cancela).
  **Limpieza de la tira**: se retiraron el botón **"Listo"** (decorativo: sin acción y sin bloquear
  nada), el texto `"Listo: N imagen(es)."`, el encabezado técnico de la ranura y la guía de la
  envoltura de la tira; el botón de cargar dice **"Cargar imagen"** y el aviso de faltantes aparece
  **solo si falta** alguna foto. Los datos técnicos (medidas/forma/min y avisos de configuración)
  se muestran **solo con `tecnico: true`**, que es lo que pasa el preview de la consola
  (`assets/admin.js:apiPreview`).
- ✅ **Spec 022 `minimo-fotos-obligatorio` (implementada 2026-10-19, v4.13.0)**: el **`min` de las
  ranuras frena la compra**. Hallazgo: el botón "Listo" de la 012 era decorativo y
  `carrito_validar()` no contaba las fotos, así que se podía comprar **sin subir ninguna imagen**.
  Doble red: (a) la **ficha** deshabilita "Agregar al carrito" y muestra un único aviso
  (`Faltan N foto(s) por cargar.`); (b) el **servidor** rechaza el add-to-cart. Como el servidor
  **no puede leer las ranuras** (viven en el `campo.js` y PHP nunca evalúa JS, constitution §III),
  el navegador declara `pmu_minimos = {campo: minTotal}` (`CargadorPMU.estadoActual().minTotal`) y
  el servidor **cuenta los archivos REALES** del item (`manifest.subidas[]`; un id sin archivo no
  cuenta), con **cap 50** y **fail-safe sin declaración** (flujo sin JS intacto). Puerta nueva:
  fase **`minimos`** (6 checks: rechazo real, fail-safe, conteo real, id fantasma, saneo/cap) +
  `minTotal` en `campos-contrato`. Límite aceptado (D7): es regla de **calidad del pedido**, no
  anti-fraude; una regla infalsificable exigiría duplicar las ranuras en `datos.json`.
- ⚠️ **Spec 023 `escala-sin-ampliar` (implementada 2026-10-19, v4.14.0; SUPERADA por la 025)**: la ranura podia declarar
  **`escala: 'ampliar' | 'sin-ampliar'`** (default `'ampliar'` = histórico). Con `'sin-ampliar'` la
  foto **nunca se escala hacia arriba**: ocupa su **tamaño natural** dentro del lienzo `W x H`,
  centrada, y el resto queda para el color de fondo. En el modal se ocultan los **3 modos** y
  **Girar** (el modo queda en `ajustar`), el slider **capa a `1x`** (solo reduce) y el badge dice
  **`sin ampliar`**. **Clave del alcance**: la 019 decía que había que tocar el Motor, pero **no
  hace falta** — el PNG sigue midiendo `W x H` (la foto ocupa menos adentro), así que
  `Imagen::normalizar` encaja **1:1** y no re-amplía. Un PNG **menor** que el hueco sigue fuera
  (eso sí exigiría `engine/Imagen.php` + Overlay + contrato del pool). Función pura
  `SelectorPMU.puro.escalaBase()` (cap a 1) con 4 checks en `selector-contrato`.
- ✅ **Spec 024 `ajustes-modal-selector` (implementada 2026-10-20, v4.15.0)**: pulido del modal.
  **Controles en 3 filas**: los **3 modos** a la izquierda (mismo ancho, **resetean la `Escala`**),
  **`Escala`** al 100% **sin botón de reset**, y `Fondo` con **icono damero** + **icono `auto`**
  (visible solo si el fondo no es automático, vuelve al color detectado por bordes) con **`Girar`**
  a la derecha (visible solo con `r: 1` **y** lienzo no cuadrado). **Acciones** separadas
  (`Cargar imagen` izquierda; `Cancelar` + `Subir` derecha).
  **Título** `Ajuste la imagen` sin medidas y **badge de salida solo con `tecnico: true`**.
  **Guía sin velos**: se eliminaron los dos rellenos negros (35% + 32%), así que la zona libre
  queda **transparente** y solo se dibujan los contornos; un **ojito** dentro de la escena alterna
  una **máscara blanca pura `#fff`** fuera de la forma para ver **solo el recorte** (con el contorno
  del placeholder en gris), y **solo aparece si la forma recorta** — decidido por **tipo de forma**
  (`tipo !== 'rectangulo'` / `size < 1` / `ox`/`oy`), no por la caja. La máscara vive **solo** en el
  canvas guía: **el PNG de salida y el Motor no cambian**. Estado del ojito: arranca apagado.
  **Fix 4.15.1**: `.spmu-caja [hidden]{display:none !important}` (WordPress pisaba `hidden` con
  `.button`, y por eso `auto`/`Girar` se veían siempre); al girar se recalcula el 5% para no deformar
  en `Estirar`.
  **Fix 4.15.2**: el **ojito responde al click** (el `pointerdown` de la escena arrancaba el arrastre
  y hacía `setPointerCapture`, así que el `click` no llegaba al botón: solo funcionaba con Espacio;
  se corta con `stopPropagation` + guard `ojo.contains(e.target)`), y el **zoom crece desde el centro
  de la forma** (`origenDibujo` con `geo.principal.cx/cy`), no del placeholder — con la forma
  centrada el resultado es idéntico al anterior.
  **Fix 4.15.3**: el desplazamiento del comprador se **escala por el zoom** (`desp * zoom`) dentro de
  `origenDibujo`: sin eso el punto fijo seguía siendo el **centro de la imagen**, y al arrastrar y
  ampliar el contenido bajo el centro de la forma se corría (el check de invariancia da `-50 / -50 / -50`).
- ⚠️ **Spec 025 `png-resolucion-foto` (v4.16.0) — SUPERADA por la 028**: redefinió los 3 modos
  ("Rellenar = recortar al aspecto **sin ampliar**", "Ajustar = contain capado a 1", "Estirar =
  lado mayor") y el PNG como `min(caja, lienzo)`. Las palabras eran **ambiguas** y esa lectura quedó
  **codificada en los tests con ejemplos** (E1–E6): con una foto más chica que el marco Cubrir
  **dejaba huecos**, y con un lienzo no cuadrado el PNG salía **corrido** (la ventana se centraba en
  el lienzo, no en sí misma). Se conserva como registro.
- ✅ **Spec 028 `modos-lienzo` (implementada 2026-10-20, v4.19.0)**: **los 3 modos se anclan a
  `object-fit`** y se renombran a verbos inequívocos: **Cubrir** (`cover`), **Encajar** (`contain`),
  **Estirar** (`fill`); los ids viejos (`rellenar`/`ajustar`) y los nombres de CSS son **alias** en
  `modoCanonico()`. **El invariante que la 025 leyó al revés**: lo que separa Cubrir de Encajar
  **no es "deformar"** (ninguno deforma) sino **qué hace con el sobrante** — Cubrir **recorta**,
  Encajar **deja fondo**. Está escrito en la tabla (`contracts/modos.md`, docblock de `escalaBase`)
  y **verificado por propiedad** (`tests/selector-contrato.test.js` F2b: *Cubrir nunca deja huecos*,
  *Encajar siempre entra*, *Estirar es el marco exacto*), no por ejemplos. **El PNG mide SIEMPRE el
  LIENZO (`W x H`)** = el tamaño del hueco (`phsize`), y como `Imagen::encajado` es contain+centrado,
  el encaje del Motor es **1:1**: **la vista previa es el PDF** (modo, Escala y desplazamiento
  incluidos). Vuelve la **Escala 0.25x–4x** (la base la fija el modo). La **regla del 5% se
  conserva**: con el aspecto ya encajado queda **un** botón, **"Ajustar al marco"**, que **no es un
  modo sino un RE-ENCUADRE** (modo del caso + Escala 1x + sin desplazamiento); con >5% se muestran
  los 3, con default **`cubrir`** (y `estirar` en el caso ≤5%). Al girar se recalcula el 5% y, si
  estaba en `estirar`, pasa a `cubrir` (no deformar sin querer). Aviso nuevo: `phsize: 0` con un
  lienzo distinto del hueco del grupo (el Motor reencajaría la composición). **El Motor y el
  servidor no se tocan.**
  **D11 (tope de resolución)**: el PNG mide el lienzo **acotado a la resolución de la foto**:
  `k = min(1, max(iw,ih)/max(caja))` (`escalaSalida()`, pura) y el archivo mide `round(W·k) x
  round(H·k)` — **nunca supera el lienzo ni amplía la foto** (no inventa píxeles, sin piso). El
  factor es **uniforme**, así que el PNG conserva el **aspecto del lienzo** y el Motor lo escala
  uniforme: el **encuadre no cambia** (modo/Escala/desplazamiento intactos) y **la vista previa
  sigue siendo el PDF**; sólo baja la resolución, que es la que el PDF podría mostrar. Con una foto
  **grande** `k = 1` (el caso típico no cambia). La **Escala multiplica la caja**: acercar **baja**
  `k`. Caso real: 400×300 en 1000×1000 → Cubrir **300×300**, Encajar **400×400**, Estirar
  **400×400** (antes 1000×1000: ~11x de peso de más).
- ✅ **Spec 029 `pool-sin-copias` (implementada 2026-10-20, v4.20.0)**: **el pool guarda solo lo
  que se GENERA** (el texto de TextMuy) y **las fotos del comprador se referencian**, no se
  copian. Antes, con 1 grupo × 100 instancias y una foto + un texto, la vista previa creaba
  **200 archivos**: `PURO.conciliarGrupo()` devuelve una copia del valor único **por instancia**,
  y cada entrada se bajaba, se rasterizaba al hueco y se subía (el texto, además, se renderizaba
  100 veces). Ahora: **1 POST por grupo** con los ids por instancia (`registrar_fotos`, **sin
  bytes**) y la fila apunta a `subidas/{id}.{ext}` (`origen: 'subida'`); el texto uniforme se
  renderiza y se sube **una vez** (`dedupPendientes`, `repite`) con `indice` 0 (el Motor la
  replica a todo el grupo, como ya hacía `item_generar_pdfs` con una sola fila). El `indice` pasa
  a ser la **posición de instancia** (antes era el número de archivo: con instancias subidas en
  paralelo el PDF podía asignar la foto equivocada). Sin `rasterizar` ya no hay recompresión
  WebP→WebP ni copias: **200 archivos → 2** en el caso real. **El Motor y el formato del pedido
  no cambian** (el árbol del item viaja entero, así que `subidas/` está en `orders/`).
  **D7 (poda)**: `PMU_Sesion::podar_subidas()` conserva una subida si la usa **una fila** de
  `archivos[]` (`origen: 'subida'`) **o** algún **`valores`** del manifest (el estado vivo que la
  vista previa acaba de refrescar) y **borra el resto** (archivo + fila); sin filas ni valores
  **no borra nada**. Se llama al final de `registrar_fotos()` y en `handle_vista_previa`, así que
  reemplazar o quitar una foto limpia el archivo viejo en la misma corrida.
  Puerta: fase `fotos` del arnés (14 checks: 9 de D1-D3 + 5 de D7) + 3 checks en `selector-contrato`.
- ✅ **Spec 027 `transparencia-campo` (implementada 2026-10-20, v4.17.0)**: **la politica de
  transparencia la declara el `campo.js`** (no el comprador). La ranura acepta `transp: 'si'|'no'`
  (**ausente = comportamiento actual**: el cliente decide con el boton "damero"). Con `transp:'no'`
  el boton "damero" **se oculta** y el fondo **nunca** es transparente (el "auto" cae a **blanco
  puro** `#ffffff`, o al color solido que propongan los bordes); con `transp:'si'` se aplica la
  cadena completa y **solo si se cumplen todas** las condiciones se sube con alfa: (a) el archivo
  soporta transparencia (PNG/WebP; JPEG no), (b) hay una **capa de alfa real** (cualquier pixel
  con `a < 250` en **toda** la imagen, no solo en el perimetro), (c) el "auto" resuelve a
  transparente, (d) el fondo final es transparente (si el comprador elige un color a mano, la
  imagen sale **opaca**). La logica vive en la funcion **pura** `SelectorPMU.puro.resolverFondo()`
  (testeable en Node). **Sin migracion** y **sin tocar el servidor** (spec 020 D4: el cargador ya
  no se valida en PHP; constitution §III). **Ortogonal a la 026** (`imagenes-webp`): el alfa
  viaja igual en PNG y en WebP.
- ✅ **Spec 026 `imagenes-webp` (implementada 2026-10-20, v4.18.0)**: **las imagenes se guardan en
  WebP** (antes todo PNG: la foto del comprador pesaba ~1.3 MB; ahora ~120 KB). El **cliente**
  emite WebP con `canvas.toBlob('image/webp', q)`: **q0.85** para las fotos del comprador y
  **q0.92** para el pool (el texto renderizado tiene bordes con antialias). El **servidor**
  (`PMU_Sesion::convertir_webp()`) convierte como red de seguridad si el cliente mando PNG, y
  **nunca** recomprime un WebP que ya viene listo. El formato se decide **siempre por la firma de
  los bytes** (`firma_imagen()`), nunca por el nombre. **Defensa en profundidad**: el cliente solo
  envia WebP si `PMU_FICHA.webp_soportado` (`PMU_Sesion::servidor_lee_webp()`, GD +
  `imagecreatefromwebp`) lo permite, y si llega un WebP ilegible se rechaza con
  `motor:imagen:webp:no_soportado` (sin GD el Motor no podria decodificarlo y el PDF saldria
  roto). **Sin migracion**: `guardar_png()` sigue existiendo como alias de `guardar_imagen()`
  (la extension sale de la firma) y `siguiente_n()`/`limpiar_grupo()` cuentan/borran **todos** los
  formatos. **El Motor no cambio** (ya leia WebP) y **el PDF final es estructuralmente identico**
  (smoke: WebP con alfa -> raster + SMask igual).
- ✅ **Hooks legacy retirados**: los hooks y el nonce historico `extractor_corel_*`
  (<= 2.0.0) ya no existen; `seguridad()` solo acepta `personalizador_pdf_*`.
- ✅ **Spec 030 `biblioteca-imagenes` (implementada, v4.22.3)**: el comprador **ve y reusa** sus fotos
  desde la ficha. La **tira** vive SIEMPRE visible en el modal (montada al abrir, adaptada al ancho, sin
  scroll, tile `N+` al resto) y **tocar** una miniatura abre el **visor compartido** (`Elegir`/`Borrar`).
  **Elegir sin recomponer = 0 bytes**: `op=usar` escribe una fila `origen: ref` (o copia desde `tmp`)
  **solo si** la `receta` del hueco esta entre las de la familia — la decide el **servidor** (el cliente
  no puede mentir, §III); si difiere, el primario dice `Subir` y entra una **version** `{madre}-{n}`. La
  `receta` se **estampa tambien al subir** (sin eso, una familia nacida de una subida nunca podia ser
  Elegible). **Dedupe por `sha`** del contenido CRUDO al subir, **familias** (`{madre}-{n}`, `base`
  **DERIVADA** por area) en `PMU_Sesion` (**duenio unico**, D1/§II), **referencias entre pedidos**
  (`ref` relativo a `uploads/pmu/`; si falta, `motor:descarga:ref:ausente` = hueco transparente),
  **borrado** de la familia completa con aviso de `usos` (sin contar el item en edicion) y
  **vencimiento por ITEM** (`limpiar_ttl`: drafts 24 h / carrito abandonado 30 dias) con **cron diario**.
  La copia del cliente es `pmu_bib_v2` (metadatos, nunca bytes) revalidada por `revision`, con
  **auto-sanado** si dice `fotos: []` y el servidor responde `sin_cambios`. Puertas: fase `biblioteca`
  del arnes + `tests/biblioteca-contrato.test.js`. Contratos en
  `specs/030-biblioteca-imagenes/contracts/{biblioteca,cliente-biblioteca}.md`.
- ✅ **Jerarquia documental**: `constitution` > este AGENTS.md > resto (`readme.txt`,
  `admin/ayuda.php`, `modules/LEEME.md` solo resumen y apuntan aqui). El `== Changelog ==`
  de `readme.txt` es historial, no normativa.

## 8. Dificultades del entorno (IMPORTANTE AL TRABAJAR AQUÍ)

**Entorno declarado (verificado 2026-10-03)**: Windows + **PowerShell 7 (`pwsh`) 7.6.6** +
VS Code + extensión **Cline**. La integración de **Spec Kit** es `cline` (predeterminada y
única) con scripts **`ps`**. Detalle, verificaciones y diagnóstico: `docs/entorno-desarrollo.md`.

- ⚠️ **Diagnóstico antes que cambios**: ante un fallo, verificá primero shell activo
  (`$PSVersionTable.PSVersion` → 7.x; `(Get-Process -Id $PID).Path` → `pwsh.exe`), directorio
  actual (`Get-Location`), PATH y herramientas (`Get-Command pwsh,specify,uv,node,php,git`).
  No asumas Bash, WSL, `cmd` ni Windows PowerShell 5.1 como shell activo.
- ⚠️ **Ejecución**: todos los comandos se corren desde la **raíz del proyecto** (salvo los
  tests del módulo TextMuy, que exigen `modules/textmuy/`). En pwsh secuenciá con `;` (y `&&`
  cuando el primer fallo deba cortar); no uses sintaxis de bash ni de cmd.
- ⚠️ **Rutas con espacios**: al ejecutar comandos, envolvé las rutas entre comillas.
- ⚠️ **Búsquedas de código**: `search_codebase` no indexa bien los `.php`; si un patrón no
  aparece, leé el archivo directamente.
- ⚠️ **Permisos Windows**: si un script PHP de testing falla al escribir en Documents,
  escribí los temporales en `%TEMP%` (`sys_get_temp_dir()`). En WP real usar siempre
  `wp_upload_dir()`.
- ⚠️ **Recorridos de aceptación**: hay un **laboratorio local con WP+Woo reales** (`C:\wp-lab`:
  plugin y tema por *junction*; ver `docs/entorno-desarrollo.md` §9). Los recorridos se corren
  **scripteados** contra el lab (evidencia + capturas) y el hosting solo confirma el deploy. Ojo: los
  datos de `uploads/pmu` del lab son **copia propia**, no el espejo de despliegue.
- ⚠️ **Rutas web**: no intentes fetch a URLs de `wp-admin` (requiere auth → 404); asumí la
  lógica según `admin/*.php`.
- 🚫 **Sin aprobación explícita**: no modificar bases de datos, credenciales ni servicios
  externos, y no desplegar a producción (el deploy lo dispara el push a los webhooks de
  Hostinger; ver §2).

**Spec Kit**: los workflows `.clinerules/workflows/speckit-*.md` ejecutan
`.specify/scripts/powershell/*.ps1` desde la raíz del repo. `.specify/` y `.clinerules/`
están en `.gitignore` (tooling local: no aparecen en `git status`; no editarlos a mano,
son archivos gestionados por el CLI). Para verificar/actualizar:

```powershell
specify integration status                      # esperado: OK; cline (default + instalada)
specify integration upgrade cline --script ps   # diff-aware; --force solo si es deliberado
```

## 9. Cómo probar

### Entorno PHP (plugin) — desde la raíz del proyecto, tras tocar `engine/` o `admin/`
```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
php tests/campos_migracion.php   # CRUD de campos v3 (debe decir "CAMPOS V3 OK")
php tests/certificacion_hoja.php  # Certificacion del sprite (debe decir "CERTIFICACION HOJA OK")
node tests/campos-contrato.test.js  # Montaje de campos + cargador (spec 012): "CAMPOS CONTRATO OK"
node tests/selector-contrato.test.js  # Contrato del selector visual (spec 016): "SELECTOR CONTRATO OK"
node tests/biblioteca-contrato.test.js  # Biblioteca del comprador (spec 030): "BIBLIOTECA CONTRATO OK (N checks)"
node tests/conciliacion.js    # `PURO.conciliarGrupo` (spec 012, D17-D19): "CONCILIACION OK"
php tests/motor_smoke.php     # Smoke del motor (debe decir "SMOKE OK")
php tests/parity.php          # Oráculo del detector (debe decir "PARIDAD OK")
php tests/envolturas.php      # Envolturas PowerClip (debe decir "ENVOLTURAS OK")
php tests/inventario_repo.php  # Inventario de CODIGO del repo (genera docs/inventario-repo.md)
node tests/mockup-geometria.test.js   # Geometria pura del editor de mockups (spec 011):
                              # debe decir "GEOMETRIA OK (N checks)"
node tests/mockup-contrato.test.js    # Cableado nucleo-consumidores + comportamiento del
                              # nucleo de render (spec 011): debe decir "CONTRATO OK (N checks)"
                              # ATRAPA: miembro de PMUMockup que el editor/ficha llaman y no
                              # existe; orden de dibujo asincrono; HTML mal formado en jQuery.
node tests/validez.js         # Expresiones de validez PDFxproducto (spec 005): "VALIDEZ OK"
php tests/sin_lectura.php     # LEER no escribe catalogos (RC47): "SIN_LECTURA OK"
php tests/estado_pmu.php      # Estado del espejo uploads/pmu (solo lectura, contra datos reales)
php tests/inventario_pmu.php --resumen  # Manifiesto de DATOS de usuario (hermano de inventario_repo)
php tests/texto_puente.php    # Arnes con stubs WP, una fase por proceso:
                              # setup | guardar_ajax | guardar_vacio | procesar |
                              # rechazo | imagen_adjunto [mal] |
                              # subir_conflicto | placeholder | admin |
                              # linea | campos | config | tienda | pedido |
                              # migracion | nonce [cap] | validez | validez_admin |
                              # validez_admin_mal | ficha* | vista_previa* |
                              # carrito | pool* | fotos | sesion | conciliacion |
                              # completados | mockups* | mockup_capas |
                             # mockup_preview | mockup_foto |
                              # mockup_foto_baja | mockup_foto_ajax |
                              # desactivar | reanalizar | envoltura_op | borrado | campo_global | smoke | biblioteca
```
Los 3 arneses CLI salen de inmediato si no corren por CLI (`PHP_SAPI !== 'cli'`):
la carpeta `tests/` viaja con el plugin al hosting y no debe ser ejecutable por HTTP.

### Auditoría de código (solo desarrollo; NO corre en hosting)
```powershell
php composer.phar run analisis              # PHPStan nivel 4 (phpstan.neon): codigo muerto,
                                            # ramas muertas y condiciones imposibles
npx --yes jscpd@4 --config .jscpd.json .    # Bloques clonados PHP/JS -> docs/jscpd-report.md
php tests/inventario_repo.php               # Archivos/pesos/dependencias -> docs/inventario-repo.md
```
- `/vendor/` (composer, anclado a la raiz) y `composer.phar` estan en `.gitignore`
  (jamas se despliegan). `assets/vendor/` quedo **vacio y retirado** en la spec 021
  (Cropper.js 1.6.2 era el motor de la 016 y el selector ya no lo usa; lo congela
  la fase F0 de `tests/selector-contrato.test.js`). `composer.json`,
  `composer.lock`, `phpstan.neon` y `.jscpd.json` si se versionan.
- Los FP estructurales estan ignorados **con comentario** en `phpstan.neon` (includes de
  `admin/*.php` dentro de metodos de la clase, constantes del plugin, funciones `wc_*`) y
  los simbolos que PHPStan no descubre viven en `tests/phpstan/simbolos.php`.
- Los hallazgos que queden en rojo son trabajo pendiente: NO borrar ni "arreglar" nada
  sin aprobacion explicita.

### Recorrido de aceptación en el laboratorio local (`C:\wp-lab`)

Los recorridos de aceptación de cada spec se corren en el **laboratorio local** (WP+Woo reales, plugin
y tema montados por *junction*) con Chrome + Playwright **sin instalar nada en el repo**: arranque,
credenciales, scripteado, higiene de datos y las trampas conocidas están en
`docs/entorno-desarrollo.md` §9. Vigentes: `recorrido-009.cjs` (spec 009: **33/33**) y
`recorrido-ficha-pedido.cjs` (ficha → pedido: **18/23**, con dos ajustes pendientes documentados en
§9.5).

### Verificación en el sitio real (WordPress + Woo)
Consola → pestaña **Test** → botón **Ejecutar smoke test**. Corre con WordPress/Woo
reales (sin `exec`): entorno PHP, permisos de `uploads/pmu/*`, catálogos, motor sobre
los PDFs subidos, hooks `admin_post`, TextMuy, Woo y render de la consola. Avisa si la
versión instalada cambió desde la última corrida (control post-deploy).
Los tests leen `muestra.pdf` desde `uploads/pmu/pdfs/` (datos del
usuario, NO versionados). `parity.php` acepta la ruta como argumento opcional.
`texto_puente.php` crea su entorno aislado en `%TEMP%` (`preparar_entorno()`:
`pdfs/muestra/` + `analisis.json` + `config.json` + preset `neon-glow`).

### Entorno Node (módulo TextMuy) — si se modifica `modules/textmuy/`
```powershell
Set-Location modules\textmuy
node tests/catalog-unified.test.js && node tests/tile-geometria.test.js && node tests/fonts-catalog.test.js
node tests/img-refs.test.js && node tests/preset-cache.test.js && node tests/preset-ambito.test.js
node tests/preset-delta.test.js && node tests/preset-load.test.js && node tests/preset-roundtrip.test.js
node tests/distort-engine.test.js && node tests/flag-wave.test.js && node tests/pattern-block-box.test.js
node tests/controls-init.test.js && node tests/galeria-items.test.js && node tests/invalidacion.test.js
node tests/sprite-canonico.test.js && node tests/fuente-compuesta.test.js && node tests/fuente-carga-estados.test.js
node tests/fuente-selector.test.js && node tests/integridad-archivos.test.js && node tests/rc-bump.test.js
Set-Location ..\..
```
(**45 suites** `*.test.js` + `tests/galerias.browser.js`; Node NO corre en el servidor productivo
de WP: es solo testing del módulo. Las ultimas 5 en entrar: `preset-roundtrip`,
`fuente-compuesta`, `fuente-carga-estados`, `fuente-selector` e `integridad-archivos`;
`?v=RC75` hoy en ambos HTML.)

`tests/galerias.browser.js` es la única prueba con **navegador real** (Playwright + Chrome vía
la variable de entorno `TEXTMUY_CHROME`): valida el DOM de las galerías (celdas, descargas,
geometría). No corre en el hosting; es la puerta que consume la spec 009 (SC-001/002/004/005/006).
Playwright **no está instalado** en el entorno de desarrollo (Chrome sí): se corre sin tocar el repo con `npm i playwright` en `%TEMP%` + `NODE_PATH` (receta en `modules/textmuy/AGENTS.md` §7.29). Esa puerta arrastraba asserts de ratio sin simplificar (rojo) hasta la revisión de la 009 (RC74).
Si al regenerar el módulo el total no cuadra, revisar si entraron o salieron suites.

## 10. Reglas para la IA al editar

- ✅ OBLIGATORIO: leer este AGENTS.md completo antes de proponer cambios arquitectónicos.
- ✅ OBLIGATORIO: ejecutar `php tests/motor_smoke.php` y `php -l` tras cambiar `engine/`.
- ✅ OBLIGATORIO: trabajar en **PowerShell 7 (`pwsh`)** desde la raíz del proyecto; ante un
  fallo, verificar shell, directorio, PATH y herramientas antes de cambiar el entorno (§8).
- ✅ OBLIGATORIO: mantener mensajes, variables e interfaz estrictamente en español (sin
  tildes en código puro para evitar problemas de encoding).
- ❌ NO DEBES: crear nuevos archivos, páginas o motores sin confirmar con el usuario si ya
  existe código que resuelva el problema.
- ❌ NO DEBES: reintroducir Python.
- ❌ NO DEBES: modificar bases de datos, credenciales o servicios externos, ni desplegar a
  producción sin aprobación explícita del usuario (el push dispara deploy; §2).
- ❌ NO DEBES: editar a mano `.specify/` ni `.clinerules/` (gestionados por el CLI y
  gitignored): actualizá con `specify integration upgrade cline --script ps` (§8).
- ✅ El módulo `modules/textmuy/` es un repositorio git propio (`muyunicos/textmuy`, el
  original) que vive dentro de este checkout: se edita directamente y se corren sus tests
  Node (`node --check` + 45 suites), pero sus commits y push van EN ESE repo; se hace bump
  `?v=RCn` en ambos HTML al tocar su JS.
- ❌ NO DEBES: guardar datos generados por el admin dentro de la carpeta del plugin
  (siempre usar `uploads/` según §5).
- ❌ NO DEBES: leer `form.action` del DOM con el patrón admin-post: usar
  `form.getAttribute('action')` (ver tabla §11).

## 10.ter Cómo editar código aquí sin romperlo (2026-10-03)

**Contexto**: en una sesión el shell pasó de bash a pwsh y, por seguir usando scripts
heredoc de bash dentro de PowerShell, se rompieron 8 ficheros (caracteres comidos:
nuevas lineas, parentesis, signo de dolar, angulos y comillas). Los tres commits
siguientes, hechos con la herramienta de edicion, no rompieron nada. **La causa no
fue el shell: fue usar scripts que reescriben ficheros completos.**

### Reglas

1. **Editar SIEMPRE con la herramienta de edicion** (diff exacto del texto). Es lo
   unico que no sufre escapado de shell. **Nunca** generar ficheros con
   heredocs de bash, con `Set-Content` sobre un fichero existente, ni con scripts
   de Node o PowerShell que reescriban el fichero entero.
2. **Cambios grandes**: en pasos de editor, y `php -l` / `node --check` **despues
   de cada paso**, no al final.
3. **`run_commands` es para LEER, buscar y verificar** (`Select-String`, `php -l`,
   `node tests/...`, `git`). Si un comando necesita escribir un fichero del repo,
   es que hay que usar el editor.
4. **Antes de la primera tarea de código**, confirmar el shell:
   `$PSVersionTable.PSVersion` → 7.x. Es un comando barato (§8).
5. **Si algo se rompe**: `git checkout -- <fichero>` (el árbol está limpio y
   pusheado) y rehacerlo con el editor. No intentar "arreglarlo" con más scripts.
6. **Anclas de UNA linea y sin espacios iniciales**: el editor matchea el texto tal cual, asi que
   incluir la indentacion adivinada es la causa #1 de "text not found" (2026-10-21). Usar el texto de
   la linea **sin** sus espacios iniciales; si el cambio abarca varias lineas, partirlo en pasos (los
   lotes al MISMO archivo entran todos si las anclas son de una linea sin espacios: no es el lote, es
   la indentacion adivinada).
7. **Anclas de una linea = lotes seguros**: varias ediciones al mismo archivo en un solo lote entran
   bien **si** cada `old_text` es de una linea y empieza en texto, no en espacios (probado 2026-10-21).

### Commits (2026-10-21)

**Moderados, no diminutos**: un commit por **paso verificado**, no por micro-edicion.
Agrupar en el mismo commit las ediciones de un mismo tema, con sus puertas
(`php -l` + la fase o suite que corresponda) y, si aplica, su doc (contrato, `spec.md`,
`tasks.md`). Cuando una ronda cierra **varios hallazgos del mismo tipo** (p. ej. los del
analisis), va **un solo commit por bloque tematico**.

- **Un tema por commit**: no mezclar refactor + feature + docs.
- Evitar commits de una linea salvo que el cambio sea de alto riesgo (ahi conviene
  poder revertirlo solo).
- `git commit --amend` mientras el paso siga sin publicar; una vez pusheado, commit nuevo.
- **Commitear solo con el lint en verde, y gateado**: `php -l` / `node --check` en el MISMO comando con
  `if ($LASTEXITCODE -eq 0) { … git commit … }`. Imprimir el lint sin cortar deja pasar un commit roto
  (paso el 2026-10-23). Los tests del arnes que cargan el plugin **no** lo cubren si el lint falla antes.
- Un `*/` dentro de un docblock de PHP **cierra el comentario**: escribir `tmp/sesion-{sid}/{item}/`,
  nunca `tmp/sesion-*/item/` (fue el parse error del 2026-10-23).

### Sintaxis del shell activo (PowerShell 7)

```powershell
Select-String -Path admin/*.php -Pattern 'texto'   # buscar (NO grep)
Get-ChildItem -Recurse -Include *.php               # listar (NO find)
php tests/texto_puente.php <fase>                   # ejecutar
foreach ($f in @('a.js','b.js')) { node --check $f }  # bucle
```

**No usar** (sintaxis de bash, no existe en pwsh): `cat <<EOF`, `ls`, `grep`,
`sed -i`, `&&` para encadenar (usar `;`), `/tmp/` (usar `$env:TEMP`).

| El boton "Subir imagenes" dice "El cargador todavia no esta disponible" | La plantilla "Imagen (cargador)" traia un boton placeholder con `PMUCargador` (nombre que nunca existio; el real es `CargadorPMU` y lo monta el sistema) | La plantilla quedo sin boton (4.6.1); los campos creados antes se corrigen vaciando su HTML/script desde la pestana Campos |

## 10.bis Fuente unica de la version (spec 011, 2026-10-01)

La version del plugin esta en **un solo sitio**: la cabecera `* Version:` de `personalizador-pdf.php`.
La constante `PERSONALIZADOR_PDF_VERSION` se deriva de ahi con `get_file_data()`, asi que
cache-busting (`?ver=`), el smoke de version y las pantallas usan siempre el mismo numero.
Estaban duplicadas (cabecera 4.3.0 y `define` 4.2.2) y divergieron: los CSS/JS se servian con la
version vieja. **Para cambiar la version, editar SOLO la cabecera** (y el `Stable tag` de
`readme.txt` si se publica en el repo de WordPress.org). No volver a escribir un `define` con
el numero a mano. El stub `get_file_data` del arnes esta en `tests/texto_puente.php`.

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
| El editor de mockups no aparece (ni galería ni lienzo) | Falta `mockup-render.js` o `mockup-geometria.js` en el servidor | Subir **los dos** módulos cliente: son dependencia dura (`mockups.js` hace `return` temprano si `window.PMUMockup` o `window.PMUGeometria` no están). Verificar con `smoke_checks()` → "Mockups: nucleo de render del editor desplegado" |
| `Unrecognized expression: <button ...` al crear una vista | Etiqueta HTML sin `>` de cierre pasada a `$()` (jQuery la lee como selector) | Cerrar la etiqueta. Lo atrapa `node tests/mockup-contrato.test.js` |
| Las capas tapan los tiradores / no se ven las guías | La capa de edición se dibujó antes de la composición asíncrona | `componer` debe recibir `limpiar: false` y la capa de edición dibujarse en el `.then` (`dibujar()` en `mockups.js`) |
| `motor:alta:falta:archivo` al subir una imagen | Un archivo de FormData viaja en `$_FILES`, **nunca** en `$_POST`: leerlo con `param()` devuelve cadena vacia | Leer de `$_FILES` con alias (`archivo_subido()`); los ambitos de imagen usan la lista de extensiones de `img`, no la de fuentes. Lo cubre la fase `mockup_alta` |
| `motor:alta:<ambito>:tipo:invalido` con un PNG valido | `firma_imagen_valida()` leia 12 bytes y comparaba contra los 8 de la cabecera PNG: la comparacion nunca podia ser cierta | Comparar `substr($firma, 0, 8)`. **Ningun PNG pasaba la validacion antes de este arreglo** |
| Aviso de recursos que nunca se pinta en la consola | Variable usada sin inicializar antes de compararla: en PHP 8 vale `null`, y `null === ''` nunca es cierto, asi que la rama queda muerta (bug real: `$aviso_cfg_campos` en `admin/pdfs.php`) | Inicializar la variable (`$x = '';`) y comparar solo contra cadena. `tests/texto_puente.php` ya convierte los avisos de PHP en fallos: si aparece `sin avisos de PHP`, el bug esta |
| Error `mockups_invalidos` al guardar una vista | WordPress aplica `add_magic_quotes()` a `$_POST`: el JSON llega con `"` y `json_decode` falla | Leer SIEMPRE con `wp_unslash()` antes de `json_decode` (ver `handle_mockups_guardar`). Ojo: el stub de `wp_unslash` del arnes debe hacer `stripslashes_deep` (identidad = tests ciegos) |
| Los controles de capa no se pintan / `unrecognized expression` en el editor | **Clase de bug**: cualquier `$('<tag ...')` sin el `>` de cierre. jQuery lo lee como SELECTOR. Ya ocurrio dos veces (boton de borrar vista; luego los 4 botones ▲▼◻🔒 de capa) | Cerrar la etiqueta. `node --check` NO lo detecta (el literal JS es valido). Lo cubre `node tests/mockup-contrato.test.js`, que recorre **todos** los literales de los modulos cliente (NO dejar el check atado a una sola linea: asi dio falsa confianza) |
| `PMUMockup.componer is not a function` | El núcleo exporta otro nombre | El nombre canónico es `componer` (`composicion` es alias). Lo verifica `tests/mockup-contrato.test.js` |
| "No se pudo recibir el texto renderizado del grupo X" | PNG supera límites del servidor | Subir `upload_max_filesize`/`post_max_size` o usar estilos más livianos |
| El texto renderizado sale con otra fuente | Google Fonts sin internet o TTF local ausente | `ensureFontReady` fuerza la carga; verificar conexión |
| Un preset guardado no aparece en otro navegador | — | Resuelto: presets `.txm` en `uploads/pmu/tm-presets/` |
| Un preset recién guardado no aparece en el selector de un grupo | Página "PDFs" abierta antes de guardar | Recargar: el listado se genera con glob en cada carga |
| Error del puente tras tener el admin mucho tiempo abierto | Nonce expirado (~12-24 h) | Recargar la página y reintentar |
| El cargador de un campo nuevo no aparece (nada que subir) y la consola solo avisa por `console.warn` | El `campo.js` del campo monta con `PMU_API.montarCargador` pero pasa `ranuras: []` (o falta `PMU_API`/`CargadorPMU`) | La plantilla "Imagen (cargador)" ya trae `RANURAS` por defecto: revisar que el campo conserve esa lista. `montarCargador` devuelve `null` y avisa; nunca inventa ranuras |
| El preview del admin no muestra el cargador del `campo.js` | El stub de `PMU_API` se inyectaba en el `srcdoc` del iframe, pero `campo-montar.js` ejecuta el `campo.js` con `new Function` **en el realm de la pagina del admin** | El stub va en el padre (`admin.js:apiPreview()` + `activarApiPreview()`), no en el srcdoc. Lo cubre `node tests/campos-contrato.test.js` |
| El modal de recorte (`spmu-modal`) aparece **por debajo** del drawer o del preview de la consola | El modal se cuelga del `body` del documento donde corre el script (en el admin, el de la consola) y tenia `z-index: 100000`, menor que el drawer (160000) y el preview (170000) | Escala de capas documentada en `admin.css` ("Escala de capas de la consola"): 160000 drawer < 170000 preview < 180000 modales (conflicto/bonus/recorte) < 190000 overlay de render. El `.spmu-modal` subio a 180000 en `selector-pmu.js` |
| La ranura del cargador pide un tamaño que ya no coincide con el hueco (PDF re-analizado o campo reutilizado en otro PDF) | El `w`/`h` de la ranura se escribe a mano y no sigue al grupo; el Motor encaja igual, asi que el error es invisible | Declarar `phsize: 1` (o `2`) en la ranura: `PMU_API.montarCargador` toma `grupo_w`/`grupo_h` del PDF en runtime (spec 019). Sin envoltura asociada degrada a `w`/`h` y avisa por `console.warn` |
| El cargador no se monta y el aviso dice `falta PMU_API o CargadorPMU en la ficha`, aunque el `campo.js` esta bien | `global.PMU_API = api;` se publicaba **despues** de `montarCampos()`, pero el `campo.js` corre DENTRO del montaje (spec 018 T001): durante el montaje la API no existia. Lo delato el aviso por causa, no un error | La API **COMPLETA** (con `montarCargador`) se publica **antes** de `montarCampos` y `api.estado` se asigna al terminar. `idsIniciales` se resuelve de `PMU_FICHA.valores` (no del estado a medio llenar). El test **exige el orden** (`global.PMU_API = api;` < `api.estado = montarCampos(`); comparar `var api = {` era un falso positivo |
| El cargador no aparece en la ficha y **no hay ningún aviso** en la consola | El `campo.js` hacia `return` sin avisar cuando faltaba `[data-pmu-cargador]`, `PMU_API`, `CargadorPMU`, o cuando las ranuras venian vacias (`RANURAS = []`) | Desde la spec 018 (fix) cada causa avisa por `console.warn` (`montarCargador` + la plantilla). Sin aviso y sin cargador: revisar que el `campo.htm` traiga `<div data-pmu-cargador></div>` |
| La guia dice "sin guia" aunque el grupo tiene envoltura | La guia se deduce del cableado del hueco y ese hueco no referencia el campo (p.ej. apunta a `[campo1]`, un campo borrado) | Spec 019 (F2): la guia se **deduce** del cableado del hueco (`[campoN]` en `value`/`settings`) o del unico grupo con envoltura si el campo es de tipo `imagen`. **No hay `<select>`**: si dice "sin guia", revisar a que campo apunta el hueco |
| Un campo con plantilla vieja no tiene boton de cargador y no hay como recuperarlo desde la UI | La plantilla `imagen` cambio (4.10.0) y los campos guardados conservan su HTML/JS anterior | Drawer -> **"Cargar la plantilla de este tipo"** (rellena HTML/CSS/JS desde `PersonalizadorPDF.plantillas`, sin endpoint). Faltaba en T010 de la spec 018 |
| **SMOKE CON 11 FALLOS** tras tocar `Overlay`/`Motor` | Una spec de imagen **ya es un array** (con su clave `tipo`), así que `is_array($x)` no distingue "una spec" de "lista de specs": `array_values($spec)` devuelve los valores sueltos y el PDF sale roto | Distinguir por la clave `tipo` (`Overlay::esListaDeSpecs()`) y llevar la bandera `$multi` sobre las **rutas** en `Motor` (que no tienen ambigüedad). Nunca sniffear el resultado |
| El PDF del pedido sale con claves numéricas (`[0, "otro"]`) en vez de nombres de PDF | Un `foreach ($porIdx as $gid => $rutas)` **pisa** la variable de salida `$rutas` en `item_generar_pdfs()` | Nombre distinto en el bucle interno (`$rutasGrupo`). Lo caza la fase `completados` |
| El guardado de un form con `pmuForm` no sale y no da error | `pmuForm` **registra** el handler: llamarlo desde dentro de otro `submit` lo agrega tarde y el POST nunca se envía | Enlazar con `pmuForm($form, action, nonce, cb)` en **tiempo de enlace**, nunca desde un handler `submit` |
| `Class "PMU_Sesion" not found` en un endpoint nuevo | `PMU_Sesion` se carga **lazy** dentro de `sesion()`; usar su constante antes de llamar `sesion()` la busca sin cargar | Llamar `$this->sesion()` **primero** si el handler usa `PMU_Sesion::` |
| El comprador ve el campo de imagen pero sin sus ranuras | `panel_ficha()` leía el **adaptador de tupla v1**, que no transporta `cargador` | Leer las filas **v2** (`campo_listar()`): el cargador vive en `datos` |
| Un banco de tests falla de forma intermitente | El directorio temporal se nombra por PID y **no se borra al empezar**; Windows reutiliza PIDs y queda estado sucio | Sufijo aleatorio (`bin2hex(random_bytes(4))`) en el nombre |
| El CSS global no se aplica dentro de `@media` | `preg_replace('/[^\w-].*$/s','')` casaba en el **propio arroba** y el nombre del at-rule salía vacío | `ltrim($cabecera,'@')` antes, y que la lista de at-rules anidados **tampoco** lleve `@` |
| El campo de imagen aparece pero `valor` sale vacío | `onChange` del cargador dispara también en el **montaje**: escribir ahí ponía `valor = []` y pisaba lo publicado por `campo.js` | El cargador toma el control del `valor` recién con la primera foto (bandera en el closure) |
| Un boton con `hidden` se ve igual (`display:inline-block`) | WordPress fuerza `display` a `.button`, que le **gana** a la regla `[hidden]{display:none}` del navegador | Una regla del plugin: `.personalizador-pdf .button[hidden] { display: none; }` |
| Un `action=""` en un form embebido | Se limpio una variable local que **otro markup de la misma funcion** usaba (el form de baja vive en la fila, no en el editor) | Al partir una funcion en varias, grep el archivo por el nombre de la variable antes de borrarla. Comprobar el `action` renderizado, no solo que el PHP no avise |
| El smoke pasa y el flujo sigue roto | La zona ciega del propio smoke: **se salta baja/restaurar si hay un solo campo** | Sembrar **dos** campos antes de confiar en esa parte; el check nuevo del `action` cubre la baja, el resto del recorrido sigue teniendo ese hueco |
| Un prefijo de selector sale con un ` [data-pmu-panel]` en medio | `explode(',', ...)` parte tambien las comas de `:is()`/`:where()`/`:not()` | Partir solo por comas de **nivel 0** (contando parentesis). `css_global_prefijo()` tiene el parser |
| El editor de un campo no se ve al probarlo | Con un drawer abierto la fila queda **tapada**, asi que su boton "Probar" es inalcanzable | El drawer trae su propio "Probar" (`window.PMUCampos.probar()`), no el de la fila |
| El invitado no puede comprar (ni previsualizar ni subir fotos) | Los endpoints del comprador exigian `current_user_can('read')`, que con checkout sin cuenta es `false` | Autorizar por la **cookie `pmu_sid`**, no por capacidad: `sesion_del_comprador()` (spec 014) |
| El `sid` del POST no es la identidad del comprador | Los handlers lo leiaban del request; con el nonce impreso en la ficha (**publico**) eso permite tocar la sesion de otro, **tambien estando logueado** | Ignorar el `sid` del POST y usar siempre `PMU_Sesion::sid_actual()` (la cookie); con `item_key` exigir el manifest bajo ese sid |
| La foto del comprador no se ve en la vista previa (hueco transparente/gris); `personalizador_pdf_subida_url` responde `motor:subida:archivo:ausente` | `resolver_subidas()` armaba la ruta con `dir_item()` + `basename()`, que le arranca la carpeta `subidas/` y busca el archivo en la **raiz del item** (no existe ahi) | Resolver contra `dir_subidas()` (`basename()` como defensa anti-traversal). El texto no se afecta: no usa esta ruta. El `.catch(()=>null)` del cliente se traga el error: sin log. La fase `campo_subida` ahora exige que la ruta DEVUELTA apunte a un archivo real (no solo la ruta cruda del manifest) |
| Compro y el pedido **no aparece en la pestaña Pedidos**; `orders/` y `tmp/orders/` quedan vacios | `carrito_promover()` renombraba la carpeta del item de `draft-{uuid}` al `cart_item_key` real, pero **no actualizaba** `pmu_item_key` en el carrito: en el checkout `pedido_item_crear()` leia el draft huerfano, `staging_order()` fallaba con `motor:sesion:item:ausente` y el fail-safe lo tragaba en silencio (el pedido nunca se promovia) | Tras promover, setear `WC()->cart->cart_contents[$item_key]['pmu_item_key'] = $item_key`; y en `pedido_item_crear()` usar el `$clave` (cart_item_key real) si el item_key de los datos no resuelve. La fase `carrito` ahora encadena el ciclo real (agregar -> promover -> checkout -> staging -> pago -> `orders/`) |
| Igual que el de arriba, pero **persiste tras 4.6.13**: el checkout es otro request HTTP y los custom cart data `pmu_sid`/`pmu_item_key` **no sobreviven** en `$values` | `pedido_item_crear()` identificaba el item con `$values['pmu_sid']/['pmu_item_key']`; con `$values` vacio hacia `return` temprano silencioso -> sin staging ni `_pmu_items` | Identidad por **cookie** `pmu_sid` (`sid_actual()`, spec 014) + `item_key` probando `$clave` (cart_item_key) y luego el de los datos. Log `uploads/pmu/pmu-pedidos.log` en los caminos de fallo. La fase `carrito` ejercita el ciclo con `$values` vacio |
| Compro y el pedido **sigue sin aparecer en Pedidos** aunque la metadata del item este OK; el log muestra `motor:dir_tmp_order:pedido:invalido` y `promover:falla ... item=0` | El staging se creaba en `woocommerce_checkout_create_order_line_item`, donde `$order->get_id()` = 0 (el pedido aun no tiene ID) -> `dir_tmp_order(0)` lanza y el staging nunca se crea; y `_pmu_items` quedaba con **clave fantasma `0`** | El staging se crea en **`woocommerce_checkout_order_processed`** (`pedido_staging_crear()`, ID real) y `pedido_promover()` itera los **line items** (`_pmu_item_key`/`_pmu_sid`, que si persisten) en vez de `_pmu_items`, crea el staging al vuelo e **ignora la clave `0`**. Recupera pedidos viejos al re-guardar el estado. Diagnostico: `uploads/pmu/pmu-pedidos.log` |
| El PDF no aparece en `mi-cuenta/descargas/` aunque el pedido este en `orders/`; o aparece **duplicado** | El plugin inyectaba su fila en `woocommerce_customer_get_downloadable_products`, que de Woo solo procesa productos **marcados como descargables**; si no lo estan, la fila no sale. Y con el tema activo podia duplicarse | Spec 017: con el tema `muyunicos` activo (`function_exists('mu_update_item_files')`), el plugin publica la URL protegida en `_urls_files` del item y **deja de inyectar** (el tema entrega email + descargas). Portable: sin tema, comportamiento propio intacto. Fases `entrega_tema`/`entrega_sin_tema` |
| Un override no cambia el estilo del PDF | `renderBatch` se arma **sin** `settings` (`tienda.js:831`), y TextMUy no los espera en `settings` sino en **`overrides`**, como **objeto** (`api.js:296, 271`) | Pasar el objeto ya fusionado en `items[].overrides`. `mergeDeep` del modulo lo aplica sobre el preset: **no hace falta tocar `modules/textmuy/`** |
| El toggle "Envoltura del PDF (PowerClip)" del editor de mockups sale deshabilitado | No existe `pdfs/{nombre}/envolturas.json` (PDF analizado con una version sin soporte) o esa instancia no tiene clip en el PDF | **Re-analizar** si el archivo falta (regenera `envolturas.json`); si el archivo existe pero la clave no, ese placeholder simplemente no esta recortado en ninguna forma (sin envoltura) |
| La forma de la envoltura no aparece en la ficha ni en el modal de recorte | El campo no tiene envoltura asociada en ese PDF (`campos_envoltura` vacio) o el nucleo `mockup-render.js` no esta encolado en la ficha | Asociarla en la consola ("Envoltura del cargador") y Ctrl+F5. La guia es solo una PISTA: el PNG va crudo y el clip real lo aplica el PDF |
| El PDF sale con `[object Object]` | `resolverPlantilla` hace `String(v)` y un objeto se convierte en eso, en silencio | El `valor` de un campo es **siempre string**; el tipo `opciones` publica `JSON.stringify(overrides)` y lo parsea el render |
| El cliente ve un estilo y el PDF trae otro | El hash del pool (`valor\|preset\|settings\|WxH`) **no incluia** los overrides: el primero que renderiza llena la cache y el resto recibe su PNG | Meter los overrides resueltos en el hash **en el mismo commit** que los activa: el fallo no es excepcion, es el PDF equivocado (hecho en 4.5.0: `hashRender` + `hash_pool()` con `\|{json}`) |
| `motor:sesion:manifest:invalido` en la vista previa y capa de imagen gris | Rafaga de POSTs del pool concurrentes (texto + fotos por instancia, en paralelo) chocando en `manifest.json.tmp` (nombre fijo, rename sin lock) + read-modify-write que perdia filas: la instancia sin fila dejaba la capa placeholder sin recurso | TODAS las mutaciones del manifest del item pasan por `PMU_Sesion::mutar_manifest()` con lock `flock` por item (`.manifest.lock`, que `copiar_arbol` no traslada al pedido). Lo cubre la fase `pool_concurrente` del arnés (8 hijos en paralelo, 8 filas) |
| Editar un campo con cargador falla siempre | `handle_campo_guardar()` pasaba `$_POST` crudo: el JSON del cargador llegaba con `\"` (add_magic_quotes), `json_decode` fallaba y `validar_cargador` tiraba `motor:campos:cargador:invalido` | `wp_unslash($_POST)` antes de `campo_desde_post()` (convencion de mas abajo); el alta lo esquivaba porque el modal no manda cargador |
| Un placeholder con texto fijo y estilo no aparece en el PDF | El Motor **no renderiza texto**: `procesar_pedido($ruta, $mapaIdRuta)` solo pega PNGs | El navegador tiene que renderizar el grupo entero, aunque el `value` sea literal (sin ningun `[campoN]`). Por eso **la vista previa ES el PDF final** |
| Compro y el pedido no trae email ni descarga (el tema no muestra `_urls_files`) aunque el formulario estaba completo; el log muestra `item_crear:sin_item` con un `clave=` que no existe en disco | El checkout de Woo **recalcula el `cart_item_key`** (hash del item; los custom cart data no sobreviven al restaurar el carrito) y NO coincide con el nombre de la carpeta que dejo `carrito_promover`. La busqueda por nombre fallaba -> `return` temprano -> sin metadata en el line item -> `pedido_promover` no promueve nada -> sin `orders/` ni `_urls_files` (caso #29081) | `PMU_Sesion::resolver_item_checkout()`: candidatos directos y, si ninguno resuelve, **scan de la sesion** tomando el item real por su `manifest.json` (sin depender del hash de Woo). Red de seguridad en `pedido_promover()` tambien. Recupera pedidos historicos al re-guardar el estado. Lo cubre la fase `carrito` (5 checks, caso #29081) |
| Subir un archivo Bonus "no hace nada": el JSON de admin-post es `{"avisos_cableado":[],"avisos_vinculo":[]}` y en `pdfs/{nombre}/bonus/` no hay nada | El bloque de subida era un `<form>` **anidado** dentro de `<form class="ec-form-config">`: el HTML descarta los forms anidados, el JS no encuentra `.ec-form-bonus-subir` y el boton dispara el guardado de **config** (cuyo `serializeArray()` ignora los input file) -> el archivo nunca sale del navegador | Nunca anidar un `<form>` dentro de `ec-form-config`: div + `<button type="button">` + `click` con FormData propio. Los archivos subidos viven en una **lista siempre visible** (chips), porque solo existian como radios dentro de filas guardadas y con 0 filas eran invisibles. Atrapa la fase `admin`: equilibrio `<form`/`</form` + ausencia del form anidado |
| La fase `mockups` del arnes sale en rojo por `clamp de filtros/rot/sesgo` aunque el saneo este bien | El check comparaba **la capa normalizada completa** con `===` (13 claves) y el contrato de capa gano una clave aditiva (`envoltura`, PowerClip de la spec 011): 14 claves nunca son iguales a 13 | Comparar por **claves esperadas**: `array_intersect_key($capa, $esperado) === $esperado` con `ksort` a ambos lados (el `===` de PHP tambien es sensible al orden). La presencia y el valor de las claves aditivas se cubren aparte, en la fase `mockup_capas` |
| El **ojito** del modal no hace nada al tocar/clic (solo funciona con la barra espaciadora) | El `pointerdown` burbujeaba a `spmu-escena`, que arrancaba el arrastre y hacia `setPointerCapture`: el `pointerup` terminaba en la escena y el navegador **no generaba el `click`** en el boton. Con teclado andaba porque Espacio dispara `click` sin pointer events | `pointerdown` del ojito con `stopPropagation` **y** guard `self.ojo.contains(e.target)` en la escena (el evento cae en el `<svg>` interno, no en el boton). Fix 4.15.2 |
| El **zoom se corre** al arrastrar la foto: el contenido bajo el centro de la forma se desplaza | El punto fijo del zoom es el **centro de la imagen**, y `origenDibujo` sumaba el desplazamiento **sin escalarlo**: el centro quedaba en `forma + desp` para cualquier zoom | `desp * zoom` en `origenDibujo` (el punto bajo el centro de la forma queda **invariante**) y el arrastre se compensa (`delta / zoom`) para seguir 1:1 con el dedo. Fix 4.15.3 |
| El PNG del comprador mide **mas que el hueco** o sale **ampliado/borroso** | La ranura declaraba `w`/`h` a mano con `phsize: 0`, sin seguir al grupo del PDF: se generaba un PNG enorme que el Motor reducia despues | **`phsize: 1`** en la ranura (toma el tamano del hueco; degrada a `w`/`h` y avisa si no hay grupo). La plantilla \"Imagen (cargador)\" ya viene asi. **Spec 028 D9**: con `phsize: 0` la ficha **avisa** si el lienzo declarado no es el hueco del grupo (el Motor reencajaria la composicion) |
| El WebP guardado pesa **mucho mas de lo que la foto justifica** (p. ej. 1 MB por una foto de 400x300 en un hueco de 1000x1000) y llega ampliado/borroso | El PNG media el **lienzo entero** sin mirar la resolucion de la foto: el navegador **inventaba** pixeles (hasta 3,3x en ese caso) y el archivo crecia con el area | **Spec 028 D11**: `escalaSalida()` acota el PNG a `round(W·k) x round(H·k)` con `k = min(1, max(iw,ih)/max(caja))` — uniforme, para conservar el aspecto del lienzo (y el encuadre). El caso tipico (foto grande) queda en `k = 1`, sin cambios. Lo cubre `selector-contrato` F2b (propiedades + los casos 300x300 / 400x400 / 400x400) |
| Los 3 modos "no hacen lo que dicen" (**Cubrir deja huecos**) o el PDF sale **corrido** respecto de la vista previa | La spec 025 redefinio los modos con palabras ambiguas ("Rellenar" = recortar al aspecto **sin ampliar**) y el PNG se generaba como `min(caja, lienzo)` pero **centrado en el LIENZO**: con un lienzo no cuadrado la ventana y el centro no coincidian, y con una foto mas chica que el marco la caja no lo tapaba | El contrato vigente es la **tabla de la spec 028** (`specs/028-modos-lienzo/contracts/modos.md`): **Cubrir**=`cover`, **Encajar**=`contain`, **Estirar**=`fill`, y **el PNG mide SIEMPRE el lienzo** (`W x H` = el hueco), asi que el Motor encaja 1:1. Los modos se verifican **por propiedad** (`selector-contrato` F2b), no con ejemplos: fue justamente un banco de ejemplos lo que fijo la lectura equivocada |
| La politica `transp` del campo **se ignora en la ficha** (el comprador ve el boton "damero" igual que siempre) | `PURO.normalizarRanura()` (`assets/tienda.js`) es el normalizador de la **ficha** y **no devolvia `transp`**: `CargadorPMU` la recibia vacia y el selector caia en el comportamiento del cliente. La consola no lo delataba porque su stub (`admin.js`) pasa las ranuras crudas | Devolver `transp` desde `PURO.normalizarRanura` (fix de la spec 028). Lo atrapa `selector-contrato` F2b ("normalizarRanura NO puede perder `transp`"). **Clase de bug**: hay **dos** normalizadores de la misma ranura (el de la ficha en `tienda.js` y el del cargador en `cargador-pmu.js`): una clave nueva hay que agregarla en **los dos** |
| La vista previa genera **cientos de archivos** en `{item}/img/` y son **copias** de `subidas/` | `PURO.conciliarGrupo()` devuelve una copia del valor unico **por instancia** del grupo y el cliente subia **una imagen por instancia** (bajando y rasterizando la subida cada vez); el texto se renderizaba tambien una vez por instancia | **Spec 029**: las fotos se **registran** (`registrar_fotos` → la fila apunta a `subidas/{id}.{ext}`, `origen: 'subida'`) y el texto uniforme se colapsa a **una** entrada (`dedupPendientes`). El Motor **ya replicaba** una sola fila a todo el grupo (`item_generar_pdfs` pasa escalar): no hacian falta N filas |
| El PDF asigna **la foto de otra instancia** (dos fotos en el mismo grupo salen cambiadas) | La fila guardaba `indice` = **numero de archivo** (`siguiente_n`, `$n - 1`) y las instancias 2..N de un grupo suben **en paralelo**: el orden de las filas no era el de las instancias | **Spec 029 (D3)**: `indice` = **posicion de instancia** y lo manda el cliente (`indice` en el POST del pool). Lo cubre la fase `fotos` (el caso mixto exige `[0, 1, 2]`) |
| Un grupo del que se **borran todas las fotos** sigue imprimiendo la foto vieja | El cliente no llamaba a registrar cuando no habia fotos: las filas viejas quedaban en el manifest | **Spec 029**: se registran **todos** los grupos de imagen (aunque vengan vacios) y el servidor **reemplaza** las filas del grupo (vaciarlo las borra). Lo cubre la fase `fotos` ("un grupo vaciado borra sus filas") |
| En `{item}/subidas/` se **acumulan fotos** que el comprador reemplazo o quito, y viajan al pedido | Nadie borraba la subida vieja: el cliente sube una nueva (id nuevo), descarta la anterior del estado y el archivo quedaba para siempre (`copiar_arbol` mueve el arbol entero) | **Spec 029 (D7)**: `podar_subidas()` conserva lo que usa una **fila** de `archivos[]` o algun **`valores`** y borra el resto (archivo + fila). Se llama al registrar fotos y en la vista previa; **sin filas ni valores no borra nada** (una foto recien subida no se pierde). Lo cubre la fase `fotos` (5 checks de D7) |
| Deploy a medias: la tira sale vacia o el modal no monta nada | El webhook de Hostinger sube archivos sin orden garantizado: puede quedar un `PMU_Sesion` viejo (sin `familias()`) con el JS nuevo | La linea **"Biblioteca: PMU_Sesion al dia (metodos de la spec 030)"** del smoke (y la fase `smoke` del arnes) canta el deploy parcial: re-implementar y Ctrl+F5 |
| La tira sale **vacia** aunque hay fotos, y no se arregla recargando | Copia local **envenenada** (`pmu_bib_v2` con `fotos: []` de una corrida vieja) y el servidor respondiendo `sin_cambios` (revalidacion por `revision`) | Resuelto en 4.22.1: `pedir()` se **auto-sana** (copia vacia + `sin_cambios` -> re-pregunta sin `desde`). Si igual pasa: borrar `localStorage.pmu_bib_v2` y Ctrl+F5 |
| El comprador ve la biblioteca vacia aunque subio fotos en la misma sesion | La identidad es la **cookie** `pmu_sid` (invitado) + sus `_pmu_sids` (registrado): otra ventana, otro navegador o incognito es **otra** identidad | Abrir la ficha en la **misma** ventana/cookies, o iniciar sesion (el vinculo por `woocommerce_guest_session_to_user_id` une el historial) |
| La galeria de fuentes no muestra la causa del fallo ni el boton "Reintentar" (el error queda mudo) | `fuentes-galeria.js`: el `.then()` posterior al `onError` llamaba SIEMPRE a `actualizarBotonHojas({error:false})` (ocultaba el boton) y `render()` -> `rfFooter()` pisaba el status con "Selecciona una fuente" en cada repintado | La causa vive en un `avisoError` **de modulo** que el footer **prefiere** en cada repintado, y el `.then()` no toca la UI si hubo error (RC75). Lo cubre el escenario "motor rechaza => causa + Reintentar" de `galerias.browser.js` (falla sin el fix) |
| El cliente informa `motor:rechazo` en vez del motivo exacto del motor | `assets/miniaturas.js::persistirSheet` descarta `data.data` y devuelve `null` ante `success:false` | **Pendiente declarado** (spec propia, T041 de la 009): propagar `data.data` como causa. El motivo exacto **si** aparece cuando el fallo es de una celda (`fonts:hoja:celdas:N:pendientes (nombre)`) |
| El recorrido manual "no da evidencia" o se corre en el hosting a mano | El repo ya tiene un **laboratorio local** (`C:\wp-lab`: WP+SQLite, `php -S localhost:8091`, plugin por **junction** al repo) con precedentes de recorridos scripteados (`probe.js`, `recorrido-us1-us5.cjs`) | Correr el recorrido **scripteado** contra el lab (Playwright + Chrome; Playwright se instala fuera del repo, en `%TEMP%` + `NODE_PATH`): mide red, archivos y geometria, y deja capturas. Ejemplo vigente: `C:\wp-lab\recorrido-009.cjs` (33/33 de la spec 009) |
