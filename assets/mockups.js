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
        seleccionados: [],
        soloSeleccion: false,
        suprimirClicCapa: 0,
        zoom: 2,
        verTexto: true,
        guardado: 'guardado',
        pila: [],
        redo: [],
        avisoCapa: null,
        arrastre: null,
        guias: [],
        // Caché de envolturas pedidas bajo demanda: clave `{gid}#{n}`.
        envs: {}
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
    /**
     * Cliente del endpoint `pmu_uploads` (scope=mockups) para el catalogo
     * exclusivo del editor. Reusa el nonce y la URL que el admin ya pasa.
     */
    function apiMotor(op, params) {
        if (!cfg.motorUrl || !cfg.motorNonce) {
            return Promise.reject(new Error('El catalogo no esta disponible. Recarga la pagina.'));
        }
        var fd = new FormData();
        fd.append('op', op);
        Object.keys(params || {}).forEach(function (k) {
            fd.append(k, params[k]);
        });
        fd.append('_wpnonce', cfg.motorNonce);
        return fetch(cfg.motorUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j || j.success !== true) {
                    var m = (j && typeof j.data === 'string' && j.data) || 'No se pudo completar.';
                    throw new Error(m);
                }
                return j;
            });
    }

    function contexto() {
        // Spec 011 (T032): el catalogo `mockups` es la unica fuente de
        // imagenes; ya no hay `fotos` por PDF.
        // Envolturas (PowerClip): la pagina solo trae las de refs usadas
        // (ficha) o las claves (editor); lo demas llega bajo demanda y vive
        // en estado.envs. El nucleo recibe el MISMO contrato `grupos[].envs`.
        var gs = grupos.map(function (g) {
            var copia = {};
            Object.keys(g).forEach(function (k) { copia[k] = g[k]; });
            var envs = {};
            Object.keys(g.envs || {}).forEach(function (k) { envs[k] = g.envs[k]; });
            Object.keys(estado.envs).forEach(function (clave) {
                var partes = clave.split('#');
                if (partes[0] === String(g.id) && estado.envs[clave]) {
                    envs[partes[1]] = estado.envs[clave];
                }
            });
            copia.envs = Object.keys(envs).length ? envs : null;
            return copia;
        });
        return { imagenes: datos.imagenes || [], grupos: gs };
    }

    /**
     * Disponibilidad de la envoltura de un ref (v2, formas deduplicadas):
     * `disponible` = existe envolturas.json; `hay` = esta instancia tiene
     * envoltura (forma por defecto o excepcion); `necesita` = usa una forma
     * DISTINTA de la default y su geometria aun no esta (hay que pedirla);
     * `sin` = excepcion explicita sin envoltura en el PDF.
     */
    function infoEnvoltura(ref) {
        var ev = datos.envolturas || {};
        var partes = String(ref || '').split('#');
        var n = parseInt(partes[1], 10) || 1;
        var disponible = !!ev.disponible;
        var g = null;
        grupos.forEach(function (x) { if (String(x.id) === partes[0]) { g = x; } });
        if (!g) {
            return { disponible: disponible, n: n, hay: false, necesita: false, sin: false };
        }
        var exc = g.env_exc || {};
        var esExc = Object.prototype.hasOwnProperty.call(exc, String(n));
        var k = esExc ? parseFloat(exc[String(n)]) : null;
        if (esExc && k === 0) {
            return { disponible: disponible, n: n, hay: false, necesita: false, sin: true };
        }
        var resuelta = (g.envs && g.envs[String(n)]) || null;
        var tieneDef = !!(g.env_defecto && g.env_defecto.subs && g.env_defecto.subs.length);
        var necesita = esExc && !resuelta;
        var hay = !!resuelta || (!esExc && tieneDef) || necesita;
        return {
            disponible: disponible,
            n: n,
            hay: disponible && hay,
            necesita: necesita,
            sin: false
        };
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

    function indicesSeleccionados() {
        var seleccion = (estado.seleccionados || []).slice();
        if (!seleccion.length && estado.seleccion >= 0) {
            seleccion.push(estado.seleccion);
        }
        return estado.soloSeleccion ? seleccion : G.expandirGrupos(capas(), seleccion);
    }

    function esGrupoPersistido(indices, lista) {
        var capasLista = lista || capas();
        if (!indices || indices.length < 2) { return false; }
        var grupo = capasLista[indices[0]] && String(capasLista[indices[0]].grupo || '');
        return !!grupo && indices.every(function (i) {
            return capasLista[i] && String(capasLista[i].grupo || '') === grupo;
        });
    }

    function giroSeleccion(indices, lista) {
        var capasLista = lista || capas();
        var primera = (indices || []).map(function (i) { return capasLista[i]; })
            .filter(function (c) { return !!c; })[0];
        return primera ? (parseFloat(primera.grupo_rot) || 0) : 0;
    }

    function marcoOrientadoSeleccion(indices, lista) {
        return G.marcoOrientado(lista || capas(), indices, giroSeleccion(indices, lista));
    }

    function puntosPerspectiva(indices, lista) {
        var capasLista = lista || capas();
        var actual = (indices || []).map(function (i) {
            return capasLista[i] && capasLista[i].perspectiva;
        }).filter(function (p) { return p && Array.isArray(p.puntos) && p.puntos.length === 4; })[0];
        return actual ? JSON.parse(JSON.stringify(actual.puntos))
            : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    }

    function asignarPerspectiva(lista, indices, puntos) {
        var neutros = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
        var borrar = puntos.every(function (p, i) {
            return Math.abs(p.x - neutros[i].x) < 0.0001
                && Math.abs(p.y - neutros[i].y) < 0.0001;
        });
        indices.forEach(function (i) {
            if (!lista[i]) { return; }
            if (borrar) {
                delete lista[i].perspectiva;
            } else {
                lista[i].perspectiva = { puntos: JSON.parse(JSON.stringify(puntos)) };
            }
        });
        return lista;
    }

    function puntosTiradoresPerspectiva(marco, puntos) {
        var offsets = [{ x: 8, y: 8 }, { x: -8, y: 8 }, { x: -8, y: -8 }, { x: 8, y: -8 }];
        return puntos.map(function (p, i) {
            var centro = G.puntoMarco(marco, p.x, p.y);
            var punto = G.puntoMarco(marco, p.x, p.y, offsets[i].x, offsets[i].y);
            return {
                indice: i,
                x: punto.x,
                y: punto.y,
                offsetX: centro.x - punto.x,
                offsetY: centro.y - punto.y
            };
        });
    }

    function perspectivaConvexa(puntos) {
        var signo = 0;
        for (var i = 0; i < 4; i++) {
            var a = puntos[i], b = puntos[(i + 1) % 4], c = puntos[(i + 2) % 4];
            var cruz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
            if (Math.abs(cruz) < 0.0001) { return false; }
            var actual = cruz > 0 ? 1 : -1;
            if (signo && actual !== signo) { return false; }
            signo = actual;
        }
        return true;
    }

    function seleccionConBloqueadas(indices) {
        return indices.some(function (i) {
            return capas()[i] && capas()[i].bloqueada;
        });
    }

    function seleccionarCapa(indice, alternar, individual) {
        var lista = capas();
        var miembros = G.expandirGrupos(lista, [indice]);
        if (!miembros.length) {
            estado.seleccion = -1;
            estado.seleccionados = [];
            estado.soloSeleccion = false;
            return;
        }
        if (individual) {
            estado.seleccion = indice;
            estado.seleccionados = [indice];
            estado.soloSeleccion = true;
            return;
        }
        estado.soloSeleccion = false;
        if (alternar) {
            var estaCompleto = miembros.every(function (i) {
                return estado.seleccionados.indexOf(i) !== -1;
            });
            estado.seleccionados = estado.seleccionados.filter(function (i) {
                return miembros.indexOf(i) === -1;
            });
            if (!estaCompleto) {
                estado.seleccionados = estado.seleccionados.concat(miembros);
                estado.seleccion = indice;
            } else {
                estado.seleccion = estado.seleccionados.length
                    ? estado.seleccionados[estado.seleccionados.length - 1] : -1;
            }
        } else {
            estado.seleccionados = miembros.length > 1 ? miembros.slice() : [];
            estado.seleccion = indice;
        }
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
            '      <p class="ec-mk-ayuda">Arrastra para mover; usa los tiradores para redimensionar, rotar ' +
            '        y ajustar los cuatro puntos de perspectiva. Los grupos pueden exceder el lienzo; ' +
            '        Alt+clic selecciona solo una capa.</p>' +
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
            '          <button type="button" class="button button-small" data-mk="add-catalogo">+ Imagen</button>' +
            '          <button type="button" class="button button-small" data-mk="add-placeholder">+ Placeholder</button>' +
            '        </div>' +
            '        <div class="ec-mk-acciones">' +
            '          <button type="button" class="button button-small" data-mk="subir" title="Subir capa">Subir</button>' +
            '          <button type="button" class="button button-small" data-mk="bajar" title="Bajar capa">Bajar</button>' +
            '          <button type="button" class="button button-small" data-mk="duplicar-capa">Duplicar</button>' +
            '          <button type="button" class="button button-small button-link-delete" data-mk="borrar-capa">Quitar</button>' +
            '        </div>' +
            '        <div class="ec-mk-acciones ec-mk-grupos-acciones">' +
            '          <button type="button" class="button button-small" data-mk="agrupar">Agrupar seleccion</button>' +
            '          <button type="button" class="button button-small" data-mk="desagrupar">Desagrupar seleccion</button>' +
            '          <span class="description">Selecciona varias capas con Ctrl/Cmd+clic.</span>' +
            '        </div>' +
            '        <div class="ec-mk-acciones ec-mk-importar">' +
            '          <label>Pagina del PDF <input type="number" class="ec-mk-num-pagina" min="1" step="1" value="1" style="width:72px"></label>' +
            '          <button type="button" class="button button-small" data-mk="importar-pagina">Importar pagina + PH</button>' +
            '        </div>' +
            '        <p class="description ec-mk-importar-ayuda">La pagina elegida y sus placeholders se agregan como un grupo movible, redimensionable y rotatable.</p>' +
            '        <p class="ec-mk-importar-estado" aria-live="polite"></p>' +
            '        <div class="ec-mk-acciones">' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="izquierda">Izq.</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="centro_h">Centro H</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="derecha">Der.</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="arriba">Arriba</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="centro_v">Centro V</button>' +
            '          <button type="button" class="button button-small ec-mk-alin" data-pos="abajo">Abajo</button>' +
            '        </div>' +
            '        <div class="ec-mk-acciones">' +
            '          <span class="description" style="margin-right:4px">Distribuir (Ctrl+clic marca varias):</span>' +
            '          <button type="button" class="button button-small ec-mk-dist" data-eje="x">Distribuir H</button>' +
            '          <button type="button" class="button button-small ec-mk-dist" data-eje="y">Distribuir V</button>' +
            '        </div>' +
            '      </div>' +
            '      <div class="ec-mk-panel ec-mk-panel-props" hidden>' +
            '        <h4>Propiedades</h4>' +
            '        <div class="ec-mk-props"></div>' +
            '      </div>' +
            '      <div class="ec-mk-panel">' +
            '        <h4>Imagenes de mockup</h4>' +
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

    function puntosTiradoresGrupo(marco) {
        return [
            { nombre: 'nw', x: 0, y: 0 }, { nombre: 'n', x: 0.5, y: 0 },
            { nombre: 'ne', x: 1, y: 0 }, { nombre: 'e', x: 1, y: 0.5 },
            { nombre: 'se', x: 1, y: 1 }, { nombre: 's', x: 0.5, y: 1 },
            { nombre: 'sw', x: 0, y: 1 }, { nombre: 'w', x: 0, y: 0.5 }
        ].map(function (p) {
            var global = G.puntoMarco(marco, p.x, p.y);
            return { nombre: p.nombre, x: global.x, y: global.y };
        });
    }

    function puntoRotacionGrupo(marco) {
        var centro = G.puntoMarco(marco, 0.5, 0.5);
        var punto = G.puntoMarco(marco, 0.5, 0, 0, -14);
        return G.extremoVisible(centro, punto, LIENZO, 7);
    }

    /** Tiradores, medidas y nombre de la capa seleccionada (T019). */
    function dibujarSeleccion() {
        var c = capa();
        if (!c) { return; }
        var f = factor();
        var seleccion = indicesSeleccionados();
        if (seleccion.length > 1) {
            var marcoGrupo = marcoOrientadoSeleccion(seleccion);
            if (!marcoGrupo) { return; }
            var rotGrupo = puntoRotacionGrupo(marcoGrupo);
            ctx.save();
            var centroMarco = G.puntoMarco(marcoGrupo, 0.5, 0.5);
            ctx.translate(centroMarco.x, centroMarco.y);
            ctx.rotate(marcoGrupo.rot * Math.PI / 180);
            ctx.strokeStyle = '#2271b1';
            ctx.lineWidth = 1.5 / f;
            ctx.setLineDash([4 / f, 3 / f]);
            ctx.strokeRect(-marcoGrupo.w / 2, -marcoGrupo.h / 2, marcoGrupo.w, marcoGrupo.h);
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(0, -marcoGrupo.h / 2);
            var rotLocal = G.coordenadaMarco(marcoGrupo, rotGrupo);
            ctx.lineTo(rotLocal.x - marcoGrupo.x - marcoGrupo.w / 2,
                rotLocal.y - marcoGrupo.y - marcoGrupo.h / 2);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(rotLocal.x - marcoGrupo.x - marcoGrupo.w / 2,
                rotLocal.y - marcoGrupo.y - marcoGrupo.h / 2, 5 / f, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            ctx.save();
            var textoGrupo = seleccion.length + ' elementos';
            ctx.font = '11px sans-serif';
            var anchoGrupo = ctx.measureText(textoGrupo).width + 10;
            ctx.fillStyle = 'rgba(255, 255, 255, .92)';
            var etiquetaGrupo = G.puntoMarco(marcoGrupo, 0, 0, 0, -16);
            ctx.fillRect(etiquetaGrupo.x, etiquetaGrupo.y, anchoGrupo, 14);
            ctx.fillStyle = '#1d2327';
            ctx.textBaseline = 'middle';
            ctx.fillText(textoGrupo, etiquetaGrupo.x + 5, etiquetaGrupo.y + 7);
            ctx.restore();
            puntosTiradoresGrupo(marcoGrupo).forEach(function (p) {
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#2271b1';
                ctx.lineWidth = 1.5 / f;
                ctx.fillRect(p.x - 4 / f, p.y - 4 / f, 8 / f, 8 / f);
                ctx.strokeRect(p.x - 4 / f, p.y - 4 / f, 8 / f, 8 / f);
                ctx.restore();
            });
            if (esGrupoPersistido(seleccion) && !seleccionConBloqueadas(seleccion)) {
                puntosTiradoresPerspectiva(marcoGrupo, puntosPerspectiva(seleccion)).forEach(function (p) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#d63638';
                    ctx.lineWidth = 2 / f;
                    ctx.arc(p.x, p.y, 6 / f, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = '#1d2327';
                    ctx.font = 'bold 9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(p.indice + 1), p.x, p.y);
                    ctx.restore();
                });
            }
            return;
        }
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
                // Coordenada LOCAL (offset al centro): el contexto ya aplico
                // translate(centro)+rotate+sesgo. Usar la global aqui era una
                // doble transformacion y los tiradores salian corridos.
                var p = G.posicionTirador(c, t, { local: true });
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

    /** Cual de los tiradores (o el de rotacion) esta bajo el punto. */
    function tiradorEn(p) {
        var c = capa();
        if (!c || c.bloqueada) { return ''; }
        var tol = 6 / estado.zoom;
        var seleccion = indicesSeleccionados();
        if (seleccion.length > 1) {
            if (seleccionConBloqueadas(seleccion)) { return ''; }
            var marcoGrupo = marcoOrientadoSeleccion(seleccion);
            if (!marcoGrupo) { return ''; }
            if (esGrupoPersistido(seleccion)) {
                var puntosPersp = puntosTiradoresPerspectiva(marcoGrupo, puntosPerspectiva(seleccion));
                for (var tp = 0; tp < puntosPersp.length; tp++) {
                    if (Math.abs(p.x - puntosPersp[tp].x) <= tol * 1.4
                        && Math.abs(p.y - puntosPersp[tp].y) <= tol * 1.4) {
                        return 'perspectiva:' + puntosPersp[tp].indice;
                    }
                }
            }
            var rotGrupo = puntoRotacionGrupo(marcoGrupo);
            if (Math.abs(p.x - rotGrupo.x) <= tol * 1.6
                && Math.abs(p.y - rotGrupo.y) <= tol * 1.6) {
                return 'rotar-grupo';
            }
            var tiradoresGrupo = puntosTiradoresGrupo(marcoGrupo);
            for (var tg = 0; tg < tiradoresGrupo.length; tg++) {
                if (Math.abs(p.x - tiradoresGrupo[tg].x) <= tol
                    && Math.abs(p.y - tiradoresGrupo[tg].y) <= tol) {
                    return 'redimensionar-grupo:' + tiradoresGrupo[tg].nombre;
                }
            }
            return '';
        }
        var ang = -1.5707963 + ((c.rot || 0) * Math.PI / 180);
        var radio = Math.max(c.w, c.h) / 2 + 14;
        var hx = c.x + c.w / 2 + radio * Math.cos(ang);
        var hy = c.y + c.h / 2 + radio * Math.sin(ang);
        if (Math.abs(p.x - hx) <= tol * 1.6 && Math.abs(p.y - hy) <= tol * 1.6) { return 'rotar'; }
        for (var i = 0; i < G.TIRADORES.length; i++) {
            var pos = G.posicionTirador(c, G.TIRADORES[i]);
            if (Math.abs(p.x - pos.x) <= tol && Math.abs(p.y - pos.y) <= tol) { return G.TIRADORES[i]; }
        }
        return '';
    }


    /* ============ Manipulacion directa (T016-T018) ============ */

    /** Registra un paso en el historial (T041): un gesto, no un mousemove. */
    function marcarPaso(estadoAnterior) {
        estado.pila.push(typeof estadoAnterior === 'string'
            ? estadoAnterior : JSON.stringify(estado.mockups));
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

    function capturarArrastreGrupo(tipo, p) {
        var indices = indicesSeleccionados();
        var marcoGrupo = marcoOrientadoSeleccion(indices);
        if (!marcoGrupo || !indices.length || seleccionConBloqueadas(indices)) { return null; }
        var arrastre = {
            tipo: tipo,
            inicio: p,
            indices: indices,
            originales: JSON.parse(JSON.stringify(capas())),
            estadoAnterior: JSON.stringify(estado.mockups),
            centro: G.puntoMarco(marcoGrupo, 0.5, 0.5),
            marco: marcoGrupo
        };
        if (tipo === 'rotar-grupo') {
            arrastre.anguloAnterior = Math.atan2(p.y - arrastre.centro.y, p.x - arrastre.centro.x);
            arrastre.rotacionAcumulada = 0;
        }
        if (tipo.indexOf('perspectiva:') === 0) {
            var puntoIndex = parseInt(tipo.split(':')[1], 10);
            var tiradoresPersp = puntosTiradoresPerspectiva(
                marcoGrupo, puntosPerspectiva(indices, arrastre.originales)
            );
            var tiradorPersp = tiradoresPersp.filter(function (t) { return t.indice === puntoIndex; })[0];
            arrastre.perspectivaIndex = puntoIndex;
            arrastre.offsetPunto = tiradorPersp
                ? { x: tiradorPersp.offsetX, y: tiradorPersp.offsetY } : { x: 0, y: 0 };
            arrastre.marco = marcoGrupo;
        }
        if (tipo.indexOf('redimensionar-grupo:') === 0) {
            arrastre.pivote = arrastre.centro;
            arrastre.radioInicio = Math.max(1, Math.hypot(
                p.x - arrastre.pivote.x, p.y - arrastre.pivote.y
            ));
            arrastre.escalaMax = Math.min(4,
                G.MAX_DIMENSION / Math.max(1, marcoGrupo.w, marcoGrupo.h));
        }
        return arrastre;
    }

    lienzo.addEventListener('pointerdown', function (ev) {
        if (!mockup()) { return; }
        var p = aLogico(ev);
        var estadoAnterior = JSON.stringify(estado.mockups);
        var tir = tiradorEn(p);
        if (tir) {
            estado.arrastre = (tir === 'rotar-grupo' || tir.indexOf('redimensionar-grupo:') === 0
                || tir.indexOf('perspectiva:') === 0)
                ? capturarArrastreGrupo(tir, p)
                : {
                    tipo: tir,
                    inicio: p,
                    original: capa() ? Object.assign({}, capa()) : null,
                    centro: capa() ? G.centro(capa()) : null,
                    anguloInicio: capa() && tir === 'rotar'
                        ? Math.atan2(p.y - G.centro(capa()).y, p.x - G.centro(capa()).x) : 0,
                    estadoAnterior: estadoAnterior
                };
        } else {
            var i = G.acertarCapa(capas(), p.x, p.y);
            if (i >= 0) {
                seleccionarCapa(i, ev.ctrlKey || ev.metaKey, ev.altKey);
            } else if (!ev.ctrlKey && !ev.metaKey) {
                estado.seleccion = -1;
                estado.seleccionados = [];
                estado.soloSeleccion = false;
            }
            if (i >= 0) {
                var indices = indicesSeleccionados();
                if (indices.indexOf(i) !== -1 && indices.length > 1) {
                    if (seleccionConBloqueadas(indices)) {
                        $ed.find('.ec-mk-alertas').text('Desbloquea todas las capas del grupo para moverlo o rotarlo.');
                    } else {
                        estado.arrastre = capturarArrastreGrupo('mover-grupo', p);
                    }
                } else if (indices.indexOf(i) !== -1) {
                    estado.arrastre = {
                        tipo: 'mover',
                        inicio: p,
                        original: Object.assign({}, capas()[i]),
                        estadoAnterior: estadoAnterior
                    };
                }
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
            lienzo.className = t.indexOf('rotar') === 0 ? 'ec-mk-rotar'
                : (t ? 'ec-mk-tirador' : (G.acertarCapa(capas(), p.x, p.y) >= 0 ? 'ec-mk-mover' : ''));
            return;
        }
        var a = estado.arrastre;
        if (a.tipo.indexOf('perspectiva:') === 0) {
            var marcoPerspectiva = a.marco;
            if (!marcoPerspectiva || !marcoPerspectiva.w || !marcoPerspectiva.h) { return; }
            var puntosActuales = puntosPerspectiva(a.indices, a.originales);
            var localPerspectiva = G.coordenadaMarco(marcoPerspectiva, {
                x: p.x + a.offsetPunto.x,
                y: p.y + a.offsetPunto.y
            });
            var nuevoPunto = {
                x: Math.max(0, Math.min(1, localPerspectiva.x / marcoPerspectiva.w)),
                y: Math.max(0, Math.min(1, localPerspectiva.y / marcoPerspectiva.h))
            };
            puntosActuales[a.perspectivaIndex] = nuevoPunto;
            if (perspectivaConvexa(puntosActuales)) {
                var capasPerspectiva = JSON.parse(JSON.stringify(a.originales));
                mockup().capas = asignarPerspectiva(capasPerspectiva, a.indices, puntosActuales);
                sinGuardar(false);
                dibujar();
            }
            return;
        }
        if (a.tipo === 'mover-grupo') {
            var dxGrupo = p.x - a.inicio.x;
            var dyGrupo = p.y - a.inicio.y;
            mockup().capas = G.transformarGrupo(a.originales, a.indices,
                a.centro, 0, dxGrupo, dyGrupo);
            estado.guias = [];
            sinGuardar(false);
            dibujar();
            pintarProps();
            return;
        }
        if (a.tipo === 'rotar-grupo') {
            var anguloActual = Math.atan2(p.y - a.centro.y, p.x - a.centro.x);
            a.rotacionAcumulada = Math.max(-360, Math.min(360, a.rotacionAcumulada
                + G.deltaAngular(a.anguloAnterior, anguloActual)));
            a.anguloAnterior = anguloActual;
            var giradas = G.transformarGrupo(a.originales, a.indices,
                a.centro, a.rotacionAcumulada, 0, 0);
            mockup().capas = giradas;
            estado.guias = [];
            sinGuardar(false);
            dibujar();
            pintarProps();
            return;
        }
        if (a.tipo.indexOf('redimensionar-grupo:') === 0) {
            var radioActual = Math.hypot(p.x - a.pivote.x, p.y - a.pivote.y);
            var escalaGrupo = Math.max(0.05, Math.min(a.escalaMax, radioActual / a.radioInicio));
            var escaladas = G.escalarGrupo(a.originales, a.indices, a.pivote, escalaGrupo);
            mockup().capas = escaladas;
            estado.guias = [];
            sinGuardar(false);
            dibujar();
            pintarProps();
            return;
        }
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
            var anguloCapa = Math.atan2(p.y - a.centro.y, p.x - a.centro.x);
            var deltaCapa = G.deltaAngular(a.anguloInicio, anguloCapa);
            c.rot = Math.max(-360, Math.min(360, a.original.rot + deltaCapa));
            if (ev.shiftKey) { c.rot = Math.round(c.rot / 15) * 15; }
            estado.guias = [];
        } else {
            var preservarProporcion = c.tipo === 'img' || ev.shiftKey;
            var modoProporcion = c.tipo === 'img'
                ? (/^[ew]$/.test(a.tipo) ? 'w' : (/^[ns]$/.test(a.tipo) ? 'h' : true))
                : ev.shiftKey;
            c = G.redimensionarDesdeTirador(a.original, a.tipo, p.x - a.inicio.x, p.y - a.inicio.y, {
                proporcion: preservarProporcion ? modoProporcion : false,
                centrarEje: c.tipo === 'img' && a.tipo.length === 1,
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
        var estadoAnterior = estado.arrastre.estadoAnterior;
        estado.arrastre = null;
        estado.guias = [];
        marcarPaso(estadoAnterior);
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
        pintarCatalogo();
        pintarGrupos();
        pintarAlertas();
        dibujar();
    }


    function pintarEstado() {
        var $e = $ed.find('.ec-mk-estado');
        var textos = {
            guardado: 'Guardado',
            'sin-guardar': 'Sin guardar',
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

    /** Reordena las vistas arrastrando una sobre otra (T036). */
    function moverVista(desde, hasta) {
        if (desde === hasta || desde < 0 || hasta < 0) { return; }
        estado.mockups = G.reordenar(estado.mockups, desde, hasta);
        // El indice de la seleccionada cambia al moverla: se sigue a la vista.
        if (estado.actual === desde) {
            estado.actual = hasta;
        } else if (desde < estado.actual && hasta >= estado.actual) {
            estado.actual = estado.actual - 1;
        } else if (desde > estado.actual && hasta <= estado.actual) {
            estado.actual = estado.actual + 1;
        }
        marcarPaso();
        sinGuardar();
        refrescar();
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
                .attr('data-arrastre', 'vista')
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

    /**
     * Miniatura de una capa para la lista (T033): la imagen real cuando la hay
     * (foto del PDF, catalogo o el render del placeholder ya previsualizado) y
     * el swatch de color del grupo cuando todavia no hay recurso.
     */
    /**
     * Miniatura de una capa para la lista (T033): la imagen real de la capa
     * cuando existe. La resuelve `resolverCapa()`, asi que sirve igual para
     * una foto, una imagen del catalogo o el render del placeholder (texto de
     * TextMuy o imagen): el editor no distingue el tipo, solo usa lo que haya.
     */
    function miniaturaCapa(c) {
        var $m = $('<span class="ec-mk-capa-mini">');
        var r = resolverCapa(c);
        if (r && r.url) {
            $m.addClass('ec-mk-capa-mini-img');
            $m.append($('<img alt="">').attr('src', r.url));
        } else {
            $m.addClass('ec-mk-capa-mini-vacia');
            $m.attr('aria-hidden', 'true');
        }
        return $m;
    }

    /**
     * Detalle de color del grupo, al lado del nombre (T033). Es solo una
     * pista visual del placeholder: la miniatura de al lado lleva la imagen.
     */
    function detalleCapa(c) {
        if (!c || c.tipo !== 'placeholder') {
            return $('<span class="ec-mk-detalle">');
        }
        var id = String(c.ref || '').split('#')[0];
        return $('<span class="ec-mk-detalle swatch">')
            .css('background', '#' + id)
            .attr('title', 'Placeholder ' + etiquetaPlaceholder(c.ref));
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
                    .toggleClass('ec-mk-sel', (estado.seleccionados || []).indexOf(indice) !== -1)
                    .toggleClass('ec-invalida', invalida)
                    .toggleClass('ec-oculta', !!c.oculta)
                    .attr('data-i', indice).attr('tabindex', '0')
                    .attr('role', 'button')
                    .attr('aria-label', nombreCapa(c) + (c.oculta ? ' (oculta)' : '')
                        + (c.bloqueada ? ' (bloqueada)' : ''));
                $li.append(miniaturaCapa(c));
                $li.append($('<span class="ec-mk-capa-txt">')
                    .append($('<span class="ec-mk-capa-nombre">').text(nombreCapa(c)))
                    .append(detalleCapa(c)));
                $li.append($('<button type="button" class="ec-mk-capa-btn" data-acc="arriba">')
                    .attr('aria-label', 'Subir la capa ' + nombreCapa(c))
                    .attr('title', 'Clic: subir un nivel. Mantener 1 segundo: enviar arriba del todo.')
                    .text('▲'));
                $li.append($('<button type="button" class="ec-mk-capa-btn" data-acc="abajo">')
                    .attr('aria-label', 'Bajar la capa ' + nombreCapa(c))
                    .attr('title', 'Clic: bajar un nivel. Mantener 1 segundo: enviar abajo del todo.')
                    .text('▼'));
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
            var ref = 'mock:' + it.id;
            var $li = $('<li>').toggleClass('ec-mk-mini', true)
                .toggleClass('ec-usada', !!usadas[ref])
                .attr('tabindex', '0').attr('role', 'button')
                .attr('data-img', it.id)
                .attr('aria-label', 'Agregar la imagen '
                    + (it.title || it.file) + ' como capa')
                    .append($('<button type="button" class="ec-mk-mini-x">')
                        .attr('aria-label', 'Borrar la imagen ' + (it.title || it.file))
                        .text('×'));
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
            // El <li> se construia pero NUNCA se insertaba: el panel "Placeholders"
            // quedaba vacio aunque hubiera grupos (bug: "no me aparecen los
            // placeholders"). Sin este append el forEach descartaba cada nodo.
            $ul.append($li);
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
    var geoEdicion = null;

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
        var indices = indicesSeleccionados();
        var esGrupo = indices.length > 1;
        var marcoProps = esGrupo ? G.marco(capas(), indices) : null;
        if (esGrupo) {
            html += '<h4 class="ec-mk-props-titulo">Grupo seleccionado (' + indices.length + ' capas)</h4>';
        } else {
            html += '<h4 class="ec-mk-props-titulo">Capa seleccionada</h4>';
        }
        var camposGeo = esGrupo
            ? [['x', 'X', marcoProps.x], ['y', 'Y', marcoProps.y],
                ['w', 'Ancho', marcoProps.w], ['h', 'Alto', marcoProps.h], ['rot', 'Rotacion', c.rot || 0]]
            : [['x', 'X', c.x], ['y', 'Y', c.y], ['w', 'Ancho', c.w],
                ['h', 'Alto', c.h], ['rot', 'Rotacion', c.rot || 0]];
        camposGeo.forEach(function (f) {
            html += '<label>' + f[1] + ' <input type="number" class="ec-mk-geo" data-geo="' + f[0]
                + '" step="' + (f[0] === 'rot' ? 1 : (f[0] === 'w' || f[0] === 'h' ? 1 : 0.1))
                + '" value="' + (Math.round((f[2] || 0) * 100) / 100) + '"></label>';
        });
        if (c.tipo === 'placeholder') {
            // Envoltura (PowerClip del PDF): recorta la capa al contenedor
            // vectorial del hueco. La pagina solo trae CLAVES: el toggle se
            // habilita segun el analisis y la geometria se pide al marcar.
            // `checked` solo si ademas HAY envoltura: una capa guardada con
            // envoltura cuya clave desaparecio no se muestra marcada con un
            // aviso que la contradice (el flag persiste en el config).
            var infoEnv = infoEnvoltura(c.ref);
            html += '<label class="ec-mk-ancho"><input type="checkbox" class="ec-mk-envoltura"'
                + (c.envoltura && infoEnv.hay ? ' checked' : '') + (infoEnv.hay ? '' : ' disabled')
                + '> Envoltura del PDF (PowerClip)</label>';
            if (!infoEnv.hay) {
                html += infoEnv.sin
                    ? '<p class="description">Esta instancia no tiene envoltura en el PDF.</p>'
                    : (infoEnv.disponible
                        ? '<p class="description">Este placeholder no esta recortado en ninguna'
                            + ' forma del PDF (sin envoltura).</p>'
                        : '<p class="description">Sin envolturas analizadas: si el PDF recorta'
                            + ' placeholders dentro de formas (PowerClip), pulsa "Re-analizar"'
                            + ' para extraerlas.</p>');
            }
        }
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
        if (esGrupoPersistido(indices)) {
            html += '<p class="description ec-mk-perspectiva-ayuda">Arrastra los cuatro puntos rojos del lienzo para deformar el grupo como una sola pieza.</p>'
                + '<div class="ec-mk-acciones"><button type="button" class="button button-small" data-mk="reset-perspectiva">Restablecer perspectiva</button></div>';
        } else if (esGrupo) {
            html += '<p class="description ec-mk-perspectiva-ayuda">Agrupa la seleccion para habilitar la perspectiva de cuatro puntos.</p>';
        }
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
        estado.seleccionados = [];
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

    /**
     * Inserta la imagen del catalogo con su proporcion natural, centrada en el
     * lienzo. Spec 011 (T032): `mockups` es la unica fuente de imagenes.
     */
    function agregarCatalogo(id) {
        var it = (datos.imagenes || []).filter(function (x) { return String(x.id) === String(id); })[0];
        if (!it) { return; }
        var url = R.urlDeImagen('mock:' + it.id, contexto());
        R.imagen(url).then(function (recurso) {
            if (!recurso || !recurso.w || !recurso.h) {
                $ed.find('.ec-mk-alertas').text('No se pudo cargar la imagen del catalogo para insertarla.');
                return;
            }
            var escala = Math.min(1, LIENZO / Math.max(recurso.w, recurso.h));
            var ancho = Math.max(1, recurso.w * escala);
            var alto = Math.max(1, recurso.h * escala);
            agregarCapa({
                tipo: 'img', ref: 'mock:' + it.id,
                x: (LIENZO - ancho) / 2, y: (LIENZO - alto) / 2,
                w: ancho, h: alto, rot: 0, sesgo: 0, filtros: {}, modo: 'normal',
                nombre: it.title || it.file, oculta: false, bloqueada: false
            });
        }).catch(function () {
            $ed.find('.ec-mk-alertas').text('No se pudo cargar la imagen del catalogo para insertarla.');
        });
    }

    function nuevoIdGrupo() {
        return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    }

    function agruparSeleccion() {
        var m = mockup();
        var indices = indicesSeleccionados();
        if (!m || indices.length < 2) {
            $ed.find('.ec-mk-alertas').text('Selecciona al menos dos capas para agrupar.');
            return;
        }
        var estadoAnterior = JSON.stringify(estado.mockups);
        var grupo = nuevoIdGrupo();
        indices.forEach(function (i) {
            m.capas[i].grupo = grupo;
            m.capas[i].grupo_rot = 0;
        });
        estado.seleccionados = indices;
        estado.seleccion = indices.indexOf(estado.seleccion) !== -1 ? estado.seleccion : indices[0];
        marcarPaso(estadoAnterior);
        sinGuardar();
        refrescar();
        $ed.find('.ec-mk-alertas').text('Se agruparon ' + indices.length + ' capas.');
    }

    function desagruparSeleccion() {
        var m = mockup();
        var indices = indicesSeleccionados();
        var estadoAnterior = JSON.stringify(estado.mockups);
        var liberadas = 0;
        if (!m) { return; }
        indices.forEach(function (i) {
            if (m.capas[i] && m.capas[i].grupo) {
                delete m.capas[i].grupo;
                liberadas++;
            }
        });
        if (!liberadas) {
            $ed.find('.ec-mk-alertas').text('La seleccion no contiene capas agrupadas.');
            return;
        }
        estado.seleccionados = indices;
        marcarPaso(estadoAnterior);
        sinGuardar();
        refrescar();
        $ed.find('.ec-mk-alertas').text('Se desagruparon ' + liberadas + ' capas.');
    }

    function importarPagina() {
        var numeroPagina = parseInt($ed.find('.ec-mk-num-pagina').val(), 10);
        var $boton = $ed.find('[data-mk="importar-pagina"]');
        var $estado = $ed.find('.ec-mk-importar-estado');
        var cargador = window.pdfjsLib;
        if (!datos.pdfUrl || !datos.pdf || !cargador) {
            $estado.text('No esta disponible el PDF o el motor local de lectura. Recarga la consola.')
                .addClass('ec-error');
            return;
        }
        if (!numeroPagina || numeroPagina < 1) {
            $estado.text('Indica un numero de pagina valido.').addClass('ec-error');
            return;
        }
        if (!mockup()) { nuevoMockup(null); }
        var idMockup = mockup().id;
        var titulo = datos.pdf + '-pagina-' + numeroPagina;
        $boton.prop('disabled', true);
        $estado.removeClass('ec-error').text('Leyendo la pagina y ubicando sus placeholders...');
        cargador.GlobalWorkerOptions.workerSrc = cfg.pdfjsWorkerUrl;
        var tarea = cargador.getDocument({
            url: datos.pdfUrl,
            cMapUrl: cfg.pdfjsCMapUrl,
            cMapPacked: true,
            standardFontDataUrl: cfg.pdfjsStandardFontDataUrl
        });
        tarea.promise.then(function (documento) {
            if (numeroPagina > documento.numPages) {
                throw new Error('El PDF tiene ' + documento.numPages + ' paginas.');
            }
            return Promise.all([
                documento.getPage(numeroPagina),
                apiMotor('mockup_pagina', { pdf: datos.pdf, pagina: numeroPagina })
                    .then(function (respuesta) { return respuesta.data; })
            ]).then(function (resultados) {
                var pagina = resultados[0];
                var geometria = resultados[1];
                var vista = pagina.getViewport({ scale: 1, rotation: 0 });
                var escalaRaster = Math.min(1600 / vista.width, 1600 / vista.height);
                var viewport = pagina.getViewport({ scale: escalaRaster, rotation: 0 });
                var canvasPdf = document.createElement('canvas');
                canvasPdf.width = Math.ceil(viewport.width);
                canvasPdf.height = Math.ceil(viewport.height);
                var contextoPdf = canvasPdf.getContext('2d');
                if (!contextoPdf) { throw new Error('El navegador no pudo crear el lienzo de importacion.'); }
                return pagina.render({ canvasContext: contextoPdf, viewport: viewport }).promise
                    .then(function () {
                        return new Promise(function (resolve, reject) {
                            canvasPdf.toBlob(function (blob) {
                                if (!blob) {
                                    reject(new Error('No se pudo convertir la pagina del PDF a imagen.'));
                                    return;
                                }
                                resolve({ blob: blob, geometria: geometria, ancho: vista.width, alto: vista.height });
                            }, 'image/png');
                        });
                    });
            }).then(function (resultado) {
                if (typeof documento.destroy === 'function') { documento.destroy(); }
                return resultado;
            }, function (error) {
                if (typeof documento.destroy === 'function') { documento.destroy(); }
                throw error;
            });
        }).then(function (resultado) {
            var archivo = new File([resultado.blob], titulo + '.png', { type: 'image/png' });
            return apiMotor('alta', {
                scope: 'mockups',
                title: titulo,
                cats: 'pagina-pdf',
                file: archivo
            }).then(function (respuesta) {
                return { resultado: resultado, imagen: respuesta.data };
            });
        }).then(function (importado) {
            var indiceMockup = -1;
            estado.mockups.forEach(function (m, i) {
                if (m.id === idMockup) { indiceMockup = i; }
            });
            if (indiceMockup < 0) { throw new Error('La vista de destino ya no esta disponible.'); }
            var imagen = importado.imagen;
            var resultado = importado.resultado;
            var marco = {
                x: (LIENZO - Math.min(LIENZO, LIENZO * resultado.ancho / resultado.alto)) / 2,
                y: (LIENZO - Math.min(LIENZO, LIENZO * resultado.alto / resultado.ancho)) / 2,
                w: Math.min(LIENZO, LIENZO * resultado.ancho / resultado.alto),
                h: Math.min(LIENZO, LIENZO * resultado.alto / resultado.ancho)
            };
            var grupoId = nuevoIdGrupo();
            var nuevas = [{
                tipo: 'img', ref: 'mock:' + imagen.id, x: marco.x, y: marco.y,
                w: marco.w, h: marco.h, rot: 0, sesgo: 0, filtros: {}, modo: 'normal',
                nombre: 'Pagina ' + numeroPagina, oculta: false, bloqueada: false,
                grupo: grupoId, grupo_rot: 0
            }];
            var geometria = resultado.geometria;
            if (!geometria || !Array.isArray(geometria.grupos)) {
                throw new Error('El motor no devolvio la geometria de la pagina.');
            }
            var escalaPagina = marco.w / Math.max(1, resultado.ancho);
            var box = geometria.box || [0, 0, resultado.ancho, resultado.alto];
            var origenX = parseFloat(box[0]) || 0;
            var origenY = parseFloat(box[1]) || 0;
            var anchoPagina = Math.max(1, (parseFloat(box[2]) || resultado.ancho) - origenX);
            var altoPagina = Math.max(1, (parseFloat(box[3]) || resultado.alto) - origenY);
            geometria.grupos.forEach(function (grupo) {
                (grupo.instancias || []).forEach(function (instancia) {
                    var b = instancia.bbox || [];
                    if (b.length < 4) { return; }
                    var w = Math.max(1, (parseFloat(instancia.w) || (b[2] - b[0])) * escalaPagina);
                    var h = Math.max(1, (parseFloat(instancia.h) || (b[3] - b[1])) * escalaPagina);
                    var centroX = marco.x + ((parseFloat(b[0]) - origenX + (parseFloat(b[2]) - parseFloat(b[0])) / 2)
                        / anchoPagina) * marco.w;
                    var centroY = marco.y + (((parseFloat(b[1]) + parseFloat(b[3])) / 2
                        + (parseFloat(box[1]) || 0)) / altoPagina) * marco.h;
                    var rotacion = 0;
                    if (instancia.quad && instancia.quad.length > 1) {
                        var dx = parseFloat(instancia.quad[1][0]) - parseFloat(instancia.quad[0][0]);
                        var dy = parseFloat(instancia.quad[1][1]) - parseFloat(instancia.quad[0][1]);
                        rotacion = Math.atan2(-dy, dx) * 180 / Math.PI;
                    }
                    var ref = String(grupo.id) + (instancia.n > 1 ? '#' + instancia.n : '');
                    var info = infoEnvoltura(ref);
                    nuevas.push({
                        tipo: 'placeholder', ref: ref, x: centroX - w / 2, y: centroY - h / 2,
                        w: w, h: h, rot: rotacion, sesgo: 0, filtros: {}, modo: 'normal',
                        nombre: '', oculta: false, bloqueada: false, grupo: grupoId,
                        grupo_rot: 0,
                        envoltura: info.hay
                    });
                });
            });
            var m = estado.mockups[indiceMockup];
            var inicio = m.capas.length;
            var estadoAnterior = JSON.stringify(estado.mockups);
            Array.prototype.push.apply(m.capas, nuevas);
            estado.actual = indiceMockup;
            estado.seleccion = inicio + nuevas.length - 1;
            estado.seleccionados = nuevas.map(function (_, i) { return inicio + i; });
            var itemCatalogo = {
                id: imagen.id, file: imagen.nombre, title: titulo, cats: 'pagina-pdf', url: imagen.url
            };
            datos.imagenes = (datos.imagenes || []).filter(function (item) {
                return String(item.id) !== String(imagen.id);
            });
            datos.imagenes.push(itemCatalogo);
            marcarPaso(estadoAnterior);
            sinGuardar();
            refrescar();
            nuevas.slice(1).forEach(function (c) {
                var info = infoEnvoltura(c.ref);
                if (c.envoltura && info.necesita) { pedirEnvoltura(c); }
            });
            $estado.text('Pagina importada con ' + (nuevas.length - 1)
                + ' placeholder(s), todos agrupados.');
        }).catch(function (error) {
            var mensaje = error && error.message ? error.message : 'No se pudo importar la pagina.';
            $estado.text(mensaje).addClass('ec-error');
        }).then(function () {
            $boton.prop('disabled', false);
            pintarCatalogo();
            dibujar();
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

    function moverCapa(delta, extremo) {
        var m = mockup();
        var i = estado.seleccion;
        if (!m || i < 0) { return; }
        var anterior = JSON.stringify(estado.mockups);
        if (extremo === 'arriba' || extremo === 'abajo') {
            var indices = indicesSeleccionados().filter(function (n) {
                return n >= 0 && n < m.capas.length;
            }).sort(function (a, b) { return a - b; });
            if (!indices.length) { return; }
            var mover = indices.map(function (n) { return m.capas[n]; });
            var restantes = m.capas.filter(function (c, n) { return indices.indexOf(n) === -1; });
            var nuevasCapas = extremo === 'arriba'
                ? restantes.concat(mover) : mover.concat(restantes);
            if (nuevasCapas.every(function (c, n) { return c === m.capas[n]; })) { return; }
            var seleccionada = m.capas[i];
            m.capas = nuevasCapas;
            estado.seleccion = m.capas.indexOf(seleccionada);
            estado.seleccionados = mover.map(function (c) { return m.capas.indexOf(c); });
            marcarPaso(anterior);
            sinGuardar();
            refrescar();
            return;
        }
        var j = i + delta;
        if (j < 0 || j >= m.capas.length) { return; }
        var a = m.capas.splice(i, 1)[0];
        m.capas.splice(j, 0, a);
        estado.seleccion = j;
        estado.seleccionados = estado.seleccionados.map(function (n) {
            if (n === i) { return j; }
            if (i < j && n > i && n <= j) { return n - 1; }
            if (j < i && n >= j && n < i) { return n + 1; }
            return n;
        });
        marcarPaso(anterior);
        sinGuardar();
        refrescar();
    }

    function alinearSeleccion(posicion) {
        var m = mockup();
        if (!m || estado.seleccion < 0) { return; }
        m.capas = G.alinear(m.capas, [estado.seleccion], posicion, { x: 0, y: 0, w: LIENZO, h: LIENZO });
        marcarPaso();
        sinGuardar();
        refrescar();
    }

    /**
     * T034 (spec 011, FR-027): reparte con el MISMO hueco las capas marcadas
     * con Ctrl/Cmd en la lista. Sin marcas, reparte TODAS las capas de la
     * vista (y avisa): asi el boton nunca es una sorpresa vacia. Con menos de
     * 3 capas no hay hueco que repartir y la funcion pura no hace nada.
     */
    function indicesADistribuir(m) {
        var sel = (estado.seleccionados || []).filter(function (i) { return m.capas[i]; });
        if (estado.seleccion >= 0 && m.capas[estado.seleccion] && sel.indexOf(estado.seleccion) === -1) {
            sel.push(estado.seleccion);
        }
        return sel;
    }

    function distribuirSeleccion(eje) {
        var m = mockup();
        if (!m) { return; }
        var sel = indicesADistribuir(m);
        var aviso = '';
        if (!sel.length) {
            if (m.capas.length < 3) {
                aviso = 'Distribuir necesita al menos 3 capas en la vista.';
            } else {
                sel = m.capas.map(function (c, i) { return i; });
                aviso = 'Sin capas marcadas: se repartieron las ' + sel.length + ' de la vista.';
            }
        } else if (sel.length < 3) {
            aviso = 'Marca al menos 3 capas (Ctrl+clic) para repartir.';
        }
        if (sel.length < 3) {
            if (aviso) { $ed.find('.ec-mk-alertas').text(aviso); }
            return;
        }
        m.capas = G.distribuir(m.capas, sel, eje, { x: 0, y: 0, w: LIENZO, h: LIENZO });
        marcarPaso();
        sinGuardar();
        refrescar();
        if (aviso) { $ed.find('.ec-mk-alertas').text(aviso); }
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
        if (accion === 'add-catalogo') {
            if (!(datos.imagenes || []).length) {
                window.alert('Todavia no hay imagenes: arrastra un archivo sobre el lienzo o subilo en "Imagenes de mockup".');
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
        if (accion === 'agrupar') { agruparSeleccion(); return; }
        if (accion === 'desagrupar') { desagruparSeleccion(); return; }
        if (accion === 'importar-pagina') { importarPagina(); return; }
        if (accion === 'reset-perspectiva') {
            var indicesPerspectiva = indicesSeleccionados();
            if (indicesPerspectiva.length < 2) { return; }
            var antesPerspectiva = JSON.stringify(estado.mockups);
            mockup().capas = asignarPerspectiva(capas().slice(), indicesPerspectiva,
                [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
            marcarPaso(antesPerspectiva);
            sinGuardar();
            refrescar();
            return;
        }
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
    /* Reordenar vistas arrastrando (T036). Pointer events, igual que el
       lienzo: no depende de HTML5 drag&drop (que no se puede estilizar). */
    var arrastreVista = null;

    $ed.on('pointerdown', '.ec-mk-mockup[data-arrastre]', function (ev) {
        if (ev.button !== 0 || ev.target.closest('.ec-mk-x')) { return; }
        var $li = $(this);
        arrastreVista = {
            $li: $li,
            desde: parseInt($li.attr('data-i'), 10),
            x0: ev.clientX,
            y0: ev.clientY,
            movido: false
        };
        $(document).on('pointermove.pmu-mkv', function (mev) {
            if (!arrastreVista) { return; }
            var dx = mev.clientX - arrastreVista.x0;
            var dy = mev.clientY - arrastreVista.y0;
            // Umbral: sin el, un clic simple moveria la vista.
            if (!arrastreVista.movido && (Math.abs(dx) < 6 && Math.abs(dy) < 6)) { return; }
            arrastreVista.movido = true;
            arrastreVista.$li.addClass('ec-mk-mockup-arrastre');
            var bajo = document.elementFromPoint(mev.clientX, mev.clientY);
            var $destino = $(bajo).closest('.ec-mk-mockup');
            $ed.find('.ec-mk-soltar').removeClass('ec-mk-soltar');
            if ($destino.length && $destino[0] !== arrastreVista.$li[0]) {
                $destino.addClass('ec-mk-soltar');
            }
        });
        $(document).on('pointerup.pmu-mkv', function (uev) {
            if (!arrastreVista) { return; }
            var bajo = document.elementFromPoint(uev.clientX, uev.clientY);
            var $destino = $(bajo).closest('.ec-mk-mockup');
            var arr = arrastreVista;
            arrastreVista = null;
            $(document).off('.pmu-mkv');
            arr.$li.removeClass('ec-mk-mockup-arrastre');
            $ed.find('.ec-mk-soltar').removeClass('ec-mk-soltar');
            if (!arr.movido || !$destino.length) { return; }
            var hasta = parseInt($destino.attr('data-i'), 10);
            if (isNaN(hasta) || hasta === arr.desde) { return; }
            moverVista(arr.desde, hasta);
        });
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

    var pulsacionCapa = null;
    function cancelarPulsacionCapa() {
        if (!pulsacionCapa) { return; }
        if (pulsacionCapa.temporizador) { clearTimeout(pulsacionCapa.temporizador); }
        if (pulsacionCapa.boton) { pulsacionCapa.boton.classList.remove('ec-manteniendo'); }
        pulsacionCapa = null;
    }

    $ed.on('pointerdown', '.ec-mk-capa-btn[data-acc="arriba"], .ec-mk-capa-btn[data-acc="abajo"]', function (ev) {
        if (ev.button !== 0) { return; }
        cancelarPulsacionCapa();
        var indice = parseInt($(this).closest('.ec-mk-capa').attr('data-i'), 10);
        var accion = String($(this).attr('data-acc'));
        if (isNaN(indice) || !capas()[indice]) { return; }
        seleccionarCapa(indice, false, ev.altKey);
        var boton = this;
        pulsacionCapa = {
            boton: boton,
            indice: indice,
            accion: accion,
            x: ev.clientX,
            y: ev.clientY,
            pointerId: ev.pointerId,
            temporizador: setTimeout(function () {
                if (!pulsacionCapa || pulsacionCapa.boton !== boton) { return; }
                pulsacionCapa.temporizador = null;
                estado.suprimirClicCapa = Date.now() + 500;
                moverCapa(0, accion);
            }, 1000)
        };
    });
    $(document).on('pointermove.pmuCapa', function (ev) {
        if (!pulsacionCapa || ev.pointerId !== pulsacionCapa.pointerId) { return; }
        if (Math.hypot(ev.clientX - pulsacionCapa.x, ev.clientY - pulsacionCapa.y) > 8) {
            cancelarPulsacionCapa();
        }
    });
    $(document).on('pointerup.pmuCapa pointercancel.pmuCapa', cancelarPulsacionCapa);
    $ed.on('contextmenu', '.ec-mk-capa-btn[data-acc="arriba"], .ec-mk-capa-btn[data-acc="abajo"]', function (ev) {
        ev.preventDefault();
    });

    /* Lista de capas: seleccionar y acciones por capa. */
    $ed.on('click', '.ec-mk-capa', function (ev) {
        var i = parseInt($(this).attr('data-i'), 10);
        var acc = String($(ev.target).attr('data-acc') || '');
        if ((acc === 'arriba' || acc === 'abajo') && Date.now() < estado.suprimirClicCapa) {
            estado.suprimirClicCapa = 0;
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return;
        }
        if (!acc) {
            seleccionarCapa(i, ev.ctrlKey || ev.metaKey, ev.altKey);
            refrescar();
            return;
        }
        seleccionarCapa(i, false, ev.altKey);
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

    /* Propiedades numericas: aplicar durante la edicion y guardar un solo paso al terminar. */
    $ed.on('focusin', '.ec-mk-geo', function () {
        var indices = indicesSeleccionados();
        geoEdicion = {
            campo: String($(this).attr('data-geo')),
            indices: indices,
            original: JSON.parse(JSON.stringify(capas())),
            estadoAnterior: JSON.stringify(estado.mockups),
            seleccion: estado.seleccion,
            modificado: false
        };
    });
    $ed.on('input', '.ec-mk-geo', function () {
        if (!geoEdicion) { return; }
        var campo = geoEdicion.campo;
        var v = parseFloat(this.value);
        if (!isFinite(v)) { return; }
        geoEdicion.modificado = true;
        var originales = geoEdicion.original;
        var indices = geoEdicion.indices;
        var base = originales[geoEdicion.seleccion];
        if (indices.length > 1) {
            var marco = G.marco(originales, indices);
            if (!marco) { return; }
            if (campo === 'x' || campo === 'y') {
                mockup().capas = G.transformarGrupo(originales, indices,
                    { x: marco.x, y: marco.y }, 0,
                    campo === 'x' ? v - marco.x : 0,
                    campo === 'y' ? v - marco.y : 0);
            } else if (campo === 'w' || campo === 'h') {
                var dimension = Math.max(1, Math.min(G.MAX_DIMENSION, v));
                var sx = campo === 'w' ? dimension / Math.max(1, marco.w) : 1;
                var sy = campo === 'h' ? dimension / Math.max(1, marco.h) : 1;
                mockup().capas = G.escalarGrupo(originales, indices,
                    { x: marco.x + marco.w / 2, y: marco.y + marco.h / 2 }, sx, sy);
            } else if (campo === 'rot' && base) {
                mockup().capas = G.transformarGrupo(originales, indices,
                    { x: marco.x + marco.w / 2, y: marco.y + marco.h / 2 },
                    v - (base.rot || 0), 0, 0);
            }
        } else if (base) {
            var editada = {};
            Object.keys(base).forEach(function (k) { editada[k] = base[k]; });
            editada[campo] = v;
            var normalizada = G.acotar(editada);
            Object.keys(normalizada).forEach(function (k) { editada[k] = normalizada[k]; });
            mockup().capas = originales.slice();
            mockup().capas[geoEdicion.seleccion] = editada;
        }
        sinGuardar(false);
        dibujar();
    });
    $ed.on('focusout', '.ec-mk-geo', function () {
        if (!geoEdicion) { return; }
        var edicion = geoEdicion;
        geoEdicion = null;
        if (edicion.modificado) {
            marcarPaso(edicion.estadoAnterior);
            sinGuardar();
            refrescar();
        }
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

    /* Envoltura (PowerClip): on/off por capa placeholder. v2: la forma por
       defecto del grupo ya viaja en la pagina (sin pedidos); SOLO las
       instancias con otra forma piden su geometria (op=envoltura, cacheada). */
    $ed.on('change', '.ec-mk-envoltura', function () {
        var c = capa();
        if (!c) { return; }
        var activar = this.checked === true;
        c.envoltura = activar;
        marcarPaso();
        sinGuardar();
        if (!activar) {
            refrescar();
            return;
        }
        var info = infoEnvoltura(c.ref);
        if (!info.hay) {
            c.envoltura = false;
            refrescar();
            $ed.find('.ec-mk-alertas').text(info.sin
                ? 'Esta instancia no tiene envoltura en el PDF.'
                : 'No hay envoltura analizada para este placeholder: re-analiza el PDF.');
            return;
        }
        if (!info.necesita) {
            refrescar();
            return;
        }
        pedirEnvoltura(c);
    });

    /** Pide la geometria de una EXCEPCION (forma distinta de la default) y
        refresca. Sin ella (o sin red) la capa vuelve a sin envoltura, con
        aviso visible. */
    function pedirEnvoltura(c) {
        var ref = c.ref;
        var gid = String(ref).split('#')[0];
        var info = infoEnvoltura(ref);
        if (!apiMotor || !info.necesita) {
            revertirEnvoltura(ref, 'No se pudo pedir la envoltura al servidor.');
            return;
        }
        apiMotor('envoltura', { pdf: datos.pdf, gid: gid, n: info.n })
            .then(function (j) {
                var env = j && j.data ? j.data.envoltura : null;
                if (env) {
                    estado.envs[gid + '#' + info.n] = env;
                    // Cache nueva: repintar siempre, aunque la seleccion haya
                    // cambiado mientras viajaba el pedido.
                    refrescar();
                    return;
                }
                revertirEnvoltura(ref,
                    'El analisis no conserva la envoltura de esta instancia: se quito el recorte.');
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message)
                    ? e.message : 'No se pudo pedir la envoltura al servidor.';
                revertirEnvoltura(ref, msg);
            });
    }

    /**
     * Desmarca `envoltura` en la capa con ese `ref` dentro de la vista ACTUAL
     * (la seleccion pudo cambiar mientras viajaba el pedido: se busca por ref,
     * no por seleccion) y avisa. El aviso va despues de refrescar, que vacia
     * el contenedor de alertas.
     */
    function revertirEnvoltura(ref, mensaje) {
        var m = mockup();
        (m ? m.capas : []).forEach(function (capa2) {
            if (capa2 && capa2.ref === ref) {
                capa2.envoltura = false;
            }
        });
        refrescar();
        $ed.find('.ec-mk-alertas').text(mensaje);
    }

    /* Recursos: miniaturas del catalogo y placeholders (un clic = capa). */
    $ed.on('click', '.ec-mk-mini', function () {
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
    /* El boton de borrar vive dentro de la miniatura: sin stopPropagation el
       clic llegaria tambien al manejador de la miniatura y crearia la capa. */
    $ed.on('click', '.ec-mk-mini-x', function (ev) {
        ev.stopPropagation();
        borrarImagenCatalogo($(this).attr('data-borrar-img'));
    });
    /* Borrado de una imagen del catalogo de mockups (T032). Antes de borrar
       pregunta cuantas capas la usan y ofrece quitarla de ellas o cancelar:
       sin esto, un borrado dejaba capas apuntando a un id inexistente y el
       lienzo mostraba la caja neutra sin explicar por que (FR-016). */
    function capasQueUsan(id) {
        var ref = 'mock:' + id;
        var out = [];
        estado.mockups.forEach(function (m, mi) {
            (m.capas || []).forEach(function (c, ci) {
                if (c.tipo === 'img' && String(c.ref) === ref) {
                    out.push([mi, ci]);
                }
            });
        });
        return out;
    }

    function borrarImagenCatalogo(id) {
        var it = (datos.imagenes || []).filter(function (x) {
            return String(x.id) === String(id);
        })[0];
        if (!it) { return; }
        var uso = capasQueUsan(id);
        var quitar = false;
        if (uso.length) {
            var msg = 'La imagen ' + (it.title || it.file) + ' la usan '
                + uso.length + ' capa(s) de tus vistas. Quitarla y borrar?'
            quitar = window.confirm(msg);
            if (!quitar) { return; }
        } else if (!window.confirm('Borrar la imagen "'
                + (it.title || it.file) + '"?')) {
            return;
        }
        if (quitar) {
            uso.forEach(function (par) {
                var capasVista = estado.mockups[par[0]].capas;
                capasVista.splice(par[1], 1);
            });
            estado.seleccion = -1;
        }
        apiMotor('baja', { scope: 'mockups', id: id })
            .then(function () {
                datos.imagenes = (datos.imagenes || []).filter(function (x) {
                    return String(x.id) !== String(id);
                });
                marcarPaso();
                sinGuardar();
                refrescar();
            })
            ['catch'](function (e) {
                if (aviso) { aviso($ed.closest('.card, .wrap'), (e && e.message) || 'No se pudo borrar.', true); }
            });
    }

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
        if (!cfg.motorUrl || !cfg.motorNonce) {
            avisar('El catalogo de mockups no esta disponible. Recarga la pagina.');
            return;
        }
        $ed.find('.ec-mk-estado').removeClass('ec-guardado ec-sin-guardar')
            .addClass('ec-guardando').text('Subiendo imagen...');
        // Spec 011 (T032): la imagen va al catalogo `mockups` (no a
        // `pdfs/{nombre}/mockups/`), que es la unica fuente de imagenes de capa.
        var fd = new FormData();
        fd.append('op', 'alta');
        fd.append('scope', 'mockups');
        fd.append('title', String(archivo.name || 'Imagen'));
        fd.append('file', archivo, String(archivo.name || 'imagen'));
        fd.append('_wpnonce', cfg.motorNonce);
        fetch(cfg.motorUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j || j.success !== true) {
                    throw new Error((j && typeof j.data === 'string' && j.data) || 'No se pudo subir.');
                }
                // `op=alta` responde `{id, nombre, url}` (PMU_Uploads::alta).
                // Se relee el catalogo para no inventar el item: el servidor es
                // la autoridad del id y de la url.
                var id = j.data && j.data.id !== undefined ? j.data.id : null;
                if (id === null) {
                    throw new Error('La imagen se subio pero no volvio en el catalogo.');
                }
                return apiMotor('listar', { scope: 'mockups' }).then(function (lj) {
                    datos.imagenes = (lj && lj.data && lj.data.items) ? lj.data.items : [];
                    agregarCatalogo(id);
                });
            })
            ['catch'](function (e) {
                estado.guardado = 'error';
                $ed.find('.ec-mk-estado').text(
                    (e instanceof Error && e.message) ? e.message : 'No se pudo subir la imagen.');
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
        if (ev.key === 'Escape') { estado.seleccion = -1; estado.seleccionados = []; refrescar(); return; }
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

    /* Distribuir (T034, FR-027): data-eje="x"|"y". */
    $ed.on('click', '.ec-mk-dist', function () {
        distribuirSeleccion(String($(this).attr('data-eje')) === 'y' ? 'y' : 'x');
    });

    /* Arranque. */
    pintarZooms();
    ajustarLienzo();
    if (estado.mockups.length) { estado.actual = 0; }
    refrescar();
    verCliente();
    window.addEventListener('resize', function () { dibujar(); });
});
