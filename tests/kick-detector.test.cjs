const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Detector = runInNewContext(readFileSync('plasma-webgl.js', 'utf8').split('(() => {')[0] + '\nKickOnsetDetector');
function run(signal, step = 24, sampleRate = 48000) {
  const detector = new Detector();
  const hits = [];
  for (let t = 0; t < 3000; t += step) {
    const bins = new Float32Array(2048).fill(-120);
    const [hz, db] = signal(t);
    if (hz) bins[Math.round(hz / (sampleRate / 4096))] = db;
    if (detector.update(bins, sampleRate, t)) hits.push(t);
  }
  return hits;
}
test('detects repeated low kicks at different sample rates and frame rates', () => {
  for (const sampleRate of [44100, 48000]) for (const step of [16, 24, 40]) {
    const hits = run(t => [60, t >= 480 && t % 480 < 120 ? -18 - (t % 480) / 8 : -100], step, sampleRate);
    assert.equal(hits.length, 6, `${sampleRate} Hz, ${step} ms: ${hits}`);
  }
});
test('does not repeatedly trigger on sustained bass', () => {
  assert.equal(run(() => [60, -18]).length, 0);
});
test('ignores mid/high percussion and subsonic rumble', () => {
  for (const hz of [10, 220, 1000, 4000]) {
    assert.equal(run(t => [hz, t % 480 < 100 ? -10 : -100]).length, 0);
  }
});
test('ignores silence and very quiet noise', () => {
  assert.equal(run(() => [0, -120]).length, 0);
  assert.equal(run(t => [60, t % 480 < 100 ? -90 : -120]).length, 0);
});
test('reset clears history', () => {
  const d = new Detector(); d.lastHit = 100; d.previous = 1; d.reset();
  assert.equal(d.previous, 0); assert.equal(d.lastHit, -Infinity);
});
