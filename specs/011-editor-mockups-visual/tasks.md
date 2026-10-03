---

description: "Task list for editor-mockups-visual (redisenio del editor de mockups del admin)"

---

# Tasks: editor-mockups-visual

**Input**: Design documents from `/specs/011-editor-mockups-visual/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mockup-capas.md,
quickstart.md

**Tests**: este proyecto tiene **validacion automatica obligatoria** (constitution §"Development
Workflow"), asi que las tareas de test son **puertas de regresion**, no TDD estricto: se escriben
junto a la implementacion que validan y deben quedar en verde antes de cerrar cada fase. El test
nuevo es `tests/mockup-geometria.test.js` (Node, sin framework) y dos fases nuevas en
`tests/texto_puente.php`.

**Organization**: las tareas se agrupan por historia para permitir implementacion y prueba
independientes. Clave de trazabilidad: `contracts/mockup-capas.md` (contrato) y `data-model.md`
(campos y rangos).

**Estado de las marcas**: `[X]` = implementada y verificada. `[~]` = **implementada a medias**:
la parte lista funciona, pero queda un requisito del enunciado sin hacer (se detalla en la tarea).
La revision en el sitio real del 2026-10-01 detecto que 5 tareas estaban marcadas `[X]` sin
estar completas (T031, T032, T033, T034, T036): se corrigieron a `[~]` con su pendiente explicito.
T031 quedo cerrada en esta revision (2026-10-01): T033 y T036 quedaron cerradas en esta revision (2026-10-01); quedan 2 pendientes
([~] T032 y T034, que se aplaza a peticion del usuario).
**No marcar como hecha una tarea por aproximacion**: si falta un requisito, se marca `[~]`.

**Puertas de validacion (todas obligatorias antes de dar por buena una fase)**:
`php -l`, `php tests/motor_smoke.php`, `php tests/parity.php`, las 37 fases de
`php tests/texto_puente.php`, `node tests/mockup-geometria.test.js` (geometria pura) y
`node tests/mockup-contrato.test.js` (cableado nucleo-consumidores + comportamiento del nucleo).

**Regla de oro de esta feature (research.md R1)**: el render del mockup tiene **una sola
implementacion** (`assets/mockup-render.js`). Ninguna tarea puede escribir logica de composicion
nueva en `mockups.js` o `tienda.js`: ambos la consumen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (fichero distinto, sin dependencias)
- **[Story]**: historia de la spec a la que pertenece (US1..US5)
- Fases 1, 2 y final: sin etiqueta de historia

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: dejar los dos modulos cliente nuevos encolados y con su esqueleto publicado.

- [X] T001 Crear `assets/mockup-geometria.js` con el esqueleto publico (`PMUGeometria`, export CommonJS si `module.exports` existe) y sin logica todavia, para que el encolado no falle
- [X] T002 Crear `assets/mockup-render.js` con el esqueleto publico (`PMUMockup` con `componer`, `contener`, `filtroCss`, `esValida` como no-ops seguros) en `assets/mockup-render.js`
- [X] T003 Encolar `personalizador-pdf-mockup-render` (assets/mockup-render.js) **antes** de `personalizador-pdf-mockups` en la pestana PDFs, en `personalizador-pdf.php:2505-2513`
- [X] T004 [P] Encolar `personalizador-pdf-mockup-render` **antes** de `personalizador-pdf-selector` / `personalizador-pdf-tienda` en el frontend, en `personalizador-pdf.php:595-608` (cadena: mockup-render -> selector -> tienda)

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: nucleo de render, geometria pura y contrato de datos. **Ninguna historia puede empezar
antes de cerrar esta fase.**

**⚠️ CRITICAL**: sin el nucleo (T006-T008) y el contrato (T010-T011) no se puede tocar el editor ni la
ficha sin romper la paridad (FR-025).

### Tests (puertas de regresion)

- [X] T005 [P] Test Node de la geometria pura en `tests/mockup-geometria.test.js`: acotar, imanes, tiradores (8) con y sin modificador, ajuste a proporcion, puntos de rotacion, `acertarCapa` (respeta `oculta`/`bloqueada`), alinear (6) y distribuir. Debe imprimir `GEOMETRIA OK`
- [X] T009 [P] Fase `mockup_capas` en `tests/texto_puente.php`: valida el contrato ampliado (`ref` con namespace `pdf:`/`img:`, `filtros` con `gama`/`opacidad`/`desenfoque`/`tono`, `modo`, `nombre`, `oculta`, `bloqueada`, clamp de rangos, borrado de valores default, lectura de `ref` plano legado) y que los campos ausentes mantienen el comportamiento actual (FR-043)

### Nucleo compartido

- [X] T006 Implementar las funciones puras en `assets/mockup-geometria.js`: `acotar`, `ajustarImanes` (centro H/V y bordes con tolerancia), `redimensionarDesdeTirador`, `puntosDeRotacion`, `acertarCapa`, `alinear`, `distribuir`, `normalizarCapa` (clamp a 300x300, `rot` -360..360, `sesgo` -1..1)
- [X] T007 Implementar `PMUMockup.filtroCss(filtros, modo)` en `assets/mockup-render.js`: `brightness`/`contrast`/`saturate`/`grayscale` a `ctx.filter`, `opacidad` a `ctx.globalAlpha` (0..100), `desenfoque` 0..20 a `blur()`, `tono` -180..180 a `hue-rotate()`, `modo` a `globalCompositeOperation`. **Aplicar `gama`, que hoy se guarda y no se aplica** (`mockups.js:145`, `tienda.js:415`). Los ajustes afectan **solo** a la vista previa: nunca al PNG del pool ni al PDF (FR-029)
- [X] T008 Implementar `PMUMockup.componer(ctx, capas, resolver, opciones)` y `PMUMockup.contener(destino, recurso)` en `assets/mockup-render.js`: orden de capas, salto de `oculta`, `save`/`restore` por capa, rotacion y sesgo en el centro, **encajar sin deformar** (nunca estirar) y degradar a caja neutra si `resolver` devuelve `null`

### Contrato de datos (motor + handler)

- [X] T010 Ampliar `PMU_Uploads::config_mockups()` en `inc/class-pmu-uploads.php:705-775`: allowlist de `filtros` con `gama`, `opacidad` (0..100), `desenfoque` (0..20), `tono` (-180..180) y `brillo`/`contraste`/`saturacion` (0..200); borrar el valor cuando es igual al default; validar `ref` con namespace `{ambito}:{valor}` (`pdf` o `img`) en vez de rechazar `/`; **leer `ref` plano como `pdf:`**; anadir `modo` (`normal`/`multiply`), `nombre` (<= 60), `oculta` y `bloqueada` con sus defaults
- [X] T011 Actualizar `handle_mockups_guardar()` en `personalizador-pdf.php:2229-2287` con el mismo criterio de saneamiento que T010 (misma allowlist, mismos rangos, mismo namespace) para que la fila recibida coincida con la que guarda el motor
- [X] T012 [P] Exponer el catalogo `img` a los consumidores: `datos_pdf_render()` en `personalizador-pdf.php:761-801` y `mockups_para_editor()` en `personalizador-pdf.php:2554-2579` agregan la clave `imagenes` (id, file, title, url) desde `PMU_Uploads::listar('img')`, dentro de try/catch para no tumbar la ficha si el catalogo esta roto

**Checkpoint**: nucleo + geometria + contrato verdes (T005, T009 y las puertas existentes en verde).

---

## Phase 3: User Story 1 - Colocar y alinear los huecos arrastrando (Priority: P1) MVP

**Goal**: el admin coloca, redimensiona y rota las capas **con el raton**, en un lienzo de trabajo
ampliable y nitido, con imanes, guias y medidas visibles, y sin escribir un solo numero.

**Independent Test**: abrir un PDF con grupos, crear un mockup, anadir foto y dos huecos y colocarlos
solo arrastrando y redimensionando; guardar, recargar y comprobar que la posicion se conserva. El
resultado debe ser identico con el lienzo al 100 % y al 200 %.

**Cubre**: FR-001 a FR-011, SC-001, SC-002, SC-005.

### Implementacion

- [X] T013 [US1] Bloque `.ec-mk-*` en `assets/admin.css`: layout de 2 columnas con CSS Grid (`minmax(0,1fr) 320px`), lienzo con fondo damero, marco 300x300 visible, estilos de panel, foco visible y estados de hover/arrastre; y regla de una sola columna para anchos estrechos (FR-002, FR-005)
- [X] T014 [US1] Rehacer el montage del editor en `assets/mockups.js` como 2 columnas (lienzo a la izquierda; lista de capas, recursos y propiedades a la derecha) con las clases de T013, conservando el punto de entrada en `.ec-acordeon-mockups .ec-acordeon-cuerpo` y la dependencia de `PersonalizadorPDF.pmuPost`
- [X] T015 [US1] Lienzo de trabajo en `assets/mockups.js`: resolucion logica 300x300, `backing store` de `300 * (devicePixelRatio * zoom)` con `setTransform` una vez por frame, selectores de zoom 100/150/200/300 %, y **geometria guardada siempre en el espacio logico 300** (FR-003, FR-004)
- [X] T016 [US1] Seleccion y movimiento en `assets/mockups.js`: clic selecciona la capa bajo el puntero via `PMUMockup.esValida` + `PMUGeometria.acertarCapa` (respeta `oculta` y `bloqueada`), arrastre con `pointerdown`/`pointermove`/`pointerup` y `setPointerCapture`, correccion de escala por `getBoundingClientRect` (FR-006, FR-007)
- [X] T017 [US1] Tiradores de redimension (8 esquinas/lados) y tirador de rotacion en `assets/mockups.js`, usando `PMUGeometria.redimensionarDesdeTirador` y `puntosDeRotacion`, con la tecla de modificacion manteniendo la proporcion (FR-008)
- [X] T018 [US1] Imanes y guias en `assets/mockups.js` via `PMUGeometria.ajustarImanes`: centro horizontal, centro vertical y bordes del lienzo, con guia visible mientras se arrastla y ajuste a la proporcion natural de la imagen y del hueco (FR-009)
- [X] T019 [US1] Capa de edicion en `assets/mockups.js`: tiradores + etiqueta con la medida en pixeles y el nombre de la capa, y **acotado** de posicion y tamano al area 300x300 para que ninguna capa se pierda (FR-010); ademas, **al abrir un mockup**, normalizar la geometria fuera de rango al maximo admisible y avisar en una linea, sin bloquear la edicion (FR-039)
- [X] T020 [US1] Sincronia bidireccional de los campos numericos en `assets/mockups.js`: arrastrar actualiza `x`/`y`/`w`/`h`/`rot`/`sesgo`, y editar el numero actualiza el lienzo (FR-011)

**Checkpoint**: se puede crear un mockup y colocar capas sin escribir numeros. `node
tests/mockup-geometria.test.js` en verde.

---

## Phase 4: User Story 2 - Ver el resultado real antes de guardar (Priority: P1)

**Goal**: las capas de hueco muestran en el lienzo el render real del grupo **producido por el boton
"Probar"**, sin motor de render nuevo, y el lienzo se repinta solo cuando ese render cambia.

**Independent Test**: en un grupo con estilo y valor, pulsar "Probar" y comprobar que las capas de
ese grupo del mockup abierto pasan a mostrar ese render, sin guardar ni recargar; un grupo sin render
muestra la caja neutra y el editor sigue operativo.

**Cubre**: FR-017 a FR-024, SC-003 (parcial), SC-004.

### Tests (puerta de regresion)

- [X] T021 [P] [US2] Fase `mockup_preview` en `tests/texto_puente.php`: que la vista de cliente recibe la composicion esperada y que el nucleo shared no altera el entregable; y que `preview_omisible` se guarda desde el estado vigente del editor sin pisar `activo`/`productos`/`campos`/`mapeos`/`tienda`

### Implementacion

- [X] T022 [US2] Store de previews en `assets/admin.js`: `PersonalizadorPDF.previews[grupoId] = {url, w, h, hash, ts}` con `hash = sha1(texto|preset|settings|w|h)`, mas el evento `pmu:preview-listo` con `{id, url, w, h}`; el `.ec-probar` de `assets/admin.js:960-988` publica en el store, **reutiliza la entrada si el hash coincide (no vuelve a renderizar)**, de modo que abrir el editor no genere renders adicionales (FR-021), y libera la URL anterior al revocarla
- [X] T023 [US2] Invalidacion de previews en `assets/admin.js`: un cambio de tipo, estilo, codigo o campo de un grupo invalida su entrada del store (el hash distinto lo detecta en el siguiente "Probar")
- [X] T024 [US2] Consumo del store en `assets/mockups.js`: suscribirse a `pmu:preview-listo` y repintar solo las capas cuyo `ref` apunte a ese grupo; si el interruptor "ver encuadre" esta activo, se respeta y no se dibuja el render (FR-017, FR-018, FR-022)
- [X] T025 [US2] Resolucion de recursos del editor en `assets/mockups.js`: el `resolver` de `PMUMockup.componer` resuelve `pdf:{archivo}` contra `datos.fotos`, `img:{id}` contra `datos.imagenes` y `placeholder` contra `datos.grupos` (con el indice de instancia), con degradacion a caja neutra cuando no hay render (FR-019)
- [X] T026 [US2] Manejo de fallo de render en `assets/mockups.js`: si el preview no llega o falla, avisar en la cabecera del editor, marcar la capa y caer a la caja neutra, sin perder el mockup ni bloquear la edicion (FR-020)
- [X] T027 [US2] Aviso de discrepancia de proporcion en `assets/mockups.js`: cuando `PMUMockup.contener` informa que la proporcion de la capa difiere de la del recurso, marcar la capa y avisar en el editor (FR-023, FR-024)

**Checkpoint**: "Probar" repinta el lienzo sin guardar ni recargar, y un segundo "Probar" con el mismo
texto no genera render nuevo.

---


## Phase 5: User Story 3 - Gestionar fotos y capas sin teclear nombres (Priority: P1)

**Goal**: agregar fotos (del escritorio o del catalogo del proyecto) y huecos **viendo miniaturas**,
sin ningun dialogo de texto, y administrar la lista de capas (ordenar, renombrar, duplicar, ocultar,
alinear, bloquear) y la galeria de mockups.

**Independent Test**: subir dos fotos, anadir una del catalogo, colocar capas, renombrar la capa de
texto, subirla de orden y guardar; recargar y comprobar que todo persiste. Ningun `window.prompt` en
el camino.

**Cubre**: FR-012 a FR-016, FR-026 a FR-031, FR-038, FR-042, SC-006 (parcial), SC-008 (parcial).

### Implementacion

- [X] T028 [US3] Galeria de fotos de referencia en `assets/mockups.js`: miniaturas de `datos.fotos` con previsualizacion, y **eliminacion de los dos `window.prompt`** de agregar foto y agregar hueco (`assets/mockups.js:240` y `:255`); la accion de agregar pasa a pedir la eleccion con un clic en la miniatura o en la ficha del grupo (FR-012, FR-042)
- [X] T029 [US3] Arrastre de archivo al area de trabajo en `assets/mockups.js`: soltar un archivo de imagen lo sube con la accion vigente de subida de foto de mockup, lo anade a la galeria **y** crea la capa que cubre todo el lienzo, sin pedir el nombre (FR-013)
- [X] T030 [US3] Selector del catalogo del proyecto en `assets/mockups.js`: miniaturas de `datos.imagenes` con busqueda por titulo y filtro por categoria; al elegir, se anade como capa con la misma geometria que las demas y `ref = "img:{id}"`; **el editor no escribe en el catalogo ni en sprites** (FR-014)
- [X] T031 [US3] Placeholders del PDF: cada grupo se muestra como `PH-<grupo>` (con su tamano real y numero de instancias) y, si tiene varias, lista sus instancias `PH-<grupo>-01..nn` para elegir una concreta; al elegirla se inserta la capa encuadrada a escala, centrada y seleccionada. El `ref` guardado es `{grupo}` para la #01 (legado) y `{grupo}#{n}` 1-based para las demas, que es lo que espera `esValida()` del nucleo. Vocabulario unificado en "placeholder" (FR-015)
- [~] T032 [US3] Aviso de borrado de foto en uso en `assets/mockups.js`: **PARCIAL**: las fotos en uso se marcan con un punto verde (`.ec-usada`) al pintar la galeria. **PENDIENTE**: al borrar, mostrar cuantos layers la referencian y ofrecer quitar la capa o cancelar; hoy el borrado lo hace `admin.js` (`.ec-mockup-borrar`), que no conoce las capas (FR-016)
- [X] T033 [US3] Panel de capas en `assets/mockups.js`: acciones por capa (renombrar, duplicar, ocultar, bloquear, eliminar), reordenar con botones Subir/Bajar y **arrastrando**, y **miniatura al inicio de cada fila** tipo Photoshop (`[img] nombre`). La miniatura reusa `resolverCapa()`: muestra la imagen real (foto del PDF, catalogo o el render del placeholder ya previsualizado con "Probar") y cae al swatch de color del grupo cuando aun no hay recurso (FR-026)
- [~] T034 [US3] Alineacion y distribucion en `assets/mockups.js` via `PMUGeometria.alinear` y `distribuir`, para las 6 posiciones, sin mover las capas no seleccionadas. **PARCIAL**: los 6 botones de alinear estan en la UI. **PENDIENTE**: exponer `distribuir` (la funcion existe y esta testeada, pero sin boton) (FR-027)
- [X] T035 [US3] Panel de propiedades en `assets/mockups.js`: geometria mas **ajustes como controles deslizantes con vista en vivo** (brillo, contraste, saturacion, gama, opacidad, desenfoque, tono) y el modo de fusion, con "restablecer a neutro" por capa; los valores salen de `PMUMockup.filtroCss` (FR-028)
- [X] T036 [US3] Galeria de mockups en `assets/mockups.js`: miniaturas renderizadas en vivo con el nucleo, navegacion crear / seleccionar / duplicar / renombrar / eliminar y **reordenar arrastrando** (pointer events con umbral, para que un clic simple no mueva la vista). El reordenamiento usa `PMUGeometria.reordenar(lista, desde, hasta)`, funcion pura que devuelve una copia y no muta la entrada (FR-030)
- [X] T037 [US3] Fuente unica de estado: **eliminar el listado estatico duplicado de `admin/pdfs.php:519-528`** y refrescar la galeria al instante tras cualquier cambio, sin recarga de pagina (FR-031)

