// Layered cyan/violet plasma ring skin for Sinestesia.
// Loaded after app.js so it replaces only the drawing layer.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureLowLatencyAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  // Small FFT window + very low smoothing keeps the ring visually locked to the audio.
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

  // Fast attack, short release: bright hits arrive immediately, then melt away.
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
    Math.sin(angle * 5 + plasmaPhase * speed + offset) * 0.42 +
    Math.sin(angle * 11 - plasmaPhase * speed * 0.72 + offset * 1.7) * 0.27 +
    Math.sin(angle * 19 + plasmaPhase * speed * 0.43 - offset * 0.8) * 0.18 +
    Math.sin(angle * 31 - plasmaPhase * speed * 0.23 + offset * 2.1) * 0.13
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

    // Uneven plasma blooms stop the ring looking like a perfect neon tube.
    const blooms =
      periodicPulse(angle, -Math.PI * 0.52 + Math.sin(plasmaPhase * 0.47) * 0.16, 0.40) * 0.95 +
      periodicPulse(angle, Math.PI * 0.94 + Math.sin(plasmaPhase * 0.31 + 1.8) * 0.13, 0.48) * 0.58 +
      periodicPulse(angle, Math.PI * 0.10 + Math.sin(plasmaPhase * 0.39 + 3.2) * 0.10, 0.34) * 0.42;

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

