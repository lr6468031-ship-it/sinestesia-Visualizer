// XY gates use the peak dBFS within each selected frequency band, matching the graph.
function withinDetectionBox(spectrum, sampleRate, lo, hi, kind, settings) {
  if (!Number.isFinite(settings[`${kind}Level`])) return true;
  const binHz = sampleRate / (2 * spectrum.length);
  let peak = -Infinity;
  for (let i = Math.max(1, Math.ceil(lo / binHz)); i < spectrum.length && i * binHz <= hi; i++) peak = Math.max(peak, spectrum[i]);
  const level = settings[`${kind}Level`], tolerance = Math.max(5, Math.min(50, Number(settings[`${kind}Tolerance`]) || 40));
  return peak >= level - tolerance && peak <= Math.min(0, level + tolerance);
}

class BeatTempoEstimator {
  constructor() { this.reset(); }
  reset() { this.times = []; this.bpm = null; }
  add(time) {
    if (this.times.length && time <= this.times[this.times.length - 1]) this.reset();
    this.times.push(time); if (this.times.length > 17) this.times.shift();
    if (this.times.length < 6) return null;
    const intervals = this.times.slice(1).map((t, i) => t - this.times[i]).filter(x => x >= 200 && x <= 2000);
    if (intervals.length < 5) return this.bpm = null;
    const sorted = [...intervals].sort((a,b) => a-b), median = sorted[Math.floor(sorted.length/2)];
    const regular = intervals.filter(x => Math.abs(x - median) / median < 0.15);
    if (regular.length < intervals.length * 0.7) return this.bpm = null;
    let bpm = 60000 / (regular.reduce((a,b)=>a+b,0) / regular.length);
    while (bpm < 60) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return this.bpm = Math.round(bpm);
  }
}

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
  update(spectrum, sampleRate, now, settings = {}) {
    const binHz = sampleRate / (spectrum.length * 2);
    const center = Math.max(30, Math.min(300, Number(settings.kickHz) || 60));
    const sensitivity = Math.max(0.5, Math.min(2, Number(settings.kickSensitivity) || 1));
    let body = 0, support = 0, peak = 0, peakHz = 0;
    for (let i = Math.ceil(center * 0.5 / binHz); i * binHz <= center * (160 / 60) && i < spectrum.length; i++) {
      const power = Math.pow(10, spectrum[i] / 10);
      if (i * binHz <= center * 1.5) {
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
      && withinDetectionBox(spectrum, sampleRate, center * 0.5, center * 1.5, 'kick', settings)
      && body > 1e-6 / sensitivity && energy > this.baseline * (1 + 0.65 / sensitivity)
      && flux > Math.max(1e-6 / sensitivity, this.fluxMean * (1 + 1.5 / sensitivity), this.previous * 0.3 / sensitivity);
    const strength = hit ? Math.min(1, 0.55 + flux / Math.max(energy, 1e-6) * 0.45) : 0;
    if (hit) { this.lastHit = now; this.peakHz = peakHz; }
    this.baseline += (energy - this.baseline) * (1 - Math.exp(-dt / 450));
    this.fluxMean += (flux - this.fluxMean) * (1 - Math.exp(-dt / 600));
    this.previous = energy;
    this.lastTime = now;
    return strength;
  }
}

// Snare requires a body transient AND a broadband attack; hats and bass alone fail.
class SnareOnsetDetector {
  constructor() { this.reset(); }
  reset() {
    this.previous = 0; this.baseline = 0; this.fluxMean = 0;
    this.lastTime = null; this.started = null; this.lastHit = -Infinity;
  }
  update(spectrum, sampleRate, now, settings = {}) {
    const binHz = sampleRate / (spectrum.length * 2);
    const mean = (lo, hi) => {
      let sum = 0, count = 0;
      for (let i = Math.ceil(lo / binHz); i * binHz <= hi && i < spectrum.length; i++) {
        sum += Math.pow(10, spectrum[i] / 10); count++;
      }
      return sum / Math.max(1, count);
    };
    const center = Math.max(100, Math.min(1500, Number(settings.snareHz) || 200));
    const sensitivity = Math.max(0.5, Math.min(2, Number(settings.snareSensitivity) || 1));
    const body = mean(center * 0.75, center * 1.5), snap = mean(2000, 6000);
    const low = mean(30, 100), air = mean(8000, 14000);
    let occupied = 0, count = 0;
    for (let i = Math.ceil(2000 / binHz); i * binHz <= 6000 && i < spectrum.length; i++) {
      if (Math.pow(10, spectrum[i] / 10) > snap * 0.1) occupied++;
      count++;
    }
    const energy = Math.sqrt(body * snap);
    if (this.started === null) this.started = now;
    const dt = this.lastTime === null ? 24 : Math.max(1, Math.min(100, now - this.lastTime));
    const flux = Math.max(0, energy - this.previous);
    const hit = now - this.started >= 100 && now - this.lastHit >= 140
      && withinDetectionBox(spectrum, sampleRate, center * 0.75, center * 1.5, 'snare', settings)
      && body > 1e-7 / sensitivity && snap > 1e-7 / sensitivity && snap > low * 0.08
      && body > air * 0.12 && occupied > count * 0.25
      && energy > this.baseline * (1 + 0.8 / sensitivity)
      && flux > Math.max(1e-7 / sensitivity, this.fluxMean * (1 + 1.8 / sensitivity), this.previous * 0.35 / sensitivity);
    if (hit) this.lastHit = now;
    this.baseline += (energy - this.baseline) * (1 - Math.exp(-dt / 450));
    this.fluxMean += (flux - this.fluxMean) * (1 - Math.exp(-dt / 600));
    this.previous = energy; this.lastTime = now;
    return hit ? Math.min(1, 0.65 + flux / Math.max(energy, 1e-7) * 0.35) : 0;
  }
}

// Tonal spectral onsets: sparse harmonic peaks and positive flux, not instrument labels.
class MelodyOnsetDetector {
  constructor() { this.reset(); }
  reset() {
    this.previous = null; this.fluxMean = 0; this.lastTime = null;
    this.started = null; this.lastHit = -Infinity; this.peakHz = 0;
  }
  update(spectrum, sampleRate, now, settings = {}) {
    const center = Math.max(100, Math.min(8000, Number(settings.melodyHz) || 700));
    const width = Math.max(0.5, Math.min(4, Number(settings.melodyWidth) || 2));
    const sensitivity = Math.max(0.5, Math.min(2, Number(settings.melodySensitivity) || 1));
    const binHz = sampleRate / (spectrum.length * 2);
    const lo = center / Math.pow(2, width / 2), hi = Math.min(sampleRate / 2, center * Math.pow(2, width / 2));
    if (!this.previous || this.previous.length !== spectrum.length) this.previous = new Float32Array(spectrum.length);
    let sum = 0, logSum = 0, peak = 0, peakHz = 0, flux = 0, count = 0;
    for (let i = Math.max(1, Math.ceil(lo / binHz)); i < spectrum.length && i * binHz <= hi; i++) {
      const power = Math.pow(10, spectrum[i] / 10);
      sum += power; logSum += Math.log(Math.max(1e-12, power)); count++;
      flux += Math.max(0, power - this.previous[i]);
      if (power > peak) { peak = power; peakHz = i * binHz; }
      this.previous[i] = power;
    }
    const mean = sum / Math.max(1, count);
    const flatness = Math.exp(logSum / Math.max(1, count)) / Math.max(1e-12, mean);
    const tonal = flatness < 0.35 && peak > mean * 5;
    if (this.started === null) this.started = now;
    const dt = this.lastTime === null ? 24 : Math.max(1, Math.min(100, now - this.lastTime));
    const hit = now - this.started >= 100 && now - this.lastHit >= 95 && tonal
      && withinDetectionBox(spectrum, sampleRate, lo, hi, 'melody', settings)
      && peak > 1e-6 / sensitivity && flux > Math.max(3e-7 / sensitivity, this.fluxMean * (1 + 1.5 / sensitivity), sum * 0.12 / sensitivity);
    if (hit) { this.lastHit = now; this.peakHz = peakHz; }
    this.fluxMean += (flux - this.fluxMean) * (1 - Math.exp(-dt / 450));
    this.lastTime = now;
    return hit ? Math.min(1, 0.4 + flux / Math.max(sum, 1e-12) * 0.6) : 0;
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
    uniform vec2 starPoints[8];

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

    float segmentDistance(vec2 p, vec2 a, vec2 b) {
      vec2 ab = b - a;
      return length(p - a - ab * clamp(dot(p - a, ab) / max(dot(ab, ab), 0.00001), 0.0, 1.0));
    }

    void main() {
      vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      p.y -= 0.07;
      float pulse = clamp(bass, 0.0, 1.0);
      float radius = 0.255 + pulse * 0.055;
      float a = atan(p.y, p.x);
      float contour = radius * (1.0 + pulse * 0.035 * sin(a * 3.0)
        + 0.009 * sin(a * 5.0 + time * 0.7) + 0.006 * sin(a * 9.0 - time * 0.5));
      float distanceToEdge = abs(length(p) - contour);
      float snare = clamp(mid, 0.0, 1.0);
      float thickness = 0.006 + pulse * 0.003 + snare * 0.002;
      float edge = 1.0 - smoothstep(thickness, thickness + 0.002, distanceToEdge);
      float exterior = step(contour + thickness, length(p));
      vec3 edgeColor = palette(a / 6.2831853 + 0.5 + time * 0.025);
      // White turbulence is clipped to the colored stroke, never the black center.
      float plasma = fbm(vec2(a * 8.0, time * 4.0 + distanceToEdge * 400.0));
      float core = (1.0 - smoothstep(thickness * 0.12, thickness * 0.63, distanceToEdge))
                 * (0.6 + plasma * 0.7);
      float bloom = exp(-distanceToEdge * 100.0) * exterior;
      float outward = max(0.0, length(p) - contour - thickness);
      float curtain = 0.025 + snare * (0.035 + 0.065 * fbm(vec2(a * 10.0, time * 3.0)));
      float rays = pow(0.5 + 0.5 * sin(a * 65.0 + plasma * 7.0), 3.0);
      float aurora = exterior * snare * exp(-outward / curtain)
                   * (1.0 - smoothstep(curtain, curtain * 2.0, outward)) * (0.25 + rays);
      vec3 color = edgeColor * (edge * (1.3 + pulse + snare) + bloom * (0.4 + pulse * 0.5));
      color += vec3(1.0) * core * edge * (1.15 + pulse + snare * 1.5);
      color += mix(edgeColor, vec3(1.0), 0.35) * aurora * 2.0;
      // Tonal notes illuminate moving stars and short lightning links inside the hollow ring.
      float melody = clamp(treble, 0.0, 1.0);
      float inside = 1.0 - smoothstep(contour - thickness - 0.012, contour - thickness - 0.005, length(p));
      vec3 stars = vec3(0.0);
      if (melody > 0.003) {
      for (int i = 0; i < 7; i++) {
        float index = float(i);
        vec2 star = starPoints[i];
        vec2 next = starPoints[i + 1];
        float sparkle = 0.6 + 0.4 * sin(index * 2.7 + energy * 13.0 + time * 2.0);
        float dotGlow = exp(-length(p - star) * 450.0);
        vec2 normal = normalize(vec2(-(next - star).y, (next - star).x));
        vec2 joint = mix(star, next, 0.48) + normal * sin(index * 7.0 + time * 18.0) * 0.009 * melody;
        float bolt = min(segmentDistance(p, star, joint), segmentDistance(p, joint, next));
        float form = smoothstep(0.0, 0.22, 1.0 - melody);
        float link = exp(-bolt * 1000.0) * form * (0.15 + melody * 0.5);
        vec3 tint = mix(palette(index / 7.0 + time * 0.025), vec3(0.7, 1.0, 0.9), 0.65);
        stars += tint * (dotGlow * (1.5 + sparkle) + link) * melody;
      }
      }
      color += stars * inside;
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
      stars: gl.getUniformLocation(program, 'starPoints[0]'),
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
  const snareDetector = new SnareOnsetDetector();
  const melodyDetector = new MelodyOnsetDetector();
  const tempo = new BeatTempoEstimator();
  let melodySeed = 0;
  let melodyPulse = 0;
  let snarePulse = 0;
  let lastPulseFrame = 0;
  let pulse = 0;

  function resetKick() {
    kickDetector.reset();
    snareDetector.reset();
    melodyDetector.reset();
    tempo.reset();
    melodyPulse = 0;
    snarePulse = 0;
    pulse = 0;
  }
  window.addEventListener('sinestesia-detection-change', resetKick);
  audio.addEventListener('seeking', resetKick);
  audio.addEventListener('emptied', resetKick);
  audio.addEventListener('pause', resetKick);

  function readKickPulse() {
    const now = performance.now();
    const dt = Math.min(100, lastPulseFrame ? now - lastPulseFrame : 24);
    lastPulseFrame = now;
    pulse *= Math.exp(-dt / 150);
    snarePulse *= Math.exp(-dt / 95);
    melodyPulse *= Math.exp(-dt / 220);
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
      if (window.sinestesiaSpectrumFrame) window.sinestesiaSpectrumFrame(kickSpectrum, audioContext.sampleRate, now);
      const hit = kickDetector.update(kickSpectrum, audioContext.sampleRate, now, window.sinestesiaDetectionSettings);
      if (hit) { pulse = Math.max(pulse, hit); tempo.add(audio.currentTime * 1000); }
      const snareHit = snareDetector.update(kickSpectrum, audioContext.sampleRate, now, window.sinestesiaDetectionSettings);
      if (snareHit) snarePulse = Math.max(snarePulse, snareHit);
      const melodyHit = melodyDetector.update(kickSpectrum, audioContext.sampleRate, now, window.sinestesiaDetectionSettings);
      if (melodyHit) { melodyPulse = 1; melodySeed += 1.618; }
    }
    window.sinestesiaKickReadout = { pulse, snare: snarePulse, melody: melodyPulse, melodyHz: melodyPulse > 0.05 ? melodyDetector.peakHz : 0, hz: pulse > 0.05 ? kickDetector.peakHz : 0, bpm: tempo.bpm, level: audio.paused ? 0 : Math.min(1, Math.sqrt(kickDetector.previous)) };
    const gain = Number(document.getElementById('fluidIntensity').value) || 1.35;
    return { kick: Math.min(1, pulse * gain / 1.35), snare: Math.min(1, snarePulse * gain / 1.35), melody: Math.min(1, melodyPulse * gain / 1.35), note: melodySeed + Math.min(1, melodyDetector.peakHz / 8000) };
  }

  function drawKickFallback(width, height) {
    const signal = readKickPulse();
    const level = signal.kick;
    const radius = height * (0.255 + level * 0.055);
    const gradient = ctx.createConicGradient(contourClock * 0.025, width / 2, height * 0.43);
    ['#08cfff', '#7433ff', '#ff2099', '#073dcc', '#08cfff'].forEach((color, i) => gradient.addColorStop(i / 4, color));
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = height * (0.012 + level * 0.006);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.43, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth *= 0.3;
    ctx.stroke();
    if (signal.snare > 0.01) {
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(1, height * 0.003);
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * Math.PI * 2;
        const reach = height * signal.snare * (0.025 + 0.04 * (0.5 + 0.5 * Math.sin(i * 13.7 + contourClock * 12)));
        ctx.globalAlpha = signal.snare * 0.7;
        const start = radius + height * (0.006 + level * 0.003);
        ctx.beginPath();
        ctx.moveTo(width / 2 + Math.cos(a) * start, height * 0.43 + Math.sin(a) * start);
        ctx.lineTo(width / 2 + Math.cos(a) * (start + reach), height * 0.43 + Math.sin(a) * (start + reach));
        ctx.stroke();
      }
    }
    if (signal.melody > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.arc(width / 2, height * 0.43, radius - height * 0.015, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = signal.melody;
      const stars = Array.from({ length: 7 }, (_, i) => {
        const angle = i * 2.39996 + Math.sin(contourClock * 0.35 + i) * 0.18 + signal.note * 1.8;
        const orbit = radius * (0.22 + 0.36 * (0.5 + 0.5 * Math.sin(i * 8.7 + signal.note * 3.0)));
        return { x: width / 2 + Math.cos(angle) * orbit, y: height * 0.43 + Math.sin(angle) * orbit };
      });
      ctx.strokeStyle = `hsl(${(contourClock * 4 + signal.note * 30) % 360} 85% 80%)`; ctx.lineWidth = 1;
      stars.forEach((star, i) => {
        const next = stars[(i + 1) % stars.length];
        ctx.beginPath(); ctx.moveTo(star.x, star.y);
        ctx.lineTo((star.x + next.x) / 2 + Math.sin(i * 7 + contourClock * 18) * signal.melody * 4, (star.y + next.y) / 2);
        ctx.lineTo(next.x, next.y); ctx.stroke();
        ctx.fillStyle = '#d5ffed'; ctx.beginPath();
        ctx.arc(star.x, star.y, 1.5 + signal.melody * 2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }
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

    const percussion = readKickPulse();
    const signal = { bass: percussion.kick, mid: percussion.snare, treble: percussion.melody, energy: percussion.note };
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
    const points = new Float32Array(16);
    for (let i = 0; i < 8; i++) {
      const index = i % 7;
      const t = contourClock * getColorSpeed() * 0.5;
      const angle = index * 2.39996 + Math.sin(t * 0.9 + index + signal.energy) * 0.45 + signal.energy * 1.8;
      const orbit = (0.055 + 0.12 * (0.5 + 0.5 * Math.sin(index * 8.7 + signal.energy * 3.0))) * (0.65 + 0.35 * (1 - signal.treble));
      points[i * 2] = Math.cos(angle) * orbit + Math.sin(t * 0.6 + index * 2) * 0.014;
      points[i * 2 + 1] = Math.sin(angle) * orbit + Math.cos(t * 0.5 + index) * 0.014;
    }
    gl.uniform2fv(locations.stars, points);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  syncVisibility();
})();
