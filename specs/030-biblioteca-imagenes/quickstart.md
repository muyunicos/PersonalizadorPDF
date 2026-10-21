# Quickstart — Spec 030 (validacion de la biblioteca)

> Fase 1 de `/speckit-plan`. Recorrido minimo para probar la feature de punta a punta.
> Contratos: [biblioteca.md](./contracts/biblioteca.md) y [cliente-biblioteca.md](./contracts/cliente-biblioteca.md).
> Modelo: [data-model.md](./data-model.md). Decisiones: [spec.md](./spec.md).

## Prerequisitos

- WP + Woo con un producto vinculado a un PDF activo, con al menos un grupo y un campo de imagen con cargador.
- Al menos un pedido **pagado** del mismo comprador (para el lado `orders/`).
- `uploads/pmu/` escribible (y con los datos del admin cargados).

## E1 — Puertas automaticas (CLI, desde la raiz del repo)

| Comando | Esperado |
|---|---|
| `php -l personalizador-pdf.php` y `php -l inc/class-pmu-sesion.php` | sin errores de sintaxis |
| `php tests/texto_puente.php biblioteca` | `BIBLIOTECA OK` |
| `node tests/selector-contrato.test.js` | `SELECTOR CONTRATO OK` |
| `php tests/motor_smoke.php` | `SMOKE OK` (el Motor no cambio) |
| `php tests/parity.php` | `PARIDAD OK` |
| `php tests/sin_lectura.php` | `SIN_LECTURA OK` (leer la galeria no escribe catalogos) |

La fase `biblioteca` cubre: identidad (invitado y registrado), familia ajena (`madre` ajena), elegir sin cambios (0 bytes),
version, consolidacion con idempotencia, `ref` resuelto en el PDF, `ref` roto, una entrada por familia,
`revision`/`sin_cambios`, `op=imagen` cacheada, tope de 10 contenedores, dedupe por `sha`, borrado de la familia con aviso y TTL.

## E2 — Galeria del invitado (ficha, sin cuenta)

1. En una ventana nueva (sin cookies) subir una foto en el campo de imagen y agregar al carrito.
2. Volver a la ficha y abrir el modal de recorte del **mismo** campo.
3. Esperado: la tira muestra **una** imagen (la `base`), **primero** por ser la mas reciente; en la consola de red hay **una**
   peticion `op=listar`; al reabrir el modal, **0** peticiones (revalidacion `sin_cambios`).

## E3 — Reusar sin recomponer (0 bytes)

1. Abrir la ficha de un segundo producto con el mismo hueco y abrir el modal.
2. Esperado: aparece la imagen de E2 y el boton dice **Elegir**; al pulsarlo el hueco se llena **sin
   subir bytes** (solo `op=usar` en la red) y el `manifest.subidas[]` del nuevo item queda con `origen: ref`.

## E4 — Reusar recomponiendo (version)

1. Usar la misma foto en un hueco de **otra proporcion** (o cambiar escala o desplazamiento).
2. Esperado: el boton dice **Subir**; se sube `{madre}-2.webp` al item; la galeria sigue mostrando **una**
   entrada (badge `2 versiones`) y el `base` pasa al de mayor resolucion (flag, **sin** `rename`).

## E5 — Consolidacion de un pedido con dos items

1. Agregar al carrito los dos productos con la misma foto y pagar (o pasar el pedido a `processing`).
2. Esperado en disco: `orders/{order_id}/_comun/{madre}-{n}.{ext}` **una sola vez**; los dos items con
   filas `{origen: ref, ref: ../_comun/...}`; el PDF se genera igual.
3. Re-guardar el estado del pedido: **idempotente** (no se duplica `_comun` ni se reescriben rutas).

## E6 — Dedupe, aviso de borrado y TTL

1. Subir **la misma** foto otra vez desde el equipo: se **reusa** la familia (no aparece una segunda entrada).
2. En el visor pulsar **Borrar**: el aviso nombra el carrito o el pedido que la usa; al confirmar
   desaparecen la original y sus versiones, y la tira se actualiza **sin** volver a pedir todo.
3. Un draft sin agregar se barre a las 24 h (con sus fotos); un item de **carrito abandonado** vence a los
   30 dias (D26); `orders/` **no** se toca nunca.

## E7 — Regresion (lo que no debe cambiar)

- `php tests/texto_puente.php fotos` y `php tests/texto_puente.php pool` siguen verdes: en `tmp/` nada cambio.
- El preview de la consola **no** dibuja la tira y no abre peticiones (sin endpoint en el stub).
- Sin bloques nuevos en la ficha: el mockup obligatorio y el add-to-cart siguen igual (§I).

## E8 — Medicion de volumen (criterio de D23)

1. Sembrar 300 pedidos del mismo comprador (o reusar datos reales) y abrir el modal desde un campo.
2. Esperado: **una** peticion `op=listar` en **<= 1,5 s**; las aperturas siguientes con `desde=<revision>`
   responden `sin_cambios` y **no** viaja la lista; las imagenes salen del cache del navegador (0 peticiones).
3. Si se supera el criterio: anotar el numero real y abrir **P2/P4** antes de dar por cerrada US1.
