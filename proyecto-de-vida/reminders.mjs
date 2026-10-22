// SPDX-License-Identifier: AGPL-3.0-only
import {KEY} from './core.mjs';
import {reminderPlans,browserDueReminders} from './planning.mjs';

export function createReminders({getState,onStatus,onDue}){
 const native=window.proyectoAndroid?.reminders;
 let status={native:!!native,permission:native?'loading':('Notification'in window?Notification.permission:'unsupported'),exact:false,scheduledCount:0},latest='',queue=Promise.resolve(),lastCheck=Date.now()-1000;
 const emit=()=>{onStatus({...status});if(status.openedDay){window.dispatchEvent(new CustomEvent('life-reminder-open',{detail:{day:status.openedDay}}));delete status.openedDay;}};
 async function refresh(){try{if(native)status={native:true,...await native.status()};else status={...status,permission:'Notification'in window?Notification.permission:'unsupported'};}catch{status={...status,error:true};}emit();}
 function sync(force=false){if(!native){void refresh();return;}const plans=reminderPlans(getState()),serialized=JSON.stringify(plans);if(!force&&serialized===latest)return;latest=serialized;queue=queue.catch(()=>{}).then(async()=>{try{status={native:true,...await native.sync({plans:JSON.parse(latest)})};}catch{status={...status,error:true};}emit();});}
 async function enable(){try{if(native)status={native:true,...await native.requestNotifications()};else if('Notification'in window)status.permission=await Notification.requestPermission();}catch{status={...status,error:true};}emit();sync(true);}
 async function exact(){try{if(native)await native.openExactSettings();}catch{status={...status,error:true};emit();}}
 async function settings(){try{if(native)await native.openNotificationSettings();}catch{status={...status,error:true};emit();}}
 async function check(){if(native)return;const now=Date.now(),from=Math.max(lastCheck,now-15*60000);lastCheck=now;let fired;try{fired=JSON.parse(localStorage.getItem(KEY+'-reminders-fired')||'{}');}catch{fired={};}
  for(const event of browserDueReminders(getState(),from,now)){if(fired[event.key])continue;fired[event.key]=now;onDue(event);if(status.permission==='granted'){try{const options={body:`${event.task.startTime} · ${event.task.title}`,tag:event.key,icon:'icon-192.png',data:{day:event.day,taskId:event.task.id}};const registration=await navigator.serviceWorker?.getRegistration();if(registration)await registration.showNotification('Es hora de tu rutina',options);else new Notification('Es hora de tu rutina',options);}catch{/* The in-app notice remains available if the browser blocks notifications. */}}}
  try{localStorage.setItem(KEY+'-reminders-fired',JSON.stringify(Object.fromEntries(Object.entries(fired).filter(([,at])=>at>now-28*86400000))));}catch{}
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){void refresh();sync(true);void check();}});
 window.addEventListener('focus',()=>{void refresh();sync(true);});
 setInterval(()=>void check(),15000);
 void refresh();sync();
 return {sync,enable,exact,settings,refresh,getStatus:()=>status};
}
