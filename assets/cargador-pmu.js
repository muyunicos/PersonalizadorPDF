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

    var FORMAS = ['circle', 'square', 'rect', 'fit'];

    /**
     * Normaliza las ranuras que llegan del campo. Una ranura invalida (sin w/h)
     * se descarta; si no queda ninguna, la lista es vacia y el campo no monta
     * cargador (no inventa medidas).
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
            out.push({
                w: w, h: h,
                forma: FORMAS.indexOf(r.forma) !== -1 ? r.forma : 'rect',
                min: min, max: max
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
            // Spec 019 (FR-006): aviso informativo de la ranura (nunca bloquea).
            + '.cpmu-aviso{margin:0 0 8px;font-size:11.5px;color:#8a6116;background:#fcf9e8;'
            + 'border:1px solid #f0e6c0;border-radius:4px;padding:4px 6px}'
            + '.cpmu-guia{display:inline-block;margin:0 0 8px;padding:6px 8px;border:1px dashed #c3c4c7;border-radius:4px}'
            + '.cpmu-guia-tit{margin:0 0 4px;font-size:11.5px;color:#646970}'
            + '.cpmu-guia-canvas{display:block;background:#fff}'
            + '.cpmu-tiras{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}'
            + '.cpmu-mini{width:56px;height:56px;border:1px solid #2271b1;background:#f0f6fc;'
            + 'color:#2271b1;font:600 15px/1 system-ui,sans-serif;cursor:pointer;border-radius:4px;'
            + 'position:relative;overflow:hidden;padding:0}'
            + '.cpmu-mini img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
            + '.cpmu-mini-alto{outline:3px solid #d63638;outline-offset:1px}'
            + '.cpmu-mini-cambiar{font-size:11px;min-height:28px;padding:2px 8px}'
            + '.cpmu-mini-circle{border-radius:50%}'
            + '.cpmu-zona{border:2px dashed #c3c4c7;border-radius:6px;padding:14px;text-align:center;'
            + 'color:#50575e;font-size:13px;cursor:pointer}'
            + '.cpmu-zona-sobre{border-color:#2271b1;background:#f0f6fc}'
            + '.cpmu-zona-llena{opacity:.75}'
            + '.cpmu-pie{display:flex;align-items:center;gap:10px;margin-top:6px}'
            + '.cpmu-estado{font-size:12px;color:#50575e}'
            + '.cpmu-listo[disabled]{opacity:.6;cursor:not-allowed}';
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
            // Spec 016 (FR-015): el llamador resuelve la URL de cada id (el
            // componente no conoce el endpoint). Sin urlDe, la mini queda con
            // el numero (fallback, nunca una mini rota).
            urlDe: typeof config.urlDe === 'function' ? config.urlDe : null,
            // Spec 012 (T011b/FR-009): en el preview de la consola se DIBUJAN las
            // ranuras sin subir nada (ni boton, ni arrastre, ni endpoint).
            preview: !!config.preview,
            // Guia del cargador (envoltura del grupo, opcion b): pista visual
            // del recorte que aplicara el clip del PDF.
            envoltura: envolturaValida(config.envoltura)
        };
        this.estado = estadoInicial(this.config.ranuras);
        // FR-017: al re-editar, los ids guardados se restauran en sus ranuras
        // (uno por ranura, acotado por `max`). idsIniciales = [[ids]...].
        if (Array.isArray(config.idsIniciales)) {
            config.idsIniciales.forEach(function (ids, i) {
                if (this.estado[i] && Array.isArray(ids) && this.config.ranuras[i]) {
                    this.estado[i].ids = ids.map(String).slice(0, this.config.ranuras[i].max);
                }
            }, this);
        }
        this.selectores = []; // un SelectorPMU por ranura
        this.raiz = null;
        this._reemplazo = null;   // FR-016: {indice, posicion} al "cambiar"
        this._temporizador = null;
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
        boton.addEventListener('click', function () { self._abrir(i, null); });
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
        // FR-016: "Cambiar" reabre con la ranura llena (reemplaza); subir de
        // cero sigue respetando el tope `max`.
        if (!this._reemplazo && slot.tira.querySelectorAll('.cpmu-mini').length >= r.max) { return; }

        if (!slot.sel && typeof global.SelectorPMU !== 'function') {
            this._error('Falta selector-pmu.js: no se puede cargar la imagen.');
            return;
        }
        if (!slot.sel) {
            slot.sel = new global.SelectorPMU(null, {
                finalW: r.w,
                finalH: r.h,
                aspectRatio: (r.forma === 'fit' ? null : r.w / r.h),
                mode: (r.forma === 'fit' ? 'fit' : 'crop'),
                // Guia de la envoltura dentro del modal (spec 016 F6): misma
                // geometria que la tira, nunca premascara el PNG.
                envoltura: this.config.envoltura || null
            });
        }
        slot.sel.onSelect(function () {
            var blob = slot.sel.obtenerBlob();
            if (!blob) {
                self._error('No se pudo generar el recorte.');
                return;
            }
            var reemplazo = self._reemplazo;
            self._reemplazo = null;
            self._subir(indice, blob, reemplazo ? reemplazo.posicion : null);
        });
        slot.sel.onError(function (mensaje) { self._error(mensaje); });
        slot.sel.open();

        if (archivo) {
            try {
                var doc = this.raiz.ownerDocument || global.document;
                var input = doc.querySelector('.spmu-file');
                if (input) {
                    var dt = new global.DataTransfer();
                    dt.items.add(archivo);
                    input.files = dt.files;
                    input.dispatchEvent(new global.Event('change', { bubbles: true }));
                }
            } catch (e) {
                // Sin DataTransfer (navegador viejo): el modal queda abierto y
                // el comprador elige el archivo con el boton. No es un error.
            }
        }
    };

    /** Sube el blob al item y, si el servidor devuelve id, lo anota. */
    CargadorPMU.prototype._subir = function (indice, blob, posicion) {
        var self = this;
        if (!this.config.subir) {
            this._error('No hay donde subir la imagen.');
            return;
        }
        var r = this.config.ranuras[indice];
        var btn = this.selectores[indice].boton;
        btn.disabled = true;
        Promise.resolve(this.config.subir(blob, {
            ranura: indice, w: r.w, h: r.h, forma: r.forma
        })).then(function (res) {
            btn.disabled = false;
            var id = res && res.id;
            if (!id) {
                self._error('El servidor no devolvio la imagen.');
                return;
            }
            // FR-016: con `posicion` la foto REEMPLAZA (no suma); sin el,
            // se agrega al final (flujo de siempre).
            if (posicion === null || posicion === undefined || posicion >= self.estado[indice].ids.length) {
                self.estado[indice].ids.push(String(id));
            } else {
                self.estado[indice].ids[posicion] = String(id);
            }
            self._limpiarAlto();
            self._pintar();
        }, function (err) {
            btn.disabled = false;
            self._error((err && err.message) || 'No se pudo subir la imagen.');
        });
    };
