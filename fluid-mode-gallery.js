/* Compatibility loader: the old Fluid preset picker was replaced by real visual modes. */
(() => {
  'use strict';

  if (!document.querySelector('script[data-sinestesia-reference-modes]')) {
    const script = document.createElement('script');
    script.src = 'reference-modes.js?v=20261019-real-modes1';
    script.dataset.sinestesiaReferenceModes = 'true';
    script.async = false;
    document.head.appendChild(script);
  }

  if (!document.querySelector('script[data-sinestesia-particles-fluid]')) {
    const particles = document.createElement('script');
    particles.src = 'particles-fluid-presets.js?v=20261019-apk1';
    particles.dataset.sinestesiaParticlesFluid = 'true';
    particles.async = false;
    document.head.appendChild(particles);
  }
})();
