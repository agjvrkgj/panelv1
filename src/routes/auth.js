const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('../services/database');
const { emitSyncAll } = require('../services/configEvents');
const { getClientIp, parseIpAllowlist, isIpAllowed } = require('../utils/clientIp');
const { safeTokenEqual } = require('../utils/securityTokens');
const { hashPassword, verifyPassword } = require('../utils/password');
const { notify } = require('../services/notify');

const router = express.Router();
const usedTempLoginTokens = new Set();

if (process.env.TEMP_LOGIN_ENABLED === 'true') {
  console.warn('[SECURITY] TEMP_LOGIN_ENABLED=true，请确保仅用于应急且已配置严格访问限制');
}

const MIN_PASSWORD_LENGTH = 8;
const USERNAME_RE = /^[a-zA-Z0-9_.\-]{3,32}$/;

function isFirstRun() {
  try {
    return db.getUserCount() === 0;
  } catch {
    return false;
  }
}

function renderLogin(req, res, { error = '', info = '' } = {}) {
  res.render('login', {
    error: error || req.query.error || '',
    info: info || req.query.info || '',
    firstRun: isFirstRun(),
  });
}

function findUserByUsername(username) {
  if (!username) return null;
  try {
    return db.getDb()
      .prepare('SELECT * FROM users WHERE username = ? LIMIT 1')
      .get(String(username).trim()) || null;
  } catch {
    return null;
  }
}

function validatePasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD_LENGTH) {
    return `密码至少 ${MIN_PASSWORD_LENGTH} 位`;
  }
  if (pw.length > 256) return '密码过长';
  return null;
}

// 登录页
router.get('/login', (req, res) => {
  renderLogin(req, res);
});

// 用户名+密码登录
router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const loginIp = getClientIp(req);

  if (!username || !password) {
    return renderLogin(req, res, { error: '请输入用户名和密码' });
  }

  const user = findUserByUsername(username);
  // 无论用户是否存在都跑一次 verify，降低用户名枚举风险
  const dummyHash = 'scrypt$16384$8$1$' + '0'.repeat(32) + '$' + '0'.repeat(128);
  const ok = user && user.password_hash
    ? verifyPassword(password, user.password_hash)
    : verifyPassword(password, dummyHash);

  if (!user || !user.password_hash || !ok) {
    try { db.addAuditLog(null, 'login_fail', `登录失败：${username}`, loginIp); } catch {}
    return renderLogin(req, res, { error: '用户名或密码错误' });
  }

  if (user.is_blocked) {
    return renderLogin(req, res, { error: '账号已被封禁' });
  }

  // 登录成功：解冻 + 更新活跃时间
  const wasFrozen = !!user.is_frozen;
  try {
    db.getDb().prepare(
      "UPDATE users SET is_frozen = 0, last_login = datetime('now') WHERE id = ?"
    ).run(user.id);
  } catch {}
  if (wasFrozen) emitSyncAll();

  req.logIn(db.getUserById(user.id), (err) => {
    if (err) return renderLogin(req, res, { error: '登录失败，请重试' });
    // 登录后轮换 CSRF token 防止会话固定
    delete req.session.csrfToken;
    try { db.addAuditLog(user.id, 'login', `用户 ${user.username} 登录`, loginIp); } catch {}
    res.redirect('/');
  });
});

// 首次运行：允许创建第一个管理员账号
router.get('/register', (req, res) => {
  if (!isFirstRun()) {
    return res.redirect('/auth/login?error=' + encodeURIComponent('注册已关闭，请联系管理员'));
  }
  res.render('register', { error: req.query.error || '' });
});

router.post('/register', (req, res) => {
  if (!isFirstRun()) {
    return res.redirect('/auth/login?error=' + encodeURIComponent('注册已关闭，请联系管理员'));
  }
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const confirm = String(req.body?.confirm || '');
  const loginIp = getClientIp(req);

  if (!USERNAME_RE.test(username)) {
    return res.render('register', { error: '用户名仅支持字母/数字/._-，长度 3-32' });
  }
  const pwErr = validatePasswordPolicy(password);
  if (pwErr) return res.render('register', { error: pwErr });
  if (password !== confirm) {
    return res.render('register', { error: '两次输入的密码不一致' });
  }

  let user;
  try {
    user = db.createUser({ username, password, isAdmin: true });
  } catch (err) {
    console.error('[register] 创建首管理员失败', err);
    return res.render('register', { error: err.message || '创建失败' });
  }

  req.logIn(user, (err) => {
    if (err) return res.redirect('/auth/login?error=' + encodeURIComponent('注册成功，请登录'));
    delete req.session.csrfToken;
    try { db.addAuditLog(user.id, 'login', `首管理员 ${user.username} 登录`, loginIp); } catch {}
    res.redirect('/admin');
  });
});

const tempLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: '临时登录请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

function verifyTempLoginEnabled() {
  if (process.env.TEMP_LOGIN_ENABLED !== 'true') {
    return { ok: false, status: 404, message: 'Not Found' };
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.TEMP_LOGIN_ALLOW_PROD !== 'true'
  ) {
    return { ok: false, status: 404, message: 'Not Found' };
  }
  return { ok: true };
}

function consumeTempLoginTokenIfNeeded(expected) {
  const oneTime = process.env.TEMP_LOGIN_ONE_TIME !== 'false';
  const fingerprint = crypto.createHash('sha256').update(String(expected || '')).digest('hex');
  if (!oneTime) return { ok: true };
  if (usedTempLoginTokens.has(fingerprint)) {
    return { ok: false, message: '临时 token 已使用' };
  }
  usedTempLoginTokens.add(fingerprint);
  return { ok: true };
}

// 临时登录通道（仅用于应急审查）
// 用法：POST /auth/temp-login  body: { token: "xxxx" }
// 需要环境变量：TEMP_LOGIN_ENABLED=true + TEMP_LOGIN_TOKEN=xxxx (+ TEMP_LOGIN_ALLOW_PROD=true 才允许生产环境)
// 可选过期时间：TEMP_LOGIN_EXPIRES_AT=毫秒时间戳
router.get('/temp-login', (req, res) => {
  const check = verifyTempLoginEnabled();
  if (!check.ok) return res.status(check.status).send(check.message);
  return res.status(405).send('Method Not Allowed: use POST /auth/temp-login');
});

router.post('/temp-login', tempLoginLimiter, (req, res) => {
  const check = verifyTempLoginEnabled();
  if (!check.ok) return res.status(check.status).send(check.message);

  const expected = process.env.TEMP_LOGIN_TOKEN || '';
  const token = req.body?.token || req.headers['x-temp-login-token'] || '';
  const expiresAt = parseInt(process.env.TEMP_LOGIN_EXPIRES_AT || '0', 10);
  const loginIP = getClientIp(req);
  const allowlist = parseIpAllowlist(process.env.TEMP_LOGIN_IP_ALLOWLIST || '');

  if (!expected) {
    return res.status(403).send('临时登录未配置 token');
  }
  if (expiresAt > 0 && Date.now() > expiresAt) {
    return res.status(403).send('临时登录已过期');
  }
  if (!safeTokenEqual(token, expected)) {
    return res.status(403).send('token 无效');
  }
  if (allowlist.length > 0 && !isIpAllowed(loginIP, allowlist)) {
    return res.status(403).send('当前 IP 不在允许列表');
  }
  const consumeResult = consumeTempLoginTokenIfNeeded(expected);
  if (!consumeResult.ok) {
    return res.status(403).send(consumeResult.message);
  }

  const row = db.getDb().prepare('SELECT id FROM users WHERE is_admin = 1 AND is_blocked = 0 ORDER BY id ASC LIMIT 1').get();
  if (!row) {
    return res.status(500).send('未找到可用管理员账号');
  }

  const user = db.getUserById(row.id);
  if (!user) {
    return res.status(500).send('管理员账号加载失败');
  }

  req.logIn(user, (err) => {
    if (err) return res.status(500).send('登录失败');
    // 登录后轮换 CSRF token 防止会话固定
    delete req.session.csrfToken;
    db.addAuditLog(user.id, 'temp_login', `临时通道登录 ${user.username}`, loginIP);
    res.redirect('/admin');
  });
});

// 登出
router.get('/logout', (req, res) => {
  if (req.user) {
    try {
      db.addAuditLog(req.user.id, 'logout', `用户 ${req.user.username} 登出`, getClientIp(req));
    } catch {}
  }
  req.logout(() => {
    // 摧毁 session，防止重放
    if (req.session && typeof req.session.destroy === 'function') {
      req.session.destroy(() => res.redirect('/auth/login'));
    } else {
      res.redirect('/auth/login');
    }
  });
});

module.exports = router;
