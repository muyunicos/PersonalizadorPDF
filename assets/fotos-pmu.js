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

    /**
     * sha1 hex (40 chars) de los bytes, con `crypto.subtle`. Devuelve '' si el
     * navegador no lo tiene (contexto no seguro, navegador viejo): el llamador
     * decide que hacer sin hash, nunca revienta.
     */
    function sha1Hex(bytes, cripto) {
        var c = cripto || (global.crypto && global.crypto.subtle ? global.crypto.subtle : null);
        if (!c || typeof c.digest !== 'function' || !bytes) {
            return Promise.resolve('');
        }
        return Promise.resolve(c.digest('SHA-1', bytes)).then(function (buf) {
            var v = new Uint8Array(buf);
            var hex = '';
            for (var i = 0; i < v.length; i++) {
                hex += ('0' + v[i].toString(16)).slice(-2);
            }
            return hex;
        }).catch(function () { return ''; });
    }

    /**
     * Cola FIFO de subidas en SEGUNDO PLANO (spec 035, T013/D2/R8).
     *
     * - a lo sumo `max` (2 por defecto) en vuelo: el comprador puede seguir
     *   ajustando mientras la foto viaja;
     * - la MISMA clave no se reenvia: probar encuadres de una foto ya subida
     *   cuesta 0 bytes;
     * - dos reintentos con backoff (1 s y 3 s): una red que se cae un instante no
     *   pierde la foto del comprador;
     * - `vaciar()` resuelve cuando no queda nada: es lo que espera el add-to-cart
     *   antes de mandar la personalizacion.
     *
     * `esperar` se inyecta para no dormir de verdad en los tests.
     */
    function crearCola(opciones) {
        var cfg = opciones || {};
        var max = Math.max(1, parseInt(cfg.max, 10) || 2);
        var reintentos = Array.isArray(cfg.reintentos) ? cfg.reintentos : [1000, 3000];
        var claveDe = (typeof cfg.clave === 'function') ? cfg.clave : function () { return ''; };
        var subir = (typeof cfg.subir === 'function') ? cfg.subir : null;
        // Spec 036 (T019/D9): firma de CONTENIDO (el sha de la foto o el hash de la
        // creacion). El mismo contenido no se sube dos veces (0 bytes).
        var dedupeDe = (typeof cfg.dedupe === 'function') ? cfg.dedupe : function () { return ''; };
        var esperar = (typeof cfg.esperar === 'function') ? cfg.esperar : function (ms) {
            return new Promise(function (r) { setTimeout(r, ms); });
        };
        var pendientes = [];
        var enVuelo = 0;
        var vistas = {};          // clave del SLOT -> promesa vigente
        var porContenido = {};    // firma del CONTENIDO -> promesa (T019)
        var generacion = {};      // clave del SLOT -> version vigente (T020)
        var enVueloPorClave = {}; // clave del SLOT -> true mientras corre
        var vacia = null;

        function cerrarSiVacia() {
            if (enVuelo === 0 && pendientes.length === 0 && vacia) {
                var r = vacia;
                vacia = null;
                r();
            }
        }

        function intentar(tarea) {
            var intento = 0;
            function paso() {
                return Promise.resolve()
                    .then(function () { return subir(tarea); })
                    .catch(function (e) {
                        if (intento >= reintentos.length) { throw e; }
                        var ms = reintentos[intento];
                        intento++;
                        return esperar(ms).then(paso);
                    });
            }
            return paso();
        }

        /** Suelta el slot: la siguiente version de la misma clave puede arrancar. */
        function liberarClave(envoltorio) {
            if (envoltorio.clave !== '') { delete enVueloPorClave[envoltorio.clave]; }
        }

        /** Borra los indices que apuntaban a un envoltorio que quedo sin efecto. */
        function olvidarMarca(p) {
            if (p.clave !== '' && vistas[p.clave] === p.promesa) { delete vistas[p.clave]; }
            if (p.firma !== '' && porContenido[p.firma] === p.promesa) { delete porContenido[p.firma]; }
        }

        /**
         * Primer envoltorio en orden FIFO que PUEDE arrancar (spec 036, T020).
         * Una clave con otra subida en vuelo espera (serializacion: asi "la ultima
         * version manda" en el servidor); una version superada sale ya, para
         * descartarse sin gastar red.
         */
        function elegible() {
            for (var i = 0; i < pendientes.length; i++) {
                var p = pendientes[i];
                if (p.clave === '') { return i; }
                if (p.gen !== generacion[p.clave]) { return i; }
                if (!enVueloPorClave[p.clave]) { return i; }
            }
            return -1;
        }

        function arrancar() {
            while (enVuelo < max) {
                var elige = elegible();
                if (elige < 0) { return; }
                var p = pendientes.splice(elige, 1)[0];
                // Spec 036 (T020/D9): una subida REEMPLAZADA no gasta red. Se
                // resuelve `false` para que el llamador sepa que no subio nada.
                if (p.clave !== '' && p.gen !== generacion[p.clave]) {
                    olvidarMarca(p);
                    p.resolver(false);
                    cerrarSiVacia();
                    continue;
                }
                if (p.clave !== '') { enVueloPorClave[p.clave] = true; }
                enVuelo++;
                (function (envoltorio) {
                    intentar(envoltorio.tarea).then(function (r) {
                        enVuelo--;
                        liberarClave(envoltorio);
                        envoltorio.resolver(r);
                        arrancar();
                        cerrarSiVacia();
                    }, function (e) {
                        enVuelo--;
                        liberarClave(envoltorio);
                        envoltorio.rechazar(e);
                        arrancar();
                        cerrarSiVacia();
                    });
                })(p);
            }
        }

        return {
            /**
             * Encola una subida (spec 036, D9).
             *
             * `clave` = el SLOT (`pdf|gid|indice` o lo que defina el llamador):
             *   - sin `reemplazar`, la misma clave NO se reenvia (0 bytes);
             *   - con `opciones.reemplazar`, la ultima version MANDA: la anterior
             *     se descarta si no arranco (resuelve `false`) y las dos nunca
             *     corren a la vez (serializadas por clave).
             * `opciones.dedupe` = firma del CONTENIDO (sha/hash): el mismo
             *   contenido devuelve la promesa ya en curso, suba o no el slot.
             */
            encolar: function (tarea, clave, opciones) {
                var k = (clave === undefined) ? String(claveDe(tarea) || '') : String(clave || '');
                var opt = opciones || {};
                var firma = (opt.dedupe === undefined) ? String(dedupeDe(tarea) || '') : String(opt.dedupe || '');
                if (firma !== '' && porContenido[firma]) { return porContenido[firma]; }
                if (k !== '' && !opt.reemplazar && vistas[k]) { return vistas[k]; }
                var gen = 1;
                if (k !== '') {
                    gen = (generacion[k] || 0) + 1;
                    generacion[k] = gen;
                }
                var envoltorio = { tarea: tarea, clave: k, gen: gen, firma: firma, promesa: null, resolver: null, rechazar: null };
                var promesa = new Promise(function (resolver, rechazar) {
                    envoltorio.resolver = resolver;
                    envoltorio.rechazar = rechazar;
                    pendientes.push(envoltorio);
                    arrancar();
                });
                envoltorio.promesa = promesa;
                if (k !== '') { vistas[k] = promesa; }
                if (firma !== '') { porContenido[firma] = promesa; }
                return promesa;
            },
            /** Resuelve cuando no queda nada en vuelo ni en cola. */
            vaciar: function () {
                if (enVuelo === 0 && pendientes.length === 0) {
                    return Promise.resolve();
                }
                return new Promise(function (r) { vacia = r; });
            },
            /** Cuantas quedan (en vuelo + en cola). */
            pendientes: function () { return enVuelo + pendientes.length; },
            /** Olvida una clave (para reintentar a proposito o liberar memoria). */
            olvidar: function (k) { delete vistas[String(k || '')]; }
        };
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
        sha1Hex: sha1Hex,
        crearCola: crearCola,
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
