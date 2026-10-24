# Quickstart: galerias-sprite-unificado

**Phase 1 output** — guía de validación ejecutable fin a fin. Sin implementación: el detalle de tarea queda para `tasks.md` (Phase 2). Referencias: [spec.md](./spec.md), [contracts/motor-sprite.md](./contracts/motor-sprite.md), [contracts/galeria-sprite.md](./contracts/galeria-sprite.md), [data-model.md](./data-model.md).

## §0 Prerrequisitos

- WordPress con el plugin activo y datos en `uploads/pmu/{fonts,img,tm-presets}/` (el espejo de desarrollo trae 72 fuentes / 128 imágenes / 1 preset).
- PHP CLI (≥ 7.4), Node (≥ 18) y, para la prueba de navegador, Chrome + Playwright con `TEXTMUY_CHROME` apuntando al ejecutable.
- Opcional: `uploads/pmu/pdfs/muestra.pdf` (dato del administrador) para `motor_smoke` y `parity`.
- Sesión admin con el permiso del motor (`pmu_uploads`).

## §1 Validación automática (correr en este orden)

```bash
# Plugin — sintaxis
for a in inc/*.php admin/*.php engine/*.php; do php -l "$a"; done     # "No syntax errors"

# Plugin — suites del motor
php tests/motor_smoke.php        # esperado: SMOKE OK (requiere muestra.pdf)
php tests/parity.php             # esperado: PARIDAD OK (mismo requisito)
php tests/texto_puente.php       # una fase por proceso; todas en verde

# Módulo — sintaxis
cd modules/textmuy
for a in js/*.js js/effects/*.js; do node --check "$a"; done           # sin salida = OK

# Módulo — suites
for t in tests/*.test.js; do node "$t"; done                           # 45 vigentes en verde (al 2026-10-24)
node tests/galerias.browser.js                                         # OK: galerias.browser.js ... (requiere Chrome + Playwright; al 2026-10-24 NO instalado en el entorno)
```

Salida esperada: 0 errores de sintaxis PHP/JS; todas las suites Node en `OK:`; la prueba de navegador pasa los escenarios de apertura certificada y de generación.

## §2 Escenarios de aceptación en WordPress

### E1 — Generación automática y persistencia (SC-002)

1. **Setup** (solo entorno de prueba): respaldar `fonts.json`, borrar `uploads/pmu/fonts/thumbs.webp` y quitarle `thumbs.sprite_firma` al inventario.
2. **Acción**: abrir el editor y la galería de fuentes con DevTools (Network) abierto.
3. **Esperado**: celdas con nombre + estado `Completando miniaturas: N/M…`; **exactamente 1** `POST ...op=sprite` (con `firma` y `scope=fonts`); al terminar, `thumbs.webp` de `720×540` (=`4×180` × `ceil(72/4)×30`) y `fonts.json` con `thumbs.sprite_firma = [180,30,4,items]`.
4. **Duración/volumen** (SC-003): ≤ 5 MB y ≤ 60 s medidos en Network.

### E2 — Aperturas siguientes con 0 descargas (SC-001)

1. **Acción**: F5 y reabrir las tres galerías con Network abierto (filtros "Font" e "Img").
2. **Esperado**: solo `fonts.json`/`img.json`/`presets.json` + sus `thumbs.webp`; **0** `.ttf/.woff2`, **0** `<link data-textmuy-font>`, **0** originales; miniaturas completas en las tres galerías.

### E3 — Alta posterior: solo la celda nueva (SC-004)

1. **Acción**: subir un `.ttf` desde la galería de fuentes → reabrir la galería con Network abierto.
2. **Esperado**: 1 sola descarga (el archivo nuevo), progreso `1/1`, 1 `op=sprite`; F5 vuelve a E2 (0 descargas).

### E4 — Preview real de una familia Google (SC-005)

1. **Acción**: clic en una celda Google pendiente con Network abierto.
2. **Esperado**: 1 request a `fonts.googleapis.com/css2?family={Nombre}` (sin `wght@`, sin `text=`) + sus woff2; el texto de la celda se redibuja con el tipo real; F5 lo conserva sin nuevas descargas.

