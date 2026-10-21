// SPDX-License-Identifier: AGPL-3.0-only
// Original Canvas 2D renderer: coherent rising folds and translucent light sheets.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const STRANDS=24,TAU=Math.PI*2;
const smooth=value=>value*value*value*(value*(value*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const fract=value=>value-Math.floor(value);
function hash(x,y){let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
 return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v)*2-1;
}
export function flameGrowth(completed){
 const count=Number.isFinite(completed)?Math.max(0,completed):0;
 return .32+.68*(1-Math.exp(-count/5));
}
export function ribbonPoint(strand,u,time){
 u=clamp(u,0,1);
 const side=strand/(STRANDS-1)*2-1,envelope=Math.sin(Math.PI*u)**.72;
 // Noise travels upward: broad packets inflate, turn and stretch the sheets.
 // Neighboring strands share the updraft, while separate depths fold independently.
 const rise=u*3.8-time*.72;
 const billow=noise(2.6,rise),curl=noise(6.4+side*.55,rise*1.45);
 const center=envelope*(noise(1.2,u*2.7-time*.43)*.075+noise(4.7,u*6-time*.91)*.025);
 const radius=.055+envelope*(.235+billow*.075);
 const twist=side*2.5+curl*1.7+noise(8.2,u*2.4-time*.32)*1.1;
 const fold=Math.sin(twist)*(.09+noise(9.1,rise)*.025)*envelope;
 const detail=noise(side*2.1+12,u*9-time*1.35)*.012*envelope;
 return {x:center+side*radius+fold+detail,y:u};
}
export function createFlameRenderer(){
 const canvas=document.createElement('canvas');canvas.className='living-flame-canvas';canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d',{alpha:false});
 let host=null,frame=0,last=0,time=0,target=.32,growth=.32,intensity=.4,quality=1,slow=0,visible=true,pulse=0,day=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.target===host){visible=entry.isIntersecting;if(visible)schedule();else stop();}}):null;
 // Reuse the sampled mesh; drawing the membranes and their edges shares geometry.
 const mesh=Array.from({length:STRANDS},()=>new Float32Array(65*2));
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
 function schedule(){if(ctx&&host?.isConnected&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
 function glow(x,y,radius,color,power){
  const light=ctx.createRadialGradient(x,y,0,x,y,radius);
  light.addColorStop(0,`rgba(${color},${power})`);light.addColorStop(.24,`rgba(${color},${power*.43})`);light.addColorStop(1,`rgba(${color},0)`);
  ctx.fillStyle=light;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
 }
 function draw(now){
  frame=0;if(!ctx||!host?.isConnected||!visible||document.hidden)return;
  const elapsed=last?clamp((now-last)/1000,0,.06):1/60;last=now;
  if(elapsed>.045){if(++slow>16){quality=Math.max(.65,quality-.12);slow=0;}}else slow=Math.max(0,slow-1);
  if(reduced.matches){growth=target;time=2.4;pulse=0;}else{time+=elapsed;growth+=(target-growth)*(1-Math.exp(-elapsed*3));pulse*=Math.exp(-elapsed*1.8);}
  const rect=host.getBoundingClientRect();if(!rect.width||!rect.height){last=0;return;}
  const dpr=Math.min(devicePixelRatio||1,1.5)*quality,w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  host.dataset.growth=growth.toFixed(4);host.dataset.frame=String(Math.round(time*1000));
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle='#030717';ctx.fillRect(0,0,w,h);
  const center=w*.5,base=h*.93,height=h*.85*growth,width=w*(.08+.42*growth),brightness=Math.min(1,.72+intensity*.18+pulse*.25);
  const segments=quality<.8?40:64,stride=quality<.8?2:1;
  const point=(strand,u)=>{
   const p=ribbonPoint(strand,u,time),depth=Math.sin(strand*1.7)*.5+.5;
   // Uneven tips breathe independently; the base stays anchored during growth.
   const tip=1-.085*depth+.025*noise(strand*.6,time*.5);
   return {x:center+p.x*width*1.35,y:base-u*height*tip};
  };
  for(let strand=0;strand<STRANDS;strand++)for(let j=0;j<=segments;j++){
   const p=point(strand,j/segments);mesh[strand][j*2]=p.x;mesh[strand][j*2+1]=p.y;
  }
  const trace=strand=>{
   const points=mesh[strand];for(let j=0;j<=segments;j++)j?ctx.lineTo(points[j*2],points[j*2+1]):ctx.moveTo(points[j*2],points[j*2+1]);
  };
  const tint=(strand)=>Math.sin(strand*.47+.5)>.28?'255,103,42':'40,163,255';
  ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
  glow(center,base-height*.46,height*.68,'12,64,171',.13*brightness);
  // The soft body is a stack of translucent, folding membranes, rather than
  // an opaque flame silhouette. Its warm/cool layers meet at bright caustics.
  for(let strand=0;strand<STRANDS-2;strand+=stride){
   const color=tint(strand),sheet=ctx.createLinearGradient(0,base,0,base-height);
   sheet.addColorStop(0,`rgba(${color},0)`);sheet.addColorStop(.15,`rgba(${color},.02)`);sheet.addColorStop(.4,`rgba(${color},.17)`);sheet.addColorStop(.67,`rgba(${color},.12)`);sheet.addColorStop(.9,`rgba(${color},.03)`);sheet.addColorStop(1,`rgba(${color},0)`);
   ctx.beginPath();trace(strand);
   const other=mesh[strand+2];for(let j=segments;j>=0;j--)ctx.lineTo(other[j*2],other[j*2+1]);ctx.closePath();
   ctx.fillStyle=sheet;ctx.globalAlpha=brightness*(.7+.3*Math.sin(strand*2.1+time*.25)**2);ctx.fill();
  }
  // Light gathers on the moving folds, which makes the sheets read as volume.
  for(let strand=0;strand<STRANDS;strand+=stride){
   const color=tint(strand),near=.45+.55*(.5+.5*Math.sin(strand*1.31+time*.3));
   const gradient=ctx.createLinearGradient(0,base,0,base-height);
   gradient.addColorStop(0,`rgba(${color},0)`);gradient.addColorStop(.12,`rgba(${color},.04)`);gradient.addColorStop(.36,`rgba(${color},${near*.54})`);gradient.addColorStop(.65,`rgba(${color},${near*.38})`);gradient.addColorStop(.88,`rgba(${color},.10)`);gradient.addColorStop(1,`rgba(${color},0)`);
   ctx.beginPath();trace(strand);ctx.strokeStyle=gradient;
   ctx.globalAlpha=.10*brightness;ctx.lineWidth=(4+near*3)*dpr;ctx.stroke();
   ctx.globalAlpha=(strand%3===0?.8:.36)*brightness;ctx.lineWidth=(.4+near*.45)*dpr;ctx.stroke();
   // Irregular packets of light ride the flow instead of blinking in fixed spots.
   const u=fract(time*(.16+(strand%5)*.009)+hash(strand,7)),fade=Math.sin(Math.PI*u)**2;
   ctx.beginPath();for(let j=0;j<=12;j++){const p=point(strand,clamp(u+(j/12-.5)*.18,0,1));j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
   ctx.globalAlpha=fade*near*brightness*(strand%3===0?1:.45);ctx.lineWidth=(.65+near*.5)*dpr;
   ctx.strokeStyle=color.startsWith('255')?'#fff0c5':'#c8f9ff';ctx.stroke();
  }
  // Broad, soft pockets sit on the fluid, with a small bright core and no strobe.
  for(let i=0;i<4;i++){
   const u=fract(time*(.15+i*.007)+i*.271+.2),fade=Math.sin(Math.PI*u)**2;
   const p=point(4+i*5,u),radius=(8+growth*16)*dpr*(.7+fade*.5),power=fade*brightness;
   const color=i%2?'255,112,42':'30,194,255';
   ctx.globalAlpha=1;glow(p.x,p.y,radius*1.8,color,power*.25);glow(p.x,p.y,radius*.7,color,power*.7);glow(p.x,p.y,radius*.25,'241,251,255',power*.7);
  }
  // Sparse embers drift out of the updraft and fade above the flame, without
  // respawning visibly or jumping when a task is completed.
  for(let i=0;i<28;i++){
   const u=fract(time*(.13+hash(i,2)*.1)+hash(i,13)),fade=Math.sin(Math.PI*u)**3;
   const p=point(i%STRANDS,Math.min(u*1.18,1)),drift=noise(i*2.3,time*.6+u*3)*width*.11;
   const x=p.x+drift,y=p.y-Math.max(0,u*1.18-1)*height;
   ctx.globalAlpha=fade*(.23+pulse*.35)*brightness;ctx.fillStyle=i%3?'#79dfff':'#ffc078';
   ctx.beginPath();ctx.ellipse(x,y,(.3+hash(i,4)*.35)*dpr,(.65+hash(i,5)*.8)*dpr,noise(i,time*.4)*.4,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(!reduced.matches)schedule();
 }
 const onVisibility=()=>{if(document.hidden)stop();else schedule();};document.addEventListener('visibilitychange',onVisibility);
 const onReduced=()=>{stop();schedule();};reduced.addEventListener('change',onReduced);
 const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>schedule()):null;
 return {
  mount(next,options={}){
   const nextTarget=flameGrowth(options.completed||0),sameDay=day!==null&&options.day===day;
   if(next&&sameDay&&nextTarget>target&&!reduced.matches)pulse=Math.min(1,pulse+.65);
   if(!next||options.day!==day)pulse=0;day=options.day;target=nextTarget;
   if(host!==next){if(host){observer?.unobserve(host);resize?.unobserve(host);}stop();host=next;visible=true;if(host){host.append(canvas);observer?.observe(host);resize?.observe(host);}}
   intensity=clamp(Number(options.intensity)||0,0,1);
   if(host){host.dataset.targetGrowth=target.toFixed(4);if(!ctx)host.textContent='🔥';schedule();}
  },
  destroy(){stop();observer?.disconnect();resize?.disconnect();document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onReduced);canvas.remove();host=null;}
 };
}
