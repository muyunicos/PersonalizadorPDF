# Decisiones de diseño (historial)

Registro de las decisiones tomadas por spec, con fecha y estado. **No es normativa vigente**:
el contrato actual vive en `AGENTS.md` y en `specs/NNN/contracts/`; el estado de cada spec,
en `specs/INDICE.md`.

Criterio: cada decision se cuenta **una vez**. Si fue superada, se marca `SUPERADA por la NNN`
y se conserva, porque es la evidencia de por que no se repite.

---

- ❌ **Sin Python**: backend estrictamente en PHP (la v1 fue Flask + Python; migrada).
- ✅ **Único panel UI para presets**: la galería inferior expandible de TextMuy es el único
  punto para buscar/guardar/borrar presets. No recrear los antiguos menús.
- ✅ **Formato único para presets**: todo preset es `.txm` (delta de settings) + celda
  en el sprite unico `tm-presets/thumbs.webp` (200x100, sin `.webp` suelto por preset).
  Ya no se usa `localStorage` ni `.json` para guardar.
- ✅ **Separación estricta de datos (v4.0.0)**: todo dato o recurso aportado por el
  administrador reside en `uploads/pmu/` (ámbitos `fonts`, `img`, `tm-presets`; ver §5). La carpeta del plugin y la
  del módulo son reemplazables/actualizables sin perder información. Sin contenido de
  fábrica: el admin crea sus presets y sube sus imágenes.
- ✅ **Módulo integrado (v4.2)**: TextMuy vive en `modules/textmuy/` de este repositorio,
  bajo control total; se edita directamente, se corren sus tests Node y se hace bump
  `?v=RCn` en ambos HTML al tocar su JS.
- ✅ **Layout de PDFs (norma ex-008 vigente, ex-007)**: cada producto vive en
  `uploads/pmu/pdfs/{nombre}/` (`{nombre}.pdf` + `analisis.json` inmutable del Detector +
  `config.json` editable con `activo`/`productos`/`campos_ids`/`preview_omisible`/`placeholders[id]`, clave
  `id` = color hex; sin `textos.json` ni `metadata.json`);
  muestras idempotentes en `tmp/muestras/{nombre}/`; ciclo comprador en `tmp/cart/`
  (legacy) + `tmp/sesion-{sid}/{item_key}/` (vigente, mockup obligatorio en ficha
  `draft-{uuid}` → `cart_item_key` salvo `preview_omisible=true`; canonico = meta item Woo +
  espejo sesion), staging en `tmp/orders/` y entregable en
  `orders/{order_id}/{item_key}/` (PDF final solo tras el pago, boton "Descargar" en
  Descargas + registro admin "completados"); migracion `.migrado-007` ya retirada. La consola nunca muestra la pagina de error critico por fallos
  de recursos del motor (aviso con causa, HTTP 200).
- ✅ **Conciliacion ex-008 (normativa, preservada en `constitution` §IV)** + **spec 005
  (PDF condicionales por producto)**: validez por asociacion PDFxproducto
  (`config.json:tienda{product_id}` con `activo`/`validez`/`mensaje_html`/`bloquear`;
  JS solo en navegador; servidor sanea e intersecta asociacion+activo y congela
  `manifest.pdfs[]` + `pdfs_descartados[]` para auditoria). El antiguo
  `specs/008-sesion-cart-preview/spec.md` NO era feature implementable: normaba 004 vs 007
  (`analisis.json`+`config.json`, `tmp/sesion-{sid}/{item_key}/`, preview obligatoria
  `draft-{uuid}` → `cart_item_key`). Fue eliminado tras preservarse su §0+§6 en la
  constitucion; lo nuevo se alinea a esa norma.
- ✅ **Pool del item con cola por grupo (RC4.6.11)**: las subidas del pool (`personalizador_pdf_pool`)
  de un mismo grupo van **serializadas** (clave `pdf|gid`): el `limpiar` (regeneracion
  idempotente) va PRIMERO y se espera, luego las instancias suben en paralelo. Antes el
  limpiar viajaba en una subida mas de la rafaga y podia ejecutarse DESPUES de subidas
  del mismo grupo, borrandolas: el pool quedaba sin filas (8 textos -> 5, 7 fotos -> 0)
  y la capa del mockup salia gris. La cola serializa tambien entre vistas (dos mockups
  generan en paralelo) y sobrevive a fallos. El `limpiar` se manda solo cuando la corrida
  regenera el grupo COMPLETO (sin render parcial T016), para no borrar las filas
  reusadas. Logica testeable: `PURO.enCola` (`tests/conciliacion.js`).

