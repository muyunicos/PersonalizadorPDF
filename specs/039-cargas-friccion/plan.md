# Plan de implementacion: Motor de cargas — friccion del pipeline (039)

**Rama**: (sin rama: el repo despliega desde `main`)
**Spec**: [spec.md](./spec.md)
**Estado**: plan (borrador), sin implementar
**Creada**: 2026-11-19

---

## Summary

Cerrar 6 hallazgos del pipeline de cargas del comprador (specs 016/019/021/024/026/027/028/030/035/036),
sin agregar edicion de imagen y sin tocar el Motor:

1. **H1/H6** — retirar la rama de reuso `op=usar` (`_bibMadre`, `_yaElegido`, `usarBiblioteca`) y
   el modelo "familias" (`familias()`, `familia_de()`, `borrar_familia_dir()`): era codigo muerto
   que arrastraba el bug de "Elegir" (0 bytes).
2. **H2/D1** — mini-dialogo de confirmacion propio en `visor-pmu.js` para `Eliminar`; tras borrar
   el visor no se reabre.
3. **H3/D2** — "Reintentar" al tocar una miniatura cuya subida fallo (blob en memoria).
4. **H4/D3** — borrado en el acto de la fila del manifest y del archivo compartido (si nadie lo
   referencia), idempotente, sin tocar `orders/`.
5. **H5** — `PMU_FICHA.subidas.detalle()` para ver que queda en vuelo.
6. **D4** — la tira "Mis imagenes" carga directo (IndexedDB o `op=imagen`), sin visor de biblioteca.

**Fuera**: `engine/`, `modules/textmuy/`, el tema `muyunicos`, migracion de datos, la 010.

## Technical Context

- **Lenguaje/stack**: PHP 8 (min. 7.4) en hosting compartido (Hostinger Business: sin `exec`, sin
  Node/Python en runtime) + JS ES5 sin build en `assets/`. El Motor PHP puro en `engine/` **no se toca**.
- **Dependencias**: WordPress + WooCommerce; GD/WebP (ya requisito); en el cliente Canvas 2D,
  `objectURL`, IndexedDB y `localStorage`, sin librerias nuevas.
- **Almacenamiento**: `uploads/pmu/` con `PMU_Uploads` como **dueno unico**. El original vive en
  `tmp/sesion-{sid}/uploads/{id}.{ext}` (compartido por la sesion, C3 de la 035) y al pagar se
  mueve a `orders/{cliente}/uploads/`.
- **Endpoints**: `admin_post_personalizador_pdf_biblioteca` (`op=listar|imagen|borrar`; se retiran
  `usar`/`usos`). No se agregan rutas REST.
- **Testing**: puertas del repo (`php -l`, `node --check`, `tests/selector-contrato.test.js`,
  `tests/campos-contrato.test.js`, `tests/biblioteca-contrato.test.js`, `tests/cola-subida.test.js`,
  `tests/texto_puente.php`, `tests/motor_smoke.php`).
- **Target**: navegadores modernos con Canvas 2D + IndexedDB; servidor PHP 8.
- **Constraints**: el Motor **intacto**; el borrado en el acto solo afecta al item en edicion
  (`tmp/`), nunca lo comprado (`orders/`); `madre` se conserva solo por compatibilidad de lectura.
- **Scale**: no cambia el computo del servidor; baja el peso de la tira (una entrada por imagen).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| Sin Python/Node en runtime | §II | OK: el cambio es JS de navegador + PHP; nada nuevo en runtime. |
| Datos fuera del plugin | §IV | OK: no agrega ambitos ni catalogos; usa `tmp/sesion-{sid}/uploads/` existente. |
| Un duenio por dato | §II | OK: `PMU_Sesion` sigue siendo el dueno del manifest y de los originales; el borrado nuevo (`borrar_original_item`) vive ahi. |
| Sin duplicados | §II | OK: la tira reusa `PMUBiblioteca`; el mini-dialogo vive en `visor-pmu.js` (compartido). |
| El Motor no renderiza texto | §III | OK: `engine/` intacto; el borrado no toca el pipeline de composicion. |
| Sin migracion | §IV | OK: D7, sin migracion; `madre` se conserva por lectura. |

## Fases

| Fase | Que entrega | Dependencias |
|---|---|---|
| **F0** | Enmienda de docs (029/030/035) + esqueletos de puertas | — |
| **F1** | US1/D1: mini-dialogo de confirmacion en `visor-pmu.js` | F0 |
| **F2** | US2/D2: reintento de subida al tocar la miniatura | F1 |
| **F3** | US3/D4/D5: tira "Mis imagenes" carga directo; se retira `op=usar`/`usar`/`familias` | F2 |
| **F4** | US1/D3: borrado en el acto (PHP `borrar_original_item` + `op=borrar`) | F1 |
| **F5** | US4/H5: `subidas.detalle()` + aviso accionable | F4 |
| **F6** | Polish: puertas + docs + version | todas |

##orden de ejecucion (por dependencias)

1. **F1** (mini-dialogo) — es lo que desbloquea que `Eliminar` tenga donde confirmar antes de que
   `Eliminar` borre de verdad (F4). Sin F1, F4 borraria sin preguntar.
2. **F2** (reintento) — depende de que la miniatura pueda marcarse; no depende de F3.
3. **F3** (tira directa + limpieza) — la mas invasiva; se hace antes de F4 porque el borrado en
   el acto necesita que la tira ya no use `op=usar`.
4. **F4** (borrado real, PHP) — toca `personalizador-pdf.php` y `inc/class-pmu-sesion.php`.
5. **F5** (detalle de cola) — rapido, no bloquea nada.
6. **F6** (puertas + docs + bump).

## Puertas por fase

| Fase | Puerta |
|---|---|
| F1 | `node tests/biblioteca-contrato.test.js` (visor con confirmacion) + `node --check assets/visor-pmu.js` |
| F2 | `node tests/cola-subida.test.js` (reintento) + `node --check assets/cargador-pmu.js` |
| F3 | `node tests/selector-contrato.test.js` (sin `Elegir`/`usar`) + `node tests/biblioteca-contrato.test.js` |
| F4 | `php tests/texto_puente.php biblioteca` (borrado + idempotencia) + `php -l` |
| F5 | `node tests/cola-subida.test.js` (detalle) |
| F6 | `php tests/motor_smoke.php` + `node tests/campos-contrato.test.js` + bump + `specs/INDICE.md` |

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Retirar `op=usar` rompe un consumidor no visto | Buscar `usarBiblioteca`/`op=usar` en todo el repo antes de F3 (SC-004). El unico consumidor es `selector-pmu.js` via `config.usar`. |
| El borrado en el acto toca `orders/` por error | `borrar_original_item` solo mira `tmp/sesion-{sid}/`; se probo con `texto_puente.php` (fase biblioteca) que cubre `orders/`. |
| Un `id` borrado y re-subido | `guardar_subida` recrea el archivo si no existe (`:899-902`). |
| El mini-dialogo pelea con el z-index del tema | Vive dentro del visor (`pmu-visor--sobre`, z-index 200000), no en un modal aparte. |