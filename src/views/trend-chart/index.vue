<template>
  <div class="trend-page" :class="{ 'trend-page--dark': isDarkTheme }">
    <header class="trend-toolbar">
      <div class="symbol-control">
        <a-select
          v-model="symbol"
          show-search
          :filter-option="false"
          :not-found-content="symbolSearching ? undefined : null"
          option-label-prop="label"
          class="symbol-select"
          @search="searchSymbols"
          @change="reload"
        >
          <a-spin v-if="symbolSearching" slot="notFoundContent" size="small" />
          <a-select-option
            v-for="item in symbolOptions"
            :key="item.symbol"
            :value="item.symbol"
            :label="symbolLabel(item)"
          >
            <strong>{{ item.symbol }}</strong><span>{{ item.name || '' }}</span>
          </a-select-option>
        </a-select>
        <a-radio-group v-model="timeframe" button-style="solid" size="small" @change="reload">
          <a-radio-button v-for="item in timeframes" :key="item" :value="item">{{ item }}</a-radio-button>
        </a-radio-group>
        <a-select v-model="adjustment" size="small" class="adjust-select" @change="reload">
          <a-select-option value="qfq">{{ $t('trendChart.adjustQfq') }}</a-select-option>
          <a-select-option value="none">{{ $t('trendChart.adjustNone') }}</a-select-option>
          <a-select-option value="hfq">{{ $t('trendChart.adjustHfq') }}</a-select-option>
        </a-select>
      </div>
      <div class="toolbar-actions">
        <a-radio-group v-model="mode" button-style="solid" size="small" @change="reload">
          <a-radio-button value="single"><a-icon type="line-chart" />{{ $t('trendChart.single') }}</a-radio-button>
          <a-radio-button value="multi"><a-icon type="branches" />{{ $t('trendChart.multi') }}</a-radio-button>
        </a-radio-group>
        <a-tooltip :title="$t('trendChart.refresh')">
          <a-button shape="circle" icon="reload" :loading="loading" @click="reload" />
        </a-tooltip>
      </div>
    </header>

    <main v-if="mode === 'single'" class="trend-workspace">
      <section class="chart-stage">
        <div class="chart-status">
          <span><strong>{{ activeSymbolLabel }}</strong>{{ timeframe }}</span>
          <span class="engine-origin"><i :class="workerAvailable ? 'online' : 'offline'" />{{ $t('trendChart.engineSource') }} CZSC 0.9.68</span>
        </div>
        <czsc-chart
          class="trend-chart"
          :analysis="chartAnalysis"
          :visibility="visibility"
          :dark="isDarkTheme"
        />
        <div v-if="barsLoading" class="stage-overlay"><a-spin /><span>{{ $t('trendChart.loadingBars') }}</span></div>
        <a-alert
          v-if="barsError"
          class="stage-message"
          type="error"
          show-icon
          :message="$t('trendChart.barsFailed')"
          :description="barsError"
        />
      </section>

      <aside class="layer-panel">
        <div class="panel-title">
          <strong>{{ $t('trendChart.layers') }}</strong>
          <a-tag :color="layerStateColor">{{ layerStateLabel }}</a-tag>
        </div>
        <a-checkbox v-model="visibility.fractals">{{ $t('trendChart.fractals') }}</a-checkbox>
        <a-checkbox v-model="visibility.strokes">{{ $t('trendChart.strokes') }}</a-checkbox>
        <a-checkbox v-model="visibility.unfinished">{{ $t('trendChart.unfinished') }}</a-checkbox>
        <a-checkbox v-model="visibility.signals">{{ $t('trendChart.signals') }}</a-checkbox>

        <a-alert
          v-if="layerError"
          class="layer-error"
          type="warning"
          show-icon
          :message="$t('trendChart.layerUnavailable')"
          :description="layerError"
        />

        <div class="structure-stats">
          <div><span>{{ $t('trendChart.fractals') }}</span><strong>{{ fractalCount }}</strong></div>
          <div><span>{{ $t('trendChart.strokes') }}</span><strong>{{ strokeCount }}</strong></div>
          <div><span>{{ $t('trendChart.signals') }}</span><strong>{{ signalCount }}</strong></div>
          <div><span>{{ $t('trendChart.dataset') }}</span><strong>{{ datasetVersion }}</strong></div>
        </div>

        <div class="signal-list">
          <button v-for="signal in visibleSignals" :key="signal.id" type="button">
            <span>{{ signal.signal_type_label || signal.signal_type }}</span>
            <small>{{ signal.explanation || signal.factor_name_zh || '-' }}</small>
          </button>
          <a-empty v-if="!visibleSignals.length" :description="$t('trendChart.noSignals')" />
        </div>
      </aside>
    </main>

    <main v-else class="multi-workspace">
      <div class="multi-head">
        <div>
          <strong>{{ activeSymbolLabel }}</strong>
          <span>{{ $t('trendChart.multiSummary') }}</span>
        </div>
        <a-checkbox-group v-model="selectedTimeframes" :options="multiOptions" @change="loadMultiPeriod" />
      </div>
      <a-alert v-if="multiError" type="warning" show-icon :message="$t('trendChart.multiFailed')" :description="multiError" />
      <a-spin :spinning="multiLoading">
        <div v-if="multiResult" class="resonance-band">
          <div><span>{{ $t('trendChart.direction') }}</span><strong>{{ directionLabel(multiResult.summary.direction) }}</strong></div>
          <div><span>{{ $t('trendChart.resonance') }}</span><strong>{{ multiResult.summary.resonance_level }}</strong></div>
          <div><span>{{ $t('trendChart.bullishPeriods') }}</span><strong>{{ multiResult.summary.bullish_periods }}</strong></div>
          <div><span>{{ $t('trendChart.bearishPeriods') }}</span><strong>{{ multiResult.summary.bearish_periods }}</strong></div>
        </div>
        <div class="period-grid">
          <article v-for="row in multiRows" :key="row.timeframe">
            <header><strong>{{ row.timeframe }}</strong><a-tag :color="directionColor(row.direction)">{{ directionLabel(row.direction) }}</a-tag></header>
            <dl>
              <div><dt>{{ $t('trendChart.score') }}</dt><dd>{{ Number(row.score || 0).toFixed(1) }}</dd></div>
              <div><dt>MACD</dt><dd>{{ row.features && row.features.macd_cross || '-' }}</dd></div>
              <div><dt>MA</dt><dd>{{ row.features && row.features.ma_state || '-' }}</dd></div>
            </dl>
            <p>{{ (row.signals || []).slice(0, 3).map(item => item.signal_type_label || item.signal_type).join(' · ') || $t('trendChart.noSignals') }}</p>
          </article>
        </div>
      </a-spin>
    </main>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import StructureChart from '@/components/charts/StructureChart.vue'