- ✅ **Vista del cliente sin cajas neutras (RC4.6.11)**: `PMUMockup.componer` acepta
  `huecosTransparentes: true`; con ella un placeholder sin recurso NO dibuja la caja
  gris con el ref (queda transparente). La usa **solo** la ficha (`tienda.js`): al
  cliente nunca se le muestra el marco gris ("FF0000"); la imagen que subio se dibuja
  igual. El editor de mockups del admin conserva el marco (es su pista de diseno).
- ✅ **"Repetir por placeholder" en la vista fusionada (RC4.6.11)**: `vista_grupos()` fusiona
  `repetir` en cada grupo (igual que `datos_pdf_render`); `admin/pdfs.php` pinta el
  checkbox desde `$gm['repetir']`. Antes leia `$m` (variable sin definir) y el checkbox
  SIEMPRE salia desmarcado al recargar (el guardado funcionaba).
- ✅ **Specs historicos**: 004/005/006 con codigo completo 2026-09-28 (004: 33/34, 005: T001–T011,
  006: 27/29; puertas automaticas en verde) y pendiente solo el recorrido manual
  unificado en WP real (`specs/MANUAL-PENDIENTE-WP-REAL.md`, cubre T030+T012+T017+T029
  en una sesion; indice en `specs/INDICE.md`); norma vigente = `constitution` §IV (ex-008); auditoria
  de galeria RC34–RC36 archivada (`specs/_archivo/auditoria-galeria-RC34-RC36.md`,
  sin backlog propio; canonico `modules/textmuy/AGENTS.md`). Las specs obsoletas (003, 007 y el
  diseno 004-2026-09-13) se retiraron el 2026-10-27: quedan en el historial de git.
- ✅ **Spec 009 `galerias-sprite-unificado` (implementada RC46–RC74; reconciliada el 2026-10-24)**: unifica
  las tres galerías del editor (imágenes, tipografías, estilos guardados) sobre un único
  mecanismo de lectura certificada (`thumbs.webp` + `thumbs.sprite_firma`) en los tres
  ámbitos (ver §5). Entrega: (a) certificación de hoja en los **tres** ámbitos en el
  motor + invalidación de la firma al mutar cualquiera de ellos; (b) generación automática
  de **solo los huecos**, con **una única escritura por apertura** (pre-dibujado en memoria y
  un solo `POST op=sprite`; nunca un lote parcial); (c) retiro de los botones "Generar
  miniaturas"/"Miniaturas"; (d) Google Fonts por familia única (sin `text=` ni `wght@`,
  concurrencia acotada, la familia se descarga al elegirla); (e) geometría de celda con
  ratio simplificado y alto completo (fin del recorte de las tiras de tipografías).
  Artefactos en `specs/009-galerias-sprite-unificado/` (checklist 16/16, `plan.md`, `tasks.md`
  T001–T039 con su estado real (`[X]` hecho / `[~]` con desviación o a medias / `[ ]` pendiente); T037–T039 son los huecos de esa revisión). Índice y estado en `specs/INDICE.md`. Al tocarla: enumerar
  primero el Phase 2 del `tasks.md` (certificación en el motor), ya cerrada. Puertas: `php tests/certificacion_hoja.php` (checks A–G), la suite `hoja-generacion` y la puerta de navegador `galerias.browser.js` (Chrome + Playwright). Recorrido E1–E7 **corrido en el laboratorio local con WP real** (`C:\wp-lab`) el 2026-10-24: los siete escenarios en verde, con un **hallazgo** que se corrigio en RC75 (la galeria de fuentes se comia el error: ver `modules/textmuy/AGENTS.md` §7.31 y §11). La causa exacta del motor al cliente quedo cerrada en RC79 (`ThumbEngine.ultimaCausa`). Falta solo confirmar en el hosting real.
- ✅ **Spec 010 `api-wordpress` (especificada, SIN implementar)**: es el objetivo de negocio
  declarado en §1. Endpoint **único** `admin_post_pmu_api` (+ `nopriv`) con dispatcher `op=`
  (`procesar`/`estado`/`limpiar`); **no** se introducen rutas REST ni un segundo camino de
  escritura. Recibe un raster por grupo (PNG/JPG/WebP/GIF; el texto con estilo llega ya
  rasterizado desde el consumidor: el servidor nunca renderiza texto, constitution §III), valida
  los ids contra `analisis.json` y procesa con `Motor::procesar()` **con** dataset. Autenticación
  por **Application Passwords** del núcleo + `manage_options` + HTTPS (no usa `seguridad()`).
  Entregable en el ámbito `api/{job_id}/` (ver §5) con TTL de 7 días, idempotencia por `job_id` y
  respuesta síncrona. Errores con la convención `api:<op>:<motivo>`. Artefactos en
  `specs/010-api-wordpress/` (`spec.md`, `contracts/api.md`); pendiente `plan.md` + `tasks.md`.
  Al implementarla: amendá la constitución (Sync Impact Report), subí `Requires at least` de
  `readme.txt` a **5.6** (Application Passwords) y agregá las fases al arnés `texto_puente.php`.
