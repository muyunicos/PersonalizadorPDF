# Plan — 014 Comprador invitado

## Alcance

Un archivo de codigo y el arnés. **No** cambia el motor, los datos ni el panel del
comprador: solo quien puede llamar a los endpoints que ya existian.

| Archivo | Cambio |
|---|---|
| `personalizador-pdf.php` | `sesion_del_comprador()` + los 4 handlers del comprador |
| `tests/texto_puente.php` | fases `invitado` / `invitado_ajeno`; `pool` y `pool_reem` fijan la cookie |

## Por que "cookie" y no "otra capacidad"

Habian tres salidas posibles y esta es la que no inventa nada:

1. **Exigir `read` menos** (bajar a `read` -> nada): deja el flujo abierto.
2. **Crear una capacidad propia** (`pmu_pedido`): obliga a que el item se vincule a
   una cuenta, o sea que **tambien** rompe el checkout sin cuenta, que es lo que
   se quiere arreglar.
3. **Usar la cookie de sesion**: ya existe (`PMU_Sesion`), ya acota el disco, ya
   esta en el modelo de capacidades que el admin acepto. Solo hay que dejar de
   leer el `sid` del POST.

## Orden de ejecucion

1. El helper, con el nonce ya verificado por el caller (no se re-verifica).
2. Los cuatro handlers, uno por vez, con `php -l` despues de cada uno.
3. Las fases del arnes, antes de tocar el navegador: el fallo sale mas barato en
   PHP que en Playwright.
4. El smoke del invitado, que es el que prueba el requisito real.

## Riesgos

- **Un item creado con la cookie A ySubmitteado con la cookie B** deja de
  funcionar. A proposito: es exactamente el caso que se cierra. El error es
  `motor:sesion:item:ajeno`, no un 500.
- **Cookie perdida o bloqueada**: `sid_actual()` emite una nueva y el `item_key`
  que el cliente tiene en memoria no va a aparecer. Mismo sintoma que antes
  ("item ausente") y el remedy sigue siendo recargar la pagina.
- **Sesion abierta y luego el visitante se loguea**: la cookie no cambia, asi que
  el item sigue siendo suyo. No hay transicion que gestionar.