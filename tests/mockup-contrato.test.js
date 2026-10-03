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
            // La URL identifica la imagen en el trazo de drawImage: permite
            // verificar el z-order y que las capas ocultas no se dibujen.
            self.url = valor;
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
            ops.push('drawImage:' + (img && img.url ? img.url : '?') + '@' +
                Math.round(x) + ',' + Math.round(y) + ',' + Math.round(w) + ',' + Math.round(h));
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
        // El stub de Image marca cada URL, asi que el trazo identifica la capa.
        check('oculta: la capa `oculta` no se dibuja',
            dibuja.length === 1 && dibuja[0].indexOf('pdf:b.png') !== -1, dibuja.join(' | '));
    });
});

pruebas.push(function () {
    var ctx = ctxFalso();
    // Z-order: indice 0 al fondo, indice 1 encima (orden de resolucion).
    var orden = [];
    return R.componer(ctx,
        [capa('img', 'pdf:uno', { x: 0, y: 0, w: 10, h: 10 }),
            capa('img', 'pdf:dos', { x: 0, y: 0, w: 10, h: 10 })],
        {
            resolver: function (c) { return Promise.resolve({ url: c.ref }); },
            contexto: {},
            lienzo: 300
        }).then(function () {
        var trazos = ctx.ops.filter(function (o) { return o.indexOf('drawImage') === 0; });
        check('z-order: primero la capa del fondo, despues la de encima',
            trazos.length === 2 && trazos[0].indexOf('pdf:uno') !== -1
            && trazos[1].indexOf('pdf:dos') !== -1, trazos.join(' | '));
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
var iDibujar = editor.indexOf('function dibujar()');
// Ventana amplia: cubre la llamada a componer, la opcion `limpiar` y el
// `setTransform` que restablece la escala antes de la capa de edicion.
var cuerpo = editor.slice(iDibujar, iDibujar + 2000);
check('el editor llama a R.componer (nombre canonico del nucleo)',
    /R\.componer\(ctx, capas\(\)/.test(cuerpo));
check('el editor NO pide al nucleo que limpie (limpiar: false)',
    /limpiar:\s*false/.test(cuerpo),
    'sin limpiar:false el nucleo borra la capa de edicion');
check('el editor dibuja la capa de edicion DESPUES de componer',
    /\.then\(capaEdicion\)/.test(cuerpo) && /function capaEdicion\(\)\s*\{[\s\S]*dibujarGuias\(\)/.test(cuerpo),
    'la capa de edicion debe invocarse desde el then de componer');
check('el editor reestablece el transform antes de la capa de edicion',
    /setTransform\(f2, 0, 0, f2, 0, 0\)/.test(cuerpo));

// Regresion de los bugs que rompieron el editor en el sitio real: una etiqueta
// HTML sin > de cierre hace que jQuery la interprete como SELECTOR y lance
// "unrecognized expression". Ocurrio DOS veces: el boton de borrar vista y
// los 4 botones de capa (arriba/abajo/ocultar/bloquear). El primer arreglo
// dejo el check limitado a una sola linea, y eso dio falsa confianza.
//
// Por eso se recorren TODOS los literales de etiqueta de los modulos cliente.
// Ojo: node --check NO lo detecta (el literal JS es valido; el defecto es
// semantico: jQuery espera HTML y recibe un selector). Los literales
// concatenados con + se saltan: su cierre puede venir en la siguiente parte.
// Se hace con indexOf, sin regex: el patron de apertura dentro de una
// expresion regular abriria un grupo sin cerrar.
var modulosCliente = ['assets/mockups.js', 'assets/admin.js', 'assets/tienda.js'];
var literalesSinCierre = [];
var literalesVistos = 0;
modulosCliente.forEach(function (rel) {
    var codigo = leer(rel);
    var APD = String.fromCharCode(36, 40) + String.fromCharCode(39, 60);
    var CIERRE = String.fromCharCode(62);
    var i = codigo.indexOf(APD);
    while (i !== -1) {
        var finLiteral = codigo.indexOf(String.fromCharCode(39), i + APD.length);
        if (finLiteral === -1) { break; }
        var html = codigo.slice(i + APD.length, finLiteral);
        var resto = codigo.slice(finLiteral + 1);
        var concat = String(resto).trim().charAt(0) === String.fromCharCode(43);
        literalesVistos++;
        if (!concat && html.charAt(html.length - 1) !== CIERRE) {
            literalesSinCierre.push(rel + String.fromCharCode(58) + html.slice(0, 60));
        }
        i = codigo.indexOf(APD, finLiteral + 1);
    }
});
check('ningun literal jQuery sin > de cierre (tag sin cerrar = selector)',
    literalesSinCierre.length === 0,
    literalesSinCierre.join(String.fromCharCode(32, 124, 32)));
check('el detector de etiquetas realmente recorre literales',
    literalesVistos >= 20,
    'solo vio ' + literalesVistos + ': el check seria inerte');
/* ============ Placeholders e instancias (spec 011, FR-015) ============ */

var ed = leer('assets/mockups.js');
var clickInstancia = '.ec-mk-instancia';
var manejadorInstancia = "$ed.on('click', '.ec-mk-instancia', function";

// Y que el clic este ENLAZADO: tener los botones no basta si nada los escucha.
check('el clic en una instancia inserta esa instancia',
    ed.indexOf(manejadorInstancia) !== -1,
    'hay botones PH-<grupo>-<nn> pero ningun manejador: no insertarian nada');

// El chip y el boton deben ofrecer el placeholder con el prefijo PH-.
check('el editor nombra los placeholders PH-<grupo>',
    ed.indexOf('PH-') !== -1 && ed.indexOf('etiquetaPlaceholder') !== -1);

// Con varias instancias se listan los botones PH-<grupo>-01..nn.
check('el grupo con varias instancias ofrece elegir la instancia',
    ed.indexOf('ec-mk-instancia') !== -1
        && ed.indexOf('data-instancia') !== -1
        && ed.indexOf('etiquetaInstancia') !== -1);

// El indice del ref es 1-based: la #01 es el ref plano (legado).
check('el ref de la instancia es 1-based (#01 = ref plano)',
    ed.indexOf('n > 1 ? String(g.id)') !== -1,
    'si se guardara la #01 como <grupo>#1, el motor la cuenta como instancia 1 de 0');

// No debe quedar el vocabulario viejo en la UI del editor.
check('la UI dice Placeholders, no Huecos',
    ed.indexOf('<h4>Placeholders</h4>') !== -1
        && ed.indexOf('add-hueco') === -1
        && ed.indexOf('+ Hueco') === -1);

/* El indice que espera el nucleo: esValida() acepta 1..cont. */
check('el nucleo acepta el indice de instancia 1-based',
    leer('assets/mockup-render.js').indexOf('indice < 1') !== -1
        && leer('assets/mockup-render.js').indexOf('indice <= (parseInt(grupo.cont, 10) || 1)') !== -1);


/* ============ Miniaturas de capa (T033) y reordenacion de vistas (T036) ============ */

var ed = leer('assets/mockups.js');
var geo = require(path.join(RAIZ, 'assets/mockup-geometria.js'));

// La miniatura va ANTES del nombre (formato [img] nombre).
check('T033: la fila de capa antepone la miniatura',
    ed.indexOf('$li.append(miniaturaCapa(c))') !== -1
        && ed.indexOf('ec-mk-capa-nombre') !== -1);

// Reutiliza resolverCapa: la imagen real si existe, no un marcador fijo.
check('T033: la miniatura muestra la imagen real cuando la hay',
    ed.indexOf('if (r && r.url) {') !== -1,
    'debe reusar el resolver de la capa, no un marcador fijo');
// El CUERPO de la funcion (no su llamada) debe usar el render.
var cuerpoMini = ed.slice(ed.indexOf('function miniaturaCapa'), ed.indexOf('function pintarCapas'));
check('T033: el cuerpo de miniaturaCapa resuelve el render de la capa',
    cuerpoMini.indexOf('resolverCapa(c)') !== -1 && cuerpoMini.indexOf('r.url') !== -1);


// Sin recurso, cae al swatch de color del grupo.
check('T033: sin recurso cae al swatch de color del grupo',
    ed.indexOf('ec-mk-capa-mini-swatch') !== -1
        && ed.indexOf('ec-mk-capa-mini-img') !== -1);

// El nucleo de geometria expone reordenar y el editor lo usa.
check('T036: el nucleo expone reordenar(lista, desde, hasta)',
    typeof geo.reordenar === 'function');
check('T036: el editor reordena las vistas con la funcion del nucleo',
    ed.indexOf('G.reordenar(estado.mockups') !== -1);

// Arrastre con pointer events sobre la galeria.
check('T036: arrastre de vistas enlazado con pointerdown',
    ed.indexOf("$ed.on('pointerdown', '.ec-mk-mockup[data-arrastre]") !== -1,
    'hay CSS y marca arrastrable, pero si nada escucha no hay arrastre');

// Un clic simple NO debe reordenar: hace falta umbral.
check('T036: umbral de arrastre (un clic no reordena)',
    ed.indexOf('Math.abs(dx) < 6') !== -1
        && ed.indexOf('!arrastreVista.movido') !== -1);

// La vista seleccionada sigue a su nueva posicion.
check('T036: la vista seleccionada sigue a su nueva posicion',
    ed.indexOf('estado.actual = hasta') !== -1
        && ed.indexOf('estado.actual = estado.actual - 1') !== -1);
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