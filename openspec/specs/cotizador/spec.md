# cotizador Specification

## Purpose

Cotizador de stickers: el cliente sube su arte con el selector existente, ve un mockup
300x300, guarda ideas y favoritos, y el diseno viaja con el pedido reutilizando el plugin
como proveedor de diseno.

## Requirements

### Requirement: Contexto cotizador
El sistema SHALL operar el cotizador con contexto `cotizador` reusando `data-pmu-panel` y
`PMU_TIENDA`, y SHALL marcar `manifest.contexto = 'cotizador'` con `pdfs = []` y
`preview_estado = 'omisible'`.

#### Scenario: Item del cotizador
- **WHEN** se crea un item desde el cotizador
- **THEN** nace con `manifest.contexto = 'cotizador'`, `pdfs = []` y `preview_estado = 'omisible'`

### Requirement: Diseno del cliente con mockup 300x300
El sistema SHALL permitir al cliente subir su arte con el selector existente y ver un mockup
300x300 sin PDF, con fondo blanco y sin avisos de calidad.

#### Scenario: Mockup propio sin PDF
- **WHEN** el cliente carga su arte
- **THEN** ve un mockup 300x300 propio con fondo blanco, sin PDF

### Requirement: Ideas y favoritos
El sistema SHALL guardar cada idea en `tmp/sesion-{sid}/customs/{idea_id}/` (invitado) o
`orders/{cliente}/customs/` (cliente) con `idea.json` + `mockup.webp`, y SHALL marcar
favoritos en `favoritos.json`, sin `manifest.json`.

#### Scenario: Idea sin manifest
- **WHEN** se guarda una idea del cotizador
- **THEN** no lleva `manifest.json` y queda fuera de los escaneos de pedidos y biblioteca

#### Scenario: Adopcion en la primera compra
- **WHEN** un invitado compra por primera vez
- **THEN** sus customs se adoptan a `orders/{cliente}/customs/` de forma idempotente

### Requirement: Promocion del item del cotizador
El sistema SHALL promover el item del cotizador al pagar con `PMU_Cotizador::promover_linea()`
(item + originales + adopcion), sin entregar PDFs ni congelar bonus.

#### Scenario: Pago del cotizador
- **WHEN** se paga un item del cotizador
- **THEN** se promueve con `promover_linea()` sin generar PDFs

### Requirement: Aplicar arte a todos los grupos
El sistema SHALL aplicar por defecto el arte del comprador a todos los grupos de la plancha
cuando hay plantilla, y SHALL ordenar los mockups con el PDF primero.

#### Scenario: Arte a todos los grupos
- **WHEN** hay plantilla y el cliente sube su arte
- **THEN** se aplica a todos los grupos de la plancha por defecto
