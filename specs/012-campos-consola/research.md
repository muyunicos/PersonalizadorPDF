# Research: campos-consola

**Feature**: 012-campos-consola | **Fecha**: 2026-10-04

Cada decision con su alternativa descartada y el motivo. Las marcadas **[CERRADA]** son
decisiones de producto tomadas por el usuario en las rondas de preguntas.

---

## R1 - Donde vive la definicion de un campo: `campos.json` plano vs archivos por campo **[CERRADA]**

- **Elegido**: indice (`campos.json`) + carpeta por campo (`campos/{id}/campo.htm|css|js`).
- **Descartado**: seguir todo en `campos.json`.
- **Por que**: con el indice plano, cambiar **un** campo reescribe el catalogo entero y obliga a
  invalidar la cache de toda la ficha. Con archivos, `campo.htm?v={modificado}` delega la
  invalidacion al cache del navegador: si el comprador tiene la ficha cacheada, al cambiar un campo
  solo se recarga ese `campo.htm`. Ventaja extra: el catalogo se puede leer y editar a mano.
- **Coste**: un `campos.json` y una carpeta por campo en `uploads/`; la migracion v1 -> v2 es
  obligatoria (D10).

## R2 - Preview del campo: inline vs iframe srcdoc vs producto real **[CERRADA]**

- **Elegido**: `<iframe srcdoc>` de 350px con el CSS del tema ya encolado en la pagina del admin.
- **Descartado**: montar el preview en el DOM del admin.
  - Riesgo: un `campo.css` runaway (`.wrap{display:none}`, `body{font-size:99px}`) deja la
    **consola inservible** y el admin no puede ni guardar el campo. El iframe aisla por completo.
- **Descartado**: cargar un producto real de prueba.
  - Depende de que exista un producto con ese PDF vinculado, de la sesion, del carrito... Si el
    producto no existe, el preview no abre. Demasiado fragil para una herramienta diaria.
- **Por que 350px**: es el `max-width` real de `.pmu-panel` (verificado en `tienda.js`), o sea el
  ancho exacto que ve el comprador.

## R3 - Ejecutar el `campo.js` en el admin **[CERRADA]**

- **Elegido**: `new Function('ctx','root', 'return (' + js + ')(ctx, root)')`, identico a
  `tienda.js:281`, dentro de `try/catch`.
- **Descartado**: no ejecutar el JS (solo mostrar el HTML).
  - Un campo complejo (el de "guia paso a paso" que quiere el usuario) se comporta muy distinto
    con y sin JS; probar sin el es probar otra cosa.
- **Descartado**: ejecutar en un Web Worker.
  - El campo toca el DOM de su `root`; el Worker no tiene DOM. No aplica.
- **Riesgo asumido**: es el mismo `new Function` que ya corre en el front del comprador. El filtro
  real es `validar_script_campo()` en el servidor (`class-pmu-uploads.php:534`), que corre en
  `campo_alta`/`campo_editar`: el navegador nunca reemplaza esa validacion.
- **Mitigacion**: el preview va en el iframe, asi que un `script` que rompa el documento afecta al
  iframe, no al admin.

## R4 - Como expone un campo su valor sin escribir JS: `data-rol` vs primer input **[CERRADA]**

- **Elegido**: `data-rol="valor"` / `data-rol="cliente"`, con el **primer input** como fallback.
- **Descartado**: exigir `campo.js` siempre.
  - obliga al admin a escribir JS para un simple input de texto, que es el caso mas comun.
- **Descartado**: una tabla de "variables" declarativa en la ficha (tipo form).
  - Multiplicaria el formato de datos por cada tipo de campo, cuando hoy todo es HTML libre y el
    admin ya esta acostumbrado a escribir HTML.

## R5 - Prioridad del `cliente`: campo vs global **[CERRADA]** (revisada por D21)

- **Elegido (final)**: `campo.js` > `data-rol` > **vacio**. El sistema **no traduce nada**.
- **Por que el `script` del campo manda**: es el unico canal de salida segun el contrato v1
  (`campos.md:63`); romperlo seria una ruptura de contrato.
- **Por que NO hay tabla de traduccion** (D21, el usuario la rechazo explicitamente): una tabla fija
  limitaba al admin a pares valor->texto y no permitia logica (mirar el campo, contar, mirar el
  contexto). Con `global.js` libre, cualquier regla es posible.
- **Ejemplo del usuario**: un selector de color devuelve `0000FF`; el admin quiere que en el carrito
  diga "Azul". Lo escribe **entero en `global.js`** (su `f-color`), no en una tabla del sistema.
- **Coste asumido**: si el admin no escribe nada, `cliente` queda **vacio** y la linea del carrito
  sale vacia. Es preferible a que el sistema invente una traduccion o muestre `valor` crudo (que el
  contrato veta).

## R6 - CSS/JS global: uno del plugin vs uno por PDF **[CERRADA]**

