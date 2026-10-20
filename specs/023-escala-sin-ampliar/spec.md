# 023 — `escala: 'sin-ampliar'` (no agrandar la foto del comprador)

> Estado: **en implementacion (2026-10-19)** — cierra el pendiente que la spec 019 dejo fuera de
> alcance (D7: *"no ampliar la imagen exige tocar tambien el Motor"*).

## Problema

Cuando el hueco es mas grande que la foto, hoy la foto se **amplia** para encajar:

| Foto del comprador | Hueco del PDF | Hoy | Con `sin-ampliar` |
|---|---|---|---|
| 300 x 300 | 1000 x 500 | escala **3.33x** -> PNG 1000x500 (borroso) | escala **1x** -> la foto ocupa 300x300 **dentro** del lienzo 1000x500, centrada y con el resto transparente/color de fondo |
| 500 x 500 | 1000 x 500 | escala **2x** | escala **1x** -> 500x500 centrada |
| 2000 x 2000 | 1000 x 500 | escala 0.5x (reduce) | escala 0.5x (reduce: **no cambia**) |

El cliente ya avisa (`se amplia Nx`, spec 019) pero **no puede evitarlo**: es la calidad de
impresion la que se degrada.

## Hallazgo que cambia el alcance (verificado en el codigo)

La 019 anticipaba tocar el **Motor** (`engine/Imagen.php`) porque suponia que el PNG saldria mas
chico (300x150). **No es asi**: el lienzo de salida sigue midiendo **exactamente `W x H`** (el
tamano del hueco); lo que cambia es **cuanto ocupa la foto dentro** de ese lienzo.

- `Imagen::normalizar($ruta, $W, $H)` recibe un PNG de **`W x H`** y calcula
  `escala = min(W/W, H/H) = 1` -> **no re-amplia nunca**.
- El pool, el hash (`valor|preset|settings|WxH`), el Overlay y el Z-order **no cambian** (mismo
  tamano de PNG).

**Consecuencia: la spec es 100% cliente.** No se toca `engine/`, ni el pool, ni los datos, ni
`modules/textmuy/`. Si algun dia se quisiera un lienzo **menor** (300x150), ahi si habria que
tocar el Motor: queda explicitamente **fuera de alcance** (ver D6).

## Decisiones

| # | Decision |
|---|---|
| **D1** | **`escala` es una propiedad de la RANURA**: `'ampliar'` (default = comportamiento actual) o `'sin-ampliar'`. Un valor desconocido cae en `'ampliar'`. |
| **D2** | **`sin-ampliar` = la foto nunca se escala hacia arriba.** La escala base es `min(1, contain)`; si la foto es mas grande que el hueco **reduce igual** (min(1, ...) no altera una reduccion). |
| **D3** | **El lienzo/PNG sigue midiendo `W x H`.** Lo que queda libre alrededor se rellena con el **color de fondo** elegido (o transparente). Por eso el pool, el hash, el Overlay y el Motor **no se tocan** (ver "Hallazgo"). |
| **D4** | **UI en el modal**: con `sin-ampliar` los **3 modos y Girar se ocultan** (Rellenar y Estirar ampliarian por definicion) y el modo queda en **Ajustar**. El control **Reducir / Ampliar** se capa a `1x` (solo reduce). El badge dice **`sin ampliar`** para que el comprador entienda por que su foto no llena el marco. |
| **D5** | **El limite de ampliacion manual**: el slider no puede pasar de `1x` (es la regla del admin). El usuario sigue pudiendo **reducir**, mover y cambiar el color de fondo. |
| **D6** | **Fuera de alcance**: un PNG **mas chico** que el hueco (300x150). Exigiria tocar `engine/Imagen.php`, el Overlay y el contrato del pool; va aparte si el negocio lo pide. |
| **D7** | **Sin migracion** (norma de la spec 020): una ranura sin `escala` se comporta **exactamente** como hoy. |

## Alcance

| Archivo | Cambio |
|---|---|
| `assets/cargador-pmu.js` | `normalizarRanuras()`: normaliza `escala` (`'ampliar'` default) |
| `assets/tienda.js` | `PURO.normalizarRanura()`: idem (lo consume `montarCargador`) |
| `assets/selector-pmu.js` | config `escala`; escala base capada a 1; modos/Girar ocultos; slider capado; badge `sin ampliar`; funcion pura `escalaBase()` exportada en `SelectorPMU.puro` |
| `tests/*` | `escalaBase` (Node) + normalizacion de `escala` + UI (modos ocultos) |
| `specs/012.../contracts/campos.md`, `AGENTS.md`, `readme.txt`, `specs/019.../spec.md` (D7 cerrado) | contrato de la ranura v6 |

## Verificacion

- Node: `node tests/selector-contrato.test.js` (`escalaBase` pura: 300x300 en 1000x500 da
  300x300; foto grande reduce igual), `node tests/campos-contrato.test.js` (normalizacion),
  `node tests/mockup-contrato.test.js` y `node tests/conciliacion.js` (regresion).
- PHP: `php -l`, `php tests/texto_puente.php ficha` / `campo_subida` / `pedido` (el Motor **no**
  cambia: regresion), `php tests/motor_smoke.php`, `php tests/parity.php`.
- WP real: ranura con `escala: 'sin-ampliar'` y una foto de 300x300 en un hueco 1000x500 -> el
  modal no deja ampliar y el PDF final muestra la foto **nitida** centrada, con el resto
  transparente.
