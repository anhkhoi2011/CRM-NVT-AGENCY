'use strict';

/**
 * Module: telegram-bot.cjs
 * Hệ thống Bot Telegram NVT Agency (@HeThongCRMNVT_BOT)
 * Xử lý: Liên kết tài khoản, thông báo data mới realtime, nhận data 1 chạm,
 * nhắc lịch hẹn khách hàng, cảnh báo data nóng 12h, nhắc điểm danh 09h00.
 */

const { pool, dbQuery } = require('./db.js');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8801097357:AAF3JB-nAlBJvNknI8AMiPgcOEv73sFd6mY';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ==================== CÁC HÀM GỌI TELEGRAM BOT API ====================

async function callTelegram(method, body = {}) {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[Telegram Bot] API call ${method} warning:`, data.description || data);
    }
    return data;
  } catch (err) {
    console.error(`[Telegram Bot] Fetch error on ${method}:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function sendMessage(chatId, text, options = {}) {
  if (!chatId) return null;
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    reply_markup: options.reply_markup || undefined,
    disable_web_page_preview: options.disable_web_page_preview !== false
  });
}

async function editMessageText(chatId, messageId, text, options = {}) {
  if (!chatId || !messageId) return null;
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    reply_markup: options.reply_markup || undefined,
    disable_web_page_preview: options.disable_web_page_preview !== false
  });
}

async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  if (!callbackQueryId) return null;
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert
  });
}

async function setWebhook(webhookUrl, secretToken = '') {
  const body = { url: webhookUrl };
  if (secretToken) body.secret_token = secretToken;
  const res = await callTelegram('setWebhook', body);
  console.log('[Telegram Bot] Webhook setup result:', res);
  return res;
}

// ==================== TIỆN ÍCH ĐỊNH DẠNG ====================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' ₫';
}

function formatDateTimeVN(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt);
    return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  } catch {
    return String(dt);
  }
}

// ==================== XỬ LÝ INCOMING WEBHOOK (UPDATES) ====================

async function handleTelegramUpdate(update) {
  if (!update || typeof update !== 'object') return { ok: true };

  // 1. Xử lý Message từ người dùng
  if (update.message) {
    await handleIncomingMessage(update.message);
  }
  // 2. Xử lý Callback Query từ nút bấm Inline Keyboard
  else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }

  return { ok: true };
}

