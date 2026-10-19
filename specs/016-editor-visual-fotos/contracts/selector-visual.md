# Contract: selector-visual (enmienda de selector-pmu)

**Feature**: 016-editor-visual-fotos | **Fecha**: 2026-10-10

> **Enmienda aditiva** del contrato `specs/004-woocommerce-pdf-personalization/contracts/selector-pmu.md`.
> La interfaz publica NO cambia: lo que cambia es el interior del modal. Quien
> consuma el contrato viejo sigue funcionando sin tocar una linea.

## Interfaz (identica a la 004)

```js
new SelectorPMU(elemento, config)          // config: finalW, finalH, aspectRatio,
                                           // mode ('crop'|'fit'), category
sel.onSelect(function (url, meta) {})      // url = objectURL del PNG final
sel.onError(function (mensaje, e) {})      // e = {code, message}
sel.on(evento, callback)                   // progress | success | error
sel.obtenerBlob()                          // ultimo PNG recortado
sel.open() / sel.close() / sel.destroy()
```

- `finalW`/`finalH` siguen siendo **obligatorios** y los define el campo/PDF.
- La salida sigue siendo **PNG** de exactamente `finalW x finalH` px.
- Los tipos aceptados y los codigos de error (`INVALID_TYPE`, `CROP_ABORTED`,
  `UPLOAD_FAILED`) siguen vigentes. Sin `SIZE_EXCEEDED`.

## Lo nuevo (aditivo)

| Punto | Regla |
|---|---|
| `mode: 'crop'` | el interior usa **Cropper.js 1.6.2 vendoreado** (`assets/vendor/cropper/`): pan, pinch-zoom 1x-8x, doble tap, rotar 90°, guia de tercios, marco con tiradores. La salida sale de `getCroppedCanvas(finalW, finalH)` -> `toBlob('image/png')` |
| `mode: 'fit'` | **sin cambios**: conserva el canvas actual (contain con margenes transparentes). Cropper no tiene modo contain y no se lo fuerza |
| config `ajustes` | **reservado** (array vacio hoy): pipeline futuro de ajustes (filtros). Un llamador que lo envie no rompe nada |
| config `envoltura` | **opcional** `{par, subs}` (geometria normalizada 0..1, la que publica `campo.envoltura`; spec 011 FR-049). El modal la dibuja como **GUIA** en un canvas separado (`pointer-events:none`, `aria-hidden`): en `crop` sobre la caja de preview (opcion `preview` de Cropper), en `fit`/degradacion encima del canvas de salida. Sin `envoltura` no se agrega DOM; sin `PMUMockup` se omite sin lanzar. **Nunca** altera el recorte ni el PNG |
| Degradacion | si `window.Cropper` no esta (no encolado, navegador viejo), el modal DEBE comportarse como el de la 004 (canvas + slider + select) y avisar por `onError`. Nunca un error de JS |
| Dependencia de carga | el plugin DEBE encolar `personalizador-pdf-cropper` (script + estilo) ANTES que `personalizador-pdf-selector` (dependencia declarada) |
| Shell | el modal es full-screen en movil (<768px) con camara/drop zone, dialogo amplio en escritorio, focus trap y Escape (detalle: spec 016, FR-001..FR-006) |

## Reglas que NO cambian

- El componente **no sube nada**: entrega el blob al llamador (el cargador lo
  envia al item).
- El recorte es **rectangular**; las formas de ranura (`circle`/`square`) son
  presentacion en la tira del cargador, no del recorte.
  **Enmienda (v2)**: la `envoltura` del PDF tampoco cambia el recorte: es una **guia**
  informativa. El PNG entregado a `onSelect` va **sin mascara**; el clip real lo aplica el
  PDF al procesar. Se dibuja en un canvas separado, nunca en el lienzo de salida.
- El ciclo de vida (pool del item, manifest, promocion al pedido) sigue en la
  004/012, sin cambios.

## Criterios de aceptacion

- `CargadorPMU` y `tienda.js` funcionan sin cambios con el componente nuevo.
- Un recorte hecho en movil (dedos) da el mismo PNG que el mismo ajuste con
  mouse.
- Sin `window.Cropper`, el flujo sigue completo por el camino viejo.
- Con `envoltura`, el PNG de `obtenerBlob()` es **identico** al de una corrida sin
  `envoltura` (misma imagen, mismas dimensiones, sin mascara).
- Puerta: `node tests/selector-contrato.test.js` en verde (F0-F5).
