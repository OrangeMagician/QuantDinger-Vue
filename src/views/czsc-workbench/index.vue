<template>
  <div class="czsc-workbench" :class="{ 'theme-dark': isDarkTheme }">
    <header class="workbench-toolbar">
      <div class="toolbar-title">
        <a-icon type="line-chart" />
        <h1>{{ $t('czsc.title') }}</h1>
        <span class="read-only-badge">{{ $t('czsc.researchMode') }}</span>
        <span class="service-status" :class="workerOnline ? 'online' : 'offline'">
          <i />{{ workerOnline ? $t('czsc.serviceOnline') : $t('czsc.serviceOffline') }}
        </span>
      </div>

      <div class="toolbar-controls">
        <label class="control-field symbol-field">
          <span>{{ $t('czsc.symbol') }}</span>
          <a-select
            v-model="symbolInput"
            mode="combobox"
            show-search
            allow-clear
            option-label-prop="value"
            dropdown-class-name="czsc-symbol-dropdown"
            :placeholder="$t('czsc.symbolPlaceholder')"
            :filter-option="false"
            :not-found-content="symbolSearching ? undefined : $t('czsc.noSymbolFound')"
            @focus="loadSymbolOptions"
            @search="handleSymbolSearch"
            @change="handleSymbolChange"
          >
            <a-spin v-if="symbolSearching" slot="notFoundContent" size="small" />
            <a-select-option
              v-for="item in symbolOptions"
              :key="item.symbol"
              :value="item.symbol"
            >
              <div class="symbol-option">
                <strong>{{ item.symbol }}</strong>
                <span>{{ item.name || item.exchange }}</span>
              </div>
            </a-select-option>
          </a-select>
        </label>
        <label class="control-field timeframe-field">
          <span>{{ $t('czsc.timeframe') }}</span>
          <a-radio-group v-model="timeframe" button-style="solid" size="small" @change="contextChanged">
            <a-radio-button v-for="item in timeframes" :key="item.value" :value="item.value">
              {{ item.label }}
            </a-radio-button>
          </a-radio-group>
        </label>
        <label class="control-field limit-field">
          <span>{{ $t('czsc.barLimit') }}</span>
          <a-select v-model="limit" size="small" @change="contextChanged">
            <a-select-option v-for="value in limits" :key="value" :value="value">{{ value }}</a-select-option>
          </a-select>
        </label>
        <a-button v-if="activeTab === 'structure'" type="primary" icon="line-chart" :loading="loading" @click="runAnalysis">
          {{ $t('czsc.analyze') }}
        </a-button>
        <a-tooltip v-if="activeTab === 'structure'" :title="$t('czsc.refresh')">
          <a-button class="icon-button" icon="reload" :loading="loading" :aria-label="$t('czsc.refresh')" @click="runAnalysis" />
        </a-tooltip>
      </div>
    </header>

    <a-tabs v-model="activeTab" class="workbench-tabs" :animated="false">
      <a-tab-pane key="structure">
        <span slot="tab"><a-icon type="line-chart" />{{ $t('czsc.tabStructure') }}</span>
        <div class="structure-controls">
          <a-checkbox v-model="visibility.fractals">{{ $t('czsc.fractals') }}</a-checkbox>
          <a-checkbox v-model="visibility.strokes">{{ $t('czsc.strokes') }}</a-checkbox>
          <a-checkbox v-model="visibility.unfinished">{{ $t('czsc.unfinished') }}</a-checkbox>
          <a-checkbox v-model="visibility.signals">{{ $t('czsc.enhancedSignals') }}</a-checkbox>
          <span v-if="analysis" class="active-symbol">{{ analysis.symbol }} · {{ analysis.frequency }}</span>
        </div>

        <a-alert
          v-if="error"
          class="analysis-error"
          type="error"
          show-icon
          :message="$t('czsc.loadFailed')"
          :description="error"
        />

        <main class="workbench-grid">
          <section class="chart-region" :aria-busy="loading ? 'true' : 'false'">
            <czsc-chart :analysis="analysis" :visibility="visibility" :dark="isDarkTheme" />
            <div v-if="loading" class="loading-layer"><a-spin size="large" /></div>
            <div v-else-if="!analysis" class="empty-layer"><a-empty :description="$t('czsc.empty')" /></div>
          </section>

          <aside class="summary-region">
            <h2>{{ $t('czsc.structureSummary') }}</h2>
            <dl class="summary-grid">
              <div><dt>{{ $t('czsc.fractalCount') }}</dt><dd>{{ summary.fractal_count }}</dd></div>
              <div><dt>{{ $t('czsc.strokeCount') }}</dt><dd>{{ summary.stroke_count }}</dd></div>
              <div><dt>{{ $t('czsc.unfinishedCount') }}</dt><dd>{{ summary.unfinished_fractal_count }}</dd></div>
              <div><dt>{{ $t('czsc.lastStroke') }}</dt><dd :class="summary.last_stroke_direction">{{ directionLabel(summary.last_stroke_direction) }}</dd></div>
            </dl>

            <dl class="metadata-list">
              <div><dt>{{ $t('czsc.lastClose') }}</dt><dd>{{ formatPrice(summary.last_close) }}</dd></div>
              <div><dt>{{ $t('czsc.dataRange') }}</dt><dd>{{ formattedRange }}</dd></div>
              <div><dt>{{ $t('czsc.source') }}</dt><dd>{{ analysis && analysis.source ? analysis.source.data_source : $t('czsc.none') }}</dd></div>
              <div><dt>{{ $t('czsc.engine') }}</dt><dd>{{ engineLabel }}</dd></div>
            </dl>

            <div class="recent-strokes">
              <h2>{{ $t('czsc.recentStrokes') }}</h2>
              <div v-if="recentStrokes.length" class="stroke-list">
                <div v-for="(stroke, index) in recentStrokes" :key="stroke.end_timestamp + '-' + index" class="stroke-row">
                  <span class="direction-mark" :class="stroke.direction">
                    <a-icon
                      :type="stroke.direction === 'up' ? 'arrow-up' : 'arrow-down'"
                    />
                    {{ directionLabel(stroke.direction) }}
                  </span>
                  <span>{{ formatDate(stroke.start_datetime) }}</span>
                  <span>{{ formatPrice(stroke.start_price) }} → {{ formatPrice(stroke.end_price) }}</span>
                </div>
              </div>
              <a-empty
                v-else
                :image="simpleEmptyImage"
                :description="$t('czsc.none')"
              />
            </div>

            <div class="enhanced-signal-list">
              <h2>{{ $t('czsc.enhancedSignals') }}</h2>
              <div v-if="enhancedSignals.length" class="enhanced-signal-cards">
                <article v-for="signal in enhancedSignals" :key="signal.id" class="enhanced-signal-card">
                  <div>
                    <a-tag :color="signal.direction === 'bullish' ? '#cf1322' : signal.direction === 'bearish' ? '#389e0d' : ''">
                      {{ signal.direction_label }}
                    </a-tag>
                    <strong>{{ signal.signal_type_label || signal.signal_type }}</strong>
                  </div>
                  <p>{{ signal.explanation }}</p>
                  <small>{{ signal.risk_tip }}</small>
                </article>
              </div>
              <a-empty v-else :image="simpleEmptyImage" :description="$t('czsc.none')" />
            </div>
          </aside>
        </main>
      </a-tab-pane>

      <a-tab-pane key="cockpit">
        <span slot="tab"><a-icon type="dashboard" />{{ $t('czsc.tabCockpit') }}</span>
        <dashboard-panel
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :limit="limit"
          @prepare-review="prepareReview"
          @view-chart="viewChart"
          @backtest-row="backtestRow"
        />
      </a-tab-pane>

      <a-tab-pane key="multi-period">
        <span slot="tab"><a-icon type="branches" />{{ $t('czsc.tabMultiPeriod') }}</span>
        <multi-period-panel
          :symbol="normalizedSymbol"
          :limit="limit"
          @prepare-review="prepareReview"
        />
      </a-tab-pane>

      <a-tab-pane key="factor-lab">
        <span slot="tab"><a-icon type="function" />{{ $t('czsc.tabFactorLab') }}</span>
        <factor-lab-panel
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :limit="limit"
        />
      </a-tab-pane>

      <a-tab-pane key="quality">
        <span slot="tab"><a-icon type="area-chart" />{{ $t('czsc.tabQuality') }}</span>
        <quality-panel
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :limit="limit"
        />
      </a-tab-pane>

      <a-tab-pane key="watchlist">
        <span slot="tab"><a-icon type="star" />{{ $t('czsc.tabWatchlist') }}</span>
        <smart-watchlist-panel
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :limit="limit"
          @prepare-review="prepareReview"
          @view-chart="viewChart"
          @backtest-row="backtestRow"
        />
      </a-tab-pane>

      <a-tab-pane key="research-ops">
        <span slot="tab"><a-icon type="control" />{{ $t('czsc.tabResearchOps') }}</span>
        <research-ops-panel
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :limit="limit"
        />
      </a-tab-pane>

      <a-tab-pane key="strategy">
        <span slot="tab"><a-icon type="experiment" />{{ $t('czsc.tabStrategy') }}</span>
        <strategy-panel
          ref="strategyPanel"
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :limit="limit"
          :templates="templates"
          :system-templates="systemTemplates"
          :template-id.sync="selectedTemplateId"
          @prepare-review="prepareReview"
        />
      </a-tab-pane>

      <a-tab-pane key="scan">
        <span slot="tab"><a-icon type="scan" />{{ $t('czsc.tabScan') }}</span>
        <scan-panel
          :timeframe="timeframe"
          :limit="limit"
          :templates="templates"
          :template-id.sync="selectedTemplateId"
          @prepare-review="prepareReview"
          @view-chart="viewChart"
          @backtest-row="backtestRow"
        />
      </a-tab-pane>

      <a-tab-pane key="backtest">
        <span slot="tab"><a-icon type="fund" />{{ $t('czsc.tabBacktest') }}</span>
        <backtest-panel
          :symbol="normalizedSymbol"
          :timeframe="timeframe"
          :templates="templates"
          :template-id.sync="selectedTemplateId"
          :dark="isDarkTheme"
        />
      </a-tab-pane>

      <a-tab-pane key="review">
        <span slot="tab"><a-icon type="audit" />{{ $t('czsc.tabReview') }}</span>
        <review-panel
          :candidate="reviewCandidate"
          :templates="templates"
          @import-context="importTradingViewContext"
        />
      </a-tab-pane>
    </a-tabs>

    <a-alert
      v-if="templateError"
      class="template-error"
      type="error"
      show-icon
      :message="$t('czsc.templateLoadFailed')"
      :description="templateError"
    />
  </div>
