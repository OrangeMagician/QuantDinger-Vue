import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const componentPath = fileURLToPath(
  new URL('../../src/views/indicator-ide/index.vue', import.meta.url)
)
const source = fs.readFileSync(componentPath, 'utf8')

test('indicator toolbar searches the full market catalog and auto-adds a selected result', () => {
  assert.match(source, /:filter-option="false"[\s\S]*?@search="onWatchlistSearch"/)
  assert.match(source, /searchSymbols\(\{ keyword, limit: 40 \}\)/)
  assert.match(source, /async handleWatchlistChange \(val\)[\s\S]*?this\.watchlistSearchResults[\s\S]*?await this\.addSymbolToWatchlist\(row\)[\s\S]*?this\.applySymbolSelection\(row\)/)
})

test('add-symbol dialog is viewport constrained and gives every market an equal-width tab', () => {
  assert.match(source, /width="820px"/)
  assert.match(source, /ide-add-symbol-modal-wrap/)
  assert.match(source, /max-width:\s*calc\(100vw - 32px\)/)
  assert.match(source, /grid-auto-columns:\s*minmax\(72px, 1fr\)/)
})
