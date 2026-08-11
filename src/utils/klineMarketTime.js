export const CN_STOCK_TIMEZONE = 'Asia/Shanghai'

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_TIMEFRAMES = new Set(['1D', '1W'])

export function isCNStockMarket (market) {
  return String(market || '').trim().toLowerCase() === 'cnstock'
}

export function getKlineMarketTimezone (market) {
  if (isCNStockMarket(market)) return CN_STOCK_TIMEZONE
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch (_) {
    return 'UTC'
  }
}

export function normalizeKlineTimestampMs (value) {
  let timestamp = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(timestamp)) return null
  if (timestamp < 1e10) timestamp *= 1000
  return timestamp
}

export function cnTradeDateTimestampMs (tradeDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tradeDate || '').trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS
  const shanghaiCalendar = new Date(timestamp + SHANGHAI_OFFSET_MS)
  if (
    shanghaiCalendar.getUTCFullYear() !== year ||
    shanghaiCalendar.getUTCMonth() !== month - 1 ||
    shanghaiCalendar.getUTCDate() !== day
  ) return null
  return timestamp
}

export function resolveMarketKlineTimestampMs (item, market, timeframe, fallbackResolver) {
  const rawTimestamp = normalizeKlineTimestampMs(item && (item.time ?? item.timestamp))
  const normalizedTimeframe = String(timeframe || '')
  if (isCNStockMarket(market) && DAY_TIMEFRAMES.has(normalizedTimeframe)) {
    return cnTradeDateTimestampMs(item && item.trade_date) ?? rawTimestamp
  }
  return typeof fallbackResolver === 'function' ? fallbackResolver(rawTimestamp) : rawTimestamp
}

export function formatMarketKlineTime (timestamp, market, timeframe) {
  const normalizedTimestamp = normalizeKlineTimestampMs(timestamp)
  if (normalizedTimestamp == null) return '--'
  const dateOnly = DAY_TIMEFRAMES.has(String(timeframe || ''))
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: getKlineMarketTimezone(market),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(normalizedTimestamp)).map(part => [part.type, part.value])
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return dateOnly ? date : `${date} ${parts.hour}:${parts.minute}`
}