- ✅ **Spec 018 `campos-consola-v4` (implementada 2026-10-19)**: el cargador se declara en el campo
  (contenedor `[data-pmu-cargador]` + `campo.js` que monta `CargadorPMU` con `PMU_API`), con
  `PMU_API.subirFoto` / `urlDeSubida` / `montarCargador` como contrato público y `PMU_API` creado
  **antes** de montar los campos. El editor expone el `tipo` como `<select>` (el tipo declara, no
  enruta; 015 D11) y pierde `array`, `protegido` y `texto_ayuda`; los títulos del drawer/modal usan
  `.ec-c-nombre-txt`. **Sin migración**: un campo con `cargador` y sin `campo.js` sigue montándose por
  el sistema (`cargador && !campo.js`); al pegarle la plantilla nueva entra solo. Sostiene **N campos
  de imagen por producto/PDF**. Artefactos en `specs/018-campos-consola-v4/` (T001-T023 cerradas;
  pendiente T024: changelog + bump a 4.9.0 y recorrido WP real).

- ✅ **Spec 019 `ranura-adaptativa` (implementada 2026-10-19)**: la ranura del cargador puede
  **tomar el tamaño del hueco** con `phsize: 0|1|2` (0 = default, el comportamiento actual;
  1 = tamaño del grupo; 2 = x2, acotado por `PH_MAX=3000`), resuelto por `PMU_API.montarCargador`
  (`PURO.normalizarRanura`, pura y testeada) y no por el `campo.js`, y el selector **avisa**
  `se amplia Nx` cuando el recorte amplía (informativo, nunca bloquea). `panel_ficha` publica
  `grupo_w`/`grupo_h`/`grupo_gid` en `PMU_FICHA.campos[]` (buscando el grupo por `id` en la lista
  de `analisis.json`) y `validar_cargador()` conserva `phsize`. **`escala: 'sin-ampliar'` sigue
  fuera** (no ampliar la foto exige tocar `engine/Imagen.php` + `tienda.js:rasterizar`, o el Motor
  re-amplía): va como spec aparte. Artefactos en `specs/019-ranura-adaptativa/` (D1-D9,
  FR-001..009, T001-T015 cerradas; pendiente T016: release 4.10.0 + recorrido WP real).
- ✅ **Spec 020 `limpieza-legacy` (implementada 2026-10-19, v4.11.0)**: regla del
  negocio — **en desarrollo no hay migraciones ni retrocompatibilidad** (el admin borra los campos
  viejos y regenera los PDFs). Se eliminaron: `protegido` (feature completa, D1), `array` del
  almacén (D2), `texto_ayuda` (D3), el **cargador legacy** (D4), `datos_con_legacy` (D5), los
  puentes de **tupla v1** (D6) y los formatos muertos: filtro `'Array'`, `envolturas.json` v1,
  `ref` plano de mockups, migración de `bonus` y migración del índice de campos (D7). **NO** toca la
  norma ex-008 ni las features (D8). Artefactos en `specs/020-limpieza-legacy/` (D1-D10,
  T001-T022).
