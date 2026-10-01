# Contract: lectura y generación de hojas (cliente de galerías)

**Owner**: módulo `modules/textmuy/` — núcleo en `js/api.js`; consumidores: `js/galeria.js`, `js/fuentes-galeria.js`, `js/controls.js`.
**Contratos de partida**: `motor-sprite.md` (escritura), spec 006 `contracts/catalog-schema.md` (inventarios), AGENTS.md §4 (puente).

## Entradas

| Entrada | Origen | Regla |
|---|---|---|
| Inventario | `GET {base}{archivo}` con `cache: no-store` (bases por puente: `fuentesBase`/`imagenesBase`/`presetsBase`) | una petición por recurso, cacheada en sesión |
| Hoja | `GET {base}/thumbs.webp` con `cache: no-cache` y credenciales | solo si `inventario.sprite_firma === firma(inventario)` y dimensiones exactas |
| Escritura | `POST op=sprite` con `firma` | solo vía F2 (ver abajo) |

Alias: `presets` ⇒ `tm-presets` en toda la API interna (una sola cache por recurso, ya vigente).

## Estados de apertura (idénticos en las 3 galerías)

| Estado | Condición | Salida |
|---|---|---|
| `listo` | hoja certificada y dimensiones exactas | miniaturas por celda (`drawTileCanonico(ambito, id)`); **0 descargas de contenido** |
| `listando` | sin hoja certificada o con celdas faltantes | celdas con nombre + progreso `N/M`; ejecuta F1 → F2 |
| `error` | F2 con fallos o motor rechaza | motivo exacto + **Reintentar**; celdas pendientes permanecen como nombre |

## Invariantes (SC)

1. **I1** — Apertura con hoja certificada: 0 `FontFace`, 0 `<link>` de Google, 0 originales; solo inventario + hoja.
2. **I2** — Exactamente 1 escritura `op=sprite` por ámbito y apertura, y solo si `fallos = 0`.
3. **I3** — Nunca persiste una hoja con celdas sin dibujar; sin excepciones ni degradación silenciosa.
4. **I4** — Reentrancia: `generando[ambito]` compartida; la segunda llamada espera a la primera.
5. **I5** — Descarga por elemento: F1 solo toca la fuente del elemento faltante (1 archivo/imagen/preset), nunca el conjunto cuando faltan pocos.
6. **I6** — Errores con causa: operación + ámbito + motivo (sin mensajes genéricos).

## F1 — pre-dibujado de faltantes (en memoria)

Por cada celda `pendiente` (excluye tombstones y `id > maxId`):

| Tipo | Acción | Coste máximo |
|---|---|---|
| imagen | `GET` del original + encajado con `pad` | 1 request por celda |
| tipografía física | `FontFace(url(...)).load()` + `document.fonts.add` | 1 archivo por celda |
| familia Google | 1 petición `css2?family={Nombre}` **sin pesos** y **sin `text=`** + `document.fonts.load('16px "{Nombre}"', texto)`; concurrencia ≤ 4, espera 3 s, 1 reintento | ~25-50 KB por familia |
| preset | render del `.txm` (carga su fuente) | 1 fuente por preset |

Reglas Google: estado de preview **aislado** de `loadedFonts`/`loadingPromises` del render (un preview cargado no libera la carga del spec completo); texto = nombre del elemento (misma cadena de hoy); si la familia ya está en `document.fonts`, sin red.

## F2 — persistencia única

`ThumbEngine.ensureSprite({scope, items(del inventario), ancho/alto/columnas(del inventario), firma, render: devuelve los canvases ya hechos})` → `POST op=sprite` → reléer inventario (certificación) → repintado. Si `fallos > 0`: F2 no corre.

## Geometría (US4)

- `catalog.js::geometriaTiles(thumbs)` ⇒ `--tt-gal-ratio` (**ratio simplificado con MCD**) y `--tt-gal-col`, con defaults por `data-ambito` en `style.css` (fonts 6/1 · img 1/1 · presets 2/1).
- Contrato medible: `tile.clientHeight ≈ round(clientWidth × h / w) ± 2 px` y canvas sin recorte (placeholder y miniatura con la misma geometría).
- Tipografías: 2 columnas de ~175 px en panel de ~380 px.

## UI de estado

- Progreso: `Completando miniaturas: N/M restantes…` mientras F1.
- Éxito: `Miniaturas listas.` (vuelve a I1 en la próxima apertura).
- Error: mensaje exacto del motor o de red + botón **Reintentar**.
- **Retirados**: botón "Generar miniaturas" (`fuentes-galeria.js`) y botón "Miniaturas" (`controls.js`), con su markup/CSS asociado.

## Compatibilidad con lo vigente

- La lectura canónica (`ensureSpriteCanonico` + `drawTileCanonico`), la invalidación coordinada (`PresetManager.invalidarSprite`) y el evento `textmuy:sprite-invalidado` se conservan sin cambios de firma pública.
- `renderFontPreview(item, w, h, {cargar:false})` sigue existiendo para placeholders sin red.
