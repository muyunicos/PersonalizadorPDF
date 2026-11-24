#!/usr/bin/env node
/**
 * cargador-recetas - puerta de "cada foto abre con SU receta" (spec 043, fix 2026-11-22).
 *
 * Reproduce el caso real: un campo con A y B, cada una con su encuadre. Al tocar
 * la miniatura de A tiene que abrir con la receta de A (no con la ultima).
 * Ademas cubre dos fugas de estado: subir con `max` ya lleno y subir con un
 * `_reemplazo` pendiente.
 *
 *   node tests/cargador-recetas.test.js  ->  CARGADOR RECETAS OK (N checks)
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
function grupo(nombre) { console.log('\n== ' + nombre + ' =='); }

/** Cargador minimo: sin DOM, con `_abrir`/`_subir` cortados y registro de lo que paso. */
function cargador(opts) {
    opts = opts || {};
    const c = Object.create(CargadorPMU.prototype);
    c.config = {
        ranuras: [{ w: 500, h: 400, forma: 'rectangulo', min: 1, max: opts.max, gid: '0000ff', phsize: 1 }],
        onRecorte: null,
        onChange: null
    };
    c.estado = [{ ids: (opts.ids || []).slice() }];
    c.recetas = opts.recetas || {};
    c._recortes = {};
    c._urls = opts.urls || {};
    c._reemplazo = opts.reemplazo || null;
    c.errores = [];
    c._pendientes = {};
    c.abiertos = [];
    c.elegidos = [];
    c.subidas = [];
    c._error = function (m) { c.errores.push(String(m)); };
    c._pintar = function () { };
    c._paramsDe = function () { return null; };
    c._quitarPendiente = function () { };
    c._abrir = function (i, archivo, opciones) { c.abiertos.push(opciones || {}); };
    c.selectores = [{
        boton: {},
        sel: {
            ultimaUrl: 'blob:recorte',
            _params: function () { return { v: 2 }; },
            cargarDesdeBiblioteca: function (foto) {
                c.elegidos.push(foto);
                return Promise.resolve(true);
            }
        }
    }];
    return c;
}

