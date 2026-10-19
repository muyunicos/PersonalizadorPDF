# Tareas — 016 Editor visual de fotos

> Regla: **no marcar `[X]` una tarea por aproximacion**. Si falta un requisito,
> `[~]`. Puertas al cerrar cada fase: `php -l`,
> `node tests/selector-contrato.test.js`, `node tests/campos-contrato.test.js`,
> `node --check assets/selector-pmu.js assets/cargador-pmu.js assets/tienda.js`.

## F0 — Vendor de Cropper.js + encolado + puerta (fundacional)

- [X] **T001 [P]** Vendorizar **Cropper.js 1.6.2** en `assets/vendor/cropper/`:
  `cropper.min.js` (37 369 bytes) + `cropper.min.css` (3 795 bytes) + `LICENSE` +
  `ORIGEN.md` con origen, version clavada y **hash SHA256 publicado por jsDelivr**.
  Verificado: descarga con hashes coincidentes (D7/D8). Nunca CDN; nunca editar
  el minificado a mano.
- [X] **T002** `personalizador-pdf.php:assets_ficha()`: encolar
  `personalizador-pdf-cropper` (script UMD + estilo) y declararlo **dependencia**
  de `personalizador-pdf-selector`, con `PERSONALIZADOR_PDF_VERSION` (D10).
- [X] **T003** `tests/selector-contrato.test.js` (NUEVO): puerta Node con (a) los
  4 archivos del vendor + pesos exactos, (b) los literales del encolado (handle,
  ruta, dependencia, sin CDN) y (c) el **contrato publico** de `selector-pmu`
  (constructor, `onSelect`, `onError`, `obtenerBlob`, `close/destroy`,
  `finalW/finalH`) y el seam de `cargador-pmu` que lo instancia.
  **SELECTOR CONTRATO OK (F0)** en verde, junto con `CAMPOS CONTRATO OK`.

## F1 — Shell del modal (US1)

- [X] **T004** `selector-pmu.js`: rehacer el markup del modal como shell
  responsivo: full-screen en <768px (safe-area `env(safe-area-inset-*)`,
  `overflow:hidden` del body mientras abierto, restauracion al cerrar), dialogo
  amplio (>=640px) en escritorio; header con titulo del marco y tamaño, boton
  cerrar. FR-001, FR-002.
- [X] **T005** Entradas de archivo: drop zone sobre todo el modal (eventos
  `dragover/drop`), boton Elegir y boton de **camara** en movil (input con
  `capture`), todo reusando `_cargar()` y la validacion de tipos actual.
  FR-003.
- [X] **T006** Estados: spinner durante la carga del archivo, error con boton
  **Reintentar** (FR-004); focus trap (cicla con Tab dentro del dialogo) y
  restauracion del foco al cerrar, Escape ya existente (FR-005).
- [X] **T007** Degradacion sin Cropper (FR-006): `typeof window.Cropper` decide
  la rama; sin el, se conserva EXACTAMENTE el modal actual (canvas + slider +
  select). La puerta verifica el literal del chequeo.

## F2 — Cropper en el modo crop (US2)

- [X] **T008** `selector-pmu.js`: montar Cropper sobre un `<img>` (objectURL del
  archivo elegido) en la rama `crop`: `viewMode: 1`, `aspectRatio` de la config,
  `autoCropArea` inicial que encaje el origen, `rotatable`, `zoomable`,
  `zoomOnWheel`, `responsive: true` (FR-007, FR-008).
- [X] **T009** Doble tap (FR-009): con la opcion `dblclick` alternar entre el
  encuadre actual y 100% (toggle con el dato previo de `getData()`).
- [X] **T010** Rotacion (FR-010): boton "Rotar" -> `cropper.rotate(90)`; el
  gesto de 2 dedos lo da Cropper (`rotatable`).
- [X] **T011** Aceptar: reemplazar `_aceptar()` de la rama crop por
  `getCroppedCanvas({width: finalW, height: finalH, imageSmoothingQuality: 'high'})`
  -> `toBlob('image/png')`; el resto de `_aceptar` (blob -> `onSelect`, meta,
  `obtenerBlob`) queda identico. El `fit` (D9) NO se toca: sigue con su canvas.
- [X] **T012** Limpieza del ciclo de vida: `close()/destroy()` DEBEN hacer
  `cropper.destroy()` y revocar objectURLs (sin fugas al reabrir).

## F3 — Badge en vivo y guias (US3)

- [X] **T013** Config de Cropper con `guides: true` (tercios) y sombreado del
  area fuera (default de Cropper) (FR-012).
