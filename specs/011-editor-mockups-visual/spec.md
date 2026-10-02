# Feature Specification: editor-mockups-visual

**Feature Branch**: `main`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "quiero mejorar muchisimo la interfaz para crear Mockups, lo voy a
hacer en una PC principalmente, y prefiero algo mas visual, REVISA el estado actual y sugiere todas
las mejoras"

> Contexto de la solicitud: "muchisimo" y "mas visual" son el criterio de aceptacion, no una
> metafora. La revision del estado actual (abajo) encontro que el editor de mockups **no tiene ni una
> sola regla de estilo propia** y se maneja **enteramente con campos numericos**; de ahi el salto de
> calidad pedido.

## Diagnostico del estado actual (base de la spec)

Verificado sobre el codigo vigente antes de especificar:

| Hallazgo | Evidencia | Efecto para el admin |
|---|---|---|
| El editor no tiene CSS propio | `grep "ec-mk" --include=*.css` -> 0 resultados; `mockups.js` no inyecta estilos (a diferencia de `selector-pmu.js`, que si lo hace) | El "editor" es HTML crudo: canvas 300px + tabla de numeros + `<ul>` de botones, dentro de una card de 960px (`admin.css:23`) |
| Todo se controla con numeros | `mockups.js:110-129` (`pintarProps`): `x, y, w, h, rot, sesgo` en `<input type=number>`; 0 eventos `pointerdown` en el archivo | Colocar un hueco exige calcular pixeles a mano; el propio `tasks.md:66` (T008) lo marca como pendiente |
| Dos dialogos de texto como flujo principal | `mockups.js:240` (foto) y `:255` (grupo) usan `window.prompt` con listas de nombres de archivo / ids hex | Para agregar una foto hay que subirla, abrir un prompt y copiar el nombre exacto |
| El lienzo no muestra el texto real | `mockups.js:171-180` dibuja una caja gris con el `ref` | El admin compone a ciegas; el render bueno ocurre recien en la ficha del cliente |
| Listado de mockups duplicado | `admin/pdfs.php:519-528` lo imprime PHP y `mockups.js` nunca lo actualiza | La lista de abajo miente hasta recargar |
| El catalogo `img/` no es alcanzable | El selector de fotos solo lee `datos.fotos` (`pdfs/{nombre}/mockups/`) | Se desaprovecha un inventario que la constitucion ya permite como fuente |
| Filtro `gama` permitido y no implementado | `inc/class-pmu-uploads.php:729` lo acepta; `filtroCss()` no lo aplica en `mockups.js` ni en `tienda.js` | Un valor valido se guarda y no se ve |
| La casilla "vista previa omisible" puede pisarse | `pdfs.php:498` la guarda el formulario general; `mockups.js:326` envia el valor congelado al cargar la pagina y `handle_mockups_guardar` lo escribe siempre | Desmarcar y guardar mockups puede dejar la casilla como estaba |
| Sin zoom, sin nitidez, sin red, sin deshacer, sin atajos | `canvas width=300` sin `devicePixelRatio`; sin historial, sin autoguardado, sin teclado | En una PC el trabajo de precision es incomodo y el trabajo se pierde |

## Clarifications

### Session 2026-10-01 (D1-D6, cerradas antes de especificar)

- **D1 - Donde vive el editor (decisivo)**: el editor **se mantiene embebido en la seccion
  "Mockups"** del PDF, en **dos columnas** (lienzo de trabajo a la izquierda; recursos, capas y
  propiedades a la derecha), dentro del ancho actual de la consola. **No** se abre en overlay a
  pantalla completa ni en pestana nueva: el admin ve el contexto (grupos, mapeos, fotos) mientras
  compone. El precio de esta decision es el espacio, y se compensa con **zoom y lienzo de
  trabajo** (D3), no con quitar contexto.
