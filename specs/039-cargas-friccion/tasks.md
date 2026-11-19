# Tasks: Motor de cargas — friccion del pipeline (039)

**Input**: `specs/039-cargas-friccion/spec.md` (H1-H6, D1-D8, US1-US5, SC-001..005) + `plan.md` (F0-F6)

**Estado**: F0–F6 cerradas (2026-11-19); v4.30.0.

**Formato**: `[ID] [P?] [Fase] Descripcion`. `[P]` = puede ir en paralelo (archivos distintos).
Rutas relativas a la raiz del repo.

---

## Fase F0 — Setup y enmienda de docs

- [X] T001 Correr las puertas base y confirmar verde: `php -l personalizador-pdf.php`, `php -l inc/class-pmu-sesion.php`, `node --check assets/selector-pmu.js`, `node --check assets/cargador-pmu.js`, `node --check assets/visor-pmu.js`, `node --check assets/biblioteca-pmu.js`, `node --check assets/tienda.js`, `node tests/selector-contrato.test.js`, `node tests/cola-subida.test.js`, `node tests/campos-contrato.test.js`, `node tests/biblioteca-contrato.test.js`, `php tests/texto_puente.php biblioteca`, `php tests/texto_puente.php pool`, `php tests/motor_smoke.php`
- [X] T002 [P] Enmendar `specs/030-biblioteca-imagenes/contracts/biblioteca.md` (nota de supersesion: D5/D6 de la 039 retiran `usar`/`usos`/familias) y `contracts/cliente-biblioteca.md` (tira sin versiones, `onElegir` = cargar directo).
- [X] T003 [P] Enmendar `specs/016-editor-visual-fotos/contracts/selector-visual.md` (se retira `Elegir`; el primario siempre dice `Subir`) y `specs/035-fotos-originales-cliente/contracts/fotos-originales.md` (C2: `madre` queda por compatibilidad de lectura; el `id` manda).
- [X] T004 [P] Actualizar `specs/INDICE.md` (fila de la 039 + estado de la 030 como "superada en su modelo de familias") y `docs/decisiones.md` (Sync Impact Report de la 039).
- [X] T005 [P] Crear los esqueletos de las fases nuevas en `tests/texto_puente.php` (`cargas_borrar`, `cargas_reintento`) y en `tests/biblioteca-contrato.test.js` (checks vacios que corren en verde).

---

## Fase F1 — US1/D1: mini-dialogo de confirmacion en el visor

- [X] T010 [F1] `assets/visor-pmu.js`: agregar `pmu-visor-confirmar` (panel sobre el visor) con la pregunta `"Borrar esta imagen?"`, detalle opcional (`opts.detalle`), botones `Cancelar`/`Borrar`, foco atrapado y `Escape = cancelar`. Nueva API: `PMUVisor.confirmar({titulo, detalle, textoOk, onOk}) -> Promise<boolean>`.
- [X] T011 [F1] `assets/visor-pmu.js`: al `abrir({acciones})`, si la accion declara `confirmar: true`, el click pasa por `confirmar()` antes de `onAccion`; si cancela, no se ejecuta.
- [X] T012 [F1] `assets/cargador-pmu.js`: la accion `Eliminar` del visor de la ranura usa `confirmar: true`; tras borrar, **no** reabre el visor (vuelve a la tira; si era la ultima, cierra).
- [X] T013 [F1] Puerta: `node tests/biblioteca-contrato.test.js` con checks nuevos (el visor expone `confirmar`, la accion `Eliminar` pide confirmacion, tras borrar no se reabre).

---

## Fase F2 — US2/D2: reintentar la subida al tocar la miniatura

