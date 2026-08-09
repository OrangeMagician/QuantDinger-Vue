import request from '@/utils/request'

export function getEngineCapabilities () {
  return request({ url: '/api/v2/engines', method: 'get', timeout: 12000 })
}

export function searchMarketSymbols (params = {}) {
  return request({ url: '/api/v2/market/symbols', method: 'get', params, timeout: 15000 })
}

export function getMarketBars (params = {}) {
  return request({ url: '/api/v2/market/bars', method: 'get', params, timeout: 30000 })
}

export function createChartLayerRun (data, idempotencyKey) {
  return request({
    url: '/api/v2/chart-layer-runs',
    method: 'post',
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeout: 15000
  })
}

export function computeChartLayers (data) {
  return request({
    url: '/api/v2/chart-layers/compute',
    method: 'post',
    data,
    timeout: 60000
  })
}

export function createMultiPeriodRun (data, idempotencyKey) {
  return request({
    url: '/api/v2/multi-period-runs',
    method: 'post',
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeout: 15000
  })
}

export function createCzscBacktest (data, idempotencyKey) {
  return request({
    url: '/api/v2/backtests',
    method: 'post',
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeout: 15000
  })
}

export function createFactorResearch (data, idempotencyKey) {
  return request({
    url: '/api/v2/factor-research',
    method: 'post',
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeout: 15000
  })
}

export function getFactorCatalog () {
  return request({ url: '/api/v2/factors/catalog', method: 'get', timeout: 20000 })
}

export function getSignalCatalog (params = {}) {
  return request({ url: '/api/v2/signals/catalog', method: 'get', params, timeout: 20000 })
}

export function evaluateUnifiedSignal (data) {
  return request({ url: '/api/v2/signals/evaluate', method: 'post', data, timeout: 60000 })
}

export function validateSignalGraph (data) {
  return request({ url: '/api/v2/signals/graph/validate', method: 'post', data, timeout: 20000 })
}

export function compileSignalGraph (data) {
  return request({ url: '/api/v2/signals/graph/compile', method: 'post', data, timeout: 20000 })
}

export function evaluateSignalGraph (data) {
  return request({ url: '/api/v2/signals/graph/evaluate', method: 'post', data, timeout: 60000 })
}

export function getStockPoolOptions () {
  return request({ url: '/api/v2/stock-pools/options', method: 'get', timeout: 60000 })
}

export function previewStockPool (data) {
  return request({ url: '/api/v2/stock-pools/preview', method: 'post', data, timeout: 60000 })
}

export function listScreenPlans () {
  return request({ url: '/api/v2/screen-plans', method: 'get', timeout: 15000 })
}

export function saveScreenPlan (data) {
  return request({ url: '/api/v2/screen-plans', method: 'post', data, timeout: 15000 })
}

export function deleteScreenPlan (planKey) {
  return request({ url: `/api/v2/screen-plans/${encodeURIComponent(planKey)}`, method: 'delete', timeout: 15000 })
}

export function createScreen (data, idempotencyKey) {
  return request({
    url: '/api/v2/screens',
    method: 'post',
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeout: 15000
  })
}

export function getScreenRows (taskId, params = {}) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/rows`, method: 'get', params, timeout: 20000 })
}

export function getScreenHistory (params = {}) {
  return request({ url: '/api/v2/screens/history', method: 'get', params, timeout: 20000 })
}

export function validateScreen (taskId, data = {}) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/validate`, method: 'post', data, timeout: 15000 })
}

