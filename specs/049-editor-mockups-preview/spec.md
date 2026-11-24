# Feature Specification: Editor de Mockups — vista previa integrada y ayuda contextual

**Feature Branch**: `049-editor-mockups-preview`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Mejoras en el Editor de mockups del admin: (1) el editor pasa a ser su propio acordeón 'Editor de mockups' con la descripción movida a un icono de ayuda '?' a la derecha de la cabecera; (2) el recuadro de vista previa del acordeón Placeholders se vuelve una superficie real que simula la interacción del comprador (motor de carga de imágenes real adaptado al campo del grupo, flechas para alternar entre instancias, y previsualización de resultados de texto y futuros tipos); (3) el interruptor 'Ver texto real' del editor se renombra a 'Alternar PH' y pasa a reflejar el contenido de la vista previa del grupo correspondiente."

## Clarifications

### Session 2026-11-24

- Q: Con flechas ‹ › en un grupo multi-instancia, ¿contenido distinto por instancia o el mismo? → A: Las flechas navegan **las imágenes de prueba cargadas** (la cantidad la define el campo; una sola para texto), NO las instancias del PDF. Cada imagen cargada tiene su propio recorte.
- Q: El recorte/encuadre del admin, ¿alimenta el Procesar real o es solo preview? → A: Alimenta el "Procesar PDF" de PRUEBA del admin (salida de muestra) para verificar; NO llega al cliente (las imágenes/textos de prueba no se entregan al comprador).
- Q: ¿Qué muestra `.ec-preview` por defecto y qué pasa con `.ec-texto-preview-caja`? → A: Muestra el **placeholder transparente** por defecto (no la imagen persistida del grupo); `.ec-texto-preview-caja` se elimina: el texto se previsualiza en el mismo `.ec-preview`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor como acordeón propio con ayuda contextual (Priority: P1)

El administrador abre la consola de un PDF y ve el editor de mockups como un acordeón propio llamado "Editor de mockups", sin texto largo ocupando el cuerpo. La explicación de qué es un mockup y cómo usarlo queda disponible en un icono de ayuda "?" a la derecha de la cabecera, que al enfocarse o pasar el cursor muestra el texto completo.

**Why this priority**: Es el cambio de menor riesgo y ordena la interfaz; sin él, el editor sigue enterrado bajo un acordeón genérico "Mockups" con descripciones que estorban. Entrega valor de claridad de inmediato.

**Independent Test**: Se puede probar abriendo la pestaña de PDFs: el acordeón se llama "Editor de mockups", el cuerpo ya no muestra los párrafos de descripción, y el icono "?" muestra la ayuda al pasar el cursor o enfocarlo con teclado, sin plegar ni desplegar el acordeón.

**Acceptance Scenarios**:

1. **Given** un PDF con grupos analizados, **When** el admin mira la consola, **Then** el editor aparece bajo un acordeón titulado "Editor de mockups".
2. **Given** el acordeón "Editor de mockups", **When** el admin pasa el cursor o enfoca con teclado el icono "?", **Then** se muestra el texto de ayuda y el acordeón NO cambia de estado.
3. **Given** el editor, **When** se abre, **Then** no hay título interno duplicado (un solo rótulo "Editor de mockups").

---

### User Story 2 - Vista previa del placeholder que simula al comprador (Priority: P2)

El administrador ve en el acordeón Placeholders un recuadro de vista previa que **por defecto muestra el placeholder transparente** (no la imagen persistida del grupo). Al cargar imágenes de prueba con el **motor de carga del comprador** (CargadorPMU + SelectorPMU, recorte y encuadre reales, adaptado al campo y tamaño del grupo), el recuadro muestra el resultado real. Las **flechas ‹ › a los lados** alternan entre las **imágenes de prueba cargadas** (la cantidad la define el campo; una sola para texto). El recuadro previsualiza imagen, texto (render) o un tipo futuro, con punto de extensión. `.ec-texto-preview-caja` se elimina: el texto se ve en el mismo recuadro.

**Why this priority**: Es el corazón de la petición: acerca al máximo la consola a lo que verá el comprador, reduce errores de configuración y unifica la previsualización. Depende de que exista el editor (US1) para tener sentido completo, pero aporta valor por sí mismo en el acordeón Placeholders.

**Independent Test**: Con un grupo de tipo imagen y un campo asociado, al cargar una foto el recuadro muestra el recorte real; con un grupo de varias instancias, las flechas rotan la vista; con un grupo de texto ya "Probado", el recuadro muestra el render de texto.