- [X] T020 [F2] `assets/cargador-pmu.js`: en `_subir` (o en el `onError` del selector), marcar la miniatura con `data-pmu-fallo="1"` y guardar el blob en `_fallos[indice][pos] = {blob, params, madre}`.
- [X] T021 [F2] `assets/cargador-pmu.js`: `_miniTocar(indice, posicion)` mira `_fallos[indice][posicion]`; si hay blob, llama `_reintentar(indice, posicion)` (reusa `_subir` con el blob guardado) y **no** abre el visor.
- [X] T022 [F2] `assets/cargador-pmu.js`: en `_pintar`, la miniatura fallida lleva `title = 'Reintentar subida'` y una marca visual (`cpmu-mini-fallo`); al reintento exitoso se limpia `_fallos` y se repinta.
- [X] T023 [F2] `assets/selector-pmu.js`: al fallar `subirAsync`, el `ultimoBlob` ya queda en memoria (`:1689`); exponer `obtenerBlobFallido()` para que el cargador lo recupere si el modal se cerro.
- [X] T024 [F2] Puerta: `node tests/cola-subida.test.js` con checks nuevos (marca de fallo, reintento sin abrir visor, limpieza al exito).
---

## Fase F3 — US3/D4/D5: "Mis imagenes" carga directo y limpieza de "familias"

- [X] T030 [F3] `assets/biblioteca-pmu.js`: `pintarTira` pasa a **una entrada por imagen** (sin agrupar por `madre`, sin badge `N versiones`); `onElegir(foto)` entrega `{id, url}` y el modal lo carga directo (sin pasar por el visor de la biblioteca).
- [X] T031 [F3] `assets/biblioteca-pmu.js`: retirar `visor()` con `Elegir`/`Borrar` y `usar()` (el visor de la biblioteca ya no existe; borrar se hace desde el visor del campo).
- [X] T032 [F3] `assets/selector-pmu.js`: retirar `_bibMadre`, `config.usar`, `_yaElegido`, `_paramsBase` y `_actualizarPrimario` (el primario siempre `Subir`); el `onElegir` de la tira carga el blob por el camino normal (`drop`).
- [X] T033 [F3] `assets/tienda.js`: retirar `api.usarBiblioteca` y el wiring de `usar` al cargador; la tira de "Mis imagenes" usa `PMUFotos` si existe (0 red) o baja por `op=imagen`.
- [X] T034 [F3] `personalizador-pdf.php`: `handle_biblioteca` deja de aceptar `usar` y `usos` (400/JSON con causa `api:biblioteca:op:retirada`); `listar` devuelve `imagenes[]` (`id`, `url`, `thumb`, `recetas[]`, `bytes`, `creado`).
- [X] T035 [F3] `inc/class-pmu-sesion.php`: retirar `usar_de_biblioteca()`, `familias()`, `familia_de()`, `familia_por_sha()`, `ruta_familia()`, `borrar_familia_dir()`; dejar `familia_*` solo si algo vivo lo usa (verificar con `search_codebase` antes de borrar).
- [X] T036 [F3] Puerta: `node tests/selector-contrato.test.js` (sin `Elegir`/`usar`/`_yaElegido`) + `node tests/biblioteca-contrato.test.js` (tira sin versiones, sin `usar`) + `php tests/texto_puente.php biblioteca` (sin `usar`/`usos`).

---

## Fase F4 — US1/D3: borrado en el acto (PHP)

- [X] T040 [F4] `inc/class-pmu-sesion.php`: nueva `borrar_original_item($sid, $item_key, $id)` — quita la fila de `manifest.subidas[]`, y borra `tmp/sesion-{sid}/uploads/{id}.{ext}` **solo si** ningun otro item de la sesion referencia ese `id`. Idempotente (devuelve `['borrado'=>bool, 'no_hacia_nada'=>bool, 'filas'=>N]`). **Nunca** toca `orders/`.
- [X] T041 [F4] `personalizador-pdf.php`: nueva `op=borrar` en `handle_biblioteca` (`item_key`, `id`) que llama a `borrar_original_item` y responde JSON; requiere `nonceVistaPrevia` + sesion valida.
- [X] T042 [F4] `assets/tienda.js`: `api.borrarFoto(id)` -> POST `op=borrar`; espera `colaDeSubidas().vaciar()` antes; al confirmar, invalida `PMUBiblioteca.invalidar()`.
- [X] T043 [F4] `assets/cargador-pmu.js`: `_quitar(indice, posicion)` deja de ser solo `splice`: pide confirmacion (D1) y llama a `PMU_API.borrarFoto(id)` antes de sacar la miniatura; si el borrado falla, avisa con causa y **no** saca la miniatura.
- [X] T044 [F4] Puerta: `php tests/texto_puente.php biblioteca` con checks nuevos (borrado quita la fila; el archivo compartido se conserva si otro item lo usa; idempotente; `orders/` intacto).

