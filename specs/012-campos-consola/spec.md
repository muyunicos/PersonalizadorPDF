# Feature Specification: campos-consola

**Feature Branch**: `main`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "fijate si hay algun spec para pulir mas la pestaña campos, o hacemos
uno nuevo?" -> no hay ninguno, asi que se crea esta. La imagen del campo (nombre de admin vs
titulo cliente, HTML vs datos, cargador de imagenes con N ranuras, CSS/JS global) se fue cerrando
en 4 rondas de preguntas antes de redactar.

## Que es un campo (modelo cerrado)

Un **campo** es una pieza de UI reutilizable que el sistema le muestra al comprador para que
personalice. El mismo campo se usa en N PDFs y por lo tanto en N productos. El campo publica un
**valor dual**:

| Salida | Quien la consume | Regla |
|--------|------------------|-------|
| `valor` | el Motor (via `[campoN]` en `placeholders[id]`, o como id de imagen subida) | nunca se muestra cruda al cliente |
| `cliente` | carrito, checkout, resumen, pedido | nunca se procesa en el PDF |

El destino del valor lo elige **el admin a mano** en la consola del PDF (modo codigo con
`[campoN]`, `settings` con overrides de TextMuy, o `Validez` para decidir que PDF se entrega).
  > **Nota (spec 015, 2026-10-05): la parte de `settings` **no funcionaba** cuando se
  > escribio esto.** Los overrides nunca llegaban al render. Se implementa en la 015,
  > que ademas cambia el formato: `settings` pasa a ser **solo** una lista de
  > referencias y cada `valor` de campo se parsea como JSON. `value` y `Validez`
  > sí funcionan como se describe.
El campo no sabe nada del PDF: es agnostico.

### Los tres textos de un campo (nombres corregidos por el usuario)

| Dato | Para quien | Ejemplo |
|------|-----------|---------|
| **nombre** | solo admin: pestana Campos, "3. Personalizacion -> Campos", buscadores | "Fotos polaroid cuadradas x6" |
| **descripcion** | solo admin, texto libre | "6 fotos para el tarjetero GX-10" |
| **titulo_cliente** | carrito, checkout, resumen, pedido: **el nombre de la personalizacion** | "Seleccion" |

**El titulo que ve el cliente arriba del campo NO es un dato del campo**: es HTML que escribe el
admin dentro de `campo.htm`. Por eso desaparece el `<p class="pmu-campo-titulo">` que hoy inyecta
`assets/tienda.js:259-262`.

### El par `titulo_cliente` + `cliente` en el carrito (ejemplo real del usuario)

```
Producto: "Etiquetas para condimentos"          <- nombre del producto Woo, no del campo
Seleccion: sal, oregano, pimienta...            <- titulo_cliente + ": " + cliente
Modelo: Rosas                                  <- otro campo, misma regla
```

- **`titulo_cliente`** es la **etiqueta** ("Seleccion"): lo que el admin nombra esa personalizacion.
- **`cliente`** es el **resultado** ("sal, oregano, pimienta..."): lo que eligio el comprador.
- Se pintan como **`titulo_cliente` + ": " + `cliente`**, una linea por campo.
- La linea "Producto: ..." la aporta WooCommerce, no un campo.

### Sin `tipo` en el campo

El `tipo` (texto / codigo / foto) vive **solo en el placeholder** de la consola del PDF
(`admin/pdfs.php`, "Placeholders -> Tipo"). El campo no lo tiene: su salida se define por la
plantilla con la que se creo y por su HTML. El enum viejo (`text|textarea|select|img|override`,
`personalizador-pdf.php:2137`) se elimina.

## Diagnostico del estado actual (verificado en el codigo antes de especificar)

