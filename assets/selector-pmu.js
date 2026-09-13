/**
 * selector-pmu - Componente para subida y recorte de imágenes
 * Contrato: contracts/selector-pmu.md
 */

function SelectorPMU(id, config) {
    this.id = id;
    this.config = {
        maxW: config.maxW || 2000,
        maxH: config.maxH || 2000,
        aspectRatio: config.aspectRatio || null,
        mode: config.mode || 'crop',
        category: config.category || ''
    };
    this.selectedUrl = null;
    this.selectedMeta = null;
    this.onSelectCallback = null;
    this.onErrorCallback = null;
}

SelectorPMU.prototype.open = function() {
    // Abre diálogo de selección/corte
    console.log('[selector-pmu] Opening dialog for ' + this.id);
};

SelectorPMU.prototype.onSelect = function(callback) {
    this.onSelectCallback = callback;
};

SelectorPMU.prototype.onError = function(callback) {
    this.onErrorCallback = callback;
};

SelectorPMU.prototype.destroy = function() {
    this.onSelectCallback = null;
    this.onErrorCallback = null;
};

// Exponer globalmente
window.SelectorPMU = SelectorPMU;
