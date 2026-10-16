// Sinestesia Plasma Ultra: WebGPU + WGSL ray-marched volumetric plasma.
// WebGL plasma remains the automatic fallback when WebGPU is unavailable.
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
  let quality = 1.0;
  let slowFrames = 0;
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
  var amp = 0.52;
  for (var i: i32 = 0; i < 4; i = i + 1) {
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
  let xz = rot(u.time * 0.085) * vec2<f32>(p.x, p.z);
  p.x = xz.x;
  p.z = xz.y;
  let yz = rot(-0.19 + sin(u.time * 0.07) * 0.16) * vec2<f32>(p.y, p.z);
  p.y = yz.x;
  p.z = yz.y;

  let coarse = fbm(p * 2.05 + vec3<f32>(u.time * 0.11, -u.time * 0.08, u.time * 0.06));
  let warp = fbm(p * 3.55 + vec3<f32>(coarse * 1.8, -coarse * 1.2, u.time * 0.09));
  let detail = fbm(p * 6.0 + vec3<f32>(-u.time * 0.07, u.time * 0.05, coarse * 2.1));

  let len = max(length(p), 0.0001);
  let dir = p / len;
  let low = pow(max(-dir.y, 0.0), 2.1);
  let high = pow(max(dir.y, 0.0), 2.2);
  let sides = pow(abs(dir.x), 2.0);
  let audioBulge = u.bass * low * 0.145 + u.mid * sides * 0.095 + u.treble * high * 0.105;

  let fold = sin(p.x * 4.2 + p.y * 2.7 - u.time * 0.36 + coarse * 5.0) * 0.035;
  let fold2 = sin(p.z * 5.4 - p.y * 3.1 + u.time * 0.27 + warp * 4.0) * 0.026;
  let breathing = sin(u.time * 0.78) * 0.013 + u.energy * 0.035;
  let radius = 0.72 + (coarse - 0.5) * 0.20 + (warp - 0.5) * 0.105 + (detail - 0.5) * 0.035 + fold + fold2 + audioBulge + breathing;
  return len - radius;
}

fn normalAt(p: vec3<f32>) -> vec3<f32> {
  let e = 0.0045;
  let dx = plasmaMap(p + vec3<f32>(e, 0.0, 0.0)) - plasmaMap(p - vec3<f32>(e, 0.0, 0.0));
  let dy = plasmaMap(p + vec3<f32>(0.0, e, 0.0)) - plasmaMap(p - vec3<f32>(0.0, e, 0.0));
  let dz = plasmaMap(p + vec3<f32>(0.0, 0.0, e)) - plasmaMap(p - vec3<f32>(0.0, 0.0, e));
  return normalize(vec3<f32>(dx, dy, dz));
}

fn palette(t0: f32) -> vec3<f32> {
  let t = fract(t0);
  let a = vec3<f32>(0.56, 0.47, 0.62);
  let b = vec3<f32>(0.52, 0.50, 0.44);
  let c = vec3<f32>(1.0, 1.0, 1.0);
  let d = vec3<f32>(0.58, 0.13, 0.82);
  return clamp(a + b * cos(6.2831853 * (c * t + d)), vec3<f32>(0.0), vec3<f32>(1.35));
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

  for (var step: i32 = 0; step < 64; step = step + 1) {
    p = ro + rd * travel;
    let d = plasmaMap(p);
    let ad = abs(d);
    minAbs = min(minAbs, ad);
    haze = haze + exp(-ad * 26.0) * 0.0075;
    if (ad < 0.0038) {
      hit = true;
      break;
    }
    travel = travel + clamp(ad * 0.68, 0.008, 0.082);
    if (travel > 4.25) {
      break;
    }
  }

  var color = vec3<f32>(0.0, 0.0, 0.0);
  let radialHalo = exp(-max(0.0, length(uv) - 0.53) * 7.5) * (0.035 + u.energy * 0.11);
  color = color + vec3<f32>(0.16, 0.05, 0.48) * radialHalo;
  color = color + palette(u.time * 0.012 + 0.72) * haze * (0.45 + u.energy * 0.85);

  if (hit) {
    let n = normalAt(p);
    let viewDir = -rd;
    let lightA = normalize(vec3<f32>(-0.48, 0.62, 0.78));
    let lightB = normalize(vec3<f32>(0.72, -0.18, 0.54));
    let diffuseA = max(dot(n, lightA), 0.0);
    let diffuseB = max(dot(n, lightB), 0.0);
    let fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.25);

    let flow1 = fbm(p * 3.7 + vec3<f32>(u.time * 0.13, -u.time * 0.09, u.time * 0.06));
    let flow2 = fbm(p * 7.1 + vec3<f32>(-u.time * 0.08, flow1 * 2.4, u.time * 0.11));
    let flow3 = fbm(p * 11.0 + vec3<f32>(flow2 * 2.0, u.time * 0.05, -u.time * 0.07));
    let ribbons = 0.5 + 0.5 * sin(flow1 * 15.0 + flow2 * 8.0 + p.y * 5.0 - u.time * 0.72);
    let veins = pow(0.5 + 0.5 * sin(flow2 * 28.0 - flow3 * 13.0 + p.x * 7.0 + u.time * 0.46), 8.0);

    let phase = flow1 * 0.47 + flow2 * 0.22 + p.y * 0.08 + u.time * 0.016;
    var base = mix(palette(phase), palette(phase + 0.23), ribbons);
    let light = 0.20 + diffuseA * 0.78 + diffuseB * 0.26;
    base = base * light * (0.88 + u.energy * 0.30);

    base = base + palette(phase + 0.37) * veins * (0.20 + u.treble * 0.72);
    base = base + vec3<f32>(0.22, 0.48, 1.0) * fresnel * (0.60 + u.mid * 0.58);

    let h = normalize(lightA + viewDir);
    let spec = pow(max(dot(n, h), 0.0), 48.0);
    base = base + vec3<f32>(1.0, 0.94, 0.88) * spec * (0.52 + u.energy * 0.76);

    let innerPulse = 0.5 + 0.5 * sin(u.time * 1.25 + flow1 * 6.0);
    base = base + palette(phase + 0.58) * innerPulse * u.bass * 0.16;
    color = color + base;
  } else {
    let edgeAura = exp(-minAbs * 13.0) * (0.10 + u.energy * 0.38);
    color = color + palette(u.time * 0.014 + uv.y * 0.10) * edgeAura;
  }

  color = color * u.intensity;
  color = vec3<f32>(1.0) - exp(-color * 1.24);
  color = pow(color, vec3<f32>(0.88));
  let vignette = smoothstep(1.45, 0.35, length(uv * vec2<f32>(0.78, 0.70)));
  color = color * (0.76 + vignette * 0.24);
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
    if (!audio.paused && lastFrameAt && now - lastFrameAt > 44) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 1);
    lastFrameAt = now;
    if (slowFrames > 45) {
      quality = Math.max(0.58, quality - 0.08);
      slowFrames = 0;
    }

    const maxPixels = 520000;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      1.45,
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
      1.20 + signal.energy * 0.22,
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
