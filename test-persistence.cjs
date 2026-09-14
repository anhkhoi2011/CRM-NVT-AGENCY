"use strict";
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
// CSDL giả lập giao dịch để kiểm tra logic; không thay thế thử nghiệm MySQL trên hosting.
function fixture(){
 let db={docs:[],customers:[],orders:[],products:[{id:'p1',sku:'TEST',name:'Test product',category:'Test',price:120,type:'RENTAL',rental_months:3,active:1,created_at:'2026-08-01 08:00:00'}],users:[],history:[]};let backup,fail=false;
 const events=[];
 const c={async beginTransaction(){backup=structuredClone(db);events.push('begin');},async commit(){events.push('commit');},async rollback(){db=backup;events.push('rollback');},release(){events.push('release');},
 async query(sql){return this.execute(sql,[]);},
 async execute(sql,v){
  if(sql.includes('FROM crm_write_lock'))return [[{id:1}]];
  if(sql==='SELECT * FROM crm_documents')return [structuredClone(db.docs)];
  if(sql.includes('FROM system_settings'))return [[{setting_key:'crm_defaults_v1',setting_value:'true'}]];
  if(sql.includes('FROM users'))return [structuredClone(db.users)];
  for(const key of ['customers','orders','products'])if(sql===`SELECT * FROM ${key}`)return [structuredClone(db[key])];
  if(sql.startsWith('SELECT actor_id'))return [db.history.filter(x=>x.request_id===v[0])];
  if(sql.startsWith('INSERT INTO crm_changes')){db.history.push({request_id:v[0],actor_id:v[1],changes_json:JSON.parse(v[2])});return [{}];}
  if(sql.startsWith('INSERT INTO crm_documents')){
   if(fail)throw new Error('Disk/database failure');
   const row={collection:v[0],id:v[1],body:JSON.parse(v[2]),deleted:v[3]||0};db.docs=db.docs.filter(x=>x.collection!==row.collection||x.id!==row.id);db.docs.push(row);return [{}];
  }
  if(sql.startsWith('INSERT INTO customers')){
   const keys=['id','name','phone','email','source','campaign','website_id','status','sale_id','leader_id','team_id','note','custom_fields_json','created_at'];
   upsert('customers',keys,v);return [{}];
  }
  if(sql.startsWith('INSERT INTO orders')){upsert('orders',['id','code','customer_id','sale_id','leader_id','team_id','total_amount','status','items_json','note','created_at'],v);return [{}];}
  if(sql.startsWith('INSERT INTO products')){upsert('products',['id','sku','name','category','price','type','rental_months','active','created_at'],v);return [{}];}
  if(sql.startsWith('UPDATE users SET name')){const row=db.users.find(x=>x.id===v[6]);if(row)Object.assign(row,{name:v[0],role:v[1],team_id:v[2],leader_id:v[3],active:v[4],email:v[5]||row.email});return [{}];}
  if(sql.startsWith('UPDATE users SET active')){const row=db.users.find(x=>x.id===v[0]);if(row)row.active=0;return [{}];}
  if(sql.startsWith('UPDATE ')||sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE INTO crm_write_lock')||sql.startsWith('INSERT INTO system_settings'))return [{}];
  throw new Error('Unexpected SQL: '+sql);
 }};
 function upsert(key,keys,v){const row=Object.fromEntries(keys.map((k,i)=>[k,v[i]]));row.created_at=db[key].find(r=>r.id===row.id)?.created_at||row.created_at||'2026-09-14 09:00:00';row.updated_at='2026-09-14 10:00:00';db[key]=db[key].filter(r=>r.id!==row.id);db[key].push(row);}
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('crm-data.cjs','utf8'),{module,require:name=>name==='./db.js'?{pool:{query:async()=>[{}],getConnection:async()=>c}}:require(name),Buffer,console});
 return {api:module.exports,events,get db(){return db;},fail(){fail=true;}};
}
const admin={id:'admin',role:'ADMIN'},sale={id:'sale',role:'SALE',teamId:'T',leaderId:'lead'};
const customer={id:'c1',name:'Khách thử',phone:'0912345678',saleId:'sale',teamId:'T',leaderId:'lead',status:'NEW',createdAt:'2026-08-01 09:00:00',customFields:{level:'L3'}};
const order={id:'o1',code:'NVT-o1',customerId:'c1',saleId:'sale',teamId:'T',leaderId:'lead',status:'PENDING',subtotal:360,vatRate:0.1,vatAmount:36,total:376,qty:3,unitPrice:120,discount:20,productId:'p1',productName:'Historical price',paymentMode:'DEPOSIT',depositAmount:100,balanceDue:376,amountPaid:0,paymentMethod:'VietQR',billing:{name:'Test customer',cccd:'012345678901',phone:'0912345678',email:'khach@example.vn',address:'TP HCM',taxId:''},rentalMonths:3,rentalEndsAt:'2026-11-01T03:00:00.000Z',createdAt:'2026-08-01 10:00:00'};
const change=(key,value,base=null)=>({key,id:value.id,base,value});
test('Sale tạo khách, đơn, ghi chú, công việc trong một giao dịch; giữ giá và ngày gốc',async()=>{
 const f=fixture();const result=await f.api.write(sale,'one',[change('orders',order),change('notes',{id:'n1',customerId:'c1',text:'Lần đầu'}),change('tasks',{id:'t1',customerId:'c1'}),change('customers',customer)]);
 assert.equal(result.state.orders[0].unitPrice,120);assert.equal(result.state.orders[0].discount,20);assert.equal(result.state.orders[0].vatAmount,36);assert.equal(result.state.orders[0].billing.cccd,'012345678901');assert.equal(result.state.orders[0].rentalMonths,3);assert.equal(result.state.customers[0].createdAt,customer.createdAt);assert.equal(result.state.notes.length,1);assert.equal(f.db.history.length,1);
 const reread=await f.api.read(admin);assert.equal(reread.state.tasks.length,1);assert.equal(reread.state.orders[0].createdAt,order.createdAt);
});
test('Lỗi giữa giao dịch rollback cả projection và documents',async()=>{
 const f=fixture();f.fail();await assert.rejects(f.api.write(admin,'fail',[change('customers',customer)]),/failure/);assert.equal(f.db.customers.length,0);assert.equal(f.db.history.length,0);assert.ok(f.events.includes('rollback'));
});
test('Gửi lại cùng requestId không tạo bản sao; phiên bản cũ bị 409',async()=>{
 const f=fixture(),first=await f.api.write(admin,'one',[change('customers',customer)]);
 const retry=await f.api.write(admin,'one',[change('customers',customer)]);assert.equal(retry.replayed,true);assert.equal(f.db.history.length,1);
 await f.api.write(admin,'two',[change('customers',{...first.state.customers[0],name:'Mới'},first.versions['customers/c1'])]);
 await assert.rejects(f.api.write(admin,'three',[change('customers',{...first.state.customers[0],name:'Cũ'},first.versions['customers/c1'])]),e=>e.status===409);
 assert.equal((await f.api.read(admin)).state.customers[0].name,'Mới');
});
test('Sale không thấy khách đội khác, không tự PAID hay tự thăng Admin',async()=>{
 const f=fixture();await f.api.write(admin,'one',[change('customers',customer),change('orders',order)]);
 assert.equal((await f.api.read({...sale,id:'other'})).state.customers.length,0);
 const result=await f.api.read(sale);
 await assert.rejects(f.api.write(sale,'two',[change('orders',{...result.state.orders[0],status:'PAID'},result.versions['orders/o1'])]),e=>e.status===403);
 await assert.rejects(f.api.write(sale,'three',[change('members',{id:'sale',name:'Sale',role:'ADMIN'})]),e=>e.status===403);
});
test('Toàn bộ collection phụ đọc lại được; xóa giữ before-image',async()=>{
 const f=fixture();const keys=f.api.LISTS.filter(k=>!['customers','orders','products','members'].includes(k));
 const changes=keys.map(key=>change(key,{id:'row-'+key,value:'giữ lâu dài'}));
 for(const key of f.api.OBJECTS)changes.push({key,id:'$',base:null,value:key==='productCategories'?['Dịch vụ']:{test:'giữ'}});
 await f.api.write(admin,'all',changes);let result=await f.api.read(admin);
 for(const key of keys)assert.equal(result.state[key].length,1,key);
 await f.api.write(admin,'delete',[{key:'notes',id:'row-notes',base:result.versions['notes/row-notes'],value:null}]);
 result=await f.api.read(admin);assert.equal(result.state.notes.length,0);assert.equal(f.db.history[1].changes_json[0].before.value,'giữ lâu dài');assert.equal(f.db.docs.find(r=>r.collection==='notes').deleted,1);
});
test('Phân quyền tài khoản chờ ghi đúng users; xóa không hồi sinh',async()=>{
 const f=fixture();f.db.users.push({id:'u1',name:'Nguyễn A',role:'UNASSIGNED',phone:'0900000000',email:'a@test.vn',active:1,created_at:'2026-09-14 09:00:00'});
 let r=await f.api.read(admin);assert.equal(r.state.registeredAccounts.length,1);
 r=await f.api.write(admin,'assign',[change('members',{...r.state.registeredAccounts[0],role:'LEADER',teamId:'T'},r.versions['members/u1'])]);
 assert.equal(f.db.users[0].role,'LEADER');assert.equal(r.state.registeredAccounts.length,0);assert.equal(r.state.members.length,1);
 await f.api.write(admin,'delete',[{key:'members',id:'u1',base:r.versions['members/u1'],value:null}]);assert.equal((await f.api.read(admin)).state.members.length,0);assert.equal(f.db.users[0].active,0);
});
test('Leader đổi phân phối không xóa bí mật của Admin',async()=>{
 const f=fixture();await f.api.write(admin,'settings',[{key:'settings',id:'$',base:null,value:{dataBotToken:'secret',saleAssignmentModes:{},assignmentCursor:{}}}]);
 const lead={id:'lead',role:'LEADER',teamId:'T'},r=await f.api.read(lead);assert.equal(r.state.settings.dataBotToken,undefined);
 await f.api.write(lead,'edit',[{key:'settings',id:'$',base:r.versions['settings/$'],value:{...r.state.settings,saleAssignmentModes:{lead:'AUTO'}}}]);
 assert.equal((await f.api.read(admin)).state.settings.dataBotToken,'secret');
});
test('Offer hết hạn được lưu bởi server',async()=>{
 const f=fixture();await f.api.write(admin,'offer',[change('dataOffers',{id:'of1',customerId:'c1',saleId:'sale',status:'PENDING',offeredAt:'2020-01-01 10:00'})]);
 assert.equal((await f.api.read(admin)).state.dataOffers[0].status,'EXPIRED');assert.equal(f.db.history.at(-1).actor_id,'SYSTEM');
});
function frontend(){
 const elements=new Map();const node=()=>({value:'',children:[],dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},append(){},prepend(){},remove(){},focus(){},setAttribute(){},querySelectorAll(){return [];}});
 const document={readyState:'loading',activeElement:{},documentElement:node(),body:node(),addEventListener(){},createElement:node,querySelector(q){if(!elements.has(q))elements.set(q,node());return elements.get(q);},querySelectorAll(){return [];}};
 const values=new Map(),store={getItem(key){return values.has(key)?values.get(key):null;},setItem(key,value){values.set(key,String(value));},removeItem(key){values.delete(key);},key(index){return [...values.keys()][index]??null;}};Object.defineProperty(store,'length',{get(){return values.size;}});
 const context={document,window:{addEventListener(){},matchMedia(){return {matches:false};},location:{protocol:'http:',origin:'http://localhost:4173',hostname:'localhost'},confirm:()=>true},location:{protocol:'http:',origin:'http://localhost:4173',hostname:'localhost'},localStorage:store,sessionStorage:store,navigator:{},crypto:require('node:crypto').webcrypto,structuredClone,console,URL,Blob,Intl,TextEncoder,confirm:()=>true,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},fetch:async()=>({ok:false,json:async()=>({error:'offline'})})};
 vm.createContext(context);vm.runInContext(fs.readFileSync('crm.js','utf8'),context);return context;
}
test('Frontend khởi tạo form đăng nhập không truy cập tài khoản mẫu đã xóa',async()=>{const c=frontend();await c.initialize();assert.equal(vm.runInContext('state.members.length',c),0);});
test('Frontend lỗi mạng giữ requestId và bản nháp để retry',async()=>{
 const c=frontend();vm.runInContext("currentAccount={id:'admin',role:'ADMIN'};serverSyncToken='token';applyServerSnapshot({state:initialState(),versions:{}});state.notes.push({id:'n1',text:'Bản nháp'});",c);
 assert.equal(await c.flushServerPersistence(),false);const id=vm.runInContext('serverPendingRequest.requestId',c);
 assert.equal(await c.flushServerPersistence(),false);assert.equal(vm.runInContext('serverPendingRequest.requestId',c),id);assert.equal(vm.runInContext('hasServerChanges()',c),true);
});
test('Frontend giữ sửa tiếp trong lúc request đang chạy; snapshot sạch không phát sinh ghi',()=>{
 const c=frontend();vm.runInContext("applyServerSnapshot({state:initialState(),versions:{}})",c);assert.equal(vm.runInContext('hasServerChanges()',c),false);
 vm.runInContext("state.notes=[{id:'n',text:'gửi'}]; const sent=serverRecords();state.notes[0].text='sửa tiếp';applyServerSnapshot({state:{...initialState(),notes:[{id:'n',text:'gửi'}]},versions:{'notes/n':'revision'}},sent);",c);
 assert.equal(vm.runInContext('state.notes[0].text',c),'sửa tiếp');assert.equal(vm.runInContext('pendingChanges()[0].base',c),'revision');
});

