import * as ort from 'onnxruntime-web/webgpu';
import { separateTracks } from './vendor/demucs/apply.js';
import { chooseSeparationBackend, runSeparationWithFallback } from './separation-runtime.js';
import { splitDrumBands, encodeWav } from './separation-dsp.js';
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
  try {
    status('Cargando modelo IA (~174 MB, solo la primera vez)…');
    const modelBytes = await weights();
    const backend = await chooseSeparationBackend(navigator.gpu, event.data.engine);
    status(backend === 'webgpu' ? 'Preparando IA en GPU…' : 'Preparando IA en CPU compatible. No requiere los bloques grandes de WebGPU; puede tardar varios minutos…');
    const { channelData } = event.data;
    let tracks = await runSeparationWithFallback({
      backend,
      createSession: provider => ort.InferenceSession.create(modelBytes, { executionProviders:[provider], enableCpuMemArena:false, enableMemPattern:false }),
      onFallback: () => status('La GPU no pudo ejecutar el modelo. Reiniciando automáticamente en CPU compatible…'),
      run: (session, provider) => separateTracks(new Model(session), { channelData, sampleRate:44100 }, (step,total) => postMessage({ type:'progress', step,total, engine:provider === 'wasm' ? 'CPU compatible' : 'GPU' })),
    });
    status('Preparando pistas y bandas estimadas de batería…');
    const bands = splitDrumBands(tracks.drums.channelData, 44100);
    for (const [name, channelData] of Object.entries(bands)) tracks[name] = { channelData, sampleRate:44100 };
    const wavs = {};
    const expectedLength = channelData[0].length;
    // Validation and WAV encoding stay off the UI thread, and each encoded track
    // releases its reference before the next one is prepared.
    for (const name of Object.keys(tracks)) {
      const track = tracks[name];
      if (track.sampleRate !== 44100 || track.channelData?.length !== 2
          || track.channelData.some(channel => channel.length !== expectedLength)) throw Error('La IA devolvió una pista incompleta.');
      for (const channel of track.channelData) for (const sample of channel) {
        if (!Number.isFinite(sample)) throw Error('La IA devolvió audio inválido.');
      }
      status(`Preparando audio: ${name}…`);
      wavs[name] = encodeWav(track.channelData, 44100);
      delete tracks[name];
    }
    tracks = null;
    postMessage({ type:'done', wavs });
  } catch (error) { postMessage({ type:'error', text: error?.message || String(error) }); }

};
