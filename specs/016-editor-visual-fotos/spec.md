# 016 — Editor visual de fotos del comprador

> Estado: **implementada (2026-10-10)** — F0-F4 y docs de F5 terminadas, con
> puerta `tests/selector-contrato.test.js` en verde (`SELECTOR CONTRATO OK
> (F0-F4)`). Queda **T022** (recorrido manual en WP real, movil + escritorio;
> seccion 6c del `MANUAL-PENDIENTE-WP-REAL.md`) y **T023** (filtros, fuera de
> alcance con el gancho `ajustes:[]` reservado). Version del plugin 4.6.0.
>
> Continuacion natural de la 012 (US6/US7): alli nacio el cargador de imagenes;
> esta spec **termina la experiencia** del comprador al cargar y ajustar sus
> fotos. Idea acordada con el usuario: un **modal visual comodo** donde se
> previsualiza el tamaño, el recorte y otras opciones futuras **en tiempo
> real**, manipulable con los dedos (movil) o el mouse, de manera intuitiva.
> El nombre: **"editor visual"**, no "galeria" (una galeria es un repositorio
> de imagenes; esto es un editor de la foto antes de usarla).

## Por que esta spec

La 012 dejo el flujo funcional pero espartano: el modal de ajuste es un canvas
con un slider de zoom y un select, y la tira del cargador muestra **chips
numerados** en vez de ver la foto. El comprador sube la foto "a ciegas" del
resultado real. Esta spec reemplaza ese interior por un editor visual
full-featured sin tocar el contrato que ya consumen el cargador y la ficha.

## Hallazgos (verificados en el codigo)

Cada uno con archivo y linea, para poder re-chequearlo.

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | El modal actual es esqueleto: slider de zoom 1-4x, select crop/fit y arrastre de 1 dedo. Sin pinch, sin rotacion, sin guias, sin drop zone ni camara | `assets/selector-pmu.js:83-101, 124-138, 157-164` |
| H2 | La tira del cargador pinta **botones numerados**, no miniaturas de la foto | `assets/cargador-pmu.js:332-340` (`mini.textContent = String(k + 1)`) |
| H3 | El cargador **no restaura estado** al re-editar desde el carrito (`?pmu_item_key=`): arranca siempre con ranuras vacias aunque `manifest.subidas[]` tenga filas | `assets/tienda.js:391-421` (`montarCargadores` no recibe ids iniciales) |
| H4 | `selector-pmu` ya usa Pointer Events (base tactil correcta), pero solo para mover; el zoom y la rotacion no existen | `assets/selector-pmu.js:125-138` |
| H5 | El **servidor ya esta completo**: subida al item, id del servidor, resolucion id->URL, invitados por cookie | `personalizador-pdf.php:1421, 1491`; `inc/class-pmu-sesion.php:321, 361` |
| H6 | Cropper.js **no tiene modo contain**: recorta, no rellena con margenes transparentes. El modo `fit` de hoy no puede salir de Cropper | contrato Cropper: `getCroppedCanvas` entrega el area recortada |

**Consecuencia de H5**: esta spec es **100% cliente**. No toca el motor, ni los
datos, ni `modules/textmuy/`, ni agrega endpoints.

## Decisiones cerradas

