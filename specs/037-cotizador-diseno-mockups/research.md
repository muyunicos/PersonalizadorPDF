# Research (037) — Contexto, receta y almacenamiento del cotizador

> Fase 0 de [plan.md](./plan.md). Cada decision resuelve un punto del `Technical Context` y de la
> spec. Las mediciones son del **2026-11-03** sobre este checkout.

## R1 — Como se entera el plugin de que lo usa el cotizador

- **Decision**: reusar el contexto que ya existe y agregar **una** clave. `data-pmu-panel` +
  `data-pmu-contexto="cotizador"` en el DOM, `PMU_TIENDA.contexto = 'cotizador'` en JS y
  `manifest.contexto = 'cotizador'` en los datos. **No** se reusa `subidas[].origen`.
- **Rationale**: `data-pmu-panel` ya es el ancla que prefija el CSS global y la que calienta la
  cache de la biblioteca (`biblioteca-pmu.js:278`); `PMU_TIENDA` ya es el objeto que leen todos los
  modulos (`personalizador-pdf.php:963`), asi que una clave nueva es retrocompatible (las
  desconocidas se ignoran). `subidas[].origen` tiene un vocabulario cerrado de la 035
  (`original`/`compuesta`/`ref`) que los `switch` leen: agregarle `cotizador` los rompe.
- **Alternativas descartadas**: (a) atributo DOM solo → no sobrevive al servidor; (b) global nuevo
  (`PMU_COTIZADOR`) → un cuarto objeto de contexto que hay que mantener; (c) reusar
  `subidas[].origen` → colision semantica con la 035.

## R2 — Fachada en vez de hooks dispersos

- **Decision**: `PMU_Cotizador` (`inc/class-pmu-cotizador.php`) con superficie minima:
  `contexto()`, `assets()`, `guardar_idea()`, `listar_ideas()`, `favorito()`, `borrar_idea()`,
  `promover_linea()`, `activo()`. Filtro `pmu_cotizador_activo` para apagarla sin deploy.
- **Rationale**: el consumidor no debe conocer internos (`PMU_Sesion` es `private` en el plugin);
  la fachada **delega** en `PMU_Sesion`/`PMU_Uploads` (un solo escritor por dato, §II) y concentra
  el contrato en un archivo verificable.
- **Alternativas descartadas**: (a) el cotizador llama a `admin_post_personalizador_pdf_biblioteca`
  y arma rutas por su cuenta → segundo escritor; (b) hooks sueltos en `personalizador-pdf.php` →
  contrato implicito; (c) iframe del panel → el modal `position:fixed` queda atrapado y no hay
  `postMessage`.

## R3 — Donde viven los customs (favoritos) del cliente

- **Decision**: `orders/{cliente}/customs/{idea_id}/` con `idea.json` + `mockup.webp`, **sin**
  `manifest.json`. Para invitados: `tmp/sesion-{sid}/customs/` con la misma forma.
- **Rationale**: `orders/{cliente}/` ya es "la carpeta del cliente" (datos.json + uploads/) y el
  escaneo de pedidos exige nivel **numerico** en los dos niveles
  (`pedidos_completados()`, `personalizador-pdf.php:3385-3395`); `biblioteca_contenedores()`
  (`:2177-2186`) hace lo mismo. Un `customs/` sin `manifest.json` no aparece como item de sesion.
- **Verificado**: `tests/estado_pmu.php` e `tests/inventario_pmu.php` solo miran `pdfs/` y la raiz.
- **Alternativas descartadas**: (a) ambito nuevo `uploads/pmu/customs/` → catalogo y dueno nuevos
  (lo que la 030 D1 evito); (b) `datos.json` del cliente → mezcla biblioteca de fotos con ideas y
  obliga a reescribir todo el archivo; (c) solo `localStorage` → no cumple "guardar en el servidor
  como preferencia del cliente".

## R4 — Invitado: navegador + temporal, adopcion en la primera compra

- **Decision**: el invitado escribe en su navegador (metadata + blob para re-subir) y en
  `tmp/sesion-{sid}/customs/`. En la primera compra (`customer_id > 0`) se **adoptan** sus customs
  a `orders/{cliente}/customs/` y el item a `orders/{cliente}/{order_id}/{item_key}/`.
- **Rationale**: la 035 D5 ya decidio que sin `customer_id` no hay promocion; en vez de inventar
  una carpeta paralela, se extiende el momento de la promocion. El navegador cubre el caso "no
  compro y vencio el TTL".
- **Alternativas descartadas**: (a) exigir cuenta para guardar un favorito → friccion en el paso
  que mas conversion aporta; (b) solo `tmp` → se pierde a las 24 h; (c) solo navegador → no hay
  preferencia del cliente en el servidor.

## R5 — El arte viaja como ORIGINAL + receta (y el lienzo es explicito)

