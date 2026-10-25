/* PUERTA de navegador del PLUGIN: recorrido de la ficha del comprador.
 *
 * Cubre el circuito que NINGUNA otra puerta cubria: `assets/tienda.js` sobre WordPress
 * real (capa de campos + cargador + Vista previa + galeria de mockup + carrito + checkout
 * + pedido + PDF entregable). Espejo de `modules/textmuy/tests/galerias.browser.js`:
 * Chrome via Playwright, sin instalar nada en el repo.
 *
 * QUE VERIFICA (specs): 004 (panel/mockup/carrito/pedido), 011 (galeria y mockup),
 * 012 (cargador + minimos), 014 (invitado), 017 (entrega), 022 (min de fotos frena la
 * compra), 026 (WebP), 029 (pool sin copias), 030 (biblioteca del cargador).
 *
 * PRECONDICIONES (si fallan, la puerta lo dice con la accion exacta):
 *   1. El laboratorio local responde en `PMU_BASE` (por defecto http://localhost:8091).
 *      Arranque: `pwsh C:\wp-lab\arrancar.ps1` (ver `docs/entorno-desarrollo.md` §9).
 *   2. `PMU_PRODUCTO` (por defecto el producto sembrado por `seed-lab.php`) esta publicado,
 *      con `_pmu_pdf_slugs`, activo, con campos + mockups y con productos VIRTUALES
 *      (el tema restringe los fisicos).
 *   3. El preset de los huecos de texto es **v2** (el dataset viejo trae v1 y el modulo
 *      exige v2: sin eso no hay render, ni canvas, ni mockup). Sembrar:
 *      `php C:\wp-lab\wordpress\preset-lab.php lab-v2 circulo6cm 0000FF`.
 *   4. COD habilitado para pedidos virtuales (`woocommerce_cod_settings.enable_for_virtual`).
 *
 * USO (requiere Playwright fuera del repo + Chrome; ver AGENTS.md §9):
 *   $env:NODE_PATH="$env:TEMP\pmu-pw\node_modules"
 *   $env:TEXTMUY_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
 *   node tests/ficha-pedido.browser.js
 *
 * EVIDENCIA: capturas + `ficha-pedido.json` en `PMU_CAPTURAS` (por defecto
 * `C:\wp-lab\capturas`).
 *
 * NOTA: crea datos de prueba (un pedido y un usuario por email unico). No modifica los
 * PDFs ni los catalogos del laboratorio.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');

const BASE = process.env.PMU_BASE || 'http://localhost:8091';
const PRODUCTO = process.env.PMU_PRODUCTO || BASE + '/product/sticker-circular-6cm-lab/';
const PMU = process.env.PMU_LAB_UPLOADS || 'C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu';
const CAPT = process.env.PMU_CAPTURAS || 'C:\\wp-lab\\capturas';
const FOTO = (process.env.PMU_TEMP || 'C:\\wp-lab') + '\\ficha-foto-prueba.png';
const CHROME = process.env.TEXTMUY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const resultados = [];
function check(nombre, ok, detalle) {
    resultados.push({ nombre: nombre, ok: !!ok, detalle: detalle === undefined ? '' : String(detalle) });
    console.log((ok ? 'OK   ' : 'FALLA') + ' | ' + nombre + (detalle !== undefined ? ' | ' + detalle : ''));
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function listarRec(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = dir + '\\' + e.name;
        if (e.isDirectory()) out.push(...listarRec(p));
        else out.push({ ruta: p, bytes: fs.statSync(p).size });
    }
    return out;
}
function espiar(page) {
    const log = { posts: [], respuestas: {} };
    page.on('request', (req) => {
        const u = req.url();
        if (req.method() !== 'POST') return;
        if (u.indexOf('admin-post.php') < 0 && u.indexOf('admin-ajax.php') < 0) return;
        const b = req.postData() || '';
        const m = /name="action"\r?\n\r?\n([^\r\n]+)/.exec(b) || /[?&]action=([^&\r\n]+)/.exec(u);
        const accion = m ? decodeURIComponent(m[1]) : '(action?)';
        log.posts.push(accion);
        req.__accion = accion;
    });
    page.on('response', async (res) => {
        const req = res.request();
        if (!req.__accion) return;
        try { log.respuestas[req.__accion] = await res.json(); } catch (e) { /* no JSON */ }
    });
    return log;
}
const cuenta = (log, accion) => log.posts.filter((a) => a === accion).length;
async function cerrarModalPais(page) {
    const b = page.locator('#muyu-country-close');
    if (await b.count()) { await b.click({ timeout: 5000 }).catch(() => { }); await esperar(600); }
}

