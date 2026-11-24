/**
 * dom-stub - DOM minimo para probar componentes sin navegador (spec 048, T002).
 *
 * No es jsdom: cubre lo que las suites necesitan (crear/pintar/consultar nodos,
 * classList, dataset, innerHTML, eventos, querySelector simple). Sin dependencias.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.PMUDomStub = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function clases(nodo) {
        return {
            add: function (c) {
                var l = String(nodo.className || '').split(/\s+/).filter(Boolean);
                if (l.indexOf(c) === -1) { l.push(c); }
                nodo.className = l.join(' ');
            },
            remove: function (c) {
                nodo.className = String(nodo.className || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' ');
            },
            contains: function (c) {
                return String(nodo.className || '').split(/\s+/).indexOf(c) !== -1;
            },
            toggle: function (c, on) {
                if (on === undefined) { this.contains(c) ? this.remove(c) : this.add(c); return this.contains(c); }
                on ? this.add(c) : this.remove(c);
                return !!on;
            }
        };
    }

    function coincide(nodo, sel) {
        if (!sel) { return true; }
        if (sel.charAt(0) === '.') { return String(nodo.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1; }
        if (sel.charAt(0) === '#') { return nodo.id === sel.slice(1); }
        return String(nodo.tagName || '').toLowerCase() === sel.toLowerCase();
    }

    function buscarTodos(nodo, sel) {
        var out = [];
        (nodo.childNodes || []).forEach(function (h) {
            if (coincide(h, sel)) { out.push(h); }
            out.push.apply(out, buscarTodos(h, sel));
        });
        return out;
    }

    function crearNodo(etiqueta, doc) {
        var nodo = {
            tagName: String(etiqueta || 'div').toUpperCase(),
            nodeType: 1,
            childNodes: [],
            parentNode: null,
            attributes: {},
            style: {},
            dataset: {},
            className: '',
            id: '',
            textContent: '',
            value: '',
            hidden: false,
            disabled: false,
            checked: false,
            clientWidth: 0,
            clientHeight: 0,
            ownerDocument: doc,
            _ev: {},
            setAttribute: function (k, v) {
                this.attributes[k] = String(v);
                if (k === 'class') { this.className = String(v); }
                if (k === 'id') { this.id = String(v); }
                if (k.indexOf('data-') === 0) {
                    var mk = k.slice(5).replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
                    this.dataset[mk] = String(v);
                }
            },
            getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
            removeAttribute: function (k) { delete this.attributes[k]; },
            appendChild: function (h) { this.childNodes.push(h); h.parentNode = this; return h; },
            removeChild: function (h) { this.childNodes = this.childNodes.filter(function (x) { return x !== h; }); h.parentNode = null; return h; },
            insertBefore: function (h, ref) {
                var i = this.childNodes.indexOf(ref);
                this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, h);
                h.parentNode = this;
                return h;
            },
            addEventListener: function (ev, fn) { (this._ev[ev] = this._ev[ev] || []).push(fn); },
            removeEventListener: function (ev, fn) {
                if (this._ev[ev]) { this._ev[ev] = this._ev[ev].filter(function (x) { return x !== fn; }); }
            },
            dispatchEvent: function (ev) {
                (this._ev[ev.type] || []).slice().forEach(function (fn) { fn.call(this, ev); }, this);
                return true;
            },
            click: function () { this.dispatchEvent({ type: 'click', target: this, preventDefault: function () { } }); },
            querySelector: function (sel) { return buscarTodos(this, sel)[0] || null; },
            querySelectorAll: function (sel) { return buscarTodos(this, sel); },
            closest: function (sel) {
                var n = this;
                while (n) { if (coincide(n, sel)) { return n; } n = n.parentNode; }
                return null;
            },
            getBoundingClientRect: function () {
                return { width: this.clientWidth || 0, height: this.clientHeight || 0, top: 0, left: 0, right: 0, bottom: 0 };
            },
            get firstChild() { return this.childNodes[0] || null; },
            get children() { return this.childNodes; }
        };
        Object.defineProperty(nodo, 'classList', { get: function () { return clases(this); } });
        var html = '';
        Object.defineProperty(nodo, 'innerHTML', {
            get: function () { return html; },
            set: function (v) { html = String(v); if (html === '') { nodo.childNodes = []; } }
        });
        return nodo;
    }

    function crearDocumento() {
        var doc = {
            _byId: {},
            createElement: function (tag) { return crearNodo(tag, doc); },
            createTextNode: function (t) { var n = crearNodo('#text', doc); n.textContent = String(t); return n; },
            getElementById: function (id) { return buscarTodos(doc.documentElement, '#' + String(id))[0] || null; },
            querySelector: function (sel) { return buscarTodos(doc.body, sel)[0] || null; },
            querySelectorAll: function (sel) { return buscarTodos(doc.body, sel); },
            addEventListener: function () { },
            removeEventListener: function () { },
            activeElement: null
        };
        doc.head = crearNodo('head', doc);
        doc.body = crearNodo('body', doc);
        doc.documentElement = crearNodo('html', doc);
        doc.documentElement.appendChild(doc.head);
        doc.documentElement.appendChild(doc.body);
        return doc;
    }

    return { crearDocumento: crearDocumento, crearNodo: crearNodo };
}));