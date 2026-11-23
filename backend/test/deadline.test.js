const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDeadlineHours, MIN_DEADLINE_HOURS } = require('../src/services/deadline');
test('minimum deadline matches the deployed contract (3 hours)', () => assert.equal(MIN_DEADLINE_HOURS, 3));
test('sub-3h, non-integer and junk deadlines are rejected with a clear error', () => {
  for (const bad of [undefined, null, '', 0, 1, '1', 2, '2', 2.9, '3.5', 'abc', -5]) {
    assert.ok(parseDeadlineHours(bad).error, String(bad));
  }
  assert.equal(parseDeadlineHours(1).error, 'Minimum deadline is 3 hours');
});
test('3h and longer are accepted (numbers or numeric strings)', () => {
  assert.equal(parseDeadlineHours(3).hours, 3);
  assert.equal(parseDeadlineHours('3').hours, 3);
  assert.equal(parseDeadlineHours('48').hours, 48);
});
