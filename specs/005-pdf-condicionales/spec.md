# Personalización condicional por producto: validez de asociación PDF×producto

**Branch**: `005-pdf-condicionales` | **Created**: 2026-09-19

## Contexto

Un producto WooCommerce puede tener **varios PDFs asociados** (norma ex-008, `plan.md`
Scale/Scope de 004). El cliente elige entre opciones (selector de "diseño general",
"tamaño de hoja", nombre, color, foto) y, según sus selecciones, **algunos PDFs aplican
y otros no**: el diseño "libélulas" en A4 usa un PDF, el mismo diseño en legal usa otro,
"mariposas" usa otros dos. Esta spec define cómo el admin declara esa condición por
asociación (PDF × producto) y cómo la ficha la evalúa para filtrar PDFs, mockups,
personalización y descarga.

Norma técnica: `constitution` §I+§IV (mockup, sesión por ítem, pool dedicado,
`preview_estado`) + decisiones de `research.md` (D1–D9). Prerrequisito: el multivínculo
`_pmu_pdf_slugs` (D1, deuda anotada de 004) — sin lista no hay condicionales.

---

## Descripción del Producto

Admin: asocia N PDFs a un producto Woo → por cada asociación declara `validez`
(opcional, expresión JS sobre los valores de sistema de los campos) + `mensaje_html`
(opcional, se muestra si la validez da `false`) + `bloquear` (bool, default `false`,
solo visible si hay validez; si la validez falla, no permite agregar al carrito).

Cliente: completa los campos → la ficha evalúa cada validez al instante → los PDFs
(y sus mockups) aparecen/desaparecen según sus selecciones → si alguna validez falla
se muestra el **primer** `mensaje_html` (orden determinista de PDFs) → si la
asociación fallida tiene `bloquear`, el `add-to-cart` se deshabilita.

Ejemplo (4 PDFs, 1 producto):

```text
pdf-diseno1-a4.pdf    -> producto1 (validez: campo1 === "libelulas" && campo2 === "a4")
pdf-diseno1-legal.pdf -> producto1 (validez: campo1 === "libelulas" && campo2 === "legal")
pdf-diseno2-a4.pdf    -> producto1 (validez: campo1 === "mariposas" && campo2 === "a4")
pdf-diseno2-legal.pdf -> producto1 (validez: campo1 === "mariposas" && campo2 === "legal")
```

Las definiciones de campos son las de 004 (`contracts/campos.md`): la validez usa los
**mismos `campoN` de valor de sistema** que consumen las plantillas `[campoN]` del
Motor. La validez vive en "Configuración tienda" de la asociación.

## Roles de Usuario

### Administrador (WordPress)
- Asocia N PDFs a un producto Woo (multivínculo `_pmu_pdf_slugs` + espejo).
- Por asociación abre "Configuración tienda": `activo` (el PDF no existe para el
  producto si está inactivo), `validez` (expresión JS opcional que devuelve `true`),
  `mensaje_html` (opcional, se ve si la validez da `false`), `bloquear` (default
  `false`, visible solo si hay validez; si la validez falla, bloquea el carrito).
- Revisa "completados": ve qué PDFs aplicaron (`manifest.pdfs[]`) y cuáles se
  descartaron (`pdfs_descartados[]`) para auditar la entrega.

### Cliente (WooCommerce)
- Completa los campos (la **unión** de los campos de todos los PDFs del producto).
- Ve aparecer/desaparecer PDFs y mockups según sus selecciones; lee el primer
  mensaje si algo no aplica.
- Agrega al carrito cuando hay al menos un PDF elegible y ningún `bloquear` activo;
  paga y descarga la lista nativa Woo (solo los PDFs del snapshot).

## User Scenarios & Testing

### Escenario 1: Admin declara valideces (P1)
Asocia 4 PDFs a producto1; en cada asociación escribe la validez del ejemplo y un
`mensaje_html` ("Ese diseño no viene en ese tamaño"); deja `bloquear` desactivado.
**Aceptación**: `config.json:tienda{product_id}` guarda `validez`/`mensaje_html`/
`bloquear` por PDF sin tocar `analisis.json` ni el resto de `config.json`.