---

## Fase F5 — US4/H5: cola de subida inspeccionable

- [X] T050 [F5] `assets/tienda.js`: `api.subidas.detalle()` -> `{total, campos:{campoId: n}}` (cuenta por campo desde la cola de fotos).
- [X] T051 [F5] `assets/tienda.js`: el aviso "Estamos recibiendo tus archivos" agrega el detalle (cuantas y de que campo) y, si pasaron los reintentos, la causa; si hay un fallo, se puede reintentar (T021).
- [X] T052 [F5] Puerta: `node tests/cola-subida.test.js` con checks nuevos (`detalle()` devuelve la forma correcta; el aviso no queda colgado).

---

## Fase F6 — Polish

- [X] T060 [F6] Correr la bateria completa: `php -l` en todos los `.php`, `node --check` en los `.js` tocados, `node tests/selector-contrato.test.js`, `node tests/campos-contrato.test.js`, `node tests/biblioteca-contrato.test.js`, `node tests/cola-subida.test.js`, `php tests/texto_puente.php` (fases `biblioteca`, `pool`, `campos`), `php tests/motor_smoke.php`.
- [X] T061 [F6] Subir la version **solo en la cabecera** de `personalizador-pdf.php` (`* Version:`) a `4.30.0`; actualizar `readme.txt` (`Stable tag` + changelog).
- [X] T062 [F6] Actualizar `specs/INDICE.md` (fila 039 con estado y puertas) y marcar las tareas `[X]`.

---

## Fase F7 — Retiro TOTAL del modelo "familias" (2026-11-19)

> El usuario pidio "retira familias, estamos en desarrollo": se retira todo, sin
> compatibilidad de lectura (las filas viejas con `madre` se **ignorean**, no se migran).

- [X] T070 Plugin: borrar `biblioteca_madre_por_subida()` y `biblioteca_madre_por_contenido()`;
      `handle_subida` deja de calcular familia y manda `guardar_subida($sid,$item,$bytes,'',$params)`.
- [X] T071 Plugin: borrar `biblioteca_familias()`, `biblioteca_familia_de()`, `biblioteca_ruta_familia()`,
      `url_biblioteca_imagen_madre()`; quitar la rama `madre` de `biblioteca_ruta_imagen()`.
- [X] T072 Plugin: smoke anti-drift actualizado (exige `imagenes`/`borrar_original_item`/`ruta_fila_subida_public`
      y **reprocha** si reaparecen `familias`/`familia_de`/`familia_por_sha`/`ruta_familia`).
- [X] T073 `PMU_Sesion`: borrar `familias()`, `familia_por_sha()`, `familia_de()`, `ruta_familia()`,
      `fila_ref()`; `guardar_subida()` firma nueva **sin `$madre`** (4º arg = `$params`);
      `fila_subida()` ya **no escribe `madre`** (D7).
- [X] T074 Puertas: `texto_puente.php` fase `biblioteca` actualizada (`op=imagen` por `id`, dedupe
      por `id`/`sha`, `madre` ausente en la fila) + `ficha-pedido.browser.js` indexa por `id`
      (`familiasItem`) y textos de E3/E4/E6 actualizados.
- [X] T075 Docs: enmienda `specs/030.../contracts/biblioteca.md`, `cliente-biblioteca.md` y
      `specs/035.../contracts/fotos-originales.md` (C2 sin `madre`); `docs/decisiones.md`
      (Sync Impact Report); `specs/039.../spec.md` (D5/D7 con el detalle del retiro).

---

## Dependencias

- **F0** no depende de nada.
- **F1** depende de F0. **F2** depende de F1 (el reintento se marca en la miniatura que F1 ya pinta).
- **F3** depende de F2. **F4** depende de F1 (confirmacion) y F3 (tira sin `op=usar`).
- **F5** depende de F4. **F6** depende de todas.

## Paralelismo

- T002/T003/T004/T005 son `[P]` entre si (docs distintos).
- T010/T011/T012 son secuenciales (mismo archivo, capas).
- T040/T041 son `[P]` (PHP puro vs handler), pero T041 necesita que T040 exista.
