(() => {
  'use strict';
  // Legacy filename and API retained for saved integrations. These modes now
  // select genuine particle simulations; Fluid keeps its native fluid gallery.
  const selector = document.getElementById('visualMode');
  if (!selector) return;
  const modes = [
    ['splat', 'Splat', 'explosiones cromáticas y gotas balísticas'],
    ['reactor', 'Reactor', 'núcleo y órbitas magnéticas'],
    ['toxic', 'Toxic', 'esporas en corrientes turbulentas'],
    ['galaxy', 'Galaxy+', 'brazos espirales en profundidad'],
    ['warp', 'Warp', 'estrellas en perspectiva'],
    ['chroma', 'Chroma', 'trenzas cromáticas'],
    ['glow', 'Glow', 'enjambre de luces y halos'],
  ].map(([key, label, description]) => ({ key, id: `apk-${key}`, label, description }));

  function select(id) {
    const mode = modes.find(m => m.id === id || m.key === id);
    if (!mode || !window.sinestesiaParticlesEngine) return false;
    window.sinestesiaParticlesEngine.select(mode.key);
    return true;
  }
  window.sinestesiaParticlesFluidModes = { modes, select };

  // The particle engine loads after the common gallery has been created.
  window.addEventListener('load', () => {
    const grid = document.getElementById('vmgGrid');
    if (!grid) return;
    for (const [index, mode] of modes.entries()) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'vmg-card';
      button.dataset.mode = `particles:${mode.key}`;
      button.setAttribute('aria-pressed', String(selector.value === button.dataset.mode));
      button.style.setProperty('--h', String(index * 47));
      const title = document.createElement('strong'); title.textContent = mode.label;
      const description = document.createElement('small'); description.textContent = mode.description;
      button.append(title, description);
      button.addEventListener('click', () => select(mode.id)); grid.append(button);
    }
  }, { once: true });
})();
