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
  const defaults = { kickHz: 60, snareHz: 200, kickSensitivity: 1, snareSensitivity: 1, melodyHz: 700, melodySensitivity: 1, melodyWidth: 2 };
  const limits = { kickHz: [30, 300], snareHz: [100, 1500], kickSensitivity: [0.5, 2], snareSensitivity: [0.5, 2], melodyHz: [100, 8000], melodySensitivity: [0.5, 2], melodyWidth: [0.5, 4] };
  const key = 'sinestesia-detection-v1';
  const settings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    for (const name of Object.keys(defaults)) {
      if (saved && Number.isFinite(saved[name])) settings[name] = Math.max(limits[name][0], Math.min(limits[name][1], saved[name]));
    }
  } catch (_) { /* Storage may be unavailable; in-memory controls still work. */ }
  window.sinestesiaDetectionSettings = settings;
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
      point.setAttribute('aria-valuenow', Math.round(hz));
      point.setAttribute('aria-valuetext', `${Math.round(hz)} Hz, banda ${Math.round(lo)} a ${Math.round(hi)} Hz`);
      const band = document.getElementById(`${kind}Band`);
      band.style.left = `${fraction(lo) * 100}%`;
      band.style.width = `${(fraction(hi) - fraction(lo)) * 100}%`;
      document.getElementById(`${kind}Range`).textContent = `${kind === 'kick' ? 'Kick' : kind === 'snare' ? 'Snare' : 'Melodía'} · ${Math.round(lo)}–${Math.round(hi)} Hz`;
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
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = settings[name] * 1.05;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = settings[name] / 1.05;
      if (event.key === 'Home') next = limits[name][0];
      if (event.key === 'End') next = limits[name][1];
      if (next === undefined) return;
      event.preventDefault();
      settings[name] = Math.round(Math.max(limits[name][0], Math.min(limits[name][1], next)));
      changed(); persist();
    });
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
    context.clearRect(0, 0, surface.width, surface.height);
    statusElement.textContent = 'Carga y reproduce música para ver sus frecuencias.';
  };
  audioElement.addEventListener('emptied', clear);
  audioElement.addEventListener('seeking', clear);
  let lastRow = 0;
  window.sinestesiaSpectrumFrame = (spectrum, sampleRate, now) => {
    if (panel.hidden || now - lastRow < 40) return;
    const elapsed = Math.min(120, lastRow ? now - lastRow : 40);
    lastRow = now;
    const width = Math.max(1, Math.min(900, Math.round(plot.clientWidth)));
    if (surface.width !== width || surface.height !== 210) { surface.width = width; surface.height = 210; }
    // Roughly six seconds of history. Color intensity is logarithmic dB.
    const rows = Math.max(1, Math.round(elapsed * surface.height / 6000));
    context.drawImage(surface, 0, 0, width, surface.height - rows, 0, rows, width, surface.height - rows);
    const row = context.createImageData(width, rows);
    const binHz = sampleRate / (spectrum.length * 2);
    for (let x = 0; x < width; x++) {
      const lo = Math.max(1, Math.floor(hzAt(x / width) / binHz));
      const hi = Math.min(spectrum.length - 1, Math.ceil(hzAt((x + 1) / width) / binHz));
      let db = -100;
      for (let i = lo; i <= hi; i++) db = Math.max(db, spectrum[i]);
      const value = Math.max(0, Math.min(1, (db + 95) / 75));
      for (let y = 0; y < rows; y++) {
        const offset = (y * width + x) * 4;
        row.data[offset] = Math.round(255 * Math.pow(value, 2));
        row.data[offset + 1] = Math.round(220 * Math.pow(value, 1.2));
        row.data[offset + 2] = Math.round(255 * Math.min(1, value * 2));
        row.data[offset + 3] = 255;
      }
    }
    context.putImageData(row, 0, 0);
    statusElement.textContent = 'En vivo · K: kick / expansión · S: snare / aurora · M: notas / mini pulsos. Brillo = energía de la frecuencia.';
  };
  updateUI();
  widthControl.value = settings.melodyWidth;
  document.getElementById('melodyWidthLabel').textContent = `${settings.melodyWidth} octavas`;
})();
