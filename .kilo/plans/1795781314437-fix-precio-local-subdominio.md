# Fix: precio local en el HTML por subdominio (sin AJAX) + caché por host

## Contexto / problema
- `muyunicos.com` y sus subdominios (`mexico.` `co.` `es.` `cl.` `pe.` `br.` `ec.` `us.` `cr.`) sirven el **mismo WordPress**; el país/moneda lo fija `inc/geo.php` por host y el idioma wpLingua (`/pt/`, `/en/`).
- Síntoma: en la **primera visita** a un subdominio el precio sale en **ARS** hasta recargar. Causa combinada:
  1. **Orden de hooks**: `mu_apply_country_by_domain()` corre en `template_redirect` (p10); WCPBC resuelve la zona de precios antes (init/frontend init) leyendo un customer todavía sin país.
  2. **Caché LiteSpeed no incluye el host en la clave**: por defecto comparte entrada entre subdominios → se sirve la variante AR (ARS) en el primer hit.
- El AJAX "compatibilidad con caché" tapaba el display pero dejaba el **HTML en ARS** (lo que ve Google) → rompía Merchant. **El usuario ya lo desactivó.**
- Objetivo: que el **precio local quede en el HTML del servidor** desde el primer request (sin AJAX, sin flash ARS), y que la caché separe por host. Esto además resuelve el `priceCurrency` del schema (WCPBC lo emite local) y habilita Merchant multi-país.

## Decisiones
- **D1 — País temprano por filtros nativos de WooCommerce** (no solo `template_redirect`): enganchar `woocommerce_customer_default_location_array` y `woocommerce_customer_default_location` para devolver el país del subdominio. Es el mecanismo que WCPBC/WC leen al inicio (WCPBC engancha esos mismos filtros en `class-wcpbc-frontend.php`), así el país está correcto **antes** de calcular/renderizar precios. Se conservan los hooks actuales (template_redirect/checkout/cart) como refuerzo de sesión.
- **D2 — Variar caché por host (valor), no por cookie**: regla LiteSpeed `E=Cache-Control:vary=host%{HTTP_HOST}` en `.htaccess`. El host está en cada request (incluido el primero), a diferencia de la cookie `_lscache_vary` que se setea recién en la respuesta. Confirmado en doc oficial (LSCache "Cache Varies": vary value + rewrite rule).
- **D3 — Quitar el vary por cookie del tema** (`mu_litespeed_vary_by_subdomain` en `inc/compat-litespeed.php`): si conviven el vary por valor (host) y el vary por cookie (host), el 2º request genera otra entrada (doble caché). Se deja **un solo mecanismo** (valor por host) para que quede limpio.
- **D4 — Schema local sin tocar Rank Math**: con el precio local ya en el HTML, WCPBC emite `priceCurrency` local (opción "Use default prices in product schema markup" **desmarcada**). Verificar; no se toca `seo-hreflang.php` ni Rank Math para esto.
- **D5 — `addon-etiquetas.js`**: reemplazar el `currency:'ARS'` hardcodeado (~línea 534) por la moneda localizada que ya pasa `addon-etiquetas.php` (`moneda`/`currencySymbol`). Menor, pero evita símbolo incorrecto en el builder.

## Tareas (ordenadas)
1. **`inc/geo.php`** — agregar dos filtros tempranos (con `function_exists` guards, estilo del archivo):
   - `woocommerce_customer_default_location_array($loc)` → `$loc['country'] = muyu_get_current_country_from_subdomain();` (state/city/postcode vacíos).
   - `woocommerce_customer_default_location($loc)` → devolver el código de país (string) para el subdominio.
   - Prioridad: default (10) o antes; no romper el flujo existente. Mantener `mu_apply_country_by_domain()` y sus hooks.
