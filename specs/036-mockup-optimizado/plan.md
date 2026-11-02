# Plan de implementacion: Ficha optimizada (red, pintado progresivo y auto-montaje)

**Rama**: (sin rama: el repo despliega desde `main`)
**Spec**: [spec.md](./spec.md)
**Estado**: plan (borrador), sin implementar
**Creada**: 2026-11-02

---

## Summary

Bajar la red y el trabajo del navegador en la ficha del comprador: (1) cargar **solo lo que se usa**
(imagenes del cliente al abrir el modal, motor minimo de TextMuy solo con campo de texto, y por mockup
**un solo bitmap aplanado** + los placeholders con sus envolturas), (2) pintar la vista previa
**progresivamente** con `objectURL` local y **montar la galeria sola** (sin boton), (3) subir en
segundo plano lo producido (originales + creaciones de TextMuy, WebP, tamano maximo) con el boton de
compra **habilitado recien al vaciarse la cola** y **la ultima version de un texto reemplazando**, y
(4) **revisar la cola** para muchos archivos.

El mockup del **admin** sigue siendo el rejunte **editable** de capas; el del **cliente** se sirve
**aplanado**. **El Motor no se toca.**

## Technical Context

- **Lenguaje/stack**: PHP 8 (min. 7.4) en hosting compartido (Hostinger Business: sin `exec`, sin
  Node/Python en runtime) + JS ES5/jQuery sin build en `assets/`. Motor PHP puro en `engine/`.
- **Dependencias**: WordPress + WooCommerce; GD/WebP (ya requisito, 026/035); en el cliente Canvas 2D,
  `objectURL`, IndexedDB y `localStorage`, sin librerias nuevas.
- **Almacenamiento**: `uploads/pmu/` con `PMU_Uploads` como **dueno unico**. El bitmap aplanado va a
  `pdfs/{nombre}/mockups/{mockup_id}.webp` (ambito ya existente). **Sin catalogos nuevos.**
- **Endpoints**: los `admin_post` vigentes (`personalizador_pdf_vista_previa`, `_pool`, `_subida`,
  `_subida_url`, `_mockups`, `_mockup_subir`). No se agregan rutas REST; el aplanado viaja por el
  guardado de mockups (o `_mockup_subir` extendido).
- **Testing**: puertas del repo (`php -l`, `node --check`, `tests/mockup-contrato.test.js`,
  `tests/mockup-geometria.test.js`, `tests/vistas-contrato.test.js`, `tests/texto_puente.php`,
  `tests/motor_smoke.php`, `tests/parity.php`) + `tests/ficha-pedido.browser.js` (lab) + **2 puertas
  nuevas** (cola con N archivos; 0 red al cargar).
- **Target**: navegadores modernos con Canvas 2D + `objectURL` + IndexedDB; servidor PHP 8.
- **Performance**: **0** descargas al abrir la ficha sin interaccion; **1** bitmap por mockup en lugar
  de N capas; el gate de la cola elimina el "subida en vuelo" al agregar al carrito.
- **Constraints**: el render del cliente **reusa** `PMUMockup.componer`; el Motor **intacto**; el
  aplanado lo produce el navegador (§III: PHP no evalua JS).
- **Scale**: no cambia el computo del servidor; baja el peso de la ficha (menos imagenes) y del pool.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio, sesion por item, `_pmu_pdf_slugs`, snapshot `manifest.pdfs[]` | **ENMIENDA** — el flujo "boton Vista previa + leyenda; al pulsarlo...; sin live re-render" se reemplaza por el **auto-montaje** (D3) y el **repintado** al editar; el mockup sigue obligatorio y el visto bueno sigue siendo el add-to-cart |
| G2 | §II Un dueno por dato | **PASS** — `PMU_Uploads` sigue dueno de rutas/catalogos; el aplanado es un archivo del ambito `mockups` del PDF (mismo dueno) |
| G3 | §III Render en navegador + inyeccion server-side; PHP **nunca** evalua JS | **PASS** — el aplanado lo produce el navegador (Canvas) y el servidor **guarda** el WebP; el estado de la cola lo decide el cliente |
| G4 | §IV Estructura de directorios | **PASS** — no cambia el arbol (`pdfs/{nombre}/mockups/` ya existe); sin staging; sin ambito nuevo |
| G5 | §V Validacion | **PASS** — se reusan las puertas y se agregan 2 |
| G6 | Sin Node/Python/`exec` en runtime | **PASS** — aplanado cliente (Canvas) + PHP puro |

**Conclusion**: la unica violacion (G1) es **decision del negocio** (Clarification Q1, 2026-11-02) y se
enmienda la `constitution` (§I + Sync Impact Report + bump **MAJOR**) **antes** de implementar, como se
hizo en la 035.

## Project Structure

### Documentation (this feature)

```text
specs/036-mockup-optimizado/
├── spec.md              # (esta spec)
├── plan.md              # ESTE archivo
├── research.md          # Fase 0 (R1-R10)
├── data-model.md        # Fase 1
├── contracts/
│   └── ficha-red.md     # C1-C5
├── quickstart.md        # E1-E4
└── tasks.md             # (lo crea /speckit-tasks)
```

