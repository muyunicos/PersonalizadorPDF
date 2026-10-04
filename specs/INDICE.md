# Indice de specs — Personalizador PDF

> Jerarquia: `constitution` (.specify/memory/constitution.md) > `AGENTS.md` > resto.
> Ultima actualizacion: 2026-10-03 (modulo en RC40 con 21 suites Node; documentacion de entorno del plugin alineada).

## Activos (codigo completo, falta solo manual WP real)

| Spec | Codigo | Pendiente manual | Docs normativos |
|------|--------|------------------|-----------------|
| [004-woocommerce-pdf-personalization](./004-woocommerce-pdf-personalization/) | 33/34 `[X]` (T031 verde) | T030 | spec, plan, data-model, contracts/, quickstart §1 (auto) |
| [005-pdf-condicionales](./005-pdf-condicionales/) | T001–T011 `[X]` | T012-recorrido (lo cubre T030) | spec, contracts/validez.md, quickstart §1 (auto) |
| [006-align-textmuy-motor](./006-align-textmuy-motor/) | 27/29 `[X]` (T026/T027/T028 verde) | T017 + T029 | spec, contracts/, quickstart §1+§2+§7 (auto) |
| [011-editor-mockups-visual](./011-editor-mockups-visual/) | **52/53 `[X]` + 1 `[~]`** (v4.3.0), implementada y **verificada en el sitio real el 2026-10-01** (3 bugs corregidos: API del nucleo, orden de dibujo asincrono, etiqueta HTML sin `>`); falta 1 requisito de UI (T034, aplazado a peticion del usuario) | T051 (recorrido manual, `MANUAL-PENDIENTE-WP-REAL.md` §2) + los 5 pendientes `[~]` | spec + plan + research + data-model + contracts/mockup-capas.md + quickstart + tasks. Editor de mockups en 2 columnas con manipulacion directa; nucleo de render compartido `assets/mockup-render.js` (editor + ficha), geometria pura `assets/mockup-geometria.js`; 2 puertas Node (`tests/mockup-geometria.test.js`, `tests/mockup-contrato.test.js`); `ref` con namespace `pdf:`/`mock:` (catalogo exclusivo de mockups); ajustes por capa ampliados (incluye `gama`, antes guardada y no aplicada); encaje sin deformar; autoguardado + deshacer; sin tocar `modules/textmuy/` |

Recorrido manual unico (cubre T030 + T012 + T017 + T029 + T051 en una sesion):
[MANUAL-PENDIENTE-WP-REAL.md](./MANUAL-PENDIENTE-WP-REAL.md).

## En especificacion (sin implementar)

| Spec | Estado | Docs normativos |
|------|--------|-----------------|
| [012-campos-consola](./012-campos-consola/) | spec + clarificaciones D1-D12 (2026-10-04), `plan.md` + `research.md` + `data-model.md` + `contracts/` + `quickstart.md` + `tasks.md` (F0-F8, 32 tareas, 0 implementadas); **pendiente implementacion** | spec + plan + research + data-model + contracts/campos.md (enmienda la v1: el campo pierde `tipo`, `nombre` != `titulo_cliente`) + contracts/campos-consola.md (UI y handlers) + quickstart + tasks. Editor en linea sin recarga, preview en iframe con el mismo montaje que la ficha, buscar/filtrar/ordenar, 3 plantillas + duplicar/restaurar/importar/exportar, CSS/JS global (uno del plugin, prefijado `[data-pmu-panel]`), cargador de imagenes del comprador (`CargadorPMU`, N ranuras, drag & drop, `tmp/sesion-{sid}/{item_key}/subidas/`), y el Motor pasa a aceptar N imagenes por grupo |
| [009-galerias-sprite-unificado](./009-galerias-sprite-unificado/) | spec + clarificaciones (2026-09-30), checklist 16/16, `plan.md` + `tasks.md` (2026-10-01); pendiente implementacion | spec + plan + data-model + contracts/ + quickstart + tasks (continua el contrato de 006: certificacion de hoja para los 3 ambitos, generacion automatica de huecos, Google Fonts por familia unica) |
| [010-api-wordpress](./010-api-wordpress/) | spec + contrato + `plan.md` (2026-10-01), decisiones D1-D5 cerradas; pendiente `data-model.md` + `quickstart.md` + `tasks.md` | spec + plan + contracts/api.md (endpoint unico `admin_post_pmu_api` con `op=`; raster por grupo, Application Passwords, `uploads/pmu/api/{job_id}/` con TTL 7 dias, sincrono; enmienda de constitucion 2.0.1 -> 2.1.0 declarada) |

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
