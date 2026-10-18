// Full viewport viewing, with a CSS fallback for mobile browsers without Fullscreen API.
(() => {
  'use strict';
  const stage=document.querySelector('.stage'),button=document.getElementById('panoramaToggle');
  if(!stage||!button)return;
  let open=false,scrollY=0;
  function update(value){
    open=value;stage.classList.toggle('is-panorama',open);document.body.classList.toggle('panorama-open',open);
    button.textContent=open?'Salir de pantalla completa':'Pantalla completa';button.setAttribute('aria-pressed',String(open));
    if(!open)window.scrollTo(0,scrollY);
    window.dispatchEvent(new Event('resize'));
  }
  async function toggle(){
    if(open){
      if(document.fullscreenElement===stage&&document.exitFullscreen){try{await document.exitFullscreen();}catch{update(false);}}
      else update(false);
      return;
    }
    scrollY=window.scrollY;
    if(stage.requestFullscreen){
      try{await stage.requestFullscreen();update(true);return;}catch{/* Fill the viewport when native fullscreen is unavailable. */}
    }
    update(true);
  }
  button.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange',()=>update(document.fullscreenElement===stage));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!document.fullscreenElement){update(false);button.focus();}});
})();
