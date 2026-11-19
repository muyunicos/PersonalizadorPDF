# Feature Specification: Catalogo de uploads y biblioteca por carpetas

**Feature Branch**: `040-catalogo-uploads`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "La biblioteca de imagenes del comprador deja de depender de los manifiestos y del historial de pedidos: se lista desde las carpetas de originales, con un catalogo `uploads/uploads.json` (ids, recetas por contexto y fecha) y miniaturas `80x80` recortadas al centro. Invitado: solo `tmp/sesion-{sid}/uploads/`. Cliente: `tmp/sesion-{sid}/uploads/` + `orders/{uid}/uploads/`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bibliotecas instantaneas (Priority: P1)

El comprador abre el modal de recorte y ve sus imagenes al instante. El tiempo no depende de cuantos
pedidos tenga el sitio ni de cuantos clientes haya: solo de cuantas fotos son suyas.

**Why this priority**: hoy el listado recorre el arbol completo de pedidos y lee manifiestos; con
historial el modal tarda segundos. Es la queja principal y lo que bloquea la compra.

**Independent Test**: con 10 imagenes propias y 1000 pedidos de otros clientes, abrir la biblioteca
debe mostrar la tira sin degradarse y sin leer pedidos ajenos.

**Acceptance Scenarios**:

1. **Given** un comprador con 10 imagenes propias y el sitio con historial, **When** abre el recorte,
   **Then** ve su tira en menos de 300 ms y el servidor no recorrio pedidos de terceros.
2. **Given** un invitado, **When** abre el recorte, **Then** solo se lista su carpeta de sesion.
3. **Given** un cliente con pedidos, **When** abre el recorte, **Then** ve sus originales en su carpeta
   de la cuenta (una sola), sin duplicados.

---

### User Story 2 - Encuadre recordado sin subir bytes (Priority: P1)

Al elegir una imagen ya usada, el recorte aparece con el encuadre que el comprador ya habia definido
para esa forma y tamano. Si no lo retoca, no se sube nada.

**Why this priority**: es la diferencia entre "reusar" y "volver a subir"; sin esto el comprador paga
la espera cada vez que reutiliza una foto.

**Independent Test**: subir una foto, encuadrarla, aceptar; reabrir el modal, elegir la misma foto y
comprobar que el zoom/posicion/modo vuelven y que la accion no envia bytes.

**Acceptance Scenarios**:

1. **Given** una imagen con receta guardada para este contexto, **When** se elige desde la biblioteca,
   **Then** el recorte aparece con esa receta y el primario ofrece usarla sin cambios.
2. **Given** una imagen con receta de OTRO tamano u otra forma, **When** se elige, **Then** se usa el
   encuadre por defecto (la receta no aplica y no se inventa nada).
3. **Given** que el comprador no retoca nada, **When** acepta, **Then** no se envia ningun byte.

---

### User Story 3 - Miniaturas en la tira (Priority: P2)

La tira muestra miniaturas cuadradas chicas y no las fotos completas.

**Why this priority**: baja el peso de la tira y hace que aparezca de inmediato, sin depender del
tamano de las fotos originales.

**Independent Test**: con fotos de 2000 px, la tira no descarga mas de 20 KB por imagen.

**Acceptance Scenarios**:

1. **Given** una imagen con miniatura generada, **When** se pinta la tira, **Then** se pide la
   miniatura y no el original.
2. **Given** una imagen sin miniatura (historica), **When** se pinta la tira, **Then** la miniatura se
   genera una vez y se conserva.
---

### User Story 4 - Quitar del campo no es borrar (Priority: P2)

Quitar una foto de un campo solo la saca de **ese** campo: la imagen sigue en la galeria del comprador.
Borrar desde la galeria elimina el original, su miniatura y su entrada en el catalogo, y **pide
confirmacion** si esa imagen esta en el carrito o en un pedido.

**Why this priority**: hoy "quitar" y "borrar" se confunden; separarlos evita perder fotos que el
comprador solo queria reemplazar en un campo.

**Independent Test**: quitar una foto de un campo y comprobar que sigue en la galeria; borrarla desde la
galeria y comprobar que desaparece de archivos y catalogo.

**Acceptance Scenarios**:

1. **Given** una imagen usada por un campo, **When** el comprador la quita de ese campo, **Then** la
   imagen sigue en su galeria y solo se elimina esa referencia.
