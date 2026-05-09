const { v4: uuidv4 } = require('uuid');
const { toSqlUtc } = require('../../utils/time');
const { hashPassword, verifyPassword } = require('../../utils/password');

let _getDb, _getSetting, _addAuditLog, _ensureUserHasAllNodeUuids, _removeFromRegisterWhitelist;

function init(deps) {
  _getDb = deps.getDb;
  _getSetting = deps.getSetting;
  _addAuditLog = deps.addAuditLog;
  _ensureUserHasAllNodeUuids = deps.ensureUserHasAllNodeUuids;
  _removeFromRegisterWhitelist = deps.removeFromRegisterWhitelist;
}

/**
 * 创建新用户（用户名 + 密码）
 * @param {object} opts
 * @param {string} opts.username
 * @param {string} opts.password
 * @param {boolean} [opts.isAdmin]  显式指定；不传时：第一个注册用户自动成为管理员
 * @param {number} [opts.trustLevel]
 * @param {string} [opts.name]
 * @param {string} [opts.email]
 * @param {number} [opts.trafficLimit]  覆盖默认流量上限（bytes）；不传时使用 settings.default_traffic_limit
 * @param {string} [opts.expiresAt]  ISO 字符串或 SQL datetime
 * @returns {object} 新用户行
 */
