# Research: galerias-sprite-unificado

**Phase 0 output** — todos los `NEEDS CLARIFICATION` del Technical Context quedan resueltos abajo. Fuentes: código real verificado (`inc/class-pmu-uploads.php:1339-1377`, `assets/miniaturas.js:177-397`, `modules/textmuy/js/api.js:293-443`, `fonts.js`, `fuentes-galeria.js`), documentación oficial de Google Fonts (CSS API v2, technical considerations, FAQ) y spec 006 (contrato vigente).

## R1. Certificación de la hoja generalizada a los tres ámbitos (motor PHP)

**Decision**: mover la validación de `firma` (`json_decode(firma) === [w, h, c, items]`), la validación de dimensiones (`getimagesize` vs `c*w × ceil(maxId/c)*h`), la invalidación previa (`guardar_catalogo`) y la certificación final (`thumbs.sprite_firma`) fuera del `if ($ambito === 'img')` de `PMU_Uploads::sprite()`, aplicándolos a todo ámbito de `AMBITOS_GALERIA` (`fonts`, `img`, `tm-presets`) con la retícula de su propio inventario.

**Rationale**: hoy ese bloque solo corre para imágenes, así que `fonts` y `tm-presets` escriben `thumbs.webp` **sin certificar** y `api.js::ensureSpriteCanonico` (que exige `spriteFirma === firma`) los rechaza para siempre: es la causa raíz de "F5 vuelve a etiquetas". El parámetro `firma` ya llega en el `op=sprite` (payload intacto, constitución Communication ✅) y `guardar_catalogo` ya invalida la firma de `img` antes de reescribir (patrón a repetir). El lector certificado no admite atajos client-side.

**Alternatives considered**:
- *Certificar solo desde el módulo*: rechazado — el módulo no escribe archivos ni catálogos (constitución III del módulo; 006 FR-004) y el cliente no puede autenticar su propia certificación.
- *Aceptar la hoja sin certificar*: rechazado — rompe 006/constitución ("hoja sin certificar MUST NOT usarse") y reintroduciría lecturas ambiguas.
- *Dejar `guardar_catalogo` sin invalidar para las otras 2*: rechazado — una firma vieja tras un alta quedaría como "certificada" para un inventario distinto; la invalidación es el invariante de 006.

## R2. Generación de huecos en dos fases (nunca persistencia parcial)

**Decision**: la generación automática corre en dos fases dentro del cliente: (F1) para cada celda faltante, producir su canvas **en memoria** (imagen original / tipografía física / familia Google / preset) contando fallos; (F2) **solo si fallo = 0**, armar la hoja completa con un `op=sprite` único usando los canvases ya hechos. Si hay fallos: no se persiste nada, las celdas fallidas quedan como nombre y se informa la causa + reintento (FR-008).

**Rationale**: `ThumbEngine.ensureSprite` persiste la hoja completa al final de su propia corrida y su manifiesto vive solo en memoria (`miniaturas.js:312-314`), de modo que "persistir solo si todo salió bien" no puede pedirse *después* de llamarlo: hay que decidirlo antes. La fase F1 da control total de fallos y permite reutilizar canvases en F2 (F2 no hace red). Además respeta la validación server-side: el motor rechaza dimensiones distintas a la retícula, y una hoja con huecos persistida quedaría certificada para siempre (condena irreversible de esas celdas).

**Alternatives considered**:
- *Llamar `ensureSprite` directamente con render en vivo y abortar si falla*: rechazado — no se puede des-persistir ya escrito; dependería de que el motor capture excepciones dentro del render (no verificado como contrato) y arriesga una hoja parcial certificada.
- *Persistir parcial y regenerar después*: rechazado — la firma certificaría huecos (el lector los daría por "dibujados").
- *Parchear un solo tile dentro del webp existente*: rechazado — `canvas/WebP` no tienen update parcial y el motor valida el archivo completo contra la retícula; toda escritura es hoja completa.

