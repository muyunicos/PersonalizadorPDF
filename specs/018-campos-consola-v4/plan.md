# Plan — 018 Consola de Campos v4

## Alcance

Cinco archivos de producto + tests + docs. **No** toca `engine/`, la sesion, el
pool, el pedido ni `modules/textmuy/`.

| Archivo | Cambio |
|---|---|
| `assets/tienda.js` | `PMU_API` creado **antes** de montar; `subirFoto`/`urlDeSubida`/`montarCargador` publicos; `montarCargadores()` solo para legacy (`cargador && !campo.js`) |
| `assets/admin.js` | preview con stub `PMU_API` + puente de montaje; titulos con `.ec-c-nombre-txt`; `pintarFila()` espejo del subtitulo |
| `assets/cargador-pmu.js` | `montar()` idempotente por contenedor (evita doble UI si se llama dos veces) |
| `personalizador-pdf.php` | plantilla `imagen` nueva; form sin `array`/`protegido`/`texto_ayuda`/`cargador`; `<select name="tipo">`; `campo_editar($tipo)`; preservar `cargador` legacy al guardar |
| `inc/class-pmu-uploads.php` | `campo_editar()` actualiza `items[].tipo`; `normalizar_datos_campo()` sin `array`/`texto_ayuda`; `cargador` tolerante |
| `tests/campos-contrato.test.js` | contrato de `PMU_API`, plantilla nueva, una sola via de montaje, preview simulado |
| `tests/texto_puente.php` | fase `campos` (sin `array`; `cargador` legacy conservado al editar) |

## Fases

### F1 — API publica (`tienda.js`)

1. En `iniciar()` (`:1186-1207`) crear `PMU_API` **antes** de `montarCampos()`:

```js
var estado = null;
var api = {
    pdf: ficha.pdf,
    estado: null,
    valores: function () { return estado || {}; },
    subirFoto: function (blob, campo) { return subirFoto(blob, campo); },
    urlDeSubida: function (id) { /* sesion vigente + urlDeSubida() */ },
    montarCargador: function (el, opts) { /* ver abajo */ }
};
global.PMU_API = api;
estado = montarCampos(panel, ficha.campos, ficha.valores);
api.estado = estado;
if (ficha.sesion && ficha.sesion.item_key) { api.sesion = { ... }; }
```

2. `montarCargador(el, {campo, ranuras, onChange, envoltura})`:
   - resuelve `campoDef = (ficha.campos || []).filter(c => c.id === campo)[0]`;
   - `idsIniciales` = lista de ids de `ficha.valores[campo].valor` (reusa `idsDe`);
   - `envoltura` = `opts.envoltura || campoDef.envoltura || null`;
   - instancia `new window.CargadorPMU(el, {ranuras, subir, urlDe, idsIniciales, envoltura, onChange})`;
   - en `onChange` espeja `estado[campo].listo/array` (como hoy `:467-476`);
   - si falta `CargadorPMU`, `console.warn` y `return null` (FR-011).
3. `montarCargadores()`: `if (!campo.cargador || campo.js) return;` (FR-006).

### F2 — Plantilla y consola (`personalizador-pdf.php`, `class-pmu-uploads.php`)

1. `plantilla_campo('imagen')`: HTML con titulo + `[data-pmu-cargador]` y `js`
   con `PMU_API.montarCargador(...)`; `cargador => null`.
2. `form_campo_html()`: fuera la fila "Cargador de imagenes"; `<select name="tipo">`
   con los 3 tipos y el texto corto de que declara; boton "Cargar la plantilla de
   este tipo" (JS, rellena los 3 textareas).
3. `handle_campo_guardar()`: pasar `$tipo` en edicion; si el POST **no** trae
   `cargador` y el campo ya tenia uno, conservarlo (FR-005/D3).
4. `campo_editar($id, $datos, $htm, $css, $js, $tipo = null)`: valida con
   `tipo_valida()` y actualiza la fila del indice ademas de `datos.json`.
5. `normalizar_datos_campo()`: deja de escribir `array`/`texto_ayuda`; sigue
   leyendo `protegido` y `cargador` si llegan.
6. `campo_desde_post()`: no lee `array` ni `texto_ayuda`; `protegido` queda
   `false` si no viene (no se escribe desde la UI).

### F3 — Preview (`admin.js`)

1. `construirPreview()`: inyectar `window.PMU_API` con
   `montarCargador: function (el, opts) { return window.parent.PMUCampoPreview.montarCargador(el, opts); }`.
2. `PMUCampoPreview.montarCargador` (padre): la logica actual de `admin.js:1305-1315`
   (subida simulada con `objectURL`), extraida a funcion.
3. Copiar el `<style data-cargador-pmu>` al `<head>` del iframe (cosmetico; hoy
   los estilos van al documento padre).
4. `abrirPreview()`: titulo con `.ec-c-nombre-txt` (`:1278`).

### F4 — Limpieza (`admin.js`, `personalizador-pdf.php`)

1. `admin.js:203`: `$fila.find('.ec-c-nombre-txt').first().text()` (D6).
2. Quitar del form `array`, `protegido` y el textarea de cargador (D5).
3. `pintarFila()` (`:122-149`) y `fila_campo_html()` (`:3532-3549`) deben seguir
   emitiendo el **mismo** subtitulo (si cambia uno, cambia el otro).

### F5 — Tests, docs y cierre

1. `tests/campos-contrato.test.js`: `PMU_API` expuesto, plantilla nueva, regla
   `cargador && !js`, preview con puente, sin `data-cargador` obligatorio.
2. `tests/texto_puente.php` fase `campos`: sin `array`; alta -> editar preserva
   `cargador`; `campo_editar` cambia `tipo` en indice y `datos.json`.
3. Docs: `AGENTS.md` §5/§7/§11, `specs/012.../contracts/campos.md` (v4),
   `specs/015.../spec.md` (D10 enmendada: el tipo se puede corregir),
   `readme.txt` (changelog) y version **4.8.0 -> 4.9.0** en la cabecera.
4. `specs/INDICE.md`: fila del 018 en "En especificacion".

## Orden de implementacion

1. F1 + su check en `campos-contrato.test.js` (habilita todo).
2. F2 (plantilla primero, despues la consola) con `php -l` tras cada paso.
3. F3 (preview) con `node --check assets/admin.js`.
4. F4 (limpieza).
5. F5 (suites completas, docs, version).

Regla del repo (§10.ter): editar solo con el editor; `php -l` / `node --check`
despues de **cada** paso, no al final.

## Riesgos

- **Doble montaje** (legacy + `campo.js`): lo evita `cargador && !campo.js`. Lo
  cubre el test.
- **`PMU_API` inexistente en el montaje**: si se deja el orden actual
  (`:1196` antes de `:1207`) el `campo.js` falla y el campo publica `null`. Por
  eso F1 va primero y el arnés lo verifica.
- **Preview sin `PMU_API`**: el `campo.js` corre en el `srcdoc`; sin stub falla y
  el campo queda vacio. Es F3 antes de dar F2 por cerrada.
- **Editar un campo legacy y perder el cargador**: preservacion server-side
  (FR-005). Cubierto por la fase `campos`.
- **Sin validacion de ranuras en el servidor** (D8): un typo falla en el
  navegador. Mitigacion: plantilla, `Probar` y `console.warn`.
- **Dos `SelectorPMU` abiertos** con N campos: verificar en navegador (T022); si
  pasa, cerrar el otro al abrir.
