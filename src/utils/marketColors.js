export const MARKET_COLOR_CONVENTIONS = Object.freeze({
  RISE_RED_FALL_GREEN: 'rise-red-fall-green',
  RISE_GREEN_FALL_RED: 'rise-green-fall-red'
})

export const DEFAULT_MARKET_COLOR_CONVENTION = MARKET_COLOR_CONVENTIONS.RISE_RED_FALL_GREEN
export const MARKET_COLOR_CONVENTION_EVENT = 'market-color-convention-change'

const RED_GREEN_COLORS = Object.freeze({
  light: Object.freeze({
    rise: '#f92855',
    riseStrong: '#f92855',
    riseSoft: 'rgba(249, 40, 85, 0.12)',
    fall: '#2dc08e',
    fallStrong: '#2dc08e',
    fallSoft: 'rgba(45, 192, 142, 0.12)',
    neutral: '#8c8c8c'
  }),
  dark: Object.freeze({
    rise: '#f92855',
    riseStrong: '#f92855',
    riseSoft: 'rgba(249, 40, 85, 0.16)',
    fall: '#2dc08e',
    fallStrong: '#2dc08e',
    fallSoft: 'rgba(45, 192, 142, 0.16)',
    neutral: '#8c8c8c'
  })
})

const GREEN_RED_COLORS = Object.freeze({
  light: Object.freeze({
    rise: RED_GREEN_COLORS.light.fall,
    riseStrong: RED_GREEN_COLORS.light.fallStrong,
    riseSoft: RED_GREEN_COLORS.light.fallSoft,
    fall: RED_GREEN_COLORS.light.rise,
    fallStrong: RED_GREEN_COLORS.light.riseStrong,
    fallSoft: RED_GREEN_COLORS.light.riseSoft,
    neutral: RED_GREEN_COLORS.light.neutral
  }),
  dark: Object.freeze({
    rise: RED_GREEN_COLORS.dark.fall,
    riseStrong: RED_GREEN_COLORS.dark.fallStrong,
    riseSoft: RED_GREEN_COLORS.dark.fallSoft,
    fall: RED_GREEN_COLORS.dark.rise,
    fallStrong: RED_GREEN_COLORS.dark.riseStrong,
    fallSoft: RED_GREEN_COLORS.dark.riseSoft,
    neutral: RED_GREEN_COLORS.dark.neutral
  })
})

export const MARKET_COLORS = Object.freeze({
  [MARKET_COLOR_CONVENTIONS.RISE_RED_FALL_GREEN]: RED_GREEN_COLORS,
  [MARKET_COLOR_CONVENTIONS.RISE_GREEN_FALL_RED]: GREEN_RED_COLORS
})

export function normalizeMarketColorConvention (convention) {
  return Object.values(MARKET_COLOR_CONVENTIONS).includes(convention)
    ? convention
    : DEFAULT_MARKET_COLOR_CONVENTION
}

export function currentMarketColorConvention () {
  if (typeof document === 'undefined' || !document.documentElement) return DEFAULT_MARKET_COLOR_CONVENTION
  return normalizeMarketColorConvention(document.documentElement.dataset.marketColorConvention)
}

export function applyMarketColorConvention (convention, root = typeof document !== 'undefined' ? document.documentElement : null) {
  const nextConvention = normalizeMarketColorConvention(convention)
  if (!root) return nextConvention
  const changed = root.dataset.marketColorConvention !== nextConvention
  root.dataset.marketColorConvention = nextConvention
  if (changed && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(MARKET_COLOR_CONVENTION_EVENT, { detail: { convention: nextConvention } }))
  }
  return nextConvention
}

export function marketPalette (dark = false, convention = currentMarketColorConvention()) {
  const colors = MARKET_COLORS[normalizeMarketColorConvention(convention)]
  return dark ? colors.dark : colors.light
}

export function marketDirectionColor (direction, dark = false, convention = currentMarketColorConvention()) {
  const value = String(direction || '').trim().toLowerCase()
  const colors = marketPalette(dark, convention)
  if (['rise', 'up', 'positive', 'profit', 'bullish', 'bull', 'buy', 'long', 'open_long', 'add_long', 'close_short', 'close_short_profit', 'close_short_trailing', 'reduce_short'].includes(value)) return colors.rise
  if (['fall', 'down', 'negative', 'loss', 'bearish', 'bear', 'sell', 'short', 'open_short', 'add_short', 'close_long', 'close_long_profit', 'close_long_trailing', 'reduce_long'].includes(value)) return colors.fall
  return colors.neutral
}

export function signedMarketColor (value, dark = false, convention = currentMarketColorConvention()) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return marketPalette(dark, convention).neutral
  return number > 0 ? marketPalette(dark, convention).rise : marketPalette(dark, convention).fall
}

export function marketColorWithAlpha (direction, alpha, dark = false, convention = currentMarketColorConvention()) {
  const color = marketDirectionColor(direction, dark, convention)
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color)
  if (!match) return color
  const opacity = Math.max(0, Math.min(1, Number(alpha)))
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${opacity})`
}
