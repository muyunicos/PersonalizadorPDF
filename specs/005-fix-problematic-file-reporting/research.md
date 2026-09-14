# Research: fix-problematic-file-reporting

**Date**: 2026-09-14

**Purpose**: Resolve unknowns for fixing VS Code warnings in personalizador-pdf.php

## Findings

### Decision: Warning Analysis Required

**Decision**: First identify what specific VS Code warnings exist in personalizador-pdf.php before implementing fixes.

**Rationale**: VS Code warnings can range from syntax errors to style violations to type hints. Without knowing the exact 9 warnings, any fix attempt is guesswork.

**Alternatives considered**: 
- Try to fix common PHP issues blindly → rejected, would likely introduce regressions
- Assume warnings are all about type hints → rejected, warnings might be about other issues

### Decision: PHP Linting Strategy

**Decision**: Use PHP's built-in linter (`php -l`) as the primary verification tool, supplemented by manual inspection of VS Code warnings.

**Rationale**: The project already uses `php -l` in tests; adding external static analysis tools would require Composer dependencies not present in the current setup.

**Alternatives considered**:
- Add PHPStan/PSR via Composer → rejected, adds unnecessary dependencies for current hosting environment
- Use only VS Code warnings as source of truth → rejected, IDE warnings vary by configuration

### Decision: Fix Priority

**Decision**: Fix syntax/runtime warnings first, style warnings second, type hint warnings last.

**Rationale**: Syntax errors can break functionality; style warnings are cosmetic. Type hints improve quality but are not strictly required in PHP 8 with proper docblocks.

**Alternatives considered**:
- Fix all warnings at once → rejected, harder to track what was fixed
- Only fix warnings that cause errors → rejected, incomplete solution

## Next Steps

1. Ask user to share the exact 9 warnings from VS Code
2. Categorize warnings by type (syntax, style, type, documentation)
3. Apply fixes in priority order
4. Verify with `php -l` after each batch of changes
5. Commit changes with descriptive messages

## Implementation Completed

**Date**: 2026-09-14

All 23 tasks completed successfully:

- **Setup (Phase 1)**: T001-T003 ✅
- **Foundational (Phase 2)**: T004-T007 ✅
- **User Story 1 (Phase 3)**: T008-T011 ✅
- **User Story 2 (Phase 4)**: T012-T015 ✅
- **User Story 3 (Phase 5)**: T016-T019 ✅
- **Polish (Final Phase)**: T020-T023 ✅

**Verification Results**:
- `php -l` on all PHP files: No syntax errors
- `tests/motor_smoke.php`: SMOKE OK
- `tests/parity.php`: PARITY OK