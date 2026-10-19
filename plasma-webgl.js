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

// A continuous phase driven only by tonal onsets, independent of kick tempo and FPS.
class MelodyFlowMotion {
  constructor() { this.reset(); }
  reset() { this.phase = 0; this.speed = 0; this.lastHit = null; this.interval = null; this.level = 0; }
  update(dt, now, hit, playing = true, activity = 0) {
    if (!playing) { this.speed = 0; this.level = 0; this.lastHit = null; this.interval = null; return this; }
    dt = Math.max(0, Math.min(100, dt));
    if (hit) {
      if (this.lastHit !== null) {
        const gap = now - this.lastHit;
        if (gap >= 95 && gap <= 2500) this.interval = this.interval === null ? gap : this.interval * 0.55 + gap * 0.45;
        else this.interval = null;
      }
      this.lastHit = now;
      this.level = 1;
    } else this.level *= Math.exp(-dt / 520);
    const active = this.lastHit !== null && now - this.lastHit < Math.max(650, (this.interval || 500) * 1.8);
    const target = active ? Math.min(8, 1000 / (this.interval || 500)) * Math.PI * 0.65 : Math.min(1, activity) * 0.85;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / (active ? 100 : 200)));
    this.phase += this.speed * dt / 1000;
    return this;
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
    uniform float melodyTime;
    uniform sampler2D fluidDye;

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
      // Latest reference: pearl, ice blue, periwinkle, rose and deep violet.
      float x = fract(t) * 6.0;
      vec3 blue=vec3(0.075,0.10,0.80), ice=vec3(0.20,0.65,1.0);
      vec3 pearl=vec3(0.72,0.84,1.0), rose=vec3(1.0,0.24,0.59);
      vec3 pink=vec3(0.78,0.045,0.58), violet=vec3(0.33,0.075,0.85);
      if(x<1.0)return mix(blue,ice,smoothstep(0.0,1.0,x));
      if(x<2.0)return mix(ice,pearl,smoothstep(1.0,2.0,x));
      if(x<3.0)return mix(pearl,rose,smoothstep(2.0,3.0,x));
      if(x<4.0)return mix(rose,pink,smoothstep(3.0,4.0,x));
      if(x<5.0)return mix(pink,violet,smoothstep(4.0,5.0,x));
      return mix(violet,blue,smoothstep(5.0,6.0,x));
    }

    void main() {
      vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      p.y -= 0.07;
      float pulse = clamp(bass, 0.0, 1.0);
      float radius = 0.255 + pulse * 0.055;
      float a = atan(p.y, p.x);
      vec2 direction = vec2(cos(a), sin(a));
      float flow = noise(direction * 2.7 + vec2(time * 0.23, -time * 0.17));
      float fold = sin(a * 3.0 + time * 0.75 + flow * 2.2);
      float contour = radius * (1.0 + (0.004 + pulse * 0.018) * fold
        + (treble * 0.018 + energy * 0.016) * sin(a * 3.0 + melodyTime * 0.35)
        + energy * 0.008 * sin(a * 5.0 - melodyTime * 0.23)
        + 0.004 * sin(a * 2.0 - time * 0.53) + 0.002 * sin(a * 5.0 + time * 0.4));
      float distanceToEdge = abs(length(p) - contour);
      float snare = clamp(mid, 0.0, 1.0);
      float ribbon = 0.5 + 0.5 * sin(a * 2.0 - time * 0.65 + flow * 5.0);
      float thickness = 0.0015 + pow(ribbon, 2.0) * (0.003 + pulse * 0.003) + snare * 0.002;
      float edge = 1.0 - smoothstep(thickness, thickness + 0.002, distanceToEdge);
      float exterior = step(contour + thickness, length(p));
      vec3 edgeColor = palette(a / 6.2831853 + melodyTime * 0.018 + flow * 0.08);
      // Reflections follow the curved liquid surface rather than a uniform white outline.
      float plasma = noise(direction * 6.0 + vec2(time * 0.55, distanceToEdge * 90.0));
      float core = (1.0 - smoothstep(thickness * 0.12, thickness * 0.63, distanceToEdge))
                 * (0.6 + plasma * 0.7);
      float bloom = exp(-distanceToEdge * 100.0) * exterior;
      float outward = max(0.0, length(p) - contour - thickness);
      // Charging-ring reference: smooth light shafts, layered halos and focused poles.
      // Taller upper light curtains, with a softer reach at the sides.
      float upper = smoothstep(-0.1, 0.8, sin(a));
      float reach = (0.065 + snare * 0.10) * (1.0 + upper * 1.15);
      float pole = pow(abs(sin(a)), 10.0);
      float shaftField = pow(0.5 + 0.5 * sin(a * 13.0 + time * 0.20 + flow * 0.5), 28.0);
      float fineField = pow(0.5 + 0.5 * sin(a * 29.0 - time * 0.13), 64.0);
      float fade = exp(-outward / (reach * (0.32 + pole * 0.75)))
                 * (1.0 - smoothstep(reach, reach * 1.7, outward));
      float softHalo = exp(-outward * mix(48.0, 21.0, upper)) * 0.20;
      float aurora = exterior * snare * (softHalo + fade * (shaftField * 0.35 + fineField * 0.06 + pole * 0.35));
      float haloBand = exp(-abs(outward - 0.008 - 0.003 * sin(a * 3.0 - time * 0.4)) * 550.0);
      float arcLight = pow(0.5 + 0.5 * sin(a * 2.0 + time * 0.25), 8.0);
      float down = max(0.0, -p.y - contour - thickness);
      float beamWidth = 0.0012 + down * 0.013;
      float beamAxis = p.x + sin(down * 13.0 - time * 0.4) * 0.002;
      float tail = exp(-abs(beamAxis) / beamWidth) * exp(-down * 7.0)
                 * step(0.001, down) * (1.0 - smoothstep(0.32, 0.48, down)) * snare;
      vec3 color = edgeColor * (edge * (0.85 + pulse * 0.7 + snare * 0.6) + bloom * (0.4 + pulse * 0.5));
      float strand = pow(0.5 + 0.5 * sin(distanceToEdge * 360.0 + flow * 8.0 - time * 1.3), 6.0);
      color += mix(edgeColor,vec3(0.85,0.86,1.0),0.45) * core * edge * 0.65;
      vec3 auroraTint = mix(edgeColor, vec3(0.32,0.48,1.0), 0.18);
      color += auroraTint * aurora * 3.1;
      // Multiple thin concentric charging tracks, brightest at the two poles.
      float tracks = exp(-abs(outward - 0.006) * 1100.0)
                   + exp(-abs(outward - 0.013) * 1000.0) * 0.65
                   + exp(-abs(outward - 0.021) * 900.0) * 0.30;
      color += mix(auroraTint, vec3(0.75,0.92,1.0), pole * 0.85)
             * tracks * exterior * snare * (0.3 + pole * 2.2);
      color += vec3(0.3,0.48,1.0) * tail * 3.0;
      // Video reference: continuous translucent folded membranes, no stars or links.
      float melody = clamp(treble, 0.0, 1.0);
      vec2 q = p / max(contour, 0.01);
      float radial = length(q);
      float inside = 1.0 - smoothstep(0.94, 1.0, radial);
      // Soft, translucent membranes stretch from a fixed core to the sphere rim.
      // Two dominant sheets fold into one another; extra folds emerge with intensity.
      float t = melodyTime * 0.42;
      float r = length(q);
      float theta = atan(q.y,q.x);
      vec3 membranes = vec3(0.0);
      float population = 2.0 + energy * 5.0;
      for (int i = 0; i < 2; i++) {
        float index = float(i);
        float seed = hash(vec2(index + 3.7,9.2));
        float seed2 = hash(vec2(index + 18.1,4.8));
        float group = mod(index,2.0);
        float primary = 1.0 - step(1.5,index);
        float active = smoothstep(index-0.5,index+0.5,population);
        float life = mix(0.35 + 0.55 * smoothstep(-0.4,0.8,sin(t*(0.30+seed*0.2)+seed2*12.0)),1.0,primary);
        // Additional folds cluster around the two main lobes, avoiding a pinwheel.
        float baseAngle = -0.8 + t * 0.25 + group * 3.14159265
                        + (1.0-primary) * (seed-0.5) * 2.0;
        float pathAngle = baseAngle + r * (1.0+seed*0.4)
                        + sin(r*3.5-t*0.48+group*2.2) * r * 0.65;
        float delta = theta-pathAngle;
        float across = sin(delta)*r;
        float forward = smoothstep(-0.15,0.25,cos(delta));
        // The sheets widen into soft fans with a luminous fold along one side.
        float swell = 0.60 + 0.80 * pow(0.5+0.5*sin(r*3.8-t*0.38+seed2*4.0),2.0);
        float width = 0.018 + pow(r,1.25)*(0.19+seed*0.14)*swell;
        float asymmetry = mix(0.55,1.7,smoothstep(-0.03,0.05,across));
        float sheet = exp(-pow(across/(width*asymmetry),2.0))*forward;
        float veil = exp(-pow(across/(width*2.5),2.0))*forward*0.18;
        float crease = exp(-pow((across+width*0.24)/(width*0.33),2.0))*forward;
        float transport = 0.85+0.15*sin(r*5.0+sin(t*0.3+seed)*3.0);
        vec3 cold = mix(vec3(0.10,0.25,1.0),vec3(0.33,0.79,1.0),smoothstep(0.0,1.0,r));
        vec3 warm = mix(vec3(0.92,0.055,0.58),vec3(1.0,0.38,0.69),smoothstep(0.0,1.0,r));
        float tintMix = 0.5+0.5*sin(group*2.4+r*2.5+t*0.18+seed*0.45);
        vec3 tint = mix(cold,warm,tintMix);
        vec3 silk = tint*(sheet*0.95+veil)
                  + mix(tint,vec3(0.80,0.87,1.0),0.64)*crease*0.42;
        float strength = mix(0.38,1.0,primary);
        membranes += silk*active*life*transport*strength;
      }
      // White bloom where membranes converge, with black negative space elsewhere.
      float rim = exp(-abs(r-0.975)*80.0);
      vec3 rimTint = palette(theta/6.2831853+t*0.04+0.12);
      vec3 interior = membranes * (1.0 + smoothstep(0.86,1.0,r)*0.35) + rimTint*rim*0.28;
      float centerMask = smoothstep(0.004,0.025,r);
      vec3 transported = texture2D(fluidDye,q*0.5+0.5).rgb;
      // Persistent dye is carried between frames; the analytic sheet is only a faint source.
      vec3 fluidLight = transported * 2.2;
      float fusion = min(transported.r,transported.b);
      fluidLight += vec3(0.70,0.85,1.0)*pow(fusion,1.6)*0.45;
      color += (interior*melody*0.18 + fluidLight) * inside * centerMask;
      color += edgeColor * exp(-distanceToEdge*55.0) * exterior * (0.06+melody*0.09);
      float nucleus = exp(-r*80.0);
      float nucleusHalo = exp(-r*18.0);
      color += vec3(1.0,0.86,0.97)*nucleus*(1.5+energy*1.8);
      color += vec3(0.63,0.55,1.0)*nucleusHalo*(0.07+melody*0.32);
      color = vec3(1.0) - exp(-color * 1.35);
      gl_FragColor = vec4(color,1.0);
    }
  `;

  // Low-resolution, persistent dye transport. RGBA8 works on mobile WebGL 1
  // without float-texture extensions; the final lighting stays at display resolution.
  const transportSource = `
    precision highp float;
    varying vec2 uv;
    uniform sampler2D previousDye;
    uniform float dt, flowTime, phase, intensity, sourceLevel;
    uniform vec2 texel;
    vec2 velocity(vec2 p) {
      float wall = max(0.0,1.0-dot(p,p));
      vec2 gradient = vec2(0.0);
      // Curl of a streamfunction: divergence-free vortices tangent to the sphere wall.
      for(int i=0;i<4;i++) {
        float index=float(i), angle=index*1.5707963+flowTime*0.17;
        vec2 center=vec2(cos(angle),sin(angle))*(0.28+0.14*sin(flowTime*0.23+index));
        vec2 delta=p-center;
        float size=0.22+0.05*sin(flowTime*0.21+index*1.7);
        float g=exp(-dot(delta,delta)/size);
        float strength=mix(-0.30,0.38,mod(index,2.0));
        gradient+=strength*g*(-4.0*p*wall-wall*wall*2.0*delta/size);
      }
      vec2 curl=vec2(gradient.y,-gradient.x);
      return curl+vec2(-p.y,p.x)*wall*(0.12+0.08*sin(flowTime*0.31));
    }
    void main() {
      vec2 p=(uv-0.5)*2.0;
      float r=length(p);
      if(r>1.0) {gl_FragColor=vec4(0.0);return;}
      // Midpoint backtrace reduces trajectory error on curved paths.
      vec2 v=velocity(p);
      vec2 back=p-velocity(p-v*dt*0.5)*dt;
      vec2 sampleUv=back*0.5+0.5;
      vec3 dye=texture2D(previousDye,sampleUv).rgb;
      vec3 neighbors=(texture2D(previousDye,sampleUv+vec2(texel.x,0.0)).rgb
                     +texture2D(previousDye,sampleUv-vec2(texel.x,0.0)).rgb
                     +texture2D(previousDye,sampleUv+vec2(0.0,texel.y)).rgb
                     +texture2D(previousDye,sampleUv-vec2(0.0,texel.y)).rgb)*0.25;
      dye=mix(dye,neighbors,1.0-exp(-dt*1.2))*exp(-dt*0.50);
      vec3 source=vec3(0.0);
      float theta=atan(p.y,p.x);
      for(int i=0;i<7;i++) {
        float index=float(i),group=mod(index,2.0);
        float primary=1.0-step(1.5,index);
        float active=smoothstep(index-0.5,index+0.5,2.0+intensity*5.0);
        float spread=(1.0-primary)*sin(index*7.3)*0.8;
        float angle=-0.8+phase*0.10+group*3.14159265+spread
                   +r*1.1+sin(r*3.2-phase*0.18+group*2.2)*r*0.6;
        float delta=theta-angle;
        float across=sin(delta)*r;
        float width=0.018+pow(r,1.2)*(0.16+0.10*sin(r*3.0-phase*0.12+index)*sin(r*3.0-phase*0.12+index));
        width*=mix(0.65,1.65,smoothstep(-0.03,0.05,across));
        float sheet=exp(-pow(across/width,2.0))*smoothstep(-0.1,0.3,cos(delta));
        float tint=0.5+0.5*sin(group*2.4+r*2.0+phase*0.08+index*0.2);
        vec3 color=mix(vec3(0.13,0.45,1.0),vec3(1.0,0.13,0.63),tint);
        float ridge=exp(-pow((across+width*0.22)/(width*0.30),2.0))*smoothstep(-0.1,0.3,cos(delta));
        vec3 pigment=color*sheet*0.82+mix(color,vec3(0.80,0.87,1.0),0.55)*ridge*0.38;
        source+=pigment*active*mix(0.24,1.0,primary);
      }
      source*=sourceLevel*(0.40+intensity*0.60)*(1.0-smoothstep(0.94,1.0,r));
      float emission=1.0-exp(-dt*1.8);
      dye=mix(dye,clamp(source,0.0,1.0),emission);
      gl_FragColor=vec4(dye,1.0);
    }
  `;
  let transportProgram = null, transportLocations = null;
  let dyeTargets = [], dyeIndex = 0, flowTime = 0, fluidSteps = 0, fluidLast = 0;
  const dyeSize = 192;

  function bindQuad(targetProgram) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const attribute=gl.getAttribLocation(targetProgram,'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  }

  function buildTransport() {
    const vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,transportSource);
    transportProgram=gl.createProgram();gl.attachShader(transportProgram,vs);gl.attachShader(transportProgram,fs);gl.linkProgram(transportProgram);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(transportProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(transportProgram));
    transportLocations={};
    for(const name of ['previousDye','dt','flowTime','phase','intensity','sourceLevel','texel'])transportLocations[name]=gl.getUniformLocation(transportProgram,name);
    dyeTargets=[];
    for(let i=0;i<2;i++) {
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,dyeSize,dyeSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Fluid framebuffer unavailable');
      gl.clear(gl.COLOR_BUFFER_BIT);dyeTargets.push({texture,framebuffer});
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);dyeIndex=0;flowTime=0;fluidSteps=0;fluidLast=0;
  }

  function resetTransport() {
    if(!ready||contextLost)return;
    for(const target of dyeTargets){gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.clear(gl.COLOR_BUFFER_BIT);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);flowTime=0;fluidSteps=0;fluidLast=0;
  }

  function transportFluid(signal, now) {
    const elapsed=fluidLast?Math.max(0,Math.min(0.05,(now-fluidLast)/1000)):1/60;
    fluidLast=now;
    if(!audio.paused) {
      // Keep inertia through the spaces between melodic onsets.
      const rate=0.35+Math.min(8,melodyMotion.speed)*0.16;
      const dt=elapsed*rate;
      flowTime+=dt;
      gl.useProgram(transportProgram);bindQuad(transportProgram);
      const target=1-dyeIndex;
      gl.bindFramebuffer(gl.FRAMEBUFFER,dyeTargets[target].framebuffer);gl.viewport(0,0,dyeSize,dyeSize);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,dyeTargets[dyeIndex].texture);
      gl.uniform1i(transportLocations.previousDye,0);gl.uniform1f(transportLocations.dt,dt);
      gl.uniform1f(transportLocations.flowTime,flowTime);gl.uniform1f(transportLocations.phase,signal.motion);
      gl.uniform1f(transportLocations.intensity,signal.intensity);
      gl.uniform1f(transportLocations.sourceLevel,Math.max(signal.melody,Math.min(1,signal.intensity*1.7)));
      gl.uniform2f(transportLocations.texel,1/dyeSize,1/dyeSize);gl.drawArrays(gl.TRIANGLES,0,6);
      dyeIndex=target;fluidSteps++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    window.sinestesiaFluidTransport={steps:fluidSteps,time:flowTime,resolution:dyeSize};
  }

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
      melodyTime: gl.getUniformLocation(program, 'melodyTime'),
      fluidDye: gl.getUniformLocation(program, 'fluidDye'),
    };

    gl.clearColor(0, 0, 0, 1);
    buildTransport();
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
    return (window.sinestesiaStemRouter?.active('plasma') ?? selector.value === 'plasma') && ready && !contextLost;
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
  let intensitySamples = null;
  let musicIntensity = 0;
  const kickDetector = new KickOnsetDetector();
  const snareDetector = new SnareOnsetDetector();
  const melodyDetector = new MelodyOnsetDetector();
  const tempo = new BeatTempoEstimator();
  const melodyMotion = new MelodyFlowMotion();
  let melodySeed = 0;
  let melodyPulse = 0;
  let snarePulse = 0;
  let lastPulseFrame = 0;
  let pulse = 0;

  function resetKick(event) {
    const heldPhase = event?.type === 'pause' ? melodyMotion.phase : 0;
    kickDetector.reset();
    snareDetector.reset();
    melodyDetector.reset();
    tempo.reset();
    melodyMotion.reset();
    melodyMotion.phase = heldPhase;
    if(event?.type !== 'pause')resetTransport();
    lastPulseFrame = 0;
    musicIntensity = 0;
    melodyPulse = 0;
    snarePulse = 0;
    pulse = 0;
  }
  window.addEventListener('sinestesia-detection-change', resetKick);
  audio.addEventListener('seeking', resetKick);
  audio.addEventListener('emptied', resetKick);
  audio.addEventListener('pause', resetKick);

  function readKickPulse() {
    const routed=window.sinestesiaStemRouter?.signal('plasma');
    if(routed) {
      window.sinestesiaKickReadout={pulse:routed.kick,snare:routed.snare,melody:routed.melody,intensity:routed.energy,bpm:0,hz:0,level:routed.energy};
      return routed;
    }
    const now = performance.now();
    const dt = Math.min(100, lastPulseFrame ? now - lastPulseFrame : 24);
    lastPulseFrame = now;
    pulse *= Math.exp(-dt / 150);
    snarePulse *= Math.exp(-dt / 95);
    melodyPulse *= Math.exp(-dt / 220);
    let tonalHit = 0;
    if (!audio.paused && source && audioContext) {
      if (!kickAnalyser) {
        // Independent, unsmoothed FFT: visual smoothing must not hide kick attacks.
        kickAnalyser = audioContext.createAnalyser();
        kickAnalyser.fftSize = 4096;
        kickAnalyser.smoothingTimeConstant = 0;
        source.connect(kickAnalyser);
        kickSpectrum = new Float32Array(kickAnalyser.frequencyBinCount);
        intensitySamples = new Float32Array(kickAnalyser.fftSize);
      }
      kickAnalyser.getFloatFrequencyData(kickSpectrum);
      kickAnalyser.getFloatTimeDomainData(intensitySamples);
      let squareSum = 0;
      for (const sample of intensitySamples) squareSum += sample * sample;
      const targetIntensity = Math.min(1, Math.sqrt(squareSum / intensitySamples.length) * 5);
      // Smooth gain changes so sheets emerge and fade rather than flashing on beats.
      musicIntensity += (targetIntensity - musicIntensity) * (1 - Math.exp(-dt / (targetIntensity > musicIntensity ? 110 : 420)));
      if (window.sinestesiaSpectrumFrame) window.sinestesiaSpectrumFrame(kickSpectrum, audioContext.sampleRate, now);
      const hit = kickDetector.update(kickSpectrum, audioContext.sampleRate, now, window.sinestesiaDetectionSettings);
      if (hit) { pulse = Math.max(pulse, hit); tempo.add(audio.currentTime * 1000); }
      const snareHit = snareDetector.update(kickSpectrum, audioContext.sampleRate, now, window.sinestesiaDetectionSettings);
      if (snareHit) snarePulse = Math.max(snarePulse, snareHit);
      const melodyHit = melodyDetector.update(kickSpectrum, audioContext.sampleRate, now, window.sinestesiaDetectionSettings);
      tonalHit = melodyHit;
      if (melodyHit) { melodyPulse = 1; melodySeed += 1.618; }
    }
    if (audio.paused) musicIntensity = 0;
    melodyMotion.update(dt, now, tonalHit, !audio.paused, musicIntensity);
    window.sinestesiaKickReadout = { intensity: musicIntensity, plasmaCount: 2 + musicIntensity * 5, melodySpeed: melodyMotion.speed, melodyPhase: melodyMotion.phase, pulse, snare: snarePulse, melody: melodyPulse, melodyHz: melodyPulse > 0.05 ? melodyDetector.peakHz : 0, hz: pulse > 0.05 ? kickDetector.peakHz : 0, bpm: tempo.bpm, level: audio.paused ? 0 : Math.min(1, Math.sqrt(kickDetector.previous)) };
    const gain = Number(document.getElementById('fluidIntensity').value) || 1.35;
    return { kick: Math.min(1, pulse * gain / 1.35), snare: Math.min(1, snarePulse * gain / 1.35), melody: Math.min(1, melodyMotion.level * gain / 1.35), intensity: musicIntensity, motion: melodyMotion.phase, note: melodySeed + Math.min(1, melodyDetector.peakHz / 8000) };
  }

  let visualKick = 0, visualSnare = 0, visualMelody = 0, visualLast = 0;
  function fluidSignal() {
    const signal = readKickPulse(), now = performance.now();
    const dt = visualLast ? Math.min(100, now - visualLast) : 16;
    visualLast = now;
    visualKick += (signal.kick - visualKick) * (1 - Math.exp(-dt / 32));
    visualSnare += (signal.snare - visualSnare) * (1 - Math.exp(-dt / 22));
    visualMelody += (signal.melody - visualMelody) * (1 - Math.exp(-dt / (signal.melody > visualMelody ? 75 : 320)));
    return { ...signal, kick: visualKick, snare: visualSnare, melody: visualMelody };
  }

  function drawKickFallback(width, height) {
    const signal = fluidSignal();
    const level = signal.kick;
    const radius = height * (0.255 + level * 0.055);
    const gradient = ctx.createConicGradient(contourClock * 0.025, width / 2, height * 0.43);
    ['#2638cf', '#52bcff', '#c4d6ff', '#ff64af', '#d929b0', '#7135da', '#2638cf'].forEach((color, i) => gradient.addColorStop(i / 6, color));
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
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        const reach = height * signal.snare * (0.05 + 0.09 * (0.5 + 0.5 * Math.sin(i * 13.7 + contourClock * 12))) * (1 + Math.max(0, -Math.sin(a)));
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
      const body = ctx.createRadialGradient(width / 2 - radius * 0.3, height * 0.43 - radius * 0.4, 0, width / 2, height * 0.43, radius);
      body.addColorStop(0, '#100718'); body.addColorStop(0.6, '#030108'); body.addColorStop(1, '#000000');
      ctx.fillStyle = body; ctx.fillRect(width / 2 - radius, height * 0.43 - radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = 'lighter';
      const population = 2 + signal.intensity * 5;
      for (let band = 0; band < 7; band++) {
        const active = clamp(population - band + 0.5);
        if (active === 0) continue;
        ctx.globalAlpha = signal.melody * active * (0.55 + 0.45 * Math.sin(signal.motion * 0.17 + band * 2.71) ** 2);
        const phase = (band % 2) * Math.PI + Math.sin(signal.motion * 0.11 + band) * 0.3 + (band < 2 ? 0 : Math.sin(band * 7.3) * 0.8);
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const r = i / 100;
          const angle = phase + signal.motion * 0.55 - r * 2.1
            - Math.sin(r * 3.4 - signal.motion * 0.42) * 0.55;
          const px = width / 2 + Math.cos(angle) * radius * r;
          const py = height * 0.43 + Math.sin(angle) * radius * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        const streamGradient = ctx.createLinearGradient(width / 2 - radius, height * 0.43, width / 2 + radius, height * 0.43);
        const colors = ['#2638cf', '#52bcff', '#c4d6ff', '#ff64af', '#d929b0', '#7135da', '#2638cf'];
        colors.forEach((color, i) => streamGradient.addColorStop(i / 6, colors[(i + band) % colors.length]));
        ctx.strokeStyle = streamGradient;
        ctx.shadowColor = ['#73bcff','#ff76c6','#8e66ff'][band % 3]; ctx.shadowBlur = radius * 0.14;
        ctx.lineWidth = radius * (0.13 + signal.melody * 0.13); ctx.stroke();
        ctx.strokeStyle = '#d3e7ef'; ctx.lineWidth *= 0.16; ctx.stroke();
      }
      ctx.restore();
    }
    // The shared central energy point remains visible even between melodic attacks.
    ctx.globalAlpha = 1;
    const coreGlow = ctx.createRadialGradient(width / 2, height * 0.43, 0, width / 2, height * 0.43, radius * 0.10);
    coreGlow.addColorStop(0, '#fff2ff'); coreGlow.addColorStop(0.14, '#ccd9ff');
    coreGlow.addColorStop(0.4, 'rgba(125,140,255,0.25)'); coreGlow.addColorStop(1, 'rgba(125,140,255,0)');
    ctx.fillStyle = coreGlow; ctx.fillRect(width / 2 - radius * 0.1, height * 0.43 - radius * 0.1, radius * 0.2, radius * 0.2);
    ctx.restore();
  }

  let quality = 1;
  let slowFrames = 0;
  let fastFrames = 0;
  let lastFrameAt = 0;

  drawAurora = function drawPlasmaWebGL(width, height) {
    if(window.sinestesiaAnalysisMode==='separation') {
      if(!isActive())return;
      const rect=surface.getBoundingClientRect();width=rect.width;height=rect.height;
    }
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
      quality = Math.max(0.62, quality - 0.08);
      slowFrames = 0;
    } else if (fastFrames > 180) {
      quality = Math.min(1, quality + 0.04);
      fastFrames = 0;
    }

    const maxPixels = 550000;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      1.6,
      Math.sqrt(maxPixels / Math.max(1, width * height)),
    ) * quality;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (surface.width !== w || surface.height !== h) {
      surface.width = w;
      surface.height = h;
    }

    const percussion = fluidSignal();
    const signal = { bass: percussion.kick, mid: percussion.snare, treble: percussion.melody, energy: percussion.intensity };
    transportFluid(percussion,now);
    surface.style.filter = baseCanvas.style.filter;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    bindQuad(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,dyeTargets[dyeIndex].texture);
    gl.uniform1i(locations.fluidDye,0);
    gl.uniform2f(locations.resolution, w, h);
    gl.uniform1f(locations.time, contourClock * getColorSpeed() * 0.5);
    gl.uniform1f(locations.bass, signal.bass);
    gl.uniform1f(locations.mid, signal.mid);
    gl.uniform1f(locations.treble, signal.treble);
    gl.uniform1f(locations.energy, signal.energy);
    gl.uniform1f(locations.melodyTime, percussion.motion);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  syncVisibility();
})();
