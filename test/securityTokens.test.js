const test = require('node:test');
const assert = require('node:assert/strict');
const { safeTokenEqual, isValidOAuthState } = require('../src/utils/securityTokens');

test('safeTokenEqual returns true for same token', () => {
  assert.equal(safeTokenEqual('abc123', 'abc123'), true);
});

test('safeTokenEqual returns false for different token', () => {
  assert.equal(safeTokenEqual('abc123', 'abc124'), false);
  assert.equal(safeTokenEqual('short', 'longer'), false);
});

test('isValidOAuthState rejects empty and mismatch states', () => {
  // 函数保留为通用 state 校验器；OAuth 登录已下线，但仍可用于 CSRF state 等场景
  assert.equal(isValidOAuthState('', 'x'), false);
  assert.equal(isValidOAuthState('x', ''), false);
  assert.equal(isValidOAuthState(null, 'x'), false);
  assert.equal(isValidOAuthState('expected', 'incoming'), false);
});

test('isValidOAuthState accepts exact match', () => {
  assert.equal(isValidOAuthState('state-123', 'state-123'), true);
});
