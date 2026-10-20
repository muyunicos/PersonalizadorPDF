# Tasks — spec 026 (imagenes en WebP)

## US1 — El cliente emite WebP

- [X] **T001** `assets/selector-pmu.js`: `toBlob(cb, 'image/webp', 0.85)` con
      **fallback a PNG** si el blob no es WebP (se deduce de la firma `RIFF/WEBP`).
- [X] **T002** `assets/tienda.js` (`rasterizar`): idem, q0.92.
- [X] **T003** `assets/tienda.js` (`subirPool`): el nombre del form sale del tipo
      real del blob (`gid.webp` / `gid.png`) + flag `webp=1`.
- [X] **T004** `assets/cargador-pmu.js`: `meta.type` refleja el tipo real del blob
      (D10: hoy esta forzado a `image/png`).

## US2 — El servidor acepta y convierte

- [X] **T005** `inc/class-pmu-sesion.php`: `convertir_webp($bytes, $q)` — WebP
      pasa tal cual; PNG/JPEG -> WebP si hay GD+`imagewebp`; sin GD -> original.
- [X] **T006** `inc/class-pmu-sesion.php`: `guardar_png()` -> `guardar_imagen()`:
      la extension sale de la **firma** (`{pdf}-{id}-{n}.{ext}`).
- [X] **T007** `inc/class-pmu-sesion.php`: `siguiente_n()` y `limpiar_grupo()`
      aceptan `*.{png,webp,jpg,gif}` (si no, la numeracion pisa archivos).
- [X] **T008** `inc/class-pmu-sesion.php`: `guardar_subida()` convierte y registra
      `mime`/`bytes` reales.
- [X] **T009** `personalizador-pdf.php` (`handle_pool_png`): **deja de rechazar
      WebP** (valida por firma: PNG **o** WebP) y convierte (D3).

## US3 — Motor y contrato

- [X] **T010** `engine/Imagen.php`: **sin cambios** (D6) — verificado con un check
      en `motor_smoke.php` (el Motor normaliza WebP con alfa y produce el mismo
      SMask que su PNG).
- [X] **T011** `specs/004.../contracts/sesion-item.md`: actualizar la firma de
      `guardar_png()` -> `guardar_imagen()`.

## US4 — Puertas

- [X] **T012** `tests/texto_puente.php` fase `pool`: acepta WebP, convierte y
      `file` trae la extension real.
- [X] **T013** `tests/texto_puente.php` fase `sesion`: `guardar_imagen()` +
      numeracion mixta (PNG y WebP en el mismo grupo).
- [X] **T014** `tests/texto_puente.php` fase `campo_subida`: WebP + el **alfa
      sobrevive** la conversion (127 -> 127).
- [X] **T015** `tests/selector-contrato.test.js` + `tests/campos-contrato.test.js`:
      "el selector emite WebP con fallback PNG" y "`meta.type` real".
- [X] **T016** `tests/motor_smoke.php`: el Motor normaliza un **WebP con alfa** y
      produce el mismo SMask que el PNG equivalente.

## US5 — Docs / release

- [X] **T017** `AGENTS.md` §5 + §7, `readme.txt` (4.18.0), `specs/INDICE.md`.

## Notas

- **Defensa en profundidad (D3)**: el cliente solo envia WebP si
  `PMU_FICHA.webp_soportado` (`PMU_Sesion::servidor_lee_webp()`) lo permite. Si
  llegara un WebP ilegible, `convertir_webp()` lo **rechaza** con
  `motor:imagen:webp:no_soportado`: sin GD el Motor no podria decodificarlo y el
  PDF saldria roto. Es preferible un error claro a un PDF ilegible.
- **`hash_pool` no cambia** (D8): el hash sigue siendo `valor|preset|settings|WxH`,
  asi que un item con un PNG viejo en el pool **reutiliza** ese hash; el archivo
  se lee igual (el Motor acepta ambos formatos).
- **`modules/textmuy/` no se toca**: el RenderCore emite PNG y el servidor lo
  convierte (es un repo propio).
