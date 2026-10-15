// Regla visual fija para la familia Graves:
// una sola onda sinusoidal luminosa, sin círculos ni partículas.

drawBassPulses = function drawBassSineWave(cx, cy, minSide, bass) {
  const canvasWidth = ctx.canvas.getBoundingClientRect().width;
  const usableWidth = Math.min(canvasWidth * 0.82, minSide * 0.95);
  const startX = cx - usableWidth / 2;
  const amplitude = minSide * (0.018 + bass * 0.15);
  const cycles = 1.15 + bass * 0.7;
  const points = 140;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.5 + bass * 4.2;
  ctx.strokeStyle = `rgba(105, 155, 255, ${0.28 + bass * 0.70})`;
  ctx.shadowBlur = 12 + bass * 34;
  ctx.shadowColor = 'rgba(72, 125, 255, 0.95)';
  ctx.beginPath();

  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const x = startX + usableWidth * t;
    const phase = t * TAU * cycles + pulsePhase * TAU;
    const y = cy + Math.sin(phase) * amplitude;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
  ctx.restore();

  return amplitude;
};
