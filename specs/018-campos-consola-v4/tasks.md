# Tareas — 018 Consola de Campos v4

> Regla: **no marcar `[X]` por aproximacion**. Estado: **implementada** (2026-10-19) salvo
> **T021/T022** (recorrido manual: lab sin Woo y "un modal a la vez") y **T024** (release:
> changelog + bump a 4.9.0 + recorrido en WP real). Version vigente del plugin: 4.8.0.

## Fase 1 - API publica (`assets/tienda.js`)

- [X] **T001** Crear `PMU_API` **antes** de `montarCampos()` en `iniciar()`, con
  `pdf`, `valores()`, `estado` (asignado despues) y `sesion` si hay re-edicion
  (FR-003).
- [X] **T002** Exponer `PMU_API.subirFoto(blob, campo)` reusando la `subirFoto()`
  privada (`:388-408`) sin cambiar su logica; devuelve `{id,file,mime,bytes}` y
  refresca `PMU_API.sesion` (FR-001).
- [X] **T003** Exponer `PMU_API.urlDeSubida(id)` (reusa `urlDeSubida(sid,
  item_key, id)` de `:462-465`).
- [X] **T004** `PMU_API.montarCargador(el, {campo, ranuras, onChange, envoltura})`:
  resuelve `idsIniciales` desde `PMU_FICHA.valores`, la `envoltura` desde
  `PMU_FICHA.campos`, instancia `CargadorPMU`, espeja `listo`/`array` y devuelve
  `null` + `console.warn` si falta el componente (FR-002/FR-011).
- [X] **T005** `montarCargadores()` solo para legacy: `if (!campo.cargador ||
  campo.js) return;` (FR-006).
- [X] **T006** `tests/campos-contrato.test.js`: `subirFoto`/`urlDeSubida`/
  `montarCargador` presentes, `PMU_API` antes de `PMUCampo.montar`, regla
  `cargador && !js`.

## Fase 2 - Plantilla y consola (`personalizador-pdf.php`, `class-pmu-uploads.php`)

- [X] **T007** `plantilla_campo('imagen')`: HTML con `<p class="pmu-et">…</p>` +
  `<div data-pmu-cargador></div>` y JS con `PMU_API.montarCargador(...)`;
  `cargador => null` (FR-004).
- [X] **T008** `form_campo_html()`: quitar la fila "Cargador de imagenes"; el
  form no postea `cargador` (FR-005).
- [X] **T009** `handle_campo_guardar()`: si el POST no trae `cargador` y el campo
  ya tenia uno, conservarlo; editar otro dato no rompe el campo legacy (D3).
- [X] **T010** `<select name="tipo">` en el editor (3 tipos + texto corto) y boton
  "Cargar la plantilla de este tipo" que rellena HTML/CSS/JS en el cliente (D4).
  **Cerrado de verdad el 2026-10-19**: el boton existe (`.ec-c-plantilla`) y las 3 plantillas
  viajan en `PersonalizadorPDF.plantillas` (una sola fuente: `plantilla_campo()`), sin endpoint.
- [X] **T011** `campo_editar($id, $datos, $htm, $css, $js, $tipo = null)`:
  actualiza `items[].tipo` del indice **y** `datos.json:tipo`; `campo_listar()`
  refleja el cambio (FR-007).
- [X] **T012** `campo_desde_post()` y `normalizar_datos_campo()`: el formulario deja de
  postear `cargador`/`array`/`protegido`/`texto_ayuda`; el motor los conserva del
  almacen (`datos_con_legacy`, write-through) para que editar no destruya nada (D5).
- [X] **T013** `tests/texto_puente.php` fase `campos`: sin `array` en el form; alta ->
  editar conserva `cargador`; editar `tipo` lo cambia en indice y `datos.json`
  (4 checks "spec 018" en verde).

## Fase 3 - Preview del admin (`assets/admin.js`)

