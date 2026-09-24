# Research: PDF condicionales por producto (validez de asociacion)

**Feature**: `005-pdf-condicionales` | **Creado**: 2026-09-19

Un producto Woo puede tener **varios PDFs asociados** y cada asociacion puede declarar una
**validez** (expresion JS del admin) que decide si ese PDF aplica con las selecciones del
cliente. Este documento fija el por que de cada decision; el contrato exacto de la expresion
vive en `contracts/validez.md`.

---

## D1. Multi-vinculo: `_pmu_pdf_slugs` (lista) en lugar de `_pmu_pdf_slug` (unico)

**Decision**: el postmeta canonico pasa a ser una lista (`_pmu_pdf_slugs`), con migracion
tolerante desde el singular (`_pmu_pdf_slug` se lee si la lista no existe y se conserva como
respaldo). El espejo `config.json:productos[]` no cambia.

**Rationale**: la norma ex-008 ya declara "un producto puede tener multiples PDFs" (spec 004
FR-1/FR-2 y `plan.md` Scale/Scope); el codigo actual solo implemento el singular y quedo
anotado como pendiente en `specs/004/tasks.md`. Sin lista no hay condicionales: no se puede
elegir "cual de los PDFs" si no hay varios.

**Alternatives considered**: tabla custom PDF<->producto (Const. IV: sin tablas custom);
usar solo el espejo `config.json:productos[]` (el canonico es el postmeta y el espejo no se
consulta en ficha).

## D2. `validez` es una expresion JS escrita por el admin (no reglas declarativas)

**Decision**: `config.json.tienda[product_id].validez` guarda una **expresion JS** que
devuelve `true`/`false`, en el mismo lenguaje que el `script` de los campos
(`contracts/campos.md`): `campoN` es el **valor de sistema** del campo (el mismo que consume
el Motor), con arrays disponibles (`.length`, `.includes`, `.join`) y funciones de ayuda
(`trim`, `incluye`, `regex`, `vacio`, `len`). Ejemplo:

```js
campo1 === 'libelulas' && campo2 === 'legal'
campo5.length >= 3 && incluye(campo3, 'sal')
trim(campo4) !== '' && regex(campo4, '^[A-Za-z ]{2,20}$')
```

**Rationale**: el admin ya escribe JS en los campos; una expresion es mas expresiva que un
arbol de reglas y no exige UI nueva de "constructor de condiciones". Se evalua en el
navegador con el mismo sandbox (sin `document`, sin globals).

**Alternatives considered**: constructor declarativo de reglas (mas UI, menos expresivo);
funcion completa con `function(){...}` (innecesario: una expresion alcanza).

## D3. LA DECISION CLAVE: la validez se evalua SOLO en el navegador

**Decision** (usuario, 2026-09-19): el **navegador tiene la autoridad** sobre la validez. La
ficha evalua la expresion al instante (filtra PDFs/mockups, muestra el primer
`mensaje_html` y aplica `bloquear`); el **servidor NO evalua JS** (Const. III) y solo
verifica lo que si puede comprobar sin evaluar codigo:

1. el PDF esta **asociado** al producto (`_pmu_pdf_slugs` + espejo) — interseccion dura;
2. el PDF esta **activo** (`config.json:activo`);
3. el item declara **al menos un PDF** elegible;
4. los PDFs declarados se **sanean** antes de congelarse.

**Rationale**: mantiene intacta la regla "PHP nunca evalua JS" y evita un parser/duplicador
del lenguaje JS en servidor. Lo unico evitable es la *combinacion* de variantes dentro del
mismo producto, que son variantes definidas por el propio admin, quedan auditadas
(`valores` + `pdfs[]` en manifest/meta) y son visibles en "Completados".

**Limite declarado** (no ocultar): `bloquear` es una regla de **UX/intencion de negocio**,
no una barrera de seguridad; un POST manual podria declarar otra combinacion de PDFs del
mismo producto. La puerta queda abierta sin migracion: si algun dia se quiere bloqueo duro,
se agrega un parser de subconjunto en PHP sobre el MISMO texto de `validez` (el formato del
config no cambia).

**Alternatives considered**:
- *Parser de subconjunto en PHP* (evaluar `===`/`&&`/`||`/`!`/comparadores/funciones
  allowlist con un parser propio): descartado por ahora por costo (doble implementacion +
  tabla de paridad) y porque el usuario prefirio la autoridad del navegador.
