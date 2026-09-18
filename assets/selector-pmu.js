/**
 * selector-pmu - Componente cliente para subir, ajustar y recortar imagenes
 * de campos de personalizacion (spec 004, contrato contracts/selector-pmu.md).
 *
 * El TAMANO FINAL en px lo define el campo/PDF (`finalW`/`finalH`): el cliente
 * carga la imagen para editarla y al aceptar el ajuste al marco se genera la
 * version recortada a ese tamano (sin limite de peso de origen).
 *
 * Sin dependencias (JS puro). El componente NO sube nada: entrega el blob
 * recortado al llamador (que lo envia al pool del item).
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

    function SelectorPMU(elemento, config) {
        config = config || {};
        this.elemento = elemento || null;
        this.config = {
            finalW: parseInt(config.finalW, 10) || 0,
            finalH: parseInt(config.finalH, 10) || 0,
            aspectRatio: config.aspectRatio || null,
            mode: config.mode === 'fit' ? 'fit' : 'crop',
            category: config.category || ''
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

    /** Abre el dialogo de subida + ajuste (canvas final = finalW x finalH). */
    SelectorPMU.prototype.open = function () {
        var self = this;
        if (this.raiz) { return; }
        inyectarEstilos();
        this.raiz = document.createElement('div');
        this.raiz.className = 'spmu-modal';
        this.raiz.innerHTML =
            '<div class="spmu-caja" role="dialog" aria-modal="true" aria-label="Ajustar imagen">' +
            '<p class="spmu-titulo">Ajusta la imagen al marco ' + this.config.finalW + 'x' + this.config.finalH + ' px</p>' +
            '<div class="spmu-escena"><canvas class="spmu-canvas" width="' + this.config.finalW + '" height="' + this.config.finalH + '"></canvas></div>' +
            '<p class="spmu-controles">' +
            '<label>Zoom <input type="range" class="spmu-zoom" min="1" max="4" step="0.01" value="1"></label>' +
            '<label>Modo <select class="spmu-modo">' +
            '<option value="crop"' + (this.config.mode === 'crop' ? ' selected' : '') + '>Recortar al marco</option>' +
            '<option value="fit"' + (this.config.mode === 'fit' ? ' selected' : '') + '>Encajar completo</option>' +
            '</select></label>' +
            '</p>' +
            '<p class="spmu-acciones">' +
            '<input type="file" class="spmu-file" accept="' + ACEPTA + '" hidden>' +
            '<button type="button" class="button spmu-elegir">Elegir imagen</button>' +
            '<button type="button" class="button button-primary spmu-ok" disabled>Aceptar</button>' +
            '<button type="button" class="button-link spmu-cancelar">Cancelar</button>' +
            '</p>' +
            '<p class="spmu-status" role="status"></p>' +
            '</div>';
        document.body.appendChild(this.raiz);

        var $ = function (sel) { return self.raiz.querySelector(sel); };
        this.canvas = $('.spmu-canvas');
        this.ctx = this.canvas.getContext('2d');

        $('.spmu-elegir').addEventListener('click', function () { $('.spmu-file').click(); });
        $('.spmu-file').addEventListener('change', function () { self._cargar(this.files && this.files[0]); });
        $('.spmu-zoom').addEventListener('input', function () {
            self.zoom = parseFloat(this.value) || 1;
            self._dibujar();
        });
        $('.spmu-modo').addEventListener('change', function () {
            self.config.mode = this.value === 'fit' ? 'fit' : 'crop';
            self._dibujar();
        });
        $('.spmu-ok').addEventListener('click', function () { self._aceptar(); });
        $('.spmu-cancelar').addEventListener('click', function () {
            self.close();
            self._fallo('CROP_ABORTED', 'Cancelado por el usuario');
        });

        var escena = $('.spmu-escena');
        escena.addEventListener('pointerdown', function (e) {
            if (self.config.mode !== 'crop') { return; }
            self._arrastrando = { x: e.clientX, y: e.clientY, dx: self.desplazamiento.x, dy: self.desplazamiento.y };
            if (escena.setPointerCapture) { escena.setPointerCapture(e.pointerId); }
        });
        escena.addEventListener('pointermove', function (e) {
            if (!self._arrastrando) { return; }
            var caja = self.canvas.getBoundingClientRect();
            var escala = caja.width > 0 ? self.canvas.width / caja.width : 1;
            self.desplazamiento.x = self._arrastrando.dx + (e.clientX - self._arrastrando.x) * escala;
            self.desplazamiento.y = self._arrastrando.dy + (e.clientY - self._arrastrando.y) * escala;
            self._dibujar();
        });
        escena.addEventListener('pointerup', function () { self._arrastrando = null; });

        this._onKey = function (e) {
            if (e.key === 'Escape') {
                self.close();
                self._fallo('CROP_ABORTED', 'Cancelado por el usuario');
            }
        };
        document.addEventListener('keydown', this._onKey);
        this._dibujar();
    };

    /** Estilos del dialogo (idempotente, sin archivo CSS extra). */
    var ESTILO_ID = 'spmu-estilos';
    function inyectarEstilos() {
        if (document.getElementById(ESTILO_ID)) { return; }
        var s = document.createElement('style');
        s.id = ESTILO_ID;
        s.textContent =
            '.spmu-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}' +
            '.spmu-caja{background:#fff;max-width:min(92vw,560px);max-height:92vh;overflow:auto;padding:16px;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.35)}' +
            '.spmu-titulo{margin:0 0 8px;font-weight:600}' +
            '.spmu-escena{display:flex;justify-content:center;touch-action:none;cursor:move;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/24px 24px}' +
            '.spmu-canvas{max-width:100%;height:auto;display:block}' +
            '.spmu-controles{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0}' +
            '.spmu-acciones{display:flex;gap:8px;align-items:center;margin:8px 0 0}' +
            '.spmu-status{margin:8px 0 0;color:#555;font-size:12px}';
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
            var status = self.raiz ? self.raiz.querySelector('.spmu-status') : null;
            if (status) {
                status.textContent = 'Origen ' + img.naturalWidth + 'x' + img.naturalHeight + ' px';
            }
            self._emitir('progress', { percentage: 100 });
            self._dibujar();
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            self._fallo('UPLOAD_FAILED', 'No se pudo leer la imagen');
        };
        img.src = url;
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
        if (this.canvas.toBlob) {
            this.canvas.toBlob(terminar, 'image/png');
        } else {
            // Fallback sin toBlob: dataURL -> blob.
            var bin = atob(this.canvas.toDataURL('image/png').split(',')[1]);
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
        if (this.raiz && this.raiz.parentNode) { this.raiz.parentNode.removeChild(this.raiz); }
        this.raiz = null;
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
