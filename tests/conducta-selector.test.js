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

/* ---- US1 (T004): _cargar una imagen nueva ---- */
grupo('_cargar: imagen nueva');
global.URL = global.URL || {};
global.URL.createObjectURL = function () { return 'blob:foto-nueva'; };
global.URL.revokeObjectURL = function () { };
global.Image = class {
    constructor() { this._src = ''; }
    set src(v) { this._src = v; if (typeof this.onload === 'function') { this.onload(); } }
    get src() { return this._src; }
};
const sCarga = selector();
sCarga.config.declararReceta = function () { };
let subioCuenta = 0;
sCarga.config.subirAsync = function () { subioCuenta++; return Promise.resolve('id-nuevo'); };
const archivoNuevo = { type: 'image/png', name: 'foto.png', size: 10 };
let excepcionCarga = null;
try { sCarga._cargar(archivoNuevo); } catch (e) { excepcionCarga = e; }
check('_cargar sin excepcion', excepcionCarga === null, excepcionCarga && excepcionCarga.message);
check('_cargar deja la imagen cargada', !!sCarga.imagen && sCarga.archivoOrigen === archivoNuevo);
check('_cargar resetea el zoom a 1', sCarga.zoom === 1, String(sCarga.zoom));
check('_cargar no sube todavia (sube al guardar)', subioCuenta === 0, 'subidas=' + subioCuenta);
sCarga._cargar({ type: 'text/plain', name: 'x.txt' });
check('_cargar rechaza formatos no permitidos (conserva la anterior)',
            sCarga.archivoOrigen === archivoNuevo && !!sCarga.imagen,
            'origen=' + (sCarga.archivoOrigen && sCarga.archivoOrigen.name));

/* ---- US1 (T005): _cancelar ---- */
grupo('_cancelar: CROP_ABORTED sin escrituras');
const sCanc = selector();
let errores = [];
sCanc.onError(function (e) { errores.push(e); });
sCanc.config.subirAsync = function () { errores.push({ code: 'SUBIO' }); return Promise.resolve('x'); };
sCanc.config.usarExistente = function () { errores.push({ code: 'USAR' }); return Promise.resolve('x'); };
sCanc.config.declararReceta = function () { errores.push({ code: 'DECLARAR' }); };
try { sCanc._cancelar(); } catch (e) { /* sin DOM */ }
check('_cancelar emite CROP_ABORTED (avisa cancelacion)',
            errores.some((e) => /CROP_ABORTED|Cancelado/i.test(typeof e === 'string' ? e : JSON.stringify(e))),
            JSON.stringify(errores));
check('_cancelar no sube ni declara', !errores.some((e) => e && /SUBIO|USAR|DECLARAR/.test(e.code)), JSON.stringify(errores));

/* ---- US1 (T006): _aceptar de una EXISTENTE (0 bytes) ---- */
grupo('_aceptar: existente = 0 bytes');
const sAcep = selector();
var usados = [];
var declaradas = [];
var subidas = 0;
sAcep.config.usarExistente = function (id, params) { usados.push({ id: id, params: params }); return Promise.resolve(id); };
sAcep.config.declararReceta = function (id, params) { declaradas.push({ id: id, params: params }); };
sAcep.config.subirAsync = function () { subidas++; return Promise.resolve('x'); };
sAcep.imagen = { naturalWidth: 800, naturalHeight: 600 };
sAcep._bib = { id: 'bced3cb925d7', url: 'http://x/original.webp', params: null };
try { sAcep._aceptar(); } catch (e) { /* sin DOM */ }
check('_aceptar de existente llama usarExistente', usados.length === 1, JSON.stringify(usados));
check('_aceptar de existente declara la receta', declaradas.length === 1, JSON.stringify(declaradas));
check('_aceptar de existente NO sube bytes', subidas === 0, 'subidas=' + subidas);

    /* ---- #F2 (fix 2026-11-24): libera objectURLs (sin leak) ---- */
    grupo('#F2: libera objectURLs');
    const urlRev = [];
    const revOrig = (global.URL && global.URL.revokeObjectURL) ? global.URL.revokeObjectURL : null;
    if (global.URL) { global.URL.revokeObjectURL = function (u) { urlRev.push(String(u)); }; }
    const sF2 = selector();
    sF2.imagen = { src: 'blob:original-1', naturalWidth: 100, naturalHeight: 100 };
    sF2.ultimaUrl = 'blob:recorte-1';
    sF2._resetEstado();
    check('#F2: _resetEstado revoca el ORIGINAL anterior', urlRev.indexOf('blob:original-1') !== -1, JSON.stringify(urlRev));
    check('#F2: _resetEstado deja imagen en null', sF2.imagen === null);
    const nRev = urlRev.length;
    sF2._revoquearBlob('http://x/a.webp');
    check('#F2: _revoquearBlob no toca URLs que no son blob:', urlRev.length === nRev);
    const sF2d = selector();
    sF2d.imagen = { src: 'blob:original-2', naturalWidth: 1, naturalHeight: 1 };
    sF2d.ultimaUrl = 'blob:recorte-2';
    sF2d.destroy();
    check('#F2: destroy revoca original y recorte',
        urlRev.indexOf('blob:original-2') !== -1 && urlRev.indexOf('blob:recorte-2') !== -1, JSON.stringify(urlRev));
    if (global.URL) { global.URL.revokeObjectURL = revOrig; }

    /* ---- #F5: esImagen (validacion de archivo, pura) ---- */
    grupo('#F5: esImagen acepta/rechaza por tipo y extension');
    check('#F5: png por tipo', SelectorPMU.esImagen({ type: 'image/png', name: 'x' }) === true);
    check('#F5: jpg por extension', SelectorPMU.esImagen({ type: '', name: 'foto.JPG' }) === true);
    check('#F5: webp', SelectorPMU.esImagen({ type: 'image/webp', name: 'a.webp' }) === true);
    check('#F5: svg queda fuera', SelectorPMU.esImagen({ type: 'image/svg+xml', name: 'a.svg' }) === false);
    check('#F5: texto queda fuera', SelectorPMU.esImagen({ type: 'text/plain', name: 'a.txt' }) === false);
    check('#F5: nulo no rompe', SelectorPMU.esImagen(null) === false);
    console.log('');
    if (fallos === 0) {
        console.log('CONDUCTA SELECTOR OK (' + checks + ' checks)');
        process.exit(0);
    }
    console.log('CONDUCTA SELECTOR FALLA (' + fallos + ' de ' + checks + ')');
process.exit(1);