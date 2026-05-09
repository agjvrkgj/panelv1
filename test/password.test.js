const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/utils/password');

test('hashPassword produces distinct hashes for the same password (random salt)', () => {
  const a = hashPassword('hunter2123!');
  const b = hashPassword('hunter2123!');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('scrypt$'));
  assert.ok(b.startsWith('scrypt$'));
});

test('verifyPassword accepts correct password and rejects wrong one', () => {
  const hash = hashPassword('correct horse battery');
  assert.equal(verifyPassword('correct horse battery', hash), true);
  assert.equal(verifyPassword('wrong guess', hash), false);
  assert.equal(verifyPassword('', hash), false);
});

test('verifyPassword rejects malformed hashes', () => {
  assert.equal(verifyPassword('anything', ''), false);
  assert.equal(verifyPassword('anything', null), false);
  assert.equal(verifyPassword('anything', 'not-a-real-hash'), false);
  assert.equal(verifyPassword('anything', 'bcrypt$1$1$1$abc$def'), false);
});

test('hashPassword rejects empty or non-string passwords', () => {
  assert.throws(() => hashPassword(''));
  assert.throws(() => hashPassword(undefined));
  assert.throws(() => hashPassword(null));
});
