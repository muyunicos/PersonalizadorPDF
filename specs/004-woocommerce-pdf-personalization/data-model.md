# Data Model: Personalización de Productos PDF para WooCommerce

**Feature**: 004-woocommerce-pdf-personalization | **Created**: 2026-09-13 | **Reescrito**: 2026-09-17

Norma: `constitution` §I+§IV (decisiones 2026-09-17). Diseño anterior en
`_archivo-data-model-2026-09-13.md` (historico, derogado).

## Layout en disco (uploads/pmu/, raiz unica)

```text
uploads/pmu/
  campos.json                    <- catalogo global de campos (id auto)
  pdfs/{nombre}/
    {nombre}.pdf                 <- plantilla subida por admin
    analisis.json                <- Detector, INMUTABLE (id/w/h/cont/pgs)
    config.json                  <- editable: activo, productos, campos_ids,
                                    preview_omisible, mockups[], placeholders[id]
    mockups/                     <- fotos del admin para plantillas mockup (datos usuario)
  tmp/muestras/{pdf}/            <- muestras del panel (idempotentes, se sobrescriben)
    {id}.{ext}                   <- un archivo por grupo cargado en la consola
    {pdf}_procesado.pdf
  tmp/sesion-{sid}/              <- sesion del comprador (UUID propio, cookie 30 dias)
    draft-{uuid}/                <- antes de agregar al carrito
      manifest.json
      img/{pdf}-{id}-{n}.png     <- pool DEDICADO al item (sin dedup global)
      mockup-{id}.webp           <- congelados 300x300 (prueba del visto bueno)
    {cart_item_key}/             <- misma carpeta, renombrada al agregar
  tmp/orders/{order_id}/         <- staging (copia del item al crearse el pedido)
    {item_key}/ ...
  orders/{order_id}/{item_key}/  <- entregable (rename solo al confirmarse el pago)
    manifest.json
    img/*.png
    mockup-*.webp
    {pdf}_procesado.pdf          <- un PDF final por PDF del item
```

Reglas:
- `analisis.json` nunca se edita desde la UI; `config.json` nunca lo pisa (paridad del Motor).
- El `sid` NO cambia en todo el ciclo: el item se mueve, nunca se copia ni se duplica.
- El pool es por item (dos items con mismo PDF/grupo/placeholder no comparten archivos).
- El Motor lee `manifest.archivos[]` (indice explicito): nunca adivina por nombre.

## Entidades

### PDF (producto)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| nombre | string | identificador del producto (base saneada) | `[a-z0-9_-]`, unico, no vacio |
| archivo | string | `{nombre}.pdf` dentro de su carpeta | `.pdf`, dentro del limite del servidor |
| analisis | string | `pdfs/{nombre}/analisis.json` (solo Detector) | inmutable, escrito por `Metadata::generarAnalisis` |
| config | string | `pdfs/{nombre}/config.json` (editable) | escrito por `PMU_Uploads::guardar_config` |
| grupos | Grupo[] | derivados del analisis | ver Grupo |
| mockups | Mockup[] | plantillas de preview (`mockups[]`) | ver Mockup |
| preview_omisible | bool | omite el visto bueno (default `false`) | visible solo con mockups creados |
| total_paginas | int | paginas del PDF analizado | > 0 |

**Estados**: sin analizar (carpeta con PDF sin `analisis.json`) -> analizado -> borrado
(carpeta eliminada + `tmp/muestras/{nombre}/`; nunca `orders/` ni sesiones ajenas).

**Transiciones**: subir -> analizar/re-analizar (preserva `config.json` de los grupos que
siguen existiendo) -> borrar. Sobrescribir un nombre regenera `analisis.json` y conserva
`config.json`.

### Grupo (placeholder)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| id | string | clave del grupo = color hex sin `#` (`0000FF`) | `^[0-9A-F]{6}$`; usado en archivos, URLs, formularios y puente |
| w, h | int | tamano base en px (base 200 ppp) | >= 10x5 pt equivalentes |
| cont | int | instancias del grupo | >= 1 (valida el Motor) |
| pgs | int[] | paginas (0-based) donde aparece | indices validos (informativo/UI) |

Grupo NO define comportamiento: el render del hueco lo deciden los campos mapeados
(`placeholders[id]`), inclusivo el tratamiento de arrays (loop por instancias).

### Configuracion por grupo (`config.json:placeholders[id]`)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| tipo | enum | `texto` \| `imagen` | requerido si el grupo participa |
| preset | string/null | slug de preset TextMuy (solo tipo texto) | debe existir en `tm-presets/` al renderizar |
| value | string/null | plantilla (`[campoN]` referencia; literal sin corchetes; `\[` escapa) | saneado; vacio = hueco intacto |
| settings | string/null | overrides del preset (mismo lenguaje de plantilla) | saneado |
| repetir | bool | checkbox `[v] Repetir por placeholder` (por campo/codigo): si el resultado es array, un valor por instancia en loop; si no, el mismo valor en todas | default `true` para arrays |

