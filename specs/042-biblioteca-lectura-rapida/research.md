# Research: lectura rapida de la biblioteca

**Fecha**: 2026-11-19 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Medicion base (produccion, 2026-11-19)

Peticiones de solo lectura, sin nonce valido (el handler responde error antes de tocar sesion o datos):

| Peticion | TTFB en caliente | Primera (fria) |
|---|---|---|
| Portada | 0,87-1,21 s | - |
| `admin-post.php` (`op=listar`, nonce invalido, 47 bytes) | 0,91-1,09 s | 4,24 s |
| `admin-post.php` (`op=miniatura`, nonce invalido) | 0,92-0,97 s | 4,00 s |
| `admin-ajax.php` (sin accion) | 0,90-1,00 s | - |
| Estatico del plugin (`biblioteca-pmu.js`) | 0,17-0,20 s | - |

Conclusion: el costo esta en el **arranque de WordPress** (core + plugins + `wp-admin/includes/admin.php` +
`admin_init`), no en el handler. La primera apertura con 8 fotos hace 1 `listar` + 8 `miniatura` = **9
arranques**; en caliente son ~9 s y en frio puede superar los 15 s.

## D1 — Camino de lectura sin WordPress

- **Decision**: un entrypoint `media.php` en la raiz del plugin que **no** incluye `wp-load.php`. Lee el
  catalogo y los archivos, resuelve la identidad por cookie y responde JSON o bytes.
- **Rationale**: cualquier peticion que cargue WordPress cuesta ~0,9 s en caliente y hasta ~4 s en frio,
  aunque devuelva 47 bytes. Un PHP sin WordPress queda cerca del estatico (~0,2-0,3 s con red).
- **Alternativas consideradas**:
  - Cortar en `plugins_loaded` antes de `wp-admin/includes/admin.php`: sigue cargando core + plugins; el
    ahorro medido no justifica el riesgo de un flujo no estandar.
  - `admin-ajax.php`: carga `admin.php` y `admin_init` igual que `admin-post` (medido ~0,9 s).
  - Ruta front-end: carga WordPress + tema; mismo piso.
  - Archivos estaticos publicos o CDN: violan la privacidad de `tmp/` y `orders/`.
- **Consecuencia**: el endpoint actual queda como respaldo y para escrituras; se supersede la D19 de la
  030 (heredada por la 040) solo para lecturas.

## D2 — Identidad sin WordPress

- **Decision**:
  - Invitado: cookie `pmu_sid` (UUID v4, `HttpOnly`, `SameSite=Lax`, 30 dias) que ya existe.
  - Cliente: cookie nueva `pmu_uid` = `v1.<uid>.<exp>.<HMAC-SHA256(secret)>`, `HttpOnly`, `Secure` en
    HTTPS, `SameSite=Lax`, 7 dias; se emite en `template_redirect`/`wp_login` y se borra en `wp_logout`.
  - El endpoint valida la cookie sin base de datos; si no hay identidad valida, 403 + `fallback:true`.
- **Rationale**: la identidad ya esta en el navegador; el `uid` firmado evita que se pueda fabricar otro.
- **Alternativas**:
  - Token HMAC por URL: pone un secreto en la URL, no evita el costo del listado y complica el cache.
  - Nonce de WordPress: exige arrancar WordPress (el problema).
  - Token corto emitido por WordPress: exige un arranque previo para emitirlo.
- **Riesgo aceptado**: la cookie es una capacidad de lectura; copiada, permite leer las fotos de esa
  identidad hasta que expire. Se acota el alcance y se documenta (spec, Security & Privacy).

## D3 — Configuracion y secreto

- **Decision**: `uploads/pmu/.media/config.json` = `{version:1, base, secret, creado}` + un
  `.media/.htaccess` que deniega todo. Lo crea `PMU_Media` con escritura atomica (`.tmp` + `rename`) y
  `chmod 0600`; el secreto es `random_bytes(32)` en hex. El endpoint lo localiza por candidatos
  (`$_SERVER['SCRIPT_FILENAME']` -> `wp-content/uploads/pmu`, `__DIR__ . '/../../uploads/pmu'`,
  `DOCUMENT_ROOT`, `getenv('PMU_MEDIA_CONFIG')`); si no lo encuentra, 503 + `fallback`.
- **Rationale**: el endpoint no puede usar `wp_upload_dir()` ni la BD; la base absoluta real la escribe
  WordPress una vez. El secreto sobrevive a los deploys (vive en uploads, no en el plugin).