- ✅ **Spec 021 `cargador-visor-cliente` (implementada 2026-10-19, v4.12.0)**: experiencia móvil y PC
  del cargador de imágenes (`assets/selector-pmu.js`, `assets/cargador-pmu.js`, `assets/tienda.js`):
  apertura directa del selector de archivos, `spmu-escena` hasta `1000x1000 px` con relación de
  aspecto fija y **10% de margen interno** (`1.2W x 1.2H`), doble guía (**recorte secundario** =
  placeholder `W x H` donde se corta el PNG; **recorte principal** = forma `'rectangulo'|'circulo'|'cuadrado'|'ovalo'|'auto'`
  o envoltura posicionada con `size`, `ox`, `oy`), **3 modos** (`Rellenar`/`Ajustar`/`Estirar`) con
  **regla del 5%** (<=5% muestra solo `Estirar` y oculta `Girar`; >5% muestra los 3 modos y `Girar`
  si la ranura declara `{ r: 1 }`), control **Reducir / Ampliar** con reset al centro (`0`), color
  de fondo autodetectado por los bordes de la imagen (o transparente si hay transparencia), botón
  **Subir** con aviso `"Subiendo imagen..."` y pregunta `"¿Querés subir otra imagen?"` si quedan
  espacios, y **mini galería fullscreen (`cpmu-visor`)** al tocar las miniaturas subidas (flechas,
  Eliminar y Reemplazar con retorno al visor si cancela).
  **Limpieza de la tira**: se retiraron el botón **"Listo"** (decorativo: sin acción y sin bloquear
  nada), el texto `"Listo: N imagen(es)."`, el encabezado técnico de la ranura y la guía de la
  envoltura de la tira; el botón de cargar dice **"Cargar imagen"** y el aviso de faltantes aparece
  **solo si falta** alguna foto. Los datos técnicos (medidas/forma/min y avisos de configuración)
  se muestran **solo con `tecnico: true`**, que es lo que pasa el preview de la consola
  (`assets/admin.js:apiPreview`).
- ✅ **Spec 022 `minimo-fotos-obligatorio` (implementada 2026-10-19, v4.13.0)**: el **`min` de las
  ranuras frena la compra**. Hallazgo: el botón "Listo" de la 012 era decorativo y
  `carrito_validar()` no contaba las fotos, así que se podía comprar **sin subir ninguna imagen**.
  Doble red: (a) la **ficha** deshabilita "Agregar al carrito" y muestra un único aviso
  (`Faltan N foto(s) por cargar.`); (b) el **servidor** rechaza el add-to-cart. Como el servidor
  **no puede leer las ranuras** (viven en el `campo.js` y PHP nunca evalúa JS, constitution §III),
  el navegador declara `pmu_minimos = {campo: minTotal}` (`CargadorPMU.estadoActual().minTotal`) y
  el servidor **cuenta los archivos REALES** del item (`manifest.subidas[]`; un id sin archivo no
  cuenta), con **cap 50** y **fail-safe sin declaración** (flujo sin JS intacto). Puerta nueva:
  fase **`minimos`** (6 checks: rechazo real, fail-safe, conteo real, id fantasma, saneo/cap) +
  `minTotal` en `campos-contrato`. Límite aceptado (D7): es regla de **calidad del pedido**, no
  anti-fraude; una regla infalsificable exigiría duplicar las ranuras en `datos.json`.
- ⚠️ **Spec 023 `escala-sin-ampliar` (implementada 2026-10-19, v4.14.0; SUPERADA por la 025)**: la ranura podia declarar
  **`escala: 'ampliar' | 'sin-ampliar'`** (default `'ampliar'` = histórico). Con `'sin-ampliar'` la

  foto **nunca se escala hacia arriba**: ocupa su **tamaño natural** dentro del lienzo `W x H`,
  centrada, y el resto queda para el color de fondo. En el modal se ocultan los **3 modos** y
  **Girar** (el modo queda en `ajustar`), el slider **capa a `1x`** (solo reduce) y el badge dice
  **`sin ampliar`**. **Clave del alcance**: la 019 decía que había que tocar el Motor, pero **no
  hace falta** — el PNG sigue midiendo `W x H` (la foto ocupa menos adentro), así que
  `Imagen::normalizar` encaja **1:1** y no re-amplía. Un PNG **menor** que el hueco sigue fuera
  (eso sí exigiría `engine/Imagen.php` + Overlay + contrato del pool). Función pura
  `SelectorPMU.puro.escalaBase()` (cap a 1) con 4 checks en `selector-contrato`.
