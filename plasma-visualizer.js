// Full-circumference cyan/violet plasma ring skin for Sinestesia.
// Loaded after app.js so it replaces only the drawing layer.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;
let glowIntensity = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureLowLatencyAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  if (analyser.fftSize !== 1024) {
    analyser.fftSize = 1024;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.025;
  return ok;
};

paletteForFamily = function paletteForFamilyPlasmaRing() {
  return { h1: 204, h2: 247, h3: 286 };
};

function spectrumAt(progress) {
  if (!frequencyData || !frequencyData.length) return 0;
  const maxBin = Math.max(1, Math.floor(frequencyData.length * 0.34));
  const index = Math.min(maxBin - 1, Math.floor(progress * maxBin));
  return frequencyData[index] / 255;
}

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.58;
    return { bass: 0, mid: 0, treble: 0, energy: fastReactiveEnergy };
  }

  const bass = averageRange(35, 180);
  const mid = averageRange(180, 2500);
  const treble = averageRange(2500, 12000);
  const rms = rmsLevel();
  const target = clamp(rms * 2.15 + bass * 0.92 + mid * 0.18 + treble * 0.05);

  const amount = target > fastReactiveEnergy ? 0.95 : 0.28;
  fastReactiveEnergy += (target - fastReactiveEnergy) * amount;

  return { bass, mid, treble, energy: fastReactiveEnergy };
}

