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
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'panadero_bakery', waitForConnections: true,
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
const userView = u => { const names = clean(u.username).split(/\s+/); return { id: String(u.user_id), firstName: names[0] || '', lastName: names.slice(1).join(' '), displayName: u.username || u.email, email: u.email, mobile: '', role: role(u.role) }; };
async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS reservations (reservation_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL, total_amount DECIMAL(10,2) NOT NULL, preferred_date DATE NOT NULL, preferred_time TIME NOT NULL, reservation_status ENUM('Pending','Processing','Ready','Completed','Cancelled') NOT NULL DEFAULT 'Pending', reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE RESTRICT, FOREIGN KEY(product_id) REFERENCES bread_products(product_id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS inventory_batches (batch_id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, quantity INT NOT NULL, baked_date DATE NOT NULL, expiration_date DATE NOT NULL, notes VARCHAR(500), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(product_id) REFERENCES bread_products(product_id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
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
    const [catCount] = await conn.query('SELECT COUNT(*) AS n FROM categories');
    if (!catCount[0].n) await conn.query("INSERT INTO categories(category_name,description) VALUES ('Breads','Fresh breads'),('Cakes','Cakes and cheesecakes'),('Doughnuts','Doughnuts and pastries'),('Pies','Fresh pies')");
    const [prodCount] = await conn.query('SELECT COUNT(*) AS n FROM bread_products');
    if (!prodCount[0].n) { const [cats] = await conn.query('SELECT category_id,category_name FROM categories'); const ids=Object.fromEntries(cats.map(c=>[c.category_name,c.category_id])); const seed=[['Baguette','Breads',65],['Croissant','Breads',55],['Pan de Sal','Breads',5],['Cinnamon Roll','Breads',45],['Chocolate Cake','Cakes',450],['Lemon & Lime Cheesecake','Cakes',650],['Chiffon Cake','Cakes',350],['Bavarian-Filled Doughnut','Doughnuts',35],['Beignet','Doughnuts',30],['Long John','Doughnuts',35],['Cruller','Doughnuts',35],['Apple Pie','Pies',300],['Blueberry Pie','Pies',350],['Egg Pie','Pies',250],['Lemon Meringue Pie','Pies',350]]; for (const [name,cat,price] of seed) await conn.query('INSERT INTO bread_products(category_id,product_name,price,stock_quantity) VALUES(?,?,?,100)',[ids[cat],name,price]); }
    const demoUsers = [['System Admin','admin@panadero.local','Admin123!','Admin'],['Bakery Staff','staff@panadero.local','Staff123!','Staff']];
    for (const [username,email,password,userRole] of demoUsers) { const [found] = await conn.query('SELECT user_id FROM users WHERE email=?',[email]); if (!found.length) { const hash = await bcrypt.hash(password, 12); await conn.query('INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,?)',[username,email,hash,userRole]); } }
  } finally { conn.release(); }
}
function auth(req, res, next) { const token = clean(req.headers.authorization).replace(/^Bearer\s+/i, ''); const session = sessions.get(token); if (!session) return fail(res, 401, 'Please sign in first.', 'UNAUTHORIZED'); req.user = session; next(); }
function staff(req, res, next) { if (!req.user) return fail(res, 401, 'Please sign in first.', 'UNAUTHORIZED'); if (!['admin', 'staff'].includes(req.user.role)) return fail(res, 403, 'Staff access required.', 'FORBIDDEN'); next(); }
function admin(req, res, next) { if (!req.user) return fail(res, 401, 'Please sign in first.', 'UNAUTHORIZED'); if (req.user.role !== 'admin') return fail(res, 403, 'Admin access required.', 'FORBIDDEN'); next(); }
function tokenFor(user) { const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user); return token; }
function mapProduct(row) { return { id: String(row.product_id), productId: String(row.product_id), slug: row.product_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name: row.product_name, category: row.category_slug || String(row.category_id), price: Number(row.price), stock: row.stock_quantity == null ? null : Number(row.stock_quantity), available: Number(row.stock_quantity) !== 0, image: '', description: '' }; }
const normalizeStatus = v => String(v || 'Pending').toLowerCase() === 'processing' ? 'preparing' : String(v || 'Pending').toLowerCase();
function publicRecord(r, items) { return { id: String(r.order_id || r.reservation_id), type: r.order_id ? 'order' : 'reservation', orderNumber: r.order_id ? `ORD-${String(r.order_id).padStart(5, '0')}` : undefined, reservationNumber: r.reservation_id ? `RES-${String(r.reservation_id).padStart(5, '0')}` : undefined, total: Number(r.total_amount), status: normalizeStatus(r.order_status || r.reservation_status || 'Pending'), createdAt: r.order_date || r.reservation_date, customer: { firstName: clean(r.username).split(/\s+/)[0] || '', lastName: clean(r.username).split(/\s+/).slice(1).join(' '), email: r.email || '', mobile: '' }, items: items || [], fulfillment: r.fulfillment || {}, schedule: r.schedule || {} }; }
async function hydrateOrders(rows, reservation = false) { const out = []; for (const r of rows) { const id = reservation ? r.reservation_id : r.order_id; const [items] = await pool.query(`SELECT ${reservation ? 'ri.quantity, (ri.total_amount / NULLIF(ri.quantity, 0)) AS unit_price, bp.product_id, bp.product_name FROM reservations ri JOIN bread_products bp ON bp.product_id=ri.product_id WHERE ri.reservation_id=?' : 'oi.quantity, oi.unit_price, bp.product_id, bp.product_name FROM order_items oi JOIN bread_products bp ON bp.product_id=oi.product_id WHERE oi.order_id=?'}`, [id]); out.push(publicRecord(r, items.map(i => ({ productId: String(i.product_id), name: i.product_name, quantity: Number(i.quantity), price: Number(i.unit_price), lineTotal: Number(i.unit_price) * Number(i.quantity) })))); } return out; }

// Used by the Windows launcher to detect a stale server on port 3000.
app.get('/api/build', (_req, res) => ok(res, { app: 'PANADERO', build: 'panadero-customer-notifications-20261009-r3' }));
app.get('/api/health', async (_req, res) => { try { await pool.query('SELECT 1'); ok(res, { database: true }); } catch (e) { fail(res, 503, 'Database connection failed.', 'DB_UNAVAILABLE'); } });
app.post('/api/auth/register', async (req, res) => { const { firstName, lastName, email, mobile, password } = req.body || {}; if (!clean(firstName) || !clean(lastName) || !clean(email) || !clean(password)) return fail(res, 400, 'Complete all required fields.'); try { const [exists] = await pool.query('SELECT user_id FROM users WHERE email=?', [clean(email)]); if (exists.length) return fail(res, 409, 'That email is already registered.', 'DUPLICATE_EMAIL'); const hash = await bcrypt.hash(password, 12); const [r] = await pool.query('INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,\'Customer\')', [`${clean(firstName)} ${clean(lastName)}`, clean(email).toLowerCase(), hash]); const user = { id: String(r.insertId), firstName: clean(firstName), lastName: clean(lastName), displayName: `${clean(firstName)} ${clean(lastName)}`, email: clean(email).toLowerCase(), mobile: clean(mobile), role: 'customer' }; const token = tokenFor(user); ok(res, { user, token }); } catch (e) { fail(res, 500, 'Registration failed.'); } });
app.post('/api/auth/login', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [clean(req.body?.email).toLowerCase()]); if (!rows.length || !(await bcrypt.compare(String(req.body?.password || ''), rows[0].password_hash))) return fail(res, 401, 'Invalid email or password.', 'INVALID_LOGIN'); const user = userView(rows[0]); ok(res, { user, token: tokenFor(user) }); } catch (e) { fail(res, 500, 'Login failed.'); } });
app.post('/api/auth/logout', auth, (req, res) => { for (const [key, value] of sessions) if (value.id === req.user.id) sessions.delete(key); ok(res); });
app.post('/api/auth/password-reset', async (req, res) => { const [rows] = await pool.query('SELECT user_id FROM users WHERE email=?', [clean(req.body?.email).toLowerCase()]); ok(res, { message: rows.length ? 'Password reset request recorded. Contact the bakery administrator to complete it.' : 'If that email exists, a reset request has been recorded.' }); });
app.get('/api/catalog', async (_req, res) => { try { const [categories] = await pool.query('SELECT category_id,category_name,description FROM categories ORDER BY category_name'); const [products] = await pool.query("SELECT bp.*, c.category_name, CASE LOWER(c.category_name) WHEN 'breads' THEN 'bread' WHEN 'cakes' THEN 'cake' WHEN 'doughnuts' THEN 'doughnut' WHEN 'pies' THEN 'pie' ELSE LOWER(REPLACE(c.category_name, ' ', '-')) END AS category_slug FROM bread_products bp JOIN categories c ON c.category_id=bp.category_id ORDER BY bp.product_name"); ok(res, { categories: categories.map(c => ({ id: String(c.category_id), name: c.category_name, description: c.description || '' })), products: products.map(mapProduct) }); } catch (e) { fail(res, 500, 'Unable to load catalog.'); } });
app.get('/api/inventory', auth, staff, async (_req, res) => { const [categories] = await pool.query('SELECT category_id,category_name FROM categories ORDER BY category_name'); const [products] = await pool.query("SELECT bp.*, c.category_name, CASE LOWER(c.category_name) WHEN 'breads' THEN 'bread' WHEN 'cakes' THEN 'cake' WHEN 'doughnuts' THEN 'doughnut' WHEN 'pies' THEN 'pie' ELSE LOWER(REPLACE(c.category_name, ' ', '-')) END AS category_slug FROM bread_products bp JOIN categories c ON c.category_id=bp.category_id ORDER BY bp.product_name"); const [batches] = await pool.query('SELECT b.*,p.product_name FROM inventory_batches b JOIN bread_products p ON p.product_id=b.product_id ORDER BY b.created_at DESC'); ok(res, { categories: categories.map(c => ({ id: String(c.category_id), name: c.category_name })), products: products.map(mapProduct), batches: batches.map(b => ({ id: String(b.batch_id), productId: String(b.product_id), productName: b.product_name, quantity: b.quantity, bakedDate: b.baked_date, expirationDate: b.expiration_date, notes: b.notes || '' })) }); });
app.patch('/api/inventory/products/:id/stock', auth, staff, async (req, res) => { const stock = Number(req.body?.stock); if (!Number.isSafeInteger(stock) || stock < 0) return fail(res, 400, 'Stock must be a whole number of at least zero.'); await pool.query('UPDATE bread_products SET stock_quantity=? WHERE product_id=?', [stock, req.params.id]); ok(res); });
app.post('/api/inventory/batches', auth, staff, async (req, res) => { const { productId, quantity, bakedDate, expirationDate, notes } = req.body || {}; if (!Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || !bakedDate || !expirationDate) return fail(res, 400, 'Valid batch details are required.'); const conn = await pool.getConnection(); try { await conn.beginTransaction(); await conn.query('INSERT INTO inventory_batches(product_id,quantity,baked_date,expiration_date,notes) VALUES(?,?,?,?,?)', [productId, quantity, bakedDate, expirationDate, clean(notes).slice(0,500)]); await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity+? WHERE product_id=?', [quantity, productId]); await conn.commit(); ok(res); } catch (e) { await conn.rollback(); fail(res, 400, 'Unable to save batch.'); } finally { conn.release(); } });
async function createRequest(req, res, isReservation) { const b = req.body || {}; const items = Array.isArray(b.items) ? b.items : []; if (!items.length) return fail(res, 400, 'At least one product is required.'); const conn = await pool.getConnection(); try { await conn.beginTransaction(); const email = clean(b.customer?.email).toLowerCase(); let userId = req.user?.id; if (!userId) { const [users] = await conn.query('SELECT user_id FROM users WHERE email=?', [email]); if (users.length) userId = users[0].user_id; else { const hash = await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10); const [r] = await conn.query('INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,\'Customer\')', [`${clean(b.customer?.firstName)} ${clean(b.customer?.lastName)}`.trim() || email, email, hash]); userId = r.insertId; } } const ids = items.map(i => i.productId); const [products] = await conn.query(`SELECT * FROM bread_products WHERE product_id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids); const byId = new Map(products.map(p => [String(p.product_id), p])); let total = 0; const normalized = []; for (const item of items) { const p = byId.get(String(item.productId)); const q = Number(item.quantity); if (!p || !Number.isSafeInteger(q) || q < 1 || p.stock_quantity < q) throw new Error(`Insufficient stock for ${p?.product_name || 'product'}.`); total += Number(p.price) * q; normalized.push({ p, q }); } let result; if (isReservation) { const d = b.schedule || {}; [result] = await conn.query('INSERT INTO reservations(user_id,product_id,quantity,total_amount,preferred_date,preferred_time) VALUES(?,?,?,?,?,?)', [userId, normalized[0].p.product_id, normalized[0].q, total, d.preferredDate, d.preferredTime]); } else { [result] = await conn.query('INSERT INTO orders(user_id,total_amount) VALUES(?,?)', [userId, total]); for (const i of normalized) await conn.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES(?,?,?,?)', [result.insertId, i.p.product_id, i.q, i.p.price]); } for (const i of normalized) await conn.query('UPDATE bread_products SET stock_quantity=stock_quantity-? WHERE product_id=?', [i.q, i.p.product_id]); await conn.commit(); ok(res, { [isReservation ? 'reservation' : 'order']: { [isReservation ? 'reservationNumber' : 'orderNumber']: `${isReservation ? 'RES' : 'ORD'}-${String(result.insertId).padStart(5, '0')}` }, message: isReservation ? 'Reservation request accepted.' : 'Order accepted.' }); } catch (e) { await conn.rollback(); fail(res, 400, e.message || 'Unable to create request.'); } finally { conn.release(); } }
app.post('/api/orders', auth, (req, res) => { if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY'); return createRequest(req, res, false); });
app.post('/api/reservations', auth, (req, res) => { if (req.user.role !== 'customer') return fail(res, 403, 'Customer account required.', 'CUSTOMER_ONLY'); return createRequest(req, res, true); });
app.get('/api/orders', auth, async (req, res) => { const [rows] = await pool.query('SELECT o.*,u.username,u.email FROM orders o JOIN users u ON u.user_id=o.user_id WHERE o.user_id=? ORDER BY o.order_date DESC', [req.user.id]); ok(res, { orders: await hydrateOrders(rows) }); });
app.get('/api/reservations', auth, async (req, res) => { const [rows] = await pool.query('SELECT r.*,u.username,u.email FROM reservations r JOIN users u ON u.user_id=r.user_id WHERE r.user_id=? ORDER BY r.reservation_date DESC', [req.user.id]); ok(res, { reservations: await hydrateOrders(rows, true) }); });
app.get('/api/staff/requests', auth, staff, async (_req, res) => { const [o] = await pool.query('SELECT o.*,u.username,u.email FROM orders o JOIN users u ON u.user_id=o.user_id ORDER BY o.order_date DESC'); const [r] = await pool.query('SELECT r.*,u.username,u.email FROM reservations r JOIN users u ON u.user_id=r.user_id ORDER BY r.reservation_date DESC'); ok(res, { orders: await hydrateOrders(o), reservations: await hydrateOrders(r, true) }); });
// Existing SQL schemas store the UI status 'Preparing' as 'Processing'.
// Keep that database enum unchanged so existing XAMPP data does not need migration.
function titleStatus(v) { return ({ pending:'Pending', processing:'Processing', preparing:'Processing', ready:'Ready', completed:'Completed', cancelled:'Cancelled' })[String(v || '').toLowerCase()] || null; }
const STATUS_FLOW = ['pending', 'preparing', 'ready', 'completed'];
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
app.get('/api/admin/state', auth, admin, async (_req, res) => { const [categories] = await pool.query('SELECT category_id,category_name FROM categories ORDER BY category_name'); const [products] = await pool.query("SELECT bp.*, c.category_name, CASE LOWER(c.category_name) WHEN 'breads' THEN 'bread' WHEN 'cakes' THEN 'cake' WHEN 'doughnuts' THEN 'doughnut' WHEN 'pies' THEN 'pie' ELSE LOWER(REPLACE(c.category_name, ' ', '-')) END AS category_slug FROM bread_products bp JOIN categories c ON c.category_id=bp.category_id ORDER BY bp.product_name"); const [users] = await pool.query('SELECT * FROM users ORDER BY created_at DESC'); const [o] = await pool.query('SELECT o.*,u.username,u.email FROM orders o JOIN users u ON u.user_id=o.user_id ORDER BY o.order_date DESC'); const [r] = await pool.query('SELECT r.*,u.username,u.email FROM reservations r JOIN users u ON u.user_id=r.user_id ORDER BY r.reservation_date DESC'); const [batches] = await pool.query('SELECT b.*,p.product_name FROM inventory_batches b JOIN bread_products p ON p.product_id=b.product_id ORDER BY b.created_at DESC'); ok(res, { categories: categories.map(c=>({id:String(c.category_id),name:c.category_name})), products: products.map(mapProduct), users: users.map(userView), orders: await hydrateOrders(o), reservations: await hydrateOrders(r,true), batches: batches.map(b=>({id:String(b.batch_id),productId:String(b.product_id),productName:b.product_name,quantity:b.quantity,bakedDate:b.baked_date,expirationDate:b.expiration_date,notes:b.notes||''})), logs: [] }); });
app.post('/api/admin/sync', auth, admin, async (req,res) => { const s=req.body||{}; const conn=await pool.getConnection(); try { await conn.beginTransaction(); for (const c of s.categories||[]) { if (/^\d+$/.test(String(c.id))) await conn.query('UPDATE categories SET category_name=? WHERE category_id=?',[c.name,c.id]); else { const [x]=await conn.query('INSERT IGNORE INTO categories(category_name) VALUES(?)',[c.name]); c.id=String(x.insertId); } } for (const p of s.products||[]) { const [cats]=await conn.query('SELECT category_id FROM categories WHERE category_id=? OR category_name=?',[p.category,p.category]); const cid=cats[0]?.category_id; if (!cid) continue; if (/^\d+$/.test(String(p.id))) await conn.query('UPDATE bread_products SET product_name=?,category_id=?,price=? WHERE product_id=?',[p.name,cid,p.price,p.id]); else await conn.query('INSERT INTO bread_products(category_id,product_name,price) VALUES(?,?,?)',[cid,p.name,p.price]); } for (const u of s.users||[]) { if (/^\d+$/.test(String(u.id))) await conn.query('UPDATE users SET username=?,email=?,role=? WHERE user_id=?',[u.displayName||u.name||u.email,u.email,({admin:'Admin',staff:'Staff',customer:'Customer'}[u.role]||'Customer'),u.id]); } for (const [id,stock] of Object.entries(s.stocks||{})) await conn.query('UPDATE bread_products SET stock_quantity=? WHERE product_id=?',[Number(stock.stock)||0,id]); /* Order/reservation statuses are saved only through the validated PATCH routes. */ await conn.commit(); ok(res); } catch(e) { await conn.rollback(); fail(res,400,'Admin changes could not be saved.'); } finally { conn.release(); } });

const customerRoot = path.join(__dirname, 'PANADERO-COSTUMER/PANADERO-COSTUMER/PANADERO-COSTUMER');
// A single real login page is hosted at /customer/login.html.
// Keep this backwards-compatible alias for old bookmarks and links.
app.get('/login.html', (_req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signin', (_req, res) => res.redirect(302, '/login.html'));
app.use('/customer', express.static(customerRoot));
app.use('/staff', express.static(path.join(__dirname, 'PANADERO-STAFF/PANADERO-STAFF')));
app.use('/admin', express.static(path.join(__dirname, 'PANADERO-ADMIN/Panadero-Admin/admin')));
app.get('/', (_req,res) => res.redirect(302, '/login.html'));
export default app;
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 3000);
  databaseReady.then(() => app.listen(port, '0.0.0.0', () => console.log(`Panadero server listening on ${port}`))).catch(e => { console.error('Database migration failed:', e.message); process.exit(1); });
}
