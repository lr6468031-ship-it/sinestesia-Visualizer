// Drawing interpolation only: detection still uses the original FFT bins and XY gates.
function smoothSpectrumDb(values, position) {
  const read = i => Number.isFinite(values[Math.max(0, Math.min(values.length - 1, i))]) ? Math.max(-100, Math.min(0, values[Math.max(0, Math.min(values.length - 1, i))])) : -100;
  const index = Math.floor(position), t = position - index;
  const a=read(index-1), b=read(index), c=read(index+1), d=read(index+2);
  const value=b+0.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  return Math.max(Math.min(b,c), Math.min(Math.max(b,c), value));
}

(() => {
  const audio = document.getElementById('audio');
  const audioFile = document.getElementById('audioFile');
  const dock = document.getElementById('musicDock');
  const dockToggle = document.getElementById('dockToggle');
  const dockPanel = document.getElementById('dockPanel');
  const playPause = document.getElementById('playPause');
  const seekBar = document.getElementById('seekBar');
  const currentTime = document.getElementById('currentTime');
  const durationTime = document.getElementById('durationTime');
  const trackName = document.getElementById('trackName');
  const compactTrack = document.getElementById('compactTrack');

  if (!audio || !audioFile || !dock || !dockToggle || !dockPanel || !playPause || !seekBar) return;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const setExpanded = (expanded) => {
    dock.classList.toggle('is-open', expanded);
    dockPanel.hidden = !expanded;
    dockToggle.setAttribute('aria-expanded', String(expanded));
  };

  dockToggle.addEventListener('click', () => {
    setExpanded(dockToggle.getAttribute('aria-expanded') !== 'true');
  });

  audioFile.addEventListener('change', () => {
    const file = audioFile.files && audioFile.files[0];
    if (!file) return;
    const cleanName = file.name.replace(/\.[^.]+$/, '');
    trackName.textContent = cleanName;
    compactTrack.textContent = cleanName;
    setExpanded(true);
  });

  playPause.addEventListener('click', async () => {
    if (!audio.src) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch (_) {
        return;
      }
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    durationTime.textContent = formatTime(audio.duration);
    currentTime.textContent = formatTime(audio.currentTime);
    playPause.disabled = false;
    seekBar.disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
    seekBar.value = '0';
  });

  audio.addEventListener('durationchange', () => {
    durationTime.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    currentTime.textContent = formatTime(audio.currentTime);
    if (!seekBar.matches(':active') && Number.isFinite(audio.duration) && audio.duration > 0) {
      seekBar.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    }
  });

  audio.addEventListener('play', () => {
    playPause.textContent = '❚❚';
    playPause.setAttribute('aria-label', 'Pausar');
  });

  audio.addEventListener('pause', () => {
    playPause.textContent = '▶';
    playPause.setAttribute('aria-label', 'Reproducir');
  });

  audio.addEventListener('ended', () => {
    playPause.textContent = '▶';
    seekBar.value = '1000';
  });

  const seekToSlider = () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = (Number(seekBar.value) / 1000) * audio.duration;
    currentTime.textContent = formatTime(audio.currentTime);
  };

  seekBar.addEventListener('input', seekToSlider);
  seekBar.addEventListener('change', seekToSlider);

  setExpanded(false);
})();

