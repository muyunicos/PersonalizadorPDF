'use strict';
/**
 * tests/cola-subida.test.js - Cola de subida del comprador (spec 036, D9):
 * concurrencia acotada, orden FIFO, dedupe por contenido y "ultima version
 * manda" (re-subir un texto del mismo grupo/instancia reemplaza el anterior).
 *
 *   node tests/cola-subida.test.js   -> debe decir "COLA SUBIDA OK (N checks)"
 *
 * Esqueleto (T003): los checks llegan con la fase US3 de la spec 036.
 * Node corre SOLO en desarrollo (nunca en el servidor productivo).
 */

let fallos = 0;
let checks = 0;
function check(nombre, cond, dato) {
    const extra = (dato === undefined || dato === '') ? '' : '  [' + dato + ']';
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre + extra);
    checks++;
    if (!cond) { fallos++; }
}

// ---------------------------------------------------------------------------
// Cola de subida (spec 036, T019/T020/D9)
// ---------------------------------------------------------------------------
const PMUFotos = require('../assets/fotos-pmu.js');

function demora(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/**
 * Cola instrumentada: mide el pico de concurrencia, el orden real de arranque y
 * de fin, y a que tarea corresponde cada resultado.
 */
function nuevaCola(extra) {
    const log = { inicia: [], termina: [], intentos: 0 };
    let enVuelo = 0;
    let pico = 0;
    const base = {
        max: 2,
        reintentos: [],
        esperar: function () { return Promise.resolve(); },
        subir: function (t) {
            log.intentos++;
            log.inicia.push(t.nombre);
            enVuelo++;
            pico = Math.max(pico, enVuelo);
            return demora(t.ms || 2).then(function () {
                enVuelo--;
                log.termina.push(t.nombre);
                return t.nombre;
            });
        }
    };
    const cfg = Object.assign(base, extra || {});
    return { cola: PMUFotos.crearCola(cfg), log: log, pico: function () { return pico; } };
}

(async function () {
    // A) Concurrencia ACOTADA (nunca N simultaneas) y nada se pierde.
    const A = nuevaCola({ max: 2 });
    const tareasA = ['a', 'b', 'c', 'd', 'e'].map(function (n) {
        return { nombre: n, ms: 4 };
    });
    await Promise.all(tareasA.map(function (t) { return A.cola.encolar(t); }));
    check('concurrencia acotada: el pico nunca supera `max` (2)', A.pico() <= 2, 'pico=' + A.pico());
    check('las 5 subidas se hacen todas', A.log.intentos === 5, A.log.intentos + ' intentos');
    check('la cola queda vacia al terminar', A.cola.pendientes() === 0);

    // B) Orden FIFO con una sola en vuelo.
    const B = nuevaCola({ max: 1 });
    await Promise.all(['a', 'b', 'c'].map(function (n) {
        return B.cola.encolar({ nombre: n, ms: 2 });
    }));
    check('orden FIFO: terminan en el orden en que se encolaron',
        B.log.termina.join(',') === 'a,b,c', B.log.termina.join(','));

    // C) Dedupe por CONTENIDO (sha/hash): el mismo contenido sube UNA vez.
    const C = nuevaCola({});
    const c1 = C.cola.encolar({ nombre: 'x', ms: 3 }, '', { dedupe: 'sha-abc' });
    const c2 = C.cola.encolar({ nombre: 'y', ms: 3 }, '', { dedupe: 'sha-abc' });
    const rC = await Promise.all([c1, c2]);
    check('dedupe por contenido: sube una sola vez', C.log.intentos === 1, C.log.intentos + ' intentos');
    check('...y los dos llamadores reciben el mismo resultado', rC[0] === rC[1] && rC[0] === 'x');

    // D) Dedupe por SLOT (misma clave sin reemplazar): 0 bytes.
    const D = nuevaCola({});
    const d1 = D.cola.encolar({ nombre: 'a', ms: 3 }, 'pdf|0000FF|0');
    const d2 = D.cola.encolar({ nombre: 'b', ms: 3 }, 'pdf|0000FF|0');
    await Promise.all([d1, d2]);
    check('mismo slot sin reemplazar: NO se reenvia', D.log.intentos === 1 && d1 === d2);

    // E) ULTIMA VERSION MANDA (T020): la anterior reemplazada no gasta red.
    const E = nuevaCola({ max: 2 });
    const e1 = E.cola.encolar({ nombre: 'v1', ms: 6 }, 'slot', { reemplazar: true });
    const e2 = E.cola.encolar({ nombre: 'v2', ms: 6 }, 'slot', { reemplazar: true });
    const e3 = E.cola.encolar({ nombre: 'v3', ms: 6 }, 'slot', { reemplazar: true });
    const rE = await Promise.all([e1, e2, e3]);
    check('la que ya estaba en vuelo termina con su resultado', rE[0] === 'v1', rE[0]);
    check('la version intermedia se DESCARTA sin gastar red (resuelve false)', rE[1] === false);
    check('la ULTIMA version es la que sube', rE[2] === 'v3' && E.log.intentos === 2,
        'intentos=' + E.log.intentos + ' inicia=' + E.log.inicia.join(','));
    check('serializadas por clave: la ultima arranca despues de la primera',
        E.log.inicia.join(',') === 'v1,v3', E.log.inicia.join(','));

    // F) Claves DISTINTAS si corren en paralelo (la serializacion es por clave).
    const F = nuevaCola({ max: 2 });
    await Promise.all([
        F.cola.encolar({ nombre: 'g1', ms: 5 }, 'slot-1'),
        F.cola.encolar({ nombre: 'g2', ms: 5 }, 'slot-2')
    ]);
    check('claves distintas corren en paralelo (pico 2)', F.pico() === 2, 'pico=' + F.pico());

    // G) Reintentos con backoff (el `esperar` se inyecta: no se duerme de verdad).
    const esperas = [];
    let intentosRed = 0;
    const G = PMUFotos.crearCola({
        max: 1,
        reintentos: [10, 20],
        esperar: function (ms) { esperas.push(ms); return Promise.resolve(); },
        subir: function () {
            intentosRed++;
            return intentosRed < 3 ? Promise.reject(new Error('red')) : Promise.resolve('ok');
        }
    });
    const rG = await G.encolar({});
    check('reintenta y termina OK', rG === 'ok' && intentosRed === 3, 'intentos=' + intentosRed);
    check('usa los backoffs declarados', esperas.join(',') === '10,20', esperas.join(','));

    // H) `pendientes()` cuenta en vuelo + en cola y `vaciar()` espera a todo.
    const H = nuevaCola({ max: 1 });
    const h1 = H.cola.encolar({ nombre: 'a', ms: 5 });
    const h2 = H.cola.encolar({ nombre: 'b', ms: 5 });
    check('pendientes() cuenta en vuelo + en cola', H.cola.pendientes() === 2, H.cola.pendientes());
    await Promise.all([h1, h2, H.cola.vaciar()]);
    check('vaciar() resuelve cuando no queda nada', H.cola.pendientes() === 0);

    // I) Tras descartar una version, el mismo CONTENIDO se puede volver a subir.
    const I = nuevaCola({ max: 1 });
    const i1 = I.cola.encolar({ nombre: 'v1', ms: 8 }, 'slot-i', { reemplazar: true, dedupe: 'f-1' });
    const i2 = I.cola.encolar({ nombre: 'v2', ms: 2 }, 'slot-i', { reemplazar: true, dedupe: 'f-2' });
    await Promise.all([i1, i2]);
    const i3 = I.cola.encolar({ nombre: 'v3', ms: 2 }, 'slot-i', { reemplazar: true, dedupe: 'f-2' });
    check('contenido ya subido: 0 bytes (reusa la promesa)', i3 === i2);
    await i3;

// ---------------------------------------------------------------------------
// == 0: predicado unico "completo" (spec 036, T006/R9) ==
// ---------------------------------------------------------------------------
const PURO = require('../assets/tienda.js');
const tiendaSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'tienda.js'), 'utf8');
check('sin estado = completo (nada que esperar)', PURO.estaCompleto() === true);
check('un hueco sin completar NO esta completo', PURO.estaCompleto({ faltanFotos: 1 }) === false);
check('una subida en vuelo NO esta completo', PURO.estaCompleto({ subidas: 2 }) === false);
check('validez que rechaza NO esta completo', PURO.estaCompleto({ validez: false }) === false);
check('todo subido + sin faltantes + validez OK = completo',
    PURO.estaCompleto({ faltanFotos: 0, subidas: 0, validez: true }) === true);

// ---------------------------------------------------------------------------
// == Spec 039 (H5): la cola dice QUE queda en vuelo, no solo cuantas ==
// ---------------------------------------------------------------------------
check('039 H5: el aviso de cola distingue 1 pendiente (singular)',
    /pendiente' \+ \(n === 1 \? '' : 's'\)/.test(tiendaSrc)
    && /Estamos recibiendo tus archivos \(' \+ n \+ ' pendiente/.test(tiendaSrc));
check('039 H5: `api.subidas` expone detalle() con {total, campos}',
    /detalle: function \(\) \{/.test(tiendaSrc)
    && /return \{ total: total, campos: porCampo \}/.test(tiendaSrc));
check('039 H5: refrescarMinimos avisa de la cola cuando no faltan fotos (spec 046: solo con avisos activos)',
    /var mostrar = avisosActivos && \(faltan > 0 \|\| bloqueos\.subidas\)/.test(tiendaSrc)
    && /\} else if \(mostrar\) \{/.test(tiendaSrc));
check('039 H5: la cola no cuenta dos veces (usa pendientes(), no lista a ciegas)',
    /parseInt\(c\.pendientes\(\), 10\) \|\| 0/.test(tiendaSrc));

// ===========================================================================
// == #3 (fix 2026-11-24): la subida no se cuelga (timeout del POST) ==
//    Sin timeout, una red colgada dejaba el fetch sin resolver -> la cola no
//    vaciaba -> bloqueos.subidas = true (boton comprar trabado) sin aviso.
// ===========================================================================
    const pcl = PURO.peticionConLimite;
    check('#3: existe el helper PURO.peticionConLimite', typeof pcl === 'function');

    // a) resuelve el valor si la promesa llega a tiempo
    let r3a = await pcl(Promise.resolve('ok'), 5000, null, 'x').then(function (v) { return v; }, function (e) { return 'ERR:' + e.message; });
    check('#3: resuelve el valor si llega antes del timeout', r3a === 'ok', r3a);

    // b) no espera al timeout cuando la promesa ya resolvio
    let t3 = Date.now();
    await pcl(Promise.resolve(1), 100000, null, 'x');
    check('#3: no espera el timeout si la promesa resolvio', (Date.now() - t3) < 500);

    // c) una promesa colgada rechaza por timeout y aborta la peticion
    let abort3 = false;
    let r3c = await pcl(new Promise(function () { /* nunca resuelve */ }), 20, function () { abort3 = true; }, 'timeout de prueba')
        .then(function () { return 'NO-RECHAZO'; }, function (e) { return e.message; });
    check('#3: una promesa colgada rechaza por timeout', r3c === 'timeout de prueba', r3c);
    check('#3: al vencer el timeout se aborta la peticion', abort3 === true);

    // d) deja pasar el rechazo real y NO aborta
    let abort3b = false;
    const orig3 = new Error('fallo real');
    let r3d = await pcl(Promise.reject(orig3), 5000, function () { abort3b = true; }, 'x')
        .then(function () { return 'NO-RECHAZO'; }, function (e) { return e; });
    check('#3: deja pasar el rechazo real (mismo error)', r3d === orig3);
    check('#3: no aborta si la promesa rechazo antes del timeout', abort3b === false);

    // e) la respuesta tardia no pisa el timeout (no resuelve dos veces)
    let r3e = await pcl(new Promise(function (resolve) { setTimeout(function () { resolve('tarde'); }, 80); }), 20)
        .then(function () { return 'NO-RECHAZO'; }, function (e) { return 'timeout:' + e.message; });
    check('#3: la respuesta tardia no pisa el timeout', /^timeout:/.test(r3e), r3e);

    // f) wiring: postAjax usa AbortController + signal + peticionConLimite
    check('#3: postAjax arma un AbortController y lo pasa a fetch (signal)',
        /AbortController/.test(tiendaSrc) && /opciones\.signal = ctrl\.signal/.test(tiendaSrc));
    check('#3: postAjax envuelve el fetch con PURO.peticionConLimite',
        /PURO\.peticionConLimite\(peticion/.test(tiendaSrc));

    console.log('\nCOLA SUBIDA OK (' + checks + ' checks)');
    if (fallos) { process.exit(1); }
})();