- **D2 - Preview del texto: fuente unica (decisivo)**: el editor **reutiliza el render que ya
  produce el boton "Probar"** de cada grupo (el que hoy se ve en la caja de vista previa de
  texto). No hay motor de render nuevo ni boton "renderizar" propio: cuando ese preview existe, el
  lienzo dibuja esa imagen en las capas del grupo; cuando no existe, dibuja la caja neutra de
  encuadre, como hoy. Cada pulsacion de "Probar" (o cada cambio que invalide el render: tipo,
  estilo, codigo, campo) **repinta automaticamente** las capas afectadas del mockup. Un solo
  motor, un solo cache por grupo+tamano, cero renders duplicados.
- **D3 - Superficie de trabajo**: la salida sigue siendo **300x300 px fijos** (norma vigente), pero
  el **lienzo de trabajo es independiente y ampliable** (100 / 150 / 200 / 300 %) y se dibuja con
  nitidez en pantallas de alta densidad. Lo que el admin compone es siempre el mismo 300x300 que
  vera el cliente: el zoom es solo una lupa.
- **D4 - Paridad editor <-> cliente**: el editor y la ficha del cliente **deben componer con la misma
  regla**. Hoy ambos dibujan el placeholder estirado a la caja de la capa; como el render del hueco
  tiene su propia proporcion, un encuadre con proporcion distinta **deforma la imagen que vera el
  cliente**. Se fija la regla: **encajar sin deformar** (nunca estirar) y, cuando la proporcion de la
  capa difiere de la del hueco, **avisar en el editor**. Se aplica en ambos lados a la vez.
- **D5 - Preview "como lo ve el cliente"**: el editor incluye una simulacion de la galeria de la
  ficha (300x300 con flechas y estado "Generando vista previa") para que el admin valide el
  encuadre en el contexto exacto de la venta. No es una segunda vista: es la misma composicion
  mostrada a escala de cliente.
