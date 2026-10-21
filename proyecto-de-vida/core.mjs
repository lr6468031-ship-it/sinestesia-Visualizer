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
export function habitDone(habit,day){return habitScheduled(habit,day)&&habitValue(habit,day)>=targetAt(habit,day);}
export function setTarget(habit,from,value){habit.targets=habit.targets.filter(t=>t.from!==from);habit.targets.push({from,value});habit.targets.sort((a,b)=>a.from.localeCompare(b.from));habit.target=value;}
export const WEEKDAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const ALL_DAYS=[0,1,2,3,4,5,6];
export function weekday(day){return (new Date(day+'T12:00:00Z').getUTCDay()+6)%7;}
function lastSchedule(records,day){return [...records].filter(r=>r.from<=day).sort((a,b)=>a.from.localeCompare(b.from)).at(-1);}
export function habitScheduled(habit,day){
 if(day<habit.created)return false;
 const history=habit.daySchedules||[];
 const record=lastSchedule(history,day);
 return (record?.days||habit.weekDays||ALL_DAYS).includes(weekday(day));
}
export function setHabitDays(habit,from,days){
 if(!habit.daySchedules?.length)habit.daySchedules=[{from:habit.created,days:[...(habit.weekDays||ALL_DAYS)]}];
 habit.daySchedules=habit.daySchedules.filter(r=>r.from!==from);
 habit.daySchedules.push({from,days:[...days]});habit.daySchedules.sort((a,b)=>a.from.localeCompare(b.from));
 habit.weekDays=[...days];
}
export function streak(habit,day){
 let count=0;
 for(let cursor=day,i=0;i<36600&&cursor>=habit.created;i++,cursor=shiftDay(cursor,-1)){
  if(!habitScheduled(habit,cursor))continue;
  if(habitDone(habit,cursor)){count++;continue;}
  if(cursor!==day)break;
 }
 return count;
}
export function isRepeating(task){return !!task.repeatDays?.length;}
export function taskScheduled(task,day){
 if(task.archivedOn&&day>task.archivedOn)return false;
 const records=task.scheduleHistory||[];
 const record=records.length?lastSchedule(records,day):{date:task.date,days:task.repeatDays||[]};
 if(!record||day<record.date)return false;
 return record.days.length?record.days.includes(weekday(day)):record.date===day;
}
export function taskStatus(task,day){
 if(task.occurrences&&Object.hasOwn(task.occurrences,day))return task.occurrences[day];
 return !isRepeating(task)&&task.date===day?task.status:'todo';
}
export function taskOccurrence(task,day){return {...task,date:day,status:taskStatus(task,day),occurrenceDay:day,recurring:isRepeating(task)};}
export function taskOccurrences(state,start,end){
 const items=[];
 for(const task of state.tasks){
  for(let day=start,i=0;day<=end&&i<36600;day=shiftDay(day,1),i++){
   if(taskScheduled(task,day)||Object.hasOwn(task.occurrences||{},day))items.push(taskOccurrence(task,day));
  }
 }
 return items;
}
export function toggleTask(state,id,day,completedOn=day){
 const task=state.tasks.find(t=>t.id===id);if(!task)return;
 const next=taskStatus(task,day)==='done'?'todo':'done';
 task.occurrences??={};task.occurrences[day]=next;
 if(!isRepeating(task)&&task.date===day){task.status=next;task.completed=next==='done'?completedOn:'';}
}
export function setTaskSchedule(task,date,days,from){
 const oldDays=task.repeatDays||[];
 if(task.date===date&&JSON.stringify(oldDays)===JSON.stringify(days))return;
 if(!task.scheduleHistory?.length)task.scheduleHistory=[{from:task.date,date:task.date,days:[...oldDays]}];
 // Preserve completed and deleted occurrences when changing the future schedule.
 if(!oldDays.length&&task.status!=='todo'){task.occurrences??={};task.occurrences[task.date]=task.status;}
 if(!oldDays.length&&!days.length){task.scheduleHistory=[];}
 else {
  task.scheduleHistory=task.scheduleHistory.filter(r=>r.from!==from);
  task.scheduleHistory.push({from,date,days:[...days]});
  task.scheduleHistory.sort((a,b)=>a.from.localeCompare(b.from));
 }
 task.date=date;task.repeatDays=[...days];
 task.status=task.occurrences?.[date]||'todo';
 if(task.status!=='done')task.completed='';
}
export function deleteTask(state,id,day,series=false){
 const task=state.tasks.find(t=>t.id===id);if(!task)return;
 task.occurrences??={};
 if(series&&isRepeating(task)){
  task.archivedOn=day;
  if(taskScheduled(task,day)&&taskStatus(task,day)!=='done')task.occurrences[day]='deleted';
 }else{
  task.occurrences[day]='deleted';
  if(!isRepeating(task)&&task.date===day)task.status='deleted';
 }
}
export function restoreTask(state,id,day){
 const task=state.tasks.find(t=>t.id===id);if(!task)return;
 task.occurrences??={};task.occurrences[day]='todo';task.archivedOn='';
 if(!isRepeating(task)&&task.date===day){task.status='todo';task.completed='';}
}
export function tasksForGoal(state,id){return state.tasks.filter(t=>t.goalId===id);}
export function progress(state,id){
 const tasks=tasksForGoal(state,id),now=today(),items=[];
 for(const task of tasks){
  if(!isRepeating(task)&&!task.scheduleHistory?.some(r=>r.days.length)){if(task.status!=='deleted')items.push(task);continue;}
  const start=[task.date,...(task.scheduleHistory||[]).map(r=>r.from)].sort()[0];
  items.push(...taskOccurrences({tasks:[task]},start,now).filter(t=>t.status!=='deleted'));
 }
 return goalProgress(items);
}
export function dayScore(state,day){
 const habits=state.habits.filter(h=>habitScheduled(h,day)),tasks=taskOccurrences(state,day,day);
 const total=habits.length+tasks.length;
 return total?(habits.filter(h=>habitDone(h,day)).length+tasks.filter(t=>t.status==='done').length)/total:0;
}
export function dayHasPlan(state,day){return state.habits.some(h=>habitScheduled(h,day))||taskOccurrences(state,day,day).length>0;}
export function activityStreak(state,day){
 const starts=[...state.tasks.flatMap(t=>[t.created,t.date,...Object.keys(t.occurrences||{})]),...state.habits.map(h=>h.created)];if(!starts.length)return 0;
 const first=starts.sort()[0];let count=0;
 for(let cursor=day,i=0;cursor>=first&&i<36600;cursor=shiftDay(cursor,-1),i++){
  const done=state.habits.some(h=>habitDone(h,cursor))||taskOccurrences(state,cursor,cursor).some(t=>t.status==='done');
  if(done){count++;continue;}
  if(cursor!==day&&dayHasPlan(state,cursor))break;
 }
 return count;
}
export function completedTasksOn(state,day){
 return state.tasks.filter(task=>{
  const repeated=isRepeating(task)||task.scheduleHistory?.some(record=>record.days.length);
  return repeated?task.occurrences?.[day]==='done':task.status==='done'&&(task.completed||task.date)===day;
 }).length;
}
export function taskSummary(state,start,end){
 const items=taskOccurrences(state,start,end);
 const done=items.filter(t=>t.status==='done').length,pending=items.filter(t=>t.status==='todo').length,deleted=items.filter(t=>t.status==='deleted').length;
 return {items,done,pending,deleted,total:items.length,rate:items.length?done/items.length:0};
}
export function dueTasks(state,day){
 const items=taskOccurrences(state,day,day).filter(t=>t.status!=='deleted');
 for(const task of state.tasks)if(!isRepeating(task)&&!task.scheduleHistory?.some(r=>r.days.length)&&task.date<day&&task.status==='todo')items.push(taskOccurrence(task,task.date));
 return items;
}
export function flameTaskProgress(state,day){
 const completed=completedTasksOn(state,day),pending=dueTasks(state,day).filter(task=>task.status==='todo').length,total=completed+pending;
 return {completed,pending,total,ratio:total?completed/total:0,allCompleted:completed>0&&pending===0};
}
export function planTasks(state,day){
 const candidates=dueTasks(state,day).filter(t=>t.status==='todo').sort((a,b)=>b.priority-a.priority||a.date.localeCompare(b.date)||a.created.localeCompare(b.created));
 let used=0;return candidates.filter(t=>{const seconds=taskDurationSeconds(t);if(used+seconds>7200)return false;used+=seconds;return true;}).slice(0,3);
}
export const MAX_DURATION_SECONDS=24*60*60;
export function durationFromParts(hours,minutes,seconds){
 if(![hours,minutes,seconds].every(Number.isInteger)||hours<0||hours>24||minutes<0||minutes>60||seconds<0||seconds>60)return NaN;
 return Math.min(MAX_DURATION_SECONDS,hours*3600+minutes*60+seconds);
}
export function durationParts(seconds){const total=Math.max(0,Math.floor(seconds));return {hours:Math.floor(total/3600),minutes:Math.floor(total/60)%60,seconds:total%60};}
export function taskDurationSeconds(task){return task?.durationSeconds??Math.round((task?.minutes??25)*60);}
export function sessionSeconds(session){return session.seconds??Math.round(session.minutes*60);}
export function formatDuration(seconds){const p=durationParts(seconds);return [p.hours?`${p.hours} h`:'',p.minutes?`${p.minutes} min`:'',p.seconds?`${p.seconds} s`:''].filter(Boolean).join(' ')||'0 s';}
export function timerRemaining(timer,now=Date.now()){return !timer?0:Math.max(0,timer.running?timer.endAt-now:timer.remaining);}
export function settleTimer(state,now=Date.now(),early=false){
 const timer=state.timer;if(!timer||(!early&&(!timer.running||timer.endAt>now)))return false;
 const seconds=Math.floor(Math.max(0,Math.min(timer.total,timer.total-timerRemaining(timer,now)))/1000);
 if(timer.mode==='focus'&&seconds>=1&&!state.sessions.some(s=>s.id===timer.id))state.sessions.push({id:timer.id,day:timer.day,taskId:timer.taskId,seconds,minutes:seconds/60});
 state.timer=null;return true;
}
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
 const days=v=>{const list=arr(v);if(list.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(list).size!==list.length)bad();return [...list].sort((a,b)=>a-b);};
 out.profile={name:str(raw.profile?.name,60),purpose:str(raw.profile?.purpose,1000)};
 out.goals=arr(raw.goals).map(g=>({id:id(g.id),title:title(g.title),area:area(g.area),why:str(g.why,1000),deadline:g.deadline?date(g.deadline):'',created:date(g.created)}));
 out.tasks=arr(raw.tasks).map(t=>{
  if(!['todo','done','deleted'].includes(t.status))bad();
  const occurrences={};
  if(t.occurrences!==undefined){if(!t.occurrences||Array.isArray(t.occurrences)||typeof t.occurrences!=='object'||Object.keys(t.occurrences).length>36600)bad();for(const [day,status] of Object.entries(t.occurrences)){if(!['todo','done','deleted'].includes(status))bad();occurrences[date(day)]=status;}}
  const exact=t.durationSeconds!==undefined;
  const result={id:id(t.id),title:title(t.title),goalId:t.goalId?id(t.goalId):'',date:date(t.date),priority:num(t.priority,1,3),minutes:num(t.minutes,exact?1/60:1,exact?1440:480),status:t.status,created:date(t.created),completed:t.completed?date(t.completed):''};
  if(exact){result.durationSeconds=num(t.durationSeconds,1,MAX_DURATION_SECONDS);if(!Number.isInteger(result.durationSeconds)||Math.abs(result.minutes-result.durationSeconds/60)>1e-9)bad();}
  // Optional fields keep all existing version-1 backups and data compatible.
  if(t.repeatDays!==undefined)result.repeatDays=days(t.repeatDays);
  if(t.occurrences!==undefined)result.occurrences=occurrences;
  if(t.archivedOn!==undefined)result.archivedOn=t.archivedOn?date(t.archivedOn):'';
  if(t.scheduleHistory!==undefined)result.scheduleHistory=arr(t.scheduleHistory).map(r=>({from:date(r.from),date:date(r.date),days:days(r.days)}));
  return result;
 });
 out.habits=arr(raw.habits).map(h=>{
  const logs={};if(!h.logs||typeof h.logs!=='object'||Array.isArray(h.logs)||Object.keys(h.logs).length>36600)bad();for(const [d,v] of Object.entries(h.logs))logs[date(d)]=num(v);
  const result={id:id(h.id),title:title(h.title),area:area(h.area),unit:str(h.unit,30),target:num(h.target,1),step:num(h.step,1),created:date(h.created),targets:arr(h.targets).map(t=>({from:date(t.from),value:num(t.value,1)})),logs};
  if(h.weekDays!==undefined){result.weekDays=days(h.weekDays);if(!result.weekDays.length)bad();}
  if(h.daySchedules!==undefined)result.daySchedules=arr(h.daySchedules).map(r=>{const d=days(r.days);if(!d.length)bad();return {from:date(r.from),days:d};});
  return result;
 });
 out.journal=arr(raw.journal).map(j=>({day:date(j.day),mood:num(j.mood,1,5),energy:num(j.energy,1,5),wins:str(j.wins,5000),notes:str(j.notes,5000)}));
 out.sessions=arr(raw.sessions).map(s=>{
  const exact=s.seconds!==undefined,result={id:id(s.id),day:date(s.day),taskId:s.taskId?id(s.taskId):'',minutes:num(s.minutes,exact?1/60:1,exact?1440:480)};
  if(exact){result.seconds=num(s.seconds,1,MAX_DURATION_SECONDS);if(!Number.isInteger(result.seconds)||Math.abs(result.minutes-result.seconds/60)>1e-9)bad();}
  return result;
 });
 for(const list of [out.goals,out.tasks,out.habits,out.sessions])if(new Set(list.map(x=>x.id)).size!==list.length)bad();
 if(new Set(out.journal.map(j=>j.day)).size!==out.journal.length)bad();
 const goals=new Set(out.goals.map(g=>g.id));if(out.tasks.some(t=>t.goalId&&!goals.has(t.goalId)))bad();
 // Imported timers never start themselves or create sessions from another device.
 return out;
}
