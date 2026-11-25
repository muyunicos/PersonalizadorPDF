# Design — add-api-wordpress

## Context

El plugin procesa PDFs en hosting compartido (Hostinger Business, solo PHP) sin Node/Python/
`exec`. El objetivo de negocio es una API que reciba el nombre de un PDF base y un archivo
por grupo y devuelva la URL del PDF procesado. La spec legacy `specs/010-api-wordpress/`
tiene alcance y decisiones D1-D5 cerradas; falta implementarla.

## Goals / Non-Goals

### Goals

- API sincrona servidor-a-servidor con endpoint unico `admin_post_pmu_api` + `op=`.
- Autenticacion del nucleo (Application Passwords + `manage_options` + HTTPS).
- Validacion estricta contra `analisis.json`, idempotencia por `job_id` y TTL 7 dias.
- Cero entregables parciales; causas `api:<op>:<motivo>`.

### Non-Goals

- Render de texto en el servidor (incompatible con `constitution` §III).
- Analisis de PDFs nuevos por la API (los sube el admin por consola).
- Modo asincrono con `job` consultable (v1 es sincrona).
- Gestion de productos/pedidos Woo, cobro, o tablas en base de datos.

## Decisions

- **D1 — Raster por grupo**: la API recibe un archivo rasterizado por grupo; el texto con
  estilo lo rasteriza el consumidor en su navegador (TextMuy RenderCore) y lo envia como la
  imagen del grupo. El servidor no distingue foto de texto estilizado.
- **D2 — Autenticacion del nucleo**: Application Passwords (WP >= 5.6) + `manage_options` +
  HTTPS. Se descarta token propio en `uploads/` y claves REST de Woo.
- **D3 — Entregable y retencion**: `uploads/pmu/api/{job_id}/` con `manifest.json`, pool
  `img/` y `{pdf}_procesado.pdf`; TTL 7 dias configurable con purga diferida; `job_id` idempotente.
- **D4 — Sincro**: v1 responde de forma sincrona; el modo asincrono queda como extension.
- **D5 — Endpoint unico**: `admin_post_pmu_api` (+ `nopriv`) con dispatcher `op=`; sin rutas REST.
- **Dependencia**: subir `readme.txt` `Requires at least` a 5.6 (Application Passwords).

## Risks / Trade-offs

- **Typo del consumidor** -> validacion estricta (un id inexistente es error, no hueco vacio).
- **Acumulacion de entregables** -> TTL con purga diferida (cron + oportunista).
- **Reintentos del consumidor** -> idempotencia por `job_id` (reuso sin regenerar; conflicto sin sobrescribir).
- **Hosting compartido sin cron fiable** -> purga oportunista al procesar, barrido acotado.
- **Fuga de rutas fuera de PMU_Uploads** -> SC-010 (grep de control) y helpers del ambito `api`.

## Migration Plan

1. Implementar endpoint + auth (fase scaffold).
2. `op=procesar` con `Motor::procesar` + validacion estricta.
3. Idempotencia por `job_id`, TTL/purga, limites.
4. Fases en `tests/texto_puente.php`, smoke en pestaña Test, docs/readme 5.6.
5. No archivar: queda activo como trabajo futuro.

## Open Questions

- Ninguna cerrada; el detalle de implementacion se resuelve al aplicar el change.