- ✅ **Spec 024 `ajustes-modal-selector` (implementada 2026-10-20, v4.15.0)**: pulido del modal.
  **Controles en 3 filas**: los **3 modos** a la izquierda (mismo ancho, **resetean la `Escala`**),
  **`Escala`** al 100% **sin botón de reset**, y `Fondo` con **icono damero** + **icono `auto`**
  (visible solo si el fondo no es automático, vuelve al color detectado por bordes) con **`Girar`**
  a la derecha (visible solo con `r: 1` **y** lienzo no cuadrado). **Acciones** separadas
  (`Cargar imagen` izquierda; `Cancelar` + `Subir` derecha).
  **Título** `Ajuste la imagen` sin medidas y **badge de salida solo con `tecnico: true`**.
  **Guía sin velos**: se eliminaron los dos rellenos negros (35% + 32%), así que la zona libre
  queda **transparente** y solo se dibujan los contornos; un **ojito** dentro de la escena alterna
  una **máscara blanca pura `#fff`** fuera de la forma para ver **solo el recorte** (con el contorno
  del placeholder en gris), y **solo aparece si la forma recorta** — decidido por **tipo de forma**
  (`tipo !== 'rectangulo'` / `size < 1` / `ox`/`oy`), no por la caja. La máscara vive **solo** en el
  canvas guía: **el PNG de salida y el Motor no cambian**. Estado del ojito: arranca apagado.
  **Fix 4.15.1**: `.spmu-caja [hidden]{display:none !important}` (WordPress pisaba `hidden` con
  `.button`, y por eso `auto`/`Girar` se veían siempre); al girar se recalcula el 5% para no deformar
  en `Estirar`.
  **Fix 4.15.2**: el **ojito responde al click** (el `pointerdown` de la escena arrancaba el arrastre
  y hacía `setPointerCapture`, así que el `click` no llegaba al botón: solo funcionaba con Espacio;
  se corta con `stopPropagation` + guard `ojo.contains(e.target)`), y el **zoom crece desde el centro
  de la forma** (`origenDibujo` con `geo.principal.cx/cy`), no del placeholder — con la forma
  centrada el resultado es idéntico al anterior.
  **Fix 4.15.3**: el desplazamiento del comprador se **escala por el zoom** (`desp * zoom`) dentro de
  `origenDibujo`: sin eso el punto fijo seguía siendo el **centro de la imagen**, y al arrastrar y
  ampliar el contenido bajo el centro de la forma se corría (el check de invariancia da `-50 / -50 / -50`).
