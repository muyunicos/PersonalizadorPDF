# Data Model

**Date**: 2026-09-13 | **Feature**: WooCommerce PDF Personalization
**Actualizado**: 2026-09-15 — Diseno cerrado con admin (sesion de alineacion).

> Decision general: `Motor.php` no cambia. Solo inyecta PNGs ya renderizados
> (`letra => ruta`). Todo JS (value/settings/script) corre solo en navegador
> para preview + render TextMuy / selector-pmu. PHP nunca evalua JS.

## Conciliacion 004 vs 007 (2026-09-15, decision vigente)

> ESTADO 008: el plan de conciliacion vigente es el spec 008 ("Plan de
> conciliacion 004 vs 007", NO es feature implementable directa; norma los
> specs 004 y 007), que adopta: `analisis.json`+`config.json` separados y
> `tmp/sesion-{sid}/` como unidad de render/carrito con preview obligatoria
> (`draft-{uuid}` -> `cart_item_key`). La implementacion futura sigue el
> spec 008 (§0 decisiones normativas, §6 migracion); lo de abajo es el historial.

Este documento convivia con dos verdades: `analisis.json`+`config.json` (secciones
Layout/PDF) y `metadata.json` como unica fuente (contratos 007 vigentes). La decision
vigente, alineada con el codigo ya construido y verificado, es:

- **Unica fuente del producto: `pdfs/{slug}/metadata.json`** (dataset del Detector +
  personalizacion plana `default`/`value`/`preset`/`config` + `activo` en la raiz).
  NO existen `analisis.json` ni `config.json` separados. `Metadata::generar($pdf,
  $grupos, $dpi, $previo)` preserva la personalizacion por `id` al re-analizar (D8).
- **`activo` vive en `metadata.json`** (raiz), no en un config separado. Lo escribe el
  re-analisis (preservado) y lo lee la tienda para decidir si ofrece el PDF.
- **Vinculo PDF<->producto Woo**: `postmeta _pmu_pdf_slug` en el producto (canonico) +
  espejo `metadata.json:productos[]` (solo lectura, informativo). La tienda resuelve
  por postmeta; el admin edita el espejo en la consola y el vinculo en la ficha.
- **Unidad de trabajo del comprador: `tmp/cart/{linea}/`** (clave unica por linea,
  contrato rutas-pmu.md v2 + regla 7). NO existe `tmp/sesion-{sid}/`: la sesion solo
  agrupa lineas para TTL/limpieza, nunca es unidad de render ni de carrito.
- **Pool de imagenes**: `tmp/cart/{linea}/{pdf}/img/c{id}-{hash}.png` con
  `hash = sha1(valor_resuelto + preset + settings + WxH)` (8-10 chars). Un mismo PNG
  sirve a varios PDFs/placeholders via `manifest.json` unico por linea.
- **Preview obligatoria**: el `add-to-cart` se bloquea hasta `preview OK`. Flujo
  `draft-{uuid}` -> `woocommerce_add_to_cart` renombra a `{cart_item_key}` (PHP).
  Editar item = re-render de esa carpeta; borrar item = borrar esa carpeta.
- **`Motor.php` no cambia**: solo inyecta PNGs ya renderizados (`id => ruta`).
  Todo JS (`value`/`settings`/`script`, `V(N)`/`[campoN]`) corre solo en navegador
  (preview + render TextMuy/selector-pmu). PHP nunca evalua JS.

Las secciones Layout/PDF/Placeholder/Item/Sesion de este archivo quedan como
referencia historica del diseno charlado; lo normativo es lo de arriba + los
contratos 007 (`metadata-pdf.md`, `contenido-grupo.md`, `admin-pdfs.md`,
`rutas-pmu.md` v2).

## Layout en disco (uploads/pmu/)

