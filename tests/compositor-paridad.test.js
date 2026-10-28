#!/usr/bin/env node
/**
 * Paridad JS <-> PHP de la caja de dibujo (spec 035, T007d).
 *
 * El compositor del servidor y el selector del navegador tienen que calcular LA
 * MISMA caja y el MISMO tamano de salida: si divergen, el PDF no coincide con la
 * vista previa (y "la vista previa es el PDF" deja de ser cierto).
 *
 * La referencia es el JS (`escalaBase`/`escalaSalida`); el PHP se lee por
 * `php tests/compositor.php --json`. No se duplica la matematica aca.
 *
 * Uso: node tests/compositor-paridad.test.js
 */
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const SelectorPMU = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));
const { escalaBase, escalaSalida } = SelectorPMU.puro;

let checks = 0;
let fallos = 0;

function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle) ? '  [' + detalle + ']' : ''));
}

let casos;
try {
    const bruto = execFileSync('php', [path.join(RAIZ, 'tests', 'compositor.php'), '--json'],
        { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    casos = JSON.parse(bruto);
} catch (e) {
    console.error('  FAIL no se pudo leer la matriz del compositor: ' + e.message);
    process.exit(1);
}

console.log('\n== F1: la matriz del compositor llego completa ==');
check('casos recibidos', Array.isArray(casos) && casos.length === 180,
    String(Array.isArray(casos) ? casos.length : 'no-array'));

console.log('\n== F2: caja y salida identicas (tolerancia +-1 px) ==');
let malos = 0;
let peor = 0;
(casos || []).forEach(function (c) {
    const cajaJs = escalaBase(c.modo, c.iw, c.ih, c.W, c.H);
    const salJs = escalaSalida(c.modo, c.iw, c.ih, c.W, c.H, c.escala);
    const dCaja = Math.max(
        Math.abs(cajaJs.dw - c.caja.dw),
        Math.abs(cajaJs.dh - c.caja.dh)
    );
    const dW = Math.abs(salJs.w - c.salida.w);
    const dH = Math.abs(salJs.h - c.salida.h);
    const dK = Math.abs(salJs.k - c.salida.k);
    const peorCaso = Math.max(dCaja, dW, dH);
    if (peorCaso > peor) { peor = peorCaso; }
    if (peorCaso > 1 || dK > 1e-9) {
        malos++;
        if (malos <= 3) {
            console.log('  FAIL ' + c.modo + ' ' + c.iw + 'x' + c.ih + ' en ' + c.W + 'x' + c.H
                + ' @' + c.escala + ': caja ' + dCaja.toFixed(3)
                + ' salida ' + dW + 'x' + dH + ' k ' + dK.toExponential(2));
        }
    }
});
check('180 casos dentro de la tolerancia', malos === 0, malos + ' fuera');
check('la peor diferencia no pasa de 1 px', peor <= 1, peor.toFixed(3));

console.log('\n== F3: los tres modos se distinguen ==');
const cubrir = escalaBase('cubrir', 1600, 1200, 463, 463);
const encajar = escalaBase('encajar', 1600, 1200, 463, 463);
const estirar = escalaBase('estirar', 1600, 1200, 463, 463);
check('cubrir != encajar', cubrir.dw !== encajar.dw);
check('estirar es el marco exacto', estirar.dw === 463 && estirar.dh === 463);
check('cubrir tapa (mayor o igual) y encajar entra (menor o igual)',
    cubrir.dw >= 463 && encajar.dw <= 463);

if (fallos) {
    console.error('\nCOMPOSITOR PARIDAD: ' + fallos + ' fallo(s) de ' + checks);
    process.exit(1);
}
console.log('\nCOMPOSITOR PARIDAD OK (' + checks + ' checks)');
