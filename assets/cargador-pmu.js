/**
 * cargador-pmu - Cargador de imagenes del comprador (spec 012, T023/T024, US6).
 *
 * Un campo con `cargador` muestra uno por bloque sus **ranuras** (D7). Cada
 * ranura abre un `SelectorPMU` (el componente ya escrito de la 004, cuyo
 * contrato NO se toca) y sube el recorte al item del comprador. Este componente
 * NO manda nada al Motor: solo al item, antes de la vista previa.
 *
 * Ranura: `{w, h, forma: 'circle'|'square'|'rect'|'fit', min, max}`.
 * - `forma` decide el recorte: `fit` encaja la imagen completa; las otras
 *   recortan al marco y solo cambian la presentacion (circle/square/redondeado).
 * - `min` es la VALIDACION REAL (D16/T023b): el boton de "Listo" queda
 *   deshabilitado hasta que todas las ranuras tengan al menos `min`. Sin esto el
 *   comprador deja el item a medias.
 * - `max` es el tope por ranura: al llegar, el boton de agregar se apaga.
 *
 * Config:
 *   new CargadorPMU(elemento, {
 *     ranuras: [...],
 *     subir: function(blob, ctx) { return Promise<{id:string}> },  // lo da tienda.js
 *     onChange: function(estado) {},
 *     onError: function(mensaje) {}
 *   })
 *
 * Sin dependencias (JS puro). Exporta tambien en Node (`module`) para poder
 * probar la logica de ranuras con `tests/campos-contrato.test.js`.
 */