- **Decision**: el cotizador sube el **original** y una **receta v2**; el servidor compone el arte
  a imprimir. `Compositor::componer()` acepta un **lienzo explicito** cuando
  `contexto = 'cotizador'` (no hay `analisis.json` del que derivarlo).
- **Rationale**: §III prohibe que el bitmap compuesto por el cliente sea el entregable; ademas el
  original permite recomponer si el admin re-imprime. Hoy `Compositor` deriva `w/h` de
  `analisis.json` + `phsize` (035 C1), que en el cotizador **no existe**: sin lienzo explicito el
  compositor no puede escalar.
- **Alternativas descartadas**: (a) subir el bitmap compuesto → rompe §III y pierde el original;
  (b) segundo compositor en el cliente → rompe §II (un solo nucleo).

## R6 — Receta sintetica del cotizador

- **Decision**: `gid` = 6 hex derivados de `sha1(categoria|size)` (mayusculas, primeros 6),
  `phsize = 0`, `w/h` = pixeles del sticker a 300 ppp (redondeados), `forma` = la de la categoria
  (`rectangulo` en v1 para "Formas"), `modo` = el del selector (`cubrir` por defecto),
  `ox/oy` = los del selector, `fondo = '#ffffff'`, `transp = 'no'`, `rot` = el del selector
  (0/90/180/270), `iw/ih` = medidas del original.
- **Rationale**: `PMU_Sesion::receta_validar()` exige `gid ^[0-9A-F]{6}$`, `phsize 0..2`, `rot` en
  el conjunto, `modo` en `{cubrir,encajar,estirar}`, `escala 0.25..4`, `ox/oy -4..5` y
  `transp si|no`. Derivar el `gid` de categoria+tamano lo hace **estable** entre pedidos, asi el
  nombre del archivo compuesto (`img/foto-{...}-{receta}.webp`) cachea bien y el admin reconoce la
  misma medida.
- **Alternativas descartadas**: (a) `gid` fijo (`000000`) → colisiona entre tamanos y pierde la
  cache por nombre; (b) receta v3 → obliga a tocar el contrato de la 035 sin necesidad.

## R7 — Promocion sin el ciclo de PDF

- **Decision**: `promover_linea($order_id, $item_key)` mueve el item y los originales reusando
  `mover_originales()` + `rename` de `PMU_Sesion`, **sin** `entregar_por_tema()` ni
  `congelar_bonus_item()`.
- **Rationale**: `pedido_promover()` (`personalizador-pdf.php:3057-3103`) recorre line items con
  `_pmu_sid` + `_pmu_item_key` y ademas entrega PDFs y congela bonus; en un item de cotizador eso
  no aplica (no hay PDF) y produce artefactos ruidosos. Reusar el movimiento y saltear la entrega
  mantiene una sola implementacion de rutas.
- **Alternativas descartadas**: (a) usar `pedido_promover()` tal cual → try/catch con logs y
  efectos laterales; (b) promover desde el plugin de la calculadora → duplicaria rutas de la 035.

## R8 — Precio vivo sin trabajo de servidor

- **Decision**: el precio de cada tarjeta se **recalcula en el navegador** al cargar con la misma
  funcion pura del cotizador (`galleryPricing`), contra el catalogo vigente; se guarda una foto
  (`precio` + `ts`) y se muestra "actualizado" cuando el numero difiere.
- **Rationale**: el catalogo ya se pide con ETag (`datos_config_etag.php`), asi que recalcular es
  gratis y siempre correcto; un precio congelado en el servidor se desactualiza y uno recalculado
  en el servidor duplicaria la logica de precios fuera del cotizador (que es el unico dueno).
- **Alternativas descartadas**: (a) congelar el precio → ofertas vencidas; (b) recalcular en PHP →
  segunda implementacion del motor de precios.

## R9 — Carga diferida (medida)

- **Decision**: 0 KB de modulos de diseno al abrir; al abrir el paso se cargan `mockup-render` +
  `selector` (con `preload` al abrir, no al hacer clic); al tocar "Cargar imagen", el resto. El
  estado vacio del mockup es **CSS** (fondo + hueco), sin JS.
- **Rationale**: medido el 2026-11-03 (raw / gzip): `selector` 93/24,1 KB · `cargador` 36/9,7 ·
  `biblioteca` 17/5,5 · `visor` 11/3,4 · `mockup-render` 29/8,1 · `fotos` 16/4,6. Subconjunto
  completo: **186 KB raw ≈ 51 KB gzip**; por paso: 0 / 32 / 23 KB. `tienda.js` (107 KB) y
  `campo-montar.js` no se cargan.
- **Alternativas descartadas**: (a) encolar todo como la ficha (`assets_ficha()`) → 53 KB gzip en
  una pagina que la mayoria no usa para disenar; (b) vendorizar en el bundle de la calculadora →
  duplica el nucleo y se desincroniza.

