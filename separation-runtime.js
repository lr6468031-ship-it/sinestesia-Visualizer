// This fixed-size HTDemucs graph needs a storage binding larger than 231 MB.
// A shorter song does not reduce that per-segment requirement.
export const MIN_GPU_BUFFER = 256 * 1024 * 1024;
export async function chooseSeparationBackend(gpu, mode = 'auto') {
  if (mode === 'cpu') return 'wasm';
  try {
    const adapter = await gpu?.requestAdapter();
    if (adapter?.limits.maxStorageBufferBindingSize >= MIN_GPU_BUFFER && adapter.limits.maxBufferSize >= MIN_GPU_BUFFER) return 'webgpu';
  } catch (_) {}
  return 'wasm';
}
export async function runSeparationWithFallback({ backend, createSession, run, onFallback = () => {} }) {
  const providers = backend === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
  for (const provider of providers) {
    let session;
    try {
      session = await createSession(provider);
      return await run(session, provider);
    } catch (error) {
      if (provider === 'wasm') throw error;
      onFallback(error);
    } finally {
      if (session) try { await session.release(); } catch (_) {}
    }
  }
}
