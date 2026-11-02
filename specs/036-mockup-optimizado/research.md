# Research: Ficha optimizada (036)

> Fase 0 del plan. Resuelve las incognitas del Technical Context y fija el "como" de las decisiones
> D7-D11 de la spec. Fuente: codigo verificado el 2026-11-02.

## R1 — De donde sale hoy cada descarga al abrir la ficha

**Decision**: inventariar el encolado en `assets_ficha_condicional()` (`personalizador-pdf.php:814`) y
volver condicional lo que hoy es incondicional.

**Hallazgo**: en la ficha se encolan siempre `mockup-render.js`, `selector-pmu.js`, `campo-montar.js`,
`biblioteca-pmu.js`, `visor-pmu.js`, `cargador-pmu.js` y `tienda.js`; el motor de texto
(`renderCoreUrl` -> `modules/textmuy/render-core.html`) se carga **on-demand** en `renderCore()`
(`assets/tienda.js:778`, iframe off-screen).

**Rationale**: el motor de texto ya es lazy. Falta (a) no cargar `biblioteca-pmu.js`/`visor-pmu.js`
(las **imagenes del cliente**) hasta que se abra el modal, y (b) no instanciar el render-core si el
PDF no tiene ningun campo de tipo `texto`.

**Alternativas**: dejarlo como esta (descartado: contradice D7).

## R2 — Como se sirve hoy el mockup al cliente

**Decision**: hoy el cliente compone con **todas** las capas (`componerMockup` -> `PMUMockup.componer`,
`assets/tienda.js:907`), resolviendo cada capa `img` contra el catalogo. Con D10 pasa a
**1 capa aplanada + los placeholders**.

**Hallazgo**: `componerMockup` arma `pngsPorGrupo` y llama al nucleo con `mockup.capas`. El nucleo ya
soporta una lista con `img` + `placeholder`, asi que **no** hace falta un motor nuevo: se le pasa
**una** capa `img` (el aplanado) + los `placeholder` del mockup.

**Rationale**: reutiliza el nucleo (011 R1/R13) y mantiene el encuadre ("la vista previa es el PDF").

**Alternativas**: reimplementar el render del cliente (descartado: duplicaria el nucleo).

## R3 — Donde se aplana y cuando

**Decision**: el **editor del admin** (`assets/mockups.js`) aplana al guardar (ya tiene el canvas de
composicion) y sube el WebP; el servidor lo guarda en `pdfs/{nombre}/mockups/{mockup_id}.webp`.

**Hallazgo**: `mockups.js` ya renderiza la composicion y autoguarda (`sinGuardar()` + autoguardado con
retardo) via `cfg.motorUrl` (`assets/mockups.js:98`); el guardado de capas entra por el handler de
mockups (`personalizador-pdf.php:5393-5430`, `guardar_config(['mockups' => ...])`) con el nonce
`personalizador_pdf_mockups`. El ambito `pdfs/{nombre}/mockups/` ya existe (`mockup_fotos_lista`,
`personalizador-pdf.php:375`).

**Rationale**: el navegador es el unico que puede aplicar los filtros CSS y la perspectiva (GD no
tiene homografia ni filtros equivalentes).

**Alternativas**: aplanar en el servidor con GD (descartado: no puede reproducir filtros CSS ni la
homografia de grupo).

## R4 — Como se invalida/regenera el aplanado

**Decision**: el aplanado se **regenera** en cada guardado de capas del mockup (el editor ya
autoguarda); si el archivo falta, la ficha lo informa con causa y la consola lo regenera al abrir el
editor.

**Rationale**: no hace falta firma ni migracion (D6); el "dirty" lo da el propio guardado.

**Alternativas**: un flag de invalidacion persistido en `config.json` (descartado: estado extra
innecesario; el aplanado es un archivo derivado, como `envolturas.json`).

## R5 — La cola de subida hoy

**Decision**: la cola vive en `assets/fotos-pmu.js` (`PMUFotos.crearCola`, consumida por
`colaDeSubidas()` en `assets/tienda.js:662`) y expone `subir/encolar/vaciar/pendientes`.

**Hallazgo**: la ficha publica `PMU_FICHA.subidas = {vaciar, pendientes}` (`assets/tienda.js:1702`),
ya usado por el add-to-cart de la 035.

**Rationale**: el gate "todo subido" (D8) se apoya en la API **existente** (`pendientes()`), sin cola
nueva.

**Alternativas**: una cola nueva desde cero (descartado: duplicaria).

## R6 — Que se sube y en que formato

**Decision**: originales de imagen (endpoint `_subida`, ya WebP acotado a 2000 px por 026/035) y
**creaciones de TextMuy** (hoy PNG del pool por `handle_pool_png`, `img/txt-...`). Con D8 el texto pasa
a **WebP** y al **tamano maximo predefinido** (P7: mismo criterio que las fotos).

**Hallazgo**: el pool ya prefija `txt-`/`foto-` (035 §5.b) y `siguiente_n()`/`limpiar_grupo()` filtran
por prefijo.

**Rationale**: un solo formato (WebP) y un solo cap reducen peso y variantes.

**Alternativas**: mantener PNG para el texto (descartado: mas peso con el mismo resultado visual).

## R7 — "Ultima version manda"

**Decision**: re-subir un texto del mismo grupo/instancia **reemplaza** la subida anterior (mismo
`indice`), **serializando** las subidas de esa creacion en la cola.

**Rationale**: evita la carrera que dejaba el pool con dos versiones del mismo grupo/instancia.

**Alternativas**: versionar (`{n}`) en el pool (descartado: no se necesita historial de textos).

## R8 — Auto-montaje: cuando y como

**Decision**: montar la galeria cuando el `min` de las ranuras este satisfecho y no haya validez rota;
con la galeria abierta, **repintar** al editar. Se usa el MISMO `generarVista()`
(`assets/tienda.js:1607`), sin boton.

**Hallazgo**: `bloqueos = {vistas, validez, minimos}` (`assets/tienda.js:615`); se agrega `subidas`
para el gate de D8.

**Rationale**: no agrega endpoints ni un flujo paralelo.

**Alternativas**: mantener el boton (descartado por decision del negocio, Clarification Q1).

## R9 — Un solo predicado de "listo"

**Decision**: "completo" = `minimos` satisfechos (`tienda.js:1837`) **y** `pendientes() == 0` **y**
validez OK. Es el unico predicado que usan el auto-montaje (D3/D4) y el gate del boton (D8).

**Rationale**: D3/D4/D8 convergen en un unico predicado, testeable en aislamiento.

## R10 — Que NO cambia

**Decision**: `PMUMockup.componer` no se reescribe (solo cambia su lista de capas); el Motor
(`Pdf`/`Detector`/`Overlay`/`Motor`) no se toca; el arbol de `uploads/pmu` no cambia; los endpoints
vigentes se reusan.

**Rationale**: minimiza el riesgo y el alcance; mantiene al dia las puertas existentes.

## Pendientes que quedan para `tasks.md`

- **P1** (plano de 2 caras) **no** entra en las fases: queda gateado a una medicion previa.
- **P7/P8** son **supuestos** de la spec a confirmar durante la implementacion (cap de tamano de los
  textos; convivencia del gate de "visto" con el de la cola).
- **Metricas NFR** (peso del aplanado, N de archivos de la cola) se fijan al implementar cada fase.