### Campo (catalogo global reutilizable)

Archivo: `uploads/pmu/campos.json`. Mismo `id` usable en N PDFs. **Sin miniaturas**: los
campos se reconocen por su `id` numeral (no hay sprite/thumbs para este catalogo).

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| id | int (auto) | identificador unico | nunca se reutiliza (hueco mas bajo o max+1) |
| titulo_cliente | string | etiqueta visible al cliente | vacio = campo oculto (pero evalua) |
| tipo | enum | `texto` \| `imagen` \| `override` | requerido |
| etiquetas | string[] | categorizacion para reutilizar | opcional |
| texto_ayuda | string | ayuda breve en ficha | opcional |
| visible | bool | se pinta en ficha/carrito | default true |
| contenido | string | fragmento HTML con scope (`.pmu-campo-{id}`, `data-rol`) | sin `id` globales ni `document.getElementById` |
| css | string | CSS plano con scope | prefijado `.pmu-campo-{id}` |
| script | string | `function(ctx, root)` sandbox | via `root`, `ctx.set(id, {valor, cliente})` |
| array | bool | el campo entrega array (un valor por instancia) | default `false` = valor unico |

Valor dual obligatorio: `valor` (sistema, lo consume el Motor) + `cliente` (etiqueta que se
muestra en ficha/carrito/pedido). Detalle en `contracts/campos.md`.

### Mockup (plantilla de vista previa)

`config.json:mockups[]` (N por PDF, sin limite):

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| id | string | identificador del mockup | `[a-z0-9_-]+`, unico por PDF |
| titulo | string | etiqueta de la vista (opcional) | — |
| capas | Capa[] | composicion ordenada (indice = z-order) | >= 1 |
| creado | string | ISO-8601 UTC | informativo |

**Capa**:

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| tipo | enum | `img` \| `placeholder` | requerido |
| ref | string | `img` → id del catalogo `img/` o `mockups/{archivo}`; `placeholder` → `{grupo_id}` o `{grupo_id}#{indice}` | debe existir |
| x, y | int | posicion en el canvas 300x300 (px) | 0..300 |
| w, h | int | tamano (px) | > 0 (contiene el hueco sin deformar) |
| rot | number | rotacion en grados | -360..360 |
| sesgo | number | inclinacion/perspectiva (skew) | -1..1 |
| filtros | object | brillo/gama/contraste/saturacion (solo mockup) | 0..200 % |

Los filtros aplican SOLO al mockup: el PNG del pool y el PDF final van limpios.
### Item (unidad de preview/carrito/pedido)

Un item = una personalizacion (no un producto ni una sesion). Cantidad fija 1: cada item es
un diseño unico (agregar dos veces = dos items con distinto `item_key`). Un producto con N
PDFs sigue siendo 1 item con N PDFs.

`tmp/sesion-{sid}/{item_key}/manifest.json`:

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| item_key | string | `draft-{uuid}` antes del carrito; `{cart_item_key}` despues | requerido |
| sid | string | UUID PMU de la visita (cookie `pmu_sid`, 30 dias) | requerido |
| pdfs | string[] | PDFs incluidos (1..N) | deben existir y estar activos |
| valores | object | id campo → `{valor, cliente}` | `valor` = sistema, `cliente` = etiqueta |
| archivos | object[] | indice `{pdf, grupo_id, indice, file}` | `file` relativo al pool del item |
| mockup_vistas | string[] | ids de mockup generados | validos contra `config.json:mockups[]` |
| mockup_visto | string | id del mockup visible al agregar (trazabilidad) | requerido si `preview_estado=ok` |
| preview_estado | enum | `ok` \| `sin_vista` \| `omisible` | requerido antes del `add-to-cart` |
| creado | string | ISO-8601 UTC (base del TTL) | requerido |
| motor | string | version del motor que genero el pool | informativo |

Nomenclatura del pool: `img/{pdf}-{id}-{n}.png`.
- `{pdf}` = nombre saneado del PDF; `{id}` = grupo (hex); `{n}` = 1..N.
- Un grupo puede necesitar varios PNGs (arrays/instancias repetidas): se numeran.
- Cada PNG lleva su fila en `manifest.archivos[]`; falta de archivo ⇒ item `sin_vista` (el
  estado no cambia, la causa parcial queda anotada en el manifest/meta para el admin).

`mockup-{mockup_id}.webp`: 300x300, congelados al agregar (todos los mockups generados).
Prueba del visto bueno para el admin; viven con el pedido.

### Evento de vista previa (ficha → sesion)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| accion | enum | `generar_preview` (crea draft si no existe) |
| sid | string | cookie `pmu_sid` (se emite si falta) |
| item_key | string | `draft-{uuid}` enviado/devuelto por la ficha |
| valores | object | id campo → `{valor, cliente}` |
| pdfs | string[] | PDFs del producto |

