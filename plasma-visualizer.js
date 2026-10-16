// Plasma Ultra: layered neon plasma contour with fast kick response.
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
  if (analyser.fftSize !== 512) {
    analyser.fftSize = 512;
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

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.55;
    smoothBass *= 0.60;
    smoothMid *= 0.62;
    smoothTreble *= 0.62;
    kickPunch *= 0.48;
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };
  }

  const bassNow = averageRange(28, 190);
  const kickNow = averageRange(42, 125);
  const midNow = averageRange(190, 2800);
  const trebleNow = averageRange(2800, 12500);
  const rms = rmsLevel();

  smoothBass = followValue(smoothBass, bassNow, 0.92, 0.20);
  smoothMid = followValue(smoothMid, midNow, 0.82, 0.18);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.84, 0.20);

  const kickRise = Math.max(0, kickNow - previousKickInput);
  const kickTransient = kickRise * 5.2;
  const kickWeight = Math.max(0, kickNow - 0.34) * 1.9;
  const kickTarget = clamp(kickTransient + kickWeight);
  kickPunch = followValue(kickPunch, kickTarget, 0.99, 0.13);
  previousKickInput = kickNow;

  const target = clamp(
    rms * 1.85 +
    smoothBass * 0.96 +
    smoothMid * 0.24 +
    smoothTreble * 0.14 +
    kickPunch * 0.24
  );
  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.93, 0.18);

  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy, kick: kickPunch };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function bandAtAngle(angle, bass, mid, treble) {
  const bassWeight = periodicPulse(angle, Math.PI * 0.50, 1.00);
  const trebleWeight = periodicPulse(angle, Math.PI * 1.50, 0.90);
  const midWeight = Math.min(1, periodicPulse(angle, 0, 0.92) + periodicPulse(angle, Math.PI, 0.92));
  return bass * bassWeight + mid * midWeight * 0.78 + treble * trebleWeight * 0.82;
}

function contourRadius(angle, baseRadius, signal, time) {
  const local = bandAtAngle(angle, signal.bass, signal.mid, signal.treble);
  const bassWeight = periodicPulse(angle, Math.PI * 0.50, 1.05);
  const slow =
    Math.sin(angle * 3.0 + time * 0.82) * 0.032 +
    Math.sin(angle * 5.0 - time * 0.50 + 0.8) * 0.020;
  const detail =
    Math.sin(angle * 9.0 + time * 1.10) * 0.009 +
    Math.sin(angle * 13.0 - time * 0.70) * 0.005;
  const music =
    local * 0.080 +
    signal.energy * 0.014 +
    (signal.kick || 0) * bassWeight * 0.205 +
    (signal.kick || 0) * 0.035;
  return baseRadius * (1 + slow + detail + music);
}

