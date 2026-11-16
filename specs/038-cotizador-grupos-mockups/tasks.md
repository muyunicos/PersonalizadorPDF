# Tasks: Cotizador — grupos del PDF y mockup propio (038)

**Input**: `specs/038-cotizador-grupos-mockups/spec.md` (D1-D5, FR-044..048, SC-012/013)

**Estado**: fase A cerrada (2026-11-13); fases B y C pendientes.

## Fase A — Grupos (D1, FR-044/045) — CERRADA

- [X] T001 Plugin: `PMU_Cotizador::analisis_bruto()`, `grupos_de_pdf()` y
      `enlazar_diseno(..., $grupo = 'todos')` (una fila por grupo, idempotente por grupo).
      `grupo_de_pdf()` queda como "el de mayor area".
- [X] T002 Plugin: `handle_subida` lee `grupo` del POST y lo pasa a `enlazar_diseno_cotizador()`
      (best-effort, D9). `catalogo_pdfs()` devuelve `grupos` para el selector de la consola.
- [X] T003 Calculadora: `PlantillaCotizador.grupo?: 'todos' | 'auto' | RRGGBB`, saneado en
      `sanitizePlantillas` (default `todos`), enviado por `DesignFields` y elegido en `PlantillaCard`.
- [X] T004 Puerta: fase `cotizador` con un PDF sintetico de 2 grupos -> `grupos_de_pdf` (2), `todos`
      (2 filas), `auto` (1), grupo ajeno (`cotizador:grupo:invalido`); `muestra` (2 grupos reales)
      pasa a 2 filas y la idempotencia se mide por grupo.
- [X] T005 Laboratorio: `circulo6cm` con `todos` -> `grupo_enlazado` `0000FF,FF0000`,
      `grupos_sin_imagen` vacio y 15 imagenes insertadas (antes 8 y un grupo vacio).
## Fase B — "Ya tengo diseno" y forma (pendiente)

- [X] T006 Calculadora: `DesignOption.pideArte` (checkbox en el admin, retrocompatible: si ninguna
      opcion lo declara, el paso se muestra como hoy) y el paso 4 se muestra solo con la opcion que
      lo pide.
- [X] T007 `core/mockups.ts`: `formaDeCategoria(categoria, w, h)` (Circulares -> `circulo`,
      Rectangulares con aspecto ~1 -> `cuadrado`, resto `rectangulo`, `A Medida` -> `auto`) + asserts
      en `tests/core.test.js`.
- [X] T008 `App.tsx` deja de pasar `forma="auto"` fijo; puerta: el contrato del cargador recibe la
      forma derivada.

## Fase C — Mockup propio (pendiente)

- [X] T009 Plugin: `PMU_Cotizador::mockup_local($def)` valida (fondo del catalogo `img/`, hueco
      0..300, forma de la lista) y **sintetiza** capas + grupo con `env_defecto` (circulo = 4 curvas)
      devolviendo el **mismo shape** que `op=mockups`.
- [X] T010 Calculadora: `PlantillaCotizador.mockup{fondo,hueco,forma}` + `requiere`;
      `mockupsDePlantilla()` ordena **PDF primero**; selector si hay mas de uno.
- [X] T011 Consola: fondo (picker del catalogo `img/`), forma, hueco y preview 300x300 en
      `PlantillaCard`.
- [X] T012 Puertas: `cotizador-contrato` (circulo -> 4 curvas; rectangulo -> sin envoltura;
      `requiere='pdf'` sin pdf -> sin mockup), `npm test`, `typecheck` y laboratorio con un mockup
      **sin plantilla** visible en `/cotizador/`.

## Fase D - Categorias y PROMO (2026-11-14)

- [X] **T050** `Config.promo = {desde, pct}` en `types` + saneado en `validation` (se ignora si es invalido).
- [X] **T051** `resolverPromo()` en `priceEngine` (vence solo si supera al descuento por cantidad).
- [X] **T052** `metaDeItem` usa `max(cantidad, promo)`, precio promo cuando gana y badge `PROMO`; tono `promo` en el motor del tema.
- [X] **T053** Panel de admin: % de descuento + desde cuantas unidades (`AdminConfigPanel` + `handleConfigChange`).
- [X] **T054** Puertas: `npm test 37`, `typecheck`, `GALERIA 254`, `VISOR 152/152`.
- [X] **T055** UI: pastilla de categoria en la tarjeta (`categoria` en `MU.coleccion`) y `<select>` del visor con `PROMO` automatica.
- [X] **T056** Titulo editable: `meta.tituloEditable` + `onEditarTitulo` en el motor del tema (D7).

## Fase E — Promos con filtros (Enmienda v5, 2026-11-14)

