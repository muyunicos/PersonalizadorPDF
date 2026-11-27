# Plan: Títulos SEO de home por país (Muy Únicos)

## Contexto

**Marca (retrato):** Muy Únicos (Mar del Plata) vende productos **personalizados** y de
diseño propio. Dos negocios en una marca:
- **Argentina (físico):** etiquetas escolares, stickers, adhesivos, papelería y diseño en
  general; personalización a mano, +150 diseños.
- **Internacional (digital):** solo **digital para imprimir** (etiquetas imprimibles,
  stickers descargables) para **eventos, emprendimientos y organización del hogar**.
  `inc/digital-restriction.php` prohíbe el catálogo físico fuera de AR.

**Código actual** (`muyunicos/inc/seo-hreflang.php`):
- `mu_home_title_general()` (:170): descriptor por idioma, hoy genérico
  (`Personalizados para imprimir` / `Custom Printed Products`).
- `mu_home_title_pais()` (:192): en front no-AR compone `Sitio — general | País`;
  AR queda intacto (lo maneja Rank Math). Enganchado a `pre_get_document_title` (99999)
  y `rank_math/frontend/title`.

**Decisión del usuario (AR):** título keyword-first con la vertical de diseño:
`Etiquetas escolares, stickers y diseño personalizado | Muy Únicos`.

## Decisiones

- **D1 — AR (manual, Rank Math → Títulos y metadatos → Homepage):**
  `Etiquetas escolares, stickers y diseño personalizado | Muy Únicos`.
  No se toca AR en código (respeta la arquitectura existente).
- **D2 — Descriptor internacional** (`mu_home_title_general`), "diseños personalizados
  para imprimir" (decisión del usuario, opción #1):
  - `es` → `Diseños personalizados para imprimir`
  - `en` → `Custom Designs to Print`
  - `pt` → `Desenhos personalizados para imprimir`
- **D3 — Composición no-AR:** `Muy Únicos — {general} | {país}` con **guarda de longitud**:
  si supera 60 chars, reintentar sin marca → `{general} | {país}`.
- **D4 — Filtro con país:** `apply_filters( 'mu_home_title_general', $base, $lang, $country )`
  (3er arg) para permitir overrides por país sin tocar el core.
- **D5 — No tocar:** hreflang, canonical, AR en código, og/twitter (ya cubierto por
  `rank_math/frontend/title`).

## Tareas (ordenadas)

1. **`mu_home_title_general()`** (:170): reemplazar el mapa por D2 y pasar `$country` al
   filtro (D4). Mantener firma pública y `function_exists`.
2. **`mu_home_title_pais()`** (:192): composición con guarda de longitud (D3). Usar
   `get_bloginfo( 'name' )` con respaldo `Muy Únicos`; omitir el sufijo `| País` si el
   nombre del país está vacío.
3. **(Opcional) `mu_localize_document_title()`** (:138): `return $title` en
   `is_front_page()` para evitar el doble filtro (hoy lo descarta el de prioridad 99999).
4. **Manual (Rank Math):** fijar el título AR de D1 en Homepage.
5. **Validación** (abajo).

## Archivos / dónde

- `muyunicos/inc/seo-hreflang.php` (:170 `mu_home_title_general`, :192 `mu_home_title_pais`,
  opcional :138).
- Rank Math (wp-admin) → Títulos y metadatos → Homepage (solo AR, manual).

## Edge cases

- Longitud: MX/ES con descriptor largo ~70 chars → entra la guarda (cae a sin marca).
- País sin `name` → título sin `| País`.
- US (`en`) → descriptor en inglés; BR (`pt`) → portugués nativo.
- `is_front_page()` falso (home del blog) → no intervenir.
- No romper og:title/twitter:title (siguen `rank_math/frontend/title`).

## Validación

- `php -l muyunicos/inc/seo-hreflang.php` (sin errores).
- `curl.exe -s https://muyunicos.com/` → `<title>` = D1.
- `curl.exe -s https://mx.muyunicos.com/` (y co/cl/pe/ec/cr) →
  `Muy Únicos — Diseños personalizados para imprimir | México` (varía el país).
- `curl.exe -s https://br.muyunicos.com/` →
  `Muy Únicos — Desenhos personalizados para imprimir | Brasil`.
- `curl.exe -s https://us.muyunicos.com/` →
  `Muy Únicos — Custom Designs to Print | United States`.
- Rich Results Test / Search Console: título y canonical correctos por host.

## Fuera de alcance

- Meta descriptions por país (P7), schema/AggregateRating, robots.txt, og/twitter dedicados.
- Cualquier cambio en `personalizador-pdf` (esto vive en el tema `muyunicos`).