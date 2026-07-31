import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_MARKET_COLOR_CONVENTION,
  MARKET_COLOR_CONVENTIONS,
  MARKET_COLORS,
  applyMarketColorConvention,
  marketColorWithAlpha,
  marketDirectionColor,
  marketPalette,
  normalizeMarketColorConvention,
  signedMarketColor
} from '../../src/utils/marketColors.js'

const riseRed = MARKET_COLOR_CONVENTIONS.RISE_RED_FALL_GREEN
const riseGreen = MARKET_COLOR_CONVENTIONS.RISE_GREEN_FALL_RED

test('uses Chinese market convention for price direction', () => {
  assert.equal(MARKET_COLORS[riseRed].light.rise, '#f92855')
  assert.equal(MARKET_COLORS[riseRed].light.fall, '#2dc08e')
  assert.equal(marketDirectionColor('up'), MARKET_COLORS[riseRed].light.rise)
  assert.equal(marketDirectionColor('bullish'), MARKET_COLORS[riseRed].light.rise)
  assert.equal(marketDirectionColor('down'), MARKET_COLORS[riseRed].light.fall)
  assert.equal(marketDirectionColor('bearish'), MARKET_COLORS[riseRed].light.fall)
})

test('maps buy and long to rise while sell and short map to fall', () => {
  assert.equal(marketDirectionColor('buy'), MARKET_COLORS[riseRed].light.rise)
  assert.equal(marketDirectionColor('open_long'), MARKET_COLORS[riseRed].light.rise)
  assert.equal(marketDirectionColor('close_short'), MARKET_COLORS[riseRed].light.rise)
  assert.equal(marketDirectionColor('reduce_short'), MARKET_COLORS[riseRed].light.rise)
  assert.equal(marketDirectionColor('sell'), MARKET_COLORS[riseRed].light.fall)
  assert.equal(marketDirectionColor('open_short'), MARKET_COLORS[riseRed].light.fall)
  assert.equal(marketDirectionColor('close_long'), MARKET_COLORS[riseRed].light.fall)
  assert.equal(marketDirectionColor('reduce_long'), MARKET_COLORS[riseRed].light.fall)
})

test('supports signed values and dark theme without changing neutral semantics', () => {
  assert.equal(signedMarketColor(1, true), MARKET_COLORS[riseRed].dark.rise)
  assert.equal(signedMarketColor(-1, true), MARKET_COLORS[riseRed].dark.fall)
  assert.equal(signedMarketColor(0, true), MARKET_COLORS[riseRed].dark.neutral)
  assert.equal(marketPalette(true), MARKET_COLORS[riseRed].dark)
})

test('swaps rise and fall palettes for the international convention', () => {
  assert.equal(marketDirectionColor('rise', false, riseGreen), MARKET_COLORS[riseRed].light.fall)
  assert.equal(marketDirectionColor('fall', false, riseGreen), MARKET_COLORS[riseRed].light.rise)
  assert.equal(signedMarketColor(1, true, riseGreen), MARKET_COLORS[riseRed].dark.fall)
  assert.equal(signedMarketColor(-1, true, riseGreen), MARKET_COLORS[riseRed].dark.rise)
  assert.equal(marketColorWithAlpha('rise', 0.25, false, riseGreen), 'rgba(45, 192, 142, 0.25)')
})

test('normalizes, applies, and exposes the persisted convention on the root element', () => {
  const root = { dataset: {} }
  assert.equal(normalizeMarketColorConvention('invalid'), DEFAULT_MARKET_COLOR_CONVENTION)
  assert.equal(applyMarketColorConvention(riseGreen, root), riseGreen)
  assert.equal(root.dataset.marketColorConvention, riseGreen)

  const storeSource = readFileSync(fileURLToPath(new URL('../../src/store/modules/app.js', import.meta.url)), 'utf8')
  assert.match(storeSource, /storage\.get\(TOGGLE_MARKET_COLOR_CONVENTION\)/)
  assert.match(storeSource, /storage\.set\(TOGGLE_MARKET_COLOR_CONVENTION, nextConvention\)/)

  const cssSource = readFileSync(fileURLToPath(new URL('../../src/global.less', import.meta.url)), 'utf8')
  assert.match(cssSource, /data-market-color-convention='rise-green-fall-red'/)
  assert.match(cssSource, /--market-rise-color: #2dc08e/)
  assert.match(cssSource, /--market-fall-color: #f92855/)
})

test('localized indicator examples defer default signal colors to the selected convention', () => {
  const locales = ['en-US', 'ar-SA', 'de-DE', 'fr-FR', 'ja-JP', 'ko-KR', 'ru-RU', 'th-TH', 'vi-VN', 'zh-CN', 'zh-TW']
  for (const locale of locales) {
    const path = fileURLToPath(new URL(`../../src/locales/lang/${locale}.js`, import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /type\\": \\"(?:buy|sell)\\"[^}]*color\\":/, `${locale} signal color`)
  }
})
