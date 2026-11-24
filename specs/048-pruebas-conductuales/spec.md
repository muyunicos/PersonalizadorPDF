# Feature Specification: Pruebas conductuales (deuda de asserts por regex)

**Feature Branch**: `048-pruebas-conductuales`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Deuda tecnica detectada en la auditoria de mantenibilidad (2026-11-22):
de **850** asserts de las suites Node, **435** son `regex.test(source)` — verifican
que el codigo **contiene** un texto, no que **se comporte** bien. El bug de las
allowlists (`onRecorte`/`paramsDe`/`gid`/`phsize` descartados en silencio) paso
las puertas porque el texto estaba: hacia falta ejecutar el codigo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Selector con comportamiento (Priority: P1)

Un desarrollador cambia el constructor o `_aceptar` del selector y la puerta se
pone roja **porque el comportamiento cambio**, no porque una cadena dejo de
coincidir.

**Why this priority**: `selector-contrato` tiene **201 asserts por regex** (mas
regex que checks: 144). Es la suite mas grande y la que menos cubre.

**Independent Test**: `node tests/conducta-selector.test.js` (25 checks, sin DOM).

**Acceptance Scenarios**:

1. **Given** una receta de un contexto, **When** se abre el editor, **Then** `_paramsIniciales` la guarda y `_params()` la devuelve completa.
2. **Given** una receta de OTRA geometria, **When** se intenta aplicar, **Then** devuelve `false` y no la aplica.
3. **Given** una foto de la biblioteca con receta, **When** se elige, **Then** `_recetaDeFoto` la resuelve (params -> ajustes -> recetas).

---

### User Story 2 - Biblioteca con comportamiento (Priority: P1)

La tira se pinta, el chip abre el visor y "Elegir" entrega la foto con su id,
todo con un DOM minimo (sin navegador).

**Why this priority**: `biblioteca-contrato` tiene **138 regex** y **0** checks de
comportamiento salvo el chip.

**Independent Test**: `node tests/biblioteca-contrato.test.js` (seccion de runtime).

**Acceptance Scenarios**:

1. **Given** una biblioteca de N fotos, **When** se pinta la tira, **Then** hay N miniaturas + 1 chip con `Ver todas (N)`.
2. **Given** la tira, **When** se toca una miniatura, **Then** `onElegir` recibe **esa** foto (con `id`).
3. **Given** el chip, **When** se toca, **Then** se abre el visor con todas las fotos.

---

### User Story 3 - Mockup: composicion real (Priority: P2)

`PMUMockup.componer` se ejecuta con un canvas stub y se comprueba que dibuja
todas las capas en orden y que el recorte queda dentro del lienzo.

**Why this priority**: `mockup-contrato` tiene 71 regex; el nucleo ya tiene
`mockup-geometria` (27 checks puros), pero la composicion no se ejecuta.

**Independent Test**: `node tests/mockup-contrato.test.js`.

**Acceptance Scenarios**:

1. **Given** dos capas (foto + marco), **When** se compone, **Then** el canvas recibe las dos en orden.
2. **Given** una capa fuera del lienzo, **When** se compone, **Then** se recorta sin romper.

---

### User Story 4 - Guia y helper compartido (Priority: P2)

Un helper `tests/_util/dom-stub.js` reutilizable por las suites, y una guia en
`AGENTS.md §9` que explique **cuando** usar regex (wiring) y cuando ejecutar.

**Why this priority**: sin guia, la deuda vuelve a crecer.

**Independent Test**: dos suites distintas requieren el helper.

**Acceptance Scenarios**:

1. **Given** una suite nueva, **When** necesita DOM, **Then** usa el helper (sin jsdom, sin dependencias).
2. **Given** un assert de wiring, **When** se revisa, **Then** se justifica por que no puede ser conductual.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Las suites criticas (`selector-contrato`, `biblioteca-contrato`, `mockup-contrato`) MUST ejecutar el codigo que verifican (sin leer el archivo como texto) en al menos el 60% de sus asserts.
- **FR-002**: Los asserts por regex se conservan SOLO para **wiring** (nombres, encolados, rutas) y MUST espanol-en-codigo: cada uno con comentario de por que no puede ser conductual.
- **FR-003**: Ninguna migracion puede **perder** cobertura: cada regex eliminado tiene un equivalente conductual o se justifica su baja.
- **FR-004**: El helper de DOM MUST ser propio (sin dependencias nuevas) y vivir en `tests/_util/`.
- **FR-005**: Las puertas siguen siendo `node tests/<suite>.test.js` (sin jest, sin jsdom, sin `npm i` en el repo).
- **FR-006**: `AGENTS.md §9` MUST documentar la nueva suite y la politica (regex = wiring).
- **FR-007**: Si el fix de una suite requiere DOM, MUST ser un stub minimo (no un navegador).

### Key Entities

- **Assert conductual**: ejecuta una funcion real y comprueba su resultado/estado.
- **Assert de wiring**: comprueba que dos piezas estan conectadas (texto/llamada), sin ejecutar.
- **DOM stub**: objeto minimo (`document`, `createElement`, `appendChild`, `classList`) para instanciar componentes sin navegador.

## Success Criteria *(mandatory)*

- **SC-001**: `selector-contrato` baja de **201** asserts por regex a **<50**, sin perder checks totales.
- **SC-002**: `biblioteca-contrato` suma **>=20** checks conductuales (tira, elegir, visor).
- **SC-003**: **0** puertas pasan de verde a rojo (las 47 suites + las de navegador).
- **SC-004**: `mockup-contrato` ejecuta `componer` con canvas stub en al menos 3 casos.
- **SC-005**: Un helper de DOM compartido reutilizado por **>=2** suites.

## Assumptions

- No se agregan dependencias (Playwright queda fuera del repo, como hoy).
- El DOM stub cubre lo que las suites necesitan; si falta algo, se agrega al helper.
- La migracion es **incremental**: suite por suite, con commit y puertas por suite.

## Out of Scope

- Migrar los tests PHP (ya son conductuales: `texto_puente`, `compositor`, `catalogo_uploads`).
- Tests de navegador (Playwright) — se quedan como estan.
- Cambiar la covertura de `modules/textmuy` (otro repo, 47 suites conductuales).