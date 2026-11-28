# Handoff — Revisión de la exclusión de categorías del feed de Google (modo REVISIÓN)

> Documento de traspaso para un agente NUEVO en contexto limpio.
> Misión: **revisar** la implementación y encontrar bugs u optimizaciones.
> **NO editar código, NO commitear, NO pushear, NO desplegar.**
> Al finalizar, entregar un informe con hallazgos (severidad, archivo:línea, evidencia,
> impacto y fix propuesto). El usuario aprueba antes de aplicar.

---

## 1. Contexto (infraestructura)

- Sitio: `muyunicos.com` (raíz AR) + subdominios por país: `mexico.` `co.` `es.` `cl.`
  `pe.` `br.`(pt) `ec.` `us.`(en) `cr.`.
- WordPress + WooCommerce + **Google for WooCommerce** (plugin oficial, Content API).
- Multi-moneda/país: **WCPBC 4.4.0** por host.
- Multilingüe: **wpLingua 3.2.1** (`/es/`, `/pt/`, `/en/`).
- Tema: repo `C:\Users\Jonatan\Documents\GitHub\muyunicos` (child de GeneratePress).
- Lab: `C:\wp-lab` (tema por junction). El plugin Google for WooCommerce **puede no estar**
  en el lab; verificar antes de asumir.
- Deploy = push + webhook Hostinger. **No pushear sin aprobación.**

## 2. Qué se cambió (sin commitear)

Estado: `git -C C:\Users\Jonatan\Documents\GitHub\muyunicos status --short` →
` M functions.php`, ` M inc/feed-google.php`, `?? inc/feed-exclusion.php`.

### 2.1 `inc/feed-exclusion.php` (nuevo)
- `mu_feed_exclusion_slugs()` → `array( 'tienda-juegosparawii', 'outlet', 'stickers' )`.
- `mu_feed_exclusion_term_ids()` → IDs de esas categorías + `get_term_children()`
  (subcategorías), transient `mu_feed_exclusion_ids` 12 h.
- `mu_feed_exclusion_product_ids()` → **1** `WP_Query` (`post_type=product`,
  `post_status=publish`, `fields=ids`, `posts_per_page=-1`, `suppress_filters=true`,
  `tax_query` sobre los términos) → lookup `id => true`, transient
  `mu_feed_exclusion_product_ids` 12 h.
- `mu_feed_exclusion_is_excluded( $product_id )` → `isset( $lookup[ (int) $id ] )` (O(1)).
- `mu_feed_exclusion_flush_cache()` → borra ambos transients; hooks:
  `edited_product_cat`, `create_product_cat`, `delete_product_cat`,
  `save_post_product`, `woocommerce_update_product`.
- Filtros del plugin:
  - `woocommerce_gla_get_sync_ready_products_pre_filter` (recibe `WC_Product[]`).
  - `woocommerce_gla_product_is_sync_ready` (recibe `$ready`, `$product`).

### 2.2 `inc/feed-google.php`
- En `mu_feed_google_item()`, la exclusión se chequea **antes** de `wc_get_product()`.

### 2.3 `functions.php`
- `mu_load_module( 'feed-exclusion' );` después de `feed-google`.

## 3. Preguntas concretas a responder (orden de revisión)

### 3.1 Correctitud de la exclusión
1. ¿Los slugs coinciden con los reales? Verificar `get_term_by('slug', ..., 'product_cat')`
   para los tres. ¿`outlet` y `stickers` son core? (Sí, según auditoría; confirmar).
2. ¿`get_term_children()` cubre **todas** las subcategorías (incluidas nietas)?
3. Producto en **varias** categorías (una excluida + una core): se excluye. ¿Es lo deseado?
4. Producto **variable**: el lookup es por ID padre. ¿El plugin sincroniza variaciones
   por separado? Si sí, ¿pueden colarse variaciones de un padre excluido?
   Revisar `woocommerce_gla_get_sync_ready_products_pre_filter` y el manejo de variaciones.
5. Productos **borrador/pendiente/privado/protegidos**: `post_status=publish` en el lookup;
   ¿el plugin sincroniza otros estados? ¿Falta alguno?
6. `suppress_filters=true`: ¿desactiva `pre_get_posts`/`posts_where` (deseado para no
   heredar filtros de `digital-restriction.php`/`country-scope.php`) pero **conserva**
   `tax_query`? Confirmar con una corrida.

### 3.2 Compatibilidad con el plugin
7. ¿Existe `woocommerce_gla_get_sync_ready_products_pre_filter` en la versión instalada?
   Verificar con `has_filter()` (WP-CLI) o grep del plugin en el servidor/lab.
8. ¿Existe `woocommerce_gla_product_is_sync_ready`? ¿Recibe `WC_Product` o ID?
9. ¿El plugin usa rutas que **no** pasan por esos filtros (API Pull mode, batch sync,
   `woocommerce_gla_batch_product_sync_query_args`)? Si las hay, la exclusión no cubre todo.
10. Tras activar el filtro, los productos ya sincronizados **siguen en Merchant** hasta
    re-sync/borrado. ¿Cómo se fuerzan a salir? (Channel Visibility masivo, `wp eval`,
    o borrar en GMC). Documentar el procedimiento.

### 3.3 Caché e invalidación
11. ¿`save_post_product` cubre altas/bajas/imports masivos/WP-CLI/REST? ¿Falta
    `woocommerce_delete_product`, `before_delete_post`, `wp_update_term`?
12. ¿La invalidación de `mu_feed_exclusion_ids` y `mu_feed_exclusion_product_ids`
    es atómica? ¿Queda stale tras un bulk edit?
13. Transient de 12 h: ¿aceptable? ¿Qué pasa si se edita una categoría y el transient
    viejo sigue 12 h? (Debería invalidarse; probar).
