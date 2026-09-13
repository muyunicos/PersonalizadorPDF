---
description: "Task list for Galería Engine implementation"
---

# Tasks: Galería Engine

**Input**: Design documents from `/specs/003-galeria-engine/`

**Prerequisites**: research.md (decisions), constitution.md (governance)

**Organization**: Tasks grouped by user story for independent implementation


---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure for Galería Engine

- [ ] T001 Create `engine/Galeria.php` skeleton class with namespace
- [ ] T002 [P] Create `tests/galeria_test.php` smoke test file


---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**Checkpoint**: CRITICAL - No user story work can begin until this phase is complete

- [ ] T003 [P] Define private static `$AMBITOS` array: `fonts`, `img`, `pdfs`, `orders`, `tmp`, `tm-presets`
- [ ] T004 [P] Create private static `get_ambito_path($ambito)` method returning full Windows/WP path
- [ ] T005 [P] Create private static `guardar_json($ambito, array $datos)` method
- [ ] T006 [P] Create private static `leer_json($ambito)` method returning array


**Checkpoint**: Foundation ready - user story implementation can now begin


---

## Phase 3: User Story 1 - CRUD Operaciones (Priority: P1) ✅ MVP

**Goal**: Full CRUD (leer, alta, baja, editar) para todos los ámbitos

**Independent Test**: Tests que validen CRUD en un ámbito sin depender de otros


### Tests for User Story 1 (OPTIONAL)

- [ ] T007 [P] [US1] Create `tests/galeria_crud_test.php` smoke test (crear/leer/borrar item)


### Implementation for User Story 1

- [ ] T008 [P] [US1] Implement `leer_ambito($ambito)` method en `engine/Galeria.php`
- [ ] T009 [P] [US1] Implement `alta_ambito($ambito, array $datos)` con auto-generación de ID
- [ ] T010 [P] [US1] Implement `baja_ambito($ambito, $id)` usando tombstone `[id, "", ""]`
- [ ] T011 [P] [US1] Implement `editar_ambito($ambito, $id, array $datos)`
- [ ] T012 [P] [US1] Implement `buscar_por_id($ambito, $id)` para lookup rápido


**Checkpoint**: User Story 1 should be fully functional and testable


---

## Phase 4: User Story 2 - Gestión de Físicos (Priority: P2)

**Goal**: Manejo de archivos físicos (subir, validar, borrar, thumb)

**Independent Test**: Tests de subidas, validación de firmas, borrar y thumb


### Tests for User Story 2

- [ ] T013 [P] [US2] Create `tests/galeria_fisicos_test.php` smoke test


### Implementation for User Story 2

- [ ] T014 [P] [US2] Implement `validar_firma_imagen($file)` para PNG/JPG/WebP/GIF
- [ ] T015 [P] [US2] Implement `validar_firma_fuente($file)` para TTF/OTF
- [ ] T016 [P] [US2] Implement `guardar_fisico($ambito, $nombre, $file)` con movimiento de archivos
- [ ] T017 [P] [US2] Implement `borrar_fisico($ambito, $nombre)` con unlink
- [ ] T018 [P] [US2] Implement `generar_miniatura($ambito, $nombre, $file)` usando GD


**Checkpoint**: User Story 2 should be functional


---

## Phase 5: User Story 3 - Sprite Generation (Priority: P3)

**Goal**: Generar sprite único (thumbs.webp) por ámbito

**Independent Test**: Test que genere sprite desde items en el catálogo


### Tests for User Story 3

- [ ] T019 [P] [US3] Create `tests/galeria_sprite_test.php` smoke test


### Implementation for User Story 3

- [ ] T020 [P] [US3] Implement `regenerar_sprite($ambito)` que compile thumbs.webp de todos los items activos
- [ ] T021 [P] [US3] Implement `obtener_url_sprite($ambito)` que devuelve ruta pública del sprite
- [ ] T022 [P] [US3] Implement `obtener_url_miniatura($ambito, $nombre)` para thumbs individuales


**Checkpoint**: User Story 3 should be functional


---

## Phase 6: User Story 4 - Helpers & Integración (Priority: P4)

**Goal**: Helpers para WP integration y manejo de URLs

**Independent Test**: Tests de resolución de URLs y handlers


### Tests for User Story 4

- [ ] T023 [P] [US4] Create `tests/galeria_helpers_test.php` smoke test


### Implementation for User Story 4

- [ ] T024 [P] [US4] Implement `obtener_url($ambito, $nombre)` para resolución web
- [ ] T025 [P] [US4] Crear WP handlers en `personalizador-pdf.php` (admin_post con nonce)
- [ ] T026 [P] [US4] Crear `engine/GaleriaWP.php` wrapper con WP hooks


**Checkpoint**: User Story 4 should be functional


---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T027 [P] Add docblocks y comentarios en todos los métodos
- [ ] T028 [P] Create `tests/galeria_full_test.php` end-to-end smoke test
- [ ] T029 Run todos los tests y validar `SMOKE OK`
- [ ] T030 [P] Actualizar `AGENTS.md` con nueva responsabilidad de Galería


---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete


### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- All tests can run in parallel after foundation
- All models/services marked [P] can run in parallel


### Implementation Strategy

**MVP First (User Story 1 Only)**

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. STOP and VALIDATE: Test User Story 1 independently


---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests deben escribirse ANTES de implementación
- Commit after each task or logical group