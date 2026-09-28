---
description: "Task list for Galería Engine implementation"
---

# Tasks: Galería Engine (PMU Uploads)

**Input**: Design documents from `/specs/003-galeria-engine/`

**Prerequisites**: research.md (decisions), spec.md (requirements), data-model.md (entities), contracts/motor-contract.md

**Tests**: Not explicitly requested - test tasks omitted

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- WordPress plugin: `engine/`, `personalizador-pdf.php` at repository root
- Paths shown below assume WordPress plugin structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Verify PHP environment and GD extension available
- [ ] T002 [P] Create `engine/PMU_Uploads.php` class skeleton with namespace

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 [P] Define `private static $AMBITOS = ['fonts', 'img', 'pdfs', 'orders', 'tmp', 'tm-presets']` in `engine/PMU_Uploads.php`
- [ ] T004 [P] Implement `dir_pmu($crear = false)` method in `engine/PMU_Uploads.php` (returns `uploads/pmu/` base path)
- [ ] T005 [P] Implement `dir_ambito($ambito, $crear = false)` method in `engine/PMU_Uploads.php` (returns specific ambito path)
- [ ] T006 [P] Implement `ruta_catalogo($ambito)` method in `engine/PMU_Uploads.php` (returns `{ambito}.json` path)
- [ ] T007 [P] Implement `catalogo($ambito)` method in `engine/PMU_Uploads.php` (seed lazy: reads/creates JSON with {thumbs, items} structure)
- [ ] T008 [P] Implement `guardar_catalogo($ambito, $cat)` method in `engine/PMU_Uploads.php` (writes JSON canónico)
- [ ] T009 [P] Implement `tupla_alta($ambito)` helper in `engine/PMU_Uploads.php` (returns next available ID: hueco más bajo or max+1)
- [ ] T010 [P] Implement `tupla_baja($ambito, $id)` helper in `engine/PMU_Uploads.php` (creates tombstone `[id, "", ""]`)
- [ ] T011 [P] Implement `obtener_url($ambito, $nombre)` method in `engine/PMU_Uploads.php` (resuelve URL web)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - CRUD Operaciones (Priority: P1) 🎯 MVP

**Goal**: Full CRUD (leer, alta, baja, editar) para todos los ámbitos

**Independent Test**: Tests que validen CRUD en un ámbito (ej. `img`) sin depender de otros ámbitos

### Implementation for User Story 1

- [ ] T012 [P] [US1] Implement `listar($ambito)` method in `engine/PMU_Uploads.php` (merge catálogo + físicos, return items with {id, title, cats, file, url, thumb, enUso})
- [ ] T013 [P] [US1] Implement `alta($ambito, $title, $cats, $file)` method in `engine/PMU_Uploads.php` (creates new item with auto-generated ID >= 1, max 1000 items per catalogo)
- [ ] T014 [P] [US1] Implement `baja($ambito, $id)` method in `engine/PMU_Uploads.php` (creates tombstone without deleting physical file)
- [ ] T015 [P] [US1] Implement `editar($ambito, $id, $nuevo...)` method in `engine/PMU_Uploads.php` (updates existing item, renames physical file if needed)

**Checkpoint**: User Story 1 should be fully functional and testable

---

## Phase 4: User Story 2 - Gestión de Físicos (Priority: P2)

**Goal**: Manejo de archivos físicos (subir, validar, borrar, generar miniatura)

**Independent Test**: Tests de subidas, validación de firmas, borrar y generar miniatura

### Implementation for User Story 2

- [ ] T016 [P] [US2] Implement `validar_firma_imagen($file)` method in `engine/PMU_Uploads.php` (validates PNG/JPG/WebP/GIF, max 10MB)
- [ ] T017 [P] [US2] Implement `validar_firma_fuente($file)` method in `engine/PMU_Uploads.php` (validates TTF/OTF, max 5MB)
- [ ] T018 [P] [US2] Implement `validar_firma_preset($file)` method in `engine/PMU_Uploads.php` (validates TXM, max 50KB)
- [ ] T019 [P] [US2] Implement `guardar_fisico($ambito, $nombre, $file)` method in `engine/PMU_Uploads.php` (moves uploaded file to final location)
- [ ] T020 [P] [US2] Implement `borrar_fisico($ambito, $nombre)` method in `engine/PMU_Uploads.php` (unlinks physical file)
- [ ] T021 [P] [US2] Implement `generar_miniatura($ambito, $nombre, $file)` method in `engine/PMU_Uploads.php` (creates .webp using GD extension)

