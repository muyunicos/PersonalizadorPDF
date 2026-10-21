/**
 * visor-pmu - visor fullscreen COMPARTIDO (spec 030, D28).
 *
 * Nace de extraer el visor de `cargador-pmu.js` (`_abrirVisor`) para que lo usen
 * la ranura del campo (`cpmu-tiras` -> tocar una `cpmu-mini`) y la biblioteca
 * (boton "Elegir ya subida" del modal de recorte): es UN solo componente y las
 * acciones las declara cada contexto.
 *
 * Clave de la mejora (D23): los `items` llegan con la `url` YA RESUELTA (mapa
 * `id -> url` de la pagina). Como la miniatura y la vista grande usan la MISMA
 * URL, el navegador la sirve de su cache: navegar no hace ninguna peticion.
 * Antes cada paso pedia la URL por POST (`urlDeSubida`) y tardaba segundos.
 *
 * API:
 *   PMUVisor.abrir({
 *     items: [{ url, etiqueta }],      // url ya resuelta
 *     indice: 0,
 *     acciones: [{ etiqueta, clase, onAccion(indice) }],
 *     segmentos: [{ etiqueta, activo, onElegir() }],  // opcional
 *     titulo: "En este campo",
 *     tecnico: false
 *   });
 *   PMUVisor.cerrar();
 *   PMUVisor.estaAbierto();
 *   PMUVisor.puro.preCargar(items, indice, cuantos)  // vecinos a precargar
 *
 * Sin dependencias (JS puro). Exporta tambien en Node para las pruebas.
 */
