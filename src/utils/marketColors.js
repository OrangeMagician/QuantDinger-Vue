export const MARKET_COLORS = Object.freeze({
  light: Object.freeze({
    rise: '#cf1322',
    riseStrong: '#f5222d',
    riseSoft: 'rgba(245, 34, 45, 0.12)',
    fall: '#389e0d',
    fallStrong: '#52c41a',
    fallSoft: 'rgba(82, 196, 26, 0.12)',
    neutral: '#8c8c8c'
  }),
  dark: Object.freeze({
    rise: '#f6465d',
    riseStrong: '#ff7875',
    riseSoft: 'rgba(246, 70, 93, 0.16)',
    fall: '#0ecb81',
    fallStrong: '#95de64',
    fallSoft: 'rgba(14, 203, 129, 0.16)',
    neutral: '#8c8c8c'
  })
})

export function marketPalette (dark = false) {
  return dark ? MARKET_COLORS.dark : MARKET_COLORS.light
}

export function marketDirectionColor (direction, dark = false) {
  const value = String(direction || '').trim().toLowerCase()
  const colors = marketPalette(dark)
  if (['rise', 'up', 'positive', 'profit', 'bullish', 'bull', 'buy', 'long', 'open_long', 'add_long', 'close_short', 'reduce_short'].includes(value)) return colors.rise
  if (['fall', 'down', 'negative', 'loss', 'bearish', 'bear', 'sell', 'short', 'open_short', 'add_short', 'close_long', 'reduce_long'].includes(value)) return colors.fall
  return colors.neutral
}

export function signedMarketColor (value, dark = false) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return marketPalette(dark).neutral
  return number > 0 ? marketPalette(dark).rise : marketPalette(dark).fall
}