- ⚠️ **Spec 025 `png-resolucion-foto` (v4.16.0) — SUPERADA por la 028**: redefinió los 3 modos
  ("Rellenar = recortar al aspecto **sin ampliar**", "Ajustar = contain capado a 1", "Estirar =
  lado mayor") y el PNG como `min(caja, lienzo)`. Las palabras eran **ambiguas** y esa lectura quedó
  **codificada en los tests con ejemplos** (E1–E6): con una foto más chica que el marco Cubrir
  **dejaba huecos**, y con un lienzo no cuadrado el PNG salía **corrido** (la ventana se centraba en
  el lienzo, no en sí misma). Se conserva como registro.
- ✅ **Spec 028 `modos-lienzo` (implementada 2026-10-20, v4.19.0)**: **los 3 modos se anclan a
  `object-fit`** y se renombran a verbos inequívocos: **Cubrir** (`cover`), **Encajar** (`contain`),
  **Estirar** (`fill`); los ids viejos (`rellenar`/`ajustar`) y los nombres de CSS son **alias** en
  `modoCanonico()`. **El invariante que la 025 leyó al revés**: lo que separa Cubrir de Encajar
  **no es "deformar"** (ninguno deforma) sino **qué hace con el sobrante** — Cubrir **recorta**,
  Encajar **deja fondo**. Está escrito en la tabla (`contracts/modos.md`, docblock de `escalaBase`)
  y **verificado por propiedad** (`tests/selector-contrato.test.js` F2b: *Cubrir nunca deja huecos*,
  *Encajar siempre entra*, *Estirar es el marco exacto*), no por ejemplos. **El PNG mide SIEMPRE el
  LIENZO (`W x H`)** = el tamaño del hueco (`phsize`), y como `Imagen::encajado` es contain+centrado,
  el encaje del Motor es **1:1**: **la vista previa es el PDF** (modo, Escala y desplazamiento
  incluidos). Vuelve la **Escala 0.25x–4x** (la base la fija el modo). La **regla del 5% se
  conserva**: con el aspecto ya encajado queda **un** botón, **"Ajustar al marco"**, que **no es un

  modo sino un RE-ENCUADRE** (modo del caso + Escala 1x + sin desplazamiento); con >5% se muestran
  los 3, con default **`cubrir`** (y `estirar` en el caso ≤5%). Al girar se recalcula el 5% y, si
  estaba en `estirar`, pasa a `cubrir` (no deformar sin querer). Aviso nuevo: `phsize: 0` con un
  lienzo distinto del hueco del grupo (el Motor reencajaría la composición). **El Motor y el
  servidor no se tocan.**
  **D11 (tope de resolución)**: el PNG mide el lienzo **acotado a la resolución de la foto**:
  `k = min(1, max(iw,ih)/max(caja))` (`escalaSalida()`, pura) y el archivo mide `round(W·k) x
  round(H·k)` — **nunca supera el lienzo ni amplía la foto** (no inventa píxeles, sin piso). El
  factor es **uniforme**, así que el PNG conserva el **aspecto del lienzo** y el Motor lo escala
  uniforme: el **encuadre no cambia** (modo/Escala/desplazamiento intactos) y **la vista previa
  sigue siendo el PDF**; sólo baja la resolución, que es la que el PDF podría mostrar. Con una foto
  **grande** `k = 1` (el caso típico no cambia). La **Escala multiplica la caja**: acercar **baja**
  `k`. Caso real: 400×300 en 1000×1000 → Cubrir **300×300**, Encajar **400×400**, Estirar
  **400×400** (antes 1000×1000: ~11x de peso de más).
- ✅ **Spec 029 `pool-sin-copias` (implementada 2026-10-20, v4.20.0)**: **el pool guarda solo lo
  que se GENERA** (el texto de TextMuy) y **las fotos del comprador se referencian**, no se
  copian. Antes, con 1 grupo × 100 instancias y una foto + un texto, la vista previa creaba
  **200 archivos**: `PURO.conciliarGrupo()` devuelve una copia del valor único **por instancia**,
  y cada entrada se bajaba, se rasterizaba al hueco y se subía (el texto, además, se renderizaba
  100 veces). Ahora: **1 POST por grupo** con los ids por instancia (`registrar_fotos`, **sin
  bytes**) y la fila apunta a `subidas/{id}.{ext}` (`origen: 'subida'`); el texto uniforme se
  renderiza y se sube **una vez** (`dedupPendientes`, `repite`) con `indice` 0 (el Motor la
  replica a todo el grupo, como ya hacía `item_generar_pdfs` con una sola fila). El `indice` pasa
  a ser la **posición de instancia** (antes era el número de archivo: con instancias subidas en
  paralelo el PDF podía asignar la foto equivocada). Sin `rasterizar` ya no hay recompresión
  WebP→WebP ni copias: **200 archivos → 2** en el caso real. **El Motor y el formato del pedido
  no cambian** (el árbol del item viaja entero, así que `subidas/` está en `orders/`).
  **D7 (poda)**: `PMU_Sesion::podar_subidas()` conserva una subida si la usa **una fila** de
  `archivos[]` (`origen: 'subida'`) **o** algún **`valores`** del manifest (el estado vivo que la
  vista previa acaba de refrescar) y **borra el resto** (archivo + fila); sin filas ni valores
  **no borra nada**. Se llama al final de `registrar_fotos()` y en `handle_vista_previa`, así que
  reemplazar o quitar una foto limpia el archivo viejo en la misma corrida.
  Puerta: fase `fotos` del arnés (14 checks: 9 de D1-D3 + 5 de D7) + 3 checks en `selector-contrato`.
- ✅ **Spec 027 `transparencia-campo` (implementada 2026-10-20, v4.17.0)**: **la politica de
  transparencia la declara el `campo.js`** (no el comprador). La ranura acepta `transp: 'si'|'no'`
  (**ausente = comportamiento actual**: el cliente decide con el boton "damero"). Con `transp:'no'`
  el boton "damero" **se oculta** y el fondo **nunca** es transparente (el "auto" cae a **blanco
  puro** `#ffffff`, o al color solido que propongan los bordes); con `transp:'si'` se aplica la
  cadena completa y **solo si se cumplen todas** las condiciones se sube con alfa: (a) el archivo
  soporta transparencia (PNG/WebP; JPEG no), (b) hay una **capa de alfa real** (cualquier pixel
  con `a < 250` en **toda** la imagen, no solo en el perimetro), (c) el "auto" resuelve a
  transparente, (d) el fondo final es transparente (si el comprador elige un color a mano, la
  imagen sale **opaca**). La logica vive en la funcion **pura** `SelectorPMU.puro.resolverFondo()`
  (testeable en Node). **Sin migracion** y **sin tocar el servidor** (spec 020 D4: el cargador ya
  no se valida en PHP; constitution §III). **Ortogonal a la 026** (`imagenes-webp`): el alfa
  viaja igual en PNG y en WebP.
- ✅ **Spec 026 `imagenes-webp` (implementada 2026-10-20, v4.18.0)**: **las imagenes se guardan en
  WebP** (antes todo PNG: la foto del comprador pesaba ~1.3 MB; ahora ~120 KB). El **cliente**
  emite WebP con `canvas.toBlob('image/webp', q)`: **q0.85** para las fotos del comprador y
  **q0.92** para el pool (el texto renderizado tiene bordes con antialias). El **servidor**

  (`PMU_Sesion::convertir_webp()`) convierte como red de seguridad si el cliente mando PNG, y
  **nunca** recomprime un WebP que ya viene listo. El formato se decide **siempre por la firma de
  los bytes** (`firma_imagen()`), nunca por el nombre. **Defensa en profundidad**: el cliente solo
  envia WebP si `PMU_FICHA.webp_soportado` (`PMU_Sesion::servidor_lee_webp()`, GD +
  `imagecreatefromwebp`) lo permite, y si llega un WebP ilegible se rechaza con
  `motor:imagen:webp:no_soportado` (sin GD el Motor no podria decodificarlo y el PDF saldria
  roto). **Sin migracion**: `guardar_png()` sigue existiendo como alias de `guardar_imagen()`
  (la extension sale de la firma) y `siguiente_n()`/`limpiar_grupo()` cuentan/borran **todos** los
  formatos. **El Motor no cambio** (ya leia WebP) y **el PDF final es estructuralmente identico**
  (smoke: WebP con alfa -> raster + SMask igual).
- ✅ **Hooks legacy retirados**: los hooks y el nonce historico `extractor_corel_*`
  (<= 2.0.0) ya no existen; `seguridad()` solo acepta `personalizador_pdf_*`.
- ✅ **Spec 030 `biblioteca-imagenes` (implementada, v4.22.3)**: el comprador **ve y reusa** sus fotos
  desde la ficha. La **tira** vive SIEMPRE visible en el modal (montada al abrir, adaptada al ancho, sin
  scroll, tile `N+` al resto) y **tocar** una miniatura abre el **visor compartido** (`Elegir`/`Borrar`).
  **Elegir sin recomponer = 0 bytes**: `op=usar` escribe una fila `origen: ref` (o copia desde `tmp`)
  **solo si** la `receta` del hueco esta entre las de la familia — la decide el **servidor** (el cliente
  no puede mentir, §III); si difiere, el primario dice `Subir` y entra una **version** `{madre}-{n}`. La
  `receta` se **estampa tambien al subir** (sin eso, una familia nacida de una subida nunca podia ser
  Elegible). **Dedupe por `sha`** del contenido CRUDO al subir, **familias** (`{madre}-{n}`, `base`
  **DERIVADA** por area) en `PMU_Sesion` (**duenio unico**, D1/§II), **referencias entre pedidos**
  (`ref` relativo a `uploads/pmu/`; si falta, `motor:descarga:ref:ausente` = hueco transparente),
  **borrado** de la familia completa con aviso de `usos` (sin contar el item en edicion) y
  **vencimiento por ITEM** (`limpiar_ttl`: drafts 24 h / carrito abandonado 30 dias) con **cron diario**.
  La copia del cliente es `pmu_bib_v2` (metadatos, nunca bytes) revalidada por `revision`, con
  **auto-sanado** si dice `fotos: []` y el servidor responde `sin_cambios`. Puertas: fase `biblioteca`
  del arnes + `tests/biblioteca-contrato.test.js`. Contratos en
  `specs/030-biblioteca-imagenes/contracts/{biblioteca,cliente-biblioteca}.md`.
- ✅ **Spec 031 `editor-mockups-panel` (implementada 2026-10-26, v4.23.0)**: rediseno del PANEL del
  editor de mockups (`assets/mockups.js` + `assets/admin.css`), sin tocar datos ni motor. El panel
  derecho son **5 acordeones cerrados** (Vistas del PDF / Capas / Ajustes / Imagenes / Placeholders);
  la **transformacion de la seleccion** (x/y/ancho/alto/rotacion + envoltura + alinear + distribuir)
  vive **bajo el lienzo** (`.ec-mk-transformar`) y aparece con la seleccion; los **ajustes de capa**
  (filtros/modo/nombre/restablecer/perspectiva) se repintan con `pintarAjustes()` en su acordeon.
  **Capas agrupadas**: cada `capa.grupo` se lista en un `details.ec-mk-grupo-capas` (cabecera =
  miniatura + "Grupo (N capas)" que **selecciona** el grupo sin plegar; el plegado tiene chevron
  propio) y las capas sin grupo van a `.ec-mk-sueltas`; la fila sale de una sola funcion
  (`filaCapa`) y el array, el orden z y `moverCapa` **no cambian**. **Menu contextual**
  (`contextmenu` en fila y cabecera, mas el boton `...` de fila): un unico nodo `.ec-mk-menu-ctx`
  con items `[data-ctx]` y `aria-disabled`; reutiliza las funciones vigentes (`duplicarCapa`,
  `borrarCapa`, `agruparSeleccion`, `desagruparSeleccion`, toggles oculta/bloqueada) y suma las
  acciones de grupo (Desagrupar / Ocultar / Mostrar / Quitar el grupo). Cierra por `pointerdown`
  de fuera, **Escape** (que con el menu abierto cierra SOLO el menu: `stopImmediatePropagation`)
  y scroll. Los **5** botones sobrantes de Capas (+Imagen, +Placeholder, Subir, Bajar, Duplicar,
  Quitar, Agrupar, Desagrupar) se retiraron; agregar es un clic en el item del catalogo o en la
  instancia del PH. **Paridad del tirador de rotacion de CAPA**: nueva `puntoRotacionCapa()` con
  `G.extremoVisible` (clip radial al lienzo, como el grupal); dibujo y hit-test comparten el punto.
  **Spec 009 intacta**: los 5 acordeones llevan **clase propia** `.ec-mk-acordeon` para no disparar
  el confirm de cambios sin guardar (que atrapa `.ec-acordeon > summary`). Puertas: contrato Node
  147 checks, `EXTREMO`/`GEOMETRIA` 135, y los probes E1-E6 contra `C:\wp-lab` (E1 10/10, E2 13/13,

  E3 12/12, E4 11/11, E5 9/9, E8 8/8, E6 5/5). Artefactos en `specs/031-editor-mockups-panel/`.
- ✅ **Spec 032 `reemplazo-pdf` (implementada 2026-10-26, v4.24.0)**: subir una **version nueva** del PDF de
  un producto **sin perder** la personalizacion, los mockups, los bonus ni las conexiones. **Swap por
  ARCHIVO** (nunca por carpeta: con no borrarla, todo lo demas sobrevive solo), **staging** previo (si el
  analisis falla, cero cambios) y **dos pasos** con **modal**: `preparar` devuelve el **mapa**
  viejo→nuevo (ids iguales + **sugerencias** con IoU de `dev_bbox` normalizada al box de pagina y
  **distancia de color** euclidea en RGB como PESO, no filtro: un rediseno cambia el color a proposito)
  y el admin decide **Migrar o Cancelar**. Al migrar: **respaldo** de los 4 archivos en
  `tmp/reemplazos/{nombre}/{ts}/anterior/`, swap y `config.json` **remapeado** (`placeholders{id}`,
  `envolturas{gid:{forma:k}}` revalidado y `mockups[].capas[].ref`); un fallo a mitad **restaura del
  respaldo**. `recuperar` vuelve **byte a byte** y conserva el respaldo. El **mismo remapeo** corre
  ahora en **Re-analizar** (arregla el bug latente de `envolturas{k}` y refs de capa). Endpoints
  `admin_post_personalizador_pdf_reemplazar_{preparar,confirmar,recuperar}`; UI en "2. PDFs subidos"
  (boton por fila, modal del mapa, Recuperar) y el `sobrescribir` del modal de conflicto reescrito a
  **"Reemplazar (conserva la personalizacion)"** (el camino destructivo se retiro). **Funciones puras**
  en `Metadata` (`mapaDeReemplazo`/`remapearConfig`/`distanciaColor`). Puertas: fase `reemplazo` del
  arnes (**24 checks**: mapa + remapeo + la transaccion con md5 + TTL) y contrato Node 147/geometria 135.
  Ojo: la subida real de un PDF **no** se puede simular en el arnes (`move_uploaded_file` exige un upload
  real) -> el flujo con subida se prueba en el lab (quickstart R1-R8). Artefactos en
  `specs/032-reemplazo-pdf/`.
- ✅ **Spec 034 `importar-reemplazar-capa` (especificada 2026-10-26; implementada en curso en 4.25.0: 12/17 tareas cerradas, 1 parcial, 4 pendientes — ver `tasks.md`)**: reemplazar la capa/grupo seleccionado con otra capa (pagina PDF o imagen) manteniendo las transformaciones (x/y/w/h/rot/sesgo/filtros/modo/nombre/oculta/bloqueada/envoltura/grupo/grupo_rot/perspectiva); habilitar perspectiva por capa individual (hoy solo grupo); importar pagina + PH pregunta si reemplazar la seleccion actual; destino es la capa/grupo seleccionado (si varias capas no agrupadas, la primera); conserva ubicacion, rotacion y perspectiva. Artefactos en `specs/034-importar-reemplazar-capa/` (spec, plan, research, data-model, contracts/capa-importar, quickstart, tasks).
- ✅ **Jerarquia documental**: `constitution` > este AGENTS.md > resto (`readme.txt`,
  `admin/ayuda.php`, `modules/LEEME.md` solo resumen y apuntan aqui). El `== Changelog ==`
  de `readme.txt` es historial, no normativa.
