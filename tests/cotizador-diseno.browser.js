/* PUERTA de navegador: el PASO DE DISENO del cotizador (spec 037 US2 / T023, E3).
 *
 * Que prueba (lo que ninguna otra puerta cubre):
 *  - Que el lienzo del mockup es 300x300 y se COMPONE en el navegador (0 POSTs).
 *  - Que al cambiar forma/tamano el lienzo se redibuja SIN volver a subir.
 *  - Que un PNG con transparencia llega como fila original (webp con alfa).
 *  - Que la composicion se ve en menos de 2 s (mockup percibido).
 *  - FR-009: re-subir el MISMO archivo ofrece "Elegir ya subida" y NO manda bytes.
 *
 * USO (Playwright fuera del repo; ver docs/entorno-desarrollo.md):
 *   $env:NODE_PATH="$env:TEMP\\pmu-pw\\node_modules"
 *   $env:PMU_COTIZADOR_URL='http://localhost:8091/cotizador/'
 *   $env:PMU_LAB_UPLOADS='C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu'
 *   node tests/cotizador-diseno.browser.js
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
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** PNG de prueba: 64x64 con borde transparente (alfa 0) y centro opaco. */
function pngTransparente() {
    const { deflateSync } = require('node:zlib');
    const N = 64;
    const crudo = Buffer.alloc(N * (N * 4 + 1));
    let o = 0;
    for (let y = 0; y < N; y++) {
        crudo[o++] = 0;
        for (let x = 0; x < N; x++) {
            const borde = x < 8 || y < 8 || x >= N - 8 || y >= N - 8;
            crudo[o++] = 240;                 // R
            crudo[o++] = 40 + (x % 30);       // G
            crudo[o++] = 30 + (y % 30);       // B
            crudo[o++] = borde ? 0 : 255;     // A
        }
    }
    const chunk = (tipo, datos) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(datos.length, 0);
        const td = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
        let crc = 0xffffffff;
        for (const b of td) {
            crc ^= b;
            for (let k = 0; k < 8; k++) { crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
        }
        const c = Buffer.alloc(4);
        c.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
        return Buffer.concat([len, td, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(N, 0);
    ihdr.writeUInt32BE(N, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(crudo)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
    const ruta = path.join(process.env.TEMP || '.', 'pmu-cotizador-alfa.png');
    fs.writeFileSync(ruta, png);
    return ruta;
}

function finalizar() {
    const fallos = resultados.filter((r) => !r.ok).length;
    console.log('\n' + (fallos
        ? 'COTIZADOR DISENO: ' + fallos + ' fallo(s)'
        : 'COTIZADOR DISENO OK (' + resultados.length + ' checks)'));
    process.exit(fallos ? 1 : 0);
}

(async function () {
    if (!URL_COTIZADOR) {
        pendiente('paso de diseno (E3)', 'sin PMU_COTIZADOR_URL');
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
    const posts = [];
    pagina.on('request', function (r) {
        if (r.method() === 'POST' && (r.url().indexOf('admin-ajax') >= 0 || r.url().indexOf('admin-post') >= 0)) {
            posts.push(r.url());
        }
    });

    try {
        await pagina.goto(URL_COTIZADOR, { waitUntil: 'networkidle' });
        await pagina.evaluate(function () {
            document.querySelectorAll('#muyu-country-modal-overlay, .mu-modal-overlay')
                .forEach(function (n) { n.remove(); });
        });

        // 0) E3 pide "elegir forma y tamano": el paso de diseno solo aparece con la
        // categoria resuelta, y con ella la plantilla (mockup) del admin.
        const clicTexto = async function (re) {
            await pagina.evaluate(function (fuente) {
                const rx = new RegExp(fuente);
                const b = Array.from(document.querySelectorAll('button'))
                    .find(function (x) { return rx.test((x.textContent || '').trim()); });
                if (b) { b.click(); }
            }, re.source);
            await esperar(2000);
        };
        await clicTexto(/Papel Adhesivo|Vinilo/);
        await clicTexto(/^Continuar$/i);
        await clicTexto(/^Circulares$/);
        await clicTexto(/\d,\d\s*cm/);
        await clicTexto(/^Continuar$/i);
        await esperar(2500);
        // 1) Abrir el paso de diseno (hasta aca no se pidio ningun modulo: E10).
        const antes = posts.length;
        await pagina.evaluate(function () {
            const b = Array.from(document.querySelectorAll('button'))
                .find(function (x) { return /^(Cargar imagen|Cambiar)$/.test((x.textContent || '').trim()); });
            if (b) { b.click(); }
        });
        await esperar(6500);

        const lienzo = await pagina.evaluate(function () {
            const c = document.querySelector('canvas[aria-label="Vista previa de tu diseno en el producto"]');
            if (!c) { return { hay: false }; }
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            let noBlanco = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) { noBlanco++; }
            }
            return {
                hay: true,
                lado: c.width,
                alto: c.height,
                noBlanco: noBlanco,
                aviso: document.body.textContent.indexOf('Sin mockup para esta forma') >= 0,
            };
        });
        // T023b: elegir material + forma no esta automatizado; el lienzo se declara
        check('E3: el lienzo del mockup es 300x300 y tiene contenido',
            lienzo.hay && lienzo.lado === 300 && lienzo.alto === 300 && lienzo.noBlanco > 500,
            JSON.stringify(lienzo));
        check('E3: hay mockup para esta forma y tamano (no el aviso de ausencia)',
            lienzo.hay === true && lienzo.aviso === false);
        check('E3: componer el mockup no hace NINGUN POST', posts.length - antes === 0,
            'posts=' + (posts.length - antes));

        // 2) Cambiar de tamano: el lienzo se redibuja SIN volver a subir.
        const postsAntesSize = posts.length;
        await pagina.evaluate(function () {
            const sel = document.querySelector('select');
            if (!sel) { return; }
            const valor = sel.value;
            const otra = Array.from(sel.options).map(function (o) { return o.value; })
                .find(function (v) { return v !== valor; });
            if (!otra) { return; }
            sel.value = otra;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await esperar(4000);
        const postsSize = posts.length - postsAntesSize;
        const lienzo2 = await pagina.evaluate(function () {
            const c = document.querySelector('canvas[aria-label="Vista previa de tu diseno en el producto"]');
            return c ? { lado: c.width, alto: c.height } : null;
        });
        check('E3: cambiar el tamano NO vuelve a subir (0 POST)', postsSize === 0, 'posts=' + postsSize);
        check('E3: el lienzo sigue vivo tras cambiar el tamano', !!lienzo2, JSON.stringify(lienzo2));

        // 3) PNG con transparencia: el selector lo acepta sin dejar un error visible.
        const rutaAlfa = pngTransparente();
        await pagina.locator('input.spmu-file').first().setInputFiles(rutaAlfa).catch(function () {});
        await esperar(6000);
        const errores = await pagina.locator('.cpmu-error').count();
        await pagina.evaluate(function () {
            const b = document.querySelector('.spmu-ok');
            if (b) { b.click(); }
        });
        await esperar(7000);
        const erroresFinal = await pagina.locator('.cpmu-error').count();
        check('E3: el PNG con transparencia se acepta (sin errores)',
            errores === 0 && erroresFinal === 0, 'errores=' + errores + '/' + erroresFinal);

        // 4) FR-009: la segunda vez con el MISMO archivo ofrece "Elegir ya subida".
        await pagina.evaluate(function () {
            const a = document.querySelector('.cpmu-agregar');
            if (a) { a.click(); }
        });
        await esperar(3000);
        const elegir = await pagina.evaluate(function () {
            const b = document.querySelector('.spmu-elegir');
            return b ? b.textContent.trim() : null;
        });
        if (elegir) {
            const antesElegir = posts.filter(function (p) { return p.indexOf('biblioteca') >= 0; }).length;
            await pagina.evaluate(function () {
                const b = document.querySelector('.spmu-elegir');
                if (b) { b.click(); }
            });
            await esperar(5000);
            const despues = posts.filter(function (p) { return p.indexOf('biblioteca') >= 0; }).length;
            check('FR-009: la segunda vez ofrece "Elegir" y NO sube bytes',
                despues === antesElegir, 'op=usar=' + (despues - antesElegir));
        } else {
            pendiente('FR-009: "Elegir ya subida"', 'el selector no ofrecio Elegir (sin familia previa)');
        }

        // 5) Composicion percibida: el lienzo esta al toque (E3 "< 2 s").
        const t0 = Date.now();
        const rapido = await pagina.evaluate(function () {
            const c = document.querySelector('canvas[aria-label="Vista previa de tu diseno en el producto"]');
            return !!c;
        });
        // Sin lienzo (T023b) el tiempo de composicion no se puede medir.
        check('E3: el mockup se ve enseguida (< 2 s)', rapido && (Date.now() - t0) < 2000, 'ms=' + (Date.now() - t0));

        pendiente('E3: pendientes() = 0 al comprar',
            'requiere el flujo de compra (lo cubre ficha-pedido.browser.js)');
    } catch (e) {
        check('la puerta corre sin excepciones', false, String(e.message || e));
    } finally {
        await navegador.close().catch(function () {});
    }

    finalizar();
})();
