'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../commission_tree_demo.html'), 'utf8');
function model() {
 const ctx = vm.createContext({window:{}});
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
