import test from 'node:test';import assert from 'node:assert/strict';
import {flameGrowth,flameDynamics,ribbonPoint} from '../life-flame.mjs';
import {fresh,completedTasksOn,flameTaskProgress,toggleTask,deleteTask} from '../core.mjs';
const task=(id,extra={})=>({id,title:'Actividad',date:'2026-10-19',created:'2026-10-19',goalId:'',status:'todo',completed:'',minutes:25,priority:2,...extra});
const habit=(id,extra={})=>({id,title:'Hábito',created:'2026-10-19',target:1,logs:{},targets:[{from:'2026-10-19',value:1}],...extra});
test('each completion grows and energizes the flame within a fixed plan',()=>{let prior=flameDynamics(0,20);assert.ok(prior.growth>0&&prior.growth<.4);for(let n=1;n<=20;n++){const next=flameDynamics(n,20);for(const key of ['growth','speed','light'])assert.ok(next[key]>prior[key]);assert.ok(next.growth<=1);prior=next;}assert.ok(flameGrowth(10,20)>flameGrowth(0,20)*2);});
test('the midpoint retains the reference appearance and the full plan has visibly higher sustained energy',()=>{const half=flameDynamics(5,10),full=flameDynamics(10,10);assert.ok(Math.abs(half.growth-.86)<1e-12);assert.equal(half.speed,2);assert.equal(half.light,1.5);assert.equal(half.radiance,0);assert.equal(full.growth,1);assert.ok(full.speed>half.speed*1.5);assert.ok(full.light>half.light*1.7);assert.equal(full.radiance,1);});
test('the same completion proportion has the same energy for small and large plans',()=>{assert.deepEqual(flameDynamics(1,2),flameDynamics(10,20));assert.deepEqual(flameDynamics(1,1),flameDynamics(100,100));assert.deepEqual(flameDynamics(0,0),flameDynamics(0,10));assert.equal(flameDynamics(0,0).radiance,0);});
test('invalid counts and totals cannot trigger maximum energy or break media playback',()=>{for(const count of [NaN,Infinity,-5,undefined])assert.deepEqual(flameDynamics(count,10),flameDynamics(0,10));for(const total of [0,-1,NaN,Infinity,undefined])assert.deepEqual(flameDynamics(2,total),flameDynamics(0,0));const max=flameDynamics(1000000,1);assert.deepEqual(max,flameDynamics(1,1));assert.ok(max.growth<=1&&max.speed<=3.4&&max.light<=2.7&&max.radiance<=1);});
test('undoing a completion smoothly returns the target from maximum to its previous level',()=>{const s=fresh();s.tasks=[task('one'),task('two')];toggleTask(s,'one','2026-10-19');const one=flameTaskProgress(s,'2026-10-19'),half=flameDynamics(one.completed,one.total);toggleTask(s,'two','2026-10-19');const two=flameTaskProgress(s,'2026-10-19'),full=flameDynamics(two.completed,two.total);assert.ok(full.speed>half.speed&&full.light>half.light);assert.equal(two.allCompleted,true);toggleTask(s,'two','2026-10-19');const undone=flameTaskProgress(s,'2026-10-19');assert.equal(undone.allCompleted,false);assert.deepEqual(flameDynamics(undone.completed,undone.total),half);});
test('pending, overdue and late-completed tasks share a consistent daily denominator',()=>{const s=fresh(),day='2026-10-21';s.tasks=[task('late',{date:'2026-10-20'}),task('today',{date:day}),task('future',{date:'2026-10-22'})];assert.deepEqual(flameTaskProgress(s,day),{completed:0,pending:2,total:2,ratio:0,allCompleted:false});toggleTask(s,'late','2026-10-20',day);assert.deepEqual(flameTaskProgress(s,day),{completed:1,pending:1,total:2,ratio:.5,allCompleted:false});toggleTask(s,'today',day);assert.deepEqual(flameTaskProgress(s,day),{completed:2,pending:0,total:2,ratio:1,allCompleted:true});});
test('an empty or entirely deleted plan never counts as fully completed',()=>{const s=fresh();assert.equal(flameTaskProgress(s,'2026-10-19').allCompleted,false);s.tasks=[task('gone')];deleteTask(s,'gone','2026-10-19');assert.deepEqual(flameTaskProgress(s,'2026-10-19'),{completed:0,pending:0,total:0,ratio:0,allCompleted:false});});
test('deleted tasks do not count as completions or prevent a finished active plan from peaking',()=>{const s=fresh();s.tasks=[task('done'),task('gone')];toggleTask(s,'done','2026-10-19');deleteTask(s,'gone','2026-10-19');assert.deepEqual(flameTaskProgress(s,'2026-10-19'),{completed:1,pending:0,total:1,ratio:1,allCompleted:true});});
test('recurring tasks and habits both contribute to their scheduled day',()=>{
 const s=fresh();s.tasks=[task('weekly',{repeatDays:[0,2,4],occurrences:{}})];
 s.habits=[habit('h')];toggleTask(s,'weekly','2026-10-21');
 assert.deepEqual(flameTaskProgress(s,'2026-10-21'),{completed:1,pending:1,total:2,ratio:.5,allCompleted:false});
 s.habits[0].logs['2026-10-21']=1;
 assert.equal(flameTaskProgress(s,'2026-10-21').ratio,1);
 assert.equal(flameTaskProgress(s,'2026-10-19').ratio,0);
 assert.equal(flameTaskProgress(s,'2026-10-22').allCompleted,false);
});
test('pending tasks do not make the flame bigger and completion can be undone',()=>{const s=fresh();s.tasks=Array.from({length:25},(_,i)=>task(String(i)));assert.equal(completedTasksOn(s,'2026-10-19'),0);toggleTask(s,'0','2026-10-19');assert.equal(completedTasksOn(s,'2026-10-19'),1);toggleTask(s,'0','2026-10-19');assert.equal(completedTasksOn(s,'2026-10-19'),0);});
test('a late completion feeds the flame on the actual completion date',()=>{const s=fresh();s.tasks=[task('late')];toggleTask(s,'late','2026-10-19','2026-10-21');assert.equal(completedTasksOn(s,'2026-10-21'),1);assert.equal(completedTasksOn(s,'2026-10-19'),0);});
test('recurring completions feed the correct day without counting a pending occurrence',()=>{const s=fresh();s.tasks=[task('study',{repeatDays:[0,2,4],occurrences:{}})];toggleTask(s,'study','2026-10-19');assert.equal(completedTasksOn(s,'2026-10-19'),1);assert.equal(completedTasksOn(s,'2026-10-21'),0);deleteTask(s,'study','2026-10-21',true);assert.equal(completedTasksOn(s,'2026-10-19'),1);});
test('legacy completed tasks without occurrence logs still feed the flame',()=>{const s=fresh();s.tasks=[task('old',{status:'done',completed:'2026-10-20'})];assert.equal(completedTasksOn(s,'2026-10-20'),1);assert.equal(completedTasksOn(s,'2026-10-19'),0);});
test('filament flow is continuous, animated and bounded over long sessions',()=>{let motion=0;for(let strand=0;strand<24;strand++)for(let j=0;j<=48;j++){const u=j/48,a=ribbonPoint(strand,u,1),b=ribbonPoint(strand,u,1.01);assert.ok(Number.isFinite(a.x+a.y));assert.ok(Math.abs(a.x)<1);assert.ok(Math.abs(b.x-a.x)<.02);assert.equal(a.y,u);motion+=Math.abs(a.x-b.x);}assert.ok(motion>.1);for(const time of [0,100,10000])assert.ok(Math.abs(ribbonPoint(8,.5,time).x)<1);});

