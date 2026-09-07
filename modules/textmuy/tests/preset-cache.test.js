const assert = require('node:assert/strict');

// Shims minimos para cargar js/api.js en Node (IIFE de navegador).
let fetchCalls = 0;
global.window = {};
global.localStorage = { getItem: function() { return null; }, setItem: function() {} };
global.document = { fonts: null };
global.fetch = function() {
    fetchCalls++;
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ n: fetchCalls }); } });
};

require('../js/api.js');
const API = global.window.TextMuyAPI;
assert.ok(API, 'TextMuyAPI should be exposed');
assert.strictEqual(typeof API.renderBatch, 'function', 'renderBatch should be exposed');
assert.strictEqual(typeof API.clearPresetCache, 'function', 'clearPresetCache should be exposed');

(async function() {
    // 1. Mismo preset -> misma promesa cacheada y 1 solo fetch.
    const p1 = API.loadPresetByName('neon-glow');
    const p2 = API.loadPresetByName('neon-glow');
    assert.strictEqual(p1, p2, 'same preset must return the cached promise');
    const v1 = await p1;
    const v2 = await p2;
    assert.deepStrictEqual(v1, v2);
    assert.equal(fetchCalls, 1, 'only one fetch for repeated loads');

    // 2. Otro preset -> otro fetch.
    await API.loadPresetByName('gold-metallic');
    assert.equal(fetchCalls, 2);

    // 3. clearPresetCache -> el proximo load vuelve a fetchear.
    API.clearPresetCache();
    await API.loadPresetByName('neon-glow');
    assert.equal(fetchCalls, 3, 'cleared cache must refetch');

    // 4. Un fallo NO queda cacheado: el retry reevalua (localStorage vacio -> fetch).
    let existe = false;
    global.fetch = function() {
        if (!existe) return Promise.resolve({ ok: false, json: function() { return Promise.resolve({}); } });
        return Promise.resolve({ ok: true, json: function() { return Promise.resolve({ retry: true }); } });
    };
    const falla = API.loadPresetByName('fallback-test');
    await assert.rejects(falla, /Preset not found/);
    existe = true;
    const reintentado = await API.loadPresetByName('fallback-test');
    assert.ok(reintentado.retry, 'a failed load must not stay cached');

    console.log('preset cache tests passed');
})().catch(function(e) { console.error(e.message); process.exit(1); });