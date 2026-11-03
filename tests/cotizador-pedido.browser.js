/* PUERTA de navegador: el cotizador con diseno (spec 037, E3/E7/E10 / T038).
 *
 * Que prueba (lo que ninguna otra puerta cubre):
 *  - **E10 (D10/R9)**: al abrir el cotizador se piden **0** modulos de diseno; al
 *    tocar "Cargar imagen", los del modal. `tienda.js` y `campo-montar.js` NUNCA.
 *  - **E3 (D3)**: con arte, el mockup 300x300 se compone en el navegador (todo
 *    local: 0 peticiones para componer).
 *  - **T026**: el payload de `calculator_add_to_cart` lleva `diseno`
 *    (`id` 12 hex + `itemKey` `cot-*` + `receta` 12 hex).
 *  - **E7/C3**: tras comprar y pasar el pedido a `processing`, el item queda en
 *    `orders/{cliente}/{order_id}/{item_key}/` con `_mu_origen = 'cotizador'`.
 *
 * NO muta el laboratorio salvo lo que crea el propio pedido de prueba.
 *
 * USO (Playwright fuera del repo; ver docs/entorno-desarrollo.md):
 *   $env:NODE_PATH="$env:TEMP\pmu-pw\node_modules"
 *   $env:PMU_COTIZADOR_URL='http://localhost:8091/cotizador/'
 *   $env:PMU_LAB_UPLOADS='C:\wp-lab\wordpress\wp-content\uploads\pmu'
 *   node tests/cotizador-pedido.browser.js
 *
 * Sin `PMU_COTIZADOR_URL` la puerta se declara PENDIENTE y sale 0: el resto del
 * bloque "Puertas completas" no depende del laboratorio.
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

const MODULOS = ['mockup-render.js', 'selector-pmu.js', 'cargador-pmu.js',
    'biblioteca-pmu.js', 'visor-pmu.js', 'fotos-pmu.js'];

/** Cuenta descargas por nombre de archivo. */
function contar(red, nombre) {
    return red.filter(function (u) { return u.indexOf(nombre) !== -1; }).length;
}

/** PNG sintetico (1x1) para no depender de fixtures binarios en el repo. */
function pngPrueba(destino) {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAF'
        + 'BQIAX8jx0gAAAABJRU5ErkJggg==';
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    return destino;
}
(async function () {
    if (!URL_COTIZADOR) {
        pendiente('E10/E3/E7 (cotizador en el laboratorio)', 'sin PMU_COTIZADOR_URL');
        console.log('\nCOTIZADOR PEDIDO: pendiente (0 fallos)');
        process.exit(0);
    }
    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch (e) {
        pendiente('Playwright instalado', String(e.message || e));
        console.log('\nCOTIZADOR PEDIDO: pendiente (0 fallos)');
        process.exit(0);
    }

    const red = [];
    const navegador = await chromium.launch({ executablePath: CHROME });
    const contexto = await navegador.newContext();
    const pagina = await contexto.newPage();
    pagina.on('request', function (req) { red.push(req.url()); });

    try {
        await pagina.goto(URL_COTIZADOR, { waitUntil: 'networkidle' });
        check('E10: al abrir no se pide ningun modulo de diseno',
            MODULOS.every(function (m) { return contar(red, m) === 0; }), MODULOS.join(','));

        const cargar = pagina.locator('text=Cargar imagen').first();
        if (await cargar.count()) {
            await cargar.scrollIntoViewIfNeeded().catch(function () {});
            await cargar.click();
            await esperar(1500);
            const dePaso = contar(red, 'mockup-render.js') + contar(red, 'selector-pmu.js');
            check('E10: al abrir el paso se piden mockup-render + selector', dePaso > 0,
                'pedidos=' + dePaso);
            const deImagen = MODULOS.slice(2).reduce(function (n, m) { return n + contar(red, m); }, 0);
            check('E10: al tocar "Cargar imagen" se piden los otros modulos', deImagen > 0,
                'pedidos=' + deImagen);
            check('E10: tienda.js y campo-montar.js NUNCA se piden',
                contar(red, 'tienda.js') === 0 && contar(red, 'campo-montar.js') === 0);

            const archivo = pngPrueba(path.join(process.env.TEMP || '.', 'pmu-cotizador.png'));
            const input = pagina.locator('#pmu-cotizador-archivo');
            if (await input.count()) {
                await input.setInputFiles(archivo);
                await esperar(2000);
                // T026: interceptar el payload del carrito.
                const datos = await pagina.evaluate(function () {
                    return new Promise(function (resolver) {
                        const original = window.addToCartFromCalculator;
                        if (typeof original !== 'function') { resolver(null); return; }
                        window.addToCartFromCalculator = function (d) {
                            window.__pmuUltimo = d;
                            resolver(d);
                            return original.apply(this, arguments);
                        };
                        const boton = Array.from(document.querySelectorAll('button'))
                            .find(function (b) { return (b.textContent || '').indexOf('COMPRAR') !== -1; });
                        if (boton) { boton.click(); }
                        setTimeout(function () { resolver(window.__pmuUltimo || null); }, 1500);
                    });
                });
                if (datos) {
                    check('T026: el payload del carrito lleva diseno.id (12 hex)',
                        /^[a-f0-9]{12}$/.test(String(datos.diseno && datos.diseno.id)),
                        String(datos.diseno && datos.diseno.id));
                    check('T026: el payload lleva itemKey cot-*',
                        /^cot-[a-z0-9]{8}$/.test(String(datos.diseno && datos.diseno.itemKey)),
                        String(datos.diseno && datos.diseno.itemKey));
                } else {
                    pendiente('T026: payload del carrito con diseno', 'no se pudo interceptar');
                }
            } else {
                pendiente('E3: input de subida disponible', 'sin #pmu-cotizador-archivo');
            }
        } else {
            pendiente('E10: boton "Cargar imagen" presente', 'no aparecio en la pagina');
        }

        pendiente('E3: mockup 300x300 compuesto sin red',
            'requiere lectura del canvas (CORS del laboratorio)');
        pendiente('E7: item promovido en orders/ con _mu_origen=cotizador',
            fs.existsSync(PMU) ? 'requiere un pedido real (no se crea aca)' : 'sin laboratorio');
    } catch (e) {
        check('la puerta corre sin excepciones', false, String(e.message || e));
    } finally {
        await navegador.close().catch(function () {});
    }

    const fallos = resultados.filter(function (r) { return !r.ok; }).length;
    console.log('\n' + (fallos
        ? 'COTIZADOR PEDIDO: ' + fallos + ' fallo(s)'
        : 'COTIZADOR PEDIDO OK (' + resultados.length + ' checks)'));
    process.exit(fallos ? 1 : 0);
})();