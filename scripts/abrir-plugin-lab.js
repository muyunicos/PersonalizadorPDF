#!/usr/bin/env node
/*
 * Abre el plugin Personalizador PDF en el laboratorio local (localhost:8091)
 * con la sesion YA iniciada.
 *
 * Usa Playwright (el del proyecto, en %TEMP%\pmu-pw) con un perfil persistente:
 * la 1a vez hace login (lab/labpass123) y guarda la cookie; las veces siguientes
 * entra directo, sin tipear nada.
 *
 * Uso:
 *   node scripts/abrir-plugin-lab.js              -> abre Chrome y te deja en el plugin
 *   node scripts/abrir-plugin-lab.js --check      -> verifica el login (headless) y sale
 *   node scripts/abrir-plugin-lab.js --url <URL>  -> abre otra URL del lab
 *
 * Variables de entorno opcionales:
 *   PMU_LAB_BASE (default http://localhost:8091), PMU_LAB_USER (lab),
 *   PMU_LAB_PASS (labpass123), TEXTMUY_CHROME (ruta de Chrome).
 */
'use strict';

var path = require('path');
var fs = require('fs');

var BASE = (process.env.PMU_LAB_BASE || 'http://localhost:8091').replace(/\/+$/, '');
var URL_PLUGIN = BASE + '/wp-admin/admin.php?page=personalizador-pdf&tab=pdfs';
var LOGIN_URL = BASE + '/wp-login.php';
var USER = process.env.PMU_LAB_USER || 'lab';
var PASS = process.env.PMU_LAB_PASS || 'labpass123';
var CHROME = process.env.TEXTMUY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function argUrl() {
    var i = process.argv.indexOf('--url');
    return (i >= 0 && process.argv[i + 1]) ? process.argv[i + 1] : URL_PLUGIN;
}

function cargarPlaywright() {
    // 1) Resolucion normal (si el consumidor setea NODE_PATH); 2) ruta absoluta en %TEMP%.
    try { return require('playwright'); } catch (e) { /* sigue */ }
    var raiz = path.join(process.env.TEMP || process.env.TMP || '.', 'pmu-pw', 'node_modules', 'playwright');
    if (fs.existsSync(raiz)) { return require(raiz); }
    throw new Error('No se encontro Playwright. Instalalo con: npm i --prefix "%TEMP%\\pmu-pw" playwright');
}

function perfil() {
    return path.join(process.env.TEMP || process.env.TMP || '.', 'pmu-lab-perfil');
}

async function estaLogueado(page) {
    if (page.url().indexOf('wp-login.php') !== -1) { return false; }
    var form = await page.$('input[name="log"], #loginform');
    return !form;
}

async function loginSiHaceFalta(page) {
    if (await estaLogueado(page)) { return true; }
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="log"]', USER);
    await page.fill('input[name="pwd"]', PASS);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(function () {}),
        page.click('input[type="submit"], #wp-submit')
    ]);
    return await estaLogueado(page);
}

(async function () {
    var check = process.argv.indexOf('--check') >= 0;
    var destino = argUrl();
    var chromium = cargarPlaywright().chromium;

    var ctx = await chromium.launchPersistentContext(perfil(), {
        headless: check,
        executablePath: CHROME,
        viewport: null,
        args: ['--start-maximized']
    });

    var page = ctx.pages()[0] || await ctx.newPage();
    try {
        await page.goto(destino, { waitUntil: 'domcontentloaded' });
        var ok = await loginSiHaceFalta(page);
        if (!ok) {
            throw new Error('No se pudo iniciar sesion en el lab (revisa PMU_LAB_USER / PMU_LAB_PASS).');
        }
        await page.goto(destino, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(function () {});

        if (check) {
            console.log('LOGIN OK -> ' + page.url());
            await ctx.close();
            process.exit(0);
        }

        console.log('Plugin abierto con sesion iniciada: ' + page.url());
        // Mantiene la ventana abierta hasta que el usuario la cierre.
        await new Promise(function (resolve) {
            ctx.on('close', resolve);
            page.on('close', resolve);
        });
        await ctx.close().catch(function () {});
        process.exit(0);
    } catch (err) {
        console.error('ERROR: ' + ((err && err.message) ? err.message : err));
        await ctx.close().catch(function () {});
        process.exit(1);
    }
})();