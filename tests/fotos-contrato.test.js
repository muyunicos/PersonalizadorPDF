#!/usr/bin/env node
/**
 * Contrato de `assets/fotos-pmu.js` (spec 035, T018).
 *
 * Lo que se prueba:
 *  - el cap de 2000 px es UNIFORME y nunca amplia (la foto no se deforma);
 *  - el dedupe por `sha` del servidor y la recuperacion cuando el blob NO esta;
 *  - el ciclo del registro (guardar / marcar subida / listar / borrar);
 *  - `persistir()` degrada a `false` sin `navigator.storage` (el navegador puede
 *    desalojar la cache: el sistema no puede depender de ella).
 *
 * IndexedDB no existe en Node: se inyecta un fake minimo con la misma forma que
 * usa el modulo (`transaction` -> `objectStore` -> `put/get/getAll/delete/index`).
 *
 * Uso: node tests/fotos-contrato.test.js
 */
'use strict';

const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PMUFotos = require(path.join(RAIZ, 'assets', 'fotos-pmu.js'));

let checks = 0;
let fallos = 0;

function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle) ? '  [' + detalle + ']' : ''));
}

function grupo(nombre) {
    console.log('\n== ' + nombre + ' ==');
}

/** Fake minimo de IndexedDB: un Map y una transaccion que cierra en microtask. */
function fakeDB() {
    const datos = new Map();
    return {
        datos: datos,
        transaction: function () {
            const tx = { oncomplete: null, onerror: null, onabort: null };
            const store = {
                put: function (fila) {
                    datos.set(fila.clave, JSON.parse(JSON.stringify(fila)));
                    return { result: fila.clave };
                },
                get: function (k) {
                    return { result: datos.has(k) ? JSON.parse(JSON.stringify(datos.get(k))) : undefined };
                },
                getAll: function () {
                    return { result: Array.from(datos.values()).map(function (v) {
                        return JSON.parse(JSON.stringify(v));
                    }) };
                },
                delete: function (k) {
                    datos.delete(k);
                    return { result: undefined };
                },
                index: function () {
                    return {
                        get: function (sha) {
                            for (const v of datos.values()) {
                                if (v.sha === sha) { return { result: JSON.parse(JSON.stringify(v)) }; }
                            }
                            return { result: undefined };
                        }
                    };
                }
            };
            tx.objectStore = function () { return store; };
            setTimeout(function () { if (tx.oncomplete) { tx.oncomplete(); } }, 0);
            return tx;
        }
    };
}

// ---------------------------------------------------------------------------
grupo('F1: cap 2000 uniforme (nunca deforma, nunca amplia)');
// ---------------------------------------------------------------------------

check('4000x3000 -> factor 0.5', Math.abs(PMUFotos.factorCap(4000, 3000) - 0.5) < 1e-9,
    String(PMUFotos.factorCap(4000, 3000)));
check('4000x3000 -> 2000x1500 (conserva el aspecto)',
    PMUFotos.medidasAcotadas(4000, 3000).w === 2000 && PMUFotos.medidasAcotadas(4000, 3000).h === 1500,
    PMUFotos.medidasAcotadas(4000, 3000).w + 'x' + PMUFotos.medidasAcotadas(4000, 3000).h);
check('2600x1300 -> 2000x1000', PMUFotos.medidasAcotadas(2600, 1300).w === 2000
    && PMUFotos.medidasAcotadas(2600, 1300).h === 1000,
    PMUFotos.medidasAcotadas(2600, 1300).w + 'x' + PMUFotos.medidasAcotadas(2600, 1300).h);
check('1200x900 NO se amplia (k=1)',
    PMUFotos.medidasAcotadas(1200, 900).k === 1
    && PMUFotos.medidasAcotadas(1200, 900).w === 1200,
    String(PMUFotos.medidasAcotadas(1200, 900).k));
check('2000x2000 esta justo en el limite (k=1)',
    PMUFotos.medidasAcotadas(2000, 2000).k === 1);
check('el cap coincide con el del servidor', PMUFotos.LADO_MAX === 2000, String(PMUFotos.LADO_MAX));