2. **Given** una imagen referenciada por un item en carrito o por un pedido, **When** la borra desde la
   galeria, **Then** se pide confirmacion y, tras aceptarla, se eliminan original, miniatura y catalogo.
3. **Given** una imagen sin carrito ni pedidos (solo un borrador), **When** la borra desde la galeria,
   **Then** se elimina directamente, sin confirmacion.

---

### Edge Cases

- La carpeta no tiene catalogo (instalacion previa o borrado manual): se reconstruye una vez desde los
  archivos y las recetas disponibles y la biblioteca nunca queda vacia por eso.
- El catalogo esta corrupto o ilegible: mismo camino de reconstruccion, sin romper la apertura.
- Falta la miniatura de una imagen: se genera al pedirla.
- La misma imagen existe en la carpeta del cliente y en la de una sesion vieja: se muestra **una** vez
  (gana la del cliente).
- Un item roto o un archivo ausente: se omite esa imagen, el resto se lista.
- Una receta guardada con un tamano que ya no existe: se ignora.
- Un invitado que inicia sesion: sus originales se **migran** a su carpeta de cliente (una sola vez,
  idempotente) y pasan a listarse ahi.
- Una imagen ya usada en un pedido: borrarla desde la galeria se permite **con confirmacion**, y ese
  pedido deja de ser regenerable (aceptado).

## Clarifications

### Session 2026-11-19

- Q: ¿El archivo de catálogo puede quedar alcanzable por URL bajo la carpeta de uploads como los originales, o hay que impedir el acceso directo? → A: Igual que los originales: nunca se publica su URL y el acceso pasa por el endpoint protegido; su exposición física es la misma que la de los originales.
- Q: Si falta el catálogo en una carpeta existente, ¿de dónde salen las recetas para reconstruirlo? → A: Solo desde los archivos (identificador, formato, peso, medidas y fecha). Las recetas NO se recuperan y esas imágenes quedan con el encuadre por defecto.
- Q: Al borrar una imagen desde un ítem, ¿cómo se decide si se eliminan archivo, miniatura y entrada del catálogo? → A: Quitar desde un campo NO elimina la imagen: solo quita esa referencia del campo. El borrado vive en la galería: consulta referencias solo en ítems de CARRITO y en PEDIDOS (los borradores no cuentan); si hay alguna, pide confirmación, y si no, borra directamente (archivos + catálogo).
- Q: ¿Cuántas carpetas tiene cada identidad y cuándo se migra? → A: Una por identidad: invitado `tmp/sesion-{sid}/uploads/`, cliente `orders/{uid}/uploads/`. La sesión anónima se migra en el login (incluye el alta en el checkout); al pagar no se mueven originales. Caducidad por último uso, nunca sobre imágenes con pedido.
- Q: ¿Y al promover el ítem a pedido? → A: no se mueve nada (los originales ya están en la carpeta de la cuenta): solo cambia el manifiesto.
- Q: Si la imagen ya está en un pedido, ¿qué pasa al borrarla desde la galería? → A: Se permite **con confirmación**; se acepta que ese pedido deja de poder regenerarse. Sin pedido, el borrado es directo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El listado de la biblioteca MUST construirse desde la carpeta de originales que
  corresponde a la identidad: la de la sesion (invitado) o la de la cuenta (cliente).
- **FR-002**: El listado MUST NOT leer manifiestos de items ni consultar pedidos ajenos; su costo MUST
  depender solo de las imagenes del comprador.
- **FR-003**: Para un invitado MUST listarse unicamente la carpeta de su sesion actual.
- **FR-004**: Cada ambito de originales MUST mantener un catalogo con, por imagen: identificador,
  formato, peso, medidas, fecha de alta, **ultimo uso** y sus recetas por contexto (forma + tamano +
  phsize).
- **FR-005**: El catalogo MUST actualizarse al subir, al declarar una receta y al borrar.
- **FR-006**: Si el catalogo falta o esta corrupto, el sistema MUST reconstruirlo una sola vez **solo
  desde los archivos** (identificador, formato, peso, medidas y fecha), **sin recuperar recetas** y sin
  bloquear la biblioteca. Esas imagenes quedan con el encuadre por defecto.
- **FR-007**: Cada imagen MUST tener una miniatura cuadrada recortada al centro (80x80) generada al
  subir; si falta, MUST generarse al pedirla y conservarse.
- **FR-008**: La lectura de una imagen o de su miniatura por identificador MUST resolver la ubicacion
  sin recorrer manifiestos ni pedidos.
