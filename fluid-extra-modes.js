(() => {
  'use strict';

  const studio = document.getElementById('fluidStudio');
  const visualMode = document.getElementById('visualMode');
  if (!studio || !visualMode) return;

  const extraModes = [
    {
      id: 'apk-neon', label: 'Neón', selectorLabel: 'Fluid · Neón', base: 'Eléctrico',
      description: 'fluido eléctrico brillante, rápido y muy reactivo',
      hue: 0.53, intensity: 1.75,
      settings: { HUE: 0.53, HUE_RANGE: 0.12, CURL: 52, VISCOSITY: 0.04, DENSITY_DISSIPATION: 0.34, SPLAT_RADIUS: 0.10, GRAVITY: 0, TIME_SCALE: 1.55, BLOOM: true, BLOOM_INTENSITY: 1.55, SUNRAYS: true, SHADING: true }
    },
    {
      id: 'apk-vortex', label: 'Vórtice', selectorLabel: 'Fluid · Vórtice', base: 'Remolinos',
      description: 'remolino central fuerte con corrientes circulares',
      hue: 0.74, intensity: 1.60,
      settings: { HUE: 0.74, HUE_RANGE: 0.22, CURL: 60, VISCOSITY: 0.08, DENSITY_DISSIPATION: 0.28, SPLAT_RADIUS: 0.13, GRAVITY: 0, TIME_SCALE: 1.35, BLOOM: true, BLOOM_INTENSITY: 1.30, SUNRAYS: false, SHADING: true }
    }
  ];

  function setControl(key, value) {
    const input = document.getElementById('fluid-setting-' + key);
    if (!input) return;
    if (input.type === 'checkbox') input.checked = !!value;
    else input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findBase(name) {
    return [...studio.querySelectorAll('.fluid-preset:not(.extra-fluid-preset)')]
      .find((button) => button.textContent.trim() === name);
  }

  function selectTopOption(mode) {
    const option = [...visualMode.options].find((item) => item.dataset.extraFluidOption === mode.id);
    if (option) option.selected = true;
  }

  function applyMode(mode, button = null, keepSelectorLabel = false) {
    if (visualMode.value !== 'fluidGas') {
      visualMode.value = 'fluidGas';
      visualMode.dispatchEvent(new Event('change', { bubbles: true }));
    }

    findBase(mode.base)?.click();
    for (const [key, value] of Object.entries(mode.settings)) setControl(key, value);

    const intensity = document.getElementById('fluidIntensity');
    if (intensity) {
      intensity.value = String(mode.intensity);
      intensity.dispatchEvent(new Event('input', { bubbles: true }));
    }

    studio.querySelectorAll('.fluid-preset').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    if (keepSelectorLabel) selectTopOption(mode);

    const status = document.getElementById('fluidStudioStatus');
    if (status) status.textContent = `${mode.label} · ${mode.description}.`;
    const notice = document.getElementById('visualNotice');
    if (notice) notice.textContent = `Fluid · ${mode.label} · ${mode.description}.`;
  }

  function installSelectorOptions() {
    for (const mode of extraModes) {
      if (visualMode.querySelector(`option[data-extra-fluid-option="${mode.id}"]`)) continue;
      const option = document.createElement('option');
      // Keep the renderer on the real Fluid engine while exposing a distinct label.
      option.value = 'fluidGas';
      option.dataset.extraFluidOption = mode.id;
      option.textContent = mode.selectorLabel;
      visualMode.append(option);
    }
  }

  function installGalleryButtons() {
    const gallery = studio.querySelector('.fluid-gallery');
    if (!gallery) return false;

    for (const mode of extraModes) {
      if (gallery.querySelector(`[data-extra-fluid="${mode.id}"]`)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fluid-preset extra-fluid-preset';
      button.dataset.extraFluid = mode.id;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${mode.label}: ${mode.description}`);
      const hue = mode.hue * 360;
      button.style.setProperty('--a', `hsl(${hue},100%,70%)`);
      button.style.setProperty('--b', `hsl(${hue + 90},90%,45%)`);
      button.innerHTML = '<i aria-hidden="true"></i>';
      button.append(document.createTextNode(mode.label));
      button.addEventListener('click', () => applyMode(mode, button, true));
      gallery.append(button);
    }
    return true;
  }

  installSelectorOptions();
  installGalleryButtons();

  visualMode.addEventListener('change', () => {
    const selected = visualMode.options[visualMode.selectedIndex];
    const id = selected?.dataset.extraFluidOption;
    if (!id) return;
    const mode = extraModes.find((item) => item.id === id);
    if (!mode) return;
    const button = studio.querySelector(`[data-extra-fluid="${mode.id}"]`);
    applyMode(mode, button, true);
  });

  window.sinestesiaExtraFluidModes = {
    modes: extraModes.map(({ id, label, description }) => ({ id, label, description })),
    select(id) {
      const mode = extraModes.find((item) => item.id === id);
      if (!mode) return false;
      const button = studio.querySelector(`[data-extra-fluid="${mode.id}"]`);
      applyMode(mode, button, true);
      return true;
    }
  };
})();
