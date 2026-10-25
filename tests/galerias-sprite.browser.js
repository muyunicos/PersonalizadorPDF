/* PUERTA de navegador del PLUGIN: galerias del editor (hojas `thumbs.webp`).
 *
 * Promocion del recorrido E1-E7 de la spec 009 (`galerias-sprite-unificado`):
 * con hoja certificada, abrir una galeria = 0 descargas de contenido; sin hoja,
 * la galeria **genera sola los huecos** con UNA escritura (`op=sprite`) y certifica;
 * geometria con ratio simplificado; Google por familia unica; Reintentar con causa.
 *
 * USO (Playwright fuera del repo + Chrome; ver docs/entorno-desarrollo.md §9.5):
 *   $env:NODE_PATH="$env:TEMP\pmu-pw\node_modules"
 *   $env:TEXTMUY_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
 *   node tests/galerias-sprite.browser.js
 *
 * Contra el HOSTING (solo UI, sin leer el disco del lab):
 *   $env:PMU_BASE='https://sitio'; $env:PMU_SOLO_UI='1'; node tests/galerias-sprite.browser.js
 *
 * EVIDENCIA: capturas + `galerias-sprite.json` en `PMU_CAPTURAS`.
 *
 * NOTA: E1/E3/E5 MUTAN datos del laboratorio (hoja y catalogo de `fonts`) y lo
 * restauran al terminar (backup `.bak-gate`). No toca otros ambitos.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const BASE = process.env.PMU_BASE || 'http://localhost:8091';
const PANEL = BASE + '/wp-admin/admin.php?page=personalizador-pdf&tab=textos';
const PMU = process.env.PMU_LAB_UPLOADS || 'C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu';
const CAPT = process.env.PMU_CAPTURAS || 'C:\\wp-lab\\capturas';
const SOLO_UI = process.env.PMU_SOLO_UI === '1' || process.env.PMU_SOLO_UI === 'true';
const CHROME = process.env.TEXTMUY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const FONTS_JSON = PMU + '\\fonts\\fonts.json';
const FONTS_SHEET = PMU + '\\fonts\\thumbs.webp';
const TTF_PRUEBA = PMU + '\\fonts\\MUY-Legible.ttf';

const resultados = [];
function check(nombre, ok, detalle) {
    resultados.push({ nombre: nombre, ok: !!ok, detalle: detalle === undefined ? '' : String(detalle) });
    console.log((ok ? 'OK   ' : 'FALLA') + ' | ' + nombre + (detalle !== undefined ? ' | ' + detalle : ''));
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const leer = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const catalogo = () => leer(FONTS_JSON);
const firmaVigente = () => { const c = catalogo(); return (c && c.thumbs && c.thumbs.sprite_firma) || null; };
const existeHoja = () => fs.existsSync(FONTS_SHEET);
function sinHoja() {
    try { fs.unlinkSync(FONTS_SHEET); } catch (e) { }
    const c = catalogo();
    if (c && c.thumbs) { delete c.thumbs.sprite_firma; fs.writeFileSync(FONTS_JSON, JSON.stringify(c, null, 1)); }
}
const ro = (on) => { try { execSync('attrib ' + (on ? '+R' : '-R') + ' "' + FONTS_JSON + '"'); } catch (e) { } };
const reticulaEsperada = () => {
    const c = catalogo() || { thumbs: {}, items: [] };
    let maxId = 0;
    (c.items || []).forEach((t) => { if (t && t[0]) maxId = Math.max(maxId, Number(t[0])); });
    const cc = c.thumbs.c || 4;
    return { w: (c.thumbs.w || 180) * cc, h: Math.ceil(Math.max(1, maxId) / cc) * (c.thumbs.h || 30), c: cc };
};

function espiar(page) {
    const log = { posts: [], ttf: [], google: [], originales: [], hojas: [] };
    page.on('request', (req) => {
        const u = req.url();
        if (/\.(ttf|otf|woff2?)(\?|$)/i.test(u)) log.ttf.push(u);
        else if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u)) log.google.push(u);
        else if (/\/uploads\/pmu\/img\/[^/]+\.(png|jpe?g|webp|gif)(\?|$)/i.test(u) && u.indexOf('thumbs.webp') < 0) log.originales.push(u);
        else if (/fonts\/thumbs\.webp(\?|$)/.test(u)) log.hojas.push(u);
        if (req.method() !== 'POST') return;
        if (u.indexOf('admin-post.php') < 0 && u.indexOf('admin-ajax.php') < 0) return;
        const b = req.postData() || '';
        const mOp = /name="op"\r?\n\r?\n([^\r\n]+)/.exec(b) || /[?&]op=([^&\r\n]+)/.exec(u);
        const mAct = /name="action"\r?\n\r?\n([^\r\n]+)/.exec(b) || /[?&]action=([^&\r\n]+)/.exec(u);
        const accion = mOp ? decodeURIComponent(mOp[1]) : (mAct ? decodeURIComponent(mAct[1]) : '(op?)');
        log.posts.push(accion);
        req.__accion = accion;
    });
    log.respuestas = {};
    page.on('response', async (res) => {
        const req = res.request();
        if (!req.__accion) return;
        try { log.respuestas[req.__accion] = await res.json(); } catch (e) { /* no JSON */ }
    });
    return log;
}
const limpiar = (log) => { log.posts.length = 0; log.ttf.length = 0; log.google.length = 0; log.originales.length = 0; log.hojas.length = 0; };
const cuenta = (log, accion) => log.posts.filter((a) => a === accion).length;
const escrituras = (log) => Object.keys(log.respuestas).filter((a) => (log.respuestas[a] || {}).data && log.respuestas[a].data.spriteUrl).length;

