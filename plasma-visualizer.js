// Plasma 21: continuous GPU field, bounded pixel budget, one animation loop.
(() => {
  'use strict';
  cancelAnimationFrame(animationFrame);
  const surface = document.createElement('canvas');
  const gl = surface.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  let program, uniforms, lost = false;
  const vertex = `attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}`;
  const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
  uniform vec2 resolution;
  uniform float time,bass,mid,treble;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float cloud(vec2 p){return noise(p)*.57+noise(p*2.03+7.)*.28+noise(p*4.01+17.)*.15;}
  void main(){
    vec2 p=(gl_FragCoord.xy-resolution*vec2(.5,.57))/min(resolution.x,resolution.y);
    float r=length(p);vec2 d=p/max(r,.001);
    float t=time*.32;
    float n=cloud(d*3.8+vec2(t,-t*.6));
    float fine=cloud(d*11.+vec2(-t*1.7,t));
    float radius=.287+bass*.009;
    float edge=radius+(n-.5)*(.009+mid*.014)+(fine-.5)*.003;
    float dist=r-edge;
    float energy=clamp(bass*.55+mid*.3+treble*.15,0.,1.);
    float core=exp(-abs(dist)/.0028);
    float blue=exp(-abs(dist+.009)/.007);
    float pink=exp(-abs(dist-.009)/.006);
    float glow=exp(-abs(dist)/(.019+energy*.016));
    // Continuous curls in a radial field, no repeated dots or rainbow sectors.
    float swirl=cloud(d*(6.+dist*15.)+vec2(t*.7,-t)+dist*vec2(9.,-14.));
    float strands=pow(clamp(swirl*1.45-.25,0.,1.),2.);
    float reach=.055+energy*.075+strands*.09;
    float plume=exp(-max(dist,0.)/reach)*smoothstep(-.008,.018,dist);
    plume*=strands*(.22+energy*.72);
    float tendril=pow(.5+.5*sin(dist*105.-swirl*15.-t*3.),6.);
    plume*=.55+tendril*.65;
    float inner=exp(-abs(r-radius*.77-(n-.5)*.014)/.012)*(.08+bass*.16);
    vec3 col=vec3(.07,.18,1.)*(blue*.8+glow*.35+inner);
    col+=vec3(.52,.035,1.)*(plume*1.25+glow*.3);
    col+=vec3(1.,.17,.65)*pink*.62;
    col+=vec3(.76,.91,1.)*core*(1.1+treble*.5);
    col*=smoothstep(radius*.62,radius*.87,r);
    col*=1.-smoothstep(.46,.65,r);
    col=vec3(1.)-exp(-col*1.45);
    gl_FragColor=vec4(col,1.);
  }`;
  function init() {
    function compile(type, code) {
      const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) { const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message); }
      return s;
    }
    const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    uniforms={};for(const key of ['resolution','time','bass','mid','treble']) uniforms[key]=gl.getUniformLocation(program,key);
  }
  let gpu=false;
  if(gl) {try {init();gpu=true;}catch(e){console.warn('Plasma fallback:',e);}}
  surface.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
  surface.addEventListener('webglcontextrestored',()=>{try{init();gpu=true;lost=false;}catch{gpu=false;}});
  const originalGraph=ensureAudioGraph;
  ensureAudioGraph=function(){const ok=originalGraph();if(ok){if(analyser.fftSize!==2048){analyser.fftSize=2048;frequencyData=new Uint8Array(analyser.frequencyBinCount);timeData=new Uint8Array(analyser.fftSize);}analyser.smoothingTimeConstant=.55;}return ok;};
  let width=1,height=1,dirty=true,scale=1,last=0,lastUI=0,clock=0,slow=0;
  let b=0,m=0,h=0;
  function resize(){
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    const ratio=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(500000/(width*height)))*scale;
    canvas.width=surface.width=Math.max(1,Math.round(width*ratio));
    canvas.height=surface.height=Math.max(1,Math.round(height*ratio));
    ctx.setTransform(1,0,0,1,0,0);dirty=false;
  }
  // Replace the base resize callback too; dimensions are measured only on resize.
  window.removeEventListener('resize',resizeCanvas);
  resizeCanvas=()=>{dirty=true;return {width,height};};
  window.addEventListener('resize',resizeCanvas);
  if(window.ResizeObserver)new ResizeObserver(()=>{dirty=true;}).observe(canvas);
  function fallback(){
    const w=canvas.width,hh=canvas.height,r=Math.min(w,hh)*(.287+b*.009),x=w*.5,y=hh*.43;
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,hh);
    const glow=ctx.createRadialGradient(x,y,r*.8,x,y,r*1.65);
    glow.addColorStop(0,'transparent');glow.addColorStop(.25,'#2249b9');glow.addColorStop(.32,'#d2eaff');glow.addColorStop(.4,'#842cbe');glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,hh);
  }
  function frame(now){
    animationFrame=null;if(document.hidden)return;
    const elapsed=last?now-last:16.67;
    if(elapsed<(audio.paused?65:15)){animationFrame=requestAnimationFrame(frame);return;}
    last=now;const dt=Math.min(elapsed,80)/1000;clock+=dt;
    if(!audio.paused && elapsed>25){slow++;}else slow=Math.max(0,slow-1);
    if(slow>90 && scale>.65){scale=Math.max(.65,scale-.1);dirty=true;slow=0;}
    if(dirty)resize();
    let tb=0,tm=0,th=0;
    if(analyser&&!audio.paused){analyser.getByteFrequencyData(frequencyData);tb=averageRange(32,190);tm=averageRange(190,2800);th=averageRange(2800,12500);}
    const follow=(v,t)=>v+(t-v)*(1-Math.exp(-dt*(t>v?24:7)));
    b=follow(b,tb);m=follow(m,tm);h=follow(h,th);
    if(gpu&&!lost){
      gl.viewport(0,0,surface.width,surface.height);gl.useProgram(program);
      gl.uniform2f(uniforms.resolution,surface.width,surface.height);gl.uniform1f(uniforms.time,clock);
      gl.uniform1f(uniforms.bass,b);gl.uniform1f(uniforms.mid,m);gl.uniform1f(uniforms.treble,h);
      gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(surface,0,0);
    }else fallback();
    if(now-lastUI>150){
      lastUI=now;bassValue.textContent=Math.round(b*100);midValue.textContent=Math.round(m*100);trebleValue.textContent=Math.round(h*100);
      if(instrumentValue){
        if(audio.paused || !analyser) instrumentValue.textContent='Plasma 21 · En pausa';
        else {
          analyser.getByteTimeDomainData(timeData);
          const rms=rmsLevel(), transient=Math.max(0,rms-previousRms);previousRms=rms;
          const family=classifyTimbre({bass:b,mid:m,treble:h,centroid:spectralCentroidHz(),flatness:spectralFlatness(),transient,rms});
          const dominant=dominantFrequency(32,190);
          instrumentValue.textContent=`Plasma 21 · ${family.name}${b>.05?' · grave '+Math.round(dominant.hz)+' Hz':''}`;
        }
      }
    }
    animationFrame=requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=null;last=0;if(!document.hidden)animationFrame=requestAnimationFrame(frame);});
  animationFrame=requestAnimationFrame(frame);
})();
