# Feature Specification: Layout PMU de PDFs y contenido por grupo en metadata

**Feature Branch**: `007-pmu-pdf-layout`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Unificar los datos del PDF en uploads/pmu/pdfs/{pdf} con metadata.json como unica fuente del contenido por grupo, placeholders generados al vuelo sin almacenar, imagenes aplicadas y PDF procesado en tmp/ (pruebas del panel) u orders/ (pedidos completados), y robustez de la pestana PDFs del admin (sin errores 500)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La pestana "PDFs" nunca falla y explica la causa (Priority: P1)

El administrador entra a "Personalizador PDF -> PDFs" (tambien justo despues de subir un PDF, con los parametros `ec_subido`/`ec_pdf`/`grupos`/`instancias` en la URL) y la pagina **siempre** renderiza. Si un recurso del motor (catalogos, rutas, permisos) no se puede leer, ve un aviso con la causa concreta y el resto de la consola (subir, grupos, procesar) sigue operativa.

**Why this priority**: Hoy el redirect posterior a la subida devolvio `500 (Internal Server Error)` y el administrador quedo sin consola y sin causa visible; es un bloqueo total de la operacion principal.

**Independent Test**: Con un `presets.json` de 0 bytes (o con la carpeta del catalogo sin permiso de escritura) abrir la pestana PDFs: la respuesta es `200` y aparece un aviso con la causa; el selector de estilos simplemente queda vacio.

**Acceptance Scenarios**:

1. **Given** el catalogo `uploads/pmu/tm-presets/presets.json` vacio o ilegible, **When** se abre `admin.php?page=personalizador-pdf&tab=pdfs` con un PDF seleccionado, **Then** la respuesta es `200`, se ve un aviso con la causa y no hay excepcion fatal.
2. **Given** una escritura de catalogo en curso por otra peticion (sprite/miniatura del modulo), **When** la pestana lee el catalogo en ese instante, **Then** la lectura no revienta (escritura atomica) y la pagina renderiza.
3. **Given** cualquier fallo inesperado durante el render, **When** la pagina se sirve, **Then** se muestra el mensaje del fallo (no una pagina generica de error critico) y el admin puede seguir operando.

---

### User Story 2 - Los datos del PDF viven en una sola carpeta (Priority: P1)

El administrador sube `circulo6cm.pdf` y todo lo propio de ese PDF queda en **una** carpeta: `uploads/pmu/pdfs/circulo6cm/circulo6cm.pdf` + `uploads/pmu/pdfs/circulo6cm/metadata.json`. No se crea ni se usa la raiz heredada `uploads/personalizador-pdf/`.

**Why this priority**: Es la decision de arquitectura vigente (Constitucion IV: `pdfs/` = productos PDF organizados por carpeta con sus datos) y hoy el codigo escribe en la raiz heredada, con documentacion contradictoria.

**Independent Test**: Subir un PDF desde la consola y listar el arbol de `uploads/pmu/pdfs/`: aparece exactamente `pdfs/{nombre}/{nombre}.pdf` y `pdfs/{nombre}/metadata.json` (mas fixtures sueltos preexistentes).

**Acceptance Scenarios**:

1. **Given** la consola sin PDFs, **When** se sube `circulo6cm.pdf`, **Then** existen `pdfs/circulo6cm/circulo6cm.pdf` y `pdfs/circulo6cm/metadata.json`, y **no** se crea `uploads/personalizador-pdf/`.
2. **Given** un PDF ya subido, **When** se abre la consola, **Then** el selector lo lista (se descubren carpetas `pdfs/*/{nombre}.pdf`) y muestra sus grupos.
3. **Given** un PDF suelto `uploads/pmu/pdfs/muestra.pdf` (fixture de tests), **When** se lista el selector, **Then** ese archivo se ignora y no aparece como producto.

---

### User Story 3 - El contenido de cada grupo se define en `metadata.json` (Priority: P2)

El administrador define, por grupo del PDF, su contenido (texto literal y/o campos y/o codigo, mas el preset de TextMuy). Ese contenido se guarda en `metadata.json`; `textos.json` deja de existir. Al re-analizar el PDF, el contenido de los grupos que siguen existiendo se conserva.

