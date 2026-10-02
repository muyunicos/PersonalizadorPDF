# Feature Specification: api-wordpress

**Feature Branch**: `main`

**Created**: 2026-10-01

**Status**: Especificada — alcance y decisiones D1–D5 cerradas (ver Clarifications); pendiente
`plan.md` + `tasks.md`.

**Input**: User description: "El principal uso del sistema es procesar compras de PDFs editados
mediante una API con WordPress: el sistema recibe el nombre del PDF base y un conjunto de
imágenes, y devuelve la URL al archivo procesado." (Objetivo declarado en `AGENTS.md` §1 desde
el inicio; hoy sin especificar ni implementar.)

## Clarifications

### Session 2026-10-01 (decisiones D1–D5, cerradas antes de especificar)

- **D1 — Alcance (decisivo)**: la API recibe **un archivo rasterizado por grupo** (PNG, JPG/JPEG,
  WebP o GIF) y devuelve el PDF editado. El motor normaliza y encaja (`contain`) cada archivo con
  `Imagen::normalizar()`. **El texto con estilo NO se renderiza en el servidor**: si el consumidor
  necesita texto estilizado, lo rasteriza en su navegador (TextMuy `RenderCore`) y envía ese PNG
  como la imagen del grupo. La API no distingue "foto" de "texto estilizado": son el mismo tipo de
  entrada. Esto respeta `constitution` §III (el render es client-side; PHP nunca evalúa JS) sin
  enmendarla, y evita montar un TextMuy headless en el servidor (prohibido: hosting compartido
  100% PHP, sin Node).
- **D1.b — Validación estricta**: los ids de grupo se validan contra `analisis.json`; un id
  inexistente es un **error**, no un hueco vacío silencioso. Se usa `Motor::procesar()` **con**
  dataset (no `procesar_pedido()`), para que un typo del consumidor falle ruidosamente. Una API la
  consume código de terceros, donde los typos son la norma.
- **D2 — Autenticación**: **Application Passwords del núcleo de WordPress** (≥ 5.6) + capability
  `manage_options` + HTTPS. Se descarta un token propio en `uploads/pmu/` (habría que comparar
  credenciales a mano, sin hashing del core, con riesgo de quedar expuesto en un backup de
  `uploads/`) y se descartan las claves REST de WooCommerce (atarían la API a Woo, que el plugin
  usa pero no requiere). No se usa `seguridad()` (exige nonce + sesión de admin).
- **D3 — Entregable y retención**: nuevo ámbito `uploads/pmu/api/{job_id}/` con `manifest.json`,
  pool `img/` y `{pdf}_procesado.pdf`. **TTL configurable, 7 días por defecto**, con purga
  automática; hoy el sistema no tiene política de retención en ningún ámbito y sin ella cada
  llamada dejaría un PDF en el hosting para siempre. El `job_id` lo elige el consumidor y sirve
  de clave de idempotencia.
- **D4 — Modalidad**: **síncrona** en v1 (el motor es rápido: spec 004 fija PDF final <10 s, y
  todos los handlers actuales responden JSON de forma síncrona). El modo asíncrono con `job_id`
  consultable queda como extensión futura.
- **D5 — Forma del endpoint**: **un único endpoint `admin_post_pmu_api`** (+ `nopriv`) con
  dispatcher `op=`. **No** se introducen rutas REST: el proyecto tiene cero `rest_api_init` y
  `admin_post_pmu_uploads` + `op=` ya es el patrón vigente (constitución: "punto único", sin
  caminos de escritura paralelos).
- **Dependencia que hay que cerrar**: `readme.txt` declara `Requires at least: 5.0`, pero
  Application Passwords existen desde WP 5.6. La implementación debe subir el mínimo a 5.6 o
  documentar la degradación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un sistema externo personaliza un PDF y recibe el archivo listo (Priority: P1)

Un sistema propio del cliente (ERP, intranet o tienda) llama a la API con el nombre de un PDF ya
subido por el administrador y un archivo por cada grupo de color: recibe el PDF editado y la URL
para descargarlo o almacenarlo. Hoy esto solo es posible con sesión de administrador en el panel.

**Why this priority**: es el objetivo de negocio declarado del sistema (AGENTS.md §1); sin esto el
plugin solo se usa de forma manual.

**Independent Test**: con credencial válida, `op=procesar` sobre `circulo6cm.pdf` con sus 2 grupos
(`0000FF`, `FF0000`): respuesta 200 con URL, y el PDF descargado tiene las imágenes insertadas en
todas las instancias de cada grupo, encajadas sin deformar ni recortar.

**Acceptance Scenarios**:

