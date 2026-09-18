/**
 * mockups.js - Editor de mockups del admin (spec 004, T008).
 *
 * El mockup es la "fotografia" simulada 300x300px del producto en uso: capas
 * `img` (fotos del admin en pdfs/{nombre}/mockups/) y `placeholder` (grupos del
 * PDF, con `{grupo}` o `{grupo}#{indice}`), cada una con x/y/w/h/rot/sesgo y
 * filtros por capa (solo afectan al mockup).
 *
 * Este editor define la GEOMETRIA de la composicion (posicion/encuadre); el
 * render final con el texto del cliente usa el motor TextMuy (RenderCore) en la
 * vista previa de la ficha (T014). Se guarda via action=personalizador_pdf_config
 * (campo `mockups` JSON) -> PMU_Uploads::guardar_config (config.json:mockups[]).
 */
jQuery(function ($) {
    'use strict';

    var cfg = window.PersonalizadorPDF || {};
    var datos = cfg.mockups || {};
    var $raiz = $('.ec-acordeon-mockups .ec-acordeon-cuerpo');
    if (!$raiz.length || !datos.pdf) {
        return;
    }

    var LIENZO = 300;
    var estado = { mockups: datos.mockups || [], actual: 0, seleccion: -1 };
    var fotos = datos.fotos || {};
    var grupos = datos.grupos || [];

    function plantilla() {
        return '' +
            '<div class="ec-mk-editor">' +
            '  <div class="ec-mk-barra">' +
            '    <select class="ec-mk-select"></select>' +
            '    <button type="button" class="button button-small ec-mk-nuevo">Nuevo</button>' +
            '    <button type="button" class="button button-small ec-mk-duplicar">Duplicar</button>' +
            '    <button type="button" class="button button-small button-link-delete ec-mk-eliminar">Eliminar</button>' +
            '  </div>' +
            '  <div class="ec-mk-cuerpo">' +
            '    <div class="ec-mk-lienzo"><canvas width="' + LIENZO + '" height="' + LIENZO + '"></canvas></div>' +
            '    <div class="ec-mk-panel">' +
            '      <p><label>Titulo de la vista<br><input type="text" class="ec-mk-titulo" maxlength="200"></label></p>' +
            '      <p class="ec-mk-add">' +
            '        <button type="button" class="button button-small ec-mk-add-img">+ Foto</button>' +
            '        <button type="button" class="button button-small ec-mk-add-ph">+ Placeholder</button>' +
            '      </p>' +
            '      <ul class="ec-mk-capas"></ul>' +
            '      <div class="ec-mk-props" hidden></div>' +
            '      <p class="ec-mk-acciones">' +
            '        <button type="button" class="button button-primary ec-mk-guardar">Guardar mockups</button>' +
            '        <span class="ec-mk-status" aria-live="polite"></span>' +
            '      </p>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '<p class="description">Filtros y encuadre afectan SOLO al mockup: el PNG del pool y el PDF final van limpios (el Motor no aplica filtros).</p>';
    }

    $raiz.prepend(plantilla());
    var $ed = $raiz.find('.ec-mk-editor');
    var ctx = $ed.find('canvas')[0].getContext('2d');

    function mockup() { return estado.mockups[estado.actual] || null; }
    function capa() {
        var m = mockup();
        return m && m.capas ? m.capas[estado.seleccion] : null;
    }

    function pintarSelect() {
        var $sel = $ed.find('.ec-mk-select').empty();
        if (!estado.mockups.length) {
            $sel.append('<option value="">(sin mockups)</option>');
        } else {
            estado.mockups.forEach(function (m, i) {
                $sel.append($('<option>').attr('value', i).text(m.id + (m.titulo ? ' — ' + m.titulo : '')));
            });
            $sel.val(estado.actual);
        }
        $ed.find('.ec-mk-titulo').val(mockup() ? (mockup().titulo || '') : '');
    }

    function pintarCapas() {
        var $ul = $ed.find('.ec-mk-capas').empty();
        var m = mockup();
        if (!m || !m.capas || !m.capas.length) {
            $ul.append('<li class="description">Sin capas. Agrega una foto o un placeholder.</li>');
            return;
        }
        m.capas.forEach(function (c, i) {
            var $li = $('<li>').toggleClass('ec-mk-sel', i === estado.seleccion)
                .append($('<button type="button" class="button-link ec-mk-pick">').attr('data-i', i)
                    .text((c.tipo === 'img' ? 'Foto: ' : 'Placeholder: ') + c.ref))
                .append($('<button type="button" class="button-link ec-mk-subir" title="Subir capa">&#8593;</button>').attr('data-i', i))
                .append($('<button type="button" class="button-link ec-mk-bajar" title="Bajar capa">&#8595;</button>').attr('data-i', i))
                .append($('<button type="button" class="button-link ec-mk-borrar" title="Quitar capa">&times;</button>').attr('data-i', i));
            $ul.append($li);
        });
    }

    function pintarProps() {
        var c = capa();
        var $p = $ed.find('.ec-mk-props');
        if (!c) {
            $p.attr('hidden', true).empty();
            return;
        }
        var campos = [
            ['x', 'X'], ['y', 'Y'], ['w', 'Ancho'], ['h', 'Alto'],
            ['rot', 'Rotacion (grados)'], ['sesgo', 'Sesgo (-1..1)']
        ];
        var html = '<table class="form-table ec-mk-tabla"><tbody>';
        campos.forEach(function (f) {
            html += '<tr><th><label>' + f[1] + '</label></th><td>' +
                '<input type="number" class="ec-mk-f" data-campo="' + f[0] + '" value="' + c[f[0]] +
                '" step="' + (f[0] === 'sesgo' ? '0.01' : '1') + '"></td></tr>';
        });
        ['brillo', 'contraste', 'saturacion'].forEach(function (f) {
            var v = (c.filtros && c.filtros[f]) ? c.filtros[f] : 100;
            html += '<tr><th><label>' + f + ' %</label></th><td>' +
                '<input type="number" class="ec-mk-f" data-campo="filtros.' + f + '" min="0" max="200" value="' + v + '"></td></tr>';
        });
        html += '</tbody></table>';
        $p.html(html).removeAttr('hidden');
        if (c.tipo === 'placeholder') {
            $p.append('<p class="description">El render con el texto del cliente lo hace TextMuy en la ficha; aqui se define el encuadre.</p>');
        }
    }

    /* ============ Render (Canvas 2D) ============ */

    var cacheImgs = {};

    function imagenDe(url) {
        if (!url) { return null; }
        if (cacheImgs[url]) { return cacheImgs[url]; }
        var img = new Image();
        img.src = url;
        cacheImgs[url] = img;
        return img;
    }

    function filtroCss(f) {
        if (!f) { return 'none'; }
        var partes = [];
        if (f.brillo && +f.brillo !== 100) { partes.push('brightness(' + (+f.brillo / 100) + ')'); }
        if (f.contraste && +f.contraste !== 100) { partes.push('contrast(' + (+f.contraste / 100) + ')'); }
        if (f.saturacion && +f.saturacion !== 100) { partes.push('saturate(' + (+f.saturacion / 100) + ')'); }
        return partes.length ? partes.join(' ') : 'none';
    }

    function dibujar() {
        ctx.clearRect(0, 0, LIENZO, LIENZO);
        var m = mockup();
        if (!m || !m.capas) { return; }
        m.capas.forEach(function (c) {
            ctx.save();
            ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
            ctx.rotate((c.rot || 0) * Math.PI / 180);
            if (c.sesgo) { ctx.transform(1, 0, c.sesgo, 1, 0, 0); }
            ctx.filter = filtroCss(c.filtros);
            if (c.tipo === 'img') {
                var img = imagenDe(fotos[c.ref]);
                if (img && img.complete && img.naturalWidth) {
                    ctx.drawImage(img, -c.w / 2, -c.h / 2, c.w, c.h);
                } else if (img) {
                    img.onload = function () { dibujar(); };
                }
            } else {
                // Placeholder: caja neutra con su ref (define el encuadre).
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                ctx.fillStyle = '#fff';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(c.ref, 0, 0);
            }
            ctx.restore();
        });
    }

    function refrescar() {
        pintarSelect();
        pintarCapas();
        pintarProps();
        dibujar();
    }

    /* ============ Acciones ============ */

    function nuevoMockup(base) {
        var n = 1;
        var ids = estado.mockups.map(function (m) { return m.id; });
        while (ids.indexOf('mockup-' + n) !== -1) { n++; }
        var nuevo = {
            id: 'mockup-' + n,
            titulo: base ? ((base.titulo || '') + ' (copia)') : '',
            creado: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
            capas: base ? JSON.parse(JSON.stringify(base.capas || [])) : []
        };
        estado.mockups.push(nuevo);
        estado.actual = estado.mockups.length - 1;
        estado.seleccion = -1;
        refrescar();
    }

    /* ============ Eventos ============ */

    $ed.on('change', '.ec-mk-select', function () {
        estado.actual = parseInt(this.value, 10) || 0;
        estado.seleccion = -1;
        refrescar();
    });

    $ed.on('input', '.ec-mk-titulo', function () {
        var m = mockup();
        if (m) { m.titulo = $(this).val(); }
    });

    $ed.on('click', '.ec-mk-nuevo', function () { nuevoMockup(null); });
    $ed.on('click', '.ec-mk-duplicar', function () { nuevoMockup(mockup()); });

    $ed.on('click', '.ec-mk-eliminar', function () {
        if (!estado.mockups.length) { return; }
        if (!window.confirm('¿Eliminar el mockup "' + mockup().id + '"?')) { return; }
        estado.mockups.splice(estado.actual, 1);
        estado.actual = Math.max(0, estado.actual - 1);
        estado.seleccion = -1;
        refrescar();
    });

    $ed.on('click', '.ec-mk-add-img', function () {
        var m = mockup();
        if (!m) { window.alert('Crea primero un mockup.'); return; }
        var nombres = Object.keys(fotos);
        if (!nombres.length) { window.alert('Sube primero una foto en este mismo acordeon.'); return; }
        var elegido = window.prompt('Foto (nombre de archivo):\n' + nombres.join('\n'), nombres[0]);
        if (!elegido || nombres.indexOf(elegido) === -1) { return; }
        m.capas = m.capas || [];
        m.capas.push({ tipo: 'img', ref: elegido, x: 0, y: 0, w: LIENZO, h: LIENZO, rot: 0, sesgo: 0, filtros: {} });
        estado.seleccion = m.capas.length - 1;
        refrescar();
    });

    $ed.on('click', '.ec-mk-add-ph', function () {
        var m = mockup();
        if (!m) { window.alert('Crea primero un mockup.'); return; }
        if (!grupos.length) { window.alert('Este PDF no tiene grupos detectados.'); return; }
        var lineas = grupos.map(function (g) {
            return g.id + (g.cont > 1 ? '  (' + g.cont + ' instancias)' : '');
        });
        var elegido = window.prompt('Grupo (id hex; opcional #indice):\n' + lineas.join('\n'), grupos[0].id);
        if (!elegido) { return; }
        var ref = String(elegido).trim().split(/\s+/)[0];
        var g = null;
        grupos.forEach(function (x) { if (x.id === ref.split('#')[0]) { g = x; } });
        if (!g) { window.alert('Grupo no valido.'); return; }
        // Encuadre inicial: el hueco reducido al 40%, centrado en el lienzo.
        var w = Math.max(10, Math.round(g.w * 0.4 / 10) * 10);
        var h = Math.max(10, Math.round(g.h * 0.4 / 10) * 10);
        m.capas = m.capas || [];
        m.capas.push({
            tipo: 'placeholder', ref: ref,
            x: Math.round((LIENZO - w) / 2), y: Math.round((LIENZO - h) / 2),
            w: w, h: h, rot: 0, sesgo: 0, filtros: {}
        });
        estado.seleccion = m.capas.length - 1;
        refrescar();
    });

    $ed.on('click', '.ec-mk-pick', function () {
        estado.seleccion = parseInt($(this).attr('data-i'), 10);
        refrescar();
    });

    $ed.on('click', '.ec-mk-subir, .ec-mk-bajar, .ec-mk-borrar', function () {
        var i = parseInt($(this).attr('data-i'), 10);
        var m = mockup();
        if (!m || !m.capas || !m.capas[i]) { return; }
        if ($(this).hasClass('ec-mk-subir') && i > 0) {
            var a = m.capas.splice(i, 1)[0];
            m.capas.splice(i - 1, 0, a);
            estado.seleccion = i - 1;
        } else if ($(this).hasClass('ec-mk-bajar') && i < m.capas.length - 1) {
            var b = m.capas.splice(i, 1)[0];
            m.capas.splice(i + 1, 0, b);
            estado.seleccion = i + 1;
        } else if ($(this).hasClass('ec-mk-borrar')) {
            m.capas.splice(i, 1);
            estado.seleccion = -1;
        }
        refrescar();
    });

    $ed.on('input', '.ec-mk-f', function () {
        var c = capa();
        if (!c) { return; }
        var campo = String($(this).attr('data-campo'));
        var valor = parseFloat(this.value);
        if (isNaN(valor)) { return; }
        if (campo.indexOf('filtros.') === 0) {
            var f = campo.split('.')[1];
            c.filtros = c.filtros || {};
            if (valor === 100) { delete c.filtros[f]; } else { c.filtros[f] = valor; }
        } else {
            c[campo] = valor;
        }
        dibujar();
    });

    $ed.on('click', '.ec-mk-guardar', function () {
        var $btn = $(this).prop('disabled', true);
        var $st = $ed.find('.ec-mk-status').removeClass('ec-error').text('Guardando...');
        var fd = new FormData();
        fd.set('action', 'personalizador_pdf_mockups');
        fd.set('archivo', datos.pdf + '.pdf');
        fd.set('ajax', '1');
        fd.set('_wpnonce', cfg.nonceMockups || '');
        fd.set('mockups', JSON.stringify(estado.mockups));
        if (datos.preview_omisible) { fd.set('preview_omisible', '1'); }
        fetch(cfg.postUrl || window.location.href, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!(j && j.success)) { throw new Error((j && j.data) || 'No se pudo guardar.'); }
                $st.addClass('ec-ok').text('Guardado ✓');
            })
            .catch(function (e) {
                var msg = (e instanceof Error && e.message) ? e.message : 'No se pudo guardar (red).';
                $st.addClass('ec-error').text(msg);
            })
            .then(function () { $btn.prop('disabled', false); });
    });

    refrescar();
});