### E5 — Causa visible + Reintentar (SC-007)

1. **Acción**: dejar `uploads/pmu/fonts/` sin escritura (`chmod -w`) y provocar una generación (E1/E3); alternativa: bloquear `fonts.googleapis.com` con el bloqueador de red de DevTools.
2. **Esperado**: estado `error` con motivo exacto (`motor:sprite:directorio:no_escribible`, o las celdas Google fallidas y **sin** persisten), celdas pendientes visibles y botón **Reintentar**; nunca el mensaje genérico "sin puente o sin catalogo". Al restaurar permisos y reintentar, vuelve a E1.

### E6 — Geometría de celdas (SC-006)

1. **Acción**: en la galería de fuentes, medir el tile en DevTools (`clientWidth`/`clientHeight`).
2. **Esperado**: 2 columnas de ~175 px; `clientHeight ≈ round(clientWidth × 30/180) ± 2` (~29 px); canvas sin recorte, con miniatura o con nombre; en imágenes `≈ ×100/100`; en presets `×100/200`.

### E7 — Reglas de cliente (SC-009 / FR-004…008)

1. Dos pestañas del editor → forzar generación en ambas → **1** `op=sprite` por ámbito en total (la segunda espera).
2. No existe el botón "Generar miniaturas" (galería de fuentes) ni "Miniaturas" (galería inferior de presets).
3. Con hoja certificada: `document.querySelectorAll('link[data-textmuy-font]').length === 0` al abrir.

## §2bis Evidencia de la revision 2026-10-24 (automatica)

Corrida desde la raiz del proyecto (PowerShell 7), antes de tocar nada:

| Puerta | Comando | Resultado |
|---|---|---|
| Sintaxis PHP | `php -l` de `personalizador-pdf.php` + `admin/`, `engine/`, `inc/` | 0 errores |
| Certificacion de hoja | `php tests/certificacion_hoja.php` | `CERTIFICACION HOJA OK` (18 checks: A-G) |
| Motor | `php tests/motor_smoke.php` | `SMOKE OK` |
| Sintaxis JS del modulo | `node --check` de `js/*.js` + `js/effects/*.js` | 0 errores |
| Suites del modulo | `node tests/*.test.js` | **45/45 OK** |
| Puerta de navegador | `node tests/galerias.browser.js` (Chrome + Playwright desde `%TEMP%` + `NODE_PATH`) | **OK** (SC-001/002/004/005/006 + Reintentar de las tres galerias) |

Registro por escenario (E1-E7 del §2): **pendiente** — se completa con el recorrido manual en WP real (T013/T023/T028/T032; guion en `specs/MANUAL-PENDIENTE-WP-REAL.md` §6f).

## §2ter Recorrido E1-E7 en WP real (laboratorio local, 2026-10-24)

Corrido con **WP real** en el laboratorio local (`C:\wp-lab`: WP + SQLite, plugin instalado por junction al repo, `php -S localhost:8091`) y Chrome via Playwright, con el **puente real** del plugin (el editor dentro de `wp-admin`, sin stubs). Script: `C:\wp-lab\recorrido-009.cjs`; capturas en `C:\wp-lab\capturas\e*.png`; resumen en `C:\wp-lab\capturas\recorrido-009.json`.

**Resultado: 33/33 checks en verde.** Numeros medidos:

