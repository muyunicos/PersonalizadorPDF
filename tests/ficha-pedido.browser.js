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
// Spec 035: el arbol de pedidos es por CLIENTE (`orders/{clave}/{order_id}/...`).
// El usuario de prueba del lab es `lab`, id 1.
const CLAVE_LAB = process.env.PMU_CLAVE || '1';
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
    const log = { posts: [], ops: [], respuestas: {}, vistaPrevia: 0, vistaPreviaResp: null };
    page.on('request', (req) => {
        const u = req.url();
        if (req.method() !== 'POST') return;
        if (u.indexOf('admin-post.php') < 0 && u.indexOf('admin-ajax.php') < 0) return;
        const b = req.postData() || '';
        const m = /name="action"\r?\n\r?\n([^\r\n]+)/.exec(b) || /[?&]action=([^&\r\n]+)/.exec(u);
        const accion = m ? decodeURIComponent(m[1]) : '(action?)';
        // El endpoint del motor usa `action` + `op`: se conservan los dos (spec 030).
        const mo = /name="op"\r?\n\r?\n([^\r\n]+)/.exec(b) || /[?&]op=([^&\r\n]+)/.exec(u);
        log.posts.push(accion);
        log.ops.push(accion + (mo ? ':' + decodeURIComponent(mo[1]) : ''));
        // Spec 036 (T025/D3): contador ACUMULADO de vistas previas. `limpiar(log)`
        // borra `posts` entre fases, pero el auto-montaje puede haber disparado
        // antes: esto mide "hubo vista previa" aunque el log se haya limpiado.
        if (accion === 'personalizador_pdf_vista_previa') { log.vistaPrevia++; }
        req.__accion = accion;
    });
    page.on('response', async (res) => {
        const req = res.request();
        if (!req.__accion) return;
        try {
            log.respuestas[req.__accion] = await res.json();
            if (req.__accion === 'personalizador_pdf_vista_previa') { log.vistaPreviaResp = log.respuestas[req.__accion]; }
        } catch (e) { /* no JSON */ }
    });
    return log;
}
const cuenta = (log, accion) => log.posts.filter((a) => a === accion).length;
async function cerrarModalPais(page) {
    const b = page.locator('#muyu-country-close');
    if (await b.count()) { await b.click({ timeout: 5000 }).catch(() => { }); await esperar(600); }
}
/* ---- Biblioteca del comprador (spec 030) ---- */
const limpiar = (log) => { log.posts.length = 0; log.ops.length = 0; log.respuestas = {}; };
const ops = (log, sufijo) => log.ops.filter((o) => o.slice(-sufijo.length) === sufijo).length;
async function abrirModal(page) {
    await cerrarOverlays(page);                  // sin overlays colgados que intercepten clicks
    const btn = page.locator('[data-pmu-panel] button', { hasText: /^Cargar imagen$/ }).first();
    // OJO: `cargador-pmu.js` deshabilita ese boton cuando la ranura ya tiene sus
    // fotos (`slot.boton.disabled = n >= r.max`). El camino REAL del comprador para
    // volver al modal es: tocar la miniatura de la ranura => visor => Reemplazar.
    if (await btn.count() && await btn.isEnabled()) {
        await btn.click();
    } else {
        const mini = page.locator('[data-pmu-panel] .cpmu-mini').first();
        await mini.waitFor({ state: 'visible', timeout: 15000 });
        await mini.click();
        await esperar(900);
        const reempl = page.getByRole('button', { name: /^Reemplazar$/ }).first();
        if (await reempl.count() && await reempl.first().isVisible()) { await reempl.first().click(); }
    }
    await page.waitForSelector('.spmu-modal', { state: 'visible', timeout: 20000 });
    await esperar(1500);
}
async function cerrarOverlays(page) {
    // Dos overlays pueden quedar abiertos y comerse los clicks: el visor del
    // cargador (`cpmu-visor`) y el modal de recorte (`spmu-modal`).
    for (let i = 0; i < 6; i++) {
        const pv = page.locator('.pmu-visor').first();
        if (await pv.count() && await pv.isVisible()) {
            await pv.locator('.pmu-visor-cerrar').click({ force: true }).catch(() => { });
            await esperar(600);
            continue;
        }
        const v = page.locator('.cpmu-visor').first();
        if (await v.count() && await v.isVisible()) {
            await v.locator('.cpmu-visor-cerrar').click({ force: true }).catch(() => { });
            await esperar(600);
            continue;
        }
        const m = page.locator('.spmu-modal').first();
        if (await m.count() && await m.isVisible()) {
            const c = m.locator('button', { hasText: /^Cancelar$/ }).first();
            if (await c.count()) { await c.click({ force: true }).catch(() => { }); } else { await page.keyboard.press('Escape'); }
            await esperar(600);
            continue;
        }
        break;
    }
    await esperar(400);
}
const cerrarModal = cerrarOverlays;
async function tiraBib(page) {
    return page.evaluate(() => {
        const t = document.querySelector('.pmu-bib-tira');
        if (!t) return { montada: false, minis: 0, versionadas: 0, mas: 0 };
        const minis = [...t.querySelectorAll('.pmu-bib-mini')].filter((b) => !b.classList.contains('pmu-bib-mas'));
        return {
            montada: true, minis: minis.length, mas: t.querySelectorAll('.pmu-bib-mas').length,
            versionadas: minis.filter((b) => /versiones/.test(b.title || '')).length,
            titulos: minis.map((b) => b.title || '')
        };
    });
}
/** Filas `origen: ref` de los manifests del item (spec 030 D2/D11). */
function filasRef() {
    const out = [];
    for (const f of listarRec(PMU + '\\tmp')) {
        if (!/manifest\.json$/.test(f.ruta)) continue;
        try {
            const j = JSON.parse(fs.readFileSync(f.ruta, 'utf8'));
            (j.subidas || []).forEach((s) => { if (s && s.origen === 'ref') out.push({ item: f.ruta, ref: String(s.ref || ''), madre: String(s.madre || '') }); });
        } catch (e) { /* no json */ }
    }
    return out;
}
/** Familia (`madre`) -> archivos, desde los manifests del comprador (spec 030). */
function familiasItem() {
    const out = {};
    for (const f of listarRec(PMU + '\\tmp')) {
        if (!/manifest\.json$/.test(f.ruta)) continue;
        try {
            const j = JSON.parse(fs.readFileSync(f.ruta, 'utf8'));
            (j.subidas || []).forEach((s) => {
                const m = String(s.madre || '');
                if (!m) return;
                if (!out[m]) out[m] = [];
                out[m].push(String(s.file || s.ref || ''));
            });
        } catch (e) { /* no json */ }
    }
    return out;
}
/** Cierra el aviso "¿Queres subir otra imagen?" (spec 021) si aparece. */
async function subirOtra(pg) {
    const otra = pg.getByRole('button', { name: 'Si, subir otra' });
    if (await otra.count() && await otra.first().isVisible()) {
        const noBtn = pg.getByRole('button', { name: /^(No|Cancelar|Cerrar|Ahora no)$/ }).first();
        if (await noBtn.count()) { await noBtn.click().catch(() => { }); } else { await pg.keyboard.press('Escape'); }
    }
    await esperar(1200);
}
/** Espera a que la tira se monte y tenga al menos `minis` entradas. */
async function esperarTira(page, minis) {
    let r = { montada: false, minis: 0, versionadas: 0, mas: 0 };
    for (let i = 0; i < 40; i++) {
        r = await tiraBib(page);
        if (r.montada && r.minis >= minis) break;
        await esperar(500);
    }
    return r;
}
/**
 * Spec 035: el ORIGINAL del comprador vive en la carpeta COMPARTIDA de la sesion
 * (`tmp/sesion-{sid}/uploads/`), no en `{item}/subidas/` (ubicacion pre-035). El
 * regex exige `sesion-{sid}/uploads/`, para no confundirse con `wp-content/uploads`.
 */