async function handleIncomingMessage(msg) {
  const chatId = msg.chat?.id;
  if (!chatId) return;

  const rawText = String(msg.text || '').trim();
  const fromUsername = msg.from?.username || '';

  // Lệnh /start
  if (rawText.startsWith('/start')) {
    // Kiểm tra xem chat_id này đã liên kết tài khoản nào chưa
    const existing = await dbQuery('SELECT id, name, role, phone, email, team_id FROM users WHERE telegram_chat_id = ? AND active = 1 LIMIT 1', [String(chatId)]);
    if (existing && existing.length > 0) {
      const u = existing[0];
      const text = `👋 <b>Xin chào ${escapeHtml(u.name)}!</b>\n` +
        `Tài khoản CRM của bạn đã được kết nối thành công.\n` +
        `• <b>Chức vụ:</b> ${escapeHtml(u.role)}\n` +
        `• <b>SĐT:</b> <code>${escapeHtml(u.phone)}</code>\n` +
        `• <b>Team:</b> ${escapeHtml(u.team_id || 'Chưa gán')}\n\n` +
        `Gõ <b>/me</b> để xem chi tiết hoặc <b>/help</b> để xem các tính năng hỗ trợ.`;
      await sendMessage(chatId, text);
      return;
    }

    const welcome = `🤖 <b>CHÀO MỪNG BẠN ĐẾN VỚI BOT CRM NVT AGENCY!</b>\n\n` +
      `Hệ thống sẽ gửi thông báo <b>Data mới Realtime</b>, nhắc nhở <b>Lịch hẹn khách hàng</b> và điểm danh trực tiếp qua đây.\n\n` +
      `👉 <b>Vui lòng nhập Số điện thoại hoặc Email</b> đăng ký trên CRM của bạn để hoàn tất liên kết:`;
    await sendMessage(chatId, welcome);
    return;
  }

  // Lệnh /me
  if (rawText === '/me') {
    const rows = await dbQuery('SELECT id, account_code, name, role, phone, email, team_id FROM users WHERE telegram_chat_id = ? AND active = 1 LIMIT 1', [String(chatId)]);
    if (!rows || rows.length === 0) {
      await sendMessage(chatId, `⚠️ Bạn chưa liên kết tài khoản. Vui lòng nhập Số điện thoại hoặc Email để liên kết.`);
      return;
    }
    const u = rows[0];
    const text = `👤 <b>THÔNG TIN TÀI KHOẢN LIÊN KẾT:</b>\n\n` +
      `• <b>Họ tên:</b> ${escapeHtml(u.name)}\n` +
      `• <b>Chức vụ:</b> <code>${escapeHtml(u.role)}</code>\n` +
      `• <b>Số điện thoại:</b> <code>${escapeHtml(u.phone)}</code>\n` +
      `• <b>Email:</b> ${escapeHtml(u.email || '—')}\n` +
      `• <b>Team:</b> ${escapeHtml(u.team_id || '—')}\n` +
      `• <b>Telegram Chat ID:</b> <code>${chatId}</code>\n\n` +
      `<i>Gõ /huylienket nếu bạn muốn chuyển sang tài khoản khác.</i>`;
    await sendMessage(chatId, text);
    return;
  }

  // Lệnh /huylienket
  if (rawText === '/huylienket') {
    await dbQuery('UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL WHERE telegram_chat_id = ?', [String(chatId)]);
    await sendMessage(chatId, `✅ <b>ĐÃ HỦY LIÊN KẾT TÀI KHOẢN THÀNH CÔNG!</b>\nBạn có thể gõ <b>/start</b> để liên kết với tài khoản nhân sự khác.`);
    return;
  }

  // Lệnh /help
  if (rawText === '/help') {
    const helpText = `📖 <b>HƯỚNG DẪN SỬ DỤNG BOT CRM NVT AGENCY:</b>\n\n` +
      `1. <b>Nhận Data nóng:</b> Khi có khách hàng điền form, bot sẽ gửi thông báo và nút <i>[📥 BẤM NHẬN DATA & XỬ LÝ]</i>. Bấm 1 chạm để nhận và hiện SĐT liên hệ ngay.\n` +
      `2. <b>Điểm danh:</b> Đúng 09:00 hàng ngày, bot gửi tin nhắn kèm nút điểm danh nhanh.\n` +
      `3. <b>Nhắc lịch hẹn:</b> Tự động nhắc trước 15-30 phút khi đến lịch hẹn chốt cọc / tư vấn 1-1.\n` +
      `4. <b>Cảnh báo Data nóng:</b> Nhắc nhở nếu data nhận quá 12h chưa được chăm sóc.\n\n` +
      `<b>Các lệnh quản lý:</b>\n` +
      `• /start - Bắt đầu / Liên kết tài khoản\n` +
      `• /me - Xem thông tin tài khoản đang liên kết\n` +
      `• /huylienket - Hủy liên kết để đăng nhập máy mới\n` +
      `• /help - Xem hướng dẫn này`;
    await sendMessage(chatId, helpText);
    return;
  }

  // Nếu người dùng nhập thông tin để liên kết (SĐT hoặc Email hoặc Account Code)
  const identifier = rawText.replace(/\s+/g, '');
  const cleanPhone = identifier.replace(/\D/g, '');
  const cleanEmail = identifier.toLowerCase();

  const userMatch = await dbQuery(
    `SELECT * FROM users WHERE (phone = ? OR phone = ? OR LOWER(email) = ? OR UPPER(account_code) = ? OR id = ?) AND active = 1 LIMIT 1`,
    [identifier, cleanPhone, cleanEmail, identifier.toUpperCase(), identifier]
  );

  if (!userMatch || userMatch.length === 0) {
    await sendMessage(chatId, `❌ <b>Không tìm thấy tài khoản</b> với thông tin: <code>${escapeHtml(rawText)}</code>\n\nVui lòng kiểm tra lại Số điện thoại hoặc Email bạn đã đăng ký trên CRM, hoặc liên hệ Admin để được cấp quyền.`);
    return;
  }

  const user = userMatch[0];
  if (user.role === 'UNASSIGNED') {
    await sendMessage(chatId, `⚠️ Tài khoản <b>${escapeHtml(user.name)}</b> đã đăng ký nhưng đang chờ Admin phân quyền chức vụ trước khi có thể kích hoạt Bot.`);
    return;
  }

  // Cập nhật telegram_chat_id và telegram_username
  await dbQuery(
    `UPDATE users SET telegram_chat_id = ?, telegram_username = ? WHERE id = ?`,
    [String(chatId), fromUsername || null, user.id]
  );

  const successText = `🎉 <b>XÁC THỰC THÀNH CÔNG!</b>\n\n` +
    `Xin chào <b>${escapeHtml(user.name)}</b>!\n` +
    `• <b>Chức vụ:</b> ${escapeHtml(user.role)}\n` +
    `• <b>Team:</b> ${escapeHtml(user.team_id || 'Chưa gán')}\n` +
    `• <b>SĐT:</b> <code>${escapeHtml(user.phone)}</code>\n\n` +
    `✅ Bạn đã kết nối thành công với <b>CRM NVT Agency</b>.\n` +
    `Từ bây giờ mọi thông báo Data mới, nhắc lịch hẹn và điểm danh sẽ được gửi trực tiếp đến đây! 🚀`;
  await sendMessage(chatId, successText);
}

// ==================== XỬ LÝ NÚT BẤM INLINE (CALLBACK QUERIES) ====================

