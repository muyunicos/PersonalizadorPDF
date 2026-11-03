# Spec 036 — Ficha optimizada: red, pintado progresivo y auto-montaje

> Estado: **implementada** (2026-11-03) + **enmienda D12** (2026-11-03).
> Release: **4.28.0** (base) / **4.28.1** (enmienda: hueco en el aplanado).
> Construye sobre la 011 (nucleo de render compartido `assets/mockup-render.js`, editor + ficha),
> la 012/018 (montaje de campos y `CargadorPMU`), la 022 (minimos de ranuras), la 030 (cache de
> URLs y visor) y la 035 (receta v2, `objectURL` local del recorte y marca de "visto" al
> mostrarse). **El Motor no se toca** (`engine/Pdf`, `Detector`, `Overlay`, `Motor`).
> **Alcance**: (1) **red al cargar** la ficha (carga perezosa: imagenes del cliente solo al abrir el
> modal, motor minimo de TextMuy solo si hay campo de texto, mockups con su fondo/contenedores/
> placeholders), (2) pintado **progresivo** de la vista previa con `objectURL` local y **montaje
> automatico** de la galeria (sin boton), (3) **subida en segundo plano** de originales +
> creaciones de TextMuy (WebP, tamano maximo) con el boton **habilitado al vaciarse la cola**, y
> (4) **cola de subida** revisada para muchos archivos.
> **Fuera**: la marca de "visto" **no** se invalida al editar un mockup (D6); el **plano de 2 caras**
> solo entra **con medicion previa** (§7 P1).
> **Gobernanza**: la 036 **enmienda `constitution` §I** (MAJOR) — el boton "Vista previa" y el
> "sin live re-render" se redefinen por el auto-montaje y el repintado al editar (ver Clarifications).

## Clarifications

### Session 2026-11-02

- Q: La `constitution` §I (NO-NEGOCIABLE) exige un boton "Vista previa" que el comprador pulsa y prohibe el live re-render; ¿como se resuelve el auto-montaje de la 036 frente a ese texto? → A: **Se elimina el boton**: la galeria se monta sola al completar los campos y se **repinta** al editar; se **enmienda** `constitution` §I (Sync Impact Report + bump MAJOR) antes de implementar y **no** queda un boton "Volver a generar".

- Q: ¿Se guarda lo que el comprador vio y se invalida si el admin edita el mockup? → A: **No**: una vista obligatoria que ya vio **queda vista** (por `mockup_id`), aunque cambie opciones o el mockup cambie; **no hay firma** ni dato nuevo (D6 redefinida). Se agrega, en cambio, la optimizacion de **red al cargar**, la **subida en segundo plano con el boton habilitado al vaciarse la cola** y la **revision de la cola** para muchos archivos.

- Q: ¿Que significa "cargar imagen de fondo, contenedores e info de placeholders" al abrir la ficha con mockups? → A: El mockup del **cliente** se sirve **aplanado**: se carga **un solo bitmap** por mockup (todas las capas visibles `tipo: img`, ya con sus filtros/efectos/deformaciones) y **encima** se superponen los **placeholders** con sus **envolturas**. El mockup del **admin** sigue siendo el rejunte editable de capas. Ambos **se ven iguales**; cambia como se sirven (D10).

- Q: ¿Donde se guarda el bitmap aplanado de cada mockup? → A: Junto al PDF, en `pdfs/{nombre}/mockups/{mockup_id}.webp` (el ambito `mockups` de ese PDF, que ya existe para las fotos del admin) (D10).
### Session 2026-11-03 (enmienda D12 — hueco en el aplanado)

- Q: El aplanado de D10 deja los PH **encima** y solo compone capas `img`; si un PH no tiene foto se
  ve el fondo, y un elemento que pisa dentro del hueco queda tapado por la foto. ¿Como se sirve el
  hueco? → A: **Diseno A**: **un solo WebP** con **fondo BLANCO opaco** + **todas** las capas `img`
  visibles (marco incluido) y la **silueta de cada PH borrada (alfa 0)**. En la ficha los PH se
  dibujan **DEBAJO** y el aplanado **ENCIMA**: la foto del comprador se ve **por el hueco**. Sin
  bandas ni mascara aparte. Limitaciones **aceptadas**: (a) nada puede pisar dentro del hueco; (b) un
  PH con `modo: multiply` pierde el multiplicado; (c) posible halo de 1 px en el borde con envolturas
  organicas; (d) un PH con **perspectiva** no se puede perforar (el editor avisa y el aplanado lo
  tapa).

