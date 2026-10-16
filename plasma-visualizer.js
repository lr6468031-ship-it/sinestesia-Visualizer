// Fast reactive plasma ring for Sinestesia.
// Low-latency frequency response + time-driven multicolor plasma rings.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureFastAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  // Smaller window + almost no analyser smoothing keeps the visuals close to the beat.
  if (analyser.fftSize !== 1024) {
    analyser.fftSize = 1024;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.018;
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
    fastReactiveEnergy *= 0.56;
    smoothBass *= 0.62;
    smoothMid *= 0.62;
    smoothTreble *= 0.62;
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy };
  }

  const bassNow = averageRange(32, 190);
  const midNow = averageRange(190, 2800);
  const trebleNow = averageRange(2800, 12500);
  const rms = rmsLevel();

  // Fast attack fixes the delayed/laggy feeling. Release is slower so it does not flicker.
  smoothBass = followValue(smoothBass, bassNow, 0.88, 0.23);
  smoothMid = followValue(smoothMid, midNow, 0.82, 0.20);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.86, 0.21);

  const target = clamp(
    rms * 1.95 +
    smoothBass * 0.78 +
    smoothMid * 0.26 +
    smoothTreble * 0.15
  );
  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.90, 0.18);

  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function sectorSignals(angle, bass, mid, treble) {
  // 0 = right, PI/2 = bottom, PI = left, 3PI/2 = top.
  const bassWeight = periodicPulse(angle, Math.PI * 0.5, 1.02);
  const midWeight = Math.min(1,
    periodicPulse(angle, 0, 0.92) + periodicPulse(angle, Math.PI, 0.92)
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
  return clamp(s.bass * 1.03 + s.mid * 0.92 + s.treble * 1.00 + energy * 0.10);
}

const plasmaPalette = [
  [255, 118, 26],   // orange
  [255, 247, 222],  // white
  [255, 220, 55],   // yellow
  [189, 72, 255],   // grape / violet
  [76, 232, 132],   // plasma green
  [69, 205, 255],   // cyan
  [120, 82, 255],   // blue-violet bridge
];

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function plasmaColorAt(position) {
  const n = plasmaPalette.length;
  const wrapped = ((position % n) + n) % n;
  const i = Math.floor(wrapped);
  return mixColor(plasmaPalette[i], plasmaPalette[(i + 1) % n], wrapped - i);
}

function timeColor(angle, timeSeconds, speed = 0.42, offset = 0) {
  const around = (angle / TAU) * plasmaPalette.length;
  return plasmaColorAt(around + timeSeconds * speed + offset);
}

function drawGlobalHalo(cx, cy, baseRadius, energy) {
  const bloom = Math.pow(clamp(energy), 0.95);
  const over = clamp((energy - 0.62) / 0.38);
  const outer = baseRadius * (1.45 + bloom * 0.10 + over * 0.08);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.90, cx, cy, outer);
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.36, `rgba(57, 127, 255, ${0.026 + bloom * 0.055})`);
  halo.addColorStop(0.58, `rgba(110, 62, 255, ${0.055 + bloom * 0.095})`);
  halo.addColorStop(0.77, `rgba(190, 58, 255, ${0.052 + bloom * 0.105})`);
  halo.addColorStop(0.92, `rgba(234, 96, 255, ${0.015 + over * 0.045})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawReactiveAura(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Fewer segments than before = noticeably smoother on phones.
  const segments = 64;
  const step = TAU / segments;

  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const c = timeColor(angle, timeSeconds, 0.16, 2.35);
    const over = clamp((local - 0.58) / 0.42);
    const radius = baseRadius * (1.028 + local * 0.006);

    ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.045 + local * 0.155})`;
    ctx.lineWidth = 9.5 + local * 8.5 + over * 2.5;
    ctx.shadowBlur = 22 + local * 28;
    ctx.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.28 + local * 0.48})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.62, angle + step * 0.62);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const count = 30;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const c = timeColor(angle, timeSeconds, 0.18, 3.1);

    const phase = timeSeconds * (1.1 + (i % 4) * 0.06) + i * 1.37;
    const irregular = 0.88 + Math.sin(phase * 0.72) * 0.12;
    const over = clamp((local - 0.56) / 0.44);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;
    const startR = baseRadius * (1.022 + Math.sin(phase * 0.34) * 0.0015);
    const length = baseRadius * (0.055 + local * 0.125 + over * 0.045) * irregular;
    const bend = Math.sin(phase * 0.65) * baseRadius * (0.004 + local * 0.008);

    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    const alpha = 0.065 + local * 0.13;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(245, 228, 255, ${alpha * 0.52})`);
    grad.addColorStop(0.16, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`);
    grad.addColorStop(0.46, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha * 0.86})`);
    grad.addColorStop(0.74, `rgba(132, 58, 255, ${alpha * 0.42})`);
    grad.addColorStop(0.91, `rgba(95, 39, 255, ${alpha * 0.14})`);
    grad.addColorStop(1, 'rgba(75, 28, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.032 + local * 0.023);
    ctx.shadowBlur = baseRadius * (0.060 + local * 0.070);
    ctx.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.34 + local * 0.42})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.28 + tx * bend,
      y0 + ny * length * 0.28 + ty * bend,
      x0 + nx * length * 0.68 - tx * bend * 0.35,
      y0 + ny * length * 0.68 - ty * bend * 0.35,
      x1,
      y1,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawReactiveEdge(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const segments = 72;
  const step = TAU / segments;
  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const c = timeColor(angle, timeSeconds, 0.12, 4.0);
    const radius = baseRadius * (1.012 + local * 0.0027);

    ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.38 + local * 0.48})`;
    ctx.lineWidth = 1.7 + local * 2.2;
    ctx.shadowBlur = 8 + local * 15;
    ctx.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.48 + local * 0.40})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.61, angle + step * 0.61);
    ctx.stroke();
  }
  ctx.restore();
}

