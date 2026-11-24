/**
 * cargador-pmu - Cargador de imagenes del comprador (spec 012, T023/T024, US6;
 * spec 021, experiencia intuitiva + visor de coleccion).
 *
 * Un campo con `cargador` muestra uno por bloque sus **ranuras** (D7). Cada
 * ranura abre un `SelectorPMU` y sube el recorte al item del comprador. Este
 * componente NO manda nada al Motor: solo al item, antes de la vista previa.
 *
 * Ranura (spec 021): `{w, h, forma, min, max, r, size, ox, oy, fondo}`.
 * - `forma` (`auto`|`rectangulo`|`circulo`|`cuadrado`|`ovalo`) es la GUIA del
 *   recorte: el PNG sale rectangular `w x h` y el clip real lo aplica el PDF.
 * - `min`/`max`: cuantas imagenes admite la ranura. `completo()` es la logica
 *   pura que informa `{listo, faltan}` (lo publica `estadoActual()`).
 * - `max` es el tope: al llegar, el boton de cargar se apaga.
 *
 * UI: la FICHA queda limpia (sin medidas, sin causas internas ni botones
 * muertos): solo el boton "Cargar imagen", las miniaturas y, si falta alguna
 * foto, un aviso. Los datos tecnicos (medidas/forma/min y los avisos de
 * configuracion de la spec 019) se muestran solo con `tecnico: true`, que es
 * lo que pasa el preview de la consola del admin.
 *
 * Config:
 *   new CargadorPMU(elemento, {
 *     ranuras: [...],
 *     // `subir(blob, ctx)` -> Promise<{id}>: el unico camino que manda bytes.
 *     // `ctx` lleva `{ranura, w, h, forma, params}` (spec 030 D8 + spec 038 F-RECETA:
 *     // `params` son los v2 de la receta, no el hash).
 *     subir: function(blob, ctx) { return Promise.resolve({id:''}); },
 *     // `urlDe(id)` -> URL de la miniatura (endpoint protegido; memoizado afuera).
 *     urlDe: function(id) { return ''; },
 *     onChange: function(estado) {},      // {ids, listo, faltan, minTotal, array, ranuras}
 *     onRecorte: function(id, url, params) {},  // recorte local recien compuesto
 *     onError: function(mensaje) {},
 *     idsIniciales: [[id1], [id2]],       // una entrada por ranura (re-edicion)
 *     envoltura: null,                    // guia PowerClip del recorte
 *     tecnico: false                      // true = muestra medidas/forma/min (consola)
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
            var min = parseInt(r.min, 10);
            if (!isFinite(min) || min < 0) { min = 1; }   // ausente/invalido = 1 (compat)
            var max = parseInt(r.max, 10) || 1;
            // Spec 040 (A1): `0` es valido (campo opcional); solo se corrige lo negativo.
            if (min < 0) { min = 1; }
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
            // Spec 027 (D1/D6): la politica de transparencia la declara el
            // campo. `''` = ausente = comportamiento actual (el cliente decide).
            var transp = (r.transp === 'si') ? 'si' : ((r.transp === 'no') ? 'no' : '');
            // Spec 035 (D1): `phsize` (0..2) y el grupo del hueco viajan al selector
            // para que la receta v2 los lleve: el servidor compone sin adivinar.
            var phsize = Math.max(0, Math.min(2, parseInt(r.phsize, 10) || 0));
            var gid = (typeof r.gid === 'string' && /^[0-9A-Fa-f]{6}$/.test(r.gid))
                ? r.gid.toUpperCase() : '';
            out.push({
                etiqueta: r.etiqueta || '',
                w: w, h: h,
                forma: forma,
                min: min, max: max,
                phsize: phsize,
                gid: gid,
                r: r.r ? 1 : 0,
                size: size,
                ox: ox,
                oy: oy,
                fondo: fondo,
                transp: transp,
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
     * Spec 022 (D1/D3): total EXIGIDO por el campo = suma de los `min` de sus
     * ranuras. Es lo que el navegador declara al agregar al carrito
     * (`pmu_minimos`) para que el servidor lo valide contra los archivos
     * reales del item (el servidor no puede leer las ranuras: viven en el
     * `campo.js` y PHP no evalua JS).
     */
    function minTotal(ranuras) {
        var total = 0;
        (ranuras || []).forEach(function (r) {
            total += Math.max(0, parseInt(r && r.min, 10) || 0);
        });
        return total;
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
            + '.cpmu-tiras{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}'
            + '.cpmu-mini{width:56px;height:56px;border:1px solid #2271b1;background:#f0f6fc;color:#2271b1;font:600 15px/1 system-ui,sans-serif;cursor:pointer;border-radius:4px;position:relative;overflow:hidden;padding:0}'
            + '.cpmu-mini img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
            + '.cpmu-mini-circulo,.cpmu-mini-circle{border-radius:50%}'
            // Spec 039 (D2): miniatura cuya subida FALLO. Se marca y, al tocarla,
            // REINTENTA con el mismo recorte (no abre el visor). El borde rojo y el
            // signo "!" son la senal visible.
            + '.cpmu-mini-fallo{border:2px solid #d63638}'
            + '.cpmu-mini-fallo::before{content:"!";position:absolute;top:2px;right:2px;width:16px;height:16px;line-height:16px;text-align:center;border-radius:50%;background:#d63638;color:#fff;font:700 11px/16px system-ui,sans-serif}'
            + '.cpmu-zona{border:2px dashed #c3c4c7;border-radius:6px;padding:14px;text-align:center;color:#50575e;font-size:13px;cursor:pointer}'
            + '.cpmu-zona-sobre{border-color:#2271b1;background:#f0f6fc}'
            + '.cpmu-zona-llena{opacity:.75}'
            + '.cpmu-falta{margin:6px 0 0;font-size:12.5px;color:#8a6116}'
            + '.cpmu-error{margin:6px 0 0;font-size:12.5px;color:#b32d2d;background:#fdf2f2;border:1px solid #f4c7c7;border-radius:4px;padding:4px 6px}'
            + '.cpmu-falta[hidden]{display:none}'
            // Spec 046 (U7): spinner de "subiendo" en la miniatura.
            + '.cpmu-mini-cargando{background:linear-gradient(90deg,#f0f6fc 0%,#c3c4c7 50%,#f0f6fc 100%);background-size:200% 100%;animation:cpmu-cargando 1.1s linear infinite}'
            + '@keyframes cpmu-cargando{to{background-position:-200% 0}}';
        (doc.head || doc.documentElement).appendChild(st);
    }

    function CargadorPMU(elemento, config) {
        config = config || {};
        this.elemento = elemento;
        this.config = {
            ranuras: config.yaNormalizadas ? (config.ranuras || []) : normalizarRanuras(config.ranuras),
            subir: typeof config.subir === 'function' ? config.subir : null,
            onChange: typeof config.onChange === 'function' ? config.onChange : null,
            onError: typeof config.onError === 'function' ? config.onError : null,
            urlDe: typeof config.urlDe === 'function' ? config.urlDe : null,
            urlDeRespaldo: typeof config.urlDeRespaldo === 'function' ? config.urlDeRespaldo : null,
            // Spec 039 (D6): `usar` y `onFila` se retiraron con la rama de reuso
            // `Elegir` (0 bytes). Ahora SIEMPRE se sube el original.
            preview: !!config.preview,
            // Spec 040 (C1): abrir la ranura sola al montar (el cotizador lo usa para
            // que "Cargar imagen" abra el recorte en UN click).
            autoAbrir: !!config.autoAbrir,
            // `tecnico`: muestra medidas/forma/min y avisos de configuracion.
            // Lo pasa el preview de la consola; la ficha del comprador NO.
            tecnico: !!config.tecnico,
            envoltura: envolturaValida(config.envoltura),
            // Spec 043 (fix 2026-11-22): el constructor arma `this.config` con lista
            // explicita; sin estas lineas se caian los hooks que `tienda.js` pasa
            // (`onRecorte` no llegaba -> `PMU_FICHA.recetas` nunca se poblaba y la
            // vista previa no recibia el recorte local).
            onRecorte: typeof config.onRecorte === 'function' ? config.onRecorte : null
        };
        // Spec 043 (2026-11-22): si el integrador pasa una FUNCION que la allowlist
        // no reconoce, se avisa. Es el fallo silencioso que dejo la tira en `cubrir`.
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            var propioC = this.config;
            Object.keys(config).forEach(function (k) {
                if (typeof config[k] === 'function'
                    && !Object.prototype.hasOwnProperty.call(propioC, k)) {
                    console.warn('[PMU] cargador: funcion de config ignorada: ' + k);
                }
            });
        }
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
        // Spec 046 (U1): los avisos de faltantes arrancan ocultos (se abren al comprar).
        this._avisos = false;
        // Spec 039 (D2): blobs de las subidas que FALLARON, por ranura y posicion.
        // Viven en memoria (moran con la pestana): al tocar la miniatura marcada se
        // reintenta con el MISMO recorte, sin volver a elegir el archivo.
        // { indice: [ { blob, params, error } ] }  (spec 039 D2: blobs de fallos por ranura)
        this._fallos = {};
        // Spec 040 (A6): URLs y RECETAS de las imagenes usadas desde la biblioteca
        // (id conocido): no viajan bytes y la miniatura se pinta sin pedirla.
        this._urls = {};
        // Spec 043 (fix 2026-11-22): `_urls` = ORIGINAL (lo que abre el editor);
        // `_recortes` = blob RECORTADO (lo que ven la miniatura y la vista previa).
        // Mezclarlos hacia que el editor abriera sobre una imagen ya recortada.
        this._recortes = {};
        this.recetas = {};
        // spec 049: recetas del item (id -> params v2) sembradas desde el manifest,
        // asi `_recetaDeContexto` las encuentra tras F5 sin depender de la cache de
        // la biblioteca (que arranca fria y se invalidó al subir).
        if (config.recetasIniciales && typeof config.recetasIniciales === 'object') {
            Object.keys(config.recetasIniciales).forEach(function (k) {
                if (config.recetasIniciales[k] && typeof config.recetasIniciales[k] === 'object') {
                    this.recetas[String(k)] = config.recetasIniciales[k];
                }
            }, this);
        }
        // Spec 046 (U7): placeholders de las subidas en curso (spinner en la tira).
        this._pendientes = {};
    }

    CargadorPMU.prototype.montar = function () {
        if (!this.elemento || this.config.ranuras.length === 0) {
            return false;
        }
        // Spec 038 (D): montar() es IDEMPOTENTE. Antes duplicaba toda la UI (dos
        // `.cpmu` con los mismos handlers) si el consumidor lo llamaba dos veces.
        if (this.raiz && this.raiz.parentNode) {
            return true;
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

        // Aviso de faltantes: aparece SOLO si a alguna ranura le falta una foto
        // (con todo completo no hay nada que decir). Reemplaza al viejo boton
        // "Listo", que era decorativo: no tenia handler y no bloqueaba nada.
        var falta = doc.createElement('p');
        falta.className = 'cpmu-falta';
        falta.hidden = true;
        raiz.appendChild(falta);

        this.elemento.appendChild(raiz);
        this.raiz = raiz;
        this.txtFalta = falta;
        this._pintar();
        // Spec 040 (C1): `autoAbrir` abre la PRIMERA ranura vacia al montar. Es lo que
        // evita el doble click del cotizador: el boton del campo monta el cargador y
        // el modal de recorte aparece ya (sin un segundo toque).
        if (this.config.autoAbrir) {
            for (var i = 0; i < this.config.ranuras.length; i++) {
                if ((this.estado[i] && this.estado[i].ids.length) === 0) {
                    this._abrir(i);
                    break;
                }
            }
        }
        return true;
    };

    /** Spec 040 (C1): abre el selector de una ranura (API publica, sin tocar privados). */
    CargadorPMU.prototype.abrir = function (indice) {
        var i = parseInt(indice, 10);
        this._abrir(isFinite(i) && i >= 0 ? i : 0);
    };

    /** Un bloque por ranura: encabezado tecnico (solo admin), miniaturas, zona. */
    CargadorPMU.prototype._bloque = function (r, i, doc) {
        var self = this;
        var div = doc.createElement('div');
        div.className = 'cpmu-ranura';
        div.setAttribute('data-ranura', String(i));

        // Medidas, forma, min/max y avisos de configuracion (spec 019): SOLO
        // con `tecnico` (el preview de la consola). La ficha del comprador
        // queda limpia: no necesita datos internos ni causas de configuracion.
        if (this.config.tecnico) {
            var tit = doc.createElement('p');
            tit.className = 'cpmu-titulo';
            tit.textContent = r.w + 'x' + r.h + ' px - ' + r.forma
                + ' - min ' + r.min + (r.max > 1 ? ' - hasta ' + r.max : '');
            div.appendChild(tit);
            if (r.aviso) {
                var avi = doc.createElement('p');
                avi.className = 'cpmu-aviso';
                avi.textContent = r.aviso;
                div.appendChild(avi);
            }
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
        }
        // En la ficha la zona es solo el area de carga: el boton la nombra.
        // El arrastrar-y-soltar sigue funcionando aunque no haya cartel.
        var boton = doc.createElement('button');
        boton.type = 'button';
        boton.className = 'button cpmu-agregar';
        boton.textContent = 'Cargar imagen';
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
            var archivos = (dt && dt.files) ? Array.prototype.slice.call(dt.files) : [];
            if (!archivos.length) {
                self._error('Suelta un archivo de imagen.');
                return;
            }
            // Spec 047: con N>1 se omite el editor y se sube el lote.
            if (archivos.length > 1) { self._subirLote(i, archivos); return; }
            self._abrir(i, archivos[0]);
        });

        this.selectores[i] = { boton: boton, tira: tira, zona: zona, sel: null };
        return div;
    };
    /**
     * Abre el `SelectorPMU` de la ranura. `archivo` (opcional) se le pasa al
     * modal para que lo cargue directo (drop zone); sin el, el modal abre el
     * dialogo de archivos por si mismo (spec 021 D8). Si viene de un reemplazo
     * desde la mini galeria, `tituloContexto` avisa que imagen se reemplaza.
     */
    CargadorPMU.prototype._abrir = function (indice, archivo, opciones) {
        var self = this;
        var r = this.config.ranuras[indice];
        var slot = this.selectores[indice];
        if (!r || !slot) { return; }
        // #F5 (fix 2026-11-24): valida el archivo ANTES de abrir el modal (un no-imagen
        // no abre un editor vacio para fallar despues).
        if (archivo && global.SelectorPMU && typeof global.SelectorPMU.esImagen === 'function'
            && !global.SelectorPMU.esImagen(archivo)) {
            this._error('Formato no permitido (usa PNG, JPG, GIF o WebP).');
            return;
        }
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
                // Spec 027 (D3/D6): la politica de transparencia del campo.
                transp: r.transp,
                // Spec 035 (D1): la receta v2 necesita el lienzo declarado y el grupo.
                phsize: r.phsize,
                gid: r.gid,
                // Spec 024 (D2): el badge tecnico solo se ve en la consola.
                tecnico: this.config.tecnico,
                envoltura: this.config.envoltura || null,
                // Spec 047: habilita `multiple` y el tope del lote.
                max: r.max,
                subirLote: function (archivos) { return self._subirLote(indice, archivos); },
                subirAsync: function (blob) {
                    var reemplazo = self._reemplazo;
                    self._reemplazo = null;
                    var pos = reemplazo ? reemplazo.posicion : null;
                    return self._subir(indice, blob, pos).then(function (id) {
                        if (reemplazo && reemplazo.desdeVisor) {
                            self._abrirVisorCompartido(indice, pos);
                        }
                        return id;
                    });
                },
                // Spec 040 (A6): una imagen YA subida (id conocido) no manda bytes:
                // Spec 043 (US1): la receta NUEVA de una foto existente se DECLARA (0 bytes).
                declararReceta: function (id, params) {
                    var claveD = String(id || '');
                    if (claveD === '') { return; }
                    self.recetas[claveD] = params || null;
                },
                // Spec 043 (fix 2026-11-22): receta de una foto para ESTA ranura
                // (memoria -> catalogo -> defaults). La usa la tira al elegir, para
                // que no mande el catalogo (que puede estar desactualizado).
                paramsDe: function (id) { return self._recetaDeContexto(String(id || ''), r); },
                // se anota en la ranura y se publica su receta (0 red, cierre inmediato).
                // Spec 043 (US5): Eliminar la imagen desde el editor (dos pasos si esta en uso).
                eliminar: function () {
                    var reemp = self._reemplazo;
                    if (!reemp) { return Promise.resolve(false); }
                    return self._quitar(reemp.indice, reemp.posicion, true);
                },
                // Spec 046 (U5): "Ver en grande" se retiro del editor.
                usarExistente: function (id, params, url) {
                    return self._usarExistente(indice, id, params, url);
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
        // Spec 039 (D6): el evento `usado` (camino de reuso de la biblioteca, 0 bytes)
        // se retiro con la rama `Elegir`. Ahora SIEMPRE se sube el original y el
        // servidor deduplica por `sha` (D24 de la 035).
        slot.sel.onError(function (mensaje, err) {
            if (err && err.code === 'CROP_ABORTED') {
                var reemp = self._reemplazo;
                self._reemplazo = null;
                if (reemp && reemp.desdeVisor) {
                    self._abrirVisorCompartido(reemp.indice, reemp.posicion);
                }
                return;
            }
            self._error(mensaje);
        });
        // Spec 046 (U2/U6): titulo "Imagen #X" siempre; el reemplazo solo decide
        // el "¿Subir otra?" (esReemplazo), no el titulo.
        var posFoto = this._reemplazo
            ? (parseInt(this._reemplazo.posicion, 10) + 1)
            : (((this.estado[indice] && this.estado[indice].ids.length) || 0) + 1);
        slot.sel.open({
            archivo: archivo || null,
            titulo: 'Imagen #' + posFoto,
            esReemplazo: !!this._reemplazo,
            tituloContexto: this._reemplazo ? ('Reemplazando imagen #' + posFoto) : '',
            // Spec 043 (US2/T022): la receta vigente viaja al editor (paramsIniciales).
            params: (opciones && opciones.params) || null,
            // Spec 043 (US2): en modo edicion NO se abre el selector de archivos.
            abrirArchivo: !(opciones && opciones.editar)
            // Spec 039 (D6): se retiro `usar` (el selector ya no decide `Elegir` vs
            // `Subir`): siempre sube bytes y el servidor deduplica por `sha`.
        });
    };

    /**
     * Spec 038 (F-RECETA): params v2 de la composicion de una ranura.
     *
     * `_params()` vive en la INSTANCIA del selector (`selectores[i].sel`), NO en el
     * slot: leerlo del slot devolvia `{}` y el servidor guardaba la subida sin
     * `receta` (spec 035 D9: sin receta no se puede componer despues).
     */
    CargadorPMU.prototype._paramsDe = function (indice) {
        var slot = this.selectores[indice];
        var sel = slot && slot.sel;
        if (!sel || typeof sel._params !== 'function') { return {}; }
        try {
            return sel._params() || {};
        } catch (e) {
            return {};   // sin imagen todavia: la subida va sin receta (el servidor decide)
        }
    };

    /**
     * Spec 039 (D6): se retiro `_madreDe` (y con el, `madre_origen`). No hay familia
     * que reusar: el servidor deduplica por `sha` (D24 de la 035).
     */
    CargadorPMU.prototype._subir = function (indice, blob, posicion, params) {
        var self = this;
        // #F3 (fix 2026-11-24): un intento nuevo limpia el error anterior (si este
        // sale bien, el rojo viejo no queda pegado).
        this._limpiarError();
        if (!this.config.subir) {
            this._error('No hay donde subir la imagen.');
            return Promise.reject(new Error('No hay donde subir la imagen.'));
        }
        var r = this.config.ranuras[indice];
        // Spec 043 (fix 2026-11-22): el tope de la ranura se respeta y un reemplazo
        // pendiente manda sobre la posicion. Antes se hacia `push` sin mirar `max`
        // (con max=1 y [A] quedaba [A,B]: dos miniaturas donde cabe una) y el
        // `_reemplazo` se ignoraba si llegaba con `posicion` null.
        var posSubida = posicion;
        if ((posSubida === null || posSubida === undefined)
            && this._reemplazo && parseInt(this._reemplazo.indice, 10) === parseInt(indice, 10)) {
            posSubida = parseInt(this._reemplazo.posicion, 10) || 0;
        }
        if (posSubida === null || posSubida === undefined) {
            if (this.estado[indice].ids.length >= r.max) {
                this._error('Solo entran ' + r.max + ' imagen(es) en esta ranura.');
                return Promise.reject(new Error('motor:ranura:llena'));
            }
        }
        // Spec 043 (fix 2026-11-22): la URL del recorte recien compuesto se captura
        // AHORA, antes del POST. `ultimaUrl` vive en la INSTANCIA del selector
        // (`selectores[i].sel`), no en el slot: leer `slot.ultimaUrl` daba
        // undefined y la vista previa nunca recibia el recorte local.
        var selAlSubir = (this.selectores[indice] || {}).sel;
        var urlRecorte = (selAlSubir && selAlSubir.ultimaUrl)
            || (this.selectores[indice] && this.selectores[indice].ultimaUrl) || '';
        var paramsRecorte = (selAlSubir && typeof selAlSubir._params === 'function')
            ? selAlSubir._params() : (params || null);
        var btn = this.selectores[indice].boton;
        btn.disabled = true;
        // Spec 046 (U7): placeholder con spinner en la tira mientras sube.
        var token = {};
        if (!this._pendientes[indice]) { this._pendientes[indice] = []; }
        this._pendientes[indice].push(token);
        this._pintar();
        var paramsSubida = params || this._paramsDe(indice);
        // Spec 043 (fix 2026-11-22): imagen nueva sin receta -> defaults del campo
// (cubrir, escala 1, centro). Antes caia a `{}` y el servidor guardaba sin receta.
        if (!paramsSubida || !Object.keys(paramsSubida).length) {
            paramsSubida = this._recetaLote(r, r.w, r.h);
        }
        return Promise.resolve(this.config.subir(blob, {
            ranura: indice, w: r.w, h: r.h, forma: r.forma,
            // Spec 035 (D9): la RECETA de la composicion viaja con la subida (el
            // servidor la estampa en la fila y despues puede componer sin adivinar).
            // Spec 038 (F-RECETA): `_params` vive en la INSTANCIA del selector
            // (`selectores[i].sel`), NO en el slot: leerlos del slot daba {} y el
            // servidor guardaba la fila SIN receta (imposible componer despues).
            params: paramsSubida
            // Spec 039 (D6): `madre_origen` se retiro con las "familias".
        })).then(function (res) {
            btn.disabled = false;
            self._quitarPendiente(indice, token);
            var id = res && res.id;
            // Spec 040 (A6): la receta con la que se subio queda legible por id
            // (la resuelve `_recetaDeContexto`), igual que la de una imagen usada de la biblioteca.
            if (id) { self.recetas[String(id)] = paramsSubida || null; }
            // Spec 043 (fix): el recorte recien compuesto alimenta la MINiatura
            // (el editor sigue abriendo con el ORIGINAL via `_urls`).
            if (id && urlRecorte) {
                self._recortes = self._recortes || {};
                self._recortes[String(id)] = String(urlRecorte);
            }
            // Spec 042: la biblioteca cambio (nuevo original): se revalida en la proxima apertura.
            if (id && global.PMUBiblioteca && typeof global.PMUBiblioteca.invalidar === 'function') {
                global.PMUBiblioteca.invalidar();
            }
            // Spec 035 (T014/D2): el recorte recien compuesto se queda en el
            // navegador (objectURL) y se publica para que la vista previa dibuje
            // sin red y sin subir copias. La receta es la misma que viajo con la
            // subida: `tienda.js` la manda por instancia al registrar el grupo.
            if (id && typeof self.config.onRecorte === 'function') {
                // Spec 043 (fix): se publica la URL capturada al empezar la subida
                // (el selector ya cerro cuando el POST responde).
                self.config.onRecorte(String(id), String(urlRecorte || ''),
                    paramsRecorte || paramsSubida || null);
            }
            if (!id) {
                self._error('El servidor no devolvio la imagen.');
                throw new Error('El servidor no devolvio la imagen.');
            }
            if (posSubida === null || posSubida === undefined || posSubida >= self.estado[indice].ids.length) {
                if (self.estado[indice].ids.indexOf(String(id)) === -1) {
                    // #F1 (fix 2026-11-24): al COMPLETAR, si la ranura se lleno con subidas
                    // concurrentes, no se supera el `max` (el guard de arranque no
                    // alcanzaba: otra subida pudo completar mientras esta viajava).
                    if (self.estado[indice].ids.length >= r.max) {
                        self._error('La ranura ya esta llena (max ' + r.max + ').');
                    } else {
                        self.estado[indice].ids.push(String(id));
                    }
                } else {
                    // #4 (fix 2026-11-24): la foto (mismo id = mismo contenido) ya
                    // esta en la ranura: no se duplica y se avisa (antes quedaba
                    // [A, A] en silencio). Iguala a `_usarExistente`, que ya deduplica.
                    self._error('Esa foto ya esta cargada en esta ranura.');
                }
            } else {
                self.estado[indice].ids[posSubida] = String(id);
            }
            self._reemplazo = null;
            self._pintar();
            return id;
        }, function (err) {
            btn.disabled = false;
            self._quitarPendiente(indice, token);
            var msg = (err && err.message) || 'No se pudo subir la imagen.';
            // Spec 039 (D2): se GUARDA el blob del recorte (y con que receta se
            // compuso) para que tocar la miniatura marcada reintente sin volver a
            // elegir el archivo.
            self._anotarFallo(indice, {
                blob: blob,
                params: self._paramsDe(indice),
                error: msg
            });
            self._pintar();
            self._error(msg);
            throw err || new Error(msg);
        });
    };
    /** Spec 046 (U7): saca el placeholder de una subida (exito o fallo). */
    CargadorPMU.prototype._quitarPendiente = function (indice, token) {
        var lista = this._pendientes[indice] || [];
        var i = lista.indexOf(token);
        if (i >= 0) { lista.splice(i, 1); }
    };

    /**
     * Spec 047: original acotado al cap del comprador (2000 px de lado mayor),
     * en memoria. Devuelve `{blob, w, h}` o null si no se puede leer.
     */
    CargadorPMU.prototype._originalAcotado = function (archivo) {
        return new Promise(function (resolve) {
            var doc = global.document;
            if (!doc || !global.URL || !global.Image) { resolve(null); return; }
            var url = URL.createObjectURL(archivo);
            var img = new Image();
            img.onload = function () {
                var w = Math.max(1, img.naturalWidth || 1);
                var h = Math.max(1, img.naturalHeight || 1);
                if (global.PMUFotos && typeof global.PMUFotos.medidasAcotadas === 'function') {
                    var m = global.PMUFotos.medidasAcotadas(w, h);
                    if (m && m.w > 0 && m.h > 0) { w = m.w; h = m.h; }
                }
                var cv = doc.createElement('canvas');
                cv.width = w;
                cv.height = h;
                var cx = cv.getContext ? cv.getContext('2d') : null;
                if (!cx) { URL.revokeObjectURL(url); resolve(null); return; }
                cx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                if (!cv.toBlob) { resolve(null); return; }
                cv.toBlob(function (blob) {
                    resolve(blob ? { blob: blob, w: w, h: h } : null);
                }, 'image/webp', 0.85);
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    };

    /**
     * Spec 047 (U2): receta v2 por defecto del lote (`cubrir`, escala 1, centro).
     * Mismas claves que `SelectorPMU._params()`.
     */
    CargadorPMU.prototype._recetaLote = function (r, w, h) {
        return {
            v: 2,
            w: r.w,
            h: r.h,
            forma: String(r.forma || 'auto'),
            modo: 'cubrir',
            escala: 1,
            ox: 0.5,
            oy: 0.5,
            fondo: (r.transp === 'no') ? '#ffffff' : 'transparent',
            transp: String(r.transp || ''),
            rot: 0,
            iw: Math.max(1, parseInt(w, 10) || 1),
            ih: Math.max(1, parseInt(h, 10) || 1),
            phsize: Math.max(0, Math.min(2, parseInt(r.phsize, 10) || 0)),
            gid: String(r.gid || '').toUpperCase()
        };
    };

    /** Spec 047: sube UN archivo del lote con la receta por defecto. */
    CargadorPMU.prototype._subirArchivo = function (indice, archivo) {
        var self = this;
        var r = this.config.ranuras[indice];
        return Promise.resolve(this._originalAcotado(archivo)).then(function (res) {
            if (!res || !res.blob) {
                self._error('No se pudo leer la imagen.');
                return null;
            }
            return self._subir(indice, res.blob, null, self._recetaLote(r, res.w, res.h));
        });
    };

    /**
     * Spec 047: lote de N archivos. Respeta el `max` de la ranura, avisa si sobran
     * y sigue aunque uno falle (cada fallo queda marcado en su miniatura).
     */
    CargadorPMU.prototype._subirLote = function (indice, archivos) {
        var self = this;
        var r = this.config.ranuras[indice];
        this._reemplazo = null;
        // #F1 (fix 2026-11-24): el lote descuenta las subidas EN VUELO, no solo las ya
        // guardadas. Antes (solo ids) dos lotes superpuestos pasaban del `max`.
        var enVuelo = (this._pendientes[indice] || []).length;
        var libres = Math.max(0, r.max - this.estado[indice].ids.length - enVuelo);
        var lista = Array.prototype.slice.call(archivos || []);
        // Spec 047 (T016): el mismo archivo elegido dos veces entra UNA vez.
        // Identidad = nombre + bytes + fecha (sin leer el archivo ni usar crypto:
        // el caso real es arrastrar o elegir el mismo archivo dos veces).
        var vistos = {};
        var repetidos = 0;
        lista = lista.filter(function (a) {
            // Sin identidad usable (ni nombre ni bytes) NO se deduplica: es mejor
            // subir una de mas que perder una imagen.
            if (!a || (!a.name && !a.size)) { return true; }
            var k = String((a && a.name) || '') + '|' + ((a && a.size) || 0) + '|' + ((a && a.lastModified) || 0);
            if (vistos[k]) { repetidos++; return false; }
            vistos[k] = true;
            return true;
        });
        if (repetidos > 0) {
            this._error('Se omitio ' + repetidos + ' archivo(s) repetido(s) del lote.');
        }
        if (lista.length > libres) {
            this._error('Solo entran ' + libres + ' imagen(es) en esta ranura.');
            lista = lista.slice(0, libres);
        }
        return lista.reduce(function (p, archivo) {
            return p.then(function () {
                return self._subirArchivo(indice, archivo).catch(function () { });
            });
        }, Promise.resolve()).then(function () { return true; });
    };

    /**
     * Spec 045 (T018): objetivo de una ranura `{aspecto}-{familia}-{area}`.
     * Familia: 1 = circulo/ovalo, 0 = resto (el PH manda; `auto` no se guarda).
     */

    // Spec 044: implementacion canonica compartida (`assets/receta-objetivo.js`).
    // Sin fallback local: si el modulo no esta cargado, se avisa y se corta.
    function ro() {
        if (!global.PMURecetaObjetivo) {
            throw new Error('receta-objetivo.js no esta cargado (spec 044)');
        }
        return global.PMURecetaObjetivo;
    }
    function objetivoDe(r) { return ro().objetivoDe(r); }
    function parseObjetivo(clave) { return ro().parseObjetivo(clave); }
    function mejorReceta(recetas, obj) { return ro().mejorReceta(recetas, obj); }

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
            // Spec 039 (D2): las subidas que FALLARON quedan como miniaturas marcadas
            // al final de la tira. No son ids (no existen en el servidor): el comprador
            // las ve, las toca y REINTENTA con el mismo recorte.
            (self._fallos[i] || []).forEach(function (f, m) {
                var miniF = doc.createElement('button');
                miniF.type = 'button';
                miniF.className = 'cpmu-mini cpmu-mini-' + r.forma + ' cpmu-mini-fallo';
                miniF.setAttribute('data-pmu-fallo', '1');
                miniF.title = 'Reintentar subida';
                miniF.textContent = '!';
                miniF.addEventListener('click', function () {
                    self._miniTocar(i, self.estado[i].ids.length + m, miniF);
                });
                slot.tira.appendChild(miniF);
            });
            // Spec 046 (U7): las subidas en curso quedan como miniaturas con spinner.
            (self._pendientes[i] || []).forEach(function () {
                var miniP = doc.createElement('span');
                miniP.className = 'cpmu-mini cpmu-mini-cargando';
                miniP.setAttribute('aria-label', 'Subiendo imagen');
                slot.tira.appendChild(miniP);
            });
            slot.boton.disabled = (n + (self._pendientes[i] || []).length) >= r.max;
            slot.zona.classList.toggle('cpmu-zona-llena', n > 0);
        });
        // Aviso SOLO si falta algo: con todo completo no se dice nada (antes
        // decia "Listo: N imagen(es)." y hacia ruido).
        var est = completo(this.config.ranuras, this.estado);
        if (this.txtFalta) {
            // Spec 046 (U1): el aviso arranca OCULTO; se muestra al intentar comprar.
            var mostrar = this._avisos && !est.listo;
            this.txtFalta.hidden = !mostrar;
            this.txtFalta.textContent = mostrar
                ? 'Faltan ' + est.faltan + ' imagen(es) por cargar.'
                : '';
        }
        if (this.config.onChange) {
            this.config.onChange(this.estadoActual());
        }
    };

    /**
     * Spec 040 (A6): usa una imagen YA EXISTENTE del comprador (id conocido).
     *
     * No manda bytes: anota el id en la ranura (sin duplicar), guarda su receta y
     * publica `onRecorte` para que la vista previa/mockup la dibujen al instante.
     * Si la ranura esta llena devuelve un rechazo con causa (el selector lo pinta).
     */
    CargadorPMU.prototype._usarExistente = function (indice, id, params, url) {
        var self = this;
        var r = this.config.ranuras[indice];
        var clave = String(id || '');
        if (!r || clave === '') {
            return Promise.reject(new Error('Imagen invalida.'));
        }
        if (url) {
            this._recortes = this._recortes || {};
            this._recortes[clave] = String(url);
        }
        var ids = this.estado[indice].ids;
        // Spec 045 (A1): si hay un reemplazo PENDIENTE de esta ranura, el id va a
        // ESA posicion y el contexto se limpia. Antes se agregaba al final (o se
        // rechazaba con la ranura llena): la foto editada quedaba y la siguiente
        // subida la pisaba.
        var reemplazo = this._reemplazo;
        if (reemplazo && parseInt(reemplazo.indice, 10) === parseInt(indice, 10)) {
            var pos = Math.max(0, Math.min(ids.length - 1, parseInt(reemplazo.posicion, 10) || 0));
            if (ids.length === 0) { ids.push(clave); } else { ids[pos] = clave; }
            this._reemplazo = null;
            this.recetas[clave] = params || null;
            this._pintar();
            if (typeof this.config.onRecorte === 'function') {
                this.config.onRecorte(clave, String(url || ''), params || null);
            }
            if (reemplazo.desdeVisor) {
                this._abrirVisorCompartido(indice, Math.min(pos, ids.length - 1));
            }
            return Promise.resolve(clave);
        }
        if (ids.indexOf(clave) === -1) {
            if (ids.length >= r.max) {
                return Promise.reject(new Error('La ranura ya esta llena.'));
            }
            ids.push(clave);
        }
        this.recetas[clave] = params || null;
        this._pintar();
        if (typeof this.config.onRecorte === 'function') {
            this.config.onRecorte(clave, String(url || ''), params || null);
        }
        return Promise.resolve(clave);
    };

    /**
     * Spec 043 (US1/T017) + fix 2026-11-22: RESOLVE UNICO de la receta.
     * Orden: memoria del cargador -> catalogo del comprador (recetas por contexto)
     * -> null (defaults del campo). La clave es el objetivo `{aspecto}-{familia}-{area}` (spec 047).
     * Lo usan los tres caminos: miniatura (`_editar`), tira (`paramsDe`) y visor
     * (Elegir -> `elegir()` -> `onElegir` -> `paramsDe`). Un camino nuevo tiene que
     * pasar por aca; `_recetaDeFoto` es solo el respaldo de catalogo.
     */
    CargadorPMU.prototype._recetaDeContexto = function (id, r) {
        var clave = String(id || '');
        if (clave === '') { return null; }
        if (this.recetas[clave]) { return this.recetas[clave]; }
        var obj = objetivoDe(r);
        try {
            var bib = (global.PMUBiblioteca && typeof global.PMUBiblioteca.cache === 'function')
                ? global.PMUBiblioteca.cache() : null;
            var fotos = (bib && bib.fotos) || [];
            for (var i = 0; i < fotos.length; i++) {
                if (String(fotos[i] && fotos[i].id) !== clave) { continue; }
                // Spec 045: recetas por objetivo (exacta o la mas cercana).
                var mejor = mejorReceta((fotos[i] && fotos[i].recetas) || {}, obj);
                if (mejor) { return mejor; }
                // Ajustes del cliente = ultima receta aceptada.
                var ajustes = (fotos[i] && fotos[i].ajustes) || null;
                if (ajustes && ajustes.configuracion) { return ajustes.configuracion; }
                break;
            }
        } catch (e) { /* sin catalogo: defaults del campo */ }
        return null;
    };

    CargadorPMU.prototype._pintarMini = function (mini, id) {
        var self = this;
        if (!this.config.urlDe && !this._urls[String(id)]
            && !((this._recortes || {})[String(id)])) { return; }
        var pintada = String(mini._pmuMiniUrl || '');
        var conocida = (this._recortes || {})[String(id)] || this._urls[String(id)] || '';
        var pedir = conocida || (this.config.urlDe ? this.config.urlDe(id) : '');
        Promise.resolve(pedir).then(function (url) {
            if (!url) { return; }
            // Spec 043 (fix 2026-11-22): si la URL no cambio, no se repinta.
            if (pintada === String(url)) { return; }
            var doc = mini.ownerDocument || global.document;
            var img = doc.createElement('img');
            img.alt = '';
            // Spec 042: si la URL liviana falla, se reintenta una vez con la actual.
            var respaldo = (self.config.urlDeRespaldo && id)
                ? String(self.config.urlDeRespaldo(String(id))) : '';
            if (respaldo) {
                img.onerror = function () {
                    img.onerror = null;
                    if (img.src !== respaldo) { img.src = respaldo; }
                };
            }
            img.src = url;
            mini._pmuMiniUrl = String(url);
            mini._pmuMiniImg = true;
            mini.innerHTML = '';
            mini.appendChild(img);
        }).catch(function () { /* queda el numero */ });
    };

    /**
     * Spec 030 (D28): tocar una miniatura abre el visor COMPARTIDO
     * (`assets/visor-pmu.js`), no uno propio. Los `items` van con la URL YA
     * RESUELTA (`config.urlDe` esta memoizado en `tienda.js`, D23), asi que navegar
     * no hace ninguna peticion: ese era el motivo de la lentitud. Acciones de la
     * ranura: Reemplazar y Eliminar.
     */
    /**
     * Spec 039 (D2): fallo de subida de una MINIATURA MARCADA, o null.
     *
     * Las miniaturas de fallo van **despues** de los ids reales de la tira: su
     * posicion es `estado[indice].ids.length + m`. Los ids (fotos que SI existen en
     * el servidor) nunca tienen fallo.
     */
    CargadorPMU.prototype._falloEn = function (indice, posicion) {
        var i = parseInt(indice, 10);
        var p = parseInt(posicion, 10);
        var ids = (this.estado[i] && this.estado[i].ids) || [];
        var lista = (this._fallos && this._fallos[i]) || [];
        if (p < ids.length) { return null; }          // es un id real: no hay fallo
        var f = lista[p - ids.length];
        return (f && f.blob) ? f : null;
    };

    /** Anota un fallo (o lo quita, con `null`) en la lista de la ranura. */
    CargadorPMU.prototype._anotarFallo = function (indice, fallo) {
        var i = parseInt(indice, 10);
        if (!this._fallos[i]) { this._fallos[i] = []; }
        if (fallo) { this._fallos[i].push(fallo); } else { this._fallos[i] = []; }
    };

    /**
     * Spec 039 (D2): reintenta la subida de una miniatura marcada con el MISMO blob
     * (el recorte que el comprador ya compuso). Si no hay blob (recarga de pagina)
     * devuelve false y el llamador abre el EDITOR (spec 043 US2).
     */
    CargadorPMU.prototype._reintentar = function (indice, posicion) {
        var fallo = this._falloEn(indice, posicion);
        if (!fallo || !this.config.subir) { return false; }
        var self = this;
        var slot = this.selectores[indice];
        if (!slot) { return false; }
        if (slot.boton) { slot.boton.disabled = true; }
        if (this.txtError) { this.txtError.hidden = true; }
        // `_subir` con `posicion` NULA: la foto entra como NUEVA (el fallo no tenia
        // id que reemplazar). Al tener exito se limpia la marca.
        this._subir(indice, fallo.blob, null).then(function () {
            self._anotarFallo(indice, null);
            self._pintar();
        }, function () {
            // Sigue fallando: se quita la miniatura vieja y se anota la nueva (sin
            // duplicar la marca).
            self._anotarFallo(indice, null);
            self._pintar();
        });
        return true;
    };

    CargadorPMU.prototype._miniTocar = function (indice, posicion) {
        // Spec 039 (D2): si esta miniatura fallo, el toque REINTENTA (no abre el
        // visor): el blob del recorte sigue en memoria.
        if (this._reintentar(indice, posicion)) { return Promise.resolve(true); }
        return this._editar(indice, posicion);
    };

    /** Abre el visor compartido con las fotos de ESTE hueco (D28/D23). */
    /**
     * Spec 043 (US2/T020-T022): tocar una miniatura abre el EDITOR con esa imagen y
     * su receta vigente del contexto (no el visor). Carga la foto existente por
     * `cargarDesdeBiblioteca`, asi Guardar es 0 bytes y la edicion reemplaza
     * la posicion de la tira.
     */
    CargadorPMU.prototype._editar = function (indice, posicion) {
        var self = this;
        var pos = Math.max(0, parseInt(posicion, 10) || 0);
        var ids = (this.estado[indice] && this.estado[indice].ids) || [];
        var id = ids[pos];
        if (!id) { return Promise.resolve(false); }
        var r = this.config.ranuras[indice];
        var params = this._recetaDeContexto(id, r);
        var url = this._urls[String(id)] || (this.config.urlDe ? this.config.urlDe(id) : '');
        this._reemplazo = { indice: indice, posicion: pos, desdeVisor: false };
        this._abrir(indice, null, { params: params, editar: true });
        var slot = this.selectores[indice];
        if (!slot || !slot.sel) { return Promise.resolve(false); }
        return Promise.resolve(url).then(function (u) {
            if (!u) {
                // B3 (spec 045): foto de la biblioteca que no vive en el item:
                // usar la URL del catalogo del comprador antes de rendirse.
                var bib = (global.PMUBiblioteca && typeof global.PMUBiblioteca.cache === 'function')
                    ? global.PMUBiblioteca.cache() : null;
                var foto = ((bib && bib.fotos) || []).filter(function (x) {
                    return String(x && x.id) === String(id);
                })[0];
                u = foto ? String(foto.url || '') : '';
            }
            // #F4 (fix 2026-11-24): sin URL no se abre el editor vacio: se cierra y se
            // avisa con causa (antes el toque sobre la miniatura no hacia NI decia nada).
            if (!u) {
                self._reemplazo = null;
                if (slot.sel && typeof slot.sel.close === 'function') { slot.sel.close(); }
                self._error('No se pudo abrir la foto para editar.');
                return false;
            }
            self._urls[String(id)] = String(u);   // queda memoizada para el visor
            return slot.sel.cargarDesdeBiblioteca({ id: String(id), url: String(u), params: params })
                .then(function (ok) {
                    // N1 (fix 2026-11-24): si la imagen no se pudo traer (fetch 403/404/red),
                    // cargarDesdeBiblioteca resuelve false: se cierra el editor y se avisa
                    // (antes quedaba el modal ABIERTO y vacio, sin feedback).
                    if (ok === false) {
                        self._reemplazo = null;
                        if (slot.sel && typeof slot.sel.close === 'function') { slot.sel.close(); }
                        self._error('No se pudo abrir la imagen. Revisa tu conexion e intenta de nuevo.');
                    }
                    return ok;
                });
        }).catch(function () {
            // N1: ante una excepcion inesperada, cerrar y avisar (no dejar el modal vacio).
            self._reemplazo = null;
            if (slot.sel && typeof slot.sel.close === 'function') { slot.sel.close(); }
            self._error('No se pudo abrir la imagen. Revisa tu conexion e intenta de nuevo.');
            return false;
        });
    };

CargadorPMU.prototype._abrirVisorCompartido = function (indice, posicion) {
        var self = this;
        var ids = (this.estado[indice] && this.estado[indice].ids) || [];
        if (!ids.length) { return Promise.resolve(false); }
        if (!global.PMUVisor || !this.config.urlDe) {
            // El visor PROPIO del cargador se retiro (spec 020, T014): el compartido
            // (`visor-pmu.js`) se encola siempre. Sin el se avisa CON LA CAUSA y la ficha
            // sigue funcionando (nunca un fallo mudo).
            if (global.console && global.console.warn) {
                global.console.warn('[PMU] visor no disponible: falta PMUVisor o config.urlDe.');
            }
            return Promise.resolve(false);
        }
        var pos = Math.max(0, Math.min(ids.length - 1, parseInt(posicion, 10) || 0));
        // B1/B3 (spec 045): primero la URL YA resuelta (`_urls`, la que funciono al
        // cargar la foto); despues el pool del item. Antes se pedia siempre al pool,
        // asi que una foto de la biblioteca (que no vive en el item) daba 404 y el
        // visor no abria.
        var resolver = function (id) {
            var memo = self._urls[String(id)] || '';
            if (memo) { return Promise.resolve(memo); }
            var pedir = self.config.urlDe ? self.config.urlDe(id) : '';
            return Promise.resolve(pedir).then(function (u) {
                if (u) { self._urls[String(id)] = String(u); }
                return u;
            });
        };
        return Promise.all(ids.map(function (id) { return resolver(id); }))
            .then(function (urls) {
                var items = [];
                ids.forEach(function (id, i) {
                    if (urls[i]) { items.push({ url: String(urls[i]), etiqueta: String(id) }); }
                });
                if (!items.length) { return false; }
                return global.PMUVisor.abrir({
                    items: items,
                    indice: (pos < items.length) ? pos : 0,
                    titulo: 'En este campo',
                    acciones: [
                        { etiqueta: 'Reemplazar', clase: 'button-primary',
                            onAccion: function (p) { global.PMUVisor.cerrar(); self._cambiar(indice, p, true); } },
                        // Spec 039 (D1): `Eliminar` pide confirmacion con el mini-dialogo
                        // propio del visor. Tras borrar NO se reabre (antes el visor volvía
                        // a abrirse con la posicion corrida y el comprador veía la foto
                        // siguiente sin entender qué pasó). Si queda al menos una, el visor
                        // sigue abierto en la posicion que corresponda; si era la ultima, se
                        // cierra y se vuelve a la tira.
                        { etiqueta: 'Eliminar', clase: 'pmu-visor-peligro', confirmar: true,
                            pregunta: 'Borrar esta imagen?',
                            textoOk: 'Borrar',
                            onAccion: function (p) {
                                // `_quitar` devuelve una promesa (borra en el servidor):
                                // solo se repinta/reabre el visor si la baja salio bien.
                                Promise.resolve(self._quitar(indice, p)).then(function (ok) {
                                    if (ok === false) { return; }   // fallo: se avisa y no se saca
                                    var restantes = (self.estado[indice] && self.estado[indice].ids) || [];
                                    if (restantes.length && global.PMUVisor) {
                                        global.PMUVisor.cerrar();
                                        self._abrirVisorCompartido(indice, Math.min(p, restantes.length - 1));
                                    } else if (global.PMUVisor) {
                                        global.PMUVisor.cerrar();
                                    }
                                });
                            } }
                    ]
                });
            });
    };

    /* (v1 retirada en la spec 020, T014: el visor propio `cpmu-visor` del cargador ya NO
       existe. La ranura usa el visor COMPARTIDO `PMUVisor` — que delega en `MU.visor` del
       tema cuando esta — y si falta se avisa con causa en `_abrirVisorCompartido`.) */
        /* (fin de `_abrirVisor`: retirado) */

    /* (`_cablearVisor`: retirado con el visor propio, spec 020 T014) */

    /* (`_cerrarVisor`: retirado con el visor propio) */

    /** FR-016 + Spec 021 (D9): "Reemplazar" abre el cargador y reemplaza la foto. */
    CargadorPMU.prototype._cambiar = function (indice, posicion, desdeVisor) {
        this._reemplazo = { indice: indice, posicion: posicion, desdeVisor: !!desdeVisor };
        this._abrir(indice, null);
    };

    /**
     * Spec 039 (D3): quita la foto de la ranura Y la borra del servidor.
     *
     * Antes era un `splice` local: la fila del manifest y el archivo compartido
     * quedaban hasta que el TTL del item vencia (30 dias). Ahora se pide la baja
     * (`PMU_API.borrarFoto` -> `op=borrar`): si el borrado falla, se avisa CON LA
     * CAUSA y la miniatura NO se saca (asi el comprador no pierde la foto por un
     * error de red y puede reintentar).
     *
     * @param {number} indice  ranura
     * @param {number} posicion posicion dentro de la tira
     * @returns {Promise<boolean>} true si se quito
     */
    CargadorPMU.prototype._quitar = function (indice, posicion, preguntar) {
        var self = this;
        var ids = (this.estado[indice] && this.estado[indice].ids) || [];
        var id = ids[parseInt(posicion, 10)];
        var quitarLocal = function () {
            self.estado[indice].ids.splice(posicion, 1);
            self._pintar();
            return true;
        };
        // Spec 047 (Q3): "Quitar" en el editor retira la foto de la RANURA (no de la
        // biblioteca) y cierra el modal; el borrado del archivo vive en el visor
        // de "Mis imagenes" (con confirmacion si esta en uso).
        if (preguntar) { return Promise.resolve(quitarLocal()); }
        // Sin consumidor de red (preview del admin, o sin `borrarFoto`): solo local.
        var tieneBaja = (global.PMU_API && typeof global.PMU_API.borrarFoto === 'function');
        if (!tieneBaja || !id) {
            return Promise.resolve(quitarLocal());
        }
        var baja = function (confirmar) {
            return Promise.resolve(global.PMU_API.borrarFoto(String(id), confirmar));
        };
        return baja(false).then(function () {
            return quitarLocal();
        }, function (err) {
            // Spec 040 (T020): el servidor pide confirmacion (esta en carrito o en un
            // pedido). El visor ya la mostro: se reintenta con `confirmar=1`.
            if (err && err.referencias) {
                // Sin `preguntar`, el visor ya mostro el dialogo (039 D1): se reintenta.
                if (!preguntar) {
                    return baja(true).then(function () {
                        return quitarLocal();
                    });
                }
                // Spec 043 (US5/D5): desde el editor se pregunta ACA, solo si esta en uso.
                if (!global.PMUVisor || typeof global.PMUVisor.confirmar !== 'function') {
                    self._error((err && err.message) || 'No se pudo borrar la imagen.');
                    return false;
                }
                return global.PMUVisor.confirmar({
                    titulo: 'Esta imagen esta en uso',
                    detalle: 'Se usa en un carrito o pedido. Si la borras, ese pedido deja de poder regenerarse.',
                    textoOk: 'Borrar igual'
                }).then(function (si) {
                    if (!si) { return false; }
                    return baja(true).then(function () {
                        return quitarLocal();
                    }, function () { return false; });
                });
            }
            var msg = (err && err.message) || 'No se pudo borrar la imagen.';
            self._error(msg);
            return false;
        });
    };

    /**
     * Spec 038 (D): el ERROR tiene su propia linea (`cpmu-error`). Antes reusaba el
     * aviso de "Faltan N imagen(es)": un fallo se leia como un faltante y, al
     * repintar, el mensaje desaparecia sin que nadie lo viera.
     */
    CargadorPMU.prototype._error = function (mensaje) {
        if (this.raiz) {
            if (!this.txtError) {
                var doc = this.raiz.ownerDocument || global.document;
                this.txtError = doc.createElement('p');
                this.txtError.className = 'cpmu-error';
                this.txtError.setAttribute('role', 'alert');
                this.raiz.appendChild(this.txtError);
            }
            this.txtError.textContent = String(mensaje || 'No se pudo completar la operacion.');
        }
        if (this.config.onError) {
            this.config.onError(mensaje);
        }
    };

    /** Lo que publica el campo (FR-033/FR-034). */
    /** Spec 046 (U1): muestra los avisos de faltantes (los llama la ficha al comprar). */
    CargadorPMU.prototype._limpiarError = function () {
        // #F3 (fix 2026-11-24): el error rojo quedaba pegado tras un fallo ya
        // resuelto. Se oculta/vacia al empezar un intento nuevo o al completarlo.
        if (this.txtError) {
            this.txtError.hidden = true;
            this.txtError.textContent = '';
        }
    };

    CargadorPMU.prototype.mostrarAvisos = function () {
        this._avisos = true;
        this._pintar();
    };

    CargadorPMU.prototype.ids = function () {
        return idsPlanos(this.estado);
    };

    CargadorPMU.prototype.estadoActual = function () {
        var est = completo(this.config.ranuras, this.estado);
        return {
            ids: this.ids(),
            listo: est.listo,
            faltan: est.faltan,
            // Spec 022 (D3): total exigido por el campo (suma de los `min`).
            minTotal: minTotal(this.config.ranuras),
            array: esArray(this.config.ranuras),
            ranuras: this.config.ranuras.length
        };
    };

    CargadorPMU.prototype.destruir = function () {
        // Spec 038 (D): se limpian los selectores para que un segundo `destruir()`
        // no llame `destroy()` dos veces sobre el mismo modal.
        var sel = this.selectores || [];
        this.selectores = [];
        sel.forEach(function (s) {
            if (s && s.sel && s.sel.destroy) {
                try { s.sel.destroy(); } catch (e) { /* el modal ya se cerro */ }
            }
        });
        if (this.raiz && this.raiz.parentNode) {
            this.raiz.parentNode.removeChild(this.raiz);
        }
        this.raiz = null;
        this.txtFalta = null;
    };

    var API = {
        CargadorPMU: CargadorPMU,
        normalizarRanuras: normalizarRanuras,
        estadoInicial: estadoInicial,
        completo: completo,
        minTotal: minTotal,
        idsPlanos: idsPlanos,
        esArray: esArray,
        objetivoDe: objetivoDe,
        parseObjetivo: parseObjetivo,
        mejorReceta: mejorReceta,
        FORMAS: FORMAS
    };

    global.CargadorPMU = CargadorPMU;
    if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : globalThis);