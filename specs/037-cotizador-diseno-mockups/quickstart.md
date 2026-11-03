# Quickstart (037) — Validacion del cotizador con diseno

> Recorrido de aceptacion. Las puertas automaticas primero; el recorrido de navegador en el
> laboratorio (`C:\wp-lab`) despues. Cada escenario dice **que correr** y **que debe salir**.
> Contratos: [contracts/puente-cotizador.md](./contracts/puente-cotizador.md) y
> [contracts/customs.md](./contracts/customs.md).

## Prerequisitos

- Repo en `c:\Users\Jonatan\Documents\GitHub\personalizador-pdf`, PowerShell 7 (`pwsh`).
- PHP en PATH (`php -v`), Node en PATH (`node -v`).
- Para E10: Chrome + Playwright en `%TEMP%` y el laboratorio `C:\wp-lab`.

## E0 — Puertas base (antes de tocar nada)

```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
node tests/motor_smoke.php
```

**Esperado**: sin errores de sintaxis; `SMOKE OK`.

## E1 — Contexto declarado (R1)

```powershell
node tests/cotizador-contrato.test.js --contexto
```

**Esperado**: `CONTEXTO OK` con 4 checks:
1. `manifest.contexto = 'cotizador'` en un item creado por el cotizador;
2. `manifest.pdfs = []` y `preview_estado = 'omisible'`;
3. `subidas[].origen` **no** contiene `cotizador`;
4. `pmu_cotizador_activo` en `false` deja `activo()` en `false` y no toca disco.

## E2 — Subida del original con receta (R5/R6)

```powershell
php tests/texto_puente.php cotizador
```

**Esperado** (`FASE cotizador OK`):
- la fila queda `origen: original`, `id` = 12 hex del sha, `receta` = 12 hex;
- el archivo es WebP y no supera 2000 px de lado;
- `receta_validar()` acepta la receta sintetica (`phsize = 0`, `gid` 6 hex, `rot` valido);
- dos subidas del mismo archivo dejan **una** fila.

## E3 — Mockup 300x300 (D3/R10)

Navegador del lab, con un mockup de la categoria:

1. Elegir forma y tamano en el cotizador y abrir el paso de diseno.
2. Subir una imagen.
3. **Esperado**: canvas 300x300 con el fondo del mockup y el arte dentro del hueco; **0**
   peticiones de red para componer (todo local); al cambiar de tamano, el hueco se re-resuelve sin
   volver a subir.

## E4 — Guardar un custom (C2/C4)

```powershell
php tests/texto_puente.php cotizador
```

**Esperado**:
- existe `orders/{cliente}/customs/{idea_id}/idea.json` y `mockup.webp`;
- **no** existe `manifest.json` dentro de `customs/`;
- re-guardar la misma idea **reemplaza** (una carpeta, un JSON);
- el `mockup.id` coincide con el archivo en disco.

## E5 — Estrella y orden (D4)

```powershell
node tests/cotizador-contrato.test.js --ideas
```

**Esperado**:
- marcar un custom → `favorito: true` y **primero** en el listado;
- marcar un item de la tienda → fila en `orders/{cliente}/customs/favoritos.json`;
- desmarcar devuelve el orden original;
- el comparador (favorito, orden, fecha) es puro y tiene 5 asserts.

## E6 — Borrado sin huerfanos (R11)

```powershell
php tests/texto_puente.php cotizador
```

**Esperado**:
- `borrar_idea` elimina `idea.json` **y** `mockup.webp`;
- el original compartido por otra idea **sigue existiendo**;
- borrar una idea ajena → `cotizador:idea:ajena` y **nada** se toca.

## E7 — Compra y promocion (R7/C3)

```powershell
php tests/texto_puente.php cotizador
```

**Esperado**:
- el line item tiene `_pmu_sid`, `_pmu_item_key`, `_mu_diseno_id` y `_mu_origen = 'cotizador'`;
- al pasar el pedido a `processing`, el item queda en `orders/{cliente}/{order_id}/{item_key}/` y
  el original en `orders/{cliente}/uploads/{id}.webp`;
- **no** se generan PDFs ni bonus para ese item;
- re-guardar el estado **no** duplica archivos (idempotente).

## E8 — Invitado que compra (R4)

```powershell
php tests/texto_puente.php cotizador
```

**Esperado**:
- un pedido con `customer_id = 0` **no** se promueve y deja la causa
  `motor:sesion:promocion:sin:cliente`;
