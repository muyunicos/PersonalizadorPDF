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
