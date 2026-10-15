const audioFile = document.getElementById('audioFile');
const audio = document.getElementById('audio');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const bassValue = document.getElementById('bassValue');
const midValue = document.getElementById('midValue');
const trebleValue = document.getElementById('trebleValue');
const instrumentValue = document.getElementById('instrumentValue');
const status = document.getElementById('status');

const TAU = Math.PI * 2;

let audioContext = null;
let analyser = null;
let source = null;
let frequencyData = null;
let timeData = null;
let currentObjectUrl = null;
let animationFrame = null;

let smoothedBass = 0;
let smoothedMid = 0;
let smoothedTreble = 0;
let smoothedEnergy = 0;
let previousRms = 0;
let previousKickBand = 0;
let previousSnareBand = 0;
let transientHold = 0;
let rotation = 0;
let auroraPhase = 0;

let detectedFamily = 'Escuchando…';
let familyConfidence = 0;
let familyStableFrames = 0;

let heldBassHz = 0;
let bassHoldFrames = 0;
let bassPulseEnergy = 0;
let bassPulseY = 0.58;
let bassPulsePhase = 0;
let bassChangedFlash = 0;

let pendulumSide = 1;
let pendulumAngle = 0;
let pendulumVelocity = 0;
let pendulumTarget = 0;
let pendulumEnergy = 0;
let lastKickAt = 0;
let kickTimes = [];
let kickBuild = 0;

let lastSnareAt = 0;
let snareSide = 1;
let snareBolts = [];

function ensureAudioGraph() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      status.textContent = 'Este navegador no admite Web Audio API.';
      return false;
    }

    audioContext = new AudioCtx();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.68;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);

    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  if (audioContext.state === 'suspended') audioContext.resume();
  return true;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function hzToBin(hz) {
  if (!audioContext || !frequencyData) return 0;
  const nyquist = audioContext.sampleRate / 2;
  return clamp(Math.round((hz / nyquist) * frequencyData.length), 0, frequencyData.length - 1);
}

function averageRange(minHz, maxHz) {
  if (!frequencyData) return 0;
  const start = hzToBin(minHz);
  const end = hzToBin(maxHz);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    sum += frequencyData[i];
    count += 1;
  }
  return count ? sum / count / 255 : 0;
}

function dominantFrequency(minHz, maxHz) {
  if (!audioContext || !frequencyData) return { hz: 0, strength: 0 };
  const start = hzToBin(minHz);
  const end = hzToBin(maxHz);
  let bestIndex = start;
  let best = 0;

  for (let i = start; i <= end; i += 1) {
    if (frequencyData[i] > best) {
      best = frequencyData[i];
      bestIndex = i;
    }
  }

  const nyquist = audioContext.sampleRate / 2;
  return {
    hz: (bestIndex / frequencyData.length) * nyquist,
    strength: best / 255,
  };
}

function rmsLevel() {
  if (!timeData) return 0;
  let sum = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const centered = (timeData[i] - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / timeData.length);
}

function spectralCentroidHz() {
  if (!audioContext || !frequencyData) return 0;
  const nyquist = audioContext.sampleRate / 2;
  let weighted = 0;
  let total = 0;

  for (let i = 1; i < frequencyData.length; i += 1) {
    const mag = frequencyData[i] / 255;
    if (mag < 0.01) continue;
    const hz = (i / frequencyData.length) * nyquist;
    weighted += hz * mag;
    total += mag;
  }

  return total ? weighted / total : 0;
}

function spectralFlatness(minHz = 80, maxHz = 12000) {
  if (!frequencyData) return 0;
  const start = hzToBin(minHz);
  const end = hzToBin(maxHz);
  let logSum = 0;
  let linearSum = 0;
  let count = 0;

  for (let i = start; i <= end; i += 1) {
    const mag = Math.max(1e-4, frequencyData[i] / 255);
    logSum += Math.log(mag);
    linearSum += mag;
    count += 1;
  }

  if (!count || linearSum <= 0) return 0;
  return clamp(Math.exp(logSum / count) / (linearSum / count));
}

