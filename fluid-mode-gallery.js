/* Compatibility loader: the old Fluid preset picker was replaced by real visual modes. */
(() => {
  'use strict';
  if (document.querySelector('script[data-sinestesia-reference-modes]')) return;
  const script = document.createElement('script');
  script.src = 'reference-modes.js?v=20261019-real-modes1';
  script.dataset.sinestesiaReferenceModes = 'true';
  script.async = false;
  document.head.appendChild(script);
})();
