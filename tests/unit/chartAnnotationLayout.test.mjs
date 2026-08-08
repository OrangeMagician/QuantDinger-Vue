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

test('separates long labels on neighboring dense bars', () => {
  const allocate = createChartAnnotationLaneAllocator(bars)

  assert.equal(allocate({ timestamp: bars[3].timestamp, side: 'above', text: '均线多头过滤' }), 0)
  assert.equal(allocate({ timestamp: bars[4].timestamp, side: 'above', text: '趋势确认信号' }), 1)
})

test('shares occupied ranges across annotation sources without wasting distant lanes', () => {
  const allocate = createChartAnnotationLaneAllocator(bars)

  assert.equal(allocate({ timestamp: bars[1].timestamp, side: 'below', text: '未完成结构' }), 0)
  assert.equal(allocate({ timestamp: bars[1].timestamp, side: 'buy', text: 'MACD金叉' }), 1)
  assert.equal(allocate({ timestamp: bars[7].timestamp, side: 'below', text: '买入' }), 0)
})