**Why this priority**: Elimina el estado duplicado (un archivo por concepto) y habilita el modelo de campos/codigo de la personalizacion por pedido (spec 004).

**Independent Test**: Guardar contenido en el grupo `a`, recargar: el contenido viaja en `metadata.json`; no existe ningun `textos.json`; re-analizar el mismo PDF mantiene el contenido de `a`.

**Acceptance Scenarios**:

1. **Given** un PDF analizado, **When** se guarda "Usar texto" + preset en el grupo `0000FF`, **Then** `metadata.json.grupos[?id=0000FF]` refleja `default="texto"`, `value`, `preset`, y no se crea `textos.json`.
2. **Given** un PDF con personalizacion definida, **When** se pulsa "Re-analizar", **Then** se regeneran los grupos detectados y los campos `default`/`value`/`preset`/`config` de los grupos cuyo `id` sigue existiendo se preservan.
3. **Given** un grupo sin contenido definido, **When** se procesa, **Then** ese grupo queda intacto en el PDF y el resumen lo informa.

---
### User Story 4 - Placeholders sin archivos: se ven y se descargan al vuelo (Priority: P2)

El administrador ve el hueco de cada grupo como un marco del tamano real (sin depender de una imagen almacenada) y, si necesita preparar la imagen aparte, descarga un PNG transparente generado en el momento.

**Why this priority**: Hoy subir un PDF escribe un PNG por grupo (8 archivos en `circulo6cm`) que nadie mas consume; se elimina ese estado y su mantenimiento.

**Independent Test**: Tras analizar un PDF, `uploads/pmu/pdfs/{nombre}/` contiene solo el PDF y `metadata.json` (ningun PNG de placeholder), y la descarga del placeholder entrega bytes PNG validos sin crear archivo en disco.

**Acceptance Scenarios**:

1. **Given** un PDF analizado, **When** se abre la consola, **Then** cada grupo muestra un marco del tamano real sin peticion de imagen de placeholder.
2. **Given** un grupo, **When** se pulsa "Descargar placeholder", **Then** se recibe un PNG transparente del tamano del grupo y no queda archivo nuevo en `uploads/pmu/`.
3. **Given** un id inexistente en el dataset, **When** se pide su placeholder, **Then** se rechaza sin generar nada.

---

### User Story 5 - Muestras del panel y ciclo carrito → pedido (Priority: P3)

Las muestras que genera el administrador en la consola se guardan en `uploads/pmu/tmp/muestras/{pdf}/` y se **sobrescriben** (idempotentes). Los datos del comprador viven en directorios de trabajo separados: borradores de personalizacion en `uploads/pmu/tmp/cart/{linea}/` (una linea de carrito = una personalizacion), area de preparacion del pedido en `uploads/pmu/tmp/orders/{order_id}/` y resultado final por linea en `uploads/pmu/orders/{order_id}/{pdf}/`, promovido al confirmarse el pago.

**Why this priority**: Separa material de prueba, borradores del comprador y entregable; permite el mismo producto dos veces con distinta personalizacion y la eliminacion limpia por linea.

**Independent Test**: (a) Procesar dos veces desde la consola deja los mismos archivos en `tmp/muestras/{pdf}/` (sobrescritura, sin duplicados). (b) Con un pedido simulado en staging, promover mueve `tmp/orders/{order_id}/` a `orders/{order_id}/` con un subdirectorio por PDF de la linea.

**Acceptance Scenarios**:

1. **Given** un PDF con imagenes cargadas por grupo, **When** se procesa desde la consola, **Then** las imagenes y la salida quedan bajo `tmp/muestras/{pdf}/` (sobrescribiendo) y el enlace "Descargar el ultimo resultado" las sirve.
2. **Given** un comprador que personaliza dos veces el mismo PDF con distinto contenido, **When** agrega ambas al carrito, **Then** existen dos lineas con directorios `tmp/cart/{linea1}/{pdf}/` y `tmp/cart/{linea2}/{pdf}/` independientes.
3. **Given** una linea en el carrito, **When** el comprador la elimina, **Then** su directorio `tmp/cart/{linea}/` se borra y las demas lineas quedan intactas.
4. **Given** un pago confirmado, **When** se promueve el pedido, **Then** `tmp/orders/{order_id}/` pasa a `orders/{order_id}/` con un subdirectorio por PDF (`{pdf}_procesado.pdf` + aplicados + resumen).
5. **Given** borradores huerfanos (linea eliminada sin limpieza o sesion abandonada), **When** corre la limpieza programada, **Then** se eliminan por antigüedad (TTL) sin tocar muestras ni pedidos.