function semitoneDistance(a, b) {
  if (a <= 0 || b <= 0) return 99;
  return Math.abs(12 * Math.log2(a / b));
}

function classifyTimbre({ bass, mid, treble, centroid, flatness, transient, rms }) {
  if (rms < 0.014) return { name: 'Silencio', confidence: 1 };

  const candidates = [];
  const add = (name, score) => candidates.push({ name, score: Math.max(0, score) });

  add('Bajo', bass * 1.9 + Math.max(0, (900 - centroid) / 900) * 0.65 - treble * 0.3);
  add('Percusión', transient * 4.4 + flatness * 0.9 + treble * 0.25 + rms * 0.4);
  add('Piano / teclas', transient * 2.0 + mid * 1.25 + Math.max(0, 0.48 - flatness) * 1.2 + (centroid > 500 && centroid < 4200 ? 0.34 : 0));
  add('Sintetizador / pad', mid * 1.15 + treble * 0.48 + Math.max(0, 0.50 - flatness) * 0.85 + Math.max(0, 0.07 - transient) * 2.1);
  add('Brillo / platillos', treble * 1.9 + Math.max(0, (centroid - 3500) / 5000) * 0.8 + flatness * 0.4);

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];
  const margin = Math.max(0, best.score - second.score);
  return { name: best.name, confidence: clamp(0.35 + margin * 0.6) };
}

function updateStableFamily(next) {
  if (next.name === detectedFamily) {
    familyStableFrames += 1;
    familyConfidence = lerp(familyConfidence, next.confidence, 0.16);
    return;
  }

  if (next.confidence > 0.5 || familyStableFrames > 20) {
    detectedFamily = next.name;
    familyConfidence = next.confidence;
    familyStableFrames = 0;
  } else {
    familyStableFrames += 1;
  }
}

function paletteForFamily(family, energy) {
  const base = {
    'Bajo': 205,
    'Percusión': 330,
    'Piano / teclas': 270,
    'Sintetizador / pad': 185,
    'Brillo / platillos': 210,
    'Silencio': 220,
  }[family] ?? 210;

  const shift = Math.sin(auroraPhase * 0.45) * (18 + energy * 26);
  return {
    h1: (base + shift + 360) % 360,
    h2: (base + 70 + shift * 0.65 + 360) % 360,
    h3: (base + 145 - shift * 0.35 + 360) % 360,
  };
}

function updateBassNote(bass, dominant) {
  const audible = bass > 0.05 && dominant.strength > 0.12 && dominant.hz >= 20 && dominant.hz <= 250;

  if (!audible) {
    bassHoldFrames = Math.max(0, bassHoldFrames - 2);
    bassPulseEnergy = lerp(bassPulseEnergy, 0, 0.12);
    bassChangedFlash *= 0.84;
    if (bassHoldFrames === 0) heldBassHz = 0;
    return;
  }

  if (!heldBassHz) {
    heldBassHz = dominant.hz;
    bassHoldFrames = 1;
    bassChangedFlash = 1;
  } else if (semitoneDistance(dominant.hz, heldBassHz) <= 0.55) {
    heldBassHz = lerp(heldBassHz, dominant.hz, 0.12);
    bassHoldFrames += 1;
  } else {
    heldBassHz = dominant.hz;
    bassHoldFrames = 1;
    bassChangedFlash = 1;
    bassPulsePhase = 0;
  }

  const normalized = clamp((heldBassHz - 20) / 230);
  bassPulseY = lerp(bassPulseY, 0.78 - normalized * 0.56, 0.18);
  bassPulseEnergy = lerp(bassPulseEnergy, Math.max(bass, dominant.strength), 0.25);
  bassChangedFlash *= 0.9;
}

