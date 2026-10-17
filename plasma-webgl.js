// WebGL plasma fallback for Sinestesia Visualizer.
// Performance-tuned for mobile while preserving the electric organic look.
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const baseCanvas = document.getElementById('visualizer');
  if (!selector || !baseCanvas || !baseCanvas.parentElement) return;

  const stage = baseCanvas.parentElement;
  const surface = document.createElement('canvas');
  surface.id = 'plasmaWebGLCanvas';
  surface.setAttribute('aria-hidden', 'true');
  Object.assign(surface.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    background: '#000',
    pointerEvents: 'none',
  });

  const fluidCanvas = document.getElementById('fluidCanvas');
  if (fluidCanvas && fluidCanvas.nextSibling) stage.insertBefore(surface, fluidCanvas.nextSibling);
  else stage.insertBefore(surface, baseCanvas.nextSibling);

  const gl = surface.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });

  let ready = false;
  let contextLost = false;
  let program = null;
  let locations = null;
  let buffer = null;

  const vertexSource = `
    precision highp float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    varying vec2 uv;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float treble;
    uniform float energy;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.54;
      mat2 r = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = r * p * 2.03 + vec2(17.1, 9.2);
        a *= 0.49;
      }
      return v;
    }

    vec3 palette(float t) {
      vec3 deepBlue = vec3(0.018, 0.06, 0.48);
      vec3 cyan = vec3(0.02, 0.86, 1.0);
      vec3 violet = vec3(0.43, 0.07, 1.0);
      vec3 magenta = vec3(1.0, 0.06, 0.56);
      float x = fract(t);
      if (x < 0.24) return mix(deepBlue, cyan, x / 0.24);
      if (x < 0.50) return mix(cyan, violet, (x - 0.24) / 0.26);
      if (x < 0.76) return mix(violet, magenta, (x - 0.50) / 0.26);
      return mix(magenta, deepBlue, (x - 0.76) / 0.24);
    }

    void main() {
      vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      p.y -= 0.07;
      float t = time * 0.32;
      float b = clamp(bass, 0.0, 1.0);
      float m = clamp(mid, 0.0, 1.0);
      float h = clamp(treble, 0.0, 1.0);
      float activity = max(b, max(m,h));
      float radius = 0.255 + b * 0.033;
      vec2 q = p / radius;
      float a = atan(q.y, q.x);
      float deformation = b * 0.06 * sin(a * 3.0 + t)
                        + m * 0.035 * sin(a * 5.0 - t * 1.3)
                        + h * 0.012 * sin(a * 9.0 + t);
      float r = length(q) / (1.0 + deformation);
      float mask = 1.0 - smoothstep(0.995, 1.015, r);
      float z = sqrt(max(0.0, 1.0 - min(r*r, 1.0)));
      // Project the flow onto a curved surface rather than drawing flat contour lines.
      vec3 n = normalize(vec3(q, z * 1.1));
      vec2 sphere = vec2(atan(n.x, max(0.001,n.z)), asin(clamp(n.y,-1.0,1.0)));
      vec2 flow = sphere;
      flow += vec2(sin(sphere.y * 2.9 + t), cos(sphere.x * 2.5 - t * 0.8)) * 0.36;
      flow += vec2(sin(flow.y * 4.0 - t * 0.5), sin(flow.x * 3.5 + t * 0.6)) * 0.14;
      float field = flow.x * 1.7 + flow.y * 1.3 + sin(flow.y * 3.0 - t) * 0.65;
      vec3 magenta = vec3(1.0, 0.035, 0.38);
      vec3 cyan = vec3(0.025, 0.55, 1.0);
      vec3 gold = vec3(1.0, 0.46, 0.025);
      // Wide flowing sheets and narrow hot ridges share the same field.
      float waveB = 0.5 + 0.5 * sin(field * 3.0 + t);
      float waveM = 0.5 + 0.5 * sin(field * 3.0 + t + 2.1);
      float waveH = 0.5 + 0.5 * sin(field * 3.0 + t + 4.2);
      vec3 sheets = magenta*b*pow(waveB,4.0) + cyan*m*pow(waveM,4.0) + gold*h*pow(waveH,4.0);
      vec3 ridges = magenta*b*pow(waveB,24.0) + cyan*m*pow(waveM,24.0) + gold*h*pow(waveH,24.0);
      float rim = pow(1.0-z, 3.2);
      float lighting = 0.22 + 0.78 * max(0.0,dot(n,normalize(vec3(-0.7,0.5,0.6))));
      float around = a + sin(a*2.0+t)*0.8 + t*0.4;
      vec3 edgeColor = magenta*b*(0.5+0.5*sin(around))
                     + cyan*m*(0.5+0.5*sin(around+2.1))
                     + gold*h*(0.5+0.5*sin(around+4.2));
      vec3 color = (sheets * (0.28 + lighting * 0.75) + ridges * 1.2) * (0.25+0.75*z);
      color += edgeColor * rim * 2.8;
      color *= mask;
      float edge = exp(-abs(r-1.0)*65.0);
      float bloom = exp(-abs(r-1.0)*14.0);
      color += edgeColor * (edge * 1.2 + bloom * 0.2);
      // A dim glass shell remains at rest; the colored light is exclusively audio driven.
      color += vec3(0.015,0.019,0.03)*edge;
      color = vec3(1.0) - exp(-color * 1.35);
      gl_FragColor = vec4(color,1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || 'Shader compilation failed');
    }
    return shader;
  }

  function build() {
    if (!gl) return;
    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

    locations = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      bass: gl.getUniformLocation(program, 'bass'),
      mid: gl.getUniformLocation(program, 'mid'),
      treble: gl.getUniformLocation(program, 'treble'),
      energy: gl.getUniformLocation(program, 'energy'),
    };

    gl.clearColor(0, 0, 0, 1);
    ready = true;
  }

  if (gl) {
    try {
      build();
    } catch (error) {
      console.warn('WebGL Plasma unavailable:', error);
    }
  }

  function isActive() {
    return selector.value === 'plasma' && ready && !contextLost;
  }

  function syncVisibility() {
    const active = isActive();
    window.sinestesiaPlasmaWebGLActive = active;
    surface.hidden = !active;
    surface.style.display = active ? 'block' : 'none';
    if (active) {
      baseCanvas.style.visibility = 'hidden';
    } else if (!window.sinestesiaFluidActive) {
      baseCanvas.style.visibility = 'visible';
    }
  }

  selector.addEventListener('change', syncVisibility);
  surface.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    syncVisibility();
  });
  surface.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    ready = false;
    try { build(); } catch (error) { console.warn('WebGL Plasma restore failed:', error); }
    syncVisibility();
  });

  const previousDraw = drawAurora;
  let quality = 0.92;
  let slowFrames = 0;
  let fastFrames = 0;
  let lastFrameAt = 0;

  drawAurora = function drawPlasmaWebGL(width, height) {
    if (!isActive()) {
      previousDraw(width, height);
      return;
    }

    const now = performance.now();
    const frameMs = lastFrameAt ? now - lastFrameAt : 0;
    lastFrameAt = now;

    if (!audio.paused && frameMs > 36) {
      slowFrames += 1;
      fastFrames = 0;
    } else if (frameMs > 0 && frameMs < 26) {
      fastFrames += 1;
      slowFrames = Math.max(0, slowFrames - 1);
    } else {
      slowFrames = Math.max(0, slowFrames - 1);
      fastFrames = Math.max(0, fastFrames - 1);
    }

    if (slowFrames > 16) {
      quality = Math.max(0.48, quality - 0.10);
      slowFrames = 0;
    } else if (fastFrames > 180) {
      quality = Math.min(0.92, quality + 0.04);
      fastFrames = 0;
    }

    const maxPixels = 300000;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      1.10,
      Math.sqrt(maxPixels / Math.max(1, width * height)),
    ) * quality;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (surface.width !== w || surface.height !== h) {
      surface.width = w;
      surface.height = h;
    }

    const signal = fastBeatSignal();
    surface.style.filter = baseCanvas.style.filter;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(locations.resolution, w, h);
    gl.uniform1f(locations.time, contourClock * getColorSpeed() * 0.5);
    gl.uniform1f(locations.bass, signal.bass);
    gl.uniform1f(locations.mid, signal.mid);
    gl.uniform1f(locations.treble, signal.treble);
    gl.uniform1f(locations.energy, signal.energy);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  syncVisibility();
})();
