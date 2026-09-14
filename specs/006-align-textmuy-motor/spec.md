# Feature Specification: align-textmuy-motor

**Feature Branch**: `main-align-textmuy-motor`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "corregir la Deuda pendiente: (a) módulo: el cliente del editor aún usa las claves viejas del puente (guardar/borrar preset e imagen, guardar sprite) y el ámbito `presets` con bases de respaldo; (b) plugin: el puente de la pestaña Estilos de Texto se arma con el motor viejo hacia una carpeta inexistente, el catálogo de estilos guardados se calcula con un nombre que no es el real, quedan rutas y handlers heredados de una carpeta de datos anterior, falta un archivo de instrucciones que se referencia, y la documentación del plugin se contradice; (c) coherencia: lo documentado como contrato vigente debe ser lo que el sistema realmente hace."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Las galerías del editor muestran y conservan lo que el administrador guarda (Priority: P1)

El administrador abre la pestaña "Estilos de Texto", sube imágenes y tipografías, guarda estilos, los aplica a grupos del PDF y procesa el documento. Hoy ese circuito no es confiable: las galerías pueden aparecer vacías o con miniaturas rotas, y lo que el administrador sube no siempre vuelve a aparecer tras recargar, porque el sistema entrega al editor ubicaciones de recursos que no coinciden con donde realmente se guarda.

**Why this priority**: sin recursos visibles y persistentes no hay personalización de textos: es el circuito central del sistema.

**Independent Test**: subir una imagen, una tipografía y guardar un estilo desde la pestaña del editor; recargar la página; los tres siguen listados con su miniatura y se pueden asignar a un grupo del PDF, que se procesa sin errores.

**Acceptance Scenarios**:

1. **Given** el administrador tiene recursos guardados, **When** abre la pestaña del editor de estilos, **Then** ve exactamente esos recursos, cada uno con su miniatura, sin elementos de relleno ni errores.
2. **Given** el administrador sube, renombra o borra un recurso, **When** la operación termina, **Then** el cambio se refleja de inmediato y persiste tras recargar, y el inventario coincide con los archivos existentes.
3. **Given** un grupo de PDF con texto estilizado asignado, **When** el administrador procesa el PDF, **Then** el texto renderizado usa el estilo y los recursos elegidos, sin recursos ausentes ni sustituciones.
4. **Given** un recurso cuya miniatura aún no existe, **When** se abre la galería, **Then** la miniatura se genera y queda disponible para las próximas cargas.

---

### User Story 2 - Una sola ubicación de datos: respaldo y despliegue sin sorpresas (Priority: P2)

Hoy conviven más de una raíz de datos: inventarios, archivos físicos y hojas de miniaturas pueden quedar repartidos entre ubicaciones distintas, y además sobrevive una ubicación heredada que nadie usa. Respaldar, restaurar o desplegar el sistema obliga a adivinar qué carpetas copiar y qué carpetas borrar.

**Why this priority**: la integridad y la portabilidad de los datos del administrador dependen de que exista un único lugar de verdad.

**Independent Test**: con el sistema en uso, inspeccionar la carpeta de datos: hay exactamente un inventario y una hoja de miniaturas por ámbito, los archivos físicos junto a su inventario, y ninguna carpeta residual con copias. Copiar esa única carpeta de datos a otro entorno reproduce el mismo estado.

**Acceptance Scenarios**:

1. **Given** cualquier secuencia de altas, renombres y bajas, **When** se inspecciona el almacenamiento, **Then** existe una sola copia por recurso y un solo inventario y hoja de miniaturas por ámbito.
2. **Given** el administrador borra un recurso, **When** la operación termina, **Then** no quedan archivos ni entradas residuales.
3. **Given** el administrador copia la carpeta de datos a otra instalación, **When** abre el editor allí, **Then** ve los mismos recursos y estilos guardados.
4. **Given** una instalación con carpetas de datos de versiones anteriores, **When** el administrador abre el sistema, **Then** el sistema usa solo la ubicación vigente, no mezcla datos, y esa carpeta anterior se puede borrar sin afectar nada.

---

### User Story 3 - Fallos visibles y accionables, sin fallos silenciosos (Priority: P2)

Cuando falta un inventario, una miniatura o el recurso que referencia un estilo guardado, el administrador necesita saber qué pasó y por qué. Hoy puede encontrarse con una galería vacía sin explicación o con un texto renderizado usando un recurso equivocado.