| Hallazgo | Evidencia | Efecto para el admin |
|---|---|---|
| No hay spec de la pestana | `specs/INDICE.md` no registra ninguna; el unico artefacto es `specs/004-.../contracts/campos.md` (contrato de DATOS, ya implementado) | los huecos de UI nunca se documentaron |
| Editar recarga la pagina | `admin/campos.php:41` es un `<a href="?ec_campo_editar=N">`; el formulario se abre en otra card (`:58`) | viola el patron de `AGENTS.md` §3 (solo recargan Subir PDF / Re-analizar / Borrar) |
| Alta en dos pasos | el form "Nuevo campo" (`campos.php:100-115`) solo pide titulo y tipo | crear y despues editar, en dos pantallas |
| No hay prueba del campo | el unico montaje es `assets/tienda.js:246` (la ficha); el admin no tiene equivalente | se escribe HTML/CSS/JS a ciegas |
| No hay buscador ni filtro | la tabla no filtra; el contrato promete "etiquetas para filtrar en el admin" (`contracts/campos.md:41`) | requisito propio del contrato incumplido |
| No se ve el uso | nada indica en cuantos PDFs esta el campo ni cuantos `[campoN]` lo usan | la baja avisa sin detalle |
| La baja destruye el campo | `campo_baja()` (`inc/class-pmu-uploads.php:587`) escribe el tombstone `[id,"",""]` | se pierden titulo, contenido, CSS y script; no hay restaurar |
| El `tipo` no hace nada | `montarCampos()` (`tienda.js:246-300`) **no lee `campo.tipo`** | el tipo es decorativo |
| No hay CSS/JS global | `tienda.js:274-278` inyecta un `<style>` por campo; no existe ningun archivo global | no hay donde poner lo comun |
| El cargador no esta cableado | `assets/selector-pmu.js` esta escrito y encolado (`personalizador-pdf.php:617`) pero **nadie lo instancia**; su `finalW/finalH` son obligatorios (`selector-pmu.js:35`) y `campos_panel()` (`:387-403`) no manda ningun tamano | un campo de imagen no funciona |
| El pool solo acepta PNGs de grupo | `handle_pool_png()` (`personalizador-pdf.php:1086-1095`) valida el grupo contra el dataset y guarda `manifest.archivos[] = {pdf, grupo_id, indice, file, hash}` | el cliente no puede subir una foto propia |
| La ficha solo renderiza texto | `tienda.js:708-716`: por grupo -> `conciliarGrupo` -> texto -> `hashRender` -> `renderBatch` -> `subirPool` | no hay rama de "imagen del cliente" |
| El Motor acepta 1 imagen por grupo | `Motor.php:67-72` normaliza una sola ruta y `:86` suma `cont` instancias | **6 fotos distintas en 6 huecos del mismo grupo es imposible hoy** |
| El cargador no tiene drag & drop | `selector-pmu.js:94-96` solo `<input type=file>` | el modal ya existe con canvas, zoom y arrastre (`contracts/selector-pmu.md`), falta arrastrar el archivo |
| Deriva contrato <-> codigo | `contracts/campos.md:40` declara `texto|imagen|override`; el codigo usa `text|textarea|select|img|override` | el contrato normativo miente |
| Sin puerta de UI | la fase `campos` de `tests/texto_puente.php:931` prueba el CRUD del motor, no la UI | sin red para el cableado cliente |

## Clarifications

### Session 2026-10-04 (D1-D12, cerradas antes de especificar)

- **D1 - El editor se abre en linea dentro de la tabla**, no en card aparte ni en overlay: el admin
  ve la lista y edita sin perder el lugar. Elimina el GET `ec_campo_editar`.
- **D2 - El preview reutiliza el montaje de la ficha**: el montaje se extrae a un modulo cliente
  compartido (`assets/campo-montar.js`, patron `mockup-render.js` de la 011) y lo consumen la
  ficha y la pestana Campos. El admin ve exactamente lo que vera el cliente; no hay segundo
  motor. No se toca el bloque `PURO` de `tienda.js` (testeable en Node).
- **D3 - `new Function` es la unica forma de ejecutar el `script` del campo en el admin**, igual
  que en `tienda.js:281`, siempre en el mismo `try/catch` que marca el campo como invalido. El
  filtro que manda sigue siendo `PMU_Uploads::validar_script_campo()` en el servidor.
- **D4 - El tamano final de la imagen es del CAMPO, no del placeholder**
  (`contracts/campos.md:32` ya lo decia asi: "lo define el campo/PDF"). Si el hueco del grupo es
  mas chico, el Motor escala (regla de encajado, `AGENTS.md` §4.3): el recorte es exacto, el
  encuadre en el PDF es proporcional.