- **Alternativas**:
  - Config en la carpeta del plugin: archivo untracked que el deploy puede borrar/arrastrar.
  - Secreto en la BD + `SHORTINIT`: agrega conexion y consulta; mas lento y mas piezas.
  - Constante en `wp-config.php`: requiere intervencion manual del dueno.
- **Guardrail**: si el `.htaccess` no se puede escribir, el camino liviano queda deshabilitado. Si el
  hosting ignora `.htaccess`, el secreto quedaria expuesto: se verifica en el quickstart y se desactiva.

## D4 — Lista, miniaturas embebidas y revision

- **Decision**: `op=listar` devuelve el mismo envelope que el endpoint actual (`success/data`) con
  `revision`, `sin_cambios`, `identidad`, `fotos[]` (id, url, thumb, bytes, w, h, recetas, creado,
  `thumb_data`) y `totales`. `thumb_data` es un `data:image/webp;base64,...` de 80x80 para las primeras
  10 fotos (las visibles), con tope de 20 KB; si falta o falla, se omite y queda `thumb`.
- **Rationale**: elimina una solicitud por miniatura y conserva el contrato del cliente. La lista de 10
  fotos queda por debajo de 60 KB.
- **Alternativas**:
  - `op=miniaturas` batch: una solicitud extra y otro arranque de PHP.
  - Sprite tipo TextMuy: mas complejo de invalidar y de recortar por identidad.
  - Archivos publicos: violan la privacidad.

## D5 — Reapertura con 0 solicitudes

- **Decision**: WordPress calcula en la ficha una `revision` de la biblioteca (mtime del catalogo + ids,
  `substr(sha1(...),0,12)`) y una `identidad` (`u{uid}` / `s{sha1(sid)[0:8]}`) y las publica en
  `PMU_FICHA.biblioteca`. El cliente guarda `revision` + `identidad` en `pmu_bib_v3`; si coinciden, pinta
  desde la copia y **no pide nada** si la copia es fresca (<5 min). Si no coinciden o la copia vencio,
  pide una vez. Subir/borrar invalida la copia; login/logout cambia la identidad y la descarta.
- **Rationale**: son datos que ya existen; una pagina cacheada con otra identidad no puede mezclar fotos
  porque la identidad no coincide y se usa el respaldo.
- **Alternativas**:
  - Revalidar siempre con el endpoint liviano: ~0,2 s por apertura, pero sigue habiendo una solicitud.
  - Solo TTL: se pierde la deteccion de cambios y el aislamiento entre identidades.
- **Riesgo**: un cambio en otra pestaña/dispositivo puede tardar hasta 5 min en verse; es aceptable y se
  documenta.

## D6 — Fotos de ranura en la re-edicion

- **Decision**: en `panel_ficha_html`, las filas `subidas[]` con `origen: original` publican la URL del
  camino liviano (`media.php?op=imagen&u=<identidad>&id=...`) **solo si la cookie de identidad esta
  presente** y el camino liviano esta habilitado. Las filas con `file`, `ref` o `origen: compuesta`
  conservan la URL actual (`url_biblioteca_imagen`, que resuelve el item). `urlDeSubida` sigue leyendo el
  mapa `PMU_FICHA.urls`; para los originales no hay ningun `admin-post` por imagen.
- **Rationale**: el original de una fila `origen: original` vive en la carpeta de identidad
  (`tmp/sesion-{sid}/uploads` u `orders/{uid}/uploads`), justo lo que sirve el endpoint liviano; no hace
  falta leer el manifest ni resolver el item.
- **Alternativas**: endpoint con `item_key` (mas superficie y lectura de manifiestos); una solicitud
  administrativa por imagen (el problema); publicar siempre la URL liviana (rompe filas compuestas/ref y
  paginas cacheadas sin cookie).
- **Riesgos**: si la pagina viene de cache y no hay cookie, se publican las URLs actuales (funciona, mas
  lento); si una fila no es original, sigue por el camino actual; una imagen liviana que falla se reintenta
  con la URL actual (D7).

## D7 — Respaldo transparente

- **Decision**: el cliente intenta el camino liviano; ante error de red, 4xx/5xx, `fallback:true` o
  identidad distinta a la publicada, usa el endpoint actual para esa apertura y recuerda `modo='wp'` en
  memoria para no insistir. Una imagen liviana que falla se reintenta una vez con la URL actual construida
  desde `endpoint` + `nonce` + `id` (biblioteca) o con la URL actual de la ranura.
