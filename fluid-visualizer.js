// Sinestesia Fluido 23. Original folded-surface renderer inspired by the supplied video.
// No Vizz.fm source, media or assets are bundled. Existing Plasma remains available.
(() => {
  'use strict';
  const selector = document.getElementById('visualMode');
  const intensity = document.getElementById('fluidIntensity');
  const notice = document.getElementById('visualNotice');
  const surface = document.createElement('canvas');
  surface.id = 'fluidCanvas'; surface.setAttribute('aria-hidden','true');
  canvas.parentElement.insertBefore(surface, canvas.nextSibling);
  const gl = surface.getContext('webgl', {alpha:false, antialias:false, depth:true, stencil:false});
  const vertex = `
    precision highp float;
    attribute vec2 uv;
    uniform float time, bass, mid, treble, aspect, layer;
    varying vec3 normal, position;
    varying vec2 param;
    const float PI=3.14159265;
    vec3 shape(vec2 q) {
      float a=q.x*2.0*PI, b=q.y*PI;
      float sb=sin(b), cb=cos(b);
      float fold=sin(a*3.0+cb*3.8+time*.24);
      float ripple=sin(a*11.0+b*9.0-time*.8)*sin(b*7.0+a*3.0+time*.3);
      float radius=1.0+fold*sb*sb*(.27+bass*.13)+ripple*.045*sb;
      float twist=.55*sin(b*3.0+time*.18)+.16*sin(a*2.0+time*.1);
      vec3 p=vec3(cos(a+twist)*sb, cb*1.12, sin(a+twist)*sb)*radius;
      p.x+=.13*sin(b*5.0+time*.32)*sb;
      p.y+=.10*sin(a*5.0+b*4.0-time*.22)*sb*(.5+mid);
      p*=1.0+layer*.026;
      return p;
    }
    vec3 rotate(vec3 p){
      float a=time*.11+.5, b=.3*sin(time*.07)-.24;
      p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
      p.xy=mat2(cos(b),-sin(b),sin(b),cos(b))*p.xy;
      return p;
    }
    void main(){
      vec3 p=shape(uv);
      vec3 du=shape(uv+vec2(.0008,0.0))-p;
      vec3 dv=shape(uv+vec2(0.0,.0008))-p;
      normal=rotate(normalize(cross(du,dv)+vec3(.00000001)));
      p=rotate(p);position=p;param=uv;
      float zoom=.67+bass*.035;
      float perspective=3.6/(3.6-p.z*.45);
      gl_Position=vec4(p.x*zoom*perspective,p.y*zoom*perspective*aspect+.12,p.z*.25,1.0);
    }`;
  const fragment = `
    precision mediump float;
    uniform float time, bass, mid, treble, layer, intensity;
    varying vec3 normal, position;
    varying vec2 param;
    void main(){
      vec3 n=normalize(normal);
      float facing=abs(n.z);
      float fresnel=pow(1.0-facing,2.0);
      float drift=time*.055;
      float flow=sin(param.x*19.0+sin(param.y*21.0+drift)*2.0+position.z*3.0);
      float warmth=.5+.5*sin(param.y*7.0+param.x*6.0+drift+flow*.4);
      vec3 blue=vec3(.075,.18,.82), violet=vec3(.53,.11,.85);
      vec3 rose=vec3(1.0,.30,.69), gold=vec3(1.0,.82,.43);
      vec3 c=mix(blue,violet,.5+.5*sin(position.y*2.0+drift));
      c=mix(c,rose,smoothstep(.2,.85,warmth)*.8);
      c=mix(c,gold,pow(warmth,5.0)*.75);
      float turbulence=sin(param.x*43.0+sin(param.y*37.0+time*.13)*3.0);
      turbulence+=.45*sin(param.y*89.0+sin(param.x*71.0)*2.0);
      float rib=.5+.5*sin(param.x*330.0+sin(param.y*34.0+flow)*8.0+turbulence*5.0+time*.15);
      float vein=pow(rib,18.0);
      float light=.22+.65*abs(dot(n,normalize(vec3(-.5,.7,1.0))));
      float spec=pow(max(0.0,dot(n,normalize(vec3(.4,.65,.8)))),32.0);
      c*=light*(.9+bass*.32);
      c+=mix(vec3(.10,.38,.95),gold,warmth)*vein*(.12+treble*.32);
      c+=vec3(.55,.76,1.0)*fresnel*(.45+mid*.4)+vec3(1.0,.9,.8)*spec*.65;
      if(layer>0.5){
        float filament=pow(.5+.5*sin(param.y*340.0+flow*5.0+turbulence*7.0),28.0);
        float opacity=(filament*.075+fresnel*.12)*intensity;
        gl_FragColor=vec4(c*1.8,opacity);
      } else {
        c*=intensity;
        gl_FragColor=vec4(c/(vec3(1.0)+c*.35),.88);
      }
    }`;
  let program, locations, count, ready=false, contextLost=false;
  let buffer, elements;
  function build(){
    function compile(type,src){
      const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(log);}
      return shader;
    }
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const cols=192,rows=112,points=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)points.push(x/cols,.001+y/rows*.998);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);
    }
    count=indices.length;
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    elements=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    const attribute=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    locations={};for(const name of ['time','bass','mid','treble','aspect','layer','intensity'])locations[name]=gl.getUniformLocation(program,name);
    gl.clearColor(0,0,0,1);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    ready=true;
  }
  if(gl){try{build();}catch(e){console.warn('Fluido unavailable:',e);}}
  function choose(){
    window.sinestesiaFluidActive=selector.value==='fluid'&&ready&&!contextLost;
    surface.hidden=!window.sinestesiaFluidActive;
    canvas.style.visibility=window.sinestesiaFluidActive?'hidden':'visible';
    intensity.disabled=!window.sinestesiaFluidActive;
    notice.textContent=selector.value==='fluid'&&!window.sinestesiaFluidActive?'Fluido no está disponible en este dispositivo. Se muestra Plasma.':'';
  }
  selector.addEventListener('change',choose);
  surface.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;choose();});
  surface.addEventListener('webglcontextrestored',()=>{contextLost=false;try{build();}catch{ready=false;}choose();});
  // Use Plasma's single scheduler, audio analyser, visibility handling and controls.
  const previousDraw=drawAurora;
  let lastTime=0,slowFrames=0,quality=1;
  drawAurora=function(width,height){
    if(!window.sinestesiaFluidActive){previousDraw(width,height);return;}
    const now=performance.now();
    if(!audio.paused&&lastTime&&now-lastTime>43)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    lastTime=now;
    if(slowFrames>60){quality=Math.max(.65,quality-.12);slowFrames=0;}
    const dpr=Math.min(window.devicePixelRatio||1,1.4,Math.sqrt(420000/(width*height)))*quality;
    const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
    const signal=fastBeatSignal();
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
    gl.uniform1f(locations.time,plasmaClock);gl.uniform1f(locations.bass,signal.bass);
    gl.uniform1f(locations.mid,signal.mid);gl.uniform1f(locations.treble,signal.treble);
    gl.uniform1f(locations.aspect,width/height);gl.uniform1f(locations.intensity,Number(intensity.value));
    gl.uniform1f(locations.layer,0);gl.disable(gl.BLEND);gl.depthMask(true);
    gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,0);
    gl.uniform1f(locations.layer,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
    gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,0);
    gl.depthMask(true);gl.disable(gl.BLEND);
  };
  choose();
})();