---

### User Story 6 - Migracion unica y explicita de datos existentes (Priority: P3)

Al desplegar el cambio, los PDFs y metadatos que hoy viven en `uploads/personalizador-pdf/` (o `extractor-corel/`) se mueven una sola vez al layout nuevo, convirtiendo `textos.json` en el `contenido` del grupo. La carpeta heredada se conserva como respaldo y no se vuelve a leer.

**Why this priority**: Evita perder el PDF y el analisis ya subidos en produccion; la Constitucion V lo permite como excepcion explicitamente necesaria.

**Independent Test**: Con datos en la raiz heredada, abrir la consola una vez: los PDFs aparecen migrados en `pdfs/{nombre}/` con su `metadata.json` y `contenido`; la raiz heredada sigue intacta y no se vuelve a migrar.

**Acceptance Scenarios**:

1. **Given** `uploads/personalizador-pdf/pdfs/x.pdf` + `datos/x/{metadata,textos}.json`, **When** se abre la consola, **Then** existen `pdfs/x/x.pdf` y `pdfs/x/metadata.json` con `contenido` derivado de `textos.json`.
2. **Given** la migracion ya realizada, **When** se vuelve a abrir la consola, **Then** no se repite ni se duplican carpetas.
3. **Given** un PDF ya existente en `pdfs/{nombre}/`, **When** la migracion encuentra el mismo nombre en la raiz heredada, **Then** no se pisa el destino y se informa el conflicto.

---

### Edge Cases