(async function () {
    /* ---- 1. Cada miniatura abre con SU receta ---- */
    grupo('Cada foto abre con su receta');
    const pA = { v: 2, w: 500, h: 400, modo: 'cubrir', escala: 1 };
    const pB = { v: 2, w: 500, h: 400, modo: 'cubrir', escala: 2 };
    const c1 = cargador({
        max: 2,
        ids: ['A', 'B'],
        recetas: { A: pA, B: pB },
        urls: { A: 'http://a/original.webp', B: 'http://b/original.webp' }
    });
    await c1._editar(0, 0);
    await c1._editar(0, 1);
    check('A abre con la receta de A', c1.elegidos[0] && c1.elegidos[0].params === pA,
        JSON.stringify(c1.elegidos[0] && c1.elegidos[0].params));
    check('B abre con la receta de B', c1.elegidos[1] && c1.elegidos[1].params === pB,
        JSON.stringify(c1.elegidos[1] && c1.elegidos[1].params));
    check('cada una carga SU imagen', c1.elegidos[0].id === 'A' && c1.elegidos[1].id === 'B',
        c1.elegidos.map((e) => e.id).join(','));
    check('_editar deja el reemplazo apuntando a la posicion', c1._reemplazo && c1._reemplazo.posicion === 1);

    /* ---- 2. Subir con la ranura llena no debe pasar el tope ---- */
    grupo('Subir respeta max');
    const c2 = cargador({ max: 1, ids: ['A'], urls: { A: 'http://a/original.webp' } });
    c2.config.subir = function () { return Promise.resolve({ id: 'B' }); };
    await c2._subir(0, { size: 1 }, null).catch(function () { });
    check('max=1 con A: sigue habiendo 1 sola foto (no [A,B])',
        c2.estado[0].ids.length === 1, JSON.stringify(c2.estado[0].ids));
    check('el tope avisa con causa', c2.errores.length >= 1, JSON.stringify(c2.errores));

    /* ---- 3. Reemplazo pendiente + subir = estado consistente ---- */
    grupo('Reemplazo pendiente');
    const c3 = cargador({
        max: 2,
        ids: ['A', 'B'],
        reemplazo: { indice: 0, posicion: 0, desdeVisor: false },
        urls: { A: 'http://a/original.webp', B: 'http://b/original.webp' }
    });
    c3.config.subir = function () { return Promise.resolve({ id: 'C' }); };
    await c3._subir(0, { size: 1 }, null);
    check('el reemplazo puso C en la posicion 0', c3.estado[0].ids[0] === 'C', JSON.stringify(c3.estado[0].ids));
    check('no se pierde la otra foto', c3.estado[0].ids.length === 2, JSON.stringify(c3.estado[0].ids));
    check('el reemplazo quedo limpio', c3._reemplazo === null);

    /* ---- 4. Imagen nueva: defaults del campo ---- */
    grupo('Imagen nueva sin receta');
    const c4 = cargador({ max: 2, ids: [] });
    c4.config.subir = function (blob, ctx) { c4.ctxSubida = ctx; return Promise.resolve({ id: 'N' }); };
    await c4._subir(0, { size: 1 }, null).catch(function () { });
    check('sin receta previa la imagen nueva usa cubrir (defaults del campo)',
        !!(c4.ctxSubida && c4.ctxSubida.params && c4.ctxSubida.params.modo === 'cubrir'),
        JSON.stringify(c4.ctxSubida && c4.ctxSubida.params));
    check('escala 1 y centro (0.5/0.5)', !!(c4.ctxSubida && c4.ctxSubida.params
        && c4.ctxSubida.params.escala === 1 && c4.ctxSubida.params.ox === 0.5 && c4.ctxSubida.params.oy === 0.5),
        JSON.stringify(c4.ctxSubida && c4.ctxSubida.params));
    check('no manda una receta vacia', !!(c4.ctxSubida && c4.ctxSubida.params
        && Object.keys(c4.ctxSubida.params).length > 3));

    /* ---- 5. Resolvedor: catalogo, ajustes y defaults (P1-5) ---- */
    grupo('Resolvedor: catalogo -> ajustes -> defaults');
    const ranura5 = { w: 500, h: 400, forma: 'rectangulo', min: 1, max: 2, gid: '0000ff', phsize: 0 };
    const pCatalogo = { v: 2, w: 500, h: 400, modo: 'encajar', escala: 1.2 };
    const pAjustes = { v: 2, w: 500, h: 400, modo: 'estirar', escala: 1.1 };
    const c5 = cargador({ max: 2, ids: ['A'], recetas: {} });

    global.PMUBiblioteca = { cache: () => ({ fotos: [{ id: 'A', recetas: { '1.2500-0-200000': pCatalogo } }] }) };
    check('sin memoria cae al catalogo (receta por objetivo)',
        c5._recetaDeContexto('A', ranura5) === pCatalogo);

    global.PMUBiblioteca = { cache: () => ({ fotos: [{ id: 'A', recetas: {}, ajustes: { configuracion: pAjustes } }] }) };
    check('sin receta por objetivo cae a los ajustes del cliente',
        c5._recetaDeContexto('A', ranura5) === pAjustes);

    global.PMUBiblioteca = { cache: () => ({ fotos: [] }) };
    check('sin memoria ni catalogo -> defaults (null)',
        c5._recetaDeContexto('A', ranura5) === null);
    check('sin id -> null (no inventa receta)', c5._recetaDeContexto('', ranura5) === null);

    // paramsDe del selector usa el MISMO resolvedor que el cargador.
    const sel5 = new SelectorPMU(null, {
        finalW: 500, finalH: 400, mode: 'cubrir', forma: 'rectangulo',
        paramsDe: function (id) { return c5._recetaDeContexto(String(id || ''), ranura5); }
    });
    global.PMUBiblioteca = { cache: () => ({ fotos: [{ id: 'A', recetas: { '1.2500-0-200000': pCatalogo } }] }) };
    check('selector: paramsDe resuelve la receta del contexto',
        sel5.config.paramsDe('A') === pCatalogo, JSON.stringify(sel5.config.paramsDe('A')));
    check('selector: paramsDe sin id -> null', sel5.config.paramsDe('') === null);
    /* ---- #receta-item (spec 049): las recetas del item sobreviven F5 ---- */
    grupo('#receta-item: recetas iniciales del item (siembra desde manifest)');
    const pSeed = { v: 2, w: 500, h: 400, modo: 'encajar', escala: 1.3, ox: 0.4, oy: 0.6, rot: 0, phsize: 1, gid: '0000FF' };
    const cSeed = new CargadorPMU(null, {
        ranuras: [{ w: 500, h: 400, forma: 'rectangulo', min: 1, max: 1, gid: '0000ff', phsize: 1 }],
        recetasIniciales: { abc123abc123: pSeed }
    });
    check('#receta-item: el constructor siembra this.recetas desde recetasIniciales',
        cSeed.recetas.abc123abc123 === pSeed, JSON.stringify(cSeed.recetas));
    check('#receta-item: _recetaDeContexto la devuelve sin cache de biblioteca',
        cSeed._recetaDeContexto('abc123abc123', cSeed.config.ranuras[0]) === pSeed);
    const cNoSeed = new CargadorPMU(null, { ranuras: [{ w: 500, h: 400, forma: 'rectangulo', min: 1, max: 1, gid: '0000ff', phsize: 1 }] });
    check('#receta-item: sin recetasIniciales arranca vacio (compat)', Object.keys(cNoSeed.recetas).length === 0);
    // wiring (una capa): PHP expone recetas y tienda las pasa al cargador.
    const pluginSrc = require('fs').readFileSync(require('path').join(RAIZ, 'personalizador-pdf.php'), 'utf8');
    const tiendaSrc = require('fs').readFileSync(require('path').join(RAIZ, 'assets', 'tienda.js'), 'utf8');
    check('#receta-item wiring: PHP expone PMU_FICHA.recetas', /'recetas' => \$recetas,/.test(pluginSrc));
    check('#receta-item wiring: tienda pasa recetasIniciales desde ficha.recetas', /recetasIniciales: \(ficha\.recetas/.test(tiendaSrc));

    delete global.PMUBiblioteca;

    console.log('');
    if (fallos === 0) {
        console.log('CARGADOR RECETAS OK (' + checks + ' checks)');
        process.exit(0);
    }
    console.log('CARGADOR RECETAS FALLA (' + fallos + ' de ' + checks + ')');
    process.exit(1);
})().catch(function (e) {
    console.error('ERROR: ' + (e && e.stack ? e.stack : e));
    process.exit(2);
});