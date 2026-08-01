<template>
  <div class="screener-page" :class="{ 'screener-page--dark': isDarkTheme }">
    <header class="screener-header">
      <div><h1>{{ $t('marketScreener.title') }}</h1><p>{{ $t('marketScreener.subtitle') }}</p></div>
      <div class="header-actions">
        <router-link to="/tasks"><a-button icon="profile">{{ $t('menu.dashboard.taskCenter') }}</a-button></router-link>
        <a-button icon="reload" :loading="loadingCatalog" @click="loadReferenceData">{{ $t('marketScreener.refresh') }}</a-button>
      </div>
    </header>

    <div class="screener-layout">
      <section class="config-panel">
        <h2>{{ $t('marketScreener.universe') }}</h2>
        <a-radio-group v-model="universeMode" button-style="solid" size="small">
          <a-radio-button value="watchlist">{{ $t('marketScreener.watchlist') }}</a-radio-button>
          <a-radio-button value="pool">{{ $t('marketScreener.stockPool') }}</a-radio-button>
          <a-radio-button value="manual">{{ $t('marketScreener.manual') }}</a-radio-button>
        </a-radio-group>
        <a-alert v-if="universeMode === 'watchlist' && !watchlistSymbols.length" class="config-alert" type="warning" show-icon :message="$t('marketScreener.emptyWatchlist')" />
        <a-textarea v-if="universeMode === 'manual'" v-model="manualSymbols" class="manual-symbols" :rows="4" :placeholder="$t('marketScreener.symbolPlaceholder')" />
        <div v-if="universeMode === 'pool'" class="pool-settings">
          <label><a-checkbox v-model="pool.exclude_st" />{{ $t('marketScreener.excludeSt') }}</label>
          <label><span>{{ $t('marketScreener.poolLimit') }}</span><a-input-number v-model="pool.pool_limit" :min="1" :max="100" /></label>
          <label><span>{{ $t('marketScreener.industries') }}</span>
            <a-select v-model="pool.industries" mode="multiple" allow-clear :max-tag-count="2">
              <a-select-option v-for="item in industries" :key="item" :value="item">{{ item }}</a-select-option>
            </a-select>
          </label>
        </div>

        <div class="section-title"><h2>{{ $t('marketScreener.conditions') }}</h2><a-button type="link" icon="plus" :disabled="conditions.length >= 5" @click="addCondition">{{ $t('marketScreener.addCondition') }}</a-button></div>
        <div v-for="(condition, index) in conditions" :key="condition.key" class="condition-row">
          <a-select v-model="condition.catalogKey" show-search option-filter-prop="children" @change="value => chooseCondition(index, value)">
            <a-select-option v-for="item in catalogItems" :key="item.key" :value="item.key">{{ item.label }}</a-select-option>
          </a-select>
          <a-select v-model="condition.operator" @change="value => chooseOperator(index, value)">
            <a-select-option v-for="operator in condition.operators" :key="operator" :value="operator">{{ operator }}</a-select-option>
          </a-select>
          <a-input v-if="condition.needsValue" v-model="condition.value" :placeholder="$t('marketScreener.value')" />
          <a-button shape="circle" icon="delete" :aria-label="$t('marketScreener.removeCondition')" @click="removeCondition(index)" />
        </div>
        <div class="run-settings">
          <a-select v-model="logic"><a-select-option value="and">AND</a-select-option><a-select-option value="or">OR</a-select-option></a-select>
          <a-select v-model="timeframe"><a-select-option value="5m">5m</a-select-option><a-select-option value="30m">30m</a-select-option><a-select-option value="1d">1D</a-select-option></a-select>
          <a-input-number v-model="limit" :min="100" :max="5000" :step="100" />
        </div>
        <a-button
          type="primary"
          block
          size="large"
          icon="filter"
          :loading="running"
          :disabled="runDisabled"
          @click="runScreen">{{ $t('marketScreener.run') }}</a-button>
      </section>

      <section class="result-panel">
        <div class="result-heading">
          <div><h2>{{ $t('marketScreener.results') }}</h2><span v-if="summary">{{ summaryText }}</span></div>
          <a-tag v-if="task" :color="task.status === 'SUCCEEDED' ? 'green' : 'blue'">{{ task.status }}</a-tag>
        </div>
        <a-empty v-if="!running && !results.length" :description="$t('marketScreener.noResults')" />
        <div v-if="running" class="running-state"><a-icon type="loading" /><strong>{{ $t('marketScreener.running') }}</strong></div>
        <a-table
          v-else
          row-key="symbol"
          :columns="columns"
          :data-source="results"
          :pagination="{ pageSize: 20 }"
          size="middle">
          <template slot="symbol" slot-scope="value, row"><router-link :to="{ path: '/indicator-ide', query: { market: 'CNStock', symbol: value, timeframe, builtin: 'czsc' } }"><strong>{{ value }}</strong><small>{{ row.name || '' }}</small></router-link></template>
          <template slot="score" slot-scope="value"><b :class="Number(value) >= 70 ? 'score-high' : ''">{{ Number(value || 0).toFixed(1) }}</b></template>
          <template slot="signals" slot-scope="value"><a-tag v-for="item in (value || []).slice(0, 3)" :key="item.signal_type">{{ item.signal_type_label || item.signal_type }}</a-tag></template>
          <template slot="action" slot-scope="value, row"><a-tooltip :title="$t('marketScreener.addWatchlist')"><a-button type="link" icon="star" @click="addResultToWatchlist(row)" /></a-tooltip></template>
        </a-table>
      </section>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { addWatchlist, getWatchlist } from '@/api/market'