Regeneracion parcial: el cliente re-renderiza solo los campos cuyo hash
(`sha1(valor + preset + settings + WxH)`) cambio; el resto reusa el pool existente.

### Pedido (order WooCommerce)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| order_id | int | pedido WooCommerce | > 0 |
| item_key | string | linea de pedido | requerido |
| carpeta | string | `orders/{order_id}/{item_key}/` | la crea la promocion por `rename()` |
| pdfs | string[] | PDFs del item | coincide con `manifest.pdfs` |
| resultados | object[] | `{pdf, archivo}` de `{pdf}_procesado.pdf` | 1 por PDF del item |
| generado | bool | PDF final ya emitido | false hasta que el cliente/admin descarga |

Staging: `tmp/orders/{order_id}/{item_key}/` (copia al crearse el pedido; rename al
confirmarse el pago, flag `.promocionando` si el rename queda a medias).

### Registro admin "completados"

Vista de solo lectura sobre `orders/` + meta de los items:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| order_id, item_key | int, string | identifican la linea |
| preview_estado | enum | `ok` \| `sin_vista` \| `omisible` (filtro principal) |
| webp | string[] | rutas de `mockup-*.webp` congelados |
| valores | object | valores del cliente (lectura) |
| acciones | enum[] | `regenerar` (re-render del pool + PDF) |

## Relaciones

- PDF 1..N Grupo (los grupos viven en `analisis.json`).
- PDF 1..N Mockup (en `config.json`); Mockup 1..N Capa.
- Campo 1..N `placeholders[id]` (via plantillas `[campoN]`).
- Item 1..N PDF (pool dedicado + indice en `manifest.archivos[]`).
- Sesion 1..N Item (`tmp/sesion-{sid}/`; el sid agrupa, el item separa).
- Pedido 1..N Item confirmado (`orders/{order_id}/{item_key}/`).

## Reglas de validacion transversales

- **V-1 (nombres)**: `nombre_seguro()` / `Metadata::nombreDesdeArchivo()` para PDF, `sid` y
  `item_key` (minusculas, `[a-z0-9_-]`, sin `/`).
- **V-2 (un grupo, N aplicaciones)**: el pool puede tener varios PNGs del mismo grupo
  (numerados), pero cada fila de `manifest.archivos[]` referencia exactamente uno.
- **V-3 (rutas)**: ninguna ruta se arma fuera de `PMU_Uploads`; `PMU_Sesion` opera sobre las
  rutas que este le entrega.
- **V-4 (escritura)**: JSON y manifest con `.tmp` + `rename`; lectura tolerante (aviso, sin
  fatal).
- **V-5 (personalizacion)**: se valida antes de persistir (texto saneado y limitado, preset
  existente, ids presentes en el dataset).
- **V-6 (limpieza)**: borrar item = borrado quirurgico de su carpeta; TTL individual
  (drafts 24h); `orders/` nunca se toca automaticamente.
- **V-7 (venta nunca bloqueada)**: si el render falla, `preview_estado=sin_vista` y la
  compra se habilita; el admin lo resuelve despues.

## Ejemplos completos

`pdfs/dia-madre-1/config.json` (fragmento):

```json
{
  "activo": true,
  "productos": [123, 456],
  "campos_ids": [1, 56],
  "preview_omisible": false,
  "placeholders": {
    "0000FF": {"tipo": "texto", "preset": "neon-glow", "value": "[campo1]", "settings": ""}
  },
  "mockups": [
    {
      "id": "fiesta",
      "titulo": "Fiesta",
      "capas": [
        {"tipo": "img", "ref": "fondo-fiesta", "x": 0, "y": 0, "w": 300, "h": 300,
         "rot": 0, "sesgo": 0, "filtros": {"brillo": 95, "contraste": 110}},
        {"tipo": "placeholder", "ref": "0000FF#0", "x": 96, "y": 60, "w": 110, "h": 180,
         "rot": -3, "sesgo": 0.05, "filtros": {}},
        {"tipo": "img", "ref": "marco-madera", "x": 90, "y": 54, "w": 122, "h": 192,
         "rot": -3, "sesgo": 0.05, "filtros": {}}
      ]
    }
  ]
}
```

`tmp/sesion-8f2a/draft-3c91/manifest.json` (fragmento):

```json
{
  "item_key": "draft-3c91",
  "sid": "8f2a",
  "pdfs": ["dia-madre-1"],
  "valores": {"1": {"valor": "Abuela Ana", "cliente": "Abuela Ana"}},
  "archivos": [
    {"pdf": "dia-madre-1", "grupo_id": "0000FF", "indice": 0,
     "file": "img/dia-madre-1-0000FF-1.png"}
  ],
  "mockup_vistas": ["fiesta"],
  "mockup_visto": "fiesta",
  "preview_estado": "ok",
  "creado": "2026-09-17T14:02:11Z",
  "motor": "4.1.0"
}
```

| settings | string/null | overrides del preset (mismo lenguaje de plantilla) | saneado |