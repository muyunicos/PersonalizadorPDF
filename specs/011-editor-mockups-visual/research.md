# Research: editor-mockups-visual

**Feature**: 011-editor-mockups-visual | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

Resuelve los `NEEDS CLARIFICATION` del Technical Context de [plan.md](./plan.md) y las decisiones
de diseno que la spec deja abiertas. Cada decision lleva alternativas descartadas con motivo.

## R1 - Nucleo de composicion compartido (paridad editor <-> cliente)

**Decision**: un modulo cliente nuevo `assets/mockup-render.js` (`PMUMockup`) con la funcion unica
`componer(ctx, capas, resolver, opciones)`. Lo usan los **dos** consumidores del render: el editor
(`assets/mockups.js`) y la ficha (`assets/tienda.js`). Se registra como script
`personalizador-pdf-mockup-render` encolado **antes** que `mockups.js` y que `tienda.js` (hoy
`tienda.js` depende de `personalizador-pdf-selector`; se encadena
`mockup-render -> selector -> tienda`).

**Rationale**: el contrato 004 (`contracts/mockups.md`, criterio de aceptacion) ya exige "la galeria
del admin y la del cliente usan el mismo render (una sola funcion)", y hoy **se incumple**: hay dos
implementaciones (`mockups.js:154-183` y `tienda.js:438-480`) que difieren (el editor pinta una
caja con el `ref`; la ficha no) y ambas estiran la imagen a la caja. FR-023/FR-025 no son un extra:
son la correccion de un incumplimiento vigente. Ademas, un nucleo unico hace que FR-028 (ajustes
nuevos) se implemente una vez y no dos veces.

**Alternatives consideradas**:
- *Duplicar la logica y anadir una prueba de paridad*: rechazado, ya esta el problema hoy (dos
  implementaciones que divergieron en silencio).
- *Mover el editor al modulo TextMuy (iframe/modo)*: rechazado por D1 (el admin pierde el contexto
  de grupos/mapeos) y porque anade un segundo consumidor del RenderCore con su propio ciclo de vida
  de iframe.

## R2 - Preview de "Probar" compartido (D2, fuente unica)

**Decision**: `admin.js` publica un store cliente `PersonalizadorPDF.previews` =
`{ [grupoId]: {url, w, h, ts, hash} }` con **cache por hash**
`hash = sha1(texto|preset|settings|w|h)`. El flujo de `.ec-probar` (FR-017/FR-018):
1. Calcula el hash; si hay entrada vigente, **no vuelve a renderizar** (solo repinta).
2. Si no, `renderCore()` + `TextMuyAPI.renderBatch` y guarda el blob URL.
3. Publica un evento `pmu:preview-listo` con `{id, url, w, h}`; `mockups.js` escucha y repinta.
4. Cualquier cambio en tipo/estilo/codigo/campo **invalida** la entrada del grupo (hash distinto al
   recalcular).
5. Al revocar una URL, se libera la anterior del store (el `img` de `.ec-texto-preview-caja` deja de
   ser el dueno del object URL).

