/* ===== PRESET MANAGER - presets .txm (+ .webp) en modules/textmuy/presets =====
 *
 * Desde 3.2.0 el almacenamiento unico de presets son ARCHIVOS en presets/:
 *   {nombre}.txm  -> delta de settings (formato textmuy-project v1)
 *   {nombre}.webp -> miniatura 100x200 para la galeria
 *
 * Dentro del plugin (iframe de "Estilos de Texto") el guardado/borrado y la
 * subida de imagenes van por el puente PHP (admin-post, ver AGENTS.md del
 * plugin). Sin puente (uso standalone) "guardar" descarga el .txm y las
 * imagenes se siguen embebiendo como data-URL.
 * Las claves localStorage de versiones anteriores son SOLO LECTURA: la galeria
 * ofrece migrarlas al servidor una unica vez (migrateLegacyPresets).
 */
(function() {
    'use strict';

    // ===== PUENTE CON PERSONALIZADOR PDF (postMessage same-origin) =====
    // La pagina del admin envia {type:'textmuy-bridge', bridge:{urls,nonces,presets,imagenes}}
    // cuando el iframe carga. Sin puente: bridge queda null (modo standalone).
    let bridge = null;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('message', function (ev) {
            if (!ev || !ev.data || ev.data.type !== 'textmuy-bridge') return;
            if (ev.source !== window.parent && ev.source !== window) return;
            if (ev.data.bridge && typeof ev.data.bridge === 'object') {
                bridge = ev.data.bridge;
            }
        });
        // Avisar al parent que el modulo ya escucha (el parent reenvia el puente).
        try {
            if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
                window.parent.postMessage({ type: 'textmuy-ready' }, window.location.origin);
            }
        } catch (_) { /* parent cruzado o inaccesible */ }
    }

    // Presets base que trae el modulo (fallback del listado cuando no hay puente).
    const BASE_PRESETS = [
        'clean-modern', 'cyberpunk', 'fire-free', 'gold-metallic', 'looney-tunes',
        'neon-glow', 'nintendo', 'retro-wave', 'simple-gradient'
    ];

    // Claves legacy de versiones anteriores (solo lectura, para migrar).
    const LEGACY_STORAGE_KEY = 'textmuy_presets';
    const LEGACY_IMPORTED_KEY = 'textstudio_presets';

    // ===== FORMATO .txm =====
    const PROJECT_FORMAT = 'textmuy-project';
    const PROJECT_VERSION = 1;
    const THUMB_WIDTH = 100;
    const THUMB_HEIGHT = 200;

    let thumbnailCache = new Map();   // name -> URL (runtime only)

    function getDefaults() {
        return (window.TextEditor && window.TextEditor.createDefaultSettings)
            ? window.TextEditor.createDefaultSettings()
            : {};
    }

    // Recursive diff of `current` against `base`; only differing branches are
    // kept. Explicit false/0/null/"" are preserved when they differ.
    function diffSettings(base, current) {
        if (current === base) return undefined;
        if (Array.isArray(current)) {
            return JSON.stringify(current) === JSON.stringify(base) ? undefined : current;
        }
        if (current && base && typeof current === 'object' && typeof base === 'object' && !Array.isArray(base)) {
            const out = {};
            let has = false;
            Object.keys(current).forEach(function(k) {
                const d = diffSettings(base[k], current[k]);
                if (d !== undefined) { out[k] = d; has = true; }
            });
            return has ? out : undefined;
        }
        return current;
    }

    function applyDelta(target, delta) {
        if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return;
        Object.keys(delta).forEach(function(k) {
            const v = delta[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
                applyDelta(target[k], v);
            } else {
                target[k] = v;
            }
        });
    }

    function settingsFromDelta(delta) {
        const settings = JSON.parse(JSON.stringify(getDefaults()));
        applyDelta(settings, delta);
        return settings;
    }

    function sanitizeName(name) {
        const clean = String(name || '').trim()
            .replace(/[^a-z0-9_-]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
        return clean || 'preset';
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function(resolve, reject) {
            canvas.toBlob(function(blob) {
                if (blob) resolve(blob);
                else reject(new Error('Could not encode image'));
            }, type, quality);
        });
    }

    function blobToDataURL(blob) {
        return new Promise(function(resolve, reject) {
            const r = new FileReader();
            r.onload = function() { resolve(r.result); };
            r.onerror = function() { reject(r.error); };
            r.readAsDataURL(blob);
        });
    }

    function thumbnailCanvas(settings) {
        const editor = window.TextEditor;
        if (!editor || !editor.renderToCanvas) throw new Error('Editor not ready');
        const s = settings || editor.getSettings();
        const cfg = (s.canvas && s.canvas.width) ? s.canvas : getDefaults();
        const src = document.createElement('canvas');
        src.width = cfg.width;
        src.height = cfg.height;
        editor.renderToCanvas(src, s);
        const c = document.createElement('canvas');
        c.width = THUMB_WIDTH;
        c.height = THUMB_HEIGHT;
        const ctx = c.getContext('2d');
        const scale = Math.min(THUMB_WIDTH / src.width, THUMB_HEIGHT / src.height);
        const dw = src.width * scale;
        const dh = src.height * scale;
        ctx.drawImage(src, (THUMB_WIDTH - dw) / 2, (THUMB_HEIGHT - dh) / 2, dw, dh);
        return c;
    }

    async function thumbnailBlob(settings) {
        return canvasToBlob(thumbnailCanvas(settings), 'image/webp', 0.9);
    }

    async function thumbnailDataUrl(settings) {
        return blobToDataURL(await thumbnailBlob(settings));
    }

    // ===== GUARDADO / BORRADO =====
    async function leerJson(resp) {
        try { return await resp.json(); } catch (_) { return null; }
    }

    /** Mensaje de error humano: JSON del handler, o aviso de sesion expirada. */
    function mensajePuente(datos, resp, porDefecto) {
        if (datos && datos.data) return String(datos.data);
        if (resp && (resp.status === 403 || resp.status === 400)) {
            return porDefecto + ' Recarga la pagina (la sesion pudo expirar) y reintenta.';
        }
        return porDefecto;
    }

    function descargarTxm(safe, blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safe + '.txm';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    /**
     * Guarda el settings actual como par {nombre}.txm + {nombre}.webp.
     * Con puente: al servidor (disponible en todos los navegadores).
     * Sin puente: descarga el .txm (el usuario lo coloca en presets/).
     * Devuelve {name, mode:'server'|'download'}.
     */
    async function savePreset(name, settings) {
        const safe = sanitizeName(name || (settings && settings.text) || 'preset');
        const payload = {
            format: PROJECT_FORMAT,
            version: PROJECT_VERSION,
            name: safe,
            settings: diffSettings(getDefaults(), settings) || {}
        };
        const txmBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        if (!bridgeAvailable()) {
            descargarTxm(safe, txmBlob);
            return { name: safe, mode: 'download' };
        }
        const webpBlob = await thumbnailBlob(settings);
        const fd = new FormData();
        fd.append('nombre', safe);
        fd.append('txm', txmBlob, safe + '.txm');
        fd.append('webp', webpBlob, safe + '.webp');
        fd.append('_wpnonce', bridge.nonces.guardarPreset);
        const resp = await fetch(bridge.urls.guardarPreset, {
            method: 'POST', body: fd, credentials: 'same-origin'
        });
        const datos = await leerJson(resp);
        if (!resp.ok || !datos || !datos.success) {
            throw new Error(mensajePuente(datos, resp, 'No se pudo guardar el preset en el servidor.'));
        }
        // Mantener el listado local al dia (sin recargar la pagina).
        if (Array.isArray(bridge.presets) && bridge.presets.indexOf(safe) === -1) {
            bridge.presets.push(safe);
            bridge.presets.sort();
        }
        thumbnailCache.set(safe, 'presets/' + encodeURIComponent(safe) + '.webp');
        return { name: safe, mode: 'server' };
    }

    async function deletePreset(name) {
        if (!bridgeAvailable()) {
            throw new Error('Borrar presets del servidor solo esta disponible dentro del plugin.');
        }
        const safe = sanitizeName(name);
        const fd = new FormData();
        fd.append('nombre', safe);
        fd.append('_wpnonce', bridge.nonces.borrarPreset);
        const resp = await fetch(bridge.urls.borrarPreset, {
            method: 'POST', body: fd, credentials: 'same-origin'
        });
        const datos = await leerJson(resp);
        if (!resp.ok || !datos || !datos.success) {
            throw new Error(mensajePuente(datos, resp, 'No se pudo borrar el preset del servidor.'));
        }
        if (Array.isArray(bridge.presets)) {
            bridge.presets = bridge.presets.filter(function (n) { return n !== safe; });
        }
        thumbnailCache.delete(safe);
        return true;
    }

    // ===== IMAGENES SUBIDAS (modules/textmuy/imagenes, para rellenos/fondos) =====
    async function uploadImage(file) {
        if (!bridgeAvailable()) {
            throw new Error('El directorio de imagenes solo esta disponible dentro del plugin.');
        }
        const fd = new FormData();
        fd.append('imagen', file, file.name);
        fd.append('_wpnonce', bridge.nonces.subirImagen);
        const resp = await fetch(bridge.urls.subirImagen, {
            method: 'POST', body: fd, credentials: 'same-origin'
        });
        const datos = await leerJson(resp);
        if (!resp.ok || !datos || !datos.success) {
            throw new Error(mensajePuente(datos, resp, 'No se pudo subir la imagen.'));
        }
        if (Array.isArray(bridge.imagenes)) {
            bridge.imagenes.push({ nombre: datos.data.nombre, url: datos.data.url });
        }
        return datos.data; // {nombre, url}
    }

    // ===== LISTADO =====
    function bridgeAvailable() {
        return !!(bridge && bridge.urls && bridge.urls.guardarPreset && bridge.nonces);
    }

    function listPresets() {
        if (bridge && Array.isArray(bridge.presets) && bridge.presets.length) {
            return bridge.presets.slice();
        }
        return BASE_PRESETS.slice();
    }

    function listImages() {
        return (bridge && Array.isArray(bridge.imagenes)) ? bridge.imagenes.slice() : [];
    }

    // ===== CARGA =====
    // Devuelve {kind:'txm'|'raw', data}. 'raw' es el formato TextStudio crudo de
    // los presets .json legacy (compat de carga, ya no se generan).
    async function fetchPreset(name) {
        const safe = sanitizeName(name);
        const response = await fetch('presets/' + encodeURIComponent(safe) + '.txm');
        if (response.ok) {
            const payload = await response.json();
            if (!payload || payload.format !== PROJECT_FORMAT || typeof payload.settings !== 'object' || payload.settings === null) {
                throw new Error('Unsupported preset format: ' + safe);
            }
            return { kind: 'txm', data: payload };
        }
        const legacy = await fetch('presets/' + encodeURIComponent(safe) + '.json');
        if (legacy.ok) {
            return { kind: 'raw', data: await legacy.json() };
        }
        throw new Error('Preset not found: ' + safe);
    }

    async function loadPreset(name) {
        try {
            const entry = await fetchPreset(name);
            const settings = entry.kind === 'txm' ? settingsFromDelta(entry.data.settings) : entry.data;
            if (window.TextEditor && window.TextEditor.loadPreset) window.TextEditor.loadPreset(settings);
            return settings;
        } catch (e) {
            console.error('Failed to load preset:', name, e);
            return null;
        }
    }

    // ===== MINIATURAS =====
    function isFileProtocol() {
        try { return typeof location !== 'undefined' && location.protocol === 'file:'; }
        catch (_) { return false; }
    }

    async function imagenExiste(url) {
        try {
            const resp = await fetch(url, { method: 'HEAD' });
            return resp.ok;
        } catch (_) { return false; }
    }

    /**
     * URL de miniatura de un preset: presets/{name}.webp si existe en el
     * servidor; si no, render lazy 100x200 en memoria (uso standalone o preset
     * sin .webp). Nunca escribe en localStorage: las miniaturas viven junto al
     * .txm (presets/{name}.webp).
     */
    async function ensureThumbnail(name) {
        if (thumbnailCache.has(name)) return thumbnailCache.get(name);
        if (typeof fetch === 'function' && !isFileProtocol()) {
            const url = 'presets/' + encodeURIComponent(sanitizeName(name)) + '.webp';
            if (await imagenExiste(url)) {
                thumbnailCache.set(name, url);
                return url;
            }
        }
        try {
            const entry = await fetchPreset(name);
            let settings = entry.data;
            if (entry.kind === 'txm') {
                settings = settingsFromDelta(entry.data.settings);
            } else if (window.TextEditor && window.TextEditor.createDefaultSettings && window.TextEditor.loadPreset) {
                const converted = window.TextEditor.createDefaultSettings();
                window.TextEditor.loadPreset(entry.data, converted);
                settings = converted;
            }
            const url = await thumbnailDataUrl(settings);
            thumbnailCache.set(name, url);
            return url;
        } catch (e) {
            console.warn('Could not render thumbnail for', name, e);
            return null;
        }
    }

    // ===== MIGRACION LEGACY (localStorage -> servidor, una unica vez) =====
    /** Presets de versiones anteriores guardados en localStorage (solo lectura). */
    function legacyLocalPresets() {
        const out = [];
        try {
            const loc = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');
            Object.keys(loc).forEach(function (n) {
                out.push({ name: n, kind: 'settings', data: loc[n] });
            });
            const imp = JSON.parse(localStorage.getItem(LEGACY_IMPORTED_KEY) || '{}');
            Object.keys(imp).forEach(function (n) {
                if (!out.some(function (p) { return p.name === n; })) {
                    out.push({ name: n, kind: 'raw', data: imp[n].preset || imp[n] });
                }
            });
        } catch (_) { /* storage is optional */ }
        return out;
    }

    /** Sube los presets legacy de este navegador al servidor y limpia las claves. */
    async function migrateLegacyPresets() {
        const viejos = legacyLocalPresets();
        if (!viejos.length || !bridgeAvailable()) return [];
        const subidos = [];
        for (let i = 0; i < viejos.length; i++) {
            const p = viejos[i];
            try {
                let settings = p.data;
                if (p.kind === 'raw' && window.TextEditor && window.TextEditor.createDefaultSettings && window.TextEditor.loadPreset) {
                    settings = window.TextEditor.createDefaultSettings();
                    window.TextEditor.loadPreset(p.data, settings);
                }
                if (settings && typeof settings === 'object') {
                    delete settings.category;
                    delete settings.timestamp;
                }
                await savePreset(p.name, settings);
                subidos.push(sanitizeName(p.name));
            } catch (e) {
                console.warn('No se pudo migrar el preset local', p.name, e);
            }
        }
        if (subidos.length) {
            try {
                localStorage.removeItem(LEGACY_STORAGE_KEY);
                localStorage.removeItem(LEGACY_IMPORTED_KEY);
            } catch (_) { /* storage is optional */ }
        }
        return subidos;
    }

    // Expose API
    window.PresetManager = {
        // Listado y carga (archivos .txm de presets/)
        listPresets,
        listImages,
        loadPreset,
        fetchPreset,
        settingsFromDelta,
        diffSettings,
        // Puente (guardar/borrar en el servidor, o descargar .txm standalone)
        savePreset,
        deletePreset,
        bridgeAvailable,
        // Imagenes subidas (modules/textmuy/imagenes)
        uploadImage,
        // Miniaturas de galeria (presets/{name}.webp o render lazy)
        ensureThumbnail,
        thumbnailDataUrl,
        // Migracion unica de presets legacy (localStorage de versiones previas)
        legacyLocalPresets,
        migrateLegacyPresets
    };
})();
