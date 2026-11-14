# Spec 038 — Cotizador: grupos del PDF y mockup propio

> Estado: **implementada (fases A, B y C)** (2026-11-13).
> Construye sobre la [037](../037-cotizador-diseno-mockups/spec.md) (contexto cotizador, plantilla
> importada, Enmienda v3) y sobre la 011/036 (nucleo de render compartido y aplanado del cliente).
> **Decisiones del negocio (2026-11-13)**: (1) el arte va a **todos** los grupos de la plancha por
> defecto; (2) **un solo catalogo** (la plantilla lleva `pdf?` + `mockup?`); (3) una personalizacion
> puede tener **varios** mockups: primero los del PDF, despues los locales.

## 1. El problema

1. La Enmienda v3 de la 037 enlaza el arte con **un** grupo del PDF (el de mayor area). Una plancha
   real puede tener **varios** (`circulo6cm` del laboratorio tiene **dos**): el segundo queda
   **transparente** y el trabajo de imprenta sale incompleto.
2. El mockup depende de que exista un PDF: `op=mockups` exige un PDF y el catalogo solo lista PDFs
   con mockups. Sin plantilla no hay mockup, aunque el negocio quiera mostrar la escena.
3. El catalogo no expresa condiciones ("solo con arte", "solo si hay PDF") ni orden entre mockups.
## 2. Decisiones

| # | Decision |
|---|---|
| **D1** | **`todos` por defecto**: con plantilla, el arte se registra en **todos** los grupos del PDF (una fila `compuesta` por grupo, `indice 0`; el Motor replica). La plantilla puede pedir `auto` (grupo mayor) o un `RRGGBB` concreto. |
| **D2** | **Un solo catalogo**: `PlantillaCotizador` = `{id, titulo, categoria, rango?, orden, visible, pdf?, mockup?, requiere?, grupo?}`. Sin segundo catalogo ni duplicacion. |
| **D3** | **Varios mockups**: primero los del **PDF** (Editor, en su orden), despues los **locales**; se muestra el primero y, si hay mas de uno, un selector. |
| **D4** | **El servidor sintetiza el mockup local**: a partir de `{fondo, hueco, forma}` devuelve el **mismo shape** que `op=mockups` (capas + grupos + imagenes), con la **envoltura del circulo** (4 curvas) cuando la forma lo pide. El cliente no aprende un formato nuevo. |
| **D5** | **`requiere` es visibilidad**, no render: `arte` (solo con arte subido), `pdf` (solo si la plantilla tiene PDF), `null` (siempre). |
## 3. Requisitos

- **FR-044**: con plantilla y `grupo = "todos"` (default), el sistema DEBE registrar la composicion
  en **todos** los grupos del PDF; `auto` en el de mayor area; un `RRGGBB` solo si pertenece al
  analisis; un grupo ajeno DEBE fallar con `cotizador:grupo:invalido`.
- **FR-045**: la operacion DEBE ser **idempotente por grupo** (re-enlazar reemplaza, no acumula).
- **FR-046**: el catalogo DEBE aceptar una plantilla **sin PDF** y mostrar su mockup local si cumple
  `requiere` y el rango.
- **FR-047**: con varios mockups aplicables, el orden DEBE ser **PDF primero** y local despues, y el
  comprador DEBE poder cambiar de mockup sin perder su arte.
- **FR-048**: el payload del mockup local DEBE validarse en el servidor (fondo existente en el catalogo
  `img/`, hueco 0..300, forma de la lista) y **nunca** aceptar rutas del cliente.

## 4. Criterios de exito

- **SC-012**: una plancha de **2+** grupos sale **completa**: `grupos_sin_imagen` vacio y las
  instancias de todos los grupos con el arte.
- **SC-013**: un mockup configurado **sin PDF** se muestra al comprador y su arte se compone igual.
## 5. Estado

| Fase | Alcance | Estado | Evidencia |
|---|---|---|---|
| **A** | Grupos `todos`/`auto`/HEX + `grupos_de_pdf` + `grupo` en la subida + selector en la consola | **Implementada** (2026-11-13) | `FASE cotizador OK` (12 checks), `FASE pedido OK`, `SMOKE`, `PARIDAD`, `SIN_LECTURA`, `COTIZADOR CONTRATO 31`, `npm test 34`, `typecheck`; laboratorio: `circulo6cm` -> `grupo_enlazado` `0000FF,FF0000`, **`grupos_sin_imagen: []`**, 15 imagenes insertadas |
| **B** | Rama "Ya tengo diseno" (`pideArte`) + `forma` derivada de la categoria | **Implementada** (2026-11-13) | `npm test 35` (incluye `formaDeCategoria`), `typecheck`, `build:js`; el paso 4 se oculta salvo que la opcion pida arte (retrocompatible) |
| **C** | Mockup propio sin PDF + `requiere` + orden PDF-primero | **Implementada (C1+C2+C3)** (2026-11-13) | C1: `mockup_local()` + `op=mockups&local` (6 checks). C2: `mockupsDePlantilla()` + `useMockupLocal()` + preview con indice y chips. C3: la consola configura fondo/forma/hueco/requiere en `PlantillaCard`. Puertas: `FASE cotizador OK`, `npm test 36`, `typecheck`, `build:js` | C1: `mockup_local()` + `op=mockups&local` con 6 checks en la fase `cotizador`. C2: `mockupsDePlantilla()` (PDF primero + `requiere`), `useMockupLocal()`, `MockupPreview` con indice y chips; `npm test 36`, `typecheck`, `build:js` |