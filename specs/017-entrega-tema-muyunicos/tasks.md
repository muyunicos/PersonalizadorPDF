# Tareas — 017 Entrega por el tema Muy Únicos

> Regla: **no marcar `[X]` por aproximacion**. Estado: **0/N `[X]`, en
> especificacion**. Depende del fix del staging (004, "A"), que va primero.

## Fase 0 - Bloqueante (004)

- [ ] **T000** Fix del ciclo del pedido: `pedido_item_crear` con identidad por
  cookie + `$clave` (cart_item_key) y logging del ciclo. Sin esto,
  `pedido_promover` no tiene item que promover y el adaptador no tiene donde
  publicar.

## Fase 1 - Deteccion y escritura de `_urls_files`

- [ ] **T001** Helper `tema_muyunicos_activo()`: `function_exists('mu_update_item_files')`
  (capacidad real del tema), cacheada en propiedad estatica.
- [ ] **T002** Helper `urls_files_item($order_id, $item_key, $pdfs)`: dado el
  pedido y sus PDFs aceptados, arma la URL protegida por PDF
  (`personalizador_pdf_item_descargar` + `order_id`/`item_key`/`pdf`/`clave` del
  `order_key`). D3/FR-002.
- [ ] **T003** Helper `publicar_urls_files($item, array $urls)`: lee `_urls_files`
  del item, **agrega** las URLs del plugin que no esten (idempotente, FR-005, no
  pisa las del admin) y `save()`. Usa `WC_Order_Factory::get_order_item`, sin
  llamar al interno del tema (D2).

## Fase 2 - Adaptador en la promocion

- [ ] **T004** En `pedido_promover`, tras promover el staging y generar el PDF
  (`item_generar_pdfs`), si `tema_muyunicos_activo()`, publicar las URLs via
  `publicar_urls_files` en cada item del pedido. Fail-safe (FR-007): una
  generacion fallida no tumba la promocion.
- [ ] **T005** En `descargas_cliente`, si `tema_muyunicos_activo()`, **no** inyectar
  filas propias (FR-003/D5). Sin tema, comportamiento actual intacto (FR-004).

## Fase 3 - Clase del gancho

- [ ] **T006** Clase `MuyUnicos_PDF_Generator::generate($order, $item, $image_id)`:
  resuelve item de sesion por meta `_pmu_item_key`/`_pmu_sid`, corre
  `item_generar_pdfs`, refresca `_urls_files` (reutiliza T002/T003). FR-006.

## Fase 4 - Pruebas

- [ ] **T007** Fase del arnés `entrega_tema`: stub del tema
  (`function_exists('mu_update_item_files')` = true via definicion en el stub),
  promover un pedido y exigir `_urls_files` con una URL por PDF **apuntando al
  endpoint propio** (FR-001/FR-002), sin duplicados (FR-005), y que
  `descargas_cliente` NO agregue filas propias (FR-003).
- [ ] **T008** Fase `entrega_sin_tema`: sin el stub, `descargas_cliente` entrega
  como hoy (FR-004) y `pedido_promover` no escribe `_urls_files`.
- [ ] **T009** Recorrido WP real con el tema activo: comprar -> marcar completado
  -> verificar `mi-cuenta/descargas/` y email (FR-001), y el boton "Generar PDF"
  del pedido (FR-006). Con tema desactivado, regresion de la entrega propia.

## Nota

El tema es un repo aparte (`muyunicos`). Este spec **solo** toca el plugin (este
repo). Si hiciera falta un cambio del lado del tema (p. ej. exponer mejor el
gancho), se documenta aca y se hace en el repo del tema por separado.
