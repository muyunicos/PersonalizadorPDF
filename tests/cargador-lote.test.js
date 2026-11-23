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