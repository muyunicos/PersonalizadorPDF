# Data Model: campos-consola

**Feature**: 012-campos-consola | **Fecha**: 2026-10-04

Todo lo del admin vive en `uploads/pmu/` (Const. IV). El catalogo de campos **deja de ser un
archivo plano**: se parte en un indice + una carpeta por campo, para poder cachear cada campo por
separado.

## 1. Layout de disco

```
uploads/pmu/
├── campos.json                      INDICE + metadatos (sin HTML/CSS/JS)
└── campos/
    ├── global.css                   CSS global del plugin (UNO)
    ├── global.js                    JS global del plugin (UNO)
    └── {id}/                        una carpeta por campo (id numerico auto)
        ├── datos.json               definicion (nombre, descripcion, flags)
        ├── campo.htm                HTML que ve el cliente
        ├── campo.css                CSS propio (opcional)
        └── campo.js                 JS propio (opcional)
```

`{id}` es el id numerico auto del campo (hueco mas bajo libre; **nunca se reutiliza un id dado de
baja**, igual que hoy en `campo_alta()`).

## 2. `campos.json` (indice)

```json
{
  "version": 2,
  "items": [
    {"id": 55, "plantilla": "imagen", "baja": false},
    {"id": 56, "plantilla": "texto",   "baja": false}
  ],
  "meta": {
    "55": {"creado": "2026-10-04T10:00:00Z", "modificado": 1760000000, "categorias": ["navidad"]},
    "56": {"creado": "2026-09-18T09:12:00Z", "modificado": 1758800000, "categorias": ["datos"]}
  },
  "v1_migrado": 1760000000
}
```

| Clave | Tipo | Regla |
|-------|------|-------|
| `version` | int | `2` en el formato v2; `3` desde la spec 015 (indice con `items[].tipo`, sin categorias); ausente = formato v1 (aun sin migrar) |
| `items[].id` | int | >= 1, unico, nunca reutilizado |
| `items[].plantilla` | string | `""` \| `imagen` \| `select` \| `texto` (de donde nacio). **Obsoleto desde la v3**: ahora es `items[].tipo` (`texto`\|`imagen`\|`opciones`); ver `AGENTS.md` §5 y `specs/012.../contracts/campos.md` (v3) |
| `items[].baja` | bool | `true` = dado de baja **con datos conservados** (reemplaza al tombstone `[id,"",""]`) |
| `meta.{id}.creado` | ISO-8601 | se escribe una vez, no cambia |
| `meta.{id}.modificado` | int (epoch) | cambia en cada escritura del campo; es el `?v=` |
| `meta.{id}.categorias` | string[] | las "etiquetas" del contrato, saneadas (minusculas, `-`, max 32) |
| `v1_migrado` | int | marca de la migracion one-shot (D10) |

**Escritura atomica**: `.tmp` + `rename` (igual que `guardar_campos()` hoy,
`inc/class-pmu-uploads.php:552`). **Lectura tolerante**: si es ilegible, `items=[]` y aviso
`motor:listar:catalogo:invalido:campos` (causa que ya existe y ya se pinta en la consola).

## 3. `campos/{id}/datos.json`

```json
{
  "nombre": "Fotos polaroid cuadradas x6",
  "descripcion": "6 fotos para el tarjetero GX-10",
  "titulo_cliente": "Fotos",
  "texto_ayuda": "Ajusta cada foto a su marco",
  "array": true,
  "protegido": false,
  "cargador": {
    "ranuras": [
      {"etiqueta": "Foto 1", "w": 1000, "h": 1000, "forma": "circle", "min": 1, "max": 6}
    ]
  }
}
```

