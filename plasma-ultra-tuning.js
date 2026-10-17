// Fusion: a luminous plasma sphere with fluid folds, driven by three fixed frequency colors.
const fusionBands = [
  { key: 'bass', rgb: '255,55,165', phase: 0, folds: 3 },
  { key: 'mid', rgb: '40,220,255', phase: 2.1, folds: 5 },
  { key: 'treble', rgb: '255,195,60', phase: 4.2, folds: 11 },
];

function fusionColor(band, alpha) {
  return `rgba(${band.rgb},${clamp(alpha)})`;
}

function fusionSurface(angle, radius, signal, time) {
  const bass = clamp(signal.bass), mid = clamp(signal.mid), high = clamp(signal.treble);
  return radius * (1
    + bass * 0.105 * Math.sin(angle * 3 + time * 0.9)
    + mid * 0.065 * Math.sin(angle * 5 - time * 1.1)
    + high * 0.024 * Math.sin(angle * 11 + time * 1.7));
}

function fusionContour(cx, cy, radius, signal, time) {
  const path = new Path2D();
  for (let i = 0; i <= 160; i += 1) {
    const a = i / 160 * TAU;
    const r = fusionSurface(a, radius, signal, time);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function drawFusionBand(band, cx, cy, radius, signal, time) {
  const level = clamp(signal[band.key]);
  if (level < 0.003) return;
  const angle = time * 0.27 + band.phase;
  const x = cx + Math.cos(angle) * radius * 0.42;
  const y = cy + Math.sin(angle) * radius * 0.36;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.25);
  glow.addColorStop(0, fusionColor(band, level * 0.24));
  glow.addColorStop(0.55, fusionColor(band, level * 0.08));
  glow.addColorStop(1, fusionColor(band, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);

  // Curved luminous ribbons crossing the interior like a fluid spherical membrane.
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    const path = new Path2D();
    const turn = angle + ribbon * 0.68;
    for (let i = 0; i <= 100; i += 1) {
      const u = i / 100 * Math.PI;
      const horizontal = Math.cos(u);
      const envelope = Math.sin(u);
      const fold = Math.sin(u * band.folds + time * 0.8 + band.phase + ribbon);
      const px = horizontal * radius * 0.98;
      const py = envelope * radius * (Math.sin(u * 2 + turn) * 0.42 + fold * level * 0.28);
      const sx = cx + px * Math.cos(turn) - py * Math.sin(turn);
      const sy = cy + px * Math.sin(turn) + py * Math.cos(turn);
      if (i === 0) path.moveTo(sx, sy); else path.lineTo(sx, sy);
    }
    ctx.strokeStyle = fusionColor(band, level * (0.38 - ribbon * 0.07));
    ctx.lineWidth = radius * (0.018 + level * 0.032);
    ctx.shadowColor = fusionColor(band, level * 0.8);
    ctx.shadowBlur = radius * 0.10;
    ctx.stroke(path);
    ctx.strokeStyle = fusionColor(band, level * 0.85);
    ctx.lineWidth = radius * 0.005;
    ctx.stroke(path);
  }
}

drawAurora = function drawFusionSphere(width, height) {
  const signal = fastBeatSignal();
  const bass = clamp(signal.bass), kick = clamp(signal.kick);
  const cx = width * 0.5, cy = height * 0.43;
  const radius = Math.min(width, height) * (0.25 + bass * 0.045 + kick * 0.014);
  const time = contourClock * getColorSpeed() * 0.5;
  const outline = fusionContour(cx, cy, radius, signal, time);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // A very faint resting outline; color only appears with its corresponding sound.
  ctx.strokeStyle = 'rgba(115,125,155,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke(outline);
  ctx.save();
  ctx.clip(outline);
  ctx.globalCompositeOperation = 'lighter';
  fusionBands.forEach(band => drawFusionBand(band, cx, cy, radius, signal, time));
  ctx.restore();

  ctx.globalCompositeOperation = 'lighter';
  fusionBands.forEach(band => {
    const level = clamp(signal[band.key]);
    if (level < 0.003) return;
    // Traveling arcs follow the same deformed sphere, without changing frequency colors.
    const path = new Path2D();
    const start = time * 0.32 + band.phase;
    const length = 1.2 + level * 2.5;
    for (let i = 0; i <= 90; i += 1) {
      const a = start + i / 90 * length;
      const r = fusionSurface(a, radius, signal, time);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    ctx.shadowColor = fusionColor(band, level);
    ctx.shadowBlur = radius * (0.06 + level * 0.07);
    ctx.strokeStyle = fusionColor(band, level * 0.24);
    ctx.lineWidth = radius * (0.045 + level * 0.035);
    ctx.stroke(path);
    ctx.strokeStyle = fusionColor(band, level * 0.95);
    ctx.lineWidth = radius * (0.008 + level * 0.012);
    ctx.stroke(path);
  });
  ctx.restore();
};