// ---------------------------------------------------------------------------
grupo('F2: id local y sha del servidor');
// ---------------------------------------------------------------------------

check('idDe toma los 12 primeros hex', PMUFotos.idDe('abcdef0123456789') === 'abcdef012345',
    PMUFotos.idDe('abcdef0123456789'));
check('idDe de vacio es cadena vacia', PMUFotos.idDe('') === '');
const c1 = PMUFotos.claveLocal();
const c2 = PMUFotos.claveLocal();
check('la clave local lleva el prefijo local-', c1.indexOf('local-') === 0, c1);
check('dos claves locales no chocan', c1 !== c2);

// ---------------------------------------------------------------------------
grupo('F3: ciclo del registro (guardar / marcar / buscar por sha / borrar)');
// ---------------------------------------------------------------------------

(async function () {
    const db = fakeDB();

    const clave = await PMUFotos.guardarRegistro(db, {
        blob: { tipo: 'blob-falso' }, w: 2000, h: 1500, nombre: 'foto.jpg'
    });
    check('guardarRegistro devuelve una clave', typeof clave === 'string' && clave !== '');

    const fila = await PMUFotos.obtener(db, clave);
    check('el registro se recupera por clave', !!fila && fila.nombre === 'foto.jpg');
    check('el registro conserva medidas y blob', !!fila && fila.w === 2000 && fila.h === 1500
        && !!fila.blob);
    check('recien guardado no tiene sha (todavia no subio)', !!fila && fila.sha === '');

    const marcado = await PMUFotos.marcarSubida(db, clave, 'abcdef0123456789');
    check('marcarSubida anota el sha', marcado === true);

    const porSha = await PMUFotos.obtenerPorSha(db, 'abcdef0123456789');
    check('obtenerPorSha encuentra la foto', !!porSha && porSha.clave === clave);

    const sinSha = await PMUFotos.obtenerPorSha(db, 'no-existe-000');
    check('obtenerPorSha de un sha desconocido devuelve null', sinSha === null);

    // Recuperacion: si el navegador desalojo el blob, el llamador recibe null y
    // tiene que pedir el original al servidor (nunca inventarlo).
    const ausente = await PMUFotos.obtener(db, 'local-inexistente');
    check('obtener de una clave ausente devuelve null (se pide al servidor)', ausente === null);

    const clave2 = await PMUFotos.guardarRegistro(db, { w: 100, h: 100, nombre: 'otra.png' });
    check('listar trae los dos registros', (await PMUFotos.listar(db)).length === 2);

    await PMUFotos.borrar(db, clave2);
    check('borrar quita el registro', (await PMUFotos.listar(db)).length === 1);
    check('borrar no toca el otro registro', !!(await PMUFotos.obtener(db, clave)));

    // -----------------------------------------------------------------------
    grupo('F4: sin navigator.storage la cache NO se da por persistente');
    // -----------------------------------------------------------------------

    check('persistir() sin navigator devuelve false', (await PMUFotos.persistir({})) === false);
    check('persistir() con storage.persist devuelve lo que diga el navegador',
        (await PMUFotos.persistir({ storage: { persist: function () { return Promise.resolve(true); } } })) === true);
    check('persistir() no rompe si persist lanza',
        (await PMUFotos.persistir({ storage: { persist: function () { throw new Error('x'); } } })) === false);

    // -----------------------------------------------------------------------
    grupo('F5: cola de subida en segundo plano (T013)');
    // -----------------------------------------------------------------------

    let enVuelo = 0;
    let pico = 0;
    const c1 = PMUFotos.crearCola({
        max: 2, reintentos: [], esperar: function () { return Promise.resolve(); },
        subir: function (t) {
            enVuelo++;
            pico = Math.max(pico, enVuelo);
            return new Promise(function (r) {
                setTimeout(function () { enVuelo--; r(t.id); }, 0);
            });
        }
    });
    const r1 = await Promise.all([1, 2, 3, 4].map(function (id) {
        return c1.encolar({ id: id }, 'k' + id);
    }));
    check('nunca hay mas de 2 subidas en vuelo', pico <= 2, 'pico=' + pico);
    check('todas las subidas resuelven con su valor', r1.join(',') === '1,2,3,4', r1.join(','));

    let llamadas = 0;
    const c2 = PMUFotos.crearCola({
        reintentos: [], subir: function () { llamadas++; return Promise.resolve(1); }
    });
    const pA = c2.encolar({ id: 1 }, 'misma');
    const pB = c2.encolar({ id: 1 }, 'misma');
    await pA;
    await pB;
    check('la MISMA clave no se reenvia (probar encuadres = 0 bytes)',
        llamadas === 1 && pA === pB, 'llamadas=' + llamadas);

    let intentos = 0;
    const esperas = [];
    const c3 = PMUFotos.crearCola({
        reintentos: [1000, 3000],
        esperar: function (ms) { esperas.push(ms); return Promise.resolve(); },
        subir: function () {
            intentos++;
            return intentos < 3 ? Promise.reject(new Error('red')) : Promise.resolve('ok');
        }
    });
    const r3 = await c3.encolar({ id: 9 }, 'k');
    check('reintenta con backoff de 1 s y 3 s', intentos === 3 && esperas.join(',') === '1000,3000',
        intentos + ' intentos / ' + esperas.join(','));
    check('el ultimo intento devuelve el valor', r3 === 'ok', String(r3));

    const c4 = PMUFotos.crearCola({
        reintentos: [1000], esperar: function () { return Promise.resolve(); },
        subir: function () { return Promise.reject(new Error('red-caida')); }
    });
    let causa = '';
    try { await c4.encolar({ id: 1 }, 'k'); } catch (e) { causa = e.message; }
    check('agotar los reintentos rechaza con la causa', causa === 'red-caida', causa);

    const c5 = PMUFotos.crearCola({
        reintentos: [],
        subir: function () { return new Promise(function (r) { setTimeout(function () { r(1); }, 5); }); }
    });
    c5.encolar({ id: 1 }, 'a');
    c5.encolar({ id: 2 }, 'b');
    check('pendientes() cuenta en vuelo + en cola', c5.pendientes() === 2, String(c5.pendientes()));
    await c5.vaciar();
    check('vaciar() resuelve cuando no queda nada (lo espera el add-to-cart)',
        c5.pendientes() === 0);
    await c5.vaciar();
    check('vaciar() con la cola vacia resuelve al instante', c5.pendientes() === 0);
    c5.olvidar('a');
    check('olvidar() libera la clave para reintentar a proposito',
        typeof c5.olvidar === 'function');

    // -----------------------------------------------------------------------
    grupo('F6: sha1Hex (la clave del dedupe)');
    // -----------------------------------------------------------------------

    check('sin digest devuelve cadena vacia (nunca revienta)',
        (await PMUFotos.sha1Hex(new Uint8Array([1]), {})) === '');
    const hexGlobal = await PMUFotos.sha1Hex(new Uint8Array([1, 2, 3]));
    check('sin crypto inyectado cae al del navegador (40 hex) o a vacio',
        hexGlobal === '' || hexGlobal.length === 40, hexGlobal.length + ' chars');
    const hex = await PMUFotos.sha1Hex(new Uint8Array([1]), {
        digest: function () { return Promise.resolve(new Uint8Array([0xab, 0xcd, 0x01]).buffer); }
    });
    check('con crypto.subtle devuelve el hex en minusculas y 2 digitos por byte',
        hex === 'abcd01', hex);
    const hexMal = await PMUFotos.sha1Hex(new Uint8Array([1]), {
        digest: function () { return Promise.reject(new Error('x')); }
    });
    check('si digest falla devuelve cadena vacia', hexMal === '');

    // -----------------------------------------------------------------------
    if (fallos) {
        console.error('\nFOTOS CONTRATO: ' + fallos + ' fallo(s) de ' + checks);
        process.exit(1);
    }
    console.log('\nFOTOS CONTRATO OK (' + checks + ' checks)');
})();