/** Repinta miniaturas, contadores y el boton de "Listo" (D16). */
    CargadorPMU.prototype._pintar = function () {
        var self = this;
        this._limpiarAlto();
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
                mini.title = 'Tocar para quitar o cambiar';
                // FR-015: miniatura real (la foto); el numero es el fallback
                // mientras la URL se resuelve (o si no hay urlDe).
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

    /**
     * FR-015: pinta la foto real en la mini. `urlDe(id)` la resuelve (el
     * componente no conoce el endpoint); si falla, queda el numero (nunca una
     * mini rota).
     */
    CargadorPMU.prototype._pintarMini = function (mini, id) {
        if (!this.config.urlDe || mini._pmuMiniImg) { return; }
        var self = this;
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

    /** FR-016: la 1era tocada marca para confirmar; la 2da quita. Ofrece Cambiar. */
    CargadorPMU.prototype._miniTocar = function (indice, posicion, mini) {
        var self = this;
        if (mini.classList.contains('cpmu-mini-alto')) {
            this._quitar(indice, posicion);
            return;
        }
        this._limpiarAlto();
        mini.classList.add('cpmu-mini-alto');
        var doc = mini.ownerDocument || global.document;
        var cambiar = doc.createElement('button');
        cambiar.type = 'button';
        cambiar.className = 'cpmu-mini-cambiar';
        cambiar.textContent = 'Cambiar';
        cambiar.addEventListener('click', function (e) {
            e.stopPropagation();
            self._cambiar(indice, posicion);
        });
        mini.parentNode.insertBefore(cambiar, mini.nextSibling);
        mini._pmuBtnCambiar = cambiar;
        if (this._temporizador) { clearTimeout(this._temporizador); }
        this._temporizador = setTimeout(function () { self._limpiarAlto(); }, 3000);
    };

    /** FR-016: "Cambiar" reabre el editor y REEMPLAZA la foto (no suma). */
    CargadorPMU.prototype._cambiar = function (indice, posicion) {
        this._reemplazo = { indice: indice, posicion: posicion };
        this._limpiarAlto();
        this._abrir(indice, null);
    };

    /** Saca el estado "confirmado" de todas las minis (y su boton Cambiar). */
    CargadorPMU.prototype._limpiarAlto = function () {
        if (!this.raiz) { return; }
        var minis = this.raiz.querySelectorAll('.cpmu-mini-alto');
        [].slice.call(minis).forEach(function (m) {
            m.classList.remove('cpmu-mini-alto');
            if (m._pmuBtnCambiar && m._pmuBtnCambiar.parentNode) {
                m._pmuBtnCambiar.parentNode.removeChild(m._pmuBtnCambiar);
            }
            m._pmuBtnCambiar = null;
        });
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
        if (this._temporizador) { clearTimeout(this._temporizador); this._temporizador = null; }
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