- **Elegido**: **uno solo** del plugin.
- **Descartado**: uno por PDF. El usuario lo confirmo dos veces ("uno global del plugin").
- **Por que el CSS va prefijado con `[data-pmu-panel]`**: el global es el archivo mas peligroso del
  sistema (afecta toda la ficha). Con prefijo, un `body{...}` del admin no puede romper el checkout
  ni la pagina del producto; solo afecta al panel de campos, que es lo que quiere estilar.
- **Decision de seguridad**: el global se encola **solo si el panel tiene >= 1 campo** (FR-025), no
  en toda pagina con WooCommerce.

## R7 - Cargador: extender `SelectorPMU` vs componente nuevo `CargadorPMU` **[CERRADA]**

- **Elegido**: `CargadorPMU` nuevo que **usa** `SelectorPMU` por dentro (una instancia por ranura).
- **Descartado**: ampliar `SelectorPMU` a multi-ranura.
  - `selector-pmu.js` y su contrato (`004/contracts/selector-pmu.md`) ya estan en produccion y su
    API es de **una** imagen ("entrega el blob al llamador"). Enredar "N ranuras" ahi cambia el
    contrato vigente por una necesidad nueva.
- **Descartado**: subir la foto cruda y que el Motor recorte.
  - El Motor no tiene GD garantizado (Const. II: PHP puro, sin GD) y el recorte del cliente es
    justamente lo que hace `SelectorPMU` en Canvas. Ademas el usuario quiere que el cliente vea y
    ajuste **antes** de subir.

## R8 - Donde viven las imagenes que sube el cliente **[CERRADA]**

- **Elegido**: `tmp/sesion-{sid}/{item_key}/subidas/{id}.{ext}` + `manifest.subidas[]`.
- **Descartado A**: el catalogo global `uploads/pmu/img/`.
  - Un solo item con las fotos de **todos** los clientes; mezcla datos, rompe el aislamiento por
    item y podria exponer fotos de un comprador en otro pedido.
- **Descartado B**: el pool `img/{pdf}-{grupo}-{n}.png` que ya existe.
  - `handle_pool_png()` valida que el grupo exista en el dataset (`personalizador-pdf.php:1086-1095`)
    y guarda `archivos[]` con `grupo_id`: esta indexado **por hueco**, no por carga del cliente.
    Meter ahi las fotos del comprador las mezclaria con el texto ya renderizado.
