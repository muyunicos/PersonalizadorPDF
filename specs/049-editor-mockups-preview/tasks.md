---
description: "Task list for Editor de Mockups — vista previa integrada y ayuda contextual"
---

# Tasks: Editor de Mockups — vista previa integrada y ayuda contextual

**Input**: Design documents from `/specs/049-editor-mockups-preview/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Las puertas del proyecto (`node --check`, `node tests/*.test.js`, `php -l`, `motor_smoke`, `texto_puente`, `aplanado.browser.js`) son obligatorias por AGENTS.md §9; se corren como verificación tras cada bloque (no hay fase TDD separada).

**Organization**: Tareas agrupadas por historia de usuario (P1→P3) para implementación y prueba independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1/US2/US3
- Rutas exactas en cada descripción

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirmar entorno y línea base: `pwsh` 7.x, `php -l personalizador-pdf.php`, `node --check assets/admin.js`, `node tests/mockup-contrato.test.js`, `node tests/mockup-geometria.test.js` (todo en verde antes de empezar).
- [X] T002 [P] Bump de versión en la cabecera `* Version:` de `personalizador-pdf.php` (fuente única, §10.bis) por el cache-bust de estáticos.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: completar antes de cualquier historia.

- [X] T003 Exponer `data-cont="<?php echo (int)$g['cont']; ?>"` y `data-campo` (id de campo asociado, 0 si ninguno) en `.ec-panel-grupo` de `admin/pdfs.php` (lo consumen US2/US3).
- [X] T004 [P] Agregar tokens CSS compartidos para `.ec-ayuda-icon` (margin-left:auto) y `.ec-preview-nav` (flechas ‹›) en `assets/admin.css`.

**Checkpoint**: datos y estilos base listos; las historias pueden avanzar.

---

## Phase 3: User Story 1 - Editor como acordeón propio con ayuda "?" (Priority: P1) 🎯 MVP

**Goal**: El editor se presenta como acordeón "Editor de mockups" con la descripción en un icono "?" accesible.

**Independent Test**: Abrir la pestaña PDFs: acordeón titulado "Editor de mockups", sin párrafos de descripción en el cuerpo, icono "?" con ayuda por hover/teclado sin plegar el acordeón; sin título interno duplicado.

- [X] T005 [US1] En `admin/pdfs.php` (612-634): cambiar el texto del `<summary class="ec-acordeon-cab">` a "Editor de mockups" y mover las dos `<p class="description">` a un `<span class="ec-ayuda-icon" role="button" tabindex="0" aria-label="Ayuda">?</span>` con `title` + `aria-describedby`; conservar la clase `ec-acordeon-mockups`.
- [X] T006 [US1] En `assets/mockups.js` `plantilla()` (341-346): quitar el `<span class="ec-mk-cab-titulo">Editor de mockups</span>` (título interno duplicado), dejando Guardar + estado.
- [X] T007 [US1] En `assets/admin.css`: estilos de `.ec-ayuda-icon` (círculo "?", hover/foco visible, `margin-left:auto`).
- [X] T008 [US1] En `assets/admin.js`: handler de `.ec-ayuda-icon` (Enter/Espacio, `stopPropagation`+`preventDefault` para no plegar el `<details>`, mostrar tooltip).
- [X] T009 [US1] Verificar: `node --check assets/admin.js`, `node --check assets/mockups.js`, `php -l admin/pdfs.php`, `node tests/mockup-contrato.test.js`.

**Checkpoint**: MVP usable (US1).

---

## Phase 4: User Story 2 - Vista previa del placeholder que simula al comprador (Priority: P2)

**Goal**: El recuadro de vista previa monta el motor de carga/recorte real por grupo, con contenido por instancia, flechas ‹› y unificación por tipo; alimenta el "Procesar PDF" de muestra.

**Independent Test**: Grupo imagen con campo → recorte real; grupo `cont>1` → flechas rotan instancias con su contenido; grupo texto con "Probar" → render; la muestra refleja el recorte; fallo muestra causa.

- [X] T010 [P] [US2] En `assets/admin.js`: `resolverPreview(grupo, instancia)` por tipo (texto→`cfg.previews[gid]`; imagen→recorte local o subida; futuro→fallback) como punto único de extensión.
- [X] T011 [P] [US2] En `assets/admin.js` + `assets/admin.css`: flechas ‹ › **a los lados** de `.ec-preview` (patrón visor) visibles solo con >1 **imagen de prueba cargada**; navegan las imágenes cargadas (no las instancias); con texto (1 imagen) no se muestran.
- [X] T012 [US2] En `assets/admin.js`: montar `CargadorPMU` por grupo de tipo imagen (con o sin campo; ranura por defecto del tamaño del grupo) siguiendo el patrón de `apiPreview()`; `.ec-preview` muestra placeholder transparente por defecto; clic o "Cargar imagen" abre el selector; tipo texto no monta motor.
- [X] T013 [US2] En `assets/admin.js`: `onRecorte(id,url,receta)` pinta el recorte en `.ec-preview` y publica `pmu:preview-listo` con `{id,url,w,h,instancia}`; "Probar" publica igual.
- [X] T014 [US2] En `assets/admin.js` + `engine/Motor.php` + `handle_procesar`: el recorte de la imagen de prueba activa se compone en navegador y alimenta el "Procesar PDF" de muestra (canal `imagen_{gid}`; variantes `imagen_{gid}__{n}` -> `{gid}-{n}.png`, `imagenes_de` arma lista; el Motor ya acepta lista). PHP no evalúa JS; la muestra NO se entrega al comprador. `.ec-texto-preview-caja` eliminado (texto en `.ec-preview`).
- [X] T015 [US2] Verificar: `node --check assets/admin.js`, `node tests/campos-contrato.test.js`, `node tests/selector-contrato.test.js`, `php tests/motor_smoke.php`; quickstart escenarios 2-4.
- [X] T023 [US2] En `assets/admin.js`: ante fallo de render/recorte, pintar la causa exacta en `.ec-subida-status`/`.ec-texto-status` sin dejar la consola en blanco (cubre SC-004/FR-011).

**Checkpoint**: US1 + US2 funcionales.

---

## Phase 5: User Story 3 - Interruptor "Alternar PH" espejado (Priority: P3)

**Goal**: "Alternar PH" controla que la capa placeholder use el contenido de la vista previa del grupo (recorte/render) o caja neutra.

**Independent Test**: Con contenido listo, "Alternar PH" activo dibuja el contenido; desactivado dibuja caja neutra; coincide con el recuadro del grupo; repinta al cambiar.

- [X] T016 [P] [US3] En `assets/mockups.js` (354): renombrar el checkbox "Ver texto real" a "Alternar PH".
- [X] T017 [US3] En `assets/mockups.js` `resolverCapa` (499-514): la capa placeholder usa la MISMA fuente que la vista previa (recorte local o render unificado), no solo `cfg.previews`; `estado.verTexto` = contenido real vs caja neutra.
- [X] T018 [US3] En `assets/mockups.js`: repintar el lienzo al recibir `pmu:preview-listo` y al montar el cargador del grupo.
- [X] T019 [US3] Verificar: `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js`; quickstart escenario 5.

**Checkpoint**: las 3 historias completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Actualizar asserts de `tests/mockup-contrato.test.js` a la intención (no al texto exacto), precedente spec 013 T010.
- [X] T021 [P] Actualizar docs: `AGENTS.md` §5/§9 y `admin/ayuda.php` (nuevo acordeón "Editor de mockups", vista previa por instancia, "Alternar PH").
- [X] T022 Correr la batería completa (`node --check`, suites Node, `php -l`, `motor_smoke`, `texto_puente` fases aplicables) + lab `node tests/aplanado.browser.js`; validar todos los escenarios de `quickstart.md`.

---

## Dependencies & Execution Order

- **Setup (P1)**: sin dependencias.
- **Foundational (P2)**: depende de Setup; BLOQUEA las historias.
- **US1 (P3)**: tras Foundational; MVP.
- **US2 (P4)**: tras Foundational; usa `data-cont`/`data-campo` (T003) y CSS base (T004).
- **US3 (P5)**: tras Foundational; consume la vista previa de US2 (T013) para el espejo.
- **Polish (P6)**: tras las historias deseadas.

### Parallel Opportunities
- T002, T004 [P]; T010, T011 [P]; T016, T020, T021 [P].

### Within a Story
- Markup/CSS antes que JS; `resolverPreview` (T010) antes de `onRecorte` (T013); `resolverCapa` (T017) tras la fuente de T013.

---

## Implementation Strategy

### MVP First (US1)
1. Setup + Foundational → 2. US1 → **STOP y validar** (quickstart escenario 1).

### Incremental
- US1 (MVP) → US2 → US3, cada una con sus puertas en verde antes de la siguiente.

## Notes
- No crear archivos de código nuevos; reutilizar `CargadorPMU`/`SelectorPMU`/`PMUMockup`/`cfg.previews`.
- Conservar clase `ec-acordeon-mockups`; EOL mixto → anclas de una línea.
- No tocar datos del comprador ni `modules/textmuy/`.