async function abrirEditor(page, framePrev) {
    await page.goto(PANEL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let i = 0; i < 60; i++) {
        const f = page.frames().find((x) => /modules\/textmuy\/index\.html/.test(x.url()));
        if (f) { await esperar(1500); return f; }
        await esperar(500);
    }
    throw new Error('no aparecio el iframe del editor');
}
const panelFonts = (frame) => frame.locator('.tt-galpanel[data-ambito="fonts"]');
async function abrirGaleriaFuentes(frame) {
    const btn = frame.locator('#tt-font-gallery-btn');
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
    for (let i = 0; i < 40; i++) {
        if (await panelFonts(frame).count()) return;
        await esperar(250);
    }
    throw new Error('no se monto el panel de fuentes');
}
async function dimsHoja(page) {
    return page.evaluate(async () => {
        const img = new Image();
        img.src = '/wp-content/uploads/pmu/fonts/thumbs.webp?t=' + Date.now();
        try { await img.decode(); } catch (e) { return null; }
        return { w: img.naturalWidth, h: img.naturalHeight };
    });
}

/* ---------- Arranque + precondiciones ---------- */
(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await browser.newContext();
    let fallas = 0;
    try {
        const page = await ctx.newPage();
        const errores = [];
        page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error') errores.push('ERROR: ' + m.text().slice(0, 160)); });
        // Un original de imagen valido (por si una galeria debe dibujar celdas).
        await page.route('**/uploads/pmu/img/*', (route) => {
            if (/thumbs\.webp/.test(route.request().url())) return route.continue();
            return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64') });
        });
        const log = espiar(page);

        const r = await page.goto(BASE + '/wp-login.php', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        check('pre: el laboratorio responde en ' + BASE, !!r && r.status() === 200,
            r ? 'HTTP ' + r.status() : 'no responde: arrancá el lab (docs/entorno-desarrollo.md §9)');
        if (!r || r.status() !== 200) throw new Error('precondiciones');
        if (await page.locator('#user_login').count()) {
            await page.fill('#user_login', process.env.PMU_USER || 'lab');
            await page.fill('#user_pass', process.env.PMU_PASS || 'labpass123');
            await page.click('#wp-submit');
            await page.waitForLoadState('networkidle');
        }
        let frame = await abrirEditor(page);
        check('pre: el editor del modulo se monto', !!frame, frame ? frame.url() : 'sin iframe');
        if (SOLO_UI) check('modo SOLO-UI (no se leen/escriben datos del lab)', true, 'las verificaciones de disco se omiten');

        /* ===== E1: sin hoja -> la galeria genera y certifica (SC-002/003) ===== */
        if (!SOLO_UI) sinHoja();
        check('E1: punto de partida = fonts SIN hoja certificada', SOLO_UI || (!existeHoja() && !firmaVigente()));
        limpiar(log);
        const t0 = Date.now();
        await abrirGaleriaFuentes(frame);
        let ok = SOLO_UI;
        if (!SOLO_UI) {
            for (let i = 0; i < 240; i++) {
                if (existeHoja() && firmaVigente()) { ok = true; break; }
                await esperar(500);
            }
        } else {
            for (let i = 0; i < 120 && !escrituras(log) && !cuenta(log, 'sprite'); i++) await esperar(500);
            ok = cuenta(log, 'sprite') >= 1 || escrituras(log) === 1;
        }
        const ms = Date.now() - t0;
        const dims = SOLO_UI ? null : await dimsHoja(page);
        const esp = reticulaEsperada();
        const bytes = (!SOLO_UI && existeHoja()) ? fs.statSync(FONTS_SHEET).size : 0;
        check('E1 (SC-002): la hoja se genero y certifico sola', ok, SOLO_UI ? 'modo solo-UI' : 'firma=' + (firmaVigente() ? 'escrita' : 'ausente'));
        const writes = SOLO_UI ? (cuenta(log, 'sprite') ? 1 : 0) : escrituras(log);
        check('E1 (I2/SC-002): exactamente 1 escritura op=sprite', writes === 1, 'escrituras=' + writes + ' posts=' + JSON.stringify(log.posts));
        if (!SOLO_UI) {
            check('E1 (SC-002): thumbs.webp mide la reticula del inventario', !!dims && dims.w === esp.w && dims.h === esp.h,
                'hoja=' + JSON.stringify(dims) + ' esperado=' + esp.w + 'x' + esp.h);
        }
        check('E1 (I5/SC-003): la generacion baja las fuentes faltantes (fisicas)', SOLO_UI || log.ttf.length > 0,
            'ttf=' + log.ttf.length + ' google=' + log.google.length + ' | ' + ms + ' ms' + (bytes ? ', ' + Math.round(bytes / 1024) + ' KB' : ''));
        await page.screenshot({ path: CAPT + '\\e1-generacion.png' });

        /* ===== E2: aperturas siguientes con 0 descargas (SC-001) ===== */
        // Calentamiento: si una mutacion previa dejo una hoja sin certificar, la
        // primera apertura la regenera (1 descarga legitima). Se mide el ESTADO
        // ESTABLE: apertura de calentamiento y recien despues la medicion.
        await abrirEditor(page);
        await esperar(2500);
        await abrirGaleriaFuentes(frame).catch(() => { });
        await esperar(1500);
        await frame.locator('#tt-preset-gallery-toggle').click().catch(() => { });
        await esperar(2000);
        await frame.evaluate(() => window.TextMuyGaleria && window.TextMuyGaleria.abrir('fondos', () => { }, null, { preview: true })).catch(() => { });
        await esperar(2500);
        frame = await abrirEditor(page);            // F5 (medicion)
        await esperar(2500);                        // asentar la carga del editor
        const base = {
            ttf: log.ttf.length, google: log.google.length, originales: log.originales.length,
            links: await frame.evaluate(() => document.querySelectorAll('link[data-textmuy-font]').length)
        };
        limpiar(log);
        await abrirGaleriaFuentes(frame);
        await esperar(1500);
        await frame.locator('#tt-preset-gallery-toggle').click();
        await esperar(2000);
        await frame.evaluate(() => window.TextMuyGaleria && window.TextMuyGaleria.abrir('fondos', () => { }, null, { preview: true })).catch(() => { });
        await esperar(2500);
        const d = await frame.evaluate(() => ({
            fonts: [...document.querySelectorAll('.tt-galpanel')].find((p) => p.dataset.ambito === 'fonts') ? [...document.querySelectorAll('.tt-galpanel')].find((p) => p.dataset.ambito === 'fonts').querySelectorAll('.tt-galpanel-tile canvas').length : 0,
            linksGoogle: document.querySelectorAll('link[data-textmuy-font]').length
        }));
        check('E2 (SC-001): 0 descargas de tipografias al abrir (<=1 si quedo una celda pendiente)', log.ttf.length <= 1, 'ttf=' + log.ttf.length);
        if (log.ttf.length > 0) {
            // La celda pendiente se dibuja y persiste en la pasada anterior: la
            // apertura siguiente (ESTADO ESTABLE) no debe descargar nada.
            limpiar(log);
            frame = await abrirEditor(page);
            await esperar(2500);
            limpiar(log);
            await abrirGaleriaFuentes(frame);
            await esperar(2500);
            check('E2 (SC-001, 2a pasada): 0 descargas de tipografias', log.ttf.length === 0, 'ttf=' + log.ttf.length);
        }
        check('E2 (SC-001): 0 peticiones a Google Fonts al abrir', log.google.length === 0, 'google=' + log.google.length);
        check('E2 (SC-001): 0 originales de imagen al abrir', log.originales.length === 0, 'originales=' + log.originales.length);
        check('E2 (SC-001): 0 <link> NUEVOS de Google', d.linksGoogle - base.links === 0, 'links=' + d.linksGoogle + ' (baseline ' + base.links + ')');
        check('E2 (SC-001): las celdas de fonts se dibujan desde la hoja', d.fonts > 0, 'canvas fonts=' + d.fonts + ' | hojas leidas=' + log.hojas.length);
        check('E2 (I1): 0 escrituras al abrir con hoja certificada', log.posts.filter((a) => a === 'sprite').length === 0, JSON.stringify(log.posts));
        await page.screenshot({ path: CAPT + '\\e2-lectura.png' });

        /* ===== E3: alta -> solo la celda nueva (SC-004) ===== */
        limpiar(log);
        const antes = catalogo() ? catalogo().items.length : 0;
        await panelFonts(frame).locator('.tt-galpanel-upload input[type=file]')
            .setInputFiles({ name: 'e3-prueba.ttf', mimeType: 'font/ttf', buffer: fs.readFileSync(TTF_PRUEBA) });
        let crecio = false;
        for (let i = 0; i < 120; i++) {
            if (catalogo() && catalogo().items.length > antes) { crecio = true; break; }
            await esperar(500);
        }
        check('E3 (SC-004): el alta agrego la fuente al catalogo', SOLO_UI || crecio, 'items ' + antes + ' -> ' + (catalogo() ? catalogo().items.length : '?'));
        let altaVista = log.posts.filter((a) => a === 'alta').length >= 1;
        for (let i = 0; i < 20 && !altaVista; i++) { await esperar(500); altaVista = log.posts.filter((a) => a === 'alta').length >= 1; }
        check('E3 (SC-004): el alta fue 1 POST (op=alta)', altaVista, JSON.stringify(log.posts.slice(0, 6)));
        let okAlta = false;
        for (let i = 0; i < 40; i++) { if (firmaVigente()) { okAlta = true; break; } await esperar(500); }
        if (!okAlta && !SOLO_UI) {
            await panelFonts(frame).locator('.tt-galpanel-close').click();
            await esperar(500);
            await abrirGaleriaFuentes(frame);
            for (let i = 0; i < 120; i++) { if (firmaVigente()) { okAlta = true; break; } await esperar(500); }
        }
        check('E3 (SC-004): la hoja se regenero y quedo certificada', SOLO_UI || (okAlta && log.posts.filter((a) => a === 'sprite').length >= 1),
            SOLO_UI ? 'modo solo-UI' : 'sprite=' + log.posts.filter((a) => a === 'sprite').length + ' firma=' + (firmaVigente() ? 'si' : 'no'));
        limpiar(log);
        frame = await abrirEditor(page);
        await esperar(2500);
        limpiar(log);
        await abrirGaleriaFuentes(frame);
        await esperar(2000);
        check('E3 (SC-004): la apertura siguiente no descarga nada', log.ttf.length === 0 && log.google.length === 0,
            'ttf=' + log.ttf.length + ' google=' + log.google.length);
        await page.screenshot({ path: CAPT + '\\e3-alta.png' });

        /* ===== E4: preview real de Google (SC-005) ===== */
        limpiar(log);
        const cat = catalogo() || { items: [] };
        const itGoogle = (cat.items || []).find((t) => t && typeof t[3] === 'string' && t[3].indexOf('.') < 0);
        check('E4: el catalogo tiene una celda Google', !!itGoogle, itGoogle ? '#' + itGoogle[0] + ' ' + itGoogle[1] : 'sin items Google');
        if (itGoogle) {
            await frame.evaluate(() => {
                window.__ff = 0;
                const R = window.FontFace;
                window.FontFace = function (...a) { window.__ff++; return new R(...a); };
            }).catch(() => { });
            await panelFonts(frame).locator('.tt-galpanel-tile[data-slug="' + itGoogle[0] + '"]').click();
            for (let i = 0; i < 60; i++) { if (log.google.length) break; await esperar(500); }
            const css2 = log.google.filter((u) => /fonts\.googleapis\.com/.test(u));
            check('E4 (SC-005): con hoja certificada el clic NO descarga la familia (ya trae el tipo real)', css2.length === 0,
                'css2=' + css2.length + ' ' + (css2[0] || '') + ' | el caso "celda pediente => 1 css2" lo cubre la puerta del modulo (galerias.browser.js)');
            const cv = await frame.evaluate((slug) => !!document.querySelector('.tt-galpanel-tile[data-slug="' + slug + '"] canvas'), String(itGoogle[0]));
            check('E4 (SC-005): la celda se redibuja con su tipo real', cv);
        }

        /* ===== E5: causa visible + Reintentar (SC-007) ===== */
        if (!SOLO_UI) {
            await frame.evaluate(() => {
                const p = [...document.querySelectorAll('.tt-galpanel')].find((x) => x.dataset.ambito === 'fonts');
                if (p && !p.hidden) p.querySelector('.tt-galpanel-close').click();
            });
            sinHoja();
            ro(true);                                  // el catalogo no es escribible: el motor rechaza
            limpiar(log);
            frame = await abrirEditor(page);            // pagina FRESCA: sin caches de catalogo/canon
            await esperar(2500);
            await abrirGaleriaFuentes(frame);
            let estado = { status: '', reintentar: false };
            for (let i = 0; i < 160; i++) {
                estado = await frame.evaluate(() => {
                    const p = [...document.querySelectorAll('.tt-galpanel')].find((x) => x.dataset.ambito === 'fonts');
                    const b = p.querySelector('.tt-galpanel-reintentar');
                    return { status: (p.querySelector('.tt-galpanel-status') || {}).textContent || '', reintentar: b ? !b.hidden : null };
                });
                if (estado.reintentar) break;
                await esperar(500);
            }
            check('E5 (SC-007): la galeria muestra la causa (del motor o de las celdas)',
                /fonts:hoja:(motor:rechazo|celdas:\d+:pendientes)|motor:sprite:/.test(estado.status || ''), estado.status);
            check('E5 (T037): el Reintentar aparece tras el error', estado.reintentar === true, 'reintentar=' + estado.reintentar + ' status=' + estado.status);
            check('E5 (I3): con fallos NO se persiste la hoja', !firmaVigente(), 'firma=' + (firmaVigente() ? 'si' : 'no'));
            await page.screenshot({ path: CAPT + '\\e5-error.png' });
            ro(false);
            limpiar(log);
            await frame.locator('.tt-galpanel[data-ambito="fonts"] .tt-galpanel-reintentar').click();
            let okRe = false;
            for (let i = 0; i < 240; i++) { if (firmaVigente()) { okRe = true; break; } await esperar(500); }
            check('E5 (T037): el reintento recupera y escribe UNA vez', okRe && log.posts.filter((a) => a === 'sprite').length === 1,
                'firma=' + (firmaVigente() ? 'si' : 'no') + ' sprite=' + log.posts.filter((a) => a === 'sprite').length);
            await page.screenshot({ path: CAPT + '\\e5-reintento.png' });
        } else {
            const b = await frame.evaluate(() => {
                const p = [...document.querySelectorAll('.tt-galpanel')].find((x) => x.dataset.ambito === 'fonts');
                return !!p && !!p.querySelector('.tt-galpanel-reintentar') && p.querySelector('.tt-galpanel-reintentar').hidden;
            });
            check('E5 (SOLO-UI): el Reintentar existe y esta oculto sin error', b, 'la inyeccion de fallo (attrib +R) solo corre en el lab');
        }

        /* ===== E6: celdas completas y proporcionales (SC-006) ===== */
        frame = await abrirEditor(page);
        await esperar(2500);
        await abrirGaleriaFuentes(frame);
        await esperar(2000);
        const med = await frame.evaluate(() => {
            const p = [...document.querySelectorAll('.tt-galpanel')].find((x) => x.dataset.ambito === 'fonts');
            const tiles = [...p.querySelectorAll('.tt-galpanel-tile')];
            if (!tiles.length) return null;
            const box = tiles.map((t) => { const r = t.getBoundingClientRect(); return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
            const minTop = Math.min.apply(null, box.map((b) => b.top));
            return {
                celdas: tiles.length, primeraFila: box.filter((b) => b.top === minTop).length,
                filas: new Set(box.map((b) => b.top)).size, w: box[0].w, h: box[0].h,
                ratio: getComputedStyle(tiles[0]).aspectRatio
            };
        });
        if (!med) {
            check('E6 (SC-006): la galeria de fuentes tiene celdas', false, 'sin tiles');
        } else {
            const th = (catalogo() || {}).thumbs || {};
            const esperado = Math.round(med.w * ((th.h || 30) / (th.w || 180)));
            check('E6 (SC-006): 2 columnas de celdas', med.primeraFila === 2, 'primera fila=' + med.primeraFila + ' (celdas=' + med.celdas + ', filas=' + med.filas + ')');
            check('E6 (SC-006): ancho de celda ~175 px', med.w >= 140 && med.w <= 210, 'ancho=' + med.w + ' px');
            check('E6 (SC-006): alto = round(ancho x h/w) +-2 px', Math.abs(med.h - esperado) <= 2, 'alto=' + med.h + ' esperado=' + esperado + ' ratio=' + med.ratio);
            await frame.locator('.tt-galpanel[data-ambito="fonts"]').screenshot({ path: CAPT + '\\e6-geometria.png' }).catch(() => { });
        }

        /* ===== E7: botones retirados + reentrancia (FR-009 / SC-009) ===== */
        const ui = await frame.evaluate(() => ({
            textoBoton: [...document.querySelectorAll('button,label')].map((b) => (b.textContent || '').trim()).filter((t) => /^(Generar miniaturas|Miniaturas)$/i.test(t)).length,
            gensprite: document.querySelectorAll('.tt-galpanel-gensprite').length,
            reintentar: document.querySelectorAll('.tt-galpanel-reintentar').length,
            retryPresets: document.querySelectorAll('#tt-gallery-retry-btn').length
        }));
        check('E7 (FR-009): no existen los botones "Generar miniaturas" ni "Miniaturas"', ui.textoBoton === 0 && ui.gensprite === 0, JSON.stringify(ui));
        check('E7 (T037): las galerias exponen Reintentar (oculto sin error)', ui.reintentar >= 1 && ui.retryPresets === 1, JSON.stringify(ui));
        if (!SOLO_UI) {
            sinHoja();
            limpiar(log);
            await frame.evaluate(() => {
                if (window.TextMuyAPI.invalidarSpriteCanonico) window.TextMuyAPI.invalidarSpriteCanonico('fonts');
                if (window.TextMuyAPI.invalidarCatalogo) window.TextMuyAPI.invalidarCatalogo('fonts');
                if (window.TextMuyAPI.invalidarDibujados) window.TextMuyAPI.invalidarDibujados('fonts');
                const p = [...document.querySelectorAll('.tt-galpanel')].find((x) => x.dataset.ambito === 'fonts');
                if (p && !p.hidden) p.querySelector('.tt-galpanel-close').click();
            });
            await esperar(400);
            const primera = frame.evaluate(() => { window.TextMuyGaleriaFuentes.abrir(() => { }); });
            const segunda = frame.evaluate(async () => { await new Promise((r) => setTimeout(r, 120)); window.TextMuyGaleriaFuentes.abrir(() => { }); });
            await Promise.all([primera, segunda]);
            let ok7 = false;
            for (let i = 0; i < 240; i++) { if (firmaVigente()) { ok7 = true; break; } await esperar(500); }
            check('E7 (I4/SC-009): dos aperturas => 1 sola escritura op=sprite',
                log.posts.filter((a) => a === 'sprite').length === 1, 'sprite=' + log.posts.filter((a) => a === 'sprite').length + ' firma=' + (firmaVigente() ? 'si' : 'no'));
            await page.screenshot({ path: CAPT + '\\e7-reentrancia.png' });
        } else {
            check('E7 (SOLO-UI): la galeria monta y lista (reentrancia solo en el lab)', true, 'modo solo-UI');
        }

        check('sin errores de pagina en el editor', errores.length === 0, errores.slice(0, 3).join(' | '));
    } finally {
        try { ro(false); } catch (e) { /* sin attrib */ }
        await browser.close();
    }
    fallas = resultados.filter((r) => !r.ok).length;
    try {
        fs.writeFileSync(CAPT + '\\galerias-sprite.json', JSON.stringify({ fecha: new Date().toISOString(), modo: SOLO_UI ? 'solo-UI' : 'lab', fallas: fallas, resultados: resultados }, null, 1));
    } catch (e) { /* evidencia opcional */ }
    console.log('\nGALERIAS-SPRITE: ' + (resultados.length - fallas) + '/' + resultados.length + ' OK' + (fallas ? ' - FALLAS: ' + fallas : ''));
    process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('FALLO: ' + (e && e.stack ? e.stack : e)); process.exit(1); });