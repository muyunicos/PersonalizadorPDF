# Phase 0 Research: Editor de Mockups — vista previa integrada

## R1 — Reutilizar el motor de carga del admin (no crear uno nuevo)

**Decision**: Montar `CargadorPMU` + `SelectorPMU` por grupo reutilizando `apiPreview()`/`montarCargador` de `assets/admin.js` (el mismo camino del preview de Campos), con `tecnico:true`.
**Rationale**: Ya existe y está probado (`tests/campos-contrato.test.js`); evita duplicar lógica de recorte/receta (regla "no duplicados"). El admin no tiene sesión de comprador, así que la subida se mantiene en memoria (objectURL) salvo la persistencia que exija FR-013.
**Alternatives considered**: (a) Reusar la galería `wp.media` actual (rechazado: no simula recorte/encuadre del comprador); (b) crear un endpoint de subida admin (pospuesto; solo si FR-013 lo obliga al persistir recetas).

## R2 — Contenido por instancia y "instancia activa"

**Decision**: Cada instancia de un grupo tiene su propio recorte/receta; la vista previa navega con flechas ‹ › (patrón `ir`/`acotar` de `visor-pmu.js`) y la instancia activa es la que alimenta el mockup.
**Rationale**: Resolución del usuario (clarify Q1 = B). Reutiliza el patrón de navegación del visor ya probado.
**Alternatives considered**: Mismo contenido para todas (rechazado por el usuario); contenido por instancia solo con `repetir` (rechazado: el usuario quiere array siempre).

## R3 — El recorte alimenta el "Procesar PDF" de PRUEBA, no al cliente

**Decision**: El recorte/receta por instancia alimenta la salida de muestra del botón "Procesar PDF" (lo que el admin revisa). NO se entrega al comprador.
**Rationale**: Clarify Q2 del usuario. Preserva Constitución I/III (el entregable del cliente es flujo aparte; el Motor solo inyecta PNGs).
**Alternatives considered**: Preview-only sin tocar Procesar (rechazado: el usuario quiere ver el efecto en la muestra); alimentar el entregable real (rechazado: contradice "no llega al cliente").

## R4 — Motor: inyectar PNGs por instancia sin evaluar JS

**Decision**: El admin compone el recorte de cada instancia en el navegador (Canvas, vía `SelectorPMU`/`PMUMockup`) y envía PNGs al `handle_procesar`; el Motor los inyecta (extiende `id => ruta` a `id => [ruta por instancia]` si hace falta, alineado con el pool `img/{pdf}-{id}-{n}.png`).
**Rationale**: Constitución III (PHP no evalúa JS; Motor solo inyecta PNGs). El naming indexado ya está previsto en §IV.
**Alternatives considered**: Compositor server-side con receta (rechazado: sería otro camino; el de muestra ya renderiza en navegador).

## R5 — Unificación por tipo en la vista previa

**Decision**: `resolverPreview(grupo, instancia)` devuelve `{url,w,h}` según tipo: `texto` → `cfg.previews[gid]` (Probar); `imagen` → recorte local (`onRecorte`) o imagen subida; tipo futuro → fallback genérico. Punto único de extensión.
**Rationale**: FR-004/007. Evita ramas dispersas; un fallo no rompe la consola.
**Alternatives considered**: Mantener el preview separado del texto (rechazado: el usuario pidió unificar y previsualizar texto/futuros).

## R6 — "Alternar PH" espeja la vista previa

**Decision**: `estado.verTexto` (renombrado "Alternar PH") hace que `resolverCapa` del mockup use la MISMA fuente que la vista previa del grupo (R5); con el toggle off, caja neutra. Repinta en `pmu:preview-listo` y al montar el cargador.
**Rationale**: FR-009/010. Fuente única de verdad.
**Alternatives considered**: Mantener `cfg.previews` como única fuente (rechazado: no incluye recorte local de imagen).

## R7 — Ayuda "?" sin plegar el acordeón

**Decision**: `<span class="ec-ayuda-icon" role="button" tabindex="0">?</span>` a la derecha del `summary` (flex, `margin-left:auto`), con `title` + `aria-describedby`; handler que hace `stopPropagation`/`preventDefault` y muestra tooltip; Enter/Espacio la activan.
**Rationale**: FR-002/SC-005. Accesible y no dispara el `<details>`.
**Alternatives considered**: `<button>` dentro de `summary` (funciona con preventDefault); tooltip nativo `title` (simple, sin JS de posicionamiento).

## R8 — Conservar clase `ec-acordeon-mockups`

**Decision**: No renombrar la clase `ec-acordeon-mockups` (ancla de inyección `mockups.js:27` y selector de `tests/aplanado.browser.js`); solo cambiar el rótulo visible y quitar el título interno duplicado.
**Rationale**: Evita romper inyección y test de navegador.
**Alternatives considered**: Renombrar y actualizar tests (más riesgo, sin beneficio).

## R9 — Tests que indexan strings

**Decision**: Actualizar asserts de `mockup-contrato.test.js` a la intención (no al texto exacto), precedente spec 013 T010; correr la batería completa tras cada bloque.
**Rationale**: El contrato indexa strings de `mockups.js`; cambiar markup sin actualizar deja la puerta roja o verde falsa.
**Alternatives considered**: Dejar los asserts (rompe); bajar cobertura (prohibido).