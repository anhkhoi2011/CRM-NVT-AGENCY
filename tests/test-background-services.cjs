'use strict';
// Test chạy theo thư mục gốc dự án: fs đọc file và require module từ gốc.
const ROOT=require('node:path').resolve(__dirname,'..');process.chdir(ROOT);
require=require('node:module').createRequire(ROOT+'/');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{EventEmitter}=require('node:events');
const {createTelegramLoop}=require('./telegram-worker.cjs'),{startTelegramWorker}=require('./telegram-worker-supervisor.cjs'),{runWatchdog,probeLive}=require('./watchdog.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
function clock(){const jobs=[];let time=0;return {jobs,now:()=>time,setTime:t=>{time=t;},schedule(fn,ms){const task={fn,ms,cancelled:false,unref(){}};jobs.push(task);return task;},cancel(t){if(t)t.cancelled=true;}};}
test('Worker không chạy chồng khi Telegram chậm; deadline chỉ dừng worker',async()=>{
 const c=clock();let finish,drains=0,stalls=0,schedules=0;
 const stop=createTelegramLoop({drainLeadNotifications:()=>{drains++;return new Promise(r=>{finish=r;});},runTelegramScheduler:async()=>{schedules++;}},{...c,onStall:()=>{stalls++;}});
 await tick();assert.equal(drains,1);assert.equal(c.jobs.filter(x=>x.ms===15000).length,0);c.jobs.find(x=>x.ms===180000).fn();assert.equal(stalls,1);
 finish();await tick();assert.equal(c.jobs.filter(x=>x.ms===15000).length,0);assert.equal(schedules,0);stop();
});
test('Worker quét lịch một phút, outbox riêng và không gửi hai lần trong cùng lượt',async()=>{
 const c=clock();let drains=0,schedules=0;const stop=createTelegramLoop({drainLeadNotifications:async()=>{drains++;},runTelegramScheduler:async opts=>{assert.equal(opts.skipLeadDrain,true);schedules++;}},{...c});
 await tick();assert.equal(schedules,1);c.setTime(15000);c.jobs.find(x=>x.ms===15000&&!x.cancelled).fn();await tick();assert.equal(schedules,1);assert.equal(drains,2);stop();
});
test('Supervisor nhận lỗi fork và thử lại có backoff, không ném lỗi vào web',()=>{
 const c=clock();const supervisor=startTelegramWorker({...c,fork(){throw Object.assign(Error('NPROC'),{code:'EAGAIN'});},log(){}});
 assert.equal(supervisor.status(),'unavailable');assert.ok(c.jobs.some(x=>x.ms===5000));supervisor.stop();
});
test('Supervisor hủy worker không heartbeat và khởi động lại riêng',()=>{
 const c=clock(),child=new EventEmitter(),killed=[];child.kill=signal=>killed.push(signal);
 const supervisor=startTelegramWorker({...c,fork:()=>child,log(){}});child.emit('message',{type:'ready'});assert.equal(supervisor.status(),'running');
 c.setTime(46000);c.jobs[0].fn();assert.deepEqual(killed,['SIGKILL']);child.emit('close',1);assert.ok(c.jobs.some(x=>x.ms===5000));supervisor.stop();
});
test('Worker chưa có khóa không quay vòng restart liên tục',()=>{
 const c=clock(),child=new EventEmitter();child.kill=()=>{};const s=startTelegramWorker({...c,fork:()=>child});child.emit('close',75);
 assert.equal(s.status(),'standby');assert.ok(c.jobs.some(x=>x.ms===60000));s.stop();
});
async function tempFixture(t){const parent=os.tmpdir(),root=await fs.mkdtemp(path.join(parent,'nvt-watchdog-test-'));t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.resolve(parent)+path.sep));await fs.rm(root,{recursive:true,force:true});});return root;}
test('Watchdog chỉ restart sau 3 lỗi, cooldown 5 phút và không đổi nội dung marker',async t=>{
 const root=await tempFixture(t);let time=Date.now();const args={root,now:()=>time,check:async()=>({ok:false,error:'timeout'}),log(){}};
 assert.equal((await runWatchdog(args)).status,'waiting');assert.equal((await runWatchdog(args)).status,'waiting');assert.equal((await runWatchdog(args)).status,'restart-requested');
 await fs.writeFile(path.join(root,'tmp/restart.txt'),'marker');assert.equal((await runWatchdog(args)).status,'waiting');await runWatchdog(args);assert.equal((await runWatchdog(args)).status,'cooldown');
 time+=301000;assert.equal((await runWatchdog(args)).status,'restart-requested');assert.equal(await fs.readFile(path.join(root,'tmp/restart.txt'),'utf8'),'marker');
 time+=301000;await runWatchdog(args);await runWatchdog(args);assert.equal((await runWatchdog(args)).status,'restart-requested');
 time+=301000;await runWatchdog(args);await runWatchdog(args);assert.equal((await runWatchdog(args)).status,'rate-limited');
});
test('Watchdog khỏe lại xóa số lỗi; sai endpoint không restart',async t=>{
 const root=await tempFixture(t),args={root,log(){},check:async()=>({ok:false})};await runWatchdog(args);await runWatchdog(args);
 assert.equal((await runWatchdog({...args,check:async()=>({ok:true})})).failures,0);
 assert.equal((await runWatchdog(args)).status,'waiting');assert.equal((await runWatchdog({...args,check:async()=>({configurationError:true})})).status,'configuration-error');
 await assert.rejects(fs.stat(path.join(root,'tmp/restart.txt')),e=>e.code==='ENOENT');
});
test('Hai Cron cùng lúc chỉ có một lần kiểm tra liveness',async t=>{
 const root=await tempFixture(t);let finish;const first=runWatchdog({root,check:()=>new Promise(r=>{finish=r;})});
 while(!finish)await tick();assert.equal((await runWatchdog({root,check:async()=>{throw Error('Không được chạy');}})).status,'busy');finish({ok:true});await first;
});
test('Probe có timeout tổng và xác nhận đúng JSON CRM',async t=>{
 const server=http.createServer((req,res)=>{if(req.url==='/ok'){res.end(JSON.stringify({ok:true,live:true}));}else if(req.url==='/wrong'){res.end('<html>other server</html>');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await probeLive({url:base+'/ok'})).ok,true);assert.equal((await probeLive({url:base+'/wrong'})).configurationError,true);
 assert.equal((await probeLive({url:base+'/hang',timeoutMs:35})).ok,false);
});
test('Scheduler giữ ngày điểm danh sau khi một người lỗi',async()=>{
 const vm=require('node:vm'),source=await fs.readFile('telegram-bot.cjs','utf8');let calls=0;
 const c={console,pool:{execute:async()=>{}},dbQuery:async()=>[],drainLeadNotifications:async()=>{},sendMorningCheckinAlert:async()=>{calls++;return {failed:1};},Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T02:00:00Z']));}}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf("let lastCheckinDate = ''"),source.indexOf('// Persist before send;')),c);
 await c.runTelegramScheduler();await c.runTelegramScheduler();assert.equal(calls,1);assert.equal(vm.runInContext('lastCheckinDate',c),'2026-10-01');
});

test('Khóa watchdog dở dang do crash được phục hồi sau thời gian an toàn',async t=>{
 const root=await tempFixture(t);await fs.mkdir(path.join(root,'tmp'));const lock=path.join(root,'tmp/watchdog.lock');await fs.writeFile(lock,'');const old=new Date(Date.now()-120000);await fs.utimes(lock,old,old);
 assert.equal((await runWatchdog({root,check:async()=>({ok:true})})).status,'healthy');
});
