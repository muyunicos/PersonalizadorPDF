# 022 — Minimo de fotos obligatorio (el `min` frena la compra)

> Estado: **en implementacion (2026-10-19)** — cierra el hueco detectado al limpiar la tira del
> cargador (spec 021): el `min` de las ranuras se informaba pero **no bloqueaba nada**.

## Problema (verificado en el codigo)

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | El boton **"Listo"** de la 012 era **decorativo**: se creaba, se habilitaba/deshabilitaba y **no tenia handler**. Se retiro en la 021 | `cargador-pmu.js` (antes de la 021) |
| H2 | `api.estado[cid].listo` se **asignaba y nadie lo leia** | `tienda.js` (antes) |
| H3 | `carrito_validar()` valida que exista el draft (o el modo omisible), pero **no cuenta las fotos** | `personalizador-pdf.php` |
| **Consecuencia** | El comprador podia **agregar al carrito sin subir ninguna foto** aunque la ranura dijera `min: 1`: entraba un pedido que el admin no puede producir | — |

## Decisiones

| # | Decision |
|---|---|
| **D1** | **El `min` es una regla del negocio declarada en el `campo.js`** (las ranuras). El servidor **no evalua JS** (constitution §III), asi que no puede leer las ranuras por si mismo: el navegador **declara el total exigido por campo** y el servidor **cuenta los archivos reales** del item. El servidor **nunca** confia en "cuantas subi": confia en el `min` (la regla del admin) y cuenta `manifest.subidas[]`. |
| **D2** | **Doble red**: (a) el **cliente** deshabilita "Agregar al carrito" mientras falten fotos y muestra **un aviso** en la ficha; (b) el **servidor** (`carrito_validar`) **rechaza** el add-to-cart con `wc_add_notice` si el conteo real no alcanza el `min` declarado. |
| **D3** | **Declaracion**: el submit del carrito inyecta `pmu_minimos = {campo_id: min_total}` (entero, saneado y acotado). `min_total` es la **suma de los `min` de las ranuras** del campo (`CargadorPMU.estadoActual().minTotal`). |
| **D4** | **Conteo real**: para el campo `cid`, el servidor cuenta los ids de `manifest.valores[cid].valor` que **existen** en `manifest.subidas[].id` (un id sin archivo no cuenta). Si `reales < min_total` -> falta `min_total - reales` y se rechaza. |
| **D5** | **Sin `pmu_minimos` no se bloquea** (compatibilidad y fail-safe): un producto sin campos con cargador, o un flujo sin JS, sigue funcionando igual que hoy. |
| **D6** | **Aviso unico en la ficha**: `Faltan N foto(s) por cargar.` en el panel del comprador (mismo lugar que el aviso de validez de la 005). Con todo completo **no dice nada**. |
| **D7** | **Limitacion conocida y aceptada**: la regla es de **calidad del pedido**, no anti-fraude (un comprador no obtiene nada gratis). Un cliente manipulado podria declarar `min_total = 0`; para una regla infalsificable habria que **duplicar las ranuras** en `datos.json` (fuera de alcance: la 020 elimino esa duplicacion). Queda anotado como spec futura si el negocio lo pide. |

## Alcance

| Archivo | Cambio |
|---|---|
| `assets/cargador-pmu.js` | `estadoActual()` publica `minTotal` (suma de los `min` de las ranuras) |
| `assets/tienda.js` | `refrescarMinimos()`: bloquea el boton y pinta el aviso; el submit inyecta `pmu_minimos` |
| `personalizador-pdf.php` | `minimos_declarados()` + `minimos_faltantes()` y el rechazo en `carrito_validar()` |
| `tests/*` | `minTotal` (Node) + fase `carrito` (rechazo por minimos, caso real) |
| `specs/012.../contracts/campos.md`, `AGENTS.md`, `readme.txt` | contrato del `min` |

## Verificacion

- Node: `node tests/campos-contrato.test.js` (`minTotal`), `node tests/selector-contrato.test.js`,
  `node tests/mockup-contrato.test.js`, `node tests/conciliacion.js` (regresion).
- PHP: `php -l`, `php tests/texto_puente.php carrito` (declarar `min_total` con menos fotos
  reales -> **rechazo**; con las fotos -> pasa), `motor_smoke`, `parity`.
- WP real: ficha con `min: 1`, agregar al carrito **sin** foto -> boton deshabilitado y, forzando
  el submit, Woo muestra el aviso de error; con la foto -> compra normal.