---


## Phase 6: User Story 4 - No perder el trabajo (Priority: P2)

**Goal**: los cambios se autoguardan con retardo, se pueden deshacer y rehacer, el estado es siempre
visible y salir con cambios pendientes avisa; la marca de "vista previa omisible" nunca queda
desincronizada.

**Independent Test**: mover una capa, esperar el autoguardado, recargar y comprobar que el cambio esta;
deshacer un movimiento y comprobar que se restaura; con un cambio pendiente, intentar cambiar de PDF y
verificar la confirmacion.

**Cubre**: FR-032 a FR-037, SC-007, SC-009.

### Implementacion

- [X] T038 [US4] Estado de guardado en `assets/mockups.js`: "Sin guardar" / "Guardando" / "Guardado" visible, con el resultado real del guardado (no optimista) (FR-032)
- [X] T039 [US4] Autoguardado con retardo en `assets/mockups.js`: debounce de 1.5 s tras la ultima mutacion, reutilizando `PersonalizadorPDF.pmuPost` con la accion propia del editor (que solo escribe `mockups` y `preview_omisible`); el boton de guardar pasa a ser atajo, no la unica via (FR-033)
- [X] T040 [US4] Aviso al abandonar el contexto en `assets/mockups.js`: `beforeunload` y aviso antes de cambiar de PDF con cambios pendientes, ofreciendo confirmar o cancelar (FR-034)
- [X] T041 [US4] Deshacer y rehacer en `assets/mockups.js`: pila de snapshots del estado de mockups con tope de 50 pasos, **un paso por gesto** (un arrastre o redimensionado cuenta como un paso al soltar, no uno por movimiento) (FR-035)
- [X] T042 [US4] Fallo de guardado en `assets/mockups.js`: ante error de red o respuesta no exitosa, volver a "Sin guardar", mostrar la causa y **conservar el contenido del lienzo** (FR-036)
- [X] T043 [US4] Fuente unica de `preview_omisible` en `assets/mockups.js`: leer el valor vigente del control al guardar (no la copia congelada del arranque), reflejarlo al cambiarlo y respetar la regla vigente (sin mockups queda `false` y el control deshabilitado) (FR-037)
- [X] T044 [US4] Teclado y etiquetas en `assets/mockups.js`: flechas mueven (1 px, 10 px con modificador), Supr elimina, Ctrl+Z / Ctrl+Shift+Z deshace y rehace, Ctrl+D duplica, Ctrl+S guarda, `[` y `]` suben y bajan la capa, Esc deselecciona; **todos los controles con etiqueta visible o texto alternativo** (FR-040, FR-041, SC-008)

