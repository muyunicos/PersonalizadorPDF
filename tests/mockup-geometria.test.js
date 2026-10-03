/**
 * tests/mockup-geometria.test.js - Geometria pura del editor de mockups (spec 011, R4).
 *
 * Sin framework y sin DOM: las funciones de `assets/mockup-geometria.js` son
 * puras justamente para poder verificar aceros, limites y proporciones sin
 * navegador. Ejecutar: `node tests/mockup-geometria.test.js`.
 */
'use strict';

var G = require('../assets/mockup-geometria.js');

var fallos = 0;
var total = 0;

function check(nombre, condicion) {
    total++;
    if (!condicion) {
        fallos++;
        console.log('FALLA: ' + nombre);
    }
}

function igual(nombre, obtenido, esperado) {
    var ok = Math.abs(obtenido - esperado) < 0.001;
    check(nombre + ' (obtenido ' + obtenido + ', esperado ' + esperado + ')', ok);
}

/* ============ Acotado ============ */

var dentro = G.acotar({ x: 100, y: 100, w: 80, h: 60 });
igual('acotar: x dentro se respeta', dentro.x, 100);
igual('acotar: y dentro se respeta', dentro.y, 100);
var fuera = G.acotar({ x: 280, y: 280, w: 100, h: 100 });
igual('acotar: x pegado al borde derecho', fuera.x + fuera.w, 300);
igual('acotar: y pegado al borde inferior', fuera.y + fuera.h, 300);
var negativo = G.acotar({ x: -50, y: -50, w: 40, h: 40 });
igual('acotar: negativo a 0 (x)', negativo.x, 0);
igual('acotar: negativo a 0 (y)', negativo.y, 0);
var enorme = G.acotar({ x: 0, y: 0, w: 900, h: 900 });
igual('acotar: ancho mayor que el lienzo se reduce', enorme.w, 300);
igual('acotar: alto mayor que el lienzo se reduce', enorme.h, 300);
igual('acotar: rot se clampea a 360', G.acotar({ x: 0, y: 0, w: 10, h: 10, rot: 900 }).rot, 360);
igual('acotar: sesgo se clampea a 1', G.acotar({ x: 0, y: 0, w: 10, h: 10, sesgo: 5 }).sesgo, 1);
igual('acotar: w minimo 1', G.acotar({ x: 0, y: 0, w: 0, h: 0 }).w, 1);

/* ============ Imanes ============ */

var imanes = G.ajustarImanes({ x: 102, y: 100, w: 100, h: 40 });
igual('iman: centro horizontal', imanes.x, 100);
check('iman: guia vertical en el centro', imanes.guias.some(function (g) {
    return g.eje === 'x' && g.pos === 150;
}));
var imanesBorde = G.ajustarImanes({ x: 3, y: 4, w: 40, h: 40 });
igual('iman: borde izquierdo', imanesBorde.x, 0);
igual('iman: borde superior', imanesBorde.y, 0);
var sinIman = G.ajustarImanes({ x: 40, y: 40, w: 40, h: 40 });
igual('iman: lejos del centro no se mueve (x)', sinIman.x, 40);
igual('iman: lejos del centro no se mueve (y)', sinIman.y, 40);
igual('iman: lejos del centro no hay guias', sinIman.guias.length, 0);
var capaDerecha = { x: 257, y: 40, w: 40, h: 40 };
var imanesDer = G.ajustarImanes(capaDerecha);
igual('iman: borde derecho', imanesDer.x + capaDerecha.w, 300);

/* ============ Redimensionado por tirador ============ */

