'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
// Liveness chỉ kiểm tra process web; không restart web vì MySQL hoặc Telegram chậm.
function probeLive({url,socketPath,timeoutMs=7000}){
 return new Promise(resolve=>{
  let settled=false,timer;const done=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
  const target=new URL(url);const transport=require(target.protocol==='https:'?'node:https':'node:http');
  const options=socketPath?{socketPath,path:'/api/health/live',method:'GET'}:target;
  const req=transport.get(options,res=>{
   if(res.statusCode===404){res.resume();done({ok:false,configurationError:true,error:'Sai địa chỉ health/live'});return;}
   if(res.statusCode!==200){res.resume();done({ok:false,error:'HTTP '+res.statusCode});return;}
   let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;if(body.length>65536)req.destroy(Error('Phản hồi liveness quá lớn'));});
   res.on('end',()=>{try{const data=JSON.parse(body);done(data.ok===true&&data.live===true?{ok:true}:{ok:false,configurationError:true,error:'Không phải endpoint liveness CRM'});}catch{done({ok:false,configurationError:true,error:'Liveness không trả JSON CRM'});}});
   res.on('error',error=>done({ok:false,error:error.code||error.message}));
  });
  req.on('error',error=>done({ok:false,error:error.code||error.message}));
  timer=setTimeout(()=>req.destroy(Error('Quá hạn kiểm tra liveness')),timeoutMs);
 });
}
async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function runWatchdog({root=__dirname,url='http://127.0.0.1:'+Number(process.env.PORT||4173)+'/api/health/live',socketPath='',check=probeLive,now=Date.now,timeoutMs=7000,threshold=3,cooldownMs=300000,maxRestarts=3,log=console.warn}={}){
 const target=new URL(url);if(!['http:','https:'].includes(target.protocol)||target.pathname!=='/api/health/live')throw Error('WATCHDOG_URL phải trỏ đến /api/health/live');
 const tmp=path.join(root,'tmp');await fs.mkdir(tmp,{recursive:true});
 const lockFile=path.join(tmp,'watchdog.lock'),stateFile=path.join(tmp,'watchdog-state.json'),marker=path.join(tmp,'restart.txt');
 let lock;
 try{lock=await fs.open(lockFile,'wx');}catch(error){
  if(error.code!=='EEXIST')throw error;
  const owner=await readJson(lockFile,null);
  if(!Number.isInteger(owner?.pid)){const info=await fs.stat(lockFile).catch(()=>null);if(!info||Date.now()-info.mtimeMs<60000)return {status:'busy'};}
  else{try{process.kill(owner.pid,0);return {status:'busy'};}catch(e){if(e.code!=='ESRCH')return {status:'busy'};}}
  try{await fs.unlink(lockFile);lock=await fs.open(lockFile,'wx');}catch{return {status:'busy'};}
 }
 try{
  await lock.writeFile(JSON.stringify({pid:process.pid}));
  const time=now(),key=socketPath||url;
  let state=await readJson(stateFile,{failures:0,restarts:[]});if(state.target!==key)state={target:key,failures:0,restarts:[]};
  state.restarts=(Array.isArray(state.restarts)?state.restarts:[]).filter(t=>time-t<3600000);
  let result;try{result=await check({url,socketPath,timeoutMs});}catch(error){result={ok:false,error:error.code||error.message};}
  let status='healthy';
  if(result.ok){state.failures=0;state.lastHealthy=time;}
  else if(result.configurationError){state.failures=0;status='configuration-error';log('[watchdog]',result.error);}
  else{
   state.failures=(Number(state.failures)||0)+1;state.lastError=String(result.error||'Không phản hồi');status='waiting';
   log('[watchdog] Liveness thất bại',state.failures,state.lastError);
   if(state.failures>=threshold){
    let restartAt=0;try{restartAt=(await fs.stat(marker)).mtimeMs;}catch{}
    if(time-restartAt<cooldownMs)status='cooldown';
    else if(state.restarts.length>=maxRestarts)status='rate-limited';
    else{
     const handle=await fs.open(marker,'a');await handle.close();await fs.utimes(marker,new Date(time),new Date(time));
     state.failures=0;state.restarts.push(time);status='restart-requested';log('[watchdog] Đã cập nhật tmp/restart.txt để Passenger khởi động lại.');
    }
   }
  }
  await fs.writeFile(stateFile,JSON.stringify(state));return {status,failures:state.failures};
 }finally{await lock.close();await fs.unlink(lockFile).catch(()=>{});}
}
if(require.main===module){
 require('dotenv').config({path:path.join(__dirname,'.env')});
 runWatchdog({url:process.env.WATCHDOG_URL||'http://127.0.0.1:'+Number(process.env.PORT||4173)+'/api/health/live',socketPath:process.env.WATCHDOG_SOCKET||''}).then(result=>console.log('[watchdog]',result.status)).catch(error=>{console.error('[watchdog]',error.code||error.message);process.exitCode=1;});
}
module.exports={probeLive,runWatchdog};
