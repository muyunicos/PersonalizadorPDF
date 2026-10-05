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
- [X] T008 [US1] El alta y el editor de la pestana Campos usan el formato v2 (**sin `tipo`**, con `plantilla`).
- [X] T008b [US1] `admin/pdfs.php` + `admin.js`: el modal de alta rapida (`ec-modal-campo`) pasa a v2 — `nombre` + `plantilla` (texto|select|imagen) + `titulo_cliente` + `categorias`; fuera el `tipo` y el checkbox `visible`. El handler manda el payload v2 y arma la etiqueta del select con el nombre que devuelve el servidor (`campo.datos.nombre`). **Ultimo consumidor de la UI v1 eliminado.** Verificado en el lab: el boton abre el modal, crea el campo y agrega la opcion al select de `campos_ids[]`.

## Fase 2 - US2 Probar el campo

- [X] T009 [US2][P] `assets/campo-montar.js` (NUEVO): `PMUCampo.montar/montarUno/contextoRaiz/valorDe` con las 4 reglas de salida (campo.js > `data-rol` > primer control > vacio). **NO inyecta titulo** (D20) y **NO traduce** (D21). Exporta `PMUCampo` tambien en Node para testearlo. Sin dependencias.
- [X] T010 [US2] `assets/tienda.js`: `montarCampos()` ahora **delega en `PMUCampo.montar()`** (se borro su copia de `contextoRaiz` y del montaje; sigue exportando `PURO`); avisa por consola si falta el modulo. `assets_ficha()` encola `campo-montar.js` **antes** de `tienda.js`. `campos_panel()` entrega los nombres v2 (`htm`/`js`), acepta la tupla v1 (arnes legacy) y **excluye los campos `protegido`** (FR-040).
- [X] T011 [US2] Boton **"Probar"** por fila: `<iframe srcdoc>` de **350px** (el `max-width` real de `.pmu-panel`) que enlaza las hojas de estilo ya presentes en la pagina, monta el campo con `PMUCampo.montar()` y muestra en vivo el par `valor`/`cliente`. El iframe aisla un CSS runaway (FR-004, FR-005, FR-007, FR-008). Verificado en el lab: monta el HTML, ejecuta el JS y aplica el CSS **sin tocar la pagina**. `admin.css` gana el bloque `.ec-pv*`.
- [X] T012 [US2] `tests/campos-contrato.test.js` (NUEVO): corre el modulo en un `vm` con DOM minimo; verifica las reglas de salida, que `tienda.js` delega en el, que NO se inyecta titulo, que NO se traduce y que acepta los nombres legacy. **CAMPOS CONTRATO OK.**
- [X] T011b [US2] FR-009 cerrado. "Probar" de un campo **con cargador** **dibuja las ranuras sin subir
  nada**: `fila_campo_html()` emite `data-cargador` (el `cargador` vive en `datos.json`, no en el
  formulario), `admin.js` lo lee y monta el **mismo** `CargadorPMU` contra el DOM del iframe con
  `preview: true` (sin boton, sin arrastre, sin endpoint, sin "Listo"), y el componente se encola
  tambien en la consola. Verificado en navegador real: 9 checks con 0 errores JS.

## Fase 3 - US3 Buscar / filtrar / ordenar

- [X] T013 [US3] `assets/admin.js` + `admin/campos.php`: buscador por texto (nombre, descripcion, titulo cliente, categoria y plantilla), **chips de categoria** con contador y boton "quitar filtros", y selector de orden (por id / ultima modificacion / mas recientes / por nombre). Todo **en el DOM**, sin peticiones. Las filas llevan `data-cats`, `data-modificado` y `data-creado` para que el filtro y el orden no tengan que ir al servidor. Contador "N de M campos". El orden **NO altera** el panel del comprador (FR-014: eso lo manda `config.json:campos_ids[]`). CSS en `.ec-c-filtros`.
- [X] T014 [US3] Columna **"Uso"** completada: muestra `N PDFs (M [campoN])` y lleva en el `title` el detalle que devuelve el servidor (`usado_en` = PDFs donde esta elegido, `usado_refs` = cuantos `[campoN]` lo consumen, fecha de modificacion). Los datos salen de `cargar_campos()`, que los lee de cada `config.json` de verdad (T005).

## Fase 4 - US4 Plantillas, duplicar, restaurar, importar/exportar

