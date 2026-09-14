# Data Model: Galería Engine (PMU Uploads)

**Fecha**: 2026-09-13 | **Feature**: 003-galeria-engine

## Entities

### Ambito (Domain Scope)

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| nombre | string | Identificador único | {fonts, img, pdfs, orders, tmp, tm-presets} |
| ruta | string | Ruta relativa dentro de uploads/pmu/ | Requerido |

### Item (Resource Entry)

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| id | int ≥1 | Identificador único auto-generado | Requerido, único |
| title | string | Nombre descriptivo | Requerido, max 200 caracteres |
| cats | string | categoría | Requerido |
| file | string | Nombre físico del archivo | Requerido si activo, omitir si tombstone |
| thumb | string | Ruta de miniatura (derivada) | Opcional |
| enUso | bool | En uso por algún grupo PDF | Derivado |

### Catalogo (Repository)

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| thumbs | {w, h, c} | Configuración de grilla | w:100-500, h:30-500, c:4-12 |
| items | Item[] | Lista de entries | max 1000 |

## Relationships

```
Ambito ──┐
         ├───┤ 1..* ── Item
Ambito ──┘

Item ──1──┐
          ├───┤ 1 ── Archivo Físico (PNG/JPG/WebP/GIF/TTF/OTF)
Ambito ──1──┘
```

## State Transitions

### Item Lifecycle

```
CREACIÓN → ACTIVO → [OPCIONAL: EDITAR] → ELIMINADO (Tombstone)
```

| Transición | Trigger | Resultado |
|---|---|---|
| CREACIÓN → ACTIVO | alta_ambito() | item con id nuevo |
| ACTIVO → EDITAR | editar_ambito() | actualizar campos |
| ACTIVO → ELIMINADO | baja_ambito() | tombstone [id, "", ""] |

## Validation Rules

### Físicos

| Tipo | Extensiones | Máx. Tamaño |
|---|---|---|
| Imagen | .png, .jpg, .jpeg, .webp, .gif | 10MB |
| Fuente | .ttf, .otf | 5MB |
| Preset | .txm | 50KB |

### Ámbitos

| Ámbito | Físico | Catálogo |
|---|---|---|
| fonts | .ttf, .otf | fonts.json |
| img | .png, .jpg, .webp, .gif | img.json |
| tm-presets | .txm | presets.json |

## Indexing

- **Primary**: `id` (numérico, único)
- **Secondary**: `title` (búsqueda textual), `file` (lookup rápido)

## Constraints

- **ID auto-generado**: `tupla_alta` usa hueco más bajo o max+1
- **Tombstone**: Mantiene ID reservado, no reutilizable
- **Sin caché**: Lecturas directas a disco (decisión abierta)
