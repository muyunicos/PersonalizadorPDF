#!/usr/bin/env node
/**
 * cargador-lote - puerta de la carga multiple (spec 047).
 *
 * Verifica la receta v2 por defecto (`cubrir`), el tope de la ranura y que
 * `_subir` acepte params explicito. No monta el DOM: usa instancias minimas con
 * `_originalAcotado`/`_subir` cortados.
 *
 * Uso: node tests/cargador-lote.test.js
 */
'use strict';

const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
require(path.join(RAIZ, 'assets', 'receta-objetivo.js'));
const API = require(path.join(RAIZ, 'assets', 'cargador-pmu.js'));
const CargadorPMU = API.CargadorPMU;
const cargadorSrc = require('fs').readFileSync(require('path').join(RAIZ, 'assets', 'cargador-pmu.js'), 'utf8');

let checks = 0;
let fallos = 0;
function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}
function grupo(nombre) { console.log('\n== ' + nombre + ' =='); }

/** Cargador minimo con el lote cortado (registra llamadas). */
function cargador(max) {
    const c = Object.create(CargadorPMU.prototype);
    c.config = {
        ranuras: [{
            w: 500, h: 400, forma: 'rectangulo', min: 1, max: max,
            gid: '0000ff', phsize: 1, transp: 'no'
        }],
        onRecorte: null,
        onChange: null
    };
    c.estado = [{ ids: [] }];
    c._reemplazo = { indice: 0, posicion: 0, desdeVisor: false };
    c._urls = {};
    c.recetas = {};
    c._pendientes = {};
    c.errores = [];
    c.subidas = [];
    c._error = function (m) { c.errores.push(String(m)); };
    c._pintar = function () { };
    c._originalAcotado = function () { return Promise.resolve({ blob: { size: 1 }, w: 1200, h: 900 }); };
    c._subir = function (indice, blob, posicion, params) {
        c.subidas.push({ indice: indice, blob: blob, posicion: posicion, params: params });
        return Promise.resolve('id-' + c.subidas.length);
    };
    return c;
}

