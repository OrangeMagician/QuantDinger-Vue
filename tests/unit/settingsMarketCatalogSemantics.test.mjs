import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const settingsSource = readFileSync(new URL('../../src/views/settings/index.vue', import.meta.url), 'utf8')
const zhSource = readFileSync(new URL('../../src/locales/lang/zh-CN.js', import.meta.url), 'utf8')
const enSource = readFileSync(new URL('../../src/locales/lang/en-US.js', import.meta.url), 'utf8')

test('market catalog settings clearly distinguish instrument metadata from K-line downloads', () => {
  assert.match(zhSource, /\"这里只同步各交易所的现货\/\u5408约代码、名称和可用状态，不下载 K 线。/)
  assert.match(enSource, /It does not download K-line bars/)
})

test('market catalog venue table exposes exchanges disabled by server configuration', () => {
  assert.match(settingsSource, /configured_exchanges/)
  assert.match(settingsSource, /if \(!configured\.has\(exchange\)\) status = 'disabled'/)
  assert.match(settingsSource, /settings\.marketCatalog\.status\.\$\{status\}/)
})
