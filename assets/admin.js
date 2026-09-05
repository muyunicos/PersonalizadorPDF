jQuery(function ($) {
    'use strict';

    var existentes = (window.ExtractorCorel && ExtractorCorel.existentes) || [];

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
});