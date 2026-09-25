'use strict';

const crypto = require('node:crypto');
const { pool, dbQuery } = require('./db.js');

let prepared = null;

function departmentLabel(role) {
  return ({ ADMIN: 'Quản trị', MANAGER: 'Quản lý', LEADER: 'Trưởng nhóm', SALE: 'Sales', MARKETING: 'Marketing', ACCOUNTING: 'Kế toán' })[String(role || '').toUpperCase()] || 'Nhân viên';
}

function messageId() { return `SUP-MSG-${crypto.randomUUID()}`; }
function conversationId(userId) { return `SUP-CONV-${String(userId).slice(0, 72)}`; }
function cleanText(value) { return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, 2000); }

async function prepare() {
  if (!prepared) {
    prepared = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS support_conversations (
        id VARCHAR(96) PRIMARY KEY,
        requester_user_id VARCHAR(96) NOT NULL UNIQUE,
        status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_message_preview VARCHAR(255) NOT NULL DEFAULT '',
        admin_read_at DATETIME NULL,
        employee_read_at DATETIME NULL,
        resolved_at DATETIME NULL,
        resolved_by_user_id VARCHAR(96) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_support_conversation_status_time (status, last_message_at),
        INDEX idx_support_conversation_requester (requester_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS support_messages (
        id VARCHAR(96) PRIMARY KEY,
        conversation_id VARCHAR(96) NOT NULL,
        requester_user_id VARCHAR(96) NOT NULL,
        sender_user_id VARCHAR(96) NULL,
        sender_role VARCHAR(16) NOT NULL,
        content TEXT NULL,
        image_file VARCHAR(160) NULL,
        image_mime VARCHAR(64) NULL,
        telegram_message_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_support_message_conversation_time (conversation_id, created_at),
        INDEX idx_support_message_telegram (telegram_message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    })().catch(error => { prepared = null; throw error; });
  }
  return prepared;
}

function preview(content, imageFile) {
  const text = cleanText(content);
  return text ? text.slice(0, 255) : imageFile ? 'Đã gửi một ảnh đính kèm' : 'Yêu cầu hỗ trợ mới';
}

async function createEmployeeMessage(user, input) {
  await prepare();
  const content = cleanText(input.content);
  const imageFile = String(input.imageFile || '').trim() || null;
  const imageMime = String(input.imageMime || '').trim() || null;
  if (!content && !imageFile) throw Object.assign(new Error('Hãy nhập nội dung hoặc chọn ảnh đính kèm.'), { status: 400 });
  if (user.role === 'ADMIN') throw Object.assign(new Error('Admin sử dụng khung trả lời trong Hộp thư hỗ trợ.'), { status: 403 });
  const conversation = conversationId(user.id);
  const id = messageId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO support_conversations(id,requester_user_id,status,last_message_at,last_message_preview,admin_read_at,employee_read_at,resolved_at,resolved_by_user_id)
       VALUES (?,?, 'OPEN', NOW(), ?, NULL, NOW(), NULL, NULL)
       ON DUPLICATE KEY UPDATE status='OPEN',last_message_at=NOW(),last_message_preview=VALUES(last_message_preview),admin_read_at=NULL,resolved_at=NULL,resolved_by_user_id=NULL`,
      [conversation, user.id, preview(content, imageFile)]
    );
    await connection.execute(
      `INSERT INTO support_messages(id,conversation_id,requester_user_id,sender_user_id,sender_role,content,image_file,image_mime)
       VALUES (?,?,?,?, 'EMPLOYEE', ?,?,?)`,
      [id, conversation, user.id, user.id, content || null, imageFile, imageMime]
    );
    await connection.commit();
    return { id, conversationId: conversation, requester: { id: user.id, name: user.name, accountId: user.accountId || '', role: user.role, department: departmentLabel(user.role) }, content, imageFile, imageMime, createdAt: new Date().toISOString() };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function createAdminMessage(admin, input) {
  await prepare();
  if (admin.role !== 'ADMIN') throw Object.assign(new Error('Chỉ Admin có thể trả lời yêu cầu hỗ trợ.'), { status: 403 });
  const conversation = String(input.conversationId || '').trim();
  const content = cleanText(input.content);
  const imageFile = String(input.imageFile || '').trim() || null;
  const imageMime = String(input.imageMime || '').trim() || null;
  if (!conversation || (!content && !imageFile)) throw Object.assign(new Error('Nội dung phản hồi không hợp lệ.'), { status: 400 });
  const rows = await dbQuery('SELECT requester_user_id FROM support_conversations WHERE id=? LIMIT 1', [conversation]);
  if (!rows.length) throw Object.assign(new Error('Yêu cầu hỗ trợ không còn tồn tại.'), { status: 404 });
  const id = messageId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`INSERT INTO support_messages(id,conversation_id,requester_user_id,sender_user_id,sender_role,content,image_file,image_mime) VALUES (?,?,?,?, 'ADMIN', ?,?,?)`, [id, conversation, rows[0].requester_user_id, admin.id, content || null, imageFile, imageMime]);
    await connection.execute(`UPDATE support_conversations SET status='OPEN',last_message_at=NOW(),last_message_preview=?,employee_read_at=NULL,resolved_at=NULL,resolved_by_user_id=NULL WHERE id=?`, [preview(content, imageFile), conversation]);
    await connection.commit();
    return { id, conversationId: conversation, requesterUserId: rows[0].requester_user_id, content, imageFile, imageMime, createdAt: new Date().toISOString() };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function listConversations(user) {
  await prepare();
  if (user.role !== 'ADMIN') {
    const rows = await dbQuery(`SELECT c.id,c.status,c.last_message_at,c.last_message_preview,c.resolved_at,c.created_at,u.id AS user_id,u.name,u.role,u.account_code FROM support_conversations c JOIN users u ON u.id=c.requester_user_id WHERE c.requester_user_id=? LIMIT 1`, [user.id]);
    return rows.map(row => presentConversation(row, 0));
  }
  const rows = await dbQuery(`SELECT c.id,c.status,c.last_message_at,c.last_message_preview,c.resolved_at,c.created_at,u.id AS user_id,u.name,u.role,u.account_code,
    (SELECT COUNT(*) FROM support_messages sm WHERE sm.conversation_id=c.id AND sm.sender_role='EMPLOYEE' AND (c.admin_read_at IS NULL OR sm.created_at>c.admin_read_at)) AS unread_count
    FROM support_conversations c JOIN users u ON u.id=c.requester_user_id ORDER BY c.status='OPEN' DESC,c.last_message_at DESC LIMIT 200`);
  return rows.map(row => presentConversation(row, Number(row.unread_count || 0)));
}

function presentConversation(row, unreadCount) {
  return { id: row.id, status: row.status, lastMessageAt: row.last_message_at, lastMessagePreview: row.last_message_preview || '', resolvedAt: row.resolved_at, createdAt: row.created_at, unreadCount, requester: { id: row.user_id, name: row.name, role: row.role, accountId: row.account_code || '', department: departmentLabel(row.role) } };
}

async function getMessages(user, requestedConversationId) {
  await prepare();
  let conversation = String(requestedConversationId || '').trim();
  if (user.role !== 'ADMIN') conversation = conversationId(user.id);
  if (!conversation) return { conversation: null, messages: [] };
  const conversations = await dbQuery(`SELECT c.id,c.status,c.requester_user_id,u.name,u.role,u.account_code FROM support_conversations c JOIN users u ON u.id=c.requester_user_id WHERE c.id=? LIMIT 1`, [conversation]);
  if (!conversations.length) return { conversation: null, messages: [] };
  const item = conversations[0];
  if (user.role !== 'ADMIN' && item.requester_user_id !== user.id) throw Object.assign(new Error('Không có quyền xem hội thoại này.'), { status: 403 });
  const rows = await dbQuery(`SELECT id,conversation_id,requester_user_id,sender_user_id,sender_role,content,image_file,image_mime,created_at FROM support_messages WHERE conversation_id=? ORDER BY created_at ASC,id ASC LIMIT 500`, [conversation]);
  await dbQuery(`UPDATE support_conversations SET ${user.role === 'ADMIN' ? 'admin_read_at' : 'employee_read_at'}=NOW() WHERE id=?`, [conversation]);
  return { conversation: presentConversation({ ...item, last_message_at: null, last_message_preview: '', resolved_at: null, created_at: null, user_id: item.requester_user_id }, 0), messages: rows.map(row => ({ id: row.id, conversationId: row.conversation_id, requesterUserId: row.requester_user_id, senderUserId: row.sender_user_id, senderRole: row.sender_role, content: row.content || '', imageFile: row.image_file || '', imageMime: row.image_mime || '', createdAt: row.created_at })) };
}

async function markResolved(admin, requestedConversationId) {
  await prepare();
  if (admin.role !== 'ADMIN') throw Object.assign(new Error('Chỉ Admin có thể đánh dấu hoàn tất.'), { status: 403 });
  const id = String(requestedConversationId || '').trim();
  const result = await dbQuery(`UPDATE support_conversations SET status='RESOLVED',resolved_at=NOW(),resolved_by_user_id=? WHERE id=?`, [admin.id, id]);
  if (!result.affectedRows) throw Object.assign(new Error('Không tìm thấy hội thoại hỗ trợ.'), { status: 404 });
  return { ok: true };
}

async function setTelegramMessageId(id, telegramMessageId) {
  await prepare();
  await dbQuery('UPDATE support_messages SET telegram_message_id=? WHERE id=?', [Number(telegramMessageId) || null, id]);
}

async function createTelegramAdminReply(chatId, replyToMessageId, content) {
  await prepare();
  const original = await dbQuery(`SELECT sm.conversation_id,sm.requester_user_id FROM support_messages sm WHERE sm.telegram_message_id=? LIMIT 1`, [Number(replyToMessageId)]);
  if (!original.length) return { matched: false };
  const admins = await dbQuery(`SELECT id FROM users WHERE role='ADMIN' AND active=1 AND telegram_chat_id=? LIMIT 1`, [String(chatId)]);
  const adminId = admins[0]?.id || null;
  const text = cleanText(content);
  if (!text) return { matched: true, skipped: true };
  const id = messageId(), item = original[0];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`INSERT INTO support_messages(id,conversation_id,requester_user_id,sender_user_id,sender_role,content) VALUES (?,?,?,?, 'ADMIN', ?)`, [id, item.conversation_id, item.requester_user_id, adminId, text]);
    await connection.execute(`UPDATE support_conversations SET status='OPEN',last_message_at=NOW(),last_message_preview=?,employee_read_at=NULL,resolved_at=NULL,resolved_by_user_id=NULL WHERE id=?`, [preview(text), item.conversation_id]);
    await connection.commit();
    return { matched: true, id, conversationId: item.conversation_id, requesterUserId: item.requester_user_id };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function canReadUpload(user, fileName) {
  await prepare();
  const rows = await dbQuery(`SELECT sm.requester_user_id,sm.image_mime FROM support_messages sm WHERE sm.image_file=? LIMIT 1`, [fileName]);
  if (!rows.length) return { allowed: false };
  return { allowed: user.role === 'ADMIN' || rows[0].requester_user_id === user.id, mime: rows[0].image_mime || 'application/octet-stream' };
}

module.exports = { prepare, departmentLabel, createEmployeeMessage, createAdminMessage, listConversations, getMessages, markResolved, setTelegramMessageId, createTelegramAdminReply, canReadUpload };
