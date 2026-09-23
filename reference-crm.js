'use strict';
// Giữ HTML/CSS tham chiếu. Chỉ thay nguồn dữ liệu và handler của các ô có sẵn.
(() => {
  const q=s=>document.querySelector(s), qa=s=>Array.from(document.querySelectorAll(s));
  const ACTIVE_TAB_KEY='nvt-crm-active-tab-v1';
  const SNAPSHOT_CACHE_KEY='nvt-crm-snapshot-cache-v1';
  const frame=q('#crmRuntimeFrame');
  const bootScreen=q('#crmBootScreen');
  let api=null, data=null, signature='', working=false, refreshTimer=null, bootFallbackTimer=null, selectedCustomer='', careKey='', dataQueuePage=1, dataQueuePageSize=20, dataQueueDateFrom='', dataQueueDateTo='', cachedSnapshotUsed=false;
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));  function referenceNotice(message,type='success') {
    let host=document.getElementById('referenceNoticeHost');
    if(!host){
      host=document.createElement('div');host.id='referenceNoticeHost';host.setAttribute('role','status');host.setAttribute('aria-live','polite');
      host.style.cssText='position:fixed;top:18px;right:18px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;pointer-events:none;width:min(360px,calc(100vw - 36px));';
      document.body.appendChild(host);
    }
    const item=document.createElement('div');
    item.textContent=String(message||'');
    item.style.cssText='pointer-events:auto;padding:12px 14px;border-radius:8px;border:1px solid '+(type==='error'?'#fecaca':'#bbf7d0')+';background:'+(type==='error'?'#fef2f2':'#f0fdf4')+';color:'+(type==='error'?'#b91c1c':'#166534')+';box-shadow:0 8px 24px rgba(15,23,42,.16);font-size:13px;font-weight:700;line-height:1.4;';
    host.appendChild(item);setTimeout(()=>item.remove(),3600);
  }
  function referenceConfirmDelete(name) {
    return new Promise(resolve=>{
      const modal=document.createElement('div');
      modal.className='modal-overlay open';
      modal.innerHTML='<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="referenceDeleteTitle" style="width:min(440px,calc(100vw - 28px));"><div class="modal-header"><h3 id="referenceDeleteTitle">Xóa khỏi danh sách Data</h3><button type="button" class="modal-close-btn" data-reference-delete-cancel aria-label="Đóng">×</button></div><div class="modal-body"><p style="margin:0;color:var(--text-main);line-height:1.55;">Bạn có chắc muốn xóa data <b>'+esc(name)+'</b> khỏi danh sách không?</p></div><div class="modal-footer"><button type="button" class="btn-action btn-secondary" data-reference-delete-cancel>Hủy</button><button type="button" class="btn-action btn-danger" data-reference-delete-confirm>Xóa data</button></div></div>';
      document.body.appendChild(modal);
      const close=value=>{modal.remove();resolve(value);};
      modal.querySelectorAll('[data-reference-delete-cancel]').forEach(button=>button.onclick=()=>close(false));
      modal.querySelector('[data-reference-delete-confirm]').onclick=()=>close(true);
    });
  }  const money=v=>Number(v||0).toLocaleString('vi-VN')+' VND';
  const text=(id,v)=>{const n=document.getElementById(id);if(n)n.textContent=v;};
  // Hien thi ten kem ID tai khoan, fallback ve id noi bo neu chua co accountId.
  const personWithId=id=>{const member=data?.members.find(m=>m.id===id);return member?`${member.name||'Chua dat ten'} - ID: ${member.accountId||member.id}`:'—';};
  const opt=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
  const fieldOptions=id=>(data?.fields.find(f=>f.id===id)?.options||[]);
  function renderDataQueuePagination(table,total){
    const host=table?.closest('.table-responsive')||table?.parentElement;if(!host)return;
    if(!q('#referenceDataPaginationStyles')){const style=document.createElement('style');style.id='referenceDataPaginationStyles';style.textContent='.data-pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:12px 14px;border-top:1px solid var(--border-light);color:var(--text-muted);font-size:11px}.data-pagination-summary{margin-right:auto}.data-pagination-size{display:inline-flex;align-items:center;gap:6px}.data-pagination select{padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-main);font:inherit}.data-pagination-button{display:inline-grid;place-items:center;width:30px;height:30px;border:1px solid var(--border);border-radius:7px;background:var(--bg-surface);color:var(--text-main);font-size:18px;line-height:1;cursor:pointer}.data-pagination-button:hover{background:var(--bg-subtle)}.data-pagination-current{min-width:42px;text-align:center;font-weight:700;color:var(--text-main)}@media(max-width:860px){#tab-data{max-width:100%;overflow-x:hidden}#tab-data #dataSubViewQueue{display:block!important;width:100%;min-width:0!important}#tab-data #dataSubViewQueue>.table-container{width:100%;min-width:0;max-width:100%;overflow:hidden}#tab-data #dataSubViewQueue>.table-container .table-responsive{width:100%;max-width:100%;overflow-x:auto!important;border-radius:8px}#tab-data #dataSubViewQueue>.table-container .modern-table{min-width:720px}.data-pagination{justify-content:flex-start;padding:10px 4px}.data-pagination-summary{width:100%;margin-right:0}.data-pagination-size{margin-right:auto}}';document.head.appendChild(style);}
    let pager=host.nextElementSibling;
    if(!pager?.classList.contains('data-pagination')){pager=document.createElement('div');pager.className='data-pagination';host.parentElement?.insertBefore(pager,host.nextSibling);}
    const rows=Array.from(table.tBodies?.[0]?.rows||[]),pages=Math.max(1,Math.ceil(total/dataQueuePageSize));
    dataQueuePage=Math.min(dataQueuePage,pages);
    const start=(dataQueuePage-1)*dataQueuePageSize;
    rows.forEach((row,index)=>{row.hidden=total>0&&(index<start||index>=start+dataQueuePageSize);});
    if(!total){pager.hidden=true;pager.innerHTML='';return;}
    pager.hidden=false;
    const from=start+1,to=Math.min(start+dataQueuePageSize,total);
    pager.innerHTML='<span class="data-pagination-summary">Hiển thị '+from+'–'+to+' / '+total+' data</span><label class="data-pagination-size">Số dòng <select aria-label="Số data mỗi trang">'+[10,20,50,100,200].map(size=>'<option value="'+size+'" '+(size===dataQueuePageSize?'selected':'')+'>'+size+'</option>').join('')+'</select></label><button type="button" class="data-pagination-button" data-data-page-prev aria-label="Trang trước">‹</button><span class="data-pagination-current">'+dataQueuePage+' / '+pages+'</span><button type="button" class="data-pagination-button" data-data-page-next aria-label="Trang sau">›</button>';
    pager.querySelector('select').onchange=event=>{dataQueuePageSize=Number(event.target.value)||20;dataQueuePage=1;renderDataQueuePagination(table,total);};
    pager.querySelector('[data-data-page-prev]').onclick=()=>{if(dataQueuePage>1){dataQueuePage--;renderDataQueuePagination(table,total);}};
    pager.querySelector('[data-data-page-next]').onclick=()=>{if(dataQueuePage<pages){dataQueuePage++;renderDataQueuePagination(table,total);}};
  }
  const restrictedAdminTabs=new Set(['websites','products','audit','settings','accounting']);
  let roleVisibilityObserver=null;
  function installCustomerJourney(){
    const tab=q('#tab-customers');
    if(!tab||q('#customerJourneyBanner'))return;
    const heading=tab.querySelector('.headline-row');
    const firstTable=tab.querySelector('.table-container');
    if(!heading||!firstTable)return;
    if(!q('#customerJourneyStyles')){
      const style=document.createElement('style');
      style.id='customerJourneyStyles';
      style.textContent='.customer-journey-banner{width:100%;margin:0 0 16px;padding:10px 14px;background:#fff;border:1px solid var(--border,#e2e8f0);border-radius:12px;overflow:hidden;box-sizing:border-box;box-shadow:0 2px 8px rgba(0,0,0,.03)}.customer-journey-banner img{display:block;width:100%;max-width:100%;min-width:0;height:auto;max-height:180px;margin:0 auto;object-fit:contain}@media(max-width:980px){.customer-journey-banner{width:100%;padding:5px;overflow:hidden}.customer-journey-banner img{display:block;width:100%;min-width:0;max-width:100%;height:auto;max-height:none;margin:0}}';
      document.head.appendChild(style);
    }
    const banner=document.createElement('div');
    banner.id='customerJourneyBanner';
    banner.className='customer-journey-banner';
    banner.innerHTML='<img src="./customer-journey.svg?v=20260917-panorama" alt="Hành trình khách hàng NVT Agency">';
    firstTable.before(banner);
  }
  function normalizeAccountingMenu() {
    const accountingLink=q('[data-tab="tab-accounting"]');
    const reportLink=q('[data-tab="tab-businessReport"]');
    if(!accountingLink)return;
    const accountingItem=accountingLink.closest('li'), reportItem=reportLink?.closest('li');
    if(reportItem&&accountingItem?.parentElement&&!accountingItem.parentElement.contains(reportItem))accountingItem.parentElement.appendChild(reportItem);
    const label=accountingLink.querySelector('span');
    if(label)label.textContent='Hoa Hồng nhân viên';
  }
  function applyRoleVisibility() {
    const role=data?.user?.actualRole||data?.user?.role||'';
    const isAdmin=role==='ADMIN';
    const restrictedOperations=['SALE','LEADER','MANAGER'].includes(role);
    const importHistory=q('#customerImportHistory');
    if(importHistory){importHistory.hidden=!isAdmin;importHistory.style.setProperty('display',isAdmin?'':'none','important');}
    const dataFilters=q('#dataQueueFilters');
    if(dataFilters){dataFilters.hidden=restrictedOperations;dataFilters.style.setProperty('display',restrictedOperations?'none':'flex','important');}
    const organizationLabel=qa('.nav-group-title').find(node=>node.textContent.trim()==='TỔ CHỨC');
    if(organizationLabel){
      const hideOrganization=role==='SALE';
      organizationLabel.hidden=hideOrganization;
      organizationLabel.style.setProperty('display',hideOrganization?'none':'','important');
    }
    qa('.nvt-avatar-fallback,.auth-logo-image').forEach(node=>{node.style.setProperty('background-image','url(./logo.jpg?v=20260917-logo)','important');node.style.setProperty('background-size','cover','important');node.style.setProperty('background-position','center','important');node.style.setProperty('background-repeat','no-repeat','important');node.style.setProperty('color','transparent','important');node.style.textIndent='-9999px';});
    document.documentElement.classList.toggle('role-admin',isAdmin);
    document.documentElement.classList.toggle('role-restricted',!isAdmin);
    qa('.brand-avatar').forEach(node=>{node.style.setProperty('background-image',"url('./logo.jpg?v=20260917-logo')",'important');node.style.setProperty('background-size','cover','important');node.style.setProperty('background-position','center','important');node.style.setProperty('color','transparent','important');});
    if(!q('#referenceProfileCompactStyles')){const style=document.createElement('style');style.id='referenceProfileCompactStyles';style.textContent='.profile-modal-card .modal-body{padding:0!important}.profile-modal-card .profile-panel-body{padding:14px 16px 16px!important}.profile-modal-card .profile-hero{gap:12px!important;padding:0 0 12px!important;margin-bottom:12px!important}.profile-modal-card .profile-avatar-large{width:64px!important;height:64px!important;border-radius:12px!important}.profile-modal-card .profile-fields{gap:10px!important}.profile-modal-card .profile-actions{margin-top:12px!important;padding-top:12px!important}.reference-profile-avatar{background-image:url(./logo.jpg?v=20260917-logo)!important;background-size:cover!important;background-position:center!important;color:transparent!important}@media(max-width:560px){.profile-modal-card .profile-panel-body{padding:12px!important}.profile-modal-card .profile-fields{grid-template-columns:1fr!important}.profile-modal-card .profile-hero{align-items:flex-start!important}}';document.head.appendChild(style);}

    // Leader va Manager khong su dung diem danh; an ca nut menu, section va duong dan cu.
    const attendanceAllowed=['ADMIN','SALE'].includes(role);
    qa('.nav-link[data-tab="tab-attendance"],[data-view-link="attendance"],#tab-attendance').forEach(node=>{
      const target=node.matches('#tab-attendance')?node:(node.closest('li')||node);
      target.hidden=!attendanceAllowed;
      target.setAttribute('aria-hidden',String(!attendanceAllowed));
      target.style.setProperty('display',attendanceAllowed?'':'none','important');
    });
    if(!attendanceAllowed&&q('section.active[id="tab-attendance"]')) renders.switchTab('tab-dashboard');

    // Sale khong quan ly doi ngu; an menu va tab doi ngu theo vai tro.
    const teamAllowed=['ADMIN','MANAGER','LEADER'].includes(role);
    qa('.nav-link[data-tab="tab-team"],[data-view-link="team"],#tab-team').forEach(node=>{
      const target=node.matches('#tab-team')?node:(node.closest('li')||node);
      target.hidden=!teamAllowed;
      target.setAttribute('aria-hidden',String(!teamAllowed));
      target.style.setProperty('display',teamAllowed?'':'none','important');
    });
    if(!teamAllowed&&q('section.active[id="tab-team"]')) renders.switchTab('tab-dashboard');

    // Giao diện tham chiếu có thể dựng lại menu sau khi đồng bộ dữ liệu.
    // Ẩn cả nút, thẻ li cha và section để không còn khoảng trống hoặc đường dẫn sót.
    restrictedAdminTabs.forEach(tab=>{
      const selectors=[
        `.nav-link[data-tab="tab-${tab}"]`,
        `[data-view-link="${tab}"]`,
        `#tab-${tab}`
      ];
      qa(selectors.join(',')).forEach(node=>{
        const target=node.matches(`#tab-${tab}`)?node:(node.closest('li')||node);
        if(!isAdmin){
          if(!target.hidden)target.hidden=true;
          if(target.getAttribute('aria-hidden')!=='true')target.setAttribute('aria-hidden','true');
          if(target.style.getPropertyValue('display')!=='none')target.style.setProperty('display','none','important');
        }else{
          if(target.hidden)target.hidden=false;
          if(target.hasAttribute('aria-hidden'))target.removeAttribute('aria-hidden');
          if(target.style.getPropertyValue('display'))target.style.removeProperty('display');
        }
      });
    });

    // Các link Chi tiết trên dashboard cũng không được mở trang Admin-only.
    qa('[onclick*="tab-websites"],[onclick*="tab-products"],[onclick*="tab-audit"],[onclick*="tab-settings"]').forEach(node=>{
      if(!isAdmin){
        if(!node.hidden)node.hidden=true;
        if(node.style.getPropertyValue('display')!=='none')node.style.setProperty('display','none','important');
      }else{
        if(node.hidden)node.hidden=false;
        if(node.style.getPropertyValue('display'))node.style.removeProperty('display');
      }
    });

    const active=q('section.active[id^="tab-"]')?.id?.replace('tab-','');
    if(!isAdmin&&restrictedAdminTabs.has(active)) renders.switchTab('tab-dashboard');

    // Admin xem tong quan data theo pham vi; Sale xem rieng data dang cho nhan.
    const pendingOverview=q('#tab-dashboard .goal-progress-box');
    if(pendingOverview){
      const canViewPendingOverview=isAdmin||role==='SALE';
      pendingOverview.hidden=!canViewPendingOverview;
      pendingOverview.style.setProperty('display',canViewPendingOverview?'':'none','important');
    }
  }
  function installRoleVisibilityObserver(){
    if(roleVisibilityObserver||!document.body)return;
    roleVisibilityObserver=new MutationObserver(()=>{
      if(data)applyRoleVisibility();
    });
    roleVisibilityObserver.observe(document.body,{childList:true,subtree:true});
  }
  function installPendingDataStyles(){
    if(q('#pendingDataStyles'))return;
    const style=document.createElement('style');
    style.id='pendingDataStyles';
    style.textContent=`
      .pending-data-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .pending-data-head>div{display:grid;gap:3px;min-width:0}
      .pending-data-head b{font-size:13.5px;color:var(--text-main)}
      .pending-data-head small{color:var(--text-muted);font-size:11px}
      .pending-data-table-wrap{max-height:340px;overflow:auto;border:1px solid var(--border-light);border-radius:8px}
      .pending-data-table{min-width:820px}
      .pending-data-table td:first-child b,.pending-data-table td:first-child small{display:block}
      .pending-data-table td:first-child small{margin-top:3px;color:var(--text-muted);font-size:10.5px;white-space:nowrap}
      .pending-team-row td{padding:8px 12px!important;background:var(--bg-subtle);color:var(--text-main);border-top:1px solid var(--border)}
      .pending-team-row td b{margin-right:10px}.pending-team-row td span{color:var(--text-muted);font-size:11px}
      .pending-data-empty{display:grid;justify-items:center;gap:4px;padding:24px;color:var(--text-muted);text-align:center}
      .pending-data-empty b{color:var(--text-main)}
      .pending-hierarchy-list{display:grid;gap:7px;padding:8px 0}
      .pending-leader-group{border:1px solid var(--border-light);border-radius:8px;background:var(--bg-card)}
      .pending-leader-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:transparent;padding:12px 14px;text-align:left;color:var(--text-main);cursor:pointer}
      .pending-leader-toggle>span:first-child{display:grid;gap:3px;min-width:0}.pending-leader-toggle b{font-size:12px}.pending-leader-toggle small{color:var(--text-muted);font-size:10.5px}.pending-leader-chevron{font-size:18px;color:var(--text-muted)}
      .pending-leader-detail{padding:0 10px 10px;border-top:1px solid var(--border-light)}
      .pending-sale-group{padding:8px 0;border-bottom:1px solid var(--border-light)}.pending-sale-group:last-child{border-bottom:0}.pending-sale-head{display:flex;justify-content:space-between;padding:3px 4px 6px;color:var(--text-main);font-size:11px}.pending-sale-head span{color:var(--text-muted);font-size:10px}
      .pending-customer-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;border-radius:6px;background:transparent;padding:8px 6px;text-align:left;color:var(--text-main);cursor:pointer}.pending-customer-row:hover{background:var(--bg-subtle)}.pending-customer-row>span:first-child{display:grid;gap:2px;min-width:0}.pending-customer-row small{color:var(--text-muted);font-size:10px}.pending-customer-row .chip{flex:0 0 auto}
      @media(max-width:980px){.pending-data-head{align-items:flex-start}.pending-data-head small{white-space:normal}.pending-data-table-wrap{max-height:360px;margin:0 -4px}.pending-data-table{min-width:760px}}
    `;
    document.head.appendChild(style);
  }
  const person=id=>data?.members.find(m=>m.id===id)?.name||'— Chưa phân Sale —';
  const teamLabel=(teamId,leaderId)=>{const leader=data?.members.find(m=>m.id===leaderId&&m.role==='LEADER');return leader?.name?'Team '+leader.name:(teamId?'Team '+teamId:'Ch\u01b0a ph\u00e2n Team');};
  const teamIdFromName=name=>{const slug=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0110/g,'D').replace(/\u0111/g,'d').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,15);return 'TEAM-'+(slug||Date.now().toString().slice(-6));};
  const internalCode=(value)=>((data?.user?.actualRole||data?.user?.role)==='ADMIN'?value:'Đơn hàng');
  // Chỉ rút gọn mã ở lớp hiển thị; mã đầy đủ trong API/MySQL vẫn được giữ nguyên.
  const shortOrderCode=value=>{const raw=String(value||'').trim();if(!raw)return 'NVT-—';const normalized=raw.replace(/^NVT[-_]?/i,'').replace(/[^a-z0-9]/gi,'');return 'NVT-'+(normalized.slice(-8)||raw.slice(-8));};
  const fmtDate=v=>{const d=String(v||'');const m=d.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);return m?`${m[3]}/${m[2]}/${m[1]}${m[4]}`:d;};
  const fromDay=days=>{const d=new Date(data.today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-days+1);return d.toISOString().slice(0,10);};
  const renders={customers:renderCustomerTable,care:renderCareView,queue:renderDataQueue,orders:renderOrdersTable,drawer:openDrawerForCust,careOpen:openCareGroupModal,careOptions:updateCareGroupOptions,switchTab};
  // Không cho hai lần bấm tạo cùng lúc. Runtime giữ requestId nếu mất phản hồi server.
  async function run(action,done) {
    if(working)return; if(!api||!data)return;
    working=true;
    try { const result=await action(); if(done)done(result); refresh(true); return result; }
    catch(e){window.alert(e.message||'Không lưu được dữ liệu.');refresh(true); return null;}
    finally{working=false;}
  }
  function project() {
    appState={members:data.members,customers:data.customers.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||a.id.localeCompare(b.id)).map(c=>({
      id:c.id,ownerId:c.ownerId||null,saleId:c.saleId||null,leaderId:c.leaderId||null,managerId:c.managerId||null,name:esc(c.name),phone:esc(c.phone),createdAt:fmtDate(c.createdAt),source:esc(data.websites.find(w=>w.id===c.websiteId)?.name||c.landingPageName||c.source||''),leader:esc(person(c.leaderId)),sale:esc(person(c.saleId)),level:esc(fieldOptions('customerLevel').find(o=>o.value===c.customFields?.customerLevel)?.label||c.customFields?.customerLevel||''),customerClass:esc(c.customFields?.customerClass||''),customerLevel:esc(c.customFields?.customerLevel||''),documentStatus:esc(c.customFields?.documentStatus||''),result:esc(c.customFields?.result||''),callStatus:esc(c.customFields?.callStatus||''),docStatus:esc(c.customFields?.documentStatus||''),careResult:esc(c.customFields?.result||''),status:c.status,note:esc(c.note),...Object.fromEntries(data.fields.filter(f=>!['customerClass','customerLevel','callStatus','documentStatus','result'].includes(f.id)).map(f=>[f.id,Array.isArray(c.customFields?.[f.id])?c.customFields[f.id].map(esc):esc(c.customFields?.[f.id]||'')]))
    })),orders:data.orders.map(o=>({id:o.id,code:esc(o.code),customerName:esc(o.customerName),phone:esc(data.customers.find(c=>c.id===o.customerId)?.phone||''),product:esc(o.productName),sale:esc(person(o.saleId)),leader:esc(person(o.leaderId)),total:o.total,status:o.status,rentalExpiry:o.rentalMonths?fmtDate(o.rentalEndsAt):'Vĩnh viễn'})),careGroups:(data.careGroups||[]).map(g=>({...g,name:esc(g.name),field:g.fieldId,values:g.values.map(esc)}))};
    appState.customers.forEach(c=>{const original=data.customers.find(item=>item.id===c.id);data.fields.forEach(f=>{const value=original.customFields?.[f.id];c[f.id]=Array.isArray(value)?value.map(esc):esc(value||'');});});
  }
  // Modal dùng đúng thành phần và màu sắc của giao diện tham chiếu.
  function editor(title, body, onSave) {
    q('#referenceEditor')?.remove();const modal=document.createElement('div');modal.id='referenceEditor';modal.className='modal-overlay open';
    modal.innerHTML=`<form class="modal-card" role="dialog" aria-modal="true" aria-labelledby="refEditorTitle" style="width:min(680px,calc(100vw - 24px));max-height:92dvh;overflow:auto"><div class="modal-header"><h3 id="refEditorTitle">${esc(title)}</h3><button type="button" class="modal-close-btn" data-editor-close aria-label="Đóng">×</button></div><div class="modal-body">${body}<p data-editor-error role="alert" style="color:#dc2626"></p></div><div class="modal-footer"><button type="button" class="btn-action btn-secondary" data-editor-close>Đóng</button>${onSave?'<button class="btn-action btn-primary" type="submit">Lưu</button>':''}</div></form>`;
    document.body.appendChild(modal);modal.querySelectorAll('[data-editor-close]').forEach(n=>n.onclick=()=>{if(!working){modal.remove();refresh(true);}});
    modal.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!onSave||working)return;working=true;const controls=Array.from(e.currentTarget.elements),disabled=controls.map(n=>n.disabled);modal.querySelector('[data-editor-error]').textContent='';
      try{const operation=onSave();controls.forEach(n=>n.disabled=true);await operation;modal.remove();refresh(true);}catch(error){modal.querySelector('[data-editor-error]').textContent=error.message;}finally{working=false;controls.forEach((n,i)=>n.disabled=disabled[i]);}
    };return modal;
  }
  const formField=(label,html)=>`<div class="form-group" style="margin-bottom:14px"><label for="${html.match(/id="([^"]+)"/)?.[1]||''}" style="display:block">${esc(label)}</label>${html}</div>`;
  const validColor=color=>/^#[a-f0-9]{6}$/i.test(color)?color:'#64748b';
  function fieldControl(cell,field,customer) {
    const value=customer.customFields?.[field.id]??'',editable=['ADMIN','LEADER','SALE'].includes(data.user.role);
    const control=document.createElement(field.type==='SELECT'?'select':field.type==='NOTE'?'textarea':field.type==='MULTI_SELECT'?'button':'input');
    control.className='chip';control.style.cssText='width:210px;max-width:210px;padding:5px 8px;border-radius:6px;font:inherit;font-size:11px;font-weight:700;border:1px solid var(--border);';
    const applyOptionColor=next=>{const color=validColor(field.options?.find(o=>o.value===next)?.color);control.style.color=color;control.style.backgroundColor=color+'18';};
    applyOptionColor(value);
    const save=next=>{control.blur();return run(()=>api.updateField(customer.id,field.id,next));};
    if(field.type==='SELECT'){
      const coloredOption=o=>{const color=validColor(o.color);return '<option value="'+esc(o.value)+'" '+(o.value===value?'selected ':'')+'style="color:'+color+';background-color:'+color+'18;font-weight:700">'+esc(o.label)+'</option>';};
      control.innerHTML=opt('','— Chưa chọn —',value)+(field.options||[]).map(coloredOption).join('');
      control.onchange=()=>{applyOptionColor(control.value);return save(control.value);};
    }
    else if(field.type==='MULTI_SELECT'){
      control.type='button';control.textContent=(field.options||[]).filter(o=>[].concat(value).includes(o.value)).map(o=>o.label).join(', ')||'— Chọn —';
      control.onclick=()=>{const modal=editor(field.label,`<div style="display:flex;flex-wrap:wrap;gap:12px">${field.options.map(o=>`<label class="chip" style="color:${validColor(o.color)};background:${validColor(o.color)}18"><input type="checkbox" value="${esc(o.value)}" ${[].concat(value).includes(o.value)?'checked':''}> ${esc(o.label)}</label>`).join('')}</div>`,()=>api.updateField(customer.id,field.id,Array.from(modal.querySelectorAll('input:checked'),n=>n.value)));};
    }else if(field.type==='CHECKBOX'){control.type='checkbox';control.checked=value===true;control.onchange=()=>save(control.checked);}
    else{control.value=value;control.maxLength=field.type==='NOTE'?5000:500;control.onchange=()=>save(control.value);}
    control.disabled=!editable;control.dataset.customerField=field.id;control.setAttribute('aria-label',field.label+' · '+customer.name);cell.replaceChildren(control);
  }
  const baseFields=['customerLevel','customerClass','callStatus','documentStatus','result'];
  function applyCustomerSourceVisibility(){
    const isAdmin=(data?.user?.actualRole||data?.user?.role)==='ADMIN';
    const body=q('#customerTableBody'),head=body?.closest('table')?.querySelector('thead tr');
    if(!body||!head)return;
    const sourceIndex=Array.from(head.cells).findIndex(cell=>/LANDING|NGU\u1ed2N/i.test(cell.textContent||''));
    if(sourceIndex<0)return;
    head.cells[sourceIndex].hidden=!isAdmin;
    Array.from(body.rows).forEach(row=>{if(row.cells[sourceIndex])row.cells[sourceIndex].hidden=!isAdmin;});
  }
  function fillCustomerOptions() {
    const body=q('#customerTableBody'),head=body.closest('table').querySelector('thead tr');
    head.querySelectorAll('[data-extra-field]').forEach(n=>n.remove());
    head.querySelectorAll('[data-reference-amount-column]').forEach(n=>n.remove());
    const fields=data.fields.filter(f=>f.active!==false),extra=fields.filter(f=>!baseFields.includes(f.id)&&f.showInTable);
    const phoneHeader=Array.from(head.cells).find(cell=>cell.textContent.trim()==='SỐ ĐIỆN THOẠI');
    if(phoneHeader)phoneHeader.dataset.phoneColumn='1';
    else{const th=document.createElement('th');th.dataset.phoneColumn='1';th.textContent='SỐ ĐIỆN THOẠI';head.insertBefore(th,head.cells[2]);}
    baseFields.forEach((id,i)=>{const f=fields.find(f=>f.id===id);head.cells[6+i].hidden=!f;if(f)head.cells[6+i].textContent=f.label;});
    extra.forEach(f=>{const th=document.createElement('th');th.dataset.extraField=f.id;th.textContent=f.label;head.insertBefore(th,head.cells[head.cells.length-3]);});
    const referenceHeader=document.createElement('th');
    referenceHeader.dataset.referenceAmountColumn='1';
    referenceHeader.textContent='DỮ LIỆU KHÁCH THAM KHẢO';
    head.insertBefore(referenceHeader,head.lastElementChild);
    Array.from(body.rows).forEach(row=>{
      const code=row.querySelector('button[onclick]')?.getAttribute('onclick'),id=code?.match(/'([^']+)'/)?.[1],c=data.customers.find(c=>c.id===id);
      if(!c){if(row.cells.length===1)row.cells[0].colSpan=head.cells.length;return;}
      row.dataset.customerId=c.id;
      row.querySelectorAll('[data-reference-amount-column]').forEach(n=>n.remove());
      if(!row.dataset.phoneColumnAdded){
        const nameCell=row.cells[1];
        nameCell?.querySelectorAll('div,small').forEach(node=>node.remove());
        const phoneCell=document.createElement('td');
        phoneCell.dataset.phoneColumn='1';
        phoneCell.innerHTML='<span class="customer-phone-cell">'+esc(c.phone||'—')+'</span>';
        row.insertBefore(phoneCell,row.cells[2]);
        row.dataset.phoneColumnAdded='1';
      }
      // Dùng ID để lưu; tên và số điện thoại chỉ dùng để hiển thị.
      const selectOwner=(cell,kind,people,value,editable)=>{
        const select=document.createElement('select');select.className='chip';select.style.cssText='width:210px;max-width:210px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);font:inherit;font-size:11px';
        select.dataset.assignment=kind;select.setAttribute('aria-label',(kind==='leader'?'Team / Leader':'Sale phụ trách')+' · '+c.name);
        select.innerHTML=opt('',kind==='leader'?'\u2014 Ch\u01b0a ch\u1ecdn Leader \u2014':'\u2014 Ch\u01b0a ph\u00e2n Sale \u2014',value)+people.map(m=>{
          const label=m.name+(m.role==='MANAGER'?' (Manager)':kind==='leader'?' - '+(m.teamId||''):m.role==='LEADER'?' (Leader)':'')+(m.phone?' - '+m.phone:'');
          return '<option value="'+esc(m.id)+'" '+(m.id===value?'selected ':'')+'>'+esc(label)+'</option>';
        }).join('');
        select.disabled=!editable;if(kind==='leader')select.options[0].disabled=true;
        select.onchange=()=>{const next=select.value;select.blur();run(()=>kind==='leader'?api.assignLeader(c.id,next):api.assign(c.id,next));};cell.replaceChildren(select);
      };
      const pending=(data.offers||[]).find(o=>o.customerId===c.id&&o.status==='PENDING');
      const staff=data.members.filter(m=>m.active!==false),managers=staff.filter(m=>m.role==='MANAGER'),leaders=staff.filter(m=>m.role==='LEADER');
      const role=data.user.actualRole||data.user.role,currentId=data.user.id,currentLeaderId=data.user.leaderId||currentId;
      const visibleManagers=role==='ADMIN'?managers:role==='MANAGER'?managers.filter(m=>m.id===currentId):[];
      const visibleLeaders=role==='ADMIN'?leaders:role==='MANAGER'?leaders.filter(m=>m.managerId===currentId):leaders.filter(m=>m.id===currentLeaderId);
      const visibleLeaderIds=new Set(visibleLeaders.map(m=>m.id));
      const visibleSales=role==='ADMIN'
        ? staff.filter(m=>m.role==='SALE')
        : role==='MANAGER'
          ? staff.filter(m=>m.role==='SALE'&&(m.managerId===currentId||m.leaderId===currentId||visibleLeaderIds.has(m.leaderId)))
          : staff.filter(m=>m.role==='SALE'&&m.leaderId===currentLeaderId);
      const recipientPool=[...visibleManagers,...visibleLeaders,...visibleSales];
      const assignedMember=staff.find(m=>m.id===c.saleId)||staff.find(m=>m.id===pending?.saleId)||staff.find(m=>m.id===c.managerId)||staff.find(m=>m.id===c.leaderId);
      if(assignedMember&&!recipientPool.some(m=>m.id===assignedMember.id))recipientPool.push(assignedMember);
      const recipients=recipientPool.filter((m,index,list)=>list.findIndex(item=>item.id===m.id)===index).sort((a,b)=>({MANAGER:0,LEADER:1,SALE:2}[a.role]||9)-({MANAGER:0,LEADER:1,SALE:2}[b.role]||9)||String(a.name||'').localeCompare(String(b.name||''),'vi'));
      const assignment=staff.find(m=>m.id===c.saleId)||staff.find(m=>m.id===pending?.saleId);
      const leaderValue=c.leaderId||(assignment?.role==='LEADER'?assignment.id:'')||(!c.leaderId&&assignment?.role==='MANAGER'?assignment.id:'')||(!c.leaderId&&c.managerId&&!c.saleId?c.managerId:'');
      const leaderOptions=[...visibleManagers,...visibleLeaders].filter((m,index,list)=>list.findIndex(item=>item.id===m.id)===index).sort((a,b)=>({MANAGER:0,LEADER:1}[a.role]??9)-({MANAGER:0,LEADER:1}[b.role]??9)||String(a.name||'').localeCompare(String(b.name||''),'vi'));
      const canEditLeader=role==='ADMIN';
      const canEditSale=role==='ADMIN'||role==='MANAGER'&&data.customers.some(item=>item.id===c.id)||role==='LEADER'&&c.teamId===data.user.teamId&&c.leaderId===currentLeaderId;
      selectOwner(row.cells[4],'leader',leaderOptions,leaderValue,canEditLeader);
      selectOwner(row.cells[5],'sale',recipients,c.saleId||pending?.saleId||c.managerId||(!c.saleId&&!c.managerId&&assignment?.role==='LEADER'?assignment.id:''),canEditSale);
      baseFields.forEach((id,i)=>{const f=fields.find(f=>f.id===id);row.cells[6+i].hidden=!f;if(f)fieldControl(row.cells[6+i],f,c);});
      extra.forEach(f=>{const cell=document.createElement('td');row.insertBefore(cell,row.cells[row.cells.length-3]);fieldControl(cell,f,c);});
      const referenceValue=c.referenceAmount??c.customFields?.referenceAmount??c.customFields?.customerReferenceAmount;
      const referenceDigits=String(referenceValue??'').replace(/[^0-9]/g,'');
      const referenceCell=document.createElement('td');
      referenceCell.dataset.referenceAmountColumn='1';
      referenceCell.innerHTML='<span class="customer-reference-amount">'+(referenceDigits?money(Number(referenceDigits)):'—')+'</span>';
      row.insertBefore(referenceCell,row.lastElementChild);
    });
    text('custCountText',body.rows[0]?.cells.length===1?'0 khách':body.rows.length+' khách');
    applyCustomerSourceVisibility();
  }
  if(!q('#referenceCustomerPhoneStyles')){const style=document.createElement('style');style.id='referenceCustomerPhoneStyles';style.textContent='.customer-phone-cell{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--text-main);font-weight:600;font-size:12px}.customer-reference-amount{white-space:nowrap;color:#059669;font-weight:800;font-variant-numeric:tabular-nums}#tab-customers .table-responsive{overflow-x:auto!important;overflow-y:visible!important;position:relative}#tab-customers .customer-data-table,#tab-customers .table-responsive>table{min-width:1420px}#tab-customers .table-responsive>table>thead>tr>th:nth-child(1),#tab-customers .table-responsive>table>tbody>tr>td:nth-child(1){position:sticky;left:0;width:154px;min-width:154px;max-width:154px;background:#fff;z-index:4;box-shadow:1px 0 0 #e2e8f0}#tab-customers .table-responsive>table>thead>tr>th:nth-child(2),#tab-customers .table-responsive>table>tbody>tr>td:nth-child(2){position:sticky;left:154px;width:190px;min-width:190px;max-width:190px;background:#fff;z-index:4;box-shadow:1px 0 0 #e2e8f0}#tab-customers .table-responsive>table>thead>tr>th:nth-child(3),#tab-customers .table-responsive>table>tbody>tr>td:nth-child(3){position:sticky;left:344px;width:142px;min-width:142px;max-width:142px;background:#fff;z-index:4;box-shadow:2px 0 0 #cbd5e1}#tab-customers .table-responsive>table>thead>tr>th:nth-child(-n+3){background:#f1f5f9;z-index:6}#tab-customers .table-responsive>table>tbody>tr:hover>td:nth-child(-n+3){background:#f8fbff}#tab-customers .table-responsive>table>tbody>tr>td:nth-child(-n+3){background:#fff}#tab-customers .table-responsive>table>tbody>tr>td:nth-child(1){font-variant-numeric:tabular-nums;white-space:nowrap}#tab-customers .table-responsive>table>tbody>tr>td:nth-child(2) b{display:block;white-space:normal;overflow-wrap:anywhere}';document.head.appendChild(style);}
  function fieldManager() {
    if(data.user.role!=='ADMIN')return;
    const modal=editor('Quản lý cột khách hàng',`<button type="button" class="btn-action btn-primary" id="refAddField">+ Thêm cột</button><div style="display:grid;gap:12px;margin-top:16px">${data.fields.map(f=>`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid var(--border);border-radius:8px"><b style="flex:1">${esc(f.label)}</b><span class="chip">${f.options?.length||0} lựa chọn</span><button type="button" class="btn-action btn-secondary" data-edit-field="${esc(f.id)}">Sửa</button>${f.id==='customerLevel'?'':`<button type="button" class="btn-action btn-secondary" data-remove-field="${esc(f.id)}">Xóa</button>`}</div>`).join('')}</div>`);
    q('#refAddField').onclick=()=>fieldEditor();modal.querySelectorAll('[data-edit-field]').forEach(n=>n.onclick=()=>fieldEditor(n.dataset.editField));
    modal.querySelectorAll('[data-remove-field]').forEach(n=>n.onclick=()=>{if(confirm('Xóa cột này khỏi hồ sơ khách hàng? Lịch sử thay đổi đã ghi vẫn được giữ.'))run(()=>api.removeField(n.dataset.removeField),()=>{data=api.snapshot();fieldManager();});});
  }
  function fieldEditor(id=null) {
    const f=data.fields.find(item=>item.id===id)||{label:'',type:'SELECT',options:[],notificationWebhookId:''};
    const fieldType=f.type==='NOTIFICATION'?'NOTIFICATION':f.type;
    const notificationWebhooks=(data.websites||[]).filter(website=>website.provider==='NOTIFICATION');
    const modal=editor(id?'Sửa cột khách hàng':'Thêm cột khách hàng',
      formField('Tên cột',`<input id="refFieldLabel" required maxlength="160" value="${esc(f.label)}">`)+
      formField('Kiểu dữ liệu',`<select id="refFieldType" ${id==='customerLevel'?'disabled':''}>${Object.entries({SELECT:'Chọn một',MULTI_SELECT:'Chọn nhiều',TEXT:'Nhập nội dung',NOTE:'Ghi chú',CHECKBOX:'Tích chọn',NOTIFICATION:'Nhận thông báo'}).map(([k,v])=>opt(k,v,fieldType)).join('')}</select>`)+
      formField('Webhook nhận thông báo',`<select id="refFieldNotificationWebhook">${opt('',notificationWebhooks.length?'— Chọn webhook —':'Chưa có webhook Thông Báo',f.notificationWebhookId)+notificationWebhooks.map(website=>opt(website.id,website.name, f.notificationWebhookId)).join('')}</select>`)+
      `<div id="refOptionsArea"><div id="refFieldOptions"></div><button type="button" class="btn-action btn-secondary" id="refAddOption">+ Thêm lựa chọn</button></div>`,
      ()=>api.saveField(id,{label:q('#refFieldLabel').value,type:q('#refFieldType').value,notificationWebhookId:q('#refFieldType').value==='NOTIFICATION'?q('#refFieldNotificationWebhook').value:'',options:qa('#refFieldOptions > div').map(row=>({value:row.dataset.value||row.querySelector('input').value,label:row.querySelector('input').value,color:row.querySelector('input[type=color]').value}))}));
    const add=o=>{const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;margin-bottom:10px';row.dataset.value=o?.value||'';row.innerHTML=`<input aria-label="Tên lựa chọn" required maxlength="200" placeholder="Tên lựa chọn" value="${esc(o?.label||'')}" style="min-width:0;flex:1;padding:9px;border:1px solid var(--border);border-radius:6px"><input aria-label="Màu lựa chọn" type="color" value="${validColor(o?.color)}" style="width:40px;flex-shrink:0"><button type="button" class="btn-action btn-secondary">Xóa</button>`;row.querySelector('button').onclick=()=>row.remove();q('#refFieldOptions').appendChild(row);};
    (f.options||[]).forEach(add);q('#refAddOption').onclick=()=>add();
    const sync=()=>{const type=q('#refFieldType').value,show=['SELECT','MULTI_SELECT'].includes(type),notification=type==='NOTIFICATION',webhookField=q('#refFieldNotificationWebhook')?.closest('.form-group');q('#refOptionsArea').hidden=!show;q('#refOptionsArea').style.display=show?'':'none';qa('#refFieldOptions input').forEach(node=>node.disabled=!show);if(webhookField){webhookField.hidden=!notification;webhookField.style.setProperty('display',notification?'':'none','important');}q('#refFieldNotificationWebhook').required=notification;};
    q('#refFieldType').onchange=sync;sync();
  }
  let editingCareId=null;
  function openCareEditor(id=null) {
    if(data.user.role!=='ADMIN')return;editingCareId=id;
    const group=data.careGroups.find(g=>g.id===id),modal=q('#careGroupModal');
    q('#careGroupFieldSelect').innerHTML=data.fields.filter(f=>f.active!==false&&['SELECT','MULTI_SELECT'].includes(f.type)).map(f=>opt(f.id,f.label,group?.fieldId||'customerClass')).join('');
    q('#careGroupNameInput').value=group?.name||'';modal.querySelector('h3').textContent=id?'Sua muc cham soc':'Tao muc cham soc';
    if(!q('#refCareColor'))q('#careGroupNameInput').parentElement.insertAdjacentHTML('afterend',formField('Mau muc','<input id="refCareColor" type="color" value="#2563eb" style="width:64px;height:36px">'));
    q('#refCareColor').value=validColor(group?.color||'#2563eb');updateCareGroupOptions();qa('.care-value-checkbox').forEach(n=>n.checked=group?.values.includes(n.value)||false);updateCareSelectionSummary();
    modal.style.display='flex';modal.classList.add('open');modal.firstElementChild.style.maxHeight='92dvh';modal.firstElementChild.style.overflowY='auto';q('#careGroupNameInput').focus();
  }
  function careAdminButton(label,title,action,disabled=false,danger=false){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.title=title;button.setAttribute('aria-label',title);button.className='btn-secondary';button.disabled=disabled;
    button.style.cssText='padding:4px 8px;font-size:11px;line-height:1;border-radius:6px;min-width:28px;'+(danger?'color:#b91c1c;border-color:#fecaca;background:#fef2f2;':'');
    button.onclick=event=>{event.preventDefault();event.stopPropagation();action();};return button;
  }
  function reorderCareGroup(id,direction){
    if(data.user.role!=='ADMIN')return;
    const groups=data.careGroups||[],index=groups.findIndex(group=>group.id===id),next=index+(direction==='up'?-1:1);if(index<0||next<0||next>=groups.length)return;
    const ids=groups.map(group=>group.id);[ids[index],ids[next]]=[ids[next],ids[index]];
    run(()=>api.reorderCare(ids),()=>referenceNotice('Đã cập nhật thứ tự mục chăm sóc.'));
  }
  function addCareAdminControls(host,group,index){
    if(data.user.role!=='ADMIN'||host.querySelector('[data-care-admin-controls]'))return;
    const controls=document.createElement('span');controls.dataset.careAdminControls='1';controls.style.cssText='display:inline-flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;';
    controls.append(careAdminButton('↑','Đưa mục lên',()=>reorderCareGroup(group.id,'up'),index===0),careAdminButton('↓','Đưa mục xuống',()=>reorderCareGroup(group.id,'down'),index===data.careGroups.length-1),careAdminButton('Sửa','Sửa mục chăm sóc',()=>openCareEditor(group.id)),careAdminButton('Xóa','Xóa mục chăm sóc',()=>{if(confirm('Xóa mục chăm sóc? Khách hàng vẫn được giữ nguyên.'))run(()=>api.removeCare(group.id),()=>referenceNotice('Đã xóa mục chăm sóc.'));},false,true));
    host.appendChild(controls);
  }
  function decorateCare(){
    qa('#carePanelsContainer > div').slice(4).forEach((panel,i)=>{const group=data.careGroups[i];if(!group)return;const bar=panel.firstElementChild.lastElementChild;addCareAdminControls(bar,group,i);panel.firstElementChild.style.borderLeft='4px solid '+validColor(group.color);});
  }
  const websiteCard=q('#tab-websites input[readonly]')?.closest('.widget-box'),websiteTemplate=websiteCard?.cloneNode(true),websiteContainer=websiteCard?.parentElement;
  function websiteEditor(id=null) {
    if(data.user.role!=='ADMIN')return;const w=data.websites.find(w=>w.id===id)||{name:'',sourceUrl:'',provider:'LANDING_API'};
    editor(id?'Sửa website / landing page':'Thêm website / landing page',formField('Tên tài sản',`<input id="refWebsiteName" required maxlength="200" value="${esc(w.name)}">`)+formField('URL nguồn / Landing page',`<input id="refWebsiteUrl" type="url" required maxlength="500" placeholder="https://www.hoangphucacademy.vn/" value="${esc(w.sourceUrl)}">`)+formField('Nguồn nhận data',`<select id="refWebsiteProvider">${Object.entries({LANDING_API:'Landing API',NOTIFICATION:'Thông Báo'}).map(([k,v])=>opt(k,v,w.provider)).join('')}</select>`),()=>api.saveWebsite(id,{name:q('#refWebsiteName').value,sourceUrl:q('#refWebsiteUrl').value,provider:q('#refWebsiteProvider').value}));
  }
  function pendingSources() {
    const items=data.webhookPending||[];
    const modal=editor('Data chờ quy nguồn',items.length?items.map(r=>'<div data-pending-id="'+esc(r.id)+'" style="padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:12px"><b>'+esc(r.customer?.name||'Chưa có tên')+'</b><p>'+esc(r.customer?.phone||'')+' · '+esc(r.reason||'Chưa gắn nguồn')+'</p><div class="form-group"><select aria-label="Chọn website">'+data.websites.map(w=>opt(w.id,w.name)).join('')+'</select></div><button type="button" class="btn-action btn-primary" style="margin-top:10px">Quy nguồn</button></div>').join(''):'<p>Không có data chờ quy nguồn.</p>');
    modal.querySelectorAll('[data-pending-id]').forEach(row=>row.querySelector('button').onclick=()=>run(()=>api.resolveSource(row.dataset.pendingId,row.querySelector('select').value),()=>{data=api.snapshot();pendingSources();}));
  }
  function websites() {
    if(!websiteContainer||!websiteTemplate)return;websiteContainer.replaceChildren();
    const sourceFilter=q('#funnelLpSelect'),previous=sourceFilter?.value;if(sourceFilter){sourceFilter.innerHTML=opt('all','Tất cả Landing page',previous)+data.websites.map(w=>opt(w.id,w.name,previous)).join('');renderFunnelChart();}
    data.websites.forEach(w=>{const card=websiteTemplate.cloneNode(true),pool=data.customers.filter(c=>c.websiteId===w.id);card.dataset.websiteId=w.id;
      card.querySelector('b').textContent=w.name;const details=card.firstElementChild.firstElementChild.lastElementChild;details.textContent=w.sourceUrl+' · '+w.provider;details.style.overflowWrap='anywhere';
      const chip=card.querySelector('.chip');chip.textContent={UNCONFIGURED:'Chưa cấu hình',PENDING_BACKEND:'Chờ backend',VERIFIED:'Đã xác minh',ERROR:'Lỗi kết nối'}[w.connectionStatus]||'Chưa cấu hình';
      card.children[1].querySelectorAll('b').forEach((n,i)=>n.textContent=i?pool.length:pool.filter(c=>c.createdAt?.slice(0,10)===data.today).length);
      const remove=card.querySelector('button');remove.removeAttribute('onclick');remove.disabled=data.user.role!=='ADMIN';remove.onclick=()=>{if(confirm('Xóa website chưa có dữ liệu này?'))run(()=>api.removeWebsite(w.id));};
      const edit=remove.cloneNode(true);edit.textContent='Sửa website / URL';edit.style.color='var(--text-main)';edit.style.marginRight='8px';edit.onclick=()=>websiteEditor(w.id);remove.before(edit);const config=edit.cloneNode(true);config.textContent='Cấu hình webhook';config.onclick=()=>webhookEditor(w.id);remove.before(config);
      const input=card.querySelector('input');input.value=w.publicWebhookUrl||'';input.onclick=async()=>{input.select();try{await navigator.clipboard.writeText(input.value);}catch{document.execCommand('copy');}};
      websiteContainer.appendChild(card);
    });
    const add=q('#tab-websites .headline-row button');if(add){add.removeAttribute('onclick');add.onclick=()=>websiteEditor();add.disabled=data.user.role!=='ADMIN';}
    qa('#tab-websites button').filter(b=>b.textContent.trim()==='Đồng bộ ngay').forEach(b=>{b.removeAttribute('onclick');b.onclick=()=>run(()=>api.syncWebsites());});
    const banner=q('#tab-websites .widget-box');
    if(banner&&!banner.dataset.websiteId){primaryText(banner.firstElementChild.lastElementChild,data.webhookTransport?.label||'Chưa kết nối');banner.children[1].textContent=data.webhookTransport?.detail||'Chưa có thông tin đồng bộ.';const pendingButton=banner.querySelectorAll('button')[1];if(pendingButton){pendingButton.textContent='Data chờ quy nguồn ('+(data.webhookPending||[]).length+')';pendingButton.onclick=pendingSources;}}
    const total=data.customers.length,newCount=data.customers.filter(c=>!c.saleId).length;
    const kpi=q('#tab-websites .analytics-grid');if(kpi){const chip=kpi.querySelector('.chip');if(chip)chip.textContent='+'+data.customers.filter(c=>c.createdAt?.slice(0,10)===data.today).length+' hôm nay';const waiting=kpi.querySelector('[style*="font-size: 32px"] span');if(waiting)waiting.textContent='/ '+newCount+' chờ Sale';if(kpi.children[1])kpi.children[1].firstElementChild.lastElementChild.textContent='Khách chưa phân Sale';}
    qa('#tab-websites .analytics-grid').at(0)?.querySelectorAll('[style*="font-size: 32px"]').forEach((n,i)=>primaryText(n,String([total,newCount,total-newCount][i])));
  }
  function bindReferenceDeleteButtons() {
    const isAdmin=(data?.user?.actualRole||data?.user?.role)==='ADMIN';
    qa('[data-delete-customer]').forEach(button=>{
      button.hidden=!isAdmin;
      if(!isAdmin)return;
      button.onclick=()=>{
        if(!confirm('Xóa data này? Dữ liệu sẽ được lưu lịch sử và không hiển thị lại.'))return;
        const customer=data?.customers.find(item=>item.id===button.dataset.deleteCustomer),name=customer?.name||'data';
        run(()=>api.deleteCustomer(button.dataset.deleteCustomer),()=>referenceNotice('Đã xóa data '+name+' thành công.'));
      };
    });
  }
  function syncCustomerOwnerFilter(){
    const select=q('#custOwnerFilter');
    if(!select||!data)return;
    const role=data.user?.actualRole||data.user?.role,currentId=data.user.id,all=data.members||[];
    const leaders=role==='ADMIN'?all.filter(m=>m.active!==false&&m.role==='LEADER'):role==='MANAGER'?all.filter(m=>m.active!==false&&m.role==='LEADER'&&m.managerId===currentId):role==='LEADER'?all.filter(m=>m.active!==false&&m.role==='LEADER'&&m.id===currentId):[];
    const leaderIds=new Set(leaders.map(m=>m.id));
    const managers=role==='ADMIN'?all.filter(m=>m.active!==false&&m.role==='MANAGER'):role==='MANAGER'?all.filter(m=>m.active!==false&&m.role==='MANAGER'&&m.id===currentId):[];
    if(role==='MANAGER'&&!managers.some(m=>m.id===currentId)&&data.user?.role==='MANAGER')managers.push({...data.user,role:'MANAGER',active:true});
    const sales=all.filter(m=>m.active!==false&&m.role==='SALE'&&(role==='ADMIN'||role==='MANAGER'&&(m.managerId===currentId||m.leaderId===currentId||leaderIds.has(m.leaderId))||role==='LEADER'&&leaderIds.has(m.leaderId)));
    const previous=select.value;
    const option=(value,label)=>'<option value="'+esc(value)+'">'+esc(label)+'</option>';
    const group=(label,items)=>items.length?'<optgroup label="'+esc(label)+'">'+items.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'vi')).map(m=>option(m.id,(m.name||'Chua dat ten')+' - '+(m.accountId||m.phone||m.id))).join('')+'</optgroup>':'';
    select.innerHTML=option('ALL','Xem theo nhân sự')+group('Manager',managers)+group('Leader',leaders)+group('Sale',sales);
    select.value=[...select.options].some(item=>item.value===previous)?previous:'ALL';
    select.onchange=()=>renderCustomerTable();
  }
  renderCustomerTable=function(){
    if(!data)return;
    // Lưu cả cuộn ngang của bảng và cuộn dọc của trang trước khi thay các dòng.
    const parents=[];for(let node=q('#customerTableBody')?.parentElement;node;node=node.parentElement)parents.push([node,node.scrollLeft,node.scrollTop]);
    syncCustomerOwnerFilter();renders.customers();fillCustomerOptions();dashboard();
    parents.forEach(([node,left,top])=>{node.scrollLeft=left;node.scrollTop=top;});
    bindReferenceDeleteButtons();
  };
  if(!q('#referenceCareCompactStyles')){const style=document.createElement('style');style.id='referenceCareCompactStyles';style.textContent=`
    #tab-care .analytics-grid{grid-template-columns:1fr!important;gap:8px!important;margin-bottom:14px!important;align-items:stretch!important}
    #tab-care .analytics-grid>div{display:grid!important;grid-template-columns:minmax(0,1.6fr) auto minmax(190px,.8fr)!important;align-items:center!important;column-gap:18px!important;min-width:0!important;min-height:68px!important;padding:11px 16px!important;border-radius:9px!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important;box-sizing:border-box!important}
    #tab-care .analytics-grid>div>div:first-child{min-width:0!important;margin:0!important}
    #tab-care .analytics-grid>div>div:nth-child(2){margin:0!important;line-height:1!important}
    #tab-care .analytics-grid>div>div:nth-child(3){margin:0!important;text-align:right!important;white-space:nowrap!important}
    #tab-care .analytics-grid>div>div:first-child>span:first-child{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #tab-care .analytics-grid>div:hover{transform:translateY(-1px);box-shadow:0 7px 16px rgba(15,23,42,.08)!important}
    #carePanelsContainer{gap:9px!important}
    #carePanelsContainer>[data-care-group][hidden]{display:none!important}
    #carePanelsContainer>[data-care-group] [data-care-list][hidden]{display:none!important}
    #carePanelsContainer>[data-care-group] [data-care-toggle]{transition:background .15s ease,border-color .15s ease}
    #carePanelsContainer>[data-care-group] [data-care-toggle]:hover{background:#f8fbff!important}
    #carePanelsContainer>[data-care-group].is-open{border-color:#93c5fd!important;box-shadow:0 5px 16px rgba(37,99,235,.08)!important}
    #carePanelsContainer>[data-care-group].is-open [data-care-toggle]{background:#eff6ff!important;border-bottom-color:#bfdbfe!important}
    #carePanelsContainer>[data-care-group] [data-care-chevron]{transition:transform .15s ease,background .15s ease}
    #carePanelsContainer>[data-care-group].is-open [data-care-chevron]{transform:rotate(180deg);background:#dbeafe;color:#1d4ed8!important}
    @media(max-width:640px){#tab-care .analytics-grid>div{grid-template-columns:minmax(0,1fr) auto!important;column-gap:10px!important;min-height:62px!important;padding:10px 12px!important}#tab-care .analytics-grid>div>div:nth-child(3){grid-column:1/-1;text-align:left!important;white-space:normal!important;font-size:10.5px!important;margin-top:-2px!important}}
  `;document.head.appendChild(style);}
  function renderCustomCareCards(){
    const grid=q('#tab-care .analytics-grid');if(!grid||!data)return;qa('[data-custom-care-card]').forEach(card=>card.remove());
    const groups=data.careGroups||[];groups.forEach((group,index)=>{
      const list=data.customers.filter(customer=>{const values=customer.customFields?.[group.fieldId];return [].concat(values||'').some(value=>(group.values||[]).includes(value));});
      const card=document.createElement('div');card.dataset.customCareCard='1';card.dataset.careGroup=group.id;card.style.cssText='background:var(--bg-surface);border:1px solid var(--border);border-top:3px solid '+validColor(group.color||'#64748b')+';border-radius:10px;padding:16px 18px;box-shadow:var(--shadow-sm);cursor:pointer;';
      card.innerHTML='<div data-care-card-head style="display:flex;align-items:flex-start;gap:8px"><span style="font-size:13px;font-weight:600;color:var(--text-main);min-width:0"></span><span style="color:'+validColor(group.color||'#64748b')+';font-size:15px">●</span></div><div style="font-size:30px;font-weight:800;font-family:var(--font-mono);color:var(--text-main);margin:6px 0 2px"></div><div style="font-size:11px;color:var(--text-muted)"></div>';
      card.querySelector('span').textContent=group.name||'Mục chăm sóc';card.querySelectorAll('div')[1].textContent=String(list.length);card.querySelectorAll('div')[2].textContent='Phân loại: '+(group.values||[]).join(', ');
      addCareAdminControls(card.querySelector('[data-care-card-head]'),group,index);grid.appendChild(card);
    });
  }
  function mountInlineCareLists(){
    const grid=q('#tab-care .analytics-grid'),container=q('#carePanelsContainer');
    if(!grid||!container)return;
    qa('[data-care-inline-list]').forEach(list=>list.remove());
    const defaultKeys=['g-conv','g-hot','g-warm','g-cold'];
    qa('#tab-care .analytics-grid>div').forEach((card,index)=>{if(!card.dataset.careGroup&&defaultKeys[index])card.dataset.careGroup=defaultKeys[index];});
    const panels=new Map(qa('#carePanelsContainer>[data-care-group]').map(panel=>[panel.dataset.careGroup,panel]));
    qa('#carePanelsContainer>[data-care-group]').forEach(panel=>{panel.hidden=true;});
    qa('#tab-care .analytics-grid>div[data-care-group]').forEach(card=>{
      const key=card.dataset.careGroup,panel=panels.get(key),list=panel?.querySelector('[data-care-list]');
      if(!list)return;
      card.onclick=event=>{if(event.target.closest('[data-care-inline-list]'))return;window.filterCareGroup(key);};
      if(careKey===key){
        list.hidden=false;
        list.dataset.careInlineList='1';
        list.style.cssText='display:block;border-top:1px solid #dbe4ee;background:#fff;padding:0;margin:12px -16px -11px;';
        card.appendChild(list);
        card.classList.add('is-care-open');
      }else card.classList.remove('is-care-open');
    });
  }
  renderCareView=function(){if(!data)return;renders.care();renderCustomCareCards();decorateCare();const panels=qa('#carePanelsContainer > [data-care-group]');panels.forEach(panel=>{const key=panel.dataset.careGroup,open=Boolean(careKey&&key===careKey);panel.hidden=!open;panel.classList.toggle('is-open',open);const toggle=panel.querySelector('[data-care-toggle]');const list=panel.querySelector('[data-care-list]');if(toggle)toggle.setAttribute('aria-expanded',String(open));if(list)list.hidden=!open;});mountInlineCareLists();};
  window.filterCareGroup=function(key){
    const raw=String(key||'').trim();
    const aliases={converted:'g-conv',conversion:'g-conv',conv:'g-conv',hot:'g-hot',warm:'g-warm',cold:'g-cold'};
    const normalized=aliases[raw]||(raw.startsWith('g-')?raw:'g-'+raw);
    careKey=careKey===normalized?'':normalized;
    renderCareView();
  };
  function dashboard() {
    const total=data.customers.length,connected=data.customers.filter(c=>!['NEW','LOST'].includes(c.status)).length;
    const today=data.customers.filter(c=>c.createdAt?.slice(0,10)===data.today).length;
    const revenue=data.financialEvents.reduce((sum,e)=>sum+Number(e.amount||0),0);
    const rentals=data.orders.filter(o=>o.status==='PAID'&&o.rentalMonths&&o.rentalEndsAt?.slice(0,10)>=data.today);
    text('dashTotalCust',total);text('dashCustConnected',`${connected} (${total?(connected/total*100).toFixed(1):0}%)`);text('dashCustPending',`${total-connected} (${total?((total-connected)/total*100).toFixed(1):0}%)`);
    text('dashNewCustToday',today);text('dashCustTodayFoot','+'+today+' má»›i');text('dashCustWeekFoot',data.customers.filter(c=>c.createdAt?.slice(0,10)>=fromDay(7)).length+' data');text('dashPaidRevenue',money(revenue));text('dashFirstBuyCust',rentals.length);
    if(q('#meterTotalCust'))q('#meterTotalCust').style.width=(total?connected/total*100:0)+'%';
  }

  function primaryText(node,value){if(!node)return;const first=Array.from(node.childNodes).find(n=>n.nodeType===3&&n.textContent.trim());if(first)first.textContent=value;else node.textContent=value;}
  function dashboardExtras(){
    const paid=data.orders.filter(o=>o.status==='PAID'),rentals=paid.filter(o=>o.rentalMonths&&o.rentalEndsAt?.slice(0,10)>=data.today);
    const cards=qa('#tab-dashboard .kpi-bento-card');
    const setFoot=(i,values)=>cards[i]?.querySelectorAll('.kpi-foot-stat .value').forEach((n,k)=>n.textContent=values[k]||'0');
    setFoot(2,[paid.length+' đã chốt',money(paid.reduce((s,o)=>s+Number(o.vatAmount||0),0))]);
    setFoot(3,[rentals.length+' gói',rentals.filter(o=>(Date.parse(o.rentalEndsAt)-Date.parse(data.today))/86400000<=2).length+' gói']);
    const month=data.today.slice(0,7),revenue=data.financialEvents.filter(e=>e.occurredAt?.startsWith(month)).reduce((s,e)=>s+Number(e.amount||0),0);
    const goal=q('#tab-dashboard .goal-progress-box');
    // Bảng điều hành data chỉ dành cho tuyến quản lý và luôn giới hạn đúng phạm vi.
    if(goal){
      const role=String(data.user.actualRole||data.user.role||'').toUpperCase();
      goal.hidden=!['ADMIN','SALE'].includes(role);
      if(goal.hidden)goal.style.setProperty('display','none','important');
      else goal.style.removeProperty('display');
      if(role==='SALE'){
        goal.classList.add('sale-dashboard-panel');
        const safeOffers=data.pendingOffers||[],fallbackOffers=safeOffers.length?safeOffers:(data.offers||[]).filter(offer=>offer.status==='PENDING'&&offer.saleId===data.user.id).map(offer=>({id:offer.id,name:(data.customers||[]).find(customer=>customer.id===offer.customerId)?.name||'Chưa có tên',offeredAt:offer.offeredAt,minutesLeft:Math.max(0,1440-Math.floor((Date.now()-Date.parse(String(offer.offeredAt||'').replace(' ','T')))/60000))}));
        const items=fallbackOffers.slice().sort((a,b)=>String(a.offeredAt||'').localeCompare(String(b.offeredAt||'')));
        const body=items.map((offer,index)=>{
          const minutes=Math.max(0,Number(offer.minutesLeft)||0);
          const countdown=Math.floor(minutes/60)+' giờ '+(minutes%60)+' phút';
          return '<tr><td><b>#'+(index+1)+'</b></td><td><b>'+esc(fmtDate(String(offer.offeredAt||'').slice(0,10)))+'</b><small>'+esc(String(offer.offeredAt||'').slice(11,16))+'</small></td><td><b>'+esc(offer.name||'Chưa có tên')+'</b></td><td><span class="sale-dashboard-countdown">'+esc(countdown)+'</span></td><td><button type="button" class="btn-action sale-dashboard-accept" data-dashboard-accept-offer="'+esc(offer.id)+'">Nhận data</button></td></tr>';
        }).join('');
        goal.innerHTML='<div class="pending-data-head"><div><b>Data chưa nhận</b><small>Data được phân cho bạn đang chờ xác nhận</small></div><span class="chip">'+items.length+' data</span></div><div class="table-responsive pending-data-table-wrap"><table class="modern-table sale-dashboard-table"><thead><tr><th>THỨ TỰ</th><th>NGÀY DATA</th><th>KHÁCH HÀNG</th><th>THỜI GIAN NHẬN</th><th>THAO TÁC</th></tr></thead><tbody>'+(body||'<tr><td colspan="5"><div class="pending-data-empty"><b>Không có data chờ nhận</b><span>Data mới được phân sẽ hiển thị tại đây.</span></div></td></tr>')+'</tbody></table></div>';
        if(!q('#saleDashboardAcceptStyles')){
          const style=document.createElement('style');style.id='saleDashboardAcceptStyles';style.textContent='.sale-dashboard-panel{border-color:#fed7aa!important;box-shadow:0 4px 14px rgba(234,88,12,.12)!important}.sale-dashboard-panel .pending-data-head b{color:#c2410c}.sale-dashboard-table{min-width:760px}.sale-dashboard-table td:nth-child(2) small{display:block;margin-top:3px;color:var(--text-muted);font-size:10.5px;white-space:nowrap}.sale-dashboard-countdown{display:inline-flex;align-items:center;min-height:28px;padding:5px 10px;border-radius:7px;background:#fff7ed;color:#c2410c;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}.sale-dashboard-accept{justify-content:center;background:#059669;color:#fff;border:1px solid #059669;box-shadow:0 3px 10px rgba(5,150,105,.2)}.sale-dashboard-accept:hover{background:#047857;border-color:#047857}.sale-dashboard-accept:disabled{opacity:.6;cursor:wait}';document.head.appendChild(style);
        }
        goal.querySelectorAll('[data-dashboard-accept-offer]').forEach(button=>button.onclick=async()=>{button.disabled=true;await run(()=>api.acceptOffer(button.dataset.dashboardAcceptOffer));});
      }else if(!goal.hidden){
        goal.classList.remove('sale-dashboard-panel');
        const allCustomers=data.managerHierarchy?.customers||data.customers;
        const assignedLeaderIds=role==='MANAGER'
          ? new Set((data.managerHierarchy?.members||[]).filter(m=>m.role==='LEADER'&&m.active!==false&&m.managerId===data.user.id).map(m=>m.id))
          : null;
        const source=role==='MANAGER'
          ? allCustomers.filter(c=>assignedLeaderIds.has(c.leaderId))
          : data.customers;
        const pendingOffers=(data.offers||[]).filter(o=>o.status==='PENDING');
        const rows=source.filter(c=>{
          if(['ARCHIVED','LOST','PAID'].includes(c.status))return false;
          const hasPendingOffer=pendingOffers.some(o=>o.customerId===c.id);
          return !c.leaderId||!c.saleId||!c.saleAcceptedAt||hasPendingOffer||c.status==='NEW';
        }).sort((a,b)=>String(a.teamId||'').localeCompare(String(b.teamId||''),'vi')||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||a.id.localeCompare(b.id));
        const groupKey=c=>c.teamId||'Chưa phân Team';
        const teams=[...new Set(rows.map(groupKey))];
        const scopeLabel=role==='ADMIN'?'Toàn hệ thống':role==='MANAGER'?'Các Team được Admin giao':`Team ${data.user.teamId||''}`;
        const body=teams.map(team=>{
          const teamRows=rows.filter(c=>groupKey(c)===team);
          const groupHeader=(role==='ADMIN'||role==='MANAGER')?'<tr class="pending-team-row"><td colspan="6"><b>'+esc(team)+'</b><span>'+teamRows.length+' data chưa xử lý</span></td></tr>':'';
          return groupHeader+teamRows.map(c=>{
            const offer=pendingOffers.find(o=>o.customerId===c.id),saleId=c.saleId||offer?.saleId;
            const state=!c.leaderId?'Chưa phân Team / Leader':offer?'Chờ Sale nhận':!c.saleId?'Chưa phân Sale':!c.saleAcceptedAt?'Chờ nhận data':'Chưa cập nhật xử lý';
            return '<tr><td><b>'+esc(c.name)+'</b><small>'+esc(fmtDate(c.createdAt))+'</small></td><td>'+esc(groupKey(c))+'</td><td>'+esc(c.leaderId?person(c.leaderId):'Chưa phân Leader')+'</td><td>'+esc(saleId?person(saleId):'Chưa phân Sale')+'</td><td><span class="chip chip-warm">'+esc(state)+'</span></td><td><button class="btn-action btn-secondary" data-pending-customer="'+esc(c.id)+'">Xem</button></td></tr>';
          }).join('');
        }).join('');
        goal.innerHTML='<div class="pending-data-head"><div><b>Data chưa xử lý</b><small>'+esc(scopeLabel)+' · theo Team và người phụ trách</small></div><span class="chip">'+rows.length+' khách</span></div><div class="table-responsive pending-data-table-wrap"><table class="modern-table pending-data-table"><thead><tr><th>Khách hàng</th><th>Team</th><th>Leader</th><th>Sale phụ trách</th><th>Tình trạng</th><th></th></tr></thead><tbody id="pendingDataBody">'+(body||'<tr><td colspan="6"><div class="pending-data-empty"><b>Không có data chưa xử lý</b><span>Tất cả khách trong phạm vi đã được tiếp nhận hoặc hoàn tất.</span></div></td></tr>')+'</tbody></table></div>';
        renderPendingHierarchyV2(goal, source, rows, pendingOffers);
        goal.querySelectorAll('.pending-root-toggle b').forEach(label=>{const value=label.textContent.trim();if(value.startsWith('Manager: '))label.textContent='Team '+value.slice(9)+' (manager)';else if(value.startsWith('Team ')&&!value.endsWith('(leader)'))label.textContent=value+' (leader)';});
      }
    }
    const roleForDashboard=data.user.actualRole||data.user.role;
    const landingTable=q('#recentOrdersOverview')||qa('#tab-dashboard .table-container').find(node=>/Hi[^<]*Landing Page/i.test(node.textContent||''));
    if(landingTable){
      landingTable.id='recentOrdersOverview';
      landingTable.classList.add('recent-orders-overview');
      landingTable.hidden=roleForDashboard!=='ADMIN';landingTable.style.setProperty('display',roleForDashboard==='ADMIN'?'':'none','important');
      const head=landingTable.querySelector('.table-head-bar');
      const title=head?.querySelector('b');if(title)title.textContent='Các đơn hàng gần đây';
      const subtitle=head?.querySelector('div > div');if(subtitle)subtitle.textContent='10 đơn mới nhất lấy trực tiếp từ mục Đơn hàng.';
      const action=head?.querySelector('button');if(action){action.textContent='Xem tất cả đơn hàng';action.removeAttribute('onclick');action.onclick=()=>renders.switchTab('tab-orders');}
      const table=landingTable.querySelector('table'),body=table?.querySelector('tbody');
      if(table){
        table.classList.remove('landing-performance-table');
        table.classList.add('recent-orders-table');
        const row=table.querySelector('thead tr');
        if(row)row.innerHTML='<th>MÃ ĐƠN</th><th>PHÂN LOẠI</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM / DỊCH VỤ</th><th>GÓI / THỜI HẠN</th><th>SALE PHỤ TRÁCH</th><th>DOANH THU</th><th>VAT</th><th>THỰC THU</th><th>TRẠNG THÁI</th>';
      }
      const orders=(data.orders||[]).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||String(b.id||'').localeCompare(String(a.id||''))).slice(0,10);
      if(body){
        const statusLabel={PAID:'Đã thanh toán',COURSE_GRANTED:'Đã cấp khóa học',DEPOSIT:'Đã đặt cọc',PENDING:'Chờ thanh toán',REFUNDED:'Đã hoàn tiền',CANCELLED:'Đã hủy'};
        const statusClass={PAID:'chip-green',COURSE_GRANTED:'chip-green',DEPOSIT:'chip-warm',PENDING:'chip-orange',REFUNDED:'chip-cold',CANCELLED:'chip-cold'};
        body.innerHTML=orders.map(order=>{
          const customer=(data.customers||[]).find(item=>item.id===order.customerId);
          const product=(data.products||[]).find(item=>item.id===order.productId);
          const sale=(data.members||[]).find(item=>item.id===order.saleId);
          const isRental=Boolean(order.rentalMonths)||product?.type==='RENTAL';
          const classification=isRental?'CHO THUÊ CHỈ BÁO':'BÊN BÁN';
          const term=order.rentalMonths?`${order.rentalMonths} tháng${order.rentalEndsAt?' · đến '+fmtDate(order.rentalEndsAt):''}`:'Vĩnh viễn';
          const revenue=Number(order.subtotal??order.total??0);
          const vat=Number(order.vatAmount??0);
          const totalAmount=Math.max(0,Number(order.total||0)),paid=Number(order.amountPaid),subtotalAmount=Math.max(0,Number(order.subtotal||0)),vatAmountForReceipt=Math.max(0,Number(order.vatAmount||0)); const grossCollected=order.status==='DEPOSIT'?Math.min(totalAmount,Math.max(0,Number(order.depositAmount||0))):Number.isFinite(paid)&&paid>0?Math.min(totalAmount,paid+(['PAID','COURSE_GRANTED','REFUNDED'].includes(order.status)&&!order.depositAt&&subtotalAmount>0&&paid<subtotalAmount?vatAmountForReceipt:0)):['PAID','COURSE_GRANTED','REFUNDED'].includes(order.status)?Math.min(totalAmount,Math.max(0,Number(order.refund||0))||totalAmount):0; const received=Math.max(0,grossCollected-Math.max(0,Number(order.refund||0)));
           const status=['PAID','COURSE_GRANTED'].includes(order.status)?'Thanh toán đủ':'Thanh toán 50%';
          return '<tr><td><b class="recent-order-code">'+esc(order.code||order.id||'—')+'</b></td><td><span class="chip '+(isRental?'chip-warm':'chip-orange')+'">'+classification+'</span></td><td><b>'+esc(order.customerName||customer?.name||'—')+'</b><div class="recent-order-sub">'+esc(customer?.phone||'')+'</div></td><td><b>'+esc(order.productName||product?.name||'—')+'</b><div class="recent-order-sub">'+esc(order.sku||product?.sku||'')+'</div></td><td><span class="chip chip-warm">'+esc(term)+'</span></td><td>'+esc(sale?.name||'Chưa phân Sale')+'</td><td><b class="recent-order-money">'+money(revenue)+'</b></td><td><b class="recent-order-vat">'+money(vat)+'</b></td><td><b class="recent-order-received">'+money(received)+'</b></td><td><span class="chip '+(statusClass[order.status]||'chip-cold')+'">'+esc(status)+'</span></td></tr>';
        }).join('')||'<tr><td colspan="10"><div class="pending-data-empty"><b>Chưa có đơn hàng</b><span>Đơn mới sẽ xuất hiện tại đây sau khi được tạo trong mục Đơn hàng.</span></div></td></tr>';
      }
      const recentHead=table.querySelector('thead tr');
      if(recentHead&&!recentHead.querySelector('[data-order-phone-column]')){
        const customerHeader=Array.from(recentHead.cells).find(cell=>/KHÁCH HÀNG|KHÁCH HÀNG/i.test(cell.textContent||''));
        if(customerHeader){const phoneHeader=document.createElement('th');phoneHeader.dataset.orderPhoneColumn='1';phoneHeader.textContent='SĐT KH';customerHeader.after(phoneHeader);}
      }
      Array.from(body.rows).forEach((row,index)=>{
        const order=orders[index];
        if(!order||row.querySelector('[data-order-phone-cell]'))return;
        const customer=(data.customers||[]).find(item=>item.id===order.customerId);
        const code=row.cells[0]?.querySelector('.recent-order-code');
        if(code)code.textContent=shortOrderCode(order.code||order.id);
        const customerCell=row.cells[2];
        if(customerCell){const phoneCell=document.createElement('td');phoneCell.dataset.orderPhoneCell='1';phoneCell.textContent=customer?.phone||'—';customerCell.querySelector('.recent-order-sub')?.remove();customerCell.after(phoneCell);}
      });
      const recentEmpty=body.querySelector('tr td[colspan]');
      if(recentEmpty)recentEmpty.colSpan=11;
      if(!q('#recentOrdersStyles')){const style=document.createElement('style');style.id='recentOrdersStyles';style.textContent='.recent-orders-overview{overflow:hidden}.recent-orders-table{min-width:1420px}.recent-orders-table th,.recent-orders-table td{white-space:nowrap;vertical-align:middle}.recent-order-code{font:700 11px var(--font-mono);color:#2563eb}.recent-order-money,.recent-order-vat,.recent-order-received{font:800 12px var(--font-mono)}.recent-order-money{color:#0f172a}.recent-order-vat{color:#d97706}.recent-order-received{color:#059669}.recent-order-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px}.recent-orders-overview .table-responsive{overflow-x:auto}@media(max-width:980px){.recent-orders-table{min-width:1420px}}';document.head.appendChild(style)}
    }
    const charts=qa('#tab-dashboard .chart-panel');
    const days=Array.from({length:7},(_,i)=>fromDay(7-i));
    charts[0]?.querySelectorAll('.chart-svg-container + div span').forEach((node,i)=>node.textContent=new Date(days[i]+'T00:00:00Z').toLocaleDateString('vi-VN',{weekday:'short',timeZone:'UTC'})+(i===6?' (Hôm nay)':''));charts[1]?.querySelectorAll('.chart-svg-container + div span').forEach((node,i)=>node.textContent='Kỳ '+(i+1));
    const counts=days.map(day=>data.customers.filter(c=>c.createdAt?.slice(0,10)===day).length);
    primaryText(charts[0]?.querySelector('.chart-metric-num'),counts.reduce((a,b)=>a+b,0)+' ');
    primaryText(charts[1]?.querySelector('.chart-metric-num'),money(revenue)+' ');
    charts.forEach(c=>c.querySelectorAll('.metric-growth').forEach(n=>n.textContent=''));
    const svg=charts[0]?.querySelector('.chart-svg-container svg');
    if(svg){const max=Math.max(1,...counts),points=counts.map((n,i)=>[20+i*460/6,190-n/max*160]);const path=points.map(([x,y],i)=>(i?'L':'M')+' '+x+' '+y).join(' ');const paths=svg.querySelectorAll('path');paths[0]?.setAttribute('d',path+' L 480 190 L 20 190 Z');paths[1]?.setAttribute('d',path);svg.querySelectorAll('circle').forEach((n,i)=>{const p=points[Math.min(6,i*2)];n.setAttribute('cx',p[0]);n.setAttribute('cy',p[1]);});svg.querySelectorAll('text').forEach((n,i)=>{const idx=Math.min(6,i*2);n.textContent=counts[idx];n.setAttribute('x',points[idx][0]);n.setAttribute('y',points[idx][1]-10);});}
    const bars=charts[1]?.querySelectorAll('svg g rect')||[];
    const series=Array.from(bars,(_,i)=>data.financialEvents.filter(e=>e.occurredAt?.slice(0,10)>=fromDay((bars.length-i)*3)&&e.occurredAt?.slice(0,10)<=(i===bars.length-1?data.today:fromDay((bars.length-i-1)*3+1))).reduce((sum,e)=>sum+Number(e.amount||0),0));
    const max=Math.max(1,...series);bars.forEach((n,i)=>{const height=Math.max(0,series[i]/max*150);n.setAttribute('height',height);n.setAttribute('y',180-height);});charts[1]?.querySelectorAll('svg g text').forEach((n,i)=>{n.textContent=(series[i]/1e6).toFixed(1)+'Tr';n.setAttribute('y',170-Math.max(0,series[i]/max*150));});
    const ranked=data.products.map(p=>({...p,count:paid.filter(o=>o.productId===p.id).length})).sort((a,b)=>b.count-a.count);
    qa('#tab-dashboard .product-item').forEach((node,i)=>{const p=ranked[i];node.querySelector('.product-name').textContent=p?.name||'Chưa có sản phẩm';node.querySelector('.product-sku').textContent=p?p.sku+' · '+money(p.price)+' ('+p.count+' đơn)':'—';});
    const rentBox=q('#tab-dashboard .side-widgets-column .widget-box:last-child');
    if(rentBox){const upcoming=rentals.filter(o=>(Date.parse(o.rentalEndsAt)-Date.parse(data.today))/86400000<=7);rentBox.querySelector('.widget-box-head span:last-child').textContent=upcoming.length+' Gói';Array.from(rentBox.children[1]?.children||[]).forEach((row,i)=>{const o=upcoming[i];row.querySelector('b').textContent=o?.customerName||'Chưa có gói cần gia hạn';row.querySelector('b + div').textContent=o?.productName||'—';row.querySelector('span').textContent=o?fmtDate(o.rentalEndsAt):'—';});}
    const todayNewCustomers=data.customers.filter(c=>c.createdAt?.slice(0,10)===data.today);
    const monthOrders=paid.filter(o=>String(o.paidAt||o.createdAt||'').slice(0,7)===data.today.slice(0,7));
    const customerById=new Map(data.customers.map(c=>[c.id,c]));
    const productCountByAge=monthOrders.reduce((sum,o)=>{const c=customerById.get(o.customerId);const created=Date.parse(String(c?.createdAt||'').replace(' ','T'));const at=Date.parse(String(o.paidAt||o.createdAt||'').replace(' ','T'));const ageDays=Number.isFinite(created)&&Number.isFinite(at)?Math.floor((at-created)/86400000):31;const qty=Math.max(1,Number(o.qty||1));if(ageDays<30)sum.new+=qty;else sum.old+=qty;return sum;},{new:0,old:0});
    const subCards=qa('#tab-dashboard .sub-grid-2 .chart-panel');
    if(subCards[0]){const title=subCards[0].querySelector('.chart-metric-title');if(title)title.textContent='Số lượng khách hàng mới hôm nay';primaryText(subCards[0].querySelector('.chart-metric-num'),todayNewCustomers.length+' khách');subCards[0].querySelector('.chart-detail-link')?.remove();}
    if(subCards[1]){const title=subCards[1].querySelector('.chart-metric-title');if(title)title.textContent='Số lượng sản phẩm theo loại khách hàng';primaryText(subCards[1].querySelector('.chart-metric-num'),(productCountByAge.new+productCountByAge.old)+' sản phẩm');const detail=subCards[1].querySelector('.chart-detail-link');if(detail)detail.textContent='Reset ngày 1 hàng tháng';const note=subCards[1].querySelector('div[style*="display: flex"]');if(note)note.textContent=productCountByAge.old+' sản phẩm khách cũ · '+productCountByAge.new+' sản phẩm khách mới';const bar=subCards[1].querySelector('.segment-bar');if(bar){const total=productCountByAge.new+productCountByAge.old;const oldPart=bar.children[0],newPart=bar.children[1];if(oldPart)oldPart.style.width=(total?productCountByAge.old/total*100:0)+'%';if(newPart){newPart.style.width=(total?productCountByAge.new/total*100:0)+'%';newPart.style.background='#f97316';}}}
    qa('#tab-dashboard .sub-grid-2 b').forEach(n=>{if(/^\d/.test(n.textContent))n.textContent='—';});
  }

  // Cây data theo đúng cấp: Manager -> Leader -> Sale. Leader chưa có Manager
  // được hiển thị cùng cấp Manager dưới tên Team của chính Leader.
  function renderPendingHierarchyV2(goal, source, rows, pendingOffers) {
    const members=data.members.filter(m=>m.active!==false),byId=id=>members.find(m=>m.id===id),stateFor=c=>pendingOffers.some(o=>o.customerId===c.id)?'Chờ Sale nhận':!c.leaderId?'Chưa phân Leader':!c.saleId?'Chưa phân Sale':!c.saleAcceptedAt?'Chờ nhận data':'Chưa cập nhật xử lý';
    const rowsForLeader=leader=>rows.filter(c=>c.leaderId===leader?.id);
    const saleGroups=leaderRows=>[...new Set(leaderRows.map(c=>c.saleId||pendingOffers.find(o=>o.customerId===c.id)?.saleId||'UNASSIGNED'))].map(id=>({id,sale:byId(id),rows:leaderRows.filter(c=>(c.saleId||pendingOffers.find(o=>o.customerId===c.id)?.saleId||'UNASSIGNED')===id)}));
    const salesMarkup=leaderRows=>saleGroups(leaderRows).map(group=>'<div class="pending-sale-group"><div class="pending-sale-head"><b>'+esc(group.sale?.name||'Chưa phân Sale')+'</b><span>'+group.rows.length+' khách</span></div>'+group.rows.map(c=>'<button type="button" class="pending-customer-row" data-pending-customer="'+esc(c.id)+'"><span><b>'+esc(c.name)+'</b><small>'+esc(fmtDate(c.createdAt))+'</small></span><span class="chip chip-warm">'+esc(stateFor(c))+'</span></button>').join('')+'</div>').join('')||'<div class="pending-data-empty">Chưa có Sale hoặc khách trong nhóm</div>';
    const leaderMarkup=leader=>{const leaderRows=rowsForLeader(leader);return '<div class="pending-nested-leader"><button type="button" class="pending-leader-toggle" data-pending-leader-v2="'+esc(leader.id)+'" aria-expanded="false"><span><b>'+esc(leader.name||'Chưa phân Leader')+'</b><small>Leader · '+esc(teamLabel(leader.teamId,leader.id))+' · '+leaderRows.length+' khách</small></span><span class="pending-leader-chevron">+</span></button><div class="pending-leader-detail" data-pending-detail-v2="'+esc(leader.id)+'" hidden>'+salesMarkup(leaderRows)+'</div></div>';};
    const managerIds=new Set(rows.map(c=>byId(c.leaderId)?.managerId).filter(Boolean));
    const assignedManagers=members.filter(m=>m.role==='MANAGER'&&managerIds.has(m.id));
    const assignedLeaders=members.filter(m=>m.role==='LEADER'&&rows.some(c=>c.leaderId===m.id));
    const roots=assignedManagers.map(manager=>'<div class="pending-root-group"><button type="button" class="pending-root-toggle" data-pending-root="'+esc(manager.id)+'" aria-expanded="false"><span><b>Manager: '+esc(manager.name)+'</b><small>'+rows.filter(c=>byId(c.leaderId)?.managerId===manager.id).length+' khách · '+assignedLeaders.filter(l=>l.managerId===manager.id).length+' Leader</small></span><span class="pending-root-chevron">+</span></button><div class="pending-root-detail" data-pending-root-detail="'+esc(manager.id)+'" hidden>'+assignedLeaders.filter(l=>l.managerId===manager.id).map(leaderMarkup).join('')+'</div></div>');
    const unassignedLeaders=assignedLeaders.filter(l=>!l.managerId);
    unassignedLeaders.forEach(leader=>roots.push('<div class="pending-root-group"><button type="button" class="pending-root-toggle" data-pending-root="leader-'+esc(leader.id)+'" aria-expanded="false"><span><b>'+esc('Team '+leader.name)+'</b><small>Leader · '+rowsForLeader(leader).length+' khách</small></span><span class="pending-root-chevron">+</span></button><div class="pending-root-detail" data-pending-root-detail="leader-'+esc(leader.id)+'" hidden>'+salesMarkup(rowsForLeader(leader))+'</div></div>'));
    const orphanRows=rows.filter(c=>!c.leaderId);if(orphanRows.length)roots.push('<div class="pending-root-group"><button type="button" class="pending-root-toggle" data-pending-root="unassigned" aria-expanded="false"><span><b>Chưa phân Leader</b><small>'+orphanRows.length+' khách</small></span><span class="pending-root-chevron">+</span></button><div class="pending-root-detail" data-pending-root-detail="unassigned" hidden>'+salesMarkup(orphanRows)+'</div></div>');
    if(!q('#pendingHierarchyV2Styles')){const style=document.createElement('style');style.id='pendingHierarchyV2Styles';style.textContent='.pending-root-group{border:1px solid #cbd5e1;border-radius:9px;background:#fff;box-shadow:0 2px 7px rgba(15,23,42,.06);overflow:hidden}.pending-root-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-left:4px solid #2563eb;background:#f8fafc;padding:13px 14px 13px 12px;text-align:left;color:#0f172a;cursor:pointer;outline:0}.pending-root-toggle:hover{background:#eff6ff}.pending-root-toggle[aria-expanded=true]{background:#eff6ff;border-bottom:1px solid #bfdbfe}.pending-root-toggle:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}.pending-root-toggle>span:first-child{display:grid;gap:3px}.pending-root-toggle b{font-size:12.5px}.pending-root-toggle small{color:#475569;font-size:10.5px}.pending-root-chevron{font-size:18px;font-weight:800;color:#1d4ed8}.pending-root-detail{padding:10px 10px 11px;border-top:1px solid #cbd5e1;background:#fff}.pending-nested-leader{border:1px solid #c7d2fe;border-radius:8px;margin:6px 0;background:#fafaff;overflow:hidden}.pending-nested-leader .pending-leader-toggle{padding:10px 11px;border-left:3px solid #7c3aed;background:#f5f3ff}.pending-nested-leader .pending-leader-toggle:hover{background:#ede9fe}.pending-nested-leader .pending-leader-toggle[aria-expanded=true]{border-bottom:1px solid #ddd6fe}.pending-nested-leader .pending-leader-detail{padding:5px 9px 9px;border-top:0;background:#fff}.pending-root-detail>.pending-sale-group{padding:7px 8px;border-left:3px solid #f59e0b;border-bottom:1px solid #fde68a;background:#fffbeb}.pending-root-detail>.pending-sale-group:last-child{border-bottom:0}.pending-sale-group{padding:8px;border:1px solid #fde68a;border-radius:7px;margin:6px 0;background:#fffbeb}.pending-sale-head{padding:2px 2px 7px;color:#92400e}.pending-sale-head span{color:#a16207}.pending-customer-row{border:1px solid #e2e8f0;border-radius:6px;background:#fff;padding:9px 8px;margin:5px 0}.pending-customer-row:hover{background:#f8fafc;border-color:#94a3b8}.pending-customer-row:focus-visible{outline:2px solid #2563eb;outline-offset:1px}.pending-customer-row .chip{border:1px solid #fbbf24;background:#fef3c7!important;color:#92400e!important}';document.head.appendChild(style)}
    goal.innerHTML='<div class="pending-data-head"><div><b>Data chưa xử lý</b><small>Chọn Manager hoặc Leader để xem cấp dưới và khách phụ trách</small></div><span class="chip">'+rows.length+' khách</span></div><div class="pending-hierarchy-list">'+(roots.join('')||'<div class="pending-data-empty"><b>Không có data chưa xử lý</b></div>')+'</div>';
    goal.querySelectorAll('[data-pending-root]').forEach(button=>button.onclick=()=>{const detail=goal.querySelector('[data-pending-root-detail="'+CSS.escape(button.dataset.pendingRoot)+'"]');if(!detail)return;const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));button.querySelector('.pending-root-chevron').textContent=open?'−':'+';});
    goal.querySelectorAll('[data-pending-leader-v2]').forEach(button=>button.onclick=()=>{const detail=goal.querySelector('[data-pending-detail-v2="'+CSS.escape(button.dataset.pendingLeaderV2)+'"]');if(!detail)return;const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));button.querySelector('.pending-leader-chevron').textContent=open?'−':'+';});
    goal.querySelectorAll('[data-pending-customer]').forEach(button=>button.onclick=()=>workflow('customer',button.dataset.pendingCustomer));
  }
  const rowTemplates=new Map();
  qa('tbody').forEach(body=>{if(body.querySelector('tr'))rowTemplates.set(body,body.querySelector('tr').cloneNode(true));});
  function table(body,rows) {
    if(!body)return;const template=rowTemplates.get(body);body.replaceChildren();
    rows.forEach(values=>{const row=template?template.cloneNode(true):document.createElement('tr');
      if(!template)values.forEach(()=>row.appendChild(document.createElement('td')));
      row.querySelectorAll('td').forEach((cell,i)=>{const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);const texts=[];let node;while(node=walker.nextNode())if(node.textContent.trim()&&!node.parentElement.closest('button,svg,a'))texts.push(node);const value=values[i],teamMember=body.closest('#tab-team')&&i===0&&typeof value==='string'?data?.members.find(member=>value.startsWith(member.name)):null,relatedMember=body.closest('#tab-team')&&i===3&&typeof value==='string'?data?.members.find(member=>member.name===value):null,displayValue=teamMember?{primary:`${teamMember.name||'Chua dat ten'} - ID: ${teamMember.accountId||teamMember.id}`,secondary:teamMember.phone||'Chua co so dien thoai'}:relatedMember?personWithId(relatedMember.id):value;if(texts.length){if(displayValue&&typeof displayValue==='object'){texts[0].textContent=displayValue.primary??'';if(texts[1])texts[1].textContent=displayValue.secondary??'';texts.slice(2).forEach(n=>n.textContent='');}else{texts[0].textContent=displayValue??'';texts.slice(1).forEach(n=>n.textContent='');}}else if(!cell.querySelector('button,input,svg'))cell.textContent=displayValue??'';cell.querySelectorAll('[title]').forEach(n=>n.removeAttribute('title'));});row.removeAttribute('onclick');body.appendChild(row);
    });
  }
  function orderDeleteAllowed(order) {
    const role=data?.user?.actualRole||data?.user?.role;
    if(role==='ADMIN')return true;
    if(!['MANAGER','LEADER','SALE'].includes(role))return false;
    const raw=String(order?.createdAt||'').trim();
    const iso=raw.includes('T')?raw:raw.replace(' ','T');
    const created=Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)?iso:`${iso}+07:00`);
    return Number.isFinite(created)&&Date.now()-created<3*24*60*60*1000;
  }
  function drawOrders() {
    const grossCollected=o=>{const total=Math.max(0,Number(o.total||0)),paid=Number(o.amountPaid);if(o.status==='DEPOSIT')return Math.min(total,Math.max(0,Number(o.depositAmount||0)));if(Number.isFinite(paid)&&paid>0){const subtotal=Math.max(0,Number(o.subtotal||0)),vat=Math.max(0,Number(o.vatAmount||0)),legacyNetPayment=['PAID','COURSE_GRANTED','REFUNDED'].includes(o.status)&&!o.depositAt&&subtotal>0&&paid<subtotal;return Math.min(total,paid+(legacyNetPayment?vat:0));}if(['PAID','COURSE_GRANTED','REFUNDED'].includes(o.status)){const refund=Math.max(0,Number(o.refund||0));return Math.min(total,refund||total);}return 0;};
    const netCollected=o=>Math.max(0,grossCollected(o)-Math.max(0,Number(o.refund||0)));
    const paymentStatus=o=>['PAID','COURSE_GRANTED'].includes(o.status)?'Thanh toán đủ':'Thanh toán 50%';
    const isRental=o=>Boolean(o.rentalMonths)||(data.products||[]).find(product=>product.id===o.productId)?.type==='RENTAL';
    const statusFilter=q('#orderStatusFilterSelect');
    if(statusFilter)statusFilter.innerHTML='<option value="all">Tất cả trạng thái</option><option value="Thanh toán đủ">Thanh toán đủ</option><option value="Thanh toán 50%">Thanh toán 50%</option>';
    const saleTab=q('#btnOrderTabSale'),rentTab=q('#btnOrderTabRent');
    if(saleTab)saleTab.textContent='Bên Bán (Khóa học & SP)';
    if(rentTab)rentTab.textContent='Cho thuê chỉ báo';
    const start=q('#orderStartDate')?.value,end=q('#orderEndDate')?.value;
    const rows=(data.orders||[]).filter(order=>(!start||order.createdAt?.slice(0,10)>=start)&&(!end||order.createdAt?.slice(0,10)<=end));
    const saleRows=rows.filter(order=>!isRental(order)),rentRows=rows.filter(isRental),collectedRows=rows.filter(order=>netCollected(order)>0);
    text('orderKpiTotalCount',rows.length+' đơn');
    text('orderKpiTotalValue',money(rows.reduce((sum,order)=>sum+Number(order.total||0),0)));
    text('orderKpiSaleCount',saleRows.length+' đơn');
    text('orderKpiSaleValue',money(saleRows.reduce((sum,order)=>sum+Number(order.total||0),0)));
    text('orderKpiRentCount',rentRows.length+' gói thuê');
    text('orderKpiRentValue',money(rentRows.reduce((sum,order)=>sum+Number(order.total||0),0)));
    text('orderKpiCollectedCount',collectedRows.length+' đơn');
    text('orderKpiCollectedValue',money(collectedRows.reduce((sum,order)=>sum+netCollected(order),0)));
    text('orderAllCountBadge',rows.length);
    const body=q('#ordersMainTableBody');
    if(!body)return;
    body.innerHTML=rows.map(order=>{const customer=(data.customers||[]).find(item=>item.id===order.customerId),rental=isRental(order),term=rental?(Number(order.rentalMonths||0)+' tháng'+(order.rentalEndsAt?' · đến '+fmtDate(order.rentalEndsAt):'')):'Vĩnh viễn';return '<tr data-order-group="'+(rental?'rent':'sale')+'" data-order-status="'+esc(paymentStatus(order))+'"><td><b style="font-family:var(--font-mono);color:#2563eb">'+esc(internalCode(order.code||order.id))+'</b></td><td><span class="chip '+(rental?'chip-warm':'chip-orange')+'">'+(rental?'CHO THUÊ CHỈ BÁO':'BÊN BÁN')+'</span></td><td><b>'+esc(order.customerName||customer?.name||'—')+'</b><small>'+esc(customer?.phone||'')+'</small></td><td><b>'+esc(order.productName||'—')+'</b><small>'+esc(order.sku||'')+'</small></td><td><span class="chip chip-warm">'+esc(term)+'</span></td><td>'+esc(person(order.saleId))+'</td><td><b>'+money(order.subtotal)+'</b></td><td>'+money(order.vatAmount)+'</td><td><b style="color:#059669">'+money(netCollected(order))+'</b></td><td><span class="chip '+(['PAID','COURSE_GRANTED'].includes(order.status)?'chip-green':'chip-warm')+'">'+esc(paymentStatus(order))+'</span></td><td style="text-align:right"><button type="button" class="btn-action btn-secondary" data-order-detail="'+esc(order.id)+'">Chi tiết</button>'+(orderDeleteAllowed(order)?' <button type="button" class="btn-action btn-danger" data-order-delete="'+esc(order.id)+'">X\u00f3a</button>':'')+'</td></tr>';}).join('')||'<tr><td colspan="11"><div class="empty"><b>Chưa có đơn hàng</b></div></td></tr>';
    // Tách SĐT khách thành một cột riêng và chỉ hiển thị mã đơn rút gọn.
    const orderTable=body.closest('table');
    const orderHead=orderTable?.querySelector('thead tr');
    if(orderHead&&!orderHead.querySelector('[data-order-phone-column]')){
      const customerHeader=Array.from(orderHead.cells).find(cell=>/KHÁCH HÀNG|KHÁCH HÀNG/i.test(cell.textContent||''));
      if(customerHeader){const phoneHeader=document.createElement('th');phoneHeader.dataset.orderPhoneColumn='1';phoneHeader.textContent='SĐT KH';customerHeader.after(phoneHeader);}
    }
    body.querySelectorAll('tr').forEach(row=>{
      const detail=row.querySelector('[data-order-detail]');
      const order=detail?data.orders.find(item=>item.id===detail.dataset.orderDetail):null;
      const code=row.cells[0]?.querySelector('b');
      if(order&&code)code.textContent=shortOrderCode(order.code||order.id);
      if(!order||row.querySelector('[data-order-phone-cell]'))return;
      const customer=data.customers.find(item=>item.id===order.customerId);
      const customerCell=row.cells[2];
      if(!customerCell)return;
      const phoneCell=document.createElement('td');phoneCell.dataset.orderPhoneCell='1';phoneCell.textContent=customer?.phone||'—';
      const phoneDetail=customerCell.querySelector('small');
      if(phoneDetail)phoneDetail.remove();
      customerCell.after(phoneCell);
    });
    const emptyCell=body.querySelector('tr td[colspan]');
    if(emptyCell)emptyCell.colSpan=12;
    body.querySelectorAll('[data-order-detail]').forEach(button=>button.onclick=()=>workflow('order',button.dataset.orderDetail));
    body.querySelectorAll('[data-order-delete]').forEach(button=>button.onclick=()=>{const order=data.orders.find(item=>item.id===button.dataset.orderDelete);if(!order||!orderDeleteAllowed(order)){referenceNotice('Đơn hàng chỉ được xóa trong 3 ngày đầu.','error');return;}if(!confirm('Xóa đơn '+(order.code||order.id)+'?'))return;run(()=>api.deleteOrder(order.id),()=>referenceNotice('Đã xóa đơn '+(order.code||order.id)+' thành công.'));});
    if(rows.length)filterOrdersCombined();else text('orderCountSummary','0 đơn hàng');
  }
  renderOrdersTable=drawOrders;
  filterOrdersDate=()=>drawOrders();
  // Dùng các lớp của mẫu cho form mới, giữ nguyên bố cục trang sản phẩm.
  function productModal(id=null) {
    if(data.user.role!=='ADMIN')return;
    const p=data.products.find(p=>p.id===id)||{name:'',sku:'',category:'',price:0,type:'SALE',vatRate:0.1,active:true};
    q('#referenceProductModal')?.remove();
    const modal=document.createElement('div');modal.id='referenceProductModal';modal.className='modal-overlay open';
    modal.innerHTML=`<form id="referenceProductForm" class="modal-card" role="dialog" aria-modal="true" aria-labelledby="referenceProductTitle" style="max-height:92dvh;overflow-y:auto;width:min(600px,calc(100vw - 24px))">
      <div class="modal-header"><h3 id="referenceProductTitle">${id?'Sửa':'Thêm'} sản phẩm</h3><button type="button" class="modal-close-btn" data-product-close aria-label="Đóng">×</button></div>
      <div class="modal-body"><div class="grid-2-col" style="grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:16px">
      <div class="form-group"><label for="refProductName">Tên sản phẩm *</label><input id="refProductName" name="name" required maxlength="200" value="${esc(p.name)}"></div>
      <div class="form-group"><label for="refProductSku">Mã SKU</label><input id="refProductSku" name="sku" maxlength="60" value="${esc(p.sku)}"></div>
      <div class="form-group"><label for="refProductType">Loại sản phẩm</label><select id="refProductType" name="type">${opt('SALE','Bên Bán',p.type)+opt('RENTAL','Bên Thuê',p.type)}</select></div>
      <div class="form-group"><label for="refProductMonths">Gói thuê</label><select id="refProductMonths" name="rentalMonths">${opt('','Chọn gói')+[1,3,6,12].map(n=>opt(String(n),n+' tháng',String(p.rentalMonths))).join('')}</select></div>
      <div class="form-group"><label for="refProductCategory">Danh mục *</label><input id="refProductCategory" name="category" list="refProductCategories" required maxlength="100" value="${esc(p.category)}"><datalist id="refProductCategories">${(data.productCategories||[]).map(c=>opt(c,c)).join('')}</datalist></div>
      <div class="form-group"><label for="refProductPrice">Đơn giá chưa VAT *</label><input id="refProductPrice" name="price" type="number" required min="0" step="1" value="${esc(p.price)}"></div>
      <div class="form-group"><label for="refProductVat">VAT (%)</label><input id="refProductVat" name="vatRate" type="number" required min="0" max="100" step="0.01" value="${esc(Number(p.vatRate ?? 0.1)*100)}" placeholder="10"></div>
      <div class="form-group"><label for="refProductActive">Trạng thái</label><select id="refProductActive" name="active">${opt('true','Hoạt động',String(p.active!==false))+opt('false','Tạm dừng',String(p.active!==false))}</select></div>
      </div><p id="refProductError" role="alert" style="color:var(--red,#dc2626)"></p></div>
      <div class="modal-footer"><button type="button" class="btn-action btn-secondary" data-product-close>Hủy</button><button type="submit" class="btn-action btn-primary">Lưu sản phẩm</button></div></form>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-product-close]').forEach(n=>n.onclick=()=>{if(!working){modal.remove();refresh(true);}});
    const sync=()=>{q('#refProductMonths').disabled=q('#refProductType').value!=='RENTAL';q('#refProductMonths').required=!q('#refProductMonths').disabled;};q('#refProductType').onchange=sync;sync();
    q('#referenceProductForm').onsubmit=async event=>{
      event.preventDefault();if(working)return;working=true;
      const form=event.currentTarget,input=Object.fromEntries(new FormData(form));input.active=input.active==='true';
      const controls=Array.from(form.elements);controls.forEach(n=>n.disabled=true);text('refProductError','');
      try{await api.saveProduct(id,input);modal.remove();refresh(true);}
      catch(error){text('refProductError',error.message||'Chưa lưu được sản phẩm.');}
      finally{working=false;controls.forEach(n=>n.disabled=false);if(modal.isConnected)sync();}
    };
    q('#refProductName').focus();
  }
  function catalog(){
    const body=q('#tab-products tbody');
    table(body,data.products.map(p=>[p.name,p.sku,p.type==='RENTAL'?'Bên Thuê':'Bên Bán',p.type==='RENTAL'?p.rentalMonths+' tháng':'Vĩnh viễn',money(p.price),(Number(p.vatRate??.1)*100).toFixed(2).replace(/\.00$/,'')+'% ('+money(Math.round(p.price*Number(p.vatRate??.1)))+')',p.active===false?'Tạm dừng':p.type==='RENTAL'?'Đang cho thuê':'Đang bán','']));
    Array.from(body.rows).forEach((row,i)=>{const p=data.products[i],button=row.querySelector('button');if(button){button.removeAttribute('onclick');button.onclick=()=>productModal(p.id);button.disabled=data.user.role!=='ADMIN';}const chip=row.cells[6]?.querySelector('.chip');if(chip)chip.className='chip '+(p.active===false?'chip-warm':'chip-green');});
    const buttons=qa('#tab-products .headline-row button');buttons.forEach(n=>n.removeAttribute('onclick'));
    buttons[1].onclick=()=>productModal();buttons[1].disabled=data.user.role!=='ADMIN';
    buttons[0].onclick=()=>{q('#referencePriceModal')?.remove();const modal=document.createElement('div');modal.id='referencePriceModal';modal.className='modal-overlay open';modal.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-label="Biểu giá" style="max-height:92dvh;overflow:auto;width:min(800px,calc(100vw - 24px))"><div class="modal-header"><h3>Biểu giá sản phẩm</h3><button class="modal-close-btn" aria-label="Đóng">×</button></div><div class="modal-body table-responsive"><table class="modern-table"><thead><tr><th>Sản phẩm</th><th>Gói</th><th>Chưa VAT</th><th>Gồm VAT</th></tr></thead><tbody>${data.products.filter(p=>p.active!==false).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+(p.type==='RENTAL'?p.rentalMonths+' tháng':'Vĩnh viễn')+'</td><td>'+money(p.price)+'</td><td>'+money(Number(p.price)+Math.round(p.price*Number(p.vatRate??.1)))+'</td></tr>').join('')}</tbody></table></div></div>`;document.body.appendChild(modal);modal.querySelector('button').onclick=()=>{modal.remove();refresh(true);};};
    const cards=qa('#tab-products .bento-card'),sale=data.products.filter(p=>p.type!=='RENTAL'),rental=data.products.filter(p=>p.type==='RENTAL');
    const stats=[['TỔNG SẢN PHẨM',data.products.length+' sản phẩm','Danh mục hiện tại'],['BÊN BÁN',sale.length+' sản phẩm','Khóa học & sản phẩm bán'],['BÊN THUÊ',rental.length+' sản phẩm','Chỉ báo & công cụ cho thuê'],['ĐANG HOẠT ĐỘNG',data.products.filter(p=>p.active!==false).length+' sản phẩm',data.products.filter(p=>p.active===false).length+' tạm dừng']];
    cards.forEach((card,i)=>Array.from(card.children).forEach((n,j)=>n.textContent=stats[i]?.[j]||''));
  }
  function memberEditor(id=null) {
    if(data.user.role!=='ADMIN')return;const m=data.members.concat(data.registeredAccounts).find(m=>m.id===id)||{name:'',email:'',phone:'',role:'LEADER',teamId:''};
    const protectedRole=!['SALE','LEADER','MANAGER','UNASSIGNED'].includes(m.role),role=m.role==='UNASSIGNED'?'SALE':m.role;
    const modal=editor(id?'Cập nhật thành viên':'Thêm thành viên',formField('Họ tên',`<input id="refMemberName" required maxlength="160" value="${esc(m.name)}">`)+formField('ID tài khoản',`<input id="refMemberAccountId" maxlength="64" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}" value="${esc(m.accountId||'')}">`)+formField('Số điện thoại',`<input id="refMemberPhone" type="tel" maxlength="20" value="${esc(m.phone)}">`)+formField('Email',`<input id="refMemberEmail" type="email" maxlength="254" value="${esc(m.email)}">`)+formField('Chức vụ',`<select id="refMemberRole" ${protectedRole?'disabled':''}>${(protectedRole?[role]:['MANAGER','LEADER','SALE']).map(r=>opt(r,r,role)).join('')}</select>`)+formField('Team (tự động theo Leader)',`<input id="refMemberTeam" maxlength="20" readonly ${protectedRole?'disabled':''} value="${esc(m.teamId)}">`)+formField('Leader trực tiếp',`<select id="refMemberLeader">${opt('','Không áp dụng')+data.members.filter(l=>['LEADER','MANAGER'].includes(l.role)&&l.active!==false&&l.id!==id).map(l=>opt(l.id,l.name+' · '+(l.role==='MANAGER'?'MANAGER':l.teamId),m.leaderId)).join('')}</select>`)+formField('Manager quản lý (Admin phân công)',`<select id="refMemberManager">${opt('','Chưa giao Manager')+data.members.filter(m=>m.role==='MANAGER'&&m.active!==false&&m.id!==id).map(x=>opt(x.id,x.name,m.managerId)).join('')}</select>`),()=>api.saveMember(id,{name:q('#refMemberName').value,accountId:q('#refMemberAccountId').value,phone:q('#refMemberPhone').value,email:q('#refMemberEmail').value,role:q('#refMemberRole').value,teamId:q('#refMemberTeam').value,leaderId:q('#refMemberLeader').value,managerId:q('#refMemberManager').value}));
    const memberModal=modal.querySelector('.modal-card'),memberBody=modal.querySelector('.modal-body');
    memberModal?.classList.add('member-editor-modal');memberBody?.classList.add('member-editor-body');
    if(memberBody){
      const style=document.createElement('style');style.textContent='.member-editor-modal{width:min(620px,calc(100vw - 24px))!important;max-height:92dvh!important}.member-editor-body{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px!important;padding:16px!important}.member-editor-body .form-group{margin:0!important;min-width:0}.member-editor-body>[data-editor-error]{grid-column:1/-1;margin:0}.member-editor-body input,.member-editor-body select{min-height:40px;padding:9px 11px}.member-editor-body .form-group label{font-size:11px}.member-editor-modal .modal-footer{padding:12px 16px}@media(max-width:560px){.member-editor-body{grid-template-columns:1fr!important;padding:13px!important;gap:10px!important}}';memberBody.appendChild(style);
      const field=id=>document.getElementById(id)?.closest('.form-group');
      if(role==='MANAGER')field('refMemberTeam')?.setAttribute('hidden','');
      if(role!=='SALE')field('refMemberLeader')?.setAttribute('hidden','');
      if(role!=='LEADER')field('refMemberManager')?.setAttribute('hidden','');
    }
    const sync=()=>{const memberRole=q('#refMemberRole').value,sale=memberRole==='SALE',leader=memberRole==='LEADER';q('#refMemberLeader').disabled=!sale;q('#refMemberLeader').required=sale;q('#refMemberTeam').required=!protectedRole&&memberRole!=='MANAGER';q('#refMemberTeam').disabled=protectedRole||memberRole==='MANAGER';q('#refMemberTeam').readOnly=memberRole!=='MANAGER';if(memberRole==='LEADER'&&!q('#refMemberTeam').value.trim())q('#refMemberTeam').value=teamIdFromName(q('#refMemberName').value);q('#refMemberManager').disabled=!leader;q('#refMemberTeam').closest('.form-group').hidden=memberRole==='MANAGER';q('#refMemberLeader').closest('.form-group').hidden=!sale;q('#refMemberManager').closest('.form-group').hidden=!leader;};q('#refMemberRole').onchange=sync;q('#refMemberName').oninput=()=>{if(['LEADER','SALE'].includes(q('#refMemberRole').value)&&!q('#refMemberTeam').dataset.manual)q('#refMemberTeam').value=teamIdFromName(q('#refMemberName').value);};q('#refMemberLeader').onchange=()=>{const l=data.members.find(m=>m.id===q('#refMemberLeader').value);if(l){if(l.role==='LEADER')q('#refMemberTeam').value=l.teamId;q('#refMemberTeam').dataset.manual='leader';}};sync();
  }
  function passwordEditor(id){editor('Đặt lại mật khẩu',formField('Mật khẩu mới','<input id="refPassword" type="password" required minlength="8" autocomplete="new-password">')+formField('Nhập lại mật khẩu','<input id="refPasswordConfirm" type="password" required autocomplete="new-password">'),()=>api.resetPassword(id,q('#refPassword').value,q('#refPasswordConfirm').value));}
  // Render cay doi ngu theo thu tu Manager -> Leader -> Sale.
  // Khoi nay chi thay phan hien thi, khong thay doi du lieu hay quyen truy cap.
  function renderTeamHierarchyV6(){
    const host=q('#teamHierarchyOverview');if(!host||!data?.user)return;
    if(!q('#teamHierarchyV6Styles')){
      const style=document.createElement('style');
      style.id='teamHierarchyV6Styles';
      style.textContent='.tree-root-container,.branch-card-box{border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);overflow:hidden;box-shadow:var(--shadow-sm)}.tree-root-container+.tree-root-container{margin-top:12px}.tree-root-header,.branch-card-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer;background:var(--bg-surface)}.tree-root-header:hover,.branch-card-header:hover{background:var(--bg-subtle)}.tree-node-info{display:flex;align-items:center;gap:10px;min-width:0}.avatar-circle{display:grid;place-items:center;width:36px;height:36px;flex:0 0 auto;border-radius:50%;font-size:12px;font-weight:800}.avatar-manager{background:#dbeafe;color:#1d4ed8}.avatar-leader{background:#ede9fe;color:#6d28d9}.avatar-sale{background:#dcfce7;color:#15803d}.node-title-group{min-width:0}.node-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.node-main-name{color:var(--text-main);font-weight:800;line-height:1.25}.node-role-pill{display:inline-flex;align-items:center;min-height:22px;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.04em}.pill-manager{background:#dbeafe;color:#1d4ed8}.pill-leader{background:#ede9fe;color:#6d28d9}.pill-sale{background:#dcfce7;color:#15803d}.node-meta-desc{display:block;margin-top:4px;color:var(--text-muted);font-size:11px}.btn-toggle-round{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border:1px solid var(--border);border-radius:50%;background:var(--bg-subtle);color:var(--text-main);font-size:18px;font-weight:700;line-height:1}.tree-body-branches,.leader-sub-tree{padding:10px 12px 12px;border-top:1px solid var(--border-light);background:var(--bg-subtle)}.sub-branch-item{margin-top:8px}.sub-branch-item:first-child{margin-top:0}.branch-card-header{padding:12px 14px}.branch-card-box{box-shadow:none}.branch-card-box>div[id]{background:var(--bg-surface);padding:0 12px 10px}.customer-sub-panel{padding-top:8px}.tree-root-header:focus-visible,.branch-card-header:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}@media(max-width:560px){.tree-root-header,.branch-card-header{padding:12px}.tree-body-branches,.leader-sub-tree{padding:8px}.node-main-name{font-size:13px!important}}';
      document.head.appendChild(style);
    }
    const role=data.user.actualRole||data.user.role,all=data.managerHierarchy?.members||data.members||[],members=all.filter(m=>m.active!==false&&['MANAGER','LEADER','SALE'].includes(m.role)),current=members.find(m=>m.id===data.user.id)||data.user,customers=data.managerHierarchy?.customers||data.customers||[];
    const initials=n=>String(n||'?').trim().split(/\s+/).slice(-2).map(x=>x[0]||'').join('').toUpperCase()||'?';
    const list=(title,rows)=>'<div class="customer-sub-panel"><div class="customer-panel-title">'+esc(title)+' ('+rows.length+')</div>'+(rows.length?rows.map(c=>'<div class="customer-item-row" data-team-customer="'+esc(c.id)+'" role="button" tabindex="0"><div class="cust-left"><div class="cust-dot"></div><div><span class="cust-name">'+esc(c.name||'Chua dat ten')+'</span><span class="cust-phone"> · '+esc(c.phone||'')+'</span></div></div><span class="cust-meta-badge">'+esc(c.status||'MOI')+'</span></div>').join(''):'<div style="font-size:12px;color:#94a3b8;padding:6px 0">Chua co khach hang</div>')+'</div>';
    const sales=l=>members.filter(m=>m.role==='SALE'&&m.leaderId===l.id),managerSales=m=>members.filter(s=>s.role==='SALE'&&(s.managerId===m.id||s.leaderId===m.id)),person=(m,k,rows)=>'<div class="sub-branch-item"><div class="branch-card-box"><div class="branch-card-header" data-toggle-id="'+esc(k+'-'+m.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-'+k+'">'+esc(initials(m.name))+'</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name">'+esc(m.name||'Chua dat ten')+' ('+k+')</span><span class="node-role-pill pill-'+k+'">'+k.toUpperCase()+'</span></div><span class="node-meta-desc">'+rows.length+' khach cua '+k+'</span></div></div><div class="btn-toggle-round">+</div></div><div id="'+esc(k+'-'+m.id)+'" hidden>'+list('Khach cua '+k,rows)+'</div></div></div>';
    const leaders=members.filter(m=>m.role==='LEADER'&&(role==='ADMIN'||role==='MANAGER'&&m.managerId===current.id||role==='LEADER'&&m.id===current.id||role==='SALE'&&m.id===current.leaderId)),managers=members.filter(m=>m.role==='MANAGER'&&(role==='ADMIN'||role==='MANAGER'&&m.id===current.id));
    const directCustomers=(member,kind)=>kind==='manager'
      ? customers.filter(c=>c.ownerId===member.id||c.saleId===member.id)
      : customers.filter(c=>c.ownerId===member.id||c.saleId===member.id||(kind==='leader'&&c.leaderId===member.id&&!c.saleId));
    const leaderNode=l=>{const own=directCustomers(l,'leader'),children=sales(l).map(s=>person(s,'sale',customers.filter(c=>c.saleId===s.id))).join('');return '<div class="tree-branch-node"><div class="branch-card-box"><div class="branch-card-header" data-toggle-id="group-'+esc(l.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-leader">'+esc(initials(l.name))+'</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name">'+esc(l.name||'Chua dat ten')+' (leader)</span><span class="node-role-pill pill-leader">LEADER</span></div><span class="node-meta-desc">'+sales(l).length+' Sale truc thuoc</span></div></div><div class="btn-toggle-round">+</div></div><div id="group-'+esc(l.id)+'" class="leader-sub-tree" hidden>'+person(l,'leader',own)+(children||'<div class="team-hierarchy-empty">Chua co Sale truc thuoc</div>')+'</div></div></div>';};
    const managerNode=m=>{const ls=leaders.filter(l=>l.managerId===m.id),directSales=managerSales(m),own=directCustomers(m,'manager'),saleCount=directSales.length+ls.reduce((n,l)=>n+sales(l).length,0),directSaleNodes=directSales.map(s=>person(s,'sale',customers.filter(c=>c.saleId===s.id))).join('');return '<div class="tree-root-container"><div class="tree-root-header" data-toggle-id="root-'+esc(m.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-manager">M</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name" style="font-size:16px">Team '+esc(m.name||'Chua dat ten')+' (manager)</span><span class="node-role-pill pill-manager">MANAGER</span></div><span class="node-meta-desc">'+ls.length+' Leader · '+saleCount+' Sale</span></div></div><div class="btn-toggle-round">+</div></div><div id="root-'+esc(m.id)+'" class="tree-body-branches" hidden>'+person(m,'manager',own)+directSaleNodes+ls.map(leaderNode).join('')+'</div></div>';};
    const roots=managers.map(managerNode),orphan=leaders.filter(l=>!l.managerId||!managers.some(m=>m.id===l.managerId));
    orphan.forEach(l=>{const own=directCustomers(l,'leader'),children=sales(l).map(s=>person(s,'sale',customers.filter(c=>c.saleId===s.id))).join('');roots.push('<div class="tree-root-container"><div class="tree-root-header" data-toggle-id="orphan-'+esc(l.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-leader">'+esc(initials(l.name))+'</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name" style="font-size:16px">Team '+esc(l.name||l.teamId||'Chua dat ten')+' (leader)</span><span class="node-role-pill pill-leader">LEADER</span></div><span class="node-meta-desc">'+sales(l).length+' Sale · '+own.length+' khach</span></div></div><div class="btn-toggle-round">+</div></div><div id="orphan-'+esc(l.id)+'" class="tree-body-branches" hidden>'+person(l,'leader',own)+children+'</div></div>');});
    host.innerHTML=roots.join('')||'<div class="team-hierarchy-empty">Chua co du lieu doi ngu</div>';
    const memberCard=qa('#tab-team .kpi-bento-card')[0];
    if(memberCard){
      primaryText(memberCard.querySelector('.kpi-hero-num'),members.length);
      memberCard.querySelectorAll('.kpi-foot-stat .value').forEach((node,index)=>{node.textContent=index===0?leaders.length+' người':index===1?members.filter(member=>member.role==='SALE').length+' người':members.length?'100%':'0%';});
      const online=memberCard.querySelector('.kpi-trend-pill');if(online)online.textContent=members.length+' Online';
    }
    host.querySelectorAll('[data-toggle-id]').forEach(h=>h.onclick=e=>{e.preventDefault();e.stopPropagation();const n=document.getElementById(h.dataset.toggleId);if(!n)return;const open=n.hidden;n.hidden=!open;const i=h.querySelector('.btn-toggle-round');if(i)i.textContent=open?'−':'+';});
    host.querySelectorAll('[data-team-customer]').forEach(row=>{const open=()=>workflow('customer',row.dataset.teamCustomer);row.onclick=e=>{e.stopPropagation();open();};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
  }

  function team(){
    const bodies=qa('#tab-team tbody'),role=data.user.actualRole||data.user.role;
    const pendingPanel=bodies[0]?.closest('.table-container');
    if(pendingPanel){
      const isAdmin=role==='ADMIN';
      pendingPanel.hidden=!isAdmin;
      pendingPanel.style.setProperty('display',isAdmin?'':'none','important');
    }
    const pending=role==='ADMIN'?data.registeredAccounts.filter(m=>m.role==='UNASSIGNED'):[];
    const availableMembers=data.managerHierarchy?.members||data.members;
    const members=availableMembers.filter(m=>m.active!==false&&(role==='ADMIN'?['MANAGER','LEADER','SALE'].includes(m.role):role==='MANAGER'?['LEADER','SALE'].includes(m.role):m.id===data.user.leaderId||m.role==='SALE'&&m.leaderId===data.user.leaderId)).sort((a,b)=>({ADMIN:0,MANAGER:1,LEADER:2,SALE:3}[a.role]??3)-({ADMIN:0,MANAGER:1,LEADER:2,SALE:3}[b.role]??3));
    const hierarchyOverview=q('#teamHierarchyOverview');
    if(hierarchyOverview){
      if(!q('#teamHierarchyStyles')){
        const style=document.createElement('style');
        style.id='teamHierarchyStyles';
        style.textContent='.team-hierarchy-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.team-hierarchy-title{font-size:15px;color:var(--text-main);font-weight:800}.team-hierarchy-subtitle{margin-top:3px;font-size:11.5px;color:var(--text-muted)}.team-manager-group{border-top:1px solid var(--border);padding-top:14px;margin-top:14px}.team-manager-group:first-of-type{border-top:0;padding-top:0;margin-top:0}.team-manager-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--text-main);font-size:12px;font-weight:800}.team-manager-head:before{content:"";width:8px;height:8px;border-radius:50%;background:#2563eb;flex:0 0 auto}.team-leader-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}.team-leader-card{border:1px solid var(--border);border-radius:10px;background:var(--bg-subtle);overflow:hidden}.team-leader-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.team-leader-toggle:hover{background:rgba(37,99,235,.05)}.team-leader-main{display:flex;align-items:center;gap:10px;min-width:0}.team-leader-avatar,.team-sale-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#dbeafe;color:#1d4ed8;font-weight:900;font-size:13px;flex:0 0 auto}.team-leader-info{min-width:0}.team-leader-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:800;color:var(--text-main)}.team-leader-meta{display:block;margin-top:3px;font-size:11px;color:var(--text-muted)}.team-leader-chevron{font-size:18px;line-height:1;color:#64748b;flex:0 0 auto}.team-sale-list{border-top:1px solid var(--border);padding:6px 10px 9px;background:var(--bg-surface)}.team-sale-row{display:flex;align-items:center;gap:9px;padding:8px 4px}.team-sale-avatar{width:28px;height:28px;font-size:11px;background:#dcfce7;color:#15803d}.team-sale-info{min-width:0}.team-sale-name{display:block;font-size:12px;font-weight:700;color:var(--text-main)}.team-sale-phone{display:block;margin-top:2px;font-size:10.5px;color:var(--text-muted)}.team-hierarchy-empty{padding:16px 8px;color:var(--text-muted);font-size:12px;text-align:center}.team-hierarchy-more{font-size:11px;color:var(--text-muted);margin-top:2px}';
        document.head.appendChild(style);
      }
      const current=data.members.find(m=>m.id===data.user.id)||data.user;
      const scopeSource=(data.managerHierarchy?.members||data.members||[]).filter(m=>m.active!==false);
      const scopedIds=new Set(scopeSource.map(m=>m.id));
      if(current?.id&&!scopedIds.has(current.id)&&current.active!==false)scopeSource.push(current);
      const scoped=scopeSource.filter(m=>['MANAGER','LEADER','SALE'].includes(m.role));
      const managerList=(role==='ADMIN'?scoped:role==='MANAGER'?[current,...scoped.filter(m=>m.id!==current?.id&&m.role==='MANAGER')]:scoped.filter(m=>m.role==='MANAGER')).filter((m,i,a)=>m?.id&&a.findIndex(x=>x.id===m.id)===i);
      let leaderList=scoped.filter(m=>m.role==='LEADER');
      if(role==='LEADER'&&current?.id)leaderList=[current];
      if(role==='SALE'&&current?.leaderId)leaderList=scoped.filter(m=>m.id===current.leaderId&&m.role==='LEADER');
      const initials=name=>String(name||'?').trim().split(/\s+/).slice(-2).map(part=>part[0]||'').join('').toUpperCase()||'?';
      const nameOf=id=>scoped.find(m=>m.id===id)?.name||data.members.find(m=>m.id===id)?.name||'Ch0a phn';
      const makeLeaderCard=leader=>{
        const sales=scoped.filter(m=>m.role==='SALE'&&(role==='SALE'?m.id===current?.id:m.leaderId===leader.id));
        const manager=managerList.find(m=>m.id===leader.managerId);
        const detail=sales.length?sales.map(s=>'<div class="team-sale-row"><div class="team-sale-avatar">'+esc(initials(s.name))+'</div><div class="team-sale-info"><span class="team-sale-name">'+esc(s.name||'Ch0a c t00n')+'</span><span class="team-sale-phone">'+esc(s.phone||s.accountId||'Ch0a c thng tin')+'</span></div></div>').join(''):'<div class="team-hierarchy-empty">Ch0a c Sale trong team</div>';
        return '<div class="team-leader-card"><button type="button" class="team-leader-toggle" aria-expanded="false"><span class="team-leader-main"><span class="team-leader-avatar">'+esc(initials(leader.name))+'</span><span class="team-leader-info"><span class="team-leader-name">'+esc('Team '+(leader.name||leader.teamId||'Ch0a phn'))+'</span><span class="team-leader-meta">Leader: '+esc(leader.name||'—')+' · '+sales.length+' Sale'+(manager?' · Qun l1: '+esc(manager.name):'')+'</span></span></span><span class="team-leader-chevron">+</span></button><div class="team-sale-list" hidden>'+detail+'</div></div>';
      };
      const renderGroup=(manager,leaders)=>'<div class="team-manager-group">'+(manager?'<div class="team-manager-head">Qun l1: '+esc(manager.name||'—')+'</div>':'<div class="team-manager-head">Ch0a phn Manager</div>')+'<div class="team-leader-list">'+(leaders.length?leaders.map(makeLeaderCard).join(''):'<div class="team-hierarchy-empty">Ch0a c Leader</div>')+'</div></div>';
      const groups=[];
      managerList.forEach(manager=>groups.push(renderGroup(manager,leaderList.filter(leader=>leader.managerId===manager.id))));
      const unassignedLeaders=leaderList.filter(leader=>!managerList.some(manager=>manager.id===leader.managerId));
      if(unassignedLeaders.length||!groups.length)groups.push(renderGroup(null,unassignedLeaders.length?unassignedLeaders:leaderList));
      hierarchyOverview.innerHTML='<div class="team-hierarchy-head"><div><div class="team-hierarchy-title">C0y ng5</div><div class="team-hierarchy-subtitle">B1m vo Leader/Team  xem Sale ph trch</div></div></div>'+(groups.join('')||'<div class="team-hierarchy-empty">Ch0a c d0 liu 1i ng5</div>');
      hierarchyOverview.querySelectorAll('.team-leader-toggle').forEach(button=>{button.onclick=()=>{const detail=button.nextElementSibling,open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));const icon=button.querySelector('.team-leader-chevron');if(icon)icon.textContent=open?'−':'+';};});
    }
    // Dynamic team hierarchy is rendered above this table.
    if(hierarchyOverview){
      const hierarchyCurrent=data.members.find(m=>m.id===data.user.id)||data.user;
      const hierarchySource=(data.managerHierarchy?.members||data.members||[]).filter(m=>m.active!==false);
      if(hierarchyCurrent?.id&&!hierarchySource.some(m=>m.id===hierarchyCurrent.id)&&hierarchyCurrent.active!==false)hierarchySource.push(hierarchyCurrent);
      const hierarchyMembers=hierarchySource.filter(m=>['MANAGER','LEADER','SALE'].includes(m.role));
      const hierarchyManagers=(role==='ADMIN'?hierarchyMembers.filter(m=>m.role==='MANAGER'):role==='MANAGER'?[hierarchyCurrent,...hierarchyMembers.filter(m=>m.role==='MANAGER'&&m.id!==hierarchyCurrent?.id)]:[]).filter((m,i,a)=>m?.id&&a.findIndex(x=>x.id===m.id)===i);
      let hierarchyLeaders=hierarchyMembers.filter(m=>m.role==='LEADER');
      if(role==='LEADER'&&hierarchyCurrent?.id)hierarchyLeaders=[hierarchyCurrent];
      if(role==='SALE'&&hierarchyCurrent?.leaderId)hierarchyLeaders=hierarchyMembers.filter(m=>m.id===hierarchyCurrent.leaderId&&m.role==='LEADER');
      const initials=name=>String(name||'?').trim().split(/\s+/).slice(-2).map(part=>part[0]||'').join('').toUpperCase()||'?';
      const displayTeamName=member=>{
        if(member?.role==='MANAGER')return 'Team '+(member.name||member.teamId||'Chua phan')+' (manager)';
        const leader=hierarchyMembers.find(m=>m.role==='LEADER'&&(member.role==='LEADER'?m.id===member.id:m.id===member.leaderId));
        if(leader)return 'Team '+(leader.name||leader.teamId||'Chua phan')+' (leader)';
        return member?.teamId?'Team '+member.teamId:'Chua phan Team';
      };
      const leaderCard=leader=>{
        const sales=hierarchyMembers.filter(m=>m.role==='SALE'&&(role==='SALE'?m.id===hierarchyCurrent?.id:m.leaderId===leader.id));
        const manager=hierarchyManagers.find(m=>m.id===leader.managerId);
        const saleRows=sales.length?sales.map(s=>'<div class="team-sale-row"><div class="team-sale-avatar">'+esc(initials(s.name))+'</div><div class="team-sale-info"><span class="team-sale-name">'+esc(s.name||'Ch&#432;a c&#243; t&#234;n')+'</span><span class="team-sale-phone">'+esc(s.phone||s.accountId||'Ch&#432;a c&#243; th&#244;ng tin')+'</span></div></div>').join(''):'<div class="team-hierarchy-empty">Ch&#432;a c&#243; Sale trong team</div>';
        return '<div class="team-leader-card"><button type="button" class="team-leader-toggle" aria-expanded="false"><span class="team-leader-main"><span class="team-leader-avatar">'+esc(initials(leader.name))+'</span><span class="team-leader-info"><span class="team-leader-name">'+esc(displayTeamName(leader))+'</span><span class="team-leader-meta">Leader: '+esc(leader.name||'Chua phan')+' &middot; '+sales.length+' Sale'+(manager?' &middot; Qu&#7843;n l&#253;: '+esc(manager.name):'')+'</span></span></span><span class="team-leader-chevron">+</span></button><div class="team-sale-list" hidden>'+saleRows+'</div></div>';
      };
      const hierarchyGroups=[];
      hierarchyManagers.forEach(manager=>hierarchyGroups.push('<div class="team-manager-group"><div class="team-manager-head">'+esc(displayTeamName(manager))+'</div><div class="team-leader-list">'+(hierarchyLeaders.filter(leader=>leader.managerId===manager.id).map(leaderCard).join('')||'<div class="team-hierarchy-empty">Ch&#432;a c&#243; Leader</div>')+'</div></div>'));
      const unassignedLeaders=hierarchyLeaders.filter(leader=>!hierarchyManagers.some(manager=>manager.id===leader.managerId));
      if(unassignedLeaders.length||!hierarchyGroups.length)hierarchyGroups.push('<div class="team-manager-group"><div class="team-manager-head">Ch&#432;a ph&#226;n Manager</div><div class="team-leader-list">'+(unassignedLeaders.length?unassignedLeaders.map(leaderCard).join(''):'<div class="team-hierarchy-empty">Ch&#432;a c&#243; d&#7919; li&#7879;u &#273;&#7897;i ng&#361;</div>')+'</div></div>');
      hierarchyOverview.innerHTML='<div class="team-hierarchy-head"><div><div class="team-hierarchy-title">C&#226;y ng&#361; &#273;&#7897;i ng&#361;</div><div class="team-hierarchy-subtitle">B&#7845;m v&#224;o Leader/Team &#273;&#7875; xem c&#225;c Sale ph&#7909; tr&#225;ch</div></div></div>'+hierarchyGroups.join('');
      hierarchyOverview.querySelectorAll('.team-leader-toggle').forEach(button=>button.onclick=()=>{
        const detail=button.nextElementSibling;
        const open=detail.hidden;
        detail.hidden=!open;
        button.setAttribute('aria-expanded',String(open));
      });
    }
    // Dat lai cay hien thi sau khoi render cu de dam bao Manager/Leader luon dung cap.
    renderTeamHierarchyV6();
    const start=q('#teamStartDate')?.value,end=q('#teamEndDate')?.value;
    const revenue=m=>(data.managerHierarchy?.financialEvents||data.financialEvents).filter(e=>(!start||e.occurredAt?.slice(0,10)>=start)&&(!end||e.occurredAt?.slice(0,10)<=end)&&(data.managerHierarchy?.orders||data.orders).some(o=>o.id===e.orderId&&(m.role==='LEADER'?o.leaderId===m.id:o.saleId===m.id))).reduce((s,e)=>s+Number(e.amount||0),0);
    const customers=m=>(data.managerHierarchy?.customers||data.customers).filter(c=>m.role==='MANAGER'?(c.ownerId===m.id||c.saleId===m.id):m.role==='LEADER'?(c.saleId===m.id||(c.leaderId===m.id&&!c.saleId)):c.saleId===m.id).length;
    table(bodies[0],pending.map(m=>[m.name,m.phone,m.email,'Chờ phân chức vụ','']));
    Array.from(bodies[0]?.rows||[]).forEach((r,i)=>{const b=r.querySelector('button');if(b){b.removeAttribute('onclick');b.onclick=()=>memberEditor(pending[i].id);b.disabled=data.user.role!=='ADMIN';}});
    const teamColumnName=m=>m.role==='MANAGER'?'Team '+(m.name||m.teamId||'Chua phan')+' (manager)':(data.members.find(x=>x.role==='LEADER'&&(m.role==='LEADER'?x.id===m.id:x.id===m.leaderId))?('Team '+(data.members.find(x=>x.role==='LEADER'&&(m.role==='LEADER'?x.id===m.id:x.id===m.leaderId)).name||'Chua phan')+' (leader)'):(m.teamId?'Team '+m.teamId:'Chua phan Team'));
    table(bodies[1],members.map(m=>[m.name+(m.phone?' · '+m.phone:''),m.role,teamColumnName(m),m.managerId?person(m.managerId):m.leaderId?person(m.leaderId):'—',customers(m),money(revenue(m)),'']));
    Array.from(bodies[1]?.rows||[]).forEach((r,i)=>{const m=members[i],buttons=r.querySelectorAll('button');buttons.forEach(b=>{b.removeAttribute('onclick');b.disabled=data.user.role!=='ADMIN';});if(buttons[0])buttons[0].onclick=()=>memberEditor(m.id);if(buttons[1]){buttons[1].onclick=()=>passwordEditor(m.id);buttons[1].disabled=data.user.role!=='ADMIN'||!m.loginEnabled;}if(buttons[2]){buttons[2].disabled=data.user.role!=='ADMIN'||!['SALE','LEADER'].includes(m.role)||m.id===data.user.id;buttons[2].onclick=()=>{if(confirm('Xóa thành viên khỏi đội ngũ và thu hồi khách theo quy trình hiện có?'))run(()=>api.removeMember(m.id));};}});
    const add=q('#tab-team .headline-row button');add.removeAttribute('onclick');add.onclick=()=>memberEditor();add.disabled=data.user.role!=='ADMIN';
    const description=bodies[0]?.closest('.table-container')?.querySelector('.table-head-bar > div > div');if(description)description.textContent='Admin phân chức vụ trước khi tài khoản được sử dụng.';
    const cards=qa('#tab-team .kpi-bento-card'); // team KPI scope is applied below
    const scopedCustomers=data.managerHierarchy?.customers||data.customers||[];
    const scopedOrders=data.managerHierarchy?.orders||data.orders||[];
    const scopedEvents=data.managerHierarchy?.financialEvents||data.financialEvents||[];
    const scopedTasks=data.managerHierarchy?.tasks||data.tasks||[];
    const inRange=value=>(!start||String(value||'').slice(0,10)>=start)&&(!end||String(value||'').slice(0,10)<=end);
    const eventOrderIds=new Set(scopedOrders.map(order=>order.id));
    const teamRevenueValue=money(scopedEvents.filter(event=>eventOrderIds.has(event.orderId)&&inRange(event.occurredAt)).reduce((sum,event)=>sum+Number(event.amount||0),0));
    const activeTasks=scopedTasks.filter(task=>task.status!=='DONE');
    const parseDate=value=>{const raw=String(value||'').trim();if(!raw)return NaN;const normalized=raw.includes('T')?raw:raw.replace(' ','T');return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)?normalized:normalized+'+07:00');};
    const isOverdue=task=>task.status==='OVERDUE'||(task.status!=='DONE'&&Number.isFinite(parseDate(task.dueAt))&&parseDate(task.dueAt)<Date.now());
    const overdueTasks=activeTasks.filter(task=>inRange(task.dueAt||task.createdAt)&&isOverdue(task));
    // A newly allocated data row keeps its recipient on the pending offer until
    // the Sale accepts it. Count that allocation as an assigned customer too.
    const assignedCustomerIds=new Set();
    const hasStoredOwner=customer=>[
      customer.saleId,
      customer.leaderId,
      customer.managerId,
      customer.ownerId,
      customer.assigneeId,
      customer.assignedTo,
      customer.teamId
    ].some(Boolean)||Boolean(String(customer.sale||'').trim()&&!/chưa\s*phân/i.test(String(customer.sale)));
    scopedCustomers.forEach(customer=>{if(hasStoredOwner(customer))assignedCustomerIds.add(customer.id);});
    const scopedCustomerIds=new Set(scopedCustomers.map(customer=>customer.id));
    [...(data.offers||[]),...(data.pendingOffers||[])].forEach(offer=>{
      const hasRecipient=[offer.saleId,offer.leaderId,offer.managerId,offer.ownerId].some(Boolean);
      if(offer.status==='PENDING'&&hasRecipient&&scopedCustomerIds.has(offer.customerId))assignedCustomerIds.add(offer.customerId);
    });
    const assignedCustomers=scopedCustomers.filter(customer=>assignedCustomerIds.has(customer.id));
    const calledCustomers=assignedCustomers.filter(customer=>['Đã gọi được','Đã gọi','Đã kết nối'].includes(customer.customFields?.callStatus)||customer.customFields?.callStatus==='Đã gọi được');
    const paidOrders=scopedOrders.filter(order=>inRange(order.paidAt||order.createdAt)&&['PAID','COURSE_GRANTED'].includes(order.status));
    const target=members.filter(member=>member.role==='SALE').reduce((sum,member)=>sum+Number(member.target||0),0);
    const progress=target?Math.min(100,scopedEvents.filter(event=>eventOrderIds.has(event.orderId)&&inRange(event.occurredAt)).reduce((sum,event)=>sum+Number(event.amount||0),0)/target*100):0;
    const metrics=[members.length,teamRevenueValue,assignedCustomers.length,overdueTasks.length];
    cards.forEach((card,i)=>{primaryText(card.querySelector('.kpi-hero-num'),metrics[i]);});
    cards[0]?.querySelectorAll('.kpi-foot-stat .value').forEach((node,i)=>{if(i===0)node.textContent=members.filter(member=>member.role==='LEADER').length+' người';else if(i===1)node.textContent=members.filter(member=>member.role==='SALE').length+' người';else node.textContent=members.length?'100%':'0%';});
    const online=cards[0]?.querySelector('.kpi-trend-pill');if(online)online.textContent=members.length+' hoạt động';
    const foot=(i,values)=>cards[i]?.querySelectorAll('.kpi-foot-stat .value').forEach((n,j)=>n.textContent=values[j]);
    foot(1,[paidOrders.length+' đơn',target?money(target):'Chưa đặt',target?progress.toFixed(1)+'%':'—']);
    foot(2,[assignedCustomers.length+' khách',(scopedCustomers.length-assignedCustomers.length)+' khách',assignedCustomers.length?(calledCustomers.length/assignedCustomers.length*100).toFixed(1)+'%':'—']);
  }
  renderOrdersTable=drawOrders;
  filterOrdersDate=()=>drawOrders();
  // Dùng các lớp của mẫu cho form mới, giữ nguyên bố cục trang sản phẩm.
  function productModal(id=null) {
    if(data.user.role!=='ADMIN')return;
    const p=data.products.find(p=>p.id===id)||{name:'',sku:'',category:'',price:0,type:'SALE',vatRate:0.1,active:true};
    q('#referenceProductModal')?.remove();
    const modal=document.createElement('div');modal.id='referenceProductModal';modal.className='modal-overlay open';
    modal.innerHTML=`<form id="referenceProductForm" class="modal-card" role="dialog" aria-modal="true" aria-labelledby="referenceProductTitle" style="max-height:92dvh;overflow-y:auto;width:min(600px,calc(100vw - 24px))">
      <div class="modal-header"><h3 id="referenceProductTitle">${id?'Sửa':'Thêm'} sản phẩm</h3><button type="button" class="modal-close-btn" data-product-close aria-label="Đóng">×</button></div>
      <div class="modal-body"><div class="grid-2-col" style="grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:16px">
      <div class="form-group"><label for="refProductName">Tên sản phẩm *</label><input id="refProductName" name="name" required maxlength="200" value="${esc(p.name)}"></div>
      <div class="form-group"><label for="refProductSku">Mã SKU</label><input id="refProductSku" name="sku" maxlength="60" value="${esc(p.sku)}"></div>
      <div class="form-group"><label for="refProductType">Loại sản phẩm</label><select id="refProductType" name="type">${opt('SALE','Bên Bán',p.type)+opt('RENTAL','Bên Thuê',p.type)}</select></div>
      <div class="form-group"><label for="refProductMonths">Gói thuê</label><select id="refProductMonths" name="rentalMonths">${opt('','Chọn gói')+[1,3,6,12].map(n=>opt(String(n),n+' tháng',String(p.rentalMonths))).join('')}</select></div>
      <div class="form-group"><label for="refProductCategory">Danh mục *</label><input id="refProductCategory" name="category" list="refProductCategories" required maxlength="100" value="${esc(p.category)}"><datalist id="refProductCategories">${(data.productCategories||[]).map(c=>opt(c,c)).join('')}</datalist></div>
      <div class="form-group"><label for="refProductPrice">Đơn giá chưa VAT *</label><input id="refProductPrice" name="price" type="number" required min="0" step="1" value="${esc(p.price)}"></div>
      <div class="form-group"><label for="refProductVat">VAT (%)</label><input id="refProductVat" name="vatRate" type="number" required min="0" max="100" step="0.01" value="${esc(Number(p.vatRate ?? 0.1)*100)}" placeholder="10"></div>
      <div class="form-group"><label for="refProductActive">Trạng thái</label><select id="refProductActive" name="active">${opt('true','Hoạt động',String(p.active!==false))+opt('false','Tạm dừng',String(p.active!==false))}</select></div>
      </div><p id="refProductError" role="alert" style="color:var(--red,#dc2626)"></p></div>
      <div class="modal-footer"><button type="button" class="btn-action btn-secondary" data-product-close>Hủy</button><button type="submit" class="btn-action btn-primary">Lưu sản phẩm</button></div></form>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-product-close]').forEach(n=>n.onclick=()=>{if(!working){modal.remove();refresh(true);}});
    const sync=()=>{q('#refProductMonths').disabled=q('#refProductType').value!=='RENTAL';q('#refProductMonths').required=!q('#refProductMonths').disabled;};q('#refProductType').onchange=sync;sync();
    q('#referenceProductForm').onsubmit=async event=>{
      event.preventDefault();if(working)return;working=true;
      const form=event.currentTarget,input=Object.fromEntries(new FormData(form));input.active=input.active==='true';
      const controls=Array.from(form.elements);controls.forEach(n=>n.disabled=true);text('refProductError','');
      try{await api.saveProduct(id,input);modal.remove();refresh(true);}
      catch(error){text('refProductError',error.message||'Chưa lưu được sản phẩm.');}
      finally{working=false;controls.forEach(n=>n.disabled=false);if(modal.isConnected)sync();}
    };
    q('#refProductName').focus();
  }
  function catalog(){
    const body=q('#tab-products tbody');
    table(body,data.products.map(p=>[p.name,p.sku,p.type==='RENTAL'?'Bên Thuê':'Bên Bán',p.type==='RENTAL'?p.rentalMonths+' tháng':'Vĩnh viễn',money(p.price),(Number(p.vatRate??.1)*100).toFixed(2).replace(/\.00$/,'')+'% ('+money(Math.round(p.price*Number(p.vatRate??.1)))+')',p.active===false?'Tạm dừng':p.type==='RENTAL'?'Đang cho thuê':'Đang bán','']));
    Array.from(body.rows).forEach((row,i)=>{const p=data.products[i],button=row.querySelector('button');if(button){button.removeAttribute('onclick');button.onclick=()=>productModal(p.id);button.disabled=data.user.role!=='ADMIN';}const chip=row.cells[6]?.querySelector('.chip');if(chip)chip.className='chip '+(p.active===false?'chip-warm':'chip-green');});
    const buttons=qa('#tab-products .headline-row button');buttons.forEach(n=>n.removeAttribute('onclick'));
    buttons[1].onclick=()=>productModal();buttons[1].disabled=data.user.role!=='ADMIN';
    buttons[0].onclick=()=>{q('#referencePriceModal')?.remove();const modal=document.createElement('div');modal.id='referencePriceModal';modal.className='modal-overlay open';modal.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-label="Biểu giá" style="max-height:92dvh;overflow:auto;width:min(800px,calc(100vw - 24px))"><div class="modal-header"><h3>Biểu giá sản phẩm</h3><button class="modal-close-btn" aria-label="Đóng">×</button></div><div class="modal-body table-responsive"><table class="modern-table"><thead><tr><th>Sản phẩm</th><th>Gói</th><th>Chưa VAT</th><th>Gồm VAT</th></tr></thead><tbody>${data.products.filter(p=>p.active!==false).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+(p.type==='RENTAL'?p.rentalMonths+' tháng':'Vĩnh viễn')+'</td><td>'+money(p.price)+'</td><td>'+money(Number(p.price)+Math.round(p.price*Number(p.vatRate??.1)))+'</td></tr>').join('')}</tbody></table></div></div>`;document.body.appendChild(modal);modal.querySelector('button').onclick=()=>{modal.remove();refresh(true);};};
    const cards=qa('#tab-products .bento-card'),sale=data.products.filter(p=>p.type!=='RENTAL'),rental=data.products.filter(p=>p.type==='RENTAL');
    const stats=[['TỔNG SẢN PHẨM',data.products.length+' sản phẩm','Danh mục hiện tại'],['BÊN BÁN',sale.length+' sản phẩm','Khóa học & sản phẩm bán'],['BÊN THUÊ',rental.length+' sản phẩm','Chỉ báo & công cụ cho thuê'],['ĐANG HOẠT ĐỘNG',data.products.filter(p=>p.active!==false).length+' sản phẩm',data.products.filter(p=>p.active===false).length+' tạm dừng']];
    cards.forEach((card,i)=>Array.from(card.children).forEach((n,j)=>n.textContent=stats[i]?.[j]||''));
  }
  function memberEditor(id=null) {
    if(data.user.role!=='ADMIN')return;const m=data.members.concat(data.registeredAccounts).find(m=>m.id===id)||{name:'',email:'',phone:'',role:'LEADER',teamId:''};
    const protectedRole=!['SALE','LEADER','MANAGER','UNASSIGNED'].includes(m.role),role=m.role==='UNASSIGNED'?'SALE':m.role;
    const modal=editor(id?'Cập nhật thành viên':'Thêm thành viên',formField('Họ tên',`<input id="refMemberName" required maxlength="160" value="${esc(m.name)}">`)+formField('ID tài khoản',`<input id="refMemberAccountId" maxlength="64" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}" value="${esc(m.accountId||'')}">`)+formField('Số điện thoại',`<input id="refMemberPhone" type="tel" maxlength="20" value="${esc(m.phone)}">`)+formField('Email',`<input id="refMemberEmail" type="email" maxlength="254" value="${esc(m.email)}">`)+formField('Chức vụ',`<select id="refMemberRole" ${protectedRole?'disabled':''}>${(protectedRole?[role]:['MANAGER','LEADER','SALE']).map(r=>opt(r,r,role)).join('')}</select>`)+formField('Team (tự động theo Leader)',`<input id="refMemberTeam" maxlength="20" readonly ${protectedRole?'disabled':''} value="${esc(m.teamId)}">`)+formField('Leader trực tiếp',`<select id="refMemberLeader">${opt('','Không áp dụng')+data.members.filter(l=>['LEADER','MANAGER'].includes(l.role)&&l.active!==false&&l.id!==id).map(l=>opt(l.id,l.name+' · '+(l.role==='MANAGER'?'MANAGER':l.teamId),m.leaderId)).join('')}</select>`)+formField('Manager quản lý (Admin phân công)',`<select id="refMemberManager">${opt('','Chưa giao Manager')+data.members.filter(m=>m.role==='MANAGER'&&m.active!==false&&m.id!==id).map(x=>opt(x.id,x.name,m.managerId)).join('')}</select>`),()=>api.saveMember(id,{name:q('#refMemberName').value,accountId:q('#refMemberAccountId').value,phone:q('#refMemberPhone').value,email:q('#refMemberEmail').value,role:q('#refMemberRole').value,teamId:q('#refMemberTeam').value,leaderId:q('#refMemberLeader').value,managerId:q('#refMemberManager').value}));
    const memberModal=modal.querySelector('.modal-card'),memberBody=modal.querySelector('.modal-body');
    memberModal?.classList.add('member-editor-modal');memberBody?.classList.add('member-editor-body');
    if(memberBody){
      const style=document.createElement('style');style.textContent='.member-editor-modal{width:min(620px,calc(100vw - 24px))!important;max-height:92dvh!important}.member-editor-body{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px!important;padding:16px!important}.member-editor-body .form-group{margin:0!important;min-width:0}.member-editor-body>[data-editor-error]{grid-column:1/-1;margin:0}.member-editor-body input,.member-editor-body select{min-height:40px;padding:9px 11px}.member-editor-body .form-group label{font-size:11px}.member-editor-modal .modal-footer{padding:12px 16px}@media(max-width:560px){.member-editor-body{grid-template-columns:1fr!important;padding:13px!important;gap:10px!important}}';memberBody.appendChild(style);
      const field=id=>document.getElementById(id)?.closest('.form-group');
      if(role==='MANAGER')field('refMemberTeam')?.setAttribute('hidden','');
      if(role!=='SALE')field('refMemberLeader')?.setAttribute('hidden','');
      if(role!=='LEADER')field('refMemberManager')?.setAttribute('hidden','');
    }
    const sync=()=>{const memberRole=q('#refMemberRole').value,sale=memberRole==='SALE',leader=memberRole==='LEADER';q('#refMemberLeader').disabled=!sale;q('#refMemberLeader').required=sale;q('#refMemberTeam').required=!protectedRole&&memberRole!=='MANAGER';q('#refMemberTeam').disabled=protectedRole||memberRole==='MANAGER';q('#refMemberTeam').readOnly=memberRole!=='MANAGER';if(memberRole==='LEADER'&&!q('#refMemberTeam').value.trim())q('#refMemberTeam').value=teamIdFromName(q('#refMemberName').value);q('#refMemberManager').disabled=!leader;q('#refMemberTeam').closest('.form-group').hidden=memberRole==='MANAGER';q('#refMemberLeader').closest('.form-group').hidden=!sale;q('#refMemberManager').closest('.form-group').hidden=!leader;};q('#refMemberRole').onchange=sync;q('#refMemberName').oninput=()=>{if(['LEADER','SALE'].includes(q('#refMemberRole').value)&&!q('#refMemberTeam').dataset.manual)q('#refMemberTeam').value=teamIdFromName(q('#refMemberName').value);};q('#refMemberLeader').onchange=()=>{const l=data.members.find(m=>m.id===q('#refMemberLeader').value);if(l){if(l.role==='LEADER')q('#refMemberTeam').value=l.teamId;q('#refMemberTeam').dataset.manual='leader';}};sync();
  }
  function passwordEditor(id){editor('Đặt lại mật khẩu',formField('Mật khẩu mới','<input id="refPassword" type="password" required minlength="8" autocomplete="new-password">')+formField('Nhập lại mật khẩu','<input id="refPasswordConfirm" type="password" required autocomplete="new-password">'),()=>api.resetPassword(id,q('#refPassword').value,q('#refPasswordConfirm').value));}
  // Render cay doi ngu theo thu tu Manager -> Leader -> Sale.
  // Khoi nay chi thay phan hien thi, khong thay doi du lieu hay quyen truy cap.
  function renderTeamHierarchyV6(){
    const host=q('#teamHierarchyOverview');if(!host||!data?.user)return;
    if(!q('#teamHierarchyV6Styles')){
      const style=document.createElement('style');
      style.id='teamHierarchyV6Styles';
      style.textContent='.tree-root-container,.branch-card-box{border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);overflow:hidden;box-shadow:var(--shadow-sm)}.tree-root-container+.tree-root-container{margin-top:12px}.tree-root-header,.branch-card-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer;background:var(--bg-surface)}.tree-root-header:hover,.branch-card-header:hover{background:var(--bg-subtle)}.tree-node-info{display:flex;align-items:center;gap:10px;min-width:0}.avatar-circle{display:grid;place-items:center;width:36px;height:36px;flex:0 0 auto;border-radius:50%;font-size:12px;font-weight:800}.avatar-manager{background:#dbeafe;color:#1d4ed8}.avatar-leader{background:#ede9fe;color:#6d28d9}.avatar-sale{background:#dcfce7;color:#15803d}.node-title-group{min-width:0}.node-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.node-main-name{color:var(--text-main);font-weight:800;line-height:1.25}.node-role-pill{display:inline-flex;align-items:center;min-height:22px;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.04em}.pill-manager{background:#dbeafe;color:#1d4ed8}.pill-leader{background:#ede9fe;color:#6d28d9}.pill-sale{background:#dcfce7;color:#15803d}.node-meta-desc{display:block;margin-top:4px;color:var(--text-muted);font-size:11px}.btn-toggle-round{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border:1px solid var(--border);border-radius:50%;background:var(--bg-subtle);color:var(--text-main);font-size:18px;font-weight:700;line-height:1}.tree-body-branches,.leader-sub-tree{padding:10px 12px 12px;border-top:1px solid var(--border-light);background:var(--bg-subtle)}.sub-branch-item{margin-top:8px}.sub-branch-item:first-child{margin-top:0}.branch-card-header{padding:12px 14px}.branch-card-box{box-shadow:none}.branch-card-box>div[id]{background:var(--bg-surface);padding:0 12px 10px}.customer-sub-panel{padding-top:8px}.tree-root-header:focus-visible,.branch-card-header:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}@media(max-width:560px){.tree-root-header,.branch-card-header{padding:12px}.tree-body-branches,.leader-sub-tree{padding:8px}.node-main-name{font-size:13px!important}}';
      document.head.appendChild(style);
    }
    const role=data.user.actualRole||data.user.role,all=data.managerHierarchy?.members||data.members||[],members=all.filter(m=>m.active!==false&&['MANAGER','LEADER','SALE'].includes(m.role)),current=members.find(m=>m.id===data.user.id)||data.user,customers=data.managerHierarchy?.customers||data.customers||[];
    const initials=n=>String(n||'?').trim().split(/\s+/).slice(-2).map(x=>x[0]||'').join('').toUpperCase()||'?';
    const list=(title,rows)=>'<div class="customer-sub-panel"><div class="customer-panel-title">'+esc(title)+' ('+rows.length+')</div>'+(rows.length?rows.map(c=>'<div class="customer-item-row" data-team-customer="'+esc(c.id)+'" role="button" tabindex="0"><div class="cust-left"><div class="cust-dot"></div><div><span class="cust-name">'+esc(c.name||'Chua dat ten')+'</span><span class="cust-phone"> · '+esc(c.phone||'')+'</span></div></div><span class="cust-meta-badge">'+esc(c.status||'MOI')+'</span></div>').join(''):'<div style="font-size:12px;color:#94a3b8;padding:6px 0">Chua co khach hang</div>')+'</div>';
    const sales=l=>members.filter(m=>m.role==='SALE'&&m.leaderId===l.id),managerSales=m=>members.filter(s=>s.role==='SALE'&&(s.managerId===m.id||s.leaderId===m.id)),person=(m,k,rows)=>'<div class="sub-branch-item"><div class="branch-card-box"><div class="branch-card-header" data-toggle-id="'+esc(k+'-'+m.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-'+k+'">'+esc(initials(m.name))+'</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name">'+esc(m.name||'Chua dat ten')+' ('+k+')</span><span class="node-role-pill pill-'+k+'">'+k.toUpperCase()+'</span></div><span class="node-meta-desc">'+rows.length+' khach cua '+k+'</span></div></div><div class="btn-toggle-round">+</div></div><div id="'+esc(k+'-'+m.id)+'" hidden>'+list('Khach cua '+k,rows)+'</div></div></div>';
    const leaders=members.filter(m=>m.role==='LEADER'&&(role==='ADMIN'||role==='MANAGER'&&m.managerId===current.id||role==='LEADER'&&m.id===current.id||role==='SALE'&&m.id===current.leaderId)),managers=members.filter(m=>m.role==='MANAGER'&&(role==='ADMIN'||role==='MANAGER'&&m.id===current.id));
    const directCustomers=(member,kind)=>kind==='manager'
      ? customers.filter(c=>c.ownerId===member.id||c.saleId===member.id)
      : customers.filter(c=>c.ownerId===member.id||c.saleId===member.id||(kind==='leader'&&c.leaderId===member.id&&!c.saleId));
    const leaderNode=l=>{const own=directCustomers(l,'leader'),children=sales(l).map(s=>person(s,'sale',customers.filter(c=>c.saleId===s.id))).join('');return '<div class="tree-branch-node"><div class="branch-card-box"><div class="branch-card-header" data-toggle-id="group-'+esc(l.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-leader">'+esc(initials(l.name))+'</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name">'+esc(l.name||'Chua dat ten')+' (leader)</span><span class="node-role-pill pill-leader">LEADER</span></div><span class="node-meta-desc">'+sales(l).length+' Sale truc thuoc</span></div></div><div class="btn-toggle-round">+</div></div><div id="group-'+esc(l.id)+'" class="leader-sub-tree" hidden>'+person(l,'leader',own)+(children||'<div class="team-hierarchy-empty">Chua co Sale truc thuoc</div>')+'</div></div></div>';};
    const managerNode=m=>{const ls=leaders.filter(l=>l.managerId===m.id),directSales=managerSales(m),own=directCustomers(m,'manager'),saleCount=directSales.length+ls.reduce((n,l)=>n+sales(l).length,0),directSaleNodes=directSales.map(s=>person(s,'sale',customers.filter(c=>c.saleId===s.id))).join('');return '<div class="tree-root-container"><div class="tree-root-header" data-toggle-id="root-'+esc(m.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-manager">M</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name" style="font-size:16px">Team '+esc(m.name||'Chua dat ten')+' (manager)</span><span class="node-role-pill pill-manager">MANAGER</span></div><span class="node-meta-desc">'+ls.length+' Leader · '+saleCount+' Sale</span></div></div><div class="btn-toggle-round">+</div></div><div id="root-'+esc(m.id)+'" class="tree-body-branches" hidden>'+person(m,'manager',own)+directSaleNodes+ls.map(leaderNode).join('')+'</div></div>';};
    const roots=managers.map(managerNode),orphan=leaders.filter(l=>!l.managerId||!managers.some(m=>m.id===l.managerId));
    orphan.forEach(l=>{const own=directCustomers(l,'leader'),children=sales(l).map(s=>person(s,'sale',customers.filter(c=>c.saleId===s.id))).join('');roots.push('<div class="tree-root-container"><div class="tree-root-header" data-toggle-id="orphan-'+esc(l.id)+'"><div class="tree-node-info"><div class="avatar-circle avatar-leader">'+esc(initials(l.name))+'</div><div class="node-title-group"><div class="node-name-row"><span class="node-main-name" style="font-size:16px">Team '+esc(l.name||l.teamId||'Chua dat ten')+' (leader)</span><span class="node-role-pill pill-leader">LEADER</span></div><span class="node-meta-desc">'+sales(l).length+' Sale · '+own.length+' khach</span></div></div><div class="btn-toggle-round">+</div></div><div id="orphan-'+esc(l.id)+'" class="tree-body-branches" hidden>'+person(l,'leader',own)+children+'</div></div>');});
    host.innerHTML=roots.join('')||'<div class="team-hierarchy-empty">Chua co du lieu doi ngu</div>';
    host.querySelectorAll('[data-toggle-id]').forEach(h=>h.onclick=e=>{e.preventDefault();e.stopPropagation();const n=document.getElementById(h.dataset.toggleId);if(!n)return;const open=n.hidden;n.hidden=!open;const i=h.querySelector('.btn-toggle-round');if(i)i.textContent=open?'−':'+';});
    host.querySelectorAll('[data-team-customer]').forEach(row=>{const open=()=>workflow('customer',row.dataset.teamCustomer);row.onclick=e=>{e.stopPropagation();open();};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
  }

  function team(){
    const bodies=qa('#tab-team tbody'),role=data.user.actualRole||data.user.role;
    const pendingPanel=bodies[0]?.closest('.table-container');
    if(pendingPanel){
      const isAdmin=role==='ADMIN';
      pendingPanel.hidden=!isAdmin;
      pendingPanel.style.setProperty('display',isAdmin?'':'none','important');
    }
    const pending=role==='ADMIN'?data.registeredAccounts.filter(m=>m.role==='UNASSIGNED'):[];
    const availableMembers=data.managerHierarchy?.members||data.members;
    const members=availableMembers.filter(m=>m.active!==false&&(role==='ADMIN'?['MANAGER','LEADER','SALE'].includes(m.role):role==='MANAGER'?['LEADER','SALE'].includes(m.role):m.id===data.user.leaderId||m.role==='SALE'&&m.leaderId===data.user.leaderId)).sort((a,b)=>({ADMIN:0,MANAGER:1,LEADER:2,SALE:3}[a.role]??3)-({ADMIN:0,MANAGER:1,LEADER:2,SALE:3}[b.role]??3));
    const hierarchyOverview=q('#teamHierarchyOverview');
    if(hierarchyOverview){
      if(!q('#teamHierarchyStyles')){
        const style=document.createElement('style');
        style.id='teamHierarchyStyles';
        style.textContent='.team-hierarchy-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.team-hierarchy-title{font-size:15px;color:var(--text-main);font-weight:800}.team-hierarchy-subtitle{margin-top:3px;font-size:11.5px;color:var(--text-muted)}.team-manager-group{border-top:1px solid var(--border);padding-top:14px;margin-top:14px}.team-manager-group:first-of-type{border-top:0;padding-top:0;margin-top:0}.team-manager-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--text-main);font-size:12px;font-weight:800}.team-manager-head:before{content:"";width:8px;height:8px;border-radius:50%;background:#2563eb;flex:0 0 auto}.team-leader-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}.team-leader-card{border:1px solid var(--border);border-radius:10px;background:var(--bg-subtle);overflow:hidden}.team-leader-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.team-leader-toggle:hover{background:rgba(37,99,235,.05)}.team-leader-main{display:flex;align-items:center;gap:10px;min-width:0}.team-leader-avatar,.team-sale-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#dbeafe;color:#1d4ed8;font-weight:900;font-size:13px;flex:0 0 auto}.team-leader-info{min-width:0}.team-leader-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:800;color:var(--text-main)}.team-leader-meta{display:block;margin-top:3px;font-size:11px;color:var(--text-muted)}.team-leader-chevron{font-size:18px;line-height:1;color:#64748b;flex:0 0 auto}.team-sale-list{border-top:1px solid var(--border);padding:6px 10px 9px;background:var(--bg-surface)}.team-sale-row{display:flex;align-items:center;gap:9px;padding:8px 4px}.team-sale-avatar{width:28px;height:28px;font-size:11px;background:#dcfce7;color:#15803d}.team-sale-info{min-width:0}.team-sale-name{display:block;font-size:12px;font-weight:700;color:var(--text-main)}.team-sale-phone{display:block;margin-top:2px;font-size:10.5px;color:var(--text-muted)}.team-hierarchy-empty{padding:16px 8px;color:var(--text-muted);font-size:12px;text-align:center}.team-hierarchy-more{font-size:11px;color:var(--text-muted);margin-top:2px}';
        document.head.appendChild(style);
      }
      const current=data.members.find(m=>m.id===data.user.id)||data.user;
      const scopeSource=(data.managerHierarchy?.members||data.members||[]).filter(m=>m.active!==false);
      const scopedIds=new Set(scopeSource.map(m=>m.id));
      if(current?.id&&!scopedIds.has(current.id)&&current.active!==false)scopeSource.push(current);
      const scoped=scopeSource.filter(m=>['MANAGER','LEADER','SALE'].includes(m.role));
      const managerList=(role==='ADMIN'?scoped:role==='MANAGER'?[current,...scoped.filter(m=>m.id!==current?.id&&m.role==='MANAGER')]:scoped.filter(m=>m.role==='MANAGER')).filter((m,i,a)=>m?.id&&a.findIndex(x=>x.id===m.id)===i);
      let leaderList=scoped.filter(m=>m.role==='LEADER');
      if(role==='LEADER'&&current?.id)leaderList=[current];
      if(role==='SALE'&&current?.leaderId)leaderList=scoped.filter(m=>m.id===current.leaderId&&m.role==='LEADER');
      const initials=name=>String(name||'?').trim().split(/\s+/).slice(-2).map(part=>part[0]||'').join('').toUpperCase()||'?';
      const nameOf=id=>scoped.find(m=>m.id===id)?.name||data.members.find(m=>m.id===id)?.name||'Ch 0a ph n';
      const makeLeaderCard=leader=>{
        const sales=scoped.filter(m=>m.role==='SALE'&&(role==='SALE'?m.id===current?.id:m.leaderId===leader.id));
        const manager=managerList.find(m=>m.id===leader.managerId);
        const detail=sales.length?sales.map(s=>'<div class="team-sale-row"><div class="team-sale-avatar">'+esc(initials(s.name))+'</div><div class="team-sale-info"><span class="team-sale-name">'+esc(s.name||'Ch 0a c  t 00n')+'</span><span class="team-sale-phone">'+esc(s.phone||s.accountId||'Ch 0a c  th ng tin')+'</span></div></div>').join(''):'<div class="team-hierarchy-empty">Ch 0a c  Sale trong team</div>';
        return '<div class="team-leader-card"><button type="button" class="team-leader-toggle" aria-expanded="false"><span class="team-leader-main"><span class="team-leader-avatar">'+esc(initials(leader.name))+'</span><span class="team-leader-info"><span class="team-leader-name">'+esc('Team '+(leader.name||leader.teamId||'Ch 0a ph n'))+'</span><span class="team-leader-meta">Leader: '+esc(leader.name||'—')+' · '+sales.length+' Sale'+(manager?' · Qu n l 1: '+esc(manager.name):'')+'</span></span></span><span class="team-leader-chevron">+</span></button><div class="team-sale-list" hidden>'+detail+'</div></div>';
      };
      const renderGroup=(manager,leaders)=>'<div class="team-manager-group">'+(manager?'<div class="team-manager-head">Qu n l 1: '+esc(manager.name||'—')+'</div>':'<div class="team-manager-head">Ch 0a ph n Manager</div>')+'<div class="team-leader-list">'+(leaders.length?leaders.map(makeLeaderCard).join(''):'<div class="team-hierarchy-empty">Ch 0a c  Leader</div>')+'</div></div>';
      const groups=[];
      managerList.forEach(manager=>groups.push(renderGroup(manager,leaderList.filter(leader=>leader.managerId===manager.id))));
      const unassignedLeaders=leaderList.filter(leader=>!managerList.some(manager=>manager.id===leader.managerId));
      if(unassignedLeaders.length||!groups.length)groups.push(renderGroup(null,unassignedLeaders.length?unassignedLeaders:leaderList));
      hierarchyOverview.innerHTML='<div class="team-hierarchy-head"><div><div class="team-hierarchy-title">C 0y ng 5</div><div class="team-hierarchy-subtitle">B 1m v o Leader/Team    xem Sale ph  tr ch</div></div></div>'+(groups.join('')||'<div class="team-hierarchy-empty">Ch 0a c  d 0 li u  1 i ng 5</div>');
      hierarchyOverview.querySelectorAll('.team-leader-toggle').forEach(button=>{button.onclick=()=>{const detail=button.nextElementSibling,open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));const icon=button.querySelector('.team-leader-chevron');if(icon)icon.textContent=open?'−':'+';};});
    }
    // Dynamic team hierarchy is rendered above this table.
    if(hierarchyOverview){
      const hierarchyCurrent=data.members.find(m=>m.id===data.user.id)||data.user;
      const hierarchySource=(data.managerHierarchy?.members||data.members||[]).filter(m=>m.active!==false);
      if(hierarchyCurrent?.id&&!hierarchySource.some(m=>m.id===hierarchyCurrent.id)&&hierarchyCurrent.active!==false)hierarchySource.push(hierarchyCurrent);
      const hierarchyMembers=hierarchySource.filter(m=>['MANAGER','LEADER','SALE'].includes(m.role));
      const hierarchyManagers=(role==='ADMIN'?hierarchyMembers.filter(m=>m.role==='MANAGER'):role==='MANAGER'?[hierarchyCurrent,...hierarchyMembers.filter(m=>m.role==='MANAGER'&&m.id!==hierarchyCurrent?.id)]:[]).filter((m,i,a)=>m?.id&&a.findIndex(x=>x.id===m.id)===i);
      let hierarchyLeaders=hierarchyMembers.filter(m=>m.role==='LEADER');
      if(role==='LEADER'&&hierarchyCurrent?.id)hierarchyLeaders=[hierarchyCurrent];
      if(role==='SALE'&&hierarchyCurrent?.leaderId)hierarchyLeaders=hierarchyMembers.filter(m=>m.id===hierarchyCurrent.leaderId&&m.role==='LEADER');
      const initials=name=>String(name||'?').trim().split(/\s+/).slice(-2).map(part=>part[0]||'').join('').toUpperCase()||'?';
      const displayTeamName=member=>{
        if(member?.role==='MANAGER')return 'Team '+(member.name||member.teamId||'Chua phan')+' (manager)';
        const leader=hierarchyMembers.find(m=>m.role==='LEADER'&&(member.role==='LEADER'?m.id===member.id:m.id===member.leaderId));
        if(leader)return 'Team '+(leader.name||leader.teamId||'Chua phan')+' (leader)';
        return member?.teamId?'Team '+member.teamId:'Chua phan Team';
      };
      const leaderCard=leader=>{
        const sales=hierarchyMembers.filter(m=>m.role==='SALE'&&(role==='SALE'?m.id===hierarchyCurrent?.id:m.leaderId===leader.id));
        const manager=hierarchyManagers.find(m=>m.id===leader.managerId);
        const saleRows=sales.length?sales.map(s=>'<div class="team-sale-row"><div class="team-sale-avatar">'+esc(initials(s.name))+'</div><div class="team-sale-info"><span class="team-sale-name">'+esc(s.name||'Ch&#432;a c&#243; t&#234;n')+'</span><span class="team-sale-phone">'+esc(s.phone||s.accountId||'Ch&#432;a c&#243; th&#244;ng tin')+'</span></div></div>').join(''):'<div class="team-hierarchy-empty">Ch&#432;a c&#243; Sale trong team</div>';
        return '<div class="team-leader-card"><button type="button" class="team-leader-toggle" aria-expanded="false"><span class="team-leader-main"><span class="team-leader-avatar">'+esc(initials(leader.name))+'</span><span class="team-leader-info"><span class="team-leader-name">'+esc(displayTeamName(leader))+'</span><span class="team-leader-meta">Leader: '+esc(leader.name||'Chua phan')+' &middot; '+sales.length+' Sale'+(manager?' &middot; Qu&#7843;n l&#253;: '+esc(manager.name):'')+'</span></span></span><span class="team-leader-chevron">+</span></button><div class="team-sale-list" hidden>'+saleRows+'</div></div>';
      };
      const hierarchyGroups=[];
      hierarchyManagers.forEach(manager=>hierarchyGroups.push('<div class="team-manager-group"><div class="team-manager-head">'+esc(displayTeamName(manager))+'</div><div class="team-leader-list">'+(hierarchyLeaders.filter(leader=>leader.managerId===manager.id).map(leaderCard).join('')||'<div class="team-hierarchy-empty">Ch&#432;a c&#243; Leader</div>')+'</div></div>'));
      const unassignedLeaders=hierarchyLeaders.filter(leader=>!hierarchyManagers.some(manager=>manager.id===leader.managerId));
      if(unassignedLeaders.length||!hierarchyGroups.length)hierarchyGroups.push('<div class="team-manager-group"><div class="team-manager-head">Ch&#432;a ph&#226;n Manager</div><div class="team-leader-list">'+(unassignedLeaders.length?unassignedLeaders.map(leaderCard).join(''):'<div class="team-hierarchy-empty">Ch&#432;a c&#243; d&#7919; li&#7879;u &#273;&#7897;i ng&#361;</div>')+'</div></div>');
      hierarchyOverview.innerHTML='<div class="team-hierarchy-head"><div><div class="team-hierarchy-title">C&#226;y ng&#361; &#273;&#7897;i ng&#361;</div><div class="team-hierarchy-subtitle">B&#7845;m v&#224;o Leader/Team &#273;&#7875; xem c&#225;c Sale ph&#7909; tr&#225;ch</div></div></div>'+hierarchyGroups.join('');
      hierarchyOverview.querySelectorAll('.team-leader-toggle').forEach(button=>button.onclick=()=>{
        const detail=button.nextElementSibling;
        const open=detail.hidden;
        detail.hidden=!open;
        button.setAttribute('aria-expanded',String(open));
      });
    }
    // Dat lai cay hien thi sau khoi render cu de dam bao Manager/Leader luon dung cap.
    renderTeamHierarchyV6();
    const start=q('#teamStartDate')?.value,end=q('#teamEndDate')?.value;
    const revenue=m=>(data.managerHierarchy?.financialEvents||data.financialEvents).filter(e=>(!start||e.occurredAt?.slice(0,10)>=start)&&(!end||e.occurredAt?.slice(0,10)<=end)&&(data.managerHierarchy?.orders||data.orders).some(o=>o.id===e.orderId&&(m.role==='LEADER'?o.leaderId===m.id:o.saleId===m.id))).reduce((s,e)=>s+Number(e.amount||0),0);
    const customers=m=>(data.managerHierarchy?.customers||data.customers).filter(c=>m.role==='MANAGER'?(c.ownerId===m.id||c.saleId===m.id):m.role==='LEADER'?(c.saleId===m.id||(c.leaderId===m.id&&!c.saleId)):c.saleId===m.id).length;
    table(bodies[0],pending.map(m=>[m.name,m.phone,m.email,'Chờ phân chức vụ','']));
    Array.from(bodies[0]?.rows||[]).forEach((r,i)=>{const b=r.querySelector('button');if(b){b.removeAttribute('onclick');b.onclick=()=>memberEditor(pending[i].id);b.disabled=data.user.role!=='ADMIN';}});
    const teamColumnName=m=>m.role==='MANAGER'?'Team '+(m.name||m.teamId||'Chua phan')+' (manager)':(data.members.find(x=>x.role==='LEADER'&&(m.role==='LEADER'?x.id===m.id:x.id===m.leaderId))?('Team '+(data.members.find(x=>x.role==='LEADER'&&(m.role==='LEADER'?x.id===m.id:x.id===m.leaderId)).name||'Chua phan')+' (leader)'):(m.teamId?'Team '+m.teamId:'Chua phan Team'));
    table(bodies[1],members.map(m=>[m.name+(m.phone?' · '+m.phone:''),m.role,teamColumnName(m),m.managerId?person(m.managerId):m.leaderId?person(m.leaderId):'—',customers(m),money(revenue(m)),'']));
    Array.from(bodies[1]?.rows||[]).forEach((r,i)=>{const m=members[i],buttons=r.querySelectorAll('button');buttons.forEach(b=>{b.removeAttribute('onclick');b.disabled=data.user.role!=='ADMIN';});if(buttons[0])buttons[0].onclick=()=>memberEditor(m.id);if(buttons[1]){buttons[1].onclick=()=>passwordEditor(m.id);buttons[1].disabled=data.user.role!=='ADMIN'||!m.loginEnabled;}if(buttons[2]){buttons[2].disabled=data.user.role!=='ADMIN'||!['SALE','LEADER'].includes(m.role)||m.id===data.user.id;buttons[2].onclick=()=>{if(confirm('Xóa thành viên khỏi đội ngũ và thu hồi khách theo quy trình hiện có?'))run(()=>api.removeMember(m.id));};}});
    const add=q('#tab-team .headline-row button');add.removeAttribute('onclick');add.onclick=()=>memberEditor();add.disabled=data.user.role!=='ADMIN';
    const description=bodies[0]?.closest('.table-container')?.querySelector('.table-head-bar > div > div');if(description)description.textContent='Admin phân chức vụ trước khi tài khoản được sử dụng.';
    const cards=qa('#tab-team .kpi-bento-card');
    const scopedCustomers=data.managerHierarchy?.customers||data.customers||[];
    const scopedOrders=data.managerHierarchy?.orders||data.orders||[];
    const scopedEvents=data.managerHierarchy?.financialEvents||data.financialEvents||[];
    const scopedTasks=data.managerHierarchy?.tasks||data.tasks||[];
    const inRange=value=>(!start||String(value||'').slice(0,10)>=start)&&(!end||String(value||'').slice(0,10)<=end);
    const eventOrderIds=new Set(scopedOrders.map(order=>order.id));
    const teamRevenueValue=money(scopedEvents.filter(event=>eventOrderIds.has(event.orderId)&&inRange(event.occurredAt)).reduce((sum,event)=>sum+Number(event.amount||0),0));
    const activeTasks=scopedTasks.filter(task=>task.status!=='DONE');
    const parseDate=value=>{const raw=String(value||'').trim();if(!raw)return NaN;const normalized=raw.includes('T')?raw:raw.replace(' ','T');return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)?normalized:normalized+'+07:00');};
    const isOverdue=task=>task.status==='OVERDUE'||(task.status!=='DONE'&&Number.isFinite(parseDate(task.dueAt))&&parseDate(task.dueAt)<Date.now());
    const overdueTasks=activeTasks.filter(task=>inRange(task.dueAt||task.createdAt)&&isOverdue(task));
    const assignedCustomers=scopedCustomers.filter(customer=>[customer.saleId,customer.leaderId,customer.managerId,customer.ownerId,customer.teamId].some(Boolean));
    const calledCustomers=assignedCustomers.filter(customer=>['Đã gọi được','Đã gọi','Đã kết nối'].includes(customer.customFields?.callStatus)||customer.customFields?.callStatus==='Đã gọi được');
    const paidOrders=scopedOrders.filter(order=>inRange(order.paidAt||order.createdAt)&&['PAID','COURSE_GRANTED'].includes(order.status));
    const target=members.filter(member=>member.role==='SALE').reduce((sum,member)=>sum+Number(member.target||0),0);
    const progress=target?Math.min(100,scopedEvents.filter(event=>eventOrderIds.has(event.orderId)&&inRange(event.occurredAt)).reduce((sum,event)=>sum+Number(event.amount||0),0)/target*100):0;
    const metrics=[members.length,teamRevenueValue,assignedCustomers.length,overdueTasks.length];
    cards.forEach((card,i)=>{primaryText(card.querySelector('.kpi-hero-num'),metrics[i]);});
    cards[0]?.querySelectorAll('.kpi-foot-stat .value').forEach((node,i)=>{if(i===0)node.textContent=members.filter(member=>member.role==='LEADER').length+' người';else if(i===1)node.textContent=members.filter(member=>member.role==='SALE').length+' người';else node.textContent=members.length?'100%':'0%';});
    const online=cards[0]?.querySelector('.kpi-trend-pill');if(online)online.textContent=members.length+' hoạt động';
    const foot=(i,values)=>cards[i]?.querySelectorAll('.kpi-foot-stat .value').forEach((n,j)=>n.textContent=values[j]);
    foot(1,[paidOrders.length+' đơn',target?money(target):'Chưa đặt',target?progress.toFixed(1)+'%':'—']);
    foot(2,[assignedCustomers.length+' khách',(scopedCustomers.length-assignedCustomers.length)+' khách',assignedCustomers.length?(calledCustomers.length/assignedCustomers.length*100).toFixed(1)+'%':'—']);
    const overdueAge=task=>{const due=parseDate(task.dueAt);return Number.isFinite(due)?Math.max(0,Date.now()-due):0;};
    foot(3,[overdueTasks.filter(task=>overdueAge(task)>=86400000).length,overdueTasks.filter(task=>overdueAge(task)>=172800000).length,activeTasks.length?((activeTasks.length-overdueTasks.length)/activeTasks.length*100).toFixed(1)+'%':'—']);
    const exportButton=qa('#tab-team button').find(b=>b.textContent.trim()==='Xuất CSV');if(exportButton){exportButton.removeAttribute('onclick');exportButton.onclick=()=>{const rows=[['Họ tên','SĐT','Email','Chức vụ','Team','Khách hàng','Doanh thu'],...members.map(m=>[m.name,m.phone,m.email,m.role,m.teamId,customers(m),revenue(m)])];const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='doi-ngu.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}
    renderTeamHierarchyV6();
    const hierarchyStats=(data.managerHierarchy?.members||data.members||[]).filter(member=>member.active!==false&&['MANAGER','LEADER','SALE'].includes(member.role));
    const memberCard=qa('#tab-team .kpi-bento-card')[0];
    if(memberCard){
      primaryText(memberCard.querySelector('.kpi-hero-num'),hierarchyStats.length);
      memberCard.querySelectorAll('.kpi-foot-stat .value').forEach((node,index)=>{node.textContent=index===0?hierarchyStats.filter(member=>member.role==='LEADER').length+' người':index===1?hierarchyStats.filter(member=>member.role==='SALE').length+' người':hierarchyStats.length?'100%':'0%';});
      const online=memberCard.querySelector('.kpi-trend-pill');if(online)online.textContent=hierarchyStats.length+' Online';
    }
  }
  function announcementEditor(){
    styleTelegramStudio();
    q('#referenceEditor')?.remove();
    const modal=document.createElement('div');
    modal.id='referenceEditor';
    modal.className='modal-overlay open';
    modal.innerHTML=`
      <div class="modal-card telegram-admin-studio" role="dialog" aria-modal="true" aria-labelledby="refEditorTitle">
        <div class="telegram-studio-head">
          <div class="telegram-studio-head-main">
            <span class="telegram-studio-icon">📢</span>
            <div>
              <h3 id="refEditorTitle">Tạo thông báo Telegram</h3>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <button type="button" class="modal-close-btn" data-editor-close aria-label="Đóng">&times;</button>
          </div>
        </div>
        <div class="telegram-studio-body">
          <div class="telegram-presets-heading">
            <span>Mẫu thông báo</span>
            <button type="button" data-telegram-reset>Tự soạn</button>
          </div>
          <div data-telegram-presets></div>
          <form data-telegram-form>
            <input type="hidden" data-telegram-type value="MEETING">
            <div class="telegram-form-top">
              <div style="display:flex;align-items:center;gap:8px">
                <span data-telegram-active-badge class="telegram-active-badge" data-tone="blue"><span>📅</span> <span>Họp tổng tuần</span></span>
              </div>
              <label style="font-size:12px;font-weight:700;color:#334155;display:flex;align-items:center;gap:8px;margin:0">
                <span>Người nhận</span>
                <select data-telegram-target style="min-height:36px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:8px;font-weight:700;color:#1e293b;width:auto">
                  <option value="ALL">🌐 Toàn bộ Agency (Sale + Leader + Manager)</option>
                  <option value="SALE">💼 Chỉ Đội ngũ Sales / Tư vấn</option>
                  <option value="MANAGERS">🎖️ Chỉ Ban Quản Lý (Leader & Manager)</option>
                </select>
              </label>
            </div>
            <label style="display:block;margin-top:12px;font-size:12.5px;font-weight:800;color:#1e335f">Tiêu đề</label>
            <input required maxlength="200" data-telegram-title placeholder="Nhập tiêu đề">
            <div data-telegram-meeting class="telegram-meeting-box">
              <label style="font-size:12px;font-weight:700;color:#1e3a8a">
                Thời gian họp
                <input data-telegram-time placeholder="VD: 16:30 chiều nay">
              </label>
              <label style="font-size:12px;font-weight:700;color:#1e3a8a">
                Link họp
                <input data-telegram-link placeholder="meet.google.com/...">
              </label>
              <div class="telegram-meeting-reminder">
                <div class="telegram-meeting-reminder-copy">
                  <span><strong>Nhắc lịch</strong></span>
                </div>
                <select data-telegram-remind>
                  <option value="15">⏰ Nhắc trước 15 phút (Khuyên dùng)</option>
                  <option value="30">⏰ Nhắc trước 30 phút</option>
                  <option value="45">⏰ Nhắc trước 45 phút</option>
                  <option value="60">⏰ Nhắc trước 1 tiếng</option>
                  <option value="120">⏰ Nhắc trước 2 tiếng</option>
                  <option value="0">❌ Không nhắc</option>
                </select>
              </div>
            </div>
            <label style="display:block;margin-top:12px;font-size:12.5px;font-weight:800;color:#1e335f">
              Người gửi
              <input data-telegram-host value="Ban Quản Trị NVT Agency">
            </label>
            <label style="display:block;margin-top:12px;font-size:12.5px;font-weight:800;color:#1e335f">
              Ná»™i dung
              <textarea required maxlength="4000" rows="4" data-telegram-content></textarea>
            </label>
            <div class="telegram-send-row"><div style="display:flex;justify-content:flex-end;gap:8px;width:100%">
                <button type="button" class="btn-secondary" data-editor-close>Đóng</button>
                <button type="submit" class="btn-primary" data-telegram-send>Gửi thông báo</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-editor-close]').forEach(btn=>btn.onclick=()=>modal.remove());
    modal.onclick=e=>{if(e.target===modal)modal.remove();};
    const form=modal.querySelector('[data-telegram-form]');
    const presetsContainer=modal.querySelector('[data-telegram-presets]');
    Object.entries(telegramTemplates).forEach(([key,item])=>{
      const b=document.createElement('button');
      b.type='button';
      b.dataset.telegramPreset=key;
      b.dataset.tone=item.tone;
      b.innerHTML='<div class="preset-top"><span class="preset-icon">'+item.icon+'</span><span class="preset-badge">'+item.badge+'</span></div><strong class="preset-title">'+item.title+'</strong><span class="preset-desc">'+item.desc+'</span>';
      b.onclick=()=>{
        modal.querySelectorAll('[data-telegram-preset]').forEach(n=>n.classList.remove('is-selected'));
        b.classList.add('is-selected');
        const typeInput=modal.querySelector('[data-telegram-type]');
        if(typeInput)typeInput.value=item.type;
        modal.querySelector('[data-telegram-target]').value=item.target;
        modal.querySelector('[data-telegram-title]').value=item.title;
        modal.querySelector('[data-telegram-content]').value=item.content;
        const timeInput=modal.querySelector('[data-telegram-time]');if(timeInput)timeInput.value=item.time||'';
        const linkInput=modal.querySelector('[data-telegram-link]');if(linkInput)linkInput.value=item.link||'';
        const hostInput=modal.querySelector('[data-telegram-host]');if(hostInput)hostInput.value=item.host||'Ban Quản Trị NVT Agency';
        toggleTelegramMeeting(modal);
      };
      presetsContainer.appendChild(b);
    });
    modal.querySelector('[data-telegram-reset]').onclick=()=>{
      modal.querySelectorAll('[data-telegram-preset]').forEach(n=>n.classList.remove('is-selected'));
      const typeInput=modal.querySelector('[data-telegram-type]');
      if(typeInput)typeInput.value='CUSTOM';
      modal.querySelector('[data-telegram-title]').value='';
      modal.querySelector('[data-telegram-content]').value='';
      const timeInput=modal.querySelector('[data-telegram-time]');if(timeInput)timeInput.value='';
      const linkInput=modal.querySelector('[data-telegram-link]');if(linkInput)linkInput.value='';
      toggleTelegramMeeting(modal);
      modal.querySelector('[data-telegram-title]')?.focus();
    };
    presetsContainer.querySelector('[data-telegram-preset="meeting_weekly"]')?.click();
    form.onsubmit=e=>{
      e.preventDefault();
      const get=s=>modal.querySelector(s)?.value?.trim()||'';
      const remindSelect=modal.querySelector('[data-telegram-remind]');
      const title=get('[data-telegram-title]'), content=get('[data-telegram-content]');
      run(async ()=>{
        const res=await api.telegramBroadcast({
          type:get('[data-telegram-type]'),target:get('[data-telegram-target]'),title:title,content:content,host:get('[data-telegram-host]'),
          meeting_time:modal.querySelector('[data-telegram-time]')?.value||null,meeting_link:get('[data-telegram-link]'),remind_minutes:remindSelect?Number(remindSelect.value):0
        });
        try{await api.announce({title:title,text:content});}catch(_){}
        return res;
      },(result)=>{
        referenceNotice(`Đã bắn thông báo Telegram và lưu hệ thống CRM tới ${result?.sent||0} tài khoản.`);
        modal.remove();refresh(true);
      });
    };
  }
  function notificationSettings(){
    const keys={dataBotToken:'Bot báo data · Token',dataBotChatId:'Bot báo data · Chat ID',memberBotToken:'Bot báo thành viên · Token',memberBotChatId:'Bot báo thành viên · Chat ID'};
    editor('Cài đặt thông báo',Object.entries(keys).map(([key,label])=>formField(label,`<input id="ref-${key}" type="${key.endsWith('Token')?'password':'text'}" autocomplete="off" value="${esc(data.settings[key]||'')}">`)).join(''),()=>api.settings(Object.fromEntries(Object.keys(keys).map(k=>[k,q('#ref-'+k).value.trim()]))));
  }
  const telegramTemplates={
    meeting_weekly:{type:'MEETING',title:'Họp tổng kết tuần & Trao thưởng Top 1 Doanh số',content:'Toàn bộ nhân sự Sale và Leader có mặt đúng giờ để tổng kết kết quả kinh doanh tuần qua, phổ biến mục tiêu tuần mới và trao thưởng nóng cho các cá nhân xuất sắc.',time:'16:30 chiều nay',link:'meet.google.com/nvt-agency-meet',host:'Ban Giám Đốc NVT Agency',target:'ALL',icon:'📅',badge:'Lịch họp',desc:'Tổng kết số & trao thưởng',tone:'blue'},
    reward_fast:{type:'REWARD',title:'Chính sách thưởng nóng: Chốt cọc trong vòng 2 giờ!',content:'Từ hôm nay, bất kỳ đơn hàng nào được Sale tiếp nhận và chốt cọc thành công trong vòng 2 tiếng sẽ được nhận THƯỞNG NÓNG 500.000 VNĐ + cộng thêm 5% hoa hồng trực tiếp!',time:'',link:'',host:'Ban Quản Trị NVT Agency',target:'SALE',icon:'⚡',badge:'Thưởng nóng',desc:'+5% hoa hồng trong 2h',tone:'green'},
    honor_bestseller:{type:'REWARD',title:'VINH DANH BEST SELLER TUẦN: BÙNG NỔ 120 TRIỆU DOANH SỐ!',content:'Nhiệt liệt biểu dương chiến binh xuất sắc đã cán mốc doanh số ấn tượng nhất tuần qua. Tinh thần kỷ luật và bám sát khách hàng của bạn là tấm gương cho toàn Agency noi theo! 🔥',time:'',link:'',host:'Ban Giám Đốc & Khối Kinh Doanh',target:'ALL',icon:'🏆',badge:'Vinh danh',desc:'Khen thưởng bão đơn tuần',tone:'amber'},
    stale_warning:{type:'WARNING',title:'CẢNH BÁO: XỬ LÝ DỨT ĐIỂM DATA NÓNG TỒN ĐỌNG TRƯỚC 18H00',content:'Hiện tại hệ thống phát hiện vẫn còn một số data nhận từ sáng chưa được cập nhật cuộc gọi hoặc ghi chú. Yêu cầu toàn bộ Sale liên hệ ngay trước 18h00 để tránh hệ thống tự động thu hồi về hàng chờ.',time:'Trước 18:00 hôm nay',link:'',host:'Bộ Phận Vận Hành & Trưởng Nhóm Sale',target:'SALE',icon:'⚠️',badge:'Cảnh báo',desc:'Yêu cầu dứt điểm trước 18h',tone:'red'},
    morning_motivation:{type:'MOTIVATION',title:'CHÚC TOÀN THỂ NVT AGENCY TUẦN MỚI BÃO ĐƠN & BỨT PHÁ!',content:'Thị trường đang có những tín hiệu rất đẹp, data khách hàng quan tâm khóa học và chỉ báo đang đổ về liên tục. Chúc anh em Sale tuần này bội thu doanh số và đạt mốc thưởng cao nhất! 🚀',time:'',link:'',host:'Ban Lãnh Đạo Agency',target:'ALL',icon:'🚀',badge:'Động viên',desc:'Khí thế bứt phá đầu tuần',tone:'purple'},
    emergency_meet:{type:'MEETING',title:'HỌP KHẨN CẤP: TRIỂN KHAI CHIẾN DỊCH QUẢNG CÁO MỚI',content:'Họp khẩn toàn bộ Leader và Sale để cập nhật kịch bản chốt đơn cho luồng data mới từ TikTok và Google Ads.',time:'14:00 hôm nay (Bắt buộc)',link:'meet.google.com/nvt-khan-cap',host:'CEO & Marketing Director',target:'MANAGERS',icon:'🚨',badge:'Khẩn cấp',desc:'Họp Leader & Sale gấp',tone:'red'}
  };
  function toggleTelegramMeeting(root){
    if(!root)root=q('#adminTelegramStudio');
    if(!root)return;
    const type=root.querySelector('[data-telegram-type]')?.value||'CUSTOM';
    const isMeeting=type==='MEETING';
    const meetingBox=root.querySelector('[data-telegram-meeting]');
    if(meetingBox){
      meetingBox.classList.toggle('is-hidden',!isMeeting);
      meetingBox.style.setProperty('display',isMeeting?'grid':'none','important');
    }
    const form=root.querySelector('[data-telegram-form]');
    const activePreset=root.querySelector('[data-telegram-preset].is-selected');
    const tone=activePreset?.dataset?.tone||(isMeeting?'blue':'default');
    if(form)form.dataset.tone=tone;
    const activeBadge=root.querySelector('[data-telegram-active-badge]');
    if(activeBadge){
      if(activePreset){
        const icon=activePreset.querySelector('.preset-icon')?.textContent||'📢';
        const title=activePreset.querySelector('.preset-title')?.textContent||'';
        activeBadge.innerHTML='<span>'+icon+'</span> <span>'+esc(title)+'</span>';
        activeBadge.dataset.tone=tone;
      }else{
        activeBadge.innerHTML='<span>✏️</span> <span>Tự soạn nội dung</span>';
        activeBadge.dataset.tone='default';
      }
    }
  }
  function styleTelegramStudio(root){
    if(!q('#telegramAdminStudioStyles')){const style=document.createElement('style');style.id='telegramAdminStudioStyles';style.textContent=`
      .telegram-admin-studio{font-family:Arial,"Segoe UI",sans-serif!important;font-size:13px!important;margin:0 0 24px!important;padding:0!important;border:1.5px solid #c7d2fe!important;border-radius:18px!important;background:#f8fafc!important;overflow:hidden;box-shadow:0 8px 24px rgba(37,99,235,.06)!important;color:#13224f}
      #referenceEditor .modal-card.telegram-admin-studio{width:min(780px,calc(100vw - 28px))!important;max-height:92dvh!important;overflow-y:auto!important;border-radius:20px!important;box-shadow:0 20px 50px rgba(15,23,42,.22),0 0 0 1px rgba(99,102,241,.1)!important;background:#fff!important}
      .telegram-admin-studio .telegram-studio-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important;padding:14px 18px!important;background:linear-gradient(120deg,#f5f3ff,#eef4ff)!important;border-bottom:1px solid #e2e8f0!important}
      .telegram-admin-studio .telegram-studio-head-main{display:flex!important;align-items:center!important;gap:12px!important}
      .telegram-admin-studio .telegram-studio-icon{width:38px!important;height:38px!important;display:grid!important;place-items:center!important;border-radius:10px!important;background:linear-gradient(145deg,#8b1eea,#5b22d8)!important;color:#fff!important;font-size:20px!important;box-shadow:0 6px 14px rgba(99,42,216,.25)!important;flex-shrink:0!important}
      .telegram-admin-studio h2,.telegram-admin-studio h3{margin:0!important;color:#111b3f!important;font-size:18px!important;font-family:Arial,"Segoe UI",sans-serif!important;font-weight:800!important;line-height:1.25!important}
      .telegram-admin-studio .telegram-subtitle,.telegram-admin-studio .telegram-admin-tag{display:none!important}
      .telegram-admin-studio .telegram-admin-tag{padding:6px 12px!important;border:1px solid #dfc8fa!important;border-radius:8px!important;background:#f2e7ff!important;color:#6d2bb1!important;font-size:11px!important;font-weight:900!important;letter-spacing:.3px!important}
      .telegram-admin-studio .modal-close-btn{width:32px!important;height:32px!important;display:grid!important;place-items:center!important;border-radius:8px!important;background:transparent!important;border:none!important;font-size:24px!important;color:#64748b!important;cursor:pointer!important;line-height:1!important;transition:all .15s ease!important}
      .telegram-admin-studio .modal-close-btn:hover{background:#e2e8f0!important;color:#0f172a!important}
      .telegram-admin-studio .telegram-studio-body{padding:14px 18px 18px!important;background:#f8fafc!important}
      .telegram-admin-studio .telegram-presets-heading{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin-bottom:8px!important;color:#334155!important;font-size:13px!important;font-weight:800!important;text-transform:none!important;letter-spacing:0!important}
      .telegram-admin-studio [data-telegram-reset]{border:0!important;background:none!important;color:#6d28d9!important;font:700 12px inherit!important;cursor:pointer!important;padding:4px 6px!important;border-radius:6px!important;display:inline-flex!important;align-items:center!important;gap:4px!important;transition:background .15s ease!important}
      .telegram-admin-studio [data-telegram-reset]:hover{background:#ede9fe!important}
      .telegram-admin-studio [data-telegram-presets]{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin:0 0 12px!important}
      @media(max-width:680px){.telegram-admin-studio [data-telegram-presets]{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:440px){.telegram-admin-studio [data-telegram-presets]{grid-template-columns:1fr!important}}
      .telegram-admin-studio [data-telegram-preset]{position:relative!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;min-height:78px!important;padding:9px 11px!important;border:1.5px solid #e2e8f0!important;border-radius:10px!important;background:#fff!important;cursor:pointer!important;text-align:left!important;transition:all .16s ease!important;box-shadow:0 1px 3px rgba(0,0,0,.04)!important;color:#1e293b!important;font-family:inherit!important}
      .telegram-admin-studio [data-telegram-preset]:hover{transform:translateY(-2px)!important;box-shadow:0 6px 14px rgba(15,23,42,.08)!important}
      .telegram-admin-studio [data-telegram-preset] .preset-top{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;margin-bottom:6px!important}
      .telegram-admin-studio [data-telegram-preset] .preset-icon{font-size:18px!important;line-height:1!important}
      .telegram-admin-studio [data-telegram-preset] .preset-badge{display:inline-block!important;padding:2.5px 7px!important;border-radius:6px!important;font-size:10.5px!important;font-weight:800!important;line-height:1.2!important}
      .telegram-admin-studio [data-telegram-preset] .preset-title{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;font-size:12px!important;font-weight:800!important;line-height:1.35!important;color:inherit!important;margin:0 0 3px!important}
      .telegram-admin-studio [data-telegram-preset] .preset-desc{display:none!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=blue] .preset-badge{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #dbeafe!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=blue]:hover{border-color:#93c5fd!important;background:#fbfdff!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=blue].is-selected{border-color:#2563eb!important;background:#f0f7ff!important;box-shadow:0 0 0 3px rgba(37,99,235,.2),0 6px 14px rgba(37,99,235,.12)!important;transform:translateY(-2px)!important;color:#1d4ed8!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=green] .preset-badge{background:#ecfdf5!important;color:#047857!important;border:1px solid #d1fae5!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=green]:hover{border-color:#86efac!important;background:#fbfefc!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=green].is-selected{border-color:#10b981!important;background:#f0fdf4!important;box-shadow:0 0 0 3px rgba(16,185,129,.2),0 6px 14px rgba(16,185,129,.12)!important;transform:translateY(-2px)!important;color:#047857!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=amber] .preset-badge{background:#fffbeb!important;color:#b45309!important;border:1px solid #fef3c7!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=amber]:hover{border-color:#fde047!important;background:#fffefb!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=amber].is-selected{border-color:#f59e0b!important;background:#fffbeb!important;box-shadow:0 0 0 3px rgba(245,158,11,.2),0 6px 14px rgba(245,158,11,.12)!important;transform:translateY(-2px)!important;color:#b45309!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=red] .preset-badge{background:#fef2f2!important;color:#dc2626!important;border:1px solid #fee2e2!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=red]:hover{border-color:#fca5a5!important;background:#fffbfb!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=red].is-selected{border-color:#ef4444!important;background:#fef2f2!important;box-shadow:0 0 0 3px rgba(239,68,68,.2),0 6px 14px rgba(239,68,68,.12)!important;transform:translateY(-2px)!important;color:#dc2626!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=purple] .preset-badge{background:#faf5ff!important;color:#7c3aed!important;border:1px solid #ede9fe!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=purple]:hover{border-color:#d8b4fe!important;background:#fdfbff!important}
      .telegram-admin-studio [data-telegram-preset][data-tone=purple].is-selected{border-color:#8b5cf6!important;background:#faf5ff!important;box-shadow:0 0 0 3px rgba(139,92,246,.2),0 6px 14px rgba(139,92,246,.12)!important;transform:translateY(-2px)!important;color:#7c3aed!important}
      .telegram-admin-studio [data-telegram-form]{padding:15px 16px!important;border:1.5px solid #3b82f6!important;border-radius:13px!important;background:#fff!important;box-shadow:0 4px 14px rgba(59,130,246,.08)!important;transition:border-color .2s ease,box-shadow .2s ease!important}
      .telegram-admin-studio [data-telegram-form][data-tone=blue]{border-color:#3b82f6!important;box-shadow:0 4px 18px rgba(59,130,246,.12)!important}
      .telegram-admin-studio [data-telegram-form][data-tone=green]{border-color:#10b981!important;box-shadow:0 4px 18px rgba(16,185,129,.12)!important}
      .telegram-admin-studio [data-telegram-form][data-tone=amber]{border-color:#f59e0b!important;box-shadow:0 4px 18px rgba(245,158,11,.12)!important}
      .telegram-admin-studio [data-telegram-form][data-tone=red]{border-color:#ef4444!important;box-shadow:0 4px 18px rgba(239,68,68,.15)!important}
      .telegram-admin-studio [data-telegram-form][data-tone=purple]{border-color:#8b5cf6!important;box-shadow:0 4px 18px rgba(139,92,246,.12)!important}
      .telegram-admin-studio [data-telegram-form][data-tone=default]{border-color:#cbd5e1!important;box-shadow:0 3px 12px rgba(15,23,42,.05)!important}
      .telegram-admin-studio .telegram-form-top{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:10px!important;flex-wrap:wrap!important;padding-bottom:10px!important;border-bottom:1px solid #f1f5f9!important}
      .telegram-admin-studio .telegram-form-top>label{display:flex!important;align-items:center!important;gap:8px!important;min-width:min(100%,300px)!important;flex:1 1 300px!important}
      .telegram-admin-studio .telegram-active-badge{display:inline-flex!important;align-items:center!important;gap:6px!important;padding:5px 10px!important;border-radius:8px!important;font-size:11.5px!important;font-weight:700!important;border:1px solid transparent!important}
      .telegram-admin-studio .telegram-active-badge[data-tone=blue]{background:#eff6ff!important;color:#1d4ed8!important;border-color:#bfdbfe!important}
      .telegram-admin-studio .telegram-active-badge[data-tone=green]{background:#ecfdf5!important;color:#047857!important;border-color:#a7f3d0!important}
      .telegram-admin-studio .telegram-active-badge[data-tone=amber]{background:#fffbeb!important;color:#b45309!important;border-color:#fde68a!important}
      .telegram-admin-studio .telegram-active-badge[data-tone=red]{background:#fef2f2!important;color:#dc2626!important;border-color:#fecaca!important}
      .telegram-admin-studio .telegram-active-badge[data-tone=purple]{background:#faf5ff!important;color:#7c3aed!important;border-color:#ddd6fe!important}
      .telegram-admin-studio .telegram-active-badge[data-tone=default]{background:#f1f5f9!important;color:#475569!important;border-color:#cbd5e1!important}
      .telegram-admin-studio label{display:block!important;color:#1e335f!important;font-size:13px!important;font-weight:700!important;line-height:1.35!important}
      .telegram-admin-studio input,.telegram-admin-studio select,.telegram-admin-studio textarea{width:100%!important;box-sizing:border-box!important;margin-top:5px!important;padding:8px 12px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;color:#0f172a!important;font:500 13px/1.35 Arial,"Segoe UI",sans-serif!important;outline:none!important;transition:border-color .15s ease,box-shadow .15s ease!important}
      .telegram-admin-studio input:focus,.telegram-admin-studio select:focus,.telegram-admin-studio textarea:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)!important}
      .telegram-admin-studio textarea{min-height:86px!important;resize:vertical!important;line-height:1.45!important}
      .telegram-admin-studio .telegram-meeting-box{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:12px!important;padding:12px 14px!important;border:1.5px solid #bfdbfe!important;border-radius:12px!important;background:#f0f7ff!important}
      .telegram-admin-studio .telegram-meeting-box.is-hidden{display:none!important}
      .telegram-admin-studio .telegram-meeting-reminder{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;grid-column:1/-1!important;padding-top:10px!important;border-top:1px solid #dbeafe!important;flex-wrap:wrap!important}
      .telegram-admin-studio .telegram-meeting-reminder-copy{display:flex!important;align-items:center!important;gap:8px!important;font-size:11px!important;color:#1e40af!important}
      .telegram-admin-studio .telegram-meeting-reminder select{min-height:38px!important;padding:6px 10px!important;border:1.5px solid #93c5fd!important;border-radius:8px!important;font-weight:700!important;color:#1e40af!important;background:#fff!important;max-width:320px!important}
      .telegram-admin-studio .telegram-send-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin-top:14px!important;padding-top:12px!important;border-top:1px solid #f1f5f9!important;flex-wrap:wrap!important}
      .telegram-admin-studio .telegram-send-row span{color:#64748b!important;font-size:11.5px!important}
      .telegram-admin-studio .telegram-send-row .btn-secondary{padding:9px 18px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;color:#475569!important;font-weight:700!important;font-size:13px!important;cursor:pointer!important;transition:all .15s ease!important}
      .telegram-admin-studio .telegram-send-row .btn-secondary:hover{background:#f1f5f9!important;color:#0f172a!important}
      .telegram-admin-studio .telegram-send-row .btn-primary,.telegram-admin-studio [data-telegram-send]{padding:10px 22px!important;border:0!important;border-radius:10px!important;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)!important;color:#fff!important;font-size:13px!important;font-weight:800!important;box-shadow:0 6px 18px rgba(124,58,237,.28)!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;gap:8px!important;transition:transform .15s ease,box-shadow .15s ease!important}
      .telegram-admin-studio .telegram-send-row .btn-primary:hover,.telegram-admin-studio [data-telegram-send]:hover{transform:translateY(-1px)!important;box-shadow:0 8px 24px rgba(124,58,237,.38)!important}
      .telegram-admin-studio .telegram-send-row .btn-primary:active,.telegram-admin-studio [data-telegram-send]:active{transform:scale(0.98)!important}
      @media(max-width:560px){
        #referenceEditor .modal-card.telegram-admin-studio{width:calc(100vw - 16px)!important;border-radius:14px!important}
        .telegram-admin-studio .telegram-studio-head{padding:12px 14px!important}
        .telegram-admin-studio .telegram-studio-body{padding:11px 12px 14px!important}
        .telegram-admin-studio [data-telegram-form]{padding:12px!important}
        .telegram-admin-studio .telegram-meeting-box{grid-template-columns:1fr!important;padding:10px!important}
        .telegram-admin-studio .telegram-meeting-reminder{align-items:stretch!important}
        .telegram-admin-studio .telegram-meeting-reminder select{max-width:none!important}
        .telegram-admin-studio .telegram-send-row>div{width:100%!important}
        .telegram-admin-studio .telegram-send-row button{flex:1 1 0!important;justify-content:center!important}
      }
    `;document.head.appendChild(style);}
    if(root)root.className='telegram-admin-studio';
  }
  function telegramStudio(){
    const host=q('#tab-notifications');if(!host||data.user.role!=='ADMIN')return;styleTelegramStudio();let root=q('#adminTelegramStudio');
    if(!root){
      root=document.createElement('section');root.id='adminTelegramStudio';root.className='telegram-admin-studio';
      root.innerHTML='<div class="telegram-studio-head"><div class="telegram-studio-head-main"><span class="telegram-studio-icon">📢</span><div><h2>Trung Tâm Thông Báo Telegram Cho Admin</h2><p class="telegram-subtitle">Chọn mẫu và chỉnh sửa nội dung trước khi gửi</p></div></div><span class="telegram-admin-tag">ADMIN STUDIO</span></div><div class="telegram-studio-body"><div class="telegram-presets-heading"><span>💡 Mẫu thông báo</span><button type="button" data-telegram-reset>✏️ Tự soạn tự do</button></div><div data-telegram-presets></div><form data-telegram-form><input type="hidden" data-telegram-type value="MEETING"><div class="telegram-form-top"><div style="display:flex;align-items:center;gap:8px"><span style="color:#64748b;font-size:12px;font-weight:600">Đang chọn:</span><span data-telegram-active-badge class="telegram-active-badge" data-tone="blue"><span>📅</span> <span>Họp tổng tuần</span></span></div><label style="font-size:12px;font-weight:700;color:#334155;display:flex;align-items:center;gap:8px;margin:0"><span>Đối tượng nhận:</span><select data-telegram-target style="min-height:36px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:8px;font-weight:700;color:#1e293b;width:auto"><option value="ALL">🌐 Toàn bộ Agency (Sale + Leader + Manager)</option><option value="SALE">💼 Chỉ Đội ngũ Sales / Tư vấn</option><option value="MANAGERS">🎖️ Chỉ Ban Quản Lý (Leader & Manager)</option></select></label></div><label style="display:block;margin-top:12px;font-size:12.5px;font-weight:800;color:#1e335f">Tiêu đề thông báo</label><input required maxlength="200" data-telegram-title placeholder="Tiêu đề thông báo..."><div data-telegram-meeting class="telegram-meeting-box"><label style="font-size:12px;font-weight:700;color:#1e3a8a">⏰ Thời gian diễn ra họp<input data-telegram-time placeholder="VD: 16:30 chiều nay"></label><label style="font-size:12px;font-weight:700;color:#1e3a8a">📍 Địa điểm / Link họp<input data-telegram-link placeholder="meet.google.com/..."></label><div class="telegram-meeting-reminder"><div class="telegram-meeting-reminder-copy"><span style="font-size:16px">🔔</span><span><strong>Nhắc lại trước giờ họp</strong></span></div><select data-telegram-remind><option value="15">⏰ Nhắc trước 15 phút (Khuyên dùng)</option><option value="30">⏰ Nhắc trước 30 phút</option><option value="45">⏰ Nhắc trước 45 phút</option><option value="60">⏰ Nhắc trước 1 tiếng</option><option value="120">⏰ Nhắc trước 2 tiếng</option><option value="0">❌ Không nhắc</option></select></div></div><label style="display:block;margin-top:12px;font-size:12.5px;font-weight:800;color:#1e335f">Người chủ trì / Ban hành<input data-telegram-host value="Ban Quản Trị NVT Agency"></label><label style="display:block;margin-top:12px;font-size:12.5px;font-weight:800;color:#1e335f">Nội dung chi tiết thông báo<textarea required maxlength="4000" rows="4" data-telegram-content></textarea></label><div class="telegram-send-row"><button type="submit" class="btn-primary" data-telegram-send>🚀 BẮN THÔNG BÁO TELEGRAM NGAY</button></div></form></div>';
      const presets=root.querySelector('[data-telegram-presets]');
      Object.entries(telegramTemplates).forEach(([key,item])=>{
        const b=document.createElement('button');b.type='button';b.dataset.telegramPreset=key;b.dataset.tone=item.tone;
        b.innerHTML='<div class="preset-top"><span class="preset-icon">'+item.icon+'</span><span class="preset-badge">'+item.badge+'</span></div><strong class="preset-title">'+item.title+'</strong><span class="preset-desc">'+item.desc+'</span>';
        b.onclick=()=>{
          root.querySelectorAll('[data-telegram-preset]').forEach(n=>n.classList.remove('is-selected'));
          b.classList.add('is-selected');
          const typeInput=root.querySelector('[data-telegram-type]');if(typeInput)typeInput.value=item.type;
          root.querySelector('[data-telegram-target]').value=item.target;
          root.querySelector('[data-telegram-title]').value=item.title;
          root.querySelector('[data-telegram-content]').value=item.content;
          const timeInput=root.querySelector('[data-telegram-time]');if(timeInput)timeInput.value=item.time||'';
          const linkInput=root.querySelector('[data-telegram-link]');if(linkInput)linkInput.value=item.link||'';
          const hostInput=root.querySelector('[data-telegram-host]');if(hostInput)hostInput.value=item.host||'Ban Quản Trị NVT Agency';
          toggleTelegramMeeting(root);
        };
        presets.appendChild(b);
      });
      root.querySelector('[data-telegram-reset]').onclick=()=>{
        root.querySelectorAll('[data-telegram-preset]').forEach(n=>n.classList.remove('is-selected'));
        const typeInput=root.querySelector('[data-telegram-type]');if(typeInput)typeInput.value='CUSTOM';
        root.querySelector('[data-telegram-title]').value='';root.querySelector('[data-telegram-content]').value='';
        const timeInput=root.querySelector('[data-telegram-time]');if(timeInput)timeInput.value='';
        const linkInput=root.querySelector('[data-telegram-link]');if(linkInput)linkInput.value='';
        toggleTelegramMeeting(root);
        root.querySelector('[data-telegram-title]')?.focus();
      };
      presets.querySelector('[data-telegram-preset="meeting_weekly"]')?.click();
      root.querySelector('[data-telegram-form]').onsubmit=e=>{
        e.preventDefault();const get=s=>root.querySelector(s)?.value?.trim()||'';const remindSelect=root.querySelector('[data-telegram-remind]');
        const title=get('[data-telegram-title]'), content=get('[data-telegram-content]');
        run(async ()=>{
          const res=await api.telegramBroadcast({
            type:get('[data-telegram-type]'),target:get('[data-telegram-target]'),title:title,content:content,host:get('[data-telegram-host]'),
            meeting_time:root.querySelector('[data-telegram-time]')?.value||null,meeting_link:get('[data-telegram-link]'),remind_minutes:remindSelect?Number(remindSelect.value):0
          });
          try{await api.announce({title:title,text:content});}catch(_){}
          return res;
        },(result)=>{
          referenceNotice(`Đã bắn thông báo Telegram và lưu hệ thống CRM tới ${result?.sent||0} tài khoản.`);
          e.target.reset();root.querySelector('[data-telegram-host]').value='Ban Quản Trị NVT Agency';toggleTelegramMeeting(root);
        });
      };
      host.querySelector('.headline-row')?.after(root);
    }
    toggleTelegramMeeting(root);
  }
  let noticeFilter=0;
  const noticeFeed=q('#tab-notifications .pill-tab-group')?.parentElement?.nextElementSibling;
  const noticeTemplate=noticeFeed?.firstElementChild?.cloneNode(true);
  const noticeDropdownBody=q('#notificationDropdown')?.children[1],noticeDropdownTemplate=noticeDropdownBody?.firstElementChild?.cloneNode(true);
  const noticeKind=n=>/RENT|EXPIR|THUÊ/i.test(n.type||n.title)?2:/PAY|ORDER|THANH TOÁN/i.test(n.type||n.title)?1:/DATA|WEBHOOK/i.test(n.type||n.title)?3:4;
  function notices(){
    q("#adminTelegramStudio")?.remove();
    const unseen=data.notifications.filter(n=>!(n.readBy||[]).includes(data.user.id)).length;text('topbarNotifBadge',unseen);const badge=q('.nav-link[data-tab="tab-notifications"] .nav-badge');if(badge)badge.textContent=unseen;
    if(noticeDropdownBody&&noticeDropdownTemplate){noticeDropdownBody.replaceChildren();data.notifications.slice(0,8).forEach(n=>{const row=noticeDropdownTemplate.cloneNode(true),content=row.children[1];content.querySelector('b').textContent=n.title;content.querySelector('small').textContent=fmtDate(n.at);content.children[1].textContent=n.text;row.onclick=()=>{switchTab('tab-notifications');closeNotificationDropdown();};noticeDropdownBody.appendChild(row);});q('#notificationDropdown').firstElementChild.querySelector('span').textContent=unseen;if(!noticeDropdownBody.children.length)noticeDropdownBody.textContent='Chưa có thông báo.';}
    // Đúng thứ tự bảy cột; IP lấy từ nhật ký đã lưu, không dùng mã đối tượng.
    table(q('#tab-audit tbody'),data.audit.map(a=>[a.at,a.actor,a.role,a.ip||'Chưa ghi nhận',a.action,a.entity,a.detail]));
    if(noticeFeed&&noticeTemplate){noticeFeed.replaceChildren();data.notifications.filter(n=>!noticeFilter||noticeKind(n)===noticeFilter).forEach(n=>{const row=noticeTemplate.cloneNode(true),content=row.firstElementChild.children[1],kind=noticeKind(n);content.querySelector('b').textContent=n.title;content.children[1].textContent=n.text;content.querySelector('.chip').textContent=['Tất cả','Tài chính','Hạn thuê','Data mới','Vận hành'][kind];row.lastElementChild.querySelector('span').textContent=fmtDate(n.at);const button=row.querySelector('button');button.removeAttribute('onclick');button.textContent=(n.readBy||[]).includes(data.user.id)?'Đã đọc':'Đánh dấu đã đọc';button.disabled=(n.readBy||[]).includes(data.user.id);button.onclick=()=>run(()=>api.readNotice(n.id));row.style.opacity=button.disabled?'.65':'1';noticeFeed.appendChild(row);});if(!noticeFeed.children.length){const empty=document.createElement('p');empty.textContent='Chưa có thông báo.';noticeFeed.appendChild(empty);}}
    qa('#tab-notifications .pill-tab-item').forEach((b,i)=>{b.textContent=['Tất cả','Tài chính','Hạn thuê','Data mới','Vận hành'][i]+' ('+data.notifications.filter(n=>!i||noticeKind(n)===i).length+')';b.classList.toggle('active',noticeFilter===i);b.onclick=()=>{noticeFilter=i;notices();};});
    const buttons=qa('#tab-notifications .headline-row button').filter(b=>b.id!=='refCreateNotice');buttons.forEach(b=>b.removeAttribute('onclick'));if(buttons[0]){buttons[0].id='markNotificationsReadButton';buttons[0].onclick=()=>run(()=>api.readNotifications());}if(buttons[1]){buttons[1].id='notificationSettingsButton';buttons[1].onclick=notificationSettings;buttons[1].hidden=data.user.role!=='ADMIN';buttons[1].style.display=data.user.role==='ADMIN'?'':'none';}
    if(!q('#refCreateNotice')){const b=document.createElement('button');b.id='refCreateNotice';b.className='btn-action btn-primary';b.textContent='+ Tạo thông báo';buttons[1]?.before(b);}
    q('#refCreateNotice').onclick=()=>announcementEditor();
    q('#refCreateNotice').hidden=data.user.role!=='ADMIN';
    const cards=qa('#tab-notifications .bento-card');cards.forEach((c,i)=>{const value=c.querySelector('[style*="font-size: 28px"], [style*="font-size: 26px"], [style*="font-size: 32px"]');if(value)value.textContent=[data.notifications.length,data.notifications.filter(n=>noticeKind(n)===2).length,data.notifications.filter(n=>noticeKind(n)===1).length,data.notifications.filter(n=>noticeKind(n)===3).length][i]||0;if(c.children[2])c.children[2].textContent=i===0?unseen+' chưa đọc':i===1?'Thông báo hạn thuê':i===2?'Thông báo tài chính':'Thông báo nguồn data';});
  }
  function webhookEditor(id){const w=data.websites.find(w=>w.id===id);const modal=editor('Cấu hình URL webhook',formField('Mã webhook (slug)',`<input id="refWebhookSlug" required maxlength="60" value="${esc(w.webhookSlug)}">`)+formField('URL công khai ghi đè (HTTPS, tùy chọn)',`<input id="refWebhookOverride" type="url" value="${esc(w.webhookUrlOverride||'')}">`)+formField('Domain công khai dùng chung',`<input id="refWebhookBase" type="url" value="${esc(data.settings.webhookPublicBase||'')}">`)+`<button type="button" id="refGenerateWebhook" class="btn-action btn-secondary">Tạo mã mới</button>`,()=>api.saveWebhook(id,{slug:q('#refWebhookSlug').value,override:q('#refWebhookOverride').value,base:q('#refWebhookBase').value}));q('#refGenerateWebhook').onclick=()=>{q('#refWebhookSlug').value=api.newWebhookSlug();q('#refWebhookOverride').value='';};}
  // Dùng form nghiệp vụ hiện có, trình bày bằng thành phần của mẫu mới.
  let workflowModal=null,workflowPairs=[],workflowMarkup='',workflowBusy=false;
  function styleWorkflow(root){
    root.querySelectorAll('*').forEach(n=>{
      n.removeAttribute('onclick');n.removeAttribute('onchange');n.removeAttribute('onsubmit');n.removeAttribute('oninput');
      if(n.id)n.id='wf-'+n.id;if(n.htmlFor)n.htmlFor='wf-'+n.htmlFor;
      const hidden=n.classList.contains('is-hidden')||n.hidden||n.style.display==='none';
      n.removeAttribute('style');if(hidden)n.hidden=true;
      if(n.matches('button'))n.className='btn-action '+(n.classList.contains('button-primary')?'btn-primary':'btn-secondary');
      if(n.matches('table'))n.className='modern-table';
      if(n.matches('input,select,textarea')){n.style.cssText='max-width:100%;min-width:0;padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface);color:var(--text-main);font:inherit';if(n.type==='checkbox'||n.type==='radio')n.style.width='auto';}
      if(n.classList.contains('form-field')){n.className='form-group';n.style.marginBottom='12px';}
      if(n.classList.contains('form-grid')||n.classList.contains('api-config-grid')){n.className='grid-2-col';n.style.gridTemplateColumns='repeat(auto-fit,minmax(min(220px,100%),1fr))';}
      if(n.classList.contains('table-wrap')){n.className='table-responsive';n.style.maxWidth='100%';}
      if(n.classList.contains('modal-actions')||n.classList.contains('panel-actions')||n.classList.contains('connection-actions'))n.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';
      if(n.classList.contains('detail-grid'))n.style.cssText='display:grid;grid-template-columns:minmax(100px,1fr) minmax(0,2fr);gap:10px';
      if(n.classList.contains('section-label')||n.classList.contains('panel-title'))n.style.cssText='font-weight:700;margin:16px 0 10px';
      if(n.classList.contains('panel')||n.classList.contains('info-card')||n.classList.contains('rank-row')||n.classList.contains('field-manager-row')||n.classList.contains('timeline-item'))n.style.cssText='padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;overflow-wrap:anywhere';
      if(n.classList.contains('status')||n.classList.contains('field-pill')){n.className='chip';}
      if(n.matches('img'))n.style.cssText='max-width:100%;max-height:180px;object-fit:contain';
    });
  }
  function syncWorkflowControls(){workflowPairs.forEach(([source,clone])=>{if(source.matches('input,select,textarea')){if(source.type==='file'){if(clone.files?.length)source.files=clone.files;}else{source.value=clone.value;if('checked'in source)source.checked=clone.checked;}}});}
  function drawWorkflow(){
    if(!workflowModal)return;const source=api.workflowRoot();if(!source){workflowModal.remove();workflowModal=null;workflowPairs=[];refresh(true);return;}
    if(workflowModal.dataset.workflowKind==='customer'){
      workflowModal.querySelector('.modal-card')?.classList.add('customer-profile-modal');
      if(!q('#referenceCustomerModalStyles')){const style=document.createElement('style');style.id='referenceCustomerModalStyles';style.textContent=`
        .customer-profile-modal{width:min(980px,calc(100vw - 24px))!important;height:min(94dvh,980px)!important;max-height:94dvh!important;overflow:hidden!important;border:1px solid #dbe4ee!important;border-radius:16px!important;background:#f8fafc!important;box-shadow:0 22px 60px rgba(15,23,42,.24)!important}
        .customer-profile-modal>.modal-header{display:flex!important;align-items:center!important;min-height:58px!important;padding:14px 20px!important;background:#f1f5f9!important;border-bottom:1px solid #dbe4ee!important}
        .customer-profile-modal>.modal-header h3{margin:0!important;color:#10213f!important;font-size:18px!important;font-weight:800!important;line-height:1.25!important}
        .customer-profile-modal>.modal-body{display:block!important;min-height:0!important;padding:0!important;overflow:auto!important;background:#f8fafc!important}
        .customer-profile-modal [data-workflow-body]{padding:18px 20px 24px!important;color:#17233b!important;font-family:Arial,"Segoe UI",sans-serif!important;font-size:13px!important}
        .customer-profile-modal .section-label{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:18px 0 8px!important;color:#10213f!important;font-size:13px!important;font-weight:800!important;line-height:1.3!important}
        .customer-profile-modal .section-label:first-child{margin-top:0!important}
        .customer-profile-modal .detail-grid{display:grid!important;grid-template-columns:minmax(150px,.8fr) minmax(0,2fr)!important;gap:0 18px!important;margin:0!important;padding:4px 16px!important;border:1px solid #dbe4ee!important;border-radius:11px!important;background:#fff!important;box-shadow:0 2px 8px rgba(15,23,42,.035)!important}
        .customer-profile-modal .detail-grid dt,.customer-profile-modal .detail-grid dd{min-width:0!important;margin:0!important;padding:9px 0!important;border-bottom:1px solid #edf1f5!important;line-height:1.35!important;overflow-wrap:anywhere!important}
        .customer-profile-modal .detail-grid dt{color:#64748b!important;font-size:11.5px!important;font-weight:700!important}
        .customer-profile-modal .detail-grid dd{color:#1e293b!important;font-size:12.5px!important;font-weight:600!important}
        .customer-profile-modal .detail-grid dt:last-of-type,.customer-profile-modal .detail-grid dd:last-of-type{border-bottom:0!important}
        .customer-profile-modal .detail-grid .status{display:inline-flex!important;align-items:center!important;padding:4px 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:800!important}
        .customer-profile-modal .form-grid,.customer-profile-modal .inline-form,.customer-profile-modal form{margin:0!important}
        .customer-profile-modal .form-grid,.customer-profile-modal .custom-field-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;padding:14px 16px!important;border:1px solid #dbe4ee!important;border-radius:11px!important;background:#fff!important;box-shadow:0 2px 8px rgba(15,23,42,.035)!important}
        .customer-profile-modal .form-field{display:grid!important;gap:6px!important;min-width:0!important;margin:0!important;color:#475569!important;font-size:11.5px!important;font-weight:700!important;line-height:1.3!important}
        .customer-profile-modal .form-field input,.customer-profile-modal .form-field select,.customer-profile-modal .form-field textarea,.customer-profile-modal .inline-form select{width:100%!important;min-height:39px!important;box-sizing:border-box!important;padding:8px 10px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;color:#0f172a!important;font:600 12.5px/1.35 Arial,"Segoe UI",sans-serif!important;outline:none!important}
        .customer-profile-modal .form-field textarea{min-height:82px!important;resize:vertical!important}
        .customer-profile-modal .form-field input:focus,.customer-profile-modal .form-field select:focus,.customer-profile-modal .form-field textarea:focus,.customer-profile-modal .inline-form select:focus{border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)!important}
        .customer-profile-modal .inline-form{display:flex!important;align-items:center!important;gap:10px!important;padding:12px 16px!important;border:1px solid #dbe4ee!important;border-radius:11px!important;background:#fff!important}
        .customer-profile-modal .inline-form select{width:min(260px,100%)!important;flex:1 1 220px!important}
        .customer-profile-modal .modal-actions,.customer-profile-modal .panel-actions{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;margin:12px 0 0!important;padding:0!important}
        .customer-profile-modal .button{min-height:36px!important;padding:8px 13px!important;border-radius:8px!important;font-size:12px!important;font-weight:800!important}
        .customer-profile-modal .button-primary{background:#2563eb!important;border-color:#2563eb!important;color:#fff!important;box-shadow:0 5px 12px rgba(37,99,235,.18)!important}
        .customer-profile-modal .button-danger{background:#fff1f2!important;border-color:#fecdd3!important;color:#be123c!important}
        .customer-profile-modal .custom-field-multi{grid-column:span 1!important;min-width:0!important;margin:0!important;padding:10px 12px!important;border:1px solid #bfdbfe!important;border-radius:9px!important;background:#eff6ff!important}
        .customer-profile-modal .custom-field-multi legend{padding:0 4px!important;color:#1e40af!important;font-size:11.5px!important;font-weight:800!important}
        .customer-profile-modal .custom-field-multi>div{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin-top:5px!important}
        .customer-profile-modal .custom-field-multi>div>label{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:4px 7px!important;border:1px solid #dbeafe!important;border-radius:7px!important;background:#fff!important;font-size:11px!important;font-weight:700!important;color:#334155!important;cursor:pointer!important}
        .customer-profile-modal .custom-field-multi input{width:auto!important;min-height:auto!important;margin:0!important;accent-color:#2563eb!important}
        .customer-profile-modal .timeline,.customer-profile-modal .purchase-list,.customer-profile-modal .follow-up-list{display:grid!important;gap:8px!important;margin:0!important}
        .customer-profile-modal .timeline-item,.customer-profile-modal .purchase-row,.customer-profile-modal .follow-up-row,.customer-profile-modal .empty{display:block!important;width:100%!important;box-sizing:border-box!important;margin:0!important;padding:11px 13px!important;border:1px solid #dbe4ee!important;border-radius:9px!important;background:#fff!important;color:#1e293b!important;box-shadow:0 1px 5px rgba(15,23,42,.025)!important}
        .customer-profile-modal .timeline-item b,.customer-profile-modal .purchase-row b,.customer-profile-modal .follow-up-row b,.customer-profile-modal .empty b{font-size:12px!important;color:#17233b!important}
        .customer-profile-modal .timeline-item p,.customer-profile-modal .timeline-item small,.customer-profile-modal .purchase-row small,.customer-profile-modal .follow-up-row small,.customer-profile-modal .empty span{display:block!important;margin:4px 0 0!important;color:#64748b!important;font-size:11px!important;line-height:1.4!important}
        .customer-profile-modal .purchase-row,.customer-profile-modal .follow-up-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;text-align:left!important;cursor:pointer!important}
        .customer-profile-modal .purchase-row:hover{border-color:#93c5fd!important;background:#f8fbff!important}
        .customer-profile-modal .note-actions{display:flex!important;gap:6px!important;margin-top:8px!important}
        .customer-profile-modal .duplicate-alert{margin:0 0 12px!important;padding:10px 12px!important;border:1px solid #fed7aa!important;border-radius:9px!important;background:#fff7ed!important;color:#9a3412!important}
        .customer-profile-modal .duplicate-alert b,.customer-profile-modal .duplicate-alert span{display:block!important;font-size:11.5px!important;line-height:1.4!important}
        .customer-profile-modal .customer-care-shortcuts{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin:12px 0 16px!important}
        .customer-profile-modal .customer-care-shortcuts button{display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:38px!important;padding:8px 12px!important;border:1px solid #bfdbfe!important;border-radius:8px!important;background:#eff6ff!important;color:#1d4ed8!important;font-size:12px!important;font-weight:800!important;cursor:pointer!important}
        .customer-profile-modal .customer-care-shortcuts button:hover{background:#dbeafe!important;border-color:#93c5fd!important}
        .customer-profile-modal>.modal-footer{position:relative!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;min-height:58px!important;padding:10px 20px!important;border-top:1px solid #dbe4ee!important;background:#f1f5f9!important}
        .customer-profile-modal>.modal-footer [data-workflow-notice]{margin-right:auto!important;color:#2563eb!important;font-size:11.5px!important;font-weight:700!important}
        @media(max-width:640px){
          .customer-profile-modal{width:calc(100vw - 12px)!important;height:calc(100dvh - 12px)!important;max-height:calc(100dvh - 12px)!important;border-radius:12px!important}
          .customer-profile-modal [data-workflow-body]{padding:14px 12px 18px!important}
          .customer-profile-modal .detail-grid{grid-template-columns:1fr!important;gap:0!important;padding:4px 12px!important}
          .customer-profile-modal .detail-grid dt{padding:8px 0 2px!important;border-bottom:0!important}
          .customer-profile-modal .detail-grid dd{padding:2px 0 8px!important}
          .customer-profile-modal .form-grid,.customer-profile-modal .custom-field-grid{grid-template-columns:1fr!important;padding:12px!important}
          .customer-profile-modal .custom-field-multi{grid-column:auto!important}
          .customer-profile-modal .inline-form{align-items:stretch!important;flex-direction:column!important;padding:12px!important}
          .customer-profile-modal .inline-form select{width:100%!important;flex-basis:auto!important}
          .customer-profile-modal .customer-care-shortcuts{grid-template-columns:1fr!important}
          .customer-profile-modal>.modal-footer{padding:9px 12px!important}
          .customer-profile-modal>.modal-footer button{flex:1 1 0!important}
        }
      `;document.head.appendChild(style);}
    }
    if(workflowModal.dataset.workflowKind==='profile'&&!q('#referenceProfileModernStyles')){const style=document.createElement('style');style.id='referenceProfileModernStyles';style.textContent='.profile-modal-card .modal-body{padding:0!important}.profile-modal-card .profile-panel{border:0!important;box-shadow:none!important;background:transparent!important}.profile-modal-card .profile-panel-body{max-width:none!important;padding:22px!important}.profile-modal-card .profile-hero{display:flex!important;align-items:center!important;gap:20px!important;padding:20px!important;margin:0 0 22px!important;border:1px solid var(--border)!important;border-radius:14px!important;background:linear-gradient(135deg,#f8fafc,#f1f5f9)!important}.profile-modal-card .profile-avatar-stage{position:relative!important;width:76px!important;height:76px!important}.profile-modal-card .profile-avatar-large{width:76px!important;height:76px!important;border-radius:50%!important;object-fit:cover!important}.profile-modal-card .profile-avatar-camera{display:grid!important;position:absolute!important;right:-4px!important;bottom:-3px!important;width:26px!important;height:26px!important;padding:0!important;border-radius:50%!important;background:#fff!important;color:#2563eb!important}.profile-modal-card .profile-role-row{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important}.profile-modal-card .profile-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important}.profile-modal-card .profile-fields .form-group{display:grid!important;gap:7px!important;margin:0!important;min-width:0!important;color:var(--text-muted)!important;font-size:11px!important;font-weight:700!important}.profile-modal-card .profile-fields .form-group>span{display:flex!important;align-items:center!important}.profile-modal-card .profile-input-wrap input{width:100%!important;min-height:42px!important;margin:0!important;padding:0 12px 0 34px!important}.profile-modal-card .profile-security-note{display:flex!important}.profile-modal-card .profile-actions{display:none!important}.profile-modal-card .modal-footer{justify-content:flex-end!important;gap:8px!important}.profile-modal-card .modal-footer [data-workflow-notice]{margin-right:auto!important}.profile-modal-card .modal-footer [data-workflow-profile-save]{order:2!important}@media(max-width:560px){.profile-modal-card .profile-panel-body{padding:16px!important}.profile-modal-card .profile-hero{align-items:flex-start!important;padding:16px!important;gap:14px!important}.profile-modal-card .profile-fields{grid-template-columns:1fr!important}.profile-modal-card .modal-footer{justify-content:stretch!important}.profile-modal-card .modal-footer [data-workflow-notice]{flex-basis:100%!important}.profile-modal-card .modal-footer button{flex:1!important}}';document.head.appendChild(style);}
    const body=workflowModal.querySelector('[data-workflow-body]'),copy=source.cloneNode(true);workflowMarkup=source.innerHTML;copy.className='';copy.removeAttribute('id');if(workflowModal.dataset.workflowKind==='profile'){const pageHead=copy.querySelector('.page-head');if(pageHead)pageHead.hidden=true;const innerTitle=copy.querySelector('.profile-hero-copy h2');if(innerTitle)innerTitle.hidden=true;}const title=source.ownerDocument.querySelector('#modalTitle')?.textContent||source.ownerDocument.querySelector('#drawerRoot h2')?.textContent||source.ownerDocument.querySelector('#content h1')?.textContent;if(title)workflowModal.querySelector('h3').textContent=title;
    const originals=[source,...source.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];workflowPairs=originals.map((n,i)=>[n,clones[i]]);styleWorkflow(copy);if(workflowModal.dataset.workflowKind==='profile'){copy.querySelector('.profile-panel')?.style.setProperty('padding','0','important');copy.querySelector('.profile-panel-body')?.style.setProperty('padding','22px','important');copy.querySelector('.profile-hero')?.style.setProperty('display','flex','important');copy.querySelector('.profile-hero')?.style.setProperty('align-items','center','important');copy.querySelector('.profile-fields')?.style.setProperty('display','grid','important');copy.querySelector('.profile-fields')?.style.setProperty('grid-template-columns','repeat(2,minmax(0,1fr))','important');if(window.matchMedia('(max-width:560px)').matches){copy.querySelector('.profile-panel-body')?.style.setProperty('padding','16px','important');copy.querySelector('.profile-fields')?.style.setProperty('grid-template-columns','1fr','important');copy.querySelector('.profile-hero')?.style.setProperty('align-items','flex-start','important');}copy.querySelector('.profile-avatar-status')?.remove();const upload=copy.querySelector('.profile-upload-button');if(upload){upload.hidden=false;upload.removeAttribute('style');upload.className='button button-small profile-upload-button';upload.textContent='Đổi avatar';upload.style.cssText='display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer;padding:9px 14px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;line-height:1.2';}const fileInput=copy.querySelector('#wf-profileAvatarInput');if(fileInput){fileInput.hidden=false;fileInput.classList.remove('is-hidden');fileInput.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';if(upload)upload.onclick=()=>fileInput?.click();}copy.querySelector('.profile-hero-copy')?.style.setProperty('display','block','important');copy.querySelector('.profile-hero-copy p')?.style.setProperty('margin','6px 0 12px','important');}
    if(workflowModal.dataset.workflowKind==='profile'){
      // Modal chỉ giữ tiêu đề ở modal-header, không lặp lại page header bên trong form.
      const profilePageHead=copy.querySelector('.page-head'); if(profilePageHead){profilePageHead.hidden=true;profilePageHead.setAttribute('aria-hidden','true');profilePageHead.style.setProperty('display','none','important');}
      if(!q('#referenceProfileModalFixStyles')){const style=document.createElement('style');style.id='referenceProfileModalFixStyles';style.textContent='.profile-modal-card .modal-body{padding:0!important}.profile-modal-card .profile-panel{margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.profile-modal-card .profile-panel-body{max-width:none!important;padding:22px!important}.profile-modal-card .profile-hero{display:flex!important;align-items:center!important;gap:20px!important;margin:0 0 22px!important;padding:20px!important;border:1px solid #e2e8f0!important;border-radius:14px!important;background:linear-gradient(135deg,#f8fafc,#f1f5f9)!important}.profile-modal-card .profile-avatar-stage{position:relative!important;width:76px!important;height:76px!important;flex:0 0 76px!important}.profile-modal-card .profile-avatar-large{width:76px!important;height:76px!important;border-radius:50%!important;object-fit:cover!important}.profile-modal-card .profile-avatar-camera{position:absolute!important;right:-4px!important;bottom:-3px!important;width:26px!important;height:26px!important;display:grid!important;place-items:center!important;padding:0!important;border:1px solid #e2e8f0!important;border-radius:50%!important;background:#fff!important;color:#2563eb!important;box-shadow:0 2px 6px rgba(15,23,42,.12)!important}.profile-modal-card .profile-hero-copy{display:block!important;min-width:0!important;flex:1!important}.profile-modal-card .profile-role-row{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;margin-bottom:7px!important}.profile-modal-card .profile-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important}.profile-modal-card .profile-fields .form-group{display:grid!important;gap:7px!important;min-width:0!important;margin:0!important;color:#475569!important;font-size:12px!important;font-weight:700!important}.profile-modal-card .profile-fields .form-group>span{display:flex!important;align-items:center!important;gap:4px!important;line-height:1.25!important}.profile-modal-card .profile-fields .form-group>span em{color:#ef4444!important;font-style:normal!important}.profile-modal-card .profile-input-wrap{position:relative!important;display:flex!important;align-items:center!important}.profile-modal-card .profile-input-wrap>span{position:absolute!important;left:12px!important;z-index:1!important;color:#64748b!important;font-size:14px!important;line-height:1!important;pointer-events:none!important}.profile-modal-card .profile-input-wrap input{width:100%!important;min-height:43px!important;margin:0!important;padding:0 12px 0 34px!important;border:1.5px solid #e2e8f0!important;border-radius:9px!important;background:#fff!important;color:#0f172a!important;font:600 13px/1.2 Arial,sans-serif!important}.profile-modal-card .profile-input-wrap input:focus{border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)!important;outline:none!important}.profile-modal-card .profile-security-note{display:flex!important;align-items:center!important;gap:10px!important;margin-top:18px!important;padding:12px 15px!important;border:1px dashed #e2e8f0!important;border-radius:10px!important;background:#f8fafc!important}.profile-modal-card .profile-security-note>span{flex:0 0 auto!important;color:#d97706!important;font-size:16px!important}.profile-modal-card .profile-security-note strong,.profile-modal-card .profile-security-note small{display:block!important}.profile-modal-card .profile-security-note strong{font-size:12px!important;color:#0f172a!important}.profile-modal-card .profile-security-note small{margin-top:3px!important;color:#64748b!important;font-size:10.5px!important}.profile-modal-card .profile-actions{display:none!important}.profile-modal-card .modal-footer{justify-content:flex-end!important;gap:8px!important}.profile-modal-card .modal-footer [data-workflow-notice]{margin-right:auto!important}@media(max-width:560px){.profile-modal-card .profile-panel-body{padding:16px!important}.profile-modal-card .profile-hero{align-items:flex-start!important;gap:14px!important;padding:16px!important}.profile-modal-card .profile-fields{grid-template-columns:1fr!important}.profile-modal-card .modal-footer{justify-content:stretch!important}.profile-modal-card .modal-footer button{flex:1!important}}';document.head.appendChild(style)}
    }
    workflowPairs.forEach(([n,c],i)=>{c.dataset.workflowNode=i;if(n.matches('input,select,textarea')){if(n.type!=='file')c.value=n.value;c.checked=n.checked;c.disabled=n.disabled;}});
    body.replaceChildren(copy);
    if(workflowModal.dataset.workflowKind==='customer'){
      const detailGrid=body.querySelector('.detail-grid');
      const appointmentButton=body.querySelector('#btnNewCustAppointment');
      const noteInput=body.querySelector('#customerNote');
      const shortcuts=document.createElement('div');
      shortcuts.className='customer-care-shortcuts';
      shortcuts.innerHTML='<button type="button" data-customer-care-note>✎ Thêm ghi chú Sale</button><button type="button" data-customer-care-appointment>📅 Tạo lịch hẹn</button>';
      const insertTarget=detailGrid||body.firstElementChild;
      insertTarget?.after(shortcuts);
      shortcuts.querySelector('[data-customer-care-note]').onclick=()=>{noteInput?.focus();noteInput?.scrollIntoView({behavior:'smooth',block:'center'});};
      shortcuts.querySelector('[data-customer-care-appointment]').onclick=()=>{if(appointmentButton){appointmentButton.scrollIntoView({behavior:'smooth',block:'center'});appointmentButton.focus();}};
    }
    if(workflowModal.dataset.workflowKind==='profile'){
      // Thu gon khu vuc avatar: chi giu anh vuong va nut doi avatar.
      const profileHero=body.querySelector('.profile-hero');
      if(profileHero){
        profileHero.style.setProperty('align-items','center','important');
        profileHero.style.setProperty('gap','12px','important');
        profileHero.style.setProperty('padding','0 0 18px','important');
        profileHero.style.setProperty('margin','0 0 20px','important');
        profileHero.style.setProperty('border','0','important');
        profileHero.style.setProperty('border-bottom','1px solid #e2e8f0','important');
        profileHero.style.setProperty('border-radius','0','important');
        profileHero.style.setProperty('background','transparent','important');
      }
      const profileAvatar=body.querySelector('.profile-avatar-large');
      if(profileAvatar){
        profileAvatar.style.setProperty('width','76px','important');
        profileAvatar.style.setProperty('height','76px','important');
        profileAvatar.style.setProperty('border-radius','10px','important');
        profileAvatar.style.setProperty('object-fit','cover','important');
      }
      body.querySelector('.profile-avatar-camera')?.remove();
      body.querySelector('.profile-role-row')?.remove();
      body.querySelector('.profile-display-name')?.remove();
      body.querySelector('.profile-hero-actions small')?.remove();
      const profileActions=body.querySelector('.profile-hero-actions');
      if(profileActions){profileActions.style.setProperty('margin','0','important');profileActions.style.setProperty('display','flex','important');}
      const innerPageHead=body.querySelector('.page-head');
      if(innerPageHead){
        innerPageHead.hidden=true;
        innerPageHead.setAttribute('aria-hidden','true');
        innerPageHead.style.setProperty('display','none','important');
      }
      copy.querySelector('.profile-actions')?.remove();
      const save=workflowModal.querySelector('[data-workflow-profile-save]');
      if(save)save.setAttribute('form','wf-profileForm');
    }
  }
  async function workflow(kind,id){
    if(working||workflowBusy)return;
    try{const result=await api.openWorkflow(kind,id);q('#referenceWorkflow')?.remove();const modal=document.createElement('div');modal.id='referenceWorkflow';modal.className='modal-overlay open';modal.style.zIndex='11000';modal.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(result.title)}" style="width:min(1080px,calc(100vw - 24px));max-height:92dvh"><div class="modal-header"><h3>${esc(result.title)}</h3><button type="button" class="modal-close-btn" data-workflow-close aria-label="Đóng">×</button></div><div class="modal-body" data-workflow-body></div><div class="modal-footer" style="flex-wrap:wrap"><span role="status" data-workflow-notice style="flex:1;overflow-wrap:anywhere"></span><button type="button" class="btn-action btn-secondary" data-workflow-close>Đóng</button>${kind==='profile'?'<button type="submit" class="btn-action btn-primary" data-workflow-profile-save>Lưu hồ sơ</button>':''}</div></div>`;document.body.appendChild(modal);workflowModal=modal;workflowModal.dataset.workflowKind=kind;if(kind==='profile'){modal.querySelector('.modal-card').style.width='min(760px,calc(100vw - 24px))';}drawWorkflow();
      if(kind==='profile')modal.querySelector('.modal-card')?.classList.add('profile-modal-card');
      modal.querySelectorAll('[data-workflow-close]').forEach(b=>b.onclick=async()=>{if(workflowBusy)return;try{await api.closeWorkflow(true);modal.remove();workflowModal=null;refresh(true);}catch(e){modal.querySelector('[data-workflow-notice]').textContent=e.message;}});
      const invoke=async(event,type)=>{const clone=event.target.closest(type==='click'?'button,a,input[readonly]':'[data-workflow-node]');if(!clone)return;const source=workflowPairs[Number(clone.dataset.workflowNode)]?.[0];if(!source)return;
        if(type==='click'&&event.target.closest('[data-workflow-profile-save]')){event.preventDefault();event.stopPropagation();modal.querySelector('#wf-profileForm')?.requestSubmit();return;}
        if(type==='click'&&!clone.matches('button,a,input[readonly]'))return;
        if(type==='click'&&clone.matches('button')&&clone.type==='submit'&&clone.closest('form'))return;
        event.preventDefault();event.stopPropagation();if(workflowBusy)return;syncWorkflowControls();workflowBusy=true;
        try{const result=await api.workflowEvent(source,type);if(type!=='input')drawWorkflow();if(workflowModal)workflowModal.querySelector('[data-workflow-notice]').textContent=result.notice||'';refresh(true);}
        catch(e){modal.querySelector('[data-workflow-notice]').textContent=e.message;}
        finally{workflowBusy=false;}
      };
      modal.addEventListener('click',e=>{if(kind==='profile'&&e.target.closest('[data-workflow-profile-save]')){e.preventDefault();e.stopPropagation();modal.querySelector('#wf-profileForm')?.requestSubmit();}},true);
      modal.addEventListener('click',e=>invoke(e,'click'));
      modal.addEventListener('submit',e=>invoke(e,'submit'));
      modal.addEventListener('change',e=>invoke(e,'change'));
      modal.addEventListener('input',e=>{syncWorkflowControls();const pair=workflowPairs[Number(e.target.dataset.workflowNode)];if(pair)pair[0].dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));});
    }catch(e){alert(e.message);}
  }
  setInterval(()=>{if(workflowModal&&!workflowBusy&&!workflowModal.contains(document.activeElement)){const source=api?.workflowRoot();if(!source||source.innerHTML!==workflowMarkup)drawWorkflow();}},500);
  // Các tác vụ chuyên sâu gom vào Cài đặt, không thêm dropdown trên từng tab.
  const featureActions=new Map();
  const roleTools={
    ADMIN:null,
    MANAGER:new Set(['customer','newCustomer','customers','pool','order','editOrder','newOrder','orders','attendance','revenue','reports','password','profile']),
    LEADER:new Set(['customer','newCustomer','customers','pool','order','editOrder','newOrder','orders','attendance','revenue','reports','password','profile']),
    SALE:new Set(['customer','newCustomer','customers','accept','order','editOrder','newOrder','orders','attendance','revenue','password','profile'])
  };
  function featureMenu(tab,items){
    const role=data.user.actualRole||data.user.role,allowed=roleTools[role];
    featureActions.set(tab,items.filter(([kind])=>(!allowed||allowed.has(kind))&&(!['profile','customers','pool','accept','attendance','revenue','marketing','orders'].includes(kind)||data.navigation.includes(kind)||(kind==='pool'&&role==='ADMIN'))&&(kind!=='reports'||['ADMIN','MANAGER','LEADER'].includes(role))&&(!['import','categories','fields','settings','createTeam','products','distribution','member','emailTest'].includes(kind)||role==='ADMIN')));
  }
  function renderTools(){
    q('#referenceTools')?.remove();
  }
  function removeUnusedControls(){
    q('#tab-team .headline-row button')?.remove();
    q('#referenceTools')?.remove();
    q('#tab-settings .settings-email-grid')?.closest('.settings-section')?.remove();
    q('#tab-settings .settings-attendance-toggle')?.remove();
    q('#tab-settings #leaderAttendanceRequired')?.closest('label')?.remove();
    q('#tab-settings #emailNotificationsEnabled')?.closest('label')?.remove();
    q('#tab-settings #emailTestButton')?.closest('.settings-test-field')?.remove();
    qa('#tab-settings .table-container').forEach(card=>{
      const label=card.textContent||'';
      if(/Email nội bộ|Gửi email cho Sale|Leader bắt buộc điểm danh/i.test(label))card.remove();
    });
    
  }
  function wireParity(){
    removeUnusedControls();
    featureActions.clear();
    featureMenu('customers',[['newCustomer','Thêm khách đầy đủ thông tin'],['customers','Quản lý đầy đủ / lọc nhân sự'],['import','Nhập khách CSV'],['fields','Cột / lưu trữ / khôi phục'],['pool','Chia khách thủ công']]);
    featureMenu('care',[['customers','Hồ sơ, ghi chú và lịch chăm sóc']]);
    featureMenu('dashboard',data.user.role==='SALE'?[['accept','Nhận data · hạn 24 giờ'],['profile','Hồ sơ của tôi']]:[['reports','Báo cáo tổng hợp']]);
    featureMenu('data',data.user.role==='SALE'?[['accept','Nhận data · hạn 24 giờ']]:[['pool','Chia đều / thủ công / tỷ trọng'],['distribution','Bật người nhận và tỷ trọng']]);
    featureMenu('orders',[['newOrder','Tạo đơn đầy đủ thông tin'],['orders','Sửa / xóa / tra cứu đơn']]);
    featureMenu('team',[['member','Thêm thành viên']]);q('#tab-team .headline-row button')?.remove();
    featureMenu('settings',[['password','Đổi mật khẩu của tôi'],['profile','Hồ sơ / avatar'],['settings','Cài đặt đầy đủ']]);
    q('#referenceTools')?.remove();toolsRole=data.user.role;
    q('.user-pill').onclick=()=>{
      if(!q('#referenceProfileStyles')){
        const style=document.createElement('style');style.id='referenceProfileStyles';style.textContent='.profile-modal-card{width:min(560px,calc(100vw - 24px))!important}.reference-profile-tools{display:grid;gap:12px}.reference-profile-summary{display:flex;align-items:center;gap:12px;padding:4px 2px 14px;border-bottom:1px solid var(--border,#e2e8f0);margin-bottom:2px}.reference-sale-calendar{margin-top:18px}.reference-sale-calendar .section-label{margin:0 0 10px;font-weight:800;color:var(--text-main,#0f172a)}.reference-sale-calendar .attendance-detail-calendar{grid-template-columns:repeat(3,minmax(0,1fr))}.reference-sale-calendar .attendance-month-grid{padding:6px;gap:3px}.reference-sale-calendar .attendance-day{min-height:42px;font-size:10px}.reference-sale-calendar .attendance-day small{font-size:8px;line-height:1.1}.reference-profile-avatar{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#eff6ff;color:#2563eb;font-size:17px;font-weight:800}.reference-profile-summary strong,.reference-profile-summary span{display:block}.reference-profile-summary strong{font-size:16px;color:var(--text-main,#0f172a)}.reference-profile-summary span{margin-top:4px;color:var(--text-muted,#64748b);font-size:11px;font-weight:700;text-transform:uppercase}.reference-profile-action{width:100%;display:grid;grid-template-columns:38px 1fr 18px;align-items:center;gap:12px;text-align:left;padding:14px 15px;border:1px solid var(--border,#e2e8f0);border-radius:10px;background:var(--bg-card,#fff);color:var(--text-main,#0f172a);cursor:pointer;transition:border-color .16s,background .16s,transform .16s}.reference-profile-action:hover{border-color:#2563eb;background:#f8fbff;transform:translateY(-1px)}.reference-profile-action strong,.reference-profile-action small{display:block}.reference-profile-action strong{font-size:13px}.reference-profile-action small{margin-top:4px;color:var(--text-muted,#64748b);font-size:11px}.reference-profile-action>b{font-size:22px;font-weight:400;color:#94a3b8;text-align:right}.reference-profile-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;background:#fff7ed;color:#c2410c;font-size:19px;font-weight:700}@media(max-width:560px){.profile-modal-card{width:calc(100vw - 18px)!important}.reference-profile-action{padding:13px 12px}}';
        document.head.appendChild(style);
      }
      const modal=editor('Hồ sơ cá nhân',`<div class="reference-profile-tools">
        <div class="reference-profile-summary"><div class="reference-profile-avatar">${esc((data.user.name||'NVT').split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase())}</div><div><strong>${esc(data.user.name||'Người dùng')}</strong><span>${esc(data.user.actualRole||data.user.role||'')}</span></div></div>
        <button type="button" class="reference-profile-action" data-profile-action="profile"><span class="reference-profile-icon">✎</span><span><strong>Thông tin cá nhân</strong><small>Cập nhật họ tên, ID Sale và avatar</small></span><b>›</b></button>
        <button type="button" class="reference-profile-action" data-profile-action="password"><span class="reference-profile-icon">⌁</span><span><strong>Đổi mật khẩu</strong><small>Cập nhật mật khẩu đăng nhập của bạn</small></span><b>›</b></button>
      </div>`);
      modal.querySelector('.modal-card').classList.add('profile-modal-card');
      modal.querySelector('[data-profile-action="profile"]').onclick=()=>{modal.remove();workflow('profile');};
      modal.querySelector('[data-profile-action="password"]').onclick=()=>{modal.remove();workflow('password');};
    };
    qa('#tab-customers button').filter(b=>/Nhập CSV/.test(b.textContent)).forEach(b=>{b.removeAttribute('onclick');b.onclick=()=>workflow('import');});
    qa('#tab-orders .headline-row button,#tab-revenue .headline-row button').filter(b=>/Xuất CSV/.test(b.textContent)).forEach(b=>{const role=data.user.actualRole||data.user.role;if(role==='SALE')b.remove();else{b.removeAttribute('onclick');b.onclick=()=>run(()=>api.exportData(b.closest('section').id==='tab-orders'?'orders':'revenue',q('#revStartDate').value,q('#revEndDate').value));}});
    qa('#tab-revenue .headline-row button').filter(b=>/Tạo hợp đồng/.test(b.textContent)).forEach(b=>b.remove());
    qa('#tab-settings button').filter(b=>b.textContent.trim()==='Gửi kiểm tra').forEach(b=>{b.removeAttribute('onclick');b.onclick=()=>workflow('emailTest');});
    qa('#tab-revenue .headline-row button').filter(b=>/Tạo hợp đồng/.test(b.textContent)).forEach(b=>{b.removeAttribute('onclick');b.onclick=()=>workflow('newOrder');});
  }
  function installAttendanceDetailStyles(){
    if(q('#attendanceDetailStyles'))return;
    const style=document.createElement('style');style.id='attendanceDetailStyles';style.textContent=`
      .attendance-detail-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
      .attendance-detail-kpi{border:1px solid var(--border);border-radius:8px;background:var(--bg-subtle);padding:12px 14px}
      .attendance-detail-kpi strong{display:block;font-size:23px;line-height:1.1;color:var(--text-main)}
      .attendance-detail-kpi span{display:block;margin-top:5px;color:var(--text-muted);font-size:11px}
      .attendance-detail-calendar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .attendance-month{border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-card)}
      .attendance-month-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:10px 12px;background:var(--bg-subtle);border-bottom:1px solid var(--border);font-size:12px}
      .attendance-month-head small{display:block;color:var(--text-muted);font-size:10px;margin-top:3px}
      .attendance-month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:8px}
      .attendance-weekday{text-align:center;color:var(--text-muted);font-size:10px;font-weight:700;padding:2px 0}
      .attendance-day{min-height:48px;border:1px solid var(--border-light);border-radius:5px;padding:4px;text-align:center;background:var(--bg-card);font-size:11px}
      .attendance-day b{display:block;font-size:11px}.attendance-day small{display:block;margin-top:5px;font-size:9px;line-height:1.1}
      .attendance-day.is-present{background:#ecfdf5;border-color:#a7f3d0;color:#047857}.attendance-day.is-late{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
      .attendance-day.is-missing{background:#fef2f2;border-color:#fecaca;color:#b91c1c}.attendance-day.is-weekend,.attendance-day.is-future{background:var(--bg-subtle);color:var(--text-faint)}
      .attendance-detail-table{margin-top:16px;max-height:250px;overflow:auto;border:1px solid var(--border);border-radius:8px}.attendance-detail-table table{min-width:620px}
      @media(max-width:820px){.attendance-detail-calendar{grid-template-columns:1fr}.attendance-detail-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;document.head.appendChild(style);
  }
  function attendanceMonthIso(base,offset){const d=new Date(String(base).slice(0,10)+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-offset);return {year:d.getUTCFullYear(),month:d.getUTCMonth()};}
  function attendanceDetailMarkup(memberId,selectedMonth=''){
    const member=data.members.find(item=>item.id===memberId);if(!member)return '';
    window.__nvtAttendanceMonthChange=select=>{const body=select.closest('.modal-body');if(body)body.innerHTML=attendanceDetailMarkup(select.dataset.attendanceMember,select.value);};
    const today=String(data.today).slice(0,10),records=data.attendance.filter(item=>item.accountId===memberId&&item.date<=today).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.at).localeCompare(String(a.at)));
    const currentMonth=today.slice(0,7),monthValue=/^\d{4}-\d{2}$/.test(selectedMonth)?selectedMonth:currentMonth;
    const monthOptions=Array.from({length:12},(_,offset)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-offset);const value=d.toISOString().slice(0,7),label=d.toLocaleDateString('vi-VN',{month:'long',year:'numeric',timeZone:'UTC'});return `<option value="${value}" ${value===monthValue?'selected':''}>${esc(label)}</option>`;}).join('');
    const scoped=records.filter(item=>String(item.date||'').slice(0,7)===monthValue);
    const late=scoped.filter(item=>item.late),outside=scoped.filter(item=>item.ipValid===false),weekdays=['T2','T3','T4','T5','T6','T7','CN'];
    const [selectedYear,selectedMonthNumber]=monthValue.split('-').map(Number),selectedMonthIndex=selectedMonthNumber-1;
    const months=[{year:selectedYear,month:selectedMonthIndex}].map(({year,month})=>{const days=new Date(Date.UTC(year,month+1,0)).getUTCDate(),offsetDay=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;let cells=`<div class="attendance-month-picker"><label>Chá»n thÃ¡ng<select data-attendance-month data-attendance-member="${esc(memberId)}" onchange="window.__nvtAttendanceMonthChange(this)">${monthOptions}</select></label></div>`+weekdays.map(day=>`<div class="attendance-weekday">${day}</div>`).join('');let present=0,lateCount=0,missing=0;
      for(let i=0;i<offsetDay;i++)cells+='<div class="attendance-day attendance-empty"></div>';
      for(let day=1;day<=days;day++){const date=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,rec=records.find(item=>item.date===date),dow=(offsetDay+day-1)%7,weekend=dow>=5,future=date>today;let cls='attendance-day',label='';if(future||weekend)cls+=' '+(future?'is-future':'is-weekend');else if(rec){present++;if(rec.late){lateCount++;cls+=' is-late';label=`Muộn ${Number(rec.lateMinutes||0)}p`;}else{cls+=' is-present';label='Đúng giờ';}}else{missing++;cls+=' is-missing';label='Chưa điểm danh';}cells+=`<div class="${cls}" title="${esc(date)}"><b>${day}</b><small>${esc(label)}</small></div>`;}
      const monthName=new Date(Date.UTC(year,month,1)).toLocaleDateString('vi-VN',{month:'long',year:'numeric',timeZone:'UTC'});return `<div class="attendance-month"><div class="attendance-month-head"><div><b>${esc(monthName)}</b><small>${present} có mặt · ${lateCount} muộn · ${missing} chưa điểm danh</small></div></div><div class="attendance-month-grid">${cells}</div></div>`;}).join('');
    const rows=scoped.map(item=>`<tr><td>${esc(fmtDate(item.date))}</td><td>${esc(String(item.at||'').slice(11,16)||'—')}</td><td>${item.late?`<span class="chip chip-warm">Muộn ${Number(item.lateMinutes||0)} phút</span>`:'<span class="chip chip-green">Đúng giờ</span>'}</td><td>${item.ipValid===false?'<span class="chip chip-warm">Ngoài Wi-Fi</span>':'<span class="chip chip-green">Đúng Wi-Fi</span>'}</td><td>${esc(item.note||'—')}</td></tr>`).join('');
    return `<div class="attendance-detail-kpis"><div class="attendance-detail-kpi"><strong>${scoped.length}</strong><span>Ngày đã điểm danh</span></div><div class="attendance-detail-kpi"><strong>${late.length}</strong><span>Lượt đi muộn</span></div><div class="attendance-detail-kpi"><strong>${late.reduce((sum,item)=>sum+Number(item.lateMinutes||0),0)}p</strong><span>Tổng phút trễ</span></div><div class="attendance-detail-kpi"><strong>${outside.length}</strong><span>Ngoài Wi-Fi</span></div></div><div class="attendance-detail-calendar">${months}</div><div class="attendance-detail-table"><table class="modern-table"><thead><tr><th>Ngày</th><th>Giờ</th><th>Kết quả</th><th>Wi-Fi</th><th>Ghi chú</th></tr></thead><tbody>${rows||'<tr><td colspan="5"><div class="empty"><b>Chưa có dữ liệu điểm danh trong 3 tháng</b></div></td></tr>'}</tbody></table></div>`;
  }
  function attendanceDetailModal(memberId){
    const role=data.user.actualRole||data.user.role;if(role!=='ADMIN')return;const member=data.members.find(item=>item.id===memberId);if(!member)return;
    installAttendanceDetailStyles();const modal=editor('Chi tiết điểm danh · '+member.name,attendanceDetailMarkup(memberId));const card=modal.querySelector('.modal-card');if(card){card.style.width='min(1000px,calc(100vw - 24px))';card.style.maxHeight='92dvh';}modal.querySelector('.modal-body')?.style.setProperty('padding','16px');
  }
  function attendance(){
    const role=data.user.actualRole||data.user.role;
    const attendanceTab=q('#tab-attendance');
    if(!['ADMIN','MANAGER','LEADER','SALE'].includes(role)){attendanceTab?.classList.remove('active');return;}
    const attendancePanels=Array.from(attendanceTab?.querySelectorAll('.table-container')||[]);
    if(role!=='ADMIN'){
      // Moi vai tro van hanh tu diem danh va chi xem ket qua cua chinh minh.
      attendancePanels.forEach(panel=>{panel.hidden=true;panel.style.setProperty('display','none','important');});
      let status=attendanceTab?.querySelector('#referenceSaleAttendance');
      if(!status){status=document.createElement('div');status.id='referenceSaleAttendance';status.className='table-container';status.style.cssText='padding:20px 24px;max-width:620px';attendanceTab?.appendChild(status);}
      const attendanceAccountId=data.user.saleId||data.user.leaderId||data.user.id;
      const mine=(data.attendance||[]).find(item=>item.accountId===attendanceAccountId&&item.date===data.today);
      status.hidden=false;status.style.removeProperty('display');
      const todayLabel=new Date(`${String(data.today).slice(0,10)}T00:00:00+07:00`).toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
      status.innerHTML=`<div style="display:grid;gap:14px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div><b style="font-size:18px;color:var(--text-main)">Điểm danh hôm nay</b><div style="margin-top:4px;color:var(--text-muted);font-size:12px;text-transform:capitalize">${esc(todayLabel)}</div></div>
          <span class="chip ${mine?'chip-green':'chip-warm'}">${mine?'Đã điểm danh':'Chưa điểm danh'}</span>
        </div>
        <div class="empty" style="margin:0">
          <b>${mine?'Đã ghi nhận lúc '+esc(String(mine.at||'').slice(11,16)):'Chưa có lượt điểm danh hôm nay'}</b>
          <span>${mine?(mine.late?'Đi muộn '+Number(mine.lateMinutes||0)+' phút':'Đúng giờ'):'Bấm nút bên trên sau khi vào ca làm việc.'}</span>
        </div>
      </div>`;
      let checkInButton=attendanceTab?.querySelector('#referenceCheckIn');
      if(!checkInButton){checkInButton=document.createElement('button');checkInButton.id='referenceCheckIn';checkInButton.className='btn-action btn-primary';checkInButton.textContent='Điểm danh hôm nay';attendanceTab?.querySelector('.headline-row')?.appendChild(checkInButton);}
      checkInButton.hidden=false;
      checkInButton.disabled=Boolean(mine);
      checkInButton.onclick=async event=>{event?.preventDefault?.();event?.stopPropagation?.();if(checkInButton.disabled||working)return;checkInButton.disabled=true;checkInButton.setAttribute('aria-busy','true');try{await run(()=>api.checkIn());}catch(error){checkInButton.disabled=false;throw error;}finally{checkInButton.removeAttribute('aria-busy');}};
      return;
    }
    attendancePanels.forEach(panel=>{panel.hidden=false;panel.style.removeProperty('display');});
    attendanceTab?.querySelector('#referenceSaleAttendance')?.remove();
    attendanceTab?.querySelector('#referenceCheckIn')?.remove();
    const panel=attendancePanels[0],inputs=Array.from(panel?.querySelectorAll('input')||[]);
    if(inputs.length>=3){inputs[0].value=data.settings.attendanceIp||'';inputs[1].type='time';inputs[1].value=data.settings.attendanceDeadline||'09:00';inputs[2].value=24;inputs[2].readOnly=true;inputs.forEach(n=>n.disabled=data.user.role!=='ADMIN');const button=panel.querySelector('button');button.removeAttribute('onclick');button.disabled=data.user.role!=='ADMIN';button.onclick=()=>run(()=>api.attendanceSettings({ip:inputs[0].value,deadline:inputs[1].value}));}
    const body=attendancePanels[1]?.querySelector('tbody');
    const ownMemberIds=new Set([data.user.id,data.user.saleId,data.user.leaderId].filter(Boolean));
    const members=data.members.filter(m=>m.active!==false&&m.role==='SALE'&&(role==='ADMIN'||ownMemberIds.has(m.id)));
    table(body,members.map(m=>{const r=data.attendance.find(r=>r.accountId===m.id&&r.date===data.today);return [m.name+(m.phone?' · '+m.phone:''),m.teamId||'—',r?.at||'Chua diem danh',r?.ip||'—',r?(r.ipValid?'Dung Wi-Fi':'Ngoai Wi-Fi'):'—',r?(r.late?'Muon '+r.lateMinutes+' phut':'Dung gio'):'—',''];}));
    Array.from(body?.rows||[]).forEach((row,index)=>{const button=row.querySelector('button');if(!button)return;button.removeAttribute('onclick');button.textContent='Chi tiet';button.onclick=()=>attendanceDetailModal(members[index]?.id);});
  }
  let brokeragePeriod='';
  function installBrokerageStyles(){
    if(q('#brokerageStyles'))return;const style=document.createElement('style');style.id='brokerageStyles';style.textContent=`
      .brokerage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.brokerage-kpi{padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card)}.brokerage-kpi b{display:block;font-size:20px;color:var(--text-main)}.brokerage-kpi small{display:block;margin-top:4px;color:var(--text-muted)}
      .brokerage-toolbar{display:flex;gap:10px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}.brokerage-toolbar label{display:grid;gap:5px;font-size:11px;font-weight:700;color:var(--text-muted)}.brokerage-toolbar input{padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)}
      .brokerage-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:8px}.brokerage-table{min-width:1250px}.brokerage-table th,.brokerage-table td{white-space:nowrap}.brokerage-table th{text-align:right}.brokerage-table th:nth-child(-n+3),.brokerage-table td:nth-child(-n+3){text-align:left}
      .mindmap{overflow:auto;padding:18px;border:1px solid var(--border);border-radius:8px;background:#161a23;min-height:300px}.mindmap-root{display:inline-block;padding:10px 14px;border-radius:6px;background:#2563eb;color:#fff;font-weight:800}.mindmap-list{list-style:none;margin:12px 0 0 24px;padding:0 0 0 22px;border-left:2px solid #3b82f6}.mindmap-list li{position:relative;margin:10px 0;color:#e2e8f0}.mindmap-list li:before{content:'';position:absolute;left:-24px;top:14px;width:20px;border-top:2px solid #3b82f6}.mindmap-node{display:inline-block;padding:7px 10px;border-radius:6px;background:#252c38;color:#f8fafc;font-size:12px}.mindmap-node small{color:#93c5fd}.mindmap-empty{color:#94a3b8;padding:20px}
      @media(max-width:820px){.brokerage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.brokerage-toolbar{align-items:stretch}.brokerage-toolbar label{width:100%}}
    `;document.head.appendChild(style);
  }
  const brokerageMoney=value=>Number(value||0).toLocaleString('vi-VN')+' VND';
  const brokerageRate=value=>(Number(value||0)*100).toLocaleString('vi-VN',{maximumFractionDigits:2})+'%';
  const brokerageProductType=order=>{const product=data.products.find(item=>item.id===order.productId)||{};const label=(product.category||order.productName||'').toLocaleLowerCase('vi-VN');return product.type==='RENTAL'||label.includes('chỉ báo')||label.includes('indicator')?'INDICATOR':label.includes('khóa học')||label.includes('khoa hoc')?'COURSE':'OTHER';};
  function brokerageSales(){const role=data.user.actualRole||data.user.role;if(role==='ADMIN')return data.members.filter(m=>m.role==='SALE'&&m.active!==false);if(role==='MANAGER')return (data.managerHierarchy?.members||[]).filter(m=>m.role==='SALE'&&m.active!==false);if(role==='LEADER')return data.members.filter(m=>m.role==='SALE'&&m.leaderId===data.user.leaderId&&m.active!==false);return data.members.filter(m=>m.role==='SALE'&&(m.id===data.user.saleId||m.id===data.user.id)&&m.active!==false);}
  function brokerageRows(period){const sales=brokerageSales();return sales.map(member=>{const metric=data.brokerageMetrics?.find(item=>item.memberId===member.id&&item.period===period)||{basicLots:0,microLots:0,nanoLots:0,lotCommissionRate:0,indicatorCommissionRate:0,courseCommissionRate:0,bonus:0,vatRate:0};const paid=data.orders.filter(order=>order.saleId===member.id&&order.status==='PAID'&&String(order.paidAt||order.createdAt||'').slice(0,7)===period);const indicatorRevenue=paid.filter(order=>brokerageProductType(order)==='INDICATOR').reduce((sum,order)=>sum+Number(order.subtotal??order.total??0),0);const courseRevenue=paid.filter(order=>brokerageProductType(order)==='COURSE').reduce((sum,order)=>sum+Number(order.subtotal??order.total??0),0);const lots=Number(metric.basicLots||0)+Number(metric.microLots||0)*.1+Number(metric.nanoLots||0)*.01;const lotCommission=lots*Number(metric.lotCommissionRate||0),indicatorCommission=indicatorRevenue*Number(metric.indicatorCommissionRate||0),courseCommission=courseRevenue*Number(metric.courseCommissionRate||0),bonus=Number(metric.bonus||0),gross=lotCommission+indicatorCommission+courseCommission+bonus,vat=(indicatorCommission+courseCommission)*Number(metric.vatRate||0),net=gross-vat;return {member,metric,lots,indicatorRevenue,courseRevenue,lotCommission,indicatorCommission,courseCommission,bonus,gross,vat,net};}).sort((a,b)=>b.net-a.net||a.member.name.localeCompare(b.member.name,'vi'));}  function brokerageMetricEditor(row,period){const m=row.metric||{},modal=editor('Cập nhật lot, thưởng và hoa hồng · '+row.member.name,formField('Lot cơ bản',`<input id="brokerageBasic" type="number" min="0" step="0.01" value="${Number(m.basicLots||0)}">`)+formField('Micro lot',`<input id="brokerageMicro" type="number" min="0" step="0.01" value="${Number(m.microLots||0)}">`)+formField('Nano lot',`<input id="brokerageNano" type="number" min="0" step="0.01" value="${Number(m.nanoLots||0)}">`)+formField('Hoa hồng / lot chuẩn',`<input id="brokerageLotRate" type="number" min="0" step="1000" value="${Number(m.lotCommissionRate||0)}">`)+formField('Tỷ lệ HH chỉ báo',`<input id="brokerageIndicatorRate" type="number" min="0" max="100" step="0.01" value="${Number(m.indicatorCommissionRate||0)*100}">`)+formField('Tỷ lệ HH khóa học',`<input id="brokerageCourseRate" type="number" min="0" max="100" step="0.01" value="${Number(m.courseCommissionRate||0)*100}">`)+formField('Thưởng',`<input id="brokerageBonus" type="number" min="0" step="1000" value="${Number(m.bonus||0)}"><small style="display:block;margin-top:4px;color:var(--text-muted)">Nhập số tiền thưởng riêng cho Sale này</small>`)+formField('VAT chỉ báo / khóa học',`<input id="brokerageVatRate" type="number" min="0" max="100" step="0.01" value="${Number(m.vatRate||0)*100}">`),()=>api.saveBrokerageMetric({memberId:row.member.id,period,basicLots:q('#brokerageBasic').value,microLots:q('#brokerageMicro').value,nanoLots:q('#brokerageNano').value,lotCommissionRate:q('#brokerageLotRate').value,indicatorCommissionRate:Number(q('#brokerageIndicatorRate').value)/100,courseCommissionRate:Number(q('#brokerageCourseRate').value)/100,bonus:q('#brokerageBonus').value,vatRate:Number(q('#brokerageVatRate').value)/100}));modal.querySelector('.modal-card').style.width='min(760px,calc(100vw - 24px))';}  function toggleBrokeragePublication(period){const published=new Set(data.settings?.brokeragePublishedPeriods||[]);if(published.has(period))published.delete(period);else published.add(period);run(()=>api.settings({brokeragePublishedPeriods:Array.from(published).sort()}),()=>businessReport());}
  function businessReport(){
    const host=q('#businessReportHost');if(!host)return;installBrokerageStyles();const period=brokeragePeriod||data.today.slice(0,7);brokeragePeriod=period;const role=data.user.actualRole||data.user.role,rows=brokerageRows(period),published=role==='ADMIN'||(data.settings?.brokeragePublishedPeriods||[]).includes(period),visibleRows=published?rows:rows.map(row=>({...row,lots:0,indicatorRevenue:0,courseRevenue:0,lotCommission:0,indicatorCommission:0,courseCommission:0,bonus:0,gross:0,vat:0,net:0,metric:{...row.metric,basicLots:0,microLots:0,nanoLots:0}})),sum=key=>visibleRows.reduce((total,row)=>total+Number(row[key]||0),0);
    host.innerHTML=`<div class="headline-row"><div><h1>Báo cáo kinh doanh</h1></div></div><div class="brokerage-toolbar"><label>Kỳ báo cáo<input id="brokeragePeriod" type="month" value="${esc(period)}"></label>${role==='ADMIN'?`<button type="button" class="btn-action ${published?'btn-secondary':'btn-primary'}" id="brokeragePublishBtn">${published?'Ẩn kỳ báo cáo':'Công bố tháng này'}</button>`:''}</div><div class="brokerage-grid"><article class="brokerage-kpi"><small>Lot chuẩn</small><b>${sum('lots').toFixed(2)}</b></article><article class="brokerage-kpi"><small>DS chỉ báo</small><b>${brokerageMoney(sum('indicatorRevenue'))}</b></article><article class="brokerage-kpi"><small>Tổng hoa hồng</small><b>${brokerageMoney(sum('gross'))}</b></article><article class="brokerage-kpi"><small>VAT chỉ báo / khóa học</small><b>${brokerageMoney(sum('vat'))}</b></article><article class="brokerage-kpi"><small>Thực nhận</small><b>${brokerageMoney(sum('net'))}</b></article></div><div class="brokerage-table-wrap"><table class="modern-table brokerage-table"><thead><tr><th>#</th><th>Nhân sự</th><th>Team</th><th>Lot cơ bản</th><th>Micro</th><th>Nano</th><th>Lot chuẩn</th><th>DS chỉ báo</th><th>DS khóa học</th><th>HH lot</th><th>HH chỉ báo</th><th>HH khóa học</th><th>Thưởng</th><th>Tổng thu</th><th>VAT</th><th>Thực nhận</th>${role==='ADMIN'?'<th></th>':''}</tr></thead><tbody>${visibleRows.map((row,index)=>`<tr><td>${index+1}</td><td><b>${esc(row.member.name)}</b><div style="font-size:10px;color:var(--text-muted)">${esc(row.member.accountId||row.member.phone||'')}</div></td><td>${esc(row.member.teamId||'—')}</td><td>${Number(row.metric.basicLots||0)}</td><td>${Number(row.metric.microLots||0)}</td><td>${Number(row.metric.nanoLots||0)}</td><td><b>${row.lots.toFixed(2)}</b></td><td>${brokerageMoney(row.indicatorRevenue)}</td><td>${brokerageMoney(row.courseRevenue)}</td><td>${brokerageMoney(row.lotCommission)}</td><td>${brokerageMoney(row.indicatorCommission)}<div style="font-size:10px;color:var(--text-muted)">${brokerageRate(row.metric.indicatorCommissionRate)}</div></td><td>${brokerageMoney(row.courseCommission)}<div style="font-size:10px;color:var(--text-muted)">${brokerageRate(row.metric.courseCommissionRate)}</div></td><td>${brokerageMoney(row.bonus)}</td><td><b>${brokerageMoney(row.gross)}</b></td><td>${brokerageMoney(row.vat)}<div style="font-size:10px;color:var(--text-muted)">${brokerageRate(row.metric.vatRate)}</div></td><td><b>${brokerageMoney(row.net)}</b></td>${role==='ADMIN'?`<td><button class="btn-action btn-secondary" data-brokerage-edit="${esc(row.member.id)}">Lot / tỷ lệ</button></td>`:''}</tr>`).join('')||'<tr><td colspan="17"><div class="empty"><b>Chưa có Sale trong phạm vi</b></div></td></tr>'}</tbody></table></div>`;
    q('#brokeragePeriod').onchange=e=>{brokeragePeriod=e.target.value||data.today.slice(0,7);businessReport();};q('#brokeragePublishBtn')?.addEventListener('click',()=>toggleBrokeragePublication(period));host.querySelectorAll('[data-brokerage-edit]').forEach(button=>button.onclick=()=>brokerageMetricEditor(rows.find(row=>row.member.id===button.dataset.brokerageEdit),period));
  }  function accountingMindmap(rows,period){const salesByLeader=new Map();rows.forEach(row=>{const list=salesByLeader.get(row.member.leaderId)||[];list.push(row);salesByLeader.set(row.member.leaderId,list);});const leaders=data.members.filter(member=>member.role==='LEADER'&&member.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'vi'));return `<div class="mindmap"><div class="mindmap-root">CÂY MÔI GIỚI · ${esc(period)}</div>${leaders.length?`<ul class="mindmap-list">${leaders.map(leader=>{const children=salesByLeader.get(leader.id)||[];return `<li><span class="mindmap-node"><b>${esc(leader.name)}</b> <small>${esc(leader.accountId||leader.id)} · ${children.reduce((sum,row)=>sum+row.lots,0).toFixed(2)} lot</small></span><ul class="mindmap-list">${children.map(row=>`<li><span class="mindmap-node">${esc(row.member.name)} <small>${esc(row.member.accountId||row.member.id)} · ${row.lots.toFixed(2)} lot · ${brokerageMoney(row.net)}</small></span></li>`).join('')||'<li><span class="mindmap-node">Chưa có Sale</span></li>'}</ul></li>`;}).join('')}</ul>`:'<div class="mindmap-empty">Chưa có cấu trúc Leader / Sale để dựng cây môi giới.</div>'}</div>`;}
  function accountingReport(){const host=q('#accountingHost');if(!host)return;installBrokerageStyles();const period=brokeragePeriod||data.today.slice(0,7),rows=brokerageRows(period),sum=key=>rows.reduce((total,row)=>total+Number(row[key]||0),0);host.innerHTML=`<div class="headline-row"><div><h1>Kế toán</h1></div></div><div class="brokerage-toolbar"><label>Kỳ kế toán<input id="accountingPeriod" type="month" value="${esc(period)}"></label></div><div class="brokerage-grid"><article class="brokerage-kpi"><small>Doanh số chỉ báo</small><b>${brokerageMoney(sum('indicatorRevenue'))}</b></article><article class="brokerage-kpi"><small>Doanh số khóa học</small><b>${brokerageMoney(sum('courseRevenue'))}</b></article><article class="brokerage-kpi"><small>Tổng thu hoa hồng</small><b>${brokerageMoney(sum('gross'))}</b></article><article class="brokerage-kpi"><small>Thực nhận sau VAT</small><b>${brokerageMoney(sum('net'))}</b></article></div><section style="margin-bottom:14px"><div class="table-container"><div class="table-head-bar"><div><b>Bảng xếp hạng thực nhận</b></div></div><div class="brokerage-table-wrap"><table class="modern-table brokerage-table"><thead><tr><th>#</th><th>Sale</th><th>Lot chuẩn</th><th>HH lot</th><th>HH chỉ báo</th><th>HH khóa học</th><th>Tổng thu</th><th>VAT</th><th>Thực nhận</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${index+1}</td><td>${esc(row.member.name)}</td><td>${row.lots.toFixed(2)}</td><td>${brokerageMoney(row.lotCommission)}</td><td>${brokerageMoney(row.indicatorCommission)}</td><td>${brokerageMoney(row.courseCommission)}</td><td>${brokerageMoney(row.gross)}</td><td>${brokerageMoney(row.vat)}</td><td><b>${brokerageMoney(row.net)}</b></td></tr>`).join('')||'<tr><td colspan="9">Chưa có dữ liệu.</td></tr>'}</tbody></table></div></div></section><section><div class="table-container"><div class="table-head-bar"><div><b>Cây Mindmap môi giới</b><div style="font-size:11px;color:var(--text-muted)">Hiển thị theo tuyến Leader → Sale, lot chuẩn và thực nhận trong kỳ.</div></div></div>${accountingMindmap(rows,period)}</div></section>`;q('#accountingPeriod').onchange=e=>{brokeragePeriod=e.target.value||data.today.slice(0,7);accountingReport();};}
  function renderCustomerImportHistory(){
    const panel=q('#customerImportHistory'),body=q('#customerImportHistoryBody');
    if(!panel||!body)return;
    const role=data.user.actualRole||data.user.role,isAdmin=role==='ADMIN';
    panel.hidden=!isAdmin;panel.style.setProperty('display',isAdmin?'':'none','important');
    if(!isAdmin){body.replaceChildren();return;}
    const imports=(data.imports||[]).slice(0,8);
    body.innerHTML=imports.map(item=>'<tr><td style="font-family:var(--font-mono);font-size:11.5px">'+esc(fmtDate(item.importedAt))+'</td><td><b>'+esc(item.source||'—')+'</b></td><td><code>'+esc(item.filename||'—')+'</code></td><td><b>'+Number(item.records||0).toLocaleString('vi-VN')+'</b></td><td>'+esc(item.actor||'Hệ thống')+'</td><td><span class="chip '+(item.status==='SUCCESS'?'chip-green':'chip-cold')+'">'+(item.status==='SUCCESS'?'Thành công':'Thất bại')+'</span></td></tr>').join('')||'<tr><td colspan="6"><div class="empty"><b>Chưa có lịch sử cập nhật data</b></div></td></tr>';
    const add=q('#customerImportSourceButton');if(add)add.onclick=()=>workflow('import');
  }
  function renderManagerScope(){
    // Data cua Manager hien thi chung mot bang voi Admin, khong chen panel Leader rieng.
    q('#managerScope')?.remove();
    return;
    if(data.user.actualRole!=='MANAGER'){q('#managerScope')?.remove();return;}
    let panel=q('#managerScope');if(!panel){panel=document.createElement('div');panel.id='managerScope';panel.className='widget-box';q('.content-body').prepend(panel);}
    const leaders=(data.managerHierarchy?.members||[]).filter(m=>m.role==='LEADER'&&m.managerId===data.user.id&&m.active!==false);
    const key=JSON.stringify(leaders);if(panel.dataset.signature===key)return;panel.dataset.signature=key;
    panel.innerHTML='<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap"><div><b>Toàn bộ Leader được Admin phân công</b><small style="display:block;margin-top:4px;color:var(--text-muted)">Manager xem tổng khách hàng, doanh thu và dữ liệu của tất cả Leader trong tuyến.</small></div><span class="chip">'+leaders.length+' Leader</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+(leaders.length?leaders.map(l=>'<span class="chip chip-info">'+esc(l.name)+' · '+esc(l.teamId||'Chưa có Team')+'</span>').join(''):'<span class="chip">Chưa được Admin phân công Leader</span>')+'</div>';
  }
  function dateDefaults(){['order','rev','team'].forEach(p=>{const start=q('#'+p+'StartDate'),end=q('#'+p+'EndDate');if(start)start.value=fromDay(30);if(end)end.value=data.today;});}
  let toolsRole='',renderedTabs=new Map();
  const rememberActiveTab=id=>{
    if(!id)return;
    try{sessionStorage.setItem(ACTIVE_TAB_KEY,id);}catch{}
  };
  const savedActiveTab=()=>{
    try{return sessionStorage.getItem(ACTIVE_TAB_KEY)||'';}catch{return '';}
  };
  const sessionTokenHint=()=>{
    try{
      const session=JSON.parse(sessionStorage.getItem('nvt-crm-session-v1')||'null');
      return session?.token?String(session.token).slice(0,24):'';
    }catch{return '';}
  };
  const readCachedSnapshot=()=>{
    const tokenHint=sessionTokenHint();
    if(!tokenHint)return null;
    try{
      const cached=JSON.parse(sessionStorage.getItem(SNAPSHOT_CACHE_KEY)||'null');
      return cached?.tokenHint===tokenHint&&cached.snapshot?.user?.id?cached.snapshot:null;
    }catch{return null;}
  };
  const cacheSnapshot=snapshot=>{
    const tokenHint=sessionTokenHint();
    if(!tokenHint||!snapshot?.user?.id)return;
    try{sessionStorage.setItem(SNAPSHOT_CACHE_KEY,JSON.stringify({tokenHint,savedAt:Date.now(),snapshot}));}catch{}
  };
  const tabAllowedForSnapshot=id=>{
    if(!data||!id||!q('#'+id))return false;
    const view=id.replace(/^tab-/,'');
    const role=data.user.actualRole||data.user.role;
    const alias={data:role==='LEADER'?'pool':role==='SALE'?'accept':'distribution'};
    return data.navigation.includes(alias[view]||view);
  };
  function paintTab(id,force=false){
    if(!data)return;
    const jobs={
      'tab-customers':[()=>{renderCustomerTable();renderCustomerImportHistory();},[data.customers,data.members,data.fields,data.offers,data.imports]],
      'tab-care':[renderCareView,[data.customers,data.fields,data.careGroups]],
      'tab-data':[renderDataQueue,[data.customers,data.pendingOffers,data.members,data.offers,data.resubmissions,data.assignmentHistory,data.settings,data.leaderDistribution,data.saleDistributionByLeader,data.today,data.assignedDataStats]],
      'tab-orders':[drawOrders,[data.orders,data.members]],
      'tab-products':[catalog,[data.products]],
      'tab-team':[team,[data.members,data.registeredAccounts,data.customers,data.orders,data.managerHierarchy]],
      'tab-notifications':[notices,[data.notifications,data.audit]],
      'tab-audit':[notices,[data.audit,data.notifications]],
      'tab-revenue':[renderRevenue,[data.orders,data.financialEvents]],
      'tab-businessReport':[businessReport,[data.orders,data.products,data.members,data.brokerageMetrics]],
      'tab-accounting':[accountingReport,[data.orders,data.products,data.members,data.brokerageMetrics]],
      'tab-dashboard':[()=>{dashboard();dashboardExtras();},[data.customers,data.orders,data.members,data.financialEvents,data.managerHierarchy,data.offers,data.pendingOffers]],
      'tab-websites':[()=>{sourceAnalytics();websites();},[data.websites,data.customers,data.orders,data.webhookPending,data.webhookTransport]],
      'tab-attendance':[attendance,[data.attendance,data.members,data.settings]],
      'tab-settings':[bindReferenceSettings,[data.settings,data.fonts]]
    };
    const job=jobs[id];if(!job)return;const key=JSON.stringify([data.user.id,...job[1]]);
    if(force||renderedTabs.get(id)!==key){job[0]();renderedTabs.set(id,key);}
  }
  function refresh(force=false) {
    normalizeAccountingMenu();
    if(!force&&(document.hidden||working||workflowBusy||q('.modal-overlay.open')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)))return;
    const runtime=frame.contentWindow;
    api=runtime?.crmApi;
    // crmApi is available before CRM finishes restoring a saved session. Waiting here
    // prevents the login/static index screen from flashing after F5.
    if(!api)return;
    let next=api.snapshot();
    cachedSnapshotUsed=false;
    if(!next&&runtime?.crmRuntimeAuthState==='restoring'){
      const cached=readCachedSnapshot();
      if(cached){next=cached;cachedSnapshotUsed=true;}
    }
    // Cho phép mở ngay khi snapshot hợp lệ đã có; cờ boot chỉ cần dùng để
    // xác nhận trạng thái đăng xuất khi snapshot đang là null.
    if(!next && runtime?.crmRuntimeBooted!==true)return;
    // A valid token can still be restoring while auth/state requests are in flight.
    // Keep the boot screen during that window instead of showing a false login form.
    if(!next && runtime?.crmRuntimeAuthState!=='unauthenticated')return;
    if(!next){data=null;signature='';if(bootFallbackTimer){clearTimeout(bootFallbackTimer);bootFallbackTimer=null;}bootScreen?.setAttribute('hidden','');frame.hidden=false;frame.style.display='block';frame.classList.add('is-login-visible');document.body.classList.remove('reference-ready');q('.app-shell')?.style.setProperty('visibility','hidden');q('.bg-aura')?.style.setProperty('visibility','hidden');return;}
    const first=!data;if(bootFallbackTimer){clearTimeout(bootFallbackTimer);bootFallbackTimer=null;}data=next;if(!cachedSnapshotUsed)cacheSnapshot(next);frame.hidden=true;frame.style.display='none';frame.classList.remove('is-login-visible');document.body.classList.add('reference-ready');q('.app-shell')?.style.setProperty('visibility','visible');q('.bg-aura')?.style.setProperty('visibility','visible');
    const sign=JSON.stringify(data);
    if(!force && !first && (sign===signature||working||q('.modal-overlay.open')||q('#careGroupModal')?.style.display==='flex'||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)))return;
    signature=sign;if(first){dateDefaults();bindReferenceSettings();setupSources();installRoleVisibilityObserver();installPendingDataStyles();}
    project();
    installCustomerJourney();
    // Chỉ dựng tab đang xem; số thông báo vẫn cập nhật độc lập.
    if(first)renderedTabs.clear();
    const storedTab=savedActiveTab();
    const initialTab=tabAllowedForSnapshot(storedTab)?storedTab:'tab-dashboard';
    paintTab('tab-notifications');
    paintTab(initialTab);wireParity();
    // Restore the outer tab after the runtime snapshot is ready. The static HTML
    // starts on Dashboard, so rendering alone would otherwise overwrite Data.
    if(first||q('section.active[id^="tab-"]')?.id!==initialTab)switchTab(initialTab);
    applySaleDataLayout();
    // Khi F5 đang mở trực tiếp tab Data, tab tĩnh có thể được dựng trước khi
    // renderer tham chiếu khởi tạo. Vẽ lại ngay để Admin luôn thấy cùng một
    // bảng đầy đủ, không cần bấm qua tab khác trước.
    if(['ADMIN','MANAGER','LEADER'].includes(data.user.actualRole||data.user.role)&&q('section.active#tab-data')){
      renderManagementDataTable(data.user.actualRole||data.user.role);
    }
    bootScreen?.setAttribute('hidden','');
    text('sidebarDataBadge',data.user.role==='SALE'?(data.pendingOffers||[]).length:data.customers.filter(c=>!c.saleId).length);
    q('#sidebarCareBadge')?.remove();
    q('#sidebarTeamBadge')?.remove();
    const alias={data:data.user.role==='LEADER'?'pool':data.user.role==='SALE'?'accept':'distribution'};
    const role=data.user.actualRole||data.user.role,visible=new Set(data.navigation);
    const adminOnlyTabs=restrictedAdminTabs;
    qa('.nav-link[data-tab]').forEach(button=>{const tab=button.dataset.tab.replace('tab-','');button.hidden=adminOnlyTabs.has(tab)?role!=='ADMIN':!visible.has(alias[tab]||tab);});
    // Sale khong dung muc Doi ngu, an khoi thanh dieu huong de giao dien gon hon.
    const saleAccount=(data.user.role==='SALE'||data.user.actualRole==='SALE');
    qa('.nav-link[data-tab="tab-team"],[data-view-link="team"]').forEach(node=>{node.hidden=saleAccount;node.style.setProperty('display',saleAccount?'none':'','important');});
    const teamSection=q('#tab-team');if(teamSection){teamSection.hidden=saleAccount;teamSection.style.setProperty('display',saleAccount?'none':'','important');}
    // Không để các liên kết tĩnh trong dashboard mở được mục Admin-only bằng cách click trực tiếp.
    qa('[onclick*="tab-websites"],[onclick*="tab-products"],[onclick*="tab-audit"],[onclick*="tab-settings"]').forEach(link=>{link.hidden=role!=='ADMIN';});
    adminOnlyTabs.forEach(tab=>{const section=q('#tab-'+tab);if(section)section.hidden=role!=='ADMIN';});
    if(role!=='ADMIN'&&adminOnlyTabs.has(q('section.active[id^="tab-"]')?.id?.replace('tab-','')))renders.switchTab('tab-dashboard');
    applyRoleVisibility();
    // Non-admin không thấy mã đơn/mã nội bộ trên giao diện nghiệp vụ.
    if(role!=='ADMIN')qa('th').forEach(th=>{if(th.textContent.trim()==='Mã đơn')th.textContent='Đơn hàng';});
    const profile=q('.topbar .user-details');if(profile){profile.querySelector('b').textContent=data.user.name;profile.querySelector('small').textContent=data.user.actualRole||data.user.role;}
    const heading=q('#tab-dashboard .headline-row h1');if(heading)heading.textContent=data.user.actualRole==='MANAGER'?'Tổng quan hệ thống được giao':data.user.role==='LEADER'?'Tổng quan Team':data.user.role==='SALE'?'Tổng quan của tôi':'Tổng quan';
    renderManagerScope();
    q('#toggleLeaderDistribution').disabled=data.user.role!=='ADMIN';q('#assignmentModeSelect').disabled=data.user.role!=='ADMIN';q('#toggleLeaderDistribution').checked=data.leaderDistribution.enabled===true;
    q('#assignmentModeSelect').value=data.settings.assignmentMode||'MANUAL';
    text('autoStatWaiting',data.customers.filter(c=>!c.leaderId).length);text('autoStatLeaders',(data.leaderDistribution.enabledLeaderIds||[]).length);
  }
  updateCustomerClass=(id,value)=>run(()=>api.classify(id,value));
  assignCustomerSale=(id,value)=>run(()=>api.assign(id,value));
  openNewCustomerModal=function(){
    if(!data)return;
    const role=data.user.actualRole||data.user.role,currentId=data.user.id,all=data.members.filter(m=>m.active!==false),leaders=new Set(all.filter(m=>m.role==='LEADER'&&m.managerId===currentId).map(m=>m.id));
    const sourceOptions=[opt('SOURCE:OLD_CUSTOMER','Khách hàng cũ'),opt('SOURCE:OUTSIDE_DATA','Khách hàng ngoài data'),...data.websites.map(w=>opt(w.id,w.name||w.domain))];
    const managerSales=role==='MANAGER'?all.filter(m=>m.role==='SALE'&&(m.managerId===currentId||leaders.has(m.leaderId))):[];
    const recipients=role==='ADMIN'?all.filter(m=>['MANAGER','LEADER','SALE'].includes(m.role)):role==='MANAGER'?[...all.filter(m=>m.id===currentId),...all.filter(m=>m.role==='LEADER'&&m.managerId===currentId),...managerSales]:role==='LEADER'?[...all.filter(m=>m.id===currentId),...all.filter(m=>m.role==='SALE'&&m.leaderId===currentId)]:[];
    const uniqueRecipients=recipients.filter((m,i,list)=>list.findIndex(item=>item.id===m.id)===i);
    q('#newCustSource').innerHTML=sourceOptions.join('');q('#newCustClass').innerHTML=fieldOptions('customerClass').map(o=>opt(o.value,o.label)).join('');q('#newCustLevel').innerHTML=fieldOptions('customerLevel').map(o=>opt(o.value,o.label)).join('');q('#newCustSale').innerHTML=opt('','— Chưa phân Sale —',role==='MANAGER'?'':undefined)+uniqueRecipients.map(m=>opt(m.id,m.name+(m.role==='MANAGER'?' (Manager)':m.role==='LEADER'?' (Leader)':''),role==='MANAGER'&&m.id===currentId)).join('');
    q('#newCustomerModal').classList.add('open');
  };
  closeNewCustomerModal=function(){q('#newCustomerModal')?.classList.remove('open');};
  submitNewCustomer=()=>{const sourceValue=q('#newCustSource')?.value||'',website=data.websites.find(w=>w.id===sourceValue||w.name===sourceValue||w.domain===sourceValue)||data.websites[0],sourceLabel=sourceValue==='SOURCE:OLD_CUSTOMER'?'Khách hàng cũ':sourceValue==='SOURCE:OUTSIDE_DATA'?'Khách hàng ngoài data':website?.name||'Nhập thủ công';return run(()=>api.createCustomer({name:q('#newCustName').value.trim(),phone:q('#newCustPhone').value,email:q('#newCustEmail').value.trim(),websiteId:website?.id||sourceValue,saleId:q('#newCustSale').value==='unassigned'?'':q('#newCustSale').value,source:sourceLabel,note:'Tạo thủ công từ CRM',customFields:{customerClass:q('#newCustClass').value,customerLevel:q('#newCustLevel').value}}),()=>{closeNewCustomerModal();q('#newCustName').value='';q('#newCustPhone').value='';q('#newCustEmail').value='';});};
  openCareGroupModal=()=>openCareEditor();
  closeCareGroupModal=()=>{if(working)return;q('#careGroupModal').style.display='none';q('#careGroupModal').classList.remove('open');refresh(true);};
  updateCareGroupOptions=function(){const key=q('#careGroupFieldSelect').value;CARE_FIELD_OPTIONS[key]=fieldOptions(key).map(o=>({value:esc(o.value),label:esc(o.label)}));renders.careOptions();qa('.care-value-checkbox').forEach(n=>{const color=validColor(fieldOptions(key).find(o=>o.value===n.value)?.color);n.parentElement.style.color=color;n.parentElement.style.backgroundColor=color+'18';});};
  handleSaveCareGroup=function(event){event.preventDefault();run(()=>api.saveCare(editingCareId,{name:q('#careGroupNameInput').value,fieldId:q('#careGroupFieldSelect').value,values:qa('.care-value-checkbox:checked').map(n=>n.value),color:q('#refCareColor').value}),()=>{careKey='';q('#careGroupModal').style.display='none';q('#careGroupModal').classList.remove('open');});};
  openOrderModal=function(){const customers=data.customers.filter(c=>c.saleId);if(!customers.length){alert('Chưa có khách đã phân Sale để tạo đơn.');return;}q('#modalCustomerSelect').innerHTML=customers.map(c=>opt(c.id,c.name+' · '+c.phone,selectedCustomer)).join('');q('#prodSelect').innerHTML=data.products.filter(p=>p.active!==false).map(p=>opt(p.id,p.name+' · '+money(p.price))).join('');q('#orderModal').classList.add('open');orderAmounts();};
  function orderAmounts(){const p=data?.products.find(p=>p.id===q('#prodSelect').value);text('subText',money(p?.price));text('vatText',money(Math.round((p?.price||0)*.1)));text('totText',money(Math.round((p?.price||0)*1.1)));}
  q('#prodSelect').addEventListener('change',orderAmounts);
  q('#orderStatusFilterSelect')?.addEventListener('change',filterOrdersCombined);
  const clearAutofilledCustomerSearch=()=>{const ownEmail=String(data?.user?.email||'').trim().toLowerCase();const customerSearch=q('#custSearchInput'),globalSearch=q('#topGlobalSearch');[customerSearch,globalSearch].forEach(input=>{if(!input)return;input.setAttribute('autocomplete','off');input.setAttribute('autocapitalize','none');if(ownEmail&&String(input.value||'').trim().toLowerCase()===ownEmail)input.value='';});};
  q('#topGlobalSearch')?.addEventListener('input',event=>{q('#custSearchInput').value=event.target.value;renderCustomerTable();});
  assignStaffRole=id=>memberEditor(id);
  assignDataAction=()=>workflow(data.user.role==='SALE'?'accept':'pool');
  submitOrder=()=>run(()=>api.createOrder({customerId:q('#modalCustomerSelect').value,productId:q('#prodSelect').value,paymentMode:q('#modalPaymentType').value,paymentMethod:qa('#orderModal select')[3]?.selectedIndex===1?'CASH':'VietQR'}),result=>{closeOrderModal();alert('Đã lưu đơn '+result.code+' chờ xác nhận thanh toán.');});
  openDrawerForCust=function(id){selectedCustomer=id;renders.drawer(id);const c=data.customers.find(c=>c.id===id);if(!c)return;text('drawerName',c.name);text('drawerPhone',c.phone);text('drawerCreated','Ngày tạo: '+fmtDate(c.createdAt));text('drawerClass',c.customFields?.customerClass||'');text('drawerLevel',c.customFields?.customerLevel||'');q('#drawerCallBtn').href='tel:'+String(c.phone||'').replace(/[^\d+]/g,'');if(!q('#referenceFullCustomer')){const b=document.createElement('button');b.id='referenceFullCustomer';b.className='btn-action btn-primary';b.textContent='Hồ sơ / Ghi chú / Lịch chăm sóc';q('#drawerCallBtn').parentElement.appendChild(b);}q('#referenceFullCustomer').onclick=()=>workflow('customer',id);};
  function showOrderSuccess(result){
    q('#referenceOrderSuccess')?.remove();
    const modal=document.createElement('div');
    modal.id='referenceOrderSuccess';
    modal.className='modal-overlay open';
    modal.innerHTML='<div class="modal-card order-success-card" role="dialog" aria-modal="true" aria-labelledby="orderSuccessTitle"><div class="modal-header"><h3 id="orderSuccessTitle">Tạo đơn hàng thành công</h3><button type="button" class="modal-close-btn" data-order-success-close aria-label="Đóng">×</button></div><div class="modal-body order-success-body"><div class="order-success-icon" aria-hidden="true">✓</div><h4>Đơn hàng đã được lưu</h4><p>Mã đơn: <b data-order-success-code></b></p><p class="order-success-note">Đơn đang chờ xác nhận thanh toán.</p></div><div class="modal-footer"><button type="button" class="btn-action btn-primary" data-order-success-close>Đã hiểu</button></div></div>';
    document.body.appendChild(modal);
    const code=modal.querySelector('[data-order-success-code]');
    if(code)code.textContent=shortOrderCode(result?.code||result?.id);
    modal.querySelectorAll('[data-order-success-close]').forEach(button=>button.onclick=()=>modal.remove());
    modal.onclick=event=>{if(event.target===modal)modal.remove();};
  }
  // Ghi đè callback cũ để dùng form thành công trong giao diện, không dùng alert().
  submitOrder=()=>run(()=>api.createOrder({customerId:q('#modalCustomerSelect').value,productId:q('#prodSelect').value,paymentMode:q('#modalPaymentType').value,paymentMethod:qa('#orderModal select')[3]?.selectedIndex===1?'CASH':'VietQR'}),result=>{closeOrderModal();showOrderSuccess(result);});
  markAllNotificationsRead=()=>run(()=>api.readNotifications());
  // Khi bat tu dong, mac dinh dung che do ty trong cho data moi.
  toggleAutoDist=enabled=>run(()=>api.distribution(enabled,enabled?'BALANCED':data.settings.assignmentMode));
  updateAssignmentMode=mode=>run(()=>api.distribution(data.leaderDistribution.enabled,mode));
  switchTab=function(id){if(data){const view=id.replace('tab-',''),alias={data:data.user.role==='LEADER'?'pool':data.user.role==='SALE'?'accept':'distribution'},target=alias[view]||view;if(!data.navigation.includes(target)&&!data.navigation.includes(view))return;}rememberActiveTab(id);renders.switchTab(id);if(data){if(id==='tab-customers')clearAutofilledCustomerSearch();if(id==='tab-data'&&(data.user.actualRole||data.user.role)==='SALE'){const search=q('#dataQueueSearch');if(search)search.value='';}paintTab(id,id==='tab-data');wireParity();}};
  qa('.nav-link[data-tab]').forEach(button=>button.addEventListener('click',()=>rememberActiveTab(button.dataset.tab),true));
  filterTeamPeriod=(period,button)=>{q('#teamStartDate').value=fromDay(parseInt(period)||30);q('#teamEndDate').value=data.today;if(button){qa('.team-period-btn').forEach(b=>b.className='btn-secondary team-period-btn');button.className='btn-primary team-period-btn';}updateTeamDateLabel();};
  updateTeamDateLabel=()=>text('teamDateRangeLabel',fmtDate(q('#teamStartDate').value)+' - '+fmtDate(q('#teamEndDate').value));
  let revenuePeriod=30;
  function renderRevenue(){if(!data)return;const actualRole=data.user.actualRole||data.user.role;const subtitle=q('#tab-revenue .headline-row > div:first-child > div');if(subtitle)subtitle.textContent=actualRole==='MANAGER'?`Chỉ hiển thị doanh thu Team ${data.user.teamId||'được chọn'} thuộc tuyến Manager`:actualRole==='LEADER'?`Chỉ hiển thị doanh thu Team ${data.user.teamId||''} do bạn quản lý`:actualRole==='SALE'?'Chỉ hiển thị doanh thu từ khách hàng bạn phụ trách':'Báo cáo doanh thu toàn hệ thống';const start=q('#revStartDate').value,end=q('#revEndDate').value;const events=data.financialEvents.filter(e=>(!start||e.occurredAt?.slice(0,10)>=start)&&(!end||e.occurredAt?.slice(0,10)<=end));const total=events.reduce((s,e)=>s+Number(e.amount||0),0);const rentalIds=new Set(data.orders.filter(o=>o.rentalMonths).map(o=>o.id));const rent=events.filter(e=>rentalIds.has(e.orderId)).reduce((s,e)=>s+Number(e.amount||0),0),sale=total-rent;const pct=total?Math.max(0,Math.min(100,sale/total*100)):0;const circle=q('#revSvgSaleCircle'),rentCircle=q('#revSvgRentCircle');circle?.setAttribute('stroke-dasharray',`${pct/100*326.73} 326.73`);rentCircle?.setAttribute('stroke-dasharray',`${total?(100-pct)/100*326.73:0} 326.73`);rentCircle?.setAttribute('transform',`rotate(${-90+pct*3.6} 80 80)`);text('revSvgSaleText',pct.toFixed(1)+'%');text('revSvgRentText',(total?100-pct:0).toFixed(1)+'%');text('revDonutCenterAmount',money(total));text('revDonutCenterPeriod',revenuePeriod+' NGÀY');text('revDonutTotalAmount',money(total));text('revStatSoldAmount',money(total));text('revDonutSalePercent',pct.toFixed(1)+'%');text('revDonutRentPercent',(total?100-pct:0).toFixed(1)+'%');text('revDonutSaleDetail',money(sale));text('revDonutRentDetail',money(rent));text('revDonutVatAmount',money(data.orders.filter(o=>o.status==='PAID'&&o.paidAt?.slice(0,10)>=start&&o.paidAt?.slice(0,10)<=end).reduce((s,o)=>s+Number(o.vatAmount||0),0)));table(q('#revenueSalesTableBody'),events.map(e=>{const o=data.orders.find(o=>o.id===e.orderId)||{};return [internalCode(e.code),fmtDate(e.occurredAt),e.customerName,o.productName,e.label,o.source||'—',person(o.saleId),money(o.subtotal),money(o.vatAmount),money(e.amount),o.status,''];}));Array.from(q('#revenueSalesTableBody')?.rows||[]).forEach((r,i)=>r.querySelectorAll('button').forEach(b=>{b.removeAttribute('onclick');b.onclick=()=>workflow('order',events[i].orderId);}));table(q('#rentalCustomersTableBody'),data.orders.filter(o=>o.rentalMonths).map(o=>[o.customerName,o.productName,fmtDate(o.rentalEndsAt),money(o.total),o.status,'']));Array.from(q('#rentalCustomersTableBody')?.rows||[]).forEach((r,i)=>r.querySelectorAll('button').forEach(b=>{b.removeAttribute('onclick');b.onclick=()=>workflow('order',data.orders.filter(o=>o.rentalMonths)[i].id);}));}
  // Bổ sung URL Landing Page sau khi renderer cũ dựng bảng, để dữ liệu hiển thị
  // luôn truy ngược được về đúng website đã nạp khách và không dùng dữ liệu mẫu.
  const baseRenderRevenue=renderRevenue;
  renderRevenue=function(){
    baseRenderRevenue();
    const start=q('#revStartDate')?.value,end=q('#revEndDate')?.value;
    const events=(data?.financialEvents||[]).filter(e=>(!start||e.occurredAt?.slice(0,10)>=start)&&(!end||e.occurredAt?.slice(0,10)<=end));
    qa('#revenueSalesTableBody tr').forEach((row,index)=>{const event=events[index],order=data?.orders?.find(item=>item.id===event?.orderId),customer=data?.customers?.find(item=>item.id===order?.customerId),website=data?.websites?.find(item=>item.id===(order?.websiteId||customer?.websiteId));if(row.cells[5])row.cells[5].textContent=website?.sourceUrl||customer?.landingPageUrl||order?.source||'—';});
    const startDate=start||data?.today,endDate=end||data?.today;
    const dayMs=86400000,parseDay=value=>{const time=Date.parse(`${value}T00:00:00+07:00`);return Number.isFinite(time)?time:Date.now();};
    const periodLength=Math.max(1,Math.round((parseDay(endDate)-parseDay(startDate))/dayMs)+1);
    const previousEnd=new Date(parseDay(startDate)-dayMs).toISOString().slice(0,10),previousStart=new Date(parseDay(startDate)-periodLength*dayMs).toISOString().slice(0,10);
    const eventIn=(event,from,to)=>{const day=String(event?.occurredAt||'').slice(0,10);return day>=from&&day<=to;};
    const metrics=(from,to)=>{
      const rangeEvents=(data?.financialEvents||[]).filter(event=>eventIn(event,from,to));
      const orderMap=new Map((data?.orders||[]).map(order=>[order.id,order]));
      let course=0,rental=0,tax=0;
      rangeEvents.forEach(event=>{const order=orderMap.get(event.orderId);if(!order)return;const amount=Number(event.amount||0),totalAmount=Math.max(0,Number(order.total||0)),orderTax=Math.max(0,Number(order.vatAmount||0));if(order.rentalMonths)rental+=amount;else course+=amount;if(totalAmount>0)tax+=amount*orderTax/totalAmount;});
      const total=course+rental;
      const courseOrders=(data?.orders||[]).filter(order=>!order.rentalMonths&&['PAID','COURSE_GRANTED'].includes(order.status)&&eventIn({occurredAt:order.paidAt||order.createdAt},from,to));
      const activeRentalCustomers=new Set((data?.orders||[]).filter(order=>order.rentalMonths&&order.status!=='REFUNDED'&&(!order.rentalEndsAt||String(order.rentalEndsAt).slice(0,10)>=to)).map(order=>order.customerId));
      return {course,rental,total,tax,afterTax:total-tax,courseCount:courseOrders.length,rentalCustomers:activeRentalCustomers.size};
    };
    const current=metrics(startDate,endDate),previous=metrics(previousStart,previousEnd),change=(value,old)=>{if(!old)return value?100:0;return (value-old)/Math.abs(old)*100;},badge=value=>`${value>=0?'+':''}${value.toFixed(1)}%`;
    const updateCard=(id,title,value,sub,deltaValue)=>{const valueNode=q(`#${id}`);if(!valueNode)return;valueNode.textContent=money(value);const card=valueNode.closest('.bento-card');if(!card)return;const titleNode=card.querySelector('div:first-child span:first-child');if(titleNode)titleNode.textContent=title;const footer=card.querySelector('div[style*="margin-top: 10px"]');if(footer){const parts=footer.querySelectorAll('span,b');if(parts[0])parts[0].textContent=sub||'';if(parts[1])parts[1].textContent='';}const chip=card.querySelector('div:first-child span:last-child');if(chip){chip.textContent=badge(deltaValue);chip.style.background=deltaValue>=0?'#dcfce7':'#fee2e2';chip.style.color=deltaValue>=0?'#15803d':'#b91c1c';}};
    updateCard('revStatSoldAmount','DOANH THU KHÓA HỌC',current.course,`${current.courseCount} khóa bán`,change(current.course,previous.course));
    updateCard('revStatRentingCust','DOANH THU THUÊ CHỈ BÁO',current.rental,`${current.rentalCustomers} khách đang thuê`,change(current.rental,previous.rental));
    updateCard('revStatMrr','Tá»"NG DOANH THU',current.total,'',change(current.total,previous.total));
    updateCard('revStatAov','DOANH THU SAU THUẾ',current.afterTax,'',change(current.afterTax,previous.afterTax));
    text('revRentalCountFooter',`${current.rentalCustomers} khách`);
    text('revRentalAmountFooter',money(current.rental));
    text('revTransactionCountFooter',`${events.length} giao dịch`);
    text('revNetAmountFooter',money(current.total));
    text('revGrossAmountFooter',money(current.total));
    const heading=q('#tab-revenue h1');if(heading)heading.textContent='Doanh thu khóa học và thuê công cụ, chỉ báo';
  };
  setRevenueDonutPeriod=(period,btn)=>{revenuePeriod=parseInt(period)||30;q('#revStartDate').value=fromDay(revenuePeriod);q('#revEndDate').value=data.today;qa('#donutRevenuePeriodTabs button,#revenueTopPeriodTabs button').forEach(b=>b.classList.toggle('active',parseInt(b.textContent)===revenuePeriod));renderRevenue();};
  filterRevenuePeriod=setRevenueDonutPeriod;applyCustomRevenueDate=renderRevenue;
  function bindSettings(){const root=q('#tab-settings'),selects=root.querySelectorAll('select:not([data-feature-menu])'),ranges=root.querySelectorAll('input[type=range]'),inputs=root.querySelectorAll('input');const fonts=Object.fromEntries(data.fonts||[]);selects[1].innerHTML=(data.fonts||[]).map(([key,label])=>opt(key,label,data.settings.fontFamily||'aptos')).join('');
    if(!Array.from(selects[0].options).some(o=>o.value===(data.settings.customAccent||'#2563eb')))selects[0].add(new Option(data.settings.customAccent,data.settings.customAccent));selects[0].value=data.settings.customAccent||'#2563eb';if(!q('#referenceAccentPicker')){const picker=document.createElement('input');picker.id='referenceAccentPicker';picker.type='color';picker.value=selects[0].value;selects[0].parentElement.appendChild(picker);picker.oninput=()=>{if(!Array.from(selects[0].options).some(o=>o.value===picker.value))selects[0].add(new Option(picker.value,picker.value));selects[0].value=picker.value;preview();};}selects[1].value=data.settings.fontFamily||'aptos';ranges[0].value=data.settings.navigationFontSize||12;ranges[1].value=data.settings.contentFontSize||14;
    const settingsFields={};root.querySelectorAll('.form-group').forEach(group=>{const label=group.querySelector('label')?.textContent||'',input=group.querySelector('input');if(!input)return;const key=label.includes('DATA - TOKEN')?'dataBotToken':label.includes('DATA - CHAT ID')?'dataBotChatId':label.includes('THÀNH VIÊN - TOKEN')?'memberBotToken':label.includes('THÀNH VIÊN - CHAT ID')?'memberBotChatId':null;if(key){settingsFields[key]=input;input.value=data.settings[key]||'';}});root.querySelector('input[type=checkbox]')?.setAttribute('data-legacy-hidden','true');
    const preview=()=>{const style=document.documentElement.style;style.setProperty('--accent',selects[0].value);style.setProperty('--font-sans',"'"+(fonts[selects[1].value]||'Aptos')+"', sans-serif");qa('.nav-link').forEach(n=>n.style.fontSize=ranges[0].value+'px');qa('.content-body input:not([type=range]),.content-body select,.content-body td').forEach(n=>n.style.fontSize=ranges[1].value+'px');selects[0].nextElementSibling.style.background=selects[0].value;ranges.forEach(range=>{range.previousElementSibling?.querySelector('span:last-child')&&(range.previousElementSibling.querySelector('span:last-child').textContent=range.value+'PX');});};
    selects[0].onchange=preview;selects[1].onchange=preview;ranges.forEach(r=>r.oninput=preview);if(data.settings.referenceAppearance)preview();
    const save=qa('#tab-settings button').find(b=>(b.getAttribute('onclick')||'').includes('Đã lưu cấu hình CRM')||b.textContent.trim()==='Lưu cấu hình');
    if(save){save.removeAttribute('onclick');save.onclick=()=>run(()=>api.settings({customAccent:selects[0].value,fontFamily:selects[1].value,navigationFontSize:Number(ranges[0].value),contentFontSize:Number(ranges[1].value),referenceAppearance:true,...Object.fromEntries(Object.entries(settingsFields).map(([key,input])=>[key,input.value.trim()]))}),()=>alert('Đã lưu cấu hình.'));}
  }

  // Binding rieng cho lop giao dien tham chieu. Dung id co dinh de nut Luu
  // van hoat dong du HTML bi thay doi thu tu hoac bi cache ban cu.
  function bindReferenceSettings(){
    const root=q('#tab-settings');
    if(!root||!data?.settings)return;
    const settings=data.settings;
    const colorSelect=q('#referenceThemeColorSelect');
    const fontSelect=q('#referenceFontFamilySelect');
    const navigationRange=q('#referenceNavigationFontSize');
    const contentRange=q('#referenceContentFontSize');
    const emailEnabled=q('#referenceEmailNotificationsEnabled');
    const dataToken=q('#referenceDataBotToken');
    const dataChatId=q('#referenceDataBotChatId');
    const memberToken=q('#referenceMemberBotToken');
    const memberChatId=q('#referenceMemberBotChatId');
    const leaderAttendance=q('#leaderAttendanceRequired');
    let colorPicker=q('#referenceAccentPicker');
    const fonts=Object.fromEntries(data.fonts||[]);

    if(!colorSelect||!fontSelect||!navigationRange||!contentRange)return;
    if(!Array.from(colorSelect.options).some(option=>option.value===(settings.customAccent||'#e8572a'))){
      colorSelect.add(new Option(settings.customAccent,settings.customAccent));
    }
    colorSelect.value=settings.customAccent||'#e8572a';
    fontSelect.innerHTML=(data.fonts||[]).map(([key,label])=>opt(key,label,settings.fontFamily||'aptos')).join('');
    fontSelect.value=settings.fontFamily||'aptos';
    navigationRange.value=settings.navigationFontSize||12;
    contentRange.value=settings.contentFontSize||14;
    if(emailEnabled)emailEnabled.checked=settings.emailNotificationsEnabled!==false;
    if(dataToken)dataToken.value=settings.dataBotToken||'';
    if(dataChatId)dataChatId.value=settings.dataBotChatId||'';
    if(memberToken)memberToken.value=settings.memberBotToken||'';
    if(memberChatId)memberChatId.value=settings.memberBotChatId||'';
    if(leaderAttendance)leaderAttendance.checked=settings.leaderAttendanceRequired!==false;

    if(!colorPicker){
      colorPicker=document.createElement('input');
      colorPicker.id='referenceAccentPicker';
      colorPicker.type='color';
      colorPicker.setAttribute('aria-label','Chon mau chu dao');
      colorPicker.style.cssText='width:38px;height:38px;padding:2px;border:1px solid var(--border);border-radius:8px;cursor:pointer;flex-shrink:0;';
      colorSelect.parentElement?.appendChild(colorPicker);
    }
    colorPicker.value=colorSelect.value;

    const preview=()=>{
      const accent=colorSelect.value;
      const font=fonts[fontSelect.value]||fontSelect.value||'Aptos';
      document.documentElement.style.setProperty('--accent',accent);
      document.documentElement.style.setProperty('--accent-dark',accent);
      document.documentElement.style.setProperty('--accent-soft',accent+'18');
      document.documentElement.style.setProperty('--font-sans',`'${font}', sans-serif`);
      document.documentElement.style.setProperty('--sans',`'${font}', sans-serif`);
      document.documentElement.style.setProperty('--navigation-font-size',navigationRange.value+'px');
      document.documentElement.style.setProperty('--content-font-size',contentRange.value+'px');
      qa('.nav-link').forEach(node=>node.style.fontSize=navigationRange.value+'px');
      qa('.content-body input:not([type=range]),.content-body select,.content-body td').forEach(node=>node.style.fontSize=contentRange.value+'px');
      if(colorPicker)colorPicker.value=accent;
      const swatch=colorSelect.parentElement?.querySelector('[data-settings-color-swatch]')||colorSelect.parentElement?.lastElementChild;
      if(swatch&&swatch!==colorPicker)swatch.style.background=accent;
      const values=[navigationRange,contentRange];
      values.forEach(range=>{const valueNode=range.parentElement?.previousElementSibling?.querySelector('span:last-child');if(valueNode)valueNode.textContent=range.value+'PX';});
    };
    colorSelect.onchange=preview;
    colorPicker.oninput=()=>{if(!Array.from(colorSelect.options).some(option=>option.value===colorPicker.value))colorSelect.add(new Option(colorPicker.value,colorPicker.value));colorSelect.value=colorPicker.value;preview();};
    fontSelect.onchange=preview;
    navigationRange.oninput=preview;
    contentRange.oninput=preview;
    preview();

    let save=q('#referenceSettingsSaveButton');
    if(!save){
      save=document.createElement('button');
      save.id='referenceSettingsSaveButton';
      save.type='button';
      save.className='btn-action btn-primary';
      save.textContent='L\u01b0u c\u00e0i \u0111\u1eb7t';
      (root.querySelector('.settings-actions')||root.querySelector('.table-container:last-child'))?.appendChild(save);
    }
    save.onclick=async()=>{
      if(working)return;
      const original=save.textContent;
      save.disabled=true;
      save.textContent='\u0110ang l\u01b0u...';
      const payload={
        customAccent:colorSelect.value,
        fontFamily:fontSelect.value,
        navigationFontSize:Number(navigationRange.value),
        contentFontSize:Number(contentRange.value),
        emailNotificationsEnabled:emailEnabled?emailEnabled.checked:true,
        leaderAttendanceRequired:leaderAttendance?leaderAttendance.checked:true,
        dataBotToken:dataToken?.value.trim()||'',
        dataBotChatId:dataChatId?.value.trim()||'',
        memberBotToken:memberToken?.value.trim()||'',
        memberBotChatId:memberChatId?.value.trim()||'',
        referenceAppearance:true
      };
      try{
        await run(()=>api.settings(payload),()=>window.alert('\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t giao di\u1ec7n cho to\u00e0n h\u1ec7 th\u1ed1ng.'));
      }finally{
        save.disabled=false;
        save.textContent=original;
      }
    };
  }

  function sourceAnalytics(){
    const period=q('#sourcePeriodSelect')?.value||'all';
    const since=period==='today'?data.today:period==='week'?fromDay(7):period==='month'?data.today.slice(0,7)+'-01':'';
    const pool=data.customers.filter(c=>!since||c.createdAt?.slice(0,10)>=since);
    q('#sourcePeriodSelect')?.querySelectorAll('option').forEach(n=>n.textContent=({today:'Hôm nay',week:'7 ngày qua',month:'Tháng này',all:'Tất cả thời gian'})[n.value]||n.textContent);
    const groups=data.websites.map(w=>({name:w.name||w.domain,count:pool.filter(c=>c.websiteId===w.id).length,color:'#2563eb'}));
    const unknown=pool.filter(c=>!data.websites.some(w=>w.id===c.websiteId)).length;if(unknown)groups.push({name:'Chưa gắn nguồn',count:unknown,color:'#94a3b8'});
    const wrap=q('#sourceDonutWrap');if(wrap)wrap.innerHTML=drawDonutSvg(groups.map((g,i)=>({pct:pool.length?g.count/pool.length*100:0,color:['#0284c7','#c084fc','#10b981'][i%3],label:g.count+' khách'})),String(pool.length),'DATA');
    const legend=q('#sourceLegendWrap');if(legend)legend.innerHTML=groups.map(g=>'<div style="padding:8px 10px;background:var(--bg-subtle);border-radius:7px;border-left:3px solid #0284c7"><b>'+esc(g.name)+'</b><span style="float:right">'+g.count+'</span></div>').join('');
    text('sourceFooterWrap',pool.length+' khách');
    const totals=qa('#tab-websites .analytics-grid:first-of-type [style*="font-size: 32px"]');[data.customers.length,data.customers.filter(c=>!c.saleId).length,data.customers.filter(c=>c.saleId).length].forEach((v,i)=>primaryText(totals[i],String(v)));
  }
  switchSourcePeriod=sourceAnalytics;
  renderFunnelChart=()=>{if(!data)return;const value=q('#funnelLpSelect')?.value;const pool=data.customers.filter(c=>!value||value==='all'||c.websiteId===value);const paid=new Set(data.orders.filter(o=>o.status==='PAID').map(o=>o.customerId));const count=pool.filter(c=>paid.has(c.id)).length;const pct=pool.length?count/pool.length*100:0;q('#funnelDonutWrap').innerHTML=drawDonutSvg([{pct,color:'#10b981',label:pct.toFixed(1)+'%'},{pct:pool.length?100-pct:0,color:'#94a3b8',label:'Còn lại'}],String(pool.length),'KHÁCH');text('funnelWinRateText',pct.toFixed(1)+'%');text('funnelLegendWrap','Đã mua: '+count+' · Còn lại: '+(pool.length-count));text('funnelRevenueText',money(data.orders.filter(o=>o.status==='PAID'&&pool.some(c=>c.id===o.customerId)).reduce((s,o)=>s+Number(o.total||0),0)));};
  const setupSources=()=>{q('#funnelLpSelect').innerHTML=opt('all','Tất cả Landing page')+data.websites.map(w=>opt(w.id,w.name)).join('');renderFunnelChart();};
  // Các nút không có form nghiệp vụ trong mẫu được giữ vị trí, không báo thành công giả.
  document.addEventListener('click',event=>{const button=event.target.closest('[onclick]');if(!button)return;const code=button.getAttribute('onclick')||'';
    if(code.startsWith('alert(')){event.preventDefault();event.stopImmediatePropagation();if(code.includes('đăng xuất')){run(()=>api.logout(),()=>{data=null;signature='';frame.style.display='block';});}else if(code.includes('đánh dấu')||code.includes('đã đọc'))markAllNotificationsRead();else alert('Chức năng này chưa có form kết nối trong giao diện mẫu; sẽ bổ sung ở đợt sau.');}
  },true);
  qa('#tab-customers button').filter(b=>b.textContent.trim()==='Quản lý cột').forEach(b=>b.onclick=fieldManager);
  function renderDistributionWeights(){
    const host=q('#dataSubViewSales');
    const role=data.user?.actualRole||data.user?.role;
    if(!host||!data||!['ADMIN','MANAGER'].includes(role))return;
    const scopedMembers=role==='MANAGER'?(data.managerHierarchy?.members||data.members||[]):(data.members||[]);
    const allMembers=role==='MANAGER'
      ? [...scopedMembers.filter(m=>m.id!==data.user.id), {...data.user,role:"MANAGER"}]
      : scopedMembers;
    const managerLeaders=role==='MANAGER'
      ? allMembers.filter(m=>m.active!==false&&m.role==='LEADER'&&m.managerId===data.user.id)
      : [];
    const managerLeaderIds=new Set(managerLeaders.map(m=>m.id));
    const members=(role==='MANAGER'
      ? allMembers.filter(m=>m.active!==false&&(
          m.id===data.user.id ||
          managerLeaderIds.has(m.id) ||
          (m.role==='SALE'&&(m.managerId===data.user.id||m.leaderId===data.user.id||managerLeaderIds.has(m.leaderId)))
        ))
      : allMembers
    ).filter(m=>m.active!==false&&['MANAGER','LEADER','SALE'].includes(m.role));
    const managers=members.filter(m=>m.role==='MANAGER').sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi'));
    const leaders=members.filter(m=>m.role==='LEADER').sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi'));
    const sales=members.filter(m=>m.role==='SALE').sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi'));
    const byManager=id=>leaders.filter(l=>l.managerId===id);
    const byLeader=id=>sales.filter(x=>x.leaderId===id);
    const directSales=id=>sales.filter(x=>(x.managerId===id&&!leaders.some(l=>l.id===x.leaderId))||x.leaderId===id);
    const enabledLeaders=new Set(data.leaderDistribution?.enabledLeaderIds||[]);
    const initials=m=>String(m.name||'?').trim().split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase()||'?';
    const branchCustomerCount=(member,kind)=>{
      const ids=new Set();
      (data.customers||[]).forEach(customer=>{
        const personal=kind==='SALE'
          ? customer.saleId===member.id
          : kind==='LEADER'
            ? customer.saleId===member.id
            : customer.saleId===member.id||(customer.managerId===member.id&&!customer.leaderId);
        if(personal)ids.add(customer.id);
      });
      if(kind==='SALE')(data.offers||[]).forEach(offer=>{if(offer.status==='PENDING'&&offer.saleId===member.id)ids.add(offer.customerId);});
      return ids.size;
    };
    const weightOf=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):1;};
    const cycleDetails=new Map();
    const storedGlobalRound=data.saleDistributionByLeader?.['$']?.rounds?.[0]||data.saleDistributionByLeader?.['$']||null;
    const cycleSummary=(people,configs,key)=>{
      const config=configs?.[0]||{};
      const enabledIds=new Set(Array.isArray(config.enabledSaleIds)?config.enabledSaleIds:people.map(person=>person.id));
      const active=people.filter(person=>(person.teamLeaderRecipient?config.leaderEnabled!==false:enabledIds.has(person.id))&&weightOf(config.weights?.[person.id])>0).sort((a,b)=>a.id.localeCompare(b.id));
      const next=active.flatMap(person=>Array.from({length:weightOf(config.weights?.[person.id])},()=>person));
      // Vòng toàn hệ thống dùng cursor.global; cursor.salesByTeam chỉ dành cho vòng của từng Team.
      const raw=key==='global'
        ? data.settings?.assignmentCursor?.global
        : data.settings?.assignmentCursor?.salesByTeam?.[key];
      const savedIds=raw&&typeof raw==='object'&&Array.isArray(raw.ids)?raw.ids.map(String):[];
      const saved=savedIds.map(id=>people.find(person=>person.id===id)).filter(person=>person&&active.some(item=>item.id===person.id));
      const sequence=saved.length?saved:next;
      const activeIds=new Set(active.map(person=>person.id));
      const offerRecipientByCustomer=new Map();
      (data.offers||[]).forEach(offer=>{
        if(offer.customerId&&offer.saleId&&!offerRecipientByCustomer.has(offer.customerId))offerRecipientByCustomer.set(offer.customerId,offer.saleId);
      });
      const recipientOf=item=>item.offeredSaleId||offerRecipientByCustomer.get(item.customerId)||item.toSaleId||item.toLeaderId;
      const assignments=(data.assignmentHistory||[]).filter(item=>{
        if(item.source!=='AUTO')return false;
        // Lượt chuyển tiếp từ Leader/Manager xuống Team không làm tăng lượt của vòng chung.
        if(key==='global'&&/(trong Team|tiếp cho Sale|tiep cho Sale)/i.test(String(item.reason||'')))return false;
        const recipientId=recipientOf(item);
        return activeIds.has(recipientId);
      }).sort((a,b)=>String(a.at||'').localeCompare(String(b.at||''))||String(a.id||'').localeCompare(String(b.id||'')));
      const hasCursor=raw&&typeof raw==='object'&&Number.isInteger(raw.index);
      const cursorIndex=hasCursor?Math.max(0,raw.index):0;
      const index=sequence.length?Math.min(cursorIndex,sequence.length):0;
      const received=sequence.slice(0,index);
      const upcoming=sequence.slice(index);
      return {key,length:sequence.length,index,round:key==='global'&&sequence.length?1:sequence.length?Math.floor(cursorIndex/sequence.length)+1:0,received,upcoming:upcoming.length?upcoming:next,completed:sequence.length>0&&index===sequence.length};
    };
    const cycleMarkup=(summary)=>{
      cycleDetails.set(summary.key,summary);
      const percent=summary.length?summary.index/summary.length*100:0;
      return '<div class="distribution-cycle"><div class="distribution-cycle-ring" style="--cycle-progress:'+percent+'%" role="img" aria-label="\u0110\u00e3 ph\u00e2n '+summary.index+' trên '+summary.length+' l\u01b0\u1ee3t"><span><b>'+summary.index+'/'+summary.length+'</b><small>l\u01b0\u1ee3t</small></span></div><div class="distribution-cycle-info"><b>V\u00f2ng '+summary.round+'</b><small>'+(summary.completed?'\u0110\u00e3 h\u1ebft v\u00f2ng · l\u01b0\u1ee3t ti\u1ebfp theo b\u1eaft \u0111\u1ea7u v\u00f2ng m\u1edbi':summary.length?'\u0110\u00e3 ph\u00e2n '+summary.index+' l\u01b0\u1ee3t trong v\u00f2ng':'Ch\u01b0a c\u00f3 ng\u01b0\u1eddi nh\u1eadn')+'</small><button type="button" class="distribution-cycle-detail" data-cycle-detail="'+esc(summary.key)+'">Chi ti\u1ebft \u2192</button></div></div>';
    };
    const showCycleDetails=(key,trigger)=>{
      const summary=cycleDetails.get(key);if(!summary)return;
      q('#distributionCycleModal')?.remove();
      const modal=document.createElement('div');modal.id='distributionCycleModal';modal.className='modal-overlay open';modal.style.zIndex='11000';
      const list=(people,received)=>people.length?'<ol class="distribution-cycle-list">'+people.map((person,i)=>'<li><span class="distribution-cycle-position">'+(i+1)+'</span><div><b>'+esc(person.name||person.id)+'</b><small>'+esc(person.managerRecipient?'MANAGER':person.teamLeaderRecipient?'LEADER':person.role||'SALE')+'</small></div><span class="distribution-cycle-status '+(received?'is-done':'')+'">'+(received?'\u0110\u00e3 ph\u00e2n':i===0?'Ti\u1ebfp theo':'Ch\u1edd l\u01b0\u1ee3t')+'</span></li>').join('')+'</ol>':'<p class="distribution-cycle-empty">'+(received?'Ch\u01b0a c\u00f3 l\u01b0\u1ee3t ph\u00e2n trong v\u00f2ng n\u00e0y.':'Ch\u01b0a c\u00f3 ng\u01b0\u1eddi \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n nh\u1eadn data.')+'</p>';
      modal.innerHTML='<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="distributionCycleTitle" style="width:min(860px,calc(100vw - 24px));max-height:90dvh;overflow:auto"><div class="modal-header"><h3 id="distributionCycleTitle">Chi ti\u1ebft v\u00f2ng ph\u00e2n data · '+summary.index+'/'+summary.length+'</h3><button type="button" class="modal-close-btn" aria-label="\u0110\u00f3ng">×</button></div><div class="modal-body"><p class="distribution-cycle-note">M\u1ed7i d\u00f2ng l\u00e0 m\u1ed9t l\u01b0\u1ee3t theo t\u1ef7 tr\u1ecdng. \u0110\u00e3 ph\u00e2n l\u00e0 \u0111\u00e3 giao data, g\u1ed3m c\u1ea3 data \u0111ang ch\u1edd nh\u00e2n s\u1ef1 b\u1ea5m nh\u1eadn.</p><div class="distribution-cycle-columns"><section><h4>\u0110\u00e3 ph\u00e2n trong v\u00f2ng n\u00e0y <span>'+summary.received.length+'</span></h4>'+list(summary.received,true)+'</section><section><h4>'+ (summary.completed?'Th\u1ee9 t\u1ef1 v\u00f2ng ti\u1ebfp theo':'Th\u1ee9 t\u1ef1 chu\u1ea9n b\u1ecb nh\u1eadn')+'</h4>'+list(summary.upcoming,false)+'</section></div></div></div>';
      const close=()=>{modal.remove();trigger?.focus();};
      modal.querySelector('button').onclick=close;modal.onclick=event=>{if(event.target===modal)close();};
      modal.onkeydown=event=>{if(event.key==='Escape')close();if(event.key==='Tab'){event.preventDefault();modal.querySelector('button').focus();}};
      document.body.appendChild(modal);modal.querySelector('button').focus();
    };
    const row=(member,kind,level)=>{
      const isManager=kind==='MANAGER',isLeader=kind==='LEADER';
      const managerLeaders=isManager?byManager(member.id):[];
      const configIds=isManager
        ? (managerLeaders.length?managerLeaders.map(leader=>leader.id):['manager:'+member.id])
        : [isLeader?member.id:(leaders.some(l=>l.id===member.leaderId)?member.leaderId:'manager:'+(member.managerId||member.leaderId))];
      const configs=configIds.map(id=>data.saleDistributionByLeader?.[id]||{});
      const config=configs[0]||{};
      const weight=storedGlobalRound?.weights?.[member.id]===undefined?(isLeader?weightOf(data.leaderDistribution?.weights?.[member.id]):weightOf(config?.weights?.[member.id])):weightOf(storedGlobalRound.weights[member.id]);
      const enabled=isLeader
        ? (storedGlobalRound?.enabledSaleIds?storedGlobalRound.enabledSaleIds.includes(member.id):enabledLeaders.has(member.id)) && configs.every(item=>item.leaderEnabled!==false)
        : isManager
          ? (storedGlobalRound?.enabledSaleIds?storedGlobalRound.enabledSaleIds.includes(member.id):configs.every(item=>item.managerDistributionInitialized!==true||!Array.isArray(item.enabledSaleIds)||item.enabledSaleIds.includes(member.id)))
          : (storedGlobalRound?.enabledSaleIds?storedGlobalRound.enabledSaleIds.includes(member.id):(config.managerDistributionInitialized!==true||!Array.isArray(config.enabledSaleIds)||config.enabledSaleIds.includes(member.id)));
      const load=branchCustomerCount(member,kind);
      const canEdit=role==='ADMIN'||(role==='MANAGER'&&(
        (kind==='MANAGER'&&member.id===data.user.id) ||
        (kind==='LEADER'&&member.managerId===data.user.id) ||
        (kind==='SALE'&&(member.managerId===data.user.id||member.leaderId===data.user.id||managerLeaderIds.has(member.leaderId)))
      ));
      const controls=canEdit
        ? '<label>Ty trong <input type="number" min="0" max="100" value="'+weight+'" data-ref-distribution-weight="'+kind+':'+esc(member.id)+'"></label><label class="distribution-check"><input type="checkbox" '+(enabled?'checked':'')+' data-ref-distribution-member="'+kind+':'+esc(member.id)+'"><span>'+(enabled?'Dang nhan':'Tam tat')+'</span></label>'
        : '<span class="distribution-readonly">Chi xem</span>';
      return '<div class="distribution-person-row level-'+level+'"><div class="distribution-person-main"><span class="distribution-avatar">'+esc(initials(member))+'</span><span><b>'+esc(member.name||'Chua dat ten')+'</b><small>'+esc(kind)+' · '+esc(member.teamId||'Chua gan Team')+' · '+load+' khach</small></span></div><div class="distribution-person-controls">'+controls+'</div></div>';
    };
    // One shared cycle for the complete agency.
    const globalCycle=()=>{
      const storedGlobal=data.saleDistributionByLeader?.['$']||{};
      const activeRound=storedGlobal.rounds?.[0]||storedGlobal;
      const enabledGlobal=new Set(Array.isArray(activeRound.enabledSaleIds)?activeRound.enabledSaleIds:[]);
      const people=[],weights={},seen=new Set();
      const add=(person,weight)=>{const effective=weightOf(activeRound.weights?.[person?.id]===undefined?weight:activeRound.weights[person.id]);if(!person||seen.has(person.id)||(enabledGlobal.size&&!enabledGlobal.has(person.id))||effective<=0)return;seen.add(person.id);people.push(person);weights[person.id]=effective;};
      const addLeaderBranch=(leader,config)=>{
        if(enabledLeaders.has(leader.id)&&config.leaderEnabled!==false)add({...leader,role:'SALE',teamLeaderRecipient:true},data.leaderDistribution?.weights?.[leader.id]);
        const configured=config.managerDistributionInitialized===true&&Array.isArray(config.enabledSaleIds)&&config.enabledSaleIds.length>0;
        sales.filter(sale=>sale.leaderId===leader.id&&(!configured||config.enabledSaleIds.includes(sale.id))).forEach(sale=>add(sale,config.weights?.[sale.id]));
        const manager=managers.find(item=>item.id===leader.managerId);
        if(manager&&(!configured||config.enabledSaleIds.includes(manager.id)))add({...manager,role:'SALE',managerRecipient:true,leaderId:leader.id,teamId:leader.teamId},config.weights?.[manager.id]);
      };
      managers.forEach(manager=>{
        const directConfig=data.saleDistributionByLeader?.['manager:'+manager.id]||{};
        const directConfigured=directConfig.managerDistributionInitialized===true&&Array.isArray(directConfig.enabledSaleIds)&&directConfig.enabledSaleIds.length>0;
        if(directSales(manager.id).length){
          if(directConfig.leaderEnabled!==false)add({...manager,role:'SALE',managerRecipient:true,leaderId:null,teamId:manager.teamId},directConfig.weights?.[manager.id]);
          directSales(manager.id).forEach(sale=>{if(!directConfigured||directConfig.enabledSaleIds.includes(sale.id))add({...sale,directManagerBranch:true},directConfig.weights?.[sale.id]);});
        }
        byManager(manager.id).forEach(leader=>addLeaderBranch(leader,data.saleDistributionByLeader?.[leader.id]||{}));
      });
      leaders.filter(leader=>!leader.managerId).forEach(leader=>addLeaderBranch(leader,data.saleDistributionByLeader?.[leader.id]||{}));
      const config={leaderEnabled:true,enabledSaleIds:people.map(person=>person.id),weights};
      if(!people.length)return '';
      const activeSummary=cycleSummary(people,[config],'global');
      const currentMarkup=cycleMarkup(activeSummary);
      const queuedRounds=Array.isArray(storedGlobal.rounds)?storedGlobal.rounds.slice(1):[];
      const queuedMarkup=queuedRounds.map((round,index)=>{
        const enabled=new Set(Array.isArray(round.enabledSaleIds)?round.enabledSaleIds:people.map(person=>person.id));
        const sequence=people.filter(person=>enabled.has(person.id)&&weightOf(round.weights?.[person.id])>0).flatMap(person=>Array.from({length:weightOf(round.weights?.[person.id])},()=>person));
        const key='global-round-'+round.id;
        const summary={key,length:sequence.length,index:0,round:index+2,received:[],upcoming:sequence,completed:false};
        cycleDetails.set(key,summary);
        return '<div class="distribution-cycle distribution-cycle-next"><div class="distribution-cycle-ring" style="--cycle-progress:0%" role="img" aria-label="Vòng '+(index+2)+' chưa bắt đầu"><span><b>0/'+sequence.length+'</b><small>lượt</small></span></div><div class="distribution-cycle-info"><b>Vòng '+(index+2)+' · kế tiếp</b><small>Đã lưu, chờ vòng hiện tại hoàn tất</small><button type="button" class="distribution-cycle-detail" data-cycle-detail="'+esc(key)+'">Chi tiết →</button></div></div>';
      }).join('');
      return '<div class="distribution-cycle-stack">'+currentMarkup+queuedMarkup+'</div>';
    };
    const block=(title,sub,html,cycle='')=>'<section class="distribution-tree-block"><div class="distribution-tree-head"><div class="distribution-tree-title"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div>'+(cycle?'<div class="distribution-tree-cycle">'+cycle+'</div>':'')+'</div>'+html+'</section>';
    let blocks=managers.map(manager=>block(manager.name||'Manager', 'MANAGER - '+(manager.teamId||'Quan ly tuyen'), row(manager,'MANAGER',0)+directSales(manager.id).map(sale=>row(sale,'SALE',1)).join('')+byManager(manager.id).map(leader=>row(leader,'LEADER',1)+byLeader(leader.id).map(sale=>row(sale,'SALE',2)).join('')).join(''),'')).join('');
    const unassignedLeaders=leaders.filter(l=>!l.managerId);
    if(unassignedLeaders.length)blocks+=block('Chua gan Manager','Leader chua duoc gan tuyen',unassignedLeaders.map(leader=>row(leader,'LEADER',1)+byLeader(leader.id).map(sale=>row(sale,'SALE',2)).join('')).join(''),'');
    const unassignedSales=sales.filter(sale=>!leaders.some(l=>l.id===sale.leaderId)&&!managers.some(m=>directSales(m.id).some(s=>s.id===sale.id)));
    if(unassignedSales.length)blocks+=block('Chua gan Leader','Sale chua duoc gan Leader',unassignedSales.map(sale=>row(sale,'SALE',2)).join(''));
    if(!q('#referenceDistributionStyles')){const style=document.createElement('style');style.id='referenceDistributionStyles';style.textContent='.distribution-global-cycle{margin:0 0 12px;padding:12px 14px;border:1px solid #bfdbfe;border-radius:10px;background:#f8fbff}.distribution-global-cycle-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}.distribution-global-cycle-title b{font-size:13px;color:#1e3a8a}.distribution-global-cycle-title small{font-size:10.5px;color:#64748b}.distribution-global-cycle .distribution-cycle{min-width:0}.distribution-global-cycle .distribution-cycle-info{flex:1}.distribution-global-cycle .distribution-cycle-info>small{white-space:normal}.distribution-global-cycle .distribution-cycle-ring{width:54px;height:54px;flex-basis:54px}.distribution-tree-list{display:grid;gap:10px}.distribution-tree-block{border:1px solid var(--border-light);border-radius:10px;overflow:hidden;background:var(--bg-surface)}.distribution-tree-head{display:flex;justify-content:space-between;gap:16px;align-items:stretch;padding:12px 16px;background:var(--bg-subtle);border-bottom:1px solid var(--border-light)}.distribution-tree-title{display:grid;align-content:center;gap:4px;min-width:180px}.distribution-tree-cycle{min-width:280px;max-width:52%;padding-left:14px;border-left:1px solid var(--border-light)}.distribution-cycle-stack{display:grid;gap:8px;max-height:180px;overflow:auto}.distribution-cycle-label{color:#475569;font-size:10px;font-weight:800}.distribution-cycle{display:flex;align-items:center;gap:10px;min-width:270px}.distribution-cycle-ring{--cycle-progress:0%;width:58px;height:58px;flex:0 0 58px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#2563eb var(--cycle-progress),#dbeafe 0);position:relative}.distribution-cycle-ring:after{content:"";position:absolute;inset:6px;border-radius:50%;background:var(--bg-subtle)}.distribution-cycle-ring span{position:relative;z-index:1;display:grid;text-align:center;line-height:1.05}.distribution-cycle-ring b{font-size:12px;color:#1d4ed8}.distribution-cycle-ring small{font-size:9px;color:var(--text-muted)}.distribution-cycle-info{display:grid;gap:2px;min-width:0}.distribution-cycle-info>b{font-size:11px;color:#1e293b}.distribution-cycle-info>small{font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.distribution-cycle-detail{width:max-content;border:0;background:transparent;color:#2563eb;padding:0;font:inherit;font-size:10.5px;font-weight:800;cursor:pointer}.distribution-cycle-detail:hover{text-decoration:underline}.distribution-cycle-top,.distribution-cycle-track{display:none}.distribution-cycle small{display:block}.distribution-cycle.is-empty small{white-space:normal}.distribution-cycle-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}.distribution-cycle-columns section{border:1px solid var(--border-light);border-radius:10px;overflow:hidden;background:var(--bg-subtle)}.distribution-cycle-columns h4{display:flex;justify-content:space-between;gap:8px;padding:12px 14px;font-size:12px;color:var(--text-main);border-bottom:1px solid var(--border-light)}.distribution-cycle-columns h4 span{color:#2563eb}.distribution-cycle-list{list-style:none;display:grid;gap:0;margin:0;padding:0}.distribution-cycle-list li{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-surface);border-bottom:1px solid var(--border-light)}.distribution-cycle-list li:last-child{border-bottom:0}.distribution-cycle-position{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:#eff6ff;color:#2563eb;font-size:10px;font-weight:800;flex:0 0 auto}.distribution-cycle-list li>div{display:grid;gap:2px;min-width:0;flex:1}.distribution-cycle-list li b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.distribution-cycle-list li small{font-size:10px;color:var(--text-muted)}.distribution-cycle-status{font-size:10px;font-weight:800;color:#2563eb;white-space:nowrap}.distribution-cycle-status.is-done{color:#15803d}.distribution-cycle-empty,.distribution-cycle-note{margin:0;padding:14px;color:var(--text-muted);font-size:12px}.distribution-cycle-note{padding:0 0 14px}.distribution-tree-head b{font-size:14px}.distribution-tree-head small{color:var(--text-muted);font-size:11px}.distribution-tree-head b{font-size:14px}.distribution-tree-head small{color:var(--text-muted);font-size:11px}.distribution-person-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 16px;border-bottom:1px solid var(--border-light);flex-wrap:wrap}.distribution-person-row:last-child{border-bottom:0}.distribution-person-row.level-1{padding-left:30px}.distribution-person-row.level-2{padding-left:58px;background:#fcfdff}.distribution-person-main{display:flex;align-items:center;gap:10px;min-width:230px}.distribution-person-main>span:last-child{display:grid;gap:3px}.distribution-person-main small{color:var(--text-muted);font-size:10.5px}.distribution-avatar{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;background:#eff6ff;color:#2563eb;font-size:11px;font-weight:800;flex:0 0 auto}.distribution-person-controls{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.distribution-person-controls label{display:flex;align-items:center;gap:7px;color:var(--text-muted);font-size:11.5px}.distribution-person-controls input[type=number]{width:64px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-subtle);font:inherit;text-align:center;color:var(--text-main)}.distribution-check{color:var(--text-main)!important;font-weight:600;cursor:pointer}.distribution-check input{accent-color:#2563eb}.distribution-readonly{font-size:11px;color:var(--text-muted);font-style:italic}@media(max-width:700px){.distribution-tree-head{display:grid}.distribution-tree-cycle{max-width:none;min-width:0;padding:10px 0 0;border-left:0;border-top:1px solid var(--border-light)}.distribution-cycle{min-width:0}.distribution-cycle-columns{grid-template-columns:1fr}.distribution-cycle-info>small{max-width:180px}.distribution-person-row.level-1,.distribution-person-row.level-2{padding-left:16px}.distribution-person-controls{width:100%;padding-left:44px;justify-content:flex-start}}';document.head.appendChild(style)}
    host.innerHTML='<section class="panel" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:22px;box-shadow:var(--shadow-sm)"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px;flex-wrap:wrap"><b style="font-size:15px;color:var(--text-main);display:block">Chỉnh sửa tỷ trọng</b><span class="chip">'+members.length+' nhân sự</span></div><div class="distribution-global-cycle"><div class="distribution-global-cycle-title"><b>Vòng phân data toàn hệ thống</b></div>'+globalCycle()+'</div><div class="distribution-tree-list">'+(blocks||'<div class="empty"><b>Chưa có Manager, Leader hoặc Sale</b><span>Hãy phân bổ nhân sự tại mục Đội ngũ.</span></div>')+'</div></section>';
    if(!q('#referenceDistributionRoundStyles')){const style=document.createElement('style');style.id='referenceDistributionRoundStyles';style.textContent='.distribution-cycle-stack{display:grid;gap:10px;max-height:none;overflow:visible}.distribution-cycle-next{padding-top:8px;border-top:1px solid #dbeafe}';document.head.appendChild(style);}
    const globalRounds=data.saleDistributionByLeader?.['$']?.rounds||[];
    const roundFooter=document.createElement('div');
    roundFooter.className='distribution-round-footer';
    roundFooter.style.cssText='margin-top:18px;padding-top:16px;border-top:1px solid var(--border-light);display:grid;gap:12px';
    const queued=globalRounds.slice(1);
    roundFooter.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b style="font-size:13px;color:var(--text-main)">Vòng tỷ trọng đã lưu</b><small style="display:block;margin-top:4px;color:var(--text-muted)">Vòng mới chỉ bắt đầu sau khi vòng hiện tại chạy hết.</small></div><button type="button" class="btn-action btn-primary" data-save-distribution-round>Lưu tỷ trọng · tạo vòng mới</button></div><div data-distribution-round-list style="display:grid;gap:7px"></div>';
    const roundList=roundFooter.querySelector('[data-distribution-round-list]');
    if(roundList){
      const currentLabel='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:800"><span>Vòng 1 · đang chạy</span><span>'+((globalRounds[0]?.id||'ROUND-1'))+'</span></div>';
      roundList.innerHTML=currentLabel+queued.map((round,index)=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid var(--border-light);border-radius:8px;background:var(--bg-subtle);font-size:11px"><span><b>Vòng '+(index+2)+'</b><small style="display:block;margin-top:3px;color:var(--text-muted)">Sẽ thành Vòng 1 sau khi vòng trước hoàn tất</small></span><button type="button" class="btn-action btn-secondary" data-delete-distribution-round="'+esc(round.id)+'">Xóa</button></div>').join('');
    }
    host.firstElementChild?.appendChild(roundFooter);
    host.querySelectorAll('[data-cycle-detail]').forEach(button=>button.onclick=()=>showCycleDetails(button.dataset.cycleDetail,button));
    host.querySelectorAll('[data-ref-distribution-weight]').forEach(input=>input.onchange=()=>{});
    host.querySelectorAll('[data-ref-distribution-member]').forEach(input=>input.onchange=()=>{});
    roundFooter.querySelector('[data-save-distribution-round]')?.addEventListener('click',()=>{
      const weights={},enabledIds=[];
      host.querySelectorAll('[data-ref-distribution-weight]').forEach(input=>{const [,id]=input.dataset.refDistributionWeight.split(':');weights[id]=input.value;});
      host.querySelectorAll('[data-ref-distribution-member]:checked').forEach(input=>{const [,id]=input.dataset.refDistributionMember.split(':');enabledIds.push(id);});
      run(()=>api.distributionRoundSave({weights,enabledIds}),()=>referenceNotice('Đã lưu tỷ trọng và tạo vòng mới.'));
    });
    roundFooter.querySelectorAll('[data-delete-distribution-round]').forEach(button=>button.onclick=()=>run(()=>api.distributionRoundDelete(button.dataset.deleteDistributionRound),()=>referenceNotice('Đã xóa vòng chờ.')));
  }
  function mountManagementDataShell(role){
    const tab=q('#tab-data');
    if(!tab)return;
    const management=['ADMIN','MANAGER','LEADER'].includes(role);
    let header=q('#dataManagementHeader');
    if(!management){header?.setAttribute('hidden','');return;}
    if(!q('#dataManagementShellStyles')){
      const style=document.createElement('style');style.id='dataManagementShellStyles';style.textContent='#tab-data.data-scope-management>.headline-row,#tab-data.data-scope-management>.sub-tabs-bar{display:none!important}#tab-data.data-scope-management .data-management-header{display:grid;gap:16px;margin:0 0 18px;padding:2px 0 0}#tab-data.data-scope-management .data-management-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}#tab-data.data-scope-management .data-management-title h1{margin:0;color:#0f172a;font-size:23px;line-height:1.2}#tab-data.data-scope-management .data-management-title p{margin:6px 0 0;color:#64748b;font-size:12px}#tab-data.data-scope-management .data-management-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#tab-data.data-scope-management .data-management-count,#tab-data.data-scope-management .data-management-date-state{padding:8px 10px;border:1px solid #dbe3ec;border-radius:7px;background:#fff;color:#475569;font-size:11px;font-weight:800;white-space:nowrap}#tab-data.data-scope-management .data-management-date-state.is-applied{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}#tab-data.data-scope-management .data-management-filter-button{min-height:36px;padding:8px 12px;border:1px solid #2563eb;border-radius:7px;background:#2563eb;color:#fff;font:800 12px var(--font-sans,Arial,sans-serif);cursor:pointer}#tab-data.data-scope-management .data-management-filter-button:hover{background:#1d4ed8}#tab-data.data-scope-management .data-management-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}#tab-data.data-scope-management .data-management-stat{padding:12px 14px;border:1px solid #dbe3ec;border-radius:8px;background:#fff;display:grid;gap:4px}#tab-data.data-scope-management .data-management-stat span{color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase}#tab-data.data-scope-management .data-management-stat b{color:#0f172a;font-size:20px;line-height:1;font-variant-numeric:tabular-nums}#tab-data.data-scope-management .data-management-stat.waiting b{color:#b45309}#tab-data.data-scope-management .data-management-stat.accepted b{color:#15803d}#tab-data.data-scope-management .data-management-stat.unassigned b{color:#64748b}#tab-data.data-scope-management #dataSubViewQueue{display:block!important;width:100%!important;min-width:0!important}#tab-data.data-scope-management #dataSubViewQueue>:not(.table-container):not(#dataDateFilterPanel){display:none!important}#tab-data.data-scope-management #dataDateFilterPanel{display:none!important;position:fixed;z-index:10050;top:88px;right:28px;width:min(440px,calc(100vw - 28px));max-height:calc(100dvh - 112px);overflow:auto}#tab-data.data-scope-management #dataDateFilterPanel.is-open{display:block!important}@media(max-width:860px){#tab-data.data-scope-management .data-management-top{align-items:flex-start;flex-direction:column}#tab-data.data-scope-management .data-management-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#tab-data.data-scope-management #dataDateFilterPanel{top:70px;right:14px;width:calc(100vw - 28px)}}';document.head.appendChild(style);
    }
    if(!q('#dataManagementStatsStyles')){
      const style=document.createElement('style');style.id='dataManagementStatsStyles';style.textContent='#tab-data.data-scope-management .data-management-header{display:block!important;margin-bottom:18px!important}#tab-data.data-scope-management .data-management-top{display:block!important}#tab-data.data-scope-management .data-management-actions,#tab-data.data-scope-management .data-management-stats{display:none!important}#tab-data.data-scope-management #dataSubViewQueue{display:grid!important;grid-template-columns:minmax(0,1fr) 360px!important;gap:18px!important;align-items:start!important}#tab-data.data-scope-management #dataSubViewQueue>.table-container{grid-column:1;grid-row:1;min-width:0}#tab-data.data-scope-management #dataSubViewQueue>:not(.table-container):not(#dataDateFilterPanel):not(#dataManagementStatsPanel){display:none!important}#tab-data.data-scope-management #dataManagementStatsPanel{display:block!important;visibility:visible!important;grid-column:2;grid-row:1;align-self:start;border:1px solid #dbe3ec;border-radius:16px;background:#fff;padding:20px;box-shadow:0 10px 24px rgba(15,23,42,.05)}#tab-data.data-scope-management .data-period-title{margin:0 0 12px;color:#0f172a;font-size:14px;font-weight:800}#tab-data.data-scope-management .data-period-list{display:grid;gap:12px}#tab-data.data-scope-management .data-period-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:0 16px;border-left:3px solid #2563eb;border-radius:10px;background:#f1f5f9;color:#0f172a;font-size:12px;font-weight:800}#tab-data.data-scope-management .data-period-row b{font:800 17px var(--font-mono,monospace);color:#2563eb;white-space:nowrap}#tab-data.data-scope-management .data-period-row.days3{border-left-color:#059669}.data-period-row.days3 b{color:#059669!important}#tab-data.data-scope-management .data-period-row.days7{border-left-color:#7c3aed}.data-period-row.days7 b{color:#7c3aed!important}#tab-data.data-scope-management .data-period-row.days30{border-left-color:#ea580c}.data-period-row.days30 b{color:#ea580c!important}#tab-data.data-scope-management .data-date-trigger{display:none!important}#tab-data.data-scope-management #dataDateFilterPanel{display:block!important;position:static!important;z-index:auto!important;width:100%!important;max-height:none!important;margin-top:16px;transform:none!important;overflow:hidden!important;box-shadow:0 10px 24px rgba(15,23,42,.08)!important}#tab-data.data-scope-management #dataDateFilterPanel.is-collapsed{display:block!important}#dataDateFilterBackdrop{display:none!important}#dataDateFilterBackdrop[hidden]{display:none!important}@media(max-width:1120px){#tab-data.data-scope-management #dataSubViewQueue{grid-template-columns:1fr!important}#tab-data.data-scope-management #dataManagementStatsPanel{grid-column:1;grid-row:2;max-width:none}}';document.head.appendChild(style);
    }
    if(!q('#dataManagementTargetLayout')){
      const style=document.createElement('style');style.id='dataManagementTargetLayout';style.textContent='#tab-data.data-scope-management>.headline-row,#tab-data.data-scope-management>.sub-tabs-bar{display:block!important}#tab-data.data-scope-management>.headline-row{margin-bottom:14px!important}#tab-data.data-scope-management #dataManagementHeader{display:none!important}#tab-data.data-scope-management #dataManagementOverview{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}#tab-data.data-scope-management .data-overview-card{min-height:76px;padding:12px 14px;border:1px solid #dbe3ec;border-radius:9px;background:#fff;display:grid;align-content:center;gap:6px;box-shadow:0 2px 8px rgba(15,23,42,.035)}#tab-data.data-scope-management .data-overview-card span{color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase}#tab-data.data-scope-management .data-overview-card b{color:#0f172a;font-size:21px;line-height:1;font-variant-numeric:tabular-nums}#tab-data.data-scope-management .data-overview-card.pending b{color:#b45309}#tab-data.data-scope-management .data-overview-card.accepted b{color:#15803d}#tab-data.data-scope-management .data-overview-card.unassigned b{color:#64748b}#tab-data.data-scope-management #dataManagementDateTrigger{display:block;width:100%;margin-top:12px}#tab-data.data-scope-management #dataQueueFilters #dataManagementDateTrigger{display:none!important}@media(max-width:760px){#tab-data.data-scope-management #dataManagementOverview{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(style);
    }
    if(!q('#dataManagementOverviewStyles')){
      const style=document.createElement('style');style.id='dataManagementOverviewStyles';style.textContent='#tab-data.data-scope-management #dataManagementOverview{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 18px}#tab-data.data-scope-management .data-overview-card{position:relative;isolation:isolate;min-height:104px;padding:17px 18px 15px;border:1px solid #dbe3ec;border-radius:14px;background:linear-gradient(135deg,#fff 0%,#f8fbff 100%);display:grid;grid-template-columns:38px minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:12px;align-items:center;overflow:hidden;box-shadow:0 5px 16px rgba(15,23,42,.055);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}#tab-data.data-scope-management .data-overview-card:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:#2563eb;z-index:-1}#tab-data.data-scope-management .data-overview-card:after{content:"";position:absolute;width:92px;height:92px;right:-36px;bottom:-42px;border-radius:50%;background:rgba(37,99,235,.08);z-index:-1}#tab-data.data-scope-management .data-overview-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(15,23,42,.1);border-color:#c7d5e5}#tab-data.data-scope-management .data-overview-icon{grid-row:1 / span 2;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:900;letter-spacing:.04em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)}#tab-data.data-scope-management .data-overview-card span:not(.data-overview-icon){align-self:end;color:#64748b;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}#tab-data.data-scope-management .data-overview-card b{align-self:start;margin-top:5px;color:#0f172a;font-size:27px;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}#tab-data.data-scope-management .data-overview-card.total:before{background:#2563eb}#tab-data.data-scope-management .data-overview-card.pending:before{background:#f59e0b}#tab-data.data-scope-management .data-overview-card.accepted:before{background:#10b981}#tab-data.data-scope-management .data-overview-card.unassigned:before{background:#8b5cf6}#tab-data.data-scope-management .data-overview-card.pending{background:linear-gradient(135deg,#fff 0%,#fffaf0 100%)}#tab-data.data-scope-management .data-overview-card.pending .data-overview-icon{background:#fef3c7;color:#b45309}#tab-data.data-scope-management .data-overview-card.pending b{color:#b45309}#tab-data.data-scope-management .data-overview-card.accepted{background:linear-gradient(135deg,#fff 0%,#f2fcf7 100%)}#tab-data.data-scope-management .data-overview-card.accepted .data-overview-icon{background:#d1fae5;color:#047857}#tab-data.data-scope-management .data-overview-card.accepted b{color:#047857}#tab-data.data-scope-management .data-overview-card.unassigned{background:linear-gradient(135deg,#fff 0%,#faf7ff 100%)}#tab-data.data-scope-management .data-overview-card.unassigned .data-overview-icon{background:#ede9fe;color:#6d28d9}#tab-data.data-scope-management .data-overview-card.unassigned b{color:#6d28d9}@media(max-width:900px){#tab-data.data-scope-management #dataManagementOverview{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){#tab-data.data-scope-management #dataManagementOverview{gap:10px}.data-overview-card{min-height:92px!important;padding:13px!important;grid-template-columns:32px minmax(0,1fr)!important;column-gap:9px!important}.data-overview-icon{width:32px!important;height:32px!important;border-radius:10px!important}.data-overview-card b{font-size:22px!important}}';document.head.appendChild(style);
    }
    if(!q('#dataManagementOverviewNoCircleStyles')){
      const style=document.createElement('style');style.id='dataManagementOverviewNoCircleStyles';style.textContent='#tab-data.data-scope-management .data-overview-card:after{display:none!important;content:none!important}';document.head.appendChild(style);
    }
    if(!header){
      header=document.createElement('div');header.id='dataManagementHeader';header.className='data-management-header';
      header.innerHTML='<div class="data-management-top"><div class="data-management-title"><h1>Data khách hàng</h1><p>Theo dõi nguồn data và phân công người phụ trách.</p></div></div>';
      tab.insertBefore(header,tab.firstChild);
    }
    const queue=q('#dataSubViewQueue');let stats=q('#dataManagementStatsPanel');
    let overview=q('#dataManagementOverview');
    if(queue&&!overview){overview=document.createElement('div');overview.id='dataManagementOverview';overview.innerHTML='<div class="data-overview-card total"><span class="data-overview-icon" aria-hidden="true">ALL</span><span>Tổng data</span><b id="dataOverviewTotal">0</b></div><div class="data-overview-card pending"><span class="data-overview-icon" aria-hidden="true">NEW</span><span>Data chưa phân</span><b id="dataOverviewUnassigned">0</b></div><div class="data-overview-card accepted"><span class="data-overview-icon" aria-hidden="true">OK</span><span>Sale đã nhận</span><b id="dataOverviewAccepted">0</b></div><div class="data-overview-card unassigned"><span class="data-overview-icon" aria-hidden="true">WAIT</span><span>Chờ Sale nhận</span><b id="dataOverviewWaiting">0</b></div>';const sub=tab.querySelector('.sub-tabs-bar');(sub||tab.firstElementChild)?.after(overview);}
    if(queue&&!stats){stats=document.createElement('aside');stats.id='dataManagementStatsPanel';stats.innerHTML='<div class="data-period-title">Thống kê data mới</div><div class="data-period-list"><div class="data-period-row"><span>Hôm nay</span><b id="dataPeriodToday">0 data</b></div><div class="data-period-row days3"><span>3 ngày gần nhất</span><b id="dataPeriod3Days">0 data</b></div><div class="data-period-row days7"><span>7 ngày gần nhất</span><b id="dataPeriod7Days">0 data</b></div><div class="data-period-row days30"><span>30 ngày gần nhất</span><b id="dataPeriod30Days">0 data</b></div></div>';queue.append(stats);}
    if(stats){stats.style.setProperty('display','block','important');stats.style.setProperty('visibility','visible','important');}
    const datePanel=q('#dataDateFilterPanel');
    if(stats&&datePanel&&datePanel.parentElement!==stats)stats.append(datePanel);
    q('#dataManagementDateTrigger')?.remove();
    header.removeAttribute('hidden');
  }
  function applySaleDataLayout(){
    const role=data?.user?.actualRole||data?.user?.role, tab=q('#tab-data');
    if(!tab)return;
    if(!q('#referenceScopedDataStyles')){const style=document.createElement('style');style.id='referenceScopedDataStyles';style.textContent=`
      /* Gi? b?ng data v? b? l?c, ch? ?n nh?n h?ng ??i c? ?? giao di?n g?n h?n. */
      #tab-data.data-scope-limited #dataTabQueueBtn,#tab-data.data-scope-limited #dataSubViewQueue>.table-container>.table-head-bar{display:none!important}
      #tab-data.data-scope-limited #dataSubViewQueue{display:block!important}
      #tab-data.data-scope-limited #dataSubViewQueue>.table-container{width:100%;border-radius:10px}
      #tab-data.data-scope-limited #dataSubViewQueue>.table-container>.table-head-bar{padding:13px 16px}
      #tab-data.data-scope-limited .data-queue-filterbar{padding:10px 16px!important;background:var(--bg-surface)}
      #tab-data.data-scope-limited .data-queue-filterbar input,#tab-data.data-scope-limited .data-queue-filterbar select{min-height:34px;padding:7px 10px!important;border-radius:7px!important}
      #tab-data.data-scope-limited #dataQueueSourceFilter{display:none!important}
      #tab-data.data-scope-limited #dataQueueTableBody td{padding:11px 14px}
      #tab-data.data-scope-limited #dataQueueTableBody td:nth-child(2),#tab-data.data-scope-limited #dataQueueTableBody td:nth-child(3){white-space:nowrap}
      #tab-data.data-scope-limited #dataQueueTableBody td small{display:block;margin-top:3px;color:var(--text-muted);font-size:10.5px}
      #tab-data.data-scope-limited .quick-sale-select{min-width:150px;max-width:190px;padding:7px 10px;border:1.5px solid #e58a00;border-radius:8px;background:#fff;color:var(--text-main);font:inherit;font-size:12px;font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.04)}#tab-data.data-scope-limited .quick-sale-select:focus{border-color:#c46f00;box-shadow:0 0 0 3px rgba(234,137,0,.14)}#tab-data.data-scope-limited .data-owner-label{display:inline-flex;align-items:center;min-height:30px;padding:6px 10px;border-radius:8px;background:#fff7ed;color:#9a3412;font-weight:700;white-space:nowrap}#tab-data.data-scope-limited .data-type-badge,#tab-data.data-scope-limited .data-status-badge{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:5px 9px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap}#tab-data.data-scope-limited .data-type-badge:before,#tab-data.data-scope-limited .data-status-badge:before{content:\"\";width:5px;height:5px;border-radius:50%;background:currentColor}#tab-data.data-scope-limited .data-type-new{background:#fef3c7;color:#d97706}#tab-data.data-scope-limited .data-type-return{background:#fee2e2;color:#dc2626}#tab-data.data-scope-limited .data-type-retry{background:#dbeafe;color:#2563eb}#tab-data.data-scope-limited .data-status-waiting{background:#fef3c7;color:#d97706}#tab-data.data-scope-limited .data-status-accepted{background:#dcfce7;color:#15803d}#tab-data.data-scope-limited .data-status-unassigned{background:#f1f5f9;color:#64748b}#tab-data.data-scope-limited .data-status-expired{background:#fee2e2;color:#dc2626}
      @media(max-width:760px){#tab-data.data-scope-limited #dataSubViewQueue>.table-container{overflow:hidden}#tab-data.data-scope-limited .data-queue-filterbar{display:grid!important;grid-template-columns:1fr!important}#tab-data.data-scope-limited .data-queue-filterbar input,#tab-data.data-scope-limited .data-queue-filterbar select{width:100%;box-sizing:border-box}#tab-data.data-scope-limited .table-responsive{overflow-x:auto}#tab-data.data-scope-limited .modern-table{min-width:760px}}
    `;document.head.appendChild(style);}
    tab.classList.toggle('data-scope-limited',role==='SALE');
    tab.classList.toggle('data-scope-admin',['ADMIN','MANAGER','LEADER'].includes(role));
    tab.classList.toggle('data-scope-management',['ADMIN','MANAGER','LEADER'].includes(role));
    mountManagementDataShell(role);
    const filterBar=tab.querySelector('#dataSubViewQueue .table-container>div:nth-child(2)');
    filterBar?.classList.add('data-queue-filterbar');
    // Admin cần giữ lại bộ điều khiển và thống kê phân phối cũ.
    const hideAdminViews=!['ADMIN','MANAGER'].includes(role);
    ['dataTabQueueBtn','dataTabAutoBtn','dataTabSalesBtn'].forEach(id=>{const node=q('#'+id);if(node){node.hidden=hideAdminViews;node.style.setProperty('display',hideAdminViews?'none':'','important');}});
    [['dataSubViewQueue','queue'],['dataSubViewAuto','auto'],['dataSubViewSales','sales']].forEach(([id,key])=>{const node=q('#'+id);if(node){const active=tab.querySelector('.sub-tab-btn.active')?.id==='dataTabAutoBtn'?'auto':tab.querySelector('.sub-tab-btn.active')?.id==='dataTabSalesBtn'?'sales':'queue',visible=hideAdminViews?key==='queue':key===active;node.hidden=!visible;node.style.setProperty('display',visible?(key==='queue'?'grid':'block'):'none','important');}});
    const legacyLeaders=q('#dataSubViewLeaders');if(legacyLeaders){legacyLeaders.hidden=true;legacyLeaders.style.setProperty('display','none','important');}
    const salesLabel=q('#dataTabSalesBtn');if(salesLabel)salesLabel.textContent='Chỉnh sửa tỷ trọng';
    const legacyButton=q('#dataTabLeadersBtn');if(legacyButton){legacyButton.hidden=true;legacyButton.style.setProperty('display','none','important');}
    const autoLabel=q('#dataTabAutoBtn');if(autoLabel)autoLabel.textContent='Chia Data';
    if(['ADMIN','MANAGER'].includes(role))renderDistributionWeights();
    const title=tab.querySelector('.headline-row h1');if(title)title.textContent=role==='SALE'?'Data m\u1edbi h\u00f4m nay':role==='ADMIN'?'Data M\u1edbi':'Data';
    const queueTitle=tab.querySelector('#dataSubViewQueue .table-head-bar b');if(queueTitle)queueTitle.textContent=role==='SALE'?'Data m\u1edbi h\u00f4m nay':role==='ADMIN'?'Data M\u1edbi':'Data ch\u01b0a x\u1eed l\u00fd';
    const queueSubtitle=tab.querySelector('#dataSubViewQueue .table-head-bar b + div');if(queueSubtitle){queueSubtitle.textContent='';queueSubtitle.hidden=true;}
    const statsSubtitle=tab.querySelector('#dataSubViewQueue > div:nth-child(2) .widget-box:first-child b + div');if(statsSubtitle){statsSubtitle.textContent='';statsSubtitle.hidden=true;}
    const selectAll=tab.querySelector('#dataSubViewQueue .table-head-bar button');if(selectAll){selectAll.hidden=role!=='ADMIN';selectAll.style.setProperty('display',role==='ADMIN'?'':'none','important');}
    q('#dataDistributionStatusPanel')?.remove();

    const typeFilter=q('#dataQueueTypeFilter');if(typeFilter)typeFilter.innerHTML=opt('', '\u0054\u1ea5t c\u1ea3 lo\u1ea1i data')+['DATA M\u1edaI','DATA TR\u1ea2 V\u1ec0','DATA \u0110I\u1ec0N L\u1ea0I FORM'].map(value=>opt(value,value,typeFilter.value)).join('');
    if(role!=='SALE'){const sourceFilter=q('#dataQueueSourceFilter'),selected=sourceFilter?.value||'';if(sourceFilter)sourceFilter.innerHTML=opt('','Tất cả nguồn',selected)+(data.websites||[]).map(w=>opt(w.name||w.domain,w.name||w.domain,selected)).join('');}
    if(role!=='ADMIN'&&role!=='SALE'){const sourceFilter=q('#dataQueueSourceFilter');if(sourceFilter){sourceFilter.hidden=true;sourceFilter.setAttribute('aria-hidden','true');}}
    if(role==='SALE'&&q('#dataSubViewQueue')){
      const sourceFilter=q('#dataQueueSourceFilter'),typeFilter=q('#dataQueueTypeFilter');
      if(sourceFilter){sourceFilter.hidden=true;sourceFilter.setAttribute('aria-hidden','true');}
      if(typeFilter){typeFilter.hidden=false;typeFilter.removeAttribute('aria-hidden');}
    }
  }
  function renderManagementDataTable(role){
    const body=q('#dataQueueTableBody'),table=body?.closest('table');
    if(!body||!table||!['ADMIN','MANAGER','LEADER'].includes(role))return;
    const isManualCustomer=customer=>{const source=String(customer?.source||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return customer?.manualEntry===true||source==='khach hang cu'||source==='khach hang ngoai data';};
    const members=data.managerHierarchy?.members||data.members||[],currentId=data.user.id;
    const leaders=role==='ADMIN'?members.filter(m=>m.active!==false&&m.role==='LEADER'):role==='MANAGER'?members.filter(m=>m.active!==false&&m.role==='LEADER'&&m.managerId===currentId):members.filter(m=>m.active!==false&&m.role==='LEADER'&&m.id===currentId);
    const leaderIds=new Set(leaders.map(m=>m.id));
    const sales=role==='ADMIN'?members.filter(m=>m.active!==false&&m.role==='SALE'):members.filter(m=>m.active!==false&&m.role==='SALE'&&(leaderIds.has(m.leaderId)||(role==='MANAGER'&&m.managerId===currentId)));
    const salesIds=new Set(sales.map(m=>m.id));
    const visible=role==='ADMIN'?data.customers.filter(c=>!isManualCustomer(c)):data.customers.filter(c=>!isManualCustomer(c)&&(role==='MANAGER'?(c.ownerId===currentId||c.managerId===currentId||leaderIds.has(c.leaderId)||salesIds.has(c.saleId)):(c.ownerId===currentId||c.leaderId===currentId||salesIds.has(c.saleId))));
    const websiteFor=customer=>(data.websites||[]).find(item=>item.id===customer?.websiteId||item.webhookSlug===customer?.webhookSlug||item.sourceUrl===customer?.source||item.webhookUrlOverride===customer?.source||item.publicWebhookUrl===customer?.source);
    const validUrl=value=>{try{const url=new URL(String(value||'').trim());return ['http:','https:'].includes(url.protocol)?url.toString():'';}catch{return '';}};
    const sourceUrlFor=customer=>{const website=websiteFor(customer);return validUrl(customer?.landingPageUrl)||validUrl(website?.sourceUrl)||validUrl(website?.webhookUrlOverride)||validUrl(website?.publicWebhookUrl);};
    const sourceNameFor=customer=>{const website=websiteFor(customer),name=String(website?.name||customer?.landingPageName||customer?.source||'').trim();return name&&name.toUpperCase()!=='UNATTRIBUTED'&&name.toLowerCase()!=='landing page'?name:'Chưa gắn nguồn';};
    const latestOffer=customer=>(data.offers||[]).filter(item=>item.customerId===customer.id).sort((a,b)=>(a.status==='PENDING'?0:1)-(b.status==='PENDING'?0:1)||String(b.offeredAt||'').localeCompare(String(a.offeredAt||'')))[0];
    const returns=new Map();
    (data.resubmissions||[]).forEach(item=>{
      const previous=returns.get(item.customerId);
      if(!previous||String(item.at||'')>String(previous.at||''))returns.set(item.customerId,item);
    });
    const rows=visible.map(customer=>{
      const offer=latestOffer(customer),returned=returns.get(customer.id),returnAt=String(returned?.at||''),lastIntakeAt=String(customer.lastIntakeAt||''),updatedAt=String(customer.updatedAt||'');
      const isCurrentResubmission=Boolean(returned&&returnAt&&((customer.lastIntakeType==='RESUBMISSION'&&lastIntakeAt===returnAt)||(!customer.lastIntakeType&&updatedAt===returnAt)));
      const type=isCurrentResubmission?'DATA ĐIỀN LẠI FORM':offer?.status==='EXPIRED'&&!customer.saleId?'DATA TRẢ VỀ':'DATA MỚI';
      const at=isCurrentResubmission?returnAt:(type==='DATA TRẢ VỀ'?(offer?.resolvedAt||offer?.offeredAt):customer.createdAt);
      return {customer,offer,type,at:at||customer.createdAt};
    });
    const countSince=days=>{const start=fromDay(days),end=String(data.today||'').slice(0,10);return rows.filter(row=>{const date=String(row.at||'').slice(0,10);return date>=start&&date<=end;}).length;};
    text('dataStatToday',countSince(1)+' data');text('dataStat3Days',countSince(3)+' data');text('dataStat7Days',countSince(7)+' data');text('dataStat30Days',countSince(30)+' data');
    const query=String(q('#dataQueueSearch')?.value||'').trim().toLowerCase(),sourceFilter=role==='ADMIN'?String(q('#dataQueueSourceFilter')?.value||''):'',rawType=String(q('#dataQueueTypeFilter')?.value||'');
    const dateFrom=String(dataQueueDateFrom||'').slice(0,10),dateTo=String(dataQueueDateTo||'').slice(0,10);
    const typeFilter=rawType==='Data mới'?'DATA MỚI':rawType==='Data trả về'?'DATA TRẢ VỀ':rawType==='Điền lại form'||rawType==='Data điền lại form'?'DATA ĐIỀN LẠI FORM':rawType;
    const filtered=rows.filter(row=>{const c=row.customer,name=String(c.name||'').toLowerCase(),phone=String(c.phone||'').toLowerCase(),source=sourceNameFor(c),date=String(row.at||c.createdAt||'').slice(0,10);return(!query||name.includes(query)||phone.includes(query))&&(!sourceFilter||source===sourceFilter)&&(!typeFilter||row.type===typeFilter)&&(!dateFrom&&!dateTo||(dateFrom&&dateTo?date>=dateFrom&&date<=dateTo:date===(dateFrom||dateTo)));}).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))||String(a.customer.id).localeCompare(String(b.customer.id)));
    const recipients=(role==='ADMIN'?members.filter(m=>m.active!==false&&['MANAGER','LEADER','SALE'].includes(m.role)):role==='MANAGER'?[{...data.user,role:'MANAGER',actualRole:'MANAGER'},...leaders,...sales]:[{...data.user,role:'LEADER'},...sales]).filter((member,index,list)=>member?.id&&list.findIndex(item=>item.id===member.id)===index).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'vi'));
    filtered.forEach(row=>{const assigned=row.offer?.status==='PENDING'&&row.offer?.saleId?row.offer.saleId:(row.customer.saleId||row.customer.leaderId||row.customer.managerId);if(assigned&&!recipients.some(member=>member.id===assigned)){const member=members.find(item=>item.id===assigned);if(member)recipients.push(member);}});
    if(!q('#referenceManagementDataStyles')){const style=document.createElement('style');style.id='referenceManagementDataStyles';style.textContent='#tab-data.data-scope-management #dataSubViewQueue>.table-container{width:100%;min-width:0;border:1px solid #dbe3ec;border-radius:0;background:#fff;box-shadow:none}#tab-data.data-scope-management #dataSubViewQueue>.table-container>.table-head-bar{display:none!important}#tab-data.data-scope-management #dataQueueFilters{padding:12px 18px;border-bottom:1px solid #e2e8f0;background:#fff}#tab-data.data-scope-management #dataQueueTableBody td{padding:13px 16px;vertical-align:middle;border-bottom:1px solid #e8edf3;color:#0f172a;font-size:12px}#tab-data.data-scope-management #dataQueueTableBody tr:hover{background:#f8fafc}#tab-data.data-scope-management #dataQueueTableBody td small{display:block;margin-top:4px;color:#64748b;font-size:10.5px;line-height:1.25}#tab-data.data-scope-management .data-phone{white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}#tab-data.data-scope-management .data-type-badge{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:800;white-space:nowrap}#tab-data.data-scope-management .data-type-badge:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}#tab-data.data-scope-management .data-type-new{background:#fff0bf;color:#b96900}#tab-data.data-scope-management .data-type-return{background:#fee2e2;color:#c81e1e}#tab-data.data-scope-management .data-type-retry{background:#dbeafe;color:#2563eb}#tab-data.data-scope-management .data-source{max-width:245px;line-height:1.35}#tab-data.data-scope-management .data-source a{display:block;color:#155bd7;font-weight:800;text-decoration:none;overflow-wrap:anywhere}#tab-data.data-scope-management .data-source a:hover{text-decoration:underline}#tab-data.data-scope-management .management-sale-select{display:block;width:205px;max-width:100%;min-height:38px;padding:8px 12px;border:1.5px solid #f08a00;border-radius:10px;background:#fff;color:#111827;font:700 12px var(--font-sans,Arial,sans-serif);outline:0}#tab-data.data-scope-management .management-sale-select:focus{border-color:#d97706;box-shadow:0 0 0 3px rgba(245,158,11,.16)}#tab-data.data-scope-management .management-sale-select:disabled{opacity:.65}#tab-data.data-scope-management .management-data-actions{display:flex;align-items:center;gap:7px;white-space:nowrap}#tab-data.data-scope-management .management-data-actions button{min-height:34px;padding:7px 10px;border:1px solid transparent;border-radius:7px;font:700 11px var(--font-sans,Arial,sans-serif);cursor:pointer}#tab-data.data-scope-management .management-data-actions button:disabled{opacity:.55;cursor:wait}#tab-data.data-scope-management .management-reassign-button{background:#2563eb;border-color:#2563eb;color:#fff}#tab-data.data-scope-management .management-reassign-button:hover{background:#1d4ed8}#tab-data.data-scope-management .management-delete-button{background:#dc2626;border-color:#dc2626;color:#fff}#tab-data.data-scope-management .management-delete-button:hover{background:#b91c1c}#tab-data.data-scope-management .data-status-badge{display:inline-flex;align-items:center;min-height:29px;margin-top:4px;padding:7px 11px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap}#tab-data.data-scope-management .data-status-waiting{background:#fff0bf;color:#9a6700}#tab-data.data-scope-management .data-status-accepted{background:#d9f8e4;color:#168044}#tab-data.data-scope-management .data-status-unassigned{background:#f1f5f9;color:#64748b}#tab-data.data-scope-management .data-status-expired{background:#fee2e2;color:#c81e1e}@media(max-width:860px){#tab-data.data-scope-management #dataSubViewQueue{display:block!important}#tab-data.data-scope-management #dataSubViewQueue>.table-container{overflow:hidden}#tab-data.data-scope-management #dataSubViewQueue>.table-container .table-responsive{overflow-x:auto}#tab-data.data-scope-management #dataSubViewQueue>.table-container .modern-table{min-width:1050px}}';document.head.appendChild(style);}
    const hasSource=role==='ADMIN',head=table.querySelector('thead tr');if(head)head.innerHTML=(hasSource?['THỨ TỰ','NGÀY DATA','KHÁCH HÀNG','SỐ ĐIỆN THOẠI','LOẠI DATA','NGUỒN','SALE PHỤ TRÁCH','THAO TÁC']:['THỨ TỰ','NGÀY DATA','KHÁCH HÀNG','SỐ ĐIỆN THOẠI','LOẠI DATA','SALE PHỤ TRÁCH','THAO TÁC']).map(label=>'<th>'+label+'</th>').join('');
    const typeClass=type=>type==='DATA TRẢ VỀ'?'data-type-return':type==='DATA ĐIỀN LẠI FORM'?'data-type-retry':'data-type-new';
    const statusFor=(customer,offer,type)=>offer?.status==='PENDING'?(type==='DATA TR\u1ea2 V\u1ec0'?'\u0110\u00e3 ph\u00e2n l\u1ea1i \u00b7 ch\u1edd Sale nh\u1eadn':'Ch\u1edd Sale nh\u1eadn'):offer?.status==='EXPIRED'&&!customer.saleId?'Data Sale kh\u00f4ng nh\u1eadn':customer.saleId?'Sale \u0111\u00e3 nh\u1eadn':customer.managerId?'\u0110\u00e3 ph\u00e2n Manager':customer.leaderId?'\u0110\u00e3 ph\u00e2n Leader':'Ch\u01b0a ch\u1ecdn Sale';
    const statusClass=status=>['Sale đã nhận','Đã phân Manager','Đã phân Leader'].includes(status)?'data-status-accepted':status==='Data Sale không nhận'?'data-status-expired':status==='Chưa chọn Sale'?'data-status-unassigned':'data-status-waiting';
    const recipientLabel=member=>member.role==='MANAGER'?' (Manager)':member.role==='LEADER'?' (Leader)':'';
    body.innerHTML=filtered.map((row,index)=>{const c=row.customer,offer=row.offer,assigned=c.saleId||offer?.saleId||c.leaderId||c.managerId||'',status=statusFor(c,offer,row.type),sourceUrl=sourceUrlFor(c),sourceName=sourceNameFor(c),sourceHtml=sourceUrl?'<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(sourceUrl)+'</a>':'<span>Chưa gắn nguồn</span>',options='<option value="">— Chưa chọn —</option>'+recipients.map(member=>'<option value="'+esc(member.id)+'" '+(member.id===assigned?'selected':'')+'>'+esc(member.name||'Chưa đặt tên')+recipientLabel(member)+'</option>').join(''),sourceCell=hasSource?'<td><div class="data-source">'+sourceHtml+'<small>'+esc(sourceName)+'</small></div></td>':'',actionCell='<td><div class="management-data-actions"><button type="button" class="management-reassign-button" data-management-reassign="'+esc(c.id)+'">Phân lại</button>'+(hasSource?'<button type="button" class="management-delete-button" data-management-delete="'+esc(c.id)+'">Xóa</button>':'')+'</div></td>';return '<tr><td><b>#'+(index+1)+'</b></td><td><b>'+esc(fmtDate(String(row.at||c.createdAt||'').slice(0,10)))+'</b><small>'+esc(String(row.at||c.createdAt||'').slice(11,16))+'</small></td><td><b>'+esc(c.name||'—')+'</b></td><td><span class="data-phone">'+esc(c.phone||'—')+'</span></td><td><span class="data-type-badge '+typeClass(row.type)+'">'+esc(row.type)+'</span></td>'+sourceCell+'<td><select class="management-sale-select" data-management-sale="'+esc(c.id)+'" data-previous="'+esc(assigned)+'" aria-label="Chọn người phụ trách cho '+esc(c.name||'khách hàng')+'">'+options+'</select><small class="data-status-badge '+statusClass(status)+'">'+esc(status)+'</small></td>'+actionCell+'</tr>';}).join('')||'<tr><td colspan="'+(hasSource?8:7)+'"><div class="empty"><b>Không có data</b><span>Data mới sẽ xuất hiện ở đây.</span></div></td></tr>';
    body.querySelectorAll('[data-management-sale]').forEach(select=>select.onchange=()=>{if(!select.value)select.value=select.dataset.previous||'';});
    body.querySelectorAll('[data-management-reassign]').forEach(button=>button.onclick=async()=>{const row=button.closest('tr'),select=row?.querySelector('[data-management-sale]'),value=String(select?.value||''),previous=select?.dataset.previous||'',member=recipients.find(item=>item.id===value);if(!value){referenceNotice('Hãy chọn người phụ trách trước khi phân lại.','error');select?.focus();return;}button.disabled=true;if(select)select.disabled=true;const result=await run(()=>api.assign(button.dataset.managementReassign,value));if(result!==null){if(select)select.dataset.previous=value;referenceNotice('Đã phân lại data thành công cho '+(member?.name||'người phụ trách')+'.');}else if(select)select.value=previous;button.disabled=false;if(select)select.disabled=false;});
    body.querySelectorAll('[data-management-delete]').forEach(button=>button.onclick=async()=>{const customer=data.customers.find(item=>item.id===button.dataset.managementDelete),name=customer?.name||'data';if(!await referenceConfirmDelete(name))return;button.disabled=true;const result=await run(()=>api.deleteCustomer(button.dataset.managementDelete));if(result!==null)referenceNotice('Đã xóa data '+name+' thành công.');button.disabled=false;});
    const countPeriod=days=>rows.filter(row=>String(row.at||row.customer.createdAt||'').slice(0,10)>=fromDay(days)).length;
    const waitingCount=rows.filter(row=>row.offer?.status==='PENDING').length;
    const acceptedCount=rows.filter(row=>Boolean(row.customer.saleId)&&row.offer?.status!=='PENDING').length;
    const unassignedCount=rows.filter(row=>!row.offer?.saleId&&!row.customer.saleId&&!row.customer.leaderId&&!row.customer.managerId).length;
    renderDataQueuePagination(table,filtered.length);text('sidebarDataBadge',filtered.length);text('dataTabCountBadge',filtered.length);text('dataPeriodToday',countPeriod(1)+' data');text('dataPeriod3Days',countPeriod(3)+' data');text('dataPeriod7Days',countPeriod(7)+' data');text('dataPeriod30Days',countPeriod(30)+' data');text('dataOverviewTotal',rows.length);text('dataOverviewUnassigned',unassignedCount);text('dataOverviewAccepted',acceptedCount);text('dataOverviewWaiting',waitingCount);
  }

  const localDateValue=date=>{const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');return `${year}-${month}-${day}`;};
  const syncDataDatePresetState=()=>{
    const from=String(q('#dataDateFrom')?.value||'').slice(0,10),to=String(q('#dataDateTo')?.value||'').slice(0,10);
    const now=new Date(),today=localDateValue(now),last7=localDateValue(new Date(now.getTime()-7*86400000)),last30=localDateValue(new Date(now.getTime()-30*86400000)),monthStart=localDateValue(new Date(now.getFullYear(),now.getMonth(),1));
    const activePreset=preset=>preset==='today'&&from===to&&from===today||preset==='7days'&&from===last7&&to===today||preset==='30days'&&from===last30&&to===today||preset==='thisMonth'&&from===monthStart&&to===today;
    qa('[data-date-preset]').forEach(button=>button.classList.toggle('is-active',activePreset(button.dataset.datePreset)));
  };
  const setDataDatePreset=preset=>{
    const now=new Date(),end=localDateValue(now),from=q('#dataDateFrom'),to=q('#dataDateTo');if(!from||!to)return;
    let start=end;
    if(preset==='7days')start=localDateValue(new Date(now.getTime()-7*86400000));
    if(preset==='30days')start=localDateValue(new Date(now.getTime()-30*86400000));
    if(preset==='thisMonth')start=localDateValue(new Date(now.getFullYear(),now.getMonth(),1));
    from.value=start;to.value=end;syncDataDatePresetState();
  };
  const updateDataDateFilterSummary=()=>{
    const summary=q('#dataDateFilterSummary');if(!summary)return;
    const from=String(dataQueueDateFrom||'').slice(0,10),to=String(dataQueueDateTo||'').slice(0,10),applied=Boolean(from||to);
    summary.classList.toggle('is-applied',applied);
    summary.textContent=!applied?'Chưa áp dụng bộ lọc':from&&to?'Đang áp dụng: '+fmtDate(from)+' đến '+fmtDate(to):'Đang áp dụng: '+fmtDate(from||to);
    const headerState=q('#dataManagementDateState');if(headerState){headerState.classList.toggle('is-applied',applied);headerState.textContent=!applied?'Chưa lọc theo ngày':from&&to?fmtDate(from)+' - '+fmtDate(to):fmtDate(from||to);}
  };
  const applyDataDateFilter=()=>{
    const from=String(q('#dataDateFrom')?.value||'').slice(0,10),to=String(q('#dataDateTo')?.value||'').slice(0,10);
    if(from&&to&&from>to){referenceNotice('Ngày bắt đầu không được sau ngày kết thúc.','error');return;}
    dataQueueDateFrom=from;dataQueueDateTo=to;dataQueuePage=1;updateDataDateFilterSummary();filterDataQueueTable();
  };
  const clearDataDateFilter=()=>{
    const from=q('#dataDateFrom'),to=q('#dataDateTo');if(from)from.value='';if(to)to.value='';dataQueueDateFrom='';dataQueueDateTo='';dataQueuePage=1;updateDataDateFilterSummary();filterDataQueueTable();
  };
  qa('[data-date-preset]').forEach(button=>button.addEventListener('click',()=>setDataDatePreset(button.dataset.datePreset)));
  ['#dataDateFrom','#dataDateTo'].forEach(selector=>q(selector)?.addEventListener('input',syncDataDatePresetState));
  q('#dataDateFilterClose')?.addEventListener('click',event=>{
    const panel=q('#dataDateFilterPanel');if(!panel)return;
    if(panel.closest('#tab-data.data-scope-management')){const collapsed=panel.classList.toggle('is-collapsed');event.currentTarget.setAttribute('aria-expanded',String(!collapsed));event.currentTarget.setAttribute('aria-label',collapsed?'Mở bộ lọc':'Thu gọn bộ lọc');return;}
    const collapsed=panel.classList.toggle('is-collapsed');event.currentTarget.setAttribute('aria-expanded',String(!collapsed));event.currentTarget.setAttribute('aria-label',collapsed?'Mở bộ lọc':'Thu gọn bộ lọc');event.currentTarget.textContent=collapsed?'+':'×';
  });
  q('#dataDateApply')?.addEventListener('click',applyDataDateFilter);
  q('#dataDateClear')?.addEventListener('click',clearDataDateFilter);
  syncDataDatePresetState();
  updateDataDateFilterSummary();
  const ordinaryQueue=renderDataQueue;renderDataQueue=function(){
    const role=data?.user?.actualRole||data?.user?.role;
    if(['ADMIN','MANAGER','LEADER'].includes(role)){
      renderManagementDataTable(role);
      return;
    }
    if(role!=='SALE')ordinaryQueue();
    if(role==='SALE'){
      const search=String(q('#dataQueueSearch')?.value||'').trim().toLowerCase();
      // Hi?n th? to?n b? data c?n hi?u l?c ?ang ch? Sale nh?n, kh?ng gi?i h?n theo ng?y l?ch.
      // Badge ??m t?t c? offer n?n b?ng c?ng ph?i d?ng c?ng t?p d? li?u ?? kh?ng b? l?ch s?.
      const items=(data.pendingOffers||[])
        .filter(o=>String(o.name||'').toLowerCase().includes(search))
        .sort((a,b)=>String(a.offeredAt||'').localeCompare(String(b.offeredAt||'')));
      if(!q('#saleDataAcceptStyles')){const style=document.createElement('style');style.id='saleDataAcceptStyles';style.textContent='#tab-data .sale-data-countdown{display:inline-flex;align-items:center;min-height:28px;padding:5px 10px;border-radius:7px;background:#fff7ed;color:#c2410c;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}#tab-data .sale-accept-data{justify-content:center;background:#059669;color:#fff;border:1px solid #059669;box-shadow:0 3px 10px rgba(5,150,105,.2)}#tab-data .sale-accept-data:hover{background:#047857;border-color:#047857;box-shadow:0 5px 14px rgba(5,150,105,.28)}#tab-data .sale-accept-data:disabled{opacity:.6;cursor:wait}';document.head.appendChild(style);}
      const body=q('#dataQueueTableBody');
      body.innerHTML=items.map((o,index)=>{const minutes=Math.max(0,Number(o.minutesLeft)||0),countdown=Math.floor(minutes/60)+' giờ '+(minutes%60)+' phút';return '<tr><td><b>#'+(index+1)+'</b></td><td>'+esc(fmtDate(String(o.offeredAt||'').slice(0,10)))+'</td><td><b>'+esc(o.name)+'</b></td><td><span class="sale-data-countdown">'+esc(countdown)+'</span></td><td><button type="button" class="btn-action sale-accept-data" data-accept-offer="'+esc(o.id)+'">Nhận data</button></td></tr>';}).join('')||'<tr><td colspan="5"><div class="empty"><b>Không có data chờ nhận</b></div></td></tr>';
      body.querySelectorAll('[data-accept-offer]').forEach(button=>button.onclick=async()=>{button.disabled=true;const result=await run(()=>api.acceptOffer(button.dataset.acceptOffer));if(result?.ok){q('#custSearchInput')&&(q('#custSearchInput').value='');q('#topGlobalSearch')&&(q('#topGlobalSearch').value='');switchTab('tab-customers');}});
      // Thong ke data duoc giao khong giam khi Sale bam nhan.
      const assigned=data.assignedDataStats||{today:0,threeDays:0,sevenDays:0};
      text('sidebarDataBadge',(data.pendingOffers||[]).length);
      renderDataQueuePagination(body.closest('table'),items.length);
      text('dataTabCountBadge',items.length);
      text('dataStatToday',assigned.today+' data');
      text('dataStat3Days',assigned.threeDays+' data');
      text('dataStat7Days',assigned.sevenDays+' data');
      text('dataStat30Days',(assigned.thirtyDays??data.customers.filter(c=>c.createdAt?.slice(0,10)>=fromDay(30)).length)+' data');
    }
    bindReferenceDeleteButtons();
  };
  const ordinaryQueueFilter=filterDataQueueTable;filterDataQueueTable=()=>{const role=data?.user?.actualRole||data?.user?.role;return ['ADMIN','MANAGER','LEADER','SALE'].includes(role)?renderDataQueue():ordinaryQueueFilter();};
  const originalTeamPeriod=filterTeamPeriod;filterTeamPeriod=(period,button)=>{originalTeamPeriod(period,button);if(data)team();};
  ['#teamStartDate','#teamEndDate'].forEach(id=>q(id)?.addEventListener('change',()=>team()));
  if(!q('#liveClockDisplay')){const clock=document.createElement('time');clock.id='liveClockDisplay';clock.setAttribute('aria-label','Giờ hiện tại');clock.style.cssText='font:500 11px var(--font-mono);font-variant-numeric:tabular-nums;color:var(--text-muted);white-space:nowrap';q('#themeBtn')?.before(clock);updateLiveClock();}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  // Không để màn hình chờ quay vô hạn khi iframe đăng nhập khởi tạo chậm/lỡ sự kiện load.
  const revealLoginFallback=()=>{
    if(data||!bootScreen)return;
    const runtime=frame.contentWindow;
    if(runtime?.crmRuntimeBooted!==true){bootFallbackTimer=setTimeout(revealLoginFallback,250);return;}
    if(runtime?.crmRuntimeAuthState!=='unauthenticated'){bootFallbackTimer=setTimeout(revealLoginFallback,250);return;}
    bootScreen.setAttribute('hidden','');
    frame.hidden=false;
    frame.style.display='block';
    frame.classList.add('is-login-visible');
  };
  bootFallbackTimer=setTimeout(revealLoginFallback,250);
  refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},5000);frame.addEventListener('load',()=>refresh(true));
})();
