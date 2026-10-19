(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  if (!selector) return;

  const removePixels2021 = () => {
    const option = selector.querySelector('option[value="pixels2021"]');
    if (option) option.remove();
    if (selector.value === 'pixels2021') {
      selector.value = 'fluidGas';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  removePixels2021();
  queueMicrotask(removePixels2021);
  setTimeout(removePixels2021, 0);
  setTimeout(removePixels2021, 250);

  const observer = new MutationObserver(removePixels2021);
  observer.observe(selector, { childList: true });
})();
