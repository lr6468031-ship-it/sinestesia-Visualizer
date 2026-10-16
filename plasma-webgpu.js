// Sinestesia Plasma Ultra: WebGPU + WGSL ray-marched volumetric plasma.
// Performance-tuned for mobile while keeping the electric translucent look.
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const baseCanvas = document.getElementById('visualizer');
  const notice = document.getElementById('visualNotice');
  if (!selector || !baseCanvas || !baseCanvas.parentElement) return;

  const stage = baseCanvas.parentElement;
  const surface = document.createElement('canvas');
  surface.id = 'plasmaWebGPUCanvas';
  surface.setAttribute('aria-hidden', 'true');
  Object.assign(surface.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    background: '#000',
    pointerEvents: 'none',
  });
  stage.insertBefore(surface, document.getElementById('musicDock'));

  let adapter = null;
  let device = null;
  let context = null;
  let format = null;
  let pipeline = null;
  let uniformBuffer = null;
  let bindGroup = null;
  let ready = false;
  let failed = false;
  let quality = 0.92;
  let slowFrames = 0;
  let fastFrames = 0;
  let lastFrameAt = 0;

  const shader = `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  bass: f32,
  mid: f32,
  treble: f32,
  energy: f32,
  intensity: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

fn hash3(p: vec3<f32>) -> f32 {
  var q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  q = q + dot(q, q.yzx + vec3<f32>(33.33));
  return fract((q.x + q.y) * q.z);
}

fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f0 = fract(p);
  let f = f0 * f0 * (vec3<f32>(3.0) - 2.0 * f0);

  let n000 = hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = hash3(i + vec3<f32>(1.0, 1.0, 1.0));

  let nx00 = mix(n000, n100, f.x);
  let nx10 = mix(n010, n110, f.x);
  let nx01 = mix(n001, n101, f.x);
  let nx11 = mix(n011, n111, f.x);
  let nxy0 = mix(nx00, nx10, f.y);
  let nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

fn fbm(p0: vec3<f32>) -> f32 {
  var p = p0;
  var value = 0.0;
  var amp = 0.54;
  for (var i: i32 = 0; i < 3; i = i + 1) {
    value = value + amp * noise3(p);
    p = p * 2.03 + vec3<f32>(13.7, 9.2, 17.1);
    amp = amp * 0.49;
  }
  return value;
}

fn rot(a: f32) -> mat2x2<f32> {
  let c = cos(a);
  let s = sin(a);
  return mat2x2<f32>(vec2<f32>(c, s), vec2<f32>(-s, c));
}

fn plasmaMap(pin: vec3<f32>) -> f32 {
  var p = pin;
  let xz = rot(u.time * 0.075) * vec2<f32>(p.x, p.z);
  p.x = xz.x;
  p.z = xz.y;
  let yz = rot(-0.17 + sin(u.time * 0.055) * 0.14) * vec2<f32>(p.y, p.z);
  p.y = yz.x;
  p.z = yz.y;

  let coarse = fbm(p * 1.92 + vec3<f32>(u.time * 0.085, -u.time * 0.060, u.time * 0.045));
  let warp = fbm(p * 3.18 + vec3<f32>(coarse * 2.05, -coarse * 1.45, u.time * 0.070));
  let detail = noise3(p * 5.65 + vec3<f32>(-u.time * 0.055, u.time * 0.040, coarse * 2.35));

  let len = max(length(p), 0.0001);
  let dir = p / len;
  let low = pow(max(-dir.y, 0.0), 2.0);
  let high = pow(max(dir.y, 0.0), 2.2);
  let sides = pow(abs(dir.x), 2.0);
  let audioBulge = u.bass * low * 0.155 + u.mid * sides * 0.092 + u.treble * high * 0.095;

  let fold = sin(p.x * 3.9 + p.y * 2.4 - u.time * 0.29 + coarse * 5.7) * 0.042;
  let fold2 = sin(p.z * 4.9 - p.y * 2.8 + u.time * 0.22 + warp * 4.7) * 0.030;
  let breathing = sin(u.time * 0.66) * 0.012 + u.energy * 0.030;
  let radius = 0.715 + (coarse - 0.5) * 0.215 + (warp - 0.5) * 0.112 + (detail - 0.5) * 0.024 + fold + fold2 + audioBulge + breathing;
  return len - radius;
}

fn normalAt(p: vec3<f32>) -> vec3<f32> {
  let e = 0.0060;
  let k1 = vec3<f32>(1.0, -1.0, -1.0);
  let k2 = vec3<f32>(-1.0, -1.0, 1.0);
  let k3 = vec3<f32>(-1.0, 1.0, -1.0);
  let k4 = vec3<f32>(1.0, 1.0, 1.0);
  let n = k1 * plasmaMap(p + k1 * e)
        + k2 * plasmaMap(p + k2 * e)
        + k3 * plasmaMap(p + k3 * e)
        + k4 * plasmaMap(p + k4 * e);
  return normalize(n);
}

fn palette(t0: f32) -> vec3<f32> {
  let t = fract(t0);
  let deepBlue = vec3<f32>(0.008, 0.025, 0.19);
  let blue = vec3<f32>(0.018, 0.24, 1.08);
  let cyan = vec3<f32>(0.00, 0.92, 1.30);
  let violet = vec3<f32>(0.42, 0.055, 1.02);
  let magenta = vec3<f32>(1.05, 0.025, 0.50);

  if (t < 0.22) { return mix(deepBlue, blue, t / 0.22); }
  if (t < 0.47) { return mix(blue, cyan, (t - 0.22) / 0.25); }
  if (t < 0.68) { return mix(cyan, violet, (t - 0.47) / 0.21); }
  if (t < 0.84) { return mix(violet, magenta, (t - 0.68) / 0.16); }
  return mix(magenta, deepBlue, (t - 0.84) / 0.16);
}

fn filamentField(p: vec3<f32>, phase: f32) -> f32 {
  let a = fbm(p * 5.0 + vec3<f32>(u.time * 0.11, -u.time * 0.07, phase * 2.0));
  let b = noise3(p * 8.2 + vec3<f32>(-u.time * 0.06, a * 2.5, u.time * 0.08));
  let wave = sin(a * 19.0 - b * 10.0 + p.y * 6.6 + p.z * 3.7 - u.time * 0.96 + phase);
  return pow(max(0.0, 1.0 - abs(wave)), 9.0);
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(3.0, 1.0),
    vec2<f32>(-1.0, 1.0)
  );
  return vec4<f32>(positions[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  let safeRes = max(u.resolution, vec2<f32>(1.0));
  var uv = (frag.xy * 2.0 - safeRes) / safeRes.y;
  uv.y = uv.y + 0.10;

  let ro = vec3<f32>(0.0, 0.0, 2.72);
  let rd = normalize(vec3<f32>(uv.x * 0.86, -uv.y * 0.86, -1.72));

  var travel = 0.0;
  var hit = false;
  var p = ro;
  var minAbs = 10.0;
  var haze = 0.0;

  for (var step: i32 = 0; step < 42; step = step + 1) {
    p = ro + rd * travel;
    let d = plasmaMap(p);
    let ad = abs(d);
    minAbs = min(minAbs, ad);
    haze = haze + exp(-ad * 22.0) * 0.0080;
    if (ad < 0.0044) {
      hit = true;
      break;
    }
    travel = travel + clamp(ad * 0.74, 0.010, 0.095);
    if (travel > 4.25) { break; }
  }

  var color = vec3<f32>(0.0, 0.0, 0.0);
  let radialHalo = exp(-max(0.0, length(uv) - 0.51) * 7.0) * (0.030 + u.energy * 0.12);
  color = color + vec3<f32>(0.02, 0.10, 0.46) * radialHalo;
  color = color + palette(u.time * 0.010 + 0.12) * haze * (0.34 + u.energy * 0.68);

  if (hit) {
    let n = normalAt(p);
    let viewDir = -rd;
    let lightA = normalize(vec3<f32>(-0.48, 0.62, 0.78));
    let lightB = normalize(vec3<f32>(0.72, -0.18, 0.54));
    let diffuseA = max(dot(n, lightA), 0.0);
    let diffuseB = max(dot(n, lightB), 0.0);
    let fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);

    let flow1 = fbm(p * 3.45 + vec3<f32>(u.time * 0.095, -u.time * 0.064, u.time * 0.044));
    let flow2 = fbm(p * 6.25 + vec3<f32>(-u.time * 0.060, flow1 * 2.55, u.time * 0.080));
    let flow3 = noise3(p * 9.2 + vec3<f32>(flow2 * 2.0, u.time * 0.040, -u.time * 0.055));
    let ribbons = 0.5 + 0.5 * sin(flow1 * 13.0 + flow2 * 7.2 + p.y * 4.3 - u.time * 0.54);
    let veins = pow(max(0.0, 1.0 - abs(sin(flow2 * 23.0 - flow3 * 12.0 + p.x * 6.4 + u.time * 0.39))), 9.0);

    let phase = flow1 * 0.34 + flow2 * 0.16 + p.y * 0.055 + u.time * 0.010;
    var surfaceColor = mix(palette(phase), palette(phase + 0.14), ribbons * 0.72);
    let light = 0.10 + diffuseA * 0.43 + diffuseB * 0.13;
    surfaceColor = surfaceColor * light * (0.70 + u.energy * 0.20);

    var internal = vec3<f32>(0.0);
    var transmittance = 1.0;
    for (var layer: i32 = 0; layer < 3; layer = layer + 1) {
      let depth = 0.045 + f32(layer) * 0.090;
      let vp = p + rd * depth;
      let volumeA = fbm(vp * 4.35 + vec3<f32>(u.time * 0.070, -u.time * 0.050, f32(layer) * 0.61));
      let volumeB = noise3(vp * 7.5 + vec3<f32>(-u.time * 0.048, volumeA * 2.6, u.time * 0.060));
      let filament = filamentField(vp, f32(layer) * 0.79);
      let depthPhase = phase + volumeA * 0.28 + volumeB * 0.14 + depth * 0.42;
      var layerColor = palette(depthPhase) * (0.050 + volumeA * 0.068);
      layerColor = layerColor + vec3<f32>(0.18, 0.88, 1.34) * filament * (0.23 + u.treble * 0.43 + u.energy * 0.18);
      internal = internal + layerColor * transmittance;
      transmittance = transmittance * 0.68;
    }

    let edgeElectric = vec3<f32>(0.03, 0.72, 1.35) * fresnel * (0.52 + u.mid * 0.52);
    let veinColor = mix(vec3<f32>(0.16, 0.88, 1.25), vec3<f32>(0.84, 0.12, 1.08), clamp(flow2, 0.0, 1.0));
    let electricVeins = veinColor * veins * (0.18 + u.treble * 0.66);

    let h = normalize(lightA + viewDir);
    let spec = pow(max(dot(n, h), 0.0), 62.0);
    let sharpSpark = vec3<f32>(0.72, 0.96, 1.25) * spec * (0.14 + u.energy * 0.26);

    let innerPulse = 0.5 + 0.5 * sin(u.time * 1.12 + flow1 * 5.3);
    let pulseGlow = palette(phase + 0.31) * innerPulse * u.bass * 0.10;

    color = color + surfaceColor * 0.62 + internal * 1.24 + electricVeins + edgeElectric + sharpSpark + pulseGlow;
  } else {
    let edgeAura = exp(-minAbs * 12.0) * (0.085 + u.energy * 0.34);
    let auraColor = mix(vec3<f32>(0.01, 0.23, 0.95), vec3<f32>(0.00, 0.91, 1.20), clamp(uv.y + 0.45, 0.0, 1.0));
    color = color + auraColor * edgeAura;
  }

  color = color * u.intensity;
  color = vec3<f32>(1.0) - exp(-color * 1.12);
  color = pow(color, vec3<f32>(0.90));
  let vignette = smoothstep(1.45, 0.35, length(uv * vec2<f32>(0.78, 0.70)));
  color = color * (0.74 + vignette * 0.26);
  return vec4<f32>(color, 1.0);
}
`;

  function updateNotice() {
    if (!notice || selector.value !== 'plasma') return;
    if (ready) notice.textContent = 'Plasma Ultra · WebGPU/WGSL';
    else if (failed) notice.textContent = 'WebGPU no disponible · usando WebGL';
  }

  function isActive() {
    return selector.value === 'plasma' && ready && !failed;
  }

  function syncVisibility() {
    const active = isActive();
    window.sinestesiaPlasmaWebGPUActive = active;
    surface.hidden = !active;

    const webglCanvas = document.getElementById('plasmaWebGLCanvas');
    if (webglCanvas) {
      webglCanvas.hidden = active ? true : !window.sinestesiaPlasmaWebGLActive;
    }

    if (active) {
      baseCanvas.style.visibility = 'hidden';
    } else if (!window.sinestesiaFluidActive && !window.sinestesiaPlasmaWebGLActive) {
      baseCanvas.style.visibility = 'visible';
    }
    updateNotice();
  }

  async function init() {
    if (!navigator.gpu) {
      failed = true;
      syncVisibility();
      return;
    }

    try {
      adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('No WebGPU adapter');
      device = await adapter.requestDevice();
      context = surface.getContext('webgpu');
      if (!context) throw new Error('No WebGPU canvas context');
      format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });

      const module = device.createShaderModule({ code: shader });
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      uniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      device.lost.then(() => {
        ready = false;
        failed = true;
        syncVisibility();
      });

      ready = true;
      failed = false;
      syncVisibility();
    } catch (error) {
      console.warn('Plasma WebGPU unavailable; WebGL fallback active:', error);
      ready = false;
      failed = true;
      syncVisibility();
    }
  }

  selector.addEventListener('change', syncVisibility);

  const previousDraw = drawAurora;
  drawAurora = function drawPlasmaUltra(width, height) {
    if (!isActive()) {
      previousDraw(width, height);
      return;
    }

    const now = performance.now();
    const frameMs = lastFrameAt ? now - lastFrameAt : 0;
    lastFrameAt = now;

    if (!audio.paused && frameMs > 36) {
      slowFrames += 1;
      fastFrames = 0;
    } else if (frameMs > 0 && frameMs < 26) {
      fastFrames += 1;
      slowFrames = Math.max(0, slowFrames - 1);
    } else {
      slowFrames = Math.max(0, slowFrames - 1);
      fastFrames = Math.max(0, fastFrames - 1);
    }

    if (slowFrames > 18) {
      quality = Math.max(0.48, quality - 0.10);
      slowFrames = 0;
    } else if (fastFrames > 180) {
      quality = Math.min(0.92, quality + 0.04);
      fastFrames = 0;
    }

    const maxPixels = 320000;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      1.15,
      Math.sqrt(maxPixels / Math.max(1, width * height)),
    ) * quality;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (surface.width !== w || surface.height !== h) {
      surface.width = w;
      surface.height = h;
      context.configure({ device, format, alphaMode: 'opaque' });
    }

    const signal = fastBeatSignal();
    const uniforms = new Float32Array([
      w, h,
      plasmaClock,
      signal.bass,
      signal.mid,
      signal.treble,
      signal.energy,
      1.14 + signal.energy * 0.18,
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
    device.queue.submit([encoder.finish()]);
  };

  syncVisibility();
  init();
})();
