// Plasma Ultra Contour: lightweight 2D organic neon outline.
// Tuned for mobile: black interior, warm/purple edge glow, no bottom waveform.

let fastReactiveEnergy = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
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
  analyser.smoothingTimeConstant = 0.035;
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

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.58;
    smoothBass *= 0.62;
    smoothMid *= 0.62;
    smoothTreble *= 0.62;
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy };
  }

  const bassNow = averageRange(32, 190);
  const midNow = averageRange(190, 2800);
  const trebleNow = averageRange(2800, 12500);
  const rms = rmsLevel();

  smoothBass = followValue(smoothBass, bassNow, 0.88, 0.24);
  smoothMid = followValue(smoothMid, midNow, 0.82, 0.20);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.84, 0.22);

  const target = clamp(
    rms * 1.88 +
    smoothBass * 0.88 +
    smoothMid * 0.28 +
    smoothTreble * 0.16
  );
  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.90, 0.20);

  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function bandAtAngle(angle, bass, mid, treble) {
  const bassWeight = periodicPulse(angle, Math.PI * 0.50, 1.00);
  const trebleWeight = periodicPulse(angle, Math.PI * 1.50, 0.90);
  const midWeight = Math.min(
    1,
    periodicPulse(angle, 0, 0.92) + periodicPulse(angle, Math.PI, 0.92)
  );
  return bass * bassWeight + mid * midWeight * 0.78 + treble * trebleWeight * 0.82;
}

function contourRadius(angle, baseRadius, signal, time) {
  const local = bandAtAngle(angle, signal.bass, signal.mid, signal.treble);

  const slow =
    Math.sin(angle * 3.0 + time * 0.70) * 0.030 +
    Math.sin(angle * 5.0 - time * 0.44 + 0.8) * 0.018;

  const detail =
    Math.sin(angle * 9.0 + time * 0.95) * 0.008 +
    Math.sin(angle * 13.0 - time * 0.58) * 0.004;

  const music = local * 0.070 + signal.energy * 0.012;
  return baseRadius * (1 + slow + detail + music);
}

function buildContourPath(cx, cy, baseRadius, signal, time) {
  const count = 96;
  const points = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const r = contourRadius(angle, baseRadius, signal, time);
    points[i] = {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  }

  const path = new Path2D();
  const first = points[0];
  const last = points[count - 1];
  path.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);

  for (let i = 0; i < count; i += 1) {
    const p = points[i];
    const next = points[(i + 1) % count];
    const mx = (p.x + next.x) * 0.5;
    const my = (p.y + next.y) * 0.5;
    path.quadraticCurveTo(p.x, p.y, mx, my);
  }
  path.closePath();
  return path;
}

function makeContourGradient(cx, cy, time, alpha = 1) {
  if (typeof ctx.createConicGradient !== 'function') {
    return `rgba(255,92,38,${alpha})`;
  }

  const g = ctx.createConicGradient(time * 0.055 - 0.75, cx, cy);
  g.addColorStop(0.00, `rgba(255,238,226,${alpha})`);
  g.addColorStop(0.10, `rgba(255,82,36,${alpha})`);
  g.addColorStop(0.27, `rgba(255,166,28,${alpha})`);
  g.addColorStop(0.43, `rgba(255,56,54,${alpha})`);
  g.addColorStop(0.63, `rgba(194,40,255,${alpha})`);
  g.addColorStop(0.80, `rgba(112,38,255,${alpha})`);
  g.addColorStop(0.94, `rgba(255,68,86,${alpha})`);
  g.addColorStop(1.00, `rgba(255,238,226,${alpha})`);
  return g;
}

function drawContourGlow(path, cx, cy, radius, signal, time) {
  const energy = Math.pow(clamp(signal.energy), 0.78);
  const gradient = makeContourGradient(cx, cy, time, 1);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Wide diffuse aura.
  ctx.strokeStyle = makeContourGradient(cx, cy, time, 0.12 + energy * 0.13);
  ctx.lineWidth = radius * (0.105 + energy * 0.040);
  ctx.shadowBlur = radius * (0.13 + energy * 0.07);
  ctx.shadowColor = 'rgba(255,46,92,0.38)';
  ctx.stroke(path);

  // Colored body of the contour.
  ctx.strokeStyle = gradient;
  ctx.lineWidth = radius * (0.036 + energy * 0.010);
  ctx.shadowBlur = radius * (0.050 + energy * 0.030);
  ctx.shadowColor = 'rgba(255,74,70,0.68)';
  ctx.stroke(path);

  // Hot white core line, kept thin so it reads like the reference contour.
  ctx.strokeStyle = `rgba(255,246,240,${0.72 + energy * 0.22})`;
  ctx.lineWidth = radius * (0.008 + energy * 0.004);
  ctx.shadowBlur = radius * (0.022 + energy * 0.020);
  ctx.shadowColor = 'rgba(255,210,188,0.95)';
  ctx.stroke(path);

  ctx.restore();
}

function drawHotSpots(path, cx, cy, radius, signal, time) {
  const spots = [
    { angle: Math.PI * 1.45, color: [255, 245, 233], band: signal.treble },
    { angle: Math.PI * 0.88, color: [255, 136, 28], band: signal.mid },
    { angle: Math.PI * 0.05, color: [255, 58, 54], band: signal.mid },
    { angle: Math.PI * 0.43, color: [182, 48, 255], band: signal.bass },
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    const a = s.angle + Math.sin(time * 0.22 + i * 1.7) * 0.10;
    const r = contourRadius(a, radius, signal, time);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const strength = 0.25 + clamp(s.band) * 0.85 + signal.energy * 0.22;
    const size = radius * (0.08 + strength * 0.06);
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${0.36 + strength * 0.20})`);
    g.addColorStop(0.35, `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${0.16 + strength * 0.16})`);
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
  const baseRadius = minSide * (0.285 + signal.bass * 0.006);

  const path = buildContourPath(cx, cy, baseRadius, signal, contourClock);

  // Soft ambient halo around the whole object, not a separate ring.
  const haloRadius = baseRadius * (1.42 + signal.energy * 0.08);
  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.72, cx, cy, haloRadius);
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.55, `rgba(74,12,38,${0.045 + signal.energy * 0.045})`);
  halo.addColorStop(0.78, `rgba(118,22,126,${0.032 + signal.energy * 0.040})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloRadius, 0, TAU);
  ctx.fill();

  drawContourGlow(path, cx, cy, baseRadius, signal, contourClock);
  drawHotSpots(path, cx, cy, baseRadius, signal, contourClock);

  // Force the center to stay deep black, as in the reference.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.fill(path);
  ctx.restore();
};

// Explicitly disabled: the reference contour has no blue line underneath.
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
if (window.ResizeObserver) {
  new ResizeObserver(() => { contourSize = null; }).observe(canvas);
}

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

  if (now - contourUI > 160) {
    contourUI = now;
    bassValue.textContent = Math.round(smoothBass * 100);
    midValue.textContent = Math.round(smoothMid * 100);
    trebleValue.textContent = Math.round(smoothTreble * 100);
    if (instrumentValue) {
      instrumentValue.textContent = (window.sinestesiaFluidActive ? 'Fluido 23 · ' : 'Plasma Contour · ') + (audio.paused ? 'En pausa' : 'Reactivo');
    }
    const notice = document.getElementById('visualNotice');
    if (notice && !window.sinestesiaFluidActive) notice.textContent = 'Plasma Ultra · Contour';
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
