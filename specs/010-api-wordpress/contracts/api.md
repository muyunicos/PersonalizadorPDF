# Contract: `admin_post_pmu_api` (endpoint único de la API)

Versión del contrato: 1 (spec [010-api-wordpress](../spec.md), decisiones D1–D5 del 2026-10-01).

Un **único** endpoint, con dispatcher `op=`, siguiendo el patrón vigente de `admin_post_pmu_uploads`.
No hay rutas REST ni un segundo camino de escritura.

## Request

```http
POST {sitio}/wp-admin/admin-post.php?action=pmu_api&op=procesar
Authorization: Basic base64(usuario:application_password)
Content-Type: multipart/form-data

pdf      = "circulo6cm.pdf"     # nombre del PDF ya subido por el admin
job_id   = "ped-1042"           # clave de idempotencia elegida por el consumidor
0000FF   = <archivo>            # 1 campo por grupo; clave = id de color hex 6
FF0000   = <archivo>            # (PNG | JPG | JPEG | WebP | GIF)
```

- La credencial es una **Application Password** del núcleo, de un usuario con `manage_options`
  (decisión D2). El plugin **no** usa `seguridad()` (esa exige nonce + sesión de admin).
- Solo HTTPS. En HTTP el endpoint responde `api:autenticacion:https_requerido`.
- Campos `op=` previstos: `procesar`, `estado`, `limpiar`.

## Validación server-side (en orden)

1. **Autenticación** → `api:autenticacion:credencial` | `api:autenticacion:permisos` |
   `api:autenticacion:https_requerido`. No se toca el disco.
2. **`op=` conocido** → `api:op:desconocido`.
3. **`pdf` presente y saneado** (`nombre_seguro`) → `api:procesar:pdf_inexistente` si no está
   subido, `api:procesar:sin_analisis` si no tiene `analisis.json` vigente.
4. **`job_id` saneado** (nunca crudo para construir ruta) → `api:procesar:job_id_invalido`.
5. **Idempotencia**: si el trabajo existe y su manifiesto coincide (mismo `pdf` + mismos grupos con
   el mismo hash de contenido) → responde 200 con la `url` vigente, **0 regeneraciones**. Si el
   manifiesto difiere → `api:procesar:job_conflicto`, **sin sobrescribir**.
6. **Grupos recibidos**: cada id DEBE existir en `analisis.json` (`^[0-9A-F]{6}$`) →
   `api:procesar:grupo_desconocido` listando el id. Id repetido → `api:procesar:grupo_duplicado`.
7. **Al menos una imagen** → si no llega ninguna, `api:procesar:sin_imagenes`.
8. **Formato y tamaño**: solo PNG/JPG/JPEG/WebP/GIF (`Imagen::tipo()`) →
   `api:procesar:formato_no_soportado`; archivo vacío o corrupto →
   `api:procesar:imagen_invalida`; por encima del límite → `api:procesar:limite_tamano`.
9. **Motor**: `Motor::procesar($ruta_pdf, $analisis, $mapa)` **con** dataset (decisión D1.b).
   Ningún id sin imagen falla: conserva su transparencia y se lista en `resumen.grupos_sin_imagen`.

El orden importa: las validaciones 1–8 ocurren **antes de escribir cualquier archivo**, de modo que
un rechazo no deja trabajo a medias (FR-013).

## Response

Éxito (`200`):

```json
{
  "ok": true,
  "job_id": "ped-1042",
  "pdf": "circulo6cm",
  "url": "https://sitio/wp-content/uploads/pmu/api/ped-1042/circulo6cm_procesado.pdf",
  "expira": "2026-10-08T00:00:00Z",
  "grupos": { "0000FF": { "w": 200, "h": 140, "cont": 3 } },
  "resumen": {
    "grupos_totales": 2,
    "grupos_aplicados": ["0000FF"],
    "grupos_sin_imagen": ["FF0000"],
    "imagenes_insertadas": 3,
    "bytes": 51234
  }
}
```

Fallo: **siempre** la convención de causa del proyecto, con el código HTTP adecuado:

```json
{ "ok": false, "causa": "api:procesar:grupo_desconocido", "detalle": "0000FFF" }
```

| HTTP | Causas |
|------|--------|
| 400 | `api:op:desconocido`, `api:procesar:*` (pdf, job_id, grupo, formato, sin_imagenes, limite_*) |
| 401 | `api:autenticacion:credencial`, `:permisos`, `:https_requerido` |
| 409 | `api:procesar:job_conflicto` |
| 410 | `api:estado:expirado` |

Nunca una página HTML de error ni un mensaje genérico (SC-008).

## Efectos garantizados

- Escribe **solo** bajo `uploads/pmu/api/{job_id}/`: `manifest.json`, pool `img/` y
  `{pdf}_procesado.pdf`. Toda ruta se resuelve con helpers de `PMU_Uploads` (FR-007).
- `manifest.json` guarda `pdf`, `grupos` (id + hash de contenido), `expira` y `creado`; es lo que
  permite la idempotencia (paso 5) y la purga (paso 7 de `limpiar`).
- La purga (`op=limpiar` + `wp-cron` + barrido oportunista al procesar) borra la **carpeta completa**
  del trabajo vencido: manifiesto, pool y PDF, sin dejar archivos sueltos.
- El entregable es idempotente: reenviar el mismo `job_id` con el mismo contenido **no** regenera.

## Fuera de contrato

- **No** se renderiza texto ni se ejecuta JS en el servidor (constitución §III). El texto con estilo
  llega rasterizado desde el consumidor como PNG y se procesa como cualquier otra imagen.
- **No** se aceptan PDFs nuevos ni se analiza geometría: solo PDFs ya subidos por el administrador.
- **No** se toca WooCommerce (productos, carrito, pedidos) ni se cobra.
- **No** hay tablas en base de datos (constitución §IV) ni credenciales propias en `uploads/`.
- **No** hay modo asíncrono en v1 (decisión D4): la respuesta es síncrona.