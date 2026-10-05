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

// D17/D18/D19: conciliarGrupo NUNCA bloquea. `nota` es un informe.
// Sin listas: un valor replicado en las M instancias.
var r1 = PURO.conciliarGrupo({ id: '0000FF', value: '[campo1]', cont: 1 }, { 1: { valor: 'Ana' } });
assert.deepStrictEqual(r1, { textos: ['Ana'], nota: '' });

// conciliarGrupo: value literal sin plantilla.
var r2 = PURO.conciliarGrupo({ id: '0000FF', value: 'Fijo', cont: 1 }, {});
assert.deepStrictEqual(r2, { textos: ['Fijo'], nota: '' });

// repetir sin array: el valor unico se replica en las M instancias.
var r3 = PURO.conciliarGrupo({ id: 'FF0000', value: 'Si', cont: 3, repetir: true }, {});
assert.strictEqual(r3.nota, '');
assert.deepStrictEqual(r3.textos, ['Si', 'Si', 'Si']);

// array N == M: un texto por instancia.
var r4 = PURO.conciliarGrupo(
    { id: '00FF00', value: '[campo1]', cont: 2, repetir: true },
    { 1: { valor: ['A', 'B'] } }
);
assert.strictEqual(r4.nota, '');
assert.deepStrictEqual(r4.textos, ['A', 'B']);

// N < M CON `repetir`: el indice CICLA (antes bloqueaba la compra).
var r5 = PURO.conciliarGrupo(
    { id: '00FF00', value: '[campo1]', cont: 6, repetir: true },
    { 1: { valor: ['A', 'B', 'C', 'D'] } }
);
assert.deepStrictEqual(r5.textos, ['A', 'B', 'C', 'D', 'A', 'B']);
assert.strictEqual(r5.nota, '', 'con repetir no queda nada sin completar');

// N < M con `repetir` y UN solo valor: el mismo en todas (antes bloqueaba).
var r5b = PURO.conciliarGrupo(
    { id: '00FF00', value: '[campo1]', cont: 3, repetir: true },
    { 1: { valor: ['Solo'] } }
);
assert.deepStrictEqual(r5b.textos, ['Solo', 'Solo', 'Solo']);
assert.strictEqual(r5b.nota, '');

// N < M SIN `repetir`: las sobrantes quedan VACIAS y se INFORMA, sin bloquear.
var r5c = PURO.conciliarGrupo(
    { id: '00FF00', value: '[campo1]', cont: 4 },
    { 1: { valor: ['A', 'B'] } }
);
assert.deepStrictEqual(r5c.textos, ['A', 'B', '', '']);
assert.notStrictEqual(r5c.nota, '', 'informa las 2 espacios libres');
assert.strictEqual(r5c.nota.indexOf('Iguala'), -1, 'no exige completar antes de comprar');
assert.strictEqual(r5c.nota.indexOf('antes de continuar'), -1, 'no frena la compra');

// array sin `repetir`: tambien entra al loop (FR-4.3).
var r6 = PURO.conciliarGrupo(
    { id: '00FF00', value: 'N: [campo1]', cont: 2 },
    { 1: { valor: ['X', 'Y'] } }
);
assert.strictEqual(r6.nota, '');
assert.deepStrictEqual(r6.textos, ['N: X', 'N: Y']);

// hash de regeneracion (formato del contrato sesion-item.md).
assert.strictEqual(PURO.hashRender('Ana', 'neon-glow', '', 300, 200), 'Ana|neon-glow||300x200');

// ===== Spec 015 (T013-T017): overrides que funcionan =====

// T013: fusion EN ORDEN; el ultimo pisa al anterior (D3). Cada valor es un
// JSON.stringify de overrides publicado por el campo (D4).
var ov1 = PURO.resolverOverrides('[campo1] [campo2]', {
    1: { valor: JSON.stringify({ shadow: { outer: { active: true, size: 0.18 } } }) },
    2: { valor: JSON.stringify({ shadow: { outer: { size: 0.32 } }, fill: { color: '#ff0000' } }) }
});
assert.strictEqual(ov1.avisos.length, 0, 'sin avisos con referencias validas');
assert.deepStrictEqual(ov1.overrides, {
    shadow: { outer: { active: true, size: 0.32 } },   // size: 0.32 pisa a 0.18; active se conserva
    fill: { color: '#ff0000' }
});
assert.strictEqual(ov1.clave, JSON.stringify(ov1.overrides), 'la clave ES el JSON fusionado');