- **D6 - Alcance de esta entrega**: entra **todo el bloque P0 + P1** (interfaz completa, incluida la

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Colocar y alinear los huecos arrastrando (Priority: P1)

El administrador tiene una foto de un banderin colgado en una pared y dos huecos que debe acomodar
sobre ella. Quiere **ver la foto a buena resolucion, tomar el hueco con el raton y ajustarlo hasta
que encaje**, con imanes que lo peguen al centro y a los bordes. Hoy tiene que calcular pixeles y
escribirlos en seis casillas.

**Why this priority**: es el nucleo de "mas visual". Sin manipulacion directa, cualquier otra
mejora (colores, paneles, preview) sigue siendo un formulario de numeros mas bonito.

**Independent Test**: abrir un PDF con 2 grupos, crear un mockup, anadir una foto y dos huecos, y
colocarlos **solo con arrastrar y redimensionar**, sin escribir un numero. El resultado se guarda,
se recarga la pagina y el mockup conserva la posicion.

**Acceptance Scenarios**:

1. **Given** un mockup con una foto de fondo, **When** el admin arrastra un hueco hasta el centro, **Then** una guia aparece y el hueco queda pegado al centro exacto sin escribir coordenadas.
2. **Given** un hueco seleccionado, **When** el admin toma un tirador de esquina, **Then** la capa cambia de tamano manteniendo su proporcion mientras se mantiene la tecla de modificacion pulsada, y se ve la medida en pixeles.
3. **Given** un hueco seleccionado, **When** el admin lo arrastra fuera del lienzo, **Then** el lienzo acota la posicion y la capa nunca desaparece del area de trabajo.
4. **Given** un lienzo ampliado al 200 %, **When** el admin arrastra, **Then** el movimiento sigue al puntero sin desviarse y la composicion resultante es identica a la del 100 %.

---

### User Story 2 - Ver el resultado real antes de guardar (Priority: P1)

El administrador quiere saber **como se va a ver la personalizacion** (el texto con su estilo, en su
tamano exacto) **dentro de la foto** antes de aprobar el mockup. Hoy el lienzo muestra una caja gris
con un identificador y el admin termina de encuadrar a ciegas.

**Why this priority**: sin esto, el admin compone contra una aproximacion y descubre el error cuando
el cliente ya vio la vista previa.

**Independent Test**: en un grupo con texto y estilo, pulsar "Probar" y comprobar que la capa
correspondiente del mockup muestra ese render en el hueco, a la proporcion correcta.

**Acceptance Scenarios**:

1. **Given** un grupo con estilo y valor, **When** el admin pulsa "Probar" en su panel, **Then** todas las capas del mockup que referencian ese grupo pasan a mostrar esa imagen, sin volver a guardar ni recargar.
2. **Given** un grupo sin render (sin estilo, o tipo imagen), **When** se compone el mockup, **Then** su capa se dibuja como caja neutra de encuadre y el editor sigue siendo utilizable.
3. **Given** un grupo cuyo texto cambia y se vuelve a pulsar "Probar", **When** termina el render, **Then** el lienzo muestra la version nueva y la anterior se descarta.
4. **Given** un fallo de render (estilo inexistente, fuente sin descarga), **When** ocurre, **Then** el editor lo informa y la capa cae a la caja neutra; el mockup sigue editable y guardable.

---

### User Story 3 - Gestionar fotos y capas sin teclear nombres (Priority: P1)

El administrador tiene fotos en su disco y en el catalogo del proyecto, y quiere anadirlas como
capas **viéndolas**, no escribiendo nombres. Y cuando una composicion tiene 6 capas, quiere
entender cual esta arriba, renombrarla, duplicarla, ocultarla o alinearla sin pelearse con una
lista de flechas.

**Why this priority**: es lo que hace que un editor se sienta una herramienta y no un formulario.
Hoy exige copiar el nombre exacto de archivo a un dialogo de texto.

**Independent Test**: subir dos fotos, anadir una del catalogo, colocarlas, renombrar la capa de
texto, subirla de orden y guardar; recargar y comprobar que todo persiste.

**Acceptance Scenarios**:

1. **Given** la seccion de fotos vacia, **When** el admin arrastra un archivo de imagen desde su escritorio sobre el area de trabajo, **Then** la foto se sube, aparece en la lista y **tambien** queda anadida como capa que cubre todo el lienzo, sin pedir el nombre.
2. **Given** un catalogo de imagenes del proyecto, **When** el admin busca y elige una, **Then** se anade como capa con la misma geometria que las demas.
3. **Given** un grupo detectado, **When** el admin lo elige de una lista con su identificador, tamano real y numero de instancias, **Then** el hueco aparece encuadrado a escala y seleccionado.
4. **Given** varias capas, **When** el admin alinea una al centro horizontal, **Then** se centra respecto del lienzo y las demas capas no se mueven.
5. **Given** una capa de fotos, **When** el admin la oculta, **Then** deja de verse en el lienzo y en la vista de cliente sin perder su geometria.

  reutilizacion del preview y los filtros ampliados). El bloque **P2 queda explicitamente fuera**
  (mascaras/recorte, plantillas reutilizables entre PDFs, auto-encuadre, historial de versiones,
  optimizacion de rendimiento): son mejoras valiosas pero no bloquean la calidad pedida.

---

### User Story 4 - No perder el trabajo (Priority: P2)

El administrador compone un mockup largo, toma un cafe, vuelve y encuentra que un clic guardo
todo. O peor: navega a otro PDF y pierde diez minutos de encuadre. Y si se equivoca al mover una
capa, necesita volver atras sin volver a empezar.

**Why this priority**: con un editor que manipula objetos, el costo de equivocarse sube; perder el
trabajo destruye la confianza en la herramienta mas rapido que cualquier falta de estetica.

**Independent Test**: mover una capa, esperar, recargar la pagina y comprobar que el cambio esta.
Luego deshacer un movimiento y comprobar que el estado anterior se restaura.

**Acceptance Scenarios**:

1. **Given** un cambio en el lienzo, **When** pasan unos segundos sin mas cambios, **Then** se guarda solo y el estado pasa de "Sin guardar" a "Guardado" con confirmacion visible.
2. **Given** cambios pendientes y **When** el admin intenta cambiar de PDF o de pestana, **Then** se le pregunta y puede confirmar o cancelar.
3. **Given** un movimiento de capa, **When** el admin pulsa deshacer (o el atajo), **Then** la capa vuelve a su posicion anterior; repetir rehace el movimiento.
4. **Given** un fallo de red al guardar, **When** el admin reintenta, **Then** el estado vuelve a "Sin guardar" y el error es visible y accionable, sin perder el contenido del lienzo.

