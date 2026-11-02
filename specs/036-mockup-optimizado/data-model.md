# Data model (036) — Ficha optimizada

## Entidades

### Mockup (admin) — `config.json:mockups[]`

| Campo | Regla |
|---|---|
| `id` | identificador del mockup (estable) |
| `capas[]` | el rejunte **editable** (contrato 011) — **sin cambios** en esta spec |
| — | el mockup **aplanado no** es un campo del JSON: es un **artefacto derivado** (ver abajo) |

### Mockup aplanado (artefacto NUEVO, D10)

| Campo | Regla |
|---|---|
| ruta | `pdfs/{nombre}/mockups/{mockup_id}.webp` (ambito `mockups` del PDF) |
| contenido | capas `tipo: img` **visibles** aplanadas (filtros/efectos/deformaciones incluidos) |
| quien lo produce | `assets/mockups.js` (Canvas -> WebP) al **guardar** el mockup |
| invalidacion | al cambiar las capas del mockup -> se **regenera** (no hay flag persistido) |
| ausente | la ficha **degrada con causa visible**; la consola lo regenera al abrir el editor |
| lugar en el cliente | una sola capa `img` que alimenta `PMUMockup.componer`; encima, los `placeholder` |

### Mockup del cliente (lo que se sirve)

| Elemento | Regla |
|---|---|
| fondo | el bitmap aplanado (1 sola descarga por mockup) |
| encima | los `placeholder` del mockup con su **transform** (`x/y/w/h/rot/grupo/grupo_rot/perspectiva`) y su **envoltura** |
| no se sirve | las capas `img` sueltas, ni el marco/controles del editor |

### Fila de subida (cola del comprador)

| Campo | Regla |
|---|---|
| tipo | `original` (imagen del comprador) \| `texto` (creacion de TextMuy) |
| clave | `sha` de los bytes (original, dedupe) / `pdf`+`gid`+`indice` (texto) |
| formato | **WebP** |
| tamano | **cap maximo predefinido** (P7: mismo criterio que la foto) |
| reemplazo | re-subir el mismo texto **reemplaza** la subida anterior (ultima version manda) |

### Estado de la ficha (cliente)

| Campo | Regla |
|---|---|
| `bloqueos` | `{vistas, validez, minimos, subidas}`; `subidas = pendientes() > 0` |
| "completo" | `minimos` satisfechos **y** `pendientes() == 0` **y** validez OK (unico predicado, R9) |
| montaje | **automatico** al quedar "completo"; se **repinta** al editar (no hay boton) |

### Visto (sin cambios, D6)

| Campo | Regla |
|---|---|
| `localStorage['pmu_vistas_v1'][item_key]` | marca por `mockup_id`; **no** se invalida |
| `manifest.vistos` | union al congelar; **sin** firma del mockup |

## Reglas de validacion

- Un mockup **sin** aplanado no rompe la ficha: degrada con causa visible.
- La cola **nunca** pierde la ultima version de un texto.
- El aplanado **nunca** incluye los placeholders (van encima, con el PNG del comprador).

## Transiciones (ficha)

```
abrir -> (campos listos) -> montar galeria (auto) -> ver (marca) -> (cola vacia) -> boton HABILITADO
                                                                      ^
                                 editar un campo ---- repinta la galeria ----
```

## Fuera del modelo (no entra)

- **Firma del mockup** / invalidacion del "visto": **eliminada** (D6).
- **Plano de 2 caras**: diferido hasta la medicion previa (P1).