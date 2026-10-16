// Low-latency blue/violet plasma ring skin for Sinestesia.
// Loaded after app.js so it replaces only the drawing layer.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureLowLatencyAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  // Smaller FFT window + almost no analyser smoothing = much less visible lag.
  if (analyser.fftSize !== 1024) {
    analyser.fftSize = 1024;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.02;
  return ok;
};

paletteForFamily = function paletteForFamilyPlasmaRing() {
  return { h1: 214, h2: 248, h3: 278 };
};

function spectrumAt(progress) {
  if (!frequencyData || !frequencyData.length) return 0;
  const maxBin = Math.max(1, Math.floor(frequencyData.length * 0.32));
  const index = Math.min(maxBin - 1, Math.floor(progress * maxBin));
  return frequencyData[index] / 255;
}

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.55;
    return { bass: 0, mid: 0, treble: 0, energy: fastReactiveEnergy };
  }

  const bass = averageRange(35, 180);
  const mid = averageRange(180, 2500);
  const treble = averageRange(2500, 12000);
  const rms = rmsLevel();
  const target = clamp(rms * 2.35 + bass * 0.82 + mid * 0.16 + treble * 0.05);

  // Near-instant attack; short release so hits do not arrive late.
  const amount = target > fastReactiveEnergy ? 0.96 : 0.34;
  fastReactiveEnergy += (target - fastReactiveEnergy) * amount;

  return { bass, mid, treble, energy: fastReactiveEnergy };
}