test('finishing the final task adds a distinct sustained boost even in a large plan',()=>{const almost=flameDynamics(99,100),full=flameDynamics(100,100);assert.ok(full.speed>almost.speed*1.1);assert.ok(full.light>almost.light*1.2);assert.ok(full.radiance>almost.radiance*1.4);});


test('habits alone can grow the flame and reach maximum energy',()=>{
 const s=fresh(),day='2026-10-21';s.habits=[habit('one'),habit('two')];
 const empty=flameTaskProgress(s,day);
 assert.deepEqual(empty,{completed:0,pending:2,total:2,ratio:0,allCompleted:false});
 s.habits[0].logs[day]=1;const half=flameTaskProgress(s,day);
 assert.equal(half.ratio,.5);s.habits[1].logs[day]=1;
 const full=flameTaskProgress(s,day);assert.equal(full.allCompleted,true);
 assert.ok(flameDynamics(full.completed,full.total).light>flameDynamics(half.completed,half.total).light);
});
test('a numeric habit contributes once only after reaching its target, and undo lowers the flame',()=>{
 const s=fresh(),day='2026-10-21';s.habits=[habit('read',{target:10,targets:[{from:'2026-10-19',value:10}]})];
 for(const value of [0,5,9]){s.habits[0].logs[day]=value;assert.equal(flameTaskProgress(s,day).completed,0);}
 for(const value of [10,20]){s.habits[0].logs[day]=value;assert.equal(flameTaskProgress(s,day).completed,1);assert.equal(flameTaskProgress(s,day).total,1);}
 s.habits[0].logs[day]=9;assert.equal(flameTaskProgress(s,day).allCompleted,false);
});
test('rest days and habits not yet started neither grow nor hold back the flame',()=>{
 const s=fresh(),day='2026-10-21';s.tasks=[task('done',{date:day,status:'done',completed:day})];
 s.habits=[habit('rest',{weekDays:[0],logs:{[day]:1}}),habit('future',{created:'2026-10-22'})];
 assert.deepEqual(flameTaskProgress(s,day),{completed:1,pending:0,total:1,ratio:1,allCompleted:true});
 s.tasks=[];assert.equal(flameTaskProgress(s,day).total,0);assert.equal(flameTaskProgress(s,day).allCompleted,false);
});
test('habit targets, schedule history and logs are evaluated on the selected date',()=>{
 const s=fresh();s.habits=[habit('read',{target:2,targets:[{from:'2026-10-19',value:1},{from:'2026-10-21',value:2}],daySchedules:[{from:'2026-10-19',days:[0,1]},{from:'2026-10-21',days:[2]}],logs:{'2026-10-19':1,'2026-10-20':1,'2026-10-21':1,'2026-10-22':2}})];
 assert.equal(flameTaskProgress(s,'2026-10-19').ratio,1);
 assert.equal(flameTaskProgress(s,'2026-10-20').ratio,1);
 assert.equal(flameTaskProgress(s,'2026-10-21').ratio,0);
 assert.equal(flameTaskProgress(s,'2026-10-22').total,0);
});
test('mixed plans count overdue tasks and habits without treating deletion as completion',()=>{
 const s=fresh(),day='2026-10-21';s.tasks=[task('late'),task('gone',{date:day})];s.habits=[habit('h',{logs:{[day]:1}})];
 deleteTask(s,'gone',day);
 assert.deepEqual(flameTaskProgress(s,day),{completed:1,pending:1,total:2,ratio:.5,allCompleted:false});
 toggleTask(s,'late','2026-10-19',day);assert.equal(flameTaskProgress(s,day).allCompleted,true);
});
