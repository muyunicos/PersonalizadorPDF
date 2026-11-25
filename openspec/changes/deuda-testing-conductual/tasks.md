# Tasks — deuda-testing-conductual

> Change forward (activo). Tareas SIN marcar: implementacion futura.
> `skip_specs: true` (no cambia comportamiento observable).

## 1. Selector conductual

- [ ] C1. `tests/conducta-selector.test.js` con >=35 checks (sin DOM): `_paramsIniciales`,
  `_params`, `_recetaDeFoto`, aplicar receta de otra geometria -> false.
- [ ] C2. Conservar los asserts de wiring de `selector-contrato` justificados.

## 2. Biblioteca conductual

- [ ] C3. Seccion de runtime en `tests/biblioteca-contrato.test.js` (>=20 checks): pintar tira,
  tocar miniatura -> `onElegir(id)`, chip -> visor.
- [ ] C4. No borrar wiring para maquillar el numero.

## 3. Mockup composicion real

- [ ] C5. `tests/mockup-contrato.test.js` ejecuta `PMUMockup.componer` con canvas stub (>=3 casos).
- [ ] C6. Recorte dentro del lienzo sin romper.

## 4. Helper y guia

- [ ] C7. `tests/_util/dom-stub.js` propio (sin dependencias), reutilizado por >=2 suites.
- [ ] C8. Documentar politica (regex = wiring) en `AGENTS.md §9`.
- [ ] C9. Gate `node tests/<suite>.test.js` por suite; 0 puertas de verde a rojo.
- [ ] C10. Gate `openspec validate deuda-testing-conductual --strict` verde. No archivar.