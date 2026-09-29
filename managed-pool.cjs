'use strict';
function managedPool(raw, { limit, acquireTimeout = 5000, queryTimeout = 5000, queueLimit = 0 }) {
  let active = 0; const waiting = [];
  const failure = code => Object.assign(new Error(code), { code, status: 503 });
  function pump() {
    while (active < limit && waiting.length) {
      const item = waiting.shift(); item.started = true; active++;
      Promise.resolve().then(() => raw.getConnection()).then(connection => {
        if (item.expired) { connection.destroy?.(); if (!item.slotReleased) { item.slotReleased=true; active--; pump(); } return; }
        clearTimeout(item.timer); let released=false, broken=false;
        const release=()=>{if(released)return;released=true;try{if(!broken)connection.release();}finally{if(!item.slotReleased){item.slotReleased=true;active--;pump();}}};
        async function command(method,args){
          if(released||broken)throw failure('DB_CONNECTION_CLOSED'); let timer;
          try{return await Promise.race([Promise.resolve().then(()=>connection[method](...args)),new Promise((_,reject)=>{timer=setTimeout(()=>{broken=true;connection.destroy?.();reject(failure('DB_QUERY_TIMEOUT'));},queryTimeout);})]);}
          catch(error){if(!broken&&(method==='rollback'||error.fatal)){broken=true;connection.destroy?.();}throw error;}finally{clearTimeout(timer);}
        }
        item.resolve({query:(...a)=>command('query',a),execute:(...a)=>command('execute',a),beginTransaction:()=>command('beginTransaction',[]),commit:()=>command('commit',[]),rollback:()=>broken?Promise.resolve():command('rollback',[]),release,destroy(){if(!released){broken=true;connection.destroy?.();release();}}});
      },error=>{clearTimeout(item.timer);if(!item.slotReleased){item.slotReleased=true;active--;pump();}if(!item.expired)item.reject(error);});
    }
  }
  function getConnection(){
    if(queueLimit&&active>=limit&&waiting.length>=queueLimit)return Promise.reject(failure('DB_QUEUE_FULL'));
    return new Promise((resolve,reject)=>{const item={resolve,reject,started:false,expired:false,slotReleased:false};item.timer=setTimeout(()=>{item.expired=true;if(!item.started){const i=waiting.indexOf(item);if(i>=0)waiting.splice(i,1);}if(item.started&&!item.slotReleased){item.slotReleased=true;active--;pump();}reject(failure('DB_ACQUIRE_TIMEOUT'));},acquireTimeout);waiting.push(item);pump();});
  }
  async function run(method,args){const connection=await getConnection();try{return await connection[method](...args);}finally{connection.release();}}
  return {getConnection,query:(...a)=>run('query',a),execute:(...a)=>run('execute',a),stats:()=>({active,queued:waiting.length,limit}),end:()=>raw.end()};
}
module.exports={managedPool};
