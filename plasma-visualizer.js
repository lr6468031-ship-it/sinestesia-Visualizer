// Plasma visualizer skin for Sinestesia.
// Loaded after app.js so it only replaces the drawing layer.

let plasmaPhase = 0;

paletteForFamily = function paletteForFamilyPlasma() {
  return {
    h1: 330, // pink / magenta
    h2: 54,  // warm yellow / gold
    h3: 108, // lime / green
  };
};

function plasmaHue(index) {
  return index % 3 === 0 ? 330 : index % 3 === 1 ? 54 : 108;
}

function hashNoise(value) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

drawBackground = function drawPlasmaBackground(width, height) {
  const bg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    0,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.78,
  );
  bg.addColorStop(0, '#120b10');
  bg.addColorStop(0.42, '#070506');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
};

drawAurora = function drawPlasmaOrb(width, height, energy) {
  plasmaPhase += 0.006 + energy * 0.022;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const baseRadius = minSide * (0.27 + energy * 0.045);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const halo = ctx.createRadialGradient(cx, cy, baseRadius * 0.08, cx, cy, baseRadius * 1.42);
  halo.addColorStop(0, `rgba(255, 236, 180, ${0.08 + energy * 0.08})`);
  halo.addColorStop(0.36, `rgba(255, 42, 142, ${0.075 + energy * 0.09})`);
  halo.addColorStop(0.68, `rgba(205, 255, 84, ${0.045 + energy * 0.055})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.48, 0, TAU);
  ctx.fill();

  const ribbons = 15;
  for (let ribbon = 0; ribbon < ribbons; ribbon += 1) {
    const hue = plasmaHue(ribbon);
    const phaseOffset = ribbon * 0.73;
    const verticalSquash = 0.86 + (ribbon % 4) * 0.035;
    const radiusOffset = (ribbon - ribbons / 2) * minSide * 0.0022;

    ctx.beginPath();
    const steps = 150;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * TAU;
      const wobble1 = Math.sin(t * (2 + (ribbon % 3)) + plasmaPhase * (0.8 + ribbon * 0.017) + phaseOffset);
      const wobble2 = Math.sin(t * (5 + (ribbon % 4)) - plasmaPhase * 1.18 + phaseOffset * 0.41);
      const wobble3 = Math.sin(t * 9 + plasmaPhase * 0.54 + ribbon) * 0.22;
      const deformation = 1 + wobble1 * (0.08 + energy * 0.085) + wobble2 * 0.035 + wobble3 * energy * 0.035;
      const r = (baseRadius + radiusOffset) * deformation;
      const x = cx + Math.cos(t) * r;
      const y = cy + Math.sin(t) * r * verticalSquash;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const alpha = 0.09 + energy * 0.17 + (ribbon % 5 === 0 ? 0.06 : 0);
    ctx.strokeStyle = `hsla(${hue}, 100%, ${64 + (ribbon % 2) * 10}%, ${alpha})`;
    ctx.lineWidth = 1.4 + (ribbon % 4) * 1.05 + energy * 5.5;
    ctx.shadowBlur = 16 + energy * 46 + (ribbon % 3) * 7;
    ctx.shadowColor = `hsla(${hue}, 100%, 62%, ${0.72 + energy * 0.2})`;
    ctx.stroke();
  }

  // Wide translucent membranes make the orb feel like liquid plasma.
  for (let membrane = 0; membrane < 7; membrane += 1) {
    const hue = plasmaHue(membrane + 1);
    ctx.beginPath();
    const steps = 110;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * TAU;
      const pulse = Math.sin(t * 3 + plasmaPhase * 0.72 + membrane * 1.2) * (0.055 + energy * 0.06);
      const ripple = Math.sin(t * 7 - plasmaPhase * 1.08 + membrane) * 0.024;
      const r = baseRadius * (0.76 + membrane * 0.045) * (1 + pulse + ripple);
      const x = cx + Math.cos(t) * r;
      const y = cy + Math.sin(t) * r * (0.79 + membrane * 0.017);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${hue}, 100%, 68%, ${0.035 + energy * 0.055})`;
    ctx.lineWidth = 9 + membrane * 1.4 + energy * 13;
    ctx.shadowBlur = 26 + energy * 54;
    ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.55)`;
    ctx.stroke();
  }

  // Dotted particles suspended inside and around the plasma.
  const particleCount = 92;
  for (let i = 0; i < particleCount; i += 1) {
    const a = hashNoise(i * 3.11) * TAU + plasmaPhase * (0.018 + (i % 7) * 0.002);
    const rr = Math.sqrt(hashNoise(i * 7.73 + 4.2)) * baseRadius * 1.06;
    const drift = Math.sin(plasmaPhase * 1.3 + i) * 3.5 * energy;
    const x = cx + Math.cos(a) * rr + drift;
    const y = cy + Math.sin(a) * rr * 0.84;
    const hue = plasmaHue(i);
    const size = 0.6 + hashNoise(i * 11.8) * (1.7 + energy * 2.6);
    ctx.fillStyle = `hsla(${hue}, 100%, 76%, ${0.18 + energy * 0.38})`;
    ctx.shadowBlur = 6 + energy * 14;
    ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.9)`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }

  // Thin outer membrane.
  const edge = ctx.createLinearGradient(cx - baseRadius, cy, cx + baseRadius, cy);
  edge.addColorStop(0, 'rgba(255,47,153,0.58)');
  edge.addColorStop(0.5, 'rgba(255,239,90,0.52)');
  edge.addColorStop(1, 'rgba(142,255,82,0.54)');
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2 + energy * 2.4;
  ctx.shadowBlur = 22 + energy * 30;
  ctx.shadowColor = 'rgba(255,85,177,0.65)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.015, 0, TAU);
  ctx.stroke();

  ctx.restore();
};

