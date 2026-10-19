const {test}=require('node:test');
const assert=require('node:assert/strict');
const {StemTimeline}=require('../stem-routing.js');
test('stem clock follows original offset, seek, pause and fragment boundaries',()=>{
 const t=new StemTimeline();t.offset=10;t.duration=3;
 t.tracks.set('bass',{values:Float32Array.from([0,1,0]),rate:1});t.routes.set('bass','plasma');
 assert.equal(t.signal('plasma',9,false).energy,0);
 assert.equal(t.signal('plasma',10.5,false).energy,.5);
 assert.equal(t.signal('plasma',11,true).energy,0);
 assert.equal(t.signal('plasma',13,false).energy,0);
 assert.equal(t.signal('fluidGas',11,false).energy,0);
 assert.equal(t.signal('plasma',11,false).energy,1);
});
test('routing, audition and release do not leak another stem',()=>{
 const t=new StemTimeline();t.offset=10;t.duration=2;
 t.tracks.set('bass',{values:Float32Array.from([1,1]),rate:1});
 t.tracks.set('drums',{values:Float32Array.from([.5,.5]),rate:1});
 t.routes.set('bass','plasma');t.routes.set('drums','electricIris');t.solo='drums';
 assert.equal(t.signal('plasma',1,false).energy,0);
 assert.equal(t.signal('electricIris',1,false).energy,.5);
 t.solo=null;t.routes.set('bass','electricIris');
 assert.equal(t.signal('plasma',11,false).energy,0);
 assert.equal(t.signal('electricIris',11,false).energy,1);
 t.clear();assert.equal(t.signal('electricIris',11,false).energy,0);
});
test('opposite stereo phases preserve real stem energy',()=>{
 const t=StemTimeline.envelope({sampleRate:100,length:4,numberOfChannels:2,getChannelData:c=>Float32Array.from(c?[.1,-.1,.1,-.1]:[-.1,.1,-.1,.1])});
 assert.ok(t.values.every(v=>Math.abs(v-.5)<1e-6));
});
