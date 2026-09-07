jQuery(function ($) {
    'use strict';

    var existentes = (window.PersonalizadorPDF && PersonalizadorPDF.existentes) || [];

    /* ============ 1. Conflicto de nombre al subir PDF ============ */

    function nombreArchivo($input) {
        var valor = $input.val() || '';
        var partes = valor.split(/[\\/]/);
        return partes[partes.length - 1];
    }

    var $formSubir = $('form.ec-form-subir');
    var modoElegido = null;

    $formSubir.on('submit', function (e) {
        var nombre = nombreArchivo($formSubir.find('input[type=file]'));
        if (nombre && existentes.indexOf(nombre) !== -1 && !modoElegido) {
            e.preventDefault();
            abrirModal(nombre);
        }
    });

    function abrirModal(nombre) {
        var $modal = $('.ec-modal');
        $modal.find('.ec-modal-caja p:first').text('Ya existe un PDF llamado "' + nombre + '". ¿Que queres hacer?');
        $modal.removeAttr('hidden');
    }

    $(document).on('click', '.ec-modal-btn', function () {
        modoElegido = $(this).data('modo');
        $('.ec-modal').attr('hidden', true);
        $formSubir.find('input[name=modo]').val(modoElegido);
        $formSubir.trigger('submit');
    });

    $(document).on('click', '.ec-modal-cancelar', function () {
        $('.ec-modal').attr('hidden', true);
    });

    /* Botones del aviso de conflicto (sin JS previo): fijan el modo en el form. */
    $('.ec-pregunta .ec-modo').on('click', function () {
        $formSubir.find('input[name=modo]').val($(this).data('modo'));
        $formSubir.find('input[type=file]').trigger('focus');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* ============ 2. Imagenes desde la galeria de medios ============ */

    if (typeof wp !== 'undefined' && wp.media) {
        $('.ec-galeria').on('click', function (e) {
            e.preventDefault();
            var $btn = $(this);
            var $form = $btn.closest('form.ec-form-imagen');
            var letra = ($btn.data('letra') || '').toUpperCase();
            var frame = wp.media({
                title: 'Elegir imagen para el grupo ' + letra,
                multiple: false,
                library: { type: 'image' }
            });
            frame.on('select', function () {
                var att = frame.state().get('selection').first().toJSON();
                $form.find('input[name=attachment_id]').val(att.id);
                $form.trigger('submit');
            });
            frame.open();
        });
    } else {
        $('.ec-galeria').prop('disabled', true).attr('title', 'Galeria no disponible');
    }

    /* ============ 3. Confirmaciones ============ */

    $('form.ec-borrar').on('submit', function (e) {
        if (!window.confirm('¿Borrar este PDF con sus datos, imagenes y resultado? Esta accion no se puede deshacer.')) {
            e.preventDefault();
        }
    });

    /* ============ 4. Texto estilizado por grupo (puente TextMuy) ============ */

    var RENDER_CORE_URL = (window.PersonalizadorPDF && window.PersonalizadorPDF.renderCoreUrl) || '';
    var renderCorePromesa = null;
    var debounceTexto = {};

    /** Carga perezosa del render-core del modulo (iframe off-screen, SOLO al usarse). */
    function renderCore() {
        if (renderCorePromesa) { return renderCorePromesa; }
        renderCorePromesa = new Promise(function (resolve, reject) {
            if (!RENDER_CORE_URL) { reject(new Error('Render core no disponible.')); return; }
            var iframe = document.createElement('iframe');
            // Cache-busting por version del plugin: el HTML del render-core es un
            // estatico sin version propia.
            iframe.src = RENDER_CORE_URL +
                (RENDER_CORE_URL.indexOf('?') === -1 ? '?' : '&') +
                'v=' + encodeURIComponent(String((window.PersonalizadorPDF && window.PersonalizadorPDF.version) || '1'));
            iframe.title = 'Motor de render TextMuy';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.tabIndex = -1;
            iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:0;';
            iframe.addEventListener('load', function () {
                var intentos = 0;
                (function sondeo() {
                    var w = iframe.contentWindow;
                    // Contrato RenderCore v1: la API debe exponer renderBatch (evita
                    // que una copia en cache del navegador use un modulo viejo).
                    if (w && w.RenderCore && w.TextMuyAPI && typeof w.TextMuyAPI.renderBatch === 'function' && w.TextEditor && w.ExportManager) {
                        resolve(w);
                    } else if (++intentos < 100) {
                        setTimeout(sondeo, 100);
                    } else if (w && w.TextMuyAPI && typeof w.TextMuyAPI.renderBatch !== 'function') {
                        reject(new Error('El modulo TextMuy en cache esta desactualizado. Recarga la pagina con Ctrl+F5 y reintenta.'));
                    } else {
                        reject(new Error('El motor de render TextMuy no termino de cargar.'));
                    }
                })();
            });
            iframe.addEventListener('error', function () {
                reject(new Error('No se pudo cargar el motor de render TextMuy.'));
            });
            document.body.appendChild(iframe);
        });
        return renderCorePromesa;
    }

    /** Presets custom guardados en este navegador (localStorage del editor). */
    function presetsCustom() {
        var nombres = [];
        try {
            var loc = JSON.parse(localStorage.getItem('textmuy_presets') || '{}');
            Object.keys(loc).forEach(function (k) { if (nombres.indexOf(k) === -1) nombres.push(k); });
            var imp = JSON.parse(localStorage.getItem('textstudio_presets') || '{}');
            Object.keys(imp).forEach(function (k) { if (nombres.indexOf(k) === -1) nombres.push(k); });
        } catch (_) { /* opcional */ }
        return nombres;
    }

    /** Anhade los presets custom (de este navegador) a cada select de estilo. */
    function mergePresetsCustom() {
        var customs = presetsCustom();
        if (!customs.length) { return; }
        $('select.ec-select-estilo').each(function () {
            var sel = this;
            customs.forEach(function (nombre) {
                var existe = Array.prototype.some.call(sel.options, function (o) { return o.value === nombre; });
                if (!existe) {
                    var o = document.createElement('option');
                    o.value = nombre;
                    o.textContent = nombre + ' (custom)';
                    sel.appendChild(o);
                }
            });
        });
    }
    mergePresetsCustom();

    /** Estado texto/estilo de un bloque de grupo, leido del DOM actual. */
    function estadoTexto($bloque) {
        var $form = $bloque.find('form.ec-form-texto');
        var chk = $form.find('input[name=activo]')[0];
        return {
            letra: String($bloque.data('letra') || ''),
            activo: !!(chk && chk.checked),
            texto: ($form.find('input[name=texto]').val() || '').trim(),
            estilo: $form.find('select[name=estilo]').val() || '',
            w: parseInt($bloque.data('w'), 10) || 0,
            h: parseInt($bloque.data('h'), 10) || 0,
            $form: $form
        };
    }

    /** Autoguardado via AJAX (el handler responde JSON cuando ajax=1). */
    function guardarTextoAjax($form) {
        var fd = new FormData($form[0]);
        fd.set('ajax', '1');
        var chk = $form.find('input[name=activo]')[0];
        fd.set('activo', (chk && chk.checked) ? '1' : '0');
        var $status = $form.find('.ec-texto-status');
        $status.removeClass('ec-ok ec-error').text('Guardando...');
        return fetch($form.attr('action'), { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j && j.success) { $status.addClass('ec-ok').text('Guardado ✓'); }
                else { $status.addClass('ec-error').text((j && j.data) || 'No se pudo guardar.'); }
            })
            .catch(function (e) {
                if (window.console && console.warn) { console.warn('[PersonalizadorPDF] autoguardado', e); }
                $status.addClass('ec-error').text('No se pudo guardar (red).');
            });
    }

    // Autoguardado con debounce al escribir o cambiar estilo/activo.
    $(document).on('input change', 'form.ec-form-texto input[name=texto], form.ec-form-texto select[name=estilo], form.ec-form-texto input[name=activo]', function () {
        var $form = $(this).closest('form.ec-form-texto');
        var letra = $form.find('input[name=letra]').val() || '';
        clearTimeout(debounceTexto[letra]);
        debounceTexto[letra] = setTimeout(function () { guardarTextoAjax($form); }, 600);
        refrescarBotonProcesar();
    });

    var estadoInicialProcesar = null;

    /** El boton Procesar se habilita con imagen manual o texto activo en algun grupo. */
    function refrescarBotonProcesar() {
        var $btn = $('form.ec-form-procesar button[type=submit]');
        if (!$btn.length) { return; }
        if (estadoInicialProcesar === null) {
            estadoInicialProcesar = $btn.prop('disabled');
        }
        var hayActivos = Array.prototype.some.call(document.querySelectorAll('.ec-texto'), function (el) {
            var st = estadoTexto($(el));
            return st.activo && st.texto && st.estilo;
        });
        $btn.prop('disabled', hayActivos ? false : estadoInicialProcesar);
    }
    refrescarBotonProcesar();

    // Con JS activo, el boton Guardar tambien usa AJAX (sin recarga).
    $(document).on('submit', 'form.ec-form-texto', function (e) {
        e.preventDefault();
        guardarTextoAjax($(this));
    });

    /** Vista previa del texto del grupo al tamano exacto del hueco. */
    $(document).on('click', '.ec-texto-preview', function () {
        var $btn = $(this);
        var $bloque = $btn.closest('.ec-texto');
        var st = estadoTexto($bloque);
        var $status = st.$form.find('.ec-texto-status');
        if (!st.texto || !st.estilo) {
            $status.addClass('ec-error').text('Escribe un texto y elige un estilo.');
            return;
        }
        $btn.prop('disabled', true).text('Renderizando...');
        renderCore().then(function (core) {
            return core.TextMuyAPI.renderBatch([{ id: st.letra, text: st.texto, preset: st.estilo, width: st.w, height: st.h }]);
        }).then(function (out) {
            var url = URL.createObjectURL(out[0].blob);
            var $caja = $bloque.find('.ec-texto-preview-caja');
            var $img = $caja.find('img');
            if ($img.data('url')) { URL.revokeObjectURL($img.data('url')); }
            $img.attr('src', url).data('url', url);
            $caja.find('.ec-texto-preview-dims').text(st.w + 'x' + st.h + ' px');
            $caja.removeAttr('hidden');
            $status.removeClass('ec-error').text('');
        }).catch(function (err) {
            if (window.console && console.warn) { console.warn('[PersonalizadorPDF] preview', err); }
            $status.addClass('ec-error').text((err && err.message) || 'Fallo la vista previa.');
        }).finally(function () {
            $btn.prop('disabled', false).text('Vista previa');
        });
    });

    /* ============ 5. Procesar con puente TextMuy (render -> 1 POST) ============ */

    /** Overlay de progreso mientras se renderizan los textos. */
    function overlayRender() {
        var $ov = $(
            '<div class="ec-render-overlay"><div class="ec-render-caja">' +
            '<p class="ec-render-msj">Preparando render...</p>' +
            '<div class="ec-render-barra"><i></i></div>' +
            '<p class="ec-render-detalle"></p></div></div>'
        );
        var $barra = $ov.find('.ec-render-barra i');
        var $msj = $ov.find('.ec-render-msj');
        var $det = $ov.find('.ec-render-detalle');
        var total = 0;
        $('body').append($ov);
        return {
            setTotal: function (n) { total = Math.max(1, n); },
            paso: function (detalle, idx) {
                $msj.text('Renderizando textos estilizados...');
                $det.text(detalle);
                $barra.css('width', Math.round(((idx + 1) / total) * 100) + '%');
            },
            aplicar: function () { $msj.text('Aplicando en el PDF...'); $det.text(''); $barra.css('width', '96%'); },
            error: function (mensaje) {
                $ov.addClass('ec-error');
                $msj.text('No se proceso nada.');
                $det.text(mensaje);
                $ov.on('click', function () { $ov.remove(); });
            },
            cerrar: function () { $ov.remove(); }
        };
    }

    $('form.ec-form-procesar').on('submit', function (e) {
        var form = this;
        var bloques = $('.ec-texto').map(function () { return estadoTexto($(this)); }).get()
            .filter(function (st) { return st.activo && st.texto && st.estilo; });
        if (!bloques.length) {
            return; // Sin textos activos: submit clasico (solo imagenes manuales).
        }
        e.preventDefault();
        var $btn = $(form).find('button[type=submit]').prop('disabled', true);
        var ov = overlayRender();
        // OJO: el form contiene <input name="action"> (patron admin-post), que PISA la
        // propiedad form.action del DOM (named property collision). La URL real del
        // envio esta en el ATRIBUTO, nunca en la propiedad.
        var actionUrl = form.getAttribute('action') || window.location.href;
        renderCore().then(function (core) {
            ov.setTotal(bloques.length);
            var items = bloques.map(function (st) {
                return { id: st.letra, text: st.texto, preset: st.estilo, width: st.w, height: st.h };
            });
            return core.TextMuyAPI.renderBatch(items, {
                onProgress: function (id, idx, total) {
                    ov.paso('Grupo ' + String(id).toUpperCase() + ' (' + (idx + 1) + '/' + total + ')', idx);
                }
            }).then(function (out) {
                var fd = new FormData(form);
                var porLetra = {};
                bloques.forEach(function (st) { porLetra[st.letra] = st; });
                out.forEach(function (r) {
                    var st = porLetra[r.id];
                    fd.append('texto_' + r.id, st.texto);
                    fd.append('estilo_' + r.id, st.estilo);
                    fd.append('imagen_' + r.id, r.blob, r.id + '.png');
                });
                ov.aplicar();
                // Mismo POST: textos + PNGs + procesar. admin-post redirige al final.
                // AbortController: si la red muere, el overlay muestra error en vez de esperar eterno.
                var controlador = new AbortController();
                var timeoutId = setTimeout(function () { controlador.abort(); }, 90000);
                return fetch(actionUrl, {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin',
                    signal: controlador.signal
                }).finally(function () {
                    clearTimeout(timeoutId);
                });
            });
        }).then(function (resp) {
            // Cerrar el overlay antes de navegar al resultado (transicion limpia).
            ov.cerrar();
            window.location.href = resp.url || window.location.href;
        }).catch(function (err) {
            if (window.console && console.warn) { console.warn('[PersonalizadorPDF]', err); }
            var msg = (err && err.message) || 'Fallo el procesamiento.';
            if (err && err.name === 'AbortError') {
                msg = 'La subida tardo demasiado o se cancelo (timeout 90 s). Probando de nuevo.';
            }
            ov.error(msg);
            $btn.prop('disabled', false);
        });
    });
});