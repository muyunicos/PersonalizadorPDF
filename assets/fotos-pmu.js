/**
 * PMUFotos - cache de los ORIGINALES del comprador (spec 035, T009).
 *
 * El navegador es la cache: la foto se acota a 2000 px (factor UNIFORME, nunca
 * deforma), se guarda en IndexedDB y alimenta la vista previa por `objectURL`
 * (0 red). La subida al servidor arranca en segundo plano (T013/T014): el
 * servidor es quien deduplica, porque el `id` sale del sha1 de los bytes CRUDOS.
 *
 * Por eso aca NO se calcula el sha: la clave local es `local-{uuid}` y el `sha`
 * se anota cuando el servidor lo devuelve (`marcarSubida`). Asi la foto se puede
 * mostrar antes de tener red, y cuando llega la respuesta queda buscable por
 * `sha` (dedupe y recuperacion tras recargar).
 *
 * Nada de esto toca el DOM.
 */
(function (global) {
    'use strict';

    /** Lado maximo del original (espejo de `PMU_Sesion::LADO_MAX`). */
    var LADO_MAX = 2000;
    var DB_NOMBRE = 'pmu_fotos';
    var DB_VERSION = 1;
    var STORE = 'fotos';
    var CALIDAD = 0.85;

    /** Factor UNIFORME para acotar a `LADO_MAX`. 1 = no toca la foto. */
    function factorCap(w, h) {
        var aw = Math.max(1, parseFloat(w) || 1);
        var ah = Math.max(1, parseFloat(h) || 1);
        var mayor = Math.max(aw, ah);
        return (mayor <= LADO_MAX) ? 1 : (LADO_MAX / mayor);
    }

    /** Medidas de salida del cap: nunca amplia y nunca deforma. */
    function medidasAcotadas(w, h) {
        var aw = Math.max(1, parseFloat(w) || 1);
        var ah = Math.max(1, parseFloat(h) || 1);
        var k = factorCap(aw, ah);
        return {
            k: k,
            w: Math.max(1, Math.round(aw * k)),
            h: Math.max(1, Math.round(ah * k))
        };
    }

    /** Los 12 primeros hex del sha son el `id` del servidor. */
    function idDe(sha) {
        return String(sha || '').slice(0, 12);
    }

    /** Clave local de una foto que todavia no tiene `sha` del servidor. */
    function claveLocal() {
        return 'local-' + Math.random().toString(36).slice(2, 10)
            + Date.now().toString(36);
    }

    /** Abre (y migra) la base. `idb` se inyecta para poder testear sin navegador. */
    function abrir(idb) {
        var motor = idb || global.indexedDB;
        if (!motor) {
            return Promise.reject(new Error('pmu:fotos:sin-indexeddb'));
        }
        return new Promise(function (resolver, rechazar) {
            var pedido = motor.open(DB_NOMBRE, DB_VERSION);
            pedido.onupgradeneeded = function () {
                var db = pedido.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    var store = db.createObjectStore(STORE, { keyPath: 'clave' });
                    store.createIndex('sha', 'sha', { unique: false });
                }
            };
            pedido.onsuccess = function () { resolver(pedido.result); };
            pedido.onerror = function () {
                rechazar(pedido.error || new Error('pmu:fotos:abrir'));
            };
        });
    }

    function pedir(db, modo, accion) {
        return new Promise(function (resolver, rechazar) {
            var tx = db.transaction(STORE, modo);
            var store = tx.objectStore(STORE);
            var req = accion(store);
            tx.oncomplete = function () { resolver(req ? req.result : undefined); };
            tx.onerror = function () { rechazar(tx.error || new Error('pmu:fotos:tx')); };
            tx.onabort = function () { rechazar(tx.error || new Error('pmu:fotos:abort')); };
        });
    }

    /** Guarda un registro ya acotado. Devuelve la clave local. */
    function guardarRegistro(db, registro) {
        var fila = {
            clave: (registro && registro.clave) || claveLocal(),
            sha: String((registro && registro.sha) || ''),
            blob: (registro && registro.blob) || null,
            w: Math.max(1, parseInt(registro && registro.w, 10) || 1),
            h: Math.max(1, parseInt(registro && registro.h, 10) || 1),
            nombre: String((registro && registro.nombre) || ''),
            creado: Date.now()
        };
        return pedir(db, 'readwrite', function (store) {
            return store.put(fila);
        }).then(function () { return fila.clave; });
    }

    function obtener(db, clave) {
        return pedir(db, 'readonly', function (store) {
            return store.get(String(clave || ''));
        }).then(function (r) { return r || null; });
    }

    /** Busca por `sha` del servidor (dedupe y recuperacion tras recargar). */
    function obtenerPorSha(db, sha) {
        var buscado = String(sha || '');
        if (buscado === '') {
            return Promise.resolve(null);
        }
        return pedir(db, 'readonly', function (store) {
            return store.index('sha').get(buscado);
        }).then(function (r) { return r || null; });
    }

    function listar(db) {
        return pedir(db, 'readonly', function (store) {
            return store.getAll();
        }).then(function (r) { return Array.isArray(r) ? r : []; });
    }

    function borrar(db, clave) {
        return pedir(db, 'readwrite', function (store) {
            return store.delete(String(clave || ''));
        });
    }

    /** Anota el `sha`/`id` que devolvio el servidor (la foto ya esta arriba). */
    function marcarSubida(db, clave, sha) {
        return obtener(db, clave).then(function (fila) {
            if (!fila) {
                return false;
            }
            fila.sha = String(sha || '');
            return pedir(db, 'readwrite', function (store) {
                return store.put(fila);
            }).then(function () { return true; });
        });
    }

    /** Pide almacenamiento persistente (el navegador puede desalojar si no). */
    function persistir(nav) {
        var n = nav || global.navigator;
        if (!n || !n.storage || typeof n.storage.persist !== 'function') {
            return Promise.resolve(false);
        }
        // `persist()` puede LANZAR de forma sincrona (Safari viejo, contexto no
        // seguro): el try tiene que estar aca, no solo en el `.catch`.
        return new Promise(function (resolver) {
            try {
                resolver(n.storage.persist());
            } catch (e) {
                resolver(false);
            }
        }).catch(function () { return false; });
    }

    var API = {
        LADO_MAX: LADO_MAX,
        DB_NOMBRE: DB_NOMBRE,
        STORE: STORE,
        CALIDAD: CALIDAD,
        factorCap: factorCap,
        medidasAcotadas: medidasAcotadas,
        idDe: idDe,
        claveLocal: claveLocal,
        abrir: abrir,
        guardarRegistro: guardarRegistro,
        obtener: obtener,
        obtenerPorSha: obtenerPorSha,
        listar: listar,
        borrar: borrar,
        marcarSubida: marcarSubida,
        persistir: persistir
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }
    global.PMUFotos = API;
})(typeof window !== 'undefined' ? window : globalThis);
