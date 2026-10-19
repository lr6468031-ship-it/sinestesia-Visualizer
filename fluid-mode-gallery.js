/* Compatibility loader: keeps the visual references and loads the reconstructed APK Fluid modes. */
(() => {
  'use strict';

  const load = (src, dataKey, dataValue) => {
    if (document.querySelector(`script[${dataKey}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(dataKey, dataValue);
    script.async = false;
    document.head.appendChild(script);
  };

  load('reference-modes.js?v=20261019-real-modes2', 'data-sinestesia-reference-modes', 'true');
  load('particles-fluid-presets.js?v=20261019-apk2', 'data-sinestesia-particles-fluid', 'true');
  load('fluid-extra-modes.js?v=20261019-apk2', 'data-sinestesia-fluid-extra', 'true');
})();
