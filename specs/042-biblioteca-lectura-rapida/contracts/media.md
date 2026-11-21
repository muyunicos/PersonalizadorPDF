# Contract: endpoint liviano de lectura (`media.php`)

**Fecha**: 2026-11-19 | **Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

**Supersede**: el C3/C4 de [uploads-catalogo.md](../../040-catalogo-uploads/contracts/uploads-catalogo.md)
**solo para lecturas**. El endpoint actual (`admin-post.php`) sigue vigente como respaldo y para todas las
escrituras, con su nonce y su capacidad.

## Ubicacion y transporte

- URL: `/wp-content/plugins/personalizador-pdf/media.php` (mismo origen que la ficha).
- Metodo: `GET` (los parametros viajan en la query).
- No carga WordPress: no hay `wp-load.php`, ni plugins, ni `admin_init`, ni base de datos.
- Respuesta JSON con envelope `{success, data}` para `listar`/`ping`; bytes con `Content-Type` para
  `imagen`/`miniatura`.
- Es **solo lectura**: no crea, mueve, borra ni escribe catalogos.

## Identidad

| Caso | Cookie | Validacion | Directorio |
|---|---|---|---|
| Invitado | `pmu_sid` | `^[a-z0-9][a-z0-9_-]{7,63}$` | `tmp/sesion-{sid}/uploads` |
| Cliente | `pmu_uid` | `v1.<uid>.<exp>.<HMAC>` con `hash_equals`; `uid` entero > 0; `exp` futuro | `orders/{uid}/uploads` |

- Si hay `pmu_uid` valida, gana sobre `pmu_sid`.
- Si hay `pmu_uid` invalida/vencida, o un `pmu_sid` presente pero invalido: JSON 403
  `{success:false, data:'media:identidad', fallback:true}` (para `listar`); las imagenes responden 403 sin cuerpo.
- Si no hay `pmu_uid` ni `pmu_sid` y el pedido es `listar`, el endpoint **emite** una cookie `pmu_sid` nueva
  (`HttpOnly`, `SameSite=Lax`, 30 dias) y devuelve una lista vacia (no 403).
- La query puede incluir un discriminador `u=<uid>` / `s=<sha8>` para separar la cache del navegador; **no**
  autoriza ni se valida contra la cookie.
- Alcance: solo las dos carpetas de uploads del comprador; nunca entregables, manifiestos, ideas, PDFs ni
  fotos de terceros.

## Configuracion

- `uploads/pmu/.media/config.json`: `{version:1, base, secret, creado}`.
- `uploads/pmu/.media/.htaccess`: deniega todo el directorio.
- El endpoint busca el config en: `dirname($_SERVER['SCRIPT_FILENAME']) . '/../../uploads/pmu/.media/config.json'`,
  `__DIR__ . '/../../uploads/pmu/.media/config.json'`,
  `$_SERVER['DOCUMENT_ROOT'] . '/wp-content/uploads/pmu/.media/config.json'` y
  `getenv('PMU_MEDIA_CONFIG')`.
- Si no hay config valido (o `base` no es un directorio absoluto): JSON 503
  `{success:false, data:'media:config', fallback:true}`.
- El secreto nunca se imprime, se registra ni se envia al navegador.

## `op=ping`

- `GET media.php?op=ping`.
- 200 `{success:true, data:{ok:true}}`, `Cache-Control: no-store`.
- Sirve para medir TTFB y verificar el deploy; no requiere identidad.

## `op=listar`

Parametros: `op=listar`, `desde` opcional (revision de 12 hex).

Respuesta 200:

```json
{
  "success": true,
  "data": {
    "revision": "a1b2c3d4e5f6",
    "sin_cambios": false,
    "identidad": "u123",
    "fotos": [
      {
        "id": "9f2c41ab0d7e",
        "url": "media.php?op=imagen&u=u123&id=9f2c41ab0d7e",
        "thumb": "media.php?op=miniatura&u=u123&id=9f2c41ab0d7e",
        "thumb_data": "data:image/webp;base64,...",
        "bytes": 412000,
        "w": 900,
        "h": 1200,
        "recetas": { "FF0000-1532x1145-1": { "...params v2..." } },
        "creado": 1795115943
      }
    ],
    "totales": { "fotos": 1, "bytes": 412000 }
  }
}
```

- Orden: `creado` descendente; mismos ids y orden que el endpoint actual.
- `desde` igual a la `revision` vigente: `{revision, sin_cambios:true, identidad, fotos:[], totales:{fotos:0,bytes:0}}`.
- `thumb_data`: data URI WebP 80x80 para las **primeras 10** fotos, <=20 KB cada una; si falta o falla, se
  omite y el cliente usa `thumb`. La lista de 10 no supera 60 KB.
