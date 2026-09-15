# Tasks: Layout PMU de PDFs, metadata como fuente de personalizacion y consola robusta

**Input**: Design documents from `/specs/007-pmu-pdf-layout/`

**Prerequisites**: plan.md (implementado), spec.md (US1–US6, P1–P3), research.md, data-model.md, contracts/

**Tests**: La feature solicita tests de forma explicita (FR-017, research D11): se incluyen tareas de
test por historia usando el arnes existente `tests/texto_puente.php` y las verificaciones de `quickstart.md`.

**Organization**: Tasks grouped by user story. US1 y US2 son P1 (MVP: US1 para desbloquear el panel).

## Format: `[ID] [P?] [Story] Description` — con ruta de archivo exacta.

## Path Conventions

- Plugin WordPress en la raiz del repo: `personalizador-pdf.php`, `admin/`, `engine/`, `inc/`, `assets/`, `tests/`.
- Datos de usuario: `uploads/pmu/` (raiz unica, Constitucion IV).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Base verde y linea de datos antes de tocar nada.

- [ ] T001 Verificar la linea base en verde: `php -l personalizador-pdf.php`, `php -l admin/*.php`, `php -l engine/*.php`, `php -l inc/*.php`, `php tests/motor_smoke.php` (SMOKE OK) y `php tests/parity.php` (PARIDAD OK).
- [ ] T002 Inventariar `uploads/pmu/` y `uploads/personalizador-pdf/` (arbol + archivos) para detectar escrituras accidentales durante la implementacion (comparar antes/despues).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rutas unicas del motor, catalogos seguros y pipeline con clave `id`; bloquean US1–US6.

**Checkpoint**: Fundacion lista; las historias pueden arrancar.

- [X] T003 Agregar a `inc/class-pmu-uploads.php` los accesos de `contracts/rutas-pmu.md` (v2): `dir_pdf($nombre,$crear=false)`, `ruta_pdf($nombre)` (`uploads/pmu/pdfs/{nombre}/{nombre}.pdf`), `ruta_metadata($nombre)` (`.../metadata.json`), accesos de muestras `dir_tmp_muestras($pdf,$crear=false)` + `ruta_aplicado($pdf,$id,$ext)` (`uploads/pmu/tmp/muestras/{pdf}/{id}.{ext}`) + `ruta_salida_tmp($pdf)` (`.../{nombre}_procesado.pdf`), mas `dir_tmp_cart($linea,$crear=false)`, `manifest_cart($linea)` (`uploads/pmu/tmp/cart/{linea}/manifest.json`), `dir_tmp_order($order_id,$crear=false)`, `dir_order($order_id,$crear=false)` y `ruta_order_pdf($order_id,$pdf)` (`uploads/pmu/orders/{order_id}/{pdf}/{pdf}_procesado.pdf`); sanear `$nombre`/`$linea` con `nombre_seguro` (sin `/`, FR-013 regla 2) y validar ambitos `pdfs`/`tmp`/`orders` (error `motor:<op>:directorio:no_escribible` si no se puede crear).
- [X] T004 Hacer atomica la escritura en `PMU_Uploads::guardar_catalogo()` de `inc/class-pmu-uploads.php`: escribir `{catalogo}.tmp` en la misma carpeta y `rename()` sobre el destino (research D6) — ningun lector ve un catalogo truncado.
- [X] T005 Hacer tolerante la lectura en `PMU_Uploads::catalogo()` de `inc/class-pmu-uploads.php`: archivo de 0 bytes, JSON invalido o estructura ajena devuelven `aviso` no bloqueante con catalogo vacio; solo lanzar cuando la causa sea irrecuperable (directorio no escribible y catalogo inexistente que no se puede sembrar).
- [X] T006 [US3] Renombrar la clave de grupo a `id` (color hex sin `#`) en el pipeline PHP: `engine/Detector.php::agruparPorColor()` emite `id` = hex sin `#` en lugar de `letra` (conservando agrupacion por RGB, orden lexicografico y eleccion del mayor); `engine/Motor.php` usa `id` como clave de `$rutasImagenes` y `validarDataset()` valida `id`/`w`/`h`/`cont`; `engine/Overlay.php` renombra el uso de `$g['letra']` a `$g['id']` en `imgObj`/`activas`/`spliceOps` (sin cambiar el algoritmo de inyeccion).
- [X] T007 [US2] Reescribir `engine/Metadata.php::generar()` al esquema plano de `data-model.md`: entrada de grupo con `id` (`^[0-9A-F]{6}$`), `w`/`h` en px (base 200 ppp), `cont` (instancias, >= 1), `pgs` (indices validos, informativo) y campos opcionales `default` (`null | "texto" | "img" | slug de modulo` — strings, nunca enteros), `value` (string saneado), `preset` (slug), `config` (string opaco); agregar `activo` (bool, default true) en la raiz; `cargar()` debe seguir lanzando si el archivo es ilegible (lo captura `dataset_de`).