async function acceptDataFromTelegram(chatId, callbackData) {
  const userRows = await dbQuery('SELECT * FROM users WHERE telegram_chat_id = ? AND active = 1 LIMIT 1', [String(chatId)]);
  if (!userRows?.length) throw new Error('Tài khoản Telegram này chưa liên kết CRM. Gõ /start để liên kết.');
  const user = userRows[0];
  if (String(user.role || '').toUpperCase() !== 'SALE') throw new Error('Chức năng nhận data chỉ dành cho Sale được phân công.');

  const payload = String(callbackData || '').slice('accept_data:'.length);
  const [customerId, requestedOfferId = ''] = payload.split(':', 2);
  if (!customerId) throw new Error('Nút nhận data không hợp lệ. Vui lòng mở thông báo mới nhất.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [customerRows] = await connection.execute('SELECT * FROM customers WHERE id = ? LIMIT 1 FOR UPDATE', [customerId]);
    if (!customerRows?.length) throw new Error('Khách hàng không còn tồn tại.');
    const customer = customerRows[0];

    const [offerRows] = await connection.execute(
      `SELECT id, body FROM crm_documents
       WHERE collection = 'dataOffers' AND (deleted = 0 OR deleted IS NULL)
         AND JSON_UNQUOTE(JSON_EXTRACT(body, '$.customerId')) = ?
       FOR UPDATE`,
      [customerId]
    );
    const offers = offerRows.map(row => {
      try { return { id: row.id, body: typeof row.body === 'string' ? JSON.parse(row.body) : row.body }; }
      catch { return null; }
    }).filter(Boolean);
    const offer = offers.find(item =>
      (!requestedOfferId || item.id === requestedOfferId || item.body?.id === requestedOfferId)
      && item.body?.status === 'PENDING'
      && item.body?.saleId === user.id
    );

    if (!offer) {
      if (customer.sale_id === user.id && customer.sale_accepted_at) throw new Error('Data này đã được bạn nhận trước đó.');
      if (customer.sale_id && customer.sale_id !== user.id) throw new Error('Data này đã được Sale khác nhận.');
      throw new Error('Data này không còn chờ bạn nhận hoặc đã hết hạn.');
    }

    const nowStamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 19);
    const [updated] = await connection.execute(
      `UPDATE customers
       SET sale_id = ?, leader_id = COALESCE(leader_id, ?), team_id = COALESCE(team_id, ?), sale_accepted_at = ?, updated_at = ?
       WHERE id = ? AND (sale_id IS NULL OR sale_id = ?)`,
      [user.id, user.leader_id || offer.body.leaderId || user.id, user.team_id || offer.body.teamId || '', nowStamp, nowStamp, customerId, user.id]
    );
    if (updated.affectedRows !== 1) throw new Error('Data này vừa được người khác nhận.');

    const acceptedOffer = { ...offer.body, status: 'ACCEPTED', saleId: user.id, resolvedAt: nowStamp };
    await connection.execute(
      `UPDATE crm_documents SET body = ? WHERE collection = 'dataOffers' AND id = ?`,
      [JSON.stringify(acceptedOffer), offer.id]
    );
    await connection.commit();
    console.info('[Telegram Bot] Data accepted:', customerId, 'by', user.id);
    return { customer, user, nowStamp };
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
}

async function handleCallbackQuery(query) {
  const queryId = query.id;
  const data = String(query.data || '');
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;

  if (!data.startsWith('accept_data:')) return handleCallbackQueryLegacy(query);
  if (!chatId || !messageId) {
    await answerCallbackQuery(queryId);
    return;
  }

  // Stop the Telegram button spinner before the database transaction begins.
  await answerCallbackQuery(queryId, 'Đang nhận data...');
  try {
    const { customer, user, nowStamp } = await acceptDataFromTelegram(chatId, data);
    const updatedText = `✅ <b>ĐÃ TIẾP NHẬN DATA THÀNH CÔNG!</b>\n\n` +
      `• <b>Khách hàng:</b> ${escapeHtml(customer.name)}\n` +
      `• 📞 <b>Số điện thoại:</b> <code>${escapeHtml(customer.phone)}</code> (Bấm để gọi)\n` +
      `• <b>Nguồn:</b> ${escapeHtml(customer.source || 'Landing Page')}\n` +
      `• <b>Thời điểm tiếp nhận:</b> ${formatDateTimeVN(nowStamp)}\n` +
      `• 👤 <b>Sale phụ trách:</b> ${escapeHtml(user.name)}\n\n` +
      `👉 <i>Vui lòng chủ động gọi điện tư vấn khách hàng ngay!</i> 🚀`;
    const edited = await editMessageText(chatId, messageId, updatedText, { reply_markup: { inline_keyboard: [] } });
    if (!edited?.ok) await sendMessage(chatId, updatedText);
  } catch (err) {
    console.error('[Telegram Bot] accept data callback error:', err.message);
    await sendMessage(chatId, `⚠️ <b>Chưa nhận được data</b>\n${escapeHtml(err.message || 'Hệ thống đang bận. Vui lòng bấm lại sau ít phút.')}`);
  }
}

