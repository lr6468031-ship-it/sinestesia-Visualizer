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
      vec2 p = uv * 2.0 - 1.0;
      p.x *= resolution.x / max(resolution.y, 1.0);
      p.y += 0.10;

      float t = time * 0.30;
      float n1 = fbm(p * 1.40 + vec2(t * 0.32, -t * 0.20));
      float n2 = fbm(p * 2.05 + vec2(-t * 0.16, t * 0.27) + n1 * 1.55);
      vec2 warp = vec2(
        fbm(p * 1.62 + vec2(t * 0.18, 5.2)),
        fbm(p * 1.62 + vec2(-4.7, -t * 0.16))
      ) - 0.5;
      vec2 q = p + warp * (0.15 + energy * 0.08);

      float r = length(q);
      vec2 dir = q / max(r, 0.0001);
      float angle = atan(q.y, q.x);

      float lower = pow(max(0.0, -dir.y), 2.2);
      float upper = pow(max(0.0, dir.y), 2.2);
      float sides = pow(abs(dir.x), 2.0);
      float audioShape = bass * lower * 0.14 + mid * sides * 0.090 + treble * upper * 0.100;

      float lobes = sin(angle * 3.0 + t * 0.50 + n2 * 3.0) * 0.044;
      lobes += sin(angle * 5.0 - t * 0.28 + n1 * 4.0) * 0.020;
      float boundary = 0.69 + (n1 - 0.5) * 0.18 + (n2 - 0.5) * 0.10 + lobes + audioShape;

      float signedEdge = boundary - r;
      float body = smoothstep(-0.018, 0.022, signedEdge);
      float outerGlow = exp(-max(0.0, r - boundary) * (9.2 - energy * 1.8));
      outerGlow *= 0.22 + energy * 0.56;

      float normalizedR = clamp(r / max(boundary, 0.001), 0.0, 1.0);
      float z = sqrt(max(0.0, 1.0 - normalizedR * normalizedR));
      vec3 normal = normalize(vec3(dir.x * 0.90, dir.y * 0.90, z * 1.30 + 0.05));
      vec3 lightDir = normalize(vec3(-0.42, 0.58, 0.95));
      float diffuse = 0.22 + 0.78 * max(0.0, dot(normal, lightDir));
      float fresnel = pow(1.0 - max(0.0, normal.z), 2.15);

      float flowA = fbm(q * 3.7 + warp * 2.6 + vec2(t * 0.36, -t * 0.26));
      float flowB = fbm(q * 6.2 - warp * 1.8 + vec2(-t * 0.23, t * 0.31));
      float flow = flowA * 0.66 + flowB * 0.34;
      float bands = 0.5 + 0.5 * sin(flow * 14.0 + angle * 2.2 - t * 1.0);
      float filaments = pow(max(0.0, 1.0 - abs(sin(flowB * 23.0 - flowA * 8.0 + angle * 4.5 + t * 0.62))), 8.0);

      float cycle = flow * 0.48 + angle / 6.2831853 + t * 0.050;
      vec3 c1 = palette(cycle);
      vec3 c2 = palette(cycle + 0.17 + bands * 0.07);
      vec3 color = mix(c1, c2, bands * 0.82);

      color *= diffuse * (0.76 + energy * 0.30);
      color += palette(cycle + 0.30) * filaments * (0.24 + treble * 0.60);
      color += vec3(0.08, 0.64, 1.0) * fresnel * (0.64 + mid * 0.50);

      float coreLight = pow(max(0.0, 1.0 - normalizedR), 1.6) * (0.16 + energy * 0.18);
      color += vec3(0.06, 0.10, 0.32) * coreLight;

      float highlight = pow(max(0.0, dot(normal, normalize(vec3(-0.25, 0.42, 1.0)))), 38.0);
      color += vec3(0.74, 0.96, 1.0) * highlight * (0.35 + energy * 0.48);

      vec3 glowColor = palette(cycle + 0.09) * outerGlow;
      float edgeBloom = exp(-abs(signedEdge) * 30.0) * (0.22 + energy * 0.50);
      glowColor += vec3(0.04, 0.72, 1.0) * edgeBloom * 0.62;

      vec3 finalColor = color * body + glowColor * (1.0 - body * 0.18);
      finalColor = finalColor / (vec3(1.0) + finalColor * 0.36);
      finalColor = pow(finalColor, vec3(0.88));

      float vignette = smoothstep(1.32, 0.42, length(p * vec2(0.78, 0.68)));
      finalColor *= 0.72 + vignette * 0.28;
      gl_FragColor = vec4(finalColor, 1.0);
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
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(locations.resolution, w, h);
    gl.uniform1f(locations.time, plasmaClock);
    gl.uniform1f(locations.bass, signal.bass);
    gl.uniform1f(locations.mid, signal.mid);
    gl.uniform1f(locations.treble, signal.treble);
    gl.uniform1f(locations.energy, signal.energy);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  syncVisibility();
})();
