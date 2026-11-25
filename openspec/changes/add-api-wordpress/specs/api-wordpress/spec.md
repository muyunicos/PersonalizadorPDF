# Spec Delta — api-wordpress

## Purpose

API sincrona servidor-a-servidor para procesar compras de PDFs editados: recibe el nombre
de un PDF base y un archivo rasterizado por grupo, y devuelve la URL al PDF procesado con
autenticacion del nucleo, validacion estricta e idempotencia por `job_id`.

## ADDED Requirements

### Requirement: Endpoint unico con dispatcher op
El sistema SHALL exponer un unico endpoint `admin_post_pmu_api` (+ variante `nopriv`) con
dispatcher `op=`, sin introducir rutas REST ni un segundo camino de escritura.

#### Scenario: Procesar por op
- **WHEN** se llama `admin_post_pmu_api` con `op=procesar`
- **THEN** el dispatcher enruta a la operacion sin crear rutas REST

### Requirement: Autenticacion del nucleo
El sistema SHALL autenticar por Application Passwords del nucleo (WP >= 5.6) con capability
`manage_options` y SHALL exigir HTTPS; no SHALL usar `seguridad()` (nonce + sesion admin).

#### Scenario: Credencial ausente o invalida
- **WHEN** la credencial falta, es invalida o el usuario no tiene `manage_options`
- **THEN** responde 401 con `api:autenticacion:*` y no invoca al Motor

#### Scenario: HTTP sin TLS
- **WHEN** la peticion llega por HTTP
- **THEN** se rechaza por exigir HTTPS

### Requirement: Entrada rasterizada por grupo
El sistema SHALL aceptar en `op=procesar` el nombre de un PDF subido (`pdf`) y un archivo
rasterizado por grupo (PNG/JPG/JPEG/WebP/GIF) con el id de grupo hex 6 como clave del campo,
sin distinguir foto de texto estilizado.

#### Scenario: Texto estilizado como imagen
- **WHEN** el consumidor envia un PNG con texto ya rasterizado
- **THEN** se procesa igual que una foto

#### Scenario: Formato no soportado
- **WHEN** llega un formato distinto de los soportados
- **THEN** se rechaza con causa `api:procesar:imagen_invalida`

### Requirement: Validacion estricta de ids
El sistema SHALL validar cada id recibido contra `analisis.json` antes de escribir nada; un
id inexistente SHALL ser error (`api:procesar:grupo_desconocido`), no un hueco vacio.

#### Scenario: Id inexistente
- **WHEN** un id de grupo no existe en `analisis.json`
- **THEN** responde `api:procesar:grupo_desconocido` y no escribe ningun archivo

#### Scenario: Grupo duplicado
- **WHEN** el mismo id aparece dos veces en la peticion
- **THEN** se rechaza por `api:procesar:grupo_duplicado`

### Requirement: Procesamiento con el Motor
El sistema SHALL procesar con `Motor::procesar($ruta_pdf, $analisis, $mapa)` con dataset,
de modo que el encajado contain y la validacion sean los del Motor, sin reimplementar nada.

#### Scenario: Encajado contain
- **WHEN** se procesa un archivo de cualquier proporcion
- **THEN** se encaja con contain sin deformar ni recortar y el Motor aplica el resto

### Requirement: Rutas por PMU_Uploads y ambito api
El sistema SHALL resolver toda ruta por `PMU_Uploads` (helpers del ambito `api`) y SHALL
guardar el trabajo en `uploads/pmu/api/{job_id}/` con `manifest.json`, pool `img/` y
`{pdf}_procesado.pdf`, saneando el `job_id`.

#### Scenario: job_id con caracteres de ruta
- **WHEN** el `job_id` trae `../`
- **THEN** se sanea con el helper de nombres antes de construir la ruta

### Requirement: Idempotencia por job_id
El sistema SHALL usar el `job_id` como clave de idempotencia: el mismo `job_id` con el mismo
PDF y grupos SHALL reusar el entregable sin regenerar; con contenido distinto SHALL rechazar
por `api:procesar:job_conflicto` sin sobrescribir.

#### Scenario: Reintento identico
- **WHEN** se reenvia el mismo `job_id` con el mismo contenido
- **THEN** responde 200 con la misma `url` y 0 regeneraciones

#### Scenario: Conflicto de contenido
- **WHEN** se reenvia un `job_id` existente con contenido distinto
- **THEN** responde `api:procesar:job_conflicto` sin sobrescribir

### Requirement: Retencion por TTL
El sistema SHALL purgar los trabajos por TTL (7 dias por defecto, configurable) eliminando
la carpeta completa (manifiesto, pool y PDF) sin dejar archivos sueltos, de forma diferida
por cron y oportunista.

#### Scenario: Trabajo expirado
- **WHEN** corre la purga sobre un trabajo con `expira` en el pasado
- **THEN** su carpeta se elimina completa y no toca trabajos vigentes

### Requirement: Respuesta JSON y causas accionables
El sistema SHALL responder JSON con `ok`, `url`, `grupos`, `resumen` (incluido
`grupos_sin_imagen`) y `expira`, e SHALL informar todo fallo con la convencion
`api:<op>:<motivo>`, sin mensajes genericos ni paginas HTML.

#### Scenario: Fallo con causa exacta
- **WHEN** ocurre un error en una operacion
- **THEN** la respuesta lleva causa `api:<op>:<motivo>` sin HTML generico

### Requirement: Sin entregable parcial
El sistema SHALL garantizar que ningun fallo deje un entregable parcial: o se escribe el PDF
completo o se limpia el trabajo; los grupos sin imagen conservan su transparencia y se listan.

#### Scenario: Error tras escribir temporales
- **WHEN** un error ocurre despues de escribir archivos temporales
- **THEN** el trabajo se limpia y no queda entregable parcial

### Requirement: Limites explicitos
El sistema SHALL declarar limites de tamano por archivo, cantidad de grupos por peticion y
tiempo de ejecucion, rechazando con causa `api:procesar:limite_*` al superarlos.

#### Scenario: Archivo demasiado grande
- **WHEN** un archivo supera el limite declarado
- **THEN** se rechaza con `api:procesar:limite_*` sin agotar memoria

### Requirement: Verificacion y documentacion
El sistema SHALL cubrir la API con fases propias en `tests/texto_puente.php` y la pestaña
Test, y SHALL dejar coherente la documentacion (AGENTS.md, constitution, `readme.txt`,
`specs/INDICE.md`) con el minimo de WordPress 5.6.

#### Scenario: Fase de API en el arnes
- **WHEN** corre `tests/texto_puente.php`
- **THEN** existe una fase que ejerce la API y la pestaña Test verifica el endpoint