## R3. Reentrancia por ámbito (una sola escritura en vuelo)

**Decision**: mapa en memoria `{ambito -> Promise}` en `api.js` (`js/api.js`, junto a `canonCache`): la segunda petición de generación del mismo ámbito **espera a la primera** en vez de emitir un segundo `op=sprite`; se limpia en `finally`. Sin lock en servidor.

**Rationale**: dos pestañas o dos galerías (US2 escenario 4, SC-009) comparten el mismo archivo `thumbs.webp`; dos `POST` concurrentes se pisan sobre el mismo destino y el cache-bust por `filemtime` puede quedar desalineado. AGENTS.md §9 lo advierte explícitamente: "los tokens de version descartan respuestas antiguas en las vistas; esto NO serializa las escrituras `op=sprite` en el servidor" — la serialización debe vivir en el cliente, que es quien las dispara.

**Alternatives considered**:
- *Lock/cola en servidor*: rechazado para este alcance — agrega estado transitorio al motor (sin tablas, sin semáforos de archivo en la constitución) sin necesidad real: las escrituras de un mismo ámbito las genera una sesión de admin.
- *Sin nada*: rechazado — SC-009 es explícito (0 escrituras simultáneas del mismo ámbito).


## R4. Google Fonts: familia única por petición, un solo peso, sin `text=`

**Decision**: en la generación y en el preview, pedir cada familia **por separado**, **solo su nombre** (sin `wght@...`: el endpoint devuelve el peso regular por subset), con `document.fonts.load` del texto mostrado, concurrencia máxima de 4 peticiones en vuelo, tiempo de espera de 3 s (patrón ya existente en `ensureGoogleFontBySpec`) y 1 reintento con espera creciente. El estado de "preview cargado" se guarda **aparte** del estado de carga usado por el render (`loadedFonts`/`loadingPromises`), para que el render posterior siga pidiendo el spec completo del catálogo (`Familia:wght@400;700...`) sin dar por cargado un peso que nunca se bajó.

**Rationale** (documentación oficial verificada): la API de hojas de estilo **no tiene cuota publicada** (Google nunca publicó una; el CDN sirve con `Cache-Control` alto); la cuota que existe pertenece a la API de metadatos, que no usamos. Pedir `text=` reduce el payload 87-96% pero crea `@font-face` limitados a esos caracteres: si el editor después renderiza texto completo con esa familia, faltarían glifos (o habría que inyectar además el spec completo, duplicando). Peso único = woff2 estático ~23 KB vs ~48 KB variable. Para 72 celdas (57 Google): ~1,5-2,5 MB una sola vez, comparable a las 15 físicas (~1,4 MB) que ya se bajan, y desaparece al quedar en la hoja certificada.

**Alternatives considered**:
- *`text=`*: rechazado (trampa de subconjunto para render posterior).
- *Todas las familias en un único `family=&...&`: rechazado como estrategia única — peor progreso, un fallo arruina la corrida; queda como optimización futura (lotes de ~10).
- *Self-host (subir TTFs al ámbito `fonts`)*: rechazado — rompe el diseño vigente "Google lazy por familia sin extensión" (AGENTS §7) y agrega licenciamiento y operación de datos.
- *Preview solo al clic (estado actual)*: rechazado — con 57 de 72 celdas Google la galería quedaría mayormente en nombres (defecto reportado).

## R5. Geometría de celdas: ratio normalizado + contrato medible de alto

**Decision**: (a) `catalog.js::geometriaTiles` devuelve el ratio **simplificado con MCD** (`180/30 → 6 / 1`) además del actual `w / h`; (b) el tile mantiene `aspect-ratio: var(--tt-gal-ratio)` con los defaults por `data-ambito`, y se agrega un **contrato de aceptación medible**: `tile.clientHeight ≈ round(clientWidth × h/w) ± 2 px` y `canvas` sin recorte, verificado en navegador. (c) Si la medición reproduce el defecto reportado (celda a la mitad, ~15 px en vez de ~30 px), la causa se documenta en `tasks.md` con la medición previa/posterior; las defensas (ratio normalizado + alto verificado por test) se aplican igual.

