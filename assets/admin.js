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

    /* Campos v2 (spec 012, F1): alta/edicion/baja sin recarga. Desde spec 013 el
       editor se abre en el DRAWER, no dentro de la fila: los formularios viven
       dormidos en `#ec-campo-forms` y se mueven al drawer. */
    $(function () {
        if (!$('form.ec-form-campo, form.ec-form-campo-baja, form.ec-form-campo-restaurar').length) { return; }
        var nonceCampo = (cfgGlobal.nonceAccion && cfgGlobal.nonceAccion.campo)
            || (window.PMU_CAMPO && PMU_CAMPO.nonce) || '';

        /* Repinta una fila con los datos que devuelve el SERVIDOR (FR-002), no
           con los del formulario. `campo` es la fila v2 de cargar_campos().
           Spec 015: el nombre lleva el titulo al comprador y la nota interna
           debajo (`.ec-c-sub`), asi que se reconstruye el mismo HTML que emite
           el servidor para que fila pintada y fila del alta sean iguales. */
        function pintarFila(campo) {
            if (!campo) { return null; }
            var $fila = $('.ec-campos-cuerpo tr[data-id="' + campo.id + '"]');
            if (!$fila.length) { return null; }
            var d = campo.datos || {};
            var pie = [];
            if (d.titulo_cliente) { pie.push('Cliente: ' + d.titulo_cliente); }
            if (d.descripcion) { pie.push(d.descripcion); }
            var nombre = d.nombre || '(sin nombre)';
            $fila.find('.ec-c-nombre').html(
                $('<span class="ec-c-nombre-txt"></span>').text(nombre)[0].outerHTML
                + (pie.length ? $('<span class="ec-c-sub"></span>').text(pie.join(' · '))[0].outerHTML : ''));
            $fila.find('.ec-c-tipo').text(campo.tipo || '-');
            $fila.find('.ec-c-uso').text((campo.usado_pdf_n || 0) + ' PDF(s)');
            $fila.attr('data-tipo', campo.tipo || '');
            // Refleja los flags tambien en el formulario (checkbox/textarea).
            var $form = formDe(campo.id);
            if ($form.length) {
                $form.find('input[name=nombre]').val(d.nombre || '');
                $form.find('input[name=titulo_cliente]').val(d.titulo_cliente || '');
                $form.find('input[name=descripcion]').val(d.descripcion || '');
                $form.find('input[name=array]').prop('checked', !!d.array);
                $form.find('input[name=protegido]').prop('checked', !!d.protegido);
                $form.find('textarea[name=html]').val(campo.htm || '');
                $form.find('textarea[name=css]').val(campo.css || '');
                $form.find('textarea[name=js]').val(campo.js || '');
            }
            return $fila;
        }

        /* ============ Drawer del editor (spec 013, T003) ============
           Una sola superficie para ALTA y EDICION (antes: un card de alta fijo
           arriba + un editor pegado a cada fila de la tabla). El formulario NO
           se copia: se MUEVE desde el dormitorio (#ec-campo-forms) al drawer y
           de vuelta, asi conserva valores y handlers. Solo hay uno dentro. */
        var $drawer = $('#ec-c-drawer'),
            $cuerpoDrawer = $('#ec-c-drawer-cuerpo'),
            $tituloDrawer = $('#ec-c-drawer-titulo'),
            $dormitorio = $('#ec-campo-forms'),
            drawerId = 0,
            drawerSucio = false;

        function formDe(id) {
            return id ? $('.ec-campo-form[data-form="' + id + '"]') : $('.ec-campo-form-nuevo');
        }

        /** Manda el formulario de vuelta al dormitorio, sin perder lo escrito. */
        function devolverForm($form) {
            if (!$form.length) { return; }
            $form.prop('hidden', true).appendTo($dormitorio);
        }

        /** Barra de acciones del drawer: "Probar" sin salir del editor. Con el
         * drawer abierto la fila queda tapada, asi que el Probar de la fila no
         * sirve para reprobar lo recien escrito. Va EN LINEA con Guardar y
         * Cancelar: antes caia en una barra aparte, debajo, y se leia como dos
         * grupos de acciones distintos. */
        function accionesDrawer($form) {
            $('#ec-c-drawer-cuerpo .ec-drawer-acciones').remove();
            var $a = $('<span class="ec-drawer-acciones"></span>');
            $('<button type="button" class="button ec-probar-drawer"></button>')
                .text('Probar').appendTo($a);
            $('<span class="ec-drawer-atajo"></span>')
                .text('Ctrl+Enter guarda · Esc cierra').appendTo($a);
            var $ancla = $form.find('.ec-cancelar');
            if (!$ancla.length) {
                $ancla = $form.find('input[type=submit], button[type=submit]').last();
            }
            if ($ancla.length) { $ancla.after($a); } else { $form.append($a); }
        }

        function abrirDrawer(id, opts) {
            opts = opts || {};
            var $form = formDe(id);
            if (!$form.length) { return; }
            devolverForm($cuerpoDrawer.children('.ec-campo-form'));
            $form.prop('hidden', false).appendTo($cuerpoDrawer);
            drawerId = id;
            var $fila = id ? $('.ec-campos-cuerpo tr[data-id="' + id + '"]') : $();
            $('.ec-campos-cuerpo tr.ec-editando').removeClass('ec-editando');
            $fila.toggleClass('ec-editando', !!id);
            var nombre = id ? $fila.find('.ec-c-nombre').text() : '';
            $tituloDrawer.text(id
                ? ('Campo ' + id + ((nombre && nombre !== '(sin nombre)') ? ' — ' + nombre : ''))
                : 'Nuevo campo');
            // El boton de envio cambia de texto segun sea alta o edicion.
            var $enviar = $form.find('input[type=submit], button[type=submit]');
            if ($enviar.length) {
                if ($enviar.is('input')) { $enviar.val(id ? 'Guardar cambios' : 'Crear campo'); }
                else { $enviar.text(id ? 'Guardar cambios' : 'Crear campo'); }
            }
            $drawer.prop('hidden', false);
            $('body').addClass('ec-c-drawer-abierto');
            drawerSucio = false;
            if (id) { accionesDrawer($form); }
            // `opts.probar` ya no se usa: el preview vive en su propio MODAL, y el
            // boton de la fila lo abre sin pasar por el editor.
            if (opts.probar) { abrirPreview(id); }
            var $foco = $form.find('input[name=nombre]');
            if ($foco.length) { $foco.trigger('focus'); }
        }

        /** Cierra el drawer. `forzar` saltea el aviso de cambios sin guardar. */
        function cerrarDrawer(forzar) {
            var $form = $cuerpoDrawer.children('.ec-campo-form');
            if (!$form.length) { return false; }
            if (drawerSucio && !forzar
                && !window.confirm('Hay cambios sin guardar. ¿Cerrar igual?')) {
                return false;
            }
            devolverForm($form);
            $('.ec-campos-cuerpo tr.ec-editando').removeClass('ec-editando');
            $drawer.prop('hidden', true);
            $('body').removeClass('ec-c-drawer-abierto');
            drawerId = 0;
            drawerSucio = false;
            return true;
        }

        /* Cualquier cambio dentro del drawer arma el aviso de salir. */
        $cuerpoDrawer.on('input change', 'input, textarea, select', function () {
            drawerSucio = true;
        });

        $(document).on('click', '.ec-c-acciones .ec-editar', function (ev) {
            ev.preventDefault();
            var id = parseInt($(this).closest('tr[data-id]').attr('data-id'), 10) || 0;
            if (drawerId === id) { cerrarDrawer(); return; }
            abrirDrawer(id);
        });

        $(document).on('click', '.ec-abrir-alta', function (ev) {
            ev.preventDefault();
            abrirDrawer(0);
        });

        $(document).on('click', '.ec-cancelar', function (ev) {
            ev.preventDefault();
            cerrarDrawer();
        });

        // "Probar" desde adentro del drawer (sin cerrarlo ni perder lo escrito).
        $(document).on('click', '.ec-probar-drawer', function (ev) {
            ev.preventDefault();
            if (window.PMUCampos) { window.PMUCampos.probar(); }
        });

        // Fondo y "x" cierran; Esc cierra; Ctrl+Enter guarda.
        $(document).on('click', '#ec-c-drawer [data-cerrar]', function (ev) {
            ev.preventDefault();
            cerrarDrawer();
        });
        $(document).on('keydown', function (ev) {
            // El modal de la vista previa va ENCIMA del drawer: Esc cierra primero
            // el modal y, si ya no esta, el drawer.
            if (ev.key === 'Escape' || ev.key === 'Esc') {
                if (cerrarPreview()) { ev.preventDefault(); return; }
                if (!$drawer.length || $drawer.prop('hidden')) { return; }
                ev.preventDefault();
                cerrarDrawer();
            } else if (!$drawer.length || $drawer.prop('hidden')) {
                return;
            } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                ev.preventDefault();
                $cuerpoDrawer.find('form.ec-form-campo').trigger('submit');
            }
        });

        function enlazarFormularios($forms) {
            $forms.each(function () {
                var $f = $(this);
                var esEdicion = $f.find('input[name=id]').length > 0;
                pmuForm($f, 'personalizador_pdf_campo', nonceCampo, function (d) {
                    var id = (d && d.id) || 0;
                    if (esEdicion && d && d.campo) {
                        pintarFila(d.campo);
                        cerrarDrawer(true);   // recien guardado: no preguntar
                        pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' guardado.');
                        return;
                    }
                    // Alta: el servidor devuelve el HTML de la fila Y el de su
                    // formulario, claves `html` y `form` (fuente unica del markup,
                    // la misma que pinta campos.php). Sin recargar.
                    if (d && d.html) {
                        // La tabla se imprime siempre (aunque este vacia), asi que
                        // siempre hay tbody donde insertar.
                        var $nuevas = parsearFilas(d.html);
                        $('.ec-campos-cuerpo').append($nuevas); // mueve los nodos con sus handlers
                        if (d.form) {
                            // El formulario de ALTA vuelve al dormitorio vacio: es
                            // el que se acaba de usar, no el del campo recien creado.
                            $f[0].reset();
                            var $nuevoForm = parsearForms(d.form);
                            $dormitorio.append($nuevoForm);
                            enlazarFormularios($nuevoForm.find('form.ec-form-campo'));
                        }
                        $('.ec-campos-vacio').remove();
                        enlazarBaja($nuevas.find('form.ec-form-campo-baja'));
                        cerrarDrawer(true);
                        if (window.PMUCampos && window.PMUCampos.refrescar) { window.PMUCampos.refrescar(); }
                        pmuAviso($f.closest('.card, .wrap'), 'Campo ' + id + ' creado.');
                        return;
                    }
                    $f[0].reset();
                    cerrarDrawer(true);
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
                    // El formulario ya no cuelga de la fila: vive en el dormitorio.
                    var $fila = $f.closest('tr[data-id]');
                    if (drawerId === (parseInt(id, 10) || 0)) { cerrarDrawer(true); }
                    $('.ec-campo-form[data-form="' + id + '"]').remove();
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

        // Los bloques de F3/F4 y el preview (abajo) corren fuera de este ready:
        // se publican aqui para que alcancen el nonce y los ayudantes del editor.
        window.PMUCampos = {
            nonce: (cfgGlobal.nonceAccion && cfgGlobal.nonceAccion.campo)
                || (window.PMU_CAMPO && PMU_CAMPO.nonce) || '',
            pintar: pintarFila,
            abrir: abrirDrawer,
            cerrar: cerrarDrawer,
            probar: function () { abrirPreview(drawerId); },
            enlazarBaja: enlazarBaja,
            enlazarFormularios: enlazarFormularios
        };
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

    // --- Alta rapida de campos (modal: nombre + tipo, spec 015 D10) ---
    $(document).on('click', '.ec-nuevo-campo', function () {
        $('.ec-modal-campo').removeAttr('hidden');
        $('.ec-modal-campo .ec-campo-status').removeClass('ec-error ec-ok').text('');
        $('.ec-modal-campo .ec-campo-nombre').trigger('focus');
    });

    $(document).on('click', '.ec-modal-campo .ec-campo-cancelar', function () {
        $('.ec-modal-campo').attr('hidden', true);
    });

    $(document).on('click', '.ec-modal-campo .ec-campo-crear', function () {
        var $status = $('.ec-modal-campo .ec-campo-status');
        var nombre = ($('.ec-modal-campo .ec-campo-nombre').val() || '').trim();
        var titulo = ($('.ec-modal-campo .ec-campo-titulo').val() || '').trim();
        var tipo = $('.ec-modal-campo .ec-campo-tipo').val() || 'texto';
        if (nombre === '') {
            $status.addClass('ec-error').text('Escribi un nombre.');
            return;
        }
        $status.removeClass('ec-error ec-ok').text('Creando...');
        // Payload v2 (spec 012) con `tipo` (spec 015 D10); sin categorias (D9).
        var nuevo = {
            nombre: nombre,
            tipo: tipo,
            titulo_cliente: titulo
        };
        pmuPost('personalizador_pdf_campo', nuevo, cfgGlobal.nonceCampo || '')
            .then(function (res) { campoCreado(res.data, nombre, $status); })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo crear el campo (red).';
                $status.addClass('ec-error').text(msg);
            });
    });

    /** Alta de campo reutilizable: actualiza selects y cierra el modal. */
    function campoCreado(data, nombre, $status) {
        var id = (data && data.id) || 0;
        // El servidor devuelve la fila v2; el nombre visible es el que eligio el admin.
        var guardado = (data && data.campo) ? data.campo : null;
        var titulo = guardado && guardado.datos ? (guardado.datos.nombre || nombre) : nombre;
        var tipo = guardado ? (guardado.tipo || '') : '';
        if (id > 0) {
            var etiqueta = id + ' — ' + titulo + (tipo ? ' (' + tipo + ')' : '');
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
        $('.ec-modal-campo .ec-campo-nombre').val('');
        $('.ec-modal-campo .ec-campo-titulo').val('');
        setTimeout(function () {
            $('.ec-modal-campo').attr('hidden', true);
            $status.text('');
        }, 1200);
    }

    /* ============ Filtros de la tabla (spec 012 F3 / 015 D9) ============
           Buscador por texto (nombre, subtitulo y tipo) + orden. Todo en el DOM
           (las filas ya traen data-tipo/data-modificado/data-creado), sin
           peticiones: el orden de la tabla NO altera el panel del comprador
           (FR-014, eso lo manda config.json:campos_ids[]). Sin chips de
           categoria: se fueron con las categorias (spec 015 D9). */
        var refrescarCampos = function () {}; // la reemplaza el bloque de filtros
        (function () {
            var $tabla = $('.ec-campos-tabla');
            if (!$tabla.length) { return; }
            var $cuerpo = $tabla.find('.ec-campos-cuerpo');

            function filas() {
                // Solo filas de campo (no las de formulario ni las de preview).
                return $cuerpo.children('tr[data-id]');
            }

            function textoDe($fila) {
                return [
                    $fila.find('.ec-c-nombre').text(),
                    $fila.find('.ec-c-sub').text(),
                    $fila.attr('data-tipo') || ''
                ].join(' ').toLowerCase();
            }

            function aplicar() {
                var q = ($('.ec-c-buscar').val() || '').trim().toLowerCase();
                var visibles = 0;
                filas().each(function () {
                    var $f = $(this);
                    // Spec 015 D9: sin chips de categoria; el buscador va por texto.
                    var pasa = !q || textoDe($f).indexOf(q) !== -1;
                    $f.toggle(pasa);
                    if (pasa) { visibles++; }
                });
                $('.ec-c-conteo').text(visibles + ' de ' + filas().length + ' campos');
            }

            function ordenar(clave) {
                var $filas = filas().get();
                $filas.sort(function (a, b) {
                    var fa = $(a), fb = $(b);
                    if (clave === 'modificado' || clave === 'creado') {
                        return (parseInt(fb.attr('data-' + clave), 10) || 0)
                            - (parseInt(fa.attr('data-' + clave), 10) || 0);
                    }
                    if (clave === 'nombre') {
                        return fa.find('.ec-c-nombre').text().localeCompare(fb.find('.ec-c-nombre').text());
                    }
                    if (clave === 'tipo') {
                        // Orden fijo (texto, imagen, opciones) y no alfabetico: asi
                        // los campos del mismo tipo quedan juntos.
                        var orden = ['texto', 'imagen', 'opciones'];
                        var ta = orden.indexOf(fa.attr('data-tipo') || '');
                        var tb = orden.indexOf(fb.attr('data-tipo') || '');
                        if (ta !== tb) { return (ta < 0 ? 99 : ta) - (tb < 0 ? 99 : tb); }
                    }
                    return (parseInt(fa.attr('data-id'), 10) || 0) - (parseInt(fb.attr('data-id'), 10) || 0);
                });
                // El editor ya no cuelga de la fila (vive en el dormitorio), asi
                // que alcanza con reordenar las filas.
                $.each($filas, function (_, $fila) { $cuerpo.append($fila); });
            }

            $(document).on('input', '.ec-c-buscar', aplicar);
            $(document).on('change', '.ec-c-orden-sel', function () {
                ordenar($(this).val());
                aplicar();
            });
            aplicar();
            refrescarCampos = aplicar; // la reutilizan duplicar/importar
            // El alta desde el drawer la necesita para contar la fila nueva.
            if (window.PMUCampos) { window.PMUCampos.refrescar = aplicar; }
        })();

    /** Parsea el HTML de filas del servidor. Ojo: `$(html)` DESCARTA los
         `<tr>` (jQuery no los parsea fuera de una tabla), asi que se envuelve
         en una tabla auxiliar. Desde spec 013 el editor no cuelga de la fila,
         asi que aca hay SOLO filas de campo. */
        function parsearFilas(html)
        {
            var $aux = $('<div>').append('<table><tbody>' + html + '</tbody></table>');
            return $aux.children('table').children('tbody').children('tr');
        }

        /** Parsea el HTML de un formulario de campo (clave `form` del alta y del
         duplicado). Es un `<div>`, asi que entra directo por `$(html)`. */
        function parsearForms(html)
        {
            return $($.trim(html || ''));
        }

        // Importar: se intercepta (pmuForm devuelve JSON y NO navega).
        // Exportar NO se intercepta: es una descarga, asi que el form se
        // envia NATIVAMENTE y el navegador guarda el archivo (Content-Disposition).
        // El nonce se LEE en cada llamada: al cargar este script PMUCampos todavia
        // no existe (se asigna en el ready de arriba) y una variable congelada
        // quedaria en '' para siempre.
        function nonceC() {
            return (window.PMUCampos && window.PMUCampos.nonce) || '';
        }

        /* ============ CSS/JS global del plugin (spec 012, T020) ============
           El form del global usa su propia action, asi que no entra en
           enlazarFormularios(). Se enlaza aqui (NO dentro de otro submit):
           pmuForm REGISTRA el handler, y llamarlo desde un submit lo agrega
           tarde, con lo que el POST nunca sale. Al guardar recarga: el
           portador del preview lo imprime el servidor y debe quedar al dia. */
        pmuForm($('form.ec-form-campo-global'), 'personalizador_pdf_campo_global',
            nonceC(), function () {
                window.setTimeout(function () { window.location.reload(); }, 600);
            });

        // Duplicar: crea un id NUEVO con el mismo contenido (T016).
        $(document).on('click', '.ec-c-acciones .ec-duplicar', function (ev) {
            ev.preventDefault();
            var $fila = $(this).closest('tr[data-id]');
            var id = parseInt($fila.attr('data-id'), 10) || 0;
            pmuPost('personalizador_pdf_campo_duplicar', { id: id }, nonceC())
                .then(function (res) {
                    if (!res.data || !res.data.html) { return; }
                    var $nuevo = parsearFilas(res.data.html);
                    $('.ec-campos-cuerpo').append($nuevo);
                    if (window.PMUCampos) {
                        window.PMUCampos.enlazarBaja($nuevo.find('form.ec-form-campo-baja'));
                    }
                    // El duplicado tambien trae su formulario dormido (clave `form`).
                    if (res.data.form) {
                        var $formNuevo = parsearForms(res.data.form);
                        $('#ec-campo-forms').append($formNuevo);
                        if (window.PMUCampos) {
                            window.PMUCampos.enlazarFormularios($formNuevo.find('form.ec-form-campo'));
                        }
                    }
                    refrescarCampos(); // re-evalua el buscador con la fila nueva
                    pmuAviso($fila.closest('.card, .wrap'), 'Duplicado como campo ' + res.data.id + '.');
                })
                .catch(function (e) {
                    pmuAviso($fila.closest('.card, .wrap'),
                        (e && e.message) || 'No se pudo duplicar.', true);
                });
        });

        /* ============ Preview del campo (spec 012, T011) ============
           Un <iframe srcdoc> de 350px (el max-width real de .pmu-panel) que
           monta el campo con `PMUCampo.montar()`: el MISMO modulo que usa la
           ficha, asi que el admin ve exactamente lo que vera el comprador.
           Va en un iframe a proposito: un CSS runaway no rompe la consola. */
        function hojasDelTema() {
            var hrefs = [];
            $('link[rel="stylesheet"]').each(function () {
                var h = $(this).attr('href');
                if (h) { hrefs.push(h); }
            });
            return hrefs;
        }

        function escapar(s) {
            return String(s === undefined || s === null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        /** Lee el campo tal como esta ahora en su formulario (puede traer cambios sin
         * guardar). T011b/FR-009: el `cargador` viaja en la fila (lo emite el
         * servidor), no en el formulario, porque vive en `datos.json`. */
        function leerCampoDeLaFila($fila) {
            var id = parseInt($fila.attr('data-id'), 10) || 0;
            // El editor vive en el dormitorio (#ec-campo-forms), no pegado a la fila.
            var $campo = $('.ec-campo-form[data-form="' + id + '"]');
            if (!$campo.length) { return null; }
            var val = function (sel) { return ($campo.find(sel).val() || ''); };
            var crudoCarg = $fila.attr('data-cargador') || '';
            var defCarg = null;
            if (crudoCarg) {
                try { defCarg = JSON.parse(crudoCarg); } catch (e) { defCarg = null; }
            }
            return {
                id: id,
                htm: val('textarea[name=html]'),
                css: val('textarea[name=css]'),
                js: val('textarea[name=js]'),
                cargador: defCarg
            };
        }

        /**
         * CSS global YA prefijado con [data-pmu-panel], que el servidor imprime
         * en un <script type="text/css"> (spec 012, FR-006). El navegador no lo
         * aplica en la consola: solo lo transportamos al iframe. `<\/` era el
         * escape del portador; se deshace al leer.
         */
        function cssGlobalPortador() {
            var el = document.getElementById('pmu-campo-global-css');
            return el ? String(el.textContent || '').replace(/<\\\//g, '</') : '';
        }

        function construirPreview(campo, $status) {
            var enlaces = hojasDelTema().map(function (h) {
                return '<link rel="stylesheet" href="' + escapar(h) + '">';
            }).join('\n');
            var globalCss = cssGlobalPortador();
            var doc = '<!DOCTYPE html><html><head><meta charset="utf-8">'
                + enlaces
                + '<style>body{margin:0;padding:12px;font:14px/1.4 system-ui,sans-serif;background:#fff}'
                + '.pmu-campo{border:1px dashed #c3c4c7;padding:8px;margin:0 0 10px}'
                + '.ec-pv-dato{font:11px/1.3 monospace;color:#50575e;margin-top:8px}'
                + '</style>'
                // El global va DESPUES del CSS de la consola: si no, el borde
                // punteado de .pmu-campo ganaria por orden de cascada.
                + (globalCss ? '<style>' + globalCss + '</style>' : '')
                + '</head><body>'
                // data-pmu-panel: es el ancla que exige el CSS global prefijado.
                + '<div id="pmu-preview" data-pmu-panel></div>'
                + '<div class="ec-pv-dato" id="pmu-preview-dato">valor: - | cliente: -</div>'
                + '<script>window.PMUCampo = ' + JSON.stringify(PMUCampo) + ';</script>'
                + '</body></html>';
            return doc;
        }

        /* Vista previa (spec 013, T016): MODAL centrado con el ancho del panel del
           comprador (una columna de producto de Woo, 324-538 px). Va aparte del
           drawer porque el preview NO es el ancho del editor: a 680 px se ve el
           mismo contenido flotando a la izquierda, que no es como lo ve el
           comprador. Se llama desde la fila (sin abrir el editor) o desde el
           drawer mientras se edita. Monta el campo en el iframe con el MISMO
           modulo que la ficha. */
        function marcoPreview() {
            return $('#ec-pv-modal-cuerpo');
        }

        /** Abre el modal con el campo. `id` 0 = plantilla de alta (sin fila). */
        function abrirPreview(id) {
            if (typeof PMUCampo === 'undefined') {
                pmuAviso($('#ec-pv-modal').closest('.wrap'),
                    'Falta campo-montar.js: no se puede previsualizar.', true);
                return;
            }
            var $fila = $('.ec-campos-cuerpo tr[data-id="' + id + '"]');
            var campo = leerCampoDeLaFila($fila);
            if (!campo || !campo.id) { return; }
            $('#ec-pv-modal').prop('hidden', false);
            var $cuerpo = marcoPreview().empty();
            var $filaTit = $('.ec-campos-cuerpo tr[data-id="' + id + '"] .ec-c-nombre').text();
            $('#ec-pv-modal-titulo').text($filaTit ? $filaTit : 'Vista previa');
            $('<p class="ec-pv-titulo"></p>')
                .text('Así lo verá el comprador (campo ' + campo.id + ')').appendTo($cuerpo);
            var $iframe = $('<iframe class="ec-pv-frame" title="Vista previa del campo"></iframe>')
                .appendTo($cuerpo);
            $iframe.attr('srcdoc', construirPreview(campo));
            var $status = $('<span class="ec-campo-status" aria-live="polite"></span>').appendTo($cuerpo);
            $iframe.on('load', function () {
                var doc = this.contentDocument;
                if (!doc || !doc.getElementById('pmu-preview')) { return; }
                var estado;
                try {
                    estado = PMUCampo.montar(doc.getElementById('pmu-preview'), [campo]);
                // T011b/FR-009: si el campo tiene cargador, se DIBUJA en el preview
                // (medida, forma, min/max) sin subir nada. Se monta desde el padre
                // contra el DOM del iframe: asi el preview usa el MISMO componente
                // que la ficha, sin duplicarlo ni copiar su fuente al srcdoc.
                if (campo.cargador && campo.cargador.ranuras && window.CargadorPMU) {
                    var cuerpo = doc.querySelector('.pmu-campo-' + campo.id + ' .pmu-campo-cuerpo');
                    if (cuerpo) {
                        new window.CargadorPMU(cuerpo, {
                            ranuras: campo.cargador.ranuras,
                            preview: true
                        }).montar();
                    }
                }
                } catch (e) {
                    $status.addClass('ec-error').text('El JS del campo fallo: ' + e.message);
                    return;
                }
                var par = estado[campo.id] || {};
                var dato = doc.getElementById('pmu-preview-dato');
                if (dato) {
                    dato.textContent = 'valor: ' + JSON.stringify(par.valor === undefined ? null : par.valor)
                        + '  |  cliente: ' + JSON.stringify(par.cliente || '');
                }
            });
        }

        function cerrarPreview() {
            if ($('#ec-pv-modal').prop('hidden')) { return false; }
            marcoPreview().empty();
            $('#ec-pv-modal').prop('hidden', true);
            return true;
        }

        $(document).on('click', '#ec-pv-modal [data-cerrar-pv]', function (ev) {
            ev.preventDefault();
            cerrarPreview();
        });

        /* El boton "Probar" de la fila abre el MODAL, sin abrir el editor. */
        $(document).on('click', '.ec-c-acciones .ec-probar', function (ev) {
            ev.preventDefault();
            var id = parseInt($(this).closest('tr[data-id]').attr('data-id'), 10) || 0;
            abrirPreview(id);
        });

    /* ============ 3. Acciones sin recarga (re-analizar, borrar, regenerar) ============ */

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
                var avisos = (j && j.data && j.data.avisos_cableado) || [];
                if (avisos.length) {
                    // FR-008: el tipo declara, el cableado decide. Si un
                    // `opciones` cayo en `value` (o un `texto` en `settings`),
                    // se muestra con causa, pero NO se bloquea.
                    $status.removeClass('ec-ok ec-error').addClass('ec-error')
                        .text('Guardado, pero revisá el cableado: ' + avisos.join(' '));
                } else {
                    $status.addClass('ec-ok').text('Guardado ✓');
                }
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
