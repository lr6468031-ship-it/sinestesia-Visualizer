// Shared intensity control for Plasma Ultra.
(() => {
  'use strict';

  const intensity = document.getElementById('fluidIntensity');
  if (!intensity || typeof fastBeatSignal !== 'function') return;

  const originalFastBeatSignal = fastBeatSignal;

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

  fastBeatSignal = function intensityAwareFastBeatSignal() {
    const signal = originalFastBeatSignal();
    const gain = plasmaGain();
    return {
      bass: signal.bass * gain * 1.18,
      mid: signal.mid * (0.55 + gain * 0.42),
      treble: signal.treble * (0.62 + gain * 0.34),
      energy: signal.energy * gain,
      kick: (signal.kick || 0) * (0.75 + gain * 0.75),
    };
  };

  intensity.addEventListener('input', applyIntensityUI);
  intensity.addEventListener('change', applyIntensityUI);
  applyIntensityUI();
})();
