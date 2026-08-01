<template>
  <section class="research-panel factor-lab-panel">
    <div class="panel-head">
      <div>
        <h2>{{ $t('czsc.factorLab') }}</h2>
        <p>{{ $t('czsc.factorLabDesc') }}</p>
      </div>
      <div class="panel-actions">
        <a-button icon="reload" :loading="catalogLoading" @click="loadCatalog">{{ $t('czsc.factorCatalog') }}</a-button>
        <a-button type="primary" icon="experiment" :loading="loading" @click="runEvaluation">{{ $t('czsc.runFactorLab') }}</a-button>
      </div>
    </div>

    <div class="factor-picker">
      <a-checkbox-group v-model="selectedFactorIds" class="factor-options" @change="persistState">
        <a-checkbox v-for="factor in catalog" :key="factor.id" :value="factor.id">
          <strong>{{ factorName(factor) }}</strong>
          <small>{{ factor.category }} · {{ factorDesc(factor) }}</small>
        </a-checkbox>
      </a-checkbox-group>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.factorLabFailed')" :description="error" />

    <template v-if="result">
      <div class="metric-grid">
        <div><span>{{ $t('czsc.symbol') }}</span><strong>{{ formatSymbolLabel(result) }}</strong></div>
        <div><span>{{ $t('czsc.timeframe') }}</span><strong>{{ result.timeframe }}</strong></div>
        <div><span>{{ $t('czsc.factorCount') }}</span><strong>{{ result.factors.length }}</strong></div>
        <div><span>{{ $t('czsc.lastClose') }}</span><strong>{{ result.bar ? formatNumber(result.bar.close) : '-' }}</strong></div>
      </div>

      <a-table
        row-key="id"
        size="small"
        :columns="columns"
        :data-source="result.factors"
        :pagination="{ pageSize: 12, hideOnSinglePage: true }"
      >
        <template slot="name" slot-scope="value, row">
          <strong>{{ factorName(row) }}</strong>
          <small>{{ row.id }}</small>
        </template>
        <template slot="latest" slot-scope="value">{{ formatNumber(value) }}</template>
        <template slot="spark" slot-scope="value, row">
          <span class="sparkline">{{ sparkline(row.series) }}</span>
        </template>
        <template slot="explain" slot-scope="value, row">
          <span>{{ factorDesc(row) }}</span>
          <small>{{ riskTip(row) }}</small>
        </template>
      </a-table>

      <section class="enhanced-strip">
        <h3>{{ $t('czsc.enhancedSignals') }}</h3>
        <a-tag v-for="signal in result.enhanced_signals" :key="signal.id" :color="['bullish', 'bearish'].includes(signal.direction) ? $marketColor(signal.direction) : ''">
          {{ signal.signal_type_label || signal.signal_type }}
        </a-tag>
      </section>
    </template>
    <a-empty v-else :description="$t('czsc.noFactorLabResult')" />
  </section>
</template>

<script>
import { evaluateCzscFactors, getCzscFactorCatalog } from '@/api/czsc'
import { formatCzscSymbolLabel } from '@/utils/czscSymbols'

const STORAGE_KEY = 'quantdinger.czsc.factor-lab.v1'

