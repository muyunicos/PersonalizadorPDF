# Data Model — Editor de imagen y biblioteca del comprador

**Feature**: 043-editor-imagen-biblioteca | **Fecha**: 2026-11-20

Este documento describe las entidades que la feature **usa** (no inventa ninguna nueva) y los flujos
del editor. El formato en disco no cambia: la spec 043 solo agrega **una receta mas** a una foto que
ya existe.

## Entidades

### Foto original

Imagen que el comprador subio una vez. Vive en
`uploads/pmu/{tmp/sesion-{sid}|orders/{uid}}/uploads/`.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string(12) | `^[a-f0-9]{12}$`; hash del **contenido crudo**; estable; nunca se recicla |
| `ext` | string | `webp\|png\|jpg`; sale de la firma de los bytes, no del nombre |
| `bytes` | int | tamano del original |
| `w`, `h` | int | medidas del original (cap 2000 px) |
| `creado` | int | epoch |
| `ultimo_uso` | int | epoch; se actualiza al registrar una receta |
| `recetas` | mapa | `{ "{gid}-{w}x{h}-{phsize}": params }` (spec 040) |

**Invariante**: editar el encuadre **no** crea otra foto ni cambia `id`, `bytes`, `w`, `h`.

### Receta

Como se coloca una foto en un contexto de campo. Es la identidad de la composicion.

| Campo | Tipo | Reglas |
|---|---|---|
| `w`, `h` | int | lienzo del contexto (`phsize` resuelto) |
| `modo` | enum | `cubrir\|encajar\|estirar` (alias viejos por `modoCanonico()`) |
| `escala` | float | 0.25-4 |
| `ox`, `oy` | float | desplazamiento normalizado |
| `rot` | float | rotacion |
| `fondo` | string | `''` (transparente) o color |
| `gid` | string(6) | `^[0-9A-F]{6}$` (grupo del hueco) |
| `phsize` | int | 0-2 |
| `hash` | string(12) | lo recomputa **siempre** el servidor (`PMU_Sesion::receta_de`); el cliente nunca lo propone |

**Clave de contexto**: `"{gid}-{w}x{h}-{phsize}"`. Dos campos distintos pueden tener recetas
distintas de la misma foto.

**Validacion**: si la receta no aplica a la geometria actual (otro `phsize`, `w`/`h`), se descarta y
se usan los valores por defecto del campo, con aviso no bloqueante.

### Entrada de biblioteca

Lo que devuelve el listado (camino rapido o respaldo). **No trae bytes.**

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string(12) | el de la foto |
| `url`, `thumb` | string | URLs del camino rapido (o del respaldo) |
| `thumb_data` | string | data URI embebido (spec 042) |
| `bytes`, `w`, `h` | int | metadatos |
| `recetas` | mapa | recetas por contexto (puede venir vacio) |
| `creado` | int | epoch |

### Fila del manifiesto

Como participa una foto en el item. Una fila por **receta**.

| Campo | Tipo | Reglas |
|---|---|---|
| `origen` | enum | `original` (la foto) \| `compuesta` (la receta) \| `ref` (legado) |
| `file` | string | `img/foto-{pdf}-{gid}-{hash}.webp` (determinista = cache) |
| `orig.id` | string(12) | el de la foto |
| `orig.params` | objeto | la receta **completa** (el hash es irreversible) |
| `indice` | int | posicion de instancia |

**Invariante**: registrar dos veces la misma receta no acumula filas (idempotente).

### Accion del editor

Lista extensible que define que se puede hacer sobre la imagen abierta.

| Campo | Tipo | Valores hoy |
|---|---|---|
| `id` | string | `editar`, `eliminar`, `cargar`, `ver_todas` |
| `etiqueta` | string | "Editar recorte", "Eliminar", "Cargar imagen", "Ver todas (N)" |
| `primaria` | bool | solo una |
| `habilitada` | bool | depende del modo (`nueva` no tiene "Eliminar") |

**Extension futura**: `ajustes` y `texto` se agregan a la lista sin cambiar el modal ni el contrato.

## Flujos

### Abrir el editor

1. El comprador toca una miniatura del campo (o "Cargar imagen" para una nueva).
2. Se resuelve `id` + receta: catalogo -> memoria -> defaults (R2).
3. El selector abre en modo `editar` con `paramsIniciales`; en modo `nueva` abre sin receta.

### Guardar

| Caso | Que viaja | Que se escribe |
|---|---|---|
| Nueva con archivo | bytes de la composicion | foto + fila (comportamiento actual) |
| Existente sin cambios | nada | nada (el editor se cierra) |
| Existente con cambios | **0 bytes** | receta nueva en catalogo + fila por receta |
| Fallo de red | nada | nada; los ajustes quedan en pantalla y se puede reintentar |

### Cancelar

Descarta `params` en memoria, no toca catalogo ni manifiesto. Si habia una imagen nueva elegida sin
guardar, no queda en la biblioteca.

### Eliminar

1. `op=borrar` **sin** `confirmar`.
2. Si responde `referencias` (carrito o pedidos): dialogo con la lista y reintento con `confirmar=1`.
3. Sin referencias: borra directo (fila del item + archivo si nadie mas lo usa).
4. Si falla la red: la miniatura **no** se saca y se muestra la causa.

### Ver todas (N)

1. El chip abre `PMUVisor` con las fotos de la biblioteca (`items`, `indice` 0).
2. `Elegir` -> `cargarDesdeBiblioteca(foto)` en el editor (1 GET, cache HTTP).
3. `Eliminar` -> flujo de Eliminar de arriba; al volver, la tira se repinta con la lista vigente.

## Estados del editor

```text
idle -> abriendo -> editando -> guardando -> cerrado
                        |  \-> cancelado
                        \-> error -> editando (reintento)
```

- `guardando` deshabilita los botones y no permite doble envio.
- `cancelado` nunca deja escrituras a medias.
- `error` conserva la receta y el archivo elegido para reintentar sin re-elegir.