1. **Given** credencial válida y un PDF subido con grupos analizados, **When** se envía un archivo por grupo, **Then** responde 200 con `{ok:true, url, grupos, resumen, expira}` y el PDF descargable tiene las imágenes aplicadas.
2. **Given** un grupo sin archivo, **When** se procesa, **Then** ese grupo conserva su transparencia original, los demás se aplican, y `resumen.grupos_sin_imagen` lo informa (comportamiento vigente del Motor).
3. **Given** un PNG con el texto ya estilizado por el consumidor, **When** se envía como imagen del grupo, **Then** se procesa igual que una foto (el motor no distingue el origen del raster).
4. **Given** un archivo en cualquier formato soportado y cualquier proporción, **When** se procesa, **Then** se encaja con `contain` (nunca se deforma ni se recorta) y los márgenes sobrantes quedan transparentes.

---

### User Story 2 - Todo fallo es accionable y nunca deja un resultado a medias (Priority: P1)

El consumidor equivocó el nombre del PDF, un id de grupo o la credencial. Recibe una causa exacta
y accionable, y el sistema no deja archivos parciales ni un PDF que aparente estar listo cuando no
lo está.

**Why this priority**: una API la consume código de terceros; sin causas accionables cada error se
vuelve un ticket, y un resultado parcial es peor que un fallo (el consumidor lo creería bueno).

**Independent Test**: provocar 5 errores (credencial inválida, PDF inexistente, id de grupo
inexistente, ningún grupo con imagen, formato no soportado) y comprobar la causa exacta en cada
caso y que el trabajo queda sin archivos nuevos.

**Acceptance Scenarios**:

1. **Given** un id de grupo que no existe en `analisis.json`, **When** se procesa, **Then** responde error `api:procesar:grupo_desconocido` listando el id, y NO se escribe ningún archivo del trabajo.
2. **Given** un PDF no subido o no analizado, **When** se procesa, **Then** responde `api:procesar:pdf_inexistente` o `api:procesar:sin_analisis`, sin escribir nada.
3. **Given** credencial ausente, inválida o de un usuario sin `manage_options`, **When** se llama, **Then** responde 401 con `api:autenticacion:*` y NO se invoca al Motor.
4. **Given** que ningún grupo trae imagen, **When** se procesa, **Then** responde `api:procesar:sin_imagenes` y NO se escribe el PDF de salida.
5. **Given** un error después de haber escrito archivos temporales, **When** termina, **Then** el trabajo se limpia y no queda un entregable parcial.

---

### User Story 3 - Reintentar no reprocesa ni duplica (Priority: P2)

El consumidor reenvía la misma petición porque no leyó la respuesta o porque hubo un timeout. No
genera un segundo PDF ni duplica archivos: reusa el resultado del trabajo anterior.

**Why this priority**: sin idempotencia, cada reintento del consumidor desperdicia CPU y disco en
un hosting compartido, y los entregables se multiplican.

**Independent Test**: enviar dos veces el mismo `job_id` con los mismos grupos: la segunda respuesta
tiene el mismo `url`, no se escribe un PDF nuevo y el recuento de archivos del trabajo no cambia.

**Acceptance Scenarios**:

1. **Given** un `job_id` ya procesado con el mismo PDF y los mismos grupos, **When** se reenvía, **Then** responde 200 con la misma `url` y 0 regeneraciones.
2. **Given** un `job_id` existente con contenido **distinto**, **When** se reenvía, **Then** responde `api:procesar:job_conflicto` y NO sobrescribe el entregable anterior.
3. **Given** dos peticiones simultáneas con el mismo `job_id`, **When** corren, **Then** solo una genera el PDF (la otra espera y reusa).

### User Story 4 - Los entregables no se acumulan para siempre (Priority: P2)

Los archivos generados por la API se purgan solos pasado el TTL. El administrador no tiene que
limpiar nada a mano y el hosting no se llena.

**Why this priority**: sin retención, cada llamada deja un PDF permanente; el crecimiento es
invisible hasta que el disco se llena y ya es un incidente.

**Independent Test**: fijar un TTL corto (ej. 60 s), procesar, esperar y ejecutar la purga: la
carpeta del trabajo desaparece completa y `op=estado` responde que ya no existe.

**Acceptance Scenarios**:

1. **Given** un trabajo con `expira` en el pasado, **When** corre la purga, **Then** su carpeta se elimina completa (manifiesto, pool y PDF) y no quedan archivos sueltos.
2. **Given** un trabajo vigente, **When** corre la purga, **Then** NO se toca.
3. **Given** un trabajo expirado que el consumidor vuelve a pedir, **When** consulta, **Then** responde `api:estado:expirado` y MAYO regenerar solo si envía un `job_id` nuevo.

### Edge Cases

- PDF con 1 grupo y sin imagen, y con 40 grupos: los no enviados quedan transparentes; el resumen
  siempre lista `grupos_sin_imagen`.
