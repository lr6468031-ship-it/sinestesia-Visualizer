const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Exercise the production integrators independently of Canvas and audio devices.
const source = fs.readFileSync(require.resolve('../particles-engine.js'), 'utf8');
const equations = source.slice(source.indexOf('  function seedRecreation('), source.indexOf('  function simulateRecreation('));
function system(mode, seed = 7) {
  let value = seed;
  const math = Object.create(Math);
  math.random = () => ((value = (value * 16807) % 2147483647) - 1) / 2147483646;
  const context = vm.createContext({ Math: math, activePreset: mode, time: 0, flash: 0,
    params: { circularForce: 2.25, turbulence: .45, attractor: 1.15, speed: 1.2, airResistance: .48 },
    pointer: null, canvas: { width: 800, height: 600 }, targetPoint: () => ({ x: .5, y: .5 }),
    TAU: Math.PI * 2, lerp: (a,b,t) => a+(b-a)*t,
  });
  vm.runInContext(equations + ';this.seed=seedRecreation;this.step=stepRecreation;', context);
  return context;
}
const modes = ['splat','reactor','toxic','galaxy','warp','chroma','glow'];
for (const mode of modes) {
  test(`${mode}: finite trajectories across frame rates, audio and moving touch target`, () => {
    for (const fps of [30,60,120]) {
      const c=system(mode), p={}; c.seed(p);
      let distance=0, previous;
      for(let i=0;i<fps*12;i++) {
        c.time=i/fps;
        const q=c.step(p,1/fps,{bass:i%fps<fps/4?.9:0,mid:.5,treble:.3},Math.sin(i/fps)*.1,.05);
        for(const key of ['x','y','depth','hue']) assert.ok(Number.isFinite(q[key]),`${mode} invalid ${key}`);
        assert.ok(q.depth>0);
        if(previous) distance+=Math.hypot(q.x-previous.x,q.y-previous.y);
        previous=q;
      }
      assert.ok(distance>.01, 'simulation must move');
    }
  });
  test(`${mode}: touch changes its trajectory`, () => {
    const a=system(mode),b=system(mode),p={},q={};a.seed(p);b.seed(q);
    let x,y;
    for(let i=0;i<120;i++) {
      a.time=b.time=i/60;
      x=a.step(p,1/60,{bass:0,mid:0,treble:0},0,0);
      y=b.step(q,1/60,{bass:0,mid:0,treble:0},.2,.15);
    }
    assert.ok(Math.hypot(x.x-y.x,x.y-y.y)>.001,'target must influence particles');
  });
}
test('warp respawns behind the camera without crossing the singular near plane',()=>{
  const c=system('warp'),p={};c.seed(p);p.depth=.121;
  const q=c.step(p,1/30,{bass:1,mid:0,treble:0},0,0);
  assert.equal(p.depth,2);assert.ok(q.depth<=.5);
});
