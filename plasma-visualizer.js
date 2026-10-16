// Frequency-mapped violet plasma ring for Sinestesia.
// The drawing layer is reactive by region: bass = lower arc, mids = sides, highs = upper arc.

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

  analyser.smoothingTimeConstant = 0.035;
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
    fastReactiveEnergy *= 0.62;
    smoothBass *= 0.72;
    smoothMid *= 0.72;
    smoothTreble *= 0.72;
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

  smoothBass = followValue(smoothBass, bassNow, 0.62, 0.17);
  smoothMid = followValue(smoothMid, midNow, 0.54, 0.15);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.58, 0.16);

  const target = clamp(
    rms * 1.75 +
    smoothBass * 0.68 +
    smoothMid * 0.24 +
    smoothTreble * 0.13
  );

  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.78, 0.20);

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
  // Bass occupies the lower arc, mids the sides, highs the upper arc.
  const bassWeight = periodicPulse(angle, Math.PI * 0.5, 1.00);
  const midWeight = Math.min(
    1,
    periodicPulse(angle, 0, 0.88) + periodicPulse(angle, Math.PI, 0.88)
  );
  const trebleWeight = periodicPulse(angle, Math.PI * 1.5, 0.88);

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
    energy * 0.08
  );
}

function flameColor(angle, bass, mid, treble) {
  const s = sectorSignals(angle, bass, mid, treble);
  const bassBias = clamp(s.bass);
  const midBias = clamp(s.mid);
  const highBias = clamp(s.treble);

  // Keep the whole aura violet, only nudging the tone by frequency region.
  const r = Math.round(128 + bassBias * 76 + midBias * 24);
  const g = Math.round(62 + midBias * 36 + highBias * 62);
  const b = 255;
  return { r, g, b };
}

