/**
 * tienda.js - Panel del comprador en la ficha (spec 004, T012).
 *
 * Renderiza los campos del `campos.json` asignados al PDF (HTML/CSS con scope
 * + `script(ctx, root)` en sandbox del propio campo), recolecta el valor dual
 * `{valor, cliente}` y expone el estado para el carrito (T015).
 * Oculta el panel si el PDF esta inactivo o sin grupos (el servidor decide).
 *
 * Sin dependencias salvo el DOM: los campos imagen usan el componente global
 * `SelectorPMU` (assets/selector-pmu.js) cuando el tipo lo requiere.
 */
(function (global) {
    'use strict';

    var cfg = global.PMU_TIENDA || {};

    /** Raiz del panel: el servidor la pinta con data-atributos. */
    function raiz() {
        return document.querySelector('[data-pmu-panel]') || null;
    }

    /**
     * Estado del panel: {campo_id: {valor, cliente}}. Los `script(ctx, root)` de
     * cada campo escriben via ctx.set(id, {valor, cliente}); sin script, el
     * valor crudo del input se duplica como etiqueta.
     */
    function contextoRaiz(estado) {
        return {
            set: function (id, valor) {
                id = parseInt(id, 10) || 0;
                if (id < 1) { return; }
                estado[id] = {
                    valor: (valor && 'valor' in valor) ? valor.valor : null,
                    cliente: (valor && 'cliente' in valor) ? String(valor.cliente || '') : ''
                };
            },
            get: function (id) {
                id = parseInt(id, 10) || 0;
                return estado[id] || null;
            }
        };
    }

    /** Compila los campos: CSS con scope + contenido + script (nunca eval en PHP). */
    function montarCampos(raizEl, campos) {
        var estado = {};
        (campos || []).forEach(function (campo) {
            var envoltura = document.createElement('div');
            envoltura.className = 'pmu-campo pmu-campo-' + campo.id;
            envoltura.setAttribute('data-campo', campo.id);
            var etiqueta = document.createElement('p');
            etiqueta.className = 'pmu-campo-titulo';
            etiqueta.textContent = campo.titulo_cliente || '';
            if (campo.titulo_cliente) { envoltura.appendChild(etiqueta); }
            var cuerpo = document.createElement('div');
            cuerpo.className = 'pmu-campo-cuerpo';
            cuerpo.innerHTML = campo.contenido || '';
            envoltura.appendChild(cuerpo);
            if (campo.texto_ayuda) {
                var ayuda = document.createElement('p');
                ayuda.className = 'pmu-campo-ayuda';
                ayuda.textContent = campo.texto_ayuda;
                envoltura.appendChild(ayuda);
            }
            raizEl.appendChild(envoltura);
            if (campo.css) {
                var estilo = document.createElement('style');
                estilo.textContent = campo.css;
                envoltura.appendChild(estilo);
            }
            if (campo.script) {
                try {
                    var fn = new Function('ctx', 'root', 'return (' + campo.script + ')(ctx, root);');
                    fn(contextoRaiz(estado), cuerpo);
                } catch (e) {
                    estado[campo.id] = { valor: null, cliente: '' };
                }
            } else {
                var entrada = cuerpo.querySelector('input,textarea,select');
                if (entrada) {
                    var recolectar = function () {
                        estado[campo.id] = { valor: entrada.value, cliente: entrada.value };
                    };
                    entrada.addEventListener('input', recolectar);
                    recolectar();
                }
            }
        });
        return estado;
    }

    /** Punto de entrada: el servidor inyecta `window.PMU_FICHA = {pdf, campos, ...}`. */
    function iniciar() {
        var panel = raiz();
        if (!panel) { return null; }
        var ficha = global.PMU_FICHA || {};
        if (!ficha.pdf || !(ficha.campos || []).length) { return null; }
        var estado = montarCampos(panel, ficha.campos);
        var api = {
            pdf: ficha.pdf,
            estado: estado,
            valores: function () { return estado; }
        };
        global.PMU_API = api;
        return api;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    global.PMU_Tienda = { iniciar: iniciar, montarCampos: montarCampos };
})(window);