# Script custom de feeds Google (WCPBC) — módulo del tema

## Contexto / problema
- Merchant (654115807) ya tiene el feed AR de "Google for WooCommerce" (381 productos, **ARS**) mostrándose en ~100 países → **precio no localizado**.
- WCPBC no es soportado por Product Feed PRO (free) ni por su multi-moneda (Elite, solo Aelia/Curcy/FOX/WCML). La vía WCPBC-compatible y sin costo es **un generador propio** que lea la zona WCPBC por país (API `WCPBC_Pricing_Zones`) y emita un XML por país.
- Decisión del usuario: **módulo integrado al tema** (no script suelto) y **cubrir los 10 países incluido AR** (unificar; reemplazar el feed de Google for WooCommerce).

## Decisiones
- **D1 — Módulo `inc/feed-google.php`** cargado con `mu_load_module('feed-google')` (patrón del tema). Expone `https://{subdominio}/feed-google.xml`.
- **D2 — País desde el subdominio** (`muyu_get_current_country_from_subdomain()`), con override por `?wcpbc-manual-country=XX` (whitelist ISO) para robustez de Googlebot.
- **D3 — Precio por zona WCPBC**: `WCPBC_Frontend_Pricing::unset()` para no heredar la zona del visitante; recorrer `WCPBC_Pricing_Zones::get_zones()` y usar `$zone->get_post_price($id,'_price')` + `$zone->get_currency()`. `identifier_exists=false` (sin GTIN/MPN).
- **D4 — `g:id` único por país** (`{product_id}-{CC}`) para evitar conflictos entre feeds; `g:link` = permalink del subdominio + `?wcpbc-manual-country=XX`.
- **D5 — Un feed por país** (10): AR/es/ARS, US/en/USD, BR/pt/BRL, MX/es/MXN, ES/es/EUR, CO/es/COP, CL/es/CLP, PE/es/PEN, EC/es/USD, CR/es/CRC. Se **desactiva** el feed AR de Google for WooCommerce (evita duplicar el mismo `id`/producto en AR).
- **D6 — Caché**: transient `pmu_feed_{CC}` (1 h), invalidado en `save_post_product`/`woocommerce_update_product`. Headers `Cache-Control: public, max-age=3600` + `X-Robots-Tag: noindex`.
- **D7 — Formato**: RSS 2.0 + namespace `g:` (Google Shopping), XML bien formado.

## Tareas (ordenadas)
1. **`inc/feed-google.php`** (nuevo):
   - `mu_load_module('feed-google')` en `functions.php`.
   - `init`: `add_rewrite_rule('^feed-google\.xml$','index.php?pmu_feed=1','top')` + `template_redirect` (o match de `REQUEST_URI`) que emite el XML y `exit`. Flush de reglas al activar/tema (una vez).
   - Resolver país (D2) y zona (D3); `WP_Query` de `product` publicados; armar XML (D4/D7); cachear (D6).
   - Fallback si WCPBC no está activo: precio/moneda base.
2. **Merchant Center**:
   - Crear **10 feeds** (uno por país) con URL `https://{subdominio}/feed-google.xml`, país/idioma/moneda según D5.
   - **Desactivar** el feed AR de Google for WooCommerce.
   - Reclamar subdominios como sitios adicionales (o verificar que el claim del dominio los cubra).
   - Configurar **envío/impuestos por país** (obligatorio por destino).
3. **Validación** (ver abajo) y **enlazar** Merchant con Search Console por subdominio.

## Archivos afectados
- `muyunicos/inc/feed-google.php` (nuevo).
- `muyunicos/functions.php` (una línea: `mu_load_module('feed-google')`).

## Formato del feed (campos por item)
`g:id` (`{id}-{CC}`), `g:title`, `g:description` (short description), `g:link` (subdominio + `?wcpbc-manual-country=XX`), `g:price` (`{local} {MONEDA}`), `g:availability` (en stock/agotado), `g:condition` (new), `g:brand` ("Muy Únicos" por defecto), `g:image_link`, `g:google_product_category` (mapeo), `g:product_type` (categoría Woo), `identifier_exists=false`.

## Edge cases
- **Producto variable**: precio mínimo de la zona (`_min_price`).
- **Sin precio en la zona**: se omite el item (no se inventa ARS).
- **WCPBC inactivo**: fallback a precio/moneda base.
- **Inyección en `wcpbc-manual-country`**: whitelist ISO.
- **Catálogo grande (381×10)**: caché por transient; una sola generación por país/hora.
- **Out of stock**: se incluye con `availability=out of stock`.
- **Duplicados**: `g:id` por país + desactivar el feed AR viejo.

## Validación
- `php -l inc/feed-google.php` (gateado).
- `curl.exe -s https://us.muyunicos.com/feed-google.xml` → XML válido, precios **USD**, `link` a `us.`.
- Ídem `br.` (BRL), `mexico.` (MXN), `es.` (EUR), raíz (ARS).
- Bien formado: `php -r "simplexml_load_file('...')"` o `xmllint --noout`.
- Merchant → **Feeds** → fetch OK; **Diagnostics** sin "price mismatch"/"currency".
- La página del producto (subdominio) muestra el **mismo precio** que el feed.

## Rollout
1. Crear `inc/feed-google.php` + `mu_load_module` (con `php -l` por paso).
2. Commit en repo `muyunicos` (push = deploy).
3. Crear los 10 feeds en Merchant, desactivar el AR viejo, reclamar subdominios, configurar envío/impuestos.
4. Validar con curl + Diagnostics.

## Fuera de alcance
- `robots.txt` (IA), schema Organization/LocalBusiness/AggregateRating, title home.
- Fix de precio local en HTML/caché por subdominio (plan aparte).
- hreflang (ejecutado).

## Versiones verificadas (nov-2026)
- **WCPBC 4.4.0** (24-nov-2026): API `WCPBC_Pricing_Zones::get_zones()`, `$zone->get_post_price()`, `wcpbc_the_zone()`, `WCPBC_Frontend_Pricing::unset()/init()`, filtro `wc_price_based_country_stop_pricing`; soporta `?wcpbc-manual-country=XX`.
- **Google for WooCommerce / Merchant**: feed RSS 2.0 + `g:` namespace; `identifier_exists=false` para productos sin GTIN.