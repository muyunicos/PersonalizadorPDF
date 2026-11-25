# Tasks — baseline-capabilities

## 1. Scaffold y propuesta

- [x] A1. Scaffold `openspec new change baseline-capabilities`
- [x] A2. `proposal.md` (Why, What Changes, 8 New Capabilities, Impact)

## 2. Deltas de capacidad (una a la vez)

- [x] A3.1. `specs/pdf-motor/spec.md`
- [x] A3.2. `specs/mockups-editor/spec.md`
- [x] A3.3. `specs/campos-consola/spec.md`
- [x] A3.4. `specs/cargador-imagenes/spec.md`
- [x] A3.5. `specs/biblioteca-imagenes/spec.md`
- [x] A3.6. `specs/ficha-comprador/spec.md`
- [x] A3.7. `specs/texto-textmuy/spec.md`
- [x] A3.8. `specs/cotizador/spec.md`

## 3. Diseno y tareas

- [x] A4. `design.md` (Context, Goals/Non-Goals, Decisions, Risks, Migration)
- [x] A5. `tasks.md` (este archivo + workflow follow-up)

## 4. Validacion y archive

- [ ] A6. `openspec validate baseline-capabilities --strict` -> 0 errores
- [ ] A7. `openspec show baseline-capabilities --type spec` + `openspec list --specs`
- [ ] A8. `openspec archive baseline-capabilities` -> 8 specs en `openspec/specs/`
- [ ] A9. Verificar post-archive 2-3 capacidades con `openspec show <cap> --type spec`

## Workflow follow-up

- Tras archive: crear `openspec/specs/README.md` (referencia historica a `specs/INDICE.md`).
- Crear changes forward `add-api-wordpress` y `deuda-testing-conductual` (sin marcar).
- No commitear/pushear (requiere aprobacion; el push dispara deploy).