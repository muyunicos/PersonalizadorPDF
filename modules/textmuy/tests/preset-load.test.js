const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// editor.js and preset-manager.js are browser IIFEs that only touch
// window/document/localStorage inside functions; bare stubs are enough.
global.window = {};

require('../js/editor.js');
global.localStorage = {
    getItem: function() { return null; },
    setItem: function() {},
    removeItem: function() {}
};
require('../js/preset-manager.js');

const TextEditor = global.window.TextEditor;
const PM = global.window.PresetManager;
assert.ok(TextEditor, 'TextEditor should be exposed');
assert.ok(typeof TextEditor.loadPreset === 'function', 'TextEditor.loadPreset should exist');
assert.ok(PM && PM.settingsFromDelta, 'PresetManager.settingsFromDelta should exist');

// 1. Every bundled preset (.txm delta, the only format since 3.2.0) must load:
//    delta -> full settings -> loadPreset() without throwing.
const presetsDir = path.join(__dirname, '..', 'presets');
const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.txm')).sort();
assert.ok(files.length >= 9, 'expected the bundled presets to be present');

files.forEach(function(file) {
    const payload = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf8'));
    assert.equal(payload.format, 'textmuy-project', file + ' must use the .txm format');
    const settings = PM.settingsFromDelta(payload.settings);
    const target = TextEditor.createDefaultSettings();
    const result = TextEditor.loadPreset(JSON.parse(JSON.stringify(settings)), target);
    assert.ok(result, file + ' should load into a target settings object');
});

// 2. A "saved preset" (the editor's own internal settings, as stored by
//    PresetManager.createPreset(name, editor.getSettings())) must load too.
//    loadPreset normalizes {r,g,b} colors to hex strings, so assert the
//    normalized round-trip rather than strict object identity.
const saved = JSON.parse(JSON.stringify(TextEditor.getSettings()));
saved.depth.active = true;
saved.depth.fill.color = '#123456';
const savedTarget = TextEditor.createDefaultSettings();
TextEditor.loadPreset(saved, savedTarget);
assert.equal(savedTarget.depth.active, true, 'saved depth.active should round-trip');
assert.equal(savedTarget.depth.fill.color, '#123456', 'saved depth fill color should round-trip');

// 3. The legacy lettering.boggle field must migrate into lettering.flag
//    (flag now exists in defaultSettings, so the migration path cannot throw).
const legacyTarget = TextEditor.createDefaultSettings();
TextEditor.loadPreset({ lettering: { boggle: { active: 1, angle: 20, amplitude: 0.3 } } }, legacyTarget);
assert.equal(legacyTarget.lettering.flag.active, true, 'legacy boggle should activate flag');
assert.equal(legacyTarget.lettering.flag.tilt, 20, 'legacy boggle angle -> flag tilt');
assert.equal(legacyTarget.lettering.flag.rise, 30, 'legacy ratio amplitude 0.3 -> rise 30%');
assert.equal(legacyTarget.lettering.flag.waveWidth, 100, 'legacy migration keeps waveWidth default');
assert.equal(legacyTarget.lettering.flag.waveShift, 0, 'legacy migration keeps waveShift default');
assert.equal(legacyTarget.lettering.flag.shape, 'smooth', 'legacy migration keeps shape default');
assert.equal(legacyTarget.lettering.flag.tiltMode, 'wave', 'legacy migration keeps tiltMode default');

// 4. Flag v2 keys (tilt/rise/waveWidth/waveShift/shape) round-trip through
//    loadPreset, and old flag.angle/amplitude migrate onto tilt/rise.
const v2Target = TextEditor.createDefaultSettings();
TextEditor.loadPreset({ lettering: { flag: { active: 1, tilt: -25, rise: 40, waveWidth: 55, waveShift: 12, shape: 'linear', tiltMode: 'position' } } }, v2Target);
assert.equal(v2Target.lettering.flag.tilt, -25, 'tilt round-trip');
assert.equal(v2Target.lettering.flag.rise, 40, 'rise round-trip');
assert.equal(v2Target.lettering.flag.waveWidth, 55, 'waveWidth round-trip');
assert.equal(v2Target.lettering.flag.waveShift, 12, 'waveShift round-trip');
assert.equal(v2Target.lettering.flag.shape, 'linear', 'shape round-trip');
assert.equal(v2Target.lettering.flag.tiltMode, 'position', 'tiltMode round-trip');

const oldFlagTarget = TextEditor.createDefaultSettings();
TextEditor.loadPreset({ lettering: { flag: { active: 1, angle: 30, amplitude: 15 } } }, oldFlagTarget);
assert.equal(oldFlagTarget.lettering.flag.tilt, 30, 'flag.angle -> flag.tilt');
assert.equal(oldFlagTarget.lettering.flag.rise, 15, 'flag.amplitude -> flag.rise');
assert.equal(oldFlagTarget.lettering.flag.shape, 'smooth', 'missing shape -> default smooth');

// 5. Boggle keys match its UI labels; legacy angle/amplitude are accepted.
const boggleTarget = TextEditor.createDefaultSettings();
TextEditor.loadPreset({ lettering: { flag: { active: 1 }, boggle: { active: 1, angle: 25, amplitude: 60 } } }, boggleTarget);
assert.equal(boggleTarget.lettering.boggle.maxRotation, 25, 'boggle.angle -> boggle.maxRotation');
assert.equal(boggleTarget.lettering.boggle.scatterHeight, 60, 'boggle.amplitude -> boggle.scatterHeight');

// 6. Neutral defaults: with untouched controls the flag must not change the
//    text at all — tilt/rise default to 0 (identity transform) and loading a
//    preset that only switches the flag on keeps them neutral.
const neutralTarget = TextEditor.createDefaultSettings();
assert.equal(neutralTarget.lettering.flag.tilt, 0, 'default tilt is neutral (0)');
assert.equal(neutralTarget.lettering.flag.rise, 0, 'default rise is neutral (0)');
TextEditor.loadPreset({ lettering: { flag: { active: 1 } } }, neutralTarget);
assert.equal(neutralTarget.lettering.flag.active, true, 'flag switches on');
assert.equal(neutralTarget.lettering.flag.tilt, 0, 'activation keeps neutral tilt');
assert.equal(neutralTarget.lettering.flag.rise, 0, 'activation keeps neutral rise');

console.log('preset load tests passed (' + files.length + ' bundled presets)');