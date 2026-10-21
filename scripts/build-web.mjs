import { mkdir, copyFile, readFile, writeFile, cp } from 'node:fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
const root = resolve(import.meta.dirname, '..');
const arg = process.argv.indexOf('--outdir');
const out = resolve(root, arg >= 0 ? process.argv[arg + 1] : 'dist');
const cache = join(root, '.cache/separator');
const assetDir = join(out, 'separator-assets');
await mkdir(cache, { recursive: true }); await mkdir(assetDir, { recursive: true });
const digest = async (file, algorithm) => { const h = createHash(algorithm); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest(algorithm === 'sha512' ? 'base64' : 'hex'); };
const model = join(cache, 'htdemucs.onnx');
const modelHash = 'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748';
if (!existsSync(model) || await digest(model, 'sha256') !== modelHash) {
  const tarball = join(cache, 'demucs-1.0.0.tgz');
  const integrity = 'c6D0GHEnQz/1zdRQNLy1uCZdCByPnKHcYOs4a3VuMgrYNF7V2PgNQ1fQavue1DE40ow3xD7RWz92RxdWQNFTMw==';
  if (!existsSync(tarball) || await digest(tarball, 'sha512') !== integrity) {
    console.log('Downloading pinned Demucs 1.0.0 model package (~98 MB compressed)…');
    const response = await fetch('https://registry.npmjs.org/demucs/-/demucs-1.0.0.tgz');
    if (!response.ok) throw new Error(`Model package HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tarball));
  }
  if (await digest(tarball, 'sha512') !== integrity) throw new Error('Model package integrity mismatch');
  execFileSync('tar', ['-xzf', tarball, '-C', cache, '--strip-components=1', 'package/htdemucs.onnx']);
  if (await digest(model, 'sha256') !== modelHash) throw new Error('Model checksum mismatch');
}
const assets = ['index.html','app.js','styles.css','bass-wave.js','plasma-visualizer.js','plasma-ultra-tuning.js','fluid-visualizer.js','particles-fluid-presets.js','fluid-cleanup.js','reference-modes.js','lagrangian-visualizer.js','electric-iris.js','particles-engine.js','ember-vortex.js','membrane-orb.js','gamemaker-particles.js','panorama.js','visual-intensity.js','plasma-webgl.js','plasma-webgpu.js','controls.css','controls.js','separation.js','strict-xy-runtime.js','stem-routing.js','separation-dsp.js','THIRD_PARTY.md'];
for (const file of assets) await copyFile(join(root,file), join(out,file));

// In normal FFT mode, keep Fluid's background drift independent from raw audio energy.
// Strong splats are triggered only by the gated kick signal.
const fluidOutput = join(out, 'fluid-visualizer.js');
let fluidText = await readFile(fluidOutput, 'utf8');
const oldFluidDrive = ` const t=now*0.0004, level=playing?Math.min(1,Number(signal.mid)||0):0.12;\n const color=generateColor(), strength=(window.sinestesiaAnalysisMode==='separation' ? level*2 : (playing?0.6+level*2:0.7))*gain;\n color.r*=strength;color.g*=strength;color.b*=strength;\n splat(0.5+Math.cos(t*2.7)*0.23,0.5+Math.sin(t*3.1)*0.23,-Math.sin(t*2.7)*(80+level*220),Math.cos(t*3.1)*(80+level*220),color);`;
const newFluidDrive = ` const t=now*0.0004, level=playing?Math.min(1,Number(signal.mid)||0):0.12;\n const separated=window.sinestesiaAnalysisMode==='separation';\n const motionLevel=separated?level:0;\n const color=generateColor(), strength=(separated?level*2:(playing?0.18:0.12))*gain;\n color.r*=strength;color.g*=strength;color.b*=strength;\n splat(0.5+Math.cos(t*2.7)*0.23,0.5+Math.sin(t*3.1)*0.23,-Math.sin(t*2.7)*(80+motionLevel*220),Math.cos(t*3.1)*(80+motionLevel*220),color);`;
if (!fluidText.includes(oldFluidDrive)) throw new Error('Fluid music drive patch target not found');
fluidText = fluidText.replace(oldFluidDrive, newFluidDrive);
await writeFile(fluidOutput, fluidText);

// All renderers that consume fastBeatSignal (including Iris) must obey the same
// K / S / M rectangles shown in the spectrum UI. If no live FFT peak is inside
// any rectangle, return a strict zero signal so the visualizer cannot pulse from
// raw RMS/bass energy behind the detector.
const plasmaOutput = join(out, 'plasma-visualizer.js');
let plasmaText = await readFile(plasmaOutput, 'utf8');
const oldFastBeat = `function fastBeatSignal() {\n  if (!analyser || !frequencyData || audio.paused) {\n    fastReactiveEnergy *= 0.55;\n    smoothBass *= 0.60;\n    smoothMid *= 0.62;\n    smoothTreble *= 0.62;\n    kickPunch *= 0.45;\n    previousKickInput = 0;\n    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };\n  }\n\n  const bassNow = reactiveBandLevel(25, 250);\n  const kickNow = reactiveBandLevel(35, 125);\n  const midNow = reactiveBandLevel(250, 4000);\n  const trebleNow = reactiveBandLevel(4000, 16000);\n  const rms = rmsLevel();\n\n  smoothBass = followValue(smoothBass, bassNow, 0.93, 0.20);\n  smoothMid = followValue(smoothMid, midNow, 0.82, 0.18);\n  smoothTreble = followValue(smoothTreble, trebleNow, 0.84, 0.20);\n\n  const kickRise = Math.max(0, kickNow - previousKickInput);\n  const kickTransient = kickRise * 6.2;\n  const kickWeight = Math.max(0, kickNow - 0.30) * 2.0;\n  const kickTarget = clamp(kickTransient + kickWeight);\n  kickPunch = followValue(kickPunch, kickTarget, 0.995, 0.11);\n  previousKickInput = kickNow;\n\n  const target = clamp(\n    rms * 1.75 + smoothBass * 0.92 + smoothMid * 0.22 + smoothTreble * 0.13 + kickPunch * 0.30\n  );\n  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.94, 0.18);\n\n  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };\n}`;
const newFastBeat = `function fastBeatSignal() {\n  if (!analyser || !frequencyData || audio.paused) {\n    fastReactiveEnergy = 0;\n    smoothBass = 0;\n    smoothMid = 0;\n    smoothTreble = 0;\n    kickPunch = 0;\n    previousKickInput = 0;\n    return { bass: 0, mid: 0, treble: 0, energy: 0, kick: 0 };\n  }\n\n  const settings = window.sinestesiaDetectionSettings || {};\n  if (!fastBeatSignal.spectrum || fastBeatSignal.spectrum.length !== analyser.frequencyBinCount)\n    fastBeatSignal.spectrum = new Float32Array(analyser.frequencyBinCount);\n  analyser.getFloatFrequencyData(fastBeatSignal.spectrum);\n  const spectrum = fastBeatSignal.spectrum;\n  const sampleRate = audioContext.sampleRate;\n  const binHz = sampleRate / (2 * spectrum.length);\n  const boxOpen = (kind, lo, hi) => {\n    const level = Number(settings[kind + 'Level']);\n    if (!Number.isFinite(level)) return false;\n    const tolerance = Math.max(5, Math.min(50, Number(settings[kind + 'Tolerance']) || 40));\n    let peak = -Infinity;\n    const start = Math.max(1, Math.ceil(lo / binHz));\n    const end = Math.min(spectrum.length - 1, Math.floor(hi / binHz));\n    for (let i = start; i <= end; i += 1) peak = Math.max(peak, spectrum[i]);\n    return peak >= level - tolerance && peak <= Math.min(0, level + tolerance);\n  };\n  const kickHz = Math.max(30, Math.min(300, Number(settings.kickHz) || 60));\n  const snareHz = Math.max(100, Math.min(1500, Number(settings.snareHz) || 200));\n  const melodyHz = Math.max(100, Math.min(8000, Number(settings.melodyHz) || 700));\n  const melodyWidth = Math.max(0.5, Math.min(4, Number(settings.melodyWidth) || 2));\n  const factor = Math.pow(2, melodyWidth / 2);\n  const kickGate = boxOpen('kick', kickHz * 0.5, kickHz * 1.5);\n  const snareGate = boxOpen('snare', snareHz * 0.75, snareHz * 1.5);\n  const melodyGate = boxOpen('melody', melodyHz / factor, Math.min(sampleRate / 2, melodyHz * factor));\n  const anyGate = kickGate || snareGate || melodyGate;\n\n  if (!anyGate) {\n    fastReactiveEnergy = 0; smoothBass = 0; smoothMid = 0; smoothTreble = 0; kickPunch = 0; previousKickInput = 0;\n    return { bass: 0, mid: 0, treble: 0, energy: 0, kick: 0 };\n  }\n\n  const bassNow = kickGate ? reactiveBandLevel(25, 250) : 0;\n  const kickNow = kickGate ? reactiveBandLevel(35, 125) : 0;\n  const midNow = melodyGate ? reactiveBandLevel(250, 4000) : 0;\n  const trebleNow = snareGate ? reactiveBandLevel(4000, 16000) : 0;\n  const rms = rmsLevel();\n\n  smoothBass = followValue(smoothBass, bassNow, 0.93, 0.20);\n  smoothMid = followValue(smoothMid, midNow, 0.82, 0.18);\n  smoothTreble = followValue(smoothTreble, trebleNow, 0.84, 0.20);\n\n  const kickRise = kickGate ? Math.max(0, kickNow - previousKickInput) : 0;\n  const kickTransient = kickRise * 6.2;\n  const kickWeight = kickGate ? Math.max(0, kickNow - 0.30) * 2.0 : 0;\n  const kickTarget = clamp(kickTransient + kickWeight);\n  kickPunch = followValue(kickPunch, kickTarget, 0.995, 0.11);\n  previousKickInput = kickGate ? kickNow : 0;\n\n  const target = clamp(\n    rms * 0.25 + smoothBass * 0.92 + smoothMid * 0.22 + smoothTreble * 0.13 + kickPunch * 0.30\n  );\n  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.94, 0.18);\n\n  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };\n}`;
if (!plasmaText.includes(oldFastBeat)) throw new Error('fastBeatSignal patch target not found');
plasmaText = plasmaText.replace(oldFastBeat, newFastBeat);
await writeFile(plasmaOutput, plasmaText);

await mkdir(join(out,'vendor/lagrangian'), { recursive: true });
await copyFile(join(root,'vendor/lagrangian/LICENSE'), join(out,'vendor/lagrangian/LICENSE'));
await cp(join(root,'vendor/gamemaker-particles'), join(out,'vendor/gamemaker-particles'), { recursive: true });
await copyFile(model, join(assetDir,'htdemucs.onnx'));
await copyFile(join(root,'vendor/demucs/LICENSE.md'), join(assetDir,'LICENSE-demucs.md'));
await copyFile(join(root,'vendor/onnxruntime/LICENSE'), join(assetDir,'LICENSE-onnxruntime.txt'));
await copyFile(join(root,'vendor/onnxruntime/ThirdPartyNotices.txt'), join(assetDir,'ThirdPartyNotices-onnxruntime.txt'));
for (const file of ['ort-wasm-simd-threaded.jsep.wasm','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.asyncify.wasm','ort-wasm-simd-threaded.asyncify.mjs']) await copyFile(join(root,'node_modules/onnxruntime-web/dist',file), join(assetDir,file));
await build({ entryPoints: [join(root,'separation-worker.js')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: join(assetDir,'worker.js'), minify: true, legalComments: 'eof' });
await cp(join(root,'proyecto-de-vida'),join(out,'proyecto-de-vida'),{recursive:true});
// Change the offline cache whenever the independent app's assets change.
const lifeHash=createHash('sha256');
for(const file of ['index.html','styles.css','app.mjs','core.mjs','life-flame.mjs','manifest.webmanifest','vendor/lifeos.mjs','vendor/neohabit.mjs','vendor/beaverhabits.mjs','vendor/super-productivity.mjs'])lifeHash.update(await readFile(join(root,'proyecto-de-vida',file)));
const lifeWorker=join(out,'proyecto-de-vida/sw.js');
await writeFile(lifeWorker,(await readFile(lifeWorker,'utf8')).replace('proyecto-de-vida-v1','proyecto-de-vida-'+lifeHash.digest('hex').slice(0,12)));

await writeFile(join(out,'.nojekyll'),'');
console.log(`Built web app with checksum-verified AI model in ${out}`);
