const crypto = require('crypto');

// 启动时强制检查 SESSION_SECRET
if (!process.env.SESSION_SECRET) {
  console.error('[FATAL] 环境变量 SESSION_SECRET 未设置，拒绝启动。请在 .env 中配置一个强随机密钥。');
  process.exit(1);
}

const ALGO = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.SESSION_SECRET, 'vless-panel-salt', 32);

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + encrypted;
}

function decrypt(data) {
  if (!data) return null;
  // 兼容未加密的旧数据（不含冒号分隔符）
  if (!data.includes(':')) return data;
  const [ivHex, tagHex, encrypted] = data.split(':');
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
