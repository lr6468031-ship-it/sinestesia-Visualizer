// Blue/violet plasma ring skin for Sinestesia.
// Loaded after app.js so it replaces only the drawing layer.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;

// Keep the same visual design, but make the analyser respond faster to the beat.
const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureFastAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  if (analyser.fftSize !== 2048) {
    analyser.fftSize = 2048;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.16;
  return ok;
};

paletteForFamily = function paletteForFamilyPlasmaRing() {
  return { h1: 214, h2: 248, h3: 278 };
};

function plasmaNoise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function spectrumAt(progress) {
  if (!frequencyData || !frequencyData.length) return 0;
  const maxBin = Math.max(1, Math.floor(frequencyData.length * 0.28));
  const index = Math.min(maxBin - 1, Math.floor(progress * maxBin));
  return frequencyData[index] / 255;
}

function fastBeatSignal() {
  if (!analyser || !frequencyData) return { bass: 0, mid: 0, treble: 0, energy: 0 };

  const bass = averageRange(35, 180);
  const mid = averageRange(180, 2500);
  const treble = averageRange(2500, 12000);
  const rms = rmsLevel();
  const target = clamp(rms * 2.15 + bass * 0.72 + mid * 0.20 + treble * 0.08);

  // Very fast attack, gentler release: the ring hits on the beat without flickering.
  const amount = target > fastReactiveEnergy ? 0.82 : 0.20;
  fastReactiveEnergy += (target - fastReactiveEnergy) * amount;

  return { bass, mid, treble, energy: fastReactiveEnergy };
}

drawBackground = function drawPlasmaRingBackground(width, height) {
  const bg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.43,
    0,
    width * 0.5,
    height * 0.43,
    Math.max(width, height) * 0.74,
  );
  bg.addColorStop(0, '#03020b');
  bg.addColorStop(0.5, '#010106');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
};

drawAurora = function drawPlasmaRing(width, height, energy) {
  const fast = fastBeatSignal();
  const visualEnergy = Math.max(energy * 0.72, fast.energy);
  const bass = Math.max(smoothedBass || 0, fast.bass * 0.95);
  const mid = Math.max(smoothedMid || 0, fast.mid * 0.8);
  const treble = Math.max(smoothedTreble || 0, fast.treble * 0.85);

  plasmaPhase += 0.0035 + visualEnergy * 0.012;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.275 + bass * 0.014 + visualEnergy * 0.008);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const halo = ctx.createRadialGradient(
    cx,
    cy,
    baseRadius * 0.58,
    cx,
    cy,
    baseRadius * 1.46,
  );
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.42, 'rgba(0,0,0,0)');
  halo.addColorStop(0.64, `rgba(28, 67, 255, ${0.045 + visualEnergy * 0.05})`);
  halo.addColorStop(0.76, `rgba(83, 30, 255, ${0.11 + visualEnergy * 0.10})`);
  halo.addColorStop(0.86, `rgba(177, 45, 255, ${0.07 + visualEnergy * 0.08})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.48, 0, TAU);
  ctx.fill();

  // Same plasma look with fewer internal segments, reducing frame drops on mobile.
  const rayCount = 160;
  for (let i = 0; i < rayCount; i += 1) {
    const p = i / rayCount;
    const angle = p * TAU;
    const n1 = plasmaNoise(i * 1.731 + Math.floor(plasmaPhase * 22) * 0.07);
    const n2 = plasmaNoise(i * 4.117 + 9.2);
    const musical = spectrumAt(p);
    const wave = 0.5 + 0.5 * Math.sin(angle * 9 - plasmaPhase * 3.1 + i * 0.11);
    const spike = n2 > 0.88 ? (n2 - 0.88) * 3.8 : 0;
    const flame = baseRadius * (
      0.020
      + n1 * 0.045
      + wave * 0.018
      + musical * (0.045 + treble * 0.035)
      + spike * (0.05 + visualEnergy * 0.05)
    );
    const innerR = baseRadius * (0.985 + (n1 - 0.5) * 0.010);
    const outerR = innerR + flame;
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;

    const hue = 218 + 58 * (0.5 + 0.5 * Math.sin(angle * 1.7 + plasmaPhase));
    const alpha = 0.16 + visualEnergy * 0.16 + musical * 0.18;
    ctx.strokeStyle = `hsla(${hue},100%,70%,${alpha})`;
    ctx.lineWidth = 0.45 + n1 * 1.0 + visualEnergy * 0.65;
    ctx.shadowBlur = 5 + visualEnergy * 10;
    ctx.shadowColor = `hsla(${hue},100%,62%,0.8)`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(164, 71, 255, ${0.34 + visualEnergy * 0.18})`;
  ctx.lineWidth = 2.2 + visualEnergy * 1.8;
  ctx.shadowBlur = 34 + visualEnergy * 25;
  ctx.shadowColor = 'rgba(117, 43, 255, 0.95)';
  ctx.beginPath();
  const outerSteps = 220;
  for (let i = 0; i <= outerSteps; i += 1) {
    const p = i / outerSteps;
    const angle = p * TAU;
    const musical = spectrumAt(p);
    const wobble = Math.sin(angle * 13 + plasmaPhase * 1.7) * 0.0035
      + Math.sin(angle * 31 - plasmaPhase * 2.2) * 0.0018;
    const r = baseRadius * (1.018 + wobble + musical * 0.0055 * (0.4 + treble));
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  const coreGradient = ctx.createLinearGradient(cx - baseRadius, cy, cx + baseRadius, cy);
  coreGradient.addColorStop(0, 'rgba(43, 118, 255, 0.94)');
  coreGradient.addColorStop(0.28, 'rgba(96, 66, 255, 0.98)');
  coreGradient.addColorStop(0.55, 'rgba(35, 151, 255, 0.98)');
  coreGradient.addColorStop(0.80, 'rgba(126, 55, 255, 0.98)');
  coreGradient.addColorStop(1, 'rgba(41, 111, 255, 0.94)');
  ctx.strokeStyle = coreGradient;
  ctx.lineWidth = 1.35 + visualEnergy * 0.9;
  ctx.shadowBlur = 13 + visualEnergy * 15;
  ctx.shadowColor = 'rgba(55, 108, 255, 1)';
  ctx.beginPath();
  const coreSteps = 240;
  for (let i = 0; i <= coreSteps; i += 1) {
    const p = i / coreSteps;
    const angle = p * TAU;
    const musical = spectrumAt(p);
    const micro = Math.sin(angle * 17 + plasmaPhase * 2.0) * 0.0023
      + Math.sin(angle * 41 - plasmaPhase * 1.3) * 0.0013;
    const r = baseRadius * (1 + micro + musical * 0.0038 * (0.45 + mid));
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = `rgba(180, 221, 255, ${0.48 + visualEnergy * 0.22})`;
  ctx.lineWidth = 0.55 + visualEnergy * 0.35;
  ctx.shadowBlur = 6 + visualEnergy * 8;
  ctx.shadowColor = 'rgba(112, 172, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.998, 0, TAU);
  ctx.stroke();

  ctx.restore();
};

drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};