### Escenario 2: Cliente filtra por selección (P1)
Elige diseño "libélulas" + tamaño "legal": solo `pdf-diseno1-legal` muestra mockups
y personalización; los otros tres se ocultan con el mensaje del primero.
**Aceptación**: galería con solo los mockups del elegible; manifiesto declara
`pdfs[]` con el elegible y `pdfs_descartados[]` con los tres restantes.

### Escenario 3: Bloquear producto (P2)
El admin activa `bloquear` en las 4 asociaciones. El cliente deja el nombre vacío
(validez con `trim(campoN) !== ''` da `false`): el `add-to-cart` se deshabilita y se
muestra el mensaje. Completa el nombre: se habilita.
**Aceptación**: botón deshabilitado con mensaje; habilitado al corregir; sin
`bloquear`, el mismo fallo solo muestra el mensaje sin bloquear.

### Escenario 4: Cero elegibles siempre bloquea (P2)
Ninguna validez da `true` (combinación imposible): aunque ningún `bloquear` esté
activo, el carrito no se habilita y la galería muestra "no hay vista previa".
**Aceptación**: 0 elegibles = sin `add-to-cart`; `preview_estado` coherente con 004.

### Escenario 5: Admin audita "completados" (P2)
Abre el pedido: ve valores del cliente, `pdfs[]` entregados y `pdfs_descartados[]`.
**Aceptación**: snapshot visible; regeneración usa solo el snapshot.

## Funcionalidades Requeridas

### FR-1: Multivínculo PDF↔producto
- FR-1.1: El postmeta canónico pasa a lista (`_pmu_pdf_slugs`); migración tolerante
  desde el singular (se lee si la lista no existe, se conserva como respaldo).
- FR-1.2: El espejo `config.json:productos[]` no cambia de formato.
- FR-1.3: La ficha resuelve el producto a la **lista** de PDFs (no al primero).

### FR-2: Configuración tienda por asociación
- FR-2.1: Por cada par (PDF × producto) existe `config.json:tienda{product_id}` con
  `activo` (bool, default `true`; inactivo = el PDF no existe para el producto en
  ningún sentido: ni campos, ni mockups, ni descarga).
- FR-2.2: `validez` (string JS opcional): expresión que devuelve `true`/`false`
  (contrato exacto en `contracts/validez.md`; mismo lenguaje que `script` de
  campos: `campoN` = valor de sistema, arrays con `.length`/`.includes`/`.join`,
  ayudas `trim`/`incluye`/`regex`/`vacio`/`len`).
- FR-2.3: `mensaje_html` (string opcional): HTML saneado (allowlist `wp_kses`) que se
  muestra al final de los campos renderizados si la validez da `false`.
- FR-2.4: `bloquear` (bool, default `false`): visible en admin solo si hay
  `validez`; si la validez da `false` y `bloquear` está activo, el producto no se
  puede agregar al carrito.

### FR-3: Evaluación en ficha (navegador, autoridad)
- FR-3.1: La ficha evalúa cada `validez` al instante con los valores de sistema
  actuales (los mismos que consumen las plantillas `[campoN]`).
- FR-3.2: PDFs con validez `false` (o inactivos) se ocultan: ni mockups, ni campos
  exclusivos, ni lugar en el snapshot. La unión de campos de los elegibles sigue
  visible.
- FR-3.3: Se muestra **un solo** mensaje: el `mensaje_html` de la primera validez
  fallida según el orden determinista de PDFs (alfabético por nombre).
- FR-3.4: Con `manage_options`, `tienda.js` vuelca el diagnóstico por consola
  (expresión, valores, elegibles, primer mensaje, bloqueo).

### FR-4: Intención de negocio (bloqueo)
- FR-4.1: Si alguna validez fallida tiene `bloquear` activo, el `add-to-cart` se
  deshabilita hasta que todas las valideces con `bloquear` den `true`.
