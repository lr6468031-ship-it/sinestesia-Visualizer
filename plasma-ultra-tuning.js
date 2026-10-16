// Final visual tuning: wide diffuse plasma rays using only the core plasma palette.

function tunedRingPath(cx, cy, radius, signal, scale) {
  return buildContourPath(cx, cy, radius * scale, signal);
}

// Restricted plasma palette: white-hot core -> violet -> electric blue.
// Deliberately excludes green, yellow and rainbow/LED cycling.
function plasmaColorAtPhase(phase, alpha = 1) {
  const hue = ((phase % 1) + 1) % 1;
  const stops = [
    [0.00, [247, 250, 255]],
    [0.18, [205, 180, 255]],
    [0.38, [177, 64, 255]],
    [0.62, [92, 82, 255]],
    [0.82, [55, 105, 255]],
    [1.00, [247, 250, 255]],
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

function makePlasmaGradient(cx, cy, time, alpha = 1) {
  if (typeof ctx.createConicGradient !== 'function') return plasmaColorAtPhase(time * 0.10, alpha);
  const phase = time * 0.09;
  const g = ctx.createConicGradient(phase * TAU - 0.75, cx, cy);
  const colors = [
    [0.00, [247,250,255]], [0.18, [205,180,255]], [0.38, [177,64,255]],
    [0.62, [92,82,255]], [0.82, [55,105,255]], [1.00, [247,250,255]],
  ];
  colors.forEach(([p, c]) => g.addColorStop(p, `rgba(${c[0]},${c[1]},${c[2]},${alpha})`));
  return g;
}

drawLayeredRing = function drawLayeredRingTuned(path, cx, cy, radius, signal, time) {
  const energy = Math.pow(clamp(signal.energy), 0.78);
  const kick = clamp(signal.kick || 0);
  const outerPath = tunedRingPath(cx, cy, radius, signal, 1.045);
  const violetPath = tunedRingPath(cx, cy, radius, signal, 1.025);
  const colorPath = tunedRingPath(cx, cy, radius, signal, 1.008);
  const corePath = tunedRingPath(cx, cy, radius, signal, 0.994);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = `rgba(55,86,255,${0.16 + energy * 0.12})`;
  ctx.lineWidth = radius * (0.038 + kick * 0.006);
  ctx.shadowBlur = radius * (0.100 + energy * 0.040);
  ctx.shadowColor = 'rgba(62,82,255,0.82)';
  ctx.stroke(outerPath);

  ctx.strokeStyle = `rgba(177,64,255,${0.34 + energy * 0.26 + kick * 0.10})`;
  ctx.lineWidth = radius * (0.032 + kick * 0.005);
  ctx.shadowBlur = radius * (0.075 + energy * 0.030);
  ctx.shadowColor = 'rgba(188,58,255,0.92)';
  ctx.stroke(violetPath);

  ctx.strokeStyle = makePlasmaGradient(cx, cy, time, 1);
  ctx.lineWidth = radius * (0.028 + kick * 0.004);
  ctx.shadowBlur = radius * (0.058 + energy * 0.028);
  ctx.shadowColor = 'rgba(130,92,255,0.95)';
  ctx.stroke(colorPath);

  ctx.strokeStyle = `rgba(255,255,255,${0.92 + energy * 0.08})`;
  ctx.lineWidth = radius * (0.014 + kick * 0.002);
  ctx.shadowBlur = radius * (0.032 + kick * 0.018);
  ctx.shadowColor = 'rgba(248,251,255,1)';
  ctx.stroke(corePath);
  ctx.restore();
};

drawFlameRay = function drawFlameRayTuned(cx, cy, radius, angle, length, width, phase, alpha, kickBoost = 0) {
  const r0 = radius * 0.985;
  const r1 = radius + length;
  const x0 = cx + Math.cos(angle) * r0;
  const y0 = cy + Math.sin(angle) * r0;
  const x1 = cx + Math.cos(angle) * r1;
  const y1 = cy + Math.sin(angle) * r1;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);

  // Much wider, not taller: thickness expands strongly while ray length stays controlled.
  const bodyWidth = width * (2.65 + kickBoost * 0.55);
  const baseHalf = bodyWidth * 0.82;
  const midHalf = bodyWidth * 0.58;
  const mx = x0 + (x1 - x0) * 0.46;
  const my = y0 + (y1 - y0) * 0.46;

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0.00, plasmaColorAtPhase(phase + 0.02, Math.min(1, alpha + 0.34)));
  gradient.addColorStop(0.22, plasmaColorAtPhase(phase, alpha));
  gradient.addColorStop(0.62, plasmaColorAtPhase(phase, alpha * 0.42));
  gradient.addColorStop(0.86, plasmaColorAtPhase(phase, alpha * 0.15));
  gradient.addColorStop(1.00, plasmaColorAtPhase(phase, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.shadowBlur = bodyWidth * (2.8 + kickBoost * 1.3);
  ctx.shadowColor = plasmaColorAtPhase(phase, 0.72);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * baseHalf, y0 + ny * baseHalf);
  ctx.quadraticCurveTo(mx + nx * midHalf, my + ny * midHalf, x1, y1);
  ctx.quadraticCurveTo(mx - nx * midHalf, my - ny * midHalf, x0 - nx * baseHalf, y0 - ny * baseHalf);
  ctx.closePath();
  ctx.fill();

  const core = ctx.createLinearGradient(x0, y0, x1, y1);
  core.addColorStop(0, 'rgba(255,255,255,0.82)');
  core.addColorStop(0.35, plasmaColorAtPhase(phase + 0.015, Math.min(1, alpha + 0.15)));
  core.addColorStop(1, plasmaColorAtPhase(phase, 0));
  ctx.strokeStyle = core;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, bodyWidth * 0.20);
  ctx.shadowBlur = bodyWidth * 1.05;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
};

