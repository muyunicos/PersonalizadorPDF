# Plan: noindex del árbol no-core (recuperar autoridad temática)

## Contexto
- La taxonomía ya está limpia. **Core** (indexable): Stickers 380, Imprimibles 165, Etiquetas Escolares 164, Decoración 33, Planchas MUY 21, Planchas de Stickers, Emprendimientos, Tarjetas, Eventos, Mundial, Outlet, Personalizado, Frases, Stickers Personalizados, Productos digitales.
- **No-core** (a noindex): Tienda JuegosParaWii 27 (+ Accesorios/Consolas/Juegos/Repuestos/Varios), Electrónica/Audio/Video 4 (+ subcats), Placas de Video, Hogar/Muebles/Jardín 1 (+ Baños/Organizadores/Bazar/Cocina/Utensilios/Cortadores/Ralladores/Interruptores), Librería (+ Escolar/Lapiceras/Papeles/ Pegamentos), Deportes, Alforjas/Bolsos/Cartucheras, Sin categorizar.
- Problema SEO: **dilución de dominio** (etiquetas + Wii/electrónica en el mismo dominio).
- Decisión del usuario: **(A) noindex del árbol no-core**, manteniendo los productos accesibles.

## Decisiones
- **D1 — noindex (follow)** para las categorías no-core; el core queda indexable.
- **D2 — Implementación por snippet del tema** (lista explícita de slugs), no manual categoría por categoría.
- **D3 — Solo categorías**: los productos no-core siguen indexables/accesibles (noindex de productos queda fuera de alcance por ahora).
- **D4 — Sitemap**: Rank Math excluye lo noindex; se valida (si no, filtro adicional).

## Lista de slugs no-core (noindex)
`tienda-juegosparawii, accesorios, consolas, juegos, repuestos, varios, electronica-audio-y-video, accesorios-para-audio-y-video, lentes-de-realidad-virtual, organizadores-de-cables, placas-de-video, hogar-muebles-y-jardin, banos, accesorios-para-banos, organizadores, bazar-y-cocina, utensilios-de-preparacion, cortadores-y-ralladores, ralladores, interruptores, libreria, escolar, lapiceras, papeles-para-impresion, pegamentos-y-cortantes, pegamentos, deportes, alforjas-bolsos-y-cartucheras, sin-categorizar`

> Ojo: `escolar` (subcat de Librería, 0) va noindex; **`escolares`** (Etiquetas Escolares, 164) es core y se mantiene indexable.

## Tareas (ordenadas)
1. **`inc/seo-noindex-categorias.php`** (nuevo):
   - Lista de slugs no-core (array).
   - Hook `rank_math/frontend/robots($robots)`: si `is_product_category()` y el slug del término está en la lista → `$robots['noindex'] = true; unset($robots['index']);` (mantener `follow`).
   - Fallback `wp_robots` (WP 5.7+) por si Rank Math no está activo.
2. **`functions.php`**: `mu_load_module('seo-noindex-categorias')`.
3. **Sitemap**: validar que Rank Math excluya las categorías noindex; si no, filtro `rank_math/sitemap/entry` para descartarlas.
4. **Validación**.

## Archivos afectados
- `muyunicos/inc/seo-noindex-categorias.php` (nuevo).
- `muyunicos/functions.php` (una línea de carga).

## Edge cases
- `escolar` vs `escolares`: noindex la primera, mantener la segunda.
- Categorías vacías (0): noindexar igual (no compiten).
- No afectar `feed-google.php` (el feed no se indexa).
- No romper canonical/hreflang ni el switcher.
- Si una categoría no-core tiene productos core (no aplica con estas listas disjuntas).

## Validación
- `php -l inc/seo-noindex-categorias.php` (gateado).
- `curl.exe -s https://muyunicos.com/product-category/tienda-juegosparawii/ | Select-String "noindex"` → aparece `noindex`.
- `curl.exe -s https://muyunicos.com/product-category/stickers/ | Select-String "noindex"` → **no** aparece `noindex`.
- `curl.exe -s https://muyunicos.com/product-category/escolares/ | Select-String "noindex"` → **no** aparece.
- Search Console → cobertura (las no-core salen del índice).

## Fuera de alcance
- noindex de **productos** no-core (separación total), subdominio, Merchant, contenido/authority, WhatsApp/AFIP.

## Notas
- Ajustar la lista de slugs si cambia la taxonomía.
- Alternativa sin código: Rank Math → editar cada categoría → SEO → **No Index** (manual, ~20 categorías).