'use strict';

(() => {
  const widgetId = 'crmSupportWidget';
  const imageUrls = new Map();
  const state = { user: null, open: false, conversations: [], selectedId: '', messages: [], file: null, previewUrl: '', draft: '', fingerprint: '', busy: false, initialized: false, lastIncoming: 0, streamController: null, streamRetry: null };
  const roleLabel = role => ({ ADMIN: 'Quản trị', MANAGER: 'Quản lý', LEADER: 'Trưởng nhóm', SALE: 'Sales', MARKETING: 'Marketing', ACCOUNTING: 'Kế toán' })[String(role || '').toUpperCase()] || 'Nhân viên';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = name => String(name || '?').trim().split(/\s+/).slice(-2).map(part => part[0] || '').join('').toUpperCase() || '?';
  const token = () => { try { return JSON.parse(sessionStorage.getItem('nvt-crm-session-v1') || 'null')?.token || ''; } catch { return ''; } };
  const date = value => { if (!value) return ''; const parsed = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : '+07:00')); return Number.isNaN(parsed.getTime()) ? String(value).slice(11, 16) : parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); };
  const relative = value => { const ms = Date.now() - Date.parse(String(value || '').replace(' ', 'T') + (String(value).includes('Z') ? '' : '+07:00')); if (!Number.isFinite(ms) || ms < 60000) return 'vừa xong'; if (ms < 3600000) return Math.floor(ms / 60000) + ' phút'; if (ms < 86400000) return Math.floor(ms / 3600000) + ' giờ'; return Math.floor(ms / 86400000) + ' ngày'; };

  async function request(path, options = {}) {
    const auth = token();
    if (!auth) throw Object.assign(new Error('Phiên đăng nhập đã hết hạn.'), { status: 401 });
    const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${auth}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const payload = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(payload?.error || 'Không thể kết nối hỗ trợ nội bộ.'), { status: response.status });
    return payload;
  }

  function ensureStyle() {
    if (document.getElementById('crmSupportChatStyles')) return;
    const style = document.createElement('style');
    style.id = 'crmSupportChatStyles';
    style.textContent = `#${widgetId}{position:fixed;right:24px;bottom:24px;z-index:2147482000;font-family:var(--font-sans,Arial,sans-serif);color:#0f172a}#${widgetId} *{box-sizing:border-box}#${widgetId} button,#${widgetId} input,#${widgetId} textarea{font:inherit}.support-launch{position:relative;display:grid;place-items:center;width:54px;height:54px;margin-left:auto;border:0;border-radius:50%;background:#2563eb;color:#fff;box-shadow:0 12px 28px rgba(37,99,235,.32);font-size:23px;cursor:pointer}.support-launch:hover{background:#1d4ed8}.support-launch-badge{position:absolute;top:-4px;right:-4px;display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border:2px solid #fff;border-radius:999px;background:#ef4444;color:#fff;font-size:10px;font-weight:800}.support-window{display:none;flex-direction:column;width:390px;height:min(560px,calc(100dvh - 96px));margin:0 0 12px;border:1px solid #dbe3ec;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 22px 60px rgba(15,23,42,.25)}.support-window.is-open{display:flex}.support-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding:12px 14px;background:#102d5b;color:#fff}.support-head-main{display:flex;align-items:center;gap:10px;min-width:0}.support-avatar{display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:800}.support-avatar.admin{background:#fff;color:#1d4ed8}.support-head b{display:block;font-size:13px}.support-head small{display:block;margin-top:3px;color:#bfdbfe;font-size:10.5px}.support-icon-button{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:#dbeafe;font-size:20px;line-height:1;cursor:pointer}.support-icon-button:hover{background:rgba(255,255,255,.12);color:#fff}.support-messages{display:flex;flex:1;flex-direction:column;gap:11px;overflow:auto;padding:14px;background:#f8fafc}.support-message-row{display:flex;gap:7px;max-width:86%}.support-message-row.outgoing{align-self:flex-end;flex-direction:row-reverse}.support-message-avatar{display:grid;place-items:center;flex:0 0 auto;width:25px;height:25px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:9px;font-weight:800}.support-message-row.outgoing .support-message-avatar{background:#1d4ed8;color:#fff}.support-bubble{min-width:0;padding:9px 11px;border:1px solid #e2e8f0;border-radius:10px;border-top-left-radius:3px;background:#fff;color:#334155;font-size:12px;line-height:1.45;box-shadow:0 1px 2px rgba(15,23,42,.04);white-space:pre-wrap;overflow-wrap:anywhere}.outgoing .support-bubble{border-color:#1d4ed8;border-top-left-radius:10px;border-top-right-radius:3px;background:#1d4ed8;color:#fff}.support-time{display:block;margin-top:4px;color:#94a3b8;font-size:10px;text-align:left}.outgoing .support-time{text-align:right}.support-image{display:block;width:180px;max-width:100%;max-height:150px;margin-top:8px;border:1px solid rgba(148,163,184,.45);border-radius:7px;object-fit:cover;cursor:zoom-in}.support-compose{padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff}.support-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 8px;border:1px solid #dbeafe;border-radius:8px;background:#eff6ff}.support-preview img{width:38px;height:38px;border-radius:5px;object-fit:cover}.support-preview span{min-width:0;flex:1;overflow:hidden;color:#1e3a8a;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.support-preview button{border:0;background:transparent;color:#64748b;font-size:18px;cursor:pointer}.support-compose-row{display:flex;align-items:flex-end;gap:8px}.support-attach{display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;border:1px solid #dbe3ec;border-radius:8px;background:#fff;color:#475569;font-size:18px;cursor:pointer}.support-attach:hover{border-color:#93c5fd;background:#eff6ff;color:#2563eb}.support-compose textarea{flex:1;min-height:36px;max-height:90px;resize:vertical;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;color:#0f172a;font-size:12px;outline:0}.support-compose textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.support-send{height:36px;padding:0 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:12px;font-weight:800;cursor:pointer}.support-send:disabled{opacity:.55;cursor:wait}.support-empty{display:grid;place-items:center;flex:1;padding:30px;color:#64748b;font-size:12px;text-align:center}.support-admin-window{width:min(760px,calc(100vw - 32px));height:min(570px,calc(100dvh - 96px))}.support-admin-body{display:grid;flex:1;min-height:0;grid-template-columns:270px minmax(0,1fr)}.support-conversations{overflow:auto;border-right:1px solid #e2e8f0;background:#f8fafc}.support-list-caption{display:flex;justify-content:space-between;padding:11px 13px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;font-weight:700}.support-conversation{display:flex;gap:9px;width:100%;padding:11px 12px;border:0;border-bottom:1px solid #e7edf4;border-left:3px solid transparent;background:transparent;color:inherit;text-align:left;cursor:pointer}.support-conversation:hover{background:#f1f5f9}.support-conversation.selected{border-left-color:#2563eb;background:#eff6ff}.support-conversation-info{min-width:0;flex:1}.support-conversation-line{display:flex;align-items:center;gap:6px;justify-content:space-between}.support-conversation-line b{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.support-conversation-line time{flex:0 0 auto;color:#94a3b8;font-size:10px}.support-department{display:inline-flex;margin:4px 0;padding:2px 5px;border-radius:4px;background:#dbeafe;color:#1d4ed8;font-size:9px;font-weight:800}.support-preview-text{overflow:hidden;color:#64748b;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.support-unread{flex:0 0 auto;width:8px;height:8px;margin-top:5px;border-radius:50%;background:#ef4444}.support-admin-chat{display:flex;min-width:0;flex-direction:column}.support-admin-chat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid #e2e8f0}.support-admin-profile{display:flex;align-items:center;gap:8px;min-width:0}.support-admin-profile b{display:block;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.support-admin-profile small{display:block;margin-top:3px;color:#64748b;font-size:10px}.support-resolve{height:29px;padding:0 8px;border:1px solid #86efac;border-radius:6px;background:#f0fdf4;color:#15803d;font-size:10.5px;font-weight:800;white-space:nowrap;cursor:pointer}.support-resolve:hover{background:#dcfce7}.support-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.72)}.support-modal img{max-width:min(920px,96vw);max-height:90dvh;border-radius:8px;object-fit:contain}.support-modal button{position:absolute;top:16px;right:16px;width:36px;height:36px;border:0;border-radius:50%;background:#fff;color:#0f172a;font-size:24px;cursor:pointer}@media(max-width:620px){#${widgetId}{right:14px;bottom:14px}.support-window{width:calc(100vw - 28px);height:min(570px,calc(100dvh - 82px))}.support-admin-window{width:calc(100vw - 28px)}.support-admin-body{grid-template-columns:1fr}.support-conversations{max-height:170px;border-right:0;border-bottom:1px solid #e2e8f0}.support-admin-chat-top{min-height:52px}.support-message-row{max-width:92%}}`;
    style.textContent += `#${widgetId} .support-launch-admin{font-size:0}#${widgetId} .support-launch-admin::before{content:'\\1F3A7';display:block;font-size:24px;line-height:1}#${widgetId} .support-launch-employee{padding:4px;background:#fff;border:2px solid #dbeafe;box-shadow:0 12px 28px rgba(37,99,235,.24)}#${widgetId} .support-launch-employee:hover{background:#eff6ff;border-color:#93c5fd}#${widgetId} .support-launch-image{display:block;width:100%;height:100%;object-fit:contain;border-radius:50%}#${widgetId} .support-launch-badge{font-size:10px}`;
    document.head.appendChild(style);
  }

  function mount() {
    ensureStyle();
    let host = document.getElementById(widgetId);
    if (!host) { host = document.createElement('div'); host.id = widgetId; document.body.appendChild(host); }
    return host;
  }

  function tone() {
    try { const Audio = window.AudioContext || window.webkitAudioContext; const context = new Audio(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 720; gain.gain.setValueAtTime(.035, context.currentTime); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .12); } catch { /* Browser may block sound before a user gesture. */ }
  }

  function messageMarkup(message, isAdmin) {
    const outgoing = isAdmin ? message.senderRole === 'ADMIN' : message.senderRole === 'EMPLOYEE';
    const sender = outgoing ? (isAdmin ? 'Bạn' : 'Bạn') : (isAdmin ? state.selected?.requester?.name || 'Nhân viên' : 'Admin');
    const image = message.imageFile ? `<img class="support-image" data-support-image="${esc(message.imageFile)}" alt="Ảnh đính kèm hỗ trợ">` : '';
    return `<div class="support-message-row ${outgoing ? 'outgoing' : ''}"><span class="support-message-avatar">${esc(initials(sender))}</span><div><div class="support-bubble">${esc(message.content || '')}${image}</div><span class="support-time">${esc(date(message.createdAt))}</span></div></div>`;
  }

  function employeeMarkup() {
    const messageRows = state.messages.length ? state.messages.map(message => messageMarkup(message, false)).join('') : '<div class="support-empty">Gửi câu hỏi hoặc ảnh để Admin hỗ trợ bạn.</div>';
    return `<section class="support-window ${state.open ? 'is-open' : ''}" aria-label="Hỗ trợ nội bộ"><header class="support-head"><div class="support-head-main"><span class="support-avatar admin">AD</span><div><b>Hỗ trợ nội bộ</b><small>Đồng bộ tới Telegram Admin</small></div></div><button type="button" class="support-icon-button" data-support-close aria-label="Thu gọn">−</button></header><div class="support-messages" data-support-messages>${messageRows}</div>${composeMarkup()}</section>${launcherMarkup()}`;
  }

  function conversationMarkup(conversation) {
    const selected = conversation.id === state.selectedId;
    return `<button type="button" class="support-conversation ${selected ? 'selected' : ''}" data-support-conversation="${esc(conversation.id)}"><span class="support-avatar">${esc(initials(conversation.requester.name))}</span><span class="support-conversation-info"><span class="support-conversation-line"><b>${esc(conversation.requester.name)}</b><time>${esc(relative(conversation.lastMessageAt))}</time></span><span class="support-department">${esc(conversation.requester.department)}</span><span class="support-preview-text">${esc(conversation.lastMessagePreview || 'Chưa có nội dung')}</span></span>${conversation.unreadCount ? '<span class="support-unread" aria-label="Có tin chưa đọc"></span>' : ''}</button>`;
  }

  function adminMarkup() {
    const selected = state.selected;
    const list = state.conversations.length ? state.conversations.map(conversationMarkup).join('') : '<div class="support-empty">Chưa có yêu cầu hỗ trợ.</div>';
    const chat = selected ? `<div class="support-admin-chat"><div class="support-admin-chat-top"><div class="support-admin-profile"><span class="support-avatar">${esc(initials(selected.requester.name))}</span><div><b>${esc(selected.requester.name)}</b><small>${esc(selected.requester.department)} · Mã NV: ${esc(selected.requester.accountId || '—')}</small></div></div><button type="button" class="support-resolve" data-support-resolve="${esc(selected.id)}">Đánh dấu đã xong</button></div><div class="support-messages" data-support-messages>${state.messages.length ? state.messages.map(message => messageMarkup(message, true)).join('') : '<div class="support-empty">Chưa có tin nhắn.</div>'}</div>${composeMarkup()}</div>` : '<div class="support-empty">Chọn một nhân viên để xem hội thoại.</div>';
    return `<section class="support-window support-admin-window ${state.open ? 'is-open' : ''}" aria-label="Hộp thư hỗ trợ nhân viên"><header class="support-head"><div class="support-head-main"><span class="support-avatar admin">AD</span><div><b>Hộp thư hỗ trợ nhân viên</b><small>${state.conversations.filter(item => item.unreadCount).length} yêu cầu chưa đọc</small></div></div><button type="button" class="support-icon-button" data-support-close aria-label="Thu gọn">−</button></header><div class="support-admin-body"><aside class="support-conversations"><div class="support-list-caption"><span>Danh sách yêu cầu</span><span>${state.conversations.length}</span></div>${list}</aside>${chat}</div></section>${launcherMarkup()}`;
  }

  function launcherMarkup() {
    const unread = state.user?.role === 'ADMIN' ? state.conversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0) : 0;
    const employee = state.user?.role !== 'ADMIN';
    const icon = employee ? '<img class="support-launch-image" src="/assets/livechat-employee.png" alt="" aria-hidden="true">' : '';
    return `<button type="button" class="support-launch ${employee ? 'support-launch-employee' : 'support-launch-admin'}" data-support-toggle aria-label="Mở hỗ trợ nội bộ">${icon}${unread ? `<span class="support-launch-badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>`;
  }

  function composeMarkup() {
    const preview = state.file && state.previewUrl ? `<div class="support-preview"><img src="${esc(state.previewUrl)}" alt="Xem trước ảnh đính kèm"><span>${esc(state.file.name)}</span><button type="button" data-support-clear-image aria-label="Bỏ ảnh">×</button></div>` : '';
    return `<form class="support-compose" data-support-form>${preview}<div class="support-compose-row"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-support-file><button type="button" class="support-attach" data-support-attach aria-label="Đính kèm ảnh" title="Đính kèm ảnh">+</button><textarea data-support-draft maxlength="2000" placeholder="Nhập nội dung gửi Admin...">${esc(state.draft)}</textarea><button type="submit" class="support-send" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Đang gửi' : 'Gửi'}</button></div></form>`;
  }

  async function loadImage(fileName, image) {
    if (imageUrls.has(fileName)) { image.src = imageUrls.get(fileName); return; }
    try {
      const auth = token();
      const response = await fetch(`/api/support/uploads/${encodeURIComponent(fileName)}`, { headers: { Authorization: `Bearer ${auth}` } });
      if (!response.ok) throw Error('Không tải được ảnh');
      const url = URL.createObjectURL(await response.blob());
      imageUrls.set(fileName, url);
      image.src = url;
    } catch { image.alt = 'Không tải được ảnh đính kèm'; }
  }

  function scrollMessages() { const box = document.querySelector(`#${widgetId} [data-support-messages]`); if (box) box.scrollTop = box.scrollHeight; }

  function render() {
    if (!state.user) { document.getElementById(widgetId)?.remove(); return; }
    const host = mount();
    state.selected = state.conversations.find(item => item.id === state.selectedId) || null;
    host.innerHTML = state.user.role === 'ADMIN' ? adminMarkup() : employeeMarkup();
    host.querySelector('[data-support-toggle]')?.addEventListener('click', () => { state.open = !state.open; render(); if (state.open) scrollMessages(); });
    host.querySelectorAll('[data-support-close]').forEach(button => button.addEventListener('click', () => { state.open = false; render(); }));
    host.querySelectorAll('[data-support-conversation]').forEach(button => button.addEventListener('click', async () => { state.selectedId = button.dataset.supportConversation; await refresh(true); }));
    host.querySelector('[data-support-resolve]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await request('/api/support/resolve', { method: 'POST', body: JSON.stringify({ conversationId: event.currentTarget.dataset.supportResolve }) }); await refresh(true); } catch (error) { alert(error.message); event.currentTarget.disabled = false; } });
    const form = host.querySelector('[data-support-form]');
    const fileInput = host.querySelector('[data-support-file]');
    host.querySelector('[data-support-attach]')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', event => selectFile(event.target.files?.[0]));
    host.querySelector('[data-support-clear-image]')?.addEventListener('click', clearFile);
    host.querySelector('[data-support-draft]')?.addEventListener('input', event => { state.draft = event.target.value; });
    form?.addEventListener('submit', send);
    host.querySelectorAll('[data-support-image]').forEach(image => { loadImage(image.dataset.supportImage, image); image.addEventListener('click', () => openImage(image.src)); });
    if (state.open) requestAnimationFrame(scrollMessages);
  }

  function selectFile(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { alert('Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF tối đa 5 MB.'); return; }
    clearFile(); state.file = file; state.previewUrl = URL.createObjectURL(file); render();
  }

  function clearFile() { if (state.previewUrl) URL.revokeObjectURL(state.previewUrl); state.file = null; state.previewUrl = ''; render(); }

  function fileData(file) { return new Promise((resolve, reject) => { if (!file) return resolve(''); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('Không đọc được ảnh đính kèm.')); reader.readAsDataURL(file); }); }

  async function send(event) {
    event.preventDefault();
    if (state.busy || (!state.draft.trim() && !state.file)) return;
    if (state.user.role === 'ADMIN' && !state.selectedId) return;
    state.busy = true; render();
    try {
      await request('/api/support/messages', { method: 'POST', body: JSON.stringify({ conversationId: state.user.role === 'ADMIN' ? state.selectedId : '', content: state.draft.trim(), imageData: await fileData(state.file) }) });
      state.draft = ''; if (state.previewUrl) URL.revokeObjectURL(state.previewUrl); state.file = null; state.previewUrl = '';
      await refresh(true);
    } catch (error) { alert(error.message); }
    finally { state.busy = false; render(); }
  }

  function openImage(src) { if (!src || src === location.href) return; const modal = document.createElement('div'); modal.className = 'support-modal'; modal.innerHTML = `<img src="${esc(src)}" alt="Ảnh đính kèm phóng to"><button type="button" aria-label="Đóng">×</button>`; modal.addEventListener('click', event => { if (event.target === modal || event.target.tagName === 'BUTTON') modal.remove(); }); document.body.appendChild(modal); }

  function stopRealtime() {
    if (state.streamRetry) { clearTimeout(state.streamRetry); state.streamRetry = null; }
    if (state.streamController) { state.streamController.abort(); state.streamController = null; }
  }

  function startRealtime() {
    if (state.streamController || !state.user || !window.fetch || !window.TextDecoder) return;
    const auth = token();
    if (!auth) return;
    const controller = new AbortController();
    state.streamController = controller;
    (async () => {
      try {
        const response = await fetch('/api/support/stream', { headers: { Authorization: `Bearer ${auth}`, Accept: 'text/event-stream' }, signal: controller.signal });
        if (!response.ok || !response.body) throw Object.assign(new Error('SSE unavailable'), { status: response.status });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const next = await reader.read();
          if (next.done) break;
          buffer += decoder.decode(next.value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            if (event.startsWith('data:')) refresh(true);
          }
        }
      } catch { /* Polling remains active when a proxy does not keep SSE open. */ }
      finally {
        if (state.streamController === controller) state.streamController = null;
        if (state.user && token()) state.streamRetry = setTimeout(startRealtime, 3000);
      }
    })();
  }

  async function refresh(force = false) {
    const auth = token();
    if (!auth) { state.user = null; stopRealtime(); render(); return; }
    try {
      if (!state.user) {
        state.user = (await request('/api/auth/me')).user;
        render();
      }
      startRealtime();
      const { conversations } = await request('/api/support/conversations');
      state.conversations = conversations || [];
      if (state.user.role === 'ADMIN' && !state.selectedId && state.conversations.length) state.selectedId = state.conversations[0].id;
      const messagePath = state.user.role === 'ADMIN' && state.selectedId ? `/api/support/messages?conversationId=${encodeURIComponent(state.selectedId)}` : '/api/support/messages';
      const result = await request(messagePath);
      state.messages = result.messages || [];
      const incoming = state.user.role === 'ADMIN' ? state.conversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0) : state.messages.filter(item => item.senderRole === 'ADMIN').length;
      if (state.initialized && incoming > state.lastIncoming) tone();
      state.lastIncoming = incoming; state.initialized = true;
      const fingerprint = JSON.stringify({ user: state.user.id, open: state.open, selected: state.selectedId, conversations: state.conversations.map(item => [item.id, item.status, item.lastMessageAt, item.unreadCount]), messages: state.messages.map(item => [item.id, item.content, item.imageFile]) });
      if (force || fingerprint !== state.fingerprint) { state.fingerprint = fingerprint; render(); }
    } catch (error) {
      if (error.status === 401) { state.user = null; stopRealtime(); render(); }
      else if (state.user) render();
    }
  }

  window.setInterval(() => refresh(false), 5000);
  window.addEventListener('beforeunload', () => { stopRealtime(); imageUrls.forEach(url => URL.revokeObjectURL(url)); });
  refresh(true);
})();
