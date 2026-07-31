<template>
  <section class="research-panel quality-panel">
    <div class="panel-head">
      <div>
        <h2>{{ $t('czsc.signalQuality') }}</h2>
        <p>{{ $t('czsc.signalQualityDesc') }}</p>
      </div>
      <div class="panel-actions">
        <label class="field compact">
          <span>{{ $t('czsc.forwardBars') }}</span>
          <a-select v-model="forwardBarsPreset" @change="persistState">
            <a-select-option value="5,10,20">5 / 10 / 20</a-select-option>
            <a-select-option value="3,5,10">3 / 5 / 10</a-select-option>
            <a-select-option value="10,20,40">10 / 20 / 40</a-select-option>
          </a-select>
        </label>
        <label class="field compact">
          <span>{{ $t('czsc.sampleStep') }}</span>
          <a-input-number v-model="sampleStep" :min="1" :max="50" @change="persistState" />
        </label>
        <a-button type="primary" icon="area-chart" :loading="loading" @click="runQuality">
          {{ $t('czsc.runSignalQuality') }}
        </a-button>
      </div>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.signalQualityFailed')" :description="error" />

    <template v-if="result">
      <div class="metric-grid">
        <div><span>{{ $t('czsc.signalTypes') }}</span><strong>{{ result.summary.signal_types }}</strong></div>
        <div><span>{{ $t('czsc.sampleCount') }}</span><strong>{{ result.summary.sample_count }}</strong></div>
        <div><span>{{ $t('czsc.bestSignal') }}</span><strong>{{ result.summary.best_signal_type || '-' }}</strong></div>
        <div><span>{{ $t('czsc.bestQualityScore') }}</span><strong>{{ formatNumber(result.summary.best_quality_score) }}</strong></div>
      </div>

      <a-table
        row-key="signal_type"
        size="small"
        :columns="columns"
        :data-source="result.metrics"
        :pagination="{ pageSize: 12, hideOnSinglePage: true }"
        :scroll="{ x: 900 }"
      >
        <template slot="score" slot-scope="value">
          <a-tag :color="Number(value) >= 70 ? 'green' : Number(value) >= 55 ? 'blue' : 'orange'">{{ formatNumber(value) }}</a-tag>
        </template>
        <template slot="percent" slot-scope="value">{{ percent(value) }}</template>
        <template slot="ratio" slot-scope="value">{{ formatNumber(value) }}</template>
        <template slot="decay" slot-scope="value, row">
          <span class="decay-line">{{ decayLabel(row.decay_curve) }}</span>
        </template>
      </a-table>

      <section class="event-samples">
        <h3>{{ $t('czsc.recentSignalSamples') }}</h3>
        <div class="sample-grid">
          <article v-for="event in recentEvents" :key="event.datetime + event.signal_type" class="sample-card">
            <a-tag :color="$marketColor(event.direction)">{{ directionLabel(event.direction) }}</a-tag>
            <strong>{{ event.signal_type }}</strong>
            <span>{{ formatDate(event.datetime) }} · {{ $t('czsc.score') }} {{ formatNumber(event.score) }}</span>
          </article>
        </div>
      </section>
    </template>
    <a-empty v-else :description="$t('czsc.noSignalQualityResult')" />
  </section>
</template>

<script>
import { getCzscSignalQuality } from '@/api/czsc'

const STORAGE_KEY = 'quantdinger.czsc.quality.v1'

