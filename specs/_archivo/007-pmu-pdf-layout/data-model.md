# Data Model: Layout PMU de PDFs y contenido por grupo en metadata

**Feature**: 007-pmu-pdf-layout | **Date**: 2026-09-15

Todo el estado son archivos dentro de `uploads/pmu/` (Constitucion, Data Storage). Los
formatos de intercambio detallados viven en [contracts/](./contracts/); aqui van entidades,
campos y reglas.

## Entidades

### PDF (producto)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| nombre | string | Identificador del producto (base del archivo, saneada) | `[A-Za-z0-9_-]`, sin `.pdf`, no vacio |
| archivo | string | `{nombre}.pdf` dentro de su carpeta | Extension `.pdf`, dentro del limite del servidor |
| carpeta | string | `uploads/pmu/pdfs/{nombre}/` | El PDF debe existir para que el producto se liste |
| metadata | string | `uploads/pmu/pdfs/{nombre}/metadata.json` | Ausente = producto sin analizar |
| mockups | string | `uploads/pmu/pdfs/{nombre}/mckp.json` | Opcional (spec 004); fuera del alcance de esta feature |
| grupos | Grupo[] | Derivados del analisis del PDF | Ver Grupo |
| total_paginas | int | Paginas del PDF analizado | > 0 |

**Estados**: sin analizar (carpeta con PDF y sin `metadata.json`) -> analizado (con
`metadata.json` valido). El estado se deriva del sistema de archivos; no hay campo de estado.

**Transiciones**: subir (sin analizar) -> analizar o re-analizar (analizado) -> borrar (carpeta
eliminada junto con `tmp/muestras/{pdf}/`). Sobrescribir un nombre existente reemplaza el PDF y regenera
el dataset preservando la personalizacion de los grupos que siguen (D8 de research.md).

### Grupo (placeholder)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| id | string | Clave del grupo = color hex sin `#` (p. ej. `0000FF`); unica por PDF | `^[0-9A-F]{6}$`; se usa en archivos, URLs, formularios y puente |
| w, h | int | Tamano base del grupo en px (base 200 ppp) | >= 10x5 pt equivalentes |
| cont | int | Instancias del grupo (conteo; usada por la validacion del motor) | >= 1 |
| pgs | int[] | Paginas (0-based) donde aparece | Indices validos (informativo, UI) |
| default | enum/null | Que renderiza el grupo sin valor: `null` (hueco intacto) o `texto` / `img` / slug de modulo | Strings, nunca enteros |
| value | string/null | Plantilla del contenido: literal o `[campoX]` (contrato `contenido-grupo.md`) | Saneada; vacia = grupo sin personalizar |
| preset | string/null | Slug de preset TextMuy | Debe existir en `uploads/pmu/tm-presets/` al procesar |
| config | string/null | Configuracion del modulo activo (string opaco; hoy TextMuy) | Con sustitucion `[campo]`; el plugin no la interpreta |

### PDF (producto) — `activo` a nivel producto

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| activo | bool | El producto esta activo (spec 004: `status`) | Default: true en alta manual; no existe por grupo |

**Regla de participacion de un grupo**: se procesa si `value` no esta vacio (o si `default` exige generar contenido); si no, el hueco queda intacto y el resumen lo informa. No hay campo `activo` por grupo.

### Aplicado (muestra del panel)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| pdf | string | Nombre del producto de origen | Debe existir `pdfs/{pdf}/` |
| id | string | Grupo al que se aplica (color hex sin `#`) | Debe existir en el dataset |
| archivo | string | `uploads/pmu/tmp/muestras/{pdf}/{id}.{ext}` | Extension en {png, jpg, jpeg, gif, webp}; una por grupo (se sobrescribe) |
| salida | string | `uploads/pmu/tmp/muestras/{pdf}/{nombre}_procesado.pdf` | Se sobrescribe en cada Procesar (idempotente) |

**Ciclo de vida**: se crea al cargar la imagen de un grupo (subida directa o galeria de medios)
o al recibir el PNG renderizado por el modulo TextMuy; se sobrescribe en cada Procesar; se elimina
al quitar la imagen del grupo o al borrar el PDF (que tambien elimina `tmp/muestras/{pdf}/`).

### Linea de carrito (sesion/linea)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| linea | string | Clave unica de la linea (cart item key saneado) | Sin `/`, no vacia |
| carpeta | string | `uploads/pmu/tmp/cart/{linea}/{pdf}/` | Creada al personalizar; borrada al eliminar la linea |
| manifest | string | `uploads/pmu/tmp/cart/{linea}/manifest.json` | `pdf`, personalizacion canonica, `pmu_hash`, cantidad, `creado`, motor |
| aplicados | string[] | `{id}.{ext}` por grupo aplicado en `{pdf}/` | Misma nomenclatura que muestras |

