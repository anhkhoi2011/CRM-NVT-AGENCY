'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../commission_tree_demo.html'), 'utf8');
function model() {
 const ctx = vm.createContext({window:{},OrderPayments:require('../order-payments.js')});
 const start = html.indexOf('  function rebuildAccountingRevenueFromCRM()');
 const end = html.indexOf('  function syncTeamMembersFromCRM(', start);
 vm.runInContext('var ACCOUNTING_CRM_STATE={products:[],orders:[],courseConfigs:[],brokerageMetrics:[]}; var currentGlobalMonth="2026-10"; var COURSES_DATA=[]; var APEX_DATA=[{id:"sale-1"}];'+html.slice(start,end), ctx);
 return ctx;
}
test('Accounting inline scripts parse without syntax errors', () => {
 for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
test('Accounting starts empty with no sample financial datasets', () => {
 for (const name of ['APEX_DATA','COURSES_DATA','VAT_ORDERS_DATA','ADMIN_EXPENSES_DATA']) assert.ok(html.includes('let '+name+' = [];'), name);
 assert.doesNotMatch(html,/448\.500\.000|231\.500\.000|117\.000\.000|MONTHLY_REVENUE_COMMISSION|MONTH_FACTORS/);
 const ctx=model(); ctx.rebuildAccountingRevenueFromCRM();
 assert.equal(ctx.COURSES_DATA.length,0); assert.equal(ctx.APEX_DATA[0].courseRev,0);
});
test('Only paid CRM orders count, grouped by category, employee and paid month', () => {
 const ctx=model();
 ctx.ACCOUNTING_CRM_STATE.products=[{id:'c',kind:'COURSE'},{id:'i',kind:'INDICATOR'},{id:'v',kind:'VIP'}];
 ctx.ACCOUNTING_CRM_STATE.orders=[
  {id:'1',productId:'c',saleId:'sale-1',subtotal:125,status:'PAID',createdAt:'2026-09-01',paidAt:'2026-10-01'},
  {id:'2',productId:'i',saleId:'sale-1',subtotal:75,status:'PAID',paidAt:'2026-10-01'},
  {id:'3',productId:'v',saleId:'sale-2',subtotal:50,status:'PAID',paidAt:'2026-10-01'},
  {id:'4',productId:'c',saleId:'sale-1',subtotal:900,status:'DEPOSIT',paidAt:'2026-10-01'},
  {id:'5',productId:'c',saleId:'sale-1',subtotal:30,status:'PAID',paidAt:'2026-09-01'}
 ];
 ctx.rebuildAccountingRevenueFromCRM();
 assert.equal(ctx.COURSES_DATA.reduce((sum,c)=>sum+c.totalRevenue,0),250);
 assert.equal(ctx.APEX_DATA[0].courseRev,125); assert.equal(ctx.APEX_DATA[0].indicatorRev,75); assert.equal(ctx.APEX_DATA[0].vipRev,0);
 ctx.currentGlobalMonth='2026-09'; ctx.rebuildAccountingRevenueFromCRM();
 assert.equal(ctx.COURSES_DATA[0].totalRevenue,30); assert.equal(ctx.APEX_DATA[0].indicatorRev,0);
 ctx.currentGlobalMonth='ALL'; ctx.rebuildAccountingRevenueFromCRM();
 assert.equal(ctx.COURSES_DATA.reduce((sum,c)=>sum+c.totalRevenue,0),280);
 ctx.ACCOUNTING_CRM_STATE.orders=[]; ctx.rebuildAccountingRevenueFromCRM();
 assert.equal(ctx.COURSES_DATA.length,0); assert.equal(ctx.APEX_DATA[0].courseRev,0);
});
test('Lot and bonus values come only from CRM metrics for the selected period', () => {
 const ctx=model();
 ctx.ACCOUNTING_CRM_STATE.brokerageMetrics=[{memberId:'sale-1',period:'2026-10',basicLots:2,bonus:100},{memberId:'sale-1',period:'2026-09',basicLots:7,bonus:50}];
 ctx.rebuildAccountingRevenueFromCRM(); assert.equal(ctx.APEX_DATA[0].basicLot,2); assert.equal(ctx.APEX_DATA[0].bonus,100);
 ctx.currentGlobalMonth='2026-08'; ctx.rebuildAccountingRevenueFromCRM(); assert.equal(ctx.APEX_DATA[0].basicLot,0); assert.equal(ctx.APEX_DATA[0].bonus,0);
});

test('Demo startup never creates paid sample orders or accounting configuration', () => {
 const server = fs.readFileSync(require('node:path').join(__dirname, '../webhook-server.cjs'), 'utf8');
 const start = server.indexOf('function seedDemoWorkspace()');
 const end = server.indexOf('\nseedDemoWorkspace();', start);
 assert.ok(start >= 0 && end > start);
 const demoState = Object.fromEntries(['members','customers','products','productCategories','customFieldDefinitions','orders','expenses','courseConfigs','dataOffers','careGroups','notifications','attendance','tasks'].map(key=>[key,[]]));
 const ctx = vm.createContext({DEMO_MODE:true,demoState,demoPasswords:{}});
 vm.runInContext(server.slice(start,end),ctx);
 ctx.seedDemoWorkspace();
 assert.equal(demoState.orders.length,0);
 assert.equal(demoState.courseConfigs.length,0);
 demoState.orders.push({id:'user-created-order',status:'PAID',subtotal:500});
 ctx.seedDemoWorkspace();
 assert.equal(demoState.orders.length,1);
 assert.equal(demoState.orders[0].id,'user-created-order');
});

test('Mindmap đọc lại đúng mini/micro lot, định mức và biến số lot đã lưu', () => {
 const ctx=model();
 ctx.ACCOUNTING_CRM_STATE.brokerageMetrics=[{memberId:'sale-1',period:'2026-10',basicLots:3,miniLots:2,microLots:1,lotCommissionRate:55000,productRate:12}];
 ctx.rebuildAccountingRevenueFromCRM();
 const p=vm.runInContext('APEX_DATA[0]',ctx);
 assert.equal(p.basicLot,3);assert.equal(p.miniLot,2);assert.equal(p.microLot,1);assert.equal(p.ratePerLot,55000);assert.equal(p.productRate,12);
 assert.match(html,/ACCOUNTING_LOT_CONFIG_SAVE/);assert.match(html,/applyLotConfigFromCRM\(msg\.lotConfig\)/);
 assert.doesNotMatch(html,/if \(person\.roleLevel === 'LV3'\) \{\s*postAccountingMessage\('ACCOUNTING_BROKERAGE_SAVE'/);
});

test('Accounting recognizes deposit and later bills in their actual months without double counting',()=>{
 const ctx=model();ctx.ACCOUNTING_CRM_STATE.products=[{id:'c',kind:'COURSE'}];
 ctx.ACCOUNTING_CRM_STATE.orders=[{id:'receipt-order',productId:'c',saleId:'sale-1',subtotal:5000000,total:5500000,vatAmount:500000,status:'PAID',receiptsVersion:1,paymentReceipts:[{id:'deposit',kind:'DEPOSIT',amount:500000,at:'2026-09-30T12:00:00+07:00'},{id:'full',kind:'FULL',amount:5000000,at:'2026-10-03T12:00:00+07:00'}]}];
 ctx.currentGlobalMonth='2026-09';ctx.rebuildAccountingRevenueFromCRM();assert.equal(ctx.COURSES_DATA[0].totalRevenue,454545);assert.equal(ctx.APEX_DATA[0].courseRev,454545);
 ctx.currentGlobalMonth='2026-10';ctx.rebuildAccountingRevenueFromCRM();assert.equal(ctx.COURSES_DATA[0].totalRevenue,4545455);
 ctx.currentGlobalMonth='ALL';ctx.rebuildAccountingRevenueFromCRM();assert.equal(ctx.COURSES_DATA[0].totalRevenue,5000000);
 ctx.currentGlobalMonth='2026-11';ctx.rebuildAccountingRevenueFromCRM();assert.equal(ctx.COURSES_DATA.length,0);
});

test('Accounting display preserves CRM VAT and receipt balances regardless of invoice request',()=>{
 const start=html.indexOf('function recalculateAllVatOrdersData()'),end=html.indexOf('function renderVatOrdersView()',start);
 const ctx=vm.createContext({VAT_ORDERS_DATA:[{crmOrderId:'deposit',subtotal:5000000,vatAmount:500000,total:5500000,collected:500000,remaining:5000000,requireVat:false,paymentStatus:'DEPOSIT'},{crmOrderId:'paid',subtotal:5000000,vatAmount:500000,total:5500000,collected:5500000,remaining:0,requireVat:false,paymentStatus:'PAID'}]});
 vm.runInContext(html.slice(start,end),ctx);ctx.recalculateAllVatOrdersData();assert.equal(ctx.VAT_ORDERS_DATA[0].total,5500000);assert.equal(ctx.VAT_ORDERS_DATA[0].remaining,5000000);assert.equal(ctx.VAT_ORDERS_DATA[1].collected,5500000);
});

test('Order review and expenses consume saved CRM email, VAT, balances and expense dates',()=>{
 const start=html.indexOf('  function syncAccountingExpensesFromCRM('),end=html.indexOf('  // Lắng nghe lệnh từ parent CRM',start);
 const ctx=vm.createContext({window:{},OrderPayments:require('../order-payments.js'),ACCOUNTING_CRM_STATE:{},ADMIN_EXPENSES_DATA:[],VAT_ORDERS_DATA:[],syncAccountingSelects(){},rebuildAccountingRevenueFromCRM(){}});
 vm.runInContext(html.slice(start,end),ctx);
 ctx.syncAccountingDataFromCRM({orders:[{id:'o',subtotal:5000000,vatAmount:500000,total:5500000,amountPaid:500000,balanceDue:5000000,status:'DEPOSIT',receiptsVersion:1,paymentReceipts:[{id:'r',amount:500000,billImage:'data:image/png;base64,AA==',images:[]}],billing:{email:'invoice@gmail.com',taxId:'0123456789'},companyName:'Test Company'}]});
 assert.equal(ctx.VAT_ORDERS_DATA[0].billImage,'');assert.equal(ctx.VAT_ORDERS_DATA[0].invoiceEmail,'invoice@gmail.com');assert.equal(ctx.VAT_ORDERS_DATA[0].taxCode,'0123456789');assert.equal(ctx.VAT_ORDERS_DATA[0].remaining,5000000);assert.equal(ctx.VAT_ORDERS_DATA[0].paymentReconciled,false);
 ctx.syncAccountingExpensesFromCRM({expenses:[{id:'e',date:'2026-10-03',amount:100000,note:'Đã lưu'}]});assert.equal(ctx.ADMIN_EXPENSES_DATA[0].month,'2026-10');assert.equal(ctx.ADMIN_EXPENSES_DATA[0].amount,100000);assert.equal(ctx.ADMIN_EXPENSES_DATA[0].note,'Đã lưu');
});
test('Embedded expense save waits for server acknowledgement and preserves draft on failure',()=>{
 const nodes=new Map(Object.entries({editingExpenseId:{value:''},inputExpTitle:{value:'Test expense'},inputExpCategory:{value:'Marketing'},inputExpAmount:{value:'100000'},inputExpMonth:{value:'2026-10'},inputExpDate:{value:'2026-10-03'},inputExpPayer:{value:'Admin'},inputExpNote:{value:'Note'}}));const button={};let messages=[];
 const ctx=vm.createContext({window:{parent:{}},document:{getElementById:id=>nodes.get(id),querySelector:()=>button},ADMIN_EXPENSES_DATA:[],currentAccountingMonth:'2026-10',postAccountingMessage:(...args)=>messages.push(args),alert:assert.fail,Date,Math});
 const start=html.indexOf('  function saveExpense()'),end=html.indexOf('  function deleteExpense(',start);vm.runInContext(html.slice(start,end),ctx);ctx.saveExpense();ctx.saveExpense();assert.equal(messages.length,1);assert.equal(ctx.ADMIN_EXPENSES_DATA.length,0);assert.equal(button.disabled,true);assert.equal(nodes.get('inputExpTitle').value,'Test expense');assert.equal(messages[0][0],'ACCOUNTING_EXPENSE_SAVE');assert.ok(nodes.get('editingExpenseId').value);
});

test('Commission saves target selected historical month instead of today',()=>{const start=html.indexOf('  function accountingSavePeriod()'),end=html.indexOf('  // Lưu chỉ số',start);const ctx=vm.createContext({currentGlobalMonth:'2026-08',Date});vm.runInContext(html.slice(start,end),ctx);assert.equal(ctx.accountingSavePeriod(),'2026-08');});
test('Course settings send persistent IDs and restore individual rates without changing collected revenue',()=>{
 const ctx=model();ctx.ACCOUNTING_CRM_STATE.products=[{id:'p',kind:'COURSE',price:5000000}];ctx.ACCOUNTING_CRM_STATE.orders=[{id:'o',productId:'p',saleId:'sale-1',subtotal:5000000,total:5500000,vatAmount:500000,amountPaid:5500000,status:'PAID',paidAt:'2026-10-03'}];ctx.ACCOUNTING_CRM_STATE.courseConfigs=[{courseKey:'p',trainerIds:['trainer'],leaderIds:['leader'],trainerRates:{trainer:12},leaderRates:{leader:4},saleRates:{'sale-1':18}}];ctx.rebuildAccountingRevenueFromCRM();const group=ctx.COURSES_DATA[0];assert.equal(group.trainers[0].rate,12);assert.equal(group.leaders[0].rate,4);assert.equal(group.salesConfig['sale-1'].rateSale,18);assert.equal(group.totalRevenue,5000000);
 let message;ctx.postAccountingMessage=(type,body)=>message={type,body};ctx.alert=assert.fail;const start=html.indexOf('  function persistCourseConfigs('),end=html.indexOf('  function saveTrainingConfig()',start);vm.runInContext(html.slice(start,end),ctx);ctx.persistCourseConfigs([group],'detail');assert.equal(message.type,'ACCOUNTING_COURSE_CONFIG_SAVE');assert.equal(message.body.payload[0].courseKey,'p');assert.equal(message.body.payload[0].saleRates['sale-1'],18);assert.equal(message.body.payload[0].totalRevenue,undefined);
});
