'use strict';
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.createCustomerSaveQueue=factory();
})(typeof globalThis!=='undefined'?globalThis:this,()=>function createCustomerSaveQueue({isBusy,setBusy,onChange,persist=()=>{},schedule=fn=>setTimeout(fn,50)}){
  const jobs=[];let running=false,error=null,scheduled=false;
  const emit=()=>onChange({pending:jobs.length,error,running});
  const checkpoint=()=>persist(jobs.map(({key,payload})=>({key,payload})));
  async function drain(){
    if(running||error||!jobs.length)return;
    if(isBusy()){
      if(!scheduled){scheduled=true;schedule(()=>{scheduled=false;void drain();});}
      return;
    }
    running=true;setBusy(true);emit();
    try{
      checkpoint();
      while(jobs.length){
        try{await jobs[0].action(jobs[0].payload);jobs.shift();checkpoint();emit();}
        catch(cause){error=cause;break;}
      }
    }catch(cause){error=cause;}finally{running=false;setBusy(false);emit();}
  }
  function flush({timeout=12000}={}){
    if(!jobs.length&&!running)return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      const started=Date.now();
      const check=()=>{
        if(!jobs.length&&!running){resolve(true);return;}
        if(error){reject(error);return;}
        if(Date.now()-started>=timeout){reject(Error('Chưa lưu xong các thay đổi khách hàng trong thời gian cho phép.'));return;}
        void drain();setTimeout(check,50);
      };
      check();
    });
  }
  return {
    get pending(){return jobs.length;},
    enqueue(key,action,payload){
      // Chỉ giữ bản mới nhất của cùng một ô khi bản trước chưa chạy.
      // Nếu không gộp, thao tác A -> B -> C có thể gửi các base revision
      // nối tiếp nhau và bản C bị coi là xung đột giả sau khi A đã lưu.
      const start=(running||error)?1:0;
      const index=jobs.findIndex((job,position)=>position>=start&&job.key===key);
      if(index>=0){
        const previous=jobs[index];
        const mergedPayload=payload&&previous.payload&&typeof payload==='object'&&typeof previous.payload==='object'
          ?{...payload,base:Object.hasOwn(previous.payload,'base')?previous.payload.base:payload.base}
          :payload;
        jobs[index]={key,action,payload:mergedPayload};
      }else jobs.push({key,action,payload});
      try{checkpoint();}catch(cause){error=cause;}
      emit();void drain();
    },
    restore(records,makeAction){
      // Gộp bản nháp cũ với thay đổi mới: ô nào người dùng vừa sửa (đã có trong
      // hàng đợi) thì giữ bản mới, các ô còn lại lấy từ bản nháp đã lưu.
      const queued=new Set(jobs.map(job=>job.key));
      const restored=[];
      for(const {key,payload} of records){
        if(!key||queued.has(key))continue;
        queued.add(key);restored.push({key,payload,action:makeAction(payload)});
      }
      // Không chen vào trước job đang chạy; đặt bản nháp cũ trước các job mới chưa chạy.
      jobs.splice(running&&jobs.length?1:0,0,...restored);
      if(restored.length){
        // Ghi checkpoint trước khi gửi request. Nếu người dùng F5 tiếp
        // trong lúc khôi phục, bản nháp vẫn còn để lần sau gửi lại.
        checkpoint();
        emit();void drain();
      }
    },
    retry(){error=null;emit();void drain();},
    flush,
    cancel(){if(running)return false;jobs.length=0;error=null;emit();return true},
    get running(){return running}
  };
});
