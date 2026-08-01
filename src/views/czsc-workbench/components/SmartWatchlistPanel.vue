<template>
  <section class="research-panel watchlist-panel">
    <div class="watchlist-layout">
      <aside class="watchlist-side">
        <div class="panel-head compact-head">
          <div>
            <h2>{{ $t('czsc.smartWatchlist') }}</h2>
            <p>{{ $t('czsc.smartWatchlistDesc') }}</p>
          </div>
          <a-button icon="reload" :loading="loadingList" @click="loadWatchlist" />
        </div>

        <label class="field">
          <span>{{ $t('czsc.currentSymbol') }}</span>
          <a-input :value="formatSymbolLabel(symbol)" disabled />
        </label>
        <label class="field">
          <span>{{ $t('czsc.watchlistGroup') }}</span>
          <a-input v-model="form.group" />
        </label>
        <label class="field">
          <span>{{ $t('czsc.watchlistReason') }}</span>
          <a-textarea v-model="form.reason" :rows="3" />
        </label>
        <label class="field">
          <span>{{ $t('czsc.invalidationCondition') }}</span>
          <a-textarea v-model="form.invalidation_condition" :rows="3" />
        </label>
        <a-button type="primary" icon="star" :loading="saving" @click="addCurrentSymbol">
          {{ $t('czsc.addCurrentWatchlist') }}
        </a-button>

        <div class="watchlist-items">
          <article v-for="item in watchlist" :key="item.symbol" class="watchlist-item">
            <div>
              <strong>{{ symbolCode(item.symbol) }}</strong>
              <span v-if="symbolName(item)">{{ symbolName(item) }}</span>
              <small>{{ item.reason }}</small>
            </div>
            <a-button size="small" icon="delete" @click="removeItem(item)" />
          </article>
          <a-empty v-if="!watchlist.length" :description="$t('czsc.noWatchlist')" />
        </div>
      </aside>

      <main class="watchlist-main">
        <div class="panel-head">
          <div>
            <h2>{{ $t('czsc.watchlistAutoScan') }}</h2>
            <p>{{ $t('czsc.watchlistAutoScanDesc') }}</p>
          </div>
          <div class="panel-actions">
            <a-button type="primary" icon="scan" :loading="scanning" @click="runScan">{{ $t('czsc.runWatchlistScan') }}</a-button>
          </div>
        </div>

        <signal-factor-selector v-model="signalFactorConditions" class="watchlist-selector" :logic.sync="scanLogic" @change="persistScanState" />

        <a-alert v-if="error" type="error" show-icon :message="$t('czsc.watchlistScanFailed')" :description="error" />

        <div v-if="result" class="metric-grid">
          <div><span>{{ $t('czsc.requested') }}</span><strong>{{ result.summary.requested }}</strong></div>
          <div><span>{{ $t('czsc.evaluated') }}</span><strong>{{ result.summary.evaluated }}</strong></div>
          <div><span>{{ $t('czsc.matched') }}</span><strong>{{ result.summary.matched }}</strong></div>
          <div><span>{{ $t('czsc.failed') }}</span><strong>{{ result.summary.failed }}</strong></div>
        </div>

        <a-table
          v-if="result"
          row-key="candidate_id"
          size="small"
          :columns="columns"
          :data-source="result.results"
          :pagination="{ pageSize: 20, hideOnSinglePage: true }"
          :scroll="{ x: 900 }"
        >
          <template slot="symbol" slot-scope="value, row">
            <strong>{{ symbolCode(value) }}</strong><small>{{ symbolName(row) }}</small>
          </template>
          <template slot="score" slot-scope="value">
            <a-tag :color="Number(value) >= 70 ? 'green' : Number(value) >= 55 ? 'blue' : ''">{{ Number(value || 0).toFixed(1) }}</a-tag>
          </template>
          <template slot="factor" slot-scope="value, row">
            <strong>{{ topSignalLabel(row) }}</strong>
            <small>{{ featureSummary(row.features) }}</small>
          </template>
          <template slot="operation" slot-scope="value, row">
            <div class="row-actions">
              <a-button size="small" icon="line-chart" @click="$emit('view-chart', row)" />
              <a-button size="small" icon="fund" @click="$emit('backtest-row', row)" />
              <a-button size="small" icon="audit" :disabled="!reviewable(row)" @click="prepare(row)" />
            </div>
          </template>
        </a-table>
        <a-empty v-else :description="$t('czsc.noWatchlistScan')" />
      </main>
    </div>
  </section>
