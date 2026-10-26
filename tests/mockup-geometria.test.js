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
igual('acotar: permite desbordar el borde derecho', fuera.x + fuera.w, 380);
igual('acotar: permite desbordar el borde inferior', fuera.y + fuera.h, 380);
var negativo = G.acotar({ x: -50, y: -50, w: 40, h: 40 });
igual('acotar: conserva posicion negativa (x)', negativo.x, -50);
igual('acotar: conserva posicion negativa (y)', negativo.y, -50);
igual('acotar: limita coordenadas extremas', G.acotar({ x: 99999, y: -99999, w: 10, h: 10 }).x, 3000);
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
check('tirador: permite desbordar el lienzo', acotado.x + acotado.w > 300 && acotado.y + acotado.h > 300);
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

/* ============ Posicion de tiradores (local para dibujo, global para hit-test) ============ */

// Local: solo el offset respecto al centro (el contexto del canvas ya aplico
// translate+rot+sesgo). Es lo que dibuja el editor sobre el strokeRect.
var locSe = G.posicionTirador(capaRot, 'se', { local: true });
igual('posTirador local se: x (borde este)', locSe.x, 50);
igual('posTirador local se: y (borde sur)', locSe.y, 50);
var locNw = G.posicionTirador(capaRot, 'nw', { local: true });
igual('posTirador local nw: x (borde oeste)', locNw.x, -50);
igual('posTirador local nw: y (borde norte)', locNw.y, -50);
var locN = G.posicionTirador(capaRot, 'n', { local: true });
igual('posTirador local n: centro horizontal', locN.x, 0);
igual('posTirador local n: arriba', locN.y, -50);
var locW = G.posicionTirador(capaRot, 'w', { local: true });
igual('posTirador local w: izquierda', locW.x, -50);
igual('posTirador local w: centro vertical', locW.y, 0);
// La local es independiente de la posicion de la capa (es offset puro).
var locLejos = G.posicionTirador({ x: 30, y: 200, w: 40, h: 60 }, 'se', { local: true });
igual('posTirador local no depende de x/y (x)', locLejos.x, 20);
igual('posTirador local no depende de x/y (y)', locLejos.y, 30);

// Global sin rotar: centro + offset (esquina real del marco, para el hit-test).
var globSe = G.posicionTirador(capaRot, 'se');
igual('posTirador global se: x', globSe.x, 200);
igual('posTirador global se: y', globSe.y, 200);
var globNw = G.posicionTirador(capaRot, 'nw');
igual('posTirador global nw: x', globNw.x, 100);
igual('posTirador global nw: y', globNw.y, 100);
// Global con rotacion 90: la esquina se este cae en (100, 200).
var globRot = G.posicionTirador({ x: 100, y: 100, w: 100, h: 100, rot: 90 }, 'se');
igual('posTirador global rot 90: x', globRot.x, 100);
igual('posTirador global rot 90: y', globRot.y, 200);

// La global debe ser exactamente la transformacion del contexto (sesgo ->
// rotacion -> traslacion) aplicada a la local: asi dibujo y hit-test coinciden.
var capaCons = { x: 60, y: 40, w: 80, h: 40, rot: 30, sesgo: 0.3 };
var consLocal = G.posicionTirador(capaCons, 'ne', { local: true });
var consGlobal = G.posicionTirador(capaCons, 'ne');
var u = consLocal.x + 0.3 * consLocal.y;              // sesgo
var r = 30 * Math.PI / 180;
var esperadoX = (capaCons.x + capaCons.w / 2) + u * Math.cos(r) - consLocal.y * Math.sin(r);
var esperadoY = (capaCons.y + capaCons.h / 2) + u * Math.sin(r) + consLocal.y * Math.cos(r);
igual('posTirador local+sesgo+rot+centro = global (x)', consGlobal.x, esperadoX);
igual('posTirador local+sesgo+rot+centro = global (y)', consGlobal.y, esperadoY);

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

/* ============ Grupos ============ */

var grupoCapas = [
    { x: 15, y: 40, w: 20, h: 20, grupo: 'g-pagina' },
    { x: 65, y: 40, w: 20, h: 20, grupo: 'g-pagina', rot: 10 },
    { x: 120, y: 40, w: 20, h: 20 }
];
check('grupos: seleccionar un miembro expande todo el grupo',
    G.expandirGrupos(grupoCapas, [1]).join(',') === '0,1');
check('grupos: seleccion expandida es unica',
    G.expandirGrupos(grupoCapas, [1, 0]).join(',') === '0,1');
var marcoGrupos = G.marco(grupoCapas, [0]);
igual('grupos: marco incluye todos los miembros', marcoGrupos.x, 15);
check('grupos: marco incluye el giro del ultimo miembro',
    marcoGrupos.x + marcoGrupos.w > 85);
var transformadas = G.transformarGrupo(grupoCapas, [0], { x: 50, y: 50 }, 90, 5, 0);
igual('grupos: rotacion transforma el centro de la primera capa', transformadas[0].x + 10, 55);
igual('grupos: rotacion transforma el centro de la primera capa (y)', transformadas[0].y + 10, 25);
igual('grupos: rotacion transforma el centro de la segunda capa', transformadas[1].x + 10, 55);
igual('grupos: rotacion transforma el centro de la segunda capa (y)', transformadas[1].y + 10, 75);
igual('grupos: suma la rotacion a la capa', transformadas[1].rot, 100);
igual('grupos: no transforma capas ajenas', transformadas[2].x, grupoCapas[2].x);
igual('grupos: no muta el arreglo original', grupoCapas[0].x, 15);
var fueraGrupo = G.transformarGrupo(grupoCapas, [0], { x: 50, y: 50 }, 0, -80, 420);
igual('grupos: permite trasladar mas alla del lienzo', fueraGrupo[0].y, 460);
igual('grupos: conserva posiciones negativas al mover', fueraGrupo[0].x, -65);
var escaladas = G.escalarGrupo(grupoCapas, [0], { x: 50, y: 50 }, 0.5);
igual('grupos: escala el ancho uniformemente', escaladas[0].w, 10);
igual('grupos: escala el alto uniformemente', escaladas[1].h, 10);
igual('grupos: escala alrededor del origen', G.centro(escaladas[0]).x, 37.5);
igual('grupos: mantiene rotacion al escalar', escaladas[1].rot, 10);
igual('grupos: no escala capas ajenas', escaladas[2].w, grupoCapas[2].w);
igual('grupos: escalar no muta el arreglo original', grupoCapas[0].w, 20);

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
igual('coordenadas fuera del lienzo: limite seguro de 3000', G.MAX_POSICION, 3000);
igual('tiradores: 8', G.TIRADORES.length, 8);
igual('posiciones de alineacion: 6', G.POSICIONES.length, 6);

if (fallos > 0) {
    console.log('GEOMETRIA FALLA: ' + fallos + ' de ' + total + ' checks.');
    process.exit(1);
}
console.log('GEOMETRIA OK (' + total + ' checks).');
