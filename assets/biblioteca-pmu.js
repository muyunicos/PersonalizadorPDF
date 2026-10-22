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

    var CLAVE = 'pmu_bib_v1';
    var TOPE_TIRA = 10;
    var ANCHO_MINI = 64; // 56px del tile + 8px de separacion (CSS de la tira)
    var TTL_MS = 20 * 60 * 1000; // 20 min: las URLs llevan nonce de WP (D23)
    var ESTILO_ID = 'pmu-bib-estilo';
    var cache = null;
    var cfg = null;
    var ultimoEl = null; // contenedor vigente de la tira (para repintar tras borrar)
    var ultimas = [];    // ultima lista pintada: el visor muestra TODAS (no solo las visibles)
    var onElegir = null;

    function config() {
        if (cfg) { return cfg; }
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
            '.pmu-bib-tira{display:flex;gap:8px;overflow:hidden;padding:6px 0}' +
            '.pmu-bib-mini{box-sizing:border-box;flex:0 0 auto;width:56px;height:56px;border:2px solid #dcdcde;border-radius:6px;scroll-snap-align:start;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/12px 12px;cursor:pointer;padding:0;overflow:hidden}' +
            '.pmu-bib-mini img{width:100%;height:100%;object-fit:cover;display:block}' +
            '.pmu-bib-mas{border-style:dashed;background:#f6f7f7;font-weight:600;font-size:15px;color:#3c434a;text-decoration:none}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    /** Abre el visor COMPARTIDO con la biblioteca (accion Elegir; Borrar llega con US4). */
    function visor(indice) {
        var c = leerCache();
        // La lista pintada manda (el servidor acaba de confirmarla); la copia es el respaldo.
        var fotos = ultimas.length ? ultimas : ((c && c.fotos) || []);
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
            }, {
                etiqueta: 'Borrar',
                clase: 'pmu-visor-peligro',
                onAccion: function (i) {
                    var foto = fotos[i];
                    if (!foto) { return; }
                    pedirOp('usos', String(foto.madre)).then(function (uso) {
                        var aviso = 'Borrar esta imagen?', detalle = [];
                        if (uso && (uso.carrito || []).length) { detalle.push('esta en tu carrito'); }
                        if (uso && (uso.pedidos || []).length) { detalle.push('corresponde a la compra #' + uso.pedidos.join(', #')); }
                        if (detalle.length) { aviso += ' Ojo: ' + detalle.join(' y ') + '.'; }
                        if (!global.confirm(aviso + ' Se elimina la original y sus versiones.')) { return; }
                        pedirOp('borrar', String(foto.madre)).then(function () {
                            global.PMUVisor.cerrar();
                            invalidar();
                            invalidar();
                            return pedir();
                        }).then(function (res) {
                            var restantes = (res && res.fotos) || [];
                            if (ultimoEl) { pintarTira(ultimoEl, restantes); }
                            if (global.PMUVisor) { global.PMUVisor.cerrar(); }
                            if (restantes.length) { visor(Math.min(i, restantes.length - 1)); }
                        }).catch(function () { });
                    }).catch(function () { });
                }
            }]
        });
    }

    /** Dibuja la tira (hasta 10 fotos) en `el`; si no hay fotos NO dibuja nada (D23). */
    /** Pinta la tira en `el`: una miniatura por familia + el tile del resto (N+). */
    /** POST simple al endpoint (op con `madre`): usos y borrar. */
    function pedirOp(op, madre) {
        var c = config();
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_biblioteca');
        fd.append('op', op);
        fd.append('madre', String(madre || ''));
        // D17: el item que el comprador esta editando AHORA no cuenta como "esta en
        // tu carrito" (el servidor lo saca de `usos.carrito`).
        fd.append('item_key', String(c.item || ''));
        fd.append('_wpnonce', c.nonce);
        return global.fetch(c.url, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) {
                    throw new Error((json && json.data) || 'api:biblioteca:falla');
                }
                return json.data || {};
            });
    }
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
     * Pinta la tira en `el`: las miniaturas que CABEN en el ancho + el tile `N+`.
     * El tap de cada una abre el visor (Elegir / Borrar); sin fotos no dibuja.
     */
    function pintarTira(el, fotos) {
        ultimoEl = el;
        ultimas = fotos || [];
        var doc = el.ownerDocument || global.document;
        el.innerHTML = '';
        if (!fotos || !fotos.length) { return 0; }
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
            b.setAttribute('data-madre', String(f.madre || ''));
            b.title = (f.versiones > 1) ? (f.versiones + ' versiones') : 'Imagen guardada';
            var img = doc.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            img.src = String(f.thumb || f.url || '' );
            b.appendChild(img);
            b.addEventListener('click', function () { visor(i); });
            t.appendChild(b);
        });
        if (fotos.length > visibles) {
            var mas = doc.createElement('button');
            mas.type = 'button';
            mas.className = 'pmu-bib-mini pmu-bib-mas';
            mas.textContent = String(fotos.length) + '+';
            mas.title = 'Ver todas tus imagenes';
            mas.addEventListener('click', function () { visor(visibles); });
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
    // Spec 030 (T015 / 4a clarificacion): el modal decide en SINCRONICO si auto-abre el
    // selector (solo con la biblioteca vacia), asi que la copia de la tira se calienta al
    // cargar la ficha. Es UNA por pagina: `desde=<revision>` hace gratis las siguientes.
    if (config().url && typeof global.fetch === 'function') {
        pedir().catch(function () { /* sin identidad o sin red: no pasa nada */ });
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
     * Elegir una foto de la biblioteca SIN recomponer (D8/D14): POST `op=usar` con la
     * `madre` y los datos del hueco. El servidor **re-decide** con su receta: igual ->
     * fila `origen: ref` (0 bytes); distinta -> version `{madre}-{n}`. Invalida la copia
     * local: la vista cambio.
     */
    function usar(madre, datos) {
        var c = config();
        if (!c.url) { return Promise.reject(new Error('api:biblioteca:sin:endpoint')); }
        datos = datos || {};
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_biblioteca');
        fd.append('op', 'usar');
        fd.append('madre', String(madre || ''));
        fd.append('item_key', String(datos.item_key || c.item || ''));
        fd.append('pdf', String(datos.pdf || ''));
        fd.append('grupo', String(datos.grupo || ''));
        fd.append('indice', String(datos.indice || 0));
        fd.append('params', JSON.stringify(datos.params || {}));
        fd.append('_wpnonce', c.nonce);
        return global.fetch(c.url, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) { throw new Error((json && json.data) || 'api:biblioteca:falla'); }
                invalidar();
                return json.data || {};
            });
    }

    var api = { pedir: pedir, cache: leerCache, invalidar: invalidar, tira: tira, visor: visor, usar: usar,
        tope: TOPE_TIRA, clave: CLAVE };
    global.PMUBiblioteca = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
