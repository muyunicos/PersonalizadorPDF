#!/usr/bin/env node
/**
 * config-cableado - puerta del CABLEADO de config (spec 043, 2026-11-22).
 *
 * `CargadorPMU` y `SelectorPMU` normalizan `config` con una allowlist: si un hook
 * no esta en la lista se descarta EN SILENCIO. Esta puerta los CONSTRUYE de
 * verdad (sin DOM) y comprueba que cada hook que `tienda.js` pasa llega al
 * `config` de la instancia. Nace del bug real: `onRecorte` y `paramsDe`
 * no estaban en las allowlists y la tira cai a `cubrir`.
 *
 *   node tests/config-cableado.test.js  ->  CONFIG CABLEADO OK (N checks)
 */
'use strict';

const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
require(path.join(RAIZ, 'assets', 'receta-objetivo.js'));
const API = require(path.join(RAIZ, 'assets', 'cargador-pmu.js'));
const SelectorPMU = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));

const CargadorPMU = API.CargadorPMU || API;

let checks = 0;
let fallos = 0;
function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FALLA ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}
function grupo(nombre) { console.log('\n== ' + nombre + ' =='); }

const noop = function () { };

/* ---- Cargador: los hooks que `tienda.js` pasa por config ---- */
grupo('CargadorPMU: hooks de config');
const hooksC = { onRecorte: noop, subir: noop, onChange: noop, onError: noop, urlDe: noop, urlDeRespaldo: noop };
const c = new CargadorPMU(null, Object.assign({
    ranuras: [{ w: 100, h: 100, forma: 'rectangulo', min: 1, max: 2, gid: '0000FF', phsize: 0 }],
    yaNormalizadas: true
}, hooksC));

check('onRecorte llega (lo usan `_subir` y `_usarExistente`)', c.config.onRecorte === hooksC.onRecorte);
check('subir llega', c.config.subir === hooksC.subir);
check('onChange llega', c.config.onChange === hooksC.onChange);
check('onError llega', c.config.onError === hooksC.onError);
check('urlDe llega', c.config.urlDe === hooksC.urlDe);
check('urlDeRespaldo llega', c.config.urlDeRespaldo === hooksC.urlDeRespaldo);
check('`yaNormalizadas` se consume y no ensucia el config', c.config.yaNormalizadas === undefined);
check('`max` llega por ranura', c.config.ranuras[0].max === 2);
check('sin ranuras no monta', c.config.ranuras.length === 1);

/* ---- Selector: los hooks que el cargador pasa al abrir ---- */
grupo('SelectorPMU: hooks de config');
const hooksS = { usarExistente: noop, declararReceta: noop, paramsDe: noop, subirAsync: noop, eliminar: noop, subirLote: noop };
const s = new SelectorPMU(null, Object.assign({
    finalW: 100, finalH: 100, mode: 'cubrir', forma: 'rectangulo', max: 2
}, hooksS));

check('usarExistente llega', s.config.usarExistente === hooksS.usarExistente);
check('declararReceta llega', s.config.declararReceta === hooksS.declararReceta);
check('paramsDe llega (lo usa la tira al elegir)', s.config.paramsDe === hooksS.paramsDe);
check('subirAsync llega', s.config.subirAsync === hooksS.subirAsync);
check('eliminar llega', s.config.eliminar === hooksS.eliminar);
check('subirLote llega', s.config.subirLote === hooksS.subirLote);
check('finalW/finalH obligatorios y respetados', s.config.finalW === 100 && s.config.finalH === 100);

// Sin finalW/finalH el selector debe fallar con causa (no abrir en falso).
let exploto = false;
try {
    new SelectorPMU(null, { finalW: 0, finalH: 0, mode: 'cubrir' }); // eslint-disable-line no-new
} catch (e) { exploto = true; }
check('sin finalW/finalH falla con causa', exploto);

// ---- Aviso de funciones ignoradas (mejora 2) ----
grupo('Config: aviso de funcion ignorada');
let avisos = [];
const warnOrig = console.warn;
console.warn = function (m) { avisos.push(String(m)); };
new CargadorPMU(null, { // eslint-disable-line no-new
    ranuras: [{ w: 100, h: 100, forma: 'rectangulo', min: 1, max: 1, gid: '0000FF', phsize: 0 }],
    yaNormalizadas: true,
    hookFantasma: noop
});
new SelectorPMU(null, { finalW: 100, finalH: 100, mode: 'cubrir', hookFantasma2: noop }); // eslint-disable-line no-new
console.warn = warnOrig;
check('cargador: avisa cuando una funcion de config se ignora',
    avisos.some((a) => /cargador: funcion de config ignorada: hookFantasma/.test(a)), JSON.stringify(avisos));
check('selector: avisa cuando una funcion de config se ignora',
    avisos.some((a) => /selector: funcion de config ignorada: hookFantasma2/.test(a)), JSON.stringify(avisos));
check('no avisa por claves normales (no funcion)', !avisos.some((a) => /finalW/.test(a)), JSON.stringify(avisos));

console.log('');
if (fallos === 0) {
    console.log('CONFIG CABLEADO OK (' + checks + ' checks)');
    process.exit(0);
}
console.log('CONFIG CABLEADO FALLA (' + fallos + ' de ' + checks + ')');
process.exit(1);