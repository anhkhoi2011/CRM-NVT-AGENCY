'use strict';
window.addEventListener('DOMContentLoaded', function () {
  document.addEventListener('click', function (event) {
    if (!event.target.closest || !event.target.closest('#newCareGroupButton') || currentAccount.role !== 'ADMIN') return;
    event.preventDefault(); event.stopImmediatePropagation();
    var fields = state.customFieldDefinitions.filter(function (field) { return ['SELECT','MULTI_SELECT'].includes(field.type) && field.active !== false; });
    if (!fields.length) { toast('Ch&#432;a c&#243; c&#7897;t d&#7919; li&#7879;u ph&#249; h&#7907;p'); return; }
    openModal('T&#7841;o m&#7909;c ch&#259;m s&#243;c', '<form id="careGroupForm"><label class="form-field">T&#234;n m&#7909;c<input id="careGroupName" required maxlength="100" placeholder="Kh&#225;ch &#432;u ti&#234;n cao"></label><label class="form-field">C&#7897;t d&#7919; li&#7879;u<select id="careGroupField">' + fields.map(function (field) { return '<option value="' + escapeHtml(field.id) + '">' + escapeHtml(field.label) + '</option>'; }).join('') + '</select></label><fieldset class="form-field"><legend>Gi&#225; tr&#7883; &#273;&#432;a v&#224;o m&#7909;c</legend><div id="careGroupValues"></div></fieldset><div class="modal-actions"><button class="button" type="button" data-close-modal>H&#7911;y</button><button class="button button-primary" type="submit">L&#432;u m&#7909;c</button></div></form>');
    function values() { var field=fields.find(function (item) { return item.id === document.querySelector('#careGroupField').value; }); document.querySelector('#careGroupValues').innerHTML=(field.options||[]).map(function (option) { return '<label style="display:inline-flex;gap:6px;margin:0 14px 10px 0"><input type="checkbox" value="'+escapeHtml(option.value)+'">'+escapeHtml(option.label)+'</label>'; }).join(''); }
    document.querySelector('#careGroupField').onchange=values; values();
    document.querySelector('#careGroupForm').onsubmit=async function (submit) { submit.preventDefault(); var selected=[].slice.call(document.querySelectorAll('#careGroupValues input:checked')).map(function (input) { return input.value; }); var name=document.querySelector('#careGroupName').value.trim(); if(!name||!selected.length){toast('Nh&#7853;p t&#234;n v&#224; ch&#7885;n gi&#225; tr&#7883;');return;} state.careGroups=[...(state.careGroups||[]),{id:'CARE-'+Date.now(),name:name,fieldId:document.querySelector('#careGroupField').value,values:selected}]; saveState(); if(await flushServerPersistence()){closeModal();render();toast('&#272;&#227; l&#432;u m&#7909;c ch&#259;m s&#243;c');} };
  }, true);
});