**Checkpoint**: User Story 2 should be functional

---

## Phase 5: User Story 3 - Sprite Generation (Priority: P3)

**Goal**: Generar sprite único (thumbs.webp) por ámbito

**Independent Test**: Test que genere sprite desde items en el catálogo

### Implementation for User Story 3

- [ ] T022 [P] [US3] Implement `regenerar_sprite($ambito)` method in `engine/PMU_Uploads.php` (compiles thumbs.webp from all active items)
- [ ] T023 [P] [US3] Implement `obtener_url_sprite($ambito)` method in `engine/PMU_Uploads.php` (returns public URL of sprite)
- [ ] T024 [P] [US3] Implement `obtener_url_miniatura($ambito, $nombre)` method in `engine/PMU_Uploads.php` (returns URL of individual thumbnail)

**Checkpoint**: User Story 3 should be functional

---

## Phase 6: User Story 4 - Integración WordPress (Priority: P4)

**Goal**: Handlers WP y manejo de URLs

**Independent Test**: Tests de resolución de URLs y handlers con nonce

### Implementation for User Story 4

- [ ] T025 [P] [US4] Remove old handlers from `personalizador-pdf.php`: `admin_post_personalizador_pdf_textmuy_subir_imagen`, `admin_post_personalizador_pdf_textmuy_guardar_preset`, `admin_post_personalizador_pdf_guardar_sprite`, `admin_post_personalizador_pdf_guardar_miniatura`
- [ ] T026 [P] [US4] Add `add_action('admin_post_pmu_uploads', [$this, 'handle_pmu_uploads'])` to `personalizador-pdf.php`
- [ ] T027 [P] [US4] Implement `handle_pmu_uploads()` method in `personalizador-pdf.php` (nonce verification, capability check, dispatch to PMU_Uploads)
- [ ] T028 [US4] Implement switch statement in `handle_pmu_uploads()` for ops: listar, alta, baja, editar, sprite, miniatura
- [ ] T029 [P] [US4] Add error responses with format `motor:<op>:<motivo>` for all failure scenarios

**Checkpoint**: User Story 4 should be functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T030 [P] Add PHPDoc blocks to all methods in `engine/PMU_Uploads.php`
- [ ] T031 [P] Create smoke test in `tests/` to validate all endpoints
- [ ] T032 Run quickstart.md validation scenarios
- [ ] T033 [P] Update AGENTS.md with PMU_Uploads responsibility

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational
- **User Story 3 (Phase 5)**: Depends on Foundational
- **User Story 4 (Phase 6)**: Depends on Foundational
- **Polish (Phase 7)**: Depends on all desired user stories

### Parallel Opportunities

- All Phase 1 tasks can run in parallel
- All Phase 2 tasks marked [P] can run in parallel
- Once Phase 2 completes, US1, US2, US3, US4 can be implemented in parallel by different team members

### Parallel Example: Phase 2 (Foundational)

```bash
# Launch all foundational tasks together:
Task: "Define $AMBITOS array in engine/PMU_Uploads.php"
Task: "Implement dir_pmu() method in engine/PMU_Uploads.php"
Task: "Implement dir_ambito() method in engine/PMU_Uploads.php"
Task: "Implement ruta_catalogo() method in engine/PMU_Uploads.php"
Task: "Implement catalogo() method in engine/PMU_Uploads.php"
Task: "Implement guardar_catalogo() method in engine/PMU_Uploads.php"
Task: "Implement tupla_alta() helper in engine/PMU_Uploads.php"
Task: "Implement tupla_baja() helper in engine/PMU_Uploads.php"
Task: "Implement obtener_url() method in engine/PMU_Uploads.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test CRUD operations independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → CRUD works → Deploy/Demo (MVP!)
3. Add US2 → Physical files handled → Deploy/Demo
4. Add US3 → Sprites generated → Deploy/Demo
5. Add US4 → WP handlers integrated → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (CRUD)
   - Developer B: User Story 2 (Físicos)
   - Developer C: User Story 3 (Sprites)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
