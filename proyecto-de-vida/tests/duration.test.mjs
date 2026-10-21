import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,durationFromParts,durationParts,taskDurationSeconds,sessionSeconds,formatDuration,MAX_DURATION_SECONDS,settleTimer,timerRemaining,planTasks,validateBackup} from '../core.mjs';

const day='2026-10-21';
const task=(id,extra={})=>({id,title:'Actividad',goalId:'',date:day,created:day,completed:'',priority:2,status:'todo',minutes:25,...extra});
const timer=(extra={})=>({id:'session',day,taskId:'task',mode:'focus',running:true,total:15000,remaining:15000,endAt:15000,...extra});

test('duration controls carry 60 seconds and minutes and cap at 24 hours',()=>{
 assert.deepEqual(durationParts(durationFromParts(0,0,60)),{hours:0,minutes:1,seconds:0});
 assert.deepEqual(durationParts(durationFromParts(1,60,15)),{hours:2,minutes:0,seconds:15});
 assert.equal(durationFromParts(24,0,0),86400);
 assert.equal(durationFromParts(24,60,60),MAX_DURATION_SECONDS);
 assert.equal(durationFromParts(0,0,0),0);
 for(const parts of [[-1,0,0],[25,0,0],[0,61,0],[0,0,61],[0,.5,0],[NaN,0,0]])assert.ok(Number.isNaN(durationFromParts(...parts)));
});

test('legacy task minutes remain intact and new durations retain single seconds',()=>{
 const old=task('old',{minutes:90}),before=structuredClone(old);
 assert.equal(taskDurationSeconds(old),5400);
 assert.deepEqual(old,before);
 assert.equal(taskDurationSeconds(task('short',{minutes:15/60,durationSeconds:15})),15);
 assert.equal(formatDuration(3661),'1 h 1 min 1 s');
 assert.equal(formatDuration(15),'15 s');
 assert.equal(formatDuration(86400),'24 h');
 assert.equal(formatDuration(172815),'48 h 15 s');
});

test('a 15-second task records exactly 15 seconds once even after a late reload',()=>{
 const s=fresh();s.timer=timer();
 assert.equal(settleTimer(s,14999),false);
 assert.equal(timerRemaining(s.timer,10000),5000);
 assert.equal(settleTimer(s,86400000),true);
 assert.equal(s.timer,null);
 assert.deepEqual(s.sessions,[{id:'session',day,taskId:'task',seconds:15,minutes:.25}]);
 assert.equal(settleTimer(s,86400001),false);
 const copy=validateBackup(JSON.parse(JSON.stringify(s)));
 assert.equal(sessionSeconds(copy.sessions[0]),15);
 assert.deepEqual(copy.sessions,s.sessions);
});

test('a paused timer does not expire and resumes for precisely its remaining seconds',()=>{
 const s=fresh();s.timer=timer({remaining:11000,running:false});
 assert.equal(settleTimer(s,999999),false);
 assert.equal(timerRemaining(s.timer,999999),11000);
 s.timer.running=true;s.timer.endAt=999999+11000;
 assert.equal(settleTimer(s,1010998),false);
 assert.equal(settleTimer(s,1010999),true);
 assert.equal(s.sessions[0].seconds,15);
});

test('early finish floors subsecond time, never counts pauses, and ignores zero time',()=>{
 const s=fresh();s.timer=timer({running:false,remaining:11100});
 settleTimer(s,999999,true);
 assert.equal(s.sessions[0].seconds,3);
 assert.equal(s.sessions[0].minutes,.05);
 s.timer=timer({id:'too-short',remaining:15000,running:false});
 settleTimer(s,999999,true);
 assert.equal(s.sessions.length,1);
});

test('a 24-hour timer records 24 hours rather than overflowing the old 8-hour limit',()=>{
 const s=fresh();s.timer=timer({total:86400000,remaining:86400000,endAt:86400000});
 assert.equal(settleTimer(s,86400000),true);
 assert.equal(s.sessions[0].seconds,86400);
 assert.deepEqual(validateBackup(s).sessions,s.sessions);
});

test('original backups and mixed legacy/new task and session durations round-trip without migration loss',()=>{
 const s=fresh();s.tasks=[task('old'),task('short',{minutes:1/60,durationSeconds:1}),task('long',{minutes:1440,durationSeconds:86400})];
 s.sessions=[{id:'old-session',day,taskId:'old',minutes:25},{id:'new-session',day,taskId:'short',minutes:1/60,seconds:1}];
 const copy=validateBackup(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(copy,s);
 assert.equal(sessionSeconds(copy.sessions[0]),1500);
});

test('the priority planner budgets seconds accurately and skips tasks over two hours',()=>{
 const s=fresh();s.tasks=[task('a',{priority:3,minutes:119+45/60,durationSeconds:7185}),task('b',{minutes:.25,durationSeconds:15}),task('c',{minutes:1/60,durationSeconds:1}),task('d',{minutes:1440,durationSeconds:86400})];
 assert.deepEqual(planTasks(s,day).map(t=>t.id),['a','b']);
});

for(const seconds of [0,-1,86401,1.5,NaN,Infinity])test(`backups reject invalid exact duration ${seconds}`,()=>{
 const s=fresh();s.tasks=[task('bad',{minutes:Math.max(1,seconds/60),durationSeconds:seconds})];
 assert.throws(()=>validateBackup(s));
 s.tasks=[];s.sessions=[{id:'bad',day,taskId:'',minutes:Math.max(1,seconds/60),seconds}];
 assert.throws(()=>validateBackup(s));
});

test('backups reject inconsistent minute and second representations',()=>{
 const s=fresh();s.tasks=[task('bad',{durationSeconds:15})];assert.throws(()=>validateBackup(s));
 s.tasks=[];s.sessions=[{id:'bad',day,taskId:'',minutes:25,seconds:15}];assert.throws(()=>validateBackup(s));
});
