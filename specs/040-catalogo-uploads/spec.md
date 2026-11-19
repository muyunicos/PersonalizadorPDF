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
3. **Given** un cliente con pedidos, **When** abre el recorte, **Then** ve sus originales de la sesion
   actual y los de su carpeta de pedidos, sin duplicados.

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

### User Story 4 - Baja consistente (Priority: P2)

Al borrar una imagen, desaparecen el original, su miniatura y su entrada en el catalogo.

**Why this priority**: evita catalogos fantasma que reaparezcan tras un borrado y mantiene la tira
fiel a lo que el comprador tiene.

**Independent Test**: borrar una foto desde el visor; el listado siguiente no la muestra y no queda
ningun archivo huerfano.

**Acceptance Scenarios**:

1. **Given** una imagen referenciada solo por ese item, **When** se borra, **Then** se eliminan
   original, miniatura y entrada del catalogo.
2. **Given** una imagen que otro item de la sesion sigue usando, **When** se borra de un item,
   **Then** la imagen sigue visible y su catalogo intacto.

---

### Edge Cases

- La carpeta no tiene catalogo (instalacion previa o borrado manual): se reconstruye una vez desde los
  archivos y las recetas disponibles y la biblioteca nunca queda vacia por eso.
- El catalogo esta corrupto o ilegible: mismo camino de reconstruccion, sin romper la apertura.
- Falta la miniatura de una imagen: se genera al pedirla.
- La misma imagen existe en la carpeta de pedidos y en la de la sesion: se muestra **una** vez.
- Un item roto o un archivo ausente: se omite esa imagen, el resto se lista.
- Una receta guardada con un tamano que ya no existe: se ignora.
- Un invitado que despues inicia sesion: sus originales de la sesion invitada no se listan (limitacion
  aceptada; su compra si se conserva).
## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El listado de la biblioteca MUST construirse desde las carpetas de originales del
  comprador: la de su sesion actual y, si tiene cuenta, la de sus pedidos.
- **FR-002**: El listado MUST NOT leer manifiestos de items ni consultar pedidos ajenos; su costo MUST
  depender solo de las imagenes del comprador.
- **FR-003**: Para un invitado MUST listarse unicamente la carpeta de su sesion actual.
- **FR-004**: Cada ambito de originales MUST mantener un catalogo con, por imagen: identificador,
  formato, peso, medidas, fecha de alta y sus recetas por contexto (forma + tamano + phsize).
- **FR-005**: El catalogo MUST actualizarse al subir, al declarar una receta y al borrar.
- **FR-006**: Si el catalogo falta o esta corrupto, el sistema MUST reconstruirlo una sola vez sin
  bloquear la biblioteca.
- **FR-007**: Cada imagen MUST tener una miniatura cuadrada recortada al centro (80x80) generada al
  subir; si falta, MUST generarse al pedirla y conservarse.
- **FR-008**: La lectura de una imagen o de su miniatura por identificador MUST resolver la ubicacion
  sin recorrer manifiestos ni pedidos.
- **FR-009**: Al elegir una imagen existente, el sistema MUST recuperar la receta del contexto actual
  si existe; en caso contrario MUST usar el encuadre por defecto.
- **FR-010**: Imagen, miniatura y catalogo MUST respetar la misma politica de acceso que hoy: solo su
  dueno las obtiene, y nunca por una ruta que el cliente proponga.
- **FR-011**: Catalogo y miniatura MUST acompanar al original cuando este se mueve a la carpeta del
  pedido, y MUST borrarse con el.
- **FR-012**: La poda por vencimiento MUST dejar el ambito sin originales, miniaturas ni entradas de
  catalogo huerfanas.
- **FR-013**: El catalogo MUST NOT exponerse como archivo publico; su lectura MUST pasar por la misma
  via protegida que las imagenes.

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

- Un invitado tiene una sola sesion; un cliente se lista con su sesion actual mas su carpeta de
  pedidos. Los enlaces a sesiones anteriores no se listan (limitacion aceptada y reversible).
- Las miniaturas son cuadradas, recorte al centro, 80x80.
- El catalogo vive dentro del ambito de originales y es dato derivado: se puede reconstruir.
- La politica de acceso y el endpoint protegido actuales se mantienen; no se publican rutas crudas.
- El borrado de una imagen sigue la regla actual: si otro item de la sesion la usa, el archivo y su
  catalogo se conservan.