- **Rationale**: SC-006 y la compra nunca se bloquea; las escrituras no cambian.
- **Alternativas**: fallar la galeria (inaceptable); dejar la imagen rota en silencio (inaceptable).

## D8 — Seguridad y guardrails

- **Decision**: el endpoint solo sirve `uploads/pmu/tmp/sesion-{sid}/uploads/` y
  `uploads/pmu/orders/{uid}/uploads/`; `id` con forma `[a-f0-9]{12}`; extension en allowlist
  (`webp|png|jpg|jpeg|gif`); `sid`/`uid` con regex; `realpath` dentro de `base`; se rechazan symlinks;
  `hash_equals` para la firma; cookies `HttpOnly`/`Secure`/`SameSite=Lax`; logout borra `pmu_uid`; rotacion
  del secreto invalida todo; sin logs con ids/rutas.
- **Rationale**: el trade-off aceptado es la **fuerza** de la autorizacion de lectura (cookie bearer), no
  el **alcance**. Un bug de path no puede exponer fotos de terceros, pedidos ni manifiestos.
- **Alternativas**: sin guardrails (rechazada: un error expone a todos).

## D9 — Cache y headers

- **Decision**: `op=listar` responde `Cache-Control: no-store`; las imagenes responden
  `Cache-Control: private, max-age=604800`, `ETag`, `304 Not Modified`, `Vary: Cookie`,
  `X-Content-Type-Options: nosniff`, `Content-Type` por extension y `Content-Length`. La URL de imagen
  incluye un discriminador de identidad (`u=<uid>` / `s=<sha8(sid)>`) que **no autoriza** (la cookie manda)
  y evita que la cache del navegador reutilice una imagen entre identidades.
- **Rationale**: sin nonce en la URL, el navegador cachea 7 dias; las URLs son estables y el visor no
  vuelve a descargar.
- **Alternativas**: nonce en la URL (cache de 12 h y muchos requests), imagenes sin cache (lento), cache
  publica (fuga entre compradores).

## D10 — Pruebas

- **Decision**: extraer `PMU_Lectura` (catalogo, revision, miniatura, resolucion y guardrails) como modulo
  puro compartido por `PMU_Uploads` y `media.php`. Nuevo `tests/media_lectura.php` (CLI, directorios
  temporales, sin WordPress): listar, `sin_cambios`, `thumb_data`, revision, 304, cookies vencidas/
  alteradas, traversal, extension invalida, catalogo ausente. Ampliar `tests/catalogo_uploads.php`
  (paridad del lector), `tests/texto_puente.php` (biblioteca, ficha, red_carga), `tests/biblioteca-contrato.test.js`
  (cache v3, `thumb_data`, revision/identidad, fallback) y `tests/ficha-pedido.browser.js` (1 `media.php`,
  0 lecturas por `admin-post`, 0 `op=miniatura`, reapertura 0 requests, fallback abortando `media.php`,
  6 fotos de ranura).
- **Rationale**: el endpoint no corre en WordPress; el nucleo puro se testea rapido y la puerta de
  navegador cubre la red y la UX.
- **Alternativas**: solo navegador (lento y fragil); duplicar logica (se desincroniza).

## D11 — Despliegue y operacion

- **Decision**: `media.php` y las clases se despliegan con el plugin; el config se crea en runtime en
  `uploads/pmu/.media/`; no hay migracion ni archivos generados en la carpeta del plugin. Si falta el
  config o no se puede escribir el `.htaccess`, el camino liviano queda deshabilitado y se usa el respaldo.
  La rotacion del secreto es **borrar `.media/config.json`**: todas las credenciales de lectura vencen y
  WordPress lo recrea en la proxima ficha. Verificacion: `op=ping`, laboratorio y
  `scripts/verificar-deploy.ps1` para los assets (no para la salida PHP de `media.php`).
- **Rationale**: sin untracked en el repo, sin migracion manual y con una operacion de rotacion simple.
- **Alternativas**: config en la carpeta del plugin (riesgo de deploy); UI de rotacion (fuera de alcance).

## Resultado

Sin marcadores de aclaracion pendientes: las decisiones de alcance, seguridad, respaldo y ranuras de la
re-edicion quedaron cerradas en la spec y se resuelven arriba. La Fase 1 puede escribir `data-model.md`,
los contratos y el `quickstart.md`.