# Contrato: Esquema de catálogo y sprite (align-textmuy-motor)

**Fecha**: 2026-09-14 | **Feature**: 006-align-textmuy-motor

Formato único de inventario por ámbito y disposición de su sprite. Un solo formato vigente: no se admiten variantes anteriores.

## Archivo de catálogo

Ubicación: `uploads/pmu/<scope>/<nombre>.json`, con nombre explícito por ámbito:

| Ámbito | Archivo |
|---|---|
| `fonts` | `fonts.json` |
| `img` | `img.json` |
| `tm-presets` | `presets.json` |

## Estructura

```json
{
  "thumbs": { "w": 180, "h": 30, "c": 4 },
  "items": [
    [1, "Titulo legible", "categoria", "archivo.ext"],
    [2, "Otra entrada", ["a", "b"], "otro.ext"],
    [3, "", "", ""]
  ]
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `thumbs.w` / `thumbs.h` | entero | Tamaño de celda del sprite del ámbito |
| `thumbs.c` | entero | Columnas del mosaico |
| `items[i][0]` | entero | `id` numérico denso desde 1; posición del sprite = `id-1` |
| `items[i][1]` | string | Título legible y editable |
| `items[i][2]` | string o lista | Una categoría = string; varias = lista; vacío ⇒ `custom` (el parser normaliza a lista) |
| `items[i][3]` | string | Nombre físico con extensión, o familia remota sin extensión (solo `fonts`) |

## Entrada libre (baja)

`[id, "", "", ""]`: todo vacío salvo el identificador. No se muestra y su celda del sprite queda libre.

## Disposición del sprite

- Archivo: `thumbs.webp`, uno por ámbito, junto a su catálogo.
- Filas: `ceil(maxId / c)`.
- Celda de un recurso: `col = (id-1) % c`, `fila = floor((id-1)/c)`, `x = col*w`, `y = fila*h`.
- Prohibido: un manifiesto por celda, un archivo suelto por recurso o varios sprites por ámbito.

## Clasificación de entradas

| Clase | Condición | En galería | En render |
|---|---|---|---|
| `ok` | Tupla de 4 con `id` numérico y `file` presente | Se muestra | Se usa |
| `free` | Tupla de 4 con todo vacío salvo `id` | No se muestra | Si un estilo la referencia, se rechaza |
| `invalid` | Cualquier otra forma (objetos, tuplas cortas, referencias por nombre, categorías con separadores) | Se salta con aviso y contador visible | Se rechaza con causa `ambito:id:motivo` |

## Reglas de escritura

- Solo el motor escribe catálogos y sprites.
- Alta: reutiliza el hueco más bajo antes de anexar `maxId+1`.
- Baja: vacía la entrada conservando el `id` (sin reindexar) y elimina el archivo físico.
- Edición: renombra el archivo físico si cambió el nombre y actualiza la entrada.
- El inventario nunca describe archivos que no existen ni omite archivos presentes.

## Ejemplo real vigente

`uploads/pmu/tm-presets/presets.json` declara `thumbs` `200x100 c=4` y una entrada por cada archivo `.txm`; `uploads/pmu/img/img.json` usa `100x100 c=8`; `uploads/pmu/fonts/fonts.json` usa `180x30 c=4`. Estos valores son datos del administrador: se conservan, no se re-declaran.
