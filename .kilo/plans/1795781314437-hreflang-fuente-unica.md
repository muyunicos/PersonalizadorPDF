# Briefing para el próximo agente (modo Plan)
## Idioma por defecto en la raíz (BR/US) + `/es/` como alternativa

> Este archivo es **contexto de handoff**, no un plan final. El próximo agente en modo Plan debe
> **investigar la viabilidad con wpLingua** y producir un plan de implementación mejorado.

## Objetivo ampliado (lo que quiere el usuario)
- **BR** (`br.muyunicos.com`): **raíz = portugués** (idioma por defecto del país), y **`/es/`** = español.
- **US** (`us.muyunicos.com`): **raíz = inglés** (idioma por defecto del país), y **`/es/`** = español.
- **Países hispanos** (`mexico.` `co.` `es.` `cl.` `pe.` `ec.` `cr.`): **raíz = español** (sin `/es/`).
- Se mantiene: **subdominio = país/moneda** (WCPBC) e **idioma = wpLingua**.
- **Importante**: el usuario **rechaza** la solución actual de redirección `br/`→`/pt/` y `us/`→`/en/`.
  Quiere que la **raíz sirva el idioma local sin redirección** (URL queda `br.`/`us.`).

## Situación actual (con evidencia)
- **`.htaccess`** (`muyunicos/htaccess`):
  - p14: regla LiteSpeed `E="Cache-Control:no-autoflush,vary=host%{HTTP_HOST}"`.
  - p93: bloque "IDIOMA POR PAIS": `br/`→301 `/pt/`, `us/`→301 `/en/`, y hispanos `/pt/`,`/en/`→raíz.
    → **Esto es lo que hay que reemplazar** por el enfoque A (rewrite interno, sin redirección).
  - p145: bots liberados; p167: `Options All` eliminado.
- **`inc/geo.php`**: país por subdominio (`muyu_get_countries_data()`, `muyu_get_current_country_from_subdomain()`),
  filtros `woocommerce_customer_default_location[_array]` (p636/654), moneda por país.
- **`inc/seo-hreflang.php`**: hreflang custom con códigos `es-{CC}`, `pt-BR`, `en-US`, `x-default` AR
  (el hreflang de wpLingua ya se removió).
- **`inc/compat-wplingua.php`**: conserva el prefijo de idioma en el 301 canónico.
- **`inc/feed-google.php`**: feed por país (WCPBC) en `/feed-google.xml`; usa `muyu_get_countries_data()`.
- **wpLingua**: idioma por defecto **global** = `es` en la raíz de **todos** los subdominios; `/pt/` y `/en/`
  como subdirectorios en todos los hosts. **No soporta** "raíz = pt/en por subdominio".

## Restricción técnica clave (a validar)
- wpLingua resuelve el idioma **por la URL** (prefijo `/pt/`, `/en/`). La raíz (`/`) siempre sirve el
  idioma por defecto global (`es`). Por eso "raíz = pt/en" **no es nativo**.
- El enfoque **A (rewrite interno)** intenta: que la raíz de BR/US sirva el contenido de `/pt/` y `/en/`
  **sin cambiar la URL**, que `/pt/` y `/en/` redirijan a la raíz (canónica), y que `/es/` quede como
  español. **Riesgo**: chocar con el switcher de wpLingua, el canonical, el hreflang y la caché.

## Qué debe investigar el próximo agente (modo Plan)
1. **Cómo wpLingua resuelve el idioma**: ¿engancha `parse_request`/`request`/`wp` para leer el prefijo?
   ¿Qué pasa si el path es `/` pero se necesita servir pt/en? (Leer el plugin `wp-content/plugins/wplingua`.)
2. **Viabilidad del rewrite interno**: ¿se puede servir `/pt/` en la raíz de `br.` sin redirección y sin
   romper el switcher/canonical? ¿O conviene un `wp` action que fije el idioma y cargue la home traducida?
3. **Alineación de canonical/hreflang**: la raíz `br/` debe ser canónica de pt-BR; `/es/` canónica de es;
   `/pt/`→`/` (301). Ver `inc/compat-wplingua.php` y `inc/seo-hreflang.php`.
4. **Caché LiteSpeed**: el vary por host ya existe; validar que la raíz cachee la variante correcta por host.
5. **Switcher de idioma**: que en BR muestre pt (activo) y es (alternativa), y viceversa en US.
6. **Feed Google**: los `link` del feed deben apuntar a la URL canónica resultante (raíz o `/es/`).
7. **Rutas solo-AR / `country-scope.php`**: no romper el hreflang reducido.

## Archivos clave
- `muyunicos/htaccess` (bloque IDIOMA POR PAIS p93).
- `muyunicos/inc/compat-wplingua.php`, `inc/seo-hreflang.php`, `inc/geo.php`, `inc/feed-google.php`.
- `muyunicos/functions.php` (carga de módulos).
- Plugin **wpLingua** (`wp-content/plugins/wplingua`) — investigar su resolución de idioma.

## Preguntas abiertas a resolver (para el plan mejorado)
- ¿El rewrite interno es viable o hay que ir a **B** (Polylang/WPML "dominios por idioma")?
- ¿`/es/` en BR/US se sirve como subdirectorio de wpLingua o hay que excluirlo/redirigirlo?
- ¿Cómo queda el hreflang final (raíz=pt/en, `/es/`=es, hispanos raíz=es)?
- ¿Impacto en `feed-google.php` (links) y en el switcher?

## Validación (a definir en el plan)
- `curl.exe -sI https://br.muyunicos.com/` → 200 (sin 301), contenido en portugués, canónica `br/`.
- `curl.exe -sI https://us.muyunicos.com/` → 200, inglés, canónica `us/`.
- `/es/` en BR/US → español, canónica `/es/`.
- hreflang: pt-BR→`br/`, en-US→`us/`, es→`.../es/`, hispanos→raíz.
- Switcher y caché por host OK.

## Fuera de alcance
- Feeds Merchant (otro plan), `robots.txt`, schema Organization, title home.
- El fix de precio local/caché (plan previo, ya aplicado).

## Estado de los planes previos (referencia)
- Precio local por subdominio: aplicado (geo.php + compat-litespeed + htaccess vary).
- hreflang fuente única: aplicado (seo-hreflang.php `es-{CC}`).
- Feeds WCPBC: aplicado (`inc/feed-google.php`), Merchant en curso por el usuario.