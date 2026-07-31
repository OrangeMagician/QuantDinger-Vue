<template>
  <section class="research-panel dashboard-panel">
    <div class="panel-head">
      <div>
        <h2>{{ $t('czsc.operationCockpit') }}</h2>
        <p>{{ $t('czsc.operationCockpitDesc') }}</p>
      </div>
      <div class="panel-actions">
        <a-textarea v-model="symbolsText" :rows="2" :placeholder="$t('czsc.scanPlaceholder')" @change="persistState" />
        <a-button type="primary" icon="dashboard" :loading="loading" @click="loadDashboard">{{ $t('czsc.refreshCockpit') }}</a-button>
        <div class="selected-symbols-preview">
          <a-tag v-for="item in selectedSymbolItems" :key="item.symbol">{{ formatSymbolLabel(item) }}</a-tag>
        </div>
      </div>
    </div>

    <a-alert
      class="manual-boundary"
      type="warning"
      show-icon
      :message="$t('czsc.manualReviewOnly')"
      :description="$t('czsc.noBrokerOrder')"
    />
    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.cockpitFailed')" :description="error" />

    <template v-if="result">
      <div class="metric-grid">
        <div><span>{{ $t('czsc.todaySignalCount') }}</span><strong>{{ result.summary.today_signal_count }}</strong></div>
        <div><span>{{ $t('czsc.highScoreCount') }}</span><strong>{{ result.summary.high_score_count }}</strong></div>
        <div><span>{{ $t('czsc.pendingReview') }}</span><strong class="warning">{{ result.summary.pending_review_count }}</strong></div>
        <div><span>{{ $t('czsc.blockedCount') }}</span><strong class="negative">{{ result.summary.blocked_count }}</strong></div>
        <div><span>{{ $t('czsc.confirmedCount') }}</span><strong>{{ result.summary.confirmed_count }}</strong></div>
      </div>

      <div class="cockpit-grid">
        <section>
          <h3>{{ $t('czsc.topCandidates') }}</h3>
          <a-table
            row-key="symbol"
            size="small"
            :columns="candidateColumns"
            :data-source="result.top_candidates"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          >
            <template slot="symbol" slot-scope="value, row"><strong>{{ symbolCode(value) }}</strong><small>{{ symbolName(row) }}</small></template>
            <template slot="score" slot-scope="value"><a-tag :color="Number(value) >= 70 ? 'green' : 'blue'">{{ Number(value || 0).toFixed(1) }}</a-tag></template>
            <template slot="signal" slot-scope="value, row">{{ topSignalLabel(row) }}</template>
            <template slot="operation" slot-scope="value, row">
              <div class="row-actions">
                <a-button size="small" icon="line-chart" @click="$emit('view-chart', row)" />
                <a-button size="small" icon="fund" @click="$emit('backtest-row', row)" />
                <a-button size="small" icon="audit" :disabled="!reviewable(row)" @click="prepare(row)" />
              </div>
            </template>
          </a-table>
        </section>

        <section>
          <h3>{{ $t('czsc.retraqReviewStates') }}</h3>
          <div class="review-columns">
            <article v-for="group in reviewGroups" :key="group.key" class="review-group">
              <header><strong>{{ group.label }}</strong><a-tag>{{ group.rows.length }}</a-tag></header>
              <div v-for="item in group.rows" :key="item.signal_id" class="review-row">
                <strong>{{ formatSymbolLabel(item) }}</strong>
                <span>{{ item.status }} · {{ item.signal_id }}</span>
              </div>
              <a-empty v-if="!group.rows.length" :description="$t('czsc.none')" />
            </article>
          </div>
        </section>
      </div>

      <section class="resonance-strip">
        <h3>{{ $t('czsc.multiPeriodCenter') }}</h3>
        <article v-for="item in result.multi_period" :key="item.symbol" class="resonance-card">
          <strong>{{ formatSymbolLabel(item) }}</strong>
          <a-tag :color="['bullish', 'bearish'].includes(item.summary.direction) ? $marketColor(item.summary.direction) : ''">
            {{ item.summary.direction }}
          </a-tag>
          <span>{{ item.resonance_signal && item.resonance_signal.explanation }}</span>
        </article>
      </section>
    </template>
    <a-empty v-else :description="$t('czsc.noCockpitResult')" />
  </section>
</template>

<script>
import { getCzscDashboard } from '@/api/czsc'
import {
  czscSymbolCode,
  czscSymbolDisplayItem,
  czscSymbolName,
  defaultCzscSymbolText,
  formatCzscSymbolLabel,
  formatCzscSymbolText,
  normalizeCzscSymbol,
  parseCzscSymbolList,
  updateCzscSymbolMeta
} from '@/utils/czscSymbols'

const STORAGE_KEY = 'quantdinger.czsc.cockpit.v1'

