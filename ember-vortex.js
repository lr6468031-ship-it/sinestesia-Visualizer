/* Independent video-reference renderer. Does not share particle or flow state. */
(() => {
  'use strict';
  const mode = 'emberVortex';
  const select = document.getElementById('visualMode');
  const base = document.getElementById('visualizer');
  if (!select || !base) return;
  const stage = base.parentElement;
  const canvas = document.createElement('canvas');
  canvas.id = 'emberVortexCanvas';
  canvas.setAttribute('aria-label', 'Torbellino rojo de filamentos finos y chispas blancas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none', background: '#000', zIndex: '9', touchAction: 'none' });
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  stage.append(canvas);
  const settings = { light: 1, speed: 1, length: 1 };
  const panel = document.createElement('details');
  panel.className = 'spectrum-card'; panel.hidden = true;
  panel.innerHTML = '<summary>Torbellino rojo · ajustes</summary><p class="spectrum-help">Filamentos finos sobre negro, giro continuo y destellos blancos. Arrastra para mover el centro.</p><div class="fluid-settings"></div>';
  for (const [key, name, min, max] of [['light','Luz',.3,1.8], ['speed','Giro',.3,2], ['length','Estela',.4,1.8]]) {
    const row = document.createElement('label'); row.append(document.createTextNode(name));
    const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = .05; input.value = 1; input.setAttribute('aria-label', name + ' del torbellino rojo');
    const output = document.createElement('output'); output.textContent = '1.00';
    input.addEventListener('input', () => { settings[key] = Number(input.value); output.textContent = settings[key].toFixed(2); });
    row.append(input, output); panel.querySelector('.fluid-settings').append(row);
  }
  stage.insertAdjacentElement('afterend', panel);
  // Each spark owns its radius and phase. Short curved segments are redrawn
  // against black, avoiding persistent thick rings and yellow overexposure.
  const sparks = Array.from({ length: 2400 }, () => ({
    radius: Math.sqrt(Math.random()), phase: Math.random() * Math.PI * 2,
    depth: Math.random(), seed: Math.random() * Math.PI * 2, heat: Math.random()
  }));
  let frame = 0, active = false, last = 0, time = 0, pointer = null;
  let centerX = .5, centerY = .5, energy = 0;
  function draw(now) {
    frame = 0;
    if (!active || document.hidden) return;
    const dt = Math.min(.05, last ? (now - last) / 1000 : 1 / 60); last = now;
    const rect = base.getBoundingClientRect();
    if (!rect.width || !rect.height) { frame = requestAnimationFrame(draw); return; }
    const dpr = Math.min(devicePixelRatio || 1, 1.6, Math.sqrt(1000000 / (rect.width * rect.height)));
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const unit = Math.min(w, h);
    const playing = typeof audio !== 'undefined' && !audio.paused;
    const signal = playing && typeof fastBeatSignal === 'function' ? fastBeatSignal() : {};
    const targetEnergy = Math.max(0, Math.min(1, Number(signal.kick || signal.bass) || 0));
    energy += (targetEnergy - energy) * (1 - Math.exp(-dt * 8));
    time += dt * settings.speed * (1 + energy * .22);
    const follow = 1 - Math.exp(-dt * 3);
    centerX += ((pointer?.x ?? (.5 + Math.sin(time * .44) * .13)) - centerX) * follow;
    centerY += ((pointer?.y ?? (.5 + Math.cos(time * .57) * .14)) - centerY) * follow;
    const cx = centerX * w, cy = centerY * h;
    const extent = Math.hypot(w, h) * .66;
    const gain = Math.max(.3, Math.min(2, Number(document.getElementById('fluidIntensity')?.value) || 1));
    const light = settings.light * (.8 + gain * .2);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const p of sparks) {
      const r = unit * .12 + p.radius * extent;
      const omega = .55 + .65 / (.4 + r / unit);
      const angle = p.phase + time * omega;
      const bend = Math.sin(angle * 3 + time * .7 + p.seed) * unit * .013;
      const radius = r + bend;
      const arc = (.009 + p.depth * .028) * settings.length * (1 + energy * .18);
      const white = p.heat > .87;
      const opacity = (.3 + p.depth * .45) * light;
      ctx.strokeStyle = white ? `rgba(255,240,193,${Math.min(.85, opacity)})` : `rgba(255,${Math.round(5 + p.heat * 16)},2,${Math.min(.8, opacity)})`;
      ctx.lineWidth = Math.max(.4, unit / 850) * (.45 + p.depth * .7);
      ctx.beginPath();
      for (let j = 0; j <= 3; j++) {
        const a = angle - arc * j / 3;
        const rr = radius + Math.sin(a * 5 + p.seed) * unit * .004;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Local flare rather than a yellow glow over every particle.
    const pulse = Math.pow(Math.max(0, Math.sin(time * 1.3)), 12) * .8 + energy * .6;
    if (pulse > .015) {
      const a = time * 1.8, x = cx + Math.cos(a) * unit * .18, y = cy + Math.sin(a) * unit * .18;
      const r = unit * (.025 + pulse * .1);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, `rgba(255,255,240,${Math.min(1, pulse * 1.3)})`);
      glow.addColorStop(.15, `rgba(255,222,128,${pulse * .65})`);
      glow.addColorStop(.45, `rgba(255,35,0,${pulse * .28})`);
      glow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(x-r, y-r, r*2, r*2);
    }
    frame = requestAnimationFrame(draw);
  }
  function choose() {
    active = select.value === mode && window.sinestesiaAnalysisMode !== 'separation';
    canvas.style.display = active ? 'block' : 'none'; panel.hidden = !active;
    if (frame) cancelAnimationFrame(frame); frame = 0; last = 0;
    if (active) {
      base.style.visibility = 'hidden';
      const notice = document.getElementById('visualNotice');
      if (notice) notice.textContent = 'Torbellino rojo · filamentos finos, chispas blancas y centro móvil. Arrastra para guiarlo.';
      if (!document.hidden) frame = requestAnimationFrame(draw);
    }
    document.querySelectorAll('#vmgGrid .vmg-card').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === select.value)));
  }
  function locate(e) {
    const r = canvas.getBoundingClientRect();
    pointer = { x: Math.max(0, Math.min(1, (e.clientX-r.left)/r.width)), y: Math.max(0, Math.min(1, (e.clientY-r.top)/r.height)) };
  }
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); locate(e); });
  canvas.addEventListener('pointermove', e => { if (canvas.hasPointerCapture(e.pointerId)) locate(e); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name, () => { pointer = null; });
  select.addEventListener('change', choose);
  window.addEventListener('sinestesia-detection-change', choose);
  document.addEventListener('visibilitychange', choose);
  const grid = document.getElementById('vmgGrid');
  if (grid) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'vmg-card'; card.dataset.mode = mode;
    card.style.setProperty('--h', '2'); card.innerHTML = '<strong>Torbellino rojo</strong><small>Nuevo · filamentos y chispas</small>';
    card.addEventListener('click', () => { select.value = mode; select.dispatchEvent(new Event('change', { bubbles: true })); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    grid.append(card);
  }
  choose();
})();
