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
- [7. Decisiones de diseño cerradas (lo que NO se negocia)](#7-decisiones-de-diseño-cerradas-lo-que-no-se-negocia)
- [8. Dificultades del entorno](#8-dificultades-del-entorno)
- [9. Cómo probar](#9-como-probar)
- [10. Reglas para la IA al editar](#10-reglas-para-la-ia-al-editar)
- [11. Errores comunes (resolver antes de preguntar)](#11-errores-comunes-resolver-antes-de-preguntar)

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
- **Motor PHP**: el plugin procesa PDFs en hosting compartido (**Hostinger Business: solo PHP**)
  sin Python ni Node en el servidor. El servicio
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
│   │                             `mockup-geometria.js`; grupos e importacion
│   │                             local de pagina PDF, seleccion Alt+clic de miembro,
│   │                             escala uniforme de grupo y orden extremo por pulsacion
│   │                             larga (spec 011)
│   ├── mockup-render.js      ← NUCLEO de composicion del mockup (Canvas 2D):
│   │                             `PMUMockup.componer/contener/filtroCss/esValida`.
│   │                             UNICA funcion de render del sistema: la usan el
│   │                             editor y la ficha (spec 011, R1)
│   ├── mockup-geometria.js   ← Geometria PURA del editor (acotar, imanes, tiradores,
│   │                             rotacion, acertar, alinear, distribuir). Sin DOM;
│   │                             testeada con `node tests/mockup-geometria.test.js`
│   │                             y `node tests/mockup-contrato.test.js` (cableado)
│   ├── vendor/pdfjs/         ← PDF.js local (Apache-2.0): raster de paginas PDF para el editor
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
  `rot`/`sesgo` legado/`filtros`/`modo`/`nombre`/`oculta`/`bloqueada`/`envoltura`/`grupo`/
  `grupo_rot` y
  `perspectiva.puntos[]` opcional (cuatro puntos normalizados para deformar el grupo completo)
  opcional; canvas 300x300),
  `tienda{product_id}` (spec 005: Configuracion
  tienda por asociacion PDFxproducto: `activo`/`validez`/`mensaje_html`/`bloquear`;
  la expresion `validez` se evalua SOLO en el navegador, PHP nunca evalua JS),
  `envolturas{gid:{forma:k}}` (contrato v4: forma representativa del grupo dentro de
  `envolturas.json`; 0/ausente = la mas usada; el campo sale en la cabecera del grupo),
  `placeholders[id]` con
  `tipo`/`preset`/`value`/`settings` (la guia de envoltura del cargador **se deduce** del
  cableado del hueco), `bonus[]` (archivos extra 0..N
  de la **biblioteca global compartida** `uploads/pmu/bonus/` con catalogo
  `bonus.json`; filas `{archivo, titulo}` (biblioteca; `titulo` vacio =
  titulo por defecto DINAMICO del catalogo, o nombre sin extension) o
  `{url, titulo}` (externa); el archivo se elige por modal, se puede
  reemplazar (conserva referencias) y borrar con escaneo de uso; al comprar
  se congelan en la meta `_pmu_bonus` del line item con el titulo resuelto.
  La biblioteca se referencia con `archivo`; una `url` relativa en `config.json` se descarta.
  **Spec 011 (contrato de capa)**: `capas[].ref` lleva **namespace obligatorio** — `pdf:{archivo}`
  (foto del PDF) o `mock:{id}` (id numerico del catalogo); un `ref` plano ya **no** se
  acepta en el cliente (el servidor lo normaliza al leer, una sola vez). `capas[].filtros` admite
  `brillo`/`gama`/`contraste`/`saturacion` 0..200, `opacidad` 0..100, `desenfoque` 0..20 y
  `tono` -180..180; el valor igual al default **no se persiste**. `capas[].modo` es
  `normal`|`multiply`. `grupo` agrupa capas del editor para seleccionar/mover/redimensionar/rotar
  juntas (capas de hasta 1200 px); `grupo_rot` conserva la orientacion comun del marco, y dibujo,
  hit-test y perspectiva usan sus mismos ejes. El panel y sus controles numericos operan sobre el
  grupo. Cuatro puntos convexos `perspectiva.puntos` aplican homografia al grupo **o a una capa
  individual** (spec 034: la capa sin `grupo` usa la clave `i:{indice}` del render) a traves del render compartido,
  solo para el mockup: no modifican los PNG del pool ni el PDF final. El tirador de rotacion grupal
  se mantiene dentro del lienzo y acumula deltas del puntero; las imagenes conservan su proporcion
  al redimensionar desde cualquier tirador. `sesgo` se conserva para capas
  guardadas, pero ya no se ofrece como control del editor. Alt+clic permite manipular un miembro sin
  cambiar su pertenencia. `x`/`y` aceptan ±3000 px:
  el contenido fuera del area 300x300 queda recortado al renderizar. En la lista ▲/▼, mantener
  1 segundo envia la seleccion (grupo como bloque) al extremo del orden y se registra como una
  accion deshacible. El editor importa una pagina elegida del PDF como imagen del
  catalogo `mockups` con su proporcion natural y sus placeholders con envolturas, inicialmente en el mismo grupo;
  rasteriza con PDF.js local y consulta la geometria al motor PHP. Todo es opcional:
  ausente = comportamiento actual.
  Contrato completo: `specs/011-editor-mockups-visual/contracts/mockup-capas.md`.
  Sin `textos.json` y sin `metadata.json` (norma ex-008).
- Fotos de mockups del admin: `pdfs/{nombre}/mockups/` (datos de usuario, sin catálogo);
  las reutilizables viven en el catálogo `img/`.
- Archivos bonus del admin (4.7.0): biblioteca global `uploads/pmu/bonus/`
  (compartida por todos los PDFs) + catalogo `bonus/bonus.json`
  (`{version, items:[{archivo, titulo}]}`, titulos por defecto dinamicos);
  la lista vive en `config.json:bonus[]` como `{archivo, titulo}` o
  `{url, titulo}` (externa) y se congela por pedido en `_pmu_bonus`.
- **Campos reutilizables (specs 012 + 015, formato v3)**: `uploads/pmu/campos/campos.json` es
  **solo el indice** (vive junto al codigo de los campos, dentro de `uploads/pmu/campos/`)
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
  El cargador vive **solo** en el `campo.js`.
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
  tipo `imagen`, de ese. **No hay `<select>`**: la guia no se configura a mano. La consola solo informa
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
- **Reemplazo del PDF (spec 032)**: `uploads/pmu/tmp/reemplazos/{nombre}/` con `ultimo.json` (el `{ts}`
  recuperable) y una carpeta por reemplazo `{ts}/` con `nuevo/` (staging: PDF + `analisis.json` +
  `envolturas.json` nuevos) y `anterior/` (el respaldo: los 4 archivos del producto). **Un solo respaldo**
  por producto y **fuera del TTL** de la spec 030 (`limpiar_ttl` barre solo `tmp/sesion-*`). Borrar el
  producto limpia tambien su `tmp/reemplazos/`.
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
- Migracion ex-008 pendiente (partir ex-`metadata.json`
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

## 7. Decisiones de diseño cerradas (lo que NO se negocia)

Estas decisiones **siguen vigentes** y no deben revertirse. El historial completo (que spec las
tomo, cuando, y cuales quedaron superadas) vive en [`docs/decisiones.md`](./docs/decisiones.md);
el estado de cada spec, en [`specs/INDICE.md`](./specs/INDICE.md).

- ❌ **Sin Python ni Node en el servidor**: el plugin se despliega en hosting compartido
  (**Hostinger Business**) y ahi **solo corre PHP**: no hay Python, Node, `exec()`, procesos en
  segundo plano ni Composer en runtime. **El alcance es lo que se despliega** (`personalizador-pdf.php`,
  `engine/`, `inc/`, `admin/`, `assets/`). En **desarrollo** si se usa Node (47 suites + Playwright),
  Composer/PHPStan, `npx jscpd` y PowerShell. La v1 era Flask + Python y se migro justamente por esto.
- ✅ **Datos fuera del plugin**: todo lo del administrador vive en `uploads/pmu/` (§5); la carpeta
  del plugin y la del modulo son reemplazables sin perder informacion. Sin contenido de fabrica.
- ✅ **Sin duplicados**: antes de agregar algo, revisar el arbol y reutilizar. Un solo motor de
  render de mockup (`mockup-render.js`) para editor y ficha; una sola logica de montaje de campos
  (`campo-montar.js`).
- ✅ **Un duenio por dato**: `PMU_Uploads` (rutas y catalogos), `PMU_Sesion` (ciclo del comprador),
  `Metadata` (dataset). Ningun otro archivo escribe esos datos.
- ✅ **El Motor no renderiza texto**: el navegador rasteriza y **la vista previa es el PDF final**.
- ✅ **Presets**: formato unico `.txm` + celda en el sprite del ambito (`thumbs.webp`).
- ✅ **Modulo TextMuy integrado** en `modules/textmuy/` (repo propio; bump `?v=RCn` al tocar su JS).
- ✅ **Norma ex-008** (`constitution` §IV): `analisis.json` inmutable + `config.json` editable;
  sesion por item `tmp/sesion-{sid}/{item_key}/`; entregable en `orders/{order_id}/{item_key}/`.
- ✅ **Jerarquia documental**: `constitution` > `AGENTS.md` > resto.

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

### Cline: herramientas y reglas del agente (verificado 2026-10-27, extension v4.1.26)

- **Herramientas vigentes**: `read_files`, `search_codebase`, `run_commands`, `fetch_web_content`,
  `ask_question` y **`editor`** para editar. Esta build ofrece `editor` **o** `apply_patch`, nunca
  ambas (la sesion recibio `editor`). `write_to_file` / `replace_in_file` / `execute_command` son
  **nombres legacy** que ya no existen: un doc que los nombre esta desactualizado.
- **Plan mode no edita**: si la tarea requiere escribir, pedir Act mode. No intentar escribir por
  `run_commands` (redirecciones y `Set-Content` estan bloqueados).
- **Carpetas de reglas que Cline lee**: `AGENTS.md` (raiz), `.clinerules/` y **`.cline/rules/`**
  (verificado en el bundle: `Agt() = [.clinerules, .cline/rules]`). El escaneo es **NO recursivo** y
  solo toma `.md`/`.markdown`/`.txt`, asi que `.clinerules/workflows/` **no** se carga como regla
  (son slash commands). Reglas globales: `%USERPROFILE%\Documents\Cline\Rules`.
- **Donde van las reglas operativas del agente**: `.cline/rules/00-flujo.md`, **versionado**
  (`.clinerules/` esta en `.gitignore` y lo gestiona Spec Kit con hashes en
  `.specify/integrations/cline.manifest.json`). Ese archivo **no repite** normas: solo remite aqui.
- **Esta version NO soporta reglas condicionales** (`paths:`/`globs` en frontmatter): la doc oficial
  describe un runtime mas nuevo. No disenar reglas por area: acortar este archivo tiene un efecto de
  **foco** (menos dilucion), no de costo (ver el punto siguiente).
- **Costo por request**: `AGENTS.md` (119 KB ≈ 30k tokens) se carga entero en cada request, pero sobre una ventana de **1M**
  eso es ~**3%**: el problema no es el costo sino la **dilucion de foco**.
  `modules/textmuy/AGENTS.md` (129 KB) **no** se auto-carga (anidado) y se lee solo si se toca el
  modulo.
- **Modelo y ventana**: provider **`openrouter`**, modelo `deepseek/deepseek-v4.1-flash-1017`, contexto **1M** y salida
  **393k** (verificado en `~/.cline/data/globalState.json`, 2026-10-27). La entrada
  `openai-compatible` de `models.json` (`oc/deepseek-v4-flash-free`, 128k, 8k de salida) es config
  **vieja** (27-ago) y ese proxy local no escucha: no usarla para diagnosticar.

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
                              # completados | mockups* | mockup_capas | mockup_pagina |
                             # mockup_preview | mockup_foto |
                              # mockup_foto_baja | mockup_foto_ajax |
                              # desactivar | reanalizar | envoltura_op | reemplazo | borrado | campo_global | smoke | biblioteca
```
Los 3 arneses CLI salen de inmediato si no corren por CLI (`PHP_SAPI !== 'cli'`):
la carpeta `tests/` viaja con el plugin al hosting y no debe ser ejecutable por HTTP.

### Auditoría de código (solo desarrollo; NO corre en hosting)
```powershell
php composer.phar run analisis              # PHPStan nivel 4 (phpstan.neon): codigo muerto,
                                            # ramas muertas y condiciones imposibles
npx --yes jscpd@4 --config .jscpd.json .    # Bloques clonados PHP/JS -> docs/jscpd-report.md (no versionado)
php tests/inventario_repo.php               # Archivos/pesos/dependencias -> docs/inventario-repo.md (no versionado)
```
- `/vendor/` (composer, anclado a la raiz) y `composer.phar` estan en `.gitignore`
  (jamas se despliegan). `assets/vendor/cropper/` quedo **vacio y retirado** en la spec 021
  (Cropper.js 1.6.2 era el motor de la 016 y el selector ya no lo usa; lo congela
  la fase F0 de `tests/selector-contrato.test.js`). En `assets/vendor/pdfjs/` **sigue**
  el PDF.js local (Apache-2.0), que es dependencia dura del editor de mockups
  (`pdfjsWorker`/`pdfjsCMaps` en `personalizador-pdf.php`): no borrarlo. `composer.json`,
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
`docs/entorno-desarrollo.md` §9. Vigentes: **`tests/galerias-sprite.browser.js`** (spec 009: galerias y
hojas, **32/32**) y **`tests/ficha-pedido.browser.js`** (ficha → pedido → `orders/{id}/{item}/…_procesado.pdf`,
**26/26**). Ambas cubren caminos que ninguna otra puerta cubria (`assets/tienda.js`, galerias/hojas) y
la de ficha-pedido ademas la **biblioteca del comprador** (spec 030: tira, `Elegir` 0 bytes, version,
dedupe y visor compartido). **Fallan con la causa accionable** si al lab le falta una precondicion (lab apagado, producto sin
`_pmu_pdf_slugs`, catalogo `img/` ausente, **presets v1 en lugar de v2**, COD sin `enable_for_virtual`).
La de galerias tiene modo **`PMU_SOLO_UI=1`** (+ `PMU_BASE=<hosting>`) para correr contra el hosting
sin leer el disco del lab.

```powershell
$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"
$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/galerias-sprite.browser.js       # 32/32 (mutan/restauran datos del lab)
node tests/ficha-pedido.browser.js          # 26/26 (crea un pedido de prueba)
pwsh C:\wp-lab\arrancar.ps1                 # (si el lab esta apagado)
```

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
(**47 suites** `*.test.js` + 2 de navegador (`galerias.browser.js`, `ficha-pedido.browser.js`); Node NO corre en el servidor productivo
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
- ❌ NO DEBES: introducir Python, Node o `exec()` en el **runtime del plugin** (lo que se
  despliega). Las herramientas de desarrollo (Node, Composer/PHPStan, `npx`, PowerShell) estan
  permitidas: son las puertas de §9.
- ❌ NO DEBES: modificar bases de datos, credenciales o servicios externos, ni desplegar a
  producción sin aprobación explícita del usuario (el push dispara deploy; §2).
- ❌ NO DEBES: editar a mano `.specify/` ni `.clinerules/` (gestionados por el CLI y
  gitignored): actualizá con `specify integration upgrade cline --script ps` (§8).
- ✅ El módulo `modules/textmuy/` es un repositorio git propio (`muyunicos/textmuy`, el
  original) que vive dentro de este checkout: se edita directamente y se corren sus tests
  Node (`node --check` + 47 suites), pero sus commits y push van EN ESE repo; se hace bump
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
   unico que no sufre escapado de shell. **Nunca** generar **contenido** con
   heredocs de bash, con `Set-Content` sobre un fichero existente, ni con scripts
   de Node o PowerShell que reescriban el fichero entero.
   **Excepcion acotada (2026-10-27): mover un rango de lineas entre archivos.** Se permite un
   comando determinista por rango (`ReadAllText`/`Substring`/`WriteAllText`, `-Encoding utf8NoBOM`,
   **sin heredocs**) **solo si**: (a) el contenido se mueve **tal cual**, sin editarlo; (b) se
   compara el **hash** del bloque antes y despues; (c) va en un **commit propio**. Sigue prohibido
   generar contenido nuevo con un script y reescribir un archivo a mano con `Set-Content`.
2. **Cambios grandes**: en pasos de editor, y `php -l` / `node --check` **despues
   de cada paso**, no al final.
3. **`run_commands` es para LEER, buscar y verificar** (`Select-String`, `php -l`,
   `node tests/...`, `git`). Si un comando necesita escribir un fichero del repo,
   es que hay que usar el editor (salvo la excepcion de la regla 1).
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
8. **EOL mixto en el repo (medido 2026-10-27)**: `core.autocrlf=true` y conviven archivos CRLF
   (`AGENTS.md`, `assets/admin.js`) con LF (`readme.txt`, `engine/*.php`). Un ancla **multilinea**
   puede fallar por el fin de linea aunque el texto se vea igual: si un ancla de varias lineas no
   matchea y el texto es correcto, **no es el texto, es el EOL** → partir el cambio en anclas de
   una linea. No cambiar `.gitattributes` a `eol=lf` sin aprobacion: seria un diff masivo de una vez.
9. **Un `text not found` se biseca antes de concluir un limite de la herramienta**: casi siempre
   es **1 caracter** mal copiado (tipico: `\"` del output JSON del read contra `"` del archivo).
   Verificar el byte real con `Select-String -SimpleMatch`; si **cada mitad** del bloque entra sola,
   el problema es de **contenido**, no de tamaño. **Nunca** documentar un limite de la herramienta
   sin bisecar: propaga un dato falso (paso el 2026-10-27: se afirmo "acepta ~5 filas" y el bloque
   que fallaba media 752 caracteres).

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

## 11. Errores comunes (resolver antes de preguntar)

Las **trampas que se repiten al escribir codigo** (leelas antes de tocar nada):

- `$('<tag ...')` **sin el `>` de cierre**: jQuery lo lee como selector. `node --check` no lo
  detecta; lo cubre `tests/mockup-contrato.test.js` (recorre **todos** los literales).
- `is_array($x)` **no** distingue "una spec" de "lista de specs": mirar la clave `tipo`.
- Leer `$_POST` con `wp_unslash()` **antes** de `json_decode` (WordPress agrega magic quotes).
- Un archivo de `FormData` viaja en `$_FILES`, **nunca** en `$_POST`.
- `PMU_Sesion` es lazy: llamar `$this->sesion()` **antes** de usar sus constantes.
- Cada draw del Overlay en su propio `q ... Q` y con `/ECOp1`, o la imagen sale transparente.
- `form.getAttribute('action')`, nunca `form.action`.
- No anidar `<form>` dentro de `ec-form-config` (el HTML descarta el interno).
- El Motor **no** renderiza texto: si un grupo con texto no aparece en el PDF, el navegador no lo
  rasterizo (la vista previa **es** el PDF final).
- Un `foreach` que reusa el nombre de la variable de salida la **pisa** (usar otro nombre).

La **tabla completa** (76 filas: sintoma -> causa -> solucion, con estas trampas y los post-mortems
de bugs ya corregidos) vive en [`docs/errores.md`](./docs/errores.md). Buscala ahi antes de preguntar.
