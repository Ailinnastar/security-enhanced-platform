/**
 * Quick automated checks for password hashing (run: node server/scripts/security-smoke-test.js from claude/).
 */
const assert = require('assert');
const path = require('path');

// Load passwords module relative to this script
const { hashPassword, verifyPassword, BCRYPT_COST } = require(path.join(__dirname, '..', 'passwords'));

async function main() {
  assert.strictEqual(BCRYPT_COST, 12, 'BCRYPT_COST should be 12');

  const pwd = `TestPwd_${Math.random().toString(36).slice(2)}_x9!`;
  const hash = await hashPassword(pwd);

  assert.ok(typeof hash === 'string' && hash.length > 20, 'hash should be a non-trivial string');
  assert.ok(/^\$2[aby]\$\d{2}\$/.test(hash), 'hash should look like bcrypt ($2a/$2b/$2y + cost)');

  assert.strictEqual(await verifyPassword(pwd, hash), true, 'correct password should verify');
  assert.strictEqual(await verifyPassword(`${pwd}wrong`, hash), false, 'wrong password should not verify');
  assert.strictEqual(await verifyPassword(pwd, 'not-a-valid-bcrypt-string'), false, 'invalid stored hash should fail safely');

  const h2 = await hashPassword(pwd);
  assert.notStrictEqual(hash, h2, 'two hashes of same password should differ (unique salts)');

  console.log('security-smoke-test: all checks passed.');
}

main().catch((err) => {
  console.error('security-smoke-test FAILED:', err);
  process.exit(1);
});
