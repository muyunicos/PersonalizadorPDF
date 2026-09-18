# Research: galeria-textmuy

**Feature**: 007-galeria-textmuy | **Fecha**: 2026-09-17

Auditoria de la galeria de imagenes (RC34) y de la galeria de fuentes (RC35/RC36),
con la decision de centralizar la invalidacion post-mutacion. Canonico tecnico:
`modules/textmuy/AGENTS.md` (§4 contrato, §7 decisiones, §9 pruebas); este archivo
solo registra el por que de cada arreglo.

---

## R1. Hoja canonica de imagenes: ciclo de vida tras una mutacion

**Decision**: la hoja `thumbs.webp` del ambito `img` vuelve a `'pendiente'` en la
vista (`invalidarSpriteVista` en `galeria.js`) y el catalogo en memoria se descarta
(`TextMuyAPI.invalidarCatalogo`, exportado en RC34 y llamado por
`PresetManager.invalidarSprite`). La proxima apertura regenera la hoja UNA vez
(`reconstruirSpriteCanonico` -> `op=sprite` con firma) en vez de descargar los
originales el resto de la sesion.

**Rationale**: `invalidarSpriteCanonico` vaciaba `canonCache`, pero el estado de la
vista quedaba latcheado en `'lista'`: `drawTileCanonico` devolvia `null` y cada
ficha caia al `<img>` del original. Ademas, con el catalogo viejo en memoria la
regeneracion se rechazaba en el motor (`motor:sprite:catalogo:desactualizado`)
porque la `firma` enviada se calculaba con tuplas viejas, y un renombre dejaba la
preview resolvendo el nombre anterior (404) hasta Ctrl+F5.

**Consecuencia**: el contador "N libres, M invalidas" del catalogo ahora vive en
`avisoEstado` y `rfFooter` lo repone (antes `render()` lo pisaba con
"Selecciona un elemento").

## R2. Galerias de fuentes: manifest por STRING, baja real vs. unregister

**Decision** (RC35):
- El manifiesto del sprite `fonts` se indexa por nombre STRING; los ids del
  catalogo son numeros: sin `String(slug)` el lookup de tile fallaba siempre y
  toda ficha del catalogo caia al preview renderizado.
- `deleteCustomFont` (op=baja real; el motor hace unlink + tombstone) es
  `Promise<boolean>` y conserva la entrada local si el motor rechaza.
- `unregisterCustomFont` quita SOLO en memoria: el renombre/movimiento
  (`moverFuente`, op=editar) ya resolvio el fisico en el motor; mandar una baja
  extra BORRABA el archivo recien conservado (bug de perdida de datos).
- Dedupe registry vs catalogo por archivo fisico: una fuente subida en la sesion
  salia DOS veces (registry + catalogo) y ocupaba dos tiles en la hoja.

## R3. Un solo coordinador de invalidacion (RC36)

**Decision**: `PresetManager.invalidarSprite(ambito)` (async) es el UNICO punto:
ThumbEngine + API (sprite canonico y catalogo), evento
`textmuy:sprite-invalidado` para que las vistas descarten su hoja local, y para
`fonts` relectura del catalogo antes de resolver. Las 6 mutaciones
(`uploadImage`, `deleteImage`, `moverImagen`, `savePreset`, `deletePreset`,
`moverFuente`) hacen `await`; los handlers de galerias no invalidan a mano.

**Rationale**: la misma clase de bug aparecio dos veces (RC34 imagenes, RC35
fuentes) porque cada galeria invalidaba caches por su cuenta, con orden distinto
y a veces omitiendo pasos. El coordinador unico mas el evento eliminan la
posibilidad de olvidarlo en una galeria futura.

**Anti-carreras**: cada hoja local lleva un token de version (`spriteVersionImg`,
`fuentesSpriteVersion`, `presetSpriteVersion`); una respuesta en vuelo de una
mutacion anterior se descarta al llegar en vez de restaurar una hoja vieja.
El evento NO serializa escrituras `op=sprite` en el servidor (limitacion
declarada, ver Limitaciones).

## R4. Resolucion id->URL con una sola fuente

**Decision**: `galeria.js::srcVista` delega en `TextMuyAPI.urlDeImgRef` (que ya
era declarada "fuente unica" por `controls.js`); `imgUrl` queda solo para mapear
el `file` crudo de `itemsGaleriaImg` al armar items. El armado/filtrado de items
de imagenes vive como funcion PURA en `catalog.js::itemsGaleriaImg` (testeable en
Node): catalogo primario + inventario del puente, dedupe identidad = id, filtro
por tab (tres tabs fijas, primera categoria) y contador de invalidas.

**Alternatives considered**:
- *Tabs dinamicas desde el catalogo (como fuentes)*: diferida; cambia UX visible
  y el criterio de primera categoria (`categorias[0]`) deja imagenes con cats
  libres inalcanzables. Documentado, no resuelto de contrabando.
- *Migrar fonts/tm-presets al lector canonico por id con `sprite_firma`*:
  diferido; requiere que el motor certifique esos ambitos (solo `img` lo hace).

## R5. Estrategia de pruebas y su limite real

**Decision**: 14 suites Node (4 nuevas: `galeria-items`, `invalidacion` (orden
exacto de invalidacion), `sprite-canonico` (firma/reticula/cache/tile=id-1),
`rc-bump` (mismo `?v=RCn` en ambos HTML + CSS + AGENTS)) y una prueba opcional de
navegador `tests/galerias.browser.js` (Chrome + Playwright del host, variable
`TEXTMUY_CHROME`): DOM real con puente/motor/miniaturas simulados; verifica subida
desde la UI (1 evento, catalogo releido, cero peticiones inesperadas), baja
rechazada conserva el registro y `unregisterCustomFont` no manda `op=baja`.

**Limitaciones declaradas** (no ocultar al reportar):
- La prueba de navegador corre con servidor simulado: NO valida WordPress
  (nonces reales, permisos, disco). Este checkout no tiene WP local, `wp-env`
  ni Docker; el unico PHP disponible es CLI (`php tests/motor_smoke.php` OK).
- `node --check` corrobora sintaxis, no semantica runtime.
- `op=sprite` concurrente: la ultima escritura gana en el servidor; los tokens
  de version solo protegen las vistas.

## R6. Higiene aplicada

- CSS: `.tt-galpanel-list` duplicado (flex + grid) consolidado en el grid;
  `.tt-galpanel-head` muerto eliminado (0 usos en JS).
- `accept` del input de la galeria de imagenes: allowlist real del motor
  (`.png,.jpg,.jpeg,.webp,.svg`) en vez de `image/*` (que ofrece formatos que
  el motor rechaza con `motor:alta:archivo:formato`).
