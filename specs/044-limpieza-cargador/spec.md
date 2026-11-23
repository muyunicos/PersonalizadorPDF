# Feature Specification: Limpieza y orden del pipeline de carga

**Feature Branch**: `044-limpieza-cargador`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Auditoria `docs/auditoria-cargador.md` (A3-A8) + duplicacion nueva
(`objetivoDe`/`parseObjetivo`/`mejorReceta` en `cargador-pmu.js` y `selector-pmu.js`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un solo lugar para los helpers de receta (Priority: P1)

**Why this priority**: hoy `objetivoDe`/`parseObjetivo`/`mejorReceta` estan **duplicados**
en dos módulos; cualquier cambio se hace dos veces y pueden divergir.

**Independent Test**: `node tests/receta-objetivo.test.js` (helpers compartidos) +
`node tests/cargador-lote.test.js` y `selector-contrato` (consumidores).

**Acceptance Scenarios**:

1. **Given** el plugin cargado, **When** se usan los helpers, **Then** se resuelven por
   el módulo compartido `assets/receta-objetivo.js`.
2. **Given** el módulo no esta (uso en Node sin cargarlo), **When** se usan los helpers,
   **Then** hay un fallback minimo y una advertencia (no rompe).

---

### User Story 2 - Un solo normalizador de ranura (Priority: P1)

**Why this priority**: `PURO.normalizarRanura` (ficha) y `normalizarRanuras` (cargador)
son dos implementaciones de la misma ranura; AGENTS §5 ya lo advierte y hay una puerta
anti-divergencia.

**Independent Test**: `node tests/campos-contrato.test.js` (anti-divergencia) +
`ficha-pedido.browser.js`.

**Acceptance Scenarios**:

1. **Given** una ranura con `phsize`/`gid`/`transp`, **When** la normaliza la ficha o el
   cargador, **Then** el resultado es **el mismo**.
2. **Given** una ranura invalida (sin `w/h`), **When** se normaliza, **Then** se descarta
   igual que hoy.

---

### User Story 3 - Sin estado pegajoso ni codigo muerto (Priority: P2)

**Why this priority**: el respaldo de la biblioteca se queda en `wp` para toda la sesion
tras un fallo, `config()` cachea endpoint/nonce, y `f.base` es codigo muerto.

**Acceptance Scenarios**:

1. **Given** un fallo puntual del camino liviano, **When** la siguiente apertura funciona,
    **Then** vuelve a intentar el camino liviano (no se queda en `wp`).
2. **Given** una ficha con otra identidad, **When** se pide la biblioteca, **Then** no se
    reutiliza el endpoint/nonce viejo.
3. **Given** el payload del servidor, **When** se dibuja la tira, **Then** no se usa
    `f.base` (no existe).

---

## Requirements

- **FR-001**: los helpers de receta viven en `assets/receta-objetivo.js` y los consumen
  `cargador-pmu.js` y `selector-pmu.js` (con fallback minimo).
- **FR-002**: un **único** normalizador de ranura, usado por la ficha y por el cargador,
  con la puerta anti-divergencia en verde.
- **FR-003**: `modo` vuelve a `auto` tras un éxito del camino liviano.
- **FR-004**: `config()` se invalida cuando cambia la identidad/revision.
- **FR-005**: se retira el codigo muerto `f.base`.
- **FR-006**: sin cambios de comportamiento (solo orden): las puertas deben pasar antes y
  despues; un commit por bloque.

## Success Criteria

- **SC-001**: `node tests/receta-objetivo.test.js` verde.
- **SC-006**: `selector-contrato`, `campos-contrato`, `biblioteca-contrato` y
  `ficha-pedido.browser.js` verdes antes y despues.
- **SC-003**: no quedan duplicados de `objetivoDe`/`mejorReceta`.
- **SC-004**: la ficha y el cargador normalizan igual (puerta anti-divergencia).
- **SC-005**: `grep f.base` no aparece en `assets/`.

## Key Entities

- `assets/receta-objetivo.js`: helpers puros compartidos.
- `PURO.normalizarRanura` / `CargadorPMU.normalizarRanuras`: normalizadores.

## Assumptions

- No se toca el servidor, el Motor ni los datos (`uploads/`).
- Los helpers son funciones puras; el módulo no depende de WordPress.

## Out of Scope

- Cambios de UX (esos van a la 046, ya implementada).
- Migraciones de datos.