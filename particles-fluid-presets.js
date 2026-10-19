(() => {
  'use strict';

  const visualMode = document.getElementById('visualMode');
  const studio = document.getElementById('fluidStudio');
  const gallery = studio?.querySelector('.fluid-gallery');
  if (!visualMode || !studio || !gallery) return;

  // These are clean-room recreations built on Sinestesia's existing fluid solver.
  // The names come from the user's reference APK, but no proprietary shader/code
  // from that binary is copied here.
  const modes = [
    {
      id: 'apk-splat', label: 'Splat', base: 'Plasma',
      description: 'golpes compactos que se abren con el ritmo',
      settings: { HUE: -1, HUE_RANGE: 1, CURL: 28, VISCOSITY: 0.15, DENSITY_DISSIPATION: 0.45, SPLAT_RADIUS: 0.18, GRAVITY: 0, TIME_SCALE: 1.15, BLOOM: true, BLOOM_INTENSITY: 0.95, SUNRAYS: false, SHADING: true },
      intensity: 1.55,
    },
    {
      id: 'apk-reactor', label: 'Reactor', base: 'Eléctrico',
      description: 'núcleo caliente, turbulencia rápida y brillo fuerte',
      settings: { HUE: 0.01, HUE_RANGE: 0.12, CURL: 60, VISCOSITY: 0.05, DENSITY_DISSIPATION: 0.35, SPLAT_RADIUS: 0.12, GRAVITY: -0.15, TIME_SCALE: 1.45, BLOOM: true, BLOOM_INTENSITY: 1.45, SUNRAYS: true, SHADING: true },
      intensity: 1.75,
    },
    {
      id: 'apk-toxic', label: 'Toxic', base: 'Esmeralda',
      description: 'fluido verde ácido, denso y ondulante',
      settings: { HUE: 0.27, HUE_RANGE: 0.11, CURL: 44, VISCOSITY: 0.35, DENSITY_DISSIPATION: 0.65, SPLAT_RADIUS: 0.20, GRAVITY: 0.08, TIME_SCALE: 0.95, BLOOM: true, BLOOM_INTENSITY: 1.15, SUNRAYS: false, SHADING: true },
      intensity: 1.45,
    },
    {
      id: 'apk-galaxy', label: 'Galaxy+', base: 'Galaxia',
      description: 'nubes violetas y azules con remolinos profundos',
      settings: { HUE: 0.65, HUE_RANGE: 0.28, CURL: 50, VISCOSITY: 0.08, DENSITY_DISSIPATION: 0.30, SPLAT_RADIUS: 0.14, GRAVITY: 0, TIME_SCALE: 1.25, BLOOM: true, BLOOM_INTENSITY: 1.30, SUNRAYS: true, SHADING: true },
      intensity: 1.55,
    },
    {
      id: 'apk-warp', label: 'Warp', base: 'Remolinos',
      description: 'corrientes veloces, finas y muy retorcidas',
      settings: { HUE: 0.82, HUE_RANGE: 0.46, CURL: 60, VISCOSITY: 0, DENSITY_DISSIPATION: 0.25, SPLAT_RADIUS: 0.08, GRAVITY: 0, TIME_SCALE: 1.75, BLOOM: true, BLOOM_INTENSITY: 1.20, SUNRAYS: false, SHADING: true },
      intensity: 1.70,
    },
    {
      id: 'apk-chroma', label: 'Chroma', base: 'Arcoíris',
      description: 'mezcla multicolor viva y reactiva a la música',
      settings: { HUE: -1, HUE_RANGE: 1, CURL: 36, VISCOSITY: 0.10, DENSITY_DISSIPATION: 0.45, SPLAT_RADIUS: 0.16, GRAVITY: 0, TIME_SCALE: 1.20, BLOOM: true, BLOOM_INTENSITY: 1.05, SUNRAYS: false, SHADING: true },
      intensity: 1.60,
    },
    {
      id: 'apk-glow', label: 'Glow', base: 'Aurora',
      description: 'formas suaves con halo luminoso persistente',
      settings: { HUE: 0.54, HUE_RANGE: 0.16, CURL: 24, VISCOSITY: 1.10, DENSITY_DISSIPATION: 0.80, SPLAT_RADIUS: 0.30, GRAVITY: 0, TIME_SCALE: 0.68, BLOOM: true, BLOOM_INTENSITY: 1.80, SUNRAYS: true, SHADING: true },
      intensity: 1.35,
    },
  ];

  const section = document.createElement('section');
  section.className = 'particles-fluid-modes';
  section.innerHTML = '<div class="particles-fluid-title"><strong>Particles · modos recreados</strong><small>Basados en la referencia APK, usando el motor Fluid de Sinestesia.</small></div><div class="particles-fluid-grid" role="group" aria-label="Modos recreados de Particles"></div>';
  gallery.insertAdjacentElement('afterend', section);

  const style = document.createElement('style');
  style.textContent = `
    .particles-fluid-modes{margin:10px 0 22px;padding:14px;border:1px solid #2f2c38;border-radius:16px;background:#08080d}
    .particles-fluid-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;margin-bottom:12px}
    .particles-fluid-title strong{font-size:13px;color:#f1e9ff}.particles-fluid-title small{font-size:10px;color:#918ba0}
    .particles-fluid-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .apk-fluid-preset{min-height:54px;border:1px solid #393442;border-radius:12px;background:linear-gradient(145deg,#17131e,#0c0b10);color:#ddd;font-size:11px;padding:8px 5px;cursor:pointer}
    .apk-fluid-preset::before{content:'';display:block;width:20px;height:20px;margin:0 auto 5px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 3%,var(--a) 20%,var(--b) 55%,#050509 72%);box-shadow:0 0 12px var(--a)}
    .apk-fluid-preset[aria-pressed=true]{border-color:var(--a);background:#241a2d;box-shadow:inset 0 0 14px #000,0 0 12px color-mix(in srgb,var(--a) 35%,transparent)}
    @media(min-width:700px){.particles-fluid-grid{grid-template-columns:repeat(7,1fr)}}
    #fluidModeQuickPicker::after{content:'14 modos'}
  `;
  document.head.append(style);

  const grid = section.querySelector('.particles-fluid-grid');
  const buttons = new Map();
  const hueForPreview = (value, index) => value < 0 ? index * 47 : value * 360;

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

  function markActive(id) {
    for (const [modeId, button] of buttons) button.setAttribute('aria-pressed', String(modeId === id));
  }

  function applyMode(mode) {
    if (visualMode.value !== 'fluidGas') {
      visualMode.value = 'fluidGas';
      visualMode.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Reuse a native preset only to clear/seed the field safely, then replace
    // its simulation parameters with this mode's own values.
    findBase(mode.base)?.click();
    for (const [key, value] of Object.entries(mode.settings)) setControl(key, value);

    const intensity = document.getElementById('fluidIntensity');
    if (intensity) {
      intensity.value = String(mode.intensity);
      intensity.dispatchEvent(new Event('input', { bubbles: true }));
    }

    markActive(mode.id);
    const quick = document.getElementById('fluidQuickPreset');
    if (quick?.querySelector(`option[value="${mode.id}"]`)) quick.value = mode.id;

    const status = document.getElementById('fluidStudioStatus');
    if (status) status.textContent = `${mode.label} · ${mode.description}. Reacciona a la música y al tacto.`;
    const notice = document.getElementById('visualNotice');
    if (notice) notice.textContent = `Fluid · ${mode.label} · ${mode.description}.`;
  }

  modes.forEach((mode, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'apk-fluid-preset';
    button.textContent = mode.label;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${mode.label}: ${mode.description}`);
    const hue = hueForPreview(mode.settings.HUE, index);
    button.style.setProperty('--a', `hsl(${hue},100%,67%)`);
    button.style.setProperty('--b', `hsl(${hue + 90},95%,48%)`);
    button.addEventListener('click', () => applyMode(mode));
    buttons.set(mode.id, button);
    grid.append(button);
  });

  const quick = document.getElementById('fluidQuickPreset');
  if (quick) {
    for (const mode of modes) {
      const option = document.createElement('option');
      option.value = mode.id;
      option.textContent = mode.label;
      quick.append(option);
    }
    quick.addEventListener('change', (event) => {
      const mode = modes.find((item) => item.id === quick.value);
      if (!mode) return;
      // fluid-mode-gallery.js only knows its original seven values.
      // Stop that handler for our values and route to our preset instead.
      event.stopImmediatePropagation();
      applyMode(mode);
    }, true);
  }

  // If a native preset is picked afterwards, clear the Particles selection.
  studio.addEventListener('click', (event) => {
    if (event.target.closest?.('.fluid-preset')) markActive('');
  });

  window.sinestesiaParticlesFluidModes = {
    modes: modes.map(({ id, label, description }) => ({ id, label, description })),
    select(id) {
      const mode = modes.find((item) => item.id === id);
      if (!mode) return false;
      applyMode(mode);
      return true;
    },
  };
})();
