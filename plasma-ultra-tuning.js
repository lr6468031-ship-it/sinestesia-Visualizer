// Final visual tuning: larger Plasma Ultra, thicker tapered flames, and thinner separated layers.

function tunedRingPath(cx, cy, radius, signal, scale) {
  return buildContourPath(cx, cy, radius * scale, signal);
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

  // Thin outer blue layer, slightly detached from the violet layer.
  ctx.strokeStyle = `rgba(55,86,255,${0.16 + energy * 0.12})`;
  ctx.lineWidth = radius * (0.038 + kick * 0.006);
  ctx.shadowBlur = radius * (0.100 + energy * 0.040);
  ctx.shadowColor = 'rgba(62,82,255,0.82)';
  ctx.stroke(outerPath);

  // Violet layer.
  ctx.strokeStyle = `rgba(177,64,255,${0.34 + energy * 0.26 + kick * 0.10})`;
  ctx.lineWidth = radius * (0.032 + kick * 0.005);
  ctx.shadowBlur = radius * (0.075 + energy * 0.030);
  ctx.shadowColor = 'rgba(188,58,255,0.92)';
  ctx.stroke(violetPath);

  // Chromatic plasma layer.
  ctx.strokeStyle = makeContourGradient(cx, cy, time, 1);
  ctx.lineWidth = radius * (0.028 + kick * 0.004);
  ctx.shadowBlur = radius * (0.058 + energy * 0.028);
  ctx.shadowColor = 'rgba(130,92,255,0.95)';
  ctx.stroke(colorPath);

  // Hot white inner core.
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
  const bodyWidth = width * (1.55 + kickBoost * 0.30);
  const baseHalf = bodyWidth * 0.72;
  const midHalf = bodyWidth * 0.44;
  const mx = x0 + (x1 - x0) * 0.46;
  const my = y0 + (y1 - y0) * 0.46;

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0.00, colorAtPhase(phase + 0.02, Math.min(1, alpha + 0.34)));
  gradient.addColorStop(0.22, colorAtPhase(phase, alpha));
  gradient.addColorStop(0.62, colorAtPhase(phase, alpha * 0.42));
  gradient.addColorStop(0.86, colorAtPhase(phase, alpha * 0.15));
  gradient.addColorStop(1.00, colorAtPhase(phase, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.shadowBlur = bodyWidth * (2.3 + kickBoost * 1.2);
  ctx.shadowColor = colorAtPhase(phase, 0.78);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * baseHalf, y0 + ny * baseHalf);
  ctx.quadraticCurveTo(mx + nx * midHalf, my + ny * midHalf, x1, y1);
  ctx.quadraticCurveTo(mx - nx * midHalf, my - ny * midHalf, x0 - nx * baseHalf, y0 - ny * baseHalf);
  ctx.closePath();
  ctx.fill();

  // Bright inner filament keeps the flame crisp instead of looking like a flat stick.
  const core = ctx.createLinearGradient(x0, y0, x1, y1);
  core.addColorStop(0, 'rgba(255,255,255,0.88)');
  core.addColorStop(0.35, colorAtPhase(phase + 0.015, Math.min(1, alpha + 0.15)));
  core.addColorStop(1, colorAtPhase(phase, 0));
  ctx.strokeStyle = core;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, bodyWidth * 0.22);
  ctx.shadowBlur = bodyWidth * 0.75;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
};

drawFlameField = function drawFlameFieldTuned(cx, cy, radius, signal, time) {
  const energy = clamp(signal.energy);
  const kick = clamp(signal.kick || 0);
  const colorPhase = time * 0.23 * getColorSpeed();
  const count = 34;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + 0.018 * Math.sin(i * 2.7);
    const seed = 0.5 + 0.5 * Math.sin(i * 12.9898 + 2.37);
    const seed2 = 0.5 + 0.5 * Math.sin(i * 5.398 + 1.17);
    const tallBias = 0.24 + seed * 1.22;
    const localEnergy = energy * (0.40 + seed2 * 0.72) + kick * (0.28 + seed * 0.72);
    const length = radius * (0.075 + tallBias * 0.20 + localEnergy * 0.15);
    const width = radius * (0.017 + seed2 * 0.014);
    const alpha = 0.24 + energy * 0.18 + seed * 0.16 + kick * 0.13;
    drawFlameRay(cx, cy, radius, angle, length, width, colorPhase + i / count, alpha, kick);
  }
};

drawAurora = function drawPlasmaContourTuned(width, height) {
  const signal = fastBeatSignal();
  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  // Larger overall silhouette, while staying firm.
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
