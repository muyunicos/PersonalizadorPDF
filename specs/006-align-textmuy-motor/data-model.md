# Data Model: align-textmuy-motor

**Feature**: 006-align-textmuy-motor | **Fecha**: 2026-09-14

Entidades del motor unico de recursos y del puente con el editor. Los formatos de intercambio estan en [contracts/](./contracts/); aca solo viven entidades, campos y reglas de estado.

---

## 1. Ambito

| Campo | Tipo | Regla |
|---|---|---|
| `scope` | string | Editor: `fonts`, `img`, `tm-presets` (sin alias). El motor admite ademas `pdfs`, `orders`, `tmp` |
| `dir` | ruta | `uploads/pmu/<scope>/`, junto a su catalogo y su sprite |
| `catalogo` | archivo | Nombre explicito por ambito (ver 2); nunca derivado del directorio |
| `sprite` | archivo | `thumbs.webp`, uno por ambito (ver 5) |

**Reglas de validacion**: un catalogo y un sprite por ambito; ambito fuera de la whitelist ⇒ rechazo con causa; prohibidas las raices `uploads/tm/` y `uploads/pmu/tm/`.

---

## 2. Catalogo (inventario)

| Campo | Tipo | Regla |
|---|---|---|
| `thumbs.w` / `thumbs.h` | entero | Tamanio de celda del sprite del ambito |
| `thumbs.c` | entero | Columnas del mosaico |
| `items[i]` | tupla de 4 | `[id, title, cats, file]`; `id` numerico denso desde 1 |
| `title` | string | Titulo legible y editable |
| `cats` | string o lista | Una categoria = string; varias = lista; vacio ⇒ `custom` (el parser normaliza a lista) |
| `file` | string | Nombre fisico con extension, o familia remota sin extension (solo `fonts`) |

Nombres por ambito: `fonts` → `fonts.json`, `img` → `img.json`, `tm-presets` → `presets.json`.

**Reglas de validacion**:
- Alta: reutiliza el hueco mas bajo antes de anexar `maxId+1`.
- Baja: vacia la entrada conservando el `id` (sin reindexar) y elimina el archivo fisico.
- Edicion: renombra el archivo fisico si cambio el nombre y actualiza la entrada.
- El inventario nunca describe archivos que no existen ni omite archivos presentes; catalogo ausente ⇒ semilla vacia; catalogo invalido ⇒ rechazo con causa, sin sustituciones.

---

## 3. Recurso

| Campo | Tipo | Regla |
|---|---|---|
| `id` | entero | Estable, ≥ 1; posicion en el sprite = `id-1` |
| `title` | string | Titulo legible, editable via `op=editar` |
| `cats` | string o lista | Categorias de galeria |
| `file` | string | Nombre fisico dentro del ambito |
| `url` | URL | Solo lectura, derivada de la base del ambito + `file` (la entrega el puente) |

**Reglas de validacion**: el `id` nunca se reutiliza para otro archivo sin pasar por hueco; borrar elimina fisico + vacia entrada; toda escritura pasa por el endpoint unico.

---

## 4. Hueco (entrada libre)

`[id, "", "", ""]`: todo vacio salvo el identificador. No se muestra en galeria y su celda del sprite queda libre; la proxima alta lo reutiliza. Si un estilo guardado lo referencia, el render se rechaza con causa.

---

## 5. Sprite de miniaturas

| Aspecto | Regla |
|---|---|
| Archivo | `thumbs.webp`, uno por ambito, junto a su catalogo |
| Filas | `ceil(maxId / c)` |
| Celda del recurso | `col = (id-1) % c`, `fila = floor((id-1)/c)`, `x = col*w`, `y = fila*h` |
| Regeneracion | Al abrir la galeria si falta; se persiste via `op=sprite`, limpiando restos anteriores |

**Reglas de validacion**: prohibidos un manifiesto por celda, un archivo suelto por recurso o varios sprites por ambito.

---


## 6. Estilo guardado (`.txm`)

| Campo | Tipo | Regla |
|---|---|---|
| `format` | string | `textmuy-project` |
| `version` | entero | `1` |
| `name` | string | Nombre saneado `[a-z0-9_-]`; el archivo es `{nombre}.txm` |
| `settings` | objeto | **Delta** contra los valores por defecto (solo lo que el usuario cambió) |
| referencia de tipografía | entero | `settings.font.src` = `id` del ámbito `fonts` |
| referencias de imagen | enteros | Los `id` del ámbito `img` dentro de `settings` |
| `settings.lines` | objeto | `{activeTarget, overrides}`; las rutas globales nunca entran a `overrides` |

