# Tasks: campos-consola

**Feature**: 012-campos-consola | **Fecha**: 2026-10-04

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/campos.md`,
`contracts/campos-consola.md`, `research.md`

**Tests**: fases nuevas de `tests/texto_puente.php` (`campos_v2`, `campo_dup`, `campo_restore`,
`campo_import`, `campo_global`, `campo_subida`, `motor_multi`) + puerta nueva
`tests/campos-contrato.test.js` + las puertas existentes (`php -l`, `motor_smoke`, `parity`,
`node --check` + las 2 puertas de mockups).

**Marcas**: `[X]` = implementada y verificada. `[~]` = implementada a medias (debe decir que falta).
**No marcar como hecha una tarea por aproximacion**: si falta un requisito, `[~]`.

## Fase 0 - Fundacional (motor de datos) [bloquea todo]

- [X] T001 [P] Migracion v1 -> v2 one-shot en `PMU_Uploads::migrar_campos_v2()`: backup `campos.json.bak` antes de escribir; escribe `campos/{id}/datos.json` + `campo.htm|css|js` por campo activo; tombstones `[id,"",""]` -> `items[id].baja=true` (sin carpeta; el id queda ocupado para siempre); indice v2 con `version:2` + `meta.{id}.{creado,modificado,categorias}` + `v1_migrado`. **Todo-o-nada**: cualquier fallo restaura el `.bak` (las carpetas que queden son inertes: el indice manda); causa `migracion:fallo:<motivo>`. Idempotente (`version>=2` no hace nada). El mapeo v1->v2 quedo documentado en el docblock (el admin debe revisarlo tras migrar). **Probada con 49 checks en `%TEMP%` sobre un v1 sembrado** (`tests/campos_migracion.php`). NO ejecutada sobre datos reales: requiere aprobacion explicita del usuario.
- [X] T002 [P] `PMU_Uploads`: rutas del formato nuevo. `dir_campos()` pasa a ser `uploads/pmu/campos/` (el indice `ruta_campos()` sigue en la RAIZ); nuevas `campo_id_seguro()`, `dir_campo($id,$crear)`, `ruta_campo($id,$archivo)` (basename, sin subrutas), `ruta_campo_global()` (allowlist `global.css|global.js`), `ruta_global_css|js()`, mas `leer_campo()`/`escribir_campo()` y `escribir_texto()` (atomica .tmp + rename). Verificado con `tests/campos_migracion.php`.
- [X] T003 [P] `PMU_Uploads`: CRUD v2 completo (aterrizó junto con T005). Indices (`indice_campos()`, `guardar_indice_campos()`, `fila_indice()`, `tocar_meta()` con `?array $categorias`), `normalizar_datos_campo()`, `plantilla_valida()`, `categorias_de()`. `campo_alta($plantilla,$datos,$htm,$css,$js)` (hueco mas bajo; **el id dado de baja NO se libera**), `campo_editar($id,…)` (no toca `baja`), `campo_baja($id)` (**conserva los archivos**), `campo_restaurar`, `campo_duplicar`, `campo_plantilla`, `campo_listar($incluir_bajas)`. **Puente v1**: `campo_alta()`/`campo_editar()` aceptan la tupla de 10 slots y la traducen, para que las 16 siembras legacy del arnes sigan funcionando; se retira en F1/F2. Cubierto por `tests/campos_migracion.php` (80 checks) + fase `campos` del arnes + smoke E2E del lab.
- [X] T004 [P] Validacion del contenido del campo en el motor: `escribir_campo()` valida HTML prohibido (`<script>`/`id=""`), invoca `validar_script_campo()` (el sandbox del servidor manda siempre), tamanos 20 000 por archivo y normaliza `cargador` via `validar_cargador()` (acepta la estructura y los **3 atajos de texto** del admin: `canvas:circle size:1000`, `size:2000 max:6`, `1_size:1000 1_canvas:circle 2_size:1024x768 2_min:2 2_max:2`). Cubierto por `tests/campos_migracion.php`.
- [X] T004b [P] **Banco de pruebas de la migracion** en `tests/campos_migracion.php` (motor PHP, corre
  en `%TEMP%`, **NUNCA** toca `uploads/pmu/`): siembra un catalogo v1 con 2 campos vivos + 1 tombstone y
  verifica indice v2, archivos por campo, `.bak`, idempotencia, rutas (indice en la raiz / codigo en
  `campos/`), los 3 atajos de cargador del admin y los rechazos (script/iframe, `id=""`, JS prohibido,
  > 20 000). Puerta: `php tests/campos_migracion.php` -> `CAMPOS V2 OK`. **49 checks en verde.**
  (Distinto de T012, que es la puerta **Node** del cableado cliente: `tests/campos-contrato.test.js`.)
- [X] T005 `Personalizador_PDF_Plugin` (aterrizó con T003). `campo_desde_post()` devuelve el paquete v2
  `['datos'=>[], 'htm', 'css', 'js']` (acepta `contenido`/`script` legacy y `html`/`js` nuevos);
  `campos_activos()` lee v2 via `campo_listar()` y devuelve el **adaptador transitorio** de 10
  slots para `campos_panel()`/`admin/campos.php` (slot 2 = plantilla), avisando
  `motor:campos:migrar:pendiente` si el indice sigue en v1; `handle_campo_guardar()` llama al CRUD v2;
  `cargar_campos($incluir_bajas)` agrega `usado_en` / `usado_pdf_n` / `usado_refs` leyendo de verdad
  cada `config.json:campos_ids` + el conteo de `[campoN]`. Los cuerpos v1 quedaron en metodos
  marcados `@deprecated` (`_pmu_campo_desde_post_v1`, `_pmu_campos_activos_v1`) que **se borran en F1**.
  Verificado: fase `campos` del arnes migrada a v2, 16 siembras legacy resueltas por el puente del
  motor, y smoke E2E del lab con 5 campos reales en v2 (0 errores JS, 0 avisos PHP).

## Fase 1 - US1 Editor en linea

- [X] T006 [US1] `admin/campos.php` REESCRITO (115 -> 98 lineas): el `<a href="?ec_campo_editar=">` y el card de edicion separado desaparecen; cada fila trae su `<tr class="ec-campo-form-fila" hidden>` con el editor. Tabla v2 (nombre / titulo comprador / categorias / plantilla / uso en N PDFs). **El markup de la fila vive en un solo sitio**, `Personalizador_PDF_Plugin::fila_campo_html()` + `form_campo_html()`, que usa la pagina y la respuesta JSON del alta (sin plantilla duplicada en JS). Nuevo panel "Dados de baja" con `Restaurar`. GET `ec_campo_editar` eliminado.
- [X] T007 [US1] `assets/admin.js`: `pintarFila()` repinta con lo que devuelve el SERVIDOR (`campo` de la respuesta), `alternarEditor()` abre/cierra el editor sin navegar, `ec-cancelar` cierra sin escribir, `enlazarFormularios()` reutilizable para filas nuevas, alta sin recargar (inserta el HTML del servidor), baja quita fila + formulario, restauracion con recarga. Reutiliza `pmuForm`/`paresDe`.
- [X] T008 [US1] El alta y el editor ya usan el formato v2 (**sin `tipo`**, con `plantilla`); el modal de alta rapida de la pestana PDF (`admin/pdfs.php`) queda para su propia fase (ver nota).
- [ ] T008b [US1] `admin/pdfs.php`: el modal `ec-modal-campo` ("Nuevo campo" rapido dentro del PDF) todavia manda `tipo` y `titulo_cliente`; hay que pasarlo a `nombre` + `plantilla` + `titulo_cliente` y refrescar sus selects. **Pendiente: es el unico consumidor de la UI v1 que quedo.**

## Fase 2 - US2 Probar el campo

- [ ] T009 [US2][P] `assets/campo-montar.js` (nuevo): `PMUCampo.montar(raiz, campos, inicial)` con las
  reglas de salida de `cliente` (`campo.js` > `data-rol` > **vacio**, sin traduccion automatica,
  D21). Expone `PMUCampo` en `window`. No ejecuta nada de la ficha (la ficha lo consumira en T010).
- [ ] T010 [US2] `assets/tienda.js`: sustituir el montaje de `montarCampos()` por `PMUCampo.montar()`
  **sin tocar el bloque `PURO`** (testeable en Node). Se elimina `<p class="pmu-campo-titulo">`.
  Puerta: `node --check` + verificar que `PURO` sigue exportando.
- [ ] T011 [US2] `admin/campos.php` + `admin.js`: panel de prueba en `<iframe srcdoc>` de 350px con
  el HTML del campo, su CSS, el `global.css` prefijado con `[data-pmu-panel]`, `<link>` a los estilos
  ya encolados en la pagina, y `campo.js` con un `PMU_CAMPO` simulado. Muestra `{valor, cliente}` en
  vivo; un `script` que lanza excepcion se ve como error sin romper la consola (FR-004, FR-005,
  FR-006, FR-007, FR-008). Para un campo con cargador, "Probar" dibuja las ranuras y **no sube
  nada** (FR-009).
- [ ] T012 [US2] `tests/campos-contrato.test.js` (nuevo): verifica que `campo-montar.js` monta con
  las 4 reglas, que `tienda.js` lo consume, que existe el iframe con `srcdoc` y ancho 350, y que
  ningun modulo cliente tiene un `$('<tag` sin `>` (atrapa el bug de la seccion 11 de AGENTS).

## Fase 3 - US3 Buscar / filtrar / ordenar

- [ ] T013 [US3] `assets/admin.js`: buscador de texto (nombre, descripcion, titulo cliente,
  categorias), chips de categoria, selector de orden (`mas recientes` / `por modificacion` / `por
  id`). El orden de la tabla NO altera el panel del comprador (FR-010…FR-012, FR-014).
- [ ] T014 [US3] Columna "usado en N PDF(s)" con el detalle de quais PDFs y cuantos `[campoN]`
  (dato de `cargar_campos()`, F0); FR-013. Puerta: `php -l` + `campos-contrato.test.js`.

## Fase 4 - US4 Plantillas, duplicar, restaurar, importar/exportar

- [ ] T015 [US4][P] `assets/campo-montar.js` (o el PHP que genera el formulario): las 3 plantillas
  base (`texto`, `select`, `imagen`) con su HTML/CSS/JS inicial (D5, FR-015). El admin siempre puede
  editar despues el HTML del campo creado (FR-016). `imagen` incluye el boton del cargador y su
  `cargador` por defecto.
- [ ] T016 [US4] Handlers `personalizador_pdf_campo_plantilla` (marcar/desmarcar), `_duplicar`,
  `_restaurar` (con las causas de `data-model.md` §9). `cargar_campos()` expone cuales son
  plantilla. UI: columna de plantilla, "Usar como plantilla" y "Duplicar" en la fila (FR-017…FR-020).
- [ ] T017 [US4] Handlers `_exportar` (descarga el `campos.json` autocontenido con `htm/css/js`) y
  `_importar` (**todo-o-nada**: valida sandbox, HTML, tamanos y que ningun id este en uso antes de
  escribir una sola vez; causa `motor:campos:importar:id:ocupado`). UI: boton exportar + selector de
  archivo con confirmacion (FR-021, FR-022). Test: fases `campo_dup`, `campo_restore`, `campo_import`.

## Fase 5 - US5 CSS/JS global

- [ ] T018 [US5][P] `PMU_Uploads` + handler `_global`: leer/escribir `uploads/pmu/campos/global.css` y
  `global.js` (crea vacios si no existen; causa `motor:campos:global:no_escribible`).
- [ ] T019 [US5] `assets_ficha()`: si el panel tiene >=1 campo, inyecta `<style>` con el `global.css`
  prefijado `[data-pmu-panel]` y encola el `global.js` **antes** de `campo-montar` (garantizado por
  D21: el global es codigo libre del admin y solo se promete el orden, no una API). **Sin**
  `traducir()` ni `tablas`: el sistema no traduce nada. Si no hay campos, no carga nada (FR-023…FR-027).
- [ ] T020 [US5] `admin/campos.php`: tarjeta "Estilos globales / Script global" arriba, con guardado
  por `pmuPost`. Test: fase `campo_global`. Puerta: `campos-contrato.test.js`.

## Fase 6 - US6 Cargador de imagenes

- [ ] T021 [US6][P] `inc/class-pmu-sesion.php` + `PMU_Uploads`: `dir_subidas()` y `guardar_subida()`
  -> `tmp/sesion-{sid}/{item_key}/subidas/{id}.webp` con fila en `manifest.subidas[]` (id = uuid
  corto del servidor, nunca del cliente). **Formato WebP** (D14: allowlist vigente en
  `personalizador-pdf.php:321`; el Motor lo decodifica por GD). Causas de `data-model.md` §9. La
  carpeta viaja con el item al promotion del pedido, sin trabajo extra (FR-035).
- [ ] T022 [US6] `personalizador-pdf.php`: endpoint `personalizador_pdf_subida` (nonce + capability,
  allowlist de formatos, **techo alto por archivo** `motor:subida:tamano` — defensa, no limite de
  producto, D15) que sube una imagen al item del comprador. **Guardar con `congelar_webp()` si ya
  existe** (misma validacion RIFF/WEBP del flujo de carrito, `personalizador-pdf.php:1874-1878`).
- [ ] T022b [US6] `smoke_checks()`: agregar el check **"GD + WebP disponible"** (hoy solo verifica que
  GD este presente, `personalizador-pdf.php:1646`), para que si un dia se muda a un hosting sin GD
  el admin lo vea en la pestana Test **antes** de que falle un pedido (D14).
- [ ] T023 [US6][P] `assets/cargador-pmu.js` (nuevo): `CargadorPMU` con N **ranuras** (`w`,`h`,
  `forma`,`min`,`max`); usa `SelectorPMU` por dentro (una instancia por ranura). Acepta el archivo
  **arrastrandolo** o con clic; al confirmar el recorte sube el blob al item (FR-028…FR-032).
- [ ] T023b [US6] `assets/cargador-pmu.js`: **`min` es la validacion real** (D16) — "Aceptar" queda
  `disabled` hasta que la ranura tenga `min` imagenes (el boton ya nace disabled en
  `selector-pmu.js:97` y se habilita con el recorte, `:232`; solo falta exigir `min`). Sin isso el
  comprador puede dejar el item incompleto.
- [ ] T024 [US6] `assets/tienda.js`: el campo con `cargador` monta sus botones; publica
  `valor = [ids]` (`array:true` si alguna ranura tiene `max > 1`). El componente NO manda nada al
  Motor, solo al item (FR-033, FR-034). Test: fase `campo_subida` (servidor) + `campos-contrato.js`.

## Fase 7 - US7 Campo de imagenes en el placeholder (nucleo; sola)

- [ ] T025 [US7][P] `engine/Motor.php`: `$rutasImagenes[$id]` acepta `string` (hoy) **o** lista
  (una por instancia). Mantiene el comportamiento actual para `string` (consola "Procesar", pedidos,
  `motor_smoke`, `parity` sin cambios) (FR-039, D12).
- [ ] T026 [US7][P] `engine/Overlay.php`: una imagen por instancia del grupo; el "encajar"
  (`contain`) se aplica a cada una. Con `string` se replica como hoy.
  **Puerta**: `php tests/parity.php` (PARIDAD OK) + `php tests/motor_smoke.php` (SMOKE OK).
- [ ] T027 [US7] `assets/tienda.js`: un placeholder `tipo=imagen` con `value=[campoN]` resuelve los
  ids contra `manifest.subidas[]` validando que existan (FR-036), rasteriza cada id al tamano del
  hueco y lo sube al pool para que vista previa y PDF usen la misma imagen (FR-038), y genera el
  PDF con `id => [rutas]`. Si N != `cont` -> **no se bloquea ni se avisa** (FR-037'/D17/D18/D19):
  cada instancia sin foto se omite del pool y el PDF sale con los huecos transparentes. Test: fase
  `motor_multi` + `campos-contrato.test.js`.
- [ ] T027b [US7][P] **CAMBIO DE COMPORTAMIENTO EN PRODUCCION** (D17/D18, pedido explicito del
  usuario): reescribir `PURO.conciliarGrupo()` (`assets/tienda.js:56-83`) para que (a) con `repetir`
  el `idx` **cicla** modulo el largo del array (4 valores en 8 instancias -> 1,2,3,4,1,2,3,4) y (b)
  **sin** `repetir`, N != M **deje las instancias sobrantes vacias y NUNCA bloquee** (hoy devuelve
  `aviso` + `textos: []` y frena la compra, `:71-79`). Aplica igual a texto e imagenes. **Actualizar
  los asserts de `tests/conciliacion.js`** (cubre `PURO.conciliarGrupo` / `PURO.resolverPlantilla`).
  Puerta: `node tests/conciliacion.js` + el resto de las suites Node.
- [ ] T028 [US7] Campos `protegido`: `campos_panel()` NO los manda al HTML de la ficha (FR-040).
  Campos invisibles (sin HTML visible) siguen publicando via su `campo.js` (FR-041).

## Fase 8 - Documentacion y cierre

- [ ] T029 [P] Actualizar `constitution.md` (Sync Impact Report; bump 2.1.0) y `AGENTS.md` (§2 mapa,
  §3 flujo, §5 datos: `campos/{id}/`, global, `subidas/`; §11 si hay un error comun nuevo).
- [ ] T030 [P] `specs/INDICE.md`: registrar la 012 en "Activos". `admin/ayuda.php`: seccion de
  campos (nombre vs titulo cliente, plantillas, global, cargador).
- [ ] T031 [P] `specs/MANUAL-PENDIENTE-WP-REAL.md`: recorrido manual unico de la 012 (crear desde
  plantilla -> probar -> duplicar -> filtrar -> dar de baja -> restaurar -> exportar -> importar ->
  campo de imagenes end-to-end en la ficha + generacion del PDF con 6 fotos).
- [ ] T032 Verificacion final: TODAS las puertas verdes (`php -l`, SMOKE OK, PARIDAD OK, las fases del
  arnes, `node --check` + las 3 puertas Node) y recorrido manual en el sitio real. Version en la
  cabecera de `personalizador-pdf.php` (segun seccion 10.bis) + `readme.txt`.

## Dependencias

- F0 bloquea todas las fases (el formato v2 es la base).
- F7 (nucleo) depende de F6 (las subidas) y va **al final, sola**.
- F5 (global) puede ir antes de F6; la ficha ya monta campos desde F2.

## Fuera de alcance

Emails, editor con resaltado, boton "Anadir al catalogo `img/`", reordenar el panel del
comprador, tocar `modules/textmuy/`, la API (010).
