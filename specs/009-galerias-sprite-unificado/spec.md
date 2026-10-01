# Feature Specification: galerias-sprite-unificado

**Feature Branch**: `main`

**Created**: 2026-09-30

**Status**: Borrador — clarificaciones, `plan.md` y `tasks.md` completos (checklist 16/16); pendiente implementación (T001+).

**Input**: User description: "Unificar el comportamiento de las tres galerías del editor (imágenes, tipografías, estilos guardados): al abrirlas leen el inventario (catálogo) y luego la hoja de miniaturas (thumbs.webp) para llenar cada celda con el recorte del sprite correspondiente; si un elemento no existe en la hoja, se genera y se guarda en ese momento para que la próxima vez no haya que cargar el objeto real. Sin botón 'Generar miniaturas' si las faltantes se generan solas. Resolver las limitaciones de Google Fonts para elegir el mejor enfoque. Tiles a altura completa en dos columnas. Igual comportamiento en las tres galerías, reutilizando recursos. Continúa el contrato del spec 006-align-textmuy-motor."

## Clarifications

### Session 2026-09-30

- Q: ¿El botón "Generar miniaturas" sigue siendo necesario si las faltantes se generan solas? → A: No; la generación es automática al abrir y solo queda un reintento visible en estado de error.
- Q: ¿Cómo se resuelven las familias de Google Fonts en las miniaturas? → A: Se generan automáticamente como el resto, con una sola familia por petición y en un solo peso, sin el parámetro de subconjunto por texto, con concurrencia limitada y tiempo de espera con reintento; la familia se descarga recién cuando el usuario la elige para editar. Las variables por familia quedan pendientes para más adelante.
- Q: ¿El primer despliegue puede tocar el motor del plugin (`PMU_Uploads`)? → A: Sí; se generaliza la certificación de la hoja a los tres ámbitos con despliegue conjunto plugin + módulo. Sin ese cambio no existe lectura posterior de la hoja.
- Q: ¿Cómo se muestran las tipografías en el tile? → A: Dos columnas de ~175 px con la proporción de la celda del inventario, sin celdas cortadas.
- Q: ¿Se agrega un JSON que indique la posición de cada miniatura en la hoja? → A: No; la posición se deriva del identificador (celda = id-1) y la vigencia la certifica `thumbs.sprite_firma`.
- Q: ¿Alcance de galerías? → A: Las tres (imágenes, tipografías, estilos guardados) con el mismo mecanismo, reutilizando los mismos recursos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Al abrir cualquier galería se ven todas las miniaturas desde la hoja certificada (Priority: P1)

El administrador abre la pestaña "Estilos de Texto" y recorre las tres galerías (imágenes, tipografías, estilos guardados). Cada celda muestra su miniatura leída de la hoja de miniaturas del ámbito, validada contra su inventario; no se descarga ningún archivo original (ni imagen, ni tipografía, ni preset). Hoy las galerías de tipografías y estilos guardados nunca pueden leer su hoja porque el motor solo certifica la de imágenes, por lo que muestran etiquetas en cada recarga y las miniaturas generadas se pierden.

**Why this priority**: es el circuito central del editor (ver spec 006, US1); sin lectura certificada las galerías pierden confianza y cada visita vuelve a costar descargas.

**Independent Test**: con hoja certificada presente, abrir las tres galerías con la consola de red abierta: solo se solicitan el inventario del ámbito y su `thumbs.webp`; 0 descargas de tipografías, 0 familias de Google, 0 imágenes originales; cada celda muestra su miniatura.

**Acceptance Scenarios**:

