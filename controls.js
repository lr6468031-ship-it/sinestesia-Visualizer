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
