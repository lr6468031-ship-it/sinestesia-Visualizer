// Shared intensity control for Plasma Ultra and Fluido 23.
(() => {
  'use strict';

  const intensity = document.getElementById('fluidIntensity');
  const selector = document.getElementById('visualMode');

  if (!intensity || !selector || typeof fastBeatSignal !== 'function') return;

  const originalFastBeatSignal = fastBeatSignal;

  function plasmaGain() {
    const raw = Number(intensity.value);
    const safe = Number.isFinite(raw) ? raw : 1.35;
    const normalized = (safe - 0.7) / 1.3;
    return Math.max(0.35, Math.min(2.5, 0.35 + normalized * 2.15));
  }

  function applyIntensityUI() {
    // The same slider must remain usable in both visual modes.
    intensity.disabled = false;

    if (selector.value === 'plasma') {
      const gain = plasmaGain();
      const brightness = 0.62 + gain * 0.36;
      const saturation = 0.90 + gain * 0.22;
      canvas.style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`;
    } else {
      canvas.style.filter = '';
    }
  }

  // Plasma Ultra reads the same audio signal as before, but the slider now
  // scales how strongly bass, mids, treble and total energy deform the contour.
  fastBeatSignal = function intensityAwareFastBeatSignal() {
    const signal = originalFastBeatSignal();

    if (window.sinestesiaFluidActive || selector.value !== 'plasma') {
      return signal;
    }

    const gain = plasmaGain();
    return {
      bass: signal.bass * gain,
      mid: signal.mid * (0.55 + gain * 0.45),
      treble: signal.treble * (0.65 + gain * 0.35),
      energy: signal.energy * gain,
    };
  };

  intensity.addEventListener('input', applyIntensityUI);
  intensity.addEventListener('change', applyIntensityUI);
  selector.addEventListener('change', () => requestAnimationFrame(applyIntensityUI));

  applyIntensityUI();
})();
