# 013 — Consola de Campos: orden, drawer y atajos

> Estado: **implementada** (v4.4.0). Mejora de uso de la pestana Campos; no cambia
> el formato de datos ni el motor. Enmienda la *ubicacion* de la tarjeta de estilos
> globales de la 012 (FR-024), no su existencia.

## Problema

La pestana Campos era incomoda no por lo que le faltaba, sino por el **orden**:
las cosas de uso diario estaban abajo y lo raro ocupaba la pantalla entera arriba.

Orden anterior (verificado en el sitio real):

1. "Estilos globales / Script global" — dos textareas **siempre abiertos**, primero.
2. "Nuevo campo" — 3 campos **siempre abiertos**, segundo.
3. La lista de campos, y **debajo de todo**, el editor de la fila.

Y el editor vivia **dentro de una celda de la tabla**: los textareas de HTML, CSS y
JS quedaban estrechos, y abrirlo habia que hacer scroll hasta la fila.

## Decision

Dos cambios que se habilitan mutuamente.

### 1. El editor sale de la tabla (T002)

`fila_campo_html()` devolvia la fila **y** su editor pegados, como un
`<tr class="ec-campo-form-fila">` dentro del `<tbody>`. Eso obligaba a que el
editor estuviera atado a su fila: por eso los filtros y el orden tenian que
arrastrarlo (`$cuerpo.append($f); $cuerpo.append($f.nextAll('tr').first())`).

Ahora el editor vive **fuera de la tabla**, en un `<div data-form="{id}">` dormido
dentro de `#ec-campo-forms`, y el drawer lo mueve dentro al abrirlo. Consecuencias
positivas: `parsearFilas()` ya no arrastra filas de formulario, `aplicar()` (filtros)
pierde el bloque que sincronizaba filas hijas, `ordinar()` pierde su `nextAll()`
fragil, y el `<tbody>` pasa a contener **solo filas de campo** — un invariante
estructural, no una convencion.

### 2. Orden por frecuencia de uso descendente (T005, T006)

Lista primero (lo que se usa todos los dias), "Nuevo campo" como **boton** que
abre el drawer, estilos globales al **pie y plegados** (lo mas tecnico, lo de uso
mas raro).

## Requisitos funcionales

- **FR-001** El `<tbody>` de la tabla de campos DEBE contener unicamente filas de
  campo; ningun formulario ni vista previa puede vivir dentro.
- **FR-002** El editor de un campo DEBE abrirse en un panel lateral (drawer) y no
  dentro de la celda de la tabla, con ancho suficiente para el HTML/CSS/JS.
- **FR-003** El drawer DEBE servir para el alta y la edicion (una sola superficie).
  El formulario NO se copia: se mueve desde el dormitorio y vuelve al cerrar, de
  modo que conserva valores y handlers. Solo hay uno dentro a la vez.
- **FR-004** El alta DEBE ser un boton que abre el drawer, no un formulario
  permanentemente visible.
- **FR-005** Los estilos globales DEBEN seguir editandose desde la pestana Campos
  (se conserva FR-024 de la 012: sin navegar), pero al **pie** y **plegados**.
- **FR-006** "Probar" DEBE abrir un **MODAL** centrado con la vista previa al ancho
  del panel del comprador (una columna de producto de Woo: ~324-538 px, 673 en
  movil), que es lo que el comprador ve de verdad. A ancho completo se ve el mismo
  contenido flotando a la izquierda: no aporta nada. El modal se llama **desde la
  fila, sin abrir el editor**, y tambien desde el boton "Probar" del drawer.
- **FR-007** El drawer DEBE traer su propio boton "Probar": con el drawer abierto
  la fila queda tapada, asi que el "Probar" de la fila no sirve para reprobar lo
  recien escrito.
- **FR-008** Cerrar el drawer DEBE devolver el formulario al dormitorio y pedir
  confirmacion si hay cambios sin guardar. `Esc` cierra primero el modal de la
  vista previa y, si ya no esta, el drawer. `Ctrl+Enter` guarda.
- **FR-009** El servidor DEBE seguir siendo la fuente unica del markup: el alta y
  el duplicado devuelven la fila (clave `html`) y su formulario (clave `form`).
- **FR-010** Las acciones de la fila DEBEN ser iconos del core (`dashicons`), no
  cinco botones de texto que pesan mas que la fila. El estado de "Plantilla" va en
  `aria-pressed` y en la estrella (rellena/vacia); el texto va a
  `screen-reader-text` y el `title`/`aria-label` queda siempre.
- **FR-011** El atributo `hidden` DEBE ocultar de verdad: WordPress fuerza
  `display:inline-block` a `.button`, que le gana a la regla `[hidden]` del
  navegador. Sin una regla que lo corrija, "Quitar filtros" se ve siempre.

## Fuera de alcance (aplazado, con el criterio de por que)

- **Columna "Uso" enlazable** a los PDFs filtrados. Depende de como se elija saltar
  entre pestanas.
- **Que la fila nueva quede a la vista** tras crearla. A 5 campos entra en pantalla;
  con 40 no. Es un caso de escalado sin medir todavia.

## Verificacion

- `php -l`, `node --check`.
- Puertas: `motor_smoke`, `parity`, `campos_migracion`, `certificacion_hoja`,
  `campos-contrato`, `conciliacion`, `mockup-contrato`, `mockup-geometria`, `validez`.
- Arnes `texto_puente.php`: 20 fases.
- Lab con navegador real: `smoke-campos.js`, `smoke-ficha.js`, `preview-cargador.js`.

El check `la tarjeta del global esta siempre arriba (FR-024)` de
`tests/campos-contrato.test.js` fue reescrito: codificaba la *posicion* vieja, no
la intencion de FR-024. Ahora afirma que el global se edita desde la pestana
Campos, que va despues de la lista, y que viene plegado.