- [X] T015 [US4][P] `Personalizador_PDF_Plugin::plantilla_campo()`: las 3 plantillas base
  (**texto**, **select**, **imagen**) con HTML/CSS/JS que funciona. `texto`/`select` traen un
  `data-rol="valor"` y un JS-espejo que publica `ctx.set(ctx.id, {valor, cliente})` (gracias a que
  `PMUCampo` ahora expone `ctx.id`); `imagen` trae el boton del cargador con su CSS de miniaturas
  y un JS que avisa si el cargador aun no existe (el cargador real llega en F6). El alta usa la
  plantilla si el POST no trae codigo propio. Plantilla desconocida = campo en blanco. FR-015/FR-016.
- [X] T016 [US4] Handlers `personalizador_pdf_campo_plantilla` (marcar/desmarcar; la fila muestra
  `★ Plantilla` desde el servidor) y `personalizador_pdf_campo_duplicar` (devuelve el HTML de la
  fila nueva, que se inserta con la misma fuente unica del markup). Botones `Plantilla`/`Duplicar`
  por fila (FR-017…FR-020). JS: `window.PMUCampos` publica el nonce y los ayudantes para que los
  bloques externos los alcancen.
- [~] T017 [US4] **FUERA DE ALCANCE (decidido por el usuario, 2026-10-04): exportar/importar el
  catalogo de campos no es necesario.** FR-021/FR-022 quedan sin implementar y el codigo hecho en
  `b146952` se **retiro** por completo (2 `admin_post`, 2 handlers, 2 forms y su JS). Consecuencia:
  `uploads/pmu/campos.json` + `campos/{id}/` sigue siendo la UNICA via de datos, y el backup es una
  copia de `uploads/pmu/`.

## Fase 5 - US5 CSS/JS global

- [X] T018 [US5][P] `PMU_Uploads::leer_global()`/`guardar_global()`: `uploads/pmu/campos/global.css` y
  `global.js` (crea vacios si no existen; causa `motor:campos:global:no_escribible`, tope de 20 000
  caracteres como los campos). El global **no** pasa por el sandbox ni por la firma
  `function(ctx, root)`: es codigo libre del admin (D21), no un `campo.js`.
- [X] T019 [US5] `assets_ficha($n_campos)`: con >=1 campo inyecta el `global.css` como `<style>` con
  cada selector prefijado por `[data-pmu-panel]` (`css_global_prefijo()`, que recursa en
  `@media`/`@supports`/`@layer`/`@container` y deja verbatim `@import`/`@font-face`/`@keyframes`) y
  engancha el `global.js` con `wp_add_inline_script(..., 'before')` sobre `campo-montar`: ese es el
  **unico** orden prometido (D21). Sin `traducir()` ni tabla. `campos_de_la_consulta()` resuelve el
  conteo en `wp_enqueue_scripts`, que corre antes de que el panel se pinte. FR-023…FR-027.
  **Verificado en navegador real** (lab, pagina con el shortcode
  `[pmu_personalizar pdf="circulo6cm"]`): el CSS global aplica DENTRO del panel y **no** fuera
  (`.pmu-panel-titulo` da `rgb(9,8,7)` dentro y otra cosa fuera), y el `global.js` corre antes de
  `campo-montar`. La pagina gemela con un PDF sin campos **no** carga ni el CSS ni el JS global
  (FR-025 negativo). Arnés del lab: `%TEMP%/pmu-e2e/sembrar-shortcode.php` + `smoke-ficha.js`
  (13 checks, sin WooCommerce: el shortcode basta para ejercitar el panel del comprador).
- [X] T020 [US5] `admin/campos.php`: tarjeta "Estilos globales / Script global" **arriba** (FR-024),
  guardada por `pmuPost` con su propia action `personalizador_pdf_campo_global`. Imprime ademas un
  portador `<script type="text/css" id="pmu-campo-global-css">` con el CSS **ya prefijado**: el
  navegador no lo aplica en la consola y "Probar" lo inyecta en el `srcdoc` (FR-006). El preview
  monta en `#pmu-preview[data-pmu-panel]`. Puertas: fase `campo_global` (13 checks) +
  `campos-contrato.test.js` + smoke del lab.

## Fase 6 - US6 Cargador de imagenes