---

## Phase 7: User Story 5 - Ver el mockup en el contexto de la venta (Priority: P2)

**Goal**: el admin ve la composicion tal como la vera el cliente (300x300, con la galeria y su
navegacion) y la ficha compone con **la misma** funcion y los **mismos** ajustes que el editor.

**Independent Test**: abrir la vista de cliente dentro del editor y comprobar que coincide con la
imagen 300x300 que recibe el cliente; en la ficha real, un hueco con proporcion distinta se ve
encajado y no deformado.

**Cubre**: FR-023, FR-025, SC-003.

### Implementacion

- [X] T045 [US5] Migrar `componerMockup()` en `assets/tienda.js:438-480` al nucleo compartido: borrar la logica de composicion propia y llamar a `PMUMockup.componer` con un `resolver` que devuelve los PNG del pool por grupo/indice y las fotos del PDF; **eliminar el `filtroCss` duplicado** de `assets/tienda.js:415-422` (FR-025)
- [X] T046 [US5] Resolver `img:{id}` en la ficha: usar la clave `imagenes` que T012 agrega a `datos_pdf_render` en `personalizador-pdf.php`, de modo que una capa de catalogo se vea igual que en el editor (FR-025)
- [X] T047 [US5] Vista de cliente en `assets/mockups.js`: previsualizacion de la composicion a 300x300 sin marcos ni guias, con la navegacion de la galeria (flechas e indice) cuando el PDF tiene varias vistas
- [X] T048 [US5] Comprobacion de paridad en el sitio real segun `quickstart.md` §6: la imagen que ve el cliente coincide en posicion, tamano, orden y ajustes con la del editor, y un hueco con proporcion distinta se ve encajado, no deformado (FR-023, SC-003)

