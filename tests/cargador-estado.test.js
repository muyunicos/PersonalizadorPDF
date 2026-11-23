#!/usr/bin/env node
/**
 * cargador-estado - puerta del estado entre aperturas (spec 045, A1/A2).
 *
 * A1: `_usarExistente` (guardado de 0 bytes, spec 043) tiene que honrar el
 *     contexto de reemplazo: si `_reemplazo` esta cargado, el id va a ESA
 *     posicion y el contexto se limpia. Si no, la siguiente foto nueva pisa la
 *     editada en vez de agregarse.
 * A2: `open()` arranca con estado visual limpio: la instancia del selector se
 *     reutiliza por ranura, asi que sin reset se ve la foto anterior.
 *
 * No monta el DOM: usa instancias minimas (Object.create + stubs), como
 * `receta-contrato.test.js`.
 *
 * Uso: node tests/cargador-estado.test.js
 */
'use strict';

const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
require(path.join(RAIZ, 'assets', 'receta-objetivo.js'));
const CargadorPMU = require(path.join(RAIZ, 'assets', 'cargador-pmu.js')).CargadorPMU;
const SelectorPMU = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));

let checks = 0;
let fallos = 0;

function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}

function grupo(nombre) {
    console.log('\n== ' + nombre + ' ==');
}

/** Cargador minimo: sin DOM, con `_pintar`/`_abrirVisorCompartido` cortados. */
function cargador(ids, ranuras) {
    const c = Object.create(CargadorPMU.prototype);
    c.config = {
        ranuras: ranuras || [{ w: 100, h: 100, min: 1, max: 2, forma: 'rectangulo' }],
        onRecorte: null
    };
    c.estado = [{ ids: ids.slice() }];
    c._urls = {};
    c.recetas = {};
    c._reemplazo = null;
    c.visorAbierto = [];
    c._pintar = function () { };
    c._abrirVisorCompartido = function (indice, posicion) {
        c.visorAbierto.push([indice, posicion]);
        return Promise.resolve(true);
    };
    return c;
}

