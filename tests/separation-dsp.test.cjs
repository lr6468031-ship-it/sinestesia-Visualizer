const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const modulePromise=import('data:text/javascript;base64,'+readFileSync('separation-dsp.js').toString('base64'));
test('estimated drum bands reconstruct the input and preserve stereo',async()=>{
 const {splitDrumBands}=await modulePromise;
 const channel=Float32Array.from({length:44100},(_,i)=>Math.sin(i*2*Math.PI*60/44100)*.3+Math.sin(i*2*Math.PI*1200/44100)*.2+Math.sin(i*2*Math.PI*8000/44100)*.1);
 const bands=splitDrumBands([channel,channel.map(x=>-x)],44100);
 for(let c=0;c<2;c++)for(let i=0;i<channel.length;i++){const sum=bands.kickEstimate[c][i]+bands.snareEstimate[c][i]+bands.cymbalEstimate[c][i];assert.ok(Math.abs(sum-(c?-channel[i]:channel[i]))<1e-6);}
});
test('drum low/high filters concentrate low/high tones in the expected estimates',async()=>{
 const {splitDrumBands}=await modulePromise;
 for(const [hz,expected] of [[60,'kickEstimate'],[1200,'snareEstimate'],[10000,'cymbalEstimate']]){
  const input=Float32Array.from({length:44100},(_,i)=>Math.sin(i*2*Math.PI*hz/44100)*.5),bands=splitDrumBands([input],44100);
  const energies=Object.fromEntries(Object.entries(bands).map(([name,[c]])=>[name,c.slice(1000).reduce((s,x)=>s+x*x,0)]));
  assert.equal(Object.keys(energies).sort((a,b)=>energies[b]-energies[a])[0],expected);
 }
});
test('WAV output has correct stereo interleaving, clipping and sample rate',async()=>{
 const {encodeWav}=await modulePromise;const blob=encodeWav([new Float32Array([0,.5,2,NaN]),new Float32Array([-1,-.5,-2,0])],44100);const v=new DataView(await blob.arrayBuffer());
 assert.equal(blob.type,'audio/wav');assert.equal(v.byteLength,60);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),44100);
 assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(46,true),-32768);assert.equal(v.getInt16(52,true),32767);assert.equal(v.getInt16(54,true),-32768);assert.equal(v.getInt16(56,true),0);
});