**Checkpoint**: editor y ficha componen con una sola funcion; la paridad esta verificada en el sitio real.

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: cierre, puertas completas y documentacion.

- [X] T049 [P] Anadir a `smoke_consola()` en `personalizador-pdf.php:1714` un check de que el editor y su nucleo estan encolados y de que la composicion de un mockup se genera, sin cambiar el resto del smoke test (FR-044); comprobar ademas que con dos pestanas del admin sobre el mismo PDF el ultimo guardado **no corrompe** la configuracion y el editor informa el conflicto (SC-012)
- [X] T050 Ejecutar `quickstart.md` completo: `php -l`, `motor_smoke`, `parity`, todas las fases de `texto_puente.php` (incluidas `mockup_capas` y `mockup_preview`), `node tests/mockup-geometria.test.js` (SC-010); comprobar que los mockups existentes se abren y se guardan sin cambios de resultado (SC-011) y que ninguna ruta se construye fuera del dueno unico de datos ni se escriben catalogos desde el editor (FR-045); y las puertas de no-regresion (el modulo `modules/textmuy/` sin cambios: mismo `?v=RCn` y mismo numero de suites)
- [X] T051 [P] Anotar el recorrido manual del editor de mockups en `specs/MANUAL-PENDIENTE-WP-REAL.md` §2, con el recorrido de `quickstart.md` §5 y §6
- [X] T052 [P] Actualizar la documentacion vigente: `AGENTS.md` (§2 mapa de `assets/`, §5 formato de `capas[]` con namespace y ajustes, §9 pruebas con el test nuevo), `specs/INDICE.md` y el `== Changelog ==` de `readme.txt` (FR-044)
- [X] T053 [P] Registrar la lectura constitucional en `.specify/memory/constitution.md` (Sync Impact Report): el editor sigue embebido y reutiliza el motor del modulo, sin modo nuevo en `modules/textmuy/`; la version y el numero de suites del modulo son los vigentes en cada deploy, no numeros fijos (research.md R14)

