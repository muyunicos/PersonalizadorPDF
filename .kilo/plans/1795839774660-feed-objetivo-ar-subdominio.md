# Plan — Ajustar el feed de Google al objetivo real (AR vs subdominio)

> Objetivo del usuario:
> - **AR (muyunicos.com):** llegan a Google TODOS los productos, EXCEPTO las 3 categorias
>   (`outlet`, `tienda-juegosparawii`, `stickers`) y sus subcategorias.
> - **Subdominios (mx/co/es/cl/pe/br/ec/us/cr):** llegan SOLO los productos DIGITALES,
>   EXCEPTO esas 3 categorias.
>
> Modo: implementacion (salir de plan mode). No commitear/pushear sin aprobacion.
> Shell: PowerShell 7. Editar con la herramienta de edicion (anclas de 1 linea).

## Diagnóstico (verificado en código)

- `inc/feed-google.php` `mu_feed_google_build()` arma un `WP_Query` **secundario**
  (lineas 286-294). `digital-restriction.php:657` `filter_product_queries()` retorna si
  `! $query->is_main_query()` → **el feed no hereda el filtro digital**. Hoy el XML de
  subdominio incluye TODOS los productos (menos 3 cats), no solo digitales. **Este es el
  pendiente real.**
- Helpers publicos ya existentes (reutilizar, no duplicar):
  - `muyu_get_digital_product_ids()` (`digital-restriction.php:1203`) → `(array) get_option('muyu_digital_product_ids', [])`.
  - `muyu_get_excluded_catalog_category_slugs()` (`:1198`) → `['outlet','tienda-juegosparawii','stickers']`.
  - `MUYU_Digital_Restriction_System::get_instance()->is_restricted_user()` (`:141`) → true en todo host != muyunicos.com.
- `inc/feed-exclusion.php` ya excluye las 3 cats (feed propio + plugin). En AR es lo que
  hace el trabajo; en subdominio es redundante (cats fisicas) pero inofensivo.
- Hallazgo 1 (get_term_children filtrado) queda **moot** con el filtro digital: en subdominio
  solo entran digitales; Wii/outlet/stickers son fisicos. Edge minimo: producto digital en una
  subcategoria de Wii en subdominio (sev. baja).

## Cambios propuestos

### 1. `inc/feed-google.php` — filtrar a digitales en subdominio (el pendiente)
En `mu_feed_google_build()`, antes del `new WP_Query`, agregar:
```php
$digital_ids = array();
if ( class_exists( 'MUYU_Digital_Restriction_System' )
    && MUYU_Digital_Restriction_System::get_instance()->is_restricted_user()
    && function_exists( 'muyu_get_digital_product_ids' ) ) {
    $digital_ids = muyu_get_digital_product_ids();
}
```
Y en el `array` del `WP_Query`, sumar (solo si no vacio, con guard anti-vacio como
`filter_product_queries`):
```php
'post__in' => ! empty( $digital_ids ) ? $digital_ids : null,
```
Guard: si `is_restricted_user()` y `muyu_get_digital_product_ids()` esta vacio (indices no
armados), NO filtrar (mandaria feed vacio) — espejo de `filter_product_queries` (schedule
rebuild + return). Implementar el `if` envolviendo el query, no con `null`.

### 2. `inc/feed-exclusion.php` — dedup de slugs (hallazgo 4)
`mu_feed_exclusion_slugs()` reutiliza el helper existente:
```php
if ( function_exists( 'muyu_get_excluded_catalog_category_slugs' ) ) {
    return muyu_get_excluded_catalog_category_slugs();
}
return array( 'tienda-juegosparawii', 'outlet', 'stickers' );
```
(una sola fuente de verdad; el fallback cubre si el modulo no cargo).

### 3. (Opcional, bajo) `inc/feed-exclusion.php` — post_status
`mu_feed_exclusion_product_ids()`: `post_status => 'publish'` → `post_status => 'any'`
para que el lookup cubra draft/pending/private si el plugin sincroniza esos estados.
Solo si se confirma que el plugin GFW sincroniza algo != publish (hoy no verificable).

## Lo que NO se toca
- Hallazgo 1: no se cambia `get_term_children` (moot con el filtro digital).
- Negocio (outlet/stickers): se mantienen los 3 slugs (decision del usuario).
- Plugin Google for WooCommerce: filtros ya puestos; su verificacion de firma queda pendiente
  (plugin ausente en lab, sin WP-CLI).

## Validacion
- `php -l inc/feed-google.php`, `php -l inc/feed-exclusion.php`.
- `git -C <repo> diff --check`.
- Estatico: confirmar que el `WP_Query` del build queda con `post__in` solo en subdominio.
- Runtime (si se puede): lab apagado; `arrancar.ps1` + `curl http://localhost:8091/feed-google.xml`
  en host raiz (todos) vs subdominio (solo digitales). Si no, documentar como no corrido.

## Preguntas abiertas (no bloquean el fix 1 y 2)
- Confirmar que `outlet`/`stickers` se mantienen (si, segun objetivo).
- Si querés que además el sync del plugin filtre digitales en subdominio (hoy el plugin es global).