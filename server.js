import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Local PANADERO pages and API share one origin; unrestricted cross-origin API access is unnecessary.
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'panadero_bakery', waitForConnections: true,
  dateStrings: true,
  connectionLimit: 10, decimalNumbers: true,
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
});
const databaseReady = migrate();
app.use(async (_req, res, next) => {
  try { await databaseReady; next(); }
  catch (error) { console.error('Database initialization failed:', error.message); fail(res, 503, 'Database connection failed.', 'DB_UNAVAILABLE'); }
});
const sessions = new Map();
const ok = (res, data = {}) => res.json({ ok: true, ...data });
const fail = (res, status, message, code = 'ERROR') => res.status(status).json({ ok: false, code, message });
const clean = v => String(v ?? '').trim();
const role = v => ({ Admin: 'admin', Staff: 'staff', Customer: 'customer', admin: 'admin', staff: 'staff', customer: 'customer' }[v] || 'customer');
const userView = u => { const names = clean(u.username).split(/\s+/); return { id: String(u.user_id), firstName: names[0] || '', lastName: names.slice(1).join(' '), displayName: u.username || u.email, email: u.email, mobile: clean(u.mobile), role: role(u.role) }; };
async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS reservations (reservation_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL, total_amount DECIMAL(10,2) NOT NULL, preferred_date DATE NOT NULL, preferred_time TIME NOT NULL, reservation_status ENUM('Pending','Processing','Ready','Completed','Cancelled') NOT NULL DEFAULT 'Pending', reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE RESTRICT, FOREIGN KEY(product_id) REFERENCES bread_products(product_id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS inventory_batches (batch_id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, quantity INT NOT NULL, baked_date DATE NOT NULL, expiration_date DATE NOT NULL, notes VARCHAR(500), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(product_id) REFERENCES bread_products(product_id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Non-destructive schema upgrades for older local PANADERO databases.
    // Inspect INFORMATION_SCHEMA first; this works with XAMPP MariaDB and MySQL.
    const addColumnIfMissing = async (table, column, sqlType) => {
      const [matches] = await conn.query(`SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1`, [table, column]);
      if (!matches.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${sqlType}`);
    };
    await addColumnIfMissing('users', 'mobile', 'VARCHAR(11) NULL');
    const [usernameIndex] = await conn.query(`SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='username' AND NON_UNIQUE=0 LIMIT 1`);
    if (usernameIndex.length) await conn.query('ALTER TABLE users DROP INDEX username');
    await addColumnIfMissing('orders', 'delivery_method', "VARCHAR(12) NULL");
    await addColumnIfMissing('orders', 'delivery_address', 'VARCHAR(500) NULL');
    await addColumnIfMissing('orders', 'recipient_name', 'VARCHAR(100) NULL');
    await addColumnIfMissing('orders', 'recipient_mobile', 'VARCHAR(11) NULL');
    await addColumnIfMissing('orders', 'payment_method', 'VARCHAR(12) NULL');
    // Add the notification table without resetting any existing bakery data.
    await conn.query(`CREATE TABLE IF NOT EXISTS customer_notifications (
      notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      request_type ENUM('order','reservation') NOT NULL,
      request_id INT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_customer_completion (user_id, request_type, request_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Only seed initial catalog/login accounts ONCE. Deletions must stay deleted after restart.
    await conn.query(`CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY, setting_value VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [seedMarker] = await conn.query("SELECT setting_value FROM app_settings WHERE setting_key='initial_demo_seeded'");
    if (!seedMarker.length) {
      const [catCount] = await conn.query('SELECT COUNT(*) AS n FROM categories');
      if (!catCount[0].n) await conn.query("INSERT INTO categories(category_name,description) VALUES ('Breads','Fresh breads'),('Cakes','Cakes and cheesecakes'),('Doughnuts','Doughnuts and pastries'),('Pies','Fresh pies')");
      const [prodCount] = await conn.query('SELECT COUNT(*) AS n FROM bread_products');
      if (!prodCount[0].n && !catCount[0].n) { const [cats] = await conn.query('SELECT category_id,category_name FROM categories'); const ids=Object.fromEntries(cats.map(c=>[c.category_name,c.category_id])); const seed=[['Baguette','Breads',65],['Croissant','Breads',55],['Pan de Sal','Breads',5],['Cinnamon Roll','Breads',45],['Chocolate Cake','Cakes',450],['Lemon & Lime Cheesecake','Cakes',650],['Chiffon Cake','Cakes',350],['Bavarian-Filled Doughnut','Doughnuts',35],['Beignet','Doughnuts',30],['Long John','Doughnuts',35],['Cruller','Doughnuts',35],['Apple Pie','Pies',300],['Blueberry Pie','Pies',350],['Egg Pie','Pies',250],['Lemon Meringue Pie','Pies',350]]; for (const [name,cat,price] of seed) await conn.query('INSERT INTO bread_products(category_id,product_name,price,stock_quantity) VALUES(?,?,?,0)',[ids[cat],name,price]); }
      const demoUsers = [['System Admin','admin@panadero.local','Admin123!','Admin'],['Bakery Staff','staff@panadero.local','Staff123!','Staff']];
      for (const [username,email,password,userRole] of demoUsers) { const [found] = await conn.query('SELECT user_id FROM users WHERE email=?',[email]); if (!found.length) { const hash = await bcrypt.hash(password, 12); await conn.query('INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,?)',[username,email,hash,userRole]); } }
      await conn.query("INSERT INTO app_settings(setting_key,setting_value) VALUES('initial_demo_seeded','1')");
    }
  } finally { conn.release(); }
}
function auth(req, res, next) { const token = clean(req.headers.authorization).replace(/^Bearer\s+/i, ''); const session = sessions.get(token); if (!session) return fail(res, 401, 'Please sign in first.', 'UNAUTHORIZED'); req.user = session; next(); }
function staff(req, res, next) { if (!req.user) return fail(res, 401, 'Please sign in first.', 'UNAUTHORIZED'); if (!['admin', 'staff'].includes(req.user.role)) return fail(res, 403, 'Staff access required.', 'FORBIDDEN'); next(); }
function admin(req, res, next) { if (!req.user) return fail(res, 401, 'Please sign in first.', 'UNAUTHORIZED'); if (req.user.role !== 'admin') return fail(res, 403, 'Admin access required.', 'FORBIDDEN'); next(); }
function tokenFor(user) { const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user); return token; }
function mapProduct(row) { return { id: String(row.product_id), productId: String(row.product_id), categoryId: String(row.category_id), slug: row.product_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name: row.product_name, category: row.category_slug || String(row.category_id), price: Number(row.price), stock: row.stock_quantity == null ? null : Number(row.stock_quantity), available: Number(row.stock_quantity) !== 0, image: '', description: '' }; }
const normalizeStatus = v => String(v || 'Pending').toLowerCase() === 'processing' ? 'preparing' : String(v || 'Pending').toLowerCase();
function publicRecord(r, items) {
  const isOrder = r.order_id != null;
  return {
    id: String(isOrder ? r.order_id : r.reservation_id),
    type: isOrder ? 'order' : 'reservation',
    orderNumber: isOrder ? `ORD-${String(r.order_id).padStart(5, '0')}` : undefined,
    reservationNumber: !isOrder ? `RES-${String(r.reservation_id).padStart(5, '0')}` : undefined,
    total: Number(r.total_amount), status: normalizeStatus(r.order_status || r.reservation_status || 'Pending'),
    createdAt: r.order_date || r.reservation_date,
    customer: {
      firstName: clean(r.username).split(/\s+/)[0] || '',
      lastName: clean(r.username).split(/\s+/).slice(1).join(' '),
      email: r.email || '', mobile: clean(r.mobile)
    },
    items: items || [],
    fulfillment: isOrder ? {
      method: clean(r.delivery_method),
      deliveryAddress: clean(r.delivery_address), recipientName: clean(r.recipient_name),
      recipientMobile: clean(r.recipient_mobile)
    } : {},
    paymentMethod: isOrder ? clean(r.payment_method) : '',
    schedule: isOrder ? {} : { preferredDate: clean(r.preferred_date), preferredTime: clean(r.preferred_time).slice(0, 5) }
  };
}
async function hydrateOrders(rows, reservation = false) { const out = []; for (const r of rows) { const id = reservation ? r.reservation_id : r.order_id; const [items] = await pool.query(`SELECT ${reservation ? 'ri.quantity, (ri.total_amount / NULLIF(ri.quantity, 0)) AS unit_price, bp.product_id, bp.product_name FROM reservations ri JOIN bread_products bp ON bp.product_id=ri.product_id WHERE ri.reservation_id=?' : 'oi.quantity, oi.unit_price, bp.product_id, bp.product_name FROM order_items oi JOIN bread_products bp ON bp.product_id=oi.product_id WHERE oi.order_id=?'}`, [id]); out.push(publicRecord(r, items.map(i => ({ productId: String(i.product_id), name: i.product_name, quantity: Number(i.quantity), price: Number(i.unit_price), lineTotal: Number(i.unit_price) * Number(i.quantity) })))); } return out; }

// Used by the Windows launcher to detect a stale server on port 3000.
app.get('/api/build', (_req, res) => ok(res, { app: 'PANADERO', build: 'panadero-full-audit-20261011-r6' }));
app.get('/api/health', async (_req, res) => { try { await pool.query('SELECT 1'); ok(res, { database: true }); } catch (e) { fail(res, 503, 'Database connection failed.', 'DB_UNAVAILABLE'); } });
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, mobile, password } = req.body || {};
  const nameRx = /^[A-Za-zÑñÀ-ÖØ-öø-ÿ]+(?:[ '\-][A-Za-zÑñÀ-ÖØ-öø-ÿ]+)*$/;
  if (![firstName, lastName].every(v => nameRx.test(clean(v)) && clean(v).length >= 2) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(email)) ||
      !/^09\d{9}$/.test(clean(mobile)) || typeof password !== 'string' || password.length < 8) {
    return fail(res, 400, 'Enter a valid name, email, 11-digit mobile number, and password of at least 8 characters.', 'INVALID_INPUT');
  }
  if ((clean(firstName) + ' ' + clean(lastName)).length > 50 || clean(email).length > 100)
    return fail(res, 400, 'Name or email is too long.', 'INVALID_INPUT');
  try {
    const emailValue = clean(email).toLowerCase();
    const [exists] = await pool.query('SELECT user_id FROM users WHERE email=?', [emailValue]);
    if (exists.length) return fail(res, 409, 'That email is already registered.', 'DUPLICATE_EMAIL');
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query('INSERT INTO users(username,email,mobile,password_hash,role) VALUES(?,?,?,?,\'Customer\')',
      [`${clean(firstName)} ${clean(lastName)}`, emailValue, clean(mobile), hash]);
    const user = { id: String(result.insertId), firstName: clean(firstName), lastName: clean(lastName),
      displayName: `${clean(firstName)} ${clean(lastName)}`, email: emailValue, mobile: clean(mobile), role: 'customer' };
    ok(res, { user, token: tokenFor(user) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'An account with that email or name already exists.', 'DUPLICATE_ACCOUNT');
    console.error('Registration failed:', error.message);
    fail(res, 500, 'Registration failed.');
  }
});
app.post('/api/auth/login', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [clean(req.body?.email).toLowerCase()]); if (!rows.length || !(await bcrypt.compare(String(req.body?.password || ''), rows[0].password_hash))) return fail(res, 401, 'Invalid email or password.', 'INVALID_LOGIN'); const user = userView(rows[0]); ok(res, { user, token: tokenFor(user) }); } catch (e) { fail(res, 500, 'Login failed.'); } });
app.get('/api/auth/me', auth, (req, res) => ok(res, {user:req.user}));
app.post('/api/auth/logout', auth, (req, res) => { for (const [key, value] of sessions) if (value.id === req.user.id) sessions.delete(key); ok(res); });
app.post('/api/auth/password-reset', async (req, res) => { const [rows] = await pool.query('SELECT user_id FROM users WHERE email=?', [clean(req.body?.email).toLowerCase()]); ok(res, { message: rows.length ? 'Password reset request recorded. Contact the bakery administrator to complete it.' : 'If that email exists, a reset request has been recorded.' }); });
app.get('/api/catalog', async (_req, res) => { try { const [categories] = await pool.query('SELECT category_id,category_name,description FROM categories ORDER BY category_name'); const [products] = await pool.query("SELECT bp.*, c.category_name, CASE LOWER(c.category_name) WHEN 'breads' THEN 'bread' WHEN 'cakes' THEN 'cake' WHEN 'doughnuts' THEN 'doughnut' WHEN 'pies' THEN 'pie' ELSE LOWER(REPLACE(c.category_name, ' ', '-')) END AS category_slug FROM bread_products bp JOIN categories c ON c.category_id=bp.category_id ORDER BY bp.product_name"); ok(res, { categories: categories.map(c => ({ id: String(c.category_id), name: c.category_name, description: c.description || '' })), products: products.map(mapProduct) }); } catch (e) { fail(res, 500, 'Unable to load catalog.'); } });
app.get('/api/inventory', auth, staff, async (_req, res) => { const [categories] = await pool.query('SELECT category_id,category_name FROM categories ORDER BY category_name'); const [products] = await pool.query("SELECT bp.*, c.category_name, CASE LOWER(c.category_name) WHEN 'breads' THEN 'bread' WHEN 'cakes' THEN 'cake' WHEN 'doughnuts' THEN 'doughnut' WHEN 'pies' THEN 'pie' ELSE LOWER(REPLACE(c.category_name, ' ', '-')) END AS category_slug FROM bread_products bp JOIN categories c ON c.category_id=bp.category_id ORDER BY bp.product_name"); const [batches] = await pool.query('SELECT b.*,p.product_name FROM inventory_batches b JOIN bread_products p ON p.product_id=b.product_id ORDER BY b.created_at DESC'); const [logs] = await pool.query('SELECT log_date AS t, description AS text FROM system_logs ORDER BY log_date DESC, log_id DESC LIMIT 200'); ok(res, { categories: categories.map(c => ({ id: String(c.category_id), name: c.category_name })), products: products.map(mapProduct), batches: batches.map(b => ({ id: String(b.batch_id), productId: String(b.product_id), productName: b.product_name, quantity: b.quantity, bakedDate: b.baked_date, expirationDate: b.expiration_date, notes: b.notes || '' })) }); });
app.patch('/api/inventory/products/:id/stock', auth, staff, async (req, res) => { const stock = Number(req.body?.stock); if (!Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) return fail(res, 400, 'Stock must be a whole number between 0 and 1,000,000.'); await pool.query('UPDATE bread_products SET stock_quantity=? WHERE product_id=?', [stock, req.params.id]); ok(res); });
app.post('/api/inventory/batches', auth, staff, async (req, res) => { const { productId, quantity, bakedDate, expirationDate, notes } = req.body || {}; if (!/^\d+$/.test(String(productId)) || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 1000000 || !/^\d{4}-\d{2}-\d{2}$/.test(clean(bakedDate)) || !/^\d{4}-\d{2}-\d{2}$/.test(clean(expirationDate)) || clean(expirationDate) < clean(bakedDate) || clean(notes).length > 500) return fail(res, 400, 'Valid batch details are required.'); const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [stockRows] = await conn.query('SELECT stock_quantity FROM bread_products WHERE product_id=? FOR UPDATE',[productId]); if(!stockRows.length || Number(stockRows[0].stock_quantity)+Number(quantity)>1000000) throw new Error('Invalid product or stock exceeds maximum.'); await conn.query('INSERT INTO inventory_batches(product_id,quantity,baked_date,expiration_date,notes) VALUES(?,?,?,?,?)', [productId, quantity, bakedDate, expirationDate, clean(notes).slice(0,500)]); await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity+? WHERE product_id=?', [quantity, productId]); await conn.commit(); ok(res); } catch (e) { await conn.rollback(); fail(res, 400, 'Unable to save batch.'); } finally { conn.release(); } });
async function createRequest(req, res, isReservation) {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > 60 || (isReservation && items.length !== 1))
    return fail(res, 400, isReservation ? 'Select one product for your reservation.' : 'Select between 1 and 60 products.');
  const counts = new Map();
  for (const item of items) {
    const id = String(item && item.productId || '');
    const quantity = Number(item && item.quantity);
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)
      return fail(res, 400, 'Invalid product or quantity.', 'INVALID_ITEM');
    counts.set(id, (counts.get(id) || 0) + quantity);
    if (counts.get(id) > 99) return fail(res, 400, 'Maximum quantity is 99 per product.');
  }
  let method = 'pickup', paymentMethod = 'cash', address = '', recipientName = '', recipientMobile = '';
  if (isReservation) {
    const schedule = body.schedule || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(schedule.preferredDate)) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(schedule.preferredTime)) ||
        (clean(schedule.preferredDate) + 'T' + clean(schedule.preferredTime)) <= new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).replace(' ', 'T'))
      return fail(res, 400, 'Choose a valid reservation date and time.', 'INVALID_SCHEDULE');
  } else {
    method = clean(body.fulfillment?.method).toLowerCase();
    paymentMethod = clean(body.paymentMethod).toLowerCase();
    if (!['pickup', 'delivery'].includes(method) || !['cash', 'card', 'gcash'].includes(paymentMethod))
      return fail(res, 400, 'Choose a valid fulfillment and payment method.', 'INVALID_CHECKOUT');
    address = method === 'delivery' ? clean(body.fulfillment?.deliveryAddress) : '';
    recipientName = method === 'delivery' ? clean(body.fulfillment?.recipientName) : '';
    recipientMobile = method === 'delivery' ? clean(body.fulfillment?.recipientMobile) : '';
    if (method === 'delivery' && (!address || !recipientName || !/^09\d{9}$/.test(recipientMobile)))
      return fail(res, 400, 'Choose a complete delivery address and recipient mobile number.', 'INVALID_ADDRESS');
    if (address.length > 500 || recipientName.length > 100)
      return fail(res, 400, 'Delivery details are too long.', 'INVALID_ADDRESS');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ids = [...counts.keys()];
    const [products] = await conn.query(`SELECT * FROM bread_products WHERE product_id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids);
    const byId = new Map(products.map(p => [String(p.product_id), p]));
    let total = 0;
    const normalized = [];
    for (const [id, quantity] of counts) {
      const product = byId.get(id);
      if (!product || product.stock_quantity == null || product.stock_quantity < quantity)
        throw new Error(`Insufficient stock for ${product?.product_name || 'a selected product'}.`);
      total += Number(product.price) * quantity;
      normalized.push({ product, quantity });
    }
    let result;
    if (isReservation) {
      const item = normalized[0];
      const schedule = body.schedule;
      [result] = await conn.query('INSERT INTO reservations(user_id,product_id,quantity,total_amount,preferred_date,preferred_time) VALUES(?,?,?,?,?,?)',
        [req.user.id, item.product.product_id, item.quantity, total, schedule.preferredDate, schedule.preferredTime]);
    } else {
      [result] = await conn.query('INSERT INTO orders(user_id,total_amount,delivery_method,delivery_address,recipient_name,recipient_mobile,payment_method) VALUES(?,?,?,?,?,?,?)',
        [req.user.id, total, method, address || null, recipientName || null, recipientMobile || null, paymentMethod]);
      for (const item of normalized) await conn.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES(?,?,?,?)',
        [result.insertId, item.product.product_id, item.quantity, item.product.price]);
    }
    for (const item of normalized) await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity-? WHERE product_id=?',
      [item.quantity, item.product.product_id]);
    await conn.commit();
    ok(res, { [isReservation ? 'reservation' : 'order']: {
      [isReservation ? 'reservationNumber' : 'orderNumber']: `${isReservation ? 'RES' : 'ORD'}-${String(result.insertId).padStart(5, '0')}`
    }, message: isReservation ? 'Reservation request accepted.' : 'Order accepted.' });
  } catch (error) {
    await conn.rollback();
    fail(res, 400, error.message || 'Unable to create request.');
  } finally { conn.release(); }
}
app.post('/api/orders', auth, (req, res) => { if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY'); return createRequest(req, res, false); });
app.post('/api/reservations', auth, (req, res) => { if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY'); return createRequest(req, res, true); });
// Customers may cancel their own pending orders. Restore the reserved stock exactly once.
app.patch('/api/orders/:id/cancel', auth, async (req, res) => {
  if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY');
  if (!/^\d+$/.test(String(req.params.id))) return fail(res, 400, 'Invalid order ID.', 'INVALID_ID');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT order_status FROM orders WHERE order_id=? AND user_id=? FOR UPDATE', [req.params.id, req.user.id]);
    if (!rows.length) { await conn.rollback(); return fail(res, 404, 'Order not found.', 'NOT_FOUND'); }
    if (normalizeStatus(rows[0].order_status) !== 'pending') { await conn.rollback(); return fail(res, 409, 'Only pending orders can be cancelled.', 'INVALID_TRANSITION'); }
    await conn.query("UPDATE orders SET order_status='Cancelled' WHERE order_id=?", [req.params.id]);
    await restoreReservedStock(conn, 'order', req.params.id);
    await conn.commit();
    ok(res, { status: 'cancelled' });
  } catch (error) {
    await conn.rollback(); console.error('Order cancellation failed:', error.message);
    fail(res, 500, 'Unable to cancel order.');
  } finally { conn.release(); }
});
app.get('/api/orders', auth, async (req, res) => { const [rows] = await pool.query('SELECT o.*,u.username,u.email,u.mobile FROM orders o JOIN users u ON u.user_id=o.user_id WHERE o.user_id=? ORDER BY o.order_date DESC', [req.user.id]); ok(res, { orders: await hydrateOrders(rows) }); });
app.get('/api/reservations', auth, async (req, res) => { const [rows] = await pool.query('SELECT r.*,u.username,u.email,u.mobile FROM reservations r JOIN users u ON u.user_id=r.user_id WHERE r.user_id=? ORDER BY r.reservation_date DESC', [req.user.id]); ok(res, { reservations: await hydrateOrders(rows, true) }); });
app.get('/api/staff/requests', auth, staff, async (_req, res) => { const [o] = await pool.query('SELECT o.*,u.username,u.email,u.mobile FROM orders o JOIN users u ON u.user_id=o.user_id ORDER BY o.order_date DESC'); const [r] = await pool.query('SELECT r.*,u.username,u.email,u.mobile FROM reservations r JOIN users u ON u.user_id=r.user_id ORDER BY r.reservation_date DESC'); ok(res, { orders: await hydrateOrders(o), reservations: await hydrateOrders(r, true) }); });
// Existing SQL schemas store the UI status 'Preparing' as 'Processing'.
// Keep that database enum unchanged so existing XAMPP data does not need migration.
function titleStatus(v) { return ({ pending:'Pending', processing:'Processing', preparing:'Processing', ready:'Ready', completed:'Completed', cancelled:'Cancelled' })[String(v || '').toLowerCase()] || null; }
const STATUS_FLOW = ['pending', 'preparing', 'ready', 'completed'];
async function restoreReservedStock(conn, kind, id) {
  if (kind === 'reservation') {
    await conn.query(`UPDATE bread_products bp JOIN reservations r ON r.product_id=bp.product_id
      SET bp.stock_quantity=bp.stock_quantity+r.quantity WHERE r.reservation_id=?`, [id]);
  } else {
    const [items] = await conn.query('SELECT product_id,quantity FROM order_items WHERE order_id=?', [id]);
    for (const item of items) await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity+? WHERE product_id=?',
      [item.quantity, item.product_id]);
  }
}
async function updateRequestStatus(req, res, kind) {
  const table = kind === 'reservation' ? 'reservations' : 'orders';
  const idColumn = kind === 'reservation' ? 'reservation_id' : 'order_id';
  const column = kind === 'reservation' ? 'reservation_status' : 'order_status';
  const desired = normalizeStatus(req.body?.status);
  if (!STATUS_FLOW.includes(desired) && desired !== 'cancelled') return fail(res, 400, 'Invalid request status.', 'INVALID_STATUS');
  if (!/^\d+$/.test(String(req.params.id))) return fail(res, 400, 'Invalid request ID.', 'INVALID_ID');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(`SELECT ${column} AS status FROM ${table} WHERE ${idColumn}=? FOR UPDATE`, [req.params.id]);
    if (!rows.length) { await conn.rollback(); return fail(res, 404, 'Request not found.', 'NOT_FOUND'); }
    const current = normalizeStatus(rows[0].status);
    if (current === desired) { await conn.rollback(); return ok(res, { status: desired }); }
    const next = STATUS_FLOW[STATUS_FLOW.indexOf(current) + 1];
    const valid = desired === next || (desired === 'cancelled' && req.user.role === 'admin' && STATUS_FLOW.slice(0, -1).includes(current));
    if (!valid) { await conn.rollback(); return fail(res, 409, 'Choose the next status in the workflow.', 'INVALID_TRANSITION'); }

    const [result] = await conn.query(`UPDATE ${table} SET ${column}=? WHERE ${idColumn}=? AND ${column}=?`, [titleStatus(desired), req.params.id, rows[0].status]);
    if (!result.affectedRows) { await conn.rollback(); return fail(res, 409, 'Request was updated elsewhere; refresh and try again.', 'STATUS_CONFLICT'); }

    if (desired === 'cancelled') await restoreReservedStock(conn, kind, req.params.id);

    if (desired === 'completed') {
      // This is committed with the status update, so an order cannot be completed without its notification.
      await conn.query(`INSERT IGNORE INTO customer_notifications (user_id, request_type, request_id)
        SELECT user_id, ?, ${idColumn} FROM ${table} WHERE ${idColumn}=?`, [kind, req.params.id]);
    }
    await conn.commit();
    ok(res, { status: desired });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

// Customer-only notifications, scoped by the authenticated user ID (never by a client-supplied email).
app.get('/api/notifications', auth, async (req, res) => {
  if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY');
  try {
    // Include completed requests from before this feature was installed, once per customer/request.
    await pool.query(`INSERT IGNORE INTO customer_notifications (user_id, request_type, request_id)
      SELECT user_id, 'order', order_id FROM orders WHERE user_id=? AND order_status='Completed'`, [req.user.id]);
    await pool.query(`INSERT IGNORE INTO customer_notifications (user_id, request_type, request_id)
      SELECT user_id, 'reservation', reservation_id FROM reservations WHERE user_id=? AND reservation_status='Completed'`, [req.user.id]);
    const [rows] = await pool.query(`SELECT notification_id, request_type, request_id, is_read, created_at
      FROM customer_notifications WHERE user_id=? ORDER BY created_at DESC, notification_id DESC LIMIT 100`, [req.user.id]);
    ok(res, { notifications: rows.map(row => {
      const reservation = row.request_type === 'reservation';
      const reference = `${reservation ? 'RES' : 'ORD'}-${String(row.request_id).padStart(5, '0')}`;
      return {
        id: String(row.notification_id), type: row.request_type, reference,
        message: `Your ${reservation ? 'reservation' : 'order'} ${reference} has been completed.`,
        read: !!row.is_read, createdAt: row.created_at
      };
    }) });
  } catch (error) { console.error('Notifications could not be loaded:', error.message); fail(res, 500, 'Unable to load notifications.'); }
});
app.patch('/api/notifications/read', auth, async (req, res) => {
  if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY');
  try { await pool.query('UPDATE customer_notifications SET is_read=1 WHERE user_id=?', [req.user.id]); ok(res); }
  catch (error) { fail(res, 500, 'Unable to mark notifications as read.'); }
});
app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY');
  if (!/^\d+$/.test(String(req.params.id))) return fail(res, 400, 'Invalid notification ID.', 'INVALID_ID');
  try { await pool.query('UPDATE customer_notifications SET is_read=1 WHERE notification_id=? AND user_id=?', [req.params.id, req.user.id]); ok(res); }
  catch (error) { fail(res, 500, 'Unable to mark notification as read.'); }
});

app.patch('/api/orders/:id/status', auth, staff, (req, res) => updateRequestStatus(req, res, 'order').catch(() => fail(res, 500, 'Unable to update order status.')));
app.patch('/api/reservations/:id/status', auth, staff, (req, res) => updateRequestStatus(req, res, 'reservation').catch(() => fail(res, 500, 'Unable to update reservation status.')));
app.get('/api/admin/state', auth, admin, async (_req, res) => { const [categories] = await pool.query('SELECT category_id,category_name FROM categories ORDER BY category_name'); const [products] = await pool.query("SELECT bp.*, c.category_name, CASE LOWER(c.category_name) WHEN 'breads' THEN 'bread' WHEN 'cakes' THEN 'cake' WHEN 'doughnuts' THEN 'doughnut' WHEN 'pies' THEN 'pie' ELSE LOWER(REPLACE(c.category_name, ' ', '-')) END AS category_slug FROM bread_products bp JOIN categories c ON c.category_id=bp.category_id ORDER BY bp.product_name"); const [users] = await pool.query('SELECT * FROM users ORDER BY created_at DESC'); const [o] = await pool.query('SELECT o.*,u.username,u.email,u.mobile FROM orders o JOIN users u ON u.user_id=o.user_id ORDER BY o.order_date DESC'); const [r] = await pool.query('SELECT r.*,u.username,u.email,u.mobile FROM reservations r JOIN users u ON u.user_id=r.user_id ORDER BY r.reservation_date DESC'); const [batches] = await pool.query('SELECT b.*,p.product_name FROM inventory_batches b JOIN bread_products p ON p.product_id=b.product_id ORDER BY b.created_at DESC'); const [logs] = await pool.query('SELECT log_date AS t, description AS text FROM system_logs ORDER BY log_date DESC, log_id DESC LIMIT 200'); ok(res, { categories: categories.map(c=>({id:String(c.category_id),name:c.category_name})), products: products.map(mapProduct), users: users.map(userView), orders: await hydrateOrders(o), reservations: await hydrateOrders(r,true), batches: batches.map(b=>({id:String(b.batch_id),productId:String(b.product_id),productName:b.product_name,quantity:b.quantity,bakedDate:b.baked_date,expirationDate:b.expiration_date,notes:b.notes||''})), logs: logs.map(l=>({t:l.t,text:l.text})) }); });
// Admin operations are saved through explicit, validated database actions.
// A successful response means the transaction was committed, not just staged in the browser.
app.post('/api/admin/action', auth, admin, async (req, res) => {
  const { action, data = {} } = req.body || {};
  const id = clean(data.id);
  const validId = /^\d+$/.test(id);
  const title = clean(data.name);
  const number = Number(data.quantity ?? data.stock);
  const price = Number(data.price);
  const safeRole = {admin:'Admin',staff:'Staff',customer:'Customer'}[clean(data.role).toLowerCase()];
  const resultError = (message, code = 'INVALID_INPUT') => fail(res, 400, message, code);
  if (![
    'add-category','edit-category','delete-category',
    'add-product','edit-product','delete-product','save-stock',
    'add-batch','discard-batch', 'add-user','delete-user','set-role',
    'delete-order','delete-reservation'
  ].includes(action)) return resultError('Unsupported admin action.');
  if (['edit-category','delete-category','edit-product','delete-product','save-stock','discard-batch','delete-user','set-role','delete-order','delete-reservation'].includes(action) && !validId)
    return resultError('Invalid record ID.');
  if (['add-category','edit-category','add-product','edit-product'].includes(action) && (!title || title.length > 100))
    return resultError('Enter a valid name.');
  if (['add-product','edit-product'].includes(action) && (!/^\d+$/.test(String(data.category)) || !Number.isFinite(price) || price < 0 || price > 1000000))
    return resultError('Choose a valid category and price.');
  if (action === 'save-stock' && (!Number.isSafeInteger(number) || number < 0 || number > 1000000))
    return resultError('Stock must be a whole number between 0 and 1,000,000.');
  if (action === 'add-batch' && (!/^\d+$/.test(String(data.productId)) || !Number.isSafeInteger(number) || number < 1 || number > 1000000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(clean(data.bakedDate)) || !/^\d{4}-\d{2}-\d{2}$/.test(clean(data.expirationDate)) || clean(data.expirationDate) < clean(data.bakedDate) || clean(data.notes).length > 500))
    return resultError('Invalid fresh batch details.');
  if (action === 'add-user' && (!title || title.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(data.email)) || !safeRole ||
      typeof data.password !== 'string' || data.password.length < 8))
    return resultError('Enter a name, valid email, role, and password of at least 8 characters.');
  if (action === 'set-role' && !safeRole) return resultError('Choose a valid role.');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const numericId = Number(id);
    switch (action) {
      case 'add-category':
        if (title.length > 50) throw new Error('Category names must be 50 characters or fewer.');
        await conn.query('INSERT INTO categories(category_name) VALUES(?)', [title]); break;
      case 'edit-category':
        if (title.length > 50) throw new Error('Category names must be 50 characters or fewer.');
        if (!(await conn.query('UPDATE categories SET category_name=? WHERE category_id=?', [title, numericId]))[0].affectedRows) throw new Error('Category not found.'); break;
      case 'delete-category':
        if (!(await conn.query('DELETE FROM categories WHERE category_id=?', [numericId]))[0].affectedRows) throw new Error('Category not found.'); break;
      case 'add-product':
        await conn.query('INSERT INTO bread_products(category_id,product_name,price,stock_quantity) VALUES(?,?,?,0)', [data.category,title,price]); break;
      case 'edit-product':
        if (!(await conn.query('UPDATE bread_products SET product_name=?,category_id=?,price=? WHERE product_id=?', [title,data.category,price,numericId]))[0].affectedRows) throw new Error('Product not found.'); break;
      case 'delete-product':
        if (!(await conn.query('DELETE FROM bread_products WHERE product_id=?', [numericId]))[0].affectedRows) throw new Error('Product not found.'); break;
      case 'save-stock':
        if (!(await conn.query('UPDATE bread_products SET stock_quantity=? WHERE product_id=?', [number,numericId]))[0].affectedRows) throw new Error('Product not found.'); break;
      case 'add-batch': {
        const [stocks] = await conn.query('SELECT stock_quantity FROM bread_products WHERE product_id=? FOR UPDATE',[data.productId]);
        if (!stocks.length) throw new Error('Product not found.');
        if (Number(stocks[0].stock_quantity || 0)+number > 1000000) throw new Error('Stock cannot exceed 1,000,000.');
        await conn.query('INSERT INTO inventory_batches(product_id,quantity,baked_date,expiration_date,notes) VALUES(?,?,?,?,?)',
          [data.productId,number,data.bakedDate,data.expirationDate,clean(data.notes)]);
        await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity+? WHERE product_id=?',[number,data.productId]); break;
      }
      case 'discard-batch': {
        const [rows] = await conn.query('SELECT product_id,quantity FROM inventory_batches WHERE batch_id=? FOR UPDATE',[numericId]);
        if (!rows.length) throw new Error('Batch not found.');
        const [stocks] = await conn.query('SELECT stock_quantity FROM bread_products WHERE product_id=? FOR UPDATE',[rows[0].product_id]);
        if (!stocks.length || Number(stocks[0].stock_quantity) < Number(rows[0].quantity)) throw new Error('Not enough stock remains to discard this batch.');
        await conn.query('DELETE FROM inventory_batches WHERE batch_id=?',[numericId]);
        await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity-? WHERE product_id=?',[rows[0].quantity,rows[0].product_id]); break;
      }
      case 'add-user': {
        const hash = await bcrypt.hash(data.password,12);
        await conn.query('INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,?)',[title,clean(data.email).toLowerCase(),hash,safeRole]); break;
      }
      case 'set-role': {
        if (String(req.user.id) === id) throw new Error('You cannot change your own administrator role.');
        if (!(await conn.query('UPDATE users SET role=? WHERE user_id=?',[safeRole,numericId]))[0].affectedRows) throw new Error('User not found.');
        break;
      }
      case 'delete-user': {
        if (String(req.user.id) === id) throw new Error('You cannot delete your own administrator account.');
        if (!(await conn.query('DELETE FROM users WHERE user_id=?',[numericId]))[0].affectedRows) throw new Error('User not found.');
        break;
      }
      case 'delete-order':
      case 'delete-reservation': {
        const reservation = action === 'delete-reservation';
        const table = reservation ? 'reservations' : 'orders';
        const pk = reservation ? 'reservation_id' : 'order_id';
        const status = reservation ? 'reservation_status' : 'order_status';
        const [rows] = await conn.query(`SELECT ${status} AS status FROM ${table} WHERE ${pk}=? FOR UPDATE`,[numericId]);
        if (!rows.length) throw new Error('Request not found.');
        if (normalizeStatus(rows[0].status) !== 'cancelled') throw new Error('Only cancelled requests may be deleted. Completed sales are kept as records.');
        await conn.query('DELETE FROM customer_notifications WHERE request_type=? AND request_id=?', [reservation?'reservation':'order',numericId]);
        await conn.query(`DELETE FROM ${table} WHERE ${pk}=?`,[numericId]); break;
      }
    }
    await conn.query('INSERT INTO system_logs(user_id,action_type,description) VALUES(?,?,?)',
      [req.user.id, String(action).slice(0,50), `${action}: ${title || id || clean(data.productId)}`.slice(0,500)]);
    await conn.commit();
    if (action === 'delete-user' || action === 'set-role') for (const [token, user] of sessions) {
      if (user.id === id) sessions.delete(token);
    }
    ok(res);
  } catch (error) {
    await conn.rollback();
    console.error('Admin action failed:', action, error.message);
    let message = error.message || 'Unable to save admin changes.';
    if (error.code === 'ER_DUP_ENTRY') message = 'A record with that name or email already exists.';
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') message = 'This record is in use and cannot be deleted.';
    fail(res, error.code === 'ER_DUP_ENTRY' ? 409 : 400, message, 'ADMIN_ACTION_FAILED');
  } finally { conn.release(); }
});

const customerRoot = path.join(__dirname, 'PANADERO-COSTUMER/PANADERO-COSTUMER/PANADERO-COSTUMER');
// A single real login page is hosted at /customer/login.html.
// Keep this backwards-compatible alias for old bookmarks and links.
app.get('/login.html', (_req, res) => res.redirect(302, '/customer/login.html'));
app.get('/signin', (_req, res) => res.redirect(302, '/customer/login.html'));
app.use('/customer', express.static(customerRoot));
app.use('/staff', express.static(path.join(__dirname, 'PANADERO-STAFF/PANADERO-STAFF')));
app.use('/admin', express.static(path.join(__dirname, 'PANADERO-ADMIN/Panadero-Admin/admin')));
app.get('/', (_req,res) => res.redirect(302, '/customer/login.html'));
export default app;
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 3000);
  databaseReady.then(() => app.listen(port, '127.0.0.1', () => console.log(`Panadero server listening on ${port}`))).catch(e => { console.error('Database migration failed:', e.message); process.exit(1); });
}