---

## Phase 3: User Story 1 - La pestana "PDFs" nunca falla (Priority: P1) 🎯 MVP

**Goal**: La consola renderiza siempre (HTTP 200) y muestra la causa de cualquier fallo de recursos del motor.

**Independent Test**: Con `uploads/pmu/tm-presets/presets.json` de 0 bytes abrir la pestana PDFs: responde 200, se ve el aviso con la causa y el resto de la consola funciona (US1 del spec, quickstart §6).

### Tests for User Story 1

- [X] T008 [US1] Agregar fase `admin` a `tests/texto_puente.php`: preparar entorno aislado, corromper `presets.json` (0 bytes y JSON invalido), renderizar `admin/pdfs.php` con output buffer y verificar (a) no hay fatal/excepcion, (b) la salida contiene un aviso con `motor:listar:` y (c) el selector de estilos esta vacio.

### Implementation for User Story 1

- [X] T009 [US1] Envolver `presets_base()` en `admin/pdfs.php` con `try/catch (\Throwable)` y mostrar un `notice notice-warning` con la causa devuelta por el motor cuando falle (patron de `admin/estilos-texto.php:34-42`; research D6).
- [X] T010 [US1] Agregar red de seguridad en `Personalizador_PDF_Plugin::render_page()` (`personalizador-pdf.php`): `try/catch (\Throwable)` alrededor del `include` de `admin/page.php` que mostrara un aviso de WordPress con el mensaje real del fallo en lugar de una pagina de error critico (FR-003).
- [X] T011 [US1] Proteger `enqueue_assets()` (`personalizador-pdf.php`): `try/catch` en la llamada a `$this->pmu_uploads()->url_ambito('img')` con fallback (URL base vacia) para que un fallo del motor no tumbe el `admin_enqueue_scripts` (research D6).

**Checkpoint**: `php tests/texto_puente.php admin` en verde; la consola nunca mas da 500 por recursos del motor.

---

## Phase 4: User Story 2 - Los datos del PDF viven en una sola carpeta (Priority: P1)

**Goal**: Subir un PDF crea `uploads/pmu/pdfs/{nombre}/{nombre}.pdf` + `metadata.json` y nada mas.

**Independent Test**: Subir `circulo6cm.pdf`: `find uploads/pmu/pdfs/circulo6cm` muestra exactamente 2 archivos y no existe `uploads/personalizador-pdf/` (US2, quickstart §2).

### Implementation for User Story 2

- [X] T012 [US2] Reemplazar `base()`/`subdir()` en `personalizador-pdf.php` por los accesos del motor (T003): `ruta_pdf($archivo)` -> `pmu_uploads()->ruta_pdf($this->nombre_de($archivo))`; `ruta_dataset($nombre)` -> `pmu_uploads()->ruta_metadata($nombre)`; eliminar el uso de `uploads/personalizador-pdf` y el bloque de migracion desde `extractor-corel` de `base()` (se preserva en US6).
- [X] T013 [US2] Reescribir `pdfs_subidos()` en `personalizador-pdf.php` para listar carpetas `uploads/pmu/pdfs/*/{nombre}.pdf` y omitir los `.pdf` sueltos (fixture `muestra.pdf` ignorado; research D9).
- [X] T014 [US2] Actualizar `analizar_y_guardar()` en `personalizador-pdf.php`: escribir el PDF en `pdfs/{nombre}/{nombre}.pdf`, guardar el dataset con `Metadata::guardar` (T007) en `ruta_metadata`, y eliminar el bucle de generacion de PNG de placeholders (`PngWriter::write`) — 0 archivos de placeholder (FR-004, FR-009).
- [X] T015 [US2] Ajustar `handle_subir_pdf`/`handle_reanalizar`/`handle_procesar` (`personalizador-pdf.php`) a las nuevas rutas (`ruta_pdf`/`ruta_metadata`/`ruta_salida_tmp`) y asegurar que el redirect post-subida siga informando `grupos`/`instancias` (resumen del analisis).