function drawLocalVioletAura(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Many tiny arc segments blend into one continuous but locally reactive halo.
  const segments = 112;
  const step = TAU / segments;

  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const color = flameColor(angle, bass, mid, treble);
    const over = clamp((local - 0.62) / 0.38);

    const radius = baseRadius * (1.035 + local * 0.008);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.018 + local * 0.090})`;
    ctx.lineWidth = 8 + local * 6 + over * 3;
    ctx.shadowBlur = 22 + local * 26 + over * 18;
    ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.22 + local * 0.42})`;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.54, angle + step * 0.54);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Wide overlapping wisps produce a soft flame rather than visible radial bars.
  const count = 46;

  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    const angle = p * TAU;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const color = flameColor(angle, bass, mid, treble);

    const phase = plasmaPhase * (0.80 + (i % 5) * 0.045) + i * 1.37;
    const irregular = 0.76 + (0.5 + 0.5 * Math.sin(phase * 0.73)) * 0.44;
    const over = clamp((local - 0.58) / 0.42);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;

    const startR = baseRadius * (1.025 + Math.sin(phase * 0.52) * 0.0025);
    const length = baseRadius * (
      0.025 +
      local * 0.105 +
      over * 0.045
    ) * irregular;
    const bend = Math.sin(phase) * baseRadius * (0.006 + local * 0.014);

    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    // Gradient deliberately fades to zero so the flame disappears smoothly.
    const alpha = 0.025 + local * 0.075;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(205, 150, 255, ${alpha * 0.46})`);
    grad.addColorStop(0.18, `rgba(${Math.min(255, color.r + 28)}, ${Math.min(255, color.g + 20)}, 255, ${alpha})`);
    grad.addColorStop(0.48, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.82})`);
    grad.addColorStop(0.74, `rgba(112, 48, 255, ${alpha * 0.42})`);
    grad.addColorStop(1, 'rgba(88, 35, 255, 0)');

    // Broad pass: soft violet haze.
    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.034 + local * 0.022);
    ctx.shadowBlur = baseRadius * (0.065 + local * 0.075 + over * 0.025);
    ctx.shadowColor = `rgba(${color.r}, ${color.g}, 255, ${0.32 + local * 0.42})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.26 + tx * bend,
      y0 + ny * length * 0.26 + ty * bend,
      x0 + nx * length * 0.67 - tx * bend * 0.45,
      y0 + ny * length * 0.67 - ty * bend * 0.45,
      x1,
      y1,
    );
    ctx.stroke();

    // Narrow pass: gives the flame a luminous center without turning into a hard spike.
    ctx.lineWidth = baseRadius * (0.010 + local * 0.007);
    ctx.shadowBlur = baseRadius * (0.028 + local * 0.040);
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.30 - tx * bend * 0.40,
      y0 + ny * length * 0.30 - ty * bend * 0.40,
      x0 + nx * length * 0.64 + tx * bend * 0.20,
      y0 + ny * length * 0.64 + ty * bend * 0.20,
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

  const segments = 128;
  const step = TAU / segments;

  for (let i = 0; i < segments; i += 1) {
    const angle = i * step;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const s = sectorSignals(angle, bass, mid, treble);

    const high = clamp(s.treble);
    const mids = clamp(s.mid);
    const low = clamp(s.bass);

    const r = Math.round(105 + low * 95 + mids * 30);
    const g = Math.round(137 + high * 86 + mids * 24);
    const b = 255;

    const wobble = Math.sin(angle * 7 + plasmaPhase * 1.6) * 0.0017;
    const radius = baseRadius * (1.008 + wobble + local * 0.0025);

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.28 + local * 0.46})`;
    ctx.lineWidth = 1.4 + local * 1.8;
    ctx.shadowBlur = 7 + local * 15;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.42 + local * 0.42})`;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle - step * 0.56, angle + step * 0.56);
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
  glow.addColorStop(0, 'rgba(18, 7, 52, 0.10)');
  glow.addColorStop(0.50, 'rgba(8, 4, 28, 0.055)');
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

  plasmaPhase += 0.0032 + energy * 0.009;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.273 + bass * 0.006 + energy * 0.003);

  const bloom = Math.pow(clamp(energy), 1.18);
  const overdrive = Math.pow(clamp((energy - 0.64) / 0.36), 1.20);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Global glow remains subtle; the stronger changes happen locally by frequency region.
  const haloOuter = baseRadius * (1.42 + bloom * 0.06 + overdrive * 0.08);
  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.91,
    cx, cy, haloOuter,
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.43, `rgba(42, 111, 255, ${0.012 + bloom * 0.025})`);
  halo.addColorStop(0.63, `rgba(94, 57, 255, ${0.026 + bloom * 0.045})`);
  halo.addColorStop(0.80, `rgba(168, 48, 255, ${0.024 + bloom * 0.050})`);
  halo.addColorStop(0.94, `rgba(220, 66, 255, ${0.006 + overdrive * 0.025})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloOuter, 0, TAU);
  ctx.fill();

  ctx.restore();

  // Local violet aura + flame. These are what now respond by region.
  drawLocalVioletAura(cx, cy, baseRadius, bass, mid, treble, energy);
  drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy);
  drawReactiveRing(cx, cy, baseRadius, bass, mid, treble, energy);

  // Thin cyan-white core, intentionally controlled so maximum energy does not become a fat white ring.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(232, 248, 255, ${0.66 + bloom * 0.22})`;
  ctx.lineWidth = 0.95 + bloom * 0.55;
  ctx.shadowBlur = 7 + bloom * 9 + overdrive * 3;
  ctx.shadowColor = `rgba(101, 215, 255, ${0.72 + bloom * 0.24})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.997, 0, TAU);
  ctx.stroke();

  // Soft magenta-violet rim, as in the reference.
  ctx.strokeStyle = `rgba(232, 149, 255, ${0.14 + bloom * 0.16})`;
  ctx.lineWidth = 0.9 + bloom * 0.35;
  ctx.shadowBlur = 11 + bloom * 10 + overdrive * 4;
  ctx.shadowColor = `rgba(204, 72, 255, ${0.34 + bloom * 0.28})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.015, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // Keep the center clean and black.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.958, 0, TAU);
  ctx.fill();

  const innerGlow = ctx.createRadialGradient(
    cx,
    cy,
    baseRadius * 0.82,
    cx,
    cy,
    baseRadius * 0.975,
  );
  innerGlow.addColorStop(0, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(0.80, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(1, `rgba(20, 94, 170, ${0.055 + mid * 0.032})`);
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.975, 0, TAU);
  ctx.fill();
  ctx.restore();
};

// The plasma skin owns the whole drawing. Keep the old accent layers disabled.
drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
