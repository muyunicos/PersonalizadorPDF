# Data Model: Catalogo de uploads

**Fecha**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Entidades

### CatalogoUploads

Resumen de un **ambito de originales** (una carpeta `uploads/`).

| Campo | Tipo | Regla |
|---|---|---|
| `version` | int | `1`; una version desconocida se trata como catalogo ausente (reconstruir) |
| `items` | objeto `id -> EntradaCatalogo` | mapa para upsert O(1); una entrada por imagen |

Ubicacion: `{ambito}/uploads.json`. Es **dato derivado**: se puede reconstruir (FR-006).

### EntradaCatalogo

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | `^[a-f0-9]{12}$` (sha12 del contenido, spec 035) |
| `ext` | string | `webp` \| `png` \| `jpg` (sale de la firma de los bytes, nunca del nombre) |
| `bytes` | int | `>= 0` |
| `w`, `h` | int | `>= 1`; medidas del original guardado |
| `creado` | int (epoch) | alta de la entrada |
| `recetas` | objeto `clave -> RecetaContexto` | puede estar vacio |

### RecetaContexto

| Campo | Tipo | Regla |
|---|---|---|
| `clave` | string | `"{gid}-{w}x{h}-{phsize}"`; `gid` `^[0-9A-F]{6}$`, `w`/`h` `>=1`, `phsize` 0..2 |
| `gid` | string | espejo del `gid` de la clave (para validar sin parsear) |
| `w`, `h`, `phsize` | int | espejo de la clave |
| `params` | objeto | receta v2 ya validada (`PMU_Sesion::receta_validar`) |
| `ts` | int (epoch) | ultima vez que se uso/definio |

Un contexto nuevo **no** reemplaza a los otros: la misma imagen puede tener recetas distintas para
tamanos o formas distintas (FR-009 y US2 escenario 2).

### Miniatura (derivado)

| Aspecto | Regla |
|---|---|
| Nombre | `{id}-80x80.webp` |
| Forma | cuadrada 80x80, recorte al centro (**cover**) |
| Generacion | al subir; si falta, al pedirla (y se conserva) |
| Vida | viaja con el original al promover el item; se borra con la imagen |

## Invariantes

1. **Una entrada por `id`** y solo si el archivo existe en el ambito (tolerante: si falta, se omite).
2. **Nunca una receta sin `params` validos**: si no valida, se descarta en la escritura.
3. **La clave de receta es determinista**: mismo `gid`+`w`+`h`+`phsize` = mismo contexto.
4. **El catalogo no es fuente de verdad del contenido**: si discrepa con el disco, gana el disco
   (reconstruccion).
5. **Quitar del campo no modifica el catalogo**; borrar desde la galeria si (FR-011/FR-012).
6. **El catalogo no se publica**: no hay URL propia; se lee por el canal protegido (FR-013).

## Transiciones

| Evento | Efecto en el catalogo | Efecto en archivos |
|---|---|---|
| Subida nueva | upsert de la entrada (medidas, bytes, ext, `creado`) | escribe `{id}.{ext}` + `{id}-80x80.webp` |
| Re-subida del mismo contenido (dedupe por `id`) | refresca `bytes`/`w`/`h` | no reescribe el original; regenera miniatura si falta |
| Declaracion de receta (al usar en un campo) | upsert de la receta del contexto | — |
| Quitar la foto de un campo | **sin cambios** | **sin cambios** |
| Borrar desde la galeria, sin carrito/pedido | elimina la entrada | borra original + miniatura |
| Borrar desde la galeria, con carrito/pedido | igual, **tras confirmar** | igual, tras confirmar |
| Promover el item al pagar | el catalogo y la miniatura **se mueven** con el original | `orders/{uid}/uploads/` |
| Poda por vencimiento | elimina entradas huerfanas | borra originales y miniaturas vencidas |
| Catalogo ausente/corrupto | se reconstruye una vez (sin recetas) | no toca archivos |

## Volumen y limites

- Por comprador: decenas de imagenes (el tope de la tira es 10 visibles, no un limite de datos).
- Recetas por imagen: acotadas por los tamanos/formas que el comprador use; se podan con la imagen.
- No hay tope duro de catalogo en `orders/{uid}/uploads/` en esta version (**deferred**, bajo impacto).