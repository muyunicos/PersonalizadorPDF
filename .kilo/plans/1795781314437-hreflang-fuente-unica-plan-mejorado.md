# Plan mejorado — Raíz en el idioma local, sin redirect (wpLingua 3.2.1)

> Supera al handover `1795781314437-hreflang-fuente-unica.md`. Fuente de verdad del
> comportamiento: **wpLingua 3.2.1 instalado en el servidor** (descargado a
> `muyunicos/wplingua/`), no el `master` de GitHub (3.3.1). Verificado que las funciones
> clave son idénticas entre 3.2.1 y 3.3.1.

## 0. Qué cambia respecto al handover (lo importante)

1. **No hace falta rewrite interno en `.htaccess`.** El handover asumía approach A = rewrite
   interno. Es **incorrecto y contraproducente**: wpLingua deriva el idioma del
   `$_SERVER['REQUEST_URI']` capturado en `plugins_loaded`; un rewrite interno de Apache
   **no** cambia `REQUEST_URI` (sigue siendo `/`), así que wpLingua seguiría sirviendo `es`.
   Y si lo cambiara, rompería el enrutado de WP. Descartado.
2. **Approach A viabilizado y simplificado**: basta con **sobrescribir el global
   `$wplng_request_uri`** en `init` prioridad **0** (antes del `wplng_ob_start` de wpLingua en
   `init` p1), **solo para la ruta raíz `/`** y **solo en hosts `br.` / `us.`**. No se toca
   `.htaccess` para la raíz (se quitan las 2 reglas 301), no se toca WP routing, no se toca el
   hreflang (ya es del tema).
3. **wpLingua 3.2.1 confirmado** en servidor; mecanismo idéntico a 3.3.1.

## 1. Mecanismo real de wpLingua (evidencia, 3.2.1)

- `wplng_get_language_current_id()` (`inc/languages.php:354`) lee el global
  `$wplng_request_uri` (fijado en `wplng_start()` a `plugins_loaded` desde
  `$_SERVER['REQUEST_URI']` normalizado). Si el path empieza con `/<lang>/` → ese idioma;
  **si no, devuelve el idioma por defecto global** (`wplng_website_language` = `es`).
  Memoiza en `$wplng_language_current_id`.
- `wplng_ob_start()` (`inc/buffering.php:65`, `init` p1) rama front (`:150`):
  - si `website_id === current_id` → `return` (sirve la página original `es`, sin buffer);
  - si difieren → `origin = wplng_get_url_original($current)` (quita `/pt/`), fija
    `$_SERVER['REQUEST_URI'] = wplng_request_path_for_wp($origin)` (WP resuelve la original)
    y abre buffer que **traduce el HTML** `es`→`pt`.
- `wplng_redirect_translated_slug()` (`template_redirect`): redirige sólo si la URL traducida
  difiere de la actual. En la raíz con override, `url_current` = `/pt/` = `url_translated` →
  **no redirige**.
- **No hay resolución por host ni por navegador**: el default es un único global. Por eso
  "raíz = pt/en por subdominio" no es nativo y hay que interceptar el global.

## 2. Enfoque recomendado (A viabilizado)

**Idea**: en la raíz de `br.`/`us.`, hacer que wpLingua "crea" que la petición es `/pt/`
(o `/en/`) **sin cambiar la URL del navegador**. wpLingua entonces sirve la home original y la
traduce; WP sigue resolviendo `/` (REQUEST_URI se normaliza a `/` en `init` p1); no hay
redirect; la URL final es la raíz.

**Secuencia en `br.muyunicos.com/`** (verificada contra el fuente 3.2.1):
1. `plugins_loaded`: `wplingua.php` fija `$wplng_request_uri = '/'`.
2. `after_setup_theme`: el tema carga; `compat-wplingua.php` captura
   `mu_wplingua_original_uri = '/'` (real) — correcto para country-scope/compat.