| Clave | Tipo | Regla |
|-------|------|-------|
| `nombre` | string | <= 200; **nombre corto para el admin**. Vacio = cae a `id` |
| `descripcion` | string | <= 500; solo admin |
| `titulo_cliente` | string | <= 200; carrito/checkout/pedido |
| `texto_ayuda` | string | <= 500; **lo que el admin escribe como instruccion dentro del HTML** (no se inyecta solo) |
| `array` | bool | `true` = `valor` es una lista (un valor por instancia) |
| `protegido` | bool | `true` = **nunca viaja al HTML de la ficha** (FR-040) |
| `cargador` | object\|null | `null` en campos sin imagenes |
| `cargador.ranuras[].etiqueta` | string | texto del boton/ranura para el cliente |
| `cargador.ranuras[].w` / `.h` | int >= 1 | tamano final en px (obligatorio: `selector-pmu.js:35`) |
| `cargador.ranuras[].forma` | enum | `circle` \| `square` \| `rect` (crop) \| `fit` |
| `cargador.ranuras[].min` / `.max` | int >= 1 | min <= max; `max > 1` implica `array` |

**Sintaxis de atajo** que el usuario propuso (se parsea a lo de arriba, opcional):
`size:2000 max:6` · `1_size:1000 1_canvas:circle 2_size:1024x768 2_min:2 2_max:2`

## 4. Archivos de codigo del campo

| Archivo | Contenido | Limite |
|---------|-----------|--------|
| `campo.htm` | el HTML del campo, tal cual se monta | 20 000 |
| `campo.css` | CSS propio, con scope `.pmu-campo-{id}` | 20 000 |
| `campo.js` | `function(ctx, root)`, sandbox de `validar_script_campo()` | 20 000 |

Los limites son los que ya impone `campo_desde_post()` (`personalizador-pdf.php:2161-2167`); se
conservan como `motor:campos:<archivo>:tamano`.

## 5. Montaje en el cliente (ficha)

Se elimina `<p class="pmu-campo-titulo">` (`tienda.js:259-262`). El wrapper pasa a ser:

```html
<div class="pmu-campo pmu-campo-56" data-campo="56">
  <style>@media{...}</style>        <!-- solo campo.css, si existe -->
  {campo.htm}                      <!-- el HTML del admin -->
</div>
```

**Reglas de salida** (en este orden, FR-026):
1. Si el campo tiene `campo.js` -> manda el `script` (con `ctx.set(id,{valor,cliente})`).
2. Sin script: se leen los `[data-rol]` del HTML: `data-rol="valor"` -> `valor`,
   `data-rol="cliente"` -> `cliente` (su `textContent`).
3. Sin ningun `data-rol` -> primer `input/textarea/select` (comportamiento actual).
4. Sin `cliente` en ninguno de los casos anteriores -> **`cliente` queda vacio**. El sistema **no
   traduce nada** (D21): no hay tabla ni `traducir()`. Si el admin quiere `0000FF -> "Azul"`, lo
   escribe en su `global.js`.

## 6. Sesion del comprador: imagenes subidas

```
tmp/sesion-{sid}/{item_key}/
├── manifest.json
├── img/{pdf}-{grupo}-{n}.png      pool de TEXTO renderizado (no se toca)
├── mockup-{id}.webp               vistas congeladas 300x300 (no se toca)
└── subidas/{id}.webp              NUEVO: imagenes que subio el cliente
```

`manifest.subidas[]` (nuevo, hermano de `archivos[]`):

```json
{"id": "9f2c1a7e4b", "file": "9f2c1a7e4b.webp", "mime": "image/webp",
 "w": 1000, "h": 1000, "bytes": 48213, "creado": "2026-10-04T12:00:00Z"}
```

- **Formato WebP** (D14): el sistema ya lo usa y lo acepta (allowlist en
  `personalizador-pdf.php:321`, `:2261`, `:2846`) y el hosting tiene GD 2.3.3 con WebP, que es lo que
  permite al Motor decodificarlo (`engine/Imagen.php:73`). Sin GD, el cargador cae a PNG.
