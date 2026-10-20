/* Temporary per-stem energy tracks, sampled against the audible player's clock.
 * No additional audio players, persistent stem storage, or duplicate soundtrack. */
class StemTimeline {
  constructor() { this.clear(); }
  clear() { this.tracks = new Map(); this.routes = new Map(); this.offset = 0; this.duration = 0; this.solo = null; }
  static envelope(buffer) {
    const step = Math.max(1, Math.round(buffer.sampleRate / 50));
    const values = new Float32Array(Math.ceil(buffer.length / step));
    for (let frame = 0; frame < values.length; frame++) {
      let sum = 0, count = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = frame * step; i < Math.min(data.length, (frame + 1) * step); i++) {
          sum += data[i] * data[i]; count++;
        }
      }
      values[frame] = Math.min(1, Math.sqrt(sum / Math.max(1, count)) * 5);
    }
    return { values, rate: buffer.sampleRate / step };
  }
  signal(target, time, paused) {
    const zero = { bass:0, mid:0, treble:0, energy:0, kick:0, snare:0, melody:0, intensity:0, motion:0, note:0 };
    const local = this.solo ? time : time - this.offset;
    if (paused || !Number.isFinite(local) || local < 0 || local >= this.duration) return zero;
    let energy = 0, onset = 0;
    for (const [name, route] of this.routes) {
      if (route !== target || (this.solo && this.solo !== name)) continue;
      const track = this.tracks.get(name);
      if (!track) continue;
      const position = local * track.rate, index = Math.floor(position), fraction = position-index;
      const a = track.values[index] || 0, b = track.values[index+1] ?? a;
      energy = Math.max(energy, a + (b-a)*fraction);
      onset = Math.max(onset, Math.max(0, a-(track.values[Math.max(0,index-2)]||0))*3);
    }
    // These are renderer input channels driven by stem energy, not instrument classification.
    const pulse = Math.min(1, Math.max(onset, energy*.65));
    return { bass:energy, mid:energy, treble:energy, energy, kick:pulse, snare:pulse, melody:energy,
      intensity:energy, motion:local, note:0 };
  }
}
if (typeof module !== 'undefined') module.exports = { StemTimeline };
if (typeof window !== 'undefined') (() => {
  const timeline = new StemTimeline();
  const modes = [
    ['plasma','Plasma','plasmaWebGLCanvas'],
    ['fluidGas','Fluid','fluidGasCanvas'],
    ['electricIris','Iris eléctrico','electricIrisCanvas'],
    ['lagrangian:currents','Corrientes','lagrangianCanvas']
  ];
  const selector = document.getElementById('visualMode');
  const player = document.getElementById('audio');
  const separation = () => window.sinestesiaAnalysisMode === 'separation';
  const active = mode => separation() ? [...timeline.routes.values()].includes(mode) : selector.value === mode;
  function refresh() {
    selector.dispatchEvent(new Event('change'));
    const shown = modes.filter(([mode]) => active(mode));
    for (const [mode,,id] of modes) {
      const surface = document.getElementById(id);
      if (!surface) continue;
      if (separation()) {
        const index = shown.findIndex(([value]) => value === mode);
        const columns = shown.length > 1 ? 2 : 1, rows = Math.ceil(shown.length/columns) || 1;
        Object.assign(surface.style, { inset:'auto', left:(index%columns)*100/columns+'%',
          top:Math.floor(index/columns)*100/rows+'%', width:100/columns+'%', height:100/rows+'%' });
      } else Object.assign(surface.style, {inset:'0',left:'0',top:'0',width:'100%',height:'100%'});
    }
    if (separation()) document.getElementById('visualizer').style.visibility='hidden';
  }
  window.sinestesiaStemRouter = { timeline, modes, active, refresh,
    signal: mode => separation() ? timeline.signal(mode,player.currentTime,player.paused) : null,
    clear: () => { timeline.clear(); refresh(); }
  };
})();
