// Frequency-mapped cyan/violet plasma ring skin for Sinestesia.
// Loaded after app.js so it replaces only the drawing layer.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureLowLatencyAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  if (analyser.fftSize !== 1024) {
    analyser.fftSize = 1024;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.03;
  return ok;
};

paletteForFamily = function paletteForFamilyPlasmaRing() {
  return { h1: 205, h2: 247, h3: 286 };
};

function spectrumAt(progress) {
  if (!frequencyData || !frequencyData.length) return 0;
  const maxBin = Math.max(1, Math.floor(frequencyData.length * 0.34));
  const index = Math.min(maxBin - 1, Math.floor(progress * maxBin));
  return frequencyData[index] / 255;
}

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.6;
    return { bass: 0, mid: 0, treble: 0, energy: fastReactiveEnergy };
  }

  const bass = averageRange(35, 180);
  const mid = averageRange(180, 2500);
  const treble = averageRange(2500, 12000);
  const rms = rmsLevel();
  const target = clamp(rms * 1.9 + bass * 0.92 + mid * 0.26 + treble * 0.12);
  const amount = target > fastReactiveEnergy ? 0.88 : 0.22;
  fastReactiveEnergy += (target - fastReactiveEnergy) * amount;

  return { bass, mid, treble, energy: fastReactiveEnergy };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function organicWave(angle, offset, speed) {
  return (
    Math.sin(angle * 4 + plasmaPhase * speed + offset) * 0.34 +
    Math.sin(angle * 9 - plasmaPhase * speed * 0.78 + offset * 1.6) * 0.24 +
    Math.sin(angle * 17 + plasmaPhase * speed * 0.40 - offset * 0.8) * 0.14
  );
}

function sectorSignals(angle, bass, mid, treble) {
  // Bass lives mostly on the lower arc, mids on the sides, highs on the upper arc.
  const bassW = periodicPulse(angle, Math.PI * 0.5, 1.02);
  const midW = periodicPulse(angle, 0, 0.92) + periodicPulse(angle, Math.PI, 0.92);
  const trebleW = periodicPulse(angle, Math.PI * 1.5, 0.82);
  return {
    bass: bassW * bass,
    mid: midW * mid,
    treble: trebleW * treble,
  };
}

function ringLocalEnergy(angle, bass, mid, treble, energy) {
  const sectors = sectorSignals(angle, bass, mid, treble);
  const musical = spectrumAt(angle / TAU);
  return clamp(sectors.bass * 0.90 + sectors.mid * 0.72 + sectors.treble * 0.92 + musical * 0.35 + energy * 0.30);
}

