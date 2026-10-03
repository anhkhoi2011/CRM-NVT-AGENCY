'use strict';
// Test chạy theo thư mục gốc dự án: fs đọc file và require module từ gốc.
const ROOT=require('node:path').resolve(__dirname,'..');process.chdir(ROOT);
require=require('node:module').createRequire(ROOT+'/');
const test=require('node:test');
const assert=require('node:assert/strict');
const createQueue=require('./customer-save-queue.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){let busy=false;const states=[],scheduled=[];const queue=createQueue({isBusy:()=>busy,setBusy:value=>{busy=value;},onChange:state=>states.push(state),schedule:fn=>scheduled.push(fn)});return {queue,states,scheduled,setBusy:value=>{busy=value;},get busy(){return busy;}};}

test('Rapid edits of the same and different cells save in order, without parallel requests',async()=>{
 const f=fixture(),writes=[];let release;
 f.queue.enqueue('a',async()=>{writes.push('A');await new Promise(resolve=>{release=resolve;});});
 f.queue.enqueue('b',async()=>{writes.push('B');});
 f.queue.enqueue('a',async()=>{writes.push('C');});
 assert.deepEqual(writes,['A']);assert.equal(f.queue.pending,3);
 release();await tick();assert.deepEqual(writes,['A','B','C']);assert.equal(f.queue.pending,0);assert.equal(f.busy,false);
 assert.equal(f.states.at(-1).error,null);
});

test('Network failure retains the failed edit and later choices until explicit retry',async()=>{
 const f=fixture(),writes=[];let online=false;
 f.queue.enqueue('a',async()=>{if(!online)throw Error('offline');writes.push('A');});
 f.queue.enqueue('b',async()=>{writes.push('B');});
 await tick();assert.equal(f.queue.pending,2);assert.equal(f.busy,false);assert.match(f.states.at(-1).error.message,/offline/);
 f.queue.enqueue('a',async()=>{writes.push('C');});await tick();assert.equal(f.queue.pending,3);assert.deepEqual(writes,[]);
 online=true;f.queue.retry();await tick();assert.deepEqual(writes,['A','B','C']);assert.equal(f.queue.pending,0);
});

test('Selection made while a different form saves waits and is not discarded',async()=>{
 const f=fixture(),writes=[];f.setBusy(true);
 f.queue.enqueue('a',async()=>{writes.push('A');});f.queue.enqueue('b',async()=>{writes.push('B');});
 assert.equal(f.scheduled.length,1);assert.deepEqual(writes,[]);
 f.setBusy(false);f.scheduled.shift()();await tick();assert.deepEqual(writes,['A','B']);assert.equal(f.queue.pending,0);
});

test('Retry clicks cannot send a running edit twice',async()=>{
 const f=fixture();let release,calls=0;
 f.queue.enqueue('a',async()=>{calls++;await new Promise(resolve=>{release=resolve;});});
 f.queue.retry();f.queue.retry();assert.equal(calls,1);release();await tick();assert.equal(f.queue.pending,0);
});


test('Background multi-select form closes while an earlier save is running',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const source=fs.readFileSync('reference-crm.js','utf8');
 const start=source.indexOf('  function editor('),end=source.indexOf('  function ensureReferenceEditorStyles()',start);
 const form={},error={};let removed=false,queued=0;
 const modal={querySelector:selector=>selector==='form'?form:error,querySelectorAll:()=>[],remove(){removed=true;}};
 const c={working:true,q:()=>null,ensureReferenceEditorStyles(){},esc:x=>x,document:{createElement:()=>modal,body:{appendChild(){}}},refresh(){}};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 c.editor('Options','',()=>{queued++;},true);
 await form.onsubmit({preventDefault(){},currentTarget:{elements:[]}});
 assert.equal(queued,1);assert.equal(removed,true);assert.equal(c.working,true);
});

test('Server allows the queue script loaded before the table bridge',()=>{
 const fs=require('node:fs'),html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('webhook-server.cjs','utf8');
 assert.ok(html.indexOf('src="customer-save-queue.js?')<html.indexOf('src="reference-crm.js?'));
 assert.ok(server.includes("'/customer-save-queue.js'"));
});


test('Reload restores queued selections from a persisted draft',async()=>{
 const records=[];let release;
 const first=createQueue({isBusy:()=>false,setBusy(){},onChange(){},persist:items=>{records.splice(0,records.length,...items);}});
 first.enqueue('field:c:level',async()=>new Promise(resolve=>{release=resolve;}),{id:'c',value:'L2'});
 first.enqueue('field:c:status',async()=>{}, {id:'c',value:'Contacted'});
 assert.equal(records.length,2);
 const writes=[],second=createQueue({isBusy:()=>false,setBusy(){},onChange(){},persist:items=>{records.splice(0,records.length,...items);}});
 second.restore(structuredClone(records),payload=>async()=>{writes.push(payload.value);});
 await tick();assert.deepEqual(writes,['L2','Contacted']);assert.deepEqual(records,[]);
 release();await tick();
});

