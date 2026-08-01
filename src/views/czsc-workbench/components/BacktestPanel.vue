<template>
  <section class="backtest-panel">
    <div class="backtest-controls">
      <label class="field template-field">
        <span>{{ $t('czsc.template') }}</span>
        <a-select :value="templateId" @change="$emit('update:templateId', $event)">
          <a-select-option v-for="item in templates" :key="item.id" :value="item.id">
            {{ templateName(item) }}
          </a-select-option>
        </a-select>
      </label>
      <label class="field cash-field">
        <span>{{ $t('czsc.initialCash') }}</span>
        <a-input-number v-model="initialCash" :min="10000" :max="1000000000" :step="100000" />
      </label>
      <label class="field bars-field">
        <span>{{ $t('czsc.backtestBars') }}</span>
        <a-select v-model="backtestLimit">
          <a-select-option v-for="value in [500, 1000, 2000, 5000]" :key="value" :value="value">{{ value }}</a-select-option>
        </a-select>
      </label>
      <a-button type="primary" icon="fund" :loading="loading" @click="runBacktest">
        {{ $t('czsc.runBacktest') }}
      </a-button>
    </div>

    <div class="history-bar">
      <label class="field history-field">
        <span>{{ $t('czsc.backtestHistory') }}</span>
        <a-select :value="result ? result.run_id : undefined" :placeholder="$t('czsc.noHistory')" @change="restoreHistory">
          <a-select-option v-for="item in history" :key="item.run_id" :value="item.run_id">
            {{ historyLabel(item) }}
          </a-select-option>
        </a-select>
      </label>
      <a-tooltip :title="$t('czsc.exportResult')">
        <a-button icon="download" :disabled="!result" :aria-label="$t('czsc.exportResult')" @click="exportResult" />
      </a-tooltip>
      <a-popconfirm :title="$t('czsc.deleteResultConfirm')" @confirm="deleteResult">
        <a-tooltip :title="$t('czsc.deleteResult')">
          <a-button icon="delete" :disabled="!result" :aria-label="$t('czsc.deleteResult')" />
        </a-tooltip>
      </a-popconfirm>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.backtestFailed')" :description="error" />

    <template v-if="result">
      <div class="metric-grid">
        <div><span>{{ $t('czsc.totalReturn') }}</span><strong :class="returnClass(result.metrics.total_return)">{{ percent(result.metrics.total_return) }}</strong></div>
        <div><span>{{ $t('czsc.benchmarkReturn') }}</span><strong :class="returnClass(result.metrics.benchmark_return)">{{ percent(result.metrics.benchmark_return) }}</strong></div>
        <div><span>{{ $t('czsc.maxDrawdown') }}</span><strong class="negative">{{ percent(result.metrics.max_drawdown) }}</strong></div>
        <div><span>{{ $t('czsc.completedTrades') }}</span><strong>{{ result.metrics.completed_trades }}</strong></div>
        <div><span>{{ $t('czsc.winRate') }}</span><strong>{{ percent(result.metrics.win_rate) }}</strong></div>
        <div><span>{{ $t('czsc.finalEquity') }}</span><strong>{{ money(result.metrics.final_equity) }}</strong></div>
      </div>

      <div class="assumption-strip">
        <span>{{ $t('czsc.nextOpen') }}</span>
        <span>{{ $t('czsc.longOnly') }}</span>
        <span>{{ $t('czsc.tPlusOne') }}</span>
        <span>{{ $t('czsc.lotHundred') }}</span>
      </div>

      <section class="equity-region">
        <h3>{{ $t('czsc.equityCurve') }}</h3>
        <equity-chart :curve="result.equity_curve" :dark="dark" />
      </section>

      <section class="trade-region">
        <h3>{{ $t('czsc.tradeDetails') }}</h3>
        <a-table
          row-key="exit_datetime"
          size="small"
          :columns="tradeColumns"
          :data-source="result.trades"
          :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          :scroll="{ x: 700 }"
        >
          <template slot="datetime" slot-scope="value">{{ formatDate(value) }}</template>
          <template slot="price" slot-scope="value">{{ Number(value).toFixed(2) }}</template>
          <template slot="pnl" slot-scope="value"><span :class="returnClass(value)">{{ money(value) }}</span></template>
          <template slot="return" slot-scope="value"><span :class="returnClass(value)">{{ percent(value) }}</span></template>
        </a-table>
      </section>
    </template>

    <a-empty v-else :description="$t('czsc.noBacktestResult')" />
  </section>
</template>

<script>
import { backtestCzsc } from '@/api/czsc'
import { formatCzscSymbolLabel } from '@/utils/czscSymbols'
import EquityChart from './EquityChart.vue'

const STORAGE_KEY = 'quantdinger.czsc.backtests.v1'

