import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,dayProgress,dayScore,flameTaskProgress,activitySummary,taskSummary,toggleTask,deleteTask,dueTasks} from '../core.mjs';
const day='2026-10-21';
const task=(id,date=day,extra={})=>({id,title:id,date,created:'2026-10-19',goalId:'',status:'todo',completed:'',minutes:25,priority:2,...extra});
const habit=(id,extra={})=>({id,created:'2026-10-19',target:1,targets:[{from:'2026-10-19',value:1}],logs:{},...extra});
function consistent(s,date,ratio){
 assert.equal(dayProgress(s,date).ratio,ratio);
 assert.equal(dayScore(s,date),ratio);
 assert.deepEqual(flameTaskProgress(s,date),dayProgress(s,date));
 assert.deepEqual(activitySummary(s,date,date),dayProgress(s,date));
}
test('tasks alone have the same percentage in flame, day and chart',()=>{
 const s=fresh();s.tasks=[task('one'),task('two')];consistent(s,day,0);
 toggleTask(s,'one',day);consistent(s,day,.5);
 toggleTask(s,'two',day);consistent(s,day,1);
});
test('linked goals contribute through their daily tasks once alongside habits',()=>{
 const s=fresh();s.goals=[{id:'goal'}];s.tasks=[task('step',day,{goalId:'goal'})];s.habits=[habit('h')];
 toggleTask(s,'step',day);consistent(s,day,.5);assert.equal(dayProgress(s,day).total,2);
 s.habits[0].logs[day]=1;consistent(s,day,1);
});
test('past, selected and future dates keep independent plans and percentages',()=>{
 const s=fresh();s.tasks=[task('past','2026-10-20'),task('current'),task('future','2026-10-22')];
 toggleTask(s,'past','2026-10-20',day);consistent(s,'2026-10-20',1);consistent(s,day,0);consistent(s,'2026-10-22',0);
 toggleTask(s,'current',day);consistent(s,day,1);consistent(s,'2026-10-22',0);
});
test('old pending tasks remain accessible but do not reduce another day',()=>{
 const s=fresh();s.tasks=[task('old','2026-10-19'),task('current')];toggleTask(s,'current',day);
 assert.equal(dueTasks(s,day).filter(t=>t.date<day).length,1);consistent(s,day,1);
});
test('deleted tasks and resting habits are excluded consistently without losing records',()=>{
 const s=fresh();s.tasks=[task('done'),task('deleted')];s.habits=[habit('rest',{weekDays:[0]})];
 toggleTask(s,'done',day);deleteTask(s,'deleted',day);consistent(s,day,1);
 assert.equal(taskSummary(s,day,day).deleted,1);assert.equal(dayProgress(s,day).total,1);
});
test('a period counts task and habit occurrences instead of averaging unequal days',()=>{
 const s=fresh();s.tasks=[task('a','2026-10-20'),task('b'),task('c')];s.habits=[habit('h',{weekDays:[2]})];
 toggleTask(s,'a','2026-10-20');s.habits[0].logs[day]=1;
 assert.deepEqual(activitySummary(s,'2026-10-20',day),{completed:2,pending:2,total:4,ratio:.5,allCompleted:false});
});
test('empty and goals-only days are zero, never a fictitious full flame',()=>{
 const s=fresh();s.goals=[{id:'goal'}];consistent(s,day,0);assert.equal(dayProgress(s,day).allCompleted,false);
});
