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
