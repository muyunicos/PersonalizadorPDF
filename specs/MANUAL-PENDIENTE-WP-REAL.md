# Recorrido manual pendiente en WP real (sesion unica)

> Cubre en UNA sesion: T030 (004) + T012-recorrido (005) + T017/T029 (006) + T031 (012)
> + T022 (016, cuando F1-F5 esten implementadas) + **T021/T022 (018)** + **T016 (019)**.
> Requiere: panel WP del administrador con plugin activo + Woo + modulo integrado
> (`modules/textmuy/`) + `uploads/pmu/pdfs/muestra.pdf` (dato de usuario, no versionado).
> Las puertas automaticas ya estan en verde (ver §0); esto es solo verificacion con datos reales.
> Limpieza al cerrar: solo `tmp/sesion-*`, `tmp/muestras/*`, `tmp/orders/*` de prueba.
> **Nunca** `orders/` (entregables), ni `pdfs/`, ni catalogos del editor.

## 0. Puertas automaticas (previas, ya verdes — repetir antes de empezar)

```bash
php -l personalizador-pdf.php
php -l admin/page.php
php -l admin/pdfs.php
php -l admin/campos.php
php -l admin/estilos-texto.php
php -l admin/ayuda.php
php -l engine/Pdf.php
php -l engine/Detector.php
php -l engine/PngWriter.php
php -l engine/Metadata.php
php -l engine/Imagen.php
php -l engine/Overlay.php
php -l engine/Motor.php
php -l inc/class-pmu-uploads.php
php -l inc/class-pmu-galeria.php
php -l inc/class-pmu-sesion.php
php tests/motor_smoke.php
php tests/parity.php
php tests/texto_puente.php validez
php tests/texto_puente.php completados
node tests/validez.js
```

Detalle completo por spec: [004/quickstart.md §1](./004-woocommerce-pdf-personalization/quickstart.md),
[005/quickstart.md §1](./005-pdf-condicionales/quickstart.md),
[006/quickstart.md §1+§2+§7](./006-align-textmuy-motor/quickstart.md).

## 1. Editor + raiz unica (006 T017-parcial, T029-parcial)

1. Pestana "Estilos de Texto": galeria muestra recursos con miniatura, sin errores.
2. Subir 1 imagen + 1 fuente + guardar 1 estilo que las use; recargar: persisten.
3. Secuencia 20 ops (7 altas, 6 renombres, 7 bajas) e inspeccionar `uploads/pmu/`:
   un catalogo + un sprite por ambito, 0 duplicados, 0 entradas a ausentes,
   sin `uploads/tm/` ni `uploads/pmu/tm/` (solo vigente `tm-presets/`).
   (Origen: [006/quickstart.md §3](./006-align-textmuy-motor/quickstart.md).)

## 2. Mockups + mapeo admin (004 T030 §2, 006 §4-parcial, **011 T051**)

1. En PDFs, abrir "Mockups" del PDF de prueba; el editor aparece en **dos columnas**
   con estilos (paneles, lienzo con fondo damero, marco 300x300).
2. Crear vista `fiesta`: **arrastrar una imagen desde el escritorio al lienzo** (se sube y
   queda como capa, sin escribir el nombre) y agregar **2 huecos** desde la lista de
   grupos con un clic.
3. Colocar y alinear **solo con el raton**: arrastrar, redimensionar con los tiradores,
   rotar; comprobar la guia del imán al llegar al centro y la medida en px junto a la
   seleccion. Subir el zoom a 200 % y repetir un arrastre: el resultado es identico.
4. Pulsar **"Probar"** en un grupo con estilo: el lienzo muestra el texto real en las
   capas de ese grupo. Pulsarlo otra vez **no** genera un render nuevo.
5. Mover un slider (p. ej. **gama**, que antes se guardaba y no se aplicaba) y comprobar
   el efecto en vivo; "Restablecer ajustes" vuelve al neutro.