test('Coalesced action receives the same base and value as its persisted checkpoint',async()=>{
 const f=fixture(),seen=[];f.setBusy(true);
 f.queue.enqueue('cell',async p=>seen.push(p),{base:'A',value:'B'});
 f.queue.enqueue('cell',async p=>seen.push(p),{base:'B',value:'C'});
 f.setBusy(false);f.scheduled.shift()();await tick();assert.deepEqual(seen,[{base:'A',value:'C'}]);
});
test('Cached snapshot waits for matching runtime identity before restoring drafts',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync('reference-crm.js','utf8');
 const start=source.indexOf('  function restoreCustomerSelections()'),end=source.indexOf('  const customerSaveQueue=',start);
 const c={api:null,data:{user:{id:'sale'}},customerDraftOwner:null};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 c.restoreCustomerSelections();assert.equal(c.customerDraftOwner,null);c.api={sessionIdentity:()=>({id:'other'})};c.restoreCustomerSelections();assert.equal(c.customerDraftOwner,null);
});

test('Restoring drafts after an edit merges instead of discarding the stored notes',async()=>{
 const writes=[],records=[];let release;
 const q=createQueue({isBusy:()=>false,setBusy(){},onChange(){},persist:items=>{records.splice(0,records.length,...items);}});
 q.enqueue('field:c:note',async()=>{writes.push('new-note');await new Promise(resolve=>{release=resolve;});},{id:'c',value:'new-note'});
 q.restore([{key:'field:c:note',payload:{id:'c',value:'old-note'}},{key:'field:d:note',payload:{id:'d',value:'kept'}}],payload=>async()=>{writes.push(payload.value);});
 assert.deepEqual(records.map(r=>r.key),['field:c:note','field:d:note']);
 release();await tick();await tick();
 assert.deepEqual(writes,['new-note','kept']);assert.deepEqual(records,[]);
});
test('Draft restore uses its own marker so an early keystroke cannot skip it',()=>{
 const source=require('node:fs').readFileSync('reference-crm.js','utf8');
 const body=source.slice(source.indexOf('  function restoreCustomerSelections()'),source.indexOf('  const customerSaveQueue='));
 assert.ok(body.includes('customerDraftsRestoredFor===data.user.id'));
 assert.ok(!body.includes('if(customerDraftOwner===data.user.id)return;'));
 for(const name of ['function saveCustomerSelection(','function stageCustomerNoteSelection(']){
  const fn=source.slice(source.indexOf(name),source.indexOf('\n  }\n',source.indexOf(name)));
  assert.ok(fn.indexOf('restoreCustomerSelections()')<fn.indexOf('customerDraftOwner=data.user.id'),name);
 }
});

test('Transient server errors retry automatically with backoff, then wait for manual retry',async()=>{
 const timers=[],states=[];let fails=2,calls=0;
 const q=createQueue({isBusy:()=>false,setBusy(){},onChange:s=>states.push(s),wait:(fn,ms)=>{timers.push({fn,ms});return timers.length;},cancelWait(){},retryDelays:[10,20],maxRetries:2});
 q.enqueue('a',async()=>{calls++;if(fails-->0)throw Error('503 busy');});
 await tick();assert.equal(calls,1);assert.equal(timers.length,1);assert.equal(timers[0].ms,10);assert.equal(states.at(-1).retrying,true);
 timers.shift().fn();await tick();assert.equal(calls,2);assert.equal(timers[0].ms,20);
 timers.shift().fn();await tick();assert.equal(calls,3);assert.equal(q.pending,0);assert.equal(states.at(-1).error,null);
 // Hết lượt tự thử: dừng và giữ bản nháp chờ bấm "Thử lưu lại".
 q.enqueue('b',async()=>{throw Error('down');});await tick();timers.shift().fn();await tick();timers.shift().fn();await tick();
 assert.equal(timers.length,0);assert.equal(q.pending,1);assert.equal(states.at(-1).retrying,false);assert.match(states.at(-1).error.message,/down/);
});

test('Long outages keep retrying at the last backoff step until the save succeeds',async()=>{
 const timers=[];let calls=0;
 const q=createQueue({isBusy:()=>false,setBusy(){},onChange(){},wait:(fn,ms)=>{timers.push({fn,ms});return timers.length;},cancelWait(){},retryDelays:[10,20]});
 q.enqueue('a',async()=>{calls++;if(calls<6)throw Error('offline');});
 await tick();
 const delays=[];
 while(timers.length){const t=timers.shift();delays.push(t.ms);t.fn();await tick();}
 assert.deepEqual(delays,[10,20,20,20,20]);assert.equal(calls,6);assert.equal(q.pending,0);
});
