# Spec 026 — Imagenes en WebP

> Estado: **especificada, sin implementar** (2026-10-20). Release prevista: 4.18.0.
> Ortogonal a la 027 (`transparencia-campo`): el alfa se preserva igual en PNG y WebP.

## 1. Problema

Todo el sistema guarda **PNG** (lossless, sin comprimir):

| Zona | N | Peso | Promedio |
|---|---|---|---|
| `sesion/pool img/` | 62 | 19.4 MB | 320 KB |
| `sesion/subidas/` | 2 | 2.6 MB | **1.3 MB** (foto original del movil) |

Un WebP quality 0.85 de esa misma foto pesa **~120 KB** (≈10x menos). El costo se
paga **dos veces**: en el ancho de banda de subida (el PNG viaja por la red) y en
el espacio en disco.

## 2. Decisiones

| # | Decision |
|---|-----------|
| **D1** | El formato de salida lo decide el **cliente** (`canvas.toBlob('image/webp', q)`). Es la via natural: el navegador ya rasteriza, y el PNG **no viaja por la red**. |
| **D2** | **Fallback por firma, nunca por etiqueta**: si el navegador no codifica WebP, `toBlob('image/webp')` cae a **PNG en silencio**. El formato se deduce de los **bytes** (`PMU_Sesion::firma_imagen()` ya lo hace), nunca del nombre que manda el cliente. |
| **D3** | El **servidor** recodifica con GD como **red de seguridad** (por si el cliente mando PNG). Solo si existen `imagewebp` + `imagecreatefromwebp` (el smoke ya lo exige: *"GD + WebP (cargador de imagenes)"*). Sin GD -> se guarda el original (fail-safe, nunca se rompe). |
| **D4** | **Calidades por tipo de contenido**: `0.85` para las fotos del comprador (`subidas/`, unseen al usuario, ahorro maximo); `0.92` para el **pool** (el texto renderizado tiene bordes con antialias: degradarlos produciria halos). La conversion del servidor usa `0.92` (conservadora). |
| **D5** | **Nunca JPEG** en el pool ni en las subidas: no tiene canal alfa y perderia el fondo transparente (ver la 027). |
| **D6** | **El Motor no cambia**: `engine/Imagen.php` ya decodifica WebP via GD (`imagecreatefromstring`) y arma el mismo spec `raster` (rgb + alpha separados -> SMask). El PDF resultante es **estructuralmente identico**. |
| **D7** | La conversion **nunca cambia las dimensiones**: el PNG mide `min(recorte, hueco)` (spec 025) y el WebP hereda ese tamano exacto. |
| **D8** | **Sin migracion**: la lectura del PDF usa `manifest.archivos[].file` (ya lee la extension del manifest, no la reconstruye). Los items viejos (PNG) se siguen leyendo: el Motor acepta ambos formatos. |
| **D9** | El **pool** y las **subidas** conservan su estructura de nombres: `{pdf}-{id}-{n}.{ext}` y `{id}.{ext}`. Solo cambia la extension, que **ya se derivaba de la firma**. |
| **D10** | `meta.type` deja de estar forzado a `image/png` (bug menor actual en `selector-pmu.js`): refleja el tipo real del blob. |

## 3. Cambios por archivo

### Cliente
| Archivo | Cambio |
|---|---|
| `assets/selector-pmu.js` | `toBlob(cb, 'image/webp', 0.85)` + fallback a PNG si el blob no es WebP (firma `RIFF/WEBP`) |
| `assets/tienda.js` (`rasterizar`) | idem, q0.85 |
| `assets/tienda.js` (`subirPool`) | nombre del form segun el blob + flag `webp=1` |
| `assets/cargador-pmu.js` | `meta.type` usa el tipo real del blob |

### Servidor
| Archivo | Cambio |
|---|---|
| `inc/class-pmu-sesion.php` | nuevo `convertir_webp($bytes, $q)`; `guardar_png()` -> `guardar_imagen()` (extension desde la firma); `siguiente_n()` y `limpiar_grupo()` aceptan `*.{png,webp,jpg,gif}`; `guardar_subida()` convierte |
| `personalizador-pdf.php` | `handle_pool_png` **deja de rechazar WebP** (valida por firma: PNG o WebP) y convierte |

### Motor / contrato
- `engine/Imagen.php` — **sin cambios**.
- `specs/004.../contracts/sesion-item.md` — actualizar la firma de `guardar_png()`.

## 4. Puertas

- `tests/texto_puente.php`: fase `pool` (acepta WebP + convierte), `sesion` (extension real + numeracion mixta), `subida` (webp + fallback sin GD).
- `tests/selector-contrato.test.js` / `tests/campos-contrato.test.js`: "el selector emite WebP con fallback PNG" y "`meta.type` refleja el tipo real".
- `tests/motor_smoke.php`: check nuevo — el Motor normaliza un **WebP con alfa** y produce el mismo SMask que el PNG equivalente.

## 5. Fuera de alcance

- **Miniaturas para el movil** (el movil hoy descarga el PNG original de 1.3 MB para
  pintar una miniatura de ~150 px): seria una fase aparte.
- **`modules/textmuy/`**: el RenderCore emite PNG y el servidor lo convierte (repo
  propio: no se toca).
