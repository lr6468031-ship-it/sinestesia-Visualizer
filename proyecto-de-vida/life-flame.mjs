// SPDX-License-Identifier: AGPL-3.0-only
// Original lightweight filament renderer, inspired by the supplied video.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function flameGrowth(completed){
 const count=Number.isFinite(completed)?Math.max(0,completed):0;
 return .32+.68*(1-Math.exp(-count/5));
}
export function ribbonPoint(strand,u,time){
 const side=(strand-8.5)/8.5;
 const envelope=Math.sin(Math.PI*clamp(u,0,1))**.65;
 const fold=Math.sin(u*9.8-time*.85+side*.65)*.10+Math.sin(u*17.5+time*.55+side*.4)*.045;
 const width=.19+.11*Math.sin(u*10-time*.72+side*1.8);
 const x=side*width+fold*envelope+Math.sin(u*13.5-time+side*.7)*.035;
 return {x,y:u};
}
export function createFlameRenderer(){
 const canvas=document.createElement('canvas');canvas.className='living-flame-canvas';canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d',{alpha:false});
 let host=null,frame=0,last=0,time=0,target=.32,growth=.32,intensity=.4,quality=1,slow=0,visible=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.target===host){visible=entry.isIntersecting;if(visible)schedule();else stop();}}):null;
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
 function schedule(){if(ctx&&host?.isConnected&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
 function draw(now){
  frame=0;if(!ctx||!host?.isConnected||!visible||document.hidden)return;
  const elapsed=last?clamp((now-last)/1000,0,.06):1/60;last=now;
  if(elapsed>.045){if(++slow>16){quality=Math.max(.65,quality-.12);slow=0;}}else slow=Math.max(0,slow-1);
  if(reduced.matches){growth=target;time=2.4;}else{time+=elapsed;growth+=(target-growth)*(1-Math.exp(-elapsed*3));}
  const rect=host.getBoundingClientRect();
  if(!rect.width||!rect.height){last=0;return;}
  const dpr=Math.min(devicePixelRatio||1,1.5)*quality,w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  host.dataset.growth=growth.toFixed(4);host.dataset.frame=String(Math.round(time*1000));
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle='#030717';ctx.fillRect(0,0,w,h);
  const center=w*.5,base=h*.91,height=h*.82*growth,width=w*(.34+.18*growth),brightness=.65+intensity*.35;
  const point=(strand,u)=>{const p=ribbonPoint(strand,u,time);return {x:center+p.x*width*2.0,y:base-u*height};};
  // A soft halo stays attached to the living column; it never fills the card.
  const halo=ctx.createRadialGradient(center,base-height*.48,0,center,base-height*.48,height*.65);
  halo.addColorStop(0,`rgba(15,70,130,${.19*brightness})`);halo.addColorStop(.45,'rgba(12,35,92,.10)');halo.addColorStop(1,'rgba(0,0,20,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
  const segments=quality<.8?32:48,stride=quality<.8?2:1;
  // Colored membranes stretch between neighboring filaments, like the broad
  // translucent folds in the reference rather than a bundle of identical lines.
  for(let band=0;band<8;band++){
   const a=band*2,b=a+2;ctx.beginPath();
   for(let j=0;j<=segments;j++){const p=point(a,j/segments);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
   for(let j=segments;j>=0;j--){const p=point(b,j/segments);ctx.lineTo(p.x,p.y);}ctx.closePath();
   const sheet=ctx.createLinearGradient(0,base,0,base-height),warm=band%3===0;
   sheet.addColorStop(0,'rgba(0,10,35,0)');sheet.addColorStop(.2,warm?'rgba(255,75,25,.025)':'rgba(20,80,255,.025)');sheet.addColorStop(.48,warm?'rgba(255,105,55,.08)':'rgba(55,165,255,.07)');sheet.addColorStop(.76,'rgba(75,100,255,.035)');sheet.addColorStop(1,'rgba(10,20,80,0)');
   ctx.fillStyle=sheet;ctx.globalAlpha=brightness;ctx.fill();
  }
  // Translucent sheets fold around a shared flow, so neighboring lines bend together.
  for(let i=0;i<18;i+=stride){
   const cyan=i%4<2,near=.3+.7*(.5+.5*Math.sin(i*1.7+time*.35));
   const points=[];for(let j=0;j<=segments;j++)points.push(point(i,j/segments));
   ctx.beginPath();points.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
   const gradient=ctx.createLinearGradient(0,base,0,base-height);
   const tint=cyan?'50,180,255':'255,100,55';
   gradient.addColorStop(0,`rgba(${tint},0)`);gradient.addColorStop(.15,`rgba(${tint},${.12*near})`);gradient.addColorStop(.48,`rgba(${tint},${.45*near*brightness})`);gradient.addColorStop(.82,`rgba(${tint},${.16*near})`);gradient.addColorStop(1,`rgba(${tint},0)`);
   ctx.strokeStyle=gradient;ctx.lineWidth=(4+near*3)*dpr;ctx.globalAlpha=.14;ctx.stroke();
   ctx.globalAlpha=1;ctx.lineWidth=(.4+near*.6)*dpr;ctx.stroke();
   // Thin traveling highlights rise along the filaments, with smooth fade in/out.
   const u=(time*(.10+(i%3)*.014)+i*.173)%1;
   const fade=Math.sin(Math.PI*u)**2;
   ctx.beginPath();for(let j=0;j<=10;j++){const p=point(i,clamp(u+(j/10-.5)*.14,0,1));j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
   ctx.globalAlpha=fade*(.35+near*.65)*brightness;
   ctx.strokeStyle=cyan?'#baffff':'#ffe3af';ctx.lineWidth=(.75+near*.7)*dpr;
   ctx.shadowColor=cyan?'#00cfff':'#ff6c22';ctx.shadowBlur=(8+near*6)*dpr;ctx.stroke();ctx.shadowBlur=0;
  }
  // The reference has moving cyan and warm knots where the ribbons concentrate.
  for(let i=0;i<3;i++){
   const u=.3+.15*i+.07*Math.sin(time*.75+i*2),p=point(i*5+2,u),pulse=.5+.5*Math.sin(time*.8+i*1.9)**2;
   const radius=(10+growth*12)*dpr,power=pulse*brightness*(.45+growth*.35);
   const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
   glow.addColorStop(0,`rgba(240,255,255,${power})`);glow.addColorStop(.15,i===1?`rgba(255,231,135,${power*.8})`:`rgba(65,230,255,${power*.7})`);glow.addColorStop(.48,i===1?'rgba(255,80,30,.14)':'rgba(0,100,255,.14)');glow.addColorStop(1,'rgba(0,20,80,0)');
   ctx.globalAlpha=1;ctx.fillStyle=glow;ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
  }
  for(let i=0;i<22;i++){
   const u=(time*(.13+(i%4)*.01)+i*.618)%1,p=point(i%18,u),fade=Math.sin(Math.PI*u)**3;
   const x=p.x+Math.sin(i*32+time*.3)*width*.13;
   ctx.globalAlpha=fade*.45*brightness;ctx.fillStyle=i%3?'#84eaff':'#ffc06a';ctx.beginPath();ctx.arc(x,p.y,(.35+(i%3)*.18)*dpr,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(!reduced.matches)schedule();
 }
 const onVisibility=()=>{if(document.hidden)stop();else schedule();};document.addEventListener('visibilitychange',onVisibility);
 const onReduced=()=>{stop();schedule();};reduced.addEventListener('change',onReduced);
 const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>schedule()):null;
 return {
  mount(next,options={}){
   if(host!==next){if(host){observer?.unobserve(host);resize?.unobserve(host);}stop();host=next;visible=true;if(host){host.append(canvas);observer?.observe(host);resize?.observe(host);}}
   target=flameGrowth(options.completed||0);intensity=clamp(Number(options.intensity)||0,0,1);
   if(host){host.dataset.targetGrowth=target.toFixed(4);if(!ctx)host.textContent='🔥';schedule();}
  },
  destroy(){stop();observer?.disconnect();resize?.disconnect();document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onReduced);canvas.remove();host=null;}
 };
}
