# Plan — 015 Tipo y overrides

## Alcance

Dos commits, en este orden. No toca `modules/textmuy/` (D8), ni el motor, ni el
panel del comprador mas alla de lo que ya existe.

| Archivo | Commit 1 (A+B) | Commit 2 (C) |
|---|---|---|
| `inc/class-pmu-uploads.php` | `tipo_valida()`, `normalizar_datos_campo()`, `tocar_meta()`, `campo_listar()`, fuera `campo_plantilla()`, `migrar_campos_v3()` | — |
| `personalizador-pdf.php` | `plantilla_campo()`, `campo_desde_post()`, `fila_campo_html()`, `form_campo_html()`, `handle_campo_guardar()`, fuera `handle_campo_plantilla` + su `add_action`, el modal de alta rapida | plantilla `opciones` |
| `admin/campos.php` | columnas, sin chips | — |
| `admin/pdfs.php` | etiqueta "Tipo", fuera el input de Categorias, texto de `settings` | texto de `settings` = solo referencias |
| `assets/admin.js` | `pintarFila()`, filtros, modal de alta rapida, fuera `.ec-marcar` | — |
| `assets/tienda.js` | — | `resolverOverrides()`, `items[].overrides`, `hashRender` |
| tests | `campos_migracion.php`, fases, `campos-contrato.test.js`, smokes | fase `overrides` |

## Por que A antes que C

C valida el tipo de campo contra el cableado (D11). Si C entrara antes, validaria
contra un concepto que todavia no existe. Ademas son cambios de naturaleza
distinta: A+B es un renombrado con superficie de tests grande; C es una funcion
nueva pequena. En commits separados cada uno se puede leer solo.

## Orden dentro del commit 1

1. `inc/class-pmu-uploads.php` primero (el formato manda sobre todo lo demas).
2. `migrar_campos_v3()` y `tests/campos_migracion.php`: el banco se actualiza
   antes de tocar la UI, asi el fallo aparece en PHP y no en el navegador.
3. `personalizador-pdf.php` (markup y handlers).
4. `admin/*.php` y `assets/admin.js`.
5. Fases del arnés y smokes.

## La migracion a version 3

`campos.json` pasa a `version: 3` con `migrar_campos_v3()` siguiendo el patron de
la v2: backup `.bak`, todo-o-nada, idempotente, y el mapeo escrito en el docblock.
Mapeo: `plantilla` -> `tipo`, `select` -> `opciones`, `''` -> `texto`, y se saca
`categorias` de `datos.json` y de `meta.{id}`.

**Queda pendiente de decidir**: el usuario dijo que hoy no hay datos que migrar.
La migracion sale ~30 lineas y protege el lab y cualquier maquina de desarrollo,
pero si se prefiere arrancar limpio, se saca del plan (queda como T001 `[~]`).

## Riesgos

- **El hash del pool (FR-005)** es el riesgo serio del commit 2: si se implementa
  C sin tocarlo, el fallo no es una excepcion sino **el PDF equivocado**, en
  silencio. Va en el mismo commit por eso.
- **`String(v)` sobre un objeto**: hoy `resolverPlantilla` lo hace y produce
  `[object Object]`. Con D4 el campo ya publica string, pero un `campo.js` mal
  escrito todavia puede devolver un objeto. Por eso FR-006 pide avisar, no
  convertir.
- **Sin cambios en `modules/textmuy/`**: si alguien "completa" el render en el
  modulo sin querer, se duplica la logica y aparecen dos caminos. Es la razon de
  D8 estar escrita.
- **La estrella disappears**: `campo_plantilla()` se borra y con ella el endpoint
  `personalizador_pdf_campo_plantilla`. Hay que quitar **los dos** `add_action`
  y la entrada en `security()`; si se queda uno, WordPress avisa del hook
  huerfano en el smoke.