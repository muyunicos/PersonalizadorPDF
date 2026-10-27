# Contrato: importar página/capa y reemplazar capa/grupo (spec 034)

**Feature**: 034-importar-reemplazar-capa · **Versión**: 1 · **Fecha**: 2026-10-26

> Superficie **externa** del feature: la UI del editor de mockups (`assets/mockups.js`) y su contrato con `mockup-render.js` (compartido con la ficha). **No hay endpoints PHP nuevos**: se reutilizan los existentes (`admin_post_pmu_uploads` con `op=alta` para el catálogo `mockups`).

---

## 1. Función pura (prometida a los tests)

```js
debeReemplazar() -> { reemplazar: boolean, destino: number|null, esGrupo: boolean }
```

| Entrada (estado del editor) | `reemplazar` | `destino` | `esGrupo` |
|---|---|---|---|
| Sin selección (`seleccion < 0` y `seleccionados` vacío) | `false` | `null` | `false` |
| Una capa seleccionada | `true` | índice | `false` |
| Varias capas con el mismo `grupo` (no vacío) | `true` | primer índice | `true` |
| Varias capas sin grupo común | `true` | primer índice | `false` |

**Contrato**: es **pura** (no muta `estado`, no toca el DOM, no hace I/O). Se puede invocar en cualquier momento y devuelve el mismo resultado para el mismo estado.

## 1.bis Función pura de la perspectiva (US3)

```js
puedePerspectiva(indices, lista?) -> boolean
```

`true` con **una** capa seleccionada (la capa existe) o con un **grupo persistido** (≥2 capas con el
mismo `grupo` no vacío). Es la puerta de los tres puntos donde se ofrece la perspectiva: los cuatro
tiradores del lienzo, el hit-test de esos tiradores y el bloque de Ajustes (`reset-perspectiva`).
Antes de la 034 exigía ≥2 capas con `grupo`, así que una capa suelta no podía deformarse.

## 2. Efecto del reemplazo (lo que prometen `importarPagina` y `agregarCatalogo`)

| Superficie | Antes | Después |
|---|---|---|
| `capas()[destino].ref` | `{color}` / `{color}#n` / `mock:{idViejo}` | `mock:{idNuevo}` |
| `capas()[destino].tipo` | `placeholder` \| `img` | `img` |
| `capas()[destino].envoltura` | `true` \| `false` | `false` |
| `capas()[destino].nombre` | cualquiera | `Pagina N` (importacion) / titulo del catalogo (imagen) |
| **`x`, `y`, `w`, `h`, `rot`, `sesgo`** | — | **sin cambios (byte a byte)** |
| **`filtros`, `modo`, `oculta`, `bloqueada`** | — | **sin cambios** |
| **`grupo`, `grupo_rot`** | — | **sin cambios** |
| **`perspectiva`** | — | **sin cambios** |
| Cantidad de capas | — | **sin cambios** (no se agregan ni se borran) |
| Orden z | — | **sin cambios** |

## 3. Reglas (R1-R7)

| Regla | Descripción |
|---|---|
| **R1** | Sin selección → comportamiento actual: se agrega una capa `img` nueva + el grupo de placeholders. |
| **R2** | Con una capa seleccionada → se reemplaza **esa** capa (mantiene su geometría y perspectiva). |
| **R3** | Con un grupo seleccionado → se reemplaza **cada miembro** del grupo (mantiene geometría relativa y `grupo_rot`). |
| **R4** | Con varias capas sin grupo común → se reemplaza **la primera** de la selección. |
| **R5** | Capa destino `bloqueada: true` → **no** se reemplaza; se avisa al admin. |
| **R6** | `tipo: 'placeholder'` reemplazado → pasa a `tipo: 'img'` y `envoltura: false` (el nuevo recurso es una imagen). |
| **R7** | El recurso nuevo se sube al catálogo `mockups` (`op=alta`, scope `mockups`) y el `ref` es `mock:<id>`. |
| **R8** | La perspectiva de cuatro puntos se ofrece con **una** capa o con un grupo (`puedePerspectiva()`); en el render la capa sin `grupo` usa la clave `i:{indice}` y un grupo `g:{gid}`. |

## 4. Lo que este contrato **no** promete

- La forma del **modal de confirmación** (UI interna; la cubre el quickstart y el recorrido de lab).
- Endpoints PHP nuevos (se reutilizan los vigentes).
- Cambios en `analisis.json` ni en `envolturas.json` (son inmutables/derivados).
- Cambios en el Motor PHP ni en el PDF final (el reemplazo es del **mockup**, no del PDF).
- Cambios en el formato de `config.json` (mismas claves y mismos rangos).

## 5. Criterios de verificación

- `debeReemplazar()` devuelve lo de la tabla §1 en los 4 escenarios.
- Tras un reemplazo, `x/y/w/h/rot/sesgo` son **idénticos** a los previos (SC-001).
- Tras reemplazar un grupo, cada miembro conserva su geometría y el grupo su `grupo_rot` (SC-002).
- Sin selección, la cantidad de capas aumenta (SC-004, no regresión).
- `analisis.json` no cambia (hash igual) tras cualquier reemplazo de mockup.
- Las puertas existentes siguen verdes (SC-005): CONTRATO 157, GEOMETRIA 135, `motor_smoke`, `parity`.
