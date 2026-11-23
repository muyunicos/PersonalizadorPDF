# Data Model — Modelo de recetas (spec 047, Fase 6)

## 1. Catalogo por identidad (`uploads.json`)

```jsonc
{
  "version": 1,
  "items": {
    "e439e82ec506": {
      "id": "e439e82ec506",
      "ext": "webp",
      "bytes": 120000,
      "w": 800, "h": 600,
      "creado": 1795457393,
      "ultimo_uso": 1795457393,
      // objetivo -> configuracion (delta)
      "recetas": {
        "1.3333-0-480000": { "modo": "cubrir" },
        "1.0000-1-250000": { "modo": "cubrir", "zoom": 1.25 },
        "1.5000-0-60000":  { "modo": "encajar", "ox": 0.1, "oy": -0.05 }
      },
      // ultima receta aceptada (se reutiliza al abrir otro campo)
      "ajustes": { "objetivo": "1.0000-1-250000", "configuracion": { "modo": "cubrir", "zoom": 1.25 } }
    }
  }
}
```

## 2. Objetivo (clave de receta)

```text
objetivo := aspecto "-" familia "-" area
aspecto  := [0-9]+\.[0-9]{4}      // 1.5000, 1.0000, 0.7500
familia  := 0 | 1                 // 0 = rectangulo, 1 = redonda
area     := [0-9]+                // px^2 del w*h resuelto
```

Ejemplos: `1.5000-0-60000` (300×200), `1.0000-1-250000` (500×500 circular).

**Reglas**:
- Aspecto = `w/h` redondeado a 4 decimales (half-up).
- Familia: `circulo`/`ovalo` → 1; `rectangulo`/`cuadrado`/`auto` → 0 (el PH manda; `auto` no se guarda).
- Area = `w*h` del tamaño **resuelto** (con `phsize` aplicado), entero.
- La forma final se **deriva**: familia 1 + aspecto 1 → círculo; familia 1 + ≠1 → óvalo; familia 0 + aspecto 1 → cuadrado; familia 0 + ≠1 → rectángulo.

## 3. Configuración (delta)

```text
configuracion := { "modo": "cubrir"|"encajar"|"estirar",
                   "zoom"?: 0.25..4,        // solo si != 1
                   "rot"?: 0|90|180|270,    // solo si != 0
                   "ox"?: -1..1,            // solo si != 0.5
                   "oy"?: -1..1,            // solo si != 0.5
                   "fondo"?: "#rrggbb"|"transparent",  // solo si != auto
                   "transp"?: "si"|"no" }   // solo si != ''
```

- Default = `{modo:'cubrir'}` (escala 1, centro, sin rot, fondo auto, sin desplazamiento).
- Se persisten **solo** las claves distintas del default.

## 4. Fila del item (`manifest.json`)

```jsonc
{
  "id": "e439e82ec506",
  "origen": "original",
  "receta": "1.0000-1-250000",       // objetivo congelado
  "params": { /* receta v2 completa, 15 claves */ }
}
```

- La fila **no cambia** al promover (spec 040); el `params` v2 es el que usa `Compositor`.
- `receta` es el objetivo (para trazabilidad); `params` es la v2 derivada.

## 5. Derivación de la v2 (servidor)

```text
v2 = { v:2, w, h, forma, modo, escala, ox, oy, fondo, transp, rot, iw, ih, phsize, gid }
w/h   <- ranura (o `phsize` si aplica)
iw/ih <- dimensiones del original (getimagesize)
modo/escala/ox/oy/rot/fondo/transp <- delta (defaults del campo)
```

El hash (`receta_de`) se calcula **siempre** en el servidor sobre esas 15 claves.

## 6. Validaciones

| Campo | Regla |
|---|---|
| `id` | `^[a-f0-9]{12}$` |
| `objetivo` | regex de §2 |
| `configuracion.modo` | `cubrir|encajar|estirar` |
| `zoom` | 0.25..4 (solo si != 1) |
| `rot` | múltiplo de 90 (solo si != 0) |
| `ox`/`oy` | -1..1 (solo si != 0.5) |
| `fondo` | `#rrggbb` o `transparent` |
| `transp` | `si|no` |

## 7. Transiciones

- **Subida nueva**: `guardar_subida` → fila `origen:original` + `recetas[objetivo] = delta` + `ajustes = {objetivo, delta}`.
- **Guardar receta nueva (0 bytes)**: `declararReceta` → `recetas[objetivo] = delta` + `ajustes` actualizado; **no** crea archivo.
- **Editar item**: la fila del manifest no cambia; la v2 se deriva de `params`.
- **Borrar foto**: se quita la entrada del catalogo (y sus recetas); el item no se rompe.

## 8. Invariantes

- **INV-1**: una imagen = un `id`; N recetas por `id`.
- **INV-2**: `ajustes.objetivo` siempre existe en `recetas` (si no, se recrea).
- **INV-3**: el objetivo no depende del `gid` (el `gid` es contexto de PDF).
- **INV-4**: las recetas viejas no se leen ni se migran.