drawBassWave = function drawPlasmaWave(width, height) {
  if (!timeData) return;

  const cx = width * 0.5;
  const cy = height * 0.43;
  const minSide = Math.min(width, height);
  const orbRadius = minSide * (0.27 + smoothedEnergy * 0.045);
  const startX = cx - orbRadius * 0.92;
  const endX = cx + orbRadius * 0.92;
  const amp = minSide * (0.045 + smoothedBass * 0.12 + smoothedEnergy * 0.035);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let layer = 3; layer >= 0; layer -= 1) {
    ctx.beginPath();
    const samples = 150;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const dataIndex = Math.min(timeData.length - 1, Math.floor(t * timeData.length));
      const sample = (timeData[dataIndex] - 128) / 128;
      const windowShape = Math.sin(t * Math.PI) ** 0.52;
      const x = startX + (endX - startX) * t;
      const organic = Math.sin(t * TAU * 2.2 + plasmaPhase * 1.5) * amp * 0.085 * smoothedEnergy;
      const y = cy + sample * amp * windowShape + organic;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const hue = layer === 3 ? 330 : layer === 2 ? 54 : 108;
    ctx.strokeStyle = layer === 0
      ? 'rgba(255,255,255,0.95)'
      : `hsla(${hue},100%,68%,${0.22 + smoothedEnergy * 0.25})`;
    ctx.lineWidth = layer === 0 ? 2.2 : 4 + layer * 3.5 + smoothedEnergy * 5;
    ctx.shadowBlur = layer === 0 ? 14 : 24 + layer * 11 + smoothedEnergy * 32;
    ctx.shadowColor = layer === 0 ? 'rgba(255,255,255,0.95)' : `hsla(${hue},100%,62%,0.9)`;
    ctx.stroke();
  }

  ctx.restore();
};

// Remove the old lightning/pendulum overlays so the plasma remains clean.
drawPendulum = function drawPlasmaPendulum() {};
drawSnareBolts = function drawPlasmaSnareBolts() {};
drawFamilyAccent = function drawPlasmaFamilyAccent() {};