```
uploads/pmu/
  campos.json                      <- catalogo global de campos (id auto)
  pdfs/dia-madre-1/
    dia-madre-1.pdf                <- plantilla subida por admin
    analisis.json                  <- solo Detector, inmutable
    config.json                    <- editable: activo, productos, campos, placeholders
  tmp/muestras/dia-madre-1/        <- preview admin (Procesar muestra), se sobrescribe
    {id}-{idx}.png
    dia-madre-1_muestra.pdf
  tmp/sesion-{sid}/                <- unidad de render/carrito (plan de conciliacion 008)
    {item_key}/                    <- 1 personalizacion (puede llevar N PDFs)
      manifest.json                <- valores + mapa pdf/grupo/inst -> img/
      img/c{id}-{hash}.png         <- pool deduplicado por hash
  orders/{order_id}/
    {item_key}/                    <- copia de tmp/sesion-{sid}/{item_key}/
      manifest.json
      img/*.png
      {pdf}_procesado.pdf          <- PDF final por item+pdf
```

> NOTA 008: este layout con `tmp/sesion-{sid}/` es el plan de conciliacion
> (spec 008, "plan de conciliacion para 004 vs 007"). Contrasta con la decision
> anterior (`tmp/cart/{linea}/` sin nivel sesion); la implementacion futura sigue
> el spec 008.

Reglas:
- `analisis.json` nunca se edita desde la UI. `config.json` nunca pisa el analisis
  (preserva la paridad que valida `Motor::validarDataset()`).
- `manifest.json` es unico por item. No hay un manifest por PDF.
- `hash = sha1(valor_resuelto + preset + settings + WxH)` (8-10 chars). El prefijo
  `c{id}` es solo ayuda visual para debug; la identidad es el hash.
- Preview cliente: `draft-{uuid}` -> al agregar al carrito se renombra en PHP
  (`woocommerce_add_to_cart`) a `{cart_item_key}`. Editar item = re-render de esa
  carpeta. Borrar item (`woocommerce_remove_cart_item`) = borrar esa carpeta.
- Preview admin (`tmp/muestras/`) es otro circuito: se borra y regenera siempre.

## Entities

### PDF (carpeta + analisis + config)

Carpeta: `uploads/pmu/pdfs/{slug}/` con 3 piezas:

| Archivo | Origen | Editable | Descripcion |
|---|---|---|---|
| `{slug}.pdf` | admin upload | no (re-subir) | plantilla |
| `analisis.json` | Detector | no | grupos/instancias/tamanos (paridad Motor) |
| `config.json` | admin UI | si | activo, productos, campos, placeholders |

`config.json`:

```json
{
  "activo": true,
  "productos": [123, 456],
  "campos_ids": [56, 2],
  "placeholders": {
    "a": {"tipo": "texto", "preset": "impacto", "value": "[campo2]", "settings": "[campo56]"}
  }
}
```

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| slug | string | nombre saneado del PDF | `[A-Za-z0-9_-]`, unico |
| activo | bool | visible en productos | Default: false hasta detectar placeholders |
| productos | int[] | IDs WooCommerce (espejo informativo; canonico: postmeta) | Optional, max 100 |
| campos_ids | int[] | campos en orden de UI | FK a campos.json |
| placeholders | object | id hex -> mapeo | Ver Placeholder |
| mockups | object | `mckp.json` | Optional |

**Relationships**:
- ↔ Many WooCommerce Products (many-to-many via `productos`)
- ↔ Many Placeholder Groups (one-to-many, desde `analisis.json`)

**State transitions**:
```
inactivo → activo (tras deteccion + config guardada)
activo → inactivo (switch admin, se conserva config)
```

### Campo (catalogo global reutilizable)