**Acceptance Scenarios**:

1. **Given** un grupo con campo de imagen, **When** el admin carga una imagen en la vista previa, **Then** ve el recorte/encuadre real (no solo la imagen cruda) adaptado al tamaño del grupo.
2. **Given** un grupo con más de una imagen de prueba cargada, **When** el admin pulsa las flechas ‹ › de los lados, **Then** la vista previa alterna entre esas imágenes (cada una con su recorte) y la activa alimenta el mockup; con una sola imagen (p. ej. texto) no hay flechas.
3. **Given** un grupo de texto con render generado, **When** el admin mira la vista previa, **Then** ve el texto renderizado (mismo resultado que el mockup), no un marco vacío.
4. **Given** un tipo de placeholder no contemplado hoy, **When** el admin lo selecciona, **Then** la vista previa cae a un comportamiento genérico sin romper la consola.

---

### User Story 3 - Interruptor "Alternar PH" espejado con la vista previa (Priority: P3)

En el editor de mockups, el interruptor antes llamado "Ver texto real" se llama "Alternar PH" y controla si cada capa placeholder se dibuja con el contenido real de la vista previa del grupo (imagen/recorte/render) o como caja neutra de encuadre. El contenido mostrado es el mismo que el del recuadro de vista previa del grupo correspondiente.

**Why this priority**: Cierra el círculo entre la vista previa (US2) y el mockup, con un rótulo más claro. Es un refinamiento que depende de US2 para ser útil.

**Independent Test**: Con un grupo con render/imagen listo, "Alternar PH" activo dibuja el contenido real en la capa; desactivado dibuja la caja neutra; el contenido coincide con el recuadro de vista previa del grupo.

**Acceptance Scenarios**:

1. **Given** una capa placeholder de un grupo con contenido listo, **When** "Alternar PH" está activo, **Then** la capa muestra ese mismo contenido.
2. **Given** la misma capa, **When** "Alternar PH" se desactiva, **Then** la capa se dibuja como caja neutra de encuadre.
3. **Given** un cambio de contenido en la vista previa del grupo, **When** el admin edita el mockup, **Then** la capa placeholder se repinta con el contenido actualizado.

---

### Edge Cases

- ¿Qué muestra el recuadro sin una imagen de prueba cargada? El **placeholder transparente** (nunca la imagen persistida del grupo).
- ¿Qué pasa con un grupo sin campo asociado? Si es de imagen, el motor monta con una ranura por defecto del tamaño del grupo; si es de texto, no monta motor y cae al render/clásico.
- ¿Qué pasa si el grupo declara tipo imagen pero el campo asociado es de otro tipo? Se muestra un aviso de desajuste y la vista previa no bloquea la edición.
- ¿Qué pasa con un grupo de una sola imagen de prueba (p. ej. texto)? No se muestran flechas ‹ ›.
- ¿Dónde se ve el texto? En el mismo `.ec-preview` (`.ec-texto-preview-caja` fue eliminado).
- ¿Qué pasa si falla el render de texto o el recorte? La vista previa muestra la causa exacta y la consola sigue operativa (nunca pantalla en blanco).
- ¿Qué pasa con grupos de tipos mezclados? Cada recuadro resuelve su propio tipo; un fallo en uno no afecta a los demás.
- ¿Qué pasa con la "biblioteca del comprador" (Mis imágenes) en el admin? No está disponible en el contexto de administración; el motor de carga del admin cubre recorte, encuadre y receta sin biblioteca (sub-fase fuera de alcance).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El editor de mockups DEBE presentarse como un acordeón propio titulado "Editor de mockups".
- **FR-002**: La descripción de uso del mockup DEBE mostrarse desde un icono de ayuda "?" ubicado a la derecha de la cabecera del acordeón, accesible por teclado y cursor, sin alterar el estado del acordeón.
- **FR-003**: El editor NO DEBE mostrar un título interno duplicado del acordeón que lo contiene.
- **FR-004**: El recuadro de vista previa de cada grupo del acordeón Placeholders DEBE mostrar por defecto el **placeholder transparente** y previsualizar el resultado real (imagen de prueba, texto u otro tipo) cuando haya contenido, no solo la imagen subida o un marco vacío.
- **FR-005**: Para grupos de tipo imagen con campo asociado, la vista previa DEBE usar el mismo motor de carga/recorte que el comprador, adaptado al tamaño del grupo y a la guía de recorte deducida del cableado del hueco.
- **FR-006**: Cuando un grupo tiene MÁS de una imagen de prueba cargada, la vista previa DEBE ofrecer flechas ‹ › **a los lados** del recuadro (patrón del motor de visor) para alternar entre **las imágenes cargadas** (la cantidad la define el campo; con texto hay una sola y no se muestran flechas). La imagen activa DEBE ser la que alimenta el mockup. NO navega las instancias del PDF.
- **FR-007**: La vista previa DEBE resolver su contenido por tipo, con un punto de extensión que ante un tipo no contemplado caiga a un comportamiento genérico sin romper la consola.
- **FR-008**: Ante un grupo de tipo imagen (con o sin campo asociado), la vista previa DEBE montar el motor con una ranura por defecto del tamaño del grupo; ante un grupo de texto NO DEBE montar motor (cae al render de texto o al comportamiento clásico).
- **FR-009**: El interruptor del editor DEBE llamarse "Alternar PH" y controlar si las capas placeholder se dibujan con el contenido real de la vista previa del grupo o como caja neutra.
- **FR-010**: El contenido que muestra la capa placeholder en el mockup DEBE coincidir con el de la vista previa del grupo correspondiente y repintarse cuando ese contenido cambie.
- **FR-011**: Ante un fallo de render o recorte, la vista previa DEBE mostrar la causa exacta y la consola DEBE seguir operativa.
- **FR-012**: Los cambios NO DEBEN alterar los datos del comprador ni el módulo TextMuy; el comportamiento clásico existente DEBE preservarse cuando no aplique una mejora. El motor PHP PUEDE extenderse para aceptar receta/recorte por instancia.
- **FR-013**: El recorte y la receta de cada instancia configurados en el admin DEBEN alimentar el botón "Procesar PDF" de PRUEBA (la salida de muestra que el admin revisa), de modo que la muestra refleje el contenido por instancia. Esta salida es SOLO para prueba: NO se entrega al comprador ni altera el flujo de compra/entrega del cliente.

