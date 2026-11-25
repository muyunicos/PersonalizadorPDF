# Proposal

## Why

El objetivo de negocio declarado del sistema es procesar compras de PDFs editados via una
API con WordPress: recibir el nombre de un PDF base y un archivo por grupo, y devolver la URL
al PDF procesado. Hoy solo es posible con sesion de administrador en el panel; sin API el
plugin se usa de forma manual.

## What Changes

- Nuevo endpoint unico `admin_post_pmu_api` (+ `nopriv`) con dispatcher `op=procesar`.
- Autenticacion por Application Passwords del nucleo (WP >= 5.6) + `manage_options` + HTTPS.
- Entrada: un archivo rasterizado por grupo (PNG/JPG/WebP/GIF); el texto con estilo llega
  rasterizado desde el consumidor (el servidor no renderiza texto ni ejecuta JS).
- Validacion estricta de ids de grupo contra `analisis.json` con `Motor::procesar()`.
- Entregable en `uploads/pmu/api/{job_id}/` con TTL 7 dias configurable e idempotencia por
  `job_id`.
- Respuesta **sincrona** en v1; causas `api:<op>:<motivo>`; ningun fallo deja entregable
  parcial.
- Sube el minimo de WordPress a 5.6 en `readme.txt`.

## Capabilities

### New Capabilities

- `api-wordpress` — API sincrona servidor-a-servidor para procesar compras de PDFs editados.

### Modified Capabilities

<!-- Ninguna: capacidad nueva; el baseline no incluye api-wordpress. -->

## Impact

- Codigo futuro: `personalizador-pdf.php`, `inc/class-pmu-uploads.php`,
  `engine/Motor.php`, `readme.txt` (minimo WP 5.6).
- Amplia `uploads/pmu/` con el ambito `api/{job_id}/`.
- No cambia `specs/` legacy ni el baseline ya archivado.