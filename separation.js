import { encodeWav } from './separation-dsp.js?v=20261017-stems1';
(() => {
  const input = document.getElementById('audioFile'), player = document.getElementById('audio');
  const start = document.getElementById('separateStart'), cancel = document.getElementById('separateCancel');
  const progress = document.getElementById('separateProgress'), message = document.getElementById('separateStatus');
  const results = document.getElementById('separateResults'), original = document.getElementById('separateOriginal');
  const duration = document.getElementById('separateDuration'), from = document.getElementById('separateFrom');
  const labels = { drums:'Batería · IA',bass:'Bajo · IA',other:'Otros / melodía · IA',vocals:'Voz · IA',kickEstimate:'Kick · banda estimada',snareEstimate:'Snare · banda estimada',cymbalEstimate:'Platillos · banda estimada' };
  let worker = null, generation = 0, urls = [], originalUrl = null, selected = null, selectedFile = null;
  const stop = text => { generation++; worker?.terminate(); worker=null; start.disabled=!input.files?.length; cancel.disabled=true; duration.disabled=false; from.disabled=false; progress.hidden=true; if(text)message.textContent=text; };
  function release() { urls.forEach(URL.revokeObjectURL);urls=[];if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=null;results.replaceChildren();original.hidden=true;selected=null; }
  input.addEventListener('change', () => { stop();release();selectedFile=input.files?.[0]||null;start.disabled=!selectedFile;message.textContent=selectedFile?'Lista para separar. Se procesa en este dispositivo; la canción no se sube.':'Primero carga una canción.'; });
  document.getElementById('separateChoose').addEventListener('click',()=>input.click());
  cancel.addEventListener('click',()=>stop('Proceso cancelado. Puedes volver a intentarlo.'));
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
    player.pause();message.textContent='Decodificando audio a 44,1 kHz…';
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
      worker=new Worker(new URL('./separator-assets/worker.js?v=1',import.meta.url),{type:'module'});
      worker.onerror=()=>{if(token===generation)stop('No se pudo iniciar la IA. Recarga la página o prueba un navegador actualizado.');};
      worker.onmessage=event=>{
        if(token!==generation)return;
        const data=event.data;
        if(data.type==='status'){message.textContent=data.text;progress.removeAttribute('value');}
        if(data.type==='download'){progress.value=Math.min(1,data.loaded/data.total);message.textContent=`Descargando modelo IA: ${(data.loaded/1e6).toFixed(0)} / ${(data.total/1e6).toFixed(0)} MB. La canción sigue en tu dispositivo.`;}
        if(data.type==='progress'){progress.value=data.step/data.total;message.textContent=`Separando fragmento de ${seconds.toFixed(1)} s · segmento ${data.step}/${data.total}. Puedes cancelar.`;}
        if(data.type==='error'){stop(`No se pudo separar: ${data.text} Prueba un fragmento más corto o un ordenador.`);return;}
        if(data.type==='done'){
          try {
            for(const [name,track] of Object.entries(data.tracks)){
              if(!labels[name]||track.channelData.length!==2||track.channelData[0].length!==end-begin)throw Error('La IA devolvió una pista incompleta.');
              for(const channel of track.channelData)for(const sample of channel)if(!Number.isFinite(sample))throw Error('La IA devolvió audio inválido.');
              const blob=encodeWav(track.channelData,44100),url=URL.createObjectURL(blob);urls.push(url);
              const row=document.createElement('div');row.className='stem-row';
              const title=document.createElement('strong');title.textContent=labels[name];
              const button=document.createElement('button');button.type='button';button.textContent='Escuchar';button.addEventListener('click',()=>listen(url,`${file.name} · ${labels[name]}`));
              const link=document.createElement('a');link.href=url;link.download=`${file.name.replace(/\.[^.]+$/,'')}_${offset}s_${name}.wav`;link.textContent='WAV';
              row.append(title,button,link);results.append(row);
            }
            stop(`Listo: 4 pistas IA y 3 bandas estimadas de batería. Fragmento ${offset.toFixed(1)}–${(offset+seconds).toFixed(1)} s. Escuchar una pista hace que el visualizador analice esa pista.`);
          }catch(error){results.replaceChildren();stop(error.message);}
        }
      };
      worker.postMessage({type:'separate',channelData},channelData.map(c=>c.buffer));
    }catch(error){if(token===generation)stop(`No se pudo preparar el audio: ${error.message}`);}
  });
  window.addEventListener('beforeunload',()=>{worker?.terminate();release();});
})();
