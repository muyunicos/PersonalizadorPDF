# Plan — Ejecutar la revisión de la exclusión de categorías del feed de Google

> Modo REVISIÓN (solo lectura / diagnóstico). **No editar, no commitear, no pushear, no desplegar.**
> Entregable: informe Markdown con hallazgos (severidad, archivo:línea, evidencia, impacto, fix
> propuesto) + veredicto de optimización + lista de verificaciones no corridas y por qué.
> Responder en español (código sin tildes). Shell: PowerShell 7 (`pwsh`), secuenciar con `;`.

## 0. Hallazgos ya resueltos en el reconocimiento (no requieren runtime)

- Repo del tema: `C:\Users\Jonatan\Documents\GitHub\muyunicos` (child de GeneratePress).
  `git status --short` → ` M functions.php`, ` M inc/feed-google.php`, `?? inc/feed-exclusion.php`.
- `mu_load_module()` carga `inc/{modulo}.php` con `require_once` (functions.php:351). `feed-exclusion`
  se carga tras `feed-google` (functions.php:374). OK.
- `digital-restriction.php` engancha `pre_get_posts` a prioridad 50 (`filter_product_queries`,
  línea 120) y `get_terms_args` (122). `country-scope.php` NO filtra queries de productos (solo
  `template_redirect` y `rank_math/sitemap/entry`).
- `seo-noindex-categorias.php` lista `tienda-juegosparawii` pero **NO** `outlet` ni `stickers`
  → hay **dos listas divergentes** (noindex vs feed). Señalar (Q22), no decidir.
- Lab `C:\wp-lab\wordpress`: tema child por junction al repo; WooCommerce activo; **Google for
  WooCommerce AUSENTE**; **sin WP-CLI**. → Los filtros `woocommerce_gla_*` y los `wp eval` NO se
  pueden verificar en el lab (solo hosting real o WP-CLI remoto).

## 1. Fase A — Estática (correr ahora, sin WP)

1. `php -l` de `inc/feed-exclusion.php`, `inc/feed-google.php`, `functions.php`.
2. `git -C <repo> diff --check` (EOL/espacios; repo mezcla CRLF/LF).
3. Lectura dirigida de `inc/feed-exclusion.php` contra el checklist §3 del handoff:
   - ABSPATH (Sí, línea 15) · `is_wp_error` en `get_term_by`/`get_term_children` (Sí) ·
     `method_exists` en filtros (Sí) · `array_map('intval')` (Sí) · docblocks sin `*/` anidado.
   - `suppress_filters=true` conserva `tax_query` (correcto por diseño WP) y desactiva
     `pre_get_posts` → la query de exclusión NO hereda `digital-restriction` (deseado).
   - `include_children=false` + expansión manual vía `get_term_children` (cubre nietas).
4. Lectura cruzada de interacción:
   - `mu_feed_google_item()`: exclusión antes de `wc_get_product` (feed-google.php:195) → no rompe
     variable/`is_visible`/precio WCPBC/override `?wcpbc-manual-country` (se retorna '' antes).
   - `mu_feed_google_build()` itera todos los productos y llama `mu_feed_google_item` por cada uno
     (O(1) por producto); evaluar exclusión en la query (`tax_query NOT IN`) como optimización.
   - `mu_feed_google_flush_cache` (feed-google.php:355) limpia `pmu_feed_{code}` en
     `save_post_product`/`woocommerce_update_product`; `feed-exclusion` limpia sus 2 transients en
     los mismos hooks + `edited/create/delete_product_cat`. Revisar cobertura de altas/bajas masivas
     (WP-CLI/REST/import) y `before_delete_post`/`wp_update_term`.

## 2. Fase B — Runtime (solo si se puede; si no, listar como "no corrida")

- Feed propio por HTTP (si el lab está encendido, o hosting con aprobación de lectura):
  `curl.exe -s "http://<lab>/feed-google.xml" | Select-String -Pattern "Sticker|Outlet|Wii"`
  (purgar transient o esperar 1 h). No debe listar productos de esas categorías.
- WP-CLI (`wp eval`) para slugs/ids/lookup, `has_filter(...)`, y `timer_start/timer_stop`:
  **no disponible** (sin WP-CLI, plugin GFW ausente en lab) → documentar como no corrido y proponer
  cómo (hosting con WP-CLI o activar el plugin en el lab).
- Conteo de queries (`SAVEQUERIES`) y memoria de `array_fill_keys`: **no medible** sin WP → queda
  como propuesta de medición.

## 3. Fase C — Negocio (señalar, no decidir)

- `outlet`/`stickers` son categorías core: excluirlas del feed puede ser error de negocio.
- Divergencia de listas noindex vs feed-exclusion (centralizar o documentar).

## 4. Entregable (informe Markdown)

- Tabla: `# | severidad | archivo:línea | evidencia | impacto | fix propuesto`.
- Veredicto de optimización (con lo medible; lo no medible, marcado).
- Verificaciones no corridas y motivo (WP-CLI ausente, plugin GFW ausente en lab).
- Sin aplicar cambios.

## 5. Validación

- El informe cita rutas reales y líneas verificadas; los hallazgos de runtime se declaran como
  "no verificados" con el método propuesto. No se toca el árbol del repo (git status intacto).