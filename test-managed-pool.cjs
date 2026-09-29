'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {managedPool}=require('./managed-pool.cjs');
function fixture(options={}){
 const events=[];
 const raw={async getConnection(){events.push('acquire');return {async query(){events.push('query');return [[1]];},async execute(){throw Error('SQL failed');},async beginTransaction(){},async rollback(){events.push('rollback');},release(){events.push('release');},destroy(){events.push('destroy');}};}};
 return {events,raw,pool:managedPool(raw,{limit:1,acquireTimeout:30,queryTimeout:30,...options})};
}
test('Automatic queries return connections on both success and SQL failure',async()=>{
 const f=fixture();assert.deepEqual(await f.pool.query('SELECT 1'),[[1]]);await assert.rejects(f.pool.execute('bad'),/SQL failed/);assert.equal(f.events.filter(x=>x==='release').length,2);assert.equal(f.pool.stats().active,0);
});
test('Timed-out queued requests are removed and never execute later',async()=>{
 const f=fixture(),held=await f.pool.getConnection();await assert.rejects(f.pool.query('SELECT 1'),{code:'DB_ACQUIRE_TIMEOUT'});assert.equal(f.pool.stats().queued,0);held.release();assert.deepEqual(f.events,['acquire','release']);await f.pool.query('SELECT 1');assert.equal(f.pool.stats().active,0);
});
test('Connection returned after acquisition deadline is released exactly once',async()=>{
 let resolve,releases=0;const raw={getConnection:()=>new Promise(r=>{resolve=r;})};const pool=managedPool(raw,{limit:1,acquireTimeout:10});await assert.rejects(pool.getConnection(),{code:'DB_ACQUIRE_TIMEOUT'});resolve({release(){releases++;}});await new Promise(setImmediate);assert.equal(releases,1);assert.equal(pool.stats().active,0);
});
test('Hung SQL destroys connection and cannot return a transaction to pool',async()=>{
 const f=fixture();f.raw.getConnection=async()=>({query:()=>new Promise(()=>{}),release(){f.events.push('release');},destroy(){f.events.push('destroy');}});await assert.rejects(f.pool.query('hung'),{code:'DB_QUERY_TIMEOUT'});assert.deepEqual(f.events,['destroy']);assert.equal(f.pool.stats().active,0);
});
test('Queued callers are served in order; duplicate release cannot exceed limit',async()=>{
 const f=fixture({acquireTimeout:500});const first=await f.pool.getConnection(),next=f.pool.getConnection();assert.equal(f.pool.stats().queued,1);first.release();first.release();const second=await next;assert.equal(f.pool.stats().active,1);second.release();assert.equal(f.pool.stats().active,0);
});
test('Dedicated authentication pool remains available when data pool is full',async()=>{
 const data=fixture(),auth=fixture();const held=await data.pool.getConnection();assert.deepEqual(await auth.pool.query('SELECT user'),[[1]]);held.release();
});
test('Connection creation failure frees slot for next request',async()=>{
 const f=fixture();const original=f.raw.getConnection;f.raw.getConnection=async()=>{throw Error('connection failed');};await assert.rejects(f.pool.getConnection(),/connection failed/);assert.equal(f.pool.stats().active,0);f.raw.getConnection=original;await f.pool.query('SELECT 1');
});
test('Fatal handlers log once and exit instead of continuing unsafe state',()=>{
 const {EventEmitter}=require('node:events'),target=new EventEmitter(),logs=[],exits=[];target.exit=code=>exits.push(code);require('./process-safety.cjs').installProcessSafety(target,{error:(...args)=>logs.push(args)});target.emit('unhandledRejection',Error('fatal-test'));target.emit('uncaughtException',Error('again'));assert.deepEqual(exits,[1]);assert.equal(logs.length,1);assert.match(logs[0][2],/fatal-test/);
});

test('Rollback failure discards the connection instead of reusing its transaction',async()=>{
 const events=[],pool=managedPool({getConnection:async()=>({rollback:async()=>{throw Error('rollback failed');},destroy:()=>events.push('destroy'),release:()=>events.push('release')})},{limit:1});const c=await pool.getConnection();await assert.rejects(c.rollback(),/rollback failed/);c.release();assert.deepEqual(events,['destroy']);assert.equal(pool.stats().active,0);
});
test('Deployment copies both new runtime modules to the Node app',()=>{
 const text=require('node:fs').readFileSync(__dirname+'/.cpanel.yml','utf8');const line=text.split('\n').find(line=>line.includes('webhook-server.cjs')&&line.includes('$CRMPATH'));assert.ok(line.includes('managed-pool.cjs'));assert.ok(line.includes('process-safety.cjs'));
});

test('Eight database leases run concurrently and the next waits for release',async()=>{
 const f=fixture({limit:8,acquireTimeout:1000});const leases=await Promise.all(Array.from({length:8},()=>f.pool.getConnection()));assert.equal(f.pool.stats().active,8);const pending=f.pool.getConnection();assert.equal(f.pool.stats().queued,1);leases[0].release();const last=await pending;assert.equal(f.pool.stats().active,8);leases.slice(1).forEach(c=>c.release());last.release();assert.equal(f.pool.stats().active,0);assert.equal(f.pool.stats().queued,0);
});
test('Database defaults and overrides use supported driver options and managed acquisition timeout',()=>{
 const configs=[],fs=require('node:fs'),vm=require('node:vm');function load(env){const context={module:{exports:{}},__dirname,process:{env},console,require:name=>name==='dotenv'?{config(){}}:name==='mysql2/promise'?{createPool:options=>{configs.push(options);return {on(){},end(){}};}}:require(name)};vm.runInNewContext(fs.readFileSync(__dirname+'/db.js','utf8'),context);return context.module.exports;}
 const defaults=load({});assert.equal(defaults.pool.stats().limit,8);assert.equal(defaults.authPool.stats().limit,3);assert.equal(configs[0].connectTimeout,10000);assert.equal(configs[0].queueLimit,0);assert.equal(configs[0].waitForConnections,true);assert.equal('acquireTimeout' in configs[0],false);
 const custom=load({DB_CONNECTION_LIMIT:'12',DB_AUTH_CONNECTION_LIMIT:'4'});assert.equal(custom.pool.stats().limit,8);assert.equal(custom.authPool.stats().limit,4);
});

test('Pool limits are capped against stale hosting environment values',()=>{
 const db=require('node:fs').readFileSync(__dirname+'/db.js','utf8');assert.ok(db.includes("Math.min(setting('DB_CONNECTION_LIMIT', 8), 8)"));assert.ok(db.includes("Math.min(setting('DB_AUTH_CONNECTION_LIMIT', 3), 4)"));
});
