import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,habitPlanEnd,habitPlanProgress,habitScheduled,habitDone,dayProgress,dayScore,flameTaskProgress,validateBackup,shiftDay,setHabitDays,setTarget,streak,activityStreak} from '../core.mjs';
const start='2026-10-22';
const habit=(extra={})=>({id:'run',title:'Correr',area:'salud',unit:'minutos',target:10,step:5,created:start,startDate:start,endDate:'2026-10-31',durationUnit:'days',durationCount:10,targets:[{from:start,value:10}],logs:{},...extra});
const task=id=>({id,title:id,date:start,created:start,goalId:'',status:'done',completed:start,minutes:25,priority:2});
test('ten days are inclusive across a month boundary and a week lasts seven dates',()=>{
 assert.equal(habitPlanEnd('2026-10-28',10,'days'),'2026-11-06');
 assert.equal(habitPlanEnd(start,1,'weeks'),'2026-10-28');
 assert.equal(habitPlanEnd(start,1,'days'),start);
});
test('invalid periods cannot overflow or silently become a different duration',()=>{
 for(const [date,count,unit] of [['2026-02-30',10,'days'],[start,0,'days'],[start,1.5,'weeks'],[start,6000,'weeks'],[start,10,'months'],['9999-12-31',2,'days']])assert.equal(habitPlanEnd(date,count,unit),null);
});
test('one completed running day is ten percent overall but can finish the whole daily plan',()=>{
 const s=fresh();s.tasks=[task('one'),task('two')];const h=habit({logs:{[start]:10}});s.habits=[h];
 assert.deepEqual(habitPlanProgress(h,start),{completed:1,total:10,remaining:9,ratio:.1});
 assert.deepEqual(dayProgress(s,start),{completed:3,pending:0,total:3,ratio:1,allCompleted:true});
 assert.equal(dayScore(s,start),1);assert.deepEqual(flameTaskProgress(s,start),dayProgress(s,start));
});
test('future entries, partial amounts and excess amounts do not invent additional fulfilled days',()=>{
 const h=habit({logs:{[start]:5,[shiftDay(start,1)]:100}});
 assert.equal(habitPlanProgress(h,start).completed,0);
 h.logs[start]=100;assert.equal(habitPlanProgress(h,start).completed,1);
 assert.equal(habitPlanProgress(h,shiftDay(start,1)).completed,2);
});
test('only practice weekdays count in the total and rest days do not lower daily completion',()=>{
 const h=habit({endDate:habitPlanEnd(start,1,'weeks'),durationUnit:'weeks',durationCount:1,weekDays:[0,2,4]});
 assert.equal(habitPlanProgress(h,start).total,3);
 const s=fresh();s.tasks=[task('one')];s.habits=[h];assert.equal(habitScheduled(h,start),false);assert.equal(dayProgress(s,start).ratio,1);
});
test('start and end dates stop a habit from entering other daily plans',()=>{
 const h=habit();assert.equal(habitScheduled(h,shiftDay(start,-1)),false);assert.equal(habitScheduled(h,h.endDate),true);assert.equal(habitScheduled(h,shiftDay(h.endDate,1)),false);
 h.logs[shiftDay(h.endDate,1)]=10;assert.equal(habitDone(h,shiftDay(h.endDate,1)),false);
 const s=fresh();s.habits=[h];assert.equal(dayProgress(s,shiftDay(h.endDate,1)).total,0);
});
test('schedule and target changes preserve the previous dates of a bounded habit',()=>{
 const h=habit();h.logs[start]=10;setTarget(h,shiftDay(start,1),20);setHabitDays(h,shiftDay(start,1),[4]);
 assert.equal(habitDone(h,start),true);assert.equal(habitPlanProgress(h,start).completed,1);
 assert.equal(habitScheduled(h,shiftDay(start,1)),true);assert.equal(habitScheduled(h,shiftDay(start,2)),false);
});
test('bounded plans and logs survive export and import with exact daily and cumulative progress',()=>{
 const s=fresh();s.habits=[habit({logs:{[start]:10}})];const restored=validateBackup(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(restored.habits[0],s.habits[0]);assert.equal(habitPlanProgress(restored.habits[0],start).ratio,.1);assert.equal(dayScore(restored,start),1);
});
test('old habits keep their unlimited schedule without an invented end date',()=>{
 const s=fresh(),h=habit({logs:{[start]:10}});delete h.startDate;delete h.endDate;delete h.durationUnit;delete h.durationCount;s.habits=[h];
 const restored=validateBackup(JSON.parse(JSON.stringify(s))).habits[0];assert.equal(restored.endDate,undefined);assert.equal(habitScheduled(restored,'2027-01-01'),true);assert.equal(habitPlanProgress(restored,start).completed,1);
});
test('backup validation rejects inconsistent, reversed and oversized habit plans',()=>{
 for(const change of [h=>h.startDate='invalid',h=>h.endDate=shiftDay(start,-1),h=>h.durationCount=1.5,h=>h.durationCount=9,h=>h.durationUnit='unknown',h=>h.durationUnit='open',h=>{h.durationCount=36601;h.endDate=shiftDay(start,36600);}]){
  const s=fresh(),h=habit();change(h);s.habits=[h];assert.throws(()=>validateBackup(s));
 }
});
test('completed and expired plans retain their totals after the deadline',()=>{
 const h=habit();for(let i=0;i<10;i++)h.logs[shiftDay(start,i)]=10;
 assert.deepEqual(habitPlanProgress(h,'2026-11-15'),{completed:10,total:10,remaining:0,ratio:1});
 delete h.logs[start];assert.equal(habitPlanProgress(h,'2026-11-15').ratio,.9);
});

test('an explicit past start date feeds habit and activity streaks before record creation',()=>{
 const past=shiftDay(start,-1),h=habit({startDate:past,endDate:habitPlanEnd(past,10,'days'),targets:[{from:past,value:10}],logs:{[past]:10}}),s=fresh();s.habits=[h];
 assert.equal(streak(h,past),1);assert.equal(activityStreak(s,start),1);assert.equal(habitPlanProgress(h,start).completed,1);
});
