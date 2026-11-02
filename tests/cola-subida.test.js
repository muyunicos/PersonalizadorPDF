'use strict';
/**
 * tests/cola-subida.test.js - Cola de subida del comprador (spec 036, D9):
 * concurrencia acotada, orden FIFO, dedupe por contenido y "ultima version
 * manda" (re-subir un texto del mismo grupo/instancia reemplaza el anterior).
 *
 *   node tests/cola-subida.test.js   -> debe decir "COLA SUBIDA OK (N checks)"
 *
 * Esqueleto (T003): los checks llegan con la fase US3 de la spec 036.
 * Node corre SOLO en desarrollo (nunca en el servidor productivo).
 */

let fallos = 0;
let checks = 0;
function check(nombre, cond, dato) {
    const extra = (dato === undefined || dato === '') ? '' : '  [' + dato + ']';
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre + extra);
    checks++;
    if (!cond) { fallos++; }
}

// ---------------------------------------------------------------------------
// TODO (US3): concurrencia acotada / orden FIFO / dedupe / ultima version
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// == 0: predicado unico "completo" (spec 036, T006/R9) ==
// ---------------------------------------------------------------------------
const PURO = require('../assets/tienda.js');
check('sin estado = completo (nada que esperar)', PURO.estaCompleto() === true);
check('un hueco sin completar NO esta completo', PURO.estaCompleto({ faltanFotos: 1 }) === false);
check('una subida en vuelo NO esta completo', PURO.estaCompleto({ subidas: 2 }) === false);
check('validez que rechaza NO esta completo', PURO.estaCompleto({ validez: false }) === false);
check('todo subido + sin faltantes + validez OK = completo',
    PURO.estaCompleto({ faltanFotos: 0, subidas: 0, validez: true }) === true);

console.log('\nCOLA SUBIDA OK (' + checks + ' checks)');
if (fallos) { process.exit(1); }