var base = { x: 100, y: 100, w: 100, h: 100 };
var se = G.redimensionarDesdeTirador(base, 'se', 40, 25, {});
igual('tirador se: ancho crece con dx', se.w, 140);
igual('tirador se: alto crece con dy', se.h, 125);
igual('tirador se: x no se mueve', se.x, 100);
var nw = G.redimensionarDesdeTirador(base, 'nw', -20, -10, {});
igual('tirador nw: ancho crece al arrastrar a la izquierda', nw.w, 120);
igual('tirador nw: x se desplaza para anclar al este', nw.x, 80);
var nwCrece = G.redimensionarDesdeTirador(base, 'nw', 20, 0, {});
igual('tirador nw: ancho decrece al arrastrar a la derecha', nwCrece.w, 80);
igual('tirador nw: borde este quieto', nwCrece.x + nwCrece.w, 200);
var prop = G.redimensionarDesdeTirador(base, 'se', 40, 0, { proporcion: true });
check('tirador con proporcion: caja no se deforma',
    Math.abs((prop.w / prop.h) - 1) < 0.001);
check('tirador con proporcion: crece', prop.w > 100);
var acotado = G.redimensionarDesdeTirador(base, 'se', 5000, 5000, {});
igual('tirador: no supera el lienzo (w)', acotado.w, 300);
check('tirador: no supera el lienzo (posicion)', acotado.x + acotado.w <= 300 && acotado.y + acotado.h <= 300);
var minimo = G.redimensionarDesdeTirador(base, 'se', -5000, -5000, {});
igual('tirador: no baja de 1 px', minimo.w, 1);

/* ============ Rotacion ============ */

var capaRot = { x: 100, y: 100, w: 100, h: 100 };
var centro = G.centro(capaRot);
igual('centro: x', centro.x, 150);
igual('centro: y', centro.y, 150);
var punto = G.puntosDeRotacion(capaRot, { x: 200, y: 150 }, {});
igual('rotacion: angulo 0 a la derecha', punto.angulo, 0);
var puntoAbajo = G.puntosDeRotacion(capaRot, { x: 150, y: 200 }, {});
igual('rotacion: angulo 90 abajo', puntoAbajo.angulo, 90);
var conPaso = G.puntosDeRotacion(capaRot, { x: 143, y: 207 }, { paso: 15 });
igual('rotacion: redondeo al paso mas cercano', conPaso.angulo, 90);

/* ============ Acierto de capa (inversa de rotacion y sesgo) ============ */

var capas = [
    { tipo: 'placeholder', ref: 'A', x: 0, y: 0, w: 50, h: 50 },
    { tipo: 'placeholder', ref: 'B', x: 100, y: 100, w: 50, h: 50 }
];
igual('acertar: elige la capa que contiene el punto', G.acertarCapa(capas, 110, 110), 1);
igual('acertar: -1 si el punto esta fuera', G.acertarCapa(capas, 200, 200), -1);
igual('acertar: la de arriba gana si se solapan',
    G.acertarCapa([capas[0], { x: 0, y: 0, w: 50, h: 50 }], 10, 10), 1);
check('acertar: ignora ocultas',
    G.acertarCapa([{ x: 0, y: 0, w: 50, h: 50, oculta: true }], 10, 10) === -1);
check('acertar: ignora bloqueadas',
    G.acertarCapa([{ x: 0, y: 0, w: 50, h: 50, bloqueada: true }], 10, 10) === -1);
check('contiene: punto en la esquina de una capa rotada 90',
    G.contiene({ x: 100, y: 100, w: 100, h: 20, rot: 90 }, 150, 130));
check('contiene: fuera de la capa rotada 90',
    !G.contiene({ x: 100, y: 100, w: 100, h: 20, rot: 90 }, 110, 110));
check('contiene: con sesgo sigue conteniendo el centro',
    G.contiene({ x: 100, y: 100, w: 100, h: 100, sesgo: 0.5 }, 150, 150));

/* ============ Alineacion ============ */

var tres = [
    { x: 0, y: 0, w: 40, h: 20 },
    { x: 60, y: 30, w: 20, h: 60 },
    { x: 200, y: 200, w: 100, h: 100 }
];
var alCentro = G.alinear(tres, [0], 'centro_h', { x: 0, y: 0, w: 300, h: 300 });
igual('alinear: centro horizontal', alCentro[0].x + alCentro[0].w / 2, 150);
igual('alinear: no mueve las otras capas', alCentro[1].x, 60);
var alDerecha = G.alinear(tres, [0], 'derecha', { x: 0, y: 0, w: 300, h: 300 });
igual('alinear: borde derecho', alDerecha[0].x + alDerecha[0].w, 300);
var alAbajo = G.alinear(tres, [0], 'abajo', { x: 0, y: 0, w: 300, h: 300 });
igual('alinear: borde inferior', alAbajo[0].y + alAbajo[0].h, 300);
check('alinear: posicion desconocida no hace nada', G.alinear(tres, [0], 'diagonal').length === 3);

