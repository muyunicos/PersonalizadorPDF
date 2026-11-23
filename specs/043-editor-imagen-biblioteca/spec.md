# Feature Specification: Editor de imagen y biblioteca del comprador

**Feature Branch**: `043-editor-imagen-biblioteca`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "El cliente toca una imagen de la tira del campo y puede eliminarla, editar el recorte (a futuro habra mas ajustes: imagen, texto) o cargar una imagen nueva o elegir una existente de la tira del modal, que muestra 'Ver todas (N)' para abrir la biblioteca completa en un visor. Si abre el visor puede seleccionar una imagen o borrarla de su biblioteca. Cancelar no guarda; Guardar sube la imagen si es nueva y, si es existente, no la vuelve a subir y solo guarda los ajustes de recorte si cambiaron. Al borrar, si la imagen esta en uso se avisa con un dialogo; si no, se borra directamente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar el recorte sin volver a subir la imagen (Priority: P1)

Un comprador ya tiene una foto puesta en un campo y quiere corregir el encuadre: acerca, aleja,
mueve o cambia el modo de encaje. Al guardar, la foto es la misma: no se sube ningun archivo
nuevo, no aparece otra foto en su biblioteca y el PDF final usa el encuadre nuevo.

**Why this priority**: es el sintoma que reporto el usuario. Hoy, al reencuadrar una imagen
elegida de la biblioteca, el sistema vuelve a subir una composicion nueva (bytes duplicados y un
`id` nuevo). La spec 039 ya cerro el modelo "una imagen + N recetas", pero el cliente nunca
declara la receta: la rama de 0 bytes existe y no se usa.

**Independent Test**: partir de una foto con receta guardada, abrir su edicion, cambiar la escala,
guardar y comprobar que no hubo ninguna subida de bytes y que la carpeta de originales tiene la
misma cantidad de archivos que antes.

**Acceptance Scenarios**:

1. **Given** una foto existente con receta guardada para el contexto del campo, **When** el comprador cambia la escala y guarda, **Then** no viaja ningun byte de imagen y la fila del manifiesto sigue apuntando al mismo `orig.id`.
2. **Given** la misma foto editada, **When** se genera la vista previa y el PDF, **Then** el encuadre es el nuevo y el original no cambio.
3. **Given** una foto existente sin receta para ESE contexto, **When** el comprador la coloca y guarda, **Then** se declara la receta nueva sin subir bytes.
4. **Given** dos campos que usan la misma foto con recetas distintas, **When** se edita una, **Then** la receta del otro campo no cambia.

---

### User Story 2 - La miniatura del campo abre el editor (Priority: P1)

El comprador toca una imagen de la tira del campo y el editor se abre con **esa** imagen cargada y
con su posicion, zoom, modo, rotacion y fondo ya aplicados. Desde ahi puede editar, eliminar,
cambiar por otra o cancelar.

**Why this priority**: sin esto, "editar el recorte" no tiene puerta de entrada. Hoy el toque abre
el visor (Reemplazar / Eliminar) y "Reemplazar" abre el recorte **sin** la receta anterior, asi que
el comprador vuelve a empezar de cero.

**Independent Test**: con una foto colocada en un campo, tocar su miniatura y comprobar que el
editor muestra el mismo encuadre que la foto tiene en el campo, sin tocar nada mas.

**Acceptance Scenarios**:

1. **Given** una miniatura del campo, **When** el comprador la toca, **Then** el editor se abre con la imagen y su receta vigente aplicada.
2. **Given** la receta guardada en el catalogo por contexto, **When** el editor abre, **Then** la toma de ahi (o de la memoria del cargador si esta mas fresca).
3. **Given** una foto sin receta guardada, **When** el editor abre, **Then** muestra la imagen con los valores por defecto del campo.
4. **Given** el editor abierto, **When** el comprador no cambia nada y guarda, **Then** no se escribe ninguna receta nueva ni se sube nada.

---

### User Story 3 - Guardar y Cancelar con una semantica clara (Priority: P1)

El editor tiene **Cancelar** y **Guardar**. Cancelar descarta los ajustes y no toca nada. Guardar
sube la imagen si es nueva y, si es existente, solo guarda la receta si cambio.

**Why this priority**: es la garantia de que "editar" no se comporte como "volver a subir". Sin
esto, el arreglo de US1 se puede revertir por accidente desde la interfaz.

**Independent Test**: abrir una foto existente, moverla, cancelar y comprobar que el encuadre
anterior sigue intacto; repetir guardando y comprobar que el encuadre nuevo persiste.