- [X] **T057** `Promo` en `types` (`material` / `forma` / `tamMin` / `tamMax` / `desde` en planchas /
  `pct` / `activa`) y `promos` en `Config` (con la `promo` vieja como alias de un solo elemento).
- [X] **T058** `promoAplicaA()` + `elegirPromo()` en `priceEngine`: filtra por material, forma,
  **tamaño en AMBOS lados** y planchas; gana la de **mayor %**. La promo vieja (v4) declaraba
  unidades: se marca `desdeUnidades` y se compara contra `totalStickers`.
- [X] **T059** `promoAplicable()` devuelve `PromoElegida`; `calcularPrecio` aplica la promo sobre el
  **total** y expone `precioLista`; `galleryPricing` reporta la promo que ganó (vidriera = carrito).
- [X] **T060** Paridad PHP: `mu_calc_promo_aplica()` en `calculadora-pricing.php` (mismos filtros y
  desempate) con guardia `$sinPromo` para no recursar; `precio-paridad.php` acepta overrides de config.
- [X] **T061** Saneado: `sanitizeConfig` valida `promos` fila por fila y `guardar_datos.php` las
  persiste saneadas (descarta `pct<=0`; nunca rompe el guardado del resto).
- [X] **T062** UI: subpestaña **Promos** en Costos y Tiempos (alta, edición, borrado, activa),
  escribiendo `config.promos` por `onConfigChange`.
- [X] **T063** Puertas: `npm test 39` (filtros + desempate + paridad TS/PHP), `typecheck`, `build:js`,
  `pub:tema`, `php -l` del carrito y de `guardar_datos`.

## Fase G — El descuento se ve (Enmienda v6, 2026-11-14)

- [X] **T064** `PriceResult` expone **`precioLista`** (total de ESA cantidad sin ningún descuento),
  **`ahorroPct`** (% real sobre la lista) y **`promoManda`** (la promo es la que más descuenta).
  `precioLista` se calcula **siempre** (antes sólo con promo), así el tachado aparece también con
  1 plancha.
- [X] **T065** `PriceTable`: la columna `$/plancha` pasa a **`precioLista / planchas`** (estable, no se
  aplasta con la promo) y el `Ahorro` de cada fila es el **`ahorroPct`** de esa fila (promo + escala).
- [X] **T066** `OrderSummary` (Total Estimado): **tachado** contra `precioLista` y **badge en la
  esquina superior derecha** (`-N%`), **oro** si manda la promo y **esmeralda** si es sólo escala.
- [X] **T067** Tema: `.mu-gal-badge--promo` (y su variante `cotizador`) pasa a **ORO**
  (`--mu-gal-oro-bg` / `--mu-gal-oro-texto` / `--mu-gal-oro-borde`), el verde queda para el ahorro por
  cantidad. En el tema `cotizador` el badge es la columna 3 de la grilla.
- [X] **T068** Puertas: `npm test 40` (precioLista/ahorroPct/$/plancha estable), `typecheck`, `build:js`,
  `pub:tema`, `GALERIA 247`, `VISOR 152/152`.

## Fase H — `precioLista` es REGULAR PURA (Enmienda v6, 2026-11-14)

- [X] **T069** `precioLista` deja de usar el neto de la fila (que incluia la escala) y pasa a ser
  **`$/u de 1 plancha x unidades de esa cantidad`**: la referencia *regular pura*, sin promo y sin
  escala. Es el mismo numero contra el que la promo compara internamente.
- [X] **T070** `ahorroPct` pasa a medir el **descuento total** sobre esa lista, asi **crece con la
  cantidad** (antes decrecia porque solo medía lo que la promo agregaba encima de la escala). El
  `$/plancha` de la tabla es `precioLista / planchas` → **constante** en todos los escalones.
- [X] **T071** `round2` del porcentaje: estaba multiplicando por 10000 y dividiendo por 100 (4
  decimales); ahora son 2 decimales reales.
- [X] **T072** Puertas: `npm test 40` (caso v6 con `precioLista = 15,75 x 40 = 630`, `ahorroPct`
  creciente y `$/plancha` estable) y verificación con el catálogo real
  (`Circulares 5 cm`: `$/plancha` **$4.438** en 1/2/5/10; ahorro 0/24/38/43% sin promo; con promo
  30% → 30/30/38/43% — gana la escala desde las 5 planchas; con 50% → 50% en todas).

## Fase I — Lo que el cliente ve (Enmienda v6, 2026-11-14)

- [X] **T073** Badge del **Total Estimado**: estaba `absolute top-2 right-2` y se **pisaba** con el
  número y con el rótulo (medido: `badge.bottom = 38`, `num.top = 38`). Ahora va en la **fila del
  rótulo** (`flex justify-between`): `badge.bottom = 42` vs `num.top = 55` → 13 px de aire,
  `solapaConNumero: false` y dentro de la tarjeta.