async function handleCallbackQueryLegacy(query) {
  const queryId = query.id;
  const data = String(query.data || '');
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;

  if (!chatId || !messageId) {
    await answerCallbackQuery(queryId);
    return;
  }

  // Tìm người dùng từ telegram_chat_id
  const userRows = await dbQuery('SELECT * FROM users WHERE telegram_chat_id = ? AND active = 1 LIMIT 1', [String(chatId)]);
  if (!userRows || userRows.length === 0) {
    await answerCallbackQuery(queryId, 'Bạn chưa liên kết tài khoản CRM! Gõ /start để kết nối.', true);
    return;
  }
  const user = userRows[0];

  // 1. Thao tác: Bấm nhận Data [accept_data:<customerId>]
  if (data.startsWith('accept_data:')) {
    const customerId = data.slice('accept_data:'.length);
    const customers = await dbQuery('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId]);
    if (!customers || customers.length === 0) {
      await answerCallbackQuery(queryId, 'Khách hàng không tồn tại hoặc đã bị xóa!', true);
      return;
    }
    const customer = customers[0];

    // Kiểm tra xem data đã có ai nhận chưa
    if (customer.sale_id && customer.sale_id !== user.id) {
      const currentSale = (await dbQuery('SELECT name FROM users WHERE id = ? LIMIT 1', [customer.sale_id]))[0];
      await answerCallbackQuery(queryId, `Data này đã được nhận bởi ${currentSale?.name || 'Sale khác'}!`, true);
      return;
    }

    // Gán quyền Sale nhận data
    const nowStamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 19);
    await dbQuery(
      `UPDATE customers SET sale_id = ?, leader_id = COALESCE(leader_id, ?), team_id = COALESCE(team_id, ?), sale_accepted_at = ?, updated_at = ? WHERE id = ?`,
      [user.id, user.leader_id || user.id, user.team_id || '', nowStamp, nowStamp, customerId]
    );

    // Cập nhật trạng thái offer nếu có trong crm_documents
    try {
      const [offerDocs] = await pool.query(`SELECT id, body FROM crm_documents WHERE collection = 'dataOffers' AND JSON_EXTRACT(body, '$.customerId') = ?`, [customerId]);
      for (const d of offerDocs) {
        const body = typeof d.body === 'string' ? JSON.parse(d.body) : d.body;
        if (body.status === 'PENDING') {
          body.status = 'ACCEPTED';
          body.saleId = user.id;
          body.resolvedAt = nowStamp;
          await pool.execute(`UPDATE crm_documents SET body = ? WHERE collection = 'dataOffers' AND id = ?`, [JSON.stringify(body), d.id]);
        }
      }
    } catch (e) {
      console.warn('[Telegram Bot] Update dataOffers doc notice:', e.message);
    }

    // Cập nhật lại tin nhắn Telegram hiển thị SĐT để Sale gọi luôn
    const updatedText = `✅ <b>ĐÃ TIẾP NHẬN DATA THÀNH CÔNG!</b>\n\n` +
      `• <b>Khách hàng:</b> ${escapeHtml(customer.name)}\n` +
      `• 📞 <b>Số điện thoại:</b> <code>${escapeHtml(customer.phone)}</code> (Bấm để gọi)\n` +
      `• <b>Nguồn:</b> ${escapeHtml(customer.source || 'Landing Page')}\n` +
      `• <b>Thời điểm tiếp nhận:</b> ${formatDateTimeVN(nowStamp)}\n` +
      `• 👤 <b>Sale phụ trách:</b> ${escapeHtml(user.name)}\n\n` +
      `👉 <i>Vui lòng chủ động gọi điện tư vấn khách hàng ngay!</i> 🚀`;

    await editMessageText(chatId, messageId, updatedText, {
      reply_markup: { inline_keyboard: [] } // Xóa nút bấm sau khi nhận
    });

    await answerCallbackQuery(queryId, 'Đã nhận data thành công! Hãy liên hệ khách hàng ngay.');
    return;
  }

  // 2. Thao tác: Bấm điểm danh [checkin]
  if (data === 'checkin') {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const nowTime = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const checkinId = `ATT-${today}-${user.id}`;

    try {
      // Lưu vào bảng staff_attendance nếu có
      await pool.execute(
        `INSERT INTO staff_attendance (id, user_id, attendance_date, check_in_time, status)
         VALUES (?, ?, ?, NOW(), 'CHECKED_IN')
         ON DUPLICATE KEY UPDATE check_in_time = check_in_time`,
        [checkinId, user.id, today]
      );
    } catch {
      // Fallback lưu vào crm_documents nếu bảng riêng chưa migrate
      try {
        const attDoc = { id: checkinId, accountId: user.id, accountName: user.name, date: today, time: nowTime, status: 'ON_TIME' };
        await pool.execute(
          `INSERT INTO crm_documents (collection, id, body, deleted) VALUES ('attendance', ?, ?, 0)
           ON DUPLICATE KEY UPDATE body = VALUES(body), deleted = 0`,
          [checkinId, JSON.stringify(attDoc)]
        );
      } catch (err) {
        console.warn('[Telegram Bot] Attendance doc notice:', err.message);
      }
    }

    // Cập nhật tin nhắn (KHÔNG hiển thị trễ hay đúng giờ phía Sale như yêu cầu nghiệp vụ)
    const confirmedText = `✅ <b>Bạn đã điểm danh thành công lúc ${nowTime}!</b>\n` +
      `Chúc ${escapeHtml(user.name)} ngày mới tràn đầy năng lượng và bão số chốt đơn! 🚀`;

    await editMessageText(chatId, messageId, confirmedText, {
      reply_markup: { inline_keyboard: [] }
    });

    await answerCallbackQuery(queryId, 'Điểm danh thành công!');
    return;
  }

  await answerCallbackQuery(queryId);
}

// ==================== CÁC HÀM BẮN THÔNG BÁO TỰ ĐỘNG ====================

/**
 * Tính năng 2 & 8: Bắn thông báo Data mới Realtime
 */
