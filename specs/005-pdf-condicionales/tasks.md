# Tasks: 005-pdf-condicionales

**Input**: `specs/005-pdf-condicionales/` (spec, plan, data-model, contracts/validez, research D1–D9)

**Prerequisites**: 004 cerrado (multivínculo `_pmu_pdf_slugs` es deuda de 004; si
sigue pendiente, se implementa aquí en Setup sin duplicar: una sola lista canónica).

**Tests**: fase `validez` en `tests/texto_puente.php` + `tests/validez.js` con
`tests/validez-fixture.json` (misma expresión, mismos valores, mismo resultado en
PHP-saneado y JS-evaluador) + puertas (`php -l`, SMOKE, PARIDAD) + `quickstart.md`.

## Format: `[ID] [P?] [Story] Description` — con ruta exacta.

---

## Phase 1: Setup (multivínculo)

**Purpose**: lista canónica de PDFs por producto antes de condicionar nada.

- [X] T001 [Setup] Postmeta `_pmu_pdf_slugs` (lista) en `personalizador-pdf.php`:
  `producto_pdf_slugs()` (lista saneada y unica; respaldo singular `_pmu_pdf_slug`
  si no hay lista; se conserva, no se migra a la fuerza), `producto_pdf_slug()`
  como compat (primero de la lista), `producto_pdf_vincular()` agrega sin
  duplicar, `producto_pdf_desvincular()` quita de la lista (y limpia el
  singular). Espejo `config.json:productos[]` intacto. Test: fase `validez`
  (lista, compat, re-vinculo sin duplicar, respaldo, baja) + auditoria 2026-09-21:
  lista multiple con dedupe y baja parcial, elemento invalido descartado solo a el
  (nunca invalida la lista completa).

---

## Phase 2: Foundational (configuración tienda + saneado)

**Purpose**: `tienda{}` normalizada y snapshot saneado. Bloquea US1–US4.

- [X] T002 [Found] `PMU_Uploads::config_tienda` en `inc/class-pmu-uploads.php`:
  normaliza `tienda{pid}` (`activo` default true / `bloquear` a bool,
  `validez`/`mensaje_html` recortados a 2000, claves `^[0-9]+$`); `validez`
  compila en el sandbox de campos (causa `motor:campos:script:invalido`;
  envuelta como cuerpo de funcion para la validacion); `mensaje_html` por
  allowlist `wp_kses` (p/b/i/strong/em/br/ul/li). Sin entrada = `{activo: true}`
  (004 intacto). Stub `wp_kses` en el arnes. Test: fase `validez` (normalizada,
  saneada sin script, prohibida rechazada, pid no-numerico fuera). Auditoria
  2026-09-21: `bloquear` sin `validez` se ignora (data-model), `bool_form`
  tolera hidden(0)+checkbox(1) y la validacion es POR CAMBIO — un valor viejo
  que hoy no compila se conserva (lectura tolerante, nunca bloquea la consola)
  y solo se rechaza lo nuevo/alterado.
- [X] T003 [Found] Saneado del snapshot (`sanear_pdfs_declarados()` en
  `personalizador-pdf.php`): intersecta lo declarado con asociado
  (`producto_pdf_slugs`) + `tienda{pid}.activo !== false`, sin duplicados;
  devuelve `pdfs[]` + `descartados[]` para el snapshot (PHP nunca evalua
  `validez`). Test: fase `validez` (inactivo declarado a mano cae a
  descartados con el duplicado). Auditoria 2026-09-21: el test re-asocia antes
  de sanear (antes caia por "no asociado" y nunca ejercia `tienda.activo`);
  `descartados` sin duplicados, un aceptado nunca aparece en descartados y un
  declarado no saneable se audita crudo y acotado.

---

## Phase 3: User Story 1 - Admin declara valideces (P1)

**Goal**: por asociación PDF×producto, Configuración tienda con validez/mensaje/bloqueo.

**Independent Test**: asociar 4 PDFs a producto1 con las valideces del ejemplo;
verificar `config.json:tienda{pid}` sin tocar `analisis.json` ni el resto.

- [X] T004 [US1] Sección "Validez por producto" en `admin/pdfs.php`: un bloque por
  producto asociado (chips = espejo `productos[]`), con `activo` (hidden `0` + checkbox
  `1`), `validez` (textarea opcional), `mensaje_html` (opcional) y `bloquear` (checkbox
  default `false`, **visible solo si hay `validez`**; toggle en `assets/admin.js`, que
  ademas quita el bloque al quitar el chip). Persiste por `handle_config_guardar`
  (`tienda_desde_post()`: marcador `tienda_presente=1` —sin seccion no se toca `tienda`—,
  poda de asociaciones huerfanas, try/catch con causa visible "Validez invalida: ...") y
  `PMU_Uploads::config_tienda` (bools/recortes/allowlist; validacion por cambio).
  Test: fase `admin` (render real: bloques por producto, precarga, hidden+checkbox,
  `bloquear` oculto sin validez) + fases `validez_admin`/`validez_admin_mal`.
