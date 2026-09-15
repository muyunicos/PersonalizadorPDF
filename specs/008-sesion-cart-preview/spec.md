# Plan de conciliacion 004 vs 007 (sesion-carrito con preview obligatoria)

**Feature Branch**: `008-sesion-cart-preview`

**Created**: 2026-09-15

**Status**: Plan de conciliacion — NO es feature implementable directa; norma los specs 004 y 007 (ver §0)

**Input**: User description: "prefiero: `analisis.json` y `config.json` separados; `tmp/sesion-{sid}/` como unidad de render/carrito; preview obligatoria con `draft-{uuid}` → `cart_item_key`"

## §0. Naturaleza de este documento y decisiones normativas *(leer primero)*

Este documento NO especifica una feature para implementar: es el **plan de
conciliacion entre el spec 004 y el spec 007**. Sus decisiones **norman** ambos
specs alla donde se contradigan; el codigo futuro se alinea a lo aqui decidido.

**Decisiones normativas** (preferencias del usuario, 2026-09-15):

1. **`analisis.json` y `config.json` separados** (deroga "metadata.json como unica
   fuente" del spec 007): el Detector escribe `analisis.json` inmutable; la UI
   escribe `config.json` editable. Nunca se pisan entre si.
2. **`tmp/sesion-{sid}/` como unidad de render/carrito** (deroga `tmp/cart/{linea}/`
   sin nivel sesion del spec 007): la sesion agrupa items; cada item es una
   personalizacion con su pool de imagenes y su `manifest.json`.
3. **Preview obligatoria con `draft-{uuid}` → `cart_item_key`**: sin preview no hay
   agregado; el borrador se promueve a linea al agregar.

**Alcance**: las historias, FR, SC y entidades de abajo describen el estado
objetivo ya conciliado (no el estado actual del codigo 007). La migracion desde
lo implementado se planifica en §6.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El comprador personaliza, previsualiza y agrega al carrito sin perder su trabajo (Priority: P1)

El comprador abre la ficha de un producto WooCommerce vinculado a un PDF plantilla (por ejemplo dia-madre-1), completa los campos (por ejemplo un selector de tipografia y un cuadro de texto de varias lineas), pulsa "Procesar muestra" para ver el resultado de cada placeholder y el PDF descargable, y recien entonces agrega al carrito. Si agrega tres veces el mismo producto con distintos nombres, cada linea conserva su propia personalizacion.

**Why this priority**: es el flujo central de compra; sin unidad estable por linea, las personalizaciones se pisan entre si y el pedido llega mal.

**Independent Test**: personalizar el mismo producto 3 veces con valores distintos, agregar las 3 al carrito y comprobar que cada linea conserva sus valores y sus imagenes.

**Acceptance Scenarios**:

1. **Given** un producto con PDF activo y campos configurados, **When** el comprador completa los campos y pulsa "Procesar muestra", **Then** ve la imagen generada por placeholder y puede descargar el PDF de muestra.
2. **Given** una muestra sin generar, **When** el comprador intenta agregar al carrito, **Then** el agregado se bloquea hasta que la preview este lista.
3. **Given** tres agregados del mismo producto con distintos valores, **When** se revisa el carrito, **Then** cada linea muestra sus propios valores de cara al cliente (por ejemplo Color: azul) y conserva sus imagenes.

---

### User Story 2 - El administrador configura placeholders con valores, presets y overrides por grupo (Priority: P1)

El administrador abre la pagina del plugin "personalizador-pdf", sube un PDF plantilla, revisa el resultado del analisis y configura cada grupo de placeholders con su tipo, preset, valor y ajustes, pudiendo referenciar campos (por ejemplo `value = "[campo2]"`, `settings = "[campo56]"`). Al guardar, la configuracion queda persistida junto al analisis sin romperlo.

**Why this priority**: sin configuracion por grupo no hay nada que personalizar en la tienda.

**Independent Test**: subir un PDF, configurar un grupo con `tipo="texto"`, `preset`, `value` y `settings` con referencias a campos, guardar y recargar: la configuracion persiste intacta y el analisis sigue valido.

**Acceptance Scenarios**:

1. **Given** un PDF recien subido y analizado, **When** el administrador guarda la configuracion de placeholders, **Then** el archivo de analisis sigue intacto y el archivo de configuracion refleja lo guardado.
2. **Given** una configuracion guardada, **When** se re-analiza el PDF, **Then** la configuracion editable se conserva (el analisis se regenera, la configuracion no se pierde).

---

### User Story 3 - El pedido genera un PDF final por linea comprada (Priority: P2)

El cliente finaliza la compra y el sistema genera, por cada linea del pedido, el PDF editado con las imagenes de su sesion, disponible para descarga.

**Why this priority**: es la entrega del producto comprado; sin esto la personalizacion no llega al cliente.

**Independent Test**: completar un pedido de prueba con 2 lineas personalizadas distintas y comprobar que cada linea tiene su PDF final con sus imagenes.

**Acceptance Scenarios**:

1. **Given** un pedido pagado con lineas personalizadas, **When** se procesa el pedido, **Then** cada linea tiene su PDF final generado desde las imagenes de su sesion.
2. **Given** una linea sin imagenes disponibles, **When** se procesa el pedido, **Then** el sistema lo informa con causa en lugar de entregar un PDF vacio o a medias.

---

### Edge Cases

- ¿Que pasa si el cliente edita los campos despues de generar la preview pero antes de agregar al carrito? La preview queda desactualizada y el agregado se bloquea hasta regenerarla.
- ¿Que pasa si `value` combina varios campos o devuelve un array y la cantidad no coincide con las instancias del grupo? Se avisa antes de generar (sin PDF a medias).
- ¿Que pasa si el `script` de un campo falla o referencia un campo inexistente? Se informa la causa accionable (campo, operacion y motivo), sin fallos silenciosos.
- ¿Que pasa si el PDF base cambia de nombre o se re-analiza despues de configurar? La configuracion editable se conserva; el analisis se regenera.
- ¿Que pasa si la sesion expira o se limpia antes del pago? Las imagenes temporales se descartan y el cliente debe regenerar la preview.
## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST separar el analisis inmutable del PDF (`analisis.json`, solo el Detector) de la configuracion editable del administrador (`config.json`: activo, productos, campos, placeholders por grupo).
- **FR-002**: El sistema MUST guardar la configuracion de cada grupo con `tipo`, `preset`, `value` y `settings`, admitiendo referencias a campos (`[campoN]`) en `value` y `settings`.
- **FR-003**: El administrador MUST poder activar/desactivar cada PDF (switch) y asociarlo a productos (selector multi-producto WooCommerce).
- **FR-004**: El administrador MUST poder reutilizar campos ya creados en varios PDFs (mismo `id` en el catalogo global `campos.json`, orden por PDF en `campos_ids`).
- **FR-005**: Los campos MUST soportar contenido HTML propio, estilos con alcance por campo y logica con acceso a valores de otros campos (incluidos campos invisibles que derivan valores).
- **FR-006**: Cada campo MUST exponer un valor dual: etiqueta de cara al cliente (por ejemplo "azul") y valor de cara al sistema (por ejemplo `fill.color='#0000ff'`); en ficha, carrito y pedido se muestra la etiqueta, al procesamiento viaja el valor sistema.
- **FR-007**: El sistema MUST tratar `tmp/sesion-{sid}/` como unidad de render y carrito: una sesion contiene varios items (`{item_key}`), cada item puede llevar varios PDFs, y cada imagen puede servir a varios PDFs a la vez.
- **FR-008**: Las imagenes de sesion MUST nombrarse por destino con pool deduplicado (`img/{hash}.png`) y un unico `manifest.json` por item que mapea cada placeholder a su imagen y guarda la trazabilidad de valores.
- **FR-009**: El agregado al carrito MUST bloquearse hasta que la preview este generada (preview obligatoria); el borrador `draft-{uuid}` se adopta como linea definitiva al agregar.
- **FR-010**: Al eliminar una linea del carrito, el sistema MUST borrar solo su directorio de sesion sin tocar las demas lineas.
- **FR-011**: El sistema MUST generar el PDF final por linea desde las imagenes de su sesion al confirmarse el pedido, sin re-renderizar en servidor.
- **FR-012**: El sistema MUST informar el desajuste cuando un valor de tipo lista no coincide con la cantidad de instancias del grupo, antes de generar nada.

### Key Entities *(include if feature involves data)*

- **Analisis**: resultado inmutable del Detector por PDF (`analisis.json`): grupos, instancias, tamanos y paginas; nunca se edita desde la interfaz.
- **Configuracion**: decisiones editables del administrador por PDF (`config.json`): `activo`, `productos`, `campos_ids` y mapeo `placeholders` (tipo, preset, value, settings).
- **Campo**: pieza reutilizable del catalogo global (`campos.json`): contenido, estilos con alcance, logica con acceso a otros campos y valor dual cliente/sistema.
- **Sesion**: unidad de render y carrito (`tmp/sesion-{sid}/{item_key}/`): borrador `draft-{uuid}` promovido a linea, con pool de imagenes deduplicado y `manifest.json` unico por item.
- **Pedido**: lineas confirmadas con su PDF final generado desde las imagenes de su sesion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las configuraciones guardadas persiste tras recargar sin alterar el analisis (0 casos de analisis pisado por guardar configuracion).
- **SC-002**: El 100% de los intentos de agregar al carrito sin preview se bloquean con mensaje accionable (0 agregados sin imagenes).
- **SC-003**: 3 agregados del mismo producto con distintos valores conservan cada uno sus valores e imagenes (0 lineas pisadas) en el 100% de las pruebas.
- **SC-004**: El 100% de los pedidos de prueba genera un PDF final por linea con las imagenes de su sesion, sin re-render en servidor.
- **SC-005**: El 100% de los valores mostrados en ficha, carrito y pedido usa la etiqueta de cara al cliente, mientras el procesamiento recibe el valor de sistema.
- **SC-006**: El 100% de los desajustes lista-vs-instancias se informa antes de generar (0 PDFs a medias por este motivo).

## Assumptions

- El modulo TextMuy sigue siendo el render de texto en navegador y el motor PHP solo inyecta PNGs ya renderizados (sin evaluar logica en servidor).
- Existe al menos un PDF plantilla con placeholders detectables y al menos un campo reutilizable en el catalogo.
- WooCommerce esta activo para el selector multi-producto, el carrito y el pedido; sin Woo no hay panel de personalizacion en tienda.
- La carpeta `uploads/pmu/` es la raiz unica de datos (los datos generados nunca viven dentro del plugin).
- `Motor.php` no cambia su algoritmo de inyeccion: recibe mapa de grupo a ruta de imagen y devuelve el PDF editado.

## §6. Migracion desde lo implementado (007) al modelo conciliado

El codigo vigente implementa el modelo 007 (`metadata.json` unica fuente,
`tmp/cart/{linea}/`, `tmp/orders/`, `orders/{order_id}/{pdf}/`; ver `rutas-pmu.md`
v2 y `PMU_Uploads`). Para alinearse a este plan, en este orden:

1. **Partir el dataset por PDF**: por cada `pdfs/{nombre}/`, generar
   `analisis.json` (solo geometria del Detector: grupos, instancias, tamanos,
   paginas) desde el `metadata.json` vigente y `config.json` (activo,
   productos, campos, placeholders por grupo desde `default`/`value`/`preset`/
   `config`). A partir de ese punto `metadata.json` deja de escribirse.
2. **Mover el carrito bajo sesion**: reubicar `tmp/cart/{linea}/` a
   `tmp/sesion-{sid}/{item_key}/` con `manifest.json` unico por item y pool
   `img/{hash}.png` (`hash = sha1(valor + preset + settings + WxH)`).
3. **Alinear pedidos y docs**: `orders/{order_id}/{item_key}/` por item (no por
   PDF suelto); actualizar `rutas-pmu.md`, `AGENTS.md` §5, `readme.txt` y los
   tests (`motor_smoke`, `parity`, fases `texto_puente` que lean el dataset).
4. **Verificacion**: `php -l`, `motor_smoke` (SMOKE OK), `parity` (PARIDAD OK),
   `texto_puente` en todas sus fases + fase nueva `conciliacion` (analisis
   intacto tras guardar config; preview obligatoria; 3 lineas sin pisarse).
