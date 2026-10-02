/**
 * tests/mockup-contrato.test.js - Contrato entre el nucleo y sus consumidores
 * (spec 011). Cubre lo que las puertas anteriores NO cubrian:
 *
 * 1. **Cableado de la API**: todo `PMUMockup.<metodo>()` que el editor y la
 *    ficha llaman tiene que existir de verdad en el nucleo. Asi se detecto el
 *    bug que dejo el editor y la ficha rotos (`componer` vs `composicion`).
 * 2. **Comportamiento del nucleo con un contexto falso**: z-order, encaje sin
 *    deformar, `limpiar: false` y degradacion sin recurso.
 * 3. **Orden de dibujo del editor**: la capa de edicion (tiradores, guias y
 *    medidas) se dibuja DESPUES de la composicion, nunca antes.
 *
 * Ejecutar: `node tests/mockup-contrato.test.js`.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');
var R = require(path.join(RAIZ, 'assets/mockup-render.js'));

var fallos = 0;
var total = 0;

function check(nombre, condicion, detalle) {
    total++;
    if (!condicion) {
        fallos++;
        console.log('FALLA: ' + nombre + (detalle ? ' (' + detalle + ')' : ''));
    }
}

function leer(rel) {
    return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
}

/**
 * El nucleo carga imagenes con `new Image()` (existe en el navegador, no en
 * Node). Este stub simula una imagen que carga de inmediato con medidas 1:1,
 * para poder ejercitar `componer` fuera del navegador.
 */
global.Image = function () {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    var self = this;
    Object.defineProperty(this, 'src', {
        set: function (valor) {
            self.complete = true;
            self.naturalWidth = 300;
            self.naturalHeight = 300;
            if (self.onload) { self.onload(); }
        }
    });
};

/* ============ 1. Cableado de la API (el bug que nos mordio) ============ */

var consumidores = ['assets/mockups.js', 'assets/tienda.js'];

consumidores.forEach(function (fichero) {
    var codigo = leer(fichero);
    // Miembros del nucleo usados: `R.componer(`, `PMUMockup.urlDeImagen(`, ...
    var usados = {};
    var re = new RegExp('(?:\\bR|\\bPMUMockup)\\.([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(', 'g');
    var m;
    while ((m = re.exec(codigo)) !== null) {
        usados[m[1]] = true;
    }
    Object.keys(usados).forEach(function (metodo) {
        check(metodo + '() existe en el nucleo (' + fichero + ')',
            typeof R[metodo] === 'function', 'llamado pero no exportado');
    });
    check(fichero + ' usa al menos un miembro del nucleo', Object.keys(usados).length > 0);
});

check('el alias composicion sigue disponible (compatibilidad)', R.composicion === R.componer);

/* ============ 2. Comportamiento del nucleo con contexto falso ============ */

/** Contexto 2D falso que registra lo que se dibuja y en que orden. */
function ctxFalso() {
    var ops = [];
    return {
        ops: ops,
        setTransform: function () { ops.push('setTransform'); },
        clearRect: function () { ops.push('clearRect'); },
        save: function () { ops.push('save'); },
        restore: function () { ops.push('restore'); },
        translate: function () { ops.push('translate'); },
        rotate: function () { ops.push('rotate'); },
        transform: function () { ops.push('transform'); },
        strokeRect: function () { ops.push('strokeRect'); },
        fillRect: function () { ops.push('fillRect'); },
        beginPath: function () { ops.push('beginPath'); },
        moveTo: function () { ops.push('moveTo'); },
        lineTo: function () { ops.push('lineTo'); },
        stroke: function () { ops.push('stroke'); },
        fill: function () { ops.push('fill'); },
        arc: function () { ops.push('arc'); },
        fillText: function (t) { ops.push('fillText:' + t); },
        measureText: function () { return { width: 10 }; },
        setLineDash: function () { },
        drawImage: function (img, x, y, w, h) {
            ops.push('drawImage:' + Math.round(x) + ',' + Math.round(y) + ',' +
                Math.round(w) + ',' + Math.round(h));
        }
    };
}

function capa(tipo, ref, extra) {
    var c = { tipo: tipo, ref: ref, x: 0, y: 0, w: 100, h: 100, rot: 0, sesgo: 0, filtros: {}, modo: 'normal' };
    Object.keys(extra || {}).forEach(function (k) { c[k] = extra[k]; });
    return c;
}

var pruebas = [];

pruebas.push(function () {
    var ctx = ctxFalso();
    return R.componer(ctx, [capa('img', 'pdf:a.png')], {
        resolver: function () { return null; },
        contexto: {},
        lienzo: 300
    }).then(function () {
        check('sin recurso: dibuja caja neutra (nunca falla)', ctx.ops.indexOf('fillRect') !== -1);
        check('sin recurso: NO dibuja imagen',
            !ctx.ops.some(function (o) { return o.indexOf('drawImage') === 0; }));
    });
});

pruebas.push(function () {
    var ctx = ctxFalso();
    return R.componer(ctx, [capa('img', 'pdf:a.png')], {
        resolver: function () { return { url: 'x' }; },
        contexto: {},
        lienzo: 300,
        limpiar: false
    }).then(function () {
        check('limpiar:false -> el nucleo NO borra el lienzo', ctx.ops.indexOf('clearRect') === -1);
    });
});

