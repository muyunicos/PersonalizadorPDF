# Research Findings

**Date**: 2026-09-13 | **Feature**: WooCommerce PDF Personalization

## Decision Log

### 1. PDF Processing Architecture

**Decision**: Pure PHP PDF engine with no external dependencies

**Rationale**: 
- Shared hosting constraints (no Node/Python runtime)
- Existing `engine/` module already implements parser, detector, and overlay
- Proven smoke tests (`motor_smoke.php`) confirm correctness

**Alternatives considered**:
- Ghostscript/FPDF: Too heavy for shared hosting, requires native extensions
- WP PDF Library: Limited control over placeholder injection

### 2. Text Rendering Strategy

**Decision**: Client-side TextMuy (Canvas 2D + WebGL) for previews, server-side PDF injection

**Rationale**:
- Instant preview feedback (<2s)
- No font licensing issues (Google Fonts loaded client-side)
- TextMuy already implements delta-based preset system

**Alternatives considered**:
- Server-side text-to-image (PHP GD/Imagick): Slower, font management overhead
- PDF text insertion: Limited styling control

### 3. Image Upload & Processing

**Decision**: Custom `selector-pmu` component with client-side crop + server-side webp conversion

**Rationale**:
- Client-side crop reduces server load
- webp format balances quality/size (25-35% smaller than PNG)
- Existing WordPress media library integration

**Alternatives considered**:
- Full-size upload + server resize: Wastes bandwidth
- Pure server-side cropping: Poor UX

### 4. Data Persistence

**Decision**: WordPress postmeta + filesystem (uploads/) hybrid

**Rationale**:
- postmeta for relationships (PDF↔WooCommerce product)
- Filesystem for large assets (PDFs, images)
- Follows WordPress patterns, easy backup/migration

**Alternatives considered**:
- Custom DB tables: Over-engineering, harder migrations
- Full filesystem storage: Loss of WP query capabilities

### 5. Placeholder Detection Algorithm

**Decision**: Rectángulo de 4 líneas cerradas con fill_opacity ≤ 0.001

**Rationale**:
- Handles CorelDRAW exports (transformed rectangles)
- Minimum size filter (10×5 pt) avoids artifacts
- Color-based grouping allows multi-placeholder designs

**Alternatives considered**:
- BBox-only detection: Misses rotated placeholders
- SVG path parsing: Overly complex

---

## Best Practices Applied

| Area | Practice | Source |
|------|----------|--------|
| Security | Nonce validation on all POST handlers | WordPress Coding Standards |
| Performance | Image lazy-loading, CDN-ready asset URLs | WooCommerce patterns |
| UX | Progress indicator during PDF generation | WCAG 2.1 (loading states) |
| Error Handling | User-friendly messages + admin error logs | WordPress Plugin Handbook |
| Accessibility | Form labels, keyboard navigation in admin | WCAG 2.1 Level AA |