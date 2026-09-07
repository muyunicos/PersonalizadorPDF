# TextMuy — Documentación de Objetivos y Roadmap

> **Objetivo final:** Una app que funcione como API client-side + editor visual para crear textos estilizados al estilo [TextStudio](https://www.textstudio.com/logo/spotify-logo-867).

---

## Resumen de Progreso

### ✅ Completado (Fases 1-2, 3, 4, 5, 6, 7, 8 parcial, Efectos WebGL, Interfaz, Fase 11-15, Fase 17, Fase 18, Fase 19, Fase 21)
- **Canvas fijo con auto-fit**: El canvas usa dimensiones fijas de `settings.canvas.width/height` y el texto se ajusta automáticamente con `autoFitText()`
- **Inputs de tamaño custom**: Conectados al editor mediante `bindCanvasDimension()` en `controls.js`
- **Exportación PNG transparente**: Simplificado en `export.js` con fondo transparente por defecto
- **Dimensiones custom en exportación**: Implementado usando `settings.canvas.width/height`
- **Propiedades faltantes en defaultSettings**: Añadidas todas las propiedades de compatibilidad con TextStudio (blendmodes, textures, palettes, etc.)
- **loadPreset() mejorado**: Ahora carga todas las propiedades de TextStudio incluyendo blendmodes y propiedades anidadas
- **convertSettingsToPreset() robusto**: Refactorizado con optional chaining (`?.`) y valores por defecto
- **Render de textures**: Implementado con sistema de caché de imágenes y `createPattern()`
- **Render de palettes per-letter**: Implementado con `drawTextWithPalette()` para colorear letras individualmente
- **Blendmodes aplicados**: `globalCompositeOperation` aplicado en fill, outline, depth, icon, background, shadows
- **API client-side**: Implementada en `js/api.js` con `renderTextToPNG()`, `downloadPNG()`, y `loadPresetByName()`
- **Motor WebGL Bevel**: Creado `js/effects/bevel-webgl.js` con shaders GLSL para bevel realista con normal maps
- **Motor WebGL Specular**: Creado `js/effects/specular-webgl.js` con iluminación Blinn-Phong
- **Motor Distort/Arc**: Creado `js/effects/distort-engine.js` con posicionamiento per-character en arcos, ondas y bulge
- **Integración Bevel WebGL**: Integrado en `drawBevel()` con fallback a método Canvas 2D
- **Integración Specular WebGL**: Integrado en `drawSpecular()` con blendmode 'screen'
- **Integración Distort Engine**: Integrado en `applyDistort()` y `drawTextCurved()` con fallback a transformación matrix
- **Archivos organizados**: Estructura reorganizada con directorios `effects/` y `utils/`, archivos de referencia TextStudio preservados
- **PresetManager**: Creado `js/preset-manager.js` con operaciones CRUD completas
- **Lista dinámica de presets**: Implementada carga desde localStorage, presets/ y presets importados
- **CRUD de presets**: Funciones createPreset(), updatePreset(), deletePreset(), duplicatePreset() implementadas
- **UI de gestión de presets**: Botones para Nuevo, Duplicar, Guardar, Eliminar, Exportar, Importar
- **Gradients con N colores**: Mejorada `addGradientStops()` para soportar múltiples formatos y distribución automática de posiciones
- **Importador TextStudio mejorado**: Mapeo de IDs de fuentes, mejor extracción de presets (window.__PRESET__, JSON-LD), integración con PresetManager
- **Gestión de fuentes**: Mejorada con fallback a Google Fonts, registro de fuentes personalizadas, listado disponible, eliminación de fuentes custom
- **Validaciones de seguridad**: Funciones `safeGet()` e `isActive()` para prevenir errores de acceso a propiedades undefined
- **Interfaz estructurada**: Organización completa según estructura TextStudio (TEXT, STYLES con sub-menus, ICON, BACKGROUND, DOWNLOAD)
- **Estructura STYLES implementada**: Sub-menus 3D & FILLING, OUTLINES, SHADOWS con jerarquía completa de opciones
- **Blend Modes expandidos**: Añadidos 10+ blend modes faltantes (color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity)
- **Gradient Picker UI mejorado**: Implementado editor visual con drag handlers para color stops, añadir/eliminar dinámicamente, preview en tiempo real
- **Opciones de Textura expandidas**: Expandidas de 3 a 9 posiciones y tamaños con increments de 10%
- **Library de Presets expandida**: Añadidos 5+ presets base, implementadas categorías, búsqueda y filtros en UI
- **Selección de Fuentes expandida**: Añadidos 40+ Google Fonts, implementadas categorías, búsqueda y upload de fuentes custom
- **Sistema de Zoom refactorizado**: Canvas fijo (nunca crece según texto) + zoom multiplicador 0-300% + auto-fit de fuente + exportación con resolución independiente
- **Canvas fijo + auto-fit**: El canvas usa `canvas.width/height * zoomScale`; si el texto lo sobrepasa, autoFitText() achica la fuente
- **Viewport zoom**: El zoom slider controla `canvas.zoom` (0-300%) como multiplicador simple
- **Texto se ajusta al canvas**: El tamaño de fuente se reduce (autoFitText) para encajar; nunca excede `font.size * zoomScale`
- **Exportación independiente**: La exportación usa zoom 100 (1x) para resolución base consistente
- **Eliminación de state.scale**: Removido `state.scale = 2` del renderizado en pantalla
- **lineHeight default normal**: Cambiado a 1.2 (comportamiento tipográfico estándar)
- **Eliminación de código muerto**: removido el sistema de layout completo que nunca se usaba (`calculateTextLayout`, `applyPaletteToLayout`, `getCharacterColor`, `getCharacterGradient`, `applyBoggleEffect` random, `applyReverseOverlapEffect`, `applyLetteringShadowEffect`, `applyLetteringEffects`, `cloneSettings`, `mergeSettings`, `getLineStyleSlot`, `getEffectiveLineSettings`, `hasLineStyleOverrides`, `state.layout`, las clases `TextLayout`/`CharacterMetrics`, y el sistema `lineStyles`). Ahora el render usa un único motor per-carácter: `drawTextLines → drawTextWithSpacing`.
- **Fase 19 — Rediseño del sistema de Filling + Flag (bandera)**:
  - **Gradientes**: `createGradient()` recalculado con bounds reales del texto (ancho de la línea más ancha letra a letra + altura real ascent/descent); helper `createGradientInBox()` reutilizable. Afecta fill, contornos, depth, depth2 y background.
  - **Nuevo motor de Filling por capas** (`js/editor.js`): `fill.layers[]` — cada capa `{ active, alpha, blendmode, repeat, styles[] }`. Cada estilo puede ser `color`, `gradient` o `texture`. El `repeat` define el alcance: `none` = el estilo abarca todo el bloque de texto (los estilos se apilan en orden); `letter`/`word`/`line` = los estilos ciclan por unidad, pintándose de extremo a extremo de cada letra/palabra/línea. Migración automática de los campos legacy (`fill.color/gradient/texture/palette`) al cargar presets.
  - **UI de capas** (`js/controls.js`): dentro de cada capa, lista de estilos con preview editable (menú flútil con pestañas Color/Gradient/Pattern), botones "+ Add style", selector de repetición, opacidad y blend mode. Capas dinámicas con "+ Add layer" (máx. 4). Sincronización con presets/undo-redo vía evento `textmuy:settings-updated`.
  - **Compensación con Flag**: cuando el efecto bandera está activo, gradientes y patrones se anclan al espacio global (mediante la transformada inversa `T⁻¹·R⁻¹`) para que no roten con cada letra — así "no repeat" queda realmente global.
  - **Boggle → "Flag (bandera)"**: renombrado. Nuevos controles según especificación: **Angle** (-360° a +360°, rotación de cada letra) y **Amplitude** (-100% a +100%, altura como % del tamaño de fuente). Patrón alternado invertido: letra par rota +angle y sube, letra impar rota -angle y baja (zigzag de bandera). Determinista (sin random).
  - **Compatibilidad**: heurística en loadPreset para presets legacy que guardan amplitude como ratio 0-1 (se convierte a %). Los presets propios ahora guardan/cargan `fill.layers` intactos.
- **Fase 18 — Correcciones de bugs reportados por el usuario**:
  - **Gradientes**: `createGradient()` recalculado — el gradiente ahora se centra en el texto (que se dibuja centrado en el origen) y cubre todo el bounding box; usa `lineHeight` real en vez de 1.3 fijo. Afecta a fill, outline, depth, depth2 y background.
  - **Contornos**: Nuevo select "Position" (Outside / Centered / Inside) para Outline #1 y Outline #2. El trazo con alineación usa máscara de glifos (canvas offscreen + `destination-in`/`destination-out`) vía `drawTextStrokeAligned()`. Por defecto **Outside** (comportamiento TextStudio), lo que corrige que antes solo se veía la mitad exterior del contorno.
  - **Estilos por línea (paleta)**: `drawTextWithPalette()` leía el método desde un path inexistente (`fill.palette.method`); corregido a `fill.palette.lettering.method`. Implementado el método **1 style / line** (`lineIndex % styles.length`) y corregida la lógica de 1 style / word (antes reiniciaba el índice en cada espacio, pintando todo igual).
  - **Editor de paleta de estilos**: El bloque `.tt-palette` del HTML era UI muerta (sin lógica JS). Reemplazado por un editor funcional: lista de colores con "+ Add style" que puebla `fill.palette.styles`, con edición y borrado por color. Se sincroniza al cargar presets/undo-redo vía evento `textmuy:settings-updated`.
  - **Tamaño de descarga**: Los inputs del panel DOWNLOAD (240×600 por defecto) no estaban sincronizados con el tamaño del canvas. Ahora `settings.canvas.width/height` es la única fuente de verdad: los inputs de descarga se sincronizan (init + evento `settings-updated`) y editarlos redimensiona el canvas; el multiplicador Scale se aplica sobre ese tamaño base.
  - **Drag fantasma / cursor de bloqueo**: Al arrastrar sliders y controles el navegador iniciaba un drag nativo del HTML. Añadido `preventDefault` de `dragstart` dentro de `#tt` y CSS `user-select: none` en controles (con excepciones para textarea/inputs de texto) e `-webkit-user-drag: none` en imágenes/iconos.
  - **Limpieza**: Eliminado archivo residual `ROADMAP.md.tmp` (contenido "test").

### ⏳ Pendiente (Fase 16)
- **UI Polish**: Indicadores undo/redo, feedback visual, tooltips, transiciones y animaciones

### 📊 Estadísticas
- **Problemas críticos resueltos**: 7/7 (B1, B2, D1, D2, D3, D4, C1-C3)
- **Problemas de compatibilidad resueltos**: 10/10 (C1, C2, C3, C4, C5, C6, C7, C8, C9, C10)
- **Fase 18 (bugs de usuario)**: 8/8 tareas completadas (gradientes, contornos, estilos por línea, editor de paleta, tamaño de descarga, anti-drag, fix máscara de contorno, fix flujo de gradient colors)
- **Fase 19 (Filling + Flag)**: 5/5 tareas completadas (gradiente bounds reales, motor de capas, UI de capas, compensación Flag, Boggle→Flag)
- **Fase 21 (Flag v2)**: 8/8 tareas completadas (modelo de onda Tilt/Rise/Wave width/Wave shift/Shape con claves alineadas a la UI, selector Tilt mode Follow wave/By position, defaults neutros, migraciones legacy, tests propios)
- **Tareas completadas**: 22/25 (88%) + 8/8 de Fase 18 + 5/5 de Fase 19 + 5/5 de Fase 19.1 + 7/7 de Fase 19.2 + 21/24 de Fase 20 + 8/8 de Fase 21
- **Fases completadas**: Fase 1 parcial, Fase 2, Fase 4, Fase 8 parcial, Fase 11, Fase 12, Fase 13, Fase 14, Fase 15, Fase 17, Fase 18, Fase 19, Fase 19.1, Fase 19.2, Fase 20, Fase 21

---

## 1. Objetivo del proyecto

### Visión general
TextMuy será una aplicación web con dos modos de uso:

1. **Editor visual** — Interfaz tipo TextStudio para crear/editar estilos de texto, importar presets, y gestionar una biblioteca de presets guardados.

2. **API client-side** — Una función JS invocable desde la misma página (o desde otra app web en el mismo servidor) que recibe:
   - `texto` (string, puede ser multilínea)
   - `presetName` (nombre del preset a aplicar)
   - `overrides` (opcional: parámetros que sobreescriben configuraciones del preset, ej: color, tamaño de canvas)
   
   Y devuelve: **imagen PNG con fondo transparente** del tamaño especificado.

### ✅ Lo que SÍ queremos
- Editor visual con la mayoría de funciones de TextStudio (excepto ANIMATION).
- Importador de presets desde URL de TextStudio (`textstudio.com/logo/spotify-logo-867`).
- Selector de presets guardados + CRUD (crear, editar, guardar cambios, eliminar).
- Gestión de fuentes: listado, subir nuevas, fallback al cargar preset con fuente faltante.
- API client-side: función `renderTextToPNG(text, presetName, overrides)`.
- Canvas de tamaño definido por el usuario (px) con auto-ajuste del texto.
- Exportación PNG transparente del tamaño exacto.
- **LA APP ESTÁ COMPLETAMENTE LIBRE (LAS FUNCIONES PREMIUM SON FUNCIONES NORMALES, NO HABRÁ CONCEPTO PREMIUM)**

### ❌ Lo que NO queremos
- Headers, footers, navegación del sitio, marketing.
- Sección de ANIMATION.
- Exportación en formatos distintos a PNG transparente (JPG, PDF).
- Opciones de calidad tiers (LITE/PRO/ULTRA).
- Restricciones premium.

---

## 2. Arquitectura técnica

### 2.1 API client-side (función, no servidor)

```
// Uso desde cualquier JS en la misma página o app web del mismo servidor
const pngBlob = await TextMuyAPI.renderTextToPNG({
    text: "Jonatan\nRuben",
    preset: "spotify-logo-867",
    overrides: {
        canvas: { width: 1920, height: 1080 },
        fill: { color: "#ff0000" }
    }
});
// → descarga o usa el blob PNG
```

**Implementación:**
- Refactorizar el motor de render (`js/editor.js`) para separar lógica pura del DOM.
- Crear `js/api.js` con función `renderTextToPNG()` que:
  1. Carga el preset por nombre (desde `presets/` o localStorage).
  2. Aplica overrides (merge profundo).
  3. Crea canvas temporal con dimensiones especificadas.
  4. Auto-fit del texto al canvas.
  5. Renderiza todos los efectos.
  6. Devuelve PNG blob (transparente).

### 2.2 Separación de lógica de render

Actualmente `js/editor.js` está acoplado al DOM. Necesitamos:

```
// js/render-engine.js (nuevo, lógica pura)
function renderToCanvas(ctx, settings, canvasWidth, canvasHeight) {
    // Auto-fit + todos los efectos
    // No toca document.*, no usa getElementById
}

// js/editor.js (UI, usa render-engine)
function render() {
    const ctx = state.ctx;
    renderToCanvas(ctx, state.settings, canvasWidth, canvasHeight);
    // + actualiza UI
}

// js/api.js (API, usa render-engine)
function renderTextToPNG(params) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const settings = loadPreset(params.preset);
    mergeOverrides(settings, params.overrides);
    renderToCanvas(ctx, settings, params.width, params.height);
    return canvas.toBlob('image/png');
}
```

### 2.3 Gestión de presets

- **Almacenamiento:** archivos JSON en `presets/` (presets base) + localStorage (presets guardados por el usuario).
- **Lista dinámica:** la UI carga presets desde ambas fuentes y los muestra en una lista seleccionable.
- **CRUD completo:**
  - Crear nuevo preset (desde cero o duplicando uno existente).
  - Editar preset (cargar en editor, modificar, guardar).
  - Guardar cambios en preset existente.
  - Eliminar preset.
  - Exportar preset como JSON (descarga).

### 2.4 Gestión de fuentes

- **Listado visual:** muestra fuentes disponibles (locales + Google Fonts + subidas).
- **Subir fuentes:** input file que carga TTF/OTF vía FontFace API y los guarda en IndexedDB (persistencia).
- **Fallback al cargar preset:** si un preset referencia una fuente que no existe:
  1. Mostrar aviso "Fuente X no encontrada".
  2. Selector para elegir una fuente existente como reemplazo.
  3. Opción de subir una nueva fuente.
  4. Guardar la asociación (preset → fuente reemplazo) para futuras cargas.

### 2.5 Imágenes en presets (fondos, texturas, logos)

- **Por ahora:** si el preset trae una imagen que no se puede cargar → placeholder visual (cuadro gris con texto "imagen no disponible").
- **Más adelante:** captura y descarga automática bajo demanda de imágenes referenciadas en presets de TextStudio.

---

## 3. Problemas actuales identificados

### A. Problemas relativos a la API

| # | Problema | Archivo/Líneas | Severidad |
|---|---|---|---|
| A1 | No existe función API `renderTextToPNG()` | — | 🔴 Crítico |
| A2 | Motor de render acoplado al DOM, no reutilizable | `js/editor.js` completo | 🔴 Crítico |
| A3 | No hay sistema de overrides/merge de settings | — | 🟡 Alto |
| A4 | No hay carga de preset por nombre desde función | — | 🟡 Alto |

### B. Problemas del editor visual vs. TextStudio

| # | Problema | Archivo/Líneas | Severidad | Estado |
|---|---|---|---|---|
| B1 | Canvas se calcula dinámicamente según el texto (debe ser al revés: texto se ajusta al canvas) | `js/editor.js` 200-209 | 🔴 Crítico | ✅ Resuelto |
| B2 | Inputs de tamaño custom no conectados al editor | `index.html` 693-697, `js/controls.js` | 🔴 Crítico | ✅ Resuelto |
| B3 | Importador frágil: depende de 3 proxies CORS externos + regex sobre HTML | `js/controls.js` 958-1213 | 🟡 Alto | ⏳ Pendiente |
| B4 | `extractPresetFromHTML()` probablemente no funciona (TextStudio no expone JSON literal) | `js/controls.js` 1082-1121 | 🟡 Alto | ⏳ Pendiente |
| B5 | Lista de presets es estática en HTML (solo 3 hardcoded) | `index.html` 733-737 | 🟡 Alto | ⏳ Pendiente |
| B6 | No hay CRUD de presets: no se pueden editar/eliminar/guardar cambios | `js/controls.js` 514-538 | 🟡 Alto | ⏳ Pendiente |
| B7 | Caché de presets en localStorage no se muestra en la UI | `js/controls.js` 1128-1139 | 🟡 Alto | ⏳ Pendiente |
| B8 | No hay gestión de fuentes (listado, subir, fallback) | — | 🟡 Alto | ⏳ Pendiente |
| B9 | No hay gestión de imágenes (placeholders para imágenes faltantes) | — | 🟡 Medio | ⏳ Pendiente |

### C. Problemas de compatibilidad con presets de TextStudio

| # | Problema | Archivo/Líneas | Severidad | Estado |
|---|---|---|---|---|
| C1 | `loadPreset()` ignora propiedades: `outline.global`, `outline.dash`, `shadow.erosion/mask/strength`, `bevel.soften`, `background.gradient` completo, `processing.code`, `mergeGradients` | `js/editor.js` 844-1122 | 🟡 Alto | ✅ Resuelto |
| C2 | `convertSettingsToPreset()` referencia 11+ propiedades inexistentes en `defaultSettings` | `js/controls.js` 540-809 | 🟡 Alto | ✅ Resuelto |
| C3 | `defaultSettings` no define: `animation`, `processing` (completo), `lettering.shadow`, `lettering.blendmode`, `bevel.soften`, `icon.alpha/rotate/composite`, `background.composite/gradient`, `shadowOuter.strength` | `js/editor.js` 7-147 | 🟡 Alto | ✅ Resuelto |
| C4 | Gradients solo soportan 2 colores (TextStudio soporta N colores con posición) | `js/editor.js` 789-808 | 🟡 Medio | ✅ Resuelto |
| C5 | Textures existen en settings pero no se renderizan | `js/editor.js` | 🟡 Medio | ✅ Resuelto |
| C6 | Palettes per-letter existen en settings pero no se renderizan | `js/editor.js` | 🟡 Medio | ✅ Resuelto |
| C7 | Blendmodes definidos en presets pero nunca se aplican (`globalCompositeOperation`) | `js/editor.js` | 🟡 Medio | ✅ Resuelto |
| C8 | Bevel simplificado (offset strokes) vs. bevel real de TextStudio | `js/editor.js` 662-698 | 🟢 Bajo | ⏳ Pendiente |
| C9 | Distort/Arc es transformación matrix simple, no arc real per-character | `js/editor.js` 701-714 | 🟢 Bajo | ⏳ Pendiente |
| C10 | Fuentes referenciadas por ID numérico (`832.ttf`) no se resuelven | `presets/*.json` | 🟡 Alto | ⏳ Pendiente |
| C11 | Blend modes limitados (3-6 vs 16+ en TextStudio) | `index.html` | 🟡 Medio | ⏳ Pendiente |
| C12 | Gradient picker UI básico vs editor visual avanzado | `js/controls.js` | 🟢 Bajo | ⏳ Pendiente |
| C13 | Opciones de textura limitadas (posiciones, tamaños) | `index.html` | 🟢 Bajo | ⏳ Pendiente |
| C14 | Library de presets limitada (3 vs extensa en TextStudio) | `presets/` | 🟢 Bajo | ⏳ Pendiente |
| C15 | Selección de fuentes limitada (19 vs más en TextStudio) | `js/fonts.js` | 🟢 Bajo | ⏳ Pendiente |

### D. Problemas de exportación

| # | Problema | Archivo/Líneas | Severidad | Estado |
|---|---|---|---|---|
| D1 | Inconsistencia: UI envía `png-transparent` pero export.js busca `transparent-png` | `index.html` 716, `js/export.js` 38 | 🔴 Crítico | ✅ Resuelto |
| D2 | `createExportCanvas()` siempre pinta fondo negro si no hay background activo | `js/export.js` 97-105 | 🔴 Crítico | ✅ Resuelto |
| D3 | No usa dimensiones custom (`tt-custom-width/height-input`) | `js/export.js` 62-117 | 🔴 Crítico | ✅ Resuelto |
| D4 | Lógica de ratio y spacing innecesaria para el caso de uso | `js/export.js` 71-88 | 🟢 Bajo | ✅ Resuelto |

---

## 4. Soluciones propuestas

### 4.1 Refactor del motor de render (soluciona A1, A2)

**Crear `js/render-engine.js`:**
- Extraer toda la lógica de renderizado de `js/editor.js` a funciones puras.
- Función principal: `renderToCanvas(ctx, settings, canvasWidth, canvasHeight)`.
- No depende de `document`, `state`, ni elementos del DOM.
- Recibe `ctx` (contexto de canvas), `settings` (objeto), y dimensiones.
- `js/editor.js` y `js/api.js` consumen este módulo.

### 4.2 Sistema de canvas fijo + auto-fit (soluciona B1, B2)

**Cambios en `defaultSettings`:**
```js
canvas: {
    width: 1920,
    height: 1080,
    autoFit: true,
    padding: 0.05  // 5% del ancho
}
```

**Algoritmo de auto-fit (búsqueda binaria):**
```
function autoFitText(ctx, text, canvasWidth, canvasHeight, settings):
    maxFont = 400
    minFont = 8
    padding = canvasWidth * settings.canvas.padding
    availW = canvasWidth - padding * 2
    availH = canvasHeight - padding * 2
    
    lo = minFont, hi = maxFont, best = minFont
    while lo <= hi:
        mid = (lo + hi) / 2
        ctx.font = `${mid}px ${fontName}`
        textW = measureTextWithSpacing(text, mid, settings.letterSpacing)
        textH = mid * settings.lineHeight * lines.length
        extraW = calcExtraWidth(settings, mid)  // outline, depth, shadow
        extraH = calcExtraHeight(settings, mid)
        if textW + extraW <= availW AND textH + extraH <= availH:
            best = mid; lo = mid + 1
        else: hi = mid - 1
    return best
```

### 4.3 API client-side (soluciona A1, A3, A4)

**Crear `js/api.js`:**
```js
window.TextMuyAPI = {
    async renderTextToPNG({ text, preset, overrides }) {
        const settings = await loadPresetByName(preset);
        if (overrides) mergeDeep(settings, overrides);
        const canvas = document.createElement('canvas');
        canvas.width = settings.canvas.width;
        canvas.height = settings.canvas.height;
        const ctx = canvas.getContext('2d');
        renderToCanvas(ctx, settings, canvas.width, canvas.height);
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
};
```

### 4.4 Importador robusto (soluciona B3, B4)

- Mantener método de proxies CORS como fallback.
- Añadir método: extraer preset de la página de TextStudio buscando en `window.__PRESET__` o variables globales (scraping más específico).
- Si falla → modal con instrucciones para pegar JSON manual (ya existe).
- Mapear fuentes por ID a nombres reales (tabla de equivalencias).

### 4.5 CRUD de presets (soluciona B5, B6, B7)

- Lista dinámica que carga desde `presets/` (fetch) + localStorage.
- Funciones: `createPreset()`, `updatePreset(name, settings)`, `deletePreset(name)`, `duplicatePreset(name)`.
- UI con botones: Nuevo, Duplicar, Guardar, Eliminar junto a cada preset.

### 4.6 Gestión de fuentes (soluciona B8)

- Listado visual de fuentes disponibles.
- Input file para subir TTF/OTF → FontFace API → IndexedDB.
- Al cargar preset: si fuente no existe → modal de fallback (seleccionar existente o subir nueva).

### 4.7 Exportación PNG transparente (soluciona D1, D2, D3)

- Simplificar `js/export.js`: solo PNG transparente.
- `downloadTransparentPNG(width, height)`: canvas temporal, sin fondo, auto-fit, render, toBlob.
- Conectar con inputs de width/height.

### 4.8 Compatibilidad con presets (soluciona C1, C2, C3)

- Añadir todas las propiedades faltantes a `defaultSettings`.
- Completar `loadPreset()` para cargar todas las propiedades de presets de TextStudio.
- Hacer `convertSettingsToPreset()` robusto con optional chaining.

---

## 5. Checklist de tareas (priorizado)

### Fase 1: Fundaciones (refactor + bugs críticos)
- [ ] **T1.1** Crear `js/render-engine.js`: extraer lógica de render de `js/editor.js` a funciones puras.
- [x] **T1.2** Añadir propiedades faltantes a `defaultSettings` en `js/editor.js`: `canvas`, `animation`, `processing` (completo), `lettering.shadow/blendmode`, `bevel.soften`, `icon.alpha/rotate/composite`, `background.composite/gradient`, `shadowOuter.strength`, `outline.global/dash`, `depth.texture.blendmode`, `fill.texture.blendmode/palette`.
- [x] **T1.3** Hacer `convertSettingsToPreset()` robusto ante propiedades undefined (optional chaining).
- [x] **T1.4** Completar `loadPreset()` para cargar: `outline.global`, `outline.dash`, `shadow.erosion/mask/strength`, `bevel.soften`, `background.gradient`, `processing.code`, `mergeGradients`, blendmodes.

### Fase 2: Canvas fijo + auto-fit
- [x] **T2.1** Implementar `autoFitText()` en `js/editor.js` (ya implementado).
- [x] **T2.2** Modificar `render()` para usar dimensiones fijas del canvas + auto-fit (ya implementado).
- [x] **T2.3** Conectar inputs `tt-custom-width/height-input` al editor (bindings en `js/controls.js`).
- [x] **T2.4** Escalar visualmente el canvas de preview si excede el viewport (ya implementado).

### Fase 3: API client-side
- [ ] **T3.1** Crear `js/api.js` con función `renderTextToPNG({ text, preset, overrides })`.
- [ ] **T3.2** Implementar `loadPresetByName(name)` que busca en `presets/` y localStorage.
- [ ] **T3.3** Implementar `mergeDeep(target, source)` para overrides.
- [ ] **T3.4** Exponer `window.TextMuyAPI` para uso desde otras apps.

### Fase 4: Exportación PNG transparente
- [x] **T4.1** Simplificar `js/export.js`: eliminar JPG, PDF, .textstudio (ya simplificado).
- [x] **T4.2** Implementar `downloadTransparentPNG(width, height)` sin fondo (ya implementado).
- [x] **T4.3** Conectar botón Download con inputs de width/height (ya conectado).
- [x] **T4.4** Eliminar lógica de ratio y spacing innecesaria (ya eliminado).

### Fase 5: Gestión de presets (CRUD)
- [ ] **T5.1** Cargar lista de presets dinámicamente (fetch `presets/` + localStorage).
- [ ] **T5.2** Implementar `createPreset()`, `updatePreset()`, `deletePreset()`, `duplicatePreset()`.
- [ ] **T5.3** UI: botones Nuevo/Duplicar/Guardar/Eliminar junto a cada preset.
- [ ] **T5.4** Persistencia en localStorage de presets creados/editados.

### Fase 6: Importador de presets
- [ ] **T6.1** Mejorar `extractPresetFromHTML()` con selectores más específicos.
- [ ] **T6.2** Mapear fuentes por ID de TextStudio a nombres reales.
- [ ] **T6.3** Manejar imágenes faltantes con placeholders.
- [ ] **T6.4** Guardar presets importados en la lista de presets.

### Fase 7: Gestión de fuentes
- [ ] **T7.1** Listado visual de fuentes disponibles.
- [ ] **T7.2** Input file para subir TTF/OTF → FontFace API → IndexedDB.
- [ ] **T7.3** Modal de fallback al cargar preset con fuente faltante.
- [ ] **T7.4** Guardar asociaciones preset → fuente reemplazo.

### Fase 8: Mejoras de render (compatibilidad TextStudio)
- [x] **T8.1** Soportar gradients con N colores y posiciones.
- [x] **T8.2** Implementar render de textures (ya implementado con `loadTextureImage` y `createPattern`).
- [x] **T8.3** Implementar render de palettes per-letter (ya implementado con `drawTextWithPalette`).
- [x] **T8.4** Aplicar blendmodes (`globalCompositeOperation`) (ya implementado en fill, outline, depth, icon, background, shadows).
- [ ] **T8.5** Mejorar bevel (highlight/shadow suavizado).
- [ ] **T8.6** Mejorar distort/arc (per-character).

### Fase 9: Completar estructura de interfaz TextStudio
- [ ] **T9.1** Reorganizar sección TEXT con todos los parámetros: text, align, font.weight, font.src, font.size, letterSpacing, lineHeight, distort.arc.angle, rotate, mergeGradients.
- [ ] **T9.2** Implementar sub-menú 3D & FILLING completo:
  - Filling: fill.active, fill.color, fill.alpha, fill.gradient.*, fill.texture.*
  - Lettering: fill.palette.active, fill.palette.lettering.method
  - 3D projection #1: depth.* (todos los parámetros)
  - 3D projection #2: depth2.* (todos los parámetros con tt-show-brother)
- [ ] **T9.3** Implementar sub-menú OUTLINES completo:
  - Outline #1: outline.first.* (todos los parámetros incluyendo especular)
  - Outline #2: outline.second.* (todos los parámetros incluyendo especular)
  - Contour 3D #1: outline.global.* (todos los parámetros)
  - Contour 3D #2: outline.global2.* (todos los parámetros con tt-show-brother)
- [ ] **T9.4** Implementar sub-menú SHADOWS completo:
  - Inner bevel #1: bevel.inner.* (todos los parámetros highlight/shadow)
  - Inner bevel #2: bevel.inner2.* (tt-show-brother)
  - Inner shadow #1: shadow.inner.* (todos los parámetros)
  - Inner shadow #2: shadow.inner2.* (tt-show-brother)
  - Outer shadow #1: shadow.outer.* (todos los parámetros)
  - Outer shadow #2: shadow.outer2.* (tt-show-brother)
  - Specular inner: specular.inner.* (todos los parámetros)
  - Lettering options: lettering.* (todos los parámetros)
- [ ] **T9.5** Implementar funcionalidad tt-show-brother para duplicar efectos (depth2, outline.global2, shadow.inner2, shadow.outer2, bevel.inner2).
- [ ] **T9.6** Completar sección ICON con todos los controles: icon.active, icon.src, icon.size, icon.position, icon.offset.x/y, icon.rotate, icon.alpha, icon.composite.
- [ ] **T9.7** Completar sección BACKGROUND con todos los controles: background.active, background.composite, background.fill.color, background.fill.alpha, background.fill.gradient.*, background.fill.image.*.
- [ ] **T9.8** Simplificar sección DOWNLOAD solo para PNG transparente.
- [ ] **T9.9** Eliminar estilos CSS no usados (header, footer, search, formatos no deseados).

### Fase 10: Mejoras opcionales (futuro)
- [ ] **T10.1** Descarga automática de fuentes de TextStudio.
- [ ] **T10.2** Captura y descarga automática de imágenes de presets.

### Fase 11: Expandir Blend Modes
- [x] **T11.1** Añadir blend modes faltantes a selects: color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity
- [x] **T11.2** Actualizar todos los selects de blendmode en index.html (fill, outline, depth, shadows, icon, background)
- [x] **T11.3** Verificar que globalCompositeOperation soporte todos los nuevos modos

### Fase 12: Mejorar Gradient Picker UI
- [x] **T12.1** Implementar gradient picker visual con drag handlers para color stops
- [x] **T12.2** Permitir añadir/eliminar color stops dinámicamente
- [x] **T12.3** Mostrar preview de gradiente en tiempo real
- [x] **T12.4** Integrar con sistema de gradientes existente

### Fase 13: Expandir Opciones de Textura
- [x] **T13.1** Expandir opciones de posición de textura de 3 a 9 (left top, top center, right top, left center, center, right center, left bottom, bottom center, right bottom)
- [x] **T13.2** Expandir opciones de tamaño de textura con increments de 10% (10%, 20%, 30%, ..., 100%, 150%, 200%)
- [x] **T13.3** Actualizar selects de texture.position y texture.size en index.html
- [x] **T13.4** Actualizar lógica de render de texturas para soportar nuevas opciones

### Fase 14: Expandir Library de Presets
- [x] **T14.1** Añadir más presets base a directorio presets/ (5 nuevos presets variados)
- [x] **T14.2** Implementar categorías de presets (basic, neon, metallic, retro, modern, etc.)
- [x] **T14.3** Añadir búsqueda de presets por nombre/categoría
- [x] **T14.4** Mejorar UI de lista de presets con filtros

### Fase 15: Expandir Selección de Fuentes
- [x] **T15.1** Añadir más fuentes Google Fonts (40+ fuentes totales)
- [x] **T15.2** Categorizar fuentes por estilo (serif, sans-serif, display, handwriting)
- [x] **T15.3** Mejorar UI de selector de fuentes con preview y búsqueda
- [x] **T15.4** Añadir opción de subir fuentes custom (TTF/OTF)

### Fase 16: UI Polish
- [ ] **T16.1** Añadir indicadores visuales undo/redo en UI
- [ ] **T16.2** Mejorar feedback visual en interacciones (hover states, transitions)
- [ ] **T16.3** Verificar que todos los efectos tt-show-brother funcionen correctamente
- [ ] **T16.4** Añadir tooltips descriptivos en controles complejos

### Fase 17: Sistema de Zoom Canvas-Fijo (0-300%)
- [x] **T17.1** Investigar comportamiento de zoom en TextStudio (observación directa)
- [x] **T17.2** Modelo canvas-fijo: el canvas NUNCA crece según texto; autoFitText() achica la fuente
- [x] **T17.3** Zoom como multiplicador simple 0-300% (0% = 0x, 100% = tamaño base, 300% = 3x)
- [x] **T17.4** Eliminar state.scale del renderizado en pantalla
- [x] **T17.5** El zoom escala proporcionalmente el canvas y su contenido
- [x] **T17.6** El texto se ajusta (achica fuente) si sobrepasa el canvas fijo; nunca excede font.size * zoomScale
- [x] **T17.7** Exportación con resolución independiente (usa zoom 100 / 1x)
- [x] **T17.8** Control de zoom en HTML: min=0, max=300, value=100, bubble "V+'%'"
- [x] **T17.9** lineHeight default = 1.2 ("normal" tipográfico)
- [x] **T17.10** Centrado vertical usando bounding box real (ascent/descent) en drawTextLines

### Fase 18: Correcciones de bugs reportados por el usuario
- [x] **T18.1** Corregir `createGradient()`: gradiente centrado en el texto, cubriendo el bounding box completo según el ángulo; usar `lineHeight` real (afecta fill, outline, depth, depth2, background).
- [x] **T18.2** Añadir alineación de contorno (Outside / Centered / Inside) para `outline.first` y `outline.second`: select en `index.html`, `position` en `defaultSettings`, binding en `controls.js`, sincronización en `updateUIFromSettings()` y render con máscara de glifos en `drawTextStrokeAligned()`.
- [x] **T18.3** Corregir path del método de lettering en `drawTextWithPalette()` (`fill.palette.lettering.method`) e implementar método "1 style / line"; corregir lógica "1 style / word".
- [x] **T18.4** Editor de estilos de paleta: reemplazar UI muerta `.tt-palette` por lista funcional de colores ("+ Add style", editar, eliminar) que puebla `fill.palette.styles`; sincronizada con presets/undo-redo vía evento `textmuy:settings-updated`.
- [x] **T18.5** Sincronizar tamaño de descarga con `settings.canvas` (fuente única de verdad): inputs del panel DOWNLOAD bidireccionales + Scale como multiplicador; Ctrl+Enter usa el mismo tamaño.
- [x] **T18.6** Anti-drag: `preventDefault` en `dragstart` dentro de `#tt`, `user-select: none` en controles y `-webkit-user-drag: none` en imágenes/iconos. Eliminar `ROADMAP.md.tmp` residual.
- [x] **T18.7** Fix de la máscara de alineación de contorno (verificación de usuario): `drawTextStrokeAligned()` dibujaba la máscara sin resetear el transform, quedaba desplazada medio lienzo → "inside" borraba todo (invisible) y "outside" no borraba nada (stroke doble centrado). Fix: `setTransform` a identidad antes de `drawImage(mask)`.
- [x] **T18.8** Fix del flujo de gradient colors (verificación de usuario): los gradient pickers escriben strings `"#rrggbbaa pos%, ..."` en inputs ocultos pero nada los escuchaba → `fill.gradient.colors` quedaba vacío y el render caía al gradiente blanco/negro por defecto. Añadido `bindGradientColorInputs()` (binding genérico de los 8 inputs ocultos con `parseGradientColorsString()`), seed del default rojo/verde al iniciar, y sincronización inversa en `updateUIFromSettings()` (`formatGradientColorsString()`) con rebuild de pickers vía `GradientPicker.init()` al cargar presets/undo-redo.

### Fase 19: Rediseño del sistema de Filling + Flag (bandera)
- [x] **T19.1** Gradiente con bounds reales: `createGradient()` refactorizado para recibir el bounding box destino `(x, y, w, h)` calculado con el ancho de la línea más ancha (letra a letra) y altura real (ascent/descent). Helper `createGradientInBox()` reutilizable. Afecta fill, contornos, depth, depth2 y background.
- [x] **T19.2** Motor de Filling por capas (`js/editor.js`): `fill.layers[]` donde cada capa es `{ active, alpha, blendmode, repeat, styles[] }`. Cada estilo puede ser `color`, `gradient` o `texture`. El `repeat` define el alcance del estilo: `none` = abarca todo el bloque de texto (los estilos se apilan en orden); `letter`/`word`/`line` = los estilos ciclan por unidad pintándose de extremo a extremo de cada letra/palabra/línea. Migración automática de los campos legacy (`fill.color/gradient/texture/palette`) al cargar presets vía `migrateLegacyFillLayers()`.
- [x] **T19.3** UI de capas (`js/controls.js`): dentro de cada capa, lista de estilos con preview editable (menú flotante con pestañas Color/Gradient/Pattern), botones "+ Add style", selector de repetición, opacidad y blend mode. Capas dinámicas con "+ Add layer" (máx. 4). Sincronización con presets/undo-redo vía evento `textmuy:settings-updated`. Eliminado el código del antiguo editor de paleta y los bindings obsoletos de fill.
- [x] **T19.4** Compensación con Flag: cuando el efecto bandera está activo, gradientes y patrones se anclan al espacio global aplicando la transformada inversa `R(-θ)·T(-cx,-cy)` a sus endpoints/matriz, para que no roten con cada letra — así "no repeat" queda realmente global.
- [x] **T19.5** Boggle → "Flag (bandera)": renombrado en UI. Nuevos controles según especificación: **Angle** (-360° a +360°, rotación de cada letra) y **Amplitude** (-100% a +100%, altura como % del tamaño de fuente). Patrón alternado invertido: letra par rota `+angle` y sube, letra impar rota `-angle` y baja (zigzag de bandera). Determinista (sin random). Heurística en loadPreset para presets legacy que guardan amplitude como ratio 0-1 (se convierte a %).

### Fase 19.1: Correcciones del editor flotante + Pattern mejorado
- [x] **T19.1.1** Fix posición del editor flotante: al cambiar de tab (Color/Gradient/Pattern) se llamaba `setFillLayers()` + `openFillStyleEditor()` con el anchor original, pero `setFillLayers` reconstruye el DOM de capas → el anchor quedaba desvinculado → `getBoundingClientRect()` devolvía ceros → el panel saltaba a la esquina (8, ~0). Fix: el panel ahora se actualiza **in-place** con `refreshEditorBody()` (reconstruye solo el body y la selección de tabs) sin re-abrir ni re-posicionar.
- [x] **T19.1.2** Pattern: nuevo selector de origen 3×3 (9 cuadraditos estilo diseño gráfico: left top … right bottom) que determina desde dónde se ancla/repite el patrón dentro del scope.
- [x] **T19.1.3** Pattern: nuevo selector **Fit** con 3 modos: `stretch` (deforma al tamaño del scope), `fit` (proporcional, contiene — como CSS contain), `fill` (proporcional, cubre — como CSS cover).
- [x] **T19.1.4** Pattern: nuevo slider **Scale** 10%-100%. A 100% + stretch la imagen se estira exactamente al ancho/alto del scope (letra/palabra/línea/todo según el repeat de la capa); a menos del 100% mantiene proporción y se repite desde el origen seleccionado.
- [x] **T19.1.5** Render: nuevo helper `computePatternPlacement()` que calcula el placement (escala sx/sy + origen tx/ty) según fit/scale/position; integrado en `createPatternForBox()` y `patternForBoxAtChar()` (con compensación Flag). `normalizeFillStyle()` preserva los nuevos campos.

### Fase 19.2: Flag (bandera) restaurado + Boggle (desordenadas) + rotación desde centro
- [x] **T19.2.1** Restaurar el efecto **Flag (bandera)** original: se renombró el campo `lettering.boggle` (que en realidad hacía de bandera) a `lettering.flag` y se restauró su comportamiento original de onda senoidal (`Math.sin`), que es el efecto de bandera/banner que el usuario recordaba.
- [x] **T19.2.2** Nuevo efecto **Boggle (desordenadas)**: campo `lettering.boggle` independiente con letras dispersadas aleatoriamente. Rotación y offsets verticales pseudo-aleatorios deterministas (hash por índice de carácter) para que el layout no "baila" entre renders.
- [x] **T19.2.3** Funciones de transform: `getFlagTransform` (bandera), `getBoggleTransform` (aleatorio), `getLetterTransform` (combinado). El objeto transform unificado usa `{ rot, offsetY }` (corrige el bug donde `drawFillUnits` usaba `tf.rot` pero la función devolvía `tf.rotation`).
- [x] **T19.2.4** Rotación desde el **centro visual del glifo**: tanto Flag como Boggle rotan alrededor del centro del carácter (`glyphCenter = (ascent - descent)/2`), no desde la baseline (abajo). Aplicado en `drawTextWithSpacing` (outlines/sombras) y `drawFillUnits` (fill), con gradientes/patrones compensados (`gradTf` con `cx/cy` reales del pivote).
- [x] **T19.2.5** Fix del editor flotante: el panel de estilos de relleno se cerraba al hacer click DENTRO de él (gradient handles, sliders). Se reemplazó el listener de cierre por un `contains(e.target)` check — solo cierra si el click cae FUERA del panel.
- [x] **T19.2.6** UI: fieldset renombrado a "Flag (bandera)" con bindings `lettering.flag.*`, nuevo fieldset "Boggle (desordenadas)" con bindings `lettering.boggle.*` (Max rotation 0-360, Scatter height 0-100).
- [x] **T19.2.7** Compatibilidad de presets: `loadPreset` migra el campo `lettering.boggle` legacy (que era bandera) a `lettering.flag`, y carga `lettering.boggle` nuevo solo cuando el preset también tiene `lettering.flag` (formato nuevo). `updateUIFromSettings` sincroniza ambos fieldsets.

---

### Fase 20: Rendimiento + Galería visual + Proyectos locales (.txm)
Documenta el plan aprobado: optimización de rendimiento, galería de presets con miniaturas y almacenamiento local de proyectos como pares `.txm` + `.webp`. Mantiene intacta la lógica actual de tamaño/proporción del canvas y conserva las exclusiones acordadas: animaciones (bounce/fade/beat), ABC styles, features premium, preview de fuente en el dropdown, estados de carga avanzados, optimización móvil, batch export, Text Warper con control points y export vectorial (AI/EPS).

**Rendimiento**
- [x] **T20.1** `render()`: reasignar `state.canvas.width/height` solo si el tamaño cambia (evita el reset del contexto 2D en cada frame).
- [x] **T20.2** Pool de capas offscreen reutilizables (límite 4, tope de área 4096²) para la capa de composición de texto (`acquireCanvas`/`releaseCanvas`).
- [x] **T20.3** Caché LRU de texturas (128 imágenes / ~64 MB) con protección de texturas en uso y `clearTextureCache()` exportado.
- [x] **T20.4** Disposición completa de contextos WebGL (program + shaders + `WEBGL_lose_context`) en `bevel-webgl.js`, `specular-webgl.js` y `distort-engine.js` (arco).

**Galería visual**
- [x] **T20.5** Panel inferior expandible con grilla de miniaturas, búsqueda y selección activa (`index.html` + `css/style.css` + `js/controls.js`).
- [x] **T20.6** `ensureThumbnail()`: genera WebP 100×200 (contain-fit) desde render offscreen, convirtiendo el preset crudo a settings internos; caché en memoria + `localStorage` (`textmuy_thumbnails`).
- [x] **T20.7** `PresetManager.loadPreset(name)`: carga un preset (local/importado o embebido en `presets/`) al editor — corrige la referencia rota que usaba `controls.js`.

**Proyectos locales**
- [x] **T20.8** Formato `.txm` = delta solo de diferencias respecto a defaults (`diffSettings`/`settingsFromDelta`), sin miniatura embebida; el `.webp` acompañante es la miniatura de 100×200 px.
- [x] **T20.9** File System Access API: `pickProjectDirectory`, `saveProject`, `listProjects`, `openProject`, `deleteProject`, `readProjectThumbnailUrl`.
- [x] **T20.10** UI de gestión de proyectos en el panel DOWNLOAD ("Open folder" / "Save project" + lista con Open/Delete).
- [x] **T20.11** Test `tests/preset-delta.test.js`: ida y vuelta del delta preservando `false`/`0`/`null`/`""` y podando ramas sin cambios.

**Correcciones de carga de presets (reportadas por el usuario con `npx serve`)**
- [x] **T20.15** `loadPreset()` escribía en rutas "aplanadas" inexistentes (`s.depth.gradient/texture`, `s.depth2.gradient`, `s.background.image/gradient`, `s.lettering.shadow.color`) → crash `Cannot set properties of undefined (setting 'active')` al cargar cualquier preset. Redirigido al esquema anidado real (`s.depth.fill.*`, `s.background.fill.*`, `s.lettering.shadow.fill.*`), que es lo que leen el renderizador y `updateUIFromSettings()`.
- [x] **T20.16** `defaultSettings.lettering` no definía `flag` (herencia de la Fase 19.2): la rama legacy `boggle → flag` crasheaba. Añadido `flag: {active:false, angle:12, amplitude:10}` y defaults de `boggle` alineados con el nuevo efecto (40/50).
- [x] **T20.17** `rgbToHex()` devolvía `'#ffffff'` para strings: cargar un preset guardado (colores ya en hex) reseteaba fill/depth/depth2/background a blanco. Ahora pasa los strings sin tocarlos (misma semántica que `colorToHex`).
- [x] **T20.18** Restaurados los 9 `presets/*.json` (habían sido eliminados del árbol de trabajo; `git restore -- presets/`).
- [x] **T20.19** Test `tests/preset-load.test.js`: carga en Node de los 9 presets incluidos + ida y vuelta de un preset guardado (esquema interno) + migración legacy `boggle → flag`.

**Correcciones del editor de estilos de Filling + Gradient picker (reportadas por el usuario)**
- [x] **T20.20** El picker de gradiente no aparecía al abrir "Edit style" sobre un estilo gradiente: el body del panel flotante se construía **antes** de añadir el panel al documento y `GradientPicker.init()` (que usa `document.querySelectorAll`) no veía pickers desatachados — solo cargaba al pulsar el tab Gradient. Fix: construir el body inicial **después** de `document.body.appendChild(panel)`, e inicializar el picker del panel con el nuevo `GradientPicker.create(container, input)` (targeted) en lugar del `init()` global que reconstruía todos los pickers de la página.
- [x] **T20.21** Doble click en un gradient-stop cerraba el editor flotante y abría el selector de color "en otro lado": el `input[type=color]` oculto se añadía a `document.body` y su `.click()` programático burbujeaba al documento, donde `fillStyleDocClick` (fase captura) veía el target fuera del panel → lo cerraba. Fix: el input vive ahora dentro del contenedor del picker (dentro del panel) con `stopPropagation`, y se limpia en `change`/reapertura.
- [x] **T20.22** Los cambios del gradiente (añadir colores, mover stops) no se reflejaban: `updateInputValue()` solo disparaba el evento `input` si el input tenía `data-tt-option`, y el input del panel flotante no lo tiene → nunca notificaba. Fix: disparar siempre el evento (los inputs estáticos tienen su binding y el del panel su listener propio).
- [x] **T20.23** Pattern fit/stretch ignorados: `migrateLegacyFillLayers()` calculaba las capas legacy on-the-fly **sin guardarlas** en `settings.fill.layers`, así que el panel editaba otra lista y sus cambios (fit/scale/origen) no llegaban al canvas. Fix: expuesto `TextEditor.getFillLayers()` y el panel ahora **siembra** `settings.fill.layers` con la migración cuando falta, para que panel y renderer compartan el mismo array. La migración de textura incluye defaults explícitos (`position/fit/scale`).
- [x] **T20.24** Los patterns no aparecían sin una interacción extra: las texturas cargan async y el `onload` no repintaba (icons/background sí lo hacían). Fix: `loadTextureImage` dispara `render()` tras cachear la imagen.
- [x] **T20.25** Pattern fit/stretch con **no repeat** (marco completo de texto) ignoraba el 100% del ancho/alto del contenedor: `getTextBlockBox()` no seteaba la fuente antes de medir y `fill` es el primer pass del pipeline, así que en un canvas fresco (export/thumbnail/preview) media con la fuente por defecto (`10px sans-serif`) → caja microscópica → el pattern se anclaba a ella. Fix: `setTextFont(ctx, s, fontSizePx)` al inicio de `getTextBlockBox()` (afecta también a gradientes en no repeat) y default de `lineHeight` alineado con `getTextBlockMetrics()`/`autoFitText()` (1.0 en vez de 1.2). Test de regresión: `tests/pattern-block-box.test.js`.
- [x] **T20.26** Test de regresión `pattern-block-box` que verifica las dos invariantes fuente (font set + lineHeight default) del box del marco completo.

**Pendiente / consideraciones**
- [ ] **T20.12** Persistir el `FileSystemDirectoryHandle` (IndexedDB) para no re-seleccionar la carpeta al recargar.
- [ ] **T20.13** Pulido de UI restante (agrupación/colapsables y hover states — Fase 16).
- [ ] **T20.14** Medir rendimiento before/after con DevTools Performance/Memory (meta: 30% menos render / 40% menos memoria, no garantizada).

**Limitaciones conocidas**
- `showDirectoryPicker` requiere Chrome/Edge y contexto seguro (HTTPS o `localhost`).
- El handle de carpeta se mantiene en memoria (no persistido aún).
- ZIP y AI/EPS quedan fuera de alcance.

---

### Fase 21: Flag v2 — Tilt / Rise / Wave width / Wave shift / Shape

Rediseño completo del efecto **Flag (bandera)** (especificación aprobada por el usuario). Los nombres anteriores eran jerga matemática sin relación con la acción; además **"frequency" estaba invertido**: su valor mínimo (alternancia letra a letra) es en realidad la frecuencia *más alta* y su máximo (un barrido en todo el texto) la *más baja*. Los nuevos nombres describen la acción que realizan y las claves de settings coinciden con las etiquetas de la UI.

**Modelo de onda** (`flagWaveAt`): cada letra `i` de una línea de `n` caracteres muestrea una onda `w ∈ [-1, 1]`; Tilt (grados) rota la letra y Rise (% del tamaño de fuente) la desplaza verticalmente, ambos escalados por `w` (rotación y altura se mueven juntas, como una bandera real). La onda se resuelve **por línea** (cada línea multilínea ondea según su propio largo).

- `half = max(1, (waveWidth/100) × (n−1))` — caracteres por medio ciclo
- `x = (i + (waveShift/100) × half) / half`
- `smooth`: `w = cos(π·x)` · `linear`: `m = x mod 2; w = (m≤1) ? 1−2m : 2m−3` (6 letras al 100% muestrean `+1, .6, .2, −.2, −.6, −1` → 5, 3, 1, −1, −3, −5 con Tilt 5°)
- `rot = tilt × w` · `offsetY = (rise/100) × fontSizePx × w`

**Tareas**

- [x] **T21.1** Motor: nueva función pura `flagWaveAt(charIndex, lineLength, waveWidth, waveShift, shape)` documentada con el modelo completo; `getFlagTransform(s, charIndex, fontSizePx, lineLength)` aplica Tilt/Rise; `getLetterTransform` propaga `lineLength`. Call-sites actualizados: `drawTextWithSpacing` (pasa `chars.length`) y `drawFillUnits` (pasa `line.length`). `flagWaveAt` expuesta en `window.TextEditor` para tests (patrón `DistortEngine.getArcGeometry`).
- [x] **T21.2** Renombrado de claves (settings alineados con la UI): `lettering.flag = { active, tilt, rise, waveWidth, waveShift, shape }` (antes `angle`/`amplitude` con semántica de fase interna) y `lettering.boggle = { active, maxRotation, scatterHeight }` (antes `angle`/`amplitude`, que no coincidían con sus labels "Max rotation"/"Scatter height").
- [x] **T21.3** UI (`index.html`): fieldset Flag con **Tilt** (−360..360°), **Rise** (−100..100%), **Wave width** (1..100%), **Wave shift** (0..100%) — los cuatro con burbuja de valor (`tt-range-bubble`) — y **Shape** (select Smooth/Linear). Tooltips `title` en cada label. Boggle con ids/claves alineados.
- [x] **T21.4** Bindings y sincronización (`controls.js` + `updateUIFromSettings`): `bindRangeWithRender` (con render de burbuja) para los 4 sliders y `bindSelect` para Shape.
- [x] **T21.5** Migraciones en `loadPreset`: `flag.angle` → `flag.tilt` y `flag.amplitude` → `flag.rise` (heurística ratio 0-1 → % conservada), `boggle.angle/amplitude` → `boggle.maxRotation/scatterHeight` en ambas ramas; claves nuevas validadas (tilt −360..360 def 10, rise −100..100 def 20, waveWidth 1..100 def 100, waveShift 0..100 def 0, shape ∈ {smooth, linear} def smooth). Defaults nuevos: `tilt 10, rise 20, waveWidth 100, waveShift 0, shape 'smooth'`.
- [x] **T21.6** Tests: nuevo `tests/flag-wave.test.js` (barrido exacto linear, smooth monótona, alternancia al 1%, valle central con shift 50%, línea de 1 letra, shape inválido → smooth, clamps) y `tests/preset-load.test.js` actualizado (migraciones legacy + round-trip v2 + claves boggle).
- [x] **T21.7** Tilt "follow wave" + selector **Tilt mode**: la rotación pasaba de seguir el **valor** de la onda (máx inclinación en crestas/valles y rectas a mitad del viaje — antinatural) a seguir su **pendiente** (tangente de bandera real: máx inclinación al subir/bajar, casi verticales en extremos). Nueva función pura `flagWaveSlopes()` (pendiente por letra = diferencia de altura con la siguiente, normalizada por la letra más inclinada → el slider Tilt son siempre los grados reales máximos; la última letra muestrea la onda continuada más allá del texto → par/impar intacto a width 1). Selector **Tilt mode** (Follow wave default / By position = look arco/cascada anterior). Trade-off documentado: quieto **exacto** en extremos ⟷ zigzag par/impar a width 1 son matemáticamente excluyentes; el modelo usa el viaje hacia la siguiente letra (≈31% de inclinación en extremos a width 100 + par/impar perfecto a width 1). Convención de signo: descenso → inclina a la derecha (downhill).
- [x] **T21.8** Defaults neutros: `tilt: 0, rise: 0` (antes 10/20) — activar Flag sin tocar controles no altera el texto. Nuevo helper `isFlagNeutral()`: con Tilt y Rise a 0 todas las transformadas son identidad → `getFlagTransform` devuelve null (bypass, ni siquiera calcula pendientes) y el anclaje global de gradientes/texturas de `drawFillStyleOnBlock`/`drawFillUnits` no activa su ruta de máscara → resultado píxel-idéntico al efecto apagado. UI: sliders Tilt/Rise arrancan en 0; fallbacks de `loadPreset` alineados a 0.

**Compatibilidad**: solo el preset *looney-tunes* tiene el flag activo (`angle 5, amplitude 0.1` → `tilt 5, rise 10`): pasa del zigzag rígido de fase fija a un barrido suave ±5° de ±10% de altura, más fiel a una bandera. Ningún otro preset se ve afectado (flag inactivo). `js/*.min.js` no se tocan (la página carga las versiones normales; no hay paso de build).

---

## 6. Referencias rápidas

### Dónde está cada cosa en el código actual

| Funcionalidad | Archivo | Líneas | Función/Elemento |
|---|---|---|---|
| Render principal | `js/editor.js` | 671 | `render()` |
| Default settings | `js/editor.js` | 8-147 | `defaultSettings` |
| Flag v2: modelo de onda | `js/editor.js` | 2005-2118 | `flagWaveAt()` / `flagWaveSlopes()` / `isFlagNeutral()` / `getFlagTransform()` / `getBoggleTransform()` / `getLetterTransform()` |
| Carga de preset (incluye migraciones Flag v2) | `js/editor.js` | 2384 | `loadPreset()` |
| Update UI from settings | `js/editor.js` | 2867 | `updateUIFromSettings()` |
| Bindings de controles | `js/controls.js` | 197 | `bindControls()` |
| Importación TextStudio | `js/controls.js` | 1558 | `bindImportControls()` |
| Gradient pickers | `js/gradient-picker.js` | 253 | `initGradientPickers()` |
| PresetManager (CRUD + delta `.txm`) | `js/preset-manager.js` | 251-445 | `loadPresetFromFile()` / `diffSettings()` / `settingsFromDelta()` / `loadPreset()` |
| Exportación | `js/export.js` | 36 | `download()` |
| Flag v2 UI (Tilt/Tilt mode/Rise/Wave width/Wave shift/Shape) | `index.html` | 272-317 | `tt-lettering-flag-fieldset` / `tt-lettering-boggle-fieldset` |
| Lista de formatos | `index.html` | 1444 | `tt-download-format-list` |
| Lista de presets | `index.html` | 1476 | `tt-preset-list` |
| Carga de fuentes | `js/fonts.js` | 177 | `loadFont()` |
| Tests Flag v2 (onda + pendientes) | `tests/flag-wave.test.js` | — | `flagWaveAt()` / `flagWaveSlopes()` / clamps |
| Tests de carga y migraciones | `tests/preset-load.test.js` | — | presets incluidos + migraciones legacy + neutralidad |
| Inicialización | `js/main.js` | 6-35 | `DOMContentLoaded` handler |

> Nota: las filas de `convertSettingsToPreset()`, `loadPresetFile()` y `createExportCanvas()` se eliminaron — esas funciones ya no existen tras las refactorizaciones (la conversión de presets vive en `js/preset-manager.js`, y la carga de presets en `PresetManager.loadPreset()`).

### Orden de renderizado de efectos (dentro de `render()`, `js/editor.js` 671+)
1. Outer shadow 2
2. Outer shadow
3. 3D depth 2
4. 3D depth
5. Fill
6. Outline 2
7. Outline
8. Bevel
9. Inner shadow 2
10. Inner shadow
11. Icon

### Estructura de un preset de TextStudio (propiedades)
```
text, font{name,size,weight,src}, align, rotate, lineHeight, letterSpacing,
mergeGradients, lettering{active,blendmode,boggle,reverseOverlap,shadow},
distort{arc}, processing{active,code}, 
fill{active,alpha,color,texture{active,src,blendmode,repeat,position,size,alpha,lettering},gradient{active,colors,angle},palette{active,lettering.method}},
depth{active,length,angle,fill{alpha,color,gradient{active,colors,type,angle},texture{active,src,blendmode,repeat,position,size,alpha},mergeAlpha}},
depth2{...},
outline{first{active,width,fill{alpha,color,gradient{active,colors,angle},palette{active,lettering.method},texture{active,src,blendmode,lettering,position,repeat,size,alpha}},join,dash,specular{active,type,color,blendmode,blur,constant,exponent,azimuth,elevation,point{x,y,z},scale}},
second{...}, global{active,width,fill{alpha,color,gradient{active,colors,angle},texture{active,src,blendmode,position,repeat,size,alpha}},join,mask,projection,shadow{active}},
global2{...}},
bevel{inner{active,size,angle,altitude,smoothing,soften,highlight{color,alpha,blendmode},shadow{color,alpha,blendmode}}, inner2{...}},
shadow{inner{active,color,alpha,angle,distance,size,strength,offset,blendmode}, inner2{...}, outer{active,fill{color,alpha,gradient{active,colors,angle}},angle,distance,size,strength,mask}, outer2{...}},
specular{inner{active,type,color,blendmode,blur,constant,exponent,azimuth,elevation,point{x,y,z},scale}},
icon{active,src,size,position,offset{x,y},rotate,alpha,composite},
background{active,composite,fill{color,alpha,gradient{active,colors,angle,type},image{active,src,alpha,repeat,size,size.custom}}},
animation{active,id,duration,pause}
```

### Estructura de Interfaz TextStudio (Jerarquía Visual)

**MENÚS PRINCIPALES:**
- **TEXT**: Configuración de texto, fuente, alineación, espaciado
- **STYLES**: Efectos de estilo (3D, rellenos, contornos, sombras)
- **ICON**: Gestión de iconos/logos
- **BACKGROUND**: Configuración de fondo
- **ANIMATION**: Animaciones (no implementado en TextMuy)
- **DOWNLOAD**: Opciones de exportación

**SECCIÓN TEXT:**
- `text` - Texto principal (textarea)
- `align` - Alineación (left/center/right)
- `font.weight` - Peso de fuente (normal/bold)
- `font.src` - Fuente (font-picker)
- `font.size` - Zoom (rango: 12-140)
- `letterSpacing` - Espaciado de caracteres (rango: -0.5 a 1.5)
- `lineHeight` - Altura de línea (rango: 0.1 a 3)
- `distort.arc.angle` - Curvar texto (rango: -360° a 360°) ⭐ PREMIUM
- `rotate` - Rotación (rango: -180° a 180°)
- `mergeGradients` - Fusionar estilos (multiline)

**SECCIÓN STYLES:**

#### Sub-menú: 3D & FILLING
- **Filling**:
  - `fill.active` - Activar relleno
  - `fill.color` - Color de relleno
  - `fill.alpha` - Opacidad de color (rango: 0-1)
  - `fill.gradient.active` - Activar gradiente
  - `fill.gradient.colors` - Colores del gradiente
  - `fill.gradient.angle` - Dirección del gradiente (rango: -180° a 180°)
  - `fill.texture.active` - Activar textura/patrón
  - `fill.texture.src` - Fuente de textura
  - `fill.texture.blendmode` - Modo de mezcla
  - `fill.texture.repeat` - Repetición (repeat/no-repeat)
  - `fill.texture.position` - Posición (9 opciones)
  - `fill.texture.size` - Tamaño (múltiples opciones)
  - `fill.texture.alpha` - Opacidad de patrón (rango: 0-1)

- **Lettering**:
  - `fill.palette.active` - Activar paleta de estilos
  - `fill.palette.lettering.method` - Método (1 style/letter, 1 style/line, 1 style/word)

- **3D projection #1 (depth)**:
  - `depth.active` - Activar proyección 3D
  - `depth.length` - Longitud (rango: 0.01-1)
  - `depth.angle` - Orientación (rango: -180° a 180°)
  - `depth.fill.color` - Color de relleno
  - `depth.fill.gradient.active` - Activar gradiente
  - `depth.fill.gradient.colors` - Colores del gradiente
  - `depth.fill.gradient.type` - Tipo de gradiente (depth/linear)
  - `depth.fill.gradient.angle` - Dirección del gradiente
  - `depth.fill.mergeAlpha` - Mezclar con capa superior (rango: 0-1)
  - `depth.fill.alpha` - Opacidad de color (rango: 0-1)
  - `depth.fill.texture.active` - Activar textura
  - `depth.fill.texture.src` - Fuente de textura
  - `depth.fill.texture.blendmode` - Modo de mezcla
  - `depth.fill.texture.repeat` - Repetición
  - `depth.fill.texture.position` - Posición
  - `depth.fill.texture.size` - Tamaño
  - `depth.fill.texture.alpha` - Opacidad de patrón

- **3D projection #2 (depth2)** [tt-show-brother]:
  - `depth2.active` - Activar proyección 3D #2
  - `depth2.length` - Longitud (rango: 0.01-1)
  - `depth2.angle` - Orientación (rango: -180° a 180°)
  - `depth2.fill.color` - Color de relleno
  - `depth2.fill.gradient.active` - Activar gradiente
  - `depth2.fill.gradient.colors` - Colores del gradiente
  - `depth2.fill.gradient.type` - Tipo de gradiente (depth/linear)
  - `depth2.fill.gradient.angle` - Dirección del gradiente
  - `depth2.fill.mergeAlpha` - Mezclar con capa superior (rango: 0-1)
  - `depth2.fill.alpha` - Opacidad de color (rango: 0-1)
  - `depth2.fill.texture.active` - Activar textura
  - `depth2.fill.texture.src` - Fuente de textura
  - `depth2.fill.texture.blendmode` - Modo de mezcla
  - `depth2.fill.texture.repeat` - Repetición
  - `depth2.fill.texture.position` - Posición
  - `depth2.fill.texture.size` - Tamaño
  - `depth2.fill.texture.alpha` - Opacidad de patrón

#### Sub-menú: OUTLINES
- **Outline #1**:
  - `outline.first.active` - Activar contorno #1
  - `outline.first.width` - Ancho (rango: 0-0.5)
  - `outline.first.fill.color` - Color de relleno
  - `outline.first.fill.alpha` - Opacidad de relleno
  - `outline.first.fill.gradient.active` - Activar gradiente
  - `outline.first.fill.gradient.colors` - Colores del gradiente
  - `outline.first.fill.gradient.angle` - Dirección del gradiente
  - `outline.first.fill.palette.active` - Activar paleta
  - `outline.first.fill.palette.lettering.method` - Método de lettering
  - `outline.first.fill.texture.active` - Activar textura
  - `outline.first.fill.texture.src` - Fuente de textura
  - `outline.first.fill.texture.blendmode` - Modo de mezcla
  - `outline.first.fill.texture.lettering` - Lettering de textura
  - `outline.first.fill.texture.position` - Posición
  - `outline.first.fill.texture.repeat` - Repetición
  - `outline.first.fill.texture.size` - Tamaño
  - `outline.first.fill.texture.alpha` - Opacidad de patrón
  - `outline.first.join` - Tipo de unión
  - `outline.first.dash` - Guiones
  - `outline.first.specular.active` - Activar especular
  - `outline.first.specular.*` - Parámetros especular (type, color, blendmode, blur, constant, exponent, azimuth, elevation, point.x/y/z, scale)

- **Outline #2**:
  - `outline.second.active` - Activar contorno #2
  - `outline.second.width` - Ancho (rango: 0-0.5)
  - `outline.second.fill.color` - Color de relleno
  - `outline.second.fill.alpha` - Opacidad de relleno
  - `outline.second.fill.gradient.active` - Activar gradiente
  - `outline.second.fill.gradient.colors` - Colores del gradiente
  - `outline.second.fill.gradient.angle` - Dirección del gradiente
  - `outline.second.fill.palette.active` - Activar paleta
  - `outline.second.fill.palette.lettering.method` - Método de lettering
  - `outline.second.fill.texture.active` - Activar textura
  - `outline.second.fill.texture.src` - Fuente de textura
  - `outline.second.fill.texture.blendmode` - Modo de mezcla
  - `outline.second.fill.texture.lettering` - Lettering de textura
  - `outline.second.fill.texture.position` - Posición
  - `outline.second.fill.texture.repeat` - Repetición
  - `outline.second.fill.texture.size` - Tamaño
  - `outline.second.fill.texture.alpha` - Opacidad de patrón
  - `outline.second.join` - Tipo de unión
  - `outline.second.dash` - Guiones
  - `outline.second.specular.active` - Activar especular
  - `outline.second.specular.*` - Parámetros especular (type, color, blendmode, blur, constant, exponent, azimuth, elevation, point.x/y/z, scale)

- **Contour 3D #1 (outline.global)**:
  - `outline.global.active` - Activar contorno global #1
  - `outline.global.width` - Ancho
  - `outline.global.fill.color` - Color de relleno
  - `outline.global.fill.alpha` - Opacidad de relleno
  - `outline.global.fill.gradient.active` - Activar gradiente
  - `outline.global.fill.gradient.colors` - Colores del gradiente
  - `outline.global.fill.gradient.angle` - Dirección del gradiente
  - `outline.global.fill.texture.active` - Activar textura
  - `outline.global.fill.texture.src` - Fuente de textura
  - `outline.global.fill.texture.blendmode` - Modo de mezcla
  - `outline.global.fill.texture.position` - Posición
  - `outline.global.fill.texture.repeat` - Repetición
  - `outline.global.fill.texture.size` - Tamaño
  - `outline.global.fill.texture.alpha` - Opacidad de patrón
  - `outline.global.join` - Tipo de unión
  - `outline.global.mask` - Hidden by text
  - `outline.global.projection` - 3D projection
  - `outline.global.shadow.active` - Projected shadow

- **Contour 3D #2 (outline.global2)** [tt-show-brother]:
  - `outline.global2.active` - Activar contorno global #2
  - `outline.global2.width` - Ancho
  - `outline.global2.fill.color` - Color de relleno
  - `outline.global2.fill.alpha` - Opacidad de relleno
  - `outline.global2.fill.gradient.active` - Activar gradiente
  - `outline.global2.fill.gradient.colors` - Colores del gradiente
  - `outline.global2.fill.gradient.angle` - Dirección del gradiente
  - `outline.global2.fill.texture.active` - Activar textura
  - `outline.global2.fill.texture.src` - Fuente de textura
  - `outline.global2.fill.texture.blendmode` - Modo de mezcla
  - `outline.global2.fill.texture.position` - Posición
  - `outline.global2.fill.texture.repeat` - Repetición
  - `outline.global2.fill.texture.size` - Tamaño
  - `outline.global2.fill.texture.alpha` - Opacidad de patrón
  - `outline.global2.join` - Tipo de unión
  - `outline.global2.mask` - Hidden by text
  - `outline.global2.projection` - 3D projection
  - `outline.global2.shadow.active` - Projected shadow

#### Sub-menú: SHADOWS
- **Inner bevel #1**:
  - `bevel.inner.active` - Activar bisel interior #1
  - `bevel.inner.size` - Tamaño (rango: 0.025-1)
  - `bevel.inner.angle` - Dirección (rango: -180° a 180°)
  - `bevel.inner.altitude` - Altitud (rango: 0°-90°)
  - `bevel.inner.smoothing` - Suavizado del cincel
  - `bevel.inner.soften` - Suavizar (rango: 0-1)
  - `bevel.inner.highlight.color` - Color de resaltado
  - `bevel.inner.highlight.alpha` - Opacidad de resaltado
  - `bevel.inner.highlight.blendmode` - Modo de mezcla de resaltado
  - `bevel.inner.shadow.color` - Color de sombra
  - `bevel.inner.shadow.alpha` - Opacidad de sombra
  - `bevel.inner.shadow.blendmode` - Modo de mezcla de sombra

- **Inner bevel #2** [tt-show-brother]:
  - (Mismos parámetros que Inner bevel #1, pero con sufijo diferente)

- **Inner shadow #1**:
  - `shadow.inner.active` - Activar sombra interior #1
  - `shadow.inner.color` - Color
  - `shadow.inner.alpha` - Opacidad (rango: 0-1)
  - `shadow.inner.angle` - Ángulo (rango: -180° a 180°)
  - `shadow.inner.distance` - Distancia
  - `shadow.inner.size` - Tamaño
  - `shadow.inner.strength` - Fuerza
  - `shadow.inner.offset` - Desplazamiento
  - `shadow.inner.blendmode` - Modo de mezcla

- **Inner shadow #2** [tt-show-brother]:
  - `shadow.inner2.active` - Activar sombra interior #2
  - `shadow.inner2.color` - Color
  - `shadow.inner2.alpha` - Opacidad (rango: 0-1)
  - `shadow.inner2.angle` - Ángulo (rango: -180° a 180°)
  - `shadow.inner2.distance` - Distancia
  - `shadow.inner2.size` - Tamaño
  - `shadow.inner2.strength` - Fuerza
  - `shadow.inner2.offset` - Desplazamiento
  - `shadow.inner2.blendmode` - Modo de mezcla

- **Outer shadow #1**:
  - `shadow.outer.active` - Activar sombra exterior #1
  - `shadow.outer.fill.color` - Color de relleno
  - `shadow.outer.fill.alpha` - Opacidad de relleno
  - `shadow.outer.fill.gradient.active` - Activar gradiente
  - `shadow.outer.fill.gradient.colors` - Colores del gradiente
  - `shadow.outer.fill.gradient.angle` - Dirección del gradiente
  - `shadow.outer.angle` - Ángulo (rango: -180° a 180°)
  - `shadow.outer.distance` - Distancia
  - `shadow.outer.size` - Tamaño
  - `shadow.outer.strength` - Fuerza
  - `shadow.outer.mask` - Máscara

- **Outer shadow #2** [tt-show-brother]:
  - `shadow.outer2.active` - Activar sombra exterior #2
  - `shadow.outer2.fill.color` - Color de relleno
  - `shadow.outer2.fill.alpha` - Opacidad de relleno
  - `shadow.outer2.fill.gradient.active` - Activar gradiente
  - `shadow.outer2.fill.gradient.colors` - Colores del gradiente
  - `shadow.outer2.fill.gradient.angle` - Dirección del gradiente
  - `shadow.outer2.angle` - Ángulo (rango: -180° a 180°)
  - `shadow.outer2.distance` - Distancia
  - `shadow.outer2.size` - Tamaño
  - `shadow.outer2.strength` - Fuerza
  - `shadow.outer2.mask` - Máscara

- **Specular inner**:
  - `specular.inner.active` - Activar especular interior
  - `specular.inner.type` - Tipo de especular
  - `specular.inner.color` - Color especular
  - `specular.inner.blendmode` - Modo de mezcla
  - `specular.inner.blur` - Desenfoque
  - `specular.inner.constant` - Constante
  - `specular.inner.exponent` - Exponente
  - `specular.inner.azimuth` - Azimut
  - `specular.inner.elevation` - Elevación
  - `specular.inner.point.x` - Punto X
  - `specular.inner.point.y` - Punto Y
  - `specular.inner.point.z` - Punto Z
  - `specular.inner.scale` - Escala

- **Lettering options**:
  - `lettering.active` - Activar lettering
  - `lettering.blendmode` - Modo de mezcla
  - `lettering.boggle.active` - Activar boggle
  - `lettering.boggle.amplitude` - Amplitud de boggle
  - `lettering.boggle.angle` - Ángulo de boggle
  - `lettering.shadow.active` - Activar sombra de lettering
  - `lettering.shadow.angle` - Ángulo de sombra
  - `lettering.shadow.distance` - Distancia de sombra
  - `lettering.shadow.size` - Tamaño de sombra
  - `lettering.shadow.fill.color` - Color de relleno de sombra
  - `lettering.shadow.fill.alpha` - Opacidad de relleno de sombra
  - `lettering.reverseOverlap.letters` - Superposición inversa de letras
  - `lettering.reverseOverlap.lines` - Superposición inversa de líneas

**SECCIÓN ICON:**
- `icon.active` - Activar icono
- `icon.src` - Fuente del icono
- `icon.size` - Tamaño del icono
- `icon.position` - Posición del icono
- `icon.offset.x` - Desplazamiento X
- `icon.offset.y` - Desplazamiento Y
- `icon.rotate` - Rotación del icono
- `icon.alpha` - Opacidad del icono
- `icon.composite` - Composición del icono

**SECCIÓN BACKGROUND:**
- `background.active` - Activar fondo
- `background.composite` - Composición del fondo
- `background.fill.color` - Color de relleno de fondo
- `background.fill.alpha` - Opacidad de relleno de fondo
- `background.fill.gradient.active` - Activar gradiente de fondo
- `background.fill.gradient.colors` - Colores del gradiente de fondo
- `background.fill.gradient.angle` - Dirección del gradiente de fondo
- `background.fill.gradient.type` - Tipo de gradiente de fondo
- `background.fill.image.active` - Activar imagen de fondo
- `background.fill.image.src` - Fuente de imagen de fondo
- `background.fill.image.alpha` - Opacidad de imagen de fondo
- `background.fill.image.repeat` - Repetición de imagen de fondo
- `background.fill.image.size` - Tamaño de imagen de fondo
- `background.fill.image.size.custom` - Tamaño personalizado de imagen de fondo

**SECCIÓN DOWNLOAD:**
- Opciones de exportación/descarga PNG transparente

**SECCIÓN ANIMATION:** (no implementado en TextMuy)
- `animation.active` - Activar animación
- `animation.id` - ID de animación
- `animation.duration` - Duración de animación
- `animation.pause` - Pausar animación

**Nota:** Los elementos marcados con `[tt-show-brother]` tienen un botón para mostrar un duplicado de la misma funcionalidad, permitiendo aplicar efectos similares múltiples veces.

---

## 7. Estructura de archivos organizados

### 7.1 Directorios y archivos principales

```
textmuy/
├── css/
│   ├── editor.min.css        # UI TextStudio (ofuscado - referencia)
│   ├── font-picker.min.css   # Selector de fuentes
│   └── animate.min.css       # Animaciones de loading
├── fonts/
│   ├── google-sans.css       # Google Sans (Google Fonts)
│   └── roboto.css            # Roboto (Google Fonts)
├── js/
│   ├── editor.js             # Nuestro motor de render (limpio)
│   ├── editor.min.js         # TextStudio (ofuscado - referencia técnica)
│   ├── controls.js           # Nuestros controles UI
│   ├── controls.min.js       # TextStudio (ofuscado - referencia técnica)
│   ├── font-picker.min.js    # Selector de fuentes
│   ├── grapick.min.js        # Selector de gradientes
│   ├── pickr.min.js          # Selector de colores
│   ├── effects/              # Motores WebGL de referencia
│   │   ├── bevel.min.js      # Efecto bevel (TextStudio - ofuscado)
│   │   ├── specular.min.js   # Iluminación especular (TextStudio - ofuscado)
│   │   └── image-distort.min.js # Distorsión de imagen (TextStudio - ofuscado)
│   └── utils/                # Librerías utilitarias
│       ├── FileSaver.min.js  # Guardar archivos
│       ├── Sortable.min.js   # Drag & drop
│       ├── pica.min.js       # Redimensionamiento de imágenes
│       ├── potrace.min.js    # Vectorización
│       ├── stackblur.min.js  # Blur
│       ├── gif-encoder.min.js # Codificador GIF
│       ├── svgo.min.js       # Optimizador SVG
│       ├── toastify-js.min.js # Notificaciones
│       └── util.min.js       # Utilidades varias
├── presets/                  # Presets base JSON
└── index.html                # UI principal
```

### 7.2 Archivos de referencia de TextStudio

Los siguientes archivos están ofuscados y protegidos con copyright de TextStudio.com. No pueden usarse directamente pero sirven como referencia técnica para implementar efectos WebGL:

- **editor.min.js / controls.min.js**: Contienen la lógica completa de TextStudio. Útiles para entender el flujo de renderizado y la estructura de datos.
- **bevel.min.js**: Motor WebGL para efecto bevel con shaders. Referencia para implementar bevel real (no solo offset strokes).
- **specular.min.js**: Motor WebGL para iluminación especular. Referencia para implementar highlight/shadow realista.
- **image-distort.min.js**: Motor para distorsión de imagen. Referencia para implementar distort/arc per-character real.

**Nota**: Estos archivos están protegidos con copyright. Solo se usarán como referencia técnica para entender los algoritmos, no se copiará código directamente.

## 8. Notas finales

- **El cambio más grande:** refactorizar el motor de render a funciones puras (`js/render-engine.js`) para habilitar la API.
- **El desafío clave:** adaptar la compatibilidad de TextStudio (donde el canvas se adapta al texto) a nuestro modelo (canvas fijo, texto se auto-ajusta).
- **Quick wins:** corregir bugs de propiedades undefined, exportación transparente, conectar inputs de tamaño custom.
- **Iterativo:** las fases 1-4 son críticas para el MVP; las fases 5-10 son mejoras progresivas.
- **Referencia técnica**: Los archivos ofuscados de TextStudio en `js/effects/` proporcionan patrones para implementar efectos WebGL avanzados (bevel, specular, distort).

---

## 9. Refactorización CSS y Recursos Externos

### 9.1 Problema de recursos externos

**⚠️ IMPORTANTE:** El HTML original referenciaba recursos desde `https://cdn.textstudio.com/asset/editor/` (iconos SVG de alineación, negrita, stroke, etc.). Esto es incorrecto porque:

1. **Dependencia externa:** La app no debería depender de recursos de un servidor externo (TextStudio CDN).
2. **Iconos invisibles:** Los SVG eran negros sobre fondo oscuro, por lo que no se veían.
3. **Carga innecesaria:** Cada icono era una petición HTTP adicional al CDN de TextStudio.

**Solución aplicada:** Se reemplazaron todos los `<img>` de `cdn.textstudio.com` con iconos de **Font Awesome** (que ya estaba cargado en el HTML):
- `align-left-icon.svg` → `<i class="fas fa-align-left"></i>`
- `align-center-icon.svg` → `<i class="fas fa-align-center"></i>`
- `align-right-icon.svg` → `<i class="fas fa-align-right"></i>`
- `bold-icon.svg` → `<i class="fas fa-bold"></i>`
- `stroke-round-icon.svg` → `<i class="fas fa-circle"></i>`
- `stroke-bevel-icon.svg` → `<i class="fas fa-square"></i>`
- `stroke-miter-icon.svg` → `<i class="fas fa-diamond"></i>`

**Iconos del menú principal:** Se añadieron via CSS `::before` con Font Awesome:
- TEXT → `fa-font` (`\f031`)
- STYLES → `fa-palette` (`\f53f`)
- ICON → `fa-image` (`\f03e`)
- BACKGROUND → `fa-square` (`\f0c8`)
- DOWNLOAD → `fa-download` (`\f019`)

### 9.2 Refactorización CSS completada

Se realizó una refactorización completa de `css/style.css` que incluyó:

1. **Variables CSS del tema:** 20 variables (`--tt-bg`, `--tt-accent`, `--tt-text`, etc.) para mantener consistencia.
2. **Scrollbar styling:** Estilos personalizados para `::-webkit-scrollbar` y `scrollbar-width`/`scrollbar-color` para Firefox.
3. **Layout móvil:** `#tt` cambia a `flex-direction: column` en pantallas < 600px.
4. **`#tt-custom-menu` como franja:** Margen negativo para que se extienda sobre las columnas.
5. **Soporte Firefox para range:** `::-moz-range-thumb` y `::-moz-range-track`.
6. **Estilos para `.tt-bottom-shadow` y `.tt-loading`:** Que antes no existían.
7. **Consolidación de clases duplicadas:** `.tt-texture-label`, `.tt-import-button-label`, `.tt-palette button` unificados.
8. **Eliminación de duplicación:** `.tt-texture-preview select` eliminado (ya cubierto por `.tt-blendmode-select` etc.).
9. **Limpieza de estilos inline:** Se removieron estilos inline redundantes del HTML (inputs, botones, labels).
10. **`flex-direction: column` en todas las secciones:** No solo en `text`, sino en todas para que el layout funcione correctamente.

---

## 10. Render Core (puente con Personalizador PDF)

Integración como módulo del plugin **Personalizador PDF** (v3.1.0): el plugin renderiza textos estilizados headless, sin cargar la UI del editor.

- [x] **T10.1** `render-core.html`: documento mínimo headless (Google Fonts + `js/fonts.js`, `js/effects/{distort-engine,bevel-webgl,specular-webgl}.js`, `js/editor.js`, `js/export.js`, `js/api.js`; ~220 KB vs ~1.4 MB de la UI completa). Inicializa `ExportManager.init(TextEditor)` (en la UI lo hace `main.js`) y expone `window.RenderCore = {version, ready}` + `postMessage('render-core-ready')` al parent same-origin.
- [x] **T10.2** `js/api.js`: caché de presets (promise-cache) en `loadPresetByName` — 1 fetch por preset, los fallos no se cachean — + `clearPresetCache()`.
- [x] **T10.3** `js/api.js`: `ensureFontReady(settings)` garantiza la carga de la familia (`FontLoader.loadFont` + `document.fonts.load`) antes de `renderToCanvas` (evita render con la fuente del sistema).
- [x] **T10.4** `js/api.js`: `renderBatch(items, {onProgress})` → `[{id, blob}]` con progreso por item; rechaza ante el primer fallo (nunca lote parcial). Retro-compatible: `renderTextToPNG`/`downloadPNG` sin cambios de firma.
- [x] **T10.5** `tests/preset-cache.test.js`: misma promesa cacheada (1 fetch), `clearPresetCache` refetchea, y un fallo no queda cacheado (retry reevalúa).
- **Contrato público** (ver AGENTS.md del plugin): el consumidor solo conoce `render-core.html`, `TextMuyAPI.renderBatch()` y `presets/*.json`.
