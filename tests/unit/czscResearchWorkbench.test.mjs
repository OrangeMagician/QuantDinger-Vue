import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../src/', import.meta.url)

async function source (path) {
  return readFile(new URL(path, root), 'utf8')
}

test('CZSC workbench exposes all five integrated views', async () => {
  const workbench = await source('views/czsc-workbench/index.vue')

  for (const tab of ['structure', 'strategy', 'scan', 'backtest', 'review']) {
    assert.match(workbench, new RegExp(`key="${tab}"`))
  }
  assert.match(workbench, /<strategy-panel/)
  assert.match(workbench, /<scan-panel/)
  assert.match(workbench, /<backtest-panel/)
  assert.match(workbench, /<review-panel/)
  assert.match(workbench, /searchCzscSymbols/)
  assert.match(workbench, /getScriptTemplateList/)
})

test('CZSC API includes bounded research, TradingView, and Retraq endpoints', async () => {
  const api = await source('api/czsc.js')

  for (const endpoint of [
    '/api/czsc/templates',
    '/api/czsc/symbols/search',
    '/api/czsc/evaluate',
    '/api/czsc/scan',
    '/api/czsc/backtest',
    '/api/czsc/tradingview/normalize',
    '/api/czsc/retraq/submit'
  ]) {
    assert.match(api, new RegExp(endpoint.replaceAll('/', '\\/')))
  }
})

test('Retraq review requires confirmation and never exposes integration secrets', async () => {
  const review = await source('views/czsc-workbench/components/ReviewPanel.vue')

  assert.match(review, /this\.\$confirm/)
  assert.match(review, /submitCzscToRetraq/)
  assert.doesNotMatch(review, /RETRAQ_SIGNAL_BRIDGE_SECRET/)
  assert.doesNotMatch(review, /secret:/)
})

test('CZSC chart renders volume and MACD panes', async () => {
  const chart = await source('views/czsc-workbench/components/CzscChart.vue')

  assert.match(chart, /createIndicator\('VOL'/)
  assert.match(chart, /createIndicator\('MACD'/)
})
