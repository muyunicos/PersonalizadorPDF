# Feature Specification: Lectura rapida de la biblioteca del comprador

**Feature Branch**: `042-biblioteca-lectura-rapida`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "La apertura de la galeria del comprador no debe depender del arranque completo del sitio. Las lecturas (listado, miniaturas y fotos, incluidas las fotos de las ranuras al re-editar el carrito) se sirven por un camino liviano que usa la identidad que el navegador ya tiene. Se acepta menos seguridad en las lecturas (sin volver a validar un token en cada apertura) a cambio de velocidad y menor carga del sistema; las escrituras conservan la autorizacion actual. El camino actual queda como respaldo. Decisiones cerradas: spec nueva 042, incluir las ranuras de la re-edicion y mantener el respaldo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Primera apertura rapida de la galeria (Priority: P1)

Un comprador abre el modal de recorte por primera vez y ve su tira de imagenes en alrededor de un segundo.
La apertura no depende de cuantos pedidos o clientes tenga el sitio: solo de cuantas fotos son suyas.
El sistema no arranca la aplicacion administrativa completa para leer archivos que ya estan guardados.

**Why this priority**: es la queja principal. Hoy cada miniatura y el listado pagan un arranque completo del
sitio; con 8 fotos la primera apertura hace 9 arranques y tarda entre 8 y 15 segundos. Sin este arreglo, la
galeria sigue siendo el cuello de botella de la compra.

**Independent Test**: con 10 fotos propias y un sitio con historial de pedidos, abrir la galeria por primera
vez debe mostrar la tira en menos de 1 segundo (p95) y la traza de red no debe mostrar el arranque de la
aplicacion administrativa del sitio.

**Acceptance Scenarios**:

1. **Given** un comprador con 10 fotos propias y un sitio con historial, **When** abre la galeria por primera vez, **Then** ve la tira en menos de 1 segundo (p95) y la lectura no arranco la aplicacion administrativa del sitio.
2. **Given** un invitado, **When** abre la galeria, **Then** solo se listan las fotos de su sesion.
3. **Given** un cliente con cuenta y pedidos, **When** abre la galeria, **Then** solo se listan los originales de su carpeta de cuenta.
4. **Given** un comprador sin fotos, **When** abre la galeria, **Then** ve un estado vacio claro, sin errores ni solicitudes fallidas en bucle.
5. **Given** que el camino liviano no esta disponible, **When** abre la galeria, **Then** la ve igual por el camino actual, sin intervencion suya.

---

### User Story 2 - Reapertura sin volver a consultar (Priority: P1)

Si el comprador cierra y vuelve a abrir la galeria sin que su biblioteca haya cambiado, la tira aparece al
instante y no se hace ninguna solicitud de red dentro de la ventana de frescura. El sistema recuerda en el navegador la lista, su revision y
la identidad a la que pertenece.

**Why this priority**: es la mayor parte del ahorro percibido y de la carga del sistema. Abrir y cerrar el
modal varias veces es el uso normal del comprador, y hoy cada apertura vuelve a pedir todo.

**Independent Test**: abrir la galeria, cerrarla y reabrirla sin cambios dentro de la ventana de frescura
(5 min): la tira se pinta en menos de 100 ms y la traza de red queda vacia para esa segunda apertura.

**Acceptance Scenarios**:

1. **Given** una copia local con la misma revision y la misma identidad y menos de 5 minutos de antiguedad, **When** el comprador reabre la galeria, **Then** la tira se pinta desde la copia y no se hace ninguna solicitud.
2. **Given** una foto subida o borrada en la misma pestaña, **When** el comprador reabre la galeria, **Then** la lista refleja el cambio y no muestra datos viejos.
3. **Given** un cambio hecho en otra pestaña u otro dispositivo, **When** el comprador reabre la galeria despues de la ventana de frescura, **Then** se revalida una sola vez y se actualiza la copia.
4. **Given** un login o un logout, **When** el comprador abre la galeria, **Then** se descarta la copia de la identidad anterior y se resuelve la nueva identidad.

---

### User Story 3 - Fotos de ranura en la re-edicion (Priority: P2)

Al re-editar un item del carrito, las fotos que el comprador ya habia colocado en las ranuras se cargan por
el mismo camino liviano, sin una solicitud administrativa por imagen.

**Why this priority**: la re-edicion es el segundo punto de espera. Hoy la tira de ranuras vuelve a pagar el
arranque del sitio por cada foto al abrir el carrito para editar.