## 1. El problema (verificado en el codigo)

1. **El pintado de la vista es bloqueante.** `generarPdf()` (`assets/tienda.js:1448`) sube los PNG
   de texto al pool y **espera a TODAS** las subidas y a TODAS las fotos
   (`Promise.all(subidas).then(... trabajoFotos)`, `:1567-1589`) antes de llamar a
   `componerMockup()` (`:907`) y de `append`ear el canvas (`:1593`). Hasta entonces la vista
   muestra el placeholder "Generando vista previa": el comprador mira un hueco aunque la mayor
   parte del bitmap ya este disponible en la pestana.
2. **La vista previa hay que pedirla.** El unico disparo es el boton **"Vista previa"**
   (`assets/tienda.js:1865-1883`): el comprador completa los campos y, para ver el resultado, debe
   pulsarlo. `CargadorPMU` ya notifica cuando una ranura queda lista
   (`assets/cargador-pmu.js:204/523` -> `api.estado[cid].listo` y `minimos[cid]` en
   `assets/tienda.js:1824-1840`): es senal suficiente para montar la galeria sola.
3. **Al abrir la ficha se pide de mas.** Hoy el mockup del cliente se arma bajando **capa por capa**
   (imagenes de distintas resoluciones, filtros, deformaciones) y el plan de red no distingue lo que
   se va a usar de lo opcional: el comprador que no va a subir imagenes ni a usar un campo de texto
   igual paga por recursos que no usara. El objetivo es que **solo** se descargue: imagenes del
   cliente **si** abre el modal de carga, el motor minimo de TextMuy **si** hay un campo de texto, y
   (si hay mockups) **un solo bitmap aplanado** por mockup + la info de sus placeholders.
4. **El boton de comprar no espera a la cola de subida.** Con la subida en segundo plano (035), el
   comprador puede pulsar "Agregar al carrito" mientras todavia se estan subiendo originales o
   creaciones de TextMuy. Se pide: **habilitar el boton solo cuando la cola quedo vacia** y que la
   **ultima version de un texto reemplace** la subida anterior.
5. **La cola no esta pensada para muchos archivos.** Con **multiples opciones** y varias cargas de
   imagenes, la cola de subida hay que revisarla (concurrencia, orden, dedupe, reintentos).
6. **El plano de 2 caras no tiene medida.** La idea de un mockup con **dos caras** (frente/reverso)
   se apoya en la homografia del nucleo (`assets/mockup-render.js:333,461`) pero **no** hay medicion
   de costo/beneficio: entra solo si la medicion previa lo justifica (§7 P1).
7. **El "visto" del mockup NO se invalida** (decision del negocio, 2026-11-02): una vista obligatoria
   que el comprador ya vio **queda vista**, aunque despues cambie opciones o el admin edite el
   mockup. Se conserva la marca de la 035 (por `mockup_id`), **sin** firma ni dato nuevo.

## 2. Decisiones

