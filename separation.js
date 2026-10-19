(() => {
  const input = document.getElementById('audioFile'), player = document.getElementById('audio');
  const start = document.getElementById('separateStart'), cancel = document.getElementById('separateCancel');
  const progress = document.getElementById('separateProgress'), message = document.getElementById('separateStatus');
  const results = document.getElementById('separateResults'), original = document.getElementById('separateOriginal');
  const output = document.getElementById('separateOutput'), jump = document.getElementById('separateJump');
  const router = window.sinestesiaStemRouter;
  const mode = document.getElementById('audioAnalysisMode');
  window.sinestesiaAnalysisMode = 'spectrum';
  function applyMode() {
    const separating = mode.value === 'separation';
    window.sinestesiaAnalysisMode = mode.value;
    document.getElementById('spectrumEditor').hidden = separating;
    document.getElementById('separationEditor').hidden = !separating;
    if (!separating) {
      stop('Modo espectrograma activo.');
      player.pause();
      if (typeof currentObjectUrl !== 'undefined' && currentObjectUrl) {
        player.src = currentObjectUrl; player.load();
      }
      release();
      const name = input.files?.[0]?.name || 'Sin canción';
      document.getElementById('trackName').textContent = name;
      document.getElementById('compactTrack').textContent = name;
    }
    router.refresh();
    if (typeof resetVisualState === 'function') resetVisualState();
    window.dispatchEvent(new Event('sinestesia-detection-change'));
  }
  mode.addEventListener('change', applyMode);
  async function waveform(blob, label) {
    const decoder = new OfflineAudioContext(1, 1, 22050);
    const buffer = await decoder.decodeAudioData(await blob.arrayBuffer());
    const samples = buffer.getChannelData(0);
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 100;
    canvas.style.cssText = 'width:100%;height:72px;display:block;background:#11262e;border-radius:8px';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Forma de onda de ' + label);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#62dbe7';
    const stride = Math.max(1, Math.ceil(samples.length / canvas.width));
    for (let x=0;x<canvas.width;x++) {
      let peak=0;
      for(let i=x*stride;i<Math.min(samples.length,(x+1)*stride);i++) peak=Math.max(peak,Math.abs(samples[i]));
      const height=Math.max(1,Math.min(1,peak)*96);
      ctx.fillRect(x,50-height/2,1,height);
    }
    return {canvas, envelope: StemTimeline.envelope(buffer)};
  }
  jump.addEventListener('click',()=>{output.scrollIntoView({behavior:'smooth',block:'start'});output.focus({preventScroll:true});});
  const duration = document.getElementById('separateDuration'), from = document.getElementById('separateFrom');
  const labels = { drums:'Batería · IA',bass:'Bajo · IA',other:'Otros / melodía · IA',vocals:'Voz · IA',kickEstimate:'Kick · banda estimada',snareEstimate:'Snare · banda estimada',cymbalEstimate:'Platillos · banda estimada' };
  let worker = null, generation = 0, urls = [], originalUrl = null, selected = null, selectedFile = null;
  const stop = text => { generation++; window.sinestesiaSeparating=false; worker?.terminate(); worker=null; start.disabled=!input.files?.length; cancel.disabled=true; duration.disabled=false; from.disabled=false; progress.hidden=true; if(text)message.textContent=text; };
  function release() { router.clear(); urls.forEach(URL.revokeObjectURL);urls=[];if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=null;results.replaceChildren();output.hidden=true;jump.hidden=true;original.hidden=true;selected=null; }
  input.addEventListener('change', () => { stop();release();selectedFile=input.files?.[0]||null;start.disabled=!selectedFile;message.textContent=selectedFile?'Lista para separar. Se procesa en este dispositivo; la canción no se sube.':'Primero carga una canción.'; });
  document.getElementById('separateChoose').addEventListener('click',()=>input.click());
  cancel.addEventListener('click',()=>{stop('Proceso cancelado. Puedes volver a intentarlo.');release();});
  const updateTrack = () => { if(!selected)return;document.getElementById('trackName').textContent=selected;document.getElementById('compactTrack').textContent=selected;document.getElementById('status').textContent=`Reproduciendo: ${selected}`; };
  player.addEventListener('play',updateTrack);
  async function listen(url,label,stem=null,position=0) {
    router.timeline.solo=stem;
    player.pause();player.src=url;selected=label;player.load();
    if(position)player.currentTime=position;
    try { if(typeof ensureAudioGraph==='function')ensureAudioGraph();await player.play();updateTrack(); }
    catch(_){updateTrack();document.getElementById('status').textContent=`Lista: ${label}. Pulsa reproducir.`;}
  }
  original.addEventListener('click',()=>{if(originalUrl)listen(originalUrl,`${selectedFile.name} · original`,null,router.timeline.offset);});
  start.addEventListener('click',async()=>{
    const file=input.files?.[0];if(!file || window.sinestesiaAnalysisMode !== 'separation')return;
    stop();release();selectedFile=file;const token=generation;
    start.disabled=true;cancel.disabled=false;duration.disabled=true;from.disabled=true;progress.hidden=false;progress.removeAttribute('value');
    window.sinestesiaSeparating=true;
    output.hidden=false;jump.hidden=false;
    for(const label of Object.values(labels)) {
      const row=document.createElement('article');row.className='stem-row';
      const title=document.createElement('h4');title.textContent=label;
      const detail=document.createElement('p');detail.className='stem-description';detail.textContent='En preparación… Aquí aparecerá la onda de esta pista.';
      row.append(title,detail);results.append(row);
    }
    output.scrollIntoView({behavior:'smooth',block:'start'});
    message.textContent='Preparando el fragmento. Puedes seguir escuchando la canción o cancelar.';
    try {
      const bytes=await file.arrayBuffer();if(token!==generation)return;
      const decoder=new OfflineAudioContext(2,1,44100);
      const decoded=await decoder.decodeAudioData(bytes);if(token!==generation)return;
      const offset=Math.max(0,Number(from.value)||0);
      if(offset>=decoded.duration)throw Error('El inicio está fuera de la duración de la canción.');
      const seconds=Math.min(decoded.duration-offset,duration.value==='full'?300:Number(duration.value));
      const begin=Math.floor(offset*44100),end=Math.min(decoded.length,begin+Math.floor(seconds*44100));
      const channelData=[decoded.getChannelData(0).slice(begin,end),decoded.getChannelData(Math.min(1,decoded.numberOfChannels-1)).slice(begin,end)];
      if(!channelData[0].length)throw Error('El fragmento está vacío.');
      originalUrl=URL.createObjectURL(file);original.hidden=false;
      worker=new Worker(new URL('./separator-assets/worker.js?v=responsive1',import.meta.url),{type:'module'});
      worker.onerror=()=>{if(token===generation){release();stop('No se pudo iniciar la IA. Recarga la página o prueba un navegador actualizado.');}};
      worker.onmessageerror=()=>{if(token===generation){release();stop('No se pudieron recibir las pistas. Prueba un fragmento de 15 segundos.');}};
      worker.onmessage=async event=>{
        if(token!==generation)return;
        const data=event.data;
        if(data.type==='status'){message.textContent=data.text;progress.removeAttribute('value');}
        if(data.type==='download'){progress.value=Math.min(1,data.loaded/data.total);message.textContent=`Descargando modelo IA: ${(data.loaded/1e6).toFixed(0)} / ${(data.total/1e6).toFixed(0)} MB. La canción sigue en tu dispositivo.`;}
        if(data.type==='progress'){progress.value=data.step/data.total;message.textContent=`Separando fragmento de ${seconds.toFixed(1)} s · ${data.engine || 'IA'} · segmento ${data.step}/${data.total}. Puedes cancelar.`;}
        if(data.type==='error'){release();stop(`No se pudo separar: ${data.text} Prueba un fragmento más corto o un ordenador.`);return;}
        if(data.type==='done'){
          // Release the model before WAV encoding to avoid retaining its memory on phones.
          worker?.terminate();worker=null;
          try {
            const names=Object.keys(labels);
            if(!data.wavs || names.some(name=>!(data.wavs[name] instanceof Blob)))throw Error('La separación no devolvió todas las pistas.');
            message.textContent='Dibujando las ondas de las pistas…';
            progress.value=0;
            const pending=document.createDocumentFragment();
            for(const [index,name] of names.entries()){
              if(token!==generation)return;
              const url=URL.createObjectURL(data.wavs[name]);urls.push(url);
              const row=document.createElement('article');row.className='stem-row';row.dataset.stem=name;
              const title=document.createElement('h4');title.textContent=labels[name];
              const description=document.createElement('p');description.className='stem-description';description.textContent=`${seconds.toFixed(1)} s · ${name.endsWith('Estimate')?'Banda aproximada de batería':'Pista separada con IA'}`;
              const button=document.createElement('button');button.type='button';button.textContent='▶ Escuchar';button.setAttribute('aria-label',`Escuchar ${labels[name]}`);button.addEventListener('click',()=>{
                results.querySelectorAll('article').forEach(card=>card.classList.remove('is-playing'));
                row.classList.add('is-playing');listen(url,`${file.name} · ${labels[name]}`,name);
              });
              const wave=await waveform(data.wavs[name],labels[name]);
              if(token!==generation)return;
              router.timeline.tracks.set(name,wave.envelope);
              const assignment=document.createElement('label');
              assignment.textContent='Fluido que controla ';
              const select=document.createElement('select');
              select.setAttribute('aria-label','Fluido para '+labels[name]);
              for(const [value,text] of [['','Sin efecto'],...router.modes.map(([id,label])=>[id,label])]) {
                const option=document.createElement('option');option.value=value;option.textContent=text;
                select.append(option);
              }
              select.value=({drums:'electricIris',bass:'plasma',other:'fluidGas',vocals:'lagrangian:vortex'})[name]||'';
              router.timeline.routes.set(name,select.value);
              select.addEventListener('change',()=>{router.timeline.routes.set(name,select.value);router.refresh();});
              assignment.append(select);
              row.append(title,description,wave.canvas,assignment,button);pending.append(row);
              progress.value=(index+1)/names.length;
              message.textContent=`Preparando pistas ${index+1}/${names.length}…`;
              await new Promise(resolve=>setTimeout(resolve,0));
            }
            if(token!==generation)return;
            router.timeline.offset=offset;router.timeline.duration=seconds;
            results.replaceChildren(pending);output.hidden=false;jump.hidden=false;
            router.refresh();
            original.textContent='▶ Canción con todos los fluidos';
            message.textContent='Pistas conectadas. Reproduce la canción para ver los fluidos sincronizados.';
            stop(`Separación terminada: ${names.length} cuadrículas listas abajo. 4 pistas IA y 3 bandas estimadas. Fragmento ${offset.toFixed(1)}–${(offset+seconds).toFixed(1)} s.`);
            output.scrollIntoView({behavior:'smooth',block:'start'});output.focus({preventScroll:true});
          }catch(error){
            if(token!==generation)return;
            release();stop(`No se pudieron preparar las pistas: ${error.message} Prueba un fragmento de 15 segundos.`);
          }
        }
      };
      worker.postMessage({type:'separate',channelData,engine:document.getElementById('separateEngine').value},channelData.map(c=>c.buffer));
    }catch(error){if(token===generation){release();stop(`No se pudo preparar el audio: ${error.message}`);}}
  });
  applyMode();
  window.addEventListener('beforeunload',()=>{worker?.terminate();release();});
})();
