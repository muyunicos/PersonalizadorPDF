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
 *   PMUBiblioteca.tira(el, opts)  -> dibuja las que caben en el ancho (tope 10, sin scroll)
 *   PMUBiblioteca.visor(indice)   -> abre el visor (Elegir / Borrar); lo llama el tap de una miniatura
 *   PMUBiblioteca.invalidar()     -> descarta la copia (subida o borrado)
 *
 * Sin dependencias salvo `PMUVisor` (assets/visor-pmu.js) y el endpoint del plugin.
 */
(function (global) {
    'use strict';

    var CLAVE = 'pmu_bib_v2'; // v2 (2026-10-23): mata las copias viejas envenenadas (fotos: [] + revision vigente)
    var TOPE_TIRA = 10;
    var ANCHO_MINI = 64; // 56px del tile + 8px de separacion (CSS de la tira)
    var TTL_MS = 20 * 60 * 1000; // 20 min: las URLs llevan nonce de WP (D23)
    var ESTILO_ID = 'pmu-bib-estilo';
    var cache = null;
    var cfg = null;
    var ultimoEl = null; // contenedor vigente de la tira (para repintar tras borrar)
    var ultimas = [];    // ultima lista pintada: el visor muestra TODAS (no solo las visibles)
    var onElegir = null;
    // Spec 041 (F1): promesa EN VUELO compartida. `calentar()` y `tira()` (y el modal
    // abierto dos veces) lanzaban listados completos en paralelo: 3 POST identicos.
    var enVuelo = null;

    function config() {
        if (cfg && cfg.url) { return cfg; } // OJO: nunca cachear un endpoint vacio
        var t = global.PMU_TIENDA || {};
        var b = (global.PMU_FICHA && global.PMU_FICHA.biblioteca) || {};
        var s = (global.PMU_FICHA && global.PMU_FICHA.sesion) || {};
        cfg = { url: b.endpoint || t.postUrl || '', nonce: b.nonce || t.nonceVistaPrevia || '',
            item: s.item_key || '' };
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
    function pedir(sinDesde) {
        var c = config();
        if (!c.url) { return Promise.reject(new Error('api:biblioteca:sin:endpoint')); }
        // Spec 041 (F1): una sola peticion en vuelo (ver `enVuelo`).
        if (enVuelo && !sinDesde) { return enVuelo; }
        var previa = leerCache();
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_biblioteca');
        fd.append('op', 'listar');
        fd.append('_wpnonce', c.nonce);
        if (sinDesde) { previa = null; } // reintento del auto-sanado: se pide la lista COMPLETA
        if (previa && previa.revision) { fd.append('desde', previa.revision); }
        var p = global.fetch(c.url, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) {
                    throw new Error((json && json.data) || 'api:biblioteca:falla');
                }
                var d = json.data || {};
                if (d.sin_cambios && previa) {
                    // D23 (2026-10-23): copia con `fotos: []` + "sin cambios" = copia envenenada (una
                    // revision que no se movio tras un bug de deploy). Se re-pregunta UNA vez
                    // SIN `desde` para que la tira nunca quede vacia por una copia mala.
                    if ((!previa.fotos || !previa.fotos.length) && !sinDesde) { return pedir(true); }
                    return { revision: previa.revision, sin_cambios: true, fotos: previa.fotos };
                }
                var g = guardarCache(d);
                return { revision: g.revision, sin_cambios: false, fotos: g.fotos };
            });
        if (!sinDesde) {
            enVuelo = p;
            p.then(function () { enVuelo = null; }, function () { enVuelo = null; });
        }
        return p;
    }
    function inyectarEstilos(doc) {
        if (doc.getElementById(ESTILO_ID)) { return; }
        var s = doc.createElement('style');
        s.id = ESTILO_ID;
        s.textContent =
            '.pmu-bib-tira{display:flex;gap:8px;overflow:hidden;padding:6px 0}' +
            '.pmu-bib-mini{box-sizing:border-box;flex:0 0 auto;width:56px;height:56px;border:2px solid #dcdcde;border-radius:6px;scroll-snap-align:start;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/12px 12px;cursor:pointer;padding:0;overflow:hidden}' +
            '.pmu-bib-mini img{width:100%;height:100%;object-fit:cover;display:block}' +
            '.pmu-bib-mas{border-style:dashed;background:#f6f7f7;font-weight:600;font-size:15px;color:#3c434a;text-decoration:none}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    /**
     * Spec 039 (D4): la biblioteca no tiene visor propio. Se conserva el nombre
     * `visor` por compatibilidad, pero ahora **elige y carga directo** en el modal de
     * recorte (igual que `elegir`). Borrar se hace desde el visor del CAMPO (D1/D3).
     */
    function visor(indice) {
        return elegir(indice);
    }

    /** Dibuja la tira (hasta 10 fotos) en `el`; si no hay fotos NO dibuja nada (D23). */
    /** Pinta la tira en `el`: una miniatura por IMAGEN (sin versiones) + el tile `N+`.
    /**
     * Spec 039 (D4): `visor()` se retiro. La biblioteca no tiene visor propio: tocar
     * una miniatura ELIGE la imagen y la carga directo en el modal de recorte (via
     * `onElegir`). Borrar se hace desde el visor del CAMPO (D1/D3 de la 039).
     *
     * Se conserva el nombre `visor` (compatibilidad) apuntando a `elegir`.
     */
    function elegir(indice) {
        var fotos = ultimas || [];
        var f = fotos[parseInt(indice, 10) || 0];
        if (!f) { return false; }
        if (typeof onElegir === 'function') { onElegir(f); }
        return true;
    }

    function visor(indice) { return elegir(indice); }

    /**
     * Spec 039 (D3): `pedirOp()` se retiro con el borrado desde la biblioteca. Borrar
     * se hace desde el visor del CAMPO (`op=borrar`), no desde la tira.
     */
    /** Cuantas miniaturas entran en `el` sin scroll (tile 56px + 8px de gap). */
    function caben(el) {
        var ancho = 0;
        try {
            ancho = el.clientWidth || (el.getBoundingClientRect ? el.getBoundingClientRect().width : 0) || 0;
        } catch (e) { ancho = 0; }
        if (!ancho) { return TOPE_TIRA; }
        return Math.max(1, Math.min(TOPE_TIRA, Math.floor(ancho / ANCHO_MINI)));
    }

    /**
     * Delega la tira en el MOTOR DEL TEMA (`MU.coleccion`, spec 019, ambito 1) cuando
     * esta presente. D11/D26: la dependencia es **blanda** — el plugin se instala y
     * funciona solo, asi que sin `MU.coleccion` se usa la tira propia de abajo, sin
     * cambios. La vista queda FIJA con el tile `N+` abriendo el visor (igual que hoy):
     * `navegable:false` es exactamente esa politica.
     *
     * @param {Element} el contenedor de la tira
     * @param {Array} fotos imagenes de la biblioteca (id/url/thumb/recetas)
     * @returns {boolean} true si el TEMA la pinto
     */
    function delegarTira(el, fotos) {
        var tema = global.MU;
        if (!tema || typeof tema.coleccion !== 'function') { return false; }
        tema.coleccion(el, {
            items: (fotos || []).map(function (f) {
                var urlResuelta = (global.PMU_FICHA && global.PMU_FICHA.urls && f.base)
                    ? global.PMU_FICHA.urls[String(f.base)] : '';
                var url = String(urlResuelta || f.thumb || f.url || '');
                return {
                    url: url,
                    thumb: url,
                    // Spec 039 (D4): una entrada por imagen, sin badge `N versiones`.
                    etiqueta: ''
                };
            }),
            layout: 'linea',
            preset: 'mini',
            tamano: 'chico',
            navegable: false,
            tope: TOPE_TIRA,
            chipAccion: 'abrir',
            onChip: function (cuantos, desde) { elegir(desde || 0); },
            onAbrir: function (i) { elegir(i); }
        });
        return true;
    }

    /**
     * Pinta la tira en `el`: las miniaturas que CABEN en el ancho + el tile `N+`.
     * El tap de cada una abre el visor (Elegir / Borrar); sin fotos no dibuja.
     */
    function pintarTira(el, fotos) {
        ultimoEl = el;
        ultimas = fotos || [];
        var doc = el.ownerDocument || global.document;
        el.innerHTML = '';
        if (!fotos || !fotos.length) { return 0; }
        // El MOTOR vive en el tema: si esta, la tira es SUYA (D26/D11). Si no, sigue
        // la tira propia de abajo, sin cambios.
        if (delegarTira(el, fotos)) { return fotos.length; }
        inyectarEstilos(doc);
        // Cuantas entran en el ANCHO disponible (la tira NO scrollea): con mas
        // fotos que lugar se reserva un tile para el resto (`N+`). Tope: 10.
        var cabe = caben(el);
        var visibles = (fotos.length > cabe) ? Math.max(1, cabe - 1) : Math.min(fotos.length, cabe);
        var t = doc.createElement('div');
        t.className = 'pmu-bib-tira';
        fotos.slice(0, visibles).forEach(function (f, i) {
            var b = doc.createElement('button');
            b.type = 'button';
            b.className = 'pmu-bib-mini';
            b.setAttribute('data-id', String(f.id || ''));
            b.title = 'Elegir esta imagen';
            var img = doc.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            var urlResuelta = (global.PMU_FICHA && global.PMU_FICHA.urls && f.base)
                ? global.PMU_FICHA.urls[String(f.base)] : '';
            img.src = String(urlResuelta || f.thumb || f.url || '' );
            b.appendChild(img);
            b.addEventListener('click', function () { elegir(i); });
            t.appendChild(b);
        });
        if (fotos.length > visibles) {
            var mas = doc.createElement('button');
            mas.type = 'button';
            mas.className = 'pmu-bib-mini pmu-bib-mas';
            mas.textContent = String(fotos.length) + '+';
            mas.title = 'Ver todas tus imagenes';
            mas.addEventListener('click', function () { elegir(visibles); });
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

    // El ancho decide cuantas miniaturas entran: al cambiar el tamaño se repinta
    // (sin volver a pedir nada) para que la tira siga sin scroll.
    // Spec 036 (T008/D7): la biblioteca NO se pide al cargar la ficha (0 red). Antes, el
    // `load` disparaba `op=listar` y bajaba las fotos del comprador sin que nadie las
    // mirara. Ahora se traen cuando el comprador INTERACTUA con el panel de
    // personalizacion (en la practica, al abrir el modal de carga). Se conserva la
    // decision SINCRONICA del modal (spec 030, 4a: "auto-abre el selector solo con la
    // biblioteca vacia"): el primer gesto dentro de `[data-pmu-panel]` calienta la copia
    // UNA vez, antes del click que abre el modal.
    (function () {
        var doc = global.document;
        if (!doc || !doc.addEventListener) { calentar(); return; }
        var hecho = false;
        var una = function () { if (!hecho) { hecho = true; calentar(); } };
        ['pointerdown', 'focusin', 'touchstart'].forEach(function (ev) {
            doc.addEventListener(ev, function (e) {
                var t = e && e.target;
                if (t && typeof t.closest === 'function' && t.closest('[data-pmu-panel]')) { una(); }
            }, true);
        });
    }());
    /** Spec 030 (4a): el calentado corre con la pagina cargada (los globals ya estan). */
    function calentar() {
        // Spec 041 (F1): con copia fresca no se pide nada (el primer gesto en el panel
        // disparaba un listado completo aunque la copia tuviera segundos de vida).
        var fresca = leerCache();
        if (fresca && fresca.revision && (Date.now() - (fresca.ts || 0)) < 30000) { return; }
        if (config().url && typeof global.fetch === 'function') {
        pedir().catch(function () { /* sin identidad o sin red: no pasa nada */ });
        }
    }

    if (global.addEventListener) {
        var anchoPrevio = 0;
        global.addEventListener('resize', function () {
            if (!ultimoEl || !ultimas.length) { return; }
            var ancho = ultimoEl.clientWidth || 0;
            if (Math.abs(ancho - anchoPrevio) < ANCHO_MINI) { return; }
            anchoPrevio = ancho;
            pintarTira(ultimoEl, ultimas);
        });
    }

    /**
     * Spec 039 (D6): `usar()` se retiro con la rama de reuso `Elegir` (0 bytes).
     * Ahora SIEMPRE se sube el original y el servidor deduplica por `sha` (D24).
     */
    var api = { pedir: pedir, cache: leerCache, invalidar: invalidar, tira: tira,
        visor: visor, elegir: elegir, tope: TOPE_TIRA, clave: CLAVE };
    global.PMUBiblioteca = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
