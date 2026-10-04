jQuery(function ($) {
    'use strict';

    var existentes = (window.PersonalizadorPDF && PersonalizadorPDF.existentes) || [];
    var cfgGlobal = window.PersonalizadorPDF || {};
    var POST_URL = cfgGlobal.postUrl || 'admin-post.php';
    var NONCES = cfgGlobal.nonceAccion || {};

    /* ============ 0. POST unico sin recarga (fetch + JSON o redirect) ============ */

    /** Lee el mensaje de error de una respuesta JSON o HTTP. */
    function mensajeError(resp, json) {
        if (json && typeof json.data === 'string' && json.data !== '') { return json.data; }
        if (json && json.data && json.data.mensaje) { return String(json.data.mensaje); }
        return 'Error HTTP ' + (resp ? resp.status : '?') + '. Recarga la pagina y reintenta.';
    }

    /**
     * POST unico a admin-post.php: manda FormData con credentials same-origin
     * y resuelve {ok, data} sin recargar. Los arrays se envian como campos
     * repetidos (igual que un POST nativo). Si la respuesta no es JSON (p.
     * ej. un HTML de error del servidor), navega para que el usuario vea la
     * causa. Acepta pares [[k,v]] o FormData ya armado (caso Procesar con blobs).
     */
    function pmuPost(action, campos, nonce, senal) {
        function agregar(fd, k, v) {
            if (v instanceof File || v instanceof Blob) { fd.append(k, v, v.name || k); }
            else if (v !== undefined && v !== null) { fd.append(k, v); }
        }
        var fd = campos instanceof FormData ? campos : new FormData();
        if (!(campos instanceof FormData)) {
            if ($.isArray(campos)) {
                // Lista de pares [nombre, valor] (preserva repetidos tal cual).
                $.each(campos, function (_, par) { agregar(fd, par[0], par[1]); });
            } else {
                Object.keys(campos || {}).forEach(function (k) {
                    var v = campos[k];
                    if ($.isArray(v)) { $.each(v, function (_, uno) { agregar(fd, k, uno); }); }
                    else { agregar(fd, k, v); }
                });
            }
        }
        fd.set('action', action);
        if (nonce) { fd.set('_wpnonce', nonce); }
        var opciones = { method: 'POST', body: fd, credentials: 'same-origin' };
        if (senal) { opciones.signal = senal; }
        return fetch(POST_URL, opciones)
            .then(function (resp) {
                var ctype = (resp.headers.get('content-type') || '').toLowerCase();
                if (ctype.indexOf('application/json') === -1) {
                    // Fallback sin JS en el servidor: redirige como antes.
                    window.location.href = resp.url || window.location.href;
                    return { ok: true, data: {}, redirigido: true };
                }
                return resp.json().then(function (json) {
                    if (!resp.ok || !json || json.success !== true) {
                        throw new Error(mensajeError(resp, json));
                    }
                    return { ok: true, data: json.data || {} };
                });
            })
            .catch(function (err) {
                if (err && err.name === 'AbortError') {
                    throw new Error('La subida tardo demasiado o se cancelo (timeout 90 s). Probando de nuevo.');
                }
                throw err instanceof Error ? err : new Error('Fallo la operacion.');
            });
    }
    /** Toast inline unico: ok=verde, error=rojo; se autocierra a los 6 s. */
    function pmuAviso($ctx, mensaje, esError) {
        var $zona = $ctx && $ctx.length ? $ctx : $('.wrap.personalizador-pdf');
        var $aviso = $('<div class="notice"></div>')
            .addClass(esError ? 'notice-error' : 'notice-success')
            .append($('<p></p>').text(mensaje));
        $zona.first().prepend($aviso);
        setTimeout(function () { $aviso.fadeOut(400, function () { $aviso.remove(); }); }, 6000);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return $aviso;
    }

    /** Enlaza un form clasico a pmuPost: exito->callback, error->aviso inline. */
    function pmuForm($form, action, nonce, alExito) {
        if (!$form.length || $form.data('pmu-enlazado')) { return; }
        $form.data('pmu-enlazado', true);
        $form.on('submit', function (e) {
            e.preventDefault();
            // Pares crudos (preserva repetidos: tienda[pid][activo]=0+1, etc.).
            var pares = [];
            $.each($form.serializeArray(), function (_, kv) {
                if (kv.name === 'action' || kv.name === '_wpnonce') { return; }
                pares.push([kv.name, kv.value]);
            });
            var $btn = $form.find('button[type=submit], input[type=submit]').first().prop('disabled', true);
            var $status = $form.find('.ec-campo-status, .ec-guardar-status').first();
            if ($status.length) { $status.removeClass('ec-ok ec-error').text('Guardando...'); }
            pmuPost(action, pares, nonce || $form.find('input[name=_wpnonce]').val()).then(function (res) {
                if (res.redirigido) { return; }
                if (typeof alExito === 'function') { alExito(res.data, $form); }
                else if ($status.length) { $status.addClass('ec-ok').text('Guardado ✓'); }
                else { pmuAviso($form.closest('.card, .wrap'), 'Guardado.'); }
            }).catch(function (err) {
                var msg = (err && err.message) || 'Fallo la operacion.';
                if ($status.length) { $status.addClass('ec-error').text(msg); }
                else { pmuAviso($form.closest('.card, .wrap'), msg, true); }
            }).then(function () { $btn.prop('disabled', false); });
        });
    }

    /* Campos v2 (spec 012, F1): alta/edicion/baja sin recarga. El editor se abre
       DENTRO de la fila (`ec-campo-form-fila`), sin navegar. */
    $(function () {
        if (!$('form.ec-form-campo, form.ec-form-campo-baja, form.ec-form-campo-restaurar').length) { return; }
        var nonceCampo = (cfgGlobal.nonceAccion && cfgGlobal.nonceAccion.campo)
            || (window.PMU_CAMPO && PMU_CAMPO.nonce) || '';

        /* Repinta una fila con los datos que devuelve el SERVIDOR (FR-002), no
           con los del formulario. `campo` es la fila v2 de cargar_campos(). */
        function pintarFila(campo) {
            if (!campo) { return null; }
            var $fila = $('.ec-campos-cuerpo tr[data-id="' + campo.id + '"]');
            if (!$fila.length) { return null; }
            var d = campo.datos || {};
            var cats = (campo.categorias || []).join(', ');
            $fila.find('.ec-c-nombre').text(d.nombre || '(sin nombre)');
            $fila.find('.ec-c-titulo').text(d.titulo_cliente || '(vacio)');
            $fila.find('.ec-c-cats').text(cats || '-');
            $fila.find('.ec-c-plantilla').text(campo.plantilla || '-');
            $fila.find('.ec-c-uso').text((campo.usado_pdf_n || 0) + ' PDF(s)');
            $fila.attr('data-plantilla', campo.plantilla || '');
            // Refleja los flags tambien en el formulario (checkbox/textarea).
            var $form = $fila.next('.ec-campo-form-fila').find('form.ec-form-campo');
            if ($form.length) {
                $form.find('input[name=nombre]').val(d.nombre || '');
                $form.find('input[name=titulo_cliente]').val(d.titulo_cliente || '');
                $form.find('input[name=descripcion]').val(d.descripcion || '');
                $form.find('input[name=categorias]').val(cats);
                $form.find('input[name=array]').prop('checked', !!d.array);
                $form.find('input[name=protegido]').prop('checked', !!d.protegido);
                $form.find('textarea[name=html]').val(campo.htm || '');
                $form.find('textarea[name=css]').val(campo.css || '');
                $form.find('textarea[name=js]').val(campo.js || '');
            }
            return $fila;
        }

        /* Abrir/cerrar el editor de una fila (FR-001, FR-003). */
        function alternarEditor($fila, abrir) {
            var $formFila = $fila.next('.ec-campo-form-fila');
            var $acciones = $fila.find('.ec-c-acciones');
            if (!$formFila.length) { return; }
            $formFila.prop('hidden', !abrir);
            $acciones.find('.ec-editar').text(abrir ? 'Cerrar' : 'Editar');
            $fila.toggleClass('ec-editando', !!abrir);
        }

        $(document).on('click', '.ec-c-acciones .ec-editar', function (ev) {
            ev.preventDefault();
            var $fila = $(this).closest('tr[data-id]');
            alternarEditor($fila, $fila.next('.ec-campo-form-fila').prop('hidden'));
        });

        $(document).on('click', '.ec-cancelar', function (ev) {
            ev.preventDefault();
            var $formFila = $(this).closest('.ec-campo-form-fila');
            var $fila = $formFila.prev('tr[data-id]');
            alternarEditor($fila, false);   // cerrar sin escribir (FR-003)
        });

        function enlazarFormularios($forms) {
            $forms.each(function () {
                var $f = $(this);
                var esEdicion = $f.find('input[name=id]').length > 0;
                pmuForm($f, 'personalizador_pdf_campo', nonceCampo, function (d) {
                    var id = (d && d.id) || 0;
                    if (esEdicion && d && d.campo) {
                        var $fila = pintarFila(d.campo);
                        if ($fila) { alternarEditor($fila, false); }
                        pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' guardado.');
                        return;
                    }
                // Alta: el servidor devuelve el HTML de la fila (fuente unica
                    // del markup, la misma que pinta campos.php). Sin recargar.
                    if (d && d.html) {
                        var $vacia = $('.ec-campos-vacio');
                        if ($vacia.length) {
                            $vacia.replaceWith(d.html);
                        } else {
                            $('.ec-campos-cuerpo').append(d.html);
                        }
                        var $nuevas = $(d.html);
                        enlazarBaja($nuevas.find('form.ec-form-campo-baja'));
                        enlazarFormularios($nuevas.find('form.ec-form-campo'));
                        $f[0].reset();
                        pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' creado.');
                        return;
                    }
                    $f[0].reset();
                    pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' creado.');
                });
            });
        }
        enlazarFormularios($('form.ec-form-campo'));
        function enlazarBaja($forms) {
            $forms.each(function () {
                var $f = $(this);
                pmuForm($f, 'personalizador_pdf_campo_baja', nonceCampo, function (d) {
                    var id = (d && d.id) || $f.find('input[name=id]').val();
                    // La fila se va con su formulario de edicion pegado debajo.
                    var $fila = $f.closest('tr[data-id]');
                    var $formFila = $fila.next('.ec-campo-form-fila');
                    $formFila.fadeOut(200, function () { $formFila.remove(); });
                    $fila.fadeOut(300, function () { $fila.remove(); });
                    pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' dado de baja (podes restaurarlo abajo).');
                });
                // Confirmacion una sola vez (pmuForm ya evita doble enlace).
                $f.off('submit.pmu-confirma').on('submit.pmu-confirma', function (ev) {
                    if (!window.confirm('¿Dar de baja este campo? Los PDFs que lo usan quedan sin ese dato, pero podes restaurarlo despues.')) {
                        ev.stopImmediatePropagation();
                        ev.preventDefault();
                    }
                });
            });
        }
        enlazarBaja($('form.ec-form-campo-baja'));

        // Restaurar: la fila vuelve sola (el servidor la reinyecta).
        $('form.ec-form-campo-restaurar').each(function () {
            var $f = $(this);
            pmuForm($f, 'personalizador_pdf_campo_restaurar', nonceCampo, function (d) {
                var id = (d && d.id) || $f.find('input[name=id]').val();
                var $fila = $f.closest('tr[data-id]');
                $fila.fadeOut(300, function () { $fila.remove(); });
                pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' restaurado. Recargando la tabla…');
                window.setTimeout(function () { window.location.reload(); }, 700);
            });
        });
    });

    window.PersonalizadorPDF = window.PersonalizadorPDF || {};
    window.PersonalizadorPDF.pmuPost = pmuPost;
    window.PersonalizadorPDF.pmuAviso = pmuAviso;
    window.PersonalizadorPDF.pmuForm = pmuForm;

    /* ============ 1. Conflicto de nombre al subir PDF ============ */

    function nombreArchivo($input) {
        var valor = $input.val() || '';
        var partes = valor.split(/[\\/]/);
        return partes[partes.length - 1];
    }

    // Solo en la pestana PDFs hay forms de consola (en Campos admin.js es pmu-core).
    var $formSubir = $('form.ec-form-subir');
    var modoElegido = null;

    if ($formSubir.length) {
    $formSubir.on('submit', function (e) {
        e.preventDefault();
        var input = $formSubir.find('input[type=file]')[0];
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            pmuAviso($formSubir.closest('.card, .wrap'), 'Elegi un PDF para subir.', true);
            return;
        }
        var nombre = file.name || nombreArchivo($formSubir.find('input[type=file]'));
        if (nombre && existentes.indexOf(nombre) !== -1 && !modoElegido) {
            abrirModal(nombre);
            return;
        }
        var $btn = $formSubir.find('button[type=submit]').prop('disabled', true);
        var $estado = $formSubir.find('.ec-subir-status');
        if (!$estado.length) { $estado = $('<span class="ec-subir-status"></span>').appendTo($formSubir); }
        $estado.text('Subiendo y analizando...');
        var fd = new FormData();
        fd.append('pdf', file, file.name);
        fd.append('modo', modoElegido || '');
        pmuPost('personalizador_pdf_subir_pdf', fd, NONCES.subir_pdf || $formSubir.find('input[name=_wpnonce]').val())
            .then(function (res) {
                var d = res.data || {};
                var url = window.location.pathname + '?page=personalizador-pdf&tab=pdfs'
                    + '&ec_subido=1&ec_pdf=' + encodeURIComponent(d.ec_pdf || nombre)
                    + '&grupos=' + (d.grupos || 0) + '&instancias=' + (d.instancias || 0);
                window.location.href = url; // recarga solo en exito (lista de grupos nueva)
            })
            .catch(function (err) {
                $estado.text('');
                var msg = (err && err.message) || 'Fallo la subida.';
                // Sin decision de modo, el servidor pide resolver el conflicto de nombre.
                if (String(msg).indexOf('nombre_existente:') === 0) {
                    abrirModal(String(msg).slice('nombre_existente:'.length));
                    return;
                }
                pmuAviso($formSubir.closest('.card, .wrap'), msg, true);
            })
            .then(function () { $btn.prop('disabled', false); modoElegido = null; });
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
    } // fin guarda $formSubir (pestana PDFs)

    /* ============ 2. Imagenes por grupo sin recargar (galeria, drag & drop, quitar) ============ */

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

    /**
     * Sube una imagen para el grupo via pmuPost (sin recarga).
     * Con $adjuntoId > 0 manda el attachment de la galeria (el servidor lo lee
     * del disco: sin descarga ni re-subida); si no, manda el archivo $file.
     */
    function subirImagen($form, file, $status, adjuntoId) {
        var $panel = panelDeId(String($form.attr('data-id') || ''));
        var paresSubida = paresDe($form);
        if (adjuntoId > 0) {
            paresSubida.push(['attachment_id', adjuntoId]);
        } else {
            paresSubida.push(['attachment_id', '0']);
            paresSubida.push(['imagen', file]);
        }
        $status.removeClass('ec-error ec-ok').text('Subiendo...');
        return pmuPost('personalizador_pdf_subir_imagen', paresSubida, NONCES.subir_imagen || $form.find('input[name=_wpnonce]').val())
            .then(function (j) {
                $status.addClass('ec-ok').text('Imagen cargada ✓');
                marcarImagen($panel);
                return j;
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo subir la imagen (red).';
                $status.addClass('ec-error').text(msg);
                throw e;
            });
    }

    if (typeof wp !== 'undefined' && wp.media) {
        // El marco del placeholder y el boton del pool oculto abren la misma galeria;
        // se manda el id del adjunto (el servidor copia el archivo original).
        $(document).on('click', '.ec-marco-btn', function (e) {
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
                var idAdj = parseInt(att.id, 10) || 0;
                if (!idAdj) {
                    $status.addClass('ec-error').text('La imagen elegida no tiene id de adjunto.');
                    return;
                }
                subirImagen($form, null, $status, idAdj)
                    .catch(function () { /* el status ya muestra el error */ });
            });
            frame.open();
        });
    } else {
        $('.ec-marco-btn').attr('title', 'Galeria no disponible');
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

    // "Subir desde PC" (boton visible del panel) dispara el input del pool oculto.
    $(document).on('click', '.ec-subir-archivo', function () {
        var id = String($(this).data('id') || '');
        $('form.ec-form-imagen[data-id="' + id + '"] .ec-input-imagen').trigger('click');
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

    /** Extrae pares [nombre, valor] de un form (preserva repetidos). */
    function paresDe($form) {
        var pares = [];
        $.each($form.serializeArray(), function (_, kv) {
            if (kv.name === 'action' || kv.name === '_wpnonce') { return; }
            pares.push([kv.name, kv.value]);
        });
        return pares;
    }

    // Quitar la imagen del grupo por pmuPost (sin recarga).
    $(document).on('click', '.ec-quitar', function () {
        var id = String($(this).data('id') || '');
        var $form = $('form.ec-form-quitar[data-id="' + id + '"]').first();
        var $panel = panelDeId(id);
        if (!$form.length) { return; }
        var $status = $panel.find('.ec-subida-status');
        $status.removeClass('ec-error ec-ok').text('Quitando...');
        pmuPost('personalizador_pdf_quitar_imagen', paresDe($form), NONCES.quitar_imagen || $form.find('input[name=_wpnonce]').val())
            .then(function () {
                $status.addClass('ec-ok').text('Imagen quitada.');
                marcarSinImagen($panel);
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo quitar la imagen (red).';
                $status.addClass('ec-error').text(msg);
            });
    });

    /* ============ 2c. Buscador de productos Woo (chips + autocompletado) ============ */

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
            // Con nonce vencido el servidor responde JSON accionable (no HTML en blanco).
            fetch(cfgGlobal.ajaxUrl + '?action=personalizador_pdf_buscar_productos&_wpnonce=' +
                encodeURIComponent(cfgGlobal.nonceBuscar || '') + '&q=' + encodeURIComponent(q),
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
                    var msg = String((err && err.message) || 'La busqueda fallo.');
                    if (msg === 'woocommerce_inactivo') {
                        $caja.empty().append('<span class="ec-resultado-vacio">WooCommerce no esta activo: escribi un ID y pulsas Enter.</span>').removeAttr('hidden');
                        return;
                    }
                    if (window.console && console.warn) { console.warn('[PersonalizadorPDF] buscar', err); }
                    $caja.empty().append($('<span class="ec-resultado-vacio"></span>').text(msg)).removeAttr('hidden');
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

    // --- Alta rapida de campos (modal; reusa handle_campo_guardar via pmuPost) ---
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
        $status.removeClass('ec-error ec-ok').text('Creando...');
        var nuevo = {
            titulo_cliente: titulo,
            tipo: tipo,
            etiquetas: ($('.ec-modal-campo .ec-campo-etiquetas').val() || '').trim(),
            visible: $('.ec-modal-campo .ec-campo-visible').prop('checked') ? '1' : ''
        };
        pmuPost('personalizador_pdf_campo', nuevo, cfgGlobal.nonceCampo || '')
            .then(function (res) { campoCreado(res.data, titulo, tipo, $status); })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo crear el campo (red).';
                $status.addClass('ec-error').text(msg);
            });
    });

    /** Alta de campo reutilizable: actualiza selects y cierra el modal. */
    function campoCreado(data, titulo, tipo, $status) {
        var id = (data && data.id) || 0;
        if (id > 0) {
            var etiqueta = id + ' — ' + titulo + ' (' + tipo + ')';
            var $sel = $('select[name="campos_ids[]"]').first();
            if ($sel.length && !$sel.find('option[value="' + id + '"]').length) {
                $sel.append($('<option>', { value: id, text: etiqueta }).prop('selected', true));
            }
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
    }

    /* ============ 3. Acciones sin recarga (re-analizar, borrar, regenerar) ============ */

    // Re-analizar: recarga solo en exito (grupos nuevos); error inline.
    $(document).on('submit', 'form.ec-form-reanalizar', function (e) {
        e.preventDefault();
        var $form = $(this);
        var paresRe = paresDe($form);
        var archivo = $form.find('input[name=archivo]').val() || '';
        pmuAviso($form.closest('.card, .wrap'), 'Re-analizando el PDF...');
        pmuPost('personalizador_pdf_reanalizar', paresRe, NONCES.reanalizar || '')
            .then(function (res) {
                var d = res.data || {};
                var url = window.location.pathname + '?page=personalizador-pdf&tab=pdfs&ec_reanalizado=1'
                    + '&ec_pdf=' + encodeURIComponent(d.ec_pdf || archivo);
                if (d.ec_perdidos) { url += '&ec_perdidos=' + encodeURIComponent(d.ec_perdidos); }
                window.location.href = url;
            })
            .catch(function (err) {
                pmuAviso($form.closest('.card, .wrap'), (err && err.message) || 'Fallo el re-analisis.', true);
            });
    });

    // Borrar PDF: confirma y recarga solo en exito (lista nueva).
    $('form.ec-borrar').on('submit', function (e) {
        e.preventDefault();
        if (!window.confirm('¿Borrar este PDF con sus datos, imagenes y resultado? Esta accion no se puede deshacer.')) {
            return;
        }
        var $form = $(this);
        pmuPost('personalizador_pdf_borrar', paresDe($form), NONCES.borrar || '')
            .then(function () {
                window.location.href = window.location.pathname + '?page=personalizador-pdf&tab=pdfs&ec_borrado=1';
            })
            .catch(function (err) {
                pmuAviso($form.closest('.card, .wrap'), (err && err.message) || 'Fallo el borrado.', true);
            });
    });

    // Regenerar pedido: aviso inline, sin pagina blanca.
    $(document).on('submit', 'form.ec-form-regenerar', function (e) {
        e.preventDefault();
        var $form = $(this);
        pmuPost('personalizador_pdf_item_regenerar', paresDe($form), NONCES.item_regenerar || '')
            .then(function () { pmuAviso($form.closest('.card, .wrap'), 'PDF regenerado.'); })
            .catch(function (err) {
                pmuAviso($form.closest('.card, .wrap'), (err && err.message) || 'Fallo la regeneracion.', true);
            });
    });

    /* ============ 3b. Fotos de mockup ============ */
    // Retirado en la spec 011 (T032): el catalogo `mockups` es ahora la unica
    // fuente de imagenes de capa y lo gestiona el editor (assets/mockups.js),
    // que conoce las capas y por eso puede avisar de cuantas usan una imagen.
    // Ver `borrarImagenCatalogo()` en mockups.js.

    /* ============ 3c. Smoke test de la pestana Test ============ */

    $(document).on('click', '.ec-smoke-correr', function () {
        var $btn = $(this).prop('disabled', true);
        var $status = $('.ec-smoke-status').removeClass('ec-ok ec-error').text('Ejecutando...');
        var $caja = $('.ec-smoke-resultado');
        var $filas = $caja.find('.ec-smoke-filas').empty();
        pmuPost('personalizador_pdf_smoke', {}, $(this).data('nonce') || NONCES.smoke || '')
            .then(function (res) {
                var d = res.data || {};
                var checks = d.checks || [];
                var fallas = d.fallas || [];
                checks.forEach(function (c) {
                    $('<tr>')
                        .append($('<td></td>').append(c.ok
                            ? $('<span class="ec-smoke-ok">OK</span>')
                            : $('<span class="ec-smoke-falla">FALLA</span>')))
                        .append($('<td></td>').text(c.nombre))
                        .append($('<td><code></code></td>').find('code').text(c.detalle || '').end())
                        .appendTo($filas);
                });
                $caja.removeAttr('hidden');
                if (fallas.length) {
                    $status.addClass('ec-error')
                        .text(fallas.length + ' de ' + checks.length + ' checks fallaron.');
                } else {
                    $status.addClass('ec-ok').text('Todo OK: ' + checks.length + ' checks.');
                }
            })
            .catch(function (err) {
                $status.addClass('ec-error').text((err && err.message) || 'No se pudo ejecutar el smoke test.');
            })
            .then(function () { $btn.prop('disabled', false); });
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

            // HANDSHAKE DEL PUENTE: el iframe confirma con 'textmuy-bridge-ok' que YA
            // aplico el puente. Sin esa espera hay una carrera: el postMessage del
            // puente se entrega como TAREA, pero resolve() dispara el .then() como
            // MICROTAREA, asi que el primer render arrancaba con bridge=null y
            // fallaba con "presets:sin_puente" (el segundo clic si funcionaba).
            var apiLista = false;
            // Sin puente configurado no hay nada que confirmar: se resuelve igual.
            var puenteConfirmado = !puente;
            var resueltos = false;
            var fallback = null;
            var intentos = 0;

            function resolverSiListo() {
                if (resueltos || !apiLista || !puenteConfirmado) { return; }
                resueltos = true;
                resolve(iframe.contentWindow);
            }
            /**
             * Red de seguridad: si la API esta lista pero el ack no llega (modulo
             * viejo en cache, sin la confirmacion), no dejamos la promesa colgada.
             */
            function programarFallback() {
                if (fallback || resueltos) { return; }
                fallback = setTimeout(function () {
                    puenteConfirmado = true;
                    resolverSiListo();
                }, 3000);
            }
            /** Envia el puente al iframe (idempotente: el modulo guarda el ultimo). */
            function enviarPuente() {
                if (!puente) { return; }
                try {
                    iframe.contentWindow.postMessage({ type: 'textmuy-bridge', bridge: puente }, window.location.origin);
                } catch (e) { /* el iframe puede no estar listo aun */ }
            }
            iframe.addEventListener('load', function () {
                enviarPuente();
                (function sondeo() {
                    var w = iframe.contentWindow;
                    // Contrato RenderCore v1: la API debe exponer renderBatch (evita
                    // que una copia en cache del navegador use un modulo viejo).
                    if (w && w.RenderCore && w.TextMuyAPI && typeof w.TextMuyAPI.renderBatch === 'function' && w.TextEditor && w.ExportManager) {
                        enviarPuente(); // garantia extra: el modulo pudo anunciarse antes
                        apiLista = true;
                        programarFallback();
                        resolverSiListo();
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
            // Tres momentos de envio (igual que la pestana "Estilos de Texto"):
            // aviso textmuy-ready del modulo, carga del iframe y ya-mismo
            // (por si el iframe termino de cargar antes que este emisor).
            window.addEventListener('message', function (ev) {
                if (!ev || ev.source !== iframe.contentWindow || !ev.data) { return; }
                if (ev.data.type === 'textmuy-ready') {
                    enviarPuente();
                } else if (ev.data.type === 'textmuy-bridge-ok') {
                    puenteConfirmado = true;
                    resolverSiListo();
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

    // Cualquier cambio de control re-sincroniza el estado canonico del panel
    // e INVALIDA el preview de ese grupo (T023): su render ya no corresponde.
    $(document).on('input change',
        '.ec-panel-grupo .ec-modo-codigo, .ec-panel-grupo .ec-select-tipo, ' +
        '.ec-panel-grupo .ec-select-campo, .ec-panel-grupo .ec-select-estilo, ' +
        '.ec-panel-grupo .ec-input-codigo, .ec-panel-grupo .ec-input-settings',
        function () {
            var $panel = $(this).closest('.ec-panel-grupo');
            syncPanel($panel);
            invalidarPreview(String($panel.data('id') || ''));
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

    /** Guarda la configuracion via pmuPost (sin recarga). */
    function guardarConfigAjax() {
        var $form = $('form.ec-form-config');
        $('.ec-panel-grupo').each(function () { syncPanel($(this)); });
        // Pares crudos de serializeArray: preservan repetidos (hidden 0 + checkbox 1).
        var pares = [];
        $.each($form.serializeArray(), function (_, kv) {
            if (kv.name === 'action' || kv.name === '_wpnonce') { return; }
            pares.push([kv.name, kv.value]);
        });
        var $status = $form.find('.ec-guardar-status');
        $status.removeClass('ec-ok ec-error').text('Guardando...');
        return pmuPost('personalizador_pdf_config', pares, cfgGlobal.nonceConfig || '')
            .then(function (j) {
                $status.addClass('ec-ok').text('Guardado ✓');
                actualizarBadge();
                return j;
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

    /**
     * Store de previews de grupo (spec 011, D2/T022).
     *
     * El render lo produce el boton "Probar" de cada grupo con el motor ya
     * cargado. El editor de mockups NO renderiza: consume este store y se
     * repinta con el evento `pmu:preview-listo`. El hash evita volver a
     * renderizar lo mismo (FR-021) y la URL revocada sale del store.
     */
    var PREVIEWS = {};
    window.PersonalizadorPDF = window.PersonalizadorPDF || {};
    window.PersonalizadorPDF.previews = PREVIEWS;

    /** Hash del render: mismo texto/estilo/tamano => mismo render. */
    function hashPreview(texto, preset, w, h) {
        var crudo = [texto || '', preset || '', String(w || 0), String(h || 0)].join('|');
        var hash = 0;
        for (var i = 0; i < crudo.length; i++) {
            hash = ((hash << 5) - hash + crudo.charCodeAt(i)) | 0;
        }
        return String(hash);
    }

    function publicarPreview(id, detalle) {
        PREVIEWS[String(id)] = detalle;
        window.dispatchEvent(new CustomEvent('pmu:preview-listo', { detail: detalle }));
    }

    /** Invalida el preview de un grupo (cambio de tipo/estilo/codigo/campo). */
    function invalidarPreview(id) {
        delete PREVIEWS[String(id)];
    }

    function cajaPreview($panel) {
        return $panel.find('.ec-texto-preview-caja');
    }

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
        var texto = textoMuestra(st);
        var hash = hashPreview(texto, st.preset, st.w, st.h);
        var previo = PREVIEWS[st.id];
        // FR-021: si el render vigente es el mismo, no se vuelve a renderizar:
        // abrir el editor o pulsar dos veces no genera renders duplicados.
        if (previo && previo.hash === hash && previo.url) {
            cajaPreview($panel).find('img').attr('src', previo.url).data('url', previo.url);
            cajaPreview($panel).removeAttr('hidden');
            $status.removeClass('ec-error').text('');
            window.dispatchEvent(new CustomEvent('pmu:preview-listo', { detail: previo }));
            return;
        }
        $btn.prop('disabled', true).text('Renderizando...');
        renderCore().then(function (core) {
            return core.TextMuyAPI.renderBatch([{ id: st.id, text: texto, preset: st.preset, width: st.w, height: st.h }]);
        }).then(function (out) {
            var url = URL.createObjectURL(out[0].blob);
            var $caja = cajaPreview($panel);
            var $img = $caja.find('img');
            if ($img.data('url')) { URL.revokeObjectURL($img.data('url')); }
            $img.attr('src', url).data('url', url);
            $caja.find('.ec-texto-preview-dims').text(st.w + 'x' + st.h + ' px');
            $caja.removeAttr('hidden');
            $status.removeClass('ec-error').text('');
            publicarPreview(st.id, {
                id: st.id, url: url, w: st.w, h: st.h,
                hash: hash, ts: new Date().toISOString()
            });
        }).catch(function (err) {
            if (window.console && window.console.warn) { window.console.warn('[PersonalizadorPDF] probar', err); }
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
        e.preventDefault();
        var form = this;
        var $form = $(form);
        var bloques = [];
        $('.ec-panel-grupo').each(function () {
            syncPanel($(this));
            var st = estadoPanel($(this));
            if (st.tipo === 'texto' && st.preset && st.value) {
                bloques.push(st);
            }
        });
        var $btn = $form.find('button[type=submit]').prop('disabled', true);
        var $status = $form.find('.ec-procesar-status');
        var ov = overlayRender();
        // 1) La configuracion se guarda SIEMPRE primero (el procesado refleja lo guardado).
        guardarConfigAjax().then(function () {
            if (!bloques.length) {
                // Solo imagenes manuales: el backend usa las imagenes ya guardadas.
                return procesarSinTexto($form, ov);
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
                    return enviarProcesar(fd);
                });
            });
        }).then(function (res) {
            if (!res) { return; } // procesarSinTexto ya mostro el resultado
            ov.cerrar();
            procesarExito($form, $status, res.data || {});
        }).catch(function (err) {
            if (window.console && console.warn) { console.warn('[PersonalizadorPDF]', err); }
            var msg = (err && err.message) || 'Fallo el procesamiento.';
            if (err && err.name === 'AbortError') {
                msg = 'La subida tardo demasiado o se cancelo (timeout 90 s). Probando de nuevo.';
            }
            ov.error(msg);
            $status.removeClass('ec-ok').addClass('ec-error').text(msg);
        }).then(function () { $btn.prop('disabled', false); });
    });

    /** Procesar sin textos: POST unico con las imagenes ya guardadas. */
    function procesarSinTexto($form, ov) {
        ov.aplicar();
        var fd = new FormData($form[0]);
        return enviarProcesar(fd);
    }

    /** Envia el POST de procesar via pmu-core (timeout 90 s, sin recarga). */
    function enviarProcesar(fd) {
        var controlador = new AbortController();
        var timeoutId = setTimeout(function () { controlador.abort(); }, 90000);
        return pmuPost('personalizador_pdf_procesar', fd, NONCES.procesar || '', controlador.signal)
            .finally(function () { clearTimeout(timeoutId); });
    }

    /** Exito de procesar: toast + link de descarga silenciosa (iframe oculto). */
    function procesarExito($form, $status, data) {
        var grupos = data.grupos || 0;
        var instancias = data.instancias || 0;
        var msg = 'PDF procesado: ' + grupos + ' grupo(s), ' + instancias + ' instancia(s).';
        $status.removeClass('ec-error').addClass('ec-ok').html('');
        $status.append($('<span></span>').text(msg + ' '));
        if (data.descarga) {
            $status.append($('<a></a>').attr('href', data.descarga).text('Descargar el resultado'));
        }
        pmuAviso($form.closest('.card, .wrap'), msg);
        // Descarga silenciosa: no navega ni recarga (el PDF va a Descargas).
        if (data.descarga) {
            var $iframe = $('#ec-descarga-oculta');
            if (!$iframe.length) {
                $iframe = $('<iframe id="ec-descarga-oculta" style="display:none"></iframe>').appendTo('body');
            }
            $iframe.attr('src', data.descarga);
        }
    }


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
