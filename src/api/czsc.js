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
