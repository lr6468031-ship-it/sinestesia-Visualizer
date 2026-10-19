(() => {
  'use strict';

  const visualMode = document.getElementById('visualMode');
  const visualOptions = document.querySelector('.visual-options');
  const notice = document.getElementById('visualNotice');
  if (!visualMode || !visualOptions) return;

  const modes = [
    { id: 'classic', label: 'Classic', source: 'Arcoíris', description: 'fluido multicolor equilibrado' },
    { id: 'aurora', label: 'Aurora', source: 'Aurora', description: 'corrientes suaves y luminosas' },
    { id: 'neon', label: 'Neon', source: 'Eléctrico', description: 'brillo intenso y movimiento rápido' },
    { id: 'vortex', label: 'Vortex', source: 'Remolinos', description: 'remolinos fuertes y circulación marcada' },
    { id: 'galaxy', label: 'Galaxy', source: 'Galaxia', description: 'flujo profundo con sensación espacial' },
    { id: 'chaos', label: 'Chaos', source: 'Tormenta', description: 'turbulencia agresiva y cambios rápidos' },
    { id: 'zen', label: 'Zen', source: 'Seda', description: 'movimiento lento, suave y continuo' },
  ];

  const row = document.createElement('label');
  row.id = 'fluidModeQuickPicker';
  row.textContent = 'Modo Fluid ';

  const select = document.createElement('select');
  select.id = 'fluidQuickPreset';
  select.setAttribute('aria-label', 'Modo Fluid');

  for (const mode of modes) {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.label;
    select.append(option);
  }
  row.append(select);

  const style = document.createElement('style');
  style.textContent = `
    #fluidModeQuickPicker{display:flex;align-items:center;gap:8px}
    #fluidModeQuickPicker select{min-width:128px}
    #fluidModeQuickPicker::after{content:'7 modos';font-size:10px;color:#aaa6ba}
  `;
  document.head.append(style);

  const firstLabel = visualOptions.querySelector('label');
  if (firstLabel?.nextSibling) visualOptions.insertBefore(row, firstLabel.nextSibling);
  else visualOptions.append(row);

  function findPresetButton(sourceName) {
    return [...document.querySelectorAll('#fluidStudio .fluid-preset')]
      .find((button) => button.textContent.trim() === sourceName);
  }

  function applySelectedMode() {
    const mode = modes.find((item) => item.id === select.value) || modes[0];

    if (visualMode.value !== 'fluidGas') {
      visualMode.value = 'fluidGas';
      visualMode.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const apply = () => {
      const button = findPresetButton(mode.source);
      if (!button) {
        if (notice) notice.textContent = 'Fluid está cargando sus modos…';
        return false;
      }
      button.click();
      const studio = document.getElementById('fluidStudio');
      if (studio) studio.open = false;
      if (notice) notice.textContent = `Fluid · ${mode.label} · ${mode.description}. Reacciona a la música y al tacto.`;
      return true;
    };

    if (!apply()) requestAnimationFrame(() => { if (!apply()) setTimeout(apply, 120); });
  }

  select.addEventListener('change', applySelectedMode);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#fluidStudio .fluid-preset');
    if (!button) return;
    const match = modes.find((mode) => mode.source === button.textContent.trim());
    if (match) select.value = match.id;
  });

  window.sinestesiaFluidModes = {
    modes: modes.map(({ id, label, source }) => ({ id, label, source })),
    select(id) {
      if (!modes.some((mode) => mode.id === id)) return false;
      select.value = id;
      applySelectedMode();
      return true;
    },
  };
})();