6. Esperar el autoguardado ("Guardado"), **recargar** y comprobar que todo persiste.
   `Ctrl+Z` revierte un movimiento.
7. Guardar y recargar: `config.json:mockups[0].capas` con el orden, `ref` con namespace
   (`pdf:...`, `img:{id}`) y los ajustes; `analisis.json` intacto.
8. Borrar una foto en uso: aparece el conteo de capas afectadas; al confirmar, la capa
   queda **marcada**, no desaparece.
9. "Ver como lo ve el cliente": composicion 300x300 sin marcas de edicion.
   (Origen: [004/quickstart.md §2](./004-woocommerce-pdf-personalization/quickstart.md),
   [006/quickstart.md §4](./006-align-textmuy-motor/quickstart.md),
   [011/quickstart.md §5](./011-editor-mockups-visual/quickstart.md).)

## 3. Validez por producto (005 T012, 004 T030 §3)

1. Asociar 4 PDFs a producto1 con las valideces del ejemplo
   (`campo1` diseno × `campo2` tamano) + `mensaje_html` + `bloquear` OFF.
2. Ficha: elegir "libelulas"+"legal" → galeria solo con mockups de
   `pdf-diseno1-legal`; primer mensaje de fallidas visible; evaluacion <200 ms.
3. Activar `bloquear` + nombre vacio → `add-to-cart` deshabilitado; completar →
   habilitado; combinacion 0-elegibles bloquea aunque todo `bloquear` sea OFF.
   (Origen: [005/quickstart.md §2+§3](./005-pdf-condicionales/quickstart.md).)

## 4. Comprador: vista previa + carrito + pedido (004 T030 §3-§6)

1. Ficha: completar campos → "Vista previa" → galeria 300x300 + flechas;
   pendientes "Generando vista previa" → paralelas → carrito habilitado.
2. `tmp/sesion-{sid}/draft-{uuid}/`: `manifest.json` (`preview_estado=ok`) +
   pool `img/{pdf}-{id}-{n}.png` + `mockup-*.webp`; agregar → rename a
   `{cart_item_key}` mismo `sid`; meta guarda valores + estado.
3. Tolerancia: preset inexistente → vista oculta; 0 vistas → "no hay vista previa"
   + compra habilitada (`sin_vista`); completados filtra `sin_vista` primero.
4. Checkout → staging `tmp/orders/{order_id}/{item_key}/` → pago → rename a
   `orders/...` con `{pdf}_procesado.pdf` + pool + webp; Descargas → "Descargar"
   (reintento silencioso si `sin_vista`, idempotente).
5. Omisible: `preview_omisible=true` → sin vista ni galeria, carrito habilitado,
   `preview_estado=omisible`; PDF al pagar/en Descargas.
   (Origen: [004/quickstart.md §3-§6](./004-woocommerce-pdf-personalization/quickstart.md).)

## 5. Snapshot + auditoria (005 T012, 004 T030)

1. Agregar con 1 elegible declarando a mano un PDF inactivo en el POST →
   inactivo cae a `pdfs_descartados[]`.
2. "Completados": muestra `pdfs[]` + `pdfs_descartados[]`; regeneracion usa solo
   snapshot; "Descargar" una fila por PDF aceptado (descartado no se genera).
3. `pmu_pdfs=[]` → `motor:sesion:snapshot:vacio` sin crear draft.
   (Origen: [005/quickstart.md §4](./005-pdf-condicionales/quickstart.md).)

## 6. Fallos + respaldo (006 T029-resto)

1. Matriz [006/quickstart.md §5](./006-align-textmuy-motor/quickstart.md): catalogo
   ausente/invalido, recurso ausente, sin permisos, formato anterior → cada uno
   causa accionable (`motor:<op>:<motivo>`), sin parciales; restaurar tras cada uno.
