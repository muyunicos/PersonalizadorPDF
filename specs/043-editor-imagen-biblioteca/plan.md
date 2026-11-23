# Implementation Plan: Editor de imagen y biblioteca del comprador

**Branch**: `043-editor-imagen-biblioteca` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/043-editor-imagen-biblioteca/spec.md`

## Summary

El comprador edita el encuadre de una foto **ya existente** sin volver a subirla: la miniatura del
campo abre el editor con su receta vigente, Guardar declara la receta nueva (0 bytes) y Cancelar
descarta. La tira del modal termina en **"Ver todas (N)"**, que abre el visor de la biblioteca para
elegir o borrar (con dialogo solo si la foto esta en uso). Todo se resuelve con las piezas
existentes: `SelectorPMU` (recorte), `CargadorPMU` (ranuras), `PMUBiblioteca` (tira), `PMUVisor`
(visor compartido) y los endpoints actuales (`subida_url`, `op=borrar`, catalogo). **No hay
endpoints nuevos, ni cambios en `engine/`, ni en el tema.**

## Technical Context

**Language/Version**: PHP 7.4+ (hosting Hostinger, PHP 8.x) en el servidor; JavaScript ES5 sin build
en el navegador (mismo estilo que `assets/*.js`).

**Primary Dependencies**: `assets/selector-pmu.js` (recorte), `assets/cargador-pmu.js` (ranuras),
`assets/biblioteca-pmu.js` (tira y visor), `assets/visor-pmu.js` (`PMUVisor`),
`assets/tienda.js` (registro de fotos y cola), `inc/class-pmu-uploads.php` (catalogo y borrado),
`inc/class-pmu-sesion.php` (manifiesto y recetas). Sin librerias nuevas.

**Storage**: `uploads/pmu/{tmp/sesion-{sid}|orders/{uid}}/uploads/uploads.json` con una entrada por
foto y sus **recetas por contexto** (`{aspecto}-{familia}-{area}`, spec 047); manifiesto del item con una fila por
receta (`origen: compuesta`, `orig.id`). Sin IndexedDB ni copia local de fotos.

**Testing**: puertas PHP (`php -l`, `tests/catalogo_uploads.php`, `tests/media_lectura.php`,
`tests/sin_lectura.php`, fases de `tests/texto_puente.php` `fotos`, `receta`, `composicion`,
`motor_smoke`, `parity`), suites Node (`tests/selector-contrato.test.js`,
`tests/biblioteca-contrato.test.js`, `tests/campos-contrato.test.js`) y la puerta de navegador
`tests/ficha-pedido.browser.js` en el laboratorio.

**Target Platform**: WordPress + WooCommerce (Hostinger Business), navegador del comprador.

**Project Type**: plugin WordPress con assets de cliente; sin build.

**Performance Goals**: guardar una foto existente = **0 bytes de imagen**; abrir una foto = **1 GET**
como maximo (cache HTTP 7 dias + ETag); la primera apertura de la galeria sigue con **1 listado** y
**0 lecturas por el camino administrativo** (spec 042).

**Constraints**: sin endpoints nuevos; sin cambios en `engine/`; el visor del tema es dependencia
blanda; mensajes en espanol (sin tildes en codigo); el editor debe funcionar con el camino rapido y
con el respaldo.

**Scale/Scope**: biblioteca del comprador (hasta 10 contenedores escaneados); tira con N fotos y
chip "Ver todas (N)"; un editor por ranura.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Como lo cumple la 043 | Resultado |
|---|---|---|
| **I. WooCommerce Integration** | El editor no cambia el flujo ficha -> carrito -> pedido: solo altera la receta de fotos ya aceptadas. Las vistas y el `add-to-cart` siguen igual. | PASS |
| **II. Modular Architecture** | Se reutilizan `SelectorPMU`, `CargadorPMU`, `PMUBiblioteca` y `PMUVisor`; no se crea un motor de recorte, ni una tira, ni un visor nuevos. | PASS |
| **III. Render en navegador + inyeccion server-side** | El recorte y la composicion siguen en el navegador; el Motor solo inyecta el PNG resultante. La receta editada es la misma que consume `Compositor`. | PASS |
| **IV. Directory Structure (PMU)** | No se agregan rutas ni ambitos: se usan `uploads.json` (recetas por contexto), el manifiesto y los archivos existentes. Sin tablas ni catalogos nuevos. | PASS |
| **V. No Backward Compatibility** | No hay migracion: las filas `compuesta` y las recetas viejas se siguen leyendo. Si una receta no aplica, se cae a los valores por defecto. | PASS |
| **Validation** | Se ejecutan las puertas de `AGENTS.md` §9 que tocan el area (contratos, fases de `texto_puente`, `motor_smoke`, `parity`, navegador). | PASS |
| **Un dato, un dueno** | Las recetas siguen siendo de `PMU_Uploads`/`PMU_Sesion`; el cliente solo declara lo que el servidor ya sabe validar. | PASS |

Sin violaciones. El unico cambio de comportamiento es una **enmienda** a decisiones de la 039 y la
030 (ver `spec.md` §Amendments), justificada por el pedido del usuario.

## Project Structure

### Documentation (this feature)

```text
specs/043-editor-imagen-biblioteca/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones y alternativas
├── data-model.md        # Fase 1: entidades y flujos
├── quickstart.md        # Fase 1: recorrido de validacion
├── contracts/
│   ├── editor-imagen.md       # Contrato del editor (abrir/guardar/cancelar)
│   └── biblioteca-visor.md    # Contrato del visor de la biblioteca
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
assets/
├── selector-pmu.js      # Abrir con receta vigente; "Guardar/Cancelar"; declararReceta
├── cargador-pmu.js      # Miniatura abre el editor; acciones extensibles; Eliminar
├── biblioteca-pmu.js    # Chip "Ver todas (N)" siempre visible -> visor
├── visor-pmu.js         # Sin cambios funcionales: se reusa (confirmar, Elegir/Borrar)
└── tienda.js            # Registro de fotos: envia la receta al manifiesto (ya existe)

inc/
├── class-pmu-sesion.php # Sin cambios de contrato: una fila por receta (ya existe)
└── class-pmu-uploads.php# Sin cambios: catalogo de recetas y op=borrar (ya existen)

personalizador-pdf.php   # Sin endpoints nuevos: se reusan subida_url y op=borrar

tests/
├── selector-contrato.test.js   # Abrir con receta, Guardar sin subir, Cancelar
├── biblioteca-contrato.test.js # Chip "Ver todas (N)" y visor
├── campos-contrato.test.js     # Montaje del cargador intacto
├── texto_puente.php            # Fases fotos/receta/composicion
├── media_lectura.php           # Camino rapido intacto
└── ficha-pedido.browser.js     # Recorrido real en el laboratorio
```

**Archivos que NO se tocan**: `engine/` (Motor y Compositor), `modules/textmuy/`, el tema
`muyunicos`, `specs/010` (API) y las rutas de `uploads/pmu/`.

## Phases

### Phase 0 — Investigacion (`research.md`)

Resolver, con evidencia del codigo:

1. **R1 — Por que hoy se re-sube al reencuadrar**: `selector-pmu.js:1769-1818` cae al camino de
   subida cuando la receta cambia porque `declararReceta` no esta cableado en `cargador-pmu.js`.
2. **R2 — Donde vive la receta vigente**: memoria del cargador (`recetas[id]`, se pierde al
   recargar) vs catalogo (`uploads.json recetas[clave]`, servido por la lista rapida y por el
   respaldo). Se elige memoria -> catalogo -> defaults (igual que FR-002 y el contrato).
3. **R3 — Como se guarda una receta nueva**: `PMU_Sesion::registrar_fotos()` ya escribe una fila por
   receta con `orig.id` y `file` determinista; no hace falta servidor nuevo.
4. **R4 — Que gesto abre el editor**: `_miniTocar` hoy abre el visor; el contrato nuevo agrega
   "Editar recorte" como accion primaria y deja el visor como accion secundaria.
5. **R5 — Como se muestra "Ver todas (N)"**: `biblioteca-pmu.js` ya pinta un chip cuando desborda
   (`:297`, `:321`); se fuerza a mostrarse siempre y se cambia `onChip` para abrir el visor.
6. **R6 — Borrado con confirmacion**: `op=borrar` sin `confirmar` responde `referencias`; el visor
   ya tiene `confirmar/pregunta/textoOk` (spec 039 D1). Se reusa tal cual.
7. **R7 — Cache vs IndexedDB**: `media.php` ya sirve con `Cache-Control: private, max-age=604800` y
   `ETag`; IndexedDB no aporta y agrega cuota/privacidad/invalidacion.

### Phase 1 — Diseno (`data-model.md`, `contracts/`, `quickstart.md`)

- **Entidades**: foto, receta, entrada de biblioteca, fila del manifiesto, accion del editor.
- **Contrato del editor**: modos `nueva|editar`, apertura con `id` + receta, `Guardar` (subir o
  declarar), `Cancelar`, `Eliminar`; la lista de acciones es extensible.
- **Contrato del visor**: `Ver todas (N)` -> abrir con todas las fotos; `Elegir` carga en el editor;
  `Eliminar` sin uso = directo, con uso = dialogo y `confirmar=1`.
- **Quickstart**: E1 editar sin subir, E2 abrir desde la miniatura, E3 cancelar, E4 "Ver todas",
  E5 borrar en uso, E6 regresion de la 042.

## Complexity Tracking

No hay violaciones de la constitucion ni desvios que justificar. La complejidad nueva es **cero
codigo de servidor**: el trabajo es cablear contratos que ya existen y ajustar tres consumidores
(`selector-pmu.js`, `cargador-pmu.js`, `biblioteca-pmu.js`).