/*
MIT License

Copyright (c) 2017 Pavel Dobryakov
Adaptation and audio-reactive integration for Sinestesia Visualizer, 2026.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// GPU stable-fluid core adapted from Pavel Dobryakov's WebGL Fluid Simulation.
// Interaction-energy behaviour is inspired by Quiet Current, which is itself
// built on the same MIT fluid core. Sinestesia adds its own audio coupling,
// gas/plasma palette, emitter system and integration with the existing analyser.
(() => {
  'use strict';

  const selector = document.getElementById('visualMode');
  const intensityControl = document.getElementById('fluidIntensity');
  const notice = document.getElementById('visualNotice');
  const baseCanvas = document.getElementById('visualizer');
  const stage = baseCanvas?.parentElement;
  if (!selector || !baseCanvas || !stage) return;

  const fluidCanvas = document.createElement('canvas');
  fluidCanvas.id = 'fluidGasCanvas';
  fluidCanvas.setAttribute('aria-label', 'Visualizador de gas plasma interactivo');
  fluidCanvas.hidden = true;
  Object.assign(fluidCanvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'none',
    background: '#000',
    zIndex: '1',
    touchAction: 'none',
  });
  stage.insertBefore(fluidCanvas, baseCanvas.nextSibling);

  const params = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };

  let gl = fluidCanvas.getContext('webgl2', params);
  const isWebGL2 = !!gl;
  if (!gl) gl = fluidCanvas.getContext('webgl', params) || fluidCanvas.getContext('experimental-webgl', params);

  if (!gl) {
    addFluidOption(false);
    return;
  }

  let halfFloat = null;
  let supportLinearFiltering = null;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
  } else {
    halfFloat = gl.getExtension('OES_texture_half_float');
    supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    if (!halfFloat) {
      addFluidOption(false);
      return;
    }
  }

  const halfFloatType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
  const formatRGBA = isWebGL2
    ? getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatType)
    : getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatType);
  const formatRG = isWebGL2
    ? getSupportedFormat(gl.RG16F, gl.RG, halfFloatType)
    : formatRGBA;
  const formatR = isWebGL2
    ? getSupportedFormat(gl.R16F, gl.RED, halfFloatType)
    : formatRGBA;

  if (!formatRGBA || !formatRG || !formatR) {
    addFluidOption(false);
    return;
  }

  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const config = {
    simResolution: mobile ? 96 : 128,
    dyeResolution: mobile ? 384 : 640,
    densityDissipation: 0.42,
    velocityDissipation: 0.14,
    pressure: 0.82,
    pressureIterations: mobile ? 15 : 20,
    curl: 34,
    splatRadius: mobile ? 0.42 : 0.34,
    splatForce: mobile ? 5200 : 6200,
  };

  let active = false;
  let contextLost = false;
  let ready = false;
  let animationFrame = 0;
  let lastFrameTime = performance.now();
  let lastAutoSplat = 0;
  let lastAmbientSplat = 0;
  let lastKickInjection = 0;
  let lastSnareInjection = 0;
  let previousKick = 0;
  let previousTreble = 0;
  let interactionEnergy = 0;
  let hueClock = 0.58;
  let frameCounter = 0;
  let slowFrameScore = 0;

  function addFluidOption(supported = true) {
    let option = selector.querySelector('option[value="fluidGas"]');
    if (!option) {
      option = document.createElement('option');
      option.value = 'fluidGas';
      option.textContent = supported ? 'Fluido Gas · Plasma + Vapor' : 'Fluido Gas · no disponible';
      option.disabled = !supported;
      selector.appendChild(option);
    } else {
      option.disabled = !supported;
      option.textContent = supported ? 'Fluido Gas · Plasma + Vapor' : 'Fluido Gas · no disponible';
    }
  }

  function getSupportedFormat(internalFormat, format, type) {
    if (supportRenderTextureFormat(internalFormat, format, type)) return { internalFormat, format };
    if (!isWebGL2) return null;
    if (internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type);
    if (internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
    return null;
  }

  function supportRenderTextureFormat(internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    return ok;
  }

  function createShader(type, source, keywords = []) {
    const prefix = keywords.map((keyword) => `#define ${keyword}\n`).join('');
    const shader = gl.createShader(type);
    gl.shaderSource(shader, prefix + source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Shader compile error';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Program link error';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i += 1) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return {
      program,
      uniforms,
      bind() { gl.useProgram(program); },
    };
  }

  const baseVertex = createShader(gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `);

  const clearShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;
    void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
  `);

  const copyShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    void main () { gl_FragColor = texture2D(uTexture, vUv); }
  `);

  const splatShader = createShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    void main () {
      vec2 p = vUv - point;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
  `);

  const advectionShader = createShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;
    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }
    void main () {
      #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
      #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
      #endif
      gl_FragColor = result / (1.0 + dissipation * dt);
    }
  `, supportLinearFiltering ? [] : ['MANUAL_FILTERING']);

  const divergenceShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x;
      if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y;
      if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }
  `);

  const curlShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }
  `);

  const vorticityShader = createShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;
    void main () {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;
      velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  const pressureShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
    }
  `);

  const gradientSubtractShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  const displayShader = createShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform vec2 texelSize;
    uniform float exposure;
    uniform float glow;
    uniform float vapor;
    void main () {
      vec3 c = texture2D(uTexture, vUv).rgb;
      vec3 L = texture2D(uTexture, vL).rgb;
      vec3 R = texture2D(uTexture, vR).rgb;
      vec3 T = texture2D(uTexture, vT).rgb;
      vec3 B = texture2D(uTexture, vB).rgb;
      float center = length(c);
      float dx = length(R) - length(L);
      float dy = length(T) - length(B);
      vec3 n = normalize(vec3(dx, dy, max(length(texelSize) * 4.0, 0.001)));
      float diffuse = clamp(dot(n, normalize(vec3(-0.35, 0.55, 1.0))) + 0.78, 0.62, 1.22);

      vec2 d4 = texelSize * 4.0;
      vec2 d8 = texelSize * 8.0;
      vec3 soft = vec3(0.0);
      soft += texture2D(uTexture, vUv + vec2(d4.x, 0.0)).rgb;
      soft += texture2D(uTexture, vUv - vec2(d4.x, 0.0)).rgb;
      soft += texture2D(uTexture, vUv + vec2(0.0, d4.y)).rgb;
      soft += texture2D(uTexture, vUv - vec2(0.0, d4.y)).rgb;
      soft += texture2D(uTexture, vUv + vec2(d8.x, d8.y)).rgb;
      soft += texture2D(uTexture, vUv + vec2(-d8.x, d8.y)).rgb;
      soft += texture2D(uTexture, vUv + vec2(d8.x, -d8.y)).rgb;
      soft += texture2D(uTexture, vUv - vec2(d8.x, d8.y)).rgb;
      soft *= 0.125;

      float fog = smoothstep(0.025, 0.95, center);
      vec3 gas = mix(c, soft, clamp(vapor * (0.18 + fog * 0.34), 0.0, 0.58));
      gas *= diffuse;
      gas += soft * glow * (0.20 + fog * 0.55);
      gas += pow(max(c, vec3(0.0)), vec3(1.6)) * 0.16;
      gas = vec3(1.0) - exp(-gas * exposure);
      gas = pow(max(gas, 0.0), vec3(0.82));
      gl_FragColor = vec4(gas, 1.0);
    }
  `);

  const copyProgram = createProgram(baseVertex, copyShader);
  const clearProgram = createProgram(baseVertex, clearShader);
  const splatProgram = createProgram(baseVertex, splatShader);
  const advectionProgram = createProgram(baseVertex, advectionShader);
  const divergenceProgram = createProgram(baseVertex, divergenceShader);
  const curlProgram = createProgram(baseVertex, curlShader);
  const vorticityProgram = createProgram(baseVertex, vorticityShader);
  const pressureProgram = createProgram(baseVertex, pressureShader);
  const gradientSubtractProgram = createProgram(baseVertex, gradientSubtractShader);
  const displayProgram = createProgram(baseVertex, displayShader);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  let dye = null;
  let velocity = null;
  let divergence = null;
  let curl = null;
  let pressure = null;

  function blit(target) {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function createFBO(width, height, internalFormat, format, type, filter) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture,
      fbo,
      width,
      height,
      texelSizeX: 1 / width,
      texelSizeY: 1 / height,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
      destroy() {
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(fbo);
      },
    };
  }

  function createDoubleFBO(width, height, internalFormat, format, type, filter) {
    let one = createFBO(width, height, internalFormat, format, type, filter);
    let two = createFBO(width, height, internalFormat, format, type, filter);
    return {
      width,
      height,
      texelSizeX: one.texelSizeX,
      texelSizeY: one.texelSizeY,
      get read() { return one; },
      set read(value) { one = value; },
      get write() { return two; },
      set write(value) { two = value; },
      swap() { const temp = one; one = two; two = temp; },
      destroy() { one.destroy(); two.destroy(); },
    };
  }

  function resizeFBO(target, width, height, internalFormat, format, type, filter) {
    const next = createFBO(width, height, internalFormat, format, type, filter);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(next);
    target.destroy();
    return next;
  }

  function resizeDoubleFBO(target, width, height, internalFormat, format, type, filter) {
    if (target.width === width && target.height === height) return target;
    target.read = resizeFBO(target.read, width, height, internalFormat, format, type, filter);
    target.write.destroy();
    target.write = createFBO(width, height, internalFormat, format, type, filter);
    target.width = width;
    target.height = height;
    target.texelSizeX = 1 / width;
    target.texelSizeY = 1 / height;
    return target;
  }

  function getResolution(resolution) {
    let aspect = gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight);
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(resolution);
    const max = Math.round(resolution * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min }
      : { width: min, height: max };
  }

  function initFramebuffers() {
    const sim = getResolution(config.simResolution);
    const dyeRes = getResolution(config.dyeResolution);
    const filter = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);

    dye = dye
      ? resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, halfFloatType, filter)
      : createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, halfFloatType, filter);
    velocity = velocity
      ? resizeDoubleFBO(velocity, sim.width, sim.height, formatRG.internalFormat, formatRG.format, halfFloatType, filter)
      : createDoubleFBO(sim.width, sim.height, formatRG.internalFormat, formatRG.format, halfFloatType, filter);

    divergence?.destroy();
    curl?.destroy();
    pressure?.destroy();
    divergence = createFBO(sim.width, sim.height, formatR.internalFormat, formatR.format, halfFloatType, gl.NEAREST);
    curl = createFBO(sim.width, sim.height, formatR.internalFormat, formatR.format, halfFloatType, gl.NEAREST);
    pressure = createDoubleFBO(sim.width, sim.height, formatR.internalFormat, formatR.format, halfFloatType, gl.NEAREST);
  }

  function resizeFluidCanvas() {
    const rect = stage.getBoundingClientRect();
    const maxDpr = mobile ? 1.25 : 1.55;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxDpr);
    const width = Math.max(2, Math.round(rect.width * pixelRatio));
    const height = Math.max(2, Math.round(rect.height * pixelRatio));
    if (fluidCanvas.width === width && fluidCanvas.height === height) return false;
    fluidCanvas.width = width;
    fluidCanvas.height = height;
    return true;
  }

  function step(dt, signal) {
    gl.disable(gl.BLEND);
    const dynamicCurl = config.curl + signal.mid * 16 + signal.treble * 12 + interactionEnergy * 22;

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, dynamicCurl);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.pressure);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.pressureIterations; i += 1) {
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gradientSubtractProgram.bind();
    gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    const velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.velocityDissipation + interactionEnergy * 0.04);
    blit(velocity.write);
    velocity.swap();

    if (!supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.densityDissipation - Math.min(0.16, signal.energy * 0.12));
    blit(dye.write);
    dye.swap();
  }

  function renderFluid(signal) {
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    displayProgram.bind();
    gl.uniform2f(displayProgram.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
    gl.uniform1f(displayProgram.uniforms.exposure, 1.0 + signal.energy * 0.58 + intensityGain() * 0.28);
    gl.uniform1f(displayProgram.uniforms.glow, 0.38 + signal.treble * 0.55 + intensityGain() * 0.16);
    gl.uniform1f(displayProgram.uniforms.vapor, 0.80 + signal.mid * 0.24);
    blit(null);
  }

  function correctRadius(radius) {
    const aspect = fluidCanvas.width / Math.max(1, fluidCanvas.height);
    return aspect > 1 ? radius * aspect : radius;
  }

  function splat(x, y, dx, dy, color, radiusScale = 1) {
    if (!ready || contextLost || !velocity || !dye) return;
    const aspect = fluidCanvas.width / Math.max(1, fluidCanvas.height);
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, aspect);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius((config.splatRadius / 100) * radiusScale));
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius((config.splatRadius / 100) * radiusScale * 1.08));
    blit(dye.write);
    dye.swap();
  }

  function hsv(h, s, v) {
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const table = [
      [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q],
    ];
    const c = table[i % 6];
    return { r: c[0], g: c[1], b: c[2] };
  }

  function paletteColor(offset, energy = 0.5, strength = 1) {
    const gain = intensityGain();
    const h = hueClock + offset + energy * 0.055;
    const c = hsv(h, 0.78 + energy * 0.17, 0.78 + energy * 0.42);
    const brightness = (0.55 + gain * 0.62) * strength;
    return { r: c.r * brightness, g: c.g * brightness, b: c.b * brightness };
  }

  function intensityGain() {
    const raw = Number(intensityControl?.value ?? 1.35);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(0.55, Math.min(1.85, raw));
  }

  function readSignal() {
    if (typeof fastBeatSignal === 'function') {
      try {
        const s = fastBeatSignal();
        return {
          bass: clamp01(Number(s.bass) || 0),
          mid: clamp01(Number(s.mid) || 0),
          treble: clamp01(Number(s.treble) || 0),
          energy: clamp01(Number(s.energy) || ((Number(s.bass) || 0) + (Number(s.mid) || 0) + (Number(s.treble) || 0)) / 3),
          kick: clamp01(Number(s.kick) || 0),
        };
      } catch (_) {}
    }
    const bass = typeof smoothedBass === 'number' ? smoothedBass : 0;
    const mid = typeof smoothedMid === 'number' ? smoothedMid : 0;
    const treble = typeof smoothedTreble === 'number' ? smoothedTreble : 0;
    return {
      bass: clamp01(bass),
      mid: clamp01(mid),
      treble: clamp01(treble),
      energy: clamp01((bass + mid + treble) / 2.2),
      kick: clamp01(typeof pendulumEnergy === 'number' ? pendulumEnergy : bass),
    };
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }

  function injectKick(signal) {
    const count = mobile ? 4 : 6;
    const force = config.splatForce * (0.16 + signal.bass * 0.36 + signal.kick * 0.30);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + hueClock * 4.2;
      const spread = 0.025 + Math.random() * 0.03;
      const x = 0.5 + Math.cos(angle) * spread;
      const y = 0.5 + Math.sin(angle) * spread;
      const dx = Math.cos(angle) * force * (0.72 + Math.random() * 0.45);
      const dy = Math.sin(angle) * force * (0.72 + Math.random() * 0.45);
      splat(x, y, dx, dy, paletteColor(i / count * 0.28, signal.energy, 1.35), 1.05 + signal.bass * 0.65);
    }
  }

  function injectSnare(signal) {
    const force = config.splatForce * (0.10 + signal.treble * 0.26 + signal.mid * 0.12);
    const side = lastSnareInjection % 2 ? 1 : -1;
    const y1 = 0.36 + Math.random() * 0.28;
    const y2 = 1 - y1;
    splat(side > 0 ? 0.18 : 0.82, y1, side * force, force * 0.18, paletteColor(0.18, signal.energy, 1.25), 0.9);
    splat(side > 0 ? 0.82 : 0.18, y2, -side * force, -force * 0.16, paletteColor(0.58, signal.energy, 1.1), 0.9);
  }

  function injectMelody(signal, now) {
    if (now - lastAutoSplat < (mobile ? 72 : 52)) return;
    lastAutoSplat = now;
    const energy = 0.18 + signal.mid * 0.82;
    const t = now * 0.00038;
    const angle = t * 4.6 + Math.sin(t * 1.7) * 1.2;
    const radius = 0.08 + signal.mid * 0.16;
    const x = 0.5 + Math.cos(angle) * radius;
    const y = 0.5 + Math.sin(angle * 1.17) * radius * 0.82;
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const force = config.splatForce * (0.018 + energy * 0.055);
    splat(x, y, tangentX * force, tangentY * force, paletteColor(0.05 + Math.sin(t) * 0.08, signal.energy, 0.42 + signal.mid * 0.72), 0.65 + signal.mid * 0.55);
  }

  function injectAmbient(signal, now) {
    const silent = !audio || audio.paused;
    const interval = silent ? 950 : 420;
    if (now - lastAmbientSplat < interval) return;
    lastAmbientSplat = now;
    const t = now * 0.00022;
    const fromLeft = frameCounter % 2 === 0;
    const x = fromLeft ? 0.17 : 0.83;
    const y = 0.34 + 0.30 * (0.5 + 0.5 * Math.sin(t * 9.0));
    const dir = fromLeft ? 1 : -1;
    const force = config.splatForce * (silent ? 0.018 : 0.025 + signal.energy * 0.035);
    splat(x, y, dir * force, Math.sin(t * 5.0) * force * 0.45, paletteColor(fromLeft ? 0.0 : 0.47, signal.energy, silent ? 0.22 : 0.28 + signal.energy * 0.25), 0.9);
  }

  function driveFromAudio(signal, now) {
    hueClock += 0.0007 + signal.treble * 0.0018 + signal.mid * 0.0007;
    if (hueClock > 1) hueClock -= 1;

    const kickRise = signal.kick - previousKick;
    if ((signal.kick > 0.30 && kickRise > 0.045 && now - lastKickInjection > 95) || (signal.bass > 0.68 && kickRise > 0.018 && now - lastKickInjection > 145)) {
      lastKickInjection = now;
      injectKick(signal);
    }
    previousKick = signal.kick * 0.62 + previousKick * 0.38;

    const trebleRise = signal.treble - previousTreble;
    if (signal.treble > 0.28 && trebleRise > 0.035 && now - lastSnareInjection > 120) {
      lastSnareInjection = now;
      injectSnare(signal);
    }
    previousTreble = signal.treble * 0.55 + previousTreble * 0.45;

    if (!audio || audio.paused) {
      injectAmbient(signal, now);
      return;
    }
    injectMelody(signal, now);
    injectAmbient(signal, now);
  }

  const pointers = new Map();

  function pointerPosition(event) {
    const rect = fluidCanvas.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01(1 - (event.clientY - rect.top) / Math.max(1, rect.height)),
    };
  }

  fluidCanvas.addEventListener('pointerdown', (event) => {
    if (!active) return;
    if (event.pointerType !== 'mouse') event.preventDefault();
    fluidCanvas.setPointerCapture?.(event.pointerId);
    const pos = pointerPosition(event);
    pointers.set(event.pointerId, { ...pos, prevX: pos.x, prevY: pos.y, hue: hueClock + Math.random() * 0.25 });
    splat(pos.x, pos.y, 0, 0, paletteColor(Math.random() * 0.45, 0.7, 0.85), 1.15);
    interactionEnergy = Math.min(1.4, interactionEnergy + 0.16);
  });

  fluidCanvas.addEventListener('pointermove', (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!active || !pointer) return;
    if (event.pointerType !== 'mouse') event.preventDefault();
    const pos = pointerPosition(event);
    let dx = pos.x - pointer.x;
    let dy = pos.y - pointer.y;
    const aspect = fluidCanvas.width / Math.max(1, fluidCanvas.height);
    if (aspect < 1) dx *= aspect;
    if (aspect > 1) dy /= aspect;
    const speed = Math.min(1, Math.hypot(dx, dy) * 12);
    const force = config.splatForce * (0.42 + speed * 0.95);
    const color = hsv(pointer.hue + speed * 0.18, 0.84, 1.1);
    const gain = 0.65 + intensityGain() * 0.55;
    splat(pos.x, pos.y, dx * force, dy * force, { r: color.r * gain, g: color.g * gain, b: color.b * gain }, 0.85 + speed * 0.55);
    pointer.prevX = pointer.x;
    pointer.prevY = pointer.y;
    pointer.x = pos.x;
    pointer.y = pos.y;
    pointer.hue += 0.002 + speed * 0.012;
    interactionEnergy = Math.min(1.5, interactionEnergy + speed * 0.22);
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    try { fluidCanvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
  }
  fluidCanvas.addEventListener('pointerup', releasePointer);
  fluidCanvas.addEventListener('pointercancel', releasePointer);
  fluidCanvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function randomSeedSplats() {
    const amount = mobile ? 7 : 10;
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.18;
      const x = 0.5 + Math.cos(angle) * radius;
      const y = 0.5 + Math.sin(angle) * radius;
      const force = config.splatForce * (0.018 + Math.random() * 0.035);
      splat(x, y, Math.cos(angle + Math.PI / 2) * force, Math.sin(angle + Math.PI / 2) * force, paletteColor(i / amount * 0.7, 0.45, 0.35), 1.1);
    }
  }

  function frame(now) {
    animationFrame = requestAnimationFrame(frame);
    if (!active || !ready || contextLost || document.hidden) {
      lastFrameTime = now;
      return;
    }

    const elapsed = now - lastFrameTime;
    lastFrameTime = now;
    const dt = Math.min(0.016666, Math.max(0.001, elapsed / 1000));
    if (resizeFluidCanvas()) initFramebuffers();

    if (elapsed > 38) slowFrameScore += 1;
    else slowFrameScore = Math.max(0, slowFrameScore - 1);
    if (slowFrameScore > 90 && config.dyeResolution > 256) {
      config.dyeResolution = Math.max(256, Math.round(config.dyeResolution * 0.78));
      config.simResolution = Math.max(72, Math.round(config.simResolution * 0.86));
      initFramebuffers();
      slowFrameScore = 0;
    }

    const signal = readSignal();
    driveFromAudio(signal, now);
    interactionEnergy *= 0.965;
    step(dt, signal);
    renderFluid(signal);
    frameCounter += 1;
  }

  function choose() {
    active = selector.value === 'fluidGas' && ready && !contextLost;
    window.sinestesiaFluidGasActive = active;
    fluidCanvas.hidden = !active;
    fluidCanvas.style.display = active ? 'block' : 'none';
    baseCanvas.style.visibility = active || window.sinestesiaPlasmaWebGLActive ? 'hidden' : 'visible';
    if (active) {
      if (notice) notice.textContent = 'Fluido Gas activo · arrastra el dedo para empujar el plasma.';
      if (resizeFluidCanvas()) initFramebuffers();
      if (frameCounter < 2) randomSeedSplats();
    } else if (selector.value === 'fluidGas' && !ready) {
      if (notice) notice.textContent = 'Fluido Gas no está disponible en este dispositivo. Se mantiene Plasma.';
      selector.value = 'plasma';
      baseCanvas.style.visibility = 'visible';
    } else if (notice && notice.textContent.startsWith('Fluido Gas')) {
      notice.textContent = '';
    }
  }

  fluidCanvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    ready = false;
    choose();
  });

  fluidCanvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    try {
      resizeFluidCanvas();
      initFramebuffers();
      ready = true;
    } catch (error) {
      console.warn('No se pudo restaurar Fluido Gas:', error);
      ready = false;
    }
    choose();
  });

  try {
    gl.clearColor(0, 0, 0, 1);
    resizeFluidCanvas();
    initFramebuffers();
    ready = true;
    addFluidOption(true);
    randomSeedSplats();
  } catch (error) {
    console.warn('Fluido Gas no disponible:', error);
    ready = false;
    addFluidOption(false);
  }

  selector.addEventListener('change', choose);
  window.addEventListener('resize', () => {
    if (active && resizeFluidCanvas()) initFramebuffers();
  });
  document.addEventListener('visibilitychange', () => { lastFrameTime = performance.now(); });

  choose();
  animationFrame = requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
})();
