import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../src/', import.meta.url)

async function source (path) {
  return readFile(new URL(path, root), 'utf8')
}

async function fileDoesNotExist (path) {
  await assert.rejects(access(new URL(path, root)), error => error && error.code === 'ENOENT')
}

test('navigation is organized by product tasks and has no visible CZSC entry', async () => {
  const [routes, layout] = await Promise.all([
    source('config/router.config.js'),
    source('layouts/BasicLayout.vue')
  ])

  for (const route of ['/trend-chart', '/market-screener', '/strategy-center', '/backtest-center', '/tasks']) {
    assert.match(routes, new RegExp(`path: '${route.replaceAll('/', '\\/')}'`))
  }
  assert.match(routes, /path: '\/trend-chart'[\s\S]*hidden: true/)
  assert.doesNotMatch(layout, /paths: \['\/trend-chart'\]/)
  assert.match(layout, /paths: \['\/backtest-center'\]/)
  assert.doesNotMatch(layout, /title:\s*['"]CZSC['"]/)
  assert.doesNotMatch(layout, /paths:\s*\['\/czsc-workbench'\]/)
})

test('legacy workbench URLs redirect to the corresponding unified pages', async () => {
  const routes = await source('config/router.config.js')

  assert.match(routes, /path: '\/czsc-workbench'[\s\S]*hidden: true/)
  assert.match(routes, /tab === 'structure'[\s\S]*path: '\/indicator-ide'[\s\S]*builtin: 'czsc'/)
  assert.match(routes, /tab === 'multi-period'[\s\S]*mode: 'multi-period'/)
  assert.match(routes, /\['scan', 'watchlist'\][\s\S]*path: '\/market-screener'/)
  assert.match(routes, /\['factor-lab', 'quality', 'backtest'\][\s\S]*path: '\/backtest-center'/)
  assert.match(routes, /tab === 'strategy'[\s\S]*path: '\/strategy-center'/)
  assert.match(routes, /tab === 'research-ops'[\s\S]*path: '\/tasks'/)
  assert.match(routes, /tab === 'review'[\s\S]*path: '\/signal-reviews'/)
})

test('unified domain client uses v2 product APIs instead of frontend CZSC routes', async () => {
  const api = await source('api/domain.js')

  for (const endpoint of [
    '/api/v2/engines',
    '/api/v2/market/bars',
    '/api/v2/chart-layer-runs',
    '/api/v2/chart-layers/compute',
    '/api/v2/multi-period-runs',
    '/api/v2/backtests',
    '/api/v2/factor-research',
    '/api/v2/factors/catalog',
    '/api/v2/stock-pools/options',
    '/api/v2/screens',
    '/api/v2/tasks',
    '/api/v2/results',
    '/api/v2/strategies',
    '/api/v2/signals'
  ]) {
    assert.match(api, new RegExp(endpoint.replaceAll('/', '\\/')))
  }
  assert.doesNotMatch(api, /\/api\/czsc\//)
  await fileDoesNotExist('api/czsc.js')
})

test('CZSC is a selectable built-in indicator and the legacy trend page keeps multi-period analysis', async () => {
  const [page, ide, chart] = await Promise.all([
    source('views/trend-chart/index.vue'),
    source('views/indicator-ide/index.vue'),
    source('views/indicator-analysis/components/KlineChart.vue')
  ])

  assert.match(page, /createMultiPeriodRun/)
  assert.match(page, /marketOptions/)
  assert.match(page, /computeChartLayers/)
  assert.match(page, /marketRequest\(this\.timeframe\)/)
  assert.match(page, /loadMultiPeriodFromBars/)
  assert.doesNotMatch(page, /createChartLayerRun/)
  assert.match(page, /query\.mode === 'multi-period'/)
  assert.match(ide, /czscIndicatorEnabled/)
  assert.match(ide, /class="ide-czsc-toolbar-toggle"/)
  assert.match(ide, /indicatorIde\.czsc\.name/)
  assert.match(ide, /:czsc-enabled="czscIndicatorEnabled"/)
  assert.match(ide, /czscLayerVisibility/)
  assert.match(chart, /computeChartLayers/)
  assert.match(chart, /bars: bars\.map/)
})

test('structure chart renders volume, MACD and aligned CZSC overlays', async () => {
  const [chart, layers] = await Promise.all([
    source('components/charts/StructureChart.vue'),
    source('utils/czscChartLayers.js')
  ])

  assert.match(chart, /createIndicator\('VOL'/)
  assert.match(chart, /createIndicator\('MACD'/)
  assert.match(chart, /renderCzscOverlays/)
  assert.match(layers, /name: 'czscStroke'/)
  assert.match(layers, /name: 'czscFractal'/)
  assert.match(layers, /name: 'czscSignalMarker'/)
  assert.match(chart, /timestamp: normalizeEpochMilliseconds\(bar\.timestamp\)/)
  assert.match(layers, /normalizeEpochMilliseconds\(stroke\.start_timestamp\)/)
  assert.match(layers, /normalizeEpochMilliseconds\(fractal\.timestamp\)/)
  assert.match(layers, /signal\?\.conditions\?\.fractal_datetime/)
  assert.match(layers, /reserveCzscAnnotationLanes/)
  assert.match(layers, /confirmedKeys\.has/)
})

test('research workflows use one task center and product task IDs', async () => {
  const [tasks, screener, backtests] = await Promise.all([
    source('views/task-center/index.vue'),
    source('views/market-screener/index.vue'),
    source('views/backtest-center/index.vue')
  ])

  assert.match(tasks, /listTasks/)
  assert.match(tasks, /getTask\(row\.task_id\)/)
  assert.match(tasks, /cancelTask\(row\.task_id\)/)
  assert.match(tasks, /retryTask\(row\.task_id\)/)
  assert.doesNotMatch(tasks, /worker_task_id/)
  assert.match(screener, /createScreen/)
  assert.match(screener, /getStockPoolOptions/)
  assert.match(screener, /getWatchlist/)
  assert.match(backtests, /response\.data\.task_id/)
  assert.match(backtests, /listResearchResults/)
})

test('signal review defaults to PENDING and requires an explicit decision', async () => {
  const review = await source('views/signal-reviews/index.vue')

  assert.match(review, /status: 'PENDING'/)
  assert.match(review, /row\.status === 'PENDING'/)
  assert.match(review, /this\.\$confirm/)
  assert.match(review, /reviewSignal\(row\.signal_id, \{ decision \}\)/)
  assert.match(review, /evaluateStrategySignal/)
  assert.doesNotMatch(review, /RETRAQ_SIGNAL_BRIDGE_SECRET/)
  assert.doesNotMatch(review, /api[_-]?key/i)
  assert.doesNotMatch(review, /broker.*credential/i)
})

test('legacy browser results migrate once to PostgreSQL-backed result APIs', async () => {
  const migration = await source('utils/czscLegacyMigration.js')

  assert.match(migration, /importLegacyResults/)
  assert.match(migration, /engine: 'czsc'/)
  assert.match(migration, /dataset_snapshot/)
  assert.match(migration, /localStorage\.removeItem/)
  assert.match(migration, /domain-migration\.v1/)
})

test('deleted CZSC workbench product surfaces stay removed', async () => {
  await Promise.all([
    fileDoesNotExist('views/czsc-workbench/index.vue'),
    fileDoesNotExist('views/czsc-workbench/components/ResearchOpsPanel.vue'),
    fileDoesNotExist('views/czsc-workbench/components/BacktestPanel.vue'),
    fileDoesNotExist('locales/lang/czsc-workbench.js')
  ])
})

test('graph strategy editor exposes the complete declarative action and risk contract', async () => {
  const editor = await source('views/strategy-ide/components/GraphStrategyEditor.vue')

  for (const kind of ['value="open"', 'value="close"', 'value="target_percent"', 'value="target_value"', 'value="target_quantity"']) {
    assert.match(editor, new RegExp(kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(editor, /value="cooldown"/)
  assert.match(editor, /node\.config\.activation_pct/)
  assert.match(editor, /positionSizingKind\(node\)/)
  assert.match(editor, /setPositionSizingValue\(node, \$event\)/)
  assert.match(editor, /handleActionKindChange\(node\)/)
  assert.match(editor, /:disabled="signalUnavailable\(item\)"/)
  assert.match(editor, /structuredParameterValue\(node, key\)/)
})
