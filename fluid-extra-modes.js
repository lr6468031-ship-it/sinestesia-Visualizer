(() => {
  'use strict';

  const studio = document.getElementById('fluidStudio');
  const visualMode = document.getElementById('visualMode');
  if (!studio || !visualMode) return;

  const extraModes = [
    {
      id: 'apk-neon', label: 'Neón', base: 'Eléctrico',
      description: 'fluido eléctrico brillante, rápido y muy reactivo',
      hue: 0.53, intensity: 1.75,
      settings: { HUE: 0.53, HUE_RANGE: 0.12, CURL: 52, VISCOSITY: 0.04, DENSITY_DISSIPATION: 0.34, SPLAT_RADIUS: 0.10, GRAVITY: 0, TIME_SCALE: 1.55, BLOOM: true, BLOOM_INTENSITY: 1.55, SUNRAYS: true, SHADING: true }
    },
    {
      id: 'apk-vortex', label: 'Vórtice', base: 'Remolinos',
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
  }

  function findBase(name) {
    return [...studio.querySelectorAll('.fluid-preset')].find((button) => button.textContent.trim() === name);
  }

  function applyMode(mode, button) {
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
    document.querySelectorAll('.apk-fluid-preset').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const status = document.getElementById('fluidStudioStatus');
    if (status) status.textContent = `${mode.label} · ${mode.description}.`;
    const notice = document.getElementById('visualNotice');
    if (notice) notice.textContent = `Fluid · ${mode.label} · ${mode.description}.`;
  }

  function install() {
    const grid = document.querySelector('.particles-fluid-grid');
    if (!grid) return false;
    for (const mode of extraModes) {
      if (grid.querySelector(`[data-extra-fluid="${mode.id}"]`)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'apk-fluid-preset';
      button.dataset.extraFluid = mode.id;
      button.textContent = mode.label;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${mode.label}: ${mode.description}`);
      const hue = mode.hue * 360;
      button.style.setProperty('--a', `hsl(${hue},100%,67%)`);
      button.style.setProperty('--b', `hsl(${hue + 90},95%,48%)`);
      button.addEventListener('click', () => applyMode(mode, button));
      grid.append(button);
    }
    const title = document.querySelector('.particles-fluid-title strong');
    if (title) title.textContent = 'Particles APK · modos Fluid recreados';
    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      if (install() || ++tries > 40) clearInterval(timer);
    }, 50);
  }
})();
