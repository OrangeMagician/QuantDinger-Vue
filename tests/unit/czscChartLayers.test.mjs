import assert from 'node:assert/strict'
import test from 'node:test'

import { selectCompletedStrokeFractals } from '../../src/utils/czscFractalFilter.js'

test('only completed stroke endpoint fractals are selected for chart labels', () => {
  const result = {
    bars: Array.from({ length: 7 }, (_, index) => ({ timestamp: (index + 1) * 86400000 })),
    fractals: [
      { timestamp: 2 * 86400000, kind: 'bottom', price: 9 },
      { timestamp: 3 * 86400000, kind: 'top', price: 12 },
      { timestamp: 5 * 86400000, kind: 'bottom', price: 10 },
      { timestamp: 6 * 86400000, kind: 'top', price: 13 }
    ],
    strokes: [{
      start_timestamp: 2 * 86400000,
      start_price: 9,
      end_timestamp: 6 * 86400000,
      end_price: 13
    }],
    enhanced_signals: [],
    unfinished: { fractals: [] }
  }

  assert.deepEqual(selectCompletedStrokeFractals(result), [result.fractals[0], result.fractals[3]])
})

test('does not present standalone fractals as structural tops or bottoms', () => {
  const result = {
    bars: [{ timestamp: 86400000 }],
    fractals: [{ timestamp: 86400000, kind: 'top', price: 12 }],
    strokes: [],
    enhanced_signals: [],
    unfinished: { fractals: [] }
  }

  assert.deepEqual(selectCompletedStrokeFractals(result), [])
})
