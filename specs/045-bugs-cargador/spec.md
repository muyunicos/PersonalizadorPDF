# Feature Specification: Bugs del cargador (estado entre aperturas)

**Feature Branch**: `045-bugs-cargador`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Auditoria de Fase 0 (`docs/auditoria-cargador.md`), hallazgos **A1** y **A2**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar una foto y luego cargar otra no pisa la editada (Priority: P1)

El comprador edita el recorte de una foto ya puesta (0 bytes, spec 043) y despues
carga una foto NUEVA en la misma ranura. La nueva debe **agregarse**, no reemplazar
a la que acaba de editar.

**Why this priority**: es una perdida silenciosa de una foto del carrito (la tira
sigue con la misma cantidad y el comprador no se entera).

**Independent Test**: test unitario de `_usarExistente` con `_reemplazo` cargado
(estado) + puerta de navegador `ficha-pedido.browser.js` (flujo real).

**Acceptance Scenarios**:

1. **Given** una ranura con `max >= 2` y la foto A, **When** edito A desde su
   miniatura y guardo, **Then** la tira sigue con A y `_reemplazo` queda limpio.
2. **Given** lo anterior, **When** cargo una foto nueva B, **Then** la tira queda
   con A y B (2 fotos), no solo B.
3. **Given** un reemplazo desde el visor con una foto de la biblioteca (0 bytes),
   **When** confirmo, **Then** el id queda en la **posicion** reemplazada (no al
   final) y `_reemplazo` se limpia.

---

### User Story 2 - Reabrir el editor no muestra la foto anterior (Priority: P1)

La instancia del selector se reutiliza por ranura. Al abrirlo de nuevo para una
foto nueva, el modal arranca **vacio**: sin la imagen anterior, sin `Eliminar` ni
`Ver en grande` hasta que se cargue una foto.

**Why this priority**: hoy el modal muestra la foto vieja y habilita acciones sobre
ella; el comprador cree que la carga no funciono y puede borrar la anterior.

**Independent Test**: test unitario de `_resetEstado()` + puerta de navegador
(abrir dos veces y comprobar que la segunda no trae la imagen anterior).

**Acceptance Scenarios**:

1. **Given** el selector ya usado, **When** se abre otra vez, **Then** no dibuja
   ninguna imagen y el primario sigue deshabilitado.
2. **Given** el selector reabierto, **When** cargo una foto, **Then** solo se ve la
   nueva.
3. **Given** el camino de edicion (biblioteca), **When** abro y cargo la foto,
   **Then** funciona igual que hoy (0 bytes).

---

### User Story 3 - Comentarios y documentacion alineados (Priority: P2)

**Why this priority**: el comentario de `selector-pmu.js` (039 D6) contradice el
codigo (040 A6 / 043 US1) y desvia al proximo cambio.

**Independent Test**: puerta de fuente (`selector-contrato`) + lectura.

---

## Requirements

- **FR-001**: `_usarExistente` honra `_reemplazo` (id en la posicion) y lo limpia
  tras un guardado de 0 bytes exitoso.
- **FR-002**: `open()` empieza con estado visual limpio (`imagen`, `ultimoBlob`,
  `_bib`, zoom, rotacion, desplazamiento, fondo, mascara).
- **FR-003**: el camino de edicion (abrir + `cargarDesdeBiblioteca`) sigue
  funcionando.
- **FR-004**: el camino de subida con bytes (`subirAsync` -> `_subir`) no cambia.
- **FR-005**: comentarios y docs alineados con 040 A6 / 043 US1.

## Success Criteria

- **SC-001**: editar + guardar y luego cargar otra deja la tira en **N+1** (puerta
  unitaria `cargador-estado`, A1.1/A1.2). El campo del lab trae `max: 1`, asi que el
  navegador cubre el flujo de edicion (SC-003) y no este caso.
- **SC-002**: reabrir el selector **no** muestra la foto anterior.
- **SC-003**: las puertas existentes siguen verdes (`selector-contrato`,
  `campos-contrato`, `biblioteca-contrato`, `receta-contrato`, `ficha-pedido`).
- **SC-004**: el test nuevo falla antes del fix y pasa despues.

## Key Entities

- `_reemplazo` (cargador): contexto de reemplazo pendiente (indice, posicion,
  `desdeVisor`).
- `_bib` (selector): foto de la biblioteca cargada en el editor.
- `imagen` / `ultimoBlob`: estado visual del selector.

## Assumptions

- La instancia del selector se sigue reutilizando por ranura (no se cambia la
  arquitectura).
- No se toca el servidor, la receta v2 ni el catalogo.

## Out of Scope

- Resto de la auditoria (A3-A8): spec 044 (limpieza/orden).
- Sintomas del usuario aun sin confirmar.