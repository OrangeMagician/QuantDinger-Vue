const STORAGE_KEY = 'qd_screener_candidate_context_v1'
const MAX_CANDIDATES = 100

export function normalizeCandidateSymbol (value) {
  const raw = String(value || '').trim().toUpperCase()
  if (/^\d{6}\.(SH|SZ|BJ)$/.test(raw)) return raw
  const code = raw.replace(/\D/g, '').slice(0, 6)
  if (!code) return raw
  return `${code}.${code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') || code.startsWith('9') ? 'BJ' : 'SZ'}`
}

export function buildCandidateContext ({ rows = [], selectedRows = [], current, taskId = '', timeframe = '1D' } = {}) {
  const source = selectedRows.length ? selectedRows : rows
  const candidates = []
  const seen = new Set()
  for (const row of source) {
    const symbol = normalizeCandidateSymbol(row && row.symbol)
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    candidates.push({
      symbol,
      name: String((row && row.name) || ''),
      decisionScore: Number((row && row.decision_score) || 0),
      matchScore: Number((row && row.match_score) || 0)
    })
    if (candidates.length >= MAX_CANDIDATES) break
  }
  const currentSymbol = normalizeCandidateSymbol(current && current.symbol)
  if (currentSymbol && !seen.has(currentSymbol)) {
    candidates.unshift({
      symbol: currentSymbol,
      name: String((current && current.name) || ''),
      decisionScore: Number((current && current.decision_score) || 0),
      matchScore: Number((current && current.match_score) || 0)
    })
    if (candidates.length > MAX_CANDIDATES) candidates.pop()
  }
  return {
    version: 1,
    taskId: String(taskId || ''),
    timeframe: String(timeframe || '1D'),
    currentSymbol,
    candidates,
    createdAt: new Date().toISOString()
  }
}

export function saveCandidateContext (context, storage = window.sessionStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(context))
    return true
  } catch (_) {
    return false
  }
}

export function loadCandidateContext (storage = window.sessionStorage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    if (!value || value.version !== 1 || !Array.isArray(value.candidates)) return null
    const candidates = []
    const seen = new Set()
    for (const item of value.candidates) {
      const symbol = normalizeCandidateSymbol(item && item.symbol)
      if (!symbol || seen.has(symbol)) continue
      seen.add(symbol)
      candidates.push({
        symbol,
        name: String((item && item.name) || ''),
        decisionScore: Number((item && item.decisionScore) || 0),
        matchScore: Number((item && item.matchScore) || 0)
      })
      if (candidates.length >= MAX_CANDIDATES) break
    }
    if (!candidates.length) return null
    return { ...value, currentSymbol: normalizeCandidateSymbol(value.currentSymbol), candidates }
  } catch (_) {
    return null
  }
}

export function candidatePosition (context, symbol) {
  if (!context || !Array.isArray(context.candidates)) return { index: -1, total: 0, previous: null, next: null }
  const target = normalizeCandidateSymbol(symbol)
  const index = context.candidates.findIndex(item => normalizeCandidateSymbol(item.symbol) === target)
  return {
    index,
    total: context.candidates.length,
    previous: index > 0 ? context.candidates[index - 1] : null,
    next: index >= 0 && index < context.candidates.length - 1 ? context.candidates[index + 1] : null
  }
}

export { STORAGE_KEY as SCREENER_CANDIDATE_STORAGE_KEY }