**Checkpoint**: feature completa y documentada.

---


## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias - se puede empezar ya.
- **Foundational (Phase 2)**: depende de Setup y **BLOQUEA todas las historias**. Sin el nucleo
  (T006-T008) y el contrato (T010-T012) no se toca el editor ni la ficha: se romperia la paridad
  (FR-025) y el guardado perderia los campos nuevos.
- **User Stories (Phase 3+)**: todas dependen de Foundational.
  - US1, US2 y US3 son P1: se pueden trabajar **en paralelo** tras Foundational, pero US2 y US3
    editan `assets/mockups.js`, asi que conviene secuenciarlos (US1 -> US2 -> US3) para no chocar.
  - US4 y US5 son P2 y dependen de que el editor y la ficha ya usen el nucleo.
- **Polish (Phase 8)**: depende de todas las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational. No depende de otras historias. **Es el MVP.**
- **US2 (P1)**: arranca tras Foundational. Comparte `assets/mockups.js` con US1, asi que va
  detras; su parte propia (`assets/admin.js`, el store de previews) es independiente y puede ir en
  paralelo (T022-T023).
- **US3 (P1)**: arranca tras Foundational. Depende de la estructura montada en US1 (columnas,
  panel de capas, propiedades). Su parte independiente es el catalogo (`imagenes`), que llega del
  contrato en Foundational.
