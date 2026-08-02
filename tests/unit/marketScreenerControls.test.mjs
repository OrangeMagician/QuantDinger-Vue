import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const screenerPath = fileURLToPath(new URL('../../src/views/market-screener/index.vue', import.meta.url))
const screener = fs.readFileSync(screenerPath, 'utf8')
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

test('live strategy editor shows the concrete source compilation error', () => {
  assert.match(editor, /:description="sourceContractErrorMessage \|\| \$t\('strategyV2\.compileFailedHint'\)"/)
  assert.match(editor, /contractResult\.error\.backendMessage/)
  assert.match(editor, /error\.backendMessage \|\| error\.message/)
})
