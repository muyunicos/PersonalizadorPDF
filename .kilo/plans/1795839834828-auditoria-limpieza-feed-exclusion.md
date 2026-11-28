# Plan — Auditar/limpiar y documentar los cambios del feed de Google (antes de pushear)

> Repo: tema `muyunicos` (`C:\Users\Jonatan\Documents\GitHub\muyunicos`).
> Cambios sin commitear: `M functions.php`, `M inc/feed-google.php`, `?? inc/feed-exclusion.php`.
> Objetivo ya logrado: AR = todos menos 3 cats; subdominio = solo digitales menos 3 cats.
> Esta pasada: limpiar duplicado/optimizable y documentar. **No pushear** (deploy por webhook).
> Shell: PowerShell 7. Editar con herramienta de edicion (anclas de 1 linea; EOL mixto:
> `feed-google.php`/`functions.php` = CRLF, `feed-exclusion.php` = LF).

## 1. Auditoria (hallazgos)

| # | Tipo | archivo:linea | Detalle | Decision |
|---|------|---------------|---------|----------|
| A1 | Consistencia (medio) | `feed-exclusion.php:141-149` + `feed-google.php:355` | `mu_feed_exclusion_flush_cache()` no limpia el cache del feed `pmu_feed_*`. Tras editar una categoria (agregar/quitar productos sin `save_post`), el XML queda stale hasta 1 h. | **Limpiar** (fix 1) |
| A2 | Duplicado (bajo) | `feed-google.php:355-364` | El loop `foreach(muyu_get_countries_data()) delete_transient('pmu_feed_'.$code)` conviene extraerlo a un helper reutilizable. | **Limpiar** (fix 1) |
| A3 | Optimizable (bajo) | `feed-google.php:285-307` | `mu_feed_google_build()` trae todos los IDs y descarta excluidos en `mu_feed_google_item` (O(1)). Se puede excluir en la query con `tax_query NOT IN`. Cache 1 h. | **Opcional** (fix 2) |
| A4 | Duplicado (bajo) | `feed-exclusion.php:47-54` | Resuelve padres de los 3 slugs igual que `MUYU_Digital_Restriction_System::get_excluded_category_term_ids()` (sin hijos). Reutilizarlo acopla al modulo. | **No** (acoplamiento; se deja) |
| A5 | Muerto condicional | `feed-exclusion.php:152-193` | Los 2 filtros del plugin (`..._pre_filter` y `..._is_sync_ready`) son defensivos; si un hook no existe en la version instalada, ese bloque es inerte. | **No tocar** (defensivo; documentar) |
| A6 | Negocio | `feed-exclusion.php:28` | Slugs `outlet`/`stickers` core. | **No tocar** (decision del usuario) |

## 2. Cambios a aplicar

### Fix 1 (recomendado) — purga del feed en ediciones de categoria + dedup del loop
1. En `inc/feed-google.php`, extraer helper:
   ```php
   function mu_feed_google_purge_cache() {
       foreach ( muyu_get_countries_data() as $code => $data ) {
           delete_transient( 'pmu_feed_' . $code );
       }
   }
   ```
   y que `mu_feed_google_flush_cache( $post_id )` lo llame tras el guard de `post_type`.
2. En `inc/feed-exclusion.php`, `mu_feed_exclusion_flush_cache()` agrega al final:
   ```php
   if ( function_exists( 'mu_feed_google_purge_cache' ) ) {
       mu_feed_google_purge_cache();
   }
   ```
   Asi `edited_product_cat`/`create_product_cat`/`delete_product_cat` tambien invalidan el XML.

### Fix 2 (opcional, performance) — excluir en la query del build
En `mu_feed_google_build()`, tras el bloque digital, sumar a `$args`:
```php
if ( function_exists( 'mu_feed_exclusion_term_ids' ) ) {
    $excl = mu_feed_exclusion_term_ids();
    if ( ! empty( $excl ) ) {
        $args['tax_query'] = array( array(
            'taxonomy'         => 'product_cat',
            'field'            => 'term_id',
            'terms'            => $excl,
            'operator'         => 'NOT IN',
            'include_children' => false,
        ) );
    }
}
```
El early-return de `mu_feed_google_item()` se conserva como defensa (no se elimina).

### Fix 3 (docs) — documentar el reparto AR/subdominio
Actualizar el docblock de cabecera de `inc/feed-exclusion.php` (lineas 2-13) para dejar constancia:
- AR (raiz): entran todos los productos menos las 3 categorias.
- Subdominios: entra solo lo digital (filtro en `feed-google.php` via `muyu_get_digital_product_ids()`) menos las 3 categorias.
- Los 3 slugs salen de `muyu_get_excluded_catalog_category_slugs()` (fuente unica).
Sin tildes en codigo; texto en espanol.

## 3. No tocar
- Slugs (negocio) y filtros del plugin (defensivos).
- Hallazgo 1 (`get_term_children`): moot con el filtro digital.
- `functions.php`: comentario de `mu_load_module('feed-exclusion')` ya correcto.

## 4. Validacion
- `php -l inc/feed-google.php`, `php -l inc/feed-exclusion.php`, `php -l functions.php`.
- `git diff --check` (EOL/espacios).
- Estatico: confirmar que `mu_feed_google_purge_cache()` existe y se llama desde ambos flush.
- Runtime (opcional, lab apagado): `C:\wp-lab\arrancar.ps1` + `curl http://localhost:8091/feed-google.xml`
  (raiz = todos; subdominio = solo digitales; editar categoria -> cache purgado).

## 5. Decision abierta (1)
Incluir Fix 2 (optimizacion `tax_query NOT IN`) o solo Fix 1 + Fix 3?
Recomendado: **si** (bajo riesgo, cache 1 h, y pediste optimizar). Fix 4 (dedup padres) se descarta.