function drawPlasmaBand(cx, cy, baseRadius, bass, mid, treble, energy, options) {
  const {
    steps,
    offset,
    amplitude,
    speed,
    color,
    widthPx,
    blurPx,
    audioAmount,
    bloomAmount,
  } = options;

  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
  ctx.shadowBlur = blurPx;
  ctx.shadowColor = color;
  ctx.beginPath();

  for (let i = 0; i <= steps; i += 1) {
    const p = i / steps;
    const angle = p * TAU;
    const wave = organicWave(angle, offset, speed);
    const local = ringLocalEnergy(angle, bass, mid, treble, energy);
    const blooms =
      periodicPulse(angle, plasmaPhase * 0.16 + 0.30, 0.34) * 0.18 +
      periodicPulse(angle, plasmaPhase * -0.12 + 2.10, 0.38) * 0.14 +
      periodicPulse(angle, plasmaPhase * 0.10 + 4.15, 0.36) * 0.16;

    const radial = 1 + wave * amplitude + local * amplitude * audioAmount + blooms * amplitude * bloomAmount;
    const r = baseRadius * radial;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();
}

function drawReactiveRingSegments(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const segments = 96;
  const gap = 0.018;

  for (let i = 0; i < segments; i += 1) {
    const p0 = i / segments;
    const p1 = (i + 1) / segments;
    const a0 = p0 * TAU + gap;
    const a1 = p1 * TAU - gap;
    const am = (a0 + a1) * 0.5;
    const local = ringLocalEnergy(am, bass, mid, treble, energy);
    const sector = sectorSignals(am, bass, mid, treble);

    const wobble = organicWave(am, i * 0.071, 2.45) * (0.0024 + local * 0.0036);
    const radius = baseRadius * (1.008 + wobble + local * 0.0040);

    const low = clamp(sector.bass);
    const mids = clamp(sector.mid);
    const highs = clamp(sector.treble);

    // Low frequencies lean violet/magenta, mids stay blue-violet, highs become cyan/white.
    const red = Math.round(82 + low * 122 + mids * 28 + highs * 18);
    const green = Math.round(112 + mids * 42 + highs * 116);
    const blue = 255;
    const alpha = 0.30 + local * 0.54;

    ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    ctx.lineWidth = 2.0 + local * 3.0;
    ctx.shadowBlur = 7 + local * 20;
    ctx.shadowColor = `rgba(${red}, ${green}, 255, ${0.45 + local * 0.45})`;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCircumferenceWisps(cx, cy, baseRadius, bass, mid, treble, energy) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const count = 28;
  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    const angle = p * TAU;
    const phase = plasmaPhase * (0.92 + (i % 4) * 0.06) + i * 1.41;
    const local = ringLocalEnergy(angle, bass, mid, treble, energy);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;

    const startR = baseRadius * (1.018 + Math.sin(phase * 0.7) * 0.004);
    const length = baseRadius * (0.040 + local * 0.050 + (0.5 + 0.5 * Math.sin(phase)) * 0.018);
    const bend = Math.sin(phase * 0.9) * baseRadius * (0.010 + local * 0.012);

    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    const bassness = sectorSignals(angle, bass, mid, treble).bass;
    const midness = sectorSignals(angle, bass, mid, treble).mid;
    const trebness = sectorSignals(angle, bass, mid, treble).treble;
    const alpha = 0.028 + local * 0.040;

    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(${Math.round(60 + trebness * 80)}, ${Math.round(110 + trebness * 110)}, 255, ${alpha * 0.95})`);
    grad.addColorStop(0.40, `rgba(${Math.round(105 + midness * 35)}, ${Math.round(80 + midness * 35)}, 255, ${alpha})`);
    grad.addColorStop(0.78, `rgba(${Math.round(176 + bassness * 40)}, 74, 255, ${alpha * 0.55})`);
    grad.addColorStop(1, 'rgba(120, 46, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.014 + local * 0.008);
    ctx.shadowBlur = baseRadius * (0.030 + local * 0.025);
    ctx.shadowColor = `rgba(118, 74, 255, ${0.35 + local * 0.45})`;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.28 + tx * bend,
      y0 + ny * length * 0.28 + ty * bend,
      x0 + nx * length * 0.66 - tx * bend * 0.4,
      y0 + ny * length * 0.66 - ty * bend * 0.4,
      x1,
      y1,
    );
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
  glow.addColorStop(0, 'rgba(20, 8, 54, 0.13)');
  glow.addColorStop(0.48, 'rgba(8, 5, 28, 0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
};

drawAurora = function drawPlasmaRing(width, height) {
  const fast = fastBeatSignal();
  const visualEnergy = fast.energy;
  const bass = fast.bass;
  const mid = fast.mid;
  const treble = fast.treble;

  plasmaPhase += 0.0038 + visualEnergy * 0.011;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.273 + bass * 0.010 + visualEnergy * 0.005);

  const bloom = Math.pow(clamp(visualEnergy), 1.25);
  const overdrive = Math.pow(clamp(Math.max(0, visualEnergy - 0.62) / 0.38), 1.35);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Wide atmospheric halo. Brightens with energy, but stays soft.
  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.86,
    cx, cy, baseRadius * (1.48 + bloom * 0.06),
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.44, `rgba(30, 88, 255, ${0.020 + bloom * 0.032})`);
  halo.addColorStop(0.62, `rgba(82, 54, 255, ${0.050 + bloom * 0.060})`);
  halo.addColorStop(0.77, `rgba(163, 52, 255, ${0.050 + bloom * 0.070 + overdrive * 0.030})`);
  halo.addColorStop(0.92, `rgba(225, 85, 255, ${0.012 + overdrive * 0.040})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.52, 0, TAU);
  ctx.fill();

  // Closer shell for the reference-like extra layer.
  const shell = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.95,
    cx, cy, baseRadius * (1.24 + bloom * 0.035),
  );
  shell.addColorStop(0, 'rgba(0,0,0,0)');
  shell.addColorStop(0.42, `rgba(44, 146, 255, ${0.030 + bloom * 0.040})`);
  shell.addColorStop(0.62, `rgba(108, 84, 255, ${0.080 + bloom * 0.075})`);
  shell.addColorStop(0.82, `rgba(200, 84, 255, ${0.060 + bloom * 0.055 + overdrive * 0.020})`);
  shell.addColorStop(1, 'rgba(155, 50, 255, 0)');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.26, 0, TAU);
  ctx.fill();

  // Softer body, less exaggerated than the previous version.
  drawPlasmaBand(cx, cy, baseRadius * 1.040, bass, mid, treble, visualEnergy, {
    steps: 210,
    offset: 0.38,
    amplitude: 0.010 + treble * 0.0035 + visualEnergy * 0.0045,
    speed: 1.45,
    color: `rgba(214, 80, 255, ${0.055 + bloom * 0.075})`,
    widthPx: 8.0 + bloom * 4.0,
    blurPx: 22 + bloom * 13,
    audioAmount: 0.78,
    bloomAmount: 0.50,
  });

  drawPlasmaBand(cx, cy, baseRadius * 1.025, bass, mid, treble, visualEnergy, {
    steps: 220,
    offset: 2.2,
    amplitude: 0.0075 + mid * 0.0030 + visualEnergy * 0.0032,
    speed: 1.95,
    color: `rgba(130, 84, 255, ${0.11 + bloom * 0.11})`,
    widthPx: 4.8 + bloom * 2.2,
    blurPx: 15 + bloom * 9,
    audioAmount: 0.68,
    bloomAmount: 0.38,
  });

  drawCircumferenceWisps(cx, cy, baseRadius, bass, mid, treble, visualEnergy);

  // Localized frequency response around the sphere.
  drawReactiveRingSegments(cx, cy, baseRadius, bass, mid, treble, visualEnergy);

  // Bright white core ring.
  ctx.strokeStyle = `rgba(242, 250, 255, ${0.78 + bloom * 0.18})`;
  ctx.lineWidth = 1.25 + bloom * 0.70;
  ctx.shadowBlur = 10 + bloom * 9 + overdrive * 5;
  ctx.shadowColor = `rgba(118, 225, 255, ${0.82 + bloom * 0.18})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.997, 0, TAU);
  ctx.stroke();

  // Thin magenta rim like the reference, but softer and more controlled.
  ctx.strokeStyle = `rgba(231, 148, 255, ${0.18 + bloom * 0.16 + overdrive * 0.10})`;
  ctx.lineWidth = 1.2 + bloom * 0.45;
  ctx.shadowBlur = 13 + bloom * 10 + overdrive * 6;
  ctx.shadowColor = `rgba(212, 78, 255, ${0.42 + bloom * 0.28})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.016, 0, TAU);
  ctx.stroke();

  ctx.restore();

  // Keep the center black.
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
  innerGlow.addColorStop(0.78, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(1, `rgba(24, 104, 174, ${0.08 + mid * 0.045})`);
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.975, 0, TAU);
  ctx.fill();
  ctx.restore();
};

drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
