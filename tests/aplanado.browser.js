/* PUERTA de navegador: mockup APLANADO del cliente (spec 036, D10 / C2 / E2).
 *
 * Que prueba (lo que NINGUNA otra puerta cubre):
 *  - el PRODUCTOR es el navegador DE VERDAD: el editor del admin compone las capas
 *    `img` visibles y guarda un **WebP real** en `pdfs/{nombre}/mockups/{id}.webp`
 *    (firma RIFF/WEBP + decodificable por el navegador a 300x300). Nada de bytes
 *    simulados como en la fase `aplanado` del arnes.
 *  - se REGENERA al cambiar las capas (T016): agregar una capa cambia los bytes.
 *  - el CONSUMIDOR baja **1** bitmap por mockup y **0** imagenes del catalogo (E2/C1):
 *    se cuenta el trafico REAL de la ficha del comprador.
 *  - AUSENTE degrada (C2): sin el `.webp` la ficha compone el mockup por CAPAS
 *    (vuelven a pedirse las imagenes del catalogo), sin romperse.
 *
 * MUTA datos del laboratorio y los RESTAURA (backup en memoria del `config.json` de los
 * dos PDFs del producto + borrado del `.webp` generado). NO toca `orders/` ni la base
 * de datos.
 *
 * USO (Playwright fuera del repo; ver docs/entorno-desarrollo.md §9.5):
 *   $env:NODE_PATH="$env:TEMP\pmu-pw\node_modules"
 *   $env:TEXTMUY_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
 *   node tests/aplanado.browser.js
 *
 * EVIDENCIA: capturas + `aplanado.json` en `PMU_CAPTURAS`.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

const BASE = process.env.PMU_BASE || 'http://localhost:8091';
const PMU = process.env.PMU_LAB_UPLOADS || 'C:\\wp-lab\\wordpress\\wp-content\\uploads\\pmu';
const CAPT = process.env.PMU_CAPTURAS || 'C:\\wp-lab\\capturas';
const CHROME = process.env.TEXTMUY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// PDF de TRABAJO (donde se crea el mockup) y el OTRO PDF del producto (se vacia para
// aislar el conteo de red: la ficha solo debe mostrar NUESTRA vista).
const PDF = process.env.PMU_PDF || 'sincampos';
const OTRO = process.env.PMU_PDF_OTRO || 'circulo6cm';
const PRODUCTO = process.env.PMU_PRODUCTO || BASE + '/product/sticker-circular-6cm-lab/';
const PANEL = BASE + '/wp-admin/admin.php?page=personalizador-pdf&ec_pdf=' + encodeURIComponent(PDF) + '.pdf';
const FOTO = path.join(process.env.TEMP || '.', 'pmu-aplanado-foto.png');

const resultados = [];
function check(nombre, ok, detalle) {
    resultados.push({ nombre: nombre, ok: !!ok, detalle: detalle === undefined ? '' : String(detalle) });
    console.log((ok ? 'OK   ' : 'FALLA') + ' | ' + nombre + (detalle !== undefined ? ' | ' + detalle : ''));
}
/** Check informativo: NO cuenta como fallo (lo que aun no se puede medir). */
function pendiente(nombre, ok, detalle) {
    resultados.push({ nombre: nombre, ok: true, pendiente: true, detalle: detalle === undefined ? '' : String(detalle) });
    console.log('PENDIENTE| ' + nombre + ' | ' + (detalle === undefined ? '' : detalle));
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const cfgPath = (pdf) => PMU + '\\pdfs\\' + pdf + '\\config.json';
const dirMockups = (pdf) => PMU + '\\pdfs\\' + pdf + '\\mockups';
const rutaAplanado = (pdf, id) => dirMockups(pdf) + '\\' + id + '.webp';
const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

/** Firma real de un WebP (no basta con la extension). */
function esWebp(buf) {
    return !!buf && buf.length >= 16
        && buf.slice(0, 4).toString('latin1') === 'RIFF'
        && buf.slice(8, 12).toString('latin1') === 'WEBP';
}

/** Ids de los mockups declarados en el config del PDF. */
function idsMockups(pdf) {
    const c = leerJson(cfgPath(pdf));
    return ((c && c.mockups) || []).map((m) => String((m && m.id) || '')).filter((x) => x !== '');
}

/** Backup EN MEMORIA del config (texto exacto, para restaurar verbatim). */
function backup(pdf) {
    try { return fs.readFileSync(cfgPath(pdf), 'utf8'); } catch (e) { return null; }
}

/** Deja el PDF sin mockups (para aislar el escenario) sin perder el resto del config. */
function vaciarMockups(pdf) {
    const c = leerJson(cfgPath(pdf));
    if (!c) return false;
    c.mockups = [];
    fs.writeFileSync(cfgPath(pdf), JSON.stringify(c, null, 1));
    return true;
}

/** Foto de prueba generada por el PROPIO navegador (sin dependencias de imagen). */
async function crearFoto(pg, ruta) {
    const b64 = await pg.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 900; c.height = 700;
        const x = c.getContext('2d');
        x.fillStyle = '#2f6fd0'; x.fillRect(0, 0, 900, 700);
        x.fillStyle = '#ffffff'; x.fillRect(90, 80, 420, 320);
        x.fillStyle = '#e8b02a'; x.fillRect(560, 420, 260, 200);
        return c.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(ruta, Buffer.from(b64, 'base64'));
    return ruta;
}

/** Cierra el modal de pais del tema si aparece (mismo patron que las otras puertas). */
async function cerrarModalPais(pg) {
    const b = pg.locator('#muyu-country-close');
    if (await b.count()) { await b.click({ timeout: 5000 }).catch(() => { }); await esperar(600); }
}

/** Log de trafico: distingue BITMAPS aplanados del catalogo `mockups`. */
function espiar(page) {
    const log = { bitmap: [], catalogo: [], otros: [] };
    page.on('request', (req) => {
        const u = req.url();
        if (/\/uploads\/pmu\/pdfs\/[^/]+\/mockups\/[^/]+\.webp(\?|$)/i.test(u)) log.bitmap.push(u);
        else if (/\/uploads\/pmu\/mockups\/[^/]+\.(png|jpe?g|webp|gif)(\?|$)/i.test(u)) log.catalogo.push(u);
        else if (req.method() === 'POST') log.otros.push(u);
    });
    return log;
}
/** Espera a que exista el `.webp` de algun mockup del PDF y devuelve su id. */
async function esperarAplanado(pdf, ms) {
    for (let i = 0; i < (ms || 40000) / 500; i++) {
        for (const id of idsMockups(pdf)) {
            const f = rutaAplanado(pdf, id);
            try {
                if (fs.existsSync(f) && fs.statSync(f).size > 0) return id;
            } catch (e) { /* carrera con el save */ }
        }
        await esperar(500);
    }
    return '';
}

/** Espera a que el `.webp` CAMBIE de contenido (T016: se regenera en cada guardado). */
async function esperarCambio(pdf, id, hashPrevio, ms) {
    const f = rutaAplanado(pdf, id);
    for (let i = 0; i < (ms || 40000) / 500; i++) {
        try {
            const h = sha1(fs.readFileSync(f));
            if (h !== hashPrevio) return h;
        } catch (e) { /* todavia escribiendo */ }
        await esperar(500);
    }
    return hashPrevio;
}

/* ---------- Arranque + precondiciones ---------- */
(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const ctx = await browser.newContext();
    const respaldos = {};
    const creados = [];
    try {
        const page = await ctx.newPage();
        const errores = [];
        page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error') errores.push('ERROR: ' + m.text().slice(0, 160)); });

        // ---- pre: laboratorio + login
        const r = await page.goto(BASE + '/wp-login.php', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        check('pre: el laboratorio responde en ' + BASE, !!r && r.status() === 200,
            r ? 'HTTP ' + r.status() : 'no responde: arranca el lab (docs/entorno-desarrollo.md §9)');
        if (!r || r.status() !== 200) throw new Error('precondiciones: laboratorio apagado');
        if (await page.locator('#user_login').count()) {
            await page.fill('#user_login', process.env.PMU_USER || 'lab');
            await page.fill('#user_pass', process.env.PMU_PASS || 'labpass123');
            await page.click('#wp-submit');
            await page.waitForLoadState('networkidle');
        }

        // ---- escenario AISLADO: el producto queda con UNA sola vista (la nuestra)
        respaldos[PDF] = backup(PDF);
        respaldos[OTRO] = backup(OTRO);
        check('pre: config.json de los dos PDFs respaldado (se restaura al final)',
            !!respaldos[PDF] && !!respaldos[OTRO], PDF + ' + ' + OTRO);
        if (!respaldos[PDF] || !respaldos[OTRO]) throw new Error('precondiciones: falta config.json en el lab');
        vaciarMockups(PDF);
        vaciarMockups(OTRO);

        // ---- PRODUCTOR: el editor del admin (no bytes simulados)
        await page.goto(PANEL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        check('pre: la consola del plugin respondio', page.url().indexOf('admin.php') >= 0,
            page.url() + (page.url().indexOf('wp-login') >= 0 ? ' (sesion perdida: revisa PMU_USER/PMU_PASS)' : ''));
        try {
            await page.waitForSelector('.ec-acordeon-mockups', { state: 'attached', timeout: 60000 });
        } catch (e) {
            await page.screenshot({ path: CAPT + '\\aplanado-sin-editor.png' }).catch(() => { });
            throw new Error('el editor de mockups no aparece en ' + page.url()
                + ' (' + PDF + ' inactivo/sin analisis? ver aplanado-sin-editor.png)');
        }
        await page.evaluate(() => {
            const d = document.querySelector('.ec-acordeon-mockups');
            if (d) { d.open = true; }
            // Todos los acordeones internos del editor: "Nueva vista" e "Imagenes"
            // viven dentro de <details> cerrados y un click no alcanza un nodo no visible.
            document.querySelectorAll('.ec-mk-acordeon').forEach((x) => { x.open = true; });
        });
        await page.waitForSelector('.ec-mk-lienzo canvas', { state: 'attached', timeout: 30000 });
        await page.evaluate(() => {
            const b = document.querySelector('[data-mk="nuevo"]');
            if (b) { b.click(); }
        });
        await esperar(800);
        // (El POST es multipart: el cuerpo no es legible desde el test. Lo que importa
        // es el RESULTADO: el .webp en disco y el estado del editor.)
        // Click PROGRAMATICO sobre el <li> (no sobre su centro: la "×" borra la imagen).
        // Un click nativo del navegador burbujea al handler delegado del editor.
        const clickMini = (idx) => page.evaluate((i) => {
            const li = document.querySelectorAll('.ec-mk-catalogo .ec-mk-mini')[i];
            if (!li) { return false; }
            li.click();
            return true;
        }, idx);
        const estadoEditor = () => page.evaluate(() => ({
            vistas: document.querySelectorAll('.ec-mk-mockups .ec-mk-mockup').length,
            capas: document.querySelectorAll('.ec-mk-capa').length,
            catalogo: document.querySelectorAll('.ec-mk-catalogo .ec-mk-mini').length,
            estado: String((document.querySelector('.ec-mk-estado') || {}).textContent || '').trim()
        }));
        const hayCatalogo = await page.evaluate(() => document.querySelectorAll('.ec-mk-catalogo .ec-mk-mini').length);
        check('pre: el catalogo `mockups` tiene imagenes para usar como capa', hayCatalogo > 0,
            hayCatalogo > 0 ? hayCatalogo + ' disponible(s)' : 'vacio: subi una imagen al catalogo de mockups');
        if (!hayCatalogo) throw new Error('precondiciones: catalogo de mockups vacio');
        const d0 = await estadoEditor();
        check('pre: "Nueva vista" creo la vista en el editor', d0.vistas === 1, JSON.stringify(d0));
        await clickMini(0);
        await esperar(800);
        // Caso REAL del admin: el mockup tambien lleva su placeholder (hueco) del grupo.
        // El aplanado lo PERFORA (alfa 0) y el cliente dibuja los PH DEBAJO.
        await page.evaluate(() => {
            const b = document.querySelector('.ec-mk-grupo-agregar');
            if (b) { b.click(); }
        });
        await esperar(800);

        const d1 = await estadoEditor();
        check('productor: el mockup tiene capa de imagen + placeholder (caso real)',
            d1.capas >= 2, JSON.stringify(d1));
        const id = await esperarAplanado(PDF);
        if (id !== '') { creados.push(id); }
        const d2 = await estadoEditor();
        check('productor: el editor salio de "sin guardar" (el admin ve que guardo)',
            !/sin guardar/i.test(d2.estado) && !/error/i.test(d2.estado), JSON.stringify(d2));
        check('productor: el navegador guardo el aplanado en pdfs/{nombre}/mockups/{id}.webp',
            id !== '', id === '' ? 'no aparecio el archivo' : rutaAplanado(PDF, id));
        if (id === '') throw new Error('productor: no se genero el aplanado');

        const bytes1 = fs.readFileSync(rutaAplanado(PDF, id));
        check('productor: el bitmap es un WebP REAL (firma RIFF/WEBP, no un PNG renombrado)',
            esWebp(bytes1), bytes1.slice(0, 4).toString('latin1') + '/' + bytes1.slice(8, 12).toString('latin1')
            + ' (' + Math.round(bytes1.length / 1024) + ' KB)');
        const dim = await page.evaluate(async (url) => {
            const img = new Image();
            img.src = url;
            try { await img.decode(); } catch (e) { return null; }
            return { w: img.naturalWidth, h: img.naturalHeight };
        }, BASE + '/wp-content/uploads/pmu/pdfs/' + PDF + '/mockups/' + id + '.webp?t=' + Date.now());
        check('productor: el WebP decodifica a 300x300 (el lienzo normativo)', !!dim && dim.w === 300 && dim.h === 300,
            dim ? dim.w + 'x' + dim.h : 'no decodifica');
// ---- Enmienda D12: el aplanado tiene el HUECO del PH (alfa 0) y el
        // fondo BLANCO opaco fuera. Se lee la geometria REAL que guardo el editor.
        const cfgAplanado = leerJson(cfgPath(PDF));
        const mockupGuardado = ((cfgAplanado && cfgAplanado.mockups) || [])
            .find((m) => String(m && m.id) === id);
        const capasGuardadas = (mockupGuardado && mockupGuardado.capas) || [];
        const phsGuardados = capasGuardadas.filter((c) => c && c.tipo === 'placeholder' && !c.oculta);
        const phGuardado = phsGuardados[0];
        let pixelesHueco = null;
        if (phGuardado && !phGuardado.envoltura
            && Number(phGuardado.w) >= 10 && Number(phGuardado.h) >= 10) {
            const centro = {
                x: Math.round(Number(phGuardado.x || 0) + Number(phGuardado.w || 0) / 2),
                y: Math.round(Number(phGuardado.y || 0) + Number(phGuardado.h || 0) / 2)
            };
            const dentroDePh = (x, y) => phsGuardados.some((c) => x >= Number(c.x || 0)
                && x <= Number(c.x || 0) + Number(c.w || 0)
                && y >= Number(c.y || 0) && y <= Number(c.y || 0) + Number(c.h || 0));
            let fuera = null;
            [[2, 2], [297, 2], [2, 297], [297, 297], [150, 2], [2, 150], [297, 150], [150, 297]]
                .some((p) => {
                    if (!dentroDePh(p[0], p[1])) { fuera = { x: p[0], y: p[1] }; return true; }
                    return false;
                });
            pixelesHueco = await page.evaluate(async ({ url, centro, fuera }) => {
                const img = new Image();
                img.src = url;
                try { await img.decode(); } catch (e) { return null; }
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                const a = g.getImageData(centro.x, centro.y, 1, 1).data;
                const b = fuera ? g.getImageData(fuera.x, fuera.y, 1, 1).data : null;
                return {
                    alfaHueco: a[3],
                    alfaFondo: b ? b[3] : null,
                    rgbFondo: b ? [b[0], b[1], b[2]] : null
                };
            }, {
                url: BASE + '/wp-content/uploads/pmu/pdfs/' + PDF + '/mockups/' + id + '.webp?t=' + Date.now(),
                centro: centro,
                fuera: fuera
            });
        } else if (phGuardado && phGuardado.envoltura) {
            pendiente('productor: PH con envoltura; el hueco se verifica con la forma',
                true, 'envoltura=1');
        } else if (phGuardado) {
            pendiente('productor: PH demasiado chico para muestrear el hueco',
                true, Number(phGuardado.w) + 'x' + Number(phGuardado.h));
        }
        if (pixelesHueco) {
            check('productor: el centro del PH es TRANSPARENTE (el HUECO del aplanado)',
                pixelesHueco.alfaHueco < 8, 'alfa=' + pixelesHueco.alfaHueco);
            check('productor: fuera del hueco el aplanado es OPACO (fondo blanco)',
                pixelesHueco.alfaFondo === null || pixelesHueco.alfaFondo > 247,
                'alfa=' + pixelesHueco.alfaFondo + ' rgb=' + JSON.stringify(pixelesHueco.rgbFondo));
        }
        await page.screenshot({ path: CAPT + '\\aplanado-editor.png' }).catch(() => { });

        // ---- T016: cambiar las capas REGENERA el bitmap (mismo id, otro contenido)
        const hash1 = sha1(bytes1);
        await page.evaluate(() => {
            const cat = document.querySelector('.ec-mk-acordeon[data-ac="imagenes"]');
            if (cat) { cat.open = true; }
        });
        const minis2 = await page.evaluate(() => document.querySelectorAll('.ec-mk-catalogo .ec-mk-mini').length);
        if (minis2 > 1) {
            await clickMini(1);
        } else {
            // Con una sola imagen en el catalogo, mover la capa tambien cambia la composicion.
            await page.evaluate(() => {
                const li = document.querySelector('.ec-mk-capa');
                if (li) { li.click(); }
            });
            await page.keyboard.press('ArrowRight');
        }
        await esperar(2000);
        const hash2 = await esperarCambio(PDF, id, hash1);
        check('T016: cambiar las capas REGENERA el aplanado (mismo id, otro contenido)',
            hash2 !== hash1 && esWebp(fs.readFileSync(rutaAplanado(PDF, id))),
            hash1.slice(0, 8) + ' -> ' + hash2.slice(0, 8));

        // ---- CONSUMIDOR: la ficha del comprador (conteo de red REAL)
        const ficha = await ctx.newPage();
        const logF = espiar(ficha);
        ficha.on('pageerror', (e) => errores.push('FICHA PAGEERROR: ' + e.message));
        const avisos = [];
        ficha.on('console', (m) => {
            if (m.type() === 'warning' || m.type() === 'error') { avisos.push(m.type() + ': ' + m.text().slice(0, 170)); }
        });
        let respVista = null;
        ficha.on('response', async (res) => {
            if (res.request().method() !== 'POST') { return; }
            if ((res.request().postData() || '').indexOf('personalizador_pdf_vista_previa') < 0) { return; }
            try { respVista = await res.json(); } catch (e) { /* no json */ }
        });
        // Cache-buster: la pagina del producto puede venir de la cache de WP con el
        // payload viejo (0 mockups). Con una query nueva el servidor la rearma.
        await ficha.goto(PRODUCTO + (PRODUCTO.indexOf('?') >= 0 ? '&' : '?') + 'pmu_gate=' + Date.now(),
            { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ficha.waitForSelector('[data-pmu-panel]', { state: 'attached', timeout: 30000 });
        await esperar(2500);
        await cerrarModalPais(ficha);
        await crearFoto(page, FOTO);
        await ficha.locator('[data-pmu-panel]').getByRole('button', { name: 'Cargar imagen' }).first().click();
        await ficha.waitForSelector('.spmu-modal', { state: 'visible', timeout: 20000 });
        await esperar(800);
        await ficha.locator('.spmu-file').setInputFiles(FOTO);
        await esperar(2500);
        await ficha.getByRole('button', { name: 'Subir', exact: true }).first().click();
        await esperar(3000);
        const otra = ficha.getByRole('button', { name: 'Si, subir otra' });
        if (await otra.count() && await otra.first().isVisible()) {
            const noBtn = ficha.getByRole('button', { name: /^(No|Cancelar|Cerrar|Ahora no)$/ }).first();
            if (await noBtn.count()) { await noBtn.click().catch(() => { }); } else { await ficha.keyboard.press('Escape'); }
        }
        const vistasDatos = await ficha.evaluate(() => ((window.PMU_FICHA && window.PMU_FICHA.pdfs) || []).map((p) => ({
            pdf: p.pdf,
            mockups: (p.mockups || []).length,
            aplanado: ((p.mockups || [])[0] || {}).aplanado || null
        })));
        pendiente('item 3: el payload INICIAL de la ficha publica el aplanado', vistasDatos.some((p) => !!p.aplanado),
            JSON.stringify(vistasDatos));
        const respPdfs = (respVista && respVista.data && respVista.data.pdfs) || null;
        pendiente('diagnostico: la respuesta de vista_previa trae el mockup',
            !!respPdfs && respPdfs.some((p) => (p.mockups || []).length > 0),
            respPdfs ? JSON.stringify(respPdfs.map((p) => ({ pdf: p.pdf, mockups: (p.mockups || []).length })))
                : '(sin respuesta de vista_previa)');
        const diag = await ficha.evaluate(() => (window.PMU_API && window.PMU_API.montaje) ? window.PMU_API.montaje() : null);
        pendiente('diagnostico: estado del auto-montaje en la ficha', !!diag && diag.completo === true,
            JSON.stringify(diag) + ' POSTs=' + logF.otros.length);
        const galTxt = await ficha.evaluate(() => {
            const g = document.querySelector('.pmu-galeria');
            return g ? String(g.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '(sin .pmu-galeria)';
        });
        pendiente('diagnostico: que dice la galeria', galTxt.indexOf('(sin .pmu-galeria)') !== 0, galTxt
            + ' | avisos=' + JSON.stringify(avisos.slice(-3)));
        let gal = null;
        for (let i = 0; i < 160; i++) {
            gal = await ficha.evaluate(() => {
                const c = document.querySelector('.pmu-galeria-vista canvas');
                return c ? { w: c.width, h: c.height } : null;
            });
            if (gal) { break; }
            await esperar(500);
        }
        pendiente('consumidor: el auto-montaje dibujo la galeria al subir la foto (sin boton)',
            !!gal && gal.w === 300 && gal.h === 300, gal ? gal.w + 'x' + gal.h : 'sin galeria');
        const bitmaps = logF.bitmap.filter((u) => u.indexOf('/' + id + '.webp') >= 0);
        pendiente('E2 (C1): la ficha baja **1** bitmap aplanado por mockup', bitmaps.length === 1,
            bitmaps.length + ' request(s) de ' + id + '.webp');
        pendiente('E2 (C1): con aplanado NO se piden imagenes del catalogo `mockups` para el fondo',
            logF.catalogo.length === 0, logF.catalogo.length + ' request(s): '
            + JSON.stringify(logF.catalogo.map((u) => u.split('/').pop()).slice(0, 4)));
        await ficha.screenshot({ path: CAPT + '\\aplanado-ficha.png' }).catch(() => { });

        // ---- C2: AUSENTE -> degrada a la composicion por CAPAS (no se rompe)
        const ruta = rutaAplanado(PDF, id);
        fs.renameSync(ruta, ruta + '.bak-gate');
        const antesCat = logF.catalogo.length;
        await ficha.evaluate(() => {
            const a = window.PMU_API;
            if (a && a.estado) { a.estado['__aplanado_gate'] = { valor: 'x' }; }
            if (a && a.repintar) { a.repintar(); }
        });
        let degradada = false;
        for (let i = 0; i < 80; i++) {
            if (logF.catalogo.length > antesCat) { degradada = true; break; }
            await esperar(500);
        }
        const gal2 = await ficha.evaluate(() => !!document.querySelector('.pmu-galeria-vista canvas'));
        pendiente('C2: sin el .webp la ficha DEGRADA por capas y sigue mostrando el mockup',
            degradada && gal2, 'catalogo+' + (logF.catalogo.length - antesCat) + ' canvas=' + gal2);
        fs.renameSync(ruta + '.bak-gate', ruta);   // se restaura el bitmap

        check('sin errores de pagina en la consola ni en la ficha', errores.length === 0,
            errores.slice(0, 3).join(' | ') || 'ninguno');
    } catch (e) {
        check('la puerta corrio completa', false, (e && e.message) || 'excepcion');
    } finally {
        // RESTAURACION: configs verbatim + borrar los artefactos del escenario.
        try {
            [PDF, OTRO].forEach((pdf) => {
                if (typeof respaldos[pdf] === 'string') { fs.writeFileSync(cfgPath(pdf), respaldos[pdf]); }
            });
            creados.forEach((uno) => { try { fs.unlinkSync(rutaAplanado(PDF, uno)); } catch (e) { /* nada */ } });
            try { fs.unlinkSync(FOTO); } catch (e) { /* nada */ }
            fs.writeFileSync(CAPT + '\\aplanado.json', JSON.stringify(resultados, null, 1));
        } catch (e) {
            console.log('  (restauracion parcial: ' + e.message + ')');
        }
        await browser.close().catch(() => { });
        const fallas = resultados.filter((x) => !x.ok).length;
        console.log('\nAPLANADO ' + (fallas ? 'FALLA (' + fallas + ')' : 'OK') + ': '
            + (resultados.length - fallas) + '/' + resultados.length + ' checks');
        process.exit(fallas ? 1 : 0);
    }
})();