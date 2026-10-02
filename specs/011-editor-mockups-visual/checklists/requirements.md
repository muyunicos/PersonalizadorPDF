# Specification Quality Checklist: editor-mockups-visual

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-01
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] CHK001 No implementation details (languages, frameworks, APIs)
- [x] CHK002 Focused on user value and business needs
- [x] CHK003 Written for non-technical stakeholders
- [x] CHK004 All mandatory sections completed

## Requirement Completeness

- [x] CHK005 No [NEEDS CLARIFICATION] markers remain
- [x] CHK006 Requirements are testable and unambiguous
- [x] CHK007 Success criteria are measurable
- [x] CHK008 Success criteria are technology-agnostic (no implementation details)
- [x] CHK009 All acceptance scenarios are defined
- [x] CHK010 Edge cases are identified
- [x] CHK011 Scope is clearly bounded
- [x] CHK012 Dependencies and assumptions identified

## Feature Readiness

- [x] CHK013 All functional requirements have clear acceptance criteria
- [x] CHK014 User scenarios cover primary flows
- [x] CHK015 Feature meets measurable outcomes defined in Success Criteria
- [x] CHK016 No implementation details leak into specification

## Notes

**Sobre CHK001 / CHK016 (detalle de la validacion).** La especificacion esta escrita en terminos
de comportamiento observable ("el admin arrastra", "el sistema avisa", "la composicion coincide").
Excepciones justificadas, todas deliberadas y revisadas:

1. **Nombres de archivo con linea** (`mockups.js:110-129`, `admin/pdfs.php:519-528`,
   `inc/class-pmu-uploads.php:729`) en la tabla de diagnostico: son evidencia verificable del estado
   actual, no prescripcion de implementacion. Justifica por que la spec existe.
2. **Nombres de contrato de datos** (`config.json:mockups[]`, `analisis.json`, `capas[]`): son
   contrato vigente en `constitution` §IV y en `AGENTS.md` §5. La spec **no puede** ser agnostica
   aqui: redefinirlos seria una decision de arquitectura, no de requisito. FR-042 y FR-045 los
   declaran invariantes.
3. **Puertas automaticas por nombre** en SC-010 (`php -l`, `motor_smoke`, `parity`,
   `texto_puente.php`, `smoke_checks()`): son los comandos de verificacion **ya obligatorios** del
   proyecto (`AGENTS.md` §9). El criterio es "las puertas pasan en verde", no "usar tal herramienta".
4. **Acciones de UI existentes nombradas** ("Probar", "Re-analizar"): sonrotulos de producto que el
   admin ya ve en pantalla. Q2 de la sesion 2026-10-01 ordena explicitamente reusar el preview que
   produce "Probar", asi que nombrarlo es el requisito, no una fuga tecnica.

**Decisiones cerradas antes de especificar** (seccion Clarifications, D1-D6): las 3 preguntas de la
sesion 2026-10-01 quedaron respondidas (Q1=B embebido en 2 columnas; Q2=reutilizar el render que
produce "Probar" y repintar automaticamente; Q3=A, P0+P1 completos). D4 (encajar sin deformar) y
D5 (simulacion de la galeria del cliente) se derivan de la consistencia exigida con lo que ve el
comprador. Por eso no quedan marcadores de aclaracion.

**Verificaciones hechas contra el codigo** (no supuestos):

- El editor no tiene CSS: `grep -rn "ec-mk" --include=*.css .` -> 0 resultados.
- `mockups.js` no registra `pointerdown`/`mousedown`: el arrastre no existe.
- `window.prompt` en `mockups.js:240` y `:255`.
- `gama` en la allowlist de `config_mockups` (`class-pmu-uploads.php:729`) sin aplicar en
  `filtroCss()` de `mockups.js:145` ni de `tienda.js:415`.
- Desincronizacion de `preview_omisible`: `pdfs.php:498` (checkbox del formulario general) vs
  `mockups.js:326` (envia `datos.preview_omisible`, congelado al cargar) vs
  `personalizador-pdf.php:2281` (lo escribe siempre).
- Render reutilizable: `admin.js:960-988` produce el preview con `renderCore()` +
  `TextMuyAPI.renderBatch` al tamano exacto del hueco, y lo deja en `.ec-texto-preview-caja`.

**Pendiente para `/speckit-plan` (no bloquea la especificacion)**: al ampliar el contrato de capa
(opacidad, desenfoque, tono, modo de fusion) hay que extender **dos** validadores
(`handle_mockups_guardar` y `PMU_Uploads::config_mockups`) y el render de `tienda.js`, o el cliente
veria algo distinto a lo que compone el admin (FR-025). Coordinar con la spec 009 para no duplicar
el mecanismo de miniaturas del catalogo `img/`.
