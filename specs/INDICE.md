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
| [012-campos-consola](./012-campos-consola/) | **36/38 `[X]` + 1 `[~]`** (F0-F7, v4.4.0), **verificada en navegador real** (lab, sin Woo, por el shortcode `[pmu_personalizar]`): F5 (global CSS/JS), F6 (cargador subiendo 2 fotos de verdad) y F7 (motor con N imagenes + conciliacion que nunca bloquea). Falta F8 (docs) | T031 (recorrido manual, `MANUAL-PENDIENTE-WP-REAL.md` §8) + T011b (FR-009, depende de F6) + los pendientes `[~]` | spec + plan + research + data-model + contracts/campos.md (enmienda la v1: el campo pierde `tipo`, `nombre` != `titulo_cliente`) + contracts/campos-consola.md + quickstart + tasks. Editor en linea sin recarga, preview en iframe con el **mismo** montaje que la ficha (`assets/campo-montar.js`), buscar/filtrar/ordenar con columna de uso, 3 plantillas + marcar/duplicar/restaurar, CSS/JS global (uno del plugin, prefijado `[data-pmu-panel]`), cargador del comprador (`CargadorPMU`, N ranuras, `min` como validacion real, `subidas/`), y el Motor acepta N imagenes por grupo. **Export/import fuera de alcance** (D22) y **nunca bloquea la compra** (D17-D19) |
| [013-consola-campos-ux](./013-consola-campos-ux/) | **12/12 `[X]` + 3 `[~]` fuera de alcance** (v4.4.0), verificada en navegador real | — | spec + plan + tasks. Mejora de uso de la pestana Campos, **sin tocar motor ni datos**. Orden por frecuencia de uso (lista primero, "Nuevo campo" como boton, estilos globales al pie y plegados), el editor sale de la tabla a un **drawer** que sirve para alta y edicion, la vista previa en **modal al ancho del panel del comprador** (la columna de una ficha de Woo, 324-538 px) que se abre **desde la lista sin entrar a editar**, y las acciones de la fila con **iconos del core** (el estado de plantilla va en `aria-pressed`). Enmienda de la 012 solo el *lugar* del global (FR-024 se conserva: se edita desde Campos, sin navegar) |
| [014-comprador-invitado](./014-comprador-invitado/) | **7/7 `[X]`** (v4.4.0), verificada en navegador **sin sesion** | T031 (recorrido manual con Woo real; el lab no lo tiene) | spec + plan + tasks. El comprador puede ser un **invitado** (checkout sin cuenta, el default de WooCommerce): los 4 endpoints que exigian `current_user_can('read')` se autorizan ahora por la **cookie `pmu_sid`** (`sesion_del_comprador()`). El `sid` del POST se ignora, lo que cierra de paso un hueco que existia **tambien para los logueados** (el nonce va impreso en la ficha, o sea que es publico). Requisito del negocio decidido por el usuario el 2026-10-05 |
| [015-tipo-y-overrides](./015-tipo-y-overrides/) | **especificada, 0 implementadas** | — | spec + plan + tasks (2026-10-05) |

Recorrido manual unico (cubre T030 + T012 + T017 + T029 + T051 en una sesion):
[MANUAL-PENDIENTE-WP-REAL.md](./MANUAL-PENDIENTE-WP-REAL.md).

## En especificacion (sin implementar)

| Spec | Estado | Docs normativos |
|------|--------|-----------------|
| [009-galerias-sprite-unificado](./009-galerias-sprite-unificado/) | spec + clarificaciones (2026-09-30), checklist 16/16, `plan.md` + `tasks.md` (2026-10-01); pendiente implementacion | spec + plan + data-model + contracts/ + quickstart + tasks (continua el contrato de 006: certificacion de hoja para los 3 ambitos, generacion automatica de huecos, Google Fonts por familia unica) |
| [010-api-wordpress](./010-api-wordpress/) | spec + contrato + `plan.md` (2026-10-01), decisiones D1-D5 cerradas; pendiente `data-model.md` + `quickstart.md` + `tasks.md` | spec + plan + contracts/api.md (endpoint unico `admin_post_pmu_api` con `op=`; raster por grupo, Application Passwords, `uploads/pmu/api/{job_id}/` con TTL 7 dias, sincrono; enmienda de constitucion 2.0.1 -> 2.1.0 declarada) |
| [015-tipo-y-overrides](./015-tipo-y-overrides/) | spec + plan + tasks (2026-10-05), decisiones D1-D11 cerradas; **implementada (2026-10-05: commits `5f7c012` + `7187328` + cierre)**; **enmienda la FR-5.2 de la 004**, que se escribio como si funcionara y **nunca funciono** hasta aqui. Dos commits: (1) **Tipo** en el campo (`plantilla` -> `tipo` con `texto\|imagen\|opciones`), **Categorias fuera**, estrella de Plantilla fuera, tabla de 6 columnas; (2) **los overrides que funcionan**: `settings` pasa a ser solo lista de referencias, se parsea el `valor` de cada campo y se fusiona en orden hacia `items[].overrides`. **Hallazgo clave**: `modules/textmuy/` **ya esta listo** (`renderBatch` acepta `overrides` y hace `mergeDeep`), asi que la spec **no toca el modulo**. Y el Motor no renderiza texto (solo pega PNGs), asi que **la vista previa ES el PDF final**. 6 hallazgos verificados con archivo y linea en el spec |

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
