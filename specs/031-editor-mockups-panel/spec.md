# Spec 031 — Rediseno del panel del editor de mockups

**Feature Branch**: `031-editor-mockups-panel`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Rediseno del panel del editor de mockups de la consola: lienzo siempre visible (panel izquierdo de minimo 300 px, zoom inicial 100 %), transformacion de la seleccion (x/y/ancho/alto/rotacion + alinear + distribuir) debajo del lienzo, panel derecho en 5 acordeones cerrados por defecto (Vistas del PDF, Capas, Ajustes, Imagenes, Placeholders), capas agrupadas por grupo en acordeones con controles propios, acciones de capa (Duplicar/Quitar/Agrupar/Desagrupar/Ocultar/Bloquear) en menu contextual de clic derecho con atajos y boton de fallback, importar pagina + PH bajo Placeholders, y paridad del clip del tirador de rotacion de capa individual."

> Construye sobre la spec 011 (editor de mockups visual) y la 013 (patron de
> acordeones plegados de la consola). **Solo UI del editor del admin**: no toca
> `engine/`, `modules/textmuy/`, la ficha del comprador ni el formato de
> `config.json` (constitucion §IV y §V: sin migraciones, sin retrocompatibilidad
> en desarrollo).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El lienzo siempre cabe (Priority: P1)

El admin abre la consola de un PDF y el lienzo de trabajo (300x300 logico) se ve
completo, sin corte horizontal, con zoom inicial 100 %: hoy el grid puede
aplastar el panel izquierdo por debajo de 300 px y el zoom arranca en 200 %, con
lo que el admin compone con el lienzo recortado sin darse cuenta.

**Why this priority**: Sin lienzo visible no hay edicion confiable: es la base de
todo lo demas (las vistas previas son el PDF; el editor es donde se compone).

**Independent Test**: Abrir el editor de un PDF con mockups en ventanas de 1280
y 1366 px (y en la degradacion a una columna < 1100 px) y medir: lienzo entero
visible, zoom 100 %, panel izquierdo >= 300 px de contenido.

**Acceptance Scenarios**:

1. **Given** un PDF con mockups cargado en la consola, **When** el admin abre el
   editor de mockups, **Then** el lienzo de 300 px se muestra entero (ningun
   borde cortado) a zoom 100 %, y el panel izquierdo no baja de 300 px de
   contenido.
2. **Given** una ventana estrecha (< 325 px de ancho util para el panel), **When**
   el editor se renderiza, **Then** el padding horizontal del panel izquierdo es
   0 para no restar espacio al lienzo.
3. **Given** el editor abierto a zoom 100 %, **When** el admin elige otro zoom
   (150/200/300 %), **Then** el lienzo escala con su barra de desplazamiento
   habitual (comportamiento vigente) y el recorte radial de los tiradores de
   rotacion sigue activo (vigente desde 4.22.5).

---

### User Story 2 - La transformacion de la seleccion vive junto al lienzo (Priority: P1)

Al seleccionar una o varias capas, el admin ve y ajusta x, y, ancho, alto y
rotacion, alinea (Izquierda/Centro H/Derecha/Arriba/Centro V/Abajo) y distribuye
(H/V) **debajo del lienzo**, sobre el contexto de lo que esta editando, en lugar
de buscarlo en el panel derecho.

**Why this priority**: Son las acciones mas frecuentes sobre la seleccion; hoy
estan enterradas (propiedades en un panel oculto a la derecha; alinear y
distribuir dentro del panel Capas).

**Independent Test**: Seleccionar una capa en el lienzo y verificar que el
bloque de propiedades aparece bajo el lienzo con los valores de la capa, que
cambiar un numero redibuja, y que alinear/distribuir con seleccion multiple
(Ctrl+clic) funciona igual que hoy.

**Acceptance Scenarios**:

1. **Given** una capa seleccionada, **When** el admin mira debajo del lienzo,
   **Then** ve x/y/ancho/alto/rotacion numericos con los valores de la capa, los
   6 controles de alineacion y Distribuir H/V; **And** al deseleccionar, el
   bloque se oculta.
