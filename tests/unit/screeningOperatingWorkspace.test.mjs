import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const workspace = fs.readFileSync(new URL('../../src/views/market-screener/ScreeningOperatingWorkspace.vue', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../../src/views/market-screener/index.vue', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../../src/api/domain.js', import.meta.url), 'utf8')

test('screening operating workspace progressively separates daily research and data modes', () => {
  assert.match(workspace, /value="daily"/)
  assert.match(workspace, /value="research"/)
  assert.match(workspace, /value="data"/)
  assert.match(page, /operatingMode === 'daily'/)
  assert.doesNotMatch(page, /enterprise-screening-workbench/)
})

test('daily workflow provides goal wizard rule funnel inbox and draft recovery', () => {
  for (const value of ['goal-wizard', 'rule-canvas', 'refreshInbox', 'analyzeRules', 'saveScreenWorkspaceDraft', 'restoreDraft']) {
    assert.match(workspace, new RegExp(value))
  }
})

test('research and data operations use schema controls instead of raw json editors', () => {
  assert.doesNotMatch(workspace, /<a-textarea/)
  assert.match(workspace, /runScreenOperatingResearch/)
  assert.match(workspace, /runScreenProvider/)
  assert.match(workspace, /saveScreenDataContract/)
  assert.match(workspace, /getScreenDataLineage/)
})

test('typed operating APIs are exposed by the frontend client', () => {
  for (const name of ['getScreenOperatingDashboard', 'runScreenProvider', 'analyzeScreenRules', 'runScreenDecisionAction', 'runScreenPlatformAction']) {
    assert.match(api, new RegExp(`function ${name}`))
  }
})

test('data governance recognizes string object and array role payloads', () => {
  assert.match(workspace, /Array\.isArray\(info\.role\)/)
  assert.match(workspace, /roles\.some/)
  assert.match(workspace, /adminRequired/)
})