1. **Given** una hoja certificada para el inventario vigente, **When** se abre cualquiera de las tres galerías, **Then** cada celda muestra su miniatura y solo se piden inventario + hoja (0 descargas de contenido).
2. **Given** la hoja ausente o sin certificar, **When** se abre la galería, **Then** las celdas muestran su nombre mientras se generan, con progreso visible, y si el proceso termina sin fallas se persiste exactamente una vez por ámbito.
3. **Given** la generación terminó y quedó certificada, **When** se recarga la página (F5), **Then** las miniaturas se leen de la hoja y las descargas de contenido vuelven a ser 0.
4. **Given** el motor rechaza la hoja (firma o dimensiones), **When** responde, **Then** el panel informa operación, ámbito y motivo exactos.

---

### User Story 2 - La hoja se completa sola cuando falta un elemento (Priority: P2)

El administrador da de alta una tipografía, una imagen o un estilo nuevo. En la próxima apertura de esa galería, solo el elemento nuevo se dibuja (descargando únicamente su fuente: su archivo, su tipografía o su preset), la hoja se reescribe una sola vez y a partir de ese momento ese elemento ya no descarga nada.

**Why this priority**: es el comportamiento pedido desde el inicio ("si no está en la hoja, genéralo y guárdalo para la próxima"); sin él, cada alta obliga a regenerar todo a mano.

**Independent Test**: dar de alta una tipografía física nueva y volver a abrir la galería: se descarga solo ese archivo, hay un único guardado de la hoja, y una tercera apertura no descarga nada.

**Acceptance Scenarios**:

1. **Given** una entrada de inventario sin celda en la hoja, **When** se abre la galería, **Then** esa celda se genera descargando solo su fuente y la hoja se persiste una sola vez.
2. **Given** N celdas faltantes, **When** corre la generación, **Then** el progreso indica N y hay exactamente 1 escritura de hoja por ámbito y apertura.
3. **Given** una o más fuentes fallan al generarse (sin red, error de descarga), **When** termina el intento, **Then** la hoja NO se persiste, las celdas fallidas quedan como nombre con causa y reintento, y el próximo intento reintenta solo.
4. **Given** dos pestañas o galerías generando a la vez, **When** corren, **Then** no se emiten dos escrituras simultáneas del mismo ámbito (la segunda espera a la primera).

---

### User Story 3 - La tipografía elegida se ve con su propio tipo y queda guardada (Priority: P2)

El administrador hace clic en una celda de tipografías para evaluarla: la celda se redibuja con el tipo real de esa familia (física o Google) y esa miniatura queda en la hoja, de modo que las próximas aperturas la muestren sin volver a descargarla.

**Why this priority**: sin esto las 57 familias Google del catálogo se ven con el mismo tipo y el catálogo no sirve para elegir tipografía.

**Independent Test**: hacer clic en una celda Google; se descarga 1 sola familia (una petición de hoja de estilos + sus archivos del peso elegido) y la celda pasa de nombre a tipo real; recargar: la celda conserva el tipo real sin nuevas descargas.

**Acceptance Scenarios**:

1. **Given** una celda Google aún no dibujada, **When** el usuario la selecciona, **Then** se pide 1 sola familia en 1 solo peso y el texto se redibuja con su tipo real.
2. **Given** una celda física aún no dibujada, **When** se selecciona, **Then** se descarga únicamente ese archivo de tipografía y la celda se redibuja con su tipo.
3. **Given** el tipo real ya dibujado en la celda, **When** se vuelve a abrir la galería, **Then** la hoja lo conserva sin descargar nada.
4. **Given** Google Fonts sin red o con tiempo de espera agotado, **When** falla la descarga, **Then** la celda conserva el nombre con estado de carga visible y se reintenta después, sin romper la selección.

---

### User Story 4 - Las celdas se ven completas, proporcionales y legibles (Priority: P3)

Las miniaturas ocupan toda la altura de su celda con la proporción real de la hoja: las tipografías en dos columnas de ~175 px y altura completa, sin celdas cortadas a mitad de alto (hoy se ve un tercio o la mitad del rectángulo), y con la misma geometría esté la celda con miniatura o con nombre.

