// Plasma Ultra: THICK rounded multicolor plasma bands. Width != length.
function tunedRingPath(cx,cy,radius,signal,scale){return buildContourPath(cx,cy,radius*scale,signal);}

// Restore the multicolor palette from the first version/reference.
function plasmaColorAtPhase(phase,alpha=1){
 const h=((phase%1)+1)%1;
 const stops=[[0,[240,247,255]],[.14,[132,72,255]],[.30,[67,126,255]],[.46,[48,246,177]],[.62,[255,226,61]],[.78,[255,78,184]],[.92,[116,51,255]],[1,[240,247,255]]];
 let a=stops[0],b=stops.at(-1);for(let i=0;i<stops.length-1;i++){if(h>=stops[i][0]&&h<=stops[i+1][0]){a=stops[i];b=stops[i+1];break;}}
 const t=(h-a[0])/Math.max(.0001,b[0]-a[0]),c=a[1].map((v,i)=>Math.round(v+(b[1][i]-v)*t));return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
function makePlasmaGradient(cx,cy,time,alpha=1){if(typeof ctx.createConicGradient!=='function')return plasmaColorAtPhase(time*.04,alpha);const g=ctx.createConicGradient(time*.025*TAU-.75,cx,cy);[[0,[240,247,255]],[.14,[132,72,255]],[.30,[67,126,255]],[.46,[48,246,177]],[.62,[255,226,61]],[.78,[255,78,184]],[.92,[116,51,255]],[1,[240,247,255]]].forEach(([p,c])=>g.addColorStop(p,`rgba(${c[0]},${c[1]},${c[2]},${alpha})`));return g;}

drawLayeredRing=function(path,cx,cy,radius,signal,time){const e=Math.pow(clamp(signal.energy),.78),k=clamp(signal.kick||0);ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';ctx.lineCap='round';const p1=tunedRingPath(cx,cy,radius,signal,1.045),p2=tunedRingPath(cx,cy,radius,signal,1.018),p3=tunedRingPath(cx,cy,radius,signal,.996);ctx.strokeStyle=makePlasmaGradient(cx,cy,time,.38);ctx.lineWidth=radius*(.085+k*.012);ctx.shadowBlur=radius*(.18+e*.08);ctx.shadowColor='rgba(135,65,255,.9)';ctx.stroke(p1);ctx.strokeStyle=makePlasmaGradient(cx,cy,time,1);ctx.lineWidth=radius*(.048+k*.008);ctx.shadowBlur=radius*(.10+e*.05);ctx.stroke(p2);ctx.strokeStyle=`rgba(255,255,255,${.92+e*.08})`;ctx.lineWidth=radius*(.015+k*.003);ctx.shadowBlur=radius*.045;ctx.shadowColor='white';ctx.stroke(p3);ctx.restore();};

// A ray is a rounded thick capsule/column, never a triangle or pointed flame.
drawFlameRay=function(cx,cy,radius,angle,length,width,phase,alpha,kickBoost=0){
 const r0=radius*.985;
 // Keep it SHORT. Audio mainly changes thickness, not height.
 const shortLength=Math.min(length,radius*(.12+kickBoost*.035));
 const r1=r0+shortLength;
 const x0=cx+Math.cos(angle)*r0,y0=cy+Math.sin(angle)*r0,x1=cx+Math.cos(angle)*r1,y1=cy+Math.sin(angle)*r1;
 // Extreme lateral thickness.
 const thickness=width*(9.5+kickBoost*2.2);
 const grad=ctx.createLinearGradient(x0,y0,x1,y1);grad.addColorStop(0,plasmaColorAtPhase(phase,Math.min(1,alpha+.35)));grad.addColorStop(.42,plasmaColorAtPhase(phase,alpha*.72));grad.addColorStop(.78,plasmaColorAtPhase(phase,alpha*.26));grad.addColorStop(1,plasmaColorAtPhase(phase,0));
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=grad;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=thickness;ctx.shadowBlur=thickness*2.7;ctx.shadowColor=plasmaColorAtPhase(phase,.72);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
 // soft wide aura around each band
 ctx.globalAlpha=.32;ctx.lineWidth=thickness*1.65;ctx.shadowBlur=thickness*3.8;ctx.strokeStyle=plasmaColorAtPhase(phase,.24);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.restore();
};

drawFlameField=function(cx,cy,radius,signal,time){const e=clamp(signal.energy),k=clamp(signal.kick||0),phase=time*.035,count=14;for(let i=0;i<count;i++){const angle=i/count*TAU+.035*Math.sin(i*2.7),s=.5+.5*Math.sin(i*12.9898+2.37),s2=.5+.5*Math.sin(i*5.398+1.17);const length=radius*(.075+e*.035+k*.035+s*.025);const width=radius*(.040+s2*.022+e*.008+k*.014);const alpha=.27+e*.20+s*.13+k*.16;drawFlameRay(cx,cy,radius,angle,length,width,phase+i/count,alpha,k);}};

drawAurora=function(width,height){const signal=fastBeatSignal(),cx=width*.5,cy=height*.43,minSide=Math.min(width,height),r=minSide*(.325+signal.bass*.004+(signal.kick||0)*.006),path=buildContourPath(cx,cy,r,signal);const hr=r*(1.55+signal.energy*.06),halo=ctx.createRadialGradient(cx,cy,r*.72,cx,cy,hr);halo.addColorStop(0,'rgba(0,0,0,0)');halo.addColorStop(.55,`rgba(75,60,255,${.05+signal.energy*.04})`);halo.addColorStop(.75,`rgba(190,50,255,${.055+signal.energy*.045})`);halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,hr,0,TAU);ctx.fill();drawFlameField(cx,cy,r,signal,contourClock);drawLayeredRing(path,cx,cy,r,signal,contourClock);ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fill(path);ctx.restore();};
