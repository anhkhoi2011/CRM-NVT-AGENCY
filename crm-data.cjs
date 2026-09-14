"use strict";
// Kho dữ liệu nghiệp vụ: một giao dịch cho cả khách/đơn và lịch sử liên quan.
const crypto = require('node:crypto');
const { pool } = require('./db.js');
const LISTS = ['customers','orders','products','members','registrations','customFieldDefinitions','customerFieldHistory','assignmentHistory','resubmissions','notes','imports','attendance','dataOffers','traffic','tasks','notifications','audit','websites','integrations','webhookPending'];
const OBJECTS = ['settings','leaderDistribution','saleDistributionByLeader','productCategories'];
const ADMIN_ONLY = new Set(['products','members','registrations','customFieldDefinitions','imports','traffic','websites','integrations','webhookPending','productCategories','leaderDistribution']);
const SCHEMA = [
 `CREATE TABLE IF NOT EXISTS crm_documents (collection VARCHAR(64) NOT NULL, id VARCHAR(96) NOT NULL, body JSON NOT NULL, deleted TINYINT NOT NULL DEFAULT 0, PRIMARY KEY(collection,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
 `CREATE TABLE IF NOT EXISTS crm_changes (id BIGINT AUTO_INCREMENT PRIMARY KEY, request_id VARCHAR(96) NOT NULL, actor_id VARCHAR(96) NOT NULL, changes_json JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY(request_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
 `CREATE TABLE IF NOT EXISTS crm_write_lock (id INT PRIMARY KEY) ENGINE=InnoDB`,
 `INSERT IGNORE INTO crm_write_lock(id) VALUES (1)`
];
let prepared;
function prepare() {
 if (!prepared) prepared = (async()=>{for(const sql of SCHEMA) await pool.query(sql);await seedDefaults();await seedProductCatalog();})().catch(e=>{prepared=null;throw e;});
 return prepared;
}

async function seedProductCatalog(){
 const c=await pool.getConnection();
 try{
  await c.beginTransaction();
  await c.query('SELECT id FROM crm_write_lock WHERE id=1 FOR UPDATE');
  const [marker]=await c.execute("SELECT setting_key FROM system_settings WHERE setting_key='product_catalog_20260914_v1' LIMIT 1");
  if(marker.length){await c.commit();return {applied:false,inserted:0};}
  const catalog=require('./product-catalog.json');
  let inserted=0;
  for(const product of catalog){
   // Không ghi đè sản phẩm đã được Admin sửa; trùng ID hoặc SKU đều được xem là đã có.
   const [existing]=await c.execute('SELECT id FROM products WHERE id=? OR sku=? LIMIT 1',[product.id,product.sku]);
   if(existing.length)continue;
   await c.execute('INSERT INTO products(id,sku,name,category,price,type,rental_months,active) VALUES (?,?,?,?,?,?,?,?)',[product.id,product.sku,product.name,product.category,product.price,product.type,product.rentalMonths,product.active===false?0:1]);
   inserted++;
  }
  await c.execute("INSERT INTO system_settings(setting_key,setting_value) VALUES ('product_catalog_20260914_v1','true')");
  await c.commit();return {applied:true,inserted};
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}
async function seedDefaults(){
 const c=await pool.getConnection();
 try{
  await c.beginTransaction();await c.query('SELECT id FROM crm_write_lock WHERE id=1 FOR UPDATE');
  const [existing]=await c.query("SELECT setting_key,setting_value FROM system_settings");
  if(!existing.some(r=>r.setting_key==='crm_defaults_v1')){
   const defaults=require('./crm-defaults.json');
   for(const [key,value] of Object.entries(defaults)){
    const [rows]=await c.execute('SELECT id FROM crm_documents WHERE collection=? LIMIT 1',[key]);
    if(rows.length)continue;
    const actual=key==='settings'?(parsed(existing.find(r=>r.setting_key==='crm')?.setting_value,value)):value;
    for(const r of LISTS.includes(key)?actual:[actual])await c.execute('INSERT IGNORE INTO crm_documents(collection,id,body,deleted) VALUES (?,?,?,0)',[key,LISTS.includes(key)?r.id:'$',JSON.stringify(r)]);
   }
   await c.execute("INSERT INTO system_settings(setting_key,setting_value) VALUES ('crm_defaults_v1','true')");
  }
  await c.commit();
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}
function error(status,message){throw Object.assign(new Error(message),{status});}
function parsed(value,fallback={}){if(typeof value==='string')return JSON.parse(value);return value??fallback;}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function revision(value){return value===undefined?null:crypto.createHash('sha256').update(canonical(value)).digest('hex');}
function timestamp(v){return v instanceof Date?v.toISOString().slice(0,19).replace('T',' '):v;}
function userRow(r){return {id:r.id,phone:r.phone,email:r.email,name:r.name,role:r.role,teamId:r.team_id||'',leaderId:r.leader_id||null,active:!!r.active,createdAt:timestamp(r.created_at)};}
function coreRow(key,r){
 if(key==='customers') {const j=parsed(r.custom_fields_json),meta=j.__crmMeta||((j.webhookSlug||j.webhookEventId)?{webhookSlug:j.webhookSlug,webhookEventId:j.webhookEventId}:{});return {...meta,id:r.id,name:r.name,phone:r.phone,email:r.email||'',source:r.source||'',campaign:r.campaign||'',websiteId:r.website_id||null,status:r.status,saleId:r.sale_id||null,leaderId:r.leader_id||null,teamId:r.team_id||null,note:r.note||'',customFields:j.__crmFields||(j.__crmMeta?{}:Object.fromEntries(Object.entries(j).filter(([key])=>!['webhookSlug','webhookEventId'].includes(key)))),createdAt:timestamp(r.created_at),updatedAt:timestamp(r.updated_at)};}
 if(key==='orders'){const j=parsed(r.items_json,[]);return {discount:0,refund:0,qty:1,unitPrice:Number(r.total_amount),subtotal:Number(r.total_amount),...(Array.isArray(j)?{}:j),id:r.id,code:r.code,customerId:r.customer_id,saleId:r.sale_id||null,leaderId:r.leader_id||null,teamId:r.team_id||null,total:Number(r.total_amount),status:r.status,items:Array.isArray(j)?j:j.items||[],note:r.note||'',createdAt:timestamp(r.created_at),updatedAt:timestamp(r.updated_at)};}
 return {id:r.id,name:r.name,sku:r.sku||'',category:r.category||'',price:Number(r.price),type:r.type,rentalMonths:r.rental_months,active:!!r.active,createdAt:timestamp(r.created_at),updatedAt:timestamp(r.updated_at)};
}
async function allData(c){
 const data=Object.fromEntries([...LISTS,...OBJECTS].map(k=>[k,new Map()]));
 const [docs]=await c.query('SELECT * FROM crm_documents');
 const deleted=new Set();
 for(const d of docs){if(!data[d.collection])continue;if(d.deleted)deleted.add(`${d.collection}/${d.id}`);else data[d.collection].set(d.id,parsed(d.body));}
 for(const key of ['customers','orders','products']){
  const [rows]=await c.query(`SELECT * FROM ${key}`);
  for(const row of rows){if(deleted.has(`${key}/${row.id}`))continue;data[key].set(row.id,{...data[key].get(row.id),...coreRow(key,row)});}
 }
 // Gắn nguồn cho dữ liệu webhook cũ bằng slug; chỉ bổ sung trường đang thiếu.
 const websiteBySlug=new Map([...data.websites.values()].filter(website=>website.webhookSlug).map(website=>[String(website.webhookSlug).toUpperCase(),website]));
 for(const [id,customer] of data.customers){
  const website=customer.websiteId?data.websites.get(customer.websiteId):websiteBySlug.get(String(customer.webhookSlug||'').toUpperCase());
  if(!website)continue;
  const sourceUrl=website.sourceUrl||(website.domain?`https://${String(website.domain).replace(/^https?:\/\//,'').replace(/\/+$/,'')}/`:'');
  data.customers.set(id,{...customer,websiteId:customer.websiteId||website.id,landingPageName:customer.landingPageName||website.name||website.domain,landingPageUrl:customer.landingPageUrl||sourceUrl,landingPageDomain:customer.landingPageDomain||website.domain});
 }
 const [users]=await c.query('SELECT id,phone,email,name,role,team_id,leader_id,active,created_at FROM users');
 for(const u of users)if(!deleted.has(`members/${u.id}`))data.members.set(u.id,{...data.members.get(u.id),...userRow(u),loginEnabled:true,initials:data.members.get(u.id)?.initials||String(u.name).trim().split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase()});
 const [settings]=await c.query('SELECT setting_key,setting_value FROM system_settings');
 if(!data.settings.has('$')) {const row=settings.find(r=>r.setting_key==='crm');if(row)data.settings.set('$',parsed(row.setting_value));}
 return data;
}
function customerScope(user,r){return !!r&&(user.role==='ADMIN'||(user.role==='SALE'&&r.saleId===user.id)||(user.role==='LEADER'&&((!!user.teamId&&r.teamId===user.teamId)||r.leaderId===user.id)));}
function pendingOffer(data,user,id){return [...data.dataOffers.values()].find(o=>o.customerId===id&&o.saleId===user.id&&o.status==='PENDING'&&Date.parse(String(o.offeredAt).replace(' ','T')+'+07:00')+24*3600000>Date.now());}
function readable(user,key,r,data){
 if(user.role==='ADMIN')return true;
 if(user.role==='MARKETING')return ['customers','orders','products','customFieldDefinitions','productCategories','websites','traffic'].includes(key) || (key==='notifications'&&(r.role==='ALL'||r.role==='MARKETING'||r.saleId===user.id));
 if(user.role==='ACCOUNTING')return ['customers','orders','products','productCategories'].includes(key) || (key==='notifications'&&(r.role==='ALL'||r.role==='ACCOUNTING'||r.saleId===user.id));
 if(!['LEADER','SALE'].includes(user.role))return false;
 if(key==='members')return r.id===user.id||r.id===user.leaderId||(user.role==='LEADER'&&r.teamId===user.teamId);
 if(key==='customers')return customerScope(user,r)||!!pendingOffer(data,user,r.id);
 if(key==='orders')return customerScope(user,r);
 if(['products','customFieldDefinitions','productCategories','websites'].includes(key))return true;
 if(OBJECTS.includes(key))return key==='settings'||user.role==='LEADER';
 if(key==='attendance')return r.accountId===user.id||(user.role==='LEADER'&&r.teamId===user.teamId);
 if(key==='notifications')return r.role==='ALL'||r.saleId===user.id||r.leaderId===user.id||(r.role===user.role&&!r.saleId&&!r.leaderId);
 if(key==='audit')return r.actorId===user.id;
 if(key==='dataOffers')return r.saleId===user.id||(user.role==='LEADER'&&r.leaderId===user.id);
 return !!r.customerId&&customerScope(user,data.customers.get(r.customerId));
}
function publicValue(user,key,r){
 if(key==='settings'&&user.role!=='ADMIN')return Object.fromEntries(Object.entries(r).filter(([k])=>!['dataBotToken','memberBotToken','dataBotChatId','memberBotChatId'].includes(k)));
 return r;
}
function snapshot(user,data){
 const state={},versions={};
 for(const key of [...LISTS,...OBJECTS]){
  if(LISTS.includes(key))state[key]=[];
  for(const [id,r]of data[key]){if(!readable(user,key,r,data))continue;const value=publicValue(user,key,r);if(LISTS.includes(key))state[key].push(value);else state[key]=value;versions[`${key}/${id}`]=revision(value);}
 }
 state.accounts=state.members;
 state.registeredAccounts=state.members.filter(r=>r.role==='UNASSIGNED');
 state.members=state.members.filter(r=>['SALE','LEADER'].includes(r.role));
 return {state,versions};
}
function sameExcept(a,b,allowed){const clean=o=>Object.fromEntries(Object.entries(o||{}).filter(([k])=>!allowed.includes(k)));return canonical(clean(a))===canonical(clean(b));}
function authorize(user,key,old,next,data){
 if(user.role==='ADMIN')return;
 if(['MARKETING','ACCOUNTING'].includes(user.role))error(403,'Tài khoản chỉ có quyền xem, không được cập nhật dữ liệu');
 if(!['LEADER','SALE'].includes(user.role))error(403,'Tài khoản đang chờ Admin phân quyền');
 const r=next||old;
 if(key==='members'&&r?.id===user.id&&old&&next&&sameExcept(old,next,['name','initials','avatar']))return;
 if(ADMIN_ONLY.has(key))error(403,'Chỉ Admin được cập nhật '+key);
 if(key==='settings') {
  if(user.role==='LEADER'&&old&&next&&sameExcept(old,next,['saleAssignmentModes','assignmentCursor'])&&Object.keys(next.saleAssignmentModes||{}).every(k=>k===user.id||next.saleAssignmentModes[k]===old.saleAssignmentModes?.[k]))return;
  error(403,'Chỉ Admin được đổi cài đặt');
 }
 if(key==='saleDistributionByLeader') {if(user.role==='LEADER'&&old&&next&&sameExcept(old,next,[user.id]))return;error(403,'Không được đổi phân phối của đội khác');}
 if(key==='customers'){
  const offer=old&&pendingOffer(data,user,old.id);
  if(!customerScope(user,old||next)&&!offer)error(403,'Khách ngoài phạm vi');
  if(!next)error(403,'Chỉ Admin được lưu trữ khách');
  if(user.role==='SALE') {
   if(next.saleId!==user.id)error(403,'Không được giao khách cho Sale khác');
   if(old&&!sameExcept(old,next,['name','email','phone','status','note','customFields','updatedAt','saleAcceptedAt','saleId']))error(403,'Không được thay đổi nguồn hoặc đội');
   if(!old&&(next.leaderId!==user.leaderId||next.teamId!==user.teamId))error(403,'Đội không hợp lệ');
  } else if(!customerScope(user,next))error(403,'Không được chuyển khách ngoài đội');
  return;
 }
 if(key==='orders'){
  if(!customerScope(user,old||next)||!customerScope(user,data.customers.get(r.customerId)))error(403,'Đơn ngoài phạm vi');
  if(next){const product=data.products.get(next.productId);if(!product||(product.active===false&&old?.productId!==product.id)||!Number.isInteger(next.qty)||next.qty<1||next.qty>10||Number(next.unitPrice)!==Number(product.price)||Number(next.subtotal)!==Number(product.price)*next.qty)error(400,'Sản phẩm, số lượng hoặc đơn giá không khớp danh mục MySQL');}
  if(next&&old&&!sameExcept(old,next,['productId','productName','sku','qty','unitPrice','subtotal','vatRate','vatAmount','total','discount','updatedAt','items','note','paymentMode','depositAmount','balanceDue','billing','paymentMethod','rentalMonths','rentalEndsAt']))error(403,'Chỉ Admin xác nhận thanh toán hoặc chuyển đơn');
  if(next&&!old&&(next.status!=='PENDING'||next.saleId!==data.customers.get(next.customerId)?.saleId||next.leaderId!==data.customers.get(next.customerId)?.leaderId||next.teamId!==data.customers.get(next.customerId)?.teamId))error(403,'Đơn mới không hợp lệ');
  if(old&&old.status!=='PENDING')error(403,'Đơn đã thanh toán không được sửa');
  return;
 }
 if(key==='attendance'){if(!old&&next&&next.accountId===user.id&&next.date===new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}))return;error(403,'Không được sửa điểm danh');}
 if(key==='audit'){if(!old&&next&&next.actorId===user.id)return;error(403,'Nhật ký chỉ được ghi thêm');}
 if(key==='notifications'){
  if(old&&next&&readable(user,key,old,data)&&sameExcept(old,next,['readBy'])&&Array.isArray(next.readBy)&&next.readBy.every(id=>id===user.id||(old.readBy||[]).includes(id)))return;
  if(!old&&next&&['SALE','LEADER'].includes(user.role)&&next.role!=='ALL')return;
  error(403,'Không được sửa thông báo');
 }
 if(key==='dataOffers'){
  if(user.role==='LEADER'&&r.leaderId===user.id&&customerScope(user,data.customers.get(r.customerId)))return;
  if(user.role==='SALE'&&old&&next&&old.saleId===user.id&&old.status==='PENDING'&&next.status==='ACCEPTED'&&sameExcept(old,next,['status','resolvedAt'])&&pendingOffer(data,user,old.customerId))return;
  error(403,'Không được xử lý offer này');
 }
 if(r?.customerId&&(customerScope(user,data.customers.get(r.customerId))||pendingOffer(data,user,r.customerId)))return;
 error(403,'Không có quyền cập nhật '+key);
}
function validate(key,value,id){
 if(value===null)return;
 if(!value||typeof value!=='object'||(LISTS.includes(key)&&(Array.isArray(value)||value.id!==id)))error(400,'Bản ghi không hợp lệ');
 if(['members','customers','products'].includes(key)&&(typeof value.name!=='string'||!value.name.trim()||value.name.length>(key==='products'?200:160)))error(400,'Tên không hợp lệ');
 if(key==='members'&&!['ADMIN','LEADER','SALE','MARKETING','ACCOUNTING','UNASSIGNED'].includes(value.role))error(400,'Chức vụ không hợp lệ');
 if(key==='customers'&&(!value.phone||value.phone.length>30))error(400,'Số điện thoại không hợp lệ');
 if(key==='products'&&(!Number.isFinite(value.price)||value.price<0||!['SALE','RENTAL'].includes(value.type)))error(400,'Sản phẩm không hợp lệ');
 if(key==='orders'&&!['PENDING','PAID','DEPOSIT','CANCELLED','REFUNDED'].includes(value.status))error(400,'Trạng thái đơn không hợp lệ');
 if(key==='orders'&&(!value.customerId||!value.code||!Number.isFinite(value.total)||value.total<0))error(400,'Đơn không hợp lệ');
 if(key==='orders'){
  for(const field of ['subtotal','vatAmount','discount','depositAmount','amountPaid','balanceDue'])if(Object.hasOwn(value,field)&&(!Number.isFinite(value[field])||value[field]<0))error(400,'Số tiền đơn hàng không hợp lệ');
  if(Object.hasOwn(value,'vatRate')&&(!Number.isFinite(value.vatRate)||value.vatRate<0||value.vatRate>1))error(400,'Thuế suất không hợp lệ');
  if(value.paymentMode&&!['FULL','DEPOSIT'].includes(value.paymentMode))error(400,'Hình thức thanh toán không hợp lệ');
  if(value.paymentMode==='DEPOSIT'&&(!Number.isFinite(value.depositAmount)||value.depositAmount<=0||value.depositAmount>=value.total))error(400,'Tiền cọc không hợp lệ');
  if(value.billing&&((typeof value.billing!=='object'||Array.isArray(value.billing))||['name','cccd','phone','email','address','taxId'].some(field=>typeof (value.billing[field]??'')!=='string'||String(value.billing[field]??'').length>254)))error(400,'Thông tin hóa đơn không hợp lệ');
  if(value.rentalMonths!=null&&![1,3,6,12].includes(Number(value.rentalMonths)))error(400,'Kỳ thuê không hợp lệ');
  if(value.rentalEndsAt!=null&&!Number.isFinite(Date.parse(value.rentalEndsAt)))error(400,'Ngày hết hạn thuê không hợp lệ');
  if(Number.isFinite(value.subtotal)&&Number.isFinite(value.vatAmount)&&Math.abs(value.total-(value.subtotal-Number(value.discount||0)+value.vatAmount))>0.01)error(400,'Tổng tiền đơn hàng không khớp');
  if(value.status!=='REFUNDED'&&Number.isFinite(value.amountPaid)&&Number.isFinite(value.balanceDue)&&Math.abs(value.balanceDue-Math.max(0,value.total-value.amountPaid))>0.01)error(400,'Số tiền còn lại không khớp');
 }
 if(['password','password_hash','adminPassword','twoFactorCode'].some(k=>Object.hasOwn(value,k)))error(400,'Mật khẩu phải gửi qua API xác thực');
}
async function project(c,key,id,r){
 if(key==='customers'){
  if(!r){await c.execute("UPDATE customers SET status='ARCHIVED' WHERE id=?",[id]);return;}
  const {custom_fields_json,...details}=r;
  await c.execute(`INSERT INTO customers(id,name,phone,email,source,campaign,website_id,status,sale_id,leader_id,team_id,note,custom_fields_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),phone=VALUES(phone),email=VALUES(email),source=VALUES(source),campaign=VALUES(campaign),website_id=VALUES(website_id),status=VALUES(status),sale_id=VALUES(sale_id),leader_id=VALUES(leader_id),team_id=VALUES(team_id),note=VALUES(note),custom_fields_json=VALUES(custom_fields_json)`,[id,r.name,r.phone,r.email||null,r.source||null,r.campaign||null,r.websiteId||null,r.status||'NEW',r.saleId||null,r.leaderId||null,r.teamId||null,r.note||null,JSON.stringify({__crmMeta:details,__crmFields:r.customFields||{}}),r.createdAt||new Date()]);
 }else if(key==='orders'){
  if(!r){await c.execute("UPDATE orders SET status='CANCELLED' WHERE id=?",[id]);return;}
  const {items_json,...details}=r;
  await c.execute(`INSERT INTO orders(id,code,customer_id,sale_id,leader_id,team_id,total_amount,status,items_json,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code),customer_id=VALUES(customer_id),sale_id=VALUES(sale_id),leader_id=VALUES(leader_id),team_id=VALUES(team_id),total_amount=VALUES(total_amount),status=VALUES(status),items_json=VALUES(items_json),note=VALUES(note)`,[id,r.code,r.customerId,r.saleId||null,r.leaderId||null,r.teamId||null,r.total,r.status||'PENDING',JSON.stringify(details),r.note||null,r.createdAt||new Date()]);
 }else if(key==='products'){
  if(!r){await c.execute('UPDATE products SET active=0 WHERE id=?',[id]);return;}
  await c.execute(`INSERT INTO products(id,sku,name,category,price,type,rental_months,active,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE sku=VALUES(sku),name=VALUES(name),category=VALUES(category),price=VALUES(price),type=VALUES(type),rental_months=VALUES(rental_months),active=VALUES(active)`,[id,r.sku||null,r.name,r.category||null,r.price,r.type,r.rentalMonths||null,r.active===false?0:1,r.createdAt||new Date()]);
 }else if(key==='members'){
  if(!r){await c.execute('UPDATE users SET active=0 WHERE id=?',[id]);return;}
  await c.execute('UPDATE users SET name=?,role=?,team_id=?,leader_id=?,active=?,email=COALESCE(?,email) WHERE id=?',[r.name,r.role,r.teamId||null,r.leaderId||null,r.active===false?0:1,r.email||null,id]);
 }else if(key==='settings')await c.execute("INSERT INTO system_settings(setting_key,setting_value) VALUES ('crm',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[JSON.stringify(r||{})]);
}
// Hết hạn được lưu trên server ngay ở lần đọc tiếp theo, kể cả Admin đã đóng trình duyệt.
async function expireOffers(c,data){
 for(const [id,offer] of data.dataOffers){
  const expiry=Date.parse(String(offer.offeredAt).replace(' ','T')+'+07:00')+24*3600000;
  if(offer.status!=='PENDING'||!Number.isFinite(expiry)||expiry>Date.now())continue;
  const next={...offer,status:'EXPIRED',resolvedAt:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,16)};
  await c.execute('INSERT INTO crm_documents(collection,id,body,deleted) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE body=VALUES(body),deleted=0',['dataOffers',id,JSON.stringify(next)]);
  await c.execute('INSERT INTO crm_changes(request_id,actor_id,changes_json) VALUES (?,?,?)',['expire-'+crypto.randomUUID(),'SYSTEM',JSON.stringify([{key:'dataOffers',id,before:offer,after:next}])]);
  data.dataOffers.set(id,next);
  // Ghi chu het han va tra ve dung Team, khong tu dong chia lai.
  const customer=data.customers.get(offer.customerId);
  if(customer && !customer.saleId && ![...data.dataOffers.values()].some(o=>o.id!==id&&o.customerId===offer.customerId&&o.status==='PENDING')){
    const updated={...customer,saleId:null,saleAcceptedAt:null,updatedAt:next.resolvedAt,note:'Sale không nhận data sau 24h. Chờ Leader phân lại.'};
    await project(c,'customers',customer.id,updated);
    await c.execute('INSERT INTO crm_documents(collection,id,body,deleted) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE body=VALUES(body),deleted=0',['customers',customer.id,JSON.stringify(updated)]);
    await c.execute('INSERT INTO crm_changes(request_id,actor_id,changes_json) VALUES (?,?,?)',['expire-customer-'+crypto.randomUUID(),'SYSTEM',JSON.stringify([{key:'customers',id:customer.id,before:customer,after:updated}])]);
    data.customers.set(customer.id,updated);
  }

 }
}
async function warnRentalExpiry(c,data){
 for(const order of data.orders.values()){
  if(!order.rentalEndsAt||order.status!=='PAID')continue;
  const expiry=Date.parse(order.rentalEndsAt),daysLeft=(expiry-Date.now())/86400000,id=`NT-RENT-${order.id}`;
  if(!Number.isFinite(expiry)||daysLeft>7||daysLeft<0||data.notifications.has(id))continue;
  const customer=data.customers.get(order.customerId);
  const notification={id,role:'OWN',saleId:order.saleId,title:'Sắp hết hạn thuê',text:`${customer?.name||order.customerName||'Khách hàng'} · ${order.productName} · còn ${Math.ceil(daysLeft)} ngày`,at:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,16),readBy:[]};
  await c.execute('INSERT INTO crm_documents(collection,id,body,deleted) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE body=VALUES(body),deleted=0',['notifications',id,JSON.stringify(notification)]);
  await c.execute('INSERT INTO crm_changes(request_id,actor_id,changes_json) VALUES (?,?,?)',['rental-'+crypto.randomUUID(),'SYSTEM',JSON.stringify([{key:'notifications',id,before:null,after:notification}])]);
  data.notifications.set(id,notification);
 }
}
async function read(user){await prepare();const c=await pool.getConnection();try{await c.beginTransaction();await c.query('SELECT id FROM crm_write_lock WHERE id=1 FOR UPDATE');const data=await allData(c);await expireOffers(c,data);await warnRentalExpiry(c,data);const result=snapshot(user,data);await c.commit();return result;}catch(e){await c.rollback();throw e;}finally{c.release();}}
async function write(user,requestId,changes){
 if(typeof requestId!=='string'||!/^[-\w]{1,96}$/.test(requestId)||!Array.isArray(changes)||changes.length>2000)error(400,'Gói lưu không hợp lệ');
 await prepare();const c=await pool.getConnection();
 try{
  await c.beginTransaction();
  await c.query('SELECT id FROM crm_write_lock WHERE id=1 FOR UPDATE');
  const [done]=await c.execute('SELECT actor_id FROM crm_changes WHERE request_id=?',[requestId]);
  if(done.length){if(done[0].actor_id!==user.id)error(409,'Mã yêu cầu đã tồn tại');const result=snapshot(user,await allData(c));await c.commit();return {...result,ok:true,replayed:true};}
  const data=await allData(c),seen=new Set(),history=[];
  // Kiểm tra khách trước; ghi chú/công việc/đơn có thể tham chiếu khách mới trong cùng giao dịch.
  changes=changes.map(change=>({...change})).sort((a,b)=>(a.key==='customers'?0:1)-(b.key==='customers'?0:1));
  const prospective={...data,customers:new Map(data.customers)};
  // Kiểm tra toàn bộ xung đột/quyền trước khi ghi bất kỳ bảng nào.
  for(const change of changes){
   const {key,id,base,value}=change;
   if(!data[key]||typeof id!=='string'||!/^[-\w.$:]{1,96}$/.test(id)||seen.has(`${key}/${id}`))error(400,'Mã bản ghi không hợp lệ/trùng');
   if(OBJECTS.includes(key)&&id!=='$')error(400,'Khóa cấu hình không hợp lệ');
   seen.add(`${key}/${id}`);validate(key,value,id);
   const old=data[key].get(id);
   if(key==='members'&&old?.role==='ADMIN'&&old.active!==false&&(!value||value.role!=='ADMIN'||value.active===false)&&[...data.members.values()].filter(r=>r.role==='ADMIN'&&r.active!==false).length<=1)error(400,'Phải giữ ít nhất một Admin hoạt động');
   if(revision(old===undefined?undefined:publicValue(user,key,old))!==base)error(409,`Bản ghi ${key}/${id} đã được máy khác cập nhật. Xuất bản nháp rồi tải lại.`);
   authorize(user,key,key==='settings'&&old?publicValue(user,key,old):old,value,key==='customers'?data:prospective);
   if(key==='settings'&&value&&user.role!=='ADMIN')change.value={...old,...value};
   history.push({key,id,before:old??null,after:change.value});
   if(key==='customers'){if(value)prospective.customers.set(id,value);else prospective.customers.delete(id);}
  }
  const resulting=new Map(data.customers);
  for(const change of changes.filter(x=>x.key==='customers')){if(change.value)resulting.set(change.id,change.value);else resulting.delete(change.id);}
  for(const change of changes.filter(x=>x.key==='orders'&&x.value)){if(!resulting.has(change.value.customerId))error(400,'Khách của đơn chưa tồn tại');}
  const resultingMembers=new Map(data.members);
  for(const change of changes.filter(x=>x.key==='members')){if(change.value)resultingMembers.set(change.id,change.value);else resultingMembers.delete(change.id);}
  if([...data.members.values()].some(r=>r.role==='ADMIN'&&r.active!==false)&&![...resultingMembers.values()].some(r=>r.role==='ADMIN'&&r.active!==false))error(400,'Phải giữ ít nhất một Admin hoạt động');
  const resultingProducts=new Map(data.products);
  for(const change of changes.filter(x=>x.key==='products')){if(change.value)resultingProducts.set(change.id,change.value);else resultingProducts.delete(change.id);}
  const productSkus=new Set();
  for(const product of resultingProducts.values()){const sku=String(product.sku||'').trim().toLowerCase();if(!sku)continue;if(productSkus.has(sku))error(400,'Mã SKU sản phẩm đã tồn tại');productSkus.add(sku);}
  for(const {key,id,value}of changes){
   await project(c,key,id,value);
   await c.execute('INSERT INTO crm_documents(collection,id,body,deleted) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE body=VALUES(body),deleted=VALUES(deleted)',[key,id,JSON.stringify(value===null?data[key].get(id)||{}:value),value===null?1:0]);
  }
  await c.execute('INSERT INTO crm_changes(request_id,actor_id,changes_json) VALUES (?,?,?)',[requestId,user.id,JSON.stringify(history)]);
  const result=snapshot(user,await allData(c));await c.commit();return {...result,ok:true};
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}
module.exports={prepare,seedProductCatalog,read,write,revision,canonical,coreRow,userRow,authorize,readable,validate,LISTS,OBJECTS,SCHEMA};
