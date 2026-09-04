jQuery(function ($) {
    // Placeholder: la subida es via POST tradicional para maxima compatibilidad
    // en hosting compartido (no requiere heartbeat ni REST API).
    $('form[action*="extractor_corel_upload"]').on('submit', function () {
        var $file = $('input[name="pdf"]');
        if (!$file.val()) {
            alert('Selecciona un PDF antes de continuar.');
            return false;
        }
        return true;
    });
});