- `identidad` es un discriminador de cache; el cliente lo compara con el de la ficha.
- `Cache-Control: no-store` (JSON con URLs por identidad).
- Si el catalogo no existe o esta corrupto: JSON 200 con `{success:false, data:'media:catalogo', fallback:true}`
  (el cliente usa el endpoint actual, que reconstruye una vez).

## `op=imagen`

- Parametros: `op=imagen`, `id` (hex12), `u`/`s` opcional (discriminador de cache).
- 200: bytes del original `{id}.{ext}` de la carpeta de identidad.
- Headers: `Content-Type` por extension, `Content-Length`, `Cache-Control: private, max-age=604800`,
  `ETag`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`.
- `If-None-Match` coincide -> `304` sin cuerpo.
- 403 si no hay identidad; 404 si el archivo no existe o no es de la identidad.
- Es la URL de las fotos de la biblioteca y de las fotos de ranura con `origen: original` (el `id` vive en
  la carpeta de identidad). Las filas con `file`/`ref`/`compuesta` siguen por el endpoint actual.

## `op=miniatura`

- Parametros: `op=miniatura`, `id`, `u`/`s` opcional.
- 200: bytes de `{id}-80x80.webp`; si falta, se genera (GD + WebP) y se conserva.
- Si no se puede generar (sin GD, original ilegible): se sirve el original, como hoy.
- Mismos headers/cache/304 que `op=imagen`.
- Se conserva como fallback de la tira y para bibliotecas con mas de 10 fotos.

## Headers y cache

| Op | Cache-Control | ETag/304 | Vary |
|---|---|---|---|
| `listar` | `no-store` | - | - |
| `imagen` / `miniatura` | `private, max-age=604800` | si | `Cookie` |

- Sin CORS: el endpoint es mismo-origen.
- La URL de imagen es estable (sin nonce); el navegador la cachea 7 dias.

## Errores

| HTTP | `data` | Cuando | Respaldo |
|---|---|---|---|
| 400 | `media:op` | `op` ausente o desconocida | si (lista) |
| 400 | `media:id` | `id` o extension invalida | no (imagen) |
| 403 | `media:identidad` | credencial presente pero invalida/vencida (sin cookie, el invitado recibe sid nuevo + lista vacia) | si (lista) |
| 404 | `media:foto` | archivo ausente o fuera de la identidad | no (imagen) |
| 503 | `media:config` | config ausente/invalido | si (lista) |

- Para imagenes, el error va **sin cuerpo JSON** (no romper el `<img>`); el cliente puede reintentar con
  la URL actual.
- Para `listar`, el JSON incluye `fallback:true` cuando corresponde.

## Guardrails

- `id`: `^[a-f0-9]{12}$`; extension en `webp|png|jpg|jpeg|gif`; `sid`/`uid` con regex; sin `..`, sin
  symlinks; `realpath` dentro de `base`.
- Solo `tmp/sesion-{sid}/uploads/` y `orders/{uid}/uploads/`; nunca pedidos, manifiestos, ideas, PDFs ni
  fotos de terceros.
- Sin logs con ids o rutas de compradores.

## Respaldo

El cliente usa el endpoint actual (`admin-post.php`) cuando:

1. El camino liviano no esta publicado (`PMU_FICHA.biblioteca.rapido` ausente).
2. La peticion falla (red, 4xx/5xx, `fallback:true`).
3. La `identidad` de la respuesta no coincide con la de la ficha.
4. La configuracion no existe o el `.htaccess` no se pudo escribir.

El endpoint actual conserva su nonce y devuelve la misma lista (ids/orden) con `identidad`, `revision` y
`thumb_data` agregados. Las escrituras (subida, borrado, vista previa, pool, pedido) nunca pasan por
`media.php`.

## Seguridad

- La cookie de lectura es una capacidad: copiada, permite leer las fotos de esa identidad hasta expirar.
- `pmu_uid` va firmada; `pmu_sid` es un UUID no adivinable; las cookies son `HttpOnly`/`SameSite=Lax`.
- Logout borra `pmu_uid`; borrar `.media/config.json` rota el secreto e invalida todas las credenciales.
- Los plugins de seguridad de WordPress no inspeccionan `media.php`; el WAF del hosting si aplica.
- El alcance sigue limitado a las fotos del comprador.

## Compatibilidad

- Mismos ids y orden que el endpoint actual (FR-016).
- Campos nuevos: `identidad`, `revision` y `thumb_data`; los campos viejos se conservan.
- El endpoint actual es el respaldo y sigue siendo el unico camino de escritura.