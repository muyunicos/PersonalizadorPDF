const assert = require('node:assert/strict');
const DistortEngine = require('../js/effects/distort-engine.js');

const straight = DistortEngine.getArcGeometry(240, 60, 0);
assert.equal(straight.curved, false);
assert.equal(straight.width, 240);
assert.equal(straight.height, 60);

const upward = DistortEngine.getArcGeometry(240, 60, 120);
const downward = DistortEngine.getArcGeometry(240, 60, -120);
assert.equal(upward.curved, true);
assert.equal(downward.curved, true);
assert.equal(upward.width, downward.width);
assert.equal(upward.height, downward.height);
assert.equal(upward.centerAngle, -Math.PI / 2);
assert.equal(downward.centerAngle, Math.PI / 2);
assert.equal(upward.direction, 1);
assert.equal(downward.direction, -1);
assert.ok(upward.radius > 60);

const fullArc = DistortEngine.getArcGeometry(240, 60, 360);
assert.equal(fullArc.curved, true);
assert.ok(fullArc.width > 0 && fullArc.height > 0);
assert.ok(fullArc.width < 240 && fullArc.height < 240);

console.log('distort-engine geometry tests passed');