---

### User Story 5 - Ver el mockup en el contexto de la venta (Priority: P2)

Antes de aprobar, el administrador quiere ver el mockup **tal como lo vera el cliente** en la
galeria de la ficha: 300x300, con las flechas si hay varias vistas y el estado "Generando vista
previa" mientras se compone. Quiere validar el encuadre en el contexto real, no en abstracto.

**Why this priority**: el mockup existe para la aprobacion del cliente; verlo en otro formato puede
dar una falsa confianza.

**Independent Test**: abrir la vista de cliente dentro del editor y comprobar que la imagen
resultante es la misma composicion y el mismo tamano que la que recibe el cliente.

**Acceptance Scenarios**:

1. **Given** un mockup compuesto, **When** el admin abre la vista de cliente, **Then** ve la composicion a 300x300 con el mismo encuadre, sin marcos ni guias de edicion.
2. **Given** varias vistas del PDF, **When** el admin las recorre, **Then** la galeria se comporta como la de la ficha (flechas e indice).
3. **Given** una capa cuya proporcion no coincide con la del hueco, **When** el admin compone, **Then** la imagen se encaja sin deformarse y el editor avisa de la discrepancia.

---

### Edge Cases

- **Capa huerfana**: una capa apunta a una foto que el admin borro, o a un grupo que dejo de existir
  tras "Re-analizar". La capa **no se borra en silencio**: se marca como invalida, se avisa y el
  resto del mockup sigue siendo editable y guardable.
- **Borrar una foto en uso**: al borrarla, se avisa de cuantas capas la usan y se ofrece quitarla de
  las capas o cancelar.
- **Mockup sin capas**: se puede crear y guardar (vacio), y el editor ofrece un estado vacio con la
  accion de "anadir foto" a la vista; la galeria no muestra miniaturas en negro.
- **Geometria fuera de rango** (coordenadas negativas, tamano mayor que el lienzo, rotacion fuera de
  los limites): al abrir el mockup se normaliza al maximo admisible y se informa en una linea, sin
  bloquear la edicion.
- **Grupo con array** (mismo grupo repetido N veces en la capa, p. ej. `id#2`): la capa puede apuntar a
  una instancia que todavia no existe; el editor lo muestra como caja neutra y avisa.
- **Grupo sin ninguna instancia valida** tras re-analizar: la capa queda marcada y el mockup sigue
  guardandose (el cliente nunca ve una imagen rota).
- **Zoom + muchos objetos**: con 20+ capas, el arrastre sigue respondiendo sin saltos perceptibles.
- **Filtro fuera de rango** grabado por un editor anterior: se conserva el valor y se muestra el
  control en su valor real, sin pisarlo por el limite.
- **Navegador con alta densidad de pixeles**: el lienzo se ve nitido y la composicion **no** cambia.
- **Cero dialogos de texto**: ningun flujo principal puede exigir escribir un nombre de archivo o un
  identificador de grupo a mano.
- **Cambio de mockup con seleccion activa**: la seleccion y las propiedades se refrescan al cambiar
  de mockup en la galeria, sin quedar apuntando a una capa de otro.


## Requirements *(mandatory)*

### Interface and workspace

- **FR-001**: El editor de mockups DEBE presentarse en la seccion "Mockups" del PDF, en **dos
  columnas** (lienzo de trabajo a la izquierda; recursos, lista de capas y propiedades a la
  derecha), dentro del ancho actual de la consola, sin abrir ventanas superpuestas ni navegar a
  otra pagina.
- **FR-002**: El editor DEBE tener **estilo propio y completo** (paneles identificados, lienzo con
  fondo de transparencia, foco visible, jerarquia visual, estados de hover y de arrastre activos).
  No puede seguir presentandose como texto plano ni como una tabla de campos sueltos.
- **FR-003**: El **lienzo de trabajo DEBE ser ampliable** (100/150/200/300 %) e **independiente de la
  salida**: la composicion exportada sigue siendo **300x300 px fijos**. El zoom no altera la
  geometria guardada.
