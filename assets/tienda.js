/**
 * tienda.js - Panel del comprador en la ficha (spec 004, T012/T014/T014b).
 *
 * - T012: monta los campos del catalogo (HTML/CSS con scope + script(ctx, root)
 *   en sandbox del propio campo) y recolecta el valor dual {valor, cliente}.
 * - T014: "Vista previa" resuelve plantillas [campoN] contra los valores,
 *   renderiza con RenderCore (TextMuyAPI.renderBatch paralelo), sube cada PNG
 *   al pool del item (action=personalizador_pdf_pool) y compone los mockups
 *   300x300 en una galeria con flechas.
 * - T014b: si un campo resulta array (o `repetir` esta activo), un PNG por
 *   instancia; con N != M (valores vs instancias) se avisa y SE BLOQUEA la
 *   generacion de ese PDF (nunca un PDF a medias).
 *
 * La logica pura (plantillas + conciliacion + hash) es testeable en Node:
 * require('assets/tienda.js') exporta solo las funciones puras (sin DOM).
 */
(function (global) {
    'use strict';

    /* ==================== Logica pura (testeable en Node) ==================== */

    var PURO = {
        /**
         * Sustituye [campoN] por el valor del campo. Con `idx`, los valores
         * array entregan su elemento i-esimo (loop por instancia, T014b).
         */
        resolverPlantilla: function (plantilla, valores, idx) {
            return String(plantilla || '').replace(/\[campo(\d+)\]/g, function (_, n) {
                var id = parseInt(n, 10);
                var par = (valores || {})[String(id)] || (valores || {})[id];
                var v = par && Object.prototype.hasOwnProperty.call(par, 'valor') ? par.valor : '';
                if (Object.prototype.toString.call(v) === '[object Array]') {
                    var i = parseInt(idx, 10);
                    v = isNaN(i) ? '' : (v[i] === undefined || v[i] === null ? '' : v[i]);
                }
                return String(v === null || v === undefined ? '' : v);
            });
        },

        /** Ids [campoN] referenciados por la plantilla (unicos, ordenados). */
        camposDe: function (plantilla) {
            var ids = [];
            String(plantilla || '').replace(/\[campo(\d+)\]/g, function (_, n) {
                var id = parseInt(n, 10);
                if (ids.indexOf(id) === -1) { ids.push(id); }
                return _;
            });
            return ids;
        },

        /**
         * Concilia un grupo con los valores del comprador (T014b). Devuelve
         * {textos: [1 por instancia], aviso: ''} o {textos: [], aviso: '...'}
         * cuando N != M: el llamador BLOQUEA la generacion de ese PDF.
         */
        conciliarGrupo: function (grupo, valores) {
            var g = grupo || {};
            var ids = this.camposDe(g.value);
            var arrays = [];
            ids.forEach(function (id) {
                var par = (valores || {})[String(id)] || (valores || {})[id];
                var v = par && Object.prototype.hasOwnProperty.call(par, 'valor') ? par.valor : null;
                if (Object.prototype.toString.call(v) === '[object Array]') { arrays.push(v); }
            });
            var M = parseInt(g.cont, 10) || 1;
            if (!g.repetir && !arrays.length) {
                return { textos: [this.resolverPlantilla(g.value, valores)], aviso: '' };
            }
            var N = 1;
            arrays.forEach(function (a) { if (a.length > N) { N = a.length; } });
            if (arrays.length && N !== M) {
                return {
                    textos: [],
                    aviso: 'La personalizacion tiene ' + N + ' valor(es) y el PDF espera ' + M +
                        '. Iguala las cantidades antes de continuar.'
                };
            }
            var textos = [];
            for (var i = 0; i < M; i++) {
                textos.push(this.resolverPlantilla(g.value, valores, i));
            }
            return { textos: textos, aviso: '' };
        },

        /** Hash de regeneracion (contrato sesion-item.md): valor|preset|settings|WxH. */
        hashRender: function (valor, preset, settings, w, h) {
            return String(valor) + '|' + String(preset || '') + '|' + String(settings || '') + '|' +
                parseInt(w, 10) + 'x' + parseInt(h, 10);
        }
    };

    // Node (tests/conciliacion.js): exporta SOLO la logica pura, sin DOM.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PURO;
        return;
    }
    /* ==================== Navegador: ficha y vista previa ==================== */

    var cfg = global.PMU_TIENDA || {};
    var renderCorePromesa = null;
    var ficha = null;
    var galeriaActual = null;

    function raiz() {
        return document.querySelector('[data-pmu-panel]') || null;
    }

    /** Estado del panel: {campo_id: {valor, cliente}} (T012). */
    function contextoRaiz(estado) {
        return {
            set: function (id, valor) {
                id = parseInt(id, 10) || 0;
                if (id < 1) { return; }
                estado[id] = {
                    valor: (valor && 'valor' in valor) ? valor.valor : null,
                    cliente: (valor && 'cliente' in valor) ? String(valor.cliente || '') : ''
                };
            },
            get: function (id) {
                id = parseInt(id, 10) || 0;
                return estado[id] || null;
            }
        };
    }

    /** Compila los campos: CSS con scope + contenido + script (T012). */
    function montarCampos(raizEl, campos) {
        var estado = {};
        (campos || []).forEach(function (campo) {
            var envoltura = document.createElement('div');
            envoltura.className = 'pmu-campo pmu-campo-' + campo.id;
            envoltura.setAttribute('data-campo', campo.id);
            var etiqueta = document.createElement('p');
            etiqueta.className = 'pmu-campo-titulo';
            etiqueta.textContent = campo.titulo_cliente || '';
            if (campo.titulo_cliente) { envoltura.appendChild(etiqueta); }
            var cuerpo = document.createElement('div');
            cuerpo.className = 'pmu-campo-cuerpo';
            cuerpo.innerHTML = campo.contenido || '';
            envoltura.appendChild(cuerpo);
            if (campo.texto_ayuda) {
                var ayuda = document.createElement('p');
                ayuda.className = 'pmu-campo-ayuda';
                ayuda.textContent = campo.texto_ayuda;
                envoltura.appendChild(ayuda);
            }
            raizEl.appendChild(envoltura);
            if (campo.css) {
                var estilo = document.createElement('style');
                estilo.textContent = campo.css;
                envoltura.appendChild(estilo);
            }
            if (campo.script) {
                try {
                    var fn = new Function('ctx', 'root', 'return (' + campo.script + ')(ctx, root);');
                    fn(contextoRaiz(estado), cuerpo);
                } catch (e) {
                    estado[campo.id] = { valor: null, cliente: '' };
                }
            } else {
                var entrada = cuerpo.querySelector('input,textarea,select');
                if (entrada) {
                    var recolectar = function () {
                        estado[campo.id] = { valor: entrada.value, cliente: entrada.value };
                    };
                    entrada.addEventListener('input', recolectar);
                    recolectar();
                }
            }
        });
        return estado;
    }

    /** Carga perezosa del render-core (contrato AGENTS 2.1; igual que admin.js). */
    function renderCore() {
        if (renderCorePromesa) { return renderCorePromesa; }
        renderCorePromesa = new Promise(function (resolve, reject) {
            if (!cfg.renderCoreUrl) { reject(new Error('Render core no disponible.')); return; }
            var iframe = document.createElement('iframe');
            iframe.src = cfg.renderCoreUrl +
                (cfg.renderCoreUrl.indexOf('?') === -1 ? '?' : '&') +
                'v=' + encodeURIComponent(String(cfg.version || '1'));
            iframe.title = 'Motor de render TextMuy';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.tabIndex = -1;
            iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:0;';
            iframe.addEventListener('load', function () {
                enviarPuente();
                var intentos = 0;
                (function sondeo() {
                    var w = iframe.contentWindow;
                    if (w && w.RenderCore && w.TextMuyAPI && typeof w.TextMuyAPI.renderBatch === 'function') {
                        enviarPuente();
                        resolve(w);
                    } else if (++intentos < 100) {
                        setTimeout(sondeo, 100);
                    } else {
                        reject(new Error('El motor de render TextMuy no termino de cargar.'));
                    }
                })();
            });
            iframe.addEventListener('error', function () {
                reject(new Error('No se pudo cargar el motor de render TextMuy.'));
            });
            function enviarPuente() {
                if (!cfg.puente) { return; }
                try {
                    iframe.contentWindow.postMessage({ type: 'textmuy-bridge', bridge: cfg.puente }, window.location.origin);
                } catch (e) { /* el iframe puede no estar listo aun */ }
            }
            window.addEventListener('message', function (ev) {
                if (ev.source === iframe.contentWindow && ev.data && ev.data.type === 'textmuy-ready') {
                    enviarPuente();
                }
            });
            document.body.appendChild(iframe);
        });
        return renderCorePromesa;
    }

    /** POST al admin-ajax (FormData) con respuesta JSON. */
    function postAjax(datos) {
        return fetch(cfg.ajaxUrl, { method: 'POST', body: datos, credentials: 'same-origin' })
            .then(function (r) { return r.json(); });
    }
    /** Sube un PNG del pool (limpiar solo en el primer envio de cada grupo). */
    function subirPool(sid, itemKey, pdf, gid, blob, params, limpiar) {
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_pool');
        fd.append('_wpnonce', cfg.nonceVistaPrevia || '');
        fd.append('sid', sid);
        fd.append('item_key', itemKey);
        fd.append('pdf', pdf);
        fd.append('grupo', gid);
        fd.append('valor', params.valor);
        fd.append('preset', params.preset || '');
        fd.append('settings', params.settings || '');
        fd.append('w', String(params.w));
        fd.append('h', String(params.h));
        if (limpiar) { fd.append('limpiar', '1'); }
        fd.append('png', blob, gid + '.png');
        return postAjax(fd).then(function (json) {
            if (!json || !json.success) {
                throw new Error((json && json.data) || 'motor:pool:falla');
            }
            return json.data;
        });
    }

    /** Filtros CSS por capa (mismo contrato que el editor de mockups). */
    function filtroCss(f) {
        if (!f) { return 'none'; }
        var partes = [];
        if (f.brillo && +f.brillo !== 100) { partes.push('brightness(' + (+f.brillo / 100) + ')'); }
        if (f.contraste && +f.contraste !== 100) { partes.push('contrast(' + (+f.contraste / 100) + ')'); }
        if (f.saturacion && +f.saturacion !== 100) { partes.push('saturate(' + (+f.saturacion / 100) + ')'); }
        return partes.length ? partes.join(' ') : 'none';
    }

    /** Carga una imagen (Promesa); falla en silencio (vista rota = se oculta). */
    function cargarImagen(url) {
        return new Promise(function (resolver) {
            var img = new Image();
            img.onload = function () { resolver(img); };
            img.onerror = function () { resolver(null); };
            img.src = url;
        });
    }

    /**
     * Compone un mockup 300x300 con capas img/placeholder (misma geometria
     * que el editor del admin: x/y/w/h/rot/sesgo + filtros solo mockup).
     */
    function componerMockup(pdfDatos, mockup, pngsPorGrupo) {
        var canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        canvas.className = 'pmu-gal-canvas';
        var ctx = canvas.getContext('2d');
        var capas = (mockup && mockup.capas) || [];
        var cargas = capas.map(function (c) {
            ctx.save();
            ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
            ctx.rotate((c.rot || 0) * Math.PI / 180);
            if (c.sesgo) { ctx.transform(1, 0, c.sesgo, 1, 0, 0); }
            ctx.filter = filtroCss(c.filtros);
            var promesa;
            if (c.tipo === 'img') {
                promesa = cargarImagen((pdfDatos.fotos || {})[c.ref]);
            } else {
                var partes = String(c.ref || '').split('#');
                var lista = pngsPorGrupo[partes[0]] || [];
                var k = partes.length > 1 ? (parseInt(partes[1], 10) - 1) : 0;
                promesa = lista[k] ? cargarImagen(URL.createObjectURL(lista[k])) : Promise.resolve(null);
            }
            return promesa.then(function (img) {
                if (img && img.naturalWidth) {
                    ctx.drawImage(img, -c.w / 2, -c.h / 2, c.w, c.h);
                } else {
                    // Placeholder sin render: caja neutra (nunca rompe la vista).
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                }
                ctx.restore();
            });
        });
        return Promise.all(cargas).then(function () { return canvas; });
    }
    /** Aviso por PDF (N != M o fallos): siempre visible y accionable. */
    function mostrarAviso(pdfDatos, texto) {
        var panel = raiz();
        if (!panel) { return; }
        var aviso = panel.querySelector('.pmu-aviso-' + (pdfDatos ? pdfDatos.pdf : 'general'));
        if (!aviso) {
            aviso = document.createElement('p');
            aviso.className = 'pmu-aviso pmu-aviso-' + (pdfDatos ? pdfDatos.pdf : 'general');
            aviso.setAttribute('role', 'alert');
            panel.appendChild(aviso);
        }
        aviso.textContent = texto;
    }

    /** Galeria 300x300 con flechas (T014): placeholders en vivo por vista. */
    function prepararGaleria(vistas) {
        var panel = raiz();
        if (!panel) { return null; }
        var gal = panel.querySelector('.pmu-galeria');
        if (!gal) {
            gal = document.createElement('div');
            gal.className = 'pmu-galeria';
            panel.appendChild(gal);
        }
        gal.innerHTML = '';
        var contenedor = document.createElement('div');
        contenedor.className = 'pmu-galeria-vista';
        gal.appendChild(contenedor);
        vistas.forEach(function (v) {
            var marco = document.createElement('figure');
            marco.className = 'pmu-gal-item';
            marco.style.display = 'none';
            marco.style.margin = '0';
            var espera = document.createElement('div');
            espera.className = 'pmu-gal-espera';
            espera.style.cssText = 'width:300px;height:300px;display:flex;align-items:center;' +
                'justify-content:center;background:#f5f5f5;border:1px solid #ddd;font-size:14px;';
            espera.textContent = 'Generando vista previa';
            marco.appendChild(espera);
            contenedor.appendChild(marco);
            v.marco = marco;
        });
        var nav = document.createElement('div');
        nav.className = 'pmu-galeria-nav';
        nav.style.cssText = 'display:flex;gap:8px;align-items:center;';
        var prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'pmu-gal-prev';
        prev.textContent = '\u2039';
        var leyenda = document.createElement('span');
        leyenda.className = 'pmu-gal-indice';
        var next = document.createElement('button');
        next.type = 'button';
        next.className = 'pmu-gal-next';
        next.textContent = '\u203A';
        nav.appendChild(prev);
        nav.appendChild(leyenda);
        nav.appendChild(next);
        gal.appendChild(nav);
        var estado = { vistas: vistas, idx: 0 };
        function mostrar() {
            estado.vistas.forEach(function (v, i) {
                v.marco.style.display = i === estado.idx ? 'block' : 'none';
            });
            leyenda.textContent = (estado.idx + 1) + ' / ' + estado.vistas.length;
        }
        prev.addEventListener('click', function () {
            estado.idx = (estado.idx + estado.vistas.length - 1) % estado.vistas.length;
            mostrar();
        });
        next.addEventListener('click', function () {
            estado.idx = (estado.idx + 1) % estado.vistas.length;
            mostrar();
        });
        mostrar();
        galeriaActual = estado;
        return estado;
    }

    /* ==================== T015: carrito del comprador ==================== */

    /** Boton "Agregar al carrito" de la ficha Woo (null fuera de Woo). */
    function botonWoo() {
        var form = document.querySelector('form.cart');
        return form ? form.querySelector('.single_add_to_cart_button') : null;
    }

    /** T015: el carrito queda bloqueado hasta que las vistas esten listas. */
    function bloquearCarrito(bloquear) {
        var b = botonWoo();
        if (b) { b.disabled = bloquear; }
    }

    /** Inyecta (o actualiza) un input oculto en el form del carrito. */
    function inyectar(form, nombre, valor) {
        var campo = form.querySelector('input[name="' + nombre + '"]');
        if (!campo) {
            campo = document.createElement('input');
            campo.type = 'hidden';
            campo.name = nombre;
            form.appendChild(campo);
        }
        campo.value = valor;
    }

    /**
     * T015: intercept del submit del carrito. Envia la meta canonica (pmu_sid/
     * pmu_item_key) y congela las vistas aprobadas (pmu_mockups = {id: webp}).
     * Submit NATIVO con inputs ocultos: nunca se lee form.action (norma §11).
     */
    function engancharCarrito() {
        var form = document.querySelector('form.cart');
        if (!form || form.getAttribute('data-pmu-carrito') === '1') { return; }
        form.setAttribute('data-pmu-carrito', '1');
        form.addEventListener('submit', function () {
            if (!global.PMU_API || !global.PMU_API.sesion) { return; }
            var webps = {};
            (galeriaActual && galeriaActual.vistas || []).forEach(function (v) {
                if (v.canvas && v.mockup && v.mockup.id) {
                    try {
                        var url = v.canvas.toDataURL('image/webp', 0.9);
                        if (String(url).indexOf('data:image/webp') === 0) {
                            webps[v.mockup.id] = url;
                        }
                    } catch (e) { /* sin webp: sin_vista, reintento al descargar */ }
                }
            });
            inyectar(form, 'pmu_sid', global.PMU_API.sesion.sid);
            inyectar(form, 'pmu_item_key', global.PMU_API.sesion.item_key);
            inyectar(form, 'pmu_mockups', JSON.stringify(webps));
        });
    }

    /** Genera la vista de UN pdf: concilia, renderiza, sube y compone. */
    function generarPdf(pdfDatos, sid, itemKey, vista) {
        var valores = (global.PMU_API && global.PMU_API.valores()) || {};
        var pendientes = [];
        var avisos = [];
        (pdfDatos.grupos || []).forEach(function (g) {
            if (g.tipo !== 'texto' || !g.preset) { return; }
            var c = PURO.conciliarGrupo(g, valores);
            if (c.aviso) {
                avisos.push(c.aviso); // T014b: bloquea SOLO este PDF
                return;
            }
            c.textos.forEach(function (texto, i) {
                pendientes.push({ gid: g.id, i: i, texto: texto, g: g, primero: i === 0 });
            });
        });
        if (avisos.length) { mostrarAviso(pdfDatos, avisos.join(' ')); }
        if (!pendientes.length) {
            var esperaBloq = vista.marco.querySelector('.pmu-gal-espera');
            if (esperaBloq) {
                esperaBloq.textContent = avisos.length ? 'Sin vista previa disponible' : 'Generando vista previa';
            }
            return Promise.resolve();
        }
        return renderCore().then(function (core) {
            var items = pendientes.map(function (p) {
                return { id: p.gid + '-' + (p.i + 1), text: p.texto, preset: p.g.preset, width: p.g.w, height: p.g.h };
            });
            return core.TextMuyAPI.renderBatch(items);
        }).then(function (out) {
            var porId = {};
            (out || []).forEach(function (r) { porId[r.id] = r.blob; });
            var subidas = pendientes.map(function (p) {
                var blob = porId[p.gid + '-' + (p.i + 1)];
                if (!blob) { return Promise.resolve(null); }
                return subirPool(sid, itemKey, pdfDatos.pdf, p.gid, blob, {
                    valor: p.texto, preset: p.g.preset, settings: p.g.settings, w: p.g.w, h: p.g.h
                }, p.primero);
            });
            return Promise.all(subidas).then(function () {
                var pngsPorGrupo = {};
                pendientes.forEach(function (p) {
                    var blob = porId[p.gid + '-' + (p.i + 1)];
                    if (!blob) { return; }
                    var lista = pngsPorGrupo[p.gid] || [];
                    lista.push(blob);
                    pngsPorGrupo[p.gid] = lista;
                });
                return componerMockup(pdfDatos, vista.mockup, pngsPorGrupo).then(function (canvas) {
                    var espera = vista.marco.querySelector('.pmu-gal-espera');
                    if (espera) { espera.remove(); }
                    vista.canvas = canvas;
                    vista.marco.appendChild(canvas);
                });
            });
        }).catch(function (e) {
            // Vista rota: se oculta con aviso (T021 pule el mensaje); nunca rompe la ficha.
            if (window.console && console.warn) { console.warn('[PersonalizadorPDF]', e); }
            var espera = vista.marco.querySelector('.pmu-gal-espera');
            if (espera) { espera.textContent = 'Vista no disponible'; }
        });
    }
    /** Flujo completo de "Vista previa" (T014): draft -> pool -> galeria. */
    function generarVista() {
        if (!ficha || !global.PMU_API) { return Promise.resolve(); }
        var fd = new FormData();
        fd.append('action', 'personalizador_pdf_vista_previa');
        fd.append('_wpnonce', cfg.nonceVistaPrevia || '');
        fd.append('pdf', ficha.pdf);
        fd.append('valores', JSON.stringify(global.PMU_API.valores()));
        return postAjax(fd).then(function (json) {
            if (!json || !json.success) {
                throw new Error((json && json.data) || 'motor:previa:falla');
            }
            var datos = json.data;
            global.PMU_API.sesion = { sid: datos.sid, item_key: datos.item_key };
            var pdfDatos = (datos.pdfs || [])[0] || { pdf: ficha.pdf, grupos: [], fotos: {}, mockups: [] };
            var vistas = (pdfDatos.mockups || []).map(function (m) { return { mockup: m }; });
            var galeria = prepararGaleria(vistas);
            if (!galeria || !galeria.vistas.length) {
                bloquearCarrito(false); // sin mockups: sin vista previa, venta libre (T021)
                return null;
            }
            return Promise.all(galeria.vistas.map(function (v) {
                return generarPdf(pdfDatos, datos.sid, datos.item_key, v);
            })).then(function () {
                bloquearCarrito(false); // vistas listas: carrito habilitado
            });
        });
    }

    /** Punto de entrada (T012/T014): monta campos + boton "Vista previa". */
    function iniciar() {
        var panel = raiz();
        if (!panel) { return null; }
        ficha = global.PMU_FICHA || {};
        if (!ficha.pdf || !(ficha.campos || []).length) { return null; }
        var estado = montarCampos(panel, ficha.campos);
        var api = { pdf: ficha.pdf, estado: estado, valores: function () { return estado; } };
        global.PMU_API = api;
        // T015: sin vistas el carrito permanece bloqueado (excepto omisible, T018).
        if (!ficha.preview_omisible) { bloquearCarrito(true); }
        engancharCarrito();
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pmu-btn-previa';
        btn.textContent = 'Vista previa';
        btn.addEventListener('click', function () {
            btn.disabled = true;
            var leyenda = document.createElement('p');
            leyenda.className = 'pmu-leyenda';
            leyenda.textContent = 'Verifica tu personalizacion antes de continuar con la compra.';
            panel.appendChild(leyenda);
            generarVista().catch(function (e) {
                if (window.console && console.warn) { console.warn('[PersonalizadorPDF]', e); }
                mostrarAviso(null, (e && e.message) || 'No se pudo generar la vista previa.');
                bloquearCarrito(false); // V-7: la venta nunca queda bloqueada (T021 pule esto)
            }).then(function () {
                btn.disabled = false;
            });
        });
        panel.appendChild(btn);
        return api;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    global.PMU_Tienda = { iniciar: iniciar, montarCampos: montarCampos, puro: PURO };
})(typeof window !== 'undefined' ? window : globalThis);