- Grupo repetido en la misma petición (mismo id dos veces): se rechaza por ambigüedad
  (`api:procesar:grupo_duplicado`) en vez de elegir uno en silencio.
- Archivo de 0 bytes o corrupto (no es una imagen válida): `api:procesar:imagen_invalida`, sin
  escritura de entregable.
- Imagen muy grande: se rechaza por límite declarado, no por agotar memoria.
- `job_id` con caracteres de ruta (`../`): se sanea con el helper de nombres del motor, nunca se
  usa crudo para construir la ruta.
- Petición sin ningún campo de grupo: `api:procesar:sin_imagenes` (no es un PDF vacío válido).
- Respuesta parcial por límite de tiempo del servidor: no se entrega un PDF truncado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer **un único endpoint** `admin_post_pmu_api` (+ variante `nopriv`) con dispatcher `op=`. No DEBE introducir rutas REST ni un segundo camino de escritura.
- **FR-002**: La autenticación DEBE ser por **Application Passwords del núcleo** (WP ≥ 5.6) y el usuario DEBE tener `manage_options`. El endpoint DEBE exigir HTTPS. NO DEBE usar `seguridad()` (nonce + sesión admin).
- **FR-003**: `op=procesar` DEBE aceptar el nombre de un PDF ya subido (`pdf`) y **un archivo por grupo**, con el **id de grupo (hex 6) como clave del campo** del archivo enviado.
- **FR-004**: Los formatos DEBEN ser los que `Imagen` ya soporta: PNG, JPG/JPEG, WebP y GIF. Cualquier otro DEBE rechazarse con causa.
- **FR-005**: Cada id recibido DEBE validarse contra `analisis.json` **antes** de escribir nada. Un id inexistente DEBE ser error, no un hueco vacío.
- **FR-006**: El procesamiento DEBE usar `Motor::procesar($ruta_pdf, $analisis, $mapa)` **con** dataset (no `procesar_pedido()`), de modo que el encajado `contain` y la validación del dataset sean los del Motor, sin reimplementar nada.
- **FR-007**: Toda ruta y todo archivo DEBEN resolvederse a través de `PMU_Uploads` (agregando los helpers del ámbito `api`); NO DEBE haber construcción de rutas fuera de esa clase.
- **FR-008**: El trabajo DEBE vivir en `uploads/pmu/api/{job_id}/` con `manifest.json`, pool `img/` y `{pdf}_procesado.pdf`. El `job_id` DEBE sanearse con el helper de nombres del motor.
- **FR-009**: El `job_id` DEBE funcionar como **clave de idempotencia**: reenviar el mismo `job_id` con el mismo PDF y los mismos grupos DEBE reusar el entregable sin regenerar; con contenido distinto DEBE rechazar por conflicto sin sobrescribir.
- **FR-010**: Los trabajos DEBEN tener **retención por TTL, 7 días por defecto y configurable**, con purga que elimine la carpeta completa (manifiesto, pool y PDF) y no deje archivos sueltos.
- **FR-011**: La respuesta DEBE ser JSON con `ok`, `url`, `grupos`, `resumen` (incluido `grupos_sin_imagen`) y `expira`.
- **FR-012**: Todo fallo DEBE informar con la convención de causa **`api:<op>:<motivo>`** (misma familia que `motor:sprite:*` y `motor:sesion:*`). NO DEBE haber mensajes genéricos ni páginas HTML de error.
- **FR-013**: **Ninguna falla puede dejar un entregable parcial**: o se escribe el PDF completo o se limpia el trabajo.
- **FR-014**: Los grupos sin imagen DEBEN conservar su transparencia original (comportamiento vigente del Motor) y listarse en el resumen.
- **FR-015**: El servidor **NO DEBE renderizar texto ni ejecutar JS**. El texto con estilo llega rasterizado desde el consumidor (D1).
- **FR-016**: La respuesta DEBE ser **síncrona** en v1.
- **FR-017**: DEBEN existir límites explícitos y declarados: tamaño máximo por archivo, cantidad máxima de grupos por petición y tiempo máximo de ejecución; al superarlos, causa `api:procesar:limite_*`.
- **FR-018**: La verificación automática DEBE cubrir la API (fases propias en `tests/texto_puente.php`, un proceso por fase) y la pestaña Test DEBE verificar en el sitio real que el endpoint responde y rechaza credenciales ausentes.
- **FR-019**: La documentación vigente (este AGENTS.md, `constitution` con Sync Impact Report, `readme.txt`, `specs/INDICE.md`) DEBE quedar coherente con la API, incluida la subida del mínimo de WordPress a 5.6.

### Key Entities