14. `mu_feed_google_build()` cachea el XML 1 h: tras deploy, el feed viejo puede seguir
    sirviendo excluidos hasta 1 h. ¿Conviene limpiar transients en el deploy/activación?

### 3.4 Optimización / recursos
15. Medir: `timer_start/timer_stop` alrededor de `mu_feed_exclusion_product_ids()`
    (primera corrida y cacheada). ¿Cuántas queries hace? (`$wpdb->queries` con
    `SAVEQUERIES`).
16. `WP_Query` con `posts_per_page=-1` sobre ~500-1000 productos: ¿es aceptable?
    ¿Alternativa `$wpdb` con `SELECT ID ... WHERE tt.term_id IN (...)`?
17. Memoria del lookup `array_fill_keys` (N IDs): ¿impacto medible?
18. En `mu_feed_google_build()`, el `WP_Query` sigue iterando **todos** los productos y
    llama `mu_feed_google_item()` por cada uno; la exclusión es O(1), pero se podría
    excluir en la query (`tax_query` con `operator => NOT IN`) y no iterar. Evaluar.
19. `mu_feed_exclusion_is_excluded()` se llama por producto en el sync del plugin y en el
    feed; ¿es O(1) real? ¿Hay algún camino que la llame antes de cachear y provoque
    N rebuilds? (No debería: el transient protege).

### 3.5 Integración y efectos colaterales
20. `feed-google.php`: la exclusión va antes de `wc_get_product`; ¿rompe el caso de
    producto variable, `is_visible()`, precio WCPBC, o el override `?wcpbc-manual-country`?
21. `digital-restriction.php` filtra queries de productos por host; `suppress_filters`
    evita que la exclusión herede eso. ¿Es correcto para el feed (que sí debe respetar
    el país en su propia query)? Revisar interacción.
22. `seo-noindex-categorias.php` ya lista `tienda-juegosparawii`; ahora hay **dos listas**
    (noindex vs feed). ¿Conviene centralizar? ¿Riesgo de divergencia?
23. `outlet`/`stickers` son core: excluirlos del feed puede ser un error de negocio.
    **Señalarlo**, no decidirlo.
24. Si el plugin **no** está activo: los `add_filter` son inofensivos; el feed propio
    sigue excluyendo. Confirmar que no hay fatal.
25. Si WooCommerce **no** está activo: `get_term_by`/`WP_Query` no deben romper.
26. EOL/espacios: `git diff --check`; el repo mezcla CRLF/LF.

### 3.6 Seguridad / robustez
27. `ABSPATH` en el nuevo archivo. Sí/no.
28. `is_wp_error()` en `get_term_by`/`get_term_children`/`wp_get_post_terms` (este último
    ya no se usa).
29. `method_exists()` en los filtros del plugin.
30. IDs no numéricos / productos borrados: `isset` devuelve false; sin warning.
31. `array_map('intval', ...)` sobre IDs; sin TypeError en PHP 8.
32. `*/` dentro de docblocks: no debe haber (cierra comentario).

## 4. Cómo verificar (comandos)

```powershell
$repo='C:\Users\Jonatan\Documents\GitHub\muyunicos'
php -l "$repo\inc\feed-exclusion.php"; php -l "$repo\inc\feed-google.php"; php -l "$repo\functions.php"
git -C $repo status --short; git -C $repo diff --check
```

Si hay WP-CLI en el lab/hosting:
```powershell
wp eval 'var_dump(mu_feed_exclusion_slugs());'
wp eval 'var_dump(mu_feed_exclusion_term_ids());'
wp eval '$l=mu_feed_exclusion_product_ids(); var_dump(count($l)); var_dump(array_keys($l));'
wp eval 'var_dump(has_filter("woocommerce_gla_get_sync_ready_products_pre_filter"), has_filter("woocommerce_gla_product_is_sync_ready"));'
wp eval 'timer_start(); mu_feed_exclusion_product_ids(); timer_stop();'
```

Feed propio (purgar caché o esperar 1 h):
```powershell
curl.exe -s "https://muyunicos.com/feed-google.xml" | Select-String -Pattern "Sticker|Outlet|Wii"
```
No debe listar productos de esas categorías.

Plugin (UI): Product Feed → re-sync → verificar que los excluidos pasen a
**Not Synced / Don't sync** y que las 24 issues de `description` (Wii) desaparezcan.

## 5. Entregable

Informe Markdown con:
- Tabla de hallazgos: `# | severidad (crítico/alto/medio/bajo) | archivo:línea |
  evidencia | impacto | fix propuesto`.
- Veredicto de optimización (recursos) con números medidos.
- Lista de verificaciones que **no** se pudieron correr y por qué.
- **Sin aplicar cambios.**

## 6. Reglas de conducta

- Modo REVISIÓN: solo leer/ejecutar comandos de diagnóstico. **No editar, no commitear,
  no pushear, no desplegar.**
- Responder en **español** (código sin tildes).
- Leer `AGENTS.md` del repo que se toque (el tema `muyunicos` no tiene AGENTS.md propio;
  el de la raíz es del plugin `personalizador-pdf`, no aplica al tema).
- Shell: **PowerShell 7 (`pwsh`)**, secuenciar con `;`, comillas en rutas con espacios.
- No inventar: si algo no se puede probar, decirlo y proponer cómo.
- Jerarquía: `constitution` > `AGENTS.md` > resto.

## 7. Fuera de alcance

- Configuración de Rank Math, Site Kit, Google for WooCommerce (UI).
- Decisión de negocio sobre excluir `stickers`/`outlet` (solo señalar).
- Otros planes SEO (hreflang, robots, títulos).
- Cualquier cambio de código (solo propuestas).