function drawTopPlasmaWisps(cx, cy, baseRadius, energy, bass, treble) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x0 = cx + (t - 0.5) * baseRadius * 0.74;
    const phase = plasmaPhase * (1.25 + i * 0.07) + i * 1.73;
    const sway = Math.sin(phase) * baseRadius * (0.035 + treble * 0.025);
    const height = baseRadius * (0.16 + energy * 0.28 + (0.5 + 0.5 * Math.sin(phase * 0.71)) * 0.15);
    const alpha = 0.035 + energy * 0.055 + bass * 0.015;

    const grad = ctx.createLinearGradient(x0, cy - baseRadius * 0.93, x0 + sway, cy - baseRadius - height);
    grad.addColorStop(0, `rgba(76, 92, 255, ${alpha * 0.70})`);
    grad.addColorStop(0.34, `rgba(124, 56, 255, ${alpha})`);
    grad.addColorStop(0.74, `rgba(188, 42, 255, ${alpha * 0.62})`);
    grad.addColorStop(1, 'rgba(115, 31, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.055 + energy * 0.022);
    ctx.shadowBlur = baseRadius * 0.11;
    ctx.shadowColor = 'rgba(123, 48, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x0, cy - baseRadius * 0.93);
    ctx.bezierCurveTo(
      x0 - sway * 0.5,
      cy - baseRadius * 1.01 - height * 0.24,
      x0 + sway * 0.8,
      cy - baseRadius * 1.02 - height * 0.62,
      x0 + sway,
      cy - baseRadius - height,
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
    { width: 16 + energy * 11, alpha: 0.040, blur: 28 },
    { width: 7.5 + energy * 6.0, alpha: 0.13, blur: 17 },
    { width: 2.8 + energy * 2.1, alpha: 0.56, blur: 9 },
    { width: 0.9 + energy * 0.75, alpha: 0.92, blur: 4 },
  ];

  for (const layer of layers) {
    const grad = ctx.createLinearGradient(cx, startY, cx + sway, endY);
    grad.addColorStop(0, `rgba(197, 105, 255, ${layer.alpha})`);
    grad.addColorStop(0.18, `rgba(94, 103, 255, ${layer.alpha})`);
    grad.addColorStop(0.53, `rgba(25, 152, 255, ${layer.alpha})`);
    grad.addColorStop(1, 'rgba(10, 91, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = layer.width;
    ctx.shadowBlur = layer.blur;
    ctx.shadowColor = 'rgba(34, 123, 255, 0.95)';
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

  // Fine split filaments make the tail look like plasma, not a single laser line.
  for (const side of [-1, 1]) {
    const split = side * baseRadius * (0.016 + bass * 0.012);
    ctx.strokeStyle = `rgba(92, 92, 255, ${0.05 + energy * 0.09})`;
    ctx.lineWidth = 0.9 + bass * 0.9;
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(95, 58, 255, 0.75)';
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
    Math.max(width, height) * 0.58,
  );
  glow.addColorStop(0, 'rgba(21, 7, 52, 0.14)');
  glow.addColorStop(0.48, 'rgba(8, 5, 29, 0.085)');
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

  // Large, soft violet aura outside the ring.
  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.72,
    cx, cy, baseRadius * (1.48 + visualEnergy * 0.06),
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.48, `rgba(31, 81, 255, ${0.025 + visualEnergy * 0.034})`);
  halo.addColorStop(0.66, `rgba(85, 44, 255, ${0.075 + visualEnergy * 0.070})`);
  halo.addColorStop(0.80, `rgba(157, 42, 255, ${0.070 + visualEnergy * 0.075})`);
  halo.addColorStop(0.92, `rgba(219, 54, 255, ${0.025 + visualEnergy * 0.035})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.52, 0, TAU);
  ctx.fill();

  // Broad smoky skins. These are intentionally translucent and slightly misaligned.
  const smokeAmp = 0.018 + treble * 0.008 + visualEnergy * 0.015;
  drawPlasmaBand(cx, cy, baseRadius * 1.050, {
    steps: 180,
    offset: 0.35,
    amplitude: smokeAmp * 1.70,
    speed: 1.45,
    color: `rgba(207, 48, 255, ${0.065 + visualEnergy * 0.080})`,
    widthPx: 17 + visualEnergy * 9,
    blurPx: 42 + visualEnergy * 20,
    audioAmount: 0.65,
    bloomAmount: 1.30,
  });
  drawPlasmaBand(cx, cy, baseRadius * 1.034, {
    steps: 190,
    offset: 2.10,
    amplitude: smokeAmp * 1.22,
    speed: 1.88,
    color: `rgba(123, 56, 255, ${0.11 + visualEnergy * 0.12})`,
    widthPx: 10 + visualEnergy * 6,
    blurPx: 31 + visualEnergy * 18,
    audioAmount: 0.78,
    bloomAmount: 1.08,
  });

  // Blue/violet body of the plasma ring.
  const bodyAmp = 0.010 + treble * 0.005 + visualEnergy * 0.008;
  drawPlasmaBand(cx, cy, baseRadius * 1.021, {
    steps: 220,
    offset: 1.20,
    amplitude: bodyAmp * 1.28,
    speed: 2.35,
    color: `rgba(126, 71, 255, ${0.30 + visualEnergy * 0.24})`,
    widthPx: 6.6 + visualEnergy * 3.3,
    blurPx: 24 + visualEnergy * 16,
    audioAmount: 0.90,
    bloomAmount: 0.82,
  });
  drawPlasmaBand(cx, cy, baseRadius * 1.010, {
    steps: 230,
    offset: 3.45,
    amplitude: bodyAmp * 0.90,
    speed: 2.85,
    color: `rgba(55, 128, 255, ${0.48 + visualEnergy * 0.30})`,
    widthPx: 4.2 + visualEnergy * 2.4,
    blurPx: 16 + visualEnergy * 12,
    audioAmount: 1.02,
    bloomAmount: 0.58,
  });

  // Cyan-white inner filament: the sharp luminous edge visible in the reference.
  drawPlasmaBand(cx, cy, baseRadius * 0.998, {
    steps: 250,
    offset: 5.10,
    amplitude: 0.0035 + treble * 0.0025 + visualEnergy * 0.0028,
    speed: 3.45,
    color: `rgba(98, 219, 255, ${0.78 + visualEnergy * 0.16})`,
    widthPx: 1.7 + visualEnergy * 1.0,
    blurPx: 9 + visualEnergy * 9,
    audioAmount: 0.82,
    bloomAmount: 0.20,
  });

  ctx.strokeStyle = `rgba(218, 244, 255, ${0.72 + visualEnergy * 0.22})`;
  ctx.lineWidth = 0.75 + visualEnergy * 0.60;
  ctx.shadowBlur = 6 + visualEnergy * 8;
  ctx.shadowColor = 'rgba(111, 213, 255, 1)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.994, 0, TAU);
  ctx.stroke();

  ctx.restore();

  // Flame-like haze rising from the upper arc, one of the strongest traits of the pasted reference.
  drawTopPlasmaWisps(cx, cy, baseRadius, visualEnergy, bass, treble);
  drawEnergyTail(cx, cy, baseRadius, visualEnergy, bass);

  // Cut the center back to black so the plasma hugs the circumference instead of filling the disc.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.958, 0, TAU);
  ctx.fill();

  const innerGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.80, cx, cy, baseRadius * 0.972);
  innerGlow.addColorStop(0, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(0.78, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(1, `rgba(18, 77, 150, ${0.095 + mid * 0.055})`);
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.972, 0, TAU);
  ctx.fill();
  ctx.restore();
};

drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