2. **`inc/compat-litespeed.php`** — eliminar `mu_litespeed_vary_by_subdomain` y su `add_filter('litespeed_vary', ...)` (D3). Actualizar el docblock del archivo (quitar el punto 1 y su historial) para no dejar residuo.
3. **`.htaccess`** (repo `muyunicos`, archivo `htaccess` + desplegar) — dentro de `<IfModule LiteSpeed>`, antes de `# BEGIN WordPress`, agregar el vary por host. **Precaución**: el bloque ya tiene `RewriteRule .* - [E=Cache-Control:no-autoflush]` (línea ~10); combinar en una sola regla para no pisar `no-autoflush`:
   ```apache
   RewriteCond %{REQUEST_METHOD} ^HEAD|GET$
   RewriteCond %{ORG_REQ_URI} !^/(wp-admin|wp-login|wp-json|admin-ajax|xmlrpc)
   RewriteRule .* - [E="Cache-Control:no-autoflush,vary=host%{HTTP_HOST}"]
   ```
   (Si la combinación falla, dejar `no-autoflush` en su regla y agregar la de `vary` aparte, verificando que ambas apliquen.)
4. **Plugin (hecho por el usuario)**: AJAX desactivado. Dejar **"Use default prices in product schema markup" desmarcado** (D4).
5. **`js/addon-etiquetas.js`** (D5) — usar la moneda localizada en el `Intl.NumberFormat` (fallback) en vez de `'ARS'`.

## Archivos afectados
- `muyunicos/inc/geo.php` (filtros de ubicación por defecto).
- `muyunicos/inc/compat-litespeed.php` (quitar vary por cookie).
- `muyunicos/htaccess` (regla vary por host; desplegar).
- `muyunicos/js/addon-etiquetas.js` (moneda localizada).

## Edge cases
- **Primer visitante sin cookies**: el vary por host (valor) resuelve la clave en el primer request → HTML local.
- **Usuario logueado con facturación de otro país**: se mantiene el criterio actual (el subdominio manda; `mu_apply_country_by_domain` no hace skip).
- **Googlebot**: ve el precio local por subdominio (sin AJAX) → sin "price mismatch" en Merchant.
- **Rutas solo-AR** (`country-scope.php`): el hreflang ya se reduce; no se toca.
- **Cache warm / purga**: tras desplegar, purgar LiteSpeed; la primera visita de cada subdominio genera su variante.
- **`no-autoflush`**: no debe perderse al agregar el vary (precaución en tarea 3).

## Validación
- `php -l inc/geo.php inc/compat-litespeed.php` (gateado, sin residuos).
- `node --check js/addon-etiquetas.js`.
- Con caché purgada y sesión **nueva/incógnito**:
  - `curl.exe -s https://us.muyunicos.com/en/ | Select-String "USD|\\$"` → precio en USD en el HTML (no ARS).
  - Igual para `br.` (BRL), `mexico.` (MXN), `es.` (EUR).
  - `curl.exe -sI https://us.muyunicos.com/en/` → header `X-LiteSpeed-Vary`/vary por host.
  - 2ª visita al mismo subdominio = **cache HIT** con el mismo precio local (sin recalcular).
- Schema: `curl.exe -s https://us.muyunicos.com/en/<producto>` → `priceCurrency` local (USD), coincidente con el HTML.
- Sin flash ARS: abrir subdominio en incógnito y confirmar que el primer paint ya es local.

## Rollout
1. Editar `geo.php` + `compat-litespeed.php` + `addon-etiquetas.js` (con `php -l`/`node --check` por paso).
2. Editar `htaccess` (copia) y **desplegar** al servidor.
3. Purgar caché LiteSpeed.
4. Correr la validación (curl + incógnito).
5. Commit por tema (fix geo / fix litespeed / fix addon) en el repo `muyunicos` (push dispara deploy; validar).

## Fuera de alcance
- Setup de feeds de Google Merchant (paso posterior).
- Fix de hreflang (fuente única + códigos `es-MX`…) — pendiente aparte.
- `robots.txt` (bloqueo IA) — pendiente aparte.
- Config de zonas WCPBC (ya cargadas por el usuario).

## Versiones verificadas (nov-2026)
- **LiteSpeed Cache 7.9.4** (25-nov-2026): hooks `litespeed_vary`, header `X-LiteSpeed-Vary: value=`/rewrite `E=Cache-Control:vary=` (doc oficial LSCache).
- **Price Based on Country for WooCommerce 4.x** (4.4.0 instalado; hooks 4.3.6 ref, estables): usa `woocommerce_customer_default_location[_array]` y `woocommerce_geolocate_ip`; `wc_price_based_country_before_frontend_init`/`_frontend_init`.