| # | Decision |
|---|----------|
| **D1** | **Pintado progresivo en dos pasadas (local -> refinada)**: cada vista se pinta primero con los recursos que **ya estan en la pestana** (recortes `objectURL` de `PMU_FICHA.recortes`/`recorteLocal()` y URLs de `PMU_FICHA.urls`) y se **repinta** la MISMA vista con el recurso definitivo cuando resuelven el pool y las subidas. El placeholder "Generando vista previa" queda solo para una vista **sin ningun** recurso local. |
| **D2** | **0 red en el caso normal**: si los recursos de la vista ya estan (recortes locales + PNG de texto en cache), el pintado **no hace un solo POST** de pool. El pool sigue siendo la fuente de lo que el navegador no tiene (recarga, re-edicion). |
| **D3** | **Auto-montaje de la galeria, SIN boton**: la galeria se arma **sola** cuando la ficha queda "completa" (D4) y **permanece visible**: al editar un campo se **repinta** en el lugar (no se oculta ni vuelve un boton). El boton "Vista previa" **desaparece**: `constitution` §I se **enmienda** (MAJOR) porque el flujo vigente exige ese boton y prohibe el live re-render. |
| **D4** | **"Completa" = readiness ya existente**: todos los `min` de las ranuras satisfechos (`assets/tienda.js:1837-1839`) y **sin subidas en vuelo** (`api.subidas.pendientes()`, 035 T013). Un campo opcional vacio **no** impide montar; un error de validez (005) si. |
| **D5** | **La venta nunca se bloquea** (constitucional §I / T021): si el auto-montaje falla, se habilita el carrito con el aviso actual ("podes comprar igual..."). El auto-montaje **no** reemplaza `bloqueos.vistas` (035 D11): el boton se habilita cuando no queda ninguna obligatoria sin ver. |
| **D6** | **El visto NO se invalida**: una vista obligatoria que el comprador ya vio **queda vista** aunque despues cambie opciones o el admin edite el mockup. La marca sigue como en la 035 (por `mockup_id`: `localStorage` + `manifest.vistos`): **sin firma, sin dato nuevo**. (Reemplaza la version anterior de D6, 2026-11-02.) |
| **D7** | **Red al cargar la ficha (carga perezosa)**: al abrir el producto solo se descarga lo que se va a usar: (a) las **imagenes del cliente** se cargan **solo** si el comprador abre el modal de carga (si no, 0 descargas); (b) el **motor minimo de texto (TextMuy)** se carga **solo** si hay un campo de tipo `texto`; (c) si el PDF tiene mockups, se carga **un solo bitmap aplanado** por mockup + la **info de los placeholders** (transform + **envoltura**) que se superponen encima (D10). |
| **D8** | **Subida en segundo plano + gate de la cola**: se suben **solo** los originales de imagen que el comprador cargo y sus **creaciones de TextMuy**, todo redimensionado al **tamano maximo predefinido** y en **WebP**. Todo viaja **mientras** se completa el formulario; el boton **"Agregar al carrito" se habilita recien cuando la cola queda vacia**. Si el comprador **cambia un texto** de TextMuy, **la ultima version reemplaza** la subida (una sola version por creacion). |
| **D9** | **Cola de subida revisada**: la cola debe sostener **muchos archivos** (multiples opciones + varias cargas de imagenes): concurrencia acotada, orden FIFO, dedupe por contenido y reintentos (§3.6). |
| **D10** | **Mockup aplanado para el cliente** (misma vista, servido distinto): el **editor del admin** aplana las capas **visibles** (`tipo: img`, con sus filtros/efectos/deformaciones) a **un solo bitmap WebP por mockup**; ese bitmap vive en `pdfs/{nombre}/mockups/{mockup_id}.webp` y se **regenera cuando cambian las capas**. El **cliente** carga ese bitmap + la info de los placeholders (transform + **envoltura**) y superpone el PNG del comprador mediante el nucleo; el mockup del **admin** sigue siendo el rejunte editable de capas. Los dos **se ven iguales**. **Enmendada por D12 (2026-11-03)**: el aplanado pasa a fondo BLANCO opaco con la silueta de cada PH perforada y la ficha dibuja los PH debajo. |
| **D11** | **Plano de 2 caras: gateado**: **no** entra en esta entrega salvo que la medicion previa (§7 P1) lo justifique; si entra, se apoya en la homografia del nucleo y **no** toca al Motor ni el bitmap del pool. |
| **D12** | **Hueco en el aplanado (enmienda 2026-11-03, Diseno A)**: el aplanado de D10 pasa a ser **un solo WebP** con **fondo BLANCO opaco** + **todas** las capas `img` visibles (marco incluido) y la **silueta de cada PH borrada (alfa 0)** (`PMUMockup.siluetas`, `destination-out`, mismo stack de transformacion/envoltura). La ficha compone **PH primero (abajo) y aplanado encima**: la foto del comprador se ve **por el hueco**. Sin bandas, sin mascara aparte, **1 descarga por mockup**. Limitaciones aceptadas: (a) nada puede pisar dentro del hueco; (b) un PH con `modo: multiply` pierde el multiplicado; (c) posible halo de 1 px en el borde con envolturas organicas; (d) un PH con **perspectiva** no se perfora: el editor **avisa** y el aplanado lo tapa. |