export function submitScreenReviewSignals (taskId, data) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/review-signals`, method: 'post', data, timeout: 60000 })
}

export function listTasks (params = {}) {
  return request({ url: '/api/v2/tasks', method: 'get', params, timeout: 20000 })
}

export function getTask (taskId) {
  return request({ url: `/api/v2/tasks/${encodeURIComponent(taskId)}`, method: 'get', timeout: 15000 })
}

export function cancelTask (taskId) {
  return request({ url: `/api/v2/tasks/${encodeURIComponent(taskId)}/cancel`, method: 'post', timeout: 15000 })
}

export function retryTask (taskId) {
  return request({ url: `/api/v2/tasks/${encodeURIComponent(taskId)}/retry`, method: 'post', timeout: 15000 })
}

export function listResearchResults (params = {}) {
  return request({ url: '/api/v2/results', method: 'get', params, timeout: 20000 })
}

export function registerCzscStrategies () {
  return request({ url: '/api/v2/strategies/czsc-templates/register', method: 'post', timeout: 30000 })
}

export function listUnifiedStrategies (params = {}) {
  return request({ url: '/api/v2/strategies', method: 'get', params, timeout: 20000 })
}

export function importLegacyResults (items) {
  return request({ url: '/api/v2/legacy-results/import', method: 'post', data: { items }, timeout: 60000 })
}

export function listSignals (params = {}) {
  return request({ url: '/api/v2/signals', method: 'get', params, timeout: 20000 })
}

export function evaluateStrategySignal (strategyId, data, idempotencyKey) {
  return request({
    url: `/api/v2/strategies/${encodeURIComponent(strategyId)}/signals/evaluate`,
    method: 'post',
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeout: 15000
  })
}

export function reviewSignal (signalId, data) {
  return request({ url: `/api/v2/signals/${encodeURIComponent(signalId)}/reviews`, method: 'post', data, timeout: 15000 })
}

export function compileScreenQuery (query) {
  return request({ url: '/api/v2/screens/compile-query', method: 'post', data: { query }, timeout: 20000 })
}

export function getScreenDataQuality () {
  return request({ url: '/api/v2/screens/data-quality', method: 'get', timeout: 20000 })
}

export function createScreenPortfolio (taskId, data = {}) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/portfolio`, method: 'post', data, timeout: 20000 })
}

export function listScreenPortfolios (params = {}) {
  return request({ url: '/api/v2/screen-portfolios', method: 'get', params, timeout: 20000 })
}

export function saveScreenFeedback (taskId, data) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/feedback`, method: 'post', data, timeout: 15000 })
}

export function getScreenFeedbackAnalytics () {
  return request({ url: '/api/v2/screens/feedback/analytics', method: 'get', timeout: 15000 })
}

export function listScreenSchedules () {
  return request({ url: '/api/v2/screen-schedules', method: 'get', timeout: 15000 })
}

export function saveScreenSchedule (planKey, data) {
  return request({ url: `/api/v2/screen-schedules/${encodeURIComponent(planKey)}`, method: 'put', data, timeout: 15000 })
}

export function listScreenPlanVersions (planKey) {
  return request({ url: `/api/v2/screen-plans/${encodeURIComponent(planKey)}/versions`, method: 'get', timeout: 15000 })
}

export function listScreenPlanLibrary (params = {}) {
  return request({ url: '/api/v2/screen-plan-library', method: 'get', params, timeout: 15000 })
}

export function compareScreens (params) {
  return request({ url: '/api/v2/screens/compare', method: 'get', params, timeout: 20000 })
}

export function getScreenEvents (taskId, params = {}) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/events`, method: 'get', params, timeout: 20000 })
}

export function getScreenDecisionCenter () {
  return request({ url: '/api/v2/screens/decision-center', method: 'get', timeout: 20000 })
}

export function getScreenDataGovernance () {
  return request({ url: '/api/v2/screens/data-governance', method: 'get', timeout: 20000 })
}

export function syncScreenFundamentals (data = {}) {
  return request({ url: '/api/v2/screens/data-governance/fundamentals/sync', method: 'post', data, timeout: 15000 })
}

export function ingestScreenDataset (dataset, data) {
  return request({ url: `/api/v2/screens/data-governance/${encodeURIComponent(dataset)}/ingest`, method: 'post', data, timeout: 60000 })
}

export function getScreenCandidateTimeline (symbol) {
  return request({ url: `/api/v2/screens/candidates/${encodeURIComponent(symbol)}/timeline`, method: 'get', timeout: 20000 })
}

export function createScreenDailySummary (taskId) {
  return request({ url: `/api/v2/screens/${encodeURIComponent(taskId)}/daily-summary`, method: 'post', timeout: 20000 })
}

export function getScreenPersonalization () {
  return request({ url: '/api/v2/screens/personalization', method: 'get', timeout: 15000 })
}

export function createScreenExperiment (data) {
  return request({ url: '/api/v2/screens/experiments', method: 'post', data, timeout: 15000 })
}

export function getScreenExperiment (experimentId) {
  return request({ url: `/api/v2/screens/experiments/${encodeURIComponent(experimentId)}`, method: 'get', timeout: 15000 })
}

export function optimizeScreenPortfolio (data) {
  return request({ url: '/api/v2/screens/portfolio-optimize', method: 'post', data, timeout: 30000 })
}

export function createScreenPortfolioAccount (data) {
  return request({ url: '/api/v2/screens/portfolio-accounts', method: 'post', data, timeout: 15000 })
}

export function rebalanceScreenPortfolioAccount (accountId, data) {
  return request({ url: `/api/v2/screens/portfolio-accounts/${encodeURIComponent(accountId)}/rebalance`, method: 'post', data, timeout: 30000 })
}
