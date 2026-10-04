# Implementation Plan: campos-consola

**Branch**: `main` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-campos-consola/spec.md`

## Summary

La pestana Campos es hoy un formulario crudo de 115 lineas: `Editar` es un enlace que recarga la
pagina, el alta son dos pantallas, no hay forma de probar un campo, y no hay ni buscador ni filtro
(prometido por el contrato y nunca implementado). Esta feature la convierte en un **editor de
objetos**: cada campo pasa a ser una carpeta propia (`uploads/pmu/campos/{id}/` con `datos.json` +
`campo.htm|css|js`) versionada por `?v={meta.modificado}`, de modo que editar un campo solo invalida
ese campo en la cache del comprador. El admin edita **en linea sin recarga**, **prueba** el campo
en un iframe que usa **el mismo montaje que la ficha** (`assets/campo-montar.js`, patron
`mockup-render.js` de la 011), busca/filtra/ordena, crea desde **3 plantillas**, marca campos como
plantilla reutilizables, duplica, restaura bajas, importa/exporta, y edita un **CSS/JS global**
(un solo archivo del plugin, prefijado `[data-pmu-panel]`). El campo pierde su `tipo` (pasa al
placeholder) y separa **nombre** (admin) de **titulo_cliente** (carrito/checkout/pedido). Se cierra
el cargador de imagenes del comprador (`CargadorPMU`: N ranuras, drag & drop, `min` que exige),
con las fotos en `subidas/` de la sesion y el Motor pasa a aceptar N imagenes por grupo. El texto
del sistema solo se evalua en el navegador (constitution §III) y no se toca
`modules/textmuy/`.

## Technical Context

**Language/Version**: PHP 7.4+ minimo (objetivo Hostinger Business **PHP 8.5.4 verificado**) en el
servidor (validacion, sandbox y guardado). Cliente: JavaScript en el sabor vigente del repo (jQuery
ya presente; `const`/`let` y arrow functions ya se usan en `assets/`), HTML5 Canvas 2D (para el
recorte) e **iframe `srcdoc`** para el preview. **Sin framework ni libreria de edicion nuevos**
(D8: CodeMirror/Prism fuera de alcance).

**Primary Dependencies**: WordPress (ultima version, como el resto del plugin) + WooCommerce
(presente; esta feature **no lo toca**). Piezas internas reusadas, sin duplicar:
`inc/class-pmu-uploads.php` (`escribir_json`, `validar_script_campo`, `dir_sesion_item`,
`url_sesion_item`, `sesion_segura`), `inc/class-pmu-sesion.php` (`leer_manifest`,
`guardar_manifest`, `congelar_webp`), `personalizador-pdf.php` (`responder`/`seguridad`,
`assets_ficha`, `cargar_campos`), `assets/selector-pmu.js` (**ya escrito y encolado, sin
instanciar**: `SelectorPMU` con modal, canvas, zoom y arrastre del encuadre),
`modules/textmuy/render-core.html` (`TextMuyAPI.renderBatch`, usado, **sin cambios en el modulo**).

**Storage**: formato nuevo en `uploads/pmu/` (Const. IV). `campos.json` pasa a ser **indice +
metadatos**; el codigo de cada campo vive en `campos/{id}/campo.htm|css|js`; `campos/global.css` y
`campos/global.js` son los unicos globales. Las fotos del comprador van a
`tmp/sesion-{sid}/{item_key}/subidas/{id}.webp` con fila en `manifest.subidas[]` (**separado** del
pool de grupos `img/`, que sigue siendo solo texto renderizado). Sin tablas.

**Testing**: `php -l` (plugin, `admin/`, `engine/`, `inc/`), `php tests/motor_smoke.php`,
`php tests/parity.php`, `php tests/texto_puente.php` en todas sus fases (**fases nuevas**:
`campos_v2`, `campo_dup`, `campo_restore`, `campo_import`, `campo_global`, `campo_subida`,
`motor_multi`), `node --check` + `tests/conciliacion.js` (**cubre `PURO.conciliarGrupo`, que cambia
en T027b**) + las 2 puertas de mockups (no se rompen) + **dos** puertas nuevas de campos:
`tests/campos_migracion.php` (**ya en verde**: banco PHP de la migracion v1->v2, rutas, cargador y
validaciones; corre en `%TEMP%`, no toca `uploads/pmu/`) y `tests/campos-contrato.test.js` (puerta
**Node** del cableado cliente, se crea en T012). Ademas `smoke_checks()` en el sitio real.
**No** se toca `modules/textmuy/` ni sus 21 suites Node (sin bump `?v=RCn`).

**Target Platform**: navegador de escritorio (Chrome/Edge/Firefox actuales) en la consola de
WordPress; raton + teclado. El **iframe del preview es de 350px** (el `max-width` real de
`.pmu-panel`), que es el ancho que ve el comprador. El hosting sigue siendo PHP puro compartido.

**Project Type**: plugin para WordPress con consola de administracion (capa cliente rica) + motor
PHP server-side. Editor que escribe en el catalogo global de campos; el comprador monta esos
campos en la ficha del producto.

**Performance Goals**: guardar un campo **sin recarga** (< 1 s de ida y vuelta, toast de estado);
el preview responde al abrir y repinta al cambiar un text area (< 500 ms, sin recargar el iframe);
el buscador filtra sobre la tabla ya en memoria (sin peticiones, con pocos campos); la ficha
monta N campos en < 300 ms. El **consumo de red del comprador cae**: cambiar un campo invalida solo
ese `campo.htm?v=`, no la ficha entera.

**Constraints**: constitution §III (render 100% en navegador; el servidor **nunca** renderiza ni
evalua JS), §IV (datos solo en `uploads/pmu/`; toda ruta por `PMU_Uploads`), §II (un solo escritor
por catalogo; la pestana Campos es el unico escritor de `campos/`), sin dependencias nativas en
servidor, sin Node en produccion, mensajes e interfaz en espanol sin tildes en codigo. El sandbox
del `campo.js` lo valida **siempre** el servidor (`validar_script_campo()`), aunque el preview lo
ejecute en el navegador.

**Scale/Scope**: 3 ficheros cliente nuevos (`campo-montar.js`, `cargador-pmu.js`,
`campos-contrato.test.js`), 1 banco PHP nuevo (`campos_migracion.php`), 1 test Node actualizado
(`conciliacion.js`), ~10 ficheros existentes modificados (lista exacta abajo). Sin ficheros PHP
nuevos de plugin. Cambios en `engine/` (Motor + Overlay), los mas sensibles del repo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Evidencia / nota |
|---|---|---|
| §I WooCommerce Integration | **PASS** | No se toca el ciclo carrito->pedido ni el mockup 300x300. El campo de imagenes **mejora** lo que el cliente aprueba: sus fotos llegan al PDF final. El unico cambio de conducta es D17/D18 (nunca bloquear por N != cont), que relaja una restriccion en el sentido de "errores que no frenan la venta" ya declarado en la constitucion (decision 2026-09-17). |
| §II Modular Architecture | **PASS** | Todo el codigo nuevo vive en el plugin (`assets/`), como los demas clientes. La pestana Campos es el **unico escritor** del catalogo `campos/`; no se tocan `img/`, `fonts/` ni `tm-presets/`, ni sus sprites. `modules/textmuy/` intacto. |
| §III Render en navegador + inyeccion server-side | **PASS** | El servidor **no** renderiza ni evalua JS: valida, guarda y resuelve rutas. El recorte de la foto (Canvas 2D) y el render del texto (RenderCore/TextMuy) siguen en el navegador. El preview ejecuta `campo.js` en el **iframe** del admin, que es cliente, no servidor. El sandbox del servidor manda igual (`validar_script_campo()`). |
| §IV Directory Structure (PMU) | **PASS** | Todo dato nuevo en `uploads/pmu/` (`campos/`, `campos/{id}/`). La sesion sigue en `tmp/` con su TTL y su promocion por `rename()`. Toda ruta nueva se resuelve por `PMU_Uploads` (`dir_campos()`, `ruta_campo()`, `dir_subidas()`). Sin rutas fuera de `PMU_Uploads`. |
| §V No Backward Compatibility Requirement | **PASS** con nota | La constitucion no exige fallbacks, pero los PDFs en produccion referencian `config.json:campos_ids[]`, asi que **D10 impone una migracion one-shot que conserva el `id`** (con `.bak` y todo-o-nada). No es compatibilidad opcional: es evitar dejar PDFs sin campos. El resto del formato es nuevo. |
| Technical Constraints (Server) | **PASS** | PHP puro, sin dependencias nativas nuevas, sin Node en el servidor. WebP porque el hosting **tiene GD 2.3.3 verificado**; se agrega un check en `smoke_checks()` (T022b) para detectarlo si algun dia cambia el hosting. |
| Technical Constraints (Data Storage) | **PASS** | Solo JSON en `uploads/pmu/`; escritura atomica (`.tmp` + `rename`) ya la da `escribir_json`; ids de campo numericos y auto, **nunca reutilizados**. Recursos por id de grupo = hex 6 (sin cambios). |
| Development Workflow (Validation) | **PASS** | Puertas existentes + 2 tests Node (uno nuevo, uno actualizado) + 7 fases nuevas en `texto_puente.php`. `modules/textmuy/` intacto: sin `node --check` de sus suites y sin bump `?v=RCn`. |
| Governance (jerarquia documental) | **PASS** | Se actualizan `specs/INDICE.md`, `AGENTS.md`, `admin/ayuda.php`, `readme.txt` y la constitucion (bump 2.1.0 con Sync Impact Report) en la fase de tareas (T029-T031). Los contratos normativos quedan en `contracts/` de esta spec, que **enmienda** los de la 004. |

**Gate: PASS.** Sin violaciones que exijan justificacion: la seccion *Complexity Tracking* queda
vacia.

**Re-check post-diseno (Phase 1)**: la aplicacion de las reglas de salida del valor queda en **un
solo sitio** (`PMUCampo.montar()`, compartido por ficha y preview) en vez de dos (la ficha y el
admin, que es lo que habria pasado sin el nucleo compartido); la escritura del catalogo queda en
`PMU_Uploads` con un solo punto por operacion; y `subidas/` queda **separado** del pool de grupos,
que sigue siendo solo texto renderizado (no se mezclan imagenes del cliente con renders). Se
mantiene el gate: sin data-model fuera de `uploads/pmu/`, sin ruta fuera de `PMU_Uploads`, sin
escritor de catalogos nuevo, sin render en servidor.

## Orden de fases

```
F0  Migracion v1 -> v2 + formato de archivos (motor de datos)   [bloquea todo]
F1  US1 Editor en linea (admin/campos.php + assets/admin.js)
F2  US2 campo-montar.js + preview en iframe
F3  US3 buscar / filtrar / ordenar
F4  US4 plantillas + duplicar + restaurar + exportar/importar
F5  US5 CSS/JS global
F6  US6 CargadorPMU + endpoint de subidas del comprador
F7  US7 Motor N-imagenes-por-grado + integracion en la ficha
F8  Documentacion (constitucion, AGENTS, INDICE, ayuda) + manual WP
```

**F7 va sola y al final**: es el unico punto que toca el nucleo (`engine/Motor.php`,
`engine/Overlay.php`) y el camino de venta.

## Migracion (F0, D10)

```
campos.json (v1: tuplas de 10)
   |  1. backup  -> campos.json.bak
   |  2. por cada campo activo: escribe campos/{id}/datos.json + campo.htm|css|js
   |  3. tuplas [id,"",""] -> items[id].baja = true
   |  4. escribe campos.json v2 con v1_migrado
   |  5. si algo falla -> se restaura el .bak (el sistema queda como estaba)
   v