### Tests for User Story 2

- [X] T016 [US2] Verificar en `tests/texto_puente.php` (fase `setup`): tras `preparar_entorno()` al layout nuevo (T020 infra) el arbol `pdfs/muestra/` contiene solo `muestra.pdf` + `metadata.json`, y `uploads/personalizador-pdf/` no existe en el entorno aislado (SC-002).

---

## Phase 5: User Story 3 - El contenido de cada grupo se define en `metadata.json` (Priority: P2)

**Goal**: La personalizacion por grupo (campos planos `default`/`value`/`preset`/`config`) vive en `metadata.json`; `textos.json` desaparece y "Re-analizar" la preserva.

**Independent Test**: Guardar personalizacion en `0000FF` → `grupos[?id=0000FF]` refleja `default/value/preset`; no existe nigun `textos.json`; re-analizar la mantiene (US3, quickstart §3).

### Implementation for User Story 3

- [X] T017 [US3] Reescribir `handle_guardar_texto()` en `personalizador-pdf.php` (y su modo AJAX) para persistir la personalizacion en `metadata.json` con campos planos: `default="texto"`, `value` (de `texto`), `preset`; validar con V-5 (value saneada y <= 300 caracteres, preset existente si se envia, id `^[0-9A-F]{6}$` presente en el dataset); escritura atomica (`.tmp` + `rename`).
- [X] T018 [US3] Eliminar `textos.json`: quitar `ruta_textos()`, `textos_de()`, `guardar_textos()` y sus llamadas de `personalizador-pdf.php` y de `admin/pdfs.php` (SC-004, FR-007).
- [X] T019 [US3] Preservar la personalizacion al re-analizar en `personalizador-pdf.php`: en `analizar_y_guardar()`/`handle_reanalizar()` fusionar `default`/`value`/`preset`/`config` por `id` desde el dataset anterior (research D8) e informar en el resumen los grupos cuyos `id` desaparecieron.
- [X] T020 [US3] Actualizar el arnes `tests/texto_puente.php` al layout nuevo: `preparar_entorno()` crea `uploads/pmu/pdfs/muestra/muestra.pdf` + `metadata.json` (esquema T007) y las verificaciones de shutdown usan ese arbol (reemplaza las rutas `uploads/personalizador-pdf/...` existentes).
- [X] T021 [US3] Ajustar la consola y el JS al esquema plano: `admin/pdfs.php` lee `default`/`value`/`preset`/`config` del grupo y el formulario envia `id`/`texto`/`preset`; `assets/admin.js` (autoguardado, vista previa y RenderCore) usa `id` hex y `{id, text, preset, width, height}`.

### Tests for User Story 3

- [X] T022 [US3] Agregar fase `contenido` a `tests/texto_puente.php`: guardar personalizacion del grupo `0000FF` y verificar que `metadata.json.grupos[?id=0000FF]` contiene `default="texto"`, `value` y `preset`, y que no existe nigun `textos.json` (SC-004).

---

## Phase 6: User Story 4 - Placeholders sin archivos (Priority: P2)

**Goal**: El hueco del grupo se ve como marco `div` del tamano real y la descarga se genera al vuelo sin escribir nada en disco.

**Independent Test**: Tras analizar un PDF no hay PNGs de placeholder en `pdfs/{nombre}/`; "Descargar placeholder" entrega un PNG valido del tamano `w`x`h` y no crea archivos (US4, quickstart §4).

### Implementation for User Story 4

- [X] T023 [US4] Reemplazar en `admin/pdfs.php` el `<img>` de preview del placeholder por un marco `div` con tamano `w` x `h` (px) y patron tipo tablero (sin peticion de archivo), conservando solo el enlace "Descargar placeholder".
- [X] T024 [US4] Implementar la descarga al vuelo en `Personalizador_PDF_Plugin::handle_descargar()` (`personalizador-pdf.php`, tipo=placeholder): validar `id` (`^[0-9A-F]{6}$` y presente en el dataset), resolver `w`/`h` del grupo y servir `PngWriter::bytes($w, $h)` como adjunto sin escribir archivo (FR-009/FR-010, research D3).
- [X] T025 [US4] Eliminar `dir_placeholders()` y el preview `handle_ver('placeholder')` de `personalizador-pdf.php` y `admin/pdfs.php`; retirar referencias a `placeholders/` en `limpiar_datos_de()` (SC-003, FR-009).
- [X] T026 [US4] Agregar fase `placeholder` a `tests/texto_puente.php`: pedir placeholder de un `id` del dataset → bytes PNG validos y 0 archivos nuevos en el entorno aislado; con `id` inexistente → rechazo.

