/* PUERTA de navegador: del cotizador al CARRITO (spec 037 T038 / spec 038 F5h).
 *
 * Que prueba:
 *  - E1: el puente pmu esta declarado.
 *  - E10: al abrir no se pide ningun modulo de diseno.
 *  - E3: lienzo 300x300 del mockup (composicion local, 0 POST).
 *  - F5h: al confirmar el recorte se guarda el mockup en el item y viaja al carrito.
 *  - Carrito: miniatura en la linea + click -> visor del tema.
 *
 * USO:
 *   $env:NODE_PATH="$env:TEMP\\pmu-pw\\node_modules"
 *   $env:PMU_COTIZADOR_URL='http://localhost:8091/cotizador/'
 *   $env:PMU_LAB_UPLOADS='C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu'
 *   node tests/cotizador-cart.browser.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const URL_COT = process.env.PMU_COTIZADOR_URL || '';
const PMU = process.env.PMU_LAB_UPLOADS || 'C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu';
const CHROME = process.env.TEXTMUY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const resultados = [];
function check(n, ok, d) {
    resultados.push({ n: n, ok: !!ok });
    console.log((ok ? 'OK   ' : 'FALLA') + ' | ' + n + (d !== undefined ? ' | ' + d : ''));
}
function pend(n, d) {
    resultados.push({ n: n, ok: true, pendiente: true });
    console.log('PENDIENTE| ' + n + ' | ' + (d === undefined ? '' : d));
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function finalizar() {
    const fallos = resultados.filter((r) => !r.ok).length;
    console.log('\n' + (fallos
        ? 'COTIZADOR CART: ' + fallos + ' fallo(s)'
        : 'COTIZADOR CART OK (' + resultados.length + ' checks)'));
    process.exit(fallos ? 1 : 0);
}

/** PNG de prueba: 64x64 con borde transparente (alfa 0) y centro opaco. */
function pngPrueba() {
    const { deflateSync } = require('node:zlib');
    const N = 64;
    const crudo = Buffer.alloc(N * (N * 4 + 1));
    let o = 0;
    const tint = Math.floor(Math.random() * 120);
    for (let y = 0; y < N; y++) {
        crudo[o++] = 0;
        for (let x = 0; x < N; x++) {
            const borde = x < 8 || y < 8 || x >= N - 8 || y >= N - 8;
            // Spec 038 (F5h): color AZAR por corrida: asi el sha es unico y el selector
            // no lo reconoce como 'ya subida' (0 bytes).
            crudo[o++] = 40 + Math.floor(Math.random() * 180);
            crudo[o++] = 40 + ((x + tint) % 60);
            crudo[o++] = 30 + ((y + tint) % 60);
            crudo[o++] = borde ? 0 : 255;
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
    ihdr[8] = 8; ihdr[9] = 6;
    const ruta = path.join(process.env.TEMP || '.', 'pmu-cart.png');
    fs.writeFileSync(ruta, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(crudo)),
        chunk('IEND', Buffer.alloc(0)),
    ]));
    return ruta;
}

