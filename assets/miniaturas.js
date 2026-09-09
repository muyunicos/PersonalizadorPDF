/* ===== THUMB ENGINE - motor universal de miniaturas .webp =====
 * Soporta miniaturas individuales (HEAD + fallback render) y spritesheets
 * globales con manifiesto JSON para imagenes, fuentes y presets.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ThumbEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var config = { endpoint: '', nonce: '' };
    var cacheSingle = new Map();
    var cacheSprite = new Map();

    function configure(cfg) {
        if (!cfg) return;
        if (cfg.endpoint) config.endpoint = cfg.endpoint;
        if (cfg.nonce) config.nonce = cfg.nonce;
    }

    /**
     * Invalida la cache en memoria de un scope (o de todos si no se indica).
     * Se llama tras subidas/borrados/renombres para que el proximo ensureSprite
     * reevale el manifiesto persistido en vez de devolver un sheet viejo.
     */
    function invalidate(scope) {
        if (scope) {
            cacheSprite.delete(scope);
            return;
        }
        cacheSprite.clear();
    }

    function nombresSet(items) {
        var set = {};
        for (var i = 0; i < (items || []).length; i++) {
            if (items[i] && items[i].nombre) set[String(items[i].nombre)] = true;
        }
        return set;
    }

    function mismosNombres(manifest, items) {
        if (!manifest || !manifest.tiles || !items) return false;
        if (manifest.tiles.length !== items.length) return false;
        var set = nombresSet(items);
        for (var i = 0; i < manifest.tiles.length; i++) {
            if (!set[String(manifest.tiles[i].nombre)]) return false;
        }
        return true;
    }

    function manifestUrlDe(scope, baseUrl) {
        if (typeof baseUrl !== 'string' || !baseUrl) return '';
        return baseUrl.replace(/\/$/, '') + '/thumbs/' + encodeURIComponent(scope) + '.json';
    }

    function spriteUrlDe(scope, baseUrl) {
        if (typeof baseUrl !== 'string' || !baseUrl) return '';
        return baseUrl.replace(/\/$/, '') + '/thumbs/' + encodeURIComponent(scope) + '.webp';
    }

    function cargarImagen(src) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };
            img.src = src;
        });
    }

    function dibujarHueco(ctx, x, y, w, h) {
        ctx.save();
        ctx.clearRect(x, y, w, h);
        ctx.fillStyle = '#f4f4f4';
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    /**
     * Asegura una miniatura individual .webp.
     * 1. Verifica en cache en memoria.
     * 2. Si hay base, hace HEAD request. Si existe (200 OK), la guarda en cache y resuelve.
     * 3. Si no existe y se pasa render (o fuente como URL de imagen), renderiza canvas -> Blob webp,
     *    la envia al endpoint por POST y resuelve con la URL persistida.
     */
    function ensure(opts) {
        opts = opts || {};
        var fuente = opts.fuente;
        var nombre = opts.nombre || '';
        var base = (opts.base || '').replace(/\/$/, '');
        var ancho = opts.ancho || 100;
        var alto = opts.alto || 100;
        var render = opts.render;

        var thumbUrl = base ? base + '/thumbs/' + encodeURIComponent(nombre) + '.webp' : '';
        var cacheKey = base + '|' + nombre;

        if (cacheSingle.has(cacheKey)) {
            return Promise.resolve(cacheSingle.get(cacheKey));
        }

        function renderFallback() {
            if (render) {
                return render(fuente, ancho, alto);
            }
            if (typeof fuente === 'string' && fuente) {
                return new Promise(function (resolve) {
                    var img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = function () {
                        var cv = document.createElement('canvas');
                        cv.width = ancho;
                        cv.height = alto;
                        var ctx = cv.getContext('2d');
                        var scale = Math.min(ancho / img.width, alto / img.height);
                        var dw = img.width * scale;
                        var dh = img.height * scale;
                        var dx = (ancho - dw) / 2;
                        var dy = (alto - dh) / 2;
                        ctx.drawImage(img, dx, dy, dw, dh);
                        cv.toBlob(function (blob) { resolve(blob); }, 'image/webp', 0.85);
                    };
                    img.onerror = function () { resolve(null); };
                    img.src = fuente;
                });
            }
            return Promise.resolve(null);
        }

        function subirBlob(blob) {
            if (!blob || !config.endpoint) {
                return Promise.resolve(thumbUrl || (typeof fuente === 'string' ? fuente : null));
            }
            var fd = new FormData();
            fd.append('nombre', nombre);
            fd.append('webp', blob, nombre + '.webp');
            if (config.nonce) {
                fd.append('_wpnonce', config.nonce);
            }
            return fetch(config.endpoint, { method: 'POST', body: fd, credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var url = (data && data.success && data.data && data.data.url) || thumbUrl;
                    if (url) cacheSingle.set(cacheKey, url);
                    return url;
                })
                .catch(function () {
                    return thumbUrl || (typeof fuente === 'string' ? fuente : null);
                });
        }

        if (thumbUrl && typeof fetch === 'function') {
            return fetch(thumbUrl, { method: 'HEAD' })
                .then(function (r) {
                    if (r.ok) {
                        cacheSingle.set(cacheKey, thumbUrl);
                        return thumbUrl;
                    }
                    return renderFallback().then(subirBlob);
                })
                .catch(function () {
                    return renderFallback().then(subirBlob);
                });
        }

        return renderFallback().then(subirBlob);
    }

    /**
     * Asegura un spritesheet global con manifiesto JSON.
     * opts: { scope, items, ancho, alto, columnas, render, pad }
     * items: array de { nombre, url, ... }
     * Si el sprite/manifiesto ya existe en cache o servidor, lo carga y resuelve.
     * Si no existe o se fuerza regeneracion, dibuja cada tile con render() y compone el sheet.
     */
    /**
     * Spritesheet global persistente + actualizacion incremental (nivel 2).
     * opts: { scope, items, ancho, alto, columnas, render, pad, baseUrl }
     *   - baseUrl: URL publica del ambito (ej. presetsBase) para leer
     *     thumbs/{scope}.json y thumbs/{scope}.webp sin regenerar.
     * Flujo:
     *   1) si la cache en memoria coincide con los items -> devolverla;
     *   2) si hay manifest persistido y sus nombres coinciden -> reutilizarlo;
     *   3) si el manifest existe pero difiere -> actualizacion incremental
     *      (conserva tiles vigentes, reutiliza huecos, solo dibuja nuevos);
     *   4) si no hay nada -> generacion completa.
     */
    function ensureSprite(opts) {
        opts = opts || {};
        var scope = opts.scope;
        var items = opts.items || [];
        var ancho = opts.ancho || 100;
        var alto = opts.alto || 100;
        var columnas = opts.columnas || 0;
        var render = opts.render;
        var pad = !!opts.pad;
        var baseUrl = opts.baseUrl || '';

        if (!scope || items.length === 0) {
            return Promise.resolve(null);
        }

        // 1) Cache en memoria: valida solo si coincide el conjunto de nombres.
        if (cacheSprite.has(scope)) {
            var memo = cacheSprite.get(scope);
            if (memo && mismosNombres(memo.manifest, items)) {
                return Promise.resolve(memo);
            }
            cacheSprite.delete(scope);
        }

        // 2) Intentar reutilizar el manifiesto persistido en servidor.
        var mUrl = manifestUrlDe(scope, baseUrl);
        var sUrl = spriteUrlDe(scope, baseUrl);
        if (mUrl && sUrl && typeof fetch === 'function') {
            return fetch(mUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-cache' })
                .then(function (r) {
                    if (!r.ok) return regenerarCompleto();
                    return r.json().then(function (persistido) {
                        if (mismosNombres(persistido, items)) {
                            // Sheet vigente: devolverlo sin regenerar (carga rapida).
                            return cargarImagen(sUrl).then(function (img) {
                                if (!img) return regenerarCompleto();
                                var out = {
                                    spriteUrl: sUrl,
                                    manifestUrl: mUrl,
                                    manifest: persistido,
                                    spriteImage: img
                                };
                                cacheSprite.set(scope, out);
                                return out;
                            });
                        }
                        // 3) Difiere: intento incremental sobre el sheet previo.
                        return actualizarIncremental(persistido, { scope: scope, items: items, ancho: ancho, alto: alto, columnas: columnas, render: render, pad: pad, baseUrl: baseUrl });
                    }, function () { return regenerarCompleto(); });
                })
                .catch(function () { return regenerarCompleto(); });
        }

        function regenerarCompleto() {
            return construirDesdeCero({ scope: scope, items: items, ancho: ancho, alto: alto, columnas: columnas, render: render, pad: pad });
        }

        // Fallback directo (sin baseUrl o sin manifest accesible): generar completo.
        return regenerarCompleto();

        // --- Generacion completa (primera vez o sheet ilegible) ---
        function construirDesdeCero(p) {
            var scope = p.scope;
            var items = p.items;
            var ancho = p.ancho;
            var alto = p.alto;
            var columnas = p.columnas;
            var render = p.render;
            var pad = p.pad;
            var cols = columnas > 0 ? columnas : Math.ceil(Math.sqrt(items.length));
        var rows = Math.ceil(items.length / cols);
        var spriteW = cols * ancho;
        var spriteH = rows * alto;

        var cv = document.createElement('canvas');
        cv.width = spriteW;
        cv.height = spriteH;
        var ctx = cv.getContext('2d');

        // Mapear promesas de render para cada item
        var tasks = items.map(function (it, idx) {
            var col = idx % cols;
            var row = Math.floor(idx / cols);
            var x = col * ancho;
            var y = row * alto;

            var drawPromise = null;
            if (render) {
                drawPromise = Promise.resolve(render(it, ancho, alto));
            } else if (it.url) {
                drawPromise = new Promise(function (res) {
                    var img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = function () { res(img); };
                    img.onerror = function () { res(null); };
                    img.src = it.url;
                });
            } else {
                drawPromise = Promise.resolve(null);
            }

            return drawPromise.then(function (result) {
                if (!result) return { nombre: it.nombre, x: x, y: y, w: ancho, h: alto };
                // result puede ser Image, Canvas o Blob (tolerante a entornos sin DOM)
                var esImagen = (typeof HTMLImageElement !== 'undefined' && result instanceof HTMLImageElement)
                    || (typeof HTMLCanvasElement !== 'undefined' && result instanceof HTMLCanvasElement)
                    || (typeof ImageBitmap !== 'undefined' && result instanceof ImageBitmap);
                if (esImagen) {
                    if (pad) {
                        var scale = Math.min(ancho / (result.width || 1), alto / (result.height || 1));
                        var dw = (result.width || ancho) * scale;
                        var dh = (result.height || alto) * scale;
                        var dx = x + (ancho - dw) / 2;
                        var dy = y + (alto - dh) / 2;
                        ctx.drawImage(result, dx, dy, dw, dh);
                    } else {
                        ctx.drawImage(result, x, y, ancho, alto);
                    }
                    return { nombre: it.nombre, x: x, y: y, w: ancho, h: alto };
                }
                if (result instanceof Blob) {
                    return new Promise(function (resBlob) {
                        var img = new Image();
                        var blobUrl = URL.createObjectURL(result);
                        img.onload = function () {
                            if (pad) {
                                var scale = Math.min(ancho / img.width, alto / img.height);
                                var dw = img.width * scale;
                                var dh = img.height * scale;
                                var dx = x + (ancho - dw) / 2;
                                var dy = y + (alto - dh) / 2;
                                ctx.drawImage(img, dx, dy, dw, dh);
                            } else {
                                ctx.drawImage(img, x, y, ancho, alto);
                            }
                            URL.revokeObjectURL(blobUrl);
                            resBlob({ nombre: it.nombre, x: x, y: y, w: ancho, h: alto });
                        };
                        img.onerror = function () {
                            URL.revokeObjectURL(blobUrl);
                            resBlob({ nombre: it.nombre, x: x, y: y, w: ancho, h: alto });
                        };
                        img.src = blobUrl;
                    });
                }
                return { nombre: it.nombre, x: x, y: y, w: ancho, h: alto };
            });
        });

        return Promise.all(tasks).then(function (tiles) {
            var manifest = {
                scope: scope,
                tile: { ancho: ancho, alto: alto },
                columnas: cols,
                filas: rows,
                tiles: tiles
            };

            return new Promise(function (resBlob) {
                cv.toBlob(function (blob) { resBlob(blob); }, 'image/webp', 0.85);
            }).then(function (blob) {
                if (!blob || !config.endpoint) {
                    // Fallback sin endpoint: data-URL local
                    var resLocal = {
                        spriteUrl: cv.toDataURL('image/webp'),
                        manifest: manifest,
                        spriteImage: cv
                    };
                    cacheSprite.set(scope, resLocal);
                    return resLocal;
                }

                var fd = new FormData();
                fd.append('scope', scope);
                fd.append('sprite', blob, scope + '.webp');
                fd.append('manifest', JSON.stringify(manifest));
                if (config.nonce) {
                    fd.append('_wpnonce', config.nonce);
                }

                return fetch(config.endpoint, { method: 'POST', body: fd, credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data && data.success && data.data) {
                            var out = {
                                spriteUrl: data.data.spriteUrl,
                                manifestUrl: data.data.manifestUrl,
                                manifest: manifest
                            };
                            cacheSprite.set(scope, out);
                            return out;
                        }
                        return null;
                    })
                    .catch(function () { return null; });
            });
        });
        }

        // --- Actualizacion incremental: conserva tiles vigentes, reutiliza huecos ---
        function actualizarIncremental(persistido, p) {
            var scope = p.scope;
            var items = p.items;
            var ancho = p.ancho;
            var alto = p.alto;
            var render = p.render;
            var pad = p.pad;
            var baseUrl = p.baseUrl || '';

            var porNombre = {};
            var tilesViejos = (persistido && persistido.tiles) ? persistido.tiles : [];
            for (var i = 0; i < tilesViejos.length; i++) {
                porNombre[String(tilesViejos[i].nombre)] = tilesViejos[i];
            }
            var setNuevo = nombresSet(items);

            // Huecos: tiles del manifest que ya no corresponden a ningun item.
            var huecos = [];
            var vigentes = [];
            for (var j = 0; j < tilesViejos.length; j++) {
                if (!setNuevo[String(tilesViejos[j].nombre)]) {
                    huecos.push(tilesViejos[j]);
                } else {
                    vigentes.push(tilesViejos[j]);
                }
            }

            // Nuevos: items sin tile asignado todavia.
            var nuevos = [];
            for (var k = 0; k < items.length; k++) {
                if (!porNombre[String(items[k].nombre)] || !setNuevo[String(items[k].nombre)] && false) {
                    nuevos.push(items[k]);
                } else if (!porNombre[String(items[k].nombre)]) {
                    nuevos.push(items[k]);
                }
            }

            // Sin nada que dibujar: el viejo sigue siendo valido en contenido
            // (solo cambio el orden o las dimensiones). Regenerar limpio.
            if (!nuevos.length) {
                // Los eliminados dejan huecos inutiles: reconstruir compacto.
                return construirDesdeCero({ scope: scope, items: items, ancho: ancho, alto: alto, columnas: p.columnas, render: render, pad: pad });
            }

            // Dimensiones: mantener columnas previas si son coherentes.
            var colsPrev = persistido && persistido.columnas ? persistido.columnas : 0;
            var cols = (colsPrev > 0) ? colsPrev : Math.ceil(Math.sqrt(items.length));
            var sUrl = spriteUrlDe(scope, baseUrl);

            return cargarImagen(sUrl).then(function (sheet) {
                if (!sheet) {
                    return construirDesdeCero({ scope: scope, items: items, ancho: ancho, alto: alto, columnas: p.columnas, render: render, pad: pad });
                }
                var maxIdx = 0;
                var mapa = {};
                for (var m = 0; m < vigentes.length; m++) {
                    var t = vigentes[m];
                    var idx = Math.round(t.y / alto) * cols + Math.round(t.x / ancho);
                    mapa[String(t.nombre)] = { x: t.x, y: t.y, w: ancho, h: alto };
                    if (idx > maxIdx) maxIdx = idx;
                }
                // Canvas base = sheet previo (mismo tamano o ampliado).
                var necesarios = vigentes.length + nuevos.length;
                var rowsPrev = Math.ceil((maxIdx + 1) / cols);
                var rowsNeed = Math.ceil(necesarios / cols);
                var rows = Math.max(rowsPrev, rowsNeed);
                var cv = document.createElement('canvas');
                cv.width = cols * ancho;
                cv.height = Math.max(rows, 1) * alto;
                var ctx = cv.getContext('2d');
                ctx.drawImage(sheet, 0, 0);

                // Asignar posicion a cada nuevo: primero huecos, luego al final.
                var asignados = {};
                var cola = huecos.slice();
                var cursor = maxIdx + 1;
                for (var n = 0; n < nuevos.length; n++) {
                    var slot;
                    if (cola.length) {
                        slot = cola.shift();
                    } else {
                        var c2 = cursor % cols;
                        var r2 = Math.floor(cursor / cols);
                        if ((r2 + 1) * alto > cv.height) {
                            // Ampliar una fila mas.
                            var cv2 = document.createElement('canvas');
                            cv2.width = cv.width;
                            cv2.height = cv.height + alto;
                            var ctx2 = cv2.getContext('2d');
                            ctx2.drawImage(cv, 0, 0);
                            cv = cv2;
                            ctx = ctx2;
                        }
                        slot = { x: c2 * ancho, y: r2 * alto };
                        cursor++;
                    }
                    asignados[String(nuevos[n].nombre)] = { x: slot.x, y: slot.y, w: ancho, h: alto };
                }

                // Dibujar solo los nuevos sobre el canvas ya compuesto.
                var pendientes = nuevos.map(function (it) {
                    var pos = asignados[String(it.nombre)];
                    dibujarHueco(ctx, pos.x, pos.y, ancho, alto);
                    return dibujarItemEn(ctx, it, pos.x, pos.y, ancho, alto, render, pad);
                });

                return Promise.all(pendientes).then(function () {
                    var tiles = [];
                    for (var q = 0; q < vigentes.length; q++) {
                        tiles.push({ nombre: vigentes[q].nombre, x: mapa[String(vigentes[q].nombre)].x, y: mapa[String(vigentes[q].nombre)].y, w: ancho, h: alto });
                    }
                    for (var z = 0; z < nuevos.length; z++) {
                        var pp = asignados[String(nuevos[z].nombre)];
                        tiles.push({ nombre: nuevos[z].nombre, x: pp.x, y: pp.y, w: ancho, h: alto });
                    }
                    var filas = Math.max(1, Math.ceil(tiles.length / cols));
                    var manifest = {
                        scope: scope,
                        tile: { ancho: ancho, alto: alto },
                        columnas: cols,
                        filas: filas,
                        tiles: tiles
                    };
                    return persistirSheet(cv, scope, manifest);
                });
            });
        }

        function dibujarItemEn(ctx, it, x, y, ancho, alto, render, pad) {
            var drawPromise;
            if (render) {
                drawPromise = Promise.resolve(render(it, ancho, alto));
            } else if (it.url) {
                drawPromise = cargarImagen(it.url).then(function (img) { return img; });
            } else {
                drawPromise = Promise.resolve(null);
            }
            return drawPromise.then(function (result) {
                if (!result) return;
                var esImagen = (typeof HTMLImageElement !== 'undefined' && result instanceof HTMLImageElement)
                    || (typeof HTMLCanvasElement !== 'undefined' && result instanceof HTMLCanvasElement)
                    || (typeof ImageBitmap !== 'undefined' && result instanceof ImageBitmap);
                if (esImagen) {
                    if (pad) {
                        var scale = Math.min(ancho / (result.width || 1), alto / (result.height || 1));
                        var dw = (result.width || ancho) * scale;
                        var dh = (result.height || alto) * scale;
                        ctx.drawImage(result, x + (ancho - dw) / 2, y + (alto - dh) / 2, dw, dh);
                    } else {
                        ctx.drawImage(result, x, y, ancho, alto);
                    }
                    return;
                }
                if (result instanceof Blob) {
                    var blobUrl = URL.createObjectURL(result);
                    return cargarImagen(blobUrl).then(function (img) {
                        try {
                            if (img) {
                                if (pad) {
                                    var s2 = Math.min(ancho / img.width, alto / img.height);
                                    var w2 = img.width * s2;
                                    var h2 = img.height * s2;
                                    ctx.drawImage(img, x + (ancho - w2) / 2, y + (alto - h2) / 2, w2, h2);
                                } else {
                                    ctx.drawImage(img, x, y, ancho, alto);
                                }
                            }
                        } finally {
                            URL.revokeObjectURL(blobUrl);
                        }
                    });
                }
            });
        }

        function persistirSheet(cv, scope, manifest) {
            return new Promise(function (resBlob) {
                cv.toBlob(function (blob) { resBlob(blob); }, 'image/webp', 0.85);
            }).then(function (blob) {
                if (!blob || !config.endpoint) {
                    var resLocal = {
                        spriteUrl: cv.toDataURL('image/webp'),
                        manifest: manifest,
                        spriteImage: cv
                    };
                    cacheSprite.set(scope, resLocal);
                    return resLocal;
                }
                var fd = new FormData();
                fd.append('scope', scope);
                fd.append('sprite', blob, scope + '.webp');
                fd.append('manifest', JSON.stringify(manifest));
                if (config.nonce) {
                    fd.append('_wpnonce', config.nonce);
                }
                return fetch(config.endpoint, { method: 'POST', body: fd, credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data && data.success && data.data) {
                            var out = {
                                spriteUrl: data.data.spriteUrl,
                                manifestUrl: data.data.manifestUrl,
                                manifest: manifest
                            };
                            cacheSprite.set(scope, out);
                            return out;
                        }
                        return null;
                    })
                    .catch(function () { return null; });
            });
        }
    }

    /**
     * Localiza las coordenadas de un tile por nombre dentro del manifiesto.
     */
    function tile(manifest, nombre) {
        if (!manifest || !manifest.tiles) return null;
        for (var i = 0; i < manifest.tiles.length; i++) {
            if (manifest.tiles[i].nombre === nombre) {
                return manifest.tiles[i];
            }
        }
        return null;
    }

    /**
     * Dibuja un tile en un contexto 2D.
     * imgSprite: Image o Canvas del spritesheet
     * manifest: objeto manifiesto
     * nombre: nombre del item
     * dx, dy, dw, dh: rect de destino en ctx
     */
    function drawTile(ctx, imgSprite, manifest, nombre, dx, dy, dw, dh) {
        if (!ctx || !imgSprite) return false;
        var t = tile(manifest, nombre);
        if (!t) return false;
        try {
            ctx.drawImage(imgSprite, t.x, t.y, t.w, t.h, dx, dy, dw, dh);
            return true;
        } catch (e) {
            return false;
        }
    }

    return {
        configure: configure,
        ensure: ensure,
        ensureSprite: ensureSprite,
        invalidate: invalidate,
        tile: tile,
        drawTile: drawTile
    };
}));
