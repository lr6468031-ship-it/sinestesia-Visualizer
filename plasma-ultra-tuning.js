// Plasma Ultra tuning: broad diffuse plasma bands inspired by the supplied reference.
function tunedRingPath(cx, cy, radius, signal, scale) { return buildContourPath(cx, cy, radius * scale, signal); }

// Reference palette: electric blue -> violet -> fuchsia -> hot white.
function plasmaColorAtPhase(phase, alpha = 1) {
  const h = ((phase % 1) + 1) % 1;
  const stops = [[0,[48,105,255]],[0.25,[83,38,255]],[0.52,[143,45,255]],[0.72,[235,79,255]],[0.88,[255,188,250]],[1,[248,253,255]]];
  let a=stops[0],b=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){if(h>=stops[i][0]&&h<=stops[i+1][0]){a=stops[i];b=stops[i+1];break;}}
  const t=(h-a[0])/Math.max(.0001,b[0]-a[0]); const c=a[1].map((v,i)=>Math.round(v+(b[1][i]-v)*t));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
function makePlasmaGradient(cx,cy,time,alpha=1){
  if(typeof ctx.createConicGradient!=='function') return plasmaColorAtPhase(time*.05,alpha);
  const g=ctx.createConicGradient(time*.035*TAU-.75,cx,cy);
  [[0,[48,105,255]],[.24,[83,38,255]],[.50,[143,45,255]],[.72,[235,79,255]],[.88,[255,188,250]],[1,[248,253,255]]].forEach(([p,c])=>g.addColorStop(p,`rgba(${c[0]},${c[1]},${c[2]},${alpha})`)); return g;
}

drawLayeredRing=function(path,cx,cy,radius,signal,time){
  const e=Math.pow(clamp(signal.energy),.78),k=clamp(signal.kick||0); ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';ctx.lineCap='round';
  const p1=tunedRingPath(cx,cy,radius,signal,1.055),p2=tunedRingPath(cx,cy,radius,signal,1.028),p3=tunedRingPath(cx,cy,radius,signal,1.006),p4=tunedRingPath(cx,cy,radius,signal,.992);
  ctx.strokeStyle=`rgba(45,92,255,${.20+e*.14})`;ctx.lineWidth=radius*(.060+k*.009);ctx.shadowBlur=radius*(.15+e*.07);ctx.shadowColor='rgba(50,70,255,.95)';ctx.stroke(p1);
  ctx.strokeStyle=`rgba(151,49,255,${.38+e*.28})`;ctx.lineWidth=radius*(.046+k*.008);ctx.shadowBlur=radius*(.12+e*.05);ctx.shadowColor='rgba(165,50,255,.98)';ctx.stroke(p2);
  ctx.strokeStyle=makePlasmaGradient(cx,cy,time,1);ctx.lineWidth=radius*(.034+k*.006);ctx.shadowBlur=radius*(.085+e*.04);ctx.shadowColor='rgba(225,100,255,.98)';ctx.stroke(p3);
  ctx.strokeStyle=`rgba(255,255,255,${.94+e*.06})`;ctx.lineWidth=radius*(.016+k*.003);ctx.shadowBlur=radius*(.04+k*.02);ctx.shadowColor='white';ctx.stroke(p4);ctx.restore();
};

drawFlameRay=function(cx,cy,radius,angle,length,width,phase,alpha,kickBoost=0){
  const r0=radius*.975,r1=radius+length,x0=cx+Math.cos(angle)*r0,y0=cy+Math.sin(angle)*r0,x1=cx+Math.cos(angle)*r1,y1=cy+Math.sin(angle)*r1,nx=-Math.sin(angle),ny=Math.cos(angle);
  // Very broad side-to-side plasma band; height remains controlled.
  const bw=width*(6.8+kickBoost*1.4),base=bw*.95,mid=bw*.78,mx=x0+(x1-x0)*.43,my=y0+(y1-y0)*.43;
  const grad=ctx.createLinearGradient(x0,y0,x1,y1);grad.addColorStop(0,plasmaColorAtPhase(phase,Math.min(1,alpha+.38)));grad.addColorStop(.18,plasmaColorAtPhase(phase,alpha));grad.addColorStop(.48,plasmaColorAtPhase(phase,alpha*.50));grad.addColorStop(.78,plasmaColorAtPhase(phase,alpha*.18));grad.addColorStop(1,plasmaColorAtPhase(phase,0));
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=grad;ctx.shadowBlur=bw*(3.8+kickBoost*1.2);ctx.shadowColor=plasmaColorAtPhase(phase,.72);ctx.beginPath();ctx.moveTo(x0+nx*base,y0+ny*base);ctx.quadraticCurveTo(mx+nx*mid,my+ny*mid,x1,y1);ctx.quadraticCurveTo(mx-nx*mid,my-ny*mid,x0-nx*base,y0-ny*base);ctx.closePath();ctx.fill();
  const core=ctx.createLinearGradient(x0,y0,x1,y1);core.addColorStop(0,'rgba(255,255,255,.88)');core.addColorStop(.32,plasmaColorAtPhase(phase,Math.min(1,alpha+.15)));core.addColorStop(1,plasmaColorAtPhase(phase,0));ctx.strokeStyle=core;ctx.lineCap='round';ctx.lineWidth=Math.max(2,bw*.22);ctx.shadowBlur=bw*1.5;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.restore();
};

drawFlameField=function(cx,cy,radius,signal,time){
  const e=clamp(signal.energy),k=clamp(signal.kick||0),phase=time*.045,count=18;
  for(let i=0;i<count;i++){const angle=i/count*TAU+.025*Math.sin(i*2.7),s=.5+.5*Math.sin(i*12.9898+2.37),s2=.5+.5*Math.sin(i*5.398+1.17),local=e*(.40+s2*.72)+k*(.28+s*.72);const length=radius*(.07+s*.16+local*.11);const width=radius*(.038+s2*.030);const alpha=.25+e*.18+s*.16+k*.13;drawFlameRay(cx,cy,radius,angle,length,width,phase+i/count,alpha,k);}
};

drawAurora=function(width,height){
  const signal=fastBeatSignal(),cx=width*.5,cy=height*.43,minSide=Math.min(width,height),r=minSide*(.325+signal.bass*.004+(signal.kick||0)*.006),path=buildContourPath(cx,cy,r,signal);
  const hr=r*(1.58+signal.energy*.08),halo=ctx.createRadialGradient(cx,cy,r*.72,cx,cy,hr);halo.addColorStop(0,'rgba(0,0,0,0)');halo.addColorStop(.48,`rgba(55,60,255,${.05+signal.energy*.05})`);halo.addColorStop(.70,`rgba(132,38,255,${.08+signal.energy*.06})`);halo.addColorStop(.86,`rgba(225,55,255,${.035+signal.energy*.04})`);halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,hr,0,TAU);ctx.fill();
  drawFlameField(cx,cy,r,signal,contourClock);drawLayeredRing(path,cx,cy,r,signal,contourClock);
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fill(path);ctx.restore();
};