</template>

<script>
import { Empty } from 'ant-design-vue'
import { mapState } from 'vuex'
import { analyzeCzsc, getCzscHealth, getCzscTemplates, searchCzscSymbols } from '@/api/czsc'
import { getScriptTemplateList } from '@/api/strategy'
import BacktestPanel from './components/BacktestPanel.vue'
import CzscChart from './components/CzscChart.vue'
import DashboardPanel from './components/DashboardPanel.vue'
import FactorLabPanel from './components/FactorLabPanel.vue'
import MultiPeriodPanel from './components/MultiPeriodPanel.vue'
import QualityPanel from './components/QualityPanel.vue'
import ResearchOpsPanel from './components/ResearchOpsPanel.vue'
import ReviewPanel from './components/ReviewPanel.vue'
import ScanPanel from './components/ScanPanel.vue'
import SmartWatchlistPanel from './components/SmartWatchlistPanel.vue'
import StrategyPanel from './components/StrategyPanel.vue'

const STORAGE_KEY = 'quantdinger.czsc.workbench.v2'

export default {
  name: 'CzscWorkbench',
  components: { BacktestPanel, CzscChart, DashboardPanel, FactorLabPanel, MultiPeriodPanel, QualityPanel, ResearchOpsPanel, ReviewPanel, ScanPanel, SmartWatchlistPanel, StrategyPanel },
  data () {
    return {
      activeTab: 'structure',
      symbolInput: '000333.SZ',
      timeframe: '30m',
      limit: 1000,
      limits: [500, 1000, 2000, 5000],
      timeframes: [
        { value: '1m', label: '1m' },
        { value: '5m', label: '5m' },
        { value: '30m', label: '30m' },
        { value: '1d', label: '1D' }
      ],
      visibility: { fractals: true, strokes: true, unfinished: true, signals: true },
      workerOnline: false,
      loading: false,
      analysis: null,
      error: '',
      templates: [],
      systemTemplates: [],
      selectedTemplateId: 'classic_bs_v1',
      templateError: '',
      symbolOptions: [],
      symbolSearching: false,
      symbolSearchTimer: null,
      reviewCandidate: null,
      simpleEmptyImage: Empty.PRESENTED_IMAGE_SIMPLE
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () {
      return this.navTheme === 'dark' || this.navTheme === 'realdark'
    },
    normalizedSymbol () {
      return this.normalizeCzscSymbol(this.symbolInput)
    },
    summary () {
      return (this.analysis && this.analysis.summary) || {
        fractal_count: 0,
        stroke_count: 0,
        unfinished_fractal_count: 0,
        last_stroke_direction: null,
        last_close: null
      }
    },
    recentStrokes () {
      return this.analysis && Array.isArray(this.analysis.strokes) ? this.analysis.strokes.slice(-6).reverse() : []
    },
    enhancedSignals () {
      return this.analysis && Array.isArray(this.analysis.enhanced_signals) ? this.analysis.enhanced_signals.slice(0, 6) : []
    },
    formattedRange () {
      if (!this.analysis || !this.analysis.range) return this.$t('czsc.none')
      return `${this.formatDate(this.analysis.range.start)} - ${this.formatDate(this.analysis.range.end)}`
    },
    engineLabel () {
      if (!this.analysis || !this.analysis.engine) return this.$t('czsc.none')
      return `${this.analysis.engine.name} ${this.analysis.engine.version}`
    }
  },
  created () {
    this.restoreWorkbenchState()
    this.checkHealth()
    this.loadSymbolOptions()
    this.loadTemplates()
    this.loadSystemTemplates()
    this.runAnalysis()
  },
  watch: {
    activeTab () {
      this.persistWorkbenchState()
    },
    timeframe () {
      this.persistWorkbenchState()
    },
    limit () {
      this.persistWorkbenchState()
    },
    selectedTemplateId () {
      this.persistWorkbenchState()
    },
    visibility: {
      deep: true,
      handler () {
        this.persistWorkbenchState()
      }
    }
  },
  beforeDestroy () {
    if (this.symbolSearchTimer) clearTimeout(this.symbolSearchTimer)
  },
  methods: {
    restoreWorkbenchState () {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const state = raw ? JSON.parse(raw) : null
        if (!state || typeof state !== 'object') return
        if (state.activeTab) this.activeTab = state.activeTab
        if (state.symbolInput) this.symbolInput = state.symbolInput
        if (state.timeframe) this.timeframe = state.timeframe
        if (state.limit) this.limit = Number(state.limit)
        if (state.selectedTemplateId) this.selectedTemplateId = state.selectedTemplateId
        if (state.visibility && typeof state.visibility === 'object') this.visibility = { ...this.visibility, ...state.visibility }
      } catch (error) {}
    },
    persistWorkbenchState () {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          activeTab: this.activeTab,
          symbolInput: this.symbolInput,
          timeframe: this.timeframe,
          limit: this.limit,
          selectedTemplateId: this.selectedTemplateId,
          visibility: this.visibility
        }))
      } catch (error) {}
    },
    async checkHealth () {
      try {
        const response = await getCzscHealth()
        this.workerOnline = Boolean(response && response.code === 1 && response.data && response.data.status === 'ok')
      } catch (error) {
        this.workerOnline = false
      }
    },
    async loadTemplates () {
      try {
        const response = await getCzscTemplates()
        if (!response || response.code !== 1 || !response.data || !Array.isArray(response.data.templates)) {
          throw new Error((response && response.msg) || this.$t('czsc.templateLoadFailed'))
        }
        this.templates = response.data.templates
        if (!this.templates.some(item => item.id === this.selectedTemplateId) && this.templates.length) {
          this.selectedTemplateId = this.templates[0].id
        }
      } catch (error) {
        this.templateError = error.backendMessage || error.message || this.$t('czsc.templateLoadFailed')
      }
    },
    async loadSystemTemplates () {
      try {
        const response = await getScriptTemplateList()
        const data = response && response.data ? response.data : {}
        this.systemTemplates = Array.isArray(data.items) ? data.items : []
      } catch (error) {
        this.systemTemplates = []
      }
    },
    async loadSymbolOptions () {
      if (this.symbolSearching) return
      await this.searchSymbols('')
    },
    handleSymbolSearch (keyword) {
      if (this.symbolSearchTimer) clearTimeout(this.symbolSearchTimer)
      this.symbolSearchTimer = setTimeout(() => {
        this.symbolSearchTimer = null
        this.searchSymbols(keyword)
      }, 240)
    },
    handleSymbolChange (value) {
      const normalized = this.normalizeCzscSymbol(value)
      this.symbolInput = normalized || String(value || '').trim().toUpperCase()
      this.persistWorkbenchState()
    },
    async searchSymbols (keyword) {
      const kw = String(keyword || '').trim()
      this.symbolSearching = true
      try {
        const response = await searchCzscSymbols({ keyword: kw, limit: kw ? 20 : 12 })
        const data = response && response.data ? response.data : {}
        const items = Array.isArray(data.items) ? data.items : []
        const current = this.normalizedSymbol
        const map = new Map()
        items.forEach(item => {
          if (item && item.symbol) map.set(item.symbol, item)
        })
        if (current && !map.has(current)) {
          map.set(current, { symbol: current, name: '', exchange: current.slice(-2) })
        }
        this.symbolOptions = Array.from(map.values())
      } catch (error) {
        const fallback = this.normalizeCzscSymbol(kw)
        this.symbolOptions = fallback ? [{ symbol: fallback, name: '', exchange: fallback.slice(-2) }] : []
      } finally {
        this.symbolSearching = false
      }
    },
    normalizeCzscSymbol (value) {
      const raw = String(value || '').trim().toUpperCase()
      if (!raw) return ''
      if (/^[0-9]{6}\.(SH|SZ|BJ)$/.test(raw)) return raw
      const code = raw.replace(/[^0-9]/g, '')
      if (!/^[0-9]{6}$/.test(code)) return raw
      if (/^(600|601|603|605|688|689|900)/.test(code) || code.startsWith('6')) return `${code}.SH`
      if (/^(000|001|002|003|159|200|300|301)/.test(code) || /^[023]/.test(code)) return `${code}.SZ`
      return `${code}.BJ`
    },
    contextChanged () {
      this.persistWorkbenchState()
      if (this.activeTab === 'structure') this.runAnalysis()
    },
    async runAnalysis () {
      if (this.loading) return
      this.symbolInput = this.normalizedSymbol
      if (!/^[0-9]{6}\.(SH|SZ|BJ)$/.test(this.symbolInput)) {
        this.error = this.$t('czsc.symbolInvalid')
        return
      }
      this.loading = true
      this.error = ''
      try {
        const response = await analyzeCzsc({ symbol: this.normalizedSymbol, timeframe: this.timeframe, limit: this.limit })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.loadFailed'))
        }
        this.analysis = response.data
        this.workerOnline = true
        this.persistWorkbenchState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.loadFailed')
        if (error.response && error.response.status >= 500) this.workerOnline = false
      } finally {
        this.loading = false
      }
    },
    prepareReview (candidate) {
      this.reviewCandidate = candidate
      this.activeTab = 'review'
      this.persistWorkbenchState()
    },
    viewChart (row) {
      if (!row || !row.symbol) return
      this.symbolInput = row.symbol
      this.activeTab = 'structure'
      this.$nextTick(() => this.runAnalysis())
    },
    backtestRow (row) {
      if (!row || !row.symbol) return
      this.symbolInput = row.symbol
      this.activeTab = 'backtest'
      this.persistWorkbenchState()
    },
    importTradingViewContext (context) {
      this.symbolInput = context.symbol
      this.timeframe = context.timeframe
      this.selectedTemplateId = context.template_id
      this.activeTab = 'strategy'
      this.persistWorkbenchState()
      this.$nextTick(() => {
        if (this.$refs.strategyPanel) this.$refs.strategyPanel.runEvaluation()
      })
    },
    directionLabel (direction) {
      if (direction === 'up') return this.$t('czsc.up')
      if (direction === 'down') return this.$t('czsc.down')
      return this.$t('czsc.none')
    },
    formatPrice (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(2) : this.$t('czsc.none')
    },
    formatDate (value) {
      if (!value) return this.$t('czsc.none')
      return String(value).replace('T', ' ').slice(0, this.timeframe === '1d' ? 10 : 16)
    }
  }
}
</script>