### Source Code (repository root)

```text
personalizador-pdf.php          # assets_ficha_condicional() (encolado condicional),
                                #   handler de mockups (aplanado), panel_ficha_html()
assets/
├── tienda.js                   # auto-montaje, gate de subidas, repintado, mockup aplanado
├── fotos-pmu.js                # cola de subida (concurrencia/FIFO/dedupe/ultima version)
├── mockups.js                  # aplanado al guardar (Canvas -> WebP)
├── biblioteca-pmu.js           # carga perezosa (solo al abrir el modal)
└── mockup-render.js            # NO se reescribe (cambia su lista de capas)
tests/
├── mockup-contrato.test.js     # nucleo compartido (regresion)
├── vistas-contrato.test.js     # visto/orden (regresion)
├── <nueva>.test.js             # cola de subida con N archivos
└── ficha-pedido.browser.js     # lab: 0 red, aplanado, gate, auto-montaje
```

**Structure Decision**: se mantiene el layout vigente (plugin en la raiz + `assets/` + `engine/`). No
se crean proyectos ni carpetas nuevas; **no** se toca `modules/textmuy/`.

## Fases (F0-F5)

| Fase | Que hace | Depende de |
|---|---|---|
| **F0** | Puertas base en verde + **enmienda de `constitution` §I (MAJOR)** + esqueletos de las puertas nuevas | — |
| **F1** | **Red al cargar** (D7): encolado condicional (imagenes del cliente, motor minimo de texto) | F0 |
| **F2** | **Mockup aplanado** (D10): el editor aplana al guardar; la ficha sirve 1 bitmap + placeholders | F0 |
| **F3** | **Cola de subida** (D9): concurrencia/FIFO/dedupe/reintentos + "ultima version manda" + WebP del texto | F0 |
| **F4** | **Gate del boton + auto-montaje** (D3/D4/D8): predicado unico, montaje automatico, repintado | F1+F2+F3 |
| **F5** | **Polish**: docs (`AGENTS.md` §5/§9), `INDICE.md` y version | F4 |

## Gates (definicion de terminado del plan)

- [ ] `php -l` en `personalizador-pdf.php`, `inc/`, `admin/`, `engine/`
- [ ] `node --check` de los JS tocados (`assets/tienda.js`, `assets/fotos-pmu.js`, `assets/mockups.js`)
- [ ] `php tests/texto_puente.php <fases nuevas>` en verde
- [ ] `node tests/mockup-contrato.test.js` + `node tests/mockup-geometria.test.js` +
      `node tests/vistas-contrato.test.js`
- [ ] **Puerta nueva** (Node): cola de subida con **N archivos** (concurrencia/orden/dedupe/ultima
      version reemplaza)
- [ ] **Puerta nueva** + `node tests/ficha-pedido.browser.js` (lab): **0 red** al cargar; aplanado;
      gate de la cola; auto-montaje + repintado
- [ ] `php tests/motor_smoke.php` + `php tests/parity.php` en verde (**el Motor no cambia**)
- [ ] `constitution` §I enmendada con Sync Impact Report + version **4.0.0** (MAJOR)

## Re-check post-design (Phase 1)

| Gate | Re-evaluacion | Estado |
|---|---|---|
| G1 §I | El auto-montaje y el repintado no cambian el snapshot ni el vinculo PDF<->producto; la enmienda queda documentada | **ENMIENDA (a aplicar en F0)** |
| G2 §II | El aplanado lo escribe el handler de mockups de `PMU_Uploads`; no hay segundo escritor | **PASS** |
| G3 §III | El texto y el aplanado se producen en el navegador; el servidor solo guarda bytes | **PASS** |
| G4 §IV | El aplanado usa un ambito existente (`pdfs/{nombre}/mockups/`); sin arbol nuevo | **PASS** |
| G5 §V | Sin migracion: el aplanado se genera al guardar/abrir | **PASS** |
| G6 | El aplanado no agrega dependencias nativas (Canvas del cliente + GD/WebP ya presentes) | **PASS** |

**Conclusion**: el diseno no agrega violaciones nuevas. La unica (G1) es la decision del negocio
(quitar el boton) y queda documentada en la enmienda de `constitution` §I. Se puede pasar a
`/speckit-tasks`.

## Riesgos (del research)

| # | Riesgo | Mitigacion |
|---|---|---|
| R1 | El aplanado se desincroniza del editor | Se regenera en cada guardado; la ficha degrada con **causa visible** |
| R2 | El gate de la cola traba la venta | La cola reintenta con backoff; un fallo de montaje **nunca** bloquea (D5) |
| R3 | Carreras al re-subir un texto | Serializacion por creacion (`pdf`-`gid`-`indice`): ultima version manda |
| R4 | Costo del aplanado en el admin | Se genera con el canvas **ya existente** del editor (sin render nuevo) |
| R5 | Cambios en `mockup-render.js` rompen al editor | Puerta `mockup-contrato` obligatoria |