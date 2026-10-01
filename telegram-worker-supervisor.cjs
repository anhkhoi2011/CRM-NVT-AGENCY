'use strict';
const path=require('node:path');
// Không chờ worker trong request HTTP; không chạy bot trong web khi fork thất bại.
function startTelegramWorker({fork=require('node:child_process').fork,schedule=setTimeout,cancel=clearTimeout,now=Date.now,log=console.warn}={}){
 let child=null,timer=null,monitor=null,stopped=false,failures=0,lastBeat=0,state='starting';
 function later(delay){if(!stopped){timer=schedule(launch,delay);timer?.unref?.();}}
 function launch(){
  if(stopped)return;
  let current;
  try{current=fork(path.join(__dirname,'telegram-worker.cjs'),[],{cwd:__dirname,execArgv:[],stdio:['ignore','inherit','inherit','ipc'],windowsHide:true});}
  catch(error){state='unavailable';log('[telegram-worker] Không tạo được process:',error.code||error.message);later(Math.min(300000,5000*2**Math.min(failures++,6)));return;}
  const started=now();child=current;state='starting';lastBeat=started;
  function check(){if(stopped||child!==current)return;if(now()-lastBeat>45000){state='unresponsive';current.kill('SIGKILL');return;}monitor=schedule(check,15000);monitor?.unref?.();}
  monitor=schedule(check,15000);monitor?.unref?.();
  current.on('message',message=>{if(message?.type==='ready'||message?.type==='heartbeat')lastBeat=now();if(message?.type==='ready'){state='running';}});
  current.on('error',error=>{state='unavailable';log('[telegram-worker] Lỗi tiến trình:',error.code||error.message);});
  current.once('close',code=>{if(child!==current)return;child=null;cancel(monitor);if(now()-started>=60000)failures=0;state=code===75?'standby':code===78?'configuration-error':'restarting';later(code===75?60000:code===78?300000:Math.min(300000,5000*2**Math.min(failures++,6)));});
 }
 launch();
 return {status:()=>state,stop(){stopped=true;state='stopped';cancel(timer);cancel(monitor);child?.kill('SIGTERM');}};
}
module.exports={startTelegramWorker};
