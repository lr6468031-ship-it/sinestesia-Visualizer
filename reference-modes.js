/* Shared visual mode gallery. */
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const base = document.getElementById('visualizer');
  const stage = base?.parentElement;
  if (!selector || !base || !stage) return;

  const gallery = document.createElement('section');
  gallery.id = 'visualModeGallery';
  gallery.setAttribute('aria-label', 'Galería de modos visuales');
  gallery.innerHTML = `
    <div class="vmg-head">
      <div><strong>Galería visual</strong><small>Modos con motores y geometrías diferentes</small></div>
      <button type="button" id="vmgToggle" aria-expanded="true">Ocultar</button>
    </div>
    <div class="vmg-grid" id="vmgGrid"></div>

  `;
  const anchor = document.getElementById('fluidStudio') || stage;
  anchor.insertAdjacentElement('afterend', gallery);

  const style = document.createElement('style');
  style.textContent = `
    #visualModeGallery{margin:14px 0 18px;padding:14px;border:1px solid #2b2934;border-radius:18px;background:#09090d;color:#eee}
    .vmg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.vmg-head>div{display:grid;gap:3px}.vmg-head strong{font-size:16px}.vmg-head small,.vmg-note{color:#9692a3;font-size:11px;line-height:1.35}
    #vmgToggle{border:1px solid #45414f;background:#15141a;color:#eee;border-radius:10px;padding:8px 11px}
    .vmg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.vmg-card{position:relative;min-height:78px;border:1px solid #302d38;background:linear-gradient(155deg,#15111d,#08090e 65%);color:#eee;border-radius:14px;padding:11px 9px;text-align:left;overflow:hidden}
    .vmg-card::before{content:'';position:absolute;inset:-55% 20% 35% -10%;border-radius:50%;background:radial-gradient(circle,hsla(var(--h),100%,70%,.38),transparent 68%);pointer-events:none}.vmg-card strong,.vmg-card small{position:relative;z-index:1;display:block}.vmg-card strong{font-size:12px;margin-bottom:5px}.vmg-card small{font-size:9px;color:#a9a5b4;line-height:1.25}.vmg-card[aria-pressed=true]{border-color:hsl(var(--h),90%,70%);box-shadow:0 0 0 1px hsla(var(--h),90%,65%,.25),inset 0 0 22px hsla(var(--h),90%,55%,.12)}
    .vmg-note{margin:11px 2px 0}@media(min-width:720px){.vmg-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.vmg-card{min-height:86px}}
  `;
  document.head.append(style);

  const cards = [
    { value: 'plasma', name: 'Plasma', desc: 'ritmo + melodía', hue: 206 },
    { value: 'fluidGas', name: 'Fluid', desc: 'simulación WebGL', hue: 285 },
    { value: 'electricIris', name: 'Iris eléctrico', desc: 'aro de filamentos', hue: 245 },
    { value: 'lagrangian:currents', name: 'Corrientes', desc: 'campo de flujo', hue: 165 },
    { value: 'lagrangian:turbulence', name: 'Turbulencia', desc: 'campo caótico', hue: 330 },
  ];

  const grid = gallery.querySelector('#vmgGrid');
  for (const card of cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vmg-card';
    button.dataset.mode = card.value;
    button.style.setProperty('--h', card.hue);
    button.innerHTML = `<strong>${card.name}</strong><small>${card.desc}</small>`;
    button.addEventListener('click', () => {
      selector.value = card.value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    grid.append(button);
  }

  gallery.querySelector('#vmgToggle').addEventListener('click', (event) => {
    const hidden = grid.hidden;
    grid.hidden = !hidden;
    event.currentTarget.textContent = hidden ? 'Ocultar' : 'Mostrar';
    event.currentTarget.setAttribute('aria-expanded', String(hidden));
  });

  function syncCards() {
    gallery.querySelectorAll('.vmg-card').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === selector.value));
    });
  }
  selector.addEventListener('change', syncCards);
  syncCards();
})();