import { createScreen, getFactorCatalog, getStockPoolOptions, getTask } from '@/api/domain'

export default {
  name: 'MarketScreener',
  data () {
    return {
      loadingCatalog: false,
      running: false,
      catalog: {},
      industries: [],
      watchlistSymbols: [],
      universeMode: 'watchlist',
      manualSymbols: '',
      pool: { exclude_st: true, exclude_recent_days: 60, industries: [], pool_limit: 50, sort_by: 'sort_order' },
      conditions: [],
      logic: 'and',
      timeframe: '1d',
      limit: 1000,
      task: null,
      result: null,
      columns: [
        { title: this.$t('marketScreener.symbol'), dataIndex: 'symbol', width: 150, scopedSlots: { customRender: 'symbol' } },
        { title: this.$t('marketScreener.score'), dataIndex: 'score', width: 90, scopedSlots: { customRender: 'score' } },
        { title: this.$t('marketScreener.signals'), dataIndex: 'signals', scopedSlots: { customRender: 'signals' } },
        { title: this.$t('marketScreener.explanation'), dataIndex: 'explanation' },
        { title: '', key: 'action', width: 70, scopedSlots: { customRender: 'action' } }
      ]
    }
  },
  computed: {
    ...mapState({ theme: state => state.app.theme }),
    isDarkTheme () { return ['dark', 'realdark'].includes(this.theme) },
    catalogItems () {
      const groups = [
        ['feature_conditions', 'feature'],
        ['enhanced_signals', 'enhanced_signal'],
        ['factor_library', 'factor_library'],
        ['template_signals', 'template_signal']
      ]
      return groups.flatMap(([name, source]) => (this.catalog[name] || []).map((item, index) => ({
        ...item,
        source,
        key: `${source}:${item.id || item.factor_id || item.signal_type || item.template_id || index}`,
        label: item.name_zh || item.name_en || item.label || item.id || item.factor_id || item.signal_type
      })))
    },
    manualSymbolList () {
      return [...new Set(this.manualSymbols.split(/[\s,;]+/).map(item => item.trim().toUpperCase()).filter(Boolean))].slice(0, 100)
    },
    results () { return ((this.result && this.result.results) || []).filter(item => item && item.passed && !item.error) },
    summary () { return this.result && this.result.summary },
    summaryText () {
      return this.$t('marketScreener.summary', { requested: this.summary.requested || 0, matched: this.summary.matched || this.results.length })
    },
    runDisabled () {
      const noUniverse = this.universeMode === 'watchlist' ? !this.watchlistSymbols.length : this.universeMode === 'manual' ? !this.manualSymbolList.length : false
      return noUniverse || !this.conditions.length
    }
  },
  created () { this.loadReferenceData() },
  methods: {
    async loadReferenceData () {
      this.loadingCatalog = true
      try {
        const [catalog, options, watchlist] = await Promise.all([getFactorCatalog(), getStockPoolOptions(), getWatchlist()])
        this.catalog = catalog.data || {}
        this.industries = (options.data && options.data.industries) || []
        const rows = Array.isArray(watchlist.data) ? watchlist.data : []
        this.watchlistSymbols = rows.filter(item => item.market === 'CNStock').map(item => this.normalizeSymbol(item.symbol))
        if (!this.conditions.length && this.catalogItems.length) this.addCondition()
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('marketScreener.loadFailed'))
      } finally {
        this.loadingCatalog = false
      }
    },
    normalizeSymbol (value) {
      const raw = String(value || '').toUpperCase()
      if (/^\d{6}\.(SH|SZ|BJ)$/.test(raw)) return raw
      const code = raw.replace(/\D/g, '').slice(0, 6)
      if (!code) return raw
      return `${code}.${code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') ? 'BJ' : 'SZ'}`
    },
    addCondition () {
      const first = this.catalogItems[0]
      if (!first) return
      this.conditions.push({ key: `${Date.now()}-${this.conditions.length}`, catalogKey: first.key, ...this.conditionFromCatalog(first) })
    },
    removeCondition (index) { this.conditions.splice(index, 1) },
    chooseCondition (index, key) {
      const item = this.catalogItems.find(row => row.key === key)
      if (item) this.$set(this.conditions, index, { ...this.conditions[index], catalogKey: key, ...this.conditionFromCatalog(item) })
    },
    chooseOperator (index, operator) {
      const current = this.conditions[index]
      if (!current) return
      this.$set(this.conditions, index, {
        ...current,
        operator,
        needsValue: !['exists', 'not_exists', 'matched'].includes(operator)
      })
    },
    conditionFromCatalog (item) {
      const base = { ...(item.default_condition || {}) }
      const operators = item.operators || this.catalog.operators || ['eq']
      const operator = base.operator || operators[0]
      return { definition: base, operator, operators, value: base.value == null ? '' : base.value, needsValue: !['exists', 'not_exists', 'matched'].includes(operator) }
    },
    conditionPayload (row) {
      const value = row.value === 'true' ? true : row.value === 'false' ? false : row.value !== '' && Number.isFinite(Number(row.value)) ? Number(row.value) : row.value
      return { ...row.definition, operator: row.operator, value, enabled: true }
    },
    async runScreen () {
      this.running = true
      this.result = null
      try {
        const payload = {
          operation: 'signal_factor_screener',
          timeframe: this.timeframe,
          conditions: this.conditions.map(this.conditionPayload),
          logic: this.logic,
          limit: this.limit,
          result_limit: 100
        }
        if (this.universeMode === 'pool') payload.universe = { ...this.pool, enabled: true }
        else payload.symbols = this.universeMode === 'watchlist' ? this.watchlistSymbols : this.manualSymbolList.map(item => this.normalizeSymbol(item))
        const response = await createScreen(payload, `screen-${Date.now()}`)
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        this.task = await this.waitTask(response.data.task_id)
        this.result = this.task.result && this.task.result.payload
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('marketScreener.runFailed'))
      } finally {
        this.running = false
      }
    },
    async waitTask (taskId) {
      const deadline = Date.now() + 300000
      while (Date.now() < deadline) {
        const response = await getTask(taskId)
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        if (response.data.status === 'SUCCEEDED') return response.data
        if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(response.data.status)) throw new Error(response.data.error_message || response.data.status)
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
      throw new Error(this.$t('trendChart.taskTimeout'))
    },
    async addResultToWatchlist (row) {
      try {
        await addWatchlist({ market: 'CNStock', symbol: String(row.symbol).split('.')[0], name: row.name || row.symbol })
        this.$message.success(this.$t('marketScreener.addedWatchlist'))
        await this.loadReferenceData()
      } catch (error) { this.$message.error(error.backendMessage || error.message) }
    }
  }
}
</script>

