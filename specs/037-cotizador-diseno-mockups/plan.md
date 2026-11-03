# Plan de implementacion: Cotizador — diseno, mockup y favoritos

**Rama**: (sin rama: el repo despliega desde `main`)
**Spec**: [spec.md](./spec.md)
**Estado**: implementada (2026-11-03, 36/40 tareas; ver "Estado de implementacion" en tasks.md)
**Creado**: 2026-11-03

---

## Summary

Convertir el cotizador de stickers en un **consumidor declarado** del plugin y cerrar el circuito
del arte: (1) **contexto `cotizador`** reusando el contexto existente (`data-pmu-panel` +
`PMU_TIENDA`) y agregando **una** clave en el manifest; (2) el comprador **sube su arte** con el
selector existente y **ve un mockup 300x300** compuesto con el nucleo compartido; (3) el **diseno
viaja con el pedido** (original + receta, composicion server-side, promocion a
`orders/{cliente}/`) y el taller lo recupera; (4) la tira "Ideas" pasa a ser **una sola tira con
tres origenes** (tienda, customs del comprador, historial) con estrella sobre cualquier item.

**El Motor no se toca.** El navegador compone **solo la vista previa** (§III); el arte que se
imprime lo compone el servidor a partir del ORIGINAL + receta declarativa.

## Technical Context

- **Lenguaje/stack**: PHP 8 (min. 7.4) en hosting compartido; JS ES5 sin build en `assets/` del
  plugin; el consumidor es la calculadora React/TS con bundle esbuild (repo hermano
  `calculadora`), que **no** vendoriza los modulos del plugin (los pide al plugin).
- **Dependencias**: WordPress + WooCommerce; GD/WebP (ya requisito de 026/035). En el cliente:
  Canvas 2D, `objectURL`, IndexedDB y `localStorage`, sin librerias nuevas.
- **Almacenamiento**: `uploads/pmu/` con `PMU_Uploads` como **dueno unico**. Se agrega
  `orders/{cliente}/customs/` (T000) y `tmp/sesion-{sid}/customs/`. **Sin catalogos nuevos** y
  **sin `manifest.json`** en `customs/`.
- **Endpoints**: los vigentes (`personalizador_pdf_subida`, `_subida_url`,
  `personalizador_pdf_biblioteca`) + **uno nuevo** `admin_post_pmu_cotizador` con `op=`
  (`listar`, `guardar`, `favorito`, `borrar`, `historial`, `promover`). Sin rutas REST.
- **Testing**: puertas del repo (`php -l`, `node --check`, `tests/fotos-contrato.test.js`,
  `tests/biblioteca-contrato.test.js`, `tests/receta-contrato.test.js`,
  `tests/cola-subida.test.js`, `php tests/texto_puente.php`, `motor_smoke`, `parity`) +
  **puertas nuevas**: `tests/cotizador-contrato.test.js` (contexto + ideas) y la fase
  `php tests/texto_puente.php cotizador`; navegador en el lab (`tests/cotizador-pedido.browser.js`).
- **Target**: navegadores modernos con Canvas 2D + IndexedDB; servidor PHP 8.
- **Performance**: **0 KB** de modulos de diseno al abrir el cotizador; **32 KB** gzip al abrir el
  paso; **23 KB** gzip al tocar "Cargar imagen" (medido 2026-11-03).
- **Constraints**: el render del cliente **reusa** `PMUMockup.componer`; el recorte reusa
  `SelectorPMU`; la cola reusa `PMUFotos`; el contexto **nunca** es seguridad (§III).
- **Scale**: no cambia el computo del servidor; agrega como maximo 1 composicion por pedido y
  2 archivos WebP por custom (snapshot + original).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio 300x300, vinculo producto<->PDF, snapshot `manifest.pdfs[]` | **PASS con nota** — el mockup sigue siendo "fotografia simulada 300x300" (D3) y el visto bueno sigue siendo el add-to-cart; el cotizador **no** tiene PDF, asi que `manifest.pdfs[]` queda vacio y el item se marca `contexto='cotizador'` (no se entrega PDF) |
