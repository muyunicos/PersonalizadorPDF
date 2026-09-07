/* Migra los presets base de presets/*.json (formato TextStudio crudo) a
 * presets/*.txm (delta textmuy-project v1, el formato unico desde 3.2.0).
 *
 * Uso (desde modules/textmuy):
 *   node scripts/migrate-presets-to-txm.js           # escribe los .txm
 *   node scripts/migrate-presets-to-txm.js --delete  # ademas borra los .json
 *
 * Las miniaturas .webp de los presets base se generan una vez con
 * scripts/gen-base-thumbnails.html (necesita navegador para renderizar).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// editor.js es un IIFE de navegador; con un stub de window alcanza (como tests/).
global.window = {};
require('../js/editor.js');
const TextEditor = global.window.TextEditor;
assert.ok(TextEditor && TextEditor.createDefaultSettings && TextEditor.loadPreset, 'TextEditor debe exponerse');

// preset-manager reusa diffSettings/settingsFromDelta (mismo formato que savePreset).
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
require('../js/preset-manager.js');
const PM = global.window.PresetManager;
assert.ok(PM && PM.diffSettings && PM.settingsFromDelta, 'PresetManager debe exponerse');

const presetsDir = path.join(__dirname, '..', 'presets');
const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) {
    console.log('No quedan presets .json por migrar.');
    process.exit(0);
}

const borrar = process.argv.includes('--delete');
let ok = 0;
files.forEach(function (file) {
    const name = path.basename(file, '.json');
    const raw = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf8'));
    // raw (TextStudio) -> settings internos -> delta vs defaults (formato .txm).
    const settings = TextEditor.createDefaultSettings();
    TextEditor.loadPreset(raw, settings);
    const payload = {
        format: 'textmuy-project',
        version: 1,
        name: name,
        settings: PM.diffSettings(TextEditor.createDefaultSettings(), settings) || {}
    };
    const destino = path.join(presetsDir, name + '.txm');
    fs.writeFileSync(destino, JSON.stringify(payload, null, 2));
    // Round-trip de sanidad: el delta debe reconstruir settings cargables.
    const restaurados = PM.settingsFromDelta(payload.settings);
    const target = TextEditor.createDefaultSettings();
    TextEditor.loadPreset(restaurados, target);
    ok++;
    console.log('OK ' + name + '.txm (' + fs.statSync(destino).size + ' bytes)');
    if (borrar) fs.unlinkSync(path.join(presetsDir, file));
});

console.log('Migrados ' + ok + ' preset(s) a .txm'
    + (borrar ? ' (los .json fueron borrados).' : '. Corre con --delete para borrar los .json.'));
