# Data Model: lectura rapida de la biblioteca

**Fecha**: 2026-11-19 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Entidades

### 1. Identidad de lectura

| Campo | Tipo | Regla |
|---|---|---|
| `tipo` | enum | `invitado` o `cliente` |
| `sid` | string | cookie `pmu_sid`; UUID v4 en minusculas (se acepta `[a-z0-9_-]{8,64}`); 30 dias; `HttpOnly` + `SameSite=Lax` |
| `uid` | int | solo `cliente`; `> 0`; cookie `pmu_uid` firmada |
| `identidad` | string | `u{uid}` o `s{sha1(sid)[0:8]}`; discriminador de cache, **no** autoriza |
| `dir` | ruta | `uploads/pmu/tmp/sesion-{sid}/uploads` (invitado) o `uploads/pmu/orders/{uid}/uploads` (cliente) |

- La cookie `pmu_uid` es `v1.<uid>.<exp>.<HMAC-SHA256(secret)>`; `HttpOnly`, `Secure` en HTTPS,
  `SameSite=Lax`, 7 dias. Se emite en `template_redirect`/`wp_login` y se borra en `wp_logout`.
- El endpoint valida `sid`, `uid` y `exp` y la firma con `hash_equals`; si no hay identidad valida,
  responde 403 + `fallback:true`.
- **Transicion**: invitado -> login: se migran los originales a `orders/{uid}/uploads/` (spec 040), la
  identidad cambia de `s...` a `u...`, se descarta la copia local y se emite `pmu_uid`.

### 2. Configuracion de lectura

| Campo | Tipo | Regla |
|---|---|---|
| `version` | int | `1` |
| `base` | string | ruta absoluta real de `uploads/pmu/`; debe existir y ser directorio |
| `secret` | string | 64 hex (32 bytes); nunca se imprime ni se envia al navegador |
| `creado` | int | epoch de creacion |

- Archivo: `uploads/pmu/.media/config.json`; escritura atomica (`.tmp` + `rename`) y `chmod 0600`.
- `uploads/pmu/.media/.htaccess` deniega todo el directorio. Si no se puede escribir, el camino liviano
  queda deshabilitado.
- El endpoint lo localiza por candidatos (`SCRIPT_FILENAME`, `__DIR__`, `DOCUMENT_ROOT`,
  `PMU_MEDIA_CONFIG`); si no lo encuentra o es invalido, 503 + `fallback:true`.
- Rotacion: borrar el archivo invalida todas las credenciales de lectura; WordPress lo recrea.

### 3. Catalogo de la biblioteca (`uploads.json`)

| Campo | Tipo | Regla |
|---|---|---|
| `version` | int | `1` |
| `items` | mapa | `id -> entrada` |

Entrada: `id` (hex12), `ext` (allowlist: `webp|png|jpg|jpeg|gif`), `bytes` (int), `w`/`h` (int),
`creado`/`ultimo_uso` (epoch), `recetas` (mapa `clave -> params v2`).

- Lectura **tolerante**: ausente, ilegible o `version` desconocida = catalogo no disponible.
- El endpoint **no escribe**; si falta, responde `fallback` y el endpoint actual lo reconstruye una vez.
- Orden de la lista: `creado` descendente.

### 4. Foto y miniatura

- Original: `{id}.{ext}` en la carpeta de identidad.
- Miniatura: `{id}-80x80.webp`, 80x80, recorte al centro (cover), WebP q82, <=20 KB.
- Si falta la miniatura, se genera al pedirla y se conserva; si no se puede generar, se sirve el original.
- `thumb_data` (lista): `data:image/webp;base64,...` para las primeras 10 fotos; si falla o supera
  20 KB, se omite y queda la URL `thumb`.
- La lista de 10 fotos no supera 60 KB.

### 5. Revision de la biblioteca

