# Requirements checklist: campos-consola

**Feature**: 012-campos-consola | **Fecha**: 2026-10-04

> **Que mide este checklist**: que **cada requisito de la spec este especificado y cubierto por
> alguna tarea** de `tasks.md`. NO mide que este implementado.
> `[X]` = el requisito esta especificado y asignado a una tarea · `[ ]` = falta definir o asignar.
>
> **Estado de implementacion**: **0 de 32 tareas hechas** (ver `tasks.md`, todas `[ ]`).
> La implementacion arranca con la **F0** (migracion v1 -> v2), que requiere aprobacion
> explicita porque escribe sobre los datos del admin en produccion.

## Historias de usuario

- [X] **US1** El admin edita un campo sin que la pagina se recargue (FR-001…FR-003)
- [X] **US2** El admin prueba el campo y ve `{valor, cliente}` en vivo (FR-004…FR-009)
- [X] **US3** El admin busca, filtra por categoria y ordena la tabla (FR-010…FR-014)
- [X] **US4** El admin crea desde plantilla, marca plantillas, duplica, restaura, importa/exporta (FR-015…FR-022)
- [X] **US5** El admin edita el CSS/JS global; se carga en toda ficha con campos (FR-023…FR-027)
- [X] **US6** El comprador sube imagenes con el cargador (ranuras, drag & drop) (FR-028…FR-035)
- [X] **US7** Un campo de imagenes llega al PDF, una imagen por instancia (FR-036, FR-037', FR-038…FR-041)

## Modelo de datos

- [X] El campo **no tiene `tipo`**; el tipo vive solo en el placeholder
- [X] `nombre` (admin) / `descripcion` (admin) / `titulo_cliente` (comprador) son 3 datos distintos
- [X] El HTML del campo incluye el titulo/ayuda que ve el comprador (no se inyectan)
- [X] Un campo = `campos/{id}/datos.json` + `campo.htm|css|js`; `campos.json` es el indice
- [X] `meta` guarda `creado`, `modificado` (para `?v=`) y `categorias`
- [X] La baja **conserva** los archivos (`baja:true`) y se puede restaurar
- [X] Los ids dados de baja **no se reutilizan**
- [X] La migracion v1->v2 es **one-shot**, con `.bak` y todo-o-nada

## Comprador (ficha)

- [X] El valor dual se respeta: jamas se muestra `valor` crudo ni se procesa `cliente`
- [X] Prioridad de salida: `campo.js` > `data-rol` > primer input > global
- [X] Los campos `protegido` no viajan al HTML publico
- [X] Los campos invisibles (helpers) siguen publicando valor
- [X] PHP nunca evalua JS

## Cargador de imagenes

- [X] N ranuras con `w`,`h`,`forma`,`min`,`max`
- [X] Acepta el archivo arrastrandolo y por clic
- [X] La subida ocurre al confirmar el recorte, antes de la vista previa
- [X] El `min` **exige**: "Aceptar" queda deshabilitado hasta alcanzar el minimo (D16)
- [X] El id lo genera el servidor (nunca el cliente)
- [X] Destino: `tmp/sesion-{sid}/{item_key}/subidas/` + `manifest.subidas[]`
- [X] Formato **WebP** (GD verificado en el hosting; smoke check nuevo, D14)
- [X] El pool de grupos (`img/`) no se toca
- [X] Al pagar, `subidas/` viaja con el item

## Reparto entre instancias (D17/D18/D19)

- [X] El placeholder **no exige** N = cont
- [X] Con `[v] Repetir`: el idx **cicla** (4 fotos en 8 instancias -> 1,2,3,4,1,2,3,4)
- [X] Sin `[v]`: las sobrantes quedan **vacias**, sin bloquear la compra
- [X] Regla **igual para texto e imagenes** (se elimina el bloqueo actual de `conciliarGrupo`)
- [X] Instancia vacia = informe normal, **sin aviso ni error** (queda en `grupos_sin_imagen`)
- [X] Los asserts de `tests/conciliacion.js` se actualizan

## Motor

- [X] `$rutasImagenes[$id]` acepta `string` (hoy) **o** lista (una por instancia)
- [X] Con `string` el comportamiento es **exactamente** el de hoy
- [X] El encajado (`contain`) se aplica a cada imagen de la instancia
- [X] N != `cont` -> aviso y **bloqueo** (nunca un PDF a medias)

## Global

- [X] Un solo `global.css` y `global.js` para todo el plugin
- [X] Se edita desde la pestana Campos
- [X] Se carga solo si el panel tiene >=1 campo
- [X] El CSS va prefijado con `[data-pmu-panel]`
- [X] El global es **codigo libre del admin**; solo se garantiza que corre antes de montar (D21)
- [X] El sistema **no traduce nada**: ni tabla, ni `traducir()`, ni auto-deteccion (D21)
- [X] `cliente` sale de `campo.js` > `data-rol`; si no hay ninguno, queda **vacio** (nunca `valor`)

## Consola (admin)

- [X] Editar no navega (desaparece `?ec_campo_editar=`)
- [X] La fila se refresca con los valores reales al guardar
- [X] Respuestas JSON; nunca pagina de error ni recarga
- [X] El preview va en un iframe de 350px (aisla los CSS runaway)
- [X] El preview no rompe la consola si el `campo.js` falla
- [X] "Probar" del cargador no sube nada
- [X] Importar es todo-o-nada y nunca pisa un id en uso
- [X] La columna "usado en N PDF(s)" informa el uso real

## Puertas de calidad

- [X] `php -l` en plugin + `admin/` + `engine/` + `inc/`
- [X] `motor_smoke.php` (SMOKE OK)
- [X] `parity.php` (PARIDAD OK)
- [X] `texto_puente.php` en todas sus fases (una por proceso)
- [X] `node --check` + las 2 puertas de mockups (no se rompen)
- [X] Nueva puerta Node `tests/campos-contrato.test.js`

## Fuera de alcance (declarado, no es fallo)

- [X] Correos (el plugin no manda ninguno hoy)
- [X] Editor de codigo con resaltado
- [X] Boton "Anadir al catalogo `img/`" desde la pestana
- [X] Reordenar el panel del comprador (manda `campos_ids[]`)
- [X] Tocar `modules/textmuy/` (sin bump `?v=RCn`)
- [X] La API (spec 010)
