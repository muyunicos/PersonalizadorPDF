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

    var CLAVE = 'pmu_bib_v3'; // v3 (spec 042): identidad + revision + miniaturas embebidas
    var TOPE_TIRA = 10;
    var ANCHO_MINI = 64; // 56px del tile + 8px de separacion (CSS de la tira)
    var TTL_MS = 20 * 60 * 1000; // 20 min: la copia no es codigo
    var FRESCURA_MS = 5 * 60 * 1000; // spec 042: 0 solicitudes dentro de la ventana
    var ESTILO_ID = 'pmu-bib-estilo';
    var cache = null;
    var cfg = null;
    var ultimoEl = null; // contenedor vigente de la tira (para repintar tras borrar)
    var ultimas = [];    // ultima lista pintada: el visor muestra TODAS (no solo las visibles)
    var onElegir = null;
    // Spec 040 (F1): promesa EN VUELO compartida. `calentar()` y `tira()` (y el modal
    // abierto dos veces) lanzaban listados completos en paralelo: 3 POST identicos.
    var enVuelo = null;
    var modo = 'auto'; // 'auto' = camino liviano; 'wp' = respaldo actual

    function config() {
        if (cfg && cfg.url) { return cfg; } // OJO: nunca cachear un endpoint vacio
        var t = global.PMU_TIENDA || {};
        var b = (global.PMU_FICHA && global.PMU_FICHA.biblioteca) || {};
        var s = (global.PMU_FICHA && global.PMU_FICHA.sesion) || {};
        cfg = {
            url: b.endpoint || t.postUrl || '',
            nonce: b.nonce || t.nonceVistaPrevia || '',
            item: s.item_key || '',
            // Spec 042: camino liviano + metadatos de la ficha.
            rapido: b.rapido || '',
            revision: String(b.revision || ''),
            identidad: String(b.identidad || '')
        };
        return cfg;
    }

    function leerCache() {
        if (cache) { return cache; }
        try {
            var s = global.localStorage ? global.localStorage.getItem(CLAVE) : null;
            if (!s) { return null; }
            var v = JSON.parse(s);
            if (!v || !v.revision || !Array.isArray(v.fotos)) { return null; }
            // Spec 042: la copia pertenece a una identidad. Si la ficha cambio
            // (login/logout, otra cuenta, pagina cacheada) no se pinta.
            var esperada = String(config().identidad || '');
            if (esperada === '' || String(v.identidad || '') !== esperada) {
                global.localStorage.removeItem(CLAVE);
                return null;
            }
            if ((Date.now() - (v.ts || 0)) > TTL_MS) {
                global.localStorage.removeItem(CLAVE); // vencida: las URLs caducaron (D23)
                return null;
            }
            cache = v;
        } catch (e) { /* sin localStorage: solo memoria */ }
        return cache;
    }

    function guardarCache(dato) {
        cache = {
            revision: String(dato.revision || ''),
            identidad: String(dato.identidad || config().identidad || ''),
            fotos: (dato.fotos || []),
            ts: Date.now()
        };
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
        if (!c.url && !c.rapido) { return Promise.reject(new Error('api:biblioteca:sin:endpoint')); }
        // Spec 040 (F1): una sola peticion en vuelo (ver `enVuelo`).
        if (enVuelo && !sinDesde) { return enVuelo; }
        var p = (c.rapido && modo !== 'wp') ? pedirRapido(sinDesde) : pedirWp(sinDesde);
        if (!sinDesde) {
            enVuelo = p;
            var clear = function () { if (enVuelo === p) { enVuelo = null; } };
            p.then(clear, clear);
        }
        return p;
    }

    /** Camino liviano (sin WordPress): GET `media.php?op=listar`. */
    function pedirRapido(sinDesde) {
        var c = config();
        var previa = leerCache();
        var url = c.rapido + '?op=listar';
        if (!sinDesde && previa && previa.revision) {
            url += '&desde=' + encodeURIComponent(previa.revision);
        }
        return global.fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success || !json.data) {
                    modo = 'wp';
                    return pedirWp(sinDesde);
                }
                var d = json.data || {};
                if (d.fallback) { modo = 'wp'; return pedirWp(sinDesde); }
                // Spec 042: la identidad del servidor manda. Si la ficha (o una
                // pagina cacheada) dice otra cosa, se usa el respaldo.
                if (c.identidad && d.identidad && String(d.identidad) !== String(c.identidad)) {
                    modo = 'wp';
                    return pedirWp(sinDesde);
                }
                if (!c.identidad && d.identidad) { c.identidad = String(d.identidad); }
                if (d.sin_cambios && previa) {
                    if ((!previa.fotos || !previa.fotos.length) && !sinDesde) { return pedirWp(true); }
                    return { revision: previa.revision, sin_cambios: true, fotos: previa.fotos };
                }
                var g = guardarCache(d);
                return { revision: g.revision, sin_cambios: false, fotos: g.fotos };
            })
            .catch(function () {
                modo = 'wp';
                return pedirWp(sinDesde);
            });
    }

    /** Respaldo actual: POST admin-post con nonce (y `desde`). */
    function pedirWp(sinDesde) {
        var c = config();
        if (!c.url) { return Promise.reject(new Error('api:biblioteca:sin:endpoint')); }
        var previa = leerCache();
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_biblioteca');
        fd.append('op', 'listar');
        fd.append('_wpnonce', c.nonce);
        if (sinDesde) { previa = null; } // reintento del auto-sanado: lista COMPLETA
        if (previa && previa.revision) { fd.append('desde', previa.revision); }
        return global.fetch(c.url, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) {
                    throw new Error((json && json.data) || 'api:biblioteca:falla');
                }
                var d = json.data || {};
                if (d.sin_cambios && previa) {
                    if ((!previa.fotos || !previa.fotos.length) && !sinDesde) { return pedirWp(true); }
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

    /** Dibuja la tira (hasta 10 fotos) en `el`; si no hay fotos NO dibuja nada (D23). */
    /** Pinta la tira en `el`: una miniatura por IMAGEN (sin versiones) + el tile `N+`.
    /**
     * Tocar una miniatura ELIGE la imagen y la carga directo en el modal de recorte
     * (via `onElegir`). El visor completo (spec 043 US4) se abre con "Ver todas (N)".
     */
    function elegir(indice) {
        var fotos = ultimas || [];
        var f = fotos[parseInt(indice, 10) || 0];
        if (!f) { return false; }
        if (typeof onElegir === 'function') { onElegir(f); }
        return true;
    }

    /**
     * Spec 043 (US4/T030): visor de la biblioteca con TODAS las fotos.
     * Elegir = carga en el editor; Eliminar = borra de la biblioteca (dos pasos, D5).
     */
    function verTodas(indice) {
        var fotos = ultimas || [];
        if (!fotos.length || !global.PMUVisor || typeof global.PMUVisor.abrir !== 'function') {
            return false;
        }
        var items = fotos.map(function (f) {
            return { url: String(f.thumb_data || f.thumb || f.url || ''), etiqueta: String(f.id || '') };
        });
        var pos = Math.max(0, Math.min(items.length - 1, parseInt(indice, 10) || 0));
        global.PMUVisor.abrir({
            items: items,
            indice: pos,
            titulo: 'Mi biblioteca',
            acciones: [
                { etiqueta: 'Elegir', clase: 'button-primary',
                    onAccion: function (p) { global.PMUVisor.cerrar(); elegir(p); } },
                { etiqueta: 'Eliminar', clase: 'pmu-visor-peligro',
                    onAccion: function (p) { return borrar(fotos[p]); } }
            ]
        });
        return true;
    }

    /** Spec 043 (US4/T031/D5): borra una foto de la biblioteca en dos pasos. */
    function borrar(foto) {
        var id = String((foto && foto.id) || '');
        if (id === '' || !global.PMU_API || typeof global.PMU_API.borrarFoto !== 'function') {
            return Promise.resolve(false);
        }
        var baja = function (confirmar) {
            return Promise.resolve(global.PMU_API.borrarFoto(id, confirmar));
        };
        var fuera = function () {
            ultimas = (ultimas || []).filter(function (x) { return String(x.id) !== id; });
            if (ultimoEl) { pintarTira(ultimoEl, ultimas); }
            if (global.PMUVisor && typeof global.PMUVisor.cerrar === 'function') { global.PMUVisor.cerrar(); }
            return true;
        };
        return baja(false).then(fuera, function (err) {
            if (!err || !err.referencias || !global.PMUVisor
                || typeof global.PMUVisor.confirmar !== 'function') { return false; }
            return global.PMUVisor.confirmar({
                titulo: 'Esta imagen esta en uso',
                detalle: 'Se usa en un carrito o pedido. Si la borras, ese pedido deja de poder regenerarse.',
                textoOk: 'Borrar igual'
            }).then(function (si) {
                if (!si) { return false; }
                return baja(true).then(fuera, function () { return false; });
            });
        });
    }

    function visor(indice) { return verTodas(indice); }

    /** URL del respaldo actual (admin-post + nonce) para una foto. */
    function urlRespaldo(foto) {
        var c = config();
        if (!c.url || !foto || !foto.id) { return ''; }
        return c.url + '?action=personalizador_pdf_biblioteca&op=imagen&id='
            + encodeURIComponent(String(foto.id)) + '&_wpnonce=' + encodeURIComponent(c.nonce);
    }

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
                var thumb = String(f.thumb_data || f.thumb || f.url || '');
                var url = String(urlResuelta || f.url || f.thumb || '');
                return {
                    url: url,
                    thumb: thumb,
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
            onChip: function (cuantos, desde) { verTodas(desde || 0); },
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
            img.src = String(f.thumb_data || urlResuelta || f.thumb || f.url || '');
            b.appendChild(img);
            b.addEventListener('click', function () { elegir(i); });
            t.appendChild(b);
        });
        // Spec 043 (US4/D4): el chip "Ver todas (N)" va SIEMPRE al final, con el total
        // real, y abre el visor (no elige una foto).
        var mas = doc.createElement('button');
        mas.type = 'button';
        mas.className = 'pmu-bib-mini pmu-bib-mas';
        mas.textContent = 'Ver todas (' + fotos.length + ')';
        mas.title = 'Ver mi biblioteca';
        mas.addEventListener('click', function () { verTodas(0); });
        t.appendChild(mas);
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
        var c = config();
        if (previa && previa.fotos.length) { pintarTira(el, previa.fotos); }
        // Spec 042: 0 solicitudes si la copia es de la misma identidad y revision.
        if (previa && previa.fotos.length
            && previa.revision && c.revision && previa.revision === c.revision) {
            return Promise.resolve(previa.fotos.length);
        }
        // Sin revision disponible: 0 solicitudes dentro de la ventana de frescura.
        if (previa && previa.fotos.length && !c.revision
            && (Date.now() - (previa.ts || 0)) < FRESCURA_MS) {
            return Promise.resolve(previa.fotos.length);
        }
        // Si la ficha trae una revision distinta, no se reutiliza la copia.
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
        var fresca = leerCache();
        var c = config();
        // Spec 042: con revision/identidad iguales no se pide nada.
        if (fresca && fresca.revision && c.revision && fresca.revision === c.revision) { return; }
        if (fresca && !c.revision && (Date.now() - (fresca.ts || 0)) < FRESCURA_MS) { return; }
        if ((c.url || c.rapido) && typeof global.fetch === 'function') {
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
        visor: visor, elegir: elegir, urlRespaldo: urlRespaldo, tope: TOPE_TIRA, clave: CLAVE };
    global.PMUBiblioteca = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
