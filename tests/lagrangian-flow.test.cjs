const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LagrangianFlow } = require('../lagrangian-visualizer.js');
test('space and time interpolation preserves a linear velocity field at boundaries', () => {
  const f = new LagrangianFlow(8);
  for (let k=0;k<2;k++) for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
    const i=(y*8+x)*2;f.fields[k][i]=x/7+k;f.fields[k][i+1]=y/7-k;
  }
  for(const [x,y] of [[0,0],[1,1],[.37,.82]]) {
    const v=f.velocity(x,y,.25);
    assert.ok(Math.abs(v[0]-x-.25)<1e-6);assert.ok(Math.abs(v[1]-y+.25)<1e-6);
  }
});
test('RK4 follows rotational flow with bounded error', () => {
  const f=new LagrangianFlow(16);
  for(const field of f.fields) for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
    const i=(y*16+x)*2;field[i]=-(y/15-.5);field[i+1]=x/15-.5;
  }
  let p=[.7,.5];for(let i=0;i<100;i++) p=f.step(...p,.01);
  assert.ok(Math.abs(p[0]-(.5+.2*Math.cos(1)))<1e-6);
  assert.ok(Math.abs(p[1]-(.5+.2*Math.sin(1)))<1e-6);
});
test('all presets remain finite with loud input and produce different trajectories', () => {
  const outcomes=[];
  for(const model of ['vortex','currents','turbulence']) {
    const f=new LagrangianFlow();let p=[.6,.4];
    for(let i=0;i<120;i++) {f.fill(f.fields[0],i/60,model,1,1);f.fill(f.fields[1],(i+1)/60,model,1,1);p=f.step(...p,1/60);assert.ok(p.every(Number.isFinite));}
    outcomes.push(p);
  }
  assert.notDeepEqual(outcomes[0],outcomes[1]);assert.notDeepEqual(outcomes[1],outcomes[2]);
});