- [X] T005 [US1] Test de la historia: fase `validez` (25 asserts: multivinculo,
  `tienda{}` normalizada, `bloquear` sin `validez` ignorado, HTML fuera de allowlist
  saneado, recortes a 2000, sintaxis invalida rechazada sin dejar el config a medias,
  tienda no pisa el resto, validez vieja tolerada, saneado del snapshot) +
  `validez_admin` (hidden+checkbox, poda de huerfanos, espejo de productos) +
  `validez_admin_mal` (JSON con causa y `tienda` sin escribir).

---

## Phase 4: User Story 2 - Ficha filtra por selección (P1)

**Goal**: PDFs/mockups aparecen/desaparecen al instante; primer mensaje visible.

**Independent Test**: elegir diseño+tamaño filtra a 1 elegible (<200 ms la
evaluación; galería solo con sus mockups; 3 fallos = 1 mensaje).

- [X] T006 [US2] Evaluador en `assets/tienda.js`: `PURO.compilarValidez()` (mismo
  sandbox `new Function` que el `script` de un campo; inyecta solo los `campoN`
  referenciados + helpers `trim/incluye/regex/vacio/len`) y `PURO.evaluarValidez()`
  (sin expresion, sin compilar o con error de ejecucion = `true`; `campoN`
  inexistente = `undefined`). La ficha re-evalua con cada `input`/`change` del panel
  y con `manage_options` vuelca el diagnostico por consola (D8).
- [X] T007 [US2] Filtrado + primer mensaje: `PURO.filtrarPdfs()` (elegibles en el
  orden alfabetico de `panel_producto`, primer `mensaje_html` de las fallidas) y
  `aplicarFiltro()` en la ficha (aviso `.pmu-validez-aviso` al final de los campos,
  `innerHTML` ya saneado por allowlist al guardar). La galeria solo compone mockups
  de los PDFs elegibles (el servidor devuelve unicamente esos: `handle_vista_previa`
  sanea el `pmu_pdfs` declarado) y la union de campos (D4) sigue visible.

---

## Phase 5: User Story 3 - Bloquear producto (P2)

**Goal**: `bloquear` y 0-elegibles deshabilitan el `add-to-cart`.

**Independent Test**: con `bloquear` y fallo → deshabilitado; al corregir →
habilitado; 0 elegibles bloquea aunque todo sea `false`.

- [X] T008 [US3] Bloqueo en `assets/tienda.js`: `bloqueos = {vistas, validez}` +
  `refrescarCarrito()` combinan el bloqueo de 004 (vistas pendientes) con el de 005
  (`bloquear` de una validez fallida o 0 elegibles, FR-4.2). Sin `bloquear` y con
  >=1 elegible el mensaje se ve y el carrito queda habilitado (V-7).

---

## Phase 6: User Story 4 - Snapshot y auditoría (P2)

**Goal**: elegibles congelados gobiernan pool/Motor/Descargas/Completados.

**Independent Test**: agregar declara elegibles; inactivo a mano → descartados;
"Completados" muestra ambos; regeneración usa el snapshot.

- [X] T009 [US4] Declaración del snapshot en `assets/tienda.js` + `personalizador-pdf.php`:
  el navegador envía los elegibles (`pmu_pdfs`); `carrito_validar` los sanea
  (T003) y congela; re-edición re-declara y reemplaza (nunca fusiona). El pool se
  recorta al snapshot; una lista vacía se rechaza con
  `motor:sesion:snapshot:vacio` sin crear draft. Tests: fases
  `ficha_pdfs_previa` y `ficha_pdfs_vacio` + `ficha_pdfs_carrito`.
- [X] T010 [US4] Auditoría en consola ("Completados", `admin/pdfs.php`): columnas
  `pdfs[]` + `pdfs_descartados[]` por ítem; regeneración y descarga usan solo el
  snapshot; Descargas expone una fila por PDF aceptado. Test: fase
  `completados` + render admin.

---

## Phase 7: Polish

- [X] T011 [Polish] `tests/validez.js` + `tests/validez-fixture.json`: el
  evaluador JS (extraído sin DOM desde `tienda.js`, como `conciliacion.js` de
  004) pasa la fixture (4 expresiones del ejemplo + validadores FR-6 + bordes:
  vacía, sintaxis, campo inexistente, arrays); la fase PHP `validez` verifica el
  mismo resultado de saneado sobre la misma fixture. Ejecutado:
  `FASE validez OK` + `VALIDEZ OK`.
- [ ] T012 [Polish] Docs: AGENTS.md §5 (`tienda{}`) + §7 (decisión), ayuda de la
  consola (Configuración tienda), checklist abajo, `quickstart.md` recorrido
  manual en WP real (T030 de 004 lo cubre si sigue abierto). La ayuda y el
  quickstart 005 ya documentan multivínculo, validez, snapshot, descartados y
  descargas por PDF; queda únicamente el recorrido manual en WP real.

---

## Checklist de calidad de esta spec

- [ ] Sin marcadores por aclarar; requisitos testeables y sin ambigüedad.
- [ ] SC medibles (SC-1..SC-7 con medición declarada).
- [ ] Casos borde identificados (6 en spec.md).
- [ ] Alcance acotado (sin parser en servidor; puerta abierta versionando el contrato).
- [ ] Dependencias declaradas (004 cerrado; multivínculo aquí si falta).
- [ ] Trazabilidad: cada FR (FR-1..FR-6) tiene ≥1 tarea (T001..T010).