test('Các view chính dựng được sau khi tải snapshot rỗng',()=>{
 const c=frontend();vm.runInContext("currentAccount=hydrateSessionAccount({id:'admin',name:'Admin',role:'ADMIN'});applyServerSnapshot({state:initialState(),versions:{}});",c);
 for(const view of ['dashboard','customers','orders','products','team','settings','audit','notifications'])vm.runInContext(`currentView=${JSON.stringify(view)};render()`,c);
});

function authFixture(rows=[],duplicate=false){
 const calls=[],signals=[],c={dbConfigured:true,systemAccountsReady:Promise.resolve(true),crypto:require('node:crypto'),bcrypt:{hash:async p=>'hashed:'+p,compare:async(p,h)=>h==='hashed:'+p},crmData:{userRow:r=>({id:r.id,role:r.role})},dbQuery:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT'))return rows;if(duplicate&&sql.startsWith('INSERT INTO users'))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});return [];},readBody:async r=>Buffer.from(JSON.stringify(r.body||{})),sendJson:(response,status,payload)=>{response.status=status;response.payload=payload;},notifyInboxListeners:e=>signals.push(e),stamp:()=> '2026-09-14 10:00',Buffer,console};
 const text=fs.readFileSync('webhook-server.cjs','utf8');vm.createContext(c);vm.runInContext(text.slice(text.indexOf('function dbJson('),text.indexOf('\n/**',text.indexOf('function dbJson('))),c);
 return {calls,signals,async request(path,body){const response={};await c.handleDbApi({method:'POST',headers:{},body},response,path);return response;}};
}
test('Đăng ký công khai lưu hash và báo Admin ngay sau insert',async()=>{
 const f=authFixture();const result=await f.request('/api/auth/register',{phone:'0912345678',email:'sale@example.vn',name:'Sale',password:'password123'});
 assert.equal(result.status,201);assert.equal(f.signals.length,1);assert.equal(f.signals[0].kind,'users');const insert=f.calls.find(x=>x.sql.startsWith('INSERT'));assert.equal(insert.args[3],'hashed:password123');assert.ok(insert.sql.includes("'UNASSIGNED'"));
});
test('Đăng ký trùng trả 400 không phát tín hiệu thành công',async()=>{
 const f=authFixture([],true);const result=await f.request('/api/auth/register',{phone:'0912345678',email:'sale@example.vn',name:'Sale',password:'password123'});assert.equal(result.status,400);assert.equal(f.signals.length,0);
});
test('Tài khoản chưa phân quyền không được cấp phiên đăng nhập',async()=>{
 const f=authFixture([{id:'u1',role:'UNASSIGNED',password_hash:'password123'}]);const result=await f.request('/api/auth/login',{identifier:'sale@example.vn',password:'password123'});assert.equal(result.status,403);assert.equal(f.calls.some(x=>x.sql.startsWith('INSERT INTO crm_sessions')),false);
});

test('Đồng bộ giữ tham chiếu của form đang mở để lần sửa tiếp theo được lưu',()=>{
 const c=frontend();vm.runInContext("applyServerSnapshot({state:{...initialState(),customers:[{id:'c',name:'A'}]},versions:{}});const formCustomer=state.customers[0];applyServerSnapshot({state:{...initialState(),customers:[{id:'c',name:'B'}]},versions:{'customers/c':'new'}});formCustomer.name='C';",c);
 assert.equal(vm.runInContext('state.customers[0].name',c),'C');assert.equal(vm.runInContext('pendingChanges()[0].value.name',c),'C');
});

test('Marketing/Kế toán có dữ liệu tra cứu nhưng không có quyền ghi hay xem cài đặt/tài khoản',async()=>{
 const f=fixture();await f.api.write(admin,'initial',[change('customers',customer),change('orders',order),{key:'settings',id:'$',base:null,value:{dataBotToken:'private'}},change('traffic',{id:'tr1',source:'Ads'})]);
 for(const role of ['MARKETING','ACCOUNTING']){
  const user={id:role,role},r=await f.api.read(user);
  assert.equal(r.state.customers.length,1);assert.equal(r.state.orders.length,1);assert.equal(r.state.settings,undefined);assert.equal(r.state.accounts.length,0);
  assert.equal(r.state.traffic.length,role==='MARKETING'?1:0);
  await assert.rejects(f.api.write(user,'deny-'+role,[change('customers',{...r.state.customers[0],name:'Changed'},r.versions['customers/c1'])]),e=>e.status===403);
  await assert.rejects(f.api.write(user,'escalate-'+role,[change('members',{id:user.id,name:'X',role:'ADMIN'})]),e=>e.status===403);
 }
});
test('Hai vai trò phòng ban giữ đúng role, menu và không phát sinh ghi khi đăng nhập',async()=>{
 for(const role of ['MARKETING','ACCOUNTING']){
  const c=frontend();vm.runInContext(`currentAccount=hydrateSessionAccount({id:'dept',role:${JSON.stringify(role)},name:'Phòng ban'});applyServerSnapshot({state:initialState(),versions:{}});`,c);
  assert.equal(vm.runInContext('currentAccount.role',c),role);assert.equal(vm.runInContext('currentAccount.scope',c),'ALL');
  assert.equal(vm.runInContext("allowedViews().includes('settings')||allowedViews().includes('team')",c),false);
  for(const view of vm.runInContext('allowedViews()',c))vm.runInContext(`currentView=${JSON.stringify(view)};render()`,c);
  assert.equal(vm.runInContext('hasServerChanges()',c),false);assert.equal(vm.runInContext("orderEditState({createdAt:'2026-09-14 10:00'}).allowed",c),false);
 }
});
function seedFixture(existing=[],failEmail=null){
 const {provisionSystemAccounts}=require('./system-accounts.cjs');let users=structuredClone(existing),marker=false,backup;let sessions=['old'];const events=[];
 const c={async beginTransaction(){backup={users:structuredClone(users),marker,sessions:[...sessions]};},async commit(){events.push('commit');},async rollback(){if(backup)({users,marker,sessions}=backup);events.push('rollback');},release(){events.push('release');},async query(sql){if(sql.includes('GET_LOCK'))return [[{acquired:1}]];return [[]];},async execute(sql,v=[]){
  if(sql.startsWith('SELECT setting_key'))return [marker?[{setting_key:'done'}]:[]];
  if(sql.startsWith('SELECT id,email FROM users WHERE LOWER'))return [users.filter(u=>u.email.toLowerCase()===v[0])];
  if(sql.startsWith('SELECT id,email'))return [users.filter(u=>u.id==='u-admin-start'&&u.role==='ADMIN')];
  if(sql.startsWith('UPDATE users SET email')){if(v[0]===failEmail)throw new Error('DB failure');Object.assign(users.find(u=>u.id===v[4]),{email:v[0],name:v[1],role:v[2],password_hash:v[3],active:1});return [{}];}
  if(sql.startsWith('INSERT INTO users')){if(v[1]===failEmail)throw new Error('DB failure');users.push({id:v[0],email:v[1],name:v[2],role:v[3],password_hash:v[4],active:1});return [{}];}
  if(sql.startsWith('DELETE FROM crm_sessions')){sessions=[];return [{}];}
  if(sql.startsWith('UPDATE crm_documents'))return [{}];
  if(sql.startsWith('INSERT INTO system_settings')){marker=true;return [{}];}
  throw new Error('Unexpected: '+sql);
 }};
 return {run:()=>provisionSystemAccounts({getConnection:async()=>c}),get users(){return users;},get marker(){return marker;},events};
}
test('Khởi tạo ba tài khoản khi bảng đã có Sale; mật khẩu là bcrypt và role khác nhau',async()=>{
 const f=seedFixture([{id:'sale',email:'sale@test.vn',role:'SALE'}]);await f.run();assert.equal(f.users.length,4);
 const roles={'admin@nvtagency.top':'ADMIN','marketing@nvtagency.top':'MARKETING','ketoan@nvtagency.top':'ACCOUNTING'};
 for(const [email,role] of Object.entries(roles)){const user=f.users.find(u=>u.email===email);assert.equal(user.role,role);assert.match(user.password_hash,/^\$2[aby]\$/);}
 assert.equal(f.marker,true);
});
test('Khôi phục email Admin hiện hữu giữ ID, áp dụng một lần, restart không reset mật khẩu',async()=>{
 const f=seedFixture([{id:'existing-admin',email:'admin@nvtagency.top',role:'UNASSIGNED',password_hash:'old'}]);await f.run();const user=f.users.find(u=>u.email==='admin@nvtagency.top');assert.equal(user.id,'existing-admin');assert.equal(user.role,'ADMIN');assert.notEqual(user.password_hash,'old');user.password_hash='user-changed';assert.equal((await f.run()).applied,false);assert.equal(f.users.find(u=>u.id===user.id).password_hash,'user-changed');assert.equal(f.users.length,3);
});
test('Lỗi tạo một tài khoản rollback toàn bộ và không đánh dấu đã khởi tạo',async()=>{
 const f=seedFixture([{id:'sale',email:'sale@test.vn',role:'SALE'}],'marketing@nvtagency.top');await assert.rejects(f.run(),/DB failure/);assert.equal(f.users.length,1);assert.equal(f.marker,false);assert.ok(f.events.includes('rollback'));
});
test('Đăng nhập hiển thị đúng lỗi server thay vì luôn báo sai mật khẩu',async()=>{
 const c=frontend();await c.initialize();c.fetch=async()=>({ok:false,status:503,json:async()=>({error:'MySQL chưa được cấu hình'})});
 vm.runInContext("document.querySelector('#loginPhone').value='admin@nvtagency.top';document.querySelector('#loginPassword').value='dummy';document.querySelector('#loginForm button[type=\"submit\"]').innerHTML='Đăng nhập';",c);
 await vm.runInContext("document.querySelector('#loginForm').onsubmit({preventDefault(){}})",c);
 assert.equal(vm.runInContext("document.querySelector('#loginError').textContent",c),'MySQL chưa được cấu hình');
 assert.equal(vm.runInContext("document.querySelector('#loginForm button[type=\"submit\"]').disabled",c),false);
 assert.equal(vm.runInContext("document.querySelector('#loginForm button[type=\"submit\"]').innerHTML",c),'Đăng nhập');
 assert.doesNotMatch(fs.readFileSync('crm.js','utf8'),/Xuất dữ liệu trình duyệt cũ|exportLegacyData/);
});

test('Khôi phục sản phẩm localStorage cũ không ghi đè sản phẩm đã có',async()=>{
 const c=frontend();vm.runInContext(`localStorage.setItem(STORAGE_KEY,JSON.stringify({products:[{id:'old-1',name:'Chỉ báo Gold',sku:'GOLD',category:'Chỉ báo',price:2500000,type:'SALE'},{id:'same',name:'Đã có',sku:'EXIST',category:'CRM',price:1,type:'SALE'}]}));currentAccount={id:'admin',name:'Admin',role:'ADMIN',scope:'ALL'};applyServerSnapshot({state:{...initialState(),products:[{id:'same',name:'Đã có',sku:'EXIST',category:'CRM',price:1,type:'SALE',active:true}]},versions:{}});flushServerPersistence=async()=>true;`,c);
 assert.equal(vm.runInContext('legacyProductCandidates().length',c),1);await c.restoreLegacyProducts();
 assert.equal(vm.runInContext('state.products.length',c),2);assert.equal(vm.runInContext("state.products.find(p=>p.id==='old-1').price",c),2500000);assert.equal(vm.runInContext('localStorage.length',c),1);
});

function productSeedFixture(existing=[],failSku=''){
 let products=structuredClone(existing),marker=false,backup;
 const events=[];
 const c={async beginTransaction(){backup={products:structuredClone(products),marker};events.push('begin');},async commit(){events.push('commit');},async rollback(){products=backup.products;marker=backup.marker;events.push('rollback');},release(){},async query(sql){if(sql.includes('crm_write_lock'))return [[{id:1}]];throw new Error('Unexpected query: '+sql);},async execute(sql,v=[]){
  if(sql.includes("setting_key='product_catalog_20260914_v1'"))return [marker?[{setting_key:'product_catalog_20260914_v1'}]:[]];
  if(sql.startsWith('SELECT id FROM products'))return [products.filter(item=>item.id===v[0]||item.sku===v[1]).map(item=>({id:item.id}))];
  if(sql.startsWith('INSERT INTO products')){if(v[1]===failSku)throw new Error('Catalog failure');products.push({id:v[0],sku:v[1],name:v[2],category:v[3],price:v[4],type:v[5],rental_months:v[6],active:v[7]});return [{}];}
  if(sql.startsWith('INSERT INTO system_settings')){marker=true;return [{}];}
  throw new Error('Unexpected execute: '+sql);
 }};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync('crm-data.cjs','utf8'),{module,require:name=>name==='./db.js'?{pool:{getConnection:async()=>c}}:require(name),Buffer,console});
 return {run:()=>module.exports.seedProductCatalog(),removeAll(){products=[];},get products(){return products;},get marker(){return marker;},events};
}
test('Catalog seed inserts seven products with exact prices and rental periods',async()=>{
 const f=productSeedFixture();const result=await f.run();assert.equal(result.inserted,7);assert.equal(f.products.length,7);assert.equal(f.marker,true);
 assert.deepEqual(f.products.map(p=>[p.sku,p.price,p.rental_months]),[['KH-HHCB-09',5000000,null],['KH-KLCS-10',10000000,null],['KH-RSIMA-11',26000000,null],['IND-BF-R1M',1014000,1],['IND-BF-R3M',3042000,3],['IND-BF-R6M',6084000,6],['IND-BF-R12M',12168000,12]]);
});
test('Catalog seed preserves existing ID/SKU and does not resurrect after marker',async()=>{
 const f=productSeedFixture([{id:'custom-id',sku:'KH-HHCB-09',name:'Admin edited name',price:123}]);await f.run();assert.equal(f.products.find(p=>p.sku==='KH-HHCB-09').price,123);assert.equal(f.products.length,7);
 f.removeAll();const retry=await f.run();assert.equal(retry.applied,false);assert.equal(f.products.length,0);
});
test('Catalog seed rolls back and leaves no marker after failure',async()=>{
 const f=productSeedFixture([], 'IND-BF-R3M');await assert.rejects(f.run(),/Catalog failure/);assert.equal(f.products.length,0);assert.equal(f.marker,false);assert.ok(f.events.includes('rollback'));
});
test('Frontend has no business-data localStorage writes',()=>{
 const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('crm.js','utf8');assert.doesNotMatch(html,/localStorage\.setItem|nvt-payment-sidecar|const CATALOG/);const writes=[...js.matchAll(/localStorage\.setItem\(([^,]+)/g)].map(match=>match[1].trim());assert.deepEqual(writes,['THEME_KEY']);
});
test('Rental expiry warning persists exactly once',async()=>{
 const f=fixture(),ends=new Date(Date.now()+2*86400000).toISOString();await f.api.write(admin,'rental',[change('customers',customer),change('orders',{...order,status:'PAID',amountPaid:order.total,balanceDue:0,paidAt:'2026-09-14 10:00',rentalEndsAt:ends})]);
 const first=await f.api.read(admin),second=await f.api.read(admin);assert.equal(first.state.notifications.filter(n=>n.id==='NT-RENT-o1').length,1);assert.equal(second.state.notifications.filter(n=>n.id==='NT-RENT-o1').length,1);assert.equal(f.db.docs.filter(d=>d.collection==='notifications'&&d.id==='NT-RENT-o1').length,1);
});

test('Server rejects a Sale order whose price differs from the MySQL catalog',async()=>{
 const f=fixture();await assert.rejects(f.api.write(sale,'bad-price',[change('customers',customer),change('orders',{...order,unitPrice:1,subtotal:3,vatAmount:0,discount:0,total:3,balanceDue:3})]),error=>error.status===400);assert.equal(f.db.orders.length,0);
});
test('Sale order form keeps VAT, deposit, billing and rental data in the unified MySQL change',async()=>{
 const c=frontend();vm.runInContext(`applyServerSnapshot({state:{...initialState(),members:[{id:'sale',name:'Sale',role:'SALE',teamId:'T',leaderId:'lead',active:true}],customers:[{id:'c1',name:'Customer',phone:'0912345678',email:'c@example.vn',saleId:'sale',teamId:'T',leaderId:'lead',source:'Direct / Referral'}],products:[{id:'p1',name:'Indicator',sku:'IND-BF-R1M',category:'Indicator',price:1014000,type:'RENTAL',rentalMonths:1,active:true}]},versions:{}});currentAccount=hydrateSessionAccount({id:'sale',name:'Sale',role:'SALE',teamId:'T',leaderId:'lead'});flushServerPersistence=async()=>true;newOrderModal('c1');document.querySelector('#newOrderCustomer').value='c1';document.querySelector('#newOrderProduct').value='p1';document.querySelector('#newOrderQty').value='2';document.querySelector('#newOrderPaymentMode').value='DEPOSIT';document.querySelector('#newOrderDeposit').value='500000';document.querySelector('#newOrderPaymentMethod').value='VietQR';document.querySelector('#newOrderBillingName').value='Customer';document.querySelector('#newOrderBillingPhone').value='0912345678';document.querySelector('#newOrderBillingEmail').value='c@example.vn';`,c);
 await vm.runInContext("document.querySelector('#newOrderForm').onsubmit({preventDefault(){}})",c);const saved=vm.runInContext('state.orders[0]',c);assert.equal(saved.subtotal,2028000);assert.equal(saved.vatAmount,202800);assert.equal(saved.total,2230800);assert.equal(saved.depositAmount,500000);assert.equal(saved.billing.phone,'0912345678');assert.equal(saved.rentalMonths,1);assert.ok(saved.rentalEndsAt);assert.equal(saved.status,'PENDING');assert.equal(vm.runInContext("state.audit.some(row=>row.entity===state.orders[0].id)",c),true);
});

test('Product SKU remains unique inside one transactional state update',async()=>{
 const f=fixture(),productA={id:'pa',name:'A',sku:'DUP-SKU',category:'Test',price:1,type:'SALE',active:true},productB={id:'pb',name:'B',sku:'dup-sku',category:'Test',price:2,type:'SALE',active:true};await assert.rejects(f.api.write(admin,'duplicate-sku',[change('products',productA),change('products',productB)]),error=>error.status===400);assert.equal(f.db.products.filter(p=>p.id==='pa'||p.id==='pb').length,0);
});

test('Deposit and final payment financial events never double-count revenue',()=>{
 const c=frontend(),base={id:'o',code:'NVT-o',customerName:'Customer',total:1100,depositAmount:300,depositAt:'2026-09-14 09:00',paidAt:'2026-09-14 10:00',paymentMethod:'VietQR'};assert.deepEqual(Array.from(vm.runInContext(`orderFinancialEvents(${JSON.stringify(base)}).map(event=>event.amount)`,c)),[300,800]);assert.equal(vm.runInContext(`netRevenue([${JSON.stringify(base)}])`,c),1100);assert.equal(vm.runInContext(`netRevenue([${JSON.stringify({...base,refundedAt:'2026-09-14 11:00',refund:1100})}])`,c),0);
});

test('Frontend removes the manual sync toolbar and shows detailed landing source', () => {
 const js=fs.readFileSync('crm.js','utf8');
 assert.doesNotMatch(js,/id="syncNowButton"|id="exportDraftButton"|id="importRecoveryButton"|id="reloadServerButton"/);
 const c=frontend();
 vm.runInContext(`applyServerSnapshot({state:{...initialState(),websites:[{id:'web',name:'Hoang Phuc Academy',domain:'www.hoangphucacademy.vn',sourceUrl:'https://www.hoangphucacademy.vn/',webhookSlug:'DS-TEST'}],customers:[{id:'cus',name:'Customer',phone:'0912345678',source:'Landing Page',campaign:'ACADEMY',websiteId:'web',createdAt:'2026-09-14 10:00',updatedAt:'2026-09-14 10:00'}]},versions:{}})`,c);
 const details=vm.runInContext("customerSourceDetails(state.customers[0])",c);
 assert.equal(details.name,'Hoang Phuc Academy');assert.equal(details.url,'https://www.hoangphucacademy.vn/');
});
test('Old webhook customer is attributed from stored slug without changing assignment', async () => {
 const f=fixture();
 f.db.docs.push({collection:'websites',id:'web',deleted:0,body:{id:'web',name:'Hoang Phuc Academy',domain:'www.hoangphucacademy.vn',sourceUrl:'https://www.hoangphucacademy.vn/',webhookSlug:'DS-OLD'}});
 f.db.customers.push({id:'old',name:'Old customer',phone:'0911111111',email:null,source:'Landing Page',campaign:null,website_id:null,status:'NEW',sale_id:'sale',leader_id:'lead',team_id:'T',note:'',custom_fields_json:JSON.stringify({webhookSlug:'DS-OLD',webhookEventId:'event'}),created_at:'2026-09-01 09:00:00',updated_at:'2026-09-01 09:00:00'});
 const row=(await f.api.read(admin)).state.customers[0];
 assert.equal(row.websiteId,'web');assert.equal(row.landingPageUrl,'https://www.hoangphucacademy.vn/');assert.equal(row.saleId,'sale');
});

test('Data queue shows landing URL and rental products use rental availability labels', () => {
 const c=frontend();
 vm.runInContext(`currentAccount=hydrateSessionAccount({id:'admin',name:'Admin',role:'ADMIN'});applyServerSnapshot({state:{...initialState(),websites:[{id:'web',name:'Hoang Phuc Academy',domain:'www.hoangphucacademy.vn',sourceUrl:'https://www.hoangphucacademy.vn/',webhookSlug:'DS-TEST'}],customers:[{id:'cus',name:'Customer',phone:'0912345678',source:'Landing Page',campaign:'UNATTRIBUTED',websiteId:'web',landingPageName:'Landing Page',createdAt:'2026-09-14 10:00',updatedAt:'2026-09-14 10:00',customFields:{}}],products:[{id:'rental',name:'Rental indicator',sku:'RENT-1',category:'Indicator',price:100,type:'RENTAL',rentalMonths:1,active:true}]},versions:{}});distributionTab='QUEUE';`,c);
 const dataHtml=vm.runInContext('distributionView()',c),productHtml=vm.runInContext('productsView()',c);
 assert.match(dataHtml,/Hoang Phuc Academy/);assert.match(dataHtml,/https:\/\/www\.hoangphucacademy\.vn\//);assert.doesNotMatch(dataHtml,/Khong campaign|Kh?ng campaign/);
 assert.match(productHtml,/Đang cho thuê/);assert.match(productHtml,/Ngừng cho thuê/);assert.doesNotMatch(productHtml,/Rental indicator[\s\S]*Đang bán/);
});

test('Admin navigation badges show pending data and unassigned accounts immediately', () => {
 const c=frontend();
 vm.runInContext(`currentAccount=hydrateSessionAccount({id:'admin',name:'Admin',role:'ADMIN'});applyServerSnapshot({state:{...initialState(),customers:[{id:'cus',name:'New customer',phone:'0912345678',source:'Landing Page',status:'NEW',saleId:null,leaderId:null,teamId:null,createdAt:'2026-09-14 10:00',updatedAt:'2026-09-14 10:00',customFields:{}}],registeredAccounts:[{id:'new-user',name:'New user',role:'UNASSIGNED',active:true}]},versions:{}});webhookPending=[{id:'pending-webhook'}];renderNavigation();`,c);
 const html=c.document.querySelector('#sideNav').innerHTML;
 assert.match(html,/data-view-link="distribution"[\s\S]*?<span class="nav-badge">2<\/span>/);
 assert.match(html,/data-view-link="team"[\s\S]*?<span class="nav-badge">1<\/span>/);
 assert.equal(vm.runInContext("navigationBadgeCount('distribution')",c),2);
 assert.equal(vm.runInContext("navigationBadgeCount('team')",c),1);
});

test('Badge counts refresh from MySQL without replacing a form that is being edited', async () => {
 const c=frontend();
 vm.runInContext("currentAccount=hydrateSessionAccount({id:'admin',name:'Admin',role:'ADMIN'});serverSyncToken='token';applyServerSnapshot({state:initialState(),versions:{}});document.activeElement.tagName='INPUT';",c);
 c.fetch=async()=>({ok:true,json:async()=>({data:4,team:2})});
 assert.equal(await c.refreshNavigationCounts(),true);
 assert.equal(vm.runInContext("navigationBadgeCount('distribution')",c),4);
 assert.equal(vm.runInContext("navigationBadgeCount('team')",c),2);
 assert.equal(vm.runInContext('state.customers.length',c),0);
});
