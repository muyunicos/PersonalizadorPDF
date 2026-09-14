# Quickstart: fix-problematic-file-reporting

**Date**: 2026-09-14

This guide validates the code quality fix for VS Code warnings.

## Prerequisites

- PHP 8.0+ installed locally
- VS Code with PHP Intelephense extension
- Access to the personalizador-pdf plugin repository

## Validation Steps

### 1. Check Current Warnings

Open VS Code with the project and note the warning count:

```bash
# In VS Code Problems panel, check for warnings in personalizador-pdf.php
```

Expected before fix: 9 warnings in personalizador-pdf.php

### 2. Run PHP Linter

```bash
php -l personalizador-pdf.php
```

Expected: "No syntax errors detected"

### 3. Apply Fixes

Based on the research findings, fix warnings in this order:
1. Syntax/runtime warnings (if any)
2. Style warnings (naming conventions, spacing)
3. Type hint warnings (add parameter/return types where appropriate)

### 4. Verify Warnings Resolved

```bash
php -l personalizador-pdf.php
```

Expected after fix: Still "No syntax errors detected"

### 5. Run Plugin Tests

```bash
php tests/motor_smoke.php
```

Expected: "SMOKE OK"

## Expected Outcomes

| Step | Success Criteria |
|------|------------------|
| Warning check | Exact 9 warnings identified and documented |
| Linter check | No syntax errors |
| Post-fix check | Warning count reduced to 0 or acceptable minimum |
| Test check | All existing tests pass |

## Troubleshooting

- **Intelephense warnings persist**: Clear VS Code cache (Ctrl+Shift+P > "Developer: Reload Window")
- **Tests fail**: Verify original tests passed before making changes
- **New warnings appear**: Roll back the last change and try alternative fix