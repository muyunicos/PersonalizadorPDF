# Plan — Migracion de specs legacy a OpenSpec (capacidades + forward)

> Plan autónomo: otro agente (modo implementacion) debe poder ejecutarlo de punta a punta
> sin mas preguntas. Si algo bloquea, el agente se detiene y lo reporta; no inventa.

## 1. Objetivo

Dejar OpenSpec como **sistema unico de specs** del plugin Personalizador PDF:

1. **Baseline**: destilar el sistema actual (ya implementado) en 8 *capability specs* bajo
   `openspec/specs/`.
2. **Referencia historica**: apuntar al archivo legacy `specs/` (Spec Kit) sin tocarlo.
3. **Forward**: crear changes en `openspec/changes/` solo para lo **pendiente** (010 API, 048
   testing). Lo demas queda como baseline.

Resultado: `openspec/specs/` = verdad actual; `openspec/changes/` = trabajo en curso;
`specs/` = historia congelada (read-only).

## 2. Alcance y no-alcance

**En alcance (solo documentacion OpenSpec, cero codigo de produccion):**
- Crear/editar archivos Markdown bajo `openspec/` unicamente.
- No modificar `specs/` legacy, `AGENTS.md`, `constitution`, `engine/`, `inc/`, `assets/`,
  `admin/`, `modules/`, `tests/`, ni datos de `uploads/`.

**Fuera de alcance (NO hacer sin aprobacion explicita del usuario):**
- `git commit` / `git push` / deploy (el push dispara webhooks de Hostinger → produccion).
- Implementar de verdad la API 010 o la deuda de testing 048 (solo se *planifican* como changes).
- Migrar 1:1 las 43 carpetas legacy (decision tomada: NO).
- Recorridos manuales de navegador (QA del lab): se documentan como pendientes, no se ejecutan.

## 3. Decisiones cerradas (no preguntar)

- **D1 — Baseline via change + archive**: el baseline se crea como un change
  `baseline-capabilities` con 8 deltas `ADDED`; tras validar, se archiva y OpenSpec genera los
  8 `openspec/specs/<cap>/spec.md` con el formato correcto (evita adivinar el formato de spec
  principal). Alternativa descartada: autorar specs principales a mano.
- **D2 — 8 capacidades** (nombres kebab-case, layout plano): ver §4.
- **D3 — Forward = changes activos** (no archivados): `add-api-wordpress` y
  `deuda-testing-conductual` quedan en `openspec/changes/` con tasks sin marcar.
- **D4 — Cotizador**: su estado actual entra en el baseline (`cotizador`). Los recorridos de
  navegador pendientes (037/038) son QA manual, **no** un change OpenSpec.
- **D5 — Idioma**: artefactos en **español** (convencion del repo).
- **D6 — No tocar legacy**: `specs/` queda intacto; solo se referencia desde un README.

## 4. Mapa de capacidades (baseline)

| # | Capacidad (`openspec/specs/<cap>/`) | Alcance (una linea) | Specs legacy fuente |
|---|---|---|---|
| 1 | `pdf-motor` | Deteccion/agrupacion de huecos, dataset analisis/config, overlay z-order + /ECOp1, encajado contain, Compositor, Motor | 004, 006, 026, 029, 035 |
| 2 | `mockups-editor` | Editor visual admin: capas, grupos, envolturas, perspectiva, importar pagina, aplanado fondo/frente | 011, 031, 034, 036, 049 |
| 3 | `campos-consola` | Campos reutilizables v3, consola, CSS/JS global, preview, ranura adaptativa, tipo/overrides | 012, 013, 015, 018, 019 |
| 4 | `cargador-imagenes` | Selector/cargador/visor, recorte, receta v2, modos de encaje, transparencia, carga multiple | 016, 021, 023, 024, 025, 027, 028, 044, 045, 046, 047 |
| 5 | `biblioteca-imagenes` | Biblioteca del comprador, catalogo uploads.json, miniaturas, lectura liviana media.php, TTL/retencion | 030, 039, 040, 042, 043 |
| 6 | `ficha-comprador` | Ficha Woo, panel, galeria auto-montada, ciclo carrito→pedido, invitado, validez, descargas | 005, 014, 017, 022, 036 |
| 7 | `texto-textmuy` | Integracion TextMuy, RenderCore, presets .txm, galerias sprite, cache-bust RCn | 009 |
| 8 | `cotizador` | Cotizador stickers: diseno del cliente, mockup 300x300, favoritos, customs | 037, 038 |

