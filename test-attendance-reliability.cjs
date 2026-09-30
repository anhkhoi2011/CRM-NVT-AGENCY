'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(shared={claims:new Set(),attendance:new Map()}) {
 const events=[],sent=[],user={id:'sale-1',name:'Nhân viên',team_id:'TEAM',role:'SALE',telegram_chat_id:'123'};
 let failing=false,lookupFailure=false;
 const execute=async(sql,args=[])=>{
  events.push('sql');
  if(sql.includes('INSERT IGNORE')){const old=shared.claims.has(args[0]);shared.claims.add(args[0]);return [{affectedRows:old?0:1}];}
  if(sql.startsWith('DELETE')){shared.claims.delete(args[0]);return [{}];}
  if(sql.includes("collection='settings'"))return [[{body:{attendanceDeadline:'09:00'}}]];
  if(sql.startsWith('SELECT body'))return [[...shared.attendance.values()].filter(x=>x.accountId===args[0]&&x.date===args[1]).map(body=>({body}))];
  if(sql.includes("'attendance'")){shared.attendance.set(args[0],JSON.parse(args[1]));return [{affectedRows:1}];}
  throw Error(sql);
 };
 let releaseLock;
 const connection={execute,query:async()=>[[]],beginTransaction:async()=>{await shared.lock;shared.lock=new Promise(r=>{releaseLock=r;});},commit:async()=>{},rollback:async()=>{},release(){events.push('release');releaseLock?.();}};
 const context={module:{exports:{}},console,AbortSignal,Buffer,FormData,Blob,process:{env:{TELEGRAM_BOT_TOKEN:'fake-token'}},fetch:async(url,options)=>{const method=url.split('/').pop();events.push(method);sent.push({method,...JSON.parse(options.body)});return {json:async()=>failing&&method==='sendMessage'?{ok:false,error_code:429}:{ok:true,result:{message_id:1}}};},require(name){
  if(name==='./db.js')return {pool:{execute,getConnection:async()=>connection},telegramPool:{getConnection:async()=>connection},dbQuery:async(sql)=>{events.push('lookup');if(lookupFailure)throw Error('DB_QUERY_TIMEOUT');return [user];}};
  if(name==='./support-chat.cjs')return {};
  return require(name);
 }};
 vm.runInNewContext(fs.readFileSync('telegram-bot.cjs','utf8'),context);
 return {api:context.module.exports,events,sent,shared,fail(value){failing=value;},failLookup(){lookupFailure=true;}};
}
const callback={callback_query:{id:'cb',data:'checkin',from:{id:123},message:{chat:{id:123,type:'private'},message_id:10}}};
test('Repeated scheduler calls and worker restarts send only one reminder per recipient/day',async()=>{
 const a=fixture();assert.equal((await a.api.sendMorningCheckinAlert()).failed,0);
 const b=fixture(a.shared);await Promise.all([a.api.sendMorningCheckinAlert(),b.api.sendMorningCheckinAlert()]);
 assert.equal(a.sent.length+b.sent.length,1);assert.match(a.sent[0].text,/NHẮC ĐIỂM DANH/);
});
test('Explicit Telegram rejection retries the recipient on next scan',async()=>{
 const f=fixture();f.fail(true);assert.equal((await f.api.sendMorningCheckinAlert()).failed,1);f.fail(false);assert.equal((await f.api.sendMorningCheckinAlert()).failed,0);assert.equal(f.sent.length,2);
});
test('Attendance callback answers before SQL and persists once across repeated clicks',async()=>{
 const f=fixture();await f.api.handleTelegramUpdate(callback);assert.equal(f.events[0],'answerCallbackQuery');assert.equal(f.shared.attendance.size,1);
 const record=[...f.shared.attendance.values()][0];await f.api.handleTelegramUpdate(callback);assert.equal(f.shared.attendance.size,1);assert.deepEqual([...f.shared.attendance.values()][0],record);assert.equal(f.events.filter(x=>x==='release').length,2);
});
test('Existing web check-in keeps its timestamp when Telegram is clicked',async()=>{
 const f=fixture(),date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}),record={id:'web-attendance',accountId:'sale-1',date,at:date+' 08:15:00'};f.shared.attendance.set(record.id,record);
 await f.api.handleTelegramUpdate(callback);assert.equal(f.shared.attendance.size,1);assert.match(f.sent.at(-1).text,/08:15:00/);
});
test('Database error still answers the button and reports no successful check-in',async()=>{
 const f=fixture();f.failLookup();await f.api.handleTelegramUpdate(callback);assert.equal(f.events[0],'answerCallbackQuery');assert.equal(f.shared.attendance.size,0);assert.match(f.sent.at(-1).text,/Chưa lưu được/);
});
test('Forwarded group check-in cannot mark another person present',async()=>{
 const f=fixture();await f.api.handleTelegramUpdate({callback_query:{...callback.callback_query,from:{id:999}}});assert.equal(f.shared.attendance.size,0);assert.ok(!f.events.includes('lookup'));
});
