/**
 * selector-pmu - Componente cliente para subir, ajustar y recortar imagenes
 * de campos de personalizacion (spec 004, contrato contracts/selector-pmu.md;
 * editor visual spec 016, contrato contracts/selector-visual.md).
 *
 * El TAMANO FINAL en px lo define el campo/PDF (`finalW`/`finalH`): el cliente
 * carga la imagen para editarla y al aceptar el ajuste al marco se genera la
 * version recortada a ese tamano (sin limite de peso de origen).
 *
 * spec 016 (F1-F3): el modo `crop` usa Cropper.js 1.6.2 vendoreado
 * (`assets/vendor/cropper/`, handle `personalizador-pdf-cropper`) cuando esta
 * cargado: pan, pinch-zoom 1x-8x, doble tap, rotar 90 (boton y gesto de 2
 * dedos), guia de tercios y zona fuera atenuada; la salida sale de
 * `getCroppedCanvas(finalW, finalH)` con la rotacion aplicada. SIN Cropper
 * degrada al editor original (canvas + slider + select). El modo `fit`
 * conserva SIEMPRE el canvas original (Cropper no tiene contain, D9).
 *
 * Sin dependencias (JS puro; Cropper es opcional y solo se usa si esta).
 * El componente NO sube nada: entrega el blob recortado al llamador (que lo
 * envia al item del comprador).
 *
 * Uso:
 *   var sel = new SelectorPMU('#campo33', {finalW:500, finalH:500, aspectRatio:1});
 *   sel.onSelect(function (url, meta) { ... });   // url = objectURL del recorte
 *   sel.on('error', function (e) { ... });        // {code, message}
 *   sel.open();
 */
