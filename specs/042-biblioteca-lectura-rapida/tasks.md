# Tasks: Lectura rapida de la biblioteca del comprador

**Input**: Design documents from `/specs/042-biblioteca-lectura-rapida/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED por el plan y el quickstart (puertas del proyecto). Escribir primero y verificar que
fallen antes de implementar.

**Organization**: tareas agrupadas por historia de usuario para implementar y testear cada una de forma
independiente, en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencia de una tarea incompleta).
- **[Story]**: `[US1]`..`[US5]` solo en las fases de historia.
- Cada tarea incluye la ruta exacta del archivo.

## Path Conventions

Proyecto unico (plugin WordPress + assets): rutas relativas a la raiz del repo.

- Entrypoint de lectura: `media.php`
- Lector puro: `inc/class-pmu-lectura.php`
- Config/cookies/URLs (WP): `inc/class-pmu-media.php`
- Ciclo del comprador: `inc/class-pmu-sesion.php`, `inc/class-pmu-uploads.php`
- Ficha/handlers: `personalizador-pdf.php`
- Cliente: `assets/biblioteca-pmu.js`, `assets/tienda.js`, `assets/cargador-pmu.js`
- Puertas: `tests/*.php`, `tests/*.test.js`, `tests/*.browser.js`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: crear los archivos nuevos y el arnes, sin logica de negocio.

- [X] T001 [P] Crear el shell puro de `PMU_Lectura` (ayudante interno de `PMU_Uploads`; sin guard `ABSPATH`, sin funciones WP) con firmas para `catalogo_leer`, `revision`, `archivo`, `miniatura_ruta`, `miniatura_generar`, `listar` en `inc/class-pmu-lectura.php`; `php -l inc/class-pmu-lectura.php`.
- [X] T002 [P] Crear el shell de `PMU_Media` (con guard `ABSPATH`) con firmas para `config`, `config_crear`, `cookie_uid`, `identidad`, `revision`, `url_lista`, `url_imagen`, `habilitado` en `inc/class-pmu-media.php`; `php -l inc/class-pmu-media.php`.
- [X] T003 [P] Crear el router `media.php` sin WordPress (requiere `inc/class-pmu-lectura.php`; `op=ping` responde JSON; `listar`/`imagen`/`miniatura` como stubs) en `media.php`; `php -l media.php`.
- [X] T004 [P] Crear el arnes CLI `tests/media_lectura.php` (check helper, directorios en `%TEMP%`, salida `MEDIA LECTURA OK (N checks)`) en `tests/media_lectura.php`; `php tests/media_lectura.php`.
- [X] T005 Verificar los shells (`foreach ($f in @('media.php','inc/class-pmu-lectura.php','inc/class-pmu-media.php','tests/media_lectura.php')) { php -l $f }`) y cerrar la Fase 1.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: lector puro compartido, configuracion/secreto, cookies de lectura y metadatos de la ficha.
**CRITICAL**: ninguna historia empieza hasta completar esta fase.

- [X] T006 [P] Escribir los casos fallidos del lector puro en `tests/media_lectura.php`: catalogo v1 tolerante (ausente/ilegible), `revision` = `substr(sha1(filemtime|ids),0,12)`, `id` `^[a-f0-9]{12}$`, extension `webp|png|jpg|jpeg|gif`, `realpath` dentro de `base`, rechazo de symlink y de `..`.
- [X] T007 [P] Escribir los casos fallidos de paridad en `tests/catalogo_uploads.php`: `PMU_Lectura` lee el mismo catalogo que `PMU_Uploads` (ids, `ext`, `bytes`, `w`, `h`, `creado`, `recetas`, mismo orden por `creado` descendente).
- [X] T008 Implementar en el ayudante interno `PMU_Lectura::catalogo_leer` (v1 tolerante, `recetas` normalizadas a array), `revision` (formula de la tarea T006) y `archivo` (id/ext/realpath/symlink de la tarea T006) en `inc/class-pmu-lectura.php`.
- [X] T009 Implementar `PMU_Lectura::miniatura_ruta` y `miniatura_generar` extrayendo la logica de `PMU_Uploads`: 80x80 cover, WebP q82, `<=20 KB`, genera si falta y conserva, devuelve `''` si no puede (best-effort) en `inc/class-pmu-lectura.php`.
- [X] T010 Implementar `PMU_Lectura::listar($dir, $opts)`: mismos campos y orden que el listado actual, `desde`/`sin_cambios`, callback para `url`/`thumb` y `totales`; **sin** `thumb_data` todavia, en `inc/class-pmu-lectura.php`.
- [X] T011 Refactorizar `inc/class-pmu-uploads.php` para delegar `catalogo_leer`, `miniatura_ruta` y `miniatura_generar` en `PMU_Lectura`, conservando el comportamiento y los retornos; `PMU_Uploads` sigue siendo el dueno del catalogo; correr `php tests/catalogo_uploads.php`.
- [X] T012 [P] Implementar `PMU_Media::config_crear`/`config` en `inc/class-pmu-media.php`: `{version:1, base, secret, creado}`, `secret` 64 hex (`random_bytes(32)`), escritura atomica (`.tmp` + `rename`), `chmod 0600`, `uploads/pmu/.media/.htaccess` con `Require all denied`; si no puede escribir el `.htaccess`, queda deshabilitado.
- [X] T013 Implementar en `inc/class-pmu-media.php` la cookie `pmu_uid`: `v1.<uid>.<exp>.<HMAC-SHA256(secret)>`, `uid` entero `>0`, `exp` futuro, `hash_equals`, `HttpOnly` + `Secure` (HTTPS) + `SameSite=Lax`, 7 dias; emitir en `wp_login`, borrar en `wp_logout`.
- [X] T014 Implementar en `inc/class-pmu-media.php` `identidad()` (`u{uid}`/`s{sha1(sid)[0:8]}`), `revision()` (desde `uploads.json`), `url_lista()`, `url_imagen($id)` (con discriminador `u=`/`s=`) y `habilitado()` (config + `.htaccess`).
- [X] T015 [P] Extender `tests/texto_puente.php` fase `ficha` (casos fallidos): `PMU_FICHA.biblioteca` trae `rapido`, `revision` de 12 hex e `identidad`; el config y la cookie se crean; sin secretos en el HTML.
- [X] T016 Cablear `personalizador-pdf.php`: `add_action('template_redirect', ...)` para emitir/revalidar `pmu_uid`, `wp_login`/`wp_logout`, `config_crear()` perezoso en la ficha y publicar `PMU_FICHA.biblioteca.rapido/revision/identidad` en `panel_ficha_html()`; `handle_biblioteca()` asegura config/cookie para el respaldo.
- [X] T017 Correr `php -l` de los archivos tocados, `php tests/media_lectura.php`, `php tests/catalogo_uploads.php` y `php tests/texto_puente.php ficha`; checkpoint de la Fase 2.

---

## Phase 3: User Story 1 - Primera apertura rapida (Priority: P1) 🎯 MVP

**Goal**: abrir la galeria sin arrancar WordPress: 1 `media.php?op=listar` + imagenes/miniaturas livianas.

**Independent Test**: con 10 fotos y un sitio con historial, la primera apertura muestra la tira en <1 s
(p95), la traza no muestra el arranque administrativo y no hay lecturas por `admin-post`.

### Tests for User Story 1

> **NOTE**: escribir primero y verificar que fallan antes de implementar.

- [X] T018 [P] [US1] Extender `tests/ficha-pedido.browser.js` con el escenario de primera apertura: **1** `media.php?op=listar`, **0** lecturas de biblioteca por `admin-post`, tira pintada; registrar TTFB. Debe fallar hasta T020-T022.
- [X] T019 [P] [US1] Extender `tests/biblioteca-contrato.test.js`: `pedir()` usa `rapido` (GET, `credentials:'same-origin'`, **sin** nonce), `tira()` pinta y ante error usa `endpoint`; debe fallar antes de T022.

### Implementation for User Story 1

- [X] T020 [US1] Implementar en `media.php` `op=ping` y `op=listar`: busqueda del config (`SCRIPT_FILENAME`, `__DIR__`, `DOCUMENT_ROOT`, `PMU_MEDIA_CONFIG`), identidad (`pmu_uid` valida gana a `pmu_sid`; `pmu_uid`/`pmu_sid` invalidas -> 403/`fallback:true`), lectura con `PMU_Lectura::listar`, `desde`/`sin_cambios`, `revision`/`identidad`, `Cache-Control: no-store`; si no hay `pmu_sid`, emite una cookie nueva y devuelve lista vacia; consume `PMU_Lectura` en modo solo-lectura; sin escrituras.
- [X] T021 [US1] Implementar en `media.php` `op=imagen` y `op=miniatura`: `id` `^[a-f0-9]{12}$`, extension `webp|png|jpg|jpeg|gif`, `realpath` dentro de `base`, sin symlinks, bytes con `Content-Type`/`Content-Length`, `Cache-Control: private, max-age=604800`, `ETag`/`304`, `Vary: Cookie`, `nosniff`; errores de imagen sin cuerpo JSON.
- [X] T022 [P] [US1] Implementar en `assets/biblioteca-pmu.js` `config()` (`rapido`/`revision`/`identidad`) y `pedir()` con el camino liviano (GET sin nonce) y un unico reintento al endpoint actual si el camino liviano falla (T043 agrega modo/identidad/imagen); conservar `enVuelo` y el auto-sanado de la copia envenenada.
- [ ] T023 [US1] Verificar: `foreach ($f in @('media.php','personalizador-pdf.php','inc/class-pmu-lectura.php','inc/class-pmu-media.php')) { php -l $f }`; `node --check assets/biblioteca-pmu.js`; **extender `tests/media_lectura.php` con el contrato HTTP del endpoint** (304, cookie vencida/alterada, 503 config, 403/404 y errores de imagen) y correrlo; `node tests/biblioteca-contrato.test.js`; `node tests/ficha-pedido.browser.js` (primera apertura y <1 s p95 registrado); checkpoint MVP.

---

## Phase 4: User Story 2 - Reapertura sin volver a consultar (Priority: P1)

**Goal**: con revision/identidad iguales y copia fresca (<5 min), la reapertura no hace ninguna solicitud;
fuera de la ventana, revalida una vez.

**Independent Test**: abrir, cerrar y reabrir dentro de 5 min: 0 solicitudes y <100 ms; despues de 5 min:
1 revalidacion liviana; subir/borrar invalida la copia.

### Tests for User Story 2

- [ ] T024 [P] [US2] Extender `tests/biblioteca-contrato.test.js`: clave `pmu_bib_v3`, `revision`/`identidad` guardadas, salto con copia fresca (<5 min) y coincidencia, revalidacion si la copia vencio o la identidad cambio, invalidacion.
- [ ] T025 [P] [US2] Extender `tests/ficha-pedido.browser.js`: reapertura dentro de 5 min = **0** solicitudes; despues de 5 min = **1** `media.php?op=listar`; subida/borrado invalidan; login/logout descartan la copia; **dos contextos** (invitado y cliente, y dos navegadores/perfiles) abren la galeria y ninguna foto, URL ni identidad cruza entre ellos (SC-005).

### Implementation for User Story 2

- [X] T026 [US2] Implementar en `assets/biblioteca-pmu.js`: `CLAVE = 'pmu_bib_v3'`, `FRESCURA_MS = 5*60*1000`, guardar `revision`/`identidad`, `tira()` pinta desde la copia y retorna sin pedir si `revision`/`identidad` coinciden y la copia es fresca; si no, `pedir()` una vez; `calentar()` con la misma regla.
- [X] T027 [US2] Llamar `PMUBiblioteca.invalidar()` al confirmar una subida en `assets/cargador-pmu.js` (punto de exito de `personalizador_pdf_subida`); conservar la invalidacion del borrado en `assets/tienda.js`.
- [ ] T028 [US2] Verificar: `node tests/biblioteca-contrato.test.js`; `node tests/ficha-pedido.browser.js` (reapertura e invalidacion); checkpoint.

---

## Phase 5: User Story 3 - Fotos de ranura en la re-edicion (Priority: P2)

**Goal**: al re-editar un item, las 6 fotos de ranura `origen: original` cargan por `media.php`; las filas
`file`/`ref`/`compuesta` conservan la URL actual.

**Independent Test**: item con 6 fotos `origen: original`: todas se ven en <1 s (p95), **0**
`personalizador_pdf_subida_url`; una fila no original sigue por el camino actual.

### Tests for User Story 3

- [ ] T029 [P] [US3] Extender `tests/texto_puente.php` fase `ficha`: `PMU_FICHA.urls[id]` usa `media.php?op=imagen` solo para `origen: original` con cookie + camino habilitado; para `file`/`ref`/`compuesta` conserva `url_biblioteca_imagen`.
- [ ] T030 [P] [US3] Extender `tests/ficha-pedido.browser.js`: item con 6 fotos `origen: original` -> **0** `personalizador_pdf_subida_url`, imagenes por `media.php`; una foto faltante/reemplazada se comporta como hoy.

### Implementation for User Story 3

- [X] T031 [US3] Implementar en `panel_ficha_html()` (`personalizador-pdf.php`) el mapa `$urls` para la re-edicion: fila `origen === 'original'` + cookie de identidad presente + `PMU_Media::habilitado()` -> `PMU_Media::url_imagen($id)`; resto -> `url_biblioteca_imagen($item, $id)`. Sin tocar `urlDeSubida` ni el contrato del cargador.
- [X] T032 [P] [US3] Agregar en `assets/cargador-pmu.js` (o `assets/tienda.js`/`assets/selector-pmu.js` segun donde viva el `<img>`) un reintento **una vez** con la URL actual cuando falla una imagen liviana de ranura; sin bucles y sin cambiar la API publica.
- [ ] T033 [US3] Verificar: `php tests/texto_puente.php ficha`; `node tests/ficha-pedido.browser.js` (6 ranuras); checkpoint.

---

## Phase 6: User Story 4 - Miniaturas listas en la lista (Priority: P2)

**Goal**: la lista trae hasta 10 miniaturas embebidas (`thumb_data`) y la tira no hace ninguna solicitud de
miniatura; el resto queda por el visor.

**Independent Test**: con 10 fotos, la tira se pinta con la lista, **0** `op=miniatura`, cada miniatura
`<=20 KB` y la lista `<=60 KB`.

### Tests for User Story 4

- [ ] T034 [P] [US4] Extender `tests/media_lectura.php`: `thumb_data` solo para las primeras 10, `<=20 KB`, `data:image/webp;base64,`, se omite si falla; lista de 10 `<=60 KB`.
- [X] T035 [P] [US4] Extender `tests/biblioteca-contrato.test.js`: `pintarTira` y `delegarTira` usan `f.thumb_data || f.thumb || f.url`; la copia guarda `thumb_data`.
- [ ] T036 [P] [US4] Extender `tests/ficha-pedido.browser.js`: **0** `op=miniatura` en la primera apertura; la lista de 10 no supera 60 KB.

### Implementation for User Story 4

- [X] T037 [US4] Implementar `PMU_Lectura::thumb_data` y usarlo en `PMU_Lectura::listar`: primeras 10 fotos, `<=20 KB` cada una, `data:image/webp;base64,...`; si falta/falla, omitir y dejar `thumb`; en `inc/class-pmu-lectura.php`.
- [X] T038 [P] [US4] Implementar en `assets/biblioteca-pmu.js` la prioridad `f.thumb_data || f.thumb || f.url` en **los dos** caminos de render (`pintarTira` propio y `delegarTira` para `MU.coleccion`).
- [ ] T039 [US4] Verificar: `php tests/media_lectura.php`, `node tests/biblioteca-contrato.test.js`, `node tests/ficha-pedido.browser.js` (0 miniatura/tamano); checkpoint.

---

## Phase 7: User Story 5 - Escrituras y respaldo intactos (Priority: P3)

**Goal**: si el camino liviano falla, no esta configurado o la identidad no coincide, la galeria sigue
funcionando por el endpoint actual; las escrituras no cambian.

**Independent Test**: abortar `media.php` (Playwright) y repetir ficha/galeria/subida/borrado/compra: todo
funciona; la lista por ambos caminos coincide en ids/orden.

### Tests for User Story 5

- [ ] T040 [P] [US5] Extender `tests/texto_puente.php` fase `biblioteca`: el respaldo devuelve `identidad`, `revision` y `thumb_data`; ids/orden iguales al camino liviano; las escrituras (subida/borrado/vista/pool/pedido) siguen verdes.
- [ ] T041 [P] [US5] Extender `tests/ficha-pedido.browser.js`: abortar `media.php` con Playwright y verificar que la galeria funciona por `admin-post`; escrituras sin cambios; sin reintentos en bucle.

### Implementation for User Story 5

- [X] T042 [US5] Ampliar `handle_biblioteca()` en `personalizador-pdf.php` (respaldo, nonce intacto): `identidad`, `revision` y `thumb_data` via `PMU_Lectura`, y `PMU_Media::config_crear()`/`cookie_uid` best-effort para que la proxima apertura sea liviana. Sin tocar los handlers de escritura.
- [X] T043 [P] [US5] Implementar en `assets/biblioteca-pmu.js` el `modo='wp'` ante error, `fallback:true`, 4xx/5xx o identidad distinta (1 intento liviano + 1 actual, sin bucle); en `assets/cargador-pmu.js`/`assets/tienda.js`/`assets/selector-pmu.js`, reintentar una vez la imagen con la URL actual.
- [ ] T044 [US5] Verificar: `php tests/texto_puente.php biblioteca`; `node tests/ficha-pedido.browser.js` (fallback); puertas de subida/borrado/vista/pedido; checkpoint.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentacion, version, gates finales y verificacion en vivo.

- [X] T045 [P] Actualizar `AGENTS.md` §2 (nuevos archivos y `PMU_Lectura` como ayudante interno de `PMU_Uploads`), §5 (`.media`, cookies, revision, miniaturas embebidas), §7 (supersede D19/D14 de la 030 para lecturas, respaldo intacto), `docs/decisiones.md` y el estado en `specs/INDICE.md`.
- [X] T046 [P] Actualizar `readme.txt` (changelog) y la version a **4.35.0** solo en la cabecera de `personalizador-pdf.php` (§10.bis); `?ver=` se deriva.
- [ ] T047 Correr las puertas completas: `foreach ($f in @('personalizador-pdf.php','media.php')) { php -l $f }`; `Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }`; `foreach ($f in @('assets/biblioteca-pmu.js','assets/tienda.js','assets/cargador-pmu.js','assets/selector-pmu.js')) { node --check $f }`; `php tests/media_lectura.php`; `php tests/catalogo_uploads.php`; `php tests/sin_lectura.php`; `php tests/motor_smoke.php`; `php tests/parity.php`; todas las fases de `php tests/texto_puente.php` listadas en `AGENTS.md` §9, una por proceso (al menos `biblioteca`, `ficha`, `red_carga`, `admin`, `cotizador`, `pedido`, `completados`); `node tests/biblioteca-contrato.test.js`; `node tests/ficha-pedido.browser.js`.
- [ ] T048 Verificar seguridad/privacidad: `.media/config.json` responde **403**; `media.php?op=ping` **200**; TTFB; cookies `HttpOnly`/`Secure`/`SameSite=Lax`; el secreto no aparece en la pagina ni en el JS; solo se sirven carpetas de uploads del comprador; rotacion: borrar `.media/config.json`, comprobar que las credenciales viejas dejan de servir, que el proximo open usa el respaldo y que el config se reemite.
- [ ] T049 Medir y registrar la evidencia: primera apertura <1 s (p95), reapertura dentro de 5 min = **0** solicitudes, **0** lecturas por `admin-post`, lista ≤60 KB, miniaturas ≤20 KB; comparar con la linea base (9 arranques WP).
- [ ] T050 Verificar el deploy: `pwsh scripts/verificar-deploy.ps1 -Url <biblioteca-pmu.js servido> -Local assets/biblioteca-pmu.js`; `media.php?op=ping` 200; purga + Ctrl+F5; marcar `spec.md`/`tasks.md`/`specs/INDICE.md` como implementados y cerrar.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias; T001-T004 en paralelo, T005 al final.
- **Foundational (Fase 2)**: depende de la Fase 1; **bloquea todas las historias**.
- **US1 (Fase 3)**: depende de la Fase 2.
- **US2, US3, US4 y US5**: dependen de US1 (usan el endpoint liviano y la ficha con `rapido`/`revision`/`identidad`).
- **Polish (Fase 8)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: base del MVP; no depende de otras historias.
- **US2 (P1)**: usa el listado/`PMU_FICHA` de US1; independiente de US3/US4/US5.
- **US3 (P2)**: usa `media.php?op=imagen` de US1; no depende de US2/US4/US5.
- **US4 (P2)**: usa el listado de US1; agrega `thumb_data` y la prioridad del cliente; no depende de US3/US5.
- **US5 (P3)**: usa el camino liviano de US1 y el respaldo actual; **depende de US4** para el campo `thumb_data` del respaldo (T037). Si se quiere US5 antes de US4, el respaldo devuelve `identidad`/`revision` y omite `thumb_data`.

### Within Each User Story

- Tests primero; deben fallar antes de implementar.
- Implementacion en orden (modelo/servicio/endpoint o cliente).
- Checkpoint al final de cada historia; no avanzar sin las puertas verdes.

### Parallel Opportunities

- **Setup**: T001, T002, T003 y T004 (archivos distintos).
- **Foundational**: T006 y T007 (tests en archivos distintos) y T012 (`inc/class-pmu-media.php`) pueden ir en paralelo; T008-T011 son la misma cadena de `inc/class-pmu-lectura.php`/`inc/class-pmu-uploads.php` (secuencial). T013-T014 y T016 son la misma cadena de `inc/class-pmu-media.php`/`personalizador-pdf.php` (secuencial); T015 (test) se escribe antes de T016.
- **US1**: T018 y T019 (tests en archivos distintos); T021 (`media.php`) y T022 (`assets/biblioteca-pmu.js`) pueden ir en paralelo despues de T020.
- **US2**: T024 y T025 (tests en archivos distintos).
- **US3**: T029 y T030 (tests en archivos distintos); T031 (`personalizador-pdf.php`) y T032 (`assets/cargador-pmu.js`) pueden ir en paralelo.
- **US4**: T034, T035 y T036 (tests en archivos distintos); T037 (`inc/class-pmu-lectura.php`) y T038 (`assets/biblioteca-pmu.js`) pueden ir en paralelo.
- **US5**: T040 y T041 (tests en archivos distintos); T042 (`personalizador-pdf.php`) y T043 (`assets/biblioteca-pmu.js`/`assets/cargador-pmu.js`) pueden ir en paralelo.
- **Entre historias**: US2, US3, US4 y US5 **no** son totalmente paralelas por archivos compartidos: `assets/biblioteca-pmu.js` lo tocan US2, US4 y US5; `personalizador-pdf.php` lo tocan US3 y US5; `assets/cargador-pmu.js` lo tocan US2/US3/US5. Por defecto, ejecutar en orden de prioridad: US1 → US2 → US3 → US4 → US5.

---

## Parallel Example: User Story 1

```text
# Tests de US1 (archivos distintos):
T018  Extender tests/ficha-pedido.browser.js (primera apertura)
T019  Extender tests/biblioteca-contrato.test.js (fast path)

# Implementacion (despues de T020):
T021  media.php op=imagen/op=miniatura
T022  assets/biblioteca-pmu.js config/pedir (sin nonce)
```

## Parallel Example: Setup

```text
T001  inc/class-pmu-lectura.php
T002  inc/class-pmu-media.php
T003  media.php
T004  tests/media_lectura.php
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1 (Setup).
2. Completar Fase 2 (Foundational) — bloquea todo.
3. Completar Fase 3 (US1): endpoint liviano + cliente fast path.
4. **PARAR y VALIDAR**: primera apertura <1 s, 1 `media.php?op=listar`, 0 lecturas por `admin-post`.
5. Deploy/demo si esta listo.

### Incremental Delivery

1. Setup + Foundational -> base lista.
2. US1 -> validar primera apertura -> deploy (MVP).
3. US2 -> reapertura 0 solicitudes dentro de 5 min -> deploy.
4. US3 -> ranuras de la re-edicion -> deploy.
5. US4 -> 0 `op=miniatura` y lista ≤60 KB -> deploy (completa el objetivo de la tira).
6. US5 -> respaldo y escrituras verificadas -> deploy.
7. Polish -> docs/version/gates/deploy final.

### Parallel Team Strategy

Con mas de un desarrollador, el orden real esta limitado por archivos compartidos:

1. Setup + Foundational en conjunto (tests en paralelo).
2. US1 es la base; no se puede paralelizar con las demas.
3. Despues de US1:
   - Desarrollador A: US2 (`assets/biblioteca-pmu.js`, `assets/cargador-pmu.js`).
   - Desarrollador B: US3 (`personalizador-pdf.php`, `assets/cargador-pmu.js` — coordinar el archivo con A).
   - Desarrollador C: US4 (`inc/class-pmu-lectura.php`, `assets/biblioteca-pmu.js` — coordinar con A).
   - US5 despues de US2/US3/US4 por los mismos archivos.
4. Si no hay coordinacion por archivo, ejecutar en el orden de prioridad indicado.

---

## Notes

- `[P]` = archivos distintos y sin dependencia de una tarea incompleta.
- `[Story]` mapea la tarea a la historia para trazabilidad.
- Cada historia es completable y testeable por separado; el MVP es US1.
- Verificar que los tests fallen antes de implementar.
- Commit despues de cada checkpoint (con las puertas verdes).
- No hay migracion ni cambios en `engine/`; las escrituras siguen por `admin-post` con nonce/capacidad.
- La ventana de frescura es de 5 minutos: dentro de ella, con revision/identidad iguales, 0 solicitudes; fuera, 1 revalidacion liviana.