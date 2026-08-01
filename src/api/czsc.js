import request from '@/utils/request'

export function getCzscHealth () {
  return request({
    url: '/api/czsc/health',
    method: 'get',
    timeout: 10000
  })
}

export function analyzeCzsc (data) {
  return request({
    url: '/api/czsc/analyze',
    method: 'post',
    data,
    timeout: 45000
  })
}

export function getCzscTemplates () {
  return request({
    url: '/api/czsc/templates',
    method: 'get',
    timeout: 15000
  })
}

export function searchCzscSymbols (params = {}) {
  return request({
    url: '/api/czsc/symbols/search',
    method: 'get',
    params,
    timeout: 15000
  })
}

export function evaluateCzsc (data) {
  return request({
    url: '/api/czsc/evaluate',
    method: 'post',
    data,
    timeout: 45000
  })
}

export function scanCzsc (data) {
  return request({
    url: '/api/czsc/scan',
    method: 'post',
    data,
    timeout: 135000
  })
}

export function screenCzscFactors (data) {
  return request({
    url: '/api/czsc/screener',
    method: 'post',
    data,
    timeout: 180000
  })
}

export function getCzscSignalFactorCatalog () {
  return request({
    url: '/api/czsc/signal-factors/catalog',
    method: 'get',
    timeout: 15000
  })
}

export function screenCzscSignalFactors (data) {
  return request({
    url: '/api/czsc/signal-factors/screener',
    method: 'post',
    data,
    timeout: 240000
  })
}

export function getCzscFactorCatalog () {
  return request({
    url: '/api/czsc/factors/catalog',
    method: 'get',
    timeout: 15000
  })
}

export function analyzeCzscMultiPeriod (data) {
  return request({
    url: '/api/czsc/multi-period',
    method: 'post',
    data,
    timeout: 180000
  })
}

export function evaluateCzscFactors (data) {
  return request({
    url: '/api/czsc/factors/evaluate',
    method: 'post',
    data,
    timeout: 180000
  })
}

export function getCzscSignalQuality (data) {
  return request({
    url: '/api/czsc/signal-quality',
    method: 'post',
    data,
    timeout: 180000
  })
}

export function getCzscSmartWatchlist () {
  return request({
    url: '/api/czsc/watchlist',
    method: 'get',
    timeout: 15000
  })
}

export function addCzscWatchlistItem (data) {
  return request({
    url: '/api/czsc/watchlist/add',
    method: 'post',
    data,
    timeout: 15000
  })
}

export function removeCzscWatchlistItem (data) {
  return request({
    url: '/api/czsc/watchlist/remove',
    method: 'post',
    data,
    timeout: 15000
  })
}

export function scanCzscWatchlist (data) {
  return request({
    url: '/api/czsc/watchlist/scan',
    method: 'post',
    data,
    timeout: 180000
  })
}

export function getCzscDashboard (data) {
  return request({
    url: '/api/czsc/dashboard',
    method: 'post',
    data,
    timeout: 180000
  })
}

export function runCzscResearchOpsSuite (data) {
  return request({
    url: '/api/czsc/research-ops/suite',
    method: 'post',
    data,
    timeout: 240000
  })
}

export function getCzscResearchOpsAiConfig () {
  return request({
    url: '/api/czsc/research-ops/ai-config',
    method: 'get',
    timeout: 15000
  })
}

export function saveCzscResearchOpsAiConfig (data) {
  return request({
    url: '/api/czsc/research-ops/ai-config',
    method: 'post',
    data,
    timeout: 15000
  })
}

export function getCzscResearchOpsWorkflows () {
  return request({
    url: '/api/czsc/research-ops/workflows',
    method: 'get',
    timeout: 15000
  })
}

export function saveCzscResearchOpsWorkflow (data) {
  return request({
    url: '/api/czsc/research-ops/workflows',
    method: 'post',
    data,
    timeout: 15000
  })
}

export function addCzscSignalJournal (data) {
  return request({
    url: '/api/czsc/research-ops/signals/journal',
    method: 'post',
    data,
    timeout: 15000
  })
}

export function backtestCzsc (data) {
  return request({
    url: '/api/czsc/backtest',
    method: 'post',
    data,
    timeout: 135000
  })
}

export function normalizeTradingViewSignal (data) {
  return request({
    url: '/api/czsc/tradingview/normalize',
    method: 'post',
    data,
    timeout: 15000
  })
}

export function submitCzscToRetraq (data) {
  return request({
    url: '/api/czsc/retraq/submit',
    method: 'post',
    data,
    timeout: 30000
  })
}

export function submitExternalSignalToRetraq (data) {
  return request({
    url: '/api/czsc/retraq/submit-external',
    method: 'post',
    data,
    timeout: 30000
  })
}

export function getRetraqSignalStatus (params) {
  return request({
    url: '/api/czsc/retraq/status',
    method: 'get',
    params,
    timeout: 15000
  })
}