export default {
  name: 'CzscFactorLabPanel',
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true },
    workbenchSymbolMeta: { type: Object, default: () => ({}) }
  },
  data () {
    return {
      catalog: [],
      selectedFactorIds: ['trend_close_ma20', 'trend_ma_alignment', 'momentum_macd_hist', 'volume_ratio20'],
      catalogLoading: false,
      loading: false,
      error: '',
      result: null,
      columns: [
        { title: this.$t('czsc.factor'), key: 'name', scopedSlots: { customRender: 'name' }, width: 230 },
        { title: this.$t('czsc.latestValue'), dataIndex: 'latest', key: 'latest', scopedSlots: { customRender: 'latest' }, width: 110 },
        { title: this.$t('czsc.factorTrend'), key: 'spark', scopedSlots: { customRender: 'spark' }, width: 170 },
        { title: this.$t('czsc.explanation'), key: 'explain', scopedSlots: { customRender: 'explain' } }
      ]
    }
  },
  computed: {
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    }
  },
  created () {
    this.restoreState()
    this.loadCatalog()
  },
  methods: {
    restoreState () {
      try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        if (Array.isArray(state.selectedFactorIds)) this.selectedFactorIds = state.selectedFactorIds
        if (state.result) this.result = state.result
      } catch (error) {}
    },
    persistState () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedFactorIds: this.selectedFactorIds, result: this.result }))
      } catch (error) {}
    },
    async loadCatalog () {
      this.catalogLoading = true
      try {
        const response = await getCzscFactorCatalog()
        const data = response && response.data ? response.data : {}
        this.catalog = Array.isArray(data.factors) ? data.factors : []
        if (!this.selectedFactorIds.length) this.selectedFactorIds = this.catalog.slice(0, 6).map(item => item.id)
      } catch (error) {
        this.catalog = []
      } finally {
        this.catalogLoading = false
      }
    },
    async runEvaluation () {
      this.loading = true
      this.error = ''
      try {
        const response = await evaluateCzscFactors({
          symbol: this.symbol,
          timeframe: this.timeframe,
          limit: this.limit,
          factor_ids: this.selectedFactorIds
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.factorLabFailed'))
        }
        this.result = response.data
        this.persistState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.factorLabFailed')
      } finally {
        this.loading = false
      }
    },
    factorName (factor) {
      return this.isChinese ? factor.name_zh : factor.name_en
    },
    factorDesc (factor) {
      return this.isChinese ? factor.explanation_zh : factor.explanation_en
    },
    riskTip (factor) {
      return this.isChinese ? factor.risk_tip_zh : factor.risk_tip_en
    },
    formatSymbolLabel (item) {
      return formatCzscSymbolLabel(item, this.workbenchSymbolMeta)
    },
    formatNumber (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(Math.abs(number) < 1 ? 4 : 2) : '-'
    },
    sparkline (series) {
      const values = (Array.isArray(series) ? series : []).map(item => Number(item.value)).filter(Number.isFinite).slice(-18)
      if (!values.length) return '-'
      const blocks = '▁▂▃▄▅▆▇█'
      const min = Math.min(...values)
      const max = Math.max(...values)
      const span = max - min || 1
      return values.map(value => blocks[Math.min(7, Math.max(0, Math.round(((value - min) / span) * 7)))]).join('')
    }
  }
}
</script>

<style scoped>
.research-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
.panel-head h2 { margin: 0 0 4px; font-size: 15px; }
.panel-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.panel-actions { display: flex; align-items: center; gap: 8px; }
.factor-picker { max-height: 220px; margin-bottom: 16px; overflow: auto; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfbfc; }
.factor-options { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.factor-options >>> .ant-checkbox-wrapper { display: flex; min-height: 58px; margin-left: 0; padding: 8px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; }
.factor-options strong, .factor-options small, .ant-table small { display: block; margin-left: 4px; }
.factor-options strong { color: #262626; font-size: 12px; }
.factor-options small, .ant-table small { color: #8c8c8c; font-size: 10px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); margin: 14px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.metric-grid > div { display: flex; min-height: 58px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.metric-grid span { color: #8c8c8c; font-size: 10px; }
.metric-grid strong { font-size: 16px; }
.sparkline { color: #08979c; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1px; }
.enhanced-strip { margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
.enhanced-strip h3 { margin: 0 0 8px; font-size: 13px; }
.theme-dark .research-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .factor-picker, .theme-dark .factor-options >>> .ant-checkbox-wrapper { border-color: #30343b; background: #1c2027; }
.theme-dark .factor-options strong { color: #f3f4f6; }
.theme-dark .metric-grid, .theme-dark .metric-grid > div, .theme-dark .enhanced-strip { border-color: #30343b; }
@media (max-width: 760px) {
  .panel-head, .panel-actions { flex-direction: column; align-items: stretch; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
