/**
 * mockups.js - Editor de mockups del admin (spec 011, T014-T020, T025-T027).
 *
 * El mockup es la "fotografia" simulada 300x300px del producto en uso: capas
 * `img` (fotos del PDF `pdfs/{nombre}/mockups/` o del catalogo `img:{id}`) y
 * `placeholder` (huecos del PDF, `{grupo}` o `{grupo}#{indice}` 1-based), cada una con
 * geometria (x/y/w/h/rot/sesgo) y ajustes que afectan SOLO al mockup.
 *
 * Reglas de la feature:
 * - La COMPOSICION la dibuja `PMUMockup` (assets/mockup-render.js), que es la
 *   unica funcion de render del sistema y la comparte con la ficha. Aqui no
 *   hay logica de dibujo de capas.
 * - La GEOMETRIA la calcula `PMUGeometria` (assets/mockup-geometria.js), sin
 *   DOM: aqui solo se traducen eventos de puntero.
 * - El render del texto lo produce el boton "Probar" del panel del grupo
 *   (store `PersonalizadorPDF.previews`); el editor no renderiza nada.
 * - La salida son siempre 300x300 px; el zoom del lienzo es solo una lupa.
 */
jQuery(function ($) {
    'use strict';

    var cfg = window.PersonalizadorPDF || {};
    // pmu-core expone el POST unico (mockups.js depende de admin.js, no de fetch suelto).
    var api = cfg.pmuPost || null;
    var aviso = cfg.pmuAviso || null;
    var datos = cfg.mockups || {};
    var $raiz = $('.ec-acordeon-mockups .ec-acordeon-cuerpo');
    if (!$raiz.length || !datos.pdf) {
        return;
    }
    if (!window.PMUMockup || !window.PMUGeometria) {
        return; // el nucleo no encolado: la consola sigue operativa
    }
    var R = window.PMUMockup;
    var G = window.PMUGeometria;

    var LIENZO = 300;              // salida fija (norma vigente)
    var ZOOMS = [1, 1.5, 2, 3];    // lupa del lienzo de trabajo
    var grupos = datos.grupos || [];

    /** Estado de la sesion de edicion (unica fuente de verdad del editor). */
    var estado = {
        mockups: (datos.mockups || []).map(function (m) { return normalizarMockup(m); }),
        actual: 0,
        seleccion: -1,
        zoom: 2,
        verTexto: true,
        guardado: 'guardado',
        pila: [],
        redo: [],
        avisoCapa: null,
        arrastre: null,
        guias: []
    };

    function normalizarMockup(m) {
        var avisos = [];
        var capas = (m.capas || []).map(function (c) {
            var n = G.normalizarCapa(c);
            avisos = avisos.concat(n.avisos);
            return n.capa;
        });
        return {
            id: String(m.id || ''),
            titulo: m.titulo || '',
            creado: m.creado || '',
            capas: capas,
            avisos: avisos
        };
    }

    function mockup() { return estado.mockups[estado.actual] || null; }
    function capas() { return (mockup() && mockup().capas) || []; }
    function capa() {
        var c = capas();
        return estado.seleccion >= 0 ? (c[estado.seleccion] || null) : null;
    }
    /** Contexto para el nucleo: fotos del PDF + catalogo + grupos. */
    function contexto() {
        return { fotos: datos.fotos || {}, imagenes: datos.imagenes || [], grupos: grupos };
    }
    /** Nombre legible de una capa (usado en lista, etiqueta y aviso). */
    function nombreCapa(c) {
        if (!c) { return ''; }
        if (c.nombre) { return c.nombre; }
        if (c.tipo === 'img') { return 'Foto: ' + c.ref; }
        return etiquetaPlaceholder(c.ref);
    }
    /**
     * Nombre legible de un placeholder (FR-015). El `ref` sigue siendo
     * `{grupo}` o `{grupo}#{n}` (n 1-based, el que usa el motor); esto es
     * solo presentacion: los mockups ya guardados siguen funcionando.
     */
    function etiquetaPlaceholder(ref) {
        var partes = String(ref || '').split('#');
        var base = 'PH-' + partes[0];
        if (partes.length < 2 || !partes[1]) { return base; }
        var n = parseInt(partes[1], 10);
        return isNaN(n) ? base : base + '-0' + n;
    }

    /** Etiqueta corta de la capa (en el lienzo). */
    /** Etiqueta de una instancia concreta: PH-FF0000-01 (1-based). */
    function etiquetaInstancia(idGrupo, n) {
        var base = etiquetaPlaceholder(idGrupo);
        var k = parseInt(n, 10);
        if (isNaN(k) || k < 1) { return base; }
        return base + '-' + (k < 10 ? '0' : '') + k;
    }
    function etiquetaRef(c) {
        return etiquetaPlaceholder(c.ref);
    }

    /* ============ Montaje (T014) ============ */

    function plantilla() {
        return '' +
            '<div class="ec-mk">' +
            '  <div class="ec-mk-cab">' +
            '    <span class="ec-mk-cab-titulo">Editor de mockups</span>' +
            '    <span class="ec-mk-acciones ec-mk-cab-acciones">' +
            '      <button type="button" class="button button-small" data-mk="guardar">Guardar ahora</button>' +
            '      <span class="ec-mk-estado" aria-live="polite"></span>' +
            '    </span>' +
            '  </div>' +
            '  <div class="ec-mk-cuerpo">' +
            '    <div class="ec-mk-izq">' +
            '      <div class="ec-mk-lienzo-barra">' +
            '        <label for="ec-mk-zoom">Zoom' +
            '          <select id="ec-mk-zoom" class="ec-mk-zoom"></select>' +
            '        </label>' +
            '        <label><input type="checkbox" class="ec-mk-ver-texto" checked> Ver texto real</label>' +
            '        <span class="ec-mk-marcas"></span>' +
            '      </div>' +
            '      <div class="ec-mk-lienzo"><canvas width="300" height="300"></canvas></div>' +
            '      <p class="ec-mk-ayuda">Arrastra para mover, toma los tiradores para redimensionar y el ' +
            '        tirador redondo para rotar. Con la tecla de modificacion mantienes la proporcion; ' +
            '        los imanes pegan al centro y a los bordes.</p>' +
            '      <div class="ec-mk-alertas" aria-live="polite"></div>' +
            '      <div class="ec-mk-acciones" style="margin-top:8px">' +
            '        <button type="button" class="button button-small" data-mk="ver-cliente">Ver como lo ve el cliente</button>' +
            '      </div>' +
            '      <div class="ec-mk-vistas-cliente" style="margin-top:8px"></div>' +
            '    </div>' +
            '    <div class="ec-mk-der">' +
            '      <div class="ec-mk-panel">' +
            '        <h4>Vistas del PDF</h4>' +
            '        <ul class="ec-mk-mockups"></ul>' +
            '        <div class="ec-mk-acciones">' +
            '          <button type="button" class="button button-small button-primary" data-mk="nuevo">Nueva vista</button>' +
            '          <button type="button" class="button button-small" data-mk="duplicar">Duplicar</button>' +
            '          <button type="button" class="button button-small button-link-delete" data-mk="eliminar-mockup">Eliminar</button>' +
            '          <label class="ec-block-label" style="margin:0"><input type="checkbox" class="ec-mk-omisible" name="preview_omisible" value="1"> Vista previa omisible</label>' +
            '        </div>' +
            '        <p class="description" style="margin-top:6px">Titulo: ' +
            '          <input type="text" class="ec-mk-titulo" maxlength="200" style="width:100%"></p>' +
            '      </div>' +
            '      <div class="ec-mk-panel">' +
            '        <h4>Capas</h4>' +
            '        <ul class="ec-mk-capas"></ul>' +
            '        <div class="ec-mk-acciones">' +
            '          <button type="button" class="button button-small" data-mk="add-foto">+ Foto</button>' +
            '          <button type="button" class="button button-small" data-mk="add-catalogo">+ Catalogo</button>' +
            '          <button type="button" class="button button-small" data-mk="add-placeholder">+ Placeholder</button>' +
            '        </div>' +
            '        <div class="ec-mk-acciones">' +
            '          <button type="button" class="button button-small" data-mk="subir" title="Subir capa">Subir</button>' +
            '          <button type="button" class="button button-small" data-mk="bajar" title="Bajar capa">Bajar</button>' +
            '          <button type="button" class="button button-small" data-mk="duplicar-capa">Duplicar</button>' +
            '          <button type="button" class="button button-small button-link-delete" data-mk="borrar-capa">Quitar</button>' +
            '        </div>' +
            '        <div class="ec-mk-acciones">' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="izquierda">Izq.</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="centro_h">Centro H</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="derecha">Der.</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="arriba">Arriba</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="centro_v">Centro V</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="abajo">Abajo</button>' +
            '        </div>' +
            '      </div>' +
            '      <div class="ec-mk-panel ec-mk-panel-props" hidden>' +
            '        <h4>Capa seleccionada</h4>' +
            '        <div class="ec-mk-props"></div>' +
            '      </div>' +
            '      <div class="ec-mk-panel">' +
            '        <h4>Fotos del PDF</h4>' +
            '        <ul class="ec-mk-minis ec-mk-fotos"></ul>' +
            '        <p class="ec-mk-vacio">Arrastra un archivo de imagen sobre el lienzo para subirlo y usarlo.</p>' +
            '      </div>' +
            '      <div class="ec-mk-panel">' +
            '        <h4>Catalogo de imagenes</h4>' +
            '        <input type="search" class="ec-mk-buscar ec-mk-buscar-catalogo" placeholder="Buscar imagenes...">' +
            '        <ul class="ec-mk-minis ec-mk-catalogo"></ul>' +
            '        <p class="ec-mk-vacio">Sin imagenes en el catalogo del proyecto.</p>' +
            '      </div>' +
            '      <div class="ec-mk-panel">' +
            '        <h4>Placeholders</h4>' +
            '        <ul class="ec-mk-grupos"></ul>' +
            '        <p class="ec-mk-vacio">Este PDF no tiene grupos detectados.</p>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '<p class="description">Filtros y encuadre afectan SOLO al mockup: el PNG del pool y el PDF ' +
            'final van limpios (el Motor no aplica filtros).</p>';
    }

    $raiz.prepend(plantilla());
    var $ed = $raiz.find('.ec-mk');
    var $canvas = $ed.find('.ec-mk-lienzo canvas');
    var lienzo = $canvas[0];
    var ctx = lienzo.getContext('2d');
    var $props = $ed.find('.ec-mk-props');
    var $panelProps = $ed.find('.ec-mk-panel-props');


    /* ============ Lienzo de trabajo (T015) ============ */

    /** Factor de escala del backing store: nitidez en pantallas HiDPI. */
    function factor() {
        var dpr = window.devicePixelRatio || 1;
        return dpr * estado.zoom;
    }

    /** Reajusta el canvas al zoom y al tamaño real de la pantalla. */
    function ajustarLienzo() {
        var f = factor();
        lienzo.width = Math.round(LIENZO * f);
        lienzo.height = Math.round(LIENZO * f);
        lienzo.style.width = Math.round(LIENZO * estado.zoom) + 'px';
        lienzo.style.height = Math.round(LIENZO * estado.zoom) + 'px';
    }

    function pintarZooms() {
        var $sel = $ed.find('.ec-mk-zoom').empty();
        ZOOMS.forEach(function (z) {
            $sel.append($('<option>').attr('value', z).text(Math.round(z * 100) + ' %'));
        });
        $sel.val(String(estado.zoom));
    }

    /** Convierte un punto de pantalla al espacio logico 300x300. */
    function aLogico(ev) {
        var caja = lienzo.getBoundingClientRect();
        var escala = caja.width > 0 ? LIENZO / caja.width : 1;
        return { x: (ev.clientX - caja.left) * escala, y: (ev.clientY - caja.top) * escala };
    }

    /* ============ Resolucion de recursos (T025) ============ */

    /**
     * Resuelve el recurso de una capa contra el contexto del editor.
     * El placeholder usa el render real del grupo si el boton "Probar" ya lo
     * genero (D2); si no hay render, devuelve null y el nucleo dibuja la caja
     * neutra de encuadre.
     */
    function resolverCapa(c) {
        if (!c) { return null; }
        if (c.tipo === 'img') {
            var url = R.urlDeImagen(c.ref, contexto());
            return url ? { url: url } : null;
        }
        if (!estado.verTexto) { return null; }
        var partes = String(c.ref || '').split('#');
        var g = null;
        grupos.forEach(function (x) { if (String(x.id) === partes[0]) { g = x; } });
        if (!g) { return null; }
        var previews = (cfg.previews || {});
        var prev = previews[String(g.id)];
        if (!prev || !prev.url) { return null; }
        return { url: prev.url, w: prev.w || g.w, h: prev.h || g.h };
    }


    /* ============ Dibujo (T015-T019) ============ */

    /**
     * Dibuja la composicion y ENCIMA la capa de edicion.
     *
     * Orden obligatorio: el nucleo compone de forma asincrona (carga de
     * imagenes), asi que la capa de edicion se dibuja en su `.then`. Si se
     * dibujara antes, las capas se taparian los tiradores y las guias y el
     * admin no veria que tiene seleccionada. Por eso `limpiar: false`: el
     * lienzo lo limpia este editor, que es quien conoce el zoom y la densidad.
     */
    function dibujar() {
        if (!ctx) { return; }
        var f = factor();
        ctx.setTransform(f, 0, 0, f, 0, 0);
        ctx.clearRect(0, 0, LIENZO, LIENZO);
        if (!mockup()) { return; }
        var f2 = factor();
        function capaEdicion() {
            ctx.setTransform(f2, 0, 0, f2, 0, 0);
            dibujarGuias();
            dibujarSeleccion();
        }
        R.componer(ctx, capas(), {
            resolver: resolverCapa,
            contexto: contexto(),
            lienzo: LIENZO,
            limpiar: false
        }).then(function (info) {
            if (info && info.invalidas.length) {
                marcarInvalidas(info.invalidas.map(function (i) { return i.indice; }));
            }
            if (info && info.discrepancias.length) {
                avisarProporcion(info.discrepancias.map(function (d) { return d.indice; }));
            }
        })['catch'](function () {
            // Si la composicion falla, la capa de edicion sigue siendo usable.
        }).then(capaEdicion);
    }

    /** Marco del lienzo 300x300 dentro del area de trabajo. */
    function dibujarGuias() {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, .25)';
        ctx.lineWidth = 1 / factor();
        ctx.strokeRect(0.5, 0.5, LIENZO - 1, LIENZO - 1);
        // Lineas de thirds: ayuda a encuadrar sin salirse del lienzo.
        ctx.strokeStyle = 'rgba(0, 0, 0, .08)';
        [100, 200].forEach(function (v) {
            ctx.beginPath();
            ctx.moveTo(v, 0);
            ctx.lineTo(v, LIENZO);
            ctx.moveTo(0, v);
            ctx.lineTo(LIENZO, v);
            ctx.stroke();
        });
        (estado.guias || []).forEach(function (g) {
            ctx.strokeStyle = '#e14f9b';
            ctx.lineWidth = 1 / factor();
            ctx.beginPath();
            if (g.eje === 'x') {
                ctx.moveTo(g.pos, 0);
                ctx.lineTo(g.pos, LIENZO);
            } else {
                ctx.moveTo(0, g.pos);
                ctx.lineTo(LIENZO, g.pos);
            }
            ctx.stroke();
        });
        ctx.restore();
    }

    /** Tiradores, medidas y nombre de la capa seleccionada (T019). */
    function dibujarSeleccion() {
        var c = capa();
        if (!c) { return; }
        var f = factor();
        var cx = c.x + c.w / 2;
        var cy = c.y + c.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        if (c.rot) { ctx.rotate(c.rot * Math.PI / 180); }
        if (c.sesgo) { ctx.transform(1, 0, c.sesgo, 1, 0, 0); }
        ctx.strokeStyle = '#2271b1';
        ctx.lineWidth = 1.5 / f;
        ctx.setLineDash([]);
        ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
        if (!c.bloqueada) {
            G.TIRADORES.forEach(function (t) {
                var p = posicionTirador(c, t);
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#2271b1';
                ctx.lineWidth = 1.5 / f;
                ctx.fillRect(p.x - 4 / f, p.y - 4 / f, 8 / f, 8 / f);
                ctx.strokeRect(p.x - 4 / f, p.y - 4 / f, 8 / f, 8 / f);
            });
        }
        ctx.restore();
        // Tirador de rotacion (arriba del centro).
        var rot = G.puntosDeRotacion(c, { x: cx, y: cy - 1 });
        var ang = -1.5707963 + (c.rot * Math.PI / 180);
        var radio = Math.max(c.w, c.h) / 2 + 14;
        var hx = cx + radio * Math.cos(ang);
        var hy = cy + radio * Math.sin(ang);
        ctx.save();
        ctx.strokeStyle = '#2271b1';
        ctx.lineWidth = 1 / f;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = c.bloqueada ? '#c3c4c7' : '#fff';
        ctx.strokeStyle = '#2271b1';
        ctx.beginPath();
        ctx.arc(hx, hy, 5 / f, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // Etiqueta con medida y nombre (fuera de la rotacion para no girarla).
        var etiqueta = nombreCapa(c) + ' — ' + Math.round(c.w) + 'x' + Math.round(c.h) + ' px';
        ctx.save();
        ctx.font = '11px sans-serif';
        var ancho = ctx.measureText(etiqueta).width + 10;
        var lx = Math.min(Math.max(c.x, 0), Math.max(0, LIENZO - ancho));
        var ly = c.y > 16 ? c.y - 15 : c.y + c.h + 3;
        ctx.fillStyle = 'rgba(255, 255, 255, .92)';
        ctx.fillRect(lx, ly, ancho, 14);
        ctx.strokeStyle = '#2271b1';
        ctx.lineWidth = 1 / f;
        ctx.strokeRect(lx, ly, ancho, 14);
        ctx.fillStyle = '#1d2327';
        ctx.textBaseline = 'middle';
        ctx.fillText(etiqueta, lx + 5, ly + 7.5);
        ctx.restore();
    }

    /** Posicion de un tirador de redimension en el espacio logico local. */
    function posicionTirador(c, tirador) {
        var hx = c.w / 2;
        var hy = c.h / 2;
        var x = tirador.indexOf('w') !== -1 ? -hx : (tirador.indexOf('e') !== -1 ? hx : 0);
        var y = tirador.indexOf('n') !== -1 ? -hy : (tirador.indexOf('s') !== -1 ? hy : 0);
        var cx = c.x + c.w / 2;
        var cy = c.y + c.h / 2;
        var rad = (c.rot || 0) * Math.PI / 180;
        var lx = x + c.sesgo * y;
        return { x: cx + lx * Math.cos(rad) - y * Math.sin(rad), y: cy + lx * Math.sin(rad) + y * Math.cos(rad) };
    }

    /** Cual de los tiradores (o el de rotacion) esta bajo el punto. */
    function tiradorEn(p) {
        var c = capa();
        if (!c || c.bloqueada) { return ''; }
        var tol = 6 / estado.zoom;
        var ang = -1.5707963 + ((c.rot || 0) * Math.PI / 180);
        var radio = Math.max(c.w, c.h) / 2 + 14;
        var hx = c.x + c.w / 2 + radio * Math.cos(ang);
        var hy = c.y + c.h / 2 + radio * Math.sin(ang);
        if (Math.abs(p.x - hx) <= tol * 1.6 && Math.abs(p.y - hy) <= tol * 1.6) { return 'rotar'; }
        for (var i = 0; i < G.TIRADORES.length; i++) {
            var pos = posicionTirador(c, G.TIRADORES[i]);
            if (Math.abs(p.x - pos.x) <= tol && Math.abs(p.y - pos.y) <= tol) { return G.TIRADORES[i]; }
        }
        return '';
    }


    /* ============ Manipulacion directa (T016-T018) ============ */

    /** Registra un paso en el historial (T041): un gesto, no un mousemove. */
    function marcarPaso() {
        estado.pila.push(JSON.stringify(estado.mockups));
        if (estado.pila.length > 50) { estado.pila.shift(); }
        estado.redo = [];
    }

    /**
     * Marca el estado como pendiente. `agendar !== false` ademas encola el
     * autoguardado: durante un arrastre se llama con `false` para no generar
     * un POST por cada movimiento del raton (el paso se confirma al soltar).
     */
    function sinGuardar(agendar) {
        estado.guardado = 'sin-guardar';
        pintarEstado();
        if (agendar !== false) {
            agendarGuardado();
        }
    }

    lienzo.addEventListener('pointerdown', function (ev) {
        if (!mockup()) { return; }
        var p = aLogico(ev);
        var tir = tiradorEn(p);
        if (tir) {
            estado.arrastre = { tipo: tir, inicio: p, original: capa() ? Object.assign({}, capa()) : null };
        } else {
            var i = G.acertarCapa(capas(), p.x, p.y);
            estado.seleccion = i;
            if (i >= 0) {
                estado.arrastre = { tipo: 'mover', inicio: p, original: Object.assign({}, capas()[i]) };
            }
        }
        refrescar();
        if (estado.arrastre && lienzo.setPointerCapture) {
            lienzo.setPointerCapture(ev.pointerId);
        }
        ev.preventDefault();
    });

    lienzo.addEventListener('pointermove', function (ev) {
        var p = aLogico(ev);
        if (!estado.arrastre) {
            // Cursor contextual: el admin ve de inmediato que puede agarrar.
            var t = tiradorEn(p);
            lienzo.className = t === 'rotar' ? 'ec-mk-rotar'
                : (t ? 'ec-mk-tirador' : (G.acertarCapa(capas(), p.x, p.y) >= 0 ? 'ec-mk-mover' : ''));
            return;
        }
        var a = estado.arrastre;
        var c = capa();
        if (!c || !a.original) { return; }
        if (a.tipo === 'mover') {
            var dx = p.x - a.inicio.x;
            var dy = p.y - a.inicio.y;
            var movida = G.acotar({
                x: a.original.x + dx, y: a.original.y + dy,
                w: a.original.w, h: a.original.h
            });
            var imanes = G.ajustarImanes(movida, { lienzo: LIENZO });
            c.x = imanes.x;
            c.y = imanes.y;
            estado.guias = imanes.guias;
        } else if (a.tipo === 'rotar') {
            var ang = G.puntosDeRotacion(c, p, { paso: ev.shiftKey ? 1 : 15 });
            c.rot = ang.angulo;
            estado.guias = [];
        } else {
            c = G.redimensionarDesdeTirador(a.original, a.tipo, p.x - a.inicio.x, p.y - a.inicio.y, {
                proporcion: ev.shiftKey,
                lienzo: LIENZO
            });
            var cc = capa();
            cc.x = c.x; cc.y = c.y; cc.w = c.w; cc.h = c.h;
            estado.guias = [];
        }
        sinGuardar(false);
        dibujar();
        pintarProps();
    });

    function finArrastre() {
        if (!estado.arrastre) { return; }
        estado.arrastre = null;
        estado.guias = [];
        marcarPaso();
        // El gesto se confirma al soltar: aqui se encola el autoguardado.
        sinGuardar();
        dibujar();
        refrescar();
    }
    lienzo.addEventListener('pointerup', finArrastre);
    lienzo.addEventListener('pointercancel', finArrastre);

    /* ============ Refrescos de paneles (T033-T036) ============ */

    function refrescar() {
        pintarEstado();
        pintarMockups();
        pintarCapas();
        pintarProps();
        pintarFotos();
        pintarCatalogo();
        pintarGrupos();
        pintarAlertas();
        dibujar();
    }


    function pintarEstado() {
        var $e = $ed.find('.ec-mk-estado');
        var textos = {
            guardado: 'Guardado',
            sin_guardar: 'Sin guardar',
            guardando: 'Guardando...',
            error: 'No se pudo guardar'
        };
        $e.text(textos[estado.guardado] || '').removeClass('ec-guardado ec-sin-guardar ec-guardando ec-error')
            .addClass('ec-' + estado.guardado);
    }

    function pintarAlertas() {
        var $a = $ed.find('.ec-mk-alertas').empty();
        var invalidas = (estado.avisoCapa || []).filter(function (i) { return capas()[i]; });
        if (invalidas.length) {
            $a.append($('<p class="ec-mk-alerta-foto">').text(
                invalidas.length + ' capa(s) sin recurso: ' + invalidas.map(function (i) {
                    return etiquetaRef(capas()[i]);
                }).join(', ') + '. Se conservan: volve a subir la foto o re-analiza el PDF.'));
        }
        var m = mockup();
        if (m && m.avisos && m.avisos.length) {
            $a.append($('<p class="ec-mk-alerta-foto">').text(m.avisos[0]));
        }
    }

    function marcarInvalidas(lista) {
        estado.avisoCapa = lista || [];
        pintarAlertas();
    }

    function avisarProporcion(lista) {
        var $a = $ed.find('.ec-mk-alertas');
        var ya = $a.find('.ec-mk-alerta-prop').length > 0;
        if (lista && lista.length && !ya) {
            $a.append($('<p class="ec-mk-alerta-prop ec-mk-alerta-foto">').text(
                'La proporcion de la capa no es la del recurso: se encaja sin deformar y quedan ' +
                'bordes transparentes. Ajusta el alto o el ancho para que coincidan.'));
        }
    }

    function pintarMockups() {
        var $ul = $ed.find('.ec-mk-mockups').empty();
        if (!estado.mockups.length) {
            $ul.append('<li class="description">Todavia no hay vistas. Crea la primera.</li>');
        }
        estado.mockups.forEach(function (m, i) {
            var $li = $('<li>').toggleClass('ec-mk-mockup', true)
                .toggleClass('ec-sel', i === estado.actual)
                .attr('data-i', i).attr('tabindex', '0')
                .attr('role', 'button')
                .attr('aria-label', 'Vista ' + (i + 1) + (m.titulo ? ': ' + m.titulo : ''));
            var c = document.createElement('canvas');
            c.width = LIENZO;
            c.height = LIENZO;
            $li.append(c);
            $li.append($('<span>').text(m.titulo || m.id));
            $li.append($('<button type="button" class="ec-mk-x" data-borrar="' + i + '">')
                .attr('aria-label', 'Eliminar la vista ' + (i + 1)).text('×'));
            $ul.append($li);
            // Miniatura en vivo con el nucleo (sin capas marco de editor).
            R.componer(c.getContext('2d'), m.capas, {
                resolver: resolverCapa, contexto: contexto(), lienzo: LIENZO
            });
        });
        $ed.find('.ec-mk-titulo').val(mockup() ? (mockup().titulo || '') : '');
        $ed.find('.ec-mk-omisible').prop('checked', !!datos.preview_omisible)
            .prop('disabled', !estado.mockups.length);
    }

    function pintarCapas() {
        var $ul = $ed.find('.ec-mk-capas').empty();
        var lista = capas();
        if (!lista.length) {
            $ul.append('<li class="description">Sin capas: agrega una foto o un placeholder.</li>');
        }
        // Se lista de arriba hacia abajo: la ultima del array esta al fondo.
        for (var i = lista.length - 1; i >= 0; i--) {
            (function (indice) {
                var c = lista[indice];
                var invalida = (estado.avisoCapa || []).indexOf(indice) !== -1;
                var $li = $('<li>').toggleClass('ec-mk-capa', true)
                    .toggleClass('ec-sel', indice === estado.seleccion)
                    .toggleClass('ec-invalida', invalida)
                    .toggleClass('ec-oculta', !!c.oculta)
                    .attr('data-i', indice).attr('tabindex', '0')
                    .attr('role', 'button')
                    .attr('aria-label', nombreCapa(c) + (c.oculta ? ' (oculta)' : '')
                        + (c.bloqueada ? ' (bloqueada)' : ''));
                $li.append($('<span class="ec-mk-capa-nombre">').text(nombreCapa(c)));
                $li.append($('<button type="button" class="ec-mk-capa-btn" data-acc="arriba">')
                    .attr('aria-label', 'Subir la capa ' + nombreCapa(c)).text('▲'));
                $li.append($('<button type="button" class="ec-mk-capa-btn" data-acc="abajo">')
                    .attr('aria-label', 'Bajar la capa ' + nombreCapa(c)).text('▼'));
                $li.append($('<button type="button" class="ec-mk-capa-btn" data-acc="ocultar">')
                    .attr('aria-label', (c.oculta ? 'Mostrar' : 'Ocultar') + ' la capa ' + nombreCapa(c))
                    .text(c.oculta ? '◻' : '◼'));
                $li.append($('<button type="button" class="ec-mk-capa-btn" data-acc="bloquear">')
                    .attr('aria-label', (c.bloqueada ? 'Desbloquear' : 'Bloquear') + ' la capa ' + nombreCapa(c))
                    .text(c.bloqueada ? '🔒' : '🔓'));
                $ul.append($li);
            }(i));
        }
    }


    function pintarFotos() {
        var $ul = $ed.find('.ec-mk-fotos').empty();
        var usadas = {};
        capas().forEach(function (c) { if (c.tipo === 'img') { usadas[c.ref] = true; } });
        var fotos = datos.fotos || {};
        var nombres = Object.keys(fotos);
        $ed.find('.ec-mk-fotos').siblings('.ec-mk-vacio').toggle(!nombres.length);
        nombres.forEach(function (nombre) {
            var $li = $('<li>').toggleClass('ec-mk-mini', true)
                .toggleClass('ec-usada', !!usadas['pdf:' + nombre] || !!usadas[nombre])
                .attr('tabindex', '0').attr('role', 'button')
                .attr('data-foto', nombre)
                            .attr('aria-label', 'Agregar '
                                + etiquetaInstancia(g.id, n) + ' de ' + g.w
                                + ' por ' + g.h + ' pixeles')
            $li.append($('<span>').text(nombre));
            $ul.append($li);
        });
    }

    function pintarCatalogo() {
        var $ul = $ed.find('.ec-mk-catalogo').empty();
        var filtro = String($ed.find('.ec-mk-buscar-catalogo').val() || '').toLowerCase();
        var usadas = {};
        capas().forEach(function (c) { if (c.tipo === 'img') { usadas[c.ref] = true; } });
        var items = (datos.imagenes || []).filter(function (it) {
            if (!filtro) { return true; }
            return String(it.title || it.file).toLowerCase().indexOf(filtro) !== -1
                || String(it.cats || '').toLowerCase().indexOf(filtro) !== -1;
        });
        $ed.find('.ec-mk-catalogo').siblings('.ec-mk-vacio')
            .toggle(!(datos.imagenes || []).length);
        items.forEach(function (it) {
            var ref = 'img:' + it.id;
            var $li = $('<li>').toggleClass('ec-mk-mini', true)
                .toggleClass('ec-usada', !!usadas[ref])
                .attr('tabindex', '0').attr('role', 'button')
                .attr('data-img', it.id)
                            .attr('aria-label', 'Agregar '
                                + etiquetaInstancia(g.id, n) + ' de ' + g.w
                                + ' por ' + g.h + ' pixeles')
            $li.append($('<span>').text(it.title || it.file));
            $ul.append($li);
        });
    }

    function pintarGrupos() {
        var $ul = $ed.find('.ec-mk-grupos').empty();
        $ed.find('.ec-mk-grupos').siblings('.ec-mk-vacio').toggle(!grupos.length);
        grupos.forEach(function (g) {
            var cont = parseInt(g.cont, 10) || 1;
            var $li = $('<li>');
            $li.append($('<button type="button" class="ec-mk-grupo">')
                .attr('data-grupo', g.id)
                .attr('aria-label', 'Agregar el placeholder '
                    + etiquetaPlaceholder(g.id) + ' de ' + g.w + ' por '
                    + g.h + ' pixeles')
                .append($('<span class="swatch">').css('background', '#' + g.id))
                .append($('<span class="ec-mk-grupo-info">')
                    .append($('<b>').text(etiquetaPlaceholder(g.id)))
                    .append($('<span class="description">').text(' '
                        + g.w + '×' + g.h + ' px · '
                        + cont + ' instancia' + (cont > 1 ? 's' : '')))));
            // Con varias instancias se listan, para poder elegir una concreta
            // (FR-015). El chip del grupo inserta siempre la #01.
            if (cont > 1) {
                var $inst = $('<ul class="ec-mk-instancias">');
                for (var n = 1; n <= cont; n++) {
                    var et = etiquetaInstancia(g.id, n);
                    var $b = $('<button type="button" class="ec-mk-instancia">');
                    $b.attr('data-grupo', g.id);
                    $b.attr('data-instancia', n);
                    $b.attr('aria-label', 'Agregar ' + et
                        + ' de ' + g.w + ' por ' + g.h
                        + ' pixeles');
                    $b.text(et);
                    $inst.append($('<li>').append($b));
                }
                $li.append($inst);
            }
        });
    }
    /* ============ Propiedades y ajustes (T020, T035) ============ */

    var AJUSTES = [
        { k: 'brillo', etiqueta: 'Brillo', min: 0, max: 200, def: 100, paso: 1 },
        { k: 'contraste', etiqueta: 'Contraste', min: 0, max: 200, def: 100, paso: 1 },
        { k: 'saturacion', etiqueta: 'Saturacion', min: 0, max: 200, def: 100, paso: 1 },
        { k: 'gama', etiqueta: 'Gama', min: 0, max: 200, def: 100, paso: 1 },
        { k: 'opacidad', etiqueta: 'Opacidad', min: 0, max: 100, def: 100, paso: 1 },
        { k: 'desenfoque', etiqueta: 'Desenfoque', min: 0, max: 20, def: 0, paso: 0.5 },
        { k: 'tono', etiqueta: 'Tono', min: -180, max: 180, def: 0, paso: 1 }
    ];

    function valorAjuste(c, k) {
        var f = (c && c.filtros) ? c.filtros : {};
        return f[k] === undefined ? null : f[k];
    }

    function pintarProps() {
        var c = capa();
        if (!c) {
            $panelProps.attr('hidden', true);
            $props.empty();
            return;
        }
        $panelProps.removeAttr('hidden');
        var html = '';
        [['x', 'X', 0], ['y', 'Y', 0], ['w', 'Ancho', 1], ['h', 'Alto', 1],
            ['rot', 'Rotacion', 1], ['sesgo', 'Sesgo', 0.01]].forEach(function (f) {
            html += '<label>' + f[1] + ' <input type="number" class="ec-mk-geo" data-geo="' + f[0]
                + '" step="' + f[2] + '" value="' + (Math.round((c[f[0]] || 0) * 100) / 100) + '"></label>';
        });
        html += '<div class="ec-mk-seccion">Ajustes (solo el mockup)</div>';
        AJUSTES.forEach(function (a) {
            var v = valorAjuste(c, a.k);
            html += '<label class="ec-mk-ancho">' + a.etiqueta
                + '<span class="ec-mk-slider">'
                + '<input type="range" class="ec-mk-aj" data-aj="' + a.k + '" min="' + a.min
                + '" max="' + a.max + '" step="' + a.paso + '" value="' + (v === null ? a.def : v) + '">'
                + '<output>' + (v === null ? a.def : v) + '</output></span></label>';
        });
        html += '<label class="ec-mk-ancho">Modo de fusion <select class="ec-mk-modo">'
            + '<option value="normal">normal</option>'
            + '<option value="multiply">multiplicar (impresion)</option>'
            + '</select></label>';
        html += '<label class="ec-mk-ancho">Nombre de la capa <input type="text" class="ec-mk-nombre-capa"'
            + ' maxlength="60" value="' + $('<div>').text(c.nombre || '').html() + '"></label>';
        html += '<div class="ec-mk-acciones">'
            + '<button type="button" class="button button-small" data-mk="reset">Restablecer ajustes</button>'
            + '</div>';
        $props.html(html);
        $props.find('.ec-mk-modo').val(c.modo || 'normal');
    }


    /* ============ Mutaciones de mockups y capas (T028-T037) ============ */

    function nuevoMockup(base) {
        var n = 1;
        var ids = estado.mockups.map(function (m) { return m.id; });
        while (ids.indexOf('mockup-' + n) !== -1) { n++; }
        var nuevo = {
            id: 'mockup-' + n,
            titulo: base ? ((base.titulo || '') + ' (copia)') : '',
            creado: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
            capas: base ? JSON.parse(JSON.stringify(base.capas || [])) : [],
            avisos: []
        };
        estado.mockups.push(nuevo);
        estado.actual = estado.mockups.length - 1;
        estado.seleccion = -1;
        marcarPaso();
        sinGuardar();
        refrescar();
        return nuevo;
    }

    function agregarCapa(c) {
        var m = mockup();
        if (!m) { window.alert('Crea primero una vista.'); return; }
        m.capas.push(c);
        estado.seleccion = m.capas.length - 1;
        marcarPaso();
        sinGuardar();
        refrescar();
    }

    /** Foto del PDF: cubre todo el lienzo (es el fondo de la escena). */
    function agregarFoto(nombre) {
        agregarCapa({
            tipo: 'img', ref: 'pdf:' + nombre, x: 0, y: 0, w: LIENZO, h: LIENZO,
            rot: 0, sesgo: 0, filtros: {}, modo: 'normal', nombre: '', oculta: false, bloqueada: false
        });
    }

    /** Imagen del catalogo del proyecto: entra por su id numerico. */
    function agregarCatalogo(id) {
        var it = (datos.imagenes || []).filter(function (x) { return String(x.id) === String(id); })[0];
        if (!it) { return; }
        agregarCapa({
            tipo: 'img', ref: 'img:' + it.id, x: 0, y: 0, w: LIENZO, h: LIENZO,
            rot: 0, sesgo: 0, filtros: {}, modo: 'normal',
            nombre: it.title || it.file, oculta: false, bloqueada: false
        });
    }

    /** Placeholder del PDF: encuadre inicial a escala, centrado y seleccionado. */
    function agregarPlaceholder(idGrupo, indice) {
        var g = null;
        grupos.forEach(function (x) { if (String(x.id) === String(idGrupo)) { g = x; } });
        if (!g) { return; }
        var escala = Math.min(1, 240 / Math.max(1, g.w), 240 / Math.max(1, g.h));
        var w = Math.max(20, Math.round(g.w * escala));
        var h = Math.max(20, Math.round(g.h * escala));
        // El `ref` guarda la instancia SOLO si no es la primera: para la
        // #01 el ref plano es el legado y lo leen el motor y la ficha.
        // El indice es 1-based (PH-FF0000-01); `esValida` lo espera asi.
        var n = parseInt(indice, 10) || 0;
        var ref = n > 1 ? String(g.id) + '#' + n : String(g.id);
        agregarCapa({
            tipo: 'placeholder', ref: ref,
            x: Math.round((LIENZO - w) / 2), y: Math.round((LIENZO - h) / 2), w: w, h: h,
            rot: 0, sesgo: 0, filtros: {}, modo: 'normal', nombre: '', oculta: false, bloqueada: false
        });
    }

    function moverCapa(delta) {
        var m = mockup();
        var i = estado.seleccion;
        if (!m || i < 0) { return; }
        var j = i + delta;
        if (j < 0 || j >= m.capas.length) { return; }
        var a = m.capas.splice(i, 1)[0];
        m.capas.splice(j, 0, a);
        estado.seleccion = j;
        marcarPaso();
        sinGuardar();
        refrescar();
    }

    function alinearSeleccion(posición) {
        var m = mockup();
        if (!m || estado.seleccion < 0) { return; }
        m.capas = G.alinear(m.capas, [estado.seleccion], posicion, { x: 0, y: 0, w: LIENZO, h: LIENZO });
        marcarPaso();
        sinGuardar();
        refrescar();
    }

    function eliminarMockup() {
        if (!mockup()) { return; }
        if (!window.confirm('¿Eliminar la vista "' + mockup().id + '"?')) { return; }
        estado.mockups.splice(estado.actual, 1);
        estado.actual = Math.max(0, Math.min(estado.actual, estado.mockups.length - 1));
        estado.seleccion = -1;
        marcarPaso();
        sinGuardar();
        refrescar();
    }

    function duplicarCapa() {
        var m = mockup();
        var c = capa();
        if (!m || !c) { return; }
        var copia = JSON.parse(JSON.stringify(c));
        copia.x = Math.min(LIENZO - copia.w, copia.x + 8);
        copia.y = Math.min(LIENZO - copia.h, copia.y + 8);
        m.capas.push(copia);
        estado.seleccion = m.capas.length - 1;
        marcarPaso();
        sinGuardar();
        refrescar();
    }

    function borrarCapa() {
        var m = mockup();
        if (!m || estado.seleccion < 0) { return; }
        if (!window.confirm('¿Quitar la capa "' + nombreCapa(capa()) + '"?')) { return; }
        m.capas.splice(estado.seleccion, 1);
        estado.seleccion = -1;
        marcarPaso();
        sinGuardar();
        refrescar();
    }


    /* ============ Guardado (T038-T043) ============ */

    var temporizadorGuardado = null;

    /** Autoguardado con retardo: no se pierde el trabajo sin guardar (T039). */
    function agendarGuardado() {
        if (temporizadorGuardado) { clearTimeout(temporizadorGuardado); }
        temporizadorGuardado = setTimeout(function () { guardar(); }, 1500);
    }

    function guardar() {
        if (!api || !mockup()) {
            if (!api) {
                estado.guardado = 'error';
                $ed.find('.ec-mk-estado').text('pmu-core no cargado (admin.js). Recarga la pagina.');
            }
            return;
        }
        if (temporizadorGuardado) { clearTimeout(temporizadorGuardado); }
        estado.guardado = 'guardando';
        pintarEstado();
        var pares = [
            ['archivo', datos.pdf + '.pdf'],
            ['mockups', JSON.stringify(estado.mockups)],
            // Fuente unica de la marca: se lee del control vivo, no de la
            // copia congelada al cargar (bug corregido, FR-037).
            ['preview_omisible', $ed.find('.ec-mk-omisible').prop('checked') ? '1' : '0']
        ];
        api('personalizador_pdf_mockups', pares, cfg.nonceAccion ? cfg.nonceAccion.mockups : (cfg.nonceMockups || ''))
            .then(function () {
                estado.guardado = 'guardado';
                // El servidor es la autoridad: se refleja lo que guardo.
                datos.preview_omisible = $ed.find('.ec-mk-omisible').prop('checked') === true;
                pintarEstado();
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo guardar (red).';
                // Vuelve a "sin guardar": el contenido del lienzo se conserva
                // y el siguiente cambio reintenta solo (FR-036).
                estado.guardado = 'sin-guardar';
                $ed.find('.ec-mk-estado').text(msg).removeClass('ec-guardado ec-guardando')
                    .addClass('ec-error');
                if (aviso) { aviso($ed.closest('.card, .wrap'), msg, true); }
            });
    }

    /* ============ Deshacer / rehacer (T041) ============ */

    function deshacer() {
        if (!estado.pila.length) { return; }
        estado.redo.push(JSON.stringify(estado.mockups));
        estado.mockups = JSON.parse(estado.pila.pop());
        estado.seleccion = -1;
        estado.actual = Math.max(0, Math.min(estado.actual, estado.mockups.length - 1));
        sinGuardar();
        refrescar();
    }

    function rehacer() {
        if (!estado.redo.length) { return; }
        estado.pila.push(JSON.stringify(estado.mockups));
        estado.mockups = JSON.parse(estado.redo.pop());
        estado.seleccion = -1;
        sinGuardar();
        refrescar();
    }

    /* ============ Eventos (T028-T046) ============ */

    $ed.on('change', '.ec-mk-zoom', function () {
        estado.zoom = parseFloat(this.value) || 1;
        ajustarLienzo();
        dibujar();
    });

    $ed.on('change', '.ec-mk-ver-texto', function () {
        estado.verTexto = this.checked === true;
        dibujar();
    });

    $ed.on('input', '.ec-mk-buscar-catalogo', function () { pintarCatalogo(); });

    $ed.on('click', '[data-mk]', function () {
        var accion = String($(this).attr('data-mk'));
        if (accion === 'nuevo') { nuevoMockup(null); return; }
        if (accion === 'duplicar') { if (mockup()) { nuevoMockup(mockup()); } return; }
        if (accion === 'eliminar-mockup') { eliminarMockup(); return; }
        if (accion === 'add-foto') {
            var nombres = Object.keys(datos.fotos || {});
            if (!nombres.length) {
                window.alert('Todavia no hay fotos: arrastra un archivo sobre el lienzo o subilo en la seccion.');
                return;
            }
            agregarFoto(nombres[0]);
            return;
        }
        if (accion === 'add-catalogo') {
            if (!(datos.imagenes || []).length) {
                window.alert('El catalogo de imagenes esta vacio.');
                return;
            }
            $ed.find('.ec-mk-buscar-catalogo').trigger('focus');
            return;
        }
        if (accion === 'add-placeholder') {
            if (!grupos.length) { window.alert('Este PDF no tiene grupos detectados.'); return; }
            $ed.find('.ec-mk-grupo').eq(0).trigger('click');
            return;
        }
        if (accion === 'subir') { moverCapa(1); return; }
        if (accion === 'bajar') { moverCapa(-1); return; }
        if (accion === 'duplicar-capa') { duplicarCapa(); return; }
        if (accion === 'borrar-capa') { borrarCapa(); return; }
        if (accion === 'guardar') { guardar(); return; }
        if (accion === 'ver-cliente') { verCliente(); return; }
        if (accion === 'reset') {
            var c = capa();
            if (!c) { return; }
            c.filtros = {};
            c.modo = 'normal';
            marcarPaso();
            sinGuardar();
            refrescar();
        }
    });


    /* Galeria de mockups: seleccionar, renombrar en linea y eliminar. */
    $ed.on('click', '.ec-mk-mockup', function (ev) {
        if ($(ev.target).attr('data-borrar') !== undefined) {
            var b = parseInt($(ev.target).attr('data-borrar'), 10);
            estado.actual = b;
            eliminarMockup();
            return;
        }
        estado.actual = parseInt($(this).attr('data-i'), 10) || 0;
        estado.seleccion = -1;
        refrescar();
    });
    $ed.on('keydown', '.ec-mk-mockup', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            $(this).trigger('click');
        }
    });

    $ed.on('input', '.ec-mk-titulo', function () {
        if (mockup()) { mockup().titulo = $(this).val(); sinGuardar(); }
    });
    $ed.on('change', '.ec-mk-omisible', function () {
        // La marca se guarda desde el estado vigente del control (FR-037).
        sinGuardar();
    });

    /* Lista de capas: seleccionar y acciones por capa. */
    $ed.on('click', '.ec-mk-capa', function (ev) {
        var i = parseInt($(this).attr('data-i'), 10);
        var acc = String($(ev.target).attr('data-acc') || '');
        if (!acc) {
            estado.seleccion = i;
            refrescar();
            return;
        }
        estado.seleccion = i;
        var c = capas()[i];
        if (!c) { return; }
        if (acc === 'arriba') { moverCapa(1); return; }
        if (acc === 'abajo') { moverCapa(-1); return; }
        if (acc === 'ocultar') { c.oculta = !c.oculta; marcarPaso(); sinGuardar(); refrescar(); return; }
        if (acc === 'bloquear') { c.bloqueada = !c.bloqueada; marcarPaso(); sinGuardar(); refrescar(); }
    });
    $ed.on('keydown', '.ec-mk-capa', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            $(this).trigger('click');
        }
    });

    /* Propiedades numericas: sincronizan con el lienzo en ambos sentidos. */
    $ed.on('change', '.ec-mk-geo', function () {
        var c = capa();
        if (!c) { return; }
        var campo = String($(this).attr('data-geo'));
        var v = parseFloat(this.value);
        if (isNaN(v)) { return; }
        var n = G.acotar({
            x: c.x, y: c.y, w: c.w, h: c.h,
            rot: campo === 'rot' ? v : c.rot,
            sesgo: campo === 'sesgo' ? v : c.sesgo
        });
        c.x = n.x; c.y = n.y; c.w = n.w; c.h = n.h; c.rot = n.rot; c.sesgo = n.sesgo;
        marcarPaso();
        sinGuardar();
        refrescar();
    });

    $ed.on('input', '.ec-mk-aj', function () {
        var c = capa();
        if (!c) { return; }
        var k = String($(this).attr('data-aj'));
        var v = parseFloat(this.value);
        if (isNaN(v)) { return; }
        c.filtros = c.filtros || {};
        var def = AJUSTES.filter(function (a) { return a.k === k; })[0];
        if (def && Math.abs(v - def.def) < 0.0001) { delete c.filtros[k]; } else { c.filtros[k] = v; }
        $(this).siblings('output').text(String(v));
        sinGuardar();
        dibujar();
    });
    $ed.on('change', '.ec-mk-aj', function () { marcarPaso(); });

    $ed.on('change', '.ec-mk-modo', function () {
        var c = capa();
        if (!c) { return; }
        c.modo = this.value === 'multiply' ? 'multiply' : 'normal';
        marcarPaso();
        sinGuardar();
        dibujar();
    });

    $ed.on('change', '.ec-mk-nombre-capa', function () {
        var c = capa();
        if (!c) { return; }
        c.nombre = String(this.value).slice(0, 60);
        marcarPaso();
        sinGuardar();
        refrescar();
    });

    /* Recursos: miniaturas de fotos, catalogo y placeholders (un clic = capa). */
    $ed.on('click', '.ec-mk-mini', function () {
        var foto = $(this).attr('data-foto');
        if (foto) { agregarFoto(foto); return; }
        var img = $(this).attr('data-img');
        if (img) { agregarCatalogo(img); }
    });
    $ed.on('keydown', '.ec-mk-mini', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            $(this).trigger('click');
        }
    });
    // Una instancia concreta: PH-FF0000-02 (FR-015). El chip del grupo
    // sigue insertando la #01.
    $ed.on('click', '.ec-mk-instancia', function () {
        agregarPlaceholder($(this).attr('data-grupo'),
            parseInt($(this).attr('data-instancia'), 10) || 1);
    });
    $ed.on('click', '.ec-mk-grupo', function () {
        agregarPlaceholder($(this).attr('data-grupo'), 0);
    });


    /* Vista de cliente (T047): la misma composicion, sin marcas de edicion. */
    var $vistas = $ed.find('.ec-mk-vistas-cliente');

    function verCliente() {
        if (!$vistas.length) { return; }
        var m = mockup();
        if (!m) { return; }
        var c = document.createElement('canvas');
        c.width = LIENZO;
        c.height = LIENZO;
        c.style.width = '300px';
        c.style.height = '300px';
        c.className = 'ec-mk-cliente-canvas';
        $vistas.empty().append(c);
        R.componer(c.getContext('2d'), m.capas, {
            resolver: resolverCapa, contexto: contexto(), lienzo: LIENZO
        });
        var nav = $('<p class="ec-mk-marcas"></p>');
        nav.append($('<span class="ec-mk-marca">').text('Vista de cliente 300x300'
            + (estado.mockups.length > 1 ? ' (' + (estado.actual + 1) + '/' + estado.mockups.length + ')' : '')));
        $vistas.append(nav);
    }

    /* Arrastre de archivo al lienzo: sube y anade como capa (T029). */
    var $lienzoZona = $ed.find('.ec-mk-lienzo');
    $lienzoZona.on('dragover dragleave drop', function (ev) {
        var dt = ev.originalEvent && ev.originalEvent.dataTransfer;
        if (ev.type === 'dragover') {
            ev.preventDefault();
            if (dt) { dt.dropEffect = 'copy'; }
            $lienzoZona.css('outline', '2px dashed #2271b1');
            return;
        }
        $lienzoZona.css('outline', '');
        if (ev.type === 'dragleave') { return; }
        ev.preventDefault();
        var archivo = dt && dt.files && dt.files[0];
        if (!archivo) { return; }
        subirFotoArrastrada(archivo);
    });

    function subirFotoArrastrada(archivo) {
        var tipo = String(archivo.type || '');
        var ext = String(archivo.name || '').split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) === -1
            && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].indexOf(tipo) === -1) {
            avisar('Ese archivo no es una imagen admitida.');
            return;
        }
        if (!api) {
            avisar('pmu-core no cargado (admin.js). Recarga la pagina.');
            return;
        }
        $ed.find('.ec-mk-estado').removeClass('ec-guardado ec-sin-guardar')
            .addClass('ec-guardando').text('Subiendo foto...');
        var pares = [
            ['archivo', datos.pdf + '.pdf'],
            ['foto', archivo]
        ];
        api('personalizador_pdf_mockup_subir', pares,
            cfg.nonceAccion ? cfg.nonceAccion.mockup_subir : (cfg.nonceMockups || ''))
            .then(function (j) {
                var fotos = (j && j.data && j.data.fotos) ? j.data.fotos : {};
                datos.fotos = fotos;
                var nombres = Object.keys(fotos);
                agregarFoto(nombres[nombres.length - 1] || String(archivo.name));
            })
            .catch(function (e) {
                estado.guardado = 'error';
                $ed.find('.ec-mk-estado').text(
                    (e instanceof Error && e.message) ? e.message : 'No se pudo subir la foto.');
            });
    }

    function avisar(mensaje) {
        $ed.find('.ec-mk-alertas').prepend($('<p class="ec-mk-alerta-error">').text(mensaje));
    }

    /* Preview real del grupo (T024): el boton "Probar" publica el render. */
    window.addEventListener('pmu:preview-listo', function (ev) {
        if (!ev || !ev.detail || !ev.detail.id) { return; }
        if (!cfg.previews) { cfg.previews = {}; }
        cfg.previews[String(ev.detail.id)] = ev.detail;
        if (estado.verTexto) { dibujar(); }
    });


    /* Atajos de teclado (T044): todo el editor es operable sin raton. */
    $(document).on('keydown', function (ev) {
        if (!estado.mockups.length) { return; }
        var activo = ev.target && ev.target.tagName;
        var escribiendo = activo === 'INPUT' || activo === 'TEXTAREA' || activo === 'SELECT';
        var enEditor = $.contains($ed[0], ev.target) || $.contains(lienzo, ev.target);
        if ((ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === 's') {
            ev.preventDefault();
            guardar();
            return;
        }
        if (!enEditor || escribiendo) { return; }
        var ctrl = ev.ctrlKey || ev.metaKey;
        if (ctrl && String(ev.key).toLowerCase() === 'z') {
            ev.preventDefault();
            if (ev.shiftKey) { rehacer(); } else { deshacer(); }
            return;
        }
        if (ctrl && String(ev.key).toLowerCase() === 'd') {
            ev.preventDefault();
            duplicarCapa();
            return;
        }
        if (ev.key === 'Escape') { estado.seleccion = -1; refrescar(); return; }
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
            if (estado.seleccion >= 0) { ev.preventDefault(); borrarCapa(); }
            return;
        }
        if (ev.key === '[') { moverCapa(-1); return; }
        if (ev.key === ']') { moverCapa(1); return; }
        var c = capa();
        if (!c || c.bloqueada) { return; }
        var paso = ev.shiftKey ? 10 : 1;
        var mueve = false;
        if (ev.key === 'ArrowLeft') { c.x -= paso; mueve = true; }
        if (ev.key === 'ArrowRight') { c.x += paso; mueve = true; }
        if (ev.key === 'ArrowUp') { c.y -= paso; mueve = true; }
        if (ev.key === 'ArrowDown') { c.y += paso; mueve = true; }
        if (mueve) {
            ev.preventDefault();
            var n = G.acotar(c);
            c.x = n.x; c.y = n.y;
            sinGuardar();
            dibujar();
            pintarProps();
        }
    });

    /* Aviso al abandonar con cambios pendientes (T040). */
    $(window).on('beforeunload', function () {
        if (estado.guardado === 'sin-guardar') {
            return 'Hay cambios sin guardar en los mockups.';
        }
        return undefined;
    });
    $(document).on('click', '.ec-tabla a, .wrap .subsubsub a, .ec-acordeon > summary', function (ev) {
        if (estado.guardado !== 'sin-guardar') { return; }
        if (!window.confirm('Hay cambios sin guardar en los mockups (se guardan solos en un instante). '
            + '¿Continuar?')) {
            ev.preventDefault();
        }
    });

    /* Alineacion rapida: botones con data-pos. */
    $ed.on('click', '.ec-mk-alin', function () {
        alinearSeleccion(String($(this).attr('data-pos')));
    });

    /* Arranque. */
    pintarZooms();
    ajustarLienzo();
    if (estado.mockups.length) { estado.actual = 0; }
    refrescar();
    verCliente();
    window.addEventListener('resize', function () { dibujar(); });
});