function createUser({ username, password, isAdmin, trustLevel = 0, name = null, email = null, trafficLimit, expiresAt = null } = {}) {
  const uname = String(username || '').trim();
  if (!uname) throw new Error('用户名不能为空');
  if (uname.length > 64) throw new Error('用户名过长');
  if (typeof password !== 'string' || password.length === 0) throw new Error('密码不能为空');

  const db = _getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').get(uname);
  if (existing) throw new Error('用户名已被占用');

  const pwHash = hashPassword(password);
  const subToken = uuidv4();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const adminFlag = (typeof isAdmin === 'boolean') ? (isAdmin ? 1 : 0) : (userCount === 0 ? 1 : 0);
  const defaultLimit = (typeof trafficLimit === 'number')
    ? Math.max(0, Math.round(trafficLimit))
    : (parseInt(_getSetting('default_traffic_limit')) || 0);

  const info = db.prepare(`
    INSERT INTO users (username, name, email, password_hash, sub_token, is_admin, trust_level, traffic_limit, expires_at, last_login)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uname, name, email, pwHash, subToken, adminFlag, trustLevel, defaultLimit, expiresAt || null);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  if (adminFlag) console.log(`👑 用户 ${uname} 已设为管理员`);

  _addAuditLog(null, 'user_register', `新用户创建: ${uname}${adminFlag ? ' (管理员)' : ''}`, 'system');

  try { const { notify } = require('../notify'); notify.userRegister(uname, { ...newUser, trust_level: trustLevel }); } catch {}

  if (typeof _ensureUserHasAllNodeUuids === 'function') {
    _ensureUserHasAllNodeUuids(newUser.id);
  }
  if (typeof _removeFromRegisterWhitelist === 'function') {
    _removeFromRegisterWhitelist(uname);
  }
  return newUser;
}

function setPassword(userId, newPassword) {
  if (!userId) throw new Error('userId 必填');
  if (typeof newPassword !== 'string' || !newPassword) throw new Error('密码不能为空');
  const pwHash = hashPassword(newPassword);
  _getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pwHash, userId);
}

function verifyUserPassword(username, password) {
  const uname = String(username || '').trim();
  if (!uname || !password) return null;
  const row = _getDb().prepare('SELECT * FROM users WHERE username = ? LIMIT 1').get(uname);
  if (!row || !row.password_hash) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return row;
}

function renameUser(userId, newUsername) {
  const uname = String(newUsername || '').trim();
  if (!uname) throw new Error('用户名不能为空');
  const db = _getDb();
  const clash = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(uname, userId);
  if (clash) throw new Error('用户名已被占用');
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(uname, userId);
}

function getUserBySubToken(token) {
  return _getDb().prepare('SELECT * FROM users WHERE sub_token = ? AND is_blocked = 0 AND is_frozen = 0').get(token);
}

function getUserById(id) {
  return _getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserCount() {
  return _getDb().prepare('SELECT COUNT(*) as count FROM users').get().count;
}

function getAllUsers() {
  return _getDb().prepare(`
    SELECT u.*, COALESCE(tut.total_up, 0) + COALESCE(tut.total_down, 0) as total_traffic
    FROM users u
    LEFT JOIN traffic_user_total tut ON u.id = tut.user_id
    ORDER BY total_traffic DESC
  `).all();
}

function getAllUsersPaged(limit = 20, offset = 0, search = '', sortBy = 'total_traffic', sortDir = 'DESC') {
  const where = search ? "WHERE u.username LIKE '%' || @search || '%' OR u.name LIKE '%' || @search || '%'" : '';
  const allowedSorts = {
    id: 'u.id', username: 'u.username', trust_level: 'u.trust_level',
    total_traffic: 'total_traffic', expires_at: 'u.expires_at', last_login: 'u.last_login'
  };
  const orderCol = allowedSorts[sortBy] || 'total_traffic';
  const dir = sortDir === 'ASC' ? 'ASC' : 'DESC';
  const rows = _getDb().prepare(`
    SELECT u.*, COALESCE(tut.total_up, 0) + COALESCE(tut.total_down, 0) as total_traffic
    FROM users u
    LEFT JOIN traffic_user_total tut ON u.id = tut.user_id
    ${where}
    ORDER BY ${orderCol} ${dir}
    LIMIT @limit OFFSET @offset
  `).all({ limit, offset, search });
  const total = _getDb().prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get({ search }).c;
  return { rows, total };
}

function blockUser(id, blocked) {
  _getDb().prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, id);
}

function deleteUser(id) {
  const db = _getDb();
  db.prepare('DELETE FROM user_node_uuid WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM whitelist WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function setUserTrafficLimit(id, limitBytes) {
  _getDb().prepare('UPDATE users SET traffic_limit = ? WHERE id = ?').run(limitBytes, id);
}

function isTrafficExceeded(userId) {
  const user = getUserById(userId);
  if (!user || !user.traffic_limit) return false;
  const traffic = _getDb().prepare(
    'SELECT COALESCE(total_up, 0) + COALESCE(total_down, 0) as total FROM traffic_user_total WHERE user_id = ?'
  ).get(userId);
  return (traffic?.total || 0) >= user.traffic_limit;
}

function freezeUser(id) {
  _getDb().prepare('UPDATE users SET is_frozen = 1 WHERE id = ?').run(id);
  _getDb().prepare('DELETE FROM user_node_uuid WHERE user_id = ?').run(id);
}

function unfreezeUser(id) {
  _getDb().prepare('UPDATE users SET is_frozen = 0 WHERE id = ?').run(id);
  const u = _getDb().prepare('SELECT is_admin, trust_level FROM users WHERE id = ?').get(id);
  if (u) {
    _ensureUserHasAllNodeUuids(id);
  }
}

function autoFreezeInactiveUsers(days = 15) {
  const cutoff = toSqlUtc(new Date(Date.now() - days * 86400000));
  const users = _getDb().prepare(
    "SELECT id, username FROM users WHERE is_frozen = 0 AND is_blocked = 0 AND is_admin = 0 AND last_login < ?"
  ).all(cutoff);
  for (const u of users) {
    freezeUser(u.id);
  }
  return users;
}

function resetSubToken(userId) {
  const newToken = uuidv4();
  _getDb().prepare('UPDATE users SET sub_token = ? WHERE id = ?').run(newToken, userId);
  return newToken;
}

// Sprint 6: 用户到期时间
function setUserExpiry(userId, expiresAt) {
  _getDb().prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(expiresAt || null, userId);
}

function autoFreezeExpiredUsers() {
  const now = toSqlUtc();
  const users = _getDb().prepare(
    "SELECT id, username FROM users WHERE is_frozen = 0 AND is_blocked = 0 AND expires_at IS NOT NULL AND expires_at < ?"
  ).all(now);
  for (const u of users) {
    freezeUser(u.id);
  }
  return users;
}

module.exports = {
  init,
  // 新 API
  createUser, setPassword, verifyUserPassword, renameUser, deleteUser,
  // 查询
  getUserBySubToken, getUserById, getUserCount, getAllUsers, getAllUsersPaged,
  // 状态
  blockUser, setUserTrafficLimit, isTrafficExceeded,
  freezeUser, unfreezeUser, autoFreezeInactiveUsers, resetSubToken,
  setUserExpiry, autoFreezeExpiredUsers
};
