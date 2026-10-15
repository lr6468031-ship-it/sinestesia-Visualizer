const audioFile = document.getElementById('audioFile');
const audio = document.getElementById('audio');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const bassValue = document.getElementById('bassValue');
const midValue = document.getElementById('midValue');
const trebleValue = document.getElementById('trebleValue');
const instrumentValue = document.getElementById('instrumentValue');
const status = document.getElementById('status');

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
let previousRms = 0;
let transientHold = 0;
let detectedFamily = 'Escuchando…';
let familyConfidence = 0;
let familyStableFrames = 0;
let rotation = 0;
let pulsePhase = 0;

const TAU = Math.PI * 2;

function ensureAudioGraph() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      status.textContent = 'Este navegador no admite Web Audio API.';
      return false;
    }

    audioContext = new AudioCtx();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);

    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

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

function hzToBin(hz) {
  if (!audioContext || !frequencyData) return 0;
  const nyquist = audioContext.sampleRate / 2;
  return Math.max(0, Math.min(frequencyData.length - 1, Math.round((hz / nyquist) * frequencyData.length)));
}

function averageRange(minHz, maxHz) {
  if (!audioContext || !frequencyData) return 0;

  const start = hzToBin(minHz);
  const end = hzToBin(maxHz);
  if (end < start) return 0;

  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    sum += frequencyData[i];
    count += 1;
  }
  return count ? sum / count / 255 : 0;
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
  let weighted = 0;
  let total = 0;
  const nyquist = audioContext.sampleRate / 2;

  for (let i = 1; i < frequencyData.length; i += 1) {
    const mag = frequencyData[i] / 255;
    if (mag < 0.01) continue;
    const hz = (i / frequencyData.length) * nyquist;
    weighted += hz * mag;
    total += mag;
  }

  return total > 0 ? weighted / total : 0;
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
  const geometric = Math.exp(logSum / count);
  const arithmetic = linearSum / count;
  return Math.max(0, Math.min(1, geometric / arithmetic));
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function classifyTimbre({ bass, mid, treble, centroid, flatness, transient, rms }) {
  const candidates = [];
  const add = (name, score) => candidates.push({ name, score: Math.max(0, score) });

  add('Bajo', bass * 1.9 + Math.max(0, (900 - centroid) / 900) * 0.7 - treble * 0.35);
  add('Percusión', transient * 4.2 + flatness * 0.9 + treble * 0.35 + rms * 0.35);
  add('Piano / teclas', transient * 2.2 + mid * 1.25 + Math.max(0, 0.45 - flatness) * 1.2 + (centroid > 500 && centroid < 4200 ? 0.35 : 0));
  add('Sintetizador / pad', mid * 1.15 + treble * 0.45 + Math.max(0, 0.48 - flatness) * 0.8 + Math.max(0, 0.08 - transient) * 2.0);
  add('Brillo / platillos', treble * 1.8 + Math.max(0, (centroid - 3500) / 5000) * 0.8 + flatness * 0.35);

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];
  const margin = Math.max(0, best.score - second.score);
  const confidence = Math.max(0, Math.min(1, 0.35 + margin * 0.6));

  if (rms < 0.015) return { name: 'Silencio', confidence: 1 };
  return { name: best.name, confidence };
}

function updateStableFamily(next) {
  if (next.name === detectedFamily) {
    familyStableFrames += 1;
    familyConfidence = lerp(familyConfidence, next.confidence, 0.16);
    return;
  }

  if (next.confidence > 0.48 || familyStableFrames > 22) {
    detectedFamily = next.name;
    familyConfidence = next.confidence;
    familyStableFrames = 0;
  } else {
    familyStableFrames += 1;
  }
}

function drawBackground(width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
}

