// SPDX-License-Identifier: AGPL-3.0-only
import {goalProgress, objectiveProgress} from './vendor/lifeos.mjs';
import {findFirstIndexBsearch} from './vendor/neohabit.mjs';
export {calendarDays} from './vendor/beaverhabits.mjs';
export {msToClockString} from './vendor/super-productivity.mjs';
export {goalProgress, objectiveProgress};
export const APP='proyecto-de-vida', KEY='proyecto-de-vida-v1';
export const AREAS={salud:{name:'Salud',color:'#60806a',icon:'heart'},aprendizaje:{name:'Aprendizaje',color:'#b88c43',icon:'book'},trabajo:{name:'Trabajo',color:'#71859d',icon:'briefcase'},finanzas:{name:'Finanzas',color:'#a97461',icon:'wallet'},relaciones:{name:'Relaciones',color:'#9c7f9f',icon:'people'},personal:{name:'Personal',color:'#758268',icon:'sun'}};
export const uid=()=>crypto.randomUUID();
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function shiftDay(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(day){const d=new Date(day+'T12:00:00Z');return shiftDay(day,-((d.getUTCDay()+6)%7));}
export function fresh(){return {app:APP,version:1,profile:{name:'',purpose:''},goals:[],tasks:[],habits:[],journal:[],sessions:[],timer:null};}
export function targetAt(habit,day){const targets=[...habit.targets].sort((a,b)=>a.from.localeCompare(b.from));const i=findFirstIndexBsearch(targets,t=>t.from>day);return (i===-1?targets.at(-1):targets[i-1])?.value||habit.target;}
export function habitValue(habit,day){return habit.logs[day]||0;}
export function habitDone(habit,day){return habit.created<=day&&habitValue(habit,day)>=targetAt(habit,day);}
export function setTarget(habit,from,value){habit.targets=habit.targets.filter(t=>t.from!==from);habit.targets.push({from,value});habit.targets.sort((a,b)=>a.from.localeCompare(b.from));habit.target=value;}
export function streak(habit,day){let cursor=day,count=0;if(!habitDone(habit,cursor))cursor=shiftDay(cursor,-1);for(let i=0;i<36600&&cursor>=habit.created;i++,cursor=shiftDay(cursor,-1)){if(!habitDone(habit,cursor))break;count++;}return count;}
export function tasksForGoal(state,id){return state.tasks.filter(t=>t.goalId===id);}
export function progress(state,id){return goalProgress(tasksForGoal(state,id));}
export function dayScore(state,day){const habits=state.habits.filter(h=>h.created<=day);const tasks=state.tasks.filter(t=>t.date===day);const total=habits.length+tasks.length;return total?(habits.filter(h=>habitDone(h,day)).length+tasks.filter(t=>t.status==='done').length)/total:0;}
export function dueTasks(state,day){return state.tasks.filter(t=>t.date===day||(t.status!=='done'&&t.date<day));}
export function planTasks(state,day){const candidates=state.tasks.filter(t=>t.status!=='done'&&t.date<=day).sort((a,b)=>b.priority-a.priority||a.date.localeCompare(b.date)||a.created.localeCompare(b.created));let used=0;return candidates.filter(t=>{if(used+t.minutes>120)return false;used+=t.minutes;return true;}).slice(0,3);}
export function timerRemaining(timer,now=Date.now()){return !timer?0:Math.max(0,timer.running?timer.endAt-now:timer.remaining);}
export function settleTimer(state,now=Date.now(),early=false){const timer=state.timer;if(!timer||(!early&&(!timer.running||timer.endAt>now)))return false;const elapsed=Math.max(0,timer.total-timerRemaining(timer,now));if(timer.mode==='focus'&&elapsed>=60000&&!state.sessions.some(s=>s.id===timer.id))state.sessions.push({id:timer.id,day:timer.day,taskId:timer.taskId,minutes:Math.min(timer.total/60000,Math.floor(elapsed/60000))});state.timer=null;return true;}
export function validateBackup(raw){
 const bad=()=>{throw Error('El archivo no es un respaldo válido de Proyecto de vida.');};
 if(!raw||raw.app!==APP||raw.version!==1)bad();const out=fresh();
 const str=(v,max=160)=>{if(typeof v!=='string'||v.length>max)bad();return v;};
 const title=v=>{const s=str(v);if(!s.trim())bad();return s;};
 const date=v=>{if(!validDate(v))bad();return v;};
 const num=(v,min=0,max=1000000)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)bad();return v;};
 const id=v=>{const s=str(v,80);if(!/^[\w-]+$/.test(s))bad();return s;};
 const arr=v=>{if(!Array.isArray(v)||v.length>10000)bad();return v;};
 const area=v=>{if(!Object.hasOwn(AREAS,v))bad();return v;};
 out.profile={name:str(raw.profile?.name,60),purpose:str(raw.profile?.purpose,1000)};
 out.goals=arr(raw.goals).map(g=>({id:id(g.id),title:title(g.title),area:area(g.area),why:str(g.why,1000),deadline:g.deadline?date(g.deadline):'',created:date(g.created)}));
 out.tasks=arr(raw.tasks).map(t=>{if(!['todo','done'].includes(t.status))bad();return {id:id(t.id),title:title(t.title),goalId:t.goalId?id(t.goalId):'',date:date(t.date),priority:num(t.priority,1,3),minutes:num(t.minutes,1,480),status:t.status,created:date(t.created),completed:t.completed?date(t.completed):''};});
 out.habits=arr(raw.habits).map(h=>{const logs={};if(!h.logs||typeof h.logs!=='object'||Array.isArray(h.logs)||Object.keys(h.logs).length>36600)bad();for(const [d,v] of Object.entries(h.logs))logs[date(d)]=num(v);return {id:id(h.id),title:title(h.title),area:area(h.area),unit:str(h.unit,30),target:num(h.target,1),step:num(h.step,1),created:date(h.created),targets:arr(h.targets).map(t=>({from:date(t.from),value:num(t.value,1)})),logs};});
 out.journal=arr(raw.journal).map(j=>({day:date(j.day),mood:num(j.mood,1,5),energy:num(j.energy,1,5),wins:str(j.wins,5000),notes:str(j.notes,5000)}));
 out.sessions=arr(raw.sessions).map(s=>({id:id(s.id),day:date(s.day),taskId:s.taskId?id(s.taskId):'',minutes:num(s.minutes,1,480)}));
 for(const list of [out.goals,out.tasks,out.habits,out.sessions])if(new Set(list.map(x=>x.id)).size!==list.length)bad();
 if(new Set(out.journal.map(j=>j.day)).size!==out.journal.length)bad();
 const goals=new Set(out.goals.map(g=>g.id));if(out.tasks.some(t=>t.goalId&&!goals.has(t.goalId)))bad();
 // Imported timers never start themselves or create sessions from another device.
 return out;
}
