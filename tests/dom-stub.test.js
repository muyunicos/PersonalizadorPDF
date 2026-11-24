#!/usr/bin/env node
/**
 * dom-stub.test - auto-prueba del helper de DOM (spec 048, T003).
 *
 *   node tests/dom-stub.test.js  ->  DOM STUB OK (N checks)
 */
'use strict';

const { crearDocumento } = require('./_util/dom-stub.js');

let checks = 0;
let fallos = 0;
function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FALLA ') + nombre
        + ((!cond && detalle !== undefined) ? '  [' + detalle + ']' : ''));
}

const doc = crearDocumento();

/* ---- Crear y arbol ---- */
const div = doc.createElement('div');
div.id = 'caja';
doc.body.appendChild(div);
check('createElement + appendChild', doc.body.childNodes.length === 1 && doc.body.childNodes[0] === div);
check('parentNode queda asignado', div.parentNode === doc.body);
check('getElementById lo encuentra', doc.getElementById('caja') === div);

const hijo = doc.createElement('span');
div.appendChild(hijo);
check('anidado: querySelector por tag', div.querySelector('span') === hijo);
check('querySelector por id (desde body)', doc.body.querySelector('#caja') === div);

/* ---- classList / dataset / estilos ---- */
div.className = 'a b';
check('classList.contains', div.classList.contains('a') && div.classList.contains('b'));
div.classList.add('c');
check('classList.add', div.classList.contains('c') && div.className.indexOf('c') !== -1);
div.classList.remove('a');
check('classList.remove', !div.classList.contains('a'));
check('classList.toggle', div.classList.toggle('d') === true && div.classList.contains('d'));
div.setAttribute('data-id', '42');
check('dataset desde data-*', div.dataset.id === '42');
div.style.width = '10px';
check('style es un objeto libre', div.style.width === '10px');

/* ---- innerHTML ---- */
div.innerHTML = '';
check('innerHTML = "" limpia los hijos', div.childNodes.length === 0);

/* ---- Eventos ---- */
let vistos = 0;
const boton = doc.createElement('button');
boton.addEventListener('click', function () { vistos++; });
boton.click();
check('addEventListener + click', vistos === 1, 'vistos=' + vistos);

/* ---- Busqueda profunda ---- */
const cont = doc.createElement('div');
const a = doc.createElement('p');
a.className = 'x';
const b = doc.createElement('p');
b.className = 'x y';
cont.appendChild(a);
cont.appendChild(b);
check('querySelectorAll por clase (2)', cont.querySelectorAll('.x').length === 2, String(cont.querySelectorAll('.x').length));
check('querySelector devuelve el primero', cont.querySelector('.y') === b);

/* ---- closest ---- */
check('closest sube hasta el ancestro', b.closest('.x') === b && a.closest('p') === a);
check('closest sin coincidencia -> null', a.closest('.no-existe') === null);

/* ---- Medidas ---- */
cont.clientWidth = 120;
check('clientWidth + getBoundingClientRect', cont.getBoundingClientRect().width === 120);

/* ---- Texto ---- */
const t = doc.createTextNode('hola');
check('createTextNode', t.textContent === 'hola');

console.log('');
if (fallos === 0) {
    console.log('DOM STUB OK (' + checks + ' checks)');
    process.exit(0);
}
console.log('DOM STUB FALLA (' + fallos + ' de ' + checks + ')');
process.exit(1);