**Why this priority**: no bloquea la operación, pero hoy hace que la galería parezca rota y dificulta evaluar tipografías.

**Independent Test**: medir en navegador la celda de tipografías tras el cambio: dos columnas de ~175 px y alto completo de la proporción del inventario (~29 px para 180×30), con 0 celdas cortadas.

**Acceptance Scenarios**:

1. **Given** el inventario de tipografías (retícula 180×30), **When** se abre la galería en un panel de ~380 px, **Then** hay 2 columnas de ~175 px y cada celda mide su alto completo, sin recorte.
2. **Given** celdas con nombre (miniatura aún no generada), **When** se renderizan, **Then** ocupan la misma geometría que las de miniatura.
3. **Given** las galerías de imágenes y de estilos guardados, **When** se abren, **Then** cada una usa la proporción de su propia retícula (100×100 y 200×100) sin celdas deformadas.

---

### Edge Cases

- Inventario cambiado mientras se genera la hoja (alta en otra pestaña): la firma ya no coincide; el motor rechaza con causa, se relée el inventario y se reintenta una sola vez.
- Hoja presente pero con dimensiones distintas a la retícula del inventario vigente (retícula rediseñada): se trata como no certificada y se regenera.
- Entrada de inventario sin celda posible (hueco o identificador mayor a la retícula): no se muestra en la galería y no participa en la generación.
- Ámbito vacío (sin recursos): la galería se abre vacía y sin error; se conserva el comportamiento de crear el inventario vacío al primer uso.
- Google Fonts sin conexión o con tiempo de espera agotado durante la generación: esas celdas quedan como nombre, la hoja no se persiste y el panel informa cuántas faltan.
- Archivo físico de tipografía ausente o corrupto: la celda fallida queda como nombre con causa; el resto de las celdas no se ve afectado y la hoja no se persiste hasta tenerlas todas.
- Hoja que supera el tamaño máximo admitido por el motor: se informa el motivo y no se persiste nada (la galería sigue operativa con nombres).
- Dos administraciones con la misma carpeta de datos: la última escritura confirmada es la que prevalece y la hoja siempre se valida contra el inventario vigente.
- Clic repetido sobre la misma celda mientras carga: la descarga no se duplica (una promesa por familia/archivo).
- Persistencia de una hoja parcial por error interno: prohibida; una hoja certificada sin celdas reales condenaría esas celdas para siempre.


## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Las tres galerías (imágenes, tipografías, estilos guardados) DEBEN seguir el mismo mecanismo de lectura: inventario del ámbito + hoja de miniaturas certificada + celda derivada del identificador, sin lógica distinta por galería más allá de cómo se dibuja cada celda.
- **FR-002**: El motor DEBE validar firma (retícula + inventario) y dimensiones de la hoja para los tres ámbitos y DEBE persistir la certificación del inventario al aceptarla; hoy solo lo hace para imágenes y debe generalizarse.
- **FR-003**: Toda alta, baja o edición DEBE invalidar la certificación del ámbito, de modo que la próxima apertura vuelva a completar lo que falte.
- **FR-004**: Con hoja certificada, abrir una galería DEBE producir 0 descargas de contenido (0 archivos de tipografía, 0 familias de Google, 0 imágenes originales); solo inventario + hoja.
- **FR-005**: Sin hoja certificada o con celdas faltantes, la galería DEBE generar automáticamente lo que falta al abrirla, con progreso visible, y DEBE persistir exactamente una vez por ámbito y apertura **si todas las celdas se dibujaron**, sin escrituras simultáneas del mismo ámbito (la segunda espera a la primera).
- **FR-006**: La generación DEBE descargar únicamente la fuente de cada elemento faltante (su imagen, su tipografía física o su preset), nunca el conjunto completo cuando solo faltan pocos.
- **FR-007**: Las familias de Google DEBEN generarse con una sola familia por petición, en un solo peso, sin el parámetro de subconjunto por texto, con concurrencia limitada y tiempo de espera con reintento; una familia se descarga recién cuando el usuario la elige para editar.
- **FR-008**: El sistema NO DEBE persistir una hoja con celdas sin dibujar: si alguna falla, se conserva la hoja anterior, se informan las celdas pendientes y se reintenta en la próxima apertura.
- **FR-009**: No habrá botón "Generar miniaturas"; solo debe existir un reintento visible en estado de error.
- **FR-010**: Toda falla DEBE informar operación, ámbito y motivo (sin mensajes genéricos como "sin puente o sin catálogo").
- **FR-011**: La geometría de cada celda (proporción y ancho de columna) DEBE derivarse del `thumbs` del inventario; las tipografías se muestran en dos columnas; ninguna celda debe quedar cortada a mitad de alto, ni las que muestran miniatura ni las que muestran nombre.
- **FR-012**: Toda escritura de hoja DEBE hacerse exclusivamente por el motor único (`op=sprite` con firma), sin escritura directa de archivos ni rutas alternativas (reitera constitución III).
- **FR-013**: La muestra de texto en una celda DEBE ser el nombre propio del elemento (mismo texto hoy usado), y la familia o tipografía DEBE coincidir con la del elemento representado (nunca una familia por defecto compartida).
- **FR-014**: Las verificaciones automáticas DEBEN cubrir al menos: apertura con hoja certificada (0 descargas de contenido), apertura sin hoja (generación automática + 1 escritura + segunda apertura con 0), y las suites vigentes en verde.
- **FR-015**: La documentación vigente (AGENTS.md del módulo, constitución con Sync Impact Report e INDICE.md de specs) DEBE quedar coherente con el comportamiento nuevo: el invariante "abrir = 0 descargas" queda acotado a "con hoja certificada".

### Key Entities

- **Inventario**: registro por ámbito de los recursos vigentes (imágenes, tipografías, estilos guardados); incluye su retícula de miniaturas (`thumbs` con ancho, alto y columnas) y la certificación de la hoja (`thumbs.sprite_firma`).
- **Hoja de miniaturas**: archivo `thumbs.webp` por ámbito que reúne todas las miniaturas; posición de cada celda derivada del identificador (celda = id-1, con huecos estables); una hoja sin certificar o con dimensiones distintas a la retícula no se usa.
- **Firma de hoja**: representación del inventario (retícula + entradas) que el cliente envía y el motor compara antes de aceptar una hoja; igual que la del spec 006.
- **Celda**: rectángulo de la hoja que corresponde a un elemento; su estado es "dibujada" (miniatura real) o "pendiente" (muestra el nombre del elemento).
- **Estado de hoja por ámbito**: certificada (lectura pura), pendiente (se genera automáticamente) o fallida (causa visible + reintento).
- **Elemento de galería**: imagen, tipografía (física o familia Google) o estilo guardado; fuente de su miniatura: su archivo original, su tipografía o su preset.


## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con hoja certificada, abrir cualquiera de las tres galerías produce 0 descargas de tipografías, 0 familias de Google y 0 imágenes originales: solo el inventario del ámbito y su hoja (medible en consola de red y automatizable con navegador real).
- **SC-002**: En una instalación sin hoja, la primera apertura de la galería de tipografías genera todas las celdas y certifica la hoja con **exactamente 1** escritura `op=sprite`; la segunda apertura cumple SC-001. (Catálogo de referencia del espejo: 72 tipografías = 57 Google + 15 físicas.)
- **SC-003**: El costo de la generación completa de tipografías es una sola vez: estimado en ~1,5-2,5 MB y ~5-15 s con concurrencia limitada, con máximo aceptable de 5 MB y 60 s, y no se vuelve a pagar: a partir de entonces la galería cero descargas.
- **SC-004**: Tras dar de alta un elemento nuevo, la próxima apertura genera **solo esa celda** (1 descarga de su fuente) y 1 escritura de hoja; la apertura siguiente no descarga nada.
- **SC-005**: Al seleccionar una celda de tipografía aún no dibujada, se descarga exactamente 1 familia Google (1 petición de hoja de estilos del único peso + sus archivos) o 1 archivo físico, y el texto de la celda refleja el tipo real de esa familia.
- **SC-006**: La galería de tipografías muestra 2 columnas de ~175 px con celdas de alto completo (~29 px para la retícula 180×30): 0 celdas cortadas a mitad de alto, verificado midiendo en navegador tanto el estado con miniatura como el de nombre.
- **SC-007**: El 100% de las fallas informa operación, ámbito y motivo exacto (p. ej. firma desactualizada, dimensiones inválidas, directorio sin escritura, familia sin red); 0 fallos silenciosos y 0 mensajes genéricos de galería.
- **SC-008**: El 100% de las verificaciones automáticas del proyecto pasa en verde: suites Node del módulo (16 vigentes + las nuevas), la prueba de navegador con navegador real, `php -l`, y `motor_smoke`/`parity` cuando existe `uploads/pmu/pdfs/muestra.pdf`.
- **SC-009**: Ninguna escritura de hoja simultánea del mismo ámbito (0 duplicados) en una sesión con varias galerías y pestañas en operación.
- **SC-010**: La documentación vigente (AGENTS.md, constitución, INDICE.md) describe el comportamiento nuevo sin contradicciones: 0 invariantes desactualizados sobre "abrir = 0 descargas".



## Assumptions

- **Google Fonts no tiene cuota publicada para la API de hojas de estilo (`css2`)**: el servicio lo sirve desde CDN con caché agresiva y la cuota que existe pertenece a la API de metadatos, que este sistema no usa. Por eso la generación completa se considera aceptable una sola vez; se pide una sola familia en un solo peso por petición y se omite el parámetro de subconjunto por texto (ese parámetro crearía tipos limitados a los caracteres del nombre y rompería el render completo con la misma familia).
- **Despliegue conjunto plugin + módulo**: el contrato `op=sprite` con firma se extiende a los tres ámbitos en este mismo despliegue (mismo paso que el spec 006); no hay fase de compatibilidad previa.
- **Sin persistencia de manifiesto**: no se agrega ningún archivo JSON de posiciones; la celda se deriva del identificador y la vigencia la certifica la firma.
- **Catálogo de referencia** del entorno de desarrollo: 72 tipografías (57 Google + 15 físicas, ~1,4 MB), 128 imágenes y 1 estilo guardado; los números de SC-002/SC-003 se ajustan proporcionalmente si cambia el catálogo, manteniendo "solo una vez".
- **Comportamiento de las hojas existentes**: las hojas sin certificar se consideran no usables y se regeneran; no se migra ni se valida el contenido anterior.
- **Retículas vigentes por ámbito** (el inventario manda si cambian): tipografías 180×30 con 4 columnas; imágenes 100×100 con 8 columnas; estilos guardados 200×100 con 4 columnas.
- **Paneles del editor**: el ancho del panel de galería (~380 px) y las dos columnas de ~175 px para tipografías son el tamaño de referencia; el diseño se adapta a paneles más angostos sin partir celdas.
- **El detalle técnico del módulo** (`modules/textmuy/`, sus suites Node y el bump de versión por caché) es el plan de trabajo de esa parte; este documento fija el resultado esperado.
- Se mantiene el marco vigente: sin modo standalone, sin datos locales de respaldo, escrituras solo por el motor con credencial, pruebas automatizadas separadas del servidor productivo.
- **Fuera de alcance**: variables o pesos múltiples por celda de tipografía (queda para más adelante, como se decidió en Clarifications), alojamiento propio de las familias Google (self-host), rediseño de la interfaz de las galerías, nuevas galerías y cualquier cambio en el render del PDF.