**Independent Test**: con un item de carrito con 6 fotos en ranuras, entrar a editarlo y medir: todas las
fotos se ven en menos de 1 segundo (p95) y no hay una solicitud administrativa por imagen.

**Acceptance Scenarios**:

1. **Given** un item de carrito con 6 fotos en ranuras, **When** el comprador lo edita, **Then** las 6 fotos se cargan por el camino liviano en menos de 1 segundo (p95).
2. **Given** una foto de ranura que ya no existe, **When** se abre la re-edicion, **Then** se muestra un aviso o un hueco, nunca una pagina rota.
3. **Given** una foto de ranura reemplazada, **When** se vuelve a abrir la re-edicion, **Then** aparece la version nueva.

---

### User Story 4 - Miniaturas listas en la lista (Priority: P2)

La lista de la galeria trae las miniaturas de las fotos visibles ya listas para pintar, de modo que la tira
no necesita una solicitud de imagen por cada miniatura.

**Why this priority**: completa la primera apertura. Sin esto, la lista llega rapido pero las miniaturas
siguen llegando de a una y con su propio costo.

**Independent Test**: con 10 fotos, abrir la galeria y comprobar que la tira se pinta con la lista y que no
hay solicitudes de miniaturas sueltas; cada miniatura embebida pesa 20 KB o menos.

**Acceptance Scenarios**:

1. **Given** una lista con 10 fotos, **When** la tira se pinta, **Then** las miniaturas visibles ya vienen con la lista y no generan solicitudes propias.
2. **Given** una biblioteca con mas de 10 fotos, **When** se abre la galeria, **Then** solo se embeben las 10 visibles y el resto queda accesible desde el visor.
3. **Given** una miniatura que no se puede generar, **When** se pinta la tira, **Then** se usa la foto completa o un lugar reservado, sin romper la lista.

---

### User Story 5 - Escrituras y respaldo intactos (Priority: P3)

Subir, borrar, generar vistas previas y comprar siguen funcionando con la autorizacion actual. Si el camino
liviano se desactiva, falla o no esta configurado, la galeria sigue funcionando por el camino actual y el
comprador no nota la diferencia.

**Why this priority**: protege la operacion y da una salida segura ante cualquier problema del hosting o de
la configuracion.

**Independent Test**: desactivar el camino liviano y repetir el recorrido de ficha, galeria, subida, borrado
y compra: todo funciona igual que antes.

**Acceptance Scenarios**:

1. **Given** una subida o un borrado, **When** el comprador los ejecuta, **Then** se mantienen la autorizacion y el comportamiento actuales.
2. **Given** que el camino liviano falla o esta desactivado, **When** el comprador abre la galeria, **Then** la lista y las imagenes llegan por el camino actual en el mismo orden.
3. **Given** la misma biblioteca, **When** se compara la lista por ambos caminos, **Then** los ids y el orden coinciden.

---

### Edge Cases

