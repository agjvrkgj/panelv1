const db = require('../services/database');

// 用户活跃时间更新缓存（节流5分钟，避免频繁写库）
const _lastActiveCache = new Map();
const LAST_ACTIVE_CACHE_TTL_MS = 30 * 60 * 1000;
const LAST_ACTIVE_CACHE_MAX_ENTRIES = 50000;

function cleanupLastActiveCache(now = Date.now()) {
  for (const [uid, ts] of _lastActiveCache) {
    if (now - ts > LAST_ACTIVE_CACHE_TTL_MS) _lastActiveCache.delete(uid);
  }
  if (_lastActiveCache.size <= LAST_ACTIVE_CACHE_MAX_ENTRIES) return;
  const sorted = [..._lastActiveCache.entries()].sort((a, b) => a[1] - b[1]);
  const removeCount = _lastActiveCache.size - LAST_ACTIVE_CACHE_MAX_ENTRIES;
  for (let i = 0; i < removeCount; i++) {
    _lastActiveCache.delete(sorted[i][0]);
  }
}

// 会话中间件：将 req.session.userId 解析为 req.user，并暴露类 passport 接口
function sessionAuth(req, res, next) {
  const uid = req.session && req.session.userId;
  if (uid) {
    const user = db.getUserById(uid);
    if (user) {
      req.user = user;
    } else {
      // 用户已被删除：清理 session 防止僵尸登录
      req.session.userId = null;
    }
  }

  req.isAuthenticated = function isAuthenticated() {
    return !!req.user;
  };

  function login(user, cb) {
    try {
      if (!user || !user.id) {
        const err = new Error('无效用户');
        return cb ? cb(err) : undefined;
      }
      req.session.userId = user.id;
      req.user = user;
      if (cb) return cb(null);
    } catch (err) {
      if (cb) return cb(err);
    }
  }
  req.login = login;
  req.logIn = login;

  req.logout = function logout(cb) {
    req.user = null;
    if (req.session) req.session.userId = null;
    if (typeof cb === 'function') return cb();
  };

  next();
}

function setupAuth(app) {
  app.use(sessionAuth);
}

// 登录检查中间件
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && !req.user.is_blocked) {
    // 更新最后活跃时间（每5分钟最多写一次）
    const userId = req.user.id;
    const now = Date.now();
    cleanupLastActiveCache(now);
    const last = _lastActiveCache.get(userId) || 0;
    if (now - last > 5 * 60 * 1000) {
      _lastActiveCache.set(userId, now);
      try {
        db.getDb().prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
      } catch {}
    }
    return next();
  }
  res.redirect('/auth/login');
}

// 管理员检查中间件
function requireAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user.is_admin && !req.user.is_blocked) return next();
  res.status(403).json({ error: '需要管理员权限' });
}

module.exports = { setupAuth, requireAuth, requireAdmin };
