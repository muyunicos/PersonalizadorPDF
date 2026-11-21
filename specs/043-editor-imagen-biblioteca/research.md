# Research — Editor de imagen y biblioteca del comprador

**Feature**: 043-editor-imagen-biblioteca | **Fecha**: 2026-11-20

Fase 0: cada decision con su evidencia en el codigo, su justificacion y las alternativas que se
descartaron. No quedan incognitas abiertas.

## R1 — Por que hoy se vuelve a subir al reencuadrar

**Decision**: el cliente declara la receta nueva; el servidor ya sabe guardarla.

**Evidencia**: `assets/selector-pmu.js:1769-1814` solo evita la subida si la receta **coincide** o
si existe `config.declararReceta` (`:1790`). `assets/cargador-pmu.js:398-435` construye el selector
**sin** `declararReceta`, asi que cualquier cambio de encuadre cae al camino de subida
(`:1816-1818`) y sube la composicion: bytes nuevos y `id` nuevo.

**Rationale**: el modelo "una imagen + N recetas" ya existe en el servidor
(`inc/class-pmu-sesion.php:533-640`: una fila por receta, `file` determinista, `orig.id` intacto) y
en el catalogo (`uploads.json recetas[clave]`). Solo falta la pieza del cliente.

**Alternativas descartadas**:
- Subir siempre y deduplicar por `sha`: no sirve porque la **composicion** tiene otro contenido; el
  `id` cambia y la biblioteca se llena de originales redundantes.
- Endpoint nuevo `op=receta`: innecesario; `registrar_fotos` ya lo hace al registrar el grupo.

## R2 — Donde vive la receta vigente de un contexto

**Decision**: catalogo del comprador -> memoria del cargador -> valores por defecto.

**Evidencia**: `PMU_Lectura::listar()` devuelve `recetas` por foto
(`inc/class-pmu-lectura.php:239`) con la clave `{gid}-{w}x{h}-{phsize}`
(`inc/class-pmu-sesion.php:607`); el respaldo devuelve el mismo mapa. `CargadorPMU.recetas[id]`
(`cargador-pmu.js:517`, `:633`) solo vive en memoria y se pierde al recargar. `SelectorPMU._recetaDeFoto()`
(`selector-pmu.js:1158`) ya sabe leer el mapa del listado.

**Rationale**: el catalogo es el unico que sobrevive a una recarga y a otra pestaña; la memoria sirve
para el caso inmediato (recien subida, sin pasar por el listado).

**Alternativas descartadas**:
- Leer `params` del manifiesto: la ficha no lo publica y agregarlo seria otro contrato.
- Guardar la receta en `localStorage`: se desincroniza con el borrado y con otra pestaña.

## R3 — Como se guarda una receta nueva sin subir bytes

**Decision**: `declararReceta(id, params)` -> `CargadorPMU._usarExistente()`; `tienda.js` registra el
grupo con esos `params` y `PMU_Sesion::registrar_fotos()` escribe la fila.

**Evidencia**: `cargador-pmu.js:618-639` (`_usarExistente`) ya anota el id, guarda la receta y publica
`onRecorte`; `tienda.js` ya envia `{id, receta}` por instancia al registrar el grupo (fase `fotos`
de `tests/texto_puente.php`).

**Rationale**: es el camino mas corto entre lo que ya existe y lo que falta; no toca el servidor.

**Alternativas descartadas**:
- Subir un PNG con la receta estampada: gasta disco y rompe la 042 (solo lee originales).

## R4 — Que gesto abre el editor

**Decision**: tocar la miniatura abre el editor con esa imagen y su receta. El visor del campo queda
como accion secundaria ("Ver en grande", "Eliminar").

**Evidencia**: hoy `_miniTocar` (`cargador-pmu.js:731-736`) reintenta si fallo y, si no, abre el
visor (`_abrirVisorCompartido`). "Reemplazar" (`_cambiar`, `:804-807`) abre el selector **sin**
receta (`_abrir(indice, null)`).

**Rationale**: el gesto mas frecuente sobre una foto puesta es corregir el encuadre, no borrarla ni
reemplazarla. El reintento de fallos (039 D2) se conserva **antes** del menu.

**Alternativas descartadas**:
- Menu intermedio (hoja de acciones): un toque mas para el caso principal.
- Doble toque para editar: no es descubrible.

## R5 — "Ver todas (N)"

**Decision**: el chip se muestra **siempre** al final de la tira y abre el visor de la biblioteca.

**Evidencia**: `assets/biblioteca-pmu.js:297` calcula cuantas celdas caben y `:321` pinta el chip
"Ver todas tus imagenes" cuando desborda; `:274` hoy lo usa para **seleccionar**, no para abrir el
visor. `:34` ya documenta que el visor muestra **todas** las fotos, no solo las visibles.

**Rationale**: el modal ya tiene "Cargar imagen" a la izquierda; un `+` al final se confundiria con
"agregar". El chip con contador dice exactamente lo que hace y ademas es la puerta de gestion.

**Alternativas descartadas**:
- `+` como ultima celda: ambiguo con "Cargar imagen" (lo descarto el usuario).
- Boton "Biblioteca" aparte: agrega cromo y duplica la tira.

## R6 — Borrado con confirmacion

**Decision**: reusar `op=borrar` en dos pasos y el dialogo del visor.

**Evidencia**: `personalizador-pdf.php:2410-2440` responde `referencias` sin `confirmar` y borra con
`confirmar=1`; `visor-pmu.js` acepta `confirmar`, `pregunta` y `textoOk` (039 D1). `CargadorPMU._quitar`
(`cargador-pmu.js:823-854`) ya reintenta con `confirmar=1`.

**Rationale**: el servidor ya distingue "en uso"; el cliente solo decide **cuando** preguntar. Sin
uso = borrado directo (lo pedido); con uso = dialogo.

**Alternativas descartadas**:
- Preguntar siempre: molesta en el caso normal.
- No preguntar nunca: rompe pedidos que dependen del archivo.

## R7 — Cache HTTP vs IndexedDB

**Decision**: sin IndexedDB; la imagen se sirve con la cache HTTP existente.

**Evidencia**: `media.php:133` y `:151` mandan `Cache-Control: private, max-age=604800` + `ETag`;
el listado ya trae miniaturas embebidas y ventana de frescura de 5 min (spec 042).

**Rationale**: la segunda apertura de la misma foto es un cache hit (0 red) y a los 7 dias se
revalida con 304. IndexedDB duplica eso y agrega cuota, privacidad e invalidacion al borrar.

**Alternativas descartadas**:
- IndexedDB como cache de originales: complejidad sin ganancia medible; queda para una spec de
  funcionamiento offline si algun dia se necesita.

## Incognitas abiertas

Ninguna. Las 7 decisiones (D1-D7) se cerraron con el usuario el 2026-11-20 y se reflejan en
`spec.md` §Decisions.