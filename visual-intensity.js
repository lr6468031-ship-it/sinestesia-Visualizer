// Shared intensity control + strict XY gate for Plasma Ultra.
(() => {
  'use strict';

  const intensity = document.getElementById('fluidIntensity');
  if (!intensity || typeof fastBeatSignal !== 'function') return;

  const originalFastBeatSignal = fastBeatSignal;
  let gateSpectrum = null;

  function plasmaGain() {
    const raw = Number(intensity.value);
    const safe = Number.isFinite(raw) ? raw : 1.35;
    const normalized = (safe - 0.7) / 1.3;
    return Math.max(0.35, Math.min(2.8, 0.35 + normalized * 2.45));
  }

  function applyIntensityUI() {
    intensity.disabled = false;
    const gain = plasmaGain();
    const brightness = 0.64 + gain * 0.34;
    const saturation = 0.96 + gain * 0.23;
    canvas.style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`;
  }

  function zeroSignal() {
    return { bass: 0, mid: 0, treble: 0, energy: 0, kick: 0 };
  }

  function gateState() {
    if (window.sinestesiaAnalysisMode === 'separation') {
      return { kick: true, snare: true, melody: true, bypass: true };
    }
    if (typeof analyser === 'undefined' || !analyser || typeof audioContext === 'undefined' || !audioContext || audio.paused) {
      const state = { kick: false, snare: false, melody: false, bypass: false };
      window.sinestesiaGateState = state;
      return state;
    }

    const settings = window.sinestesiaDetectionSettings;
    if (!settings) {
      const state = { kick: false, snare: false, melody: false, bypass: false };
      window.sinestesiaGateState = state;
      return state;
    }

    if (!gateSpectrum || gateSpectrum.length !== analyser.frequencyBinCount) {
      gateSpectrum = new Float32Array(analyser.frequencyBinCount);
    }
    analyser.getFloatFrequencyData(gateSpectrum);

    const sampleRate = audioContext.sampleRate;
    const binHz = sampleRate / (2 * gateSpectrum.length);

    const peakInside = (kind, lo, hi) => {
      const level = Number(settings[`${kind}Level`]);
      if (!Number.isFinite(level)) return false;
      const tolerance = Math.max(5, Math.min(50, Number(settings[`${kind}Tolerance`]) || 40));
      const lower = Math.max(-100, level - tolerance);
      const upper = Math.min(0, level + tolerance);
      const start = Math.max(1, Math.ceil(lo / binHz));
      const end = Math.min(gateSpectrum.length - 1, Math.floor(hi / binHz));
      let peak = -Infinity;
      for (let i = start; i <= end; i += 1) peak = Math.max(peak, gateSpectrum[i]);
      return peak >= lower && peak <= upper;
    };

    const kickHz = Math.max(30, Math.min(300, Number(settings.kickHz) || 60));
    const snareHz = Math.max(100, Math.min(1500, Number(settings.snareHz) || 200));
    const melodyHz = Math.max(100, Math.min(8000, Number(settings.melodyHz) || 700));
    const melodyWidth = Math.max(0.5, Math.min(4, Number(settings.melodyWidth) || 2));
    const factor = Math.pow(2, melodyWidth / 2);

    const state = {
      kick: peakInside('kick', kickHz * 0.5, kickHz * 1.5),
      snare: peakInside('snare', snareHz * 0.75, snareHz * 1.5),
      melody: peakInside('melody', melodyHz / factor, Math.min(sampleRate / 2, melodyHz * factor)),
      bypass: false,
    };
    window.sinestesiaGateState = state;
    return state;
  }

  fastBeatSignal = function strictDetectionFastBeatSignal() {
    const signal = originalFastBeatSignal();
    const gain = plasmaGain();
    const gates = gateState();

    if (gates.bypass) {
      return {
        bass: signal.bass * gain * 1.18,
        mid: signal.mid * (0.55 + gain * 0.42),
        treble: signal.treble * (0.62 + gain * 0.34),
        energy: signal.energy * gain,
        kick: (signal.kick || 0) * (0.75 + gain * 0.75),
      };
    }

    if (!gates.kick && !gates.snare && !gates.melody) return zeroSignal();

    const bass = gates.kick ? signal.bass * gain * 1.18 : 0;
    const kick = gates.kick ? (signal.kick || 0) * (0.75 + gain * 0.75) : 0;
    const mid = gates.melody ? signal.mid * (0.55 + gain * 0.42) : 0;
    const treble = gates.snare ? signal.treble * (0.62 + gain * 0.34) : 0;
    const energy = Math.max(bass, kick, mid, treble);

    return { bass, mid, treble, energy, kick };
  };

  // The renderers have their own idle animation (Fluid AUTO, Iris halo/noise and Plasma shader time).
  // A strict visual shutter guarantees the stage is black until at least one XY gate is valid.
  const selector = document.getElementById('visualMode');
  const base = document.getElementById('visualizer');
  const stage = base?.parentElement;
  let gateMask = null;
  const gatedModes = new Set(['plasma', 'fluidGas', 'pixels2021', 'electricIris']);

  if (stage) {
    gateMask = document.createElement('div');
    gateMask.id = 'xyGateBlackout';
    gateMask.setAttribute('aria-hidden', 'true');
    Object.assign(gateMask.style, {
      position: 'absolute',
      inset: '0',
      background: '#000',
      zIndex: '99',
      pointerEvents: 'none',
      display: 'none',
    });
    stage.appendChild(gateMask);
  }

  function syncGateMask() {
    if (gateMask) {
      const mode = selector?.value || '';
      const applies = gatedModes.has(mode) && window.sinestesiaAnalysisMode !== 'separation';
      const gates = applies ? gateState() : { kick: true, snare: true, melody: true, bypass: true };
      const open = !!(gates.bypass || gates.kick || gates.snare || gates.melody);
      gateMask.style.display = applies && !open ? 'block' : 'none';
    }
    requestAnimationFrame(syncGateMask);
  }

  intensity.addEventListener('input', applyIntensityUI);
  intensity.addEventListener('change', applyIntensityUI);
  applyIntensityUI();
  syncGateMask();
})();