| Escenario | Evidencia |
|---|---|
| E1 (SC-002/003) | **1** sola escritura `op=sprite`; `thumbs.webp` **720x540** (reticula c4 x 180x30 con 72 items); firma escrita; **~2,2 s** y **39 KB** (el maximo aceptado es 5 MB / 60 s) |
| E2 (SC-001) | 0 `.ttf`, 0 peticiones a Google, 0 originales, 0 `<link>` nuevos; celdas dibujadas desde la hoja (fonts 72, img 83) |
| E3 (SC-004) | el alta agrega 1 item con **1 POST op=alta**; la hoja se regenera con **1** escritura y queda certificada; la apertura siguiente: 0 descargas |
| E4 (SC-005) | con hoja certificada el clic en una celda Google **no** descarga nada (la hoja ya trae el tipo real) y no crea `FontFace`; la variante "celda **pendiente** => 1 `css2` sin `wght@`/`text=`" la cubre la puerta de navegador (T039) |
| E5 (SC-007) | catalogo no escribible (`attrib +R`: el `rename` del motor falla con Acceso denegado) => causa **visible** `Miniaturas: fonts:hoja:motor:rechazo` + boton **Reintentar**; con el fallo **no** se persiste nada; al reintentar: 1 escritura y hoja certificada |
| E6 (SC-006) | 2 columnas, celda de **162 px**, alto **27 px** = `round(162 x 30/180)` y `aspect-ratio: 6 / 1` |
| E7 (FR-009/SC-009) | no existen los botones "Generar miniaturas"/"Miniaturas"; las galerias exponen `Reintentar` (oculto sin error: 2 de panel + el del panel de presets); **dos aperturas simultaneas => 1 escritura** |

**Hallazgo del recorrido (corregido en RC75)**: en la galeria de FUENTES la causa y el `Reintentar` quedaban **invisibles** (el `then` posterior al `onError` ocultaba el boton y `render()` pisaba el status). Fix + escenario nuevo en la puerta de navegador: el escenario **falla** sin el fix (verificado). Detalle: `modules/textmuy/AGENTS.md` §7.31.

**Pendiente declarado (T041)**: cuando el MOTOR rechaza la escritura, el cliente informa `motor:rechazo` en vez del motivo exacto (`motor:sprite:catalogo:no_escribible`), porque `assets/miniaturas.js::persistirSheet` descarta `data.data`. SC-007 pide el motivo exacto.

**Notas de datos del laboratorio**: el lab tiene su propio `uploads/pmu` (no el espejo del repo). Para E2 se copio `img/` del espejo (el lab no lo tenia) y el catalogo de presets del lab (3 `.txm` de otro dataset) se aparto a `tm-presets/_lab-ajeno/` porque su generacion fallaba por datos ajenos y contaminaba la medicion.

## §3 Regresión y despliegue

1. Tras tocar JS/CSS del módulo: subir `?v=RCn` en `index.html` **y** `render-core.html` (+ `css/style.css?v=`) y recargar con Ctrl+F5 (AGENTS §4.6/§10).
2. Despliegue **conjunto** plugin + módulo (el contrato `op=sprite` amplía su alcance; payload sin cambios).
3. Recorrido integral: pestaña "Estilos de Texto" → subir imagen + tipografía + guardar estilo → asignar a un grupo → Procesar (circuito de 006).

## §4 Definición de done (evidencia por SC)

| SC | Evidencia | Escenario |
|---|---|---|
| SC-001 | Network = solo inventario + hoja | E2 |
| SC-002 | 1 `POST op=sprite` + `sprite_firma` escrita | E1 |
| SC-003 | ≤ 5 MB / ≤ 60 s medidos | E1 |
| SC-004 | 1 descarga + 1 escritura tras el alta | E3 |
| SC-005 | 1 `css2?family=…` por clic | E4 |
| SC-006 | 2 col × ~175 px, alto ± 2 px | E6 |
| SC-007 | Mensaje exacto + Reintentar | E5 |
| SC-008 | §1 completo en verde | §1 |
| SC-009 | 1 escritura por ámbito con 2 pestañas | E7.1 |
| SC-010 | AGENTS/constitución/INDICE actualizados | revisión de docs |

> **Estado al 2026-10-24 (cierre de la revisión)**: SC-001…SC-009 tienen evidencia **automática** (ver §2bis) y quedan
> pendientes de confirmación por el recorrido manual E1-E7. SC-006 y SC-008 quedaron **sincronizados y en verde**
> (`galerias.browser.js` corre con Chrome + Playwright desde `%TEMP%` + `NODE_PATH`, sin tocar el repo). SC-010 se cumple
> (AGENTS.md, `specs/INDICE.md`, manual §6f y las dos constituciones: módulo v3.2.1 y plugin v2.2.1).


