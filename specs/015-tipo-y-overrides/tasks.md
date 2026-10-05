# Tareas — 015 Tipo y overrides

> Regla: **no marcar `[X]` una tarea por aproximacion**. Si falta un requisito,
> `[~]`. Las `[ ]` son las que quedan al empezar.

## Commit 1 — A + B: Tipo y limpieza

- [ ] **T001 [P]** `migrar_campos_v3()` en `PMU_Uploads`: `plantilla` -> `tipo`,
  `select` -> `opciones`, `''` -> `texto`, fuera `categorias` de `datos.json` y de
  `meta.{id}`. Backup `.bak`, todo-o-nada, idempotente, mapeo en el docblock
  (**aprobacion del usuario pendiente**: si se arranca limpio, se descarta).
- [ ] **T002 [P]** `tipo_valida()` reemplaza a `plantilla_valida()`; `normalizar_datos_campo()` y `tocar_meta()` dejan de llevar categorias; `campo_listar()` expone `tipo` y ya no `categorias`.
- [ ] **T003** Fuera `campo_plantilla()` y el handler `handle_campo_plantilla` +
  su `add_action` y su entrada en `seguridad()` (D10).
- [ ] **T004** `plantilla_campo($tipo)`: `texto`, `imagen` y **`opciones`** (nueva, T011). Al elegir el tipo se rellena el formulario con su plantilla por defecto.
- [ ] **T005** `campo_desde_post()`: `tipo` en vez de `plantilla`, sin `categorias`. El tipo **solo se elige al crear**; en edicion manda el del indice.
- [ ] **T006** `fila_campo_html()`: columnas `id | Nombre (+ titulo y descripcion) | Tipo | Uso | Acciones`; fuera `data-cats`, fuera el boton de la estrella; `Uso` muestra el numero sin "PDFs".
- [ ] **T007** `form_campo_html()`: el Tipo se **muestra** (solo lectura) en edicion; fuera el input de Categorias.
- [ ] **T008** `admin/campos.php` + `assets/admin.js`: tabla nueva, **fuera los chips de categoria**, buscador sin categorias, fuera `.ec-marcar` y su logica (`reflejarPlantilla`, `data-plantilla`).
- [ ] **T009** `admin/pdfs.php`: el modal de alta rapida pide `tipo` y **sin** categorias; el texto de `settings` pasa a "Solo referencias `[campoN]`, en orden".
- [ ] **T010** Aviso de cableado (FR-008): si un campo `opciones` aparece en `value` de un placeholder de texto, o al reves, la consola avisa antes de procesar.
- [ ] **T011** Plantilla `opciones`: `campo.htm` con un contenedor vacio y `campo.js` que dibuja los botones desde una lista `OPCIONES` y publica `valor: JSON.stringify(overrides)` + `cliente: <etiqueta>`. Con el `JSON.stringify` YA hecho y comentado (FR-010).
- [ ] **T012** Puertas y smokes del commit 1: `campos_migracion.php` (v2 -> v3), fase `campos` del arnes, `campos-contrato.test.js`, y los 3 smokes del lab con sus checks de `ec-marcar` / categorias dados de baja.

## Commit 2 — C: los overrides que funcionan

- [ ] **T013** `PURO.resolverOverrides(settings, valores)` en `assets/tienda.js`: saca las referencias `[campoN]` de `settings`, en orden; `JSON.parse` de cada `valor`; `mergeDeep` entre ellos (el ultimo pisa). Texto literal en `settings` se descarta con aviso (FR-001, FR-003).
- [ ] **T014** Los items de `renderBatch` llevan `overrides: <objeto fusionado>`. **Sin tocar `modules/textmuy/`** (D8).
- [ ] **T015** `FR-004`: un `valor` que no parsea se descarta **solo ese**, con aviso, y el resto del render sigue. Nunca una excepcion.
- [ ] **T016** `FR-005`: `hashRender` incluye los overrides resueltos. Sin esto dos compradores con estilos distintos chocan en la cache del pool y el segundo recibe el PDF del primero.
- [ ] **T017** `FR-006`: `resolverPlantilla` **no** hace `String()` sobre un objeto. Si un `campo.js` devuelve un objeto, se avisa en vez de escribir `[object Object]`.
- [ ] **T018** Fase `overrides` del arnes: fusion en orden, JSON invalido degrada sin romper, el hash cambia con el override, y `settings` con texto literal avisa.
- [ ] **T019** Smoke del lab (navegador real): campo `opciones`, se elige opcion A y B, las dos vistas previas **se ven distintas**; el PDF descargado trae lo mismo que la vista previa (D6).

## Cierre

- [ ] **T020** Documentacion: `contracts/campos.md` (enmienda v2 -> v3), `AGENTS.md` §5 (el formato y el `tipo`), el changelog de `readme.txt`, y el bump de version.
- [ ] **T021** Enmienda de las specs que afirman que los overrides funcionan: `004/spec.md` FR-5.2 y `004/data-model.md`, con una nota que apunte a la 015.
- [ ] **T022** Revisar que la UI ya **no** prometa "Overrides del estilo; admite [campoN]" en un formato que no existe (FR-001).

## Fuera de alcance

- [~] **T023** Menu `...` de Acciones (aplazado en la 013).
- [~] **T024** Columna `Uso` enlazable a los PDFs.
- [~] **T025** Que la fila nueva quede a la vista tras crearla.
- [~] **T026** Multiples campos que compitan por un mismo hueco: no existe y no
  se agrega (D7).