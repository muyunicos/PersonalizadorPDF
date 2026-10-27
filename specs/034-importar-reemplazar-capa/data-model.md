# Data Model: Importar página/capa y reemplazar capa/grupo

**Feature**: 034-importar-reemplazar-capa · **Fecha**: 2026-10-26

> **Sin almacenamiento nuevo de formato**: el modelo describe **estructuras de presentación** que ya existen en `config.json:mockups[].capas[]` (spec 011 v10). No hay archivos nuevos, ni ámbitos nuevos, ni tablas.

---

## 1. `Decision de reemplazo` (lo que devuelve `debeReemplazar()`)

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| `reemplazar` | bool | `true` si hay selección y la importación debe reemplazar en vez de agregar | — |
| `destino` | int \| null | índice de la capa destino en `capas()` | `null` si no hay selección; si no, `0 <= destino < capas().length` |
| `esGrupo` | bool | `true` si todas las capas seleccionadas comparten `grupo` (no vacío) | — |

**Invariantes**
- **INV-1**: `reemplazar === false` ⟺ `destino === null`.
- **INV-2**: si `esGrupo === true`, entonces `capas()[destino].grupo` es un id no vacío y **todas** las capas seleccionadas comparten ese id.
- **INV-3**: si la selección tiene 1 capa, `esGrupo === false`.

## 2. `Capa` (ya existe; no cambia el formato)

| Campo | Tipo | Descripción |
|---|---|---|
| `tipo` | string | `img` \| `placeholder` |
| `ref` | string | `{ambito}:{valor}`; `pdf:{archivo}` o `mock:{id}`. Sin `:` se lee como `pdf:` |
| `x`,`y`,`w`,`h` | int | `x,y` entre -3000 y 3000; `1 <= w,h <= 1200`; espacio lógico 300x300 |
| `rot` | float | -360..360 |
| `sesgo` | float | -1..1 |
| `filtros` | object | brillo/gama/contraste/saturación/opacidad/desenfoque/tono |
| `modo` | string | `normal` \| `multiply` |
| `nombre` | string | <= 60 |
| `oculta` | bool | default `false` |
| `bloqueada` | bool | default `false` |
| `envoltura` | bool | solo `tipo=placeholder`; en `img` el saneo fuerza `false` |
| `grupo` | string | opcional; `g-` + 1..36 `[a-z0-9_-]` |
| `grupo_rot` | float | -360..360 |
| `perspectiva` | object | `{puntos: [4 × {x,y} en 0..1]}`; solo si convexo y no neutro |

**Qué cambia al reemplazar** (solo esto):

| Campo | Antes | Después |
|---|---|---|
| `ref` | `{color}` / `{color}#n` / `mock:{idViejo}` | `mock:{idNuevo}` |
| `tipo` | `placeholder` o `img` | `img` |
| `envoltura` | `true`/`false` | `false` (una imagen no tiene PowerClip) |
| `nombre` | el que tuviera | `Pagina N` |

**Todo lo demás se conserva byte a byte**: `x`, `y`, `w`, `h`, `rot`, `sesgo`, `filtros`, `modo`, `oculta`, `bloqueada`, `grupo`, `grupo_rot`, `perspectiva`.

## 3. `Grupo` (ya existe; no cambia)

| Campo | Tipo | Descripción |
|---|---|---|
| `grupo` | string | id compartido por las capas miembro |
| `grupo_rot` | float | orientación compartida del marco |

**Invariante**: al reemplazar un grupo, **no** se cambia `grupo` ni `grupo_rot` de ningún miembro.

## 4. `Perspectiva` (ya existe; se habilita por capa individual)

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| `puntos` | array de 4 `{x,y}` | normalizados 0..1, orden NW, NE, SE, SW | cuadrilátero convexo y no neutro |

**Invariante**: si es neutra (los 4 puntos unitarios), no se persiste.

## 5. Relaciones

```
config.json
└── mockups[]
    └── capas[]
        ├── tipo: 'img'         → ref: 'mock:<id>' (catálogo img/)
        ├── tipo: 'placeholder' → ref: '{color}' o '{color}#n' (hueco del PDF)
        ├── grupo: 'g-...'      → agrupa capas (opcional)
        ├── grupo_rot: float    → orientación del grupo
        └── perspectiva: {...}  → deformación homográfica (opcional, por capa)

analisis.json   (inmutable, NO cambia)
envolturas.json (derivado, NO cambia)
```

**Nada nuevo en disco**: el reemplazo solo reescribe `config.json:mockups[]` a través de `PMU_Uploads::guardar_config` (autoguardado del editor).
