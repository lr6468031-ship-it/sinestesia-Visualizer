// SPDX-License-Identifier: AGPL-3.0-only
import {validDate,validTime,shiftDay,weekStart,taskScheduled,taskStatus} from './core.mjs';

export const FLAME_GOAL_COLORS=['#72e5ff','#ffac76','#ffd082','#8facff','#43cdf1','#fb8e6c','#ffe2a6','#b6d9ff','#87f2e7','#f6a25d','#a1b6ff','#edc05f'];
const hexColor=s=>typeof s==='string'&&/^#[a-f0-9]{6}$/i.test(s);
export function nextGoalColor(goals,random=Math.random){
 const used=new Set(goals.map(g=>g.color?.toLowerCase()).filter(Boolean));
 const available=FLAME_GOAL_COLORS.filter(c=>!used.has(c));
 if(available.length){const rgb=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16)),distance=(a,b)=>Math.hypot(...rgb(a).map((v,i)=>v-rgb(b)[i])),existing=[...used].filter(hexColor);const scores=available.map(color=>({color,distance:existing.length?Math.min(...existing.map(c=>distance(color,c))):Infinity}));const clear=scores.filter(c=>c.distance>=100),best=Math.max(...scores.map(c=>c.distance)),choices=clear.length?clear:scores.filter(c=>c.distance>=best*.9);return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))].color;}
 // Extra colors stay within the flame's blue/cyan and amber/orange hue ranges.
 const hslHex=(h,s,l)=>{s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);};
 const start=Math.floor(random()*1000000);
 for(let i=0;i<1000000;i++){const n=(start+i*7919)%1000000,h=n%2?175+(n%610)/10:15+(n%410)/10,c=hslHex(h,65+(n%300)/10,62+(Math.floor(n/100)%180)/10);if(!used.has(c))return c;}
 throw new Error('No quedan colores de la paleta disponibles.');
}
export function ensureGoalColors(state){let changed=false;const seen=[];for(const goal of state.goals){if(!hexColor(goal.color)||seen.some(g=>g.color.toLowerCase()===goal.color.toLowerCase())){goal.color=nextGoalColor([...state.goals.filter(g=>g!==goal),...seen]);changed=true;}seen.push(goal);}return changed;}
export function goalStart(goal){return goal.startDate||(goal.deadline&&goal.deadline<goal.created?goal.deadline:goal.created);}
export function goalOnDay(goal,day){return goalStart(goal)<=day&&(!goal.deadline||day<=goal.deadline);}
export function daysBetween(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
export function goalTiming(goal,day){const start=goalStart(goal);if(day<start)return {phase:'upcoming',days:daysBetween(day,start)};if(!goal.deadline)return {phase:'active',days:null};if(day>goal.deadline)return {phase:'finished',days:daysBetween(goal.deadline,day)};return {phase:'active',days:daysBetween(day,goal.deadline)};}
export function monthDays(month){if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||!validDate(month+'-01'))throw new Error('Mes inválido.');const start=weekStart(month+'-01');return Array.from({length:42},(_,i)=>shiftDay(start,i));}
export function shiftMonth(month,offset){const d=new Date(month+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);}
export function reminderPlans(state){
 return state.tasks.filter(t=>validTime(t.startTime)&&['notification','alarm'].includes(t.reminder)).map(t=>({id:t.id,title:t.title,startDate:t.date,time:t.startTime,days:t.repeatDays||[],endDate:t.archivedOn||'',mode:t.reminder,minutes:t.reminderMinutes||0,skipDates:[...new Set([...Object.entries(t.occurrences||{}).filter(([,status])=>status!=='todo').map(([day])=>day),...(!t.repeatDays?.length&&t.status!=='todo'?[t.date]:[])])]}));
}
export function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function browserDueReminders(state,from,to){
 const due=[];if(to<from||!Number.isFinite(from)||!Number.isFinite(to))return due;
 for(const task of state.tasks){if(!validTime(task.startTime)||!['notification','alarm'].includes(task.reminder))continue;const offset=(task.reminderMinutes||0)*60000,start=localDay(new Date(from+offset)),end=localDay(new Date(to+offset));
  for(let day=start,i=0;day<=end&&i<3;day=shiftDay(day,1),i++){if(!taskScheduled(task,day)||taskStatus(task,day)!=='todo')continue;const at=new Date(day+'T'+task.startTime+':00').getTime()-offset;if(at>from&&at<=to)due.push({task,day,at,key:`${day}|${task.id}|${task.startTime}|${task.reminder}|${task.reminderMinutes||0}`});}
 }
 return due.sort((a,b)=>a.at-b.at);
}