- al pasar a cliente, sus customs de `tmp/sesion-{sid}/customs/` se **adoptan** a
  `orders/{cliente}/customs/` (y `tmp` queda sin ellas);
- re-adoptar es **no-op**.

## E9 — Los escaneos ignoran `customs/` (R3)

```powershell
php tests/sin_lectura.php
php tests/estado_pmu.php
php tests/inventario_pmu.php
```

**Esperado**:
- `SIN_LECTURA OK`;
- `pedidos_completados()` **no** lista `customs/` como pedido;
- `biblioteca_contenedores()` **no** lista `customs/` como item de sesion;
- el inventario no reporta `customs/` como catalogo ilegible.

## E10 — Carga diferida (D10/R9)

Navegador del lab, con Network abierto y cache vacia:

1. Abrir el cotizador. **Esperado**: **0** descargas de `mockup-render.js`, `selector-pmu.js`,
   `cargador-pmu.js`, `biblioteca-pmu.js`, `visor-pmu.js` y `fotos-pmu.js`.
2. Abrir el paso de diseno. **Esperado**: se piden `mockup-render` + `selector` (≈32 KB gzip) y el
   estado vacio del mockup se ve **sin** JS (fondo + hueco por CSS).
3. Tocar "Cargar imagen". **Esperado**: se piden `cargador` + `biblioteca` + `visor` + `fotos`
   (≈23 KB gzip) y el modal abre.
4. Repetir con el plugin desactivado. **Esperado**: el cotizador sigue cotizando y el paso ofrece
   el canal alternativo (D9).

## Puertas completas (antes de cerrar la spec)

```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
node --check assets/mockup-render.js; node --check assets/selector-pmu.js
node tests/cotizador-contrato.test.js
node tests/fotos-contrato.test.js
node tests/biblioteca-contrato.test.js
node tests/receta-contrato.test.js
node tests/cola-subida.test.js
node tests/mockup-contrato.test.js
node tests/vistas-contrato.test.js
php tests/texto_puente.php cotizador
php tests/motor_smoke.php
php tests/parity.php
php tests/sin_lectura.php
php tests/estado_pmu.php
node tests/cotizador-pedido.browser.js
```

**Esperado**: todo en verde y `git status` limpio. Si algo falla, la causa esta en el mensaje
(`cotizador:*` / `motor:*`): no se inventa un fallback silencioso.

---

## Evidencia del recorrido

| Escenario | Puerta | Resultado |
|---|---|---|
| E0 | `php -l` + `motor_smoke` | **OK** — `No syntax errors` (plugin + admin/engine/inc) y `SMOKE OK` (2026-11-03) |
| E1 | `node tests/cotizador-contrato.test.js --contexto` | **OK** — 5 checks; el global `--` todo suma **31 checks** |
| E2 / E4 / E6 / E7 / E8 | `php tests/texto_puente.php cotizador` | **OK** — `FASE cotizador OK` (43 checks) |
| E5 | `node tests/cotizador-contrato.test.js --ideas` | **OK** — 10 checks (estrella, orden, borrado, adopcion, retencion) |
| Paridad (I1) | `node tests/cotizador-contrato.test.js --paridad` | **OK** — 16 checks; mismo fixture que `calculadora/tests/core.test.js` |
| E9 | `sin_lectura` + `estado_pmu` + `inventario` | **OK** — `SIN_LECTURA OK`, `Estado inicial completo`, `customs/` no aparece |
| Regresion plugin | `receta` / `fotos` / `biblioteca` / `cola` / `mockup` / `vistas` | **OK** — 21 / 38 / 40 / 22 / 177 / 24 checks |
| Motor | `motor_smoke` + `parity` | **OK** — `SMOKE OK` + `PARIDAD OK` (el Motor no cambio) |
| Consumidor | `npm run typecheck` + `npm test` + `npm run build` + `npm run reglas` | **OK** — 26 tests, build OK, reglas regeneradas |
| E10 | `node tests/cotizador-pedido.browser.js` | **escrito, pendiente de lab** — sin `PMU_COTIZADOR_URL` sale 0 y declara `PENDIENTE`; cubre el conteo de red (0/32/+23 KB), `tienda.js`/`campo-montar.js` = 0 y el payload con `diseno` |

> Al cerrar la spec se completa esta tabla con el **resultado real** de cada puerta (patron de la
> 036: la evidencia se registra en `quickstart.md`, no en un archivo aparte).