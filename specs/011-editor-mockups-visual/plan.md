# Implementation Plan: editor-mockups-visual

**Branch**: `011-editor-mockups-visual` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-editor-mockups-visual/spec.md`

## Summary

El editor de mockups de la consola es, hoy, HTML sin una sola regla de estilo propio, manejado con
seis campos numericos y dos `window.prompt`. Esta feature lo convierte en un editor visual de
escritorio **embebido en dos columnas** dentro de la seccion "Mockups" (decision D1), con lienzo de
trabajo ampliable y nitido, manipulacion directa (arrastrar, redimensionar, rotar, imanes), recursos
con galeria y catalogo, y **autoguardado con deshacer**. El preview del texto se **reutiliza del
boton "Probar"** que ya existe (D2): no se crea ningun motor de render nuevo, se publica un store
cliente con cache por hash y el lienzo se repinta solo. Al componer, el hueco pasa a **encajar sin
deformar**, con aviso de discrepancia de proporcion, tanto en el editor como en la ficha del
cliente: eso corrige una deformacion vigente y deja de incumplir el criterio de aceptacion de la
spec 004 ("la galeria del admin y la del cliente usan el mismo render, una sola funcion"). Todo se
apoya en un **nucleo de composicion compartido** (`assets/mockup-render.js`) y otro de **geometria
pura** (`assets/mockup-geometria.js`), con el contrato de datos ampliado de forma retrocompatible
(campos opcionales; sin migracion). El motor PDF, el modulo TextMuy y las rutas de datos no se tocan.

## Technical Context

**Language/Version**: PHP 7.4+ minimo (objetivo Hostinger Business PHP 8.5.4) en el lado servidor
(solo validacion y guardado). Cliente: JavaScript en el sabor vigente del repo (jQuery ya presente;
`const`/`let` y arrow functions ya se usan en el plugin y en el modulo), HTML5 Canvas 2D y CSS Grid.
**No se requiere WebGL ni framework nuevo**.

**Primary Dependencies**: WordPress (ultima version, como el resto del plugin) + WooCommerce
(presente; esta feature **no lo toca**). Piezas internas reusadas, sin duplicar:
`inc/class-pmu-uploads.php` (`guardar_config`, `config_mockups`, `listar('img')`, `dir_mockups`),
`personalizador-pdf.php` (`handle_mockups_guardar`, `mockups_para_editor`, `puente_textmuy`),
`assets/admin.js` (`pmuPost`/`pmuAviso`, `renderCore()`, `.ec-probar`),
`modules/textmuy/js/api.js` (`TextMuyAPI.renderBatch`, ya usado, **sin cambios en el modulo**).

**Storage**: sin estructura nueva. `uploads/pmu/pdfs/{nombre}/config.json:mockups[]` (contrato
ampliado, campos opcionales) + `uploads/pmu/pdfs/{nombre}/mockups/{archivo}` (fotos del PDF) +
`uploads/pmu/img/` (catalogo, **solo lectura** desde el editor). Sin tablas (constitution §IV).

**Testing**: `php -l` (plugin, `admin/`, `engine/`, `inc/`), `php tests/motor_smoke.php`,
`php tests/parity.php`, `php tests/texto_puente.php` en todas sus fases (**fases nuevas** para el
contrato ampliado), `node tests/mockup-geometria.test.js` (geometria pura) y `smoke_checks()` en el
sitio real. **No** se tocan `modules/textmuy/` ni sus 16 suites Node (sin bump `?v=RCn`).

**Target Platform**: navegador de escritorio (Chrome/Edge/Firefox actuales) en la consola de
WordPress; raton + teclado. Degradacion a una columna en pantallas estrechas (FR-005). El hosting
sigue siendo PHP puro compartido.

**Project Type**: plugin para WordPress con consola de administracion (capa cliente rica) + motor
PHP server-side. Editor de capas client-side que escribe en el unico config editable del PDF.

**Performance Goals**: lienzo fluido con 20+ capas (SC-005): repintado interactivo sin saltos
perceptibles; autoguardado que no bloquea la interfaz; abrir el editor **no genera renders** de los
grupos ya previsualizados (FR-021); "Probar" repinta las capas afectadas en <= 2 s (SC-004).

**Constraints**: constitution §III (render 100% en navegador; el servidor **nunca** renderiza ni
evalua JS), §IV (datos solo en `uploads/pmu/`; ninguna ruta fuera de `PMU_Uploads`), §II (un solo
escritor de catalogos y miniaturas: `assets/miniaturas.js`; el editor **no** escribe catalogos),
sin dependencias nativas en servidor, sin Node en produccion, mensajes e interfaz en espanol. La
salida del mockup sigue siendo 300x300 px fijos (no negociable, norma vigente).

**Scale/Scope**: 2 ficheros cliente nuevos (`mockup-render.js`, `mockup-geometria.js`), 1 test Node
nuevo, 9 ficheros existentes modificados (lista exacta en [research.md](./research.md) §"Resumen de
artefactos de codigo"). Sin ficheros PHP nuevos. Sin cambios en `modules/textmuy/` ni en `engine/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Evidencia / nota |
|---|---|---|
| §I WooCommerce Integration | **PASS** | No se toca el ciclo carrito->pedido. El mockup sigue siendo 300x300, obligatorio salvo `preview_omisible`, y el visto bueno del cliente no cambia. La paridad de composicion (FR-023) **mejora** lo que el cliente aprueba. |
| §II Modular Architecture | **PASS** | El editor sigue en el plugin (`assets/`), como los demas clientes (`admin.js`, `tienda.js`, `selector-pmu.js`, `miniaturas.js`). Los dos modulos nuevos son clientes puros, sin rutas ni catalogos. **No** se escribe en catalogos ni sprites (solo `miniaturas.js`). |
| §III Render en navegador + inyeccion server-side | **PASS** | El texto se sigue renderizando 100% en el navegador con el motor del modulo (RenderCore, via el preview de "Probar"). El servidor **no** renderiza ni evalua JS; solo valida y guarda `config.json`. El nucleo de composicion corre en el cliente. |
| §IV Directory Structure (PMU) | **PASS** | Sin ambitos, rutas ni carpetas nuevas. Fotos en `pdfs/{nombre}/mockups/`, catalogo `img/` leido, composicion en `config.json:mockups[]`. Toda resolucion de ruta sigue por `PMU_Uploads`. |
| §V No Backward Compatibility Requirement | **PASS** | No se exigen fallbacks ni migraciones. La ampliacion de `capas[]` es **retrocompatible por diseno** (campos opcionales + lectura tolerante de `ref` plano), lo que satisface SC-011 sin migracion. |
| Technical Constraints (Server) | **PASS** | PHP puro, sin dependencias nativas nuevas, sin Node en el servidor. |
| Technical Constraints (Data Storage) | **PASS** | Solo JSON en `uploads/pmu/`; escritura atomica ya la da `escribir_json`; recursos por id de grupo = hex 6. |
| Development Workflow (Validation) | **PASS** | Puertas existentes + 1 test Node nuevo + fases nuevas en `texto_puente.php`. `modules/textmuy/` intacto, asi que no hace falta `node --check` ni bump `?v=RCn`. |
| Governance (jerarquia documental) | **PASS** | Se actualizan `specs/INDICE.md`, `AGENTS.md` y `readme.txt` en la fase de tareas (FR-044). La nota de compatibilidad constitucional queda registrada en [research.md](./research.md) R14. |

