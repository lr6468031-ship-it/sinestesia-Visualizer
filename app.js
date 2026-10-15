const audioFile = document.getElementById('audioFile');
const audio = document.getElementById('audio');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const bassValue = document.getElementById('bassValue');
const midValue = document.getElementById('midValue');
const trebleValue = document.getElementById('trebleValue');
const status = document.getElementById('status');

let audioContext = null;
let analyser = null;
let source = null;
let frequencyData = null;
let currentObjectUrl = null;
let animationFrame = null;
let smoothedBass = 0;
let smoothedMid = 0;
let smoothedTreble = 0;
let rotation = 0;

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
    analyser.smoothingTimeConstant = 0.78;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

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

function averageRange(minHz, maxHz) {
  if (!audioContext || !analyser || !frequencyData) return 0;

  const nyquist = audioContext.sampleRate / 2;
  const binCount = frequencyData.length;
  const start = Math.max(0, Math.floor((minHz / nyquist) * binCount));
  const end = Math.min(binCount - 1, Math.ceil((maxHz / nyquist) * binCount));

  if (end < start) return 0;

  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    sum += frequencyData[i];
    count += 1;
  }
  return count ? sum / count / 255 : 0;
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function drawBackground(width, height, bass, mid, treble) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    20,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  gradient.addColorStop(0, `rgba(41, 52, 82, ${0.32 + bass * 0.28})`);
  gradient.addColorStop(0.48, `rgba(17, 22, 38, ${0.84 + mid * 0.10})`);
  gradient.addColorStop(1, 'rgba(5, 7, 13, 1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.min(width, height) * 0.45
  );
  glow.addColorStop(0, `rgba(117, 135, 255, ${0.05 + treble * 0.12})`);
  glow.addColorStop(1, 'rgba(117, 135, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawBassCore(cx, cy, minSide, bass) {
  const baseRadius = minSide * 0.095;
  const radius = baseRadius * (1 + bass * 1.15);

  ctx.save();
  ctx.shadowBlur = 30 + bass * 55;
  ctx.shadowColor = 'rgba(118, 128, 255, 0.65)';

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  core.addColorStop(0, 'rgba(245, 248, 255, 0.95)');
  core.addColorStop(0.24, 'rgba(159, 172, 255, 0.92)');
  core.addColorStop(0.72, 'rgba(92, 102, 220, 0.55)');
  core.addColorStop(1, 'rgba(61, 66, 160, 0.05)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.restore();

  return radius;
}

function drawMidRing(cx, cy, radius, mid, treble) {
  const points = 96;
  const amplitude = radius * (0.08 + mid * 0.42);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.35);
  ctx.lineWidth = 1.6 + mid * 2.4;
  ctx.strokeStyle = `rgba(130, 203, 255, ${0.38 + mid * 0.52})`;
  ctx.shadowBlur = 12 + mid * 24;
  ctx.shadowColor = 'rgba(93, 181, 255, 0.8)';
  ctx.beginPath();

  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const angle = t * TAU;
    const wave =
      Math.sin(angle * 5 + rotation * 2.2) * 0.52 +
      Math.sin(angle * 11 - rotation * 1.6) * 0.26 +
      Math.sin(angle * 17 + rotation) * 0.12;
    const pulse = radius + amplitude * wave * (0.35 + mid);
    const x = Math.cos(angle) * pulse;
    const y = Math.sin(angle) * pulse;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(202, 227, 255, ${0.12 + treble * 0.24})`;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (1.20 + treble * 0.10), 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawTrebleParticles(cx, cy, minSide, bass, mid, treble) {
  const particleCount = 64;
  const inner = minSide * 0.20;
  const spread = minSide * (0.13 + treble * 0.15);

  ctx.save();
  ctx.translate(cx, cy);

  for (let i = 0; i < particleCount; i += 1) {
    const seed = i * 12.9898;
    const angle = (i / particleCount) * TAU + rotation * (0.16 + (i % 7) * 0.008);
    const jitter = Math.sin(seed) * 0.5 + 0.5;
    const orbit = inner + spread * jitter + Math.sin(rotation * 1.7 + i) * mid * 8;
    const x = Math.cos(angle) * orbit;
    const y = Math.sin(angle) * orbit;
    const size = 0.8 + treble * 3.4 + (i % 5) * 0.14;
    const alpha = 0.16 + treble * 0.76;

    ctx.fillStyle = `rgba(${170 + (i % 3) * 20}, ${205 + (i % 4) * 10}, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }

  ctx.restore();

  if (bass > 0.42) {
    ctx.save();
    ctx.strokeStyle = `rgba(214, 224, 255, ${Math.min(0.42, bass * 0.34)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, minSide * (0.30 + bass * 0.10), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawIdle(width, height) {
  drawBackground(width, height, 0.08, 0.05, 0.03);
  const minSide = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  drawBassCore(cx, cy, minSide, 0.04);
  drawMidRing(cx, cy, minSide * 0.20, 0.04, 0.02);
  drawTrebleParticles(cx, cy, minSide, 0.02, 0.02, 0.03);
}

function render() {
  const { width, height } = resizeCanvas();

  if (!analyser || audio.paused) {
    drawIdle(width, height);
    animationFrame = requestAnimationFrame(render);
    return;
  }

  analyser.getByteFrequencyData(frequencyData);

  const bass = averageRange(20, 250);
  const mid = averageRange(250, 4000);
  const treble = averageRange(4000, 16000);

  smoothedBass = lerp(smoothedBass, bass, 0.22);
  smoothedMid = lerp(smoothedMid, mid, 0.18);
  smoothedTreble = lerp(smoothedTreble, treble, 0.16);

  bassValue.textContent = Math.round(smoothedBass * 100);
  midValue.textContent = Math.round(smoothedMid * 100);
  trebleValue.textContent = Math.round(smoothedTreble * 100);

  rotation += 0.004 + smoothedTreble * 0.025;

  const minSide = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;

  drawBackground(width, height, smoothedBass, smoothedMid, smoothedTreble);
  const coreRadius = drawBassCore(cx, cy, minSide, smoothedBass);
  drawMidRing(cx, cy, coreRadius * (1.75 + smoothedMid * 0.45), smoothedMid, smoothedTreble);
  drawTrebleParticles(cx, cy, minSide, smoothedBass, smoothedMid, smoothedTreble);

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
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
});

resizeCanvas();
render();
