const assert = require('node:assert/strict');

// editor.js is a browser IIFE that only touches window/document inside
// functions; a bare window stub is enough to require it in Node.
global.window = {};

require('../js/editor.js');

const TextEditor = global.window.TextEditor;
const wave = TextEditor.flagWaveAt;
assert.ok(typeof wave === 'function', 'flagWaveAt should be exposed on TextEditor');

function approx(actual, expected, msg) {
    assert.ok(
        Math.abs(actual - expected) < 1e-9,
        msg + ' (got ' + actual + ', expected ' + expected + ')'
    );
}

// 1. Linear shape at 100% width over 6 letters: +1, .6, .2, -.2, -.6, -1.
//    With a 5 degree tilt that is exactly 5, 3, 1, -1, -3, -5 degrees.
const linear = [];
for (let i = 0; i < 6; i++) linear.push(wave(i, 6, 100, 0, 'linear'));
approx(linear[0], 1, 'linear first letter at +1');
approx(linear[1], 0.6, 'linear ramp step 1');
approx(linear[2], 0.2, 'linear ramp step 2');
approx(linear[5], -1, 'linear last letter at -1');

// 2. Smooth shape at 100% width: monotonic sweep from +1 to -1.
const smooth = [];
for (let i = 0; i < 6; i++) smooth.push(wave(i, 6, 100, 0, 'smooth'));
approx(smooth[0], 1, 'smooth first letter at +1');
approx(smooth[5], -1, 'smooth last letter at -1');
for (let i = 1; i < 6; i++) {
    assert.ok(smooth[i] < smooth[i - 1], 'smooth wave must decrease monotonically at index ' + i);
}

// 3. Minimum width (1%) alternates letter by letter: +1, -1, +1, -1, ...
for (let i = 0; i < 6; i++) {
    approx(wave(i, 6, 1, 0, 'smooth'), i % 2 === 0 ? 1 : -1, 'minimum width alternates (smooth) at index ' + i);
    approx(wave(i, 6, 1, 0, 'linear'), i % 2 === 0 ? 1 : -1, 'minimum width alternates (linear) at index ' + i);
}

// 4. Shift 50% at 100% width slides the pattern so the valley sits in the
//    middle of the text (starts/ends at the zero crossing).
const shifted = [];
for (let i = 0; i < 6; i++) shifted.push(wave(i, 6, 100, 50, 'smooth'));
approx(shifted[0], 0, 'shift 50% starts at zero crossing');
approx(shifted[2], Math.cos(Math.PI * 0.9), 'shift 50% valley near the middle');
approx(shifted[5], 0, 'shift 50% ends at zero crossing');

// 5. Single-letter lines still sample the wave (waveWidth clamps to >= 1).
approx(wave(0, 1, 100, 0, 'smooth'), 1, 'single letter at shift 0 stays at +1');

// 6. Invalid/missing shape falls back to smooth.
approx(wave(2, 6, 100, 0, 'nonsense'), wave(2, 6, 100, 0, 'smooth'), 'invalid shape -> smooth');
approx(wave(2, 6, 100, 0, undefined), wave(2, 6, 100, 0, 'smooth'), 'missing shape -> smooth');

// 7. Out-of-range width/shift are clamped.
approx(wave(0, 6, 500, 0, 'smooth'), 1, 'waveWidth clamped to 100');
approx(wave(0, 6, -10, 0, 'smooth'), 1, 'waveWidth clamped to >= 1');
approx(wave(0, 6, 100, 250, 'smooth'), -1, 'waveShift clamped to 100 -> inverted start');

// ===== Tilt "follow wave" slopes =====
const slopes = TextEditor.flagWaveSlopes;
assert.ok(typeof slopes === 'function', 'flagWaveSlopes should be exposed on TextEditor');

// 8. Wide wave (100% width, 6 smooth letters): letters lean into the
//    movement — maximum lean mid-travel, nearly vertical at the crest and
//    trough. Normalized slopes: .309, .809, 1, .809, .309, -.309.
const wide = slopes(6, 100, 0, 'smooth');
approx(wide[2], 1, 'steepest letter (mid-travel) leans at full tilt');
approx(wide[1], Math.cos(Math.PI / 5), 'approaching the trough leans at ~81%');
approx(wide[0], Math.cos(2 * Math.PI / 5), 'crest letter leans only ~31%');
approx(wide[4], Math.cos(2 * Math.PI / 5), 'trough-adjacent letter leans ~31%');
approx(wide[5], -Math.cos(2 * Math.PI / 5), 'last letter follows the wave continuing beyond the text');
assert.ok(wide[0] > 0 && wide[5] < 0, 'descending -> leans downhill, rising section -> leans the other way');

// 9. Minimum width (1%): the travel between adjacent letters is maximal and
//    alternates, so letters keep the even/odd zigzag tilt (±full tilt).
for (const shape of ['smooth', 'linear']) {
    const zigzag = slopes(6, 1, 0, shape);
    for (let i = 0; i < 6; i++) {
        approx(zigzag[i], i % 2 === 0 ? 1 : -1, 'alternating even/odd lean (' + shape + ') at index ' + i);
    }
}

// 10. Property sweep: slopes are always finite and within [-1, 1].
for (const n of [1, 2, 3, 5, 8, 13]) {
    for (const width of [1, 7, 33, 100]) {
        for (const shift of [0, 50, 100]) {
            for (const shape of ['smooth', 'linear']) {
                slopes(n, width, shift, shape).forEach(function(v, i) {
                    assert.ok(Number.isFinite(v), 'slope must be finite (n=' + n + ' width=' + width + ' shift=' + shift + ' ' + shape + ')');
                    assert.ok(Math.abs(v) <= 1 + 1e-9, 'slope must stay in [-1,1] (n=' + n + ' width=' + width + ' shift=' + shift + ' ' + shape + ')');
                });
            }
        }
    }
}

// 11. Single-letter lines still sample a full swing (the wave continues
//     beyond the text), so the lone letter leans at full tilt.
approx(slopes(1, 100, 0, 'smooth')[0], 1, 'single letter leans at full tilt');

console.log('flag wave tests passed');