<style scoped>
.czsc-workbench { min-height: calc(100vh - 64px); color: #262626; background: #f5f6f8; }
.workbench-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 14px 20px; border-bottom: 1px solid #d9dce1; background: #fff; }
.toolbar-title, .toolbar-controls, .structure-controls { display: flex; align-items: center; }
.toolbar-title { flex-wrap: wrap; gap: 9px; min-width: 240px; }
.toolbar-title > .anticon { color: #08979c; font-size: 20px; }
.toolbar-title h1 { margin: 0; font-size: 18px; line-height: 26px; font-weight: 650; letter-spacing: 0; }
.read-only-badge { padding: 1px 7px; border: 1px solid #b7eb8f; border-radius: 3px; color: #237804; font-size: 11px; background: #f6ffed; }
.service-status { display: inline-flex; align-items: center; gap: 5px; color: #8c8c8c; font-size: 12px; }
.service-status i { width: 7px; height: 7px; border-radius: 50%; background: #bfbfbf; }
.service-status.online i { background: #08979c; }
.service-status.offline i { background: #fa541c; }
.toolbar-controls { flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.control-field { display: flex; flex-direction: column; gap: 4px; color: #595959; font-size: 11px; }
.symbol-field { width: 220px; }
.symbol-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
.symbol-option strong { color: #262626; font-variant-numeric: tabular-nums; }
.symbol-option span { overflow: hidden; color: #8c8c8c; text-overflow: ellipsis; white-space: nowrap; }
.timeframe-field { min-width: 210px; }
.limit-field { width: 92px; }
.icon-button { width: 32px; padding: 0; }
.workbench-tabs { background: #fff; }
.workbench-tabs >>> .ant-tabs-bar { margin: 0; padding: 0 20px; background: #fff; }
.workbench-tabs >>> .ant-tabs-tab { padding-top: 12px; padding-bottom: 12px; }
.structure-controls { min-height: 42px; gap: 22px; padding: 7px 20px; border-bottom: 1px solid #e4e6e9; background: #fafafa; }
.active-symbol { margin-left: auto; color: #595959; font-variant-numeric: tabular-nums; font-size: 12px; }
.analysis-error, .template-error { margin: 12px 20px 0; }
.template-error { position: fixed; right: 16px; bottom: 16px; z-index: 20; width: min(520px, calc(100vw - 32px)); }
.workbench-grid { display: grid; grid-template-columns: minmax(0, 1fr) 318px; min-height: 650px; background: #fff; }
.chart-region { position: relative; min-width: 0; min-height: 650px; padding: 10px 8px 4px 12px; border-right: 1px solid #e5e7eb; }
.loading-layer, .empty-layer { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.72); }
.summary-region { min-width: 0; padding: 18px 18px 28px; overflow: hidden; background: #fbfbfc; }
.summary-region h2 { margin: 0 0 12px; color: #262626; font-size: 14px; line-height: 22px; font-weight: 650; letter-spacing: 0; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 0 0 18px; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.summary-grid > div { min-width: 0; padding: 10px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.summary-grid dt, .metadata-list dt { color: #8c8c8c; font-size: 11px; }
.summary-grid dd { margin: 4px 0 0; color: #262626; font-size: 20px; line-height: 24px; font-variant-numeric: tabular-nums; }
.summary-grid dd.up, .direction-mark.up { color: var(--market-rise-color); }
.summary-grid dd.down, .direction-mark.down { color: var(--market-fall-color); }
.metadata-list { margin: 0 0 22px; }
.metadata-list > div { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; padding: 7px 0; border-bottom: 1px solid #ebedf0; }
.metadata-list dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: #434343; text-align: right; font-size: 12px; }
.recent-strokes { padding-top: 16px; border-top: 1px solid #d9dce1; }
.stroke-list { display: flex; flex-direction: column; }
.stroke-row { display: grid; grid-template-columns: 72px 84px minmax(0, 1fr); gap: 6px; align-items: center; min-height: 34px; border-bottom: 1px solid #ebedf0; color: #595959; font-size: 11px; font-variant-numeric: tabular-nums; }
.stroke-row span:last-child { text-align: right; white-space: nowrap; }
.direction-mark { font-weight: 600; }
.enhanced-signal-list { margin-top: 18px; padding-top: 16px; border-top: 1px solid #d9dce1; }
.enhanced-signal-cards { display: flex; flex-direction: column; gap: 8px; }
.enhanced-signal-card { padding: 9px 10px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; }
.enhanced-signal-card > div { display: flex; align-items: center; gap: 6px; }
.enhanced-signal-card strong { overflow: hidden; color: #262626; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.enhanced-signal-card p { margin: 6px 0 4px; color: #595959; font-size: 11px; line-height: 1.45; }
.enhanced-signal-card small { display: block; color: #8c8c8c; font-size: 10px; line-height: 1.4; }
.theme-dark { color: #e5e7eb; background: #111318; }
.theme-dark .workbench-toolbar, .theme-dark .workbench-grid, .theme-dark .workbench-tabs { border-color: #30343b; background: #171a20; }
.theme-dark .workbench-tabs >>> .ant-tabs-bar, .theme-dark .structure-controls, .theme-dark .summary-region { border-color: #30343b; background: #1c2027; }
.theme-dark .toolbar-title h1, .theme-dark .summary-region h2, .theme-dark .summary-grid dd { color: #f3f4f6; }
.theme-dark .control-field, .theme-dark .active-symbol, .theme-dark .metadata-list dd, .theme-dark .stroke-row { color: #c5cad3; }
.theme-dark .summary-grid, .theme-dark .summary-grid > div, .theme-dark .metadata-list > div, .theme-dark .recent-strokes, .theme-dark .stroke-row, .theme-dark .enhanced-signal-list, .theme-dark .enhanced-signal-card { border-color: #30343b; }
.theme-dark .enhanced-signal-card { background: #1c2027; }
.theme-dark .enhanced-signal-card strong { color: #f3f4f6; }
.theme-dark .enhanced-signal-card p { color: #c5cad3; }
.theme-dark .loading-layer, .theme-dark .empty-layer { background: rgba(23, 26, 32, 0.76); }
@media (max-width: 1100px) {
  .workbench-toolbar { align-items: flex-start; flex-direction: column; }
  .toolbar-controls { justify-content: flex-start; width: 100%; }
}
@media (max-width: 760px) {
  .workbench-toolbar { padding: 12px; }
  .toolbar-controls { align-items: flex-end; }
  .symbol-field { width: 100%; }
  .timeframe-field { order: 5; width: 100%; }
  .workbench-tabs >>> .ant-tabs-bar { padding: 0 8px; overflow-x: auto; }
  .workbench-tabs >>> .ant-tabs-nav { white-space: nowrap; }
  .structure-controls { flex-wrap: wrap; gap: 10px 16px; padding: 8px 12px; }
  .active-symbol { width: 100%; margin-left: 0; }
  .workbench-grid { grid-template-columns: 1fr; }
  .chart-region { min-height: 520px; border-right: 0; border-bottom: 1px solid #e5e7eb; }
  .summary-region { padding: 16px 12px 24px; }
}
</style>