- **US4 (P2)**: arranca tras US1 (el autoguardado y el historial actuan sobre las mismas
  mutaciones que genera la manipulacion directa). Reusa el panel de propiedades de US3.
- **US5 (P2)**: arranca tras US2 (la vista de cliente muestra la composicion con el render real) y
  toca `assets/tienda.js`, que no comparte ficheros con las historias anteriores.

### Within Each User Story

- La geometria pura (T005-T006) y el nucleo (T007-T008) se prueban **antes** de que exista UI.
- El contrato de datos (T010-T011) se prueba (T009) antes de que el editor envie campos nuevos.
- Nucleo -> UI: el editor y la ficha **consumen** el nucleo, nunca lo reimplementan.
- Historia completa antes de pasar a la siguiente de igual prioridad.

### Parallel Opportunities

- T001-T004 (Setup): T003 y T004 tocan el mismo fichero (`personalizador-pdf.php`), asi que **no**
  son paralelizables entre si; los esqueletos T001 y T002 si.
- Foundational: T005, T009 y T012 son `[P]`; T006, T007, T008 y T010-T011 son secuenciales.
- Tras Foundational: T022-T023 (store de previews en `assets/admin.js`) puede ir en paralelo con
  la fase de US1.
- US3: T037 (`admin/pdfs.php`) no toca `assets/mockups.js`, asi que puede ir en paralelo con el resto
  de US3.