**Why this priority**: un fallo invisible se convierte en horas de diagnóstico y en entregables incorrectos.

**Independent Test**: quitar o dañar un inventario y, por separado, un recurso referenciado por un estilo; en ambos casos el sistema informa el motivo y no continúa como si nada.

**Acceptance Scenarios**:

1. **Given** un inventario ausente o inválido, **When** se abre la galería o se intenta renderizar, **Then** se informa la causa y no se muestran sustitutos.
2. **Given** un estilo que referencia un recurso inexistente, **When** se procesa el grupo, **Then** el proceso se detiene informando el recurso faltante (sin resultados parciales).
3. **Given** una operación rechazada, **When** ocurre, **Then** el mensaje indica la operación, el ámbito y el motivo.
4. **Given** el almacenamiento sin permiso de escritura, **When** se intenta una operación, **Then** se informa el motivo y el inventario no queda a medias.

---

### User Story 4 - Documentación y despliegue coherentes con el sistema real (Priority: P3)

Quien instala o despliega el sistema sigue la documentación del plugin (incluida la guía de importación de módulos) y se encuentra con un archivo de instrucciones inexistente y con dos ubicaciones distintas documentadas para el mismo dato.

**Why this priority**: no bloquea el uso diario, pero degrada la confianza y provoca errores de despliegue que sí afectan al administrador.

**Independent Test**: seguir la guía de despliegue desde cero en una instalación limpia y comprobar que cada archivo y ruta mencionados existen y que el editor queda operativo con los recursos copiados.

**Acceptance Scenarios**:

1. **Given** un instalador nuevo, **When** sigue la guía de despliegue del plugin, **Then** todos los archivos y carpetas que menciona existen y el editor queda operativo.
2. **Given** un dato del sistema (ubicación de recursos, ámbitos, versión de caché del editor), **When** se busca en la documentación, **Then** todos los documentos indican el mismo valor.

---

### Edge Cases

- Inventario presente pero hoja de miniaturas ausente (o al revés): la galería sigue operativa y regenera lo que falta al abrirse.
- Subida de un recurso con un nombre ya existente: el resultado es determinista y visible; no se crean dos entradas para el mismo recurso ni se sobrescribe un recurso distinto sin avisar.
- Entrada de inventario dada de baja (hueco) o inválida: no se muestra en la galería y, si un estilo la referencia, el render se rechaza con causa.
- Estilo guardado con referencias por nombre de archivo (formato anterior): se rechaza indicando que debe volver a guardarse desde el editor.
- Dos pestañas del editor abiertas a la vez: la última operación confirmada es la que queda y el inventario nunca queda inconsistente.
- Un ámbito sin ningún recurso: la galería se abre vacía y sin error; el sistema crea el inventario vacío al primer uso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE tener una única ubicación de datos para los recursos del editor (tipografías, imágenes y estilos guardados), sin rutas alternativas ni copias del mismo dato.
- **FR-002**: El sistema DEBE exponer al editor un único punto de operaciones para listar, dar de alta, dar de baja, editar, persistir la hoja de miniaturas y guardar miniaturas de grupos, con credenciales de seguridad por operación.
- **FR-003**: El editor DEBE recibir del sistema las ubicaciones de lectura, las credenciales y el inventario inicial, y DEBE negarse a operar si esa información no está disponible (sin datos locales de respaldo ni modos alternativos).
- **FR-004**: El editor NO DEBE leer ni escribir recursos por fuera del punto único de operaciones (sin escritura directa de inventarios ni de archivos).
- **FR-005**: Cada ámbito DEBE tener exactamente un inventario y una hoja de miniaturas, ubicados junto a los archivos físicos del ámbito.
- **FR-006**: El nombre del inventario de cada ámbito DEBE ser el vigente (el de los datos reales) y el sistema NO DEBE crear inventarios con nombres alternativos.
- **FR-007**: El inventario DEBE reflejar el estado real del almacenamiento: altas, bajas sin reindexar y renombres con su archivo físico.
- **FR-008**: El sistema DEBE regenerar y persistir la hoja de miniaturas de un ámbito cuando falta, y el editor DEBE mostrarla sin errores.
- **FR-009**: Toda operación fallida DEBE informar operación, ámbito y motivo, sin fallos silenciosos ni estados intermedios.
- **FR-010**: El render de un grupo DEBE rechazarse con causa cuando un recurso referenciado por el estilo está ausente o es inválido (sin sustituciones ni resultados parciales).
- **FR-011**: El sistema NO DEBE conservar rutas, inventarios ni puntos de guardado de versiones anteriores (sin compatibilidad ni migración automática).
- **FR-012**: Los datos de versiones anteriores DEBEN poder eliminarse sin afectar el funcionamiento ni los recursos vigentes.
- **FR-013**: La documentación vigente del plugin y del editor DEBE indicar la misma ubicación de datos, los mismos ámbitos y la misma versión de caché del editor, y NO DEBE referenciar archivos inexistentes.
- **FR-014**: El sistema DEBE permitir respaldar y restaurar todos los recursos del editor copiando una única carpeta de datos.
- **FR-015**: Las verificaciones automáticas del proyecto DEBEN pasar sin fallos originados en rutas de datos.
- **FR-016**: Una sola **verdad** de almacenamiento: `PMU_Uploads` decide rutas, catálogos y operaciones y expone el único `handle_request()`; `PMU_Galeria` solo aporta utilidades de sprite por parámetros, sin rutas ni catálogos propios.

