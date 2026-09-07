/* ===== TEXTMUY EXPORT - exact-size transparent PNG ===== */
(function() {
    'use strict';

    let editor = null;
    function init(editorInstance) { editor = editorInstance; }

    function canvasFromSettings(settings) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(100, Math.min(8000, Number(settings.canvas.width) || 1920));
        canvas.height = Math.max(100, Math.min(8000, Number(settings.canvas.height) || 1080));
        const exportSettings = JSON.parse(JSON.stringify(settings));
        // The PNG option is intentionally always transparent.  The checkerboard
        // is a preview aid only and must never become exported pixels.
        exportSettings.background.active = false;
        // Presets can use either the legacy background.image form or the
        // current background.fill.image form.  Both must be disabled for a
        // genuinely transparent export.
        if (exportSettings.background.image) exportSettings.background.image.active = false;
        if (exportSettings.background.fill && exportSettings.background.fill.image) {
            exportSettings.background.fill.image.active = false;
        }
        editor.renderToCanvas(canvas, exportSettings, { transparent: true });
        return canvas;
    }

    function toBlob(canvas) {
        return new Promise(function(resolve, reject) {
            canvas.toBlob(function(blob) {
                if (blob) resolve(blob);
                else reject(new Error('Could not create PNG'));
            }, 'image/png');
        });
    }

    async function download() {
        if (!editor) throw new Error('Export manager has not been initialized');
        const blob = await toBlob(canvasFromSettings(editor.getSettings()));
        saveBlob(blob, generateFileName());
        return blob;
    }

    function saveBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 0);
    }

    function generateFileName() {
        return 'textmuy_' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
    }

    window.ExportManager = { init: init, download: download, canvasFromSettings: canvasFromSettings, toBlob: toBlob };
})();
