// Smoothed frequency-mapped plasma ring for Sinestesia.
// Reactive by region: bass = lower arc, mids = sides, highs = upper arc.
// Includes a constantly rotating multicolor plasma-LED ring inside the white core.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureLowLatencyAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  if (analyser.fftSize !== 1024) {
    analyser.fftSize = 1024;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }

  // More smoothing than before to reduce shimmer/flicker while keeping transients responsive.
  analyser.smoothingTimeConstant = 0.09;
  return ok;
};

paletteForFamily = function paletteForFamilyPlasmaRing() {
  return { h1: 205, h2: 248, h3: 286 };
};

function followValue(current, target, attack, release) {
  return current + (target - current) * (target > current ? attack : release);
}

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.68;
    smoothBass *= 0.78;
    smoothMid *= 0.78;
    smoothTreble *= 0.78;
    return {
      bass: smoothBass,
      mid: smoothMid,
      treble: smoothTreble,
      energy: fastReactiveEnergy,
    };
  }

  const bassNow = averageRange(35, 180);
  const midNow = averageRange(180, 2500);
  const trebleNow = averageRange(2500, 12000);
  const rms = rmsLevel();

  smoothBass = followValue(smoothBass, bassNow, 0.44, 0.12);
  smoothMid = followValue(smoothMid, midNow, 0.38, 0.11);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.41, 0.12);

  const target = clamp(
    rms * 1.82 +
    smoothBass * 0.72 +
    smoothMid * 0.27 +
    smoothTreble * 0.15
  );

  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.50, 0.14);

  return {
    bass: smoothBass,
    mid: smoothMid,
    treble: smoothTreble,
    energy: fastReactiveEnergy,
  };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function sectorSignals(angle, bass, mid, treble) {
  // Canvas angles: 0 = right, PI/2 = bottom, PI = left, 3PI/2 = top.
  const bassWeight = periodicPulse(angle, Math.PI * 0.5, 1.02);
  const midWeight = Math.min(
    1,
    periodicPulse(angle, 0, 0.90) + periodicPulse(angle, Math.PI, 0.90)
  );
  const trebleWeight = periodicPulse(angle, Math.PI * 1.5, 0.90);

  return {
    bass: bass * bassWeight,
    mid: mid * midWeight,
    treble: treble * trebleWeight,
  };
}

function localEnergy(angle, bass, mid, treble, energy) {
  const s = sectorSignals(angle, bass, mid, treble);
  return clamp(
    s.bass * 0.98 +
    s.mid * 0.90 +
    s.treble * 0.96 +
    energy * 0.12
  );
}

function flameColor(angle, bass, mid, treble) {
  const s = sectorSignals(angle, bass, mid, treble);
  const bassBias = clamp(s.bass);
  const midBias = clamp(s.mid);
  const highBias = clamp(s.treble);

  const r = Math.round(130 + bassBias * 78 + midBias * 24);
  const g = Math.round(64 + midBias * 38 + highBias * 66);
  return { r, g, b: 255 };
}