- **FR-004**: El lienzo DEBE dibujarse con **nitidez en pantallas de alta densidad de pixeles**, de
  modo que el texto y los bordes de las capas se vean definidos, y el resultado compuesto debe ser
  identico con cualquier nivel de zoom.
- **FR-005**: El ancho reducido DEBE **degradar** a una sola columna sin romper la operacion, pero
  el diseno objetivo es **PC de escritorio con raton y teclado**.

### Direct manipulation

- **FR-006**: El sistema DEBE permitir **seleccionar una capa con un clic** sobre el lienzo, y
  seleccionarla tambien desde la lista de capas (una unica fuente de seleccion).
- **FR-007**: El sistema DEBE permitir **mover una capa arrastrándola** con el raton, en ambos ejes,
  con el movimiento siguiendo al puntero de forma continua (sin escalones ni desvios por el zoom).
- **FR-008**: El sistema DEBE permitir **redimensionar una capa desde tiradores** (esquinas y lados)
  con tiradores de rotacion, y **DEBE** mantener la proporcion cuando se pulse la tecla de
  modificacion.
- **FR-009**: El sistema DEBE ofrecer **imanes de alineacion** a centro horizontal, centro vertical y
  bordes del lienzo, con **guias visuales** durante el arrastre, y un **ajuste a la proporcion
  natural** de la imagen y a la proporcion del hueco.
- **FR-010**: Durante la manipulacion, el sistema DEBE mostrar en la seleccion la **medida en
  pixeles** y el **nombre de la capa**, y DEBE **acotar** cualquier posicion o tamano fuera del area
  de trabajo en vez de perder la capa.
- **FR-011**: Los **campos numericos DEBEN seguir existiendo** como medio de precision y
  accesibilidad, y DEBEN estar **sincronizados en ambos sentidos** con la manipulacion visual
  (arrastrar actualiza el numero; editar el numero actualiza el lienzo).

### Resources (photos and placeholders)

- **FR-012**: El sistema DEBE ofrecer las fotos de referencia como **galeria con miniaturas** y
  DEBE **eliminarse los dialogos de texto** del flujo de agregar foto.
- **FR-013**: El sistema DEBE aceptar **arrastrar un archivo de imagen desde el escritorio** sobre el
  area de trabajo: la sube al ambito del PDF y **la anade como capa** que cubre todo el lienzo, sin
  pedir el nombre.
- **FR-014**: El sistema DEBE permitir anadir como capa las **imagenes del catalogo del proyecto**,
  con busqueda y categorias, sin salir de la seccion.
- **FR-015**: El sistema DEBE permitir insertar un **hueco del PDF con un clic** desde una lista que
  muestre identificador, **tamano real** y **numero de instancias**, colocandolo encuadrado a
  escala y seleccionado, y DEBE admitir **repetir el mismo grupo** varias veces (una capa por
  instancia).
- **FR-016**: El sistema DEBE **avisar antes de borrar una foto en uso** indicando cuantas capas la
  referencian, y DEBE ofrecer quitarla de esas capas o cancelar la operacion.


### Real preview in the canvas (D2, single render source)

- **FR-017**: El lienzo DEBE mostrar, en las capas de tipo hueco, **el render real del grupo**
  (texto con su estilo, al tamano del hueco) **cuando exista el preview generado por la accion
  "Probar"** del grupo. **NO DEBE** implementarse un motor de render nuevo ni una accion de
  renderizado propia del editor.
- **FR-018**: Cada pulsacion de "Probar", y cada cambio que invalide ese preview (tipo, estilo,
  codigo, campo), DEBE **repintar automaticamente** las capas afectadas del mockup abierto, sin
  guardar, sin recargar y sin pedir confirmacion.
- **FR-019**: Cuando el grupo **no tenga render** (sin estilo, o tipo imagen), la capa DEBE
  mostrarse como **caja neutra de encuadre** y el editor DEBE seguir siendo plenamente utilizable.
- **FR-020**: Un **fallo de render** (estilo inexistente, fuente no disponible, error de red) DEBE
  informar al admin y **degradar la capa a caja neutra**, sin perder el mockup ni bloquear la
  edicion.