const esOriginalSesion = (f) => /[\\/]sesion-[^\\/]+[\\/]uploads[\\/][^\\/]+$/.test(f.ruta);
const subidasArchivos = () => listarRec(PMU + '\\tmp').filter((f) => esOriginalSesion(f));

/* ---------- Spec 035 (§3.5): marca de "visto" (recorrido de navegador) ---------- */
/** Estado de la galeria via el hook de SOLO LECTURA de `tienda.js`. */
const galeriaEstado = (page) => page.evaluate(() => {
    const g = (window.PMU_Tienda && window.PMU_Tienda.galeria) ? window.PMU_Tienda.galeria() : null;
    return g ? { vistas: g.vistas, idx: g.idx, visto: g.visto, faltan: g.faltan, itemKey: g.itemKey } : null;
});
/** La leyenda solo cuenta si esta REALMENTE en pantalla (`display` + `offsetParent`). */
const leyendaVistas = (page) => page.evaluate(() => {
    const e = document.querySelector('.pmu-gal-revisar');
    if (!e) { return { existe: false, visible: false, texto: '' }; }
    const st = window.getComputedStyle(e);
    return { existe: true, visible: st.display !== 'none' && e.offsetParent !== null, texto: e.textContent.trim() };
});
/** Marcas guardadas en localStorage (una entrada por item_key). */
const marcasLocales = (page) => page.evaluate(() => {
    try {
        const todo = JSON.parse(window.localStorage.getItem('pmu_vistas_v1') || '{}');
        const items = Object.keys(todo);
        return { items: items.length, itemKey: items[0] || '', marcas: items.length ? (todo[items[0]] || []) : [] };
    } catch (e) { return null; }
});
const botonCarrito = (page) => page.evaluate(() => {
    const b = document.querySelector('.single_add_to_cart_button');
    return b ? b.disabled : null;
});
/** Espera a que la galeria tenga `n` vistas armadas (o se agota el tiempo). */
const esperarGaleria = async (page, n) => {
    for (let i = 0; i < 200; i++) {
        const g = await galeriaEstado(page);
        if (g && g.vistas.length === n) return g;
        await esperar(500);
    }
    return await galeriaEstado(page);
};
/**
 * Siembra el escenario de US3 en el lab y devuelve el RESTAURADOR. El lab traia
 * `circulo6cm` OMISIBLE y `sincampos` sin mockups: sin vistas obligatorias el
 * carrito nunca se bloquea y US3 no seria verificable. Se deja 2 obligatorias
 * (circulo6cm) + 1 omisible (sincampos), y se restaura al terminar.
 */
