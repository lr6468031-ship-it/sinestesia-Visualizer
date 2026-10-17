(() => {
  const input = document.getElementById('audioFile'), player = document.getElementById('audio');
  const start = document.getElementById('separateStart'), cancel = document.getElementById('separateCancel');
  const progress = document.getElementById('separateProgress'), message = document.getElementById('separateStatus');
  const results = document.getElementById('separateResults'), original = document.getElementById('separateOriginal');
  const output = document.getElementById('separateOutput'), jump = document.getElementById('separateJump');
  jump.addEventListener('click',()=>{output.scrollIntoView({behavior:'smooth',block:'start'});output.focus({preventScroll:true});});
  const duration = document.getElementById('separateDuration'), from = document.getElementById('separateFrom');
  const labels = { drums:'Batería · IA',bass:'Bajo · IA',other:'Otros / melodía · IA',vocals:'Voz · IA',kickEstimate:'Kick · banda estimada',snareEstimate:'Snare · banda estimada',cymbalEstimate:'Platillos · banda estimada' };
  let worker = null, generation = 0, urls = [], originalUrl = null, selected = null, selectedFile = null;
  const stop = text => { generation++; window.sinestesiaSeparating=false; worker?.terminate(); worker=null; start.disabled=!input.files?.length; cancel.disabled=true; duration.disabled=false; from.disabled=false; progress.hidden=true; if(text)message.textContent=text; };
  function release() { urls.forEach(URL.revokeObjectURL);urls=[];if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=null;results.replaceChildren();output.hidden=true;jump.hidden=true;original.hidden=true;selected=null; }
  input.addEventListener('change', () => { stop();release();selectedFile=input.files?.[0]||null;start.disabled=!selectedFile;message.textContent=selectedFile?'Lista para separar. Se procesa en este dispositivo; la canción no se sube.':'Primero carga una canción.'; });
  document.getElementById('separateChoose').addEventListener('click',()=>input.click());
  cancel.addEventListener('click',()=>{stop('Proceso cancelado. Puedes volver a intentarlo.');release();});
  const updateTrack = () => { if(!selected)return;document.getElementById('trackName').textContent=selected;document.getElementById('compactTrack').textContent=selected;document.getElementById('status').textContent=`Reproduciendo: ${selected}`; };
  player.addEventListener('play',updateTrack);
  async function listen(url,label) {
    player.pause();player.src=url;selected=label;player.load();
    try { if(typeof ensureAudioGraph==='function')ensureAudioGraph();await player.play();updateTrack(); }
    catch(_){updateTrack();document.getElementById('status').textContent=`Lista: ${label}. Pulsa reproducir.`;}
  }
  original.addEventListener('click',()=>{if(originalUrl)listen(originalUrl,`${selectedFile.name} · original`);});
  start.addEventListener('click',async()=>{
    const file=input.files?.[0];if(!file)return;
    stop();release();selectedFile=file;const token=generation;
    start.disabled=true;cancel.disabled=false;duration.disabled=true;from.disabled=true;progress.hidden=false;progress.removeAttribute('value');
    window.sinestesiaSeparating=true;
    output.hidden=false;jump.hidden=false;
    for(const label of Object.values(labels)) {
      const row=document.createElement('article');row.className='stem-row';
      const title=document.createElement('h4');title.textContent=label;
      const detail=document.createElement('p');detail.className='stem-description';detail.textContent='En preparación… Aquí podrás escuchar y descargar esta pista.';
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
            message.textContent='Preparando las cuadrículas y los WAV…';
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
                row.classList.add('is-playing');listen(url,`${file.name} · ${labels[name]}`);
              });
              const link=document.createElement('a');link.href=url;link.download=`${file.name.replace(/\.[^.]+$/,'')}_${offset}s_${name}.wav`;link.textContent='↓ WAV';link.setAttribute('aria-label',`Descargar ${labels[name]}`);
              row.append(title,description,button,link);pending.append(row);
              progress.value=(index+1)/names.length;
              message.textContent=`Preparando pistas ${index+1}/${names.length}…`;
              await new Promise(resolve=>setTimeout(resolve,0));
            }
            if(token!==generation)return;
            results.replaceChildren(pending);output.hidden=false;jump.hidden=false;
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
  window.addEventListener('beforeunload',()=>{worker?.terminate();release();});
})();
