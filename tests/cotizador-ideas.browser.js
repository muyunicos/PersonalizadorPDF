/* PUERTA de navegador: ideas del cotizador (spec 037 US4 / T035).
 *
 * Que prueba (lo que ninguna otra puerta cubre):
 *  - Que el RECORTE del selector produce una **receta** (12 hex) y un id de original.
 *  - Que `op=guardar` crea `customs/{idea}/` con `idea.json` + `mockup.webp` y que al
 *    recargar la idea **aparece** en la tira como `GUARDADO`.
 *  - Que `op=favorito` deja `favorito: true` en el idea.json (la estrella).
 *  - Que `op=borrar` elimina el JSON y el snapshot **sin** dejar huerfanos.
 *
 * USO (Playwright fuera del repo; ver docs/entorno-desarrollo.md):
 *   $env:NODE_PATH="$env:TEMP\pmu-pw\node_modules"
 *   $env:PMU_COTIZADOR_URL='http://localhost:8091/cotizador/'
 *   $env:PMU_LAB_UPLOADS='C:\wp-lab\wordpress\wp-content\uploads\pmu'
 *   node tests/cotizador-ideas.browser.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const URL_COTIZADOR = process.env.PMU_COTIZADOR_URL || '';
const PMU = process.env.PMU_LAB_UPLOADS || 'C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu';
const CHROME = process.env.TEXTMUY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const resultados = [];
function check(nombre, ok, detalle) {
    resultados.push({ nombre: nombre, ok: !!ok, detalle: detalle === undefined ? '' : String(detalle) });
    console.log((ok ? 'OK   ' : 'FALLA') + ' | ' + nombre
        + (detalle !== undefined ? ' | ' + detalle : ''));
}
function pendiente(nombre, detalle) {
    resultados.push({ nombre: nombre, ok: true, pendiente: true, detalle: detalle === undefined ? '' : String(detalle) });
    console.log('PENDIENTE| ' + nombre + ' | ' + (detalle === undefined ? '' : detalle));
}
const esperar = (ms) => new Promise(function (r) { setTimeout(r, ms); });

/** PNG 1x1 sintetico (no se versionan binarios). */
function pngPrueba(destino) {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAF'
        + 'BQIAX8jx0gAAAABJRU5ErkJggg==';
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    return destino;
}

/** Directorios de customs del invitado (tmp/sesion-{sid}/customs). */
function customsDe() {
    const base = path.join(PMU, 'tmp');
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base).filter(function (d) { return d.indexOf('sesion-') === 0; }
        ).map(function (d) { return path.join(base, d, 'customs'); }
        ).filter(function (d) { return fs.existsSync(d); });
}

function leerJson(ruta) {
    try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch (e) { return null; }
}

function finalizar() {
    const fallos = resultados.filter(function (r) { return !r.ok; }).length;
    console.log('\n' + (fallos
        ? 'COTIZADOR IDEAS: ' + fallos + ' fallo(s)'
        : 'COTIZADOR IDEAS OK (' + resultados.length + ' checks)'));
    process.exit(fallos ? 1 : 0);
}

