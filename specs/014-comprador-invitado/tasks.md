# Tareas — 014 Comprador invitado

> Regla: **no marcar `[X]` una tarea por aproximacion**. Si falta un requisito,
> `[~]`. Estado: 7/7 `[X]`, verificado en navegador real sin sesion (lab).

## Fase 1 - Autorizacion por cookie

- [X] **T001** Auditoria previa: los cuatro endpoints ya estaban con
  `wp_ajax_nopriv_` (`L92/96/99/102`); lo unico que frenaba al invitado era el
  `current_user_can('read')` dentro de cada handler (`L1101/1301/1375/1444`).
- [X] **T002** `Personalizador_PDF_Plugin::sesion_del_comprador()` (privado): nonce
  ya verificado por el caller; toma el sid de `PMU_Sesion::sid_actual()` (la
  cookie) y, con `item_key` no vacio, exige que el manifest exista bajo ese sid
  (`motor:sesion:item:ajeno`). Devuelve el sid verificado.
- [X] **T003** Los cuatro handlers (`vista_previa`, `pool`, `subida`,
  `subida_url`) cambian `current_user_can('read')` por `sesion_del_comprador()` y
  **dejan de leer el `sid` del POST**. El orden queda nonce primero: no se toca
  la sesion de un request sin nonce valido (FR-002).
- [X] **T004** Limpieza de las reasignaciones que quedaron del camino viejo
  (`$sid = $sesion->sid_actual()` dentro del try de `vista_previa` y del draft en
  `subida`): ahora el sid sale una sola vez, de la cookie.

## Fase 2 - Pruebas

- [X] **T005** Fases del arnes `invitado` (con `PD_PUENTE_SIN_CAP=1`: sin cuenta
  el pool tiene que funcionar) e `invitado_ajeno` (cookie de la sesion propia +
  `item_key` de otra → `motor:sesion:item:ajeno`). `pool`/`pool_reem` actualizados
  a fijar `$_COOKIE[PMU_Sesion::COOKIE]`: es el contrato nuevo y sin la cookie el
  item rightful se ve ajeno (que es justo lo que hay que comprobar).
- [X] **T006** `%TEMP%\pmu-e2e\smoke-invitado.js`: navegador **sin loguearse**
  (contexto nuevo, sin cookie de WordPress) que recorre la ficha real: monta el
  panel, verifica que se emite `pmu_sid` con `httponly`, sube 2 fotos por el
  cargador comprobando que con 1 de 2 "Listo" sigue deshabilitado (D16), y
  comprueba en disco que los archivos quedaron bajo `tmp/sesion-{sid}/{item}/`.
- [X] **T007** Regresion: `smoke-ficha.js` (logueado) sigue en `CARGADOR OK` y el
  resto del arnes en 24/24. El flujo con cuenta no se rompio al abrir el de sin
  cuenta.

## Nota de orden del lab

`sembrar-shortcode.php` **reutiliza** los campos que ya existen en
`uploads/pmu/campos/`: si se corre tras otro smoke, la ficha se queda con el
cargador del campo que dejo ese smoke (`min:1`) en vez del sembrado (`min:2`) y
`smoke-ficha.js` falla por lo mismo. Orden canonico: **borrar `campos/` ->
`sembrar-shortcode.php` -> `smoke-invitado.js` -> `smoke-ficha.js` -> el resto**.
Morderlo dos veces esta sesion: no es un fallo del plugin.