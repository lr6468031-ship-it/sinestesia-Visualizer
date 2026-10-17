// Adaptive kick onset detection, restricted to low frequencies (30–160 Hz).
// A transient detector, not source separation: bass plucks can resemble a kick.
class KickOnsetDetector {
  constructor() { this.reset(); }
  reset() {
    this.previous = 0;
    this.peakHz = 0;
    this.baseline = 0;
    this.fluxMean = 0;
    this.lastTime = null;
    this.started = null;
    this.lastHit = -Infinity;
  }
  update(spectrum, sampleRate, now) {
    const binHz = sampleRate / (spectrum.length * 2);
    let body = 0, support = 0, peak = 0, peakHz = 0;
    for (let i = Math.ceil(30 / binHz); i * binHz <= 160; i++) {
      const power = Math.pow(10, spectrum[i] / 10);
      if (i * binHz <= 90) {
        body += power;
        if (power > peak) { peak = power; peakHz = i * binHz; }
      }
      else support += power;
    }
    // Main weight on the fundamental (including 43–80 Hz), not mid/high clicks.
    const energy = body + support * 0.15;
    if (this.started === null) this.started = now;
    const dt = this.lastTime === null ? 24 : Math.max(1, Math.min(100, now - this.lastTime));
    const flux = Math.max(0, energy - this.previous);
    const hit = now - this.started >= 100 && now - this.lastHit >= 170
      && body > 1e-6 && energy > this.baseline * 1.65
      && flux > Math.max(1e-6, this.fluxMean * 2.5, this.previous * 0.3);
    const strength = hit ? Math.min(1, 0.55 + flux / Math.max(energy, 1e-6) * 0.45) : 0;
    if (hit) { this.lastHit = now; this.peakHz = peakHz; }
    this.baseline += (energy - this.baseline) * (1 - Math.exp(-dt / 450));
    this.fluxMean += (flux - this.fluxMean) * (1 - Math.exp(-dt / 600));
    this.previous = energy;
    this.lastTime = now;
    return strength;
  }
}

