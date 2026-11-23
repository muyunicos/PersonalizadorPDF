/**
 * receta-objetivo - helpers Puros de objetivo y configuracion (spec 044).
 *
 * Una sola implementacion para `cargador-pmu.js` y `selector-pmu.js` (antes estaba
 * duplicada). Sin dependencias: se puede usar en Node y en el navegador.
 *
 * Objetivo = `{aspecto 4 dec}-{familia 0|1}-{area}` (spec 045/046):
 *   - aspecto: `w/h` con 4 decimales
 *   - familia: 1 = redonda (circulo/ovalo), 0 = rect (rectangulo/cuadrado/auto)
 *   - area: `w*h` del w×h resuelto (px²)
 */
(function (global) {
    'use strict';

    function objetivoDe(r) {
        var w = Math.max(1, parseInt(r && r.w, 10) || 1);
        var h = Math.max(1, parseInt(r && r.h, 10) || 1);
        var forma = String((r && r.forma) || '').toLowerCase();
        var familia = (forma === 'circulo' || forma === 'ovalo') ? 1 : 0;
        var aspecto = Math.round((w / h) * 10000) / 10000;
        return {
            clave: aspecto.toFixed(4) + '-' + familia + '-' + (w * h),
            aspecto: aspecto, familia: familia, area: w * h
        };
    }

    /** Interpreta una clave de objetivo; null si no vale. */
    function parseObjetivo(clave) {
        var m = /^(\d+(?:\.\d+)?)-([01])-(\d+)$/.exec(String(clave || ''));
        if (!m) { return null; }
        return { aspecto: parseFloat(m[1]), familia: parseInt(m[2], 10), area: parseInt(m[3], 10) };
    }

    /**
     * Mejor receta de un mapa `objetivo -> delta`: exacta si existe; si no, la mas
     * cercana por aspecto -> familia -> area (sin umbral).
     */
    function mejorReceta(recetas, obj) {
        if (!recetas || !obj) { return null; }
        if (recetas[obj.clave]) { return recetas[obj.clave]; }
        var mejor = null;
        var mejorScore = Infinity;
        Object.keys(recetas).forEach(function (k) {
            var p = parseObjetivo(k);
            if (!p) { return; }
            var score = Math.abs(p.aspecto - obj.aspecto) * 1000
                + (p.familia === obj.familia ? 0 : 10)
                + Math.abs(p.area - obj.area) / Math.max(1, obj.area);
            if (score < mejorScore) { mejorScore = score; mejor = recetas[k]; }
        });
        return mejor;
    }

    var API = { objetivoDe: objetivoDe, parseObjetivo: parseObjetivo, mejorReceta: mejorReceta };
    global.PMURecetaObjetivo = API;
    if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : globalThis);