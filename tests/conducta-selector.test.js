#!/usr/bin/env node
/**
 * conducta-selector - puerta CONDUCTUAL del selector (spec 043, P1-5).
 *
 * `selector-contrato.test.js` verifica el CABLEADO con regex sobre el fuente.
 * Esta puerta lo EJECUTA sin DOM (el constructor no toca el DOM; los metodos
 * puros tampoco) y comprueba el comportamiento: `_params()`, `open()`,
 * `_aplicarParamsIniciales()` y `_recetaDeFoto()`.
 *
 *   node tests/conducta-selector.test.js  ->  CONDUCTA SELECTOR OK (N checks)
 */
'use strict';

const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
require(path.join(RAIZ, 'assets', 'receta-objetivo.js'));
const SelectorPMU = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));

let checks = 0;
let fallos = 0;
function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FALLA ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}
function grupo(nombre) { console.log('\n== ' + nombre + ' =='); }

function selector(extra) {
    return new SelectorPMU(null, Object.assign({
        finalW: 500, finalH: 400, mode: 'cubrir', forma: 'rectangulo',
        phsize: 0, gid: '0000FF', transp: 'no'
    }, extra || {}));
}

/* ---- _params(): la receta que viaja al servidor ---- */
grupo('_params: receta v2');
const s0 = selector();
const p0 = s0._params();
check('v2', p0.v === 2, JSON.stringify(p0));
check('lienzo = hueco de la ranura', p0.w === 500 && p0.h === 400, p0.w + 'x' + p0.h);
check('modo canonico', p0.modo === 'cubrir', p0.modo);
check('escala 1, rot 0, centro 0.5/0.5', p0.escala === 1 && p0.rot === 0 && p0.ox === 0.5 && p0.oy === 0.5,
    JSON.stringify([p0.escala, p0.rot, p0.ox, p0.oy]));
check('gid en mayusculas', /^[0-9A-F]{6}$/.test(p0.gid), p0.gid);
check('transp declarada', p0.transp === 'no', p0.transp);

const sEstirar = selector({ mode: 'estirar', transp: 'si' });
const pEstirar = sEstirar._params();
check('modo estirar y transp si se respetan', pEstirar.modo === 'estirar' && pEstirar.transp === 'si',
    pEstirar.modo + '/' + pEstirar.transp);
check('los ids viejos se canonicalizan', selector({ mode: 'rellenar' })._params().modo === 'cubrir',
    selector({ mode: 'rellenar' })._params().modo);

/* ---- open(): paramsIniciales ---- */
grupo('open: receta por apertura');
const pReceta = { v: 2, w: 500, h: 400, modo: 'encajar', escala: 1.3, rot: 0, ox: 0.5, oy: 0.5 };
// `open()` construye el DOM despues de fijar `_paramsIniciales`: sin DOM se
// interrumpe ahi, pero la receta de ESTA apertura ya quedo guardada.
const sOpen = selector();
try { sOpen.open({ params: pReceta }); } catch (e) { /* sin DOM */ }
check('open({params}) guarda la receta', sOpen._paramsIniciales === pReceta);
const sOpenVacio = selector();
try { sOpenVacio.open({}); } catch (e) { /* sin DOM */ }
check('open({}) la deja en null (defaults)', sOpenVacio._paramsIniciales === null);
const sOpenNulo = selector();
try { sOpenNulo.open({ params: 'no soy objeto' }); } catch (e) { /* sin DOM */ }
check('open con params que no es objeto la descarta', sOpenNulo._paramsIniciales === null);

/* ---- _aplicarParamsIniciales(): aplica o rechaza ---- */
grupo('_aplicarParamsIniciales');
const sApl = selector();
sApl.imagen = { naturalWidth: 1000, naturalHeight: 800 }; // el metodo exige imagen cargada
const aplico = sApl._aplicarParamsIniciales({
    v: 2, w: 500, h: 400, modo: 'encajar', escala: 1.5, rot: 90, ox: 0.4, oy: 0.6, fondo: '#ff0000',
    phsize: 0, gid: '0000FF'
});
check('aplica y devuelve true', aplico === true, String(aplico));
check('escala 1.5', sApl.zoom === 1.5, sApl.zoom);
check('rotacion 90', sApl.rotacion === 90, sApl.rotacion);
check('modo encajar', sApl.config.mode === 'encajar', sApl.config.mode);
check('fondo elegido', sApl.colorFondo === '#ff0000', sApl.colorFondo);
const sMal = selector();
check('geometria distinta -> false (no aplica)', sMal._aplicarParamsIniciales({ v: 2, w: 999, h: 999, modo: 'encajar' }) === false);
check('phsize distinto -> false', (function () {
    const s = selector({ phsize: 1 });
    return s._aplicarParamsIniciales({ v: 2, w: 500, h: 400, phsize: 0, modo: 'encajar' }) === false;
})());
check('gid distinto -> false', (function () {
    const s = selector({ gid: '0000FF' });
    return s._aplicarParamsIniciales({ v: 2, w: 500, h: 400, gid: 'FF0000', modo: 'encajar' }) === false;
})());
check('escala fuera de rango se acota (no rompe)', (function () {
    const s = selector();
    s.imagen = { naturalWidth: 1000, naturalHeight: 800 };
    s._aplicarParamsIniciales({ v: 2, w: 500, h: 400, escala: 99, modo: 'encajar' });
    return s.zoom >= 0.25 && s.zoom <= 4 && s.zoom === 4;
})(), 'zoom=' + sApl.zoom);

/* ---- _recetaDeFoto(): params -> ajustes -> recetas ---- */
grupo('_recetaDeFoto: params -> ajustes -> recetas');
const pDirecta = { v: 2, modo: 'encajar' };
const pCliente = { v: 2, modo: 'estirar' };
const pObjetivo = { v: 2, modo: 'cubrir' };
const sFoto = selector();
check('foto.params manda', sFoto._recetaDeFoto({ params: pDirecta }) === pDirecta);
check('sin params cae a ajustes.configuracion', sFoto._recetaDeFoto({ ajustes: { configuracion: pCliente } }) === pCliente);
check('sin params ni ajustes usa recetas[objetivo]',
    sFoto._recetaDeFoto({ recetas: { '1.2500-0-200000': pObjetivo } }) === pObjetivo,
    JSON.stringify(sFoto._recetaDeFoto({ recetas: { '1.2500-0-200000': pObjetivo } })));
check('sin nada -> null (defaults del campo)', sFoto._recetaDeFoto({}) === null);
check('foto vacia -> null', sFoto._recetaDeFoto(null) === null);

console.log('');
if (fallos === 0) {
    console.log('CONDUCTA SELECTOR OK (' + checks + ' checks)');
    process.exit(0);
}
console.log('CONDUCTA SELECTOR FALLA (' + fallos + ' de ' + checks + ')');
process.exit(1);