- **FR-021**: El preview de cada grupo DEBE tener **una unica fuente y un unico cache** por grupo y
  tamano, de modo que abrir el editor **no genere renders adicionales** de lo ya renderizado.
- **FR-022**: El editor DEBE ofrecer un **interruptor "ver con texto / ver encuadre"** para pasar de
  la composicion real a la caja de encuadre sin perder la geometria.

### Parity with what the client sees (D4)

- **FR-023**: El hueco DEBE dibujarse **siempre encajado, sin deformar** (nunca estirado para
  llenar la caja), tanto en el editor como en la vista de cliente.
- **FR-024**: Cuando la **proporcion de la capa difiere de la proporcion del hueco**, el sistema
  DEBE **encajar la imagen dentro de la caja** y **avisar en el editor** de la discrepancia.
- **FR-025**: Los **ajustes visuales por capa DEBEN aplicarse igual** en el editor y en la vista de
  cliente: el conjunto de valores admitidos DEBE ser **el mismo** en el guardado, en el render del
  editor y en el render de la ficha.

### Layers and adjustments

- **FR-026**: La lista de capas DEBE ofrecer, por capa: **seleccionar, renombrar, duplicar, ocultar,
  bloquear y eliminar** (con confirmacion), y **reordenar** (arrastrando y con atajos).
- **FR-027**: El sistema DEBE ofrecer **alinear** una capa a las seis posiciones (izquierda, centro
  horizontal, derecha, arriba, centro vertical, abajo) y **distribuir** las capas seleccionadas,
  sin mover las capas no seleccionadas.
- **FR-028**: Las propiedades por capa DEBEN incluir geometria (posicion, tamano, rotacion, sesgo) y
  **ajustes visuales como controles deslizantes con vista en vivo**: brillo, contraste, saturacion,
  **gama**, opacidad, desenfoque, tono y modo de fusion (incluido "multiplicar"), mas un
  **restablecer a neutro** por capa.
- **FR-029**: El conjunto de ajustes admitidos DEBE incluir explicitamente **`gama`**, hoy aceptado
  por el guardado pero **no aplicado** al componer; y los ajustes **nunca deben aplicarse al PDF ni
  al archivo de imagen del grupo**: afectan solo al mockup.

### Mockup gallery (single source of truth)

- **FR-030**: Los mockups del PDF DEBEN listarse como **galeria de miniaturas** renderizadas en
  vivo, en lugar de un desplegable de texto, y DEBEN ser navegables (seleccionar, crear,
  duplicar, renombrar, eliminar y reordenar).
- **FR-031**: El **listado duplicado** que hoy imprime la pagina junto al editor DEBE
  **eliminarse**: el estado de los mockups DEBE tener **una sola fuente de verdad** y reflejarse al
  instante tras cualquier cambio, sin recarga de pagina.
- **FR-032**: El estado de guardado DEBE ser **visible** ("Sin guardar" / "Guardando" / "Guardado")
  y DEBE reflejar el resultado real del guardado.


### Persistence and no data loss

- **FR-033**: Los cambios del editor DEBE **autoguardarse** con retardo tras la ultima modificacion,
  y el guardado DEBE seguir usando la accion propia del editor, que **solo escribe los mockups y la
  vista previa omisible**, nunca el resto de la configuracion del PDF.
- **FR-034**: El editor DEBE **advertir antes de abandonar el contexto** (cambiar de PDF o de
  pestana) con cambios pendientes, ofreciendo **confirmar o cancelar**.
- **FR-035**: El editor DEBE ofrecer **deshacer y rehacer** con historial acotado de la sesion de
  edicion, y un **atajo de guardado inmediato**.
- **FR-036**: Un **fallo de guardado** DEBE devolver el estado a "Sin guardar", mostrar un error
  accionable y **conservar el contenido del lienzo**.
