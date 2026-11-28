# Handoff — Investigar categorias fisicas que se vacian y terminan en 404 (modo PLAN)

> Documento de traspaso para un agente NUEVO en ventana de contexto limpia.
> Mision: **seguir INVESTIGANDO en modo plan**. NO editar codigo, NO pushear, NO desplegar.
> Al finalizar, entregar un plan de fix (no aplicarlo) para aprobacion del usuario.

---

## 1. El problema (reporte del usuario, textual)

- La categoria **Outlet** queda vacia "pasado un tiempo". Al visitarla tiene **menos articulos**
  cada vez, hasta que finalmente dice **"la pagina no existe" (404)**.
- Lo mismo pasa con **otras categorias de articulos fisicos**, pero **principalmente Outlet**.
- Lleva pasandole "hace mucho tiempo" (recurrente, no un pico puntual).

## 2. Lo que YA se investigo (no repetir de cero)

### 2.1 Descartado: el plugin Personalizador PDF (este repo)
- `inc/class-pmu-sesion.php:1836` `limpiar_ttl()` solo barre `uploads/pmu/tmp/sesion-*` y
  `uploads/pmu/orders/`. **No toca productos ni categorias de WooCommerce.**
- Grep de `wp_delete_post|wp_delete_term|wp_trash_post` en todo el repo del plugin = **0 hits**.
- Conclusion: el plugin NO es la causa. No perder tiempo aca.

### 2.2 La causa vive en el TEMA sibling `muyunicos` (otro repo)
- Repo local: `C:\Users\Jonatan\Documents\GitHub\muyunicos`
- En el lab se monta por junction en:
  `C:\wp-lab\wordpress\wp-content\themes\generatepress-child` (leer del lab == leer el repo).
