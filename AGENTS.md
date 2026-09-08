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

## 2. Arquitectura y mapa de archivos (v4.1: proyecto de 3 carpetas)

La RAÍZ DEL PROYECTO (sin git) agrupa tres carpetas hermanas:

```
personalizador-pdf/              <- RAÍZ DEL PROYECTO (sin git)
├── personalizador-pdf/          <- PLUGIN (repo git, el árbol de abajo; en WP vive en
│                                   wp-content/plugins/personalizador-pdf/)
├── textmuy/                     <- MÓDULO TextMuy (git propio): se importa a mano a
│                                   modules/textmuy/ tras cada actualización (LEEME.md)
└── uploads/personalizador-pdf/  <- DATOS DE USUARIO (sin git): espejo de
                                    wp-content/uploads/personalizador-pdf/. Se despliega
                                    COMPLETO al servidor.
```

Árbol del repo del plugin (la carpeta `personalizador-pdf/` de arriba):
```
personalizador-pdf/          (carpeta de instalación en WP: wp-content/plugins/personalizador-pdf/)
├── AGENTS.md                ← ESTE archivo (contexto obligatorio)
├── personalizador-pdf.php   ← Plugin WP (clase principal, menús, handlers, migración)
├── admin/
│   ├── page.php             ← Página admin con pestañas ("PDFs" | "Estilos de Texto" | "Ayuda")
│   ├── pdfs.php             ← Consola: subir PDF, grupos, imágenes, Procesar
│   ├── estilos-texto.php    ← Iframe del módulo TextMuy (aviso si no está importado)
│   └── ayuda.php            ← Documentación interna
├── assets/
│   ├── admin.css            ← Estilos de consola + iframe
│   └── admin.js             ← Interfaz, validaciones y puente RenderCore
├── engine/                  ← MOTOR PHP PURO
│   ├── Pdf.php              ← Parser (lectura de streams y objetos)
│   ├── Detector.php         ← Detección y agrupación de placeholders
│   ├── Metadata.php         ← Dataset JSON
│   ├── PngWriter.php        ← Generador PNG puro
│   ├── Imagen.php           ← Normalización y encajado RGBA
│   ├── Overlay.php          ← Inyector de objetos al PDF (splice)
│   └── Motor.php            ← Orquestador principal
├── modules/
│   ├── LEEME.md             ← Instrucciones de importación manual de módulos
│   └── textmuy/             ← (Importado a mano, NO versionado) Motor frontend TextMuy
├── tests/
│   ├── motor_smoke.php      ← Test crítico del motor (CORRER SIEMPRE TRAS CAMBIOS)
│   ├── parity.php           ← Oráculo de detección (vs expected_muestra.json)
│   ├── texto_puente.php     ← Puente TextMuy con stubs WP (fases separadas)
│   ├── expected_muestra.json
│   └── fixtures/            ← Imágenes de prueba
└── readme.txt               ← Metadatos WP (README del plugin)
```

**Despliegue (v4.1)**: (1) subir la carpeta del plugin a `wp-content/plugins/`;
(2) importar el módulo: copiar `../textmuy` a `modules/textmuy/`; (3) subir
`uploads/personalizador-pdf/` COMPLETA a `wp-content/uploads/` (incluye
`textmuy/{presets,imagenes}` con `catalogo.json`: son los datos del administrador).
La migración automática del plugin (`migrar_textmuy()`) solo mueve a uploads lo que falte
(nunca pisa datos), así que el orden es indiferente.

**Regla de oro: no crear duplicados.** Antes de agregar algo, revisá el árbol y reutilizá
lo existente. Los módulos en `modules/` NO se versionan en este repositorio; se importan
manualmente y funcionan de manera autocontenida.

### 2.1 Contrato RenderCore (comunicación plugin ↔ módulo TextMuy)

El plugin NO conoce los internos de TextMuy. Consume un contrato público:

1. **Editor completo**: `modules/textmuy/index.html` en iframe same-origin. Si no está
   importado, el plugin muestra un aviso pero sigue funcionando en modo clásico.
