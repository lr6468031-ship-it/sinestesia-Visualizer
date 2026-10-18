/* Original Sinestesia renderer, recreated from the user's video reference.
 * No code or assets from the recorded application are embedded. */
const IrisMath = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const level = v => Number.isFinite(v) ? clamp(v, 0, 1) : 0;
  const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  class Motion {
    constructor() { this.time = 0; this.bass = 0; this.mid = 0; this.treble = 0; this.energy = 0; }
    update(dt, signal = {}, playing = false) {
      dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
      for (const key of ['bass', 'mid', 'treble', 'energy']) {
        const target = playing ? level(signal[key]) : 0;
        const response = target > this[key] ? 16 : 4;
        this[key] += (target - this[key]) * (1 - Math.exp(-dt * response));
      }
      this.time += dt * (.24 + this.energy * .8 + this.mid * .35);
    }
  }
  function point(strand, u, state, intensity = 1) {
    const gain = Number.isFinite(intensity) ? clamp(intensity, .7, 2) : 1;
    const t = state.time, seed = noise(strand + 1), a = strand * TAU / 192;
    const wave = Math.sin(a * 3 - t * .8) * .025 + Math.sin(a * 7 + t * .7) * .012;
    const radius = (.43 + wave + state.bass * .055 * gain) + u * (.59 + seed * .16);
    const bend = Math.sin(u * 8 - t * 2 + seed * 9) * .028 * Math.sin(u * Math.PI)
      + u * .10 * Math.sin(a * 2 + t * .6);
    const angle = a + t * .07 + bend * (1 + state.mid * gain);
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    // A softly tilted elliptical plane with a traveling near-side highlight.
    const tilt = -.32 + Math.sin(t * .35) * .12;
    const py = y * (.78 + Math.sin(t * .22) * .07);
    return { x: x * Math.cos(tilt) - py * Math.sin(tilt), y: x * Math.sin(tilt) + py * Math.cos(tilt),
      depth: .5 + .5 * Math.sin(angle + .5), radius };
  }
  return { Motion, point, noise, level };
})();
if (typeof module !== 'undefined') module.exports = IrisMath;
if (typeof document !== 'undefined') (() => {
  'use strict';
  const selector = document.getElementById('visualMode'), base = document.getElementById('visualizer');
  if (!selector || !base) return;
  const surface = document.createElement('canvas');
  surface.id = 'electricIrisCanvas';
  surface.setAttribute('aria-label', 'Iris eléctrico: aro de filamentos azules y violetas reactivo a la música');
  Object.assign(surface.style, { position:'absolute', inset:'0', width:'100%', height:'100%', display:'none', zIndex:'3', pointerEvents:'none', background:'#010108' });
  base.parentElement.appendChild(surface);
  const ctx = surface.getContext('2d');
  if (!ctx) { const option=selector.querySelector('option[value="electricIris"]');if(option)option.disabled=true;return; }
  const motion = new IrisMath.Motion();
  const palette = ['#304dff','#5068ef','#8972d8','#bba3ee','#dbbaff','#85caff','#45dbff','#eee1ff'];
  const sprites = palette.map(color => {
    const c=document.createElement('canvas');c.width=c.height=48;
    const g=c.getContext('2d');const radial=g.createRadialGradient(24,24,0,24,24,24);
    radial.addColorStop(0,color);radial.addColorStop(.18,color);radial.addColorStop(.45,color+'65');radial.addColorStop(1,color+'00');
    g.fillStyle=radial;g.fillRect(0,0,48,48);return c;
  });
  let active=false, frame=0, last=0, quality=1, slow=0, fast=0;
  function schedule() { if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(draw); }
  function choose() {
    active=selector.value==='electricIris';surface.style.display=active?'block':'none';
    if(active) {
      base.style.visibility='hidden';
      const notice=document.getElementById('visualNotice');
      if(notice)notice.textContent='Iris eléctrico · graves: expansión · medios: ondulación · agudos: destellos.';
    }
    last=0;
    if(!active&&frame){cancelAnimationFrame(frame);frame=0;}
    schedule();
  }
  selector.addEventListener('change',choose);
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}schedule();});
  function draw(now) {
    frame=0;if(!active||document.hidden)return;
    const elapsed=last?(now-last)/1000:1/60;last=now;
    if(elapsed>.04){slow++;fast=0;}else{fast++;slow=Math.max(0,slow-1);}
    if(slow>18){quality=Math.max(.55,quality-.12);slow=0;}
    if(fast>240){quality=Math.min(1,quality+.08);fast=0;}
    const rect=base.getBoundingClientRect();
    if(!rect.width||!rect.height){schedule();return;}
    const dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(850000/(rect.width*rect.height)));
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
    const playing=typeof audio!=='undefined'&&!audio.paused;
    const signal=playing&&typeof fastBeatSignal==='function'?fastBeatSignal():{};
    motion.update(elapsed,signal,playing);
    const gain=Number(document.getElementById('fluidIntensity')?.value)||1.35;
    const radius=Math.min(w*.61,h*.43),cx=w*.5,cy=h*.5,t=motion.time;
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#010108';ctx.fillRect(0,0,w,h);
    const halo=ctx.createRadialGradient(cx,cy,radius*.15,cx,cy,radius*1.25);
    halo.addColorStop(0,'#020213');halo.addColorStop(.48,'#08052c');halo.addColorStop(.76,'#070d30');halo.addColorStop(1,'#010108');
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    const stride=quality<.75?2:1, segments=quality<.75?24:36;
    ctx.lineCap='round';
    for(let i=0;i<192;i+=stride){
      const seed=IrisMath.noise(i+1),front=IrisMath.point(i,.5,motion,gain).depth;
      const shine=Math.pow(.5+.5*Math.sin(i*.032-t*.8),7);
      const brightness=(.12+front*.24+shine*.55)*(1+motion.energy*.4);
      ctx.beginPath();
      for(let j=0;j<=segments;j++){
        const p=IrisMath.point(i,j/segments,motion,gain),x=cx+p.x*radius,y=cy+p.y*radius;
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=palette[Math.floor(seed*palette.length)];
      ctx.globalAlpha=brightness*.28;ctx.lineWidth=(3+shine*3)*dpr;ctx.stroke();
      ctx.globalAlpha=brightness;ctx.lineWidth=(.42+shine*.75+motion.treble*.3)*dpr;ctx.stroke();
    }
    // Stable individual seeds keep the rim sparkling without random frame flicker.
    const count=Math.round(640*quality);
    for(let i=0;i<count;i++){
      const seed=IrisMath.noise(i+900),strand=Math.floor(IrisMath.noise(i+1700)*192);
      const u=.82+IrisMath.noise(i+2400)*.31;
      const p=IrisMath.point(strand,u,motion,gain);
      const flicker=.4+.6*Math.sin(t*(1+seed*2)+seed*40)**2;
      const near=p.depth, size=(1.5+seed*5)*(1+near*2.2)*dpr;
      ctx.globalAlpha=(.18+near*.4)*flicker*(1+motion.treble*.7);
      const drift=Math.sin(t*.8+seed*100)*.012;
      ctx.drawImage(sprites[Math.floor(seed*palette.length)],cx+(p.x+drift)*radius-size/2,cy+p.y*radius-size/2,size,size);
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';schedule();
  }
  choose();
})();
