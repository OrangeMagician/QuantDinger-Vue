import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { MARKET_COLORS, marketDirectionColor, marketPalette, signedMarketColor } from '../../src/utils/marketColors.js'

test('uses Chinese market convention for price direction', () => {
  assert.equal(marketDirectionColor('up'), MARKET_COLORS.light.rise)
  assert.equal(marketDirectionColor('bullish'), MARKET_COLORS.light.rise)
  assert.equal(marketDirectionColor('down'), MARKET_COLORS.light.fall)
  assert.equal(marketDirectionColor('bearish'), MARKET_COLORS.light.fall)
})

test('maps buy and long to rise while sell and short map to fall', () => {
  assert.equal(marketDirectionColor('buy'), MARKET_COLORS.light.rise)
  assert.equal(marketDirectionColor('open_long'), MARKET_COLORS.light.rise)
  assert.equal(marketDirectionColor('close_short'), MARKET_COLORS.light.rise)
  assert.equal(marketDirectionColor('reduce_short'), MARKET_COLORS.light.rise)
  assert.equal(marketDirectionColor('sell'), MARKET_COLORS.light.fall)
  assert.equal(marketDirectionColor('open_short'), MARKET_COLORS.light.fall)
  assert.equal(marketDirectionColor('close_long'), MARKET_COLORS.light.fall)
  assert.equal(marketDirectionColor('reduce_long'), MARKET_COLORS.light.fall)
})

test('supports signed values and dark theme without changing neutral semantics', () => {
  assert.equal(signedMarketColor(1, true), MARKET_COLORS.dark.rise)
  assert.equal(signedMarketColor(-1, true), MARKET_COLORS.dark.fall)
  assert.equal(signedMarketColor(0, true), MARKET_COLORS.dark.neutral)
  assert.equal(marketPalette(true), MARKET_COLORS.dark)
})

test('localized indicator examples use rise-red buy and fall-green sell markers', () => {
  const locales = ['en-US', 'ar-SA', 'de-DE', 'fr-FR', 'ja-JP', 'ko-KR', 'ru-RU', 'th-TH', 'vi-VN', 'zh-TW']
  for (const locale of locales) {
    const path = fileURLToPath(new URL(`../../src/locales/lang/${locale}.js`, import.meta.url))
    const source = readFileSync(path, 'utf8')
    const buyMarkers = source.match(/type\\": \\"buy\\".*?color\\": \\"#F5222D/g) || []
    const sellMarkers = source.match(/type\\": \\"sell\\".*?color\\": \\"#52C41A/g) || []

    assert.equal(buyMarkers.length, 2, `${locale} buy marker count`)
    assert.equal(sellMarkers.length, 2, `${locale} sell marker count`)
    assert.doesNotMatch(source, /type\\": \\"buy\\".*?color\\": \\"#00E676/)
    assert.doesNotMatch(source, /type\\": \\"sell\\".*?color\\": \\"#FF5252/)
  }
})
