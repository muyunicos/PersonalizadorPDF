# Auditoría SEO / Posicionamiento — muyunicos.com

> Documento de trabajo vivo. Se va actualizando a medida que se indaga.
> Creado: 2026-11-27 · Dominio auditado: https://muyunicos.com/ (y subdominios por país)

## 0. Ficha técnica del sitio (detectado)

- **CMS**: WordPress 7.1.5
- **E-commerce**: WooCommerce 11.3.1
- **Tema**: GeneratePress 3.6.1 + child `generatepress-child` (custom)
- **SEO**: Rank Math
- **Multilingüe**: wpLingua 3.2.1 (subdirectorios `/es/`, `/pt/`, `/en/`)
- **Multi-moneda/país**: WooCommerce Product Price Based on Countries 4.4.0 (subdominios por país)
- **Analítica**: Google Site Kit 1.192.0 (GA4 `GT-TXX653CB`) + Google Ads `AW-17627921130` (Google for WooCommerce)
- **Reseñas**: Trustindex (4.9/5, 108 reseñas)
- **Verificaciones**: google-site-verification (x2), p:domain_verify (Bing)
- **Otros**: `llms.txt` presente, `Content-Signal: ai-train=no; use=reference`, WhatsApp +54 9 223 533-1311, QR AFIP
- **Subdominios por país**: `mexico.` `co.` `es.` `cl.` `pe.` `br.`(pt) `ec.` `us.`(en) `cr.` + raíz `muyunicos.com` (Argentina)
- **NAP real (fuente Trustindex)**: Catamarca 2255, 10 F CTU, Mar del Plata 7600, Buenos Aires, AR · muyunicos@gmail.com · +54 9 223 533-1311
- **Tipo de producto**: en su mayoría **digital** ("Archivo Digital (PDF), Impresas", entrega <24 h); también hay impresos.

## 1. Hallazgos confirmados (con evidencia)

### 🔴 Críticos
1. **robots.txt bloquea crawlers de IA** → invisible en ChatGPT/Claude/Gemini/Perplexity/Copilot/Apple Intelligence.
   - Evidencia: `robots.txt` con `User-agent: GPTBot / ClaudeBot / Google-Extended / CCBot / meta-externalagent / Amazonbot / Applebot-Extended / Bytespider` → `Disallow: /`.
   - Impacto: mata el "posicionamiento IA".
2. **Home con title roto**: `<title>- Muy Únicos</title>` (confirmado en SERP de Google).
3. **Home sin datos estructurados**: 0 JSON-LD (sin Organization, WebSite, LocalBusiness, SearchAction).
4. **Moneda del schema incorrecta por país**: `priceCurrency:"ARS"` fijo; en vivo `us.` muestra "1800 ARS", `mexico.`/`cr.` muestran "$3.000,00" (ambiguo), solo `es.` localiza bien (€ 2,70).
   - Evidencia: JSON-LD del producto en `mexico.` → `"priceCurrency":"ARS"`; snippet de `us.muyunicos.com` → "Price: 1800 ARS".
5. **hreflang roto / en conflicto**:
   - Dos sets: wpLingua (subdirs) + Rank Math (subdominios).
   - 8× `hreflang="es"` duplicado (inválido).
   - URLs malformadas: `https:/pt//pt/br.muyunicos.com/pt/`, `https:/en//en/us.muyunicos.com/en/`.
   - Dos `x-default` distintos (wpLingua→`/en/`, Rank Math→raíz).
6. **Catálogo mezclado**: etiquetas escolares + stickers + electrónica (Wii, Seagate, gamepad, Fluke, WiFi, mopa) → dilución de autoridad temática.

### 🟠 Altos
7. **Sin `aggregateRating`/`review` schema** pese a 4.9/5 (108 reseñas Trustindex) → sin estrellas en SERP.
8. **robots.txt bloquea AhrefsBot, SemrushBot, MJ12, DotBot** → no se puede auditar backlinks/competencia.
9. **Contenido duplicado** entre 10 subdominios (mismo texto, cambia moneda).
10. **No rankea por la keyword principal** "etiquetas escolares personalizadas" (top 10: OK Ideas, Kuppani, Pekokis, Stikets, Vistaprint, Tutete, Ludilabel, Etiquetaly, OpenLabelMaker). Solo rankea por marca.
11. **NAP no está en schema** (falta Organization/LocalBusiness con Catamarca 2255…).
12. **Trustindex en categoría "Computer Store"** (incorrecto; debería ser papelería/regalos).
13. **`/en/` title "Home - Very Single"** (traducción literal de "Muy Únicos").