2. **Given** varias capas seleccionadas (Ctrl+clic en el lienzo o en la lista),
   **When** pulsa Centro H y luego Distribuir H, **Then** la geometria
   resultante es la misma que producen hoy los controles del panel derecho
   (misma geometria pura, sin cambios de motor).
3. **Given** el editor en ventana estrecha (una columna), **When** el admin
   desplaza, **Then** el orden es lienzo, bloque de transformacion, ayuda
   (coherente con la lectura de arriba a abajo).

---

### User Story 3 - El panel derecho son 5 acordeones cerrados (Priority: P1)

El panel derecho del editor presenta exactamente 5 acordeones —Vistas del PDF,
Capas, Ajustes, Imagenes, Placeholders— todos cerrados al abrir, cada uno
independiente, con el contenido que hoy tiene cada bloque reubicado.

**Why this priority**: Hoy el panel derecho es una columna larga donde la
galeria de vistas y la lista de capas compiten por espacio; el lienzo debe ser
la estrella.

**Independent Test**: Abrir el editor: los 5 acordeones estan cerrados; abrir
cualquiera muestra su contenido vigente; abrir dos a la vez es posible.

**Acceptance Scenarios**:

1. **Given** el editor recien abierto, **When** el admin mira el panel derecho,
   **Then** ve los 5 acordeones cerrados y reconoce cada titulo.
2. **Given** un acordeon abierto, **When** abre otro, **Then** el primero
   permanece abierto (independientes, no excluyentes).
3. **Given** Vistas del PDF abierto, **When** recorre el acordeon, **Then** ve
   el titulo de la vista arriba, la galeria de vistas y abajo Nueva vista /
   Duplicar / Eliminar + Vista previa omisible (como hoy).

---

### User Story 4 - Capas agrupadas por grupo en acordeones (Priority: P2)

En el acordeon Capas, las capas que forman un grupo (p. ej. una pagina de PDF
importada con sus placeholders, o un grupo creado por el admin) aparecen dentro
de un acordeon propio con controles de transformacion del grupo; las capas sin
grupo se listan en una seccion Sin grupo. Los botones + Imagen y + Placeholder
desaparecen (sus rutas alternativas ya existen en Imagenes y Placeholders).

**Why this priority**: La lista plana de hoy esconde la estructura del mockup;
un grupo importado de pagina completa se ve como filas sueltas sin relacion
visible.

**Independent Test**: Importar una pagina + PH y verificar en Capas un
acordeon de grupo con la foto y los placeholders dentro; clic en la cabecera
selecciona el grupo; Alt+clic en un miembro lo selecciona solo; subir/bajar
sigue funcionando.

**Acceptance Scenarios**:

1. **Given** un mockup con un grupo de 3+ capas, **When** el admin abre Capas,
   **Then** ve un acordeon por grupo (cabecera con la marca de color o
   placeholder asociado + controles de grupo) y sus miembros dentro con
   ▲▼◻🔒.
2. **Given** capas sin grupo, **When** abre Capas, **Then** aparecen en la
   seccion Sin grupo, arriba de los grupos.
3. **Given** el acordeon Capas, **When** busca + Imagen o + Placeholder,
   **Then** no existen; **And** agregar una imagen desde el acordeon Imagenes y
   un placeholder desde el acordeon Placeholders sigue funcionando con un clic.

---

### User Story 5 - Acciones de capa por menu contextual y atajos (Priority: P2)

El admin hace clic derecho sobre una fila de capa (o sobre la cabecera de un
grupo) y obtiene Duplicar, Quitar, Agrupar, Desagrupar, Ocultar y Bloquear segun
el contexto; las mismas acciones existen por teclado sobre la capa seleccionada
y por un boton de acciones (...) en la fila, para quien no descubra el clic
derecho.

**Why this priority**: Saca 4 botones de la barra de Capas (hoy siempre a la
vista aunque se usan poco) sin perder descubribilidad ni accesibilidad.