// Sin referencias: sin overrides, sin clave y sin avisos.
var ovVacia = PURO.resolverOverrides('', { 1: { valor: '{}' } });
assert.strictEqual(ovVacia.overrides, null);
assert.strictEqual(ovVacia.clave, '');
assert.strictEqual(ovVacia.avisos.length, 0);

// T015 / FR-004: JSON invalido descarta SOLO ese override, con aviso, y el
// resto se aplica. Nunca una excepcion.
var ov2 = PURO.resolverOverrides('[campo1] [campo2]', {
    1: { valor: 'no es json {' },
    2: { valor: JSON.stringify({ shadow: { outer: { size: 0.5 } } }) }
});
assert.strictEqual(ov2.avisos.length, 1, 'un aviso por el JSON invalido');
assert.deepStrictEqual(ov2.overrides, { shadow: { outer: { size: 0.5 } } }, 'el valido sigue');
// Valor que parsea pero NO es objeto (array / string / null): tambien se descarta.
var ov3 = PURO.resolverOverrides('[campo1] [campo2] [campo3]', {
    1: { valor: '[1,2]' }, 2: { valor: '"texto"' }, 3: { valor: JSON.stringify({ a: 1 }) }
});
assert.strictEqual(ov3.avisos.length, 2, 'array y string descartados');
assert.deepStrictEqual(ov3.overrides, { a: 1 });

// FR-001: texto literal en settings se descarta con aviso (nunca se manda).
var ov4 = PURO.resolverOverrides('[campo1] hola', { 1: { valor: JSON.stringify({ a: 1 }) } });
assert.strictEqual(ov4.avisos.length, 1, 'aviso por texto literal');
assert.deepStrictEqual(ov4.overrides, { a: 1 }, 'la referencia igual se resuelve');
// Referencia a un campo que no esta en el panel: aviso, sin excepcion.
var ov5 = PURO.resolverOverrides('[campo9]', {});
assert.strictEqual(ov5.overrides, null);
assert.strictEqual(ov5.avisos.length, 1);

// T016 / FR-005: el hash CAMBIA con los overrides; SIN overrides la cadena es
// la del contrato viejo (compatibilidad con pools existentes).
var conOv = PURO.hashRender('Ana', 'neon-glow', '', 300, 200, ov1.clave);
assert.strictEqual(conOv, 'Ana|neon-glow||300x200|' + ov1.clave);
assert.notStrictEqual(conOv, PURO.hashRender('Ana', 'neon-glow', '', 300, 200));
assert.notStrictEqual(
    PURO.hashRender('Ana', 'neon-glow', '', 300, 200, '{"a":1}'),
    PURO.hashRender('Ana', 'neon-glow', '', 300, 200, '{"a":2}')
);

// T017 / FR-006: un `valor` objeto en `value` NUNCA da "[object Object]":
// se omite del texto y viaja aviso en `nota`.
var rObj = PURO.conciliarGrupo(
    { id: '0000FF', value: 'Hola [campo1]', cont: 1 },
    { 1: { valor: { shadow: { outer: {} } } } }   // objeto crudo, no string
);
assert.strictEqual(rObj.textos[0], 'Hola ', 'el objeto se omite, no se imprime');
assert.strictEqual(rObj.nota.indexOf('[object Object]'), -1);
assert.ok(rObj.nota.indexOf('[campo1]') !== -1, 'el aviso nombra al campo');
// resolverPlantilla directo con canal de avisos.
var avisosDirectos = [];
PURO.resolverPlantilla('[campo1]', { 1: { valor: { a: 1 } } }, undefined, avisosDirectos);
assert.strictEqual(avisosDirectos.length, 1);

console.log('CONCILIACION OK');
