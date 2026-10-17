const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Detector = runInNewContext(readFileSync('plasma-webgl.js', 'utf8').split('(() => {')[0] + '\nMelodyOnsetDetector');
function run(kind, settings = {}, step = 24, rate = 48000) {
  const d = new Detector(); let hits = 0;
  for (let t = 0; t < 3000; t += step) {
    const s = new Float32Array(2048).fill(-120);
    const active = kind === 'sustain' || kind === 'legato' || (t >= 480 && t % 480 < 120);
    if (active) {
      const hz = kind === 'offband' ? 3000 : kind === 'kick' ? 60 : kind === 'legato' ? (Math.floor(t / 480) % 2 ? 660 : 440) : 440;
      if (kind === 'noise') for (let i = 1; i < s.length; i++) s[i] = -35;
      else {
        s[Math.round(hz / (rate / 4096))] = -22;
        s[Math.round(hz * 2 / (rate / 4096))] = -30;
      }
    }
    if (d.update(s, rate, t, settings)) hits++;
  }
  return hits;
}
test('tonal note attacks produce mini pulses at multiple frame/sample rates', () => {
  for (const rate of [44100, 48000]) for (const step of [16, 24, 40]) assert.equal(run('notes', {}, step, rate), 6);
});
test('legato pitch changes trigger without needing silence', () => assert.equal(run('legato'), 6));
test('sustained note, broadband percussion and low kicks do not retrigger', () => {
  for (const kind of ['sustain', 'noise', 'kick']) assert.equal(run(kind), 0, kind);
});
test('moving M recovers notes outside default band', () => {
  assert.equal(run('offband'), 0);
  assert.equal(run('offband', { melodyHz: 3000 }), 6);
});
test('range width determines which notes are detected', () => {
  assert.equal(run('notes', { melodyHz: 700, melodyWidth: 0.5 }), 0);
  assert.equal(run('notes', { melodyHz: 700, melodyWidth: 2 }), 6);
});
