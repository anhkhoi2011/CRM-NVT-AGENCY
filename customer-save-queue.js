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
        try{await jobs[0].action();jobs.shift();checkpoint();emit();}
        catch(cause){error=cause;break;}
      }
    }catch(cause){error=cause;}finally{running=false;setBusy(false);emit();}
  }
  return {
    get pending(){return jobs.length;},
    enqueue(key,action,payload){
      jobs.push({key,action,payload});
      try{checkpoint();}catch(cause){error=cause;}
      emit();void drain();
    },
    restore(records,makeAction){
      if(running||jobs.length)throw Error('Queue already contains edits');
      for(const {key,payload} of records)jobs.push({key,payload,action:makeAction(payload)});
      if(jobs.length){emit();void drain();}
    },
    retry(){error=null;emit();void drain();}
  };
});