**Reglas de validación**:
- Referencia por nombre de archivo o cualquier string heredado ⇒ rechazo “volver a guardar el estilo desde el editor” (sin migración).
- Un estilo que referencia un `id` ausente, hueco o inválido ⇒ rechazo en el render con causa, sin resultados parciales.
- El estilo **no** contiene rutas: las referencias son identificadores del inventario.

---

## 7. Puente (canal sistema → editor)

| Campo | Tipo | Regla |
|---|---|---|
| `urls.motor` | URL | Endpoint único de operaciones |
| `urls.miniaturas` | URL | Script del motor de miniaturas del cliente |
| `urls.presetsBase` / `urls.fuentesBase` / `urls.imagenesBase` | URL | Bases de lectura de cada ámbito (barra final) |
| `nonces.motor` | string | Credencial de las operaciones |
| `presets` / `imagenes` / `fuentes` | listas | Inventarios iniciales generados por el motor |

**Invariantes**: el puente se envía al cargar el iframe, al aviso de disponibilidad del editor y de inmediato; todas las bases apuntan a la raíz única; sin puente el editor no opera y muestra un error accionable (no hay lectura local ni datos embebidos).

---

## 8. Grupo de PDF y su miniatura

| Aspecto | Regla |
|---|---|
| Grupo | Hueco del PDF identificado por `letra`; puede llevar imagen propia o texto estilizado |
| Texto estilizado | Referencia a un estilo guardado; el render ocurre en el navegador y produce un PNG del tamaño exacto del hueco |
| Miniatura de grupo | `{pdf}-{letra}.webp` dentro del ámbito `img` de la raíz única |
| Al borrar el PDF | Se eliminan sus datos, sus imágenes y sus miniaturas de grupo (sin residuos) |

---

## 9. Transiciones de estado

**Recurso (alta / edición / baja)**

| Estado inicial | Operación | Estado final | Efecto en disco |
|---|---|---|---|
| No existe | `alta` | Activo con `id` hueco más bajo o `maxId+1` | Archivo físico guardado + entrada en el catálogo |
| Activo | `editar` (título/categorías) | Activo, mismo `id` | Catálogo actualizado |
| Activo | `editar` (nombre de archivo) | Activo, mismo `id` | Archivo renombrado + entrada actualizada |
| Activo | `baja` | Hueco con el mismo `id` | Archivo físico eliminado + entrada vaciada (sin reindexar) |
| Hueco | `alta` | Activo reutilizando ese `id` | Archivo físico + entrada completada |

**Ámbito**

| Estado | Evento | Estado final |
|---|---|---|
| Sin catálogo | Primera lectura | Catálogo vacío creado (semilla diferida) |
| Catálogo presente, sprite ausente | Apertura de galería | Sprite generado y persistido |
| Catálogo inválido | Lectura | Rechazo con causa visible; sin sustituciones |

**Estilo guardado**

| Estado | Evento | Estado final |
|---|---|---|
| Guardado vigente | Aplicado a un grupo | Render del grupo con sus recursos |
| Guardado con referencias ausentes | Render | Rechazo con causa (sin lote parcial) |
| Formato anterior | Apertura | Rechazo “volver a guardar desde el editor” |

---

## 10. Trazabilidad requisitos → entidades

| Requisito | Entidades implicadas |
|---|---|
| FR-001, FR-014 | Ámbito, catálogo, sprite (raíz única) |
| FR-002, FR-004, FR-016 | Puente, operaciones del motor (un único responsable) |
| FR-003 | Puente (ausencia ⇒ no operar) |
| FR-005, FR-006 | Ámbito (un catálogo y un sprite por ámbito, nombre vigente) |
| FR-007 | Recurso, hueco, transiciones de alta/edición/baja |
| FR-008 | Sprite de miniaturas |
| FR-009 | Operaciones del motor (causa por fallo) |
| FR-010 | Estilo guardado + recurso (rechazo con causa en render) |
| FR-011, FR-012 | Cero entidades heredadas: no se modela ninguna |
| FR-013 | Documentación: un valor por dato |
| FR-015 | Puertas de verificación (R10 del research) |