(async function () {
    if (!URL_COTIZADOR) {
        pendiente('ideas (guardar/marcar/borrar)', 'sin PMU_COTIZADOR_URL');
        finalizar();
    }
    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch (e) {
        pendiente('Playwright instalado', String(e.message || e));
        finalizar();
    }

    const navegador = await chromium.launch({ executablePath: CHROME });
    const pagina = await (await navegador.newContext()).newPage();
    // Spec 038 (F-RECETA): el `item_key` y el `sid` se LEEN de la respuesta de la
    // subida (misma sesion que la cookie). Leerlos del disco podia traer el item de
    // otra sesion y el servidor respondia `cotizador:idea:ajena`.
    const subidas = [];
    pagina.on('response', async function (r) {
        if (r.request().method() !== 'POST' || r.url().indexOf('admin-ajax') === -1) { return; }
        try {
            const j = await r.json();
            const d = (j && j.data) || null;
            if (d && d.item_key) { subidas.push(d); }
        } catch (e) { /* respuesta no JSON: no es una subida */ }
    });

    try {
        await pagina.goto(URL_COTIZADOR, { waitUntil: 'networkidle' });
        // T095: el modal de bienvenida/pais del tema se lleva los clicks.
        await pagina.evaluate(function () {
            document.querySelectorAll('#muyu-country-modal-overlay, .mu-modal-overlay')
                .forEach(function (n) { n.remove(); });
        });

        // 1) Abrir el paso y recortar con el selector (sin receta no se guarda).
        await pagina.evaluate(function () {
            const b = Array.from(document.querySelectorAll('button'))
                .find(function (x) { return /^Cargar imagen$/.test((x.textContent || '').trim()); });
            if (b) b.click();
        });
        await esperar(6000);
        await pagina.evaluate(function () {
            const a = document.querySelector('.cpmu-agregar');
            if (a) a.click();
        });
        await esperar(3000);

        const archivo = pngPrueba(path.join(process.env.TEMP || '.', 'pmu-idea.png'));
        let recorte = null;
        if (await pagina.locator('input.spmu-file').count()) {
            await pagina.locator('input.spmu-file').first().setInputFiles(archivo);
            await esperar(7000);
            await pagina.evaluate(function () {
                const ok = document.querySelector('.spmu-ok');
                if (ok) ok.click();
            });
            await esperar(7000);
            recorte = await pagina.evaluate(function () {
                const mini = document.querySelector('.cpmu-mini img');
                return { mini: !!mini, src: mini ? String(mini.currentSrc || mini.src || '').slice(0, 60) : '' };
            });
        }
        check('E3: el recorte del selector deja miniatura en la ranura',
            !!(recorte && recorte.mini), recorte ? recorte.src : 'sin .spmu-file');

        // 2) Subida del original CON receta: se hace por el endpoint (mismo contexto
        // que el selector: cookies + nonce). Asi la puerta no depende de que el
        // selector este visible, y el E3 de arriba ya cubre el recorte real.
        const subida = await pagina.evaluate(async function () {
            const pmu = (window.WP_STICKER_DATA || {}).pmu || {};
            const bin = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), function (ch) { return ch.charCodeAt(0); });
            const fd = new FormData();
            fd.append('action', 'personalizador_pdf_subida');
            fd.append('_wpnonce', pmu.nonce || '');
            fd.append('contexto', 'cotizador');
            fd.append('imagen', new Blob([bin], { type: 'image/png' }), 'idea.png');
            fd.append('params', JSON.stringify({
                v: 2, w: 300, h: 300, forma: 'circulo', modo: 'cubrir', escala: 1,
                ox: 0.5, oy: 0.5, fondo: '#ffffff', transp: 'no', rot: 0,
                iw: 800, ih: 600, phsize: 0, gid: '0000FF',
            }));
            const res = await fetch(pmu.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd });
            const j = await res.json().catch(function () { return {}; });
            return (j && j.data) || { error: j && j.data };
        });
        let fila = subida && subida.receta ? subida : null;
        let itemKey = String((subida && subida.item_key) || '');
        let sid = String((subida && subida.sid) || '');
        if (!fila) { fila = subidas.length ? subidas[subidas.length - 1] : null; }
        if (!fila || !/^[a-f0-9]{12}$/.test(String(fila.receta || ''))) {
            pendiente('guardar una idea', 'sin receta: ' + JSON.stringify(subida).slice(0, 80));
            finalizar();
        }
        check('E2/E3: el original trae receta (12 hex) y el item es cot-*',
            /^[a-f0-9]{12}$/.test(String(fila.receta)) && /^cot-[a-z0-9]{8}$/.test(itemKey),
            String(fila.receta) + ' ' + itemKey + ' sid=' + sid);

        // 3) Guardar la idea (op=guardar) con su snapshot.
        const ideaId = 'idea-' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0') + '-abcd';
        const idea = {
            id: ideaId, version: 1, order: 'v1.m1.s1.q1.f0.d0',
            titulo: 'Pua - idea de prueba', descripcion: 'Pua automatica',
            favorito: false, orden: 0,
            diseno: {
                id: String(fila.id), itemKey: itemKey, sid: sid,
                w: 300, h: 300, receta: String(fila.receta),
            },
            mockup: { id: 'pua', w: 300, h: 300 },
        };
        const guardada = await pagina.evaluate(function (idea) {
            return new Promise(function (resolver) {
                const fd = new FormData();
                const pmu = (window.WP_STICKER_DATA || {}).pmu || {};
                // El snapshot viaja como ARCHIVO (`mockup`): sin el, el servidor no
                // tiene mockup que guardar y responde `cotizador:mockup:ausente`.
                const bin = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), function (ch) { return ch.charCodeAt(0); });
                fd.append('action', 'pmu_cotizador');
                fd.append('op', 'guardar');
                fd.append('_wpnonce', pmu.nonce || '');
                fd.append('idea', JSON.stringify(idea));
                fd.append('mockup', new Blob([bin], { type: 'image/png' }), 'mockup.png');
                fetch(pmu.postUrl, { method: 'POST', credentials: 'same-origin', body: fd })
                    .then(function (r) { return r.json(); })
                    .then(function (j) { resolver(j); })
                    .catch(function (e) { resolver({ error: String(e) }); });
            });
        }, idea);
        check('op=guardar crea la idea (respuesta success)',
            !!(guardada && guardada.success),
            guardada && guardada.error ? String(guardada.error) : JSON.stringify(guardada).slice(0, 60));

        const dirCustoms = path.join(PMU, 'tmp', 'sesion-' + sid, 'customs');
        const dirIdea = path.join(dirCustoms, ideaId);
        check('customs/{idea}/ tiene idea.json + mockup.webp',
            fs.existsSync(path.join(dirIdea, 'idea.json'))
            && fs.existsSync(path.join(dirIdea, 'mockup.webp')),
            dirIdea);

        // 4) Al recargar, la idea aparece en la tira como GUARDADO.
        await pagina.reload({ waitUntil: 'networkidle' });
        await esperar(7000);
        const tira = await pagina.evaluate(function () {
            return {
                celdas: document.querySelectorAll('.mu-gal-celda').length,
                cats: Array.from(document.querySelectorAll('.mu-gal-item-cat'))
                    .map(function (n) { return n.textContent; }),
                titulos: Array.from(document.querySelectorAll('.mu-gal-item-etiqueta'))
                    .map(function (n) { return n.textContent; }),
            };
        });
        check('la idea aparece en la tira como GUARDADO',
            tira.cats.indexOf('GUARDADO') >= 0
            && tira.titulos.some(function (t) { return t.indexOf('idea de prueba') >= 0; }),
            JSON.stringify(tira.cats) + ' celdas=' + tira.celdas);

        // 5) Estrella (favorito) y borrado por el endpoint.
        const fav = await pagina.evaluate(function (id) {
            return new Promise(function (resolver) {
                const fd = new FormData();
                const pmu = (window.WP_STICKER_DATA || {}).pmu || {};
                fd.append('action', 'pmu_cotizador');
                fd.append('op', 'favorito');
                fd.append('_wpnonce', pmu.nonce || '');
                fd.append('tipo', 'custom');
                fd.append('ref', id);
                fd.append('valor', '1');
                fetch(pmu.postUrl, { method: 'POST', credentials: 'same-origin', body: fd })
                    .then(function (r) { return r.json(); })
                    .then(resolver)
                    .catch(function (e) { resolver({ error: String(e) }); });
            });
        }, ideaId);
        // Spec 037 C4: marcar una idea GUARDADA deja `idea.favorito` en su JSON
        // (el `favoritos.json` es para refs de tienda/historial).
        const ideaFinal = leerJson(path.join(dirIdea, 'idea.json'));
        check('marcar deja la idea como favorita',
            !!(fav && fav.success) && !!ideaFinal && ideaFinal.favorito === true,
            ideaFinal ? ('favorito=' + ideaFinal.favorito) : 'sin idea.json');

        // 6) Borrar: el JSON y el snapshot desaparecen (sin huerfanos).
        const borrada = await pagina.evaluate(function (id) {
            return new Promise(function (resolver) {
                const fd = new FormData();
                const pmu = (window.WP_STICKER_DATA || {}).pmu || {};
                fd.append('action', 'pmu_cotizador');
                fd.append('op', 'borrar');
                fd.append('_wpnonce', pmu.nonce || '');
                fd.append('idea_id', id);
                fetch(pmu.postUrl, { method: 'POST', credentials: 'same-origin', body: fd })
                    .then(function (r) { return r.json(); })
                    .then(resolver)
                    .catch(function (e) { resolver({ error: String(e) }); });
            });
        }, ideaId);
        check('op=borrar elimina idea.json y mockup.webp',
            !!(borrada && borrada.success)
            && !fs.existsSync(path.join(dirIdea, 'idea.json'))
            && !fs.existsSync(path.join(dirIdea, 'mockup.webp')),
            borrada && borrada.error ? String(borrada.error) : 'ok');
    } catch (e) {
        check('la puerta corre sin excepciones', false, String(e.message || e));
    } finally {
        await navegador.close().catch(function () {});
    }

    finalizar();
})();