### Key Entities *(include if feature involves data)*

- **Grupo de placeholder**: unidad con color, tamaño base, cantidad de instancias, tipo de salida (imagen/texto/futuro), campo asociado y guía de recorte deducida; cada instancia puede tener su propio contenido.
- **Vista previa del grupo**: representación visual del resultado real del grupo para una instancia activa (recorte, render de texto u otro), compartida como fuente única con el mockup; el contenido puede variar por instancia.
- **Capa placeholder del mockup**: capa del lienzo que referencia un grupo e instancia; su contenido visual depende del interruptor "Alternar PH".
- **Ayuda contextual**: texto de explicación del mockup expuesto desde el icono "?" de la cabecera.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los grupos de un PDF muestran su resultado real (imagen, texto o tipo soportado) en la vista previa, sin recuadro vacío cuando hay contenido disponible.
- **SC-002**: El admin alterna entre instancias de un grupo multi-instancia en un clic por flecha, sin recargar la página.
- **SC-003**: El contenido de la capa placeholder del mockup coincide con la vista previa del grupo en el 100% de los casos verificados.
- **SC-004**: Ningún fallo de render/recorte deja la consola en blanco: el 100% de los errores muestra causa accionable y permite seguir editando.
- **SC-005**: La ayuda del mockup es accesible por teclado y no dispara el plegado del acordeón en el 100% de los intentos.
- **SC-006**: El comportamiento clásico se preserva en grupos sin campo de imagen (0 regresiones en el flujo previo).

## Assumptions

- El "usuario" es el administrador de WordPress que configura el PDF en la consola; no hay flujo de comprador en esta feature.
- El motor de carga del admin reutiliza la infraestructura de subida/recorte ya existente; para grupos multi-instancia puede requerir un endpoint de subida y persistencia de receta por instancia (enmiende el supuesto previo de "solo memoria").
- La "biblioteca del comprador" (Mis imágenes) queda fuera de alcance en el admin por no existir sesión de comprador; se cubre recorte, encuadre y receta.
- La guía de recorte se deduce del cableado del hueco ya existente; no se agrega configuración manual nueva.
- El motor PHP puede extenderse para consumir receta/recorte por instancia SOLO en la salida de muestra del admin; no se alteran los datos del comprador ni `modules/textmuy/`.
- Las imágenes y textos que el admin carga para probar en la consola NO se entregan al comprador: el entregable del cliente es un flujo independiente (el comprador sube sus propios originales).
- Los tests que indexan cadenas del editor se actualizan a la intención (precedente de specs previas), sin bajar cobertura.