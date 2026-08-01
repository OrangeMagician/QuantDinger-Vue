<template>
  <section class="scan-panel">
    <div class="scan-layout">
      <aside class="scan-sidebar">
        <div class="pool-head">
          <div>
            <strong>{{ $t('czsc.stockPool') }}</strong>
            <small>{{ $t('czsc.stockPoolDesc') }}</small>
          </div>
          <a-tag>{{ poolTotalLabel }}</a-tag>
        </div>

        <div class="pool-switches">
          <a-checkbox v-model="stockPool.exclude_st" @change="persistState">{{ $t('czsc.excludeSt') }}</a-checkbox>
          <div class="recent-filter-row">
            <a-checkbox :checked="stockPool.exclude_recent_days > 0" @change="toggleExcludeRecent">{{ $t('czsc.excludeRecentList') }}</a-checkbox>
            <a-input-number
              v-model="stockPool.exclude_recent_days"
              :min="0"
              :max="3650"
              :step="30"
              :disabled="stockPool.exclude_recent_days <= 0"
              @change="persistState"
            />
          </div>
        </div>

        <label class="field">
          <span>{{ $t('czsc.industryFilter') }}</span>
          <a-select
            v-model="stockPool.industries"
            mode="tags"
            allow-clear
            show-search
            :loading="poolOptionsLoading"
            :placeholder="$t('czsc.industryPlaceholder')"
            @focus="loadPoolOptions"
            @change="persistState"
          >
            <a-select-option v-for="industry in poolOptions.industries" :key="industry" :value="industry">
              {{ industry }}
            </a-select-option>
          </a-select>
        </label>

        <div class="range-grid">
          <label class="field">
            <span>{{ $t('czsc.priceMin') }}</span>
            <a-input-number v-model="stockPool.price_min" :min="0" :max="100000" :step="1" @change="persistState" />
          </label>
          <label class="field">
            <span>{{ $t('czsc.priceMax') }}</span>
            <a-input-number v-model="stockPool.price_max" :min="0" :max="100000" :step="1" @change="persistState" />
          </label>
        </div>

        <div class="range-grid">
          <label class="field">
            <span>{{ $t('czsc.poolLimit') }}</span>
            <a-input-number v-model="stockPool.pool_limit" :min="1" :max="100" :step="10" @change="persistState" />
          </label>
          <label class="field">
            <span>{{ $t('czsc.poolSort') }}</span>
            <a-select v-model="stockPool.sort_by" @change="persistState">
              <a-select-option value="sort_order">{{ $t('czsc.poolSortDefault') }}</a-select-option>
              <a-select-option value="symbol">{{ $t('czsc.poolSortSymbol') }}</a-select-option>
              <a-select-option value="name">{{ $t('czsc.poolSortName') }}</a-select-option>
            </a-select>
          </label>
        </div>

        <div class="scan-actions">
          <a-button type="primary" icon="filter" :loading="loading" @click="runScreener">
            {{ $t('czsc.runFactorScreen') }}
          </a-button>
          <a-button icon="reload" @click="resetStockPool">{{ $t('czsc.resetPoolFilters') }}</a-button>
        </div>
      </aside>

      <main class="factor-workspace">
        <div class="factor-head">
          <div>
            <h2>{{ $t('czsc.factorScreener') }}</h2>
            <p>{{ $t('czsc.factorScreenerDesc') }}</p>
          </div>
          <a-button icon="download" :disabled="!result" @click="exportResult">{{ $t('czsc.exportResult') }}</a-button>
        </div>

        <div class="template-row">
          <label class="field">
            <span>{{ $t('czsc.savedFactorTemplates') }}</span>
            <a-select :placeholder="$t('czsc.noSavedTemplate')" @change="applySavedTemplate">
              <a-select-option v-for="item in savedTemplates" :key="item.id" :value="item.id">
                {{ item.name }}
              </a-select-option>
            </a-select>
          </label>
          <label class="field">
            <span>{{ $t('czsc.factorTemplateName') }}</span>
            <a-input v-model="templateNameInput" :placeholder="$t('czsc.factorTemplateName')" @pressEnter="saveFactorTemplate" />
          </label>
          <a-button icon="save" @click="saveFactorTemplate">{{ $t('czsc.saveTemplate') }}</a-button>
        </div>

        <div class="factor-grid">
          <signal-factor-selector v-model="signalFactorConditions" :logic.sync="screenLogic" @change="persistState" />
          <label class="field result-limit-field">
            <span>{{ $t('czsc.resultLimit') }}</span>
            <a-input-number v-model="resultLimit" :min="1" :max="200" :step="5" @change="persistState" />
          </label>
        </div>

        <a-alert v-if="error" type="error" show-icon :message="$t('czsc.scanFailed')" :description="error" />

        <div v-if="result" class="scan-summary">
          <div><span>{{ $t('czsc.requested') }}</span><strong>{{ result.summary.requested }}</strong></div>
          <div><span>{{ $t('czsc.evaluated') }}</span><strong>{{ result.summary.evaluated }}</strong></div>
          <div><span>{{ $t('czsc.matched') }}</span><strong>{{ result.summary.matched }}</strong></div>
          <div><span>{{ $t('czsc.failed') }}</span><strong>{{ result.summary.failed }}</strong></div>
          <div><span>{{ $t('czsc.poolSelected') }}</span><strong>{{ resultPoolSelected }}</strong></div>
        </div>

        <a-table
          v-if="result"
          class="scan-table"
          row-key="symbol"
          size="small"
          :columns="columns"
          :data-source="result.results"
          :pagination="{ pageSize: 20, hideOnSinglePage: true }"
          :scroll="{ x: 1050 }"
        >
          <template slot="symbol" slot-scope="value, row">
            <strong class="symbol-label">{{ formatSymbolLabel(row) }}</strong>
          </template>
          <template slot="score" slot-scope="value, row">
            <a-tag v-if="row.score !== undefined" :color="Number(row.score) >= 70 ? 'green' : Number(row.score) >= 55 ? 'blue' : ''">
              {{ Number(row.score).toFixed(1) }}
            </a-tag>
            <span v-else>-</span>
          </template>
          <template slot="action" slot-scope="value, row">
            <a-tag :color="actionColor(rowAction(row))">{{ actionLabel(rowAction(row)) }}</a-tag>
          </template>
          <template slot="price" slot-scope="value, row">
            {{ row.bar ? formatPrice(row.bar.close) : '-' }}
          </template>
          <template slot="factor" slot-scope="value, row">
            <span v-if="row.error" class="row-error">{{ row.error }}</span>
            <div v-else class="factor-cell">
              <strong>{{ factorLabel(row) || '-' }}</strong>
              <small v-if="row.features">{{ featureSummary(row.features) }}</small>
            </div>
          </template>
          <template slot="operation" slot-scope="value, row">
            <div class="row-actions">
              <a-tooltip :title="$t('czsc.viewChart')">
                <a-button size="small" icon="line-chart" :aria-label="$t('czsc.viewChart')" @click="$emit('view-chart', row)" />
              </a-tooltip>
              <a-tooltip :title="$t('czsc.addWatchlist')">
                <a-button size="small" icon="star" :aria-label="$t('czsc.addWatchlist')" @click="addWatchlist(row)" />
              </a-tooltip>
              <a-tooltip :title="$t('czsc.prepareRetraq')">
                <a-button size="small" icon="audit" :disabled="!reviewable(row)" :aria-label="$t('czsc.prepareRetraq')" @click="prepare(row)" />
              </a-tooltip>
              <a-tooltip :title="$t('czsc.backtestVerify')">
                <a-button size="small" icon="fund" :aria-label="$t('czsc.backtestVerify')" @click="$emit('backtest-row', row)" />
              </a-tooltip>
            </div>
          </template>
        </a-table>

        <a-empty v-else :description="$t('czsc.noScanResult')" />
      </main>
    </div>
  </section>