- *Evaluar JS en PHP* (V8/Node/`eval`): prohibido (Const. III + hosting compartido sin Node).
- *Confiar sin sanear*: descartado: la interseccion asociado+activo sigue siendo server-side.

## D4. Campos de PDFs inelegibles: SIEMPRE visibles (union deduplicada)

**Decision**: el panel de la ficha muestra la **union deduplicada** de los `campos_ids` de
todos los PDFs activos del producto, exista o no una validez que los haga inelegibles. El
filtrado ocurre despues: se ocultan los PDFs (y sus mockups), no los campos.

**Rationale**: dos razones. (a) Si un campo que desbloquea un PDF se ocultara por la
inelegibilidad de otro, se crearia una dependencia circular (no se podria volver a elegir).
(b) Los selectores de "diseño"/"tamaño" suelen vivir en un PDF y gobiernan a los otros; la
union es la unica forma de que sigan accesibles.

**Alternatives considered**: mostrar solo los campos del PDF elegible (riesgo circular);
mostrar todos pero deshabilitados (peor UX y bloquea la correccion).

## D5. Orden y cantidad de mensajes: solo el PRIMERO

**Decision**: cuando varias valideces dan `false` (o hay 0 elegibles), se muestra **un solo**
`mensaje_html`: el primero segun el orden deterministico de los PDFs (alfabetico por nombre,
el mismo que usa el listado de la consola). Sin concatenacion ni deduplicacion.

**Rationale**: decision del usuario; evita parrafos apilados en la ficha. El orden
deterministico mantiene el resultado estable entre recargas.

**Alternatives considered**: concatenar todos (ruido); mostrar el del PDF mas cercano al
elegido (dependencia de estado innecesaria).

## D6. `bloquear` es opcional, por asociacion, y visible solo si hay validez

**Decision**: `tienda[pid].bloquear` (bool, default `false`) deshabilita el `add-to-cart`
cuando la validez da `false`. En la UI aparece **solo si hay `validez`**. Regla adicional
NO configurable: **0 PDFs elegibles = siempre bloquea** (no hay nada que entregar).

**Rationale**: el default permisivo (regla V-7: la venta nunca se pierde por un fallo
tecnico) convive con la posibilidad explicita de endurecer el flujo cuando el admin sabe que
la combinacion no es producible. La regla de 0 elegibles no es una preferencia: sin PDFs no
existe item valido.

## D7. Congelado del snapshot: los elegibles se fijan al agregar

**Decision**: al agregar al carrito, los PDFs elegibles declarados por el navegador se
sanean (asociado + activo + sin duplicados) y se congelan como **snapshot** en
`manifest.pdfs[]` y en la meta del item (`_pmu_pdfs`). Mockups, pool, Descargas y la consola
de "Completados" trabajan SOLO con ese snapshot (`pdfs_descartados[]` guarda lo declarado y
no aceptado, para auditoria).

**Rationale**: el cliente aprobo una vista de un conjunto concreto de PDFs; re-evaluar la
validez al descargar (sin los valores del navegador ni la expresion) seria inconsistente. El
snapshot es ademas la unica forma de auditar que se entrego.

**Alternatives considered**: reevaluar al pagar (imposible sin JS); guardar solo los valores
y confiar en el orden (perdida de trazabilidad).

## D8. Diagnostico en la ficha para el admin

**Decision**: con `manage_options`, `tienda.js` vuelca por consola el resultado del evaluador
(expresion, valores usados, elegibles, primer mensaje, bloqueo). Sin build ni UI extra.

**Rationale**: pedido del usuario ("quizas imprimir logs en modo admin para saber como se
comporta"). Reutiliza el canal existente (`console.warn` con el prefijo del plugin).

**Alternatives considered**: simulador en la consola del plugin (UI nueva y duplicada: el
admin puede probar en la ficha, decidido por el usuario).

## D9. Dependencia con 004 y alcance de esta feature

**Decision**: 005 nace como feature propia (`spec/plan/tasks`) y su implementacion arranca
**despues de cerrar 004**; el unico cambio estructural que 005 comparte con 004 es el
multi-vinculo (D1), que ya era deuda anotada de 004.

**Rationale**: sin multi-vinculo no hay condicionales; declarar la dependencia evita
duplicar trabajo y mantiene el ledger de 004 coherente.

**Alternatives considered**: implementar 005 como parche dentro de 004 (mezcla dos normas y
dificulta el analisis posterior).