| # | Decision |
|---|---|
| D1 | **Evolucionar `SelectorPMU` en el mismo archivo**, sin componente nuevo. Su contrato publico (constructor + `onSelect(url, meta)` + `obtenerBlob()` + `open/close/destroy`) NO cambia: `CargadorPMU`, `tienda.js` y el preview del admin no se enteran. |
| D2 | **Cropper.js v1.6.2 vendoreado** (D7) es el motor del modo `crop`. Un solo modelo de entrada (Pointer Events; los gestos multi-tacto los resuelve Cropper internamente). |
| D3 | **El preview en tiempo real ES la salida**: lo que se ve es lo que va a dar `getCroppedCanvas(finalW, finalH)`, mas overlays de ayuda (guia de tercios, zona fuera atenuada, badge de zoom y tamaño). Sin segundo render que sincronizar. |
| D4 | **Opciones a futuro**: el config del componente reserva un pipeline declarativo `ajustes:[]` (hoy: recorte/zoom/rotacion). Los **filtros** (brillo/contraste/tono) quedan **fuera de alcance** con el gancho reservado. |
| D5 | **Cero cambios de servidor**: se reusan `personalizador_pdf_subida` y `personalizador_pdf_subida_url` tal cual (H5). |
| D6 | Las formas de ranura (`circle`/`square`) siguen siendo **presentacion** de la mini en la tira; el recorte entregado sigue siendo rectangular (transparencia), sin cambios. |
| D7 | **Vendorizar Cropper.js 1.6.2** en `assets/vendor/cropper/` (min.js + min.css + LICENSE + ORIGEN.md con hash SHA256). **Nunca CDN**; **nunca editar el minificado a mano**. |
| D8 | **v1 y no v2**: la linea v1 es la estable con build **UMD** (script plano, sin npm ni build); v2 exige ESM. Incompatibilidad descartada con el despliegue por git del repo. |
| D9 | **Hibrido crop/fit** (H6): Cropper cubre `crop`; el modo `fit` (encajar completo con margenes transparentes) **conserva el path de canvas actual** de `selector-pmu.js`. |
| D10 | **Encolado** con handle `personalizador-pdf-cropper` (script + estilo), declarado como dependencia de `personalizador-pdf-selector`, con `PERSONALIZADOR_PDF_VERSION` (fuente unica de version, regla 10.bis). |

## Modelo

La cadena completa (sin cambios de la 012 en su tramo de datos):

```
comprador -> modal (este spec) -> blob PNG exacto (finalW x finalH)
  -> personalizador_pdf_subida -> subidas/{id}.{ext} + manifest.subidas[]
  -> Vista previa (tienda.js rasteriza al hueco) -> pool -> Motor -> PDF
```

El componente `SelectorPMU` queda asi (lo nuevo en **negrita**):

| Config | Tipo | Hoy | 016 |
|---|---|---|---|
| `finalW`/`finalH` | int | obligatorio | obligatorio (sin cambios) |
| `aspectRatio` | float | opcional | opcional (pasa a Cropper) |
| `mode` | `crop`/`fit` | select en el modal | **`crop` usa Cropper; `fit` conserva el canvas actual** (D9) |
| `category` | string | sin uso real | se mantiene por compatibilidad |
| **`ajustes`** | array | — | **reservado para el pipeline futuro (D4); hoy vacio** |

Publico del modal nuevo (F1/F2):

- **Shell**: full-screen en movil (<768px, safe-area, scroll-lock, botones >=44px),
  dialogo amplio en escritorio, drop zone (soltar el archivo sobre el modal),
  boton de camara en movil (`input[type=file]` con `capture`), focus trap,
  Escape, estados de carga y error con reintento.
- **Ajuste gestual**: pan (1 dedo/mouse), pinch-zoom 1x-8x, doble tap = alternar
  encajar/100%, rotar 90° (boton) y gesto de rotacion de 2 dedos; todo en vivo.
- **Marco visual**: guia de tercios, zona fuera atenuada, badge en vivo
  "Salida WxH px · zoom xN · Origen WxH"; en `fit`, los margenes transparentes
  se ven sobre tablero de ajedrez.
- **Tira del cargador (US4)**: miniaturas reales, quitar con confirmacion visual,
  "cambiar" (reabre el editor sobre ESA ranura, reemplazando sin sumar),
  restauracion del estado al re-editar desde el carrito (ids del manifest
  resueltos con `personalizador_pdf_subida_url`).

## Requisitos funcionales

**US1 — Modal comodo (shell)**

- **FR-001** En movil (<768px) el modal DEBE ser full-screen con safe-area
  respetada, scroll de fondo bloqueado y controles de al menos 44px.
- **FR-002** En escritorio DEBE ser un dialogo centrado amplio (>=640px) con el
  editor siempre visible sin scroll interno del area de ajuste.
- **FR-003** DEBE aceptar el archivo por clic (boton), por soltarlo sobre el
  modal (drop zone) y por camara en movil (`capture`).
- **FR-004** DEBE mostrar estado de carga (spinner) y de error con boton de
  reintento; nunca un modal en blanco.