- Formula: `substr(sha1(filemtime(uploads.json) . '|' . implode(',', array_keys(items))), 0, 12)`.
- Cambia al subir, borrar o actualizar una receta (cambia el mtime/ids).
- Es una **huella de cache**, no un token de seguridad; no autoriza nada.

### 6. Cache del navegador (`pmu_bib_v3`)

| Campo | Tipo | Regla |
|---|---|---|
| `revision` | string | 12 hex de la lista guardada |
| `identidad` | string | `u...`/`s...` de la copia; si no coincide con la ficha, se descarta |
| `fotos` | array | metadatos + `thumb_data` (hasta 10) |
| `ts` | int | epoch de la copia |

- Frescura: 5 minutos. Con revision/identidad iguales y copia fresca, **0 solicitudes**; con la copia vencida, 1 revalidacion (aunque la revision coincida).
- Se invalida al subir o borrar en la misma pestaña y al cambiar de identidad.
- En modo privado o sin almacenamiento, funciona solo en memoria.

### 7. Foto de ranura (re-edicion)

- Fila del manifest: `subidas[]` con `{id, origen, file?, ...}`.
- `origen: original` -> URL del camino liviano (`media.php?op=imagen&u=...&id=...`), solo si la cookie
  de identidad esta presente y el camino liviano esta habilitado.
- `origen: subida`/`ref`/`compuesta` (con `file`) -> URL actual del item (`url_biblioteca_imagen`).
- El mapa `PMU_FICHA.urls` se publica al render de la ficha; `urlDeSubida` lo consume y evita el
  `admin-post` por foto.

## Relaciones

- Una **identidad** tiene un unico **directorio** de uploads y un **catalogo**.
- Un **catalogo** tiene N **fotos**; cada foto tiene 0 o 1 **miniatura**.
- Una **copia local** pertenece a una identidad y a una revision.
- Una **foto de ranura** referencia una foto por `id`; si es `original`, la foto vive en el directorio de
  identidad; si es `file`/`ref`, vive en el item.

## Reglas de validacion

- `id`: `^[a-f0-9]{12}$`; `sid`: `^[a-z0-9][a-z0-9_-]{7,63}$`; `uid`: `^[1-9][0-9]{0,11}$`.
- Extension: allowlist; sin rutas, sin `..`, sin symlinks; `realpath` debe quedar dentro de `base`.
- Solo se sirven las carpetas de uploads del comprador; nunca pedidos, manifiestos, ideas ni PDFs.
- La firma de `pmu_uid` se valida con `hash_equals`; `exp` debe ser futuro.
- El endpoint es **solo lectura**: no crea, no mueve, no borra y no escribe catalogos.
- Los errores no exponen rutas ni ids en logs.

## Transiciones de estado

| Evento | Catalogo | Revision | Cache local | Cookies |
|---|---|---|---|---|
| Subida | upsert de la entrada | cambia | se invalida | `pmu_sid` si es invitado |
| Borrado | se quita la entrada | cambia | se invalida | - |
| Receta | se actualiza | cambia | se invalida (la lista muestra recetas) | - |
| Login | migra `tmp` -> `orders/{uid}` | cambia (otra carpeta) | se descarta por identidad | se emite `pmu_uid` |
| Logout | - | - | se descarta por identidad | se borra `pmu_uid` |
| Rotacion del secreto | - | - | - | todas las credenciales de lectura vencen |
| Pagina cacheada | - | - | identidad distinta -> se pide de nuevo | se reemite por el respaldo |

## Mapa de almacenamiento

```text
uploads/pmu/
├── tmp/sesion-{sid}/uploads/          # invitado: uploads.json + {id}.{ext} + {id}-80x80.webp
├── orders/{uid}/uploads/              # cliente: idem
└── .media/                            # config.json + .htaccess (privado, runtime)
```

El navegador guarda solo `pmu_bib_v3` (metadatos + hasta 10 miniaturas). No hay base de datos ni tabla
nueva; las lecturas no abren la BD.