> `api-wordpress` NO va en baseline: es el change `add-api-wordpress` (ADDED).

## 5. Formato OpenSpec (reglas duras)

- Delta de **capacidad nueva**: `# Spec Delta` → `## Purpose` (1-2 frases, 50+ chars) →
  `## ADDED Requirements`.
- Cada requisito: `### Requirement: <nombre>` + descripcion **≤500 chars** (una sola conducta).
- Cada escenario: `#### Scenario: <nombre>` (**exactamente 4 almohadillas**) con
  `- **WHEN** ...` y `- **THEN** ...`. Todo requisito lleva ≥1 escenario.
- Normativo: SHALL/MUST (evitar should/may).
- Un change con 0 deltas exige `.openspec.yaml` con `skip_specs: true` (no aplica aqui).

## 6. Orden de ejecucion

### Change A — `baseline-capabilities` (baseline; se archiva al final)

- [ ] A1. Scaffold: `openspec new change baseline-capabilities` (crea proposal/specs/design/tasks).
- [ ] A2. `proposal.md`: Why (unificar specs en OpenSpec), What Changes (8 capacidades nuevas),
      Capabilities → New: los 8 de §4; Modified: vacio; Impact: solo `openspec/`.
- [ ] A3. `specs/<cap>/spec.md` para las 8 capacidades, **una a la vez** (decir en una linea cual
      se escribe). Destilar de las specs legacy fuente: quedarse con Requirements/Scenarios
      **vigentes**; descartar lo superado (p.ej. 023/025 superadas por 028; 020 legacy retirado).
      Formato §5. Mantener cada requisito como una conducta observable.
- [ ] A4. `design.md`: Context (dos sistemas de spec conviven; legacy es historia), Goals
      (baseline como verdad actual), Non-Goals (no migrar 1:1, no tocar codigo), Decisions
      (change+archive, 8 capacidades), Risks (perdida de matiz legacy → mitigacion: `specs/` queda
      como referencia; validacion cruzada con `specs/INDICE.md`).
- [ ] A5. `tasks.md`: checkboxes A1-A4 + verificacion; `## Workflow follow-up` con el archive.
- [ ] A6. Validar: `openspec validate baseline-capabilities --strict` (0 errores). Corregir hasta verde.
- [ ] A7. `openspec show baseline-capabilities --type spec` revisar coherencia; `openspec list --specs`
      debe listar las 8 capacidades.
- [ ] A8. Archivar: `openspec archive baseline-capabilities` → genera
      `openspec/specs/<cap>/spec.md` (8) y mueve el change a `changes/archive/`.
- [ ] A9. Verificar post-archive: `openspec list --specs` (8 caps) y `openspec show <cap> --type spec`
      para 2-3 capacidades (contenido no vacio, con Purpose y Requirements).

### Change B — `add-api-wordpress` (forward, activo; NO archivar)

- [ ] B1. `openspec new change add-api-wordpress`.
- [ ] B2. `proposal.md`: Why (objetivo de negocio: API síncrona para compras), What Changes
      (endpoint unico `admin_post_pmu_api` con `op=`, Application Passwords + manage_options + HTTPS,
      `uploads/pmu/api/{job_id}/` TTL 7d, idempotencia por job_id, respuesta síncrona),
      Capabilities → New: `api-wordpress`; Impact: `personalizador-pdf.php`, `inc/class-pmu-uploads.php`,
      `engine/Motor.php`, `readme.txt` (subir WP mínimo a 5.6).
- [ ] B3. `specs/api-wordpress/spec.md`: ADDED `api-wordpress` destilado de `specs/010-api-wordpress/spec.md`
      (FR-001..019, SC-001..011, edge cases) al formato §5. Conservar causas `api:<op>:<motivo>`.
- [ ] B4. `design.md`: D1-D5 cerradas (raster por grupo, validacion estricta contra analisis.json,
      Application Passwords, TTL 7d + purga diferida, síncrono, endpoint unico op=), dependencia WP 5.6.
- [ ] B5. `tasks.md`: fases (scaffold endpoint + auth, op=procesar con Motor::procesar, idempotencia,
      TTL/purga, limites, fases en `tests/texto_puente.php`, smoke en pestaña Test, docs/readme 5.6).
      **Sin marcar** (implementacion futura).
- [ ] B6. `openspec validate add-api-wordpress --strict` verde. **No** archivar.

