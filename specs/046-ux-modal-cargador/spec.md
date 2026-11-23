# Feature Specification: UX del modal de recorte y avisos del comprador

**Feature Branch**: `046-ux-modal-cargador`

**Created**: 2026-11-22

**Status**: Implementada (v4.36.2, 2026-11-22) — falta el recorrido manual del usuario y
las pasadas de spec clarify.

**Input**: relevamiento `docs/sintomas-comprador.md` (U1-U8) + respuestas del usuario.

## Clarifications

### Session 2026-11-22

- Q: Cuando el comprador toca "Agregar al carrito" y el bloqueo **no** son fotos faltantes (vistas obligatorias sin ver, validez o archivos subiendo), ¿qué aviso mostramos? → A: **el aviso del bloqueo que aplique** (faltantes / cola / vistas / validez), **el primero por prioridad**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Avisos solo cuando el comprador va a comprar (Priority: P1)

Durante la carga no se muestran avisos. Cuando el comprador toca **Comprar / Agregar
al carrito** y falta algo, se muestran los avisos (pueden convivir) y no se agrega.

**Why this priority**: hoy hay dos avisos permanentes ("Faltan 1 imagen(es)…" y
"Faltan 1 foto(s)…") que molestan y se pisan; el comprador los ve antes de terminar.

**Independent Test**: puerta de navegador (`ficha-pedido.browser.js`): al cargar no
hay aviso visible; al click de compra con faltantes, si.

**Acceptance Scenarios**:

1. **Given** una ficha con un campo imagen incompleto, **When** cargo la pagina,
   **Then** no hay ningun aviso visible.
2. **Given** lo anterior, **When** toco "Agregar al carrito", **Then** aparece el
   aviso (advertencia) y el carrito no se agrega.
3. **Given** la ficha completa, **When** toco "Agregar al carrito", **Then** no hay
   aviso y agrega normal.

---

### User Story 2 - El modal dice "Imagen #X" y el boton segun el contexto (Priority: P1)

**Acceptance Scenarios**:

1. **Given** una ranura con N fotos, **When** toco una miniatura, **Then** el titulo
   es "Imagen #N" (no "Reemplazando imagen #N").
2. **Given** una ranura vacia, **When** abro el modal, **Then** el titulo es
   "Imagen #1" y el boton dice "Cargar imagen".
3. **Given** una foto ya cargada, **When** abro el editor, **Then** el boton dice
   "Cambiar imagen".
4. **Given** una edicion sin cambios, **When** miro el primario, **Then** dice
   "Aceptar"; con cambios "Guardar"; con foto nueva "Subir"; eligiendo otra de la
   biblioteca "Cambiar".

---

### User Story 3 - Quitar "Ver en grande" y renombrar "Eliminar" (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el editor con una foto existente, **When** lo abro, **Then** **no**
   existe "Ver en grande".
2. **Given** la ranura estaba poblada, **When** abro el editor, **Then** aparece
   "Quitar" (los dos pasos si esta en uso).
3. **Given** una ranura vacia, **When** abro el modal, **Then** no aparece "Quitar".

---

### User Story 4 - Carga en segundo plano con indicador en la miniatura (Priority: P1)

**Acceptance Scenarios**:

1. **Given** una foto lista, **When** toco "Guardar"/"Subir", **Then** el modal
   cierra al instante y la miniatura muestra un spinner.
2. **Given** la subida termina, **When** responde el servidor, **Then** el spinner
   se reemplaza por la miniatura real.
3. **Given** la subida falla, **When** responde el error, **Then** la miniatura
   queda marcada con "!" y se puede reintentar.

---

### User Story 5 - "Todas (N)" siempre al final de la tira (Priority: P2)

**Why this priority**: el chip hoy solo aparece con la tira llena; el usuario
necesita abrir el visor completo siempre.

**Acceptance Scenarios**:

1. **Given** una biblioteca con 1..N fotos, **When** se pinta la tira del tema,
   **Then** el ultimo item es "Todas (N)" y abre el visor.

---

## Requirements

- **FR-001** (U1): los avisos de faltantes arrancan **ocultos**; se muestran al
  primer intento de compra (click en el area de compra) y recien ahi se ven.
- **FR-002** (U1): el aviso global y el del cargador pueden convivir; sin
  activacion, su texto no queda en el DOM (para no leerse).
- **FR-003** (U2/U6): titulo del modal = `Imagen #X` (nueva = #N+1, editar = #pos).
- **FR-004** (U3): primario por contexto: nueva `Subir`, sin cambios `Aceptar`,
  con cambios `Guardar`, biblioteca `Cambiar`.
- **FR-005** (U4): el boton secundario dice **siempre** `Cargar imagen` (sin
  "Cambiar imagen").
- **FR-006** (U5): se retira `Ver en grande`; `Eliminar` pasa a `Quitar` y solo se
  muestra con la ranura poblada.
- **FR-007** (U7): al aceptar, el modal cierra **antes** de que termine la subida;
  el progreso/error vive en la miniatura (`cpmu-mini`).
- **FR-008** (U8, tema): `mu-gal-linea` pinta `Todas (N)` **siempre** como ultimo
  item, con la accion `abrir` del plugin.
- **FR-009** (U1): al intentar comprar se muestra el aviso del **primer bloqueo
  aplicable** por prioridad: faltantes de fotos -> cola de subida -> vistas
  obligatorias -> validez. Sin bloqueo, no se muestra nada.

## Success Criteria

- **SC-001**: sin avisos hasta el click de compra (browser).
- **SC-002**: titulo `Imagen #X` y etiquetas por contexto (unit + browser).
- **SC-003**: no existe `Ver en grande`; existe `Quitar` (browser).
- **SC-004**: el modal cierra antes de la subida; el spinner aparece en la miniatura
  y se reemplaza (browser).
- **SC-005**: el chip `Todas (N)` aparece con 1 foto y con muchas (tema).
- **SC-006**: las puertas existentes siguen verdes (`selector-contrato`,
  `campos-contrato`, `biblioteca-contrato`, `ficha-pedido`).
- **SC-007**: con un bloqueo de vistas/validez (sin fotos faltantes), el aviso aparece
  al tocar comprar (browser).

## Key Entities

- `_pendientes[indice]`: blobs subiendo (para el spinner en la tira).
- `avisosActivos`: bandera de "mostrar avisos" (arranca false).
- `_contextoReemplazo` / `esReemplazo`: el titulo ya no decide el "¿Subir otra?".

## Assumptions

- El tema `muyunicos` es repo aparte (`C:\Users\Jonatan\Documents\GitHub\muyunicos`).
- No se cambia el servidor ni la receta.

## Out of Scope

- Spec clarify (pasadas posteriores).
- B2 (baja resolucion) si el fix defensivo no alcanza: pendiente de repro.