- [X] T021 [US6][P] `PMU_Sesion::dir_subidas()`, `guardar_subida()` y `resolver_subidas()` ->
  `tmp/sesion-{sid}/{item_key}/subidas/{id}.{ext}` con fila en `manifest.subidas[]` (id = uuid corto
  del servidor, **nunca** del cliente). **Desviacion consciente de D14**: el formato sale de la
  **firma de los bytes** (`firma_imagen()`: webp/png/jpg/gif) y no del nombre que manda el cliente.
  Motivo: `SelectorPMU` genera **PNG** (`selector-pmu.js:244`), y si un navegador no codifica WebP
  el `toBlob('image/webp')` cae a PNG en silencio; con rechazo estricto el comprador no podria
  comprar. Nunca se inventa el formato: sale de `RIFF/WEBP`, la firma PNG, `FFD8FF` o `GIF8?a`.
  WebP sigue siendo el esperado y la via natural. FR-035 sale **gratis**: `promover()`,
  `staging_order()` y `promover_order()` mueven el arbol entero del item, no solo `img/`.
- [X] T022 [US6] `personalizador-pdf.php`: endpoint `personalizador_pdf_subida` (nonce
  `personalizador_pdf_vista_previa` + `current_user_can('read')`, allowlist por firma, techo alto de
  20 MB = `PMU_Sesion::TOPE_SUBIDA_BYTES`, causa `motor:subida:tamano`; es defensa, no limite de
  producto, D15). El archivo llega en `$_FILES['imagen']` (nunca en `$_POST`) o como dataURL. **Crea
  el borrador si no hay item** (D7: la subida va antes de la vista previa) y devuelve
  `sid`/`item_key` para que el cliente lo reuse en vez de abrir un segundo.
- [X] T022b [US6] `smoke_checks()`: check **"GD + WebP (cargador de imagenes)"**, que ademas de GD
  exige `imagecreatefromwebp` + `imagewebp`. Antes solo miraba que GD estuviera, asi que un hosting
  sin WebP se enteraba recien al fallar un pedido (D14).
- [X] T023 [US6][P] `assets/cargador-pmu.js` (nuevo): `CargadorPMU` con N **ranuras** (`w`,`h`,
  `forma`,`min`,`max`); un `SelectorPMU` por ranura, usando solo su API publica
  (`open`/`onSelect`/`obtenerBlob`) — el contrato de `selector-pmu.md` **no se toca**. Arrastre de
  archivo por `DataTransfer` sobre la superficie publica del modal (si el navegador no lo tiene, el
  modal sigue abierto y se elige a mano: degrada, no rompe). Se inyecta sus propios estilos, como
  `selector-pmu.js`. Exporta en Node para testear la logica de ranuras.
- [X] T023b [US6] `cargador-pmu.js`: **`min` es la validacion real** (D16) — "Listo" nace
  `disabled` y sigue deshabilitado hasta que **todas** las ranuras tengan `min`; el texto dice
  cuantos faltan. `max` apaga "Agregar" al llegar al tope. Sin esto el comprador deja el item a medias.
- [X] T024 [US6] `assets/tienda.js`: `montarCampos()` llama a `montarCargadores()`; cada campo con
  `cargador` monta su `CargadorPMU` y escribe `valor = [ids]` en el **mismo** estado que lee
  `conciliarGrupo`, con `array:true` si alguna ranura tiene `max > 1`. El cargador **toma el control
  del `valor` recien con la primera foto**: antes no lo pisa (si no, `valor = []` del montage
  borraria lo que publico el `campo.js`). `campos_panel()` ahora viaja el `cargador`, y
  `panel_ficha()` lee las filas **v2** (la tupla v1 no transportaba el `cargador`).
  Puertas: fase `campo_subida` (12 checks) + 16 checks nuevos en `campos-contrato.test.js` +
  12 checks en el lab con subida real de dos fotos (min=2).

## Fase 7 - US7 Campo de imagenes en el placeholder (nucleo; sola)

- [X] T025 [US7][P] `engine/Motor.php`: `$rutasImagenes[$id]` acepta `string` (hoy) **o** lista (una
  por instancia). Con `string` el comportamiento es identico al anterior (FR-039, D12). Tope de `cont`
  por grupo; los archivos que no existen se saltan. El resumen suma `grupos_parciales`
  (id => instancias sin foto), que es un **informe**, nunca un error (D17/D18/D19).
  Ojo: una spec **ya es un array**, asi que la distincion string/lista se lleva con la bandera
  `$multi` de las RUTAS (no sniffeando el resultado): sniffeando se rompia el caso de una sola
  imagen por grupo. Puerta: `motor_multi` (11 checks) + SMOKE OK + PARIDAD OK sin cambios.
