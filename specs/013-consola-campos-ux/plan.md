# Plan — 013 Consola de Campos

## Alcance

Cuatro archivos de codigo, uno de pruebas versionadas y los smokes del lab.
Sin tocar el motor (`engine/`), los datos (`uploads/`) ni el panel del comprador.

| Archivo | Cambio |
|---|---|
| `personalizador-pdf.php` | `fila_campo_html()` devuelve solo el `<tr>`; `form_campo_html()` pasa a `<div>` publico; nuevo `forms_campos_html()`; clave `form` en las respuestas JSON de alta y duplicar. |
| `admin/campos.php` | Reordena los bloques; "Nuevo campo" pasa a boton; agrega el markup del drawer y el dormitorio `#ec-campo-forms`; estilos globales al pie en `<details>`. |
| `assets/admin.js` | Nucleo del drawer (`abrirDrawer`/`cerrarDrawer`/`formDe`/`devolverForm`), atajos, aviso de cambios sin guardar, preview dentro del drawer con selector de ancho, y los ajustes en filtros/orden/duplicar/baja. |
| `assets/admin.css` | Estilos del drawer; se retiran `.ec-campo-form-fila` y `.ec-campo-preview`. |
| `tests/campos-contrato.test.js` | El check del global pasa a afirmar la intencion (pestana + al pie + plegado). |

## Orden de ejecucion (por que en este orden)

1. **Servidor primero** (T001, T002). Si `fila_campo_html()` deja de emitir el
   formulario, el `tbody` queda limpio y el resto del trabajo se apoya en un
   invariante que ya es cierto.
2. **Markup de la pagina** (T003, T005, T006): drawer y dormitorio. Sin JS todavia
   la pagina no cambia de aspecto visible —el drawer nace `hidden`— asi que no hay
   una ventana en la que la consola este rota.
3. **JS del drawer** (T004): es el paso que habilita todo lo demas.
4. **Preview y atajos** (T007, T008).
5. **CSS** (T009) y pruebas (T010).

## Decisiones

- **El formulario se mueve, no se copia.** Es lo que permite que el drawer sirva
  para alta y edicion con una sola implementacion, y evita duplicar el markup en
  JS (regla de la 012: fuente unica del servidor).
- **`cerrarDrawer(true)` al guardar.** Recien guardado no hay nada que perder;
  preguntar seria ruido.
- **El aviso de cambios sin guardar mira `drawerSucio`**, que se arma con un
  delegado `input change` sobre el cuerpo del drawer: no se compara contra una
  copia del estado inicial (que habria que mantener al dia con cada repintado).
- **`parsearFilas()` sigue envuelto en una tabla auxiliar.** `$('<tr>')` no lo
  parsea jQuery fuera de una tabla; el formulario nuevo es un `<div>` y usa
  `parsearForms()`, que entra directo por `$(html)`.

## Riesgos

- **El editor sigue siendo el mismo nodo DOM**, asi que `pintarFila()` sigue
  reflejando los datos del servidor sobre el formulario abierto tras guardar.
- **Con el drawer abierto la tabla queda tapada.** Por eso el drawer trae su
  propio "Probar" (FR-007): sin el, no se podria reprobar lo recien escrito.
- **`window.PMUCampos` es el puente** entre el bloque de campos (que define el
  drawer) y los bloques de filtros/preview, que viven en otro `ready`. Se
  publican `abrir`, `cerrar` y `probar`.