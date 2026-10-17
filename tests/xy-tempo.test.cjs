const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const api = runInNewContext(readFileSync('plasma-webgl.js','utf8').split('(() => {')[0] + '\n({withinDetectionBox, BeatTempoEstimator, KickOnsetDetector, SnareOnsetDetector, MelodyOnsetDetector})');
test('XY boxes reject both quieter and louder peaks, including exact boundaries',()=>{
 const s = new Float32Array(2048).fill(-120); s[5] = -30;
 for(const kind of ['kick','snare','melody']){
  const settings = { [`${kind}Level`]: -40, [`${kind}Tolerance`]: 10 };
  assert.equal(api.withinDetectionBox(s,48000,30,90,kind,settings),true);
  s[5]=-29;assert.equal(api.withinDetectionBox(s,48000,30,90,kind,settings),false);
  s[5]=-51;assert.equal(api.withinDetectionBox(s,48000,30,90,kind,settings),false);
  s[5]=-50;assert.equal(api.withinDetectionBox(s,48000,30,90,kind,settings),true);s[5]=-30;
 }
});
test('all three detectors enforce their XY level window',()=>{
 for(const [kind,Type] of [['kick',api.KickOnsetDetector],['snare',api.SnareOnsetDetector],['melody',api.MelodyOnsetDetector]]){
  function hits(level){const d=new Type();let count=0;for(let t=0;t<2000;t+=24){const s=new Float32Array(2048).fill(-120);if(t>=480&&t%480<100){for(let i=1;i<s.length;i++){const hz=i*48000/4096;if(kind==='kick'&&hz>40&&hz<90)s[i]=-25;if(kind==='snare'&&((hz>150&&hz<300)||(hz>2000&&hz<6000)))s[i]=-25;}if(kind==='melody')s[38]=-25;}if(d.update(s,48000,t,{[`${kind}Level`]:level,[`${kind}Tolerance`]:5}))count++;}return count;}
  assert.ok(hits(-25)>0,kind);assert.equal(hits(-45),0,kind);
 }
});
test('tempo waits for enough beats and estimates regular 120 and 90 BPM',()=>{
 for(const bpm of [120,90]){const d=new api.BeatTempoEstimator();for(let i=0;i<5;i++)assert.equal(d.add(i*60000/bpm),null);assert.equal(d.add(5*60000/bpm),bpm);}
});
test('tempo rejects irregular onsets and clears on seek',()=>{
 const d=new api.BeatTempoEstimator();let t=0;for(const delta of [220,780,340,1100,460,1330,290,920]){t+=delta;d.add(t);}assert.equal(d.bpm,null);d.reset();for(let i=0;i<8;i++)d.add(i*500);assert.equal(d.bpm,120);assert.equal(d.add(0),null);
});
