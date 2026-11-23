# Feature Specification: Carga multiple de imagenes

**Feature Branch**: `047-carga-multiple`

**Created**: 2026-11-22

**Status**: Draft

**Input**: decision del usuario (2026-11-22): reemplazar el "¿Subir otra?" (retirado en
la 046) por **carga multiple**: arrastrar varios archivos al campo o elegir varias en
"Cargar imagen"; con N>1 la edicion es **predeterminada** (`cubrir`) y se suben al
servidor; despues se pueden editar individualmente tocando la miniatura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Arrastrar/elegir varias fotos y subirlas de una (Priority: P1)

**Why this priority**: es el caso real de credenciales y certificados (varias fotos),
y reemplaza al modal "¿Subir otra?" que la 046 retiro.

**Independent Test**: test unitario de `_subirLote` (tope `max`, receta por defecto)
+ puerta de navegador (campo con `max >= 2`, 3 archivos -> 3 miniaturas).

**Acceptance Scenarios**:

1. **Given** una ranura con `max = 3`, **When** arrastro 3 archivos al campo,
   **Then** se suben los 3 y la tira muestra 3 miniaturas.
2. **Given** una ranura con `max = 2`, **When** elijo 3 archivos, **Then** entran 2 y
   se avisa que solo caben 2.
3. **Given** una foto ya cargada, **When** toco su miniatura, **Then** se abre el
   editor con su receta (igual que hoy).

---

### User Story 2 - Edicion predeterminada para el lote (Priority: P1)

**Acceptance Scenarios**:

1. **Given** un lote de N>1, **When** se sube, **Then** cada foto lleva una receta
   v2 por defecto: `modo = cubrir`, `escala = 1`, `ox/oy` al centro, `rot = 0`,
   `fondo` segun `transp`, `gid`/`phsize`/`w`/`h` de la ranura.
2. **Given** el lote subido, **When** toco una miniatura, **Then** el editor abre con
   esa receta y puedo reencuadrar (0 bytes si no cambio nada).
3. **Given** un solo archivo, **When** lo cargo, **Then** se abre el editor como hoy
   (no se saltea).

---

### User Story 3 - Errores y limites visibles (Priority: P2)

**Acceptance Scenarios**:

1. **Given** un archivo que no es imagen, **When** lo arrastro, **Then** se avisa y
   los demas del lote siguen.
2. **Given** una subida que falla, **When** responde el error, **Then** esa miniatura
   queda marcada con "!" y se puede reintentar.
3. **Given** una ranura llena, **When** intento sumar mas, **Then** se avisa el tope.

## Requirements

- **FR-001**: el input de archivo admite `multiple` cuando `max > 1`; el drop del
  campo acepta N archivos.
- **FR-002**: con N>1 se omite el editor y se sube cada archivo con una **receta v2
  por defecto** (`cubrir`, escala 1, centro, sin rotar).
- **FR-003**: con N=1 se conserva el editor.
- **FR-004**: el lote respeta el `max` de la ranura; si sobran, se avisa.
- **FR-005**: cada archivo del lote tiene su placeholder con spinner y su marca de
  error/reintento.
- **FR-006**: el formato se valida por firma (servidor) y el aviso de archivo ilegible
  es por archivo, sin cortar el lote.

## Success Criteria

- **SC-001**: 3 archivos en una ranura con `max >= 3` -> 3 miniaturas.
- **SC-002**: 3 archivos en una ranura con `max = 2` -> 2 miniaturas + aviso.
- **SC-003**: una miniatura del lote abre el editor con la receta por defecto.
- **SC-004**: las puertas existentes siguen verdes.

## Key Entities

- `_pendientes[indice]`: placeholders de subida (spinner).
- `_subir(indice, blob, posicion, params)`: la receta explicita manda.
- `max` (selector): habilita `multiple` y el tope del lote.

## Assumptions

- El servidor sigue recibiendo el **original** acotado + la receta (spec 035).
- La receta por defecto se arma con las mismas claves v2 (`v,w,h,forma,modo,escala,
  ox,oy,fondo,transp,rot,iw,ih,phsize,gid`).

## Out of Scope

- Cambiar el `Compositor` o el Motor.
- Edicion masiva (mover/rotar N fotos de una).