Archivo: `uploads/pmu/campos.json`. Pestana propia. Mismo `id` usable en N PDFs.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| id | int (auto) | Unique identifier | Primary key, nunca se reutiliza |
| titulo_cliente | string | etiqueta visible al cliente | Optional, si vacio el campo se oculta (pero igual evalua) |
| tipo | enum | text/textarea/select/img/override | Required |
| etiquetas | string[] | categorizacion para reutilizar | Optional |
| texto_ayuda | string | tooltip | Optional |
| visible | bool | se pinta en ficha/carrito | Default true; `false` = campo invisible que deriva de otros |
| contenido | string | fragmento HTML con scope | Required; sin `id` globales, solo clases `.pmu-campo-{id}` + `data-rol` |
| css | string | CSS plano con scope | Optional; siempre prefijado `.pmu-campo-{id}`; prohibido `100vh`/layout global |
| script | string | `function(ctx, root)` | Optional; ver Lenguaje unico |

Ejemplo (selector de color, normalizado):

```json
{
  "id": 10,
  "titulo_cliente": "Color",
  "tipo": "override",
  "etiquetas": ["color", "selector"],
  "texto_ayuda": "selector rojo verde azul",
  "visible": true,
  "contenido": "<div class=\"pmu-campo-10\"><h3>Selecciona un color:</h3><div class=\"color-options\"><button type=\"button\" class=\"color-btn\" data-valor=\"fill.color='#ff4757'\" data-cliente=\"Rojo\" style=\"background:#ff4757\" title=\"Rojo\"></button><button type=\"button\" class=\"color-btn\" data-valor=\"fill.color='#2ed573'\" data-cliente=\"Verde\" style=\"background:#2ed573\" title=\"Verde\"></button><button type=\"button\" class=\"color-btn\" data-valor=\"fill.color='#1e90ff'\" data-cliente=\"Azul\" style=\"background:#1e90ff\" title=\"Azul\"></button></div><div class=\"preview-box\"><p>Color: <span data-rol=\"etiqueta\">Ninguno</span></p></div></div>",
  "css": ".pmu-campo-10 .color-btn{width:45px;height:45px;border-radius:50%;border:3px solid transparent;cursor:pointer}.pmu-campo-10 .color-btn.active{border-color:#333}",
  "script": "function(ctx, root){ var estado={valor:\"\",cliente:\"\"}; root.querySelectorAll('.color-btn').forEach(function(b){ b.addEventListener('click', function(){ root.querySelectorAll('.color-btn').forEach(function(x){x.classList.remove('active')}); b.classList.add('active'); estado={valor:b.dataset.valor, cliente:b.dataset.cliente}; root.querySelector('[data-rol=etiqueta]').textContent=estado.cliente; ctx.set(10, estado); }); }); return estado; }"
}
```

Reglas de sandbox (obligatorias):
- `contenido` es fragmento, nunca pagina. Prohibidos `id` fijos (`#preview-box`),
  `document.getElementById`, `DOMContentLoaded`, variables globales (`let campo10`).
- Todo acceso al DOM es via `root` (nodo del campo). `ctx.set(id, {valor, cliente})`
  publica el valor; `ctx.get(id)` / `V(id)` lee otros campos.
- Campos invisibles (`visible:false`) no pintan `contenido`, solo evaluan `script`
  (ej: `campo78 = 'Feliz Cumple ' + V(1)`).
- Orden de evaluacion topologico por dependencias `V(N)`/`[campoN]`. Ciclo = error
  accionable, se bloquea preview.

**Relationships**:
- ↔ Many Placeholders (via `config.json` + expresiones `V(N)`)

### Placeholder (mapeo por grupo de color)

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| letra | string | grupo de color del analisis | FK a analisis.json |
| tipo | enum | texto/imagen | Required |
| preset | string | preset TextMuy (solo texto) | Optional |
| value | string | expresion con `V(N)`/`[campoN]` | Required |
| settings | string | expresion overrides (solo texto) | Optional |