## R10 — El mockup del cotizador lo define el cotizador

- **Decision**: la definicion del mockup (fondo + hueco + forma, por categoria y opcionalmente por
  tamano) vive en el catalogo del **cotizador** (`datos_config.json`) y se le pasa a
  `PMUMockup.componer` en el navegador. El plugin **no** guarda mockups de cotizador.
- **Rationale**: el plugin indexa sus mockups por **PDF** (`config.json:mockups[]`,
  `pdfs/{nombre}/mockups/`), y el cotizador no tiene PDF. Guardarlos ahi obligaria a inventar un
  PDF ficticio. El nucleo de render es agnostico: recibe capas + `resolver`.
- **Alternativas descartadas**: (a) reusar un PDF ficticio → ensucia la consola y el aplanado;
  (b) ambito nuevo de mockups en el plugin → catalogo nuevo sin dueno natural.

## R11 — Borrado de un custom sin huerfanos

- **Decision**: `borrar_idea($idea_id)` valida la identidad, borra `idea.json` y el `mockup.webp`
  de esa idea, y devuelve `{borrado:true, archivos:1|2}`. El original compartido **no** se borra si
  otro custom o un pedido lo referencia (misma regla que `podar_subidas` de la 035).
- **Rationale**: el snapshot del mockup es propio de la idea; el original puede estar compartido
  por dedupe (sha), asi que borrarlo por reflejo romperia otra tarjeta.
- **Alternativas descartadas**: (a) borrar solo el JSON → huerfano; (b) borrar todo el contenedor
  de la familia → rompe customs hermanos.

## R12 — Identidad reusada

- **Decision**: la misma identidad que la biblioteca (cookie `pmu_sid` + `uid` + pedidos), leida
  con la logica vigente de `biblioteca_identidad()`. Los customs del invitado salen de
  `tmp/sesion-{sid}/customs/`; los del cliente, de `orders/{cliente}/customs/` y se **suman** los
  temporales de la sesion vigente (por si esta a mitad de una compra).
- **Rationale**: una sola definicion de "quien es el comprador" evita que la biblioteca y los
  favoritos muestren cosas distintas.
- **Alternativas descartadas**: (a) identidad por `customer_id` solamente → el invitado no puede
  guardar nada; (b) identidad por navegador solamente → se pierde al cambiar de dispositivo.

## R13 — La tira: una superficie, tres origenes

- **Decision**: la tira visible mezcla items de la tienda, customs e historial con **el mismo
  formato de tarjeta**; la estrella aplica a **cualquier** item y ordena al inicio; el nombre es
  configurable por el admin (propuesta "Ideas y favoritos").
- **Rationale**: es lo que pidio el negocio y reduce el costo de la UI: una tarjeta, un `onUse`,
  un `getPricing`. El orden se resuelve con un comparador puro (favorito, luego origen, luego
  fecha) testeable en Node.
- **Alternativas descartadas**: (a) tres tiras separadas → mas superficie y el cliente no ve sus
  favoritos primero; (b) estrella solo en customs → el cliente no puede marcar una idea de la
  tienda.

## Hallazgos verificados (2026-11-03)

| Hallazgo | Evidencia |
|---|---|
| Los escaneos de `orders/` saltean `customs/` | `pedidos_completados()` exige `ctype_digit` en nivel 1 y 2 (`personalizador-pdf.php:3385-3395`); `biblioteca_contenedores()` en nivel 2 (`:2177-2186`) |
| `customs/` sin `manifest.json` no aparece como item de sesion | `biblioteca_contenedores()` lee `manifest.json` via `leer_manifest()` y descarta lo que no es array |
| Ya existe un objeto de contexto en el cliente | `PMU_TIENDA` (`personalizador-pdf.php:963-970`) y `[data-pmu-panel]` (`:645`) |
| `subidas[].origen` es vocabulario cerrado de la 035 | `class-pmu-sesion.php:456/476/492/990/1089` |
| El compositor deriva el lienzo de `analisis.json` | `specs/035.../contracts/fotos-originales.md` C1 y C8 |
| La promocion ya existe y mueve originales | `PMU_Sesion::promover_order()` (`class-pmu-sesion.php:1459`) + `pedido_promover()` (`personalizador-pdf.php:3057`) |
| Los modulos suman 186 KB raw / 51 KB gzip | medicion con gzip sobre los 6 archivos (tabla en R9) |
| La subida ya deduplica, acota a 2000 px y convierte a WebP con alfa | `PMU_Sesion::guardar_subida()` / `convertir_webp()` |

## Pendientes de research

Ninguno bloqueante. Quedan como parametros de producto (no de arquitectura), ya fijados en el
Anexo C de la spec: nombre visible de la tira y orden fino entre origenes.