### Key Entities

- **Recurso**: elemento que el administrador usa o guarda para personalizar textos (imagen, tipografía o estilo guardado). Tiene identificador numérico estable, título, categorías y archivo asociado.
- **Ámbito**: colección de recursos de la misma naturaleza (tipografías, imágenes, estilos guardados). Cada ámbito tiene un inventario y una hoja de miniaturas.
- **Inventario**: registro por ámbito de los recursos vigentes; incluye huecos de recursos dados de baja y debe coincidir con los archivos existentes.
- **Hoja de miniaturas**: imagen que reúne las miniaturas del ámbito, posicionadas por el identificador del recurso.
- **Estilo guardado**: definición reutilizable de estilo de texto que referencia recursos por identificador.
- **Grupo de PDF**: hueco del PDF que se personaliza con texto estilizado; su render consume el estilo y sus recursos.
- **Puente**: canal por el que el sistema entrega al editor las ubicaciones de lectura, las credenciales y el inventario inicial, y por el que el editor solicita operaciones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los recursos subidos desde la pestaña del editor aparecen listados con miniatura después de recargar la página (hoy no hay garantía: las galerías pueden quedar vacías o con miniaturas rotas).
- **SC-002**: Tras 20 operaciones consecutivas (altas, renombres y bajas) existe exactamente 1 copia por recurso y 1 inventario + 1 hoja de miniaturas por ámbito: 0 duplicados y 0 residuos.
- **SC-003**: 0 ubicaciones de datos distintas de la vigente y 0 referencias a ellas en código o documentación (verificable por búsqueda).
- **SC-004**: El 100% de las operaciones fallidas muestra un motivo accionable (operación, ámbito y causa); 0 fallos silenciosos.
- **SC-005**: El 100% de las verificaciones automáticas del proyecto pasa sin fallos por rutas de datos.
- **SC-006**: Restaurar todos los recursos del editor en una instalación limpia toma menos de 2 minutos y una sola copia de carpeta de datos.
- **SC-007**: El 100% de los pasos de la guía de despliegue del plugin se completa sin encontrar archivos inexistentes.
- **SC-008**: El circuito completo (subir imagen + guardar estilo + procesar un grupo) se completa sin errores en un único intento en el 100% de las pruebas manuales.

## Assumptions

- Entorno de desarrollo controlado y sin datos en producción que migrar: no se requiere compatibilidad ni migración desde versiones anteriores; las carpetas de datos anteriores se pueden borrar.
- La ubicación vigente de los recursos del editor es la raíz de datos del plugin, con ámbitos de tipografías, imágenes y estilos guardados; el nombre del inventario de estilos es el que ya existe en disco.
- El motor del sistema es el único responsable de escribir inventarios, archivos y hojas de miniaturas; el editor es solo consumidor.
- El detalle de ejecución de la mitad del editor ya está desglosado en su propio repositorio y se considera el plan de trabajo de esa parte; este documento fija el resultado esperado.
- Se mantiene el marco vigente del proyecto: procesamiento en el servidor del sitio, sin dependencias nativas, y herramientas de prueba separadas del servidor productivo.
- Los recursos vigentes (tipografías, imágenes y estilos presentes hoy) son válidos y se conservan tal cual.
- **Fuera de alcance**: funciones nuevas del editor (efectos, plantillas, animaciones), rediseño de la interfaz, y cualquier cambio en el procesamiento del PDF distinto de consumir correctamente los recursos vigentes.