**Independent Test**: Clic derecho en una capa → menu con las acciones
habilitadas segun estado; Delete quita; Ctrl+D duplica; el boton ... abre el
mismo menu; cada accion produce el mismo efecto que hoy (mismas guardas).

**Acceptance Scenarios**:

1. **Given** una capa seleccionada, **When** clic derecho en su fila, **Then**
   el menu ofrece Duplicar, Quitar, Ocultar/Bloquear y, con 2+ capas
   seleccionables, Agrupar; Desagrupar solo si la capa pertenece a un grupo.
2. **Given** el menu abierto, **When** el admin hace clic fuera, pulsa Esc o
   desplaza la lista, **Then** el menu se cierra.
3. **Given** una capa seleccionada, **When** pulsa Delete (o Ctrl+D), **Then**
   se comporta como Quitar (o Duplicar) con las mismas guardas que los botones
   vigentes.
4. **Given** una capa bloqueada u oculta, **When** abre el menu contextual,
   **Then** las acciones invalidas para ese estado aparecen deshabilitadas (o
   ausentes), con la causa visible.

---

### User Story 6 - Placeholders acoge el importador y sus grupos (Priority: P2)

El importador de pagina (Pagina del PDF [n] + Importar pagina + PH, con su
ayuda y estado) vive en el acordeon Placeholders; los grupos de placeholders
del PDF se muestran en acordeones con sus instancias (PH-gid-nn) dentro.

**Why this priority**: El importador trae placeholders; tenerlo dentro de
Capas es incoherente. Los acordeones por grupo dejan ver la estructura del PDF
sin ocupar toda la columna.

**Independent Test**: Desde Placeholders abierto, importar la pagina 1: aparece
el grupo en el lienzo; los grupos con varias instancias muestran su lista dentro
del acordeon; insertar un placeholder sigue igual.

**Acceptance Scenarios**:

1. **Given** el acordeon Placeholders abierto, **When** elige pagina 1 y pulsa
   Importar pagina + PH, **Then** la pagina rasterizada y sus placeholders se
   agregan como grupo movible, redimensionable y rotatable (comportamiento
   vigente de la importacion).
2. **Given** un PDF con grupos de placeholders de varias instancias, **When**
   abre Placeholders, **Then** cada grupo es un acordeon con sus instancias
   dentro (la lista de instancias vigente, FR-015 de la 011).
3. **Given** una importacion con numero de pagina invalido o sin geometria,
   **When** importa, **Then** el estado bajo el importador informa la causa,
   como hoy.

---

### User Story 7 - Imagenes: galeria del catalogo en su acordeon (Priority: P3)

El acordeon Imagenes contiene la galeria del catalogo del proyecto con
buscador, agregar al clic y borrado (x); arrastrar un archivo sobre el lienzo
sigue funcionando.

**Why this priority**: Es el contenido de hoy reubicado; importa que nada se
pierda en el reorden.

**Independent Test**: Abrir Imagenes, buscar, agregar una imagen al mockup,
borrar una del catalogo.

**Acceptance Scenarios**:

1. **Given** el acordeon Imagenes abierto con catalogo cargado, **When** el
   admin busca y hace clic en una miniatura, **Then** se agrega como capa
   (como hoy).
2. **Given** una imagen del catalogo usada por una capa, **When** intenta
   borrarla con x, **Then** la guarda de uso vigente se comporta como hoy.

---

### User Story 8 - Pendientes del editor: clip de capa y documentacion (Priority: P3)

El tirador de rotacion de una capa individual se recorta al lienzo igual que el
del grupo (paridad con 4.22.5), y la ayuda del editor explica el menu
contextual, los atajos, los acordeones y que un grupo puede exceder el lienzo
(la parte fuera queda recortada al renderizar).

**Why this priority**: Cierra las asimetrias y deudas documentales al lado del
rediseno, en la misma entrega.

**Independent Test**: Medir tinta del tirador de capa en el borde del lienzo
(igual que la puerta de tinta del tirador grupal) y leer la ayuda actualizada.

