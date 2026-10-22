/**
 * biblioteca-pmu - Biblioteca de imagenes del comprador (spec 030, T011/T012).
 *
 * La vista la arma el SERVIDOR (`op=listar`) por IDENTIDAD (cookie `pmu_sid`, o
 * cuenta mas sus pedidos). Aca se guarda una copia de METADATOS en `localStorage`
 * (por cliente y en TODA la tienda: no se pierde al cerrar la pestaña), con TTL
 * corto porque las URLs llevan nonce de WP (D23), invalidada al subir o borrar y
 * revalidada por `revision` (si no cambio, no viaja la lista).
 *
 * Las fotos viajan con su `url` (`op=imagen`, protegido): la tira, el visor y el
 * recorte usan LA MISMA URL, asi que el navegador la sirve de su cache.
 *
 * API:
 *   PMUBiblioteca.pedir()         -> Promise<{revision, sin_cambios, fotos}>
 *   PMUBiblioteca.cache()         -> {revision, fotos, ts} | null
 *   PMUBiblioteca.tira(el, opts)  -> dibuja hasta 10 fotos
 *   PMUBiblioteca.visor(indice)   -> abre el visor compartido (accion Elegir)
 *   PMUBiblioteca.invalidar()     -> descarta la copia (subida o borrado)
 *
 * Sin dependencias salvo `PMUVisor` (assets/visor-pmu.js) y el endpoint del plugin.
 */
