/*
 * Advection adapted from MartinOpat's compute_shader.glsl (MIT, 2024,
 * University of Groningen). Full license: vendor/lagrangian/LICENSE.
 * https://github.com/MartinOpat/Lagrangian-fluid-simulation-for-Android
 * Browser port: 2D bilinear space/time interpolation and RK4 integration.
 * The procedural music-driven fields below are Sinestesia additions.
 */
class LagrangianFlow {
  constructor(size = 32) {
    this.size = size;
    this.fields = [new Float32Array(size * size * 2), new Float32Array(size * size * 2)];
  }
  fill(field, time, model, bass = 0, mid = 0) {
    const n = this.size;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const px = x / (n - 1), py = y / (n - 1), dx = px - .5, dy = py - .5;
      let u, v;
      if (model === 'currents') {
        u = .16 * Math.sin(2 * Math.PI * py + time * .4);
        v = .12 * Math.sin(2 * Math.PI * px - time * .3);
      } else if (model === 'turbulence') {
        u = .12 * Math.sin(py * 12 + time) + .07 * Math.cos(px * 19 - py * 7 - time * .7);
        v = .12 * Math.cos(px * 12 - time * .8) + .07 * Math.sin(py * 19 + px * 7 + time * .6);
      } else {
        const spin = .24 / (.2 + Math.hypot(dx, dy));
        u = -dy * spin + .04 * Math.sin(py * 10 + time);
        v = dx * spin + .04 * Math.cos(px * 10 - time);
      }
      const i = (y * n + x) * 2;
      field[i] = u * (1 + mid) + dx * bass * .6;
      field[i + 1] = v * (1 + mid) + dy * bass * .6;
    }
  }
  sample(field, x, y) {
    const n = this.size, gx = Math.max(0, Math.min(1, x)) * (n - 1), gy = Math.max(0, Math.min(1, y)) * (n - 1);
    const ix = Math.min(n - 2, Math.floor(gx)), iy = Math.min(n - 2, Math.floor(gy)), wx = gx - ix, wy = gy - iy;
    const i = (iy * n + ix) * 2;
    return [0, 1].map(c => (field[i+c]*(1-wx)+field[i+2+c]*wx)*(1-wy) + (field[i+n*2+c]*(1-wx)+field[i+n*2+2+c]*wx)*wy);
  }
  velocity(x, y, phase) {
    const a = this.sample(this.fields[0], x, y), b = this.sample(this.fields[1], x, y);
    return [a[0] + (b[0]-a[0])*phase, a[1] + (b[1]-a[1])*phase];
  }
  // Upstream advectionStep: four velocity evaluations, weighted 1:2:2:1.
  step(x, y, dt) {
    const a = this.velocity(x,y,0), b = this.velocity(x+a[0]*dt/2,y+a[1]*dt/2,.5);
    const c = this.velocity(x+b[0]*dt/2,y+b[1]*dt/2,.5), d = this.velocity(x+c[0]*dt,y+c[1]*dt,1);
    return [x+(a[0]+2*b[0]+2*c[0]+d[0])*dt/6, y+(a[1]+2*b[1]+2*c[1]+d[1])*dt/6];
  }
}
if (typeof module !== 'undefined') module.exports = { LagrangianFlow };
if (typeof document !== 'undefined') (() => {
  const selector = document.getElementById('visualMode'), base = document.getElementById('visualizer');
  if (!selector || !base) return;
  const surface = document.createElement('canvas');
  surface.id = 'lagrangianCanvas';
  surface.setAttribute('aria-label', 'Flujo lagrangiano interactivo reactivo a la música');
  Object.assign(surface.style, { position:'absolute', inset:'0', width:'100%', height:'100%', display:'none', zIndex:'2', touchAction:'none', background:'#03050e' });
  base.parentElement.appendChild(surface);
  const ctx = surface.getContext('2d');
  if (!ctx) {
    for (const option of selector.options) if (option.value.startsWith('lagrangian:')) option.disabled = true;
    return;
  }
  const flow = new LagrangianFlow(), particles = Array.from({length:1400}, () => ({x:Math.random(),y:Math.random(),life:Math.random()*8}));
  // The same 1,400 advected particles supply the body, halo and bright core.
  const lightLayer = document.createElement('canvas'), light = lightLayer.getContext('2d');
  const bloomLayer = document.createElement('canvas'), bloom = bloomLayer.getContext('2d');
  const appearance = { hue: 0, range: 0.06, bloom: true, light: 1.4 };
  // Fluid uses normalized HSV hue plus a bounded hue variation, at full saturation.
  function color(hue, saturation = 1) {
    const h = ((hue % 1) + 1) % 1, i = Math.floor(h * 6), f = h * 6 - i;
    const p = 1 - saturation, q = 1 - f * saturation, t = 1 - (1 - f) * saturation;
    const rgb = [[1,t,p],[q,1,p],[p,1,t],[p,q,1],[t,p,1],[1,p,q]][i % 6];
    return rgb.map(v => Math.round(v * 255)).join(',');
  }
  let active = false, last = 0, time = 0, frame = 0, pointer = null;
  function choose() {
    active = window.sinestesiaAnalysisMode === 'separation' ? window.sinestesiaStemRouter.active('lagrangian:currents') : selector.value.startsWith('lagrangian:');
    surface.style.display = active ? 'block' : 'none';
    if (active) {
      base.style.visibility = 'hidden';
      const notice = document.getElementById('visualNotice');
      if (notice) notice.textContent = 'Flujo lagrangiano · partículas RK4 · graves: expansión, medios: velocidad, agudos: color. Arrastra para agitar.';
      ctx.clearRect(0,0,surface.width,surface.height);
      last = 0;
      if (!frame) frame = requestAnimationFrame(draw);
    }
  }
  selector.addEventListener('change', choose);
  const locate = e => { const r=surface.getBoundingClientRect(); pointer={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}; };
  surface.addEventListener('pointerdown', e => { surface.setPointerCapture(e.pointerId); locate(e); });
  surface.addEventListener('pointermove', e => { if(surface.hasPointerCapture(e.pointerId)) locate(e); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) surface.addEventListener(name, () => {pointer=null;});
  function draw(now) {
    frame = 0;
    if (!active) return;
    const dt = Math.min(.033, last ? (now-last)/1000 : .016); last=now;
    const r=surface.getBoundingClientRect(), scale=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.max(1,Math.round(r.width*scale)), h=Math.max(1,Math.round(r.height*scale));
    if(surface.width!==w || surface.height!==h) {surface.width=w;surface.height=h;}
    const playing=typeof audio!=='undefined' && !audio.paused;
    const s=window.sinestesiaStemRouter?.signal('lagrangian:currents') ?? (playing && typeof fastBeatSignal==='function' ? fastBeatSignal() : {bass:0,mid:0,treble:0,kick:0});
    const gain=Number(document.getElementById('fluidIntensity')?.value)||1.35;
    const model=window.sinestesiaAnalysisMode === 'separation' ? 'currents' : selector.value.split(':')[1];
    const vortex = model === 'vortex';
    // On the vortex, intensity changes light, not speed or particle count.
    const speed=(playing ? .35+Math.min(1,s.mid||0)*2 : .25)*(vortex ? 1.35 : gain);
    const luminosity = Math.max(0, appearance.light * gain / 1.35);
    flow.fill(flow.fields[0],time,model,s.kick||s.bass||0,s.mid||0);
    flow.fill(flow.fields[1],time+dt*speed,model,s.kick||s.bass||0,s.mid||0);
    time+=dt*speed;
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    ctx.fillStyle=vortex ? `rgba(0,0,0,${1-Math.exp(-dt*2.5)})` : `rgba(3,5,14,${1-Math.exp(-dt*4)})`;ctx.fillRect(0,0,w,h);
    let pen = ctx;
    if (vortex && light && bloom) {
      if(lightLayer.width!==w || lightLayer.height!==h) {lightLayer.width=w;lightLayer.height=h;}
      light.clearRect(0,0,w,h);pen=light;
    }
    pen.globalCompositeOperation='lighter';pen.lineWidth=Math.max(.7,scale);pen.lineCap='round';
    for(let band=0;band<4;band++) {
      pen.beginPath();
      const hue = appearance.hue < 0 ? (time * .035 + band * .25) % 1 : (appearance.hue + band / 3 * appearance.range) % 1;
      pen.strokeStyle=vortex ? `rgba(${color(hue)},${Math.min(1,.75*luminosity)})` : `hsla(${(time*12+band*48+(s.treble||0)*100)%360},90%,65%,.65)`;
      for(let i=band;i<particles.length;i+=4) {
        const p=particles[i], ox=p.x, oy=p.y;
        [p.x,p.y]=flow.step(ox,oy,dt*speed);
        if(pointer) { const dx=p.x-pointer.x,dy=p.y-pointer.y, f=Math.exp(-(dx*dx+dy*dy)*70)*dt*3; p.x-=dy*f;p.y+=dx*f; }
        p.life+=dt;
        if(p.x<0||p.x>1||p.y<0||p.y>1||p.life>10) {p.x=Math.random();p.y=Math.random();p.life=0;continue;}
        pen.moveTo(ox*w,oy*h);pen.lineTo(p.x*w,p.y*h);
      }
      if (vortex) {
        // Reuse each path for its luminous body and cream-white core.
        pen.lineWidth=2.5*scale;pen.stroke();
        pen.lineWidth=.65*scale;
        pen.strokeStyle=`rgba(${color(hue,.45)},${Math.min(1,.6*luminosity)})`;pen.stroke();
      } else pen.stroke();
    }
    if (vortex && pen === light) {
      ctx.globalCompositeOperation='lighter';
      if (appearance.bloom && luminosity > 0) {
        // One low-resolution bloom pass avoids per-particle shadow filters on phones.
        const bw=Math.max(1,Math.round(w/3)), bh=Math.max(1,Math.round(h/3));
        if(bloomLayer.width!==bw || bloomLayer.height!==bh) {bloomLayer.width=bw;bloomLayer.height=bh;}
        bloom.clearRect(0,0,bw,bh);bloom.filter='blur(2px)';
        bloom.drawImage(lightLayer,0,0,bw,bh);bloom.filter='none';
        ctx.globalAlpha=Math.min(1,luminosity*.65);ctx.drawImage(bloomLayer,0,0,w,h);
      }
      ctx.globalAlpha=1;ctx.drawImage(lightLayer,0,0);
    }
    frame=requestAnimationFrame(draw);
  }
  choose();
})();
