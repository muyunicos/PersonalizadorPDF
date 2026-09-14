# Implementation Plan: fix-problematic-file-reporting

**Branch**: `005-fix-problematic-file-reporting` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-fix-problematic-file-reporting/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Fix VS Code warnings in personalizador-pdf.php (9 problems) and analyze related PDF files to resolve IDE linting/type-checking issues. The approach involves analyzing PHPStan/Intelephense warnings and applying appropriate PHP code quality fixes while maintaining compatibility with WordPress/WooCommerce standards.

## Technical Context

**Language/Version**: PHP 8.5.4

**Primary Dependencies**: WordPress, WooCommerce (no standalone dependencies)

**Storage**: File-based (uploads/pmu/ directory structure with JSON metadata)

**Testing**: PHP built-in linter (php -l), motor_smoke.php, parity.php

**Target Platform**: Hostinger Business hosting, WordPress 8.5.4+

**Project Type**: WordPress plugin

**Performance Goals**: Standard web plugin performance (fast page load, minimal PHP execution time)

**Constraints**: Pure PHP only (no native extensions), shared hosting environment, WordPress coding standards

**Scale/Scope**: Single plugin with ~2000 lines of PHP code, 5 core engine modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. WooCommerce Integration | ✅ Pass | Not applicable - this is a code quality fix, not a feature change |
| II. Modular Architecture | ✅ Pass | Existing engine/ and TextMuy modules remain unchanged |
| III. Server-Side Processing Priority | ✅ Pass | No client-side processing changes |
| IV. New Directory Structure (pmu) | ✅ Pass | File-based storage already used, no changes needed |
| V. No Backward Compatibility Requirement | ✅ Pass | Fixing current codebase, no legacy compatibility required |

## Project Structure

### Documentation (this feature)

```text
specs/005-fix-problematic-file-reporting/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (not created by /speckit-plan)
```

### Source Code (repository root)

```text
personalizador-pdf/
├── personalizador-pdf.php   # Main plugin file (9 VS Code warnings)
├── engine/                  # Core PHP modules
│   ├── Pdf.php
│   ├── Detector.php
│   ├── Overlay.php
│   ├── Motor.php
│   └── PngWriter.php
├── admin/                   # Admin UI
├── assets/                  # JavaScript/CSS
├── tests/                   # PHP test files
└── uploads/pmu/             # User data (not in repo)
```

**Structure Decision**: Single project structure maintained. No structural changes needed for this code quality fix.

## Complexity Tracking

> **N/A - No Constitution violations to justify**

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