// WebGL plasma fallback for Sinestesia Visualizer.
// Performance-tuned for mobile while preserving the electric organic look.
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const baseCanvas = document.getElementById('visualizer');
  if (!selector || !baseCanvas || !baseCanvas.parentElement) return;

  const stage = baseCanvas.parentElement;
  const surface = document.createElement('canvas');
  surface.id = 'plasmaWebGLCanvas';
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

  const fluidCanvas = document.getElementById('fluidCanvas');
  if (fluidCanvas && fluidCanvas.nextSibling) stage.insertBefore(surface, fluidCanvas.nextSibling);
  else stage.insertBefore(surface, baseCanvas.nextSibling);

  const gl = surface.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });

  let ready = false;
  let contextLost = false;
  let program = null;
  let locations = null;
  let buffer = null;

  const vertexSource = `
    precision highp float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    varying vec2 uv;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float treble;
    uniform float energy;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.54;
      mat2 r = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = r * p * 2.03 + vec2(17.1, 9.2);
        a *= 0.49;
      }
      return v;
    }

    vec3 palette(float t) {
      vec3 deepBlue = vec3(0.018, 0.06, 0.48);
      vec3 cyan = vec3(0.02, 0.86, 1.0);
      vec3 violet = vec3(0.43, 0.07, 1.0);
      vec3 magenta = vec3(1.0, 0.06, 0.56);
      float x = fract(t);
      if (x < 0.24) return mix(deepBlue, cyan, x / 0.24);
      if (x < 0.50) return mix(cyan, violet, (x - 0.24) / 0.26);
      if (x < 0.76) return mix(violet, magenta, (x - 0.50) / 0.26);
      return mix(magenta, deepBlue, (x - 0.76) / 0.24);
    }

    void main() {
      vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      p.y -= 0.07;
      float pulse = clamp(bass, 0.0, 1.0);
      float radius = 0.255 + pulse * 0.055;
      float a = atan(p.y, p.x);
      float contour = radius * (1.0 + pulse * 0.035 * sin(a * 3.0));
      float distanceToEdge = abs(length(p) - contour);
      float thickness = 0.0018 + pulse * 0.0018;
      float edge = 1.0 - smoothstep(thickness, thickness + 0.002, distanceToEdge);
      // No surface, ribbons or inward bloom: the center remains completely black.
      float exterior = step(contour, length(p));
      float bloom = exp(-distanceToEdge * 180.0) * exterior;
      vec3 edgeColor = palette(a / 6.2831853 + 0.5);
      vec3 color = edgeColor * (edge * (0.5 + pulse * 1.5) + bloom * pulse * 0.35);
      color = vec3(1.0) - exp(-color * 1.35);
      gl_FragColor = vec4(color,1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || 'Shader compilation failed');
    }
    return shader;
  }

  function build() {
    if (!gl) return;
    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

    locations = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      bass: gl.getUniformLocation(program, 'bass'),
      mid: gl.getUniformLocation(program, 'mid'),
      treble: gl.getUniformLocation(program, 'treble'),
      energy: gl.getUniformLocation(program, 'energy'),
    };

    gl.clearColor(0, 0, 0, 1);
    ready = true;
  }

  if (gl) {
    try {
      build();
    } catch (error) {
      console.warn('WebGL Plasma unavailable:', error);
    }
  }

  function isActive() {
    return selector.value === 'plasma' && ready && !contextLost;
  }

  function syncVisibility() {
    const active = isActive();
    window.sinestesiaPlasmaWebGLActive = active;
    surface.hidden = !active;
    surface.style.display = active ? 'block' : 'none';
    if (active) {
      baseCanvas.style.visibility = 'hidden';
    } else if (!window.sinestesiaFluidActive) {
      baseCanvas.style.visibility = 'visible';
    }
  }

  selector.addEventListener('change', syncVisibility);
  surface.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    syncVisibility();
  });
  surface.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    ready = false;
    try { build(); } catch (error) { console.warn('WebGL Plasma restore failed:', error); }
    syncVisibility();
  });

  let kickAnalyser = null;
  let kickSpectrum = null;
  const kickDetector = new KickOnsetDetector();
  let lastPulseFrame = 0;
  let pulse = 0;

  function resetKick() {
    kickDetector.reset();
    pulse = 0;
  }
  audio.addEventListener('seeking', resetKick);
  audio.addEventListener('emptied', resetKick);
  audio.addEventListener('pause', resetKick);

  function readKickPulse() {
    const now = performance.now();
    const dt = Math.min(100, lastPulseFrame ? now - lastPulseFrame : 24);
    lastPulseFrame = now;
    pulse *= Math.exp(-dt / 150);
    if (!audio.paused && source && audioContext) {
      if (!kickAnalyser) {
        // Independent, unsmoothed FFT: visual smoothing must not hide kick attacks.
        kickAnalyser = audioContext.createAnalyser();
        kickAnalyser.fftSize = 4096;
        kickAnalyser.smoothingTimeConstant = 0;
        source.connect(kickAnalyser);
        kickSpectrum = new Float32Array(kickAnalyser.frequencyBinCount);
      }
      kickAnalyser.getFloatFrequencyData(kickSpectrum);
      const hit = kickDetector.update(kickSpectrum, audioContext.sampleRate, now);
      if (hit) pulse = Math.max(pulse, hit);
    }
    window.sinestesiaKickReadout = { pulse, hz: pulse > 0.05 ? kickDetector.peakHz : 0, level: audio.paused ? 0 : Math.min(1, Math.sqrt(kickDetector.previous)) };
    const gain = Number(document.getElementById('fluidIntensity').value) || 1.35;
    return Math.min(1, pulse * gain / 1.35);
  }

  function drawKickFallback(width, height) {
    const level = readKickPulse();
    const radius = height * (0.255 + level * 0.055);
    const gradient = ctx.createConicGradient(0, width / 2, height * 0.43);
    ['#08cfff', '#7433ff', '#ff2099', '#073dcc', '#08cfff'].forEach((color, i) => gradient.addColorStop(i / 4, color));
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5 + level * 3;
    ctx.globalAlpha = 0.5 + level * 0.5;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.43, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  let quality = 0.92;
  let slowFrames = 0;
  let fastFrames = 0;
  let lastFrameAt = 0;

  drawAurora = function drawPlasmaWebGL(width, height) {
    if (!isActive()) {
      drawKickFallback(width, height);
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

    if (slowFrames > 16) {
      quality = Math.max(0.48, quality - 0.10);
      slowFrames = 0;
    } else if (fastFrames > 180) {
      quality = Math.min(0.92, quality + 0.04);
      fastFrames = 0;
    }

    const maxPixels = 300000;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      1.10,
      Math.sqrt(maxPixels / Math.max(1, width * height)),
    ) * quality;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (surface.width !== w || surface.height !== h) {
      surface.width = w;
      surface.height = h;
    }

    const signal = { bass: readKickPulse(), mid: 0, treble: 0, energy: 0 };
    surface.style.filter = baseCanvas.style.filter;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(locations.resolution, w, h);
    gl.uniform1f(locations.time, contourClock * getColorSpeed() * 0.5);
    gl.uniform1f(locations.bass, signal.bass);
    gl.uniform1f(locations.mid, signal.mid);
    gl.uniform1f(locations.treble, signal.treble);
    gl.uniform1f(locations.energy, signal.energy);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  syncVisibility();
})();