</template>

<script>
import { addCzscWatchlistItem, getCzscStockPoolOptions, screenCzscSignalFactors } from '@/api/czsc'
import {
  czscSymbolCode,
  czscSymbolName,
  formatCzscSymbolLabel,
  updateCzscSymbolMeta
} from '@/utils/czscSymbols'
import SignalFactorSelector from './SignalFactorSelector.vue'

const STORAGE_KEY = 'quantdinger.czsc.scan.v2'
const defaultStockPool = () => ({
  exclude_st: true,
  exclude_recent_days: 60,
  industries: [],
  price_min: null,
  price_max: null,
  pool_limit: 100,
  sort_by: 'sort_order'
})

export default {
  name: 'CzscScanPanel',
  components: { SignalFactorSelector },
  props: {
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true },
    templates: { type: Array, default: () => [] },
    templateId: { type: String, required: true },
    workbenchSymbolMeta: { type: Object, default: () => ({}) }
  },
  data () {
    return {
      stockPool: defaultStockPool(),
      poolOptions: { industries: [], total: 0, st_count: 0 },
      poolOptionsLoading: false,
      symbolMeta: updateCzscSymbolMeta(),
      enabledFactorKeys: [],
      maxDrawdownPct: 18,
      recentReturnMinPct: -5,
      screenLogic: 'and',
      signalFactorConditions: [
        { source: 'feature', factor: 'czsc_direction', operator: 'eq', value: 'up', label: 'CZSC direction up' },
        { source: 'feature', factor: 'ma_bullish', operator: 'truthy', value: true, label: 'Bullish MA' },
        { source: 'feature', factor: 'volume_expand', operator: 'truthy', value: true, label: 'Volume expansion' }
      ],
      resultLimit: 50,
      templateNameInput: '',
      savedTemplates: [],
      loading: false,
      error: '',
      result: null,
      resultMode: 'screener',
      columns: [
        { title: this.$t('czsc.symbol'), dataIndex: 'symbol', key: 'symbol', scopedSlots: { customRender: 'symbol' }, width: 150 },
        { title: this.$t('czsc.score'), dataIndex: 'score', key: 'score', scopedSlots: { customRender: 'score' }, width: 82 },
        { title: this.$t('czsc.currentEvent'), key: 'action', scopedSlots: { customRender: 'action' }, width: 110 },
        { title: this.$t('czsc.referencePrice'), key: 'price', scopedSlots: { customRender: 'price' }, width: 105 },
        { title: this.$t('czsc.matchedFactor'), key: 'factor', scopedSlots: { customRender: 'factor' } },
        { title: '', key: 'operation', scopedSlots: { customRender: 'operation' }, width: 160 }
      ]
    }
  },
  computed: {
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    },
    resultModeLabel () {
      return this.$t('czsc.factorScreener')
    },
    poolTotalLabel () {
      const total = Number(this.poolOptions.total || 0)
      return total > 0 ? this.$t('czsc.poolTotalCount', { count: total }) : this.$t('czsc.allAsharePool')
    },
    resultPoolSelected () {
      const summary = this.result && this.result.universe && this.result.universe.summary
      return summary ? summary.selected : '-'
    },
    legacyConditions () {
      const conditions = []
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('czsc_direction_up')) conditions.push({ source: 'feature', factor: 'czsc_direction', operator: 'eq', value: 'up' })
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('macd_golden')) conditions.push({ source: 'feature', factor: 'macd_cross', operator: 'eq', value: 'golden' })
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('volume_expand')) conditions.push({ source: 'feature', factor: 'volume_expand', operator: 'truthy', value: true })
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('ma_bullish')) conditions.push({ source: 'feature', factor: 'ma_bullish', operator: 'truthy', value: true })
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('breakout_high')) conditions.push({ source: 'feature', factor: 'breakout_high', operator: 'truthy', value: true })
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('drawdown_range')) conditions.push({ source: 'feature', factor: 'drawdown_pct', operator: 'between', value: [-Number(this.maxDrawdownPct || 18) / 100, 0] })
      if (this.enabledFactorKeys && this.enabledFactorKeys.includes('recent_return')) conditions.push({ source: 'feature', factor: 'recent_return_pct', operator: 'gte', value: Number(this.recentReturnMinPct || 0) / 100 })
      return conditions
    }
  },
  created () {
    this.restoreState()
    this.loadPoolOptions()
  },
  methods: {
    restoreState () {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const state = raw ? JSON.parse(raw) : null
        if (state && typeof state === 'object') {
          if (state.stockPool && typeof state.stockPool === 'object') {
            this.stockPool = {
              ...defaultStockPool(),
              ...state.stockPool,
              industries: Array.isArray(state.stockPool.industries) ? state.stockPool.industries : []
            }
          }
          if (Array.isArray(state.signalFactorConditions)) this.signalFactorConditions = state.signalFactorConditions
          else if (Array.isArray(state.enabledFactorKeys)) {
            this.enabledFactorKeys = state.enabledFactorKeys
            this.maxDrawdownPct = state.maxDrawdownPct
            this.recentReturnMinPct = state.recentReturnMinPct
            this.signalFactorConditions = this.legacyConditions()
          }
          if (state.screenLogic) this.screenLogic = state.screenLogic
          if (state.resultLimit !== undefined) this.resultLimit = Number(state.resultLimit)
          if (state.result) {
            this.result = state.result
            this.symbolMeta = updateCzscSymbolMeta(this.symbolMeta, state.result.results || [])
          }
          if (state.resultMode) this.resultMode = state.resultMode
          if (Array.isArray(state.savedTemplates)) this.savedTemplates = state.savedTemplates
        }
      } catch (error) {}
    },
    persistState () {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          stockPool: this.stockPoolForStorage(),
          signalFactorConditions: this.signalFactorConditions,
          screenLogic: this.screenLogic,
          resultLimit: this.resultLimit,
          result: this.result,
          resultMode: this.resultMode,
          savedTemplates: this.savedTemplates
        }))
      } catch (error) {}
    },
    symbolCode (value) {
      return czscSymbolCode(value)
    },
    symbolName (item) {
      return czscSymbolName(item, { ...this.workbenchSymbolMeta, ...this.symbolMeta })
    },
    formatSymbolLabel (item) {
      return formatCzscSymbolLabel(item, { ...this.workbenchSymbolMeta, ...this.symbolMeta })
    },
    stockPoolForStorage () {
      return {
        ...this.stockPool,
        industries: Array.isArray(this.stockPool.industries) ? this.stockPool.industries : []
      }
    },
    stockPoolForRequest () {
      const pool = this.stockPoolForStorage()
      return {
        enabled: true,
        exclude_st: Boolean(pool.exclude_st),
        exclude_recent_days: Number(pool.exclude_recent_days || 0),
        industries: pool.industries,
        price_min: this.optionalNumber(pool.price_min),
        price_max: this.optionalNumber(pool.price_max),
        pool_limit: Number(pool.pool_limit || 100),
        sort_by: pool.sort_by || 'sort_order'
      }
    },
    optionalNumber (value) {
      if (value === '' || value === null || value === undefined) return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    },
    async loadPoolOptions () {
      if (this.poolOptionsLoading) return
      this.poolOptionsLoading = true
      try {
        const response = await getCzscStockPoolOptions()
        const data = response && response.data ? response.data : {}
        this.poolOptions = {
          industries: Array.isArray(data.industries) ? data.industries : [],
          total: Number(data.total || 0),
          st_count: Number(data.st_count || 0)
        }
      } catch (error) {
        this.poolOptions = { industries: [], total: 0, st_count: 0 }
      } finally {
        this.poolOptionsLoading = false
      }
    },
    resetStockPool () {
      this.stockPool = defaultStockPool()
      this.persistState()
    },
    toggleExcludeRecent (event) {
      this.stockPool.exclude_recent_days = event && event.target && event.target.checked ? 60 : 0
      this.persistState()
    },
    conditionsForRequest () {
      return Array.isArray(this.signalFactorConditions) ? this.signalFactorConditions : []
    },
    async runScreener () {
      this.loading = true
      this.resultMode = 'screener'
      this.error = ''
      try {
        const response = await screenCzscSignalFactors({
          universe: this.stockPoolForRequest(),
          timeframe: this.timeframe,
          limit: this.limit,
          result_limit: Number(this.resultLimit || 50),
          logic: this.screenLogic,
          conditions: this.conditionsForRequest()
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.scanFailed'))
        }
        this.result = response.data
        this.symbolMeta = updateCzscSymbolMeta(this.symbolMeta, response.data.results || [])
        this.persistState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.scanFailed')
      } finally {
        this.loading = false
      }
    },
    saveFactorTemplate () {
      const name = String(this.templateNameInput || '').trim()
      if (!name) return
      const item = {
        id: `factor-${Date.now()}`,
        name,
        signalFactorConditions: JSON.parse(JSON.stringify(this.signalFactorConditions || [])),
        screenLogic: this.screenLogic,
        resultLimit: Number(this.resultLimit || 50),
        stockPool: this.stockPoolForStorage()
      }
      this.savedTemplates = [item, ...this.savedTemplates.filter(template => template.name !== name)].slice(0, 20)
      this.templateNameInput = ''
      this.persistState()
      this.$message.success(this.$t('czsc.templateSaved'))
    },
    applySavedTemplate (id) {
      const item = this.savedTemplates.find(template => template.id === id)
      if (!item) return
      this.signalFactorConditions = Array.isArray(item.signalFactorConditions) ? JSON.parse(JSON.stringify(item.signalFactorConditions)) : []
      if (!this.signalFactorConditions.length && Array.isArray(item.enabledFactorKeys)) {
        this.enabledFactorKeys = item.enabledFactorKeys
        this.maxDrawdownPct = item.maxDrawdownPct
        this.recentReturnMinPct = item.recentReturnMinPct
        this.signalFactorConditions = this.legacyConditions()
      }
      this.screenLogic = item.screenLogic || 'and'
      this.resultLimit = Number(item.resultLimit)
      if (item.stockPool && typeof item.stockPool === 'object') {
        this.stockPool = {
          ...defaultStockPool(),
          ...item.stockPool,
          industries: Array.isArray(item.stockPool.industries) ? item.stockPool.industries : []
        }
      }
      this.persistState()
    },
    exportResult () {
      if (!this.result) return
      const rows = [['symbol', 'name', 'score', 'action', 'close', 'factor', 'error']]
      ;(this.result.results || []).forEach(row => {
        rows.push([
          this.symbolCode(row.symbol),
          this.symbolName(row),
          row.score === undefined ? '' : row.score,
          this.rowAction(row),
          row.bar ? row.bar.close : '',
          this.factorLabel(row),
          row.error || ''
        ])
      })
      const csv = rows.map(row => row.map(value => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `czsc-${this.resultMode}-${Date.now()}.csv`
      link.click()
      URL.revokeObjectURL(url)
    },
    async addWatchlist (row) {
      if (!row || !row.symbol) return
      try {
        await addCzscWatchlistItem({
          symbol: row.symbol,
          name: this.symbolName(row),
          group: this.resultModeLabel,
          tags: [this.timeframe],
          reason: this.factorLabel(row),
          invalidation_condition: ''
        })
        this.$message.success(this.$t('czsc.watchlistAdded'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.watchlistFailed'))
      }
    },
    prepare (row) {
      const action = this.rowAction(row)
      const signal = this.topSignal(row)
      const external = this.resultMode === 'screener' || !row.matched
      this.$emit('prepare-review', {
        symbol: row.symbol,
        name: this.symbolName(row),
        timeframe: this.timeframe,
        template_id: this.templateId,
        template: this.templates.find(item => item.id === this.templateId),
        bar: row.bar,
        action,
        matched: row.matched || row.passed,
        matched_factor_zh: row.matched_factor_zh || (signal && signal.signal_type_label) || this.$t('czsc.factorScreener'),
        matched_factor_en: row.matched_factor_en || (signal && signal.signal_type) || 'factor_screener',
        external_source: external ? 'factor_screener' : '',
        raw_payload: external
          ? {
            source: 'factor_screener',
            symbol: row.symbol,
            timeframe: this.timeframe,
            score: row.score,
            conditions: row.matched_conditions,
            signal,
            features: row.features
          }
          : undefined
      })
    },
    topSignal (row) {
      return row && Array.isArray(row.signals) && row.signals.length ? row.signals[0] : null
    },
    reviewable (row) {
      return Boolean(row && row.bar && ['open_long', 'close_long'].includes(this.rowAction(row)))
    },
    rowAction (row) {
      if (row && ['open_long', 'close_long', 'hold', 'error'].includes(row.action)) return row.action
      const signal = this.topSignal(row)
      if (signal && signal.direction === 'bullish') return 'open_long'
      if (signal && signal.direction === 'bearish') return 'close_long'
      return row && row.error ? 'error' : 'hold'
    },
    templateName (item) {
      return this.isChinese ? item.name_zh : item.name_en
    },
    factorLabel (row) {
      if (!row) return ''
      const signal = this.topSignal(row)
      return (this.isChinese ? row.matched_factor_zh : row.matched_factor_en) || (signal ? (signal.signal_type_label || signal.signal_type) : '')
    },
    featureSummary (features) {
      if (!features) return ''
      return [
        `MACD ${features.macd_cross || '-'}`,
        `VOL ${Number(features.volume_ratio || 0).toFixed(2)}x`,
        `MA ${features.ma_state || '-'}`,
        `RET ${(Number(features.recent_return_pct || 0) * 100).toFixed(1)}%`
      ].join(' · ')
    },
    actionLabel (action) {
      if (action === 'open_long') return this.$t('czsc.openLong')
      if (action === 'close_long') return this.$t('czsc.closeLong')
      if (action === 'error') return this.$t('czsc.failed')
      return this.$t('czsc.hold')
    },
    actionColor (action) {
      if (action === 'open_long') return 'red'
      if (action === 'close_long') return 'green'
      if (action === 'error') return 'red'
      return ''
    },
    formatPrice (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(2) : '-'
    }
  }
}
</script>

<style scoped>
.scan-panel { min-height: 620px; background: #fff; }
.scan-layout { display: grid; grid-template-columns: minmax(280px, 320px) minmax(0, 1fr); min-height: 620px; }
.scan-sidebar { display: flex; flex-direction: column; gap: 14px; padding: 18px 18px 28px; border-right: 1px solid #e5e7eb; background: #fbfbfc; }
.factor-workspace { min-width: 0; padding: 18px 20px 32px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.pool-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.pool-head strong { display: block; color: #262626; font-size: 14px; line-height: 1.4; }
.pool-head small { display: block; margin-top: 3px; color: #8c8c8c; font-size: 11px; line-height: 1.4; }
.pool-switches { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid #eceef1; border-radius: 8px; background: #fff; }
.recent-filter-row { display: grid; grid-template-columns: minmax(0, 1fr) 84px; gap: 8px; align-items: center; }
.range-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.range-grid .ant-input-number, .range-grid .ant-select { width: 100%; }
.scan-actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
.factor-head, .template-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.factor-head h2 { margin: 0 0 4px; font-size: 15px; }
.factor-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.template-row .field { flex: 1; }
.factor-grid { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 18px; margin-bottom: 16px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfbfc; }
.factor-checkboxes { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
.factor-checkboxes >>> .ant-checkbox-wrapper { display: flex; min-height: 54px; margin-left: 0; padding: 8px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; }
.factor-checkboxes strong, .factor-checkboxes small { display: block; margin-left: 4px; }
.factor-checkboxes strong { color: #262626; font-size: 12px; }
.factor-checkboxes small { color: #8c8c8c; font-size: 10px; }
.threshold-grid { display: flex; flex-direction: column; gap: 10px; }
.threshold-grid .ant-input-number { width: 100%; }
.scan-summary { display: grid; grid-template-columns: repeat(5, minmax(90px, 1fr)); margin: 18px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.scan-summary > div { display: flex; min-height: 62px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.scan-summary span { color: #8c8c8c; font-size: 10px; }
.scan-summary strong { font-size: 17px; }
.scan-table strong, .scan-table small { display: block; }
.symbol-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scan-table small { color: #8c8c8c; font-size: 10px; }
.factor-cell strong { font-size: 12px; }
.factor-cell small { margin-top: 3px; }
.row-error { color: #cf1322; font-size: 11px; }
.row-actions { display: flex; gap: 4px; }
.theme-dark .scan-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .scan-sidebar, .theme-dark .factor-grid { border-color: #30343b; background: #1c2027; }
.theme-dark .pool-head strong { color: #f3f4f6; }
.theme-dark .pool-head small { color: #c5cad3; }
.theme-dark .pool-switches { border-color: #30343b; background: #171a20; }
.theme-dark .field, .theme-dark .factor-head p { color: #c5cad3; }
.theme-dark .factor-checkboxes >>> .ant-checkbox-wrapper { border-color: #30343b; background: #171a20; }
.theme-dark .factor-checkboxes strong, .theme-dark .factor-head h2 { color: #f3f4f6; }
.theme-dark .factor-checkboxes small { color: #c5cad3; }
.theme-dark .scan-summary, .theme-dark .scan-summary > div { border-color: #30343b; }
@media (max-width: 960px) {
  .scan-layout { grid-template-columns: 1fr; }
  .scan-sidebar { border-right: 0; border-bottom: 1px solid #e5e7eb; }
  .factor-grid, .template-row, .factor-head { grid-template-columns: 1fr; flex-direction: column; align-items: stretch; }
  .scan-summary { grid-template-columns: repeat(2, 1fr); }
}
</style>
