const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Motion,point}=require('../electric-iris.js');
const signals=[
 {name:'silence',bass:0,mid:0,treble:0,energy:0},
 {name:'bass',bass:1,mid:0,treble:0,energy:.6},
 {name:'mid',bass:0,mid:1,treble:0,energy:.6},
 {name:'treble',bass:0,mid:0,treble:1,energy:.6},
 {name:'full',bass:1,mid:1,treble:1,energy:1},
 {name:'quiet',bass:.01,mid:.02,treble:.03,energy:.02},
 {name:'overload',bass:99,mid:20,treble:3,energy:8},
 {name:'invalid',bass:NaN,mid:Infinity,treble:-1,energy:undefined}
];
// 8 inputs × 5 frame rates × 10 phases × 10 intensity levels = 4000 cases.
// Every case exercises motion, geometry, temporal continuity and pause recovery.
for(const signal of signals) for(const fps of [24,30,60,90,120]) for(let phase=0;phase<10;phase++) for(let gain=0;gain<10;gain++) {
 test(`iris ${signal.name}, ${fps}fps, phase ${phase}, gain ${gain}`,()=>{
  const state=new Motion();state.time=phase*4;
  const intensity=.7+gain*1.3/9,dt=1/fps,strand=(phase*19+gain*7)%192;
  let previous=point(strand,.5,state,intensity);
  for(let frame=0;frame<fps;frame++) {
   state.update(dt,signal,true);
   for(const key of ['bass','mid','treble','energy'])assert.ok(Number.isFinite(state[key])&&state[key]>=0&&state[key]<=1);
   const inner=point(strand,0,state,intensity),outer=point(strand,1,state,intensity),current=point(strand,.5,state,intensity);
   for(const p of [inner,outer,current]) {
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
    assert.ok(Math.hypot(p.x,p.y)>.18&&Math.hypot(p.x,p.y)<1.5,'preserve dark center and bounded rim');
    assert.ok(p.depth>=0&&p.depth<=1);
   }
   assert.ok(outer.radius>inner.radius+.5,'filaments extend outward');
   assert.ok(Math.hypot(current.x-previous.x,current.y-previous.y)<.08,'motion stays continuous');previous=current;
  }
  const before=state.time, energy=state.energy;
  for(let frame=0;frame<fps*3;frame++)state.update(dt,signal,false);
  assert.ok(state.energy<=energy+1e-10,'pause removes audio energy');assert.ok(state.energy<.00001);
  assert.ok(state.time>before,'ambient animation continues while paused');
  const frozen=state.time;state.update(0,signal,true);assert.equal(state.time,frozen);
  state.update(NaN,signal,true);assert.equal(state.time,frozen);
  const expanded=point(strand,0,{...state,bass:1},intensity),quiet=point(strand,0,{...state,bass:0},intensity);
  assert.ok(expanded.radius>quiet.radius,'bass expands iris');
 });
}
