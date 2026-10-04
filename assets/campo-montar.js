/**
 * campo-montar.js - Montaje compartido de campos (spec 012, T009).
 *
 * UN SOLO montaje para la ficha del comprador (assets/tienda.js) y para el
 * preview de la consola (admin/campos.php), de modo que el admin vea
 * exactamente lo que vera el comprador (D2, patron `mockup-render.js` de la 011).
 *
 * Un campo es un fragmento HTML con scope `.pmu-campo-{id}`, su CSS opcional y
 * su JS opcional. NO se inyecta titulo: el texto que ve el comprador arriba del
 * campo va escrito en su HTML (D20).
 *
 * REGLAS DE SALIDA del valor dual (en este orden, FR-026):
 *   1. `campo.js` manda: se ejecuta con `function(ctx, root)` y su
 *      `ctx.set(id, {valor, cliente})` publica. Si lanza, el campo queda
 *      `{valor:null, cliente:''}` sin romper la pagina.
 *   2. Sin JS: se leen los `[data-rol]` del HTML
 *      (`data-rol="valor"` -> valor, `data-rol="cliente"` -> cliente).
 *   3. Sin ningun `data-rol`: el primer `input/textarea/select` (compatibilidad).
 *   4. `cliente` nunca cae a `valor`: el sistema NO traduce nada (D21). Si el
 *      campo no publica `cliente`, queda vacio.
 *
 * Es JS puro sin dependencias y exporta `PMUCampo` tambien en Node (`module`)
 * para poder testearlo con `tests/campos-contrato.test.js` (T012).
 */
(function (global) {
    'use strict';

    /** Canal de salida del campo: `ctx.set(id, {valor, cliente})` (y `get`). */
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

    /** Valor de un elemento: `value` si es control, `textContent` si no. */
    function valorDe(el) {
        if (!el) { return ''; }
        var etiqueta = (el.tagName || '').toLowerCase();
        if (etiqueta === 'input' || etiqueta === 'textarea' || etiqueta === 'select') {
            return el.value === undefined ? '' : el.value;
        }
        return el.textContent === undefined ? '' : el.textContent;
    }

    /** Envuelve un campo en su `.pmu-campo-{id}` (sin titulo inyectado, D20). */
    function envolver(campo) {
        var envoltura = document.createElement('div');
        envoltura.className = 'pmu-campo pmu-campo-' + campo.id;
        envoltura.setAttribute('data-campo', campo.id);
        var cuerpo = document.createElement('div');
        cuerpo.className = 'pmu-campo-cuerpo';
        cuerpo.innerHTML = campo.htm || campo.contenido || '';
        envoltura.appendChild(cuerpo);
        return { envoltura: envoltura, cuerpo: cuerpo };
    }

    /** Aplica el `campo.js` de un campo. Devuelve true si habia script. */
    function ejecutarScript(campo, cuerpo, estado) {
        var codigo = campo.js || campo.script;
        if (!codigo) { return false; }
        try {
            var fn = new Function('ctx', 'root', 'return (' + codigo + ')(ctx, root);');
            fn(contextoRaiz(estado), cuerpo);
        } catch (e) {
            estado[campo.id] = { valor: null, cliente: '' };
        }
        return true;
    }

    /** Monta UN campo en `raizEl`. Devuelve su estado. */
    function montarUno(raizEl, campo, estado, previo) {
        var partes = envolver(campo);
        raizEl.appendChild(partes.envoltura);
        if (campo.css) {
            var estilo = document.createElement('style');
            estilo.textContent = campo.css;
            partes.envoltura.appendChild(estilo);
        }
        var cuerpo = partes.cuerpo;
        // 1) el JS del campo manda
        if (ejecutarScript(campo, cuerpo, estado)) {
            return estado[campo.id];
        }
        // 2) data-rol
        var elValor = cuerpo.querySelector('[data-rol="valor"]');
        var elCliente = cuerpo.querySelector('[data-rol="cliente"]');
        if (elValor || elCliente) {
            var publicar = function () {
                estado[campo.id] = {
                    valor: elValor ? valorDe(elValor) : '',
                    cliente: elCliente ? valorDe(elCliente) : ''
                };
            };
            if (elValor) { elValor.addEventListener('input', publicar); }
            if (elCliente) { elCliente.addEventListener('input', publicar); }
            if (previo && elValor) {
                elValor.value = previo.cliente !== '' ? previo.cliente : previo.valor;
            }
            publicar();
            return estado[campo.id];
        }
        // 3) primer control (compatibilidad con campos v1)
        var entrada = cuerpo.querySelector('input,textarea,select');
        if (entrada) {
            var recolectar = function () {
                estado[campo.id] = { valor: entrada.value, cliente: entrada.value };
            };
            if (previo) {
                entrada.value = previo.cliente !== '' ? previo.cliente : previo.valor;
            }
            entrada.addEventListener('input', recolectar);
            recolectar();
        }
        return estado[campo.id];
    }

    /**
     * Monta todos los campos en `raizEl` y devuelve `{campo_id: {valor, cliente}}`.
     * `inicial` (edicion del item) deja los valores guardados disponibles en
     * `ctx.get()` y prellenan el control.
     */
    function montar(raizEl, campos, inicial) {
        var estado = {};
        (campos || []).forEach(function (campo) {
            var previo = inicial && (inicial[String(campo.id)] || inicial[campo.id]);
            if (previo) {
                estado[campo.id] = {
                    valor: previo.valor === undefined ? '' : previo.valor,
                    cliente: previo.cliente === undefined ? '' : String(previo.cliente)
                };
            }
            montarUno(raizEl, campo, estado, previo);
        });
        return estado;
    }

    var PMUCampo = {
        montar: montar,
        montarUno: montarUno,
        contextoRaiz: contextoRaiz,
        valorDe: valorDe
    };
    global.PMUCampo = PMUCampo;
    if (typeof module !== 'undefined' && module.exports) { module.exports = PMUCampo; }
})(typeof window !== 'undefined' ? window : globalThis);