export default {
  name: 'CzscDashboardPanel',
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true }
  },
  data () {
    return {
      symbolsText: defaultCzscSymbolText(4),
      loading: false,
      error: '',
      result: null,
      symbolMeta: updateCzscSymbolMeta(),
      candidateColumns: [
        { title: this.$t('czsc.symbol'), dataIndex: 'symbol', key: 'symbol', scopedSlots: { customRender: 'symbol' }, width: 150 },
        { title: this.$t('czsc.score'), dataIndex: 'score', key: 'score', scopedSlots: { customRender: 'score' }, width: 90 },
        { title: this.$t('czsc.matchedFactor'), key: 'signal', scopedSlots: { customRender: 'signal' } },
        { title: '', key: 'operation', scopedSlots: { customRender: 'operation' }, width: 130 }
      ]
    }
  },
  computed: {
    selectedSymbolItems () {
      return this.parsedSymbols().map(symbol => czscSymbolDisplayItem(this.symbolMeta[symbol] || symbol, this.symbolMeta))
    },
    reviewGroups () {
      const retraq = (this.result && this.result.retraq) || {}
      return [
        { key: 'pending', label: this.$t('czsc.pendingReview'), rows: retraq.pending || [] },
        { key: 'blocked', label: this.$t('czsc.blockedCount'), rows: retraq.blocked || [] },
        { key: 'confirmed', label: this.$t('czsc.confirmedCount'), rows: retraq.confirmed || [] }
      ]
    }
  },
  created () {
    this.restoreState()
  },
  methods: {
    restoreState () {
      try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        if (state.symbolsText) this.symbolsText = formatCzscSymbolText(state.symbolsText)
        if (state.result) {
          this.result = state.result
          this.updateResultSymbolMeta(state.result)
        }
      } catch (error) {}
    },
    persistState () {
      try {
        const symbolsText = formatCzscSymbolText(this.symbolsText)
        if (symbolsText) this.symbolsText = symbolsText
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ symbolsText: this.symbolsText, result: this.result }))
      } catch (error) {}
    },
    parsedSymbols () {
      return parseCzscSymbolList(this.symbolsText || this.symbol).slice(0, 50)
    },
    normalizeSymbol (value) {
      return normalizeCzscSymbol(value)
    },
    symbolCode (value) {
      return czscSymbolCode(value)
    },
    symbolName (item) {
      return czscSymbolName(item, this.symbolMeta)
    },
    formatSymbolLabel (item) {
      return formatCzscSymbolLabel(item, this.symbolMeta)
    },
    updateResultSymbolMeta (result) {
      const retraq = (result && result.retraq) || {}
      this.symbolMeta = updateCzscSymbolMeta(this.symbolMeta, [
        ...((result && result.top_candidates) || []),
        ...((result && result.multi_period) || []),
        ...(retraq.pending || []),
        ...(retraq.blocked || []),
        ...(retraq.confirmed || [])
      ])
    },
    async loadDashboard () {
      const symbols = this.parsedSymbols()
      if (!symbols.length) return
      this.loading = true
      this.error = ''
      try {
        const response = await getCzscDashboard({
          symbols,
          timeframe: this.timeframe,
          limit: this.limit
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.cockpitFailed'))
        }
        this.result = response.data
        this.updateResultSymbolMeta(response.data)
        this.persistState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.cockpitFailed')
      } finally {
        this.loading = false
      }
    },
    topSignal (row) {
      return row && Array.isArray(row.signals) && row.signals.length ? row.signals[0] : null
    },
    topSignalLabel (row) {
      const signal = this.topSignal(row)
      return signal ? (signal.signal_type_label || signal.signal_type) : '-'
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
        template_id: 'operation_cockpit',
        bar: row.bar,
        action: signal.direction === 'bearish' ? 'close_long' : 'open_long',
        matched: true,
        matched_factor_zh: signal.signal_type_label || this.$t('czsc.operationCockpit'),
        matched_factor_en: signal.signal_type || 'operation_cockpit',
        external_source: 'operation_cockpit',
        raw_payload: row
      })
    }
  }
}
</script>

<style scoped>
.research-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
.panel-head h2 { margin: 0 0 4px; font-size: 15px; }
.panel-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.panel-actions { display: grid; grid-template-columns: minmax(260px, 430px) auto; align-items: start; gap: 10px; }
.selected-symbols-preview { display: flex; flex-wrap: wrap; grid-column: 1 / -1; gap: 5px; }
.manual-boundary { margin-bottom: 12px; }
.metric-grid { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); margin: 14px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.metric-grid > div { display: flex; min-height: 62px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.metric-grid span { color: #8c8c8c; font-size: 10px; }
.metric-grid strong { font-size: 17px; }
.warning { color: #d48806; }
.negative { color: #fa541c; }
.cockpit-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr); gap: 24px; }
.cockpit-grid h3, .resonance-strip h3 { margin: 0 0 10px; font-size: 13px; }
.ant-table small { display: block; color: #8c8c8c; font-size: 10px; }
.row-actions { display: flex; gap: 4px; }
.review-columns { display: grid; grid-template-columns: 1fr; gap: 10px; }
.review-group { padding: 10px; border: 1px solid #eceef1; border-radius: 8px; background: #fbfbfc; }
.review-group header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.review-row { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 8px; padding: 7px 0; border-top: 1px solid #eceef1; font-size: 11px; }
.review-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-row span { overflow: hidden; color: #8c8c8c; text-overflow: ellipsis; white-space: nowrap; }
.resonance-strip { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
.resonance-card { display: grid; grid-template-columns: 140px 80px minmax(0, 1fr); gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid #eceef1; font-size: 12px; }
.resonance-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resonance-card span { overflow: hidden; color: #595959; text-overflow: ellipsis; white-space: nowrap; }
.theme-dark .research-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .metric-grid, .theme-dark .metric-grid > div, .theme-dark .review-group, .theme-dark .review-row, .theme-dark .resonance-strip, .theme-dark .resonance-card { border-color: #30343b; }
.theme-dark .review-group { background: #1c2027; }
@media (max-width: 980px) {
  .cockpit-grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .panel-head { flex-direction: column; }
  .panel-actions { grid-template-columns: 1fr; width: 100%; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .resonance-card { grid-template-columns: 1fr; }
}
</style>
