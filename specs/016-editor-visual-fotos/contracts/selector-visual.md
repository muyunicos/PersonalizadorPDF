# Contract: selector-visual (enmienda de selector-pmu)

**Feature**: 016-editor-visual-fotos + 021-cargador-visor-cliente | **Fecha**: 2026-10-19

> **Enmienda v3 (spec 021, 2026-10-19)**: motor unificado Canvas 2D con:
> - `spmu-escena` de hasta `1000x1000 px` con la relacion de aspecto exacta del placeholder (`finalW : finalH`) y **10% de margen interno** en cada borde (`canvasW = 1.2 * finalW`, `canvasH = 1.2 * finalH`).
> - **Doble guia de recorte**: recorte secundario (`finalW x finalH`, donde realmente se corta el PNG exportado) y recorte principal (`forma`: `'rectangulo'|'circulo'|'cuadrado'|'ovalo'|'auto'`, posicionado con `size`, `ox`, `oy`).
> - **3 modos (`rellenar` / `ajustar` / `estirar`) y regla del 5%**: si la imagen no difiere mas del 5% en relacion de aspecto respecto al lienzo, se usa solo **Modo 3 — Estirar** y se oculta **Girar**; si supera el 5%, se muestran los 3 botones y **Girar** (solo si ademas la ranura declara `{ r: 1 }`).
> - Control **Reducir / Ampliar** con reset al centro (`0`), arrastre/pinch y **color de fondo** autodetectado por los bordes de la imagen (o `'transparent'` si los bordes tienen transparencia).
> - Apertura directa del selector de archivos, boton `"Cargar imagen"` / `"Cambiar imagen"`, sin botones `"Camara"` ni `"Reintentar"`, boton `"Subir"` con aviso `"Subiendo imagen..."` y pregunta `"¿Queres subir otra imagen?"` si quedan espacios, mas **mini galeria fullscreen (`cpmu-visor`)** al tocar las miniaturas subidas.
>
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
- **Spec 019 (aditivo)**: el badge en vivo agrega `· se amplia Nx` (una decimal, tolerancia
  1.05) cuando el recorte amplia la imagen (`finalW/ancho_origen` o `finalH/alto_origen` > 1,
  o el `contain` del modo `fit`). Es **informativo**: no deshabilita "Aceptar" ni cambia la
  salida. Con `phsize` el tamaño final puede venir del grupo del PDF (spec 019), asi que el
  aviso tambien cubre ese caso sin cambios en el selector.
- Los tipos aceptados y los codigos de error (`INVALID_TYPE`, `CROP_ABORTED`,
  `UPLOAD_FAILED`) siguen vigentes. Sin `SIZE_EXCEEDED`.

## Lo nuevo (aditivo)

| Punto | Regla |
|---|---|
| `mode: 'crop'` | **SUPERADO por la spec 021**: hoy el interior es el motor propio de Canvas 2D de `selector-pmu.js` (3 modos `Rellenar`/`Ajustar`/`Estirar`, margen del 10%, doble guia). Cropper.js y su encolado se **retiraron** |
| `mode: 'fit'` | **SUPERADO por la spec 021**: equivale al modo `ajustar` (contain con color de fondo o margenes transparentes) |
| config `ajustes` | **reservado** (array vacio hoy): pipeline futuro de ajustes (filtros). Un llamador que lo envie no rompe nada |
| config `envoltura` | **opcional** `{par, subs}` (geometria normalizada 0..1, la que publica `campo.envoltura`; spec 011 FR-049). El modal la dibuja como **GUIA** en un canvas separado (`pointer-events:none`, `aria-hidden`). Sin `envoltura` no se agrega DOM; sin `PMUMockup` se omite sin lanzar. **Nunca** altera el recorte ni el PNG |
| Degradacion | **retirada en la spec 021**: ya no hay dependencia externa que pueda faltar (el motor es propio). Se conserva el aviso por `onError` ante un fallo de generacion |
| Dependencia de carga | **retirada en la spec 021**: `selector-pmu` se encola sin dependencias (Cropper.js y su encolado se eliminaron; lo congela la fase F0 de `tests/selector-contrato.test.js`) |
| Shell | el modal es full-screen en movil (<768px) con drop zone, dialogo amplio en escritorio, focus trap y Escape (detalle: specs 016 FR-001..FR-006 y 021) |

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
- El PNG entregado a `onSelect` mide **exactamente** `finalW x finalH` y **no**
  lleva las guias de la escena (spec 021 D1).
- Con `envoltura`, el PNG de `obtenerBlob()` es **identico** al de una corrida sin
  `envoltura` (misma imagen, mismas dimensiones, sin mascara).
- Puerta: `node tests/selector-contrato.test.js` en verde (F0-F5).
