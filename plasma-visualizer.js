// Plasma 22: restored v20 shape, diffuse glow, no ring lines, slow color cycle.
// Goals: larger graduated glow, low visual latency, time-cycling plasma colors,
// and clearly visible inner rings without hundreds of expensive shadowed strokes.

let plasmaPhase = 0;
let fastReactiveEnergy = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;

const originalEnsureAudioGraph = ensureAudioGraph;
ensureAudioGraph = function ensureFastAudioGraph() {
  const ok = originalEnsureAudioGraph();
  if (!ok || !analyser) return ok;

  // 512 is enough for the three visual bands and cuts analyser work/latency in half.
  if (analyser.fftSize !== 512) {
    analyser.fftSize = 512;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  analyser.smoothingTimeConstant = 0.025;
  return ok;
};

// The old canvas rendered at up to 2x DPR. On high-DPI phones that means ~4x pixels.
// Cap it lower so the animation stays fluid while remaining sharp on a phone screen.
resizeCanvas = function resizeCanvasForPlasma() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.30);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
};

paletteForFamily = function paletteForFamilyPlasmaRing() {
  return { h1: 205, h2: 248, h3: 286 };
};

function followValue(current, target, attack, release) {
  return current + (target - current) * (target > current ? attack : release);
}

function fastBeatSignal() {
  if (!analyser || !frequencyData || audio.paused) {
    fastReactiveEnergy *= 0.52;
    smoothBass *= 0.58;
    smoothMid *= 0.58;
    smoothTreble *= 0.58;
    return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy };
  }

  const bassNow = averageRange(32, 190);
  const midNow = averageRange(190, 2800);
  const trebleNow = averageRange(2800, 12500);
  const rms = rmsLevel();

  // Immediate attack, gentler release: follows hits without strobing between frames.
  smoothBass = followValue(smoothBass, bassNow, 0.94, 0.27);
  smoothMid = followValue(smoothMid, midNow, 0.91, 0.24);
  smoothTreble = followValue(smoothTreble, trebleNow, 0.93, 0.25);

  const target = clamp(
    rms * 2.08 +
    smoothBass * 0.82 +
    smoothMid * 0.30 +
    smoothTreble * 0.18
  );
  fastReactiveEnergy = followValue(fastReactiveEnergy, target, 0.95, 0.22);

  return { bass: smoothBass, mid: smoothMid, treble: smoothTreble, energy: fastReactiveEnergy };
}

function periodicPulse(angle, center, width) {
  const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-(d * d) / Math.max(0.0001, width * width));
}

function sectorSignals(angle, bass, mid, treble) {
  // 0 right, PI/2 bottom, PI left, 3PI/2 top.
  const bassWeight = periodicPulse(angle, Math.PI * 0.5, 1.02);
  const midWeight = Math.min(1,
    periodicPulse(angle, 0, 0.92) + periodicPulse(angle, Math.PI, 0.92)
  );
  const trebleWeight = periodicPulse(angle, Math.PI * 1.5, 0.90);
  return {
    bass: bass * bassWeight,
    mid: mid * midWeight,
    treble: treble * trebleWeight,
  };
}

function localEnergy(angle, bass, mid, treble, energy) {
  const s = sectorSignals(angle, bass, mid, treble);
  return clamp(s.bass * 1.06 + s.mid * 0.96 + s.treble * 1.03 + energy * 0.12);
}

const plasmaPalette = [
  [255, 116, 24],
  [255, 248, 226],
  [255, 220, 54],
  [190, 70, 255],
  [72, 236, 130],
  [62, 210, 255],
  [114, 78, 255],
];

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function plasmaColorAt(position) {
  const n = plasmaPalette.length;
  const wrapped = ((position % n) + n) % n;
  const i = Math.floor(wrapped);
  return mixColor(plasmaPalette[i], plasmaPalette[(i + 1) % n], wrapped - i);
}

function timeColor(angle, timeSeconds, speed = 0.055, offset = 0) {
  const around = (angle / TAU) * plasmaPalette.length;
  return plasmaColorAt(around + timeSeconds * 0.055 + offset);
}

function rgba(c, a) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function makeConicPlasma(cx, cy, startAngle, alpha = 1) {
  if (typeof ctx.createConicGradient !== 'function') return null;
  const grad = ctx.createConicGradient(startAngle, cx, cy);
  const n = plasmaPalette.length;
  for (let i = 0; i <= n; i += 1) {
    const c = plasmaPalette[i % n];
    grad.addColorStop(i / n, rgba(c, alpha));
  }
  return grad;
}