function getGlowDynamics(fast) {
  // Perceptual loudness estimate. Bass drives most of the bloom, while mids and highs
  // add a smaller amount so bright passages also feel more luminous.
  const raw = clamp(
    fast.energy * 0.72 +
    fast.bass * 0.18 +
    fast.mid * 0.07 +
    fast.treble * 0.03
  );

  const target = Math.pow(raw, 0.82);
  const follow = target > glowIntensity ? 0.48 : 0.13;
  glowIntensity += (target - glowIntensity) * follow;

  const intensity = clamp(glowIntensity);

  // Above ~64% intensity, excess light is pushed into a wider gradient instead
  // of making the core turn into a flat white line.
  const overdrive = clamp((intensity - 0.64) / 0.36);
  const spread = 1 + intensity * 0.05 + overdrive * 0.24;
  const coreCompression = 1 - overdrive * 0.07;

  return { intensity, overdrive, spread, coreCompression };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function organicWave(angle, offset, speed) {
  return (
    Math.sin(angle * 5 + plasmaPhase * speed + offset) * 0.38 +
    Math.sin(angle * 11 - plasmaPhase * speed * 0.72 + offset * 1.7) * 0.27 +
    Math.sin(angle * 19 + plasmaPhase * speed * 0.43 - offset * 0.8) * 0.20 +
    Math.sin(angle * 31 - plasmaPhase * speed * 0.23 + offset * 2.1) * 0.15
  );
}

function drawPlasmaBand(cx, cy, baseRadius, options) {
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
    const musical = spectrumAt(p);
    const wave = organicWave(angle, offset, speed);

    const blooms =
      periodicPulse(angle, plasmaPhase * 0.19 + 0.2, 0.34) * 0.40 +
      periodicPulse(angle, plasmaPhase * -0.15 + 1.75, 0.39) * 0.34 +
      periodicPulse(angle, plasmaPhase * 0.12 + 3.20, 0.36) * 0.38 +
      periodicPulse(angle, plasmaPhase * -0.10 + 4.75, 0.41) * 0.32;

    const radial =
      1 +
      wave * amplitude +
      musical * amplitude * audioAmount +
      blooms * amplitude * bloomAmount;

    const r = baseRadius * radial;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();
}

function drawCircumferenceWisps(cx, cy, baseRadius, energy, bass, treble, overdrive) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const count = 36;
  const idleLift = 0.055;

  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    const angle = p * TAU;
    const phase = plasmaPhase * (1.05 + (i % 5) * 0.055) + i * 1.618;
    const audio = spectrumAt(p);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;

    const startR = baseRadius * (1.015 + Math.sin(phase * 0.71) * 0.006);
    const length = baseRadius * (
      idleLift +
      audio * 0.095 +
      energy * 0.078 +
      treble * 0.035 +
      overdrive * 0.055 +
      (0.5 + 0.5 * Math.sin(phase)) * 0.050
    );

    const bend = Math.sin(phase * 0.83) * baseRadius * (0.018 + treble * 0.018);
    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    const alpha = 0.025 + energy * 0.105 + audio * 0.045;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(78, 180, 255, ${alpha * 0.95})`);
    grad.addColorStop(0.25, `rgba(100, 100, 255, ${alpha})`);
    grad.addColorStop(0.58, `rgba(168, 55, 255, ${alpha * 0.88})`);
    grad.addColorStop(0.82, `rgba(224, 76, 255, ${alpha * 0.48})`);
    grad.addColorStop(1, 'rgba(131, 45, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.018 + energy * 0.016 + audio * 0.007 + overdrive * 0.006);
    ctx.shadowBlur = baseRadius * (0.045 + energy * 0.070 + overdrive * 0.025);
    ctx.shadowColor = 'rgba(127, 64, 255, 0.95)';

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.28 + tx * bend,
      y0 + ny * length * 0.28 + ty * bend,
      x0 + nx * length * 0.67 - tx * bend * 0.45,
      y0 + ny * length * 0.67 - ty * bend * 0.45,
      x1,
      y1,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnergyTail(cx, cy, baseRadius, energy, bass, overdrive) {
  const startY = cy + baseRadius * 0.965;
  const endY = startY + baseRadius * (0.68 + energy * 0.30 + overdrive * 0.08);
  const sway = Math.sin(plasmaPhase * 2.25) * baseRadius * (0.018 + energy * 0.017);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const layers = [
    { width: 11 + energy * 16 + overdrive * 7, alpha: 0.018 + energy * 0.050, blur: 24 + overdrive * 14 },
    { width: 5.5 + energy * 9 + overdrive * 4, alpha: 0.055 + energy * 0.13, blur: 14 + overdrive * 10 },
    { width: 2.0 + energy * 3.2, alpha: 0.24 + energy * 0.42, blur: 7 + overdrive * 6 },
    { width: 0.8 + energy * 1.0, alpha: 0.48 + energy * 0.48, blur: 3 + overdrive * 3 },
  ];

  for (const layer of layers) {
    const grad = ctx.createLinearGradient(cx, startY, cx + sway, endY);
    grad.addColorStop(0, `rgba(220, 124, 255, ${layer.alpha})`);
    grad.addColorStop(0.18, `rgba(111, 117, 255, ${layer.alpha})`);
    grad.addColorStop(0.52, `rgba(31, 170, 255, ${layer.alpha})`);
    grad.addColorStop(1, 'rgba(10, 91, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = layer.width;
    ctx.shadowBlur = layer.blur;
    ctx.shadowColor = 'rgba(34, 139, 255, 0.98)';
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.bezierCurveTo(
      cx - baseRadius * 0.018,
      startY + baseRadius * 0.18,
      cx + sway * 1.25,
      startY + baseRadius * 0.46,
      cx + sway,
      endY,
    );
    ctx.stroke();
  }

  for (const side of [-1, 1]) {
    const split = side * baseRadius * (0.016 + bass * 0.012);
    ctx.strokeStyle = `rgba(102, 100, 255, ${0.025 + energy * 0.13})`;
    ctx.lineWidth = 0.7 + bass * 0.9 + energy * 0.4;
    ctx.shadowBlur = 6 + overdrive * 6;
    ctx.shadowColor = 'rgba(105, 68, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(cx + split, startY + baseRadius * 0.02);
    ctx.bezierCurveTo(
      cx + split * 2.0,
      startY + baseRadius * 0.20,
      cx + split * 0.3 + sway,
      startY + baseRadius * 0.43,
      cx + sway * 0.72,
      endY - baseRadius * 0.08,
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
    Math.max(width, height) * 0.60,
  );
  glow.addColorStop(0, 'rgba(23, 8, 57, 0.12)');
  glow.addColorStop(0.46, 'rgba(10, 5, 31, 0.075)');
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
  const glow = getGlowDynamics(fast);
  const brightness = glow.intensity;
  const overdrive = glow.overdrive;
  const spread = glow.spread;

  plasmaPhase += 0.0042 + visualEnergy * 0.017;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.275 + bass * 0.016 + visualEnergy * 0.008);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Wide atmospheric halo. Quiet music stays subtle; loud music expands outward.
  const haloOuter = baseRadius * (1.43 + brightness * 0.10 + overdrive * 0.22);
  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.78,
    cx, cy, haloOuter,
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.40, `rgba(28, 91, 255, ${0.010 + brightness * 0.060})`);
  halo.addColorStop(0.58, `rgba(82, 55, 255, ${0.018 + brightness * 0.125})`);
  halo.addColorStop(0.73, `rgba(158, 47, 255, ${0.022 + brightness * 0.145})`);
  halo.addColorStop(0.87, `rgba(225, 70, 255, ${0.010 + brightness * 0.075})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloOuter, 0, TAU);
  ctx.fill();

  // Near shell. When intensity gets very high the shell becomes wider and softer,
  // producing the requested gradient instead of clipping into a solid bright band.
  const shellOuter = baseRadius * (1.18 + brightness * 0.07 + overdrive * 0.13);
  const shell = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.91,
    cx, cy, shellOuter,
  );
  shell.addColorStop(0, 'rgba(0,0,0,0)');
  shell.addColorStop(0.34, `rgba(41, 149, 255, ${0.018 + brightness * 0.095})`);
  shell.addColorStop(0.56, `rgba(106, 80, 255, ${0.032 + brightness * 0.205})`);
  shell.addColorStop(0.74, `rgba(194, 65, 255, ${0.028 + brightness * 0.185})`);
  shell.addColorStop(1, 'rgba(151, 46, 255, 0)');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(cx, cy, shellOuter, 0, TAU);
  ctx.fill();

  const smokeAmp = 0.012 + treble * 0.006 + visualEnergy * 0.011;
  drawPlasmaBand(cx, cy, baseRadius * 1.058, {
    steps: 190,
    offset: 0.35,
    amplitude: smokeAmp * 1.50,
    speed: 1.45,
    color: `rgba(221, 65, 255, ${0.025 + brightness * 0.19})`,
    widthPx: (10 + brightness * 16 + overdrive * 8) * spread,
    blurPx: (20 + brightness * 40 + overdrive * 24) * spread,
    audioAmount: 0.70,
    bloomAmount: 0.90,
  });

  drawPlasmaBand(cx, cy, baseRadius * 1.041, {
    steps: 200,
    offset: 2.10,
    amplitude: smokeAmp * 1.12,
    speed: 1.88,
    color: `rgba(139, 72, 255, ${0.045 + brightness * 0.255})`,
    widthPx: (6 + brightness * 10 + overdrive * 5) * spread,
    blurPx: (15 + brightness * 29 + overdrive * 18) * spread,
    audioAmount: 0.82,
    bloomAmount: 0.72,
  });

  drawCircumferenceWisps(cx, cy, baseRadius, brightness, bass, treble, overdrive);

  const bodyAmp = 0.007 + treble * 0.0042 + visualEnergy * 0.0065;
  drawPlasmaBand(cx, cy, baseRadius * 1.024, {
    steps: 230,
    offset: 1.20,
    amplitude: bodyAmp * 1.22,
    speed: 2.35,
    color: `rgba(148, 82, 255, ${0.15 + brightness * 0.62})`,
    widthPx: 3.6 + brightness * 7.0 + overdrive * 2.3,
    blurPx: 8 + brightness * 28 + overdrive * 14,
    audioAmount: 0.92,
    bloomAmount: 0.64,
  });

  drawPlasmaBand(cx, cy, baseRadius * 1.011, {
    steps: 240,
    offset: 3.45,
    amplitude: bodyAmp * 0.86,
    speed: 2.85,
    color: `rgba(50, 151, 255, ${0.20 + brightness * 0.68})`,
    widthPx: 2.8 + brightness * 5.0 + overdrive * 1.8,
    blurPx: 7 + brightness * 21 + overdrive * 10,
    audioAmount: 1.02,
    bloomAmount: 0.48,
  });

  // Cyan filament: its brightness follows the music strongly, but width grows only a little.
  drawPlasmaBand(cx, cy, baseRadius * 1.002, {
    steps: 260,
    offset: 5.10,
    amplitude: 0.0025 + treble * 0.0022 + visualEnergy * 0.0023,
    speed: 3.45,
    color: `rgba(76, 219, 255, ${(0.30 + brightness * 0.67) * glow.coreCompression})`,
    widthPx: 1.1 + brightness * 2.25,
    blurPx: 4 + brightness * 15 + overdrive * 8,
    audioAmount: 0.84,
    bloomAmount: 0.18,
  });

  // White-hot core. At extreme levels, some energy is intentionally moved into the
  // surrounding gradient so the center keeps texture instead of blowing out completely.
  const coreAlpha = clamp((0.30 + brightness * 0.70) * glow.coreCompression);
  ctx.strokeStyle = `rgba(236, 250, 255, ${coreAlpha})`;
  ctx.lineWidth = 0.8 + brightness * 1.9 + overdrive * 0.35;
  ctx.shadowBlur = 3 + brightness * 17 + overdrive * 10;
  ctx.shadowColor = 'rgba(110, 220, 255, 1)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.995, 0, TAU);
  ctx.stroke();

  const magentaAlpha = 0.08 + brightness * 0.43;
  ctx.strokeStyle = `rgba(229, 156, 255, ${magentaAlpha})`;
  ctx.lineWidth = 0.7 + brightness * 2.0 + overdrive * 0.7;
  ctx.shadowBlur = 6 + brightness * 22 + overdrive * 14;
  ctx.shadowColor = 'rgba(210, 74, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.016, 0, TAU);
  ctx.stroke();

  ctx.restore();

  drawEnergyTail(cx, cy, baseRadius, brightness, bass, overdrive);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.958, 0, TAU);
  ctx.fill();

  const innerGlow = ctx.createRadialGradient(
    cx,
    cy,
    baseRadius * 0.80,
    cx,
    cy,
    baseRadius * 0.974,
  );
  innerGlow.addColorStop(0, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(0.76, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(1, `rgba(21, 102, 174, ${0.035 + brightness * 0.11 + mid * 0.035})`);
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.974, 0, TAU);
  ctx.fill();
  ctx.restore();
};

drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
