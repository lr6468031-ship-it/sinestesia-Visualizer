/*
 * Sinestesia reference modes.
 * Original renderers recreated from the user's supplied video reference.
 * No code, shaders or assets from the recorded application are included.
 */
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const base = document.getElementById('visualizer');
  const stage = base?.parentElement;
  if (!selector || !base || !stage) return;

  const MODES = [
    { id: 'reference:rose', name: 'Roseta fluida', desc: 'pétalos luminosos que respiran con el beat' },
    { id: 'reference:duo', name: 'Doble vórtice', desc: 'dos remolinos que orbitan y se deforman' },
    { id: 'reference:rings', name: 'Anillos orbitales', desc: 'capas de puntos y ondas circulares' },
    { id: 'reference:nebula', name: 'Nebulosa', desc: 'nube de partículas atraída por campos móviles' },
    { id: 'reference:streamers', name: 'Filamentos', desc: 'hebras eléctricas largas alrededor del núcleo' },
  ];

  for (const mode of MODES) {
    if (!selector.querySelector(`option[value="${mode.id}"]`)) {
      const option = document.createElement('option');
      option.value = mode.id;
      option.textContent = `${mode.name} · recreación`;
      selector.append(option);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'referenceModesCanvas';
  canvas.setAttribute('aria-label', 'Modos visuales recreados a partir de la referencia del usuario');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none',
    zIndex: '5', background: '#000', touchAction: 'none'
  });
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const gallery = document.createElement('section');
  gallery.id = 'visualModeGallery';
  gallery.setAttribute('aria-label', 'Galería de modos visuales');
  gallery.innerHTML = `
    <div class="vmg-head">
      <div><strong>Galería visual</strong><small>Modos con motores y geometrías diferentes</small></div>
      <button type="button" id="vmgToggle" aria-expanded="true">Ocultar</button>
    </div>
    <div class="vmg-grid" id="vmgGrid"></div>
    <p class="vmg-note">Los cinco modos “Referencia” son recreaciones originales basadas en tu video; no son presets de color del mismo Fluid ni código extraído de la app grabada.</p>
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
    { value: 'lagrangian:vortex', name: 'Vórtice de trazos', desc: 'partículas RK4', hue: 195 },
    { value: 'lagrangian:currents', name: 'Corrientes', desc: 'campo de flujo', hue: 165 },
    { value: 'lagrangian:turbulence', name: 'Turbulencia', desc: 'campo caótico', hue: 330 },
    ...MODES.map((m, i) => ({ value: m.id, name: m.name, desc: m.desc, hue: [315, 286, 45, 266, 205][i] })),
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
    gallery.querySelector('.vmg-note').hidden = !hidden;
    event.currentTarget.textContent = hidden ? 'Ocultar' : 'Mostrar';
    event.currentTarget.setAttribute('aria-expanded', String(hidden));
  });

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };

  const particles = Array.from({ length: 760 }, (_, i) => ({
    x: rand(i * 3 + 1), y: rand(i * 3 + 2), px: 0, py: 0,
    hue: 255 + rand(i * 5 + 8) * 100, life: rand(i * 7 + 4) * 8,
  }));

  let active = false;
  let frame = 0;
  let last = 0;
  let time = 0;
  let pulse = 0;
  let smoothBass = 0;
  let smoothMid = 0;
  let smoothTreble = 0;
  let pointer = null;

  function resize() {
    const r = base.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(900000 / Math.max(1, r.width * r.height)));
    const w = Math.max(2, Math.round(r.width * dpr));
    const h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h, dpr };
  }

  function audioState(dt) {
    const playing = typeof audio !== 'undefined' && !audio.paused;
    const s = playing && typeof fastBeatSignal === 'function' ? fastBeatSignal() : {};
    const gain = Number(document.getElementById('fluidIntensity')?.value) || 1.35;
    const bass = clamp(Number(s.kick ?? s.bass) || 0) * gain;
    const mid = clamp(Number(s.mid) || 0) * gain;
    const treble = clamp(Number(s.treble) || 0) * gain;
    const k = 1 - Math.exp(-dt * 8);
    smoothBass = lerp(smoothBass, bass, k);
    smoothMid = lerp(smoothMid, mid, k);
    smoothTreble = lerp(smoothTreble, treble, k);
    pulse = Math.max(pulse * Math.exp(-dt * 4.2), bass);
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, playing, gain };
  }

  function glowStroke(path, hue, width, alpha, blur = 14) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `hsla(${hue},100%,70%,${alpha * .24})`;
    ctx.lineWidth = width * 4.5;
    ctx.shadowBlur = blur;
    ctx.shadowColor = `hsl(${hue},100%,65%)`;
    ctx.stroke(path);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `hsla(${hue},100%,82%,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.restore();
  }

  function drawRose(w, h, s) {
    ctx.fillStyle = 'rgba(2,0,7,.25)'; ctx.fillRect(0, 0, w, h);
    const cx = w * .5, cy = h * .5;
    const R = Math.min(w, h) * (.21 + pulse * .035);
    const petals = 9;
    for (let layer = 0; layer < 4; layer++) {
      const path = new Path2D();
      const samples = 600;
      for (let i = 0; i <= samples; i++) {
        const a = i / samples * TAU;
        const wobble = Math.sin(a * petals + time * (1.15 + layer * .08)) * (.13 + s.mid * .06);
        const ripple = Math.sin(a * 3 - time * 1.8 + layer) * .035;
        const r = R * (1 + wobble + ripple + layer * .055);
        const twist = a + Math.sin(a * 2 + time * .7) * .12;
        const x = cx + Math.cos(twist) * r * 1.06;
        const y = cy + Math.sin(twist) * r * .92;
        i ? path.lineTo(x, y) : path.moveTo(x, y);
      }
      glowStroke(path, 315 - layer * 18 + s.treble * 45, 1.1 + layer * .2, .72 - layer * .09, 18);
    }
    for (let i = 0; i < 110; i++) {
      const a = rand(i + 50) * TAU + time * (.08 + rand(i + 90) * .08);
      const rr = R * (.65 + rand(i + 120) * .72 + .08 * Math.sin(time * 2 + i));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .92;
      const size = 1 + rand(i + 300) * 2.8 + s.treble * 2;
      ctx.fillStyle = `hsla(${285 + rand(i + 700) * 80},100%,75%,${.18 + rand(i + 2) * .45})`;
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
    }
  }

  function spiralPath(cx, cy, radius, phase, arms, direction, wobble) {
    const path = new Path2D();
    const samples = 280;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const a = phase + direction * (u * TAU * 2.7 + Math.sin(u * TAU * 2 + time) * wobble);
      const r = radius * (.04 + u * .98) * (1 + .08 * Math.sin(u * arms * TAU - time * 1.5));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .82;
      i ? path.lineTo(x, y) : path.moveTo(x, y);
    }
    return path;
  }

  function drawDuo(w, h, s) {
    ctx.fillStyle = 'rgba(1,0,6,.18)'; ctx.fillRect(0, 0, w, h);
    const sep = Math.min(w, h) * (.17 + s.bass * .025);
    const orbit = time * .23;
    const centers = [
      [w*.5 + Math.cos(orbit)*sep, h*.5 + Math.sin(orbit)*sep*.45, 1],
      [w*.5 - Math.cos(orbit)*sep, h*.5 - Math.sin(orbit)*sep*.45, -1],
    ];
    centers.forEach(([cx,cy,dir], n) => {
      const radius = Math.min(w,h) * (.17 + pulse * .025);
      for(let arm=0; arm<5; arm++){
        const p=spiralPath(cx,cy,radius,time*(.55+arm*.03)+arm*TAU/5,5,dir,.24+s.mid*.35);
        glowStroke(p,(n?272:326)+arm*7+s.treble*25,1.0,.54,16);
      }
      const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*.6);
      halo.addColorStop(0,`hsla(${n?275:320},100%,75%,${.18+s.bass*.18})`);halo.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=halo;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
    });
  }

  function drawRings(w, h, s) {
    ctx.fillStyle = 'rgba(0,2,7,.28)'; ctx.fillRect(0, 0, w, h);
    const cx=w*.5,cy=h*.5,maxR=Math.min(w,h)*.39;
    ctx.globalCompositeOperation='lighter';
    for(let ring=0;ring<13;ring++){
      const r=maxR*(.12+ring/14)+Math.sin(time*1.4+ring*.7)*4+pulse*ring*1.1;
      const count=30+ring*5;
      for(let i=0;i<count;i++){
        const a=i/count*TAU + time*(ring%2?-.05:.07) + Math.sin(i*.7+time)*.012;
        const wave=Math.sin(a*5-time*2+ring)*(.008*maxR)*(s.mid+.25);
        const rr=r+wave;
        const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr*.82;
        const size=.6+(ring/13)*1.2+s.treble*1.2;
        ctx.fillStyle=`hsla(${190+ring*10+s.treble*70},100%,72%,${.22+.45*(1-ring/15)})`;
        ctx.beginPath();ctx.arc(x,y,size,0,TAU);ctx.fill();
      }
    }
    ctx.globalCompositeOperation='source-over';
  }

  function resetParticle(p, i) {
    const a=rand(i*9+time)*TAU,r=.08+rand(i*13+2)*.46;
    p.x=.5+Math.cos(a)*r;p.y=.5+Math.sin(a)*r;p.px=p.x;p.py=p.y;p.life=0;
  }

  function drawNebula(w,h,s,dt){
    ctx.fillStyle='rgba(0,0,5,.09)';ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='lighter';
    const a1x=.5+Math.cos(time*.31)*.19,a1y=.5+Math.sin(time*.27)*.13;
    const a2x=.5+Math.cos(time*.23+Math.PI)*.22,a2y=.5+Math.sin(time*.36+2)*.15;
    for(let i=0;i<particles.length;i++){
      const p=particles[i];p.px=p.x;p.py=p.y;
      let vx=0,vy=0;
      for(const [ax,ay,sign] of [[a1x,a1y,1],[a2x,a2y,-1]]){
        const dx=p.x-ax,dy=p.y-ay,d2=dx*dx+dy*dy+.003,f=(.00018+s.mid*.00016)/d2;
        vx+=-dy*f*sign;vy+=dx*f*sign;
      }
      const cx=pointer?pointer.x:.5,cy=pointer?pointer.y:.5,dx=p.x-cx,dy=p.y-cy;
      vx+=-dy*.008*(.3+s.bass);vy+=dx*.008*(.3+s.bass);
      p.x+=vx*dt*60;p.y+=vy*dt*60;p.life+=dt;
      if(p.x<-.05||p.x>1.05||p.y<-.05||p.y>1.05||p.life>10+rand(i)*8)resetParticle(p,i);
      ctx.strokeStyle=`hsla(${p.hue+s.treble*55},100%,70%,${.08+rand(i+4)*.28})`;
      ctx.lineWidth=.55+rand(i+6)*1.1;
      ctx.beginPath();ctx.moveTo(p.px*w,p.py*h);ctx.lineTo(p.x*w,p.y*h);ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
  }

  function drawStreamers(w,h,s){
    ctx.fillStyle='rgba(0,1,8,.19)';ctx.fillRect(0,0,w,h);
    const cx=w*.5,cy=h*.5,R=Math.min(w,h)*(.18+pulse*.03),outer=Math.min(w,h)*(.45+s.mid*.02);
    ctx.globalCompositeOperation='lighter';
    const strands=120;
    for(let i=0;i<strands;i++){
      const seed=rand(i+11),a=i/strands*TAU+time*.05;
      const bend=Math.sin(time*(.4+seed*.6)+i*.73)*(.18+s.mid*.15);
      const len=lerp(R,outer,.35+seed*.65)*(1+.08*Math.sin(time*1.6+i));
      const x0=cx+Math.cos(a)*R,y0=cy+Math.sin(a)*R*.88;
      const x3=cx+Math.cos(a+bend)*len,y3=cy+Math.sin(a+bend)*len*.84;
      const p=new Path2D();p.moveTo(x0,y0);
      p.bezierCurveTo(cx+Math.cos(a+.5*bend)*len*.56,cy+Math.sin(a-.35*bend)*len*.34,cx+Math.cos(a-.3*bend)*len*.74,cy+Math.sin(a+.7*bend)*len*.62,x3,y3);
      const hue=220+seed*100+s.treble*40;
      ctx.strokeStyle=`hsla(${hue},100%,70%,${.08+seed*.22})`;ctx.lineWidth=.55+seed*.8+s.treble*.35;ctx.stroke(p);
      if(i%9===0)glowStroke(p,hue,1.0,.26,10);
    }
    ctx.globalCompositeOperation='source-over';
  }

  function draw(now) {
    frame = 0;
    if (!active || document.hidden) return;
    const dt = Math.min(.033, last ? (now - last) / 1000 : 1/60); last = now;
    time += dt;
    const { w, h } = resize();
    const s = audioState(dt);
    const id = selector.value.split(':')[1];
    if (id === 'rose') drawRose(w,h,s);
    else if (id === 'duo') drawDuo(w,h,s);
    else if (id === 'rings') drawRings(w,h,s);
    else if (id === 'nebula') drawNebula(w,h,s,dt);
    else drawStreamers(w,h,s);
    frame = requestAnimationFrame(draw);
  }

  function syncCards() {
    gallery.querySelectorAll('.vmg-card').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === selector.value)));
  }

  function choose() {
    active = selector.value.startsWith('reference:');
    canvas.style.display = active ? 'block' : 'none';
    if (active) {
      base.style.visibility = 'hidden';
      ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
      const meta = MODES.find(m => m.id === selector.value);
      const notice = document.getElementById('visualNotice');
      if (notice && meta) notice.textContent = `${meta.name} · ${meta.desc}. Reacciona a graves, medios y agudos.`;
      last = 0;
      if (!frame) frame = requestAnimationFrame(draw);
    } else if (frame) {
      cancelAnimationFrame(frame); frame = 0;
    }
    syncCards();
  }

  function pointerPos(e){const r=canvas.getBoundingClientRect();pointer={x:clamp((e.clientX-r.left)/Math.max(1,r.width)),y:clamp((e.clientY-r.top)/Math.max(1,r.height))};}
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointerPos(e);});
  canvas.addEventListener('pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))pointerPos(e);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{pointer=null;});
  selector.addEventListener('change', choose);
  document.addEventListener('visibilitychange',()=>{last=0;if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);});
  choose();
})();