function drawGlobalHalo(cx, cy, baseRadius, energy, timeSeconds) {
  const bloom = Math.pow(clamp(energy), 0.88);
  const over = clamp((energy - 0.58) / 0.42);
  const outer = baseRadius * (1.62 + bloom * 0.16 + over * 0.08);
  const tint = timeColor(Math.PI * 1.5, timeSeconds, 0.10, 1.2);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.91, cx, cy, outer);
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.30, rgba(tint, 0.075 + bloom * 0.160));
  halo.addColorStop(0.52, rgba([102, 66, 255], 0.140 + bloom * 0.250));
  halo.addColorStop(0.72, rgba([184, 58, 255], 0.120 + bloom * 0.230));
  halo.addColorStop(0.88, rgba(tint, 0.045 + bloom * 0.120));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawReactiveBandArc(cx, cy, radius, start, end, strength, color, widthScale = 1) {
  if (strength <= 0.01) return;
  const boosted = Math.pow(clamp(strength), 0.78);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  ctx.strokeStyle = rgba(color, 0.10 + boosted * 0.18);
  ctx.lineWidth = (12 + boosted * 17) * widthScale;
  ctx.shadowBlur = 20 + boosted * 24;
  ctx.shadowColor = rgba(color, 0.65);
  ctx.beginPath();
  ctx.arc(cx, cy, radius + boosted * 2.0, start, end);
  ctx.stroke();

  ctx.strokeStyle = rgba(color, 0.28 + boosted * 0.38);
  ctx.lineWidth = (3.0 + boosted * 4.5) * widthScale;
  ctx.shadowBlur = 9 + boosted * 12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();
  ctx.restore();
}

function drawFrequencyBands(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds) {
  const bassColor = timeColor(Math.PI * 0.5, timeSeconds, 0.22, 0.0);
  const rightColor = timeColor(0, timeSeconds, 0.22, 1.4);
  const leftColor = timeColor(Math.PI, timeSeconds, 0.22, 3.0);
  const highColor = timeColor(Math.PI * 1.5, timeSeconds, 0.22, 4.7);

  const floor = energy * 0.18;
  drawReactiveBandArc(cx, cy, baseRadius * 1.036, 0.15 * Math.PI, 0.85 * Math.PI, bass + floor, bassColor, 1.05);
  drawReactiveBandArc(cx, cy, baseRadius * 1.030, -0.34 * Math.PI, 0.34 * Math.PI, mid + floor * 0.8, rightColor, 0.92);
  drawReactiveBandArc(cx, cy, baseRadius * 1.030, 0.66 * Math.PI, 1.34 * Math.PI, mid + floor * 0.8, leftColor, 0.92);
  drawReactiveBandArc(cx, cy, baseRadius * 1.034, 1.16 * Math.PI, 1.84 * Math.PI, treble + floor, highColor, 0.96);
}

function drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const count = 16;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const local = localEnergy(angle, bass, mid, treble, energy);
    const c = timeColor(angle, timeSeconds, 0.24, 2.2);
    const phase = timeSeconds * (1.55 + (i % 3) * 0.08) + i * 1.71;
    const irregular = 0.86 + Math.sin(phase * 0.74) * 0.14;
    const over = clamp((local - 0.52) / 0.48);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;
    const startR = baseRadius * 1.025;
    const length = baseRadius * (0.100 + local * 0.230 + over * 0.065) * irregular;
    const bend = Math.sin(phase * 0.70) * baseRadius * (0.004 + local * 0.011);

    const x0 = cx + nx * startR;
    const y0 = cy + ny * startR;
    const x1 = cx + nx * (startR + length);
    const y1 = cy + ny * (startR + length);

    const alpha = 0.140 + local * 0.300;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(250,244,255,${alpha * 0.58})`);
    grad.addColorStop(0.15, rgba(c, alpha));
    grad.addColorStop(0.46, rgba(c, alpha * 0.88));
    grad.addColorStop(0.72, `rgba(132,58,255,${alpha * 0.44})`);
    grad.addColorStop(0.90, `rgba(94,38,255,${alpha * 0.15})`);
    grad.addColorStop(1, 'rgba(74,26,255,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = baseRadius * (0.075 + local * 0.045);
    ctx.shadowBlur = baseRadius * (0.038 + local * 0.040);
    ctx.shadowColor = rgba(c, 0.62);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + nx * length * 0.26 + tx * bend,
      y0 + ny * length * 0.26 + ty * bend,
      x0 + nx * length * 0.69 - tx * bend * 0.35,
      y0 + ny * length * 0.69 - ty * bend * 0.35,
      x1,
      y1,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawInnerPlasmaRings(cx, cy, baseRadius, energy, timeSeconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const ringA = makeConicPlasma(cx, cy, timeSeconds * 0.85, 0.96);
  const ringB = makeConicPlasma(cx, cy, -timeSeconds * 0.58 + 1.8, 0.82);

  if (ringA && ringB) {
    ctx.strokeStyle = ringA;
    ctx.lineWidth = 3.0 + energy * 0.7;
    ctx.shadowBlur = 10 + energy * 6;
    ctx.shadowColor = 'rgba(140,90,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.962, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = ringB;
    ctx.lineWidth = 2.0 + energy * 0.45;
    ctx.shadowBlur = 7 + energy * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.925, 0, TAU);
    ctx.stroke();
  } else {
    const rings = [
      { radius: 0.962, width: 2.8, speed: 0.85, offset: 0 },
      { radius: 0.925, width: 1.9, speed: -0.58, offset: 2.2 },
    ];
    const segments = 24;
    const step = TAU / segments;
    for (const ring of rings) {
      for (let i = 0; i < segments; i += 1) {
        const angle = i * step;
        const c = timeColor(angle, timeSeconds, ring.speed, ring.offset);
        ctx.strokeStyle = rgba(c, 0.90);
        ctx.lineWidth = ring.width;
        ctx.shadowBlur = 5;
        ctx.shadowColor = rgba(c, 0.8);
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * ring.radius, angle - step * 0.58, angle + step * 0.58);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawMainCore(cx, cy, baseRadius, energy, timeSeconds) {
  const bloom = Math.pow(clamp(energy), 0.92);
  const over = clamp((energy - 0.60) / 0.40);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rimGradient = makeConicPlasma(cx, cy, timeSeconds * 0.36 + 0.6, 0.72);
  if (rimGradient) {
    ctx.strokeStyle = rimGradient;
  } else {
    const c = timeColor(Math.PI * 1.5, timeSeconds, 0.30, 1.0);
    ctx.strokeStyle = rgba(c, 0.65);
  }
  ctx.lineWidth = 3.4 + bloom * 1.5;
  ctx.shadowBlur = 14 + bloom * 13;
  ctx.shadowColor = 'rgba(162,82,255,0.82)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.018, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = `rgba(244,252,255,${0.82 + bloom * 0.16})`;
  ctx.lineWidth = 1.45 + bloom * 0.75;
  ctx.shadowBlur = 10 + bloom * 12 + over * 4;
  ctx.shadowColor = `rgba(110,222,255,${0.84 + bloom * 0.14})`;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.998, 0, TAU);
  ctx.stroke();

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
    Math.max(width, height) * 0.56,
  );
  glow.addColorStop(0, 'rgba(20,8,54,0.13)');
  glow.addColorStop(0.52, 'rgba(8,4,28,0.065)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
};

drawAurora = function drawPlasmaRing(width, height) {
  const fast = fastBeatSignal();
  const bass = fast.bass;
  const mid = fast.mid;
  const treble = fast.treble;
  const energy = fast.energy;
  const timeSeconds = plasmaClock;
  plasmaPhase = timeSeconds;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.273 + bass * 0.004 + energy * 0.002);

  drawGlobalHalo(cx, cy, baseRadius, energy, timeSeconds);

  drawFrequencyFlames(cx, cy, baseRadius, bass, mid, treble, energy, timeSeconds);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.885, 0, TAU);
  ctx.fill();
  ctx.restore();


};

drawBassWave = function drawPlasmaRingWave() {};
drawPendulum = function drawPlasmaRingPendulum() {};
drawSnareBolts = function drawPlasmaRingSnareBolts() {};
drawFamilyAccent = function drawPlasmaRingFamilyAccent() {};

 
// One bounded render loop; pause when hidden and throttle UI updates.
cancelAnimationFrame(animationFrame);
let plasmaLast = 0, plasmaUI = 0, plasmaClock = 0;
let plasmaSize = null;
const measurePlasma = resizeCanvas;
window.removeEventListener('resize', resizeCanvas);
resizeCanvas = function () { plasmaSize = null; return measurePlasma(); };
window.addEventListener('resize', () => { plasmaSize = null; });
if (window.ResizeObserver) new ResizeObserver(() => { plasmaSize = null; }).observe(canvas);
function plasmaFrame(now) {
  animationFrame = null;
  if (document.hidden) return;
  if (plasmaLast && now - plasmaLast < (audio.paused ? 65 : 30)) {
    animationFrame = requestAnimationFrame(plasmaFrame); return;
  }
  plasmaClock += Math.min(plasmaLast ? now - plasmaLast : 33, 100) / 1000;
  plasmaLast = now;
  if (!plasmaSize) plasmaSize = measurePlasma();
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);
  }
  drawBackground(plasmaSize.width, plasmaSize.height);
  drawAurora(plasmaSize.width, plasmaSize.height);
  if (now - plasmaUI > 160) {
    plasmaUI = now;
    bassValue.textContent = Math.round(smoothBass * 100);
    midValue.textContent = Math.round(smoothMid * 100);
    trebleValue.textContent = Math.round(smoothTreble * 100);
    if (instrumentValue) instrumentValue.textContent = 'Plasma 22 · ' + (audio.paused ? 'En pausa' : 'Intenso · color lento');
  }
  animationFrame = requestAnimationFrame(plasmaFrame);
}
document.addEventListener('visibilitychange', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null; plasmaLast = 0;
  if (!document.hidden) animationFrame = requestAnimationFrame(plasmaFrame);
});
animationFrame = requestAnimationFrame(plasmaFrame);