// Live waterfall and direct control of the bands consumed by both onset detectors.
(() => {
  const toggle = document.getElementById('spectrumToggle');
  const panel = document.getElementById('spectrumPanel');
  const plot = document.getElementById('spectrumPlot');
  const surface = document.getElementById('spectrumCanvas');
  if (!toggle || !surface) return;
  const context = surface.getContext('2d');
  const defaults = { kickHz: 60, snareHz: 200, kickSensitivity: 1, snareSensitivity: 1, melodyHz: 700, melodySensitivity: 1, melodyWidth: 2, kickLevel: -40, snareLevel: -40, melodyLevel: -40, kickTolerance: 40, snareTolerance: 40, melodyTolerance: 40 };
  const limits = { kickHz: [30, 300], snareHz: [100, 1500], kickSensitivity: [0.5, 2], snareSensitivity: [0.5, 2], melodyHz: [100, 8000], melodySensitivity: [0.5, 2], melodyWidth: [0.5, 4], kickLevel: [-95, -5], snareLevel: [-95, -5], melodyLevel: [-95, -5], kickTolerance: [5, 50], snareTolerance: [5, 50], melodyTolerance: [5, 50] };
  const key = 'sinestesia-detection-v1';
  const settings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    for (const name of Object.keys(defaults)) {
      if (saved && Number.isFinite(saved[name])) settings[name] = Math.max(limits[name][0], Math.min(limits[name][1], saved[name]));
    }
  } catch (_) { /* Storage may be unavailable; in-memory controls still work. */ }
  Object.defineProperty(window, 'sinestesiaDetectionSettings', {
    configurable: true,
    get: () => window.sinestesiaAnalysisMode === 'separation' ? defaults : settings
  });
  const fraction = hz => Math.max(0, Math.min(1, Math.log(hz / 20) / Math.log(800)));
  const hzAt = x => 20 * Math.pow(800, Math.max(0, Math.min(1, x)));
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(settings)); } catch (_) {} };
  function updateUI() {
    for (const kind of ['kick', 'snare', 'melody']) {
      const hz = settings[`${kind}Hz`];
      const point = document.getElementById(`${kind}Point`);
      const factor = Math.pow(2, settings.melodyWidth / 2);
      const lo = kind === 'melody' ? hz / factor : hz * (kind === 'kick' ? 0.5 : 0.75);
      const hi = kind === 'melody' ? Math.min(16000, hz * factor) : hz * 1.5;
      point.style.left = `${fraction(hz) * 100}%`;
      point.style.top = `${-settings[`${kind}Level`]}%`;
      point.setAttribute('aria-valuenow', Math.round(hz));
      point.setAttribute('aria-valuetext', `${Math.round(hz)} Hz, banda ${Math.round(lo)} a ${Math.round(hi)} Hz, nivel ${settings[`${kind}Level`]} dB`);
      const band = document.getElementById(`${kind}Band`);
      band.style.left = `${fraction(lo) * 100}%`;
      const level = settings[`${kind}Level`], tolerance = settings[`${kind}Tolerance`];
      const upper = Math.min(0, level + tolerance), lower = Math.max(-100, level - tolerance);
      band.style.top = `${-upper}%`; band.style.height = `${upper - lower}%`; band.style.bottom = "auto";
      document.getElementById(`${kind}Tolerance`).value = tolerance;
      document.getElementById(`${kind}ToleranceValue`).textContent = tolerance;
      band.style.width = `${(fraction(hi) - fraction(lo)) * 100}%`;
      document.getElementById(`${kind}Range`).textContent = `${kind === 'kick' ? 'Kick' : kind === 'snare' ? 'Snare' : 'Melodía'} · ${Math.round(lo)}–${Math.round(hi)} Hz · ${Math.round(lower)} a ${Math.round(upper)} dB`;
      document.getElementById(`${kind}Sensitivity`).value = settings[`${kind}Sensitivity`];
    }
  }
  const widthControl = document.getElementById('melodyWidth');
  function changed() {
    updateUI();
    widthControl.value = settings.melodyWidth;
    document.getElementById('melodyWidthLabel').textContent = `${settings.melodyWidth} octavas`;
    window.dispatchEvent(new Event('sinestesia-detection-change'));
  }
  for (const kind of ['kick', 'snare', 'melody']) {
    const point = document.getElementById(`${kind}Point`);
    const name = `${kind}Hz`;
    let pointer = null;
    const move = event => {
      const rect = plot.getBoundingClientRect();
      settings[name] = Math.round(Math.max(limits[name][0], Math.min(limits[name][1], hzAt((event.clientX - rect.left) / rect.width))));
      settings[`${kind}Level`] = Math.round(Math.max(-95, Math.min(-5, -(event.clientY - rect.top) / rect.height * 100)));
      changed();
    };
    point.addEventListener('pointerdown', event => {
      if (pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId;
      point.setPointerCapture(pointer);
      point.focus({ preventScroll: true });
      move(event);
    });
    point.addEventListener('pointermove', event => { if (event.pointerId === pointer) move(event); });
    const end = event => { if (event.pointerId === pointer) { pointer = null; persist(); } };
    point.addEventListener('pointerup', end);
    point.addEventListener('pointercancel', end);
    point.addEventListener('lostpointercapture', end);
    point.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = settings[name] * 1.05;
      if (event.key === 'ArrowLeft') next = settings[name] / 1.05;
      if (event.key === 'Home') next = limits[name][0];
      if (event.key === 'End') next = limits[name][1];
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        settings[`${kind}Level`] = Math.max(-95, Math.min(-5, settings[`${kind}Level`] + (event.key === 'ArrowUp' ? 2 : -2)));
        changed(); persist(); return;
      }
      if (next === undefined) return;
      event.preventDefault();
      settings[name] = Math.round(Math.max(limits[name][0], Math.min(limits[name][1], next)));
      changed(); persist();
    });
    const tolerance = document.getElementById(`${kind}Tolerance`);
    tolerance.addEventListener("input", () => { settings[`${kind}Tolerance`] = Number(tolerance.value); changed(); });
    tolerance.addEventListener("change", persist);
    const sensitivity = document.getElementById(`${kind}Sensitivity`);
    sensitivity.addEventListener('input', () => { settings[`${kind}Sensitivity`] = Number(sensitivity.value); changed(); });
    sensitivity.addEventListener('change', persist);
  }
  widthControl.addEventListener('input', () => { settings.melodyWidth = Number(widthControl.value); changed(); });
  widthControl.addEventListener('change', persist);
  document.getElementById('spectrumReset').addEventListener('click', () => { Object.assign(settings, defaults); changed(); persist(); });
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    toggle.textContent = panel.hidden ? 'Mostrar espectrograma y ajustar detección' : 'Ocultar espectrograma';
  });
  const audioElement = document.getElementById('audio');
  const statusElement = document.getElementById('spectrumStatus');
  audioElement.addEventListener('pause', () => { statusElement.textContent = 'En pausa · los ajustes siguen activos aunque ocultes el espectrograma.'; });
  const clear = () => {
    displayCurve = null;
    context.clearRect(0, 0, surface.width, surface.height);
    statusElement.textContent = 'Carga y reproduce música para ver sus frecuencias.';
  };
  audioElement.addEventListener('emptied', clear);
  audioElement.addEventListener('seeking', clear);
  let lastRow = 0;
  let displayCurve = null;
  window.sinestesiaSpectrumFrame = (spectrum, sampleRate, now) => {
    if (window.sinestesiaAnalysisMode === 'separation' || panel.hidden || now - lastRow < 16) return;
    const elapsed = lastRow ? Math.min(100, now - lastRow) : 16;
    lastRow = now;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.min(2560, Math.round(plot.clientWidth * dpr)));
    const height = Math.max(1, Math.round(plot.clientHeight * dpr));
    if (!displayCurve || displayCurve.length !== width) displayCurve = new Float32Array(width).fill(-100);
    if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }
    context.fillStyle = '#04070e'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#ffffff12'; context.lineWidth = 1;
    for (let db = -10; db > -100; db -= 10) { const y = -db / 100 * height; context.beginPath(); context.moveTo(0,y); context.lineTo(width,y); context.stroke(); }
    const gradient = context.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#1946aa'); gradient.addColorStop(0.5, '#24e5d0'); gradient.addColorStop(1, '#ffe3fa');
    context.strokeStyle = gradient; context.lineWidth = Math.max(1, dpr * 1.1);
    context.lineJoin = 'round'; context.lineCap = 'round';
    const binHz = sampleRate / (spectrum.length * 2);
    context.beginPath();
    for (let x = 0; x < width; x++) {
      const position = hzAt(x / Math.max(1, width - 1)) / binHz;
      let db = smoothSpectrumDb(spectrum, position);
      const end = Math.min(spectrum.length - 1, Math.floor(hzAt((x + 1) / width) / binHz));
      // Preserve narrow high-frequency peaks when more than one FFT bin occupies a pixel.
      for (let i = Math.ceil(position); i <= end; i++) db = Math.max(db, Number.isFinite(spectrum[i]) ? spectrum[i] : -100);
      const tau = db > displayCurve[x] ? 35 : 140;
      displayCurve[x] += (db - displayCurve[x]) * (1 - Math.exp(-elapsed / tau));
      const y = Math.max(0, Math.min(height, -displayCurve[x] / 100 * height));
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
    context.lineTo(width, height); context.lineTo(0, height); context.closePath();
    context.globalAlpha = 0.14; context.fillStyle = gradient; context.fill(); context.globalAlpha = 1;
    statusElement.textContent = 'Curva suavizada · X: 20 Hz–16 kHz · Y: −100 a 0 dBFS · solo se aceptan picos dentro de cada zona.';
  };
  updateUI();
  widthControl.value = settings.melodyWidth;
  document.getElementById('melodyWidthLabel').textContent = `${settings.melodyWidth} octavas`;
})();

(() => {
  const player = document.getElementById('audio');
  const speed = document.getElementById('playbackSpeed');
  const label = document.getElementById('playbackSpeedValue');
  const apply = () => { player.preservesPitch = true; player.playbackRate = Number(speed.value); label.textContent = `${Number(speed.value).toFixed(2)}×`; };
  speed.addEventListener('input', apply);
  player.addEventListener('loadedmetadata', apply);
  apply();
})();