- **D5 - Las 3 plantillas base son `imagen`, `select` y `texto`**; solo cambian el HTML/CSS/JS
  inicial. El admin siempre edita el HTML. **Cualquier campo existente puede marcarse como
  plantilla** para reutilizarlo.
- **D6 - El CSS/JS global es UNO SOLO del plugin**, en `uploads/pmu/campos/global.css` y
  `global.js`, cargado en cualquier ficha con al menos un campo. El CSS se inyecta con el prefijo
  `[data-pmu-panel]` para que no pueda romper la tienda; el JS es **codigo libre del admin** y solo
  se le garantiza una cosa: que se ejecuta **antes** de montar los campos (`window.PMU_CAMPO` como
  espacio de trabajo). **No** se provee ninguna tabla de traduccion: el control es 100% del admin
  (ver D21).
- **D7 - El cargador es un componente aparte (`CargadorPMU`) que reutiliza `SelectorPMU`**, una
  instancia por ranura. No se modifica el contrato de `selector-pmu.md`. La subida ocurre **al
  confirmar el recorte**, antes de la vista previa.
- **D8 - Sin libreria de editor**: los textareas siguen siendo textareas, con plantilla inicial,
  snippets insertables y contador contra el limite de 20 000 caracteres
  (`personalizador-pdf.php:2165`). CodeMirror/Prism quedan fuera de alcance.
- **D9 - `campos.json` se parte en archivos por campo** (`uploads/pmu/campos/{id}/`) con `?v=` por
  `meta.modificado`. El `campos.json` conserva el indice y los metadatos. Ventaja adicional a la
  de cache: si el comprador tiene la ficha cacheada, solo se recarga el campo que cambio.
- **D10 - El catalogo se migra one-shot conservando el `id`**: los PDFs en produccion tienen
  `config.json:campos_ids[]` que referencian esos ids; perder un id deja el PDF sin campos. El
  `tipo` viejo se ignora. Se guarda `campos.json.bak` antes de escribir.
- **D11 - El binding de un campo de imagenes al placeholder es `[campoN]` con tipo imagen**: el
  campo devuelve `valor = ["id1","id2",...]`; el placeholder tipo `imagen` con
  `value = "[campo55]"` resuelve esos ids contra `manifest.subidas[]`. Si el grupo tiene `cont`
  instancias, cada archivo va a su instancia.
- **D12 - El Motor pasa a aceptar N imagenes por grupo**: `$rutasImagenes[$id]` admite string
  (comportamiento actual) o lista de rutas (una por instancia). Retrocompatible; `Overlay::build`
  reparte. Sin esto, 6 fotos en 6 huecos del mismo grupo no se puede generar.

### Session 2026-10-04 (b) - `/clarify`: exposicion de las imagenes del comprador **[CERRADA]**

- **D13 - Las fotos del comprador se sirven como URL publica de `uploads/`, con la MISMA proteccion
  que el pool actual**: el secreto es el par `sid` (uuid v4 en cookie) + `item_key`
  (`draft-{uuid}` / `{cart_item_key}`), que el navegador usa como URL (`url_sesion_item()` +
  `subidas/{id}.webp`). Sin endpoint PHP nuevo, sin cifrado, sin mover las fotos fuera del webroot.

  **Por que**: `handle_vista_previa()` ya devuelve `pool_url` al navegador
  (`personalizador-pdf.php:978`) y `tienda.js:806` lo usa para recomponer los mockups desde los PNGs
  ya subidos (`poolPrevio()`). El mismo mecanismo sirve para que el navegador vea **su** foto en el
  panel y en el mockup sin volver a subirla; un endpoint aparte duplicaria esa ruta.

  **Riesgo asumido y como se acota**: si un link de item se filtra, las fotos son accesibles para
  quien tenga ese link (igual que los PNGs del pool hoy). El par `sid`+`item_key` no es enumerable
  (uuid v4) y ambos viajan en la cookie `pmu_sid` del comprador. Es el mismo nivel de proteccion que
  el pool vigente, sin subir el liston.

  **Consecuencia asumida**: `subidas/` **no** se sirve en las vistas del admin (la pestaña Campos
  prueba el cargador sin subir nada, FR-009). Solo el comprador dueno del item accede a sus fotos.

  **Queda fuera**: thumbnails derivados, cifrado, carpeta fuera del webroot y endpoint con nonce
  propio. Si algun dia el plugin maneja datos sensibles (documentos de identidad), esto es lo
  primero a revisar: el sistema esta pensado para credenciales y diplomas, no para DNI.