Semantica:
- `V(N)` es oficial, `[campoN]` es alias. Compilan a `valores[N].valor`.
- Ejemplos: `"'Feliz cumple ' + V(1)"`, `"(V(55) || []).concat(['muchas gracias'])"` (no mutar con `push` sobre el valor original: se comparte entre placeholders).
- Si la expresion devuelve array, se hace loop sobre instancias del grupo (`FR-4.3`). Si `N != M` se avisa antes de generar.
- `texto` -> TextMuy renderiza PNG exacto al hueco. `imagen` -> selector-pmu deja la imagen al tamano exacto. Ambos terminan en `img/*.png` del item.

**Relationships**:
- ↩ One PDF (`config.json`)
- ↔ Many Campos (via expresiones)

### Item de personalizacion (unidad de preview/carrito/pedido)

Un item = una personalizacion (no un producto ni una sesion). Si el cliente agrega
3x `dia-madre-1` con distintos nombres, son 3 items con 3 carpetas. Si un producto
lleva 3 PDFs, el item contiene los 3.

`tmp/sesion-{sid}/{item_key}/manifest.json`:

```json
{
  "valores": {"1": {"valor": "Juan", "cliente": "Juan"}},
  "pdfs": {
    "dia-madre-1": {"a": [{"inst": 0, "file": "img/c1-a3f9c2.png", "origen": "V(1)"}]},
    "dia-madre-2": {"b": [{"inst": 0, "file": "img/c1-a3f9c2.png", "origen": "V(1)"}]}
  }
}
```

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| item_key | string | `draft-{uuid}` pre-carrito, `{cart_item_key}` post-carrito (=`{linea}` en `tmp/cart/`) | Required |
| valores | object | id campo -> `{valor, cliente}` | `valor` = sistema, `cliente` = etiqueta |
| pdfs | object | slug pdf -> id hex -> instancias | `file` apunta a `img/` de la linea |
| status | enum | draft/preview_ok/in_cart/ordered/failed | Required |

Flujo: preview obligatoria bloquea `add-to-cart` hasta `preview OK`. Al pagar, la
carpeta del item se copia a `orders/{order_id}/{item_key}/` + `{pdf}_procesado.pdf`.

### Sesion y pedido (paraguas, no unidad de render)

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| sid | string | cookie `pmu_sid` o user_id (solo agrupacion TTL/limpieza) | Required |
| order_id | int | WooCommerce order | FK tras pagar |
| items | string[] | `{cart_item_key}` (=`{linea}` en `tmp/cart/`) de la sesion | Required |

**Validation Rules**
- File uploads: max 10MB, allowed types (png, jpg, webp, gif)
- Text fields: max 2000 chars (configurable per campo)
- Image aspect ratio: enforced when configured

## Contracts

### API: `handle_procesar` (admin_post)

**Request**:
```json
POST /wp-admin/admin-ajax.php?action=personalizador_pdf_procesar
{
  "pdf_id": 42,
  "order_id": 1523,
  "field_data": {
    "56": "Sal, pimienta, orégano",
    "33": null  // Optional image
  },
  "images": {
    "33": "uploads/pmu/tmp/1523/campo33.webp  # temporary → orders/ after completion"
  }
}
```

**Response**:
```json
{
  "success": true,
  "output_url": "https://site.com/uploads/pmu/outputs/1523.pdf",
  "preview_url": "https://site.com/uploads/pmu/previews/1523.webp"
}
```

### API: `selector-pmu` (client-side component)

**Event**: `selector-pmu(id, maxW, maxH, aspectRatio, mode, category)`

**Callbacks**:
- `onSelect(imageUrl, metadata)`
- `onError(message)`

### Event Hooks (WordPress)

| Hook | Type | Parameters |
|------|------|------------|
| `personalizador_pdf_before_generate` | action | `$order_id, $pdf_id, $field_data` |
| `personalizador_pdf_after_generate` | action | `$order_id, $pdf_id, $output_url` |
| `personalizador_pdf_error` | action | `$order_id, $pdf_id, $error` |

## Quickstart Guide

See `quickstart.md` for validation scenarios.