- Archivo clave: `inc/digital-restriction.php` (clase `MUYU_Digital_Restriction_System`, header v4.8.0).
- El sintoma esta **documentado** en `MIGRATION-GUIDE.md:661` ("ERRORES 404 INTERMITENTE EN
  CATEGORIAS FISICAS (v4.7.0)"): `/outlet/` y otras categorias fisicas dan 404 tras unos dias;
  "Actualizar" la categoria lo arregla temporalmente.

### 2.3 Como funciona el sistema (resumen para no releer todo)
- `muyunicos.com` (dominio raiz, AR) vende fisicos; subdominios (`us.`, `pt.`, etc.) = restringidos
  (solo digitales). `is_restricted_user()` (`digital-restriction.php:132`) decide por `HTTP_HOST`:
  todo host != `muyunicos.com` (quitando `www.`) es restringido.
- Indices en `wp_options`: `muyu_digital_product_ids`, `muyu_digital_category_ids`,
  `muyu_phys_to_dig_map`, `muyu_cat_redirect_map`, etc.
- `rebuild_digital_indexes()` (`:307`) recalcula indices; `save_indexes()` (`:515`) los escribe.
- `filter_product_queries()` (`:637`) filtra productos en ficha/subdominios;
  `filter_category_terms()` (`:725`) filtra categorias en subdominios;
  `handle_redirects()`/`handle_404_category_redirect()` (`:770`/`:868`) redirigen fisicos a digitales.
- Cron: `schedule_rebuild()` (`:573`) agenda `muyu_cron_rebuild_digital_indexes` +30s (cooldown 1h).
- Cache 404: `mu_litespeed_nocache_404()` (`compat-litespeed.php:40`) evita cachear 404 (mitigado).

### 2.4 Mitigaciones ya presentes (por que quizas no alcanza)
- Guard anti-vacio en `rebuild_digital_indexes()` (`:310`) y en `filter_category_terms()` (`:741`).
- Hash Gate en `save_indexes()` (`:534`) para no purgar si no cambio el set.
- `mu_litespeed_nocache_404()` + fast-exit anti-bots.

## 3. Las DOS hipotesis concretas abiertas (ranking)

### H1 (alta) — Guard solo cubre vacio TOTAL, no PARCIAL
- `rebuild_digital_indexes()` (`:310`) solo corta si `empty($digital_product_ids)`.
- Si el rebuild devuelve un set **parcial** (timeout a mitad, query degradada, WCPBC) pero NO vacio,
  `save_indexes()` igual **sobrescribe** los indices buenos con datos incompletos.
- Efecto: Outlet pierde articulos (categorias que dejan de estar en el indice) y el mapa
  `muyu_cat_redirect_map` se degrada -> 404. **Encaja con "menos articulos" gradual + 404 final.**
- Verificar: comparar tamaño/set de `muyu_digital_category_ids` y `muyu_cat_redirect_map` en
  momentos distintos; buscar caidas bruscas. Revisar si hay log de rebuild fallido.

### H2 (alta) — El CRON corre como "usuario restringido" y corrompe el redirect map
- En cron NO hay `HTTP_HOST` -> `is_restricted_user()` (`:132`) devuelve **true**.
- Durante el rebuild, `build_category_redirect_map()` (`:412`) llama `get_terms()`, que
  `filter_category_terms()` (`:725`) filtra a **solo categorias digitales** (porque se cree
  restringido). Resultado: el mapa `by_id`/`by_slug` se construye **sin** las categorias fisicas
  (outlet, stickers, tienda-juegosparawii) -> en subdominios esas URLs no redirigen y dan 404.
- `filter_category_terms` tiene guard `is_404()` y anti-vacio, pero NO cubre el contexto cron.
- Verificar: reproducir un rebuild por CLI/cron y volcar `muyu_cat_redirect_map`; confirmar que
  faltan los slugs fisicos. Revisar si `mu_rebuild_all_indexes()` (functions.php) fija host/usuario.

### H3 (media) — Cache/partial render de LiteSpeed
- `mu_litespeed_nocache_404` cubre 404, pero una pagina **parcial** (menos articulos) cacheada
  durante un rebuild degradado se sirve stale hasta purga.
- Verificar: `curl -s -D - -o /dev/null` (GET, no HEAD) a `/outlet/` en raiz y subdominios;
  mirar `x-litespeed-cache: hit/miss` y si el contenido cambia tras purga.

## 4. Entorno y comandos utiles (Windows + pwsh)

- Shell canonico: PowerShell 7 (`pwsh`). Secuenciar con `;`. No usar sintaxis bash.
- Lab WP+Woo real: `C:\wp-lab` (arrancar: `pwsh C:\wp-lab\arrancar.ps1`).
- Tema (repo real): `C:\Users\Jonatan\Documents\GitHub\muyunicos`.
- Version tema: `style.css` Version 3.7.4.x (base GeneratePress); `functions.php` @version 1.3.1;
  `digital-restriction.php` header v4.8.0. `git -C <repo> log --oneline -8 -- inc/digital-restriction.php`.
- Lint tras cualquier cambio (si en el futuro se autoriza): `php -l inc/digital-restriction.php`.
- **Deploy = push + webhook Hostinger.** NO pushear sin aprobacion explicita del usuario.

## 5. Reglas de conducta para el agente nuevo

- Modo PLAN: solo leer/investigar. **No editar, no commitear, no pushear, no desplegar.**
- Responder en **espanol** (codigo sin tildes).
- Jerarquia documental: `constitution` > `AGENTS.md` > resto. Leer AGENTS.md del repo que se toque.
- No inventar: si algo no se puede probar, decirlo y proponer como verificarlo.
- Entregable final: **plan de fix** (archivos/lineas a tocar, patron de fix propuesto para H1 y H2,
  y como validarlo con `php -l` + una corrida de rebuild observando los indices), para que el
  usuario lo apruebe antes de aplicar.

## 6. Primeros pasos sugeridos (para arrancar el agente nuevo)

1. Leer `inc/digital-restriction.php` completo (1208 lineas) y `MIGRATION-GUIDE.md:661-700`.
2. Confirmar H2: ver si `mu_rebuild_all_indexes()` (buscar en `functions.php`) fija `HTTP_HOST` o
   usuario antes de llamar al rebuild; si no, H2 queda confirmada como gap.
3. Confirmar H1: revisar si existe algun log/registro de rebuild y si el guard solo mira `empty()`.
4. Medir en el lab: volcar `get_option('muyu_digital_category_ids')` y `muyu_cat_redirect_map`
   antes/despues de un rebuild manual; ver si outlet/stickers/wii desaparecen.
5. Redactar el plan de fix sin aplicarlo.