**Gate: PASS.** Sin violaciones que exijan justificacion: la seccion *Complexity Tracking* queda
vacia.

**Re-check post-diseno (Phase 1)**: los tres puntos de aplicacion de los ajustes por capa
(`config_mockups`, `handle_mockups_guardar`, render) quedan reducidos a **dos** (el motor valida, el
nucleo compartido renderiza), y el catalogo `img/` pasa a leerse con `listar('img')`, que ya excluye
fisicos ausentes. Se mantiene el gate: sin data-model fuera de `uploads/pmu/`, sin ruta nueva, sin
escritor de catalogos nuevo, sin render en servidor.


## Project Structure

### Documentation (this feature)

```text
specs/011-editor-mockups-visual/
├── spec.md              # /speckit-specify (2026-10-01)
├── plan.md              # Este fichero (/speckit-plan)
├── research.md          # Phase 0: decisiones R1-R14
├── data-model.md        # Phase 1: entidades y contrato de datos ampliado
├── quickstart.md        # Phase 1: guia de validacion
├── contracts/
│   └── mockup-capas.md  # Phase 1: contrato de capas + render compartido
├── checklists/
│   └── requirements.md  # Checklist de calidad (16/16)
└── tasks.md             # Phase 2 (/speckit-tasks) - NO creado por /speckit-plan
```

