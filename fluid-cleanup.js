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

  function cleanupGallery() {
    for (const mode of removedModes) {
      document.querySelectorAll(`.vmg-card[data-mode="${mode}"]`).forEach((card) => card.remove());
    }

    const note = document.querySelector('#visualModeGallery .vmg-note');
    const noteText = 'Los modos de referencia visibles son recreaciones originales basadas en tu video; no son código extraído de la app grabada.';
    if (note && note.textContent !== noteText) note.textContent = noteText;

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

})();
