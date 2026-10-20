const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('closed audio gates leave scene visibility and transport controls to their owners', () => {
  let frame;
  const player = { paused: true };
  const selector = { value: 'fluidGas', options: [] };
  // Any attempt to access or hide scene elements is a regression: detection
  // must only publish its signal state, never hide the scene or its controls.
  const document = {
    body: {},
    getElementById(id) {
      if (id === 'audio') return player;
      if (id === 'visualMode') return selector;
      throw new Error(`Detection accessed scene element: ${id}`);
    },
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const window = { sinestesiaAnalysisMode: 'spectrum' };
  const context = {
    window, document,
    MutationObserver: class { observe() {} },
    requestAnimationFrame: callback => { frame = callback; },
    analyser: { frequencyBinCount: 512, getFloatFrequencyData: data => data.fill(-Infinity) },
    audioContext: { sampleRate: 44100 },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../strict-xy-runtime.js'), 'utf8'), context);
  frame();
  assert.equal(window.sinestesiaStrictGateOpen, false);
  player.paused = false;
  frame();
  assert.equal(window.sinestesiaStrictGateOpen, false);
  selector.value = 'lagrangian:currents';
  frame();
  assert.equal(window.sinestesiaStrictGateOpen, true);
  selector.value = 'fluidGas';
  window.sinestesiaAnalysisMode = 'separation';
  frame();
  assert.equal(window.sinestesiaStrictGateOpen, true);
});
