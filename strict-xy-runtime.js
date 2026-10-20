(() => {
  'use strict';

  const REMOVED_IDS = new Set(['reference:rose', 'reference:duo', 'reference:rings', 'pixels2021']);
  const REMOVED_NAMES = ['roseta fluida', 'doble vórtice', 'doble vortice', 'anillos orbitales'];
  const GATED_MODES = new Set(['plasma', 'fluidGas', 'electricIris']);

  function peakInside(spectrum, sampleRate, lo, hi, level, tolerance) {
    if (!spectrum || !spectrum.length || !Number.isFinite(sampleRate) || !Number.isFinite(level)) return false;
    const binHz = sampleRate / (2 * spectrum.length);
    const lower = Math.max(-100, level - Math.max(5, Math.min(50, Number(tolerance) || 40)));
    const upper = Math.min(0, level + Math.max(5, Math.min(50, Number(tolerance) || 40)));
    const start = Math.max(1, Math.ceil(lo / binHz));
    const end = Math.min(spectrum.length - 1, Math.floor(hi / binHz));
    if (end < start) return false;
    let peak = -Infinity;
    for (let i = start; i <= end; i += 1) peak = Math.max(peak, Number(spectrum[i]));
    return Number.isFinite(peak) && peak >= lower && peak <= upper;
  }

  function strictGateFromSpectrum(spectrum, sampleRate, settings) {
    if (!settings) return { kick:false, snare:false, melody:false, any:false };
    const kickHz = Math.max(30, Math.min(300, Number(settings.kickHz) || 60));
    const snareHz = Math.max(100, Math.min(1500, Number(settings.snareHz) || 200));
    const melodyHz = Math.max(100, Math.min(8000, Number(settings.melodyHz) || 700));
    const melodyWidth = Math.max(0.5, Math.min(4, Number(settings.melodyWidth) || 2));
    const factor = Math.pow(2, melodyWidth / 2);
    const kick = peakInside(spectrum, sampleRate, kickHz * 0.5, kickHz * 1.5, Number(settings.kickLevel), settings.kickTolerance);
    const snare = peakInside(spectrum, sampleRate, snareHz * 0.75, snareHz * 1.5, Number(settings.snareLevel), settings.snareTolerance);
    const melody = peakInside(spectrum, sampleRate, melodyHz / factor, Math.min(sampleRate / 2, melodyHz * factor), Number(settings.melodyLevel), settings.melodyTolerance);
    return { kick, snare, melody, any: kick || snare || melody };
  }

  window.sinestesiaStrictGateFromSpectrum = strictGateFromSpectrum;

  function cleanupDeprecatedModes() {
    const selector = document.getElementById('visualMode');
    if (selector) {
      [...selector.options].forEach(option => {
        const text = (option.textContent || '').trim().toLowerCase();
        if (REMOVED_IDS.has(option.value) || REMOVED_NAMES.some(name => text.includes(name))) option.remove();
      });
      if (REMOVED_IDS.has(selector.value)) {
        selector.value = 'plasma';
        selector.dispatchEvent(new Event('change', { bubbles:true }));
      }
    }

    document.querySelectorAll('.vmg-card, .fluid-preset, button, option').forEach(node => {
      const id = node.dataset?.mode || node.value || '';
      const text = (node.textContent || '').trim().toLowerCase();
      if (REMOVED_IDS.has(id) || REMOVED_NAMES.some(name => text.includes(name))) node.remove();
    });

    const note = document.querySelector('#visualModeGallery .vmg-note');
    if (note && /cinco modos/i.test(note.textContent || '')) {
      note.textContent = 'Los modos de referencia visibles son recreaciones originales basadas en tu video.';
    }
  }

  let spectrum = null;
  function readGate() {
    if (window.sinestesiaAnalysisMode === 'separation') return { kick:true, snare:true, melody:true, any:true, bypass:true };
    const player = document.getElementById('audio');
    if (!player || player.paused || typeof analyser === 'undefined' || !analyser || typeof audioContext === 'undefined' || !audioContext) {
      return { kick:false, snare:false, melody:false, any:false };
    }
    if (!spectrum || spectrum.length !== analyser.frequencyBinCount) spectrum = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(spectrum);
    return strictGateFromSpectrum(spectrum, audioContext.sampleRate, window.sinestesiaDetectionSettings);
  }

  function selectedMode() {
    return document.getElementById('visualMode')?.value || '';
  }

  function enforceVisualGate() {
    const mode = selectedMode();
    const applies = GATED_MODES.has(mode) && window.sinestesiaAnalysisMode !== 'separation';
    const state = applies ? readGate() : { any:true, bypass:true };
    window.sinestesiaGateState = state;
    window.sinestesiaStrictGateOpen = !applies || !!state.any || !!state.bypass;
    // Detection controls musical pulses, not canvas visibility. Each renderer
    // owns its visibility so switching scenes cannot leave a hidden canvas.

    requestAnimationFrame(enforceVisualGate);
  }

  cleanupDeprecatedModes();
  if (document.body) new MutationObserver(cleanupDeprecatedModes).observe(document.body, { childList:true, subtree:true });
  requestAnimationFrame(enforceVisualGate);
})();
