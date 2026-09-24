'use strict';
/**
 * tests/validez.js - Evaluador de validez de la spec 005 (logica pura de
 * assets/tienda.js: compilarValidez/evaluarValidez/filtrarPdfs) contra la
 * MISMA fixture que verifica la fase PHP `validez` (tests/validez-fixture.json).
 *
 *   node tests/validez.js   -> debe decir "VALIDEZ OK"
 *
 * Node corre SOLO en desarrollo (nunca en el servidor productivo).
 */
var PURO = require('../assets/tienda.js');
var fixture = require('./validez-fixture.json');

var fallos = 0;
function check(nombre, cond) {
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre);
    if (!cond) { fallos++; }
}

// 1. Evaluacion de cada caso (campoN = valor de sistema).
fixture.casos.forEach(function (caso) {
    var comp = PURO.compilarValidez(caso.validez);
    var ok = PURO.evaluarValidez(comp, fixture.valores);
    check('js: ' + caso.nombre, ok === caso.evaluacion_js);
});

// 2. Filtrado del producto: elegibles, primer mensaje, bloqueo, orden.
var pdfs = [
    { pdf: 'diseno1-a4', validez: "campo1 === 'libelulas' && campo2 === 'a4'", mensaje_html: '<b>A</b>', bloquear: false },
    { pdf: 'diseno1-legal', validez: "campo1 === 'libelulas' && campo2 === 'legal'", mensaje_html: '<b>B</b>', bloquear: true },
    { pdf: 'diseno2-a4', validez: '', mensaje_html: '', bloquear: false }
];
var res = PURO.filtrarPdfs(pdfs, fixture.valores);
check('filtro: elegibles en orden', res.elegibles.length === 2
    && res.elegibles[0].pdf === 'diseno1-a4' && res.elegibles[1].pdf === 'diseno2-a4');
check('filtro: primer mensaje de la fallida', res.mensaje === '<b>B</b>');
check('filtro: bloquear de la fallida bloquea', res.bloqueo === true);

// 3. 0 elegibles = siempre bloquea (FR-4.2), aunque nada tenga `bloquear`.
var res0 = PURO.filtrarPdfs([{ pdf: 'x', validez: 'campo1 === 1', mensaje_html: '', bloquear: false }], fixture.valores);
check('filtro: 0 elegibles bloquea', res0.bloqueo === true && res0.elegibles.length === 0);

// 4. Fallo de sintaxis/ejecucion = true (nunca rompe la ficha) + sin mensaje.
var resRoto = PURO.filtrarPdfs([{ pdf: 'r', validez: 'campo1 ==', mensaje_html: '', bloquear: true }], fixture.valores);
check('validez rota = true y no bloquea', resRoto.elegibles.length === 1 && resRoto.bloqueo === false);

// 5. Inactivo no llega al filtro: la ficha solo envia asociaciones activas.
check('lista vacia = bloqueo', PURO.filtrarPdfs([], fixture.valores).bloqueo === true);

console.log(fallos ? ('VALIDEZ: ' + fallos + ' fallo(s)') : 'VALIDEZ OK');
process.exit(fallos ? 1 : 0);