**Acceptance Scenarios**:

1. **Given** el editor con cambios, **When** el comprador cancela, **Then** no se sube nada, no se guarda la receta y el campo queda como estaba.
2. **Given** el editor con una imagen nueva, **When** el comprador guarda, **Then** se sube el original una sola vez y queda en la biblioteca.
3. **Given** el editor con una imagen existente y cambios, **When** el comprador guarda, **Then** se guarda la receta y no se sube ningun byte.
4. **Given** el editor con una imagen existente y sin cambios, **When** guarda, **Then** el editor se cierra sin escrituras.
5. **Given** un fallo de red al guardar, **When** ocurre, **Then** se ve la causa y los ajustes siguen en pantalla para reintentar.

---

### User Story 4 - "Ver todas (N)" abre la biblioteca completa (Priority: P2)

En el modal, junto al boton de cargar un archivo, esta la tira de imagenes del comprador y, al
final, **"Ver todas (N)"**. Al tocarlo se abre el visor de la biblioteca con todas sus fotos: puede
elegir una (entra al recorte) o borrarla de su biblioteca.

**Why this priority**: da acceso a la biblioteca completa sin depender de que la tira desborde, y
es la unica puerta para gestionar (borrar) fotos que no estan en ningun campo.

**Independent Test**: con una biblioteca de N fotos, abrir el modal, tocar "Ver todas (N)" y
comprobar que el visor muestra las N, que elegir una la carga en el recorte y que borrar una la
quita de la biblioteca.

**Acceptance Scenarios**:

1. **Given** el modal abierto, **When** el comprador toca "Ver todas (N)", **Then** se abre el visor con todas sus fotos y el numero coincide con N.
2. **Given** el visor abierto, **When** el comprador elige una foto, **Then** se carga en el lienzo del recorte con su receta para ese contexto.
3. **Given** el visor abierto, **When** el comprador borra una foto que no esta en uso, **Then** se borra directamente y desaparece de la tira y del visor.
4. **Given** una foto en uso por un item de carrito o un pedido, **When** el comprador intenta borrarla, **Then** se muestra un dialogo claro y solo se borra si confirma.
5. **Given** una biblioteca vacia, **When** abre el modal, **Then** la tira muestra el estado vacio y "Ver todas (0)" no abre un visor roto.

---

### User Story 5 - Eliminar la imagen del campo desde el editor (Priority: P2)

Desde el editor, el comprador puede **Eliminar** la imagen: se quita del campo y, si nadie mas la
usa, se borra tambien del servidor. Si esta en uso, se avisa antes.

**Why this priority**: hoy "Eliminar" vive en el visor del campo, un camino distinto del editor;
unificarlo deja un solo lugar para editar una imagen.

**Independent Test**: con una foto en un campo, abrir su editor, tocar Eliminar y comprobar que el
campo queda vacio y que la foto sale de la biblioteca.

**Acceptance Scenarios**:

1. **Given** el editor de una foto colocada, **When** el comprador toca Eliminar, **Then** la foto sale del campo y la miniatura desaparece.
2. **Given** una foto que otro item de la sesion usa, **When** se elimina, **Then** la fila del item se borra y el archivo se conserva.
3. **Given** un fallo de red al eliminar, **When** ocurre, **Then** la foto NO se saca del campo y se muestra la causa.

---

### Edge Cases