(function (global) {
    'use strict';

    var FORMAS = ['rectangulo', 'circulo', 'cuadrado', 'ovalo', 'auto'];
    var MAPA_FORMAS = {
        rectangulo: 'rectangulo', rect: 'rectangulo',
        circulo: 'circulo', circle: 'circulo',
        cuadrado: 'cuadrado', square: 'cuadrado',
        ovalo: 'ovalo',
        auto: 'auto', fit: 'auto'
    };

    /**
     * Normaliza las ranuras que llegan del campo (spec 012 + spec 021).
     * Una ranura invalida (sin w/h) se descarta; si no queda ninguna, la lista
     * es vacia y el campo no monta cargador (no inventa medidas).
     */
    function normalizarRanuras(ranuras) {
        var out = [];
        (ranuras || []).forEach(function (r) {
            if (!r) { return; }
            var w = parseInt(r.w, 10) || 0;
            var h = parseInt(r.h, 10) || 0;
            if (w < 1 || h < 1) { return; }
            var min = parseInt(r.min, 10) || 1;
            var max = parseInt(r.max, 10) || 1;
            if (min < 1) { min = 1; }
            if (max < min) { max = min; }
            var fCruda = (r.forma === undefined || r.forma === null || r.forma === '')
                ? 'auto' : String(r.forma);
            var forma = MAPA_FORMAS[fCruda] || 'rectangulo';
            var size = parseFloat(r.size);
            if (!isFinite(size) || size <= 0) { size = 1; }
            var ox = parseFloat(r.ox);
            if (!isFinite(ox)) { ox = 0; }
            var oy = parseFloat(r.oy);
            if (!isFinite(oy)) { oy = 0; }
            var fondo = (typeof r.fondo === 'string' && r.fondo.trim() !== '')
                ? r.fondo.trim() : 'auto';
            out.push({
                etiqueta: r.etiqueta || '',
                w: w, h: h,
                forma: forma,
                min: min, max: max,
                r: r.r ? 1 : 0,
                size: size,
                ox: ox,
                oy: oy,
                fondo: fondo,
                aviso: r.aviso || ''
            });
        });
        return out;
    }

    /**
     * Envoltura valida (geometria `{par, subs}` normalizada 0..1) o null.
     * Es la guia visual del recorte real (PowerClip) del grupo: NUNCA corta
     * el PNG (el clip lo aplica el PDF al procesar).
     */
    function envolturaValida(e) {
        if (!e || !e.subs || !e.subs.length) { return null; }
        return { par: e.par ? 1 : 0, subs: e.subs };
    }

    /** Estado inicial de las ranuras: N bloques vacios. */
    function estadoInicial(ranuras) {
        return ranuras.map(function () { return { ids: [] }; });
    }

    /**
     * D16/T023b: el campo esta completo cuando TODAS las ranuras tienen al menos
     * `min` imagenes. `faltan` es el total que le falta al comprador.
     */
    function completo(ranuras, estado) {
        var faltan = 0;
        var listo = ranuras.length > 0;
        ranuras.forEach(function (r, i) {
            var n = (estado[i] && estado[i].ids ? estado[i].ids.length : 0);
            faltan += Math.max(0, r.min - n);
            if (n < r.min) { listo = false; }
        });
        return { listo: listo, faltan: faltan };
    }

    /** Ids en el orden de las ranuras, aplanados (FR-033). */
    function idsPlanos(estado) {
        var out = [];
        (estado || []).forEach(function (e) {
            (e.ids || []).forEach(function (id) { out.push(id); });
        });
        return out;
    }

    /** `array: true` si alguna ranura admite mas de una imagen (FR-034). */
    function esArray(ranuras) {
        return ranuras.some(function (r) { return r.max > 1; });
    }
/**
     * Estilos del cargador. Se inyectan desde el componente (igual que
     * `selector-pmu.js`): asi el cargador no depende de que el tema traiga una
     * hoja con esta clase, que es nueva de la 012.
     */
    var ESTILOS_INYECTADOS = false;
    function inyectarEstilos() {
        if (ESTILOS_INYECTADOS || !global.document) { return; }
        ESTILOS_INYECTADOS = true;
        var doc = global.document;
        var st = doc.createElement('style');
        st.setAttribute('data-cargador-pmu', '1');
        st.textContent =
            '.cpmu{margin:0 0 12px}'
            + '.cpmu-ranura{border:1px solid #dcdcde;border-radius:6px;padding:10px;margin:0 0 10px}'
            + '.cpmu-titulo{margin:0 0 8px;font-size:12px;color:#50575e}'
            + '.cpmu-aviso{margin:0 0 8px;font-size:11.5px;color:#8a6116;background:#fcf9e8;border:1px solid #f0e6c0;border-radius:4px;padding:4px 6px}'
            + '.cpmu-guia{display:inline-block;margin:0 0 8px;padding:6px 8px;border:1px dashed #c3c4c7;border-radius:4px}'
            + '.cpmu-guia-tit{margin:0 0 4px;font-size:11.5px;color:#646970}'
            + '.cpmu-guia-canvas{display:block;background:#fff}'
            + '.cpmu-tiras{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}'
            + '.cpmu-mini{width:56px;height:56px;border:1px solid #2271b1;background:#f0f6fc;color:#2271b1;font:600 15px/1 system-ui,sans-serif;cursor:pointer;border-radius:4px;position:relative;overflow:hidden;padding:0}'
            + '.cpmu-mini img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
            + '.cpmu-mini-circulo,.cpmu-mini-circle{border-radius:50%}'
            + '.cpmu-zona{border:2px dashed #c3c4c7;border-radius:6px;padding:14px;text-align:center;color:#50575e;font-size:13px;cursor:pointer}'
            + '.cpmu-zona-sobre{border-color:#2271b1;background:#f0f6fc}'
            + '.cpmu-zona-llena{opacity:.75}'
            + '.cpmu-pie{display:flex;align-items:center;gap:10px;margin-top:6px}'
            + '.cpmu-estado{font-size:12px;color:#50575e}'
            + '.cpmu-listo[disabled]{opacity:.6;cursor:not-allowed}'
            + '.cpmu-visor{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:180000;display:flex;flex-direction:column;justify-content:space-between;color:#fff;padding:calc(12px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box}'
            + '.cpmu-visor-top{display:flex;align-items:center;justify-content:space-between;gap:12px}'
            + '.cpmu-visor-contador{font-size:14px;font-weight:600}'
            + '.cpmu-visor-cerrar{border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer}'
            + '.cpmu-visor-cuerpo{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0;gap:12px;margin:10px 0}'
            + '.cpmu-visor-img{max-width:min(86vw,900px);max-height:70vh;object-fit:contain;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.6);background:repeating-conic-gradient(#333 0 25%,#444 0 50%) 0/20px 20px}'
            + '.cpmu-visor-nav{border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:50%;width:44px;height:44px;font-size:24px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}'
            + '.cpmu-visor-nav[hidden]{display:none}'
            + '.cpmu-visor-acciones{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}'
            + '.cpmu-visor-acciones .button{min-height:42px;padding:6px 18px;font-size:14px}'
            + '.cpmu-visor-eliminar{background:#d63638 !important;border-color:#d63638 !important;color:#fff !important}';
        (doc.head || doc.documentElement).appendChild(st);
    }

    function CargadorPMU(elemento, config) {
        config = config || {};
        this.elemento = elemento;
        this.config = {
            ranuras: normalizarRanuras(config.ranuras),
            subir: typeof config.subir === 'function' ? config.subir : null,
            onChange: typeof config.onChange === 'function' ? config.onChange : null,
            onError: typeof config.onError === 'function' ? config.onError : null,
            urlDe: typeof config.urlDe === 'function' ? config.urlDe : null,
            preview: !!config.preview,
            envoltura: envolturaValida(config.envoltura)
        };
        this.estado = estadoInicial(this.config.ranuras);
        if (Array.isArray(config.idsIniciales)) {
            config.idsIniciales.forEach(function (ids, i) {
                if (this.estado[i] && Array.isArray(ids) && this.config.ranuras[i]) {
                    this.estado[i].ids = ids.map(String).slice(0, this.config.ranuras[i].max);
                }
            }, this);
        }
        this.selectores = [];
        this.raiz = null;
        this._reemplazo = null;
        this.visor = null;
        this._onKeyVisor = null;
    }

    CargadorPMU.prototype.montar = function () {
        if (!this.elemento || this.config.ranuras.length === 0) {
            return false;
        }
        inyectarEstilos();
        var self = this;
        var doc = this.elemento.ownerDocument || global.document;
        var raiz = doc.createElement('div');
        raiz.className = 'cpmu';
        raiz.setAttribute('data-cargador', '1');

        this.config.ranuras.forEach(function (r, i) {
            raiz.appendChild(self._bloque(r, i, doc));
        });

        var pie = doc.createElement('div');
        pie.className = 'cpmu-pie';
        var listo = doc.createElement('button');
        listo.type = 'button';
        listo.className = 'button cpmu-listo';
        listo.disabled = true;           // D16: nace deshabilitado
        listo.textContent = 'Listo';
        var estado = doc.createElement('span');
        estado.className = 'cpmu-estado';
        pie.appendChild(listo);
        pie.appendChild(estado);
        raiz.appendChild(pie);

        this.elemento.appendChild(raiz);
        this.raiz = raiz;
        this.btnListo = listo;
        this.txtEstado = estado;
        if (this.config.preview) {
            listo.style.display = 'none';   // en el preview no se "cierra" nada
        }
        this._pintar();
        return true;
    }

    /** Guia visual: la forma de la envoltura escalada a la ranura. */
    CargadorPMU.prototype._guia = function (doc, r) {
        var max = Math.max(1, Math.max(r.w, r.h));
        var w = Math.max(40, Math.round(120 * (r.w / max)));
        var h = Math.max(40, Math.round(120 * (r.h / max)));
        var caja = doc.createElement('div');
        caja.className = 'cpmu-guia';
        var tit = doc.createElement('p');
        tit.className = 'cpmu-guia-tit';
        tit.textContent = 'Guia de la envoltura (' + r.w + 'x' + r.h + ' px)';
        caja.appendChild(tit);
        var cv = doc.createElement('canvas');
        cv.width = w;
        cv.height = h;
        cv.className = 'cpmu-guia-canvas';
        var ctx = cv.getContext('2d');
        var env = this.config.envoltura;
        var comandos = (global.PMUMockup && global.PMUMockup.comandosEnvoltura)
            ? global.PMUMockup.comandosEnvoltura(env, { x: 0, y: 0, w: w, h: h })
            : [];
        ctx.fillStyle = 'rgba(34, 113, 177, .08)';
        ctx.strokeStyle = '#2271b1';
        ctx.lineWidth = 1.5;
        if (comandos.length && global.PMUMockup.trazarEnvoltura) {
            global.PMUMockup.trazarEnvoltura(ctx, comandos);
            ctx.fill(env.par ? 'evenodd' : 'nonzero');
            ctx.stroke();
        } else {
            ctx.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
        }
        caja.appendChild(cv);
        return caja;
    };

    /** Un bloque por ranura: encabezado, miniaturas, zona de arrastrar. */
    CargadorPMU.prototype._bloque = function (r, i, doc) {
        var self = this;
        var div = doc.createElement('div');
        div.className = 'cpmu-ranura';
        div.setAttribute('data-ranura', String(i));

        var tit = doc.createElement('p');
        tit.className = 'cpmu-titulo';
        tit.textContent = r.w + 'x' + r.h + ' px - ' + r.forma
            + ' - min ' + r.min + (r.max > 1 ? ' - hasta ' + r.max : '');
        div.appendChild(tit);

        // Spec 019 (FR-006): aviso de la ranura (phsize sin grupo asociado, o
        // tamano acotado por PH_MAX). Informativo: la ranura funciona igual.
        if (r.aviso) {
            var avi = doc.createElement('p');
            avi.className = 'cpmu-aviso';
            avi.textContent = r.aviso;
            div.appendChild(avi);
        }

        // Guia visual de la envoltura (PowerClip) del grupo: el comprador ve
        // la forma en la que su foto quedara cortada. Solo PISTA: el PNG se
        // guarda sin cortar y el clip real lo aplica el PDF.
        if (this.config.envoltura) {
            div.appendChild(this._guia(doc, r));
        }

        var tira = doc.createElement('div');
        tira.className = 'cpmu-tiras';
        div.appendChild(tira);

        var zona = doc.createElement('div');
        zona.className = 'cpmu-zona';
        if (this.config.preview) {
            // T011b/FR-009: en el preview la ranura se DIBUJA (medida, forma y
            // cuantos exige) pero no se puede subir nada.
            zona.classList.add('cpmu-zona-preview');
            zona.textContent = 'Vista previa: ' + r.min + ' imagen(es) de ' + r.max + '.';
        } else {
            zona.textContent = 'Suelta la imagen o hace clic';
        }
        var boton = doc.createElement('button');
        boton.type = 'button';
        boton.className = 'button cpmu-agregar';
        boton.textContent = 'Agregar imagen';
        if (!this.config.preview) {
            zona.appendChild(boton);   // en el preview no queda un boton muerto
        }
        div.appendChild(zona);

        if (this.config.preview) {
            this.selectores[i] = { boton: boton, tira: tira, zona: zona, sel: null };
            return div;
        }
        boton.addEventListener('click', function (e) {
            e.stopPropagation();
            self._abrir(i, null);
        });
        zona.addEventListener('click', function () {
            if (!boton.disabled) { self._abrir(i, null); }
        });
        ['dragenter', 'dragover'].forEach(function (ev) {
            zona.addEventListener(ev, function (e) {
                e.preventDefault();
                zona.classList.add('cpmu-zona-sobre');
            });
        });
        zona.addEventListener('dragleave', function () {
            zona.classList.remove('cpmu-zona-sobre');
        });
        zona.addEventListener('drop', function (e) {
            e.preventDefault();
            zona.classList.remove('cpmu-zona-sobre');
            var dt = e.dataTransfer;
            var archivo = dt && dt.files && dt.files[0];
            if (!archivo) {
                self._error('Suelta un archivo de imagen.');
                return;
            }
            self._abrir(i, archivo);
        });

        this.selectores[i] = { boton: boton, tira: tira, zona: zona, sel: null };
        return div;
    };
/**
     * Abre el `SelectorPMU` de la ranura. `archivo` (opcional) precarga el
     * modal: se hace por la superficie PUBLICA del modal (el input `.spmu-file`
     * que ya renderiza), sin tocar los internos de `selector-pmu.js`, cuyo
     * contrato no se modifica. Si la precarga falla, el modal sigue abierto y el
     * comprador elige el archivo a mano.
     */
    CargadorPMU.prototype._abrir = function (indice, archivo) {
        var self = this;
        var r = this.config.ranuras[indice];
        var slot = this.selectores[indice];
        if (!r || !slot) { return; }
        if (!this._reemplazo && slot.tira.querySelectorAll('.cpmu-mini').length >= r.max) { return; }

        if (!slot.sel && typeof global.SelectorPMU !== 'function') {
            this._error('Falta selector-pmu.js: no se puede cargar la imagen.');
            return;
        }
        if (!slot.sel) {
            slot.sel = new global.SelectorPMU(null, {
                finalW: r.w,
                finalH: r.h,
                aspectRatio: r.w / r.h,
                forma: r.forma,
                r: r.r,
                size: r.size,
                ox: r.ox,
                oy: r.oy,
                fondo: r.fondo,
                envoltura: this.config.envoltura || null,
                subirAsync: function (blob) {
                    var reemplazo = self._reemplazo;
                    self._reemplazo = null;
                    var pos = reemplazo ? reemplazo.posicion : null;
                    return self._subir(indice, blob, pos).then(function (id) {
                        if (reemplazo && reemplazo.desdeVisor) {
                            self._abrirVisor(indice, pos);
                        }
                        return id;
                    });
                },
                quedanEspacios: function () {
                    return self.estado[indice].ids.length < r.max;
                }
            });
        }
        slot.sel.onSelect(function () {
            if (!slot.sel.config.subirAsync) {
                var blob = slot.sel.obtenerBlob();
                if (!blob) { self._error('No se pudo generar el recorte.'); return; }
                var reemplazo = self._reemplazo;
                self._reemplazo = null;
                self._subir(indice, blob, reemplazo ? reemplazo.posicion : null);
            }
        });
        slot.sel.onError(function (mensaje, err) {
            if (err && err.code === 'CROP_ABORTED') {
                var reemp = self._reemplazo;
                self._reemplazo = null;
                if (reemp && reemp.desdeVisor) {
                    self._abrirVisor(reemp.indice, reemp.posicion);
                }
                return;
            }
            self._error(mensaje);
        });
        var tituloContexto = this._reemplazo
            ? ('Reemplazando imagen #' + (this._reemplazo.posicion + 1))
            : '';
        slot.sel.open({
            archivo: archivo || null,
            tituloContexto: tituloContexto
        });
    };

    /** Sube el blob al item y, si el servidor devuelve id, lo anota. */
    CargadorPMU.prototype._subir = function (indice, blob, posicion) {
        var self = this;
        if (!this.config.subir) {
            this._error('No hay donde subir la imagen.');
            return Promise.reject(new Error('No hay donde subir la imagen.'));
        }
        var r = this.config.ranuras[indice];
        var btn = this.selectores[indice].boton;
        btn.disabled = true;
        return Promise.resolve(this.config.subir(blob, {
            ranura: indice, w: r.w, h: r.h, forma: r.forma
        })).then(function (res) {
            btn.disabled = false;
            var id = res && res.id;
            if (!id) {
                self._error('El servidor no devolvio la imagen.');
                throw new Error('El servidor no devolvio la imagen.');
            }
            if (posicion === null || posicion === undefined || posicion >= self.estado[indice].ids.length) {
                self.estado[indice].ids.push(String(id));
            } else {
                self.estado[indice].ids[posicion] = String(id);
            }
            self._pintar();
            return id;
        }, function (err) {
            btn.disabled = false;
            var msg = (err && err.message) || 'No se pudo subir la imagen.';
            self._error(msg);
            throw err || new Error(msg);
        });
    };
    /** Repinta miniaturas, contadores y el boton de "Listo" (D16). */
    CargadorPMU.prototype._pintar = function () {
        var self = this;
        this.config.ranuras.forEach(function (r, i) {
            var slot = self.selectores[i];
            if (!slot) { return; }
            var doc = self.raiz.ownerDocument || global.document;
            var n = self.estado[i].ids.length;
            slot.tira.innerHTML = '';
            self.estado[i].ids.forEach(function (id, k) {
                var mini = doc.createElement('button');
                mini.type = 'button';
                mini.className = 'cpmu-mini cpmu-mini-' + r.forma;
                mini.setAttribute('data-id', id);
                mini.title = 'Ver imagen #' + (k + 1);
                mini.textContent = String(k + 1);
                self._pintarMini(mini, id);
                mini.addEventListener('click', function () { self._miniTocar(i, k, mini); });
                slot.tira.appendChild(mini);
            });
            slot.boton.disabled = n >= r.max;
            slot.zona.classList.toggle('cpmu-zona-llena', n > 0);
        });
        var est = completo(this.config.ranuras, this.estado);
        this.btnListo.disabled = !est.listo;
        this.txtEstado.textContent = est.listo
            ? 'Listo: ' + idsPlanos(this.estado).length + ' imagen(es).'
            : 'Faltan ' + est.faltan + ' imagen(es).';
        if (this.config.onChange) {
            this.config.onChange(this.estadoActual());
        }
    };

    CargadorPMU.prototype._pintarMini = function (mini, id) {
        if (!this.config.urlDe || mini._pmuMiniImg) { return; }
        Promise.resolve(this.config.urlDe(id)).then(function (url) {
            if (!url || mini._pmuMiniImg) { return; }
            var doc = mini.ownerDocument || global.document;
            var img = doc.createElement('img');
            img.alt = '';
            img.src = url;
            mini._pmuMiniImg = true;
            mini.innerHTML = '';
            mini.appendChild(img);
        }).catch(function () { /* queda el numero */ });
    };

    /** Spec 021 (D9): tocar una miniatura abre la mini galeria / visor fullscreen. */
    CargadorPMU.prototype._miniTocar = function (indice, posicion) {
        this._abrirVisor(indice, posicion);
    };

    /**
     * Spec 021 (D9): mini galeria fullscreen (`cpmu-visor`) para revisar la
     * coleccion de imagenes subidas con flechas, Eliminar y Reemplazar.
     */
    CargadorPMU.prototype._abrirVisor = function (indice, posicion) {
        var self = this;
        this._cerrarVisor();
        var ids = (this.estado[indice] && this.estado[indice].ids) || [];
        if (!ids.length) { return; }
        var pos = Math.max(0, Math.min(ids.length - 1, parseInt(posicion, 10) || 0));
        var doc = (this.raiz && this.raiz.ownerDocument) || global.document;
        if (!doc || !doc.body) { return; }

        var modal = doc.createElement('div');
        modal.className = 'cpmu-visor';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Galeria de imagenes subidas');
        modal.innerHTML =
            '<div class="cpmu-visor-top">' +
            '<span class="cpmu-visor-contador"></span>' +
            '<button type="button" class="cpmu-visor-cerrar" aria-label="Cerrar">&#10005;</button>' +
            '</div>' +
            '<div class="cpmu-visor-cuerpo">' +
            '<button type="button" class="cpmu-visor-nav cpmu-visor-prev" aria-label="Anterior">&#8249;</button>' +
            '<img class="cpmu-visor-img" alt="">' +
            '<button type="button" class="cpmu-visor-nav cpmu-visor-next" aria-label="Siguiente">&#8250;</button>' +
            '</div>' +
            '<div class="cpmu-visor-acciones">' +
            '<button type="button" class="button button-primary cpmu-visor-reemplazar">Reemplazar</button>' +
            '<button type="button" class="button cpmu-visor-eliminar">Eliminar</button>' +
            '</div>';
        doc.body.appendChild(modal);
        this.visor = modal;
        this._cablearVisor(modal, doc, indice, pos);
    };

    CargadorPMU.prototype._cablearVisor = function (modal, doc, indice, pos) {
        var self = this;
        var elCont = modal.querySelector('.cpmu-visor-contador');
        var elImg = modal.querySelector('.cpmu-visor-img');
        var btnPrev = modal.querySelector('.cpmu-visor-prev');
        var btnNext = modal.querySelector('.cpmu-visor-next');
        var btnReemp = modal.querySelector('.cpmu-visor-reemplazar');
        var btnElim = modal.querySelector('.cpmu-visor-eliminar');
        var btnCerrar = modal.querySelector('.cpmu-visor-cerrar');

        function renderizar() {
            var lista = (self.estado[indice] && self.estado[indice].ids) || [];
            if (!lista.length) { self._cerrarVisor(); return; }
            if (pos >= lista.length) { pos = lista.length - 1; }
            if (pos < 0) { pos = 0; }
            elCont.textContent = 'Imagen ' + (pos + 1) + ' de ' + lista.length;
            btnPrev.hidden = lista.length <= 1;
            btnNext.hidden = lista.length <= 1;
            var idActual = lista[pos];
            elImg.src = '';
            if (self.config.urlDe) {
                Promise.resolve(self.config.urlDe(idActual)).then(function (url) {
                    if (url && self.visor === modal) { elImg.src = url; }
                }).catch(function () {});
            }
        }

        function ir(delta) {
            var lista = (self.estado[indice] && self.estado[indice].ids) || [];
            if (lista.length <= 1) { return; }
            pos = (pos + delta + lista.length) % lista.length;
            renderizar();
        }

        btnPrev.addEventListener('click', function () { ir(-1); });
        btnNext.addEventListener('click', function () { ir(1); });
        btnCerrar.addEventListener('click', function () { self._cerrarVisor(); });
        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.classList.contains('cpmu-visor-cuerpo')) {
                self._cerrarVisor();
            }
        });
        btnReemp.addEventListener('click', function () {
            self._cerrarVisor();
            self._cambiar(indice, pos, true);
        });
        btnElim.addEventListener('click', function () {
            self._quitar(indice, pos);
            var lista = (self.estado[indice] && self.estado[indice].ids) || [];
            if (!lista.length) { self._cerrarVisor(); return; }
            if (pos >= lista.length) { pos = lista.length - 1; }
            renderizar();
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

        this._onKeyVisor = function (e) {
            if (e.key === 'Escape') { self._cerrarVisor(); }
            else if (e.key === 'ArrowLeft') { ir(-1); }
            else if (e.key === 'ArrowRight') { ir(1); }
        };
        doc.addEventListener('keydown', this._onKeyVisor);
        renderizar();
    };

    CargadorPMU.prototype._cerrarVisor = function () {
        var doc = (this.raiz && this.raiz.ownerDocument) || global.document;
        if (this._onKeyVisor && doc) {
            doc.removeEventListener('keydown', this._onKeyVisor);
            this._onKeyVisor = null;
        }
        if (this.visor && this.visor.parentNode) {
            this.visor.parentNode.removeChild(this.visor);
        }
        this.visor = null;
    };

    /** FR-016 + Spec 021 (D9): "Reemplazar" abre el cargador y reemplaza la foto. */
    CargadorPMU.prototype._cambiar = function (indice, posicion, desdeVisor) {
        this._reemplazo = { indice: indice, posicion: posicion, desdeVisor: !!desdeVisor };
        this._abrir(indice, null);
    };

    CargadorPMU.prototype._quitar = function (indice, posicion) {
        this.estado[indice].ids.splice(posicion, 1);
        this._pintar();
    };

    CargadorPMU.prototype._error = function (mensaje) {
        if (this.txtEstado) {
            this.txtEstado.textContent = mensaje;
        }
        if (this.config.onError) {
            this.config.onError(mensaje);
        }
    };

    /** Lo que publica el campo (FR-033/FR-034). */
    CargadorPMU.prototype.ids = function () {
        return idsPlanos(this.estado);
    };

    CargadorPMU.prototype.estadoActual = function () {
        var est = completo(this.config.ranuras, this.estado);
        return {
            ids: this.ids(),
            listo: est.listo,
            faltan: est.faltan,
            array: esArray(this.config.ranuras),
            ranuras: this.config.ranuras.length
        };
    };

    CargadorPMU.prototype.destruir = function () {
        this._cerrarVisor();
        this.config.ranuras.forEach(function (r, i) {
            var s = this.selectores[i];
            if (s && s.sel && s.sel.destroy) { s.sel.destroy(); }
        }, this);
        if (this.raiz && this.raiz.parentNode) {
            this.raiz.parentNode.removeChild(this.raiz);
        }
        this.raiz = null;
    };

    var API = {
        CargadorPMU: CargadorPMU,
        normalizarRanuras: normalizarRanuras,
        estadoInicial: estadoInicial,
        completo: completo,
        idsPlanos: idsPlanos,
        esArray: esArray,
        FORMAS: FORMAS
    };

    global.CargadorPMU = CargadorPMU;
    if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : globalThis);