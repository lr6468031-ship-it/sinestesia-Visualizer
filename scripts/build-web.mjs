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
const assets = ['index.html','app.js','styles.css','bass-wave.js','plasma-visualizer.js','plasma-ultra-tuning.js','fluid-visualizer.js','particles-fluid-presets.js','fluid-extra-modes.js','fluid-cleanup.js','reference-modes.js','lagrangian-visualizer.js','electric-iris.js','gamemaker-particles.js','panorama.js','visual-intensity.js','plasma-webgl.js','plasma-webgpu.js','controls.css','controls.js','separation.js','stem-routing.js','separation-dsp.js','THIRD_PARTY.md'];
for (const file of assets) await copyFile(join(root,file), join(out,file));
await mkdir(join(out,'vendor/lagrangian'), { recursive: true });
await copyFile(join(root,'vendor/lagrangian/LICENSE'), join(out,'vendor/lagrangian/LICENSE'));
await cp(join(root,'vendor/gamemaker-particles'), join(out,'vendor/gamemaker-particles'), { recursive: true });
await copyFile(model, join(assetDir,'htdemucs.onnx'));
await copyFile(join(root,'vendor/demucs/LICENSE.md'), join(assetDir,'LICENSE-demucs.md'));
await copyFile(join(root,'vendor/onnxruntime/LICENSE'), join(assetDir,'LICENSE-onnxruntime.txt'));
await copyFile(join(root,'vendor/onnxruntime/ThirdPartyNotices.txt'), join(assetDir,'ThirdPartyNotices-onnxruntime.txt'));
for (const file of ['ort-wasm-simd-threaded.jsep.wasm','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.asyncify.wasm','ort-wasm-simd-threaded.asyncify.mjs']) await copyFile(join(root,'node_modules/onnxruntime-web/dist',file), join(assetDir,file));
await build({ entryPoints: [join(root,'separation-worker.js')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: join(assetDir,'worker.js'), minify: true, legalComments: 'eof' });
await writeFile(join(out,'.nojekyll'),'');
console.log(`Built web app with checksum-verified AI model in ${out}`);
