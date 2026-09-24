'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,19);
function fixture(){
 const sent=[],users=[{id:'s',role:'SALE',telegram_chat_id:'1'},{id:'l',role:'LEADER',telegram_chat_id:'2'},{id:'m',role:'MANAGER',telegram_chat_id:'3'},{id:'admin',role:'ADMIN',telegram_chat_id:'4'}],notices=[],customers=[],offers=[],locks=[];let failure=false;
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
 vm.runInNewContext(fs.readFileSync('telegram-bot.cjs','utf8'),{module,console,AbortSignal,Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'test-only'}},fetch:async(url,options)=>{sent.push({method:url.split('/').pop(),...JSON.parse(options.body)});return {json:async()=>({ok:!failure})};},require:name=>{
  if(name==='./db.js')return {pool:{getConnection:async()=>connection},dbQuery:async(sql,args=[])=>{
   if(sql.includes('FROM users'))return sql.includes("role = 'ADMIN'")?users.filter(u=>u.role==='ADMIN'):users.filter(u=>u.id===args[0]);
   throw Error(sql);
  }};return require(name);
 }});
 return {api:module.exports,users,sent,notices,customers,offers,locks,fail(value){failure=value;}};
}
const customer={id:'CUS-TEST',name:'Test <customer>',phone:'0900000000',email:'test@example.test',createdAt:'2026-09-24 19:00:00',saleId:'s'};
test('Telegram sends pending Sale only a receive button; direct Leader and Manager get contact details',async()=>{
 const f=fixture(),offer={id:'OFR-12345678-1234-1234-1234-123456789abc',saleId:'s',status:'PENDING'};
 const result=await f.api.notifyNewLead(customer,offer);assert.equal(result.sent,1);assert.equal(f.sent[0].chat_id,'1');assert.ok(f.sent[0].reply_markup);assert.ok(Buffer.byteLength(f.sent[0].reply_markup.inline_keyboard[0][0].callback_data)<=64);assert.doesNotMatch(f.sent[0].text,/0900000000/);
 for(const id of ['l','m']){await f.api.notifyNewLead({...customer,saleId:null,managerId:id});const message=f.sent.at(-1);assert.equal(message.chat_id,id==='l'?'2':'3');assert.equal(message.reply_markup,undefined);assert.match(message.text,/0900000000/);assert.match(message.text,/test@example.test/);assert.doesNotMatch(message.text,/Bấm nút/);}
});
test('Admin webhook message contains immediate full details, correct Vietnam time and no accept button',async()=>{
 const f=fixture();const result=await f.api.notifyWebhookLeadAdmins(customer,'2026-09-24 19:00:00');assert.equal(result.sent,1);assert.equal(result.complete,true);
 const message=f.sent[0];assert.equal(message.chat_id,'4');assert.equal(message.reply_markup,undefined);for(const text of ['0900000000','test@example.test','19:00:00','&lt;customer&gt;'])assert.ok(message.text.includes(text));
 await f.api.notifyWebhookLeadAdmins(customer,'2026-09-24 19:00:00',result.deliveredChatIds);assert.equal(f.sent.length,1);
});
test('Telegram API failure is not reported as success',async()=>{const f=fixture();f.fail(true);assert.equal((await f.api.notifyNewLead(customer,{id:'o',saleId:'s',status:'PENDING'})).sent,0);});
test('Outbox retries failed delivery and never resends acknowledged events',async()=>{
 const f=fixture();f.notices.push({id:'n',body:{kind:'WEBHOOK_ADMIN',status:'PENDING',customer,receivedAt:now()}});f.fail(true);await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'PENDING');assert.equal(f.notices[0].body.attempts,1);
 f.fail(false);await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SENT');assert.ok(f.notices[0].body.sentAt);const count=f.sent.length;await f.api.drainLeadNotifications();assert.equal(f.sent.length,count);assert.equal(f.locks.filter(x=>x==='acquire').length,f.locks.filter(x=>x==='release').length);
});
test('Outbox checks current offer and skips revoked offers instead of exposing customer data',async()=>{
 const f=fixture();f.customers.push({...customer,sale_id:null});f.offers.push({id:'o',body:{id:'o',saleId:'s',customerId:customer.id,status:'CANCELLED',offeredAt:now()}});f.notices.push({id:'n',body:{kind:'ASSIGNMENT',status:'PENDING',customerId:customer.id,recipientId:'s',offerId:'o'}});
 await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SKIPPED');assert.equal(f.sent.length,0);
});
test('Outbox resolves Manager ownership from SQL metadata and delivers without an accept button',async()=>{
 const f=fixture(),at=now();f.customers.push({...customer,saleId:null,sale_id:null,custom_fields_json:JSON.stringify({__crmMeta:{managerId:'m',saleAcceptedAt:at}})});f.notices.push({id:'n',body:{kind:'ASSIGNMENT',status:'PENDING',customerId:customer.id,recipientId:'m',acceptedAt:at}});
 await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SENT');assert.equal(f.sent[0].chat_id,'3');assert.equal(f.sent[0].reply_markup,undefined);
});
test('Unlinked members stay queued for retry; stale direct assignments are discarded',async()=>{
 const f=fixture(),at=now();f.users[0].telegram_chat_id=null;f.customers.push({...customer,sale_id:'s',custom_fields_json:JSON.stringify({__crmMeta:{saleAcceptedAt:at}})});f.notices.push({id:'n',body:{kind:'ASSIGNMENT',status:'PENDING',customerId:customer.id,recipientId:'s',acceptedAt:at}});
 await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'PENDING');assert.equal(f.sent.length,0);
 f.customers[0].sale_id='l';await f.api.drainLeadNotifications();assert.equal(f.notices[0].body.status,'SKIPPED');assert.equal(f.sent.length,0);
});
