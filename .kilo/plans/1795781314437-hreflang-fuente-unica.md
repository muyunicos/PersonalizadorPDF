# Plan: robots.txt (IA) + schema/title home

> **Actualización 2026-11-27**: `robots.txt` lo gestiona **Rank Math** (wp-admin →
> Rank Math → General → Editar robots.txt); el bloque `# BEGIN Cloudflare Managed
> content` es solo texto sobrante dentro de ese campo (no hay Cloudflare). El
> **título de home por país** ya está implementado en `muyunicos/inc/seo-hreflang.php`
> (`mu_home_title_pais`): AR conserva su título; no-AR usa un general
> "Personalizados para imprimir" (en: "Custom Printed Products") + país.
> Pendiente manual: Rank Math (robots.txt, schema Organization/WebSite/LocalBusiness,
> título home AR) y validación.

## Contexto
- `robots.txt` **bloquea crawlers de IA** (GPTBot, ClaudeBot, Google-Extended, CCBot, meta-externalagent, Amazonbot, Applebot-Extended, Bytespider) y de auditoría (AhrefsBot, SemrushBot, MJ12, DotBot). El `.htaccess` ya los liberó; falta el `robots.txt`.
- Home **sin datos estructurados** (sin Organization/WebSite/LocalBusiness) y `<title>- Muy Únicos</title>`.
- Trustindex **4.9/5 (108 reseñas)** sin `AggregateRating` en el schema → sin estrellas en SERP.
- NAP real: Catamarca 2255, Piso 10, Dto F, Mar del Plata, Buenos Aires 7600 · muyunicos@gmail.com · +5492235331311.

## Decisiones
- **D1 — robots.txt**: permitir IA (quitar GPTBot/ClaudeBot/Google-Extended/CCBot/meta-externalagent/Amazonbot/Applebot-Extended/Bytespider) y auditoría (Ahrefs/Semrush/MJ12/DotBot). Mantener `User-agent: * / Allow: /` y `Sitemap:`. `Content-Signal`: quitar `ai-train=no` (dejar que la IA pueda citar; `ai-input` permitido).
- **D2 — Schema (Rank Math)**: Organization (nombre "Diseños Muy Únicos", logo, `sameAs` a redes), WebSite (SearchAction), LocalBusiness (NAP real, horario, `areaServed`).
- **D3 — AggregateRating**: snippet que inyecte `AggregateRating` (4.9, 108) + `Review` en Product y Organization (las reseñas Trustindex son reales y visibles → política Google OK).
- **D4 — Title home**: Rank Math → Títulos y metadatos → Homepage: `Muy Únicos — Etiquetas escolares y stickers personalizados | Mar del Plata`.

## Tareas (ordenadas)
1. **robots.txt**: en Rank Math → "Editar robots.txt" (o archivo estático del servidor) quitar los `Disallow` de IA/auditoría; dejar `User-agent: *` + `Allow: /` + `Sitemap: https://muyunicos.com/sitemap_index.xml`. Ajustar `Content-Signal`.
2. **Rank Math schema**: activar módulo Schema; cargar Organization + WebSite; LocalBusiness con el NAP.
3. **Snippet AggregateRating** (`muyunicos/inc/schema-rating.php` + `mu_load_module`): `@type: AggregateRating` (ratingValue 4.9, reviewCount 108) en Product y Organization; `Review` con `author`/`reviewRating`.
4. **Title home** en Rank Math (D4).
5. **Validación**.

## Archivos / dónde
- `robots.txt` (servidor o Rank Math → Editar robots.txt).
- `muyunicos/inc/schema-rating.php` (nuevo) + `muyunicos/functions.php` (carga).
- Config Rank Math (wp-admin): Schema, Titles & Meta.

## Edge cases
- No duplicar Organization si Rank Math ya lo emite: usar filtros/condiciones.
- `AggregateRating` solo con reseñas reales visibles (cumple Trustindex).
- No bloquear `Googlebot` (búsqueda) ni `Bingbot`.
- robots.txt no debe romper el sitemap ni `media.php`.

## Validación
- `curl.exe -s https://muyunicos.com/robots.txt` → sin bloqueos de IA; `Allow: /`; `Sitemap:`.
- Rich Results Test / Schema Markup Validator → Organization, LocalBusiness, AggregateRating válidos.
- `curl.exe -s https://muyunicos.com/` → `<title>` correcto + JSON-LD con Organization/LocalBusiness/AggregateRating.
- Revisar Search Console → "Configuración del rastreador" / robots.

## Fuera de alcance
- Merchant (en curso), catálogo mixto (electrónica), WhatsApp/AFIP, Search Console por subdominio, limpiar `wplingua/`.

## Notas
- `robots.txt` es config/servidor (no código del repo); el snippet de schema sí es código del tema.
- Si `robots.txt` es estático, editarlo en el servidor; si es de Rank Math, editarlo ahí.