export default {
  name: 'CzscQualityPanel',
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true }
  },
  data () {
    return {
      forwardBarsPreset: '5,10,20',
      sampleStep: 5,
      loading: false,
      error: '',
      result: null,
      columns: [
        { title: this.$t('czsc.signalType'), dataIndex: 'signal_type', key: 'signal_type', width: 180 },
        { title: this.$t('czsc.qualityScore'), dataIndex: 'quality_score', key: 'quality_score', scopedSlots: { customRender: 'score' }, width: 110 },
        { title: this.$t('czsc.sampleCount'), dataIndex: 'sample_count', key: 'sample_count', width: 100 },
        { title: this.$t('czsc.winRate'), dataIndex: 'win_rate', key: 'win_rate', scopedSlots: { customRender: 'percent' }, width: 100 },
        { title: this.$t('czsc.avgForwardReturn'), dataIndex: 'avg_forward_return', key: 'avg_forward_return', scopedSlots: { customRender: 'percent' }, width: 130 },
        { title: this.$t('czsc.profitLossRatio'), dataIndex: 'profit_loss_ratio', key: 'profit_loss_ratio', scopedSlots: { customRender: 'ratio' }, width: 130 },
        { title: this.$t('czsc.decayCurve'), key: 'decay', scopedSlots: { customRender: 'decay' } }
      ]
    }
  },
  computed: {
    forwardBars () {
      return String(this.forwardBarsPreset || '5,10,20').split(',').map(value => Number(value)).filter(Number.isFinite)
    },
    recentEvents () {
      const out = []
      ;((this.result && this.result.metrics) || []).forEach(metric => {
        ;(metric.recent_events || []).slice(-3).forEach(event => out.push({ ...event, signal_type: metric.signal_type }))
      })
      return out.slice(-12).reverse()
    }
  },
  created () {
    this.restoreState()
  },
  methods: {
    restoreState () {
      try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        if (state.forwardBarsPreset) this.forwardBarsPreset = state.forwardBarsPreset
        if (state.sampleStep) this.sampleStep = Number(state.sampleStep)
        if (state.result) this.result = state.result
      } catch (error) {}
    },
    persistState () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ forwardBarsPreset: this.forwardBarsPreset, sampleStep: this.sampleStep, result: this.result }))
      } catch (error) {}
    },
    async runQuality () {
      this.loading = true
      this.error = ''
      try {
        const response = await getCzscSignalQuality({
          symbol: this.symbol,
          timeframe: this.timeframe,
          limit: Math.max(140, Number(this.limit || 1000)),
          forward_bars: this.forwardBars,
          sample_step: Number(this.sampleStep || 5)
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.signalQualityFailed'))
        }
        this.result = response.data
        this.persistState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.signalQualityFailed')
      } finally {
        this.loading = false
      }
    },
    percent (value) {
      const number = Number(value)
      return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
    },
    formatNumber (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(2) : '-'
    },
    decayLabel (curve) {
      return Object.entries(curve || {}).map(([key, value]) => `${key.replace('forward_', '')}: ${this.percent(value)}`).join(' · ')
    },
    directionLabel (direction) {
      return direction === 'bullish' ? this.$t('czsc.openLong') : this.$t('czsc.closeLong')
    },
    formatDate (value) {
      return String(value || '').replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.research-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
.panel-head h2 { margin: 0 0 4px; font-size: 15px; }
.panel-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.panel-actions { display: flex; align-items: flex-end; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.compact { width: 150px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); margin: 14px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.metric-grid > div { display: flex; min-height: 58px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.metric-grid span { color: #8c8c8c; font-size: 10px; }
.metric-grid strong { font-size: 16px; }
.decay-line { color: #595959; font-size: 11px; }
.event-samples { margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
.event-samples h3 { margin: 0 0 10px; font-size: 13px; }
.sample-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.sample-card { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 9px; border: 1px solid #eceef1; border-radius: 7px; background: #fbfbfc; }
.sample-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.sample-card span { margin-left: auto; color: #8c8c8c; font-size: 10px; white-space: nowrap; }
.theme-dark .research-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .metric-grid, .theme-dark .metric-grid > div, .theme-dark .event-samples, .theme-dark .sample-card { border-color: #30343b; }
.theme-dark .sample-card { background: #1c2027; }
@media (max-width: 760px) {
  .panel-head, .panel-actions { flex-direction: column; align-items: stretch; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .compact { width: 100%; }
}
</style>