### Session 2026-10-04 (c) - `/clarify`: formato de la foto del comprador **[CERRADA]**

- **D14 - El cargador guarda la foto del comprador en **WebP**, y el Motor lo acepta porque el
  hosting tiene GD.** Verificado en el servidor del usuario: **PHP 8.5.4, GD 2.3.3, WebP lectura
  SI / escritura SI**. WebP ya es formato aceptado en todo el sistema (allowlist de imagenes en
  `personalizador-pdf.php:321`, `:2261`, `:2846`) y las vistas congeladas ya son `.webp`
  (`congelar_webp()`).

  **Por que WebP**: el recorte del modal es al tamano exacto (`size:1000`), asi que el peso ya
  esta controlado por las dimensiones; WebP lo comprime mas y mantiene transparencia (util si el
  recorte es circular). El comprador no sube el original tal cual: el `SelectorPMU` normaliza en el
  navegador y entrega solo el recorte.

  **DependenciaAccepted**: `Imagen::viaGd()` (`engine/Imagen.php:73`) es la unica ruta que decodifica
  WebP; **sin GD el Motor lanzaria "Formato de imagen no soportado sin GD (webp)"**. Como GD esta
  presente y verificada en este hosting, se acepta WebP. **Se agrega un check en `smoke_checks()`**
  ("GD + WebP disponible"), que hoy solo verifica que GD este presente
  (`personalizador-pdf.php:1646`), para que si un dia se traslada a un hosting sin GD el admin lo
  vea en la pestana Test antes de que falle un pedido. Si el smoke reporta GD ausente, el cargador
  cae a PNG (fallback documentado, no implementado en esta tanda).

- **D15 - El tope de peso no se fija como limite de producto, sino como Ridefensa**: el volumen
  real lo acota el diseano (`size` y `max` por ranura); el unico limite duro es un techo alto por
  archivo en el endpoint (`motor:subida:tamano`) que evita que un original absurdo agote el hosting
  antes de que el navegador lo normalice. El `SelectorPMU` no sube el original: sube el recorte ya
  dimensionado.

### Session 2026-10-04 (d) - `/clarify`: `min`/`max` del cargador y `repetir` **[CERRADA]**

- **D16 - El modal EXIGE `min` antes de dejar guardar**: "Aceptar" permanece deshabilitado hasta que
  la ranura tenga al menos `min` imagenes (el boton ya nace `disabled` en
  `selector-pmu.js:97` y se habilita con el recorte, `:232`; solo falta exigir `min` para cerrar).
  Es la validacion **precisa**: el comprador no puede ni dejar el item incompleto.

- **D17 - El placeholder NO exige N = cont, y el sistema NUNCA bloquea la compra por fotos.**
  Esto **cambia el comportamiento vigente** de `conciliarGrupo()` (`assets/tienda.js:56-83`), que hoy
  lanza `aviso` + `textos: []` y bloquea el PDF cuando N != M (`:71-79`). Reglas nuevas:

  | Configuracion | Instancias del grupo | Resultado |
  |---|---|---|
  | `[v] Repetir por placeholder` | cont = 8, sube 4 | **cicla**: 1,2,3,4,1,2,3,4 (el `idx` se toma modulo el largo del array) |
  | `[v] Repetir por placeholder` | cont = 8, sube 1 | repite la misma en las 8 (comportamiento actual, se conserva) |
  | **sin** `[v]` | cont = 8, sube 3 | las 3 que subio en las 3 primeras instancias; **las demas quedan vacias** (el hueco conserva su transparencia) |

  **Por que**: el placeholder no "exige" nada (lo confirmo el usuario); el `min` del modal es la
  unica validacion real. Bloquear la compra por una foto faltante contradice la politica vigente del
  sistema ("errores que no frenan la venta", Const. decision 2026-09-17). El bloque que existia era
  una medida de seguridad para **texto** mal configurado; con imagenes, repetir o dejar vacio es
  siempre una salida valida.

  **Consecuencia**: los grupos con instancias vacias quedan como `grupos_sin_imagen` en el resumen
  del Motor (`Motor.php:68`), que ya informa "huecos conservados". No es un error.

  **Efecto colateral aceptado**: `conciliarGrupo` es `PURO` y esta testeado en Node; el cambio
  altera `PURO.conciliarGrupo` y **hay que actualizar sus asserts** en `tests/conciliacion.js`
  (el archivo que cubre `PURO.conciliarGrupo` / `PURO.resolverPlantilla`).