/* ============ Distribucion ============ */

var cuatro = [
    { x: 0, y: 0, w: 20, h: 10 },
    { x: 50, y: 0, w: 20, h: 10 },
    { x: 100, y: 0, w: 20, h: 10 },
    { x: 200, y: 0, w: 20, h: 10 }
];
var dist = G.distribuir(cuatro, [0, 1, 2, 3], 'x', { x: 0, y: 0, w: 300, h: 300 });
igual('distribuir: la primera queda en el borde inicial', dist[0].x, 0);
igual('distribuir: hueco constante entre capas', dist[1].x - (dist[0].x + 20), dist[2].x - (dist[1].x + 20));
igual('distribuir: la ultima termina en el borde', dist[3].x + dist[3].w, 300);
igual('distribuir: ancho de hueco esperado', dist[1].x - dist[0].x - 20, (300 - 80) / 3);
var pocas = G.distribuir(cuatro, [0, 1], 'x', { x: 0, y: 0, w: 300, h: 300 });
igual('distribuir: con menos de 3 capas no hace nada', pocas[0].x, 0);

/* ============ Reordenar (T036) ============ */

var abc = ['a', 'b', 'c', 'd'];
check('reordenar: mueve al principio', G.reordenar(abc, 2, 0).join('') === 'cabd');
check('reordenar: mueve al final', G.reordenar(abc, 0, 3).join('') === 'bcda');
check('reordenar: mueve al medio', G.reordenar(abc, 3, 1).join('') === 'adbc');
check('reordenar: origen igual que destino = sin cambios', G.reordenar(abc, 1, 1).join('') === 'abcd');
check('reordenar: NO muta la entrada', abc.join('') === 'abcd');
check('reordenar: devuelve copia', G.reordenar(abc, 0, 1) !== abc);
check('reordenar: origen fuera de rango', G.reordenar(abc, 9, 0).join('') === 'abcd');
check('reordenar: destino fuera de rango', G.reordenar(abc, 0, 9).join('') === 'abcd');
check('reordenar: indice negativo', G.reordenar(abc, -1, 0).join('') === 'abcd');
check('reordenar: no numerico', G.reordenar(abc, 'x', 0).join('') === 'abcd');
igual('reordenar: lista vacia', G.reordenar([], 0, 1).length, 0);
igual('reordenar: null es lista vacia', G.reordenar(null, 0, 0).length, 0);
igual('reordenar: conserva la longitud', G.reordenar(abc, 0, 3).length, 4);
check('reordenar: conserva los mismos elementos', G.reordenar(abc, 1, 3).slice().sort().join('') === 'abcd');

/* ============ Normalizacion al abrir ============ */

var norm = G.normalizarCapa({ x: -40, y: 10, w: 400, h: 50 });
igual('normalizar: acota al lienzo', norm.capa.w, 300);
igual('normalizar: informa el ajuste', norm.avisos.length, 1);
var normOk = G.normalizarCapa({ x: 10, y: 10, w: 100, h: 100 });
igual('normalizar: geometria valida sin avisos', normOk.avisos.length, 0);
igual('normalizar: geometria valida intacta', normOk.capa.x, 10);

/* ============ Constantes ============ */

igual('lienzo de 300 (salida fija)', G.LIENZO, 300);
igual('tiradores: 8', G.TIRADORES.length, 8);
igual('posiciones de alineacion: 6', G.POSICIONES.length, 6);

if (fallos > 0) {
    console.log('GEOMETRIA FALLA: ' + fallos + ' de ' + total + ' checks.');
    process.exit(1);
}
console.log('GEOMETRIA OK (' + total + ' checks).');

