// Plasma Ultra: thick, elongated, rounded multicolor plasma pulses. No outer halo rings.
function tunedRingPath(cx,cy,radius,signal,scale){return buildContourPath(cx,cy,radius*scale,signal);}
function plasmaColorAtPhase(phase,alpha=1){const h=((phase%1)+1)%1;const stops=[[0,[240,247,255]],[.14,[132,72,255]],[.30,[67,126,255]],[.46,[48,246,177]],[.62,[255,226,61]],[.78,[255,78,184]],[.92,[116,51,255]],[1,[240,247,255]]];let a=stops[0],b=stops.at(-1);for(let i=0;i<stops.length-1;i++){if(h>=stops[i][0]&&h<=stops[i+1][0]){a=stops[i];b=stops[i+1];break;}}const t=(h-a[0])/Math.max(.0001,b[0]-a[0]),c=a[1].map((v,i)=>Math.round(v+(b[1][i]-v)*t));return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;}
function makePlasmaGradient(cx,cy,time,alpha=1){if(typeof ctx.createConicGradient!=='function')return plasmaColorAtPhase(time*.04,alpha);const g=ctx.createConicGradient(time*.025*TAU-.75,cx,cy);[[0,[240,247,255]],[.14,[132,72,255]],[.30,[67,126,255]],[.46,[48,246,177]],[.62,[255,226,61]],[.78,[255,78,184]],[.92,[116,51,255]],[1,[240,247,255]]].forEach(([p,c])=>g.addColorStop(p,`rgba(${c[0]},${c[1]},${c[2]},${alpha})`));return g;}

drawLayeredRing=function(path,cx,cy,radius,signal,time){const e=Math.pow(clamp(signal.energy),.78),k=clamp(signal.kick||0);ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';ctx.lineCap='round';const p1=tunedRingPath(cx,cy,radius,signal,1.012),p2=tunedRingPath(cx,cy,radius,signal,.996);ctx.strokeStyle=makePlasmaGradient(cx,cy,time,1);ctx.lineWidth=radius*(.034+k*.006);ctx.shadowBlur=radius*(.055+e*.025);ctx.shadowColor='rgba(155,75,255,.75)';ctx.stroke(p1);ctx.strokeStyle=`rgba(255,255,255,${.90+e*.10})`;ctx.lineWidth=radius*(.012+k*.002);ctx.shadowBlur=radius*.025;ctx.shadowColor='white';ctx.stroke(p2);ctx.restore();};

// Long, thick rounded plasma pulses. Never pointed.
drawFlameRay=function(cx,cy,radius,angle,length,width,phase,alpha,kickBoost=0){const r0=radius*.985;const longLength=Math.max(length,radius*(.25+kickBoost*.10));const r1=r0+longLength;const x0=cx+Math.cos(angle)*r0,y0=cy+Math.sin(angle)*r0,x1=cx+Math.cos(angle)*r1,y1=cy+Math.sin(angle)*r1;const thickness=width*(7.2+kickBoost*1.8);const grad=ctx.createLinearGradient(x0,y0,x1,y1);grad.addColorStop(0,plasmaColorAtPhase(phase,Math.min(1,alpha+.28)));grad.addColorStop(.30,plasmaColorAtPhase(phase,alpha*.86));grad.addColorStop(.72,plasmaColorAtPhase(phase,alpha*.38));grad.addColorStop(1,plasmaColorAtPhase(phase,0));ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=grad;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=thickness;ctx.shadowBlur=thickness*1.8;ctx.shadowColor=plasmaColorAtPhase(phase,.62);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.restore();};

drawFlameField=function(cx,cy,radius,signal,time){const e=clamp(signal.energy),k=clamp(signal.kick||0),phase=time*.035,count=14;for(let i=0;i<count;i++){const angle=i/count*TAU+.035*Math.sin(i*2.7),s=.5+.5*Math.sin(i*12.9898+2.37),s2=.5+.5*Math.sin(i*5.398+1.17);const length=radius*(.20+s*.12+e*.08+k*.10);const width=radius*(.036+s2*.020+e*.007+k*.012);const alpha=.27+e*.20+s*.13+k*.16;drawFlameRay(cx,cy,radius,angle,length,width,phase+i/count,alpha,k);}};

drawAurora=function(width,height){const signal=fastBeatSignal(),cx=width*.5,cy=height*.43,minSide=Math.min(width,height),r=minSide*(.325+signal.bass*.004+(signal.kick||0)*.006),path=buildContourPath(cx,cy,r,signal);
 // No giant radial halo/outer rings. Keep only the actual plasma bands and pulses.
 drawFlameField(cx,cy,r,signal,contourClock);
 drawLayeredRing(path,cx,cy,r,signal,contourClock);
 drawTravellingPulse(cx,cy,r*1.01,signal,contourClock);
 drawHotSpots(cx,cy,r,signal,contourClock);
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fill(path);ctx.restore();
};
