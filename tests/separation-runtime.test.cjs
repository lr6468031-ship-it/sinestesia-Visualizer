const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');
const api=import('data:text/javascript;base64,'+readFileSync('separation-runtime.js').toString('base64'));
test('128 MiB phone GPU is rejected before model initialization',async()=>{
 const {chooseSeparationBackend}=await api;assert.equal(await chooseSeparationBackend({requestAdapter:async()=>({limits:{maxStorageBufferBindingSize:134217728,maxBufferSize:268435456}})}),'wasm');
 assert.equal(await chooseSeparationBackend({requestAdapter:async()=>({limits:{maxStorageBufferBindingSize:268435456,maxBufferSize:268435456}})}),'webgpu');
 assert.equal(await chooseSeparationBackend(undefined),'wasm');assert.equal(await chooseSeparationBackend({requestAdapter:async()=>{throw Error('unavailable')}}),'wasm');
});
test('forced CPU does not even request a GPU adapter',async()=>{
 const {chooseSeparationBackend}=await api;assert.equal(await chooseSeparationBackend({requestAdapter:()=>{throw Error('must not request')}},'cpu'),'wasm');
});
test('GPU run failure releases GPU then retries the same input on CPU',async()=>{
 const {runSeparationWithFallback}=await api;const calls=[],input=new Float32Array([.1,.2]);let retries=0;
 const result=await runSeparationWithFallback({backend:'webgpu',createSession:async provider=>{calls.push('create '+provider);return {release:async()=>calls.push('release '+provider)}},run:async(session,provider)=>{calls.push('run '+provider);if(provider==='webgpu')throw Error('Binding size 231211008 exceeds 134217728');return input},onFallback:()=>retries++});
 assert.equal(result,input);assert.equal(retries,1);assert.deepEqual(calls,['create webgpu','run webgpu','release webgpu','create wasm','run wasm','release wasm']);
});
test('session creation also falls back; CPU failure is reported without looping',async()=>{
 const {runSeparationWithFallback}=await api;const calls=[];
 await assert.rejects(runSeparationWithFallback({backend:'webgpu',createSession:async p=>{calls.push(p);throw Error(p+' failed')},run:async()=>{throw Error('unexpected')}}),/wasm failed/);assert.deepEqual(calls,['webgpu','wasm']);
});