function drawInnerPlasmaRings(cx, cy, baseRadius, energy, timeSeconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Two clearly visible rings INSIDE the white ring.
  const rings = [
    { radius: 0.962, width: 2.25, blur: 7.5, alpha: 0.86, speed: 0.54, offset: 0.0 },
    { radius: 0.932, width: 1.45, blur: 5.0, alpha: 0.66, speed: -0.34, offset: 2.6 },
  ];
  const segments = 64;
  const step = TAU / segments;

  for (const ring of rings) {
    for (let i = 0; i < segments; i += 1) {
      const angle = i * step;
      const c = timeColor(angle, timeSeconds, ring.speed, ring.offset);
      const pulse = 0.94 + 0.06 * Math.sin(timeSeconds * 2.0 + angle * 2.2 + ring.offset);
      const alpha = ring.alpha * pulse * (0.90 + energy * 0.10);

      ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
      ctx.lineWidth = ring.width + energy * 0.35;
      ctx.shadowBlur = ring.blur + energy * 3.0;
      ctx.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.72 + energy * 0.20})`;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * ring.radius, angle - step * 0.64, angle + step * 0.64);
      ctx.stroke();
    }
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
    Math.max(width, height) * 0.56,
  );
  glow.addColorStop(0, 'rgba(20, 8, 54, 0.12)');
  glow.addColorStop(0.50, 'rgba(8, 4, 28, 0.06)');
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
  const timeSeconds = performance.now() * 0.001;

  // Phase is time-led, not accumulated from audio, so motion stays smooth at any FPS.
  plasmaPhase = timeSeconds;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.273 + bass * 0.0045 + energy * 0.0025);
  const bloom = Math.pow(clamp(energy), 1.02);
  const overdrive = clamp((energy - 0.64) / 0.36);

  drawGlobalHalo(cx, cy, baseRadius, energy);
  drawReactiveAura(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds);
  drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds);
  drawReactiveEdge(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds);

  // Clean black center first, leaving a wider band for the inner color rings.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.900, 0, TAU);
  ctx.fill();
  ctx.restore();

  drawInnerPlasmaRings(cx, cy, baseRadius, energy, timeSeconds);

  // Main white/cyan core ring stays bright but not blown out.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(242, 251, 255, ${0.78 + bloom * 0.19})`;
  ctx.lineWidth = 1.20 + bloom * 0.62;
  ctx.shadowBlur = 9 + bloom * 11 + overdrive * 3;
  ctx.shadowColor = `rgba(111, 220, 255, ${0.82 + bloom * 0.17})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.998, 0, TAU);
  ctx.stroke();

  // Thin colored rim right outside the white core.
  const rim = timeColor(Math.PI * 1.5, timeSeconds, 0.22, 1.3);
  ctx.strokeStyle = `rgba(${rim[0]}, ${rim[1]}, ${rim[2]}, ${0.24 + bloom * 0.19})`;
  ctx.lineWidth = 1.05 + bloom * 0.36;
  ctx.shadowBlur = 12 + bloom * 10;
  ctx.shadowColor = `rgba(${rim[0]}, ${rim[1]}, ${rim[2]}, ${0.48 + bloom * 0.28})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.015, 0, TAU);
  ctx.stroke();
  ctx.restore();
};

// Plasma skin owns the whole visual; legacy accents stay disabled.
drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