**Rationale**: el bug reportado ("items miden 180×30 pero se muestran 180×15, cortados") **no se reproduce por análisis estático** con el CSS actual (`aspect-ratio: var(--tt-gal-ratio)` acepta `180 / 30` como `<ratio>` válido y el cálculo da ~29 px), por lo que el plan no asume una causa: fija un **contrato medible** que atrapa cualquier causa (parseo de variable, colapso de alto, cálculo de celda del sprite) y deja el diagnóstico con medición real como paso de verificación. Normalizar el ratio es barato e inocuo.

**Alternatives considered**:
- *Fijar alto en px desde JS*: rechazado — rompe con paneles angostos y revierte la regla única data-driven (006/AGENTS RC37).
- *Quitar `aspect-ratio` y usar canvas con alto intrínseco*: rechazado — las celdas con nombre (placeholder) perderían geometría estable (US4 escenario 2).
- *Cambiar el `minmax` de columnas*: rechazado — fuera de alcance y no explica un corte a la mitad.

## R6. Causa visible: mapeo de errores del motor al estado de la galería

**Decision**: el estado de la galería (`status`) distingue: `motor:sprite:catalogo:desactualizado` (relée inventario y reintenta **una vez**), `motor:sprite:dimensiones:invalidas` (no reintentar: bug de retícula), `motor:sprite:archivo:*` y `motor:sprite:directorio:no_escribible` (no reintentar sin intervención) y caídas de red durante la generación (reintentar en la próxima apertura). Se elimina el mensaje genérico "No se pudo generar la hoja (sin puente o sin catalogo)".

**Rationale**: FR-010/SC-007 exigen operación+ámbito+motivo; el motor ya devuelve mensajes con causa (`handle_request()` → `wp_send_json_error($e->getMessage())`), así que la información existe y solo falta propagarla. El reintento único para `desactualizado` cubre el caso "inventario cambió durante la corrida" sin bucles.

**Alternatives considered**: *Reintentar automáticamente cualquier error*: rechazado — riesgo de bucle ante errores permanentes (permisos, retícula rota).

## R7. Retiro del botón de generación

**Decision**: eliminar el botón "Generar miniaturas" de `fuentes-galeria.js` y el botón "Miniaturas" de `controls.js` (markup en `index.html`, listeners y CSS `.tt-galpanel-gensprite`), dejando el flujo automático con progreso y un **Reintentar** visible solo en estado de error (FR-009).

**Rationale**: decisión explícita del usuario (spec, Clarifications) y coherente con "generación = excepción de estado, no acción de usuario": si lo faltante se genera solo, un segundo camino manual duplica estados y confunde al usuario (¿falta o no?).

**Alternatives considered**: *Conservar auto + botón*: rechazado — duplica vías de generación; *solo botón (estado actual)*: rechazado por la misma decisión.

## R8. Contrato real de ThumbEngine (base de R2/R3)

**Decision**: se toma como fijo del spec 006 sin modificar `assets/miniaturas.js`: (1) `ensureSprite` recibe `firma` y la envía en el `POST` (`miniaturas.js:332-334`); (2) con memoria fría siempre reconstruye desde cero (`construirDesdeCero`), con `render` por item y hueco para items sin render; (3) el manifiesto **no persiste** (solo `thumbs.webp`), de ahí que la posición de celda venga de `catalog.js` (tile = id-1) y no de un JSON.

**Rationale**: el plan solo consume ese contrato; tocar el motor de miniaturas requeriría otro spec (alcance explícito en Assumptions: "sin persistencia de manifiesto").

**Alternatives considered**: modificar `miniaturas.js` para soporte de "solo tiles faltantes": rechazado — sería el camino caro de "parche parcial" (ver R2); la fase F2 reutiliza los canvases ya hechos, que logra lo mismo con un solo `POST`.


