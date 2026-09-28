# Archivo 007-pmu-pdf-layout (ARCHIVADO 2026-09-16)

Spec historico: pedia `metadata.json` como unica fuente (derogado por norma
ex-008: `analisis.json`+`config.json`, ver `constitution` §IV + decision preview
2026-09-17 con `preview_omisible`).

Se conserva lo valioso como notas (origen: `research.md` D1/D3/D4/D5/D6/D9/D10/D11):

- **D1 (clave grupo)**: `id` = color hex sin `#` (`^[0-9A-F]{6}$`), campos planos
  `default`/`value`/`preset`/`config` (+ `w`/`h` px base 200, `cont`, `pgs`).
  Sin `letra`/`color`, sin bloque anidado, sin `activo` por grupo.
- **D3 (placeholders al vuelo)**: 0 PNG en disco; marco en consola + descarga
  `PngWriter::bytes(w,h)` por stream.
- **D4 (destinos)**: `tmp/muestras/{pdf}/` idempotente (sobrescribe);
  `tmp/sesion-{sid}/{item_key}/` + `manifest.json` (una linea = un directorio);
  `tmp/orders/` staging; `orders/` solo por `rename()` al pago.
- **D5 (rutas)**: `PMU_Uploads` dueno unico (sin `base()`/`subdir()` en el plugin);
  `motor:<op>:directorio:no_escribible` con causa.
- **D6 (consola sin 500)**: escritura atomica + lectura tolerante + `try/catch`
  en `presets_base()`/`render_page()`/`enqueue_assets()`; aviso con causa, HTTP 200.
- **D9 (selector)**: lista `pdfs/*/{nombre}.pdf`, ignora sueltos (`muestra.pdf` fixture).
- **D10 (limpieza)**: borrar PDF = `pdfs/{nombre}/` + `tmp/muestras/{nombre}/`;
  `tmp/cart|orders` por TTL; `orders/` nunca se toca desde consola.
- **D11 (tests)**: `texto_puente.php` + fases (`contenido`, `placeholder`, `admin`);
  `motor_smoke`/`parity` se mantienen.

Descartado: D2 (`metadata.json` unica fuente), D7 (migracion `.migrado-007`,
ya retirada), D8 (merge al re-analizar con dataset unico).

Documentos originales copiados tal cual: `research.md`, `data-model.md`,
`quickstart.md`, `checklists-requirements.md`, `rutas-pmu-v2.md`.
