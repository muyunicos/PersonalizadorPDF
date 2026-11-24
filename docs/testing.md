# Guia de pruebas (spec 048)

## Regla de oro

- **Regex sobre el fuente = wiring**: sirve para comprobar que dos piezas estan
  conectadas (contrato publico, encolados, rutas). **No** prueba que se comporte bien.
- **Comportamiento = ejecutar el codigo**: se instancia el componente y se comprueba
  su resultado/estado. Sin DOM si el constructor no lo necesita; con DOM stub si si.

Un assert conductual **no** se reemplaza por uno de texto. Si una suite tiene muchos
regex, es deuda (ver `specs/048-pruebas-conductuales/`).

## Sin DOM (lo ideal)

Muchos componentes se pueden instanciar sin navegador porque el constructor solo
arma `this.config`:

```js
const CargadorPMU = require('../assets/cargador-pmu.js').CargadorPMU;
const c = new CargadorPMU(null, { ranuras: [...], onRecorte: fn, yaNormalizadas: true });
check('onRecorte llega al config', c.config.onRecorte === fn);
```

Ejemplos: `tests/config-cableado.test.js`, `tests/cargador-recetas.test.js`,
`tests/conducta-selector.test.js`, `tests/cargador-lote.test.js`.

**Trampa**: los constructores **normalizan** `config` con allowlist. Si agregas un hook
y no lo pones en la lista, desaparece en silencio. El guard es
`tests/config-cableado.test.js` (y el `console.warn` de los constructores).

## Con DOM (stub propio, sin dependencias)

`tests/_util/dom-stub.js` cubre `document`, nodos, `classList`, `dataset`,
`innerHTML`, eventos, `querySelector(All)` (tag/.class/#id) y `closest`.

```js
const { crearDocumento } = require('./_util/dom-stub.js');
const doc = crearDocumento();
global.document = doc;
global.localStorage = { _d: {}, getItem(k) { /* ... */ }, setItem(k, v) { /* ... */ }, removeItem(k) { /* ... */ } };
// ... pintar ...
check('pinto N celdas', cont.querySelectorAll('.cpmu-mini').length === 3);
delete global.document; delete global.localStorage;
```

Ejemplos: la seccion de runtime de `tests/biblioteca-contrato.test.js`.

Para componentes async que necesitan imagen:
```js
global.Image = class {
    constructor() { this.naturalWidth = 100; this.naturalHeight = 100; }
    set src(v) { this._src = v; if (this.onload) { this.onload(); } }
    get src() { return this._src; }
};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
```

## Plantilla de suite

```js
#!/usr/bin/env node
/* <nombre> - puerta <QUE> (spec NNN).
 *   node tests/<nombre>.test.js  ->  <NOMBRE> OK (N checks)
 */
'use strict';
let checks = 0, fallos = 0;
function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FALLA ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}
function grupo(nombre) { console.log('\n== ' + nombre + ' =='); }
// ... pruebas ...
console.log('');
if (fallos === 0) { console.log('<NOMBRE> OK (' + checks + ' checks)'); process.exit(0); }
console.log('<NOMBRE> FALLA (' + fallos + ' de ' + checks + ')');
process.exit(1);
```

## Errores comunes

| Sintoma | Causa | Solucion |
|---|---|---|
| `ReferenceError: X is not defined` | la suite no requiere el modulo | `require` antes de usarlo |
| ElPromise nunca resuelve | falta stub de `Image`/`URL` | definilos (arriba) |
| El dialogo no se ve | es **async** (microtask) | verificá la **llamada** sincronica, no el estado posterior |
| `Cannot set properties of undefined` | el constructor no se corrio (Object.create) | inicializa el campo en el stub o usa `new` |
| Un hook "no llega" | allowlist del constructor | agregalo a la lista + a `config-cableado` |

## Como correr

```powershell
node tests/<suite>.test.js              # una suite
Get-ChildItem tests/*.test.js | ForEach-Object { node $_.FullName }   # todas
node tests/ficha-pedido.browser.js      # navegador (requiere el lab)
```

Politica y conteos: `AGENTS.md §9`.