- **FR-037**: La marca de **"vista previa omisible"** DEBE tener **una sola fuente de verdad** en el
  editor: su valor vigente se toma del estado actual del editor al guardar (no de una copia
  congelada al cargar la pagina), y el editor **no debe** dejar la marca en un valor distinto del
  que el admin ve. La regla vigente se conserva: sin mockups, la marca queda en `false` y el control
  permanece deshabilitado.

### Errors, integrity and accessibility

- **FR-038**: Una **capa invalida** (foto borrada, grupo inexistente, instancia inexistente) DEBE
  quedar **marcada visualmente y con aviso**, nunca dibujarse en silencio ni borrarse sola; el resto
  del mockup DEBE seguir siendo editable y guardable.
- **FR-039**: Al abrir un mockup, la **geometria fuera de rango** DEBE **normalizarse al maximo
  admisible e informarse** en una linea, sin bloquear la edicion.
- **FR-040**: El editor DEBE ser **operable solo con teclado** para todas sus acciones (seleccion,
  movimiento, redimensionado numerico, orden, guardado) y DEBE exponer **etiquetas visibles o texto
  alternativo** en todos los controles (nada de botones con glifos sin nombre).
- **FR-041**: El editor DEBE definir **atajos de teclado** para las acciones principales: mover
  (flechas, con paso fino y paso grueso), eliminar, duplicar, guardar, subir/bajar capa y
  seleccionar/deseleccionar.
- **FR-042**: El editor **NO DEBE** exigir escribir a mano nombres de archivo ni identificadores de
  grupo en ningun flujo principal, y **NO DEBE** alterar los datos geometricos del PDF
  (`analisis.json`).

### Verification and consistency

- **FR-043**: La verificacion automatica DEBE cubrir el contrato de datos ampliado: los campos y
  ajustes nuevos por capa **DEBEN persistirse y releerse** con sus valores por defecto (identicos al
  comportamiento actual cuando no se especifican), y las fases existentes de mockups DEBEN seguir en
  verde.
- **FR-044**: La verificacion en el sitio real (pestana Test) DEBE seguir detectando el editor, su
  render y la composicion de un mockup, y la documentacion vigente (`AGENTS.md`, `readme.txt`,
  `specs/INDICE.md`) DEBE quedar coherente con el rediseno.
- **FR-045**: El rediseno **NO DEBE** introducir un segundo camino de escritura de datos del usuario
  ni construir rutas fuera del dueno unico de datos; todo recurso anadido por el admin DEBE vivir
  en los ambitos vigentes.

### Key Entities

- **Mockup**: vista aprobada por el cliente. Atributos: identificador, titulo, orden y lista de
  capas. Persiste en la configuracion editable del PDF.
- **Capa**: elemento de la composicion. Atributos: tipo (foto o hueco), referencia (foto del PDF o
  grupo del PDF con indice de instancia), geometria (posicion, tamano, rotacion, sesgo) y ajustes
  visuales (brillo, contraste, saturacion, gama, opacidad, desenfoque, tono, modo de fusion).
  Afecta **solo** al mockup.
- **Foto de referencia**: imagen subida por el admin al ambito de datos del PDF; sirve de capa
  "foto". Las imagenes del catalogo del proyecto son fuente alternativa equivalente.
- **Grupo del PDF**: hueco detectado (identificador de color, tamano real, paginas, numero de
  instancias). Su geometria es **inmutable** y no se edita desde el editor.
- **Preview del grupo**: render del texto con su estilo al tamano del hueco, producido por la accion
  "Probar" y **compartido** entre su panel y el editor de mockups.
- **Vista de cliente**: composicion 300x300 que la ficha muestra al comprador (y el PNG congelado
  que se guarda con el pedido). Debe coincidir con lo que compone el editor.


## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador **coloca y alinea un mockup completo (una foto y dos huecos) usando
  solo el raton**, sin escribir un solo numero, en **<= 3 minutos** desde cero.
- **SC-002**: En una sesion de trabajo tipica, **>= 90 % de los ajustes** de posicion y tamano se
  hacen por manipulacion directa; el uso de los campos numericos queda como precision puntual.
- **SC-003**: La composicion que muestra el editor y la imagen 300x300 que recibe el cliente
  **coinciden** en posicion, tamano, orden y ajustes (comparacion lado a lado sin diferencias
  visibles).