function buildContourPath(cx, cy, baseRadius, signal, time) {
  const count = 104;
  const points = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const r = contourRadius(angle, baseRadius, signal, time);
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

function makeContourGradient(cx, cy, time, alpha = 1) {
  if (typeof ctx.createConicGradient !== 'function') return `rgba(170,70,255,${alpha})`;
  const speed = getColorSpeed();
  const g = ctx.createConicGradient(time * 0.17 * speed - 0.75, cx, cy);
  g.addColorStop(0.00, `rgba(250,250,255,${alpha})`);
  g.addColorStop(0.12, `rgba(141,74,255,${alpha})`);
  g.addColorStop(0.28, `rgba(67,126,255,${alpha})`);
  g.addColorStop(0.44, `rgba(44,255,176,${alpha})`);
  g.addColorStop(0.60, `rgba(255,227,67,${alpha})`);
  g.addColorStop(0.75, `rgba(255,83,186,${alpha})`);
  g.addColorStop(0.90, `rgba(116,55,255,${alpha})`);
  g.addColorStop(1.00, `rgba(250,250,255,${alpha})`);
  return g;
}

function drawContourGlow(path, cx, cy, radius, signal, time) {
  const energy = Math.pow(clamp(signal.energy), 0.76);
  const kick = clamp(signal.kick || 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Layer 1: broad blue-violet atmosphere.
  ctx.strokeStyle = `rgba(72,106,255,${0.10 + energy * 0.10 + kick * 0.08})`;
  ctx.lineWidth = radius * (0.145 + energy * 0.035 + kick * 0.035);
  ctx.shadowBlur = radius * (0.15 + energy * 0.07 + kick * 0.06);
  ctx.shadowColor = 'rgba(70,90,255,0.55)';
  ctx.stroke(path);

  // Layer 2: concentrated purple plasma shell.
  ctx.strokeStyle = `rgba(173,54,255,${0.28 + energy * 0.24 + kick * 0.15})`;
  ctx.lineWidth = radius * (0.078 + energy * 0.018 + kick * 0.020);
  ctx.shadowBlur = radius * (0.080 + energy * 0.035 + kick * 0.040);
  ctx.shadowColor = 'rgba(180,46,255,0.78)';
  ctx.stroke(path);

  // Layer 3: animated chromatic plasma body.
  ctx.strokeStyle = makeContourGradient(cx, cy, time, 0.96);
  ctx.lineWidth = radius * (0.042 + energy * 0.012 + kick * 0.014);
  ctx.shadowBlur = radius * (0.050 + energy * 0.030 + kick * 0.035);
  ctx.shadowColor = 'rgba(134,72,255,0.82)';
  ctx.stroke(path);

  // Layer 4: hot white central core.
  ctx.strokeStyle = `rgba(255,255,255,${0.82 + energy * 0.14})`;
  ctx.lineWidth = radius * (0.010 + energy * 0.004 + kick * 0.003);
  ctx.shadowBlur = radius * (0.026 + energy * 0.024 + kick * 0.028);
  ctx.shadowColor = 'rgba(236,244,255,1)';
  ctx.stroke(path);
  ctx.restore();
}

function drawHotSpots(cx, cy, radius, signal, time) {
  const spots = [
    { angle: Math.PI * 1.45, color: [245, 248, 255], band: signal.treble },
    { angle: Math.PI * 0.88, color: [255, 224, 66], band: signal.mid },
    { angle: Math.PI * 0.05, color: [61, 229, 170], band: signal.mid },
    { angle: Math.PI * 0.43, color: [168, 65, 255], band: signal.bass + (signal.kick || 0) },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    const a = s.angle + Math.sin(time * 0.28 + i * 1.7) * 0.11;
    const r = contourRadius(a, radius, signal, time);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const strength = 0.24 + clamp(s.band) * 0.95 + signal.energy * 0.20;
    const size = radius * (0.075 + strength * 0.065);
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${0.38 + strength * 0.22})`);
    g.addColorStop(0.38, `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${0.17 + strength * 0.16})`);
    g.addColorStop(1, `rgba(${s.color[0]},${s.color[1]},${s.color[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
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
  const baseRadius = minSide * (0.282 + signal.bass * 0.006 + (signal.kick || 0) * 0.012);
  const path = buildContourPath(cx, cy, baseRadius, signal, contourClock);

  const haloRadius = baseRadius * (1.45 + signal.energy * 0.08 + (signal.kick || 0) * 0.10);
  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.70, cx, cy, haloRadius);
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.55, `rgba(58,42,170,${0.045 + signal.energy * 0.045})`);
  halo.addColorStop(0.78, `rgba(128,34,196,${0.040 + signal.energy * 0.045 + (signal.kick || 0) * 0.035})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloRadius, 0, TAU);
  ctx.fill();

  drawContourGlow(path, cx, cy, baseRadius, signal, contourClock);
  drawHotSpots(cx, cy, baseRadius, signal, contourClock);

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
    if (instrumentValue) instrumentValue.textContent = 'Plasma Ultra · ' + (audio.paused ? 'En pausa' : 'Reactivo');
    const notice = document.getElementById('visualNotice');
    if (notice) notice.textContent = 'Plasma Ultra · 4 capas · Kick Boost';
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
