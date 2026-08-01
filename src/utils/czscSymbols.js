export const DEFAULT_CZSC_SYMBOL_ITEMS = Object.freeze([
  Object.freeze({ market: 'CNStock', symbol: '000333.SZ', code: '000333', name: '美的集团', exchange: 'SZ' }),
  Object.freeze({ market: 'CNStock', symbol: '600519.SH', code: '600519', name: '贵州茅台', exchange: 'SH' }),
  Object.freeze({ market: 'CNStock', symbol: '000001.SZ', code: '000001', name: '平安银行', exchange: 'SZ' }),
  Object.freeze({ market: 'CNStock', symbol: '300750.SZ', code: '300750', name: '宁德时代', exchange: 'SZ' }),
  Object.freeze({ market: 'CNStock', symbol: '301280.SZ', code: '301280', name: '珠城科技', exchange: 'SZ' })
])

const SYMBOL_PATTERN = /^([0-9]{6})\.(SH|SZ|BJ)$/i

function fallbackExchangeForCode (code) {
  if (/^(600|601|603|605|688|689|900)/.test(code) || code.startsWith('6')) return 'SH'
  if (/^(000|001|002|003|159|200|300|301)/.test(code) || /^[023]/.test(code)) return 'SZ'
  return 'BJ'
}

function normalizeMetaItem (item) {
  if (!item || typeof item !== 'object') return null
  const symbol = normalizeCzscSymbol(item.symbol || item.ts_code || item.code)
  if (!symbol) return null
  const code = symbol.slice(0, 6)
  const exchange = symbol.slice(-2)
  return {
    ...item,
    market: item.market || 'CNStock',
    symbol,
    code,
    exchange,
    name: String(item.name || item.stock_name || item.display_name || (item.watchlist && item.watchlist.name) || '').trim()
  }
}

export function normalizeCzscSymbol (value) {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  const matched = raw.match(SYMBOL_PATTERN)
  if (matched) return `${matched[1]}.${matched[2].toUpperCase()}`
  const code = raw.replace(/[^0-9]/g, '')
  if (!/^[0-9]{6}$/.test(code)) return ''
  return `${code}.${fallbackExchangeForCode(code)}`
}

export function czscSymbolCode (value) {
  const normalized = normalizeCzscSymbol(value)
  if (normalized) return normalized.slice(0, 6)
  const raw = String(value || '').trim().toUpperCase()
  const matched = raw.match(SYMBOL_PATTERN)
  if (matched) return matched[1]
  const code = raw.replace(/[^0-9]/g, '')
  return /^[0-9]{6}$/.test(code) ? code : raw
}

export function czscSymbolName (item, meta = {}) {
  const payload = item && typeof item === 'object' ? item : { symbol: item }
  const symbol = normalizeCzscSymbol(payload.symbol || payload.ts_code || payload.code)
  const direct = String(payload.name || payload.stock_name || payload.display_name || (payload.watchlist && payload.watchlist.name) || '').trim()
  if (direct) return direct
  const metaItem = symbol ? meta[symbol] || DEFAULT_CZSC_SYMBOL_ITEMS.find(row => row.symbol === symbol) : null
  return metaItem ? String(metaItem.name || '').trim() : ''
}

export function czscSymbolDisplayItem (item, meta = {}) {
  const payload = item && typeof item === 'object' ? item : { symbol: item }
  const symbol = normalizeCzscSymbol(payload.symbol || payload.ts_code || payload.code)
  const code = symbol ? symbol.slice(0, 6) : czscSymbolCode(payload.symbol || payload.ts_code || payload.code)
  const name = czscSymbolName(payload, meta)
  return {
    ...payload,
    symbol: symbol || String(payload.symbol || '').trim().toUpperCase(),
    code,
    name,
    exchange: symbol ? symbol.slice(-2) : payload.exchange
  }
}

export function formatCzscSymbolLabel (item, meta = {}) {
  const display = czscSymbolDisplayItem(item, meta)
  if (!display.code) return display.name || ''
  if (display.name && display.name !== display.code && display.name !== display.symbol) return `${display.code} ${display.name}`
  return display.code
}

export function updateCzscSymbolMeta (current = {}, items = []) {
  const next = { ...current }
  DEFAULT_CZSC_SYMBOL_ITEMS.forEach(item => {
    next[item.symbol] = { ...item }
  })
  ;(Array.isArray(items) ? items : []).forEach(item => {
    const normalized = normalizeMetaItem(item)
    if (normalized) {
      next[normalized.symbol] = {
        ...(next[normalized.symbol] || {}),
        ...normalized,
        name: normalized.name || (next[normalized.symbol] && next[normalized.symbol].name) || ''
      }
    }
  })
  return next
}

export function parseCzscSymbolList (value) {
  return Array.from(new Set(
    String(value || '')
      .toUpperCase()
      .split(/[\s,;，；、]+/)
      .map(normalizeCzscSymbol)
      .filter(Boolean)
  ))
}

export function formatCzscSymbolText (value) {
  return parseCzscSymbolList(value).map(czscSymbolCode).join('\n')
}

export function defaultCzscSymbolText (count = DEFAULT_CZSC_SYMBOL_ITEMS.length) {
  return DEFAULT_CZSC_SYMBOL_ITEMS.slice(0, count).map(item => item.code).join('\n')
}