**Acceptance Scenarios**:

1. **Given** una capa rotada cuyo tirador natural quedaria fuera del lienzo,
   **When** el editor la muestra, **Then** el tirador aparece en el borde del
   lienzo (clip radial), igual que el grupal.
2. **Given** la ayuda del editor, **When** el admin la lee, **Then** encuentra
   el menu contextual, los atajos, los acordeones y el aviso de recorte de
   grupos grandes.

---

### Edge Cases

- Mockup sin capas: el acordeon Capas muestra el aviso vigente; el bloque de
  transformacion bajo el lienzo no aparece.
- Cabecera del acordeon de grupo: el triangulo expande/contrae; pulsar la zona
  del nombre selecciona el grupo entero (dos zonas distintas, sin conflicto).
- Seleccion multiple en el bloque de transformacion: valores de la primera capa
  seleccionada y comportamiento de seleccion multiple vigente.
- Menu contextual sobre la ultima capa: Quitar respeta la guarda vigente de
  borrarCapa (hoy ya existe).
- Ventana < 1100 px: una sola columna, orden lienzo → transformacion → ayuda;
  los acordeones del panel derecho se apilan debajo.
- Zoom transitorio: reabrir el editor siempre arranca en 100 %; no hay
  persistencia ni auto-fit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El editor DEBE mostrar el lienzo de trabajo completo (300x300
  logico) sin corte horizontal al abrir, con zoom inicial 100 %, tanto en el
  layout de dos columnas (>= 1100 px) como en el degradado de una columna.
- **FR-002**: El panel izquierdo DEBE garantizar 300 px de ancho de contenido
  (minimo); por debajo de 325 px de ancho disponible, su padding horizontal
  DEBE ser 0.
- **FR-003**: Las propiedades numericas (x, y, ancho, alto, rotacion), los 6
  controles de alineacion y los 2 de distribucion DEBEN ubicarse debajo del
  lienzo y arriba de la ayuda del editor, visibles solo con seleccion activa.
- **FR-004**: El panel derecho DEBE organizarse en exactamente 5 acordeones
  (Vistas del PDF, Capas, Ajustes, Imagenes, Placeholders), todos cerrados por
  defecto, independientes entre si y sin persistencia de su estado.
- **FR-005**: El acordeon Vistas del PDF DEBE mostrar, en orden: titulo de la
  vista, galeria de vistas y, al pie, Nueva vista / Duplicar / Eliminar +
  Vista previa omisible.
- **FR-006**: La lista de capas DEBE agrupar visualmente las capas que comparten
  grupo en un acordeon propio, con controles de transformacion del grupo y
  desagrupar; las capas sin grupo DEBEN listarse en una seccion Sin grupo.
- **FR-007**: Los botones + Imagen y + Placeholder DEBEN eliminarse del panel
  Capas; agregar una imagen desde el acordeon Imagenes y un placeholder desde
  el acordeon Placeholders DEBE seguir siendo posible con un clic.
- **FR-008**: Duplicar, Quitar, Agrupar y Desagrupar DEBEN estar disponibles en
  un menu contextual al hacer clic derecho en una fila de capa o en la cabecera
  de un grupo, con habilitacion segun el estado de la seleccion (Agrupar exige
  2+ capas seleccionables; Desagrupar solo si hay grupo; Quitar respeta las
  guardas vigentes).
- **FR-009**: Toda accion del menu contextual DEBE ser alcanzable sin clic
  derecho: Quitar (Delete) y Duplicar (Ctrl+D) ya existen por teclado (T044);
  Agrupar, Desagrupar, Ocultar y Bloquear DEBEN ser alcanzables por un boton de
  acciones visible en la fila de la capa (o en la cabecera del grupo).
- **FR-010**: Subir y Bajar (con envio al extremo por pulsacion larga), Ocultar
  y Bloquear DEBEN mantenerse en la fila de cada capa, como hoy.
