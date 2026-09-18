'use strict';
/**
 * tests/conciliacion.js - Logica pura de assets/tienda.js (spec 004, T014b):
 * plantillas [campoN], conciliacion N != M y hash de regeneracion.
 * Node corre SOLO en desarrollo (nunca en el servidor productivo).
 */
var assert = require('assert');
var PURO = require('../assets/tienda.js');

// resolverPlantilla: sustituye [campoN] por el valor dual del campo.
assert.strictEqual(
    PURO.resolverPlantilla('Hola [campo1], saludos [campo2]', { 1: { valor: 'Ana' }, 2: { valor: 'B' } }),
    'Hola Ana, saludos B'
);
assert.strictEqual(PURO.resolverPlantilla('x [campo9]', {}), 'x ');
assert.strictEqual(PURO.resolverPlantilla('', {}), '');

// conciliarGrupo: valor escalar, una sola instancia (sin loop).
var r1 = PURO.conciliarGrupo({ id: '0000FF', value: '[campo1]', cont: 1 }, { 1: { valor: 'Ana' } });
assert.deepStrictEqual(r1, { textos: ['Ana'], aviso: '' });

// conciliarGrupo: value literal sin plantilla.
var r2 = PURO.conciliarGrupo({ id: '0000FF', value: 'Fijo', cont: 1 }, {});
assert.deepStrictEqual(r2, { textos: ['Fijo'], aviso: '' });

// repetir sin array: el valor unico se replica en las M instancias.
var r3 = PURO.conciliarGrupo({ id: 'FF0000', value: 'Si', cont: 3, repetir: true }, {});
assert.strictEqual(r3.aviso, '');
assert.deepStrictEqual(r3.textos, ['Si', 'Si', 'Si']);

// array N == M: un texto por instancia.
var r4 = PURO.conciliarGrupo(
    { id: '00FF00', value: '[campo1]', cont: 2, repetir: true },
    { 1: { valor: ['A', 'B'] } }
);
assert.strictEqual(r4.aviso, '');
assert.deepStrictEqual(r4.textos, ['A', 'B']);

// array N != M: BLOQUEA (textos vacios + aviso); nunca PDF a medias.
var r5 = PURO.conciliarGrupo(
    { id: '00FF00', value: '[campo1]', cont: 3, repetir: true },
    { 1: { valor: ['A', 'B'] } }
);
assert.deepStrictEqual(r5.textos, []);
assert.notStrictEqual(r5.aviso, '');

// array sin `repetir`: tambien entra al loop (FR-4.3).
var r6 = PURO.conciliarGrupo(
    { id: '00FF00', value: 'N: [campo1]', cont: 2 },
    { 1: { valor: ['X', 'Y'] } }
);
assert.strictEqual(r6.aviso, '');
assert.deepStrictEqual(r6.textos, ['N: X', 'N: Y']);

// hash de regeneracion (formato del contrato sesion-item.md).
assert.strictEqual(PURO.hashRender('Ana', 'neon-glow', '', 300, 200), 'Ana|neon-glow||300x200');

console.log('CONCILIACION OK');