- [X] **T074** **PROMO automática** en la tira (`D6`): `categoriaDe(item, promo)` devuelve `PROMO`
  cuando la promo del admin gana, sin que el admin declare nada; si el item ya trae categoría
  (`GUARDADO`/`COMPRADO`), esa manda.
- [X] **T075** Título del cliente (`D7`): `useClientIdeas.renombrar(id, titulo)` reusa `op=guardar`
  con el id existente (no hay endpoint nuevo ni se duplica la idea) y `TiraIdeas` permite
  **editarlo en la tarjeta** (lápiz → input, Enter guarda, Escape cancela) sólo en items propios.
- [X] **T076** Categoría `PROMO` en **oro** también en la pastilla de la celda
  (`.mu-gal-item-cat--promo`), igual que el badge del visor: el verde queda para `COMPRADO`.
- [X] **T077** Puertas: `npm test 40`, `typecheck`, `build:js`, `pub:tema`, `GALERIA 257`,
  y bundle verificado en `/cotizador/` (contiene `GUARDADO`, `COMPRADO`, `PROMO`, `renombrar`).

## Fase J — La promo "no se pierde" y la tabla de 2 columnas (v7, 2026-11-14)

- [X] **T078** `galleryPricing` calcula la referencia con `calcularPrecioNeto` (sin promo) y expone
  `precioLista`, `ahorroPct`, `promoManda` y **`promoActiva`**. Antes la base salía promo-descontada:
  `perUnitBase` quedaba igual al final y el ahorro daba **0%** (por eso la celda 0 mostraba `PROMO`
  sin `-N%` y con `antes == ya`).
- [X] **T079** Regla nueva: desde que la promo está **vigente** (`desde` alcanzado) el badge es **ORO**
  aunque el descuento por cantidad sea mayor; el precio sigue siendo el mejor de los dos. Medido con
  promo 30% desde 1 plancha: 1→-30% oro, 2→-30% oro, 3→-32%, 5→-38%, 10→-43%, **monótono creciente**
  (`monotone: true`) y `$/plancha` bajando 3.107 → 2.523.
- [X] **T080** Texto del badge **siempre `-N%`** (antes anteponía `PROMO`): el **color** dice si es
  promo (oro) o escala (verde), tanto en la tabla como en el visor y la celda.
- [X] **T081** `PriceTable` a **2 columnas** (`Planchas` · `Precio`): la fila muestra `N (unidades)` +
  chip `Tu pedido`, y el precio es **`$X c/u` con el descuento aplicado** (antes mostraba el de lista
  y quedaba constante). Sin tachado del regular. Badge del ahorro junto al precio.
- [X] **T082** Paridad PHP: `mu_calc_compute_price` marca `promo.manda` y aplica el mismo criterio
  (promo vigente = badge, precio = mejor de los dos); `precio-paridad.php` acepta overrides de config.
- [X] **T083** Puertas: `npm test 40` (+ caso v6: `precioLista` regular pura, ahorro creciente,
  `$/plancha` estable), `typecheck`, `php -l` del carrito, `build:js`, `pub:tema`, `GALERIA 258`.
  Laboratorio: tabla de 2 columnas con 6 escalones, precios 2.510→1.480 y **badge oro en todas** las
  filas con promo vigente.

## Fase K — La tarjeta de la tira (Enmienda v6, 2026-11-14)

- [X] **T084** La **categoría** y el **descuento** van **juntos arriba de la foto** ( esquina
  superior izquierda), no en el cuerpo: `mu-gal-item-top` agrupa `.mu-gal-item-cat` + el pill
  `-N%`. Medido en el lab: `cat.cy = promo.cy = 466`, sin solaparse (`cat.r=156 ≤ promo.l=162`).
- [X] **T085** Las **unidades** viven en la **misma fila que el precio** (`30 u · $9.063  $6.935`),
  no en una fila aparte; se retira `mu-gal-item-lote` del motor y se agrega `.mu-gal-item-sep`.
  Medido: `uni.cy = ya.cy = 593`.
- [X] **T086** El pill `-N%` de la celda es **oro** cuando la promo del admin es la que manda
  (`.mu-gal-item-promo--oro`); el ahorro por cantidad sigue esmeralda.
- [X] **T087** Puertas: `GALERIA 258`, `VISOR 152/152` y laboratorio con 2 promos sembradas
  (30% Circulares 3–6 y 50% m1 5–6): celda 0 → `[PROMO] [-50%] … 30 u · $9.063 $4.531`.
## Fase L — El puente del cotizador (Enmienda v7, 2026-11-16)

Tres bugs REALES que dejaban el paso de diseno fuera de combate. Se encontraron
midiendo el lab, no leyendo codigo.

