(() => {
  const input = document.getElementById('audioFile'), player = document.getElementById('audio');
  const start = document.getElementById('separateStart'), cancel = document.getElementById('separateCancel');
  const progress = document.getElementById('separateProgress'), message = document.getElementById('separateStatus');
  const results = document.getElementById('separateResults'), original = document.getElementById('separateOriginal');
  const output = document.getElementById('separateOutput'), jump = document.getElementById('separateJump');
  const router = window.sinestesiaStemRouter;
  const mode = document.getElementById('audioAnalysisMode');

  const style = document.createElement('style');
  style.textContent = `
    #separationEditor{overflow:hidden}
    #separateOutput{margin-top:18px;border:1px solid #2c3139;border-radius:18px;background:#07090b;overflow:hidden}
    #separateOutputTitle{margin:0;padding:16px 18px 5px;font-size:17px;color:#f3f6f8}
    #separateOutput>.spectrum-help{margin:0;padding:0 18px 14px;color:#89939c}
    #separateResults{display:grid!important;gap:0!important;border-top:1px solid #252a30}
    #separateResults .stem-row{display:grid!important;grid-template-columns:minmax(115px,170px) minmax(0,1fr) minmax(150px,210px);grid-template-areas:'meta wave assign' 'meta wave controls';align-items:stretch;gap:0!important;width:100%;min-height:108px;border-bottom:1px solid #252a30;background:#090c0f;box-sizing:border-box}
    #separateResults .stem-row:nth-child(even){background:#0b0f12}
    #separateResults .stem-row.is-playing{background:#10191d;box-shadow:inset 3px 0 0 #6ee7d8}
    .stem-meta{grid-area:meta;padding:13px 12px;border-right:1px solid #252a30;display:flex;flex-direction:column;justify-content:center;min-width:0}
    .stem-meta h4{margin:0 0 5px;font-size:14px;color:#eef7f6;white-space:normal}
    .stem-description{margin:0;color:#7f8c95;font-size:10px;line-height:1.35}
    .stem-wave{grid-area:wave;display:flex;align-items:center;padding:9px 10px;min-width:0;overflow:hidden}
    .stem-wave canvas{width:100%!important;height:74px!important;display:block!important;background:#102d35!important;border-radius:8px!important}
    .stem-assign{grid-area:assign;padding:10px 12px 5px;border-left:1px solid #252a30;display:grid;align-content:center;gap:5px;color:#9da8b0;font-size:10px}
    .stem-assign strong{color:#dbe7e6;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
    .stem-assign select{width:100%;min-height:40px;border:1px solid #3b444c;border-radius:9px;background:#141a1f;color:#eff7f7;padding:7px;font-size:12px}
    .stem-controls{grid-area:controls;padding:5px 12px 10px;border-left:1px solid #252a30;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .stem-controls button{min-height:36px;border:1px solid #3b444c;border-radius:9px;background:#141a1f;color:#e9f1f1;padding:6px 10px;font-size:11px}
    .stem-controls button:hover{background:#1c262d}
    .separation-track-head{display:grid;grid-template-columns:minmax(115px,170px) minmax(0,1fr) minmax(150px,210px);background:#0d1115;border-top:1px solid #252a30;color:#68747d;font-size:9px;text-transform:uppercase;letter-spacing:.08em}
    .separation-track-head span{padding:7px 12px}.separation-track-head span+span{border-left:1px solid #252a30}
    @media(max-width:680px){
      #separateResults .stem-row{grid-template-columns:105px minmax(0,1fr);grid-template-areas:'meta wave' 'assign assign' 'controls controls';min-height:auto}
      .stem-meta{padding:10px 8px}.stem-wave{padding:8px}.stem-wave canvas{height:62px!important}
      .stem-assign,.stem-controls{border-left:0;border-top:1px solid #20262b;padding:8px 10px}
      .separation-track-head{display:none}
    }
  `;
  document.head.append(style);

  window.sinestesiaAnalysisMode = 'spectrum';
  function applyMode() {
    const separating = mode.value === 'separation';
    window.sinestesiaAnalysisMode = mode.value;
    document.getElementById('spectrumEditor').hidden = separating;
    document.getElementById('separationEditor').hidden = !separating;
    if (!separating) {
      stop('Modo por frecuencias activo.');
      player.pause();
      if (typeof currentObjectUrl !== 'undefined' && currentObjectUrl) { player.src = currentObjectUrl; player.load(); }
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
    canvas.width = 1200; canvas.height = 100;
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Forma de onda de ' + label);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#63d8e4';
    const stride = Math.max(1, Math.ceil(samples.length / canvas.width));
    for (let x=0;x<canvas.width;x++) {
      let peak=0;
      for(let i=x*stride;i<Math.min(samples.length,(x+1)*stride);i++) peak=Math.max(peak,Math.abs(samples[i]));
      const height=Math.max(1,Math.min(1,peak)*92);
      ctx.fillRect(x,50-height/2,1,height);
    }
    return {canvas, envelope: StemTimeline.envelope(buffer)};
  }

  jump.addEventListener('click',()=>{output.scrollIntoView({behavior:'smooth',block:'start'});output.focus({preventScroll:true});});
  const duration = document.getElementById('separateDuration'), from = document.getElementById('separateFrom');
  const labels = { drums:'Batería', bass:'Bajo', other:'Otros / melodía', vocals:'Voz', kickEstimate:'Kick', snareEstimate:'Snare', cymbalEstimate:'Platillos' };
  let worker = null, generation = 0, urls = [], originalUrl = null, selected = null, selectedFile = null;
  const stop = text => { generation++; window.sinestesiaSeparating=false; worker?.terminate(); worker=null; start.disabled=!input.files?.length; cancel.disabled=true; duration.disabled=false; from.disabled=false; progress.hidden=true; if(text)message.textContent=text; };
  function release() { router.clear(); urls.forEach(URL.revokeObjectURL);urls=[];if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=null;results.replaceChildren();output.hidden=true;jump.hidden=true;original.hidden=true;selected=null; }
  input.addEventListener('change', () => { stop();release();selectedFile=input.files?.[0]||null;start.disabled=!selectedFile;message.textContent=selectedFile?'Canción lista. Pulsa «Separar con IA» para crear las pistas.':'Primero carga una canción.'; });
  document.getElementById('separateChoose').addEventListener('click',()=>input.click());
  cancel.addEventListener('click',()=>{stop('Proceso cancelado.');release();});
  const updateTrack = () => { if(!selected)return;document.getElementById('trackName').textContent=selected;document.getElementById('compactTrack').textContent=selected;document.getElementById('status').textContent=`Reproduciendo: ${selected}`; };
  player.addEventListener('play',updateTrack);
  async function listen(url,label,stem=null,position=0) {
    router.timeline.solo=stem;
    player.pause();player.src=url;selected=label;player.load();
    if(position)player.currentTime=position;
    try { if(typeof ensureAudioGraph==='function')ensureAudioGraph();await player.play();updateTrack(); }
    catch(_){updateTrack();document.getElementById('status').textContent=`Lista: ${label}. Pulsa reproducir.`;}
  }
  original.addEventListener('click',()=>{if(originalUrl)listen(originalUrl,`${selectedFile.name} · mezcla completa`,null,router.timeline.offset);});

  start.addEventListener('click',async()=>{
    const file=input.files?.[0];if(!file || window.sinestesiaAnalysisMode !== 'separation')return;
    stop();release();selectedFile=file;const token=generation;
    start.disabled=true;cancel.disabled=false;duration.disabled=true;from.disabled=true;progress.hidden=false;progress.removeAttribute('value');
    window.sinestesiaSeparating=true;
    output.hidden=false;jump.hidden=false;
    results.innerHTML='<div style="padding:18px;color:#8d979f">Preparando pistas…</div>';
    output.scrollIntoView({behavior:'smooth',block:'start'});
    message.textContent='Preparando el audio para separación. Puedes cancelar.';
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
      worker=new Worker(new URL('./separator-assets/worker.js?v=responsive2',import.meta.url),{type:'module'});
      worker.onerror=()=>{if(token===generation){release();stop('No se pudo iniciar la IA. Recarga la página o prueba un navegador actualizado.');}};
      worker.onmessageerror=()=>{if(token===generation){release();stop('No se pudieron recibir las pistas. Prueba un fragmento de 15 segundos.');}};
      worker.onmessage=async event=>{
        if(token!==generation)return;
        const data=event.data;
        if(data.type==='status'){message.textContent=data.text;progress.removeAttribute('value');}
        if(data.type==='download'){progress.value=Math.min(1,data.loaded/data.total);message.textContent=`Descargando modelo IA: ${(data.loaded/1e6).toFixed(0)} / ${(data.total/1e6).toFixed(0)} MB.`;}
        if(data.type==='progress'){progress.value=data.step/data.total;message.textContent=`Separando ${seconds.toFixed(1)} s · ${data.engine || 'IA'} · ${data.step}/${data.total}`;}
        if(data.type==='error'){release();stop(`No se pudo separar: ${data.text}`);return;}
        if(data.type==='done'){
          worker?.terminate();worker=null;
          try {
            const names=Object.keys(labels);
            if(!data.wavs || names.some(name=>!(data.wavs[name] instanceof Blob)))throw Error('La separación no devolvió todas las pistas.');
            message.textContent='Construyendo mesa multipista…'; progress.value=0;
            const pending=document.createDocumentFragment();
            const head=document.createElement('div');head.className='separation-track-head';head.innerHTML='<span>Pista</span><span>Forma de onda</span><span>Asignación visual</span>';pending.append(head);
            for(const [index,name] of names.entries()){
              if(token!==generation)return;
              const url=URL.createObjectURL(data.wavs[name]);urls.push(url);
              const row=document.createElement('article');row.className='stem-row';row.dataset.stem=name;

              const meta=document.createElement('div');meta.className='stem-meta';
              const title=document.createElement('h4');title.textContent=labels[name];
              const description=document.createElement('p');description.className='stem-description';description.textContent=name.endsWith('Estimate')?'Banda estimada':'Pista separada por IA';
              meta.append(title,description);

              const wave=await waveform(data.wavs[name],labels[name]);
              if(token!==generation)return;
              router.timeline.tracks.set(name,wave.envelope);
              const waveWrap=document.createElement('div');waveWrap.className='stem-wave';waveWrap.append(wave.canvas);

              const assignment=document.createElement('label');assignment.className='stem-assign';
              const assignTitle=document.createElement('strong');assignTitle.textContent='Visual asignado';
              const select=document.createElement('select');select.setAttribute('aria-label','Visual para '+labels[name]);
              for(const [value,text] of [['','Sin efecto'],...router.modes.map(([id,label])=>[id,label])]) { const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option); }
              select.value=''; router.timeline.routes.set(name,'');
              select.addEventListener('change',()=>{router.timeline.routes.set(name,select.value);router.refresh();});
              assignment.append(assignTitle,select);

              const controls=document.createElement('div');controls.className='stem-controls';
              const listenButton=document.createElement('button');listenButton.type='button';listenButton.textContent='▶ Escuchar';listenButton.addEventListener('click',()=>{results.querySelectorAll('article').forEach(card=>card.classList.remove('is-playing'));row.classList.add('is-playing');listen(url,`${file.name} · ${labels[name]}`,name);});
              const clearButton=document.createElement('button');clearButton.type='button';clearButton.textContent='Quitar visual';clearButton.addEventListener('click',()=>{select.value='';select.dispatchEvent(new Event('change'));});
              controls.append(listenButton,clearButton);

              row.append(meta,waveWrap,assignment,controls);pending.append(row);
              progress.value=(index+1)/names.length; message.textContent=`Preparando pista ${index+1}/${names.length}…`;
              await new Promise(resolve=>setTimeout(resolve,0));
            }
            if(token!==generation)return;
            router.timeline.offset=offset;router.timeline.duration=seconds;
            results.replaceChildren(pending);output.hidden=false;jump.hidden=false;router.refresh();
            original.textContent='▶ Reproducir mezcla con visuales asignados';
            stop(`Separación terminada: ${names.length} pistas listas. Ahora asigna manualmente un visual a cada pista.`);
            output.scrollIntoView({behavior:'smooth',block:'start'});output.focus({preventScroll:true});
          }catch(error){if(token!==generation)return;release();stop(`No se pudieron preparar las pistas: ${error.message}`);}
        }
      };
      worker.postMessage({type:'separate',channelData,engine:document.getElementById('separateEngine').value},channelData.map(c=>c.buffer));
    }catch(error){if(token===generation){release();stop(`No se pudo preparar el audio: ${error.message}`);}}
  });

  applyMode();
  window.addEventListener('beforeunload',()=>{worker?.terminate();release();});
})();