2. **Motor de render headless**: `modules/textmuy/render-core.html` cargado on-demand en
   iframe off-screen. Expone `window.TextMuyAPI.renderBatch(items, {onProgress})`:
   renderiza lote por lote y rechaza ante el primer fallo (nunca un lote parcial), con
   `ensureFontReady` garantizando la fuente antes de renderizar.
3. **Catálogo y recursos**: presets, miniaturas e imágenes de usuario se leen desde
   `uploads/personalizador-pdf/textmuy/` (ver §5) vía `urls.presetsBase` +
   `PresetManager.presetUrlBase()`. NO hay presets de fábrica.
4. **Puente de recursos**: el plugin pasa al iframe por postMessage
   `{urls, nonces, presets, imagenes}`. El módulo interactúa con los handlers
   `admin_post_personalizador_pdf_textmuy_*` (nonce + capability + saneo; CRUD de
   presets/imágenes). Sin puente (standalone) todo se degrada a client-side.
5. **Versionado de estáticos (cache-bust)**: `render-core.html` e `index.html` referencian
   sus scripts internos con `?v=RCn` (**RC9 hoy**): al cambiar cualquier JS del módulo,
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
     imágenes y textos persistidos (`datos/{pdf}/textos.json`). El Motor orquesta y entrega
     el PDF editado (encajado, sin deformar ni recortar).
2. **Estilos de Texto** (`admin/estilos-texto.php`): laboratorio frontend TextMuy. Guardar
   un estilo crea un `.txm` + miniatura `.webp` en el servidor (uploads).
3. **Manejo de estados**:
   - Sobrescribir un PDF borra sus datos, imágenes y salida previas.
   - Grupos sin imagen asignada mantienen su transparencia original (el resumen avisa).
   - **Re-analizar** regenera el dataset si el PDF cambió manteniendo el nombre.

## 4. Reglas técnicas críticas (¡NO MODIFICAR sin entenderlas!)

1. **Detección de placeholders**:
   - Tipo `re` transformado o 4 líneas rectas cerradas (incluso rectángulos **rotados**:
     lados opuestos paralelos e iguales; la instancia lleva `dev_quad`).
   - `fill_opacity` ≤ 0.001 (transparencia total).
   - Tamaño mínimo: 10×5 pt (anti-artefactos).
2. **Agrupación**: clave = color RGB (3 decimales), orden determinista, letras
   `a, b, c... z, aa, ab...`. Se toma la figura de mayor área como base. Medidas SIEMPRE
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

- Raíz de datos: `uploads/personalizador-pdf/`
- Datasets PDF: `datos/{pdf}/metadata.json` (+ `textos.json` para el puente TextMuy)
- Imágenes aplicadas: `imagenes/{pdf}/{letra}.{ext}`
- Placeholders vacíos: `placeholders/{pdf}/{letra}-{ancho_px}x{alto_px}.png`
- PDF procesado: `salidas/{pdf}_procesado.pdf`
- **Archivos TextMuy (datos de usuario, desde 4.0.0)**:
  - Presets: `textmuy/presets/{nombre}.txm` + miniatura `{nombre}.webp` (200x100).
  - Imágenes/fondos: `textmuy/imagenes/{nombre}.{ext}` (flat) +
    `textmuy/imagenes/catalogo.json` (`{nombre, categoria, titulo}`; categorías:
    fondos, iconos, varios).
- 🔜 **FUTURO — Fuentes como datos de usuario** (no implementado): `textmuy/fonts/
  {nombre}.{ttf,otf,woff,woff2}` + `{nombre}.webp` (preview) + `textmuy/fonts/fonts.json`
  (`{nombre, titulo, url}`); handlers `textmuy_subir_fuente|borrar_fuente` (firma + límite);
  el módulo registra las fuentes desde el puente y reemplaza `localStorage`
  (`textmuy_custom_fonts`) dentro del plugin (standalone mantiene localStorage); preview
  webp generada en el navegador al subir.
- **Migración automática** (`migrar_textmuy()`): al activar o en primer uso, mueve los
  presets e imágenes que vivían DENTRO del módulo hasta 3.3.0
  (`modules/textmuy/{presets,imagenes}`) a uploads, reescribiendo las URLs de imagen
  dentro de los `.txm`. Nunca pisa archivos que ya existan en uploads.