(function (global) {
    'use strict';

    var TIPOS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    var EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    var ACEPTA = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg';
    var ZOOM_MIN = 1;
    var ZOOM_MAX = 8;

    /**
     * Envoltura valida `{par, subs}` (normalizada 0..1) o null. Es una GUIA
     * visual del recorte final (PowerClip del PDF): NUNCA se dibuja en el
     * lienzo de salida; el clip real lo aplica el PDF al procesar.
     */
    function envolturaValida(e) {
        if (!e || !e.subs || !e.subs.length) { return null; }
        return { par: e.par ? 1 : 0, subs: e.subs };
    }

    function SelectorPMU(elemento, config) {
        config = config || {};
        this.elemento = elemento || null;
        this.config = {
            finalW: parseInt(config.finalW, 10) || 0,
            finalH: parseInt(config.finalH, 10) || 0,
            aspectRatio: config.aspectRatio || null,
            mode: config.mode === 'fit' ? 'fit' : 'crop',
            category: config.category || '',
            // D4: pipeline de ajustes futuro (hoy vacio; nadie lo consume).
            ajustes: Array.isArray(config.ajustes) ? config.ajustes : [],
            // Envoltura (PowerClip del PDF, spec 011 FR-049): guia opcional.
            envoltura: envolturaValida(config.envoltura)
        };
        if (this.config.finalW < 1 || this.config.finalH < 1) {
            throw new Error('selector-pmu: finalW/finalH son obligatorios (los define el campo/PDF).');
        }
        this.onSelectCallback = null;
        this.onErrorCallback = null;
        this.oyentes = {};
        this.raiz = null;
        this.imagen = null;
        this.archivoOrigen = null;
        this.desplazamiento = { x: 0, y: 0 };
        this.zoom = 1;
        this._arrastrando = null;
        this._onKey = null;
        this.cropper = null;
        this._gesto = null;        // rotacion por gesto de 2 dedos (FR-010)
        this._focoPrevio = null;   // focus trap (FR-005)
        this.cvEnvoltura = null;   // overlay de la guia (canvas SEPARADO)
        this.ctxEnvoltura = null;
        this._onResize = null;     // re-mide la guia (DPR/movil)
    }

    SelectorPMU.prototype.on = function (evento, cb) {
        this.oyentes[evento] = cb;
        if (evento === 'error') { this.onErrorCallback = cb; }
        return this;
    };

    SelectorPMU.prototype.onSelect = function (callback) {
        this.onSelectCallback = callback;
        return this;
    };

    SelectorPMU.prototype.onError = function (callback) {
        this.onErrorCallback = callback;
        return this;
    };

    SelectorPMU.prototype._emitir = function (evento, dato) {
        if (typeof this.oyentes[evento] === 'function') { this.oyentes[evento](dato); }
    };

    SelectorPMU.prototype._fallo = function (code, message) {
        var e = { code: code, message: message };
        if (typeof this.onErrorCallback === 'function') { this.onErrorCallback(message, e); }
        this._emitir('error', e);
    };

    /** Abre el editor (canvas final = finalW x finalH; crop con Cropper si esta). */
    SelectorPMU.prototype.open = function () {
        var self = this;
        if (this.raiz) { return; }
        inyectarEstilos();
        this._focoPrevio = document.activeElement || null;
        this.raiz = document.createElement('div');
        this.raiz.className = 'spmu-modal';
        this.raiz.innerHTML =
            '<div class="spmu-caja" role="dialog" aria-modal="true" aria-label="Ajustar imagen">' +
            '<div class="spmu-cabecera">' +
            '<p class="spmu-titulo">Ajusta la imagen al marco ' + this.config.finalW + 'x' + this.config.finalH + ' px</p>' +
            '<button type="button" class="spmu-x" aria-label="Cerrar">&#10005;</button>' +
            '</div>' +
            '<div class="spmu-escena"></div>' +
            '<div class="spmu-guia-host"></div>' +
            '<p class="spmu-badge"><span class="spmu-origen"></span><span class="spmu-salida"></span></p>' +
            '<p class="spmu-controles">' +
            '<label class="spmu-lb-zoom">Zoom <input type="range" class="spmu-zoom" min="' + ZOOM_MIN + '" max="' + ZOOM_MAX + '" step="0.01" value="1"></label>' +
            '<label>Modo <select class="spmu-modo">' +
            '<option value="crop"' + (this.config.mode === 'crop' ? ' selected' : '') + '>Recortar al marco</option>' +
            '<option value="fit"' + (this.config.mode === 'fit' ? ' selected' : '') + '>Encajar completo</option>' +
            '</select></label>' +
            '</p>' +
            '<p class="spmu-acciones">' +
            '<input type="file" class="spmu-file" accept="' + ACEPTA + '" hidden>' +
            '<input type="file" class="spmu-camara-file" accept="' + ACEPTA + '" capture="environment" hidden>' +
            '<button type="button" class="button spmu-elegir">Elegir imagen</button>' +
            '<button type="button" class="button spmu-camara">Camara</button>' +
            '<button type="button" class="button spmu-rotar" hidden>Rotar</button>' +
            '<button type="button" class="button button-primary spmu-ok" disabled>Aceptar</button>' +
            '<button type="button" class="button-link spmu-cancelar">Cancelar</button>' +
            '</p>' +
            '<p class="spmu-status" role="status"><button type="button" class="button spmu-reintentar" hidden>Reintentar</button></p>' +
            '</div>';
        document.body.appendChild(this.raiz);
        document.body.classList.add('spmu-bloqueado');

        var $ = function (sel) { return self.raiz.querySelector(sel); };
        this.escena = $('.spmu-escena');
        // Host de la guia en `crop` (caja de preview debajo del recorte): si
        // estuviera dentro del escena, seria un segundo flex-item y lo aplastaria.
        this.guiaHost = $('.spmu-guia-host');
        this.txtOrigen = $('.spmu-origen');
        this.txtSalida = $('.spmu-salida');

        $('.spmu-x').addEventListener('click', function () { self._cancelar(); });
        $('.spmu-elegir').addEventListener('click', function () { $('.spmu-file').click(); });
        $('.spmu-camara').addEventListener('click', function () { $('.spmu-camara-file').click(); });
        $('.spmu-reintentar').addEventListener('click', function () { $('.spmu-file').click(); });
        $('.spmu-file').addEventListener('change', function () { self._cargar(this.files && this.files[0]); });
        $('.spmu-camara-file').addEventListener('change', function () { self._cargar(this.files && this.files[0]); });
        $('.spmu-zoom').addEventListener('input', function () {
            self.zoom = parseFloat(this.value) || 1;
            if (!self._conCropper()) { self._dibujar(); }
        });
        $('.spmu-modo').addEventListener('change', function () {
            self.config.mode = this.value === 'fit' ? 'fit' : 'crop';
            self._montarEscena();
        });
        $('.spmu-rotar').addEventListener('click', function () { self._rotar(); });
        $('.spmu-ok').addEventListener('click', function () { self._aceptar(); });
        $('.spmu-cancelar').addEventListener('click', function () { self._cancelar(); });

        // FR-003: soltar el archivo sobre el modal (drop zone).
        var caja = $('.spmu-caja');
        caja.addEventListener('dragover', function (e) {
            e.preventDefault();
            caja.classList.add('spmu-sobre');
        });
        caja.addEventListener('dragleave', function () { caja.classList.remove('spmu-sobre'); });
        caja.addEventListener('drop', function (e) {
            e.preventDefault();
            caja.classList.remove('spmu-sobre');
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) { self._cargar(f); }
        });
        // Clic fuera del dialogo cierra (comodo en movil).
        this.raiz.addEventListener('click', function (e) {
            if (e.target === self.raiz) { self._cancelar(); }
        });

        this._onKey = function (e) {
            if (e.key === 'Escape') { self._cancelar(); return; }
            if (e.key === 'Tab' && self.raiz) { self._trampaFoco(e); }
        };
        document.addEventListener('keydown', this._onKey);

        this._montarEscena();
        // La guia se re-mide con el layout (DPR y movil): un listener por
        // apertura, removido en close(). Sin envoltura no se registra nada.
        if (this.config.envoltura) {
            this._onResize = function () { self._pintarEnvoltura(); };
            global.addEventListener('resize', this._onResize);
        }
    };

    /** Cierra por cancelacion: misma via que el boton Cancelar. */
    SelectorPMU.prototype._cancelar = function () {
        this.close();
        this._fallo('CROP_ABORTED', 'Cancelado por el usuario');
    };

    /** Con Cropper: modo crop y la libreria cargada (FR-006 degrada sin ella). */
    SelectorPMU.prototype._conCropper = function () {
        return this.config.mode === 'crop' && typeof global.Cropper === 'function';
    };

    /** Estilos del dialogo (idempotente, sin archivo CSS extra). */
    var ESTILO_ID = 'spmu-estilos';
    function inyectarEstilos() {
        if (document.getElementById(ESTILO_ID)) { return; }
        var s = document.createElement('style');
        s.id = ESTILO_ID;
        s.textContent =
            // z-index 180000: POR ENCIMA del drawer (160000) y del preview (170000)
            // de la consola. El modal se cuelga del `body` del documento donde corre
            // el script, y en el admin ese documento es el de la consola: con 100000
            // el drawer lo tapaba y el recorte no se podia usar.
            '.spmu-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:180000;display:flex;align-items:center;justify-content:center;padding:16px}' +
            '.spmu-bloqueado{overflow:hidden}' +
            '.spmu-caja{box-sizing:border-box;background:#fff;max-width:min(92vw,640px);max-height:92vh;overflow:auto;padding:16px;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.35);position:relative}' +
            '.spmu-sobre{outline:3px dashed #2271b1;outline-offset:-6px}' +
            '.spmu-cabecera{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}' +
            '.spmu-titulo{margin:0;font-weight:600}' +
            '.spmu-x{border:0;background:none;font-size:18px;line-height:1;cursor:pointer;padding:8px;min-width:44px;min-height:44px;color:#50575e}' +
            '.spmu-escena{position:relative;display:flex;justify-content:center;align-items:center;touch-action:none;cursor:move;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/24px 24px;height:min(52vh,440px);min-height:200px;overflow:hidden}' +
            '.spmu-canvas{max-width:100%;max-height:100%;height:auto;display:block}' +
            '.spmu-envoltura{position:absolute;pointer-events:none;display:block}' +
            '.spmu-guia-host{text-align:center}' +
            '.spmu-guia-caja{margin:8px 0 0;text-align:center}' +
            '.spmu-preview-caja{position:relative;display:inline-block;overflow:hidden;border:1px solid #c3c4c7;border-radius:4px;background:#fff}' +
            '.spmu-preview{position:absolute;inset:0;overflow:hidden}' +
            '.spmu-guia-leyenda{margin:4px 0 0;font-size:12px;color:#646970}' +
            '.spmu-crop{width:100%;height:100%}' +
            '.spmu-crop img{display:block;max-width:100%}' +
            '.spmu-badge{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:6px 0 0;color:#50575e;font-size:12px}' +
            '.spmu-controles{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0}' +
            '.spmu-acciones{display:flex;gap:8px;align-items:center;margin:8px 0 0;flex-wrap:wrap}' +
            '.spmu-camara{display:none}' +
            '.spmu-status{margin:8px 0 0;color:#555;font-size:12px;min-height:16px}' +
            '.spmu-reintentar{margin-left:8px}' +
            '.spmu-cargando .spmu-escena{opacity:.45}' +
            '.spmu-cargando .spmu-escena::after{content:"";position:absolute;inset:0;margin:auto;width:36px;height:36px;border:4px solid #c3c4c7;border-top-color:#2271b1;border-radius:50%;animation:spmu-giro 1s linear infinite}' +
            '@keyframes spmu-giro{to{transform:rotate(360deg)}}' +
            '@media (max-width:767px){' +
            '.spmu-modal{padding:0;align-items:stretch}' +
            '.spmu-caja{max-width:none;width:100%;height:100vh;height:100dvh;max-height:none;border-radius:0;padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));display:flex;flex-direction:column}' +
            '.spmu-escena{flex:1;height:auto;min-height:0}' +
            '.spmu-crop{height:100%}' +
            '.spmu-camara{display:inline-block}' +
            '.spmu-acciones .button,.spmu-acciones .button-link{min-height:44px}' +
            '}' +
            '@media (min-width:768px){.spmu-camara{display:none}}';
        document.head.appendChild(s);
    }

    /** Carga el archivo elegido validando tipo (allowlist real del contrato). */
    SelectorPMU.prototype._cargar = function (archivo) {
        var self = this;
        if (!archivo) { return; }
        var tipo = String(archivo.type || '');
        var ext = String(archivo.name || '').split('.').pop().toLowerCase();
        if (TIPOS.indexOf(tipo) === -1 && EXTS.indexOf(ext) === -1) {
            this._fallo('INVALID_TYPE', 'Formato no permitido');
            return;
        }
        this._estado('cargando');
        this._emitir('progress', { percentage: 10 });
        var url = URL.createObjectURL(archivo);
        var img = new Image();
        img.onload = function () {
            if (self.imagen && self.imagen.src && self.imagen.src !== url) { URL.revokeObjectURL(self.imagen.src); }
            self.imagen = img;
            self.archivoOrigen = archivo;
            self.desplazamiento = { x: 0, y: 0 };
            self.zoom = 1;
            var rango = self.raiz ? self.raiz.querySelector('.spmu-zoom') : null;
            if (rango) { rango.value = '1'; }
            var ok = self.raiz ? self.raiz.querySelector('.spmu-ok') : null;
            if (ok) { ok.disabled = false; }
            self._estado(null);
            if (self._conCropper()) {
                self._montarCropper();
            } else {
                self._dibujar();
            }
            self._badge();
            self._emitir('progress', { percentage: 100 });
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            self._estado('error');
            self._fallo('UPLOAD_FAILED', 'No se pudo leer la imagen');
        };
        img.src = url;
    };

    /**
     * FR-004: estado de carga/error en la barra de estado (nunca un modal en
     * blanco). 'cargando' pinta el spinner; 'error' muestra el reintento.
     */
    SelectorPMU.prototype._estado = function (estado) {
        if (!this.raiz) { return; }
        var st = this.raiz.querySelector('.spmu-status');
        var caja = this.raiz.querySelector('.spmu-caja');
        var re = this.raiz.querySelector('.spmu-reintentar');
        if (caja) { caja.classList.toggle('spmu-cargando', estado === 'cargando'); }
        if (estado === 'cargando') {
            if (st) { st.textContent = 'Cargando imagen...'; }
            if (re) { re.hidden = true; }
        } else if (estado === 'error') {
            if (st) { st.textContent = 'No se pudo leer la imagen.'; }
            if (re) { re.hidden = false; }
        } else {
            if (st) { st.textContent = ''; }
            if (re) { re.hidden = true; }
        }
    };

    /** Dibuja el encuadre actual en el canvas final (finalW x finalH). */
    SelectorPMU.prototype._dibujar = function () {
        if (!this.ctx) { return; }
        var w = this.config.finalW;
        var h = this.config.finalH;
        this.ctx.clearRect(0, 0, w, h);
        if (!this.imagen) { return; }
        var iw = this.imagen.naturalWidth || 1;
        var ih = this.imagen.naturalHeight || 1;
        var escala = (this.config.mode === 'fit')
            ? Math.min(w / iw, h / ih) * this.zoom
            : Math.max(w / iw, h / ih) * this.zoom;
        var dw = iw * escala;
        var dh = ih * escala;
        var dx = (w - dw) / 2 + (this.config.mode === 'crop' ? this.desplazamiento.x : 0);
        var dy = (h - dh) / 2 + (this.config.mode === 'crop' ? this.desplazamiento.y : 0);
        this.ctx.drawImage(this.imagen, dx, dy, dw, dh);
        this._badge();
    };

    /**
     * Arma la escena segun la rama: Cropper (crop + libreria) o el canvas
     * original (fit o degradacion). Se llama al abrir y al cambiar de modo.
     */
    SelectorPMU.prototype._montarEscena = function () {
        var self = this;
        if (!this.raiz || !this.escena) { return; }
        this._destruirCropper();
        this.escena.innerHTML = '';
        var rotar = this.raiz.querySelector('.spmu-rotar');
        var lbZoom = this.raiz.querySelector('.spmu-lb-zoom');
        if (rotar) { rotar.hidden = !this._conCropper(); }
        if (lbZoom) { lbZoom.hidden = this._conCropper(); }
        if (this._conCropper()) {
            this.escena.innerHTML = '<div class="spmu-crop"><img class="spmu-img" alt=""></div>';
            if (this.guiaHost) {
                this.guiaHost.innerHTML = this._htmlGuiaEnvoltura();
            }
            if (this.imagen) { this._montarCropper(); }
            this._badge();
            this._montarEnvoltura();
            return;
        }
        if (this.guiaHost) { this.guiaHost.innerHTML = ''; }
        this.escena.innerHTML =
            '<canvas class="spmu-canvas" width="' + this.config.finalW + '" height="' + this.config.finalH + '"></canvas>'
            + (this.config.envoltura
                ? '<canvas class="spmu-envoltura" aria-hidden="true"></canvas>'
                : '');
        this.canvas = this.escena.querySelector('.spmu-canvas');
        this.ctx = this.canvas.getContext('2d');
        // Arrastre original (fit y degradacion): pointer events con captura.
        this.escena.addEventListener('pointerdown', function (e) {
            if (self.config.mode !== 'crop') { return; }
            self._arrastrando = { x: e.clientX, y: e.clientY, dx: self.desplazamiento.x, dy: self.desplazamiento.y };
            if (self.escena.setPointerCapture) { self.escena.setPointerCapture(e.pointerId); }
        });
        this.escena.addEventListener('pointermove', function (e) {
            if (!self._arrastrando) { return; }
            var caja = self.canvas.getBoundingClientRect();
            var escala = caja.width > 0 ? self.canvas.width / caja.width : 1;
            self.desplazamiento.x = self._arrastrando.dx + (e.clientX - self._arrastrando.x) * escala;
            self.desplazamiento.y = self._arrastrando.dy + (e.clientY - self._arrastrando.y) * escala;
            self._dibujar();
        });
        this.escena.addEventListener('pointerup', function () { self._arrastrando = null; });
        this._dibujar();
        this._montarEnvoltura();
    };

    /**
     * HTML de la guia (solo con envoltura): en `crop` es una CAJA DE PREVIEW en
     * vivo (Cropper pinta ahi el recorte) con el overlay como HERMANO, para que
     * Cropper no lo toque. Sin envoltura no agrega nada al DOM (FR-022).
     */
    SelectorPMU.prototype._htmlGuiaEnvoltura = function () {
        if (!this.config.envoltura) { return ''; }
        var w = this.config.finalW;
        var h = this.config.finalH;
        var esc = Math.min(1, 160 / Math.max(1, Math.max(w, h)));
        var pw = Math.max(40, Math.round(w * esc));
        var ph = Math.max(40, Math.round(h * esc));
        return '<div class="spmu-guia-caja">'
            + '<div class="spmu-preview-caja" style="width:' + pw + 'px;height:' + ph + 'px">'
            + '<div class="spmu-preview"></div>'
            + '<canvas class="spmu-envoltura" aria-hidden="true"></canvas>'
            + '</div>'
            + '<p class="spmu-guia-leyenda">La forma azul es el recorte final del PDF.</p>'
            + '</div>';
    };

    /** Toma el canvas de la guia (si existe) y lo pinta en el proximo frame. */
    SelectorPMU.prototype._montarEnvoltura = function () {
        this.cvEnvoltura = null;
        this.ctxEnvoltura = null;
        if (!this.config.envoltura) { return; }
        var cv = this.guiaHost ? this.guiaHost.querySelector('.spmu-envoltura') : null;
        if (!cv && this.escena) { cv = this.escena.querySelector('.spmu-envoltura'); }
        if (!cv) { return; }
        this.cvEnvoltura = cv;
        this.ctxEnvoltura = cv.getContext('2d');
        // El layout puede no estar listo (modal recien montado): siguiente frame.
        var self = this;
        if (global.requestAnimationFrame) {
            global.requestAnimationFrame(function () { self._pintarEnvoltura(); });
        } else {
            this._pintarEnvoltura();
        }
    };

    /**
     * Rect (CSS px) del area de RESULTADO dentro del escena: la caja de preview
     * en `crop` o el canvas de salida en `fit`/degradacion.
     */
    SelectorPMU.prototype._cajaEnvoltura = function () {
        // `crop`: la caja de preview (padre del overlay). `fit`: el canvas.
        var pc = this.cvEnvoltura ? this.cvEnvoltura.parentNode : null;
        if (pc && pc.classList && pc.classList.contains('spmu-preview-caja')) {
            return { x: 0, y: 0, w: pc.clientWidth, h: pc.clientHeight };
        }
        if (!this.escena || !this.canvas) { return null; }
        var r = this.canvas.getBoundingClientRect();
        var e = this.escena.getBoundingClientRect();
        return { x: r.left - e.left, y: r.top - e.top, w: r.width, h: r.height };
    };

    /**
     * Pinta la guia: oscurece SOLO lo que queda fuera de la forma (relleno +
     * destination-out) y dibuja su contorno. Reusa la geometria del nucleo
     * (`comandosEnvoltura`/`trazarEnvoltura`: una sola fuente). No toca el
     * lienzo de salida (FR-023).
     */
    SelectorPMU.prototype._pintarEnvoltura = function () {
        var cv = this.cvEnvoltura;
        var ctx = this.ctxEnvoltura;
        var env = this.config.envoltura;
        if (!cv || !ctx || !env) { return; }
        var core = global.PMUMockup;
        if (!core || typeof core.comandosEnvoltura !== 'function'
            || typeof core.trazarEnvoltura !== 'function') {
            cv.width = 0;   // sin nucleo: sin guia (degrada, nunca lanza)
            cv.height = 0;
            return;
        }
        var caja = this._cajaEnvoltura();
        if (!caja || caja.w < 1 || caja.h < 1) { return; }   // layout no listo
        var dpr = global.devicePixelRatio || 1;
        cv.style.left = (caja.x || 0) + 'px';
        cv.style.top = (caja.y || 0) + 'px';
        cv.style.width = caja.w + 'px';
        cv.style.height = caja.h + 'px';
        cv.width = Math.max(1, Math.round(caja.w * dpr));
        cv.height = Math.max(1, Math.round(caja.h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, caja.w, caja.h);
        var cmds = core.comandosEnvoltura(env, { x: 0, y: 0, w: caja.w, h: caja.h });
        if (!cmds.length) { return; }
        ctx.fillStyle = 'rgba(0,0,0,.38)';
        ctx.fillRect(0, 0, caja.w, caja.h);
        ctx.globalCompositeOperation = 'destination-out';
        core.trazarEnvoltura(ctx, cmds);
        ctx.fill(env.par ? 'evenodd' : 'nonzero');
        ctx.globalCompositeOperation = 'source-over';
        core.trazarEnvoltura(ctx, cmds);
        ctx.strokeStyle = '#2271b1';
        ctx.lineWidth = 1.5;
        if (ctx.setLineDash) { ctx.setLineDash([5, 4]); }
        ctx.stroke();
        if (ctx.setLineDash) { ctx.setLineDash([]); }
    };

    /** Instancia Cropper sobre la imagen cargada (FR-007..FR-012). */
    SelectorPMU.prototype._montarCropper = function () {
        var self = this;
        var img = this.escena.querySelector('.spmu-img');
        if (!img || !this.imagen) { return; }
        this._destruirCropper();
        img.src = this.imagen.src;
        var opciones = {
            viewMode: 1,
            aspectRatio: this.config.aspectRatio || NaN,
            autoCropArea: 1,
            rotatable: true,
            zoomable: true,
            zoomOnWheel: true,
            zoomOnTouch: true,
            responsive: true,
            guides: true,
            background: true,
            checkOrientation: true,
            dblclick: true,        // FR-009: doble tap/clic alterna encuadre/100%
            wheelZoomRatio: 0.05
        };
        // FR-022: con envoltura, el recorte se ve EN VIVO en la caja de preview
        // (la guia va encima, en un canvas hermano).
        var prev = this.escena.querySelector('.spmu-preview');
        if (prev) { opciones.preview = prev; }
        this.cropper = new global.Cropper(img, opciones);
        if (img._pmuSelCableado) { return; }
        img._pmuSelCableado = true;
        img.addEventListener('cropmove', function (ev) { self._gestoRotar(ev); self._badge(); });
        img.addEventListener('cropend', function () { self._gesto = null; });
        img.addEventListener('zoom', function () { self._badge(); });
        img.addEventListener('ready', function () { self._badge(); });
    };

    /**
     * FR-010: rotacion por gesto de 2 dedos. Cropper trata el pinch como zoom;
     * el MISMO touchmove con 2 dedos sirve para rotar: se calcula el angulo
     * entre los dedos y el delta se aplica con rotateTo(). Zoom y rotacion
     * conviven (como en las apps de fotos).
     */
    SelectorPMU.prototype._gestoRotar = function (ev) {
        if (!this.cropper || !ev || !ev.detail || !ev.detail.originalEvent) { return; }
        var t = ev.detail.originalEvent.touches;
        if (!t || t.length !== 2) { this._gesto = null; return; }
        var angulo = Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX);
        if (this._gesto === null) { this._gesto = angulo; return; }
        var delta = (angulo - this._gesto) * 180 / Math.PI;
        if (Math.abs(delta) < 1) { return; }   // umbral anti-ruido
        this._gesto = angulo;
        this.cropper.rotateTo((this.cropper.getData().rotate || 0) + delta);
    };

    /** FR-010: boton Rotar 90 grados. */
    SelectorPMU.prototype._rotar = function () {
        if (this.cropper) { this.cropper.rotate(90); this._badge(); }
    };

    /** FR-013: badge en vivo "Origen WxH px" + "Salida WxH px · zoom xN". */
    SelectorPMU.prototype._badge = function () {
        if (this.txtOrigen && this.imagen) {
            this.txtOrigen.textContent = 'Origen ' + this.imagen.naturalWidth + 'x' + this.imagen.naturalHeight + ' px';
        }
        if (!this.txtSalida) { return; }
        var z;
        if (this._conCropper() && this.cropper) {
            var d = this.cropper.getImageData();
            z = (d && d.scaleX > 0) ? d.scaleX : 1;
        } else {
            z = this.zoom;
        }
        this.txtSalida.textContent =
            'Salida ' + this.config.finalW + 'x' + this.config.finalH + ' px · zoom x' + z.toFixed(1);
    };

    /** FR-005: el foco cicla dentro del dialogo (Tab / Shift+Tab). */
    SelectorPMU.prototype._trampaFoco = function (e) {
        var caja = this.raiz ? this.raiz.querySelector('.spmu-caja') : null;
        if (!caja) { return; }
        var focos = [].slice.call(
            caja.querySelectorAll('button, input:not([type=file]), select, [tabindex]:not([tabindex="-1"])')
        ).filter(function (el) { return !el.hidden && !el.disabled; });
        if (!focos.length) { e.preventDefault(); return; }
        var primero = focos[0];
        var ultimo = focos[focos.length - 1];
        var activo = document.activeElement;
        if (!caja.contains(activo)) {
            e.preventDefault();
            (e.shiftKey ? ultimo : primero).focus();
            return;
        }
        if (activo === ultimo && !e.shiftKey) { e.preventDefault(); primero.focus(); }
        else if (activo === primero && e.shiftKey) { e.preventDefault(); ultimo.focus(); }
    };

    /** Genera el blob recortado al tamano final y lo entrega al llamador. */
    SelectorPMU.prototype._aceptar = function () {
        var self = this;
        if (!this.imagen) {
            this._fallo('UPLOAD_FAILED', 'No hay imagen para guardar');
            return;
        }
        var ok = this.raiz ? this.raiz.querySelector('.spmu-ok') : null;
        if (ok) { ok.disabled = true; }
        var terminar = function (blob) {
            if (!blob) {
                if (ok) { ok.disabled = false; }
                self._fallo('UPLOAD_FAILED', 'No se pudo generar el recorte');
                return;
            }
            var url = URL.createObjectURL(blob);
            var meta = {
                width: self.config.finalW,
                height: self.config.finalH,
                fileSize: blob.size,
                type: 'image/png',
                mode: self.config.mode,
                original: {
                    width: self.imagen.naturalWidth,
                    height: self.imagen.naturalHeight,
                    name: (self.archivoOrigen && self.archivoOrigen.name) || 'imagen'
                }
            };
            self.ultimoBlob = blob;
            self.ultimaUrl = url;
            if (typeof self.onSelectCallback === 'function') { self.onSelectCallback(url, meta); }
            self._emitir('success', { url: url, width: meta.width, height: meta.height, fileSize: meta.fileSize });
            self.close();
        };
        // FR-011: con Cropper la salida sale de getCroppedCanvas al tamano
        // EXACTO (rotacion aplicada). Sin Cropper (fit o degradacion), el
        // canvas original.
        var lienzo = this.canvas || null;
        if (this._conCropper() && this.cropper) {
            lienzo = this.cropper.getCroppedCanvas({
                width: this.config.finalW,
                height: this.config.finalH,
                imageSmoothingQuality: 'high'
            });
        }
        if (!lienzo) {
            if (ok) { ok.disabled = false; }
            this._fallo('UPLOAD_FAILED', 'No se pudo generar el recorte');
            return;
        }
        if (lienzo.toBlob) {
            lienzo.toBlob(terminar, 'image/png');
        } else {
            // Fallback sin toBlob: dataURL -> blob.
            var bin = atob(lienzo.toDataURL('image/png').split(',')[1]);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
            terminar(new Blob([bytes], { type: 'image/png' }));
        }
    };

    /** Ultimo recorte generado (el llamador lo sube al pool del item). */
    SelectorPMU.prototype.obtenerBlob = function () {
        return this.ultimoBlob || null;
    };

    SelectorPMU.prototype.close = function () {
        if (this._onKey) {
            document.removeEventListener('keydown', this._onKey);
            this._onKey = null;
        }
        if (this._onResize) {
            global.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this.raiz && this.raiz.parentNode) { this.raiz.parentNode.removeChild(this.raiz); }
        this.raiz = null;
        this.escena = null;
        this.guiaHost = null;
        this.cvEnvoltura = null;
        this.ctxEnvoltura = null;
        this.txtOrigen = null;
        this.txtSalida = null;
        this.canvas = null;
        this.ctx = null;
        // T012: el cropper se destruye al cerrar (sin fugas al reabrir).
        this._destruirCropper();
        document.body.classList.remove('spmu-bloqueado');
        if (this._focoPrevio && typeof this._focoPrevio.focus === 'function') {
            try { this._focoPrevio.focus(); } catch (e) { /* el foco previo pudo desaparecer */ }
        }
        this._focoPrevio = null;
    };

    /** Destruye la instancia de Cropper si existe (idempotente). */
    SelectorPMU.prototype._destruirCropper = function () {
        if (this.cropper) {
            try { this.cropper.destroy(); } catch (e) { /* ya destruido */ }
            this.cropper = null;
        }
        this._gesto = null;
    };

    SelectorPMU.prototype.destroy = function () {
        this.close();
        if (this.imagen && this.imagen.src) { URL.revokeObjectURL(this.imagen.src); }
        this.onSelectCallback = null;
        this.onErrorCallback = null;
        this.oyentes = {};
        this.imagen = null;
        this.ultimoBlob = null;
    };

    global.SelectorPMU = SelectorPMU;
})(window);