</template>

<script>
import { addCzscWatchlistItem, getCzscSmartWatchlist, removeCzscWatchlistItem, scanCzscWatchlist } from '@/api/czsc'
import { czscSymbolCode, czscSymbolName, formatCzscSymbolLabel, updateCzscSymbolMeta } from '@/utils/czscSymbols'
import SignalFactorSelector from './SignalFactorSelector.vue'

const STORAGE_KEY = 'quantdinger.czsc.watchlist-scan.v1'

export default {
  name: 'CzscSmartWatchlistPanel',
  components: { SignalFactorSelector },
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true }
  },
  data () {
    return {
      form: { group: '默认', reason: '', invalidation_condition: '' },
      watchlist: [],
      history: [],
      result: null,
      symbolMeta: updateCzscSymbolMeta(),
      scanCondition: 'default',
      scanLogic: 'and',
      signalFactorConditions: [{ source: 'feature', factor: 'recent_return_pct', operator: 'gte', value: -1, label: 'Recent return' }],
      loadingList: false,
      saving: false,
      scanning: false,
      error: '',
      columns: [
        { title: this.$t('czsc.symbol'), dataIndex: 'symbol', key: 'symbol', scopedSlots: { customRender: 'symbol' }, width: 150 },
        { title: this.$t('czsc.score'), dataIndex: 'score', key: 'score', scopedSlots: { customRender: 'score' }, width: 90 },
        { title: this.$t('czsc.matchedFactor'), key: 'factor', scopedSlots: { customRender: 'factor' } },
        { title: '', key: 'operation', scopedSlots: { customRender: 'operation' }, width: 130 }
      ]
    }
  },
  created () {
    this.restoreScanState()
    this.loadWatchlist()
  },
  methods: {
    restoreScanState () {
      try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        if (state.scanCondition) this.scanCondition = state.scanCondition
        if (state.scanLogic) this.scanLogic = state.scanLogic
        if (Array.isArray(state.signalFactorConditions)) this.signalFactorConditions = state.signalFactorConditions
        else this.signalFactorConditions = this.legacyConditions()
        if (state.result) {
          this.result = state.result
          this.symbolMeta = updateCzscSymbolMeta(this.symbolMeta, state.result.results || [])
        }
      } catch (error) {}
    },
    persistScanState () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ scanCondition: this.scanCondition, scanLogic: this.scanLogic, signalFactorConditions: this.signalFactorConditions, result: this.result }))
      } catch (error) {}
    },
    async loadWatchlist () {
      this.loadingList = true
      try {
        const response = await getCzscSmartWatchlist()
        const data = response && response.data ? response.data : {}
        this.watchlist = Array.isArray(data.watchlist) ? data.watchlist : []
        this.history = Array.isArray(data.scan_history) ? data.scan_history : []
        this.symbolMeta = updateCzscSymbolMeta(this.symbolMeta, this.watchlist)
      } catch (error) {
        this.watchlist = []
      } finally {
        this.loadingList = false
      }
    },
    async addCurrentSymbol () {
      this.saving = true
      try {
        const response = await addCzscWatchlistItem({
          symbol: this.symbol,
          name: this.symbolName(this.symbol),
          group: this.form.group || '默认',
          reason: this.form.reason,
          invalidation_condition: this.form.invalidation_condition,
          tags: [this.timeframe]
        })
        if (!response || response.code !== 1) throw new Error((response && response.msg) || this.$t('czsc.watchlistFailed'))
        this.$message.success(this.$t('czsc.watchlistAdded'))
        await this.loadWatchlist()
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.watchlistFailed'))
      } finally {
        this.saving = false
      }
    },
    async removeItem (item) {
      try {
        await removeCzscWatchlistItem({ symbol: item.symbol })
        await this.loadWatchlist()
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.watchlistFailed'))
      }
    },
    legacyConditions () {
      if (this.scanCondition === 'volume') return [{ factor: 'volume_expand', operator: 'truthy', value: true }]
      if (this.scanCondition === 'breakout') return [{ factor: 'breakout_high', operator: 'truthy', value: true }]
      return [{ factor: 'recent_return_pct', operator: 'gte', value: -1 }]
    },
    conditions () {
      return Array.isArray(this.signalFactorConditions) ? this.signalFactorConditions : this.legacyConditions()
    },
    async runScan () {
      this.scanning = true
      this.error = ''
      try {
        const response = await scanCzscWatchlist({
          timeframe: this.timeframe,
          limit: this.limit,
          logic: this.scanLogic,
          conditions: this.conditions()
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.watchlistScanFailed'))
        }
        this.result = response.data
        this.symbolMeta = updateCzscSymbolMeta(this.symbolMeta, response.data.results || [])
        this.persistScanState()
        await this.loadWatchlist()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.watchlistScanFailed')
      } finally {
        this.scanning = false
      }
    },
    topSignal (row) {
      return row && Array.isArray(row.signals) && row.signals.length ? row.signals[0] : null
    },
    topSignalLabel (row) {
      const signal = this.topSignal(row)
      return signal ? (signal.signal_type_label || signal.signal_type) : '-'
    },
    featureSummary (features) {
      if (!features) return ''
      return `MACD ${features.macd_cross || '-'} · VOL ${Number(features.volume_ratio || 0).toFixed(2)}x · MA ${features.ma_state || '-'}`
    },
    reviewable (row) {
      return Boolean(row && row.bar && this.topSignal(row))
    },
    prepare (row) {
      const signal = this.topSignal(row)
      if (!signal || !row.bar) return
      this.$emit('prepare-review', {
        symbol: row.symbol,
        name: this.symbolName(row),
        timeframe: this.timeframe,
        template_id: 'smart_watchlist_scan',
        bar: row.bar,
        action: signal.direction === 'bearish' ? 'close_long' : 'open_long',
        matched: true,
        matched_factor_zh: signal.signal_type_label || this.$t('czsc.smartWatchlist'),
        matched_factor_en: signal.signal_type || 'smart_watchlist',
        external_source: 'smart_watchlist',
        raw_payload: { row, scan_condition: this.scanCondition, logic: this.scanLogic, conditions: this.conditions() }
      })
    },
    symbolCode (value) {
      return czscSymbolCode(value)
    },
    symbolName (item) {
      return czscSymbolName(item, this.symbolMeta)
    },
    formatSymbolLabel (item) {
      return formatCzscSymbolLabel(item, this.symbolMeta)
    }
  }
}
</script>

