# Separación de audio: fuentes y límites

Investigado e integrado el 17 de octubre de 2026.

- **Meta Demucs v4 (HTDemucs)**: https://github.com/facebookresearch/demucs
  Red neuronal de separación de voz, batería, bajo y otros. No identifica todos los instrumentos por separado.
  La variante de seis pistas añade guitarra y piano, pero el README oficial advierte de filtraciones y artefactos en piano. No se incorpora como si fuera fiable.
- **Demucs in JavaScript 1.0.0**, Kevin Gibbons y colaboradores: https://github.com/bakkot/demucs-js
  Se conservan `apply.js`, `dsp.js` y `wav-utils.js` sin modificar, procedentes del paquete npm con versión fija, y su licencia en `vendor/demucs/LICENSE.md`.
  Código MIT. Los pesos HTDemucs tienen condiciones separadas de Meta: uso personal e investigación. Este proyecto no concede derechos comerciales sobre los pesos.
  El modelo de 174 MB se extrae del paquete npm, verificando su integridad SHA-512 y su SHA-256; no se versiona el binario en Git.
- **ONNX Runtime Web 1.23.0**, Microsoft: https://github.com/microsoft/onnxruntime (MIT).
  Se ejecuta en un Web Worker con WebGPU cuando está disponible o WASM de un hilo, compatible con GitHub Pages sin aislamiento entre orígenes.
- Revisados también https://github.com/timcsy/demucs-web y https://github.com/nomadkaraoke/python-audio-separator.
  No se copió su código. https://github.com/sevagh/free-music-demixer declara pesos y otros activos propietarios; no se redistribuyen dichos activos.

## Visualizador Fluido Gas · Plasma + Vapor

- **WebGL Fluid Simulation**, Pavel Dobryakov: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
  `fluid-visualizer.js` integra el solver, los shaders, bloom y sunrays del `script.js` original (blob d0db5af6bac342d9eb00205435d8b8997ebee815). Se retiraron promoción, analítica y dat.GUI; se añadieron controles Pointer Events relativos al escenario, acoplamiento al audio de Sinestesia, límites de resolución móvil y manejo visible de errores. La textura de dithering se reemplazó por un texel neutro local. Licencia MIT, Copyright (c) 2017 Pavel Dobryakov. La cabecera de licencia se conserva dentro del archivo adaptado.
- **Quiet Current**, HAMIM71: https://github.com/HAMIM71/Quiet-Current
  Se estudió como referencia para la idea de acoplar energía de interacción con un fluido y música. Quiet Current declara estar construido sobre el mismo motor MIT de Pavel Dobryakov. No se incorporó su motor musical generativo: Sinestesia usa su propio analizador, detección de kick/snare/melodía y sus propios emisores de color/velocidad.

El modo Fluido Gas añade sobre el solver: emisión radial por kick, inyecciones laterales por ataques de agudos/snare, flujo continuo por medios/melodía, control táctil con Pointer Events, paleta plasma/vapor, sombreado gaseoso y ajuste dinámico de resolución para móvil.

## Qué se separa

La IA genera **voz, batería, bajo y otros**. Piano, sintetizadores y efectos suelen compartir `otros`. Los vocal chops pueden quedar en voz u otros. No se presentan nombres de instrumentos que el modelo no ha separado.

Las tres salidas adicionales de kick, snare y platillos son **bandas aproximadas filtradas de la batería ya separada por IA**: no son otro modelo de separación de instrumentos. Pueden contener toms, resonancias y filtraciones, y perder componentes del kick o el snare. Las tres bandas suman la pista de batería antes de cuantización. No se promete aislamiento perfecto.

La canción y las pistas se procesan localmente. Solo se descargan el runtime y el modelo desde este mismo sitio. El usuario inicia expresamente el procesamiento. En móviles puede requerir mucha memoria y varios minutos; se ofrece un fragmento de 30 s por defecto y cancelación real que termina el worker. Cada operación admite hasta cinco minutos. Las pistas WAV se pueden escuchar en el visualizador y descargar.

## Construcción y validación

`npm ci` y `npm run build:web` generan `dist/`, incluido el runtime y el modelo verificado. Para otro destino: `npm run build:web -- --outdir /ruta/destino`.

El separador se descarga al pulsar el botón; la visualización y los detectores existentes siguen funcionando sin cargarlo. Demucs es una separación aproximada; los artefactos no significan que cada pista corresponda exactamente a un instrumento. La detección de frecuencias del visualizador y la separación neuronal son procesos diferentes.


## Lagrangian particle advection

`lagrangian-visualizer.js` adapts the RK4 particle advection and space/time
velocity interpolation from `simulation/app/src/main/assets/compute_shader.glsl`
in https://github.com/MartinOpat/Lagrangian-fluid-simulation-for-Android.
Copyright (c) 2024 MartinOpat (University of Groningen), MIT.
Full license: [vendor/lagrangian/LICENSE](vendor/lagrangian/LICENSE).
The browser port uses 2D procedural music-driven fields (vortex, currents and
turbulence); these are new presets, not upstream physical fluid models. It does
not load NetCDF data or use the upstream Android native/compute-shader runtime.
Reference: Martin Opat, Julian Koellermeier and Christian Kehl, “Lagrangian fluid
transport simulation using mobile devices”, Simulation Modelling Practice and
Theory 145 (2025), 103214. https://doi.org/10.1016/j.simpat.2025.103214
