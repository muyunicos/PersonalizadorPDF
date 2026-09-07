const assert = require('node:assert/strict');

// editor.js is a browser IIFE that only touches window/document inside
// functions; a bare window stub is enough to require it in Node.
global.window = {};

require('../js/editor.js');

const TextEditor = global.window.TextEditor;
assert.ok(TextEditor, 'TextEditor should be exposed');
assert.ok(typeof TextEditor.getTextBlockBox === 'function', 'getTextBlockBox should be exposed for tests');

// A minimal 2D-context stand-in: measureText returns fixed metrics, and
// setTextFont() (called by getTextBlockBox) writes ctx.font / baseline /
// align. A real canvas is not available in Node, so the test asserts the two
// invariants that fixed the "no repeat" pattern box:
//   1. the block is measured with the configured font (ctx.font is changed
//      away from the context default "10px sans-serif"), and
//   2. lineHeight defaults to 1.0 (matching getTextBlockMetrics/autoFitText),
//      not the old 1.2.
function makeFakeCtx() {
    let measureCount = 0;
    const ctx = {
        font: '10px sans-serif', // context default before any draw/font pass
        textBaseline: '',
        textAlign: '',
        get measureCount() { return measureCount; },
        measureText: function(text) {
            measureCount++;
            // Fixed per-char width; ascent/descent mimic a real 'Ag' measure
            return {
                width: text.length * 22,
                actualBoundingBoxAscent: 20,
                actualBoundingBoxDescent: 5
            };
        }
    };
    return ctx;
}

const s = TextEditor.createDefaultSettings();
s.text = 'HELLO';
s.font = { src: 'Bangers', size: 76, weight: 'normal' };
s.letterSpacing = 0;

// Single line, lineHeight undefined (should default to 1.0).
const ctx1 = makeFakeCtx();
const box1 = TextEditor.getTextBlockBox(ctx1, s, ['HELLO'], 76);
assert.ok(ctx1.font.indexOf('76px') !== -1, 'font should be applied before measuring (got ' + ctx1.font + ')');
assert.equal(box1.height, 25, 'single-line height = ascent + descent = 25');
assert.equal(box1.x, -55, 'box centered horizontally: -5 chars * 22 wide / 2');
assert.equal(box1.width, 110, 'box width = 5 chars * 22');

// Multiline: lineHeight default 1.0 -> second line adds exactly 76px more.
// (The old 1.2 default made the height 116 instead of 101.)
const ctx2 = makeFakeCtx();
const box2 = TextEditor.getTextBlockBox(ctx2, s, ['HELLO', 'HELLO'], 76);
assert.equal(box2.height, 25 + 76, 'multiline height uses lineHeight 1.0 (got ' + box2.height + ')');

// Explicit lineHeight is still respected.
s.lineHeight = 1.4;
const ctx3 = makeFakeCtx();
const box3 = TextEditor.getTextBlockBox(ctx3, s, ['HELLO', 'HELLO'], 76);
assert.equal(box3.height, 25 + 76 * 1.4, 'explicit lineHeight respected');

console.log('pattern block-box (no-repeat) regression tests passed');