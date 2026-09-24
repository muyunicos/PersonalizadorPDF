# Contract: `validez` de asociación PDF×producto (expresión JS del admin)

**Feature**: 005-pdf-condicionales | **Version**: 1 (2026-09-19)

Cada asociación (PDF × producto Woo) puede declarar una **expresión JS** que decide
si ese PDF aplica con las selecciones del cliente. Se evalúa **solo en el navegador**
(D3); PHP nunca la evalúa (Const. III).

## Dónde vive

`config.json:tienda{product_id} = {activo, validez, mensaje_html, bloquear}`.
`product_id` es el ID numérico del producto Woo (clave string del objeto).

## Sintaxis

- Una **expresión** (no sentencia, no `function`, no `return`): el valor resultante
  se convierte a booleano (`true` = el PDF aplica).
- Vacía o solo espacios = ausente (siempre `true`).
- Mismo lenguaje que `script` de campos (`contracts/campos.md` de 004): sin
  `document`, sin globales, sin acceso al DOM. Al guardar se valida con el mismo
  sandbox (causa `motor:campos:script:invalido` si no compila).

## Contexto disponible

| Símbolo | Significado |
|---|---|
| `campoN` | **valor de sistema** del campo N (el mismo que consumen las plantillas `[campoN]` del Motor). String, número, booleano o array según el campo. Campo inexistente = `undefined`. |
| `trim(x)` | `String(x).trim()` (con `undefined`/`null` da `''`). |
| `incluye(x, sub)` | `String(x)` contiene `sub`. Con array, `x.includes(sub)`. |
| `regex(x, patron)` | `new RegExp(patron).test(String(x))`. |
| `vacio(x)` | `true` si `undefined`, `null`, `''`, solo espacios o array vacío. |
| `len(x)` | longitud (`String(x).length`, arrays: `x.length`). |

Arrays del campo (`array=true` en `campos.json`): `.length`, `.includes(v)`,
`.join(sep)`, indexado `campoN[i]` — JS estándar dentro de la expresión.

## Ejemplos (los 4 PDFs del spec)

```js
campo1 === 'libelulas' && campo2 === 'a4'
campo1 === 'libelulas' && campo2 === 'legal'
campo1 === 'mariposas' && campo2 === 'a4'
campo1 === 'mariposas' && campo2 === 'legal'
```

Validadores de datos (FR-6):

```js
trim(campo3) !== ''                          // nombre requerido
regex(campo3, '^[A-Za-z ]{2,20}$')           // formato nombre
campo5.length >= 3 && incluye(campo4, 'x')   // rango + contenido
```

## Semántica en ficha

1. Sin `validez` (o vacía) = siempre `true`.
2. `validez` guardada vieja que hoy no compila = `true` + aviso en consola admin
   (nunca rompe la ficha).
3. Evaluación por asociación, independiente; orden determinista = alfabético por
   nombre de PDF (mismo que la consola).
4. Primer `mensaje_html` de las valideces fallidas (en ese orden); 0 elegibles =
   mensaje genérico "no hay vista previa" + bloqueo (regla no configurable).

## Saneado (servidor, sin evaluar JS)

Al agregar, el servidor intersecta lo declarado por el navegador con lo que sí
puede comprobar: asociado (`_pmu_pdf_slugs` + espejo), `tienda.activo !== false`,
sin duplicados. Aceptados → `manifest.pdfs[]` + meta `_pmu_pdfs`; resto →
`pdfs_descartados[]`. Vacío → rechazo con causa (nunca ítem sin PDFs).

## Criterios de aceptación

- Las 4 expresiones del ejemplo filtran a 1 elegible según diseño+tamaño.
- `campoN` es el valor de sistema (nunca la etiqueta `cliente`).
- Una expresión con `document` o globals no guarda (sandbox de campos).