<style scoped>
.research-panel { min-height: 620px; background: #fff; }
.watchlist-layout { display: grid; grid-template-columns: 330px minmax(0, 1fr); min-height: 620px; }
.watchlist-side { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-right: 1px solid #e5e7eb; background: #fbfbfc; }
.watchlist-main { min-width: 0; padding: 18px 20px 32px; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
.compact-head { margin-bottom: 2px; }
.panel-head h2 { margin: 0 0 4px; font-size: 15px; }
.panel-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.panel-actions { display: flex; align-items: center; gap: 10px; }
.watchlist-selector { margin-bottom: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.watchlist-items { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.watchlist-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 9px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; }
.watchlist-item strong, .watchlist-item span, .watchlist-item small { display: block; }
.watchlist-item span, .watchlist-item small, .ant-table small { color: #8c8c8c; font-size: 10px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); margin: 14px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.metric-grid > div { display: flex; min-height: 58px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.metric-grid span { color: #8c8c8c; font-size: 10px; }
.metric-grid strong { font-size: 16px; }
.row-actions { display: flex; gap: 4px; }
.theme-dark .research-panel, .theme-dark .watchlist-item { color: #e5e7eb; background: #171a20; }
.theme-dark .watchlist-side { border-color: #30343b; background: #1c2027; }
.theme-dark .watchlist-item, .theme-dark .metric-grid, .theme-dark .metric-grid > div { border-color: #30343b; }
@media (max-width: 960px) {
  .watchlist-layout { grid-template-columns: 1fr; }
  .watchlist-side { border-right: 0; border-bottom: 1px solid #e5e7eb; }
}
@media (max-width: 760px) {
  .panel-head, .panel-actions { flex-direction: column; align-items: stretch; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