async function notifyNewLead(customer, offer = null) {
  try {
    let targetChatIds = [];

    // Nếu đã có Sale cụ thể được gán hoặc trong offer
    const targetSaleId = offer?.saleId || offer?.sale_id || customer.sale_id || customer.saleId;
    if (targetSaleId) {
      const sales = await dbQuery("SELECT telegram_chat_id FROM users WHERE id = ? AND role = 'SALE' AND active = 1 AND telegram_chat_id IS NOT NULL", [targetSaleId]);
      if (sales[0]?.telegram_chat_id) targetChatIds.push(sales[0].telegram_chat_id);
    }

    // Nếu chưa có Sale hoặc cần báo thêm Leader
    if (!targetSaleId) return;

    targetChatIds = [...new Set(targetChatIds.filter(Boolean))];
    if (targetChatIds.length === 0) return;

    // Kiểm tra xem data có quan tâm khóa học / chỉ báo không
    const noteOrCampaign = `${customer.note || ''} ${customer.campaign || ''} ${customer.source || ''}`.toLowerCase();
    const isTradingCourse = noteOrCampaign.includes('khóa học') || noteOrCampaign.includes('khoa hoc') || noteOrCampaign.includes('chỉ báo') || noteOrCampaign.includes('chi bao') || noteOrCampaign.includes('indicator') || noteOrCampaign.includes('rsi');

    let title = isTradingCourse ? `🎓 <b>KHÁCH QUAN TÂM KHÓA HỌC &amp; CHỈ BÁO TRADING!</b>` : `🔥 <b>CÓ DATA KHÁCH HÀNG MỚI!</b>`;
    let msgText = `${title}\n\n` +
      `• <b>Khách hàng:</b> ${escapeHtml(customer.name)}\n` +
      `• <b>Nguồn Form:</b> ${escapeHtml(customer.landingPageName || customer.source || 'Landing Page')}\n` +
      (customer.campaign ? `• <b>Chiến dịch:</b> ${escapeHtml(customer.campaign)}\n` : '') +
      (customer.note ? `• <b>Nhu cầu / Ghi chú:</b> <i>${escapeHtml(customer.note)}</i>\n` : '') +
      `• <b>Thời gian:</b> ${formatDateTimeVN(customer.created_at || customer.createdAt || new Date())}\n\n` +
      `👉 <i>Bấm nút bên dưới để nhận data và bắt đầu tư vấn ngay:</i>`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '📥 BẤM NHẬN DATA & XỬ LÝ', callback_data: `accept_data:${customer.id}` }]
      ]
    };

    for (const chatId of targetChatIds) {
      await sendMessage(chatId, msgText, { reply_markup: inlineKeyboard });
    }
  } catch (err) {
    console.error('[Telegram Bot] notifyNewLead error:', err.message);
  }
}

/**
 * Gửi thông báo riêng khi data được phân lại cho một Sale mới.
 * Chỉ gửi đến Sale trong offer hiện tại, không gửi lại cho Sale cũ hoặc Leader.
 */
async function notifyReassignedLead(customer, offer = null) {
  try {
    const targetSaleId = customer?.sale_id || customer?.saleId || offer?.saleId || offer?.sale_id;
    if (!targetSaleId || !offer || offer.status !== 'PENDING') {
      return { ok: false, skipped: true, reason: 'missing-target' };
    }

    const rows = await dbQuery(
      "SELECT id, name, telegram_chat_id FROM users WHERE id = ? AND role = 'SALE' AND active = 1 AND telegram_chat_id IS NOT NULL LIMIT 1",
      [targetSaleId]
    );
    const sale = rows?.[0];
    if (!sale?.telegram_chat_id) {
      return { ok: false, skipped: true, reason: 'missing-chat-id' };
    }

    const source = customer.landingPageName || customer.landing_page_name || customer.source || 'Chưa gắn nguồn';
    const offeredAt = offer.offeredAt || offer.offered_at || customer.updated_at || customer.updatedAt || new Date();
    const text = `🔄 <b>DATA ĐƯỢC PHÂN LẠI CHO BẠN</b>\n\n` +
      `• <b>Khách hàng:</b> ${escapeHtml(customer.name || 'Khách hàng mới')}\n` +
      `• <b>Nguồn Form:</b> ${escapeHtml(source)}\n` +
      `• <b>Thời gian phân:</b> ${escapeHtml(formatDateTimeVN(offeredAt))}\n` +
      `• <b>Trạng thái:</b> <i>Đang chờ bạn nhận data</i>\n\n` +
      `👉 Vui lòng bấm nút bên dưới để nhận data và bắt đầu tư vấn.`;

    const result = await sendMessage(String(sale.telegram_chat_id), text, {
      reply_markup: {
        inline_keyboard: [[{
          text: '📥 NHẬN DATA & XỬ LÝ',
          callback_data: `accept_data:${customer.id}`
        }]]
      }
    });
    return { ok: Boolean(result?.ok), chatId: String(sale.telegram_chat_id) };
  } catch (err) {
    console.error('[Telegram Bot] notifyReassignedLead error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Tính năng 10: Nhắc lịch hẹn khách hàng sắp diễn ra (15-30 phút trước)
 */
async function notifyAppointmentReminder(appointment, customer, sale) {
  try {
    if (!sale?.telegram_chat_id) return;

    const typeLabels = {
      DEPOSIT: 'Chốt cọc / Deposit',
      CONSULTING: 'Tư vấn chuyên sâu 1-1',
      PAYMENT: 'Hẹn thanh toán',
      COURSE: 'Tư vấn Khóa học',
      OTHER: 'Cuộc hẹn quan trọng'
    };
    const label = typeLabels[appointment.type] || appointment.type || 'Lịch hẹn';

    const text = `⏰ <b>NHẮC HẸN KHÁCH HÀNG SẮP DIỄN RA!</b>\n\n` +
      `• <b>Khách hàng:</b> ${escapeHtml(customer.name)} - <code>${escapeHtml(customer.phone)}</code>\n` +
      `• <b>Mục đích hẹn:</b> 🎯 <b>${label}</b>\n` +
      `• <b>Thời gian hẹn:</b> ⏰ <b>${formatDateTimeVN(appointment.appointment_time)}</b>\n` +
      `• <b>Sale phụ trách:</b> ${escapeHtml(sale.name)}\n` +
      (appointment.note ? `• <b>Ghi chú:</b> <i>${escapeHtml(appointment.note)}</i>\n\n` : '\n') +
      `👉 <i>Vui lòng chuẩn bị tài liệu và chủ động liên hệ đúng giờ để chốt giao dịch thành công!</i> 🚀`;

    await sendMessage(sale.telegram_chat_id, text);
  } catch (err) {
    console.error('[Telegram Bot] notifyAppointmentReminder error:', err.message);
  }
}

/**
 * Tính năng 3: Cảnh báo Data nóng chưa xử lý quá 12 tiếng
 */
async function notifyStaleLeadWarning(customer, sale, leader) {
  try {
    const chatIds = [sale?.telegram_chat_id, leader?.telegram_chat_id].filter(Boolean);
    if (chatIds.length === 0) return;

    const text = `🚨 <b>CẢNH BÁO: DATA NÓNG CHƯA XỬ LÝ QUÁ 12 TIẾNG!</b>\n\n` +
      `• <b>Khách hàng:</b> ${escapeHtml(customer.name)} - <code>${escapeHtml(customer.phone)}</code>\n` +
      `• <b>Sale phụ trách:</b> ${escapeHtml(sale?.name || 'Chưa gán')}\n` +
      `• <b>Thời điểm nhận:</b> ${formatDateTimeVN(customer.sale_accepted_at)}\n` +
      `• <b>Tình trạng:</b> Chưa cập nhật tiến độ / ghi chú sau 12 giờ!\n\n` +
      `⚠️ <i>Yêu cầu kiểm tra và liên hệ xử lý ngay để tránh nguội data!</i>`;

    for (const cid of chatIds) {
      await sendMessage(cid, text);
    }
  } catch (err) {
    console.error('[Telegram Bot] notifyStaleLeadWarning error:', err.message);
  }
}

/**
 * Tính năng 1: Gửi thông báo Điểm danh đầu ngày (09h00)
 */
async function sendMorningCheckinAlert() {
  try {
    const staff = await dbQuery(`SELECT telegram_chat_id, name FROM users WHERE role IN ('SALE', 'LEADER') AND active = 1 AND telegram_chat_id IS NOT NULL`);
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '✅ BẤM ĐIỂM DANH NGAY', callback_data: 'checkin' }]
      ]
    };

    for (const member of staff) {
      const msg = `⏰ <b>THÔNG BÁO ĐIỂM DANH ĐẦU NGÀY (09:00 - 09:15)</b>\n\n` +
        `Chào buổi sáng <b>${escapeHtml(member.name)}</b>! Chúc bạn ngày mới bùng nổ doanh số.\n` +
        `Vui lòng bấm nút bên dưới để hoàn tất điểm danh ca làm việc hôm nay:`;
      await sendMessage(member.telegram_chat_id, msg, { reply_markup: inlineKeyboard });
    }
  } catch (err) {
    console.error('[Telegram Bot] sendMorningCheckinAlert error:', err.message);
  }
}