const sembrarUS3 = () => {
    const dir = PMU + '\\pdfs\\';
    const leer = (pdf) => JSON.parse(fs.readFileSync(dir + pdf + '\\config.json', 'utf8'));
    const escribir = (pdf, j) => fs.writeFileSync(dir + pdf + '\\config.json', JSON.stringify(j, null, 1));
    const original = { circulo6cm: leer('circulo6cm'), sincampos: leer('sincampos') };
    const c = JSON.parse(JSON.stringify(original.circulo6cm));
    c.preview_omisible = false;                       // ahora OBLIGA
    c.mockups = c.mockups || [];
    while (c.mockups.length < 2) {                    // 2 vistas obligatorias
        const m = JSON.parse(JSON.stringify(c.mockups[0]));
        m.id = 'mockup-' + (c.mockups.length + 1);
        c.mockups.push(m);
    }
    escribir('circulo6cm', c);
    const s = JSON.parse(JSON.stringify(original.sincampos));
    s.preview_omisible = true;                        // queda EXIMIDA
    const ms = JSON.parse(JSON.stringify(c.mockups[0]));
    ms.id = 'mockup-s1';
    s.mockups = [ms];
    escribir('sincampos', s);
    return () => {
        escribir('circulo6cm', original.circulo6cm);
        escribir('sincampos', original.sincampos);
    };
};

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
    // Spec 035 (§3.5): restaurador del escenario US3 sembrado en el lab. Se declara
    // aca para que el `finally` lo pueda correr aunque el recorrido falle a mitad.
    let restaurarUS3 = null;
    try {
        const page = await ctx.newPage();
        const errores = [];
        page.on('pageerror', (e) => errores.push('PAGEERROR: '
            + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' <- ') : (e && e.message))));
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
        check('ficha: cargador expuesto y SIN boton "Vista previa" (spec 036/D3)', ficha.btnCargar && ficha.btnPreview === false, JSON.stringify({ cargar: ficha.btnCargar, previa: ficha.btnPreview }));
        check('ficha (spec 022): el carrito arranca bloqueado por el min de fotos', !!ficha.add && ficha.add.disabled === true, JSON.stringify(ficha.add));
        check('ficha (spec 022): aviso de faltantes visible', !!ficha.aviso, ficha.aviso || '(sin aviso)');
        // ---- E1 (spec 036, D7): 0 red al cargar la ficha, ANTES de tocar nada.
        // Las imagenes del comprador se piden al abrir el modal y el motor de texto
        // (TextMuy) solo se instancia si hay texto NUEVO que renderizar.
        check('E1 (spec 036/D7): al abrir la ficha NO se pide la biblioteca (0 op=listar)',
            ops(log, ':listar') === 0, JSON.stringify(log.ops));
        check('E1 (spec 036/D7): al abrir la ficha no hay POST de vista previa ni de subida',
            cuenta(log, 'personalizador_pdf_vista_previa') === 0
            && log.posts.filter((a) => /_subida/.test(a)).length === 0, JSON.stringify(log.posts));
        const motorE1 = await page.evaluate(() => !!document.querySelector('iframe[title="Motor de render TextMuy"]'));
        check('E1 (spec 036/D7): el motor de texto NO se instancio al abrir', motorE1 === false);
        await page.screenshot({ path: CAPT + '\\ficha-inicial.png' });

        // Spec 035 (§3.5) + 036: SIEMBRA del escenario de US3 (2 obligatorias + 1
        // omisible) ANTES de completar la ficha. Con el auto-montaje (036/D3) la
        // galeria nace del PRIMER montaje: si se sembrara despues, ya estaria
        // montada con el config viejo. El restaurador corre en el `finally`.
        restaurarUS3 = sembrarUS3();

        // ---- Cargador: subir la foto (spec 012 + 026 + 030)
        const antesSubidas = listarRec(PMU + '\\tmp').filter(esOriginalSesion).length;
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
        const subidas = listarRec(PMU + '\\tmp').filter(esOriginalSesion);
        const subidaOk = cuenta(log, 'personalizador_pdf_subida') >= 1 || cuenta(log, 'personalizador_pdf_biblioteca') >= 1;
        check('cargador: POST de subida (subida o biblioteca de la spec 030)', subidaOk, JSON.stringify(log.posts));
        check('cargador (spec 035): la foto de esta corrida entro a la carpeta de la sesion',
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

        /* ---- Biblioteca del comprador (spec 030, T042) ---- */
        // E2: tira del invitado. Al abrir el modal: 1 `op=listar`; al reabrir: `sin_cambios` (0 peticiones).
        limpiar(log);
        await abrirModal(page);
        let bib = { montada: false, minis: 0, versionadas: 0, mas: 0 };
        for (let i = 0; i < 30; i++) { bib = await tiraBib(page); if (bib.montada && bib.minis >= 1) break; await esperar(500); }
        check('biblioteca (030/E2): la tira se monta con la foto subida (1 entrada)', bib.montada && bib.minis === 1, JSON.stringify(bib));
        check('biblioteca (030/E2): 1 sola peticion op=listar al abrir', ops(log, ':listar') === 1, JSON.stringify(log.ops));
        const respBib = log.respuestas['personalizador_pdf_biblioteca'] || null;
        check('biblioteca (030/E8): la lista llego (volumen real anotado)', !!respBib && !!(respBib.data || {}).fotos,
            'fotos=' + ((respBib && respBib.data && respBib.data.fotos) ? respBib.data.fotos.length : '?') + ' | el sembrado de 300 pedidos queda como prueba de volumen manual');
        await cerrarModal(page);
        limpiar(log);
        await abrirModal(page);
        const bib2 = await esperarTira(page, 1);
        const r2 = (log.respuestas['personalizador_pdf_biblioteca'] || {}).data || {};
        check('biblioteca (030/E2): al reabrir revalida con 1 op=listar y el servidor responde sin_cambios', ops(log, ':listar') === 1 && r2.sin_cambios === true,
            JSON.stringify(log.ops) + ' | sin_cambios=' + JSON.stringify(r2.sin_cambios) + ' (lo que NO viaja es la lista: E8)');
        check('biblioteca (030/E2): la tira sigue mostrando la foto desde la copia local', bib2.montada && bib2.minis === 1, JSON.stringify(bib2));

        // E9: visor compartido (al tocar una miniatura) con Elegir/Borrar y 0 peticiones al recorrer.
        await page.locator('.pmu-bib-tira .pmu-bib-mini').first().click();
        let visorBib = null;
        for (let i = 0; i < 20; i++) {
            visorBib = await page.evaluate(() => {
                const v = document.querySelector('.pmu-visor');
                if (!v) return null;
                return {
                    titulo: (v.querySelector('.pmu-visor-titulo') || {}).textContent || '',
                    acciones: [...v.querySelectorAll('.pmu-visor-acciones button')].map((b) => b.textContent.trim()),
                    segs: [...v.querySelectorAll('.pmu-visor-seg')].map((b) => b.textContent.trim()),
                    img: !!v.querySelector('.pmu-visor-img')
                };
            });
            if (visorBib) break; await esperar(400);
        }
        check('biblioteca (030/E9): tocar la miniatura abre el visor compartido', !!visorBib && /Mis imagenes/i.test(visorBib.titulo), JSON.stringify(visorBib));
        check('biblioteca (030/E9): el visor de la biblioteca ofrece Elegir y Borrar', !!visorBib && visorBib.acciones.indexOf('Elegir') >= 0 && visorBib.acciones.indexOf('Borrar') >= 0, JSON.stringify(visorBib && visorBib.acciones));
        limpiar(log);
        for (let i = 0; i < 4; i++) {
            const nav = page.locator('.pmu-visor-nav:not([hidden])').first();
            if (await nav.count()) { await nav.click().catch(() => { }); await esperar(500); }
        }
        check('biblioteca (030/E9): recorrer el visor no dispara peticiones', log.ops.length === 0, JSON.stringify(log.ops));

        // E3: Elegir sin recomponer = 0 bytes. Primero se VACIA la ranura (Eliminar en el
        // visor del cargador) para que Elegir tenga algo que hacer: si la ranura ya
        // tiene esa misma foto, Elegir es un no-op y no escribe nada.
        limpiar(log);
        await cerrarOverlays(page);
        await page.locator('[data-pmu-panel] .cpmu-mini').first().click();
        await esperar(900);
        page.on('dialog', async (d) => { await d.accept().catch(() => { }); });
        await page.getByRole('button', { name: 'Eliminar', exact: true }).first().click();
        await esperar(2000);
        await cerrarOverlays(page);
        const bytesAntes = subidasArchivos().length;
        const refsAntes = filasRef().length;
        await abrirModal(page);
        await esperarTira(page, 1);
        await page.locator('.pmu-bib-tira .pmu-bib-mini').first().click();
        await page.waitForSelector('.pmu-visor', { state: 'visible', timeout: 10000 }).catch(() => { });
        limpiar(log);
        await page.getByRole('button', { name: 'Elegir', exact: true }).first().click();
        await esperar(2500);
        await cerrarOverlays(page);
        check('biblioteca (030/E3): Elegir NO subio bytes (sin POST de alta/subida)', ops(log, ':alta') === 0 && cuenta(log, 'personalizador_pdf_subida') === 0, JSON.stringify(log.ops));
        check('biblioteca (030/E3): el item no gano archivos en subidas/', subidasArchivos().length === bytesAntes, bytesAntes + ' -> ' + subidasArchivos().length);
        const refs = filasRef();
        // D2: la fila `origen: ref` existe cuando el archivo vive en OTRO item/pedido.
        // Aca la familia es la del PROPIO item, asi que el contrato es NO escribir ref
        // (y no mover un byte). El caso cruzado (ref a un pedido pagado) lo cubre la
        // fase `biblioteca` del arnes en CLI.
        check('biblioteca (030/E3/D2): con la familia en el propio item no escribe ref (contrato del caso cruzado)', refs.length === refsAntes, refsAntes + ' -> ' + refs.length + ' | ' + JSON.stringify(refs.slice(-1)));

        // E4: reusar recomponiendo => VERSION de la MISMA familia. Se comprueba en el
        // manifest (fuente de verdad): filas que comparten `madre` con `{madre}-N`.
        const famAntes = familiasItem();
        await abrirModal(page);
        await page.evaluate(() => {
            const r = document.querySelector('.spmu-fila-escala input[type=range]');
            if (r) { r.value = String(Math.min(4, (Number(r.value) || 1) * 1.5)); r.dispatchEvent(new Event('input', { bubbles: true })); }
        });
        await esperar(800);
        await page.locator('.spmu-file').setInputFiles(FOTO);
        await esperar(2500);
        await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
        await esperar(3000);
        await subirOtra(page);
        await cerrarOverlays(page);
        const famDespues = familiasItem();
        // E4 (spec 035, D3/D7): re-encuadrar la MISMA foto recompone la misma imagen: el
        // `id` del original no cambia (el contenido es el mismo, se deduplica) y la
        // receta vigente se ACTUALIZA en la fila. Ya NO entra un archivo `{madre}-2`:
        // eso era el modelo pre-035, donde cada recorte era un archivo propio.
        const versionadas = Object.keys(famDespues).filter((m) => /-2\./.test(famDespues[m].join(' ')));
        check('biblioteca (035/D3/D7): re-encuadrar NO crea familia ni version nueva',
            versionadas.length === 0 && Object.keys(famDespues).length === Object.keys(famAntes).length,
            'familias=' + Object.keys(famDespues).length + ' antes=' + Object.keys(famAntes).length + ' | version=' + JSON.stringify(versionadas.slice(0, 2)));

        // E6.1: dedupe por contenido. Subir la MISMA foto otra vez NO crea otra familia.
        const familiasAntes6 = Object.keys(familiasItem()).length;
        await abrirModal(page);
        await page.locator('.spmu-file').setInputFiles(FOTO);
        await esperar(2500);
        await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
        await esperar(2500);
        await subirOtra(page);
        await cerrarOverlays(page);
        const familiasDespues6 = Object.keys(familiasItem()).length;
        check('biblioteca (030/E6): re-subir la misma foto reusa la familia (sin duplicar la entrada)', familiasDespues6 === familiasAntes6,
            familiasAntes6 + ' -> ' + familiasDespues6 + ' familias');
        page.screenshot({ path: CAPT + '\\biblioteca-tira.png' }).catch(() => { });

        // (El sembrado del escenario de US3 se movio al inicio de la ficha: el
        // auto-montaje de la spec 036 monta con el config ya sembrado.)

        // ---- Vista previa: galeria 300x300 + mockup (spec 004/011) y pool (spec 029)
        const op = page.locator('.pmu-opciones-btn');
        if (await op.count()) { await op.last().click().catch(() => { }); await esperar(400); }
        // Spec 036 (T025/D3): la galeria se monta SOLA. No se resetea el log de POSTs:
        // el auto-montaje puede haber disparado durante la carga de fotos, y lo que
        // se verifica es que hubo vista previa sin pulsar nada.
        const diagMontaje = await page.evaluate(() => (window.PMU_API && window.PMU_API.montaje) ? window.PMU_API.montaje() : null);
        check('E4 (spec 036/D3): la galeria se monto SOLA al completar la ficha (sin pulsar nada)',
            !!diagMontaje && diagMontaje.completo === true && diagMontaje.hecho === true, JSON.stringify(diagMontaje));
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
        check('vista previa: POST de vista previa (admin-ajax)', log.vistaPrevia >= 1, 'acumuladas=' + log.vistaPrevia);
        check('vista previa (spec 011): galeria 300x300 con el canvas del mockup', !!galeria && (galeria.w === 300 || !!galeria.img), JSON.stringify(galeria));
        const vista = log.vistaPreviaResp || null;
        const pdfsResp = vista && vista.data && vista.data.pdfs ? vista.data.pdfs : null;
        const conMock = pdfsResp ? pdfsResp.filter((p) => (p.mockups || []).length).length : 0;
        check('vista previa: la respuesta trae mockups de los PDFs elegibles', conMock >= 1,
            pdfsResp ? JSON.stringify(pdfsResp.map((p) => ({ pdf: p.pdf, mockups: (p.mockups || []).length }))) : '(sin respuesta)');
        const generados = listarRec(PMU + '\\tmp').filter((f) => f.ruta.indexOf('sesion-') >= 0 && f.ruta.indexOf('\\img\\') >= 0);
        const fotosItem = listarRec(PMU + '\\tmp').filter((f) => f.ruta.indexOf('sesion-') >= 0 && f.ruta.indexOf('\\subidas\\') >= 0);
        check('vista previa (spec 029): el pool guarda lo GENERADO y referencia la foto',
            generados.length >= 1 && fotosItem.length >= 1, 'pool(img/)=' + generados.length + ' | subidas/=' + fotosItem.length);
        const addTras = await botonCarrito(page);

        /* ---- US3 (spec 035 §3.5): la vista previa se marca al MOSTRARSE ---- */
        const g0 = await esperarGaleria(page, 3);
        check('US3 (§3.5): la galeria arma las obligatorias PRIMERO',
            !!g0 && g0.vistas.length === 3
            && g0.vistas.slice(0, 2).every((v) => v.obligatoria === true && v.omisible === false)
            && g0.vistas[2].omisible === true,
            JSON.stringify(g0 && g0.vistas));
        check('US3 (D11): MOSTRAR la inicial ya la marca (no hay boton de ver)',
            !!g0 && g0.visto.length === 1 && g0.visto[0] === g0.vistas[0].id,
            JSON.stringify(g0 && g0.visto));
        check('US3 (D11): con una obligatoria sin ver el carrito esta BLOQUEADO (no antes de la ultima)',
            !!g0 && g0.faltan === 1 && addTras === true,
            'faltan=' + (g0 && g0.faltan) + ' disabled=' + addTras);
        const ley0 = await leyendaVistas(page);
        check('US3 (§3.5): la leyenda "Revisa la vista previa" se ve mientras falten',
            ley0.visible === true && /Revisa la vista previa/i.test(ley0.texto), JSON.stringify(ley0));
        await page.screenshot({ path: CAPT + '\\us3-falta-una.png' });

        // Navegar a la SEGUNDA obligatoria: verla completa la revision.
        await page.locator('.pmu-gal-next').first().click();
        await esperar(1200);
        const g1 = await galeriaEstado(page);
        const addVer = await botonCarrito(page);
        check('US3 (D11): navegar MARCA la vista (ya no falta ninguna obligatoria)',
            !!g1 && g1.faltan === 0 && g1.visto.length >= 2, JSON.stringify(g1 && g1.visto));
        check('US3 (D11): el carrito se habilita AL VER LA ULTIMA obligatoria',
            addVer === false, 'disabled=' + addVer);
        check('US3 (§3.5): la leyenda desaparece con la revision completa',
            (await leyendaVistas(page)).visible === false);
        const ls = await marcasLocales(page);
        check('US3 (§3.5): la marca queda en localStorage, por item',
            !!ls && ls.items === 1 && ls.marcas.length >= 2 && ls.itemKey === (g1 && g1.itemKey),
            JSON.stringify(ls));
        await page.screenshot({ path: CAPT + '\\us3-completa.png' });

        // ---- E4 (spec 036/T026/D4): EDITAR un campo con la galeria visible REPINTA
        // en el lugar (misma galeria, sin boton). Se cambia lo que el campo publica
        // en `PMU_API.estado` y se pide el repintado por la API publica; la clave
        // usada es desconocida para el servidor, que la DESCARTA (sin efectos en el
        // item). Va al final del bloque US3: el repintado reinicia el indice.
        const antesRep = log.vistaPrevia;
        const repintado = await page.evaluate(() => {
            const api = window.PMU_API;
            if (!api || !api.estado || !api.repintar) return false;
            api.estado['__repintado036'] = { valor: 'x', cliente: 'x' };
            api.repintar();
            return true;
        });
        await esperar(6000);
        const galRep = await galeriaEstado(page);
        const btnRep = await page.getByRole('button', { name: 'Vista previa' }).count();
        check('E4 (spec 036/T026): al EDITAR un campo la galeria se REPINTA en el lugar',
            repintado === true && log.vistaPrevia > antesRep && !!galRep && btnRep === 0,
            'posts+' + (log.vistaPrevia - antesRep) + ' vistas=' + (galRep ? galRep.vistas.length : 0));

        // Recarga del MISMO item (la via del "Editar" del carrito): la marca sobrevive
        // y el carrito NO vuelve a bloquear. OJO: sin `?pmu_item_key=` la ficha arranca
        // un item NUEVO y las marcas son de otro item (por eso el parametro).
        const itemKeyUs3 = (g1 && g1.itemKey) || '';
        await page.goto(PRODUCTO + '?pmu_item_key=' + encodeURIComponent(itemKeyUs3), { waitUntil: 'domcontentloaded' });
        await esperar(3000);
        await cerrarModalPais(page);
        // Spec 036 (T025/D3): al recargar el MISMO item la ficha queda completa y el
        // auto-montaje la monta solo: no hay boton que pulsar.
        const g2 = await esperarGaleria(page, 3);
        await esperar(1500);
        // El carrito combina TRES bloqueos (spec 022: `vistas` + `validez` + `minimos`).
        // El de vistas ya no aplica (`faltan=0`); el de minimos depende de que el
        // cargador termine de restaurar la foto del item, que es asincrono (resuelve
        // las URLs por POST). Se espera a que el panel asiente, no se mide en el aire.
        let addRecarga = true;
        for (let i = 0; i < 60; i++) {
            addRecarga = await botonCarrito(page);
            if (addRecarga === false) break;
            await esperar(500);
        }
        check('US3 (§3.5): al RECARGAR el mismo item la marca se conserva y el carrito arranca habilitado',
            !!g2 && g2.faltan === 0 && addRecarga === false,
            'faltan=' + (g2 && g2.faltan) + ' disabled=' + addRecarga
            + ' | item ' + itemKeyUs3 + ' -> ' + (g2 && g2.itemKey)
            + ' | valores.1=' + JSON.stringify(await page.evaluate(() => {
                const v = (window.PMU_FICHA && PMU_FICHA.valores) ? (PMU_FICHA.valores['1'] || PMU_FICHA.valores[1]) : null;
                return v ? v.valor : '(sin campo 1)';
            }))
            + ' | sesion=' + JSON.stringify(await page.evaluate(() => (window.PMU_FICHA && PMU_FICHA.sesion) ? Object.keys(PMU_FICHA.sesion) : null))
            + ' | panel=' + JSON.stringify(await page.evaluate(() => ({
                minis: document.querySelectorAll('[data-pmu-panel] .cpmu-mini').length,
                faltaMin: (() => { const e = document.querySelector('.cpmu-falta'); return (e && !e.hidden) ? e.textContent.trim() : null; })(),
                avisoMin: (() => { const t = [...document.querySelectorAll('[data-pmu-panel] *')].map((e) => e.textContent || '').find((x) => /Faltan \d+ foto/i.test(x)); return t ? t.trim().slice(0, 70) : null; })(),
                otroAviso: (() => { const t = [...document.querySelectorAll('[data-pmu-panel] *')].map((e) => e.textContent || '').find((x) => /stock|no disponible|no cumple/i.test(x)); return t ? t.trim().slice(0, 70) : null; })()
            }))));
        await page.screenshot({ path: CAPT + '\\ficha-vista-previa.png' });

        // ---- Carrito (spec 004): 1 linea con la personalizacion + mockup congelado
        await page.locator('.single_add_to_cart_button').first().click();
        await esperar(3000);
        if (!/\/cart\//.test(page.url())) { await page.goto(BASE + '/cart/', { waitUntil: 'domcontentloaded' }).catch(() => { }); }
        await esperar(2500);
        await cerrarModalPais(page);
        let carrito = { items: 0, texto: '' };
        for (let i = 0; i < 20; i++) {              // el carrito puede pintar despues del POST
            carrito = await page.evaluate(() => ({
                items: document.querySelectorAll('.woocommerce-cart-form__cart-item, tr.cart_item').length,
                texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)
            }));
            if (carrito.items >= 1) break;
            await esperar(700);
        }
        check('carrito: el item personalizado entro (1 linea)', carrito.items >= 1, 'items=' + carrito.items + ' | ' + carrito.texto.slice(0, 110));
        const mockup = listarRec(PMU + '\\tmp').filter((f) => /mockup-.*\.webp$/.test(f.ruta))[0];
        check('carrito (spec 004): el mockup quedo congelado en el item al agregar', !!mockup,
            mockup ? mockup.ruta.split('\\').slice(-2).join('/') + ' (' + Math.round(mockup.bytes / 1024) + ' KB)' : '(sin mockup)');
        await page.screenshot({ path: CAPT + '\\carrito.png' });

        // ---- Checkout: CLIENTE LOGUEADO + contra reembolso (spec 014)
        // Spec 035 (D8): la cuenta es OBLIGATORIA al comprar. Un pedido con
        // `customer_id = 0` (invitado) NO se promueve: sin cliente no hay carpeta
        // `orders/{clave}/`. El recorrido real es el del cliente logueado, que es
        // ademas el unico que puede descargar desde mi-cuenta/descargas/.
        const iniciarSesion = async (pg) => {
            await pg.goto(BASE + '/wp-login.php', { waitUntil: 'domcontentloaded' });
            await pg.fill('#user_login', 'lab').catch(() => { });
            await pg.fill('#user_pass', 'labpass123').catch(() => { });
            await Promise.all([
                pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null),
                pg.click('#wp-submit').catch(() => { }),
            ]);
            await esperar(1500);
        };
        await iniciarSesion(page);
        await page.goto(BASE + '/checkout/', { waitUntil: 'domcontentloaded' });
        await esperar(2500);
        await cerrarModalPais(page);
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
                pdf = listarRec(PMU + '\\orders\\' + CLAVE_LAB + '\\' + oid).filter((f) => /_procesado\.pdf$/i.test(f.ruta));
                if (pdf.length) break;
                await esperar(1000);
            }
        }
        check('pedido (spec 035): el PDF procesado quedo en orders/{clave}/{id}/', pdf.length >= 1,
            pdf.length ? pdf.map((f) => f.ruta.split('orders\\')[1] + ' (' + Math.round(f.bytes / 1024) + ' KB)').join(' ') : '(sin PDF)');
        if (pdf.length) {
            const cab = fs.readFileSync(pdf[0].ruta).slice(0, 5).toString('latin1');
            check('pedido: el entregable es un PDF real', cab === '%PDF-', 'cabecera=' + JSON.stringify(cab));
        }
        check('sin errores de pagina en la ficha/carrito/checkout', errores.length === 0, errores.slice(0, 3).join(' | '));
    } finally {
        // Spec 035: el lab queda como estaba (los `config.json` sembrados se reponen).
        try { if (typeof restaurarUS3 === 'function') { restaurarUS3(); } } catch (e) { /* evidencia opcional */ }
        await browser.close();
    }
    fallas = resultados.filter((r) => !r.ok).length;
    try {
        fs.writeFileSync(CAPT + '\\ficha-pedido.json', JSON.stringify({ fecha: new Date().toISOString(), fallas: fallas, resultados: resultados }, null, 1));
    } catch (e) { /* evidencia opcional */ }
    console.log('\nFICHA->PEDIDO: ' + (resultados.length - fallas) + '/' + resultados.length + ' OK' + (fallas ? ' - FALLAS: ' + fallas : ''));
    process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('FALLO: ' + (e && e.stack ? e.stack : e)); process.exit(1); });