(function (global) {
    'use strict';

    var ESTILO_ID = 'pmu-visor-estilo';
    var VECINOS = 1;

    /** Vecinos a precargar (puro): los `cuantos` de cada lado, sin salirse. */
    function preCargar(items, indice, cuantos) {
        var out = [];
        var n = (items || []).length;
        var k = Math.max(0, parseInt(cuantos, 10) || 0);
        for (var d = 1; d <= k; d++) {
            if (indice - d >= 0) { out.push(indice - d); }
            if (indice + d < n) { out.push(indice + d); }
        }
        return out;
    }

    /** Posicion valida dentro de la lista (puro). */
    function acotar(indice, total) {
        var i = parseInt(indice, 10) || 0;
        if (i < 0) { i = 0; }
        if (total > 0 && i > total - 1) { i = total - 1; }
        return i;
    }

    function inyectarEstilos(doc) {
        if (doc.getElementById(ESTILO_ID)) { return; }
        var s = doc.createElement('style');
        s.id = ESTILO_ID;
        s.textContent =
            '.pmu-visor{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:180000;display:flex;flex-direction:column;justify-content:space-between;color:#fff;padding:calc(12px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box}' +
            '.pmu-visor-top{display:flex;align-items:center;justify-content:space-between;gap:12px}' +
            '.pmu-visor-titulo{font-size:14px;font-weight:600;opacity:.9}' +
            '.pmu-visor-contador{font-size:13px;opacity:.75}' +
            '.pmu-visor-cerrar{border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer}' +
            '.pmu-visor-segs{display:flex;gap:8px;justify-content:center;margin:8px 0}' +
            '.pmu-visor-seg{border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:999px;padding:4px 14px;font-size:13px;cursor:pointer}' +
            '.pmu-visor-seg[aria-pressed="true"]{background:#fff;color:#111;font-weight:600}' +
            '.pmu-visor-cuerpo{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0;gap:12px;margin:10px 0}' +
            '.pmu-visor-img{max-width:min(86vw,900px);max-height:70vh;object-fit:contain;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.6);background:repeating-conic-gradient(#333 0 25%,#444 0 50%) 0/20px 20px}' +
            '.pmu-visor-nav{border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:50%;width:44px;height:44px;font-size:24px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
            '.pmu-visor-nav[hidden]{display:none !important}' +
            '.pmu-visor-acciones{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}' +
            '.pmu-visor-acciones .button{min-height:42px;padding:6px 18px;font-size:14px}' +
            '.pmu-visor-peligro{background:#d63638 !important;border-color:#d63638 !important;color:#fff !important}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    var visor = null;
    var onKey = null;
    var estilo = null;

    /** Cierra el visor (idempotente). */
    function cerrar() {
        var doc = estilo || global.document;
        if (onKey && doc) { doc.removeEventListener('keydown', onKey); }
        onKey = null;
        if (visor && visor.parentNode) { visor.parentNode.removeChild(visor); }
        visor = null;
    }

    function estaAbierto() {
        return visor !== null;
    }

    /**
     * Abre el visor. `items` ya traen la `url` resuelta (D23): navegar no pide
     * nada. Las `acciones` las declara quien abre (Reemplazar/Eliminar en la
     * ranura; Elegir/Borrar en la biblioteca).
     */
    function abrir(opts) {
        opts = opts || {};
        var items = (opts.items || []).filter(function (it) { return it && it.url; });
        if (!items.length) { return false; }
        var doc = (opts.documento) || global.document;
        if (!doc || !doc.body) { return false; }
        cerrar();
        inyectarEstilos(doc);
        estilo = doc;
        var pos = acotar(opts.indice, items.length);
        var acciones = opts.acciones || [];

        var modal = doc.createElement('div');
        modal.className = 'pmu-visor';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        var top = doc.createElement('div');
        top.className = 'pmu-visor-top';
        var izq = doc.createElement('div');
        if (opts.titulo) {
            var tit = doc.createElement('div');
            tit.className = 'pmu-visor-titulo';
            tit.textContent = String(opts.titulo);
            izq.appendChild(tit);
        }
        var cont = doc.createElement('div');
        cont.className = 'pmu-visor-contador';
        izq.appendChild(cont);
        top.appendChild(izq);
        var btnCerrar = doc.createElement('button');
        btnCerrar.type = 'button';
        btnCerrar.className = 'pmu-visor-cerrar';
        btnCerrar.textContent = "\u00d7";
        btnCerrar.setAttribute('aria-label', 'Cerrar');
        top.appendChild(btnCerrar);
        modal.appendChild(top);

        var segs = null;
        if ((opts.segmentos || []).length) {
            segs = doc.createElement('div');
            segs.className = 'pmu-visor-segs';
            (opts.segmentos || []).forEach(function (sg) {
                var b = doc.createElement('button');
                b.type = 'button';
                b.className = 'pmu-visor-seg';
                b.textContent = String(sg.etiqueta || '');
                b.setAttribute('aria-pressed', sg.activo ? 'true' : 'false');
                b.addEventListener('click', function () { if (typeof sg.onElegir === 'function') { sg.onElegir(); } });
                segs.appendChild(b);
            });
            modal.appendChild(segs);
        }

        var cuerpo = doc.createElement('div');
        cuerpo.className = 'pmu-visor-cuerpo';
        var btnPrev = doc.createElement('button');
        btnPrev.type = 'button';
        btnPrev.className = 'pmu-visor-nav pmu-visor-prev';
        btnPrev.textContent = '\u2039';
        btnPrev.setAttribute('aria-label', 'Anterior');
        var img = doc.createElement('img');
        img.className = 'pmu-visor-img';
        img.alt = '';
        img.decoding = 'async';
        var btnNext = doc.createElement('button');
        btnNext.type = 'button';
        btnNext.className = 'pmu-visor-nav pmu-visor-next';
        btnNext.textContent = '\u203a';
        btnNext.setAttribute('aria-label', 'Siguiente');
        cuerpo.appendChild(btnPrev);
        cuerpo.appendChild(img);
        cuerpo.appendChild(btnNext);
        modal.appendChild(cuerpo);

        var pie = doc.createElement('div');
        pie.className = 'pmu-visor-acciones';
        (acciones || []).forEach(function (ac) {
            var b = doc.createElement('button');
            b.type = 'button';
            b.className = 'button ' + String(ac.clase || '');
            b.textContent = String(ac.etiqueta || '');
            b.addEventListener('click', function () {
                if (typeof ac.onAccion === 'function') { ac.onAccion(pos); }
            });
            pie.appendChild(b);
        });
        modal.appendChild(pie);
        doc.body.appendChild(modal);
        visor = modal;

        function pintar() {
            var n = items.length;
            cont.textContent = (pos + 1) + ' / ' + n;
            var it = items[pos];
            if (img.getAttribute('src') !== it.url) { img.src = it.url; }
            btnPrev.hidden = n <= 1;
            btnNext.hidden = n <= 1;
            // Precarga de vecinos: sin peticiones extra, ya estan en la cache.
            if (typeof global.Image === 'function') {
                preCargar(items, pos, VECINOS).forEach(function (i) {
                    var im = new global.Image();
                    im.src = items[i].url;
                });
            }
        }

        function ir(delta) {
            var n = items.length;
            if (n <= 1) { return; }
            pos = (pos + delta + n) % n;
            pintar();
        }

        btnPrev.addEventListener('click', function () { ir(-1); });
        btnNext.addEventListener('click', function () { ir(1); });
        btnCerrar.addEventListener('click', cerrar);
        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target === cuerpo) { cerrar(); }
        });
        var touchX = null;
        modal.addEventListener('touchstart', function (e) {
            if (e.touches && e.touches.length === 1) { touchX = e.touches[0].clientX; }
        }, { passive: true });
        modal.addEventListener('touchend', function (e) {
            if (touchX === null || !e.changedTouches || !e.changedTouches.length) { return; }
            var dx = e.changedTouches[0].clientX - touchX;
            touchX = null;
            if (Math.abs(dx) > 40) { ir(dx < 0 ? 1 : -1); }
        }, { passive: true });
        onKey = function (e) {
            if (e.key === 'Escape') { cerrar(); }
            else if (e.key === 'ArrowLeft') { ir(-1); }
            else if (e.key === 'ArrowRight') { ir(1); }
        };
        doc.addEventListener('keydown', onKey);
        pintar();
        return true;
    }

    var api = { abrir: abrir, cerrar: cerrar, estaAbierto: estaAbierto,
        puro: { preCargar: preCargar, acotar: acotar } };
    global.PMUVisor = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