export default {
  name: 'CzscBacktestPanel',
  components: { EquityChart },
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    templates: { type: Array, default: () => [] },
    templateId: { type: String, required: true },
    dark: { type: Boolean, default: false }
  },
  data () {
    return {
      initialCash: 1000000,
      backtestLimit: 2000,
      loading: false,
      error: '',
      result: null,
      history: [],
      tradeColumns: [
        { title: this.$t('czsc.entryTime'), dataIndex: 'entry_datetime', key: 'entry_datetime', scopedSlots: { customRender: 'datetime' }, width: 150 },
        { title: this.$t('czsc.exitTime'), dataIndex: 'exit_datetime', key: 'exit_datetime', scopedSlots: { customRender: 'datetime' }, width: 150 },
        { title: this.$t('czsc.quantity'), dataIndex: 'quantity', key: 'quantity', width: 90 },
        { title: this.$t('czsc.entryPrice'), dataIndex: 'entry_price', key: 'entry_price', scopedSlots: { customRender: 'price' }, width: 90 },
        { title: this.$t('czsc.exitPrice'), dataIndex: 'exit_price', key: 'exit_price', scopedSlots: { customRender: 'price' }, width: 90 },
        { title: this.$t('czsc.pnl'), dataIndex: 'pnl', key: 'pnl', scopedSlots: { customRender: 'pnl' }, width: 110 },
        { title: this.$t('czsc.return'), dataIndex: 'return', key: 'return', scopedSlots: { customRender: 'return' }, width: 90 }
      ]
    }
  },
  computed: {
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    }
  },
  created () {
    this.loadHistory()
  },
  methods: {
    async runBacktest () {
      this.loading = true
      this.error = ''
      try {
        const response = await backtestCzsc({
          symbol: this.symbol,
          timeframe: this.timeframe,
          template_id: this.templateId,
          limit: this.backtestLimit,
          initial_cash: this.initialCash
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.backtestFailed'))
        }
        this.result = response.data
        this.saveResult(response.data)
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.backtestFailed')
      } finally {
        this.loading = false
      }
    },
    compactResult (result) {
      const curve = Array.isArray(result.equity_curve) ? result.equity_curve : []
      const step = Math.max(1, Math.ceil(curve.length / 600))
      return {
        ...result,
        equity_curve: curve.filter((item, index) => index % step === 0 || index === curve.length - 1),
        signal_events: (result.signal_events || []).slice(-200)
      }
    },
    saveResult (result) {
      const compact = this.compactResult(result)
      this.history = [compact, ...this.history.filter(item => item.run_id !== compact.run_id)].slice(0, 8)
      this.persistHistory()
    },
    loadHistory () {
      try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        this.history = Array.isArray(value) ? value : []
      } catch (error) {
        this.history = []
      }
    },
    persistHistory () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history))
      } catch (error) {
        this.$message.warning(this.$t('czsc.historySaveFailed'))
      }
    },
    restoreHistory (runId) {
      this.result = this.history.find(item => item.run_id === runId) || null
    },
    deleteResult () {
      if (!this.result) return
      this.history = this.history.filter(item => item.run_id !== this.result.run_id)
      this.result = this.history[0] || null
      this.persistHistory()
    },
    exportResult () {
      if (!this.result) return
      const blob = new Blob([JSON.stringify(this.result, null, 2)], { type: 'application/json;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${this.result.run_id}.json`
      link.click()
      URL.revokeObjectURL(link.href)
    },
    historyLabel (item) {
      const name = this.isChinese ? item.template.name_zh : item.template.name_en
      return `${formatCzscSymbolLabel(item)} · ${name} · ${this.percent(item.metrics.total_return)}`
    },
    templateName (item) {
      return this.isChinese ? item.name_zh : item.name_en
    },
    percent (value) {
      const number = Number(value)
      return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
    },
    money (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'
    },
    returnClass (value) {
      const number = Number(value)
      return number > 0 ? 'positive' : number < 0 ? 'negative' : ''
    },
    formatDate (value) {
      return String(value || '').replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.backtest-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.backtest-controls { display: grid; grid-template-columns: minmax(240px, 1fr) 160px 110px auto; gap: 12px; align-items: end; }
.field { display: flex; min-width: 0; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.cash-field .ant-input-number { width: 100%; }
.history-bar { display: flex; align-items: flex-end; gap: 8px; margin: 16px 0; padding: 12px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.history-field { width: min(520px, 100%); margin-right: auto; }
.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(100px, 1fr)); border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.metric-grid > div { display: flex; min-height: 68px; flex-direction: column; justify-content: center; padding: 8px 12px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.metric-grid span { color: #8c8c8c; font-size: 10px; }
.metric-grid strong { margin-top: 3px; font-size: 17px; font-variant-numeric: tabular-nums; }
.positive { color: var(--market-rise-color); }
.negative { color: var(--market-fall-color); }
.assumption-strip { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 10px 2px; color: #595959; font-size: 11px; }
.assumption-strip span::before { display: inline-block; width: 5px; height: 5px; margin-right: 6px; border-radius: 50%; background: #08979c; content: ''; vertical-align: 1px; }
.equity-region, .trade-region { margin-top: 20px; }
.equity-region h3, .trade-region h3 { margin: 0 0 8px; font-size: 13px; letter-spacing: 0; }
.theme-dark .backtest-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .field,
.theme-dark .equity-region h3,
.theme-dark .trade-region h3 { color: #c5cad3; }
.theme-dark .history-bar, .theme-dark .metric-grid, .theme-dark .metric-grid > div { border-color: #30343b; }
.theme-dark .assumption-strip { color: #c5cad3; }
@media (max-width: 900px) {
  .backtest-controls { grid-template-columns: 1fr 1fr; }
  .template-field { grid-column: 1 / -1; }
  .metric-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 560px) {
  .backtest-panel { padding: 14px 12px 24px; }
  .backtest-controls { grid-template-columns: 1fr; }
  .template-field { grid-column: auto; }
  .history-bar { flex-wrap: wrap; }
  .history-field { width: 100%; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
