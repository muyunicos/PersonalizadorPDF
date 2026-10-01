# Data Model: galerias-sprite-unificado

**Phase 1 output** — entidades, reglas de validación y transiciones. Fuentes: spec 006 (`data-model.md`, `contracts/catalog-schema.md`), `inc/class-pmu-uploads.php`, `modules/textmuy/js/catalog.js`.

## Entidades

### Ámbito de galería

| Campo | Valores |
|---|---|
| `ambito` | `fonts` \| `img` \| `tm-presets` (alias `presets` normalizado a `tm-presets` en el cliente) |
| Directorio | `uploads/pmu/{ambito}/` |
| Inventario | `fonts.json` \| `img.json` \| `presets.json` |
| Hoja | `thumbs.webp` (exactamente uno por ámbito) |
| Retícula por defecto | fonts 180×30 c4 · img 100×100 c8 · tm-presets 200×100 c4 (manda el inventario) |

Validación: `ambito` debe pertenecer a `AMBITOS_GALERIA`; sin inventario el motor lo siembra vacío (aviso no bloqueante).

### Inventario (catálogo JSON)

```json
{ "thumbs": { "w": 180, "h": 30, "c": 4, "sprite_firma": "[...]" },
  "items": [ [id, title, cats, file], ... ] }
```

- `id`: entero ≥ 1, único, denso desde 1 (hueco = tombstone `[id,"","",""]`).
- `title`, `cats`, `file`: strings; `file` con extensión = físico; sin extensión = Google (solo `fonts`).
- `thumbs.sprite_firma`: ausente o vacío = hoja NO certificada.
- Escritura: solo el motor, atómica (`.tmp` + `rename`).

### Firma de hoja

- Formato: cadena JSON `JSON.stringify([w, h, c, items])` donde `w,h,c` son los `thumbs` del inventario e `items` son las tuplas crudas tal cual están en disco.
- Generada por `catalog.js::firmaCatalogo` (cliente) y comparada con `json_decode($firma)` en el motor — contrato compartido verificado por `tests/catalog-unified.test.js`.
- Reglas: igualdad exacta de estructura (no de texto); se recalcula en cada lectura; **una sola copia por ámbito** (la del inventario).

### Hoja de miniaturas (`thumbs.webp`)

| Regla | Valor |
|---|---|
| Dimensiones exigidas | ancho = `c × w`; alto = `ceil(max(1, maxId) / c) × h` |
| Tamaño máximo | `SPRITE_MAX_BYTES` = 4 MB (`PMU_Galeria`) |
| Formato | WEBP por firma binaria `RIFF…WEBP` (`es_webp`) |
| Certificación | `inventario.thumbs.sprite_firma === firma(inventario)` |
| Posición de celda | derivada: `col = (id-1) % c`, `fila = floor((id-1) / c)`; sin manifiesto persistido |

### Celda

| Campo | Regla |
|---|---|
| Identidad | `id` del elemento (celda = `id-1`) |
| Estados | `dibujada` (miniatura real) · `pendiente` (muestra el nombre) · `no aplicable` (tombstone o `id > maxId`: no participa) |
| Contenido de dibujo | imagen: original con pad · física: FontFace del archivo · Google: familia por nombre · preset: render del `.txm` |
| Transición | `pendiente → dibujada` solo si F1 la dibujó sin fallo; nunca `dibujada → pendiente` dentro de una corrida |

## Máquinas de estado

### Estado de hoja por ámbito (servidor + cliente)

```
[inventario vacío/sin hoja]
        │ apertura → F1 (generar huecos)
        ▼
   PENDIENTE ──fallo>0──► FALLIDA ──(reintento manual o próxima apertura)──► PENDIENTE
        │ F1 ok → F2: POST op=sprite + firma
        ▼
   CERTIFICADA ◄──(motor valida firma+dims y escribe thumbs.sprite_firma)
        │ alta / baja / editar → guardar_catalogo invalida firma (3 ámbitos)
        ▼
   INCERTIFICADA (≡ PENDIENTE)
```

- Solo el motor transiciona `→ CERTIFICADA`; solo el motor transiciona `→ INCERTIFICADA`.
- F2 se ejecuta únicamente desde `PENDIENTE` con `faltantes ≠ ∅` y `fallos = ∅`.

### Estado de generación (cliente, por ámbito, en memoria)

```js
generando = { [ambito]: Promise }   // reentrancia: la segunda llamada espera a la primera
// F1: pendientes[], dibujados[{id, canvas}], fallos[{id, motivo}]
// F2: 1 POST; finally → delete generando[ambito]
```

- `fallos > 0` ⇒ no se llama F2; el estado se conserva para la próxima apertura.
- Dos pestañas/galerías: misma regla por ámbito desde cada documento (el servidor no serializa; R3).

### Estado de carga de una familia Google (preview)

- Mapa `familia → cargando | ok | error`, **aislado** de `loadedFonts`/`loadingPromises` del render.
- Transiciones: `ok → cargando` nunca (ya cargada, sin red); `error → cargando` solo con reintento (1×); el render con spec completo usa su propio mapa.
- Invariante: un preview `ok` con nombre de familia **no** autoriza al render a omitir la carga del spec completo.

### Estado de UI de la galería

| Estado | Dispara | Muestra |
|---|---|---|
| `listando` | apertura | celdas con nombre (placeholders) + progreso `N/M` si hay faltantes |
| `listo` | hoja certificada o F2 ok | miniaturas; cero descargas de contenido |
| `error` | F2 con fallos o motor rechaza | motivo exacto + botón **Reintentar**; celdas pendientes visibles |
## Relaciones y reglas cruzadas

- `Ámbito 1 — 1 Inventario` · `Ámbito 1 — 1 Hoja` · `Inventario 1 — 1 Firma` (deriva de su contenido).
- `Inventario N — N Celdas` por derivación: cada `item[id]` con `id ≤ maxId` y no tombstone ⇒ una celda; cada celda ⇒ un `Elemento de galería`.
- `Elemento de galería 1 — 0..1 Hoja-celda-dibujada` (mientras la celda esté pendiente, el elemento NO se vuelve a descargar en aperturas posteriores salvo regeneración).

Reglas de validación cruzadas:

1. **Concurrencia inventario↔hoja**: la hoja solo es usable si `sprite_firma` coincide con la firma recién calculada del inventario **en disco** (lectura `no-store`); si el inventario cambia entre F1 y F2, el motor responde `desactualizado` y se relée (un reintento, sin bucle).
2. **Concurrencia de escritura**: F2 solo emite `op=sprite` si `generando[ambito]` no estaba ocupada (mapa del cliente); nunca 2 `POST` del mismo ámbito en vuelo (SC-009).
3. **Celdas inaplicables** (tombstone, `id > maxId`) jamás entran a F1 ni cuentan en el progreso `N/M`.
4. **Google**: una familia preview `ok` no habilita al render a saltarse su `loadFont` con spec completo (aislamiento de mapas).
5. **Prohibición de parcialidad**: cualquier fallo de F1 anula F2; la única hoja persistida es completa para el inventario que la certifica.



