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
  canvas.setAttribute('aria-label', 'Flujo de filamentos neón con corrientes curvas y expansión radial');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none', background: '#000', zIndex: '9', touchAction: 'none' });
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  stage.append(canvas);
  const haloCanvas = document.createElement('canvas');
  const halo = haloCanvas.getContext('2d');
  const cells = new Uint16Array(20 * 32);
  let hotX = .5, hotY = .5, hotLight = 0;
  const settings = { light: 1, speed: 1, length: 1, reference: true };
  let radial = 0;
  const panel = document.createElement('details');
  panel.className = 'spectrum-card'; panel.hidden = true;
  panel.innerHTML = '<summary>Flujo neón / Torbellino · ajustes</summary><p class="spectrum-help">Referencia: filamentos turquesa y azules, corrientes curvas y expansión radial luminosa. Mantén el dedo para atraer las chispas; arrastra para curvar la corriente. Al soltar conservan su impulso.</p><div class="fluid-settings"></div>';
  const appearance = document.createElement('label');
  appearance.textContent = 'Estilo ';
  const palette = document.createElement('select');
  palette.setAttribute('aria-label', 'Estilo del torbellino');
  palette.innerHTML = '<option value="reference">Flujo neón · referencia del video</option><option value="ember">Torbellino rojo · original</option>';
  palette.addEventListener('change', () => { settings.reference = palette.value === 'reference'; });
  appearance.append(palette); panel.querySelector('.fluid-settings').append(appearance);
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
    history: new Float32Array(48),
    depth: Math.random(), heat: Math.random()
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
    // Alternate loose curl with an outward jet; touch moves the focus continuously.
    const jet = settings.reference ? Math.pow(.5 + .5 * Math.sin(time * .48 - 1.8), 3) : 0;
    radial += (jet - radial) * (1 - Math.exp(-dt * 3));
    const cx = domainX * (.5 + Math.sin(time * .31) * .09);
    const cy = domainY * (.5 + Math.cos(time * .37) * .09);
    const focusX = cx + (magnetX * domainX - cx) * touchStrength;
    const focusY = cy + (magnetY * domainY - cy) * touchStrength;
    const mx = magnetX * domainX, my = magnetY * domainY;
    for (const p of sparks) {
      const dx = cx - p.x, dy = cy - p.y;
      const r = Math.max(.01, Math.hypot(dx, dy));
      const nx = dx/r, ny = dy/r;
      // Softened inward force and tangential drive maintain an open vortex.
      // Near the eye the pressure reverses, avoiding a singularity or pileup.
      const eye = .23 + Math.sin(time*.43)*.025;
      const pressure = .28 / (.22 + r) * Math.tanh((r-eye)*12);
      const tangentSpeed = p.vx * ny - p.vy * nx;
      const swirl = (.42 + .1/(.3+r) - tangentSpeed) * .85;
      // Curl of a shared smooth stream function: neighboring sparks bend
      // together into moving folds instead of receiving unrelated noise.
      const fx = p.x*5 + time*.65, fy = p.y*5 - time*.4;
      const curlX = Math.sin(fx)*Math.cos(fy)*.12;
      const curlY = -Math.cos(fx)*Math.sin(fy)*.12;
      let ax = nx*pressure + ny*swirl + curlX - p.vx*.16;
      let ay = ny*pressure - nx*swirl + curlY - p.vy*.16;
      if (settings.reference) {
        const rx = p.x - focusX, ry = p.y - focusY;
        const distance = Math.max(.025, Math.hypot(rx, ry));
        const jetSpeed = .4 + distance * 1.5;
        ax = ax * (1-radial) + (rx/distance*jetSpeed-p.vx)*radial*3;
        ay = ay * (1-radial) + (ry/distance*jetSpeed-p.vy)*radial*3;
      }
      if (touchStrength > .001) {
        const tx = mx-p.x, ty = my-p.y, d = Math.max(.005, Math.hypot(tx,ty));
        const ux = tx/d, uy = ty/d;
        const falloff = touchStrength / (1 + d*d*14);
        // Local attraction with a soft core and a stronger curling component.
        // Existing momentum bends into the magnet instead of snapping to it.
        const pull = .95 * Math.tanh((d-.065)*18) * falloff;
        const spin = (.85 - (p.vx*uy-p.vy*ux)) * falloff;
        ax += ux*pull + uy*spin; ay += uy*pull - ux*spin;
      }
      p.vx += ax*dt; p.vy += ay*dt;
      const speed = Math.hypot(p.vx,p.vy), limit = 1.9 + energy*.35;
      if (speed > limit) { p.vx *= limit/speed; p.vy *= limit/speed; }
      p.history.copyWithin(2,0,p.history.length-2);
      p.history[0] = p.x; p.history[1] = p.y;
      p.x += p.vx*dt; p.y += p.vy*dt; p.age += dt;
      if (p.age > p.life || p.x < -.4 || p.x > domainX+.4 || p.y < -.4 || p.y > domainY+.4) {
        seed(p);
        if (settings.reference && radial > .4) {
          const angle = Math.random()*Math.PI*2, radius = .015 + Math.random()*.13;
          p.x = focusX + Math.cos(angle)*radius; p.y = focusY + Math.sin(angle)*radius;
          p.vx = Math.cos(angle)*.35; p.vy = Math.sin(angle)*.35;
          for (let j=0;j<p.history.length;j+=2) { p.history[j]=p.x;p.history[j+1]=p.y; }
        }
      }
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
    if (halo) {
      const hw = Math.max(1,Math.round(w/4)), hh = Math.max(1,Math.round(h/4));
      if (haloCanvas.width !== hw || haloCanvas.height !== hh) { haloCanvas.width = hw; haloCanvas.height = hh; }
      halo.clearRect(0,0,hw,hh); halo.lineCap = 'round';
      halo.strokeStyle = settings.reference ? 'rgba(0,180,255,.2)' : 'rgba(255,9,0,.12)'; halo.lineWidth = 1.8;
    }
    cells.fill(0);
    for (const p of sparks) {
      const white = p.heat > .87;
      const fade = Math.min(1,p.age*2,(p.life-p.age)*2);
      const opacity = (.3 + p.depth * .45) * light * fade;
      ctx.strokeStyle = white ? `rgba(255,240,193,${Math.min(.85, opacity)})` : `rgba(255,${Math.round(5 + p.heat * 16)},2,${Math.min(.8, opacity)})`;
      if (settings.reference) ctx.strokeStyle = `hsla(${p.heat > .5 ? 170 + p.heat*20 : 215 + p.heat*40},100%,${white ? 85 : 52}%,${Math.min(.9,opacity)})`;
      ctx.lineWidth = Math.max(.4, unit / 850) * (.45 + p.depth * .7);
      ctx.beginPath(); ctx.moveTo(p.x*unit,p.y*unit);
      for (let j = 0; j < p.history.length; j += 2) {
        const x = p.x + (p.history[j]-p.x)*settings.length;
        const y = p.y + (p.history[j+1]-p.y)*settings.length;
        ctx.lineTo(x*unit,y*unit);
      }
      ctx.stroke();
      if (halo) {
        const tail = p.history.length-2;
        halo.beginPath(); halo.moveTo(p.x*unit/4,p.y*unit/4);
        halo.lineTo(p.history[tail]*unit/4,p.history[tail+1]*unit/4); halo.stroke();
      }
      const ix = Math.floor(p.x/domainX*20), iy = Math.floor(p.y/domainY*32);
      if (ix >= 0 && ix < 20 && iy >= 0 && iy < 32) cells[iy*20+ix]++;
    }
    if (halo) {
      ctx.save(); ctx.globalAlpha = Math.min(1,light*.7);
      ctx.filter = 'blur(5px)'; ctx.drawImage(haloCanvas,0,0,w,h); ctx.restore();
    }
    // The highlight follows an actual concentration of sparks, not the finger
    // or a clock. It fades as that concentration disperses.
    let peak = 0;
    for (let i = 1; i < cells.length; i++) if (cells[i] > cells[peak]) peak = i;
    const concentration = Math.max(0,Math.min(1,(cells[peak]-10)/28));
    const blend = 1-Math.exp(-dt*6);
    hotLight += (concentration-hotLight)*blend;
    if (concentration > .05) {
      hotX += (((peak%20+.5)/20)-hotX)*blend;
      hotY += (((Math.floor(peak/20)+.5)/32)-hotY)*blend;
    }
    const pulse = Math.max(hotLight, settings.reference ? radial*.65 : 0) * (.65 + energy*.35);
    if (pulse > .015) {
      const jetX = (.5 + Math.sin(time*.31)*.09)*(1-touchStrength) + magnetX*touchStrength;
      const jetY = (.5 + Math.cos(time*.37)*.09)*(1-touchStrength) + magnetY*touchStrength;
      const x = (settings.reference ? hotX*(1-radial)+jetX*radial : hotX)*w;
      const y = (settings.reference ? hotY*(1-radial)+jetY*radial : hotY)*h;
      const r = unit * (.025 + pulse * .1);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      if (settings.reference) {
        glow.addColorStop(0, `rgba(190,255,255,${pulse})`);
        glow.addColorStop(.18, `rgba(0,255,220,${pulse*.8})`);
        glow.addColorStop(.5, `rgba(0,100,255,${pulse*.2})`);
        glow.addColorStop(1, 'rgba(0,80,255,0)');
      } else {
      glow.addColorStop(0, `rgba(255,255,240,${Math.min(1, pulse * 1.3)})`);
      glow.addColorStop(.15, `rgba(255,222,128,${pulse * .65})`);
      glow.addColorStop(.45, `rgba(255,35,0,${pulse * .28})`);
      glow.addColorStop(1, 'rgba(255,0,0,0)');
      }
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
      if (notice) notice.textContent = 'Flujo neón · corrientes curvas, estelas azules y turquesa, expansión radial y foco luminoso. Arrastra para dirigir el flujo.';
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
    card.style.setProperty('--h', '2'); card.innerHTML = '<strong>Flujo neón</strong><small>Nuevo · referencia del video</small>';
    card.addEventListener('click', () => { select.value = mode; select.dispatchEvent(new Event('change', { bubbles: true })); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    grid.append(card);
  }
  choose();
})();
