# Research: Importar página/capa y reemplazar capa/grupo manteniendo transformación

**Feature**: 034-importar-reemplazar-capa · **Fecha**: 2026-10-26

---

## R1 — ¿Qué se conserva y qué se cambia al reemplazar?

**Decisión**: La capa destino conserva **todo menos el recurso (`ref`)**. Se mantienen `x`, `y`, `w`, `h`, `rot`, `sesgo`, `filtros`, `modo`, `nombre`, `oculta`, `bloqueada`, `envoltura`, `grupo`, `grupo_rot` y `perspectiva`. Solo cambia `ref` (a `mock:<id>`), y por coherencia `tipo` pasa a `img` y `envoltura` a `false` (una imagen no tiene clip de PowerClip).

**Rationale**: El pedido es "ocupa el mismo lugar, rotación y perspectivas de destino". Cambiar solo el recurso es lo más predecible y reversible.

**Alternativas**: (a) adaptar también tamaño/posición al nuevo recurso — descartado: el usuario pidió explícitamente mantener las transformaciones. (b) crear capa nueva y borrar la vieja — descartado: rompe el orden z y el historial.

## R2 — ¿Cómo se detecta la selección?

**Decisión**: Nueva función pura `debeReemplazar()` que lee `estado.seleccion` y `estado.seleccionados` (vía `indicesSeleccionados()`) y devuelve `{reemplazar, destino, esGrupo}`:
- sin selección → `{false, null, false}`;
- una capa → `{true, indice, false}`;
- varias capas con el mismo `grupo` → `{true, primerIndice, true}`;
- varias capas sin grupo común → `{true, primerIndice, false}` (regla acordada: la primera).

**Rationale**: `indicesSeleccionados()` ya expande grupos y respeta `soloSeleccion` (Alt+clic). No hace falta lógica nueva de selección, solo decidir el destino.

**Alternativas**: leer `estado.seleccion` a pelo — descartado: no distingue selección múltiple ni grupo.

## R3 — ¿Perspectiva por capa individual?

**Decisión**: **Sí, se habilita**. El renderer (`mockup-render.js:dibujarItem`) ya aplica `capa.perspectiva` por capa individual. Lo que faltaba era la **UI**: hoy `esGrupoPersistido()` exige ≥2 capas con el mismo `grupo` para exponer los cuatro puntos. Se agrega la rama de capa individual.

**Rationale**: Costo bajo (el motor ya lo soporta) y desbloquea el reemplazo de una capa con su deformación.

**Alternativas**: mantener solo grupo — descartado: el usuario lo pidió explícitamente.

## R4 — ¿Qué pasa con un grupo heterogéneo (img + placeholder)?

**Decisión**: Cada capa miembro conserva su propia geometría y su propio `ref` se reemplaza por el nuevo recurso. Si el grupo tiene 3 placeholders, las 3 capas pasan a apuntar a la nueva imagen, cada una en su posición relativa.

**Rationale**: Es la extensión natural de "reemplazar grupo" y respeta el contrato de capas (cada capa tiene su `ref` y su `grupo`).

**Alternativas**: reemplazar el grupo entero por una sola capa — descartado: cambia la estructura y rompe `grupo_rot`.

## R5 — ¿Capa bloqueada?

**Decisión**: No se reemplaza. `bloqueada` existe para proteger capas de cambios accidentales; el editor ya impide mover/redimensionar/rotar una capa bloqueada.

**Rationale**: Coherencia con el resto del editor (tiradores y arrastre ya la respetan).

**Nota de implementación**: `debeReemplazar()` devuelve el destino; el llamador verifica `capas()[destino].bloqueada` y avisa. (Estado actual del código: la verificación de bloqueo en `importarPagina` queda como refinamiento de F2; el caso está documentado en el quickstart R8.)

## R6 — ¿Y sin selección?

**Decisión**: Comportamiento actual intacto: se crea una capa `img` nueva + el grupo de placeholders, como hoy.

**Rationale**: Cero regresión (SC-004). El flujo existente no se toca cuando `planReemplazo.reemplazar === false`.

## R7 — `ref` plano vs namespace

**Decisión**: El `ref` plano (`{color}`) sigue leyéndose como `pdf:{archivo}` (compatibilidad spec 011 v10). El nuevo recurso se guarda **siempre** con namespace: `mock:<id>`.

**Rationale**: No romper mockups previos; el editor siempre escribe namespace desde la spec 020.

## R8 — Efecto en `config.json`, `analisis.json` y `envolturas.json`

**Decisión**:
- `config.json`: se reescribe `mockups[]` con el `ref` cambiado (autoguardado vigente).
- `analisis.json`: **no cambia** (inmutable, Detector).
- `envolturas.json`: **no cambia** (la envoltura es propiedad de la capa, no del hueco).

**Rationale**: El Motor lee `config.json:mockups[]` para la vista previa y `analisis.json`/`envolturas.json` para el PDF; reemplazar una capa del mockup no altera el PDF final ni el dataset.