(function (global) {
    'use strict';

    var CLAVE = 'pmu_bib_v1';
    var TOPE_TIRA = 10;
    var TTL_MS = 20 * 60 * 1000; // 20 min: las URLs llevan nonce de WP (D23)
    var ESTILO_ID = 'pmu-bib-estilo';
    var cache = null;
    var cfg = null;
    var onElegir = null;

    function config() {
        if (cfg) { return cfg; }
        var t = global.PMU_TIENDA || {};
        var b = (global.PMU_FICHA && global.PMU_FICHA.biblioteca) || {};
        cfg = { url: b.endpoint || t.postUrl || '', nonce: b.nonce || t.nonceVistaPrevia || '' };
        return cfg;
    }

    function leerCache() {
        if (cache) { return cache; }
        try {
            var s = global.localStorage ? global.localStorage.getItem(CLAVE) : null;
            if (!s) { return null; }
            var v = JSON.parse(s);
            if (!v || !v.revision || !Array.isArray(v.fotos)) { return null; }
            if ((Date.now() - (v.ts || 0)) > TTL_MS) {
                global.localStorage.removeItem(CLAVE); // vencida: las URLs caducaron (D23)
                return null;
            }
            cache = v;
        } catch (e) { /* sin localStorage: solo memoria */ }
        return cache;
    }

    function guardarCache(dato) {
        cache = { revision: String(dato.revision || ''), fotos: (dato.fotos || []), ts: Date.now() };
        try {
            if (global.localStorage) { global.localStorage.setItem(CLAVE, JSON.stringify(cache)); }
        } catch (e) { /* cuota o modo privado: queda en memoria */ }
        return cache;
    }

    function invalidar() {
        cache = null;
        try {
            if (global.localStorage) { global.localStorage.removeItem(CLAVE); }
        } catch (e) { /* nada */ }
    }

    /** Pide la vista al servidor (con `desde` para no viajar si no cambio). */
    function pedir() {
        var c = config();
        if (!c.url) { return Promise.reject(new Error('api:biblioteca:sin:endpoint')); }
        var previa = leerCache();
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_biblioteca');
        fd.append('op', 'listar');
        fd.append('_wpnonce', c.nonce);
        if (previa && previa.revision) { fd.append('desde', previa.revision); }
        return global.fetch(c.url, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) {
                    throw new Error((json && json.data) || 'api:biblioteca:falla');
                }
                var d = json.data || {};
                if (d.sin_cambios && previa) {
                    return { revision: previa.revision, sin_cambios: true, fotos: previa.fotos };
                }
                var g = guardarCache(d);
                return { revision: g.revision, sin_cambios: false, fotos: g.fotos };
            });
    }
    function inyectarEstilos(doc) {
        if (doc.getElementById(ESTILO_ID)) { return; }
        var s = doc.createElement('style');
        s.id = ESTILO_ID;
        s.textContent =
            '.pmu-bib-tira{display:flex;gap:8px;overflow-x:auto;padding:6px 0;scroll-snap-type:x proximity}' +
            '.pmu-bib-mini{flex:0 0 auto;width:56px;height:56px;border:2px solid #dcdcde;border-radius:6px;scroll-snap-align:start;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/12px 12px;cursor:pointer;padding:0;overflow:hidden}' +
            '.pmu-bib-mini img{width:100%;height:100%;object-fit:cover;display:block}' +
            '.pmu-bib-mas{border-style:dashed;background:#f6f7f7;font-weight:600;font-size:15px;color:#3c434a;text-decoration:none}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    /** Abre el visor COMPARTIDO con la biblioteca (accion Elegir; Borrar llega con US4). */
    function visor(indice) {
        var c = leerCache();
        var fotos = (c && c.fotos) || [];
        if (!fotos.length || !global.PMUVisor) { return false; }
        return global.PMUVisor.abrir({
            items: fotos.map(function (f) { return { url: f.url, etiqueta: f.madre }; }),
            indice: indice,
            titulo: 'Mis imagenes',
            acciones: [{
                etiqueta: 'Elegir',
                clase: 'button-primary',
                onAccion: function (i) {
                    global.PMUVisor.cerrar();
                    if (typeof onElegir === 'function' && fotos[i]) { onElegir(fotos[i]); }
                }
            }]
        });
    }

    /** Dibuja la tira (hasta 10 fotos) en `el`; si no hay fotos NO dibuja nada (D23). */
    /** Pinta la tira en `el`: una miniatura por familia + el tile del resto (N+). */
    function pintarTira(el, fotos) {
        var doc = el.ownerDocument || global.document;
        el.innerHTML = '';
        if (!fotos || !fotos.length) { return 0; }
        inyectarEstilos(doc);
        var t = doc.createElement('div');
        t.className = 'pmu-bib-tira';
        fotos.slice(0, TOPE_TIRA).forEach(function (f) {
            var b = doc.createElement('button');
            b.type = 'button';
            b.className = 'pmu-bib-mini';
            b.setAttribute('data-madre', String(f.madre || ''));
            b.title = (f.versiones > 1) ? (f.versiones + ' versiones') : 'Imagen guardada';
            var img = doc.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            img.src = String(f.thumb || f.url || '' );
            b.appendChild(img);
            b.addEventListener('click', function () { if (onElegir) { onElegir(f); } });
            t.appendChild(b);
        });
        if (fotos.length > TOPE_TIRA) {
            var mas = doc.createElement('button');
            mas.type = 'button';
            mas.className = 'pmu-bib-mini pmu-bib-mas';
            mas.textContent = String(fotos.length) + '+';
            mas.addEventListener('click', function () { visor(TOPE_TIRA); });
            t.appendChild(mas);
        }
        el.appendChild(t);
        return fotos.length;
    }

    /**
     * Dibuja la tira (hasta 10 fotos) en `el`. Con copia local se pinta AL
     * INSTANTE y el servidor solo confirma (D23): abrir el modal no espera al POST.
     */
    function tira(el, opts) {
        opts = opts || {};
        if (typeof opts.onElegir === 'function') { onElegir = opts.onElegir; }
        if (!el) { return Promise.resolve(0); }
        var previa = leerCache();
        if (previa && previa.fotos.length) { pintarTira(el, previa.fotos); }
        return pedir().then(function (res) {
            var fotos = res.fotos || [];
            if (previa && previa.fotos.length && res.sin_cambios) { return fotos.length; }
            return pintarTira(el, fotos);
        }).catch(function () {
            return (previa && previa.fotos.length) ? previa.fotos.length : 0;
        });
    }

    var api = { pedir: pedir, cache: leerCache, invalidar: invalidar, tira: tira, visor: visor,
        tope: TOPE_TIRA, clave: CLAVE };
    global.PMUBiblioteca = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