- La credencial de lectura del comprador expiro o es invalida: se degrada al camino actual y se reemite.
- La credencial del cliente fue copiada a otro navegador: permite leer las fotos de esa cuenta hasta que expire (trade-off aceptado y documentado).
- Una pagina cacheada se sirve a otro comprador: la identidad del contenido no coincide con la del navegador y se usa el camino actual.
- Un cliente inicio sesion pero todavia no tiene credencial de lectura: se usa el camino actual una vez y se reemite.
- Falta la configuracion o el secreto del camino liviano: el camino liviano se desactiva y todo funciona por el respaldo.
- El hosting no ejecuta el camino liviano o devuelve error: se usa el respaldo sin mostrar errores tecnicos.
- Las reglas de privacidad de directorios no se aplican: el secreto no debe quedar expuesto; el camino liviano se desactiva.
- Falta el catalogo de la biblioteca o esta corrupto: se usa el respaldo, que lo reconstruye una sola vez.
- La foto original fue borrada pero su entrada sigue en la lista: se omite o se muestra el aviso correspondiente.
- Falta la miniatura: se usa la foto completa o un lugar reservado, sin romper la tira.
- La biblioteca tiene mas de 10 fotos: solo se embeben las visibles; el resto se resuelve por el visor.
- La biblioteca tiene 0 fotos: estado vacio, sin solicitudes inutiles.
- Dos pestañas o dos dispositivos con la misma cuenta: cada uno mantiene su copia y revalida al vencer la frescura.
- Red lenta o sin conexion: se pinta la copia local si existe; si no, se muestra el estado de carga actual.
- El admin abre la vista del comprador para probar: ve su propia biblioteca, sin mezclar datos de terceros.
- Una subida termina mientras se esta leyendo la galeria: la proxima apertura refleja el cambio; no se rompe la lectura en curso.
- El comprador navega en modo privado o sin almacenamiento local: la galeria funciona, solo pierde la copia local.
- Logout: se borra la credencial de lectura del cliente; login: se reemite.
- Se rota el secreto de lectura: todas las credenciales de lectura quedan invalidadas y se reemiten por el respaldo.
- No se puede generar una miniatura: se degrada a la foto completa; nunca se rompe la lista.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST listar la biblioteca del comprador al abrir la galeria, con identificador, peso, medidas, fecha, recetas por contexto, referencia a la foto original, miniatura y una revision de la lista.
- **FR-002**: Las lecturas de la galeria MUST resolverse sin arrancar la aplicacion administrativa completa del sitio; la lista y las imagenes MUST servirse por un camino liviano que solo lea los archivos guardados.
- **FR-003**: La identidad de lectura MUST salir de una credencial que el navegador ya tiene: sesion para el invitado y una credencial firmada para el cliente. Las lecturas MUST NOT exigir un token nuevo por apertura.
- **FR-004**: El camino liviano MUST servir solo las fotos de la identidad que pide; MUST NOT servir fotos de otros compradores, entregables de pedidos, manifiestos, ideas del cotizador ni PDFs.
- **FR-005**: La lista MUST incluir una revision; si el navegador ya tiene una copia de la misma identidad con la misma revision, MUST NOT pedir la lista de nuevo.
- **FR-006**: La copia local MUST invalidarse cuando el comprador sube o borra una foto en la misma pestaña y cuando cambia la identidad (login o logout).
- **FR-007**: Ante cualquier fallo del camino liviano (no configurado, error, credencial invalida o identidad que no coincide), el sistema MUST usar el camino actual de forma transparente para el comprador.
- **FR-008**: El camino liviano MUST servir la foto original y la miniatura, incluidas las fotos de las ranuras al re-editar un item del carrito, con URLs estables y cacheables por el navegador durante 7 dias.
- **FR-009**: La lista MUST incluir embebidas hasta 10 miniaturas de las fotos visibles, de 20 KB o menos cada una, para que la tira no haga solicitudes de imagen propias.
- **FR-010**: Las escrituras (subir, borrar, generar vistas previas y comprar) MUST conservar la autorizacion y el comportamiento actuales.
- **FR-011**: El camino liviano MUST poder desactivarse sin romper la galeria; si falta su configuracion, MUST quedar desactivado y usarse el respaldo.
- **FR-012**: El secreto de lectura MUST NOT exponerse en la pagina ni en el JavaScript; la credencial del cliente MUST ir firmada y la configuracion MUST estar protegida.
- **FR-013**: Una credencial vencida o invalida MUST degradar al camino actual y MUST reemitirse cuando corresponda.
- **FR-014**: El camino liviano MUST rechazar rutas fuera de la carpeta del comprador, identificadores con forma invalida, extensiones no permitidas y accesos a carpetas privadas que no sean las fotos.
- **FR-015**: La consola del administrador, el cotizador y la generacion de PDFs MUST quedar sin cambios funcionales.
- **FR-016**: La misma biblioteca MUST devolver los mismos ids y el mismo orden por el camino liviano y por el camino actual.
- **FR-017**: La semantica de "sin cambios" por revision MUST conservarse en ambos caminos.
- **FR-018**: Las fotos de ranura de la re-edicion MUST cargarse por el camino liviano; si una falla, MUST degradar solo esa imagen al camino actual o a un hueco visible.
- **FR-019**: El logout MUST borrar la credencial de lectura del cliente; el login MUST reemitirla.
- **FR-020**: La rotacion del secreto de lectura MUST invalidar todas las credenciales de lectura y permitir que se reemitan por el respaldo.
- **FR-021**: El camino liviano MUST usar el catalogo y las miniaturas existentes de la biblioteca; no MUST introducir un formato de datos nuevo ni requerir una migracion manual.
- **FR-022**: El sistema MUST permitir verificar si el camino liviano esta habilitado sin exponer el secreto ni datos de compradores.

### Security & Privacy Constraints