(async function () {
    /* ---- Receta por defecto ---- */
    grupo('Receta por defecto del lote');
    const c0 = cargador(2);
    const r = c0._recetaLote(c0.config.ranuras[0], 1200, 900);
    check('v2', r.v === 2);
    check('modo cubrir (decision del usuario)', r.modo === 'cubrir');
    check('escala 1', r.escala === 1);
    check('centro (ox/oy = 0.5)', r.ox === 0.5 && r.oy === 0.5);
    check('sin rotacion', r.rot === 0);
    check('lienzo de la ranura (w/h)', r.w === 500 && r.h === 400);
    check('dimensiones del original acotado (iw/ih)', r.iw === 1200 && r.ih === 900);
    check('gid en mayusculas', r.gid === '0000FF');
    check('phsize acotado', r.phsize === 1);
    check('fondo solido con transp:no', r.fondo === '#ffffff' && r.transp === 'no');

    const cTransp = cargador(2);
    cTransp.config.ranuras[0].transp = 'si';
    const rTransp = cTransp._recetaLote(cTransp.config.ranuras[0], 800, 600);
    check('fondo transparente con transp:si', rTransp.fondo === 'transparent');

    /* ---- Lote: respeta el max ---- */
    grupo('Lote: tope de la ranura');
    let c = cargador(2);
    await c._subirLote(0, [{ n: 1 }, { n: 2 }, { n: 3 }]);
    check('max=2 con 3 archivos -> 2 subidas', c.subidas.length === 2, 'n=' + c.subidas.length);
    check('avisa que solo entran 2', c.errores.some((e) => /Solo entran 2/.test(e)), JSON.stringify(c.errores));
    check('limpia `_reemplazo`', c._reemplazo === null);
    check('receta por defecto en cada subida',
        c.subidas.every((s) => s.params && s.params.modo === 'cubrir'));

    c = cargador(3);
    await c._subirLote(0, [{ n: 1 }, { n: 2 }]);
    check('max=3 con 2 archivos -> 2 subidas', c.subidas.length === 2, 'n=' + c.subidas.length);
    check('sin aviso de tope', c.errores.length === 0, JSON.stringify(c.errores));

    c = cargador(1);
    await c._subirLote(0, [{ n: 1 }, { n: 2 }]);
    check('max=1 con 2 archivos -> 1 subida', c.subidas.length === 1, 'n=' + c.subidas.length);

    /* ---- Lote: duplicados (T016) ---- */
    grupo('Lote: archivos repetidos');
    const f1 = { name: 'foto.png', size: 1000, lastModified: 111 };
    const f2 = { name: 'otra.png', size: 2000, lastModified: 222 };
    let cd = cargador(3);
    await cd._subirLote(0, [f1, f1, f2]);
    check('el mismo archivo dos veces -> 2 subidas (no 3)', cd.subidas.length === 2, 'n=' + cd.subidas.length);
    check('avisa que se omitio 1 repetido',
        cd.errores.some((e) => /omitio 1 archivo\(s\) repetido/.test(e)), JSON.stringify(cd.errores));
    cd = cargador(3);
    await cd._subirLote(0, [{ name: 'x.png', size: 1, lastModified: 1 }, { name: 'x.png', size: 2, lastModified: 1 }]);
    check('mismo nombre y fecha pero OTROS bytes -> 2 subidas', cd.subidas.length === 2, 'n=' + cd.subidas.length);
    cd = cargador(3);
    await cd._subirLote(0, [f1, f2]);
    check('sin repetidos no hay aviso', cd.errores.length === 0, JSON.stringify(cd.errores));
    cd = cargador(2);
    await cd._subirLote(0, [f1, f1, f1, f2]);
    check('3 copias del mismo + 1 -> 2 subidas (el dedupe corre antes del tope)',
        cd.subidas.length === 2, 'n=' + cd.subidas.length);
    check('avisa los 2 repetidos omitidos',
        cd.errores.some((e) => /omitio 2 archivo/.test(e)), JSON.stringify(cd.errores));

    /* ---- _subir con params explicito ---- */
    grupo('_subir con params explicito');
    const c2 = Object.create(CargadorPMU.prototype);
    c2.config = {
        ranuras: [{ w: 500, h: 400, min: 1, max: 2, forma: 'rectangulo', gid: '0000ff', phsize: 1 }],
        subir: function (blob, ctx) { c2.ctx = ctx; return Promise.resolve({ id: 'abcdef123456' }); },
        onRecorte: null
    };
    c2.estado = [{ ids: [] }];
    c2.selectores = [{ boton: { disabled: false } }];
    c2._urls = {};
    c2.recetas = {};
    c2._pendientes = {};
    c2._avisos = false;
    c2.txtFalta = null;
    c2._pintar = function () { };
    c2._paramsDe = function () { throw new Error('no debe llamarse'); };
    const paramsFijos = { v: 2, w: 500, h: 400, modo: 'cubrir', escala: 1, ox: 0.5, oy: 0.5, rot: 0, iw: 1200, ih: 900, fondo: '#ffffff', transp: 'no', phsize: 1, gid: '0000FF' };
    await c2._subir(0, { size: 1 }, null, paramsFijos);
    check('los params del lote llegan al servidor', !!c2.ctx && c2.ctx.params === paramsFijos, JSON.stringify(c2.ctx && c2.ctx.params));
    check('la receta queda memoizada por id', c2.recetas.abcdef123456 === paramsFijos);

    /* ---- #4 (fix 2026-11-24): no duplica una foto ya cargada ---- */
    grupo('#4: foto ya cargada no se duplica (avisa)');
    function cargadorSubir(max, idFijo) {
        const c = Object.create(CargadorPMU.prototype);
        c.config = {
            ranuras: [{ w: 500, h: 400, min: 1, max: max, forma: 'rectangulo', gid: '0000ff', phsize: 1 }],
            subir: function () { return Promise.resolve({ id: idFijo }); },
            onRecorte: null
        };
        c.estado = [{ ids: [] }];
        c.selectores = [{ boton: { disabled: false } }];
        c._urls = {};
        c.recetas = {};
        c._pendientes = {};
        c._avisos = false;
        c.txtFalta = null;
        c.errores = [];
        c._error = function (m) { c.errores.push(String(m)); };
        c._pintar = function () { };
        c._paramsDe = function () { return {}; };
        return c;
    }
    const params4 = { v: 2, w: 500, h: 400, modo: 'cubrir', escala: 1, ox: 0.5, oy: 0.5, rot: 0, iw: 1200, ih: 900, fondo: '#ffffff', transp: 'no', phsize: 1, gid: '0000FF' };
    let cdup = cargadorSubir(3, 'misma-foto');
    await cdup._subir(0, { size: 1 }, null, params4);
    await cdup._subir(0, { size: 1 }, null, params4);
    check('#4: subir dos veces la misma foto -> 1 sola entrada', cdup.estado[0].ids.length === 1, 'ids=' + JSON.stringify(cdup.estado[0].ids));
    check('#4: avisa que la foto ya estaba cargada',
        cdup.errores.some(function (e) { return /ya esta cargada/.test(e); }), JSON.stringify(cdup.errores));

    let cdist = cargadorSubir(3, null);
    let nDist = 0;
    cdist.config.subir = function () { nDist++; return Promise.resolve({ id: 'id-' + nDist }); };
    await cdist._subir(0, { size: 1 }, null, params4);
    await cdist._subir(0, { size: 1 }, null, params4);
    check('#4: fotos distintas -> 2 entradas (sin falso positivo)', cdist.estado[0].ids.length === 2, 'ids=' + JSON.stringify(cdist.estado[0].ids));
    check('#4: sin aviso cuando son distintas', cdist.errores.length === 0, JSON.stringify(cdist.errores));

    /* ---- #F1 (fix 2026-11-24): el lote no pasa del max ---- */
    grupo('#F1: el lote respeta el maximo');
    let cf1 = cargador(2);
    cf1._pendientes = { 0: [{}] }; // 1 subida en vuelo
    await cf1._subirLote(0, [{ n: 1 }, { n: 2 }, { n: 3 }]);
    check('#F1: libres descuenta las subidas en vuelo -> 1 sola entra', cf1.subidas.length === 1, 'n=' + cf1.subidas.length);

    let cconc = cargadorSubir(1, null);
    let cn = 0;
    cconc.config.subir = (function () { let n = 0; return function () { n++; var idn = 'c-' + n; return new Promise(function (r) { setTimeout(function () { r({ id: idn }); }, 5); }); }; })();
    await Promise.all([cconc._subir(0, { size: 1 }, null, params4), cconc._subir(0, { size: 1 }, null, params4)]);
    check('#F1: dos subidas concurrentes con max=1 -> 1 sola entrada', cconc.estado[0].ids.length === 1, 'ids=' + JSON.stringify(cconc.estado[0].ids));
    check('#F1: avisa que la ranura ya esta llena', cconc.errores.some(function (e) { return /llena/.test(e); }), JSON.stringify(cconc.errores));

    /* ---- #F3 (fix 2026-11-24): un intento exitoso limpia el error viejo ---- */
    grupo('#F3: el error viejo no queda pegado');
    let ce = Object.create(CargadorPMU.prototype);
    ce.txtError = { hidden: false, textContent: 'fallo anterior' };
    ce._limpiarError();
    check('#F3: _limpiarError oculta y vacia el error', ce.txtError.hidden === true && ce.txtError.textContent === '', JSON.stringify(ce.txtError));
    let ce2 = Object.create(CargadorPMU.prototype); // sin txtError: no rompe
    ce2._limpiarError();
    check('#F3: _limpiarError sin txtError no rompe', true);
    check('#F3: _subir limpia el error al empezar (wiring)',
        /prototype\._subir = function[\s\S]{0,700}?this\._limpiarError\(\)/.test(cargadorSrc));

    /* ---- #F4 (fix 2026-11-24): editar sin URL responde (avisa) ---- */
    grupo('#F4: editar una miniatura sin URL responde');
    let c4 = Object.create(CargadorPMU.prototype);
    c4.config = { ranuras: [{ w: 500, h: 400, forma: 'rectangulo', min: 1, max: 1, gid: '', phsize: 0 }], urlDe: function () { return ''; } };
    c4.estado = [{ ids: ['sin-url'] }];
    c4._urls = {};
    c4.recetas = {};
    c4.errores = [];
    c4._error = function (m) { c4.errores.push(String(m)); };
    c4._recetaDeContexto = function () { return null; };
    let cerro = false;
    c4._abrir = function () {
        c4.selectores = [{ sel: { close: function () { cerro = true; }, cargarDesdeBiblioteca: function () { return Promise.resolve(true); } } }];
    };
    let res4 = await c4._editar(0, 0);
    check('#F4: sin URL no resuelve (false)', res4 === false);
    check('#F4: avisa que no se pudo abrir', c4.errores.some(function (e) { return /no se pudo abrir/i.test(e); }), JSON.stringify(c4.errores));
    check('#F4: cierra el editor vacio', cerro === true);

    /* ---- #F5 (fix 2026-11-24): valida el archivo antes de abrir el modal ---- */
    grupo('#F5: archivo invalido no abre el modal');
    const selPrev = global.SelectorPMU;
    global.SelectorPMU = { esImagen: function (a) { return !!(a && a.ok); } };
    let c5 = Object.create(CargadorPMU.prototype);
    c5.config = { ranuras: [{ w: 500, h: 400, forma: 'rectangulo', min: 1, max: 2 }] };
    c5.selectores = [{}]; // slot existe; no se debe tocar tira
    c5._reemplazo = null;
    c5.errores = [];
    c5._error = function (m) { c5.errores.push(String(m)); };
    c5._abrir(0, { ok: false }); // archivo invalido
    check('#F5: archivo invalido avisa', c5.errores.some(function (e) { return /formato no permitido/i.test(e); }), JSON.stringify(c5.errores));
    check('#F5: no creo el selector (no avanzo)', c5.selectores[0].sel === undefined);
    global.SelectorPMU = selPrev;

    /* ---- #N1 (fix 2026-11-24): editar avisa si no se puede traer la imagen ---- */
    grupo('#N1: editar avisa si no se puede abrir la imagen');
    let cerroN1 = false;
    const cN1 = Object.create(CargadorPMU.prototype);
    cN1.config = { ranuras: [{ w: 500, h: 400, forma: 'rectangulo', min: 1, max: 1, gid: '', phsize: 0 }], urlDe: function () { return 'http://x/foto.webp'; } };
    cN1.estado = [{ ids: ['foto-1'] }];
    cN1._urls = {};
    cN1.recetas = {};
    cN1.errores = [];
    cN1._error = function (m) { cN1.errores.push(String(m)); };
    cN1._recetaDeContexto = function () { return null; };
    cN1._abrir = function () { /* el selectores[0].sel ya existe */ };
    cN1.selectores = [{ sel: { close: function () { cerroN1 = true; }, cargarDesdeBiblioteca: function () { return Promise.resolve(false); } } }];
    const okN1 = await cN1._editar(0, 0);
    check('#N1: cargarDesdeBiblioteca resuelve false -> _editar devuelve false', okN1 === false);
    check('#N1: avisa que no se pudo abrir la imagen',
        cN1.errores.some(function (e) { return /no se pudo abrir la imagen/i.test(e); }), JSON.stringify(cN1.errores));
    check('#N1: cierra el editor (no queda vacio)', cerroN1 === true);

    /* ---- Objetivo y mejor receta (T018) ---- */
    grupo('Objetivo y mejor receta');
    const o1 = API.objetivoDe({ w: 300, h: 200, forma: 'rectangulo' });
    check('objetivo 300x200 rect = 1.5000-0-60000', o1.clave === '1.5000-0-60000', o1.clave);
    const o2 = API.objetivoDe({ w: 200, h: 200, forma: 'circulo' });
    check('objetivo 200x200 circulo = 1.0000-1-40000', o2.clave === '1.0000-1-40000', o2.clave);
    const o3 = API.objetivoDe({ w: 300, h: 200, forma: 'ovalo' });
    check('objetivo 300x200 ovalo = 1.5000-1-60000', o3.clave === '1.5000-1-60000', o3.clave);
    const o4 = API.objetivoDe({ w: 300, h: 200, forma: 'cuadrado' });
    check('cuadrado con aspecto != 1 -> familia 0', o4.clave === '1.5000-0-60000', o4.clave);
    const o5 = API.objetivoDe({ w: 0, h: 0, forma: 'auto' });
    check('sin medidas -> 1.0000-0-1', o5.clave === '1.0000-0-1', o5.clave);
    const p1 = API.parseObjetivo('1.5000-0-60000');
    check('parseObjetivo', !!p1 && p1.aspecto === 1.5 && p1.familia === 0 && p1.area === 60000, JSON.stringify(p1));
    check('parseObjetivo invalido', API.parseObjetivo('x') === null);
    check('mejorReceta exacta', API.mejorReceta({ '1.5000-0-60000': { modo: 'cubrir' } }, o1).modo === 'cubrir');
    check('mejorReceta mas cercana por aspecto',
        API.mejorReceta({ '1.0000-1-40000': { modo: 'encajar' }, '1.6000-0-50000': { modo: 'estirar' } }, o1).modo === 'estirar');
    check('mejorReceta sin datos', API.mejorReceta({}, o1) === null);

    console.log('');
    if (fallos === 0) {
        console.log('CARGADOR LOTE OK (' + checks + ' checks)');
        process.exit(0);
    }
    console.log('CARGADOR LOTE FALLA (' + fallos + ' de ' + checks + ')');
    process.exit(1);
})().catch(function (e) {
    console.error('ERROR: ' + (e && e.stack ? e.stack : e));
    process.exit(2);
});