drawFlameField = function drawFlameFieldTuned(cx, cy, radius, signal, time) {
  const energy = clamp(signal.energy);
  const kick = clamp(signal.kick || 0);
  const colorPhase = time * 0.09;
  const count = 34;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + 0.018 * Math.sin(i * 2.7);
    const seed = 0.5 + 0.5 * Math.sin(i * 12.9898 + 2.37);
    const seed2 = 0.5 + 0.5 * Math.sin(i * 5.398 + 1.17);
    const tallBias = 0.24 + seed * 1.22;
    const localEnergy = energy * (0.40 + seed2 * 0.72) + kick * (0.28 + seed * 0.72);
    const length = radius * (0.075 + tallBias * 0.20 + localEnergy * 0.15);
    const width = radius * (0.021 + seed2 * 0.017);
    const alpha = 0.24 + energy * 0.18 + seed * 0.16 + kick * 0.13;
    drawFlameRay(cx, cy, radius, angle, length, width, colorPhase + i / count, alpha, kick);
  }
};

drawAurora = function drawPlasmaContourTuned(width, height) {
  const signal = fastBeatSignal();
  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.325 + signal.bass * 0.004 + (signal.kick || 0) * 0.006);
  const path = buildContourPath(cx, cy, baseRadius, signal);

  const haloRadius = baseRadius * (1.42 + signal.energy * 0.05);
  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.76, cx, cy, haloRadius);
  halo.addColorStop(0, 'rgba(0,0,0,0)');
  halo.addColorStop(0.54, `rgba(55,49,175,${0.045 + signal.energy * 0.045})`);
  halo.addColorStop(0.80, `rgba(135,38,205,${0.040 + signal.energy * 0.045})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloRadius, 0, TAU);
  ctx.fill();

  drawFlameField(cx, cy, baseRadius, signal, contourClock);
  drawLayeredRing(path, cx, cy, baseRadius, signal, contourClock);
  drawTravellingPulse(cx, cy, baseRadius * 1.01, signal, contourClock);
  drawHotSpots(cx, cy, baseRadius, signal, contourClock);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.fill(path);
  ctx.restore();
};