<style scoped>
.screener-page { min-height: calc(100vh - 64px); padding: 16px 20px; color: #1f2937; background: #f5f7fa; }
.screener-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.screener-header h1 { margin: 0; font-size: 20px; }.screener-header p { margin: 3px 0 0; color: #8c8c8c; font-size: 12px; }.header-actions { display: flex; gap: 8px; }
.screener-layout { display: grid; grid-template-columns: 350px minmax(0, 1fr); min-height: 720px; border: 1px solid #e5e7eb; background: #fff; }
.config-panel { padding: 16px; border-right: 1px solid #e5e7eb; }.result-panel { min-width: 0; padding: 16px; }.config-panel h2, .result-heading h2 { margin: 0 0 10px; font-size: 14px; }
.config-alert, .manual-symbols, .pool-settings { margin-top: 12px; }.pool-settings { display: grid; gap: 10px; }.pool-settings label { display: grid; gap: 5px; font-size: 12px; }.pool-settings .ant-select { width: 100%; }
.section-title, .result-heading { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; }.condition-row { display: grid; grid-template-columns: minmax(0, 1fr) 95px 85px 32px; gap: 6px; margin-bottom: 8px; }.run-settings { display: grid; grid-template-columns: 90px 90px 1fr; gap: 8px; margin: 16px 0; }.run-settings .ant-input-number { width: 100%; }
.running-state { display: flex; align-items: center; justify-content: center; flex-direction: column; min-height: 520px; gap: 10px; }.result-heading { margin: 0 0 12px; }.result-heading span { color: #8c8c8c; font-size: 12px; }.result-panel small { display: block; color: #8c8c8c; }.score-high { color: #cf1322; }
.screener-page--dark { color: #e5e7eb; background: #111827; }.screener-page--dark .screener-layout { border-color: #30363d; background: #171b22; }.screener-page--dark .config-panel { border-color: #30363d; }
@media (max-width: 900px) { .screener-layout { grid-template-columns: 1fr; }.config-panel { border-right: 0; border-bottom: 1px solid #e5e7eb; } }
</style>
