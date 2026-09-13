# Implementation Plan: Personalización de Productos PDF para WooCommerce

**Branch**: `004-woocommerce-pdf-personalization` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-woocommerce-pdf-personalization/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Plugin WordPress que permite asociar productos PDF con placeholders personalizables a productos WooCommerce. Los clientes personalizan sus productos mediante campos definidos por el admin, previsualizan un mockup, y reciben el PDF personalizado tras el pago. El sistema utiliza TextMuy para renderizado de texto en el navegador y un motor PHP puro para generar PDFs finales.

## Technical Context

**Language/Version**: PHP 8.5.4, JavaScript ES6 (vanilla)

**Primary Dependencies**: WordPress 6.x, WooCommerce, TextMuy (módulo externo)

**Storage**: File system (uploads/), WordPress database (wp_posts, wp_postmeta, wp_options)

**Testing**: PHP tests (tests/), browser testing (manual + E2E)

**Target Platform**: WordPress 6.x, WooCommerce 8.x, Chrome/Edge/Firefox latest

**Project Type**: WordPress plugin / web application

**Performance Goals**: PDF generation <5s, preview generation <2s, handle 100 concurrent personalizations

**Constraints**: 100% PHP backend (no Node/Python runtime), shared hosting compatible, max 10MB uploads

**Scale/Scope**: 100 PDFs, 1000 personalized orders/month, 50k active users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution loaded from .specify/memory/constitution.md. All principles verified: §I WooCommerce Integration, §II Modular Architecture, §III Server-Side Processing, §IV Directory Structure (uploads/pmu/), §V No Backward Compatibility Required

## Project Structure

### Documentation (this feature)

```text
specs/004-woocommerce-pdf-personalization/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
personalizador-pdf/
├── personalizador-pdf.php    # Plugin main file
├── admin/                    # Admin UI (PHP pages + JS/CSS)
│   ├── pdfs.php              # Console: PDF management
│   ├── estilos-texto.php     # TextMuy iframe
│   └── ayuda.php             # Documentation
├── assets/                   # Admin CSS/JS
├── engine/                   # PHP PDF engine (pure)
│   ├── Pdf.php               # PDF parser
│   ├── Detector.php          # Placeholder detection
│   ├── Imagen.php            # Image normalization
│   ├── Overlay.php           # PDF injection
│   └── Motor.php             # Orchestrator
├── modules/
│   └── textmuy/              # External module (manual import)
└── tests/                    # Smoke tests, parity tests
```

**Structure Decision**: Single WordPress plugin structure with external TextMuy module. Admin UI in `admin/`, PDF engine in `engine/` (decoupled).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations identified.
