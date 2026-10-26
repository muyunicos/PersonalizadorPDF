# Data Model: Reemplazo del PDF

**Feature**: 032-reemplazo-pdf · **Fecha**: 2026-10-26

> **Sin almacenamiento nuevo de formato**: el modelo describe **estructuras que viajan** (mapa, decision)
> y la **disposicion en disco del respaldo**. `config.json`, `analisis.json` y `envolturas.json`
> **no cambian de forma** (D5 del spec / §IV).

---

## 1. `Mapa` (el resultado de "preparar")

Viaja del servidor al navegador (para el modal) y **vuelve** en el confirmar (ya decidido).

| Campo | Tipo | Descripcion | Validacion |
|---|---|---|---|
| `op` | string | `'reemplazar_preparar'` / `'reemplazar_confirmar'` | en la allowlist |
| `pdf` | string | nombre del producto | saneado (`nombre_seguro`); debe existir |
| `ts` | string | marca del staging (`YYYYMMDD-HHMMSS-xxxx`) | `^[0-9]{8}-[0-9]{6}-[a-f0-9]{4}$`; la carpeta debe existir y ser del producto |
| `grupos_previos` | int | total de grupos del PDF vigente | >= 0 |
| `grupos_nuevos` | int | total de grupos del PDF nuevo | >= 0 |
| `iguales` | map `gid -> gid` | ids que sobreviven (mismo hex) | claves hex validas |
| `sugeridos` | array de `{de, a, iou, color, score}` | pares propuestos (1:1) | `iou` 0..1, `color` 0..1, `score` 0..1; `de` y `a` unicos entre sugeridos |
| `perdidos` | array de `{gid, con_personalizacion}` | sin destino | `con_personalizacion` = tiene `value`/`preset`/`settings` |
| `nuevos` | array de `gid` | grupos nuevos sin personalizacion previa | hex validos |
| `avisos` | array de string | causas legibles (envolturas revalidadas, `#n` fuera de rango) | sin HTML |

**Invariantes**

- **INV-1 (1:1)**: un `gid` nuevo aparece **como maximo una vez** en el destino de `iguales` + `sugeridos`.
  Un `gid` viejo aparece **como maximo una vez** como origen.
- **INV-2 (sin solapamiento)**: `iguales` y `sugeridos` no comparten origen ni destino con `perdidos`
  (los perdidos no tienen destino por definicion).
- **INV-3 (cobertura)**: `iguales` + `sugeridos` + `perdidos` cubren **todos** los grupos previos;
  `iguales` + `sugeridos(+nuevos sin par)` cubren todos los nuevos.
- **INV-4 (el mapa no aplica nada)**: `preparar` es **solo lectura** sobre el producto (FR-003).

## 2. `Decision` (lo que vuelve del modal)

| Campo | Tipo | Descripcion |
|---|---|---|
| `pdf` | string | el producto |
| `ts` | string | el staging que se confirma |
| `migrar` | bool | `true` = aplicar; `false`/ausente = **cancelar** (el servidor descarta el staging y responde ok) |
| `pares` | array de `{de, a}` | lo **final** que el admin acepta (por defecto, todos los `iguales` + `sugeridos`; puede quitar sugerencias) |

**Validaciones**: `de` debe existir en el analisis previo y `a` en el nuevo; no se admiten `a` repetidos
(INV-1 se revalida en el servidor: **el cliente no manda la verdad**); un par ausente = ese grupo se
considera perdido. Todo lo que el cliente manda se **cruza** contra el analisis del servidor.

## 3. `Respaldo` (disposicion en disco)

```
uploads/pmu/tmp/reemplazos/{nombre}/
├── ultimo.json                     {ts, creado, pdf, bytes_pdf, version_plugin}
├── {ts}/
│   ├── nuevo/                      staging de "preparar" (mientras no se confirma)
│   │   ├── {nombre}.pdf            PDF nuevo subido
│   │   ├── analisis.json           analisis nuevo
│   │   └── envolturas.json         envolturas nuevas
│   └── anterior/                   respaldo (se crea SOLO al confirmar, antes del swap)
│       ├── {nombre}.pdf            PDF vigente hasta ese momento
│       ├── analisis.json
│       ├── config.json
│       └── envolturas.json
```

| Regla | Detalle |
|---|---|
| **INV-5 (un respaldo)** | solo se conserva el `{ts}` de `ultimo.json`; al confirmar un reemplazo nuevo se **borra** el `{ts}` viejo entero |
| **INV-6 (fuera del TTL)** | `tmp/reemplazos/` **no** entra en el barrido de `limpiar_ttl` (spec 030) |
| **INV-7 (borrar producto)** | `handle_borrar` limpia tambien `tmp/reemplazos/{nombre}/` |
| **INV-8 (el respaldo no se toca al cancelar)** | cancelar borra `{ts}/nuevo/`; `anterior/` de un reemplazo previo **no** se toca |

## 4. Relaciones

```
Producto (pdfs/{nombre}/)                 temporal de trabajo
├── {nombre}.pdf        <-- swap          tmp/reemplazos/{nombre}/{ts}/nuevo/{nombre}.pdf
├── analisis.json       <-- swap          tmp/reemplazos/{nombre}/{ts}/nuevo/analisis.json
├── envolturas.json     <-- swap          tmp/reemplazos/{nombre}/{ts}/nuevo/envolturas.json
├── config.json         <-- remapeado     (no se guarda en nuevo/: se reescribe al confirmar)
└── (todo lo demas: intacto)              tmp/reemplazos/{nombre}/{ts}/anterior/  (respaldo)
```

**Nada mas cambia**: `orders/`, `tmp/sesion-*`, `bonus/`, `campos/`, `img/`, `tm-presets/`, `api/` quedan
fuera del flujo (FR-002/FR-013).