# Plan — 016 Editor visual de fotos

## Alcance

100% cliente. No toca el motor, ni los datos, ni `modules/textmuy/`, ni agrega
endpoints (D5). Un solo archivo de comportamiento evoluciona (`selector-pmu.js`),
uno se extiende visualmente (`cargador-pmu.js`), y entra un vendor nuevo
(Cropper.js 1.6.2).

| Archivo | Fase | Cambio |
|---|---|---|
| `assets/vendor/cropper/` | F0 | **NUEVO**: min.js + min.css + LICENSE + ORIGEN.md (hash SHA256) |
| `personalizador-pdf.php` | F0 | encola `personalizador-pdf-cropper` (script + estilo) en `assets_ficha()` y lo declara dependencia de `personalizador-pdf-selector` |
| `tests/selector-contrato.test.js` | F0 | **NUEVO**: puerta Node del vendor, del encolado y del contrato publico |
| `assets/selector-pmu.js` | F1–F3 | shell responsivo + Cropper en `crop` + badge en vivo; `fit` conserva el canvas actual |
| `assets/cargador-pmu.js` | F4 | tira visual (miniaturas reales, quitar/cambiar) + restauracion de estado |
| `assets/tienda.js` | F4 | pasa los ids iniciales al cargador al re-editar (resolucion por `personalizador_pdf_subida_url`) |
| `specs/004.../contracts/selector-pmu.md` | F5 | enmienda aditiva apuntando a esta spec |
| `AGENTS.md`, `specs/INDICE.md`, `specs/MANUAL-PENDIENTE-WP-REAL.md` | F5 | docs |

## Orden

F0 ya esta hecha (2026-10-10). **F1 antes que F2**: el shell define el
contenedor (`<img>` + overlay) sobre el que Cropper monta; sin el contenedor no
hay que instanciar. F3 depende de F2 (el badge escucha los eventos de Cropper).
F4 es independiente del modal (es la tira), pero conviene cerrarla despues:
"cambiar" (FR-016) reabre el modal, asi que se prueba completo al final. F5
congela todo con la puerta.

## Por que el vendor es el paso 1

- El enqueue define el orden de carga (Cropper antes que selector), sin lo cual
  F1/F2 arrancarian rotos en el navegador.
- La puerta de F0 congela el contrato publico de `selector-pmu` ANTES de
  tocarlo: cualquier fase futura que lo rompa se atrapa en Node, no en el
  navegador.
- El vendor se verifica contra el hash SHA256 publicado por jsDelivr para
  1.6.2 (quedo documentado en `ORIGEN.md`), asi una descarga corrupta no llega
  al repo.

## Riesgos

- **Choque de CSS del tema con `.cropper-*`**: las clases de Cropper son
  genericas; si el tema las pisa, el marco se ve mal. Mitigacion: scopar el
  contenedor del modal (`#spmu-modal .cropper-*`) y probar en el tema real.
- **Robar el scroll en movil**: el area de ajuste usa `touch-action: none`;
  hay que confinarlo al lienzo para que el modal siga siendo scrolleable por
  fuera. Si no, el comprador no puede bajar al boton Aceptar en pantallas
  chicas.
- **El contrato publico**: si una fase cambia `onSelect`/`obtenerBlob`, el
  cargador y `tienda.js` se rompen en silencio. La puerta Node de F0 ya lo
  congela; cada fase suma checks.
- **`fit` hibrido (D9)**: dos caminos de render (Cropper vs canvas). El riesgo
  es que divergan en rotacion o escala. Se mitiga manteniendo el `fit` como el
  codigo de hoy, sin "mejorarlo" (no es el objetivo de esta spec).
- **Sin `Cropper` cargado (FR-006)**: el modal DEBE degradar al comportamiento
  actual. La puerta verifica que el chequeo `typeof window.Cropper` existe.
- **Versionado del vendor**: al actualizar Cropper, se re-verifican hashes y se
  sube la version del plugin (cabecera unica, regla 10.bis) para el cache-bust.

## Que NO se toca

- `engine/`, `inc/` (datos y Motor).
- `modules/textmuy/` (sin bump `?v=RCn`, sin commit en su repo).
- La galeria del admin (spec 009) y `assets/miniaturas.js`.
- El formato `manifest.subidas[]` y los endpoints de la 012.
