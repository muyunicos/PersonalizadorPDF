# Plan — 017 Entrega por el tema Muy Únicos

## Alcance

Dos archivos de codigo y el arnés. **No** toca el motor, la sesion, la vista
previa ni el pool: solo la capa de entrega (promocion del pedido -> `_urls_files`)
y la clase del gancho `MuyUnicos_PDF_Generator`.

| Archivo | Cambio |
|---|---|
| `personalizador-pdf.php` | adaptador en `pedido_promover` (escribe `_urls_files` si el tema esta activo), supresion de la inyeccion propia en `descargas_cliente`, clase `MuyUnicos_PDF_Generator` |
| `tests/texto_puente.php` | fases `entrega_tema` / `entrega_sin_tema` |

## Deteccion del tema

Deteccion por **capacidad, no por slug**: `function_exists('mu_update_item_files')`
(el tema la define en `inc/orders-files.php`). Si existe, el adaptador actua; si
no, comportamiento propio intacto (FR-004). Es mas robusto que comparar
`get_stylesheet()`, que cambia si renombran la carpeta.

## Como se escribe `_urls_files` sin acoplarse

El plugin escribe la meta del order item con la API estandar de Woo
(`WC_Order_Factory::get_order_item` + `update_meta_data('_urls_files', ...)` +
`save()`), **no** llamando a `mu_update_item_files()` (esa es AJAX de admin). Asi
el plugin no depende del interno del tema, solo del **contrato de la meta** (D2).
Se respeta lo que ya haya: se **agregan** las URLs del plugin si no estan
(idempotente, FR-005) sin pisar archivos que el admin subio a mano.

## La clase del gancho (D6 / FR-006)

`MuyUnicos_PDF_Generator::generate($order, $item, $image_id)`:
1. resuelve el item de sesion por `item_key`/`sid` (meta `_pmu_item_key`/`_pmu_sid`
   del item Woo);
2. corre `item_generar_pdfs($order_id, $item_key)`;
3. refresca `_urls_files` con la URL protegida (mismo helper que el adaptador).

Se define **siempre** que el plugin este activo: no depende del tema. Si el tema
no esta, la clase queda disponible pero nadie la llama (no rompe nada).

## Orden de ejecucion

1. **Antes**: fix del staging (004, "A"). Sin el, no hay item que promover.
2. Helper de deteccion + escritura de `_urls_files` (una funcion, con `php -l`).
3. Adaptador en `pedido_promover` + supresion de inyeccion en `descargas_cliente`.
4. Clase `MuyUnicos_PDF_Generator`.
5. Fases del arnés (`entrega_tema` / `entrega_sin_tema`).
6. Recorrido WP real con el tema activo.

## Riesgos

- **Doble fila de descarga** si ambos entregan: lo evita D5/FR-003 (el plugin no
  inyecta cuando el tema esta). Lo cubre la fase `entrega_tema`.
- **Pisar archivos del admin** en `_urls_files`: el adaptador **agrega**, no
  reemplaza el array (FR-005). Verificado en la fase.
- **Promocion que falla la generacion**: fail-safe (FR-007); el pedido se promueve
  igual y la descarga se regenera al pedirla.
- **El `order_key` en la URL (D3)**: es un trade-off vs. la URL directa del tema.
  Si se decide cambiar a URL cruda, es una linea; queda documentado en el spec.
