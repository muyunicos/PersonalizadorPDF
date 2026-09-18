# Research Findings

**Date**: 2026-09-13 | **Feature**: WooCommerce PDF Personalization

## Decision Log

### 1. PDF Processing Architecture

**Decision**: Pure PHP PDF engine with no external dependencies

**Rationale**: 
- Shared hosting constraints (no Node/Python runtime)
- Existing `engine/` module already implements parser, detector, and overlay
- Proven smoke tests (`motor_smoke.php`) confirm correctness

**Alternatives considered**:
- Ghostscript/FPDF: Too heavy for shared hosting, requires native extensions
- WP PDF Library: Limited control over placeholder injection

### 2. Text Rendering Strategy

**Decision**: Client-side TextMuy (Canvas 2D + WebGL) for previews, server-side PDF injection

**Rationale**:
- Instant preview feedback (<2s)
- No font licensing issues (Google Fonts loaded client-side)
- TextMuy already implements delta-based preset system

**Alternatives considered**:
- Server-side text-to-image (PHP GD/Imagick): Slower, font management overhead
- PDF text insertion: Limited styling control

### 3. Image Upload & Processing

**Decision**: Custom `selector-pmu` component with client-side crop + server-side webp conversion

**Rationale**:
- Client-side crop reduces server load
- webp format balances quality/size (25-35% smaller than PNG)
- Existing WordPress media library integration

**Alternatives considered**:
- Full-size upload + server resize: Wastes bandwidth
- Pure server-side cropping: Poor UX

### 4. Data Persistence

**Decision**: WordPress postmeta + filesystem (uploads/) hybrid

**Rationale**:
- postmeta for relationships (PDF↔WooCommerce product)
- Filesystem for large assets (PDFs, images)
- Follows WordPress patterns, easy backup/migration

**Alternatives considered**:
- Custom DB tables: Over-engineering, harder migrations
- Full filesystem storage: Loss of WP query capabilities

### 5. Placeholder Detection Algorithm

**Decision**: Rectángulo de 4 líneas cerradas con fill_opacity ≤ 0.001

**Rationale**:
- Handles CorelDRAW exports (transformed rectangles)
- Minimum size filter (10×5 pt) avoids artifacts
- Color-based grouping allows multi-placeholder designs

**Alternatives considered**:
- BBox-only detection: Misses rotated placeholders
- SVG path parsing: Overly complex

---

## Best Practices Applied

| Area | Practice | Source |
|------|----------|--------|
| Security | Nonce validation on all POST handlers | WordPress Coding Standards |
| Performance | Image lazy-loading, CDN-ready asset URLs | WooCommerce patterns |
| UX | Progress indicator during PDF generation | WCAG 2.1 (loading states) |
| Error Handling | User-friendly messages + admin error logs | WordPress Plugin Handbook |
| Accessibility | Form accessibility | Form labels, armado por teclado en el admin | WCAG 2.1 Level AA |

---

## Decisiones 2026-09-17 (reescritura del spec)

### 6. Mockups como capas sobre un canvas fijo de 300x300

**Decision**: el mockup es una "fotografia" simulada del producto en uso compuesta por
capas (`img` / `placeholder`) sobre un canvas FIJO de 300x300 px, con tamano, posicion,
rotacion/sesgo y filtros por capa; N mockups por PDF sin limite y N capas sin limite
(galeria con flechas). Composicion en `config.json:mockups[]`; fotos del admin en
`pdfs/{nombre}/mockups/` o catalogo `img/`; render al vuelo (sin miniaturas guardadas).

**Rationale**: el PDF puede tener cualquier forma/proporcion; lo que se muestra no es el PDF
sino el producto en escena (banderin en una fiesta tematica). El canvas fijo mantiene
uniforme el espacio de la ficha; el placeholder se adapta con tamano/posicion/rotacion.

**Alternatives considered**: canvas proporcional al PDF (deformaria o letterbox la foto);
miniaturas PNG por mockup (estado derivado que hay que invalidar); preview limitada a 1
mockup (impide mostrar frente/dorso o varios productos).

