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
  panel.innerHTML = '<summary>Torbellino rojo · ajustes</summary><p class="spectrum-help">Filamentos finos sobre negro, giro continuo y destellos blancos. Mantén el dedo para atraer las chispas; arrastra para curvar la corriente. Al soltar conservan su impulso.</p><div class="fluid-settings"></div>';
  for (const [key, name, min, max] of [['light','Luz',.3,1.8], ['speed','Giro',.3,2], ['length','Estela',.4,1.8]]) {
    const row = document.createElement('label'); row.append(document.createTextNode(name));
    const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = .05; input.value = 1; input.setAttribute('aria-label', name + ' del torbellino rojo');
    const output = document.createElement('output'); output.textContent = '1.00';
    input.addEventListener('input', () => { settings[key] = Number(input.value); output.textContent = settings[key].toFixed(2); });
    row.append(input, output); panel.querySelector('.fluid-settings').append(row);
  }
  stage.insertAdjacentElement('afterend', panel);
  // Positions and velocities live in an isotropic simulation space. Touch adds
  // a local force; it never translates the particle cloud or its history.
  const sparks = Array.from({ length: 2400 }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0,
    history: new Float32Array(16),
    depth: Math.random(), seed: Math.random() * Math.PI * 2, heat: Math.random()
  }));
  let frame = 0, active = false, last = 0, time = 0, pointer = null;
  let energy = 0, touchStrength = 0, magnetX = .5, magnetY = .5;
  let domainX = 0, domainY = 0, accumulator = 0;
  function seed(p, initial = false) {
    p.x = Math.random() * domainX; p.y = Math.random() * domainY;
    const dx = p.x - domainX * .5, dy = p.y - domainY * .5;
    const r = Math.max(.04, Math.hypot(dx, dy));
    const speed = .35 + .15 / (.3 + r);
    p.vx = -dy / r * speed; p.vy = dx / r * speed;
    p.life = 14 + Math.random() * 15;
    p.age = initial ? Math.random() * p.life * .8 : 0;
    for (let j = 0; j < p.history.length; j += 2) {
      p.history[j] = p.x; p.history[j + 1] = p.y;
    }
  }
  function resizeDomain(x, y) {
    if (!domainX || !domainY) {
      domainX = x; domainY = y; sparks.forEach(p => seed(p, true)); return;
    }
    if (Math.abs(x-domainX) + Math.abs(y-domainY) < .001) return;
    const sx = x/domainX, sy = y/domainY;
    for (const p of sparks) {
      p.x *= sx; p.y *= sy; p.vx *= sx; p.vy *= sy;
      for (let j = 0; j < p.history.length; j += 2) {
        p.history[j] *= sx; p.history[j + 1] *= sy;
      }
    }
    domainX = x; domainY = y;
  }
  function advance(dt) {
    time += dt;
    touchStrength += ((pointer ? 1 : 0) - touchStrength) * (1 - Math.exp(-dt * (pointer ? 12 : 3)));
    if (pointer) {
      const response = 1 - Math.exp(-dt * 16);
      magnetX += (pointer.x - magnetX) * response;
      magnetY += (pointer.y - magnetY) * response;
    }
    const cx = domainX * (.5 + Math.sin(time * .31) * .09);
    const cy = domainY * (.5 + Math.cos(time * .37) * .09);
    const mx = magnetX * domainX, my = magnetY * domainY;
    for (const p of sparks) {
      const dx = cx - p.x, dy = cy - p.y;
      const r = Math.max(.01, Math.hypot(dx, dy));
      const nx = dx/r, ny = dy/r;
      // Softened inward force and tangential drive maintain an open vortex.
      // Near the eye the pressure reverses, avoiding a singularity or pileup.
      const pressure = .24 / (.22 + r) * Math.tanh((r-.12)*14);
      const tangentSpeed = p.vx * ny - p.vy * nx;
      const swirl = (.42 + .1/(.3+r) - tangentSpeed) * .85;
      const wave = Math.sin(p.x * 5 + time * .65) * Math.cos(p.y * 4 - time * .4);
      let ax = nx*pressure + ny*swirl + wave*.055 - p.vx*.16;
      let ay = ny*pressure - nx*swirl - wave*.055 - p.vy*.16;
      if (touchStrength > .001) {
        const tx = mx-p.x, ty = my-p.y, d = Math.max(.005, Math.hypot(tx,ty));
        const ux = tx/d, uy = ty/d;
        const falloff = touchStrength / (1 + d*d*5);
        // Strong attraction at medium distances, a soft core, then orbit.
        // Existing momentum bends into the magnet instead of snapping to it.
        const pull = 2.6 * Math.tanh((d-.055)*22) * falloff;
        const spin = (.75 - (p.vx*uy-p.vy*ux)) * falloff;
        ax += ux*pull + uy*spin; ay += uy*pull - ux*spin;
      }
      p.vx += ax*dt; p.vy += ay*dt;
      const speed = Math.hypot(p.vx,p.vy), limit = 1.9 + energy*.35;
      if (speed > limit) { p.vx *= limit/speed; p.vy *= limit/speed; }
      p.history.copyWithin(2,0,p.history.length-2);
      p.history[0] = p.x; p.history[1] = p.y;
      p.x += p.vx*dt; p.y += p.vy*dt; p.age += dt;
      if (p.age > p.life || p.x < -.4 || p.x > domainX+.4 || p.y < -.4 || p.y > domainY+.4) seed(p);
    }
  }
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
    resizeDomain(w/unit, h/unit);
    accumulator = Math.min(.1, accumulator + dt * settings.speed * (1 + energy*.16));
    const fixed = 1/120;
    while (accumulator >= fixed) { advance(fixed); accumulator -= fixed; }
    const gain = Math.max(.3, Math.min(2, Number(document.getElementById('fluidIntensity')?.value) || 1));
    const light = settings.light * (.8 + gain * .2);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const p of sparks) {
      const white = p.heat > .87;
      const fade = Math.min(1,p.age*2,(p.life-p.age)*2);
      const opacity = (.3 + p.depth * .45) * light * fade;
      ctx.strokeStyle = white ? `rgba(255,240,193,${Math.min(.85, opacity)})` : `rgba(255,${Math.round(5 + p.heat * 16)},2,${Math.min(.8, opacity)})`;
      ctx.lineWidth = Math.max(.4, unit / 850) * (.45 + p.depth * .7);
      ctx.beginPath(); ctx.moveTo(p.x*unit,p.y*unit);
      for (let j = 0; j < p.history.length; j += 2) {
        const x = p.x + (p.history[j]-p.x)*settings.length;
        const y = p.y + (p.history[j+1]-p.y)*settings.length;
        ctx.lineTo(x*unit,y*unit);
      }
      ctx.stroke();
    }
    // Local flare rather than a yellow glow over every particle.
    const pulse = touchStrength*.65 + energy*.6;
    if (pulse > .015) {
      const x = magnetX*w, y = magnetY*h;
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
    if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; accumulator = 0;
    if (!active) pointer = null;
    if (active) {
      base.style.visibility = 'hidden';
      const notice = document.getElementById('visualNotice');
      if (notice) notice.textContent = 'Torbellino rojo · mantén el dedo para atraer las chispas, arrastra para curvarlas y suelta para dejarlas fluir.';
      if (!document.hidden) frame = requestAnimationFrame(draw);
    }
    document.querySelectorAll('#vmgGrid .vmg-card').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === select.value)));
  }
  function locate(e) {
    const r = canvas.getBoundingClientRect();
    pointer = { id: e.pointerId, x: Math.max(0, Math.min(1, (e.clientX-r.left)/r.width)), y: Math.max(0, Math.min(1, (e.clientY-r.top)/r.height)) };
  }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (pointer && pointer.id !== e.pointerId) return;
    canvas.setPointerCapture(e.pointerId); locate(e);
    magnetX = pointer.x; magnetY = pointer.y;
  });
  canvas.addEventListener('pointermove', e => { if (canvas.hasPointerCapture(e.pointerId)) locate(e); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name, e => { if (pointer?.id === e.pointerId) pointer = null; });
  select.addEventListener('change', choose);
  window.addEventListener('sinestesia-detection-change', choose);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pointer = null; choose(); });
  window.addEventListener('blur', () => { pointer = null; });
  const grid = document.getElementById('vmgGrid');
  if (grid) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'vmg-card'; card.dataset.mode = mode;
    card.style.setProperty('--h', '2'); card.innerHTML = '<strong>Torbellino rojo</strong><small>Nuevo · filamentos y chispas</small>';
    card.addEventListener('click', () => { select.value = mode; select.dispatchEvent(new Event('change', { bubbles: true })); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    grid.append(card);
  }
  choose();
})();
