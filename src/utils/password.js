const crypto = require('crypto');

// scrypt 参数：N=16384, r=8, p=1（OWASP 推荐的平衡参数，内存 16MiB）
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_MAX_MEM = 64 * 1024 * 1024; // 允许最大 64MiB，留余量
const SALT_BYTES = 16;

// 哈希格式：scrypt$N$r$p$<saltHex>$<hashHex>
const HASH_PREFIX = 'scrypt';

function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('密码不能为空');
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEM,
  });
  return [
    HASH_PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || !password) return false;
  if (typeof storedHash !== 'string' || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) return false;
  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (!salt.length || !expected.length) return false;
  try {
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N, r, p, maxmem: SCRYPT_MAX_MEM,
    });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