- `metadata.json` ausente o ilegible: la consola ofrece "Re-analizar" en lugar de fallar.
- PDF borrado con `tmp/muestras/{pdf}/` huerfano o `tmp/cart/` sin linea: limpieza segura, sin tocar datos de otros PDFs ni de otras lineas.
- Grupos nuevos o eliminados al re-analizar: la personalizacion de los grupos cuyo `id` desaparece se descarta; la de los que siguen se conserva y se informa en el resumen.
- Nombre de PDF repetido: se mantienen las opciones actuales (renombrar automaticamente / sobrescribir) aplicadas al layout nuevo.
- Escritura de catalogo concurrente (sprite/miniatura del modulo + lectura del admin): sin lecturas truncadas.
- Carpeta de datos sin permiso de escritura: mensaje con la causa, sin excepcion fatal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La consola "PDFs" DEBE renderizar siempre (HTTP 200) y mostrar la causa de cualquier fallo de recursos administrados por el motor (catalogos, rutas, permisos) en un aviso, sin excepcion no capturada.
- **FR-002**: La escritura de catalogos del motor DEBE ser atomica (archivo temporal + renombrado) y la lectura DEBE tolerar contenido vacio o JSON invalido sin lanzar.
- **FR-003**: Todo fallo durante el render de la consola DEBE mostrarse con su mensaje y permitir seguir operando.
- **FR-004**: Un PDF subido DEBE almacenarse como `uploads/pmu/pdfs/{nombre}/{nombre}.pdf` con su dataset en `uploads/pmu/pdfs/{nombre}/metadata.json`, y NADA mas (sin `textos.json`, sin PNGs de placeholder, sin crear `uploads/personalizador-pdf/`).
- **FR-005**: El selector de PDFs DEBE descubrir carpetas `pdfs/*/{nombre}.pdf` y omitir PDFs sueltos en `pdfs/` (fixture de tests).
- **FR-006**: `metadata.json` DEBE ser la unica fuente de la personalizacion por grupo, con los campos planos `default`/`value`/`preset`/`config` por grupo (contrato `contracts/metadata-pdf.md`).
- **FR-007**: `textos.json` DEBE desaparecer del codigo, de la documentacion y de los tests; la personalizacion por grupo se lee y escribe en `metadata.json` (campos `value`/`preset`).
- **FR-008**: "Re-analizar" DEBE preservar la personalizacion de los grupos cuyo `id` sigue existiendo y descartar la del resto, informandolo en el resumen.
- **FR-009**: El placeholder de un grupo NO DEBE almacenarse: la consola lo representa como marco del tamano real y la descarga se genera al vuelo (PNG transparente) sin escribir archivo.
- **FR-010**: La descarga de placeholder DEBE validar que el `id` pedido existe en el dataset y rechazar el resto.
- **FR-011**: Las muestras del panel (imagenes aplicadas y PDF procesado) DEBEN guardarse en `uploads/pmu/tmp/muestras/{pdf}/` (`{id}.{ext}` y `{nombre}_procesado.pdf`) y sobrescribirse en cada Procesar; nada del panel escribe fuera de `muestras/`.
- **FR-012**: El resultado de un pedido completado DEBE almacenarse por linea en `uploads/pmu/orders/{order_id}/{pdf}/` (aplicados `{id}.{ext}` + `{pdf}_procesado.pdf` + resumen), reutilizando el mismo motor y nomenclatura (spec 004 implementa el cableado a hooks Woo).
- **FR-013**: Las rutas DEBEN resolverse a traves del motor unico `PMU_Uploads` (una sola verdad de almacenamiento), agregando los accesos `pdfs/{nombre}`, `tmp/muestras/{pdf}`, `tmp/cart/{linea}`, `tmp/orders/{order_id}` y `orders/{order_id}/{pdf}` al motor.
- **FR-014**: Borrar un PDF DEBE eliminar `pdfs/{nombre}/` y `tmp/muestras/{nombre}/` sin afectar a otros PDFs, a lineas del carrito ni a pedidos.
- **FR-015**: La migracion de datos heredados DEBE ejecutarse una sola vez, ser no destructiva (respaldo) y convertir `textos.json` en `contenido` del grupo; no DEBE pisar un destino existente.
- **FR-016**: La documentacion vigente (`AGENTS.md`, `readme.txt`, `admin/ayuda.php`) DEBE quedar con un solo valor por dato, consistente con este layout.
- **FR-017**: Los tests del proyecto DEBEN actualizarse al layout nuevo y cubrir: consola sin 500 (catalogo corrupto), metadata como fuente de la personalizacion por grupo, placeholder al vuelo sin archivo y limpieza de `tmp/muestras/{pdf}/`.
- **FR-018**: Cada personalizacion agregada al carrito DEBE crear una linea con clave unica (cart item key de WooCommerce) y su directorio `tmp/cart/{linea}/{pdf}/`; un hash canonico de la personalizacion (`pmu_hash`) permite fusionar reenvios identicos (cantidad + 1) en vez de duplicar lineas; la cantidad va en el resumen y el PDF se genera una vez por linea.
- **FR-019**: Eliminar una linea del carrito DEBE borrar su `tmp/cart/{linea}/` sin tocar otras lineas; la limpieza programada DEBE eliminar borradores y staging huerfanos por TTL de `creado`, sin tocar muestras ni `orders/`.
- **FR-020**: Al confirmarse el pago, `tmp/orders/{order_id}/` DEBE promoverse (rename atomico) a `orders/{order_id}/` conservando un subdirectorio por PDF; el cableado a hooks Woo (add/remove al carrito, creacion de pedido, pago confirmado, limpieza programada) vive en spec 004.

### Key Entities