- [X] **T014** Badge en vivo: eventos `crop`/`zoom` actualizan un texto
  "Salida WxH px · zoom xN" (el ratio sale de canvasData/naturalWidth); al
  cargar, "Origen WxH px". FR-013.
- [X] **T015** En `fit`, el canvas actual muestra los margenes transparentes
  sobre tablero de ajedrez (ya lo hace el CSS `.spmu-escena`; verificar que el
  shell nuevo lo conserve). FR-014.

## F4 — Tira visual del cargador (US4)

- [X] **T016** `cargador-pmu.js`: las minis pasan de numero a **miniatura real**
  (imagen por id; el componente recibe del config una funcion `urlDe(id) ->
  Promise<url>` para no conocer el endpoint) con la forma de la ranura como
  mascara CSS (FR-015). Fallback: si no hay URL, el numero de hoy (nunca una
  mini rota).
- [X] **T017** Acciones por mini: quitar (confirmacion visual, p. ej. estado
  "tocada de nuevo para confirmar") y **cambiar** (reabre el `SelectorPMU` de
  esa ranura; al aceptar, **reemplaza** el id en su posicion, no suma; `max`
  sigue mandando). FR-016, FR-018.
- [X] **T018** `tienda.js:montarCargadores`: acepta `idsIniciales` por campo
  (los que ya estan en el estado al re-editar) y los resuelve con
  `personalizador_pdf_subida_url` para pintar las minis (FR-017). Sin ids, nada
  cambia (el flujo de hoy queda intacto).

## F5 — Contrato, puertas y docs (US5)

- [X] **T019** Ampliar `tests/selector-contrato.test.js` con las fases F1-F4:
  literales del shell (drop zone, captura, focus trap, degradacion), config de
  Cropper (`viewMode`/`aspectRatio`/`getCroppedCanvas` con finalW/finalH),
  `cropper.destroy()` en close, y el cableado de minis del cargador. Barrido
  completo de puertas en verde.
- [X] **T020** Enmendar `specs/004-woocommerce-pdf-personalization/contracts/selector-pmu.md`
  con una nota aditiva que apunte a esta spec (D1/D9: misma interfaz, interior
  nuevo, `fit` sin cambios). FR-021.
- [X] **T021** Docs: fila nueva en `specs/INDICE.md`, `AGENTS.md` (arbol con
  `assets/vendor/cropper/`, puerta nueva en §9 y la entrada del manual), seccion
  del recorrido en `specs/MANUAL-PENDIENTE-WP-REAL.md` (movil emulado + mouse),
  changelog de `readme.txt` y bump de version (cabecera unica + Stable tag).
- [ ] **T022** Recorrido manual en WP real (movil emulado y escritorio):
  cargar con dedos y con mouse, rotar, doble tap, cambiar foto, volver del
  carrito, y PDF final con la foto correcta en el hueco.

## F6 — Envoltura del PDF como guia (US5b, contrato v4 de la 011)

- [X] **T024** `selector-pmu.js`: `config.envoltura = {par, subs}` opcional (validador
  `envolturaValida`) + `_pintarEnvoltura()`: canvas **separado** (`pointer-events:none`,
  `aria-hidden`), oscurece **solo lo de fuera** de la forma (relleno + `destination-out`)
  y dibuja el contorno, reusando `PMUMockup.comandosEnvoltura`/`trazarEnvoltura`. Sin
  `envoltura` no se agrega DOM; sin `PMUMockup` no lanza. Ver FR-022/FR-023.
- [X] **T025** `fit` y degradacion sin Cropper: overlay encima del canvas de salida
  (nunca dentro de `this.ctx`), redibujado en `resize` (DPR) y en `close` sin fugas.
- [X] **T026** `crop`: caja de preview en vivo (opcion `preview` de Cropper) con la
  proporcion `finalW:finalH` y el overlay encima; el overlay es **hermano** de la caja
  de preview (Cropper no lo toca).
- [X] **T027** `cargador-pmu.js::_abrir`: pasa `envoltura: this.config.envoltura` al
  `SelectorPMU`. El preview del admin usa el mismo camino.
- [X] **T028** Puerta F5 en `tests/selector-contrato.test.js` (sin `envoltura` no hay
  overlay; con `envoltura` si; el export NO la usa; reusa `comandosEnvoltura`; el
  cargador la pasa) + docs (`AGENTS.md` §5/§11).

## Fuera de alcance

- [ ] **T023** Filtros (brillo/contraste/tono): el gancho `ajustes:[]` queda
  reservado en la config (D4), sin implementar.

