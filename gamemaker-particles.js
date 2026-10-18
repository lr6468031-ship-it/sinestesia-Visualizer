/*
 * Browser adaptation of GamemakerCasts/particles, MIT.
 * Copyright (c) 2021 GameMaker Casts.
 * Complete upstream project and license: vendor/gamemaker-particles/upstream/.
 * Original 60 Hz emitter settings and flame sprites retained. Canvas replaces
 * GameMaker's built-in particle renderer; resizing and audio modulation are new.
 */
const GameMakerParticles = (() => {
  'use strict';
  const RAD = Math.PI / 180;
  const WHITE = [255,255,255], GRAY = [192,192,192], BLACK = [0,0,0];
  const ORANGE = [255,160,64], RED = [255,0,0];
  const mix = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
  const ramp = (values,t) => {
    if(values.length===1)return values[0];
    const pos=Math.max(0,Math.min(1,t))*(values.length-1),i=Math.min(values.length-2,Math.floor(pos));
    return typeof values[i]==='number' ? values[i]+(values[i+1]-values[i])*(pos-i) : mix(values[i],values[i+1],pos-i);
  };
  class ParticleSystem {
    constructor(x=0,y=0,random=Math.random) {
      this.x=x;this.y=y;this.random=random;this.particles=[];this.target=null;this.offset=[0,0];
      this.emitter=[1,1,1,1];this.emitterShape='rectangle';this.distribution='gaussian';this.emitterRandom=false;
      this.blend=true;this.shape='pixel';this.sprite=null;this.size=[1,2,0,0];this.scale=[1,1];
      this.colors=[WHITE];this.colorMix=null;this.alpha=[1,0];this.life=[20,60];this.direction=[0,0,0,0];
      this.orientation=[90,90,0,0,true];this.speed=[1,1.5,0,0];this.gravity=[0,270];
      this.depth=0;this.streamAmount=0;this.frames=0;this.timer=Infinity;this.destroyed=false;
    }
    range(a,b=a){return a+(b-a)*this.random();}
    set_blend(v=true){this.blend=!!v;}
    set_shape(v='pixel'){this.shape=v;this.sprite=null;}
    set_sprite(v,animated=false,stretched=false,randomFrame=true){this.sprite={name:v,animated,stretched,randomFrame};}
    set_size(min,max=min,increase=0,wobble=0){this.size=[min,max,increase,wobble];}
    set_scale(x,y){this.scale=[x,y];}
    set_color(...v){this.colors=v;this.colorMix=null;}
    set_color_mix(a,b){this.colorMix=[a,b];}
    set_alpha(...v){this.alpha=v;}
    set_life(min,max=min){this.life=[min,max];}
    set_direction(min,max=min,increase=0,wobble=0){this.direction=[min,max,increase,wobble];}
    set_orientation(min,max=min,increase=0,wobble=0,relative=true){this.orientation=[min,max,increase,wobble,relative];}
    set_speed(min,max=min,increase=0,wobble=0){this.speed=[min,max,increase,wobble];}
    set_gravity(amount,direction){this.gravity=[amount,direction];}
    set_target(target){this.target=target;}
    set_offset(x,y){this.offset=[x,y];}
    set_depth(depth){this.depth=depth;}
    set_wobble(amount){this.wobble=amount;}
    set_emitter_size(l=0,r=0,t=0,b=0){this.emitter=[l,r,t,b];}
    set_emitter_random(v=true){this.emitterRandom=v;}
    set_position(x,y){this.x=x+this.offset[0];this.y=y+this.offset[1];}
    set_timer(frames){this.timer=frames;}
    set_emitter_shape(shape){this.emitterShape=shape;}
    set_emitter_distrubution(distribution){this.distribution=distribution;}
    coordinate(a,b){
      // GameMaker's default emitter is Gaussian; explicit linear uses uniform.
      const t=this.distribution==='linear'?this.random():(this.random()+this.random()+this.random()+this.random())/4;
      return a+(b-a)*t;
    }
    burst(amount=1){
      for(let i=0;i<Math.max(0,Math.floor(amount))&&this.particles.length<2400;i++){
        let [l,r,t,b]=this.emitter;
        if(this.emitterRandom){l*=this.random();r*=this.random();t*=this.random();b*=this.random();}
        let x=this.coordinate(l,r),y=this.coordinate(t,b);
        if(this.emitterShape==='ellipse'){const a=this.random()*Math.PI*2,radius=Math.sqrt(this.random());x=(l+r)/2+Math.cos(a)*radius*(r-l)/2;y=(t+b)/2+Math.sin(a)*radius*(b-t)/2;}
        const speed=this.range(...this.speed),dir=this.range(...this.direction);
        this.particles.push({x:this.x+x,y:this.y+y,age:0,life:this.range(...this.life),size:this.range(...this.size),
          dir,speed,orientation:this.range(...this.orientation),frame:Math.floor(this.random()*4),seed:this.random()*Math.PI*2,
          color:this.colorMix?mix(...this.colorMix,this.random()):null});
      }
    }
    stream(amount=1){this.streamAmount=amount;}
    tick(boost=1,speedBoost=1){
      if(this.destroyed)return;
      this.frames++;
      if(this.frames>=this.timer){this.destroy();return;}
      if(this.target&&!this.target.destroyed)this.set_position(this.target.x,this.target.y);
      let count=0;
      for(const p of this.particles){
        if(++p.age>=p.life)continue;
        p.dir+=this.direction[2];p.speed=Math.max(0,p.speed+this.speed[2]);p.orientation+=this.orientation[2];p.size=Math.max(0,p.size+this.size[2]);
        const angle=(p.dir+Math.sin(p.age*.15+p.seed)*this.direction[3])*RAD;
        const speed=(p.speed+Math.sin(p.age*.15+p.seed)*this.speed[3])*speedBoost;
        p.x+=Math.cos(angle)*speed+Math.cos(this.gravity[1]*RAD)*this.gravity[0]*p.age;
        p.y-=Math.sin(angle)*speed+Math.sin(this.gravity[1]*RAD)*this.gravity[0]*p.age;
        this.particles[count++]=p;
      }
      this.particles.length=count;
      if(this.streamAmount<0){if(this.frames%Math.abs(this.streamAmount)===0)this.burst(1);}
      else {this.emission=(this.emission||0)+this.streamAmount*boost;const emit=Math.floor(this.emission);this.emission-=emit;this.burst(emit);}
    }
    destroy(){this.destroyed=true;this.particles.length=0;}
  }
  const DESIGNS=['all','rain','flame','smoke','stars','classic'];
  function createSystems(design,width,height,random=Math.random){
    const systems=[];
    const add=(x,y)=>{const s=new ParticleSystem(x,y,random);systems.push(s);return s;};
    // obj_Rain/Create_0.gml: all settings preserved; emitter spans the viewport.
    if(design==='rain'||design==='all'){
      const s=add(width/2,0);s.set_emitter_distrubution('linear');s.set_alpha(1,1,0);
      s.set_color_mix([14.95,51.36,152.50],[4.80,100.24,140]);s.set_direction(250,255);
      s.set_emitter_size(-Math.max(1024,width/2+200),Math.max(1024,width/2+200),0,0);
      s.set_life(100,200);s.set_orientation(0);s.set_shape('line');s.set_size(.20,1);s.set_scale(1,.10);s.set_speed(3,5);s.stream(11);
    }
    // obj_Flame/Create_0.gml, including its separate, slower smoke emitter.
    if(['flame','smoke','all'].includes(design)){
      const x=width/2,y=height*.62;
      if(design!=='smoke'){
        const s=add(x,y);s.set_emitter_size(-16,16);s.set_sprite('flame');s.set_direction(90);s.set_speed(1,3);
        s.set_color_mix(ORANGE,RED);s.set_alpha(1,0);s.set_life(30,50);s.set_size(3,6,-.01);s.stream(8);
      }
      const s=add(x,y-96);s.set_depth(-1);s.set_speed(1,2);s.set_sprite('flame');s.set_orientation(0,360);s.set_direction(90);
      s.set_size(3,9,-.01);s.set_color_mix(BLACK,GRAY);s.set_life(40,160);s.set_alpha(0,1,0);s.stream(-4);
    }
    // obj_StarField/Create_0.gml.
    if(design==='stars'||design==='all'){
      const s=add(width,0);s.set_emitter_size(0,0,0,height);s.set_shape('square');s.set_orientation(0,0,4);
      s.set_direction(180);s.set_speed(5,10);s.set_color_mix(WHITE,GRAY);s.set_life(width/5);s.set_size(.01,.1);s.stream(1);
    }
    if(design==='classic'){
      const s=add(width/2,height/2);s.set_direction(0,360);s.stream(8);
    }
    return systems;
  }
  class Scene {
    constructor(design='all',width=768,height=768,random=Math.random){
      this.design=DESIGNS.includes(design)?design:'all';this.width=width;this.height=height;
      this.systems=createSystems(this.design,width,height,random);this.accumulator=0;this.energy=0;
    }
    update(dt,energy=0){
      if(!Number.isFinite(dt)||dt<0)return;
      const target=Number.isFinite(energy)?Math.max(0,Math.min(1,energy)):0;
      this.accumulator+=Math.min(.25,dt);
      // Fixed 60 Hz GML semantics, independent of display refresh rate.
      let steps=0;
      while(this.accumulator+1e-9>=1/60&&steps++<15){
        this.energy+=(target-this.energy)*(1-Math.exp(-1/60*8));
        for(const s of this.systems)s.tick(1+this.energy*.6,1+this.energy*.45);
        this.accumulator=Math.max(0,this.accumulator-1/60);
      }
    }
    destroy(){for(const s of this.systems)s.destroy();}
  }
  return {ParticleSystem,Scene,DESIGNS,ramp,mix};
})();
if(typeof module!=='undefined')module.exports=GameMakerParticles;
if(typeof document!=='undefined')(()=>{
  'use strict';
  const mode=document.getElementById('visualMode'),base=document.getElementById('visualizer');
  const select=document.getElementById('particleDesign'),control=document.getElementById('particleDesignControl');
  if(!mode||!base||!select)return;
  const surface=document.createElement('canvas');surface.id='gameMakerCanvas';surface.setAttribute('aria-label','Diseños de partículas: lluvia, fuego, humo y estrellas');
  Object.assign(surface.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'none',zIndex:'4',pointerEvents:'none',background:'#000'});
  base.parentElement.appendChild(surface);
  const ctx=surface.getContext('2d');
  if(!ctx){mode.querySelector('option[value="gameMaker"]').disabled=true;return;}
  const sprites=[];let assetsReady=false,assetError=false;
  const filenames=['c64d8099-97ca-444f-9ffc-4e0c6c43f7ac','b4f5c4ed-e254-4d0f-a132-aab5515e877a','ac3c75be-4229-4670-9854-ba11d1f7124d','dd369293-244f-4a61-971f-094091bdb723'];
  function loadAssets(){
    if(sprites.length)return;
    Promise.all(filenames.map(name=>new Promise((resolve,reject)=>{
      const img=new Image();sprites.push(img);img.onload=resolve;img.onerror=reject;img.src=`vendor/gamemaker-particles/upstream/Particles/sprites/spr_Particle_Flame/${name}.png`;
    }))).then(()=>{assetsReady=true;updateNotice();}).catch(()=>{assetError=true;updateNotice();});
  }
  const tinted=new Map();
  function spriteFor(frame,color){
    const rgb=color.map(v=>Math.max(0,Math.min(255,Math.round(v/16)*16)));
    const key=frame+':'+rgb.join(',');if(tinted.has(key))return tinted.get(key);
    const c=document.createElement('canvas');c.width=c.height=9;const g=c.getContext('2d');g.drawImage(sprites[frame],0,0);
    g.globalCompositeOperation='source-in';g.fillStyle=`rgb(${rgb.join(',')})`;g.fillRect(0,0,9,9);
    if(tinted.size>256)tinted.clear();tinted.set(key,c);return c;
  }
  let active=false,frame=0,last=0,scene=null,viewWidth=0,viewHeight=0;
  function reset(){if(scene)scene.destroy();scene=null;last=0;}
  function updateNotice(){
    if(!active)return;
    const notice=document.getElementById('visualNotice');
    if(notice)notice.textContent=assetError?'No se pudieron cargar las texturas de fuego. Recarga la página.':'Partículas · elige un diseño sobre la imagen o abre Pantalla completa. La música aumenta el movimiento.';
  }
  function schedule(){if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
  function choose(){
    active=mode.value==='gameMaker';surface.style.display=active?'block':'none';control.hidden=!active;
    if(active){base.style.visibility='hidden';loadAssets();updateNotice();}
    else if(frame){cancelAnimationFrame(frame);frame=0;}
    last=0;schedule();
  }
  mode.addEventListener('change',choose);select.addEventListener('change',()=>{reset();updateNotice();schedule();});
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}schedule();});
  function draw(now){
    frame=0;if(!active||document.hidden)return;
    const rect=base.getBoundingClientRect();if(!rect.width||!rect.height){schedule();return;}
    const dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(900000/(rect.width*rect.height)));
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
    const vh=768,vw=vh*w/h;
    if(!scene||Math.abs(viewWidth-vw)>1||viewHeight!==vh){reset();viewWidth=vw;viewHeight=vh;scene=new GameMakerParticles.Scene(select.value,vw,vh);for(let i=0;i<90;i++)scene.update(1/60);}
    const dt=last?(now-last)/1000:1/60;last=now;
    const playing=typeof audio!=='undefined'&&!audio.paused;
    const signal=playing&&typeof fastBeatSignal==='function'?fastBeatSignal():{};
    const intensity=Number(document.getElementById('fluidIntensity')?.value)||1.35;
    scene.update(dt,(signal.energy||0)*intensity);
    ctx.setTransform(w/vw,0,0,h/vh,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,vw,vh);
    // GameMaker draws smaller depths last (smoke is above its flame).
    for(const s of [...scene.systems].sort((a,b)=>b.depth-a.depth)){
      ctx.globalCompositeOperation=s.blend?'lighter':'source-over';
      for(const p of s.particles){
        const age=p.age/p.life,color=p.color||GameMakerParticles.ramp(s.colors,age);
        ctx.globalAlpha=Math.max(0,Math.min(1,GameMakerParticles.ramp(s.alpha,age)));
        if(!ctx.globalAlpha)continue;
        ctx.save();ctx.translate(p.x,p.y);
        const angle=p.orientation+(s.orientation[4]?p.dir:0)+Math.sin(p.age*.15+p.seed)*s.orientation[3];ctx.rotate(-angle*Math.PI/180);
        const size=Math.max(0,p.size+Math.sin(p.age*.15+p.seed)*s.size[3]);
        if(s.sprite){
          if(assetsReady){const f=s.sprite.stretched?Math.min(3,Math.floor(age*4)):s.sprite.animated?Math.floor(p.age/2)%4:s.sprite.randomFrame?p.frame:0;ctx.drawImage(spriteFor(f,color),-size*4.5,-size*4.5,size*9,size*9);}
        }else{
          ctx.fillStyle=`rgb(${color.map(Math.round).join(',')})`;
          if(s.shape==='line'){ctx.fillRect(-size*32,-Math.max(.25,size*s.scale[1]*2),size*64,Math.max(.5,size*s.scale[1]*4));}
          else{const n=s.shape==='pixel'?Math.max(1,size):Math.max(.5,size*64);ctx.fillRect(-n/2,-n/2,n,n);}
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';schedule();
  }
  choose();
})();