- **FR-011**: El acordeon Ajustes DEBE contener los filtros por capa (brillo,
  contraste, saturacion, gama, opacidad, tono), el encuadre (modo, escala y
  desplazamiento) y la perspectiva de 4 puntos, con restablecer.
- **FR-012**: El acordeon Placeholders DEBE contener el importador de pagina
  (numero + Importar pagina + PH, con su ayuda y estado) y la lista de grupos
  de placeholders del PDF en acordeones con sus instancias dentro.
- **FR-013**: El acordeon Imagenes DEBE contener la galeria del catalogo con
  buscador, agregar al clic y borrado (x); arrastrar un archivo sobre el lienzo
  DEBE seguir funcionando.
- **FR-014**: El menu contextual DEBE cerrarse al hacer clic fuera, pulsar Esc o
  desplazar la lista, y solo debe abrirse desde la lista de capas (filas y
  cabeceras de grupo), no desde el lienzo.
- **FR-015**: El tirador de rotacion de una capa individual DEBE recortarse al
  lienzo con la misma regla radial que el tirador grupal (paridad; vigente desde
  4.22.5 para el grupal).
- **FR-016**: La ayuda interna de la consola DEBE documentar el menu contextual,
  los atajos de teclado, los acordeones y que un grupo puede exceder el lienzo
  (la parte fuera queda recortada al renderizar).
- **FR-017**: El formato de `config.json` (mockups, capas, grupo) NO DEBE cambiar;
  un mockup guardado con versiones anteriores del editor DEBE abrirse y editarse
  igual (lectura del dataset vigente; sin migraciones).
- **FR-018**: La ficha del comprador, el render compartido y el Motor NO deben
  cambiar de comportamiento: el rediseno es solo del panel del editor del admin.
- **FR-019**: El autoguardado, el deshacer/rehacer y la promocion a pedido (vista
  previa, mockup congelado) NO deben cambiar de comportamiento ni de formato.

### Key Entities *(include if feature involves data)*

- **Panel izquierdo**: barra de zoom, lienzo de trabajo, bloque de
  transformacion de la seleccion (x/y/ancho/alto/rot + alinear + distribuir),
  ayuda y alertas. Garantiza 300 px de contenido.
- **Panel derecho**: 5 acordeones (Vistas del PDF, Capas, Ajustes, Imagenes,
  Placeholders), cerrados por defecto.
- **Fila de capa**: miniatura, nombre, detalle, ▲▼◻🔒 y boton de acciones
  (...); clic derecho abre el menu contextual.
- **Acordeon de grupo (Capas)**: cabecera (marca de color o placeholder
  asociado + controles de transformacion del grupo) + capas miembro.
- **Menu contextual**: acciones con estado (Duplicar, Quitar, Agrupar,
  Desagrupar, Ocultar, Bloquear) sobre filas de capa y cabeceras de grupo.
- **Seleccion**: 1..N capas; el bloque de transformacion y el menu actuan sobre
  ella con las guardas vigentes.

_Sin entidades de datos nuevas: `config.json:mockups[]` conserva su formato
vigente (constitucion §IV; norma ex-008)._

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de las aperturas del editor (layout de dos columnas y
  degradado a una columna), el lienzo de 300 px se ve completo a zoom inicial
  100 %, sin corte ni desborde horizontal.
- **SC-002**: El 100 % de las acciones sobre capas (subir, bajar, ocultar,
  bloquear, duplicar, quitar, agrupar, desagrupar) son alcanzables sin clic
  derecho: 6 por teclado vigente (Delete, Ctrl+D, [, ], flechas, Ctrl+Z) y el
  resto por un boton visible en la fila; verificado por recorrido solo con
  teclado.
- **SC-003**: Localizar y ejecutar cualquier accion de capa toma como maximo 2
  interacciones (abrir acordeon + accion) o 1 atajo de teclado.
- **SC-004**: Cero regresiones en las puertas vigentes: contrato Node del editor
  (actualizado a la nueva estructura), geometria Node, fases del arnes
  `mockups*`, `mockup_capas`, `mockup_pagina` y `mockup_preview`,
  `ficha-pedido.browser.js` y smoke de la consola.
