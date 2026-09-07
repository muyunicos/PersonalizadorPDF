/* ===== PRESET MANAGER - CRUD Operations ===== */
(function() {
    'use strict';

    const STORAGE_KEY = 'textmuy_presets';
    const IMPORTED_KEY = 'textstudio_presets';
    
    // Preset categories
    const CATEGORIES = {
        basic: 'Basic',
        gaming: 'Gaming',
        brands: 'Brands',
        artistic: 'Artistic',
        retro: 'Retro',
        modern: 'Modern',
        neon: 'Neon',
        metallic: 'Metallic',
        custom: 'Custom'
    };

    /**
     * Get all presets (local + imported)
     */
    function getAllPresets() {
        const presets = {};
        
        // Load local presets
        try {
            const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            Object.keys(local).forEach(name => {
                presets[name] = {
                    name: name,
                    data: local[name],
                    source: 'local',
                    category: local[name].category || 'custom',
                    timestamp: local[name].timestamp || Date.now()
                };
            });
        } catch (e) {
            console.error('Failed to load local presets:', e);
        }

        // Load imported presets
        try {
            const imported = JSON.parse(localStorage.getItem(IMPORTED_KEY) || '{}');
            Object.keys(imported).forEach(name => {
                if (!presets[name]) {
                    presets[name] = {
                        name: name,
                        data: imported[name].preset || imported[name],
                        source: 'imported',
                        category: (imported[name].preset || imported[name]).category || 'custom',
                        timestamp: imported[name].timestamp || Date.now()
                    };
                }
            });
        } catch (e) {
            console.error('Failed to load imported presets:', e);
        }

        return presets;
    }

    /**
     * Get presets by category
     */
    function getPresetsByCategory(category) {
        const presets = getAllPresets();
        const filtered = {};
        
        Object.keys(presets).forEach(name => {
            if (presets[name].category === category) {
                filtered[name] = presets[name];
            }
        });
        
        return filtered;
    }

    /**
     * Search presets by name
     */
    function searchPresets(query) {
        const presets = getAllPresets();
        const filtered = {};
        const lowerQuery = query.toLowerCase();
        
        Object.keys(presets).forEach(name => {
            if (name.toLowerCase().includes(lowerQuery)) {
                filtered[name] = presets[name];
            }
        });
        
        return filtered;
    }

    /**
     * Get all categories
     */
    function getCategories() {
        return CATEGORIES;
    }

    /**
     * Get preset by name
     */
    function getPreset(name) {
        const presets = getAllPresets();
        return presets[name] ? presets[name].data : null;
    }

    /**
     * Create new preset
     */
    function createPreset(name, settings, category = 'custom') {
        if (!name || typeof name !== 'string') {
            throw new Error('Preset name is required');
        }

        const safeName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        
        try {
            const presets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            
            if (presets[safeName]) {
                throw new Error('Preset already exists: ' + safeName);
            }

            presets[safeName] = {
                ...settings,
                category: category,
                timestamp: Date.now()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
            return safeName;
        } catch (e) {
            console.error('Failed to create preset:', e);
            throw e;
        }
    }

    /**
     * Update existing preset
     */
    function updatePreset(name, settings) {
        if (!name || typeof name !== 'string') {
            throw new Error('Preset name is required');
        }

        const safeName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        
        try {
            const presets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            
            if (!presets[safeName]) {
                throw new Error('Preset not found: ' + safeName);
            }

            presets[safeName] = {
                ...settings,
                timestamp: Date.now()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
            return safeName;
        } catch (e) {
            console.error('Failed to update preset:', e);
            throw e;
        }
    }

    /**
     * Delete preset
     */
    function deletePreset(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Preset name is required');
        }

        const safeName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        
        try {
            const presets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            
            if (!presets[safeName]) {
                throw new Error('Preset not found: ' + safeName);
            }

            delete presets[safeName];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
            return true;
        } catch (e) {
            console.error('Failed to delete preset:', e);
            throw e;
        }
    }

    /**
     * Duplicate preset
     */
    function duplicatePreset(name, newName) {
        const preset = getPreset(name);
        
        if (!preset) {
            throw new Error('Preset not found: ' + name);
        }

        const finalName = newName || name + '-copy';
        return createPreset(finalName, preset);
    }

    /**
     * Export preset as JSON file
     */
    function exportPreset(name) {
        const preset = getPreset(name);
        
        if (!preset) {
            throw new Error('Preset not found: ' + name);
        }

        const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Import preset from JSON file
     */
    function importPreset(jsonString) {
        try {
            const preset = JSON.parse(jsonString);
            const name = preset.name || 'imported-preset-' + Date.now();
            return createPreset(name, preset);
        } catch (e) {
            console.error('Failed to import preset:', e);
            throw new Error('Invalid preset JSON');
        }
    }

    /**
     * Load preset from file system
     */
    async function loadPresetFromFile(name) {
        const response = await fetch('presets/' + encodeURIComponent(name) + '.json');
        if (!response.ok) {
            throw new Error('Preset not found: ' + name);
        }
        return await response.json();
    }

    /**
     * Get preset list sorted by timestamp
     */
    function getPresetList() {
        const presets = getAllPresets();
        const list = Object.values(presets).sort((a, b) => b.timestamp - a.timestamp);
        return list;
    }

    /**
     * Clear all local presets
     */
    function clearLocalPresets() {
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Clear imported presets cache
     */
    function clearImportedPresets() {
        localStorage.removeItem(IMPORTED_KEY);
    }

    /**
     * Get preset count
     */
    function getPresetCount() {
        const presets = getAllPresets();
        return Object.keys(presets).length;
    }

// ===== PROJECT (.txm delta) + GALLERY THUMBNAILS =====
    const PROJECT_FORMAT = 'textmuy-project';
    const PROJECT_VERSION = 1;
    const THUMB_WIDTH = 100;
    const THUMB_HEIGHT = 200;

    let projectDirHandle = null;      // FileSystemDirectoryHandle from the picker
    let thumbnailCache = new Map();   // name -> dataURL (runtime only)

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
        return clean || 'project';
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

    function storedThumbnail(name) {
        try {
            return (JSON.parse(localStorage.getItem('textmuy_thumbnails') || '{}'))[name] || null;
        } catch (_) { return null; }
    }

    function storeThumbnail(name, url) {
        try {
            const m = JSON.parse(localStorage.getItem('textmuy_thumbnails') || '{}');
            m[name] = url;
            localStorage.setItem('textmuy_thumbnails', JSON.stringify(m));
        } catch (_) {}
    }

    function isFileProtocol() {
        try { return typeof location !== 'undefined' && location.protocol === 'file:'; }
        catch (_) { return false; }
    }

    async function ensureThumbnail(name) {
        if (thumbnailCache.has(name)) return thumbnailCache.get(name);
        const stored = storedThumbnail(name);
        if (stored) { thumbnailCache.set(name, stored); return stored; }
        try {
            let data = getPreset(name);
            if (!data && !(typeof fetch !== 'function' || isFileProtocol())) {
                data = await loadPresetFromFile(name);
            }
            if (!data) return null;
            // Convert the raw preset (TextStudio structure) into internal
            // settings so the thumbnail matches what loadPreset would show.
            const editor = window.TextEditor;
            let settings = data;
            if (editor && editor.createDefaultSettings && editor.loadPreset) {
                settings = editor.createDefaultSettings();
                editor.loadPreset(data, settings);
            }
            const url = await thumbnailDataUrl(settings);
            thumbnailCache.set(name, url);
            storeThumbnail(name, url);
            return url;
        } catch (e) {
            console.warn('Could not render thumbnail for', name, e);
            return null;
        }
    }

    // Load a preset (local/imported or bundled file) into the editor.
    async function loadPreset(name) {
        try {
            let data = getPreset(name);
            if (!data) data = await loadPresetFromFile(name);
            if (window.TextEditor && window.TextEditor.loadPreset) window.TextEditor.loadPreset(data);
            return data;
        } catch (e) {
            console.error('Failed to load preset:', name, e);
            return null;
        }
    }
    // ---- File System Access projects ----
    function hasProjectDirectory() { return !!projectDirHandle; }

    function getProjectDirectoryName() {
        return projectDirHandle ? projectDirHandle.name : null;
    }

    async function pickProjectDirectory() {
        if (!window.showDirectoryPicker) {
            throw new Error('Folder access is not supported by this browser. Use Chrome or Edge.');
        }
        projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        return projectDirHandle;
    }

    function requireProjectDir() {
        return projectDirHandle
            ? Promise.resolve(projectDirHandle)
            : Promise.reject(new Error('No project folder selected.'));
    }

    async function saveProject(name, settings) {
        const handle = await requireProjectDir();
        const safe = sanitizeName(name || (settings && settings.text) || 'project');
        const payload = {
            format: PROJECT_FORMAT,
            version: PROJECT_VERSION,
            name: safe,
            settings: diffSettings(getDefaults(), settings) || {}
        };
        const webpBlob = await thumbnailBlob(settings);

        const txmHandle = await handle.getFileHandle(safe + '.txm', { create: true });
        const webpHandle = await handle.getFileHandle(safe + '.webp', { create: true });

        const txmText = JSON.stringify(payload, null, 2);

        const txmWrt = await txmHandle.createWritable();
        await txmWrt.write(txmText);
        await txmWrt.close();

        const webpWrt = await webpHandle.createWritable();
        await webpWrt.write(webpBlob);
        await webpWrt.close();

        return { name: safe, txm: safe + '.txm', webp: safe + '.webp' };
    }

    async function listProjects() {
        const handle = await requireProjectDir();
        const names = new Set();
        for await (const entry of handle.values()) {
            if (entry.kind === 'file' && /\.txm$/i.test(entry.name)) {
                names.add(entry.name.replace(/\.txm$/i, ''));
            }
        }
        return Array.from(names).sort();
    }

    async function readProjectThumbnailUrl(name) {
        const handle = await requireProjectDir();
        const safe = sanitizeName(name);
        try {
            const fh = await handle.getFileHandle(safe + '.webp');
            const f = await fh.getFile();
            return URL.createObjectURL(f);
        } catch (_) { return null; }
    }

    async function openProject(name) {
        const handle = await requireProjectDir();
        const safe = sanitizeName(name);
        const fh = await handle.getFileHandle(safe + '.txm');
        const text = await (await fh.getFile()).text();
        let payload;
        try { payload = JSON.parse(text); } catch (_) { throw new Error('Invalid project file.'); }
        if (!payload || typeof payload.settings !== 'object') throw new Error('Unsupported project format.');
        const settings = settingsFromDelta(payload.settings);
        if (window.TextEditor && window.TextEditor.loadPreset) window.TextEditor.loadPreset(settings);
        return settings;
    }

    async function deleteProject(name) {
        const handle = await requireProjectDir();
        const safe = sanitizeName(name);
        await handle.removeEntry(safe + '.txm').catch(function() {});
        await handle.removeEntry(safe + '.webp').catch(function() {});
        return true;
    }

    // Expose API
    window.PresetManager = {
        getAllPresets,
        getPreset,
        createPreset,
        updatePreset,
        deletePreset,
        duplicatePreset,
        exportPreset,
        importPreset,
        loadPresetFromFile,
        getPresetsByCategory,
        searchPresets,
        getCategories,
        getPresetList,
        clearLocalPresets,
        clearImportedPresets,
        getPresetCount,

        loadPreset,
        ensureThumbnail,
        thumbnailDataUrl,
        settingsFromDelta,
        diffSettings,
        pickProjectDirectory,
        saveProject,
        listProjects,
        openProject,
        deleteProject,
        readProjectThumbnailUrl,
        hasProjectDirectory,
        getProjectDirectoryName
    };
})();