- **Por que `tmp/sesion-{sid}/`**: es exactamente la carpeta que el usuario describio ("temporal
  autoexpirable hasta que se hace el pago y ahi se mueven a un archivo"). Al pagar, `rename()`
  mueve la carpeta entera y `subidas/` viaja con el pedido **sin trabajo extra** (FR-035).

## R9 - Binding campo -> placeholder: `[campoN]` vs `campo_img` **[CERRADA]**

- **Elegido**: `[campoN]` en el placeholder, con **tipo `imagen`** (D11).
- **Descartado**: `p[gid].campo_img = <id>`.
  - Un PDF con 2 campos de imagen y 1 solo hueco no tiene como expresar cual va; y `[campoN]` ya
    existe y ya se usa en `value` y `settings` (`tienda.js:28`).
- **Por que `[campoN]` no es ambiguo aca**: el **placeholder ya declara el tipo**. Con
  `tipo = "imagen"`, `[campo55]` significa "las imagenes del campo 55", no texto. El tipo es lo que
  desambigua, no el placeholder (decision explicita del usuario: "este tipo lo dejamos donde esta
  en Placeholders -> Tipo").
- **Instancias**: `array` + la cantidad `cont` del grupo reparte un id por instancia (mismo criterio
  que el `conciliarGrupo` de texto, `tienda.js:56-83`).

## R10 - N imagenes por grupo en el Motor **[CERRADA]**

- **Elegido**: `$rutasImagenes[$id]` admite `string` (hoy) **o** lista de rutas (una por instancia).
- **Estado actual**: `Motor.php:67-72` normaliza **una** ruta por grupo; `:86` suma `cont` como si
  todas las instancias recibieran la misma imagen.
- **Por que es indispensable**: sin esto, el caso "6 fotos polaroid en 6 huecos del mismo grupo" no
  se puede generar, aunque el campo entregue los 6 ids.
- **Compatibilidad**: `string` mantiene el comportamiento exacto de hoy (consola "Procesar",
  pedidos con un PNG por grupo, `motor_smoke`, `parity`). Solo cambia el caso lista.
- **Riesgo**: es el nucleo mas sensible. Mitigacion: la F7 de `tasks.md` va sola, con `parity.php`
  (PARIDAD OK) y `motor_smoke.php` como puertas obligatorias.

## R11 - Dar de baja un campo: borrar vs conservar con bandera **[CERRADA]**

- **Elegido**: `items[id].baja = true`; los archivos y `datos.json` **se conservan**.
- **Problema que resuelve**: hoy `campo_baja()` escribe el tombstone `[id,"",""]`
  (`class-pmu-uploads.php:587`), que **destruye** nombre, HTML, CSS y JS, y no hay forma de
  recuperarlos.
- **Descartado**: papelera con carpeta aparte.
  - Multiplica el estado (activo / en papelera / borrado) por un beneficio que `baja:true` ya da.
- **Compatibilidad**: el tombstone v1 `[id,"",""]` se migra a `baja:true`; un campo v1 con ese
  formato se lee como dado de baja (mismo comportamiento observable que hoy).

## R12 - Que es el "tipo" de un campo **[CERRADA]**

- **Elegido**: **el campo no tiene `tipo`**. El tipo vive solo en el placeholder; en el campo queda
  `items[].plantilla`, que es info de origen ("nacio de la plantilla `select`"), no comportamiento.
- **Motivo**: hoy el enum `text|textarea|select|img|override` **no hace nada**
  (`montarCampos()` no lee `campo.tipo`), y ademas el contrato v1 declaraba otro enum distinto
  (`texto|imagen|override`): una divergencia que nadie noto justamente porque el campo es
  decorativo.
- **Lo que si queda**: la plantilla decide el HTML/CSS/JS inicial y el `cargador`. El resto es
  HTML libre que el admin edita (D5).

---

*Las decisiones D13-D19 surgieron en `/speckit-clarify` y se documentan aqui como R13-R16 para que
el Phase 0 quede cerrado.*

## R13 - Exposicion de las fotos del comprador: URL publica vs endpoint con nonce **[CERRADA]**

- **Elegido**: URL publica de `uploads/`, con la **misma proteccion que el pool actual** (D13): el
  secreto es el par `sid` (uuid v4 en cookie) + `item_key`.
- **Descartado**: endpoint PHP con nonce.
  - `handle_vista_previa()` ya devuelve `pool_url` al navegador (`personalizador-pdf.php:978`) y
    `tienda.js:806` lo usa para recomponer los mockups desde los PNGs ya subidos (`poolPrevio()`).
    Un endpoint para las fotos seria una **segunda ruta** para el mismo problema.
- **Descartado**: thumbnails derivados / cifrado / carpeta fuera del webroot.
- **Por que**: no se sube el liston de proteccion respecto del pool vigente; las fotos son
  accesibles solo para quien tenga el link del item, y ese par no es enumerable.

## R14 - Formato de la foto del comprador: PNG vs WebP vs JPEG **[CERRADA]**

- **Elegido**: **WebP** (D14).
- **Por que**: el `SelectorPMU` recorta y redimensiona en el navegador, asi que el peso ya lo
  limita el `size` de la ranura, no el formato. WebP comprime mas y mantiene transparencia (util en
  recortes circulares). WebP **ya** es formato aceptado en todo el sistema (allowlist en
  `personalizador-pdf.php:321`, `:2261`, `:2846`) y las vistas congeladas ya son `.webp`.
- **Dependencia verificada**: el Motor decodifica WebP **solo con GD** (`engine/Imagen.php:73`
  lanza *"Formato de imagen no soportado sin GD (webp)"* en `viaPngPuro`). El hosting del usuario
  tiene **GD 2.3.3 con WebP lectura/escritura** (verificado). Se agrega un check en
  `smoke_checks()` (T022b) para que un cambio de hosting se detecte antes de un pedido fallido.
- **Descartado**: JPEG. El Motor lo incrusta directo (`dct`), pero pierde transparencia, que justo
  necesita el recorte circular de una ranura `forma: circle`.
- **Descartado**: PNG. Es el camino seguro sin GD, pero pesa mas sin aportar nada aqui.

## R15 - Reparto entre instancias: bloquear, ciclar o dejar vacias **[CERRADA]**

- **Elegido** (D17/D18/D19): con `repetir` el `idx` **cicla** modulo el largo del array; sin
  `repetir`, las instancias sobrantes quedan **vacias**; **nunca** se bloquea la compra ni se avisa,
  para texto e imagenes por igual.
- **Estado actual que cambia**: `PURO.conciliarGrupo()` (`assets/tienda.js:71-79`) hoy devuelve
  `aviso` + `textos: []` cuando N != M, lo que **frena la compra**; y `resolverPlantilla` (`:32-35`)
  devuelve `''` al pasar la lista, sin ciclar.
- **Descartado**: mantener el bloqueo. El placeholder **no exige** N = cont (confirmado por el
  usuario): la validacion real es el `min` del modal (D16). Bloquear contradice la politica
  vigente del sistema de que los errores no frenan la venta.
- **Por que ciclar**: el `repetir` con un solo valor ya repite hoy; extenderlo a N valores es la
  misma regla y evita el "3 de 8" en un producto donde el cliente subio 3 fotos a proposito.

## R16 - Ids de las fotos: nombre del cliente vs uuid del servidor **[CERRADA]**

- **Elegido**: **uuid corto del servidor** en `subidas/{id}.webp`, con la fila en
  `manifest.subidas[]` (D13, `data-model.md` §6).
- **Descartado**: que el cliente mande el nombre. Aunque el `handle_pool_png` ya sanea, el nombre
  viene del navegador y abriria la puerta a traversal; el servidor genera el id y el nombre se
  deriva de el.
- **Por que** un id y no el hash del contenido: el pool de grupos usa `hash` para deduplicar renders,
  pero aca cada subida es un archivo distinto que el comprador quiere volver a ver (re-edicion); un
  id opaco y estable evita colisiones y permite reordenar sin recalcular.