---

## Phase 7: User Story 5 - Muestras del panel y ciclo carrito → pedido (Priority: P3)

**Goal**: Muestras idempotentes en `tmp/muestras/{pdf}/`; borradores por linea en `tmp/cart/`; staging en `tmp/orders/{order_id}/`; entregable por linea en `orders/{order_id}/{pdf}/`.

**Independent Test**: (a) dos Procesar seguidos dejan los mismos archivos en `tmp/muestras/{pdf}/`; (b) dos personalizaciones del mismo PDF dan dos `tmp/cart/{linea}/`; (c) eliminar una linea borra solo la suya; (d) promover un pedido simulado mueve `tmp/orders/{order_id}/` a `orders/{order_id}/{pdf}/` (US5, quickstart §5).

### Implementation for User Story 5

- [X] T027 [US5] Redirigir las muestras a `tmp/muestras/{pdf}/` (sobrescribir): `guardar_imagen()`, `quitar_imagen()`, `imagenes_de()` y `miniatura_grupo_textmuy_unlink()` en `personalizador-pdf.php` usan `dir_tmp_muestras` + `ruta_aplicado` con clave `id` del grupo (V-2 un archivo por grupo; V-3 rutas via motor; research D4).
- [X] T028 [US5] La salida de muestra del panel va a `tmp/muestras/{pdf}/{nombre}_procesado.pdf` en `personalizador-pdf.php`: en `handle_procesar()` escribir con `ruta_salida_tmp()` y en `handle_descargar('salida')`/`handle_ver('imagen')` leer desde `tmp/muestras` por `id` (FR-011).
- [X] T029 [US5] Actualizar `limpiar_datos_de()` en `personalizador-pdf.php`: borrar `pdfs/{nombre}/` + `tmp/muestras/{nombre}/`, nunca `orders/`, ni lineas (`tmp/cart/`) ni archivos de otro PDF; limpiar `tmp/muestras/` huerfano solo si no hay PDF correspondiente (V-6, D10, FR-014).
- [X] T031b [US5] Rutas de trabajo del comprador en `inc/class-pmu-uploads.php`: `dir_tmp_cart($linea)` + `manifest_cart($linea)` (`{pdf}/` con aplicados + `manifest.json` con `pdf`, personalizacion canonica, `pmu_hash`, cantidad, `creado`, motor), `dir_tmp_order($order_id)` (`{pdf}/` por linea), `dir_order($order_id)` y `ruta_order_pdf($order_id,$pdf)` (`orders/{order_id}/{pdf}/{pdf}_procesado.pdf`) — alta con rename atomico en la promocion (FR-018..FR-020, contrato `rutas-pmu.md` v2). El cableado a hooks Woo (add/remove carrito, pedido creado/pagado, limpieza TTL) queda pendiente de spec 004.

### Tests for User Story 5

- [X] T030 [US5] En `tests/texto_puente.php` (fase `procesar` sobrescribiendo + nueva fase de borrado): verificar que la salida queda en `tmp/muestras/{pdf}/{nombre}_procesado.pdf` y los aplicados en `tmp/muestras/{pdf}/{id}.{ext}`, que un segundo Procesar no duplica archivos, y que tras borrar no quedan residuos de `pdfs/{pdf}/` ni `tmp/muestras/{pdf}/` sin tocar `tmp/cart/` (SC-005, FR-019).

---

## Phase 8: User Story 6 - Migracion unica de datos heredados (Priority: P3)

**Goal**: Los datos de `uploads/personalizador-pdf/` (o `extractor-corel/`) se migran una sola vez al layout nuevo, convirtiendo `textos.json` en la personalizacion del grupo; la raiz heredada queda intacta como respaldo.

**Independent Test**: Con datos en la raiz heredada abrir la consola una vez: aparecen en `pdfs/{nombre}/` con su `metadata.json` y personalizacion; la bandera `uploads/pmu/.migrado-007` evita repetir (US6, quickstart §7).

### Implementation for User Story 6

