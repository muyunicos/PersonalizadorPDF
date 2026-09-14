---

description: "Task list for fix-problematic-file-reporting feature"

---

# Tasks: fix-problematic-file-reporting

**Input**: Design documents from `/specs/005-fix-problematic-file-reporting/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Not included - feature specification did not request testing

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: WordPress plugin structure at repository root
- **Files**: `personalizador-pdf.php`, `engine/`, `admin/`, `assets/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and code quality infrastructure

- [X] T001 Verify PHP environment (8.0+) for linting and testing
- [X] T002 [P] Run `php -l` on all PHP files to confirm baseline syntax
- [X] T003 [P] Document current VS Code warning count in tasks.md notes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Analyze exact 9 VS Code warnings in personalizador-pdf.php and categorize by type
- [X] T005 [P] Create warning categorization table (syntax, style, type, documentation)
- [X] T006 [P] Verify all engine/*.php files pass `php -l` check
- [X] T007 [P] Verify all admin/*.php files pass `php -l` check

**Checkpoint**: Warning analysis complete - user story implementation can now begin

---

## Phase 3: User Story 1 - Reducir reportes falsos de archivos problematicos (Priority: P1) 🎯 MVP

**Goal**: Fix all syntax/runtime warnings in personalizador-pdf.php to reduce false positives

**Independent Test**: Run `php -l personalizador-pdf.php` and verify 0 syntax errors; confirm VS Code shows reduced warning count

### Implementation for User Story 1

- [X] T008 [US1] Fix all syntax warnings in personalizador-pdf.php (missing semicolons, unclosed brackets)
- [X] T009 [US1] Fix all runtime warnings in personalizador-pdf.php (unused variables, deprecated functions)
- [X] T010 [P] [US1] Run `php -l personalizador-pdf.php` to verify syntax correctness
- [X] T011 [P] [US1] Run `tests/motor_smoke.php` to verify no functionality regression

**Checkpoint**: User Story 1 complete - syntax/runtime warnings resolved

---

## Phase 4: User Story 2 - Clarificar la razon de cada reporte (Priority: P2)

**Goal**: Fix all style and documentation warnings to improve code clarity

**Independent Test**: VS Code style warnings reduced to minimum; all public methods have proper docblocks

### Implementation for User Story 2

- [X] T012 [US2] Fix all style warnings in personalizador-pdf.php (naming conventions, spacing)
- [X] T013 [P] [US2] Add/fix PHP docblocks for all public methods in personalizador-pdf.php
- [X] T014 [P] [US2] Ensure consistent indentation (4 spaces) throughout personalizador-pdf.php
- [X] T015 [P] [US2] Run `php -l` and verify no style-related syntax errors

**Checkpoint**: User Story 2 complete - style warnings resolved

---

## Phase 5: User Story 3 - Priorizar problemas por severidad (Priority: P3)

**Goal**: Fix all type hint warnings to improve code quality

**Independent Test**: Type hint warnings resolved while maintaining WordPress compatibility

### Implementation for User Story 3

- [X] T016 [US3] Add parameter type hints to functions that support them (PHP 8+ syntax)
- [X] T017 [P] [US3] Add return type hints to functions that support them (PHP 8+ syntax)
- [X] T018 [P] [US3] Verify all type hints are compatible with PHP 8.5.4
- [X] T019 [P] [US3] Run `php -l` on personalizador-pdf.php and verify 0 errors

**Checkpoint**: User Story 3 complete - type hints resolved

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T020 [P] Final verification: count remaining VS Code warnings in personalizador-pdf.php
- [X] T021 [P] Update tests/ parity.php and motor_smoke.php to verify no regressions
- [X] T022 [P] Run `php -l` on all PHP files in repository
- [X] T023 [P] Update research.md with actual warning types found and fixes applied

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories MUST be completed sequentially (US1 → US2 → US3) to maintain logical order
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Must complete after US1 - Builds on code quality baseline
- **User Story 3 (P3)**: Must complete after US2 - Type hints should follow style fixes

### Within Each User Story

- Tasks within a story can often run in parallel if marked [P]
- Core implementation before verification tasks
- Story complete before moving to next priority

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel
- All implementation tasks within a story marked [P] can run in parallel
- Verification tasks ([P]) can run after core implementation

---

## Parallel Example: User Story 1

```bash
# Launch implementation and verification tasks together:
Task: "Fix all syntax warnings in personalizador-pdf.php"
Task: "Fix all runtime warnings in personalizador-pdf.php"
Task: "[P] Run `php -l personalizador-pdf.php` to verify syntax"
Task: "[P] Run `tests/motor_smoke.php` to verify functionality"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (fix syntax/runtime warnings)
4. **STOP and VALIDATE**: Test with `php -l` and motor_smoke.php
5. Deploy if ready - this alone provides value by fixing syntax errors

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Deploy/Demo (MVP - syntax fixes)
3. Add User Story 2 → Test → Deploy/Demo (style improvements)
4. Add User Story 3 → Test → Deploy/Demo (type hints)
5. Each story adds quality without breaking previous work

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (syntax/runtime)
   - Developer B: User Story 2 (style/docblocks)
   - Developer C: User Story 3 (type hints)
3. Verify each story independently before merging

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **WARNING**: Do not skip Foundational phase - you need the warning analysis before fixing
- **WARNING**: Do not fix type hints before style fixes - order matters for readability