- El `id` lo genera el **servidor** (uuid corto); el cliente nunca manda nombres de archivo.
- La escritura es atomica; `id` unico (colision -> se regenera).
- La URL publica sale de `PMU_Uploads::url_sesion_item()` (ya existe) + `subidas/{id}.webp` (D13).
- Al confirmar el pago la carpeta se mueve con `rename()`: `subidas/` viaja al pedido sin trabajo
  extra (FR-035).

## 7. Del valor del campo al Motor

```
campo "6 fotos" -> valor = ["9f2c1a7e4b", "3b8d5e0a12", ...]
placeholder 0000FF: tipo = "imagen", value = "[campo55]", cont = 6
   -> se resuelven los ids contra manifest.subidas[]        (FR-036)
   -> N ids != cont  => SIN bloqueo: sobrantes vacias      (FR-037', D17/D18/D19)
   -> cada id se rasteriza al tamano exacto del hueco (w x h) y sube al pool
   -> Motor recibe  id => [ruta1, ..., rutaN]               (FR-039)
```

**El pool de grupos sigue siendo texto renderizado**: por eso las subidas del cliente se rasterizan
en el navegador antes de subir (asi el Motor y el mockup reciben la misma imagen).

## 8. Compatibilidad con la v1

La migracion (D10) es **one-shot** y **conserva el `id`**:

| v1 (tupla de 10) | v2 |
|---|---|
| `[id, titulo, tipo, etiquetas, ayuda, visible, contenido, css, script, array]` | ver abajo |
| -> `items[id]` | `{id, plantilla, baja:false}` |
| -> `meta[id]` | `{creado, modificado, categorias: etiquetas}` |
| `titulo` (visible en ficha) | **se descarta**: pasa al `campo.htm` si estaba en el `contenido` |
| `tipo` | se descarta (ya no existe el enum) |
| `ayuda` | `datos.json.texto_ayuda` |
| `visible` | se pierde a proposito (ya no se inyecta titulo) |
| `contenido` | `campo.htm` |
| `css` | `campo.css` |
| `script` | `campo.js` |
| `array` | `datos.json.array` |
| tombstone `[id,"",""]` | `items[id].baja = true` |

Se guarda `campos.json.bak` antes de escribir. Si algo falla, se restaura a mano desde el `.bak`.

## 9. Errores (convencion `motor:<ambito>:<causa>`)

| Causa | Cuando |
|-------|--------|
| `motor:campos:script:invalido` | el `campo.js` rompe el sandbox (ya existe) |
| `motor:campos:contenido:prohibido` / `:sin_id` | el HTML trae `<script>`/`id=""` (ya existe) |
| `motor:campos:<archivo>:tamano` | HTML/CSS/JS > 20 000 (ya existe, con el nombre del archivo) |
| `motor:campos:id:no_reutilizable` | intento de crear con un id dado de baja |
| `motor:campos:duplicar:inexistente` | duplicar un id que no existe |
| `motor:campos:restaurar:inexistente` | restaurar un id que no esta dado de baja |
| `motor:campos:importar:invalido` | el JSON importado no es del formato v2 |
| `motor:campos:importar:id:ocupado` | el lote trae un id ya en uso (rechaza todo) |
| `motor:campos:global:no_escribible` | `uploads/pmu/campos/` no es escribible |
| `motor:subida:id:invalido` | el id enviado no es un uuid corto valido |
| `motor:subida:formato:invalido` | extension/mime fuera de la allowlist (WebP) |
| `motor:subida:tamano` | supera el techo alto por archivo (D15: defensa, no limite de producto) |
| `motor:subida:item:ausente` | el sid/item no coincide con el manifest |

**Causa eliminada por D17/D18/D19**: `motor:campo:imagenes:faltantes` (N ids != `cont` ya **no es
error**: no bloquea, no avisa y no se registra; la instancia vacia queda en el informe normal
`grupos_sin_imagen` del Motor, `Motor.php:68`). Solo se registra si un **id no existe** en
`manifest.subidas[]`, que es un caso distinto (id invalido/manifiesto roto).