- [X] T031 [US6] Implementar `migrar_datos_heredados()` en `personalizador-pdf.php`: mover `uploads/personalizador-pdf/pdfs/{archivo}.pdf` -> `pdfs/{nombre}/{nombre}.pdf`, `datos/{nombre}/metadata.json` -> `pdfs/{nombre}/metadata.json` (reescribiendo al esquema T007), y mapear el antiguo `textos.json` (clave `letra` de la version previa) a `default="texto"`/`value`/`preset` de la personalizacion; no sobreescribir destinos existentes (informar conflicto); bandera `uploads/pmu/.migrado-007` (research D7, FR-015).
- [X] T032 [US6] Disparar la migracion una sola vez al abrir la consola de `admin/pdfs.php` (o un metodo invocado en el render de `personalizador-pdf.php`), guardada por la bandera, y mostrar el resultado/conflictos en el aviso de la consola.
- [X] T033 [US6] Test: fase `migracion` en `tests/texto_puente.php` (o checklist manual de quickstart §7): con un fixture heredado en el entorno aislado, verificar copia + bandera + no re-ejecucion + destino existente no pisado.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentacion con un solo valor, oraculo de paridad alineado, versionado y verificacion completa.

- [X] T034 [P] Actualizar `AGENTS.md` (secciones §3, §5, §7) al layout vigente: `pdfs/{nombre}/{nombre}.pdf` + `metadata.json` (esquema plano con `id` = color hex), sin `textos.json`, placeholders al vuelo, muestras en `tmp/muestras/{pdf}/` (sobrescritura), lineas en `tmp/cart/{linea}/`, staging en `tmp/orders/{order_id}/` y pedidos por linea en `orders/{order_id}/{pdf}/` (FR-016, SC-004).
- [X] T035 [P] Actualizar `readme.txt` (Datos guardados, instalacion F3, changelog 4.0.1) y el parrafo de almacenamiento de `admin/ayuda.php` (deja de decir `uploads/personalizador-pdf/`) (FR-016).
- [X] T036 [P] Alinear el oraculo de paridad al esquema nuevo: actualizar `tests/expected_muestra.json` y `tests/parity.php` para la clave `id` (hex sin `#`) y los campos `w`/`h`/`cont`/`pgs` en lugar de `letra`/`ancho_*`/`num_instancias`/`paginas` (tras T006/T007).
- [X] T037 [P] Subir `PERSONALIZADOR_PDF_VERSION` de `4.0.0` a `4.0.1` en `personalizador-pdf.php` (cache-bust de `assets/admin.js` / `admin.css` al desplegar).
- [X] T038 Verificacion completa (SC-006): `php -l` (plugin/admin/engine/inc), `php tests/motor_smoke.php` (SMOKE OK), `php tests/parity.php` (PARIDAD OK) y `php tests/texto_puente.php` con todas las fases (setup, guardar_ajax, guardar_vacio, procesar, rechazo, nonce, nonce cap, contenido, placeholder, admin, migracion).
- [ ] T039 [P] Correr `quickstart.md` completo (secciones 2-9) en el panel real, verificar cero `textos.json` y cero `uploads/personalizador-pdf/` (SC-004), y limpiar los datos de prueba de `uploads/pmu/tmp/muestras/` (quickstart §10).
- [ ] T040 [P] Actualizar el escenario US5 de `specs/007-pmu-pdf-layout/quickstart.md` (§5 y §9/SC-005): usar `uploads/pmu/tmp/muestras/circulo6cm/` en el paso de consola, `tmp/cart/` por linea en los pasos de comprador con dos personalizaciones del mismo PDF y `tmp/orders/` → `orders/{order_id}/{pdf}/` en el paso de pago simulado (FR-011/FR-012/FR-018/FR-020).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; base verde y linea de inventario.
- **Foundational (Phase 2)**: bloquea TODAS las historias (rutas del motor, catalogos seguros, pipeline `id`, esquema de `metadata.json`, arnes de tests). T006/T007 habilitan US2/US3; T004/T005 habilitan US1; T003 habilita US2/US5/US6.
- **US1 (Phase 3)**: solo Foundational (T004/T005); T009 (guard) precede al test T008.
- **US2 (Phase 4)**: Foundational (T003, T007); T012 (rutas) precede a T014 (analizar) y a T016 (verificacion); T020 (arnes) se usa en T016.
- **US3 (Phase 5)**: Foundational (T006, T007); T020 (preparar_entorno) alimenta las fases de test de US1/US2/US3/US5.
- **US4 (Phase 6)**: Foundational (T007 por `w`/`h` del dataset); independiente de US3.
- **US5 (Phase 7)**: US2 (rutas y subida) + Foundational (T003, T006).
- **US6 (Phase 8)**: US2 (rutas nuevas) + US3 (esquema de metadata y mapeo de `textos.json`).
- **Polish (Phase 9)**: despues de US2..US6 y de T006/T007 (oraculo). MSC = update de docs + bump.