2. Copiar `uploads/pmu/` a instalacion limpia → mismos recursos/estilos, <2 min,
   sin carpetas extra. Borrar datos de prueba del recorrido (§limpieza arriba).
   (Origen: [006/quickstart.md §5+§6](./006-align-textmuy-motor/quickstart.md).)

## 6b. Campos reutilizables (012 T031)

> Se puede hacer **sin WooCommerce**: alcanza con una pagina que tenga el shortcode
> `[pmu_personalizar pdf="muestra"]` (o el producto real si hay Woo).

1. Pestana **Campos**: la tarjeta "Estilos globales / Script global" esta **arriba**.
   Guardar un CSS de prueba y un JS que defina `window.__PRUEBA__ = 1`; recargar: persiste.
2. Crear un campo desde la plantilla **Texto**; el editor se abre **dentro de la fila**
   (sin cambiar de pagina) y el boton **Probar** muestra un iframe con el campo.
3. Editar `campo.js` para publicar `ctx.set(ctx.id, {valor:'Z', cliente:'Cliente'})`;
   "Probar" muestra los **dos** valores. Borrar el `data-rol` del HTML y comprobar que
   `cliente` queda **vacio** (nunca cae a `valor`).
4. Comprobar el prefijo: en el CSS global poner `.pmu-panel-titulo { color: rgb(9,8,7) }`.
   En la ficha se ve; en una pagina **sin** `[data-pmu-panel]` **no** se ve.
5. Filtrar: buscador, chip de categoria, orden por id/fecha/nombre y la columna **Uso**
   (PDFs + `[campoN]` + detalle al pasar el mouse).
6. **Marcar plantilla** (toggle), **Duplicar** (aparece "(copia)"), **Dar de baja** y
   **Restaurar**: los archivos se conservan (`uploads/pmu/campos/{id}/` sigue ahi).
7. Campo **con cargador** (plantilla Imagenes, ranura con `min=2`): en la ficha, "Listo"
   nace **deshabilitado**; subir 1 foto sigue deshabilitado, la 2da lo habilita.
   En disco: `tmp/sesion-{sid}/{item_key}/subidas/{id}.{ext}` + fila en `manifest.subidas[]`
   (el `id` lo puso el servidor). (Cubre tambien **T011b/FR-009**: "Probar" dibuja la ranura
   sin subir nada.)
8. **Nunca bloquea** (D17-D19): subir **menos** fotos que huecos y pulsar "Vista previa":
   genera PDF igual, con los huecos sobrantes transparentes y una nota informativa
   (antes frenaba la compra). Con `repetir` activado, las fotos ciclan entre huecos.
9. Verificar en el PDF descargable: cada hueco lleva **su** foto (no la misma repetida).
   (Origen: [012/quickstart.md](./012-campos-consola/quickstart.md).)

## 6c. Cargador de fotos del comprador (016 T022 + 021)

> Spec 021: el motor de recorte es el **canvas unificado** de `selector-pmu.js`
> (Cropper.js se retiro). Probar en movil (uso principal) y en escritorio.

1. **Ficha con un campo de imagen** (plantilla "Imagen (cargador)", ranura con `min=1`):
   tocar la ranura o el boton -> **se abre directo la galeria/archivos** del dispositivo.
2. Elegir la foto: el modal muestra la escena con **10% de margen** alrededor del
   placeholder y las dos guias (marco secundario = donde se corta el PNG; marco
   principal = forma/envoltura). El boton pasa a decir **"Cambiar imagen"**.
3. **3 modos**: con una foto que no coincide con el hueco aparecen **Rellenar /
   Ajustar / Estirar** y **Girar** (solo si la ranura trae `{ r: 1 }`). Con una foto que
   difiere <=5% en aspecto queda **solo Estirar** y sin Girar.
4. **Reducir / Ampliar**: el slider al medio (`0`) es el encaje base; a la izquierda
   reduce (se ve el **color de fondo**, autodetectado de los bordes de la foto o
   transparente) y a la derecha amplia. El boton **`↺`** vuelve al medio y centra.
