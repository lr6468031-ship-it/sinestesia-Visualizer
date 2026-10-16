// Full-circumference cyan/violet plasma ring skin for Sinestesia.
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

    // Several moving blooms distributed around the full circumference.
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

function drawCircumferenceWisps(cx, cy, baseRadius, energy, bass, treble) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const count = 36;
  const idleLift = 0.075;

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
      energy * 0.070 +
      treble * 0.035 +
      (0.5 + 0.5 * Math.sin(phase)) * 0.055
    );

    const bend = Math.sin(phase * 0.83) * baseRadius * (0.018 + treble * 0.018);
    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    const alpha = 0.055 + energy * 0.070 + audio * 0.050;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(78, 180, 255, ${alpha * 0.95})`);
    grad.addColorStop(0.25, `rgba(100, 100, 255, ${alpha})`);
    grad.addColorStop(0.58, `rgba(168, 55, 255, ${alpha * 0.88})`);
    grad.addColorStop(0.82, `rgba(224, 76, 255, ${alpha * 0.48})`);
    grad.addColorStop(1, 'rgba(131, 45, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.026 + energy * 0.010 + audio * 0.008);
    ctx.shadowBlur = baseRadius * (0.075 + energy * 0.035);
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

function drawEnergyTail(cx, cy, baseRadius, energy, bass) {
  const startY = cy + baseRadius * 0.965;
  const endY = startY + baseRadius * (0.72 + energy * 0.26);
  const sway = Math.sin(plasmaPhase * 2.25) * baseRadius * (0.020 + energy * 0.016);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const layers = [
    { width: 18 + energy * 13, alpha: 0.050, blur: 31 },
    { width: 8.5 + energy * 6.5, alpha: 0.16, blur: 20 },
    { width: 3.0 + energy * 2.2, alpha: 0.64, blur: 11 },
    { width: 1.0 + energy * 0.8, alpha: 0.96, blur: 5 },
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
    ctx.strokeStyle = `rgba(102, 100, 255, ${0.06 + energy * 0.10})`;
    ctx.lineWidth = 0.9 + bass * 0.9;
    ctx.shadowBlur = 9;
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
  glow.addColorStop(0, 'rgba(23, 8, 57, 0.16)');
  glow.addColorStop(0.46, 'rgba(10, 5, 31, 0.10)');
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

  plasmaPhase += 0.0042 + visualEnergy * 0.017;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.275 + bass * 0.016 + visualEnergy * 0.008);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // First wide halo: blue-violet atmospheric light.
  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.78,
    cx, cy, baseRadius * (1.58 + visualEnergy * 0.06),
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.40, `rgba(28, 91, 255, ${0.035 + visualEnergy * 0.045})`);
  halo.addColorStop(0.58, `rgba(82, 55, 255, ${0.095 + visualEnergy * 0.085})`);
  halo.addColorStop(0.73, `rgba(158, 47, 255, ${0.105 + visualEnergy * 0.095})`);
  halo.addColorStop(0.87, `rgba(225, 70, 255, ${0.050 + visualEnergy * 0.050})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.60, 0, TAU);
  ctx.fill();

  // Second glow layer: closer and brighter, matching the extra luminous shell in the reference.
  const shell = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.91,
    cx, cy, baseRadius * (1.28 + visualEnergy * 0.035),
  );
  shell.addColorStop(0, 'rgba(0,0,0,0)');
  shell.addColorStop(0.36, `rgba(41, 149, 255, ${0.055 + visualEnergy * 0.055})`);
  shell.addColorStop(0.57, `rgba(106, 80, 255, ${0.15 + visualEnergy * 0.12})`);
  shell.addColorStop(0.75, `rgba(194, 65, 255, ${0.13 + visualEnergy * 0.11})`);
  shell.addColorStop(1, 'rgba(151, 46, 255, 0)');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.31, 0, TAU);
  ctx.fill();

  // Broad smoky plasma skins around the entire sphere.
  const smokeAmp = 0.016 + treble * 0.007 + visualEnergy * 0.013;
  drawPlasmaBand(cx, cy, baseRadius * 1.058, {
    steps: 190,
    offset: 0.35,
    amplitude: smokeAmp * 1.50,
    speed: 1.45,
    color: `rgba(221, 65, 255, ${0.10 + visualEnergy * 0.11})`,
    widthPx: 18 + visualEnergy * 10,
    blurPx: 46 + visualEnergy * 22,
    audioAmount: 0.70,
    bloomAmount: 0.90,
  });

  drawPlasmaBand(cx, cy, baseRadius * 1.041, {
    steps: 200,
    offset: 2.10,
    amplitude: smokeAmp * 1.12,
    speed: 1.88,
    color: `rgba(139, 72, 255, ${0.16 + visualEnergy * 0.15})`,
    widthPx: 11 + visualEnergy * 7,
    blurPx: 34 + visualEnergy * 20,
    audioAmount: 0.82,
    bloomAmount: 0.72,
  });

  // Fine flame-like plasma now wraps all 360 degrees, not just the top.
  drawCircumferenceWisps(cx, cy, baseRadius, visualEnergy, bass, treble);

  // Main violet and blue ring body.
  const bodyAmp = 0.009 + treble * 0.0045 + visualEnergy * 0.007;
  drawPlasmaBand(cx, cy, baseRadius * 1.024, {
    steps: 230,
    offset: 1.20,
    amplitude: bodyAmp * 1.22,
    speed: 2.35,
    color: `rgba(148, 82, 255, ${0.43 + visualEnergy * 0.29})`,
    widthPx: 7.8 + visualEnergy * 3.8,
    blurPx: 27 + visualEnergy * 18,
    audioAmount: 0.92,
    bloomAmount: 0.64,
  });

  drawPlasmaBand(cx, cy, baseRadius * 1.011, {
    steps: 240,
    offset: 3.45,
    amplitude: bodyAmp * 0.86,
    speed: 2.85,
    color: `rgba(50, 151, 255, ${0.62 + visualEnergy * 0.30})`,
    widthPx: 5.0 + visualEnergy * 2.7,
    blurPx: 19 + visualEnergy * 13,
    audioAmount: 1.02,
    bloomAmount: 0.48,
  });

  // Bright cyan filament just outside the white core.
  drawPlasmaBand(cx, cy, baseRadius * 1.002, {
    steps: 260,
    offset: 5.10,
    amplitude: 0.0032 + treble * 0.0022 + visualEnergy * 0.0025,
    speed: 3.45,
    color: `rgba(76, 219, 255, ${0.88 + visualEnergy * 0.10})`,
    widthPx: 2.35 + visualEnergy * 1.20,
    blurPx: 13 + visualEnergy * 11,
    audioAmount: 0.84,
    bloomAmount: 0.18,
  });

  // White-hot core. Brighter and thicker than the previous version.
  ctx.strokeStyle = `rgba(236, 250, 255, ${0.90 + visualEnergy * 0.10})`;
  ctx.lineWidth = 1.65 + visualEnergy * 0.95;
  ctx.shadowBlur = 14 + visualEnergy * 13;
  ctx.shadowColor = 'rgba(110, 220, 255, 1)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.995, 0, TAU);
  ctx.stroke();

  // A thin magenta-white rim gives the reference-style layered edge.
  ctx.strokeStyle = `rgba(229, 156, 255, ${0.36 + visualEnergy * 0.23})`;
  ctx.lineWidth = 1.8 + visualEnergy * 0.8;
  ctx.shadowBlur = 20 + visualEnergy * 14;
  ctx.shadowColor = 'rgba(210, 74, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.016, 0, TAU);
  ctx.stroke();

  ctx.restore();

  drawEnergyTail(cx, cy, baseRadius, visualEnergy, bass);

  // Repaint center black so all glow hugs the ring instead of filling the disc.
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
  innerGlow.addColorStop(1, `rgba(21, 102, 174, ${0.13 + mid * 0.065})`);
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
