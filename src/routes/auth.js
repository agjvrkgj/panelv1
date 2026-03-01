const express = require('express');
const crypto = require('crypto');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const db = require('../services/database');
const { emitSyncAll } = require('../services/configEvents');
const { getClientIp, parseIpAllowlist, isIpAllowed } = require('../utils/clientIp');
const { safeTokenEqual, isValidOAuthState } = require('../utils/securityTokens');

const router = express.Router();
const usedTempLoginTokens = new Set();

if (process.env.TEMP_LOGIN_ENABLED === 'true') {
  console.warn('[SECURITY] TEMP_LOGIN_ENABLED=true，请确保仅用于应急且已配置严格访问限制');
}

// 登录页
router.get('/login', (req, res) => {
  res.render('login', { error: req.query.error || '' });
});

// 发起 OAuth
router.get('/nodeloc', (req, res, next) => {
  // 生成 state 防 CSRF
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  passport.authenticate('nodeloc', { state })(req, res, next);
});

// OAuth 回调
const { notify } = require('../services/notify');

router.get('/callback', (req, res, next) => {
  const expectedState = req.session.oauthState;
  const incomingState = req.query.state;
  // OAuth state 必须严格匹配，防止登录 CSRF / 会话混淆
  if (!isValidOAuthState(expectedState, incomingState)) {
    req.session.oauthState = null;
    return res.redirect('/auth/login?error=' + encodeURIComponent('登录状态校验失败，请重试'));
  }
  req.session.oauthState = null;
  passport.authenticate('nodeloc', (err, user, info) => {
    if (err) {
      console.error('OAuth 错误:', err);
      return res.redirect('/auth/login?error=' + encodeURIComponent('登录失败，请重试'));
    }
    if (!user) {
      const msg = info?.message || '登录失败';
      return res.redirect('/auth/login?error=' + encodeURIComponent(msg));
    }
    req.logIn(user, (err) => {
      if (err) return res.redirect('/auth/login?error=' + encodeURIComponent('登录失败'));
      // 登录后轮换 CSRF token 防止会话固定
      delete req.session.csrfToken;
      const loginIP = getClientIp(req);
      db.addAuditLog(user.id, 'login', `用户 ${user.username} 登录`, loginIP);
      // 如果用户刚被解冻，异步同步节点配置
      if (user._wasFrozen) {
        emitSyncAll();
      }
      res.redirect('/');
    });
  })(req, res, next);
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
    db.addAuditLog(req.user.id, 'logout', `用户 ${req.user.username} 登出`, getClientIp(req));
  }
  req.logout(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
