#!/usr/bin/env node
/**
 * receta-objetivo - puerta del modulo compartido de helpers (spec 044, US1).
 *
 * Verifica los helpers Puros y que `cargador-pmu.js` / `selector-pmu.js` deleguen
 * en `global.PMURecetaObjetivo` cuando el modulo esta cargado.
 *
 * Uso: node tests/receta-objetivo.test.js
 */
'use strict';

const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const API = require(path.join(RAIZ, 'assets', 'receta-objetivo.js'));

let checks = 0;
let fallos = 0;
function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}
function grupo(nombre) { console.log('\n== ' + nombre + ' =='); }

grupo('Helpers compartidos');
check('objetivoDe 300x200 rect', API.objetivoDe({ w: 300, h: 200, forma: 'rectangulo' }).clave === '1.5000-0-60000');
check('objetivoDe 200x200 circulo', API.objetivoDe({ w: 200, h: 200, forma: 'circulo' }).clave === '1.0000-1-40000');
check('objetivoDe 300x200 ovalo', API.objetivoDe({ w: 300, h: 200, forma: 'ovalo' }).clave === '1.5000-1-60000');
check('objetivoDe sin medidas', API.objetivoDe({}).clave === '1.0000-0-1');
const p = API.parseObjetivo('1.5000-0-60000');
check('parseObjetivo', !!p && p.aspecto === 1.5 && p.familia === 0 && p.area === 60000, JSON.stringify(p));
check('parseObjetivo invalido', API.parseObjetivo('x') === null);
check('mejorReceta exacta', API.mejorReceta({ '1.5000-0-60000': { modo: 'cubrir' } }, API.objetivoDe({ w: 300, h: 200 })).modo === 'cubrir');
check('mejorReceta mas cercana', API.mejorReceta({ '1.0000-1-40000': { modo: 'encajar' }, '1.6000-0-50000': { modo: 'estirar' } }, API.objetivoDe({ w: 300, h: 200 })).modo === 'estirar');
check('mejorReceta sin datos', API.mejorReceta({}, API.objetivoDe({ w: 300, h: 200 })) === null);

grupo('Delegacion de los consumidores');
const spy = {
    objetivoDe: function () { return 'spy-objetivo'; },
    parseObjetivo: function () { return 'spy-parse'; },
    mejorReceta: function () { return 'spy-mejor'; }
};
global.PMURecetaObjetivo = spy;
const API_C = require(path.join(RAIZ, 'assets', 'cargador-pmu.js'));
check('cargador-pmu delega objetivoDe', API_C.objetivoDe({ w: 10, h: 10 }) === 'spy-objetivo');
const SelectorPMU = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));
check('selector-pmu delega objetivoDe', SelectorPMU.puro.objetivoDe({ w: 10, h: 10 }) === 'spy-objetivo');
check('selector-pmu delega parseObjetivo', SelectorPMU.puro.parseObjetivo('x') === 'spy-parse');
check('selector-pmu delega mejorReceta', SelectorPMU.puro.mejorReceta({}, {}) === 'spy-mejor');

console.log('');
if (fallos === 0) {
    console.log('RECETA OBJETIVO OK (' + checks + ' checks)');
    process.exit(0);
}
console.log('RECETA OBJETIVO FALLA (' + fallos + ' de ' + checks + ')');
process.exit(1);