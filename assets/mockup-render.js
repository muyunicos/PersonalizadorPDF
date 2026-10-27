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
 * - si la capa placeholder pide `envoltura` y el contexto trae su clip
 *   (PowerClip del PDF), se aplica `ctx.clip` ANTES de dibujar; sin clip
 *   disponible, degrada sin recortar (nunca falla);
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
     * URL del recurso de una capa `img`. El namespace es **obligatorio**:
     * `pdf:{archivo}` (foto del PDF) o `mock:{id}` (id numerico del catalogo).
     * Spec 020 (B5): un `ref` plano ya NO se lee como `pdf:` (el editor siempre
     * escribe el namespace); un ref invalido devuelve '' y la capa no se dibuja.
     */
    function urlDeImagen(ref, contexto) {
        var refCrudo = String(ref || '');
        if (refCrudo === '') { return ''; }
        var corte = refCrudo.indexOf(':');
        if (corte < 1) { return ''; }
        var ambito = refCrudo.slice(0, corte);
        var valor = refCrudo.slice(corte + 1);
        var ctx = contexto || {};
        if (ambito === 'mock') {
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


    /* ============ Envolturas (PowerClip) ============ */

    /**
     * Envoltura (clip del PDF) de una capa placeholder. v2 (formas
     * deduplicadas): la pagina trae la forma POR DEFECTO del grupo UNA vez
     * (`env_defecto`) + las excepciones (`env_exc`, 0 = sin envoltura) + la
     * geometria de las excepciones ya resueltas (`envs`). Resolucion:
     * excepcion explicita > geometria resuelta > forma por defecto. El `ref`
     * plano ({grupo}) usa la instancia #1. Sin envoltura -> null: la
     * composicion degrada al rectangulo (nunca falla).
     */
    function envolturaDeRef(ref, grupos) {
        var partes = String(ref || '').split('#');
        var n = parseInt(partes[1], 10);
        if (isNaN(n) || n < 1) { n = 1; }
        var env = null;
        (grupos || []).forEach(function (g) {
            if (!g || String(g.id) !== partes[0]) { return; }
            var exc = g.env_exc || {};
            var esExc = Object.prototype.hasOwnProperty.call(exc, String(n));
            if (esExc && numero(exc[String(n)]) === 0) {
                env = null; // excepcion explicita: esta instancia no tiene envoltura
                return;
            }
            var resuelta = (g.envs && g.envs[String(n)]) || null;
            if (resuelta && resuelta.subs && resuelta.subs.length) {
                env = resuelta; // excepcion con geometria (embebida o pedida)
                return;
            }
            if (esExc) {
                env = null; // excepcion pendiente de pedido: NUNCA cae a la default
                return;
            }
            var def = g.env_defecto || null;
            env = (def && def.subs && def.subs.length) ? def : null;
        });
        return env;
    }

    /**
     * Comandos de dibujo de la envoltura mapeados al rect de la capa (puro:
     * testeable con node). `env.subs[].m` es el origen y los segmentos van
     * planos: ['l',x,y] / ['c',x1,y1,x2,y2,x3,y3]; `c` cierra la subruta.
     * Salida: [['M',x,y], ['L',x,y], ['C',...], ['Z'], ...].
     */
    function comandosEnvoltura(env, caja) {
        var c = caja || { x: 0, y: 0, w: LIENZO, h: LIENZO };
        var out = [];
        if (!env || !env.subs) { return out; }
        function px(u) { return c.x + numero(u) * c.w; }
        function py(v) { return c.y + numero(v) * c.h; }
        env.subs.forEach(function (sub) {
            if (!sub || !sub.m) { return; }
            out.push(['M', px(sub.m[0]), py(sub.m[1])]);
            (sub.s || []).forEach(function (seg) {
                if (!seg) { return; }
                if (seg[0] === 'l') {
                    out.push(['L', px(seg[1]), py(seg[2])]);
                } else if (seg[0] === 'c') {
                    out.push(['C', px(seg[1]), py(seg[2]), px(seg[3]), py(seg[4]), px(seg[5]), py(seg[6])]);
                }
            });
            if (sub.c) { out.push(['Z']); }
        });
        return out;
    }

    /**
     * Traza los comandos sobre el ctx (via canvas path, sin Path2D: tambien
     * funciona con el ctx falso de los tests). Llamar dentro de save/restore.
     */
    function trazarEnvoltura(ctx, comandos) {
        ctx.beginPath();
        comandos.forEach(function (k) {
            if (k[0] === 'M') { ctx.moveTo(k[1], k[2]); }
            else if (k[0] === 'L') { ctx.lineTo(k[1], k[2]); }
            else if (k[0] === 'C') { ctx.bezierCurveTo(k[1], k[2], k[3], k[4], k[5], k[6]); }
            else if (k[0] === 'Z') { ctx.closePath(); }
        });
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

    function puntosPerspectiva(valor) {
        var puntos = valor && valor.puntos;
        if (!Array.isArray(puntos) || puntos.length !== 4) { return null; }
        var salida = [];
        for (var i = 0; i < 4; i++) {
            if (!puntos[i] || !isFinite(Number(puntos[i].x)) || !isFinite(Number(puntos[i].y))) {
                return null;
            }
            salida.push({ x: Number(puntos[i].x), y: Number(puntos[i].y) });
        }
        return salida;
    }

    function esPerspectivaNeutra(puntos) {
        var neutros = [[0, 0], [1, 0], [1, 1], [0, 1]];
        return !puntos || puntos.every(function (p, i) {
            return Math.abs(p.x - neutros[i][0]) < 0.0001
                && Math.abs(p.y - neutros[i][1]) < 0.0001;
        });
    }

    function perspectivaConvexa(puntos) {
        if (!puntos || puntos.length !== 4) { return false; }
        var signo = 0;
        for (var i = 0; i < 4; i++) {
            var a = puntos[i], b = puntos[(i + 1) % 4], c = puntos[(i + 2) % 4];
            var cruz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
            if (Math.abs(cruz) < 0.00001) { return false; }
            var actual = cruz > 0 ? 1 : -1;
            if (signo && actual !== signo) { return false; }
            signo = actual;
        }
        return true;
    }

    /** Mapea el cuadrado unidad a un cuadrilatero mediante una homografia. */
    function homografia(puntos, u, v) {
        var p0 = puntos[0], p1 = puntos[1], p2 = puntos[2], p3 = puntos[3];
        var dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
        var dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
        var den = dx1 * dy2 - dx2 * dy1;
        var g = 0, h = 0;
        if (Math.abs(den) > 1e-8) {
            g = (dx3 * dy2 - dx2 * dy3) / den;
            h = (dx1 * dy3 - dx3 * dy1) / den;
        }
        var a = p1.x - p0.x + g * p1.x;
        var b = p3.x - p0.x + h * p3.x;
        var c = p0.x;
        var d = p1.y - p0.y + g * p1.y;
        var e = p3.y - p0.y + h * p3.y;
        var f = p0.y;
        var divisor = g * u + h * v + 1;
        if (Math.abs(divisor) < 1e-8) { divisor = divisor < 0 ? -1e-8 : 1e-8; }
        return { x: (a * u + b * v + c) / divisor, y: (d * u + e * v + f) / divisor };
    }

    function esquinasCapa(capa) {
        var cx = numero(capa.x) + numero(capa.w, 1) / 2;
        var cy = numero(capa.y) + numero(capa.h, 1) / 2;
        var rad = numero(capa.rot) * Math.PI / 180;
        var cos = Math.cos(rad), sin = Math.sin(rad);
        var sesgo = acotar(numero(capa.sesgo), -1, 1);
        return [[-capa.w / 2, -capa.h / 2], [capa.w / 2, -capa.h / 2],
            [capa.w / 2, capa.h / 2], [-capa.w / 2, capa.h / 2]].map(function (p) {
            var x = p[0] + sesgo * p[1];
            return { x: cx + x * cos - p[1] * sin, y: cy + x * sin + p[1] * cos };
        });
    }

    function marcoItems(items, rot) {
        var angulo = numero(rot) * Math.PI / 180;
        var cos = Math.cos(angulo), sin = Math.sin(angulo);
        var puntos = [];
        items.forEach(function (item) {
            esquinasCapa(item.capa).forEach(function (p) {
                puntos.push({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos });
            });
        });
        var xs = puntos.map(function (p) { return p.x; });
        var ys = puntos.map(function (p) { return p.y; });
        var x = Math.min.apply(Math, xs), y = Math.min.apply(Math, ys);
        return { x: x, y: y, w: Math.max(1, Math.max.apply(Math, xs) - x),
            h: Math.max(1, Math.max.apply(Math, ys) - y), rot: numero(rot) };
    }

    function puntoMarco(marco, x, y) {
        var rad = numero(marco.rot) * Math.PI / 180;
        var lx = marco.x + numero(x) * marco.w;
        var ly = marco.y + numero(y) * marco.h;
        return { x: lx * Math.cos(rad) - ly * Math.sin(rad),
            y: lx * Math.sin(rad) + ly * Math.cos(rad) };
    }

    function crearCanvas(w, h) {
        var canvas;
        if (typeof OffscreenCanvas !== 'undefined') {
            canvas = new OffscreenCanvas(w, h);
        } else if (typeof document !== 'undefined' && document.createElement) {
            canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
        }
        return canvas || null;
    }

    function dibujarItem(ctx, item, op, discrepancias) {
        var c = item.capa;
        var caja = item.caja;
        var est = filtroCss(c.filtros, c.modo);
        ctx.save();
        ctx.globalAlpha = est.alfa;
        ctx.globalCompositeOperation = est.composicion;
        ctx.filter = est.filtro;
        ctx.translate(caja.x + caja.w / 2, caja.y + caja.h / 2);
        if (numero(c.rot) !== 0) { ctx.rotate(numero(c.rot) * Math.PI / 180); }
        if (numero(c.sesgo) !== 0) {
            ctx.transform(1, 0, acotar(numero(c.sesgo), -1, 1), 1, 0, 0);
        }
        if (item.env) {
            trazarEnvoltura(ctx, comandosEnvoltura(item.env, {
                x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h
            }));
            ctx.clip(item.env.par ? 'evenodd' : 'nonzero');
        }
        if (item.img && item.img.img) {
            var medidas = item.recurso && item.recurso.w && item.recurso.h
                ? { w: item.recurso.w, h: item.recurso.h }
                : { w: item.img.w, h: item.img.h };
            var encaje = contener({ x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h }, medidas);
            if (encaje.discrepancia) { discrepancias.push({ indice: item.indice, ref: c.ref }); }
            ctx.drawImage(item.img.img, encaje.x, encaje.y, encaje.w, encaje.h);
        } else if (!op.huecosTransparentes) {
            cajaNeutra(ctx, c.ref, { x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h });
        }
        ctx.restore();
    }

    function dibujarTriangulo(ctx, fuente, origen, destino) {
        var x0 = origen[0].x, y0 = origen[0].y;
        var x1 = origen[1].x, y1 = origen[1].y;
        var x2 = origen[2].x, y2 = origen[2].y;
        var X0 = destino[0].x, Y0 = destino[0].y;
        var X1 = destino[1].x, Y1 = destino[1].y;
        var X2 = destino[2].x, Y2 = destino[2].y;
        var den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
        if (Math.abs(den) < 1e-8) { return; }
        var a = (X0 * (y1 - y2) + X1 * (y2 - y0) + X2 * (y0 - y1)) / den;
        var c = (X0 * (x2 - x1) + X1 * (x0 - x2) + X2 * (x1 - x0)) / den;
        var e = (X0 * (x1 * y2 - x2 * y1) + X1 * (x2 * y0 - x0 * y2)
            + X2 * (x0 * y1 - x1 * y0)) / den;
        var b = (Y0 * (y1 - y2) + Y1 * (y2 - y0) + Y2 * (y0 - y1)) / den;
        var d = (Y0 * (x2 - x1) + Y1 * (x0 - x2) + Y2 * (x1 - x0)) / den;
        var f = (Y0 * (x1 * y2 - x2 * y1) + Y1 * (x2 * y0 - x0 * y2)
            + Y2 * (x0 * y1 - x1 * y0)) / den;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.lineTo(X2, Y2); ctx.closePath();
        ctx.clip();
        ctx.transform(a, b, c, d, e, f);
        ctx.drawImage(fuente, 0, 0);
        ctx.restore();
    }

    function dibujarPerspectiva(ctx, items, puntos, discrepancias, op, rot) {
        var marco = marcoItems(items, rot);
        var dimension = Math.max(marco.w, marco.h);
        var calidad = Math.min(2, 1200 / dimension);
        var ancho = Math.max(1, Math.ceil(marco.w * calidad));
        var alto = Math.max(1, Math.ceil(marco.h * calidad));
        var fuente = crearCanvas(ancho, alto);
        if (!fuente || !fuente.getContext) { return false; }
        var fctx = fuente.getContext('2d');
        if (!fctx) { return false; }
        var rad = marco.rot * Math.PI / 180;
        var cos = Math.cos(rad), sin = Math.sin(rad);
        fctx.setTransform(calidad * cos, -calidad * sin, calidad * sin, calidad * cos,
            -marco.x * calidad, -marco.y * calidad);
        items.forEach(function (item) { dibujarItem(fctx, item, op, discrepancias); });

        var destino = puntos.map(function (p) {
            return puntoMarco(marco, p.x, p.y);
        });
        var celdas = 32;
        for (var iy = 0; iy < celdas; iy++) {
            for (var ix = 0; ix < celdas; ix++) {
                var u0 = ix / celdas, u1 = (ix + 1) / celdas;
                var v0 = iy / celdas, v1 = (iy + 1) / celdas;
                var s00 = { x: u0 * ancho, y: v0 * alto };
                var s10 = { x: u1 * ancho, y: v0 * alto };
                var s11 = { x: u1 * ancho, y: v1 * alto };
                var s01 = { x: u0 * ancho, y: v1 * alto };
                var d00 = homografia(destino, u0, v0);
                var d10 = homografia(destino, u1, v0);
                var d11 = homografia(destino, u1, v1);
                var d01 = homografia(destino, u0, v1);
                dibujarTriangulo(ctx, fuente, [s00, s10, s11], [d00, d10, d11]);
                dibujarTriangulo(ctx, fuente, [s00, s11, s01], [d00, d11, d01]);
            }
        }
        return true;
    }

    /**
     * Compone las capas sobre el contexto en el espacio logico 300x300.
     *
     * opciones: { resolver(ref) -> {url, w, h} | Promise | null,
     *             contexto: {fotos, imagenes, grupos},
     *             limpiar: true (por defecto),
     *             huecosTransparentes: false (por defecto) — con true, una capa
     *               sin recurso NO dibuja la caja neutra (queda transparente).
     *               Es el modo de la VISTA DEL CLIENTE (tienda.js): nunca se le
     *               muestra el marco gris con el ref; el editor del admin lo
     *               conserva porque es su pista de diseno,
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
                    var env = null;
                    if (capa.tipo === 'placeholder' && capa.envoltura && op.contexto) {
                        env = envolturaDeRef(capa.ref, op.contexto.grupos);
                    }
                    compuestas.push({
                        indice: indice,
                        capa: capa,
                        caja: caja,
                        img: img,
                        recurso: recurso || null,
                        env: env
                    });
                });
            });
        });

        return Promise.all(trabajo).then(function () {
            // Orden estable: el array de entrada manda en el z-order.
            compuestas.sort(function (a, b) { return a.indice - b.indice; });
            var gruposPerspectiva = {};
            var procesadas = {};
            compuestas.forEach(function (item) {
                var gid = item.capa.grupo ? String(item.capa.grupo) : '';
                var puntos = puntosPerspectiva(item.capa.perspectiva);
                var clavePersp = gid ? 'g:' + gid : 'i:' + item.indice;
                if (puntos && perspectivaConvexa(puntos) && !esPerspectivaNeutra(puntos)) {
                    gruposPerspectiva[clavePersp] = gruposPerspectiva[clavePersp]
                        || { puntos: puntos, items: [], rot: numero(item.capa.grupo_rot) };
                    gruposPerspectiva[clavePersp].items.push(item);
                }
            });
            compuestas.forEach(function (item) {
                if (!ctx) { return; }
                if (procesadas[item.indice]) { return; }
                var gid = item.capa.grupo ? String(item.capa.grupo) : '';
                var grupoPerspectiva = gruposPerspectiva[gid ? 'g:' + gid : 'i:' + item.indice] || null;
                if (grupoPerspectiva && grupoPerspectiva.items.length >= 1
                    && dibujarPerspectiva(ctx, grupoPerspectiva.items,
                        grupoPerspectiva.puntos, discrepancias, op, grupoPerspectiva.rot)) {
                    grupoPerspectiva.items.forEach(function (miembro) {
                        procesadas[miembro.indice] = true;
                    });
                    return;
                }
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
                // Envoltura (PowerClip): el clip recorta la imagen Y la caja
                // neutra al contenedor vectorial del PDF. Sin envoltura
                // disponible no se recorta nada (degradacion silenciosa: el
                // editor ya informa la causa en el panel de propiedades).
                if (item.env) {
                    trazarEnvoltura(ctx, comandosEnvoltura(item.env, {
                        x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h
                    }));
                    ctx.clip(item.env.par ? 'evenodd' : 'nonzero');
                }
                if (item.img && item.img.img) {
                    var medidas = item.recurso && item.recurso.w && item.recurso.h
                        ? { w: item.recurso.w, h: item.recurso.h }
                        : { w: item.img.w, h: item.img.h };
                    var encaje = contener({ x: -caja.w / 2, y: -caja.h / 2, w: caja.w, h: caja.h }, medidas);
                    if (encaje.discrepancia) { discrepancias.push({ indice: item.indice, ref: c.ref }); }
                    ctx.drawImage(item.img.img, encaje.x, encaje.y, encaje.w, encaje.h);
                } else if (!op.huecosTransparentes) {
                    // Sin recurso: caja neutra de encuadre (nunca falla). En el
                    // modo cliente (huecosTransparentes) NO se dibuja nada: un
                    // hueco sin imagen queda transparente, nunca gris.
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
        homografia: homografia,
        perspectivaConvexa: perspectivaConvexa,
        filtroCss: filtroCss,
        esValida: esValida,
        urlDeImagen: urlDeImagen,
        imagen: imagen,
        limpiarCache: limpiarCache,
        cajaNeutra: cajaNeutra,
        envolturaDeRef: envolturaDeRef,
        comandosEnvoltura: comandosEnvoltura,
        trazarEnvoltura: trazarEnvoltura
    };
}));