function drawFluidLoop(cx, cy, baseRadius, steps, offset, amplitude, phaseScale, color, widthPx, blurPx) {
  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
  ctx.shadowBlur = blurPx;
  ctx.shadowColor = color;
  ctx.beginPath();

  for (let i = 0; i <= steps; i += 1) {
    const p = i / steps;
    const angle = p * TAU;
    const musical = spectrumAt(p);
    const wave =
      Math.sin(angle * 7 + plasmaPhase * phaseScale + offset) * 0.52 +
      Math.sin(angle * 13 - plasmaPhase * (phaseScale * 0.74) + offset * 1.7) * 0.31 +
      Math.sin(angle * 23 + plasmaPhase * (phaseScale * 0.41) - offset) * 0.17;

    const r = baseRadius * (
      1 +
      amplitude * wave +
      musical * amplitude * 0.95
    );

    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();
}

function drawEnergyTail(cx, cy, baseRadius, energy, bass) {
  const startY = cy + baseRadius * 0.96;
  const endY = startY + baseRadius * (0.92 + energy * 0.32);
  const sway = Math.sin(plasmaPhase * 3.1) * baseRadius * (0.035 + energy * 0.018);
  const bend = Math.sin(plasmaPhase * 1.7) * baseRadius * 0.055;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const layers = [
    { width: 20 + energy * 16, alpha: 0.07, blur: 28 },
    { width: 9 + energy * 8, alpha: 0.18, blur: 20 },
    { width: 3.2 + energy * 2.8, alpha: 0.72, blur: 12 },
    { width: 1.1 + energy * 0.8, alpha: 0.96, blur: 5 },
  ];

  for (const layer of layers) {
    const grad = ctx.createLinearGradient(cx, startY, cx + sway, endY);
    grad.addColorStop(0, `rgba(150, 92, 255, ${layer.alpha})`);
    grad.addColorStop(0.32, `rgba(55, 126, 255, ${layer.alpha})`);
    grad.addColorStop(0.72, `rgba(19, 99, 255, ${layer.alpha * 0.78})`);
    grad.addColorStop(1, 'rgba(10, 64, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = layer.width;
    ctx.shadowBlur = layer.blur;
    ctx.shadowColor = 'rgba(39, 103, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.bezierCurveTo(
      cx - bend,
      startY + baseRadius * 0.28,
      cx + sway + bend,
      startY + baseRadius * 0.58,
      cx + sway,
      endY,
    );
    ctx.stroke();
  }

  // Two very faint wisps keep the tail organic instead of looking like one straight bar.
  for (const side of [-1, 1]) {
    ctx.strokeStyle = `rgba(72, 87, 255, ${0.08 + energy * 0.07})`;
    ctx.lineWidth = 1.2 + bass * 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(92, 67, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(cx + side * baseRadius * 0.035, startY + baseRadius * 0.04);
    ctx.bezierCurveTo(
      cx + side * baseRadius * 0.11,
      startY + baseRadius * 0.30,
      cx + side * baseRadius * 0.05 + sway,
      startY + baseRadius * 0.56,
      cx + sway * 0.75,
      endY - baseRadius * 0.10,
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
  glow.addColorStop(0, 'rgba(20, 9, 56, 0.16)');
  glow.addColorStop(0.50, 'rgba(8, 5, 28, 0.10)');
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

  plasmaPhase += 0.0045 + visualEnergy * 0.020;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.275 + bass * 0.018 + visualEnergy * 0.010);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const halo = ctx.createRadialGradient(
    cx, cy, baseRadius * 0.76,
    cx, cy, baseRadius * (1.35 + visualEnergy * 0.08),
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.45, `rgba(38, 84, 255, ${0.05 + visualEnergy * 0.05})`);
  halo.addColorStop(0.68, `rgba(90, 42, 255, ${0.12 + visualEnergy * 0.11})`);
  halo.addColorStop(0.86, `rgba(191, 48, 255, ${0.07 + visualEnergy * 0.08})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.42, 0, TAU);
  ctx.fill();

  // Continuous plasma bands replace the old radial bars.
  const amp = 0.008 + treble * 0.006 + visualEnergy * 0.010;
  drawFluidLoop(
    cx, cy, baseRadius * 1.026, 210, 0.2, amp * 1.5, 2.2,
    `rgba(176, 67, 255, ${0.20 + visualEnergy * 0.20})`,
    5.2 + visualEnergy * 3.2,
    34 + visualEnergy * 24,
  );
  drawFluidLoop(
    cx, cy, baseRadius * 1.012, 220, 1.7, amp, 2.8,
    `rgba(91, 74, 255, ${0.42 + visualEnergy * 0.28})`,
    3.0 + visualEnergy * 2.0,
    22 + visualEnergy * 18,
  );
  drawFluidLoop(
    cx, cy, baseRadius, 240, 3.1, amp * 0.55, 3.4,
    `rgba(51, 151, 255, ${0.76 + visualEnergy * 0.18})`,
    1.8 + visualEnergy * 1.3,
    14 + visualEnergy * 12,
  );

  // Bright electric core.
  ctx.strokeStyle = `rgba(196, 232, 255, ${0.62 + visualEnergy * 0.28})`;
  ctx.lineWidth = 0.8 + visualEnergy * 0.7;
  ctx.shadowBlur = 7 + visualEnergy * 10;
  ctx.shadowColor = 'rgba(107, 180, 255, 1)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.995, 0, TAU);
  ctx.stroke();

  // Stronger lower arc like the reference image.
  ctx.strokeStyle = `rgba(76, 153, 255, ${0.36 + visualEnergy * 0.42})`;
  ctx.lineWidth = 3.6 + bass * 3.2 + visualEnergy * 2.4;
  ctx.shadowBlur = 20 + visualEnergy * 22;
  ctx.shadowColor = 'rgba(42, 113, 255, 1)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.005, Math.PI * 0.22, Math.PI * 0.78);
  ctx.stroke();

  ctx.restore();

  drawEnergyTail(cx, cy, baseRadius, visualEnergy, bass);

  // Repaint the center so it stays clean and black.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.955, 0, TAU);
  ctx.fill();

  const innerGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.82, cx, cy, baseRadius * 0.97);
  innerGlow.addColorStop(0, 'rgba(0,0,0,0)');
  innerGlow.addColorStop(1, `rgba(20, 49, 125, ${0.11 + mid * 0.06})`);
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.97, 0, TAU);
  ctx.fill();
  ctx.restore();
};

drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