- **PDF (producto)**: carpeta `uploads/pmu/pdfs/{nombre}/` con `{nombre}.pdf` + `metadata.json`; puede tener `mckp.json` (mockups, spec 004). Estado derivado de la existencia del dataset; `activo` (producto activo/inactivo) es del PDF, no de los grupos.
- **Grupo (placeholder)**: entrada de `metadata.json.grupos[]` con `id` = color hex sin `#` (`^[0-9A-F]{6}$`), `w`/`h` en px (base 200 ppp), `cont` (instancias, usado por la validacion del motor), `pgs` (paginas, informativo) y los campos de personalizacion planos `default`/`value`/`preset`/`config`.
- **Personalizacion de grupo**: campos planos en el grupo (no un bloque anidado):
  - `default`: `null` (hueco intacto) o `texto` / `img` / slug de modulo (enum de strings).
  - `value`: plantilla string (`[campoX]` = referencia a campo; sin corchetes es literal; `\[` escapa).
  - `preset`: slug del preset TextMuy (para el selector y RenderCore).
  - `config`: string opaco de configuracion del modulo activo (hoy TextMuy) con sustitucion `[campo]`.
  - `activo` NO existe por grupo: la participacion se infiere (`value` no vacio o `default` exigente).
- **Muestra (panel admin)**: imagenes `{id}.{ext}` y `{nombre}_procesado.pdf` en `uploads/pmu/tmp/muestras/{pdf}/`; se sobrescriben en cada Procesar (idempotente).
- **Sesion / Linea de carrito**: borrador de una personalizacion en `uploads/pmu/tmp/cart/{linea}/{pdf}/` (clave unica por linea) con `manifest.json` (`pdf`, personalizacion canonica, `pmu_hash`, cantidad, `creado`, motor); al agregar al carrito la sesion se adopta como linea; al eliminar la linea se borra su directorio.
- **Staging de pedido**: copia de trabajo en `uploads/pmu/tmp/orders/{order_id}/{pdf}/` al crearse el pedido; se promueve a `orders/` al confirmarse el pago.
- **Resultado de pedido (`orders/{order_id}/{pdf}/`)**: aplicados `{id}.{ext}` + `{pdf}_procesado.pdf` + resumen por linea de producto.

## Success Criteria *(mandatory)*

- **SC-001**: La pestana "PDFs" responde `200` y muestra la causa en los tres escenarios de fallo (catalogo de 0 bytes, catalogo sin permisos, excepcion durante el render), sin pagina de error critico.
- **SC-002**: Subir un PDF crea exactamente 2 archivos dentro de `pdfs/{nombre}/` (el PDF y `metadata.json`) y 0 archivos en `uploads/personalizador-pdf/`.
- **SC-003**: 0 archivos de placeholder en disco tras analizar un PDF; la descarga al vuelo entrega PNG transparente valido.
- **SC-004**: 0 referencias a `textos.json` en codigo, tests y documentacion; el contenido por grupo se persiste y se relee desde `metadata.json`.
- **SC-005**: Procesar desde la consola deja imagenes y salida solo bajo `tmp/muestras/{pdf}/`; borrar el PDF no deja residuos.
- **SC-006**: Verificacion automatica en verde: `php -l` (plugin, admin, engine, inc), `php tests/motor_smoke.php` (SMOKE OK), `php tests/parity.php` (PARIDAD OK) y `php tests/texto_puente.php` en todas sus fases.
- **SC-007**: La migracion de la raiz heredada preserva el 100% de los PDFs y su contenido y no se repite en ejecuciones posteriores.

## Assumptions

- Objetivo de despliegue: Hostinger Business con PHP 8.5.4 y WordPress/WooCommerce al dia (Constitucion, Technical Constraints).
- Los catalogos v5.0 (`uploads/pmu/{fonts,img,tm-presets}`) y el modulo TextMuy siguen siendo la fuente de presets, imagenes y fuentes; esta feature no cambia su formato.
- `uploads/pmu/pdfs/muestra.pdf` (fixture de `motor_smoke`/`parity`) queda como archivo suelto ignorado por el selector.
- Los campos reutilizables y el flujo de pedidos (spec 004) llegan despues; aqui solo se define el bloque `contenido` que los alojara.

## Out of Scope

- Bugs del modulo TextMuy vistos en consola (`object-object` al buscar presets, `actualizarMigracion is not defined`, fuentes `MUY-*.ttf` resueltas contra `modules/textmuy/`): se tratan en una feature aparte del modulo.
- Interfaz de administracion de campos reutilizables, mockups y vista previa del cliente (spec 004).
- Cambios de comportamiento en el motor de deteccion e inyeccion (`engine/Detector.php`, `engine/Overlay.php`).