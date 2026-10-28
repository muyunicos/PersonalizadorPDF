#!/usr/bin/env node
/**
 * Contrato de la receta v2 (spec 035, T005).
 *
 * Dos mitades, una por lado (no se duplica la validacion):
 *  - CLIENTE: `_params()` del selector produce las 15 claves de la v2, con `v:2`,
 *    `ox/oy` (centro de dibujo normalizado) y `rot` REAL. Sin `rot`, 90 y 270
 *    producen la misma receta con distinto bitmap (el bug que cierra la 035).
 *  - PARIDAD: la lista de claves del cliente coincide EXACTAMENTE, y en el mismo
 *    orden, con `PMU_Sesion::RECETA_V2_CLAVES`. Si divergen, el hash del servidor
 *    no reconoce la composicion que vio el comprador.
 *
 * La validacion de rangos y el hash viven del lado PHP (`texto_puente.php receta`,
 * T006): aca no se copia esa logica.
 *
 * Uso: node tests/receta-contrato.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SelectorPMU = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));

let checks = 0;
let fallos = 0;

function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle) ? '  [' + detalle + ']' : ''));
}

function grupo(nombre) {
    console.log('\n== ' + nombre + ' ==');
}

/**
 * Instancia MINIMA del selector: solo lo que `_params()` lee. Evita montar el
 * DOM del modal (que es lo que prueba `selector-contrato.test.js`).
 */
function instancia(extra) {
    const s = Object.create(SelectorPMU.prototype);
    s.config = Object.assign({
        finalW: 500, finalH: 500, forma: 'rectangulo', mode: 'cubrir',
        transp: '', phsize: 1, gid: '0000FF'
    }, (extra && extra.config) || {});
    s.zoom = (extra && extra.zoom) || 1;
    s.rotacion = (extra && extra.rotacion) || 0;
    s.desplazamiento = (extra && extra.desplazamiento) || { x: 0, y: 0 };
    s.colorFondo = (extra && extra.colorFondo) || 'transparent';
    s.geo = null;
    s._dimensionesImagen = function () {
        const w = 1600;
        const h = 1200;
        return (Math.abs(s.rotacion % 180) === 90) ? { w: h, h: w } : { w: w, h: h };
    };
    return s;
}

// ---------------------------------------------------------------------------
grupo('F1: la receta del cliente es la v2 completa');
// ---------------------------------------------------------------------------

const p = instancia()._params();

check('v es 2', p.v === 2, String(p.v));
check('trae las 15 claves', Object.keys(p).length === 15, String(Object.keys(p).length));
check('ox/oy son numeros', typeof p.ox === 'number' && typeof p.oy === 'number',
    typeof p.ox + '/' + typeof p.oy);
check('sin desplazamiento ni zoom el centro es el del lienzo',
    Math.abs(p.ox - 0.5) < 1e-6 && Math.abs(p.oy - 0.5) < 1e-6, p.ox + ',' + p.oy);
check('el lienzo sale de finalW/finalH', p.w === 500 && p.h === 500, p.w + 'x' + p.h);
check('iw/ih son las dimensiones de la foto', p.iw === 1600 && p.ih === 1200,
    p.iw + 'x' + p.ih);
check('phsize y gid viajan en la receta', p.phsize === 1 && p.gid === '0000FF',
    p.phsize + '/' + p.gid);

// ---------------------------------------------------------------------------
grupo('F2: rot 90 y 270 NO pueden dar la misma receta');
// ---------------------------------------------------------------------------

const r0 = instancia({ rotacion: 0 })._params();
const r90 = instancia({ rotacion: 90 })._params();
const r270 = instancia({ rotacion: 270 })._params();

check('rot 0 viaja como 0', r0.rot === 0, String(r0.rot));
check('rot 90 viaja como 90', r90.rot === 90, String(r90.rot));
check('rot 270 viaja como 270', r270.rot === 270, String(r270.rot));
check('90 y 270 se distinguen (el bug de la 030 queda cerrado)',
    JSON.stringify(r90) !== JSON.stringify(r270));
check('girar 90 intercambia iw/ih (la foto se mide ya rotada)',
    r90.iw === 1200 && r90.ih === 1600, r90.iw + 'x' + r90.ih);

// ---------------------------------------------------------------------------
grupo('F3: el centro sigue al desplazamiento y a la Escala');
// ---------------------------------------------------------------------------

const desplazado = instancia({ desplazamiento: { x: 50, y: -25 } })._params();
check('el desplazamiento mueve ox/oy',
    desplazado.ox !== p.ox && desplazado.oy !== p.oy,
    desplazado.ox + ',' + desplazado.oy);
check('el desplazamiento se escala por la Escala (punto fijo del zoom)',
    Math.abs(instancia({ desplazamiento: { x: 50, y: 0 } })._params().ox - 0.6) < 1e-6
    && Math.abs(instancia({ desplazamiento: { x: 50, y: 0 }, zoom: 2 })._params().ox - 0.7) < 1e-6,
    'zoom1=' + instancia({ desplazamiento: { x: 50, y: 0 } })._params().ox
    + ' zoom2=' + instancia({ desplazamiento: { x: 50, y: 0 }, zoom: 2 })._params().ox);
check('la Escala viaja en la receta',
    instancia({ zoom: 2 })._params().escala === 2,
    String(instancia({ zoom: 2 })._params().escala));

// ---------------------------------------------------------------------------
grupo('F4: paridad de claves con el servidor (si divergen, el hash no cierra)');
// ---------------------------------------------------------------------------

const php = fs.readFileSync(path.join(RAIZ, 'inc', 'class-pmu-sesion.php'), 'utf8');
const bloque = php.match(/const RECETA_V2_CLAVES = \[([\s\S]*?)\];/);
const clavesPhp = bloque
    ? (bloque[1].match(/'([a-z]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); })
    : [];

check('el PHP declara RECETA_V2_CLAVES', clavesPhp.length === 15, String(clavesPhp.length));
check('mismas claves y mismo orden que el cliente',
    JSON.stringify(clavesPhp) === JSON.stringify(Object.keys(p)),
    'php=' + clavesPhp.join(',') + ' js=' + Object.keys(p).join(','));
check('el hash del servidor usa las 15 (receta_de recorre la constante)',
    /foreach \(self::RECETA_V2_CLAVES as \$k\)/.test(php));
check('el servidor valida v === 2 (no acepta la v1 como identidad)',
    /motor:receta:v/.test(php));

// ---------------------------------------------------------------------------
grupo('F5: el cliente NO inventa el hash (lo calcula el servidor)');
// ---------------------------------------------------------------------------

const selectorSrc = fs.readFileSync(path.join(RAIZ, 'assets', 'selector-pmu.js'), 'utf8');
const ini = selectorSrc.indexOf('SelectorPMU.prototype._params');
const fin = selectorSrc.indexOf('SelectorPMU.prototype._dimensionesImagen');
check('_params no calcula ningun hash', !/sha1|sha256|createHash/.test(selectorSrc.slice(ini, fin)));
check('la receta viaja como params (el servidor recomputa)',
    /receta_de\(\$params\)/.test(fs.readFileSync(path.join(RAIZ, 'personalizador-pdf.php'), 'utf8')));

// ---------------------------------------------------------------------------
if (fallos) {
    console.error('\nRECETA CONTRATO: ' + fallos + ' fallo(s) de ' + checks);
    process.exit(1);
}
console.log('\nRECETA CONTRATO OK (' + checks + ' checks)');