- **FR-009**: Al elegir una imagen existente, el sistema MUST recuperar la receta del contexto actual
  si existe; en caso contrario MUST usar el encuadre por defecto.
- **FR-010**: Imagen, miniatura y catalogo MUST respetar la misma politica de acceso que hoy: la
  pertenencia se valida por la **cadena de la identidad** (cliente: su carpeta; invitado: su sesion) y
  nunca por una ruta que el cliente proponga.
- **FR-011**: Quitar una imagen de un campo (su ranura) MUST NOT eliminar el original, su miniatura ni
  su entrada de catalogo: solo elimina la referencia de ese campo.
- **FR-012**: Borrar una imagen desde la galeria MUST eliminar el original, su miniatura y su entrada
  de catalogo.
- **FR-013**: El catalogo MUST NOT publicarse ni servirse por una ruta propia: su unica via de lectura
  es la protegida que ya sirven las imagenes y sus miniaturas. Comparte la carpeta fisica de los
  originales y, por lo tanto, su misma exposicion.
- **FR-014**: Antes de borrar desde la galeria, el sistema MUST consultar las referencias en items de
  CARRITO y en PEDIDOS (los borradores NO cuentan). Si hay alguna, MUST pedir confirmacion explicita y
  borrar solo si el comprador acepta.
- **FR-015**: Una imagen sin referencias en carrito ni pedidos MUST borrarse directamente, sin
  confirmacion.
- **FR-016**: Al promover el item a pedido el sistema MUST NOT mover originales, miniaturas ni catalogo:
  ya viven en la carpeta de la cuenta. Lo unico que cambia es el manifiesto del item.
- **FR-017**: La poda MUST usar el **ultimo uso** registrado en el catalogo, MUST NOT eliminar imagenes
  referenciadas por un pedido y MUST dejar el ambito sin originales, miniaturas ni entradas huerfanas.
- **FR-018**: Al iniciar sesion (incluida la creacion de cuenta en el checkout) el sistema MUST migrar
  los originales de la sesion anonima a la carpeta de la cuenta, **una sola vez e idempotente**, junto
  con su catalogo y sus miniaturas.
- **FR-019**: Borrar desde la galeria una imagen referenciada por un pedido MUST pedir confirmacion y,
  tras aceptar, eliminar original, miniatura y catalogo; la interfaz MUST advertir que ese pedido deja
  de poder regenerarse.

### Key Entities

- **Catalogo de uploads**: resumen de un ambito de originales; una entrada por imagen con su fecha y
  sus recetas por contexto. Es dato derivado y reconstruible.
- **Entrada de catalogo**: identificador de la imagen, formato, peso, medidas, fecha y recetas.
- **Receta por contexto**: el encuadre (modo, escala, desplazamiento, rotacion, fondo y geometria) que
  el comprador definio para una forma y tamano concretos, con su fecha.
- **Miniatura**: derivado cuadrado 80x80 recortado al centro, ligado a una entrada de catalogo.
## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Abrir la biblioteca con 10 imagenes propias tarda menos de 300 ms, con independencia de
  cuantos pedidos o clientes tenga el sitio.
- **SC-002**: Cada apertura del modal produce una sola solicitud de listado.
- **SC-003**: Reutilizar una imagen sin cambiar el encuadre envia cero bytes.
- **SC-004**: La tira descarga menos de 20 KB por imagen.
- **SC-005**: Cero imagenes visibles que no existan en disco y cero archivos huerfanos tras un borrado.

## Assumptions

- Un invitado tiene una sola sesion (`tmp/sesion-{sid}/uploads/`); un cliente tiene una sola carpeta
  (`orders/{uid}/uploads/`). La sesion anonima se migra en el login, una vez.
- En esta spec, "galeria" y "biblioteca" nombran la MISMA vista (el modulo es `assets/biblioteca-pmu.js`).
- Las miniaturas son cuadradas, recorte al centro, 80x80.
- El catalogo vive dentro del ambito de originales y es dato derivado: se puede reconstruir.
- La politica de acceso y el endpoint protegido actuales se mantienen; no se publican rutas crudas.
- El catalogo comparte la carpeta fisica de los originales: su exposicion es la misma que la de ellos y
  nunca se publica su URL.
- Reconstruir el catalogo NO recupera recetas: se prioriza no bloquear la apertura de la biblioteca.
- El borrado de una imagen vive en la galeria y **supersede** la 039 D3 (borrado en el acto desde el
  visor del campo): quitar una foto de un campo ya **no** borra el original.