| G2 | §II Un dueno por dato | **PASS** — `PMU_Uploads` sigue dueno de rutas y catalogos; `PMU_Cotizador` es una **fachada** que delega, no un segundo escritor |
| G3 | §III Render en navegador + inyeccion server-side; PHP **nunca** evalua JS | **PASS** — viaja el ORIGINAL + receta declarativa (D2); el servidor compone con GD; el cliente solo compone el mockup de vista previa |
| G4 | §IV Estructura de directorios | **T000 (MINOR)** — se agrega `orders/{cliente}/customs/` al mapa y su linea en `AGENTS.md` §5 **antes** de implementar; no hay ambito nuevo ni catalogo nuevo |
| G5 | §V Sin compatibilidad retro | **PASS** — no hay datos previos de cotizador; `customs/` nace vacio |
| G6 | Constraints tecnicos (PHP puro, GD/WebP, sin nativas) | **PASS** — sin dependencias nuevas; el compositor ya existe |
| G7 | Governance: documentar antes de implementar | **T000** — constitution §IV + `AGENTS.md` §5 en F0 |

**Conclusion (pre-research)**: no hay violaciones de principio; la unica accion normativa es el
patch MINOR del mapa de datos (T000). Se puede pasar a Fase 0.

## Project Structure

### Documentation (esta feature)

```text
specs/037-cotizador-diseno-mockups/
├── plan.md              # este archivo
├── research.md          # Fase 0 (R1-R13)
├── data-model.md        # Fase 1 (entidades + JSON + transiciones)
├── quickstart.md        # Fase 1 (E1-E10)
├── contracts/
│   ├── puente-cotizador.md   # fachada PMU_Cotizador + endpoint unico op=
│   └── customs.md            # idea.json, rutas, retencion, borrado
├── checklists/requirements.md
└── tasks.md             # lo crea /speckit-tasks (NO en este paso)
```

### Source Code (plugin + consumidor)

```text
personalizador-pdf/
├── personalizador-pdf.php        # include de la fachada + hook de contexto + promover_linea
├── inc/
│   ├── class-pmu-cotizador.php   # NUEVO: fachada (contexto, ideas, promover)
│   ├── class-pmu-sesion.php      # + customs (lectura/escritura/migracion) y TTL que las respeta
│   └── class-pmu-uploads.php     # + dir_order_customs() / dir_sesion_customs()
├── engine/
│   └── Compositor.php            # + lienzo explicito para contexto=cotizador
├── assets/                       # sin cambios (los consume el cotizador)
└── tests/
    ├── cotizador-contrato.test.js    # NUEVO (contexto + ideas + rutas)
    ├── texto_puente.php              # + fase `cotizador` (promocion + migracion)
    └── cotizador-pedido.browser.js   # NUEVO (lab: subida -> mockup -> pedido -> tira)

calculadora/ (repo hermano, consumidor)
├── src/components/DesignStep.tsx        # NUEVO (paso 4)
├── src/components/MiniGallery.tsx       # tira unificada (ideas + customs + historial)
├── src/components/AdminMockupsPanel.tsx # NUEVO (fondo + hueco + preview)
├── src/hooks/usePmuAssets.ts            # NUEVO (loader diferido + globals)
├── src/hooks/useClientIdeas.ts          # NUEVO (listar/guardar/favorito/borrar)
└── src/core/mockups.ts                  # NUEVO (resolveMockupFor, sizeToPx, forma)
```

**Structure Decision**: el plugin mantiene su layout (raiz + `assets/` + `engine/` + `inc/`); la
fachada es **una clase nueva** en `inc/`, no un dispatcher nuevo. El consumidor conserva su
estructura React y **no** vendoriza JS del plugin. No se crean proyectos ni carpetas nuevas fuera
de `customs/` (T000).

## Fases (F0-F6)

| Fase | Que hace | Depende de |
|---|---|---|
| **F0** | **T000**: documentar `customs/` en `constitution` §IV + `AGENTS.md` §5. Esqueletos de las puertas nuevas + `php -l` en verde | — |
| **F1** | **Contexto y fachada**: `contexto` en `manifest`, `data-pmu-contexto`, `PMU_TIENDA.contexto`, `PMU_Cotizador` (contexto/assets) + filtro `pmu_cotizador_activo` | F0 |
| **F2** | **Receta y lienzo del cotizador**: `Compositor` con lienzo explicito; receta sintetica (`gid` derivado de categoria+tamano, `phsize=0`, `w/h` en px, `fondo #ffffff`, `transp no`) + validacion | F1 |
| **F3** | **Customs**: `dir_*_customs`, `idea.json`, alta/listado/favorito/borrado, retencion; **sin** `manifest.json` | F1 |
| **F4** | **Pedido**: metas `_pmu_sid`/`_pmu_item_key`/`_mu_diseno_id` en el line item + `promover_linea()` (sin `entregar_por_tema` ni bonus) + migracion invitado->cliente | F2+F3 |
| **F5** | **Consumidor** (repo calculadora): Paso 4 con `CargadorPMU`+`SelectorPMU`, mockup, tira unificada, admin de mockups, carga diferida | F1+F3 |
| **F6** | **Polish**: docs (`AGENTS.md` §5/§9), `INDICE.md`, version, evidencia del lab | F4+F5 |

