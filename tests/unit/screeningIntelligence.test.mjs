import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const page = fs.readFileSync(new URL('../../src/views/market-screener/index.vue', import.meta.url), 'utf8')
const panel = fs.readFileSync(new URL('../../src/views/market-screener/ScreeningIntelligencePanel.vue', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../../src/api/domain.js', import.meta.url), 'utf8')
const stream = fs.readFileSync(new URL('../../src/utils/researchTaskStream.js', import.meta.url), 'utf8')

test('screening workspace exposes the decision lifecycle in one flow', () => {
  assert.match(page, /screening-intelligence-panel/)
  assert.match(page, /decision_score/)
  assert.match(page, /saveScreenFeedback/)
  assert.match(page, /split_ratio: \[0\.6, 0\.2, 0\.2\]/)
  assert.match(panel, /compileScreenQuery/)
  assert.match(panel, /createScreenPortfolio/)
  assert.match(panel, /saveScreenSchedule/)
})

test('screening task progress uses authenticated SSE with polling fallback', () => {
  assert.match(stream, /text\/event-stream/)
  assert.match(stream, /Authorization: `Bearer/)
  assert.match(page, /watchResearchTask/)
  assert.match(page, /setTimeout\(resolve, 3000\)/)
})

test('decision lifecycle APIs are available to the frontend', () => {
  for (const name of ['compileScreenQuery', 'getScreenDataQuality', 'createScreenPortfolio', 'saveScreenFeedback', 'saveScreenSchedule', 'compareScreens']) {
    assert.match(api, new RegExp(`function ${name}`))
  }
})