function drawLocalVioletAura(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const segments = 144;
  const step = TAU / segments;

  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const color = flameColor(angle, bass, mid, treble);
    const over = clamp((local - 0.60) / 0.40);

    const radius = baseRadius * (1.034 + local * 0.006);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.034 + local * 0.145})`;
    ctx.lineWidth = 9 + local * 8 + over * 3;
    ctx.shadowBlur = 25 + local * 34 + over * 16;
    ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.30 + local * 0.48})`;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.57, angle + step * 0.57);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Dense, broad wisps overlap so the violet flame reads as a soft gradient, not spokes.
  const count = 58;

  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    const angle = p * TAU;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const color = flameColor(angle, bass, mid, treble);

    const phase = plasmaPhase * (0.62 + (i % 5) * 0.025) + i * 1.31;
    const irregular = 0.90 + Math.sin(phase * 0.58) * 0.10;
    const over = clamp((local - 0.58) / 0.42);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;

    const startR = baseRadius * (1.022 + Math.sin(phase * 0.38) * 0.0018);
    const length = baseRadius * (
      0.040 +
      local * 0.125 +
      over * 0.052
    ) * irregular;
    const bend = Math.sin(phase * 0.72) * baseRadius * (0.004 + local * 0.010);

    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    const alpha = 0.044 + local * 0.120;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(222, 176, 255, ${alpha * 0.58})`);
    grad.addColorStop(0.16, `rgba(${Math.min(255, color.r + 24)}, ${Math.min(255, color.g + 18)}, 255, ${alpha})`);
    grad.addColorStop(0.45, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.88})`);
    grad.addColorStop(0.72, `rgba(127, 54, 255, ${alpha * 0.48})`);
    grad.addColorStop(0.90, `rgba(96, 39, 255, ${alpha * 0.18})`);
    grad.addColorStop(1, 'rgba(83, 31, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.038 + local * 0.026);
    ctx.shadowBlur = baseRadius * (0.078 + local * 0.090 + over * 0.025);
    ctx.shadowColor = `rgba(${color.r}, ${color.g}, 255, ${0.38 + local * 0.48})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.28 + tx * bend,
      y0 + ny * length * 0.28 + ty * bend,
      x0 + nx * length * 0.69 - tx * bend * 0.38,
      y0 + ny * length * 0.69 - ty * bend * 0.38,
      x1,
      y1,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawReactiveRing(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const segments = 160;
  const step = TAU / segments;

  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const s = sectorSignals(angle, bass, mid, treble);

    const high = clamp(s.treble);
    const mids = clamp(s.mid);
    const low = clamp(s.bass);

    const r = Math.round(106 + low * 95 + mids * 30);
    const g = Math.round(138 + high * 88 + mids * 25);
    const b = 255;

    const wobble = Math.sin(angle * 7 + plasmaPhase * 1.1) * 0.0012;
    const radius = baseRadius * (1.008 + wobble + local * 0.0022);

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.34 + local * 0.50})`;
    ctx.lineWidth = 1.6 + local * 2.0;
    ctx.shadowBlur = 9 + local * 17;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.48 + local * 0.44})`;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.59, angle + step * 0.59);
    ctx.stroke();
  }

  ctx.restore();
}

const plasmaLedPalette = [
  [255, 122, 24],   // orange
  [255, 242, 164],  // warm white / yellow-white
  [255, 220, 54],   // yellow
  [187, 72, 255],   // grape/violet
  [58, 232, 132],   // plasma green
  [74, 202, 255],   // cyan-blue bridge
  [244, 248, 255],  // white
];

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function ledColorAt(position) {
  const n = plasmaLedPalette.length;
  const wrapped = ((position % n) + n) % n;
  const i = Math.floor(wrapped);
  const t = wrapped - i;
  return mixColor(plasmaLedPalette[i], plasmaLedPalette[(i + 1) % n], t);
}

function drawInnerPlasmaLed(cx, cy, baseRadius, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const segments = 196;
  const step = TAU / segments;
  const rotation = plasmaPhase * 0.46;
  const pulse = 0.5 + 0.5 * Math.sin(plasmaPhase * 1.2);
  const radius = baseRadius * 0.970;

  // Soft under-glow makes the color band continuous rather than dotted.
  ctx.strokeStyle = `rgba(129, 96, 255, ${0.12 + energy * 0.10})`;
  ctx.lineWidth = 3.6 + energy * 0.7;
  ctx.shadowBlur = 11 + energy * 7;
  ctx.shadowColor = `rgba(113, 87, 255, ${0.60 + energy * 0.25})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.stroke();

  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const palettePos = (i / segments) * plasmaLedPalette.length + rotation;
    const c = ledColorAt(palettePos);
    const shimmer = 0.92 + 0.08 * Math.sin(angle * 3 - plasmaPhase * 0.7 + pulse);
    const alpha = (0.70 + energy * 0.22) * shimmer;

    ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
    ctx.lineWidth = 1.55 + energy * 0.55;
    ctx.shadowBlur = 5.5 + energy * 5.5;
    ctx.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.68 + energy * 0.22})`;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.60, angle + step * 0.60);
    ctx.stroke();
  }

  ctx.restore();
}

drawBackground = function drawPlasmaRingBackground(width, height) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.43,
    0,
    width * 0.5,
    height * 0.43,
    Math.max(width, height) * 0.58,
  );
  glow.addColorStop(0, 'rgba(18, 7, 52, 0.12)');
  glow.addColorStop(0.50, 'rgba(8, 4, 28, 0.065)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
};

drawAurora = function drawPlasmaRing(width, height) {
  const fast = fastBeatSignal();
  const bass = fast.bass;
  const mid = fast.mid;
  const treble = fast.treble;
  const energy = fast.energy;

  // Slower phase motion removes the nervous flicker/celajeo.
  plasmaPhase += 0.0024 + energy * 0.0055;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.273 + bass * 0.005 + energy * 0.0025);

  const bloom = Math.pow(clamp(energy), 1.10);
  const overdrive = Math.pow(clamp((energy - 0.62) / 0.38), 1.15);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Stronger than the previous build, but still smooth and gradient-based.
  const haloOuter = baseRadius * (1.45 + bloom * 0.08 + overdrive * 0.09);
  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.90,
    cx, cy, haloOuter,
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.40, `rgba(42, 111, 255, ${0.025 + bloom * 0.050})`);
  halo.addColorStop(0.60, `rgba(94, 57, 255, ${0.050 + bloom * 0.085})`);
  halo.addColorStop(0.78, `rgba(168, 48, 255, ${0.048 + bloom * 0.090})`);
  halo.addColorStop(0.93, `rgba(220, 66, 255, ${0.014 + overdrive * 0.038})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloOuter, 0, TAU);
  ctx.fill();

  ctx.restore();

  drawLocalVioletAura(cx, cy, baseRadius, bass, mid, treble, energy);
  drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy);
  drawReactiveRing(cx, cy, baseRadius, bass, mid, treble, energy);

  // White/cyan core ring.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(236, 249, 255, ${0.74 + bloom * 0.20})`;
  ctx.lineWidth = 1.10 + bloom * 0.62;
  ctx.shadowBlur = 8 + bloom * 10 + overdrive * 3;
  ctx.shadowColor = `rgba(101, 215, 255, ${0.78 + bloom * 0.20})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.997, 0, TAU);
  ctx.stroke();

  // Soft magenta-violet secondary rim.
  ctx.strokeStyle = `rgba(235, 153, 255, ${0.18 + bloom * 0.19})`;
  ctx.lineWidth = 0.95 + bloom * 0.38;
  ctx.shadowBlur = 12 + bloom * 11 + overdrive * 4;
  ctx.shadowColor = `rgba(204, 72, 255, ${0.40 + bloom * 0.32})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.015, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // Clean center while preserving room for the inner color ring.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.944, 0, TAU);
  ctx.fill();

  const innerGlow = ctx.createRadialGradient(
    cx,
    cy,
    baseRadius * 0.84,
    cx,
    cy,
    baseRadius * 0.974,
  );
  innerGlow.addColorStop(0, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(0.78, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(1, `rgba(20, 94, 170, ${0.060 + mid * 0.040})`);
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.974, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Constantly moving plasma-gamer LED layer, inside the white ring.
  drawInnerPlasmaLed(cx, cy, baseRadius, energy);
};

// The plasma skin owns the whole drawing. Keep old accent layers disabled.
drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
