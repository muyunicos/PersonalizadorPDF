# Plan — Raíz en el idioma local, sin redirect (wpLingua 3.2.1)

> Fuente de verdad del comportamiento: **wpLingua 3.2.1 instalado en el servidor**
> (descargado a `muyunicos/wplingua/`), verificado idéntico a 3.3.1 en las funciones clave.
> Supera el handover `1795781314437-hreflang-fuente-unica.md`.

## 0. Corrección clave respecto al handover
- **No** sirve rewrite interno en `.htaccess`: wpLingua deriva el idioma de
  `$_SERVER['REQUEST_URI']` capturado en `plugins_loaded`; un rewrite interno no cambia
  `REQUEST_URI` (seguiría `/` → `es`). Descartado.
- **Vía correcta**: sobrescribir el global `$wplng_request_uri` en `init` **p0** (antes del
  `wplng_ob_start` de wpLingua en `init` p1), **solo** para la raíz `/` y **solo** en hosts
  `br.` / `us.`. No se toca `.htaccess` para la raíz, ni WP routing, ni hreflang.

## 1. Mecanismo wpLingua 3.2.1 (evidencia)
- `wplng_get_language_current_id()` (`inc/languages.php:354`): lee global `$wplng_request_uri`
  (fijado en `wplng_start()` a `plugins_loaded` desde `REQUEST_URI`). Prefijo `/<lang>/` →
  ese idioma; si no, default global `es` (`wplng_website_language`). Memoiza en
  `$wplng_language_current_id`.
- `wplng_ob_start()` (`inc/buffering.php:65`, `init` p1) rama front (`:150`): si
  `website==current` → `return` (sirve `es`); si difieren → `origin` (quita `/pt/`), fija
  `REQUEST_URI` a la original y abre buffer que traduce HTML `es`→`pt`.
- `wplng_redirect_translated_slug()`: en raíz con override `url_current==url_translated` → no
  redirige.
- Sin resolución por host/navegador: default único global → por eso hay que interceptar.

## 2. Flujo resultante en `br.muyunicos.com/` (verificado)
1. `plugins_loaded`: `$wplng_request_uri='/'`.
2. `after_setup_theme`: `compat-wplingua.php` captura `mu_wplingua_original_uri='/'` (real).
3. `init` p0 (módulo nuevo): raíz + host `br.` → `$wplng_request_uri='/pt/'`;
   `$wplng_language_current_id=null`.
4. `init` p1 `wplng_ob_start`: `pt`≠`es` → `origin='/'`, `REQUEST_URI='/'`, buffer traduce.
5. `parse_request` resuelve `/` (home `es`). `template_redirect` no redirige.
6. HTML final en `pt`, **URL `/` sin redirect**. ✔

## 3. Cambios concretos
### 3.1 `muyunicos/htaccess`
- Quitar las 2 reglas 301 de raíz (líneas **97-103**).
- Mantener hispanos `^(pt|en)...`→raíz (105-107) y LiteSpeed vary host (línea 14).
- Añadir redirección **exacta** del idioma-raíz a `/` (evita duplicado):
  ```apache
  RewriteCond %{HTTP_HOST} ^br\.muyunicos\.com$ [NC]
  RewriteRule ^pt/?$ / [R=301,L]
  RewriteCond %{HTTP_HOST} ^us\.muyunicos\.com$ [NC]
  RewriteRule ^en/?$ / [R=301,L]
  ```
### 3.2 Nuevo `inc/idioma-raiz.php`
- `mu_idioma_raiz_prefijo()`: `pt` (br), `en` (us), `''` resto.
- `add_action('init','mu_idioma_raiz_fijar',0)`: sólo front (no admin/ajax/cron/json), sólo
  path raíz real (`mu_wplingua_original_uri()`), sólo con prefijo →
  `$GLOBALS['wplng_request_uri']='/'.$prefijo.'/'`; `$GLOBALS['wplng_language_current_id']=null`.
- Guard si `wplng_get_language_current_id` no existe (wpLingua off) → no-op.
- Cargar desde `functions.php` **tras** `compat-wplingua.php`.

### 3.3 Verificar (normalmente sin tocar)
- hreflang (tema) y canonical (Rank Math) en raíz local = la raíz; country-scope usa
  `mu_wplingua_original_uri()`=`/` real (no romper); feed-google fuerza moneda (sin cambios).

## 4. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Memoización previa de `es` | Reset `$wplng_language_current_id=null` en p0 (primer consumidor real es p1). |
| Duplicado `/` vs `/pt/` | Reglas exactas 3.1 `/pt/`→`/`, `/en/`→`/`. |
| Caché sirve `es` en raíz br | Vary host (línea 14) + purga + incógnito. |
| `compat-wplingua` captura `/pt/` | Se captura en `after_setup_theme` (antes del override). Verificar. |
| Switcher wpLingua a `/pt/` | Tema usa selector propio; regla 3.1 normaliza. |

## 5. Archivos
- `muyunicos/htaccess`; `muyunicos/inc/idioma-raiz.php` (nuevo); `muyunicos/functions.php`.
- Sin cambios: `seo-hreflang.php`, `country-scope.php`, `feed-google.php`, `geo.php`.

## 6. Verificación
```powershell
php -l inc\idioma-raiz.php; php -l functions.php
```
Producción (push+webhook, purga LiteSpeed, incógnito):
1. `br/` → 200 pt, URL raíz, sin 301. 2. `us/` → 200 en, raíz. 3. `mexico/` → 200 es.
4. `br/tienda/` → 301 `/pt/tienda/`. 5. `br/pt/` → 301 `/`. 6. hreflang raíz br correcto.
7. canonical raíz br = `https://br.muyunicos.com/`. 8. Moneda br=BRL/us=USD/hisp=ARS.

## 7. Rollback
`git revert` del commit (módulo + htaccess + functions). Sin migración de datos.

## 8. Backlog Merchant (no bloquea)
Restringir feed AR a Argentina; feeds por país (10); reclamar subdominios; envío/impuestos.

## 9. Fuera de alcance
`robots.txt` del servidor (alinear con `.htaccess` 144-147); título home "- Muy Únicos" y
schema Organization/WebSite/LocalBusiness.