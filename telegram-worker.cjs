'use strict';
// Tiến trình riêng: chỉ một worker giữ khóa lịch Telegram của cùng CSDL.
function createTelegramLoop(bot,{now=Date.now,schedule=setTimeout,cancel=clearTimeout,verify=async()=>{},onError=error=>console.warn('[telegram-worker]',error.code||error.message),onStall=()=>{},interval=15000,deadline=180000}={}){
 let stopped=false,timer=null,guard=null,lastSchedule=null;
 async function tick(){
  if(stopped)return;
  guard=schedule(()=>{stopped=true;onStall();},deadline);
  try{
   await verify();
   if(stopped)return;
   await bot.drainLeadNotifications();
   if(stopped)return;
   if(lastSchedule===null||now()-lastSchedule>=60000){lastSchedule=now();await bot.runTelegramScheduler({skipLeadDrain:true});}
  }catch(error){onError(error);}
  finally{cancel(guard);guard=null;if(!stopped)timer=schedule(tick,interval);}
 }
 void tick();
 return ()=>{stopped=true;cancel(timer);cancel(guard);};
}
async function main(){
 require('dotenv').config({path:require('node:path').join(__dirname,'.env')});
 // Pool riêng, nhỏ: worker không cần ngân sách kết nối như web phục vụ người dùng.
 process.env.DB_CONNECTION_LIMIT=process.env.TELEGRAM_WORKER_DB_LIMIT||'4';
 process.env.DB_AUTH_CONNECTION_LIMIT='1';
 const db=require('./db.js');
 if(!db.dbConfigured||!process.env.TELEGRAM_BOT_TOKEN){console.error('[telegram-worker] Thiếu MySQL hoặc token bot hệ thống.');return 78;}
 let lease;
 try{
  lease=await db.pool.getConnection();
  const [rows]=await lease.query("SELECT GET_LOCK(CONCAT('nvt-tg-scheduler:',LEFT(SHA2(DATABASE(),256),40)),0) AS acquired");
  if(Number(rows[0]?.acquired)!==1){lease.release();return 75;}
 }catch(error){lease?.destroy();throw error;}
 const bot=require('./telegram-bot.cjs');
 let stopping=false,stop=()=>{};
 async function shutdown(code){
  if(stopping)return;stopping=true;stop();
  const force=setTimeout(()=>process.exit(code),1500);force.unref();
  try{await lease.query("SELECT RELEASE_LOCK(CONCAT('nvt-tg-scheduler:',LEFT(SHA2(DATABASE(),256),40)))");lease.release();}catch{lease.destroy();}
  process.exit(code);
 }
 const send=type=>{if(process.connected)process.send({type},()=>{});};
 const heartbeat=setInterval(()=>send('heartbeat'),10000);heartbeat.unref();send('ready');
 // Mất process web cha thì dừng worker cũ; worker mới sẽ nhận khóa SQL.
 process.on('disconnect',()=>{void shutdown(0);});process.on('SIGTERM',()=>{void shutdown(0);});process.on('SIGINT',()=>{void shutdown(0);});
 stop=createTelegramLoop(bot,{
  verify:async()=>{try{const [rows]=await lease.query("SELECT IS_USED_LOCK(CONCAT('nvt-tg-scheduler:',LEFT(SHA2(DATABASE(),256),40)))=CONNECTION_ID() AS owned");if(Number(rows[0]?.owned)!==1)throw Error('Mất khóa scheduler');}catch(error){void shutdown(1);throw error;}},
  onStall:()=>{console.error('[telegram-worker] Quá hạn xử lý, khởi động lại worker.');process.exit(1);}
 });
 return null;
}
if(require.main===module)main().then(code=>{if(code!==null)process.exit(code);}).catch(error=>{console.error('[telegram-worker]',error.code||error.message);process.exit(1);});
module.exports={createTelegramLoop,main};