/** `_usarExistente` sin que un rechazo corte la corrida (queremos ver todos). */
async function usar(c, indice, id, params, url) {
    try {
        return { ok: true, id: await c._usarExistente(indice, id, params, url) };
    } catch (e) {
        return { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
}

(async function () {
    /* ---- A1: reemplazo de 0 bytes ---- */
    grupo('A1: usarExistente con _reemplazo cargado');

    // 1) reemplazo en la posicion 0 (el caso del bug: editas A y guardas).
    let c = cargador(['aaaaaaaaaaaa']);
    c._reemplazo = { indice: 0, posicion: 0, desdeVisor: false };
    const r1 = await usar(c, 0, 'bbbbbbbbbbbb', { w: 100, h: 100 }, 'url-b');
    check('A1.1 no rechaza con la ranura llena', r1.ok === true, r1.error);
    check('A1.1 el id reemplaza en la posicion (no se agrega)',
        c.estado[0].ids.length === 1 && c.estado[0].ids[0] === 'bbbbbbbbbbbb',
        JSON.stringify(c.estado[0].ids));
    check('A1.1 devuelve el id', r1.id === 'bbbbbbbbbbbb');
    check('A1.1 limpia `_reemplazo`', c._reemplazo === null,
        JSON.stringify(c._reemplazo));

    // 2) reemplazo en la posicion 1 (tira con dos).
    c = cargador(['aaaaaaaaaaaa', 'cccccccccccc']);
    c._reemplazo = { indice: 0, posicion: 1, desdeVisor: false };
    const r2 = await usar(c, 0, 'dddddddddddd', null, 'url-d');
    check('A1.2 no rechaza con la ranura llena', r2.ok === true, r2.error);
    check('A1.2 el id va a la posicion indicada',
        c.estado[0].ids.length === 2 && c.estado[0].ids[1] === 'dddddddddddd',
        JSON.stringify(c.estado[0].ids));
    check('A1.2 limpia `_reemplazo`', c._reemplazo === null);

    // 3) sin reemplazo: agrega al final (comportamiento historico).
    c = cargador(['aaaaaaaaaaaa']);
    const r3 = await usar(c, 0, 'bbbbbbbbbbbb', null, null);
    check('A1.3 sin `_reemplazo` agrega al final',
        c.estado[0].ids.length === 2 && c.estado[0].ids[1] === 'bbbbbbbbbbbb',
        JSON.stringify(c.estado[0].ids));
    check('A1.3 no inventa un reemplazo', c._reemplazo === null);

    // 4) `_reemplazo` de OTRA ranura: no se toca.
    c = cargador(['aaaaaaaaaaaa'], [
        { w: 100, h: 100, min: 1, max: 2, forma: 'rectangulo' },
        { w: 100, h: 100, min: 1, max: 2, forma: 'rectangulo' }
    ]);
    c.estado = [{ ids: ['aaaaaaaaaaaa'] }, { ids: [] }];
    c._reemplazo = { indice: 1, posicion: 0, desdeVisor: false };
    const r4 = await usar(c, 0, 'bbbbbbbbbbbb', null, null);
    check('A1.4 no rechaza', r4.ok === true, r4.error);
    check('A1.4 no pisa el reemplazo de otra ranura',
        c.estado[0].ids.length === 2 && c._reemplazo !== null
        && c._reemplazo.indice === 1,
        JSON.stringify({ ids: c.estado[0].ids, rep: c._reemplazo }));

    // 5) reemplazo desde el visor: reabre el visor y limpia.
    c = cargador(['aaaaaaaaaaaa']);
    c._reemplazo = { indice: 0, posicion: 0, desdeVisor: true };
    const r5 = await usar(c, 0, 'bbbbbbbbbbbb', null, 'url-b');
    check('A1.5 no rechaza', r5.ok === true, r5.error);
    check('A1.5 desde el visor: reabre el visor',
        c.visorAbierto.length === 1 && c.visorAbierto[0][0] === 0,
        JSON.stringify(c.visorAbierto));
    check('A1.5 desde el visor: limpia `_reemplazo`', c._reemplazo === null);
    /* ---- B1: el visor usa la URL ya resuelta ---- */
    grupo('B1: _abrirVisorCompartido con foto de la biblioteca');

    let visto = null;
    global.PMUVisor = {
        abrir: function (opts) { visto = opts; return true; },
        cerrar: function () { },
        confirmar: function () { return Promise.resolve(false); }
    };

    // 1) URL memoizada (foto usada/al editar): el pool del item no la tiene.
    c = cargador(['aaaaaaaaaaaa']);
    c._abrirVisorCompartido = CargadorPMU.prototype._abrirVisorCompartido; // metodo real
    c._urls = { aaaaaaaaaaaa: 'url-original' };
    c.config.urlDe = function () { return Promise.resolve(''); };
    await c._abrirVisorCompartido(0, 0);
    check('B1.1 abre con la URL ya resuelta (no el pool)',
        !!visto && visto.items.length === 1 && visto.items[0].url === 'url-original',
        JSON.stringify(visto && visto.items));
    check('B1.1 deja la URL memoizada', c._urls.aaaaaaaaaaaa === 'url-original');

    // 2) Sin memo: cae al pool y lo memoiza.
    visto = null;
    c = cargador(['bbbbbbbbbbbb']);
    c._abrirVisorCompartido = CargadorPMU.prototype._abrirVisorCompartido; // metodo real
    c.config.urlDe = function (id) { return Promise.resolve('url-pool-' + id); };
    await c._abrirVisorCompartido(0, 0);
    check('B1.2 sin memo usa el pool y lo memoiza',
        !!visto && visto.items[0].url === 'url-pool-bbbbbbbbbbbb'
        && c._urls.bbbbbbbbbbbb === 'url-pool-bbbbbbbbbbbb',
        JSON.stringify(visto && visto.items));

    delete global.PMUVisor;

    /* ---- A2: reset de estado ---- */
    grupo('A2: `_resetEstado` del selector');

    check('A2.1 el selector expone `_resetEstado`',
        typeof SelectorPMU.prototype._resetEstado === 'function');

    const s = Object.create(SelectorPMU.prototype);
    s.imagen = { src: 'blob:vieja' };
    s.archivoOrigen = { name: 'vieja.png' };
    s.ultimoBlob = 'blob-viejo';
    s.ultimaUrl = 'blob:url-vieja';
    s.desplazamiento = { x: 12, y: -7 };
    s.zoom = 2.5;
    s.rotacion = 90;
    s.colorFondo = '#123456';
    s.fondoAuto = '#654321';
    s.fondoEsAuto = false;
    s._mascaraRecorte = true;
    s._bib = { id: 'aaaaaaaaaaaa', params: {} };
    s._desdeBiblioteca = true;
    s.supera5 = true;
    s.raiz = null;
    s._onKey = function () { };
    s._focoPrevio = { focus: function () { } };

    if (typeof s._resetEstado === 'function') {
        s._resetEstado();
    }
    check('A2.2 no queda imagen anterior', s.imagen === null, String(s.imagen));
    check('A2.2 no queda blob anterior',
        s.ultimoBlob === null && s.ultimaUrl === null,
        s.ultimoBlob + '/' + s.ultimaUrl);
    check('A2.2 no queda `_bib`', s._bib === null);
    check('A2.2 no queda `_desdeBiblioteca`', s._desdeBiblioteca === false);
    check('A2.2 zoom/rotacion/desp vuelven al inicio',
        s.zoom === 1 && s.rotacion === 0
        && s.desplazamiento.x === 0 && s.desplazamiento.y === 0);
    check('A2.2 fondo y mascara al default',
        s.colorFondo === '#ffffff' && s.fondoEsAuto === true
        && s._mascaraRecorte === false);
    check('A2.2 no toca manejadores ni foco',
        typeof s._onKey === 'function' && !!s._focoPrevio);

    console.log('');
    if (fallos === 0) {
        console.log('CARGADOR ESTADO OK (' + checks + ' checks)');
        process.exit(0);
    }
    console.log('CARGADOR ESTADO FALLA (' + fallos + ' de ' + checks + ')');
    process.exit(1);
})().catch(function (e) {
    console.error('ERROR: ' + (e && e.stack ? e.stack : e));
    process.exit(2);
});