const assert = require('node:assert/strict');

// Minimal browser shims for the browser-only preset-manager module.
global.window = {
    TextEditor: {
        createDefaultSettings: function() {
            return {
                text: 'TEXT',
                mergeGradients: false,
                lineHeight: 1,
                letterSpacing: 0,
                fill: { active: true, alpha: 1, color: '#ffffff', texture: { active: false, src: null } },
                outline: { first: { active: false, width: 0.1 } },
                canvas: { width: 240, height: 600, ratio: 2.5 },
                background: { active: true, fill: { color: { r: 0, g: 0, b: 0 }, alpha: 1 } }
            };
        },
        loadPreset: function() {}
    }
};
global.localStorage = {
    getItem: function() { return null; },
    setItem: function() {},
    removeItem: function() {}
};

require('../js/preset-manager.js');

const PM = global.window.PresetManager;
assert.ok(PM, 'PresetManager should be exposed');

const defaults = global.window.TextEditor.createDefaultSettings();

// 1. No changes -> empty/undefined delta.
const noDelta = PM.diffSettings(defaults, JSON.parse(JSON.stringify(defaults)));
assert.equal(noDelta, undefined);

// 2. Changed primitives, including a flipped false and an explicit "".
const current = JSON.parse(JSON.stringify(defaults));
current.text = 'HELLO';
current.letterSpacing = 0.5;        // 0 -> 0.5
current.mergeGradients = true;      // false -> true
current.canvas.width = 300;         // nested change
current.fill.texture.src = '';      // null -> "" (explicit empty string)
current.fill.color = '#ff0000';
current.outline.first.active = true;

const delta = PM.diffSettings(defaults, current);

assert.ok(delta && typeof delta === 'object');
assert.equal(delta.text, 'HELLO');
assert.equal(delta.mergeGradients, true);
assert.equal(delta.lineHeight, undefined); // unchanged branch pruned
assert.equal(delta.canvas.width, 300);
assert.equal(delta.fill.texture.src, '');
assert.equal(delta.fill.color, '#ff0000');

// 3. Round-trip: settingsFromDelta(diff(base, current)) deep-equals current.
const restored = PM.settingsFromDelta(PM.diffSettings(defaults, current));
assert.deepEqual(restored, current);

console.log('preset delta serialization tests passed');