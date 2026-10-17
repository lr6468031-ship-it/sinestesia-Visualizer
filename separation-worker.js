import * as ort from 'onnxruntime-web/webgpu';
import { separateTracks } from './vendor/demucs/apply.js';
import { splitDrumBands } from './separation-dsp.js';
ort.env.wasm.numThreads = 1; // Works on GitHub Pages without COOP/COEP headers.
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
const status = text => postMessage({ type: 'status', text });
const expectedHash = 'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748';
async function verified(bytes) {
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if (hash !== expectedHash) throw Error('El modelo no superó la verificación de integridad.');
  return bytes;
}
class Model {
  sources = ['drums','bass','other','vocals']; samplerate = 44100; segment = 7.8;
  constructor(session) { this.session = session; }
  validLength(length) { if (length > 343980) throw Error('Audio segment too long'); return 343980; }
  async forward(mix, spec) {
    const a = new ort.Tensor('float32', mix.data, mix.shape), b = new ort.Tensor('float32', spec.data, spec.shape);
    let outputs;
    try {
      outputs = await this.session.run({ [this.session.inputNames[0]]: a, [this.session.inputNames[1]]: b });
      const values = this.session.outputNames.map(name => ({ data: new Float32Array(outputs[name].data), shape: [...outputs[name].dims] }));
      return { outX: values[0], outXt: values[1] };
    } finally { a.dispose(); b.dispose(); if (outputs) Object.values(outputs).forEach(t => t.dispose()); }
  }
}
async function weights() {
  const url = new URL('htdemucs.onnx', self.location.href).href;
  let cache;
  try { cache = await caches.open('sinestesia-demucs-1'); const saved = await cache.match(url); if (saved) { try { return await verified(await saved.arrayBuffer()); } catch (_) { await cache.delete(url); } } } catch (_) {}
  const response = await fetch(url);
  if (!response.ok) throw Error(`No se pudo descargar el modelo (HTTP ${response.status}).`);
  const total = Number(response.headers.get('content-length')) || 174270971;
  const reader = response.body.getReader(); const chunks = []; let loaded = 0, lastReport = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); loaded += value.length; if (performance.now()-lastReport>150) { postMessage({ type:'download', loaded, total }); lastReport=performance.now(); } }
  const buffer = new Uint8Array(loaded); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk,offset); offset += chunk.length; }
  await verified(buffer);
  if (cache) try { await cache.put(url, new Response(buffer)); } catch (_) {}
  return buffer.buffer;
}
self.onmessage = async event => {
  if (event.data.type !== 'separate') return;
  let session;
  try {
    status('Cargando modelo IA (~174 MB, solo la primera vez)…');
    const modelBytes = await weights();
    let gpu = false;
    try { gpu = !!(await navigator.gpu?.requestAdapter()); } catch (_) {}
    status(`Preparando IA en ${gpu ? 'GPU' : 'CPU'}. Puede tardar varios minutos…`);
    try { session = await ort.InferenceSession.create(modelBytes, { executionProviders: gpu ? ['webgpu','wasm'] : ['wasm'], enableCpuMemArena: false, enableMemPattern: false }); }
    catch (error) { if (!gpu) throw error; status('GPU no compatible. Preparando CPU…'); session = await ort.InferenceSession.create(modelBytes, { executionProviders:['wasm'] }); }
    const { channelData } = event.data;
    const tracks = await separateTracks(new Model(session), { channelData, sampleRate:44100 }, (step,total) => postMessage({ type:'progress', step,total }));
    status('Preparando pistas y bandas estimadas de batería…');
    const bands = splitDrumBands(tracks.drums.channelData, 44100);
    for (const [name, channelData] of Object.entries(bands)) tracks[name] = { channelData, sampleRate:44100 };
    const transfers = [...new Set(Object.values(tracks).flatMap(track => track.channelData.map(channel => channel.buffer)))];
    postMessage({ type:'done', tracks }, transfers);
  } catch (error) { postMessage({ type:'error', text: error?.message || String(error) }); }
  finally { if (session) await session.release(); }
};