### 7. Editor de mockups embebido, reutilizando el motor TextMuy

**Decision**: el editor de capas vive embebido en la pagina de edicion del PDF (iframe/modo
del modulo `modules/textmuy/`, bump `?v=RCn`), no como editor nuevo ni pestana aparte.

**Rationale**: el modulo ya tiene Canvas 2D + WebGL, galeria del catalogo `img/` y catalogo
de presets. Const. II manda reutilizar; ademas el admin no cambia de contexto.

**Alternatives considered**: editor nuevo en el plugin (duplicaria motor de render y
galeria); reutilizar el editor completo sin modo reducido (interfaz mas pesada de lo
necesario para componer capas).

### 8. Sesion del comprador: un directorio que se mueve

**Decision**: el `sid` es un UUID propio (cookie `pmu_sid`, 30 dias) y todo el trabajo del
cliente vive en `tmp/sesion-{sid}/...`, que se renombra (nunca se copia) a
`{cart_item_key}/` al agregar, se copia al staging al crearse el pedido y se promueve por
`rename()` a `orders/` al confirmarse el pago.

**Rationale**: Woo no da identidad estable al visitante (su `customer_id` cambia al
loguearse y su sesion expira con el carrito); un UUID propio sobrevive al login y permite
retomar el trabajo 30 dias despues. Un unico arbol por item evita duplicados y borrados
cruzados.

**Alternatives considered**: sesion PHP/Woo como `sid` (se rompe al loguearse o expirar);
deduplicacion global de PNGs por hash (colisiones y borrado por referencia ajena entre
items distintos).

### 9. Vista previa: boton unico, render paralelo, regeneracion parcial

**Decision**: boton "Vista previa" + leyenda; la galeria reemplaza al boton; las vistas se
renderizan en paralelo con placeholder "Generando vista previa" 300x300; si el cliente edita
un campo, la galeria se oculta y al re-pulsar solo se regeneran los campos cambiados
(comparacion por `hash = sha1(valor + preset + settings + WxH)`); el visto bueno ES agregar
al carrito (sin boton de confirmar).

**Rationale**: menos clicks, cero estados que el cliente deba interpretar (sin tildes ni
"pendiente"), y regeneracion barata. El hash ya existia para el pool.

**Alternatives considered**: re-render en vivo (costoso con N mockups + WebGL); boton
"Aprobar" separado (agrega un paso y un estado innecesario).

### 10. Fallos de render no bloquean la venta

**Decision**: si una vista falla, se oculta esa vista y quedan las demas; si no queda
ninguna, la galeria se oculta, aparece "no hay vista previa" y la compra se habilita con
`preview_estado=sin_vista`. El admin lo ve primero en "completados" (filtro por estado) y
puede regenerar; en Descargas el boton reintenta el render silenciosamente antes de pedir el
PDF al Motor.

**Rationale**: una incompatibilidad de navegador no debe costar una venta; el Motor ya tiene
la regla de no entregar PDFs a medias, y el reintento deja el caso resoluble sin friccion.

**Alternatives considered**: bloquear el carrito ante cualquier fallo (perderia ventas);
generar el PDF en servidor como respaldo (Const. III: el texto se renderiza en el navegador).

### 11. Descargas por lista nativa de Woo y cantidad fija 1

**Decision**: la entrega usa la lista de archivos de `mi-cuenta/descargas/` (una fila por
PDF, sin ZIP propio); el boton "Descargar" hace render cliente + Motor (reintentable e
idempotente); en productos con PDF la cantidad es fija 1 y todo `add-to-cart` lleva
`unique_key=uuid` para que Woo nunca fusione lineas.

**Rationale**: cada PDF personalizado es un diseño unico (no hay "dos iguales"); la lista
nativa ya cubre reintentos, permisos y correos. Un ZIP propio duplicaria funcionalidad de
Woo.

**Alternatives considered**: ZIP con los N PDFs (mas codigo y peor diagnostico de fallos);
permitir cantidad >1 (multiplicaria un diseño unico sin sentido).