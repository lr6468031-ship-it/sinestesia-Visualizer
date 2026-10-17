const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Detector = runInNewContext(readFileSync('plasma-webgl.js', 'utf8').split('(() => {')[0] + '\nSnareOnsetDetector');
function run(kind, step = 24, rate = 48000, settings, bodyHz = 200) {
  const d = new Detector(); const hits = [];
  for (let t = 0; t < 3000; t += step) {
    const s = new Float32Array(2048).fill(-120);
    const active = kind === 'sustain' || (t >= 480 && t % 480 < 96);
    if (active) for (let i = 1; i < s.length; i++) {
      const hz = i * rate / 4096;
      if ((kind === 'snare' || kind === 'sustain') && ((hz >= bodyHz * 0.75 && hz <= bodyHz * 1.5) || (hz >= 2000 && hz <= 6000))) s[i] = -35;
      if (kind === 'kick' && hz >= 40 && hz <= 90) s[i] = -15;
      if (kind === 'hat' && hz >= 6000 && hz <= 14000) s[i] = -20;
      if (kind === 'tone' && Math.abs(hz - 220) < rate / 4096) s[i] = -20;
    }
    if (d.update(s, rate, t, settings)) hits.push(t);
  }
  return hits;
}
test('snare body + broadband attack triggers at multiple frame/sample rates', () => {
  for (const rate of [44100, 48000]) for (const step of [16, 24, 40]) assert.equal(run('snare', step, rate).length, 6);
});
test('kick does not trigger snare', () => assert.equal(run('kick').length, 0));
test('hi-hat and tonal body alone do not trigger snare', () => {
  assert.equal(run('hat').length, 0); assert.equal(run('tone').length, 0);
});
test('sustained broadband sound does not retrigger', () => assert.equal(run('sustain').length, 0));

test('moving snare band recovers a snare with a higher body', () => {
  assert.equal(run('snare', 24, 48000, undefined, 800).length, 0);
  assert.equal(run('snare', 24, 48000, { snareHz: 800 }, 800).length, 6);
  assert.equal(run('snare', 24, 48000, { snareHz: 800 }, 200).length, 0);
});