### Source Code (repository root)

```text
personalizador-pdf/
├── personalizador-pdf.php        # encolado del nucleo; mockups_para_editor() + imagenes
│                                  # del catalogo; sanear ref con namespace
├── admin/
│   └── pdfs.php                  # seccion Mockups: quitar el listado duplicado
├── assets/
│   ├── admin.css                 # + bloque .ec-mk-* (grid 2 columnas) [inexistente hoy]
│   ├── admin.js                  # + store PersonalizadorPDF.previews con cache por hash
│   │                             #   y evento pmu:preview-listo (R2)
│   ├── mockups.js                # REESCRITURA: editor de 2 columnas, lienzo, capas,
│   │                             #   recursos, teclado, autoguardado, deshacer
│   ├── mockup-render.js          # NUEVO: nucleo de composicion (Canvas 2D) + contener()
│   ├── mockup-geometria.js       # NUEVO: geometria pura (acotar, imanes, tiradores)
│   └── tienda.js                 # componerMockup() pasa a usar el nucleo (paridad)
├── inc/
│   └── class-pmu-uploads.php     # config_mockups: allowlist/clamp de filtros + modo;
│                                  #   validar namespace de ref; resolver img:{id}
├── tests/
│   ├── mockup-geometria.test.js  # NUEVO: test Node de geometria pura (sin framework)
│   └── texto_puente.php          # + fases del contrato ampliado
└── modules/textmuy/              # SIN CAMBIOS (no hay bump ?v=RCn)
```

**Structure Decision**: se conserva la estructura del repo (plugin WordPress con `admin/`,
`assets/`, `inc/`, `engine/`, `tests/` y el modulo integrado `modules/textmuy/`). Los dos modulos
nuevos van en `assets/` junto a los demas clientes puros del plugin (`admin.js`, `tienda.js`,
`selector-pmu.js`, `miniaturas.js`) porque son codigo de navegador sin rutas ni catalogos, y porque
el editor **permanece embebido** en la consola (D1). No se crea ninguna carpeta ni ambito nuevo.

### Secuencia de despliegue de los scripts (nueva)

El nucleo debe cargarse **antes** de sus dos consumidores:

```text
admin (pestana PDFs):  personalizador-pdf-mockup-render -> personalizador-pdf (admin.js)
                       -> personalizador-pdf-mockups
ficha (frontend):      personalizador-pdf-mockup-render -> personalizador-pdf-selector
                       -> personalizador-pdf-tienda
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sin violaciones: la seccion queda vacia. La nota de compatibilidad constitucional (D1/D2 frente a
§I) queda registrada como lectura argumentada en [research.md](./research.md) **R14**, no como
excepcion.

## Notas de fase para /speckit-tasks

1. **Orden de implementacion sugerido** (por dependencias): `mockup-geometria.js` + test Node ->
   `mockup-render.js` -> nucleo en `filtroCss` de ambos consumidores -> encolado PHP ->
   `config_mockups`/`handle_mockups_guardar` (contrato) -> `admin.js` (store de previews) ->
   `admin.css` (`.ec-mk-*`) -> `mockups.js` (editor) -> `tienda.js` (paridad) -> `pdfs.php`
   (limpieza) -> fases de `texto_puente.php` -> documentacion.
2. **Puerta por paso**: tras cada grupo, `php -l` + `motor_smoke` + `parity` + `texto_puente`
   (todas sus fases) + `node tests/mockup-geometria.test.js`. El test Node es la unica puerta nueva y
   debe quedar en verde **antes** de tocar el editor.
3. **Recorrido manual pendiente** (no automatizable): colocar un hueco con arrastre en el sitio
   real, comprobar que "Probar" repinta el lienzo y que la vista de cliente coincide con la
   composicion del editor (SC-003). Anotarlo en `specs/MANUAL-PENDIENTE-WP-REAL.md`.
4. **Riesgo a vigilar**: al ampliar el contrato, si se olvida uno de los tres puntos de aplicacion
   (motor + handler + render), el cliente vera distinto a lo que compone el admin (FR-025). La
   checklist de `contracts/mockup-capas.md` lo exige explicitamente.
5. **Sin bump `?v=RCn`**: no se toca `modules/textmuy/`. Si al implementar apareciera la necesidad de
   tocar el modulo, hay que revisar el alcance y hacer el bump en ambos HTML.