**Rationale**: el render ya existe (`admin.js:960-988`, `renderCore()` + `renderBatch` al tamano
exacto del hueco). Reutilizarlo cumple D2 y FR-021 ("abrir el editor no genera renders
adicionales"): hoy el boton re-renderiza en cada pulsacion, sin cache. El hash evita renders
duplicados **sin un endpoint nuevo ni un boton propio del editor**.

**Alternatives consideradas**:
- *Que el editor dispare su propio render por grupo*: rechazado (D2 explicito del usuario; duplica
  renders y el estado del motor).
- *Persistir el preview como PNG en disco*: rechazado por constitution §IV (el render es al vuelo,
  nunca un PNG fijo de plantilla; contrato 004 regla 5) y porque anade rutas y limpieza.

## R3 - `capas[].ref` con namespace (catalogo `img/`)

**Decision**: `capas[].ref` pasa a ser `{ambito}:{valor}` con `ambito` en `pdf` | `img`:
- `pdf:{archivo}`: foto del PDF en `pdfs/{nombre}/mockups/{archivo}`.
- `img:{id}`: **id numerico** del catalogo `img.json`.
- **Lectura tolerante**: un `ref` plano (sin `:`) se interpreta como `pdf:{ref}` (compatibilidad
  con los mockups existentes, sin migracion).

**Rationale**: el contrato 004 ya declara `capas[].ref` = "id del catalogo `img/` o
`mockups/{archivo}`", pero (a) el codigo solo resuelve fotos del PDF, y (b) el validador
`config_mockups` (`class-pmu-uploads.php:722-725`) **rechaza cualquier `ref` con `/`**, o sea el
formato del contrato es hoy imposible de guardar. Sin namespace habria ambiguedad si un archivo del
PDF y uno del catalogo se llaman igual. Se usa el **id numerico** del catalogo (no el nombre) porque
es lo que ya hace el modulo TextMuy al guardar referencias de imagen (`prepareImgRefs`), y porque el
nombre del catalogo puede cambiar en una edicion mientras el id no.

**Consecuencia a aplicar**: `config_mockups` y `handle_mockups_guardar` deben validar el namespace
en vez de rechazar `/`, y el plugin necesita resolver `img:{id}` -> URL (reutiliza `listar('img')`,
que ya devuelve `id`/`file`/`url` verificados).

**Alternatives consideradas**:
- *Prefijo textual (`cat:`, `pdf:`)*: equivalentes; se elige `img:`/`pdf:` por simetria con los
  ambitos de la constitution (`img/`, `pdfs/`).
- *Guardar la foto del catalogo como copia en `pdfs/{nombre}/mockups/`*: rechazado, duplica el
  archivo y pierde la edicion posterior del catalogo (la capa dejaria de reflejar el recurso real).

## R4 - Geometria pura extraida y testeada con Node

**Decision**: `assets/mockup-geometria.js` con funciones puras (sin DOM, sin jQuery): `acotar`,
`ajustarImanes`, `redimensionarDesdeTirador`, `puntosDeRotacion`, `acertarCapa`, `alinear`,
`distribuir`, `normalizarCapa`. Expuestas como `PMUGeometria` en el navegador y como modulo
CommonJS cuando `module.exports` existe. Test: `tests/mockup-geometria.test.js` con `node`
(sin framework, mismo estilo de `tests/conciliacion.js` del modulo).

**Rationale**: snapping, tiradores y limites son la parte donde un error se ve (FR-038/FR-039) y
donde el arrastre es dificil de verificar a mano. El proyecto ya usa Node **solo para tests**
(constitution: "Node solo para testing del modulo, nunca en productivo"); este test no ejecuta nada
en el servidor.

**Alternatives consideradas**:
- *Prueba de navegador con Playwright* (`tests/galerias.browser.js`): rechazada como puerta
  principal porque necesita Chrome y no corre en el hosting; queda como validacion opcional.
- *Probar solo por el smoke test del sitio*: insuficiente, no cubre imanes ni limites.

## R5 - Zoom y nitidez (D3, FR-003/FR-004)

**Decision**: canvas con **resolucion logica fija de 300x300** para la geometria y un
`backing store` de `300 * factor` pixeles reales, con `factor = devicePixelRatio * zoom`; el `ctx` se
escala una vez por frame (`setTransform(factor,0,0,factor,0,0)`) y todas las coordenadas se manejan
en el espacio logico 300. El tamano CSS de la caja es `300 * zoom`.

**Rationale**: la salida es 300x300 fijo (norma), pero el admin necesita una lupa. Escalando el
contexto (y no la imagen) el texto de los renders del grupo sigue nitido a 200/300 % y la
geometria guardada no depende del zoom (FR-003).

**Alternatives consideradas**:
- *Canvas offscreen 300x300 escalado por CSS*: mas barato, pero a 200 % la imagen se ve borrosa
  (incumple FR-004).
- *Redimensionar el lienzo de salida*: prohibido, el entregable es 300x300.


## R6 - Ajustes por capa ampliados (FR-028/FR-029)

**Decision**: `capas[].filtros` admite `brillo`, `contraste`, `saturacion`, **`gama`**, `opacidad`,
`desenfoque`, `tono` (0..200 para los tres primeros; `gama`/`saturacion` 0..200; `opacidad` 0..100;
`desenfoque` 0..20 px; `tono` -180..180 grados) y `capas[].modo` es el modo de fusion
(`normal` | `multiply` | ...). El nucleo compartido traduce a una cadena CSS:
`brightness()`/`contrast()`/`saturate()`/`grayscale()` + `globalAlpha` (opacidad, **no** va en
`ctx.filter`) + `blur()`/`hue-rotate()` + `globalCompositeOperation` (modo). Ausente = neutro.

**Rationale**: los tres primeros ya estan en la allowlist del motor
(`class-pmu-uploads.php:729`); `gama` es un **bug actual** (se guarda y `filtroCss()` no lo aplica).
Los nuevos son capabilities nativas de Canvas 2D: sin WebGL, sin motor nuevo.

**Consecuencia a aplicar**: los tres puntos de aplicacion pasan a ser **dos** (nucleo compartido):
`config_mockups` (allowlist + clamp), `handle_mockups_guardar` (saneo) y el nucleo de render.

**Alternatives consideradas**:
- *Exponerlo todo con sliders CSS sobre el `<img>`*: imposible, el render es Canvas (necesita
  composing por capas).

## R7 - Autoguardado, estado de guardado y `preview_omisible` (FR-032/033/037)

**Decision**: estado de guardado visible con 3 valores; autoguardado con **debounce de 1.5 s** tras
la ultima mutacion, reutilizando `pmuPost('personalizador_pdf_mockups', ...)`. El editor pasa a
**poseer** el valor de `preview_omisible`: lee el checkbox vivo en cada guardado (no
`datos.preview_omisible` congelado al cargar) y lo refleja al cambiarlo, con la regla vigente
(sin mockups queda `false` y el control deshabilitado).

**Rationale**: corrige el bug verificado (`mockups.js:326` manda el valor congelado;
`personalizador-pdf.php:2281` lo escribe siempre). Con autoguardado, el checkbox solo puede
cambiar desde el editor, asi que una sola fuente de verdad es obligatoria.

**Alternatives consideradas**:
- *Guardado explicito con boton (hoy)*: incompatible con FR-033; se conserva como atajo
  (`Ctrl+S`) y como boton visible, pero deja de ser la unica via.

## R8 - Deshacer/rehacer (FR-035)

**Decision**: pila de **snapshots** (`JSON` del estado de mockups) con tope de 50 pasos, y
**coalescing por gesto**: un arrastre/redimensionado genera **un** paso al soltar, no uno por
`mousemove`. Autoguardado dispara tras cada paso confirmado.

**Rationale**: snapshots son trivialmente correctos con este modelo de datos (todo es JSON) y no
requieren inverters. El tope evita crecimiento de memoria con 20+ capas.

**Alternatives consideradas**:
- *Historial de comandos (apply/invert)*: mas eficiente, mas codigo y mas riesgo de estados
  divergentes con el autoguardado.

## R9 - Catalogo de imagenes en el editor (FR-014)

**Decision**: `mockups_para_editor()` agrega `imagenes` (de `PMU_Uploads::listar('img')`, que ya
devuelve `id`/`title`/`cats`/`url` con fisicos verificados). El selector pinta miniaturas con
`<img src=url loading="lazy">` directo. **No** se escriben catalogos ni sprites desde el editor
(`assets/miniaturas.js` sigue siendo el unico escritor, constitution §II).

**Rationale**: `listar('img')` ya existe y ya excluye fisicos ausentes (cero 404). Cuando aterrice la
spec 009 (hoja certificada) el selector puede pasar a celda del sprite **sin cambiar el contrato**
(solo la fuente del `src`).

**Alternatives consideradas**:
- *Reusar el panel de galeria del modulo (`galeria.js`)*: exige iframe y puente; el editor vive en
  el plugin (D1) y no debe depender del iframe del RenderCore para listar imagenes.


## R10 - Estilos en `admin.css`, no inyectados por JS

**Decision**: el bloque `.ec-mk-*` va en `assets/admin.css` con CSS Grid de 2 columnas
(`grid-template-columns: minmax(0,1fr) 320px`), y el editor se monta siempre en el DOM con clases
estables.

**Rationale**: hoy `mockups.js` no inyecta nada (por eso no hay una sola regla) mientras
`selector-pmu.js` si lo hace. En `admin.css` el estilo se cachea con el resto de la consola y no
depende del orden de carga; ademas permite versionarlo con `PERSONALADOR_PDF_VERSION`.

## R11 - Fin de los `prompt` y del listado duplicado (FR-012/FR-031)

**Decision**: se eliminan `window.prompt`/`alert` de los flujos de agregar foto y agregar hueco, y
se elimina el bloque PHP `admin/pdfs.php:519-528` (listado estatico duplicado). La galeria de
miniaturas del editor es el unico listado. `window.confirm` se conserva **solo** para acciones
destructivas irreversibles de baja (borrar mockup, borrar foto en uso), con el conteo de capas
afectadas en el texto (FR-016): el conteo se calcula **en el cliente** con el estado en memoria, sin
endpoint nuevo.

**Rationale**: `confirm` es aceptable para una confirmacion; `prompt` para **elegir** un recurso es
lo que hay que eliminar. El conteo local es exacto (el editor tiene el estado) y evita un round-trip.

## R12 - Deteccion de capa invalida (FR-038)

**Decision**: el editor valida cada capa al abrir y en cada cambio: `img` debe resolver en
`fotos` del PDF o en el catalogo; `placeholder` debe tener un grupo existente y el indice
(`#n`) dentro de `cont`. Marcado con etiqueta en la lista + aviso en la cabecera. Al **guardar**, las
capas invalidas se conservan (no se podan en silencio) y el aviso es visible.

**Rationale**: el cliente ya es tolerante (si falta el recurso, `componerMockup` no dibuja nada);
el problema es que hoy el admin no se entera. Conservar la capa permite repararla si el admin
re-sube la foto; eliminarla perderia el encuadre.

**Alternatives consideradas**:
- *Podar las capas invalidas al guardar*: rechazada, destruye trabajo sin confirmacion.

## R13 - Paridad: un solo nucleo, dos resolvers (FR-023/FR-025)

**Decision**: el nucleo `componer()` no conoce pools ni sesiones. Recibe un `resolver(ref)` que
devuelve un recurso (URL o Blob). El editor resuelve `img`/`placeholder` contra `datos.fotos`,
`analisis.json` y el catalogo; la ficha resuelve `placeholder` contra los PNG del pool
(`pngsPorGrupo`) y `img` contra las fotos. El ajuste `contain` (encajar sin deformar) vive **en el
nucleo**, no en cada consumidor.

**Rationale**: es lo que hace verificable SC-003 (misma composicion) sin exigir el mismo render
byte a byte entre navegador y ficha.

**Alternatives consideradas**:
- *Exportar la composicion del editor como PNG y subirla*: rechazado, el mockup debe seguir siendo
  geometria (contrato 004: render siempre al vuelo).

## R14 - Nota de compatibilidad constitucional (D1/D2 vs §I)

**Decision**: se implementa D1/D2 **sin enmienda** de la constitution, con esta lectura documentada:
§I exige "editor embebido reducido en la pagina de edicion del PDF" que "reutiliza motor
TextMuy/Canvas-WebGL" y "no editor nuevo". Esta spec cumple las tres condiciones: el editor sigue
embebido en la pagina del PDF, el render de texto es el del modulo (RenderCore, via el preview de
"Probar") y no se crea un editor paralelo. La clause "via iframe/modo" describe la via prevista por
la spec 004, superada por la decision de T008 (Canvas 2D en el plugin, ya en produccion y con su
test `mockups_guardar` en verde).

**Rationale**: enmendar la constitution por esto seria ruido normativo; lo que la constitution
protege es que el render siga siendo el del modulo y que no se duplique la UI. Se registra la
lectura aqui para que sea revisable y, si el owner discrepa, se eleve a enmienda en `/speckit-plan`
o en una spec posterior.

**Alternatives consideradas**:
- *Enmendar §I para dejar constancia textual del_editor en Canvas*: rechazada de momento; la
  constitucion sigue siendo correcta en sus principios.
- *Mover el editor al modulo (iframe/modo)*: rechazada por D1.

## Resumen de artefactos de codigo

| Fichero | Naturaleza | Nota |
|---|---|---|
| `assets/mockup-render.js` | **nuevo** | nucleo de composicion (Canvas 2D) + `contener()` + ajustes |
| `assets/mockup-geometria.js` | **nuevo** | funciones puras de geometria/manipulacion |
| `assets/mockups.js` | reescritura | editor: lienzo, capas, recursos, teclado, autoguardado |
| `assets/admin.css` | ampliar | bloque `.ec-mk-*` (hoy inexistente) |
| `assets/admin.js` | ampliar | store de previews + cache + evento (R2) |
| `assets/tienda.js` | ajustar | `componerMockup` pasa a usar el nucleo |
| `admin/pdfs.php` | ajustar | quitar el listado duplicado (R11) |
| `personalizador-pdf.php` | ajustar | encolado del nucleo; `mockups_para_editor()` + `imagenes`; sanear `ref` con namespace |
| `inc/class-pmu-uploads.php` | ajustar | allowlist/clamp de `filtros` + `modo`; validar namespace de `ref`; resolver `img:{id}` |
| `tests/mockup-geometria.test.js` | **nuevo** | test Node de geometria pura |
| `tests/texto_puente.php` | ampliar | fases nuevas para el contrato ampliado |

**No se toca**: `modules/textmuy/` (sin cambios en el motor, sin bump `?v=RCn`), `engine/`,
`analisis.json`, y ninguna ruta de datos nueva.