- **D18 - La regla de D17 aplica IGUAL a texto e imagenes (una sola regla)**: sin `[v]` y N != M,
  las instancias sobrantes quedan **vacias**, y el sistema **no bloquea la compra**. Verificado que
  el bloqueo actual es solo del lado JS (`conciliarGrupo`, `tienda.js:71-79`), asi que el cambio es
  acotado a esa funcion pura mas sus asserts en `tests/conciliacion.js`.

  **Consecuencia de negocio**: si el admin configuro mal un placeholder de texto (3 nombres para 8
  etiquetas) y el cliente no lo nota, hoy ve un **error y no puede comprar**; con D18 ve 3
  etiquetas y 5 huecos vacios, y compra. Es el mismo criterio que ya aplica el Motor: los grupos sin
  imagen quedan transparentes y el resumen los informa (`Motor.php:68`). La **validacion real queda
  en el panel** (min del cargador, campos obligatorios del `campo.htm`), no en un bloqueo al final.

  **Como se mitiga el error de configuracion**: el nuevo indicador "usado en N PDF(s)" de la
  pestana Campos (FR-013) y la columna que muestra cuantos `[campoN]` consume cada placeholder
  ayudan al admin a detectar mapeos rareos antes de publicar el producto.

### Session 2026-10-04 (e) - `/clarify`: instancias vacias sin mensaje **[CERRADA]**

- **D19 - Una instancia sin foto NO es un error y NO genera ningun mensaje**: si el placeholder pide
  6 y llegaron 3, cada instancia vacia simplemente **se omite del pool** y el PDF sale con 3 fotos y
  3 huecos transparentes. Sin frase nueva para el cliente, sin aviso en la ficha, sin entrada de
  error: es un informe normal (`grupos_sin_imagen` del resumen del Motor ya lo informa para el
  admin, `Motor.php:68`).

  **Por que**: coherente con D17/D18 (nunca bloquear ni avisar por una diferencia de cantidad) y con
  la politica del sistema de que los huecos sin contenido quedan transparentes.

