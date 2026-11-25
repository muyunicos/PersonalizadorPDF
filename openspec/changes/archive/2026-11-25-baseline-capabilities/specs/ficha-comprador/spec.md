# Spec Delta — ficha-comprador

## Purpose

Ficha del producto en WooCommerce: panel del comprador, galeria auto-montada, ciclo
carrito->pedido sin staging, soporte de invitado, validez por producto y descargas en
mi-cuenta.

## ADDED Requirements

### Requirement: Panel del comprador en la ficha
El sistema SHALL pintar el panel del comprador en `woocommerce_before_add_to_cart_form`
cuando el producto lleva `_pmu_pdf_slugs` y el PDF esta activo con grupos, y SHALL
ofrecer el shortcode `[pmu_personalizar pdf="slug"]`.

#### Scenario: Producto con PDF asociado
- **WHEN** un producto tiene `_pmu_pdf_slugs` y el PDF esta activo
- **THEN** se pinta el panel del comprador en la ficha

### Requirement: Galeria auto-montada
El sistema SHALL montar la galeria sola al quedar "completo" (predicado unico
`PURO.estaCompleto`) y repintarla al editar cada campo, sin boton "Vista previa".

#### Scenario: Montaje automatico
- **WHEN** los campos quedan completos
- **THEN** la galeria se monta sola sin intervencion del comprador

#### Scenario: Repintado al editar
- **WHEN** se edita un campo ya completo
- **THEN** la galeria se repinta

### Requirement: Ciclo carrito a pedido sin staging
El sistema SHALL crear/reutilizar el item en `tmp/sesion-{sid}/{item_key}/`, promoverlo a
`{cart_item_key}` al agregar al carrito y moverlo a `orders/{cliente}/{order_id}/{item_key}/`
al pagarse, con los originales en `orders/{cliente}/uploads/`, sin staging intermedio.

#### Scenario: Pago promueve el item
- **WHEN** se confirma el pago con `customer_id` valido
- **THEN** el item se mueve (rename) a `orders/{cliente}/{order_id}/{item_key}/`

#### Scenario: Invitado sin cliente
- **WHEN** el pedido es de invitado (`customer_id` = 0)
- **THEN** no promueve y deja causa visible

### Requirement: Invitado por cookie de sesion
El sistema SHALL autorizar los endpoints del comprador por la cookie `pmu_sid` para
invitados, ignorando el `sid` del POST, y SHALL adoptar los customs del invitado a
`orders/{cliente}/customs/` en la primera compra.

#### Scenario: Invitado sin cuenta
- **WHEN** un invitado agrega al carrito
- **THEN** se autoriza por `pmu_sid` y el `sid` del POST se ignora

### Requirement: Validez por producto
El sistema SHALL evaluar la expresion `validez` de cada asociacion PDFxproducto solo en el
navegador, validando el servidor unicamente su sintaxis al guardar, con `mensaje_html`
allowlist y `bloquear` opcional.

#### Scenario: Validez evaluada en el navegador
- **WHEN** la ficha evalua la validez de un producto
- **THEN** el resultado se calcula en el navegador y el servidor solo valido sintaxis

### Requirement: Minimos frenan la compra
El sistema SHALL deshabilitar "Agregar al carrito" con aviso unico cuando faltan minimos, y
el servidor SHALL contar los archivos reales del item en `carrito_validar` declarando
`pmu_minimos`.

#### Scenario: Minimo no alcanzado
- **WHEN** falta un minimo de fotos
- **THEN** el boton se deshabilita y el servidor declara `pmu_minimos`

### Requirement: Descargas en mi-cuenta
El sistema SHALL listar en `mi-cuenta/descargas/` una fila por PDF aceptado del snapshot,
generadas por `item_generar_pdfs` (idempotente) desde `manifest.archivos[]` con
`Motor::procesar_pedido`, sin usar un PDF descartado.

#### Scenario: Descarga idempotente
- **WHEN** se pide de nuevo la descarga de un PDF ya generado
- **THEN** `item_generar_pdfs` reutiliza el entregable sin recomputar