- **FR-005** DEBE tener focus trap, cierre por Escape y `aria-modal` (el modal
  actual ya lo declara; se conserva y completa).
- **FR-006** Si `window.Cropper` no esta cargado, el modal DEBE degradar al
  comportamiento actual (canvas + slider) y avisar por `onError`, nunca un
  error de JS que rompa la ficha.

**US2 — Ajuste gestual en tiempo real**

- **FR-007** Mover la imagen con 1 dedo o mouse (pan).
- **FR-008** Zoom por pinch (2 dedos) y por rueda, acotado 1x-8x.
- **FR-009** Doble tap DEBE alternar encajar-completo/100%.
- **FR-010** Rotar 90° por boton y por gesto de 2 dedos; la rotacion DEBE
  respetarse en la salida (getCroppedCanvas la aplica).
- **FR-011** Toda interaccion DEBE reflejarse en el lienzo sin recarga ni
  latencia perceptible (eventos `crop`/`zoom` de Cropper).

**US3 — Marco visual**

- **FR-012** En modo `crop` DEBE verse la guia de tercios y la zona fuera del
  marco atenuada.
- **FR-013** Un badge en vivo DEBE mostrar el tamaño de salida y el zoom
  ("Salida 1000x500 px · zoom x2,4"), y al cargar, el tamaño del origen.
- **FR-014** En modo `fit` DEBEN verse los margenes transparentes sobre tablero
  de ajedrez (path de canvas actual, D9).

**US4 — Tira visual del cargador**

- **FR-015** Cada imagen cargada DEBE verse como miniatura real (la foto, no un
  numero), con la forma de la ranura como mascara (D6).
- **FR-016** Tocar una miniatura DEBE ofrecer quitar (con confirmacion visual)
  y **cambiar** (reabrir el editor sobre esa ranura, reemplazando sin sumar).
- **FR-017** Al re-editar desde el carrito, las ranuras DEBEN restaurar sus
  fotos resolviendo los ids del manifest contra `personalizador_pdf_subida_url`.
- **FR-018** Las reglas `min`/`max` y el boton "Listo" DEBEN seguir exactamente
  igual (D16 de la 012).

**US5 — Contrato y compatibilidad**

- **FR-019** `CargadorPMU`, `tienda.js` y el preview del admin DEBEN seguir
  funcionando sin cambios (D1).
- **FR-020** La puerta Node DEBE congelar el contrato publico de
  `selector-pmu` y el encolado del vendor (F0 ya lo hace).
- **FR-021** El contrato 004 `selector-pmu.md` DEBE quedar enmendado
  (aditivamente) apuntando a esta spec.

## Fuera de alcance

- **Filtros** (brillo/contraste/tono/saturacion): queda reservado el gancho
  `ajustes:[]` (D4), no se implementa.
- **Servidor**: nada (D5). Ni endpoints, ni datos, ni Motor.
- **`modules/textmuy/`**: no se toca (sin bump `?v=RCn`, sin commit en su repo).
- **La galeria del admin** (spec 009, ambito `img/` con sprite): es otro
  problema, intocable.
- **Recortes no rectangulares**: la salida sigue siendo rectangular (D6).
- **Reordenar fotos arrastrando** en la tira: fuera (el orden lo da el orden de
  subida).
- **Multi-seleccion** de archivos en una sola apertura: fuera.

## Criterios de aceptacion

- El comprador ve en el modal EXACTAMENTE lo que se va a usar (mismo tamaño y
  recorte), en movil y en escritorio, sin saber nada tecnico.
- Un recorte hecho con los dedos da el mismo PNG que el mismo ajuste con mouse.
- La tira muestra las fotos reales y permite cambiarlas sin perder las otras.
- Volver desde el carrito muestra las fotos ya cargadas.
- Sin `Cropper` cargado (o en navegador viejo), el flujo no se rompe (FR-006).
- Ningun cambio de servidor, de formato de datos ni en `modules/textmuy/`.
- Puertas en verde: `node tests/selector-contrato.test.js`,
  `node tests/campos-contrato.test.js`, `php -l`, `php tests/texto_puente.php`.

