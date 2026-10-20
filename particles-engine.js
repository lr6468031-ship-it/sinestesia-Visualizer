/*
 * Sinestesia · Particles engine
 * Clean-room recreation for the user's visualizer, based on behavior and
 * parameter names observed in the user's supplied Unity/IL2CPP APK.
 * No proprietary source code or compiled shader bytecode from that APK is copied.
 */
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const base = document.getElementById('visualizer');
  const stage = base?.parentElement;
  if (!selector || !base || !stage) return;

  const MODE = 'particlesEngine';
  if (!selector.querySelector(`option[value="${MODE}"]`)) {
    const option = document.createElement('option');
    option.value = MODE;
    option.textContent = 'Partículas · Vórtice de fuego';
    selector.append(option);
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'particlesEngineCanvas';
  canvas.setAttribute('aria-label', 'Remolino de chispas rojas y doradas con estelas luminosas');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none',
    background: '#000', zIndex: '8', touchAction: 'none', pointerEvents: 'auto'
  });
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return;

  const params = {
    attractor: 1.15,
    circularForce: 2.25,
    turbulence: 0.45,
    airResistance: 0.48,
    speed: 1.20,
    lifetime: 11.0,
    autopilot: true,
    gyroscope: false,
    glow: 1.0,
    trail: 0.23,
  };

  const presets = {
    embers: { label: 'Vórtice de fuego', values: { attractor: 1.15, circularForce: 2.25, turbulence: .45, airResistance: .48, speed: 1.20, lifetime: 11, glow: 1, trail: .23 } },
    field: { label: 'Campo APK', values: { attractor: 1.10, circularForce: 1.35, turbulence: 1.25, airResistance: 0.62, speed: 1.00, lifetime: 9.0, glow: 1.0, trail: 0.19 } },
    vortex: { label: 'Vórtice', values: { attractor: 0.78, circularForce: 2.25, turbulence: 0.82, airResistance: 0.48, speed: 1.18, lifetime: 11.0, glow: 1.15, trail: 0.14 } },
    reactor: { label: 'Reactor', values: { attractor: 2.10, circularForce: 1.05, turbulence: 2.35, airResistance: 0.36, speed: 1.55, lifetime: 5.8, glow: 1.45, trail: 0.12 } },
    nebula: { label: 'Nebulosa', values: { attractor: 0.55, circularForce: 0.82, turbulence: 1.70, airResistance: 0.85, speed: 0.72, lifetime: 14.0, glow: 1.25, trail: 0.08 } },
  };

  const panel = document.createElement('details');
  panel.id = 'particlesEngineStudio';
  panel.hidden = true;
  panel.innerHTML = `
    <summary>Partículas · Vórtice de fuego</summary>
    <p class="pe-help">Chispas rojas, estelas doradas y destellos de luz que giran con la música. Toca y arrastra para guiar el remolino.</p>
    <div class="pe-presets" role="group" aria-label="Preajustes del motor de partículas"></div>
    <div class="pe-controls"></div>
    <div class="pe-actions"><button type="button" data-action="burst">Explosión</button><button type="button" data-action="reset">Reiniciar campo</button></div>
    <p class="pe-help" id="particlesEngineStatus" role="status">Toca o arrastra sobre el visualizador para mover el atractor.</p>
  `;
  stage.insertAdjacentElement('afterend', panel);

  const style = document.createElement('style');
  style.textContent = `
    #particlesEngineStudio{margin:14px 0 18px;padding:16px;border:1px solid #34303e;border-radius:18px;background:#08090d;color:#eee}
    #particlesEngineStudio[hidden]{display:none}#particlesEngineStudio summary{cursor:pointer;font-size:17px;padding:4px 0 10px}
    .pe-help{font-size:11px;line-height:1.45;color:#9c97aa}.pe-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin:12px 0 16px}
    .pe-preset{border:1px solid #3b3546;background:linear-gradient(145deg,#17121e,#090a0f);color:#e9e3f2;border-radius:12px;padding:10px 6px;font-size:11px}
    .pe-preset[aria-pressed=true]{border-color:#d89cff;box-shadow:0 0 14px rgba(194,107,255,.22)}
    .pe-controls{display:grid;gap:11px}.pe-control{display:grid;grid-template-columns:minmax(105px,1fr) minmax(110px,1.3fr) 46px;align-items:center;gap:8px;font-size:12px}
    .pe-control input[type=range]{width:100%;accent-color:#d89cff}.pe-control output{text-align:right;font-variant-numeric:tabular-nums;font-size:10px;color:#bbb3c8}.pe-toggle{grid-template-columns:1fr auto}.pe-actions{display:flex;gap:9px;margin-top:16px}.pe-actions button{border:1px solid #514b5c;background:#17141d;color:white;border-radius:11px;padding:10px 13px}
    @media(min-width:760px){.pe-controls{grid-template-columns:1fr 1fr;gap:13px 26px}}
  `;
  document.head.append(style);

  const controlsRoot = panel.querySelector('.pe-controls');
  const presetRoot = panel.querySelector('.pe-presets');
  const statusEl = panel.querySelector('#particlesEngineStatus');
  const controlRefs = new Map();

  const specs = [
    ['attractor', 'Attractor', 0, 3, .05],
    ['circularForce', 'Fuerza circular', 0, 3, .05],
    ['turbulence', 'Turbulencia', 0, 3, .05],
    ['airResistance', 'Resistencia aire', 0, 1.5, .05],
    ['speed', 'Velocidad', .25, 2.5, .05],
    ['lifetime', 'Lifetime · s', 2, 20, .5],
    ['glow', 'Glow', .2, 2, .05],
    ['trail', 'Persistencia', .03, .38, .01],
  ];

  function makeRange(key, label, min, max, step) {
    const row = document.createElement('label');
    row.className = 'pe-control';
    const span = document.createElement('span'); span.textContent = label;
    const input = document.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = params[key];
    input.setAttribute('aria-label', label);
    const out = document.createElement('output');
    const sync = () => { params[key] = Number(input.value); out.textContent = params[key].toFixed(step < .1 ? 2 : 1); };
    input.addEventListener('input', sync); sync();
    row.append(span, input, out); controlsRoot.append(row); controlRefs.set(key, { input, out, sync });
  }
  specs.forEach(spec => makeRange(...spec));

  function makeToggle(key, label) {
    const row = document.createElement('label'); row.className = 'pe-control pe-toggle';
    const span = document.createElement('span'); span.textContent = label;
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = params[key]; input.setAttribute('aria-label', label);
    input.addEventListener('change', async () => {
      params[key] = input.checked;
      if (key === 'gyroscope' && params[key] && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission !== 'granted') { params[key] = false; input.checked = false; statusEl.textContent = 'El teléfono no concedió acceso al giroscopio.'; }
        } catch {
          params[key] = false; input.checked = false; statusEl.textContent = 'No se pudo activar el giroscopio.';
        }
      }
    });
    row.append(span, input); controlsRoot.append(row); controlRefs.set(key, { input });
  }
  makeToggle('autopilot', 'Autopilot');
  makeToggle('gyroscope', 'Giroscopio');

  function syncControls() {
    for (const [key, ref] of controlRefs) {
      if (ref.input.type === 'checkbox') ref.input.checked = !!params[key];
      else { ref.input.value = String(params[key]); ref.sync(); }
    }
  }

  let activePreset = 'embers';
  function applyPreset(id) {
    const preset = presets[id]; if (!preset) return;
    Object.assign(params, preset.values); activePreset = id; syncControls();
    presetRoot.querySelectorAll('.pe-preset').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === id)));
    resetAll();
    statusEl.textContent = `${preset.label} · parámetros aplicados. Reacciona a música, toque y fuerzas del campo.`;
  }
  Object.entries(presets).forEach(([id, preset]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pe-preset'; b.dataset.preset = id; b.textContent = preset.label;
    b.setAttribute('aria-pressed', String(id === activePreset)); b.addEventListener('click', () => applyPreset(id)); presetRoot.append(b);
  });

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mobile = /Mobi|Android/i.test(navigator.userAgent);
  const count = mobile ? 1700 : 2500;
  const particles = Array.from({ length: count }, () => ({}));
  let pointer = null;
  let gyroX = 0, gyroY = 0;
  let time = 0, last = 0, frame = 0, active = false;
  let smoothBass = 0, smoothMid = 0, smoothTreble = 0, lastKick = 0, flash = 0;

  function randHue() { return 188 + Math.random() * 172; }
  function resetParticle(p, burst = false) {
    const a = Math.random() * TAU;
    const r = burst ? Math.random() * .08 : Math.sqrt(Math.random()) * .48;
    p.x = .5 + Math.cos(a) * r; p.y = .5 + Math.sin(a) * r;
    const tangent = (Math.random() * .004 + .0015) * (Math.random() < .5 ? -1 : 1);
    p.vx = -Math.sin(a) * tangent + (Math.random() - .5) * .002;
    p.vy = Math.cos(a) * tangent + (Math.random() - .5) * .002;
    p.px = p.x; p.py = p.y; p.age = Math.random() * params.lifetime; p.life = params.lifetime * (.72 + Math.random() * .55);
    if (activePreset === 'embers') {
      const unit = Math.max(1, Math.min(canvas.width, canvas.height));
      const radius = burst ? .09 + Math.random() * .06 : .12 + Math.sqrt(Math.random()) * Math.hypot(canvas.width, canvas.height) / unit * .58;
      p.x = .5 + Math.cos(a) * radius * unit / Math.max(1, canvas.width);
      p.y = .5 + Math.sin(a) * radius * unit / Math.max(1, canvas.height);
      p.vx = 0; p.vy = 0; p.px = p.x; p.py = p.y;
      p.heat = Math.random();
    }
    p.hue = randHue(); p.size = .45 + Math.random() * 1.35; p.seed = Math.random() * 1000;
  }
  function resetAll() { particles.forEach(p => resetParticle(p)); clearCanvas(); }

  function resize() {
    const r = base.getBoundingClientRect();
    const maxPixels = mobile ? 700000 : 1200000;
    const rawDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6);
    const dpr = Math.min(rawDpr, Math.sqrt(maxPixels / Math.max(1, r.width * r.height)));
    const w = Math.max(2, Math.round(r.width * dpr)); const h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; clearCanvas(); }
    return { w, h };
  }
  function clearCanvas() { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

  function audioState(dt) {
    const playing = typeof audio !== 'undefined' && !audio.paused;
    const s = playing && typeof fastBeatSignal === 'function' ? fastBeatSignal() : {};
    const gain = Number(document.getElementById('fluidIntensity')?.value) || 1.35;
    const bass = clamp(Number(s.kick ?? s.bass) || 0) * gain;
    const mid = clamp(Number(s.mid) || 0) * gain;
    const treble = clamp(Number(s.treble) || 0) * gain;
    const k = 1 - Math.exp(-dt * 9);
    smoothBass = lerp(smoothBass, bass, k); smoothMid = lerp(smoothMid, mid, k); smoothTreble = lerp(smoothTreble, treble, k);
    if (bass > .38 && bass > lastKick + .06) burst(.42 + bass * .7);
    lastKick = lerp(lastKick, bass, 1 - Math.exp(-dt * 14));
    flash *= Math.exp(-dt * 3.8);
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, playing };
  }

  function burst(amount = 1) {
    flash = Math.max(flash, Math.min(1.4, amount));
    const cx = pointer?.x ?? .5, cy = pointer?.y ?? .5;
    if (activePreset === 'embers') return;
    const impulse = .008 + amount * .013;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (i % 3 === 0 && Math.random() < .32) resetParticle(p, true);
      let dx = p.x - cx, dy = p.y - cy; const d = Math.hypot(dx, dy) + .001; dx /= d; dy /= d;
      p.vx += dx * impulse * (.25 + Math.random()); p.vy += dy * impulse * (.25 + Math.random());
    }
  }

  function targetPoint() {
    if (pointer) return pointer;
    if (!params.autopilot) return { x: .5, y: .5 };
    if (activePreset === 'embers') return {
      x: .5 + Math.sin(time * .61) * .14,
      y: .5 + Math.sin(time * .79) * .17,
    };
    return {
      x: .5 + Math.cos(time * .67) * .19 + Math.sin(time * .21) * .055,
      y: .5 + Math.sin(time * .81) * .16 + Math.cos(time * .29) * .05,
    };
  }

  // Circular flow in isotropic coordinates keeps the vortex round on phones.
  // A hollow core and a common rotation direction preserve the reference's eye.
  function simulateEmbers(dt, s, w, h) {
    const target = targetPoint(), unit = Math.min(w, h);
    const step = dt * params.speed;
    const follow = 1 - Math.exp(-dt * (5 + params.airResistance * 12));
    const pulse = flash + s.bass * .65;
    const fade = 1 - Math.pow(1 - clamp(params.trail, .03, .38), dt * 60);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const dx = (p.x - target.x) * w / unit, dy = (p.y - target.y) * h / unit;
      const radius = Math.hypot(dx, dy), r = Math.max(.025, radius);
      const nx = dx / r, ny = dy / r;
      const eye = .105 + Math.sin(time * .9) * .018;
      const spiral = -.035 * params.attractor + Math.sin(p.seed + time * 1.4 + r * 17) * .018 * params.turbulence;
      const radial = radius < eye ? (eye - radius) * 3 : spiral;
      const orbit = (.18 + .22 * Math.sqrt(r)) * params.circularForce * (1 + pulse * .28 + s.mid * .18);
      p.vx = lerp(p.vx, -ny * orbit + nx * radial, follow);
      p.vy = lerp(p.vy, nx * orbit + ny * radial, follow);
      const gx = params.gyroscope ? gyroX * .06 : 0;
      const gy = params.gyroscope ? gyroY * .06 : 0;
      p.px = p.x; p.py = p.y;
      p.x += (p.vx + gx) * step * unit / w;
      p.y += (p.vy + gy) * step * unit / h;
      p.age += dt;
      if (p.age > p.life || p.x < -.35 || p.x > 1.35 || p.y < -.35 || p.y > 1.35) {
        resetParticle(p); p.age = 0; continue;
      }
      const life = clamp(p.age * 3) * clamp((p.life - p.age) * 2);
      const gold = p.heat > .83;
      const flicker = .78 + .22 * Math.sin(time * (7 + p.heat * 5) + p.seed);
      const opacity = Math.min(.94, (gold ? .72 : .48) * life * flicker * params.glow);
      const length = (gold ? .014 : .021) * (.6 + p.size * .5) * (1 + pulse * .3);
      const v = Math.max(.001, Math.hypot(p.vx, p.vy));
      const x = p.x * w, y = p.y * h;
      const tx = x - p.vx / v * length * unit, ty = y - p.vy / v * length * unit;
      ctx.lineWidth = Math.max(.55, unit / 650) * (gold ? .75 : 1.25) * p.size;
      // Wide red underglow, then a thin hot filament; no per-spark shadow blur.
      if (i % 3 === 0) {
        ctx.strokeStyle = `rgba(255,8,0,${opacity * .11})`;
        const width = ctx.lineWidth; ctx.lineWidth = width * 5;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = width;
      }
      ctx.strokeStyle = gold ? `rgba(255,224,142,${opacity})` : `rgba(255,${12 + Math.round(p.heat * 25)},3,${opacity})`;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    }
    // A bright knot travels around the dark eye, like the flare in the video.
    const angle = time * 1.65;
    const flare = .22 + .78 * Math.pow(Math.max(0, Math.sin(time * 1.35 - 1)), 7) + pulse * .5;
    const cx = target.x * w + Math.cos(angle) * unit * .13;
    const cy = target.y * h + Math.sin(angle) * unit * .13;
    const radius = unit * (.065 + flare * .09);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(255,255,220,${Math.min(.95, flare)})`);
    glow.addColorStop(.12, `rgba(255,231,95,${flare * .7})`);
    glow.addColorStop(.38, `rgba(255,51,0,${flare * .22})`);
    glow.addColorStop(1, 'rgba(130,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function simulate(dt, s, w, h) {
    if (activePreset === 'embers') { simulateEmbers(dt, s, w, h); return; }
    const target = targetPoint();
    const aspect = w / Math.max(1, h);
    const drag = Math.exp(-params.airResistance * dt * 5.4);
    const speedScale = params.speed * dt * 60;
    const attrPower = params.attractor * (.00026 + s.bass * .00135 + flash * .00065);
    const circular = params.circularForce * (.00034 + s.mid * .00072);
    const turbulence = params.turbulence * (.00043 + s.mid * .00070 + s.treble * .00020);
    const gyroForceX = params.gyroscope ? gyroX * .000035 : 0;
    const gyroForceY = params.gyroscope ? gyroY * .000035 : 0;

    ctx.fillStyle = `rgba(0,0,0,${clamp(params.trail, .03, .38)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]; p.px = p.x; p.py = p.y;
      let dx = target.x - p.x, dy = target.y - p.y; const dist = Math.hypot(dx * aspect, dy) + .012;
      dx /= dist; dy /= dist;
      const attract = attrPower / (.22 + dist * .78);
      p.vx += dx * attract; p.vy += dy * attract;
      p.vx += -dy * circular * (1.18 - Math.min(1, dist));
      p.vy += dx * circular * (1.18 - Math.min(1, dist));

      const n1 = Math.sin(p.x * 16.0 + time * 1.8 + p.seed) + Math.sin(p.y * 9.0 - time * 1.23 + p.seed * .37);
      const n2 = Math.cos(p.y * 14.0 - time * 1.5 + p.seed * .71) - Math.cos(p.x * 11.0 + time * .93 + p.seed * .19);
      p.vx += n1 * turbulence; p.vy += n2 * turbulence;
      p.vx += gyroForceX; p.vy += gyroForceY;
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * speedScale; p.y += p.vy * speedScale;
      p.age += dt;

      if (p.age > p.life || p.x < -.18 || p.x > 1.18 || p.y < -.18 || p.y > 1.18 || !Number.isFinite(p.x + p.y)) {
        resetParticle(p); continue;
      }

      const alphaLife = Math.min(1, (p.life - p.age) * 2.0) * Math.min(1, p.age * 3.0);
      const hue = (p.hue + time * (8 + s.treble * 34) + s.mid * 55) % 360;
      const alpha = (.045 + s.bass * .10 + s.treble * .12) * alphaLife * params.glow;
      const lw = p.size * (1 + s.treble * .65 + flash * .28);
      ctx.strokeStyle = `hsla(${hue},100%,${62 + s.treble * 20}%,${Math.min(.68, alpha)})`;
      ctx.lineWidth = lw;
      if ((i & 7) === 0) { ctx.shadowBlur = 8 + params.glow * 14 + s.treble * 12; ctx.shadowColor = `hsl(${hue},100%,65%)`; }
      else ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(p.px * w, p.py * h); ctx.lineTo(p.x * w, p.y * h); ctx.stroke();
    }

    if (flash > .025) {
      const cx = target.x * w, cy = target.y * h, r = Math.min(w, h) * (.035 + flash * .12);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(.72, flash * .4)})`);
      g.addColorStop(.22, `hsla(${285 + s.treble * 45},100%,70%,${Math.min(.48, flash * .27)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(cx-r, cy-r, r*2, r*2);
    }
    ctx.restore();
  }

  function draw(now) {
    frame = 0; if (!active || document.hidden) return;
    const dt = Math.min(.033, last ? (now - last) / 1000 : 1 / 60); last = now; time += dt;
    const { w, h } = resize(); const s = audioState(dt); simulate(dt, s, w, h);
    frame = requestAnimationFrame(draw);
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    pointer = { x: clamp((e.clientX-r.left) / Math.max(1, r.width)), y: clamp((e.clientY-r.top) / Math.max(1, r.height)) };
  }
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); pointerPos(e); burst(.45); });
  canvas.addEventListener('pointermove', e => { if (canvas.hasPointerCapture(e.pointerId)) pointerPos(e); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name, () => { pointer = null; });

  window.addEventListener('deviceorientation', e => {
    const gamma = Number(e.gamma) || 0, beta = Number(e.beta) || 0;
    gyroX = clamp(gamma / 45, -1, 1); gyroY = clamp((beta - 35) / 45, -1, 1);
  }, { passive: true });

  panel.querySelector('.pe-actions').addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (action === 'burst') burst(1.0);
    if (action === 'reset') { resetAll(); statusEl.textContent = 'Campo reiniciado.'; }
  });

  function addGalleryCard() {
    const grid = document.getElementById('vmgGrid'); if (!grid || grid.querySelector(`[data-mode="${MODE}"]`)) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'vmg-card'; button.dataset.mode = MODE;
    button.style.setProperty('--h', '8'); button.innerHTML = '<strong>Vórtice de fuego</strong><small>chispas rojas y estelas doradas</small>';
    button.addEventListener('click', () => { selector.value = MODE; selector.dispatchEvent(new Event('change', { bubbles: true })); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    grid.append(button);
  }

  function choose() {
    active = window.sinestesiaAnalysisMode !== 'separation' && selector.value === MODE;
    canvas.style.display = active ? 'block' : 'none'; panel.hidden = !active;
    if (active) {
      base.style.visibility = 'hidden'; last = 0; resize(); resetAll();
      const notice = document.getElementById('visualNotice');
      if (notice) notice.textContent = 'Partículas · Vórtice de fuego. Arrastra para mover el remolino; la música enciende las chispas.';
      if (!frame) frame = requestAnimationFrame(draw);
    } else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    document.querySelectorAll('#vmgGrid .vmg-card').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === selector.value)));
  }

  selector.addEventListener('change', choose);
  document.addEventListener('visibilitychange', () => { last = 0; if (active && !document.hidden && !frame) frame = requestAnimationFrame(draw); });
  addGalleryCard(); resize(); resetAll(); choose();

  window.sinestesiaParticlesEngine = {
    select() { selector.value = MODE; selector.dispatchEvent(new Event('change', { bubbles: true })); },
    burst,
    reset: resetAll,
    params,
    presets: Object.keys(presets),
  };
})();