### User Story Dependencies

- **US1 (P1)**: puede arrancar apenas termina Foundational — no depende de otras historias (MVP).
- **US2 (P1)**: puede arrancar en paralelo con US1 (depende solo de Foundational).
- **US3 (P2)**: depende del pipeline `id` (T006) y del esquema T007; se apoya en US2 para leer/escribir el dataset en la ruta nueva.
- **US4 (P2)**: independiente de US3 (usa `w`/`h` del dataset ya generado por US2); puede correr junto a US3.
- **US5 (P3)**: depende de US2 (`tmp/` + rutas).
- **US6 (P3)**: depende de US2 + US3.

### Within Each User Story

- En historias con tests (US1, US2, US3, US4, US5, US6) las tareas de test se escriben/ejecutan al cierre de la historia (harness `tests/texto_puente.php`).
- Implementacion antes que integracion; el checkpoint de cada historia es su "Independent Test" y la fase de test correspondiente.

## Parallel Example: User Story 1 y 2 (P1)

```bash
# Equipo A — US1 (consola sin 500):
#   - T009 guard presets_base en admin/pdfs.php
#   - T010 red de seguridad en render_page()         [P] con T009 (personalizador-pdf.php)
#   - T011 guard en enqueue_assets()                 [P] con T009/T010 (personalizador-pdf.php)
#   luego T008 fase 'admin' en tests/texto_puente.php

# Equipo B — US2 (layout pdfs/{nombre}/):
#   - T012 reemplazo base()/subdir() (personalizador-pdf.php)   (bloquea T014)
#   - T013 pdfs_subidos() carpetas (personalizador-pdf.php)      [P]
#   - T014 analizar_y_guardar sin PNGs (personalizador-pdf.php)  (tras T012)
#   luego T016 verificacion fase 'setup' (texto_puente.php)

# Ambos equipos arrancan luego de Foundational (T003-T007).
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (base verde + inventario).
2. Completar Phase 2 (Foundational: rutas, atomicidad de catalogos, pipeline `id`, esquema, arnes).
3. Completar Phase 3: User Story 1 (T008-T011) — la consola deja de dar 500.
4. STOP y VALIDAR: `php tests/texto_puente.php admin` + apertura manual de la consola con `presets.json` corrupto.
5. Deploy/demo si se quiere desbloquear ya el panel en produccion.

### Incremental Delivery

1. Setup + Foundational -> fundacion lista (green).
2. US1 -> probar independiente -> deploy (MVP: panel estable).
3. US2 -> probar independiente (layout nuevo) -> deploy.
4. US3 -> personalizacion en metadata (sin textos.json).
5. US4 -> placeholders al vuelo.
6. US5 -> `tmp/muestras/` (panel), `tmp/cart/` (lineas), `tmp/orders/` -> `orders/{order_id}/{pdf}/` (promocion por rename).
7. US6 -> migracion unica de la raiz heredada.
8. Polish -> docs, oraculo, bump 4.0.1, quickstart completo.

### Parallel Team Strategy

- Terminal 1: equipo A -> US1, equipo B -> US2 (P1, paralelo tras Foundational).
- Luego US3 y US4 (P2) en paralelo; US5 y US6 (P3) en paralelo; Polish al cierre.
- Cada historia conserva su "Independent Test" y su fase de test en `tests/texto_puente.php`.

## Notes

- [P] en una tarea = archivos distintos, sin dependencias pendientes (se puede paralelizar).
- [USx] mapea la tarea a su user story (trazabilidad a spec.md).
- Los tests de cada historia se agregan como fases al arnes existente `tests/texto_puente.php` (research D11); no se crea un arnes duplicado.
- El oraculo `expected_muestra.json` cambia cuando se toca `Detector` (T006) y se actualiza en T036.
- Verificar que las fases de test fallen antes de implementar (cuando aplican).
- Commit tras cada tarea o grupo logico; detenerse en cada checkpoint para validar la historia de forma independiente.
- Evitar tareas vagas y tocar el mismo archivo en paralelo: los [P] respetan archivos distintos (p. ej. T009 en `admin/pdfs.php` y T010/T011 en `personalizador-pdf.php`).