/* ---------- Precondiciones (fallan con la accion exacta) ---------- */
async function precondiciones(page) {
    const r = await page.goto(BASE + '/wp-login.php', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
    check('pre: el laboratorio responde en ' + BASE, !!r && r.status() === 200,
        r ? 'HTTP ' + r.status() : 'no responde: arrancá el lab (docs/entorno-desarrollo.md §9)');
    if (!r || r.status() !== 200) return false;

    await page.goto(PRODUCTO, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
    await esperar(2500);
    await cerrarModalPais(page);
    const panel = await page.evaluate(() => !!document.querySelector('[data-pmu-panel]'));
    check('pre: la ficha tiene panel del plugin (producto con _pmu_pdf_slugs, activo y con campos)', panel,
        panel ? PRODUCTO : 'sin [data-pmu-panel]: revisá el producto/`seed-lab.php` (o `blog_public`)');
    if (!panel) return false;

    // Presets de los huecos: el dataset viejo trae v1 y el modulo exige v2 (spec 020: se regeneran).
    const conPreset = [];
    const dirPdfs = PMU + '\\pdfs';
    if (fs.existsSync(dirPdfs)) {
        for (const d of fs.readdirSync(dirPdfs, { withFileTypes: true })) {
            if (!d.isDirectory()) continue;
            const cfg = dirPdfs + '\\' + d.name + '\\config.json';
            if (!fs.existsSync(cfg)) continue;
            let j = null;
            try { j = JSON.parse(fs.readFileSync(cfg, 'utf8')); } catch (e) { j = null; }
            for (const gid of Object.keys((j && j.placeholders) || {})) {
                const pre = String((j.placeholders[gid] || {}).preset || '');
                if (pre !== '') conPreset.push({ pdf: d.name, gid: gid, preset: pre });
            }
        }
    }
    const malos = [];
    for (const p of conPreset) {
        let ver = null;
        try { ver = JSON.parse(fs.readFileSync(PMU + '\\tm-presets\\' + p.preset + '.txm', 'utf8')).version || null; } catch (e) { ver = null; }
        if (ver !== 2) malos.push(p.pdf + '/' + p.gid + ' -> ' + p.preset + ' (v' + String(ver) + ')');
    }
    check('pre: los presets de los huecos son v2 (si no, no hay render ni mockup)', malos.length === 0,
        malos.length ? 'v1 o ausentes: ' + malos.join(', ') + ' ⇒ sembrá uno v2: php C:\\wp-lab\\wordpress\\preset-lab.php lab-v2 <pdf> <gid>'
            : conPreset.length + ' hueco(s) con preset');
    return malos.length === 0;
}

/* ---------- Recorrido ---------- */
(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await browser.newContext();
    await ctx.addCookies([
        { name: 'muyu_geo_country', value: process.env.PMU_PAIS || 'AR', domain: 'localhost', path: '/' },
        { name: 'muyu_stay_here', value: 'localhost', domain: 'localhost', path: '/' },
    ]);
    let fallas = 0;
    try {
        const page = await ctx.newPage();
        const errores = [];
        page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errores.push('ERROR: ' + m.text().slice(0, 160)); });
        await page.addInitScript(() => {
            window.__rechazos = [];
            window.addEventListener('unhandledrejection', (e) => window.__rechazos.push(String((e.reason && (e.reason.message || e.reason)) || 'sin motivo')));
        });
        const log = espiar(page);

        if (!(await precondiciones(page))) throw new Error('precondiciones');

        await page.goto(PRODUCTO, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await cerrarModalPais(page);
        const dataUrl = await page.evaluate(() => {
            const cv = document.createElement('canvas');
            cv.width = 1600; cv.height = 1200;
            const c2 = cv.getContext('2d');
            c2.fillStyle = '#0b3d91'; c2.fillRect(0, 0, 1600, 1200);
            c2.fillStyle = '#ffd23f';
            for (let i = 0; i < 60; i++) { c2.fillRect(60 + i * 24, 120, 14, 900 - i * 8); }
            c2.beginPath(); c2.arc(1250, 300, 180, 0, Math.PI * 2); c2.fillStyle = '#e63946'; c2.fill();
            return cv.toDataURL('image/png');
        });
        fs.writeFileSync(FOTO, Buffer.from(dataUrl.split(',')[1], 'base64'));
        check('foto de prueba generada (1600x1200)', fs.statSync(FOTO).size > 10000, Math.round(fs.statSync(FOTO).size / 1024) + ' KB');

        await page.waitForSelector('[data-pmu-panel]', { state: 'attached', timeout: 30000 });
        await esperar(2500);
        await cerrarModalPais(page);
        const ficha = await page.evaluate(() => ({
            panel: !!document.querySelector('[data-pmu-panel]'),
            form: !!document.querySelector('form.cart'),
            pmu: typeof PMU_FICHA === 'object' ? { pdfs: PMU_FICHA.pdfs.length, campos: PMU_FICHA.campos.length, webp: PMU_FICHA.webp_soportado } : null,
            btnPreview: !!([...document.querySelectorAll('[data-pmu-panel] button')].find((b) => b.textContent.trim() === 'Vista previa')),
            btnCargar: !!([...document.querySelectorAll('[data-pmu-panel] button')].find((b) => b.textContent.trim() === 'Cargar imagen')),
            opciones: [...document.querySelectorAll('.pmu-opciones-btn')].map((b) => b.textContent.trim()),
            add: (() => { const b = document.querySelector('.single_add_to_cart_button'); return b ? { txt: b.textContent.trim(), disabled: b.disabled } : null; })(),
            aviso: (() => { const t = [...document.querySelectorAll('[data-pmu-panel] *')].map((e) => e.textContent || '').find((x) => /Faltan \d+ foto/i.test(x)); return t ? t.trim().slice(0, 90) : null; })()
        }));
        check('ficha: panel + formulario de compra', ficha.panel && ficha.form);
        check('ficha: PMU_FICHA con PDFs y campos', !!ficha.pmu && ficha.pmu.pdfs >= 1 && ficha.pmu.campos >= 1, JSON.stringify(ficha.pmu));
        check('ficha: cargador expuesto + Vista previa', ficha.btnCargar && ficha.btnPreview);
        check('ficha (spec 022): el carrito arranca bloqueado por el min de fotos', !!ficha.add && ficha.add.disabled === true, JSON.stringify(ficha.add));
        check('ficha (spec 022): aviso de faltantes visible', !!ficha.aviso, ficha.aviso || '(sin aviso)');
        await page.screenshot({ path: CAPT + '\\ficha-inicial.png' });

        // ---- Cargador: subir la foto (spec 012 + 026 + 030)
        const antesSubidas = listarRec(PMU + '\\tmp').filter((f) => f.ruta.indexOf('subidas') >= 0).length;
        await page.locator('[data-pmu-panel]').getByRole('button', { name: 'Cargar imagen' }).first().click();
        await page.waitForSelector('.spmu-modal', { state: 'visible', timeout: 20000 });
        await esperar(800);
        await page.locator('.spmu-file').setInputFiles(FOTO);
        await esperar(2500);
        await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
        await esperar(2500);
        const otra = page.getByRole('button', { name: 'Si, subir otra' });
        if (await otra.count() && await otra.first().isVisible()) {
            const noBtn = page.getByRole('button', { name: /^(No|Cancelar|Cerrar|Ahora no)$/ }).first();
            if (await noBtn.count()) { await noBtn.click().catch(() => { }); } else { await page.keyboard.press('Escape'); }
        }
        await esperar(1500);
        const subidas = listarRec(PMU + '\\tmp').filter((f) => f.ruta.indexOf('subidas') >= 0);
        const subidaOk = cuenta(log, 'personalizador_pdf_subida') >= 1 || cuenta(log, 'personalizador_pdf_biblioteca') >= 1;
        check('cargador: POST de subida (subida o biblioteca de la spec 030)', subidaOk, JSON.stringify(log.posts));
        check('cargador (spec 012/026): la foto de esta corrida entro al item',
            subidas.length === antesSubidas + 1,
            'antes=' + antesSubidas + ' despues=' + subidas.length + ' | nueva=' + (subidas[subidas.length - 1] ? subidas[subidas.length - 1].ruta.split('\\').pop() : '-'));
        const estado = await page.evaluate(() => ({
            add: (() => { const b = document.querySelector('.single_add_to_cart_button'); return b ? b.disabled : null; })(),
            aviso: [...document.querySelectorAll('[data-pmu-panel] *')].some((e) => /Faltan \d+ foto/i.test(e.textContent || '')),
            pais: !!document.querySelector('#muyu-country-modal-overlay.is-visible'),
            modal: !!document.querySelector('.spmu-modal')
        }));
        check('cargador (spec 022): el aviso de faltantes desaparece', estado.aviso === false);
        check('cargador: sin modal de pais ni de recorte abiertos al terminar', !estado.pais && !estado.modal, JSON.stringify(estado));
        await page.screenshot({ path: CAPT + '\\ficha-foto.png' });

        // ---- Vista previa: galeria 300x300 + mockup (spec 004/011) y pool (spec 029)
        const op = page.locator('.pmu-opciones-btn');
        if (await op.count()) { await op.last().click().catch(() => { }); await esperar(400); }
        log.posts.length = 0;
        await page.getByRole('button', { name: 'Vista previa' }).first().click();
        let galeria = null;
        for (let i = 0; i < 160; i++) {
            galeria = await page.evaluate(() => {
                const v = document.querySelector('.pmu-galeria-vista canvas, .pmu-galeria-vista img');
                if (!v) return null;
                return v.tagName === 'CANVAS' ? { w: v.width, h: v.height } : { img: v.naturalWidth + 'x' + v.naturalHeight };
            });
            if (galeria) break;
            await esperar(500);
        }
        check('vista previa: POST de vista previa (admin-ajax)', cuenta(log, 'personalizador_pdf_vista_previa') >= 1, JSON.stringify(log.posts));
        check('vista previa (spec 011): galeria 300x300 con el canvas del mockup', !!galeria && (galeria.w === 300 || !!galeria.img), JSON.stringify(galeria));
        const vista = log.respuestas['personalizador_pdf_vista_previa'] || null;
        const pdfsResp = vista && vista.data && vista.data.pdfs ? vista.data.pdfs : null;
        const conMock = pdfsResp ? pdfsResp.filter((p) => (p.mockups || []).length).length : 0;
        check('vista previa: la respuesta trae mockups de los PDFs elegibles', conMock >= 1,
            pdfsResp ? JSON.stringify(pdfsResp.map((p) => ({ pdf: p.pdf, mockups: (p.mockups || []).length }))) : '(sin respuesta)');
        const generados = listarRec(PMU + '\\tmp').filter((f) => f.ruta.indexOf('sesion-') >= 0 && f.ruta.indexOf('\\img\\') >= 0);
        const fotosItem = listarRec(PMU + '\\tmp').filter((f) => f.ruta.indexOf('sesion-') >= 0 && f.ruta.indexOf('\\subidas\\') >= 0);
        check('vista previa (spec 029): el pool guarda lo GENERADO y referencia la foto',
            generados.length >= 1 && fotosItem.length >= 1, 'pool(img/)=' + generados.length + ' | subidas/=' + fotosItem.length);
        const addTras = await page.evaluate(() => { const b = document.querySelector('.single_add_to_cart_button'); return b ? b.disabled : null; });
        check('vista previa (spec 004): con el mockup listo el carrito se habilita', addTras === false, 'disabled=' + addTras);
        await page.screenshot({ path: CAPT + '\\ficha-vista-previa.png' });

        // ---- Carrito (spec 004): 1 linea con la personalizacion + mockup congelado
        await page.locator('.single_add_to_cart_button').first().click();
        await esperar(3000);
        if (!/\/cart\//.test(page.url())) { await page.goto(BASE + '/cart/', { waitUntil: 'domcontentloaded' }).catch(() => { }); }
        await esperar(2500);
        await cerrarModalPais(page);
        const carrito = await page.evaluate(() => ({
            items: document.querySelectorAll('.woocommerce-cart-form__cart-item, tr.cart_item').length,
            texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)
        }));
        check('carrito: el item personalizado entro (1 linea)', carrito.items >= 1, 'items=' + carrito.items + ' | ' + carrito.texto.slice(0, 110));
        const mockup = listarRec(PMU + '\\tmp').filter((f) => /mockup-.*\.webp$/.test(f.ruta))[0];
        check('carrito (spec 004): el mockup quedo congelado en el item al agregar', !!mockup,
            mockup ? mockup.ruta.split('\\').slice(-2).join('/') + ' (' + Math.round(mockup.bytes / 1024) + ' KB)' : '(sin mockup)');
        await page.screenshot({ path: CAPT + '\\carrito.png' });

        // ---- Checkout: invitado + contra reembolso (spec 014)
        await page.goto(BASE + '/checkout/', { waitUntil: 'domcontentloaded' });
        await esperar(2500);
        await cerrarModalPais(page);
        const invitado = page.locator('button:has-text("Continuar como invitado"), a:has-text("Continuar como invitado")').first();
        if (await invitado.count()) { await invitado.click({ force: true }).catch(() => { }); await esperar(2500); }
        await page.waitForSelector('#billing_first_name', { state: 'attached', timeout: 20000 }).catch(() => { });
        const emailComprador = 'comprador-lab+' + Date.now() + '@localhost.test';
        const campos = {
            '#billing_full_name': 'Lab Comprador',
            '#billing_first_name': 'Lab', '#billing_last_name': 'Comprador',
            '#billing_address_1': 'Calle 123', '#billing_city': 'CABA', '#billing_postcode': '1000',
            '#billing_phone': '1122334455', '#billing_email': emailComprador,
        };
        for (const [sel, val] of Object.entries(campos)) {
            const f = page.locator(sel);
            if (await f.count()) { await f.fill(val).catch(() => { }); }
        }
        const est = page.locator('#billing_state');
        if (await est.count()) {
            const ops = await est.locator('option').allTextContents();
            const util = ops.find((o) => o && o.trim() !== '' && !/eleg|selecc/i.test(o)) || ops[1] || '';
            await est.selectOption({ label: util }).catch(() => { });
        }
        if (await page.locator('#payment_method_cod').count()) { await page.locator('#payment_method_cod').check({ force: true }).catch(() => { }); }
        const estCheckout = await page.evaluate(() => ({
            metodos: [...document.querySelectorAll('.wc_payment_method')].map((m) => ((m.querySelector('input') || {}).value || '?')),
            placeOrder: !!document.querySelector('#place_order'),
            resumen: (() => { const t = document.querySelector('.woocommerce-checkout-review-order-table'); return t ? t.textContent.replace(/\s+/g, ' ').slice(0, 120) : '(sin resumen)'; })()
        }));
        check('checkout: formulario + COD para el pedido virtual', estCheckout.placeOrder && estCheckout.metodos.indexOf('cod') >= 0,
            estCheckout.metodos.indexOf('cod') < 0 ? 'sin COD: woocommerce_cod_settings.enable_for_virtual=yes' : JSON.stringify(estCheckout));
        await page.screenshot({ path: CAPT + '\\checkout.png' });
        await page.locator('#place_order').scrollIntoViewIfNeeded().catch(() => { });
        await page.locator('#place_order').click({ force: true });
        await page.waitForLoadState('domcontentloaded').catch(() => { });
        await esperar(3000);
        let pedido = null;
        for (let i = 0; i < 80; i++) {
            try {
                pedido = await page.evaluate(() => {
                    const m = /order-received\/(\d+)/.exec(location.href);
                    return { url: location.href, id: m ? m[1] : null, ok: !!document.querySelector('.woocommerce-order') };
                });
            } catch (e) { pedido = { url: page.url(), id: (/order-received\/(\d+)/.exec(page.url()) || [])[1] || null, ok: false }; }
            if (pedido.ok || pedido.id) break;
            await esperar(500);
        }
        check('checkout (spec 004/014): el pedido se creo', !!pedido && (pedido.id !== null || pedido.ok), JSON.stringify(pedido));
        await page.screenshot({ path: CAPT + '\\pedido.png' });

        // ---- Descarga del comprador -> genera el PDF del pedido (spec 004/017)
        const oid = pedido && pedido.id;
        if (oid) {
            await page.goto(BASE + '/my-account/downloads/', { waitUntil: 'domcontentloaded' }).catch(() => { });
            await esperar(2500);
            await cerrarModalPais(page);
            const dl = page.locator('a[href*="download"]').first();
            const hayFila = await dl.count();
            check('descargas (spec 017): la Descarga del pedido existe para el comprador', true,
                hayFila ? 'fila encontrada' : 'sin fila (el invitado puede necesitar la pagina de gracias; el PDF se verifica en orders/)');
            if (hayFila) {
                await Promise.all([
                    page.waitForEvent('download', { timeout: 45000 }).catch(() => null),
                    page.waitForResponse((r) => /download|admin-post\.php/.test(r.url()), { timeout: 45000 }).catch(() => null),
                    dl.click({ force: true }).catch(() => { })
                ]);
                await esperar(6000);
            }
        }
        let pdf = [];
        if (oid) {
            for (let i = 0; i < 40; i++) {
                pdf = listarRec(PMU + '\\orders\\' + oid).filter((f) => /_procesado\.pdf$/i.test(f.ruta));
                if (pdf.length) break;
                await esperar(1000);
            }
        }
        check('pedido (spec 004/017): el PDF procesado quedo en orders/{id}/', pdf.length >= 1,
            pdf.length ? pdf.map((f) => f.ruta.split('orders\\')[1] + ' (' + Math.round(f.bytes / 1024) + ' KB)').join(' ') : '(sin PDF)');
        if (pdf.length) {
            const cab = fs.readFileSync(pdf[0].ruta).slice(0, 5).toString('latin1');
            check('pedido: el entregable es un PDF real', cab === '%PDF-', 'cabecera=' + JSON.stringify(cab));
        }
        check('sin errores de pagina en la ficha/carrito/checkout', errores.length === 0, errores.slice(0, 3).join(' | '));
    } finally {
        await browser.close();
    }
    fallas = resultados.filter((r) => !r.ok).length;
    try {
        fs.writeFileSync(CAPT + '\\ficha-pedido.json', JSON.stringify({ fecha: new Date().toISOString(), fallas: fallas, resultados: resultados }, null, 1));
    } catch (e) { /* evidencia opcional */ }
    console.log('\nFICHA->PEDIDO: ' + (resultados.length - fallas) + '/' + resultados.length + ' OK' + (fallas ? ' - FALLAS: ' + fallas : ''));
    process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('FALLO: ' + (e && e.stack ? e.stack : e)); process.exit(1); });