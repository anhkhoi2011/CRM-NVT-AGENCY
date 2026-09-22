'use strict';
// Cầu nối cùng origin: dùng lại nghiệp vụ, phiên đăng nhập và hàng đợi lưu của CRM.
// Frame chỉ hiển thị lúc đăng nhập; tuyệt đối không đưa DOM/CSS runtime vào trang mẫu.
(() => {
  const referenceFonts=[["aptos","Aptos"],["arial","Arial"],["arialBlack","Arial Black"],["bahnschrift","Bahnschrift"],["calibri","Calibri"],["cambria","Cambria"],["candara","Candara"],["century","Century Gothic"],["comic","Comic Sans MS"],["consolas","Consolas"],["constantia","Constantia"],["corbel","Corbel"],["courier","Courier New"],["franklin","Franklin Gothic Medium"],["georgia","Georgia"],["impact","Impact"],["segoe","Segoe UI"],["tahoma","Tahoma"],["times","Times New Roman"],["trebuchet","Trebuchet MS"],["verdana","Verdana"],["beVietnam","Be Vietnam Pro"],["inter","Inter"],["roboto","Roboto"],["openSans","Open Sans"],["montserrat","Montserrat"],["poppins","Poppins"],["lato","Lato"],["nunito","Nunito"],["raleway","Raleway"],["oswald","Oswald"],["ubuntu","Ubuntu"],["rubik","Rubik"],["manrope","Manrope"],["dmSans","DM Sans"],["workSans","Work Sans"],["quicksand","Quicksand"],["notoSans","Noto Sans"],["notoSerif","Noto Serif"],["plex","IBM Plex Sans"],["merriweather","Merriweather"],["playfair","Playfair Display"],["sourceSans","Source Sans 3"],["fira","Fira Sans"],["firaCode","Fira Code"],["barlow","Barlow"],["outfit","Outfit"],["spaceGrotesk","Space Grotesk"],["sora","Sora"],["plusJakarta","Plus Jakarta Sans"],["libreBaskerville","Libre Baskerville"]];
  let lastNotice = '', pendingResult = null;
  const runtimeToast = toast;
  toast = message => { lastNotice = String(message); runtimeToast(message); };
  const requireRole = roles => { if (!currentAccount || !serverStateLoaded || !roles.includes(currentAccount.role)) throw Error('Tài khoản không có quyền thực hiện thao tác này.'); };
  async function persist(action, kind) {
    requireRole(['ADMIN','MANAGER','LEADER','SALE','MARKETING','ACCOUNTING']);
    if (pendingResult) {
      if(pendingResult.kind!==kind) throw Error("Hãy lưu lại thao tác trước đó trước khi chuyển sang thao tác khác.");
      if (!await flushServerPersistence()) throw Error('Chưa lưu được dữ liệu. Giữ trang mở để thử lại.');
      const result=pendingResult.result;pendingResult=null;return result;
    }
    if (!await flushServerPersistence()) throw Error('Máy chủ chưa xác nhận dữ liệu trước đó.');
    const result=await action();pendingResult={kind,result:result || {ok:true}}; saveState();
    if (!await flushServerPersistence()) throw Error('Chưa lưu được dữ liệu. Giữ trang mở để thử lại.');
    pendingResult=null;return result;
  }
  const fieldOptionsValid=value=>value===''||state.customFieldDefinitions.find(f=>f.id==='customerClass')?.options.some(o=>o.value===value);
  // Chỉ mở danh sách nghiệp vụ đã cho phép, không nhận tên hàm tùy ý từ giao diện.
  let workflowActive=false,workflowView=false,workflowPending=false;
  function workflowRoot(){return workflowActive?($('#modalRoot .modal-body')||$('#drawerRoot .drawer-body')||(workflowView?$('#content'):null)):null;}
  async function openWorkflow(kind,id){
    if(!currentAccount||!serverStateLoaded)throw Error('Chưa đăng nhập.');
    if(workflowPending||pendingResult)throw Error('Hoàn tất thao tác đang chờ lưu trước.');
    const roles=currentAccount.role;
    const admin=['import','categories','fields','settings','createTeam','products','distribution','emailTest'];
    if(admin.includes(kind)&&roles!=='ADMIN')throw Error('Chỉ Admin được dùng chức năng này.');
    const allowed=['customer','order','editOrder','newOrder','import','categories','fields','settings','createTeam','password','profile','products','distribution','customers','pool','accept','attendance','revenue','businessReport','accounting','marketing','reports','orders','emailTest','newCustomer'];
    if(!allowed.includes(kind))throw Error('Chức năng không hợp lệ.');
    if(['profile','customers','pool','accept','attendance','revenue','businessReport','accounting','marketing','orders'].includes(kind)&&!allowedViews().includes(kind)&&!(kind==='pool'&&roles==='ADMIN'))throw Error('Không có quyền truy cập.');
    if(['newCustomer','newOrder','editOrder'].includes(kind))requireRole(['ADMIN','LEADER','SALE']);
    if(kind==='reports'&&!['ADMIN','LEADER'].includes(roles))throw Error('Không có quyền báo cáo.');
    if(kind==='customer'&&roles==='SALE'&&!customerById(id)?.saleAcceptedAt)throw Error('Phải nhận data trước khi xem thông tin khách.');
    closeModal();closeDrawer();workflowActive=true;workflowView=false;lastNotice='';
    const actions={customer:()=>openCustomerDrawer(id),order:()=>openOrderDrawer(id),editOrder:()=>editOrderModal(id),newOrder:()=>newOrderModal(id||''),import:customerImportModal,categories:productCategoriesModal,fields:customFieldsModal,createTeam:createTeamModal,password:changePasswordModal,newCustomer:newCustomerModal,emailTest:()=>{openModal('Gửi email kiểm tra','<form id="workflowEmailForm"><label class="form-field">Email nhận thử<input id="emailTestRecipient" type="email" required></label><div class="modal-actions"><button class="button button-primary" type="submit">Gửi kiểm tra</button></div></form>');$('#workflowEmailForm').onsubmit=async e=>{e.preventDefault();await sendTestEmail();};}};
    if(actions[kind])actions[kind]();else{workflowView=true;if(kind==='reports'){VIEW_RENDERERS.reports=reportsView;currentView='reports';render();}else{currentView=kind;render();}}
    if(!workflowRoot())throw Error(lastNotice||'Không mở được chức năng.');
    return {title:$('#modalTitle')?.textContent||$('#drawerRoot h2')?.textContent||$('#content h1')?.textContent||'Chi tiết',notice:lastNotice};
  }
  async function workflowEvent(node,type){
    if(workflowPending){if(!await flushServerPersistence())throw Error('Chưa lưu được. Giữ form và thử lại.');workflowPending=false;return {notice:'Đã lưu dữ liệu.'};}
    const root=workflowRoot();if(!root||!root.contains(node))throw Error('Form đã thay đổi; mở lại để tiếp tục.');
    lastNotice='';
    if(type==='submit'){
      if(!node.checkValidity())throw Error('Kiểm tra các trường bắt buộc trong form.');
      if(node.onsubmit)await node.onsubmit({preventDefault(){},target:node,currentTarget:node});else node.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    }else if(type==='click'){
      // Các nút drawer gắn listener không trả Promise: gọi nghiệp vụ tương ứng để chờ lưu.
      if(node.dataset.editNote)editCustomerNote(node.dataset.editNote);
      else if(node.dataset.deleteNote)deleteCustomerNote(node.dataset.deleteNote);






      else if(node.dataset.markPaid)await changeOrderStatus(node.dataset.markPaid,'PAID');
      else if(node.dataset.markDeposit)await changeOrderStatus(node.dataset.markDeposit,'DEPOSIT');
      else if(node.dataset.refundOrder)refundOrderModal(node.dataset.refundOrder);
      else if(node.dataset.grantCourse)await changeOrderStatus(node.dataset.grantCourse,'COURSE_GRANTED');
      else if(node.onclick)await node.onclick({preventDefault(){},stopPropagation(){},target:node,currentTarget:node});else node.click();
    }else{node.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));if(type==='change'&&node.type==='file')await new Promise(resolve=>setTimeout(resolve,900));}
    if(type!=='input'&&(hasServerChanges()||serverPendingRequest||serverSaveRunning)){
      workflowPending=true;if(!await flushServerPersistence())throw Error('Máy chủ chưa xác nhận. Bấm lại để thử lưu, không tạo bản sao.');workflowPending=false;
    }
    return {notice:lastNotice};
  }
  window.crmApi = {
    openWorkflow,workflowRoot,workflowEvent,
    exportData(kind,start,end){requireRole(['ADMIN','LEADER','MARKETING','ACCOUNTING']);const methods={customers:exportCustomers,orders:exportOrders,revenue:exportRevenue,marketing:exportMarketing,team:exportTeam,reports:exportFullReport};if(!methods[kind])throw Error('Loại xuất không hợp lệ.');if(start&&end){customDateStart=start;customDateEnd=end;datePreset='CUSTOM';}methods[kind]();},
    async attendanceSettings(input){requireRole(['ADMIN']);return persist(()=>{const time=cleanClockTime(input.deadline,'');if(!time)throw Error('Giờ vào làm không hợp lệ.');state.settings.attendanceIp=String(input.ip||'').slice(0,200);state.settings.attendanceDeadline=time;state.settings.acceptTimeoutHours=24;return {ok:true};},'attendance-settings');},
    async checkIn(){requireRole(['ADMIN','MANAGER','LEADER','SALE']);return persist(()=>{checkInToday();return {ok:true};},'check-in');},
    async saveBrokerageMetric(metric){
      requireRole(['ADMIN']);
      return persist(()=>{
        const member=state.members.find(item=>item.id===metric.memberId&&item.role==='SALE'&&item.active!==false);
        if(!member)throw Error('Sale không còn hoạt động.');
        const period=String(metric.period||'');if(!/^\d{4}-\d{2}$/.test(period))throw Error('Kỳ báo cáo không hợp lệ.');
        const numberValue=(value,max=1e12)=>{const result=Number(value);if(!Number.isFinite(result)||result<0||result>max)throw Error('Dữ liệu lot hoặc tỷ lệ không hợp lệ.');return result;};
        const id='BRK-'+period+'-'+member.id;
        const next={id,memberId:member.id,leaderId:member.leaderId,teamId:member.teamId,period,basicLots:numberValue(metric.basicLots),microLots:numberValue(metric.microLots),nanoLots:numberValue(metric.nanoLots),lotCommissionRate:numberValue(metric.lotCommissionRate),indicatorCommissionRate:numberValue(metric.indicatorCommissionRate,1),courseCommissionRate:numberValue(metric.courseCommissionRate,1),bonus:numberValue(metric.bonus),vatRate:numberValue(metric.vatRate,1),updatedAt:stamp()};
        if(next.vatRate>1)throw Error('Thuế suất không hợp lệ.');
        const index=state.brokerageMetrics.findIndex(item=>item.id===id);if(index>=0)state.brokerageMetrics[index]=next;else state.brokerageMetrics.unshift(next);
        audit('SAVE_BROKERAGE_METRIC',id,member.name+' · '+period);return {ok:true};
      },'brokerage-metric');
    },

    async closeWorkflow(force=false){
      if(!force&&workflowPending&&!await flushServerPersistence())throw Error("Dữ liệu chưa được lưu; giữ form để thử lại.");
      // Cho phép đóng giao diện khi mạng/MySQL tạm thời lỗi; request nháp vẫn
      // được giữ trong hàng đợi để vòng đồng bộ nền tiếp tục thử lại.
      workflowPending=false;workflowActive=false;workflowView=false;closeModal();closeDrawer();
    },
    async selectManagerTeam(leaderId){
      if(currentAccount?.actualRole!=='MANAGER')throw Error('Chỉ Manager được chọn hệ thống quản lý.');
      if(!state.members.some(m=>m.id===leaderId&&m.role==='LEADER'&&m.active!==false&&m.managerId===currentAccount.id))throw Error('Team chưa được Admin giao.');
      if(!await flushServerPersistence())throw Error('Hoàn tất lưu trước khi đổi Team.');
      managerTeamSelection=leaderId;currentAccount=hydrateSessionAccount({...currentAccount,role:'MANAGER'});closeModal();closeDrawer();return {ok:true};
    },
    snapshot() {
      if (!currentAccount || !serverStateLoaded) return null;
      if(currentAccount.actualRole==='MANAGER')currentAccount=hydrateSessionAccount(currentAccount);
      // Manager xem toan bo cac nhanh Leader duoc Admin giao; Sale chi nhan snapshot day du sau khi da bam nhan data.
      const managerLeaderIds=currentAccount.actualRole==='MANAGER'
        ? new Set(state.members.filter(m=>m.role==='LEADER'&&m.active!==false&&m.managerId===currentAccount.id).map(m=>m.id))
        : null;
      const customers=currentAccount.actualRole==='MANAGER'
        ? state.customers.filter(c=>c.managerId===currentAccount.id||c.ownerId===currentAccount.id||managerLeaderIds.has(c.leaderId)||state.members.some(m=>m.role==='SALE'&&m.managerId===currentAccount.id&&m.id===c.saleId))
        : scopedCustomers().filter(c=>currentAccount.role!=='SALE'||!!c.saleAcceptedAt);
      const managerHierarchy=currentAccount.actualRole==='MANAGER'?(()=>{
        const leaderIds=new Set(state.members.filter(m=>m.role==='LEADER'&&m.active!==false&&m.managerId===currentAccount.id).map(m=>m.id));
        const managerSales=new Set(state.members.filter(m=>m.role==='SALE'&&m.active!==false&&(m.managerId===currentAccount.id||leaderIds.has(m.leaderId))).map(m=>m.id));
        const members=state.members.filter(m=>m.id===currentAccount.id||leaderIds.has(m.id)||m.role==='SALE'&&managerSales.has(m.id));
        const hierarchyCustomers=state.customers.filter(c=>c.managerId===currentAccount.id||c.ownerId===currentAccount.id||leaderIds.has(c.leaderId)||managerSales.has(c.saleId));
        const orders=state.orders.filter(o=>leaderIds.has(o.leaderId)||managerSales.has(o.saleId));
        const orderIds=new Set(orders.map(o=>o.id));
        return {members,customers:hierarchyCustomers,orders,tasks:state.tasks.filter(t=>leaderIds.has(t.leaderId)||managerSales.has(t.ownerId)),financialEvents:financialEvents(orders).filter(e=>orderIds.has(e.orderId))};
      })():null;
      const visibleOrders=currentAccount.actualRole==='MANAGER'
        ? state.orders.filter(o=>managerLeaderIds.has(o.leaderId)||state.members.some(m=>m.role==='SALE'&&m.managerId===currentAccount.id&&m.id===o.saleId))
        : scopedOrders();
      return structuredClone({user:currentAccount,managerHierarchy,fonts:referenceFonts,assignedDataStats:currentAccount.role==='SALE'?assignedDataStatsForMe():null,pendingOffers:currentAccount.role==='SALE'?pendingOffersForMe().map(o=>({id:o.id,name:customerById(o.customerId)?.name||'',offeredAt:o.offeredAt,minutesLeft:offerMinutesLeft(o)})):[],customers,orders:visibleOrders,products:state.products,productCategories:state.productCategories,members:state.members,registeredAccounts:state.registeredAccounts,fields:state.customFieldDefinitions,careGroups:state.careGroups,imports:currentAccount.role==='ADMIN'?state.imports:[],resubmissions:state.resubmissions,websites:state.websites.map(w=>({...w,publicWebhookUrl:webhookUrlFor(w)})),webhookPending,webhookTransport:{...webhookTransport,label:(WEBHOOK_TRANSPORT_META[webhookTransport.mode]||WEBHOOK_TRANSPORT_META.idle)[0]},settings:state.settings,notifications:visibleNotifications(),audit:state.audit,attendance:state.attendance,brokerageMetrics:state.brokerageMetrics,tasks:scopedTasks(),leaderDistribution:state.leaderDistribution,saleDistributionByLeader:state.saleDistributionByLeader,offers:state.dataOffers,financialEvents:financialEvents(visibleOrders),navigation:allowedViews(),today:dayIso(0)});
    },
    async logout() { await endSession(); },
    async refresh() { return syncServerState(); },
    // Sale nhận đúng lời mời đang chờ và chỉ báo thành công sau khi MySQL xác nhận lưu.
    async acceptOffer(offerId) {
      requireRole(['SALE']);
      return persist(() => {
        if (!acceptDataOffer(offerId)) throw Error(lastNotice || 'Không nhận được data này.');
        return {ok:true};
      }, 'accept-offer:' + offerId);
    },
    async classify(id, value) {
      const c=customerById(id);if (!fieldOptionsValid(value)) throw Error('Phân loại không hợp lệ.');if (!canUpdateCustomer(c)) throw Error('Không được sửa khách hàng này.');
      await quickUpdateCustomerField(id,'customerClass',value);
      if (!await flushServerPersistence()) throw Error('Chưa lưu được phân loại khách.');
    },
    // Chuyển Team phải thu hồi lời mời cũ, giữ lịch sử và chờ máy chủ xác nhận.
    async assignLeader(id,leaderId){
      requireRole(['ADMIN']);
      return persist(()=>{
        const customer=customerById(id),leader=activeStaff().find(m=>m.id===leaderId&&['MANAGER','LEADER'].includes(m.role));
        if(!customer||!leader)throw Error('Khách hoặc Leader không còn hoạt động.');
        if(customer.leaderId===leader.id&&customer.teamId===leader.teamId)return {ok:true};
        closeOpenCustomerTasks(customer,'TRANSFERRED_TO_LEADER');
        state.dataOffers.forEach(o=>{if(o.customerId===id&&o.status==='PENDING'){o.status='EXPIRED';o.resolvedAt=stamp();}});
        customer.saleAcceptedAt=null;
        applyCustomerAssignment(customer,leader,'Chuyển Team/Leader thủ công');
        audit('REASSIGN_CUSTOMER',id,leader.name+' · '+leader.teamId);
        return {ok:true};
      },'assign-leader:'+id);
    },
    async assign(id, saleId) { if (!await quickAssignSale(id,saleId)) throw Error(lastNotice || 'Chưa phân công được Sale.'); },
    async createCustomer(input) {
      return persist(async()=>{
        const websites=state.websites||[];
        const selectedWebsite=websites.find(website=>website.id===input.websiteId||website.name===input.websiteId||website.domain===input.websiteId)||websites[0];
        if(!selectedWebsite)throw Error('Chưa có Landing page/website nguồn để tạo data.');
        const normalizedInput={...input,websiteId:selectedWebsite.id};
        const recipient=normalizedInput.saleId?activeStaff().find(m=>m.id===normalizedInput.saleId && ['SALE','LEADER'].includes(m.role) && (currentAccount.role==='ADMIN'||m.teamId===currentAccount.teamId)):null;
        if(normalizedInput.saleId && currentAccount.role!=='SALE' && !recipient) throw Error('Sale không nằm trong phạm vi tài khoản.');
        const result=ingestCustomer(normalizedInput,{intakeType:'MANUAL',sourceLabel:'Nhập thủ công'});
        if (!result.created&&!result.duplicate) throw Error(result.error);
        if (result.created && normalizedInput.saleId && currentAccount.role !== 'SALE') {
          const c=result.customer;
          const recipient=activeStaff().find(m=>m.id===normalizedInput.saleId && (currentAccount.role==='ADMIN'||m.teamId===currentAccount.teamId));
          if (!recipient) throw Error('Sale không nằm trong phạm vi tài khoản.');
          applyCustomerAssignment(c,recipient,'Phân công khi tạo khách từ CRM');
        }
        return {id:result.customer.id,duplicate:result.duplicate};
      },'customer');
    },
    async deleteCustomer(id) {
      requireRole(['ADMIN','MANAGER']);
      return persist(() => {
        const customer = state.customers.find(item => item.id === id);
        if (currentAccount.role==='MANAGER' && !scopedCustomers().some(item=>item.id===id)) throw Error('Data is outside the Manager scope.');
        if (!customer) throw Error('Data không còn tồn tại trên máy chủ.');
        state.customers = state.customers.filter(item => item.id !== id);
        state.dataOffers = state.dataOffers.filter(item => item.customerId !== id);
        state.tasks = state.tasks.filter(item => item.customerId !== id);
        state.resubmissions = state.resubmissions.filter(item => item.customerId !== id);
        audit('DELETE_CUSTOMER', id, customer.name);
        return {ok:true};
      },'delete-customer:'+id);
    },
    async deleteOrder(id) {
      requireRole(['ADMIN','MANAGER','LEADER','SALE']);
      return persist(() => {
        const order = state.orders.find(item => item.id === id);
        if (!order) throw Error('Order no longer exists on server.');
        if (currentAccount.role !== 'ADMIN') {
          const raw = String(order.createdAt || '').trim();
          const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
          const created = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}+07:00`);
          if (!Number.isFinite(created) || Date.now() - created >= 3 * 24 * 60 * 60 * 1000) {
            throw Error('Đơn hàng chỉ được xóa trong 3 ngày đầu.');
          }
          if (!canViewCustomer(customerById(order.customerId))) throw Error('Đơn hàng nằm ngoài phạm vi được giao.');
        }
        state.orders = state.orders.filter(item => item.id !== id);
        audit('DELETE_ORDER', id, order.code || id);
        return {ok:true};
      },'delete-order:'+id);
    },
    async createCare(input) {
      requireRole(['ADMIN']);
      return persist(()=>{
        const field=state.customFieldDefinitions.find(f=>f.id===input.fieldId&&f.active!==false);
        if (!field || !input.name.trim() || !input.values.length || input.values.some(v=>!field.options.some(o=>o.value===v))) throw Error('Tên mục hoặc lựa chọn không hợp lệ.');
        if ((state.careGroups||[]).some(g=>normalize(g.name)===normalize(input.name))) throw Error('Tên mục đã tồn tại.');
        const group={id:makeRecordId('CARE'),name:input.name.trim(),fieldId:input.fieldId,values:input.values};
        state.careGroups=[...(state.careGroups||[]),group];return group;
      },'care');
    },
    async createOrder(input) {
      requireRole(['ADMIN','LEADER','SALE']);
      // Gọi đúng form nghiệp vụ hiện có trong frame để giữ kiểm tra giá, VAT và phân quyền.
      if(pendingResult) return persist(()=>{},'order');
      if(!await flushServerPersistence())throw Error('Dữ liệu trước đó chưa được lưu.');
      const customer=customerById(input.customerId),product=productById(input.productId);
      if(!customer||!canViewCustomer(customer)||!customer.saleId||!product||product.active===false)throw Error('Chọn khách đã phân Sale và sản phẩm đang hoạt động.');
      newOrderModal(customer.id);
      const values={newOrderCustomer:customer.id,newOrderProduct:product.id,newOrderQty:1,newOrderPaymentMode:input.paymentMode,newOrderPaymentMethod:input.paymentMethod,newOrderDeposit:Math.round(product.price*1.1/2),newOrderBillingName:customer.name,newOrderBillingPhone:customer.phone,newOrderBillingEmail:customer.email||''};
      Object.entries(values).forEach(([id,value])=>$('#'+id).value=value);
      const before=new Set(state.orders.map(o=>o.id)); lastNotice='';
      await $('#newOrderForm').onsubmit({preventDefault(){}});
      const order=state.orders.find(o=>!before.has(o.id));
      if(!order)throw Error(lastNotice||'Không tạo được đơn hàng.');
      if(serverPendingRequest||serverConflict||hasServerChanges()){pendingResult={kind:'order',result:{id:order.id,code:order.code}};throw Error('Chưa xác nhận lưu đơn. Giữ form mở để thử lại.');}
      return {id:order.id,code:order.code};
    },
    // Lưu danh mục qua hàng đợi giao dịch chung; thử lại không tạo sản phẩm thứ hai.
    async saveProduct(id, input) {
      requireRole(['ADMIN']);
      return persist(()=>{
        const existing=id?state.products.find(p=>p.id===id):null;
        if(id&&!existing)throw Error('Sản phẩm không còn tồn tại.');
        const vatPercent= input.vatRate===''||input.vatRate==null ? 10 : Number(input.vatRate); const values={name:String(input.name||'').trim(),sku:String(input.sku||'').trim(),category:String(input.category||'').trim(),price:Number(input.price),type:input.type,rentalMonths:input.type==='RENTAL'?Number(input.rentalMonths):null,vatRate:vatPercent/100,active:input.active!==false};
        if(!Number.isFinite(vatPercent)||vatPercent<0||vatPercent>100)throw Error('VAT phải từ 0 đến 100%.');
        if(!values.name||values.name.length>200||!values.category||values.category.length>100||values.sku.length>60||input.price===''||!Number.isFinite(values.price)||values.price<0)throw Error('Kiểm tra tên, danh mục và đơn giá sản phẩm.');
        if(!['SALE','RENTAL'].includes(values.type)||values.type==='RENTAL'&&![1,3,6,12].includes(values.rentalMonths))throw Error('Sản phẩm thuê phải chọn gói 1, 3, 6 hoặc 12 tháng.');
        if(values.sku&&state.products.some(p=>p.id!==id&&p.sku&&normalize(p.sku)===normalize(values.sku)))throw Error('Mã SKU đã tồn tại.');
        const product=existing||{id:makeRecordId('PRD')};
        Object.assign(product,values);
        if(!existing)state.products.unshift(product);
        PRODUCTS=state.products;
        if(!state.productCategories.includes(values.category))state.productCategories.push(values.category);
        audit(existing?'EDIT_PRODUCT':'CREATE_PRODUCT',product.id,product.name);
        return {id:product.id};
      },'product:'+ (id||'new'));
    },
    // Các thao tác quản trị dùng chung giao dịch và kiểm tra quyền của runtime.
    async updateField(customerId, fieldId, value) {
      return persist(()=>{
        const field=state.customFieldDefinitions.find(f=>f.id===fieldId&&f.active!==false);
        if(!field)throw Error('Cột không còn hoạt động.');
        if(['SELECT','MULTI_SELECT'].includes(field.type)&&[].concat(value).some(v=>v!==''&&!field.options.some(o=>o.value===v)))throw Error('Lựa chọn không hợp lệ.');
        const result=setCustomerCustomFields(customerId,{[fieldId]:value});
        if(result.error)throw Error(result.error);return result;
      },'customer-field:'+customerId+':'+fieldId);
    },
    async saveField(id,input) {
      requireRole(['ADMIN']);
      return persist(()=>{
        const existing=state.customFieldDefinitions.find(f=>f.id===id);
        if(id&&!existing)throw Error('Cột không còn tồn tại.');
        const label=String(input.label||'').trim(),type=id==='customerLevel'?'SELECT':input.type;
        if(!label||label.length>160||!['TEXT','NOTE','SELECT','MULTI_SELECT','CHECKBOX'].includes(type))throw Error('Tên hoặc kiểu cột không hợp lệ.');
        if(state.customFieldDefinitions.some(f=>f.id!==id&&normalize(f.label)===normalize(label)))throw Error('Tên cột đã tồn tại.');
        const options=['SELECT','MULTI_SELECT'].includes(type)?(input.options||[]).map(o=>({value:String(o.value||o.label||'').trim(),label:String(o.label||'').trim(),color:/^#[a-f0-9]{6}$/i.test(o.color)?o.color:'#64748b'})):[];
        if(['SELECT','MULTI_SELECT'].includes(type)&&(!options.length||options.some(o=>!o.value||!o.label||o.value.length>160||o.label.length>200)||new Set(options.map(o=>o.value)).size!==options.length))throw Error('Nhập các lựa chọn khác nhau, không để trống.');
        if(id&&(state.careGroups||[]).some(g=>g.fieldId===id&&(!['SELECT','MULTI_SELECT'].includes(type)||g.values.some(v=>!options.some(o=>o.value===v)))))throw Error('Lựa chọn đang dùng trong mục chăm sóc. Hãy cập nhật mục chăm sóc trước.');
        const next={id:id||makeRecordId('field'),label,type,options,active:existing?.active!==false,showInTable:true,required:existing?.required===true};
        if(existing){
          const previous=structuredClone(existing);Object.assign(existing,next);
          state.customers.forEach(c=>{c.customFields||={};const before=c.customFields[id]??defaultCustomFieldValue(previous),after=sanitizeCustomFieldValue(before,existing);if(JSON.stringify(before)!==JSON.stringify(after))recordFieldChange(c,previous,before,after,'SYSTEM');c.customFields[id]=after;});
        }else{state.customFieldDefinitions.push(next);state.customers.forEach(c=>{c.customFields||={};c.customFields[next.id]=defaultCustomFieldValue(next);});}
        audit(existing?'UPDATE_CUSTOM_FIELD':'CREATE_CUSTOM_FIELD',next.id,label);return {id:next.id};
      },'field:'+ (id||'new'));
    },
    async removeField(id) {
      requireRole(['ADMIN']);return persist(()=>{
        if(id==='customerLevel')throw Error('Không thể xóa cột Level khách hàng.');
        const field=state.customFieldDefinitions.find(f=>f.id===id);if(!field)throw Error('Cột không tồn tại.');
        if((state.careGroups||[]).some(g=>g.fieldId===id))throw Error('Cột đang dùng trong mục chăm sóc. Hãy đổi cột của mục đó trước.');
        state.customFieldDefinitions=state.customFieldDefinitions.filter(f=>f.id!==id);
        state.customers.forEach(c=>{if(c.customFields)delete c.customFields[id];});
        // Giữ lịch sử đã ghi nhận để tra cứu sau khi xóa định nghĩa cột.
        audit('DELETE_CUSTOM_FIELD',id,field.label);return {ok:true};
      },'remove-field:'+id);
    },
    async saveCare(id,input) {
      requireRole(['ADMIN']);return persist(()=>{
        const existing=(state.careGroups||[]).find(g=>g.id===id),field=state.customFieldDefinitions.find(f=>f.id===input.fieldId&&f.active!==false&&['SELECT','MULTI_SELECT'].includes(f.type));
        if(id&&!existing)throw Error('Mục chăm sóc không còn tồn tại.');
        const name=String(input.name||'').trim();
        if(!name||name.length>100||!field||!Array.isArray(input.values)||!input.values.length||input.values.some(v=>!field.options.some(o=>o.value===v)))throw Error('Nhập tên mục và chọn ít nhất một giá trị hợp lệ.');
        if((state.careGroups||[]).some(g=>g.id!==id&&normalize(g.name)===normalize(name)))throw Error('Tên mục đã tồn tại.');
        const group={id:id||makeRecordId('CARE'),name,fieldId:field.id,values:[...new Set(input.values)],color:/^#[a-f0-9]{6}$/i.test(input.color)?input.color:'#2563eb'};
        state.careGroups=(state.careGroups||[]).filter(g=>g.id!==group.id).concat(group);return {id:group.id};
      },'care:'+ (id||'new'));
    },
    async reorderCare(orderIds) {
      requireRole(['ADMIN']);return persist(()=>{
        const groups=[...(state.careGroups||[])], ids=Array.isArray(orderIds)?orderIds.map(String):[];
        if(ids.length!==groups.length||new Set(ids).size!==groups.length||groups.some(group=>!ids.includes(String(group.id)))) throw Error('Thứ tự mục chăm sóc không hợp lệ.');
        const byId=new Map(groups.map(group=>[String(group.id),group]));
        state.careGroups=ids.map(id=>byId.get(id));
        audit('REORDER_CARE_GROUPS','order',state.careGroups.map(group=>group.name).join(' '));
        return {ok:true};
      },'care-reorder');
    },
    async removeCare(id) {requireRole(['ADMIN']);return persist(()=>{state.careGroups=(state.careGroups||[]).filter(g=>g.id!==id);return {ok:true};},'remove-care:'+id);},
    async saveWebsite(id,input) {
      requireRole(['ADMIN']);return persist(()=>{
        const existing=state.websites.find(w=>w.id===id);if(id&&!existing)throw Error('Website không còn tồn tại.');
        const name=String(input.name||'').trim(),sourceUrl=cleanSourceUrl(input.sourceUrl);let domain='';try{domain=new URL(sourceUrl).hostname.toLowerCase();}catch{}
        if(!name||name.length>200||!sourceUrl||!domain||!['LANDING_API','FACEBOOK_FORMS','TIKTOK_FORMS','CUSTOM_WEBHOOK'].includes(input.provider))throw Error('Tên, URL nguồn hoặc nhà cung cấp không hợp lệ.');
        if(state.websites.some(w=>w.id!==id&&w.sourceUrl===sourceUrl))throw Error('URL nguồn đã tồn tại.');
        const website=existing||normalizeWebsiteRecord({id:makeRecordId('WEB'),name,sourceUrl,provider:input.provider,webhookSlug:generateWebhookSlug()});
        Object.assign(website,{name,sourceUrl,domain,provider:input.provider});
        if(!existing)state.websites.unshift(website);
        audit(existing?'UPDATE_SOURCE_URL':'CREATE_WEBSITE',website.id,sourceUrl);return {id:website.id};
      },'website:'+ (id||'new'));
    },
    async syncWebsites() {requireRole(['ADMIN']);await pullWebhookInbox(true);await syncServerState();if(!await flushServerPersistence())throw Error('Chưa lưu xong dữ liệu đồng bộ.');},
    async resolveSource(id,websiteId) {
      requireRole(['ADMIN']);return persist(()=>{
        const item=webhookPending.find(r=>r.id===id),website=websiteById(websiteId);
        if(!item||!website)throw Error('Chọn bản ghi và website hợp lệ.');
        const result=ingestCustomer(webhookIngestFields(item.customer,website),WEBHOOK_INTAKE_CONTEXT);
        if(!result.created&&!result.duplicate)throw Error(result.error||'Không tạo được khách hàng.');
        webhookPending=webhookPending.filter(r=>r.id!==id);state.webhookPending=webhookPending;
        audit('ASSIGN_WEBSITE_SOURCE',websiteId,result.customer.id);return {id:result.customer.id};
      },'resolve-source:'+id);
    },
    async removeWebsite(id) {
      requireRole(['ADMIN']);return persist(()=>{
        if(state.customers.some(c=>c.websiteId===id)||state.orders.some(o=>o.websiteId===id)||(state.webhookPending||[]).some(w=>w.websiteId===id))throw Error('Website đã có dữ liệu. Giữ website để bảo toàn nguồn khách; có thể sửa tên hoặc URL.');
        state.websites=state.websites.filter(w=>w.id!==id);audit('DELETE_WEBSITE',id,'Xóa website chưa có dữ liệu');return {ok:true};
      },'remove-website:'+id);
    },
    async saveMember(id,input) {
      requireRole(['ADMIN']);return persist(()=>{
        const member=state.members.find(m=>m.id===id),pending=state.registeredAccounts.find(m=>m.id===id);
        if(id&&!member&&!pending)throw Error('Tài khoản không còn tồn tại.');
        const name=String(input.name||'').trim(),accountId=String(input.accountId||'').trim().toUpperCase(),email=String(input.email||'').trim().toLowerCase(),phone=String(input.phone||'').trim(),role=input.role,leader=state.members.find(m=>m.id===input.leaderId&&['LEADER','MANAGER'].includes(m.role)&&m.active!==false);
        const requestedTeamId=String(input.teamId||'').trim().toUpperCase();
        let teamId=requestedTeamId;
        // Sale dùng Team của Leader trực tiếp; nếu form gửi Team khác thì báo lỗi thay vì âm thầm đổi dữ liệu.
        if(role==='SALE'&&leader?.role==='LEADER'){
          const leaderTeamId=String(leader.teamId||'').trim().toUpperCase();
          if(requestedTeamId&&requestedTeamId!==leaderTeamId)throw Error('Sale phải thuộc đúng Team của Leader.');
          teamId=leaderTeamId;
        }
        if(!name||name.length>160||(accountId&&!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(accountId))||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Họ tên, ID tài khoản hoặc email không hợp lệ.');
        if(state.members.concat(state.registeredAccounts).some(m=>m.id!==id&&((accountId&&String(m.accountId||'').toUpperCase()===accountId)||(email&&m.email?.toLowerCase()===email)||(phone&&m.phone===phone))))throw Error('ID tài khoản, email hoặc số điện thoại đã tồn tại.');
        if(member&&!['SALE','LEADER','MANAGER'].includes(member.role)){
          if(role!==member.role)throw Error('Không đổi quyền tài khoản quản trị tại form này.');
          Object.assign(member,{name,accountId,email,phone,initials:memberInitials(name)});audit('UPDATE_MEMBER',id,name);return {id};
        }
        if(!['SALE','LEADER','MANAGER'].includes(role)||(role!=='MANAGER'&&!/^[A-Z0-9_-]{1,20}$/.test(teamId)))throw Error('Chọn chức vụ và Team hợp lệ.');
        if(role==='SALE'&&(!leader||leader.id===id||leader.role==='LEADER'&&leader.teamId!==teamId))throw Error('Sale phải thuộc đúng Team của Leader hoặc Manager.');
        // Leader có thể được nâng lên Manager mà không cần chuyển Sale.
        // Sale vẫn giữ nguyên leaderId/teamId; Manager chỉ nhận thêm phạm vi quản lý.
        if(member?.role==='LEADER'&&role!=='LEADER'&&role!=='MANAGER'&&state.members.some(m=>m.active!==false&&m.leaderId===id))throw Error('Chuyển Sale trực thuộc trước khi đổi Leader.');
        const managerId=role==='LEADER'?String(input.managerId||''):role==='SALE'&&leader?.role==='MANAGER'?leader.id:null;
        if(managerId&&!state.members.some(m=>m.id===managerId&&m.role==='MANAGER'&&m.active!==false))throw Error('Manager không hoạt động.');
        if(member?.role==='MANAGER'&&role!=='MANAGER'&&state.members.some(m=>m.managerId===id))throw Error('Bỏ phân công các Leader trước khi đổi chức Manager.');
        if(role==='MANAGER'){
          const source=member||pending||{};
          const next={...source,id:id||makeRecordId('MANAGER'),name,accountId,email,phone,role,teamId:'',leaderId:null,managerId:null,active:true,initials:memberInitials(name)};
          if(member)Object.assign(member,next);else state.members.push(next);
          const inheritedSales=state.members.filter(item=>item.active!==false&&item.role==='SALE'&&item.leaderId===id);
          inheritedSales.forEach(sale=>{sale.managerId=id;});
          state.customers.filter(customer=>customer.managerId===id||customer.ownerId===id||customer.leaderId===id||customer.saleId===id||inheritedSales.some(sale=>sale.id===customer.saleId)).forEach(customer=>{customer.managerId=id;});
          state.registeredAccounts=state.registeredAccounts.filter(m=>m.id!==id);STAFF=state.members.filter(m=>m.active!==false);audit('UPDATE_MANAGER',next.id,name);return {id:next.id};
        }
        if(pending){const next={...pending,name,accountId,email,phone,role,teamId,managerId,leaderId:role==='SALE'?leader.id:null,managerId,active:true,initials:memberInitials(name)};state.members.push(next);state.registeredAccounts=state.registeredAccounts.filter(m=>m.id!==id);STAFF=state.members.filter(m=>m.active!==false);audit('ASSIGN_REGISTERED_ACCOUNT',id,name);return {id};}
        // Gọi nghiệp vụ cũ để chuyển khách và công việc đúng khi đổi Team/Leader.
        const before=new Set(state.members.map(m=>m.id));teamMemberModal(id);
        Object.entries({memberName:name,memberEmail:email,memberRole:role,memberTeam:teamId,memberLeader:input.leaderId||''}).forEach(([key,value])=>$('#'+key).value=value);
        saveTeamMember(id);const saved=id?state.members.find(m=>m.id===id):state.members.find(m=>!before.has(m.id));
        if(!saved)throw Error('Chưa tạo được thành viên.');saved.accountId=accountId;saved.phone=phone;saved.managerId=managerId;return {id:saved.id};
      },'member:'+(id||'new'));
    },
    async removeMember(id) {
      requireRole(['ADMIN']);return persist(()=>{
        const member=state.members.find(m=>m.id===id);
        if(!member||!['SALE','LEADER'].includes(member.role)||id===currentAccount.id)throw Error('Không thể xóa tài khoản quản trị hoặc tài khoản hiện tại.');
        if(state.members.some(m=>m.active!==false&&m.leaderId===id))throw Error('Chuyển Sale trực thuộc sang Leader khác trước.');
        const previous=window.confirm;try{window.confirm=()=>true;deleteTeamMember(id);}finally{window.confirm=previous;}return {id};
      },'remove-member:'+id);
    },
    async resetPassword(id,password,confirmation) {
      requireRole(['ADMIN']);if(password.length<8||password!==confirmation)throw Error('Mật khẩu cần ít nhất 8 ký tự và xác nhận trùng nhau.');
      if(!state.members.some(m=>m.id===id&&m.loginEnabled))throw Error('Nhân sự chưa có tài khoản đăng nhập.');
      if(!await saveAccountPassword({userId:id,password}))throw Error(lastNotice||'Chưa đổi được mật khẩu.');return {ok:true};
    },
    async announce(input) {
      requireRole(['ADMIN']);return persist(()=>{
        const title=String(input.title||'').trim(),text=String(input.text||'').trim();
        if(!title||title.length>200||!text||text.length>1000)throw Error('Nhập tiêu đề và nội dung thông báo hợp lệ.');
        const item={id:makeRecordId('NT'),title,text,role:'ALL',at:stamp(),readBy:[]};state.notifications.unshift(item);audit('CREATE_ANNOUNCEMENT','NOTIFICATIONS',title);return {id:item.id};
      },'announcement');
    },
    async readNotice(id) {return persist(()=>{const item=visibleNotifications().find(n=>n.id===id);if(!item)throw Error('Không tìm thấy thông báo.');item.readBy=Array.from(new Set([...(item.readBy||[]),currentAccount.id]));return {ok:true};},'read-notice:'+id);},
    async telegramBroadcast(input) {
      requireRole(['ADMIN']);
      const target=String(input.target||'ALL').toUpperCase();
      const payload={type:String(input.type||'CUSTOM').toUpperCase(),target:['ALL','SALE','MANAGERS'].includes(target)?target:'ALL',title:String(input.title||'').trim(),content:String(input.content||'').trim(),host:String(input.host||'').trim(),meeting_time:input.meeting_time||null,meeting_link:String(input.meeting_link||'').trim()||null,remind_minutes:Number.isFinite(Number(input.remind_minutes))?Number(input.remind_minutes):15,effective_date:input.effective_date||null};
      if(!payload.title||payload.title.length>200||!payload.content||payload.content.length>4000)throw Error('Nhập tiêu đề và nội dung hợp lệ.');
      const response=await fetch(`${webhookApiBase()}/api/broadcast`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${serverSyncToken}`},body:JSON.stringify(payload)});
      let result={};try{result=await response.json();}catch{}
      if(!response.ok||!result.ok)throw Error(result.error||`Không gửi được thông báo (HTTP ${response.status}).`);
      state.notifications.unshift({id:makeRecordId('NT'),title:payload.title,text:`Telegram - ${payload.content}`,role:'ALL',at:stamp(),readBy:[]});
      audit('TELEGRAM_BROADCAST','NOTIFICATIONS',`${payload.title} - ${result.sent||0} nguoi nhan`);saveState();
      if(!await flushServerPersistence())throw Error('Telegram da gui nhung chua luu duoc lich su CRM.');
      return {ok:true,sent:Number(result.sent||0)};
    },
    newWebhookSlug(){requireRole(['ADMIN']);return generateWebhookSlug();},
    async saveWebhook(id,input) {
      requireRole(['ADMIN']);return persist(()=>{
        const w=websiteById(id),slug=cleanWebhookSlug(input.slug),override=String(input.override||'').trim(),base=String(input.base||'').trim();
        if(!w||!slug)throw Error('Mã webhook sai định dạng.');
        if(state.websites.some(w=>w.id!==id&&w.webhookSlug?.toUpperCase()===slug.toUpperCase()))throw Error('Mã webhook đã thuộc website khác.');
        if(override&&!cleanWebhookOverride(override))throw Error('URL ghi đè phải dùng HTTPS.');
        if(base&&!/^https?:\/\/[^\s]+$/.test(base))throw Error('Domain công khai không hợp lệ.');
        w.webhookSlug=slug;w.webhookUrlOverride=cleanWebhookOverride(override);state.settings.webhookPublicBase=cleanWebhookBase(base,DEFAULT_WEBHOOK_BASE);audit('UPDATE_WEBHOOK',id,w.domain);return {id};
      },'webhook:'+id);
    },
    async settings(input) { requireRole(['ADMIN']); return persist(()=>{state.settings={...state.settings,...input};return {ok:true};},'settings'); },
    async readNotifications() { markNotificationRead();if(!await flushServerPersistence())throw Error('Chưa lưu trạng thái đã đọc.'); },
    async distribution(enabled,mode) {
      requireRole(['ADMIN']);
      if(mode)await setAssignmentMode(mode);
      if(state.leaderDistribution.enabled!==enabled)await toggleLeaderDistribution();
      if(!await flushServerPersistence())throw Error('Chưa lưu cấu hình chia data.');
    },
    // Luu ty trong va trang thai nhan data cua Leader/Sale vao state phan phoi.
    async distributionWeight(kind,id,value) {
      if(!serverStateLoaded||!['ADMIN','MANAGER'].includes(effectivePermissionRole()))throw Error('Khong co quyen chinh ty trong.');
      const normalizedKind=String(kind||'').toUpperCase();
      const member=state.members.find(item=>item.id===id&&item.active!==false);
      if(!member||!['LEADER','SALE','MANAGER'].includes(normalizedKind)||member.role!==normalizedKind)throw Error('Nhan su khong hop le de cai ty trong.');
      if(effectivePermissionRole()==='MANAGER'){
        const scope=managerScope();
        if(!(member.id===scope.manager?.id||scope.leaderIds.has(member.id)||scope.saleIds.has(member.id)))throw Error('Manager chi duoc chinh ty trong trong tuyen cua minh.');
      }
      const rawWeight=Number(value),weight=Number.isFinite(rawWeight)?Math.max(0,Math.min(100,Math.round(rawWeight))):1;
      const config=state.saleDistributionByLeader['$'] ||= {globalCycle:true,enabledSaleIds:[],weights:{}};
      config.globalCycle=true;config.weights||={};if(config.weights[id]===undefined)config.enabledSaleIds=Array.from(new Set([...(config.enabledSaleIds||[]),id]));config.weights[id]=weight;
      const legacyKey=member.role==='SALE'?(member.managerId?'manager:'+member.managerId:(member.leaderId||null)):member.role==='LEADER'?member.id:'manager:'+member.id;
      if(legacyKey){const legacy=state.saleDistributionByLeader[legacyKey] ||= {globalCycle:true,enabledSaleIds:[],weights:{}};legacy.weights||={};if(legacy.weights[id]===undefined)legacy.enabledSaleIds=Array.from(new Set([...(legacy.enabledSaleIds||[]),id]));legacy.weights[id]=weight;}
      audit('UPDATE_DISTRIBUTION_WEIGHT',id,normalizedKind+' - ty trong '+weight);
      if(!await flushServerPersistence())throw Error('Chua luu ty trong phan data.');
      return {ok:true};
    },
    async bulkAssignWaitingSales(mode) {
      requireRole(['ADMIN']);
      const selectedMode=['EQUAL','ROUND_ROBIN','BALANCED','SALE_EMPTY','LEADER_EQUAL'].includes(mode)?mode:(state.settings.assignmentMode==='EQUAL'||state.settings.assignmentMode==='ROUND_ROBIN'?state.settings.assignmentMode:'BALANCED');
      const count=bulkAssignWaitingSales(selectedMode);
      if(!await flushServerPersistence())throw Error('Chua luu ket qua chia data cho Sale.');
      return {ok:true,count};
    },
    async distributionMember(kind,id,enabled) {
      if(!serverStateLoaded||!['ADMIN','MANAGER'].includes(effectivePermissionRole()))throw Error('Khong co quyen chinh ty trong.');
      const normalizedKind=String(kind||'').toUpperCase();
      const member=state.members.find(item=>item.id===id&&item.active!==false);
      if(!member||!['LEADER','SALE','MANAGER'].includes(normalizedKind)||member.role!==normalizedKind)throw Error('Nhan su khong hop le de bat nhan data.');
      if(effectivePermissionRole()==='MANAGER'){
        const scope=managerScope();
        if(!(member.id===scope.manager?.id||scope.leaderIds.has(member.id)||scope.saleIds.has(member.id)))throw Error('Manager chi duoc chinh nguoi trong tuyen cua minh.');
      }
      const config=state.saleDistributionByLeader['$'] ||= {globalCycle:true,enabledSaleIds:[],weights:{}};
      config.globalCycle=true;config.weights||={};const ids=new Set(config.enabledSaleIds||[]);enabled?ids.add(id):ids.delete(id);config.enabledSaleIds=Array.from(ids);if(config.weights[id]===undefined)config.weights[id]=1;
      const legacyKey=member.role==='SALE'?(member.managerId?'manager:'+member.managerId:(member.leaderId||null)):member.role==='LEADER'?member.id:'manager:'+member.id;
      if(legacyKey){const legacy=state.saleDistributionByLeader[legacyKey] ||= {globalCycle:true,enabledSaleIds:[],weights:{}};legacy.weights||={};const legacyIds=new Set(legacy.enabledSaleIds||[]);enabled?legacyIds.add(id):legacyIds.delete(id);legacy.enabledSaleIds=Array.from(legacyIds);if(legacy.weights[id]===undefined)legacy.weights[id]=1;}
      audit('UPDATE_DISTRIBUTION_MEMBER',id,normalizedKind+' - '+(enabled?'bat':'tat'));
      if(!await flushServerPersistence())throw Error('Chua luu trang thai nhan data.');
      return {ok:true};
    },
    notify:message=>toast(message)
  };
})();
