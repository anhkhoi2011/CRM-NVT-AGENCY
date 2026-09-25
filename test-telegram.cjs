'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,19);
function fixture(){
 const sent=[],users=[{id:'s',role:'SALE',telegram_chat_id:'1'},{id:'l',role:'LEADER',telegram_chat_id:'2'},{id:'m',role:'MANAGER',telegram_chat_id:'3'},{id:'admin',role:'ADMIN',telegram_chat_id:'4'}],notices=[],customers=[],offers=[],locks=[],supportReplies=[];let failure=false;
 const query=async(sql,args=[])=>{
  if(sql.includes('GET_LOCK')){locks.push('acquire');return [[{acquired:1}]];}
  if(sql.includes('RELEASE_LOCK')){locks.push('release');return [[{}]];}
  if(sql.includes("collection='telegramOutbox'")&&sql.startsWith('SELECT'))return [notices.filter(n=>n.body.status==='PENDING')];
  if(sql.startsWith('UPDATE crm_documents')){notices.find(n=>n.id===args[1]).body=JSON.parse(args[0]);return [{}];}
  if(sql.includes('FROM customers'))return [customers.filter(c=>c.id===args[0])];
  if(sql.includes("collection='dataOffers'"))return [offers.filter(o=>sql.includes('id=?')?o.id===args[0]:o.body.customerId===args[0]&&o.body.status==='PENDING')];
  throw Error(sql);
 };
 const connection={query,execute:query,release(){locks.push('connection-release');}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('telegram-bot.cjs','utf8'),{module,console,AbortSignal,Buffer,FormData,Blob,process:{env:{TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_ADMIN_CHAT_ID:'999'}},fetch:async(url,options)=>{sent.push({method:url.split('/').pop(),...JSON.parse(options.body)});return {json:async()=>({ok:!failure,result:{message_id:321}})};},require:name=>{
  if(name==='./db.js')return {pool:{getConnection:async()=>connection},dbQuery:async(sql,args=[])=>{
   if(sql.includes('FROM users'))return sql.includes("role = 'ADMIN'")?users.filter(u=>u.role==='ADMIN'):users.filter(u=>u.id===args[0]);
   throw Error(sql);
  }};
  if(name==='./support-chat.cjs')return {createTelegramAdminReply:async(...args)=>{supportReplies.push(args);return {matched:true};}};
  return require(name);
 }});
 return {api:module.exports,users,sent,notices,customers,offers,locks,supportReplies,fail(value){failure=value;}};
}
const customer={id:'CUS-TEST',name:'Test <customer>',phone:'0900000000',email:'test@example.test',createdAt:'2026-09-24 19:00:00',saleId:'s'};
test('Telegram sends pending Sale only a receive button; direct Leader and Manager get contact details',async()=>{
 const f=fixture(),offer={id:'OFR-12345678-1234-1234-1234-123456789abc',saleId:'s',status:'PENDING'};
 const result=await f.api.notifyNewLead(customer,offer);assert.equal(result.sent,1);assert.equal(f.sent[0].chat_id,'1');assert.ok(f.sent[0].reply_markup);assert.ok(Buffer.byteLength(f.sent[0].reply_markup.inline_keyboard[0][0].callback_data)<=64);assert.doesNotMatch(f.sent[0].text,/0900000000/);
 for(const id of ['l','m']){await f.api.notifyNewLead({...customer,saleId:null,managerId:id});const message=f.sent.at(-1);assert.equal(message.chat_id,id==='l'?'2':'3');assert.equal(message.reply_markup,undefined);assert.match(message.text,/0900000000/);assert.match(message.text,/test@example.test/);assert.doesNotMatch(message.text,/Bấm nút/);}
});
test('Admin webhook message contains immediate full details, correct Vietnam time and no accept button',async()=>{
 const f=fixture();const result=await f.api.notifyWebhookLeadAdmins(customer,'2026-09-24 19:00:00');assert.equal(result.sent,1);assert.equal(result.complete,true);
 const message=f.sent[0];assert.equal(message.chat_id,'999');assert.equal(message.reply_markup,undefined);for(const text of ['0900000000','test@example.test','19:00:00','&lt;customer&gt;'])assert.ok(message.text.includes(text));
 await f.api.notifyWebhookLeadAdmins(customer,'2026-09-24 19:00:00',result.deliveredChatIds);assert.equal(f.sent.length,1);
});
test('Telegram API failure is not reported as success',async()=>{const f=fixture();f.fail(true);assert.equal((await f.api.notifyNewLead(customer,{id:'o',saleId:'s',status:'PENDING'})).sent,0);});
test('Outbox retries failed delivery and never resends acknowledged events',async()=>{
 const f=fixture();f.notices.push({id:'n',body:{kind:'WEBHOOK_ADMIN',status:'PENDING',customer,receivedAt:now()}});f.fail(true);await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'PENDING');assert.equal(f.notices[0].body.attempts,1);
 f.fail(false);await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SENT');assert.ok(f.notices[0].body.sentAt);const count=f.sent.length;await f.api.drainLeadNotifications();assert.equal(f.sent.length,count);assert.equal(f.locks.filter(x=>x==='acquire').length,f.locks.filter(x=>x==='release').length);
});
test('Telegram scheduler also drains pending Admin webhook notices',async()=>{
 const f=fixture();f.notices.push({id:'admin-notice',body:{kind:'WEBHOOK_ADMIN',status:'PENDING',customer,receivedAt:now()}});
 await f.api.runTelegramScheduler();
 assert.equal(f.notices[0].body.status,'SENT');assert.equal(f.sent[0].chat_id,'999');
});
test('Outbox checks current offer and skips revoked offers instead of exposing customer data',async()=>{
 const f=fixture();f.customers.push({...customer,sale_id:null});f.offers.push({id:'o',body:{id:'o',saleId:'s',customerId:customer.id,status:'CANCELLED',offeredAt:now()}});f.notices.push({id:'n',body:{kind:'ASSIGNMENT',status:'PENDING',customerId:customer.id,recipientId:'s',offerId:'o'}});
 await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SKIPPED');assert.equal(f.sent.length,0);
});
test('Outbox resolves Manager ownership from SQL metadata and delivers without an accept button',async()=>{
 const f=fixture(),at=now();f.customers.push({...customer,saleId:null,sale_id:null,custom_fields_json:JSON.stringify({__crmMeta:{managerId:'m',saleAcceptedAt:at}})});f.notices.push({id:'n',body:{kind:'ASSIGNMENT',status:'PENDING',customerId:customer.id,recipientId:'m',acceptedAt:at}});
 await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SENT');assert.equal(f.sent[0].chat_id,'3');assert.equal(f.sent[0].reply_markup,undefined);
});
test('Internal support notification targets configured Admin chat and requests a Telegram reply',async()=>{
 const f=fixture();
 const result=await f.api.notifyInternalSupportMessage({content:'Can ho tro kiem tra hop dong.',createdAt:'2026-09-25 09:30:00',requester:{name:'Nguyen An',department:'Sales',accountId:'SALE-001'}});
 assert.equal(result.sent,true);assert.equal(result.messageId,321);assert.equal(f.sent.length,1);
 assert.equal(f.sent[0].method,'sendMessage');assert.equal(f.sent[0].chat_id,'999');
 assert.match(f.sent[0].text,/Nguyen An/);assert.match(f.sent[0].text,/Can ho tro kiem tra hop dong/);
 assert.equal(f.sent[0].reply_markup.force_reply,true);
});
test('Telegram reply from configured Admin chat is returned to the matching support conversation',async()=>{
 const f=fixture();
 await f.api.handleTelegramUpdate({message:{chat:{id:999,type:'private'},text:'Da kiem tra, ban thuc hien lai buoc 2.',reply_to_message:{message_id:321}}});
 assert.deepEqual(f.supportReplies,[[999,321,'Da kiem tra, ban thuc hien lai buoc 2.']]);
});
test('Telegram replies from any other chat cannot write to internal support conversations',async()=>{
 const f=fixture();
 await f.api.handleTelegramUpdate({message:{chat:{id:111,type:'private'},text:'Khong duoc phep.',reply_to_message:{message_id:321}}});
 assert.equal(f.supportReplies.length,0);
});
test('Unlinked members stay queued for retry; stale direct assignments are discarded',async()=>{
 const f=fixture(),at=now();f.users[0].telegram_chat_id=null;f.customers.push({...customer,sale_id:'s',custom_fields_json:JSON.stringify({__crmMeta:{saleAcceptedAt:at}})});f.notices.push({id:'n',body:{kind:'ASSIGNMENT',status:'PENDING',customerId:customer.id,recipientId:'s',acceptedAt:at}});
 await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'PENDING');assert.equal(f.sent.length,0);
 f.customers[0].sale_id='l';await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SKIPPED');assert.equal(f.sent.length,0);
});
test('Admin webhook message includes the configured source URL',async()=>{
 const f=fixture();
 const result=await f.api.notifyWebhookLeadAdmins(customer,'2026-09-24 19:00:00',[],{sourceUrl:'https://landing.example.test/form?utm_source=crm'});
 assert.equal(result.sent,1);assert.match(f.sent[0].text,/https:\/\/landing\.example\.test\/form\?utm_source=crm/);
});
test('Admin webhook outbox forwards the configured source URL',async()=>{
 const f=fixture();
 f.notices.push({id:'source-url-notice',body:{kind:'WEBHOOK_ADMIN',status:'PENDING',customer,receivedAt:now(),source:{sourceUrl:'https://landing.example.test/from-outbox'}}});
 await f.api.drainLeadNotifications();
 assert.equal(f.notices[0].body.status,'SENT');assert.match(f.sent[0].text,/https:\/\/landing\.example\.test\/from-outbox/);
});
