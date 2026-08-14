import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveIndicatorStrategyContext } from '../../src/utils/indicatorStrategyContext.js'

const indicatorIdePath = fileURLToPath(
  new URL('../../src/views/indicator-ide/index.vue', import.meta.url)
)
const klineChartPath = fileURLToPath(
  new URL('../../src/views/indicator-analysis/components/KlineChart.vue', import.meta.url)
)
const strategyIdePath = fileURLToPath(
  new URL('../../src/views/strategy-ide/index.vue', import.meta.url)
)
const indicatorIdeSource = fs.readFileSync(indicatorIdePath, 'utf8')
const klineChartSource = fs.readFileSync(klineChartPath, 'utf8')
const strategyIdeSource = fs.readFileSync(strategyIdePath, 'utf8')

test('indicator-to-strategy conversion has a parameter parser', () => {
  assert.match(
    indicatorIdeSource,
    /parseIndicatorParamRaw \(code\) \{[\s\S]*?this\.parseIndicatorParamSpecs\(code \|\| ''\)[\s\S]*?params\[spec\.name\] = spec\.defaultValue/
  )
  assert.match(
    indicatorIdeSource,
    /buildIndicatorToStrategyContext \(\)[\s\S]*?this\.parseIndicatorParamRaw\(code \|\| ''\)/
  )
})

test('indicator IDE no longer carries the retired execution-column conversion prompt', () => {
  assert.doesNotMatch(indicatorIdeSource, /buildIndicatorToStrategyPrompt \(\)/)
  assert.doesNotMatch(indicatorIdeSource, /open_long\/open_short/)
})

test('hidden marketplace indicators never use browser-delivered source code', () => {
  const start = indicatorIdeSource.indexOf('getIndicatorExecutableCode (indicator, codeOverride)')
  const end = indicatorIdeSource.indexOf('extractIndicatorNameFromCode (code)', start)
  const executableCodeSource = indicatorIdeSource.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.match(executableCodeSource, /if \(this\.isIndicatorCodeHidden\(ind\)\) \{\s*return ''\s*\}/)
  assert.doesNotMatch(executableCodeSource, /runtime_code|runtimeCode|run_code/)
})

test('initial left-edge layout events do not trigger history loading', () => {
  assert.match(
    klineChartSource,
    /const isScrollingLeft = lastVisibleFrom !== null && lastVisibleFrom > data\.from[\s\S]*?if \(isScrollingLeft && canLoadAgain\)/
  )
  assert.doesNotMatch(klineChartSource, /isAlreadyAtEdge/)
  assert.doesNotMatch(
    klineChartSource,
    /formattedData\.length < visibleNeed[\s\S]*?loadMoreHistoryDataForScroll/
  )
})

test('transient kline failures stay in loading state until failure is confirmed', () => {
  assert.match(
    klineChartSource,
    /v-if="\(loading \|\| loadFailurePending\) && !klineData\.length"/
  )
  assert.match(
    klineChartSource,
    /const LOAD_ERROR_REVEAL_DELAY_MS = 1000[\s\S]*?loadFailurePending\.value = false[\s\S]*?loading\.value = true/
  )
  assert.match(
    klineChartSource,
    /const terminalError = [\s\S]*?loadFailurePending\.value = true[\s\S]*?if \(generation !== loadGeneration\) return[\s\S]*?error\.value = terminalError[\s\S]*?loadFailurePending\.value = false/
  )
  assert.match(
    klineChartSource,
    /const KLINE_LOAD_MAX_ATTEMPTS = 2[\s\S]*?for \(let attempt = 1; attempt <= KLINE_LOAD_MAX_ATTEMPTS; attempt \+= 1\)[\s\S]*?isRetryableEmptyKlineError\(loadError\)[\s\S]*?KLINE_LOAD_RETRY_DELAY_MS/
  )
  assert.match(klineChartSource, /v-if="error && !loading && !loadFailurePending"/)
})

test('A-share indicator chart can sync temporary current-day bars and reload in place', () => {
  assert.match(
    indicatorIdeSource,
    /v-if="market === 'CNStock'"[\s\S]*?@click="syncTodayKline"[\s\S]*?indicatorIde\.syncTodayKline/
  )
  assert.match(
    indicatorIdeSource,
    /async syncTodayKline \(\)[\s\S]*?syncTodayMarketBars\(\{ market: this\.market, symbol: this\.symbol \}\)[\s\S]*?chart\.loadKlineData\(\)/
  )
  assert.match(indicatorIdeSource, /syncingTodayKline: false/)
})

test('current-day K-line sync keeps one stable icon slot while loading', () => {
  const start = indicatorIdeSource.indexOf('class="chart-panel-action-btn chart-panel-sync-kline-btn"')
  const end = indicatorIdeSource.indexOf('</a-button>', start)
  const syncButtonSource = indicatorIdeSource.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.match(syncButtonSource, /:disabled="!symbol"/)
  assert.match(syncButtonSource, /:aria-busy="syncingTodayKline \? 'true' : 'false'"/)
  assert.match(syncButtonSource, /<a-icon type="sync" :class="\{ 'anticon-spin': syncingTodayKline \}" \/>/)
  assert.doesNotMatch(syncButtonSource, /:loading=|v-if=/)
})

test('indicator chart reviews screener candidates in place and returns to the source task', () => {
  assert.match(indicatorIdeSource, /loadCandidateContext/)
  assert.match(indicatorIdeSource, /screener-review-strip/)
  assert.match(indicatorIdeSource, /screenerCandidatePosition/)
  assert.match(indicatorIdeSource, /moveScreenerCandidate \(offset\)/)
  assert.match(indicatorIdeSource, /this\.\$router\.replace\(\{ path: '\/indicator-ide', query \}\)/)
  assert.match(indicatorIdeSource, /returnToScreener \(\)[\s\S]*?path: '\/market-screener'[\s\S]*?task_id: taskId/)
})

test('indicator chart exposes detailed K-line quality and stable multi-period reuse', () => {
  assert.match(indicatorIdeSource, /indicatorIde\.klineQuality\.gaps/)
  assert.match(indicatorIdeSource, /indicatorIde\.klineQuality\.incomplete/)
  assert.match(indicatorIdeSource, /raw === 'limited_history'/)
  assert.match(indicatorIdeSource, /indicatorIde\.klineQuality\.missingSessions/)
  assert.match(indicatorIdeSource, /indicatorIde\.klineQuality\.invalidDetails/)
  assert.match(indicatorIdeSource, /klineQualityIssues\.length/)
  assert.match(indicatorIdeSource, /formatKlineQualityIssueValues/)
  assert.match(indicatorIdeSource, /trigger="click"/)
  assert.match(indicatorIdeSource, /chart-panel-data-quality--\$\{klineQualityTone\}/)
  assert.match(indicatorIdeSource, /czscMultiPeriodCache: \{\}/)
  assert.match(indicatorIdeSource, /Date\.now\(\) - cached\.createdAt < 120000/)
  assert.match(indicatorIdeSource, /indicator-multi-\$\{this\.market\}-\$\{this\.symbol\}/)
})

test('hidden quick trade panel does not poll an invalid market during indicator initialization', () => {
  assert.match(
    indicatorIdeSource,
    /<div v-if="quickTradeDrawerVisible" class="ide-quick-right ide-quick-right--chart-fs">/
  )
  assert.doesNotMatch(
    indicatorIdeSource,
    /<div v-show="quickTradeDrawerVisible" class="ide-quick-right ide-quick-right--chart-fs">/
  )
})

test('chart annotations share collision lanes and keep labels away from candle bodies', () => {
  assert.match(klineChartSource, /reserveCzscAnnotationLanes\(\{[\s\S]*?allocateLane: allocateAnnotationLane/)
  assert.match(klineChartSource, /labelLane: text \? allocateLane\(\{ timestamp: end, side: labelSide, text/)
  assert.match(klineChartSource, /const markerGap = 8[\s\S]*?signalY \+ markerGap \+ laneShift/)
  assert.doesNotMatch(klineChartSource, /baseLane: czscLaneCount/)
})

test('indicator conversion route opens before strategy route initialization can replace it', () => {
  assert.match(
    strategyIdeSource,
    /await this\.loadSources\(\)[\s\S]*?if \(this\.isIndicatorConvertRoute\(\)\) \{[\s\S]*?updateRoute: false[\s\S]*?await this\.applyIndicatorConvertRouteOnce\(\)[\s\S]*?return/
  )
  assert.match(
    strategyIdeSource,
    /indicatorId: String\(raw\.indicatorId \|\| raw\.id \|\| ''\)[\s\S]*?market: String\(raw\.market \|\| ''\)[\s\S]*?timeframe: String\(raw\.timeframe \|\| ''\)/
  )
})

test('indicator-to-strategy conversion preserves the source instrument and timeframe', () => {
  const start = strategyIdeSource.indexOf('resolveIndicatorConversionContext (ctx = {})')
  const end = strategyIdeSource.indexOf('async confirmIndicatorToStrategy ()', start)
  const conversionSource = strategyIdeSource.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.match(conversionSource, /resolveIndicatorStrategyContext\(ctx, query, this\.runConfig \|\| \{\}\)/)
  assert.match(conversionSource, /Source instrument: \$\{source\.instrument\}/)
  assert.match(conversionSource, /Source timeframe: \$\{source\.timeframe\}/)
  assert.match(conversionSource, /Never replace them with USStock:SPY/)
  assert.match(conversionSource, /There is no get_current_data API/)
  assert.match(conversionSource, /it has no quantity or cost_basis/)
  assert.match(conversionSource, /never inside initialize\(context\)/)
})

test('indicator conversion resolves Crypto source context without falling back to SPY', () => {
  assert.deepEqual(
    resolveIndicatorStrategyContext({
      market: 'Crypto',
      symbol: 'SOL/USDT',
      exchange_id: 'binance',
      market_type: 'spot',
      timeframe: '1H'
    }),
    {
      market: 'Crypto',
      symbol: 'SOL/USDT',
      exchangeId: 'binance',
      marketType: 'spot',
      timeframe: '1H',
      instrument: 'Crypto:SOL/USDT@binance:spot'
    }
  )
})

test('indicator conversion uses the current strategy context when indicator metadata is generic', () => {
  const resolved = resolveIndicatorStrategyContext({}, {}, {
    market_category: 'Crypto',
    symbol: 'ETH/USDT',
    exchange_id: 'okx',
    market_type: 'swap',
    timeframe: '4H'
  })

  assert.equal(resolved.instrument, 'Crypto:ETH/USDT@okx:swap')
  assert.equal(resolved.timeframe, '4H')
})

test('converted strategy metadata follows the resolved source market context', () => {
  assert.match(
    strategyIdeSource,
    /buildGeneratedMetadata \(ctx = \{\}\)[\s\S]*?const source = this\.resolveIndicatorConversionContext\(ctx\)[\s\S]*?source_indicator_instrument: source\.instrument[\s\S]*?last_run_config: lastRunConfig/
  )
})