- La credencial de lectura es una capacidad: quien la copie puede leer las fotos de esa identidad hasta que expire. Es el trade-off aceptado para eliminar el token por apertura.
- El alcance es estrictamente la carpeta de fotos del comprador; nunca entregables, manifiestos, ideas, PDFs ni datos de terceros.
- La credencial del cliente va firmada, con atributos de seguridad del navegador, y el secreto vive fuera de la pagina y del JavaScript.
- El logout borra la credencial del cliente y la rotacion del secreto revoca todas las credenciales de lectura.
- Las escrituras conservan la autorizacion actual (token por operacion y permiso de administracion).
- Los plugins de seguridad del sitio pueden no inspeccionar el camino liviano; se acepta y se documenta.
- Los registros del camino liviano no deben exponer fotos ni rutas de compradores.

### Operational Constraints

- Sin dependencias nativas nuevas: el camino liviano corre en el hosting actual con el PHP y la extension de imagenes ya exigidos por el proyecto.
- Se despliega con el plugin y no requiere migracion manual de datos ni cambios en las carpetas del comprador.
- Es desactivable y el camino actual queda intacto como respaldo.
- Respeta las reglas de privacidad de directorios vigentes; si no se pueden aplicar, se desactiva.
- No cambia la seguridad de los entregables ni de los pedidos.

### Key Entities

- **Biblioteca del comprador**: conjunto de fotos de una identidad (invitado o cliente), con su fecha y su revision.
- **Foto**: original y miniatura cuadrada; incluye medidas, peso, fecha y recetas por contexto (forma, tamano y modo de encaje).
- **Credencial de lectura**: identidad de sesion del invitado o identificador firmado del cliente; autoriza solo lectura de sus fotos.
- **Revision de la biblioteca**: huella que cambia cuando cambia el conjunto de fotos; permite no volver a pedir la lista.
- **Foto de ranura**: foto ya colocada por el comprador en un item del carrito, que se vuelve a mostrar al re-editar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador con 10 fotos abre la galeria por primera vez en menos de 1 segundo (p95) en el sitio de produccion, frente a los 8-15 segundos actuales.
- **SC-002**: La reapertura dentro de la ventana de frescura (5 minutos), con la biblioteca sin cambios, no genera ninguna solicitud de red y pinta la tira en menos de 100 ms.
- **SC-003**: El trabajo pesado del servidor por apertura de galeria se reduce al menos un 80% respecto de la linea base.
- **SC-004**: El 100% de las lecturas de la galeria evita el arranque completo del sitio, verificado en la traza de red.
- **SC-005**: Cero exposiciones de fotos entre identidades en las pruebas invitado, cliente y dos navegadores.
- **SC-006**: El respaldo funciona en el 100% de los casos simulados de indisponibilidad del camino liviano.
- **SC-007**: Un item de carrito con 6 fotos de ranura se re-edita con todas las fotos visibles en menos de 1 segundo (p95), sin una solicitud administrativa por imagen.
- **SC-008**: La lista de 10 fotos no supera 60 KB y cada miniatura embebida no supera 20 KB.
- **SC-009**: Cero regresiones en las puertas de subida, borrado, vista previa, pedido y galeria.
- **SC-010**: La lista obtenida por el camino liviano y por el camino actual coincide en ids y orden en el 100% de las comparaciones.

## Assumptions

- El dueno del sitio acepta el trade-off de seguridad en lecturas: credencial del navegador como capacidad, sin token por apertura.
- El alcance de lectura es solo la carpeta de fotos del comprador.
- El hosting ejecuta el camino liviano y aplica las reglas de privacidad de directorios vigentes.
- El sitio usa HTTPS y navegadores modernos con almacenamiento local; en modo privado la galeria funciona sin copia local.
- La ventana de frescura es de 5 minutos: dentro de ella, con revision/identidad iguales, no se pide nada; fuera, se revalida una vez (aunque la revision coincida).
- Se embeben como maximo 10 miniaturas, que es el tope de la tira.
- El camino actual se mantiene como respaldo y para todas las escrituras.
- El formato de catalogo y miniaturas de la spec 040 es la fuente de datos; no se crea otro.
- La consola del administrador y el cotizador no cambian.
- No se agregan dependencias ni servicios externos.

## Out of Scope

- Acelerar la carga de la ficha del producto (la pagina del sitio sigue siendo un costo aparte).
- Cambiar la generacion de vistas previas, el pool de imagenes o la generacion de PDFs.
- Cambiar la consola del administrador, el cotizador o la entrega de pedidos.
- Publicar miniaturas como archivos estaticos publicos o usar una CDN.
- Cambiar la seguridad de los entregables y de los pedidos.
- Migrar datos existentes o reescribir el flujo de compra.
- Soporte offline completo.