- [X] T026 [US7][P] `engine/Overlay.php`: un XObject por ranura (`$imgObjs[id][slot]`) y la instancia
  k toma la ranura k; las sobrantes **se omiten** (el hueco conserva su transparencia). Con una sola
  spec se replica en todas las instancias, como antes. El empaquetado del XObject se extrajo a
  `xobjectImagen()` para no duplicar el bloque dct/raster. `esListaDeSpecs()` distingue "una spec" de
  "lista de specs" **por la clave `tipo`**, no con `is_array()` (que daba falso positivo porque una
  spec es un array). `spliceOps()` recibe el slot; `/Resources` registra una entrada por ranura usada.
- [X] T027 [US7] `assets/tienda.js` + `personalizador-pdf.php`: un placeholder `tipo=imagen` con
  `value=[campoN]` resuelve cada id contra `manifest.subidas[]` con el endpoint
  `personalizador_pdf_subida_url` (**nunca** una ruta armada desde el id: si el id no esta en el
  manifest se responde error y la instancia se omite), rasteriza el blob al tamano exacto del hueco
  con "contain" y centrado, y lo sube al pool **una fila por instancia** (`limpiar` solo en la
  primera). Del lado del servidor, `item_generar_pdfs()` juntea las filas por grupo ordenadas por
  `indice` y pasa lista o escalar; `Motor::procesar_pedido()` acepta ambas. Con N != `cont` **no se
  bloquea ni se avisa**: sobran huecos transparentes (D17/D18/D19).
- [X] T027b [US7][P] **CAMBIO DE COMPORTAMIENTO EN PRODUCCION** (D17/D18, pedido explicito del
  usuario): `PURO.conciliarGrupo()` reescrito. Con `repetir` el `idx` **cicla** (`i % N`: 4 valores
  en 8 instancias -> 1,2,3,4,1,2,3,4; 1 solo valor -> el mismo en las 8). Sin `repetir`, las N
  primeras instancias llevan foto y **las sobrantes quedan vacias**. **Nunca bloquea**: `aviso`
  paso a ser `nota`, un informe ("Quedan N espacio(s) sin completar"), y el generador saltea las
  instancias vacias en vez de abortar. Aplica igual a texto e imagenes. Los asserts de
  `tests/conciliacion.js` se reescribieron (10 asserts, incluidos los 3 casos que antes bloqueaban).
- [X] T028 [US7] Campos `protegido`: `campos_panel()` NO los manda al HTML de la ficha (ya estaba
  hecho en F1/F2, se verifico). Campos invisibles (sin HTML visible) siguen publicando via su
  `campo.js`, porque el montaje corre igual aunque el campo no tenga markup visible (FR-041).

## Fase 8 - Documentacion y cierre

- [X] T029 [P] Actualizar `constitution.md` (Sync Impact Report; bump 2.0.1 -> **2.1.0**) y `AGENTS.md` (§2 mapa
  con `campo-montar.js`/`cargador-pmu.js` y el `tests/`, §5 datos: `campos/{id}/` + `global.css|js` +
  `subidas/`, §9 las 4 puertas y las fases nuevas, §11 los 8 errores reales encontrados). Nota: la
  constitucion vive en `.specify/` (gitignored) y su Sync Impact Report queda en el equipo, no en el
  repo; lo que viaja es `AGENTS.md`.
- [X] T030 [P] `specs/INDICE.md`: la 012 pasa de "En especificacion" a **Activos** (36/38 `[X]` + 1 `[~]`,
  verificada en navegador). `admin/ayuda.php`: seccion **Campos reutilizables** (nombre vs titulo del
  comprador, los dos valores, Probar, plantillas, el global, baja/restaurar).
- [X] T031 [P] `specs/MANUAL-PENDIENTE-WP-REAL.md`: nueva seccion **§6b** (9 pasos) que cubre editor
  en linea, par `valor`/`cliente`, prefijo del CSS global, filtros, plantilla/duplicar/restaurar,
  cargador con `min=2` de punta a punta, **nunca bloquea** y el PDF con una foto por hueco. Se puede
  hacer **sin WooCommerce** con el shortcode `[pmu_personalizar]`.
- [X] T032 Verificacion final: TODAS las puertas verdes y version subida a **4.4.0** en la cabecera
  (§10.bis) + `Stable tag` de `readme.txt`. Queda el recorrido manual §6b en el sitio real, que es lo
  unico que no se puede automatizar.

## Dependencias

- F0 bloquea todas las fases (el formato v2 es la base).
- F7 (nucleo) depende de F6 (las subidas) y va **al final, sola**.
- F5 (global) puede ir antes de F6; la ficha ya monta campos desde F2.

## Fuera de alcance

Emails, editor con resaltado, boton "Anadir al catalogo `img/`", reordenar el panel del
comprador, tocar `modules/textmuy/`, la API (010).