5. Tocar **"Subir"**: avisa **"Subiendo imagen..."** (no se puede tocar dos veces) y, si
   quedan espacios en la ranura, pregunta **"¿Queres subir otra imagen?"** (abre directo
   la galeria). El boton "Listo" y `min`/`max` siguen mandando.
6. **Mini galeria**: tocar una miniatura subida abre el visor fullscreen con **flechas**
   (y swipe/teclado), **Eliminar** y **Reemplazar**. Reemplazar avisa que imagen se
   reemplaza; si se cancela, vuelve al visor con la foto actual.
7. Agregar al carrito y **"Editar"**: las fotos ya cargadas aparecen en las ranuras
   (restauracion por `personalizador_pdf_subida_url`).
8. Vista previa + PDF final: la foto ajustada llega al hueco correcto (flujo 012 intacto).
   (Origen: [016/quickstart.md](./016-editor-visual-fotos/quickstart.md),
   [021/spec.md](./021-cargador-visor-cliente/spec.md).)

## 6d. Campos v4 + ranura adaptativa (018 T021/T022 + 019 T016)

> Requiere el release **4.10.0** desplegado y **Ctrl+F5** (los JS/CSS cambian de `?ver=`).
> Se puede hacer **sin Woo**: alcanza una pagina con `[pmu_personalizar pdf="muestra"]`.

1. **El cargador es del campo** (018): crear un campo desde la plantilla **Imagen (cargador)**.
   El drawer muestra **HTML** con `<div data-pmu-cargador></div>` y un **JS** con `RANURAS` +
   `PMU_API.montarCargador`. Ya **no** existe la fila "Cargador de imagenes".
2. **Preview fiel** (018 D9): "Probar" dibuja la ranura; al tocar "Cargar imagen" abre el recorte
   y al subir una foto la miniatura aparece al instante. En DevTools → Network: **cero** POST a
   `admin-post.php` (la subida es simulada). El preview es el UNICO lugar donde la ranura
   muestra sus datos tecnicos (medidas, forma, min/max) y los avisos de configuracion
   (spec 021, `tecnico: true`); la ficha del comprador va limpia.
3. **El recorte se ve** (fix de capas): con el **drawer abierto** y tambien desde el preview,
   el modal de recorte queda **encima** (antes lo tapaba el drawer).
4. **Legacy intacto** (018 D3): un campo viejo con `cargador` en `datos.json` y **sin** `campo.js`
   sigue mostrando su cargador en la ficha. Editarle el **nombre** y guardar: en
   `uploads/pmu/campos/{id}/datos.json` el `cargador` sigue ahi y `protegido`/`texto_ayuda` no se
   borraron (write-through).
5. **Tipo editable** (018 D4): cambiar el `<select>` **Tipo** y guardar; la columna Tipo de la
   fila cambia y `datos.json:tipo` tambien. El HTML/CSS/JS del campo **no** se toca.
6. **Dos campos de imagen en el mismo PDF** (018 T021): asociar los **dos** campos al mismo PDF
   (`campos_ids`), subir **1 foto en cada uno** en la ficha y pedir "Vista previa": salen **2
   lineas** en la galeria/carrito y cada hueco lleva su foto. Despues "Editar" desde el carrito:
   las **dos** minis vuelven a sus ranuras.
7. **Un modal a la vez** (018 T022): con 2 campos de imagen, abrir una ranura, cerrarla y abrir la
   del otro campo: nunca hay dos modales apilados ni **botones duplicados** en la misma ranura
   (regla `cargador && !campo.js`).
8. **`phsize: 1` = tamano del hueco** (019): el hueco del grupo ya referencia `[campoN]`, asi que la
   guia y el tamano salen **automaticos** (la consola muestra "automatica: #gid (del cableado del
   hueco)"). En el `campo.js`, poner `phsize: 1` en la ranura: en la ficha, el titulo de la ranura
   debe mostrar el **mismo** `WxH` que el grupo. Subir una foto y mirar el PNG del pool
   (`uploads/pmu/tmp/sesion-{sid}/{item_key}/img/…`): tiene ese tamano.
