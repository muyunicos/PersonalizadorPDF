# Tareas — 013 Consola de Campos

> Regla: **no marcar `[X]` una tarea por aproximacion**. Si falta un requisito,
> `[~]`. Estado: 12/12 `[X]`, verificado en navegador real (lab).

## Fase 1 - Servidor: el editor sale de la tabla

- [X] **T001** `Personalizador_PDF_Plugin::fila_campo_html()` devuelve **solo** el `<tr>` (antes devolvia `$resumen . $form`). Se retira el `$post` local que solo existia para el formulario. Docblock actualizado.
- [X] **T002** `form_campo_html()` pasa de `<tr>` privado a `<div class="ec-campo-form" data-form="{id}">` **publico**. Nuevo `forms_campos_html($campos, $post)`, que emite un div por campo activo. Las respuestas JSON de **alta** y **duplicar** suman la clave `form` con su formulario. `admin/campos.php` imprime el dormitorio `#ec-campo-forms` con la plantilla de alta primero y despues los divs. **El `<tbody>` queda con solo filas de campo** (FR-001), verificado en el smoke con `every(tr => tr.hasAttribute('data-id'))`.

## Fase 2 - Markup de la pagina

- [X] **T003** `admin/campos.php`: markup del drawer (`#ec-c-drawer` con fondo, panel, cabecera y `#ec-c-drawer-cuerpo`), oculto por defecto. La plantilla de alta (`ec-campo-form-nuevo`) deja de ser un `<div class="card">` con 3 campos siempre visibles.
- [X] **T005** La tarjeta "Campos reutilizables" lleva en su cabecera el boton **+ Nuevo campo** (`.ec-abrir-alta`); el card de alta desaparece del cuerpo de la pagina.
- [X] **T006** "Estilos globales / Script global" se mueve **al pie** de la pestana y dentro de un `<details>` **cerrado**. Se conserva FR-024 de la 012 (se edita desde Campos, sin navegar): lo que cambia es *donde*, no *si*.

## Fase 3 - El drawer

- [X] **T004** Nucleo en `assets/admin.js`: `$drawer`/`$cuerpoDrawer`/`$tituloDrawer`/`$dormitorio`, `formDe(id)`, `devolverForm()`, `abrirDrawer(id, opts)` y `cerrarDrawer(forzar)`. El formulario se mueve desde el dormitorio y vuelve al cerrar (FR-003); solo uno dentro a la vez. `Editar` abre, `Probar` abre con la vista previa, `+ Nuevo campo` abre el alta. El boton de envio alterna "Crear campo" / "Guardar cambios" y el titulo muestra `Campo N — Nombre`.
- [X] **T007** La vista previa pasa al drawer: `marcoPreview()`, `montarPreview(id)` y `anchoPreview()`. Se retiran el `<tr class="ec-campo-preview">` y el `width=350` fijo; el selector ofrece 350 px / 768 px / ancho completo, **partiendo de completo** (FR-006). `leerCampoDeLaFila()` busca el formulario por `data-form` en el dormitorio en vez de `$fila.next(...)`. **Sustituido por T016** (el modal resulto mejor que el preview dentro del drawer).
- [X] **T008** El drawer trae su propio boton **Probar** (`.ec-probar-drawer`) y el recordatorio "Ctrl+Enter guarda · Esc cierra" (FR-007). `Esc` cierra, `Ctrl+Enter`/`Cmd+Enter` guarda, el fondo y la "x" cierran. Un delegado `input change` sobre el cuerpo arma `drawerSucio`, que dispara el `confirm` al cerrar con cambios sin guardar (FR-008).
- [X] **T013** Consecuencia del cambio: `aplicar()` (filtros) pierde el bloque que sincronizaba las filas hijas con su fila, `ordinar()` pierde su `nextAll('tr').first()`, y `enlazarBaja()` borra el formulario del dormitorio en vez de la fila hermana. `parsearFilas()` queda con solo filas; nuevo `parsearForms()` para los `<div>`.

## Fase 4 - Estilos, pruebas y cierre

- [X] **T009** `assets/admin.css`: estilos del drawer (panel de 680px, fondo, cabecera, cuerpo con scroll, botones sticky al pie), barra de acciones, preview con selector de ancho y el `<details>` de los globales. Se retiran `.ec-campo-form-fila > td` y `.ec-campo-preview > td`.
- [X] **T010** `tests/campos-contrato.test.js`: el check del global se reescribe (codificaba la posicion vieja, no la intencion de FR-024). Ahora son tres: se edita desde Campos, va despues de la lista, y viene plegado. **CAMPOS CONTRATO OK.**
- [X] **T011** Verificacion completa: lint (26 php / 14 js), 9 puertas, **20 fases** del arnes y los 3 smokes del lab en navegador real (`smoke-campos`, `smoke-ficha`, `preview-cargador`), estos dos ultimos actualizados al modelo del drawer. Captura revisada a ojo.
- [X] **T012** Documentacion: `specs/INDICE.md`, `AGENTS.md` §2 y el `== Changelog ==` de `readme.txt` (entra en 4.4.0, que aun no se pusheaba).

## Fuera de alcance

- [~] **T014** Menu `...` para agrupar acciones. **Resuelto por T016 con otra
 via**: cinco `dashicons` del core pesan menos que un menu y se evita el JS de
  foco y teclado que daba miedo.
- [~] **T015** Columna "Uso" enlazable a los PDFs filtrados. Depende de como se
  elija saltar entre pestanas.
- [~] **T017** Que la fila nueva quede a la vista tras crearla. Caso de escalado,
  sin medir.

## Fase 5 - Segunda pasada (peticion del usuario sobre las capturas)

- [X] **T016** La vista previa pasa a **MODAL** (`#ec-pv-modal`, T016/FR-006), y las
  acciones de la fila pasan a **iconos** (FR-010). El preview a ancho completo
  apuntaba a la pregunta equivocada: el comprador no ve 680 px, ve la columna de
  una ficha de producto de Woo (~324-538 px, 673 en movil). El modal va a 480 px,
  centrado, y se abre **desde la fila sin pasar por el editor** (asi "Probar"
  sirve como accion directa) o desde el boton del drawer mientras se edita. `Esc`
  cierra primero el modal y despues el drawer. Se retiran `anchoPreview()` y el
  selector de ancho: con un ancho correcto no hay nada que elegir. `.ec-marcar`
  pasa a estrella con `aria-pressed` (`reflejarPlantilla()`), y el texto de los
  cinco botones va a `screen-reader-text` con `title`/`aria-label` siempre presente.
- [X] **T018** Regresion detectada mirando la pagina real: al hacer que
  `fila_campo_html()` devolviera solo la fila (T001) se elimino su `$post`, pero el
  **form de baja vive en la fila** y lo usaba: quedaba `action=""` y la baja
  posteaba a la pagina actual en vez de a `admin-post.php`. **La baja estaba
  rota.** Se restituye `$post` con el motivo en el sitio y se agrega un check al
  smoke que afirme el `action`.