## 3. Contrato

### 3.1 Pintado (cliente)

- Una vista se pinta **en dos pasadas** como maximo; la segunda **reemplaza** el canvas (no se
  apilan). El z-order, los filtros, la envoltura y la perspectiva los sigue resolviendo
  `PMUMockup.componer` (nucleo compartido, 011 R1/R13): **no** se agrega un segundo motor de render.
- Un recurso local se resuelve por `recorteLocal(id)` (035 T014) y por `PMU_FICHA.urls` (030 D23);
  al pool se consulta **solo** lo faltante.

### 3.2 Auto-montaje

- El auto-montaje usa el **mismo** camino que usaba el boton (`generarVista()`); no agrega endpoints.
- **No hay boton**: la galeria se arma al quedar "completa" (D4) y, con la galeria ya visible, una edicion de campos la **repinta** en el lugar; no se oculta ni aparece un boton.

### 3.3 Visto (sin firma)

- La marca de "visto" sigue como en la 035 (D11/§3.5): por `mockup_id`, en
  `localStorage['pmu_vistas_v1'][item_key]` y, al congelar, en `manifest.vistos`. **Una vez visto,
  visto**: no se invalida al editar el mockup ni al cambiar opciones.
- **No hay firma del mockup** ni comparacion por contenido (D6). Queda **fuera de alcance** el
  pendiente de la 035 §6 ("invalidar la marca de visto al editar un mockup").

### 3.4 Red al cargar la ficha (D7) y mockup aplanado (D10)

- **Imagenes del cliente**: 0 descargas al abrir; se piden **solo** al abrir el modal de carga.
- **Motor minimo de TextMuy**: se encola **solo** si la ficha tiene un campo de tipo `texto`.
- **Mockups del cliente**: se carga **una sola imagen aplanada** por mockup: fondo **BLANCO opaco**
  + **todas** las capas `tipo: img` visibles (marco incluido, con sus filtros/efectos/deformaciones) y
  la **silueta de cada PH borrada (alfa 0)** = el **hueco**. La ficha compone **PH primero (abajo) y
  el aplanado encima**: la foto del comprador se ve **por el hueco** y el fondo no la tapa. **No** se
  descargan las capas sueltas ni el marco editable.
- **Aplanado**: lo produce el **editor del admin** al guardar el mockup (Canvas -> WebP), vive en
  `pdfs/{nombre}/mockups/{mockup_id}.webp` y se **regenera** cuando cambian las capas; el render del
  cliente reusa `PMUMockup.componer` (PH + 1 capa `img` al final) y `PMUMockup.siluetas` perfora el
  hueco en el productor. **1 archivo, sin bandas ni mascara aparte**.

### 3.5 Subida en segundo plano y habilitacion (D8)

- Se sube **solo** lo producido: originales de imagen + creaciones de TextMuy (WebP, tamano maximo
  predefinido).
- **Gate**: mientras la cola tenga pendientes el boton de compra queda bloqueado
  (`bloqueos.subidas`, junto a los gates 005/022 vigentes); se habilita al vaciarse.
- **Ultima version manda**: re-subir un texto reemplaza la subida anterior del mismo grupo/instancia.

### 3.6 Cola de subida (D9)

- Concurrencia **acotada** (no N simultaneas), orden **FIFO**, **dedupe** por contenido (sha) y
  **reintentos** con backoff; las subidas de una misma creacion se **serializan** para que la ultima
  gane.

## 4. Puertas

- `node tests/mockup-contrato.test.js` (nucleo compartido editor+ficha: cualquier cambio en
  `assets/mockup-render.js` lo obliga).
- `node tests/mockup-geometria.test.js` (geometria pura del editor).
- `node tests/vistas-contrato.test.js` (orden y marca de las vistas obligatorias, 035: 24/24).
- `node tests/ficha-pedido.browser.js` (lab, 47/47): auto-montaje, pintado progresivo, gate de la
  cola y "ultima version manda".
- `php tests/texto_puente.php <fase>` (fases **nuevas** para red al cargar y gate de la cola, mas
  las existentes).
