/**
 * mockup-geometria.js - Geometria pura del editor de mockups (spec 011, R4).
 *
 * Funciones PURAS: sin DOM, sin jQuery, sin estado. Toda la manipulacion
 * directa del lienzo (arrastrar, redimensionar, rotar, imanes, alinear) se
 * calcula aqui, para que la UI solo translates arrastres y estas reglas sean
 * verificables con `node tests/mockup-geometria.test.js`.
 *
 * Contrato: `contracts/mockup-capas.md`. Geometria en el espacio logico
 * 300x300 (la salida del mockup es 300x300 fija; el zoom es solo una lupa).
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    root.PMUGeometria = api;
    if (typeof module === 'object' && module && module.exports) {
        module.exports = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /** Lado del lienzo logico (salida 300x300 px, norma vigente). */
    var LIENZO = 300;
    /** Tope de seguridad para capas desplazadas fuera del area de salida. */
    var MAX_POSICION = LIENZO * 10;
    /** Permite ampliar grupos mas alla del lienzo sin admitir tamaños extremos. */
    var MAX_DIMENSION = LIENZO * 4;
    /** Tolerancia de imanes en px del espacio logico. */
    var TOLERANCIA_IMAN = 6;
    /** Tiradores de redimension admitidos. */
    var TIRADORES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    function numero(valor, porDefecto) {
        var n = parseFloat(valor);
        return isFinite(n) ? n : (porDefecto || 0);
    }

    function acotarNumero(valor, min, max) {
        if (valor < min) { return min; }
        if (valor > max) { return max; }
        return valor;
    }

    /* ============ Acotado ============ */

    /**
     * Sanea dimensiones y limita desplazamientos extremos, pero permite que
     * una capa quede parcialmente o totalmente fuera del lienzo de salida.
     */
    function acotar(capa, lienzo) {
        var lado = numero(lienzo, LIENZO);
        var c = {};
        // Conserva los campos extra de la capa (nombre, filtros, modo, oculta,
        // bloqueada, envoltura...): el acotado ajusta SOLO la geometria. Antes
        // se reconstruia el objeto con 8 claves y toda la recarga del editor
        // perdia los ajustes (bug real: nombre/filtros/oculta no sobrevivian
        // normalizarCapa al abrir la consola).
        Object.keys(capa || {}).forEach(function (k) { c[k] = capa[k]; });
        c.tipo = capa.tipo;
        c.ref = capa.ref;
        c.x = numero(capa.x);
        c.y = numero(capa.y);
        c.w = Math.max(1, numero(capa.w, 1));
        c.h = Math.max(1, numero(capa.h, 1));
        c.rot = acotarNumero(numero(capa.rot), -360, 360);
        c.giro = acotarNumero(numero(capa.giro), -360, 360);
        c.sesgo = acotarNumero(numero(capa.sesgo), -1, 1);
        if (c.w > MAX_DIMENSION) { c.w = MAX_DIMENSION; }
        if (c.h > MAX_DIMENSION) { c.h = MAX_DIMENSION; }
        c.x = acotarNumero(c.x, -MAX_POSICION, MAX_POSICION);
        c.y = acotarNumero(c.y, -MAX_POSICION, MAX_POSICION);
        return c;
    }

    /* ============ Imanes ============ */

    /**
     * Imanes a centro H, centro V y bordes del lienzo, con guias.
     * Devuelve la posicion pegada y el detalle de las guias a dibujar.
     */
    function ajustarImanes(capa, opciones) {
        var op = opciones || {};
        var lado = numero(op.lienzo, LIENZO);
        var tol = op.tolerancia === undefined ? TOLERANCIA_IMAN : numero(op.tolerancia, TOLERANCIA_IMAN);
        var c = { x: numero(capa.x), y: numero(capa.y), w: numero(capa.w, 1), h: numero(capa.h, 1) };
        var guias = [];
        var nuevaX = c.x;
        var nuevaY = c.y;
        var centroX = c.x + c.w / 2;
        var centroY = c.y + c.h / 2;

        if (Math.abs(centroX - lado / 2) <= tol) {
            nuevaX = lado / 2 - c.w / 2;
            guias.push({ eje: 'x', pos: lado / 2 });
        }
        if (Math.abs(centroY - lado / 2) <= tol) {
            nuevaY = lado / 2 - c.h / 2;
            guias.push({ eje: 'y', pos: lado / 2 });
        }
        if (Math.abs(c.x) <= tol) {
            nuevaX = 0;
            guias.push({ eje: 'x', pos: 0 });
        }
        if (Math.abs(c.y) <= tol) {
            nuevaY = 0;
            guias.push({ eje: 'y', pos: 0 });
        }
        if (Math.abs((c.x + c.w) - lado) <= tol) {
            nuevaX = lado - c.w;
            guias.push({ eje: 'x', pos: lado });
        }
        if (Math.abs((c.y + c.h) - lado) <= tol) {
            nuevaY = lado - c.h;
            guias.push({ eje: 'y', pos: lado });
        }
        return { x: nuevaX, y: nuevaY, guias: guias };
    }

    /* ============ Redimensionado por tirador ============ */

    /**
     * Redimensiona desde un tirador usando el desplazamiento del puntero ya
     * convertido al espacio logico. `proporcion` mantiene la relacion de
     * aspecto; `desdeCentro` ancla en el centro en vez del tirador opuesto.
     */
    function redimensionarDesdeTirador(capa, tirador, dx, dy, opciones) {
        var op = opciones || {};
        var lado = numero(op.lienzo, LIENZO);
        var x0 = numero(capa.x);
        var y0 = numero(capa.y);
        var w0 = Math.max(1, numero(capa.w, 1));
        var h0 = Math.max(1, numero(capa.h, 1));
        var ddx = numero(dx);
        var ddy = numero(dy);
        var oeste = String(tirador).indexOf('w') !== -1;
        var norte = String(tirador).indexOf('n') !== -1;
        var sur = String(tirador).indexOf('s') !== -1;
        var este = String(tirador).indexOf('e') !== -1;

        var w = w0 + (oeste ? -ddx : ddx);
        var h = h0 + (norte ? -ddy : ddy);
        if (op.proporcion && w0 > 0 && h0 > 0) {
            // Un solo factor de escala para ambos ejes: nunca deforma.
            var escala;
            if (op.proporcion === 'h') {
                escala = h / h0;
            } else if (op.proporcion === 'w') {
                escala = w / w0;
            } else {
                escala = Math.abs(ddx) >= Math.abs(ddy) ? (w / w0) : (h / h0);
            }
            escala = acotarNumero(escala, 0.02, lado / Math.max(w0, h0));
            w = w0 * escala;
            h = h0 * escala;
        }
        w = acotarNumero(w, 1, MAX_DIMENSION);
        h = acotarNumero(h, 1, MAX_DIMENSION);

        var x = oeste ? x0 + (w0 - w) : x0;
        var y = norte ? y0 + (h0 - h) : y0;
        if (op.desdeCentro) {
            x = x0 + (w0 - w) / 2;
            y = y0 + (h0 - h) / 2;
        } else if (sur || este) {
            // Tiradores sur/este: anclar arriba/izquierda.
            x = oeste ? x : x0;
            y = norte ? y : y0;
        }
        return acotar({ x: x, y: y, w: w, h: h }, lado);
    }

    /* ============ Posicion de tiradores ============ */

    /**
     * Posicion de un tirador de redimension (8 esquinas/lados) de la capa.
     *
     * Por defecto (espacio GLOBAL del lienzo logico): posicion para el
     * hit-test `tiradorEn()`, que compara contra el punto del puntero.
     *
     * Con `{ local: true }`: solo el offset respecto al centro, SIN sesgo ni
     * rotacion, para DIBUJAR dentro del contexto del canvas que ya aplico
     * `translate(centro) + rotate + transform(sesgo)`. Dibujar la posicion
     * global ahi era una DOBLE transformacion: los tiradores salian corridos
     * por el centro (fuera del marco) y no coincidian con el hit-test.
     *
     * La posicion global reproduce exactamente la transformacion del contexto
     * (sesgo -> rotacion -> traslacion), asi que dibujar en local hace que el
     * tirador caiga sobre la esquina del `strokeRect`, que tambien se dibuja
     * en local.
     */
    function posicionTirador(capa, tirador, opciones) {
        var op = opciones || {};
        var hx = numero(capa.w, 1) / 2;
        var hy = numero(capa.h, 1) / 2;
        var t = String(tirador);
        var x = t.indexOf('w') !== -1 ? -hx : (t.indexOf('e') !== -1 ? hx : 0);
        var y = t.indexOf('n') !== -1 ? -hy : (t.indexOf('s') !== -1 ? hy : 0);
        if (op.local) {
            return { x: x, y: y };
        }
        var cx = numero(capa.x) + hx;
        var cy = numero(capa.y) + hy;
        var rad = numero(capa.rot) * Math.PI / 180;
        var lx = x + numero(capa.sesgo) * y;
        return {
            x: cx + lx * Math.cos(rad) - y * Math.sin(rad),
            y: cy + lx * Math.sin(rad) + y * Math.cos(rad)
        };
    }

    /* ============ Rotacion ============ */

    /** Centro de la caja de la capa. */
    function centro(capa) {
        return { x: numero(capa.x) + numero(capa.w, 1) / 2, y: numero(capa.y) + numero(capa.h, 1) / 2 };
    }

    /**
     * Estado del tirador de rotacion: angulo (grados) del centro hacia un
     * punto y su posicion en el lienzo. `paso` redondea a multiplos.
     */
    function puntosDeRotacion(capa, punto, opciones) {
        var op = opciones || {};
        var c = centro(capa);
        var lado = numero(op.lienzo, LIENZO);
        var ang = Math.atan2(numero(punto.y) - c.y, numero(punto.x) - c.x) * 180 / Math.PI;
        if (op.paso) {
            var paso = numero(op.paso, 15);
            ang = Math.round(ang / paso) * paso;
        }
        var radio = op.radio || (Math.max(numero(capa.w, 1), numero(capa.h, 1)) / 2 + 14);
        return {
            angulo: acotarNumero(ang, -360, 360),
            radio: radio,
            x: c.x + radio * Math.cos(ang * Math.PI / 180),
            y: c.y + radio * Math.sin(ang * Math.PI / 180),
            cx: c.x,
            cy: c.y,
            lado: lado
        };
    }

    /* ============ Acierto de capa ============ */

    /** El punto (x, y) cae dentro de la caja de la capa (con rotacion y sesgo). */
    function contiene(capa, x, y) {
        var c = centro(capa);
        var rad = -numero(capa.rot) * Math.PI / 180;
        var px = numero(x) - c.x;
        var py = numero(y) - c.y;
        // Deshacer rotacion.
        var rx = px * Math.cos(rad) - py * Math.sin(rad);
        var ry = px * Math.sin(rad) + py * Math.cos(rad);
        // Deshacer sesgo (el render aplica x' = x + sesgo*y).
        var sesgo = acotarNumero(numero(capa.sesgo), -1, 1);
        var lx = rx - sesgo * ry;
        var ly = ry;
        return Math.abs(lx) <= Math.max(1, numero(capa.w, 1)) / 2 &&
            Math.abs(ly) <= Math.max(1, numero(capa.h, 1)) / 2;
    }

    /**
     * Indice de la capa que esta bajo el punto (x, y). Se queda con la ultima
     * coincidente (indice mayor = mas arriba). Salta `oculta` y `bloqueada`.
     */
    function acertarCapa(capas, x, y) {
        var lista = capas || [];
        var encontrado = -1;
        for (var i = 0; i < lista.length; i++) {
            var c = lista[i];
            if (!c || c.oculta || c.bloqueada) { continue; }
            if (contiene(c, x, y)) { encontrado = i; }
        }
        return encontrado;
    }

    /** Indices unicos de las capas seleccionadas, expandiendo sus grupos. */
    function expandirGrupos(capas, indices) {
        var lista = capas || [];
        var salida = [];
        var vistos = {};
        (indices || []).forEach(function (indice) {
            var capa = lista[indice];
            if (!capa) { return; }
            var grupo = capa.grupo ? String(capa.grupo) : '';
            lista.forEach(function (otra, i) {
                if (i === indice || (grupo && otra && String(otra.grupo || '') === grupo)) {
                    if (!vistos[i]) {
                        vistos[i] = true;
                        salida.push(i);
                    }
                }
            });
        });
        return salida;
    }

    /** Limites alineados a ejes que contienen las capas seleccionadas. */
    function marco(capas, indices) {
        var lista = capas || [];
        var puntos = [];
        expandirGrupos(lista, indices).forEach(function (i) {
            ['nw', 'ne', 'se', 'sw'].forEach(function (tirador) {
                puntos.push(posicionTirador(lista[i], tirador));
            });
        });
        if (!puntos.length) { return null; }
        var xs = puntos.map(function (p) { return p.x; });
        var ys = puntos.map(function (p) { return p.y; });
        var x = Math.min.apply(Math, xs);
        var y = Math.min.apply(Math, ys);
        return {
            x: x,
            y: y,
            w: Math.max.apply(Math, xs) - x,
            h: Math.max.apply(Math, ys) - y
        };
    }

    /**
     * Traslada y rota un conjunto alrededor de `centro`, conservando todos
     * los campos de cada capa y las distancias relativas entre ellas.
     */
    function transformarGrupo(capas, indices, origen, grados, dx, dy) {
        var lista = (capas || []).slice();
        var cx = numero(origen && origen.x);
        var cy = numero(origen && origen.y);
        var rad = numero(grados) * Math.PI / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        expandirGrupos(lista, indices).forEach(function (i) {
            var original = lista[i];
            var copia = {};
            Object.keys(original).forEach(function (k) { copia[k] = original[k]; });
            var centroCapa = centro(original);
            var px = centroCapa.x - cx;
            var py = centroCapa.y - cy;
            var nuevoX = cx + px * cos - py * sin + numero(dx);
            var nuevoY = cy + px * sin + py * cos + numero(dy);
            copia.x = nuevoX - numero(original.w, 1) / 2;
            copia.y = nuevoY - numero(original.h, 1) / 2;
            copia.rot = acotarNumero(numero(original.rot) + numero(grados), -360, 360);
            copia.giro = acotarNumero(numero(original.giro) + numero(grados), -360, 360);
            lista[i] = acotar(copia);
        });
        return lista;
    }

    /** Escala un conjunto en ambos ejes alrededor de `origen`, sin mutar la entrada. */
    function escalarGrupo(capas, indices, origen, escalaX, escalaY) {
        var lista = (capas || []).slice();
        var cx = numero(origen && origen.x);
        var cy = numero(origen && origen.y);
        var sx = numero(escalaX, 1);
        var sy = numero(escalaY, sx);
        if (sx <= 0 || sy <= 0) { return lista; }
        expandirGrupos(lista, indices).forEach(function (i) {
            var original = lista[i];
            var copia = {};
            Object.keys(original).forEach(function (k) { copia[k] = original[k]; });
            var centroCapa = centro(original);
            copia.w = Math.min(MAX_DIMENSION, numero(original.w, 1) * sx);
            copia.h = Math.min(MAX_DIMENSION, numero(original.h, 1) * sy);
            copia.x = cx + (centroCapa.x - cx) * sx - copia.w / 2;
            copia.y = cy + (centroCapa.y - cy) * sy - copia.h / 2;
            lista[i] = acotar(copia);
        });
        return lista;
    }

    /* ============ Alineacion y distribucion ============ */

    var POSICIONES = {
        izquierda: { eje: 'x', frac: 0 },
        centro_h: { eje: 'x', frac: 0.5 },
        derecha: { eje: 'x', frac: 1 },
        arriba: { eje: 'y', frac: 0 },
        centro_v: { eje: 'y', frac: 0.5 },
        abajo: { eje: 'y', frac: 1 }
    };

    /**
     * Alinea las capas indicadas dentro de `caja` (por defecto el lienzo).
     * Devuelve una copia del array; las capas no seleccionadas no se tocan.
     */
    function alinear(capas, seleccion, posicion, caja) {
        var lista = (capas || []).slice();
        var reglas = POSICIONES[posicion];
        if (!reglas) { return lista; }
        var marco = caja || { x: 0, y: 0, w: LIENZO, h: LIENZO };
        (seleccion || []).forEach(function (i) {
            if (!lista[i]) { return; }
            var c = lista[i];
            var ancho = Math.max(1, numero(c.w, 1));
            var alto = Math.max(1, numero(c.h, 1));
            var nueva = {};
            Object.keys(c).forEach(function (k) { nueva[k] = c[k]; });
            if (reglas.eje === 'x') {
                nueva.x = numero(marco.x) + (numero(marco.w) - ancho) * reglas.frac;
            } else {
                nueva.y = numero(marco.y) + (numero(marco.h) - alto) * reglas.frac;
            }
            lista[i] = acotar(nueva);
        });
        return lista;
    }

    /**
     * Distribuye las capas seleccionadas con el mismo espacio entre ellas,
     * de borde a borde del area: la primera queda pegada al inicio y la
     * ultima al final (semantica de "distribuir" de un editor grafico).
     * Con menos de 3 capas no hace nada (no hay hueco que repartir).
     */
    function distribuir(capas, seleccion, eje, caja) {
        var lista = (capas || []).slice();
        var idx = (seleccion || []).filter(function (i) { return lista[i]; });
        if (idx.length < 3) { return lista; }
        var marco = caja || { x: 0, y: 0, w: LIENZO, h: LIENZO };
        var horizontal = eje !== 'y';
        var inicio = horizontal ? numero(marco.x) : numero(marco.y);
        var total = horizontal ? numero(marco.w) : numero(marco.h);
        var medidas = idx.map(function (i) {
            return horizontal ? Math.max(1, numero(lista[i].w, 1)) : Math.max(1, numero(lista[i].h, 1));
        });
        var suma = medidas.reduce(function (a, b) { return a + b; }, 0);
        // Huecos entre elementos: n-1 (con los bordes ya cubiertos).
        var hueco = Math.max(0, (total - suma) / (idx.length - 1));

        // Ordenar por posicion actual conserva la disposicion visual.
        var orden = idx.map(function (i, k) { return { i: i, k: k }; });
        orden.sort(function (a, b) {
            var ca = horizontal ? numero(lista[a.i].x) : numero(lista[a.i].y);
            var cb = horizontal ? numero(lista[b.i].x) : numero(lista[b.i].y);
            return ca - cb;
        });
        var cursor = inicio;
        orden.forEach(function (o) {
            var c = {};
            Object.keys(lista[o.i]).forEach(function (k2) { c[k2] = lista[o.i][k2]; });
            if (horizontal) { c.x = cursor; } else { c.y = cursor; }
            lista[o.i] = acotar(c);
            cursor += medidas[o.k] + hueco;
        });
        return lista;
    }

    /**
     * Reordena una lista moviendo el elemento de `desde` a la posicion `hasta`
     * (indices 0-based, ambos incluidos). Devuelve una COPIA: no muta la
     * entrada, para que la geometria siga siendo pura y testeable. Un indice
     * fuera de rango devuelve la lista sin cambios.
     */
    function reordenar(lista, desde, hasta) {
        var l = (lista || []).slice();
        var d = parseInt(desde, 10);
        var h = parseInt(hasta, 10);
        if (isNaN(d) || isNaN(h) || d < 0 || h < 0 || d >= l.length || h >= l.length) {
            return l;
        }
        if (d === h) { return l; }
        l.splice(h, 0, l.splice(d, 1)[0]);
        return l;
    }

    /* ============ Normalizacion al abrir ============ */

    /**
     * Normaliza una capa persistida: acota la geometria al lienzo. Devuelve
     * `{capa, avisos}` para informar en una linea sin bloquear la edicion.
     */
    function normalizarCapa(capa, opciones) {
        var lado = numero((opciones || {}).lienzo, LIENZO);
        var antes = { x: numero(capa.x), y: numero(capa.y), w: numero(capa.w), h: numero(capa.h) };
        var c = acotar(capa, lado);
        var avisos = [];
        if (antes.x !== c.x || antes.y !== c.y || antes.w !== c.w || antes.h !== c.h) {
            avisos.push('Geometria fuera de rango: ' + antes.w + 'x' + antes.h +
                ' en ' + antes.x + ',' + antes.y + ' ajustada a ' + c.w + 'x' + c.h +
                ' en ' + c.x + ',' + c.y);
        }
        return { capa: c, avisos: avisos };
    }

    return {
        LIENZO: LIENZO,
        MAX_POSICION: MAX_POSICION,
        MAX_DIMENSION: MAX_DIMENSION,
        TOLERANCIA_IMAN: TOLERANCIA_IMAN,
        TIRADORES: TIRADORES,
        POSICIONES: Object.keys(POSICIONES),
        acotar: acotar,
        ajustarImanes: ajustarImanes,
        redimensionarDesdeTirador: redimensionarDesdeTirador,
        posicionTirador: posicionTirador,
        puntosDeRotacion: puntosDeRotacion,
        centro: centro,
        contiene: contiene,
        acertarCapa: acertarCapa,
        expandirGrupos: expandirGrupos,
        marco: marco,
        transformarGrupo: transformarGrupo,
        escalarGrupo: escalarGrupo,
        alinear: alinear,
        distribuir: distribuir,
        reordenar: reordenar,
        normalizarCapa: normalizarCapa
    };
}));
