# Design — baseline-capabilities

## Context

Conviven dos sistemas de specs en el repo: Spec Kit (`specs/`, 43 carpetas con
enmiendas cruzadas) y OpenSpec (`openspec/`, vacio). No existe una verdad actual unica y
consultable del sistema ya implementado; leer el estado real obliga a cruzar muchas specs
legacy y sus enmiendas. `specs/INDICE.md` es el mapa historico y la fuente del estado por
spec.

## Goals / Non-Goals

### Goals

- Dejar `openspec/specs/` como **verdad actual** del sistema implementado.
- Destilar en 8 capacidades cohesivas, una por boundary de comportamiento.
- Que OpenSpec genere el formato de spec principal correcto via change + archive.

### Non-Goals

- No migrar 1:1 las 43 carpetas legacy (decision tomada).
- No tocar codigo de produccion ni `specs/` legacy.
- No implementar nada pendiente (010 API, 048 testing van como changes forward aparte).
- No ejecutar recorridos manuales de navegador (QA del lab).

## Decisions

- **D1 — Baseline via change + archive**: el baseline se crea como change
  `baseline-capabilities` con 8 deltas `ADDED` y se archiva; OpenSpec genera los
  `openspec/specs/<cap>/spec.md` con el formato correcto. Alternativa descartada: autorar
  specs principales a mano (adivinar formato).
- **D2 — 8 capacidades de layout plano**: `pdf-motor`, `mockups-editor`, `campos-consola`,
  `cargador-imagenes`, `biblioteca-imagenes`, `ficha-comprador`, `texto-textmuy`,
  `cotizador`. `api-wordpress` no va en baseline (es el change forward `add-api-wordpress`).
- **D3 — Forward = changes activos**: `add-api-wordpress` y `deuda-testing-conductual`
  quedan en `openspec/changes/` sin marcar (implementacion futura).
- **D4 — Cotizador en baseline**: su estado actual entra como capacidad; los recorridos de
  navegador pendientes (037/038) son QA manual, no un change.
- **D5 — Idioma**: artefactos en espanol; identificadores kebab-case sin tildes.
- **D6 — No tocar legacy**: `specs/` queda intacto; se referencia desde un README.

## Risks / Trade-offs

- **Perdida de matiz al destilar** -> `specs/` queda como referencia historica; el README lo
  declara; se valida contra `specs/INDICE.md` (fuente del estado).
- **Formato de spec invalido** -> se usa change + archive (OpenSpec genera el formato) y el
  gate `openspec validate --strict`.
- **Specs duplicadas o nombres inventados** -> se usan exactamente los 8 nombres de D2 y se
  verifica con `openspec list --specs`.
- **Toe nada mas** -> `git status` debe mostrar solo `openspec/`; si aparece otro archivo,
  se revierte.

## Migration Plan

1. Scaffold `baseline-capabilities` (proposal + 8 specs + design + tasks).
2. Validar `--strict` hasta verde.
3. Archivar: OpenSpec mueve el change a `changes/archive/` y genera las 8 specs.
4. Verificar post-archive con `openspec list --specs` y `openspec show <cap> --type spec`.

## Open Questions

- Ninguna: el plan cubre el alcance; ante bloqueo real, el agente se detiene y reporta.