function drawBassPulses(cx, cy, minSide, bass) {
  const base = minSide * 0.105;
  const coreRadius = base * (1 + bass * 0.5);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 3; i += 1) {
    const phase = (pulsePhase + i / 3) % 1;
    const radius = coreRadius + phase * minSide * (0.18 + bass * 0.12);
    const alpha = (1 - phase) * (0.12 + bass * 0.55);
    ctx.strokeStyle = `rgba(108, 142, 255, ${alpha})`;
    ctx.lineWidth = 1 + bass * 4 * (1 - phase);
    ctx.shadowBlur = 18 + bass * 34;
    ctx.shadowColor = 'rgba(82, 119, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 1.55);
  core.addColorStop(0, `rgba(232, 239, 255, ${0.58 + bass * 0.36})`);
  core.addColorStop(0.25, `rgba(110, 145, 255, ${0.38 + bass * 0.44})`);
  core.addColorStop(1, 'rgba(40, 61, 145, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 1.55, 0, TAU);
  ctx.fill();
  ctx.restore();

  return coreRadius;
}

function drawPianoSparks(cx, cy, minSide, intensity, transient) {
  const count = 14;
  const span = minSide * 0.64;
  const startX = cx - span / 2;
  const baseY = cy + minSide * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = startX + span * t;
    const wave = Math.sin(rotation * 3 + i * 1.7) * 0.5 + 0.5;
    const height = minSide * (0.05 + intensity * 0.20 + transient * 0.18) * (0.45 + wave * 0.7);
    const alpha = 0.12 + intensity * 0.65;
    const grad = ctx.createLinearGradient(x, baseY, x, baseY - height);
    grad.addColorStop(0, `rgba(255, 217, 142, ${alpha * 0.22})`);
    grad.addColorStop(0.55, `rgba(255, 236, 190, ${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2 + intensity * 2.4;
    ctx.shadowBlur = 10 + intensity * 24;
    ctx.shadowColor = 'rgba(255, 221, 160, 0.9)';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + Math.sin(i) * 3, baseY - height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSynthRibbon(cx, cy, minSide, intensity) {
  const width = minSide * 0.72;
  const amplitude = minSide * (0.035 + intensity * 0.09);
  const points = 90;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2 + intensity * 3;
  ctx.strokeStyle = `rgba(102, 229, 255, ${0.18 + intensity * 0.62})`;
  ctx.shadowBlur = 14 + intensity * 28;
  ctx.shadowColor = 'rgba(74, 205, 255, 0.95)';
  ctx.beginPath();

  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const x = cx - width / 2 + width * t;
    const y = cy + Math.sin(t * TAU * 2.2 + rotation * 2.1) * amplitude + Math.sin(t * TAU * 5.4 - rotation) * amplitude * 0.28;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPercussionFlash(cx, cy, minSide, intensity, transient) {
  const rays = 20;
  const inner = minSide * 0.13;
  const outerBase = minSide * (0.24 + transient * 0.18 + intensity * 0.08);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.16);

  for (let i = 0; i < rays; i += 1) {
    const a = (i / rays) * TAU;
    const flicker = 0.7 + 0.3 * Math.sin(i * 2.3 + rotation * 5);
    const outer = outerBase * flicker;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 + transient * 0.55})`;
    ctx.lineWidth = 0.8 + transient * 2.6;
    ctx.shadowBlur = 8 + transient * 18;
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrebleStars(cx, cy, minSide, treble) {
  const particleCount = 56;
  const inner = minSide * 0.22;
  const spread = minSide * (0.10 + treble * 0.17);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < particleCount; i += 1) {
    const angle = (i / particleCount) * TAU + rotation * (0.22 + (i % 5) * 0.012);
    const jitter = Math.sin(i * 12.9898) * 0.5 + 0.5;
    const orbit = inner + spread * jitter;
    const x = Math.cos(angle) * orbit;
    const y = Math.sin(angle) * orbit;
    const size = 0.6 + treble * 2.8 + (i % 4) * 0.1;
    const alpha = 0.08 + treble * 0.75;
    ctx.fillStyle = `rgba(205, 230, 255, ${alpha})`;
    ctx.shadowBlur = 4 + treble * 12;
    ctx.shadowColor = 'rgba(164, 214, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawFamilyVisual(cx, cy, minSide, family, mid, treble, transient) {
  if (family === 'Piano / teclas') {
    drawPianoSparks(cx, cy, minSide, mid, transient);
  } else if (family === 'Sintetizador / pad') {
    drawSynthRibbon(cx, cy, minSide, Math.max(mid, treble * 0.75));
  } else if (family === 'Percusión') {
    drawPercussionFlash(cx, cy, minSide, Math.max(mid, treble), transient);
  } else if (family === 'Brillo / platillos') {
    drawTrebleStars(cx, cy, minSide, Math.max(treble, 0.2));
  }
}

function drawIdle(width, height) {
  drawBackground(width, height);
  const minSide = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  drawBassPulses(cx, cy, minSide, 0.03);
  drawSynthRibbon(cx, cy, minSide, 0.05);
  drawTrebleStars(cx, cy, minSide, 0.03);
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
  const rms = rmsLevel();
  const transient = Math.max(0, rms - previousRms);
  previousRms = lerp(previousRms, rms, 0.42);
  transientHold = Math.max(transientHold * 0.88, transient);

  const centroid = spectralCentroidHz();
  const flatness = spectralFlatness();

  smoothedBass = lerp(smoothedBass, bass, 0.22);
  smoothedMid = lerp(smoothedMid, mid, 0.18);
  smoothedTreble = lerp(smoothedTreble, treble, 0.16);

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

  if (instrumentValue) {
    const confidence = detectedFamily === 'Silencio' ? '' : ` · ${Math.round(familyConfidence * 100)}%`;
    instrumentValue.textContent = `${detectedFamily}${confidence}`;
  }

  rotation += 0.003 + smoothedTreble * 0.024;
  pulsePhase = (pulsePhase + 0.006 + smoothedBass * 0.026) % 1;

  const minSide = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;

  drawBackground(width, height);
  drawBassPulses(cx, cy, minSide, smoothedBass);
  drawFamilyVisual(cx, cy, minSide, detectedFamily, smoothedMid, smoothedTreble, transientHold);

  if (smoothedTreble > 0.08) {
    drawTrebleStars(cx, cy, minSide, smoothedTreble * 0.78);
  }

  animationFrame = requestAnimationFrame(render);
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
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
});

resizeCanvas();
render();
