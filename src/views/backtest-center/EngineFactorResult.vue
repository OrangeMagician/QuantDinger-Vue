<template>
  <div class="engine-factor-result" :class="{ 'theme-dark': isDark }">
    <div class="result-toolbar">
      <div>
        <h3>{{ isQuality ? $t('unifiedFactor.qualityTitle') : $t('unifiedFactor.experimentTitle') }}</h3>
        <span>{{ result.symbol }} · {{ String(result.timeframe || '').toUpperCase() }}</span>
      </div>
      <div class="provenance-tags">
        <a-tag color="green">{{ engineLabel }}</a-tag>
        <a-tag>{{ datasetLabel }}</a-tag>
      </div>
    </div>

    <div class="metrics-grid">
      <div v-for="item in metrics" :key="item.key" class="metric-card">
        <span>{{ item.label }}</span>
        <strong :class="item.tone">{{ item.value }}</strong>
      </div>
    </div>

    <section v-if="chartSeries.length" class="chart-panel">
      <div class="section-heading">
        <div>
          <h4>{{ isQuality ? $t('unifiedFactor.decayChart') : $t('unifiedFactor.factorSeries') }}</h4>
          <span>{{ isQuality ? $t('unifiedFactor.decayHint') : $t('unifiedFactor.seriesHint') }}</span>
        </div>
      </div>
      <div ref="chart" class="result-chart" />
    </section>

    <a-tabs class="detail-tabs" default-active-key="detail">
      <a-tab-pane key="detail" :tab="isQuality ? $t('unifiedFactor.qualityMetrics') : $t('unifiedFactor.factorDetails')">
        <a-table
          v-if="isQuality"
          row-key="signal_type"
          size="small"
          :columns="qualityColumns"
          :data-source="result.metrics || []"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 980 }" />
        <a-table
          v-else
          row-key="id"
          size="small"
          :columns="factorColumns"
          :data-source="result.factors || []"
          :pagination="false"
          :scroll="{ x: 900 }" />
      </a-tab-pane>
      <a-tab-pane v-if="isQuality" key="events" :tab="$t('unifiedFactor.recentEvents')">
        <a-table
          row-key="eventKey"
          size="small"
          :columns="eventColumns"
          :data-source="recentEvents"
          :pagination="{ pageSize: 12 }"
          :scroll="{ x: 850 }" />
      </a-tab-pane>
      <a-tab-pane v-else key="signals" :tab="$t('unifiedFactor.relatedSignals')">
        <a-table
          row-key="signal_type"
          size="small"
          :columns="signalColumns"
          :data-source="result.enhanced_signals || []"
          :pagination="false"
          :scroll="{ x: 760 }" />
      </a-tab-pane>
      <a-tab-pane key="provenance" :tab="$t('unifiedFactor.provenance')">
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item :label="$t('unifiedFactor.engine')">{{ engineLabel }}</a-descriptions-item>
          <a-descriptions-item :label="$t('unifiedFactor.dataset')">{{ datasetLabel }}</a-descriptions-item>
          <a-descriptions-item :label="$t('unifiedFactor.resultId')">{{ result.resultId || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('unifiedFactor.taskId')">{{ result.taskId || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('unifiedFactor.generatedAt')">{{ formatDate(result.generated_at) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('unifiedFactor.readOnly')">{{ result.read_only ? $t('common.yes') : $t('common.no') }}</a-descriptions-item>
        </a-descriptions>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import moment from 'moment'
import { marketPalette } from '@/utils/marketColors'

export default {
  name: 'EngineFactorResult',
  props: {
    result: { type: Object, required: true },
    isDark: { type: Boolean, default: false }
  },
  data () {
    return { chart: null, resizeObserver: null }
  },
  computed: {
    isQuality () { return this.result.researchType === 'quality' },
    engineLabel () {
      const engine = this.result.engine || {}
      const name = String(engine.name || 'czsc').toLowerCase() === 'czsc' ? 'CZSC' : engine.name
      return [name, engine.version].filter(Boolean).join(' ')
    },
    datasetLabel () {
      const snapshot = this.result.datasetSnapshot || {}
      return snapshot.version || snapshot.provider || '-'
    },
    primaryFactor () { return (this.result.factors || [])[0] || {} },
    qualitySummary () { return this.result.summary || {} },
    metrics () {
      if (this.isQuality) {
        const rows = this.result.metrics || []
        const best = rows[0] || {}
        return [
          { key: 'types', label: this.$t('unifiedFactor.signalTypes'), value: this.qualitySummary.signal_types || rows.length, tone: '' },
          { key: 'samples', label: this.$t('unifiedFactor.samples'), value: this.qualitySummary.sample_count || 0, tone: '' },
          { key: 'best', label: this.$t('unifiedFactor.bestSignal'), value: this.qualitySummary.best_signal_type || '-', tone: '' },
          { key: 'score', label: this.$t('unifiedFactor.bestScore'), value: this.formatNumber(this.qualitySummary.best_quality_score, 2), tone: 'positive' },
          { key: 'win', label: this.$t('unifiedFactor.winRate'), value: this.formatRate(best.win_rate), tone: this.tone(best.win_rate - 0.5) },
          { key: 'return', label: this.$t('unifiedFactor.forwardReturn'), value: this.formatRate(best.avg_forward_return), tone: this.tone(best.avg_forward_return) }
        ]
      }
      return [
        { key: 'count', label: this.$t('unifiedFactor.factorCount'), value: (this.result.factors || []).length, tone: '' },
        { key: 'latest', label: this.$t('unifiedFactor.latestValue'), value: this.formatNumber(this.primaryFactor.latest, 4), tone: this.tone(this.primaryFactor.latest) },
        { key: 'points', label: this.$t('unifiedFactor.points'), value: (this.primaryFactor.series || []).length, tone: '' },
        { key: 'category', label: this.$t('unifiedFactor.category'), value: this.primaryFactor.category || '-', tone: '' },
        { key: 'signals', label: this.$t('unifiedFactor.relatedSignals'), value: (this.result.enhanced_signals || []).length, tone: '' },
        { key: 'bars', label: this.$t('unifiedFactor.latestBar'), value: this.formatDate(this.result.bar && this.result.bar.datetime), tone: '' }
      ]
    },
    chartSeries () {
      if (!this.isQuality) {
        return (this.result.factors || []).map(item => ({
          name: item.name_zh || item.name_en || item.id,
          type: 'line',
          showSymbol: false,
          data: (item.series || []).filter(point => point.value != null).map(point => [Number(point.timestamp), Number(point.value)])
        }))
      }
      return (this.result.metrics || []).slice(0, 6).map(item => ({
        name: item.signal_type,
        type: 'line',
        showSymbol: true,
        data: Object.entries(item.decay_curve || {}).map(([key, value]) => [Number(key.replace('forward_', '')), Number(value)])
      }))
    },
    qualityColumns () {
      return [
        { title: this.$t('unifiedFactor.signalType'), dataIndex: 'signal_type', width: 180 },
        { title: this.$t('unifiedFactor.qualityScore'), dataIndex: 'quality_score', width: 110, customRender: value => this.numberCell(value, 2) },
        { title: this.$t('unifiedFactor.samples'), dataIndex: 'sample_count', width: 90 },
        { title: this.$t('unifiedFactor.winRate'), dataIndex: 'win_rate', width: 100, customRender: this.rateCell },
        { title: this.$t('unifiedFactor.profitLossRatio'), dataIndex: 'profit_loss_ratio', width: 120, customRender: value => this.numberCell(value, 3) },
        { title: this.$t('unifiedFactor.forwardReturn'), dataIndex: 'avg_forward_return', width: 120, customRender: this.rateCell },
        { title: this.$t('unifiedFactor.falseBreakout'), dataIndex: 'false_breakout_rate', width: 120, customRender: this.rateCell }
      ]
    },
    factorColumns () {
      return [
        { title: this.$t('unifiedFactor.factor'), dataIndex: 'name_zh', width: 180, customRender: (value, row) => value || row.name_en || row.id },
        { title: this.$t('unifiedFactor.category'), dataIndex: 'category', width: 120 },
        { title: this.$t('unifiedFactor.latestValue'), dataIndex: 'latest', width: 120, customRender: value => this.numberCell(value, 4) },
        { title: this.$t('unifiedFactor.explanation'), dataIndex: 'explanation_zh', customRender: (value, row) => value || row.explanation_en || '-' },
        { title: this.$t('unifiedFactor.riskTip'), dataIndex: 'risk_tip_zh', customRender: (value, row) => value || row.risk_tip_en || '-' }
      ]
    },
    recentEvents () {
      return (this.result.metrics || []).flatMap(metric => (metric.recent_events || []).map((event, index) => ({
        ...event,
        eventKey: `${metric.signal_type}-${event.datetime}-${index}`,
        signal_type: metric.signal_type,
        forward_return: event.returns && (event.returns.forward_10 !== undefined ? event.returns.forward_10 : Object.values(event.returns)[0])
      })))
    },
    eventColumns () {
      return [
        { title: this.$t('unifiedFactor.time'), dataIndex: 'datetime', width: 170, customRender: this.formatDate },
        { title: this.$t('unifiedFactor.signalType'), dataIndex: 'signal_type', width: 180 },
        { title: this.$t('unifiedFactor.direction'), dataIndex: 'direction', width: 100 },
        { title: this.$t('unifiedFactor.confidence'), dataIndex: 'confidence', width: 110, customRender: this.rateCell },
        { title: this.$t('unifiedFactor.forwardReturn'), dataIndex: 'forward_return', width: 130, customRender: this.rateCell },
        { title: this.$t('unifiedFactor.score'), dataIndex: 'score', width: 90 }
      ]
    },
    signalColumns () {
      return [
        { title: this.$t('unifiedFactor.signalType'), dataIndex: 'signal_type', width: 180 },
        { title: this.$t('unifiedFactor.direction'), dataIndex: 'direction', width: 100 },
        { title: this.$t('unifiedFactor.confidence'), dataIndex: 'confidence', width: 110, customRender: this.rateCell },
        { title: this.$t('unifiedFactor.explanation'), dataIndex: 'explanation' },
        { title: this.$t('unifiedFactor.riskTip'), dataIndex: 'risk_tip' }
      ]
    }
  },
  watch: {
    result: { deep: true, handler () { this.$nextTick(this.renderChart) } },
    isDark () { this.$nextTick(this.renderChart) }
  },
  mounted () {
    this.renderChart()
    window.addEventListener('resize', this.resizeChart)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.resizeChart)
    if (this.resizeObserver) this.resizeObserver.disconnect()
    if (this.chart) this.chart.dispose()
  },
  methods: {
    renderChart () {
      if (!this.$refs.chart || !this.chartSeries.length) return
      if (!this.chart) {
        this.chart = echarts.init(this.$refs.chart)
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(this.resizeChart)
          this.resizeObserver.observe(this.$refs.chart)
        }
      }
      const text = this.isDark ? '#a3a3a3' : '#64748b'
      const grid = this.isDark ? '#2b2b2b' : '#e5e7eb'
      const market = marketPalette(this.isDark, this.$store.state.app.marketColorConvention)
      this.chart.setOption({
        animationDuration: 220,
        color: [market.rise, '#1677ff', '#faad14', '#722ed1', market.fall, '#13c2c2'],
        tooltip: { trigger: 'axis', confine: true },
        legend: { top: 0, textStyle: { color: text } },
        grid: { left: 60, right: 28, top: 42, bottom: 52 },
        xAxis: this.isQuality
          ? { type: 'value', name: this.$t('unifiedFactor.forwardBars'), axisLabel: { color: text }, splitLine: { lineStyle: { color: grid } } }
          : { type: 'time', axisLabel: { color: text }, splitLine: { show: false } },
        yAxis: { type: 'value', scale: true, axisLabel: { color: text }, splitLine: { lineStyle: { color: grid, type: 'dashed' } } },
        dataZoom: this.isQuality ? [] : [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 8, showDetail: false }],
        series: this.chartSeries
      }, true)
    },
    resizeChart () { if (this.chart) this.chart.resize() },
    tone (value) { const number = Number(value || 0); return number > 0 ? 'positive' : number < 0 ? 'negative' : '' },
    formatNumber (value, digits = 2) { const number = Number(value); return Number.isFinite(number) ? number.toFixed(digits) : '-' },
    formatRate (value) { const number = Number(value); return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-' },
    formatDate (value) { return value ? moment(value).format('YYYY-MM-DD HH:mm') : '-' },
    numberCell (value, digits) { return this.$createElement('span', { class: this.tone(value) }, this.formatNumber(value, digits)) },
    rateCell (value) { return this.$createElement('span', { class: this.tone(value) }, this.formatRate(value)) }
  }
}
</script>

<style lang="less" scoped>
.engine-factor-result { color: #1f2937; }
.result-toolbar, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.result-toolbar h3, .section-heading h4 { margin: 0; font-size: 15px; }
.result-toolbar span, .section-heading span { color: #7c8798; font-size: 12px; }
.provenance-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; }
.metrics-grid { display: grid; grid-template-columns: repeat(6, minmax(105px, 1fr)); gap: 8px; margin-top: 12px; }
.metric-card { display: flex; min-height: 72px; flex-direction: column; justify-content: space-between; padding: 11px; border: 1px solid #e8ebef; border-radius: 7px; background: #f8fafc; }
.metric-card span { color: #7c8798; font-size: 11px; }
.metric-card strong { overflow-wrap: anywhere; color: #25364d; font-size: 17px; }
.positive { color: var(--market-rise-color) !important; }.negative { color: var(--market-fall-color) !important; }
.chart-panel { margin-top: 12px; padding: 12px; border: 1px solid #e8ebef; border-radius: 7px; }
.result-chart { width: 100%; height: 390px; }
.detail-tabs { margin-top: 10px; }
.theme-dark { color: #e5e7eb; }
.theme-dark .metric-card { border-color: #303030; background: #101010; }
.theme-dark .metric-card strong, .theme-dark .result-toolbar h3, .theme-dark .section-heading h4 { color: #e5e7eb; }
.theme-dark .chart-panel { border-color: #303030; }
@media (max-width: 1400px) { .metrics-grid { grid-template-columns: repeat(3, minmax(105px, 1fr)); } }
@media (max-width: 720px) { .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.result-toolbar { flex-direction: column; }.provenance-tags { justify-content: flex-start; } }
</style>
