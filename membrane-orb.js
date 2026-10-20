/* Original elastic membrane model and thin-film inspired renderer. */
const MembranePhysics = (() => {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  class Motion {
    constructor(){this.time=0;this.accumulator=0;this.q=[.08,-.06,.04,.02];this.v=[0,0,0,0];this.rotation=[0,0];this.spin=[.15,.23];this.previousKick=0;}
    update(elapsed,settings={},signal={},touch=null){
      const tension=clamp(Number(settings.tension)||1,.3,2.5), damping=clamp(Number(settings.damping)||.7,.1,2);
      const kick=clamp(Number(signal.kick)||0,0,1);
      if(kick>this.previousKick+.15)this.v[0]+=(kick-this.previousKick)*.65;
      this.previousKick=kick;
      this.accumulator+=clamp(Number(elapsed)||0,0,.05);
      const dt=1/120;
      while(this.accumulator>=dt){
        this.time+=dt;
        for(let i=0;i<4;i++){
          const frequency=(2.2+i*.65)*Math.sqrt(tension);
          const drive=Math.sin(this.time*(.9+i*.23)+i*1.7)*(.32+i*.05);
          const pull=touch?(touch.x*Math.cos(i*1.8)+touch.y*Math.sin(i*1.8))*.5:0;
          this.v[i]+=(drive+pull-frequency*frequency*this.q[i]-damping*1.8*this.v[i])*dt;
          this.q[i]=clamp(this.q[i]+this.v[i]*dt,-.24,.24);
        }
        for(let i=0;i<2;i++){
          const target=(i===0?.15:.23)+(touch?(i===0?touch.y:touch.x)*1.2:0);
          this.spin[i]+=(target-this.spin[i])*(1-Math.exp(-dt*3));
          this.rotation[i]+=this.spin[i]*dt;
        }
        this.accumulator-=dt;
      }
    }
  }
  return {Motion};
})();
if(typeof module!=='undefined')module.exports=MembranePhysics;
if(typeof document!=='undefined')(() => {
 'use strict';
 const selector=document.getElementById('visualMode'),base=document.getElementById('visualizer');if(!selector||!base)return;
 const mode='membraneOrb',stage=base.parentElement;
 const option=document.createElement('option');option.value=mode;option.textContent='Órbita iridiscente · Membrana';selector.append(option);
 const canvas=document.createElement('canvas');canvas.id='membraneOrbCanvas';canvas.setAttribute('aria-label','Membrana elástica tridimensional iridiscente');
 Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'none',zIndex:'10',background:'#000',touchAction:'none'});stage.append(canvas);
 const panel=document.createElement('details');panel.className='spectrum-card';panel.hidden=true;
 panel.innerHTML='<summary>Órbita iridiscente · Ajustes</summary><p class="spectrum-help">Membrana elástica: se pliega y recupera su forma. Arrastra para deformarla y girarla; al soltar recupera su movimiento suave.</p><div class="fluid-settings"></div>';
 stage.insertAdjacentElement('afterend',panel);
 const settings={tension:1,damping:.7,film:1,light:1.2,size:.6};
 for(const [key,name,min,max] of [['tension','Tensión',.3,2.5],['damping','Amortiguación',.1,2],['film','Iridiscencia',.4,2],['light','Luz',.3,2],['size','Tamaño',.35,1.2]]){
  const row=document.createElement('label'),input=document.createElement('input'),out=document.createElement('output');row.textContent=name;input.type='range';input.min=min;input.max=max;input.step=.05;input.value=settings[key];input.setAttribute('aria-label',name+' de la membrana');out.textContent=settings[key].toFixed(2);
  input.addEventListener('input',()=>{settings[key]=Number(input.value);out.textContent=settings[key].toFixed(2)});row.append(input,out);panel.querySelector('.fluid-settings').append(row);
 }
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
 if(!gl){option.disabled=true;panel.remove();canvas.remove();return;}
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 let program;
 try{
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
 precision highp float;
 uniform vec2 resolution;uniform vec4 deformation;uniform vec2 rotation;
 uniform float time,film,light,size;
 mat2 rotate(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
 vec3 local(vec3 p){p.xz=rotate(rotation.y)*p.xz;p.yz=rotate(rotation.x)*p.yz;return p;}
 float surface(vec3 p){
   vec3 n=normalize(p+vec3(.00001));
   float r=.78+deformation.x*(n.x*n.x-n.y*n.y)*2.2+deformation.y*n.x*n.y*3.2;
   r+=deformation.z*(3.*n.z*n.z-1.)*1.8+deformation.w*sin(n.y*5.+n.x*3.)*2.;
   float crease=exp(-pow((n.x*.8+n.z*.6+.16*sin(time*.8))*6.,2.));
   r-=crease*.15*pow(sin(time*.65),2.)*sin(n.y*3.+.6);
   r+=.028*sin(n.x*7.+time*.7)*sin(n.y*6.-time*.5)*sin(n.z*5.);
   return (length(p)-r)*.55;
 }
 float scene(vec3 p){return surface(local(p));}
 vec3 normalAt(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx)));}
 vec3 spectrum(float thickness,float cosine){
   // Wavelength-dependent phase: reflected hues change with incidence and thickness.
   vec3 phase=6.2831853*(thickness*cosine/vec3(.65,.51,.44));
   return pow(.5+.5*cos(phase),vec3(2.2));
 }
 void main(){
   vec2 uv=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
   vec3 ro=vec3(0.,0.,3.5),rd=normalize(vec3(uv/size,-1.9));
   float distance=0.,closest=1.;vec3 p=ro;bool hit=false;
   for(int i=0;i<80;i++){p=ro+rd*distance;float d=scene(p);closest=min(closest,d);if(d<.0015){hit=true;break;}distance+=max(.001,d);if(distance>5.)break;}
   if(!hit){gl_FragColor=vec4(vec3(.5,.15,.035)*exp(-closest*65.)*.12*light,1.);return;}
   vec3 n=normalAt(p),view=-rd,lp=local(p);
   float incidence=max(.015,dot(n,view)),rim=pow(1.-incidence,3.5);
   float thickness=film*(1.05+.16*sin(lp.y*4.+lp.x*2.+time*.35)+.13*cos(lp.z*5.-time*.4)+.12*sin(lp.y*7.+lp.z*4.+deformation.x*20.));
   vec3 color=spectrum(thickness,sqrt(.45+.55*incidence));
   vec3 reflection=reflect(rd,n);
   float strip=pow(max(0.,dot(reflection,normalize(vec3(-.55,.8,1.)))),20.);
   float strip2=pow(max(0.,dot(reflection,normalize(vec3(.8,-.3,1.)))),35.);
   float diffuse=.008+.018*max(0.,dot(n,normalize(vec3(-.5,.8,1.))));
   color*=diffuse+rim*4.5;
   color+=spectrum(thickness*.87,.8)*(strip*2.2+strip2*1.4);
   color+=vec3(1.,.95,.83)*(pow(strip,3.)*1.5+pow(1.-incidence,6.)*smoothstep(.1,.8,n.y+n.x*.5)*1.7);
   color*=light;
   color=vec3(1.)-exp(-color*1.25);
   color=pow(color,vec3(.8));
   gl_FragColor=vec4(color,1.);
 }`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 }catch(e){option.disabled=true;canvas.remove();panel.remove();console.error('Membrana:',e);return;}
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const uniforms={};for(const name of ['resolution','deformation','rotation','time','film','light','size'])uniforms[name]=gl.getUniformLocation(program,name);
 const motion=new MembranePhysics.Motion();let frame=0,last=0,active=false,touch=null,quality=1,slow=0;
 function draw(now){
  frame=0;if(!active||document.hidden)return;
  const dt=last?(now-last)/1000:1/60;last=now;
  if(dt>.045){if(++slow>20){quality=Math.max(.5,quality*.85);slow=0;}}else slow=Math.max(0,slow-1);
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height){frame=requestAnimationFrame(draw);return;}
  const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(420000/(rect.width*rect.height)))*quality;
  const w=Math.max(2,Math.round(rect.width*dpr)),h=Math.max(2,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const playing=typeof audio!=='undefined'&&!audio.paused;
  const signal=playing&&typeof fastBeatSignal==='function'?fastBeatSignal():{};motion.update(dt,settings,signal,touch);
  gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform2f(uniforms.resolution,w,h);gl.uniform4fv(uniforms.deformation,motion.q);gl.uniform2fv(uniforms.rotation,motion.rotation);gl.uniform1f(uniforms.time,motion.time);
  for(const key of ['film','light','size'])gl.uniform1f(uniforms[key],settings[key]);gl.drawArrays(gl.TRIANGLES,0,6);frame=requestAnimationFrame(draw);
 }
 function choose(){active=selector.value===mode&&window.sinestesiaAnalysisMode!=='separation';canvas.style.display=active?'block':'none';panel.hidden=!active;if(frame)cancelAnimationFrame(frame);frame=0;last=0;touch=null;if(active){base.style.visibility='hidden';const notice=document.getElementById('visualNotice');if(notice)notice.textContent='Órbita iridiscente · membrana elástica, pliegues y reflejos de película fina. Arrastra para deformar y girar.';if(!document.hidden)frame=requestAnimationFrame(draw);}}
 function locate(e){const r=canvas.getBoundingClientRect();touch={x:Math.max(-1,Math.min(1,2*(e.clientX-r.left)/r.width-1)),y:Math.max(-1,Math.min(1,1-2*(e.clientY-r.top)/r.height))};}
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);locate(e);});canvas.addEventListener('pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))locate(e);});for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{touch=null;});
 selector.addEventListener('change',choose);window.addEventListener('sinestesia-detection-change',choose);document.addEventListener('visibilitychange',choose);window.addEventListener('blur',()=>{touch=null;});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;if(frame)cancelAnimationFrame(frame);option.disabled=true;if(selector.value===mode){selector.value='plasma';selector.dispatchEvent(new Event('change'));}});
 const grid=document.getElementById('vmgGrid');if(grid){const card=document.createElement('button');card.type='button';card.className='vmg-card';card.dataset.mode=mode;card.style.setProperty('--h','38');card.innerHTML='<strong>Órbita iridiscente</strong><small>Membrana 3D · referencia</small>';card.addEventListener('click',()=>{selector.value=mode;selector.dispatchEvent(new Event('change',{bubbles:true}));stage.scrollIntoView({behavior:'smooth',block:'center'});});grid.append(card);}
 choose();
})();