function detectKick(now, bass, rms) {
  const kickBand = averageRange(42, 150);
  const bodyBand = averageRange(150, 260);
  const attack = kickBand - previousKickBand;
  previousKickBand = lerp(previousKickBand, kickBand, 0.44);

  const cooldownOk = now - lastKickAt > 115;
  const score = attack * 2.8 + kickBand * 0.78 + bass * 0.45 + rms * 0.22 - bodyBand * 0.16;

  if (cooldownOk && attack > 0.018 && score > 0.31) {
    pendulumSide *= -1;
    pendulumTarget = pendulumSide * (0.42 + clamp(score) * 0.34);
    pendulumVelocity += pendulumSide * (0.09 + clamp(score) * 0.13);
    pendulumEnergy = Math.max(pendulumEnergy, clamp(score * 1.25));
    lastKickAt = now;

    kickTimes.push(now);
    kickTimes = kickTimes.filter((time) => now - time < 2600);
  }

  if (kickTimes.length >= 2) {
    let intervalSum = 0;
    for (let i = 1; i < kickTimes.length; i += 1) intervalSum += kickTimes[i] - kickTimes[i - 1];
    const avgInterval = intervalSum / (kickTimes.length - 1);
    const density = clamp((700 - avgInterval) / 520);
    const repetition = clamp((kickTimes.length - 2) / 8);
    kickBuild = lerp(kickBuild, density * 0.65 + repetition * 0.35, 0.18);
  } else {
    kickBuild = lerp(kickBuild, 0, 0.08);
  }
}

function detectSnare(now) {
  const snareBand = averageRange(1600, 6500) * 0.72 + averageRange(250, 900) * 0.28;
  const attack = snareBand - previousSnareBand;
  previousSnareBand = lerp(previousSnareBand, snareBand, 0.4);

  if (now - lastSnareAt > 135 && attack > 0.022 && snareBand > 0.12) {
    snareSide *= -1;
    snareBolts.push({ side: snareSide, life: 1, strength: clamp(snareBand + attack * 2.8), seed: Math.random() * 1000 });
    if (snareBolts.length > 8) snareBolts.shift();
    lastSnareAt = now;
  }
}

function updatePendulum() {
  const spring = 0.12 + kickBuild * 0.1;
  const damping = 0.82 - kickBuild * 0.08;
  pendulumVelocity += (pendulumTarget - pendulumAngle) * spring;
  pendulumVelocity *= damping;
  pendulumAngle += pendulumVelocity;
  pendulumTarget *= 0.9;
  pendulumEnergy *= 0.92;
}

function drawBackground(width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
}