- [X] **T088** El shortcode del tema NO inyectaba el puente: `WP_STICKER_DATA` traia
  `isAdmin/assetsUrl/configUrl/saveUrl` y **nada mas**, asi que `PMU_DISPONIBLE` era
  falso y `App.tsx` no renderizaba la seccion "Tu diseno". Ahora `mu_cotizador_puente()`
  agrega `pmu{baseUrl,ajaxUrl,postUrl,nonce}` (nonce = `PMU_Cotizador::NONCE`), y solo
  si `class_exists('Personalizador_PDF_Plugin')`: sin plugin no se inyecta y el paso
  degrada a WhatsApp (D9) en vez de apuntar a un endpoint muerto.
- [X] **T089** El checkbox "Pide arte al cliente" **no persistia**: `sanitizeDesignOptions`
  (validation.ts) reconstruia el objeto y **omitia `pideArte`**; el PHP si lo conserva.
  Agregada la linea + comentario con la causa.
- [X] **T090** `DesignFields.onChange` leia `estado.ranuras[].ids`, pero
  `CargadorPMU.prototype.estadoActual()` devuelve `{ids, listo, faltan, minTotal, array,
  ranuras:<numero>}`. El `.flatMap` sobre un numero lanzaba TypeError y el cargador no
  montaba. Ahora lee `estado.ids`.
- [X] **T091** `PMU_Cotizador::assets()` retirado: **nadie lo llamaba** (el bundle carga
  los modulos solo, D10). Su invariante ("6 modulos, NUNCA tienda.js/campo-montar.js")
  se migro a `tests/core.test.js`, que es donde hoy vive la lista.
- [X] **T092** Nombre de la tira: default **"Sugerencias"** (antes "Ideas y favoritos").
- [X] **T093** Puertas: `FASE cotizador OK`, `FASE pedido OK`, `COTIZADOR CONTRATO 30`,
  `npm test 41` (+ D10), `typecheck`, `php -l` (0), `GALERIA 258`, `COTIZADOR ASSETS 8`.
  Laboratorio: puente en el HTML, seccion "Tu diseno" presente, 6 modulos 200, y
  **subida real** de `foto_a.png` -> `admin-ajax` `success:true` con id
  `53a1d7fe6869`, `uploads/53a1d7fe6869.webp` (1060 B) y `cot-cb6363b7/manifest.json`
  con `origen: original`.

### Lo que NO se cerro (a proposito)

- **T094** (pendiente) Recorrido completo del **selector** hasta la miniatura del
  `.cpmu`: la subida llega al servidor, pero el id no vuelve al cargador porque el
  automatismo salteo el paso de recorte del selector. Hace falta un `.browser.js` que
  haga el flujo real (arrastrar/mover el recorte y confirmar) y compruebe que aparece
  la miniatura y `diseno` se publica.
- **T095** (pendiente) El **modal de bienvenida/pais del tema** se superpone al cotizador
  y bloquea los clicks (se ve en cada corrida). No es del cotizador, pero molesta:
  conviene que no se muestre dentro de `/cotizador/`.

## Fase M — El circuito del arte (Enmienda v8, 2026-11-16)

- [X] **T096** El admin baja la **COMPUESTA** (recorte + forma aplicados):
  `ruta_descarga_pedido()` la prefiere y cae al original si no existe o no se puede
  componer (nunca rompe la descarga). La compuesta se **materializa bajo demanda**
  (`materializar_composiciones`, cache por nombre).
- [X] **T097** Segundo link **"Descargar original"** (`tipo=original`) en el bloque
  "Diseno del cotizador" del pedido: los originales siguen disponibles como datos
  del cliente.
- [X] **T098** Aviso de **invitado** en el pedido (`customer_id = 0`): sin carpeta de
  cliente los archivos quedan en `tmp/` y vencen a los 30 dias.
- [X] **T099** Cierre del **recorrido real** (antes T094): `.browser.js` contra el lab
  (anonimo) — `.cpmu-agregar` → `.spmu-file` → recorte → `.spmu-ok` → **miniatura en
  `.cpmu`** (`mini: 1`, `imgs: 1`, sin "Faltan 1"), `admin-ajax` `success:true` y
  `uploads/{id}.webp` en la sesion.
- [X] **T100** Quinto bug del circuito: al publicarse el `diseno`, React **remontaba**
  el cargador y la ranura arrancaba vacia ("Faltan 1" con la imagen ya subida).
  `DesignFields` manda `idsIniciales` con el id ya subido.
- [X] **T101** Puertas: `FASE cotizador OK` (+6 checks de T096-T098), `FASE pedido OK`,
  `COTIZADOR CONTRATO 33`, `npm test 41`, `typecheck`, `php -l` (0), `GALERIA 258`,
  `COTIZADOR ASSETS 8`.