- **Correccion de FR-037**: el requisito original ("si N != cont se avisa y se **bloquea** la
  generacion de ese PDF") queda **anulado** por D17/D18/D19. Se reemplaza por FR-037' (ver abajo).

### Session 2026-10-04 (f) - `/clarify`: par `titulo_cliente`/`cliente` y el global sin tabla **[CERRADA]**

- **D20 - `titulo_cliente` es la ETIQUETA y `cliente` es el RESULTADO**, y se pintan juntos en el
  carrito. Ejemplo literal del usuario:

  ```
  Producto: "Etiquetas para condimentos"     <- nombre del producto Woo (NO es un campo)
  Seleccion: sal, oregano, pimienta...       <- titulo_cliente + ": " + cliente
  Modelo: Rosas                             <- otro campo, misma regla
  ```

  `titulo_cliente` = "Seleccion" (como el admin **nombra** esa personalizacion); `cliente` =
  "sal, oregano, pimienta..." (lo que eligio el comprador). Se renderiza una linea por campo como
  **`titulo_cliente` + ": " + `cliente`**. Esto **confirma** la lectura de la correccion anterior
  (`nombre` = admin, lo que ve el cliente arriba del campo = HTML) y descarta la lectura de que
  `nombre` fuera visible para el comprador.

- **D21 - Se elimina la tabla de traduccion; el control es 100% del `global.js`.** El usuario
  rechaza `PMU_CAMPO.tablas` ("por el momento no me parece necessary") y prefiere tener todo el
  control desde JS global. Consecuencias:
  - **No** existe `PMU_CAMPO.traducir()`, **ni** `tablas`, **ni** auto-deteccion de nada.
  - `PMU_CAMPO` queda como **espacio de trabajo** del admin (puede colgar sus propias funciones,
    listeners y lo que quiera); lo unico garantizado es que el global se ejecuta **antes** de montar
    los campos.
  - La regla de salida de `cliente` queda en **dos** escalones (`campo.js` > `data-rol`) y, si no hay
    ninguno, **`cliente` queda vacio** (ver FR-026). Nunca cae a `valor` en automatico, porque el
    contrato veta mostrar `valor` crudo al comprador (`campos.md:65`).
  - El admin que quiera el comportamiento `0000FF -> "Azul"` lo escribe entero en `global.js`,
    tal cual lo describio en su ejemplo (`f-color`).

  **Por que**: una tabla fija limitaba al admin a pares valor->texto y no permitia logica (mirar el
  campo, el contexto, contar, etc.). Con el global libre, cualquier regla es posible, y el sistema no
 opiniona sobre como mostrar las cosas: solo guarda y pinta.

- **D22 - Exportar/importar el catalogo de campos queda FUERA de alcance.** El usuario lo decide el
  2026-10-04 ("export/import no es necesario"). Consecuencias:
  - **FR-021 y FR-022 no se implementan** y el codigo de `b146952` (los dos `admin_post`, sus dos
    handlers, los dos forms de la consola y su JS) **se retira por completo**: queda cero rastro.
  - `uploads/pmu/campos.json` + `campos/{id}/` sigue siendo la **unica** via de datos de los campos.
  - El backup es una **copia de `uploads/pmu/`** (los campos son datos del administrador, igual que
    los PDFs, las imagenes o los presets), no una funcion de la consola.
  - **Sin cambios en el resto**: migracion v1→v2, CRUD, restaurar, duplicar, plantillas, preview y
    el global siguen igual. La decision no toca el motor ni el ciclo del comprador.

## User Scenarios

### US1 - Editor en linea (P1)

**Por que**: hoy `Editar` recarga la pagina y el formulario aparece en otra card; el admin
pierde el lugar y el contexto.

**Escenario**: el admin hace clic en "Editar" de un campo -> la fila se convierte en formulario
-> cambia el nombre, edita el HTML, marca una categoria -> "Guardar" -> la fila vuelve a su
estado de tabla **sin recargar la pagina** y con los valores ya guardados.

**Criterios de exito**:
- FR-001 Editar un campo NO navega (desaparece `?ec_campo_editar=` de la URL).
- FR-002 Guardar reordena la fila con los valores reales (nombre, categorias, protegido, plantilla).
- FR-003 Cancelar devuelve la fila al estado de tabla sin escribir nada.

### US2 - Probar el campo (P1)

**Por que**: hoy se escribe HTML/CSS/JS a ciegas; el unico montaje del sistema esta en la ficha.

**Escenario**: el admin edita un campo -> "Probar" -> se abre un panel de 350px que monta el
campo tal cual lo vera el comprador (su HTML, su CSS, el CSS global del plugin y el JS global),
con los `data-rol` resueltos. Para un campo con cargador, "Probar" muestra el marco de cada
ranura con su tamano y forma, sin subir nada.

**Criterios de exito**:
- FR-004 El preview usa el MISMO montaje que la ficha (`assets/campo-montar.js`).
- FR-005 El preview se ve en un iframe de 350px; el CSS del tema activo llega por `<link>` a las
  hojas que la pagina ya tiene encoladas (nunca se inventan URLs).
- FR-006 El CSS global se inyecta con el prefijo `[data-pmu-panel]`, tambien en el preview.
- FR-007 El preview muestra a la vez `valor` y `cliente` (el valor dual del contrato).
- FR-008 Un `script` que lanza excepcion se muestra como error, sin romper la consola.
- FR-009 "Probar" del cargador muestra ranura/tamano/forma/min/max y NO sube ningun archivo.

### US3 - Buscar, filtrar y ordenar (P2)

**Por que**: el contrato promete filtrar por etiquetas y no hay forma; con 20 campos la tabla es
inmanejable.

**Escenario**: el admin escribe "color" en el buscador -> la tabla filtra por nombre, descripcion,
titulo cliente y categorias. Elige la categoria "navidad" -> filtra. Elige "Mas recientes" ->
ordena. El panel del comprador NO cambia de orden (sigue mandando `config.json:campos_ids[]`).

**Criterios de exito**:
- FR-010 Buscar por texto (nombre, descripcion, titulo cliente, categorias).
- FR-011 Filtrar por una o varias categorias (chips).
- FR-012 Ordenar por mas recientes / por modificacion / por id.
- FR-013 La columna muestra "usado en N PDF(s)" con el detalle de cuales y cuantos `[campoN]`.
- FR-014 El orden de la tabla NO altera el orden del panel del comprador.

### US4 - Plantillas, duplicar, restaurar, importar/exportar (P2)

**Por que**: crear un campo hoy son dos pantallas; darlo de baja lo destruye; y no hay copia de
seguridad del catalogo, que es el unico catalogo en la raiz de `uploads/`.

**Escenario**: el admin elige plantilla `texto` y el formulario ya viene con un input y su
`data-rol`. Marca un campo trabajado como "plantilla" y lo usa de base para el siguiente.
Duplica el campo "Color" para tener "Color de fondo". Da de baja un campo por error y lo
restaura con su HTML intacto. Exporta `campos.json` a un archivo y lo importa de vuelta.

**Criterios de exito**:
- FR-015 Crear desde plantilla `imagen` | `select` | `texto` deja el HTML/CSS/JS inicial listo.
- FR-016 El admin siempre puede editar el HTML de un campo creado desde plantilla.
- FR-017 Marcar/desmarcar un campo como plantilla.
- FR-018 "Usar como plantilla" lista los marcados y crea un campo nuevo con id propio.
- FR-019 Duplicar crea un campo nuevo con el mismo contenido y un id nuevo.
- FR-020 Restaurar un campo dado de baja recupera nombre, HTML, CSS y JS intactos.
- FR-021 Exportar descarga `campos.json` con todos los archivos incluidos.
- FR-022 Importar valida todo ANTES de escribir (todo-o-nada) y nunca pisa un id en uso.

### US5 - CSS y JS global del plugin (P1)

**Por que**: es el caso mas comun y hoy no existe; hoy cada campo repite su CSS o no tiene.

**Escenario**: el admin abre la pestana Campos y edita "Estilos globales" y "Script global". Se
guarda en `uploads/pmu/campos/global.css` y `global.js`. En cualquier producto con al menos un
campo, el CSS se inyecta con prefijo `[data-pmu-panel]` y el JS define `window.PMU_CAMPO`.

**Criterios de exito**:
- FR-023 Un solo archivo `global.css` y `global.js` para todo el plugin.
- FR-024 Se edita desde la pestana Campos (tarjeta siempre visible arriba).
- FR-025 Se carga en cualquier ficha con al menos un campo, y NO en una ficha sin campos.
- FR-026 El `cliente` se resuelve asi: `campo.js` del campo > `data-rol` del HTML. **Si ninguno de
  los dos existe, `cliente` queda vacio** (nunca cae a `valor`, por la regla de "el sistema jamas
  muestra `valor` crudo").
- FR-027 **El sistema NO traduce nada por si mismo**: no hay tabla, ni `traducir()`, ni
  auto-detección de nada. Si el admin quiere traducir `0000FF` -> "Azul", lo escribe **en el
  `global.js`**, que es codigo libre y se ejecuta antes de montar los campos.

### US6 - Cargador de imagenes del cliente (P1)

**Por que**: el cargador (`SelectorPMU`) esta escrito, encolado y sin instanciar; el cliente no
tiene forma de subir una foto propia, y el pool solo acepta PNGs de un hueco.

**Escenario**: el comprador abre el producto -> toca "Subir imagenes" -> el modal acepta el
archivo **arrastrandolo** o con clic -> ajusta el encuadre (zoom, recortar/encajar) -> Aceptar
-> la imagen se sube a la sesion del item y el campo publica `["id1"]`. Con 6 ranuras acepta
hasta 6 fotos; el campo publica los 6 ids.

**Criterios de exito**:
- FR-028 El cargador declara N **ranuras**, cada una con `w`, `h`, `forma`, `min` y `max`.
- FR-029 El modal acepta el archivo arrastrndolo y tambien por clic.
- FR-030 La subida ocurre **al confirmar el recorte**, antes de la vista previa.
- FR-031 El destino es `tmp/sesion-{sid}/{item_key}/subidas/{id}.{ext}` con fila en
  `manifest.subidas[] = {id, file, mime, w, h, bytes, creado}`.
- FR-032 El **id lo genera el servidor** (uuid); el cliente nunca manda un nombre de archivo.
- FR-033 El campo publica `valor = [id1, id2, ...]` y `array = true` cuando hay ranuras con `max > 1`.
- FR-034 El pool de grupos (`img/`) NO se toca: sigue siendo solo texto renderizado.
- FR-035 Al confirmar el pago, `subidas/` se mueve con el item (rename de la carpeta, sin trabajo extra).

### US7 - Campo de imagenes en el placeholder (P1)

**Por que**: es el final del camino. Hoy el Motor pone una imagen por grupo y la replica en
todas sus instancias; el comprador no puede elegir una foto distinta por hueco.

**Escenario**: el admin marca el placeholder 0000FF como tipo `imagen` y pone `value = [campo55]`
(campo de 6 fotos). El comprador sube 6. Al pulsar "Vista previa", el sistema rasteriza las 6
subidas (WebP) a PNGs del tamano exacto del hueco, sube esos PNGs al pool (para que el mockup sea
fiel) y genera el PDF con 6 fotos distintas en los 6 huecos.

**Criterios de exito**:
- FR-036 El placeholder tipo `imagen` con `value = [campoN]` resuelve el array de ids contra
  `manifest.subidas[]` **validando que existan** (nunca una ruta arbitraria del cliente).
- FR-037' **REEMPLAZA a FR-037** (anulado por D17/D18/D19): si el numero de ids != `cont`, **no se
  bloquea ni se avisa**. Cada instancia sin foto se **omite del pool** y el PDF sale con las fotos
  que hay y los huecos restantes transparentes. Sin `repetir` las sobrantes quedan vacias; con
  `repetir` el `idx` cicla modulo el largo del array (D17).
- FR-038 Cada id se rasteriza al tamano exacto del hueco y se sube al pool, para que la vista previa
  y el PDF usen **la misma imagen**.
- FR-039 El Motor acepta `N` imagenes por grupo (retrocompatible: string = comportamiento actual).
- FR-040 Un campo protegido nunca viaja al HTML de la ficha.
- FR-041 Si un campo es invisible (sin HTML visible) su `script` sigue publicando (helpers).

## Fuera de alcance

- **Correos**: hoy el plugin no manda ningun email (no hay codigo de notificacion). Mostrar el
  `titulo_cliente` + `cliente` en un email de Woo es otra historia.
- **Editor de codigo con resaltado** (CodeMirror, Prism): los textareas siguen siendo textareas.
- **Catalogo `img/` desde la pestana Campos**: el usuario lo sigue administrando donde ya lo
  hace (`uploads/pmu/img/`). Un boton "Anadir al catalogo" queda para mas adelante.
- **Cambiar el orden de los campos en el panel del comprador**: sigue mandando
  `config.json:campos_ids[]`.
- **TextoMulti / el modulo `modules/textmuy/`**: esta spec NO lo toca (sin bump `?v=RCn`).
- **La API (spec 010)**: cuando se implemente, consumira este mismo formato de campos.

## Criterios de aceptacion (spec)

- Un mismo campo se usa en N PDFs sin duplicar su definicion (sigue siendo cierto, ahora con
  archivos por campo).
- El admin ve, antes de guardar, exactamente lo que vera el comprador.
- Un campo con cargador devuelve ids de imagenes reales de la sesion del comprador, y el Motor
  las coloca en los huecos correctos (una por instancia).
- El sistema jamas muestra `valor` crudo al cliente ni procesa `cliente` (contrato `campos.md:65`).
- PHP nunca evalua JS: los scripts siguen corriendo solo en el navegador.
- El catalogo no se guarda dentro de la carpeta del plugin (Const. IV).