function drawAurora(width, height, energy, palette) {
  const layers = 5 + Math.round(energy * 5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let layer = 0; layer < layers; layer += 1) {
    const t = layer / Math.max(1, layers - 1);
    const hue = layer % 3 === 0 ? palette.h1 : layer % 3 === 1 ? palette.h2 : palette.h3;
    const yBase = height * (0.12 + t * 0.72) + Math.sin(auroraPhase * (0.7 + t) + layer * 1.7) * height * (0.025 + energy * 0.05);
    const amp = height * (0.018 + energy * 0.055) * (0.7 + t * 0.7);
    const alpha = 0.035 + energy * 0.10;

    ctx.beginPath();
    for (let i = 0; i <= 70; i += 1) {
      const x = (i / 70) * width;
      const wave = Math.sin(i * 0.24 + auroraPhase * (1.2 + t * 0.6) + layer) + Math.sin(i * 0.09 - auroraPhase * 0.8 + layer * 0.5) * 0.6;
      const y = yBase + wave * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = `hsla(${hue}, 95%, ${58 + energy * 18}%, ${alpha})`;
    ctx.lineWidth = 10 + energy * 42;
    ctx.shadowBlur = 28 + energy * 90;
    ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${0.35 + energy * 0.35})`;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBassWave(width, height, palette) {
  if (bassPulseEnergy < 0.012 || !heldBassHz) return;

  const yCenter = height * bassPulseY;
  const sustain = clamp(bassHoldFrames / 30);
  const span = 0.24 + sustain * 0.76;
  const startX = width * (0.5 - span / 2);
  const amplitude = 3 + bassPulseEnergy * 24;
  const cycles = 1.3 + (heldBassHz / 250) * 2.3;
  const alpha = 0.18 + bassPulseEnergy * 0.72;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let layer = 0; layer < 4; layer += 1) {
    ctx.beginPath();
    for (let i = 0; i <= 150; i += 1) {
      const t = i / 150;
      const x = startX + width * span * t;
      const collision = Math.sin(t * Math.PI) ** 1.45;
      const wobble = Math.sin(t * TAU * cycles + bassPulsePhase) * amplitude * collision * (1 + layer * 0.08);
      const vibration = Math.sin(t * TAU * cycles * 2.6 - bassPulsePhase * 0.5) * amplitude * 0.16 * (0.3 + sustain);
      const y = yCenter + wobble + vibration;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const hue = layer < 2 ? palette.h1 : palette.h2;
    ctx.strokeStyle = layer === 0 ? `rgba(255,255,255,${alpha})` : `hsla(${hue},100%,65%,${alpha / (layer + 0.7)})`;
    ctx.lineWidth = Math.max(1, 4.6 - layer * 0.95 + bassPulseEnergy * 3.5);
    ctx.shadowBlur = 20 + bassPulseEnergy * 58;
    ctx.shadowColor = `hsla(${hue},100%,62%,0.95)`;
    ctx.stroke();
  }

  if (bassChangedFlash > 0.04) {
    ctx.fillStyle = `rgba(255,255,255,${bassChangedFlash * 0.75})`;
    ctx.shadowBlur = 42;
    ctx.shadowColor = `hsla(${palette.h1},100%,65%,1)`;
    ctx.beginPath();
    ctx.arc(width * 0.5, yCenter, 2 + bassChangedFlash * 7, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawPendulum(width, height, palette) {
  if (pendulumEnergy < 0.015 && kickBuild < 0.02) return;

  const cx = width * 0.5;
  const cy = height * 0.48;
  const length = Math.min(width, height) * (0.25 + kickBuild * 0.05);
  const angle = pendulumAngle;
  const x = cx + Math.sin(angle) * length;
  const y = cy + Math.cos(angle) * length;
  const glow = 18 + pendulumEnergy * 70 + kickBuild * 55;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  ctx.strokeStyle = `hsla(${palette.h2},100%,70%,${0.11 + pendulumEnergy * 0.3})`;
  ctx.lineWidth = 1.2 + pendulumEnergy * 2;
  ctx.shadowBlur = glow * 0.55;
  ctx.shadowColor = `hsla(${palette.h2},100%,65%,0.9)`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x, y);
  ctx.stroke();

  const radius = 7 + pendulumEnergy * 16 + kickBuild * 9;
  const core = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.2, `hsla(${palette.h1},100%,75%,0.95)`);
  core.addColorStop(0.55, `hsla(${palette.h2},100%,58%,0.55)`);
  core.addColorStop(1, `hsla(${palette.h3},100%,55%,0)`);
  ctx.fillStyle = core;
  ctx.shadowBlur = glow;
  ctx.shadowColor = `hsla(${palette.h2},100%,60%,1)`;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.8, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function boltPoints(width, height, side, seed) {
  const points = [];
  const steps = 8;
  const startX = width * 0.5;
  const endX = side > 0 ? width * 0.88 : width * 0.12;
  const startY = height * 0.18;
  const endY = height * 0.82;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const zig = (i % 2 === 0 ? 1 : -1) * (16 + (seed % 17)) * (1 - Math.abs(0.5 - t));
    const x = lerp(startX, endX, t) + zig * side;
    const y = lerp(startY, endY, t) + Math.sin(seed + i * 2.1) * 10;
    points.push({ x, y });
  }

  return points;
}

function drawSnareBolts(width, height, palette) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  snareBolts = snareBolts.filter((bolt) => bolt.life > 0.02);
  for (const bolt of snareBolts) {
    const points = boltPoints(width, height, bolt.side, bolt.seed);
    const alpha = bolt.life;

    for (let layer = 0; layer < 3; layer += 1) {
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      const hue = layer === 0 ? palette.h1 : layer === 1 ? palette.h2 : palette.h3;
      ctx.strokeStyle = layer === 0 ? `rgba(255,255,255,${0.88 * alpha})` : `hsla(${hue},100%,66%,${0.5 * alpha / layer})`;
      ctx.lineWidth = layer === 0 ? 2.2 : 5 + layer * 4;
      ctx.shadowBlur = 16 + bolt.strength * 45 + layer * 10;
      ctx.shadowColor = `hsla(${hue},100%,64%,1)`;
      ctx.stroke();
    }

    const pulseX = bolt.side > 0 ? width * 0.72 : width * 0.28;
    const pulseY = height * 0.5;
    ctx.strokeStyle = `hsla(${palette.h2},100%,70%,${0.5 * alpha})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 25;
    ctx.shadowColor = `hsla(${palette.h2},100%,65%,1)`;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, 8 + (1 - alpha) * 34, 0, TAU);
    ctx.stroke();

    bolt.life *= 0.84;
  }

  ctx.restore();
}

