const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function simulation(reference, x, y) {
  const source = fs.readFileSync(require.resolve('../ember-vortex.js'), 'utf8');
  const context = { settings: { reference }, radial: 1 };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  const sparks ='), source.indexOf('  function draw(')) + `
    resizeDomain(1, 1.5);
    pointer = { x: ${x}, y: ${y} }; magnetX = pointer.x; magnetY = pointer.y;
    globalThis.sim = { sparks, advance, release() { pointer = null; } };
  `, context);
  return context.sim;
}
for (const reference of [true, false]) for (const [x,y] of [[.5,.5],[0,0],[1,1]]) {
  test(`touch absorbs instead of emitting: reference=${reference}, target=${x},${y}`, () => {
    const sim = simulation(reference,x,y);
    const p = sim.sparks[0], tx=x, ty=y*1.5;
    p.x = x < .5 ? .65 : .3; p.y = y < .5 ? .8 : .4;
    const before = Math.hypot(p.x-tx,p.y-ty);
    // Explicitly start with outward momentum, as when dragging across a jet.
    p.vx = (p.x-tx)/before; p.vy = (p.y-ty)/before;
    for (let i=0;i<48;i++) sim.advance(1/120);
    assert.ok(Math.hypot(p.x-tx,p.y-ty) < before*.7);
    p.x=tx+.001; p.y=ty+.001; p.vx=0;p.vy=0;
    sim.advance(1/120);
    assert.ok(Math.hypot(p.x-tx,p.y-ty) >= .3, 'absorbed particles replenish away from touch');
    for (let i=0;i<p.history.length;i+=2) {
      assert.equal(p.history[i], Math.fround(p.x));
      assert.equal(p.history[i+1], Math.fround(p.y));
    }
    sim.release();
    for (let i=0;i<120;i++)sim.advance(1/120);
    assert.ok(sim.sparks.every(p=>Number.isFinite(p.x+p.y+p.vx+p.vy)));
  });
}