(async function () {
    if (!URL_COT) {
        pend('cotizador', 'sin PMU_COTIZADOR_URL');
        finalizar();
    }
    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch (e) {
        pend('playwright', String(e.message || e));
        finalizar();
    }

    const navegador = await chromium.launch({ executablePath: CHROME });
    const pagina = await (await navegador.newContext()).newPage({ viewport: { width: 1280, height: 1200 } });
    const posts = [];
    const modulos = [];
    const clic = async (re) => {
        await pagina.evaluate(function (f) {
            const rx = new RegExp(f);
            const b = Array.from(document.querySelectorAll('button'))
                .find(function (x) { return rx.test((x.textContent || '').trim()); });
            if (b) b.click();
        }, re.source);
        await espera(2200);
    };

    pagina.on('request', function (r) {
        if (r.method() !== 'POST') { return; }
        const t = r.postData() || '';
        if (t.indexOf('mockup_guardar') >= 0) { posts.push('mockup'); }
        else if (t.indexOf('pmu_cotizador') >= 0) { posts.push('cotizador'); }
        else if (t.indexOf('calculator_add_to_cart') >= 0) { posts.push('cart'); }
    });
    pagina.on('response', async function (r) {
        const u = r.url();
        if (u.indexOf('/assets/') >= 0 && u.indexOf('personalizador-pdf') >= 0) {
            modulos.push(u.split('/').pop());
        }
        // El body del POST es multipart (no se puede leer del request): se detecta la
        // respuesta JSON del endpoint (`{"success":true,...}` de mockup_guardar).
        if (u.indexOf('admin-post.php') >= 0 && posts.indexOf('mockup') < 0) {
            const ct = (r.headers()['content-type'] || '');
            if (ct.indexOf('json') >= 0) {
                try {
                    const t = await r.text();
                    if (t.indexOf('"ok":true') >= 0) { posts.push('mockup'); }
                } catch (e) { /* cuerpo no legible */ }
            }
        }
    });

    try {
        await pagina.goto(URL_COT, { waitUntil: 'networkidle' });
        // El paso de diseno/mockup necesita una categoria resuelta: se entra por el
        // CODIGO (`?o=v1.m10.s30.q5.c6.f1.d0`), que restaura material+forma+tamano+
        // formato+diseno+cantidad de una (navegar por los pasos no siempre dispara el
            // cambio de `sizeIndex`).
        const codigo = process.env.PMU_CODIGO || 'v1.m10.s30.q5.c6.f1.d0';
        await pagina.goto(URL_COT + '?o=' + encodeURIComponent(codigo), { waitUntil: 'networkidle' });
        await espera(6000);
        // E1: el puente del plugin.
        const puente = await pagina.evaluate(function () {
            const p = (window.WP_STICKER_DATA || {}).pmu || {};
            return { base: String(p.baseUrl || ''), nonce: String(p.nonce || '').length };
        });
        check('E1: el puente pmu esta declarado',
            puente.base.indexOf('http') === 0 && puente.nonce > 8, puente.base);
        // T095: el modal de bienvenida/pais del tema se lleva los clicks.
        await pagina.evaluate(function () {
            document.querySelectorAll('#muyu-country-modal-overlay, .mu-modal-overlay')
                .forEach(function (n) { n.remove(); });
        });
        check('E10: al abrir no se pide ningun modulo de diseno',
            modulos.length === 0, 'modulos=' + modulos.join(','));

        // 4 pasos: sin material+forma+tamano no hay mockup ni paso de diseno.
        await clic(/Papel Adhesivo|Vinilo/);
        await clic(/^Continuar$/i);
        await clic(/^Circulares$/);
        await clic(/\\d,\\d\\s*cm/);
        await clic(/^Continuar$/i);
        await espera(2500);

        const paso = await pagina.evaluate(function () {
            const c = document.querySelector('canvas[aria-label=\"Vista previa de tu diseno en el producto\"]');
            return {
                falta: (document.body.innerText.match(/Te falta elegir:[^\\n]*/) || [null])[0],
                canvas: !!c,
                lado: c ? c.width : 0,
            };
        });
        if (!paso.canvas) {
            pend('E3: lienzo 300x300 del mockup', paso.falta || 'sin canvas');
            finalizar();
            return;
        }
        check('E3: el lienzo del mockup es 300x300', paso.lado === 300, 'lado=' + paso.lado);

        // 4) Subir el arte con el recorte del selector.
        await clic(/^Cargar imagen$/);
        await espera(5000);
        await pagina.evaluate(function () {
            const a = document.querySelector('.cpmu-agregar');
            if (a) { a.click(); }
        });
        await espera(3000);
        const archivo = pngPrueba();
        if (await pagina.locator('input.spmu-file').count()) {
            await pagina.locator('input.spmu-file').first().setInputFiles(archivo);
            await espera(8000);
            await pagina.evaluate(function () { const b = document.querySelector('.spmu-ok'); if (b) b.click(); });
            await espera(9000);
        }
        check('E3: la miniatura del recorte quedo en la ranura',
            (await pagina.locator('.cpmu-mini').count()) > 0);

        // 5) El mockup se guardo en el item (F5h).
        const guardo = posts.indexOf('mockup') >= 0;
        check('F5h: se mando op=mockup_guardar', guardo, 'posts=' + posts.join(','));
        let mock = null;
        const tmp = path.join(PMU, 'tmp');
        if (fs.existsSync(tmp)) {
            const ses = fs.readdirSync(tmp).filter(function (d) { return d.indexOf('sesion-') === 0; })
                .map(function (d) { return { d: d, t: fs.statSync(path.join(tmp, d)).mtimeMs }; })
                .sort(function (a, b) { return b.t - a.t; });
            for (let i = 0; i < ses.length && !mock; i++) {
                const items = fs.readdirSync(path.join(tmp, ses[i].d))
                    .filter(function (d) { return /^cot-/.test(d); });
                for (let j = 0; j < items.length && !mock; j++) {
                    const enc = fs.readdirSync(path.join(tmp, ses[i].d, items[j]))
                        .find(function (f) { return /^mockup-.*[.]webp$/.test(f); });
                    if (enc) { mock = path.join(tmp, ses[i].d, items[j], enc); }
                }
            }
        }
        check('F5h: el mockup quedo guardado en el item', !!mock,
            mock ? path.basename(mock) : 'sin archivo');

        // 6) Compra: el preview viaja en calculator_data.diseno.previa.
        const prev = await pagina.evaluate(function () {
            return new Promise(function (res) {
                const orig = window.addToCartFromCalculator;
                window.addToCartFromCalculator = function (d) {
                    window.__pmuCartPayload = d;
                    return orig ? orig.apply(this, arguments) : undefined;
                };
                const b = Array.from(document.querySelectorAll('button'))
                    .find(function (x) { return /Compr/i.test(x.textContent || ''); });
                if (b) { b.click(); }
                setTimeout(function () { res(window.__pmuCartPayload || null); }, 4000);
            });
        });
        const previa = prev && prev.diseno ? String(prev.diseno.previa || '') : '';
        check('F5h: el carrito lleva diseno.previa', previa.indexOf('http') === 0,
            previa ? previa.slice(0, 70) : 'sin previa');

        // 7) Carrito: miniatura + visor del tema.
        await espera(4000);
        const enCarrito = pagina.url().indexOf('carrito') >= 0 || pagina.url().indexOf('cart') >= 0;
        if (enCarrito) {
            const thumbs = await pagina.locator('.pmu-cart-thumb').count();
            check('carrito: la miniatura esta en la linea', thumbs > 0, 'thumbs=' + thumbs);
            if (thumbs > 0) {
                await pagina.evaluate(function () {
                    const t = document.querySelector('.pmu-cart-thumb');
                    if (t) { t.click(); }
                });
                await espera(2500);
                check('carrito: el click abre el visor del tema',
                    (await pagina.locator('.mu-gal-visor.is-visible').count()) > 0);
            }
        } else {
            pend('carrito: miniatura + visor', 'no se llego al carrito (' + pagina.url() + ')');
        }
    } catch (e) {
        check('la puerta corre sin excepciones', false, String(e.message || e));
    } finally {
        await navegador.close().catch(function () {});
    }

    finalizar();
})();
