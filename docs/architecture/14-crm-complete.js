'use strict';

const STORAGE_KEY = 'nvt-crm-production-v1';
const SESSION_KEY = 'nvt-crm-session-v1';
const THEME_KEY = 'nvt-crm-theme-v1';

const ACCOUNTS = [
  { id: 'u-admin', phone: '0933445566', password: 'admin123', role: 'ADMIN', name: 'Start', initials: 'ST', scope: 'ALL' },
  { id: 'u-leader-1', phone: '0977000001', password: 'leader123', role: 'LEADER', name: 'Phạm Thu Hà', initials: 'PH', scope: 'TEAM', teamId: 'T2', leaderId: 'l1' },
  { id: 'u-sale-1', phone: '0966000001', password: 'sale123', role: 'SALE', name: 'Nguyễn Thị Mai', initials: 'NM', scope: 'OWN', teamId: 'T2', leaderId: 'l1', saleId: 's1' }
];

const STAFF_SEED = [
  { id: 'l1', name: 'Phạm Thu Hà', role: 'LEADER', teamId: 'T2', initials: 'PH' },
  { id: 's1', name: 'Nguyễn Thị Mai', role: 'SALE', teamId: 'T2', leaderId: 'l1', initials: 'NM' }
];
let STAFF = structuredClone(STAFF_SEED);

let PRODUCTS = [];

const CUSTOMER_SEED = [
  { id: 'CUS-01024', name: 'Nguyễn Văn Minh', phone: '0901842161', email: 'minh.nguyen@gmail.com', source: 'TikTok Ads', campaign: 'TT-TRADING-09', status: 'CONSULTING', saleId: 's1', leaderId: 'l1', teamId: 'T2', createdAt: '2026-09-03 14:01', updatedAt: '2026-09-07 10:42', note: 'Đã hẹn gọi lại tối nay' },
  { id: 'CUS-01023', name: 'Trần Quỳnh Anh', phone: '0987501220', email: 'quynhanh@outlook.com', source: 'Google Organic', campaign: 'SEO-COURSE', status: 'PAID', saleId: 's2', leaderId: 'l1', teamId: 'T2', createdAt: '2026-08-29 09:10', updatedAt: '2026-09-07 09:05', note: 'Đã nạp, chờ onboarding' },
  { id: 'CUS-01022', name: 'Đặng Quốc Bảo', phone: '0938228468', email: 'bao.dang@gmail.com', source: 'Facebook Ads', campaign: 'FB-DATA-09', status: 'NEW', saleId: 's1', leaderId: 'l1', teamId: 'T2', createdAt: '2026-09-07 08:42', updatedAt: '2026-09-07 08:55', note: 'Data mới từ webinar' },
  { id: 'CUS-01021', name: 'Lê Thu Phương', phone: '0912667301', email: 'phuong.le@gmail.com', source: 'Referral', campaign: 'PARTNER-MAI', status: 'WON', saleId: 's3', leaderId: 'l1', teamId: 'T2', createdAt: '2026-08-25 16:20', updatedAt: '2026-09-06 16:20', note: 'Đã mua gói Pro' },
  { id: 'CUS-01020', name: 'Phạm Khánh Linh', phone: '0965120494', email: 'linh.pham@gmail.com', source: 'TikTok Ads', campaign: 'TT-TRADING-09', status: 'CONTACTED', saleId: 's2', leaderId: 'l1', teamId: 'T2', createdAt: '2026-09-03 11:30', updatedAt: '2026-09-06 15:33', note: 'Hẹn gửi proposal' },
  { id: 'CUS-01019', name: 'Hoàng Gia Huy', phone: '0904800785', email: 'huy.hoang@gmail.com', source: 'Landing Page', campaign: 'LP-FREE-AUDIT', status: 'LOST', saleId: 's3', leaderId: 'l1', teamId: 'T2', createdAt: '2026-08-22 08:50', updatedAt: '2026-09-05 18:20', note: 'Không phản hồi sau 3 lần' },
  { id: 'CUS-01018', name: 'Võ Thanh Hà', phone: '0981302541', email: 'ha.vo@gmail.com', source: 'Google Ads', campaign: 'GG-SEARCH-09', status: 'PAID', saleId: 's4', leaderId: 'l2', teamId: 'T3', createdAt: '2026-09-02 10:10', updatedAt: '2026-09-07 10:10', note: 'Đã hoàn tất onboarding' },
  { id: 'CUS-01017', name: 'Ngô Thành Đạt', phone: '0974556912', email: 'dat.ngo@gmail.com', source: 'Zalo OA', campaign: 'ZALO-SEP', status: 'NURTURING', saleId: 's4', leaderId: 'l2', teamId: 'T3', createdAt: '2026-08-20 10:10', updatedAt: '2026-09-06 11:00', note: 'Khách cũ cần chăm sóc' },
  { id: 'CUS-01016', name: 'Bùi Minh Châu', phone: '0869342807', email: 'chau.bui@gmail.com', source: 'Website Organic', campaign: 'SEO-COURSE', status: 'NEW', saleId: null, leaderId: null, teamId: null, createdAt: '2026-09-07 10:25', updatedAt: '2026-09-07 10:25', note: 'Chưa phân data' },
  { id: 'CUS-01015', name: 'Đỗ Mạnh Cường', phone: '0933115400', email: 'cuong.do@gmail.com', source: 'Facebook Ads', campaign: 'FB-DATA-09', status: 'NEW', saleId: null, leaderId: 'l1', teamId: 'T2', createdAt: '2026-09-07 09:50', updatedAt: '2026-09-07 09:50', note: 'Pool riêng Team T2' },
  { id: 'CUS-01014', name: 'Mai Ngọc Diệp', phone: '0908910623', email: 'diep.mai@gmail.com', source: 'TikTok Ads', campaign: 'TT-TRADING-09', status: 'NEW', saleId: null, leaderId: null, teamId: null, createdAt: '2026-09-06 09:12', updatedAt: '2026-09-06 09:12', note: 'Chưa phân data' }
];



const STATUS_META = {
  NEW: { label: 'Data mới', color: '#246b9b' }, CONTACTED: { label: 'Đã liên hệ', color: '#7a62d3' },
  CONSULTING: { label: 'Đang tư vấn', color: '#e8572a' }, PROPOSAL: { label: 'Đã gửi báo giá', color: '#a3650b' },
  PAID: { label: 'Đã thanh toán', color: '#157a4b' }, WON: { label: 'Thành công', color: '#0c8b72' },
  NURTURING: { label: 'Đang chăm sóc', color: '#19a4df' }, LOST: { label: 'Không phản hồi', color: '#c33d42' }
};

const ORDER_STATUS = {
  PAID: ['Đã thanh toán', 'paid'], PENDING: ['Chờ thanh toán', 'pending'],
  DEPOSIT: ['Cọc 50%', 'deposit'],
  CANCELLED: ['Đã huỷ', 'cancelled'], REFUNDED: ['Đã hoàn tiền', 'refunded']
};

const FIELD_COLORS = ['#246b9b', '#a3650b', '#157a4b', '#e8572a', '#6b46c1', '#0c8b72', '#c33d42', '#687771', '#8b5a2b', '#9b2c68'];
const CUSTOM_FIELD_SEED = [
  { id: 'customerLevel', label: 'Level khách hàng', type: 'SELECT', showInTable: true, required: false, active: true, options: [
    ['L0', 'L0: Chưa liên hệ được'], ['L1', 'L1: Đã kết nối được Zalo/Tele'], ['L1.1', 'L1.1: Đã kết bạn Zalo chờ accept'], ['L2', 'L2: Đã vào nhóm xem tín hiệu'], ['L3', 'L3: Quan tâm đến tín hiệu'], ['L4.1', 'L4.1: Hẹn nạp vốn'], ['L5', 'L5: Đã tạo tài khoản'], ['L6', 'L6: Nạp tiền'], ['L7', 'L7: Trading'], ['L8', 'L8: Rút vốn'], ['L9', 'L9: Nghỉ giao dịch'], ['L10', 'L10: Quay lại giao dịch'], ['L4.2', 'L4.2: Khách rời nhóm'], ['L4.3', 'L4.3: Khách không tương tác'], ['L12.1', 'L12.1: Khách từ chối hỗ trợ'], ['L12.2', 'L12.2: Trùng'], ['L11', 'L11: Khách muốn Coaching']
  ].map(([value, label], index) => ({ value, label, color: FIELD_COLORS[index % FIELD_COLORS.length] })) },
  { id: 'customerClass', label: 'Phân loại khách hàng', type: 'SELECT', showInTable: true, required: false, active: true, options: ['Lạnh', 'Ấm', 'Nóng', 'Premium', 'Whale', 'Resale', 'Cancel', 'Pending'].map((label, index) => ({ value: label, label, color: FIELD_COLORS[index] })) },
  { id: 'callStatus', label: 'Gọi kết nối', type: 'SELECT', showInTable: true, required: false, active: true, options: ['Chưa gọi được', 'Đã gọi được', 'Hẹn gọi lại'].map((label, index) => ({ value: label, label, color: FIELD_COLORS[index] })) },
  { id: 'documentStatus', label: 'Tình trạng nhận tài liệu', type: 'SELECT', showInTable: false, required: false, active: true, options: ['Chưa gửi', 'Đã gửi', 'Đã nhận', 'Cần gửi lại'].map((label, index) => ({ value: label, label, color: FIELD_COLORS[index] })) },
  { id: 'needs', label: 'Nhu cầu / Mong muốn', type: 'MULTI_SELECT', showInTable: false, required: false, active: true, options: ['Tín hiệu Vàng', 'Tín hiệu FX', 'Tín hiệu Crypto Future', 'Học cơ bản > Nâng cao', 'Học phương pháp Nến', 'Tham gia live tin tức', 'Vốn lớn Coaching 1:1', 'Chứng khoán Cơ sở', 'Chứng khoán phái sinh'].map((label, index) => ({ value: label, label, color: FIELD_COLORS[index % FIELD_COLORS.length] })) },
  { id: 'course', label: 'Khoá học', type: 'MULTI_SELECT', showInTable: false, required: false, active: true, options: ['BMĐTHH', 'Coaching VIP', 'Chuyên sâu', 'Cộng đồng giao dịch'].map((label, index) => ({ value: label, label, color: FIELD_COLORS[index] })) },
  { id: 'result', label: 'Kết quả chăm sóc', type: 'SELECT', showInTable: true, required: false, active: true, options: ['Nhận contact', 'Đã học BMĐTHH', 'Hẹn gọi lại', 'Xác nhận học', 'Không quan tâm', 'Không tín hiệu/thuê bao', 'Sai số/nhầm số', 'Không nghe máy', 'Chờ học khoá tiếp', 'Đã giới thiệu Chuyên gia', 'Đang chăm sóc', 'Thành thạo CQG', 'Đăng ký COACH VIP-HH', 'Đã được COACH với chuyên gia', 'HV mua chỉ báo', 'HV chuyên sâu', 'Đang giao dịch', 'Đã mở tài khoản', 'Tạm ngừng giao dịch', 'Khai thác kho số', 'Trùng sale và bàn giao', 'Bàn giao'].map((label, index) => ({ value: label, label, color: FIELD_COLORS[index % FIELD_COLORS.length] })) },
];

const SEMANTIC_OPTION_COLORS = {
  customerLevel: {
    L0: '#64748b', L1: '#3b82f6', 'L1.1': '#60a5fa', L2: '#06b6d4', L3: '#14b8a6', 'L4.1': '#f59e0b', L5: '#10b981', L6: '#059669', L7: '#0f766e', L8: '#8b5cf6', L9: '#78716c', L10: '#2563eb', 'L4.2': '#f97316', 'L4.3': '#d97706', 'L12.1': '#dc2626', 'L12.2': '#be123c', L11: '#7c3aed'
  },
  customerClass: { 'Lạnh': '#3b82f6', 'Ấm': '#f59e0b', 'Nóng': '#ef4444', Premium: '#ca8a04', Whale: '#0f766e', Resale: '#7c3aed', Cancel: '#64748b', Pending: '#d97706' },
  callStatus: { 'Chưa gọi được': '#64748b', 'Đã gọi được': '#10b981', 'Hẹn gọi lại': '#f59e0b' },
  documentStatus: { 'Chưa gửi': '#64748b', 'Đã gửi': '#3b82f6', 'Đã nhận': '#10b981', 'Cần gửi lại': '#f97316' },
  result: { 'Đã mở tài khoản': '#10b981', 'Đang giao dịch': '#0f766e', 'Đang chăm sóc': '#3b82f6', 'Hẹn gọi lại': '#f59e0b', 'Không quan tâm': '#ef4444', 'Sai số/nhầm số': '#be123c', 'Không nghe máy': '#64748b', 'Trùng sale và bàn giao': '#7c3aed', 'Bàn giao': '#8b5cf6' }
};

CUSTOM_FIELD_SEED.forEach(field => field.options.forEach(option => {
  option.color = SEMANTIC_OPTION_COLORS[field.id]?.[option.value] || option.color;
}));

const NAVIGATION = {
  ADMIN: [
    ['Vận hành', [['dashboard', 'Tổng quan', '◫'], ['customers', 'Khách hàng tổng', '♙'], ['distribution', 'Chia Leader', '⇄'], ['websites', 'Websites', '◇']]],
    ['Kinh doanh', [['orders', 'Đơn hàng', '▤'], ['products', 'Sản phẩm', '□'], ['revenue', 'Doanh thu', '₫'], ['marketing', 'Dữ liệu', '⌁']]],
    ['Tổ chức', [['team', 'Đội ngũ', '♧']]],
    ['Hệ thống', [['attendance', 'Điểm danh', '✓'], ['notifications', 'Thông báo', '●'], ['audit', 'User log', '◉'], ['settings', 'Cài đặt', '⚙']]]
  ],
  LEADER: [
    ['Vận hành', [['dashboard', 'Tổng quan đội', '◫'], ['customers', 'Khách hàng Team', '♙']]],
    ['Kinh doanh', [['orders', 'Đơn hàng', '▤'], ['products', 'Sản phẩm', '□'], ['revenue', 'Doanh thu', '₫']]],
    ['Đội nhóm', [['distribution', 'Chia Sale', '⇄'], ['team', 'Hiệu suất Sale', '♧'], ['attendance', 'Điểm danh', '✓'], ['notifications', 'Thông báo', '●']]]
  ],
  SALE: [
    ['Khách hàng của tôi', [['dashboard', 'Tổng quan', '◫'], ['customers', 'Khách của tôi', '♙'], ['accept', 'Data chờ nhận', '⤓']]],
    ['Kinh doanh', [['orders', 'Đơn của tôi', '▤'], ['products', 'Sản phẩm đơn của tôi', '□'], ['revenue', 'Doanh thu của tôi', '₫']]],
    ['Cá nhân', [['attendance', 'Điểm danh', '✓'], ['notifications', 'Thông báo', '●']]]
  ]
};

function dayIso(daysAgo) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type)?.value || '01';
  const today = `${value('year')}-${value('month')}-${value('day')}`;
  return shiftDate(today, -daysAgo);
}

function shiftStamp(value, minutes) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return String(value || '');
  const [, year, month, day, hour, minute] = match.map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute) + Number(minutes || 0) * 60 * 1000);
  return shifted.toISOString().slice(0, 16).replace('T', ' ');
}

function makeOrders() {
  if (!PRODUCTS.length) return [];
  const assigned = CUSTOMER_SEED.filter(customer => customer.saleId);
  return Array.from({ length: 46 }, (_, index) => {
    const customer = assigned[(index * 3 + 1) % assigned.length];
    const product = PRODUCTS[(index * 5 + 2) % PRODUCTS.length];
    const qty = index % 6 === 0 ? 2 : 1;
    const subtotal = product.price * qty;
    const discount = index % 7 === 0 ? Math.round(subtotal * 0.08) : 0;
    const total = subtotal - discount;
    const status = index % 17 === 0 ? 'REFUNDED' : index % 11 === 0 ? 'CANCELLED' : index % 8 === 0 ? 'PENDING' : 'PAID';
    const createdDate = dayIso(index % 28);
    const source = customer.source === 'Referral' || customer.source === 'Landing Page' || customer.source === 'Website Organic' ? 'Direct / Referral' : customer.source;
    return {
      id: `ORD-${String(1100 + index)}`, code: `NVT-2609-${String(1100 + index)}`,
      customerId: customer.id, customerName: customer.name, saleId: customer.saleId, leaderId: customer.leaderId, teamId: customer.teamId,
      source, campaign: customer.campaign, websiteId: defaultWebsiteIdForCustomer(customer), productId: product.id, productName: product.name, sku: product.sku, qty, unitPrice: product.price,
      subtotal, discount, total, refund: status === 'REFUNDED' ? total : 0, status,
      createdAt: `${createdDate} ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
      paidAt: ['PAID', 'REFUNDED'].includes(status) ? `${createdDate} ${String(9 + (index % 9)).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}` : null,
      refundedAt: status === 'REFUNDED' ? `${createdDate} ${String(17 + (index % 3)).padStart(2, '0')}:${String((index * 13) % 60).padStart(2, '0')}` : null,
      paymentMethod: index % 3 === 0 ? 'Chuyển khoản' : index % 3 === 1 ? 'VietQR' : 'Ví doanh nghiệp',
      paymentReconciled: index % 5 !== 0,
      refundReconciled: status === 'REFUNDED' ? index % 2 === 0 : null
    };
  });
}

function makeTrafficEvents() {
  const saleIds = ['s1', 's2', 's3', 's4'];
  const events = [];
  for (let day = 0; day < 28; day += 1) {
    TRAFFIC_META.forEach((meta, sourceIndex) => {
      const saleId = saleIds[(day + sourceIndex) % saleIds.length];
      const staff = STAFF_SEED.find(person => person.id === saleId);
      const sessions = 38 + ((day * 17 + sourceIndex * 23) % 118);
      const leads = Math.max(1, Math.round(sessions * (0.045 + sourceIndex * 0.008)));
      events.push({ id: `TRF-${day}-${sourceIndex}`, date: dayIso(day), saleId, leaderId: staff.leaderId, teamId: staff.teamId, sessions, leads, spend: Math.round(meta.spend * (0.72 + ((day + sourceIndex) % 6) * 0.07)), ...meta });
    });
  }
  return events;
}

function makeTasks() {
  return CUSTOMER_SEED.filter(customer => customer.saleId).flatMap((customer, index) => {
    const primaryDueAt = `${dayIso(index % 4)} ${index % 2 ? '16:30' : '10:00'}`;
    const slaBased = index % 2 === 0;
    return [
      { id: `TSK-${index}-A`, customerId: customer.id, customerName: customer.name, ownerId: customer.saleId, leaderId: customer.leaderId, teamId: customer.teamId, type: slaBased ? 'Gọi tư vấn' : 'Gửi proposal', createdAt: slaBased ? shiftStamp(primaryDueAt, -30) : `${dayIso(index % 4 + 1)} 09:00`, dueAt: primaryDueAt, slaBased, status: index % 5 === 0 ? 'DONE' : index % 3 === 0 ? 'OVERDUE' : 'OPEN', priority: index % 4 === 0 ? 'HIGH' : 'NORMAL' },
      { id: `TSK-${index}-B`, customerId: customer.id, customerName: customer.name, ownerId: customer.saleId, leaderId: customer.leaderId, teamId: customer.teamId, type: 'Chăm sóc định kỳ', createdAt: `${dayIso(index % 4)} 08:30`, dueAt: `${dayIso(-(index % 3 + 1))} 09:30`, slaBased: false, status: 'OPEN', priority: 'NORMAL' }
    ];
  });
}

function makeCustomerNotes() {
  return CUSTOMER_SEED.map((customer, index) => ({
    id: `NOTE-${index + 1}`,
    customerId: customer.id,
    authorId: customer.saleId || customer.leaderId || 'u-admin',
    author: customer.saleId ? STAFF_SEED.find(person => person.id === customer.saleId)?.name || 'Sale' : customer.leaderId ? STAFF_SEED.find(person => person.id === customer.leaderId)?.name || 'Leader' : 'Start',
    role: customer.saleId ? 'SALE' : customer.leaderId ? 'LEADER' : 'ADMIN',
    text: customer.note,
    at: customer.updatedAt
  }));
}

function seedCustomerCustomFields(index) {
  const levels = ['L3', 'L5', 'L1', 'L7', 'L4.1', 'L0', 'L6', 'L9', 'L0', 'L1.1', 'L2'];
  const classes = ['Ấm', 'Nóng', 'Lạnh', 'Premium', 'Nóng', 'Lạnh', 'Premium', 'Pending', 'Lạnh', 'Lạnh', 'Ấm'];
  return { customerLevel: levels[index % levels.length], customerClass: classes[index % classes.length], callStatus: index % 3 === 0 ? 'Đã gọi được' : index % 3 === 1 ? 'Hẹn gọi lại' : 'Chưa gọi được', documentStatus: index % 2 ? 'Đã gửi' : 'Chưa gửi', needs: index % 2 ? ['Tín hiệu FX'] : ['Học cơ bản > Nâng cao'], course: index % 4 === 0 ? ['BMĐTHH'] : [], result: index % 3 === 0 ? 'Đang chăm sóc' : index % 3 === 1 ? 'Hẹn gọi lại' : 'Không nghe máy' };
}

function makeFieldHistory(customers) {
  return customers.map((customer, index) => ({ id: `FLD-HIS-${index + 1}`, customerId: customer.id, fieldId: 'customerLevel', fieldLabel: 'Level khách hàng', from: '', to: customer.customFields.customerLevel, actorId: 'SYSTEM', actor: 'Khởi tạo CRM', role: 'SYSTEM', at: customer.createdAt, source: 'MIGRATION' }));
}

function makeAssignmentHistory(customers) {
  return customers.filter(customer => customer.saleId || customer.leaderId).map((customer, index) => ({ id: `ASN-HIS-${index + 1}`, customerId: customer.id, fromSaleId: null, fromSaleName: '', toSaleId: customer.saleId || null, toSaleName: STAFF_SEED.find(member => member.id === customer.saleId)?.name || '', fromLeaderId: null, fromLeaderName: '', toLeaderId: customer.leaderId || null, toLeaderName: STAFF_SEED.find(member => member.id === customer.leaderId)?.name || '', teamId: customer.teamId || null, actorId: 'SYSTEM', actor: 'Khởi tạo CRM', role: 'SYSTEM', at: customer.createdAt, reason: 'Phân công hiện có khi khởi tạo', source: 'SYSTEM' }));
}

function defaultWebsiteIdForCustomer(customer) {
  const source = String(customer?.source || '').toLowerCase();
  const campaign = String(customer?.campaign || '').toLowerCase();
  if (source.includes('zalo') || campaign.includes('growth') || campaign.includes('zalo')) return 'WEB-3';
  if (source.includes('ads') || source.includes('landing') || campaign.includes('audit') || campaign.includes('trading')) return 'WEB-2';
  return 'WEB-1';
}

function initialState() {
  // Production starts empty; records arrive through the Sale/LadiPage import flow.
  const customers = [];
  return {
    version: 3,
    optionPaletteVersion: 2,
    members: structuredClone(STAFF_SEED),
    registrations: [],
    customFieldDefinitions: structuredClone(CUSTOM_FIELD_SEED),
    customers,
    customerFieldHistory: makeFieldHistory(customers),
    assignmentHistory: makeAssignmentHistory(customers),
    resubmissions: [],
    notes: makeCustomerNotes(),
    imports: [],
    products: [],
    productCategories: ['Chỉ báo', 'Khóa học', 'Quảng cáo', 'Website', 'CRM', 'Automation', 'Nội dung', 'Dịch vụ khác'],
    attendance: [],
    dataOffers: [],
    orders: [],
    traffic: [],
    tasks: [],
    notifications: [],
    audit: [],
    websites: [],
    integrations: [],
    leaderDistribution: {
      enabled: true,
      enabledLeaderIds: ['l1'],
      weights: { l1: 1 },
      sourceRules: []
    },
    saleDistributionByLeader: {
      l1: { enabledSaleIds: ['s1'], weights: { s1: 1 } }
    },
    settings: { leaderCanUpdate: true, notifyMilestones: true, assignmentMode: 'MANUAL', saleAssignmentModes: {}, assignmentCursor: { leaders: 0, salesByTeam: {} }, slaMinutes: 30, customAccent: '#e8572a', fontFamily: 'aptos', dataBotToken: '', dataBotChatId: '', memberBotToken: '', memberBotChatId: '', webhookPublicBase: 'https://nvtagency.top', attendanceIp: '', attendanceDeadline: '09:00', acceptTimeoutHours: 24, notifyAccountCreated: true, notifyDataReceived: true },
    security: {
      adminPassword: 'admin123',
      twoFactorEnabled: false,
      twoFactorCode: '260907',
      loginHistory: []
    }
  };
}

function cleanText(value, fallback = '', maxLength = 1000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function dataTerminology(value) {
  return String(value || '').replace(/\bleads?\b/gi, word => word[0] === word[0].toUpperCase() ? 'Data' : 'data');
}

function cleanId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,96}$/.test(value) ? value : null;
}

function cleanNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return fallback;
  return integer ? Math.round(value) : value;
}

function cleanTimestamp(value, fallback = '') {
  const candidate = cleanText(value, '', 16);
  const match = candidate.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/);
  if (!match || cleanDate(match[1]) !== match[1] || Number(match[2]) > 23 || Number(match[3]) > 59) return fallback;
  return candidate;
}

function cleanDate(value, fallback = '') {
  const candidate = cleanText(value, '', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : fallback;
}

/* Giờ dạng HH:MM thật sự hợp lệ — /^\d{2}:\d{2}$/ vẫn lọt "25:99" nên giờ chốt
   điểm danh phải qua đây, nếu không nhãn Trễ sẽ so với một mốc không tồn tại. */
function cleanClockTime(value, fallback = '') {
  const candidate = cleanText(value, '', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate)) return fallback;
  return candidate;
}

function uniqueRecords(records, fallback, sanitizer) {
  const input = Array.isArray(records) ? records : fallback;
  const seen = new Set();
  const result = [];
  input.forEach(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const item = sanitizer(raw);
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    result.push(item);
  });
  return result;
}

function defaultCustomFieldValue(field) {
  if (field.type === 'MULTI_SELECT') return [];
  if (field.type === 'CHECKBOX') return false;
  if (field.id === 'customerLevel') return 'L0';
  return '';
}

function normalizeCustomFieldDefinition(field) {
  const id = cleanId(field.id);
  const type = ['TEXT', 'NOTE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'DATE', 'NUMBER', 'URL'].includes(field.type) ? field.type : null;
  if (!id || !type) return null;
  const seen = new Set();
  const options = ['SELECT', 'MULTI_SELECT'].includes(type) && Array.isArray(field.options)
    ? field.options.map((option, index) => {
      const value = cleanText(typeof option === 'string' ? option : option?.value, '', 160).trim();
      if (!value || seen.has(value)) return null;
      seen.add(value);
      return {
        value,
        label: cleanText(typeof option === 'string' ? option : option?.label, value, 200).trim() || value,
        color: /^#[0-9a-f]{6}$/i.test(option?.color || '') ? option.color : FIELD_COLORS[index % FIELD_COLORS.length]
      };
    }).filter(Boolean)
    : [];
  return {
    id,
    label: cleanText(field.label, 'Cột dữ liệu', 160).trim() || 'Cột dữ liệu',
    type,
    showInTable: field.showInTable === true,
    required: field.required === true,
    active: field.active !== false,
    options
  };
}

function sanitizeCustomFieldValue(value, field) {
  if (!field) return '';
  if (field.type === 'CHECKBOX') return value === true || value === 'true' || value === '1';
  if (field.type === 'MULTI_SELECT') {
    const allowed = new Set(field.options.map(option => option.value));
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return Array.from(new Set(values.map(item => cleanText(String(item), '', 160).trim()).filter(item => allowed.has(item))));
  }
  if (field.type === 'SELECT') {
    const candidate = cleanText(String(value ?? ''), '', 160).trim();
    return field.options.some(option => option.value === candidate) ? candidate : '';
  }
  if (field.type === 'DATE') return cleanDate(value);
  if (field.type === 'NUMBER') {
    const candidate = Number(value);
    return Number.isFinite(candidate) ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, candidate)) : '';
  }
  const candidate = cleanText(String(value ?? ''), '', field.type === 'NOTE' ? 4000 : 1000).trim();
  if (field.type === 'URL') {
    return !candidate || /^https?:\/\/[^\s]+$/i.test(candidate) ? candidate : '';
  }
  return candidate;
}

function normalizeFieldHistoryRecord(item, customerIds) {
  const id = cleanId(item.id), customerId = cleanId(item.customerId), fieldId = cleanId(item.fieldId);
  if (!id || !customerId || !customerIds.has(customerId) || !fieldId) return null;
  const cleanHistoryValue = value => Array.isArray(value)
    ? value.map(entry => cleanText(String(entry), '', 160)).slice(0, 50)
    : typeof value === 'boolean' || typeof value === 'number' ? value : cleanText(String(value ?? ''), '', 4000);
  return {
    id,
    customerId,
    fieldId,
    fieldLabel: cleanText(item.fieldLabel, fieldId, 160),
    from: cleanHistoryValue(item.from),
    to: cleanHistoryValue(item.to),
    actorId: cleanId(item.actorId) || 'SYSTEM',
    actor: cleanText(item.actor, 'Hệ thống', 160),
    role: ['ADMIN', 'LEADER', 'SALE', 'SYSTEM'].includes(item.role) ? item.role : 'SYSTEM',
    at: cleanTimestamp(item.at, stamp()),
    source: ['MANUAL', 'FORM', 'IMPORT', 'API', 'MIGRATION', 'SYSTEM'].includes(item.source) ? item.source : 'MANUAL'
  };
}

function normalizeAssignmentHistoryRecord(item, customerIds) {
  const id = cleanId(item.id), customerId = cleanId(item.customerId);
  if (!id || !customerId || !customerIds.has(customerId)) return null;
  return {
    id,
    customerId,
    fromSaleId: cleanId(item.fromSaleId),
    fromSaleName: cleanText(item.fromSaleName, '', 160),
    toSaleId: cleanId(item.toSaleId),
    toSaleName: cleanText(item.toSaleName, '', 160),
    fromLeaderId: cleanId(item.fromLeaderId),
    fromLeaderName: cleanText(item.fromLeaderName, '', 160),
    toLeaderId: cleanId(item.toLeaderId),
    toLeaderName: cleanText(item.toLeaderName, '', 160),
    teamId: cleanId(item.teamId),
    actorId: cleanId(item.actorId) || 'SYSTEM',
    actor: cleanText(item.actor, 'Hệ thống', 160),
    role: ['ADMIN', 'LEADER', 'SALE', 'SYSTEM'].includes(item.role) ? item.role : 'SYSTEM',
    at: cleanTimestamp(item.at, stamp()),
    reason: dataTerminology(cleanText(item.reason, 'Cập nhật phân công', 1000)),
    source: ['MANUAL', 'FORM', 'IMPORT', 'API', 'SYSTEM'].includes(item.source) ? item.source : 'MANUAL'
  };
}

function normalizeResubmissionRecord(item, customerIds, websites) {
  const id = cleanId(item.id), customerId = cleanId(item.customerId);
  if (!id || !customerId || !customerIds.has(customerId)) return null;
  const websiteId = cleanId(item.websiteId);
  return {
    id,
    customerId,
    phone: cleanText(item.phone, '', 20),
    source: dataTerminology(cleanText(item.source, 'Nguồn chưa xác định', 120)),
    campaign: dataTerminology(cleanText(item.campaign, '', 160)),
    websiteId: websites.some(website => website.id === websiteId) ? websiteId : null,
    previousSaleId: cleanId(item.previousSaleId),
    assignedSaleId: cleanId(item.assignedSaleId),
    registeredAccount: item.registeredAccount === true,
    at: cleanTimestamp(item.at, stamp()),
    intakeType: ['MANUAL', 'FORM', 'IMPORT', 'API'].includes(item.intakeType) ? item.intakeType : 'FORM'
  };
}

function sanitizeLeaderDistribution(input, members, defaults) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const leaderIds = new Set(members.filter(member => member.role === 'LEADER').map(member => member.id));
  const requested = Array.isArray(value.enabledLeaderIds) ? value.enabledLeaderIds.filter(id => leaderIds.has(id)) : defaults.enabledLeaderIds.filter(id => leaderIds.has(id));
  const weights = Object.fromEntries(Array.from(leaderIds).map(id => [id, cleanNumber(Number(value.weights?.[id]), defaults.weights[id] || 1, 1, 100, true)]));
  const sourceRules = uniqueRecords(value.sourceRules, defaults.sourceRules, rule => {
    const id = cleanId(rule.id), matchType = ['WEBSITE', 'SOURCE', 'CAMPAIGN'].includes(rule.matchType) ? rule.matchType : null;
    const matchValue = cleanText(rule.matchValue, '', 200).trim(), targetLeaderId = cleanId(rule.targetLeaderId);
    if (!id || !matchType || !matchValue || !leaderIds.has(targetLeaderId)) return null;
    return { id, matchType, matchValue, targetLeaderId, active: rule.active !== false };
  });
  return { enabled: value.enabled !== false, enabledLeaderIds: Array.from(new Set(requested)), weights, sourceRules };
}

function sanitizeSaleDistribution(input, members, defaults) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const output = {};
  members.filter(member => member.role === 'LEADER').forEach(leader => {
    const sales = members.filter(member => member.role === 'SALE' && member.leaderId === leader.id);
    const saleIds = new Set(sales.map(sale => sale.id));
    const source = value[leader.id] && typeof value[leader.id] === 'object' ? value[leader.id] : defaults[leader.id] || {};
    output[leader.id] = {
      enabledSaleIds: Array.from(new Set((Array.isArray(source.enabledSaleIds) ? source.enabledSaleIds : sales.map(sale => sale.id)).filter(id => saleIds.has(id)))),
      weights: Object.fromEntries(sales.map(sale => [sale.id, cleanNumber(Number(source.weights?.[sale.id]), 1, 1, 100, true)]))
    };
  });
  return output;
}

function sanitizeSettings(settings, defaults) {
  const input = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const assignmentMode = ['MANUAL', 'ROUND_ROBIN', 'BALANCED'].includes(input.assignmentMode)
    ? input.assignmentMode
    : input.autoAssign === true ? 'BALANCED' : defaults.assignmentMode;
  const rawCursor = input.assignmentCursor && typeof input.assignmentCursor === 'object' && !Array.isArray(input.assignmentCursor) ? input.assignmentCursor : {};
  const salesByTeam = rawCursor.salesByTeam && typeof rawCursor.salesByTeam === 'object' && !Array.isArray(rawCursor.salesByTeam)
    ? Object.fromEntries(Object.entries(rawCursor.salesByTeam).filter(([teamId, cursor]) => cleanId(teamId) && Number.isInteger(cursor) && cursor >= 0).map(([teamId, cursor]) => [teamId, cursor]))
    : {};
  const saleAssignmentModes = input.saleAssignmentModes && typeof input.saleAssignmentModes === 'object' && !Array.isArray(input.saleAssignmentModes)
    ? Object.fromEntries(Object.entries(input.saleAssignmentModes).filter(([leaderId, mode]) => cleanId(leaderId) && ['MANUAL', 'ROUND_ROBIN', 'BALANCED'].includes(mode)))
    : {};
  return {
    leaderCanUpdate: typeof input.leaderCanUpdate === 'boolean' ? input.leaderCanUpdate : defaults.leaderCanUpdate,
    notifyMilestones: typeof input.notifyMilestones === 'boolean' ? input.notifyMilestones : defaults.notifyMilestones,
    assignmentMode,
    saleAssignmentModes,
    assignmentCursor: { leaders: cleanNumber(rawCursor.leaders, defaults.assignmentCursor.leaders, 0, Number.MAX_SAFE_INTEGER, true), salesByTeam },
    slaMinutes: cleanNumber(input.slaMinutes, defaults.slaMinutes, 5, 1440, true),
    customAccent: /^#[0-9a-f]{6}$/i.test(input.customAccent) ? input.customAccent : (defaults.customAccent || '#e8572a'),
    fontFamily: cleanText(input.fontFamily, defaults.fontFamily || 'aptos', 40),
    dataBotToken: cleanText(input.dataBotToken || input.telegramBotToken, '', 200),
    dataBotChatId: cleanText(input.dataBotChatId || input.telegramChatId, '', 100),
    memberBotToken: cleanText(input.memberBotToken, '', 200),
    memberBotChatId: cleanText(input.memberBotChatId, '', 100),
    webhookPublicBase: cleanWebhookBase(input.webhookPublicBase, defaults.webhookPublicBase),
    attendanceIp: cleanText(input.attendanceIp, defaults.attendanceIp || '', 200),
    // Migration một lần: giờ chốt cũ 08:30 nâng lên 09:00 theo quy định mới.
    attendanceDeadline: (() => { const raw = cleanClockTime(input.attendanceDeadline, defaults.attendanceDeadline || '09:00'); return raw === '08:30' ? '09:00' : raw; })(),
    acceptTimeoutHours: cleanNumber(input.acceptTimeoutHours, defaults.acceptTimeoutHours || 8, 1, 72, true),
    notifyAccountCreated: input.notifyAccountCreated !== false,
    notifyDataReceived: input.notifyDataReceived !== false
  };
}

function normalizeAttendanceRecord(item, members = STAFF) {
  const id = cleanId(item.id);
  const account = members.find(person => person.id === item.accountId);
  const date = cleanDate(item.date);
  const at = cleanTimestamp(item.at);
  if (!id || !account || !date || !at) return null;
  return {
    id,
    date,
    accountId: account.id,
    name: cleanText(item.name, account.name, 120),
    teamId: cleanId(item.teamId) || account.teamId || '',
    at,
    ip: cleanText(item.ip, '', 64),
    late: item.late === true,
    lateMinutes: cleanNumber(item.lateMinutes, 0, 0, 1440, true),
    ipValid: item.ipValid !== false,
    note: cleanText(item.note, '', 300),
    editedBy: cleanText(item.editedBy, '', 120)
  };
}

function normalizeDataOfferRecord(item, customerIds, members = STAFF) {
  const id = cleanId(item.id);
  const customerId = cleanId(item.customerId);
  const sale = members.find(person => person.role === 'SALE' && person.id === item.saleId);
  const leader = members.find(person => person.role === 'LEADER' && person.id === item.leaderId);
  const offeredAt = cleanTimestamp(item.offeredAt);
  if (!id || !customerIds.has(customerId) || !sale || !leader || !offeredAt) return null;
  const status = ['PENDING', 'ACCEPTED', 'EXPIRED'].includes(item.status) ? item.status : 'PENDING';
  return {
    id,
    customerId,
    saleId: sale.id,
    leaderId: leader.id,
    teamId: cleanId(item.teamId) || leader.teamId,
    offeredAt,
    status,
    resolvedAt: status === 'PENDING' ? '' : cleanTimestamp(item.resolvedAt),
    source: cleanText(item.source, 'MANUAL', 40)
  };
}

function normalizeMemberRecord(member) {
  const id = cleanId(member.id);
  const role = ['LEADER', 'SALE'].includes(member.role) ? member.role : null;
  const teamId = cleanId(member.teamId);
  if (!id || !role || !teamId) return null;
  return {
    id,
    name: cleanText(member.name, 'Nhân sự', 160),
    role,
    teamId,
    leaderId: role === 'SALE' ? cleanId(member.leaderId) : null,
    initials: cleanText(member.initials, 'NV', 4).toUpperCase(),
    createdBy: cleanText(member.createdBy, 'Hệ thống', 160),
    target: role === 'SALE' ? cleanNumber(member.target, 80000000, 0, Number.MAX_SAFE_INTEGER, true) : 0,
    active: typeof member.active === 'boolean' ? member.active : true
  };
}

function normalizeCustomerRecord(customer, members = STAFF, websites = [], fieldDefinitions = CUSTOM_FIELD_SEED) {
  const id = cleanId(customer.id);
  const createdAt = cleanTimestamp(customer.createdAt);
  if (!id || !createdAt) return null;
  const sale = members.find(person => person.role === 'SALE' && person.id === customer.saleId);
  const leader = !sale && members.find(person => person.role === 'LEADER' && person.id === customer.leaderId);
  const requestedWebsiteId = cleanId(customer.websiteId);
  const websiteId = websites.some(website => website.id === requestedWebsiteId) ? requestedWebsiteId : null;
  const sourceFields = customer.customFields && typeof customer.customFields === 'object' && !Array.isArray(customer.customFields) ? customer.customFields : {};
  const customFields = Object.fromEntries(fieldDefinitions.map(field => {
    const rawValue = Object.hasOwn(sourceFields, field.id) ? sourceFields[field.id] : defaultCustomFieldValue(field);
    const sanitized = sanitizeCustomFieldValue(rawValue, field);
    return [field.id, sanitized === '' && field.id === 'customerLevel' ? 'L0' : sanitized];
  }));
  return {
    id,
    name: cleanText(customer.name, 'Khách chưa đặt tên', 160),
    phone: cleanText(customer.phone, '', 20),
    email: cleanText(customer.email, '', 254),
    ipAddress: cleanText(customer.ipAddress || customer.ip, 'Chưa xác định', 64),
    source: dataTerminology(cleanText(customer.source, 'Direct / Referral', 120)),
    campaign: dataTerminology(cleanText(customer.campaign, 'DIRECT', 160)),
    landingPageName: cleanText(customer.landingPageName || customer.landingPage || websites.find(website => website.id === websiteId)?.domain, 'Chưa xác định landing page', 200),
    productName: cleanText(customer.productName || customer.product || customer.sanpham, 'Chưa xác định sản phẩm', 200),
    websiteId,
    status: Object.hasOwn(STATUS_META, customer.status) ? customer.status : 'NEW',
    saleId: sale?.id || null,
    leaderId: sale?.leaderId || leader?.id || null,
    teamId: sale?.teamId || leader?.teamId || null,
    createdAt,
    updatedAt: cleanTimestamp(customer.updatedAt, createdAt),
    saleAcceptedAt: cleanTimestamp(customer.saleAcceptedAt),
    note: dataTerminology(cleanText(customer.note, '', 2000)),
    customFields
  };
}

function normalizeOrderRecord(order, customers, members = STAFF, websites = []) {
  const id = cleanId(order.id);
  const customerId = cleanId(order.customerId);
  const customer = customers.find(item => item.id === customerId);
  const sale = members.find(person => person.role === 'SALE' && person.id === order.saleId);
  const leader = members.find(person => person.role === 'LEADER' && person.id === order.leaderId);
  const teamId = cleanId(order.teamId);
  const createdAt = cleanTimestamp(order.createdAt);
  if (!id || !customer || !sale || !leader || !teamId || !createdAt) return null;
  const product = PRODUCTS.find(item => item.id === order.productId);
  if (!product) return null;
  const qty = cleanNumber(order.qty, 1, 1, 1000, true);
  const unitPrice = cleanNumber(order.unitPrice, product.price);
  const computedSubtotal = Math.min(unitPrice * qty, Number.MAX_SAFE_INTEGER);
  const subtotal = computedSubtotal;
  const discount = cleanNumber(order.discount, 0, 0, subtotal);
  const total = Math.max(0, subtotal - discount);
  const status = Object.hasOwn(ORDER_STATUS, order.status) ? order.status : 'PENDING';
  const paidAt = ['PAID', 'REFUNDED'].includes(status) ? cleanTimestamp(order.paidAt) : null;
  const refundedAt = status === 'REFUNDED' ? cleanTimestamp(order.refundedAt) : null;
  if (['PAID', 'REFUNDED'].includes(status) && !paidAt) return null;
  if (status === 'REFUNDED' && !refundedAt) return null;
  const legacyReconciled = typeof order.reconciled === 'boolean' ? order.reconciled : false;
  return {
    id,
    code: cleanText(order.code, id, 120),
    customerId,
    customerName: cleanText(order.customerName, 'Khách hàng', 160),
    saleId: sale.id,
    leaderId: leader.id,
    teamId,
    source: orderSource(cleanText(order.source, customer.source, 120)),
    campaign: cleanText(order.campaign, customer.campaign || 'UNATTRIBUTED', 160),
    websiteId: websites.some(website => website.id === order.websiteId) ? order.websiteId : null,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    qty,
    unitPrice,
    subtotal,
    discount,
    total,
    refund: status === 'REFUNDED' ? cleanNumber(order.refund, total, 0, total) : 0,
    status,
    createdAt,
    paidAt,
    refundedAt,
    paymentMethod: cleanText(order.paymentMethod, 'Chuyển khoản', 100),
    paymentReconciled: typeof order.paymentReconciled === 'boolean' ? order.paymentReconciled : legacyReconciled,
    refundReconciled: refundedAt ? (typeof order.refundReconciled === 'boolean' ? order.refundReconciled : legacyReconciled) : null
  };
}

function normalizeTrafficRecord(event, members = STAFF) {
  const id = cleanId(event.id);
  const date = cleanDate(event.date);
  const sale = members.find(person => person.role === 'SALE' && person.id === event.saleId);
  const meta = TRAFFIC_META.find(item => item.source === event.source);
  if (!id || !date || !sale || !meta) return null;
  return {
    id,
    date,
    saleId: sale.id,
    leaderId: sale.leaderId,
    teamId: sale.teamId,
    sessions: cleanNumber(event.sessions, 0, 0, Number.MAX_SAFE_INTEGER, true),
    leads: cleanNumber(event.leads, 0, 0, Number.MAX_SAFE_INTEGER, true),
    spend: cleanNumber(event.spend, 0),
    source: meta.source,
    medium: meta.medium,
    campaign: dataTerminology(cleanText(event.campaign, meta.campaign, 160)),
    color: meta.color
  };
}

function normalizeTaskRecord(task, slaMinutes, customerIds, members = STAFF) {
  const id = cleanId(task.id);
  const customerId = cleanId(task.customerId);
  const owner = members.find(person => person.role === 'SALE' && person.id === task.ownerId);
  const dueAt = cleanTimestamp(task.dueAt);
  if (!id || !customerId || !customerIds.has(customerId) || !owner || !dueAt) return null;
  const type = dataTerminology(cleanText(task.type, 'Chăm sóc khách hàng', 160));
  const slaBased = typeof task.slaBased === 'boolean' ? task.slaBased : ['Gọi tư vấn', 'Liên hệ data mới'].includes(type);
  const createdAtFallback = slaBased ? shiftStamp(dueAt, -slaMinutes) : dueAt;
  return {
    id,
    customerId,
    customerName: cleanText(task.customerName, 'Khách hàng', 160),
    ownerId: owner.id,
    leaderId: owner.leaderId,
    teamId: owner.teamId,
    type,
    createdAt: cleanTimestamp(task.createdAt, createdAtFallback),
    dueAt,
    slaBased,
    status: ['OPEN', 'OVERDUE', 'DONE'].includes(task.status) ? task.status : 'OPEN',
    priority: task.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
    ...(cleanTimestamp(task.completedAt) ? { completedAt: cleanTimestamp(task.completedAt) } : {}),
    ...(typeof task.resolution === 'string' ? { resolution: cleanText(task.resolution, '', 200) } : {})
  };
}

function normalizeNotificationRecord(item, members = STAFF) {
  const id = cleanId(item.id);
  if (!id || !['ALL', 'ADMIN', 'LEADER', 'TEAM', 'OWN'].includes(item.role)) return null;
  const leader = members.find(person => person.role === 'LEADER' && person.id === item.leaderId);
  const sale = members.find(person => person.role === 'SALE' && person.id === item.saleId);
  const validTeamIds = new Set(members.map(person => person.teamId));
  if (item.role === 'LEADER' && !leader) return null;
  if (item.role === 'TEAM' && !validTeamIds.has(item.teamId)) return null;
  if (item.role === 'OWN' && !sale) return null;
  const accountIds = new Set(ACCOUNTS.map(account => account.id));
  return {
    id,
    role: item.role,
    ...(leader ? { leaderId: leader.id, teamId: leader.teamId } : {}),
    ...(item.role === 'TEAM' ? { teamId: item.teamId } : {}),
    ...(sale ? { saleId: sale.id, leaderId: sale.leaderId, teamId: sale.teamId } : {}),
    title: dataTerminology(cleanText(item.title, 'Thông báo', 200)),
    text: dataTerminology(cleanText(item.text, '', 1000)),
    at: cleanTimestamp(item.at, stamp()),
    readBy: Array.isArray(item.readBy) ? Array.from(new Set(item.readBy.filter(idValue => accountIds.has(idValue)))) : []
  };
}

function normalizeAuditRecord(item) {
  const id = cleanId(item.id);
  if (!id) return null;
  return { id, actorId: cleanId(item.actorId), actor: cleanText(item.actor, 'System', 160), role: ['ADMIN', 'LEADER', 'SALE', 'SYSTEM'].includes(item.role) ? item.role : 'SYSTEM', action: cleanText(item.action, 'UNKNOWN', 120), entity: cleanText(item.entity, '', 120), detail: dataTerminology(cleanText(item.detail, '', 2000)), at: cleanTimestamp(item.at, stamp()) };
}

function normalizeWebsiteRecord(item) {
  const id = cleanId(item.id);
  if (!id) return null;
  const connectionStatus = ['UNCONFIGURED', 'PENDING_BACKEND', 'VERIFIED', 'ERROR'].includes(item.connectionStatus) ? item.connectionStatus : 'UNCONFIGURED';
  return {
    id,
    name: dataTerminology(cleanText(item.name, 'Website', 200)),
    domain: cleanText(item.domain, '', 253),
    status: item.status === 'ACTIVE' && connectionStatus === 'VERIFIED' ? 'ACTIVE' : 'PAUSED',
    provider: ['LANDING_API', 'FACEBOOK_FORMS', 'TIKTOK_FORMS', 'CUSTOM_WEBHOOK'].includes(item.provider) ? item.provider : 'LANDING_API',
    endpoint: cleanText(item.endpoint, '', 500),
    externalAccountId: cleanText(item.externalAccountId, '', 160),
    campaignId: cleanText(item.campaignId, '', 160),
    formId: cleanText(item.formId, '', 160),
    webhookSlug: cleanWebhookSlug(item.webhookSlug) || generateWebhookSlug(),
    webhookUrlOverride: cleanWebhookOverride(item.webhookUrlOverride),
    connectionStatus,
    domainVerificationStatus: item.domainVerificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
    credentialConfigured: item.credentialConfigured === true,
    credentialLast4: cleanText(item.credentialLast4, '', 4).length === 4 ? cleanText(item.credentialLast4, '', 4) : '',
    lastVerifiedAt: cleanTimestamp(item.lastVerifiedAt),
    lastError: cleanText(item.lastError, '', 500),
    lastSync: cleanText(item.lastSync, 'Chưa đồng bộ', 80)
  };
}

const WEBHOOK_SLUG_PATTERN = /^ds-\d{13}-[A-Z0-9]{11}$/;
const WEBHOOK_SUFFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_WEBHOOK_BASE = 'https://nvtagency.top';

function randomWebhookSuffix(length) {
  const cryptoRef = typeof crypto !== 'undefined' && crypto ? crypto : null;
  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    cryptoRef.getRandomValues(bytes);
    return Array.from(bytes, byte => WEBHOOK_SUFFIX_ALPHABET[byte % WEBHOOK_SUFFIX_ALPHABET.length]).join('');
  }
  let suffix = '';
  for (let index = 0; index < length; index += 1) suffix += WEBHOOK_SUFFIX_ALPHABET[Math.floor(Math.random() * WEBHOOK_SUFFIX_ALPHABET.length)];
  return suffix;
}

function generateWebhookSlug() {
  return `ds-${Date.now()}-${randomWebhookSuffix(11)}`;
}

function cleanWebhookSlug(value) {
  const slug = cleanText(value, '', 60).trim();
  return WEBHOOK_SLUG_PATTERN.test(slug) ? slug : '';
}

function cleanWebhookBase(value, fallback) {
  const candidate = cleanText(value, '', 200).trim().replace(/\/+$/, '');
  if (/^https:\/\/[^\s]+$/i.test(candidate)) return candidate;
  const backup = cleanText(fallback, '', 200).trim().replace(/\/+$/, '');
  return /^https:\/\/[^\s]+$/i.test(backup) ? backup : DEFAULT_WEBHOOK_BASE;
}

function cleanWebhookOverride(value) {
  const url = cleanText(value, '', 500).trim();
  if (!/^https:\/\/[^\s]+$/i.test(url)) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

function webhookPublicBase() {
  return cleanWebhookBase(state.settings.webhookPublicBase, DEFAULT_WEBHOOK_BASE);
}

function webhookUrlFor(website) {
  const slug = cleanWebhookSlug(website?.webhookSlug);
  if (!slug) return '';
  return cleanWebhookOverride(website?.webhookUrlOverride) || `${webhookPublicBase()}/api/data-sources/webhook/${slug}/`;
}

function webhookLocalUrlFor(website) {
  const slug = cleanWebhookSlug(website?.webhookSlug);
  const origin = typeof window !== 'undefined' && window && window.location ? window.location.origin : '';
  if (!slug || !origin) return '';
  return `${origin}/api/data-sources/webhook/${slug}/`;
}

function websiteByWebhookSlug(slug) {
  const wanted = cleanText(slug, '', 60).trim().toUpperCase();
  if (!wanted) return null;
  return state.websites.find(website => String(website.webhookSlug || '').toUpperCase() === wanted) || null;
}

function webhookPanelMarkup(website) {
  const url = webhookUrlFor(website);
  const localUrl = webhookLocalUrlFor(website);
  const overridden = Boolean(cleanWebhookOverride(website.webhookUrlOverride));
  const urlRow = url
    ? `<div class="webhook-url-row"><input class="mono webhook-url" id="webhookUrl-${escapeHtml(website.id)}" readonly value="${escapeHtml(url)}" aria-label="Webhook URL của ${escapeHtml(website.name)}"><button class="button button-small" type="button" data-copy-webhook="${escapeHtml(website.id)}">Sao chép</button><button class="button button-small" type="button" data-edit-webhook="${escapeHtml(website.id)}">Sửa URL</button></div>`
    : `<div class="webhook-url-row"><span class="webhook-empty">Chưa có mã webhook</span><button class="button button-small button-primary" type="button" data-generate-webhook="${escapeHtml(website.id)}">Tạo mã webhook</button></div>`;
  return `<div class="webhook-box"><div class="webhook-box-head"><b>Webhook nhận data landing page</b><span class="webhook-tag mono">POST · application/json${overridden ? ' · URL tùy chỉnh' : ''}</span></div>${urlRow}<div class="credential-hint">Dán URL này vào LadiPage (Lưu data → API). Server chỉ lấy <b>họ tên, SĐT, email</b>; data rơi thẳng vào <b>Chia Leader → Thứ tự data mới vào</b>.${localUrl && localUrl !== url ? `<br><span class="mono">Test nội bộ: ${escapeHtml(localUrl)}</span>` : ''}${website.lastError ? `<br>${escapeHtml(website.lastError)}` : `<br>Lần nhận cuối: ${escapeHtml(website.lastSync)}`}</div></div>`;
}

/* ------------------------------------------------- webhook inbox consumer
   16-webhook-server.cjs là nơi DUY NHẤT nhận webhook từ LadiPage. Frontend
   tĩnh này không tự bịa inbox: nó chỉ ĐỌC inbox của server bằng cursor rồi
   đưa bản ghi status NEW qua đúng ingestCustomer() — cùng một ống dẫn như
   sale tạo khách thủ công, nên dedupe theo SĐT, luật chia theo nguồn và
   hàng chờ "Chia Leader → Thứ tự data mới vào" đều giữ nguyên hành vi.

   Chỉ Admin chạy consumer: ingestCustomer phân nhánh theo role đang đăng nhập
   (SALE → gắn thẳng vào sale đó, LEADER → gắn vào team đó). Chạy dưới role
   SALE/LEADER sẽ quy nhầm chủ phụ trách cho data landing page, và hai role này
   cũng không được nhìn trường nguồn (hợp đồng §9).

   Slug webhook là khóa truy cập nên KHÔNG bao giờ đi vào note của khách hay
   audit log. Nó chỉ nằm trong localStorage của Admin, ngang hàng với
   state.websites[].webhookSlug vốn đã được lưu ở đó.
-------------------------------------------------------------------------- */
const WEBHOOK_CURSOR_KEY = 'nvt-crm-webhook-cursor-v1';
const WEBHOOK_CONSUMED_KEY = 'nvt-crm-webhook-consumed-v1';
const WEBHOOK_PENDING_KEY = 'nvt-crm-webhook-pending-v1';
const WEBHOOK_CONSUMED_RING = 400;
const WEBHOOK_PENDING_CAP = 200;
const WEBHOOK_FETCH_TIMEOUT_MS = 8000;
const WEBHOOK_POLL_LIVE_MS = 30000;
const WEBHOOK_POLL_IDLE_MS = 5000;

const WEBHOOK_TRANSPORT_META = {
  idle: ['Chưa bật đồng bộ', 'pending'],
  syncing: ['Đang đồng bộ...', 'info'],
  live: ['Đang nghe trực tiếp', 'active'],
  polling: ['Hỏi server định kỳ', 'info'],
  offline: ['Chưa thấy server webhook', 'pending'],
  error: ['Lỗi đọc inbox', 'cancelled']
};

const WEBHOOK_INTAKE_CONTEXT = { intakeType: 'API', sourceLabel: 'Landing page webhook' };

let webhookTransport = { mode: 'idle', detail: 'Đăng nhập bằng tài khoản Admin để bắt đầu đồng bộ data landing page.', checkedAt: '' };
let webhookPending = loadWebhookPending();
let webhookEventSource = null;
let webhookPollTimer = null;
let webhookPulling = false;

function loadWebhookPending() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WEBHOOK_PENDING_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item.id === 'string' && item.customer && typeof item.customer === 'object')
      .slice(-WEBHOOK_PENDING_CAP);
  } catch (error) { return []; }
}

function saveWebhookPending() {
  try { localStorage.setItem(WEBHOOK_PENDING_KEY, JSON.stringify(webhookPending.slice(-WEBHOOK_PENDING_CAP))); } catch (error) {}
}

function loadWebhookCursor() {
  try { return String(localStorage.getItem(WEBHOOK_CURSOR_KEY) || '').slice(0, 64); } catch (error) { return ''; }
}

function saveWebhookCursor(id) {
  try { localStorage.setItem(WEBHOOK_CURSOR_KEY, String(id || '').slice(0, 64)); } catch (error) {}
}

function loadWebhookConsumed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WEBHOOK_CONSUMED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string').slice(-WEBHOOK_CONSUMED_RING) : [];
  } catch (error) { return []; }
}

// Trả về false khi bản ghi đã được xử lý rồi. Vòng ring này là chốt chặn cuối:
// server trả VỀ TOÀN BỘ inbox khi cursor không còn tồn tại trong đó (inbox bị
// xoá, hoặc bị cắt theo giới hạn 5000 bản ghi). Không có nó thì mỗi lần như vậy
// cả loạt khách cũ sẽ bị ingest lại thành "điền lại form".
function claimWebhookRecord(id) {
  if (!id) return false;
  const consumed = loadWebhookConsumed();
  if (consumed.includes(id)) return false;
  consumed.push(id);
  try { localStorage.setItem(WEBHOOK_CONSUMED_KEY, JSON.stringify(consumed.slice(-WEBHOOK_CONSUMED_RING))); } catch (error) {}
  return true;
}

function webhookApiBase() {
  const origin = typeof window !== 'undefined' && window && window.location ? window.location.origin : '';
  return /^https?:\/\/[^/]+$/.test(origin) ? origin : '';
}

/* IP của phiên chỉ được dùng cho hai luồng người dùng đã chốt: sale tạo khách
   và khách tự đăng ký từ web. Data landing page KHÔNG lấy IP (server đã bỏ).
   Frontend không tự đoán IP — nó hỏi server qua /api/session-context, vì chỉ
   reverse proxy/backend mới thấy IP thật của người gọi. Chưa hỏi được thì giữ
   nhãn cũ, tuyệt đối không bịa một IP trông như thật. */
let sessionContextIp = '';
let sessionContextLoaded = false;

async function refreshSessionContext() {
  const base = webhookApiBase();
  if (!base || sessionContextLoaded) return sessionContextIp;
  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), WEBHOOK_FETCH_TIMEOUT_MS) : null;
    let payload;
    try {
      const response = await fetch(`${base}/api/session-context`, { headers: { Accept: 'application/json' }, signal: controller ? controller.signal : undefined });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } finally { if (timer) clearTimeout(timer); }
    const ip = cleanText(payload && payload.ip, '', 64).trim();
    if (ip) { sessionContextIp = ip; sessionContextLoaded = true; }
  } catch (error) { /* server chưa chạy — giữ nhãn "chờ backend" */ }
  return sessionContextIp;
}

function sessionIp(fallback) {
  return sessionContextIp || fallback;
}

function setWebhookTransport(mode, detail) {
  webhookTransport = { mode, detail: String(detail || ''), checkedAt: stamp() };
  paintWebhookTransport();
}

function paintWebhookTransport() {
  const meta = WEBHOOK_TRANSPORT_META[webhookTransport.mode] || WEBHOOK_TRANSPORT_META.idle;
  const chip = $('[data-webhook-transport]');
  if (chip) { chip.className = `status status-${meta[1]}`; chip.textContent = meta[0]; }
  const detail = $('[data-webhook-transport-detail]');
  if (detail) detail.textContent = webhookTransport.detail;
  const counter = $('[data-webhook-pending-count]');
  if (counter) counter.textContent = number(webhookPending.length);
}

function queueWebhookPending(record, customer, problem, reason) {
  if (webhookPending.some(item => item.id === record.id)) return 'pending';
  webhookPending.push({
    id: record.id,
    slug: String(record.slug || ''),
    receivedAt: String(record.receivedAt || ''),
    problem,
    reason: String(reason || ''),
    customer: {
      name: String(customer.name || ''),
      phone: String(customer.phone || ''),
      email: String(customer.email || '')
    }
  });
  webhookPending = webhookPending.slice(-WEBHOOK_PENDING_CAP);
  saveWebhookPending();
  return 'pending';
}

function webhookIngestFields(item, website) {
  // Không truyền ipAddress: theo quy tắc đã chốt, landing page chỉ lấy họ tên,
  // SĐT, email — ingestCustomer tự để 'Chưa xác định'.
  // Không truyền note: để ingestCustomer dùng mặc định "Data từ <domain>".
  // campaign chỉ lấy từ ánh xạ của chính website — adapter cố tình bỏ
  // utm_campaign của LadiPage, nên tự nhận campaign ở đây là bịa data.
  return {
    name: item.name,
    phone: item.phone,
    email: item.email,
    websiteId: website.id,
    source: 'Landing Page',
    campaign: website.campaignId || 'UNATTRIBUTED'
  };
}

function ingestWebhookRecord(record) {
  if (!record || typeof record !== 'object') return 'ignored';
  if (record.status !== 'NEW') return 'ignored'; // INVALID đã bị server chặn ở 422
  if (!claimWebhookRecord(record.id)) return 'duplicate';
  const customer = record.customer && typeof record.customer === 'object' ? record.customer : {};
  const website = websiteByWebhookSlug(record.slug);
  // Không có website khớp mã → hàng UNATTRIBUTED chờ Admin quy nguồn.
  // Hợp đồng §10: "không có fallback ngầm" — tuyệt đối không tự gán WEB-1.
  if (!website) return queueWebhookPending(record, customer, 'UNATTRIBUTED', 'Chưa có website nào dùng mã webhook này');
  const result = ingestCustomer(webhookIngestFields(customer, website), WEBHOOK_INTAKE_CONTEXT);
  if (result.created) return 'created';
  if (result.duplicate) return 'resubmission';
  return queueWebhookPending(record, customer, 'REJECTED', result.error || 'Không tạo được khách hàng');
}

async function pullWebhookInbox(manual = false) {
  if (webhookPulling) return { pulled: 0, busy: true };
  if (!currentAccount || currentAccount.role !== 'ADMIN') return { pulled: 0, skipped: true };
  const base = webhookApiBase();
  if (!base) {
    setWebhookTransport('offline', 'Chỉ đồng bộ được khi mở CRM qua server Node (http://localhost:4173).');
    return { pulled: 0 };
  }
  webhookPulling = true;
  if (manual) setWebhookTransport('syncing', 'Đang đọc inbox webhook từ server...');
  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), WEBHOOK_FETCH_TIMEOUT_MS) : null;
    let payload;
    try {
      const response = await fetch(`${base}/api/data-sources/inbox?since=${encodeURIComponent(loadWebhookCursor())}`, {
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } finally { if (timer) clearTimeout(timer); }

    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    const tally = { created: 0, resubmission: 0, pending: 0, ignored: 0, duplicate: 0 };
    for (const record of items) {
      const outcome = ingestWebhookRecord(record);
      tally[outcome] = (tally[outcome] || 0) + 1;
    }
    if (payload && typeof payload.lastId === 'string' && payload.lastId) saveWebhookCursor(payload.lastId);

    const touched = tally.created + tally.resubmission + tally.pending;
    // render() dựng lại #content nên phải vẽ lại cả nhãn trạng thái đồng bộ.
    if (touched) { saveState(); refreshTaskStatuses(); render(); }

    const live = Boolean(webhookEventSource && webhookEventSource.readyState === 1);
    const at = stamp().slice(11);
    if (touched) {
      const parts = [];
      if (tally.created) parts.push(`${tally.created} khách mới`);
      if (tally.resubmission) parts.push(`${tally.resubmission} trùng · ghi nhận điền lại form`);
      if (tally.pending) parts.push(`${tally.pending} chờ quy nguồn`);
      setWebhookTransport(live ? 'live' : 'polling', `Vừa nhận ${touched} data landing page lúc ${at}: ${parts.join(', ')}.`);
      if (tally.created) toast(`${tally.created} khách landing page đã vào hàng chờ chia Leader`);
      else if (manual) toast(`Đã đồng bộ ${touched} data landing page`);
    } else {
      setWebhookTransport(live ? 'live' : 'polling', `Đã kiểm tra inbox lúc ${at} — chưa có data mới từ landing page.`);
      if (manual) toast('Đã kiểm tra inbox webhook — chưa có data mới');
    }
    return { pulled: touched, tally };
  } catch (error) {
    const reason = error && error.name === 'AbortError'
      ? 'server phản hồi quá chậm'
      : 'server webhook chưa chạy hoặc mở sai cổng';
    setWebhookTransport('offline', `Chưa đọc được inbox (${reason}). CRM vẫn dùng bình thường với dữ liệu cục bộ.`);
    if (manual) toast(`Chưa kết nối được server webhook — ${reason}`);
    return { pulled: 0, error: reason };
  } finally {
    webhookPulling = false;
  }
}

function scheduleWebhookPoll() {
  if (webhookPollTimer) clearTimeout(webhookPollTimer);
  const live = Boolean(webhookEventSource && webhookEventSource.readyState === 1);
  webhookPollTimer = setTimeout(() => {
    webhookPollTimer = null;
    Promise.resolve(pullWebhookInbox(false)).then(scheduleWebhookPoll, scheduleWebhookPoll);
  }, live ? WEBHOOK_POLL_LIVE_MS : WEBHOOK_POLL_IDLE_MS);
}

function startWebhookConsumer() {
  stopWebhookConsumer();
  if (!currentAccount || currentAccount.role !== 'ADMIN') return;
  const base = webhookApiBase();
  if (!base) {
    setWebhookTransport('offline', 'Chỉ đồng bộ được khi mở CRM qua server Node (http://localhost:4173).');
    return;
  }
  if (typeof EventSource === 'function') {
    try {
      webhookEventSource = new EventSource(`${base}/api/data-sources/stream`);
      webhookEventSource.onopen = () => setWebhookTransport('live', 'Đang nghe webhook landing page theo thời gian thật (SSE).');
      webhookEventSource.onmessage = () => { pullWebhookInbox(false); };
      // SSE tự nối lại theo "retry: 3000" của server; vòng poll vẫn chạy nền nên
      // data tới trong lúc đứt kênh không bị mất.
      webhookEventSource.onerror = () => setWebhookTransport('polling', 'Kênh trực tiếp gián đoạn — đang hỏi server định kỳ, data không bị mất.');
    } catch (error) { webhookEventSource = null; }
  }
  scheduleWebhookPoll();
  pullWebhookInbox(false);
}

function stopWebhookConsumer() {
  if (webhookPollTimer) { clearTimeout(webhookPollTimer); webhookPollTimer = null; }
  if (webhookEventSource) { try { webhookEventSource.close(); } catch (error) {} webhookEventSource = null; }
}

function webhookPendingModal() {
  if (!currentAccount || currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quy nguồn data'); return; }
  if (!webhookPending.length) { toast('Không còn data landing page nào chờ xử lý'); return; }
  const problemMeta = { UNATTRIBUTED: ['Chưa quy nguồn', 'pending'], REJECTED: ['Bị từ chối', 'cancelled'] };
  const options = state.websites.map(site => `<option value="${escapeHtml(site.id)}">${escapeHtml(site.name)} — ${escapeHtml(site.domain)}</option>`).join('');
  const rows = webhookPending.slice().reverse().map(item => {
    const meta = problemMeta[item.problem] || problemMeta.UNATTRIBUTED;
    return `<tr><td class="mono">${escapeHtml(item.receivedAt || '—')}</td><td><div class="cell-main">${escapeHtml(item.customer.name || 'Không có họ tên')}</div><div class="cell-sub">${escapeHtml(item.customer.phone || 'không có SĐT')}${item.customer.email ? ` · ${escapeHtml(item.customer.email)}` : ''}</div></td><td><span class="status status-${meta[1]}">${meta[0]}</span><div class="cell-sub">${escapeHtml(item.reason)}</div></td><td><select data-pending-website="${escapeHtml(item.id)}" aria-label="Chọn website để quy nguồn cho data này">${options}</select></td><td><button class="button button-small button-primary" type="button" data-resolve-pending="${escapeHtml(item.id)}">Quy nguồn</button> <button class="button button-small" type="button" data-drop-pending="${escapeHtml(item.id)}">Bỏ qua</button></td></tr>`;
  }).join('');
  openModal(`Data landing page chờ xử lý · ${webhookPending.length}`, `<div class="credential-hint">Đây là các bản ghi <b>server webhook đã nhận thật</b> nhưng CRM chưa đưa được vào tệp khách: hoặc mã webhook chưa gắn với website nào, hoặc dữ liệu không qua được bước kiểm tra tạo khách. Chọn website rồi bấm <b>Quy nguồn</b> — bản ghi đi qua đúng ống dẫn tạo khách và xuất hiện ở <b>Chia Leader → Thứ tự data mới vào</b>. Không bản ghi nào bị âm thầm gán cho một website mặc định.</div><div class="table-wrap"><table><thead><tr><th>Thời điểm nhận</th><th>Khách hàng</th><th>Vấn đề</th><th>Quy vào website</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="modal-actions"><button class="button" type="button" data-close-modal>Đóng</button></div>`);
  $$('[data-pending-website]').forEach(select => {
    const item = webhookPending.find(row => row.id === select.dataset.pendingWebsite);
    const suggested = item ? websiteByWebhookSlug(item.slug) : null;
    if (suggested) select.value = suggested.id;
  });
  $$('[data-resolve-pending]').forEach(button => button.onclick = () => {
    const select = $(`[data-pending-website="${button.dataset.resolvePending}"]`);
    resolveWebhookPending(button.dataset.resolvePending, select ? select.value : '');
  });
  $$('[data-drop-pending]').forEach(button => button.onclick = () => dropWebhookPending(button.dataset.dropPending));
}

function resolveWebhookPending(id, websiteId) {
  const index = webhookPending.findIndex(item => item.id === id);
  if (index === -1) { toast('Bản ghi này đã được xử lý rồi'); webhookPendingModal(); return; }
  const website = websiteById(websiteId);
  if (!website) { toast('Hãy chọn website để quy nguồn'); return; }
  const item = webhookPending[index];
  webhookPending.splice(index, 1);
  saveWebhookPending();
  const result = ingestCustomer(webhookIngestFields(item.customer, website), WEBHOOK_INTAKE_CONTEXT);
  if (result.created) {
    audit('ASSIGN_WEBSITE_SOURCE', website.id, `Quy nguồn data landing page cho khách ${result.customer.name}`);
    saveState(); refreshTaskStatuses();
    render();
    if (webhookPending.length) webhookPendingModal(); else closeModal();
    toast(`Đã quy nguồn vào ${website.name} — khách vào hàng chờ chia Leader`);
    return;
  }
  if (result.duplicate) {
    saveState();
    render();
    if (webhookPending.length) webhookPendingModal(); else closeModal();
    toast('Khách này đã có trong CRM — đã ghi nhận một lần điền lại form');
    return;
  }
  webhookPending.splice(index, 0, { ...item, problem: 'REJECTED', reason: result.error || 'Không tạo được khách hàng' });
  saveWebhookPending(); render(); webhookPendingModal();
  toast(result.error || 'Không tạo được khách hàng');
}

function dropWebhookPending(id) {
  const index = webhookPending.findIndex(item => item.id === id);
  if (index === -1) return;
  const [removed] = webhookPending.splice(index, 1);
  saveWebhookPending();
  if (!webhookPending.length) { closeModal(); render(); toast('Đã xử lý hết data chờ'); return; }
  render(); webhookPendingModal();
  toast(`Đã bỏ qua data của ${removed.customer.name || 'khách không tên'}`);
}

// Hiện ở hàng chờ "Chia Leader" để Admin thấy ngay có data landing page chưa
// vào được tệp khách, thay vì phải đi vòng qua mục Websites.
function webhookQueueNoticeMarkup() {
  if (!webhookPending.length) return '';
  return `<div class="webhook-pending" data-webhook-pending-banner><b>${number(webhookPending.length)}</b> data landing page đã về server nhưng chưa vào được hàng chờ. <button class="button button-small button-primary" type="button" data-webhook-pending="1">Xem &amp; quy nguồn</button></div>`;
}

function webhookTransportMarkup() {
  const meta = WEBHOOK_TRANSPORT_META[webhookTransport.mode] || WEBHOOK_TRANSPORT_META.idle;
  return `<section class="panel webhook-transport" style="margin-bottom:14px"><div class="panel-body"><div class="webhook-box-head"><b>Đồng bộ data từ server webhook</b><span class="status status-${meta[1]}" data-webhook-transport>${escapeHtml(meta[0])}</span></div><div class="cell-sub" data-webhook-transport-detail>${escapeHtml(webhookTransport.detail)}</div><div class="connection-actions"><button class="button button-small button-primary" type="button" data-webhook-sync="1">Đồng bộ ngay</button><button class="button button-small" type="button" data-webhook-pending="1">Data chờ quy nguồn (<b data-webhook-pending-count>${number(webhookPending.length)}</b>)</button><span class="cell-sub">Chạy server: <span class="mono">node docs/architecture/16-webhook-server.cjs</span></span></div></div></section>`;
}

function normalizeIntegrationRecord(item) {
  const id = cleanId(item.id);
  if (!id) return null;
  const provider = ['SUBDATA', 'FACEBOOK', 'CUSTOM'].includes(item.provider) ? item.provider : 'CUSTOM';
  const typeByProvider = { SUBDATA: 'CUSTOMER_DATA', FACEBOOK: 'DATA_INTAKE', CUSTOM: 'CONNECTOR' };
  return {
    id,
    name: dataTerminology(cleanText(item.name, 'Tích hợp API', 200)),
    provider,
    type: ['CUSTOMER_DATA', 'DATA_INTAKE', 'CONNECTOR'].includes(item.type) ? item.type : typeByProvider[provider],
    endpoint: cleanText(item.endpoint, '', 500),
    externalAccountId: cleanText(item.externalAccountId, '', 160),
    status: ['UNCONFIGURED', 'PENDING_BACKEND', 'VERIFIED', 'ERROR', 'PAUSED'].includes(item.status) ? item.status : 'UNCONFIGURED',
    credentialConfigured: item.credentialConfigured === true,
    credentialLast4: cleanText(item.credentialLast4, '', 4).length === 4 ? cleanText(item.credentialLast4, '', 4) : '',
    lastVerifiedAt: cleanTimestamp(item.lastVerifiedAt),
    lastError: cleanText(item.lastError, '', 500),
    archived: item.archived === true
  };
}

function normalizeNoteRecord(item, customerIds) {
  const id = cleanId(item.id), customerId = cleanId(item.customerId);
  if (!id || !customerId || !customerIds.has(customerId)) return null;
  return {
    id,
    customerId,
    authorId: cleanId(item.authorId) || 'system',
    author: cleanText(item.author, 'System', 160),
    role: ['ADMIN', 'LEADER', 'SALE', 'SYSTEM'].includes(item.role) ? item.role : 'SYSTEM',
    text: dataTerminology(cleanText(item.text, '', 2000)),
    at: cleanTimestamp(item.at, stamp())
  };
}

function normalizeImportRecord(item) {
  const id = cleanId(item.id);
  if (!id) return null;
  return { id, source: dataTerminology(cleanText(item.source, 'File import', 100)), filename: dataTerminology(cleanText(item.filename, '', 240)), records: cleanNumber(item.records, 0, 0, Number.MAX_SAFE_INTEGER, true), importedAt: cleanTimestamp(item.importedAt, stamp()), actor: cleanText(item.actor, 'Start', 160), status: item.status === 'FAILED' ? 'FAILED' : 'SUCCESS' };
}

function normalizeRegistrationRecord(item) {
  const id = cleanId(item.id);
  if (!id) return null;
  return { id, name: cleanText(item.name, 'Người đăng ký', 160), phone: cleanText(item.phone, '', 20), email: cleanText(item.email, '', 254), ipAddress: cleanText(item.ipAddress || item.ip, 'Chưa xác định', 64), requestedRole: ['LEADER', 'SALE'].includes(item.requestedRole) ? item.requestedRole : 'PENDING', teamId: cleanId(item.teamId) || 'T2', registeredAt: cleanTimestamp(item.registeredAt, stamp()), status: item.status === 'APPROVED' ? 'APPROVED' : 'PENDING' };
}

function sanitizeSecurity(security, defaults) {
  const input = security && typeof security === 'object' && !Array.isArray(security) ? security : {};
  const history = uniqueRecords(input.loginHistory, defaults.loginHistory, item => {
    const id = cleanId(item.id);
    if (!id) return null;
    return { id, ip: cleanText(item.ip, '127.0.0.1', 64), accountId: cleanId(item.accountId), accountName: cleanText(item.accountName, 'Start', 160), role: ['ADMIN', 'LEADER', 'SALE'].includes(item.role) ? item.role : 'ADMIN', device: cleanText(item.device, 'Trình duyệt không xác định', 160), location: cleanText(item.location, 'Không xác định', 160), at: cleanTimestamp(item.at, stamp()), success: item.success === true };
  }).slice(0, 30);
  return {
    adminPassword: typeof input.adminPassword === 'string' && input.adminPassword.length >= 8 && input.adminPassword.length <= 128 ? input.adminPassword : defaults.adminPassword,
    twoFactorEnabled: typeof input.twoFactorEnabled === 'boolean' ? input.twoFactorEnabled : defaults.twoFactorEnabled,
    twoFactorCode: defaults.twoFactorCode,
    loginHistory: history
  };
}

function loadState() {
  const defaults = initialState();
  try {
    // The previous storage key belonged to the sample CRM and must never be reused.
    localStorage.removeItem('nvt-crm-complete-v2');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === 3) {
      const settings = sanitizeSettings(saved.settings, defaults.settings);
      let members = uniqueRecords(saved.members, defaults.members, normalizeMemberRecord);
      const leaderIds = new Set(members.filter(member => member.role === 'LEADER').map(member => member.id));
      members = members.filter(member => member.role === 'LEADER' || leaderIds.has(member.leaderId));
      if (!members.length) members = structuredClone(defaults.members);
      const websites = uniqueRecords(saved.websites, defaults.websites, normalizeWebsiteRecord);
      let customFieldDefinitions = uniqueRecords(saved.customFieldDefinitions, defaults.customFieldDefinitions, normalizeCustomFieldDefinition);
      customFieldDefinitions = customFieldDefinitions.filter(field => !['googleDocs', 'DATE', 'NUMBER', 'URL'].includes(field.id) && !['DATE', 'NUMBER', 'URL'].includes(field.type));
      if (!customFieldDefinitions.some(field => field.id === 'customerLevel')) customFieldDefinitions.unshift(structuredClone(CUSTOM_FIELD_SEED[0]));
      if (saved.optionPaletteVersion !== 2) {
        customFieldDefinitions.forEach(field => field.options.forEach(option => {
          option.color = SEMANTIC_OPTION_COLORS[field.id]?.[option.value] || option.color;
        }));
      }
      const customers = uniqueRecords(saved.customers, defaults.customers, item => normalizeCustomerRecord(item, members, websites, customFieldDefinitions));
      const customerIds = new Set(customers.map(customer => customer.id));
      const customerFieldHistory = uniqueRecords(saved.customerFieldHistory, defaults.customerFieldHistory, item => normalizeFieldHistoryRecord(item, customerIds));
      customers.forEach(customer => {
        if (!customerFieldHistory.some(item => item.customerId === customer.id && item.fieldId === 'customerLevel')) {
          customerFieldHistory.push({ id: `FLD-MIG-${customer.id}`, customerId: customer.id, fieldId: 'customerLevel', fieldLabel: customFieldDefinitions.find(field => field.id === 'customerLevel')?.label || 'Level khách hàng', from: '', to: customer.customFields.customerLevel || 'L0', actorId: 'SYSTEM', actor: 'Chuyển đổi dữ liệu', role: 'SYSTEM', at: customer.createdAt, source: 'MIGRATION' });
        }
      });
      const assignmentHistory = uniqueRecords(saved.assignmentHistory, defaults.assignmentHistory, item => normalizeAssignmentHistoryRecord(item, customerIds));
      customers.filter(customer => customer.saleId || customer.leaderId).forEach(customer => {
        if (!assignmentHistory.some(item => item.customerId === customer.id)) {
          assignmentHistory.push({ id: `ASN-MIG-${customer.id}`, customerId: customer.id, fromSaleId: null, fromSaleName: '', toSaleId: customer.saleId, toSaleName: members.find(member => member.id === customer.saleId)?.name || '', fromLeaderId: null, fromLeaderName: '', toLeaderId: customer.leaderId, toLeaderName: members.find(member => member.id === customer.leaderId)?.name || '', teamId: customer.teamId, actorId: 'SYSTEM', actor: 'Chuyển đổi dữ liệu', role: 'SYSTEM', at: customer.createdAt, reason: 'Khôi phục phân công hiện có', source: 'SYSTEM' });
        }
      });
      const leaderDistribution = sanitizeLeaderDistribution(saved.leaderDistribution, members, defaults.leaderDistribution);
      const saleDistributionByLeader = sanitizeSaleDistribution(saved.saleDistributionByLeader, members, defaults.saleDistributionByLeader);
      return {
        version: 3,
        optionPaletteVersion: 2,
        members,
        registrations: uniqueRecords(saved.registrations, defaults.registrations, normalizeRegistrationRecord),
        customFieldDefinitions,
        customers,
        customerFieldHistory,
        assignmentHistory,
        resubmissions: uniqueRecords(saved.resubmissions, defaults.resubmissions, item => normalizeResubmissionRecord(item, customerIds, websites)),
        notes: uniqueRecords(saved.notes, defaults.notes, item => normalizeNoteRecord(item, customerIds)),
        imports: uniqueRecords(saved.imports, defaults.imports, normalizeImportRecord),
        products: Array.isArray(saved.products) ? saved.products.filter(item => item && item.id && item.name).map(item => ({ id: cleanId(item.id), sku: cleanText(item.sku, '', 60), name: cleanText(item.name, 'Sản phẩm', 200), category: cleanText(item.category, 'Khác', 100), price: Math.max(0, Number(item.price) || 0), active: item.active !== false })) : defaults.products,
        productCategories: Array.isArray(saved.productCategories) && saved.productCategories.length ? [...new Set(saved.productCategories.map(item => cleanText(item, '', 100)).filter(Boolean))] : defaults.productCategories,
        attendance: uniqueRecords(saved.attendance, defaults.attendance, item => normalizeAttendanceRecord(item, members)),
        dataOffers: uniqueRecords(saved.dataOffers, defaults.dataOffers, item => normalizeDataOfferRecord(item, customerIds, members)),
        orders: uniqueRecords(saved.orders, defaults.orders, item => normalizeOrderRecord(item, customers, members, websites)).filter(order => !/^ORD-\d{4}$/.test(order.id)),
        traffic: uniqueRecords(saved.traffic, defaults.traffic, item => normalizeTrafficRecord(item, members)),
        tasks: uniqueRecords(saved.tasks, defaults.tasks, item => normalizeTaskRecord(item, settings.slaMinutes, customerIds, members)),
        notifications: uniqueRecords(saved.notifications, defaults.notifications, item => normalizeNotificationRecord(item, members)),
        audit: uniqueRecords(saved.audit, defaults.audit, normalizeAuditRecord),
        websites,
        integrations: uniqueRecords(saved.integrations, defaults.integrations, normalizeIntegrationRecord).filter(item => item.provider !== 'REMOVED_PAYMENT'),
        leaderDistribution,
        saleDistributionByLeader,
        settings,
        security: sanitizeSecurity(saved.security, defaults.security)
      };
    }
  } catch (error) {}
  return defaults;
}

let state = loadState();
PRODUCTS = state.products;
STAFF = state.members.filter(person => person.active !== false);
applyAppearanceSettings();
refreshTaskStatuses();
let currentAccount = null;
let currentView = 'dashboard';
let dateRange = 7;
let datePreset = '7';
let customDateStart = dayIso(6);
let customDateEnd = dayIso(0);
let orderStatusFilter = 'ALL';
let customerStatusFilter = 'ALL';
let customerOwnerFilter = 'ALL';
let globalQuery = '';
let selectedPoolIds = new Set();
let drawerReturnFocus = null;
let modalReturnFocus = null;
let distributionTab = 'QUEUE';
let distributionLeaderId = 'l1';
let lastImportStats = { created: 0, duplicates: 0, registeredDuplicates: 0 };

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '').toLowerCase();
}

function money(value, compact = false) {
  if (compact) return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value) + ' đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

function number(value) { return new Intl.NumberFormat('vi-VN').format(value); }
function dateOnly(value) { return String(value).slice(0, 10); }
function dataDateParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match ? { date: `${match[3]}/${match[2]}/${match[1]}`, time: `${match[4]}:${match[5]}` } : { date: '—', time: '' };
}
function stamp() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type)?.value || '00';
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}`;
}
function staffName(id) { return state.members.find(person => person.id === id)?.name || 'Chưa phân'; }
function activeStaff() { return STAFF.filter(person => person.active !== false); }
function productById(id) { return PRODUCTS.find(product => product.id === id); }
function customerById(id) { return state.customers.find(customer => customer.id === id); }
function websiteById(id) { return state.websites.find(website => website.id === id); }
function customerLanding(customer) { return websiteById(customer?.websiteId); }
function customerLandingName(customer) {
  const website = customerLanding(customer);
  return website ? `${website.name} · ${website.domain}` : 'Chưa xác định landing page';
}
function websiteCustomerRows(websiteId) { return state.customers.filter(customer => customer.websiteId === websiteId); }
function orderSource(source) {
  if (['Referral', 'Landing Page', 'Website Organic', 'Direct / Referral'].includes(source)) return 'Direct / Referral';
  return TRAFFIC_META.some(item => item.source === source) ? source : 'Chưa quy nguồn';
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
}

function refreshTaskStatuses() {
  state.tasks.forEach(task => {
    if (task.slaBased && task.createdAt) task.dueAt = shiftStamp(task.createdAt, state.settings.slaMinutes);
    if (task.status !== 'DONE') task.status = String(task.dueAt) < stamp() ? 'OVERDUE' : 'OPEN';
  });
}

function scopeSaleIds() {
  if (!currentAccount) return [];
  if (currentAccount.scope === 'ALL') return activeStaff().filter(person => person.role === 'SALE').map(person => person.id);
  if (currentAccount.scope === 'TEAM') return activeStaff().filter(person => person.role === 'SALE' && person.teamId === currentAccount.teamId && person.leaderId === currentAccount.leaderId).map(person => person.id);
  return [currentAccount.saleId];
}

function scopedCustomers() {
  const saleIds = scopeSaleIds();
  if (currentAccount.scope === 'ALL') return state.customers;
  if (currentAccount.scope === 'TEAM') return state.customers.filter(customer => customer.teamId === currentAccount.teamId && customer.leaderId === currentAccount.leaderId);
  return state.customers.filter(customer => {
    if (customer.teamId !== currentAccount.teamId || customer.leaderId !== currentAccount.leaderId) return false;
    if (saleIds.includes(customer.saleId)) return true;
    return currentAccount.saleId && state.dataOffers.some(o => o.customerId === customer.id && o.saleId === currentAccount.saleId && o.status === 'PENDING');
  });
}

/* Luật hết hạn nhận data đã chuyển sang offer: quá settings.acceptTimeoutHours thì
   khách GIỮ leader/team và saleId null (trả về leader đã chia), không đẩy lên phễu
   Admin. Hàm cũ được giữ làm alias để không còn hai luật song song. */
function reclaimExpiredSaleData() {
  return expireStaleOffers();
}

function acceptCustomerData(id) {
  const customer = customerById(id);
  if (currentAccount.role !== 'SALE' || customer?.saleId !== currentAccount.saleId) return;
  customer.saleAcceptedAt = stamp(); customer.updatedAt = stamp();
  audit('ACCEPT_DATA', id, 'Sale đã nhận data'); saveState(); render();
}

function scopedOrders() {
  const ids = scopeSaleIds();
  if (currentAccount.scope === 'ALL') return state.orders;
  if (currentAccount.scope === 'TEAM') return state.orders.filter(order => order.teamId === currentAccount.teamId && order.leaderId === currentAccount.leaderId);
  return state.orders.filter(order => ids.includes(order.saleId) && order.teamId === currentAccount.teamId && order.leaderId === currentAccount.leaderId);
}
function scopedTasks() {
  const ids = scopeSaleIds();
  if (currentAccount.scope === 'ALL') return state.tasks;
  if (currentAccount.scope === 'TEAM') return state.tasks.filter(task => task.teamId === currentAccount.teamId && task.leaderId === currentAccount.leaderId);
  return state.tasks.filter(task => ids.includes(task.ownerId) && task.teamId === currentAccount.teamId && task.leaderId === currentAccount.leaderId);
}
function scopedTraffic() {
  const ids = scopeSaleIds();
  if (currentAccount.scope === 'ALL') return state.traffic;
  if (currentAccount.scope === 'TEAM') return state.traffic.filter(event => event.teamId === currentAccount.teamId && event.leaderId === currentAccount.leaderId);
  return [];
}
function canViewCustomer(customer) { return !!customer && scopedCustomers().includes(customer); }
function isPoolCustomer(customer) {
  if (!customer || !currentAccount) return false;
  if (currentAccount.role === 'ADMIN') return customer.saleId === null && customer.leaderId === null && customer.teamId === null;
  return currentAccount.role === 'LEADER' && customer.saleId === null && customer.leaderId === currentAccount.leaderId && customer.teamId === currentAccount.teamId;
}
function slaBreachedCustomers() {
  const overdueCustomerIds = new Set(scopedTasks().filter(task => task.slaBased && task.status === 'OVERDUE').map(task => task.customerId));
  return scopedCustomers().filter(customer => overdueCustomerIds.has(customer.id));
}

function shiftDate(date, days) {
  const [year, month, day] = String(date).split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function inclusiveDays(start, end) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((endTime - startTime) / 86400000) + 1;
}

function currentPeriodBounds() {
  if (datePreset === 'CUSTOM') return { start: customDateStart, end: customDateEnd, days: inclusiveDays(customDateStart, customDateEnd) };
  return { start: dayIso(dateRange - 1), end: dayIso(0), days: dateRange };
}

function previousPeriodBounds() {
  const current = currentPeriodBounds();
  const end = shiftDate(current.start, -1);
  return { start: shiftDate(end, -(current.days - 1)), end, days: current.days };
}

function formatPeriodDate(value) { return value.split('-').reverse().join('/'); }
function periodLabel() {
  const bounds = currentPeriodBounds();
  return bounds.days === 1 ? `Hôm nay · ${formatPeriodDate(bounds.end)}` : `${formatPeriodDate(bounds.start)} - ${formatPeriodDate(bounds.end)}`;
}
function periodFileToken() { const bounds = currentPeriodBounds(); return `${bounds.start}_${bounds.end}`; }

function inCurrentPeriod(value) {
  const { start, end } = currentPeriodBounds();
  return dateOnly(value) >= start && dateOnly(value) <= end;
}

function inPreviousPeriod(value) {
  const { start, end } = previousPeriodBounds();
  return dateOnly(value) >= start && dateOnly(value) <= end;
}

function isPaymentInPeriod(order, periodCheck) { return !!order.paidAt && (!periodCheck || periodCheck(order.paidAt)); }
function isRefundInPeriod(order, periodCheck) { return !!order.refundedAt && (!periodCheck || periodCheck(order.refundedAt)); }
function netRevenue(orders, periodCheck = null) {
  return orders.reduce((sum, order) => sum + (isPaymentInPeriod(order, periodCheck) ? order.total : 0) - (isRefundInPeriod(order, periodCheck) ? order.refund : 0), 0);
}
function paidOrders(orders, periodCheck = null) { return orders.filter(order => isPaymentInPeriod(order, periodCheck)); }
function financialEvents(orders, periodCheck = null) {
  return orders.flatMap(order => {
    const events = [];
    if (isPaymentInPeriod(order, periodCheck)) events.push({ id: `PAY-${order.id}`, type: 'PAYMENT', label: 'Thu tiền', orderId: order.id, code: order.code, customerName: order.customerName, paymentMethod: order.paymentMethod, occurredAt: order.paidAt, amount: order.total, reconciled: Boolean(order.paymentReconciled) });
    if (isRefundInPeriod(order, periodCheck)) events.push({ id: `REF-${order.id}`, type: 'REFUND', label: 'Hoàn tiền', orderId: order.id, code: order.code, customerName: order.customerName, paymentMethod: order.paymentMethod, occurredAt: order.refundedAt, amount: -order.refund, reconciled: Boolean(order.refundReconciled) });
    return events;
  });
}

function orderEditState(order) {
  if (currentAccount.role === 'ADMIN') return { allowed: true, label: 'Admin toàn quyền' };
  const created = Date.parse(`${String(order.createdAt).replace(' ', 'T')}+07:00`);
  const remaining = 3 * 24 * 60 * 60 * 1000 - (Date.now() - created);
  if (!Number.isFinite(created) || remaining <= 0) return { allowed: false, label: 'Đã khóa chỉnh sửa' };
  const days = Math.floor(remaining / 86400000), hours = Math.floor((remaining % 86400000) / 3600000);
  return { allowed: true, label: `Còn ${days} ngày ${hours} giờ` };
}
function delta(current, previous) { return previous ? ((current - previous) / previous) * 100 : current ? 100 : 0; }
function deltaBadge(value) { const cls = value >= 0 ? 'up' : 'down'; return `<span class="delta ${cls}">${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%</span>`; }

function statusBadge(status, type = 'customer') {
  if (type === 'order') { const meta = ORDER_STATUS[status] || [status, 'info']; return `<span class="status status-${meta[1]}">${escapeHtml(meta[0])}</span>`; }
  if (type === 'task') { const labels = { OPEN: ['Đang mở', 'open'], OVERDUE: ['Quá hạn', 'cancelled'], DONE: ['Hoàn tất', 'done'] }; const meta = labels[status] || [status, 'info']; return `<span class="status status-${escapeHtml(meta[1])}">${escapeHtml(meta[0])}</span>`; }
  const meta = STATUS_META[status] || { label: status, color: '#687771' };
  return `<span class="status" style="background:${meta.color}18;color:${meta.color}">${escapeHtml(meta.label)}</span>`;
}

function audit(action, entity, detail) {
  state.audit.unshift({ id: `AUD-${Date.now()}`, actorId: currentAccount.id, actor: currentAccount.name, role: currentAccount.role, action, entity, detail, ip: currentAccount.ip || sessionIp('127.0.0.1'), at: stamp() });
}

function toast(message) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  $('#toastRoot').append(element);
  setTimeout(() => element.remove(), 3200);
}

function pageHead(title, description, actions = '') {
  return `<div class="page-head"><div><h1>${escapeHtml(title)}</h1></div><div class="head-actions">${actions}</div></div>`;
}

function dateFilter() {
  const presets = [[1, 'Hôm nay'], [7, '7 ngày'], [15, '15 ngày'], [30, '30 ngày']];
  return `<div class="filter-bar"><span class="filter-label">Thời gian</span><div class="segmented">${presets.map(([days, label]) => `<button class="segment ${datePreset !== 'CUSTOM' && dateRange === days ? 'active' : ''}" data-range="${days}" type="button">${label}</button>`).join('')}</div><div class="custom-date-range ${datePreset === 'CUSTOM' ? 'active' : ''}"><label>Từ ngày<input id="customDateStart" type="date" value="${escapeHtml(customDateStart)}" max="${escapeHtml(dayIso(0))}"></label><span>→</span><label>Đến ngày<input id="customDateEnd" type="date" value="${escapeHtml(customDateEnd)}" max="${escapeHtml(dayIso(0))}"></label><button class="button button-small" id="applyCustomDate" type="button">Áp dụng</button></div><span class="scope-chip period-chip" style="color:var(--ink);background:var(--panel-2)">${escapeHtml(periodLabel())}</span></div>`;
}

function applyCustomDateRange() {
  const start = $('#customDateStart')?.value;
  const end = $('#customDateEnd')?.value;
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(start) || !validDate(end) || start > end || end > dayIso(0)) { toast('Khoảng ngày không hợp lệ hoặc vượt quá hôm nay'); return false; }
  const days = inclusiveDays(start, end);
  if (days < 1 || days > 366) { toast('Khoảng tùy chọn tối đa 366 ngày'); return false; }
  customDateStart = start;
  customDateEnd = end;
  dateRange = days;
  datePreset = 'CUSTOM';
  render();
  return true;
}

function periodSnapshot(previous = false) {
  const periodCheck = previous ? inPreviousPeriod : inCurrentPeriod;
  const allOrders = scopedOrders();
  const orders = allOrders.filter(order => periodCheck(order.createdAt));
  const transactions = financialEvents(allOrders, periodCheck);
  const traffic = scopedTraffic().filter(event => periodCheck(event.date));
  const customers = scopedCustomers().filter(customer => periodCheck(customer.createdAt));
  const paid = paidOrders(allOrders, periodCheck);
  const refunds = allOrders.filter(order => isRefundInPeriod(order, periodCheck));
  const revenue = netRevenue(allOrders, periodCheck);
  const sessions = traffic.reduce((sum, event) => sum + event.sessions, 0);
  const trackedLeads = traffic.reduce((sum, event) => sum + event.leads, 0);
  const leads = customers.length;
  const units = paid.reduce((sum, order) => sum + order.qty, 0);
  const periodCustomerIds = new Set(customers.map(customer => customer.id));
  const paidCustomerIds = new Set(paid.filter(order => periodCustomerIds.has(order.customerId)).map(order => order.customerId));
  return { orders, transactions, traffic, customers, paid, refunds, revenue, sessions, trackedLeads, leads, units, convertedCustomers: paidCustomerIds.size, aov: paid.length ? Math.round(revenue / paid.length) : 0, conversion: leads ? (paidCustomerIds.size / leads) * 100 : 0 };
}

function kpiCard(icon, label, value, sub, change) {
  return `<article class="kpi"><div class="kpi-top"><span>${escapeHtml(label)}</span><span class="kpi-icon">${icon}</span></div><strong class="num">${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small>${typeof change === 'number' ? `<div style="margin-top:8px">${deltaBadge(change)}</div>` : ''}</article>`;
}

function dailySeries() {
  const orders = scopedOrders();
  const bounds = currentPeriodBounds();
  return Array.from({ length: bounds.days }, (_, index) => {
    const date = shiftDate(bounds.start, index);
    const dayCheck = value => dateOnly(value) === date;
    const paid = paidOrders(orders, dayCheck);
    const refunds = orders.filter(order => isRefundInPeriod(order, dayCheck));
    return {
      date,
      revenue: netRevenue(orders, dayCheck),
      gross: paid.reduce((sum, order) => sum + order.subtotal, 0),
      discount: paid.reduce((sum, order) => sum + order.discount, 0),
      refunds: refunds.reduce((sum, order) => sum + order.refund, 0),
      orders: paid.length,
      units: paid.reduce((sum, order) => sum + order.qty, 0)
    };
  });
}

function revenueChart(series, height = 280) {
  if (!series.length || series.every(item => item.revenue === 0 && item.gross === 0 && item.refunds === 0 && item.orders === 0)) return `<div class="empty"><b>Chưa có dữ liệu</b><span>Không có giao dịch trong khoảng đã chọn.</span></div>`;
  const width = 820, padLeft = 52, padRight = 20, padTop = 24, padBottom = 42;
  const innerWidth = width - padLeft - padRight, innerHeight = height - padTop - padBottom;
  let max = Math.max(...series.map(item => item.revenue), 0);
  let min = Math.min(...series.map(item => item.revenue), 0);
  if (max === 0 && min === 0) max = Math.max(...series.map(item => Math.max(item.gross - item.discount, item.refunds)), 1);
  const span = Math.max(max - min, 1);
  const yFor = value => padTop + ((max - value) / span) * innerHeight;
  const baseline = yFor(0);
  const points = series.map((item, index) => ({ ...item, x: padLeft + (series.length === 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth), y: yFor(item.revenue) }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${baseline.toFixed(1)} L${points[0].x.toFixed(1)},${baseline.toFixed(1)} Z`;
  const labelsEvery = Math.max(1, Math.ceil(series.length / 7));
  return `<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ doanh thu từng ngày">
    <defs><linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8572a" stop-opacity=".28"></stop><stop offset="100%" stop-color="#e8572a" stop-opacity="0"></stop></linearGradient></defs>
    ${[0, .25, .5, .75, 1].map(step => { const y = padTop + innerHeight * step; const value = max - span * step; return `<line class="chart-grid" x1="${padLeft}" x2="${width - padRight}" y1="${y}" y2="${y}"></line><text class="chart-value" x="${padLeft - 8}" y="${y + 3}" text-anchor="end">${escapeHtml(money(value, true))}</text>`; }).join('')}
    <path class="chart-area" d="${area}"></path><path class="chart-line" d="${line}"></path>
    ${points.map((point, index) => `<g><circle class="chart-point" cx="${point.x}" cy="${point.y}" r="4"><title>${point.date}: ${money(point.revenue)} · ${point.orders} đơn</title></circle>${index % labelsEvery === 0 || index === points.length - 1 ? `<text class="chart-label" x="${point.x}" y="${height - 14}" text-anchor="middle">${point.date.slice(5).split('-').reverse().join('/')}</text>` : ''}</g>`).join('')}
  </svg></div>`;
}

function productPerformance(orders) {
  const map = new Map(PRODUCTS.map(product => [product.id, { ...product, units: 0, paidOrders: 0, revenue: 0, refunds: 0, previousRevenue: 0 }]));
  orders.forEach(order => {
    const item = map.get(order.productId);
    if (!item) return;
    if (isPaymentInPeriod(order, inCurrentPeriod)) { item.units += order.qty; item.paidOrders += 1; item.revenue += order.total; }
    if (isRefundInPeriod(order, inCurrentPeriod)) { item.refunds += 1; item.revenue -= order.refund; }
    if (isPaymentInPeriod(order, inPreviousPeriod)) item.previousRevenue += order.total;
    if (isRefundInPeriod(order, inPreviousPeriod)) item.previousRevenue -= order.refund;
  });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

function sourcePerformance() {
  const traffic = scopedTraffic();
  const orders = scopedOrders();
  const customers = scopedCustomers();
  const catalog = new Map();
  const register = (source, campaign, medium = '', color = '') => {
    const canonicalSource = orderSource(source);
    const canonicalCampaign = cleanText(campaign, 'UNATTRIBUTED', 160) || 'UNATTRIBUTED';
    const meta = TRAFFIC_META.find(item => item.source === canonicalSource);
    const key = `${canonicalSource}\u0000${canonicalCampaign}`;
    if (!catalog.has(key)) catalog.set(key, { source: canonicalSource, campaign: canonicalCampaign, medium: medium || meta?.medium || 'unattributed', color: color || meta?.color || '#687771', spend: 0 });
  };
  traffic.filter(event => inCurrentPeriod(event.date)).forEach(event => register(event.source, event.campaign, event.medium, event.color));
  customers.filter(customer => inCurrentPeriod(customer.createdAt)).forEach(customer => register(customer.source, customer.campaign));
  orders.filter(order => isPaymentInPeriod(order, inCurrentPeriod) || isRefundInPeriod(order, inCurrentPeriod)).forEach(order => register(order.source, order.campaign));
  return Array.from(catalog.values()).map(meta => {
    const events = traffic.filter(event => event.source === meta.source && event.campaign === meta.campaign && inCurrentPeriod(event.date));
    const sourceOrders = orders.filter(order => order.source === meta.source && (order.campaign || 'UNATTRIBUTED') === meta.campaign);
    const paid = paidOrders(sourceOrders, inCurrentPeriod);
    const sessions = currentAccount.role === 'ADMIN' ? events.reduce((sum, event) => sum + event.sessions, 0) : 0;
    const trackedLeads = currentAccount.role === 'ADMIN' ? events.reduce((sum, event) => sum + event.leads, 0) : 0;
    const matchingCustomers = customers.filter(customer => inCurrentPeriod(customer.createdAt) && orderSource(customer.source) === meta.source && (customer.campaign || 'UNATTRIBUTED') === meta.campaign);
    const leads = matchingCustomers.length;
    const spend = currentAccount.role === 'ADMIN' ? events.reduce((sum, event) => sum + event.spend, 0) : 0;
    const revenue = netRevenue(sourceOrders, inCurrentPeriod);
    const periodCustomerIds = new Set(matchingCustomers.map(customer => customer.id));
    const convertedCustomers = new Set(paid.filter(order => periodCustomerIds.has(order.customerId)).map(order => order.customerId)).size;
    return { ...meta, sessions, trackedLeads, leads, paidOrders: paid.length, convertedCustomers, revenue, spend, leadRate: sessions ? trackedLeads / sessions * 100 : 0, crmCaptureRate: trackedLeads ? leads / trackedLeads * 100 : 0, orderRate: leads ? convertedCustomers / leads * 100 : 0, roas: spend ? revenue / spend : null };
  }).sort((a, b) => b.revenue - a.revenue);
}

function websiteRevenuePerformance() {
  const customers = scopedCustomers();
  const rows = new Map(state.websites.map(website => [website.id, { id: website.id, name: website.name, domain: website.domain, data: 0, paidOrders: 0, gross: 0, refunds: 0, net: 0 }]));
  const unattributed = { id: 'UNATTRIBUTED', name: 'Chưa quy nguồn', domain: 'Thiếu website/landing snapshot', data: 0, paidOrders: 0, gross: 0, refunds: 0, net: 0 };
  const resolveRow = websiteId => rows.get(websiteId) || unattributed;
  customers.filter(customer => inCurrentPeriod(customer.createdAt)).forEach(customer => { resolveRow(customer.websiteId).data += 1; });
  scopedOrders().forEach(order => {
    const row = resolveRow(order.websiteId);
    if (isPaymentInPeriod(order, inCurrentPeriod)) { row.paidOrders += 1; row.gross += order.total; row.net += order.total; }
    if (isRefundInPeriod(order, inCurrentPeriod)) { row.refunds += order.refund; row.net -= order.refund; }
  });
  const result = Array.from(rows.values()).filter(row => row.data || row.paidOrders || row.refunds || row.net);
  if (unattributed.data || unattributed.paidOrders || unattributed.refunds || unattributed.net) result.push(unattributed);
  return result.sort((a, b) => b.net - a.net || b.data - a.data);
}

function sourceScopePanel(title = 'Nguồn khách hàng trong phạm vi') {
  const sources = sourcePerformance();
  const websites = websiteRevenuePerformance();
  const totalRevenue = websites.reduce((sum, row) => sum + row.net, 0);
  return `<div class="grid grid-2" style="margin-top:14px">
    <section class="panel"><div class="panel-head"><div><div class="panel-title">${escapeHtml(title)}</div><div class="panel-sub">Chỉ dùng khách hàng và đơn thuộc quyền tài khoản · ${escapeHtml(periodLabel())}</div></div><button class="button button-small" data-view-jump="marketing">Xem chi tiết</button></div><div class="panel-body">${trafficDonut(sources)}</div></section>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Landing page tạo khách</div><div class="panel-sub">Data và doanh thu quy về từng website</div></div><button class="button button-small" data-view-jump="revenue">Doanh thu website</button></div><div class="panel-body">${websites.slice(0, 5).map((row, index) => { const share = totalRevenue > 0 ? row.net / totalRevenue * 100 : 0; return `<div class="rank-row"><span class="rank">${index + 1}</span><div><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.domain)} · ${row.data} data · ${row.paidOrders} lượt thanh toán</small><div class="progress"><i style="width:${Math.max(0, share)}%"></i></div></div><div class="rank-value"><b>${money(row.net, true)}</b><small>${share.toFixed(1).replace('.', ',')}%</small></div></div>`; }).join('') || '<div class="empty"><b>Chưa có dữ liệu nguồn</b><span>Không phát sinh data hoặc giao dịch trong kỳ.</span></div>'}</div></section>
  </div>`;
}

function distributionDonut(rows, metric, label) {
  const rawTotal = rows.reduce((sum, row) => sum + row[metric], 0);
  const total = rawTotal || 1;
  let cursor = 0;
  const stops = rows.map(row => { const start = cursor; cursor += row[metric] / total * 100; return `${row.color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`; }).join(',');
  const background = rawTotal ? `conic-gradient(${stops})` : 'var(--panel-2)';
  return `<div class="donut-layout"><div class="donut" style="background:${background}"><div class="donut-center"><b>${number(rawTotal)}</b><small>${escapeHtml(label)}</small></div></div><div class="legend">${rows.slice(0, 8).map(row => `<div class="legend-row"><i style="background:${row.color}"></i><span>${escapeHtml(row.name || row.source)}</span><b>${rawTotal ? ((row[metric] / rawTotal) * 100).toFixed(1).replace('.', ',') : '0,0'}%</b></div>`).join('')}</div></div>`;
}

function trafficDonut(rows) {
  return distributionDonut(rows, currentAccount.role === 'ADMIN' ? 'sessions' : 'leads', currentAccount.role === 'ADMIN' ? 'phiên truy cập' : 'data mới');
}

function saleDashboardView(current, previous) {
  const customers = scopedCustomers();
  return pageHead(`Tổng quan · ${currentAccount.name}`, 'Sale xem doanh thu và tổng khách hàng trong đúng phạm vi được giao.') + dateFilter() +
    `<div class="kpi-grid sale-summary-grid">
      ${kpiCard('₫', 'Doanh thu của tôi', money(current.revenue, true), `${current.paid.length} lượt thanh toán · ${periodLabel()}`, delta(current.revenue, previous.revenue))}
      ${kpiCard('♙', 'Khách hàng của tôi', number(customers.length), 'Toàn bộ khách đang phụ trách')}
    </div>`;
}

function leaderDashboardView(current, previous) {
  const customers = scopedCustomers();
  const rows = salePerformanceRows();
  const newCustomers = customers.filter(isPoolCustomer).length;
  const series = dailySeries();
  return pageHead(`Tổng quan · Team ${currentAccount.teamId}`, `Leader ${currentAccount.name} xem tổng khách hàng, doanh thu và nhân sự trực thuộc.`) + dateFilter() +
    `<div class="kpi-grid leader-summary-grid">
      ${kpiCard('♙', 'Tổng khách hàng Team', number(customers.length), `Leader ${currentAccount.name}`)}
      ${kpiCard('₫', 'Doanh thu Team', money(current.revenue, true), `${current.paid.length} lượt thanh toán`, delta(current.revenue, previous.revenue))}
      ${kpiCard('↯', 'Khách mới chờ phân', number(newCustomers), 'Đang nằm trong Khách mới')}
      ${kpiCard('♧', 'Nhân sự trực thuộc', number(rows.length), `Team ${currentAccount.teamId}`)}
    </div>
    <div class="grid grid-2">
      <section class="panel"><div class="panel-head"><div><div class="panel-title">Doanh thu của Team từng ngày</div><div class="panel-sub">Toàn bộ Sale dưới quyền Leader ${escapeHtml(currentAccount.name)}</div></div></div><div class="panel-body">${revenueChart(series)}</div></section>
      <section class="panel"><div class="panel-head"><div><div class="panel-title">Leader & nhân sự trực thuộc</div><div class="panel-sub">Khách hàng và doanh thu · ${escapeHtml(periodLabel())}</div></div><button class="button button-small" data-view-jump="team">Quản lý Team</button></div><div class="panel-body"><div class="leader-card"><span class="avatar">${escapeHtml(currentAccount.initials)}</span><div><b>${escapeHtml(currentAccount.name)}</b><small>LEADER · ${escapeHtml(currentAccount.teamId)} · phụ trách ${customers.length} khách</small></div></div>${rows.map(row => `<div class="rank-row"><span class="rank">${escapeHtml(row.initials)}</span><div><b>${escapeHtml(row.name)}</b><small>${row.customers} khách · ${row.paid} lượt thanh toán</small></div><div class="rank-value"><b>${money(row.revenue, true)}</b><small>${row.conversion.toFixed(1)}% chuyển đổi</small></div></div>`).join('') || '<div class="empty"><b>Chưa có nhân sự</b><span>Team chưa có Sale trực thuộc.</span></div>'}</div></section>
    </div>`;
}

function dashboardView() {
  const current = periodSnapshot(false), previous = periodSnapshot(true);
  if (currentAccount.role === 'SALE') return saleDashboardView(current, previous);
  if (currentAccount.role === 'LEADER') return leaderDashboardView(current, previous);
  const products = productPerformance(scopedOrders()).filter(product => product.paidOrders || product.refunds);
  const sources = sourcePerformance();
  const series = dailySeries();
  const allCustomers = scopedCustomers().filter(customer => inCurrentPeriod(customer.createdAt));
  const statuses = Object.keys(STATUS_META).map(key => ({ key, count: allCustomers.filter(customer => customer.status === key).length })).filter(item => item.count);
  const maxStatus = Math.max(...statuses.map(item => item.count), 1);
  const overdue = scopedTasks().filter(task => task.status === 'OVERDUE').length;
  const dueToday = scopedTasks().filter(task => task.status === 'OPEN' && dateOnly(task.dueAt) === dayIso(0)).length;
  const slaBreaches = slaBreachedCustomers().length;
  const unassigned = scopedCustomers().filter(isPoolCustomer).length;
  const scopeTitle = currentAccount.role === 'ADMIN' ? 'Toàn hệ thống' : currentAccount.role === 'LEADER' ? `Team ${currentAccount.teamId}` : `Cá nhân ${currentAccount.name}`;
  return pageHead(`Tổng quan · ${scopeTitle}`, 'Doanh thu, sản phẩm và acquisition dùng cùng kỳ; cảnh báo công việc là trạng thái vận hành hiện tại.') + dateFilter() +
    `<div class="kpi-grid">
      ${kpiCard('₫', 'Doanh thu thuần', money(current.revenue, true), `${current.paid.length} đơn đã thanh toán`, delta(current.revenue, previous.revenue))}
      ${kpiCard('▤', 'Đơn thanh toán', number(current.paid.length), `${current.orders.filter(order => order.status === 'PENDING').length} đơn đang chờ`, delta(current.paid.length, previous.paid.length))}
      ${kpiCard('◎', 'Giá trị đơn TB', money(current.aov, true), 'Doanh thu thuần / lượt thanh toán', delta(current.aov, previous.aov))}
      ${kpiCard('□', 'Sản phẩm bán ra', number(current.units), 'Tổng số lượng sản phẩm', delta(current.units, previous.units))}
      ${kpiCard('↗', 'Data CRM mới', number(current.leads), currentAccount.role === 'ADMIN' ? `${number(current.trackedLeads)} form gửi · ${number(current.sessions)} sessions` : 'Khách mới trong phạm vi', delta(current.leads, previous.leads))}
      ${kpiCard('%', 'Paid / data trong kỳ', `${current.conversion.toFixed(1).replace('.', ',')}%`, 'Tỷ lệ chuyển đổi trong kỳ', delta(current.conversion, previous.conversion))}
    </div>
    <div class="grid grid-2">
      <section class="panel"><div class="panel-head"><div><div class="panel-title">Doanh thu từng ngày</div><div class="panel-sub">Doanh thu thuần từ đơn PAID · hover điểm để xem chi tiết</div></div><span class="scope-chip" style="color:var(--ink);background:var(--panel-2)">${currentPeriodBounds().days}D</span></div><div class="panel-body">${revenueChart(series)}</div><div class="chart-summary"><div><small>Cao nhất</small><b>${money(Math.max(...series.map(item => item.revenue)), true)}</b></div><div><small>Trung bình/ngày</small><b>${money(Math.round(current.revenue / currentPeriodBounds().days), true)}</b></div><div><small>Chiết khấu</small><b>${money(series.reduce((sum, item) => sum + item.discount, 0), true)}</b></div><div><small>Hoàn tiền</small><b>${money(series.reduce((sum, item) => sum + item.refunds, 0), true)}</b></div></div></section>
      <section class="panel"><div class="panel-head"><div><div class="panel-title">${currentAccount.role === 'ADMIN' ? 'Nguồn traffic / data' : 'Nguồn khách mới'}</div><div class="panel-sub">${currentAccount.role === 'ADMIN' ? 'Phiên truy cập từ hệ thống tracking' : 'Không hiển thị sessions và ad spend ngoài quyền'}</div></div><button class="button button-small" data-view-jump="${currentAccount.role === 'SALE' ? 'customers' : 'marketing'}">Chi tiết</button></div><div class="panel-body">${trafficDonut(sources)}</div></section>
    </div>
    <div class="grid grid-2" style="margin-top:14px">
      <section class="panel"><div class="panel-head"><div><div class="panel-title">Sản phẩm bán ra</div><div class="panel-sub">Xếp hạng theo doanh thu thuần · ${escapeHtml(periodLabel())}</div></div><button class="button button-small" data-view-jump="revenue">Xem báo cáo</button></div><div class="panel-body">${products.slice(0, 6).map((product, index) => { const share = current.revenue > 0 ? product.revenue / current.revenue * 100 : 0; return `<div class="rank-row"><span class="rank">#${index + 1}</span><div><b>${escapeHtml(product.name)}</b><small>${product.units} sản phẩm · ${product.paidOrders} đơn · ${share.toFixed(1).replace('.', ',')}% doanh thu</small><div class="progress"><i style="width:${Math.max(share, 0)}%"></i></div></div><div class="rank-value"><b>${money(product.revenue, true)}</b><small>${deltaBadge(delta(product.revenue, product.previousRevenue))}</small></div></div>`; }).join('') || '<div class="empty"><b>Chưa bán sản phẩm</b><span>Không có lượt thanh toán trong kỳ.</span></div>'}</div></section>
      <div class="grid">
        <section class="panel"><div class="panel-head"><div><div class="panel-title">Pipeline khách hàng</div><div class="panel-sub">${allCustomers.length} khách · ${escapeHtml(periodLabel())}</div></div></div><div class="panel-body">${statuses.length ? `<div class="pipeline">${statuses.map(item => `<div class="pipeline-row"><span>${escapeHtml(STATUS_META[item.key].label)}</span><div class="progress"><i style="width:${item.count / maxStatus * 100}%;background:${STATUS_META[item.key].color}"></i></div><b>${item.count}</b></div>`).join('')}</div>` : '<div class="empty"><b>Chưa có data mới</b><span>Không có khách được tạo trong kỳ.</span></div>'}</div></section>
        <section class="panel"><div class="panel-head"><div><div class="panel-title">Việc cần xử lý</div><div class="panel-sub">Lịch chăm sóc đã được gộp vào hồ sơ khách hàng</div></div></div><div class="alert-list"><button class="alert-row" data-view-jump="customers"><span class="alert-icon">!</span><span><b>${overdue} lịch chăm sóc quá hạn</b><p>Mở khách hàng để xử lý follow-up.</p></span><strong>${overdue}</strong></button><button class="alert-row" data-view-jump="customers"><span class="alert-icon">S</span><span><b>${slaBreaches} data vượt SLA ${state.settings.slaMinutes} phút</b><p>Data mới chưa được chăm sóc đúng hạn.</p></span><strong>${slaBreaches}</strong></button><button class="alert-row" data-view-jump="customers"><span class="alert-icon">⌚</span><span><b>${dueToday} lịch đến hạn hôm nay</b><p>Cuộc gọi và proposal cần hoàn tất.</p></span><strong>${dueToday}</strong></button><button class="alert-row" data-view-jump="distribution"><span class="alert-icon">↯</span><span><b>${unassigned} data chưa phân Leader</b><p>Xử lý theo thứ tự trong mục Chia Leader.</p></span><strong>${unassigned}</strong></button></div></section>
      </div>
    </div>
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Đơn hàng gần nhất</div><div class="panel-sub">Tổng đơn, sản phẩm và thanh toán đối chiếu cùng nguồn dữ liệu</div></div><button class="button button-small" data-view-jump="orders">Tất cả đơn</button></div>${ordersTable(current.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7))}</section>`;
}

function ordersTable(orders, showActions = false) {
  if (!orders.length) return `<div class="empty"><b>Không có đơn hàng</b><span>Thử đổi bộ lọc hoặc khoảng thời gian.</span></div>`;
  const showLeader = currentAccount.role === 'ADMIN';
  return `<div class="table-wrap"><table class="orders-data-table"><thead><tr><th class="col-order">Mã đơn</th><th class="col-customer">Khách hàng</th><th class="col-product">Sản phẩm</th><th class="col-staff">Sale</th>${showLeader ? '<th class="col-staff">Leader</th>' : ''}<th class="col-money">Giá trị</th><th class="col-pay">Thanh toán</th>${showActions ? '<th class="col-act"></th>' : ''}</tr></thead><tbody>${orders.map(order => `<tr><td class="col-order"><div class="cell-main mono">${escapeHtml(order.code)}</div><div class="cell-sub">${escapeHtml(order.createdAt)}</div></td><td class="col-customer"><div class="cell-main">${escapeHtml(order.customerName)}</div><div class="cell-sub">${currentAccount.role === 'ADMIN' ? escapeHtml(order.source) : 'Khách thuộc phạm vi phân công'}</div></td><td class="col-product"><div class="cell-main">${escapeHtml(order.productName)}</div><div class="cell-sub">${escapeHtml(order.sku)} · SL ${escapeHtml(order.qty)}</div></td><td class="col-staff"><div class="cell-main">${escapeHtml(staffName(order.saleId))}</div></td>${showLeader ? `<td class="col-staff"><div class="cell-main">${escapeHtml(staffName(order.leaderId))}</div></td>` : ''}<td class="col-money num"><b>${money(order.total)}</b>${order.discount ? `<div class="cell-sub">CK ${money(order.discount)}</div>` : ''}</td><td class="col-pay">${statusBadge(order.status, 'order')}</td>${showActions ? `<td class="col-act"><span class="order-lock-chip">${orderEditState(order).label}</span> <button class="button button-small" data-open-order="${escapeHtml(order.id)}">Mở</button>${orderEditState(order).allowed ? `<button class="button button-small" data-edit-order="${escapeHtml(order.id)}">Sửa</button><button class="button button-small button-danger" data-delete-order="${escapeHtml(order.id)}">Xóa</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function transactionsTable(events, showReconciliation = false) {
  if (!events.length) return `<div class="empty"><b>Không có giao dịch</b><span>Chưa phát sinh thanh toán hoặc hoàn tiền trong phạm vi này.</span></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Loại</th><th>Mã đơn</th><th>Khách hàng</th><th>Giá trị</th>${showReconciliation ? '<th>Đối soát</th>' : ''}<th></th></tr></thead><tbody>${events.map(event => `<tr><td class="mono">${escapeHtml(event.occurredAt)}</td><td>${event.type === 'PAYMENT' ? '<span class="status status-paid">Thu tiền</span>' : '<span class="status status-refunded">Hoàn tiền</span>'}</td><td class="mono">${escapeHtml(event.code)}</td><td>${escapeHtml(event.customerName)}</td><td><b>${money(event.amount)}</b></td>${showReconciliation ? `<td>${event.reconciled ? '<span class="status status-paid">Đã khớp</span>' : '<span class="status status-pending">Chờ khớp</span>'}</td>` : ''}<td><button class="button button-small" data-open-order="${escapeHtml(event.orderId)}">Mở đơn</button></td></tr>`).join('')}</tbody></table></div>`;
}

function canUpdateCustomer(customer) {
  return !!customer && (currentAccount.role === 'ADMIN' || (currentAccount.role === 'LEADER' && state.settings.leaderCanUpdate && customer.teamId === currentAccount.teamId && customer.leaderId === currentAccount.leaderId) || (currentAccount.role === 'SALE' && customer.saleId === currentAccount.saleId));
}

function activeCustomFields(tableOnly = false) {
  return state.customFieldDefinitions.filter(field => field.active !== false && (!tableOnly || field.showInTable));
}

function customFieldOption(field, value) {
  return field?.options?.find(option => option.value === value) || null;
}

function customFieldValueLabel(field, value) {
  if (Array.isArray(value)) return value.map(item => customFieldOption(field, item)?.label || item).join(', ');
  if (field?.type === 'CHECKBOX') return value ? 'Có' : 'Không';
  return customFieldOption(field, value)?.label || String(value ?? '');
}

function customFieldCell(field, value) {
  if (field.type === 'MULTI_SELECT') {
    return `<span class="field-pill-list">${(Array.isArray(value) ? value : []).map(item => { const option = customFieldOption(field, item); return `<span class="field-pill" style="--pill:${escapeHtml(option?.color || '#687771')}">${escapeHtml(option?.label || item)}</span>`; }).join('') || '<span class="cell-sub">—</span>'}</span>`;
  }
  if (field.type === 'SELECT') {
    const option = customFieldOption(field, value);
    return option ? `<span class="field-pill" style="--pill:${escapeHtml(option.color)}">${escapeHtml(option.label)}</span>` : '<span class="cell-sub">—</span>';
  }
  if (field.type === 'CHECKBOX') return value ? '<span class="status status-paid">Có</span>' : '<span class="cell-sub">Không</span>';
  if (field.type === 'URL') return value ? `<a class="field-link" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">Mở tài liệu ↗</a>` : '<span class="cell-sub">—</span>';
  const label = customFieldValueLabel(field, value);
  return label ? `<span class="custom-field-text">${escapeHtml(label)}</span>` : '<span class="cell-sub">—</span>';
}

function customFieldTableControl(field, customer) {
  const value = customer.customFields?.[field.id];
  if (!canUpdateCustomer(customer)) return customFieldCell(field, value);
  if (field.type === 'SELECT') {
    const selectedOption = customFieldOption(field, value);
    return `<select class="quick-custom-field" style="--field-color:${escapeHtml(selectedOption?.color || '#64748b')}" data-quick-custom-field="${escapeHtml(customer.id)}" data-field-id="${escapeHtml(field.id)}" aria-label="${escapeHtml(field.label)} của ${escapeHtml(customer.name)}"><option value="">— Chưa chọn —</option>${field.options.map(option => `<option value="${escapeHtml(option.value)}" style="color:${escapeHtml(option.color)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select>`;
  }
  if (field.type === 'CHECKBOX') {
    return `<label class="quick-checkbox"><input type="checkbox" data-quick-custom-checkbox="${escapeHtml(customer.id)}" data-field-id="${escapeHtml(field.id)}" ${value ? 'checked' : ''}><span>${value ? 'Có' : 'Không'}</span></label>`;
  }
  if (field.type === 'MULTI_SELECT') {
    const count = Array.isArray(value) ? value.length : 0;
    return `<button class="button button-small quick-multi-button" type="button" data-quick-multi-field="${escapeHtml(customer.id)}" data-field-id="${escapeHtml(field.id)}">${count ? `${count} lựa chọn` : 'Chọn option'}</button><div class="field-pill-list">${customFieldCell(field, value)}</div>`;
  }
  return customFieldCell(field, value);
}

function quickStatusControl(customer) {
  if (!canUpdateCustomer(customer)) return statusBadge(customer.status);
  const currentMeta = STATUS_META[customer.status] || STATUS_META.NEW;
  return `<select class="quick-status quick-custom-field" style="--field-color:${escapeHtml(currentMeta.color)}" data-quick-status="${escapeHtml(customer.id)}" aria-label="Trạng thái của ${escapeHtml(customer.name)}">${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}" style="color:${escapeHtml(meta.color)}" ${customer.status === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`).join('')}</select>`;
}

function quickSaleControl(customer) {
  if (currentAccount.role === 'SALE') return customer.saleId ? `<b>${escapeHtml(staffName(customer.saleId))}</b>` : '<span class="status status-pending">Chưa phân Sale</span>';
  const sales = activeStaff().filter(person => person.role === 'SALE' && (currentAccount.role === 'ADMIN' || (person.leaderId === currentAccount.leaderId && person.teamId === currentAccount.teamId)));
  return `<select class="quick-sale-select" data-quick-sale="${escapeHtml(customer.id)}" aria-label="Sale phụ trách của ${escapeHtml(customer.name)}"><option value="">— Chưa phân Sale —</option>${sales.map(sale => `<option value="${escapeHtml(sale.id)}" ${customer.saleId === sale.id ? 'selected' : ''}>${escapeHtml(sale.name)}</option>`).join('')}</select>`;
}

function quickAssignSale(customerId, saleId) {
  if (!['ADMIN', 'LEADER'].includes(currentAccount.role)) return;
  const customer = customerById(customerId);
  const sale = activeStaff().find(person => person.id === saleId && person.role === 'SALE');
  if (!customer || !sale || (currentAccount.role === 'LEADER' && (sale.leaderId !== currentAccount.leaderId || sale.teamId !== currentAccount.teamId))) { toast('Sale không hợp lệ trong phạm vi tài khoản'); render(); return; }
  applyCustomerAssignment(customer, sale, `Giao trực tiếp cho ${sale.name}`);
  saveState(); renderPreservingCustomerScroll();
}

function customFieldInput(field, value) {
  const id = `customerField-${field.id}`;
  if (field.type === 'SELECT') return `<label class="form-field">${escapeHtml(field.label)}<select id="${escapeHtml(id)}"><option value="">— Chưa chọn —</option>${field.options.map(option => `<option value="${escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  if (field.type === 'MULTI_SELECT') return `<fieldset class="form-field custom-field-multi"><legend>${escapeHtml(field.label)}</legend><div>${field.options.map(option => `<label><input type="checkbox" data-customer-field-multi="${escapeHtml(field.id)}" value="${escapeHtml(option.value)}" ${(Array.isArray(value) ? value : []).includes(option.value) ? 'checked' : ''}><span class="field-pill" style="--pill:${escapeHtml(option.color)}">${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>`;
  if (field.type === 'CHECKBOX') return `<label class="form-field custom-field-check"><span>${escapeHtml(field.label)}</span><input id="${escapeHtml(id)}" type="checkbox" ${value ? 'checked' : ''}></label>`;
  if (field.type === 'NOTE') return `<label class="form-field full">${escapeHtml(field.label)}<textarea id="${escapeHtml(id)}" rows="3" maxlength="4000">${escapeHtml(value || '')}</textarea></label>`;
  const inputType = field.type === 'DATE' ? 'date' : field.type === 'NUMBER' ? 'number' : field.type === 'URL' ? 'url' : 'text';
  return `<label class="form-field ${field.type === 'URL' ? 'full' : ''}">${escapeHtml(field.label)}<input id="${escapeHtml(id)}" type="${inputType}" value="${escapeHtml(value ?? '')}" ${field.required ? 'required' : ''}></label>`;
}

function recordFieldChange(customer, field, from, to, source = 'MANUAL') {
  state.customerFieldHistory.unshift({
    id: `FLD-${Date.now()}-${state.customerFieldHistory.length}`,
    customerId: customer.id,
    fieldId: field.id,
    fieldLabel: field.label,
    from: structuredClone(from),
    to: structuredClone(to),
    actorId: currentAccount?.id || 'SYSTEM',
    actor: currentAccount?.name || 'Hệ thống',
    role: currentAccount?.role || 'SYSTEM',
    at: stamp(),
    source
  });
}

function setCustomerCustomFields(customerId, values, source = 'MANUAL') {
  const customer = customerById(customerId);
  if (!canViewCustomer(customer) || !canUpdateCustomer(customer) || !values || typeof values !== 'object') return { updated: false, changes: 0, error: 'FORBIDDEN' };
  const nextValues = {};
  for (const field of activeCustomFields()) {
    if (!Object.hasOwn(values, field.id)) continue;
    const next = sanitizeCustomFieldValue(values[field.id], field);
    const empty = next === '' || (Array.isArray(next) && !next.length);
    if (field.required && empty) return { updated: false, changes: 0, error: `${field.label} là bắt buộc` };
    nextValues[field.id] = next;
  }
  let changes = 0;
  Object.entries(nextValues).forEach(([fieldId, next]) => {
    const field = state.customFieldDefinitions.find(item => item.id === fieldId);
    const previous = customer.customFields?.[fieldId] ?? defaultCustomFieldValue(field);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    recordFieldChange(customer, field, previous, next, source);
    customer.customFields[fieldId] = next;
    changes += 1;
  });
  if (changes) {
    customer.updatedAt = stamp();
    audit('UPDATE_CUSTOMER_FIELDS', customer.id, `${changes} trường nghiệp vụ · ${source}`);
  }
  return { updated: changes > 0, changes, error: '' };
}

function updateCustomerCustomFields(customerId) {
  const values = {};
  activeCustomFields().forEach(field => {
    if (field.type === 'MULTI_SELECT') values[field.id] = $$(`[data-customer-field-multi="${field.id}"]:checked`).map(input => input.value);
    else if (field.type === 'CHECKBOX') values[field.id] = $(`#customerField-${field.id}`)?.checked === true;
    else values[field.id] = $(`#customerField-${field.id}`)?.value ?? '';
  });
  const result = setCustomerCustomFields(customerId, values);
  if (result.error) { toast(result.error === 'FORBIDDEN' ? 'FORBIDDEN · không có quyền cập nhật dữ liệu nghiệp vụ' : result.error); return; }
  if (!result.updated) { toast('Dữ liệu nghiệp vụ chưa thay đổi'); return; }
  saveState(); render(); openCustomerDrawer(customerId); toast(`Đã lưu ${result.changes} thay đổi; lịch sử Level được giữ nguyên`);
}

function customerSearchText(customer) {
  const sourceText = currentAccount.role === 'ADMIN' ? `${customer.source}${customer.campaign}${customerLandingName(customer)}` : '';
  return `${customer.name}${customer.phone}${customer.email}${customer.id}${sourceText}${customer.note}${Object.values(customer.customFields || {}).flat().join('')}`;
}

function customerOwnerOptions() {
  if (currentAccount.role === 'SALE') return '';
  const members = currentAccount.role === 'ADMIN' ? activeStaff() : activeStaff().filter(person => person.teamId === currentAccount.teamId && (person.role === 'SALE' || person.id === currentAccount.leaderId));
  const teamOptions = currentAccount.role === 'ADMIN' ? Array.from(new Set(STAFF.map(person => person.teamId))).sort().map(teamId => `<option value="team:${escapeHtml(teamId)}" ${customerOwnerFilter === `team:${teamId}` ? 'selected' : ''}>Team ${escapeHtml(teamId)}</option>`).join('') : '';
  const memberOptions = members.map(person => `<option value="${person.role.toLowerCase()}:${escapeHtml(person.id)}" ${customerOwnerFilter === `${person.role.toLowerCase()}:${person.id}` ? 'selected' : ''}>${person.role === 'LEADER' ? 'Leader' : 'Sale'} · ${escapeHtml(person.name)}</option>`).join('');
  return `<select id="customerOwnerFilter"><option value="ALL">Tất cả phân công</option><option value="UNASSIGNED" ${customerOwnerFilter === 'UNASSIGNED' ? 'selected' : ''}>Chưa phân Sale</option>${teamOptions}${memberOptions}</select>`;
}

function matchesCustomerOwnerFilter(customer) {
  if (customerOwnerFilter === 'ALL') return true;
  if (customerOwnerFilter === 'UNASSIGNED') return !customer.saleId;
  const [type, id] = customerOwnerFilter.split(':');
  if (type === 'team') return customer.teamId === id;
  if (type === 'leader') return customer.leaderId === id;
  if (type === 'sale') return customer.saleId === id;
  return true;
}

function customersView() {
  const query = normalize(globalQuery);
  const customers = scopedCustomers().filter(customer => customerStatusFilter === 'ALL' || customer.status === customerStatusFilter).filter(matchesCustomerOwnerFilter).filter(customer => !query || normalize(customerSearchText(customer)).includes(query)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const importButton = currentAccount.role === 'ADMIN' ? '<button class="button" id="importCustomersButton" type="button">Kết nối / nhập data</button>' : '';
  const fieldButton = currentAccount.role === 'ADMIN' ? '<button class="button" id="manageCustomerFieldsButton" type="button">Quản lý cột</button>' : '';
  const createButton = `${currentAccount.role !== 'SALE' ? '<button class="button" id="exportCustomersButton" type="button">Xuất CSV</button>' : ''}${fieldButton}${importButton}<button class="button button-primary" id="newCustomerButton" type="button">+ Thêm khách hàng</button>`;
  const title = currentAccount.role === 'ADMIN' ? 'Khách hàng tổng' : currentAccount.role === 'LEADER' ? `Khách hàng Team ${currentAccount.teamId}` : 'Khách hàng của tôi';
  const tableFields = activeCustomFields().filter(field => field.type !== 'MULTI_SELECT' && field.type !== 'NOTE');
  const sourceHeader = currentAccount.role === 'ADMIN' ? '<th>Nguồn / Landing page</th>' : '';
  const sourceCell = customer => currentAccount.role === 'ADMIN' ? (() => { const landing = customerLanding(customer); return `<td><div class="cell-main">${escapeHtml(landing?.domain || 'Chưa xác định')}</div><div class="cell-sub">${escapeHtml(customer.source)} · ${escapeHtml(customer.campaign)}</div></td>`; })() : '';
  const columnCount = 7 + tableFields.length + (currentAccount.role === 'ADMIN' ? 1 : 0);
  return pageHead(title, 'Quản lý trạng thái, Sale phụ trách, ghi chú, lịch chăm sóc và sản phẩm đã mua trên cùng hồ sơ.', createButton) +
    `<section class="panel customer-table-panel"><div class="toolbar"><input id="customerSearch" type="search" placeholder="Tên, SĐT, email, mã CRM, Level, ghi chú..." value="${escapeHtml(globalQuery)}"><select id="customerStatusFilter"><option value="ALL">Tất cả trạng thái</option>${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}" ${customerStatusFilter === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`).join('')}</select>${customerOwnerOptions()}<span class="spacer"></span><span class="data-note">${customers.length} khách · ${tableFields.length} cột nghiệp vụ</span></div><div class="table-wrap"><table class="customer-data-table"><thead><tr><th>Ngày data</th><th>Khách hàng</th>${sourceHeader}<th>Team / Leader</th><th>Sale phụ trách</th>${tableFields.map(field => `<th>${escapeHtml(field.label)}</th>`).join('')}<th>Trạng thái</th><th>Ghi chú mới nhất</th><th></th></tr></thead><tbody>${customers.map(customer => { const leader = STAFF.find(person => person.id === customer.leaderId); const dataDate = dataDateParts(customer.createdAt); return `<tr><td class="data-date-cell"><b>${escapeHtml(dataDate.date)}</b><small>${escapeHtml(dataDate.time)}</small></td><td><div class="cell-main">${escapeHtml(customer.name)}</div><div class="cell-sub">${currentAccount.role === 'SALE' && !customer.saleAcceptedAt ? (() => { const offer = state.dataOffers.find(o => o.customerId === customer.id && o.saleId === currentAccount.saleId && o.status === 'PENDING'); return offer ? `<span class="status status-pending">⏱ còn ${Math.floor(offerMinutesLeft(offer) / 60)}h${offerMinutesLeft(offer) % 60}p</span>` : '<span class="status status-pending">Chờ nhận data</span>'; })() : escapeHtml(customer.phone)}</div></td>${sourceCell(customer)}<td><div class="cell-main">${escapeHtml(leader?.name || 'Chưa phân Leader')}</div>${leader ? `<div class="cell-sub">Team ${escapeHtml(customer.teamId)}</div>` : ''}</td><td class="col-staff">${customer.saleId ? `<div class="cell-main">${escapeHtml(staffName(customer.saleId))}</div>${customer.saleAcceptedAt ? '' : '<div class="cell-sub">Chờ Sale nhận data</div>'}` : '<span class="status status-pending">Chưa phân Sale</span>'}</td>${tableFields.map(field => `<td>${customFieldTableControl(field, customer)}</td>`).join('')}<td>${quickStatusControl(customer)}</td><td><div class="cell-main mono">${escapeHtml(customer.updatedAt.slice(5))}</div><div class="cell-sub note-preview">${escapeHtml(customer.note)}</div></td><td>${currentAccount.role === 'SALE' && !customer.saleAcceptedAt ? `<button class="button button-small button-primary" data-accept-data="${escapeHtml(customer.id)}">Nhận data</button>` : ''}<button class="button button-small" data-open-customer="${escapeHtml(customer.id)}">Chi tiết</button></td></tr>`; }).join('') || `<tr><td colspan="${columnCount}"><div class="empty"><b>Không tìm thấy khách hàng</b><span>Hãy thử từ khóa hoặc bộ lọc khác.</span></div></td></tr>`}</tbody></table></div></section>${currentAccount.role === 'ADMIN' ? `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Lịch sử kết nối & cập nhật data</div><div class="panel-sub">Subdata, PDF, CSV và JSON · bản ghi trùng được lưu thành lần gửi lại</div></div><button class="button button-small" id="importCustomersSecondaryButton">+ Nguồn data</button></div><div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Nguồn</th><th>File / Endpoint</th><th>Số bản ghi</th><th>Người thực hiện</th><th>Trạng thái</th></tr></thead><tbody>${state.imports.slice(0, 8).map(item => `<tr><td class="mono">${escapeHtml(item.importedAt)}</td><td><b>${escapeHtml(item.source)}</b></td><td>${escapeHtml(item.filename)}</td><td>${number(item.records)}</td><td>${escapeHtml(item.actor)}</td><td>${item.status === 'SUCCESS' ? '<span class="status status-paid">Thành công</span>' : '<span class="status status-cancelled">Thất bại</span>'}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}

function poolView() {
  if (currentAccount.role === 'SALE') return accessDeniedView('Khách mới chỉ dành cho Admin và Leader.');
  const pool = scopedCustomers().filter(isPoolCustomer).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const targets = currentAccount.role === 'ADMIN'
    ? assignmentCandidates({ leaderId: null })
    : assignmentCandidates({ leaderId: currentAccount.leaderId, teamId: currentAccount.teamId });
  const targetLabel = currentAccount.role === 'ADMIN' ? 'Leader' : 'Sale';
  const automaticMode = currentAccount.role === 'ADMIN' ? state.settings.assignmentMode : state.settings.saleAssignmentModes[currentAccount.leaderId] || 'MANUAL';
  return pageHead(`Khách mới · ${pool.length}`, 'Data chưa phân được hiển thị bằng số trên menu; sau khi giao sẽ chuyển sang Khách hàng tổng.', '') +
    `<div class="grid grid-2"><section class="panel"><div class="panel-head"><div><div class="panel-title">Khách mới đang chờ phân</div><div class="panel-sub">${pool.length} bản ghi phù hợp phạm vi tài khoản</div></div>${pool.length ? '<button class="button button-small" id="selectPoolButton" type="button">Chọn tất cả</button>' : ''}</div><div class="panel-body">${pool.map(customer => `<label class="rank-row" style="grid-template-columns:24px minmax(0,1fr) auto"><input style="width:auto" type="checkbox" data-pool-id="${escapeHtml(customer.id)}" ${selectedPoolIds.has(customer.id) ? 'checked' : ''}><div><b>${escapeHtml(customer.name)}</b><small>${escapeHtml(customer.id)}${currentAccount.role === 'ADMIN' ? ` · ${escapeHtml(customerLandingName(customer))}` : ''}</small><div class="cell-sub">${currentAccount.role === 'ADMIN' ? `${escapeHtml(customer.source)} · ` : ''}${escapeHtml(customer.createdAt)} · ${escapeHtml(customer.note)}</div></div>${statusBadge(customer.status)}</label>`).join('') || `<div class="empty"><b>Không còn khách mới</b><span>Tất cả data trong phạm vi đã được phân.</span></div>`}</div></section>
    <aside class="panel"><div class="panel-head"><div><div class="panel-title">Phân data cho ${targetLabel}</div><div class="panel-sub">${currentAccount.role === 'LEADER' ? `Chỉ nhân sự thuộc Team ${escapeHtml(currentAccount.teamId)}` : 'Admin phân theo đúng tuyến quản lý'}</div></div></div><div class="panel-body">
      <div class="section-label">Tự động cho data mới</div><label class="form-field">Chế độ<select id="assignmentModeSelect"><option value="MANUAL" ${automaticMode === 'MANUAL' ? 'selected' : ''}>Thủ công</option><option value="ROUND_ROBIN" ${automaticMode === 'ROUND_ROBIN' ? 'selected' : ''}>Lần lượt (round-robin)</option><option value="BALANCED" ${automaticMode === 'BALANCED' ? 'selected' : ''}>Cân bằng theo tải hiện tại</option></select></label><div class="connection-actions" style="margin:12px 0 18px"><button class="button button-small" data-bulk-distribute="ROUND_ROBIN" ${!pool.length || !targets.length ? 'disabled' : ''}>Chia lần lượt toàn bộ</button><button class="button button-small button-primary" data-bulk-distribute="BALANCED" ${!pool.length || !targets.length ? 'disabled' : ''}>Chia đều toàn bộ cho ${targetLabel}</button></div>
      <div class="section-label">Phân thủ công bản ghi đã chọn</div><label class="form-field">${targetLabel} nhận khách<select id="poolTarget">${targets.map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)} · ${escapeHtml(person.teamId)}</option>`).join('')}</select></label><label class="form-field" style="margin-top:12px">Lý do<textarea id="poolReason" rows="4" placeholder="Ví dụ: Data từ chiến dịch tháng 9"></textarea></label><button id="assignPoolButton" class="button button-primary button-block" style="margin-top:13px" type="button" ${!targets.length ? 'disabled' : ''}>Phân cho ${targetLabel}</button><div class="credential-hint">Sau khi phân, data chuyển sang Khách hàng tổng; nguồn, campaign và landing page vẫn được giữ nguyên.</div></div></aside></div>`;
}

function distributionView() {
  if (currentAccount.role !== 'ADMIN') return accessDeniedView('Chỉ Admin được cấu hình chia Leader và tỷ trọng nhận data.');
  const leaders = activeStaff().filter(member => member.role === 'LEADER').sort((a, b) => a.id.localeCompare(b.id));
  if (!leaders.some(leader => leader.id === distributionLeaderId)) distributionLeaderId = leaders[0]?.id || '';
  const selectedLeader = leaders.find(leader => leader.id === distributionLeaderId);
  const sales = selectedLeader ? activeStaff().filter(member => member.role === 'SALE' && member.leaderId === selectedLeader.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const enabledLeaders = new Set(state.leaderDistribution.enabledLeaderIds);
  const saleConfig = state.saleDistributionByLeader[distributionLeaderId] || { enabledSaleIds: [], weights: {} };
  const enabledSales = new Set(saleConfig.enabledSaleIds);
  const pool = state.customers.filter(customer => !customer.saleId && !customer.leaderId && !customer.teamId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const intakeRows = [
    ...state.customers.map(customer => ({ id: `NEW:${customer.id}`, at: customer.createdAt, customer, kind: 'NEW', source: customer.source, campaign: customer.campaign })),
    ...state.resubmissions.map(item => ({ id: `RETURN:${item.id}`, at: item.at, customer: customerById(item.customerId), kind: 'RETURN', source: item.source, campaign: item.campaign, registeredAccount: item.registeredAccount }))
  ].filter(item => item.customer).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0, 60);
  const tabs = [['QUEUE', `Thứ tự data mới vào (${pool.length})`], ['AUTO', 'Tự động'], ['SOURCE', 'Theo nguồn'], ['LEADERS', 'Danh sách Leader'], ['SALES', 'Sale theo Leader']];
  let body = '';
  if (distributionTab === 'QUEUE') {
    body = `<div class="grid grid-2 distribution-queue-layout"><section class="panel"><div class="panel-head"><div><div class="panel-title">Thứ tự data mới vào</div><div class="panel-sub">Mới nhất ở trên · gồm data mới và khách điền lại form</div></div>${pool.length ? '<button class="button button-small" id="selectPoolButton" type="button">Chọn tất cả đang chờ</button>' : ''}</div><div class="table-wrap"><table class="intake-order-table"><thead><tr><th>Thứ tự</th><th>Ngày data</th><th>Khách hàng</th><th>Loại data</th><th>Nguồn</th><th>Đang phụ trách</th></tr></thead><tbody>${intakeRows.map((item, index) => { const customer = item.customer; const dataDate = dataDateParts(item.at); const waiting = item.kind === 'NEW' && !customer.saleId && !customer.leaderId; return `<tr class="${waiting ? 'queue-waiting' : ''}"><td><div class="queue-sequence">#${index + 1}</div>${waiting ? `<input type="checkbox" data-pool-id="${escapeHtml(customer.id)}" ${selectedPoolIds.has(customer.id) ? 'checked' : ''} aria-label="Chọn ${escapeHtml(customer.name)}">` : ''}</td><td class="data-date-cell"><b>${escapeHtml(dataDate.date)}</b><small>${escapeHtml(dataDate.time)}</small></td><td><div class="cell-main">${escapeHtml(customer.name)}</div><div class="cell-sub">${escapeHtml(customer.phone)} · ${escapeHtml(customer.id)}</div></td><td>${item.kind === 'RETURN' ? `<span class="status ${item.registeredAccount ? 'status-cancelled' : 'status-info'}">${item.registeredAccount ? 'Trùng · Đã đăng ký TK' : 'Điền lại form'}</span>` : waiting ? '<span class="status status-pending">Chờ chia Leader</span>' : '<span class="status status-paid">Data mới</span>'}</td><td><b>${escapeHtml(item.source)}</b><div class="cell-sub">${escapeHtml(item.campaign || 'Không campaign')}</div></td><td>${quickSaleControl(customer)}</td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty"><b>Chưa có data</b><span>Data mới từ form/API sẽ xuất hiện theo thời gian tại đây.</span></div></td></tr>'}</tbody></table></div></section><aside class="panel queue-assignment-panel"><div class="panel-head"><div><div class="panel-title">Xử lý hàng chờ</div><div class="panel-sub">${pool.length} data chưa có Leader · ưu tiên cũ nhất trước</div></div></div><div class="panel-body">${webhookQueueNoticeMarkup()}<div class="connection-actions" style="margin:0 0 18px"><button class="button button-small" data-bulk-distribute="ROUND_ROBIN" ${!pool.length || !enabledLeaders.size ? 'disabled' : ''}>Chia lần lượt</button><button class="button button-small button-primary" data-bulk-distribute="BALANCED" ${!pool.length || !enabledLeaders.size ? 'disabled' : ''}>Chia cân bằng</button></div><label class="form-field">Leader nhận data<select id="poolTarget">${leaders.filter(leader => enabledLeaders.has(leader.id)).map(leader => `<option value="${escapeHtml(leader.id)}">${escapeHtml(leader.name)} · ${escapeHtml(leader.teamId)}</option>`).join('')}</select></label><label class="form-field" style="margin-top:12px">Lý do<textarea id="poolReason" rows="3" placeholder="Phân theo thứ tự data vào">Phân theo thứ tự data vào</textarea></label><button id="assignPoolButton" class="button button-primary button-block" style="margin-top:13px" type="button" ${!pool.length || !enabledLeaders.size ? 'disabled' : ''}>Phân data đã chọn</button><div class="credential-hint">Khách điền lại form không vào chia ngẫu nhiên: hệ thống tự trả về đúng Sale cũ và vẫn hiện trong danh sách thứ tự phía bên trái.</div></div></aside></div>`;
  } else if (distributionTab === 'AUTO') {
    body = `<div class="grid grid-2"><section class="panel"><div class="panel-head"><div><div class="panel-title">Cơ chế chia data mới</div><div class="panel-sub">Luật theo nguồn được ưu tiên, sau đó áp dụng chế độ mặc định</div></div><button class="toggle ${state.leaderDistribution.enabled ? 'on' : ''}" id="toggleLeaderDistribution" aria-pressed="${state.leaderDistribution.enabled}" aria-label="Bật tắt chia Leader"></button></div><div class="panel-body"><label class="form-field">Chế độ mặc định<select id="assignmentModeSelect"><option value="MANUAL" ${state.settings.assignmentMode === 'MANUAL' ? 'selected' : ''}>Thủ công</option><option value="ROUND_ROBIN" ${state.settings.assignmentMode === 'ROUND_ROBIN' ? 'selected' : ''}>Lần lượt có tỷ trọng</option><option value="BALANCED" ${state.settings.assignmentMode === 'BALANCED' ? 'selected' : ''}>Cân bằng tải / tỷ trọng</option></select></label><div class="credential-hint" style="margin-top:12px">Tỷ trọng 2 nhận gấp đôi lượt so với tỷ trọng 1. Cân bằng so sánh số khách hiện tại chia cho tỷ trọng, không phá lịch sử phân công cũ.</div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Tình trạng phân phối</div><div class="panel-sub">Chỉ Leader được bật mới nhận data mới</div></div></div><div class="panel-body"><div class="stat-row"><div><small>Leader hoạt động</small><b>${enabledLeaders.size}/${leaders.length}</b></div><div><small>Luật theo nguồn</small><b>${state.leaderDistribution.sourceRules.filter(rule => rule.active).length}</b></div><div><small>Khách đang chờ</small><b>${state.customers.filter(customer => !customer.leaderId && !customer.saleId).length}</b></div></div></div></section></div>`;
  } else if (distributionTab === 'SOURCE') {
    body = `<section class="panel"><div class="panel-head"><div><div class="panel-title">Luật chia Leader theo nguồn</div><div class="panel-sub">Ưu tiên Website/Landing, nguồn hoặc campaign chính xác trước chế độ mặc định</div></div></div><div class="panel-body"><form id="distributionSourceRuleForm" class="distribution-toolbar"><label class="form-field">Loại điều kiện<select id="distributionRuleType"><option value="WEBSITE">Website / Landing ID</option><option value="SOURCE">Tên nguồn</option><option value="CAMPAIGN">Campaign</option></select></label><label class="form-field">Giá trị khớp<input id="distributionRuleValue" required maxlength="200" placeholder="WEB-2 hoặc Facebook Ads"></label><label class="form-field">Giao cho Leader<select id="distributionRuleLeader">${leaders.filter(leader => enabledLeaders.has(leader.id)).map(leader => `<option value="${escapeHtml(leader.id)}">${escapeHtml(leader.name)} · ${escapeHtml(leader.teamId)}</option>`).join('')}</select></label><button class="button button-primary" type="submit" ${!enabledLeaders.size ? 'disabled' : ''}>+ Thêm luật</button></form><div class="credential-hint">Website ID có tại mục Websites. Luật không làm lộ nguồn cho tài khoản Leader/Sale và chỉ áp dụng cho data mới.</div></div><div class="table-wrap"><table><thead><tr><th>Ưu tiên</th><th>Điều kiện</th><th>Giá trị</th><th>Leader nhận</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.leaderDistribution.sourceRules.map((rule, index) => `<tr><td class="mono">#${index + 1}</td><td>${escapeHtml({ WEBSITE: 'Website / Landing', SOURCE: 'Nguồn', CAMPAIGN: 'Campaign' }[rule.matchType])}</td><td><b>${escapeHtml(rule.matchValue)}</b></td><td>${escapeHtml(staffName(rule.targetLeaderId))}</td><td><span class="status ${rule.active ? 'status-paid' : 'status-pending'}">${rule.active ? 'Đang áp dụng' : 'Tạm tắt'}</span></td><td><button class="button button-small" data-toggle-source-rule="${escapeHtml(rule.id)}">${rule.active ? 'Tắt' : 'Bật'}</button> <button class="button button-small button-danger" data-delete-source-rule="${escapeHtml(rule.id)}">Xóa</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty"><b>Chưa có luật theo nguồn</b><span>Data mới sẽ dùng chế độ mặc định.</span></div></td></tr>'}</tbody></table></div></section>`;
  } else if (distributionTab === 'LEADERS') {
    body = `<section class="panel"><div class="panel-head"><div><div class="panel-title">Leader nhận data</div><div class="panel-sub">Bật/tắt và đặt tỷ trọng riêng cho từng Leader</div></div></div><div class="field-manager">${leaders.map(leader => { const saleCount = activeStaff().filter(member => member.role === 'SALE' && member.leaderId === leader.id).length; return `<div class="field-manager-row"><div class="avatar">${escapeHtml(leader.initials)}</div><div><b>${escapeHtml(leader.name)}</b><small>${escapeHtml(leader.teamId)} · ${saleCount} Sale · đang phụ trách ${assignmentLoad(leader)} khách</small></div><label class="weight-control">Tỷ trọng<input class="weight-input" type="number" min="1" max="100" value="${state.leaderDistribution.weights[leader.id] || 1}" data-distribution-weight="LEADER:${escapeHtml(leader.id)}"></label><label class="member-switch"><input type="checkbox" data-distribution-member="LEADER:${escapeHtml(leader.id)}" ${enabledLeaders.has(leader.id) ? 'checked' : ''}><span>${enabledLeaders.has(leader.id) ? 'Đang nhận' : 'Tạm tắt'}</span></label></div>`; }).join('') || '<div class="empty"><b>Chưa có Leader</b><span>Thêm Leader tại mục Đội ngũ trước.</span></div>'}</div></section>`;
  } else {
    body = `<section class="panel"><div class="panel-head"><div><div class="panel-title">Sale nhận data trong từng Team</div><div class="panel-sub">Leader chỉ có thể chia cho Sale đã được Admin bật ở đây</div></div><select id="distributionLeaderSelect">${leaders.map(leader => `<option value="${escapeHtml(leader.id)}" ${leader.id === distributionLeaderId ? 'selected' : ''}>${escapeHtml(leader.name)} · ${escapeHtml(leader.teamId)}</option>`).join('')}</select></div><div class="field-manager">${sales.map(sale => `<div class="field-manager-row"><div class="avatar">${escapeHtml(sale.initials)}</div><div><b>${escapeHtml(sale.name)}</b><small>${escapeHtml(sale.teamId)} · đang phụ trách ${assignmentLoad(sale)} khách</small></div><label class="weight-control">Tỷ trọng<input class="weight-input" type="number" min="1" max="100" value="${saleConfig.weights[sale.id] || 1}" data-distribution-weight="SALE:${escapeHtml(sale.id)}"></label><label class="member-switch"><input type="checkbox" data-distribution-member="SALE:${escapeHtml(sale.id)}" ${enabledSales.has(sale.id) ? 'checked' : ''}><span>${enabledSales.has(sale.id) ? 'Đang nhận' : 'Tạm tắt'}</span></label></div>`).join('') || '<div class="empty"><b>Leader chưa có Sale</b><span>Thêm hoặc điều chuyển Sale tại mục Đội ngũ.</span></div>'}</div></section>`;
  }
  return pageHead('Chia Leader', 'Kiểm soát tuyến phân data từ nguồn vào Leader, rồi từ Leader xuống Sale; lịch sử phụ trách cũ luôn được giữ.') + `<div class="distribution-tabs">${tabs.map(([id, label]) => `<button class="distribution-tab ${distributionTab === id ? 'active' : ''}" data-distribution-tab="${id}">${label}</button>`).join('')}</div>${body}`;
}

function toggleLeaderDistribution() {
  if (currentAccount.role !== 'ADMIN') return;
  state.leaderDistribution.enabled = !state.leaderDistribution.enabled;
  audit('TOGGLE_LEADER_DISTRIBUTION', 'DISTRIBUTION', state.leaderDistribution.enabled ? 'Bật' : 'Tắt');
  saveState(); render(); toast(state.leaderDistribution.enabled ? 'Đã bật chia Leader' : 'Đã tắt nhận data tự động');
}

function updateDistributionMember(kind, id, enabled) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được cấu hình chia data'); return; }
  if (kind === 'LEADER') {
    const ids = new Set(state.leaderDistribution.enabledLeaderIds);
    enabled ? ids.add(id) : ids.delete(id);
    state.leaderDistribution.enabledLeaderIds = Array.from(ids);
  } else {
    const sale = activeStaff().find(member => member.id === id && member.role === 'SALE');
    if (!sale) return;
    const config = state.saleDistributionByLeader[sale.leaderId] || (state.saleDistributionByLeader[sale.leaderId] = { enabledSaleIds: [], weights: {} });
    const ids = new Set(config.enabledSaleIds);
    enabled ? ids.add(id) : ids.delete(id);
    config.enabledSaleIds = Array.from(ids);
  }
  audit('UPDATE_DISTRIBUTION_MEMBER', id, `${kind} · ${enabled ? 'bật nhận data' : 'tắt nhận data'}`);
  saveState(); render();
}

function updateDistributionWeight(kind, id, value) {
  if (currentAccount.role !== 'ADMIN') return;
  const weight = Math.max(1, Math.min(100, Math.round(Number(value) || 1)));
  if (kind === 'LEADER') state.leaderDistribution.weights[id] = weight;
  else {
    const sale = activeStaff().find(member => member.id === id && member.role === 'SALE');
    if (!sale) return;
    const config = state.saleDistributionByLeader[sale.leaderId] || (state.saleDistributionByLeader[sale.leaderId] = { enabledSaleIds: [], weights: {} });
    config.weights[id] = weight;
  }
  audit('UPDATE_DISTRIBUTION_WEIGHT', id, `${kind} · tỷ trọng ${weight}`);
  saveState(); render(); toast('Đã cập nhật tỷ trọng');
}

function addDistributionSourceRule() {
  if (currentAccount.role !== 'ADMIN') return;
  const matchType = $('#distributionRuleType')?.value, matchValue = $('#distributionRuleValue')?.value.trim(), targetLeaderId = $('#distributionRuleLeader')?.value;
  if (!['WEBSITE', 'SOURCE', 'CAMPAIGN'].includes(matchType) || !matchValue || !state.leaderDistribution.enabledLeaderIds.includes(targetLeaderId)) { toast('Điều kiện hoặc Leader nhận chưa hợp lệ'); return; }
  const duplicate = state.leaderDistribution.sourceRules.some(rule => rule.matchType === matchType && normalize(rule.matchValue) === normalize(matchValue));
  if (duplicate) { toast('Điều kiện này đã có luật phân phối'); return; }
  state.leaderDistribution.sourceRules.push({ id: `RULE-${Date.now()}`, matchType, matchValue: matchValue.slice(0, 200), targetLeaderId, active: true });
  audit('CREATE_DISTRIBUTION_RULE', targetLeaderId, `${matchType}:${matchValue}`);
  saveState(); render(); toast('Đã thêm luật chia theo nguồn');
}

function toggleDistributionSourceRule(id) {
  if (currentAccount.role !== 'ADMIN') return;
  const rule = state.leaderDistribution.sourceRules.find(item => item.id === id);
  if (!rule) return;
  rule.active = !rule.active;
  audit('TOGGLE_DISTRIBUTION_RULE', id, rule.active ? 'Bật' : 'Tắt');
  saveState(); render();
}

function deleteDistributionSourceRule(id) {
  if (currentAccount.role !== 'ADMIN') return;
  const rule = state.leaderDistribution.sourceRules.find(item => item.id === id);
  if (!rule || !window.confirm('Xóa luật chia theo nguồn này? Lịch sử khách đã phân không bị thay đổi.')) return;
  state.leaderDistribution.sourceRules = state.leaderDistribution.sourceRules.filter(item => item.id !== id);
  audit('DELETE_DISTRIBUTION_RULE', id, `${rule.matchType}:${rule.matchValue}`);
  saveState(); render(); toast('Đã xóa luật; lịch sử phân công vẫn còn');
}

function ordersView() {
  const query = normalize(globalQuery);
  const orders = scopedOrders().filter(order => orderStatusFilter === 'ALL' || order.status === orderStatusFilter).filter(order => !query || normalize(`${order.code}${order.customerName}${order.productName}${currentAccount.role === 'ADMIN' ? order.source : ''}`).includes(query)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return pageHead(currentAccount.role === 'SALE' ? 'Đơn hàng của tôi' : 'Quản lý đơn hàng', 'Đơn hàng, sản phẩm và trạng thái thanh toán trên cùng một bản ghi.', `${currentAccount.role !== 'SALE' ? '<button class="button" id="exportOrdersButton" type="button">Xuất CSV</button>' : ''}<button class="button button-primary" id="newOrderButton" type="button">+ Tạo đơn hàng</button>`) +
    `<section class="panel"><div class="toolbar"><input id="orderSearch" type="search" placeholder="Mã đơn, khách, sản phẩm..." value="${escapeHtml(globalQuery)}"><select id="orderStatusFilter"><option value="ALL">Tất cả thanh toán</option>${Object.entries(ORDER_STATUS).map(([key, meta]) => `<option value="${key}" ${orderStatusFilter === key ? 'selected' : ''}>${meta[0]}</option>`).join('')}</select><span class="spacer"></span><span class="data-note">${orders.length} đơn trong scope</span></div>${ordersTable(orders, true)}</section>`;
}

function productsView() {
  const rows = PRODUCTS.filter(product => currentAccount.role === 'ADMIN' || product.active !== false);
  const actions = currentAccount.role === 'ADMIN' ? '<button class="button" id="manageProductCategoriesButton">Danh mục</button><button class="button button-primary" id="newProductButton">+ Thêm sản phẩm</button>' : '';
  return pageHead('Sản phẩm', '', actions) +
    `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Mã SKU</th><th>Danh mục</th><th>Đơn giá</th><th>Trạng thái</th>${currentAccount.role === 'ADMIN' ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(product => `<tr><td><div class="cell-main">${escapeHtml(product.name)}</div></td><td class="mono">${escapeHtml(product.sku || '—')}</td><td><span class="status status-info">${escapeHtml(product.category)}</span></td><td><b>${money(product.price)}</b></td><td>${product.active !== false ? '<span class="status status-active">Đang bán</span>' : '<span class="status status-pending">Ngừng bán</span>'}</td>${currentAccount.role === 'ADMIN' ? `<td><button class="button button-small" data-edit-product="${escapeHtml(product.id)}">Sửa</button><button class="button button-small" data-toggle-product="${escapeHtml(product.id)}">${product.active !== false ? 'Ngừng bán' : 'Bán lại'}</button><button class="button button-small button-danger" data-delete-product="${escapeHtml(product.id)}">Xóa</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="6"><div class="empty"><b>Chưa có sản phẩm</b><span>Admin cần tạo sản phẩm trước khi lập đơn.</span></div></td></tr>'}</tbody></table></div></section>`;
}

function productModal(id = null) {
  if (currentAccount.role !== 'ADMIN') return;
  const existing = id ? productById(id) : null;
  const item = existing || { name: '', sku: '', category: '', price: 0 };
  const categories = [...state.productCategories];
  if (item.category && !categories.includes(item.category)) categories.push(item.category);
  openModal(existing ? 'Sửa sản phẩm' : 'Thêm sản phẩm', `<form id="productForm"><div class="form-grid"><label class="form-field">Tên sản phẩm *<input id="productName" required maxlength="200" value="${escapeHtml(item.name)}"></label><label class="form-field">Mã SKU<input id="productSku" maxlength="60" value="${escapeHtml(item.sku)}"></label><label class="form-field">Danh mục *<select id="productCategory" required><option value="">Chọn danh mục</option>${categories.map(category => `<option value="${escapeHtml(category)}" ${category === item.category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label><label class="form-field">Đơn giá *<input id="productPrice" type="number" required min="0" step="1000" value="${item.price}"></label></div><div class="modal-actions"><button class="button" type="button" data-close-modal>Hủy</button><button class="button button-primary" type="submit">Lưu sản phẩm</button></div></form>`);
  $('#productForm').onsubmit = event => {
    event.preventDefault();
    const values = { name: $('#productName').value.trim(), sku: $('#productSku').value.trim(), category: $('#productCategory').value.trim(), price: Number($('#productPrice').value) };
    if (!values.name || !values.category || !Number.isFinite(values.price) || values.price < 0) return;
    if (values.sku && PRODUCTS.some(product => product.id !== id && product.sku && normalize(product.sku) === normalize(values.sku))) { toast('Mã SKU đã tồn tại'); return; }
    if (existing) Object.assign(existing, values); else PRODUCTS.unshift({ id: `PRD-${Date.now()}`, ...values, active: true });
    state.products = PRODUCTS;
    audit(existing ? 'EDIT_PRODUCT' : 'CREATE_PRODUCT', existing?.id || PRODUCTS[0].id, values.name);
    saveState(); closeModal(); render();
  };
}

function toggleProduct(id) {
  if (currentAccount.role !== 'ADMIN') return;
  const product = productById(id); if (!product) return;
  product.active = product.active === false;
  state.products = PRODUCTS;
  audit('TOGGLE_PRODUCT', id, product.active ? 'Đang bán' : 'Ngừng bán');
  saveState(); render();
}

function deleteProduct(id) {
  if (currentAccount.role !== 'ADMIN') return;
  const product = productById(id);
  if (!product || !window.confirm(`Xóa sản phẩm "${product.name}"? Các đơn hàng cũ vẫn giữ nguyên thông tin đã ghi nhận.`)) return;
  PRODUCTS = PRODUCTS.filter(item => item.id !== id);
  state.products = PRODUCTS;
  audit('DELETE_PRODUCT', id, product.name);
  saveState(); render();
}

function productCategoriesModal() {
  if (currentAccount.role !== 'ADMIN') return;
  openModal('Quản lý danh mục', `<form id="newProductCategoryForm" class="inline-form"><input id="newProductCategory" required maxlength="100" placeholder="Tên danh mục mới"><button class="button button-primary" type="submit">+ Thêm</button></form><div class="field-manager" style="padding:14px 0 0">${state.productCategories.map((category, index) => `<div class="field-manager-row"><input data-category-name="${index}" maxlength="100" value="${escapeHtml(category)}"><button class="button button-small" type="button" data-save-category="${index}">Lưu</button><button class="button button-small button-danger" type="button" data-delete-category="${index}">Xóa</button></div>`).join('')}</div>`);
  $('#newProductCategoryForm').onsubmit = event => { event.preventDefault(); const name = $('#newProductCategory').value.trim(); if (!name || state.productCategories.some(item => normalize(item) === normalize(name))) return; state.productCategories.push(name); saveState(); productCategoriesModal(); };
  $$('[data-save-category]').forEach(button => button.onclick = () => { const index = Number(button.dataset.saveCategory), oldName = state.productCategories[index], name = $(`[data-category-name="${index}"]`).value.trim(); if (!name) return; state.productCategories[index] = name; PRODUCTS.forEach(product => { if (product.category === oldName) product.category = name; }); state.products = PRODUCTS; saveState(); productCategoriesModal(); });
  $$('[data-delete-category]').forEach(button => button.onclick = () => { const index = Number(button.dataset.deleteCategory), name = state.productCategories[index]; if (PRODUCTS.some(product => product.category === name)) { toast('Danh mục đang có sản phẩm, hãy đổi danh mục sản phẩm trước'); return; } state.productCategories.splice(index, 1); saveState(); productCategoriesModal(); });
}

function revenueView() {
  const current = periodSnapshot(), series = dailySeries(), products = productPerformance(scopedOrders()).filter(product => product.paidOrders || product.refunds), sources = sourcePerformance();
  const websites = websiteRevenuePerformance();
  const activeSources = sources.filter(source => source.paidOrders || source.revenue !== 0);
  const gross = current.paid.reduce((sum, order) => sum + order.subtotal, 0);
  const discounts = current.paid.reduce((sum, order) => sum + order.discount, 0);
  const refunds = current.refunds.reduce((sum, order) => sum + order.refund, 0);
  const sourceRevenueHtml = currentAccount.role === 'ADMIN' ? `<section class="panel"><div class="panel-head"><div><div class="panel-title">Doanh thu theo nguồn</div><div class="panel-sub">Attribution last-touch của đơn hàng</div></div></div><div class="panel-body">${activeSources.map((source, index) => { const share = current.revenue > 0 ? source.revenue / current.revenue * 100 : 0; return `<div class="rank-row"><span class="rank">${index + 1}</span><div><b>${escapeHtml(source.source)}</b><small>${source.paidOrders} đơn · ${share.toFixed(1).replace('.', ',')}% doanh thu</small><div class="progress"><i style="width:${Math.max(share, 0)}%;background:${source.color}"></i></div></div><div class="rank-value"><b>${money(source.revenue, true)}</b><small>${source.roas ? `${source.roas.toFixed(1)}x ROAS` : 'Organic'}</small></div></div>`; }).join('') || '<div class="empty"><b>Chưa có doanh thu theo nguồn</b><span>Không phát sinh thanh toán hoặc hoàn tiền trong kỳ.</span></div>'}</div></section>` : '';
  const websiteRevenueHtml = currentAccount.role === 'ADMIN' ? `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Doanh thu theo website / landing page</div><div class="panel-sub">Quy nguồn bằng snapshot website trên đơn; dòng thiếu dữ liệu được tách riêng</div></div></div><div class="table-wrap"><table><thead><tr><th>Website / Landing</th><th>Data mới</th><th>Lượt thanh toán</th><th>Thu tiền</th><th>Hoàn tiền</th><th>Doanh thu thuần</th><th>Tỷ trọng</th></tr></thead><tbody>${websites.map(row => { const share = current.revenue > 0 ? row.net / current.revenue * 100 : 0; return `<tr><td><div class="cell-main">${escapeHtml(row.name)}</div><div class="cell-sub">${escapeHtml(row.domain)}</div></td><td>${number(row.data)}</td><td>${number(row.paidOrders)}</td><td>${money(row.gross)}</td><td>${money(row.refunds)}</td><td><b>${money(row.net)}</b></td><td>${share.toFixed(1).replace('.', ',')}%</td></tr>`; }).join('') || '<tr><td colspan="7"><div class="empty"><b>Chưa có doanh thu theo website</b><span>Chưa phát sinh data hoặc giao dịch trong kỳ.</span></div></td></tr>'}</tbody></table></div></section>` : '';
  return pageHead(currentAccount.role === 'SALE' ? 'Doanh thu của tôi' : 'Doanh thu & thanh toán', 'Đối chiếu doanh thu thuần theo ngày thanh toán, ngày hoàn tiền, sản phẩm và nguồn.', currentAccount.role !== 'SALE' ? '<button class="button" id="exportRevenueButton" type="button">Xuất CSV</button>' : '') + dateFilter() +
    `<div class="kpi-grid" style="grid-template-columns:repeat(4,minmax(150px,1fr))">${kpiCard('Σ', 'Doanh số gộp', money(gross, true), `${current.units} sản phẩm`)}${kpiCard('-', 'Chiết khấu', money(discounts, true), 'Đã trừ khỏi đơn')}${kpiCard('↩', 'Hoàn tiền', money(refunds, true), `${current.refunds.length} giao dịch`)}${kpiCard('₫', 'Doanh thu thuần', money(current.revenue, true), `${current.paid.length} lượt thanh toán`)}</div>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Dòng doanh thu theo ngày</div><div class="panel-sub">Ghi theo paidAt và trừ hoàn tiền đúng ngày refundedAt</div></div></div><div class="panel-body">${revenueChart(series, 300)}</div></section>
    <div class="grid ${currentAccount.role === 'ADMIN' ? 'grid-2' : ''}" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><div class="panel-title">Chi tiết theo sản phẩm</div><div class="panel-sub">Đơn, số lượng, doanh thu và tỷ lệ hoàn</div></div></div><div class="table-wrap"><table><thead><tr><th>Sản phẩm / SKU</th><th>SL bán</th><th>Đơn</th><th>Doanh thu</th><th>Hoàn</th><th>So kỳ trước</th></tr></thead><tbody>${products.map(product => `<tr><td><div class="cell-main">${escapeHtml(product.name)}</div><div class="cell-sub">${escapeHtml(product.sku)} · ${escapeHtml(product.category)}</div></td><td>${product.units}</td><td>${product.paidOrders}</td><td><b>${money(product.revenue)}</b></td><td>${product.refunds}</td><td>${deltaBadge(delta(product.revenue, product.previousRevenue))}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty"><b>Chưa có sản phẩm bán ra</b><span>Không có thanh toán hoặc hoàn tiền trong kỳ.</span></div></td></tr>'}</tbody></table></div></section>${sourceRevenueHtml}</div>
    ${websiteRevenueHtml}
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Sổ giao dịch</div><div class="panel-sub">Mỗi lần thu và hoàn tiền là một dòng tài chính riêng</div></div></div>${transactionsTable(current.transactions.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))}</section>`;
}

function marketingView() {
  const customers = scopedCustomers().filter(customer => inCurrentPeriod(customer.createdAt));
  const makeDistribution = (key, fallback) => {
    const grouped = new Map();
    customers.forEach(customer => {
      const name = customer[key] || fallback;
      const item = grouped.get(name) || { name, data: 0, color: FIELD_COLORS[grouped.size % FIELD_COLORS.length] };
      item.data += 1;
      grouped.set(name, item);
    });
    return Array.from(grouped.values()).sort((a, b) => b.data - a.data);
  };
  return pageHead('Dữ liệu', 'Thống kê data thực tế theo landing page và sản phẩm.') + dateFilter() +
    `<div class="grid grid-2"><section class="panel"><div class="panel-head"><div><div class="panel-title">Data theo landing page</div><div class="panel-sub">Dữ liệu đã nhập trong kỳ</div></div></div><div class="panel-body">${distributionDonut(makeDistribution('landingPageName', 'Chưa xác định landing page'), 'data', 'data')}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Data theo sản phẩm</div><div class="panel-sub">Sản phẩm từ bản ghi nhập</div></div></div><div class="panel-body">${distributionDonut(makeDistribution('productName', 'Chưa xác định sản phẩm'), 'data', 'data')}</div></section></div>`;
  const canViewTraffic = currentAccount.role === 'ADMIN';
  const sources = sourcePerformance();
  const totals = sources.reduce((acc, source) => ({ sessions: acc.sessions + source.sessions, trackedLeads: acc.trackedLeads + source.trackedLeads, leads: acc.leads + source.leads, paidOrders: acc.paidOrders + source.paidOrders, convertedCustomers: acc.convertedCustomers + source.convertedCustomers, revenue: acc.revenue + source.revenue, spend: acc.spend + source.spend }), { sessions: 0, trackedLeads: 0, leads: 0, paidOrders: 0, convertedCustomers: 0, revenue: 0, spend: 0 });
  const funnel = canViewTraffic
    ? [['Sessions', totals.sessions], ['Form gửi có tracking', totals.trackedLeads], ['Data ghi vào CRM', totals.leads], ['Khách đã trả trong cohort', totals.convertedCustomers]]
    : [[currentAccount.role === 'SALE' ? 'Data CRM mới của tôi' : 'Data CRM mới của team', totals.leads], ['Khách đã trả trong cohort', totals.convertedCustomers]];
  const scopeName = currentAccount.role === 'SALE' ? 'của tôi' : `Team ${currentAccount.teamId}`;
  return pageHead(canViewTraffic ? 'Nguồn & chiến dịch' : `Nguồn khách ${scopeName}`, canViewTraffic ? 'Sessions, chi phí, data, đơn và doanh thu nối theo last-touch attribution.' : `Hiển thị nguồn, landing page và doanh thu của khách trong phạm vi ${scopeName}; sessions và chi phí quảng cáo chỉ dành cho Admin.`) + dateFilter() +
    `<div class="kpi-grid" style="grid-template-columns:repeat(${canViewTraffic ? 6 : 3},minmax(140px,1fr))">${canViewTraffic ? kpiCard('⌁', 'Sessions', number(totals.sessions), 'Phiên có tracking') + kpiCard('↗', 'Form gửi', number(totals.trackedLeads), `${totals.sessions ? (totals.trackedLeads / totals.sessions * 100).toFixed(1) : 0}% / session`) : ''}${kpiCard('♙', 'Data CRM mới', number(totals.leads), canViewTraffic ? `${totals.trackedLeads ? (totals.leads / totals.trackedLeads * 100).toFixed(1) : 0}% form vào CRM` : scopeName)}${kpiCard('▤', 'Lượt thanh toán', number(totals.paidOrders), `${totals.leads ? (totals.convertedCustomers / totals.leads * 100).toFixed(1) : 0}% khách trong cohort`)}${kpiCard('₫', 'Doanh thu', money(totals.revenue, true), 'Last-touch')}${canViewTraffic ? kpiCard('x', 'ROAS tổng', totals.spend ? `${(totals.revenue / totals.spend).toFixed(2)}x` : 'Organic', `Chi ${money(totals.spend, true)}`) : ''}</div>
    <div class="grid grid-2"><section class="panel"><div class="panel-head"><div><div class="panel-title">${canViewTraffic ? 'Phân bổ traffic' : 'Phân bổ data'}</div><div class="panel-sub">Theo nguồn · ${escapeHtml(periodLabel())}</div></div></div><div class="panel-body">${trafficDonut(sources)}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Funnel chuyển đổi</div><div class="panel-sub">Tất cả tầng dùng đúng scope hiện tại</div></div></div><div class="panel-body"><div class="pipeline">${funnel.map(([label, value], index, values) => `<div class="pipeline-row"><span>${label}</span><div class="progress"><i style="width:${Number(values[0][1]) ? Number(value) / Number(values[0][1]) * 100 : 0}%"></i></div><b>${number(value)}</b></div>`).join('')}</div></div></section></div>
    <section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Hiệu suất nguồn / chiến dịch</div><div class="panel-sub">${canViewTraffic ? 'Tách form tracking khỏi data CRM · CAC = chi phí / lượt thanh toán' : 'Không hiển thị sessions, chi phí và ROAS ngoài quyền Admin'}</div></div>${currentAccount.role !== 'SALE' ? '<button class="button button-small" id="exportMarketingButton">Xuất CSV</button>' : ''}</div><div class="table-wrap"><table><thead><tr><th>Source / Campaign</th>${canViewTraffic ? '<th>Sessions</th><th>Form gửi</th><th>Form CVR</th>' : ''}<th>Data CRM</th>${canViewTraffic ? '<th>Vào CRM</th>' : ''}<th>Lượt thanh toán</th><th>Paid cohort</th><th>Doanh thu</th>${canViewTraffic ? '<th>Chi phí</th><th>CAC</th><th>ROAS</th>' : ''}</tr></thead><tbody>${sources.map(source => `<tr><td><div class="cell-main">${escapeHtml(source.source)}</div><div class="cell-sub">${escapeHtml(source.medium)} · ${escapeHtml(source.campaign)}</div></td>${canViewTraffic ? `<td>${number(source.sessions)}</td><td>${number(source.trackedLeads)}</td><td>${source.leadRate.toFixed(1)}%</td>` : ''}<td>${number(source.leads)}</td>${canViewTraffic ? `<td>${source.crmCaptureRate.toFixed(1)}%</td>` : ''}<td>${source.paidOrders}</td><td>${source.orderRate.toFixed(1)}%</td><td><b>${money(source.revenue)}</b></td>${canViewTraffic ? `<td>${money(source.spend)}</td><td>${source.paidOrders && source.spend ? money(source.spend / source.paidOrders) : '—'}</td><td>${source.roas ? `${source.roas.toFixed(2)}x` : 'Organic'}</td>` : ''}</tr>`).join('')}</tbody></table></div></section>`;
}

function salePerformanceRows() {
  const allowedIds = scopeSaleIds();
  return activeStaff().filter(person => person.role === 'SALE' && allowedIds.includes(person.id)).map(person => {
    const orders = state.orders.filter(order => order.saleId === person.id && order.teamId === person.teamId && order.leaderId === person.leaderId);
    const customers = state.customers.filter(customer => customer.saleId === person.id && customer.teamId === person.teamId && customer.leaderId === person.leaderId && inCurrentPeriod(customer.createdAt));
    const tasks = state.tasks.filter(task => task.ownerId === person.id && task.teamId === person.teamId && task.leaderId === person.leaderId);
    const revenue = netRevenue(orders, inCurrentPeriod);
    const payments = paidOrders(orders, inCurrentPeriod);
    const paid = payments.length;
    const periodCustomerIds = new Set(customers.map(customer => customer.id));
    const won = new Set(payments.filter(order => periodCustomerIds.has(order.customerId)).map(order => order.customerId)).size;
    return { ...person, customers: customers.length, paid, revenue, conversion: customers.length ? won / customers.length * 100 : 0, overdue: tasks.filter(task => task.status === 'OVERDUE').length };
  }).sort((a, b) => b.revenue - a.revenue);
}

function teamView() {
  if (currentAccount.role === 'SALE') return accessDeniedView('Sale không được xem bảng xếp hạng đội nhóm.');
  const rows = salePerformanceRows();
  const teamRevenue = netRevenue(scopedOrders(), inCurrentPeriod);
  const members = currentAccount.role === 'ADMIN' ? activeStaff() : activeStaff().filter(person => person.teamId === currentAccount.teamId && (person.id === currentAccount.leaderId || person.leaderId === currentAccount.leaderId));
  const actions = currentAccount.role === 'ADMIN' ? '<button class="button button-primary" id="newMemberButton">+ Thêm thành viên</button>' : '<button class="button" id="exportTeamButton">Xuất CSV</button>';
  const teamCards = Array.from(new Set(members.map(member => member.teamId))).sort().map(teamId => { const leaders = members.filter(member => member.teamId === teamId && member.role === 'LEADER'); return `<section class="panel team-overview-card"><div class="panel-head"><div><div class="panel-title">Team ${escapeHtml(teamId)}</div><div class="panel-sub">${leaders.length} Leader · ${members.filter(member => member.teamId === teamId && member.role === 'SALE').length} Sale</div></div></div><div class="panel-body">${leaders.map(leader => { const sales = members.filter(member => member.role === 'SALE' && member.leaderId === leader.id); return `<details class="team-leader"><summary><span class="avatar">${escapeHtml(leader.initials)}</span><span><b>${escapeHtml(leader.name)}</b><small>Leader · ${sales.length} Sale · ${state.customers.filter(customer => customer.leaderId === leader.id).length} khách</small></span></summary><div class="team-sales">${sales.map(sale => `<button class="team-sale-row" type="button" data-team-member="${escapeHtml(sale.id)}"><span><b>${escapeHtml(sale.name)}</b><small>${number(state.customers.filter(customer => customer.saleId === sale.id).length)} khách phụ trách</small></span><strong>${money(netRevenue(state.orders.filter(order => order.saleId === sale.id), inCurrentPeriod), true)}</strong></button>`).join('') || '<div class="cell-sub">Chưa có Sale trực thuộc.</div>'}</div></details>`; }).join('') || '<div class="empty compact"><b>Chưa có Leader</b></div>'}</div></section>`; }).join('');
  return pageHead(currentAccount.role === 'ADMIN' ? 'Đội ngũ & phân quyền' : `Nhân sự Team ${currentAccount.teamId}`, 'Thêm, xoá, chỉnh chức vụ và duyệt nhân sự từ danh sách đăng ký.', actions) + dateFilter() + `<div class="team-overview-grid">${teamCards}</div>` +
    `<div class="kpi-grid" style="grid-template-columns:repeat(4,minmax(150px,1fr))">${kpiCard('♧', 'Thành viên', number(members.length), currentAccount.role === 'ADMIN' ? 'Toàn hệ thống' : `Team ${currentAccount.teamId}`)}${kpiCard('₫', 'Doanh thu đội', money(teamRevenue, true), periodLabel())}${kpiCard('♙', 'Khách đang phụ trách', number(rows.reduce((sum, row) => sum + row.customers, 0)), 'Tổng theo Sale')}${kpiCard('!', 'Lịch quá hạn', number(rows.reduce((sum, row) => sum + row.overdue, 0)), 'Trong hồ sơ khách')}</div>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Danh sách nhân sự</div><div class="panel-sub">Chức vụ, tuyến quản lý và hiệu suất hiện tại</div></div>${currentAccount.role === 'ADMIN' ? '<button class="button button-small" id="exportTeamButton">Xuất CSV</button>' : ''}</div><div class="table-wrap"><table><thead><tr><th>Nhân sự</th><th>Chức vụ</th><th>Team</th><th>Quản lý trực tiếp</th><th>Khách hàng</th><th>Doanh thu kỳ</th>${currentAccount.role === 'ADMIN' ? '<th>Thao tác</th>' : ''}</tr></thead><tbody>${members.map(member => { const performance = rows.find(row => row.id === member.id); const directSales = member.role === 'LEADER' ? STAFF.filter(person => person.role === 'SALE' && person.leaderId === member.id).length : 0; return `<tr><td><div class="cell-main">${escapeHtml(member.name)}${['l1', 's1'].includes(member.id) ? ' <span class="account-link">Tài khoản hệ thống</span>' : ''}</div><div class="cell-sub">${escapeHtml(member.id)}</div></td><td><span class="status ${member.role === 'LEADER' ? 'status-info' : 'status-paid'}">${member.role}</span></td><td>${escapeHtml(member.teamId)}</td><td>${member.role === 'SALE' ? escapeHtml(staffName(member.leaderId)) : `${directSales} Sale trực thuộc`}</td><td>${member.role === 'SALE' ? number(performance?.customers || 0) : number(state.customers.filter(customer => customer.leaderId === member.id).length)}</td><td>${member.role === 'SALE' ? money(performance?.revenue || 0) : money(netRevenue(state.orders.filter(order => order.leaderId === member.id), inCurrentPeriod))}</td>${currentAccount.role === 'ADMIN' ? `<td><div class="panel-actions"><button class="button button-small" data-edit-member="${escapeHtml(member.id)}">Chỉnh sửa</button><button class="button button-small" data-reset-member-password="${escapeHtml(member.id)}">Mật khẩu</button><button class="button button-small button-danger" data-delete-member="${escapeHtml(member.id)}" ${['l1', 's1'].includes(member.id) ? 'disabled title="Tài khoản đăng nhập đang liên kết"' : ''}>Xoá</button></div></td>` : ''}</tr>`; }).join('')}</tbody></table></div></section>
    ${currentAccount.role === 'ADMIN' ? `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Dữ liệu đăng ký chờ duyệt</div><div class="panel-sub">Duyệt hồ sơ rồi mới gán chức vụ và đưa vào đội ngũ</div></div><span class="nav-badge registration-badge">${state.registrations.filter(item => item.status === 'PENDING').length}</span></div><div class="table-wrap"><table><thead><tr><th>Ứng viên</th><th>Liên hệ</th><th>IP đăng ký</th><th>Phân quyền</th><th>Ngày đăng ký</th><th></th></tr></thead><tbody>${state.registrations.filter(item => item.status === 'PENDING').map(item => `<tr><td><b>${escapeHtml(item.name)}</b></td><td><div>${escapeHtml(item.phone)}</div><div class="cell-sub">${escapeHtml(item.email)}</div></td><td class="mono">${escapeHtml(item.ipAddress || 'Chưa xác định')}</td><td><span class="status status-pending">Chờ Admin gán</span></td><td class="mono">${escapeHtml(item.registeredAt)}</td><td><button class="button button-primary button-small" data-promote-registration="${escapeHtml(item.id)}">Duyệt & gán role</button></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty compact"><b>Không còn đăng ký chờ duyệt</b><span>Tất cả hồ sơ đã được xử lý.</span></div></td></tr>'}</tbody></table></div></section>` : ''}`;
}

function memberInitials(name) {
  return String(name || 'NV').trim().split(/\s+/).slice(-2).map(part => part[0] || '').join('').toUpperCase().slice(0, 3) || 'NV';
}

function teamMemberModal(id = null, registrationId = null) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quản lý nhân sự'); return; }
  const registration = state.registrations.find(item => item.id === registrationId);
  const member = STAFF.find(person => person.id === id);
  const source = member || registration || { name: '', requestedRole: 'SALE', teamId: 'T2' };
  const role = member?.role || source.requestedRole || 'SALE';
  const leaders = activeStaff().filter(person => person.role === 'LEADER' && person.id !== id);
  openModal(member ? 'Chỉnh sửa thành viên' : 'Thêm thành viên', `<form id="teamMemberForm"><div class="form-grid"><label class="form-field full">Họ tên<input id="memberName" required maxlength="160" value="${escapeHtml(source.name)}"></label><label class="form-field">Chức vụ<select id="memberRole"><option value="SALE" ${role === 'SALE' ? 'selected' : ''}>SALE</option><option value="LEADER" ${role === 'LEADER' ? 'selected' : ''}>LEADER</option></select></label><label class="form-field">Team<input id="memberTeam" required maxlength="20" value="${escapeHtml(source.teamId || 'T2')}"></label><label class="form-field">Leader trực tiếp<select id="memberLeader"><option value="">Không áp dụng</option>${leaders.map(leader => `<option value="${escapeHtml(leader.id)}" ${(member?.leaderId || '') === leader.id ? 'selected' : ''}>${escapeHtml(leader.name)} · ${escapeHtml(leader.teamId)}</option>`).join('')}</select></label></div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Lưu thành viên</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#teamMemberForm').onsubmit = event => { event.preventDefault(); saveTeamMember(id, registrationId); };
}

function resetMemberPasswordModal(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được khôi phục mật khẩu'); return; }
  const member = STAFF.find(person => person.id === id);
  const account = member?.id === 'l1' ? ACCOUNTS.find(item => item.id === 'u-leader-1') : member?.id === 's1' ? ACCOUNTS.find(item => item.id === 'u-sale-1') : null;
  if (!account) { toast('Nhân sự này chưa liên kết tài khoản đăng nhập'); return; }
  openModal('Đặt lại mật khẩu', `<form id="resetMemberPasswordForm"><p class="panel-sub">${escapeHtml(member.name)} · mật khẩu mới sẽ không hiển thị lại sau khi lưu.</p><label class="form-field">Mật khẩu mới<input id="resetMemberPassword" type="password" minlength="8" required autocomplete="new-password"></label><label class="form-field" style="margin-top:12px">Nhập lại mật khẩu<input id="resetMemberPasswordConfirm" type="password" minlength="8" required autocomplete="new-password"></label><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Lưu mật khẩu</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#resetMemberPasswordForm').onsubmit = event => { event.preventDefault(); const next = $('#resetMemberPassword').value, confirm = $('#resetMemberPasswordConfirm').value; if (next.length < 8 || next !== confirm) { toast('Mật khẩu tối thiểu 8 ký tự và phải trùng nhau'); return; } account.password = next; audit('RESET_MEMBER_PASSWORD', member.id, member.name); saveState(); closeModal(); toast(`Đã cập nhật mật khẩu cho ${member.name}`); };
}

function saveTeamMember(id = null, registrationId = null) {
  if (currentAccount.role !== 'ADMIN') return;
  const existing = STAFF.find(person => person.id === id), name = $('#memberName').value.trim(), role = $('#memberRole').value, teamId = $('#memberTeam').value.trim().toUpperCase(), leaderId = $('#memberLeader').value || null;
  if (!name || !['LEADER', 'SALE'].includes(role) || !/^[A-Z0-9_-]{1,20}$/.test(teamId)) { toast('Thông tin nhân sự không hợp lệ'); return; }
  if (existing && ['l1', 's1'].includes(existing.id) && (name !== existing.name || role !== existing.role || teamId !== existing.teamId || (existing.role === 'SALE' && leaderId !== existing.leaderId))) { toast('Không thể đổi tên, chức vụ hoặc tuyến quản lý của tài khoản đăng nhập đang liên kết'); return; }
  if (existing?.role === 'LEADER' && role === 'SALE' && STAFF.some(person => person.role === 'SALE' && person.leaderId === existing.id)) { toast('Hãy chuyển các Sale trực thuộc sang Leader khác trước khi đổi chức vụ'); return; }
  const leader = role === 'SALE' ? STAFF.find(person => person.id === leaderId && person.role === 'LEADER' && person.active !== false) : null;
  if (role === 'SALE' && (!leader || leader.teamId !== teamId)) { toast('Sale phải thuộc đúng Team của Leader trực tiếp'); return; }
  if (existing) {
    const previous = { ...existing };
    if (previous.role === 'SALE' && role !== 'SALE') {
      state.customers.filter(customer => customer.saleId === previous.id).forEach(customer => { const before = assignmentSnapshot(customer); closeOpenCustomerTasks(customer, 'ROLE_CHANGED'); customer.saleId = null; customer.leaderId = existing.id; customer.teamId = teamId; recordAssignmentChange(customer, before, `${name} đổi chức vụ Sale -> Leader`, 'SYSTEM'); });
    } else if (previous.role === 'LEADER' && role === 'SALE') {
      state.customers.filter(customer => customer.leaderId === previous.id && !customer.saleId).forEach(customer => { const before = assignmentSnapshot(customer); customer.saleId = existing.id; customer.leaderId = leader.id; customer.teamId = teamId; createInitialTask(customer); recordAssignmentChange(customer, before, `${name} đổi chức vụ Leader -> Sale`, 'SYSTEM'); });
    } else if (previous.role === 'SALE') {
      state.customers.filter(customer => customer.saleId === previous.id).forEach(customer => { const before = assignmentSnapshot(customer); customer.leaderId = leader.id; customer.teamId = teamId; recordAssignmentChange(customer, before, `${name} chuyển tuyến quản lý`, 'SYSTEM'); });
      state.tasks.filter(task => task.ownerId === previous.id && task.status !== 'DONE').forEach(task => { task.leaderId = leader.id; task.teamId = teamId; });
    }
    if (previous.role === 'LEADER' && role === 'LEADER' && previous.teamId !== teamId) {
      STAFF.filter(person => person.role === 'SALE' && person.leaderId === previous.id).forEach(sale => { sale.teamId = teamId; state.customers.filter(customer => customer.saleId === sale.id).forEach(customer => { const before = assignmentSnapshot(customer); customer.teamId = teamId; recordAssignmentChange(customer, before, `Team của Leader ${name} thay đổi`, 'SYSTEM'); }); state.tasks.filter(task => task.ownerId === sale.id && task.status !== 'DONE').forEach(task => { task.teamId = teamId; }); });
      state.customers.filter(customer => customer.leaderId === previous.id).forEach(customer => { const before = assignmentSnapshot(customer); customer.teamId = teamId; recordAssignmentChange(customer, before, `Team của Leader ${name} thay đổi`, 'SYSTEM'); });
    }
    Object.assign(existing, { name, role, teamId, leaderId: role === 'SALE' ? leader.id : null, initials: memberInitials(name), active: true });
  } else {
    const memberId = `${role === 'LEADER' ? 'l' : 's'}-${Date.now()}`;
    state.members.push({ id: memberId, name, role, teamId, leaderId: role === 'SALE' ? leader.id : null, initials: memberInitials(name), createdBy: currentAccount.name, active: true });
  }
  const registration = state.registrations.find(item => item.id === registrationId);
  if (registration) registration.status = 'APPROVED';
  STAFF = state.members.filter(person => person.active !== false);
  audit(existing ? 'UPDATE_MEMBER' : 'CREATE_MEMBER', existing?.id || name, `${name} · ${role} · ${teamId}`);
  saveState(); closeModal(); render(); toast(existing ? 'Đã cập nhật thành viên' : 'Đã thêm thành viên vào đội ngũ');
}

function deleteTeamMember(id) {
  if (currentAccount.role !== 'ADMIN' || ['l1', 's1'].includes(id)) { toast('Không thể xoá tài khoản đăng nhập đang liên kết'); return; }
  const member = STAFF.find(person => person.id === id);
  if (!member) return;
  if (member.role === 'LEADER' && STAFF.some(person => person.role === 'SALE' && person.leaderId === member.id)) { toast('Hãy chuyển các Sale sang Leader khác trước khi xoá'); return; }
  if (!window.confirm(`Xoá ${member.name} khỏi đội ngũ?`)) return;
  state.customers.filter(customer => customer.saleId === member.id || customer.leaderId === member.id).forEach(customer => {
    const previous = assignmentSnapshot(customer);
    closeOpenCustomerTasks(customer, 'MEMBER_REMOVED');
    if (member.role === 'SALE') customer.saleId = null;
    else { customer.saleId = null; customer.leaderId = null; customer.teamId = null; }
    customer.updatedAt = stamp();
    customer.note = `${member.name} đã rời đội ngũ; khách được thu hồi về Khách mới`;
    state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount.id, author: currentAccount.name, role: currentAccount.role, text: customer.note, at: stamp() });
    recordAssignmentChange(customer, previous, customer.note, 'SYSTEM');
  });
  member.active = false;
  STAFF = state.members.filter(person => person.active !== false);
  audit('DELETE_MEMBER', id, `${member.name} · ${member.role}`);
  saveState(); render(); toast('Đã xoá thành viên khỏi đội ngũ và thu hồi khách liên quan');
}

function reportsView() {
  const current = periodSnapshot(), products = productPerformance(scopedOrders()).filter(product => product.paidOrders || product.refunds), sources = sourcePerformance(), sales = salePerformanceRows();
  const periodTasks = scopedTasks().filter(task => inCurrentPeriod(task.dueAt));
  return pageHead('Báo cáo tổng hợp', 'Một bộ lọc dùng xuyên suốt doanh thu, sản phẩm, nguồn và nhân sự.', currentAccount.role !== 'SALE' ? `<button class="button button-primary" id="exportReportButton">Xuất báo cáo CSV</button>` : '') + dateFilter() +
    `<div class="grid grid-3"><article class="info-card"><div class="info-card-top"><h3>Kinh doanh</h3><span class="scope-chip" style="color:var(--ink);background:var(--panel-2)">${dateRange}D</span></div><p>Doanh thu và chất lượng đơn</p><div class="stat-row"><div><small>Doanh thu</small><b>${money(current.revenue, true)}</b></div><div><small>Đơn PAID</small><b>${current.paid.length}</b></div><div><small>AOV</small><b>${money(current.aov, true)}</b></div></div></article>
    <article class="info-card"><div class="info-card-top"><h3>Acquisition</h3><span class="scope-chip" style="color:var(--ink);background:var(--panel-2)">${currentAccount.scope}</span></div><p>${currentAccount.role === 'ADMIN' ? 'Traffic và chuyển đổi data' : 'Data và chuyển đổi trong phạm vi'}</p><div class="stat-row"><div><small>${currentAccount.role === 'ADMIN' ? 'Sessions' : 'Phạm vi'}</small><b>${currentAccount.role === 'ADMIN' ? number(current.sessions) : currentAccount.scope}</b></div><div><small>Data</small><b>${number(current.leads)}</b></div><div><small>Paid / data</small><b>${current.conversion.toFixed(1)}%</b></div></div></article>
    <article class="info-card"><div class="info-card-top"><h3>Vận hành</h3><span class="scope-chip" style="color:var(--ink);background:var(--panel-2)">${dateRange}D</span></div><p>Lịch chăm sóc nằm trong từng hồ sơ khách</p><div class="stat-row"><div><small>Khách mới</small><b>${current.customers.length}</b></div><div><small>Lịch đến hạn</small><b>${periodTasks.length}</b></div><div><small>Quá hạn</small><b>${periodTasks.filter(task => task.status === 'OVERDUE').length}</b></div></div></article></div>
    <div class="grid grid-2" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><div class="panel-title">Top sản phẩm</div><div class="panel-sub">Theo doanh thu trong kỳ</div></div></div><div class="panel-body">${products.slice(0, 5).map((product, index) => `<div class="rank-row"><span class="rank">#${index + 1}</span><div><b>${escapeHtml(product.name)}</b><small>${product.units} sản phẩm · ${product.paidOrders} lượt thanh toán</small></div><div class="rank-value"><b>${money(product.revenue, true)}</b></div></div>`).join('') || '<div class="empty"><b>Chưa có sản phẩm bán ra</b><span>Không phát sinh thanh toán trong kỳ.</span></div>'}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Top nguồn doanh thu</div><div class="panel-sub">Last-touch attribution</div></div></div><div class="panel-body">${sources.filter(source => source.paidOrders || source.revenue !== 0).slice(0, 5).map((source, index) => `<div class="rank-row"><span class="rank">#${index + 1}</span><div><b>${escapeHtml(source.source)}</b><small>${source.leads} data CRM · ${source.paidOrders} lượt thanh toán</small></div><div class="rank-value"><b>${money(source.revenue, true)}</b></div></div>`).join('') || '<div class="empty"><b>Chưa có doanh thu theo nguồn</b><span>Không phát sinh thanh toán hoặc hoàn tiền trong kỳ.</span></div>'}</div></section></div>
     ${currentAccount.role !== 'SALE' ? `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Đóng góp theo Sale</div><div class="panel-sub">Chỉ hiển thị nhân sự trong phạm vi hiện tại</div></div></div><div class="panel-body">${sales.map(row => `<div class="rank-row"><span class="rank">${row.initials}</span><div><b>${escapeHtml(row.name)}</b><small>${row.customers} khách · ${row.paid} đơn · ${row.conversion.toFixed(1)}% chuyển đổi</small></div><div class="rank-value"><b>${money(row.revenue, true)}</b></div></div>`).join('')}</div></section>` : ''}`;
}

function websitesView() {
  if (currentAccount.role !== 'ADMIN') return accessDeniedView('Chỉ Admin được quản lý website và landing page.');
  const newData = state.customers.filter(customer => !customer.saleId && !customer.leaderId && !customer.teamId).length;
  const statusLabel = { UNCONFIGURED: ['Chưa cấu hình', 'pending'], PENDING_BACKEND: ['Chờ backend', 'info'], VERIFIED: ['Đã xác minh', 'paid'], ERROR: ['Lỗi kết nối', 'cancelled'] };
  return pageHead('Websites & Landing Pages', 'Cấu hình nguồn nhận data từ landing page, Facebook/TikTok Forms hoặc webhook; mọi khóa phải được backend lưu trong kho secret.', `<button class="button button-primary" id="newWebsiteButton">+ Thêm website</button>`) + dateFilter() +
    `<section class="panel" style="margin-bottom:14px"><div class="panel-body"><div class="stat-row"><div><small>Khách hàng tổng</small><b>${number(state.customers.length)}</b></div><div><small>Khách mới</small><b>${number(newData)}</b></div><div><small>Đã phân phụ trách</small><b>${number(state.customers.length - newData)}</b></div></div></div></section>` + webhookTransportMarkup() +
    `<div class="card-list">${state.websites.map(website => { const customers = websiteCustomerRows(website.id); const periodRow = websiteRevenuePerformance().find(row => row.id === website.id) || { data: 0, paidOrders: 0, net: 0 }; const fresh = customers.filter(customer => !customer.saleId && !customer.leaderId && !customer.teamId).length; const connection = statusLabel[website.connectionStatus] || statusLabel.UNCONFIGURED; const provider = { LANDING_API: 'Landing API', FACEBOOK_FORMS: 'Facebook Forms', TIKTOK_FORMS: 'TikTok Forms', CUSTOM_WEBHOOK: 'Custom Webhook' }[website.provider] || website.provider; return `<article class="info-card integration-card"><div class="info-card-top"><div><h3>${escapeHtml(website.name)}</h3><div class="cell-sub">${escapeHtml(website.domain)} · ${escapeHtml(provider)}</div></div><div><span class="status status-${connection[1]}">${connection[0]}</span> ${website.status === 'ACTIVE' ? '<span class="status status-active">Đang nhận data</span>' : '<span class="status status-pending">Tắt nhận data</span>'}</div></div><p>${fresh} khách mới · ${customers.length - fresh} đã phân · ${periodRow.data} data trong kỳ</p><div class="stat-row"><div><small>Data tổng</small><b>${number(customers.length)}</b></div><div><small>Thanh toán kỳ</small><b>${number(periodRow.paidOrders)}</b></div><div><small>Doanh thu kỳ</small><b>${money(periodRow.net, true)}</b></div></div><div class="connection-meta"><span>Campaign: <b>${escapeHtml(website.campaignId || 'Chưa ánh xạ')}</b></span><span>Form: <b>${escapeHtml(website.formId || 'Chưa ánh xạ')}</b></span><span>Credential: <b>${website.credentialConfigured ? `••••${escapeHtml(website.credentialLast4)}` : 'Chưa có'}</b></span></div><div class="connection-actions"><button class="button button-small button-primary" data-configure-website="${escapeHtml(website.id)}">Cấu hình API</button><button class="button button-small" data-test-website="${escapeHtml(website.id)}">Kiểm tra kết nối</button><button class="button button-small" data-toggle-website="${escapeHtml(website.id)}">${website.status === 'ACTIVE' ? 'Tắt nhận data' : 'Bật nhận data'}</button></div>${webhookPanelMarkup(website)}</article>`; }).join('')}</div>`;
}

function integrationsView() {
  // Tạm ẩn toàn bộ mục Tích hợp để nâng cấp; dữ liệu state.integrations vẫn giữ nguyên.
  return accessDeniedView('Mục Tích hợp đang tạm ẩn để nâng cấp; dữ liệu kết nối cũ vẫn được giữ nguyên.');
  if (currentAccount.role !== 'ADMIN') return accessDeniedView('Chỉ Admin được vận hành các kết nối hệ thống.');
  const statusLabel = { UNCONFIGURED: ['Chưa cấu hình', 'pending'], PENDING_BACKEND: ['Chờ backend', 'info'], VERIFIED: ['Đã xác minh', 'paid'], ERROR: ['Lỗi', 'cancelled'], PAUSED: ['Tạm dừng', 'pending'] };
  const activeItems = state.integrations.filter(item => !item.archived);
  return pageHead('Tích hợp API', 'Kết nối Subdata, REMOVED_PAYMENT và nguồn form. Trình duyệt không giữ khóa bí mật và không tự nhận kết nối thành công.', `<button class="button button-primary" id="newIntegrationButton">+ Thêm kết nối</button>`) +
    `<section class="panel" style="margin-bottom:14px"><div class="panel-body"><div class="credential-hint"><b>Nguyên tắc vận hành:</b> secret được gửi một lần tới backend vault; webhook phải xác minh chữ ký, chống gửi trùng và ghi audit trước khi cập nhật data hoặc doanh thu. Hiện workspace chưa có backend nên kiểm tra kết nối chỉ chuyển sang trạng thái chờ.</div></div></section>` +
    `<div class="card-list">${activeItems.map(item => { const status = statusLabel[item.status] || statusLabel.UNCONFIGURED; const providerCopy = { SUBDATA: 'Đồng bộ khách theo cursor/upsert', REMOVED_PAYMENT: 'Webhook thanh toán & đối soát', FACEBOOK: 'Facebook Ads/Form webhook', CUSTOM: 'Connector tùy chỉnh' }[item.provider]; const webhookPath = item.provider === 'REMOVED_PAYMENT' ? `/api/v1/webhooks/in/REMOVED_PAYMENT/${item.id}` : item.provider === 'FACEBOOK' ? `/api/v1/webhooks/in/meta/${item.id}` : ''; return `<article class="info-card integration-card"><div class="info-card-top"><div><h3>${escapeHtml(item.name)}</h3><div class="cell-sub">${escapeHtml(item.provider)} · ${escapeHtml(item.type)}</div></div><span class="status status-${status[1]}">${status[0]}</span></div><p>${escapeHtml(providerCopy || 'Kết nối API doanh nghiệp')}</p><div class="connection-meta"><span>Endpoint: <b>${escapeHtml(item.endpoint || 'Chưa nhập')}</b></span><span>Workspace / Account: <b>${escapeHtml(item.externalAccountId || 'Chưa ánh xạ')}</b></span><span>Credential: <b>${item.credentialConfigured ? `••••${escapeHtml(item.credentialLast4)}` : 'Chưa có'}</b></span><span>Xác minh cuối: <b>${escapeHtml(item.lastVerifiedAt || 'Chưa xác minh')}</b></span></div><div class="connection-actions"><button class="button button-small button-primary" data-configure-integration="${escapeHtml(item.id)}">Cấu hình</button><button class="button button-small" data-test-integration="${escapeHtml(item.id)}">Kiểm tra</button><button class="button button-small" data-pause-integration="${escapeHtml(item.id)}">${item.status === 'PAUSED' ? 'Yêu cầu bật lại' : 'Tạm dừng'}</button><button class="button button-small button-danger" data-archive-integration="${escapeHtml(item.id)}">Lưu trữ</button></div><div class="credential-hint">${webhookPath ? `Webhook CRM: <span class="mono">${escapeHtml(webhookPath)}</span><br>` : ''}${escapeHtml(item.lastError || 'Chưa có kết quả xác minh từ backend.')}</div></article>`; }).join('') || '<div class="empty"><b>Chưa có kết nối hoạt động</b><span>Thêm Subdata, REMOVED_PAYMENT, Facebook hoặc connector tùy chỉnh.</span></div>'}</div>${state.integrations.some(item => item.archived) ? `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Kết nối đã lưu trữ</div><div class="panel-sub">Không tham gia đồng bộ; có thể khôi phục cấu hình</div></div></div><div class="panel-body">${state.integrations.filter(item => item.archived).map(item => `<div class="rank-row"><span class="rank">${escapeHtml(item.provider.slice(0, 2))}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.endpoint || 'Chưa có endpoint')}</small></div><button class="button button-small" data-restore-integration="${escapeHtml(item.id)}">Khôi phục</button></div>`).join('')}</div></section>` : ''}`;
}

function visibleNotifications() {
  return state.notifications.filter(item => currentAccount.role === 'ADMIN' || item.role === 'ALL');
}

function notificationsView() {
  const items = visibleNotifications();
  const action = currentAccount.role === 'ADMIN' ? '<button class="button button-primary" id="newAnnouncementButton">Tạo thông báo</button>' : '<button class="button" id="readAllButton">Đánh dấu đã đọc</button>';
  return pageHead('Thông báo', currentAccount.role === 'ADMIN' ? 'Admin tạo và quản lý thông báo chung cho toàn bộ đội ngũ.' : 'Thông báo chung từ Admin.', action) +
    `<section class="panel"><div class="alert-list">${items.map(item => { const read = item.readBy.includes(currentAccount.id); return `<button class="alert-row" data-read-notification="${escapeHtml(item.id)}" style="text-align:left;opacity:${read ? '.65' : '1'}"><span class="alert-icon">${read ? '✓' : '●'}</span><span><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.text)}</p><div class="cell-sub">${escapeHtml(item.at)}</div></span><strong>${read ? 'Đã đọc' : 'Mới'}</strong></button>`; }).join('') || `<div class="empty"><b>Không có thông báo</b><span>Tài khoản của bạn chưa có thông báo mới.</span></div>`}</div></section>`;
}

function newAnnouncementModal() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được tạo thông báo'); return; }
  openModal('Tạo thông báo', `<form id="announcementForm"><div class="form-grid"><label class="form-field full">Tiêu đề<input id="announcementTitle" required maxlength="200"></label><label class="form-field full">Nội dung<textarea id="announcementText" required rows="5" maxlength="1000"></textarea></label></div><div class="modal-actions"><button class="button" type="button" data-close-modal>Hủy</button><button class="button button-primary" type="submit">Gửi thông báo</button></div></form>`);
  $('#announcementForm').onsubmit = event => {
    event.preventDefault();
    const title = cleanText($('#announcementTitle').value.trim(), '', 200);
    const text = cleanText($('#announcementText').value.trim(), '', 1000);
    if (!title || !text) { toast('Nhập đủ tiêu đề và nội dung'); return; }
    state.notifications.unshift({ id: `NT-${Date.now()}`, role: 'ALL', title, text, at: stamp(), readBy: [] });
    audit('CREATE_ANNOUNCEMENT', 'NOTIFICATIONS', title);
    saveState(); closeModal(); render(); toast('Đã gửi thông báo tới Leader và Sale');
  };
}

function auditView() {
  if (currentAccount.role !== 'ADMIN') return accessDeniedView('User log chỉ dành cho Admin.');
  return pageHead('User log', 'Theo dõi ai đã thực hiện thao tác nào và từ địa chỉ IP nào.') +
    `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Vai trò</th><th>IP</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${state.audit.map(item => `<tr><td class="mono">${escapeHtml(item.at)}</td><td>${escapeHtml(item.actor)}</td><td><span class="scope-chip" style="color:var(--ink);background:var(--panel-2)">${escapeHtml(item.role)}</span></td><td class="mono">${escapeHtml(item.ip || '127.0.0.1')}</td><td><b>${escapeHtml(item.action)}</b></td><td class="mono">${escapeHtml(item.entity)}</td><td>${escapeHtml(item.detail)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function accountingView() {
  if (currentAccount.role !== 'ADMIN') return accessDeniedView('Đối soát thanh toán chỉ dành cho Admin.');
  const transactions = financialEvents(state.orders, inCurrentPeriod).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const unmatched = transactions.filter(event => !event.reconciled).length;
  const collected = transactions.reduce((sum, event) => sum + event.amount, 0);
  const REMOVED_PAYMENT = state.integrations.find(item => item.provider === 'REMOVED_PAYMENT' && !item.archived);
  return pageHead('Đối soát thanh toán', 'REMOVED_PAYMENT phải gửi webhook đã xác minh vào backend; CRM đối chiếu mã đơn, số tiền và mã giao dịch theo cơ chế idempotency.', `<button class="button button-primary" id="reconcileAllButton">${REMOVED_PAYMENT?.status === 'VERIFIED' ? `Yêu cầu đối soát ${unmatched} giao dịch` : 'Cấu hình REMOVED_PAYMENT'}</button>`) + dateFilter() +
    `<div class="kpi-grid" style="grid-template-columns:repeat(3,minmax(150px,1fr))">${kpiCard('✓', 'Đã khớp', number(transactions.length - unmatched), 'Giao dịch')}${kpiCard('!', 'Chưa khớp', number(unmatched), 'Cần kiểm tra')}${kpiCard('₫', 'Thu ròng', money(collected, true), 'Đã trừ các dòng hoàn tiền')}</div>
    <section class="panel">${transactionsTable(transactions, true)}</section>`;
}

function applyAppearanceSettings() {
  const base = state.settings.customAccent || '#e8572a';
  const palette = [base, base, `${base}18`];
  document.documentElement.style.setProperty('--accent', palette[0]);
  document.documentElement.style.setProperty('--accent-dark', palette[1]);
  document.documentElement.style.setProperty('--accent-soft', palette[2]);
  const fonts = Object.fromEntries([['arial','Arial'],['arialBlack','Arial Black'],['bahnschrift','Bahnschrift'],['calibri','Calibri'],['cambria','Cambria'],['candara','Candara'],['century','Century Gothic'],['comic','Comic Sans MS'],['consolas','Consolas'],['constantia','Constantia'],['corbel','Corbel'],['courier','Courier New'],['franklin','Franklin Gothic Medium'],['georgia','Georgia'],['impact','Impact'],['segoe','Segoe UI'],['tahoma','Tahoma'],['times','Times New Roman'],['trebuchet','Trebuchet MS'],['verdana','Verdana'],['beVietnam','Be Vietnam Pro'],['inter','Inter'],['roboto','Roboto'],['openSans','Open Sans'],['montserrat','Montserrat'],['poppins','Poppins'],['lato','Lato'],['nunito','Nunito'],['raleway','Raleway'],['oswald','Oswald'],['ubuntu','Ubuntu'],['rubik','Rubik'],['manrope','Manrope'],['dmSans','DM Sans'],['workSans','Work Sans'],['quicksand','Quicksand'],['notoSans','Noto Sans'],['notoSerif','Noto Serif'],['plex','IBM Plex Sans'],['merriweather','Merriweather'],['playfair','Playfair Display'],['sourceSans','Source Sans 3'],['fira','Fira Sans'],['firaCode','Fira Code']].map(([k,v]) => [k, `${v}, sans-serif`]));
  document.documentElement.style.setProperty('--sans', fonts[state.settings.fontFamily || 'aptos'] || 'Aptos, sans-serif');
  document.documentElement.style.setProperty('--base-font-size', `${state.settings.fontSize || 14}px`);
  document.documentElement.style.setProperty('--base-font-weight', state.settings.fontBold ? '700' : '400');
  document.documentElement.style.setProperty('--base-font-style', state.settings.fontItalic ? 'italic' : 'normal');
}

function settingsView() {
  if (currentAccount.role !== 'ADMIN') return accessDeniedView('Chỉ Admin được thay đổi cài đặt hệ thống.');
  const settings = state.settings;
  const option = (value, label, selected) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;
  const fontOptions = [['arial','Arial'],['arialBlack','Arial Black'],['bahnschrift','Bahnschrift'],['calibri','Calibri'],['cambria','Cambria'],['candara','Candara'],['century','Century Gothic'],['comic','Comic Sans MS'],['consolas','Consolas'],['constantia','Constantia'],['corbel','Corbel'],['courier','Courier New'],['franklin','Franklin Gothic Medium'],['georgia','Georgia'],['impact','Impact'],['segoe','Segoe UI'],['tahoma','Tahoma'],['times','Times New Roman'],['trebuchet','Trebuchet MS'],['verdana','Verdana'],['beVietnam','Be Vietnam Pro'],['inter','Inter'],['roboto','Roboto'],['openSans','Open Sans'],['montserrat','Montserrat'],['poppins','Poppins'],['lato','Lato'],['nunito','Nunito'],['raleway','Raleway'],['oswald','Oswald'],['ubuntu','Ubuntu'],['rubik','Rubik'],['manrope','Manrope'],['dmSans','DM Sans'],['workSans','Work Sans'],['quicksand','Quicksand'],['notoSans','Noto Sans'],['notoSerif','Noto Serif'],['plex','IBM Plex Sans'],['merriweather','Merriweather'],['playfair','Playfair Display'],['sourceSans','Source Sans 3'],['fira','Fira Sans'],['firaCode','Fira Code']];
  const colorOptions = ['#e8572a','#157a4b','#246b9b','#7c3aed','#c026d3','#db2777','#dc2626','#ea580c','#ca8a04','#65a30d','#0891b2','#0f172a','#475569','#000000','#ffffff'];
  const accountEvents = state.audit.filter(item => ['CREATE_MEMBER', 'APPROVE_REGISTRATION'].includes(item.action)).slice(0, 10);
  const dataEvents = state.imports.slice(0, 10);
  return pageHead('Cài đặt CRM', '') +
     `<section class="panel"><div class="panel-head"><div class="panel-title">Giao diện & Telegram</div></div><div class="panel-body"><div class="form-grid"><label class="form-field">Màu chủ đạo<select id="themeColorSelect">${colorOptions.map(color => `<option value="${color}" ${(settings.customAccent || '#e8572a') === color ? 'selected' : ''}>${color}</option>`).join('')}</select><input id="customAccentColor" type="color" value="${settings.customAccent || '#e8572a'}" style="height:38px;padding:3px;margin-top:6px"></label><label class="form-field">Font chữ<select id="fontFamilySelect">${fontOptions.map(([value,label]) => option(value,label,settings.fontFamily || 'aptos')).join('')}</select></label><label class="form-field">Bot báo data · Token<input id="dataBotToken" type="password" value="${escapeHtml(settings.dataBotToken || '')}" placeholder="123456:ABC..."></label><label class="form-field">Bot báo data · Chat ID<input id="dataBotChatId" value="${escapeHtml(settings.dataBotChatId || '')}" placeholder="-100xxxxxxxxxx"></label><label class="form-field">Bot báo thành viên · Token<input id="memberBotToken" type="password" value="${escapeHtml(settings.memberBotToken || '')}" placeholder="123456:ABC..."></label><label class="form-field">Bot báo thành viên · Chat ID<input id="memberBotChatId" value="${escapeHtml(settings.memberBotChatId || '')}" placeholder="-100xxxxxxxxxx"></label></div><div class="credential-hint" style="margin-top:12px">Bot báo data nhận sự kiện data mới; bot báo thành viên nhận sự kiện tạo tài khoản.</div><button class="button button-primary" id="saveAppearanceButton" style="margin-top:14px">Lưu cấu hình</button></div></section><div class="grid grid-2" style="margin-top:14px"><section class="panel"><div class="panel-head"><div class="panel-title">Tài khoản mới</div></div><div class="panel-body">${accountEvents.map(item => `<div class="rank-row"><div><b>${escapeHtml(item.actor)}</b><small>${escapeHtml(item.detail)} · ${escapeHtml(item.at)}</small></div></div>`).join('') || '<div class="empty"><b>Chưa có tài khoản mới</b></div>'}</div></section><section class="panel"><div class="panel-head"><div class="panel-title">Data mới về</div></div><div class="panel-body">${dataEvents.map(item => `<div class="rank-row"><div><b>${escapeHtml(item.source)}</b><small>${escapeHtml(item.filename)} · ${number(item.records)} data · ${escapeHtml(item.importedAt)}</small></div></div>`).join('') || '<div class="empty"><b>Chưa có lượt nhập data</b></div>'}</div></section></div>`;
}

function timeToMinutes(time) {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function attendanceWifiIps() {
  return String(state.settings.attendanceIp || '').split(',').map(item => item.trim()).filter(Boolean);
}

function attendanceIsWifiIp(ip) {
  const list = attendanceWifiIps();
  return !list.length || list.includes(ip);
}

/* Lịch điểm danh 3 tháng cho Sale: mỗi tháng một lưới 7 cột (T2…CN),
   ô màu theo trạng thái (đúng giờ / muộn / nghỉ), cuối tháng có tổng kết. */
function attendanceCalendarHtml(accountId) {
  const today = dayIso(0);
  const [ty, tm] = today.split('-').map(Number);
  const dowLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const monthLabels = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const recordsByDate = {};
  state.attendance.filter(item => item.accountId === accountId).forEach(item => { recordsByDate[item.date] = item; });

  let html = '<div class="att-calendar">';
  for (let m = 0; m < 3; m++) {
    const monthIdx = tm - 1 - m;
    const year = monthIdx < 0 ? ty - 1 + Math.floor((monthIdx + 12) / 12) : ty;
    const realMonth = ((monthIdx % 12) + 12) % 12;
    const monthNum = realMonth + 1;
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const firstDow = new Date(Date.UTC(year, realMonth, 1)).getUTCDay();
    const offset = (firstDow + 6) % 7;
    const isCurrentMonth = (year === ty && monthNum === tm);
    const lastDay = isCurrentMonth ? Number(today.split('-')[2]) : daysInMonth;

    let onTime = 0, late = 0, off = 0, total = 0;
    let cells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = recordsByDate[dateStr];
      const isWeekend = ((offset + d - 1) % 7) >= 5;
      const isFuture = d > lastDay;
      let cls = 'att-day';
      let statusHtml = '';
      let timeHtml = '';
      if (isFuture) {
        cls += ' is-future';
      } else if (rec) {
        total++;
        if (rec.late) { late++; cls += ' is-late'; statusHtml = `<span class="att-day-status">Muộn ${rec.lateMinutes || 0}p</span>`; }
        else { onTime++; cls += ' is-ontime'; statusHtml = '<span class="att-day-status">Đúng giờ</span>'; }
        timeHtml = `<span class="att-day-time">${escapeHtml(rec.at.slice(11))}</span>`;
      } else if (!isWeekend) {
        off++; cls += ' is-off'; statusHtml = '<span class="att-day-status">Nghỉ</span>';
      } else {
        cls += ' is-weekend';
      }
      cells += `<div class="${cls}"><span class="att-day-num">${d}</span>${statusHtml}${timeHtml}</div>`;
    }
    const emptyCells = offset;
    let gridCells = '';
    for (let e = 0; e < emptyCells; e++) gridCells += '<div class="att-day"></div>';
    gridCells += cells;

    html += `<div class="att-calendar-month"><div class="att-calendar-head"><b>${monthLabels[realMonth]} ${year}</b><div class="att-calendar-stats"><span class="att-stat-total">Tổng ${total + off} ngày</span><span class="att-stat-on">${onTime} đúng giờ</span><span class="att-stat-late">${late} muộn</span><span class="att-stat-off">${off} nghỉ</span></div></div><div class="att-grid">${dowLabels.map(d => `<div class="att-dow">${d}</div>`).join('')}${gridCells}</div></div>`;
  }
  html += '</div>';
  return html;
}

function attendanceView() {
  const today = dayIso(0);
  const rows = state.attendance.filter(item => item.date === today && (currentAccount.role === 'ADMIN' || item.teamId === currentAccount.teamId)).sort((a, b) => a.at.localeCompare(b.at));
  if (currentAccount.role !== 'ADMIN') {
    const myAccountId = attendanceAccountId();
    const mine = rows.find(item => item.accountId === myAccountId);
    return pageHead('Điểm danh', '', mine ? '' : '<button class="button button-primary" id="checkInButton">Điểm danh hôm nay</button>') +
      `<section class="panel"><div class="panel-body">${mine ? `<div class="kpi"><strong>${escapeHtml(mine.at.slice(11))}</strong><small>${mine.late ? `Đi muộn ${mine.lateMinutes || 0} phút` : 'Đúng giờ'} · ${mine.ipValid ? 'Đúng wifi' : 'Ngoài wifi'} · IP ${escapeHtml(mine.ip)}</small></div>` : '<div class="empty"><b>Chưa điểm danh</b><span>Bấm nút Điểm danh hôm nay ở góc phải trên.</span></div>'}</div></section>` +
      `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Lịch điểm danh 3 tháng</div><div class="panel-sub">Sau ${escapeHtml(state.settings.attendanceDeadline || '09:00')} sẽ bị gắn nhãn Đi muộn · Cuối tuần tô xám</div></div></div><div class="panel-body" style="padding:0">${attendanceCalendarHtml(myAccountId)}</div></section>`;
  }
  const config = currentAccount.role === 'ADMIN' ? `<section class="panel" style="margin-bottom:14px"><div class="panel-body"><div class="form-grid"><label class="form-field">IP Wi-Fi cho phép · phân cách dấu phẩy<input id="attendanceIp" value="${escapeHtml(state.settings.attendanceIp || '')}" placeholder="Ví dụ 192.168.1.10, 113.161.2.3"></label><label class="form-field">Giờ vào làm · quá giờ báo trễ<input id="attendanceDeadline" type="time" value="${escapeHtml(state.settings.attendanceDeadline || '09:00')}"></label><label class="form-field">Số giờ chờ Sale nhận data<input id="acceptTimeoutHours" type="number" min="1" max="72" step="1" value="${escapeHtml(String(state.settings.acceptTimeoutHours || 8))}"></label></div><button class="button button-primary" id="saveAttendanceSettings" style="margin-top:12px">Lưu quy định</button></div></section>` : '';
  const checkedIds = new Set(rows.map(item => item.accountId));
  const missing = activeStaff().filter(person => person.role === 'SALE' && (currentAccount.role === 'ADMIN' || (person.teamId === currentAccount.teamId && person.leaderId === currentAccount.leaderId)) && !checkedIds.has(person.id));
  const actionCell = person => currentAccount.role === 'ADMIN' ? `<td><button class="button button-small" type="button" data-makeup-attendance="${escapeHtml(person.id)}">Ghi bù</button></td>` : '';
  const body = rows.map(item => `<tr><td><b>${escapeHtml(item.name)}</b></td><td>${escapeHtml(item.teamId)}</td><td class="mono">${escapeHtml(item.at)}</td><td class="mono">${escapeHtml(item.ip)}</td><td>${item.ipValid ? '<span class="status status-paid">Đúng wifi</span>' : '<span class="status status-cancelled">Ngoài wifi</span>'}</td><td>${item.late ? `<span class="status status-cancelled">Đi muộn ${item.lateMinutes || 0}p</span>` : '<span class="status status-paid">Đúng giờ</span>'}</td>${currentAccount.role === 'ADMIN' ? `<td><button class="button button-small" type="button" data-edit-attendance="${escapeHtml(item.id)}">Sửa</button> <button class="button button-small button-danger" type="button" data-delete-attendance="${escapeHtml(item.id)}">Xóa</button></td>` : ''}</tr>`).join('') +
    missing.map(person => `<tr><td><b>${escapeHtml(person.name)}</b></td><td>${escapeHtml(person.teamId)}</td><td colspan="3"><span class="status status-pending">Chưa điểm danh</span></td><td></td>${actionCell(person)}</tr>`).join('');
  const cols = currentAccount.role === 'ADMIN' ? 7 : 6;
  const historyHtml = attendanceHistoryHtml();
  return pageHead('Điểm danh', '') + config + `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Team</th><th>Thời gian</th><th>IP</th><th>Wi-Fi</th><th>Kết quả</th>${currentAccount.role === 'ADMIN' ? '<th></th>' : ''}</tr></thead><tbody>${body || `<tr><td colspan="${cols}"><div class="empty"><b>Chưa có điểm danh hôm nay</b></div></td></tr>`}</tbody></table></div></section>${historyHtml}`;
}

function attendanceHistoryHtml() {
  const today = dayIso(0);
  const threeMonthsAgo = dayIso(90);
  const staff = activeStaff().filter(person => ['SALE', 'LEADER'].includes(person.role));
  const history = state.attendance.filter(item => item.date >= threeMonthsAgo && item.date <= today && staff.some(person => person.id === item.accountId)).sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
  if (!history.length) return '';
  const rows = history.map(item => {
    const person = staff.find(member => member.id === item.accountId);
    return `<tr><td><b>${escapeHtml(item.name)}</b><div class="cell-sub">${escapeHtml(person?.role || '')}</div></td><td>${escapeHtml(item.teamId)}</td><td class="mono">${escapeHtml(item.date)}</td><td class="mono">${escapeHtml(item.at.slice(11))}</td><td>${item.late ? `<span class="status status-cancelled">Muộn ${item.lateMinutes || 0}p</span>` : '<span class="status status-paid">Đúng giờ</span>'}</td><td>${item.ipValid ? '<span class="status status-paid">Đúng wifi</span>' : '<span class="status status-cancelled">Ngoài wifi</span>'}</td><td class="note-preview">${escapeHtml(item.note || '')}</td></tr>`;
  }).join('');
  return `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Bảng điểm danh chi tiết 3 tháng</div><div class="panel-sub">Admin xem Sale và Leader · ${history.length} bản ghi từ ${escapeHtml(threeMonthsAgo)} đến ${escapeHtml(today)}</div></div></div><div class="table-wrap"><table><thead><tr><th>Nhân sự</th><th>Team</th><th>Ngày</th><th>Giờ</th><th>Kết quả</th><th>Wi-Fi</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

/* Bản ghi điểm danh trỏ vào NHÂN SỰ trong state.members (s1, l1…), không phải tài
   khoản đăng nhập (u-sale-1) — nhờ vậy loadState() giữ được bản ghi, bảng của Leader
   so đúng người đã chấm, và nút Ghi bù của Admin dùng chung một loại id. */
function attendanceAccountId() {
  if (!currentAccount) return '';
  return currentAccount.saleId || currentAccount.leaderId || currentAccount.id;
}

function checkInToday() {
  const date = dayIso(0);
  const accountId = attendanceAccountId();
  if (state.attendance.some(item => item.date === date && item.accountId === accountId)) { toast('Hôm nay bạn đã điểm danh rồi'); return; }
  const at = stamp(), time = at.slice(11, 16), deadline = state.settings.attendanceDeadline || '09:00', ip = currentAccount.ip || '127.0.0.1';
    const deadlineMinutes = timeToMinutes(deadline);
  const checkInMinutes = timeToMinutes(time);
  const late = checkInMinutes > deadlineMinutes;
  const lateMinutes = late ? checkInMinutes - timeToMinutes(deadline) : 0;
  state.attendance.unshift({ id: `ATT-${Date.now()}`, date, accountId, name: currentAccount.name, teamId: currentAccount.teamId || '', at, ip, late, lateMinutes, ipValid: attendanceIsWifiIp(ip), note: '', editedBy: '' });
  audit('CHECK_IN', date, `${time} · ${ip}${late ? ` · ĐI MUỘN ${lateMinutes}p` : ''}`);
  if (late && currentAccount.leaderId) state.notifications.unshift({ id: `NT-LATE-${date}-${currentAccount.id}`, role: 'LEADER', leaderId: currentAccount.leaderId, teamId: currentAccount.teamId, title: 'Sale điểm danh muộn', text: `${currentAccount.name} điểm danh lúc ${time} · trễ ${lateMinutes} phút · quá giờ chốt ${deadline}`, at, readBy: [] });
  saveState(); render();
  toast(late ? `Đã điểm danh · ĐI MUỘN ${lateMinutes} phút (quá giờ chốt ${deadline})` : 'Đã điểm danh đúng giờ');
}

function saveAttendanceSettings() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được đổi quy định điểm danh'); return; }
  const deadline = cleanClockTime($('#attendanceDeadline')?.value, '');
  const hours = Number($('#acceptTimeoutHours')?.value);
  if (!deadline) { toast('Giờ vào làm không hợp lệ'); return; }
  if (!Number.isInteger(hours) || hours < 1 || hours > 72) { toast('Số giờ chờ nhận data phải từ 1 đến 72'); return; }
  state.settings.attendanceIp = cleanText($('#attendanceIp')?.value || '', '', 200);
  state.settings.attendanceDeadline = deadline;
  state.settings.acceptTimeoutHours = hours;
  audit('UPDATE_SETTING', 'ATTENDANCE', `giờ chốt ${deadline} · wifi "${state.settings.attendanceIp || 'bỏ trống'}" · chờ nhận ${hours}h`);
  saveState(); render(); toast('Đã lưu quy định điểm danh và nhận data');
}

function attendanceEditModal(recordId = null, makeupSaleId = null) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được sửa điểm danh'); return; }
  const record = recordId ? state.attendance.find(item => item.id === recordId) : null;
  if (recordId && !record) { toast('Bản ghi điểm danh không tồn tại'); return; }
  const sale = makeupSaleId ? activeStaff().find(person => person.id === makeupSaleId && person.role === 'SALE') : null;
  if (makeupSaleId && !sale) { toast('Sale không hợp lệ để ghi bù'); return; }
  openModal(record ? 'Sửa điểm danh' : 'Ghi bù điểm danh', `<form id="attendanceEditForm"><div class="form-grid">
    <label class="form-field">Ngày<input id="attDate" type="date" value="${escapeHtml(record ? record.date : dayIso(0))}"></label>
    <label class="form-field">Giờ<input id="attTime" type="time" value="${escapeHtml(record ? record.at.slice(11, 16) : '')}"></label>
    <label class="form-field">Kết quả<select id="attLate"><option value="AUTO">Tự suy từ giờ chốt</option><option value="ONTIME" ${record && !record.late ? 'selected' : ''}>Đúng giờ</option><option value="LATE" ${record && record.late ? 'selected' : ''}>Đi muộn</option></select></label>
    <label class="form-field">Wi-Fi<select id="attWifi"><option value="AUTO">Tự suy từ IP</option><option value="OK" ${record && record.ipValid ? 'selected' : ''}>Đúng wifi</option><option value="OUT" ${record && record.ipValid === false ? 'selected' : ''}>Ngoài wifi</option></select></label>
    <label class="form-field full">IP<input id="attIp" class="mono" maxlength="64" value="${escapeHtml(record ? record.ip : '')}" placeholder="Để trống: giữ IP gốc, ghi bù thì lấy IP hiện tại"></label>
    <label class="form-field full">Ghi chú lý do<textarea id="attNote" rows="2" maxlength="300" placeholder="Ví dụ: sale quên bấm, admin ghi bù theo chấm công">${escapeHtml(record ? record.note : '')}</textarea></label>
  </div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">${record ? 'Lưu sửa đổi' : 'Ghi bù'}</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#attendanceEditForm').onsubmit = event => {
    event.preventDefault();
    const date = cleanDate($('#attDate').value);
    const time = cleanClockTime($('#attTime').value, '');
    if (!date) { toast('Ngày không hợp lệ'); return; }
    if (date > dayIso(0)) { toast('Không thể điểm danh cho ngày chưa tới'); return; }
    const deadline = state.settings.attendanceDeadline || '09:00';
    const lateChoice = $('#attLate').value, wifiChoice = $('#attWifi').value;
    const ip = $('#attIp').value.trim() || (record ? record.ip : sessionIp('127.0.0.1'));
    const at = `${date} ${time || '00:00'}`;
    const deadlineMinutes = timeToMinutes(deadline);
    const checkInMinutes = time ? timeToMinutes(time) : 0;
    const late = lateChoice === 'AUTO' ? (time ? checkInMinutes > deadlineMinutes : false) : lateChoice === 'LATE';
    const lateMinutes = late ? Math.max(0, checkInMinutes - timeToMinutes(deadline)) : 0;
    const ipValid = wifiChoice === 'AUTO' ? attendanceIsWifiIp(ip) : wifiChoice === 'OK';
    const note = $('#attNote').value.trim();
    if (record) {
      record.date = date; record.at = at; record.ip = ip; record.late = late; record.lateMinutes = lateMinutes; record.ipValid = ipValid; record.note = note; record.editedBy = currentAccount.name;
      audit('UPDATE_ATTENDANCE', record.id, `${record.name} · ${at} · ${late ? `muộn ${lateMinutes}p` : 'đúng giờ'} · ${ipValid ? 'đúng wifi' : 'ngoài wifi'}`);
      saveState(); closeModal(); render(); toast('Đã lưu sửa điểm danh');
      return;
    }
    if (state.attendance.some(item => item.date === date && item.accountId === sale.id)) { toast('Ngày đó đã có điểm danh của sale này'); return; }
    state.attendance.unshift({ id: `ATT-${Date.now()}`, date, accountId: sale.id, name: sale.name, teamId: sale.teamId || '', at, ip, late, lateMinutes, ipValid, note: note || 'Admin ghi bù', editedBy: currentAccount.name });
    audit('MAKEUP_ATTENDANCE', sale.id, `${at} · ${ip}`);
    saveState(); closeModal(); render(); toast('Đã ghi bù điểm danh');
  };
}

function deleteAttendanceRecord(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được xóa điểm danh'); return; }
  const record = state.attendance.find(item => item.id === id);
  if (!record) { toast('Bản ghi điểm danh không tồn tại'); return; }
  if (!window.confirm(`Xóa điểm danh ngày ${record.date} của ${record.name}?`)) return;
  state.attendance = state.attendance.filter(item => item.id !== id);
  audit('DELETE_ATTENDANCE', id, `${record.name} · ${record.date}`);
  saveState(); render(); toast('Đã xóa bản ghi điểm danh');
}
function accessDeniedView(message) {
  return pageHead('Không có quyền truy cập', 'Backend production phải trả 403 cho thao tác này.') + `<section class="panel"><div class="empty"><b>403 · FORBIDDEN</b><span>${escapeHtml(message)}</span></div></section>`;
}

const VIEW_RENDERERS = {
  dashboard: dashboardView, customers: customersView, pool: poolView, distribution: distributionView,
  orders: ordersView, products: productsView, revenue: revenueView, marketing: marketingView, team: teamView,
  websites: websitesView, integrations: integrationsView,
  attendance: attendanceView, accept: acceptQueueView, notifications: notificationsView, audit: auditView, settings: settingsView
};

function allowedViews() { return NAVIGATION[currentAccount.role].flatMap(([, items]) => items.map(item => item[0])); }
function viewLabel(view) { return NAVIGATION[currentAccount.role].flatMap(([, items]) => items).find(item => item[0] === view)?.[1] || view; }

function newCustomerCount() {
  return currentAccount && currentAccount.role !== 'SALE' ? scopedCustomers().filter(isPoolCustomer).length : 0;
}

function renderNavigation() {
  const groups = NAVIGATION[currentAccount.role];
  $('#sideNav').innerHTML = groups.map(([group, items]) => `<div class="nav-group"><div class="nav-title">${escapeHtml(group)}</div>${items.map(([view, label, icon]) => { const badge = view === 'notifications' ? unreadCount() : view === 'pool' ? newCustomerCount() : view === 'accept' ? pendingOfferCount() : 0; const showBadge = view === 'pool' || view === 'accept' || badge > 0; return `<button type="button" class="nav-link ${currentView === view ? 'active' : ''}" data-view-link="${view}" ${currentView === view ? 'aria-current="page"' : ''}><span class="nav-icon">${icon}</span><span>${escapeHtml(label)}</span>${showBadge ? `<span class="nav-badge">${badge}</span>` : ''}</button>`; }).join('')}</div>`).join('');
  $('#mobileNav').innerHTML = groups.flatMap(([, items]) => items).map(([view, label]) => `<option value="${view}" ${currentView === view ? 'selected' : ''}>${escapeHtml(label)}${view === 'pool' ? ` (${newCustomerCount()})` : ''}</option>`).join('');
  $$('[data-view-link]').forEach(button => button.onclick = event => { event.preventDefault(); navigate(button.dataset.viewLink); });
  $('#mobileNav').onchange = event => navigate(event.target.value);
}

function unreadCount() { return currentAccount ? visibleNotifications().filter(item => !item.readBy.includes(currentAccount.id)).length : 0; }

function updateSessionChrome() {
  $('#profileName').textContent = currentAccount.name;
  $('#profileRole').textContent = `${currentAccount.role} · ${currentAccount.scope}`;
  $('#profileAvatar').textContent = currentAccount.initials;
  $('#sidebarRole').textContent = currentAccount.role;
  $('#sidebarScope').textContent = currentAccount.scope;
  $('#notificationCount').textContent = unreadCount();
  $('#notificationCount').classList.toggle('is-hidden', unreadCount() === 0);
}

function navigate(view) {
  if (!allowedViews().includes(view)) view = 'dashboard';
  currentView = view;
  globalQuery = '';
  $('#globalSearch').value = '';
  $('#sidebar').classList.remove('open');
  closeDrawer();
  closeModal();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  if (!currentAccount) return;
  const renderer = VIEW_RENDERERS[currentView] || dashboardView;
  $('#content').innerHTML = renderer();
  $('#breadcrumb').textContent = viewLabel(currentView);
  renderNavigation();
  updateSessionChrome();
  bindViewActions();
}

function renderPreservingCustomerScroll() {
  const root = document.scrollingElement || document.documentElement;
  const pageTop = root.scrollTop;
  const wraps = $$('.table-wrap').map(element => ({ top: element.scrollTop, left: element.scrollLeft }));
  render();
  root.scrollTop = pageTop;
  window.scrollTo(0, pageTop);
  $$('.table-wrap').forEach((element, index) => { if (wraps[index]) { element.scrollTop = wraps[index].top; element.scrollLeft = wraps[index].left; } });
  window.getSelection?.()?.removeAllRanges();
}

function openDrawer(content) {
  drawerReturnFocus = document.activeElement;
  $('#drawerRoot').innerHTML = `<div class="drawer-backdrop" data-close-drawer></div><aside class="drawer" role="dialog" aria-modal="true"><div class="drawer-head"><div>${content.head}</div><button class="close-button" type="button" data-close-drawer aria-label="Đóng">×</button></div><div class="drawer-body">${content.body}</div></aside>`;
  $$('[data-close-drawer]').forEach(item => item.onclick = closeDrawer);
  $('.drawer .close-button')?.focus();
}

function closeDrawer() {
  $('#drawerRoot').innerHTML = '';
  if (drawerReturnFocus?.isConnected) drawerReturnFocus.focus();
  drawerReturnFocus = null;
}

function openModal(title, body) {
  modalReturnFocus = document.activeElement;
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" data-close-modal></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><h2 id="modalTitle">${escapeHtml(title)}</h2><button class="close-button" type="button" data-close-modal aria-label="Đóng">×</button></div><div class="modal-body">${body}</div></section>`;
  $$('[data-close-modal]').forEach(item => item.onclick = closeModal);
  $('.modal .close-button')?.focus();
}

function closeModal() {
  $('#modalRoot').innerHTML = '';
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
  modalReturnFocus = null;
}

function customFieldsModal() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quản lý cột khách hàng'); return; }
  const typeLabels = { TEXT: 'Nhập nội dung', NOTE: 'Ghi chú', SELECT: 'Chọn một', MULTI_SELECT: 'Chọn nhiều', CHECKBOX: 'Tích chọn' };
  openModal('Quản lý cột khách hàng', `<div class="field-manager"><div class="credential-hint"><b>Cột Level khách hàng có lịch sử bất biến.</b> Các cột mới tự xuất hiện trong bảng theo đúng kiểu dữ liệu.</div><button class="button button-primary" id="newCustomFieldButton" type="button">+ Thêm cột mới</button>${state.customFieldDefinitions.map(field => `<div class="field-manager-row ${field.active ? '' : 'is-archived'}"><div><b>${escapeHtml(field.label)}</b><small>${escapeHtml(typeLabels[field.type] || field.type)} · ${field.type === 'MULTI_SELECT' || field.type === 'NOTE' ? 'Hiện trong chi tiết' : 'Hiện trong bảng'}${field.active ? '' : ' · Đã lưu trữ'}</small></div><span class="field-pill" style="--pill:${escapeHtml(field.options?.[0]?.color || '#687771')}">${field.options?.length || 0} lựa chọn</span><button class="button button-small" data-edit-custom-field="${escapeHtml(field.id)}">Sửa</button><button class="button button-small ${field.active ? 'button-danger' : ''}" data-toggle-custom-field="${escapeHtml(field.id)}">${field.active ? 'Lưu trữ' : 'Khôi phục'}</button>${field.id !== 'customerLevel' ? `<button class="button button-small button-danger" data-delete-custom-field="${escapeHtml(field.id)}">Xóa</button>` : ''}</div>`).join('')}</div>`);
  $('#newCustomFieldButton').onclick = () => customFieldEditorModal();
  $$('[data-edit-custom-field]').forEach(button => button.onclick = () => customFieldEditorModal(button.dataset.editCustomField));
  $$('[data-toggle-custom-field]').forEach(button => button.onclick = () => toggleCustomField(button.dataset.toggleCustomField));
  $$('[data-delete-custom-field]').forEach(button => button.onclick = () => deleteCustomField(button.dataset.deleteCustomField));
}

function deleteCustomField(id) {
  if (currentAccount.role !== 'ADMIN' || id === 'customerLevel') { toast('Không thể xóa cột Level khách hàng'); return; }
  const field = state.customFieldDefinitions.find(item => item.id === id); if (!field) return;
  if (!window.confirm(`Xóa cột ${field.label}? Dữ liệu cột sẽ bị xóa khỏi hồ sơ.`)) return;
  state.customFieldDefinitions = state.customFieldDefinitions.filter(item => item.id !== id);
  state.customers.forEach(customer => { if (customer.customFields) delete customer.customFields[id]; });
  state.customerFieldHistory = state.customerFieldHistory.filter(item => item.fieldId !== id);
  audit('DELETE_CUSTOM_FIELD', id, field.label); saveState(); render(); toast('Đã xóa cột khách hàng');
}

function customFieldEditorModal(id = null) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quản lý cột'); return; }
  const existing = id ? state.customFieldDefinitions.find(field => field.id === id) : null;
  if (id && !existing) return;
  const field = existing || { label: '', type: 'TEXT', showInTable: false, required: false, options: [] };
  const optionRows = (field.options || []).map(option => `<div class="field-option-row"><input data-option-label value="${escapeHtml(option.label)}" placeholder="Nội dung lựa chọn"><input data-option-color type="color" value="${escapeHtml(/^#[0-9a-f]{6}$/i.test(option.color) ? option.color : '#64748b')}" title="Màu lựa chọn"><button class="button button-small button-danger" type="button" data-remove-option>Xóa</button></div>`).join('');
  openModal(existing ? `Sửa cột · ${existing.label}` : 'Thêm cột khách hàng', `<form id="customFieldForm"><div class="form-grid"><label class="form-field">Tên cột<input id="customFieldLabel" maxlength="160" required value="${escapeHtml(field.label)}" placeholder="Ví dụ: Gọi kết nối"></label><label class="form-field">Kiểu dữ liệu<select id="customFieldType"><option value="TEXT" ${field.type === 'TEXT' ? 'selected' : ''}>Nhập nội dung</option><option value="SELECT" ${field.type === 'SELECT' ? 'selected' : ''}>Chọn một</option><option value="MULTI_SELECT" ${field.type === 'MULTI_SELECT' ? 'selected' : ''}>Chọn nhiều</option><option value="CHECKBOX" ${field.type === 'CHECKBOX' ? 'selected' : ''}>Tích chọn</option><option value="NOTE" ${field.type === 'NOTE' ? 'selected' : ''}>Ghi chú</option></select></label><div class="form-field full option-editor"><span>Nội dung lựa chọn <small>(chỉ dùng cho Chọn một / Chọn nhiều)</small></span><div id="customFieldOptions">${optionRows}</div><textarea id="customFieldOptionsLegacy" class="is-hidden">${escapeHtml((field.options || []).map(option => `${option.value}|${option.label}|${option.color}`).join('\n'))}</textarea><input id="customFieldShowTable" class="is-hidden" type="checkbox" checked><input id="customFieldRequired" class="is-hidden" type="checkbox"><button class="button button-small" type="button" id="addCustomFieldOption">+ Thêm nội dung</button></div></div><div class="modal-actions"><button class="button" type="button" id="backToFieldManager">Quay lại</button><button class="button button-primary" type="submit">Tạo cột</button></div></form>`);
  $('#backToFieldManager').onclick = customFieldsModal;
  $('#addCustomFieldOption').onclick = () => { $('#customFieldOptions').insertAdjacentHTML('beforeend', '<div class="field-option-row"><input data-option-label placeholder="Nội dung lựa chọn"><input data-option-color type="color" value="#64748b"><button class="button button-small button-danger" type="button" data-remove-option>Xóa</button></div>'); bindFieldOptionRows(); };
  bindFieldOptionRows();
  $('#customFieldForm').onsubmit = event => { event.preventDefault(); saveCustomFieldDefinition(id); };
}

function bindFieldOptionRows() { $$('[data-remove-option]').forEach(button => button.onclick = () => button.closest('.field-option-row')?.remove()); }

function parseCustomFieldOptions(raw, type) {
  if (!['SELECT', 'MULTI_SELECT'].includes(type)) return [];
  const seen = new Set();
  return String(raw || '').split(/\r?\n/).map((line, index) => {
    const [rawValue, rawLabel, rawColor] = line.split('|').map(part => part?.trim() || '');
    const value = rawValue.slice(0, 160);
    if (!value || seen.has(value)) return null;
    seen.add(value);
    return { value, label: (rawLabel || value).slice(0, 200), color: /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor : FIELD_COLORS[index % FIELD_COLORS.length] };
  }).filter(Boolean);
}

function saveCustomFieldDefinition(id = null) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quản lý cột'); return; }
  const existing = id ? state.customFieldDefinitions.find(field => field.id === id) : null;
  const label = $('#customFieldLabel')?.value.trim(), requestedType = $('#customFieldType')?.value;
  const type = id === 'customerLevel' ? 'SELECT' : requestedType;
  const rowInputs = $$('[data-option-label]');
  const optionRaw = rowInputs.length ? rowInputs.map((input, index) => `${input.value.trim()}|${input.value.trim()}|${$$('[data-option-color]')[index]?.value || '#64748b'}`).join('\n') : ($('#customFieldOptions')?.value || $('#customFieldOptionsLegacy')?.value || '');
  const options = parseCustomFieldOptions(optionRaw, type);
  if (!label || !['TEXT', 'NOTE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX'].includes(type)) { toast('Tên hoặc kiểu cột không hợp lệ'); return; }
  if (['SELECT', 'MULTI_SELECT'].includes(type) && !options.length) { toast('Cột lựa chọn cần ít nhất một phương án'); return; }
  if (state.customFieldDefinitions.some(field => field.id !== id && normalize(field.label) === normalize(label))) { toast('Tên cột đã tồn tại'); return; }
  const next = { id: existing?.id || `field-${Date.now()}`, label, type, showInTable: true, required: false, active: existing?.active !== false, options };
  if (existing) {
    const previousDefinition = structuredClone(existing);
    Object.assign(existing, next);
    state.customers.forEach(customer => {
      const previous = customer.customFields?.[id] ?? defaultCustomFieldValue(previousDefinition);
      const sanitized = sanitizeCustomFieldValue(previous, existing);
      if (JSON.stringify(previous) !== JSON.stringify(sanitized)) recordFieldChange(customer, previousDefinition, previous, sanitized, 'SYSTEM');
      customer.customFields[id] = sanitized;
    });
    audit('UPDATE_CUSTOM_FIELD', id, `${previousDefinition.label} -> ${label} · ${type}`);
  } else {
    state.customFieldDefinitions.push(next);
    state.customers.forEach(customer => { customer.customFields[next.id] = defaultCustomFieldValue(next); });
    audit('CREATE_CUSTOM_FIELD', next.id, `${label} · ${type}`);
  }
  saveState(); render(); customFieldsModal(); toast(existing ? 'Đã cập nhật cột; lịch sử cũ không thay đổi' : 'Đã thêm cột khách hàng');
}

function toggleCustomField(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quản lý cột'); return; }
  if (id === 'customerLevel') { toast('Level khách hàng là cột nghiệp vụ bắt buộc, không thể lưu trữ'); return; }
  const field = state.customFieldDefinitions.find(item => item.id === id);
  if (!field) return;
  field.active = !field.active;
  audit(field.active ? 'RESTORE_CUSTOM_FIELD' : 'ARCHIVE_CUSTOM_FIELD', field.id, field.label);
  saveState(); render(); customFieldsModal(); toast(field.active ? 'Đã khôi phục cột' : 'Đã lưu trữ cột; toàn bộ lịch sử vẫn được giữ');
}

function openCustomerDrawer(id) {
  const customer = customerById(id);
  if (!canViewCustomer(customer)) { toast('NOT_FOUND · khách hàng nằm ngoài phạm vi tài khoản'); return; }
  const canUpdate = canUpdateCustomer(customer);
  const orders = scopedOrders().filter(order => order.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notes = state.notes.filter(note => note.customerId === id).sort((a, b) => b.at.localeCompare(a.at));
  const followUps = scopedTasks().filter(task => task.customerId === id).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const logs = state.audit.filter(item => item.entity === id).slice(0, 8);
  const fieldHistory = state.customerFieldHistory.filter(item => item.customerId === id).sort((a, b) => b.at.localeCompare(a.at));
  const levelHistory = fieldHistory.filter(item => item.fieldId === 'customerLevel');
  const otherFieldHistory = fieldHistory.filter(item => item.fieldId !== 'customerLevel').slice(0, 12);
  const resubmissions = state.resubmissions.filter(item => item.customerId === id).sort((a, b) => b.at.localeCompare(a.at));
  const assignmentHistory = state.assignmentHistory.filter(item => item.customerId === id).sort((a, b) => b.at.localeCompare(a.at));
  const assignmentTargets = currentAccount.role === 'ADMIN'
    ? assignmentCandidates({ leaderId: null })
    : currentAccount.role === 'LEADER'
      ? assignmentCandidates({ leaderId: currentAccount.leaderId, teamId: currentAccount.teamId })
      : [];
  const assignmentHtml = assignmentTargets.length ? `<div class="section-label">Phân công phụ trách</div><div class="form-grid"><label class="form-field">${currentAccount.role === 'ADMIN' ? 'Leader / Team' : 'Sale trong Team'}<select id="customerAssignee">${assignmentTargets.map(person => `<option value="${escapeHtml(person.id)}" ${(currentAccount.role === 'ADMIN' ? customer.leaderId : customer.saleId) === person.id ? 'selected' : ''}>${escapeHtml(person.name)} · ${escapeHtml(person.teamId)}</option>`).join('')}</select></label><div class="form-field"><span>Thao tác</span><div class="panel-actions"><button class="button button-primary" type="button" data-reassign-customer="${escapeHtml(customer.id)}">${currentAccount.role === 'ADMIN' ? 'Chuyển Leader' : 'Giao Sale'}</button>${(currentAccount.role === 'ADMIN' ? customer.leaderId : customer.saleId) ? `<button class="button button-danger" type="button" data-revoke-customer="${escapeHtml(customer.id)}">Thu hồi về Khách mới</button>` : ''}</div></div></div>` : '';
  const sourceDetails = currentAccount.role === 'ADMIN' ? `<dt>Landing page nguồn</dt><dd>${escapeHtml(customerLandingName(customer))}</dd><dt>Nguồn / Campaign</dt><dd>${escapeHtml(customer.source)} · ${escapeHtml(customer.campaign)}</dd>` : '';
  const levelField = state.customFieldDefinitions.find(field => field.id === 'customerLevel') || CUSTOM_FIELD_SEED[0];
  const levelTimeline = levelHistory.map(item => `<div class="timeline-item history-change"><b>${escapeHtml(customFieldValueLabel(levelField, item.to) || 'Chưa đặt Level')}</b><p>${item.from === '' ? 'Khởi tạo Level' : `${escapeHtml(customFieldValueLabel(levelField, item.from) || 'Trống')} → ${escapeHtml(customFieldValueLabel(levelField, item.to) || 'Trống')}`}</p><small>${escapeHtml(item.at)} · ${escapeHtml(item.actor)} · ${escapeHtml(item.source)}</small></div>`).join('') || '<div class="timeline-item"><b>Chưa có lịch sử Level</b><p>Level đầu tiên sẽ được ghi khi cập nhật.</p><small>CRM</small></div>';
  openDrawer({
    head: `<h2>${escapeHtml(customer.name)}</h2><p>${currentAccount.role === 'SALE' && !customer.saleAcceptedAt ? '•••••' : escapeHtml(customer.phone)}</p>`,
    body: `${resubmissions.length ? `<div class="duplicate-alert"><b>DATA TRÙNG · ${resubmissions.length} lần gửi lại</b><span>${resubmissions[0].registeredAccount ? 'DATA đã đăng ký TK' : 'Đã giữ đúng người phụ trách trước đó'} · gần nhất ${escapeHtml(resubmissions[0].at)}</span></div>` : ''}<div class="section-label">Thông tin khách hàng</div><dl class="detail-grid"><dt>Email</dt><dd>${escapeHtml(customer.email || 'Chưa cập nhật')}</dd>${sourceDetails}<dt>IP truy cập</dt><dd class="mono">${escapeHtml(customer.ipAddress || 'Chưa xác định')}</dd><dt>Trạng thái</dt><dd>${statusBadge(customer.status)}</dd><dt>Team / Leader</dt><dd>${escapeHtml(customer.teamId || 'Khách mới')} · ${escapeHtml(staffName(customer.leaderId))}</dd><dt>Sale phụ trách</dt><dd>${escapeHtml(staffName(customer.saleId))}</dd><dt>Ngày tạo</dt><dd>${escapeHtml(customer.createdAt)}</dd><dt>Doanh thu thuần</dt><dd>${money(netRevenue(orders))}</dd><dt>Ghi chú gần nhất</dt><dd>${escapeHtml(customer.note)}</dd></dl>
      ${assignmentHtml}
      <div class="section-label">Trạng thái khách hàng</div>${canUpdate ? `<form id="customerUpdateForm"><div class="inline-form"><select id="customerStatus">${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}" ${customer.status === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`).join('')}</select><button class="button button-primary" type="submit">Cập nhật trạng thái</button></div></form>` : `<div class="form-hint">Tài khoản hiện tại chỉ được xem trạng thái.</div>`}
      <div class="section-label customer-business-section">Dữ liệu nghiệp vụ</div>${canUpdate ? `<form id="customerCustomFieldsForm"><div class="form-grid custom-field-grid">${activeCustomFields().filter(field => field.type === 'MULTI_SELECT' || field.type === 'NOTE').map(field => customFieldInput(field, customer.customFields?.[field.id])).join('')}</div><div class="modal-actions"><button class="button button-primary" type="submit">Lưu dữ liệu nghiệp vụ</button></div></form>` : `<div class="custom-field-readonly">${activeCustomFields().filter(field => field.type === 'MULTI_SELECT' || field.type === 'NOTE').map(field => `<div><small>${escapeHtml(field.label)}</small>${customFieldCell(field, customer.customFields?.[field.id])}</div>`).join('')}</div>`}
      <div class="section-label">Lịch sử Level khách hàng · Không ghi đè</div><div class="timeline level-history">${levelTimeline}</div>
      <div class="section-label section-label-with-action">Sản phẩm & đơn hàng đã mua <button class="button button-small" type="button" data-new-customer-product="${escapeHtml(customer.id)}">+ Thêm sản phẩm</button></div><div class="purchase-list">${orders.map(order => `<button class="purchase-row" type="button" data-customer-order="${escapeHtml(order.id)}"><span><b>${escapeHtml(order.productName)}</b><small>${escapeHtml(order.code)} · SL ${order.qty} · ${escapeHtml(order.createdAt)}</small></span><span class="right"><b>${money(order.total)}</b>${statusBadge(order.status, 'order')}</span></button>`).join('') || '<div class="empty compact"><b>Chưa mua sản phẩm</b><span>Khách hàng chưa có đơn hàng nào.</span></div>'}</div>
      <div class="section-label">Ghi chú chăm sóc</div>${canUpdate ? `<form id="customerNoteForm"><label class="form-field">Ghi chú mới<textarea id="customerNote" rows="3" maxlength="2000" placeholder="Sale ghi nội dung trao đổi, nhu cầu hoặc lịch hẹn..."></textarea></label><div class="modal-actions"><button class="button button-primary" type="submit">Thêm ghi chú</button></div></form>` : ''}<div class="timeline note-timeline">${notes.map(note => `<div class="timeline-item"><b>${escapeHtml(note.author)} · ${escapeHtml(note.role)}</b><p>${escapeHtml(note.text)}</p><small>${escapeHtml(note.at)}</small><div class="note-actions"><button class="button button-small" type="button" data-edit-note="${escapeHtml(note.id)}">Sửa</button><button class="button button-small button-danger" type="button" data-delete-note="${escapeHtml(note.id)}">Xóa</button></div></div>`).join('') || '<div class="timeline-item"><b>Chưa có ghi chú</b><p>Nhập ghi chú để cả Team cùng theo dõi.</p><small>CRM</small></div>'}</div>
      <div class="section-label">Lịch chăm sóc</div>${canUpdate && customer.saleId ? `<form id="customerFollowUpForm"><div class="form-grid"><label class="form-field">Nội dung<input id="followUpType" maxlength="160" required placeholder="Gọi lại / gửi báo giá..."></label><label class="form-field">Hạn xử lý<input id="followUpDueAt" type="datetime-local" required value="2026-09-08T09:00"></label><label class="form-field">Ưu tiên<select id="followUpPriority"><option value="NORMAL">Thường</option><option value="HIGH">Cao</option></select></label></div><div class="modal-actions"><button class="button" type="submit">+ Thêm lịch chăm sóc</button></div></form>` : ''}<div class="follow-up-list">${followUps.map(task => `<div class="follow-up-row"><span><b>${escapeHtml(task.type)}</b><small>${escapeHtml(task.dueAt)} · ${escapeHtml(staffName(task.ownerId))}</small></span><span>${statusBadge(task.status, 'task')}${task.status !== 'DONE' && canUpdate ? `<button class="button button-small" type="button" data-complete-task="${escapeHtml(task.id)}">Hoàn tất</button>` : ''}</span></div>`).join('') || '<div class="empty compact"><b>Chưa có lịch chăm sóc</b><span>Tạo lịch mới ngay trong hồ sơ khách.</span></div>'}</div>
      ${currentAccount.role === 'ADMIN' && resubmissions.length ? `<div class="section-label">Lịch sử khách điền lại form</div><div class="timeline">${resubmissions.map(item => `<div class="timeline-item"><b>${item.registeredAccount ? 'DATA TRÙNG - DATA đã đăng ký TK' : 'DATA TRÙNG'}</b><p>${escapeHtml(item.source)} · ${escapeHtml(item.campaign || 'Không có campaign')} · giữ Sale ${escapeHtml(staffName(item.assignedSaleId))}</p><small>${escapeHtml(item.at)} · ${escapeHtml(item.intakeType)}</small></div>`).join('')}</div>` : ''}
      ${currentAccount.role === 'ADMIN' && assignmentHistory.length ? `<div class="section-label">Lịch sử phân công</div><div class="timeline">${assignmentHistory.map(item => `<div class="timeline-item"><b>${escapeHtml(item.toSaleName || item.toLeaderName || 'Thu hồi về Khách mới')}</b><p>${escapeHtml(item.reason)} · từ ${escapeHtml(item.fromSaleName || item.fromLeaderName || 'Khách mới')}</p><small>${escapeHtml(item.at)} · ${escapeHtml(item.actor)}</small></div>`).join('')}</div>` : ''}
      ${otherFieldHistory.length ? `<div class="section-label">Các thay đổi nghiệp vụ gần đây</div><div class="timeline">${otherFieldHistory.map(item => `<div class="timeline-item"><b>${escapeHtml(item.fieldLabel)}</b><p>${escapeHtml(String(customFieldValueLabel(state.customFieldDefinitions.find(field => field.id === item.fieldId), item.from) || 'Trống'))} → ${escapeHtml(String(customFieldValueLabel(state.customFieldDefinitions.find(field => field.id === item.fieldId), item.to) || 'Trống'))}</p><small>${escapeHtml(item.at)} · ${escapeHtml(item.actor)}</small></div>`).join('')}</div>` : ''}
      <div class="section-label">Audit</div><div class="timeline">${logs.map(log => `<div class="timeline-item"><b>${escapeHtml(log.action)}</b><p>${escapeHtml(log.detail)}</p><small>${escapeHtml(log.at)} · ${escapeHtml(log.actor)}</small></div>`).join('') || '<div class="timeline-item"><b>Khởi tạo data</b><p>Bản ghi được tạo từ nguồn acquisition.</p><small>System</small></div>'}</div>`
  });
  const form = $('#customerUpdateForm');
  if (form) form.onsubmit = event => { event.preventDefault(); updateCustomer(id); };
  const noteForm = $('#customerNoteForm');
  if (noteForm) noteForm.onsubmit = event => { event.preventDefault(); addCustomerNote(id); };
  const customFieldsForm = $('#customerCustomFieldsForm');
  if (customFieldsForm) customFieldsForm.onsubmit = event => { event.preventDefault(); updateCustomerCustomFields(id); };
  const followUpForm = $('#customerFollowUpForm');
  if (followUpForm) followUpForm.onsubmit = event => { event.preventDefault(); addCustomerFollowUp(id); };
  $$('[data-customer-order]').forEach(button => button.onclick = () => openOrderDrawer(button.dataset.customerOrder));
  $$('[data-complete-task]').forEach(button => button.onclick = () => completeTask(button.dataset.completeTask));
  $('[data-reassign-customer]')?.addEventListener('click', () => reassignCustomer(id, $('#customerAssignee').value));
  $('[data-revoke-customer]')?.addEventListener('click', () => revokeCustomer(id));
}

function updateCustomer(id) {
  const customer = customerById(id);
  if (!canViewCustomer(customer)) { closeDrawer(); toast('FORBIDDEN · không thể cập nhật khách ngoài scope'); return; }
  if (!canUpdateCustomer(customer)) { toast('FORBIDDEN · tài khoản không có quyền cập nhật'); return; }
  const nextStatus = $('#customerStatus').value;
  if (!Object.hasOwn(STATUS_META, nextStatus)) { toast('Trạng thái khách hàng không hợp lệ'); return; }
  if (nextStatus === customer.status) { toast('Trạng thái chưa thay đổi'); return; }
  const oldStatus = customer.status;
  customer.status = nextStatus;
  customer.updatedAt = stamp();
  audit('UPDATE_CUSTOMER_STATUS', customer.id, `${STATUS_META[oldStatus]?.label || oldStatus} -> ${STATUS_META[nextStatus]?.label || nextStatus}`);
  if (state.settings.notifyMilestones && ['PAID', 'WON'].includes(nextStatus)) state.notifications.unshift({ id: `NT-${Date.now()}`, role: 'ADMIN', title: 'Khách đạt milestone', text: `${customer.name} chuyển sang ${STATUS_META[nextStatus].label}.`, at: stamp(), readBy: [] });
  saveState(); render(); openCustomerDrawer(id); toast('Đã cập nhật trạng thái khách hàng');
}

function quickUpdateCustomerStatus(id, nextStatus) {
  const customer = customerById(id);
  if (!canViewCustomer(customer) || !canUpdateCustomer(customer) || !Object.hasOwn(STATUS_META, nextStatus)) { toast('Không thể cập nhật trạng thái'); return; }
  const oldStatus = customer.status;
  if (oldStatus === nextStatus) return;
  customer.status = nextStatus;
  customer.updatedAt = stamp();
  audit('UPDATE_CUSTOMER_STATUS', customer.id, `${STATUS_META[oldStatus]?.label || oldStatus} -> ${STATUS_META[nextStatus].label}`);
  saveState(); renderPreservingCustomerScroll();
}

function quickUpdateCustomerField(customerId, fieldId, value) {
  const field = state.customFieldDefinitions.find(item => item.id === fieldId && item.active !== false);
  if (!field || !['SELECT', 'CHECKBOX'].includes(field.type)) { toast('Cột option không hợp lệ'); render(); return false; }
  const result = setCustomerCustomFields(customerId, { [fieldId]: value });
  if (result.error) { toast(result.error === 'FORBIDDEN' ? 'FORBIDDEN · không có quyền cập nhật cột này' : result.error); render(); return false; }
  if (!result.updated) return false;
  saveState(); renderPreservingCustomerScroll();
  return true;
}

function quickMultiSelectModal(customerId, fieldId) {
  const customer = customerById(customerId);
  const field = state.customFieldDefinitions.find(item => item.id === fieldId && item.active !== false && item.type === 'MULTI_SELECT');
  if (!field || !canViewCustomer(customer) || !canUpdateCustomer(customer)) { toast('FORBIDDEN · không có quyền chọn option'); return; }
  const selected = Array.isArray(customer.customFields?.[field.id]) ? customer.customFields[field.id] : [];
  openModal(`Chọn option · ${field.label}`, `<form id="quickMultiSelectForm"><div class="quick-option-list">${field.options.map(option => `<label><input type="checkbox" data-quick-multi-option value="${escapeHtml(option.value)}" ${selected.includes(option.value) ? 'checked' : ''}><span class="field-pill" style="--pill:${escapeHtml(option.color)}">${escapeHtml(option.label)}</span></label>`).join('')}</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Hủy</button><button class="button button-primary" type="submit">Lưu lựa chọn</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#quickMultiSelectForm').onsubmit = event => {
    event.preventDefault();
    const values = $$('[data-quick-multi-option]:checked').map(input => input.value);
    const result = setCustomerCustomFields(customerId, { [fieldId]: values });
    if (result.error) { toast(result.error); return; }
    if (result.updated) { saveState(); closeModal(); renderPreservingCustomerScroll(); }
    else { closeModal(); toast('Lựa chọn chưa thay đổi'); }
  };
}

function addCustomerNote(id) {
  const customer = customerById(id), text = $('#customerNote')?.value.trim();
  if (!canViewCustomer(customer) || !canUpdateCustomer(customer) || !text) { toast('Vui lòng nhập ghi chú hợp lệ'); return; }
  state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount.id, author: currentAccount.name, role: currentAccount.role, text: text.slice(0, 2000), at: stamp() });
  customer.note = text.slice(0, 2000);
  customer.updatedAt = stamp();
  audit('ADD_CUSTOMER_NOTE', customer.id, customer.note);
  saveState(); render(); openCustomerDrawer(id); toast('Đã thêm ghi chú để cả Team cùng xem');
}

function editCustomerNote(noteId) {
  const note = state.notes.find(item => item.id === noteId); const customer = note && customerById(note.customerId);
  if (!note || !customer || !canUpdateCustomer(customer)) { toast('Không có quyền sửa ghi chú'); return; }
  openModal('Sửa ghi chú', `<form id="editNoteForm"><label class="form-field">Nội dung<textarea id="editNoteText" rows="5" required>${escapeHtml(note.text)}</textarea></label><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Lưu thay đổi</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#editNoteForm').onsubmit = event => { event.preventDefault(); const text = $('#editNoteText').value.trim(); if (!text) return; note.text = text.slice(0, 2000); note.editedAt = stamp(); customer.note = note.text; customer.updatedAt = stamp(); audit('EDIT_CUSTOMER_NOTE', customer.id, note.id); saveState(); closeModal(); render(); openCustomerDrawer(customer.id); };
}

function deleteCustomerNote(noteId) {
  const note = state.notes.find(item => item.id === noteId); const customer = note && customerById(note.customerId);
  if (!note || !customer || !canUpdateCustomer(customer)) { toast('Không có quyền xóa ghi chú'); return; }
  if (!window.confirm('Xóa ghi chú này?')) return;
  state.notes = state.notes.filter(item => item.id !== noteId); customer.note = state.notes.find(item => item.customerId === customer.id)?.text || ''; customer.updatedAt = stamp(); audit('DELETE_CUSTOMER_NOTE', customer.id, noteId); saveState(); render(); openCustomerDrawer(customer.id);
}

function addCustomerFollowUp(id) {
  const customer = customerById(id);
  if (!canViewCustomer(customer) || !canUpdateCustomer(customer) || !customer.saleId) { toast('Khách cần được phân Sale trước khi tạo lịch'); return; }
  const type = $('#followUpType')?.value.trim(), rawDueAt = $('#followUpDueAt')?.value, dueAt = String(rawDueAt || '').replace('T', ' ').slice(0, 16);
  if (!type || !cleanTimestamp(dueAt)) { toast('Nội dung hoặc hạn xử lý không hợp lệ'); return; }
  state.tasks.unshift({ id: `TSK-${Date.now()}-${customer.id}`, customerId: customer.id, customerName: customer.name, ownerId: customer.saleId, leaderId: customer.leaderId, teamId: customer.teamId, type: type.slice(0, 160), createdAt: stamp(), dueAt, slaBased: false, status: dueAt < stamp() ? 'OVERDUE' : 'OPEN', priority: $('#followUpPriority')?.value === 'HIGH' ? 'HIGH' : 'NORMAL' });
  audit('ADD_FOLLOW_UP', customer.id, `${type} · ${dueAt}`);
  saveState(); render(); openCustomerDrawer(id); toast('Đã thêm lịch chăm sóc');
}

function openOrderDrawer(id) {
  const order = scopedOrders().find(item => item.id === id);
  if (!order) { toast('NOT_FOUND · đơn hàng nằm ngoài phạm vi'); return; }
  const product = productById(order.productId);
  const website = websiteById(order.websiteId);
  const attribution = currentAccount.role === 'ADMIN' ? `<dt>Nguồn / Campaign</dt><dd>${escapeHtml(order.source)} · ${escapeHtml(order.campaign || 'UNATTRIBUTED')}</dd><dt>Website / Landing</dt><dd>${escapeHtml(website ? `${website.name} · ${website.domain}` : 'Chưa quy nguồn')}</dd>` : '';
  openDrawer({ head: `<h2>${escapeHtml(order.code)}</h2><p>${escapeHtml(order.createdAt)}${currentAccount.role === 'ADMIN' ? ` · ${escapeHtml(order.source)} · ${escapeHtml(order.campaign || 'UNATTRIBUTED')}` : ''}</p>`, body: `<div class="section-label">Chi tiết đơn hàng</div><dl class="detail-grid"><dt>Khách hàng</dt><dd>${escapeHtml(order.customerName)}</dd>${attribution}<dt>Sản phẩm</dt><dd>${escapeHtml(order.productName)}</dd><dt>SKU / Số lượng</dt><dd>${escapeHtml(product?.sku || order.sku)} · ${escapeHtml(order.qty)}</dd><dt>Đơn giá</dt><dd>${money(order.unitPrice)}</dd><dt>Chiết khấu</dt><dd>${money(order.discount)}</dd><dt>Thành tiền</dt><dd>${money(order.total)}</dd><dt>Trạng thái</dt><dd>${statusBadge(order.status, 'order')}</dd><dt>Sale</dt><dd>${escapeHtml(staffName(order.saleId))}</dd></dl>${currentAccount.role === 'ADMIN' && order.status === 'PENDING' ? `<div class="modal-actions"><button class="button button-primary" data-mark-paid="${escapeHtml(order.id)}">Xác nhận thủ công đã thanh toán</button></div>` : ''}${currentAccount.role === 'ADMIN' && order.status === 'PAID' ? `<div class="modal-actions"><button class="button button-danger" data-refund-order="${escapeHtml(order.id)}">Ghi nhận hoàn tiền thủ công</button></div>` : ''}<div class="section-label">Dòng thời gian</div><div class="timeline"><div class="timeline-item"><b>Đơn được tạo</b><p>${escapeHtml(order.productName)} · SL ${escapeHtml(order.qty)}</p><small>${escapeHtml(order.createdAt)}</small></div>${order.paidAt ? `<div class="timeline-item"><b>Thanh toán thành công</b><p>${money(order.total)}</p><small>${escapeHtml(order.paidAt)}</small></div>` : ''}${order.refundedAt ? `<div class="timeline-item"><b>Đã hoàn tiền</b><p>${money(order.refund)} đã hoàn cho khách</p><small>${escapeHtml(order.refundedAt)}</small></div>` : ''}</div>` });
  $('[data-mark-paid]')?.addEventListener('click', () => changeOrderStatus(id, 'PAID'));
  $('[data-refund-order]')?.addEventListener('click', () => changeOrderStatus(id, 'REFUNDED'));
}

function changeOrderStatus(id, status) {
  const order = state.orders.find(item => item.id === id); if (!order) return; const edit = orderEditState(order); if (!edit.allowed) { toast('Đơn đã khóa chỉnh sửa sau 7 ngày'); return; } if (currentAccount.role !== 'ADMIN' && !canViewCustomer(customerById(order.customerId))) { toast('FORBIDDEN · ngoài phạm vi phụ trách'); return; }
  const validTransition = (status === 'PAID' && order.status === 'PENDING') || (status === 'REFUNDED' && order.status === 'PAID');
  if (!validTransition) { toast('Trạng thái đơn hàng không thể chuyển theo thao tác này'); return; }
  order.status = status;
  if (status === 'PAID') { order.paidAt = stamp(); order.refundedAt = null; order.refund = 0; order.paymentReconciled = false; order.refundReconciled = null; }
  if (status === 'REFUNDED') { order.refundedAt = stamp(); order.refund = order.total; order.refundReconciled = false; }
  if (status === 'PAID') {
    const customer = customerById(order.customerId);
    if (customer) { customer.status = 'PAID'; customer.updatedAt = stamp(); customer.note = `Đã thanh toán đơn ${order.code}`; state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount.id, author: currentAccount.name, role: currentAccount.role, text: customer.note, at: stamp() }); }
  }
  audit(status === 'PAID' ? 'PAYMENT_CONFIRMED' : 'ORDER_REFUNDED', order.id, `${order.code} · ${money(order.total)}`);
  saveState(); closeDrawer(); render(); toast(status === 'PAID' ? 'Đã ghi nhận thanh toán' : 'Đã ghi nhận hoàn tiền');
}

function normalizeCustomerPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  return digits;
}

function findDuplicateCustomer(record) {
  const phone = normalizeCustomerPhone(record?.phone || record?.mobile);
  if (phone) {
    const byPhone = state.customers.find(customer => normalizeCustomerPhone(customer.phone) === phone);
    if (byPhone) return byPhone;
  }
  const email = cleanText(record?.email, '', 254).trim().toLowerCase();
  return email ? state.customers.find(customer => customer.email && customer.email.trim().toLowerCase() === email) || null : null;
}

function customerHasRegisteredAccount(customer) {
  const registeredLevels = new Set(['L5', 'L6', 'L7', 'L8', 'L9', 'L10']);
  return registeredLevels.has(customer?.customFields?.customerLevel) || normalize(customer?.customFields?.result).includes(normalize('Đã mở tài khoản'));
}

function assignmentSnapshot(customer) {
  return {
    saleId: customer.saleId || null,
    saleName: state.members.find(member => member.id === customer.saleId)?.name || '',
    leaderId: customer.leaderId || null,
    leaderName: state.members.find(member => member.id === customer.leaderId)?.name || '',
    teamId: customer.teamId || null
  };
}

function recordAssignmentChange(customer, previous, reason, source = 'MANUAL', force = false) {
  const next = assignmentSnapshot(customer);
  // force = true cho đường offer: leader/team/saleId không đổi nhưng vẫn phải để lại vết
  // "đã mời sale nào nhận data" trong lịch sử phân data.
  if (!force && previous.saleId === next.saleId && previous.leaderId === next.leaderId && previous.teamId === next.teamId) return false;
  state.assignmentHistory.unshift({
    id: `ASN-${Date.now()}-${state.assignmentHistory.length}`,
    customerId: customer.id,
    fromSaleId: previous.saleId,
    fromSaleName: previous.saleName,
    toSaleId: next.saleId,
    toSaleName: next.saleName,
    fromLeaderId: previous.leaderId,
    fromLeaderName: previous.leaderName,
    toLeaderId: next.leaderId,
    toLeaderName: next.leaderName,
    teamId: next.teamId,
    actorId: currentAccount?.id || 'SYSTEM',
    actor: currentAccount?.name || 'Hệ thống',
    role: currentAccount?.role || 'SYSTEM',
    at: stamp(),
    reason,
    source
  });
  return true;
}

function previousSaleForCustomer(customerId) {
  const activeIds = new Set(activeStaff().filter(member => member.role === 'SALE').map(member => member.id));
  const event = state.assignmentHistory.filter(item => item.customerId === customerId && item.toSaleId && activeIds.has(item.toSaleId)).sort((a, b) => b.at.localeCompare(a.at))[0];
  return event ? activeStaff().find(member => member.id === event.toSaleId) || null : null;
}

function handleDuplicateSubmission(existing, incoming, context = {}) {
  const previousOwner = existing.saleId;
  const currentSale = activeStaff().find(member => member.role === 'SALE' && member.id === existing.saleId);
  const oldSale = currentSale || previousSaleForCustomer(existing.id);
  const source = dataTerminology(cleanText(incoming.source, context.sourceLabel || 'Form gửi lại', 120));
  const campaign = dataTerminology(cleanText(incoming.campaign, '', 160));
  const websiteId = websiteById(incoming.websiteId)?.id || null;
  const registeredAccount = customerHasRegisteredAccount(existing);
  if (oldSale && existing.saleId !== oldSale.id) {
    // Trả khách về đúng sale đã phụ trách trước đó — gán thẳng, không bắt sale nhận lại.
    applyCustomerAssignment(existing, oldSale, 'Khách điền lại form · trả về Sale đã phụ trách trước đó', context.intakeType || 'FORM', true);
  } else {
    existing.updatedAt = stamp();
    existing.note = oldSale ? `DATA TRÙNG · giữ Sale cũ ${oldSale.name}` : 'DATA TRÙNG · chưa có Sale cũ còn hoạt động';
    state.notes.unshift({ id: `NOTE-DUP-${Date.now()}-${existing.id}`, customerId: existing.id, authorId: currentAccount?.id || 'SYSTEM', author: currentAccount?.name || 'Hệ thống nhận data', role: currentAccount?.role || 'SYSTEM', text: existing.note, at: stamp() });
  }
  const event = {
    id: `RESUB-${Date.now()}-${state.resubmissions.length}`,
    customerId: existing.id,
    phone: normalizeCustomerPhone(incoming.phone),
    source,
    campaign,
    websiteId,
    previousSaleId: previousOwner || null,
    assignedSaleId: existing.saleId || null,
    registeredAccount,
    at: stamp(),
    intakeType: ['MANUAL', 'FORM', 'IMPORT', 'API'].includes(context.intakeType) ? context.intakeType : 'FORM'
  };
  state.resubmissions.unshift(event);
  if (oldSale) state.notifications.unshift({ id: `NT-DUP-${Date.now()}-${existing.id}`, role: 'OWN', saleId: oldSale.id, title: registeredAccount ? 'DATA TRÙNG - DATA đã đăng ký TK' : 'Khách cũ điền lại form', text: `${existing.name} · ${existing.phone} · tiếp tục do bạn phụ trách`, at: stamp(), readBy: [] });
  audit('DUPLICATE_SUBMISSION', existing.id, `${registeredAccount ? 'DATA đã đăng ký TK' : 'Khách điền lại'} · ${oldSale ? `giữ ${oldSale.name}` : 'chưa có Sale cũ'}`);
  const ownerCopy = oldSale ? ` · giữ Sale ${oldSale.name}` : ' · chưa có Sale cũ còn hoạt động';
  return { duplicate: true, customer: existing, message: `${registeredAccount ? 'DATA TRÙNG - DATA đã đăng ký TK' : 'DATA TRÙNG'}${ownerCopy}` };
}

function ingestCustomer(record, context = {}) {
  if (!record || typeof record !== 'object') return { created: false, error: 'Dữ liệu khách hàng không hợp lệ' };
  const phone = normalizeCustomerPhone(record.phone || record.mobile);
  const duplicate = findDuplicateCustomer({ ...record, phone });
  if (duplicate) return handleDuplicateSubmission(duplicate, { ...record, phone }, context);
  const name = cleanText(record.name || record.fullName || record.customer, '', 160).trim();
  const website = websiteById(cleanId(record.websiteId));
  if (!name || phone.length < 9 || phone.length > 11) return { created: false, error: 'Tên hoặc số điện thoại không hợp lệ' };
  if (!website) return { created: false, error: 'Landing page nguồn không hợp lệ' };
  const customFields = Object.fromEntries(state.customFieldDefinitions.map(field => [field.id, sanitizeCustomFieldValue(record.customFields?.[field.id] ?? defaultCustomFieldValue(field), field)]));
  const customer = {
    id: cleanId(record.id) && !state.customers.some(item => item.id === record.id) ? record.id : `CUS-${Date.now()}-${state.customers.length}`,
    name,
    phone,
    email: cleanText(record.email, '', 254).trim(),
    ipAddress: cleanText(record.ipAddress || record.ip, 'Chưa xác định', 64),
    source: dataTerminology(cleanText(record.source, context.sourceLabel || 'Nhập thủ công', 120)),
    campaign: dataTerminology(cleanText(record.campaign, 'MANUAL-CRM', 160)),
    landingPageName: cleanText(record.landingPageName || record.landingPage || website.domain, website.domain, 200),
    productName: cleanText(record.productName || record.product || record.sanpham, 'Chưa xác định sản phẩm', 200),
    websiteId: website.id,
    status: Object.hasOwn(STATUS_META, record.status) ? record.status : 'NEW',
    saleId: null,
    leaderId: null,
    teamId: null,
    createdAt: stamp(),
    updatedAt: stamp(),
    note: dataTerminology(cleanText(record.note, `Data từ ${website.domain}`, 2000)),
    customFields
  };
  state.customers.unshift(customer);
  state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount?.id || 'SYSTEM', author: currentAccount?.name || 'Hệ thống nhận data', role: currentAccount?.role || 'SYSTEM', text: customer.note, at: stamp() });
  state.customFieldDefinitions.forEach(field => {
    const value = customer.customFields[field.id];
    const empty = value === '' || value === false || (Array.isArray(value) && !value.length);
    if (!empty || field.id === 'customerLevel') recordFieldChange(customer, field, '', value, context.intakeType === 'API' ? 'API' : context.intakeType === 'FORM' ? 'FORM' : context.intakeType === 'IMPORT' ? 'IMPORT' : 'MANUAL');
  });
  if (currentAccount?.role === 'SALE') applyCustomerAssignment(customer, activeStaff().find(member => member.id === currentAccount.saleId), 'Sale tạo khách trực tiếp', 'MANUAL');
  else if (currentAccount?.role === 'LEADER') applyCustomerAssignment(customer, activeStaff().find(member => member.id === currentAccount.leaderId), 'Leader tạo khách trong Team', 'MANUAL');
  else autoAssignCustomer(customer);
  createInitialTask(customer);
  audit('CREATE_CUSTOMER', customer.id, `Tạo khách ${name} · ${website.domain}`);
  return { created: true, duplicate: false, customer, message: 'Đã tạo khách hàng mới' };
}

function newCustomerModal() {
  const availableWebsites = state.websites;
  if (!availableWebsites.length) { toast('Hãy tạo website/landing page nguồn trước khi thêm khách'); return; }
  openModal('Thêm khách hàng', `<form id="newCustomerForm"><div class="form-grid"><label class="form-field">Họ tên<input id="newCustomerName" required></label><label class="form-field">Số điện thoại<input id="newCustomerPhone" type="tel" required></label><label class="form-field">Email<input id="newCustomerEmail" type="email"></label><label class="form-field">Landing page nguồn<select id="newCustomerWebsite">${availableWebsites.map(website => `<option value="${escapeHtml(website.id)}">${escapeHtml(website.name)} · ${escapeHtml(website.domain)}</option>`).join('')}</select></label><label class="form-field">Kênh data<select id="newCustomerSource">${TRAFFIC_META.map(source => `<option>${escapeHtml(source.source)}</option>`).join('')}</select></label><label class="form-field full">Nhu cầu / ghi chú<textarea id="newCustomerNote" rows="3"></textarea></label></div><div class="credential-hint">Đây là nhập thủ công; trạng thái bật/tắt API của landing page không ảnh hưởng thao tác này.</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Tạo khách hàng</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#newCustomerForm').onsubmit = async event => {
    event.preventDefault();
    // Sale tự tạo khách là luồng ĐƯỢC ghi IP (khác landing page: không lấy IP).
    await refreshSessionContext();
    const result = ingestCustomer({ name: $('#newCustomerName').value.trim(), phone: $('#newCustomerPhone').value, email: $('#newCustomerEmail').value.trim(), ipAddress: sessionContextIp, source: $('#newCustomerSource').value, campaign: 'MANUAL-CRM', websiteId: $('#newCustomerWebsite').value, note: $('#newCustomerNote').value.trim() }, { intakeType: 'MANUAL', sourceLabel: 'Nhập thủ công' });
    if (!result.created && !result.duplicate) { toast(result.error); return; }
    saveState(); closeModal(); render(); toast(result.message);
  };
}

function addImportedCustomers(records, sourceLabel) {
  if (currentAccount.role !== 'ADMIN' || !Array.isArray(records)) return 0;
  let imported = 0;
  let duplicates = 0;
  let registeredDuplicates = 0;
  records.slice(0, 250).forEach((record, index) => {
    const requestedWebsite = record.websiteId
      ? websiteById(cleanId(record.websiteId))
      : state.websites.find(website => normalize(website.domain) === normalize(record.websiteDomain || record.landingPage || ''));
    const website = requestedWebsite;
    if (!website) return;
    const result = ingestCustomer({ ...record, id: `CUS-IMP-${Date.now()}-${index}`, websiteId: website.id, source: cleanText(record.source, sourceLabel, 120), campaign: cleanText(record.campaign, 'IMPORTED-DATA', 160), note: `Nhập từ ${sourceLabel} · ${website.domain}` }, { intakeType: 'IMPORT', sourceLabel });
    if (result.created) imported += 1;
    if (result.duplicate) { duplicates += 1; if (result.customer && customerHasRegisteredAccount(result.customer)) registeredDuplicates += 1; }
  });
  lastImportStats = { created: imported, duplicates, registeredDuplicates };
  return imported;
}

function recordCustomerImport(source, filename, records, status = 'SUCCESS') {
  state.imports.unshift({ id: `IMP-${Date.now()}-${state.imports.length}`, source, filename, records, importedAt: stamp(), actor: currentAccount.name, status });
  state.imports = state.imports.slice(0, 30);
  audit('IMPORT_CUSTOMERS', 'CUSTOMERS', `${source} · ${filename} · ${records} khách`);
}

function customerImportModal() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được kết nối nguồn data'); return; }
  // Thẻ SUBDATA bị ẩn cùng mục Tích hợp; chỉ giữ đường nhập file CSV/JSON.
  openModal('Kết nối & cập nhật data', `<div class="import-grid"><section class="import-card"><span class="eyebrow">FILE IMPORT</span><h3>Tải CSV hoặc JSON</h3><p>CSV/JSON được đọc trực tiếp và kiểm tra trùng số điện thoại. PDF cần dịch vụ OCR/parser backend trước khi nhập.</p><form id="customerFileImportForm"><label class="file-drop">Chọn file dữ liệu<input id="customerImportFile" type="file" accept=".csv,.json,.pdf,application/pdf,text/csv,application/json" required><span>CSV · JSON tối đa 250 bản ghi/lần; PDF cần backend</span></label><button class="button button-primary button-block" type="submit">Kiểm tra & cập nhật data</button></form></section></div><div class="credential-hint">Mỗi bản ghi phải có websiteId hoặc landingPage/domain hợp lệ. Hệ thống không tự gán bản ghi thiếu nguồn sang Website A.</div>`);
  // Nút Subdata không còn trong modal; chỉ bind khi thẻ được khôi phục để không ném lỗi.
  const subdataIntegrationButton = $('#openSubdataIntegration');
  if (subdataIntegrationButton) subdataIntegrationButton.onclick = () => { closeModal(); currentView = 'integrations'; render(); const item = state.integrations.find(integration => integration.provider === 'SUBDATA' && !integration.archived); configureIntegrationModal(item?.id || null); };
  $('#customerFileImportForm').onsubmit = event => {
    event.preventDefault();
    const file = $('#customerImportFile')?.files?.[0];
    if (!file) { toast('Hãy chọn file PDF, CSV hoặc JSON'); return; }
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'csv', 'json'].includes(extension)) { toast('Định dạng file chưa được hỗ trợ'); return; }
    const finish = records => {
      const imported = addImportedCustomers(records, extension === 'pdf' ? 'PDF Import' : `File ${extension.toUpperCase()}`);
      recordCustomerImport(extension.toUpperCase(), file.name, imported);
      saveState(); closeModal(); currentView = 'distribution'; distributionTab = 'QUEUE'; render(); toast(`Đã thêm ${imported} khách · ${lastImportStats.duplicates} DATA TRÙNG${lastImportStats.registeredDuplicates ? ` (${lastImportStats.registeredDuplicates} đã đăng ký TK)` : ''}`);
    };
    if (extension === 'pdf') { recordCustomerImport('PDF', file.name, 0, 'FAILED'); saveState(); toast('PDF chưa được nhập: cần backend OCR/parser trả dữ liệu có cấu trúc'); return; }
    const reader = new FileReader();
    reader.onerror = () => toast('Không thể đọc file đã chọn');
    reader.onload = () => {
      try {
        if (extension === 'json') { const data = JSON.parse(String(reader.result)); finish(Array.isArray(data) ? data : data.customers || []); return; }
        const lines = String(reader.result).split(/\r?\n/).filter(Boolean), headers = lines.shift().split(',').map(value => normalize(value));
        finish(lines.map(line => { const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, '')); const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])); return { name: row.name || row.fullname || row.hoten || row.tenkhachhang, phone: row.phone || row.mobile || row.sodienthoai || row.sdt, email: row.email, source: row.source || row.nguon, campaign: row.campaign || row.chiendich, websiteId: row.websiteid, websiteDomain: row.landingpage || row.domain }; }));
      } catch (error) { toast('File không đúng cấu trúc dữ liệu'); }
    };
    reader.readAsText(file, 'utf-8');
  };
}

function editOrderModal(id) {
  const order = state.orders.find(item => item.id === id); const access = order && orderEditState(order);
  if (!order || !access?.allowed || !canViewCustomer(customerById(order.customerId))) { toast('Đơn hàng đã khóa hoặc nằm ngoài phạm vi'); return; }
  openModal('Sửa đơn hàng', `<form id="editOrderForm"><label class="form-field">Sản phẩm<select id="editOrderProduct">${PRODUCTS.map(product => `<option value="${escapeHtml(product.id)}" ${product.id === order.productId ? 'selected' : ''}>${escapeHtml(product.name)} · ${money(product.price)}</option>`).join('')}</select></label><label class="form-field" style="margin-top:12px">Số lượng<input id="editOrderQty" type="number" min="1" max="10" value="${order.qty}"></label><div class="modal-actions"><button class="button" type="button" data-close-modal>Hủy</button><button class="button button-primary" type="submit">Lưu thay đổi</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#editOrderForm').onsubmit = event => { event.preventDefault(); const product = productById($('#editOrderProduct').value), qty = Number($('#editOrderQty').value); if (!product || !Number.isInteger(qty) || qty < 1 || qty > 10) { toast('Sản phẩm hoặc số lượng không hợp lệ'); return; } const previous = { productId: order.productId, qty: order.qty, total: order.total }; order.productId = product.id; order.productName = product.name; order.sku = product.sku; order.qty = qty; order.unitPrice = product.price; order.subtotal = product.price * qty; order.total = order.subtotal - order.discount; audit('EDIT_ORDER', order.id, `${previous.productId} · ${previous.qty} → ${product.id} · ${qty}`); saveState(); closeModal(); render(); };
}

function deleteOrder(id) {
  const order = state.orders.find(item => item.id === id); const access = order && orderEditState(order);
  if (!order || !access?.allowed || !canViewCustomer(customerById(order.customerId))) { toast('Đơn hàng đã khóa hoặc nằm ngoài phạm vi'); return; }
  if (!window.confirm(`Xóa đơn ${order.code}?`)) return;
  state.orders = state.orders.filter(item => item.id !== id); audit('DELETE_ORDER', id, order.code); saveState(); render();
}

function newOrderModal(customerId = '') {
  const customers = scopedCustomers().filter(customer => customer.saleId);
  PRODUCTS = Array.isArray(state.products) && state.products.length ? state.products : PRODUCTS;
  const availableProducts = PRODUCTS.filter(product => product.active !== false);
  if (!customers.length) { toast('Chưa có khách được phân Sale để tạo đơn hàng'); return; }
  if (!availableProducts.length) { toast('Chưa có sản phẩm đang bán. Admin hãy tạo sản phẩm trước.'); return; }
  openModal('Tạo đơn hàng', `<form id="newOrderForm"><div class="form-grid"><label class="form-field">Khách hàng<select id="newOrderCustomer">${customers.map(customer => `<option value="${escapeHtml(customer.id)}" ${customer.id === customerId ? 'selected' : ''}>${escapeHtml(customer.name)} · ${escapeHtml(customer.phone)}</option>`).join('')}</select></label><label class="form-field">Sản phẩm<select id="newOrderProduct">${availableProducts.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${money(product.price)}</option>`).join('')}</select></label><label class="form-field">Số lượng<input id="newOrderQty" type="number" min="1" max="10" value="1"></label></div><div class="form-hint">Đơn mới ở trạng thái Chờ thanh toán.</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Tạo đơn</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#newOrderForm').onsubmit = event => { event.preventDefault(); const customer = customerById($('#newOrderCustomer').value), product = productById($('#newOrderProduct').value), requestedQty = Number($('#newOrderQty').value), qty = Math.floor(requestedQty); if (!customer || !canViewCustomer(customer) || !customer.saleId || !product || !Number.isFinite(requestedQty) || qty !== requestedQty || qty < 1 || qty > 10) { toast('Dữ liệu đơn hàng không hợp lệ'); return; } const id = `ORD-${Date.now()}`; const order = { id, code: `NVT-2609-${String(state.orders.length + 1200)}`, customerId: customer.id, customerName: customer.name, saleId: customer.saleId, leaderId: customer.leaderId, teamId: customer.teamId, source: orderSource(customer.source), campaign: customer.campaign || 'UNATTRIBUTED', websiteId: customer.websiteId || null, productId: product.id, productName: product.name, sku: product.sku, qty, unitPrice: product.price, subtotal: product.price * qty, discount: 0, total: product.price * qty, refund: 0, status: 'PENDING', createdAt: stamp(), paidAt: null, refundedAt: null, paymentReconciled: false, refundReconciled: null }; state.orders.unshift(order); audit('CREATE_ORDER', id, `${order.code} · ${order.productName}`); saveState(); closeModal(); render(); toast('Đã tạo đơn chờ thanh toán'); };
}

function assignmentCandidates(customer) {
  if (customer.leaderId) {
    const config = state.saleDistributionByLeader[customer.leaderId] || { enabledSaleIds: [] };
    const enabledIds = new Set(config.enabledSaleIds);
    return activeStaff().filter(person => person.role === 'SALE' && person.leaderId === customer.leaderId && person.teamId === customer.teamId && enabledIds.has(person.id)).sort((a, b) => a.id.localeCompare(b.id));
  }
  const enabledIds = new Set(state.leaderDistribution.enabledLeaderIds);
  return activeStaff().filter(person => person.role === 'LEADER' && enabledIds.has(person.id)).sort((a, b) => a.id.localeCompare(b.id));
}

function assignmentModeFor(customer) {
  return customer.leaderId ? state.settings.saleAssignmentModes[customer.leaderId] || 'MANUAL' : state.settings.assignmentMode;
}

function assignmentLoad(person) {
  if (person.role === 'LEADER') return state.customers.filter(customer => customer.leaderId === person.id).length;
  return state.customers.filter(customer => customer.saleId === person.id && customer.leaderId === person.leaderId && customer.teamId === person.teamId).length;
}

function assignmentWeight(person) {
  if (person.role === 'LEADER') return state.leaderDistribution.weights[person.id] || 1;
  return state.saleDistributionByLeader[person.leaderId]?.weights?.[person.id] || 1;
}

function matchingLeaderSourceRule(customer) {
  return state.leaderDistribution.sourceRules.find(rule => {
    if (rule.active === false || !state.leaderDistribution.enabledLeaderIds.includes(rule.targetLeaderId)) return false;
    if (rule.matchType === 'WEBSITE') return customer.websiteId === rule.matchValue;
    if (rule.matchType === 'SOURCE') return normalize(customer.source) === normalize(rule.matchValue);
    return normalize(customer.campaign) === normalize(rule.matchValue);
  }) || null;
}

function weightedCandidateList(candidates) {
  return candidates.flatMap(candidate => Array.from({ length: assignmentWeight(candidate) }, () => candidate));
}

function chooseAssignmentTarget(customer, mode) {
  const candidates = assignmentCandidates(customer);
  if (!candidates.length) return null;
  if (!customer.leaderId) {
    const rule = matchingLeaderSourceRule(customer);
    const target = rule && candidates.find(candidate => candidate.id === rule.targetLeaderId);
    if (target) return target;
  }
  if (!['ROUND_ROBIN', 'BALANCED'].includes(mode)) return null;
  if (mode === 'BALANCED') return candidates.slice().sort((a, b) => assignmentLoad(a) / assignmentWeight(a) - assignmentLoad(b) / assignmentWeight(b) || a.id.localeCompare(b.id))[0];
  const weighted = weightedCandidateList(candidates);
  if (customer.leaderId) {
    const key = customer.leaderId;
    const cursor = state.settings.assignmentCursor.salesByTeam[key] || 0;
    const target = weighted[cursor % weighted.length];
    state.settings.assignmentCursor.salesByTeam[key] = (cursor + 1) % weighted.length;
    return target;
  }
  const cursor = state.settings.assignmentCursor.leaders || 0;
  const target = weighted[cursor % weighted.length];
  state.settings.assignmentCursor.leaders = (cursor + 1) % weighted.length;
  return target;
}

/* Nhận data hai bước: mọi đường gán SALE đều đi qua đây. Sale đang giữ khách,
   resubmission trả về sale cũ (direct = true) hoặc sale tự tạo khách thì gán thẳng;
   còn lại khách vào team của leader ngay nhưng saleId để null kèm một offer PENDING —
   sale phải bấm "Nhận data" trong mục Data chờ nhận thì khách mới thật sự đổ về. */
function offerOrAssignSale(customer, target, reason, source, previous, direct = false) {
  if (direct || customer.saleId === target.id || target.id === currentAccount?.saleId) {
    customer.saleId = target.id;
    customer.leaderId = target.leaderId;
    customer.teamId = target.teamId;
    // Sale tự tạo khách thì coi như đã nhận ngay; đường gán thẳng khác vẫn để sale bấm "Nhận data" trong bảng.
    if (target.id === currentAccount?.saleId) customer.saleAcceptedAt = stamp();
    createInitialTask(customer);
    state.notifications.unshift({ id: `NT-${Date.now()}-${customer.id}`, role: 'OWN', saleId: target.id, title: 'Bạn vừa nhận data mới', text: `${customer.name} · ${customer.phone}`, at: stamp(), readBy: [] });
    customer.updatedAt = stamp();
    customer.note = reason;
    state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}-${target.id}`, customerId: customer.id, authorId: currentAccount?.id || 'SYSTEM', author: currentAccount?.name || 'Hệ thống phân data', role: currentAccount?.role || 'SYSTEM', text: `${reason} · ${target.name}`, at: stamp() });
    recordAssignmentChange(customer, previous, reason, source);
    return true;
  }
  const hours = state.settings.acceptTimeoutHours || 8;
  // Khách chỉ được có một lời mời đang chờ: leader chia lại cho sale khác thì huỷ lời mời cũ.
  state.dataOffers.forEach(offer => {
    if (offer.status === 'PENDING' && offer.customerId === customer.id) { offer.status = 'EXPIRED'; offer.resolvedAt = stamp(); }
  });
  customer.saleId = null;
  customer.leaderId = target.leaderId;
  customer.teamId = target.teamId;
  state.dataOffers.unshift({ id: `OFR-${Date.now()}-${customer.id}`, customerId: customer.id, saleId: target.id, leaderId: target.leaderId, teamId: target.teamId, offeredAt: stamp(), status: 'PENDING', resolvedAt: '', source });
  state.notifications.unshift({ id: `NT-OFFER-${Date.now()}-${customer.id}`, role: 'OWN', saleId: target.id, title: 'Có data chờ bạn nhận', text: `${customer.name} · nhận trong ${hours} giờ`, at: stamp(), readBy: [] });
  customer.updatedAt = stamp();
  customer.note = reason;
  state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}-${target.id}`, customerId: customer.id, authorId: currentAccount?.id || 'SYSTEM', author: currentAccount?.name || 'Hệ thống phân data', role: currentAccount?.role || 'SYSTEM', text: `${reason} · chờ ${target.name} nhận`, at: stamp() });
  recordAssignmentChange(customer, previous, `${reason} · chờ ${target.name} nhận`, 'OFFER', true);
  audit('OFFER_DATA', customer.id, `${target.name} · chờ nhận ${hours}h`);
  return true;
}

function pendingOffersForMe() {
  return state.dataOffers.filter(item => item.status === 'PENDING' && item.saleId === currentAccount.saleId).sort((a, b) => a.offeredAt.localeCompare(b.offeredAt) || a.id.localeCompare(b.id));
}

function pendingOfferCount() {
  return currentAccount && currentAccount.role === 'SALE' ? pendingOffersForMe().length : 0;
}

function offerDeadlineMs() {
  return (state.settings.acceptTimeoutHours || 8) * 3600000;
}

function offerMinutesLeft(offer) {
  const offeredMs = Date.parse(`${String(offer.offeredAt).replace(' ', 'T')}+07:00`);
  if (!Number.isFinite(offeredMs)) return 0;
  return Math.max(0, Math.round((offerDeadlineMs() - (Date.now() - offeredMs)) / 60000));
}

function acceptQueueView() {
  if (currentAccount.role !== 'SALE') return accessDeniedView('Hàng chờ nhận data chỉ dành cho Sale.');
  const offers = pendingOffersForMe();
  const hours = state.settings.acceptTimeoutHours || 8;
  return pageHead('Data chờ nhận', '', '') +
    `<section class="panel"><div class="panel-head"><div><div class="panel-title">Data chờ bạn nhận</div><div class="panel-sub">Quá ${hours} giờ không nhận, khách tự trả về leader để chia sale khác</div></div></div><div class="panel-body">${offers.map(offer => { const customer = customerById(offer.customerId); if (!customer) return ''; const left = offerMinutesLeft(offer); return `<div class="rank-row" style="grid-template-columns:minmax(0,1fr) auto auto"><div><b>${escapeHtml(customer.name)}</b><small>${escapeHtml(customer.id)} · •••••</small><div class="cell-sub">Gửi lúc ${escapeHtml(offer.offeredAt)} · còn ${Math.floor(left / 60)} giờ ${left % 60} phút</div></div>${statusBadge(customer.status)}<button class="button button-small button-primary" type="button" data-accept-offer="${escapeHtml(offer.id)}">Nhận data</button></div>`; }).join('') || '<div class="empty"><b>Không có data chờ nhận</b><span>Leader chia data mới sẽ hiện ở đây kèm đồng hồ đếm ngược.</span></div>'}</div></section>`;
}

function acceptDataOffer(offerId) {
  if (currentAccount.role !== 'SALE') { toast('FORBIDDEN · chỉ Sale được nhận data'); return; }
  const offer = state.dataOffers.find(item => item.id === offerId);
  if (!offer || offer.status !== 'PENDING') { toast('Data này không còn chờ nhận'); render(); return; }
  if (offer.saleId !== currentAccount.saleId) { toast('FORBIDDEN · data không dành cho bạn'); return; }
  const customer = customerById(offer.customerId);
  if (!customer) { toast('Khách không tồn tại'); return; }
  customer.saleId = offer.saleId;
  customer.leaderId = offer.leaderId;
  customer.teamId = offer.teamId;
  customer.saleAcceptedAt = stamp();
  customer.updatedAt = stamp();
  createInitialTask(customer);
  offer.status = 'ACCEPTED';
  offer.resolvedAt = stamp();
  state.notifications.unshift({ id: `NT-ACCEPT-${Date.now()}-${customer.id}`, role: 'LEADER', leaderId: offer.leaderId, teamId: offer.teamId, title: 'Sale đã nhận data', text: `${currentAccount.name} nhận ${customer.name} · ${customer.phone}`, at: stamp(), readBy: [] });
  audit('ACCEPT_DATA', customer.id, `${currentAccount.name} nhận từ hàng chờ`);
  saveState(); render(); toast(`Đã nhận data ${customer.name}`);
}

/* Quét định kỳ: offer quá hạn thì khách GIỮ leader/team và saleId null — tức trả về
   đúng leader đã chia để leader chọn sale khác, không đẩy lên phễu Admin. */
function expireStaleOffers() {
  if (!currentAccount) return false;
  const hours = state.settings.acceptTimeoutHours || 8;
  let changed = false;
  state.dataOffers.forEach(offer => {
    if (offer.status !== 'PENDING' || offerMinutesLeft(offer) > 0) return;
    offer.status = 'EXPIRED';
    offer.resolvedAt = stamp();
    const customer = customerById(offer.customerId);
    if (customer && !customer.saleId) {
      customer.leaderId = offer.leaderId;
      customer.teamId = offer.teamId;
      customer.updatedAt = stamp();
      customer.note = 'Sale chưa nhận kịp hạn · trả về leader chia lại';
    }
    state.notifications.unshift({ id: `NT-EXPIRE-${offer.id}`, role: 'LEADER', leaderId: offer.leaderId, teamId: offer.teamId, title: 'Sale chưa nhận data kịp hạn', text: `${customer ? customer.name : offer.customerId} quá ${hours} giờ · trả về bạn chia sale khác`, at: stamp(), readBy: [] });
    audit('EXPIRE_DATA_OFFER', offer.customerId, `${offer.saleId} quá hạn ${hours}h`);
    changed = true;
  });
  if (changed) { saveState(); render(); }
  return changed;
}

function applyCustomerAssignment(customer, target, reason, source = 'MANUAL', direct = false) {
  if (!customer || !target) return false;
  const previous = assignmentSnapshot(customer);
  if (target.role === 'LEADER') {
    customer.saleId = null;
    customer.leaderId = target.id;
    customer.teamId = target.teamId;
    state.notifications.unshift({ id: `NT-${Date.now()}-${customer.id}`, role: 'LEADER', leaderId: target.id, teamId: target.teamId, title: 'Khách mới trong Team', text: `${customer.name} · ${customerLandingName(customer)}`, at: stamp(), readBy: [] });
    customer.updatedAt = stamp();
    customer.note = reason;
    state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}-${target.id}`, customerId: customer.id, authorId: currentAccount?.id || 'SYSTEM', author: currentAccount?.name || 'Hệ thống phân data', role: currentAccount?.role || 'SYSTEM', text: `${reason} · ${target.name}`, at: stamp() });
    recordAssignmentChange(customer, previous, reason, source);
    return true;
  }
  return offerOrAssignSale(customer, target, reason, source, previous, direct);
}

function autoAssignCustomer(customer) {
  if (!customer || customer.saleId) return false;
  if (!customer.leaderId && !state.leaderDistribution.enabled) return false;
  const mode = assignmentModeFor(customer);
  const target = chooseAssignmentTarget(customer, mode);
  if (!target) return false;
  return applyCustomerAssignment(customer, target, `${mode === 'ROUND_ROBIN' ? 'Phân lần lượt' : 'Phân cân bằng'} tự động`);
}

function setAssignmentMode(mode) {
  if (!['ADMIN', 'LEADER'].includes(currentAccount.role) || !['MANUAL', 'ROUND_ROBIN', 'BALANCED'].includes(mode)) { toast('Chế độ phân data không hợp lệ'); return; }
  if (currentAccount.role === 'ADMIN') state.settings.assignmentMode = mode;
  else state.settings.saleAssignmentModes[currentAccount.leaderId] = mode;
  audit('UPDATE_ASSIGNMENT_MODE', currentAccount.role === 'ADMIN' ? 'LEADERS' : currentAccount.leaderId, mode);
  saveState(); render(); toast('Đã cập nhật chế độ phân data mới');
}

function bulkDistributePool(mode) {
  if (!['ADMIN', 'LEADER'].includes(currentAccount.role) || !['ROUND_ROBIN', 'BALANCED'].includes(mode)) { toast('Không có quyền chia data'); return; }
  const pool = scopedCustomers().filter(isPoolCustomer).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  let distributed = 0;
  pool.forEach(customer => {
    const target = chooseAssignmentTarget(customer, mode);
    if (target && applyCustomerAssignment(customer, target, mode === 'ROUND_ROBIN' ? 'Chia lần lượt toàn bộ' : 'Chia đều toàn bộ')) {
      audit(target.role === 'LEADER' ? 'ALLOCATE_TO_LEADER' : 'ASSIGN_TO_SALE', customer.id, `${target.name} · ${mode}`);
      distributed += 1;
    }
  });
  selectedPoolIds.clear();
  saveState(); render(); toast(distributed ? `Đã phân ${distributed} data theo chế độ ${mode === 'ROUND_ROBIN' ? 'lần lượt' : 'cân bằng'}` : 'Không có data hoặc nhân sự phù hợp để phân');
}

function createInitialTask(customer) {
  if (!customer.saleId || state.tasks.some(task => task.status !== 'DONE' && taskMatchesCustomerAssignment(task, customer))) return;
  const createdAt = stamp();
  state.tasks.unshift({ id: `TSK-${Date.now()}-${customer.id}`, customerId: customer.id, customerName: customer.name, ownerId: customer.saleId, leaderId: customer.leaderId, teamId: customer.teamId, type: 'Liên hệ data mới', createdAt, dueAt: shiftStamp(createdAt, state.settings.slaMinutes), slaBased: true, status: 'OPEN', priority: 'HIGH' });
}

function completeTask(id) {
  const task = scopedTasks().find(item => item.id === id);
  if (!task || task.status === 'DONE') { toast('Lịch chăm sóc không tồn tại hoặc đã hoàn tất'); return; }
  task.status = 'DONE';
  task.completedAt = stamp();
  const customer = customerById(task.customerId);
  if (customer && canViewCustomer(customer)) {
    customer.updatedAt = stamp();
    customer.note = `Đã hoàn tất: ${task.type}`;
    state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount.id, author: currentAccount.name, role: currentAccount.role, text: customer.note, at: stamp() });
  }
  audit('COMPLETE_TASK', task.id, `${task.type} · ${task.customerName}`);
  saveState();
  render();
  if (customer && currentView === 'customers') openCustomerDrawer(customer.id);
  toast('Đã hoàn tất công việc và cập nhật timeline');
}

function assignSelectedPool() {
  if (!['ADMIN', 'LEADER'].includes(currentAccount.role)) { toast('FORBIDDEN · không có quyền phân data'); return; }
  const stayInDistribution = currentView === 'distribution';
  const visiblePool = new Map(scopedCustomers().filter(isPoolCustomer).map(customer => [customer.id, customer]));
  const customers = Array.from(selectedPoolIds).map(id => visiblePool.get(id)).filter(Boolean);
  if (!customers.length) { toast('Hãy chọn ít nhất một data trong phạm vi'); return; }
  const targetId = $('#poolTarget')?.value;
  const target = currentAccount.role === 'ADMIN'
    ? assignmentCandidates({ leaderId: null }).find(person => person.id === targetId)
    : assignmentCandidates({ leaderId: currentAccount.leaderId, teamId: currentAccount.teamId }).find(person => person.id === targetId);
  if (!target) { toast('Người nhận không hợp lệ hoặc nằm ngoài phạm vi'); return; }
  const reason = $('#poolReason')?.value.trim() || 'Phân bổ từ Khách mới';
  customers.forEach(customer => {
    applyCustomerAssignment(customer, target, reason);
    audit(currentAccount.role === 'ADMIN' ? 'ALLOCATE_TO_LEADER' : 'ASSIGN_TO_SALE', customer.id, `${target.name} · ${reason}`);
  });
  selectedPoolIds.clear();
  saveState();
  currentView = stayInDistribution ? 'distribution' : 'customers';
  if (stayInDistribution) distributionTab = 'QUEUE';
  render();
  toast(`Đã phân ${customers.length} data cho ${target.name}${stayInDistribution ? ' theo đúng thứ tự hàng chờ' : ' và chuyển sang Khách hàng tổng'}`);
}

function taskMatchesCustomerAssignment(task, customer) {
  return task.customerId === customer.id && task.ownerId === customer.saleId && task.leaderId === customer.leaderId && task.teamId === customer.teamId;
}

function closeOpenCustomerTasks(customer, resolution) {
  state.tasks.filter(task => task.status !== 'DONE' && taskMatchesCustomerAssignment(task, customer)).forEach(task => {
    task.status = 'DONE';
    task.completedAt = stamp();
    task.resolution = resolution;
  });
}

function reassignCustomer(id, targetId) {
  if (!['ADMIN', 'LEADER'].includes(currentAccount.role)) { toast('FORBIDDEN · không có quyền phân khách'); return; }
  const customer = customerById(id);
  if (!canViewCustomer(customer)) { toast('NOT_FOUND · khách hàng nằm ngoài phạm vi'); return; }
  const target = currentAccount.role === 'ADMIN'
    ? assignmentCandidates({ leaderId: null }).find(person => person.id === targetId)
    : assignmentCandidates({ leaderId: currentAccount.leaderId, teamId: currentAccount.teamId }).find(person => person.id === targetId);
  if (!target) { toast('Người nhận không hợp lệ hoặc nằm ngoài phạm vi'); return; }
  const previous = assignmentSnapshot(customer);
  if (currentAccount.role === 'ADMIN') {
    if (customer.saleId && !window.confirm('Khách đang có Sale phụ trách. Chuyển Leader sẽ thu hồi khách khỏi Sale hiện tại. Tiếp tục?')) return;
    closeOpenCustomerTasks(customer, 'TRANSFERRED_TO_LEADER');
    customer.saleId = null;
    customer.leaderId = target.id;
    customer.teamId = target.teamId;
    state.notifications.unshift({ id: `NT-${Date.now()}-${customer.id}`, role: 'LEADER', leaderId: target.id, teamId: target.teamId, title: 'Khách được chuyển vào Team', text: `${customer.name} vừa được giao cho ${target.name}.`, at: stamp(), readBy: [] });
  } else {
    closeOpenCustomerTasks(customer, 'TRANSFERRED_PENDING_ACCEPT');
    offerOrAssignSale(customer, target, `Chuyển phụ trách cho ${target.name}`, 'MANUAL', previous);
    audit('REASSIGN_CUSTOMER', customer.id, `${target.name} · ${target.teamId} · chờ sale nhận`);
    saveState(); closeDrawer(); render(); toast(`Đã gửi khách cho ${target.name} chờ nhận`);
    return;
  }
  customer.updatedAt = stamp();
  customer.note = `Chuyển phụ trách cho ${target.name}`;
  state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount.id, author: currentAccount.name, role: currentAccount.role, text: customer.note, at: stamp() });
  recordAssignmentChange(customer, previous, customer.note);
  audit('REASSIGN_CUSTOMER', customer.id, `${target.name} · ${target.teamId}`);
  saveState(); closeDrawer(); render(); toast(`Đã chuyển khách cho ${target.name}`);
}

function revokeCustomer(id) {
  if (!['ADMIN', 'LEADER'].includes(currentAccount.role)) { toast('FORBIDDEN · không có quyền thu hồi khách'); return; }
  const customer = customerById(id);
  if (!canViewCustomer(customer)) { toast('NOT_FOUND · khách hàng nằm ngoài phạm vi'); return; }
  if (!window.confirm('Thu hồi khách về Khách mới? Các lịch chăm sóc đang mở sẽ được đóng để tránh giao sai người.')) return;
  const previous = assignmentSnapshot(customer);
  closeOpenCustomerTasks(customer, 'REVOKED_TO_POOL');
  state.dataOffers.forEach(offer => { if (offer.status === 'PENDING' && offer.customerId === customer.id) { offer.status = 'EXPIRED'; offer.resolvedAt = stamp(); } });
  if (currentAccount.role === 'ADMIN') {
    customer.saleId = null;
    customer.leaderId = null;
    customer.teamId = null;
  } else {
    customer.saleId = null;
    customer.leaderId = currentAccount.leaderId;
    customer.teamId = currentAccount.teamId;
  }
  customer.updatedAt = stamp();
  customer.note = currentAccount.role === 'ADMIN' ? 'Admin thu hồi về Khách mới chung' : `Leader thu hồi về Khách mới Team ${currentAccount.teamId}`;
  state.notes.unshift({ id: `NOTE-${Date.now()}-${customer.id}`, customerId: customer.id, authorId: currentAccount.id, author: currentAccount.name, role: currentAccount.role, text: customer.note, at: stamp() });
  recordAssignmentChange(customer, previous, customer.note);
  audit('REVOKE_CUSTOMER', customer.id, customer.note);
  saveState(); closeDrawer(); render(); toast('Đã thu hồi khách về Khách mới');
}

function newWebsiteModal() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được thêm website'); return; }
  openModal('Thêm website / landing page', `<form id="newWebsiteForm"><div class="form-grid"><label class="form-field">Tên tài sản<input id="websiteName" required maxlength="200" placeholder="Landing chiến dịch"></label><label class="form-field">Tên miền<input id="websiteDomain" required maxlength="253" placeholder="landing.nvtagency.vn"></label><label class="form-field full">Nguồn nhận data<select id="websiteProvider"><option value="LANDING_API">Landing API</option><option value="FACEBOOK_FORMS">Facebook Forms</option><option value="TIKTOK_FORMS">TikTok Forms</option><option value="CUSTOM_WEBHOOK">Custom Webhook</option></select></label></div><div class="credential-hint">Website mới mặc định tắt nhận data. Sau khi thêm, hãy cấu hình credential và để backend xác minh domain/kết nối.</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Thêm website</button></div></form>`);
  $('#newWebsiteForm').onsubmit = event => {
    event.preventDefault();
    const name = $('#websiteName').value.trim();
    const domain = $('#websiteDomain').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!name || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) { toast('Tên hoặc tên miền chưa hợp lệ'); return; }
    if (state.websites.some(item => item.domain.toLowerCase() === domain)) { toast('Tên miền đã tồn tại'); return; }
    const website = { id: `WEB-${Date.now()}`, name, domain, status: 'PAUSED', provider: $('#websiteProvider').value, endpoint: '', externalAccountId: '', campaignId: '', formId: '', webhookSlug: generateWebhookSlug(), webhookUrlOverride: '', connectionStatus: 'UNCONFIGURED', domainVerificationStatus: 'UNVERIFIED', credentialConfigured: false, credentialLast4: '', lastVerifiedAt: '', lastError: '', lastSync: 'Chưa đồng bộ' };
    state.websites.unshift(website);
    audit('CREATE_WEBSITE', website.id, `${name} · ${domain}`);
    saveState(); closeModal(); render(); toast('Đã thêm website mới');
  };
}

function copyWebhookUrl(id) {
  const website = websiteById(id);
  if (!website) return;
  const url = webhookUrlFor(website);
  if (!url) { toast('Chưa có URL webhook để sao chép'); return; }
  const done = () => toast('Đã sao chép URL webhook');
  const manual = () => {
    const field = $(`#webhookUrl-${website.id}`);
    if (!field) { toast('Không sao chép được — hãy bôi đen URL và copy thủ công'); return; }
    field.focus();
    field.select();
    field.setSelectionRange(0, url.length);
    try { document.execCommand('copy'); done(); } catch { toast('Không sao chép được — hãy bôi đen URL và copy thủ công'); }
  };
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, manual);
  else manual();
}

function generateWebhookFor(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được tạo mã webhook'); return; }
  const website = websiteById(id);
  if (!website) return;
  website.webhookSlug = generateWebhookSlug();
  website.webhookUrlOverride = '';
  audit('CREATE_WEBHOOK', website.id, `Tạo mã webhook cho ${website.domain}`);
  saveState(); render(); toast('Đã tạo mã webhook mới');
}

function editWebhookUrlModal(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được đổi URL webhook'); return; }
  const website = websiteById(id);
  if (!website) return;
  openModal(`URL webhook · ${website.name}`, `<form id="webhookUrlForm"><div class="form-grid"><label class="form-field full">Mã webhook (slug)<input id="webhookSlugField" class="mono" maxlength="60" value="${escapeHtml(website.webhookSlug || '')}" placeholder="ds-1789015513831-ZPKFFVK9S9A"></label><label class="form-field full">Ghi đè URL công khai (tuỳ chọn, bắt buộc HTTPS)<input id="webhookOverrideField" class="mono" type="url" maxlength="500" value="${escapeHtml(website.webhookUrlOverride || '')}" placeholder="https://apex.vn/api/data-sources/webhook/ds-.../"></label><label class="form-field full">Domain công khai dùng chung cho mọi website<input id="webhookBaseField" class="mono" maxlength="200" value="${escapeHtml(state.settings.webhookPublicBase || '')}" placeholder="${escapeHtml(DEFAULT_WEBHOOK_BASE)}"></label></div><div class="credential-hint"><b>Slug chính là khóa truy cập</b> — ai giữ URL này đều gửi được data vào CRM. Đổi slug làm URL cũ chết ngay, phải dán URL mới vào LadiPage. URL ở đây là bản công khai (HTTPS) để cấu hình cho landing page; khi test trên máy này hãy dùng URL nội bộ hiển thị dưới thẻ website.</div><div class="modal-actions"><button class="button button-danger" type="button" id="webhookRegenerateButton">Tạo mã mới</button><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Lưu</button></div></form>`);
  $('#webhookRegenerateButton').onclick = () => {
    $('#webhookSlugField').value = generateWebhookSlug();
    $('#webhookOverrideField').value = '';
    toast('Đã sinh mã mới — bấm Lưu để áp dụng');
  };
  $('#webhookUrlForm').onsubmit = event => {
    event.preventDefault();
    const slug = cleanText($('#webhookSlugField').value, '', 60).trim();
    const override = cleanText($('#webhookOverrideField').value, '', 500).trim();
    const base = cleanText($('#webhookBaseField').value, '', 200).trim();
    if (!cleanWebhookSlug(slug)) { toast('Mã webhook sai định dạng: ds-<13 số>-<11 ký tự A-Z0-9>'); return; }
    if (state.websites.some(item => item.id !== website.id && String(item.webhookSlug || '').toUpperCase() === slug.toUpperCase())) { toast('Mã webhook này đã thuộc về website khác'); return; }
    if (override && !cleanWebhookOverride(override)) { toast('URL ghi đè phải là HTTPS và không chứa khoảng trắng'); return; }
    website.webhookSlug = slug;
    website.webhookUrlOverride = cleanWebhookOverride(override);
    state.settings.webhookPublicBase = cleanWebhookBase(base, DEFAULT_WEBHOOK_BASE);
    audit('UPDATE_WEBHOOK', website.id, `Cập nhật URL webhook cho ${website.domain}`);
    saveState(); closeModal(); render(); toast('Đã lưu URL webhook');
  };
}

function configureWebsiteModal(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được cấu hình website'); return; }
  const website = websiteById(id);
  if (!website) return;
  const option = (value, label) => `<option value="${value}" ${website.provider === value ? 'selected' : ''}>${label}</option>`;
  openModal(`Cấu hình API · ${website.name}`, `<form id="websiteApiForm"><div class="api-config-grid"><label class="form-field">Provider<select id="websiteApiProvider">${option('LANDING_API', 'Landing API')}${option('FACEBOOK_FORMS', 'Facebook Forms')}${option('TIKTOK_FORMS', 'TikTok Forms')}${option('CUSTOM_WEBHOOK', 'Custom Webhook')}</select></label><label class="form-field">API endpoint nhà cung cấp<input id="websiteApiEndpoint" type="url" required maxlength="500" placeholder="https://api.provider.com/v1" value="${escapeHtml(website.endpoint)}"></label><label class="form-field">External Account / Page ID<input id="websiteExternalAccount" maxlength="160" value="${escapeHtml(website.externalAccountId)}"></label><label class="form-field">Campaign ID<input id="websiteCampaignId" maxlength="160" value="${escapeHtml(website.campaignId)}"></label><label class="form-field">Form ID<input id="websiteFormId" maxlength="160" value="${escapeHtml(website.formId)}"></label><label class="form-field">API key / access token<input id="websiteCredential" type="password" autocomplete="new-password" minlength="8" placeholder="${website.credentialConfigured ? `Đã có ••••${escapeHtml(website.credentialLast4)} · để trống nếu giữ nguyên` : 'Nhập khóa do nhà cung cấp cấp'}"></label></div><div class="credential-hint"><b>Không lưu secret trong trình duyệt.</b> Giao diện chỉ giữ cờ đã cấu hình và 4 ký tự cuối. Backend phải mã hóa credential, xác minh domain, chữ ký webhook, quyền campaign/form và chống nhận trùng.</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Lưu & chờ xác minh</button></div></form>`);
  $('#websiteApiForm').onsubmit = event => {
    event.preventDefault();
    const endpoint = $('#websiteApiEndpoint').value.trim();
    const credential = $('#websiteCredential').value.trim();
    if (!/^https:\/\/[^\s]+$/i.test(endpoint)) { toast('Endpoint phải là HTTPS hợp lệ'); return; }
    if (!website.credentialConfigured && credential.length < 8) { toast('API key/access token phải có ít nhất 8 ký tự'); return; }
    website.provider = $('#websiteApiProvider').value;
    website.endpoint = endpoint;
    website.externalAccountId = $('#websiteExternalAccount').value.trim();
    website.campaignId = $('#websiteCampaignId').value.trim();
    website.formId = $('#websiteFormId').value.trim();
    if (credential) { website.credentialConfigured = true; website.credentialLast4 = credential.slice(-4); }
    website.connectionStatus = 'PENDING_BACKEND';
    website.domainVerificationStatus = 'UNVERIFIED';
    website.status = 'PAUSED';
    website.lastVerifiedAt = '';
    website.lastError = 'Đã lưu metadata và 4 ký tự cuối; secret chưa được lưu vì workspace chưa có backend vault.';
    audit('CONFIGURE_WEBSITE_API', website.id, `${website.provider} · ${website.domain} · credential ${website.credentialConfigured ? `••••${website.credentialLast4}` : 'chưa có'}`);
    saveState(); closeModal(); render(); toast('Đã lưu metadata; cần nhập lại secret khi backend vault được triển khai');
  };
}

function toggleWebsite(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được quản lý website'); return; }
  const website = state.websites.find(item => item.id === id);
  if (!website) return;
  if (website.status !== 'ACTIVE' && (website.connectionStatus !== 'VERIFIED' || website.domainVerificationStatus !== 'VERIFIED')) { toast('Chưa thể bật nhận data: backend chưa xác minh credential và tên miền'); return; }
  website.status = website.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  audit('UPDATE_WEBSITE', website.id, `Trạng thái ${website.status}`);
  saveState(); render(); toast('Đã cập nhật trạng thái website');
}

function testWebsiteConnection(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được kiểm tra website'); return false; }
  const website = websiteById(id);
  if (!website || !website.endpoint || !website.credentialConfigured) { toast('Hãy nhập endpoint và credential trước khi kiểm tra'); return false; }
  website.connectionStatus = 'PENDING_BACKEND';
  website.status = 'PAUSED';
  website.lastError = 'Yêu cầu kiểm tra đã sẵn sàng; workspace chưa có backend để gọi provider an toàn.';
  audit('REQUEST_WEBSITE_VERIFICATION', website.id, `${website.provider} · chờ backend`);
  saveState(); render(); toast('Đã ghi nhận yêu cầu; cần backend thực hiện xác minh thật');
  return false;
}

function configureIntegrationModal(id = null) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được cấu hình tích hợp'); return; }
  const existing = id ? state.integrations.find(item => item.id === id && !item.archived) : null;
  const item = existing || { name: '', provider: 'SUBDATA', endpoint: '', externalAccountId: '', credentialConfigured: false, credentialLast4: '' };
  const option = (value, label) => `<option value="${value}" ${item.provider === value ? 'selected' : ''}>${label}</option>`;
  openModal(existing ? `Cấu hình · ${existing.name}` : 'Thêm kết nối API', `<form id="integrationApiForm"><div class="api-config-grid"><label class="form-field">Tên kết nối<input id="integrationName" required maxlength="200" value="${escapeHtml(item.name)}" placeholder="Ví dụ: REMOVED_PAYMENT tài khoản chính"></label><label class="form-field">Provider<select id="integrationProvider">${option('SUBDATA', 'Subdata')}${option('FACEBOOK', 'Facebook Forms')}${option('CUSTOM', 'Custom API')}</select></label><label class="form-field full">API endpoint<input id="integrationEndpoint" type="url" required maxlength="500" value="${escapeHtml(item.endpoint)}" placeholder="https://api.provider.com/v1"></label><label class="form-field">Workspace / Page / Account ID<input id="integrationExternalAccount" maxlength="160" value="${escapeHtml(item.externalAccountId || '')}"></label><label class="form-field">API key / access token / webhook secret<input id="integrationCredential" type="password" autocomplete="new-password" minlength="8" placeholder="${item.credentialConfigured ? `Đã có ••••${escapeHtml(item.credentialLast4)} · để trống nếu giữ nguyên` : 'Secret do provider cấp'}"></label></div><div class="credential-hint">Secret là trường write-only. Bản frontend này chỉ giữ 4 ký tự cuối; backend production phải mã hóa bằng KMS, chống SSRF khi gọi endpoint và giới hạn quyền theo provider.</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Lưu cấu hình</button></div></form>`);
  $('#integrationApiForm').onsubmit = event => {
    event.preventDefault();
    const name = $('#integrationName').value.trim();
    const endpoint = $('#integrationEndpoint').value.trim();
    const credential = $('#integrationCredential').value.trim();
    if (!name || !/^https:\/\/[^\s]+$/i.test(endpoint)) { toast('Tên và endpoint HTTPS là bắt buộc'); return; }
    if (!item.credentialConfigured && credential.length < 8) { toast('Credential phải có ít nhất 8 ký tự'); return; }
    const provider = $('#integrationProvider').value;
    const type = { SUBDATA: 'CUSTOMER_DATA', REMOVED_PAYMENT: 'PAYMENT', FACEBOOK: 'DATA_INTAKE', CUSTOM: 'CONNECTOR' }[provider];
    const target = existing || { id: `INT-${Date.now()}`, archived: false };
    Object.assign(target, { name, provider, type, endpoint, externalAccountId: $('#integrationExternalAccount').value.trim(), status: 'PENDING_BACKEND', lastVerifiedAt: '', lastError: 'Đã lưu metadata và 4 ký tự cuối; secret chưa được lưu vì workspace chưa có backend vault.' });
    if (credential) { target.credentialConfigured = true; target.credentialLast4 = credential.slice(-4); }
    if (!existing) state.integrations.unshift(target);
    audit('CONFIGURE_INTEGRATION', target.id, `${provider} · credential ${target.credentialConfigured ? `••••${target.credentialLast4}` : 'chưa có'}`);
    saveState(); closeModal(); render(); toast('Đã lưu metadata; cần nhập lại secret khi backend vault được triển khai');
  };
}

function testIntegration(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được kiểm tra tích hợp'); return false; }
  const item = state.integrations.find(integration => integration.id === id && !integration.archived);
  if (!item || !item.endpoint || !item.credentialConfigured) { toast('Kết nối chưa đủ endpoint hoặc credential'); return false; }
  item.status = 'PENDING_BACKEND';
  item.lastError = 'Yêu cầu xác minh đang chờ backend; chưa có cuộc gọi nào tới provider.';
  audit('REQUEST_INTEGRATION_VERIFICATION', item.id, `${item.provider} · chờ backend`);
  saveState(); render(); toast('Cần backend thực hiện kiểm tra kết nối thật');
  return false;
}

function pauseIntegration(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được tạm dừng tích hợp'); return; }
  const item = state.integrations.find(integration => integration.id === id && !integration.archived);
  if (!item) return;
  if (item.status === 'PAUSED') { item.status = 'PENDING_BACKEND'; item.lastError = 'Yêu cầu bật lại đang chờ backend xác minh.'; }
  else { item.status = 'PAUSED'; item.lastError = 'Đã tạm dừng nhận và gửi dữ liệu.'; }
  audit('PAUSE_INTEGRATION', item.id, item.status);
  saveState(); render();
}

function archiveIntegration(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được lưu trữ tích hợp'); return; }
  const item = state.integrations.find(integration => integration.id === id && !integration.archived);
  if (!item || !window.confirm(`Lưu trữ kết nối ${item.name}? Kết nối sẽ ngừng tham gia vận hành.`)) return;
  item.archived = true;
  item.status = 'PAUSED';
  audit('ARCHIVE_INTEGRATION', item.id, item.name);
  saveState(); render(); toast('Đã lưu trữ kết nối');
}

function restoreIntegration(id) {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được khôi phục tích hợp'); return; }
  const item = state.integrations.find(integration => integration.id === id && integration.archived);
  if (!item) return;
  item.archived = false;
  item.status = 'PAUSED';
  item.lastError = 'Đã khôi phục cấu hình; cần backend xác minh trước khi bật lại.';
  audit('RESTORE_INTEGRATION', item.id, item.name);
  saveState(); render(); toast('Đã khôi phục kết nối ở trạng thái tạm dừng');
}

function markNotificationRead(id = null) {
  const items = visibleNotifications().filter(item => !id || item.id === id);
  items.forEach(item => { if (!item.readBy.includes(currentAccount.id)) item.readBy.push(currentAccount.id); });
  saveState(); render();
  toast(id ? 'Đã đánh dấu thông báo là đã đọc' : 'Đã đọc tất cả thông báo');
}

function reconcileAll() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được đối soát'); return; }
  // Đối soát gắn với cấu hình REMOVED_PAYMENT nên tạm ẩn cùng mục Tích hợp; không còn nhảy sang trang đó.
  toast('Đối soát tạm ẩn cùng mục Tích hợp.');
  return;
  // Giữ nguyên luồng cũ bên dưới để khôi phục nhanh khi mục Tích hợp mở lại.
  const REMOVED_PAYMENT = state.integrations.find(item => item.provider === 'REMOVED_PAYMENT' && !item.archived);
  if (!REMOVED_PAYMENT || REMOVED_PAYMENT.status !== 'VERIFIED') { toast('Cần cấu hình và xác minh REMOVED_PAYMENT ở backend trước khi đối soát'); if (REMOVED_PAYMENT) configureIntegrationModal(REMOVED_PAYMENT.id); return; }
  audit('REQUEST_RECONCILIATION', 'PAYMENTS', 'Chờ backend nhận job đối soát REMOVED_PAYMENT');
  saveState();
  toast('Yêu cầu đối soát cần được gửi tới backend; không tự đánh dấu giao dịch đã khớp');
}

function toggleSetting(key) {
  if (currentAccount.role !== 'ADMIN' || !['leaderCanUpdate', 'notifyMilestones'].includes(key)) { toast('FORBIDDEN · cài đặt không hợp lệ'); return; }
  state.settings[key] = !state.settings[key];
  audit('UPDATE_SETTING', key, state.settings[key] ? 'Bật' : 'Tắt');
  saveState(); render(); toast('Đã cập nhật cài đặt');
}

function saveSettings() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được đổi cài đặt'); return; }
  const sla = Number($('#slaInput')?.value);
  if (!Number.isInteger(sla) || sla < 5 || sla > 1440) { toast('SLA không hợp lệ'); return; }
  state.settings.slaMinutes = sla;
  refreshTaskStatuses();
  audit('UPDATE_SETTING', 'SLA', `${sla} phút`);
  saveState(); render(); toast('Đã lưu SLA');
}

function toggleTwoFactor() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được đổi bảo mật'); return; }
  state.security.twoFactorEnabled = !state.security.twoFactorEnabled;
  audit('UPDATE_2FA', 'SECURITY', state.security.twoFactorEnabled ? 'Bật xác thực hai lớp' : 'Tắt xác thực hai lớp');
  saveState(); render(); toast(state.security.twoFactorEnabled ? 'Đã bật 2FA cục bộ · cần backend TOTP trước khi vận hành thật' : 'Đã tắt 2FA');
}

function changePasswordModal() {
  if (currentAccount.role !== 'ADMIN') { toast('FORBIDDEN · chỉ Admin được đổi mật khẩu'); return; }
  openModal('Đổi mật khẩu tài khoản Start', `<form id="changePasswordForm"><div class="form-grid"><label class="form-field full">Mật khẩu hiện tại<input id="currentAdminPassword" type="password" autocomplete="current-password" required></label><label class="form-field">Mật khẩu mới<input id="newAdminPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label class="form-field">Nhập lại mật khẩu<input id="confirmAdminPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label></div><div class="credential-hint">Mật khẩu mới phải có ít nhất 8 ký tự. Trước khi vận hành thật, backend phải hash bằng Argon2id/bcrypt và vô hiệu hóa phiên cũ.</div><div class="modal-actions"><button class="button" type="button" data-close-modal>Huỷ</button><button class="button button-primary" type="submit">Cập nhật mật khẩu</button></div></form>`);
  $('[data-close-modal]')?.addEventListener('click', closeModal);
  $('#changePasswordForm').onsubmit = event => {
    event.preventDefault();
    const current = $('#currentAdminPassword').value, next = $('#newAdminPassword').value, confirm = $('#confirmAdminPassword').value;
    if (current !== state.security.adminPassword) { toast('Mật khẩu hiện tại không đúng'); return; }
    if (next.length < 8 || next.length > 128 || next !== confirm || next === current) { toast('Mật khẩu mới hoặc xác nhận chưa hợp lệ'); return; }
    state.security.adminPassword = next;
    audit('CHANGE_PASSWORD', 'SECURITY', 'Tài khoản Start đã đổi mật khẩu');
    saveState(); closeModal(); render(); toast('Đã đổi mật khẩu tài khoản Start');
  };
}

function recordAdminLogin(success, account = ACCOUNTS[0]) {
  state.security.loginHistory.unshift({ id: `LOGIN-${Date.now()}-${state.security.loginHistory.length}`, ip: sessionIp('127.0.0.1'), accountId: account.id, accountName: account.name, role: account.role, device: 'Trình duyệt hiện tại', location: sessionContextLoaded ? 'IP do server webhook xác định' : 'Backend cần cung cấp IP thật qua reverse proxy', at: stamp(), success });
  state.security.loginHistory = state.security.loginHistory.slice(0, 30);
}

function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map(row => row.map(csvCell).join(','));
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  toast(`Đã xuất ${rows.length} dòng dữ liệu`);
}

function assertCanExport() {
  if (currentAccount.role === 'SALE') { toast('FORBIDDEN · tài khoản Sale không có quyền xuất dữ liệu'); return false; }
  return true;
}

function exportCustomers() {
  if (!assertCanExport()) return;
  const query = normalize(globalQuery);
  const rows = scopedCustomers().filter(customer => customerStatusFilter === 'ALL' || customer.status === customerStatusFilter).filter(matchesCustomerOwnerFilter).filter(customer => !query || normalize(customerSearchText(customer)).includes(query));
  const fields = activeCustomFields();
  const sourceHeaders = currentAccount.role === 'ADMIN' ? ['Nguồn', 'Campaign', 'Landing page', 'Tên miền'] : [];
  const headers = ['Mã CRM', 'Họ tên', 'SĐT', 'Email', ...sourceHeaders, 'Trạng thái', 'Team', 'Leader', 'Sale', ...fields.map(field => field.label), 'Ghi chú mới nhất', 'Ngày tạo'];
  downloadCsv(`nvt-khach-hang-${currentAccount.scope.toLowerCase()}.csv`, headers, rows.map(item => {
    const website = customerLanding(item);
    const sourceValues = currentAccount.role === 'ADMIN' ? [item.source, item.campaign, website?.name || '', website?.domain || ''] : [];
    return [item.id, item.name, item.phone, item.email, ...sourceValues, STATUS_META[item.status]?.label || item.status, item.teamId, staffName(item.leaderId), staffName(item.saleId), ...fields.map(field => customFieldValueLabel(field, item.customFields?.[field.id])), item.note, item.createdAt];
  }));
}

function exportOrders() {
  if (!assertCanExport()) return;
  const query = normalize(globalQuery);
  const rows = scopedOrders().filter(order => orderStatusFilter === 'ALL' || order.status === orderStatusFilter).filter(order => !query || normalize(`${order.code}${order.customerName}${order.productName}${order.source}`).includes(query));
  const sourceHeaders = currentAccount.role === 'ADMIN' ? ['Nguồn', 'Campaign', 'Website / Landing'] : [];
  downloadCsv(`nvt-don-hang-${currentAccount.scope.toLowerCase()}.csv`, ['Mã đơn', 'Khách hàng', 'Sản phẩm', 'SKU', 'SL', 'Giá trị', 'Trạng thái', 'Sale', ...sourceHeaders, 'Thanh toán lúc', 'Hoàn lúc'], rows.map(item => { const website = websiteById(item.websiteId); const sourceValues = currentAccount.role === 'ADMIN' ? [item.source, item.campaign, website ? `${website.name} · ${website.domain}` : 'Chưa quy nguồn'] : []; return [item.code, item.customerName, item.productName, item.sku, item.qty, item.total, ORDER_STATUS[item.status]?.[0] || item.status, staffName(item.saleId), ...sourceValues, item.paidAt, item.refundedAt]; }));
}

function exportRevenue() {
  if (!assertCanExport()) return;
  downloadCsv(`nvt-doanh-thu-${periodFileToken()}.csv`, ['Ngày', 'Doanh thu thuần', 'Doanh số gộp', 'Chiết khấu', 'Hoàn tiền', 'Lượt thanh toán', 'Sản phẩm'], dailySeries().map(item => [item.date, item.revenue, item.gross, item.discount, item.refunds, item.orders, item.units]));
}

function exportMarketing() {
  if (currentAccount.role === 'SALE') { toast('FORBIDDEN · không có quyền xuất marketing'); return; }
  const isAdmin = currentAccount.role === 'ADMIN';
  const headers = isAdmin ? ['Nguồn', 'Medium', 'Campaign', 'Sessions', 'Form gửi', 'Data CRM', 'Khách paid cohort', 'Lượt thanh toán', 'Doanh thu', 'Chi phí', 'ROAS'] : ['Nguồn', 'Medium', 'Campaign', 'Data CRM Team', 'Khách paid cohort', 'Lượt thanh toán Team', 'Doanh thu Team'];
  const rows = sourcePerformance().map(item => isAdmin ? [item.source, item.medium, item.campaign, item.sessions, item.trackedLeads, item.leads, item.convertedCustomers, item.paidOrders, item.revenue, item.spend, item.roas?.toFixed(2) || 'Organic'] : [item.source, item.medium, item.campaign, item.leads, item.convertedCustomers, item.paidOrders, item.revenue]);
  downloadCsv(`nvt-attribution-${periodFileToken()}-${currentAccount.scope.toLowerCase()}.csv`, headers, rows);
}

function exportTeam() {
  if (!assertCanExport()) return;
  downloadCsv(`nvt-hieu-suat-sale-${periodFileToken()}.csv`, ['Sale', 'Team', 'Data mới', 'Đơn thanh toán', 'Doanh thu', 'Chuyển đổi %', 'Lịch quá hạn'], salePerformanceRows().map(item => [item.name, item.teamId, item.customers, item.paid, item.revenue, item.conversion.toFixed(1), item.overdue]));
}

function exportFullReport() {
  if (!assertCanExport()) return;
  const snapshot = periodSnapshot();
  const rows = [
    ['Kinh doanh', 'Doanh thu thuần', snapshot.revenue, '', '', ''],
    ['Kinh doanh', 'Lượt thanh toán', snapshot.paid.length, '', '', ''],
    ['Kinh doanh', 'AOV', snapshot.aov, '', '', ''],
    ...productPerformance(scopedOrders()).map(item => ['Sản phẩm', item.name, item.units, item.paidOrders, item.revenue, item.refunds]),
    ...(currentAccount.role === 'ADMIN' ? sourcePerformance().map(item => ['Nguồn', item.source, item.sessions, item.leads, item.revenue, item.spend]) : []),
    ...salePerformanceRows().map(item => ['Sale', item.name, item.customers, item.paid, item.revenue, `${item.conversion.toFixed(1)}%`])
  ];
  downloadCsv(`nvt-bao-cao-${dateRange}-ngay-${currentAccount.scope.toLowerCase()}.csv`, ['Nhóm', 'Đối tượng / chỉ số', 'Sessions / SL', 'Data / Đơn', 'Doanh thu', 'Chi phí / Hoàn / Mục tiêu'], rows);
}

function openSearchDrawer(value) {
  const raw = String(value || '').trim(), query = normalize(raw);
  if (!query) { toast('Nhập từ khoá cần tìm'); return; }
  const customers = scopedCustomers().filter(item => normalize(customerSearchText(item)).includes(query)).slice(0, 6);
  const orders = scopedOrders().filter(item => normalize(`${item.code}${item.customerName}${item.productName}${item.sku}${currentAccount.role === 'ADMIN' ? item.source : ''}`).includes(query)).slice(0, 6);
  const products = PRODUCTS.filter(item => normalize(`${item.name}${item.sku}${item.category}`).includes(query)).slice(0, 4);
  const section = (title, body) => `<div class="section-label">${title}</div>${body}`;
  openDrawer({
    head: `<h2>Kết quả tìm kiếm</h2><p>${escapeHtml(raw)} · scope ${currentAccount.scope}</p>`,
    body: `${section('Khách hàng', customers.map(item => `<button class="alert-row" style="width:100%;text-align:left" data-search-customer="${escapeHtml(item.id)}"><span class="alert-icon">♙</span><span><b>${escapeHtml(item.name)}</b><p>${escapeHtml(item.phone)}${currentAccount.role === 'ADMIN' ? ` · ${escapeHtml(item.source)}` : ''}</p></span><strong>${escapeHtml(item.id)}</strong></button>`).join('') || '<div class="cell-sub">Không có kết quả</div>')}${section('Đơn hàng', orders.map(item => `<button class="alert-row" style="width:100%;text-align:left" data-search-order="${escapeHtml(item.id)}"><span class="alert-icon">▤</span><span><b>${escapeHtml(item.code)}</b><p>${escapeHtml(item.customerName)} · ${escapeHtml(item.productName)}</p></span><strong>${money(item.total, true)}</strong></button>`).join('') || '<div class="cell-sub">Không có kết quả</div>')}${section('Sản phẩm', products.map(item => `<button class="alert-row" style="width:100%;text-align:left" data-search-product="${escapeHtml(item.id)}"><span class="alert-icon">□</span><span><b>${escapeHtml(item.name)}</b><p>${escapeHtml(item.sku)} · ${escapeHtml(item.category)}</p></span><strong>${money(item.price, true)}</strong></button>`).join('') || '<div class="cell-sub">Không có kết quả</div>')}`
  });
  $$('[data-search-customer]').forEach(button => button.onclick = () => openCustomerDrawer(button.dataset.searchCustomer));
  $$('[data-search-order]').forEach(button => button.onclick = () => openOrderDrawer(button.dataset.searchOrder));
  $$('[data-search-product]').forEach(button => button.onclick = () => { closeDrawer(); currentView = 'orders'; globalQuery = productById(button.dataset.searchProduct)?.name || ''; render(); });
}

function bindQueryInput(selector) {
  const input = $(selector);
  if (!input) return;
  input.oninput = () => { globalQuery = input.value; };
  input.onkeydown = event => { if (event.key === 'Enter') render(); };
}

function bindViewActions() {
  $$('[data-range]').forEach(button => button.onclick = () => { const days = Number(button.dataset.range); if ([1, 7, 15, 30].includes(days)) { dateRange = days; datePreset = String(days); render(); } });
  $('#applyCustomDate')?.addEventListener('click', applyCustomDateRange);
  $$('[data-view-jump]').forEach(button => button.onclick = () => navigate(button.dataset.viewJump));
  $$('[data-team-member]').forEach(button => button.onclick = () => { customerOwnerFilter = `sale:${button.dataset.teamMember}`; navigate('customers'); });
  $$('[data-open-customer]').forEach(button => button.onclick = () => openCustomerDrawer(button.dataset.openCustomer));
  $$('[data-open-order]').forEach(button => button.onclick = () => openOrderDrawer(button.dataset.openOrder));
  $$('[data-edit-order]').forEach(button => button.onclick = () => editOrderModal(button.dataset.editOrder));
  $$('[data-delete-order]').forEach(button => button.onclick = () => deleteOrder(button.dataset.deleteOrder));
  $$('[data-new-customer-product]').forEach(button => button.onclick = () => newOrderModal(button.dataset.newCustomerProduct));
  $$('[data-edit-note]').forEach(button => button.onclick = () => editCustomerNote(button.dataset.editNote));
  $$('[data-delete-note]').forEach(button => button.onclick = () => deleteCustomerNote(button.dataset.deleteNote));
  $$('[data-quick-status]').forEach(select => select.onchange = () => quickUpdateCustomerStatus(select.dataset.quickStatus, select.value));
  $$('[data-quick-sale]').forEach(select => select.onchange = () => { if (select.value) quickAssignSale(select.dataset.quickSale, select.value); });
  $$('[data-quick-custom-field]').forEach(select => select.onchange = () => quickUpdateCustomerField(select.dataset.quickCustomField, select.dataset.fieldId, select.value));
  $$('[data-quick-custom-checkbox]').forEach(input => input.onchange = () => quickUpdateCustomerField(input.dataset.quickCustomCheckbox, input.dataset.fieldId, input.checked));
  $$('[data-quick-multi-field]').forEach(button => button.onclick = () => quickMultiSelectModal(button.dataset.quickMultiField, button.dataset.fieldId));
  $$('[data-complete-task]').forEach(button => button.onclick = () => completeTask(button.dataset.completeTask));
  $$('[data-pool-id]').forEach(input => input.onchange = () => { input.checked ? selectedPoolIds.add(input.dataset.poolId) : selectedPoolIds.delete(input.dataset.poolId); });
  $('#selectPoolButton')?.addEventListener('click', () => { const ids = scopedCustomers().filter(isPoolCustomer).map(customer => customer.id); const allSelected = ids.every(id => selectedPoolIds.has(id)); ids.forEach(id => allSelected ? selectedPoolIds.delete(id) : selectedPoolIds.add(id)); render(); });
  $('#assignPoolButton')?.addEventListener('click', assignSelectedPool);
  $('#assignmentModeSelect')?.addEventListener('change', event => setAssignmentMode(event.target.value));
  $$('[data-bulk-distribute]').forEach(button => button.onclick = () => bulkDistributePool(button.dataset.bulkDistribute));
  $('#newCustomerButton')?.addEventListener('click', newCustomerModal);
  $('#manageCustomerFieldsButton')?.addEventListener('click', customFieldsModal);
  $('#importCustomersButton')?.addEventListener('click', customerImportModal);
  $('#importCustomersSecondaryButton')?.addEventListener('click', customerImportModal);
  $('#newOrderButton')?.addEventListener('click', newOrderModal);
  $('#newProductButton')?.addEventListener('click', () => productModal());
  $('#manageProductCategoriesButton')?.addEventListener('click', productCategoriesModal);
  $$('[data-edit-product]').forEach(button => button.onclick = () => productModal(button.dataset.editProduct));
  $$('[data-toggle-product]').forEach(button => button.onclick = () => toggleProduct(button.dataset.toggleProduct));
  $$('[data-delete-product]').forEach(button => button.onclick = () => deleteProduct(button.dataset.deleteProduct));
  $('#newWebsiteButton')?.addEventListener('click', newWebsiteModal);
  $$('[data-configure-website]').forEach(button => button.onclick = () => configureWebsiteModal(button.dataset.configureWebsite));
  $$('[data-test-website]').forEach(button => button.onclick = () => testWebsiteConnection(button.dataset.testWebsite));
  $$('[data-toggle-website]').forEach(button => button.onclick = () => toggleWebsite(button.dataset.toggleWebsite));
  $$('[data-copy-webhook]').forEach(button => button.onclick = () => copyWebhookUrl(button.dataset.copyWebhook));
  $$('[data-edit-webhook]').forEach(button => button.onclick = () => editWebhookUrlModal(button.dataset.editWebhook));
  $$('[data-generate-webhook]').forEach(button => button.onclick = () => generateWebhookFor(button.dataset.generateWebhook));
  $('[data-webhook-sync]')?.addEventListener('click', () => pullWebhookInbox(true));
  $$('[data-webhook-pending]').forEach(button => { button.onclick = () => webhookPendingModal(); });
  $('#newIntegrationButton')?.addEventListener('click', () => configureIntegrationModal());
  $$('[data-configure-integration]').forEach(button => button.onclick = () => configureIntegrationModal(button.dataset.configureIntegration));
  $$('[data-test-integration]').forEach(button => button.onclick = () => testIntegration(button.dataset.testIntegration));
  $$('[data-pause-integration]').forEach(button => button.onclick = () => pauseIntegration(button.dataset.pauseIntegration));
  $$('[data-archive-integration]').forEach(button => button.onclick = () => archiveIntegration(button.dataset.archiveIntegration));
  $$('[data-restore-integration]').forEach(button => button.onclick = () => restoreIntegration(button.dataset.restoreIntegration));
  $$('[data-read-notification]').forEach(button => button.onclick = () => markNotificationRead(button.dataset.readNotification));
  $('#newAnnouncementButton')?.addEventListener('click', newAnnouncementModal);
  $('#readAllButton')?.addEventListener('click', () => markNotificationRead());
  $('#reconcileAllButton')?.addEventListener('click', reconcileAll);
  $$('[data-toggle-setting]').forEach(button => button.onclick = () => toggleSetting(button.dataset.toggleSetting));
  $('#saveSettingsButton')?.addEventListener('click', saveSettings);
  $('#checkInButton')?.addEventListener('click', checkInToday);
  $('#saveAttendanceSettings')?.addEventListener('click', saveAttendanceSettings);
  $$('[data-accept-offer]').forEach(button => button.onclick = () => acceptDataOffer(button.dataset.acceptOffer));
  $$('[data-edit-attendance]').forEach(button => button.onclick = () => attendanceEditModal(button.dataset.editAttendance));
  $$('[data-delete-attendance]').forEach(button => button.onclick = () => deleteAttendanceRecord(button.dataset.deleteAttendance));
  $$('[data-makeup-attendance]').forEach(button => button.onclick = () => attendanceEditModal(null, button.dataset.makeupAttendance));
  $('#saveAppearanceButton')?.addEventListener('click', () => { state.settings.customAccent = $('#customAccentColor').value; state.settings.fontFamily = $('#fontFamilySelect').value; state.settings.dataBotToken = $('#dataBotToken').value.trim(); state.settings.dataBotChatId = $('#dataBotChatId').value.trim(); state.settings.memberBotToken = $('#memberBotToken').value.trim(); state.settings.memberBotChatId = $('#memberBotChatId').value.trim(); applyAppearanceSettings(); saveState(); render(); });
  $('#toggleTwoFactorButton')?.addEventListener('click', toggleTwoFactor);
  $('#changePasswordButton')?.addEventListener('click', changePasswordModal);
  $('#newMemberButton')?.addEventListener('click', () => teamMemberModal());
  $$('[data-edit-member]').forEach(button => button.onclick = () => teamMemberModal(button.dataset.editMember));
  $$('[data-reset-member-password]').forEach(button => button.onclick = () => resetMemberPasswordModal(button.dataset.resetMemberPassword));
  $$('[data-delete-member]').forEach(button => button.onclick = () => deleteTeamMember(button.dataset.deleteMember));
  $$('[data-promote-registration]').forEach(button => button.onclick = () => teamMemberModal(null, button.dataset.promoteRegistration));
  $('#exportCustomersButton')?.addEventListener('click', exportCustomers);
  $('#exportOrdersButton')?.addEventListener('click', exportOrders);
  $('#exportRevenueButton')?.addEventListener('click', exportRevenue);
  $('#exportMarketingButton')?.addEventListener('click', exportMarketing);
  $('#exportTeamButton')?.addEventListener('click', exportTeam);
  $('#exportReportButton')?.addEventListener('click', exportFullReport);
  bindQueryInput('#customerSearch');
  bindQueryInput('#orderSearch');
  $('#customerStatusFilter')?.addEventListener('change', event => { customerStatusFilter = event.target.value; render(); });
  $('#customerOwnerFilter')?.addEventListener('change', event => { customerOwnerFilter = event.target.value; render(); });
  $('#orderStatusFilter')?.addEventListener('change', event => { orderStatusFilter = event.target.value; render(); });
  $$('[data-distribution-tab]').forEach(button => button.onclick = () => { distributionTab = button.dataset.distributionTab; render(); });
  $('#toggleLeaderDistribution')?.addEventListener('click', toggleLeaderDistribution);
  $$('[data-distribution-member]').forEach(input => input.onchange = () => { const [kind, id] = input.dataset.distributionMember.split(':'); updateDistributionMember(kind, id, input.checked); });
  $$('[data-distribution-weight]').forEach(input => input.onchange = () => { const [kind, id] = input.dataset.distributionWeight.split(':'); updateDistributionWeight(kind, id, input.value); });
  $('#distributionLeaderSelect')?.addEventListener('change', event => { distributionLeaderId = event.target.value; render(); });
  $('#distributionSourceRuleForm')?.addEventListener('submit', event => { event.preventDefault(); addDistributionSourceRule(); });
  $$('[data-toggle-source-rule]').forEach(button => button.onclick = () => toggleDistributionSourceRule(button.dataset.toggleSourceRule));
  $$('[data-delete-source-rule]').forEach(button => button.onclick = () => deleteDistributionSourceRule(button.dataset.deleteSourceRule));
}

function credentialPassword(account) {
  return account.role === 'ADMIN' ? state.security.adminPassword : account.password;
}

function updateLoginTwoFactorField() {
  const phone = $('#loginPhone')?.value.replace(/\D/g, '');
  const show = phone === ACCOUNTS[0].phone && state.security.twoFactorEnabled;
  $('#loginOtpField')?.classList.toggle('is-hidden', !show);
  if (!show && $('#loginOtp')) $('#loginOtp').value = '';
}

function renderAccountCards(selectedId = null) {
  const cards = $('#accountCards');
  if (cards) cards.innerHTML = '';
}

function switchAuthMode(mode) {
  const registering = mode === 'register';
  $('#loginForm')?.classList.toggle('is-hidden', registering);
  $('#registerForm')?.classList.toggle('is-hidden', !registering);
  $('.register-divider')?.classList.toggle('is-hidden', !registering);
  $('.register-heading')?.classList.toggle('is-hidden', !registering);
  $('#loginTab')?.classList.toggle('active', !registering);
  $('#registerTab')?.classList.toggle('active', registering);
  $('#loginTab')?.setAttribute('aria-selected', String(!registering));
  $('#registerTab')?.setAttribute('aria-selected', String(registering));
  const heading = $('.login-card h2');
  const description = $('#authDescription');
  if (heading) heading.textContent = registering ? 'Đăng ký tài khoản' : 'Đăng nhập NVT AGENCY';
  if (description) description.textContent = registering ? 'Tạo tài khoản NVT AGENCY để truy cập hệ thống nội bộ.' : 'Đăng nhập để truy cập hệ thống nội bộ.';
  if (registering) $('#registerPhone')?.focus(); else $('#loginPhone')?.focus();
}

async function submitRegistration() {
  const phone = $('#registerPhone')?.value.replace(/\D/g, '') || '';
  const email = ($('#registerEmail')?.value || '').trim().toLowerCase();
  const password = $('#registerPassword')?.value || '';
  const confirm = $('#registerPasswordConfirm')?.value || '';
  const message = $('#registerMessage');
  if (!/^\d{9,15}$/.test(phone) || !/^[^\s@]+@gmail\.com$/i.test(email) || password.length < 8 || password !== confirm) {
    if (message) { message.className = 'form-message error full'; message.textContent = 'Vui lòng kiểm tra số điện thoại, Gmail và mật khẩu (tối thiểu 8 ký tự).'; }
    return;
  }
  const duplicate = state.registrations.some(item => item.status === 'PENDING' && (item.phone === phone || item.email.toLowerCase() === email)) || ACCOUNTS.some(account => account.phone === phone || account.email?.toLowerCase() === email);
  if (duplicate) { if (message) { message.className = 'form-message error full'; message.textContent = 'Thông tin này đã có hồ sơ đăng ký hoặc tài khoản trong hệ thống.'; } return; }
  // Khách tự đăng ký từ web là một trong hai luồng ĐƯỢC lấy IP. Hỏi server
  // trước khi ghi hồ sơ; không hỏi được thì giữ nhãn "chờ backend", không bịa.
  await refreshSessionContext();
  state.registrations.unshift({ id: `REG-${Date.now()}`, name: email.split('@')[0], phone, email, ipAddress: sessionIp('Chờ backend xác định'), requestedRole: 'PENDING', teamId: '', registeredAt: stamp(), status: 'PENDING' });
  saveState();
  if (message) { message.className = 'form-message success full'; message.textContent = 'Đăng ký thành công. Tài khoản của bạn đang chờ Admin phê duyệt.'; }
  $('#registerForm')?.reset();
}

function captchaToken(formSelector) {
  if (window.location?.protocol === 'file:') return '';
  const captcha = $(`${formSelector} .g-recaptcha`);
  if (!window.grecaptcha || !captcha) return '';
  const widgetId = $$('.g-recaptcha').indexOf(captcha);
  return widgetId >= 0 ? window.grecaptcha.getResponse(widgetId) || '' : '';
}

function startSession(account, restored = false) {
  currentAccount = account;
  currentView = 'dashboard';
  dateRange = 7;
  datePreset = '7';
  customDateStart = dayIso(6);
  customDateEnd = dayIso(0);
  orderStatusFilter = 'ALL';
  customerStatusFilter = 'ALL';
  globalQuery = '';
  selectedPoolIds.clear();
  customerOwnerFilter = 'ALL';
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: account.id })); } catch (error) {}
  $('#loginScreen').classList.add('is-hidden');
  $('#appShell').classList.remove('is-hidden');
  if (!restored) { audit('LOGIN', 'SESSION', `Đăng nhập tài khoản ${account.role}`); saveState(); }
  render();
  startWebhookConsumer();
}

function endSession() {
  stopWebhookConsumer();
  if (currentAccount) { audit('LOGOUT', 'SESSION', `Đăng xuất tài khoản ${currentAccount.role}`); saveState(); }
  currentAccount = null;
  currentView = 'dashboard';
  selectedPoolIds.clear();
  customerOwnerFilter = 'ALL';
  try { sessionStorage.removeItem(SESSION_KEY); } catch (error) {}
  closeDrawer(); closeModal();
  $('#appShell').classList.add('is-hidden');
  $('#loginScreen').classList.remove('is-hidden');
  $('#loginPassword').value = '';
  $('#loginOtp').value = '';
  $('#loginError').textContent = '';
  renderAccountCards();
  updateLoginTwoFactorField();
  $('#loginPhone').focus();
}

function trapFocus(container, event) {
  const focusable = Array.from(container.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'));
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function bindGlobalActions() {
  $('#loginTab')?.addEventListener('click', () => switchAuthMode('login'));
  $('#registerTab')?.addEventListener('click', () => switchAuthMode('register'));
  $$('[data-switch-auth]').forEach(button => button.addEventListener('click', () => switchAuthMode(button.dataset.switchAuth)));
  $$('[data-toggle-password]').forEach(button => button.addEventListener('click', () => {
    const input = $(`#${button.dataset.togglePassword}`);
    if (!input) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.textContent = visible ? 'Hiện' : 'Ẩn';
    button.setAttribute('aria-label', visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
  }));
  $('#forgotPasswordButton')?.addEventListener('click', () => { $('#loginError').textContent = 'Vui lòng liên hệ Admin để cấp lại mật khẩu.'; });
  $('#loginForm').onsubmit = event => {
    event.preventDefault();
    const captcha = captchaToken('#loginForm');
    if (window.location?.protocol !== 'file:' && window.grecaptcha && !captcha) { $('#loginError').textContent = 'Vui lòng xác minh CAPTCHA trước khi đăng nhập.'; return; }
    const identifier = $('#loginPhone').value.trim(), phone = identifier.replace(/\D/g, ''), email = identifier.toLowerCase(), password = $('#loginPassword').value;
    const account = ACCOUNTS.find(item => item.phone === phone || item.email?.toLowerCase() === email);
    if (!account || password !== credentialPassword(account)) { if (account) { recordAdminLogin(false, account); saveState(); } $('#loginError').textContent = 'Số điện thoại hoặc mật khẩu không đúng.'; return; }
    if (account.role === 'ADMIN' && state.security.twoFactorEnabled && $('#loginOtp').value.trim() !== state.security.twoFactorCode) { recordAdminLogin(false, account); saveState(); $('#loginError').textContent = 'Mã xác thực 2FA không đúng.'; updateLoginTwoFactorField(); return; }
    recordAdminLogin(true, account);
    $('#loginError').textContent = '';
    startSession(account);
  };
  $('#registerForm')?.addEventListener('submit', event => { event.preventDefault(); const captcha = captchaToken('#registerForm'); if (window.location?.protocol !== 'file:' && window.grecaptcha && !captcha) { $('#registerMessage').className = 'form-message error full'; $('#registerMessage').textContent = 'Vui lòng xác minh CAPTCHA trước khi đăng ký.'; return; } submitRegistration(); });
  $('#loginPhone').oninput = updateLoginTwoFactorField;
  $('#logoutButton').onclick = endSession;
  $('#notificationButton').onclick = () => navigate('notifications');
  $('#menuButton').onclick = () => $('#sidebar').classList.toggle('open');
  $('#themeButton').onclick = () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (error) {}
  };
  $('#syncButton').onclick = () => {
    $('#syncText').textContent = 'Đang làm mới...';
    setTimeout(() => { state = loadState(); STAFF = state.members.filter(person => person.active !== false); refreshTaskStatuses(); render(); $('#syncText').textContent = 'Dữ liệu cục bộ'; toast('Đã tải lại dữ liệu từ bộ nhớ trình duyệt'); }, 650);
  };
  $('#globalSearch').onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); openSearchDrawer(event.target.value); }
  };
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && currentAccount) { event.preventDefault(); $('#globalSearch').focus(); }
    if (event.key === 'Escape') { if ($('#modalRoot').children.length) closeModal(); else if ($('#drawerRoot').children.length) closeDrawer(); else $('#sidebar').classList.remove('open'); }
    if (event.key === 'Tab') { const modal = $('.modal'); const drawer = $('.drawer'); if (modal) trapFocus(modal, event); else if (drawer) trapFocus(drawer, event); }
  });
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && currentAccount) { state = loadState(); STAFF = state.members.filter(person => person.active !== false); refreshTaskStatuses(); render(); } });
}

let offerSweepTimer = null;

function initialize() {
  let theme = 'light';
  try { theme = localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (error) {}
  document.documentElement.dataset.theme = theme;
  renderAccountCards();
  bindGlobalActions();
  updateLoginTwoFactorField();
  // Quét offer quá hạn: chạy một lần lúc mở trang rồi mỗi phút, có cờ chống khởi động kép.
  expireStaleOffers();
  if (!offerSweepTimer) offerSweepTimer = setInterval(() => expireStaleOffers(), 60000);
  // Hỏi IP phiên ngay khi mở trang: luồng đăng ký web chạy TRƯỚC khi đăng nhập,
  // nên không thể chờ tới startWebhookConsumer (chỉ Admin mới bật consumer).
  refreshSessionContext();
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    const account = ACCOUNTS.find(item => item.id === session?.accountId);
    if (account) { startSession(account, true); return; }
  } catch (error) {}
  $('#loginScreen').classList.remove('is-hidden');
  $('#appShell').classList.add('is-hidden');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
else initialize();


