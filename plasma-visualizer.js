// Plasma Ultra: stable layered plasma ring with tapered flame rays and travelling pulse.
let fastReactiveEnergy = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let kickPunch = 0;
let previousKickInput = 0;
let contourClock = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureFastAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;
  if (analyser.fftSize !== 4096) {
    analyser.fftSize = 4096;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.025;
  return ok;
};

resizeCanvas = function resizeCanvasForContour() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.22);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
};

function followValue(current, target, attack, release) {
  return current + (target - current) * (target > current ? attack : release);
}

function getColorSpeed() {
  const slider = document.getElementById('colorSpeed');
  const value = slider ? Number(slider.value) : 1.6;
  return Number.isFinite(value) ? Math.max(0.2, Math.min(4, value)) : 1.6;
}

// Separate FFT bins at the band boundaries; retain narrow musical notes as well as broadband energy.
function reactiveBandLevel(minHz, maxHz) {
  const binHz = audioContext.sampleRate / analyser.fftSize;
  const start = Math.max(1, Math.ceil(minHz / binHz));
  const end = Math.min(frequencyData.length, Math.ceil(maxHz / binHz));
  let squares = 0, peak = 0;
  for (let i = start; i < end; i += 1) {
    const value = frequencyData[i] / 255;
    squares += value * value;
    peak = Math.max(peak, value);
  }
  const level = Math.sqrt(squares / Math.max(1, end - start)) * 0.65 + peak * 0.35;
  return clamp((level - 0.025) / 0.70);
}

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.55;
    smoothBass *= 0.60;
    smoothMid *= 0.62;
    smoothTreble *= 0.62;
    kickPunch *= 0.45;
    previousKickInput = 0;
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };
  }

  const bassNow = reactiveBandLevel(25, 250);
  const kickNow = reactiveBandLevel(35, 125);
  const midNow = reactiveBandLevel(250, 4000);
  const trebleNow = reactiveBandLevel(4000, 16000);
  const rms = rmsLevel();

  smoothBass = followValue(smoothBass, bassNow, 0.93, 0.20);
  smoothMid = followValue(smoothMid, midNow, 0.82, 0.18);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.84, 0.20);

  const kickRise = Math.max(0, kickNow - previousKickInput);
  const kickTransient = kickRise * 6.2;
  const kickWeight = Math.max(0, kickNow - 0.30) * 2.0;
  const kickTarget = clamp(kickTransient + kickWeight);
  kickPunch = followValue(kickPunch, kickTarget, 0.995, 0.11);
  previousKickInput = kickNow;

  const target = clamp(
    rms * 1.75 + smoothBass * 0.92 + smoothMid * 0.22 + smoothTreble * 0.13 + kickPunch * 0.30
  );
  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.94, 0.18);

  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };
}

function fixedContourRadius(angle, baseRadius, signal) {
  // Keep the silhouette firm: no time-based worm motion.
  const fixedShape =
    Math.sin(angle * 3.0 + 0.45) * 0.012 +
    Math.sin(angle * 5.0 - 0.85) * 0.007 +
    Math.sin(angle * 9.0 + 1.4) * 0.003;
  const bassBulge = Math.max(0, Math.sin(angle)) * (signal.bass * 0.015 + (signal.kick || 0) * 0.020);
  return baseRadius * (1 + fixedShape + bassBulge);
}

function buildContourPath(cx, cy, baseRadius, signal) {
  const count = 128;
  const points = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const r = fixedContourRadius(angle, baseRadius, signal);
    points[i] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }
  const path = new Path2D();
  const first = points[0];
  const last = points[count - 1];
  path.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);
  for (let i = 0; i < count; i += 1) {
    const p = points[i];
    const next = points[(i + 1) % count];
    path.quadraticCurveTo(p.x, p.y, (p.x + next.x) * 0.5, (p.y + next.y) * 0.5);
  }
  path.closePath();
  return path;
}