- La receta guardada no se puede aplicar al campo actual (otra geometria o `phsize`): se abre con los valores por defecto y se avisa sin bloquear.
- La imagen fue borrada en otra pestaña mientras el editor estaba abierto: al guardar se informa y no se re-suben bytes.
- El comprador edita una foto y cambia de contexto (otro campo con otro `gid`): la receta nueva es de ese contexto, la anterior se conserva.
- Dos campos comparten la misma foto: editar uno no cambia el encuadre del otro.
- La foto tiene envoltura (`envoltura: true`): la guia se mantiene y no altera la receta.
- Guardar dos veces seguidas: la segunda no crea filas repetidas (idempotente por receta).
- Cancelar despues de elegir una imagen nueva: la imagen no queda en la biblioteca.
- Se elimina la ultima foto de un campo con minimo: el aviso de faltantes vuelve a aparecer.
- La biblioteca tiene una sola foto: "Ver todas (1)" abre el visor con esa foto.
- Falta el visor compartido del tema: se usa el visor propio del plugin o se avisa con la causa; el editor sigue funcionando.
- Sin red al abrir el visor: se muestra el error con reintento, sin perder el estado del editor.
- El navegador no soporta cache HTTP: se sigue funcionando; a lo sumo se repite la descarga de la imagen abierta.
- La miniatura quedo marcada por un fallo de subida: el toque REINTENTA con el blob en memoria (039 D2) y no abre el editor; si no hay blob (recarga de pagina), abre el editor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST abrir el editor al tocar una miniatura del campo, con la imagen de esa miniatura y su receta vigente aplicada. Si la miniatura esta marcada por un fallo de subida, el toque MUST reintentar la subida (039 D2) y MUST NOT abrir el editor.
- **FR-002**: El sistema MUST resolver la receta del contexto en este orden: memoria del cargador, catalogo del comprador (`uploads.json`, recetas por contexto) y valores por defecto del campo.
- **FR-003**: La clave de la receta MUST ser la del contexto, de modo que dos campos distintos puedan usar encuadres distintos de la misma foto. **(Superada por la spec 047)**: la clave vigente es el objetivo `{aspecto 4dec}-{familia 0|1}-{area}` (`assets/receta-objetivo.js`); la anterior `{gid}-{w}x{h}-{phsize}` se ignora (sin migracion).
- **FR-004**: Al guardar una imagen existente con cambios, el sistema MUST declarar la receta nueva y MUST NOT subir bytes de imagen.
- **FR-005**: Al guardar una imagen existente sin cambios, el sistema MUST cerrar el editor sin escrituras (0 POST y 0 bytes; `usarExistente` puede llamarse como no-op local).
- **FR-006**: Al guardar una imagen nueva, el sistema MUST subir el original una sola vez (comportamiento actual).
- **FR-007**: Al cancelar, el sistema MUST descartar los ajustes sin subir ni escribir nada.
- **FR-008**: El sistema MUST permitir eliminar la imagen desde el editor y quitar su opcion del campo.
- **FR-009**: El editor MUST ofrecer "Cargar imagen" (archivo nuevo) junto a la tira de imagenes existentes.
- **FR-010**: La tira del modal MUST terminar con "Ver todas (N)", visible siempre, con el total de fotos de la biblioteca.
- **FR-011**: "Ver todas (N)" MUST abrir el visor de la biblioteca con todas las fotos del comprador.
- **FR-012**: El visor MUST permitir seleccionar una foto (carga en el editor con su receta) y borrarla de la biblioteca.
- **FR-013**: Al borrar una foto sin uso, el sistema MUST borrarla directamente; si esta en uso (carrito o pedidos), MUST mostrar un dialogo y borrar solo con confirmacion.
- **FR-014**: El sistema MUST reutilizar el endpoint de borrado existente y su confirmacion en dos pasos; NO se agregan endpoints nuevos.
- **FR-015**: El sistema MUST mantener intacto el camino rapido de lectura (1 listado, 0 lecturas por el camino administrativo) y el respaldo actual.
- **FR-016**: El sistema MUST NOT guardar copias de las fotos en el navegador (sin IndexedDB): la imagen abierta se sirve con la cache HTTP existente.
- **FR-017**: Las acciones del editor MUST definirse como una lista extensible: agregar una accion a `config.acciones` debe pintarse sin editar el modal (se verifica con una accion extra inyectada en la suite de contrato).
- **FR-018**: El Motor y los PNG del PDF MUST NOT cambiar: la receta editada es la misma que ya consume el compositor.

### Key Entities

- **Foto original**: imagen del comprador identificada por `id` estable (hash del contenido crudo); no cambia al editar el encuadre; tiene una o mas recetas.
- **Receta**: como se coloca una foto en un contexto (`w`, `h`, `modo`, `escala`, `ox`, `oy`, `rot`, `fondo`, `gid`, `phsize`); es la identidad de la composicion y la clave del archivo determinista.
- **Entrada de la biblioteca**: foto listada para el comprador (`id`, miniatura, medidas, `recetas`, fecha); no incluye bytes en la lista.
- **Fila del manifiesto**: como participa una foto en el pedido (`origen`, `file` determinista, `orig.id`, `params`, `indice`); una fila por receta.
- **Accion del editor**: operacion disponible sobre la imagen (`editar recorte`, `eliminar`, `cargar nueva`, `ver todas`); hoy cuatro, extensible a futuro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Editar una imagen existente y guardar produce **0 bytes de imagen subidos** y **0 archivos nuevos** en la carpeta de originales.
- **SC-002**: Tocar una miniatura del campo abre el editor **en una sola interaccion** y el encuadre mostrado coincide con el del campo.
- **SC-003**: Guardar una receta nueva **no aumenta** la cantidad de fotos de la biblioteca; solo agrega una receta al mismo `id`.
- **SC-004**: "Ver todas (N)" abre el visor con **todas** las fotos y el numero mostrado coincide exactamente con la cantidad real.
- **SC-005**: Borrar una foto sin uso no muestra dialogo; borrar una en uso **siempre** muestra el dialogo antes de borrar.
- **SC-006**: Cancelar despues de cualquier ajuste deja el campo **exactamente** como estaba antes de abrir el editor.
- **SC-007**: La primera apertura de la galeria sigue haciendo **1 solicitud de listado** y **0 lecturas por el camino administrativo**.
- **SC-008**: Ninguna puerta existente del proyecto pasa de verde a rojo por este cambio.