/**
 * Tính năng 4 & 5: Admin phát thông báo cuộc họp, quy trình, thưởng nóng, động viên
 */
async function sendBroadcastAnnouncement(announcement) {
  try {
    let roleFilter = '';
    if (announcement.target === 'SALE') {
      roleFilter = ` AND role = 'SALE'`;
    } else if (announcement.target === 'MANAGERS') {
      roleFilter = ` AND role IN ('ADMIN', 'MANAGER', 'LEADER')`;
    }

    const staff = await dbQuery(`SELECT telegram_chat_id FROM users WHERE active = 1 AND telegram_chat_id IS NOT NULL${roleFilter}`);
    const chatIds = staff.map(s => s.telegram_chat_id).filter(Boolean);
    if (chatIds.length === 0) return 0;

    let header = '📢 <b>THÔNG BÁO TỪ BAN QUẢN TRỊ NVT AGENCY</b>';
    if (announcement.type === 'MEETING') header = '📢 <b>THÔNG BÁO LỊCH HỌP AGENCY</b>';
    else if (announcement.type === 'POLICY') header = '📋 <b>CẬP NHẬT QUY TRÌNH LÀM VIỆC MỚI</b>';
    else if (announcement.type === 'REWARD') header = '🎁 <b>CHÍNH SÁCH THƯỞNG NÓNG & VINH DANH</b>';
    else if (announcement.type === 'WARNING') header = '⚠️ <b>CẢNH BÁO TIẾN ĐỘ & XỬ LÝ DATA</b>';
    else if (announcement.type === 'MOTIVATION') header = '🔥 <b>THÔNG ĐIỆP ĐỘNG VIÊN & MỤC TIÊU</b>';

    const targetLabel = announcement.target === 'SALE' ? 'Đội ngũ Sales / Tư vấn' :
      announcement.target === 'MANAGERS' ? 'Leader & Quản lý' : 'Toàn thể Agency';

    const remindMinutes = Number(announcement.remind_minutes ?? 15);

    let text = `${header}\n\n` +
      `• <b>Tiêu đề:</b> 🎯 <b>${escapeHtml(announcement.title || '')}</b>\n` +
      `• <b>Gửi tới:</b> 👥 <b>${escapeHtml(targetLabel)}</b>\n` +
      (announcement.meeting_time ? `• <b>Thời gian:</b> ⏰ <b>${formatDateTimeVN(announcement.meeting_time)}</b>\n` : '') +
      (announcement.meeting_link ? `• <b>Địa điểm / Link:</b> 📍 <a href="${escapeHtml(announcement.meeting_link)}">${escapeHtml(announcement.meeting_link)}</a>\n` : '') +
      (announcement.type === 'MEETING' && remindMinutes > 0 ? `• <b>Nhắc lại:</b> 🔔 Tự động nhắc trước ${remindMinutes} phút\n` : '') +
      (announcement.effective_date ? `• <b>Ngày áp dụng:</b> 📅 ${formatDateTimeVN(announcement.effective_date)}\n` : '') +
      `• <b>Người gửi:</b> ✍️ ${escapeHtml(announcement.host || 'Ban Quản Trị')}\n\n` +
      `📝 <b>Nội dung chi tiết:</b>\n${escapeHtml(announcement.content || '')}\n\n` +
      `👉 <i>Thông báo tự động phát từ hệ thống CRM NVT Agency!</i>`;

    let sent = 0;
    for (const cid of chatIds) {
      const res = await sendMessage(cid, text);
      if (res?.ok) sent++;
    }

    // Nếu là cuộc họp có bật nhắc lại, lưu vào bảng để scheduler quét nhắc trước giờ họp
    if (announcement.type === 'MEETING' && announcement.meeting_time && remindMinutes > 0) {
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS meeting_broadcasts (
          id VARCHAR(96) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          meeting_time DATETIME NOT NULL,
          meeting_link VARCHAR(255),
          host VARCHAR(100),
          target VARCHAR(50) DEFAULT 'ALL',
          remind_minutes INT DEFAULT 15,
          reminded_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        const meetingId = 'mb_' + Date.now();
        await pool.execute(
          `INSERT INTO meeting_broadcasts (id, title, meeting_time, meeting_link, host, target, remind_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [meetingId, announcement.title || 'Cuộc họp', announcement.meeting_time, announcement.meeting_link || '', announcement.host || 'Ban Quản Trị', announcement.target || 'ALL', remindMinutes]
        );
      } catch (err) {
        console.warn('[Telegram Bot] Lưu lịch nhắc cuộc họp thất bại:', err.message);
      }
    }

    return sent;
  } catch (err) {
    console.error('[Telegram Bot] sendBroadcastAnnouncement error:', err.message);
    return 0;
  }
}

/**
 * Tính năng 7: Gửi Báo cáo kinh doanh tuần (Tối Chủ Nhật)
 */
async function sendWeeklyReport() {
  try {
    const managers = await dbQuery(`SELECT telegram_chat_id FROM users WHERE role IN ('ADMIN', 'MANAGER', 'LEADER') AND active = 1 AND telegram_chat_id IS NOT NULL`);
    const chatIds = managers.map(m => m.telegram_chat_id).filter(Boolean);
    if (chatIds.length === 0) return;

    // Tổng hợp số liệu trong 7 ngày qua
    const [leadStats] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'PAID' OR status = 'WON' THEN 1 ELSE 0 END) AS won,
              SUM(CASE WHEN sale_id IS NOT NULL AND status != 'PAID' THEN 1 ELSE 0 END) AS in_progress
       FROM customers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    const [revStats] = await pool.query(
      `SELECT SUM(total_amount) AS revenue FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status = 'PAID'`
    );

    const totalLeads = Number(leadStats[0]?.total || 0);
    const wonLeads = Number(leadStats[0]?.won || 0);
    const inProgress = Number(leadStats[0]?.in_progress || 0);
    const convRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0';
    const totalRev = Number(revStats[0]?.revenue || 0);

    const reportText = `📊 <b>BÁO CÁO KẾT QUẢ KINH DOANH TUẦN (CHỦ NHẬT)</b>\n\n` +
      `📥 <b>TỔNG QUAN DATA KHÁCH HÀNG:</b>\n` +
      `• Tổng số data nhận trong tuần: <b>${totalLeads}</b> data\n` +
      `• Data ĐÃ chuyển đổi (Paid): <b>${wonLeads}</b> (${convRate}%)\n` +
      `• Data ĐANG chăm sóc: <b>${inProgress}</b> data\n\n` +
      `💵 <b>DOANH SỐ BÁN HÀNG:</b>\n` +
      `• Tổng doanh thu thuần tuần: <b>${formatVND(totalRev)}</b>\n\n` +
      `🚀 <i>Chúc toàn thể NVT Agency chuẩn bị tinh thần bứt phá mạnh mẽ trong tuần mới!</i> 🔥`;

    for (const cid of chatIds) {
      await sendMessage(cid, reportText);
    }
  } catch (err) {
    console.error('[Telegram Bot] sendWeeklyReport error:', err.message);
  }
}

// ==================== SCHEDULER CHẠY NỀN QUÉT LỊCH ====================

let lastCheckinDate = '';
let lastWeeklyReportDate = '';

async function runTelegramScheduler() {
  try {
    const now = new Date();
    const vnTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnDay = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getDay(); // 0 = Sunday
    const [hour, minute] = vnTimeStr.split(':').map(Number);

    // 1. Quét Lịch hẹn khách hàng sắp tới (trước 15 - 30 phút)
    try {
      const upcoming = await dbQuery(
        `SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS sale_name, u.telegram_chat_id AS sale_chat_id
         FROM customer_appointments a
         JOIN customers c ON a.customer_id = c.id
         LEFT JOIN users u ON a.sale_id = u.id
         WHERE a.status = 'SCHEDULED'
           AND a.reminded_at IS NULL
           AND a.appointment_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 MINUTE)
           AND u.telegram_chat_id IS NOT NULL`
      );

      for (const app of upcoming) {
        await notifyAppointmentReminder(app, { name: app.customer_name, phone: app.customer_phone }, { name: app.sale_name, telegram_chat_id: app.sale_chat_id });
        await pool.execute(`UPDATE customer_appointments SET reminded_at = NOW() WHERE id = ?`, [app.id]);
      }
    } catch (e) {
      // Table may not exist yet if db unconfigured
    }

    // 1b. Quét Cuộc họp Agency sắp diễn ra để nhắc lại 1 lần nữa theo cài đặt Admin
    try {
      const upcomingMeetings = await dbQuery(
        `SELECT * FROM meeting_broadcasts
         WHERE reminded_at IS NULL
           AND meeting_time > NOW()
           AND meeting_time <= DATE_ADD(NOW(), INTERVAL remind_minutes MINUTE)`
      );

      for (const mb of upcomingMeetings) {
        let roleFilter = '';
        if (mb.target === 'SALE') roleFilter = ` AND role = 'SALE'`;
        else if (mb.target === 'MANAGERS') roleFilter = ` AND role IN ('ADMIN', 'MANAGER', 'LEADER')`;

        const staffToRemind = await dbQuery(`SELECT telegram_chat_id FROM users WHERE active = 1 AND telegram_chat_id IS NOT NULL${roleFilter}`);
        const chatIdsToRemind = staffToRemind.map(s => s.telegram_chat_id).filter(Boolean);

        const remindText = `⏰ <b>NHẮC NHỞ: CUỘC HỌP SẮP DIỄN RA TRONG ${mb.remind_minutes} PHÚT NỮA!</b>\n\n` +
          `• <b>Cuộc họp:</b> 🎯 <b>${escapeHtml(mb.title)}</b>\n` +
          `• <b>Thời gian bắt đầu:</b> ⏰ <b>${formatDateTimeVN(mb.meeting_time)}</b> (Sắp diễn ra)\n` +
          (mb.meeting_link ? `• <b>Địa điểm / Link vào họp:</b> 📍 <a href="${escapeHtml(mb.meeting_link)}">${escapeHtml(mb.meeting_link)}</a>\n` : '') +
          `• <b>Người chủ trì:</b> ✍️ ${escapeHtml(mb.host || 'Ban Quản Trị')}\n\n` +
          `👉 <i>Toàn thể nhân sự khẩn trương sắp xếp công việc và vào phòng họp đúng giờ!</i> 🚀`;

        for (const cid of chatIdsToRemind) {
          await sendMessage(cid, remindText);
        }

        await pool.execute(`UPDATE meeting_broadcasts SET reminded_at = NOW() WHERE id = ?`, [mb.id]);
      }
    } catch (e) {
      // Safe skip
    }

    // 2. Điểm danh lúc 09:00 - 09:10 sáng hàng ngày
    if (hour === 9 && minute >= 0 && minute <= 10 && lastCheckinDate !== vnDateStr) {
      lastCheckinDate = vnDateStr;
      await sendMorningCheckinAlert();
    }

    // 3. Báo cáo tuần tối Chủ Nhật lúc 20:00 - 20:10
    if (vnDay === 0 && hour === 20 && minute >= 0 && minute <= 10 && lastWeeklyReportDate !== vnDateStr) {
      lastWeeklyReportDate = vnDateStr;
      await sendWeeklyReport();
    }

    // 4. Cảnh báo Data nóng quá 12 tiếng chưa xử lý (quét mỗi 15 phút)
    if (minute % 15 === 0) {
      try {
        const staleLeads = await dbQuery(
          `SELECT c.*, s.name AS sale_name, s.telegram_chat_id AS sale_chat_id, l.name AS leader_name, l.telegram_chat_id AS leader_chat_id
           FROM customers c
           LEFT JOIN users s ON c.sale_id = s.id
           LEFT JOIN users l ON c.leader_id = l.id
           WHERE c.sale_accepted_at IS NOT NULL
             AND c.sale_accepted_at <= DATE_SUB(NOW(), INTERVAL 12 HOUR)
             AND c.status = 'NEW'
             AND (c.note IS NULL OR c.note = '' OR c.note LIKE '%nhận từ hàng chờ%')
             AND (s.telegram_chat_id IS NOT NULL OR l.telegram_chat_id IS NOT NULL)
           LIMIT 10`
        );
        for (const lead of staleLeads) {
          await notifyStaleLeadWarning(lead, { name: lead.sale_name, telegram_chat_id: lead.sale_chat_id }, { name: lead.leader_name, telegram_chat_id: lead.leader_chat_id });
        }
      } catch (e) {
        // Safe skip
      }
    }
  } catch (err) {
    console.error('[Telegram Bot] Scheduler error:', err.message);
  }
}

module.exports = {
  callTelegram,
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  setWebhook,
  handleTelegramUpdate,
  notifyNewLead,
  notifyReassignedLead,
  notifyAppointmentReminder,
  notifyStaleLeadWarning,
  sendMorningCheckinAlert,
  sendBroadcastAnnouncement,
  sendWeeklyReport,
  runTelegramScheduler
};