- US5: T045-T046 (`assets/tienda.js`) puede ir en paralelo con T047-T048 (`assets/mockups.js`).
- Polish: T049, T051, T052 y T053 son `[P]`.
- Historias distintas pueden trabajarse en paralelo por personas distintas, salvo las que comparten
  `assets/mockups.js` (US1, US2, US3, US4 y parte de US5).

---

## Parallel Example: User Story 1

```bash
# Fase 2 primero (bloqueante):
Task: "Implementar las funciones puras en assets/mockup-geometria.js"
Task: "Implementar PMUMockup.filtroCss y componer/contener en assets/mockup-render.js"
Task: "Ampliar PMU_Uploads::config_mockups() en inc/class-pmu-uploads.php"
Task: "Actualizar handle_mockups_guardar() en personalizador-pdf.php"

# Luego US1, el nucleo de estilos puede ir en paralelo con el montaje:
Task: "Bloque .ec-mk-* en assets/admin.css (grid de 2 columnas)"
Task: "Rehacer el montage del editor en assets/mockups.js como 2 columnas"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup).
2. Completar Phase 2 (Foundational) — **CRITICO, bloquea todo**.
3. Completar Phase 3 (User Story 1).
4. **PARAR y VALIDAR**: colocar un mockup solo con el raton, guardar y recargar.
5. Entregar si el resultado es util: el editor ya deja de ser un formulario de numeros.

### Entrega incremental

1. Setup + Foundational -> nucleo, geometria y contrato listos (nada visible todavia).
2. US1 -> el editor se usa con el raton (MVP).
3. US2 -> se ve el texto real en el lienzo (se cierra el pendiente de T008 de la spec 004).
4. US3 -> se administran fotos, capas y mockups sin escribir nombres; el filtro `gama` corregido.
5. US4 -> el trabajo no se pierde.
6. US5 -> editor y ficha componen con una sola funcion; se cierra el criterio de aceptacion de 004.
7. Polish -> puertas, smoke test y documentacion.

### Estrategia de equipo

Con varias personas, tras Foundational:

- Persona A: US1 (el grueso de `assets/mockups.js`).
- Persona B: US2 (store de previews en `assets/admin.js` + wiring) y T022-T023.
- Persona C: US3 y US4 sobre `assets/mockups.js`, **solo despues** de que A entregue la estructura
  (mismo fichero: no paralelizar US1/US3 en el mismo fichero).
- Persona D: US5 en `assets/tienda.js` + `personalizador-pdf.php` (fichero distinto de US1-US4).

## Notes

- `[P]` = fichero distinto, sin dependencia de tareas incompletas.
- La etiqueta `[Story]` mapea cada tarea a su historia para trazabilidad contra la spec.
- **Regla de la feature**: nada de logica de composicion fuera de `assets/mockup-render.js`; nada de
  geometria fuera de `assets/mockup-geometria.js`; nada de render en PHP (constitution §III).
- Puerta minima antes de cerrar cada fase: `php -l`, `motor_smoke`, `parity`, las fases de
  `texto_puente.php` y `node tests/mockup-geometria.test.js` (esta ultima desde la fase 2).
- No se toca `modules/textmuy/`: si una tarea lo requiriera, hay que revisar el alcance y hacer el
  bump `?v=RCn` en ambos HTML.
- Commit tras cada tarea o grupo logico; parar en cada checkpoint para validar la historia.
- Evitar: tareas vagas, conflictos de fichero, dependencias cruzadas entre historias.

