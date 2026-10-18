const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {ParticleSystem,Scene,DESIGNS,ramp}=require('../gamemaker-particles.js');
function seeded(seed=123){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('complete upstream source and sprites retain their recorded SHA-256',()=>{
 const p=JSON.parse(readFileSync('vendor/gamemaker-particles/provenance.json','utf8'));
 assert.equal(p.commit,'0119f608915ab61df1b74f6021716080d247ab82');
 assert.ok(Object.keys(p.sha256).length>=30);
 for(const [file,hash] of Object.entries(p.sha256))assert.equal(createHash('sha256').update(readFileSync('vendor/gamemaker-particles/upstream/'+file)).digest('hex'),hash,file);
});
test('rain, flame, smoke and stars preserve distinct upstream colors and behaviors',()=>{
 const rain=new Scene('rain',768,768,seeded()).systems[0];rain.burst(100);
 for(const p of rain.particles){assert.ok(p.color[0]>=4.8&&p.color[0]<=14.95);assert.ok(p.color[2]>=140&&p.color[2]<=152.5);}
 const systems=new Scene('flame',768,768,seeded()).systems;assert.equal(systems.length,2);
 const [fire,smoke]=systems;fire.burst(100);
 for(const p of fire.particles){assert.equal(p.color[0],255);assert.ok(p.color[1]>=0&&p.color[1]<=160);assert.ok(p.color[2]>=0&&p.color[2]<=64);}
 assert.deepEqual(smoke.alpha,[0,1,0]);assert.equal(smoke.streamAmount,-4);
 const stars=new Scene('stars',768,768,seeded()).systems[0];stars.burst(100);
 for(const p of stars.particles){assert.equal(p.color[0],p.color[1]);assert.equal(p.color[1],p.color[2]);assert.ok(p.color[0]>=192&&p.color[0]<=255);}
 assert.equal(stars.direction[0],180);assert.equal(stars.orientation[2],4);
});
test('negative stream emits one smoke particle every four simulation frames',()=>{
 const s=new ParticleSystem(0,0,seeded());s.stream(-4);s.set_life(100);
 for(let i=0;i<3;i++)s.tick();assert.equal(s.particles.length,0);s.tick();assert.equal(s.particles.length,1);
 for(let i=0;i<4;i++)s.tick();assert.equal(s.particles.length,2);
});
test('one and three-color/alpha ramps preserve endpoints and midpoint',()=>{
 assert.equal(ramp([1,0],0),1);assert.equal(ramp([1,0],1),0);assert.equal(ramp([0,1,0],.5),1);
 assert.deepEqual(ramp([[255,0,0],[0,255,0],[0,0,255]],.5),[0,255,0]);
});
for(const design of DESIGNS){
 test(`${design} simulation remains stable across 24, 60 and 120 Hz displays`,()=>{
  const snapshots=[];
  for(const fps of [24,60,120]){
   const scene=new Scene(design,900,768,seeded());
   for(let i=0;i<fps*5;i++)scene.update(1/fps,.6);
   snapshots.push(scene.systems.map(s=>s.particles.map(p=>({...p}))));
  }
  assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[1],snapshots[2]);
 });
 test(`${design} has bounded particles, finite positions and drains on destroy`,()=>{
  const scene=new Scene(design,480,768,seeded());
  for(let i=0;i<1200;i++)scene.update(1/60,99);
  for(const s of scene.systems){
   assert.ok(s.particles.length>0&&s.particles.length<=2400);
   for(const p of s.particles){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.age<p.life);assert.ok(p.size>=0);}
  }
  scene.destroy();scene.update(1/60,1);assert.ok(scene.systems.every(s=>s.particles.length===0));
 });
}
test('audio changes movement and emission without changing the original color palette',()=>{
 const quiet=new Scene('rain',768,768,seeded()),loud=new Scene('rain',768,768,seeded());
 for(let i=0;i<90;i++){quiet.update(1/60,0);loud.update(1/60,1);}
 assert.ok(loud.systems[0].particles.length>quiet.systems[0].particles.length);
 assert.ok(loud.systems[0].particles[0].y>quiet.systems[0].particles[0].y);
 assert.deepEqual(loud.systems[0].colorMix,quiet.systems[0].colorMix);
 for(let i=0;i<180;i++)loud.update(1/60,0);assert.ok(loud.energy<1e-9);
});
test('target following, bursts and cleanup timer work without a persistent stream',()=>{
 const s=new ParticleSystem();s.set_target({x:30,y:40});s.set_offset(5,-10);s.set_timer(3);s.burst(4);
 s.tick();assert.equal(s.x,35);assert.equal(s.y,30);assert.equal(s.particles.length,4);
 s.tick();s.tick();assert.equal(s.destroyed,true);assert.equal(s.particles.length,0);
});
test('invalid frame intervals do not advance state and unknown designs have a useful default',()=>{
 const scene=new Scene('missing',768,768,seeded());assert.equal(scene.design,'all');
 for(const dt of [NaN,-1,Infinity])scene.update(dt,1);assert.equal(scene.systems[0].frames,0);
 scene.update(500,NaN);assert.equal(scene.systems[0].frames,15);assert.equal(scene.energy,0);
});