3. `init` **p0** (módulo nuevo del tema): si path es raíz y host `br.` →
   `$GLOBALS['wplng_request_uri'] = '/pt/'`; `$GLOBALS['wplng_language_current_id'] = null`.
4. `init` **p1** `wplng_ob_start`: current=`pt` ≠ website=`es` → `origin='/'`,
   `REQUEST_URI='/'`, buffer traduce `es`→`pt`.
5. `parse_request` (tras `init`) usa `REQUEST_URI`/` → home en `es`.
6. `template_redirect`: `url_current('/pt/')` == `url_translated('/pt/')` → sin redirect.
7. Buffer traduce → HTML `pt`. **URL final = `/`. Sin redirect.** ✔

**Alcance**: SOLO la ruta raíz. Las páginas internas **no cambian**: siguen con los 301
existentes (`br/tienda` → `br/pt/tienda`, etc.). El handover ya quería mantener esos 301.

## 3. Cambios concretos

### 3.1 `.htaccess` (`muyunicos/htaccess`)
- **Quitar** las 2 reglas 301 de raíz (líneas **97-103**): `# BR: raiz -> /pt/` y
  `# US: raiz -> /en/`. Dejar que la raíz caiga al front (líneas 110-124).
- **Mantener** intocada la regla de países hispanos `^(pt|en)...` → raíz (líneas 105-107).
- **Añadir** (evitar duplicado raíz vs `/pt/` en el host local): redirección **exacta** del
  idioma-raíz a `/` sólo en su host:
  ```apache
  # BR: /pt/ (raiz del idioma) -> / (la raiz ya sirve pt; evita duplicado)
  RewriteCond %{HTTP_HOST} ^br\.muyunicos\.com$ [NC]
  RewriteRule ^pt/?$ / [R=301,L]
  # US: /en/ -> /
  RewriteCond %{HTTP_HOST} ^us\.muyunicos\.com$ [NC]
  RewriteRule ^en/?$ / [R=301,L]
  ```
  (Exactas: no tocan `/pt/tienda/` ni `/en/tienda/`.)
- **No tocar** la regla LiteSpeed vary host (línea 14): ya aísla la caché por host, que es
  justo lo que la raíz necesita (br=pt, us=en, hisp=es).

### 3.2 Nuevo módulo `inc/idioma-raiz.php` (tema)
- `mu_idioma_raiz_es_host_local()`: `true` si host `br.` o `us.`.
- `mu_idioma_raiz_prefijo()`: `pt` para `br.`, `en` para `us.`, `''` resto.
- Hook `add_action('init', 'mu_idioma_raiz_fijar', 0)`:
  - sólo front (`!is_admin()`, `!wp_doing_cron()`, `!DOING_AJAX`, `!wp_is_json_request()`);
  - sólo si el path real (de `mu_wplingua_original_uri()`, capturado en `after_setup_theme`)
    es raíz (`/` o vacío);
  - sólo si hay prefijo (`br.`/`us.`);
  - `$GLOBALS['wplng_request_uri'] = '/' . $prefijo . '/'`;
  - `$GLOBALS['wplng_language_current_id'] = null;` (re-memoizar).
- Cargarlo desde `functions.php` **después** de `compat-wplingua.php` (que provee
  `mu_wplingua_original_uri()`); ambos corren en `after_setup_theme`, antes de `init`.
- Guard de compatibilidad: si `wplng_get_language_current_id` no existe (wpLingua off), no
  hace nada.

### 3.3 Alineación (verificar, normalmente sin tocar)
- **hreflang**: ya lo emite el tema (`seo-hreflang.php`) con `es-AR`/`pt-BR`/`en-US`/
  `x-default`; wpLingua lo retira `compat-wplingua-hreflang.php`. En la raíz local el
  canonical/hreflang debe ser la **raíz** (lo da WP con `REQUEST_URI='/'`). Verificar.
- **canonical (Rank Math)**: en raíz local debe ser `https://br.muyunicos.com/`. Verificar
  que no use `/pt/`.