- `muestra.pdf`/`muestra2.pdf` NO se versionan: viven en
  `uploads/personalizador-pdf/pdfs/` (los tests los leen desde ahí).

## 6. Motor PHP (engine/): responsabilidades

- **`Pdf.php`**: parser base (lectura pura de objetos/streams/xref).
- **`Detector.php`**: análisis del PDF, detección y agrupación de cajas transparentes.
- **`Metadata.php`**: controlador del dataset JSON.
- **`PngWriter.php`**: generador de PNG transparente sin dependencias.
- **`Imagen.php`**: normalizador de imágenes a RGBA / encajado (contain).
- **`Overlay.php`**: empaquetado final (modificación e inyección de bytes en el PDF).
- **`Motor.php`**: orquestador principal del flujo (PDF + dataset + imágenes → PDF editado).

## 7. Decisiones de diseño ya tomadas

- ❌ **Sin Python**: backend estrictamente en PHP (la v1 fue Flask + Python; migrada).
- ✅ **Único panel UI para presets**: la galería inferior expandible de TextMuy es el único
  punto para buscar/guardar/borrar presets. No recrear los antiguos menús.
- ✅ **Formato único para presets**: todo preset es `.txm` (delta de settings) + `.webp`.
  Ya no se usa `localStorage` ni `.json` para guardar.
- ✅ **Separación estricta de datos (v4.0.0)**: todo dato o recurso aportado por el
  administrador reside en `uploads/personalizador-pdf/textmuy/`. La carpeta del plugin y la
  del módulo son reemplazables/actualizables sin perder información. Sin contenido de
  fábrica: el admin crea sus presets y sube sus imágenes.
- ✅ **Módulo con repositorio propio (v4.1)**: `modules/textmuy/` no se versiona; el módulo
  vive en `../textmuy` (git propio, con su propio `AGENTS.md`) y se importa a mano tras
  cada actualización.
- ✅ **Hooks legacy**: se mantiene soporte temporal a hooks `extractor_corel_*` por
  retrocompatibilidad (se considera código legacy).

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
php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php
php tests/motor_smoke.php     # Smoke del motor (debe decir "SMOKE OK")
php tests/parity.php          # Oráculo del detector (debe decir "PARIDAD OK")
php tests/texto_puente.php    # Puente TextMuy con stubs WP: setup | guardar_ajax |
                              # guardar_vacio | procesar | rechazo (cada fase = 1 proceso)
```
Los tests leen `muestra.pdf` desde `../uploads/personalizador-pdf/pdfs/` (datos del
usuario, NO versionados). `parity.php` acepta la ruta como argumento opcional.

### Entorno Node (módulo TextMuy) — si se modifica el repo hermano `../textmuy`
```bash
cd ../textmuy
node tests/preset-cache.test.js && node tests/preset-delta.test.js
node tests/preset-load.test.js && node tests/distort-engine.test.js
node tests/flag-wave.test.js && node tests/pattern-block-box.test.js
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
- ❌ NO DEBES: modificar el contenido de `modules/textmuy/` desde este plugin. TextMuy
  tiene su propio repositorio (`../textmuy`): los cambios se hacen en la fuente, se corren
  sus tests Node y se importa a mano (con bump `?v=RCn` en ambos HTML del módulo).
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
| Un preset guardado no aparece en otro navegador | — | Resuelto v3.2.0/v4.0.0: presets `.txm` en `uploads/.../textmuy/presets/` |
| Un preset recién guardado no aparece en el selector de un grupo | Página "PDFs" abierta antes de guardar | Recargar: el listado se genera con glob en cada carga |
| Navegación a `wp-admin/[object HTMLInputElement]` al Procesar | Colisión de atributos del `<form>` | Usar `form.getAttribute('action')`, NUNCA `form.action`, al interceptar |
| Error del puente tras tener el admin mucho tiempo abierto | Nonce expirado (~12-24 h) | Recargar la página y reintentar |