- **SC-004**: Con un grupo con estilo, pulsar "Probar" **repinta las capas de ese grupo en <= 2 s** y
  no genera un render adicional por apertura del editor.
- **SC-005**: Con **20 o mas capas**, la manipulacion directa sigue respondiendo **sin saltos
  perceptibles** (la respuesta del lienzo no bloquea la interfaz).
- **SC-006**: **0 dialogos de entrada de texto** en los flujos de agregar foto y agregar hueco, y
  **0 capas invalidas sin marca ni aviso** (verificable borrando una foto en uso y re-analizando un
  PDF).
- **SC-007**: Tras un cambio y la espera de la pausa de autoguardado, una recarga de pagina
  **conserva el trabajo**; y una caida de red devuelve el estado a "Sin guardar" **sin perdida de
  contenido**.
- **SC-008**: El editor es **100 % operable con teclado**: todas sus acciones se completan sin raton,
  y ningun control queda sin nombre legible.
- **SC-009**: La marca de "vista previa omisible" **nunca queda desincronizada** respecto de lo que
  el admin ve: tras alternarla y guardar, el valor guardado coincide con el mostrado.
- **SC-010**: Las puertas automaticas del proyecto pasan en verde: `php -l`, `motor_smoke`,
  `parity`, todas las fases de `texto_puente.php` (incluidas las de mockups, con el contrato
  ampliado) y `smoke_checks()` en el sitio real.
- **SC-011**: Los mockups **existentes** (creados antes del rediseno) se abren, se ven y se guardan
  **sin cambios de resultado**, y las nuevas propiedades de capa aparecen con valores neutros que
  no alteran la composicion.
- **SC-012**: Con dos pestanas del admin sobre el mismo PDF, el ultimo guardado que llega **no
  corrompe** el archivo: la configuracion del PDF sigue siendo legible y el editor informa el
  conflicto en lugar de fallar en silencio.

## Assumptions

- **PC de escritorio como objetivo**: raton y teclado disponibles; el diseno no se optimiza para
  tactil. En pantallas estrechas el editor degrada a una columna (FR-005).
- **El editor se queda embebido** en la seccion "Mockups" (D1). No se crea pestana nueva ni overlay a
  pantalla completa; el espacio extra se gana con zoom y lienzo de trabajo (D3).
- **El render del texto ya existe y es reutilizable** (D2): el boton "Probar" de cada grupo produce
  hoy un render al tamano exacto del hueco con el motor ya cargado en la consola. Esta spec **no**
  crea un motor de render nuevo; reutiliza ese resultado y su cache.
- **El hueco se dibuja encajado, sin deformar** (D4), alineado con la regla tecnica vigente del
  sistema (nunca deformar ni recortar). El cambio afecta a editor y ficha **a la vez**, porque hoy
  ambos estiran.
- **Los datos se amplian, no se redefinen**: las nuevas propiedades de capa son **opcionales** y
  ausentes equivalen al comportamiento actual; los mockups existentes siguen siendo validos. El
  guardado y el render del cliente deben admitir **el mismo conjunto** de ajustes (FR-025), incluida
  la aplicacion de `gama`, hoy guardada pero no aplicada.
- **El catalogo de imagenes del proyecto es fuente valida** de fotos para el mockup, tal como ya
  permite la norma vigente; su lectura debe respetar el mecanismo certificado de miniaturas cuando
  exista (spec 009), sin escribir catalogos desde el editor.
- **Sin limites de cantidad**: mockups, capas y fotos por PDF siguen sin tope.
- **El motor PDF no se toca**: el rediseno es de interfaz; la geometria del PDF sigue siendo
  inmutable y los ajustes visuales solo afectan a la vista previa.
- **Fuera de alcance (D6)**: mascaras y recorte por capa, plantillas de mockup reutilizables entre
  PDFs, auto-encuadre inteligente, historial de versiones persistente del mockup y optimizacion de
  rendimiento del lienzo; tambien cualquier cambio en la ficha del cliente mas alla de la paridad de
  composicion exigida en FR-023 a FR-025.