import { createChartLayerRun, createMultiPeriodRun, getMarketBars, getTask, searchMarketSymbols } from '@/api/domain'
import { normalizeCzscSymbol } from '@/utils/czscSymbols'
import { normalizeEpochMilliseconds } from '@/utils/timestamps'

export default {
  name: 'TrendChart',
  components: { CzscChart: StructureChart },
  data () {
    return {
      symbol: '000333',
      symbolOptions: [{ symbol: '000333', name: '美的集团' }],
      symbolSearching: false,
      symbolSearchTimer: null,
      timeframe: '30m',
      timeframes: ['1m', '5m', '30m', '1d'],
      adjustment: 'qfq',
      mode: 'single',
      visibility: { fractals: true, strokes: true, unfinished: true, signals: true },
      bars: [],
      layerResult: null,
      layerTask: null,
      barsLoading: false,
      layerLoading: false,
      barsError: '',
      layerError: '',
      selectedTimeframes: ['1d', '30m', '5m'],
      multiOptions: [
        { label: '1D', value: '1d' },
        { label: '30m', value: '30m' },
        { label: '5m', value: '5m' },
        { label: '1m', value: '1m' }
      ],
      multiLoading: false,
      multiError: '',
      multiResult: null,
      loadGeneration: 0
    }
  },
  computed: {
    ...mapState({ theme: state => state.app.theme }),
    isDarkTheme () {
      return ['dark', 'realdark'].includes(this.theme)
    },
    loading () {
      return this.barsLoading || this.layerLoading || this.multiLoading
    },
    layerStateLabel () {
      if (this.layerLoading) return this.$t('trendChart.computing')
      if (this.layerError) return this.$t('trendChart.degraded')
      if (this.layerResult) return this.$t('trendChart.ready')
      return this.$t('trendChart.waiting')
    },
    layerStateColor () {
      if (this.layerLoading) return 'blue'
      if (this.layerError) return 'orange'
      if (this.layerResult) return 'green'
      return ''
    },
    workerAvailable () {
      return Boolean(this.layerResult && !this.layerError)
    },
    activeSymbolLabel () {
      const item = this.symbolOptions.find(row => row.symbol === this.symbol)
      return item && item.name ? `${item.symbol} ${item.name}` : this.symbol
    },
    chartAnalysis () {
      return { ...(this.layerResult || {}), bars: this.bars }
    },
    fractalCount () {
      return (this.layerResult && this.layerResult.fractals || []).length
    },
    strokeCount () {
      return (this.layerResult && this.layerResult.strokes || []).length
    },
    signalCount () {
      return (this.layerResult && this.layerResult.enhanced_signals || []).length
    },
    visibleSignals () {
      return (this.layerResult && this.layerResult.enhanced_signals || []).slice(0, 8)
    },
    datasetVersion () {
      return this.layerTask && this.layerTask.result && this.layerTask.result.dataset_snapshot && this.layerTask.result.dataset_snapshot.version || '-'
    },
    multiRows () {
      return this.multiResult && this.multiResult.signal_tree || []
    }
  },
  created () {
    this.restoreRoute()
    this.searchSymbols('')
  },
  mounted () {
    this.reload()
  },
  beforeDestroy () {
    if (this.symbolSearchTimer) clearTimeout(this.symbolSearchTimer)
    this.loadGeneration += 1
  },
  methods: {
    restoreRoute () {
      const query = this.$route.query || {}
      if (query.symbol) this.symbol = String(query.symbol).split('.')[0]
      if (this.timeframes.includes(query.timeframe)) this.timeframe = query.timeframe
      if (query.mode === 'multi-period' || query.mode === 'multi') this.mode = 'multi'
    },
    symbolLabel (item) {
      return item.name ? `${item.symbol} ${item.name}` : item.symbol
    },
    searchSymbols (keyword) {
      if (this.symbolSearchTimer) clearTimeout(this.symbolSearchTimer)
      this.symbolSearchTimer = setTimeout(async () => {
        this.symbolSearching = true
        try {
          const response = await searchMarketSymbols({ market: 'CNStock', keyword, limit: 30 })
          if (response && response.code === 1) {
            const rows = Array.isArray(response.data) ? response.data : []
            this.symbolOptions = rows.map(item => ({ ...item, symbol: String(item.symbol || '').split('.')[0] }))
          }
        } finally {
          this.symbolSearching = false
        }
      }, keyword ? 250 : 0)
    },
    reload () {
      this.syncRoute()
      if (this.mode === 'multi') return this.loadMultiPeriod()
      const generation = ++this.loadGeneration
      this.loadBars(generation)
      this.loadLayers(generation)
    },
    syncRoute () {
      const query = { symbol: this.symbol, timeframe: this.timeframe }
      if (this.mode === 'multi') query.mode = 'multi-period'
      this.$router.replace({ path: '/trend-chart', query }).catch(() => {})
    },
    normalizeBars (rows) {
      return (rows || []).map(item => ({
        timestamp: normalizeEpochMilliseconds(item.timestamp || item.time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume || 0),
        turnover: Number(item.turnover || item.amount || 0)
      })).filter(item => Number.isFinite(item.timestamp)).sort((a, b) => a.timestamp - b.timestamp)
    },
    async loadBars (generation) {
      this.barsLoading = true
      this.barsError = ''
      try {
        const response = await getMarketBars({ market: 'CNStock', symbol: this.symbol, timeframe: this.timeframe, limit: 900, adjustment: this.adjustment })
        if (generation !== this.loadGeneration) return
        if (!response || response.code !== 1) throw new Error(response && response.msg || this.$t('trendChart.barsFailed'))
        this.bars = this.normalizeBars(response.data && response.data.bars)
        if (!this.bars.length) throw new Error(this.$t('trendChart.noBars'))
      } catch (error) {
        if (generation === this.loadGeneration) this.barsError = error.backendMessage || error.message || String(error)
      } finally {
        if (generation === this.loadGeneration) this.barsLoading = false
      }
    },
    async loadLayers (generation) {
      this.layerLoading = true
      this.layerError = ''
      this.layerResult = null
      try {
        const response = await createChartLayerRun({
          symbol: normalizeCzscSymbol(this.symbol),
          timeframe: this.timeframe,
          limit: 1000,
          layers: Object.keys(this.visibility).filter(key => this.visibility[key]),
          adjustment: this.adjustment
        }, `trend-${this.symbol}-${this.timeframe}-${Date.now()}`)
        if (!response || response.code !== 1) throw new Error(response && response.msg || this.$t('trendChart.layerUnavailable'))
        const task = await this.waitForTask(response.data.task_id, generation)
        if (generation !== this.loadGeneration) return
        this.layerTask = task
        this.layerResult = task.result && task.result.payload || null
      } catch (error) {
        if (generation === this.loadGeneration) this.layerError = error.backendMessage || error.message || String(error)
      } finally {
        if (generation === this.loadGeneration) this.layerLoading = false
      }
    },
    async loadMultiPeriod () {
      if (this.selectedTimeframes.length < 2) return
      const generation = ++this.loadGeneration
      this.multiLoading = true
      this.multiError = ''
      try {
        const response = await createMultiPeriodRun({
          symbol: normalizeCzscSymbol(this.symbol),
          timeframes: this.selectedTimeframes,
          limit: 1000
        }, `multi-${this.symbol}-${this.selectedTimeframes.join('-')}-${Date.now()}`)
        if (!response || response.code !== 1) throw new Error(response && response.msg || this.$t('trendChart.multiFailed'))
        const task = await this.waitForTask(response.data.task_id, generation)
        if (generation === this.loadGeneration) this.multiResult = task.result && task.result.payload
      } catch (error) {
        if (generation === this.loadGeneration) this.multiError = error.backendMessage || error.message || String(error)
      } finally {
        if (generation === this.loadGeneration) this.multiLoading = false
      }
    },
    async waitForTask (taskId, generation) {
      const deadline = Date.now() + 180000
      while (Date.now() < deadline && generation === this.loadGeneration) {
        const response = await getTask(taskId)
        if (!response || response.code !== 1) throw new Error(response && response.msg || this.$t('trendChart.taskFailed'))
        const task = response.data
        if (task.status === 'SUCCEEDED') return task
        if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(task.status)) throw new Error(task.error_message || task.status)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      throw new Error(this.$t('trendChart.taskTimeout'))
    },
    directionLabel (value) {
      if (['bullish', 'up'].includes(value)) return this.$t('trendChart.bullish')
      if (['bearish', 'down'].includes(value)) return this.$t('trendChart.bearish')
      return this.$t('trendChart.neutral')
    },
    directionColor (value) {
      if (['bullish', 'up'].includes(value)) return this.$marketColor('bullish')
      if (['bearish', 'down'].includes(value)) return this.$marketColor('bearish')
      return 'blue'
    }
  }
}
</script>