### 🟡 Medios
14. Blog con solo 4 posts → sin captación long-tail.
15. WhatsApp argentino (+54) y QR AFIP en todos los países → no localizado.
16. `lang="es"` genérico en subdominios (debería ser `es-MX`, `es-CO`, `en-US`, `pt-BR`…).
17. `meta name="google" content="notranslate"` (revisar impacto multilingüe).
18. Mucho CSS inline en home → revisar Core Web Vitals.
19. Falta `BreadcrumbList` schema.
20. Verificar duplicados `muyunicos.com` vs `www` y canonical.

## 2. Cosas a favor (base existente)
- Indexado OK (páginas aparecen en Google).
- Sitemaps Rank Math (4 de productos) + sitemap multilingüe wpLingua.
- GA4 + Google Ads + Google for WooCommerce ya instalados.
- `llms.txt` presente.
- Schema `Product` con `AggregateOffer`, `brand`, `sku`, `availability` (bien, pero moneda mal).
- Trustindex 4.9/5 con 108 reseñas verificadas (activo de reputación fuerte).
- Exa.ai ya tiene ficha de entidad de Muy Únicos.

## 3. Lista de tareas priorizada

### 🔴 P0 — Bloqueantes
- [ ] Corregir `<title>` de la home.
- [ ] Corregir title `/en/` ("Very Single").
- [ ] Schema Organization + WebSite (SearchAction) + LocalBusiness (NAP real) en home.
- [ ] `priceCurrency` por país (USD/MXN/COP/CLP/PEN/CRC…) + valor numérico real por país.
- [ ] Unificar hreflang (una sola fuente) + borrar `es` duplicados + arreglar URLs malformadas + un `x-default`.
- [ ] Desbloquear crawlers de IA en robots.txt (GPTBot, ClaudeBot, Google-Extended, CCBot, meta-externalagent, Amazonbot, Applebot-Extended).
- [ ] Desbloquear AhrefsBot/SemrushBot para auditar.
- [ ] Decidir separar/eliminar la electrónica del catálogo.

### 🟠 P1 — Alto impacto
- [ ] `AggregateRating` + `Review` schema (Trustindex 4.9/108).
- [ ] Corregir categoría de Trustindex y enlazarla; `sameAs` a redes.
- [ ] `BreadcrumbList` en todas las páginas.
- [ ] `FAQPage` + `HowTo` schema (AEO).
- [ ] Enriquecer `llms.txt` (marca, categorías, top productos, precios, envíos).
- [ ] Contenido único y localizado por país (evitar duplicate content).
- [ ] Plan editorial long-tail (de 4 a ~2 posts/mes).
- [ ] Arquitectura de categorías fuerte con contenido único.
- [ ] Crear Google Merchant Center + feed multi-país (Free Listings + Shopping opcional).

### 🟡 P2 — Medio
- [ ] Localizar WhatsApp / quitar QR AFIP fuera de AR.
- [ ] `lang` por subdominio.
- [ ] Revisar `notranslate`.
- [ ] Core Web Vitals (CSS inline).
- [ ] Search Console por subdominio (dominio) + sitemaps por país.
- [ ] Google Business Profile + Bing Places.
- [ ] Forzar canónica `www` vs no-www.

## 4. Pendiente de investigar (siguientes indagaciones)
- [ ] Backlinks y perfil de autoridad (cuando se desbloquee Ahrefs/Semrush o vía Search Console).
- [ ] Core Web Vitals reales (PageSpeed).
- [ ] Feed de Merchant actual (si existe) y estado de Free Listings.
- [ ] Multiplicador real del plugin Price Based on Countries por país.
- [ ] Qué plugin genera el "Sold by: muyunicos.com" (schema marketplace).
- [ ] Competidores por país (MX/CO/CL/PE/ES/US) y sus precios.
- [ ] Visibilidad actual en ChatGPT/Perplexity (hoy bloqueada por robots).
- [ ] Revisar `/es/` vs raíz: canibalización de la versión ES de Argentina vs España.
- [ ] Estado de indexación por subdominio en Search Console.

## 5. Bitácora
- 2026-11-27: Auditoría inicial (home, producto, sitemaps, robots, llms.txt, subdominios). Búsqueda web habilitada; confirmados hallazgos en SERP y obtenido NAP real + categoría Trustindex.
- 2026-11-27: Auditado el `.htaccess` original (copia en `muyunicos/htaccess`). Aplicados cambios en la copia: (1) bloque "IDIOMA POR PAIS" con 301 raiz->/pt/ (BR), raiz->/en/ (US) y /pt/,/en/->raiz en hispanos; (2) eliminado `Options All`; (3) desactivado el bloqueo de bots (se liberan IA + SEO audit). Pendiente de desplegar y validar en hosting.

## 6. Cambios aplicados y pendientes (htaccess, b, c)