- **SC-005**: El dataset guardado con el editor redisenado es estructuralmente
  identico al vigente (mismas claves de `mockups[]`/`capas[]`/`grupo`); abrir un
  mockup guardado antes del cambio produce la misma edicion que antes.
- **SC-006**: El tirador de rotacion de capa individual nunca se dibuja fuera
  del lienzo (paridad con el grupal), verificado con medicion de tinta en el
  lab, igual que la puerta de 4.22.5.
- **SC-007**: Recorrido de aceptacion en el lab (WP+Woo reales, `C:\wp-lab`):
  importar pagina + PH, acomodar el grupo con los controles bajo el lienzo,
  aplicar un filtro desde Ajustes, guardar y ver la vista previa — sin errores
  y con el mockup renderizado correctamente.

## Assumptions

- Los acordeones usan el patron visual de la consola (acordeones de la spec
  013); cerrados por defecto; su estado abierto/cerrado no persiste.
- El zoom es transitorio (no persiste, como hoy) y arranca en 100 %; no hay
  auto-fit.
- Los grupos no ganan nombre propio: la cabecera del acordeon muestra la marca
  de color o placeholder asociado, como hoy (evita nuevo dato en `config.json`).
- El menu contextual vive solo en la lista de capas (filas y cabeceras de
  grupo); el lienzo mantiene su comportamiento de clic vigente.
- Las acciones del menu reutilizan la logica vigente (duplicar, borrar, agrupar,
  desagrupar, ocultar, bloquear) sin cambiar sus guardas ni su semantica.
- + Imagen y + Placeholder se quitan porque sus rutas alternativas (clic en
  Imagenes / Placeholders) ya existen y son las mismas puertas de alta.
- Los atajos Delete, Ctrl+D, [ y ] ya existen (T044): el menu contextual
  complementa (Agrupar/Desagrupar/Ocultar/Bloquear), no reemplaza.
- Sin migraciones ni retrocompatibilidad: el admin abre sus mockups vigentes
  sin paso previo (formato intacto, constitucion §V).
- Entorno de aceptacion: lab local `C:\wp-lab` con WP+Woo reales y PDF de
  muestra con grupos e importacion de pagina.

## Decisiones (sesion de especificacion, 2026-10-26)

| # | Decision |
|---|----------|
| D1 | Transformacion completa de la seleccion (x/y/ancho/alto/rot + alinear + distribuir) debajo del lienzo; Ajustes = filtros + encuadre + perspectiva. |
| D2 | Zoom inicial 100 %, transitorio, sin auto-fit. |
| D3 | Menu contextual = Duplicar/Quitar/Agrupar/Desagrupar/Ocultar/Bloquear; descubribilidad con atajos vigentes (Delete, Ctrl+D) + boton ... visible en la fila; ▲▼◻🔒 siguen en la fila. |
| D4 | Acordeon de grupo sin nombrado nuevo (cabecera = marca de color/placeholder); capas sin grupo en seccion Sin grupo. |
| D5 | 5 acordeones cerrados por defecto, independientes, no persistentes. |
| D6 | Se eliminan + Imagen/+ Placeholder; el importador de pagina + PH se muda a Placeholders. |
| D7 | El menu contextual vive solo en la lista de capas (no en el lienzo). |
| D8 | Entran en la misma spec los pendientes del editor: clip del tirador de capa (paridad con el grupal) y documentacion de ayuda. |

## Out of Scope

- Ficha del comprador y `assets/tienda.js` (usan el render compartido, no este
  panel).
- `modules/textmuy/` y el motor PHP (`engine/`, `inc/`): sin cambios.
- Nuevos datos en `config.json` (nombres de grupo, estado de acordeones, zoom).
- Auto-fit de zoom, persistencia de UI, menu contextual en el lienzo, renombrar
  grupos.
- Importar/exportar mockups (fuera de alcance, igual que en la 012).
