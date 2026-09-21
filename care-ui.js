'use strict';

// Chăm sóc dùng cùng state và giao dịch API với các màn hình CRM.
function configuredCareGroups() {
  return state.careGroups || [];
}
function careMembers(group) {
  const all = scopedCustomers().filter(customer => canUpdateCustomer(customer) || currentAccount.role !== 'SALE' || customer.saleAcceptedAt);
  const pool = currentAccount.role === 'LEADER' && window.__nvtCareTab !== 'TEAM'
    ? all.filter(customer => customer.saleId === currentAccount.id || (!customer.saleId && customer.leaderId === currentAccount.id)) : all;
  return pool.filter(customer => (!globalQuery || normalize(customerSearchText(customer)).includes(normalize(globalQuery))) &&
    [].concat(customer.customFields?.[group.fieldId] ?? '').some(value => (group.values || []).includes(value)));
}
function careView() {
  const admin = currentAccount.role === 'ADMIN';
  const groups = configuredCareGroups();
  const actions = admin ? '<button class="button" id="manageCustomerFieldsButton">Quản lý phân loại</button><button class="button button-primary" id="newCareGroupButton">+ Tạo mục chăm sóc</button>' : '';
  const tabs = currentAccount.role === 'LEADER' ? `<div class="segmented"><button class="segment ${window.__nvtCareTab !== 'TEAM' ? 'active' : ''}" data-care-tab="MINE">Của tôi</button><button class="segment ${window.__nvtCareTab === 'TEAM' ? 'active' : ''}" data-care-tab="TEAM">Cả team</button></div>` : '';
  return pageHead('Chăm sóc khách', '', actions) + tabs + `<div class="care-panels">${groups.map((group, index) => {
    const members = careMembers(group);
    const field = state.customFieldDefinitions.find(item => item.id === group.fieldId);
    return `<section class="panel"><div class="panel-head"><div class="panel-title" style="color:${escapeHtml(/^#[a-f0-9]{6}$/i.test(group.color) ? group.color : '#2563eb')}">${escapeHtml(group.name)} <span class="status">${number(members.length)}</span></div>${admin ? `<div class="panel-actions"><button class="button button-small" data-move-care="${escapeHtml(group.id)}" data-direction="up" aria-label="Đưa mục lên" title="Đưa mục lên" ${index === 0 ? 'disabled' : ''}>↑</button><button class="button button-small" data-move-care="${escapeHtml(group.id)}" data-direction="down" aria-label="Đưa mục xuống" title="Đưa mục xuống" ${index === groups.length - 1 ? 'disabled' : ''}>↓</button><button class="button button-small" data-edit-care="${escapeHtml(group.id)}">Sửa</button><button class="button button-small button-danger" data-delete-care="${escapeHtml(group.id)}">Xóa mục</button></div>` : ''}</div><div class="panel-body">${members.map(customer => `<div class="care-customer-row"><div><b>${escapeHtml(customer.name)}</b><small>${escapeHtml(customer.phone || '')} · ${escapeHtml(staffName(customer.saleId))}</small></div><div>${field ? customFieldTableControl(field, customer) : ''}</div><button class="button button-small" data-open-customer="${escapeHtml(customer.id)}">Chi tiết</button></div>`).join('') || '<div class="empty"><b>Chưa có khách phù hợp</b></div>'}</div></section>`;
  }).join('') || '<section class="panel"><div class="empty"><b>Chưa có mục chăm sóc</b><span>Admin có thể tạo mục và chọn phân loại để khách tự xuất hiện trong mục đó.</span></div></section>'}</div>`;
}
async function moveCareGroup(id, direction) {
  if (currentAccount?.role !== 'ADMIN') return;
  const groups = [...configuredCareGroups()];
  const index = groups.findIndex(group => group.id === id);
  const nextIndex = index + (direction === 'up' ? -1 : 1);
  if (index < 0 || nextIndex < 0 || nextIndex >= groups.length) return;
  [groups[index], groups[nextIndex]] = [groups[nextIndex], groups[index]];
  state.careGroups = groups;
  saveState();
  if (await flushServerPersistence()) {
    render();
    toast('Đã cập nhật thứ tự mục chăm sóc');
  } else {
    toast('Chưa lưu được thứ tự. Giữ thay đổi để thử lại.');
  }
}
function careGroupEditor(id) {
  if (currentAccount?.role !== 'ADMIN') return;
  const existing = configuredCareGroups().find(group => group.id === id);
  const fields = state.customFieldDefinitions.filter(field => field.active !== false && ['SELECT','MULTI_SELECT'].includes(field.type));
  if (!fields.length) { customFieldsModal(); toast('Tạo cột dạng lựa chọn trước khi tạo mục chăm sóc'); return; }
  openModal(existing ? 'Sửa mục chăm sóc' : 'Tạo mục chăm sóc', `<form id="careGroupForm" class="care-group-form"><label class="form-field">Tên mục<input id="careGroupName" required maxlength="100" value="${escapeHtml(existing?.name || '')}"></label><div class="form-grid"><label class="form-field">Cột dữ liệu<select id="careGroupField">${fields.map(field => `<option value="${escapeHtml(field.id)}" ${(existing?.fieldId || 'customerClass') === field.id ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')}</select></label><label class="form-field">Màu mục<input id="careGroupColor" type="color" value="${escapeHtml(existing?.color || '#2563eb')}"></label></div><div class="care-values-head"><b>Giá trị đưa vào mục</b><div><button type="button" class="button button-small" id="careSelectAll">Chọn tất cả</button><button type="button" class="button button-small" id="careClearAll">Bỏ chọn</button></div></div><div id="careGroupValues" class="care-value-grid"></div><p id="careGroupError" role="alert"></p><div class="modal-actions"><button class="button" type="button" id="cancelCareGroup">Hủy</button><button class="button button-primary" type="submit">Lưu mục</button></div></form>`);
  const valuesNode = $('#careGroupValues');
  function drawValues() {
    const field = fields.find(item => item.id === $('#careGroupField').value);
    valuesNode.innerHTML = (field.options || []).map(option => `<label class="care-value-option"><input type="checkbox" value="${escapeHtml(option.value)}" ${existing?.fieldId === field.id && existing.values.includes(option.value) ? 'checked' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('');
  }
  $('#careGroupField').onchange = drawValues; drawValues();
  $('#careSelectAll').onclick = () => valuesNode.querySelectorAll('input').forEach(input => input.checked = true);
  $('#careClearAll').onclick = () => valuesNode.querySelectorAll('input').forEach(input => input.checked = false);
  $('#cancelCareGroup').onclick = closeModal;
  let saving = false;
  const recordId = existing?.id || makeRecordId('CARE');
  $('#careGroupForm').onsubmit = async event => {
    event.preventDefault(); if (saving) return;
    const name = $('#careGroupName').value.trim();
    const values = Array.from(valuesNode.querySelectorAll('input:checked'), input => input.value);
    if (!name || !values.length) { $('#careGroupError').textContent = 'Nhập tên và chọn ít nhất một giá trị.'; return; }
    if (configuredCareGroups().some(group => group.id !== recordId && normalize(group.name) === normalize(name))) { $('#careGroupError').textContent = 'Tên mục đã tồn tại.'; return; }
    saving = true;
    state.careGroups = configuredCareGroups().filter(group => group.id !== recordId).concat({id:recordId,name,fieldId:$('#careGroupField').value,values,color:$('#careGroupColor').value});
    saveState();
    if (await flushServerPersistence()) { closeModal(); render(); toast('Đã lưu mục chăm sóc'); }
    else if ($('#careGroupError')) $('#careGroupError').textContent = 'Máy chủ chưa xác nhận lưu. Giữ form mở và thử lại.';
    saving = false;
  };
}
window.addEventListener('DOMContentLoaded', () => {
  Object.entries(NAVIGATION).forEach(([role, groups]) => {
    if (!['ADMIN','LEADER','SALE'].includes(role)) return;
    if (groups.some(([,items]) => items.some(item => item[0] === 'care'))) return;
    const group = groups.find(([,items]) => items.some(item => item[0] === 'customers'));
    if (group) group[1].splice(group[1].findIndex(item => item[0] === 'customers') + 1, 0, ['care','Chăm sóc khách','♡']);
  });
  VIEW_RENDERERS.care = careView;
  document.addEventListener('click', async event => {
    const target = event.target.closest?.('button'); if (!target) return;
    if (target.id === 'newCareGroupButton') careGroupEditor();
    if (target.dataset.moveCare && currentAccount?.role === 'ADMIN') await moveCareGroup(target.dataset.moveCare, target.dataset.direction);
    if (target.dataset.editCare) careGroupEditor(target.dataset.editCare);
    if (target.dataset.careTab) { window.__nvtCareTab = target.dataset.careTab; render(); }
    if (target.dataset.deleteCare && currentAccount?.role === 'ADMIN' && confirm('Xóa mục chăm sóc này? Các khách hàng vẫn được giữ nguyên.')) {
      state.careGroups = configuredCareGroups().filter(group => group.id !== target.dataset.deleteCare);
      saveState(); if (await flushServerPersistence()) render(); else toast('Chưa xác nhận lưu. Giữ trang mở để thử lại.');
    }
  });
  render();
});