function colorAtPhase(phase, alpha = 1) {
  const hue = ((phase % 1) + 1) % 1;
  const stops = [
    [0.00, [240, 247, 255]],
    [0.14, [132, 72, 255]],
    [0.30, [67, 126, 255]],
    [0.46, [48, 246, 177]],
    [0.62, [255, 226, 61]],
    [0.78, [255, 78, 184]],
    [0.92, [116, 51, 255]],
    [1.00, [240, 247, 255]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (hue >= stops[i][0] && hue <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const span = Math.max(0.0001, b[0] - a[0]);
  const t = (hue - a[0]) / span;
  const rgb = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * t));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function makeContourGradient(cx, cy, time, alpha = 1) {
  if (typeof ctx.createConicGradient !== 'function') return colorAtPhase(time * 0.18 * getColorSpeed(), alpha);
  const phase = time * 0.23 * getColorSpeed();
  const g = ctx.createConicGradient(phase * TAU - 0.75, cx, cy);
  const colors = [
    [0.00, [246,249,255]], [0.12, [140,73,255]], [0.28, [67,126,255]],
    [0.44, [47,245,176]], [0.60, [255,227,66]], [0.76, [255,79,188]],
    [0.90, [119,54,255]], [1.00, [246,249,255]],
  ];
  colors.forEach(([p, c]) => g.addColorStop(p, `rgba(${c[0]},${c[1]},${c[2]},${alpha})`));
  return g;
}

function drawLayeredRing(path, cx, cy, radius, signal, time) {
  const energy = Math.pow(clamp(signal.energy), 0.78);
  const kick = clamp(signal.kick || 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Four clearly separated light layers.
  ctx.strokeStyle = `rgba(45,78,255,${0.10 + energy * 0.10})`;
  ctx.lineWidth = radius * (0.155 + kick * 0.020);
  ctx.shadowBlur = radius * (0.17 + energy * 0.06);
  ctx.shadowColor = 'rgba(60,76,255,0.58)';
  ctx.stroke(path);

  ctx.strokeStyle = `rgba(166,54,255,${0.28 + energy * 0.22 + kick * 0.12})`;
  ctx.lineWidth = radius * (0.092 + kick * 0.014);
  ctx.shadowBlur = radius * (0.095 + energy * 0.035);
  ctx.shadowColor = 'rgba(180,46,255,0.82)';
  ctx.stroke(path);

  ctx.strokeStyle = makeContourGradient(cx, cy, time, 0.98);
  ctx.lineWidth = radius * (0.050 + kick * 0.010);
  ctx.shadowBlur = radius * (0.060 + energy * 0.030);
  ctx.shadowColor = 'rgba(122,86,255,0.88)';
  ctx.stroke(path);

  ctx.strokeStyle = `rgba(255,255,255,${0.88 + energy * 0.10})`;
  ctx.lineWidth = radius * (0.011 + kick * 0.0025);
  ctx.shadowBlur = radius * (0.030 + kick * 0.022);
  ctx.shadowColor = 'rgba(245,249,255,1)';
  ctx.stroke(path);
  ctx.restore();
}

function drawFlameRay(cx, cy, radius, angle, length, width, phase, alpha, kickBoost = 0) {
  const r0 = radius * 0.99;
  const r1 = radius + length;
  const x0 = cx + Math.cos(angle) * r0;
  const y0 = cy + Math.sin(angle) * r0;
  const x1 = cx + Math.cos(angle) * r1;
  const y1 = cy + Math.sin(angle) * r1;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const baseColor = colorAtPhase(phase, alpha);
  const hotColor = colorAtPhase(phase + 0.025, Math.min(1, alpha + 0.28));
  g.addColorStop(0.00, hotColor);
  g.addColorStop(0.18, baseColor);
  g.addColorStop(0.62, colorAtPhase(phase, alpha * 0.34));
  g.addColorStop(1.00, colorAtPhase(phase, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = width * (1 + kickBoost * 0.55);
  ctx.shadowBlur = width * (1.8 + kickBoost * 1.4);
  ctx.shadowColor = colorAtPhase(phase, 0.78);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawFlameField(cx, cy, radius, signal, time) {
  const energy = clamp(signal.energy);
  const kick = clamp(signal.kick || 0);
  const colorPhase = time * 0.23 * getColorSpeed();
  const count = 38;
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + 0.021 * Math.sin(i * 2.7);
    const seed = 0.5 + 0.5 * Math.sin(i * 12.9898 + 2.37);
    const seed2 = 0.5 + 0.5 * Math.sin(i * 5.398 + 1.17);
    // Rays stay in place; only brightness/length breathes with music, not position.
    const tallBias = 0.38 + seed * 0.95;
    const localEnergy = energy * (0.45 + seed2 * 0.65) + kick * (0.30 + seed * 0.60);
    const length = radius * (0.05 + tallBias * 0.18 + localEnergy * 0.13);
    const width = radius * (0.008 + seed2 * 0.010);
    const alpha = 0.15 + energy * 0.14 + seed * 0.14 + kick * 0.12;
    drawFlameRay(cx, cy, radius, angle, length, width, colorPhase + i / count, alpha, kick);
  }
  ctx.restore();
}

function drawTravellingPulse(cx, cy, radius, signal, time) {
  const speed = 0.55;
  const angle = (time * speed) % TAU;
  const pulseStrength = 0.28 + clamp(signal.energy) * 0.42 + clamp(signal.kick || 0) * 0.55;

  // Bright pulse on second layer.
  const arcRadius = radius * 1.015;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const phase = time * 0.23 * getColorSpeed() + angle / TAU;
  ctx.strokeStyle = colorAtPhase(phase, 0.72 + pulseStrength * 0.25);
  ctx.lineWidth = radius * (0.040 + pulseStrength * 0.018);
  ctx.shadowBlur = radius * (0.070 + pulseStrength * 0.045);
  ctx.shadowColor = colorAtPhase(phase, 0.95);
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, angle - 0.12, angle + 0.12);
  ctx.stroke();
  ctx.restore();

  // Matching flame: intense at the ring, fading outward.
  const flameLength = radius * (0.16 + pulseStrength * 0.18);
  const flameWidth = radius * (0.022 + pulseStrength * 0.012);
  drawFlameRay(cx, cy, radius * 1.01, angle, flameLength, flameWidth, phase, 0.62 + pulseStrength * 0.22, pulseStrength);
}

function drawHotSpots(cx, cy, radius, signal, time) {
  const phase = time * 0.23 * getColorSpeed();
  const spots = [0.10, 0.31, 0.56, 0.78];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  spots.forEach((p, i) => {
    const a = p * TAU;
    const r = fixedContourRadius(a, radius, signal);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const strength = 0.20 + signal.energy * 0.30 + (i === 2 ? (signal.kick || 0) * 0.42 : 0);
    const size = radius * (0.055 + strength * 0.055);
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, colorAtPhase(phase + p, 0.46 + strength * 0.26));
    g.addColorStop(0.42, colorAtPhase(phase + p, 0.18 + strength * 0.12));
    g.addColorStop(1, colorAtPhase(phase + p, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

drawBackground = function drawContourBackground(width, height) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
};

drawAurora = function drawPlasmaContour(width, height) {
  const signal = fastBeatSignal();
  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.282 + signal.bass * 0.004 + (signal.kick || 0) * 0.006);
  const path = buildContourPath(cx, cy, baseRadius, signal);

  const haloRadius = baseRadius * (1.46 + signal.energy * 0.06);
  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.75, cx, cy, haloRadius);
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.56, `rgba(54,48,170,${0.035 + signal.energy * 0.040})`);
  halo.addColorStop(0.80, `rgba(128,34,196,${0.035 + signal.energy * 0.042})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloRadius, 0, TAU);
  ctx.fill();

  drawFlameField(cx, cy, baseRadius, signal, contourClock);
  drawLayeredRing(path, cx, cy, baseRadius, signal, contourClock);
  drawTravellingPulse(cx, cy, baseRadius, signal, contourClock);
  drawHotSpots(cx, cy, baseRadius, signal, contourClock);

  // Keep the center deep black.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.fill(path);
  ctx.restore();
};

drawBassWave = function drawNoBottomWave() {};
drawPendulum = function drawNoPendulum() {};
drawSnareBolts = function drawNoSnareBolts() {};
drawFamilyAccent = function drawNoFamilyAccent() {};

cancelAnimationFrame(animationFrame);
let contourLast = 0;
let contourUI = 0;
let contourSize = null;
const measureContour = resizeCanvas;
window.removeEventListener('resize', resizeCanvas);
resizeCanvas = function () {
  contourSize = null;
  return measureContour();
};
window.addEventListener('resize', () => { contourSize = null; });
if (window.ResizeObserver) new ResizeObserver(() => { contourSize = null; }).observe(canvas);

function contourFrame(now) {
  animationFrame = null;
  if (document.hidden) return;
  const targetFrameMs = audio.paused ? 66 : 24;
  if (contourLast && now - contourLast < targetFrameMs) {
    animationFrame = requestAnimationFrame(contourFrame);
    return;
  }
  const delta = Math.min(contourLast ? now - contourLast : 24, 80);
  contourClock += delta / 1000;
  contourLast = now;
  if (!contourSize) contourSize = measureContour();

  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);
  }

  drawBackground(contourSize.width, contourSize.height);
  drawAurora(contourSize.width, contourSize.height);

  if (now - contourUI > 150) {
    contourUI = now;
    bassValue.textContent = Math.round(smoothBass * 100);
    midValue.textContent = Math.round(smoothMid * 100);
    trebleValue.textContent = Math.round(smoothTreble * 100);
    if (instrumentValue) instrumentValue.textContent = 'Fusión · Graves / Medios / Agudos';
    const notice = document.getElementById('visualNotice');
    if (notice) notice.textContent = 'Magenta: graves · Cian: medios · Dorado: agudos';
  }

  animationFrame = requestAnimationFrame(contourFrame);
}

document.addEventListener('visibilitychange', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  contourLast = 0;
  if (!document.hidden) animationFrame = requestAnimationFrame(contourFrame);
});

animationFrame = requestAnimationFrame(contourFrame);