9. **`phsize: 2`** duplica el tamano (acotado a 3000 px): el titulo de la ranura lo refleja.
   Con `phsize: 1` y el campo **sin** envoltura asociada: la ranura usa sus `w`/`h` y la consola
   avisa por `console.warn` (DevTools).
10. **Aviso de ampliacion** (019 D6): subir una foto **mas chica** que la ranura (200x200 con una
    ranura de 1000x1000): el badge del selector muestra `se amplia 5.0x` y **no** bloquea
    "Aceptar". Con una foto mas grande, no aparece.
11. **PDF final**: procesar y descargar; la foto entra **encajada** (sin deformar ni recortar) en
    el hueco. Con `phsize` cambia el tamano del PNG, pero el encaje del PDF es el mismo.
    (Origen: [018/spec.md](./018-campos-consola-v4/spec.md) y
    [019/spec.md](./019-ranura-adaptativa/spec.md).)

## 6e. Biblioteca de imagenes del comprador (030 T042)

> Requiere el release **4.22.3** desplegado y **Ctrl+F5**. Con un producto vinculado a un PDF con
> grupo y un campo de imagen (cargador); opcional: un pedido **pagado** propio (lado `orders/`).

1. **Tira y visor** (E2): subir una foto en el campo, agregar al carrito y volver a la ficha. Al
   abrir el modal de recorte, la tira **arriba de la escena** muestra **una** imagen (la `base`) y
   el boton `Cargar imagen` queda a su izquierda; en Network hay **una** `op=listar`; al reabrir el
   modal, **0** peticiones (revalidacion `sin_cambios`).
2. **Elegir sin recomponer (0 bytes)** (E3): en la ficha de un **segundo** producto con el mismo
   hueco, abrir el modal: el primario dice **Elegir**; al pulsarlo el hueco se llena con **solo**
   `op=usar` en la red (0 bytes) y el `manifest.subidas[]` del item nuevo queda con `origen: ref`.
3. **Reusar recomponiendo (version)** (E4): usar la misma foto en un hueco de **otra proporcion**
   (o cambiar escala/desplazamiento): el primario dice **Subir**; se sube `{madre}-2.webp` y la
   tira sigue mostrando **una** entrada (badge `N versiones`), con la `base` de mayor resolucion.
4. **Sin duplicar entre pedidos** (E5): reusar una foto de un pedido **ya pagado**: la fila queda
   `origen: ref` apuntando al archivo de **origen** (relativo a `uploads/pmu/`, sin copiar bytes) y
   el PDF lo imprime resolviendo esa ruta. Si el origen se borra, el hueco sale **transparente**
   (`motor:descarga:ref:ausente`), nunca un PDF roto.
5. **Dedupe, aviso y borrado** (E6): subir **la misma** foto otra vez **reusa** la familia (no
   aparece una segunda entrada). En el visor, **Borrar** nombra el carrito/pedido que la usa; al
   confirmar desaparecen original y versiones y la tira se refresca sin volver a pedir todo.
6. **TTL** (E6): un draft sin agregar se barre a las 24 h; un item de **carrito abandonado**, a los
   30 dias (D26). `orders/` **nunca** se toca.
7. **Vinculo con la cuenta** (E2/E3 con cuenta): comprar como invitado, crear la cuenta y volver a
   entrar: el historial del invitado (`_pmu_sids`) aparece en la biblioteca del usuario.
8. **Peso (E8)**: en la pestana Test, correr el smoke y leer la linea
   `Biblioteca: peso por identidad (medicion P2/P4)`: identidades, fotos, KB y maximo de
   contenedores por identidad (si supera 10 avisa `revisar P4`). Anotar los numeros: con ellos se
   decide la **cuota** (D20/P2) y si hace falta `ver mas` (P4).

