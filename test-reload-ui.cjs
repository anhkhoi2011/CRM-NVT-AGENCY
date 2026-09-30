'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const source=fs.readFileSync(__dirname+'/reference-crm.js','utf8');

test('F5: HTML mẫu được che ngay cả khi CSS ngoài chưa tải',()=>{
 const guard=html.match(/<style id="crm-startup-guard">([\s\S]*?)<\/style>/)[1];
 assert.match(guard,/body:not\(\.reference-ready\) > \.app-shell/);
 assert.match(guard,/visibility:hidden!important/);
 assert.doesNotMatch(html,/crm-instant-preheat|document\.documentElement\.classList\.add\('reference-ready'\)/);
});
test('F5: chỉ mở shell sau khi dựng tab và phân quyền',()=>{
 const code=source.slice(source.indexOf('  function refresh('),source.indexOf('  updateCustomerClass='));
 const reveal=code.indexOf("document.body.classList.add('reference-ready')");
 assert.ok(reveal>code.indexOf('paintTab(initialTab)'));
 assert.ok(reveal>code.indexOf('applyRoleVisibility()'));
 assert.ok(reveal>code.indexOf('restoreCustomerSelections()'));
 const cacheBoot=source.slice(source.indexOf('  const cachedSnapshot=readCachedSnapshot();'));
 assert.doesNotMatch(cacheBoot,/classList.add\('reference-ready'\)|bootScreen\?\.setAttribute\('hidden'/);
});
test('F5: hết thời gian chờ không tự hiển thị iframe hoặc ẩn splash',()=>{
 const start=source.indexOf('  const revealLoginFallback=');
 const end=source.indexOf("  window.addEventListener('crm:session-changed'",start);
 const timers=[];let refreshes=0;
 const boot={hidden:false};
 const context={data:null,bootScreen:boot,bootFallbackTimer:null,refresh(){refreshes++;},console,setTimeout(fn){timers.push(fn);}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'revealLoginFallback();',context);
 for(let n=0;n<40;n++)timers.shift()();
 assert.equal(boot.hidden,false);assert.equal(refreshes,41);
 context.data={user:{id:'sale'}};timers.shift()();assert.equal(timers.length,0);
});
test('F5: chỉ runtime xác nhận unauthenticated mới được hiện login',()=>{
 const start=source.indexOf('  function refresh(force=false,suppliedSnapshot=null) {');
 const end=source.indexOf('    if(!next){',start);
 for(const authState of ['restoring','authenticated','unauthenticated']){
  const context={customerSaveQueue:{pending:0},normalizeAccountingMenu(){},document:{hidden:false,activeElement:{}},working:false,workflowBusy:false,q:()=>null,frame:{contentWindow:{crmApi:{snapshot:()=>null},crmRuntimeAuthState:authState,crmRuntimeBooted:true}},api:null,reachedLogin:false};
  vm.createContext(context);vm.runInContext(source.slice(start,end)+'reachedLogin=true;} refresh(true);',context);
  assert.equal(context.reachedLogin,authState==='unauthenticated');
 }
});