function drawFamilyAccent(cx, cy, minSide, family, mid, treble, transient, palette) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (family === 'Piano / teclas') {
    const count = 12;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + rotation * 0.2;
      const radius = minSide * (0.16 + mid * 0.09);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.fillStyle = `hsla(${palette.h3},100%,72%,${0.08 + mid * 0.34})`;
      ctx.shadowBlur = 10 + mid * 24;
      ctx.shadowColor = `hsla(${palette.h3},100%,65%,1)`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + transient * 10, 0, TAU);
      ctx.fill();
    }
  } else if (family === 'Sintetizador / pad') {
    const width = minSide * 0.72;
    const amp = minSide * (0.025 + mid * 0.07);
    ctx.lineWidth = 1.6 + mid * 2.6;
    ctx.strokeStyle = `hsla(${palette.h1},100%,68%,${0.14 + mid * 0.55})`;
    ctx.shadowBlur = 16 + mid * 38;
    ctx.shadowColor = `hsla(${palette.h1},100%,62%,1)`;
    ctx.beginPath();
    for (let i = 0; i <= 100; i += 1) {
      const t = i / 100;
      const x = cx - width / 2 + width * t;
      const y = cy + Math.sin(t * TAU * 2 + auroraPhase * 1.4) * amp + Math.sin(t * TAU * 5 - auroraPhase) * amp * 0.3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (family === 'Brillo / platillos') {
    for (let i = 0; i < 42; i += 1) {
      const angle = (i / 42) * TAU + rotation * 0.4;
      const radius = minSide * (0.2 + (i % 7) * 0.012 + treble * 0.1);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.fillStyle = `hsla(${i % 2 ? palette.h2 : palette.h3},100%,78%,${0.05 + treble * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + treble * 2.6, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawIdle(width, height) {
  drawBackground(width, height);
  auroraPhase += 0.002;
  const palette = paletteForFamily('Silencio', 0.05);
  drawAurora(width, height, 0.06, palette);
}

function render() {
  const { width, height } = resizeCanvas();

  if (!analyser || audio.paused) {
    drawIdle(width, height);
    animationFrame = requestAnimationFrame(render);
    return;
  }

  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);

  const bass = averageRange(20, 250);
  const mid = averageRange(250, 4000);
  const treble = averageRange(4000, 16000);
  const dominantBass = dominantFrequency(20, 250);
  const rms = rmsLevel();
  const transient = Math.max(0, rms - previousRms);
  previousRms = lerp(previousRms, rms, 0.42);
  transientHold = Math.max(transientHold * 0.88, transient);

  const centroid = spectralCentroidHz();
  const flatness = spectralFlatness();

  smoothedBass = lerp(smoothedBass, bass, 0.22);
  smoothedMid = lerp(smoothedMid, mid, 0.18);
  smoothedTreble = lerp(smoothedTreble, treble, 0.16);

  const rawEnergy = clamp(rms * 1.8 + smoothedBass * 0.35 + smoothedMid * 0.25 + smoothedTreble * 0.18);
  smoothedEnergy = lerp(smoothedEnergy, rawEnergy, rawEnergy > smoothedEnergy ? 0.16 : 0.07);

  updateBassNote(smoothedBass, dominantBass);
  const now = performance.now();
  detectKick(now, smoothedBass, rms);
  detectSnare(now);
  updatePendulum();

  bassValue.textContent = Math.round(smoothedBass * 100);
  midValue.textContent = Math.round(smoothedMid * 100);
  trebleValue.textContent = Math.round(smoothedTreble * 100);

  const classification = classifyTimbre({
    bass: smoothedBass,
    mid: smoothedMid,
    treble: smoothedTreble,
    centroid,
    flatness,
    transient: transientHold,
    rms,
  });
  updateStableFamily(classification);

  const palette = paletteForFamily(detectedFamily, smoothedEnergy);
  const euphoria = clamp(smoothedEnergy * 0.78 + kickBuild * 0.42 + transientHold * 1.5);

  if (instrumentValue) {
    const confidence = detectedFamily === 'Silencio' ? '' : ` · ${Math.round(familyConfidence * 100)}%`;
    const bassNote = heldBassHz && bassHoldFrames > 0 ? ` · grave ${Math.round(heldBassHz)} Hz` : '';
    const intensity = euphoria > 0.68 ? ' · eufórico' : euphoria > 0.38 ? ' · intenso' : ' · suave';
    instrumentValue.textContent = `${detectedFamily}${confidence}${bassNote}${intensity}`;
  }

  rotation += 0.003 + smoothedTreble * 0.025;
  bassPulsePhase += 0.032 + smoothedBass * 0.12;
  auroraPhase += 0.004 + euphoria * 0.022;

  const minSide = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;

  drawBackground(width, height);
  drawAurora(width, height, euphoria, palette);
  drawBassWave(width, height, palette);
  drawPendulum(width, height, palette);
  drawSnareBolts(width, height, palette);
  drawFamilyAccent(cx, cy, minSide, detectedFamily, smoothedMid, smoothedTreble, transientHold, palette);

  animationFrame = requestAnimationFrame(render);
}

function resetVisualState() {
  heldBassHz = 0;
  bassHoldFrames = 0;
  bassPulseEnergy = 0;
  bassChangedFlash = 0;
  pendulumSide = 1;
  pendulumAngle = 0;
  pendulumVelocity = 0;
  pendulumTarget = 0;
  pendulumEnergy = 0;
  kickTimes = [];
  kickBuild = 0;
  snareBolts = [];
  snareSide = 1;
  lastKickAt = 0;
  lastSnareAt = 0;
}

audioFile.addEventListener('change', () => {
  const file = audioFile.files && audioFile.files[0];
  if (!file) return;

  if (!file.type.startsWith('audio/')) {
    status.textContent = 'Selecciona un archivo de audio válido.';
    audioFile.value = '';
    return;
  }

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = URL.createObjectURL(file);
  audio.src = currentObjectUrl;
  audio.load();
  resetVisualState();
  detectedFamily = 'Escuchando…';
  familyConfidence = 0;
  familyStableFrames = 0;
  status.textContent = `Lista: ${file.name}`;

  if (ensureAudioGraph()) {
    audio.play().then(() => {
      status.textContent = `Reproduciendo: ${file.name}`;
    }).catch(() => {
      status.textContent = `Lista: ${file.name}. Pulsa reproducir.`;
    });
  }
});

audio.addEventListener('play', () => {
  if (ensureAudioGraph()) {
    const file = audioFile.files && audioFile.files[0];
    status.textContent = file ? `Reproduciendo: ${file.name}` : 'Reproduciendo audio.';
  }
});

audio.addEventListener('pause', () => {
  if (!audio.ended && audio.currentTime > 0) status.textContent = 'Pausado.';
});

audio.addEventListener('ended', () => {
  status.textContent = 'La canción terminó.';
  bassValue.textContent = '0';
  midValue.textContent = '0';
  trebleValue.textContent = '0';
  if (instrumentValue) instrumentValue.textContent = 'Sin señal';
  resetVisualState();
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
});

resizeCanvas();
render();
