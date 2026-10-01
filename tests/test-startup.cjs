'use strict';
// Test chạy theo thư mục gốc dự án: fs đọc file và require module từ gốc.
const ROOT=require('node:path').resolve(__dirname,'..');process.chdir(ROOT);
require=require('node:module').createRequire(ROOT+'/');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const net=require('node:net');
const source=fs.readFileSync(ROOT+'/webhook-server.cjs','utf8');
const healthCode=source.slice(source.indexOf('async function selfCheckHealth()'));
async function probe(address,fetchImpl){
 const calls=[],warnings=[];
 const context={server:{address:()=>address},net,SERVER_INSTANCE:'instance-test',AbortController,setTimeout,clearTimeout,console:{warn:m=>warnings.push(m)},fetch:async(url,options)=>{calls.push(url);return fetchImpl?fetchImpl(url,options):{ok:true,json:async()=>({instance:'instance-test'})};}};
 vm.createContext(context);vm.runInContext(healthCode,context);await context.selfCheckHealth();return {calls,warnings};
}
test('Startup probes IPv4 liveness without a MySQL readiness query',async()=>{
 const result=await probe({address:'0.0.0.0',port:4567});assert.deepEqual(result.calls,['http://127.0.0.1:4567/api/health/live']);assert.deepEqual(result.warnings,[]);
});
test('Startup probes the actual IPv6 listener',async()=>{
 assert.deepEqual((await probe({address:'::',port:4568})).calls,['http://[::1]:4568/api/health/live']);
});
test('Passenger socket and absent listener do not probe a guessed TCP port',async()=>{
 assert.deepEqual((await probe('/tmp/passenger.sock')).calls,[]);assert.deepEqual((await probe(null)).calls,[]);
});
test('Unexpected process response is reported',async()=>{
 const result=await probe({address:'127.0.0.1',port:1},async()=>({ok:true,status:200,json:async()=>({instance:'other'})}));assert.equal(result.warnings.length,1);
});
test('Failed liveness request reports uncertainty rather than claiming another server',async()=>{
 const result=await probe({address:'127.0.0.1',port:1},async()=>{throw Object.assign(Error('fetch failed'),{cause:{code:'ECONNREFUSED'}});});assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/ECONNREFUSED/);assert.doesNotMatch(result.warnings[0],/python/);
});
function bootFixture(){
 const timers=[],listeners={};let reloaded=false,disconnected=false;
 const element=()=>({children:[],style:{},querySelector(){return null;},setAttribute(){},appendChild(n){this.children.push(n);},replaceChildren(n){this.children=[n];}});
 const boot=element();boot.hidden=false;
 let observerCallback;
 const context={document:{getElementById:()=>boot,createElement:element},window:{addEventListener:(event,fn)=>{listeners[event]=fn;}},location:{reload(){reloaded=true;}},setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimeout:timer=>{timer.cleared=true;},MutationObserver:class{constructor(fn){observerCallback=fn;}observe(){}disconnect(){disconnected=true;}}};
 const html=fs.readFileSync(ROOT+'/index.html','utf8');const code=html.match(/<script id="crm-boot-watchdog">([\s\S]*?)<\/script>/)[1];vm.runInNewContext(code,context);
 return {boot,timers,listeners,observer:()=>observerCallback(),get reloaded(){return reloaded;},get disconnected(){return disconnected;}};
}
test('Missing startup script offers reload without touching pending storage',()=>{
 const f=bootFixture();f.listeners.error({target:{tagName:'SCRIPT'}});assert.equal(f.boot.children.length,1);const retry=f.boot.children[0].children[0];retry.onclick();assert.equal(f.reloaded,true);
});
test('Stalled boot has a bounded timeout and no automatic reload loop',()=>{
 const f=bootFixture();assert.equal(f.timers[0].ms,45000);f.timers[0].fn();assert.equal(f.boot.children.length,1);assert.equal(f.reloaded,false);
});
test('Successful boot cancels watchdog and ignores later resource errors',()=>{
 const f=bootFixture();f.boot.hidden=true;f.observer();assert.equal(f.timers[0].cleared,true);assert.equal(f.disconnected,true);f.listeners.error({target:{tagName:'SCRIPT'}});assert.equal(f.boot.children.length,0);
});

test('Thông báo phục hồi phiên không bị watchdog thay bằng lỗi chung',()=>{
 const f=bootFixture();f.boot.querySelector=()=>({});f.timers[0].fn();assert.equal(f.boot.children.length,0);assert.equal(f.reloaded,false);
});