<style scoped>
.trend-page { height: calc(100vh - 64px); min-height: 650px; padding: 12px; overflow: hidden; color: #1f2937; background: #f5f7fa; }
.trend-toolbar { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 7px 10px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }
.symbol-control, .toolbar-actions { display: flex; align-items: center; gap: 8px; }
.symbol-select { width: 220px; }
.symbol-select span { margin-left: 8px; color: #8c8c8c; font-size: 12px; }
.adjust-select { width: 92px; }
.trend-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 280px; height: calc(100% - 58px); margin-top: 10px; border: 1px solid #e5e7eb; background: #fff; }
.chart-stage { position: relative; min-width: 0; border-right: 1px solid #e5e7eb; }
.chart-status { display: flex; align-items: center; justify-content: space-between; height: 38px; padding: 0 12px; border-bottom: 1px solid #edf0f2; font-size: 12px; }
.chart-status strong { margin-right: 10px; }
.engine-origin { color: #6b7280; }
.engine-origin i { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #9ca3af; }
.engine-origin i.online { background: #2f9e69; }
.engine-origin i.offline { background: #d89614; }
.trend-chart { height: calc(100% - 38px); }
.stage-overlay { position: absolute; inset: 38px 0 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(255,255,255,.72); }
.stage-message { position: absolute; z-index: 3; top: 52px; left: 16px; right: 16px; }
.layer-panel { padding: 14px; overflow-y: auto; }
.panel-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.layer-panel > label { display: block; margin: 0 0 12px; }
.layer-error { margin: 12px 0; }
.structure-stats { display: grid; grid-template-columns: 1fr 1fr; margin: 18px -14px 0; border-top: 1px solid #edf0f2; border-bottom: 1px solid #edf0f2; }
.structure-stats div { min-width: 0; padding: 10px 14px; }
.structure-stats span, .structure-stats strong { display: block; }
.structure-stats span { color: #8c8c8c; font-size: 11px; }
.structure-stats strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.signal-list { margin-top: 12px; }
.signal-list button { width: 100%; padding: 9px 0; border: 0; border-bottom: 1px solid #edf0f2; text-align: left; background: transparent; }
.signal-list span, .signal-list small { display: block; }
.signal-list small { margin-top: 3px; overflow: hidden; color: #8c8c8c; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.multi-workspace { height: calc(100% - 58px); margin-top: 10px; padding: 16px; overflow-y: auto; border: 1px solid #e5e7eb; background: #fff; }
.multi-head { display: flex; justify-content: space-between; margin-bottom: 14px; }
.multi-head strong, .multi-head span { display: block; }
.multi-head span { color: #8c8c8c; font-size: 12px; }
.resonance-band { display: grid; grid-template-columns: repeat(4, 1fr); margin: 14px 0; border: 1px solid #e5e7eb; }
.resonance-band div { padding: 12px; border-right: 1px solid #e5e7eb; }
.resonance-band div:last-child { border-right: 0; }
.resonance-band span, .resonance-band strong { display: block; }
.resonance-band span { color: #8c8c8c; font-size: 11px; }
.period-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.period-grid article { padding: 14px; border: 1px solid #e5e7eb; border-radius: 4px; }
.period-grid header { display: flex; justify-content: space-between; }
.period-grid dl { display: grid; grid-template-columns: repeat(3, 1fr); margin: 14px 0; }
.period-grid dt { color: #8c8c8c; font-size: 11px; }
.period-grid dd { margin: 2px 0 0; font-weight: 600; }
.period-grid p { margin: 0; color: #6b7280; font-size: 12px; }
.trend-page--dark { color: #e5e7eb; background: #111827; }
.trend-page--dark .trend-toolbar, .trend-page--dark .trend-workspace, .trend-page--dark .multi-workspace, .trend-page--dark .period-grid article { border-color: #30363d; background: #171b22; }
.trend-page--dark .chart-stage, .trend-page--dark .chart-status, .trend-page--dark .structure-stats, .trend-page--dark .signal-list button { border-color: #30363d; }
.trend-page--dark .stage-overlay { background: rgba(23,27,34,.72); }
@media (max-width: 900px) {
  .trend-page { height: auto; min-height: calc(100vh - 64px); overflow: visible; }
  .trend-toolbar, .symbol-control { align-items: stretch; flex-direction: column; }
  .symbol-select { width: 100%; }
  .trend-workspace { grid-template-columns: 1fr; height: 900px; }
  .chart-stage { height: 600px; border-right: 0; border-bottom: 1px solid #e5e7eb; }
  .period-grid { grid-template-columns: 1fr; }
}
</style>
