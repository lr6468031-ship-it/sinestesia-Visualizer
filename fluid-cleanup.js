(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  if (!selector) return;

  const removedModes = new Set([
    'pixels2021',
    'reference:rose',
    'reference:duo',
    'reference:rings',
  ]);

  const topPicker = selector.closest('label');
  if (topPicker) {
    topPicker.hidden = true;
    topPicker.style.display = 'none';
    topPicker.setAttribute('aria-hidden', 'true');
  }

  function cleanupSelector() {
    for (const option of [...selector.options]) {
      if (removedModes.has(option.value)) option.remove();
    }

    if (removedModes.has(selector.value)) {
      selector.value = 'plasma';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function clearExtraGalleryPressed(except = '') {
    document.querySelectorAll('.vmg-card[data-extra-main-gallery="true"]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === except));
    });
  }

  function installExtraGalleryCards() {
    const grid = document.getElementById('vmgGrid');
    if (!grid) return;

    const extras = [
      {
        id: 'apk-neon',
        name: 'Neón',
        desc: 'fluido eléctrico brillante',
        hue: 191,
      },
      {
        id: 'apk-vortex',
        name: 'Vórtice',
        desc: 'remolino central fuerte',
        hue: 266,
      },
    ];

    for (const mode of extras) {
      if (grid.querySelector(`[data-mode="${mode.id}"]`)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vmg-card';
      button.dataset.mode = mode.id;
      button.dataset.extraMainGallery = 'true';
      button.style.setProperty('--h', mode.hue);
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<strong>${mode.name}</strong><small>${mode.desc}</small>`;
      button.addEventListener('click', () => {
        const selected = window.sinestesiaExtraFluidModes?.select?.(mode.id);
        if (!selected) {
          selector.value = 'fluidGas';
          selector.dispatchEvent(new Event('change', { bubbles: true }));
        }
        clearExtraGalleryPressed(mode.id);
        document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      grid.append(button);
    }
  }

  function cleanupGallery() {
    for (const mode of removedModes) {
      document.querySelectorAll(`.vmg-card[data-mode="${mode}"]`).forEach((card) => card.remove());
    }

    const note = document.querySelector('#visualModeGallery .vmg-note');
    const noteText = 'Los modos de referencia visibles son recreaciones originales basadas en tu video; no son código extraído de la app grabada.';
    if (note && note.textContent !== noteText) note.textContent = noteText;

    installExtraGalleryCards();
  }

  cleanupSelector();
  cleanupGallery();
  queueMicrotask(() => {
    cleanupSelector();
    cleanupGallery();
  });
  setTimeout(() => {
    cleanupSelector();
    cleanupGallery();
  }, 0);
  setTimeout(() => {
    cleanupSelector();
    cleanupGallery();
  }, 250);

  new MutationObserver(cleanupSelector).observe(selector, { childList: true, subtree: true });

  if (document.body) {
    new MutationObserver(cleanupGallery).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('.vmg-card');
    if (!card || card.dataset.extraMainGallery === 'true') return;
    clearExtraGalleryPressed('');
  }, true);
})();
