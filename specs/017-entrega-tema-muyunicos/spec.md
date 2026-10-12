# 017 — Entrega por el tema Muy Únicos (adaptador opcional `_urls_files`)

> Estado: **en especificacion** (sin implementar). Decision del negocio 2026-10-12:
> el tema `muyunicos` (`generatepress-child`) ya tiene, **validado en produccion**,
> la capa de entrega digital (edicion en admin del pedido, listado en
> `mi-cuenta/descargas/`, email con links). Este spec define como el plugin
> **reaprovecha** esa capa cuando el tema esta activo, en vez de duplicarla, sin
> romper la autonomia del plugin cuando no esta.

## Problema

El plugin ya trae su propia capa de entrega (`descargas_cliente`,
`item_generar_pdf`, `handle_item_regenerar`, pestana Pedidos). Funciona, pero
**duplica** lo que el tema resuelve y mantiene desde antes. Ademas, el ciclo
propio falla en WP real (bug del staging del checkout; ver §Dependencia),
mientras que la entrega del tema **anda**.

Lo que el tema tiene resuelto y en uso:

| Capacidad | Donde (tema `muyunicos`) | Como |
|---|---|---|
| Editar archivos del pedido en admin | `inc/orders-files.php` | celda por item + dropzone/Biblioteca + modal; AJAX `mu_upload_file`/`mu_add_media_file`/`mu_delete_file`/`mu_generate_pdf` sobre la meta `_urls_files` del **order item** |
| Mostrar en `mi-cuenta/descargas/` | `inc/orders-files.php` + `downloads-bonus.php` | `woocommerce_account_downloads_endpoint` + `woocommerce_customer_get_downloadable_products` listan `_urls_files` |
| Enviar por email el descargable | `inc/orders-files.php` + `downloads-bonus.php` | `woocommerce_email_order_details` en `customer_completed_order`/`customer_invoice` |
| Estado "En Produccion" + aviso | `inc/orders-workflow.php` | `register_post_status('wc-production')` + email |

Todo confluye en **una meta del order item: `_urls_files`** (array de URLs). Ese
es el punto de acoplamiento natural.

Y hay un gancho ya preparado por el tema y **sin definir**:

```php
// inc/orders-files.php (tema), boton "Generar PDF" del pedido:
if ( class_exists( 'MuyUnicos_PDF_Generator' ) && $item ) {
    MuyUnicos_PDF_Generator::generate( $item->get_order(), $item, $image_id );
}

## Decisiones

- **D1 — Adaptador opcional, no reemplazo.** Si el tema esta activo
  (`function_exists('mu_update_item_files')`, la helper real del tema), el plugin
  publica el PDF en `_urls_files` del item. Si no, cae al comportamiento propio
  actual (`descargas_cliente` / `handle_item_descargar`). **El plugin sigue siendo
  portable.**
- **D2 — El plugin no lee la entrega del tema para generar.** Solo **escribe**
  `_urls_files` con la URL de su propio endpoint protegido. No consume los AJAX
  del tema ni su logica de bonus; evita acoplamiento inverso.
- **D3 — URL protegida, no archivo crudo.** A diferencia del tema (que sirve URLs
  directas de `uploads/`), el plugin publica en `_urls_files` la URL de SU
  endpoint `personalizador_pdf_item_descargar` (con `order_key`). Asi el email y
  `mi-cuenta/descargas/` del tema entregan por un enlace que **verifica dueno**.
  Trade-off consciente: la URL lleva el `order_key` (no es un `uploads/` crudo).
- **D4 — Cuando publicar.** En `pedido_promover` (al confirmarse el pago) el
  plugin genera el PDF del item (`item_generar_pdfs`) y escribe la URL en
  `_urls_files`. Asi el email de `customer_completed_order` ya lo lleva. Encaja
  con el estado "En Produccion": el admin trabaja y al completar se entrega.
- **D5 — Sin doble fila.** Con el adaptador activo, el plugin **no** inyecta su
  propia fila en `woocommerce_customer_get_downloadable_products` (lo hace el
  tema via `_urls_files`), para no duplicar la descarga. Sin tema, se mantiene la
  inyeccion propia.
- **D6 — `MuyUnicos_PDF_Generator` (integracion puntual).** El plugin define esa
  clase: `generate($order, $item, $image_id)` llama al motor con el pool del item
  y refresca `_urls_files`. Conecta por donde el tema **ya espera**, sin que el
  plugin dependa del tema para vivir.

## Requisitos funcionales

- **FR-001** Con el tema activo, al confirmarse el pago el plugin DEBE escribir
  en `_urls_files` del order item la URL de descarga del PDF procesado (una por
  PDF aceptado del snapshot).
- **FR-002** La URL publicada DEBE apuntar al endpoint propio
  `personalizador_pdf_item_descargar` con `order_id`/`item_key`/`pdf`/`clave`
  (D3). No se publican rutas crudas de `uploads/`.
- **FR-003** Con el tema activo, el plugin NO DEBE inyectar filas propias en
  `woocommerce_customer_get_downloadable_products` (D5); la descarga la entrega
  el tema desde `_urls_files`.
- **FR-004** Sin el tema activo, el comportamiento DEBE ser el de hoy, intacto
  (D1): `descargas_cliente` + `handle_item_descargar`. Cero regresion.
- **FR-005** El adaptador DEBE ser idempotente: re-promover o regenerar no
  duplica filas en `_urls_files`.
- **FR-006** `MuyUnicos_PDF_Generator::generate()` DEBE existir cuando el plugin
  este activo y, dado un item con pool, producir el PDF y refrescar `_urls_files`.
- **FR-007** Si la generacion falla (pool vacio, item ausente), el adaptador NO
  debe tumbar la promocion del pedido (fail-safe, coherente con 004/T022).

## Fuera de alcance

- **Reescribir la entrega del tema.** No se toca `inc/` del tema; el plugin solo
  escribe la meta y provee la clase del gancho.
- **La UI de admin del tema** (dropzone, modal, "Generar PDF"): ya existe; no se
  reimplementa. A lo sumo se documenta que el boton depende de FR-006.
- **El estado "En Produccion"** y sus emails: son del tema; el plugin no los
  registra.

## Dependencia con el bug del staging (004)

Este spec **asume** el fix del ciclo del pedido (identidad por cookie + `$clave`
en `pedido_item_crear`, el "A"): sin staging, `pedido_promover` no tiene item que
promover y el adaptador no tendria donde publicar. El fix va primero; este spec
va despues. Queda registrado para que no se mezclen en un mismo cambio.

## Verificacion

- Arnés: fase nueva `entrega_tema` (con stub del tema: `_urls_files` escrito al
  promover, sin doble inyeccion en `descargas_cliente`) y fase
  `entrega_sin_tema` (regresion: hoy intacto).
- Lab/WP real: compra de prueba con el tema activo -> marcar completado ->
  aparece en `mi-cuenta/descargas/` **y** en el email, servido por el endpoint
  protegido; el boton "Generar PDF" del pedido funciona (FR-006).
- Regresion: con el tema desactivado, `descargas_cliente`/`handle_item_descargar`
  siguen entregando.

```

Hoy responde *"Generador PDF no activo"*. Ese "alguien" que falta es **nuestro
motor**.

## Lo que NO se toca

- El **motor** (`engine/`): deteccion de placeholders + overlay + encajado. Es el
  activo; el tema no tiene nada equivalente.
- La **vista previa** del comprador, el pool del item y la sesion: son previos a
  la entrega y no dependen del tema.