- Puerta **nueva** (Node): la cola de subida con **N archivos** (concurrencia/orden/dedupe/ultima
  version reemplaza).
- Puerta **nueva** (navegador, lab): **0 red** al cargar la ficha sin interaccion (sin abrir el
  modal y sin campo `texto` no se descargan imagenes ni el motor de texto).
- Puerta **nueva**: el mockup del cliente se sirve **aplanado** (1 bitmap + placeholders) y el
  aplanado se **regenera** al cambiar las capas del mockup.
- `node tests/aplanado.browser.js` (lab): productor real + **hueco** (centro del PH con alfa 0 y
  fondo opaco fuera) + regeneracion del bitmap al cambiar capas.
- `php tests/motor_smoke.php` + `php tests/parity.php` en verde: **el Motor no cambia**.
- `php -l` del area y `node --check` de los JS tocados.

## 5. Fuera de alcance

- **Invalidar la marca de visto al editar un mockup**: **fuera** (decision 2026-11-02): una vez
  visto, queda visto; se **elimina** la idea de la "firma" del mockup. Cierra el pendiente de la 035 §6.
- **Motor PHP** (`engine/Pdf`, `Detector`, `Overlay`, `Motor`): no se toca.
- **Plano de 2 caras**: solo con medicion previa (§7 P1); si no se mide, se difiere otra vez.
- **Cuota/peso** del comprador: es de la 030/035, no de esta.
- **Donde se monta la galeria**: sigue en el panel de la ficha de Woo (no se muda de lugar).

## 6. Relacion con otras specs

- **005** (validez): el auto-montaje respeta `bloqueos.validez`.
- **011** (nucleo de render): se **reusa** `PMUMockup` (el auto-montaje y el repintado pasan por el).
- **022** (minimos): la readiness del auto-montaje se apoya en `minimos`/`faltanFoto`.
- **030** (cache de URLs y visor): el "0 red" reusa `PMU_FICHA.urls`.
- **035** (visto y `recorteLocal`): el visto **no** se invalida (D6); su pendiente de §6 queda declarado fuera de alcance en §5.

## 7. Pendientes (a cerrar en `/speckit-clarify`)

| # | Pendiente | Propuesta |
|---|-----------|-----------|
| **P1** | Plano de 2 caras | **Medir primero** (bench de render en el lab); entra solo si el costo es bajo; si no, se difiere |
| **P2** | Firma del mockup: donde vive | **CERRADA (2026-11-02)**: **no hay firma**; el visto no se invalida (D6) |
| **P3** | Alcance del auto-montaje (que PDFs cuentan) | Montar cuando hay mockups y los campos obligatorios estan listos; `preview_omisible` conserva su exencion |
| **P4** | Destino del boton "Vista previa" | **CERRADA (2026-11-02)**: se **elimina**; la galeria se monta sola y se repinta al editar (enmienda de `constitution` §I) |
| **P5** | Migrar una marca de visto sin firma | **CERRADA (2026-11-02)**: no hay firma; la marca de la 035 se conserva tal cual |
| **P6** | Que son "contenedores" e "imagen de fondo" del mockup | **CERRADA (2026-11-02)**: "contenedores" = **envolturas** de los placeholders; "imagen de fondo" = **un bitmap aplanado** por mockup (D10) |
| **P7** | Tamano maximo de las creaciones de TextMuy | **Supuesto (corregir)**: mismo criterio que las fotos (el cap predefinido vigente, hoy 2000 px) |
| **P8** | Relacion entre el gate de "visto" (035 D11) y el gate de la cola | **Supuesto (corregir)**: el gate de visto se satisface solo (la galeria se muestra sin boton); el gate efectivo pasa a ser "cola vacia" |
| **P9** | Donde vive el bitmap aplanado del mockup (D10) | **CERRADA (2026-11-02)**: en `pdfs/{nombre}/mockups/{mockup_id}.webp` (el ambito `mockups` del PDF) |
| **P10** | PH con perspectiva en el aplanado | **CERRADA (2026-11-03)**: se **salta** con aviso en el editor; el aplanado no puede perforar una silueta deformada. Limitacion documentada de D12. |