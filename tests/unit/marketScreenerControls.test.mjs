import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const screenerPath = fileURLToPath(new URL('../../src/views/market-screener/index.vue', import.meta.url))
const screener = fs.readFileSync(screenerPath, 'utf8')
const domainApiPath = fileURLToPath(new URL('../../src/api/domain.js', import.meta.url))
const domainApi = fs.readFileSync(domainApiPath, 'utf8')
const editorPath = fileURLToPath(new URL('../../src/views/strategy-center/components/LiveStrategyEditor.vue', import.meta.url))
const editor = fs.readFileSync(editorPath, 'utf8')

test('stock screener localizes condition names, operators, and enum values', () => {
  assert.match(screener, /label: this\.catalogItemLabel\(item\)/)
  assert.match(screener, /operatorLabel\(operator\)/)
  assert.match(screener, /conditionOptionLabel\(option\)/)
  assert.match(screener, /condition\.valueType === 'enum'/)
})

test('stock screener only asks for values when the operator requires one', () => {
  assert.match(screener, /\['truthy', 'falsy', 'exists', 'not_exists', 'matched'\]/)
  assert.match(screener, /v-if="condition\.needsValue"/)
  assert.match(screener, /condition\.operator === 'between'/)
  assert.match(screener, /setRangeValue\(index, 0, value\)/)
})

test('stock screener labels run settings instead of exposing internal codes', () => {
  assert.match(screener, /marketScreener\.logicAnd/)
  assert.match(screener, /marketScreener\.logicOr/)
  assert.match(screener, /marketScreener\.timeframe1d/)
  assert.match(screener, /marketScreener\.barLimit/)
})

test('stock screener groups and searches A-share industries and market themes', () => {
  assert.match(screener, /classificationGroups/)
  assert.match(screener, /marketScreener\.concepts/)
  assert.match(screener, /marketScreener\.industryGroup/)
  assert.match(screener, /filterClassificationOption/)
  assert.match(screener, /optionData\.classifications/)
  assert.match(screener, /marketScreener\.classificationLoading/)
  assert.match(domainApi, /stock-pools\/options'[\s\S]*timeout: 60000/)
})

test('stock screener exposes explainable results and the research workflow', () => {
  assert.match(screener, /modeMust/)
  assert.match(screener, /lookbackBars/)
  assert.match(screener, /match_score/)
  assert.match(screener, /technical_score/)
  assert.match(screener, /condition_results/)
  assert.match(screener, /getScreenRows/)
  assert.match(screener, /validateScreen/)
  assert.match(screener, /submitScreenReviewSignals/)
  assert.match(screener, /manual_review_required|reviewConfirmBody/)
})

test('stock screener supports large-pool preview, saved plans, progress, and history', () => {
  assert.match(screener, /previewStockPool/)
  assert.match(screener, /poolMax/)
  assert.match(screener, /listScreenPlans/)
  assert.match(screener, /saveScreenPlan/)
  assert.match(screener, /progressPercent/)
  assert.match(screener, /getScreenHistory/)
  assert.match(domainApi, /stock-pools\/preview/)
  assert.match(domainApi, /screen-plans/)
  assert.match(domainApi, /review-signals/)
})

test('stock screener keeps result operations reliable across refreshes and pages', () => {
  assert.match(screener, /retryCurrentTask/)
  assert.match(screener, /resultSortBy/)
  assert.match(screener, /resultQuality/)
  assert.match(screener, /resultLoadGeneration/)
  assert.match(screener, /handleRowSelection/)
  assert.match(screener, /selectedRowMap/)
  assert.match(screener, /exportCurrentRows/)
  assert.match(screener, /draftStorageKey/)
  assert.match(screener, /draftTimer: null/)
  assert.match(screener, /result\.intelligence && this\.result\.intelligence\.data_quality/)
  assert.match(domainApi, /retryTask \(taskId\)/)
})

test('stock screener exposes bounded, deterministic request and result APIs', () => {
  assert.match(screener, /screenRequestDigest\(payload\)/)
  assert.match(screener, /page_size: this\.resultPageSize/)
  assert.match(screener, /sort_by: this\.resultSortBy/)
  assert.match(screener, /quality: this\.resultQuality/)
})

test('live strategy editor shows the concrete source compilation error', () => {
  assert.match(editor, /:description="sourceContractErrorMessage \|\| \$t\('strategyV2\.compileFailedHint'\)"/)
  assert.match(editor, /contractResult\.error\.backendMessage/)
  assert.match(editor, /error\.backendMessage \|\| error\.message/)
})
