import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../src/', import.meta.url)

async function source (path) {
  return readFile(new URL(path, root), 'utf8')
}

test('CZSC workbench exposes integrated cockpit, research and review views', async () => {
  const workbench = await source('views/czsc-workbench/index.vue')

  for (const tab of ['structure', 'cockpit', 'multi-period', 'factor-lab', 'quality', 'watchlist', 'research-ops', 'strategy', 'scan', 'backtest', 'review']) {
    assert.match(workbench, new RegExp(`key="${tab}"`))
  }
  assert.match(workbench, /<dashboard-panel/)
  assert.match(workbench, /<multi-period-panel/)
  assert.match(workbench, /<factor-lab-panel/)
  assert.match(workbench, /<quality-panel/)
  assert.match(workbench, /<smart-watchlist-panel/)
  assert.match(workbench, /<research-ops-panel/)
  assert.match(workbench, /<strategy-panel/)
  assert.match(workbench, /<scan-panel/)
  assert.match(workbench, /<backtest-panel/)
  assert.match(workbench, /<review-panel/)
  assert.match(workbench, /searchCzscSymbols/)
  assert.match(workbench, /getScriptTemplateList/)
})

test('CZSC API includes bounded research, TradingView, and Retraq endpoints', async () => {
  const api = await source('api/czsc.js')

  for (const endpoint of [
    '/api/czsc/templates',
    '/api/czsc/symbols/search',
    '/api/czsc/evaluate',
    '/api/czsc/scan',
    '/api/czsc/screener',
    '/api/czsc/signal-factors/catalog',
    '/api/czsc/signal-factors/screener',
    '/api/czsc/factors/catalog',
    '/api/czsc/multi-period',
    '/api/czsc/factors/evaluate',
    '/api/czsc/signal-quality',
    '/api/czsc/watchlist',
    '/api/czsc/watchlist/add',
    '/api/czsc/watchlist/remove',
    '/api/czsc/watchlist/scan',
    '/api/czsc/dashboard',
    '/api/czsc/backtest',
    '/api/czsc/tradingview/normalize',
    '/api/czsc/retraq/submit',
    '/api/czsc/retraq/submit-external',
    '/api/czsc/retraq/status',
    '/api/czsc/research-ops/suite',
    '/api/czsc/research-ops/ai-config',
    '/api/czsc/research-ops/workflows',
    '/api/czsc/research-ops/signals/journal'
  ]) {
    assert.match(api, new RegExp(endpoint.replaceAll('/', '\\/')))
  }
})

test('ResearchOps panel wires ten-direction suite, AI config, workflows and safe secret handling', async () => {
  const panel = await source('views/czsc-workbench/components/ResearchOpsPanel.vue')

  assert.match(panel, /runCzscResearchOpsSuite/)
  assert.match(panel, /getCzscResearchOpsAiConfig/)
  assert.match(panel, /saveCzscResearchOpsAiConfig/)
  assert.match(panel, /saveCzscResearchOpsWorkflow/)
  assert.match(panel, /quantdinger\.czsc\.research-ops\.v1/)
  for (const key of [
    'data_governance',
    'signal_knowledge',
    'factor_experiment',
    'strategy_workflow',
    'review_cockpit',
    'smart_watchlist_v2',
    'external_signal_center',
    'pretrade_validation',
    'ai_research_assistant',
    'ops_dashboard'
  ]) {
    assert.match(panel, new RegExp(key))
  }
  assert.match(panel, /api_key_configured/)
  assert.doesNotMatch(panel, /RETRAQ_SIGNAL_BRIDGE_SECRET/)
})

test('Retraq review requires confirmation and never exposes integration secrets', async () => {
  const review = await source('views/czsc-workbench/components/ReviewPanel.vue')

  assert.match(review, /this\.\$confirm/)
  assert.match(review, /submitCzscToRetraq/)
  assert.match(review, /submitExternalSignalToRetraq/)
  assert.match(review, /getRetraqSignalStatus/)
  assert.doesNotMatch(review, /RETRAQ_SIGNAL_BRIDGE_SECRET/)
  assert.doesNotMatch(review, /secret:/)
})