### Aplicado en la copia `muyunicos/htaccess` (falta desplegar/validar)
- [x] 301 `br.muyunicos.com/` -> `/pt/` y `us.muyunicos.com/` -> `/en/`.
- [x] 301 `/pt/`,`/en/` -> raiz en subdominios hispanos (mexico|co|es|cl|pe|ec|cr).
- [x] Eliminado `Options All` (re-activaba Indexes).
- [x] Desactivado bloqueo de bots (libera GPTBot/ClaudeBot/anthropic/CCBot/Bytespider + Ahrefs/Semrush/MJ12/DotBot/DataForSeo/MegaIndex/BLEX/Petal).
- [ ] Verificar que los subdominios compartan docroot (si tienen `.htaccess` propio, replicar reglas ahi).
- [ ] Revisar Jetpack tras el bloqueo de xmlrpc (puede romperse).
- [ ] Elegir canónica www/no-www y otros TLD.
- [ ] Excluir de cache LiteSpeed las paginas con moneda por pais (conflicto geoloc/cache).

### b) — YA IMPLEMENTADO (no hace falta snippet nuevo)
- [x] `inc/geo.php` -> `mu_apply_country_by_domain()` FUERZA el pais por subdominio (hooks: template_redirect, woocommerce_checkout_update_order_review, woocommerce_cart_loaded_from_session). El pais NO depende de IP.
- [x] `mu_custom_price_decimals()` ajusta decimales por pais.
- [x] `inc/compat-litespeed.php` -> cookie `_lscache_vary` por host (aunque el header Vary observado solo trae Accept-Encoding: verificar).
- [ ] Por que BR/US no muestran moneda local pese a esto: probables = (1) zonas WCPBC sin precio cargado para ese pais (cae al ARS base), (2) cache LiteSpeed sirviendo HTML viejo, (3) simbolo cambiado por CSS (`mu-country-xx`) sobre un numero base. REQUIERE wp-admin.

### c) — priceCurrency por pais en schema (PENDIENTE)
- [ ] Rank Math emite `priceCurrency` fijo en `ARS`; enganchar filtro para leer la moneda real por subdominio (Product schema + feed Merchant).
- [ ] `js/addon-etiquetas.js` (~linea 534) hardcodea `currency:'ARS'`: cambiar a la moneda del pais.

## 7. Auditoria de codigo (repo `muyunicos`) — CORRIGE el audit externo

> El audit inicial (secciones 1-6) asumia que faltaba implementar el multi-pais. FALSO: el tema ya lo implementa. Estado real:

### Ya implementado (NO tocar / NO duplicar)
- **Pais por subdominio (B)**: `inc/geo.php` (mapa host->ISO en `muyu_get_countries_data()`, forzado en `mu_apply_country_by_domain()`).
- **hreflang + canonical + titulos/meta localizados**: `inc/seo-hreflang.php` (custom, no Rank Math) + `inc/country-scope.php` (reduce alternates en rutas solo-AR).
- **Selector de pais + modal + body class** para simbolos CSS: `inc/geo.php`.
- **Compat wpLingua** (prefijo de idioma en 301): `inc/compat-wplingua.php`.
- **Aislamiento de cache por subdominio**: `inc/compat-litespeed.php`.
- **Restriccion de rutas/elementos por pais**: `inc/country-scope.php`, `inc/cart-restriction.php`, `inc/digital-restriction.php`.
- **Precio flexible** (donaciones): `inc/flexible-price.php`.

### Problemas REALES que quedan (corregidos)
1. **hreflang duplicado/invalido**: `seo-hreflang.php` emite `es` generico para los 8 paises hispanos (linea ~80) -> 8 `hreflang="es"` (invalido, debe ser unico) + `pt-BR` + `en-US` + x-default AR. ADEMAS wpLingua emite su propio set (malformado `https:/pt//pt/...`). Hay DOS fuentes. Fix: desactivar el hreflang de wpLingua y dejar SOLO `seo-hreflang.php`; corregir `es` -> `es-MX/es-CO/es-CL/es-PE/es-EC/es-CR/es-ES`.
2. **priceCurrency ARS** (c) + `addon-etiquetas.js` hardcode ARS.
3. **Title home "- Muy Unicos"**: template de Rank Math vacio (config, no codigo).
4. **Moneda no localizada en BR/US**: no es codigo (geo.php ya fuerza pais); verificar WCPBC zones + cache.
5. **robots.txt** (servidor, no esta en el repo) aun bloquea IA: actualizar tambien (el htaccess ya se libero).
6. **Sin schema Organization/LocalBusiness/AggregateRating**: config Rank Math.
7. **Jetpack vs xmlrpc**: el htaccess bloquea xmlrpc.php; verificar Jetpack.
8. **Catalogo mixto (electronica)**: dilucion tematica (contenido).
9. **WhatsApp +54 / QR AFIP** sin localizar.

### Siguiente paso
- Verificar en wp-admin: WooCommerce -> Product Price Based on Country (zonas y precios por pais) y purgar cache LiteSpeed; revisar un producto en `us.`/`br.` con pais forzado.
- Decidir fuente unica de hreflang (tema vs wpLingua) y corregir codigos.