## 6f. Galerías del editor: hojas de miniaturas (009 T013/T023/T028/T032)

Referencia: `specs/009-galerias-sprite-unificado/quickstart.md` §2 (E1–E7) y §4 (mapeo SC).
**Automatico ya corrido (2026-10-24, todo en verde)**: `php tests/certificacion_hoja.php` (checks A–G),
`php tests/motor_smoke.php`, `php -l`, **45 suites** Node y la puerta de navegador
`node tests/galerias.browser.js` (Chrome + Playwright; receta en `modules/textmuy/AGENTS.md` §7.29).
Falta solo la confirmacion en WordPress real:

1. **E1 (SC-002)** sin hoja: respaldar `fonts.json`, borrar `uploads/pmu/fonts/thumbs.webp` y quitarle
   `thumbs.sprite_firma` al inventario; abrir la galeria de fuentes con Network abierto: progreso `N/M`,
   **exactamente 1** `POST op=sprite` (con `firma` y `scope=fonts`), `thumbs.webp` de `720x540` y
   `fonts.json` con `sprite_firma`. Medir vol/time (SC-003: <= 5 MB y <= 60 s).
2. **E2 (SC-001)** F5 + reapertura de las tres galerias: solo `*.json` + `thumbs.webp`; **0** `.ttf/.woff2`,
   0 `<link>` de Google, 0 originales; miniaturas completas en las tres.
3. **E3 (SC-004)** subir un `.ttf`: 1 sola descarga (su archivo) + 1 `op=sprite`; F5 vuelve a E2.
4. **E4 (SC-005)** clic en una celda Google pendiente: 1 `css2?family=...` (sin `wght@` ni `text=`) y la
   celda se redibuja con el tipo real; F5 lo conserva sin descargas.
5. **E5 (SC-007)** provocar el fallo (`chmod -w` en `uploads/pmu/fonts/` o bloquear Google): estado `error`
   con la causa exacta + boton **Reintentar** en la galeria que fallo (fuentes, imagenes y panel de presets);
   al restaurar, el reintento vuelve a E1.
6. **E6 (SC-006)** medir el tile de fuentes: 2 columnas de ~175 px y `alto ~ round(ancho x 30/180) ± 2`;
   en imagenes `1/1` y en presets `2/1`.
7. **E7 (SC-009)** dos pestañas del editor forzando la generacion en ambas: **1** escritura por ambito
   (la segunda espera); y confirmar que **no existen** los botones "Generar miniaturas" ni "Miniaturas".

## 7. Cierre

- [ ] §1 raiz unica OK (T017-parcial + T029-parcial)
- [ ] §2 mockups + circuito estilo OK (T030 §2 + T029-parcial)
- [ ] §3 validez/bloqueo OK (T012-parcial: SC-1..SC-4, SC-7)
- [ ] §4 comprador OK (T030 §3-§6: SC-1..SC-6)
- [ ] §5 snapshot/auditoria OK (T012-parcial: SC-5/SC-6)
- [ ] §6 fallos + respaldo OK (T029-resto)
- [ ] §6b campos reutilizables OK (012 T031: editor, global, cargador, nunca bloquea)
- [ ] §6c editor visual de fotos OK (016 T022: dedos/mouse, cambio de foto, restauracion)
- [ ] §6d campos v4 OK (018 T021/T022: cargador del campo, legacy intacto, tipo editable,
      dos campos de imagen, un modal a la vez)
- [ ] §6d ranura adaptativa OK (019 T016: `phsize` 1/2, degradacion con aviso, aviso de ampliacion)
- [ ] Datos de prueba limpiados (solo `tmp/sesion-*`, `tmp/muestras/*`, `tmp/orders/*`)
- [ ] Al cerrar todo: marcar T030/T012/T017/T029 `[X]` en sus `tasks.md` y archivar
      este archivo a `_archivo/` con fecha.
