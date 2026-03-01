const crypto = require('crypto');

// 固定长度 HMAC 后再 timingSafeEqual，避免泄露原始 token 长度
function safeTokenEqual(a, b) {
  const key = crypto.randomBytes(32);
  const ha = crypto.createHmac('sha256', key).update(String(a || '')).digest();
  const hb = crypto.createHmac('sha256', key).update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isValidOAuthState(expectedState, incomingState) {
  if (!expectedState || !incomingState) return false;
  return safeTokenEqual(incomingState, expectedState);
}

module.exports = {
  safeTokenEqual,
  isValidOAuthState,
};
