'use strict';
// One source of truth for global round previews, skipped slots and allocation.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CrmDistributionRounds=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const weight=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Math.round(Number(value)))):1;
  function slots(round,people,mode){
    const enabled=new Set(Array.isArray(round?.enabledSaleIds)?round.enabledSaleIds:people.map(p=>p.id));
    const ids=people.filter(p=>enabled.has(p.id)&&weight(round?.weights?.[p.id])>0).sort((a,b)=>a.id.localeCompare(b.id)).flatMap(p=>Array(mode==='EQUAL'?1:weight(round?.weights?.[p.id])).fill(p.id));
    const omitted=new Set(round?.omittedSlots||[]);
    return ids.filter((id,i)=>!omitted.has(i));
  }
  function preview(config,raw,people,mode){
    const rounds=Array.isArray(config?.rounds)&&config.rounds.length?config.rounds:[config||{}];
    return rounds.map((round,i)=>{
      const initialized=i===0&&raw&&typeof raw==='object'&&Array.isArray(raw.ids)&&(raw.ids.length>0||raw.cycleId);
      const ids=initialized?raw.ids.slice():slots(round,people,mode);
      const index=i===0?Math.min(ids.length,Math.max(0,Number(initialized?raw.index:typeof raw==='number'?raw:0)||0)):0;
      const roundId=round.id||'ROUND-1';
      const cycleId=initialized?raw.cycleId||'legacy':'';
      return {roundId,index,ids,cycleId,token:JSON.stringify([roundId,index,ids,cycleId,mode,round.omittedSlots||[]])};
    });
  }
  function skip(config,raw,people,mode,input){
    const views=preview(config,raw,people,mode);
    const i=views.findIndex(v=>v.roundId===input.roundId),view=views[i];
    if(!view||view.token!==input.token)throw Error('Thứ tự vòng đã thay đổi. Đóng chi tiết và mở lại để cập nhật.');
    const position=input.position;
    if(!Number.isInteger(position)||position<view.index||position>=view.ids.length||view.ids[position]!==input.memberId)throw Error('Lượt này đã được phân hoặc không còn trong hàng chờ.');
    const next=JSON.parse(JSON.stringify(config));
    if(i===0){const ids=view.ids.slice();ids.splice(position,1);return {config:next,cursor:{index:view.index,ids,cycleId:String((Number(view.cycleId)||0)+1)}};}
    let original=-1,visible=-1;while(visible<position){original++;if(!(next.rounds[i].omittedSlots||[]).includes(original))visible++;}next.rounds[i].omittedSlots=[...new Set([...(next.rounds[i].omittedSlots||[]),original])].sort((a,b)=>a-b);
    return {config:next,cursor:raw};
  }
  function take(config,raw,people,mode){
    const next=JSON.parse(JSON.stringify(config));
    let cursor=raw;let changed=false;
    for(let attempt=0;attempt<(config?.rounds?.length||1)+2;attempt++){
      const view=preview(next,cursor,people,mode)[0];
      const eligible=new Set(people.map(p=>p.id));
      let index=view.index;
      while(index<view.ids.length&&!eligible.has(view.ids[index]))index++;
      if(index<view.ids.length)return {id:view.ids[index],config:next,changed,cursor:{index:index+1,ids:view.ids,cycleId:view.cycleId||'cycle'}};
      if(next.rounds?.length>1){next.rounds.shift();next.weights=next.rounds[0].weights;next.enabledSaleIds=next.rounds[0].enabledSaleIds;changed=true;}
      else {
        const round=next.rounds?.[0]||next;
        if(round.omittedSlots?.length){delete round.omittedSlots;changed=true;}
        if(!slots(round,people,mode).length)return {id:null,config:next,changed,cursor:{index:view.ids.length,ids:view.ids,cycleId:view.cycleId||'empty'}};
      }
      const round=next.rounds?.[0]||next;
      cursor={index:0,ids:slots(round,people,mode),cycleId:String((Number(view.cycleId)||0)+1)};
    }
    return {id:null,config:next,changed,cursor};
  }
  function recipients(members,leaderConfig={},saleConfigs={}){
    members=members.filter(p=>p.active!==false);
    const leaders=members.filter(p=>p.role==='LEADER'&&p.teamId&&(leaderConfig.enabledLeaderIds||[]).includes(p.id));
    const directSales=managerId=>members.filter(p=>p.role==='SALE'&&(p.leaderId===managerId||p.managerId===managerId&&!members.some(l=>l.role==='LEADER'&&l.id===p.leaderId)));
    for(const manager of members.filter(p=>p.role==='MANAGER')){
      const own=saleConfigs['manager:'+manager.id]||{};
      const configured=Array.isArray(own.enabledSaleIds)&&own.enabledSaleIds.length>0;
      if(directSales(manager.id).some(p=>!configured||own.enabledSaleIds.includes(p.id)))leaders.push({...manager,directManagerBranch:true});
    }
    leaders.sort((a,b)=>a.id.localeCompare(b.id));
 const globalRecipients=[];
 const globalWeights={};
 const globalSeen=new Set();
 const globalLeaderWeights=leaderConfig.weights||{};
 const globalWeight=raw=>{const n=Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):1;};
 const addGlobal=(person,raw)=>{const value=globalWeight(raw);if(!person||globalSeen.has(person.id)||(!saleConfigs.$&&value<=0))return;globalSeen.add(person.id);globalRecipients.push(person);globalWeights[person.id]=value;};
 for(const leader of leaders){
  const saleKey=leader.directManagerBranch?'manager:'+leader.id:leader.id;
  const config=saleConfigs[saleKey]||{};
  if(leader.directManagerBranch){
   const managerRecipient={...leader,role:'SALE',actualRole:'MANAGER',managerRecipient:true,leaderId:null,teamId:leader.teamId};
   if(config.leaderEnabled!==false)addGlobal(managerRecipient,config.weights?.[leader.id]);
   const configured=Array.isArray(config.enabledSaleIds)&&config.enabledSaleIds.length>0;
   directSales(leader.id).filter(p=>!configured||config.enabledSaleIds.includes(p.id)).forEach(p=>addGlobal({...p,directManagerBranch:true,managerId:leader.id,leaderId:null},config.weights?.[p.id]));
   continue;
  }
  if(config.leaderEnabled!==false)addGlobal({...leader,role:'SALE',actualRole:'LEADER',leaderId:leader.id,teamLeaderRecipient:true},config.weights?.[leader.id]??globalLeaderWeights[leader.id]);
  const configured=Array.isArray(config.enabledSaleIds)&&config.enabledSaleIds.length>0;
  members.filter(p=>p.role==='SALE'&&p.leaderId===leader.id&&(!configured||config.enabledSaleIds.includes(p.id))).forEach(p=>addGlobal(p,config.weights?.[p.id]));
  const manager=leader.managerId&&members.find(p=>p.role==='MANAGER'&&p.id===leader.managerId);
  if(manager&&(!configured||config.enabledSaleIds.includes(manager.id)))addGlobal({...manager,role:'SALE',actualRole:'MANAGER',managerRecipient:true,leaderId:leader.id,teamId:leader.teamId},config.weights?.[manager.id]);
 }

    return {people:globalRecipients.sort((a,b)=>a.id.localeCompare(b.id)),weights:globalWeights};
  }
  function cursorFrom(store={}){return store.global&&typeof store.global==='object'?store.global:store.salesByTeam?.global??store.global;}
  function removeMember(config,raw,people,mode,input){
    const views=preview(config,raw,people,mode);
    const i=views.findIndex(v=>v.roundId===input.roundId),view=views[i];
    if(!view||view.token!==input.token)throw Error('Round order changed. Reopen the detail view.');
    if(!view.ids.includes(input.memberId))throw Error('Member is no longer in this round.');
    const next=JSON.parse(JSON.stringify(config));
    const round=next.rounds?.[i]||next;
    round.enabledSaleIds=(Array.isArray(round.enabledSaleIds)?round.enabledSaleIds:people.map(p=>p.id)).filter(id=>id!==input.memberId);
    round.weights={...(round.weights||{}),[input.memberId]:0};
    if(!round.enabledSaleIds.some(id=>weight(round.weights[id])>0))throw Error('Mỗi vòng cần giữ ít nhất một thành viên có tỷ trọng lớn hơn 0.');
    if(i===0){
      next.enabledSaleIds=round.enabledSaleIds;
      next.weights=round.weights;
      const cursor=raw&&typeof raw==='object'?raw:{index:0,ids:view.ids,cycleId:'legacy'};
      const index=Math.max(0,Math.min(view.ids.length,Number(cursor.index)||0));
      const ids=[...view.ids.slice(0,index),...view.ids.slice(index).filter(id=>id!==input.memberId)];
      return {config:next,cursor:{...cursor,index,ids}};
    }
    return {config:next,cursor:raw};
  }
  return {slots,preview,skip,removeMember,take,recipients,cursorFrom};
});
