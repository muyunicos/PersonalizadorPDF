---
ription: "Task list for WooCommerce PDF Personalization"
---

# Tasks: Personalización de Productos PDF para WooCommerce

**Input**: Design documents from `/specs/004-woocommerce-pdf-personalization/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- WordPress plugin: `personalizador-pdf/` at repository root
- Paths shown below assume WordPress plugin structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify WordPress plugin structure in `personalizador-pdf/`
- [X] T002 [P] Create `admin/` directory structure
- [X] T003 [P] Create `engine/` directory structure
- [X] T004 [P] Create `assets/` directory structure
- [X] T005 [P] Create `tests/` directory structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create plugin main file `personalizador-pdf.php` with class definition and activation hooks
- [X] T007 [P] Implement `Pdf.php` parser in `engine/` (object/stream/xref reading)
- [X] T008 [P] Implement `Detector.php` in `engine/` (placeholder detection: 4-line rectangles, fill_opacity ≤ 0.001, min 10×5 pt)
- [X] T009 [P] Implement `Imagen.php` in `engine/` (RGBA normalization, contain-scale logic)
- [X] T010 [P] Implement `Overlay.php` in `engine/` (splice injection with q/Q isolation, /ECOp1 ExtGState)
- [X] T011 [P] Implement `Motor.php` in `engine/` (orchestration: PDF + dataset + images → processed PDF)
- [X] T012 Create `admin/page.php` with tab structure (PDFs | Estilos de Texto | Ayuda)
- [X] T013 [P] Create assets/admin.css (tab layout, form styles, button styles)
- [X] T014 [P] Create assets/admin.js (form validation, AJAX form submit, preview trigger)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Admin PDF Upload & Configuration (Priority: P1) 🎯 MVP

**Goal**: Admin can upload PDFs, view detected placeholder groups, and configure fields/mappings

**Independent Test**: Upload `muestra.pdf`, verify 2 placeholder groups detected, assign text field to each group, see group listing with assigned fields

### Implementation for User Story 1

- [X] T015 [US1] Implement `Detector.php` color-based grouping (key = RGB with 3 decimals, order = a, b, c... z, aa...)
- [X]6 [US1] Create `admin/pdfs.php` with PDF upload form and placeholder detection trigger
- [X]7 [US1] Create `engine/Metadata.php` (JSON dataset: `datos/{pdf}/metadata.json`)
- [X]8 [P] [US1] Create `engine/PngWriter.php` (transparent PNG generation without GD)
- [X] T019 [P] [US1] Create `engine/Metadata.php` methods (save/load JSON, detect placeholders)
- [X] T020 [US1] Create `admin/pdfs.php` group display table (group letter, count, placeholder image)
- [X] T021 [US1] Implement campo UI in `admin/pdfs.php` (select existing campo, assign to group)
- [X] T022 [P] [US1] Create mockup config structure in `uploads/pmu/pdfs/{pdf}/mckp.json`
- [X] T023 [US1] Implement `engine/Motor.php` `upload()` method (validate PDF, call Detector, save Metadata)
- [X] T024 [P] [US1] Create `tests/motor_smoke.php` test (PDF upload → placeholder detection → metadata save)

**Checkpoint**: Admin can upload PDFs, view groups, and assign fields

---

## Phase 4: User Story 2 - Client Personalization & Preview (Priority: P2)

**Goal**: Client sees personalization panel on product page, enters data, and generates preview

**Independent Test**: Visit product page, enter text in campo, click "Generar vista previa", see preview on mockup

### Implementation for User Story 2

- [X]5 [US2] Implement `personalizador-pdf.php` WooCommerce filter to inject personalization panel on product page
- [X]6 [US2] Create client-side panel HTML in `assets/panel-cliente.html` (fields from campo content)
- [X]7 [US2] Implement `assets/admin.js` preview generator (Canvas 2D rendering using TextMuy iframe)
- [X]8 [P] [US2] Create `admin/estilos-texto.php` with TextMuy iframe (`modules/textmuy/index.html`)
- [X]9 [US2] Implement selector-pmu component in assets/selector-pmu.js per contracts/selector-pmu.md (upload, crop, save to uploads/pmu/tmp/ pending order confirmation)
- [X] T030 [P] [US2] Create `uploads/pmu/tmp/order_id/` directory structure
- [X]1 [US2] Implement `admin/pdfs.php` mockup editor (placeholder positioning on mockup image)
- [X] T032 [P] [US2] Create quickstart.md validation for preview scenario

**Checkpoint**: Client can personalize and preview

---

## Phase 5: User Story 3 - Purchase & PDF Generation (Priority: P3)

**Goal**: After purchase, system generates personalized PDF and delivers to client

**Independent Test**: Complete test purchase, access order confirmation page, download PDF, verify text/image overlays correct

### Implementation for User Story 3

- [X]3 [US3] Implement `engine/Motor.php` `generate()` method (PDF + field_data + images → processed PDF)
- [X]4 [US3] Create `admin/pdfs.php` "Procesar PDF" button (collects images/texts, calls Motor)
- [X] T035 [P] [US3] Implement `engine/Overlay.php` `splice()` method (insert image before fill operator)
- [X] T036 [P] [US3] Implement `engine/Overlay.php` `addExtGState()` (add /ECOp1 with ca=1 CA=1)
- [X]7 [US3] Create WooCommerce order completion hook in `personalizador-pdf.php` (auto-generate PDF)
- [X]8 [P] [US3] Create download handler in `personalizador-pdf.php` (deliver PDF using WooCommerce email hooks + download link)
- [X] T039 [P] [US3] Add error handling to `engine/Motor.php` (invalid preset, script error → status=failed)

**Checkpoint**: PDF generation and delivery complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T040 [P] Add nonce validation to all admin_post handlers
- [X]1 [P] Add error logging to `engine/Motor.php` (WordPress debug log)
- [X]2 [P] Create `tests/parity.php` test (placeholder detection vs expected)
- [X]3 [P] Create `tests/texto_puente.php` test (TextMuy bridge with WP stubs)
- [X]4 Run quickstart.md validation scenarios
- [X] T045 Documentation updates (admin guide in `admin/ayuda.php`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational
- **User Story 3 (Phase 5)**: Depends on Foundational
- **Polish (Phase 6)**: Depends on all desired user stories

### Parallel Opportunities

- All Phase 1 tasks can run in parallel
- All Phase 2 tasks marked [P] can run in parallel
- After Phase 2: US1, US2, US3 can be implemented in parallel by different team members

### Parallel Example: Phase 2 (Foundational)

```bash
# Launch all foundational tasks together:
Task: "Implement Pdf.php parser in engine/"
Task: "Implement Detector.php in engine/"
Task: "Implement Imagen.php in engine/"
Task: "Implement Overlay.php in engine/"
Task: "Implement Motor.php in engine/"
```

### Parallel Example: User Story 1

```bash
# Launch parallel tasks for US1:
Task: "Create engine/Metadata.php (save/load JSON, detect placeholders)"
Task: "Create admin/pdfs.php with PDF upload form"
Task: "Create engine/PngWriter.php (transparent PNG generation)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Admin upload & configuration)
4. **STOP and VALIDATE**: Test PDF upload and group assignment
5. Deploy/demo

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Admin can upload and configure PDFs → Deploy
3. Add US2 → Client can personalize and preview → Deploy
4. Add US3 → Full purchase flow → Deploy
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Admin configuration)
   - Developer B: User Story 2 (Client preview)
   - Developer C: User Story 3 (PDF generation)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies
