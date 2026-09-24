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

    /* ============ 2. Imagenes por grupo sin recargar (galeria, drag & drop, quitar) ============ */

    var EXT_IMAGEN = /\.(png|jpe?g|gif|webp)$/i;
    var MIME_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

    function panelDeId(id) { return $('.ec-panel-grupo[data-id="' + id + '"]'); }

    /** Refresca el preview del grupo con la imagen del motor (ver) con cache-bust. */
    function marcarImagen($panel) {
        var $marco = $panel.find('.ec-marco-btn');
        var url = String($marco.attr('data-ver') || '');
        if (!url) { return; }
        $marco.find('img, .ec-marco').remove();
        $marco.append($('<img alt="">').attr('src', url + '&t=' + Date.now()));
        $panel.attr('data-tiene', '1');
        $panel.find('.ec-quitar').removeAttr('hidden');
        refrescarProcesar();
    }

    /** Vuelve al marco vacio del grupo (tras quitar la imagen). */
    function marcarSinImagen($panel) {
        var $marco = $panel.find('.ec-marco-btn');
        var vw = parseInt($marco.attr('data-vw'), 10) || 100;
        var vh = parseInt($marco.attr('data-vh'), 10) || 100;
        $marco.find('img, .ec-marco').remove();
        $marco.append($('<div class="ec-marco"></div>').css({ width: vw + 'px', height: vh + 'px' }));
        $panel.attr('data-tiene', '0');
        $panel.find('.ec-quitar').attr('hidden', true);
        refrescarProcesar();
    }

    /** Sube una imagen para el grupo via AJAX (handle_subir_imagen con ajax=1). */
    function subirImagen($form, file, $status) {
        var $panel = panelDeId(String($form.attr('data-id') || ''));
        var fd = new FormData($form[0]);
        fd.set('ajax', '1');
        fd.set('imagen', file, file.name || ('imagen' + (MIME_EXT[file.type] || '.png')));
        $status.removeClass('ec-error ec-ok').text('Subiendo...');
        return fetch($form.attr('action'), { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j && j.success) {
                    $status.addClass('ec-ok').text('Imagen cargada ✓');
                    marcarImagen($panel);
                    return j;
                }
                throw new Error((j && j.data) || 'No se pudo subir la imagen.');
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo subir la imagen (red).';
                $status.addClass('ec-error').text(msg);
                throw e;
            });
    }

    if (typeof wp !== 'undefined' && wp.media) {
        // El marco del placeholder y el boton del pool oculto abren la misma galeria;
        // la eleccion se descarga y se sube por AJAX (sin recargar la consola).
        $(document).on('click', '.ec-galeria, .ec-marco-btn', function (e) {
            e.preventDefault();
            var idGrupo = (String($(this).data('id') || '')).toUpperCase();
            var $form = $('form.ec-form-imagen[data-id="' + idGrupo + '"]').first();
            if (!$form.length) { return; }
            var $status = panelDeId(idGrupo).find('.ec-subida-status');
            var frame = wp.media({
                title: 'Elegir imagen para el grupo ' + idGrupo,
                multiple: false,
                library: { type: 'image' }
            });
            frame.on('select', function () {
                var att = frame.state().get('selection').first().toJSON();
                fetch(att.url, { credentials: 'same-origin' })
                    .then(function (r) {
                        if (!r.ok) { throw new Error('La imagen de la galeria no esta disponible.'); }
                        return r.blob();
                    })
                    .then(function (blob) {
                        var nombre = String(att.filename || 'imagen');
                        if (!EXT_IMAGEN.test(nombre)) {
                            nombre = nombre.replace(EXT_IMAGEN, '') + (MIME_EXT[blob.type] || '.png');
                        }
                        return subirImagen($form, new File([blob], nombre, { type: blob.type }), $status);
                    })
                    .catch(function (err) {
                        if (window.console && console.warn) { console.warn('[PersonalizadorPDF] galeria', err); }
                    });
            });
            frame.open();
        });
    } else {
        $('.ec-galeria, .ec-marco-btn').attr('title', 'Galeria no disponible');
    }

    // Arrastrar y soltar una imagen sobre el marco (sin recargar).
    $(document).on('dragover dragleave drop', '.ec-marco-btn', function (e) {
        var $marco = $(this);
        var id = String($marco.data('id') || '');
        var $panel = panelDeId(id);
        var $status = $panel.find('.ec-subida-status');
        if (e.type === 'dragover') {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'copy';
            $marco.addClass('ec-arrastre');
            return;
        }
        $marco.removeClass('ec-arrastre');
        if (e.type === 'dragleave') { return; }
        e.preventDefault();
        var dt = e.originalEvent.dataTransfer;
        var file = dt && dt.files && dt.files[0];
        if (!file) { return; }
        var $form = $('form.ec-form-imagen[data-id="' + id + '"]').first();
        if (!$form.length) { return; }
        if (file.type && file.type.indexOf('image/') !== 0) {
            $status.addClass('ec-error').text('El archivo soltado no es una imagen.');
            return;
        }
        subirImagen($form, file, $status).catch(function () { /* el status ya muestra el error */ });
    });

    // Seleccion manual con el input de archivo del pool (tambien por AJAX).
    $(document).on('change', '.ec-input-imagen', function () {
        var $form = $(this).closest('form.ec-form-imagen');
        var file = this.files && this.files[0];
        if (!$form.length || !file) { return; }
        var $panel = panelDeId(String($form.attr('data-id') || ''));
        subirImagen($form, file, $panel.find('.ec-subida-status')).catch(function () { /* status */ });
        $(this).val('');
    });

    // Quitar la imagen del grupo por AJAX.
    $(document).on('click', '.ec-quitar', function () {
        var id = String($(this).data('id') || '');
        var $form = $('form.ec-form-quitar[data-id="' + id + '"]').first();
        var $panel = panelDeId(id);
        if (!$form.length) { return; }
        var $status = $panel.find('.ec-subida-status');
        var fd = new FormData($form[0]);
        fd.set('ajax', '1');
        $status.removeClass('ec-error ec-ok').text('Quitando...');
        fetch($form.attr('action'), { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j && j.success) {
                    $status.addClass('ec-ok').text('Imagen quitada.');
                    marcarSinImagen($panel);
                    return j;
                }
                throw new Error((j && j.data) || 'No se pudo quitar la imagen.');
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo quitar la imagen (red).';
                $status.addClass('ec-error').text(msg);
            });
    });

    /* ============ 2c. Buscador de productos Woo (chips + autocompletado) ============ */

    var cfgBusqueda = window.PersonalizadorPDF || {};
    var debounceBusqueda = null;

    /** Escape HTML reutilizable para titulos dinamicos. */
    function escHtml(texto) {
        return $('<i>').text(String(texto === undefined || texto === null ? '' : texto)).html();
    }

    function chipExiste(id) {
        return $('.ec-chips-productos .ec-chip[data-id="' + (parseInt(id, 10) || 0) + '"]').length > 0;
    }

    function agregarChip(id, titulo) {
        id = parseInt(id, 10) || 0;
        if (id <= 0 || chipExiste(id)) { return; }
        $('.ec-chips-productos').append(
            '<span class="ec-chip" data-id="' + id + '">' +
            '<span class="ec-chip-texto">#' + id + (titulo ? ' — ' + escHtml(titulo) : '') + '</span>' +
            '<button type="button" class="ec-chip-x" aria-label="Quitar producto ' + id + '">×</button>' +
            '<input type="hidden" name="productos[]" value="' + id + '">' +
            '</span>'
        );
    }

    // Autocompletado de productos (endpoint wp_ajax con nonce dedicado).
    $(document).on('input', '.ec-input-buscar-producto', function () {
        var $input = $(this);
        var $caja = $input.closest('.ec-acordeon-cuerpo').find('.ec-resultados-producto');
        var q = ($input.val() || '').trim();
        clearTimeout(debounceBusqueda);
        if (q === '') {
            $caja.attr('hidden', true).empty();
            return;
        }
        debounceBusqueda = setTimeout(function () {
            fetch(cfgBusqueda.ajaxUrl + '?action=personalizador_pdf_buscar_productos&_wpnonce=' +
                encodeURIComponent(cfgBusqueda.nonceBuscar || '') + '&q=' + encodeURIComponent(q),
                { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (!(j && j.success)) { throw new Error((j && j.data) || 'La busqueda fallo.'); }
                    $caja.empty();
                    if (!j.data.length) {
                        $caja.append('<span class="ec-resultado-vacio">Sin resultados.</span>');
                    } else {
                        j.data.forEach(function (p) {
                            $caja.append(
                                '<button type="button" class="ec-resultado-item" data-id="' + p.id + '" data-titulo="' + escHtml(p.titulo) + '">' +
                                '#' + p.id + ' — ' + escHtml(p.titulo) + '</button>'
                            );
                        });
                    }
                    $caja.removeAttr('hidden');
                })
                .catch(function (err) {
                    if (String(err && err.message) === 'woocommerce_inactivo') {
                        $caja.empty().append('<span class="ec-resultado-vacio">WooCommerce no esta activo: escribi un ID y pulsas Enter.</span>').removeAttr('hidden');
                        return;
                    }
                    if (window.console && console.warn) { console.warn('[PersonalizadorPDF] buscar', err); }
                });
        }, 300);
    });

    // Enter con un ID numerico: alta manual (fallback sin Woo).
    $(document).on('keydown', '.ec-input-buscar-producto', function (e) {
        if (e.key !== 'Enter') { return; }
        e.preventDefault();
        var $input = $(this);
        var valor = ($input.val() || '').trim();
        if (/^\d+$/.test(valor)) {
            agregarChip(valor, '');
            $input.val('');
            $input.closest('.ec-acordeon-cuerpo').find('.ec-resultados-producto').attr('hidden', true).empty();
        }
    });

    $(document).on('click', '.ec-resultado-item', function () {
        agregarChip($(this).data('id'), String($(this).data('titulo') || ''));
        var $input = $('.ec-input-buscar-producto').first();
        $input.val('');
        $(this).closest('.ec-resultados-producto').attr('hidden', true).empty();
    });

    // Spec 005 (T004): al quitar el chip se quita tambien su bloque de validez.
    $(document).on('click', '.ec-chip-x', function () {
        var $chip = $(this).closest('.ec-chip');
        var id = parseInt($chip.data('id'), 10) || 0;
        if (id > 0) {
            $('.ec-tienda-producto[data-id="' + id + '"]').remove();
        }
        $chip.remove();
    });

    // Spec 005 (T004): `bloquear` solo se muestra si hay validez declarada.
    $(document).on('input', '.ec-tienda-validez', function () {
        var $bloque = $(this).closest('.ec-tienda-producto').find('.ec-tienda-bloquear');
        if (($(this).val() || '').trim() === '') {
            $bloque.attr('hidden', true);
        } else {
            $bloque.removeAttr('hidden');
        }
    });

    // Cerrar el dropdown al hacer clic fuera.
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.ec-buscador-producto, .ec-resultados-producto').length) {
            $('.ec-resultados-producto').attr('hidden', true).empty();
        }
    });

    // --- Alta rapida de campos (modal; reusa handle_campo_guardar con ajax=1) ---
    $(document).on('click', '.ec-nuevo-campo', function () {
        $('.ec-modal-campo').removeAttr('hidden');
        $('.ec-modal-campo .ec-campo-status').removeClass('ec-error ec-ok').text('');
        $('.ec-modal-campo .ec-campo-titulo').trigger('focus');
    });

    $(document).on('click', '.ec-modal-campo .ec-campo-cancelar', function () {
        $('.ec-modal-campo').attr('hidden', true);
    });

    $(document).on('click', '.ec-modal-campo .ec-campo-crear', function () {
        var $status = $('.ec-modal-campo .ec-campo-status');
        var titulo = ($('.ec-modal-campo .ec-campo-titulo').val() || '').trim();
        var tipo = $('.ec-modal-campo .ec-campo-tipo').val() || 'text';
        if (titulo === '') {
            $status.addClass('ec-error').text('Escribi un titulo.');
            return;
        }
        var fd = new FormData();
        fd.set('action', 'personalizador_pdf_campo');
        fd.set('_wpnonce', cfgBusqueda.nonceCampo || '');
        fd.set('titulo_cliente', titulo);
        fd.set('tipo', tipo);
        fd.set('etiquetas', ($('.ec-modal-campo .ec-campo-etiquetas').val() || '').trim());
        fd.set('visible', $('.ec-modal-campo .ec-campo-visible').prop('checked') ? '1' : '');
        fd.set('ajax', '1');
        $status.removeClass('ec-error ec-ok').text('Creando...');
        fetch(cfgBusqueda.postUrl || window.location.href, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!(j && j.success)) { throw new Error((j && j.data) || 'No se pudo crear el campo.'); }
                var id = (j.data && j.data.id) || 0;
                if (id > 0) {
                    var etiqueta = id + ' — ' + titulo + ' (' + tipo + ')';
                    var $sel = $('select[name="campos_ids[]"]').first();
                    if ($sel.length && !$sel.find('option[value="' + id + '"]').length) {
                        $sel.append($('<option>', { value: id, text: etiqueta }).prop('selected', true));
                    }
                    // Alta en los selectores de cada placeholder (data-titulo para Probar).
                    $('.ec-select-campo').each(function () {
                        var $sc = $(this);
                        if (!$sc.find('option[value="' + id + '"]').length) {
                            $sc.append($('<option>', { value: id, 'data-titulo': titulo, text: etiqueta }));
                        }
                    });
                }
                $status.addClass('ec-ok').text('Campo ' + id + ' creado ✓');
                $('.ec-modal-campo .ec-campo-titulo').val('');
                $('.ec-modal-campo .ec-campo-etiquetas').val('');
                setTimeout(function () {
                    $('.ec-modal-campo').attr('hidden', true);
                    $status.text('');
                }, 1200);
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo crear el campo (red).';
                $status.addClass('ec-error').text(msg);
            });
    });

    /* ============ 3. Confirmaciones ============ */

    $('form.ec-borrar').on('submit', function (e) {
        if (!window.confirm('¿Borrar este PDF con sus datos, imagenes y resultado? Esta accion no se puede deshacer.')) {
            e.preventDefault();
        }
    });

    /* ============ 4. Personalizacion por grupo (estado, guardado y puente TextMuy) ============ */

    var RENDER_CORE_URL = (window.PersonalizadorPDF && window.PersonalizadorPDF.renderCoreUrl) || '';
    var renderCorePromesa = null;

    /** Carga perezosa del render-core del modulo (iframe off-screen, SOLO al usarse). */
    function renderCore() {
        if (renderCorePromesa) { return renderCorePromesa; }
        renderCorePromesa = new Promise(function (resolve, reject) {
            if (!RENDER_CORE_URL) { reject(new Error('Render core no disponible.')); return; }
            // Puente TextMuy (contrato textmuy-bridge, AGENTS 2.1): el render-core
            // resuelve presets .txm, catalogos y fuentes SOLO con las bases del
            // puente (presetsBase/fuentesBase/imagenesBase). Sin puente, todo
            // render con preset rechaza con "presets:sin_puente".
            var puente = (window.PersonalizadorPDF && PersonalizadorPDF.puente) || null;
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
                enviarPuente();
                var intentos = 0;
                (function sondeo() {
                    var w = iframe.contentWindow;
                    // Contrato RenderCore v1: la API debe exponer renderBatch (evita
                    // que una copia en cache del navegador use un modulo viejo).
                    if (w && w.RenderCore && w.TextMuyAPI && typeof w.TextMuyAPI.renderBatch === 'function' && w.TextEditor && w.ExportManager) {
                        enviarPuente(); // garantia extra: puente antes de cualquier renderBatch
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
            /** Envia el puente al iframe (idempotente: el modulo guarda el ultimo). */
            function enviarPuente() {
                if (!puente) { return; }
                try {
                    iframe.contentWindow.postMessage({ type: 'textmuy-bridge', bridge: puente }, window.location.origin);
                } catch (e) { /* el iframe puede no estar listo aun */ }
            }
            // Tres momentos de envio (igual que la pestana "Estilos de Texto"):
            // aviso textmuy-ready del modulo, carga del iframe y ya-mismo
            // (por si el iframe termino de cargar antes que este emisor).
            window.addEventListener('message', function (ev) {
                if (ev.source === iframe.contentWindow && ev.data && ev.data.type === 'textmuy-ready') {
                    enviarPuente();
                }
            });
            document.body.appendChild(iframe);
            enviarPuente();
        });
        return renderCorePromesa;
    }

    /**
     * Los presets custom ya no viven en localStorage: desde 3.2.0 se guardan como
     * .txm en uploads/pmu/tm-presets/ y el listado completo llega desde el
     * servidor en los <option> del selector (presets_base()). Nada que mergear.
     */

    /** Estado canonico de un panel, leido de los hidden inputs sincronizados. */
    function estadoPanel($panel) {
        return {
            id: String($panel.data('id') || ''),
            tipo: $panel.find('.ec-h-tipo').val() || 'texto',
            preset: $panel.find('.ec-h-preset').val() || '',
            value: ($panel.find('.ec-h-value').val() || '').trim(),
            w: parseInt($panel.data('w'), 10) || 0,
            h: parseInt($panel.data('h'), 10) || 0,
            tiene: $panel.attr('data-tiene') === '1',
            $panel: $panel
        };
    }

    /** Sincroniza los hidden inputs del panel con sus controles visibles. */
    function syncPanel($panel) {
        var codigo = $panel.find('.ec-modo-codigo').prop('checked');
        var tipo = $panel.find('.ec-select-tipo').val() || 'texto';
        var campo = String($panel.find('.ec-select-campo').val() || '');
        var estilo = $panel.find('.ec-select-estilo').val() || '';
        var code = ($panel.find('.ec-input-codigo').val() || '').trim();
        var value = '';
        if (codigo) {
            value = code;
        } else if (campo !== '') {
            value = '[campo' + campo + ']';
        }
        if (tipo !== 'texto') {
            estilo = '';
        }
        $panel.find('.ec-bloque-codigo').prop('hidden', !codigo);
        $panel.find('.ec-bloque-campo').prop('hidden', codigo);
        $panel.find('.ec-bloque-estilo').prop('hidden', tipo !== 'texto');
        $panel.find('.ec-h-tipo').val(tipo);
        $panel.find('.ec-h-preset').val(estilo);
        $panel.find('.ec-h-value').val(value);
        $panel.find('.ec-h-settings').val($panel.find('.ec-input-settings').val() || '');
    }

    /** Texto de muestra: [campoN] -> titulo del campo (para el render de prueba). */
    function textoMuestra(st) {
        return String(st.value).replace(/\[campo\s*(\d+)\s*\]/gi, function (todo, n) {
            var titulo = String(st.$panel.find('.ec-select-campo option[value="' + n + '"]').data('titulo') || '');
            return titulo !== '' ? titulo : 'campo' + n;
        });
    }

    /** Un grupo cubre su hueco si tiene imagen manual o mapeo con value. */
    function panelCubierto(st) {
        return st.tiene || st.value !== '';
    }

    // Pestanas: un grupo visible a la vez.
    $(document).on('click', '.ec-tab', function () {
        var id = String($(this).data('id') || '');
        $('.ec-tab').removeClass('ec-tab-activa');
        $(this).addClass('ec-tab-activa');
        $('.ec-panel-grupo').removeClass('ec-panel-activa');
        $('.ec-panel-grupo[data-id="' + id + '"]').addClass('ec-panel-activa');
    });

    // El switch de "Configuracion tienda" no abre/cierra el acordeon.
    $(document).on('click', '.ec-switch, .ec-switch-texto', function (e) {
        e.stopPropagation();
    });

    // Cualquier cambio de control re-sincroniza el estado canonico del panel.
    $(document).on('input change',
        '.ec-panel-grupo .ec-modo-codigo, .ec-panel-grupo .ec-select-tipo, ' +
        '.ec-panel-grupo .ec-select-campo, .ec-panel-grupo .ec-select-estilo, ' +
        '.ec-panel-grupo .ec-input-codigo, .ec-panel-grupo .ec-input-settings',
        function () {
            syncPanel($(this).closest('.ec-panel-grupo'));
            refrescarProcesar();
        });

    var estadoInicialProcesar = null;

    function actualizarBadge() {
        var $badge = $('#ec-badge-cobertura');
        var $paneles = $('.ec-panel-grupo');
        if (!$badge.length || !$paneles.length) { return; }
        var cubiertos = 0;
        $paneles.each(function () {
            if (panelCubierto(estadoPanel($(this)))) { cubiertos++; }
        });
        $badge.text(cubiertos + '/' + $paneles.length + ' con imagen/texto');
        $badge.toggleClass('ec-badge-verde', cubiertos === $paneles.length);
        $badge.toggleClass('ec-badge-amarillo', cubiertos !== $paneles.length);
    }

    /** El boton Procesar se habilita con imagen manual o mapeo con value en algun grupo. */
    function refrescarProcesar() {
        var $btn = $('form.ec-form-procesar button[type=submit]');
        if (!$btn.length) { return; }
        if (estadoInicialProcesar === null) {
            estadoInicialProcesar = $btn.prop('disabled');
        }
        var hay = Array.prototype.some.call(document.querySelectorAll('.ec-panel-grupo'), function (el) {
            return panelCubierto(estadoPanel($(el)));
        });
        $btn.prop('disabled', hay ? false : estadoInicialProcesar);
        actualizarBadge();
    }
    refrescarProcesar();

    /** Guarda la configuracion via AJAX (handle_config_guardar responde JSON con ajax=1). */
    function guardarConfigAjax() {
        var $form = $('form.ec-form-config');
        $('.ec-panel-grupo').each(function () { syncPanel($(this)); });
        var fd = new FormData($form[0]);
        fd.set('ajax', '1');
        var $status = $form.find('.ec-guardar-status');
        $status.removeClass('ec-ok ec-error').text('Guardando...');
        return fetch($form.attr('action'), { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j && j.success) {
                    $status.addClass('ec-ok').text('Guardado ✓');
                    actualizarBadge();
                    return j;
                }
                throw new Error((j && j.data) || 'No se pudo guardar.');
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo guardar (red).';
                $status.addClass('ec-error').text(msg);
                throw new Error(msg);
            });
    }

    // Guardar: toda la configuracion en un POST AJAX, sin recarga.
    $(document).on('submit', 'form.ec-form-config', function (e) {
        e.preventDefault();
        guardarConfigAjax().catch(function () { /* el status ya muestra el error */ });
    });

    /** Vista previa del grupo al tamano exacto del hueco (texto de muestra). */
    $(document).on('click', '.ec-probar', function () {
        var $btn = $(this);
        var $panel = $btn.closest('.ec-panel-grupo');
        syncPanel($panel);
        var st = estadoPanel($panel);
        var $status = $panel.find('.ec-texto-status');
        if (st.tipo !== 'texto' || !st.preset || !st.value) {
            $status.addClass('ec-error').text('Elegi tipo texto, un campo o codigo y un estilo.');
            return;
        }
        $btn.prop('disabled', true).text('Renderizando...');
        renderCore().then(function (core) {
            return core.TextMuyAPI.renderBatch([{ id: st.id, text: textoMuestra(st), preset: st.preset, width: st.w, height: st.h }]);
        }).then(function (out) {
            var url = URL.createObjectURL(out[0].blob);
            var $caja = $panel.find('.ec-texto-preview-caja');
            var $img = $caja.find('img');
            if ($img.data('url')) { URL.revokeObjectURL($img.data('url')); }
            $img.attr('src', url).data('url', url);
            $caja.find('.ec-texto-preview-dims').text(st.w + 'x' + st.h + ' px');
            $caja.removeAttr('hidden');
            $status.removeClass('ec-error').text('');
        }).catch(function (err) {
            if (window.console && console.warn) { console.warn('[PersonalizadorPDF] probar', err); }
            $status.addClass('ec-error').text((err && err.message) || 'Fallo la vista previa.');
        }).finally(function () {
            $btn.prop('disabled', false).text('Probar');
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
        var bloques = [];
        $('.ec-panel-grupo').each(function () {
            syncPanel($(this));
            var st = estadoPanel($(this));
            if (st.tipo === 'texto' && st.preset && st.value) {
                bloques.push(st);
            }
        });
        e.preventDefault();
        var $btn = $(form).find('button[type=submit]').prop('disabled', true);
        var ov = overlayRender();
        // OJO: el form contiene <input name="action"> (patron admin-post), que PISA la
        // propiedad form.action del DOM (named property collision). La URL real del
        // envio esta en el ATRIBUTO, nunca en la propiedad.
        var actionUrl = form.getAttribute('action') || window.location.href;
        // 1) La configuracion se guarda SIEMPRE primero (el procesado refleja lo guardado).
        guardarConfigAjax().then(function () {
            if (!bloques.length) {
                // Solo imagenes manuales: submit nativo (el backend usa las imagenes guardadas).
                ov.aplicar();
                form.submit();
                return null;
            }
            // 2) Render de los grupos de texto y 3) un solo POST con los PNG (imagen_{id}).
            // Sin texto_/estilo_: la plantilla de config.json no se pisa con la muestra.
            ov.setTotal(bloques.length);
            var items = bloques.map(function (st) {
                return { id: st.id, text: textoMuestra(st), preset: st.preset, width: st.w, height: st.h };
            });
            return renderCore().then(function (core) {
                return core.TextMuyAPI.renderBatch(items, {
                    onProgress: function (id, idx, total) {
                        ov.paso('Grupo ' + String(id).toUpperCase() + ' (' + (idx + 1) + '/' + total + ')', idx);
                    }
                }).then(function (out) {
                    var fd = new FormData(form);
                    out.forEach(function (r) {
                        fd.append('imagen_' + r.id, r.blob, r.id + '.png');
                    });
                    ov.aplicar();
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
            });
        }).then(function (resp) {
            if (!resp) { return; } // envio nativo en curso (solo imagenes manuales)
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


    /* ============ 5. Miniaturas lazy (grupos de PDF) ============ */

    (function () {
        var cfg = window.PersonalizadorPDF || {};
        if (window.ThumbEngine && cfg.motorUrl) {
            ThumbEngine.configure({
                endpoint: cfg.motorUrl,
                nonce: cfg.motorNonce || ''
            });
        }

        var baseThumbs = (cfg.imagenesBase || '').replace(/\/$/, '');

        /**
         * Asegura la miniatura de una imagen asignada a un grupo de PDF.
         * Usa ThumbEngine.ensure con el slug '{pdf}-{id}'.
         * Si la miniatura no existe en servidor, renderiza a 100x100 contain y la guarda.
         */
        function ensureMiniatura(pdf, idGrupo, fullUrl) {
            var nombre = (pdf + '-' + idGrupo).toLowerCase();
            if (!window.ThumbEngine || !baseThumbs || !fullUrl) {
                return Promise.resolve(fullUrl);
            }
            return ThumbEngine.ensure({
                fuente: fullUrl,
                nombre: nombre,
                base: baseThumbs,
                ancho: 100,
                alto: 100
            });
        }

        window.PersonalizadorPDF = window.PersonalizadorPDF || {};
        window.PersonalizadorPDF.ensureMiniatura = ensureMiniatura;
    })();
});