**Ciclo de vida**: personalizar crea/reescribe el borrador; agregar al carrito adopta la sesion
como linea (o fusiona por `pmu_hash` identico: cantidad + 1); eliminar la linea borra
`tmp/cart/{linea}/`; los borradores y sesiones huerfanas caducan por TTL (`creado`).

### Staging de pedido (preparacion)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| order_id | int | Pedido WooCommerce | > 0 |
| carpeta | string | `uploads/pmu/tmp/orders/{order_id}/{pdf}/` | Una subcarpeta por PDF de la linea |
| lineas | object[] | `{linea, pdf, manifest, cantidad}` | Copiado de las lineas al crearse el pedido |

**Nota**: se crea al crearse el pedido; se promueve SOLO al confirmarse el pago (FR-020, rename
atomico). Sin pago, la limpieza por TTL la elimina.

### Resultado de pedido (orders)

| Campo | Tipo | Descripcion | Validacion |
|-------|------|-------------|------------|
| order_id | int | Pedido WooCommerce | > 0 |
| carpeta | string | `uploads/pmu/orders/{order_id}/{pdf}/` | Un subdirectorio por linea/PDF; la crea la promocion al confirmarse el pago |
| imagenes | string[] | `{id}.{ext}` por grupo aplicado dentro de `{pdf}/` | Misma nomenclatura que muestras |
| salida | string | `{pdf}_procesado.pdf` por linea | Generado por el mismo motor; una vez por linea (cantidad en el resumen) |

**Nota**: el cableado a los hooks Woo (add/remove al carrito, creacion de pedido, pago confirmado,
limpieza programada) se implementa en spec 004; aqui quedan las rutas, los manifiestos y las reglas
(FR-012, FR-018..FR-020).

## Reglas de validacion transversales

- **V-1 (nombres)**: todo nombre de PDF se sanea (`Metadata::nombreDesdeArchivo`) y se usa para
  la carpeta, el PDF y el dataset (`{nombre}.pdf`, `metadata.json`).
- **V-2 (un grupo, un archivo)**: por grupo existe como maximo un archivo de imagen aplicada;
  cargar otra reemplaza la anterior (se eliminan variantes con otra extension). En `tmp/cart/`
  esto vale por linea (`{linea}/{pdf}/`): dos lineas del mismo PDF no comparten archivos.
- **V-3 (rutas)**: ninguna ruta se arma fuera de `PMU_Uploads`; los ambitos validos son `pdfs`,
  `tmp` (subambitos `muestras`, `cart`, `orders`) y `orders` (mas `fonts`, `img` y `tm-presets`
  del editor).
- **V-4 (escritura)**: los JSON se escriben de forma atomica (temporal + renombrado) y la lectura
  nunca lanza por contenido ilegible (aviso + catalogo vacio).
- **V-5 (personalizacion)**: se valida antes de persistir (texto saneado y limitado a 300 caracteres,
  preset existente, ids presentes en el dataset).
- **V-6 (limpieza)**: borrar un producto elimina `pdfs/{nombre}/` y `tmp/muestras/{nombre}/`;
  nunca archivos de otro producto, ni lineas del carrito ni nada dentro de `orders/`.

## Relaciones

- PDF 1..N Grupo (los grupos viven dentro del `metadata.json` del PDF).
- Grupo 0..1 Personalizacion (campos planos `default`/`value`/`preset`/`config` en la propia entrada del grupo).
- PDF 1..N Muestra (muestras del panel en `tmp/muestras/{pdf}/`, archivos por `id` del grupo).
- Sesion del comprador 1..N Linea (`tmp/cart/{linea}/{pdf}/` + `manifest.json`; el producto puede aparecer N veces en lineas distintas).
- Pedido 1..N Linea de pedido (`orders/{order_id}/{pdf}/` por linea al confirmarse el pago).

## Ejemplo completo de `metadata.json`

```json
{
  "pdf": "circulo6cm",
  "dpi_conversion": 200,
  "creado": "2026-09-15T00:00:00Z",
  "activo": true,
  "total_grupos": 2,
  "grupos": [
    { "id": "0000FF", "w": 463, "h": 463, "cont": 8, "pgs": [0],
      "default": "texto", "value": "Hola [campo3]", "preset": "neon-glow",
      "config": "settings.font.src='Montserrat',[campo1]" },
    { "id": "FF0000", "w": 463, "h": 463, "cont": 7, "pgs": [0], "default": null }
  ]
}
```