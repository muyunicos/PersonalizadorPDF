# Indice de specs — Personalizador PDF

> Jerarquia: `constitution` (.specify/memory/constitution.md) > `AGENTS.md` > resto.
> Ultima actualizacion: 2026-10-01 (auditoria de documentacion: RC37 + 16 suites sincronizados; 009 en especificacion con plan y tasks).

## Activos (codigo completo, falta solo manual WP real)

| Spec | Codigo | Pendiente manual | Docs normativos |
|------|--------|------------------|-----------------|
| [004-woocommerce-pdf-personalization](./004-woocommerce-pdf-personalization/) | 33/34 `[X]` (T031 verde) | T030 | spec, plan, data-model, contracts/, quickstart §1 (auto) |
| [005-pdf-condicionales](./005-pdf-condicionales/) | T001–T011 `[X]` | T012-recorrido (lo cubre T030) | spec, contracts/validez.md, quickstart §1 (auto) |
| [006-align-textmuy-motor](./006-align-textmuy-motor/) | 27/29 `[X]` (T026/T027/T028 verde) | T017 + T029 | spec, contracts/, quickstart §1+§2+§7 (auto) |

Recorrido manual unico (cubre T030 + T012 + T017 + T029 en una sesion):
[MANUAL-PENDIENTE-WP-REAL.md](./MANUAL-PENDIENTE-WP-REAL.md).

## En especificacion (sin implementar)

| Spec | Estado | Docs normativos |
|------|--------|-----------------|
| [009-galerias-sprite-unificado](./009-galerias-sprite-unificado/) | spec + clarificaciones (2026-09-30), checklist 16/16, `plan.md` + `tasks.md` (2026-10-01); pendiente implementacion | spec + plan + data-model + contracts/ + quickstart + tasks (continua el contrato de 006: certificacion de hoja para los 3 ambitos, generacion automatica de huecos, Google Fonts por familia unica) |

## Archivados (trazabilidad, no implementar)

| Ruta | Que es |
|------|--------|
| [_archivo/003-galeria-engine/](./_archivo/003-galeria-engine/) | Obsoleto 2026-09-16, superado por 006. Tareas referencian `engine/PMU_Uploads.php` (inexistente). |
| [004-woocommerce-pdf-personalization/_archivo/](./004-woocommerce-pdf-personalization/_archivo/) | Diseno 2026-09-13 derogado por norma 2026-09-17 (data-model, quickstart, tasks viejos). |
| [_archivo/007-layout-historico/](./_archivo/007-layout-historico/) | Spec historico `metadata.json` unica fuente, derogado por norma ex-008. |
| [_archivo/auditoria-galeria-RC34-RC36.md](./_archivo/auditoria-galeria-RC34-RC36.md) | Auditoria galeria RC34–RC36 (ex `007-galeria-textmuy/research.md`). Nunca fue feature; sin backlog. Canonico: `modules/textmuy/AGENTS.md`. |

## Norma vigente (resumen)

- `constitution` §I+§IV: mockup obligatorio 300x300 (salvo `preview_omisible`), sesion
  por item `tmp/sesion-{sid}/{item_key}/`, pool dedicado `img/{pdf}-{id}-{n}.png`,
  `preview_estado` (`ok`|`sin_vista`|`omisible`), multivinculo `_pmu_pdf_slugs` +
  `tienda{pid}` (005: `activo`/`validez`/`mensaje_html`/`bloquear`; JS solo navegador).
- Dataset PDF: `analisis.json` (inmutable) + `config.json` (editable). Sin `textos.json`
  ni `metadata.json`. Motor unico `PMU_Uploads` (`inc/class-pmu-uploads.php`),
  endpoint unico `admin_post_pmu_uploads` con `op=`.