## Assumptions

- El `id` de la foto es estable (hash del contenido crudo): dos navegadores con la misma foto producen el mismo `id`.
- El catalogo del comprador (`uploads.json`) guarda las recetas por contexto y ya se sirve por el camino rapido de la spec 042.
- La cache HTTP de las imagenes (7 dias + validacion) alcanza para abrir la misma foto sin volver a descargarla.
- El visor compartido puede faltar: es una dependencia blanda y el editor sigue funcionando con el visor propio o con un aviso.
- El tema puede faltar: la tira tiene su version propia en el plugin.
- No hay migracion de datos: las filas `compuesta` existentes siguen siendo validas.

## Dependencies

- **016/021/024/028**: editor de recorte, visor y modos de encaje (se reutilizan, no se reescriben).
- **027**: transparencia del campo.
- **030/039**: biblioteca del comprador, visor compartido y friccion de cargas (esta spec enmienda dos puntos de la 039).
- **035**: original + receta; composicion bajo demanda.
- **040**: catalogo de uploads con recetas por contexto.
- **042**: lectura rapida y respaldo.

## Out of Scope

- Edicion de imagen avanzada (filtros, texto sobre la foto): solo se deja la lista de acciones extensible.
- IndexedDB u otra copia local de las fotos.
- Migracion de datos existentes.
- Cambios en el tema `muyunicos`, en `engine/` o en la API de la spec 010.
- Multi-seleccion de archivos o reordenar la tira arrastrando.

## Amendments (superadas por esta spec)

- **039**: D2 (el toque de la miniatura abre el visor) y D3/US3.4 (no se borra desde la biblioteca) quedan **superadas** por D2, D4 y D5 de esta spec; SC-003 ("0 POST si esta en IndexedDB") queda **superada** por FR-016.
- **030**: la clarificacion 4a ("tira siempre visible, sin boton") y D8 (`Elegir` vs `Subir`) quedan **superadas** por FR-010, FR-012 y FR-004.
- **016**: D7 (`Elegir`) queda **superado**.
- **Documentacion**: `AGENTS.md` §5/§9, `assets/biblioteca-pmu.js` (cabecera) y `docs/decisiones.md` deben dejar de describir `Elegir`/`familias` y describir este flujo.

## Decisions (cerradas 2026-11-20)

- **D1**: una foto = un `id`; una receta nueva **nunca** sube bytes.
- **D2**: la miniatura del campo abre el **editor con la receta vigente** (no el visor).
- **D3**: **Guardar** sube solo si es nueva; **Cancelar** descarta.
- **D4**: al final de la tira va **"Ver todas (N)"**, siempre visible, y abre el visor de la biblioteca.
- **D5**: borrar sin uso = directo; en uso = dialogo y reintento con confirmacion.
- **D6**: sin IndexedDB; se usa la cache HTTP (7 dias + validacion).
- **D7**: acciones extensibles (recorte hoy; ajustes/texto despues).

## Enmienda 2026-11-22 (fix de la vista previa)

- **D8 (nueva)**: la miniatura del campo y la galeria dibujan el **recorte local** (el blob que
  compuso el selector al guardar, `PMU_API.anotarRecorte`), **no** el PNG del pool. Si todos los
  grupos de imagen tienen recorte local, la vista previa no rasteriza ni sube nada (**0 POST**).
- **D9 (nueva)**: la clave del pool de **fotos** es la **receta**
  (`img/foto-{pdf}-{gid}-{receta}.webp`, `PMU_Sesion::receta_de`, siempre del servidor).
  `hash_pool()` y `PURO.hashRender()` quedan **solo para texto**: el texto no se recorta.
- **Puertas**: `php tests/texto_puente.php composicion` (+3 checks) y `ficha-pedido.browser.js`
  E1 (mini=`blob:` y vista previa=`blob:`).