- **Credencial**: Application Password del núcleo, perteneciente a un usuario con `manage_options`; se invalida desde el perfil de WordPress.
- **Trabajo (`job_id`)**: unidad de idempotencia elegida por el consumidor; carpeta propia en `uploads/pmu/api/{job_id}/` con manifiesto, pool y entregable.
- **Entrada de grupo**: par (id de color hex 6, archivo raster). El id debe existir en `analisis.json`.
- **Entregable**: `{pdf}_procesado.pdf` resultante, con su `expira` calculado desde el TTL vigente.
- **Causa**: código `api:<op>:<motivo>` que identifica operación y motivo exacto del fallo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con credencial válida y el PDF de referencia del sitio (`circulo6cm.pdf`, 2 grupos), una llamada devuelve 200 con `url` y el PDF descargado tiene las imágenes insertadas en **todas** las instancias de cada grupo, encajadas sin deformar ni recortar.
- **SC-002**: Un id de grupo inexistente produce `api:procesar:grupo_desconocido` y **0 bytes** escritos bajo `uploads/pmu/api/` (verificable contando archivos antes y después).
- **SC-003**: Sin credencial, con credencial inválida o con un usuario sin `manage_options` la respuesta es 401 con `api:autenticacion:*` y el Motor **nunca** se invoca.
- **SC-004**: Con 3 grupos en el PDF y 1 sola imagen enviada, responde 200, el PDF sale con 1 grupo aplicado y `resumen.grupos_sin_imagen` lista los otros 2 con su transparencia original.
- **SC-005**: El tiempo de respuesta del PDF de referencia es **< 10 s** (objetivo heredado de la spec 004) con el catálogo de imágenes del sitio real.
- **SC-006**: Reenviar el mismo `job_id` con el mismo contenido devuelve la misma `url` y **0 regeneraciones** (el mtime del entregable no cambia); con contenido distinto devuelve `api:procesar:job_conflicto` sin sobrescribir.
- **SC-007**: Con TTL vencido, la purga deja **0 archivos** del trabajo (recuento recursivo de `uploads/pmu/api/` antes y después) y no toca trabajos vigentes.
- **SC-008**: El 100% de los fallos probados informa `api:<op>:<motivo>`: **0** mensajes genéricos, **0** páginas HTML y **0** entregables parciales tras un error.
- **SC-009**: Las puertas automáticas del proyecto pasan en verde: `php -l`, `motor_smoke`, `parity`, todas las fases de `texto_puente.php` (incluidas las nuevas de la API) y `smoke_checks()` en el sitio real.
- **SC-010**: `grep` de control: **0** rutas construidas fuera de `PMU_Uploads` y **0** rutas nuevas fuera de `uploads/pmu/api/`.
- **SC-011**: El servidor **no ejecuta Node, Python ni render de texto**: el único PHP implicado es el plugin (motor puro), verificado porque `smoke_checks()` sigue reportando PHP 7.4+ y sin dependencias nativas nuevas.

## Assumptions

- **Consumidor servidor-a-servidor**: la API se consume desde un backend propio (ERP, intranet o
  tienda), no desde un navegador. Por eso se usa Application Passwords (Basic Auth) y no cookies.
- **HTTPS obligatorio**: Application Passwords exigen un sitio con TLS; en HTTP la autenticación
  no es viable y el endpoint DEBE rechazarla.
- **WordPress mínimo 5.6**: dependencia dura de Application Passwords. `readme.txt` declara hoy 5.0,
  así que la implementación sube ese mínimo (o documenta la degradación con causa accionable).
- **Los PDFs base los sube el administrador** por la consola; la API no acepta PDFs nuevos ni los
  analiza. El nombre enviado DEBE corresponder a un PDF ya subido con `analisis.json` vigente. La
  geometría nunca se edita desde la API.
- **El `job_id` es responsabilidad del consumidor** y debe ser estable entre reintentos (p. ej. el
  id del pedido). El sistema lo sanea, pero no puede adivinar la intención de reintento.
- **La purga se ejecuta de forma diferida**: se dispara en un `wp-cron` y también de forma
  oportunista al procesar (para que no dependa de que el cron corra en un hosting compartido). Es un
  barrido acotado, no una tarea pesada.
- **El TTL es configurable** por filtro de WordPress, con 7 días como valor por defecto; el valor
  efectivo queda en `manifest.json` de cada trabajo (`expira`), de modo que un cambio de TTL no
  invalida trabajos ya creados.
- **Sin modo asíncrono en v1** (D4): el modo `job` consultable queda para una spec posterior si
  aparece un caso real que lo exija.
- **Fuera de alcance**: render de texto en el servidor (D1, incompatible con la constitución §III),
  análisis de PDFs nuevos por la API, gestión de productos o pedidos de Woo desde la API, cobro, y
  cualquier tabla en base de datos (constitución §IV).