### Change C — `deuda-testing-conductual` (forward, activo; NO archivar)

- [ ] C1. `openspec new change deuda-testing-conductual`.
- [ ] C2. `proposal.md`: Why (spec 048 borrador: 850 checks / 435 regex → migrar a conducta),
      What Changes (helper DOM propio, suites conductuales), Capabilities → Modified: `campos-consola`,
      `cargador-imagenes`, `biblioteca-imagenes` (requisitos de calidad de prueba, si aplica) o
      `skip_specs: true` si se decide que no cambia comportamiento observable. Impact: `tests/`.
- [ ] C3. `specs/<cap>/spec.md` deltas **solo si** cambia comportamiento observable; si no, poner
      `skip_specs: true` en `.openspec.yaml` y omitir specs.
- [ ] C4. `design.md` + `tasks.md` ( migracion incremental por suite, gate `node tests/*`). Sin marcar.
- [ ] C5. `openspec validate deuda-testing-conductual --strict` verde. **No** archivar.

### Fase 1 — Referencia historica

- [ ] D1. Crear `openspec/specs/README.md` (1 pagina) que: (a) dice que `openspec/specs/` es la
      verdad actual; (b) remite a `specs/INDICE.md` como archivo historico (Spec Kit) congelado;
      (c) lista las 8 capacidades y su alcance.
- [ ] D2. Verificar que `specs/` no fue modificado (`git status` solo muestra `openspec/` y READMEs nuevos).

## 7. Validacion (gates)

- [ ] `openspec validate baseline-capabilities --strict` → 0 errores (antes de archivar).
- [ ] `openspec validate add-api-wordpress --strict` y `... deuda-testing-conductual --strict` → 0 errores.
- [ ] `openspec list --specs` → exactamente 8 capacidades tras archivar baseline.
- [ ] `openspec list` → 2 changes activos (B, C) + baseline en archive.
- [ ] `openspec show <cap> --type spec` (2-3 caps) → Purpose + Requirements no vacios.
- [ ] `git status` → solo `openspec/` (y `.kilo/plans/`). Cero cambios en codigo o `specs/`.

> Si algun comando `openspec` esta bloqueado por permisos del agente, detenerse y pedir al
> usuario que habilite `openspec *`; no continuar sin validar.

## 8. Criterios de exito (definition of done)

- `openspec/specs/` tiene 8 specs (una por capacidad) con Purpose + Requirements + Scenarios.
- `openspec/changes/` tiene 2 changes activos (010, 048) validados, sin marcar.
- `openspec/changes/archive/` tiene `baseline-capabilities`.
- `openspec/specs/README.md` referencia `specs/INDICE.md`.
- `specs/` legacy intacto; cero cambios de codigo.
- Todo en español, sin tildes en identificadores (prosa con tildes permitida en Markdown).

## 9. Riesgos y mitigaciones

- **Perdida de matiz al destilar** → `specs/` queda como referencia; el README lo declara; validar
  contra `specs/INDICE.md` (fuente de verdad del estado).
- **Formato de spec invalido** → usar change+archive (OpenSpec genera el formato); gate `--strict`.
- **Specs duplicadas / nombres inventados** → usar exactamente los 8 nombres de §4; `openspec list --specs`.
- **Toe nada mas** → `git status` debe mostrar solo `openspec/`; si aparece otro archivo, revertir.
- **Permisos bash restringidos** (allowlist no incluye `openspec`) → el agente se detiene y pide habilitar.

## 10. Entregables (archivos que se crean)

- `openspec/changes/baseline-capabilities/{proposal,design,tasks}.md` + `specs/<8 caps>/spec.md`
  → archivados a `openspec/specs/<8 caps>/spec.md`.
- `openspec/changes/add-api-wordpress/{proposal,design,tasks}.md` + `specs/api-wordpress/spec.md`.
- `openspec/changes/deuda-testing-conductual/{proposal,design,tasks}.md` (+ specs o skip_specs).
- `openspec/specs/README.md`.

## 11. Notas para el agente ejecutor

- Leer `AGENTS.md` y `specs/INDICE.md` antes de empezar (estado real por spec).
- Destilar **una capacidad a la vez**; escribir el archivo y seguir.
- No marcar tasks de B/C (son trabajo futuro); marcar solo las del baseline al completarlas.
- No commitear/pushear (requiere aprobacion; el push dispara deploy). El usuario revisa al volver.
- Ante bloqueo o decision no cubierta: detenerse y dejar nota, no improvisar.