- **country-scope.php**: usa `mu_wplingua_original_uri()` = `/` real → sigue reduciendo
  hreflang en rutas AR-only. No romper.
- **feed-google.php**: ya fuerza moneda por `?wcpbc-manual-country=XX`; no depende del idioma
  de la raíz. Sin cambios.
- **selector de país** (`geo.php`): no cambia (no redirige en la raíz; el override es interno).

## 4. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Otro plugin llama `wplng_get_language_current_id()` antes de `init` p0 y memoiza `es` | Resetear `$wplng_language_current_id=null` en p0 (ya previsto). Primer consumidor real es `wplng_ob_start` en p1. |
| Duplicado `/` vs `/pt/` en br (y `/en/` en us) | Reglas exactas 3.1 que mandan `/pt/`→`/` (y `/en/`→`/`). |
| Caché LiteSpeed sirve `es` en raíz br | Vary host ya activo (línea 14). Purgar tras deploy; probar en incógnito. |
| `compat-wplingua` captura `/pt/` en vez de `/` | Se captura en `after_setup_theme` (antes del override en `init`), así que queda `/`. Verificar con log. |
| `wplng_redirect_translated_slug` redirige | En raíz `url_current==url_translated`; no redirige. Verificado en el flujo. |
| Switcher de wpLingua apunta a `/pt/` | El tema usa su propio selector; si se usa el de wpLingua, la regla 3.1 lo normaliza a `/`. |
| Página 404/rutas técnicas con override | Guard: sólo path raíz exacto; excluir admin/ajax/cron/json. |

## 5. Archivos a tocar
- `muyunicos/htaccess` (quitar 97-103; añadir reglas exactas).
- `muyunicos/inc/idioma-raiz.php` (nuevo).
- `muyunicos/functions.php` (requerir el módulo tras `compat-wplingua.php`).
- Sin cambios en `seo-hreflang.php`, `country-scope.php`, `feed-google.php`, `geo.php`.

## 6. Verificación
```powershell
php -l inc\idioma-raiz.php; php -l functions.php
```
- Local (lab `C:\wp-lab`, junction al repo): `br.` y `us.` no existen en lab → validar el
  guard con host simulado (mapa `hosts` o `Host:` header) y `mu_wplingua_original_uri`.
- Producción (tras push + webhook): purgar LiteSpeed, incógnito:
  1. `https://br.muyunicos.com/` → **200**, HTML en **pt**, URL **sin** `/pt/`, sin 301.
  2. `https://us.muyunicos.com/` → **200**, HTML en **en**, URL raíz.
  3. `https://mexico.muyunicos.com/` → **200**, **es**, raíz.
  4. `https://br.muyunicos.com/tienda/` → 301 → `/pt/tienda/` (interno intacto).
  5. `https://br.muyunicos.com/pt/` → 301 → `/` (sin duplicado).
  6. hreflang en raíz br: `es-AR`→raíz, `pt-BR`→raíz, `en-US`→raíz, `x-default`→raíz.
  7. canonical raíz br = `https://br.muyunicos.com/`.
  8. Precio/moneda: br=BRL, us=USD, hisp=ARS (WCPBC por host).

## 7. Rollback
- `git revert` del commit (módulo + htaccess + functions). No hay migración de datos.
- Reversible sin tocar base de datos ni wpLingua.

## 8. Backlog Merchant (no bloquea este cambio)
- Restringir feed AR a Argentina; crear feeds por país (10); reclamar subdominios; configurar
  envío/impuestos por país. Independiente de la raíz.

## 9. Pendiente del handover aún vigente
- `robots.txt` del servidor (no está en repo): liberar bots IA/SEO ya hecho en `.htaccess`
  (líneas 144-147); alinear `robots.txt` del servidor.
- Título home "- Muy Únicos" y schema Organization/WebSite/LocalBusiness: fuera de este plan.