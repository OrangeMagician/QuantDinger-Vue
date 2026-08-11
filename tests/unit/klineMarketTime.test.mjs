import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CN_STOCK_TIMEZONE,
  cnTradeDateTimestampMs,
  formatMarketKlineTime,
  getKlineMarketTimezone,
  resolveMarketKlineTimestampMs
} from '../../src/utils/klineMarketTime.js'

test('CNStock daily bars use trade_date at Shanghai midnight', () => {
  const timestamp = resolveMarketKlineTimestampMs(
    { time: 1786291200, trade_date: '2026-08-10' },
    'CNStock',
    '1D'
  )

  assert.equal(getKlineMarketTimezone('CNStock'), CN_STOCK_TIMEZONE)
  assert.equal(timestamp, Date.parse('2026-08-10T00:00:00+08:00'))
  assert.equal(formatMarketKlineTime(timestamp, 'CNStock', '1D'), '2026-08-10')
})

test('CNStock minute bars display in Asia/Shanghai', () => {
  const timestamp = Date.parse('2026-08-10T15:00:00+08:00')
  assert.equal(formatMarketKlineTime(timestamp, 'CNStock', '1m'), '2026-08-10 15:00')
})

test('invalid trade dates fall back to the source timestamp', () => {
  const sourceTimestamp = Date.parse('2026-08-10T00:00:00+08:00')
  assert.equal(cnTradeDateTimestampMs('2026-02-30'), null)
  assert.equal(
    resolveMarketKlineTimestampMs({ time: sourceTimestamp / 1000, trade_date: 'invalid' }, 'CNStock', '1D'),
    sourceTimestamp
  )
})