campos.json (v2: items + meta)
```

Se ejecuta sola la primera vez (si `version != 2`). Los tombstones v1 siguen siendo "dados de
baja" y **los ids no se reutilizan**. Requiere **aprobacion explicita del usuario**: escribe sobre
datos del admin en produccion.

## Puertas (todas obligatorias, sin excepcion)

```
php -l personalizador-pdf.php
php -l (todos los .php de admin/, engine/, inc/)
php tests/motor_smoke.php          -> SMOKE OK
php tests/parity.php               -> PARIDAD OK
php tests/texto_puente.php <fase>  -> todas las fases (una por proceso)
node --check (los .js tocados)
node tests/conciliacion.js         -> se actualiza en T027b
node tests/mockup-geometria.test.js    -> no se rompen
node tests/mockup-contrato.test.js     -> no se rompen
php  tests/campos_migracion.php    -> CAMPOS V2 OK (49 checks, banco PHP en %TEMP%)
node tests/campos-contrato.test.js     -> nueva (T012), del cableado cliente
```

## Riesgos

| Riesgo | Mitigacion |
|---|---|
| `Motor.php`/`Overlay.php` (nucleo, camino de venta) | F7 sola; `parity.php` + `motor_smoke.php` obligatorias; diff revisado |
| `campo-montar.js` toca `tienda.js` (venta) | puerta Node que verifica `PURO` y el montaje; el bloque `PURO` solo cambia en T027b, con su propia puerta |
| Migracion de datos en produccion | `.bak` + todo-o-nada + reversible a mano + aprobacion explicita |
| `new Function` en el preview (D3) | dentro de iframe; el filtro real es `validar_script_campo()` en el servidor |
| Subida de archivos desde el front | nonce + capability, allowlist WebP, techo alto por archivo, **id del servidor** |
| Fotos personales accesibles si se filtra el link (D13) | riesgo asumido por el usuario; par `sid`+`item_key` no enumerable; reevaluar si el plugin pasa a manejar datos sensibles |
| CSS global rompe la tienda | prefijo `[data-pmu-panel]` + solo se carga con >=1 campo |
| WebP sin GD (D14) | GD 2.3.3 verificado en el hosting + check nuevo en `smoke_checks()` (T022b) |

## Fuera de alcance (ya cerrado en el spec)

Emails, editor con resaltado, boton "Anadir al catalogo `img/`", reordenar el panel del
comprador, tocar `modules/textmuy/`, la API (010).

## Project Structure

### Documentation (this feature)

```text
specs/012-campos-consola/
├── spec.md                      # /speckit-specify + /speckit-clarify (D1-D19, FR-001..FR-041)
├── plan.md                      # Este fichero (/speckit-plan)
├── research.md                  # Phase 0: decisiones R1-R12
├── data-model.md                # Phase 1: formato v2, migracion, sesiones, errores
├── quickstart.md                # Phase 1: guia de validacion
├── contracts/
│   ├── campos.md                # Phase 1: ENMIENDA el contrato de la 004 (montaje en la ficha)
│   └── campos-consola.md        # Phase 1: UI de la pestana + handlers
├── checklists/
│   └── requirements.md          # Checklist de calidad (trazabilidad requisito -> tarea)
└── tasks.md                     # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
personalizador-pdf/
├── personalizador-pdf.php        # handlers de campos (10), cargar_campos(), campos_panel(),
│                                 #   assets_ficha() con el global, endpoint de subida,
│                                 #   smoke_checks() con el check GD+WebP
├── admin/
│   └── campos.php               # REESCRITURA: global arriba, nuevo campo, tabla con buscador/
│                                 #   filtros/orden, editor en linea, panel de prueba en iframe
├── assets/
│   ├── admin.js                 # + editor en linea, buscador/filtros/orden, preview iframe,
│   │                            #   duplicar/restaurar/importar/exportar (reusa pmuForm/pmuPost)
│   ├── admin.css                # + bloque .ec-campo-* (tabla, editor, iframe del preview)
│   ├── campo-montar.js          # NUEVO: PMUCampo.montar() - montaje compartido (ficha + preview)
│   ├── cargador-pmu.js          # NUEVO: CargadorPMU - N ranuras, drag & drop, min que exige;
│   │                            #   usa SelectorPMU por dentro
│   ├── tienda.js                # montarCampos() pasa a PMUCampo.montar(); soporte del cargador;
│   │                            #   T027b: conciliarGrupo() cicla y NUNCA bloquea (D17/D18)
│   └── selector-pmu.js          # SIN CAMBIOS (lo consume CargadorPMU)
├── inc/
│   ├── class-pmu-uploads.php    # formato v2: dir_campos/ruta_campo/global, CRUD v2 (duplicar,
│   │                            #   restaurar, exportar, importar), migracion v1->v2 (T001),
│   │                            #   dir_subidas(), carga de uso real de cada campo
│   └── class-pmu-sesion.php     # dir_subidas() + manifest.subidas[] + guardar_subida()
├── engine/
│   ├── Motor.php                # T025: $rutasImagenes[$id] acepta string (hoy) o lista
│   └── Overlay.php              # T026: una imagen por instancia; contain() en cada una
├── tests/
│   ├── conciliacion.js          # ACTUALIZADO (T027b): asserts de PURO.conciliarGrupo
│   ├── campos-contrato.test.js  # NUEVO: puerta Node del cableado de campos
│   ├── campos_migracion.php     # NUEVO: banco PHP de la migracion v1->v2 (49 checks, %TEMP%)
│   └── texto_puente.php         # + 7 fases (campos_v2, campo_dup, campo_restore,
│                                 #   campo_import, campo_global, campo_subida, motor_multi)
└── modules/textmuy/             # SIN CAMBIOS (no hay bump ?v=RCn)
```

**Structure Decision**: estructura **existente** del plugin, sin proyectos ni carpetas nuevas de
codigo. Los tres ficheros nuevos van en `assets/` (cliente) y `tests/` (puertas); el catalogo nuevo
va en `uploads/pmu/campos/`. No se introduce ningun patron (repositorio, servicios, adapters): el
motor sigue siendo `PMU_Uploads` + `PMU_Sesion` como duenos unicos de datos.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Ninguna violacion que exija justificacion: la seccion queda vacia (gate PASS).