## Gates (definicion de terminado del plan)

- [ ] `php -l personalizador-pdf.php` + `Get-ChildItem admin, engine, inc -Filter *.php | php -l`
- [ ] `node --check` de los JS tocados (la feature **no** deberia tocar los modulos del cliente)
- [ ] `node tests/cotizador-contrato.test.js` (NUEVA): contexto + ideas + rutas + validacion de receta
- [ ] `php tests/texto_puente.php cotizador` (NUEVA fase): alta de custom, favorito, borrado sin
      huerfanos, promocion, migracion invitado->cliente, idempotencia
- [ ] Regresion: `tests/fotos-contrato.test.js`, `tests/biblioteca-contrato.test.js`,
      `tests/receta-contrato.test.js`, `tests/cola-subida.test.js`, `tests/mockup-contrato.test.js`,
      `tests/vistas-contrato.test.js`
- [ ] `php tests/motor_smoke.php` + `php tests/parity.php` (**el Motor no cambia**)
- [ ] `php tests/sin_lectura.php` + `php tests/estado_pmu.php` (los escaneos ignoran `customs/`)
- [ ] `node tests/cotizador-pedido.browser.js` (lab): subir -> mockup -> comprar -> archivo en
      `orders/{cliente}/{order_id}/{item_key}` + `orders/{cliente}/customs/`
- [ ] `constitution` §IV + `AGENTS.md` §5 actualizados (**T000**, MINOR) **antes** de F1
- [ ] Cotizador: 0 KB de modulos de diseno al abrir (Network del lab)

## Re-check post-design (Phase 1)

| Gate | Re-evaluacion | Estado |
|---|---|---|
| G1 §I | El mockup sigue siendo 300x300 y el visto bueno es el add-to-cart; no hay PDF en el item del cotizador (`manifest.pdfs[]` vacio, `contexto='cotizador'`) | **PASS con nota** |
| G2 §II | `PMU_Cotizador` delega en `PMU_Sesion`/`PMU_Uploads`; un solo escritor por dato | **PASS** |
| G3 §III | La receta viaja declarada y se valida por rango; el servidor compone; el cliente **no** sube bitmap compuesto | **PASS** |
| G4 §IV | `customs/` documentado en T000; sin ambito ni catalogo nuevo; `customs/` sin `manifest.json` para no aparecer en los escaneos | **PASS (con T000 aplicado)** |
| G5 §V | Sin migracion de datos previos | **PASS** |
| G6 | Sin dependencias nativas nuevas | **PASS** |
| G7 | Governance: T000 es la primera tarea del plan | **PASS (plan)** |

**Conclusion**: el diseno no agrega violaciones nuevas. Tareas generadas en
[tasks.md](./tasks.md) (40 tareas, **T000** de gobernanza primero); se implementa con
`/speckit-implement`.

## Riesgos (del research)

| # | Riesgo | Mitigacion |
|---|---|---|
| R1 | El cotizador sube el bitmap compuesto y rompe §III | El contrato solo acepta `imagen` (original) + `params` (receta); el arte se compone server-side |
| R2 | El `item_key` del cotizador entra al ciclo de entrega de PDF | `manifest.contexto='cotizador'` + `promover_linea()` sin `entregar_por_tema()` ni bonus |
| R3 | `customs/` aparece como pedido o como item de sesion | Sin `manifest.json` + escaneos ya exigen nivel numerico (verificado) |
| R4 | El invitado pierde sus customs al vencer `tmp` | El navegador conserva metadata + blob; se re-sube al reabrir |
| R5 | El compositor no sabe el lienzo (no hay `analisis.json`) | `lienzo` explicito para `contexto=cotizador` (F2) |
| R6 | El precio del favorito queda viejo | Se recalcula al cargar y se marca "actualizado" (D7) |
| R7 | Carga de 186 KB en la pagina del cotizador | Diferida por paso (0 / 32 / 23 KB gzip) + estado vacio por CSS |
| R8 | Borrar un custom deja el WebP huerfano | El borrado elimina `idea.json` **y** su snapshot; lo verifica la fase `cotizador` |
| R9 | Dos pestanas escriben el mismo `idea.json` | Escritura atomica (`.tmp` + `rename`) como el resto de los catalogos |

## Complexity Tracking

No hay violaciones que justificar: la feature reusa el motor de render, el selector, la cola, la
biblioteca y el compositor existentes. El unico agregado estructural es `customs/` (T000) y una
clase de fachada.