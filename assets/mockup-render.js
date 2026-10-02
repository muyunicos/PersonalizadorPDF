/**
 * mockup-render.js - Nucleo de composicion del mockup (spec 011, R1).
 *
 * UNICA funcion de render del sistema: la usan el editor del admin
 * (assets/mockups.js) y la ficha del cliente (assets/tienda.js). Existia
 * una implementacion por consumidor y ambas estiraban la imagen a la caja
 * (incumpliendo el criterio de la spec 004 "misma funcion de render").
 *
 * Reglas (contracts/mockup-capas.md):
 * - indice 0 al fondo; `oculta` se salta pero conserva su geometria;
 * - el recurso se ENCAJA sin deformar (nunca estirar) y se informa si la
 *   proporcion de la caja difiere de la del recurso;
 * - rotacion y sesgo en el centro de la caja, cada capa aislada con
 *   save/restore (mismo criterio que Overlay en el motor, AGENTS 4.4);
 * - si el recurso no existe, la capa cae a una caja neutra con su ref: la
 *   composicion nunca falla;
 * - los ajustes afectan SOLO a la vista previa: nunca al PNG del pool ni al
 *   PDF final (constitution 3).
 *
 * No conoce rutas, sesiones ni pools: recibe un `resolver(ref)`.
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    root.PMUMockup = api;
    if (typeof module === 'object' && module && module.exports) {
        module.exports = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var LIENZO = 300;
    var cacheImagenes = {};

    function numero(valor, porDefecto) {
        var n = parseFloat(valor);
        return isFinite(n) ? n : (porDefecto || 0);
    }

    /* ============ Ajustes por capa ============ */

    /**
     * Traduce los ajustes de la capa a los tres mecanismos de Canvas 2D.
     * `opacidad` va a globalAlpha (no existe en ctx.filter); `modo` va a
     * globalCompositeOperation; el resto a ctx.filter.
     */
    function filtroCss(filtros, modo) {
        var f = filtros || {};
        var partes = [];
        function pct(clave, defecto) {
            var v = f[clave] === undefined ? defecto : numero(f[clave], defecto);
            return v;
        }
        var brillo = pct('brillo', 100);
        var contraste = pct('contraste', 100);
        var saturacion = pct('saturacion', 100);
        var gama = pct('gama', 100);
        var desenfoque = pct('desenfoque', 0);
        var tono = pct('tono', 0);
        if (brillo !== 100) { partes.push('brightness(' + (brillo / 100) + ')'); }
        if (contraste !== 100) { partes.push('contrast(' + (contraste / 100) + ')'); }
        if (saturacion !== 100) { partes.push('saturate(' + (saturacion / 100) + ')'); }
        if (gama !== 100) { partes.push('grayscale(' + (gama / 100) + ')'); }
        if (desenfoque !== 0) { partes.push('blur(' + desenfoque + 'px)'); }
        if (tono !== 0) { partes.push('hue-rotate(' + tono + 'deg)'); }
        var opacidad = pct('opacidad', 100);
        return {
            filtro: partes.length ? partes.join(' ') : 'none',
            alfa: acotar(opacidad / 100, 0, 1),
            composicion: modo && modo !== 'normal' ? modo : 'source-over'
        };
    }

    function acotar(valor, min, max) {
        if (valor < min) { return min; }
        if (valor > max) { return max; }
        return valor;
    }

    /* ============ Encaje sin deformar ============ */

    /**
     * Encaja el recurso dentro de la caja `destino` sin deformar (regla
     * `contain` vigente en el sistema). Devuelve el rectangulo realmente
     * usado y si hubo discrepancia de proporcion, para que el editor pueda
     * avisar (FR-024) y el cliente solo encaje.
     */
    function contener(destino, recurso) {
        var d = destino || { x: 0, y: 0, w: LIENZO, h: LIENZO };
        var caja = { x: d.x, y: d.y, w: d.w, h: d.h };
        var naturalW = recurso && recurso.w > 0 ? recurso.w : 0;
        var naturalH = recurso && recurso.h > 0 ? recurso.h : 0;
        if (!naturalW || !naturalH) {
            return { x: caja.x, y: caja.y, w: caja.w, h: caja.h, discrepancia: false };
        }
        var escalaCaja = caja.w / naturalW;
        var escalaAlto = caja.h / naturalH;
        var escala = Math.min(escalaCaja, escalaAlto);
        var ancho = naturalW * escala;
        var alto = naturalH * escala;
        var razonCaja = caja.w / caja.h;
        var razonNatural = naturalW / naturalH;
        // Tolerancia del 1 %: solo avisamos cuando el desvio es visible.
        var discrepancia = Math.abs(razonCaja - razonNatural) / razonNatural > 0.01;
        return {
            x: caja.x + (caja.w - ancho) / 2,
            y: caja.y + (caja.h - alto) / 2,
            w: ancho,
            h: alto,
            escala: escala,
            discrepancia: discrepancia
        };
    }

    /* ============ Carga de imagenes (cache por URL) ============ */

    /** Carga (o recupera de cache) la imagen de una URL. Nunca lanza. */
    function imagen(url) {
        if (!url) { return Promise.resolve(null); }
        if (cacheImagenes[url]) { return cacheImagenes[url]; }
        var promesa = new Promise(function (resolver) {
            var img = new Image();
            img.onload = function () {
                resolver({ img: img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
            };
            img.onerror = function () { resolver(null); };
            img.src = url;
        });
        cacheImagenes[url] = promesa;
        return promesa;
    }

    /** Vacia la cache (util entre paginas y en pruebas). */
    function limpiarCache() {
        cacheImagenes = {};
    }

    /* ============ Validez de una capa ============ */

    /**
     * Dice si la capa resuelve contra el contexto dado. No lanza: una capa
     * invalida se marca pero se conserva (FR-038).
     *
     * contexto: { fotos: {archivo: url}, imagenes: [{id, file, url}],
     *             grupos: [{id, cont}] }
     */
    function esValida(capa, contexto) {
        if (!capa || !capa.tipo) { return false; }
        var ctx = contexto || {};
        if (capa.tipo === 'img') {
            return urlDeImagen(capa.ref, ctx) !== '';
        }
        if (capa.tipo === 'placeholder') {
            var partes = String(capa.ref || '').split('#');
            var grupo = null;
            (ctx.grupos || []).forEach(function (g) {
                if (g && String(g.id) === partes[0]) { grupo = g; }
            });
            if (!grupo) { return false; }
            if (partes.length < 2) { return true; }
            var indice = parseInt(partes[1], 10);
            if (isNaN(indice) || indice < 1) { return true; }
            return indice <= (parseInt(grupo.cont, 10) || 1);
        }
        return false;
    }

    /**
     * URL del recurso de una capa `img`, resolviendo el namespace `pdf:` /
     * `img:`. Un `ref` plano se lee como `pdf:` (compatibilidad con los
     * mockups anteriores a esta spec).
     */
    function urlDeImagen(ref, contexto) {
        var refCrudo = String(ref || '');
        if (refCrudo === '') { return ''; }
        var ambito = 'pdf';
        var valor = refCrudo;
        var corte = refCrudo.indexOf(':');
        if (corte > 0) {
            ambito = refCrudo.slice(0, corte);
            valor = refCrudo.slice(corte + 1);
        }
        var ctx = contexto || {};
        if (ambito === 'img') {
            var id = parseInt(valor, 10);
            if (isNaN(id)) { return ''; }
            var encontrado = '';
            (ctx.imagenes || []).forEach(function (it) {
                if (it && parseInt(it.id, 10) === id && it.url) { encontrado = it.url; }
            });
            return encontrado;
        }
        return (ctx.fotos || {})[valor] || '';
    }


    /* ============ Composicion ============ */

    /** Dibuja la caja neutra de encuadre (recurso ausente o sin render). */
    function cajaNeutra(ctx, ref, caja) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(caja.x, caja.y, caja.w, caja.h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1;
        ctx.strokeRect(caja.x + 0.5, caja.y + 0.5, caja.w - 1, caja.h - 1);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ref || ''), caja.x + caja.w / 2, caja.y + caja.h / 2);
        ctx.restore();
    }

    /**
     * Compone las capas sobre el contexto en el espacio logico 300x300.
     *
     * opciones: { resolver(ref) -> {url, w, h} | Promise | null,
     *             contexto: {fotos, imagenes, grupos},
     *             limpiar: true (por defecto),
     *             lienzo: 300 }
     *
     * Resuelve `{compuestas, invalidas, discrepancias}`:
     * - invalidas: indices de capas sin recurso, con su ref (no se pierden);
     * - discrepancias: indices donde la caja no comparte proporcion con el
     *   recurso, para que el editor avise.
     */
    function componer(ctx, capas, opciones) {
        var op = opciones || {};
        var lista = capas || [];
        var resolver = op.resolver || function () { return null; };
        var lado = op.lienzo || LIENZO;
        var invalidas = [];
        var discrepancias = [];
        var compuestas = [];

        if (op.limpiar !== false && ctx && typeof ctx.clearRect === 'function') {
            ctx.clearRect(0, 0, lado, lado);
        }

        var trabajo = lista.map(function (capa, indice) {
            if (!capa || capa.oculta) { return Promise.resolve(null); }
            var caja = {
                x: numero(capa.x), y: numero(capa.y),
                w: Math.max(1, numero(capa.w, 1)),
                h: Math.max(1, numero(capa.h, 1))
            };
            var bruto;
            try {
                bruto = resolver(capa);
            } catch (e) {
                bruto = null;
            }
            return Promise.resolve(bruto).then(function (recurso) {
                if (!recurso || !recurso.url) {
                    invalidas.push({ indice: indice, ref: capa.ref, tipo: capa.tipo });
                }
                var listo = recurso && recurso.url ? imagen(recurso.url) : Promise.resolve(null);
                return listo.then(function (img) {
                    compuestas.push({
                        indice: indice,
                        capa: capa,
                        caja: caja,
                        img: img,
                        recurso: recurso || null
                    });
                });
            });
        });

        return Promise.all(trabajo).then(function () {
            // Orden estable: el array de entrada manda en el z-order.
            compuestas.sort(function (a, b) { return a.indice - b.indice; });
            compuestas.forEach(function (item) {
                if (!ctx) { return; }
                var c = item.capa;
                var caja = item.caja;
                var est = filtroCss(c.filtros, c.modo);
                ctx.save();
                ctx.globalAlpha = est.alfa;
                ctx.globalCompositeOperation = est.composicion;
                ctx.filter = est.filtro;
                ctx.translate(caja.x + caja.w / 2, caja.y + caja.h / 2);
                if (numero(c.rot) !== 0) {
                    ctx.rotate(numero(c.rot) * Math.PI / 180);
                }
                if (numero(c.sesgo) !== 0) {
                    ctx.transform(1, 0, acotar(numero(c.sesgo), -1, 1), 1, 0, 0);
                }
                if (item.img && item.img.img) {
                    var medidas = item.recurso && item.recurso.w && item.recurso.h
                        ? { w: item.recurso.w, h: item.recurso.h }
                        : { w: item.img.w, h: item.img.h };
                    var encaje = contener({ x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h }, medidas);
                    if (encaje.discrepancia) { discrepancias.push({ indice: item.indice, ref: c.ref }); }
                    ctx.drawImage(item.img.img, encaje.x, encaje.y, encaje.w, encaje.h);
                } else {
                    // Sin recurso: caja neutra de encuadre (nunca falla).
                    cajaNeutra(ctx, c.ref, { x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h });
                }
                ctx.restore();
            });
            return { compuestas: compuestas, invalidas: invalidas, discrepancias: discrepancias };
        });
    }

    return {
        LIENZO: LIENZO,
        // Nombre canonico (contracts/mockup-capas.md 2): `componer`. `composicion`
        // queda como alias para no romper a ningun consumidor anterior.
        componer: componer,
        composicion: componer,
        contener: contener,
        filtroCss: filtroCss,
        esValida: esValida,
        urlDeImagen: urlDeImagen,
        imagen: imagen,
        limpiarCache: limpiarCache,
        cajaNeutra: cajaNeutra
    };
}));

