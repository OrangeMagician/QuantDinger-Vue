import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeEpochMilliseconds } from '../../src/utils/timestamps.js'

test('normalizes chart timestamps to epoch milliseconds', () => {
  assert.equal(normalizeEpochMilliseconds(1785483000), 1785483000000)
  assert.equal(normalizeEpochMilliseconds('1785483000'), 1785483000000)
  assert.equal(normalizeEpochMilliseconds(1785483000000), 1785483000000)
  assert.equal(normalizeEpochMilliseconds('invalid'), 0)
})
