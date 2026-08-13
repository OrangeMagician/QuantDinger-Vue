import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCandidateContext,
  candidatePosition,
  loadCandidateContext,
  normalizeCandidateSymbol,
  saveCandidateContext
} from '../../src/utils/screenerCandidateContext.js'

test('candidate context normalizes, deduplicates, and prefers selected rows', () => {
  const context = buildCandidateContext({
    rows: [{ symbol: '000001' }],
    selectedRows: [
      { symbol: '600519', name: '贵州茅台', decision_score: 88, match_score: 90 },
      { symbol: '600519.SH', name: 'duplicate' },
      { symbol: '002399', name: '海普瑞' }
    ],
    current: { symbol: '600519.SH' },
    taskId: 'task-7',
    timeframe: '30m'
  })

  assert.deepEqual(context.candidates.map(item => item.symbol), ['600519.SH', '002399.SZ'])
  assert.equal(context.taskId, 'task-7')
  assert.equal(context.candidates[0].decisionScore, 88)
})

test('candidate context persists and exposes previous and next candidates', () => {
  const values = new Map()
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) }
  const context = buildCandidateContext({ rows: [{ symbol: '000001' }, { symbol: '600519' }, { symbol: '002399' }] })
  saveCandidateContext(context, storage)

  const restored = loadCandidateContext(storage)
  const position = candidatePosition(restored, '600519.SH')

  assert.equal(position.index, 1)
  assert.equal(position.total, 3)
  assert.equal(position.previous.symbol, '000001.SZ')
  assert.equal(position.next.symbol, '002399.SZ')
  assert.equal(normalizeCandidateSymbol('830799'), '830799.BJ')
})

test('candidate context bounds corrupt persisted queues and tolerates unavailable storage', () => {
  const oversized = Array.from({ length: 130 }, (_, index) => ({
    symbol: String(index).padStart(6, '0'),
    name: `candidate-${index}`
  }))
  oversized.splice(1, 0, { symbol: '000000.SZ', name: 'duplicate' })
  const storage = { getItem: () => JSON.stringify({ version: 1, currentSymbol: '000001', candidates: oversized }) }

  const restored = loadCandidateContext(storage)

  assert.equal(restored.candidates.length, 100)
  assert.equal(new Set(restored.candidates.map(item => item.symbol)).size, 100)
  assert.equal(restored.currentSymbol, '000001.SZ')
  assert.equal(saveCandidateContext(restored, { setItem: () => { throw new Error('blocked') } }), false)
})

test('candidate context keeps the opened row and its scores when it is outside the selection', () => {
  const context = buildCandidateContext({
    selectedRows: [{ symbol: '000001', decision_score: 70 }],
    current: { symbol: '600519', name: '贵州茅台', decision_score: 91.5, match_score: 88 }
  })

  assert.deepEqual(context.candidates[0], {
    symbol: '600519.SH',
    name: '贵州茅台',
    decisionScore: 91.5,
    matchScore: 88
  })
})