pruebas.push(function () {
    var ctx = ctxFalso();
    return R.componer(ctx, [capa('img', 'pdf:a.png')], {
        resolver: function () { return { url: 'x' }; },
        contexto: {},
        lienzo: 300
    }).then(function () {
        check('limpiar por defecto -> el nucleo SI limpia', ctx.ops.indexOf('clearRect') !== -1);
    });
});

pruebas.push(function () {
    var ctx = ctxFalso();
    // Capa oculta + capa visible: la oculta no se dibuja.
    return R.componer(ctx, [capa('img', 'pdf:a.png', { oculta: true }), capa('img', 'pdf:b.png')],
        {
            resolver: function (c) { return { url: c.ref }; },
            contexto: {},
            lienzo: 300
        }).then(function () {
        var dibuja = ctx.ops.filter(function (o) { return o.indexOf('drawImage') === 0; });
        check('oculta: la capa `oculta` no se dibuja',
            dibuja.length === 1 && dibuja[0].indexOf('b.png') === 0, dibuja.join(' | '));
    });
});

pruebas.push(function () {
    // Encaje sin deformar: caja 100x100 con recurso 200x100 -> 100x50 centrado.
    var e = R.contener({ x: 0, y: 0, w: 100, h: 100 }, { w: 200, h: 100 });
    check('contener: respeta la proporcion', Math.abs(e.w / e.h - 2) < 0.001, e.w + 'x' + e.h);
    check('contener: centrado verticalmente', e.y === 25, String(e.y));
    check('contener: avisa de la discrepancia', e.discrepancia === true);
    var igual = R.contener({ x: 0, y: 0, w: 100, h: 50 }, { w: 200, h: 100 });
    check('contener: proporcion igual -> sin aviso', igual.discrepancia === false);
});

pruebas.push(function () {
    check('filtroCss aplica gama (bug corregido)',
        R.filtroCss({ gama: 0 }).filtro.indexOf('grayscale') !== -1);
    check('filtroCss: opacidad va a alfa, no a ctx.filter',
        R.filtroCss({ opacidad: 50 }).filtro === 'none' && R.filtroCss({ opacidad: 50 }).alfa === 0.5);
    check('filtroCss: modo de fusion', R.filtroCss({}, 'multiply').composicion === 'multiply');
    check('filtroCss: sin ajustes es neutro',
        R.filtroCss({}).filtro === 'none' && R.filtroCss({}).alfa === 1);
});

pruebas.push(function () {
    var ctx = {
        fotos: { 'a.png': 'u1' },
        imagenes: [{ id: 3, url: 'u3' }],
        grupos: [{ id: '0000FF', cont: 2 }]
    };
    check('urlDeImagen: ref plano legado = foto del PDF', R.urlDeImagen('a.png', ctx) === 'u1');
    check('urlDeImagen: namespace pdf:', R.urlDeImagen('pdf:a.png', ctx) === 'u1');
    check('urlDeImagen: namespace img: por id', R.urlDeImagen('img:3', ctx) === 'u3');
    check('urlDeImagen: id inexistente', R.urlDeImagen('img:9', ctx) === '');
    check('esValida: grupo existente', R.esValida({ tipo: 'placeholder', ref: '0000FF' }, ctx) === true);
    check('esValida: grupo inexistente', R.esValida({ tipo: 'placeholder', ref: 'ABCDEF' }, ctx) === false);
    check('esValida: instancia fuera de rango',
        R.esValida({ tipo: 'placeholder', ref: '0000FF#9' }, ctx) === false);
});
/* ============ 3. Orden de dibujo del editor (estructural) ============ */

var editor = leer('assets/mockups.js');
var iComponer = editor.indexOf('R.componer(ctx, capas()');
var cuerpo = editor.slice(iComponer, iComponer + 1400);
check('el editor llama a R.componer (nombre canonico del nucleo)', iComponer !== -1);
check('el editor NO pide al nucleo que limpie (limpiar: false)',
    /limpiar:\s*false/.test(cuerpo),
    'sin limpiar:false el nucleo borra la capa de edicion');
var editor = leer('assets/mockups.js');
var iDibujar = editor.indexOf('function dibujar()');
// Ventana amplia: cubre la llamada a componer, la opcion `limpiar` y el
// `setTransform` que restablece la escala antes de la capa de edicion.
var cuerpo = editor.slice(iDibujar, iDibujar + 2000);
check('el editor llama a R.componer (nombre canonico del nucleo)',
    /R\.componer\(ctx, capas\(\)/.test(cuerpo));
check('el editor reestablece el transform antes de la capa de edicion',
    /setTransform\(f2, 0, 0, f2, 0, 0\)/.test(cuerpo));

/* ============ Ejecucion ============ */

var i = 0;
function correr() {
    if (i >= pruebas.length) { fin(); return; }
    var p = pruebas[i++];
    var resultado;
    try {
        resultado = p();
    } catch (e) {
        check('prueba #' + i + ' sin excepcion', false, e.message);
        return correr();
    }
    Promise.resolve(resultado)['catch'](function (e) {
        check('prueba #' + i + ' sin excepcion', false, e.message);
    }).then(function () {
        setTimeout(correr, 0);
    });
}
function fin() {
    if (fallos > 0) {
        console.log('CONTRATO FALLA: ' + fallos + ' de ' + total + ' checks.');
        process.exit(1);
    }
    console.log('CONTRATO OK (' + total + ' checks).');
}
correr();