- FR-4.2: **0 PDFs elegibles = siempre bloquea** (regla no configurable: sin PDFs
  no existe ítem válido).
- FR-4.3: Sin `bloquear` y con ≥1 elegible, la venta nunca se pierde (regla V-7
  de 004: mensaje visible, carrito habilitado).

### FR-5: Snapshot y ciclo comprador
- FR-5.1: Al agregar, el navegador declara los elegibles; el servidor los **sanea**
  (asociado al producto + activo + sin duplicados) y los congela en
  `manifest.pdfs[]` + meta del ítem (`_pmu_pdfs`); lo declarado y no aceptado va a
  `pdfs_descartados[]` (auditoría).
- FR-5.2: Mockups, pool, Motor, Descargas y "Completados" trabajan SOLO con el
  snapshot (nunca re-evalúan la validez sin el navegador).
- FR-5.3: El ítem exige al menos un PDF en el snapshot (rechazo con causa si llega
  vacío).

### FR-6: Validez como validador de datos
- FR-6.1: La misma expresión sirve para formato (`regex(campoN, ...)`), requerido
  (`trim(campoN) !== ''`), rango (`len(...)`, `.length`) y compatibilidad
  (`campo1 === "libelulas" && campo2 === "a4"`).
- FR-6.2: Un error del cliente (nombre mal escrito, opción sin elegir, formato
  inválido) se expresa como validez `false` + `mensaje_html` explicativo.

## Success Criteria

- SC-1: Admin asocia 4 PDFs con las valideces del ejemplo; la ficha filtra a 1
  elegible al elegir diseño+tamaño (galería con solo sus mockups).
- SC-2: El primer mensaje se muestra al fallar 1+ valideces; con 3 fallos
  simultáneos se muestra exactamente 1 (el del primer PDF alfabético).
- SC-3: Con `bloquear` activo y validez `false`, el `add-to-cart` está
  deshabilitado; al corregir, se habilita (en DOM, sin recarga).
- SC-4: Con 0 elegibles el carrito no se habilita aunque todo `bloquear` sea `false`.
- SC-5: PDF inactivo en la asociación nunca aparece en ficha ni entra al snapshot
  (declarado a mano en el POST, el servidor lo descarta a `pdfs_descartados[]`).
- SC-6: "Completados" muestra `pdfs[]` + `pdfs_descartados[]`; la regeneración usa
  solo el snapshot.
- SC-7: La evaluación es instantánea al cambiar un campo (<200 ms sin render de
  vistas; el render de mockups sigue su presupuesto de 004).

## Casos borde

- Asociación sin `validez`: el PDF siempre aplica (comportamiento 004 sin cambios).
- `validez` vacía o solo espacios: se trata como ausente (siempre `true`).
- `validez` con error de sintaxis: se rechaza al guardar en admin (misma causa que
  `script` inválido de campos); si llega una guardada vieja, se trata como `true`
  y se avisa en consola admin (nunca rompe la ficha).
- Campo inexistente en la expresión: su valor es `undefined` (la expresión decide).
- `mensaje_html` con etiquetas fuera de la allowlist: se sanean al guardar.

## Supuestos y límites

- **Autoridad del navegador (D3, 2026-09-19)**: `validez` es JS evaluado **solo en
  el navegador**; PHP nunca evalúa JS (Const. III). El servidor solo intersecta
  asociación (`_pmu_pdf_slugs` + espejo) y `activo`, exige 1+ PDFs y sanea antes de
  congelar. `bloquear` es regla de UX/intención de negocio, no barrera de
  seguridad: un POST manual podría declarar otra combinación del mismo producto
  (auditada en valores + `pdfs[]`). Puerta abierta sin migración: bloqueo duro con
  subconjunto del lenguaje versionando `contracts/validez.md`.
- Sin parser en esta etapa (D3): no se duplica el lenguaje en servidor.
- Prerrequisito: multivínculo `_pmu_pdf_slugs` (D1); 004 aporta campos, mockups,
  sesión, pool, `preview_estado`, Descargas y "Completados" sin cambios.