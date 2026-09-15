'use strict';

// Form quản lý mục chăm sóc. Dùng một modal rõ ràng thay cho prompt() cũ.
window.addEventListener('DOMContentLoaded', function () {
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('#newCareGroupButton');
    if (!button || currentAccount.role !== 'ADMIN') return;
    event.preventDefault();
    event.stopImmediatePropagation();

    var fields = (state.customFieldDefinitions || []).filter(function (field) {
      return ['SELECT', 'MULTI_SELECT'].includes(field.type) && field.active !== false && Array.isArray(field.options) && field.options.length;
    });
    if (!fields.length) {
      toast('Chưa có cột dữ liệu dạng chọn để tạo mục chăm sóc');
      return;
    }

    var optionList = function (field) {
      return (field.options || []).map(function (option) {
        return typeof option === 'string' ? { value: option, label: option } : { value: String(option.value ?? option.label ?? ''), label: String(option.label ?? option.value ?? '') };
      }).filter(function (option) { return option.value; });
    };
    var fieldOptions = fields.map(function (field) {
      return '<option value="' + escapeHtml(field.id) + '">' + escapeHtml(field.label || field.id) + '</option>';
    }).join('');

    openModal('Tạo mục chăm sóc', '<form id="careGroupForm" class="care-group-form">' +
      '<div class="care-form-intro">Chọn một cột dữ liệu và các giá trị khách hàng cần tự động đưa vào mục này.</div>' +
      '<label class="form-field care-form-name">Tên mục<input id="careGroupName" required maxlength="100" placeholder="Ví dụ: Khách ưu tiên cao"></label>' +
      '<label class="form-field">Cột dữ liệu<select id="careGroupField" class="care-field-select">' + fieldOptions + '</select></label>' +
      '<div class="care-values-head"><div><b>Giá trị đưa vào mục</b><small id="careGroupFieldHint"></small></div><div class="care-values-actions"><button type="button" class="button button-small" id="careSelectAll">Chọn tất cả</button><button type="button" class="button button-small" id="careClearAll">Bỏ chọn</button></div></div>' +
      '<fieldset class="care-values-fieldset"><legend class="sr-only">Giá trị đưa vào mục</legend><div id="careGroupValues" class="care-value-grid"></div></fieldset>' +
      '<div class="care-selection-summary" id="careSelectionSummary">Chưa chọn giá trị</div>' +
      '<div class="modal-actions"><button class="button" type="button" data-close-modal>Hủy</button><button class="button button-primary" type="submit">Lưu mục</button></div>' +
      '</form>');

    var fieldSelect = document.querySelector('#careGroupField');
    var valuesNode = document.querySelector('#careGroupValues');
    var summaryNode = document.querySelector('#careSelectionSummary');
    var hintNode = document.querySelector('#careGroupFieldHint');
    var renderValues = function () {
      var field = fields.find(function (item) { return item.id === fieldSelect.value; }) || fields[0];
      var options = optionList(field);
      hintNode.textContent = (field.label || field.id) + ' · ' + options.length + ' lựa chọn';
      valuesNode.innerHTML = options.map(function (option, index) {
        var id = 'care-value-' + index;
        return '<label class="care-value-option" for="' + id + '"><input id="' + id + '" type="checkbox" value="' + escapeHtml(option.value) + '"><span>' + escapeHtml(option.label) + '</span></label>';
      }).join('');
      valuesNode.querySelectorAll('input').forEach(function (input) { input.addEventListener('change', updateSummary); });
      updateSummary();
    };
    var updateSummary = function () {
      var selected = Array.from(valuesNode.querySelectorAll('input:checked'));
      summaryNode.textContent = selected.length ? selected.length + ' giá trị đã chọn' : 'Chưa chọn giá trị';
      summaryNode.classList.toggle('has-selection', selected.length > 0);
      valuesNode.querySelectorAll('.care-value-option').forEach(function (label) {
        label.classList.toggle('is-selected', label.querySelector('input').checked);
      });
    };
    document.querySelector('#careSelectAll').onclick = function () {
      valuesNode.querySelectorAll('input').forEach(function (input) { input.checked = true; });
      updateSummary();
    };
    document.querySelector('#careClearAll').onclick = function () {
      valuesNode.querySelectorAll('input').forEach(function (input) { input.checked = false; });
      updateSummary();
    };
    fieldSelect.onchange = renderValues;
    renderValues();

    document.querySelector('#careGroupForm').onsubmit = async function (submit) {
      submit.preventDefault();
      var name = document.querySelector('#careGroupName').value.trim();
      var selected = Array.from(valuesNode.querySelectorAll('input:checked')).map(function (input) { return input.value; });
      if (!name || !selected.length) {
        toast(!name ? 'Vui lòng nhập tên mục' : 'Vui lòng chọn ít nhất một giá trị');
        return;
      }
      state.careGroups = [...(state.careGroups || []), { id: 'CARE-' + Date.now(), name: name, fieldId: fieldSelect.value, values: selected }];
      saveState();
      if (await flushServerPersistence()) {
        closeModal();
        render();
        toast('Đã lưu mục chăm sóc');
      }
    };
  }, true);
});