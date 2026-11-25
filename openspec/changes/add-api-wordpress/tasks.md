# Tasks — add-api-wordpress

> Change forward (activo). Tareas SIN marcar: implementacion futura.

## 1. Scaffold y autenticacion

- [ ] B1. Registrar `admin_post_pmu_api` + `nopriv` y dispatcher `op=`.
- [ ] B2. Autenticacion por Application Passwords + `manage_options` + exigir HTTPS.
- [ ] B3. Helpers del ambito `api` en `PMU_Uploads` (sin rutas fuera de esa clase).

## 2. op=procesar

- [ ] B4. Aceptar `pdf` + un archivo rasterizado por grupo (id hex 6 como clave).
- [ ] B5. Validar ids contra `analisis.json` antes de escribir (`grupo_desconocido`, `grupo_duplicado`).
- [ ] B6. Llamar `Motor::procesar($ruta_pdf, $analisis, $mapa)` con dataset.
- [ ] B7. Escribir `uploads/pmu/api/{job_id}/` (manifest, pool `img/`, `{pdf}_procesado.pdf`).

## 3. Idempotencia, TTL y limites

- [ ] B8. Idempotencia por `job_id` (reuso sin regenerar; `job_conflicto` sin sobrescribir).
- [ ] B9. TTL 7 dias configurable + purga diferida (cron + oportunista), carpeta completa.
- [ ] B10. Limites (tamano, grupos, tiempo) con causa `api:procesar:limite_*`.
- [ ] B11. Respuesta JSON (`ok`, `url`, `grupos`, `resumen`, `expira`) y causas `api:<op>:<motivo>`.
- [ ] B12. Garantia de cero entregable parcial (limpiar trabajo ante error).

## 4. Verificacion y docs

- [ ] B13. Fases propias de la API en `tests/texto_puente.php` (un proceso por fase).
- [ ] B14. Verificacion en pestaña Test (responde y rechaza credenciales ausentes).
- [ ] B15. Subir `readme.txt` `Requires at least` a 5.6 y coherencia de docs (AGENTS/constitution/INDICE).
- [ ] B16. Gate `openspec validate add-api-wordpress --strict` verde. No archivar.