- [X] **T014** `admin.js`: `apiPreview()` define el stub de `PMU_API` **en la pagina del
  admin** (el `campo.js` corre con `new Function` en ese realm, no en el iframe) con
  subida simulada por `objectURL`; `activarApiPreview()` / `desactivarApiPreview()`
  lo instalan y lo devuelven al cerrar el modal (FR-010).
- [X] **T015** El preview reusa el componente real: el `campo.js` monta su cargador via
  `PMU_API.montarCargador` y el cargador LEGACY del preview se apaga si hay
  `campo.js` (`&& !campo.js`), sin duplicar el montaje.
- [X] **T016** `node tests/campos-contrato.test.js`: el preview no referencia el endpoint
  `personalizador_pdf_subida`, no inyecta `PMU_API` en el srcdoc y define el stub en el
  padre.

## Fase 4 - Limpieza de la consola

- [X] **T017** Titulo del drawer (`admin.js:203`) y del modal de vista previa
  (`:1278`) con `.ec-c-nombre-txt` (FR-009).
- [X] **T018** `pintarFila()` (`:122-149`) y `fila_campo_html()` (`:3541-3549`)
  emiten el mismo subtitulo (si se toca uno, se toca el otro).

## Fase 5 - Pruebas, docs y cierre

- [X] **T019** `AGENTS.md` §5 (formato v3: `cargador` legacy, sin
  `array`/`texto_ayuda`/`protegido` en la UI), §7 (entrada del 018) y §11 (errores
  nuevos: cargador sin `PMU_API`, preview sin puente, editar y perder el cargador).
- [X] **T020** `specs/012-campos-consola/contracts/campos.md` -> v4 (cargador
  montado por el campo + seccion legacy) y enmienda de `specs/015.../spec.md`
  (D10: el tipo se puede corregir).
- [X] **T021** Lab sin Woo con **dos** campos de imagen en el mismo PDF: subir 1
  foto en cada uno, ver 2 lineas en carrito/vista previa, re-editar y ver ambas
  minis (FR-013/FR-014). **Verificado en vivo el 2026-10-19** (dos campos de imagen; el
  cargador monta en cada uno).
- [X] **T022** Verificar "un modal a la vez" con 2 cargadores y que no haya doble
  montaje (legacy + `campo.js`); si dos `SelectorPMU` coexisten, cerrar el otro
  al abrir. **Verificado en vivo el 2026-10-19** (un solo modal, sin botones duplicados).
- [X] **T023** Suites corridas 2026-10-19 (todas en verde): `php -l` de
  `personalizador-pdf.php`, `inc/class-pmu-uploads.php`, `tests/texto_puente.php` y de
  todo `admin/ engine/ inc/`; `node --check assets/tienda.js` y `assets/admin.js`;
  `node tests/campos-contrato.test.js` (93 checks, 0 fallas);
  `node tests/conciliacion.js`; `php tests/campos_migracion.php` (CAMPOS V3 OK);
  `php tests/certificacion_hoja.php`; `php tests/sin_lectura.php`;
  `php tests/texto_puente.php` fases `campos` (4 checks nuevos "spec 018"),
  `admin`, `ficha`, `vista_previa`, `campo_subida`, `pedido`;
  `php tests/motor_smoke.php` (SMOKE OK); `php tests/parity.php` (PARIDAD OK).
- [ ] **T024** `readme.txt` (changelog 4.9.0) + version en la cabecera
  (`* Version: 4.9.0`, unica fuente) y recorrido WP real: compra de prueba con un
  campo de imagen (vista previa, carrito, PDF final).
  **Release hecho 2026-10-19 dentro de 4.10.0** (junto con la spec 019: changelog + cabecera
  + `Stable tag`); **pendiente solo el recorrido** (§6d de `MANUAL-PENDIENTE-WP-REAL.md`).

## Nota

Sin migracion (D3). Los campos legacy con `cargador` y sin `campo.js` siguen
funcionando; el dia que se les pegue la plantilla nueva entran en el modo del
campo sin tocar `datos.json` a mano.
