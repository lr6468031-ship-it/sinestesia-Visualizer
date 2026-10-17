const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Motion = runInNewContext(readFileSync('plasma-webgl.js', 'utf8').split('(() => {')[0] + '\nMelodyFlowMotion');
function sequence(interval, dt) {
  const motion = new Motion();
  for (let now = 0; now < 6000; now += dt) motion.update(dt, now, now % interval === 0);
  return motion;
}
test('faster melodic attacks increase motion speed and phase', () => {
  const slow = sequence(600, 20), fast = sequence(200, 20);
  assert.ok(fast.speed > slow.speed * 2.5);
  assert.ok(fast.phase > slow.phase * 2);
});
test('motion is stable across frame rates and phase does not jump on an onset', () => {
  const a = sequence(400, 20), b = sequence(400, 40);
  assert.ok(Math.abs(a.phase - b.phase) / a.phase < 0.04);
  const before = a.phase;
  a.update(0, 6000, true);
  assert.equal(a.phase, before);
});
test('silence fades motion and pause freezes phase without retaining tempo', () => {
  const motion = sequence(200, 20);
  for (let now = 6000; now < 10000; now += 20) motion.update(20, now, false);
  assert.ok(motion.speed < 0.001);
  assert.ok(motion.level < 0.001);
  const before = motion.phase;
  motion.update(40, 10040, false, false);
  assert.equal(motion.phase, before);
  assert.equal(motion.speed, 0);
  assert.equal(motion.interval, null);
  motion.reset();
  assert.equal(motion.phase, 0);
});

test('audible sustained music keeps flowing between detected melodic attacks', () => {
  const motion = new Motion();
  for (let now = 0; now < 6000; now += 20) motion.update(20, now, now === 0, true, 0.5);
  assert.ok(motion.speed > 0.3, 'audible sustained notes must not stall the fluid');
  const before = motion.phase;
  motion.update(20, 6020, false, true, 0.5);
  assert.ok(motion.phase > before);
  for (let now = 6040; now < 12000; now += 20) motion.update(20, now, false, true, 0);
  assert.ok(motion.speed < 0.001, 'real silence should settle the fluid');
});
test('pause freezes flow even while the supplied activity remains high', () => {
  const motion = sequence(200, 20), before = motion.phase;
  motion.update(100, 6100, false, false, 1);
  assert.equal(motion.phase, before);
  assert.equal(motion.speed, 0);
});
