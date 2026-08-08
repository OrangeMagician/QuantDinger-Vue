import assert from 'node:assert/strict'
import test from 'node:test'

import { createChartAnnotationLaneAllocator, normalizeAnnotationSide } from '../../src/utils/chartAnnotationLayout.js'

const bars = Array.from({ length: 8 }, (_, index) => ({ timestamp: (index + 1) * 86400000 }))

test('places colliding labels on separate lanes while reusing free lanes', () => {
  const allocate = createChartAnnotationLaneAllocator(bars)

  assert.equal(allocate({ timestamp: bars[3].timestamp, side: 'top', text: '顶分型' }), 0)
  assert.equal(allocate({ timestamp: bars[3].timestamp, side: 'sell', text: '趋势向上' }), 1)
  assert.equal(allocate({ timestamp: bars[7].timestamp, side: 'above', text: '顶' }), 0)
})

test('keeps above and below annotations in independent lane stacks', () => {
  const allocate = createChartAnnotationLaneAllocator(bars, { baseLane: 2 })

  assert.equal(allocate({ timestamp: bars[2].timestamp, side: 'sell', text: '卖出' }), 2)
  assert.equal(allocate({ timestamp: bars[2].timestamp, side: 'buy', text: '买入' }), 2)
  assert.equal(allocate({ timestamp: bars[2].timestamp, side: 'bottom', text: '底分型' }), 3)
})

test('normalizes chart semantics to above and below sides', () => {
  assert.equal(normalizeAnnotationSide('top'), 'above')
  assert.equal(normalizeAnnotationSide('sell'), 'above')
  assert.equal(normalizeAnnotationSide('bottom'), 'below')
  assert.equal(normalizeAnnotationSide('buy'), 'below')
})