test('CZSC chart renders volume and MACD panes', async () => {
  const chart = await source('views/czsc-workbench/components/CzscChart.vue')

  assert.match(chart, /createIndicator\('VOL'/)
  assert.match(chart, /createIndicator\('MACD'/)
  assert.match(chart, /czscSignalMarker/)
})

test('CZSC structure chart follows viewport height and summary details remain scrollable', async () => {
  const workbench = await source('views/czsc-workbench/index.vue')
  const chart = await source('views/czsc-workbench/components/CzscChart.vue')

  assert.match(workbench, /height: clamp\(440px, calc\(100dvh - 224px\), 720px\)/)
  assert.match(workbench, /\.summary-region \{[^}]*overflow-y: auto/)
  assert.match(workbench, /\.workbench-grid \{ grid-template-columns: 1fr; height: auto; overflow: visible; \}/)
  assert.doesNotMatch(workbench, /\$t\('czsc\.(?:source|engine)'\)/)
  assert.match(chart, /min-height: 0/)
})

test('CZSC scan panel supports factor screening persistence and result actions', async () => {
  const scan = await source('views/czsc-workbench/components/ScanPanel.vue')

  assert.match(scan, /screenCzscSignalFactors/)
  assert.match(scan, /SignalFactorSelector/)
  assert.match(scan, /signalFactorConditions/)
  assert.match(scan, /addCzscWatchlistItem/)
  assert.match(scan, /quantdinger\.czsc\.scan\.v2/)
  assert.match(scan, /saveFactorTemplate/)
  assert.match(scan, /exportResult/)
  assert.match(scan, /addWatchlist/)
  assert.match(scan, /factor_screener/)
})

test('Signal factor selector exposes all clickable condition sources', async () => {
  const selector = await source('views/czsc-workbench/components/SignalFactorSelector.vue')
  const researchOps = await source('views/czsc-workbench/components/ResearchOpsPanel.vue')
  const watchlist = await source('views/czsc-workbench/components/SmartWatchlistPanel.vue')

  assert.match(selector, /getCzscSignalFactorCatalog/)
  for (const sourceKey of ['feature_conditions', 'enhanced_signals', 'factor_library', 'template_signals']) {
    assert.match(selector, new RegExp(sourceKey))
  }
  assert.match(selector, /selectedConditions/)
  assert.match(researchOps, /<signal-factor-selector/)
  assert.match(watchlist, /<signal-factor-selector/)
})

test('New CZSC research panels wire to backend workflows and manual review only sources', async () => {
  const panels = {
    dashboard: await source('views/czsc-workbench/components/DashboardPanel.vue'),
    multi: await source('views/czsc-workbench/components/MultiPeriodPanel.vue'),
    factor: await source('views/czsc-workbench/components/FactorLabPanel.vue'),
    quality: await source('views/czsc-workbench/components/QualityPanel.vue'),
    watchlist: await source('views/czsc-workbench/components/SmartWatchlistPanel.vue')
  }

  assert.match(panels.dashboard, /getCzscDashboard/)
  assert.match(panels.dashboard, /operation_cockpit/)
  assert.match(panels.multi, /analyzeCzscMultiPeriod/)
  assert.match(panels.multi, /czsc_multi_period/)
  assert.match(panels.factor, /getCzscFactorCatalog/)
  assert.match(panels.factor, /evaluateCzscFactors/)
  assert.match(panels.quality, /getCzscSignalQuality/)
  assert.match(panels.watchlist, /getCzscSmartWatchlist/)
  assert.match(panels.watchlist, /scanCzscWatchlist/)
  assert.match(panels.watchlist, /smart_watchlist/)
})
