# Contrato — Red y subida de la ficha (036)

> Normativo para la implementacion. Nombres de archivo y de clave estables.

## C1 — Red al cargar (D7)

| Situacion | Descarga |
|---|---|
| ficha con campos de imagen | **0** imagenes del cliente al abrir; se piden al abrir el modal |
| ficha **sin** campo de tipo `texto` | **0** carga del motor minimo de TextMuy (`render-core.html`) |
| ficha con mockups | **1** bitmap aplanado por mockup + la info (transform + envoltura) de sus placeholders |
| ficha sin mockups | 0 imagenes de mockup |

- El motor de texto **ya** es lazy (`renderCore()`, `assets/tienda.js:778`); C1 solo lo **condiciona** a
  que exista un campo de tipo `texto`.
- Las imagenes del cliente (`assets/biblioteca-pmu.js` / `assets/visor-pmu.js`) **no** se cargan hasta
  abrir el modal.

## C2 — Mockup aplanado (D10)

- **Artefacto**: `pdfs/{nombre}/mockups/{mockup_id}.webp`.
- **Productor**: el **editor del admin** (`assets/mockups.js`) al guardar (Canvas -> WebP).
- **Contenido**: solo capas `tipo: img` **visibles**, con sus filtros/efectos/deformaciones.
- **Nunca** incluye los placeholders: van **encima**, con el PNG del comprador.
- **Invalidacion**: cambio de capas -> regeneracion en el mismo guardado (sin flag persistido).
- **Ausente**: la ficha degrada con **causa visible**; la consola lo regenera al abrir el editor.
- Al cliente se le pasa a `PMUMockup.componer` una lista con **1** capa `img` + los `placeholder`.

## C3 — Gate del boton (D8)

- `bloqueos.subidas = (pendientes() > 0)`.
- El boton "Agregar al carrito" se habilita solo con **`bloqueos` en falso**: `subidas`, `vistas`,
  `validez`, `minimos`.
- El gate de "visto" (035) **no** cambia; con la galeria auto-montada se satisface solo (P8).

## C4 — Cola de subida (D9)

- **Concurrencia acotada** (no N simultaneas), **FIFO**, **dedupe** por contenido (sha del original) y
  **reintentos** con backoff.
- Las subidas de una **misma creacion** (texto del mismo `pdf|gid|indice`) se **serializan**: la ultima
  gana y **reemplaza** la anterior.
- Lo que se sube: `original` (imagen del comprador) y `texto` (creacion de TextMuy); ambos **WebP** y
  con el **cap maximo predefinido**.

## C5 — Auto-montaje (D3/D4)

- Predicado unico "completo": `minimos` OK **y** `pendientes() == 0` **y** validez OK.
- Montar **una** vez al quedar "completo"; con la galeria abierta, **repintar** al editar.
- **No** hay boton "Vista previa" ni "Volver a generar".
- La venta **nunca** queda bloqueada por un fallo de montaje (D5).